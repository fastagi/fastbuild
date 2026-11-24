package bootstrap

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/internal/infra/tracing"
)

// tracingShutdownTimeout bounds the final span flush so an unreachable collector cannot stall exit.
const tracingShutdownTimeout = 5 * time.Second

// newTracerProvider is replaced in tests to avoid dialing an exporter.
var newTracerProvider = tracing.NewTracerProvider

// InitTracing starts the process-wide tracer provider from the typed configuration and adds GORM
// spans to db when it is non-nil. Every long-running process (HTTP server and workers) uses this
// one helper so spans share the same resource, sampler, and propagator. It returns nil when
// tracing is disabled or the exporter cannot be created; the failure is logged and never stops
// the process. Callers own the returned provider and must pass it to ShutdownTracing.
func InitTracing(cfg *config.Config, db *gorm.DB) *tracing.TracerProvider {
	if cfg == nil || !cfg.Tracing.Enabled {
		return nil
	}
	tp, err := newTracerProvider(&tracing.Config{
		Enabled:     true,
		ServiceName: cfg.App.Name,
		Environment: cfg.App.Env,
		Endpoint:    cfg.Tracing.Endpoint,
		Insecure:    cfg.Tracing.Insecure,
		SampleRate:  cfg.Tracing.SampleRate,
		Debug:       cfg.App.Debug,
	})
	if err != nil {
		slog.Warn("tracing.init_failed", "err", err)
		return nil
	}
	if db != nil {
		if err := tracing.WithTracing(db, cfg.App.Name); err != nil {
			slog.Warn("tracing.gorm_init_failed", "err", err)
		}
	}
	slog.Info("tracing.enabled", "sample_rate", cfg.Tracing.SampleRate)
	return tp
}

// ShutdownTracing flushes buffered spans and stops the provider. A nil provider is a no-op.
func ShutdownTracing(tp *tracing.TracerProvider) {
	if tp == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), tracingShutdownTimeout)
	defer cancel()
	if err := tp.Shutdown(ctx); err != nil {
		slog.Warn("tracing.shutdown_failed", "err", err)
		return
	}
	slog.Info("tracing.shutdown_complete")
}
