package user

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

type authenticationSessionRow struct {
	SessionID        string     `gorm:"column:session_id"`
	UserID           uint       `gorm:"column:user_id"`
	Audience         string     `gorm:"column:audience"`
	Username         string     `gorm:"column:username"`
	UserStatus       int        `gorm:"column:user_status"`
	UserDeletedAt    *time.Time `gorm:"column:user_deleted_at"`
	ExpiresAt        time.Time  `gorm:"column:expires_at"`
	IdleExpiresAt    time.Time  `gorm:"column:idle_expires_at"`
	RefreshExpiresAt *time.Time `gorm:"column:refresh_expires_at"`
	LastSeenAt       time.Time  `gorm:"column:last_seen_at"`
	RevokedAt        *time.Time `gorm:"column:revoked_at"`
}

func (r *repository) createAuthenticationSession(ctx context.Context, session *AuthenticationSessionPO) error {
	db, err := r.withContext(ctx)
	if err != nil {
		return err
	}
	if session == nil {
		return domain.ErrInvalidInput
	}
	if err := db.Create(session).Error; err != nil {
		return authenticationPersistenceError("create", err)
	}
	return nil
}

func (r *repository) authenticateSession(
	ctx context.Context,
	tokenHash string,
	now time.Time,
	touchInterval time.Duration,
	idleTimeout time.Duration,
) (*domain.AuthenticationIdentity, error) {
	db, err := r.withContext(ctx)
	if err != nil {
		return nil, err
	}

	var row authenticationSessionRow
	err = db.Table("authentication_sessions AS sessions").
		Select([]string{
			"sessions.id AS session_id",
			"sessions.user_id",
			"sessions.audience",
			"sessions.expires_at",
			"sessions.idle_expires_at",
			"sessions.refresh_expires_at",
			"sessions.last_seen_at",
			"sessions.revoked_at",
			"users.username",
			"users.status AS user_status",
			"users.deleted_at AS user_deleted_at",
		}).
		Joins("LEFT JOIN users ON users.id = sessions.user_id").
		Where("sessions.token_hash = ?", tokenHash).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domain.ErrAuthenticationRequired
	}
	if err != nil {
		return nil, authenticationPersistenceError("resolve", err)
	}

	if row.RevokedAt != nil {
		return nil, domain.ErrAuthenticationRequired
	}
	if row.UserID == 0 || row.UserDeletedAt != nil || row.Username == "" {
		if revokeErr := r.revokeAuthenticationSessionByID(ctx, row.SessionID, now, sessionRevocationAccountDeleted); revokeErr != nil {
			return nil, revokeErr
		}
		return nil, domain.ErrAuthenticationRequired
	}
	if row.UserStatus != 1 {
		if revokeErr := r.revokeUserAuthenticationSessions(ctx, row.UserID, now, sessionRevocationAccountDisabled); revokeErr != nil {
			return nil, revokeErr
		}
		return nil, domain.ErrAccountDisabled
	}
	hasActiveRefresh := row.RefreshExpiresAt != nil && now.Before(*row.RefreshExpiresAt)
	if !now.Before(row.ExpiresAt) {
		if !hasActiveRefresh {
			if revokeErr := r.revokeAuthenticationSessionByID(ctx, row.SessionID, now, sessionRevocationExpired); revokeErr != nil {
				return nil, revokeErr
			}
		}
		return nil, domain.ErrAuthenticationRequired
	}
	if !now.Before(row.IdleExpiresAt) {
		if !hasActiveRefresh {
			if revokeErr := r.revokeAuthenticationSessionByID(ctx, row.SessionID, now, sessionRevocationIdleTimeout); revokeErr != nil {
				return nil, revokeErr
			}
		}
		return nil, domain.ErrAuthenticationRequired
	}

	if !now.Before(row.LastSeenAt.Add(touchInterval)) {
		nextIdleExpiry := minTime(now.Add(idleTimeout), row.ExpiresAt)
		result := db.Model(&AuthenticationSessionPO{}).
			Where("id = ? AND revoked_at IS NULL AND last_seen_at <= ?", row.SessionID, now.Add(-touchInterval)).
			Updates(map[string]any{
				"last_seen_at":    now,
				"idle_expires_at": nextIdleExpiry,
				"updated_at":      now,
			})
		if result.Error != nil {
			return nil, authenticationPersistenceError("touch", result.Error)
		}
	}

	return &domain.AuthenticationIdentity{
		UserID:    row.UserID,
		Username:  row.Username,
		SessionID: row.SessionID,
		Audience:  domain.SessionAudience(row.Audience),
	}, nil
}

