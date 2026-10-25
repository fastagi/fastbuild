package bootstrap

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/internal/infra/tracing"
)

func stubTracerProvider(t *testing.T, factory func(*tracing.Config) (*tracing.TracerProvider, error)) {
	t.Helper()
	previous := newTracerProvider
	newTracerProvider = factory
	t.Cleanup(func() { newTracerProvider = previous })
}

func captureSlog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &output
}

func TestInitTracingDisabledSkipsProvider(t *testing.T) {
	stubTracerProvider(t, func(*tracing.Config) (*tracing.TracerProvider, error) {
		t.Fatal("provider must not be created when tracing is disabled")
		return nil, nil
	})
	if tp := InitTracing(&config.Config{}, nil); tp != nil {
		t.Fatalf("InitTracing() = %v, want nil", tp)
	}
	ShutdownTracing(nil)
}

func TestInitTracingMapsTypedConfigAndLogsStructuredEvents(t *testing.T) {
	output := captureSlog(t)
	var received *tracing.Config
	stubTracerProvider(t, func(cfg *tracing.Config) (*tracing.TracerProvider, error) {
		received = cfg
		return tracing.NewTracerProvider(&tracing.Config{ServiceName: cfg.ServiceName})
	})
	cfg := &config.Config{
		App:     config.AppConfig{Name: "fastbuild-worker", Env: "staging"},
		Tracing: config.TracingConfig{Enabled: true, Endpoint: "collector:4317", SampleRate: 0.25},
	}

	tp := InitTracing(cfg, nil)
	if tp == nil {
		t.Fatal("InitTracing() = nil, want provider")
	}
	ShutdownTracing(tp)

	if received == nil || received.ServiceName != "fastbuild-worker" || received.Environment != "staging" ||
		received.Endpoint != "collector:4317" || received.SampleRate != 0.25 || !received.Enabled {
		t.Fatalf("tracing config = %+v", received)
	}
	for _, event := range []string{"tracing.enabled", "tracing.shutdown_complete"} {
		if !strings.Contains(output.String(), event) {
			t.Fatalf("log output %q missing %s", output.String(), event)
		}
	}
}

func TestInitTracingFailureLogsAndContinues(t *testing.T) {
	output := captureSlog(t)
	stubTracerProvider(t, func(*tracing.Config) (*tracing.TracerProvider, error) {
		return nil, errors.New("exporter unavailable")
	})
	cfg := &config.Config{Tracing: config.TracingConfig{Enabled: true}}

	if tp := InitTracing(cfg, nil); tp != nil {
		t.Fatalf("InitTracing() = %v, want nil after failure", tp)
	}
	if !strings.Contains(output.String(), "tracing.init_failed") || !strings.Contains(output.String(), "level=WARN") {
		t.Fatalf("log output = %q, want structured tracing.init_failed warning", output.String())
	}
}
