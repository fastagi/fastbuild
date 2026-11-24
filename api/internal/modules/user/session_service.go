package user

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
)

const (
	authenticationSessionIDBytes    = 16
	authenticationCredentialBytes   = 32
	maxAuthenticationCredentialSize = 128
	defaultSessionPruneBatch        = 500
)

const (
	sessionRevocationLogout          = "logout"
	sessionRevocationPasswordChange  = "password_change"
	sessionRevocationPasswordReset   = "password_reset"
	sessionRevocationAccountDeleted  = "account_deleted"
	sessionRevocationAccountDisabled = "account_disabled"
	sessionRevocationExpired         = "expired"
	sessionRevocationIdleTimeout     = "idle_timeout"
	sessionRevocationOperator        = "operator"
	sessionRevocationRotated         = "rotated"
	sessionRevocationRefreshReuse    = "refresh_reuse"
)

// IssuedAuthenticationSession is the one-time plaintext session response.
type IssuedAuthenticationSession struct {
	AccessToken string
	TokenType   string
	ExpiresIn   int64
}

// IssuedNativeSession is the one-time plaintext token pair for native clients.
type IssuedNativeSession struct {
	AccessToken      string
	TokenType        string
	ExpiresIn        int64
	RefreshToken     string
	RefreshExpiresIn int64
}

// SessionService owns opaque user session issuance, resolution, revocation, and retention.
type SessionService struct {
	repo        *repository
	policy      config.AuthenticationConfig
	now         func() time.Time
	randomBytes func(int) ([]byte, error)
}

var (
	_ domain.SessionAuthenticator            = (*SessionService)(nil)
	_ domain.AuthenticationSessionMaintainer = (*SessionService)(nil)
)

// NewSessionService creates the default user starter's persistent session authority.
func NewSessionService(repo *repository, cfg *config.Config) *SessionService {
	policy := config.AuthenticationConfig{}
	if cfg != nil {
		policy = cfg.Authentication
	}
	policy = normalizedAuthenticationPolicy(policy)
	return &SessionService{
		repo:        repo,
		policy:      policy,
		now:         time.Now,
		randomBytes: crypto.GenerateKey,
	}
}

// Issue creates one hash-only persistent session and returns its plaintext credential once.
func (s *SessionService) Issue(
	ctx context.Context,
	user *domain.User,
	audience domain.SessionAudience,
) (*IssuedAuthenticationSession, error) {
	if user == nil || user.ID == 0 {
		return nil, domain.ErrAuthenticationRequired
	}
	if audience != domain.SessionAudienceUser && audience != domain.SessionAudienceOperator {
		return nil, fmt.Errorf("unknown session audience %q", audience)
	}
	if !user.IsActive() {
		return nil, domain.ErrAccountDisabled
	}
	if s == nil || s.repo == nil || s.randomBytes == nil {
		return nil, domain.ErrServiceUnavailable
	}

	sessionIDBytes, err := s.randomBytes(authenticationSessionIDBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication session ID: %w", err)
	}
	credentialBytes, err := s.randomBytes(authenticationCredentialBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication session credential: %w", err)
	}

	now := s.currentTime()
	expiresAt := now.Add(s.policy.SessionTTL)
	idleExpiresAt := minTime(now.Add(s.policy.SessionIdleTimeout), expiresAt)
	credential := base64.RawURLEncoding.EncodeToString(credentialBytes)
	record := &AuthenticationSessionPO{
		ID:            base64.RawURLEncoding.EncodeToString(sessionIDBytes),
		UserID:        user.ID,
		Audience:      string(audience),
		TokenHash:     crypto.SHA256Hex(credential),
		ExpiresAt:     expiresAt,
		IdleExpiresAt: idleExpiresAt,
		LastSeenAt:    now,
	}
	if err := s.repo.createAuthenticationSession(ctx, record); err != nil {
		return nil, err
	}

	return &IssuedAuthenticationSession{
		AccessToken: credential,
		TokenType:   "Bearer",
		ExpiresIn:   max(int64(1), int64(expiresAt.Sub(now)/time.Second)),
	}, nil
}

