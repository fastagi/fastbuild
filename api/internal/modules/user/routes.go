package user

import (
	"github.com/fastagi/fastbuild/api/internal/infra/router"
)

// RegisterMiddleware registers the persistent authentication-session middleware.
func (h *Handler) RegisterMiddleware(r *router.Router) {
	r.MiddlewareGroup("auth", sessionAuth(h.sessions))
}

// RegisterRoutes registers the user module routes
// It uses the injected handler instance instead of creating a new one
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Public routes
	h.protectPublicRoute(r.POST("/register", h.Register).Name("auth.register"), authEndpointRegister)
	h.protectPublicRoute(r.POST("/login", h.Login).Name("auth.login"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/native/login", h.NativeLogin).Name("auth.native.login"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/native/refresh", h.NativeRefresh).Name("auth.native.refresh"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/native/logout", h.NativeLogout).Name("auth.native.logout"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/mfa/challenge/verify", h.VerifyMFAChallenge).Name("auth.mfa.challenge.verify"), authEndpointLogin)
	h.protectPublicRoute(r.GET("/auth/sso/providers", h.ListSSOProviders).Name("auth.sso.providers"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/sso/oidc/start", h.StartSSOOIDC).Name("auth.sso.oidc.start"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/auth/sso/oidc/callback", h.CallbackSSOOIDC).Name("auth.sso.oidc.callback"), authEndpointLogin)
	h.protectPublicRoute(r.POST("/password/reset", h.RequestPasswordReset).Name("auth.password.reset.request"), authEndpointPasswordReset)
	h.protectPublicRoute(r.POST("/password/reset/confirm", h.ConfirmPasswordReset).Name("auth.password.reset.confirm"), authEndpointPasswordResetConfirm)

	// Protected routes
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		auth.POST("/logout", h.Logout).Name("auth.logout")

		// Multi-factor authentication (TOTP + recovery codes)
		auth.GET("/auth/mfa/status", h.GetMFAStatus).Name("auth.mfa.status")
		auth.POST("/auth/mfa/totp/enroll", h.EnrollMFATOTP).Name("auth.mfa.totp.enroll")
		auth.POST("/auth/mfa/totp/verify", h.VerifyMFATOTP).Name("auth.mfa.totp.verify")
		auth.POST("/auth/mfa/totp/disable", h.DisableMFATOTP).Name("auth.mfa.totp.disable")

		// Profile
		auth.GET("/users/profile", h.GetProfile).Name("users.profile")
		auth.PUT("/users/profile", h.UpdateProfile).Name("users.profile.update")
		auth.PUT("/users/password", h.ChangePassword).Name("users.password.update")
		auth.DELETE("/users/account", h.DeleteAccount).Name("users.account.delete")
	})
}

func (h *Handler) protectPublicRoute(route *router.Route, endpoint authEndpoint) {
	if middleware := h.authGuard.perIPMiddleware(endpoint); middleware != nil {
		route.Middleware(middleware)
	}
}
