package user

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/pkg/tracedhttp"
)

const (
	oidcMaxResponseBytes = 1 << 20 // 1 MiB cap for discovery, token, and JWKS responses
	oidcClockSkew        = 60 * time.Second
	pkceVerifierBytes    = 32
	ssoStateIDBytes      = 16
	ssoStateTokenBytes   = 32
	ssoNonceBytes        = 32
)

// OIDCVerifiedIdentity is the verified identity extracted from an OIDC ID token.
type OIDCVerifiedIdentity struct {
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

// OIDCClient defines the external OIDC token exchange and ID token verification seam.
// Keeping this behind an interface allows deterministic unit tests without live network calls.
type OIDCClient interface {
	ResolveAuthorizationEndpoint(ctx context.Context, provider config.SSOOIDCProviderConfig) (string, error)
	ExchangeAndVerify(
		ctx context.Context,
		provider config.SSOOIDCProviderConfig,
		code string,
		codeVerifier string,
		expectedNonce string,
		redirectURI string,
	) (*OIDCVerifiedIdentity, error)
}

type httpOIDCClient struct {
	httpClient *http.Client
	now        func() time.Time
}

// NewOIDCClient creates a bounded, traced HTTP OIDC client using Go standard library cryptography.
func NewOIDCClient(cfg *config.Config) OIDCClient {
	timeout := config.DefaultAuthenticationSSOOIDCTimeout
	if cfg != nil && cfg.Authentication.SSOOIDCTimeout > 0 {
		timeout = cfg.Authentication.SSOOIDCTimeout
	}
	return &httpOIDCClient{
		httpClient: &http.Client{
			Timeout:   timeout,
			Transport: tracedhttp.NewTransport(nil, "oidc"),
		},
		now: time.Now,
	}
}

type oidcDiscoveryDocument struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
}

type oidcTokenResponse struct {
	IDToken string `json:"id_token"`
}

type oidcJWKS struct {
	Keys []oidcJWK `json:"keys"`
}

type oidcJWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type oidcJWTHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
}

type oidcIDTokenClaims struct {
	Issuer        string          `json:"iss"`
	Subject       string          `json:"sub"`
	Audience      json.RawMessage `json:"aud"`
	ExpiresAt     int64           `json:"exp"`
	IssuedAt      int64           `json:"iat"`
	NotBefore     int64           `json:"nbf"`
	Nonce         string          `json:"nonce"`
	Email         string          `json:"email"`
	EmailVerified bool            `json:"email_verified"`
	Name          string          `json:"name"`
}

func (c *httpOIDCClient) ResolveAuthorizationEndpoint(ctx context.Context, provider config.SSOOIDCProviderConfig) (string, error) {
	if provider.AuthorizationEndpoint != "" {
		return provider.AuthorizationEndpoint, nil
	}
	doc, err := c.fetchDiscovery(ctx, provider.Issuer)
	if err != nil {
		return "", err
	}
	if doc.AuthorizationEndpoint == "" {
		return "", fmt.Errorf("OIDC discovery missing authorization_endpoint")
	}
	return doc.AuthorizationEndpoint, nil
}

