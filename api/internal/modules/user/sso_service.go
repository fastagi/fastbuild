package user

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
)

// SSOProviderSummary is the public metadata for one enabled OIDC provider.
// It deliberately never exposes client_secret or internal endpoints.
type SSOProviderSummary struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// SSOOIDCStartRequest initiates an OIDC PKCE authorization flow.
type SSOOIDCStartRequest struct {
	Provider    string `json:"provider" binding:"required,max=64"`
	RedirectURI string `json:"redirect_uri" binding:"max=512"`
}

// SSOOIDCStartResponse returns the authorization URL and single-use state token.
type SSOOIDCStartResponse struct {
	AuthorizeURL string `json:"authorize_url"`
	State        string `json:"state"`
}

// SSOOIDCCallbackRequest completes an OIDC authorization callback.
type SSOOIDCCallbackRequest struct {
	Provider string `json:"provider" binding:"required,max=64"`
	Code     string `json:"code" binding:"required,max=2048"`
	State    string `json:"state" binding:"required,max=256"`
}

// SSOService owns Enterprise OIDC provider discovery, PKCE start, and callback verification.
type SSOService interface {
	ListProviders(ctx context.Context) []SSOProviderSummary
	StartOIDC(ctx context.Context, req *SSOOIDCStartRequest) (*SSOOIDCStartResponse, error)
	CallbackOIDC(ctx context.Context, req *SSOOIDCCallbackRequest) (*UserLoginResponse, error)
}

type ssoService struct {
	repo        ssoRepository
	users       userRepository
	sessions    authenticationSessionIssuer
	mfa         MFAService
	oidcClient  OIDCClient
	providers   map[string]config.SSOOIDCProviderConfig
	ordered     []SSOProviderSummary
	stateTTL    time.Duration
	now         func() time.Time
	randomBytes func(int) ([]byte, error)
}

var _ SSOService = (*ssoService)(nil)

// NewSSOService constructs the OIDC SSO service with fail-closed provider indexing.
func NewSSOService(
	repo ssoRepository,
	users userRepository,
	sessions authenticationSessionIssuer,
	mfa MFAService,
	oidcClient OIDCClient,
	cfg *config.Config,
) *ssoService {
	stateTTL := config.DefaultAuthenticationSSOOIDCStateTTL
	providers := make(map[string]config.SSOOIDCProviderConfig)
	ordered := make([]SSOProviderSummary, 0)

	if cfg != nil {
		if cfg.Authentication.SSOOIDCStateTTL > 0 {
			stateTTL = cfg.Authentication.SSOOIDCStateTTL
		}
		for _, p := range cfg.Authentication.SSOOIDCProviders {
			if !p.Enabled {
				continue
			}
			slug := strings.TrimSpace(strings.ToLower(p.Slug))
			if slug == "" {
				continue
			}
			p.Slug = slug
			providers[slug] = p
			ordered = append(ordered, SSOProviderSummary{
				Slug: p.Slug,
				Name: p.Name,
			})
		}
	}

	return &ssoService{
		repo:        repo,
		users:       users,
		sessions:    sessions,
		mfa:         mfa,
		oidcClient:  oidcClient,
		providers:   providers,
		ordered:     ordered,
		stateTTL:    stateTTL,
		now:         time.Now,
		randomBytes: crypto.GenerateKey,
	}
}

func (s *ssoService) ListProviders(_ context.Context) []SSOProviderSummary {
	if s == nil || len(s.ordered) == 0 {
		return []SSOProviderSummary{}
	}
	out := make([]SSOProviderSummary, len(s.ordered))
	copy(out, s.ordered)
	return out
}

