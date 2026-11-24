package user

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

// UserMFAMethodPO stores a user's pending or active MFA factor with its encrypted secret.
type UserMFAMethodPO struct {
	ID               uint `gorm:"primaryKey"`
	UserID           uint `gorm:"not null;uniqueIndex:idx_user_mfa_methods_user_method"`
	Method           string
	SecretCiphertext string
	Enabled          bool
	EnrolledAt       *time.Time
	LastUsedStep     int64
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// TableName specifies the MFA method table name.
func (UserMFAMethodPO) TableName() string {
	return "user_mfa_methods"
}

// UserMFARecoveryCodePO stores a single-use recovery code strictly as its SHA-256 hex hash.
type UserMFARecoveryCodePO struct {
	ID        uint `gorm:"primaryKey"`
	UserID    uint `gorm:"not null"`
	CodeHash  string
	UsedAt    *time.Time
	CreatedAt time.Time
}

// TableName specifies the MFA recovery code table name.
func (UserMFARecoveryCodePO) TableName() string {
	return "user_mfa_recovery_codes"
}

// MFAChallengePO stores a short-lived, single-use login MFA challenge by token SHA-256 hash.
type MFAChallengePO struct {
	ID        string `gorm:"size:32;primaryKey"`
	UserID    uint   `gorm:"not null"`
	TokenHash string
	Flow      string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

// TableName specifies the MFA challenge table name.
func (MFAChallengePO) TableName() string {
	return "mfa_challenges"
}

type mfaRepository interface {
	GetMFAMethod(ctx context.Context, userID uint, method string) (*UserMFAMethodPO, error)
	UpsertPendingMFAMethod(ctx context.Context, record *UserMFAMethodPO) error
	ActivateMFAMethodAndReplaceRecoveryCodes(ctx context.Context, userID uint, method string, enrolledAt time.Time, lastUsedStep int64, codeHashes []string) error
	UpdateLastUsedStep(ctx context.Context, userID uint, method string, step int64) (bool, error)
	CountUnusedRecoveryCodes(ctx context.Context, userID uint) (int64, error)
	ConsumeRecoveryCode(ctx context.Context, userID uint, codeHash string, usedAt time.Time) (bool, error)
	DisableMFA(ctx context.Context, userID uint) error
	CreateMFAChallenge(ctx context.Context, challenge *MFAChallengePO) error
	GetMFAChallengeByHash(ctx context.Context, tokenHash string) (*MFAChallengePO, error)
	ConsumeMFAChallenge(ctx context.Context, id string, usedAt time.Time) (bool, error)
}

type mfaRepo struct {
	db *gorm.DB
}

// NewMFARepository creates the GORM-backed MFA repository.
func NewMFARepository(db *gorm.DB) *mfaRepo {
	return &mfaRepo{db: db}
}

func (r *mfaRepo) requireDB() (*gorm.DB, error) {
	if r == nil || r.db == nil {
		return nil, domain.ErrServiceUnavailable
	}
	return r.db, nil
}

func (r *mfaRepo) GetMFAMethod(ctx context.Context, userID uint, method string) (*UserMFAMethodPO, error) {
	db, err := r.requireDB()
	if err != nil {
		return nil, err
	}
	var po UserMFAMethodPO
	err = db.WithContext(ctx).
		Where("user_id = ? AND method = ?", userID, method).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &po, nil
}

func (r *mfaRepo) UpsertPendingMFAMethod(ctx context.Context, record *UserMFAMethodPO) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}, {Name: "method"}},
			DoUpdates: clause.Assignments(map[string]any{
				"secret_ciphertext": record.SecretCiphertext,
				"enabled":           false,
				"enrolled_at":       nil,
				"last_used_step":    0,
				"updated_at":        record.UpdatedAt,
			}),
		}).
		Create(record).Error
}

func (r *mfaRepo) ActivateMFAMethodAndReplaceRecoveryCodes(
	ctx context.Context,
	userID uint,
	method string,
	enrolledAt time.Time,
	lastUsedStep int64,
	codeHashes []string,
) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&UserMFAMethodPO{}).
			Where("user_id = ? AND method = ?", userID, method).
			Updates(map[string]any{
				"enabled":        true,
				"enrolled_at":    enrolledAt,
				"last_used_step": lastUsedStep,
				"updated_at":     enrolledAt,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return domain.ErrMFANotEnabled
		}
		if err := tx.Where("user_id = ?", userID).Delete(&UserMFARecoveryCodePO{}).Error; err != nil {
			return err
		}
		if len(codeHashes) > 0 {
			rows := make([]UserMFARecoveryCodePO, 0, len(codeHashes))
			for _, h := range codeHashes {
				rows = append(rows, UserMFARecoveryCodePO{
					UserID:    userID,
					CodeHash:  h,
					CreatedAt: enrolledAt,
				})
			}
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *mfaRepo) UpdateLastUsedStep(ctx context.Context, userID uint, method string, step int64) (bool, error) {
	db, err := r.requireDB()
	if err != nil {
		return false, err
	}
	res := db.WithContext(ctx).
		Model(&UserMFAMethodPO{}).
		Where("user_id = ? AND method = ? AND enabled = ? AND last_used_step < ?", userID, method, true, step).
		Update("last_used_step", step)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

func (r *mfaRepo) CountUnusedRecoveryCodes(ctx context.Context, userID uint) (int64, error) {
	db, err := r.requireDB()
	if err != nil {
		return 0, err
	}
	var count int64
	err = db.WithContext(ctx).
		Model(&UserMFARecoveryCodePO{}).
		Where("user_id = ? AND used_at IS NULL", userID).
		Count(&count).Error
	return count, err
}

func (r *mfaRepo) ConsumeRecoveryCode(ctx context.Context, userID uint, codeHash string, usedAt time.Time) (bool, error) {
	db, err := r.requireDB()
	if err != nil {
		return false, err
	}
	res := db.WithContext(ctx).
		Model(&UserMFARecoveryCodePO{}).
		Where("user_id = ? AND code_hash = ? AND used_at IS NULL", userID, codeHash).
		Update("used_at", usedAt)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

func (r *mfaRepo) DisableMFA(ctx context.Context, userID uint) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&UserMFARecoveryCodePO{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&UserMFAMethodPO{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userID).Delete(&MFAChallengePO{}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *mfaRepo) CreateMFAChallenge(ctx context.Context, challenge *MFAChallengePO) error {
	db, err := r.requireDB()
	if err != nil {
		return err
	}
	return db.WithContext(ctx).Create(challenge).Error
}

func (r *mfaRepo) GetMFAChallengeByHash(ctx context.Context, tokenHash string) (*MFAChallengePO, error) {
	db, err := r.requireDB()
	if err != nil {
		return nil, err
	}
	var po MFAChallengePO
	err = db.WithContext(ctx).
		Where("token_hash = ?", tokenHash).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &po, nil
}

func (r *mfaRepo) ConsumeMFAChallenge(ctx context.Context, id string, usedAt time.Time) (bool, error) {
	db, err := r.requireDB()
	if err != nil {
		return false, err
	}
	res := db.WithContext(ctx).
		Model(&MFAChallengePO{}).
		Where("id = ? AND used_at IS NULL AND expires_at > ?", id, usedAt).
		Update("used_at", usedAt)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}
