package migrations

import (
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/infra/migration"
)

func init() {
	register("2026_11_24_000000_add_native_refresh_to_authentication_sessions", &addNativeRefreshToAuthenticationSessions{
		BaseMigration: migration.BaseMigration{UseTransaction: true},
	})
}

type addNativeRefreshToAuthenticationSessions struct {
	migration.BaseMigration
}

// Up adds hash-only rotating refresh token metadata to authentication_sessions for native clients.
func (m *addNativeRefreshToAuthenticationSessions) Up(db *gorm.DB) error {
	return execStatements(db,
		`ALTER TABLE authentication_sessions ADD COLUMN family_id varchar(32) DEFAULT ''::varchar NOT NULL`,
		`ALTER TABLE authentication_sessions ADD COLUMN refresh_token_hash varchar(64)`,
		`ALTER TABLE authentication_sessions ADD COLUMN refresh_expires_at timestamptz`,
		`CREATE INDEX idx_authentication_sessions_family_id ON authentication_sessions (family_id)`,
		`CREATE UNIQUE INDEX idx_authentication_sessions_refresh_token_hash ON authentication_sessions (refresh_token_hash)`,
		`CREATE INDEX idx_authentication_sessions_refresh_expires_at ON authentication_sessions (refresh_expires_at)`,
	)
}

// Down removes native refresh token metadata from authentication_sessions.
func (m *addNativeRefreshToAuthenticationSessions) Down(db *gorm.DB) error {
	return execStatements(db,
		`DROP INDEX IF EXISTS idx_authentication_sessions_refresh_expires_at`,
		`DROP INDEX IF EXISTS idx_authentication_sessions_refresh_token_hash`,
		`DROP INDEX IF EXISTS idx_authentication_sessions_family_id`,
		`ALTER TABLE authentication_sessions DROP COLUMN IF EXISTS refresh_expires_at`,
		`ALTER TABLE authentication_sessions DROP COLUMN IF EXISTS refresh_token_hash`,
		`ALTER TABLE authentication_sessions DROP COLUMN IF EXISTS family_id`,
	)
}