func (s *ssoService) StartOIDC(ctx context.Context, req *SSOOIDCStartRequest) (*SSOOIDCStartResponse, error) {
	if s == nil || s.repo == nil || s.oidcClient == nil || s.randomBytes == nil {
		return nil, domain.ErrServiceUnavailable
	}
	provider, ok := s.lookupProvider(req.Provider)
	if !ok {
		return nil, domain.ErrSSOProviderNotFound
	}

	redirectURI, err := resolveAllowedRedirectURI(provider, req.RedirectURI)
	if err != nil {
		return nil, err
	}

	authEndpoint, err := s.oidcClient.ResolveAuthorizationEndpoint(ctx, provider)
	if err != nil {
		return nil, domain.ErrSSOExchangeFailed
	}

	idBytes, err := s.randomBytes(ssoStateIDBytes)
	if err != nil {
		return nil, fmt.Errorf("generate SSO state ID: %w", err)
	}
	stateBytes, err := s.randomBytes(ssoStateTokenBytes)
	if err != nil {
		return nil, fmt.Errorf("generate SSO state: %w", err)
	}
	nonceBytes, err := s.randomBytes(ssoNonceBytes)
	if err != nil {
		return nil, fmt.Errorf("generate SSO nonce: %w", err)
	}
	codeVerifier, codeChallenge, err := generatePKCES256()
	if err != nil {
		return nil, err
	}

	now := s.currentTime()
	state := base64.RawURLEncoding.EncodeToString(stateBytes)
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)

	record := &SSOOIDCStatePO{
		ID:           base64.RawURLEncoding.EncodeToString(idBytes),
		ProviderSlug: provider.Slug,
		StateHash:    crypto.SHA256Hex(state),
		Nonce:        nonce,
		CodeVerifier: codeVerifier,
		RedirectURI:  redirectURI,
		ExpiresAt:    now.Add(s.stateTTL),
		CreatedAt:    now,
	}
	if createErr := s.repo.CreateOIDCState(ctx, record); createErr != nil {
		return nil, createErr
	}

	authorizeURL, err := buildOIDCAuthorizeURL(authEndpoint, provider, redirectURI, state, nonce, codeChallenge)
	if err != nil {
		return nil, domain.ErrSSOExchangeFailed
	}
	return &SSOOIDCStartResponse{
		AuthorizeURL: authorizeURL,
		State:        state,
	}, nil
}

func (s *ssoService) CallbackOIDC(ctx context.Context, req *SSOOIDCCallbackRequest) (*UserLoginResponse, error) {
	if s == nil || s.repo == nil || s.users == nil || s.sessions == nil || s.oidcClient == nil {
		return nil, domain.ErrServiceUnavailable
	}
	provider, ok := s.lookupProvider(req.Provider)
	if !ok {
		return nil, domain.ErrSSOProviderNotFound
	}

	now := s.currentTime()
	stateHash := crypto.SHA256Hex(strings.TrimSpace(req.State))
	consumedState, err := s.repo.ConsumeOIDCState(ctx, provider.Slug, stateHash, now)
	if err != nil {
		return nil, err
	}

	identity, err := s.oidcClient.ExchangeAndVerify(
		ctx,
		provider,
		strings.TrimSpace(req.Code),
		consumedState.CodeVerifier,
		consumedState.Nonce,
		consumedState.RedirectURI,
	)
	if err != nil || identity == nil || strings.TrimSpace(identity.Subject) == "" {
		return nil, domain.ErrSSOExchangeFailed
	}

	u, err := s.resolveOrProvisionUser(ctx, provider.Slug, identity, now)
	if err != nil {
		return nil, err
	}
	if !u.IsActive() {
		return nil, domain.ErrAccountDisabled
	}

	if s.mfa != nil {
		enabled, mfaErr := s.mfa.IsMFAEnabled(ctx, u.ID)
		if mfaErr != nil {
			return nil, mfaErr
		}
		if enabled {
			challengeToken, expiresIn, challengeErr := s.mfa.CreateChallenge(ctx, u.ID, mfaChallengeFlowSession)
			if challengeErr != nil {
				return nil, challengeErr
			}
			return &UserLoginResponse{
				MFARequired:        true,
				ChallengeToken:     challengeToken,
				ChallengeExpiresIn: expiresIn,
				Method:             mfaMethodTOTP,
			}, nil
		}
	}

	issued, err := s.sessions.Issue(ctx, u, domain.SessionAudienceUser)
	if err != nil {
		return nil, err
	}
	if recordErr := s.users.RecordLogin(ctx, u.ID, now); recordErr != nil {
		// Non-fatal: login timestamp update failure must not invalidate a verified session.
		_ = recordErr
	}

	return &UserLoginResponse{
		AccessToken: issued.AccessToken,
		TokenType:   issued.TokenType,
		ExpiresIn:   issued.ExpiresIn,
		User:        u,
	}, nil
}

