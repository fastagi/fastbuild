package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/internal/infra/events"
	"github.com/fastagi/fastbuild/api/internal/infra/router"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

type fakeNativeSessionAuthority struct {
	issueResult     *IssuedAuthenticationSession
	nativeResult    *IssuedNativeSession
	rotateResult    *IssuedNativeSession
	rotateUser      *domain.User
	issueNativeErr  error
	rotateNativeErr error
	revokeNativeErr error

	lastIssueUser   *domain.User
	lastRotateToken string
	lastRevokeToken string
	lastRevokeWhy   string
}

func (f *fakeNativeSessionAuthority) Issue(_ context.Context, _ *domain.User, _ domain.SessionAudience) (*IssuedAuthenticationSession, error) {
	if f.issueResult != nil {
		return f.issueResult, nil
	}
	return &IssuedAuthenticationSession{AccessToken: "standard-token", TokenType: "Bearer", ExpiresIn: 3600}, nil
}

func (f *fakeNativeSessionAuthority) IssueNative(_ context.Context, user *domain.User) (*IssuedNativeSession, error) {
	f.lastIssueUser = user
	if f.issueNativeErr != nil {
		return nil, f.issueNativeErr
	}
	return f.nativeResult, nil
}

func (f *fakeNativeSessionAuthority) RotateNative(_ context.Context, refreshToken string) (*IssuedNativeSession, *domain.User, error) {
	f.lastRotateToken = refreshToken
	if f.rotateNativeErr != nil {
		return nil, nil, f.rotateNativeErr
	}
	return f.rotateResult, f.rotateUser, nil
}

func (f *fakeNativeSessionAuthority) RevokeNativeRefresh(_ context.Context, refreshToken, reason string) error {
	f.lastRevokeToken = refreshToken
	f.lastRevokeWhy = reason
	return f.revokeNativeErr
}

func TestNativeLoginRefreshAndLogoutServiceFlows(t *testing.T) {
	passwordHash, err := crypto.HashPassword("password123")
	require.NoError(t, err)

	alice := &domain.User{
		ID:       7,
		Username: "alice",
		Email:    "alice@example.com",
		Password: passwordHash,
		Status:   1,
	}
	repo := &fakeRepo{
		findByLoginFn: func(_ context.Context, identifier string) (*domain.User, error) {
			if identifier == "alice" || identifier == "alice@example.com" {
				return alice, nil
			}
			return nil, gorm.ErrRecordNotFound
		},
	}
	authority := &fakeNativeSessionAuthority{
		nativeResult: &IssuedNativeSession{
			AccessToken:      "native-access-1",
			TokenType:        "Bearer",
			ExpiresIn:        900,
			RefreshToken:     "native-refresh-1",
			RefreshExpiresIn: 2592000,
		},
		rotateResult: &IssuedNativeSession{
			AccessToken:      "native-access-2",
			TokenType:        "Bearer",
			ExpiresIn:        900,
			RefreshToken:     "native-refresh-2",
			RefreshExpiresIn: 2591100,
		},
		rotateUser: alice,
	}

	svc := NewService(repo, repo, authority, events.NewEventBus(), &fakeUserMailer{}, NewAccountDeletionPolicy())

	loginResp, err := svc.NativeLogin(context.Background(), &UserLoginRequest{
		Username: "alice@example.com",
		Password: "password123",
	})
	require.NoError(t, err)
	assert.Equal(t, "native-access-1", loginResp.AccessToken)
	assert.Equal(t, "Bearer", loginResp.TokenType)
	assert.Equal(t, int64(900), loginResp.ExpiresIn)
	assert.Equal(t, "native-refresh-1", loginResp.RefreshToken)
	assert.Equal(t, int64(2592000), loginResp.RefreshExpiresIn)
	require.NotNil(t, loginResp.User)
	assert.Equal(t, alice.ID, loginResp.User.ID)
	assert.Equal(t, alice.ID, authority.lastIssueUser.ID)

	refreshResp, err := svc.NativeRefresh(context.Background(), &NativeRefreshRequest{
		RefreshToken: "native-refresh-1",
	})
	require.NoError(t, err)
	assert.Equal(t, "native-refresh-1", authority.lastRotateToken)
	assert.Equal(t, "native-access-2", refreshResp.AccessToken)
	assert.Equal(t, "native-refresh-2", refreshResp.RefreshToken)
	assert.Equal(t, alice.ID, refreshResp.User.ID)

	require.NoError(t, svc.NativeLogout(context.Background(), &NativeLogoutRequest{
		RefreshToken: "native-refresh-2",
	}))
	assert.Equal(t, "native-refresh-2", authority.lastRevokeToken)
	assert.Equal(t, sessionRevocationLogout, authority.lastRevokeWhy)
}

