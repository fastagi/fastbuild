package user

import (
	"github.com/gin-gonic/gin"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/pkg/handler"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

// GetMFAStatus returns the authenticated user's MFA enrollment status.
func (h *Handler) GetMFAStatus(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}
	if h.mfa == nil {
		response.HandleError(c, "MFA service unavailable", domain.ErrServiceUnavailable)
		return
	}
	status, err := h.mfa.Status(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, "Failed to get MFA status", err)
		return
	}
	response.Success(c, status)
}

// EnrollMFATOTP starts RFC 6238 TOTP enrollment for the authenticated user.
func (h *Handler) EnrollMFATOTP(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}
	if h.mfa == nil {
		response.HandleError(c, "MFA service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, err := h.mfa.EnrollTOTP(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, "Failed to enroll MFA", err)
		return
	}
	response.Success(c, resp)
}

// VerifyMFATOTP verifies the initial TOTP code, activates MFA, and returns one-time recovery codes.
func (h *Handler) VerifyMFATOTP(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}
	var req MFACodeRequest
	if !handler.BindJSON(c, &req) {
		return
	}
	if h.mfa == nil {
		response.HandleError(c, "MFA service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, err := h.mfa.VerifyTOTPEnrollment(c.Request.Context(), userID, req.Code)
	if err != nil {
		response.HandleError(c, "Failed to verify MFA enrollment", err)
		return
	}
	response.Success(c, resp)
}

// DisableMFATOTP verifies a TOTP or recovery code and disables MFA for the authenticated user.
func (h *Handler) DisableMFATOTP(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}
	var req MFACodeRequest
	if !handler.BindJSON(c, &req) {
		return
	}
	if h.mfa == nil {
		response.HandleError(c, "MFA service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, err := h.mfa.DisableTOTP(c.Request.Context(), userID, req.Code)
	if err != nil {
		response.HandleError(c, "Failed to disable MFA", err)
		return
	}
	response.Success(c, resp)
}

// VerifyMFAChallenge completes a pending login MFA challenge and issues a session or native token pair.
func (h *Handler) VerifyMFAChallenge(c *gin.Context) {
	var req MFAChallengeVerifyRequest
	if !handler.BindJSON(c, &req) {
		return
	}
	if !h.authGuard.allowSubject(c, authEndpointLogin, req.ChallengeToken) {
		return
	}
	if h.mfa == nil {
		response.HandleError(c, "MFA service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, userID, err := h.mfa.VerifyChallenge(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Failed to verify MFA challenge", err)
		return
	}
	if userID != 0 {
		c.Set("userID", userID)
	}
	response.Success(c, resp)
}
