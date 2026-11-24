package health

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckReportsLatencyInMilliseconds(t *testing.T) {
	h := New()
	h.Register("slow", func(context.Context) CheckResult {
		time.Sleep(15 * time.Millisecond)
		return CheckResult{Status: StatusUp}
	})

	report := h.GetHealth(context.Background())
	result := report.Checks["slow"]
	assert.GreaterOrEqual(t, result.LatencyMS, int64(15))
	assert.Less(t, result.LatencyMS, int64(5000), "milliseconds, not nanoseconds")

	encoded, err := json.Marshal(report)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"latency_ms":`)
	assert.NotContains(t, string(encoded), `"duration"`)
}

func TestRegisterRoutesServesVersionedCompatibilityAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	New().RegisterRoutes(engine)

	response := httptest.NewRecorder()
	engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/health", nil))

	require.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"status":"ok","version":"v1"}`, response.Body.String())
}

func TestReadinessFailsWhenRegisteredRedisCheckerIsDown(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := New()
	h.Register("redis", RedisChecker(func(context.Context) error {
		return errors.New("dial tcp redis.internal:6379: connection refused")
	}))
	engine := gin.New()
	h.RegisterRoutes(engine)

	ready := httptest.NewRecorder()
	engine.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	assert.Equal(t, http.StatusServiceUnavailable, ready.Code)

	report := httptest.NewRecorder()
	engine.ServeHTTP(report, httptest.NewRequest(http.MethodGet, "/health", nil))
	assert.Equal(t, http.StatusServiceUnavailable, report.Code)
	assert.Contains(t, report.Body.String(), `"redis ping failed"`)
	assert.NotContains(t, report.Body.String(), "redis.internal", "the raw driver error must not reach the probe body")

	live := httptest.NewRecorder()
	engine.ServeHTTP(live, httptest.NewRequest(http.MethodGet, "/health/live", nil))
	assert.Equal(t, http.StatusOK, live.Code, "liveness must not depend on Redis")
}