func (c *httpOIDCClient) ExchangeAndVerify(
	ctx context.Context,
	provider config.SSOOIDCProviderConfig,
	code string,
	codeVerifier string,
	expectedNonce string,
	redirectURI string,
) (*OIDCVerifiedIdentity, error) {
	tokenEndpoint := provider.TokenEndpoint
	jwksURI := provider.JWKSURI
	if tokenEndpoint == "" || jwksURI == "" {
		doc, err := c.fetchDiscovery(ctx, provider.Issuer)
		if err != nil {
			return nil, err
		}
		if tokenEndpoint == "" {
			tokenEndpoint = doc.TokenEndpoint
		}
		if jwksURI == "" {
			jwksURI = doc.JWKSURI
		}
	}
	if tokenEndpoint == "" || jwksURI == "" {
		return nil, fmt.Errorf("OIDC provider missing token_endpoint or jwks_uri")
	}

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", provider.ClientID)
	form.Set("code_verifier", codeVerifier)
	if provider.ClientSecret != "" {
		form.Set("client_secret", provider.ClientSecret)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build token exchange request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OIDC token exchange failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, oidcMaxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("read OIDC token response: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("OIDC token endpoint returned status %d", resp.StatusCode)
	}

	var tokenResp oidcTokenResponse
	if unmarshalErr := json.Unmarshal(body, &tokenResp); unmarshalErr != nil || strings.TrimSpace(tokenResp.IDToken) == "" {
		return nil, fmt.Errorf("OIDC token response missing id_token")
	}

	jwks, err := c.fetchJWKS(ctx, jwksURI)
	if err != nil {
		return nil, err
	}

	return verifyOIDCIDToken(tokenResp.IDToken, provider.Issuer, provider.ClientID, expectedNonce, jwks, c.currentTime())
}

func (c *httpOIDCClient) fetchDiscovery(ctx context.Context, issuer string) (*oidcDiscoveryDocument, error) {
	endpoint := strings.TrimRight(issuer, "/") + "/.well-known/openid-configuration"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build OIDC discovery request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch OIDC discovery: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OIDC discovery returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, oidcMaxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("read OIDC discovery: %w", err)
	}
	var doc oidcDiscoveryDocument
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("parse OIDC discovery: %w", err)
	}
	return &doc, nil
}

func (c *httpOIDCClient) fetchJWKS(ctx context.Context, jwksURI string) (*oidcJWKS, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURI, nil)
	if err != nil {
		return nil, fmt.Errorf("build JWKS request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch JWKS: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, oidcMaxResponseBytes))
	if err != nil {
		return nil, fmt.Errorf("read JWKS: %w", err)
	}
	var jwks oidcJWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, fmt.Errorf("parse JWKS: %w", err)
	}
	return &jwks, nil
}

func (c *httpOIDCClient) currentTime() time.Time {
	if c != nil && c.now != nil {
		return c.now()
	}
	return time.Now()
}

// verifyOIDCIDToken verifies the JWT signature against JWKS (RS256/ES256) and validates
// standard OIDC claims (iss, aud, exp, nbf, nonce, sub).
func verifyOIDCIDToken(
	rawToken string,
	expectedIssuer string,
	expectedClientID string,
	expectedNonce string,
	jwks *oidcJWKS,
	now time.Time,
) (*OIDCVerifiedIdentity, error) {
	parts := strings.Split(rawToken, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed ID token")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("decode ID token header: %w", err)
	}
	var header oidcJWTHeader
	if unmarshalErr := json.Unmarshal(headerBytes, &header); unmarshalErr != nil {
		return nil, fmt.Errorf("parse ID token header: %w", unmarshalErr)
	}
	if header.Alg != "RS256" && header.Alg != "ES256" {
		return nil, fmt.Errorf("unsupported ID token algorithm %q", header.Alg)
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode ID token payload: %w", err)
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode ID token signature: %w", err)
	}

	signingInput := []byte(parts[0] + "." + parts[1])
	if err := verifyJWTSignature(header, signingInput, signature, jwks); err != nil {
		return nil, err
	}

	var claims oidcIDTokenClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("parse ID token claims: %w", err)
	}

	if strings.TrimRight(claims.Issuer, "/") != strings.TrimRight(expectedIssuer, "/") {
		return nil, fmt.Errorf("ID token issuer mismatch")
	}
	if !audienceContains(claims.Audience, expectedClientID) {
		return nil, fmt.Errorf("ID token audience mismatch")
	}
	nowUnix := now.Unix()
	if claims.ExpiresAt == 0 || nowUnix > claims.ExpiresAt+int64(oidcClockSkew/time.Second) {
		return nil, fmt.Errorf("ID token expired")
	}
	if claims.NotBefore != 0 && nowUnix+int64(oidcClockSkew/time.Second) < claims.NotBefore {
		return nil, fmt.Errorf("ID token not yet valid")
	}
	if expectedNonce == "" || subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(expectedNonce)) != 1 {
		return nil, fmt.Errorf("ID token nonce mismatch")
	}
	if strings.TrimSpace(claims.Subject) == "" {
		return nil, fmt.Errorf("ID token missing subject")
	}

	return &OIDCVerifiedIdentity{
		Subject:       strings.TrimSpace(claims.Subject),
		Email:         strings.TrimSpace(strings.ToLower(claims.Email)),
		EmailVerified: claims.EmailVerified,
		Name:          strings.TrimSpace(claims.Name),
	}, nil
}

