package user

import (
	"bytes"
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

type memorySSORepo struct {
	states     map[string]*SSOOIDCStatePO
	identities map[string]*UserIdentityPO
}

func newMemorySSORepo() *memorySSORepo {
	return &memorySSORepo{
		states:     make(map[string]*SSOOIDCStatePO),
		identities: make(map[string]*UserIdentityPO),
	}
}

func (r *memorySSORepo) CreateOIDCState(_ context.Context, record *SSOOIDCStatePO) error {
	cp := *record
	r.states[record.ProviderSlug+":"+record.StateHash] = &cp
	return nil
}

func (r *memorySSORepo) ConsumeOIDCState(_ context.Context, providerSlug, stateHash string, now time.Time) (*SSOOIDCStatePO, error) {
	key := providerSlug + ":" + stateHash
	row := r.states[key]
	if row == nil || row.UsedAt != nil || !row.ExpiresAt.After(now) {
		return nil, domain.ErrSSOStateInvalid
	}
	t := now
	row.UsedAt = &t
	cp := *row
	return &cp, nil
}

func (r *memorySSORepo) FindUserIdentity(_ context.Context, providerSlug, subject string) (*UserIdentityPO, error) {
	row := r.identities[providerSlug+":"+subject]
	if row == nil {
		return nil, nil
	}
	cp := *row
	return &cp, nil
}

func (r *memorySSORepo) CreateUserIdentity(_ context.Context, record *UserIdentityPO) error {
	cp := *record
	r.identities[record.ProviderSlug+":"+record.Subject] = &cp
	return nil
}

type stubOIDCClient struct {
	authEndpoint     string
	lastCode         string
	lastCodeVerifier string
	lastNonce        string
	lastRedirectURI  string
	identity         *OIDCVerifiedIdentity
	err              error
}

func (c *stubOIDCClient) ResolveAuthorizationEndpoint(_ context.Context, provider config.SSOOIDCProviderConfig) (string, error) {
	if provider.AuthorizationEndpoint != "" {
		return provider.AuthorizationEndpoint, nil
	}
	return c.authEndpoint, nil
}

func (c *stubOIDCClient) ExchangeAndVerify(
	_ context.Context,
	_ config.SSOOIDCProviderConfig,
	code string,
	codeVerifier string,
	expectedNonce string,
	redirectURI string,
) (*OIDCVerifiedIdentity, error) {
	c.lastCode = code
	c.lastCodeVerifier = codeVerifier
	c.lastNonce = expectedNonce
	c.lastRedirectURI = redirectURI
	if c.err != nil {
		return nil, c.err
	}
	return c.identity, nil
}

func TestSSOProvidersDisabledByDefaultAndNeverExposeSecret(t *testing.T) {
	svcEmpty := NewSSOService(newMemorySSORepo(), newMockUserRepo(), &stubMFASessionAuthority{}, nil, &stubOIDCClient{}, &config.Config{})
	assert.Empty(t, svcEmpty.ListProviders(context.Background()))
	assert.NotNil(t, svcEmpty.ListProviders(context.Background()))

	_, err := svcEmpty.StartOIDC(context.Background(), &SSOOIDCStartRequest{Provider: "okta"})
	assert.ErrorIs(t, err, domain.ErrSSOProviderNotFound)

	cfg := &config.Config{
		Authentication: config.AuthenticationConfig{
			SSOOIDCProviders: []config.SSOOIDCProviderConfig{
				{
					Slug:         "okta",
					Name:         "Okta Enterprise",
					Enabled:      true,
					Issuer:       "https://idp.example.com",
					ClientID:     "client-1",
					ClientSecret: "super-secret-do-not-expose",
					RedirectURI:  "https://app.example.com/auth/sso/callback",
				},
				{
					Slug:         "disabled-idp",
					Name:         "Disabled IdP",
					Enabled:      false,
					Issuer:       "https://disabled.example.com",
					ClientID:     "client-2",
					ClientSecret: "secret-2",
					RedirectURI:  "https://app.example.com/auth/sso/callback",
				},
			},
		},
	}
	svc := NewSSOService(newMemorySSORepo(), newMockUserRepo(), &stubMFASessionAuthority{}, nil, &stubOIDCClient{}, cfg)
	providers := svc.ListProviders(context.Background())
	require.Len(t, providers, 1)
	assert.Equal(t, SSOProviderSummary{Slug: "okta", Name: "Okta Enterprise"}, providers[0])

	rawJSON, err := json.Marshal(providers)
	require.NoError(t, err)
	assert.NotContains(t, string(rawJSON), "super-secret-do-not-expose")

	_, err = svc.StartOIDC(context.Background(), &SSOOIDCStartRequest{Provider: "disabled-idp"})
	assert.ErrorIs(t, err, domain.ErrSSOProviderNotFound)
}

func TestSSOPKCEStartSingleUseStateAndJITLinking(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 24, 17, 0, 0, 0, time.UTC)

	userRepo := newMockUserRepo()
	existingUser := &domain.User{
		ID:       42,
		Username: "existing",
		Email:    "existing@example.com",
		Status:   1,
	}
	userRepo.users[existingUser.ID] = existingUser

	ssoRepo := newMemorySSORepo()
	sessions := &stubMFASessionAuthority{}
	oidcStub := &stubOIDCClient{
		authEndpoint: "https://idp.example.com/oauth2/authorize",
	}
	cfg := &config.Config{
		Authentication: config.AuthenticationConfig{
			SSOOIDCStateTTL: 10 * time.Minute,
			SSOOIDCProviders: []config.SSOOIDCProviderConfig{
				{
					Slug:                  "okta",
					Name:                  "Okta",
					Enabled:               true,
					Issuer:                "https://idp.example.com",
					AuthorizationEndpoint: "https://idp.example.com/oauth2/authorize",
					ClientID:              "fastbuild-client",
					ClientSecret:          "top-secret",
					RedirectURI:           "https://app.example.com/auth/sso/callback",
				},
			},
		},
	}
	svc := NewSSOService(ssoRepo, userRepo, sessions, nil, oidcStub, cfg)
	svc.now = func() time.Time { return now }

	// Disallowed redirect_uri fails closed.
	_, err := svc.StartOIDC(ctx, &SSOOIDCStartRequest{
		Provider:    "okta",
		RedirectURI: "https://evil.example.com/steal",
	})
	assert.ErrorIs(t, err, domain.ErrInvalidInput)

	// Start OIDC flow -> generates PKCE S256 challenge + state + nonce.
	startResp, err := svc.StartOIDC(ctx, &SSOOIDCStartRequest{Provider: "okta"})
	require.NoError(t, err)
	require.NotEmpty(t, startResp.State)

	parsedAuthURL, err := url.Parse(startResp.AuthorizeURL)
	require.NoError(t, err)
	q := parsedAuthURL.Query()
	assert.Equal(t, "code", q.Get("response_type"))
	assert.Equal(t, "fastbuild-client", q.Get("client_id"))
	assert.Equal(t, startResp.State, q.Get("state"))
	assert.Equal(t, "S256", q.Get("code_challenge_method"))
	require.NotEmpty(t, q.Get("code_challenge"))
	require.NotEmpty(t, q.Get("nonce"))

	// Callback links existing verified-email user.
	oidcStub.identity = &OIDCVerifiedIdentity{
		Subject:       "oidc-sub-existing",
		Email:         "existing@example.com",
		EmailVerified: true,
		Name:          "Existing User",
	}
	callbackResp, err := svc.CallbackOIDC(ctx, &SSOOIDCCallbackRequest{
		Provider: "okta",
		Code:     "auth-code-1",
		State:    startResp.State,
	})
	require.NoError(t, err)
	assert.Equal(t, "session-access-token", callbackResp.AccessToken)
	require.NotNil(t, callbackResp.User)
	assert.Equal(t, existingUser.ID, callbackResp.User.ID)

	// Verify PKCE S256 challenge matches SHA256(code_verifier) passed to token exchange.
	expectedDigest := sha256.Sum256([]byte(oidcStub.lastCodeVerifier))
	assert.Equal(t, base64.RawURLEncoding.EncodeToString(expectedDigest[:]), q.Get("code_challenge"))
	assert.Equal(t, q.Get("nonce"), oidcStub.lastNonce)

	// Replaying the same single-use state fails closed.
	_, err = svc.CallbackOIDC(ctx, &SSOOIDCCallbackRequest{
		Provider: "okta",
		Code:     "auth-code-1",
		State:    startResp.State,
	})
	assert.ErrorIs(t, err, domain.ErrSSOStateInvalid)

	// Second flow for a brand-new user JIT-provisions user + user_identities.
	startResp2, err := svc.StartOIDC(ctx, &SSOOIDCStartRequest{Provider: "okta"})
	require.NoError(t, err)
	oidcStub.identity = &OIDCVerifiedIdentity{
		Subject:       "oidc-sub-new",
		Email:         "newuser@example.com",
		EmailVerified: true,
		Name:          "New Enterprise User",
	}
	jitResp, err := svc.CallbackOIDC(ctx, &SSOOIDCCallbackRequest{
		Provider: "okta",
		Code:     "auth-code-2",
		State:    startResp2.State,
	})
	require.NoError(t, err)
	require.NotNil(t, jitResp.User)
	assert.Equal(t, "newuser@example.com", jitResp.User.Email)
	assert.Equal(t, "New Enterprise User", jitResp.User.Nickname)
	linked, err := ssoRepo.FindUserIdentity(ctx, "okta", "oidc-sub-new")
	require.NoError(t, err)
	require.NotNil(t, linked)
	assert.Equal(t, jitResp.User.ID, linked.UserID)
}

