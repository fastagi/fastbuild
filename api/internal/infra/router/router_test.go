package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fastagi/fastbuild/api/pkg/response"
)

func TestRouteConstraintFailureUsesUnifiedErrorResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	r := New(engine)
	r.GET("/items/:id", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	}).WhereNumber("id")

	req := httptest.NewRequest(http.MethodGet, "/items/not-a-number", nil)
	w := httptest.NewRecorder()

	engine.ServeHTTP(w, req)

	require.Equal(t, http.StatusNotFound, w.Code)

	var body response.ErrorResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, http.StatusNotFound, body.Code)
	assert.Equal(t, response.ErrorCodeNotFound, body.ErrorCode)
	assert.Equal(t, "Invalid parameter: id", body.Message)
}

func TestRouteConstraintPatternIsValidatedAtRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := New(gin.New())
	route := r.GET("/items/:id", func(c *gin.Context) {})

	assert.Panics(t, func() { route.Where("id", "([") })
}

func TestRouteConstraintMatchingDoesNotCompilePerRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	r := New(engine)
	r.GET("/items/:id", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	}).WhereNumber("id")
	r.GET("/plain/:id", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	serve := func(path string) float64 {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		return testing.AllocsPerRun(200, func() {
			engine.ServeHTTP(httptest.NewRecorder(), req)
		})
	}

	// A constrained route may not allocate more than the same route without a constraint.
	assert.LessOrEqual(t, serve("/items/42"), serve("/plain/42"))
}

func TestRouteGuardsRunInOrderBeforeHandlerAndStopOnAbort(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	r := New(engine)
	var order []string
	guard := func(name string, abort bool) gin.HandlerFunc {
		return func(c *gin.Context) {
			order = append(order, name)
			if abort {
				c.AbortWithStatus(http.StatusForbidden)
			}
		}
	}
	handler := func(c *gin.Context) {
		order = append(order, "handler")
		c.Status(http.StatusNoContent)
	}
	r.GET("/open", handler).Middleware(guard("first", false), guard("second", false))
	r.GET("/closed", handler).Middleware(guard("deny", true), guard("skipped", false))

	w := httptest.NewRecorder()
	engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/open", nil))
	require.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, []string{"first", "second", "handler"}, order)

	order = nil
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/closed", nil))
	require.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, []string{"deny"}, order)
}