func verifyJWTSignature(header oidcJWTHeader, signingInput, signature []byte, jwks *oidcJWKS) error {
	if jwks == nil || len(jwks.Keys) == 0 {
		return fmt.Errorf("JWKS contains no keys")
	}
	digest := sha256.Sum256(signingInput)
	for _, key := range jwks.Keys {
		if key.Use != "" && key.Use != "sig" {
			continue
		}
		if header.Kid != "" && key.Kid != "" && key.Kid != header.Kid {
			continue
		}
		switch header.Alg {
		case "RS256":
			if key.Kty != "RSA" {
				continue
			}
			pub, err := parseRSAJWK(key)
			if err != nil {
				continue
			}
			if rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], signature) == nil {
				return nil
			}
		case "ES256":
			if key.Kty != "EC" || (key.Crv != "" && key.Crv != "P-256") {
				continue
			}
			pub, err := parseECJWK(key)
			if err != nil || len(signature) != 64 {
				continue
			}
			r := new(big.Int).SetBytes(signature[:32])
			s := new(big.Int).SetBytes(signature[32:])
			if ecdsa.Verify(pub, digest[:], r, s) {
				return nil
			}
		}
	}
	return fmt.Errorf("ID token signature verification failed")
}

func parseRSAJWK(key oidcJWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil || len(nBytes) == 0 {
		return nil, fmt.Errorf("invalid RSA modulus")
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil || len(eBytes) == 0 {
		return nil, fmt.Errorf("invalid RSA exponent")
	}
	e := new(big.Int).SetBytes(eBytes)
	if !e.IsInt64() || e.Int64() < 3 {
		return nil, fmt.Errorf("invalid RSA exponent value")
	}
	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: int(e.Int64()),
	}, nil
}

func parseECJWK(key oidcJWK) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
	if err != nil || len(xBytes) == 0 || len(xBytes) > 32 {
		return nil, fmt.Errorf("invalid EC x coordinate")
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
	if err != nil || len(yBytes) == 0 || len(yBytes) > 32 {
		return nil, fmt.Errorf("invalid EC y coordinate")
	}
	uncompressed := make([]byte, 65)
	uncompressed[0] = 0x04
	copy(uncompressed[1+32-len(xBytes):33], xBytes)
	copy(uncompressed[33+32-len(yBytes):65], yBytes)
	return ecdsa.ParseUncompressedPublicKey(elliptic.P256(), uncompressed)
}

func audienceContains(raw json.RawMessage, expected string) bool {
	if len(raw) == 0 || expected == "" {
		return false
	}
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return single == expected
	}
	var list []string
	if err := json.Unmarshal(raw, &list); err == nil {
		for _, item := range list {
			if item == expected {
				return true
			}
		}
	}
	return false
}

// generatePKCES256 produces a high-entropy PKCE verifier and its S256 challenge.
func generatePKCES256() (verifier string, challenge string, err error) {
	raw := make([]byte, pkceVerifierBytes)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", "", fmt.Errorf("generate PKCE verifier: %w", err)
	}
	verifier = base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return verifier, challenge, nil
}
