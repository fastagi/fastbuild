package user

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec // RFC 6238 TOTP specifies HMAC-SHA1 for authenticator compatibility.
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/fastagi/fastbuild/api/internal/capabilities/crypto"
)

const (
	mfaMethodTOTP          = "totp"
	totpSecretBytes        = 20 // 160-bit secret per RFC 6238 / RFC 4226
	totpPeriodSeconds      = 30
	totpDigits             = 6
	totpWindowSkew         = 1 // ±1 step (30s) tolerance
	mfaRecoveryCodeCount   = 8
	mfaRecoveryCodeBytes   = 5 // 40 bits per code (10 hex chars formatted as XXXXX-XXXXX)
	mfaChallengeIDBytes    = 16
	mfaChallengeTokenBytes = 32
)

var base32NoPad = base32.StdEncoding.WithPadding(base32.NoPadding)

// generateTOTPSecret generates a 160-bit cryptographically random secret encoded as unpadded base32.
func generateTOTPSecret() (string, error) {
	raw := make([]byte, totpSecretBytes)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", fmt.Errorf("generate TOTP secret: %w", err)
	}
	return base32NoPad.EncodeToString(raw), nil
}

// buildOTPAuthURI formats a standard otpauth://totp provisioning URI.
func buildOTPAuthURI(issuer, accountName, secret string) string {
	cleanIssuer := strings.TrimSpace(issuer)
	if cleanIssuer == "" {
		cleanIssuer = "FastBuild"
	}
	cleanAccount := strings.TrimSpace(accountName)
	label := url.PathEscape(cleanIssuer + ":" + cleanAccount)
	params := url.Values{}
	params.Set("secret", secret)
	params.Set("issuer", cleanIssuer)
	params.Set("algorithm", "SHA1")
	params.Set("digits", "6")
	params.Set("period", "30")
	return fmt.Sprintf("otpauth://totp/%s?%s", label, params.Encode())
}

// totpCodeAt computes the 6-digit RFC 6238 TOTP code for a base32 secret at a given timestamp.
func totpCodeAt(secret string, at time.Time) (string, error) {
	secretBytes, err := decodeTOTPSecret(secret)
	if err != nil {
		return "", err
	}
	step := at.Unix() / totpPeriodSeconds
	if step < 0 {
		step = 0
	}
	return hotpCode(secretBytes, uint64(step)), nil
}

// verifyTOTPCode validates a 6-digit TOTP code within ±1 30-second window using constant-time
// comparison and rejects replays from any step <= lastUsedStep.
func verifyTOTPCode(secret, code string, now time.Time, lastUsedStep int64) (int64, bool) {
	normalized := strings.TrimSpace(code)
	if len(normalized) != totpDigits {
		return 0, false
	}
	for i := 0; i < len(normalized); i++ {
		if normalized[i] < '0' || normalized[i] > '9' {
			return 0, false
		}
	}

	secretBytes, err := decodeTOTPSecret(secret)
	if err != nil {
		return 0, false
	}

	currentStep := now.Unix() / totpPeriodSeconds
	var matchedStep int64
	matched := false
	for delta := int64(-totpWindowSkew); delta <= int64(totpWindowSkew); delta++ {
		step := currentStep + delta
		if step < 0 {
			continue
		}
		candidate := hotpCode(secretBytes, uint64(step))
		if subtle.ConstantTimeCompare([]byte(candidate), []byte(normalized)) == 1 {
			matchedStep = step
			matched = true
		}
	}
	if !matched || matchedStep <= lastUsedStep {
		return 0, false
	}
	return matchedStep, true
}

func decodeTOTPSecret(secret string) ([]byte, error) {
	cleaned := strings.ToUpper(strings.TrimSpace(secret))
	cleaned = strings.TrimRight(cleaned, "=")
	if cleaned == "" {
		return nil, fmt.Errorf("empty TOTP secret")
	}
	return base32NoPad.DecodeString(cleaned)
}

// hotpCode implements RFC 4226 dynamic truncation with HMAC-SHA1 and 6 digits.
func hotpCode(secret []byte, counter uint64) string {
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], counter)

	mac := hmac.New(sha1.New, secret) //nolint:gosec // RFC 4226/6238 HMAC-SHA1.
	mac.Write(buf[:])
	sum := mac.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	truncated := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])

	return fmt.Sprintf("%06d", truncated%1_000_000)
}

// generateRecoveryCodes creates cryptographically random human-readable one-time recovery codes.
func generateRecoveryCodes(count int) ([]string, error) {
	codes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		raw := make([]byte, mfaRecoveryCodeBytes)
		if _, err := io.ReadFull(rand.Reader, raw); err != nil {
			return nil, fmt.Errorf("generate recovery code: %w", err)
		}
		encoded := strings.ToUpper(hex.EncodeToString(raw))
		codes = append(codes, encoded[:5]+"-"+encoded[5:])
	}
	return codes, nil
}

// hashRecoveryCode normalizes user input (case-insensitive, ignoring hyphens/spaces) and returns SHA-256 hex.
func hashRecoveryCode(code string) string {
	normalized := strings.ToUpper(strings.TrimSpace(code))
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, " ", "")
	return crypto.SHA256Hex(normalized)
}

func encryptMFASecret(key, secret string) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", fmt.Errorf("MFA encryption key is not configured")
	}
	return crypto.NewAESEncryptorFromString(key).EncryptString(secret)
}

func decryptMFASecret(key, ciphertext string) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", fmt.Errorf("MFA encryption key is not configured")
	}
	return crypto.NewAESEncryptorFromString(key).DecryptString(ciphertext)
}
