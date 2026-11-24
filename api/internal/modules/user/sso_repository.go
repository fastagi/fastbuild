package user

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

// SSOOIDCStatePO stores one short-lived single-use OIDC PKCE state/nonce record.
type SSOOIDCStatePO struct {
	ID           string `gorm:"size:32;primaryKey"`
	ProviderSlug string
	StateHash    string
	Nonce        string
	CodeVerifier string
	RedirectURI  string
	ExpiresAt    time.Time
	UsedAt       *time.Time
	CreatedAt    time.Time
}

// TableName specifies the OIDC state table name.
func (SSOOIDCStatePO) TableName() string {
	return "sso_oidc_states"
}

// UserIdentityPO links an external OIDC provider subject to a local user account.
type UserIdentityPO struct {
	ID           uint `gorm:"primaryKey"`
	UserID       uint
	ProviderSlug string
	Subject      string
	Email        string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TableName specifies the linked identity table name.
func (UserIdentityPO) TableName() string {
	return "user_identities"
}

type ssoRepository interface {
	CreateOIDCState(ctx context.Context, record *SSOOIDCStatePO) error
	ConsumeOIDCState(ctx context.Context, providerSlug, stateHash string, now time.Time) (*SSOOIDCStatePO, error)
	FindUserIdentity(ctx context.Context, providerSlug, subject string) (*UserIdentityPO, error)
	CreateUserIdentity(ctx context.Context, record *UserIdentityPO) error
}

type ssoRepo struct {
	db *gorm.DB
}

// NewSSORepository creates the GORM-backed SSO repository.
func NewSSORepository(db *gorm.DB) *ssoRepo {
	return &ssoRepo{db: db}
}

func (r *ssoRepo) requireDB() (*gorm.DB, error) {
	if r == nil || r.db == nil {
		return nil, domain.ErrServiceUnavailable
	}
	return r.db, nil
}

func (r *ssoRepo) CreateOIDCState(ctx context.Context, record *SSOOIDCStatePO) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).Create(record).Error
}

// ConsumeOIDCState atomically marks a matching unused, unexpired OIDC state as consumed and returns it.
func (r *ssoRepo) ConsumeOIDCState(ctx context.Context, providerSlug, stateHash string, now time.Time) (*SSOOIDCStatePO, error) {
	db, err := r.requireDB()
	if err != nil {
		return nil, err
	}
	var consumed SSOOIDCStatePO
	err = db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&SSOOIDCStatePO{}).
			Where("provider_slug = ? AND state_hash = ? AND used_at IS NULL AND expires_at > ?", providerSlug, stateHash, now).
			Update("used_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return domain.ErrSSOStateInvalid
		}
		return tx.Where("provider_slug = ? AND state_hash = ?", providerSlug, stateHash).First(&consumed).Error
	})
	if err != nil {
		return nil, err
	}
	return &consumed, nil
}

func (r *ssoRepo) FindUserIdentity(ctx context.Context, providerSlug, subject string) (*UserIdentityPO, error) {
	db, err := r.requireDB()
	if err != nil {
		return nil, err
	}
	var po UserIdentityPO
	err = db.WithContext(ctx).
		Where("provider_slug = ? AND subject = ?", providerSlug, subject).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &po, nil
}

func (r *ssoRepo) CreateUserIdentity(ctx context.Context, record *UserIdentityPO) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).Create(record).Error
}
