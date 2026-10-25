// Package tracedhttp provides an OpenTelemetry client transport whose spans carry only bounded,
// non-sensitive attributes.
package tracedhttp

import (
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

const transportInstrumentationName = "fastbuild/http-client"

// peerServiceKey names the code-owned destination label on outbound client spans.
var peerServiceKey = attribute.Key("peer.service")

// Transport records one client span per outbound request with a bounded attribute set: method,
// a code-owned peer label, status code, and stable error type. It deliberately records no URL,
// host, path, query, or header and injects no trace context, because outbound destinations
// (customer webhook endpoints, AI providers, object storage) are third parties whose URLs can
// carry credentials or object keys. otelhttp was not used because its client spans always
// export url.full.
type Transport struct {
	base http.RoundTripper
	peer string
}

// NewTransport wraps base (http.DefaultTransport when nil). peer must come from a code-owned
// bounded set such as "openai" or "webhook"; never pass a URL or user-controlled value.
func NewTransport(base http.RoundTripper, peer string) *Transport {
	if base == nil {
		base = http.DefaultTransport
	}
	return &Transport{base: base, peer: peer}
}

// RoundTrip implements http.RoundTripper.
func (t *Transport) RoundTrip(request *http.Request) (*http.Response, error) {
	ctx, span := otel.Tracer(transportInstrumentationName).Start(request.Context(), "HTTP "+request.Method,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.HTTPRequestMethodKey.String(request.Method),
			peerServiceKey.String(t.peer),
		),
	)
	defer span.End()

	if span.IsRecording() {
		request = request.WithContext(ctx)
	}
	response, err := t.base.RoundTrip(request)
	if err != nil {
		span.SetAttributes(semconv.ErrorTypeKey.String(fmt.Sprintf("%T", err)))
		span.SetStatus(codes.Error, "")
		return response, err
	}
	span.SetAttributes(semconv.HTTPResponseStatusCode(response.StatusCode))
	if response.StatusCode >= http.StatusInternalServerError {
		span.SetStatus(codes.Error, "")
	}
	return response, nil
}

// CloseIdleConnections forwards to the wrapped transport so http.Client.CloseIdleConnections
// keeps working through the wrapper.
func (t *Transport) CloseIdleConnections() {
	type idleCloser interface{ CloseIdleConnections() }
	if closer, ok := t.base.(idleCloser); ok {
		closer.CloseIdleConnections()
	}
}
