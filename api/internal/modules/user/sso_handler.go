package user

import (
	"github.com/gin-gonic/gin"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/pkg/handler"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

// ListSSOProviders returns the bounded catalog of configured, enabled OIDC providers.
// fastbuild:bounded-list max=64 reason=configured OIDC provider catalog
func (h *Handler) ListSSOProviders(c *gin.Context) {
	if h.sso == nil {
		response.Success(c, []SSOProviderSummary{})
		return
	}
	response.Success(c, h.sso.ListProviders(c.Request.Context()))
}

// StartSSOOIDC starts an OIDC PKCE S256 login flow for an enabled provider.
func (h *Handler) StartSSOOIDC(c *gin.Context) {
	var req SSOOIDCStartRequest
	if !handler.BindJSON(c, &req) {
		return
	}
	if h.sso == nil {
		response.HandleError(c, "SSO service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, err := h.sso.StartOIDC(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Failed to start SSO login", err)
		return
	}
	response.Success(c, resp)
}

// CallbackSSOOIDC completes an OIDC callback, links or JIT-provisions the user, and issues a session.
func (h *Handler) CallbackSSOOIDC(c *gin.Context) {
	var req SSOOIDCCallbackRequest
	if !handler.BindJSON(c, &req) {
		return
	}
	if h.sso == nil {
		response.HandleError(c, "SSO service unavailable", domain.ErrServiceUnavailable)
		return
	}
	resp, err := h.sso.CallbackOIDC(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Failed to complete SSO login", err)
		return
	}
	if resp.MFARequired {
		response.Success(c, &MFAChallengeResponse{
			MFARequired:        true,
			ChallengeToken:     resp.ChallengeToken,
			ChallengeExpiresIn: resp.ChallengeExpiresIn,
			Method:             resp.Method,
		})
		return
	}
	if resp.User != nil {
		c.Set("userID", resp.User.ID)
	}
	response.Success(c, resp)
}