func TestNativeLoginRejectsUnknownAndDisabledAccountsUniformly(t *testing.T) {
	passwordHash, err := crypto.HashPassword("password123")
	require.NoError(t, err)

	disabled := &domain.User{
		ID:       9,
		Username: "disabled",
		Email:    "disabled@example.com",
		Password: passwordHash,
		Status:   0,
	}
	repo := &fakeRepo{
		findByLoginFn: func(_ context.Context, identifier string) (*domain.User, error) {
			if identifier == "disabled" || identifier == "disabled@example.com" {
				return disabled, nil
			}
			return nil, gorm.ErrRecordNotFound
		},
	}
	authority := &fakeNativeSessionAuthority{}
	svc := NewService(repo, repo, authority, events.NewEventBus(), &fakeUserMailer{}, NewAccountDeletionPolicy())

	_, err = svc.NativeLogin(context.Background(), &UserLoginRequest{
		Username: "missing",
		Password: "password123",
	})
	assert.ErrorIs(t, err, domain.ErrInvalidCredentials)
	assert.Nil(t, authority.lastIssueUser)

	_, err = svc.NativeLogin(context.Background(), &UserLoginRequest{
		Username: "disabled",
		Password: "password123",
	})
	assert.ErrorIs(t, err, domain.ErrInvalidCredentials)
	assert.Nil(t, authority.lastIssueUser)
}