// IssueNative creates one short-lived access session paired with a single-use rotating refresh token.
func (s *SessionService) IssueNative(
	ctx context.Context,
	user *domain.User,
) (*IssuedNativeSession, error) {
	if user == nil || user.ID == 0 {
		return nil, domain.ErrAuthenticationRequired
	}
	if !user.IsActive() {
		return nil, domain.ErrAccountDisabled
	}
	if s == nil || s.repo == nil || s.randomBytes == nil {
		return nil, domain.ErrServiceUnavailable
	}

	sessionIDBytes, err := s.randomBytes(authenticationSessionIDBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication session ID: %w", err)
	}
	familyIDBytes, err := s.randomBytes(authenticationSessionIDBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication family ID: %w", err)
	}
	accessBytes, err := s.randomBytes(authenticationCredentialBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication access credential: %w", err)
	}
	refreshBytes, err := s.randomBytes(authenticationCredentialBytes)
	if err != nil {
		return nil, fmt.Errorf("generate authentication refresh credential: %w", err)
	}

	now := s.currentTime()
	refreshExpiresAt := now.Add(s.policy.SessionTTL)
	accessExpiresAt := minTime(now.Add(s.policy.NativeAccessTTL), refreshExpiresAt)
	accessToken := base64.RawURLEncoding.EncodeToString(accessBytes)
	refreshToken := base64.RawURLEncoding.EncodeToString(refreshBytes)
	refreshHash := crypto.SHA256Hex(refreshToken)

	record := &AuthenticationSessionPO{
		ID:               base64.RawURLEncoding.EncodeToString(sessionIDBytes),
		UserID:           user.ID,
		Audience:         string(domain.SessionAudienceUser),
		FamilyID:         base64.RawURLEncoding.EncodeToString(familyIDBytes),
		TokenHash:        crypto.SHA256Hex(accessToken),
		RefreshTokenHash: &refreshHash,
		ExpiresAt:        accessExpiresAt,
		IdleExpiresAt:    accessExpiresAt,
		RefreshExpiresAt: &refreshExpiresAt,
		LastSeenAt:       now,
	}
	if err := s.repo.createAuthenticationSession(ctx, record); err != nil {
		return nil, err
	}

	return &IssuedNativeSession{
		AccessToken:      accessToken,
		TokenType:        "Bearer",
		ExpiresIn:        max(int64(1), int64(accessExpiresAt.Sub(now)/time.Second)),
		RefreshToken:     refreshToken,
		RefreshExpiresIn: max(int64(1), int64(refreshExpiresAt.Sub(now)/time.Second)),
	}, nil
}

// RotateNative validates a single-use refresh token, revokes it atomically, and issues a successor pair.
// Presenting an already-rotated refresh token revokes the entire session family.
func (s *SessionService) RotateNative(
	ctx context.Context,
	refreshToken string,
) (*IssuedNativeSession, *domain.User, error) {
	if s == nil || s.repo == nil || s.randomBytes == nil {
		return nil, nil, domain.ErrServiceUnavailable
	}
	refreshToken = strings.TrimSpace(refreshToken)
	if !validAuthenticationCredential(refreshToken) {
		return nil, nil, domain.ErrAuthenticationRequired
	}

	sessionIDBytes, err := s.randomBytes(authenticationSessionIDBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("generate authentication session ID: %w", err)
	}
	accessBytes, err := s.randomBytes(authenticationCredentialBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("generate authentication access credential: %w", err)
	}
	nextRefreshBytes, err := s.randomBytes(authenticationCredentialBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("generate authentication refresh credential: %w", err)
	}

	now := s.currentTime()
	nextAccessToken := base64.RawURLEncoding.EncodeToString(accessBytes)
	nextRefreshToken := base64.RawURLEncoding.EncodeToString(nextRefreshBytes)

	user, accessExpiresAt, refreshExpiresAt, err := s.repo.rotateNativeSession(
		ctx,
		crypto.SHA256Hex(refreshToken),
		base64.RawURLEncoding.EncodeToString(sessionIDBytes),
		crypto.SHA256Hex(nextAccessToken),
		crypto.SHA256Hex(nextRefreshToken),
		now,
		s.policy.NativeAccessTTL,
	)
	if err != nil {
		return nil, nil, err
	}

	return &IssuedNativeSession{
		AccessToken:      nextAccessToken,
		TokenType:        "Bearer",
		ExpiresIn:        max(int64(1), int64(accessExpiresAt.Sub(now)/time.Second)),
		RefreshToken:     nextRefreshToken,
		RefreshExpiresIn: max(int64(1), int64(refreshExpiresAt.Sub(now)/time.Second)),
	}, user, nil
}

// RevokeNativeRefresh revokes a native refresh token and its entire session family idempotently.
func (s *SessionService) RevokeNativeRefresh(ctx context.Context, refreshToken, reason string) error {
	if s == nil || s.repo == nil {
		return domain.ErrServiceUnavailable
	}
	refreshToken = strings.TrimSpace(refreshToken)
	if !validAuthenticationCredential(refreshToken) {
		return nil
	}
	return s.repo.revokeAuthenticationSessionFamilyByRefreshTokenHash(
		ctx,
		crypto.SHA256Hex(refreshToken),
		s.currentTime(),
		normalizeSessionRevocationReason(reason),
	)
}

// Authenticate resolves one opaque bearer credential against current session and user state.
func (s *SessionService) Authenticate(ctx context.Context, credential string) (*domain.AuthenticationIdentity, error) {
	if s == nil || s.repo == nil {
		return nil, domain.ErrServiceUnavailable
	}
	credential = strings.TrimSpace(credential)
	if !validAuthenticationCredential(credential) {
		return nil, domain.ErrAuthenticationRequired
	}
	return s.repo.authenticateSession(
		ctx,
		crypto.SHA256Hex(credential),
		s.currentTime(),
		s.policy.SessionTouchInterval,
		s.policy.SessionIdleTimeout,
	)
}

