package operatorcommands

import (
	"context"
	"errors"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

type webhookWorkerFunc func(context.Context, int) (int, error)

func (f webhookWorkerFunc) DispatchWebhooks(ctx context.Context, limit int) (int, error) {
	return f(ctx, limit)
}

func TestRunWebhookWorkerTracesEachBatch(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previous := otel.GetTracerProvider()
	otel.SetTracerProvider(provider)
	t.Cleanup(func() {
		otel.SetTracerProvider(previous)
		_ = provider.Shutdown(context.Background())
	})

	var batchSpan trace.SpanContext
	worker := webhookWorkerFunc(func(ctx context.Context, limit int) (int, error) {
		batchSpan = trace.SpanContextFromContext(ctx)
		return 3, nil
	})
	processed, err := runWebhookWorker(context.Background(), worker, webhookWorkerConfig{Batch: 25, Once: true})
	if err != nil || processed != 3 {
		t.Fatalf("runWebhookWorker() = %d, %v; want 3, nil", processed, err)
	}

	failing := webhookWorkerFunc(func(context.Context, int) (int, error) { return 0, errors.New("endpoint secret detail") })
	if _, err := runWebhookWorker(context.Background(), failing, webhookWorkerConfig{Batch: 25, Once: true}); err == nil {
		t.Fatal("runWebhookWorker() error = nil, want batch failure")
	}

	spans := recorder.Ended()
	if len(spans) != 2 {
		t.Fatalf("spans = %d, want 2", len(spans))
	}
	if spans[0].Name() != "webhook.dispatch_batch" || spans[0].SpanKind() != trace.SpanKindConsumer {
		t.Fatalf("span = %q kind %v", spans[0].Name(), spans[0].SpanKind())
	}
	if spans[0].SpanContext().SpanID() != batchSpan.SpanID() {
		t.Fatal("dispatcher did not receive the batch span context")
	}
	if spans[1].Status().Code != codes.Error || spans[1].Status().Description != "" {
		t.Fatalf("failed batch status = %+v, want error without message", spans[1].Status())
	}
}
