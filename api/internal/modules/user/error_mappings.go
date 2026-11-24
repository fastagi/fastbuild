package user

import (
	"net/http"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

// RegisterErrorMappings maps this starter's domain errors to public status codes and error codes.
func (h *Handler) RegisterErrorMappings(mapper *response.ErrorMapper) {
	mapper.Register(domain.ErrAuthenticationRequired, http.StatusUnauthorized, response.ErrorCodeUnauthorized)
	mapper.Register(domain.ErrUserNotFound, http.StatusNotFound, domain.CodeUserNotFound)
	mapper.Register(domain.ErrInvalidCredentials, http.StatusUnauthorized, domain.CodeInvalidCredentials)
	mapper.Register(domain.ErrPasswordResetTokenInvalid, http.StatusUnauthorized, domain.CodePasswordResetTokenInvalid)
	mapper.Register(domain.ErrPasswordResetTokenExpired, http.StatusUnauthorized, domain.CodePasswordResetTokenExpired)
	mapper.Register(domain.ErrSignInThrottled, http.StatusTooManyRequests, domain.CodeRateLimited)
	mapper.Register(domain.ErrAccountDisabled, http.StatusForbidden, domain.CodeAccountDisabled)
	mapper.Register(domain.ErrEmailAlreadyExists, http.StatusConflict, domain.CodeEmailAlreadyExists)
	mapper.Register(domain.ErrUsernameAlreadyExists, http.StatusConflict, domain.CodeUsernameAlreadyExists)
	mapper.Register(domain.ErrMFAInvalidCode, http.StatusUnauthorized, domain.CodeMFAInvalidCode)
	mapper.Register(domain.ErrMFAChallengeInvalid, http.StatusUnauthorized, domain.CodeMFAChallengeInvalid)
	mapper.Register(domain.ErrMFAAlreadyEnabled, http.StatusConflict, domain.CodeMFAAlreadyEnabled)
	mapper.Register(domain.ErrMFANotEnabled, http.StatusConflict, domain.CodeMFANotEnabled)
	mapper.Register(domain.ErrSSOProviderNotFound, http.StatusNotFound, domain.CodeSSOProviderNotFound)
	mapper.Register(domain.ErrSSOStateInvalid, http.StatusUnauthorized, domain.CodeSSOStateInvalid)
	mapper.Register(domain.ErrSSOExchangeFailed, http.StatusUnauthorized, domain.CodeSSOExchangeFailed)
}