// Revoke invalidates a credential without revealing whether it existed.
func (s *SessionService) Revoke(ctx context.Context, credential, reason string) error {
	if s == nil || s.repo == nil {
		return domain.ErrServiceUnavailable
	}
	credential = strings.TrimSpace(credential)
	if !validAuthenticationCredential(credential) {
		return nil
	}
	return s.repo.revokeAuthenticationSessionByTokenHash(
		ctx,
		crypto.SHA256Hex(credential),
		s.currentTime(),
		normalizeSessionRevocationReason(reason),
	)
}

// RevokeSession ends one session as a user-initiated logout.
func (s *SessionService) RevokeSession(ctx context.Context, credential string) error {
	return s.Revoke(ctx, credential, sessionRevocationLogout)
}

// RevokeByID invalidates the already-authenticated current session.
func (s *SessionService) RevokeByID(ctx context.Context, sessionID, reason string) error {
	if s == nil || s.repo == nil {
		return domain.ErrServiceUnavailable
	}
	if strings.TrimSpace(sessionID) == "" {
		return domain.ErrAuthenticationRequired
	}
	return s.repo.revokeAuthenticationSessionByID(
		ctx,
		strings.TrimSpace(sessionID),
		s.currentTime(),
		normalizeSessionRevocationReason(reason),
	)
}

// RevokeUser invalidates every active session for one user.
func (s *SessionService) RevokeUser(ctx context.Context, userID uint, reason string) error {
	if s == nil || s.repo == nil {
		return domain.ErrServiceUnavailable
	}
	return s.repo.revokeUserAuthenticationSessions(
		ctx,
		userID,
		s.currentTime(),
		normalizeSessionRevocationReason(reason),
	)
}

// PruneAuthenticationSessions removes terminal rows older than the configured retention window.
func (s *SessionService) PruneAuthenticationSessions(ctx context.Context, batch int) (int64, error) {
	if s == nil || s.repo == nil {
		return 0, domain.ErrServiceUnavailable
	}
	if batch <= 0 || batch > 10_000 {
		batch = defaultSessionPruneBatch
	}
	return s.repo.pruneAuthenticationSessions(
		ctx,
		s.currentTime().Add(-s.policy.SessionRetention),
		batch,
	)
}

func (s *SessionService) currentTime() time.Time {
	if s != nil && s.now != nil {
		return s.now().UTC()
	}
	return time.Now().UTC()
}

func validAuthenticationCredential(value string) bool {
	if value == "" || len(value) > maxAuthenticationCredentialSize {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return err == nil && len(decoded) == authenticationCredentialBytes
}

func normalizeSessionRevocationReason(value string) string {
	switch strings.TrimSpace(value) {
	case sessionRevocationLogout,
		sessionRevocationPasswordChange,
		sessionRevocationPasswordReset,
		sessionRevocationAccountDeleted,
		sessionRevocationAccountDisabled,
		sessionRevocationExpired,
		sessionRevocationIdleTimeout,
		sessionRevocationOperator,
		sessionRevocationRotated,
		sessionRevocationRefreshReuse:
		return strings.TrimSpace(value)
	default:
		return "security_event"
	}
}

func normalizedAuthenticationPolicy(policy config.AuthenticationConfig) config.AuthenticationConfig {
	if policy.SessionTTL < 15*time.Minute || policy.SessionTTL > 180*24*time.Hour {
		policy.SessionTTL = config.DefaultAuthenticationSessionTTL
	}
	if policy.SessionIdleTimeout < 5*time.Minute || policy.SessionIdleTimeout > policy.SessionTTL {
		policy.SessionIdleTimeout = min(config.DefaultAuthenticationSessionIdleTimeout, policy.SessionTTL)
	}
	if policy.SessionTouchInterval <= 0 ||
		policy.SessionTouchInterval > time.Hour ||
		policy.SessionTouchInterval > policy.SessionIdleTimeout {
		policy.SessionTouchInterval = min(config.DefaultAuthenticationSessionTouchInterval, policy.SessionIdleTimeout)
	}
	if policy.SessionRetention < 0 || policy.SessionRetention > 365*24*time.Hour {
		policy.SessionRetention = config.DefaultAuthenticationSessionRetention
	}
	if policy.NativeAccessTTL < time.Minute ||
		policy.NativeAccessTTL > 24*time.Hour ||
		policy.NativeAccessTTL > policy.SessionTTL {
		policy.NativeAccessTTL = min(config.DefaultAuthenticationNativeAccessTTL, policy.SessionTTL)
	}
	return policy
}

func minTime(left, right time.Time) time.Time {
	if left.Before(right) {
		return left
	}
	return right
}
