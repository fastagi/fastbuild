package migrations

import (
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/infra/migration"
)

func init() {
	register("2026_11_24_010000_add_mfa_and_sso_tables", &addMFAAndSSOTables{
		BaseMigration: migration.BaseMigration{UseTransaction: true},
	})
}

type addMFAAndSSOTables struct {
	migration.BaseMigration
}

// Up creates PostgreSQL tables for TOTP MFA, recovery codes, login MFA challenges,
// OIDC PKCE states, and linked external SSO identities.
func (m *addMFAAndSSOTables) Up(db *gorm.DB) error {
	return execStatements(db,
		`CREATE TABLE user_mfa_methods (
		    id bigserial PRIMARY KEY,
		    user_id bigint NOT NULL,
		    method varchar(32) NOT NULL,
		    secret_ciphertext text NOT NULL,
		    enabled boolean NOT NULL DEFAULT false,
		    enrolled_at timestamptz,
		    last_used_step bigint NOT NULL DEFAULT 0,
		    created_at timestamptz,
		    updated_at timestamptz
		)`,
		`CREATE UNIQUE INDEX idx_user_mfa_methods_user_method ON user_mfa_methods (user_id, method)`,
		`CREATE INDEX idx_user_mfa_methods_user_enabled ON user_mfa_methods (user_id, enabled)`,

		`CREATE TABLE user_mfa_recovery_codes (
		    id bigserial PRIMARY KEY,
		    user_id bigint NOT NULL,
		    code_hash varchar(64) NOT NULL,
		    used_at timestamptz,
		    created_at timestamptz
		)`,
		`CREATE UNIQUE INDEX idx_user_mfa_recovery_codes_user_hash ON user_mfa_recovery_codes (user_id, code_hash)`,
		`CREATE INDEX idx_user_mfa_recovery_codes_user_used ON user_mfa_recovery_codes (user_id, used_at)`,

		`CREATE TABLE mfa_challenges (
		    id varchar(32) PRIMARY KEY,
		    user_id bigint NOT NULL,
		    token_hash varchar(64) NOT NULL,
		    flow varchar(16) NOT NULL DEFAULT 'session'::varchar,
		    expires_at timestamptz NOT NULL,
		    used_at timestamptz,
		    created_at timestamptz
		)`,
		`CREATE UNIQUE INDEX idx_mfa_challenges_token_hash ON mfa_challenges (token_hash)`,
		`CREATE INDEX idx_mfa_challenges_user_id ON mfa_challenges (user_id)`,
		`CREATE INDEX idx_mfa_challenges_expires_at ON mfa_challenges (expires_at)`,

		`CREATE TABLE sso_oidc_states (
		    id varchar(32) PRIMARY KEY,
		    provider_slug varchar(64) NOT NULL,
		    state_hash varchar(64) NOT NULL,
		    nonce varchar(128) NOT NULL,
		    code_verifier varchar(128) NOT NULL,
		    redirect_uri varchar(512) NOT NULL DEFAULT ''::varchar,
		    expires_at timestamptz NOT NULL,
		    used_at timestamptz,
		    created_at timestamptz
		)`,
		`CREATE UNIQUE INDEX idx_sso_oidc_states_state_hash ON sso_oidc_states (state_hash)`,
		`CREATE INDEX idx_sso_oidc_states_provider_slug ON sso_oidc_states (provider_slug)`,
		`CREATE INDEX idx_sso_oidc_states_expires_at ON sso_oidc_states (expires_at)`,

		`CREATE TABLE user_identities (
		    id bigserial PRIMARY KEY,
		    user_id bigint NOT NULL,
		    provider_slug varchar(64) NOT NULL,
		    subject varchar(255) NOT NULL,
		    email varchar(100) NOT NULL DEFAULT ''::varchar,
		    created_at timestamptz,
		    updated_at timestamptz
		)`,
		`CREATE UNIQUE INDEX idx_user_identities_provider_subject ON user_identities (provider_slug, subject)`,
		`CREATE INDEX idx_user_identities_user_id ON user_identities (user_id)`,
	)
}

// Down drops the MFA and SSO tables in reverse dependency order.
func (m *addMFAAndSSOTables) Down(db *gorm.DB) error {
	return execStatements(db,
		`DROP TABLE IF EXISTS user_identities`,
		`DROP TABLE IF EXISTS sso_oidc_states`,
		`DROP TABLE IF EXISTS mfa_challenges`,
		`DROP TABLE IF EXISTS user_mfa_recovery_codes`,
		`DROP TABLE IF EXISTS user_mfa_methods`,
	)
}