func TestNativeAuthHandlersValidateAndMapResponses(t *testing.T) {
	gin.SetMode(gin.TestMode)

	passwordHash, err := crypto.HashPassword("password123")
	require.NoError(t, err)
	alice := &domain.User{
		ID:       11,
		Username: "alice",
		Email:    "alice@example.com",
		Password: passwordHash,
		Status:   1,
	}
	repo := &fakeRepo{
		findByLoginFn: func(_ context.Context, identifier string) (*domain.User, error) {
			if identifier == "alice" || identifier == "alice@example.com" {
				return alice, nil
			}
			return nil, gorm.ErrRecordNotFound
		},
	}
	authority := &fakeNativeSessionAuthority{
		nativeResult: &IssuedNativeSession{
			AccessToken:      "access-1",
			TokenType:        "Bearer",
			ExpiresIn:        900,
			RefreshToken:     "refresh-1",
			RefreshExpiresIn: 2592000,
		},
		rotateResult: &IssuedNativeSession{
			AccessToken:      "access-2",
			TokenType:        "Bearer",
			ExpiresIn:        900,
			RefreshToken:     "refresh-2",
			RefreshExpiresIn: 2591000,
		},
		rotateUser: alice,
	}
	svc := NewService(repo, repo, authority, events.NewEventBus(), &fakeUserMailer{}, NewAccountDeletionPolicy())
	h := NewHandler(svc, svc, svc, nil, nil, newAuthAbuseGuard(config.AuthenticationRateLimitConfig{}), nil, nil)
	h.RegisterErrorMappings(response.DefaultErrorMapper)

	engine := gin.New()
	routes := router.New(engine).Prefix("/v1")
	h.RegisterMiddleware(routes)
	h.RegisterRoutes(routes)

	// Native login
	rec := performAuthRequest(engine, "/v1/auth/native/login", `{"username":"alice","password":"password123"}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var loginEnvelope struct {
		Code int                   `json:"code"`
		Data NativeSessionResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &loginEnvelope))
	assert.Equal(t, 0, loginEnvelope.Code)
	assert.Equal(t, "access-1", loginEnvelope.Data.AccessToken)
	assert.Equal(t, "refresh-1", loginEnvelope.Data.RefreshToken)
	assert.Equal(t, "Bearer", loginEnvelope.Data.TokenType)
	assert.Equal(t, int64(900), loginEnvelope.Data.ExpiresIn)
	assert.Equal(t, int64(2592000), loginEnvelope.Data.RefreshExpiresIn)

	// Missing refresh_token fails validation with 422
	badRefresh := performAuthRequest(engine, "/v1/auth/native/refresh", `{}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusUnprocessableEntity, badRefresh.Code, badRefresh.Body.String())

	// Valid refresh
	refreshRec := performAuthRequest(engine, "/v1/auth/native/refresh", `{"refresh_token":"refresh-1"}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusOK, refreshRec.Code, refreshRec.Body.String())
	var refreshEnvelope struct {
		Code int                   `json:"code"`
		Data NativeSessionResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(refreshRec.Body.Bytes(), &refreshEnvelope))
	assert.Equal(t, "access-2", refreshEnvelope.Data.AccessToken)
	assert.Equal(t, "refresh-2", refreshEnvelope.Data.RefreshToken)

	// Unauthorized refresh
	authority.rotateNativeErr = domain.ErrAuthenticationRequired
	unauthRec := performAuthRequest(engine, "/v1/auth/native/refresh", `{"refresh_token":"reused"}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusUnauthorized, unauthRec.Code, unauthRec.Body.String())
	var errResp response.ErrorResponse
	require.NoError(t, json.Unmarshal(unauthRec.Body.Bytes(), &errResp))
	assert.Equal(t, response.ErrorCodeUnauthorized, errResp.ErrorCode)

	// Disabled account on refresh
	authority.rotateNativeErr = domain.ErrAccountDisabled
	disabledRec := performAuthRequest(engine, "/v1/auth/native/refresh", `{"refresh_token":"refresh-2"}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusForbidden, disabledRec.Code, disabledRec.Body.String())
	require.NoError(t, json.Unmarshal(disabledRec.Body.Bytes(), &errResp))
	assert.Equal(t, domain.CodeAccountDisabled, errResp.ErrorCode)

	// Native logout
	logoutRec := performAuthRequest(engine, "/v1/auth/native/logout", `{"refresh_token":"refresh-2"}`, "127.0.0.1:1234")
	require.Equal(t, http.StatusOK, logoutRec.Code, logoutRec.Body.String())
	assert.Equal(t, "refresh-2", authority.lastRevokeToken)
}

func TestNativeSessionServiceFailsClosedWithoutPersistence(t *testing.T) {
	service := NewSessionService(NewRepository(nil), &config.Config{
		Authentication: config.AuthenticationConfig{
			SessionTTL:           time.Hour,
			SessionIdleTimeout:   30 * time.Minute,
			SessionTouchInterval: 5 * time.Minute,
			SessionRetention:     time.Hour,
			NativeAccessTTL:      15 * time.Minute,
		},
	})

	_, err := service.IssueNative(context.Background(), &domain.User{ID: 1, Status: 1})
	assert.ErrorIs(t, err, domain.ErrServiceUnavailable)

	_, _, err = service.RotateNative(context.Background(), strings.Repeat("a", 43))
	assert.ErrorIs(t, err, domain.ErrServiceUnavailable)

	err = service.RevokeNativeRefresh(context.Background(), strings.Repeat("a", 43), sessionRevocationLogout)
	assert.ErrorIs(t, err, domain.ErrServiceUnavailable)

	// Malformed refresh tokens are rejected before persistence.
	_, _, err = service.RotateNative(context.Background(), "not-a-valid-credential")
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)
	assert.NoError(t, service.RevokeNativeRefresh(context.Background(), "not-a-valid-credential", sessionRevocationLogout))
}

func TestNativeSessionRotationReplayDetectionAndLifecycle(t *testing.T) {
	service, db, user := newAuthenticationSessionFixture(t)
	base := time.Date(2026, time.November, 24, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return base }

	issued, err := service.IssueNative(context.Background(), user)
	require.NoError(t, err)
	require.NotEmpty(t, issued.AccessToken)
	require.NotEmpty(t, issued.RefreshToken)
	assert.NotEqual(t, issued.AccessToken, issued.RefreshToken)
	assert.Equal(t, "Bearer", issued.TokenType)
	assert.Equal(t, int64(15*60), issued.ExpiresIn)
	assert.Equal(t, int64(2*3600), issued.RefreshExpiresIn)

	// Access token works for Bearer auth; refresh token MUST NEVER work as a Bearer access token.
	identity, err := service.Authenticate(context.Background(), issued.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, user.ID, identity.UserID)

	_, err = service.Authenticate(context.Background(), issued.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)

	// Short-lived access token expires after 15m, but refresh token remains usable.
	service.now = func() time.Time { return base.Add(16 * time.Minute) }
	_, err = service.Authenticate(context.Background(), issued.AccessToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)

	// Refresh succeeds and issues a brand-new token pair.
	rotated, refreshedUser, err := service.RotateNative(context.Background(), issued.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, user.ID, refreshedUser.ID)
	assert.NotEqual(t, issued.AccessToken, rotated.AccessToken)
	assert.NotEqual(t, issued.RefreshToken, rotated.RefreshToken)

	// New access token works immediately.
	identity, err = service.Authenticate(context.Background(), rotated.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, user.ID, identity.UserID)

	// Replay detection: presenting the already-rotated refresh token revokes the entire family.
	_, _, err = service.RotateNative(context.Background(), issued.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)

	// Both the rotated access token and rotated refresh token are now revoked.
	_, err = service.Authenticate(context.Background(), rotated.AccessToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)
	_, _, err = service.RotateNative(context.Background(), rotated.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)

	// Verify only hashes were stored, never plaintext tokens.
	var rows []AuthenticationSessionPO
	require.NoError(t, db.Find(&rows).Error)
	require.Len(t, rows, 2)
	for _, row := range rows {
		assert.NotEqual(t, issued.AccessToken, row.TokenHash)
		assert.NotEqual(t, rotated.AccessToken, row.TokenHash)
		require.NotNil(t, row.RefreshTokenHash)
		assert.NotEqual(t, issued.RefreshToken, *row.RefreshTokenHash)
		assert.NotEqual(t, rotated.RefreshToken, *row.RefreshTokenHash)
	}
}

func TestNativeSessionLogoutAndDisabledAccountRevocation(t *testing.T) {
	service, db, user := newAuthenticationSessionFixture(t)
	base := time.Date(2026, time.November, 24, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return base }

	issued, err := service.IssueNative(context.Background(), user)
	require.NoError(t, err)

	// Native logout by refresh token revokes both refresh and access tokens.
	require.NoError(t, service.RevokeNativeRefresh(context.Background(), issued.RefreshToken, sessionRevocationLogout))
	_, err = service.Authenticate(context.Background(), issued.AccessToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)
	_, _, err = service.RotateNative(context.Background(), issued.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrAuthenticationRequired)

	// Disabled account cannot refresh.
	second, err := service.IssueNative(context.Background(), user)
	require.NoError(t, err)
	require.NoError(t, db.Model(&UserPO{}).Where("id = ?", user.ID).Update("status", 0).Error)
	_, _, err = service.RotateNative(context.Background(), second.RefreshToken)
	assert.True(t, errors.Is(err, domain.ErrAccountDisabled), "expected ErrAccountDisabled, got %v", err)
}