func (r *repository) revokeAuthenticationSessionByTokenHash(
	ctx context.Context,
	tokenHash string,
	now time.Time,
	reason string,
) error {
	db, err := r.withContext(ctx)
	if err != nil {
		return err
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("token_hash = ? AND revoked_at IS NULL", tokenHash).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke credential", result.Error)
	}
	return nil
}

func (r *repository) revokeAuthenticationSessionByID(
	ctx context.Context,
	sessionID string,
	now time.Time,
	reason string,
) error {
	db, err := r.withContext(ctx)
	if err != nil {
		return err
	}
	var session AuthenticationSessionPO
	err = db.Select("id", "family_id").Where("id = ?", sessionID).Take(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return authenticationPersistenceError("lookup", err)
	}
	if session.FamilyID != "" {
		return revokeSessionFamilyDB(db, session.FamilyID, now, reason)
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("id = ? AND revoked_at IS NULL", sessionID).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke", result.Error)
	}
	return nil
}

func (r *repository) revokeAuthenticationSessionFamilyByRefreshTokenHash(
	ctx context.Context,
	refreshTokenHash string,
	now time.Time,
	reason string,
) error {
	db, err := r.withContext(ctx)
	if err != nil {
		return err
	}
	var session AuthenticationSessionPO
	err = db.Select("id", "family_id").Where("refresh_token_hash = ?", refreshTokenHash).Take(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return authenticationPersistenceError("lookup refresh credential", err)
	}
	if session.FamilyID != "" {
		return revokeSessionFamilyDB(db, session.FamilyID, now, reason)
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("id = ? AND revoked_at IS NULL", session.ID).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke refresh credential", result.Error)
	}
	return nil
}

func (r *repository) rotateNativeSession(
	ctx context.Context,
	refreshTokenHash string,
	nextSessionID string,
	nextTokenHash string,
	nextRefreshTokenHash string,
	now time.Time,
	accessTTL time.Duration,
) (*domain.User, time.Time, time.Time, error) {
	db, err := r.withContext(ctx)
	if err != nil {
		return nil, time.Time{}, time.Time{}, err
	}

	var (
		resolvedUser     *domain.User
		accessExpiresAt  time.Time
		refreshExpiresAt time.Time
		domainErr        error
	)

	txErr := db.Transaction(func(tx *gorm.DB) error {
		var current AuthenticationSessionPO
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("refresh_token_hash = ?", refreshTokenHash).
			Take(&current).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			domainErr = domain.ErrAuthenticationRequired
			return nil
		}
		if err != nil {
			return authenticationPersistenceError("resolve refresh", err)
		}

		if current.RevokedAt != nil {
			// Replay detection: presenting an already-rotated refresh token revokes the entire family.
			if current.RevocationReason == sessionRevocationRotated && current.FamilyID != "" {
				if revokeErr := revokeSessionFamilyDB(tx, current.FamilyID, now, sessionRevocationRefreshReuse); revokeErr != nil {
					return revokeErr
				}
			}
			domainErr = domain.ErrAuthenticationRequired
			return nil
		}

		var userPO UserPO
		err = tx.Unscoped().First(&userPO, current.UserID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) || userPO.DeletedAt.Valid || userPO.Username == "" {
			if revokeErr := revokeSessionOrFamilyDB(tx, current.ID, current.FamilyID, now, sessionRevocationAccountDeleted); revokeErr != nil {
				return revokeErr
			}
			domainErr = domain.ErrAuthenticationRequired
			return nil
		}
		if err != nil {
			return authenticationPersistenceError("resolve refresh user", err)
		}

		if userPO.Status != 1 {
			if revokeErr := revokeUserSessionsDB(tx, current.UserID, now, sessionRevocationAccountDisabled); revokeErr != nil {
				return revokeErr
			}
			domainErr = domain.ErrAccountDisabled
			return nil
		}

		if current.RefreshExpiresAt == nil || !now.Before(*current.RefreshExpiresAt) {
			if revokeErr := revokeSessionOrFamilyDB(tx, current.ID, current.FamilyID, now, sessionRevocationExpired); revokeErr != nil {
				return revokeErr
			}
			domainErr = domain.ErrAuthenticationRequired
			return nil
		}

		result := tx.Model(&AuthenticationSessionPO{}).
			Where("id = ? AND revoked_at IS NULL", current.ID).
			Updates(sessionRevocationUpdates(now, sessionRevocationRotated))
		if result.Error != nil {
			return authenticationPersistenceError("rotate revoke", result.Error)
		}
		if result.RowsAffected != 1 {
			domainErr = domain.ErrAuthenticationRequired
			return nil
		}

		refreshExpiry := *current.RefreshExpiresAt
		nextAccessExpiry := minTime(now.Add(accessTTL), refreshExpiry)
		nextHash := nextRefreshTokenHash
		successor := &AuthenticationSessionPO{
			ID:               nextSessionID,
			UserID:           current.UserID,
			Audience:         current.Audience,
			FamilyID:         current.FamilyID,
			TokenHash:        nextTokenHash,
			RefreshTokenHash: &nextHash,
			ExpiresAt:        nextAccessExpiry,
			IdleExpiresAt:    nextAccessExpiry,
			RefreshExpiresAt: &refreshExpiry,
			LastSeenAt:       now,
		}
		if err := tx.Create(successor).Error; err != nil {
			return authenticationPersistenceError("rotate create", err)
		}

		resolvedUser = userPO.toDomain()
		accessExpiresAt = nextAccessExpiry
		refreshExpiresAt = refreshExpiry
		return nil
	})
	if txErr != nil {
		return nil, time.Time{}, time.Time{}, txErr
	}
	if domainErr != nil {
		return nil, time.Time{}, time.Time{}, domainErr
	}
	return resolvedUser, accessExpiresAt, refreshExpiresAt, nil
}