func (s *ssoService) resolveOrProvisionUser(
	ctx context.Context,
	providerSlug string,
	identity *OIDCVerifiedIdentity,
	now time.Time,
) (*domain.User, error) {
	existingLink, err := s.repo.FindUserIdentity(ctx, providerSlug, identity.Subject)
	if err != nil {
		return nil, err
	}
	if existingLink != nil {
		u, findErr := s.users.FindByID(ctx, existingLink.UserID)
		if findErr != nil {
			if errors.Is(findErr, gorm.ErrRecordNotFound) {
				return nil, domain.ErrSSOExchangeFailed
			}
			return nil, findErr
		}
		return u, nil
	}

	email := strings.TrimSpace(strings.ToLower(identity.Email))
	if email != "" && identity.EmailVerified {
		existingUser, findErr := s.users.FindByEmail(ctx, email)
		if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return nil, findErr
		}
		if existingUser != nil {
			link := &UserIdentityPO{
				UserID:       existingUser.ID,
				ProviderSlug: providerSlug,
				Subject:      identity.Subject,
				Email:        email,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if linkErr := s.repo.CreateUserIdentity(ctx, link); linkErr != nil {
				return nil, linkErr
			}
			return existingUser, nil
		}
	}

	// JIT-provision a new active account with an unguessable random password hash.
	if email == "" {
		return nil, domain.ErrSSOExchangeFailed
	}
	suffixBytes, err := s.randomBytes(8)
	if err != nil {
		return nil, fmt.Errorf("generate SSO username suffix: %w", err)
	}
	randomPasswordBytes, err := s.randomBytes(32)
	if err != nil {
		return nil, fmt.Errorf("generate SSO random password: %w", err)
	}
	hashedPassword, err := bcrypt.GenerateFromPassword(randomPasswordBytes, bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash SSO random password: %w", err)
	}

	nickname := strings.TrimSpace(identity.Name)
	if len(nickname) > 50 {
		nickname = nickname[:50]
	}
	newUser := &domain.User{
		Username: "sso_" + hex.EncodeToString(suffixBytes),
		Email:    email,
		Password: string(hashedPassword),
		Nickname: nickname,
		Status:   1,
	}
	if err := s.users.Create(ctx, newUser); err != nil {
		return nil, err
	}

	link := &UserIdentityPO{
		UserID:       newUser.ID,
		ProviderSlug: providerSlug,
		Subject:      identity.Subject,
		Email:        email,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.CreateUserIdentity(ctx, link); err != nil {
		return nil, err
	}
	return newUser, nil
}

func (s *ssoService) lookupProvider(slug string) (config.SSOOIDCProviderConfig, bool) {
	if s == nil {
		return config.SSOOIDCProviderConfig{}, false
	}
	p, ok := s.providers[strings.TrimSpace(strings.ToLower(slug))]
	return p, ok
}

func resolveAllowedRedirectURI(provider config.SSOOIDCProviderConfig, requested string) (string, error) {
	trimmed := strings.TrimSpace(requested)
	if trimmed == "" {
		return provider.RedirectURI, nil
	}
	if trimmed == provider.RedirectURI || slices.Contains(provider.AllowedRedirectURIs, trimmed) {
		return trimmed, nil
	}
	return "", domain.ErrInvalidInput
}

func buildOIDCAuthorizeURL(
	authEndpoint string,
	provider config.SSOOIDCProviderConfig,
	redirectURI string,
	state string,
	nonce string,
	codeChallenge string,
) (string, error) {
	parsed, err := url.Parse(authEndpoint)
	if err != nil || parsed.Host == "" {
		return "", fmt.Errorf("invalid authorization endpoint")
	}
	scopes := provider.Scopes
	if len(scopes) == 0 {
		scopes = []string{"openid", "email", "profile"}
	}
	q := parsed.Query()
	q.Set("response_type", "code")
	q.Set("client_id", provider.ClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("scope", strings.Join(scopes, " "))
	q.Set("state", state)
	q.Set("nonce", nonce)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	parsed.RawQuery = q.Encode()
	return parsed.String(), nil
}

func (s *ssoService) currentTime() time.Time {
	if s != nil && s.now != nil {
		return s.now()
	}
	return time.Now()
}
