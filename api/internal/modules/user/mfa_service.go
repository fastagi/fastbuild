package user

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
)

const (
	mfaChallengeFlowSession = "session"
	mfaChallengeFlowNative  = "native"
)

// MFACodeRequest carries a 6-digit TOTP code or one-time recovery code.
type MFACodeRequest struct {
	Code string `json:"code" binding:"required,min=6,max=32"`
}

// MFAChallengeVerifyRequest completes a pending MFA login challenge.
type MFAChallengeVerifyRequest struct {
	ChallengeToken string `json:"challenge_token" binding:"required,max=128"`
	Code           string `json:"code" binding:"required,min=6,max=32"`
}

// MFAStatusResponse describes the authenticated user's MFA enrollment state.
type MFAStatusResponse struct {
	Enabled                bool       `json:"enabled"`
	Method                 string     `json:"method"`
	RemainingRecoveryCodes int64      `json:"remaining_recovery_codes"`
	EnrolledAt             *time.Time `json:"enrolled_at,omitempty"`
}

// MFATOTPEnrollResponse returns the one-time pending TOTP provisioning payload.
type MFATOTPEnrollResponse struct {
	Secret      string `json:"secret"`
	OTPAuthURI  string `json:"otpauth_uri"`
	Issuer      string `json:"issuer"`
	AccountName string `json:"account_name"`
}

// MFATOTPVerifyResponse returns activation status and one-time plaintext recovery codes.
type MFATOTPVerifyResponse struct {
	Enabled       bool     `json:"enabled"`
	RecoveryCodes []string `json:"recovery_codes"`
}

// MFADisableResponse confirms MFA has been disabled.
type MFADisableResponse struct {
	Enabled bool `json:"enabled"`
}

// MFAService defines multi-factor authentication enrollment, management, and challenge verification.
type MFAService interface {
	Status(ctx context.Context, userID uint) (*MFAStatusResponse, error)
	EnrollTOTP(ctx context.Context, userID uint) (*MFATOTPEnrollResponse, error)
	VerifyTOTPEnrollment(ctx context.Context, userID uint, code string) (*MFATOTPVerifyResponse, error)
	DisableTOTP(ctx context.Context, userID uint, code string) (*MFADisableResponse, error)
	IsMFAEnabled(ctx context.Context, userID uint) (bool, error)
	CreateChallenge(ctx context.Context, userID uint, flow string) (token string, expiresIn int64, err error)
	VerifyChallenge(ctx context.Context, req *MFAChallengeVerifyRequest) (any, uint, error)
}

type mfaService struct {
	repo           mfaRepository
	users          userRepository
	sessions       authenticationSessionIssuer
	nativeSessions nativeSessionAuthority
	encryptionKey  string
	issuer         string
	challengeTTL   time.Duration
	now            func() time.Time
	randomBytes    func(int) ([]byte, error)
}

var _ MFAService = (*mfaService)(nil)

// NewMFAService constructs the TOTP + recovery code MFA service.
func NewMFAService(
	repo mfaRepository,
	users userRepository,
	sessions authenticationSessionIssuer,
	cfg *config.Config,
) *mfaService {
	var encryptionKey, issuer string
	challengeTTL := config.DefaultAuthenticationMFAChallengeTTL
	if cfg != nil {
		encryptionKey = cfg.Authentication.MFAEncryptionKey
		issuer = cfg.Authentication.MFAIssuer
		if cfg.Authentication.MFAChallengeTTL > 0 {
			challengeTTL = cfg.Authentication.MFAChallengeTTL
		}
		if issuer == "" {
			issuer = cfg.App.Name
		}
	}
	if issuer == "" {
		issuer = "FastBuild"
	}

	svc := &mfaService{
		repo:          repo,
		users:         users,
		sessions:      sessions,
		encryptionKey: encryptionKey,
		issuer:        issuer,
		challengeTTL:  challengeTTL,
		now:           time.Now,
		randomBytes:   crypto.GenerateKey,
	}
	if native, ok := sessions.(nativeSessionAuthority); ok {
		svc.nativeSessions = native
	}
	return svc
}

