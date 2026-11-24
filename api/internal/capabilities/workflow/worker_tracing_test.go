package workflow_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"

	"github.com/fastagi/fastbuild/api/internal/capabilities/workflow"
)

func TestWorkerStartsConsumerSpanUnderDispatcherTrace(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previousProvider, previousPropagator := otel.GetTracerProvider(), otel.GetTextMapPropagator()
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() {
		otel.SetTracerProvider(previousProvider)
		otel.SetTextMapPropagator(previousPropagator)
		_ = provider.Shutdown(context.Background())
	})

	manager := workflow.NewQueueManager()
	driver := workflow.NewMemoryDriver(2)
	t.Cleanup(func() { _ = driver.Close() })
	manager.RegisterDriver("memory", driver)
	if err := manager.SetDefaultDriver("memory"); err != nil {
		t.Fatalf("SetDefaultDriver() error = %v", err)
	}
	manager.RegisterJob(&TestJob{})
	manager.RegisterJob(&FailingJob{})

	parentCtx, parent := provider.Tracer("test").Start(context.Background(), "request")
	if err := manager.DispatchTo(parentCtx, "traced", &TestJob{Message: "payload-must-not-be-exported"}); err != nil {
		t.Fatalf("DispatchTo() error = %v", err)
	}
	if err := manager.DispatchTo(parentCtx, "traced", &FailingJob{}); err != nil {
		t.Fatalf("DispatchTo() error = %v", err)
	}
	parent.End()

	worker := manager.NewWorker(workflow.WorkerConfig{Queue: "traced", Concurrency: 1, Timeout: time.Second})
	for range 2 {
		if err := worker.ProcessNext(context.Background()); err != nil {
			t.Fatalf("ProcessNext() error = %v", err)
		}
	}

	var jobs []sdktrace.ReadOnlySpan
	for _, span := range recorder.Ended() {
		if strings.HasPrefix(span.Name(), "workflow.job ") {
			jobs = append(jobs, span)
		}
	}
	if len(jobs) != 2 {
		t.Fatalf("job spans = %d, want 2", len(jobs))
	}
	for _, span := range jobs {
		if span.SpanKind() != trace.SpanKindConsumer {
			t.Fatalf("span kind = %v, want consumer", span.SpanKind())
		}
		if span.Parent().TraceID() != parent.SpanContext().TraceID() {
			t.Fatal("job span did not continue the dispatcher trace")
		}
		for _, attribute := range span.Attributes() {
			if strings.Contains(attribute.Value.String(), "payload-must-not-be-exported") {
				t.Fatalf("job data exported in attribute %s", attribute.Key)
			}
		}
	}
	if jobs[0].Status().Code == codes.Error || jobs[1].Status().Code != codes.Error {
		t.Fatalf("statuses = %v, %v; want only the failing job marked as error", jobs[0].Status(), jobs[1].Status())
	}
}
