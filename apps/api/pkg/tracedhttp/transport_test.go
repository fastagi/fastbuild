package tracedhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func installRecorder(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previousProvider := otel.GetTracerProvider()
	previousPropagator := otel.GetTextMapPropagator()
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() {
		otel.SetTracerProvider(previousProvider)
		otel.SetTextMapPropagator(previousPropagator)
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	return recorder
}

func TestTransportRecordsBoundedClientSpanWithoutURLOrPropagation(t *testing.T) {
	recorder := installRecorder(t)
	var receivedTraceParent string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedTraceParent = r.Header.Get("traceparent")
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(server.Close)

	client := &http.Client{Transport: NewTransport(nil, "webhook")}
	request, err := http.NewRequest(http.MethodPost, server.URL+"/hooks/secret-path?token=query-secret", nil)
	require.NoError(t, err)
	request.Header.Set("Authorization", "Bearer header-secret")
	response, err := client.Do(request)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())

	assert.Empty(t, receivedTraceParent, "third-party destinations must not receive trace context")
	spans := recorder.Ended()
	require.Len(t, spans, 1)
	span := spans[0]
	assert.Equal(t, "HTTP POST", span.Name())

	attributes := make(map[string]string, len(span.Attributes()))
	var exported strings.Builder
	for _, item := range span.Attributes() {
		attributes[string(item.Key)] = item.Value.String()
		exported.WriteString(string(item.Key) + "=" + item.Value.String() + ";")
	}
	assert.Equal(t, "POST", attributes["http.request.method"])
	assert.Equal(t, "webhook", attributes["peer.service"])
	assert.Equal(t, "202", attributes["http.response.status_code"])
	for _, leaked := range []string{"secret-path", "query-secret", "header-secret", "127.0.0.1", server.URL} {
		assert.NotContains(t, exported.String(), leaked)
	}
}

func TestTransportRecordsErrorTypeOnly(t *testing.T) {
	recorder := installRecorder(t)
	failure := errors.New("dial tcp 10.0.0.1: secret detail")
	client := &http.Client{Transport: NewTransport(roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, failure
	}), "openai")}

	request, err := http.NewRequest(http.MethodGet, "https://provider.invalid/v1/responses", nil)
	require.NoError(t, err)
	_, err = client.Do(request) //nolint:bodyclose // the round tripper returns no response
	require.Error(t, err)

	spans := recorder.Ended()
	require.Len(t, spans, 1)
	assert.Equal(t, codes.Error, spans[0].Status().Code)
	assert.Empty(t, spans[0].Status().Description)
	for _, item := range spans[0].Attributes() {
		assert.NotContains(t, item.Value.String(), "secret detail")
	}
}

func TestTransportForwardsCloseIdleConnections(t *testing.T) {
	base := &closeRecorder{}
	NewTransport(base, "r2").CloseIdleConnections()
	assert.True(t, base.closed)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

type closeRecorder struct{ closed bool }

func (c *closeRecorder) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("unused")
}
func (c *closeRecorder) CloseIdleConnections() { c.closed = true }