func (s *mfaService) Status(ctx context.Context, userID uint) (*MFAStatusResponse, error) {
	if s == nil || s.repo == nil {
		return nil, domain.ErrServiceUnavailable
	}
	method, err := s.repo.GetMFAMethod(ctx, userID, mfaMethodTOTP)
	if err != nil {
		return nil, err
	}
	if method == nil || !method.Enabled {
		return &MFAStatusResponse{
			Enabled:                false,
			Method:                 "",
			RemainingRecoveryCodes: 0,
		}, nil
	}
	remaining, err := s.repo.CountUnusedRecoveryCodes(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &MFAStatusResponse{
		Enabled:                true,
		Method:                 method.Method,
		RemainingRecoveryCodes: remaining,
		EnrolledAt:             method.EnrolledAt,
	}, nil
}

func (s *mfaService) EnrollTOTP(ctx context.Context, userID uint) (*MFATOTPEnrollResponse, error) {
	if s == nil || s.repo == nil || s.users == nil || strings.TrimSpace(s.encryptionKey) == "" {
		return nil, domain.ErrServiceUnavailable
	}
	existing, err := s.repo.GetMFAMethod(ctx, userID, mfaMethodTOTP)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Enabled {
		return nil, domain.ErrMFAAlreadyEnabled
	}

	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}

	secret, err := generateTOTPSecret()
	if err != nil {
		return nil, err
	}
	ciphertext, err := encryptMFASecret(s.encryptionKey, secret)
	if err != nil {
		return nil, domain.ErrServiceUnavailable
	}

	now := s.currentTime()
	record := &UserMFAMethodPO{
		UserID:           userID,
		Method:           mfaMethodTOTP,
		SecretCiphertext: ciphertext,
		Enabled:          false,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.UpsertPendingMFAMethod(ctx, record); err != nil {
		return nil, err
	}

	accountName := u.Email
	if accountName == "" {
		accountName = u.Username
	}
	return &MFATOTPEnrollResponse{
		Secret:      secret,
		OTPAuthURI:  buildOTPAuthURI(s.issuer, accountName, secret),
		Issuer:      s.issuer,
		AccountName: accountName,
	}, nil
}

func (s *mfaService) VerifyTOTPEnrollment(ctx context.Context, userID uint, code string) (*MFATOTPVerifyResponse, error) {
	if s == nil || s.repo == nil || strings.TrimSpace(s.encryptionKey) == "" {
		return nil, domain.ErrServiceUnavailable
	}
	method, err := s.repo.GetMFAMethod(ctx, userID, mfaMethodTOTP)
	if err != nil {
		return nil, err
	}
	if method == nil {
		return nil, domain.ErrMFANotEnabled
	}
	if method.Enabled {
		return nil, domain.ErrMFAAlreadyEnabled
	}

	secret, err := decryptMFASecret(s.encryptionKey, method.SecretCiphertext)
	if err != nil {
		return nil, domain.ErrServiceUnavailable
	}
	now := s.currentTime()
	matchedStep, ok := verifyTOTPCode(secret, code, now, method.LastUsedStep)
	if !ok {
		return nil, domain.ErrMFAInvalidCode
	}

	recoveryCodes, err := generateRecoveryCodes(mfaRecoveryCodeCount)
	if err != nil {
		return nil, err
	}
	hashes := make([]string, 0, len(recoveryCodes))
	for _, rc := range recoveryCodes {
		hashes = append(hashes, hashRecoveryCode(rc))
	}

	if err := s.repo.ActivateMFAMethodAndReplaceRecoveryCodes(ctx, userID, mfaMethodTOTP, now, matchedStep, hashes); err != nil {
		return nil, err
	}
	return &MFATOTPVerifyResponse{
		Enabled:       true,
		RecoveryCodes: recoveryCodes,
	}, nil
}

func (s *mfaService) DisableTOTP(ctx context.Context, userID uint, code string) (*MFADisableResponse, error) {
	if s == nil || s.repo == nil || strings.TrimSpace(s.encryptionKey) == "" {
		return nil, domain.ErrServiceUnavailable
	}
	method, err := s.repo.GetMFAMethod(ctx, userID, mfaMethodTOTP)
	if err != nil {
		return nil, err
	}
	if method == nil || !method.Enabled {
		return nil, domain.ErrMFANotEnabled
	}

	if err := s.verifySecondFactor(ctx, method, code); err != nil {
		return nil, err
	}
	if err := s.repo.DisableMFA(ctx, userID); err != nil {
		return nil, err
	}
	return &MFADisableResponse{Enabled: false}, nil
}

func (s *mfaService) IsMFAEnabled(ctx context.Context, userID uint) (bool, error) {
	if s == nil || s.repo == nil || userID == 0 {
		return false, nil
	}
	method, err := s.repo.GetMFAMethod(ctx, userID, mfaMethodTOTP)
	if err != nil {
		// If the MFA store is unavailable, fail closed rather than silently bypassing MFA.
		return false, err
	}
	return method != nil && method.Enabled, nil
}

func (s *mfaService) CreateChallenge(ctx context.Context, userID uint, flow string) (string, int64, error) {
	if s == nil || s.repo == nil || s.randomBytes == nil {
		return "", 0, domain.ErrServiceUnavailable
	}
	if flow != mfaChallengeFlowNative {
		flow = mfaChallengeFlowSession
	}
	idBytes, err := s.randomBytes(mfaChallengeIDBytes)
	if err != nil {
		return "", 0, fmt.Errorf("generate MFA challenge ID: %w", err)
	}
	tokenBytes, err := s.randomBytes(mfaChallengeTokenBytes)
	if err != nil {
		return "", 0, fmt.Errorf("generate MFA challenge token: %w", err)
	}

	now := s.currentTime()
	expiresAt := now.Add(s.challengeTTL)
	token := base64.RawURLEncoding.EncodeToString(tokenBytes)
	record := &MFAChallengePO{
		ID:        base64.RawURLEncoding.EncodeToString(idBytes),
		UserID:    userID,
		TokenHash: crypto.SHA256Hex(token),
		Flow:      flow,
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}
	if err := s.repo.CreateMFAChallenge(ctx, record); err != nil {
		return "", 0, err
	}
	return token, max(int64(1), int64(expiresAt.Sub(now)/time.Second)), nil
}

func (s *mfaService) VerifyChallenge(ctx context.Context, req *MFAChallengeVerifyRequest) (any, uint, error) {
	if s == nil || s.repo == nil || s.users == nil || s.sessions == nil || strings.TrimSpace(s.encryptionKey) == "" {
		return nil, 0, domain.ErrServiceUnavailable
	}
	if req == nil || strings.TrimSpace(req.ChallengeToken) == "" {
		return nil, 0, domain.ErrMFAChallengeInvalid
	}

	tokenHash := crypto.SHA256Hex(strings.TrimSpace(req.ChallengeToken))
	challenge, err := s.repo.GetMFAChallengeByHash(ctx, tokenHash)
	if err != nil {
		return nil, 0, err
	}
	now := s.currentTime()
	if challenge == nil || challenge.UsedAt != nil || !challenge.ExpiresAt.After(now) {
		return nil, 0, domain.ErrMFAChallengeInvalid
	}

	u, err := s.users.FindByID(ctx, challenge.UserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, domain.ErrMFAChallengeInvalid
		}
		return nil, 0, err
	}
	if !u.IsActive() {
		return nil, 0, domain.ErrAccountDisabled
	}

	method, err := s.repo.GetMFAMethod(ctx, u.ID, mfaMethodTOTP)
	if err != nil {
		return nil, 0, err
	}
	if method == nil || !method.Enabled {
		return nil, 0, domain.ErrMFAChallengeInvalid
	}

	if verifyErr := s.verifySecondFactor(ctx, method, req.Code); verifyErr != nil {
		return nil, 0, verifyErr
	}

	consumed, err := s.repo.ConsumeMFAChallenge(ctx, challenge.ID, now)
	if err != nil {
		return nil, 0, err
	}
	if !consumed {
		return nil, 0, domain.ErrMFAChallengeInvalid
	}

	if recordErr := s.users.RecordLogin(ctx, u.ID, now); recordErr != nil {
		// Non-fatal: login timestamp update failure must not invalidate a verified session.
		_ = recordErr
	}

	if challenge.Flow == mfaChallengeFlowNative {
		if s.nativeSessions == nil {
			return nil, 0, domain.ErrServiceUnavailable
		}
		issued, nativeErr := s.nativeSessions.IssueNative(ctx, u)
		if nativeErr != nil {
			return nil, 0, nativeErr
		}
		return &NativeSessionResponse{
			AccessToken:      issued.AccessToken,
			TokenType:        issued.TokenType,
			ExpiresIn:        issued.ExpiresIn,
			RefreshToken:     issued.RefreshToken,
			RefreshExpiresIn: issued.RefreshExpiresIn,
			User:             u,
		}, u.ID, nil
	}

	issued, err := s.sessions.Issue(ctx, u, domain.SessionAudienceUser)
	if err != nil {
		return nil, 0, err
	}
	return &UserLoginResponse{
		AccessToken: issued.AccessToken,
		TokenType:   issued.TokenType,
		ExpiresIn:   issued.ExpiresIn,
		User:        u,
	}, u.ID, nil
}

func (s *mfaService) verifySecondFactor(ctx context.Context, method *UserMFAMethodPO, code string) error {
	secret, err := decryptMFASecret(s.encryptionKey, method.SecretCiphertext)
	if err != nil {
		return domain.ErrServiceUnavailable
	}
	now := s.currentTime()
	if matchedStep, ok := verifyTOTPCode(secret, code, now, method.LastUsedStep); ok {
		updated, stepErr := s.repo.UpdateLastUsedStep(ctx, method.UserID, method.Method, matchedStep)
		if stepErr != nil {
			return stepErr
		}
		if !updated {
			return domain.ErrMFAInvalidCode
		}
		return nil
	}

	// Fallback: attempt atomic single-use recovery code consumption.
	consumed, err := s.repo.ConsumeRecoveryCode(ctx, method.UserID, hashRecoveryCode(code), now)
	if err != nil {
		return err
	}
	if !consumed {
		return domain.ErrMFAInvalidCode
	}
	return nil
}

func (s *mfaService) currentTime() time.Time {
	if s != nil && s.now != nil {
		return s.now()
	}
	return time.Now()
}
