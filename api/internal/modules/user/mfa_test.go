package user

import (
	"bytes"
	"context"
	"encoding/base32"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

type memoryUserRepo struct {
	users  map[uint]*domain.User
	nextID uint
}

func newMockUserRepo() *memoryUserRepo {
	return &memoryUserRepo{
		users:  make(map[uint]*domain.User),
		nextID: 100,
	}
}

func (r *memoryUserRepo) Create(_ context.Context, user *domain.User) error {
	if user.ID == 0 {
		r.nextID++
		user.ID = r.nextID
	}
	cp := *user
	r.users[user.ID] = &cp
	return nil
}

func (r *memoryUserRepo) Update(_ context.Context, user *domain.User) error {
	cp := *user
	r.users[user.ID] = &cp
	return nil
}

func (r *memoryUserRepo) Delete(_ context.Context, id uint) error {
	delete(r.users, id)
	return nil
}

func (r *memoryUserRepo) FindByID(_ context.Context, id uint) (*domain.User, error) {
	u, ok := r.users[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	cp := *u
	return &cp, nil
}

func (r *memoryUserRepo) FindByUsername(_ context.Context, username string) (*domain.User, error) {
	for _, u := range r.users {
		if u.Username == username {
			cp := *u
			return &cp, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *memoryUserRepo) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range r.users {
		if u.Email == email {
			cp := *u
			return &cp, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *memoryUserRepo) FindByLoginIdentifier(ctx context.Context, identifier string) (*domain.User, error) {
	if u, err := r.FindByEmail(ctx, identifier); err == nil {
		return u, nil
	}
	return r.FindByUsername(ctx, identifier)
}

func (r *memoryUserRepo) FindAll(_ context.Context, _, _ int) ([]*domain.User, int64, error) {
	out := make([]*domain.User, 0, len(r.users))
	for _, u := range r.users {
		cp := *u
		out = append(out, &cp)
	}
	return out, int64(len(out)), nil
}

func (r *memoryUserRepo) DeleteAccount(_ context.Context, userID uint, _ func(context.Context) error) error {
	delete(r.users, userID)
	return nil
}

func (r *memoryUserRepo) UpdatePasswordAndRevokeSessions(_ context.Context, userID uint, passwordHash string, _ time.Time) error {
	if u, ok := r.users[userID]; ok {
		u.Password = passwordHash
	}
	return nil
}

func (r *memoryUserRepo) RecordLogin(_ context.Context, userID uint, at time.Time) error {
	if u, ok := r.users[userID]; ok {
		t := at
		u.LastLogin = &t
	}
	return nil
}

func (r *memoryUserRepo) StorePasswordResetToken(_ context.Context, _ uint, _ string, _ time.Time) error {
	return nil
}

func (r *memoryUserRepo) ResetPasswordWithToken(_ context.Context, _, _ string, _ time.Time) error {
	return nil
}

type memoryMFARepo struct {
	methods       map[uint]*UserMFAMethodPO
	recoveryCodes map[uint][]*UserMFARecoveryCodePO
	challenges    map[string]*MFAChallengePO
}

func newMemoryMFARepo() *memoryMFARepo {
	return &memoryMFARepo{
		methods:       make(map[uint]*UserMFAMethodPO),
		recoveryCodes: make(map[uint][]*UserMFARecoveryCodePO),
		challenges:    make(map[string]*MFAChallengePO),
	}
}

func (r *memoryMFARepo) GetMFAMethod(_ context.Context, userID uint, method string) (*UserMFAMethodPO, error) {
	m := r.methods[userID]
	if m == nil || m.Method != method {
		return nil, nil
	}
	cp := *m
	return &cp, nil
}

func (r *memoryMFARepo) UpsertPendingMFAMethod(_ context.Context, record *UserMFAMethodPO) error {
	cp := *record
	r.methods[record.UserID] = &cp
	return nil
}

func (r *memoryMFARepo) ActivateMFAMethodAndReplaceRecoveryCodes(
	_ context.Context,
	userID uint,
	method string,
	enrolledAt time.Time,
	lastUsedStep int64,
	codeHashes []string,
) error {
	m := r.methods[userID]
	if m == nil || m.Method != method {
		return domain.ErrMFANotEnabled
	}
	m.Enabled = true
	t := enrolledAt
	m.EnrolledAt = &t
	m.LastUsedStep = lastUsedStep
	m.UpdatedAt = enrolledAt
	rows := make([]*UserMFARecoveryCodePO, 0, len(codeHashes))
	for _, h := range codeHashes {
		rows = append(rows, &UserMFARecoveryCodePO{
			UserID:    userID,
			CodeHash:  h,
			CreatedAt: enrolledAt,
		})
	}
	r.recoveryCodes[userID] = rows
	return nil
}

func (r *memoryMFARepo) UpdateLastUsedStep(_ context.Context, userID uint, method string, step int64) (bool, error) {
	m := r.methods[userID]
	if m == nil || m.Method != method || !m.Enabled || m.LastUsedStep >= step {
		return false, nil
	}
	m.LastUsedStep = step
	return true, nil
}

func (r *memoryMFARepo) CountUnusedRecoveryCodes(_ context.Context, userID uint) (int64, error) {
	var count int64
	for _, row := range r.recoveryCodes[userID] {
		if row.UsedAt == nil {
			count++
		}
	}
	return count, nil
}

func (r *memoryMFARepo) ConsumeRecoveryCode(_ context.Context, userID uint, codeHash string, usedAt time.Time) (bool, error) {
	for _, row := range r.recoveryCodes[userID] {
		if row.CodeHash == codeHash && row.UsedAt == nil {
			t := usedAt
			row.UsedAt = &t
			return true, nil
		}
	}
	return false, nil
}

func (r *memoryMFARepo) DisableMFA(_ context.Context, userID uint) error {
	delete(r.methods, userID)
	delete(r.recoveryCodes, userID)
	for hash, ch := range r.challenges {
		if ch.UserID == userID {
			delete(r.challenges, hash)
		}
	}
	return nil
}

func (r *memoryMFARepo) CreateMFAChallenge(_ context.Context, challenge *MFAChallengePO) error {
	cp := *challenge
	r.challenges[challenge.TokenHash] = &cp
	return nil
}

func (r *memoryMFARepo) GetMFAChallengeByHash(_ context.Context, tokenHash string) (*MFAChallengePO, error) {
	ch := r.challenges[tokenHash]
	if ch == nil {
		return nil, nil
	}
	cp := *ch
	return &cp, nil
}

func (r *memoryMFARepo) ConsumeMFAChallenge(_ context.Context, id string, usedAt time.Time) (bool, error) {
	for _, ch := range r.challenges {
		if ch.ID == id && ch.UsedAt == nil && ch.ExpiresAt.After(usedAt) {
			t := usedAt
			ch.UsedAt = &t
			return true, nil
		}
	}
	return false, nil
}

type stubMFASessionAuthority struct {
	standardIssued int
	nativeIssued   int
}

func (s *stubMFASessionAuthority) Issue(_ context.Context, _ *domain.User, _ domain.SessionAudience) (*IssuedAuthenticationSession, error) {
	s.standardIssued++
	return &IssuedAuthenticationSession{
		AccessToken: "session-access-token",
		TokenType:   "Bearer",
		ExpiresIn:   3600,
	}, nil
}

func (s *stubMFASessionAuthority) IssueNative(_ context.Context, _ *domain.User) (*IssuedNativeSession, error) {
	s.nativeIssued++
	return &IssuedNativeSession{
		AccessToken:      "native-access-token",
		TokenType:        "Bearer",
		ExpiresIn:        900,
		RefreshToken:     "native-refresh-token",
		RefreshExpiresIn: 86400,
	}, nil
}

func (s *stubMFASessionAuthority) RotateNative(_ context.Context, _ string) (*IssuedNativeSession, *domain.User, error) {
	return nil, nil, domain.ErrAuthenticationRequired
}

func (s *stubMFASessionAuthority) RevokeNativeRefresh(_ context.Context, _, _ string) error {
	return nil
}

func TestTOTPRFC6238Vectors(t *testing.T) {
	// RFC 6238 Appendix B SHA-1 seed: ASCII "12345678901234567890" (20 bytes)
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))

	vectors := []struct {
		unix int64
		code string
	}{
		{59, "287082"},
		{1111111109, "081804"},
		{1111111111, "050471"},
		{1234567890, "005924"},
		{2000000000, "279037"},
		{20000000000, "353130"},
	}

	for _, tc := range vectors {
		got, err := totpCodeAt(secret, time.Unix(tc.unix, 0).UTC())
		require.NoError(t, err)
		assert.Equal(t, tc.code, got, "unix=%d", tc.unix)
	}
}

func TestTOTPWindowAndReplayProtection(t *testing.T) {
	secret, err := generateTOTPSecret()
	require.NoError(t, err)

	base := time.Date(2026, 11, 24, 12, 0, 15, 0, time.UTC)
	prevCode, err := totpCodeAt(secret, base.Add(-30*time.Second))
	require.NoError(t, err)
	currCode, err := totpCodeAt(secret, base)
	require.NoError(t, err)
	nextCode, err := totpCodeAt(secret, base.Add(30*time.Second))
	require.NoError(t, err)
	tooOldCode, err := totpCodeAt(secret, base.Add(-60*time.Second))
	require.NoError(t, err)

	step, ok := verifyTOTPCode(secret, prevCode, base, 0)
	require.True(t, ok)
	assert.Equal(t, (base.Unix()/30)-1, step)

	// Replay of same step is rejected.
	_, ok = verifyTOTPCode(secret, prevCode, base, step)
	assert.False(t, ok)

	// Next step succeeds.
	currStep, ok := verifyTOTPCode(secret, currCode, base, step)
	require.True(t, ok)
	assert.Equal(t, base.Unix()/30, currStep)

	// +1 window succeeds.
	nextStep, ok := verifyTOTPCode(secret, nextCode, base, currStep)
	require.True(t, ok)
	assert.Equal(t, (base.Unix()/30)+1, nextStep)

	// -2 window rejected.
	_, ok = verifyTOTPCode(secret, tooOldCode, base, 0)
	assert.False(t, ok)

	// Non-digit or wrong length rejected.
	_, ok = verifyTOTPCode(secret, "abcdef", base, 0)
	assert.False(t, ok)
	_, ok = verifyTOTPCode(secret, "12345", base, 0)
	assert.False(t, ok)
}

func TestMFALifecycleAndRecoveryCodeSingleUse(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 24, 15, 0, 0, 0, time.UTC)

	userRepo := newMockUserRepo()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("Secret123!"), bcrypt.MinCost)
	require.NoError(t, err)
	u := &domain.User{
		ID:       7,
		Username: "alice",
		Email:    "alice@example.com",
		Password: string(passwordHash),
		Status:   1,
	}
	userRepo.users[u.ID] = u

	mfaRepo := newMemoryMFARepo()
	sessions := &stubMFASessionAuthority{}
	cfg := &config.Config{
		App: config.AppConfig{Name: "FastBuild"},
		Authentication: config.AuthenticationConfig{
			MFAEncryptionKey: "test-mfa-encryption-key-0123456789abcdef",
			MFAIssuer:        "FastBuild",
			MFAChallengeTTL:  5 * time.Minute,
		},
	}

	mfaSvc := NewMFAService(mfaRepo, userRepo, sessions, cfg)
	mfaSvc.now = func() time.Time { return now }

	// Initially disabled.
	status, err := mfaSvc.Status(ctx, u.ID)
	require.NoError(t, err)
	assert.False(t, status.Enabled)
	assert.Equal(t, int64(0), status.RemainingRecoveryCodes)

	// Enroll generates secret stored encrypted at rest.
	enrolled, err := mfaSvc.EnrollTOTP(ctx, u.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, enrolled.Secret)
	assert.Contains(t, enrolled.OTPAuthURI, "otpauth://totp/")
	assert.Equal(t, "FastBuild", enrolled.Issuer)
	assert.Equal(t, "alice@example.com", enrolled.AccountName)
	storedMethod := mfaRepo.methods[u.ID]
	require.NotNil(t, storedMethod)
	assert.False(t, storedMethod.Enabled)
	assert.NotEqual(t, enrolled.Secret, storedMethod.SecretCiphertext, "secret must be encrypted at rest")

	// Invalid TOTP code rejected during verify.
	_, err = mfaSvc.VerifyTOTPEnrollment(ctx, u.ID, "000000")
	assert.ErrorIs(t, err, domain.ErrMFAInvalidCode)

	// Valid TOTP code activates MFA and issues 8 recovery codes stored ONLY as SHA-256 hashes.
	code, err := totpCodeAt(enrolled.Secret, now)
	require.NoError(t, err)
	verified, err := mfaSvc.VerifyTOTPEnrollment(ctx, u.ID, code)
	require.NoError(t, err)
	assert.True(t, verified.Enabled)
	require.Len(t, verified.RecoveryCodes, 8)
	for i, rc := range verified.RecoveryCodes {
		assert.Equal(t, hashRecoveryCode(rc), mfaRepo.recoveryCodes[u.ID][i].CodeHash)
		assert.NotEqual(t, rc, mfaRepo.recoveryCodes[u.ID][i].CodeHash)
	}

	// Re-enrolling while enabled fails with ErrMFAAlreadyEnabled.
	_, err = mfaSvc.EnrollTOTP(ctx, u.ID)
	assert.ErrorIs(t, err, domain.ErrMFAAlreadyEnabled)

	// Status reports enabled with 8 remaining recovery codes.
	status, err = mfaSvc.Status(ctx, u.ID)
	require.NoError(t, err)
	assert.True(t, status.Enabled)
	assert.Equal(t, mfaMethodTOTP, status.Method)
	assert.Equal(t, int64(8), status.RemainingRecoveryCodes)
	assert.NotNil(t, status.EnrolledAt)

	// Login with MFA enabled returns challenge instead of issuing a session.
	authSvc := NewService(userRepo, userRepo, sessions, nil, nil, nil)
	authSvc.mfa = mfaSvc
	loginResp, err := authSvc.Login(ctx, &UserLoginRequest{Username: "alice", Password: "Secret123!"})
	require.NoError(t, err)
	assert.True(t, loginResp.MFARequired)
	assert.NotEmpty(t, loginResp.ChallengeToken)
	assert.Empty(t, loginResp.AccessToken)
	assert.Equal(t, 0, sessions.standardIssued)

	// Replaying the enrollment TOTP code in the same 30s window is rejected.
	_, _, err = mfaSvc.VerifyChallenge(ctx, &MFAChallengeVerifyRequest{
		ChallengeToken: loginResp.ChallengeToken,
		Code:           code,
	})
	assert.ErrorIs(t, err, domain.ErrMFAInvalidCode)

	// Advance 30s -> TOTP succeeds and issues standard session.
	now = now.Add(30 * time.Second)
	nextCode, err := totpCodeAt(enrolled.Secret, now)
	require.NoError(t, err)
	verifiedResp, verifiedUID, err := mfaSvc.VerifyChallenge(ctx, &MFAChallengeVerifyRequest{
		ChallengeToken: loginResp.ChallengeToken,
		Code:           nextCode,
	})
	require.NoError(t, err)
	assert.Equal(t, u.ID, verifiedUID)
	sessionResp, ok := verifiedResp.(*UserLoginResponse)
	require.True(t, ok)
	assert.Equal(t, "session-access-token", sessionResp.AccessToken)
	assert.Equal(t, 1, sessions.standardIssued)

	// Replaying the same challenge token fails.
	now = now.Add(30 * time.Second)
	laterCode, err := totpCodeAt(enrolled.Secret, now)
	require.NoError(t, err)
	_, _, err = mfaSvc.VerifyChallenge(ctx, &MFAChallengeVerifyRequest{
		ChallengeToken: loginResp.ChallengeToken,
		Code:           laterCode,
	})
	assert.ErrorIs(t, err, domain.ErrMFAChallengeInvalid)

	// Native login with MFA enabled returns native challenge, and recovery code consumes atomically and issues native tokens.
	nativeLoginResp, err := authSvc.NativeLogin(ctx, &UserLoginRequest{Username: "alice", Password: "Secret123!"})
	require.NoError(t, err)
	assert.True(t, nativeLoginResp.MFARequired)
	assert.NotEmpty(t, nativeLoginResp.ChallengeToken)
	assert.Equal(t, 0, sessions.nativeIssued)

	firstRecovery := verified.RecoveryCodes[0]
	nativeVerified, _, err := mfaSvc.VerifyChallenge(ctx, &MFAChallengeVerifyRequest{
		ChallengeToken: nativeLoginResp.ChallengeToken,
		Code:           firstRecovery,
	})
	require.NoError(t, err)
	nativeSession, ok := nativeVerified.(*NativeSessionResponse)
	require.True(t, ok)
	assert.Equal(t, "native-access-token", nativeSession.AccessToken)
	assert.Equal(t, "native-refresh-token", nativeSession.RefreshToken)
	assert.Equal(t, 1, sessions.nativeIssued)

	// Remaining recovery codes decremented to 7.
	status, err = mfaSvc.Status(ctx, u.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(7), status.RemainingRecoveryCodes)

	// Attempting to reuse the consumed recovery code to disable MFA fails.
	_, err = mfaSvc.DisableTOTP(ctx, u.ID, firstRecovery)
	assert.ErrorIs(t, err, domain.ErrMFAInvalidCode)

	// Disabling with an unused recovery code succeeds and clears secret + recovery codes.
	disabled, err := mfaSvc.DisableTOTP(ctx, u.ID, verified.RecoveryCodes[1])
	require.NoError(t, err)
	assert.False(t, disabled.Enabled)
	assert.Nil(t, mfaRepo.methods[u.ID])
	assert.Empty(t, mfaRepo.recoveryCodes[u.ID])
}

func TestMFAFailClosedWithoutEncryptionKey(t *testing.T) {
	mfaSvc := NewMFAService(newMemoryMFARepo(), newMockUserRepo(), &stubMFASessionAuthority{}, &config.Config{})
	_, err := mfaSvc.EnrollTOTP(context.Background(), 1)
	assert.ErrorIs(t, err, domain.ErrServiceUnavailable)
}

func TestMFAHandlerEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, 11, 24, 16, 0, 0, 0, time.UTC)

	userRepo := newMockUserRepo()
	userRepo.users[1] = &domain.User{ID: 1, Username: "bob", Email: "bob@example.com", Status: 1}
	mfaRepo := newMemoryMFARepo()
	sessions := &stubMFASessionAuthority{}
	cfg := &config.Config{
		App: config.AppConfig{Name: "FastBuild"},
		Authentication: config.AuthenticationConfig{
			MFAEncryptionKey: "handler-mfa-encryption-key-0123456789abcdef",
			MFAIssuer:        "FastBuild",
			MFAChallengeTTL:  5 * time.Minute,
		},
	}
	mfaSvc := NewMFAService(mfaRepo, userRepo, sessions, cfg)
	mfaSvc.now = func() time.Time { return now }

	h := NewHandler(nil, nil, nil, nil, nil, newAuthAbuseGuard(config.AuthenticationRateLimitConfig{}), mfaSvc, nil)
	h.RegisterErrorMappings(response.DefaultErrorMapper)

	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})
	engine.GET("/v1/auth/mfa/status", h.GetMFAStatus)
	engine.POST("/v1/auth/mfa/totp/enroll", h.EnrollMFATOTP)
	engine.POST("/v1/auth/mfa/totp/verify", h.VerifyMFATOTP)
	engine.POST("/v1/auth/mfa/totp/disable", h.DisableMFATOTP)
	engine.POST("/v1/auth/mfa/challenge/verify", h.VerifyMFAChallenge)

	// Enroll via HTTP
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/mfa/totp/enroll", nil)
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var enrollEnv struct {
		Code int                   `json:"code"`
		Data MFATOTPEnrollResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &enrollEnv))
	require.NotEmpty(t, enrollEnv.Data.Secret)

	// Verify via HTTP
	totpCode, err := totpCodeAt(enrollEnv.Data.Secret, now)
	require.NoError(t, err)
	body, _ := json.Marshal(MFACodeRequest{Code: totpCode})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/mfa/totp/verify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	// Challenge verify via HTTP with invalid token returns 401 AUTH.MFA_CHALLENGE_INVALID
	badBody, _ := json.Marshal(MFAChallengeVerifyRequest{
		ChallengeToken: crypto.SHA256Hex("missing"),
		Code:           "123456",
	})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/mfa/challenge/verify", bytes.NewReader(badBody))
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), domain.CodeMFAChallengeInvalid)
}
