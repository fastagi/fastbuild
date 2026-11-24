package routes

import (
	"github.com/fastagi/fastbuild/api/internal/infra/router"
	"github.com/fastagi/fastbuild/api/internal/starter"
)

// RegisterAPI registers all API routes using fluent router
func RegisterAPI(r *router.Router, starters *starter.Registry) {
	// Health routes, including the /v1/health compatibility alias, are owned by the health package
	// and registered by the HTTP kernel before this group.
	r.WithMiddleware("audit")
	starters.RegisterRoutes(r)
}