func TestSSOCallbackRespectsMFA(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 11, 24, 17, 30, 0, 0, time.UTC)

	userRepo := newMockUserRepo()
	u := &domain.User{ID: 11, Username: "mfauser", Email: "mfa@example.com", Status: 1}
	userRepo.users[u.ID] = u

	mfaRepo := newMemoryMFARepo()
	sessions := &stubMFASessionAuthority{}
	cfg := &config.Config{
		Authentication: config.AuthenticationConfig{
			MFAEncryptionKey: "sso-mfa-test-encryption-key-0123456789abcdef",
			MFAChallengeTTL:  5 * time.Minute,
			SSOOIDCStateTTL:  10 * time.Minute,
			SSOOIDCProviders: []config.SSOOIDCProviderConfig{
				{
					Slug:                  "okta",
					Name:                  "Okta",
					Enabled:               true,
					Issuer:                "https://idp.example.com",
					AuthorizationEndpoint: "https://idp.example.com/authorize",
					ClientID:              "client-1",
					RedirectURI:           "https://app.example.com/callback",
				},
			},
		},
	}
	mfaSvc := NewMFAService(mfaRepo, userRepo, sessions, cfg)
	mfaSvc.now = func() time.Time { return now }

	// Enable MFA on user 11.
	enrolled, err := mfaSvc.EnrollTOTP(ctx, u.ID)
	require.NoError(t, err)
	code, err := totpCodeAt(enrolled.Secret, now)
	require.NoError(t, err)
	_, err = mfaSvc.VerifyTOTPEnrollment(ctx, u.ID, code)
	require.NoError(t, err)

	oidcStub := &stubOIDCClient{
		identity: &OIDCVerifiedIdentity{
			Subject:       "sub-mfa-11",
			Email:         "mfa@example.com",
			EmailVerified: true,
		},
	}
	ssoSvc := NewSSOService(newMemorySSORepo(), userRepo, sessions, mfaSvc, oidcStub, cfg)
	ssoSvc.now = func() time.Time { return now }

	started, err := ssoSvc.StartOIDC(ctx, &SSOOIDCStartRequest{Provider: "okta"})
	require.NoError(t, err)

	cbResp, err := ssoSvc.CallbackOIDC(ctx, &SSOOIDCCallbackRequest{
		Provider: "okta",
		Code:     "code-1",
		State:    started.State,
	})
	require.NoError(t, err)
	assert.True(t, cbResp.MFARequired)
	assert.NotEmpty(t, cbResp.ChallengeToken)
	assert.Empty(t, cbResp.AccessToken)
	assert.Equal(t, 0, sessions.standardIssued)
}