func revokeSessionFamilyDB(db *gorm.DB, familyID string, now time.Time, reason string) error {
	if familyID == "" {
		return nil
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("family_id = ? AND revoked_at IS NULL", familyID).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke session family", result.Error)
	}
	return nil
}

func revokeSessionOrFamilyDB(db *gorm.DB, sessionID, familyID string, now time.Time, reason string) error {
	if familyID != "" {
		return revokeSessionFamilyDB(db, familyID, now, reason)
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("id = ? AND revoked_at IS NULL", sessionID).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke", result.Error)
	}
	return nil
}

func (r *repository) revokeUserAuthenticationSessions(
	ctx context.Context,
	userID uint,
	now time.Time,
	reason string,
) error {
	db, err := r.withContext(ctx)
	if err != nil {
		return err
	}
	return revokeUserSessionsDB(db, userID, now, reason)
}

func (r *repository) pruneAuthenticationSessions(ctx context.Context, cutoff time.Time, batch int) (int64, error) {
	db, err := r.withContext(ctx)
	if err != nil {
		return 0, err
	}

	var ids []string
	err = db.Model(&AuthenticationSessionPO{}).
		Where(
			"(revoked_at IS NOT NULL AND revoked_at <= ?) OR (refresh_expires_at IS NULL AND (expires_at <= ? OR idle_expires_at <= ?)) OR (refresh_expires_at IS NOT NULL AND refresh_expires_at <= ?)",
			cutoff,
			cutoff,
			cutoff,
			cutoff,
		).
		Order("updated_at ASC").
		Limit(batch).
		Pluck("id", &ids).Error
	if err != nil {
		return 0, authenticationPersistenceError("select prune batch", err)
	}
	if len(ids) == 0 {
		return 0, nil
	}

	result := db.Where("id IN ?", ids).Delete(&AuthenticationSessionPO{})
	if result.Error != nil {
		return 0, authenticationPersistenceError("prune", result.Error)
	}
	return result.RowsAffected, nil
}

func revokeUserSessionsDB(db *gorm.DB, userID uint, now time.Time, reason string) error {
	if userID == 0 {
		return domain.ErrInvalidInput
	}
	result := db.Model(&AuthenticationSessionPO{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Updates(sessionRevocationUpdates(now, reason))
	if result.Error != nil {
		return authenticationPersistenceError("revoke user sessions", result.Error)
	}
	return nil
}

func sessionRevocationUpdates(now time.Time, reason string) map[string]any {
	return map[string]any{
		"revoked_at":        now,
		"revocation_reason": normalizeSessionRevocationReason(reason),
		"updated_at":        now,
	}
}

func authenticationPersistenceError(operation string, err error) error {
	return fmt.Errorf("%w: authentication session %s: %v", domain.ErrServiceUnavailable, operation, err)
}