func TestVerifyOIDCIDTokenRS256AndES256(t *testing.T) {
	now := time.Date(2026, 11, 24, 18, 0, 0, 0, time.UTC)

	// RS256 test
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	rsaJWKS := &oidcJWKS{
		Keys: []oidcJWK{
			{
				Kty: "RSA",
				Kid: "rsa-1",
				Use: "sig",
				Alg: "RS256",
				N:   base64.RawURLEncoding.EncodeToString(rsaKey.N.Bytes()),
				E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(rsaKey.E)).Bytes()),
			},
		},
	}
	validRSAToken := signTestRS256JWT(t, rsaKey, "rsa-1", map[string]any{
		"iss":            "https://idp.example.com",
		"sub":            "user-rsa-1",
		"aud":            "client-1",
		"exp":            now.Add(5 * time.Minute).Unix(),
		"nonce":          "nonce-123",
		"email":          "rsa@example.com",
		"email_verified": true,
		"name":           "RSA User",
	})
	id, err := verifyOIDCIDToken(validRSAToken, "https://idp.example.com", "client-1", "nonce-123", rsaJWKS, now)
	require.NoError(t, err)
	assert.Equal(t, "user-rsa-1", id.Subject)
	assert.Equal(t, "rsa@example.com", id.Email)
	assert.True(t, id.EmailVerified)

	// Wrong nonce rejected.
	_, err = verifyOIDCIDToken(validRSAToken, "https://idp.example.com", "client-1", "wrong-nonce", rsaJWKS, now)
	require.Error(t, err)

	// Wrong issuer rejected.
	_, err = verifyOIDCIDToken(validRSAToken, "https://other.example.com", "client-1", "nonce-123", rsaJWKS, now)
	require.Error(t, err)

	// Wrong audience rejected.
	_, err = verifyOIDCIDToken(validRSAToken, "https://idp.example.com", "other-client", "nonce-123", rsaJWKS, now)
	require.Error(t, err)

	// Expired token rejected.
	_, err = verifyOIDCIDToken(validRSAToken, "https://idp.example.com", "client-1", "nonce-123", rsaJWKS, now.Add(10*time.Minute))
	require.Error(t, err)

	// ES256 test
	ecKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	ecPubBytes, err := ecKey.PublicKey.Bytes()
	require.NoError(t, err)
	require.Len(t, ecPubBytes, 65)
	ecJWKS := &oidcJWKS{
		Keys: []oidcJWK{
			{
				Kty: "EC",
				Kid: "ec-1",
				Use: "sig",
				Crv: "P-256",
				X:   base64.RawURLEncoding.EncodeToString(ecPubBytes[1:33]),
				Y:   base64.RawURLEncoding.EncodeToString(ecPubBytes[33:65]),
			},
		},
	}
	validECToken := signTestES256JWT(t, ecKey, "ec-1", map[string]any{
		"iss":   "https://idp.example.com",
		"sub":   "user-ec-1",
		"aud":   []string{"other", "client-1"},
		"exp":   now.Add(5 * time.Minute).Unix(),
		"nonce": "nonce-ec",
	})
	ecID, err := verifyOIDCIDToken(validECToken, "https://idp.example.com", "client-1", "nonce-ec", ecJWKS, now)
	require.NoError(t, err)
	assert.Equal(t, "user-ec-1", ecID.Subject)
}

func TestSSOHandlerEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ssoSvc := NewSSOService(newMemorySSORepo(), newMockUserRepo(), &stubMFASessionAuthority{}, nil, &stubOIDCClient{}, &config.Config{})
	h := NewHandler(nil, nil, nil, nil, nil, newAuthAbuseGuard(config.AuthenticationRateLimitConfig{}), nil, ssoSvc)
	h.RegisterErrorMappings(response.DefaultErrorMapper)

	engine := gin.New()
	engine.GET("/v1/auth/sso/providers", h.ListSSOProviders)
	engine.POST("/v1/auth/sso/oidc/start", h.StartSSOOIDC)
	engine.POST("/v1/auth/sso/oidc/callback", h.CallbackSSOOIDC)

	// Providers returns empty array []
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/auth/sso/providers", nil)
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"data":[]`)

	// Unknown provider fails closed with 404 AUTH.SSO_PROVIDER_NOT_FOUND
	body, _ := json.Marshal(SSOOIDCStartRequest{Provider: "unknown"})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/sso/oidc/start", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Code)
	assert.Contains(t, rec.Body.String(), domain.CodeSSOProviderNotFound)
}

func signTestRS256JWT(t *testing.T, key *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	headerJSON, err := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT", "kid": kid})
	require.NoError(t, err)
	payloadJSON, err := json.Marshal(claims)
	require.NoError(t, err)

	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(payloadJSON)
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	require.NoError(t, err)
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func signTestES256JWT(t *testing.T, key *ecdsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	headerJSON, err := json.Marshal(map[string]string{"alg": "ES256", "typ": "JWT", "kid": kid})
	require.NoError(t, err)
	payloadJSON, err := json.Marshal(claims)
	require.NoError(t, err)

	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(payloadJSON)
	digest := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, key, digest[:])
	require.NoError(t, err)
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)
}
