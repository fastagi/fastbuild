# Observability And Sensitive Data

FastBuild treats logs, traces, local diagnostics, and audit records as durable data boundaries. They are
useful for correlation and operations, but they are not a second copy of requests or secrets.

## Request Logs

The default Gin request logger records status, latency, client IP, method, route-template path, and
`request_id`. It deliberately:

- records `/users/:id` rather than the concrete path parameter;
- records `unmatched` instead of attacker-controlled paths when no route matches;
- never records raw query strings or query values;
- never records request or response bodies;
- passes structured context through `pkg/redact` before any handler receives it.

Route templates and the unmatched-route sentinel reduce credential/PII exposure and bound log
cardinality. Do not place credentials in URLs even though FastBuild minimizes their telemetry surface.

## Redaction Contract

`pkg/redact` is the reusable, standard-library-only boundary for credential-shaped fields. It
normalizes key spelling and replaces password, secret, token, authorization, cookie, API-key,
session, OTP, private/signing/encryption-key, credential, and signature values with `[REDACTED]`.
Query-only `code`, `key`, and `sig` parameters are also treated as credentials. Nested string-key
maps and slices are copied and sanitized to a bounded depth; caller-owned values are not mutated.

This is defense in depth, not permission to log secrets. A secret hidden under an ambiguous key or
embedded in a free-form message cannot be classified reliably. Callers must still avoid credentials,
full email addresses, phone numbers, payment data, and raw provider payloads.

## Exception Center

The HTML exception center is development-only. It collects no body, redacts sensitive headers and
query values, uses the route template in place of concrete path parameters, and HTML-escapes every
dynamic field before rendering. `Authorization`, `Proxy-Authorization`, Cookie, `Set-Cookie`,
`X-API-Key`, CSRF tokens, OAuth codes, and similarly named values must never appear in the page.

Production must keep `APP_DEBUG=false`; production panic responses remain the normal JSON
`COMMON.INTERNAL` boundary and do not expose stack, request, SQL, or environment details.

## Database And Tracing

GORM logging always enables `ParameterizedQueries`, and the observed logger preserves GORM's
optional `ParamsFilter` interface while forcing bound parameters out before `Trace`. GORM's special
`Scan` recorder is also parameterized because it otherwise expands values before calling the
configured logger. SQL diagnostics therefore preserve statement shape while keeping values out of
stdout and the local exception timeline. OpenTelemetry uses GORM's parameterized statement shape as
`db.statement`. Do not disable parameterization to improve a debug screenshot; reproduce locally
with explicit non-secret fixtures instead.

HTTP server spans use the route template for the span name and `http.route`. FastBuild deliberately omits
the concrete `url.path`, raw query values, and free-form error messages from exported spans; traces
carry status and stable `error.type` summaries while structured logs own reviewed diagnostic detail.
Unmatched requests use only the HTTP method as the span name.

Tracing starts through one bootstrap helper, `bootstrap.InitTracing`, shared by the HTTP server
and every long-running worker (`workflow:work`, `workflow:schedule:work`, `notification:work`,
`webhook:work`). Each process uses the same resource, sampler, and W3C propagator, adds GORM spans
to its database handle, and flushes buffered spans through `bootstrap.ShutdownTracing` (bounded to
5 s) on exit. Exporter failures log the structured `tracing.init_failed` warning and the process
continues untraced. Workflow workers continue the dispatcher's trace from the queued `traceparent`
with one consumer span per job, named `workflow.job <type>` from the code-registered job type; job
data is never exported. Notification and webhook workers open one consumer span per dispatch batch
carrying only the processed count.

Outbound HTTP for the AI provider, webhook delivery, and R2 storage goes through
`pkg/tracedhttp`. Its client spans carry the method, a code-owned `peer.service` label (`openai`,
`webhook`, `r2`), the status code, and the stable `error.type`, and nothing else: no URL, host,
path, query, or header. Webhook URLs are customer-supplied and can embed credentials in the path,
and storage paths contain object keys, so `otelhttp` is intentionally not used because its client
spans always export `url.full`. The transport also never injects `traceparent` into requests to
these third parties. The span ends when response headers arrive, so it excludes body streaming.

## Database Metrics

When `METRICS_ENABLED=true`, `database.NewDB` installs a GORM callback plugin and a pool collector:

| Series | Labels | Source |
|---|---|---|
| `db_queries_total`, `db_query_duration_seconds` | `operation` (`create`, `query`, `update`, `delete`, `row`, `raw`), `table` | GORM callbacks |
| `db_connections_open`, `db_connections_in_use`, `db_connections_idle`, `db_connections_max_open` | none | `sql.DBStats` at scrape time |
| `db_connections_wait_total`, `db_connections_wait_duration_seconds_total` | none | `sql.DBStats` at scrape time |

Labels never contain SQL text or bound values. `table` is the statement's table name when it is a
plain lowercase identifier (optionally schema-qualified), `unknown` when GORM has none (most raw
SQL), and `other` for anything else or once 256 distinct table labels exist. The plugin costs two
allocations per statement; pool statistics are read only when Prometheus scrapes, with no
background goroutine. With metrics disabled, no callback is registered.

## Audit Records

Audit records intentionally persist actor, target, action, result, request correlation, and reviewed
business changes. The audit starter redacts sensitive `Changes` fields and recursively sanitizes
`Metadata` again at the service boundary before persistence. Feature code should record stable IDs
and state transitions, never bearer values, passwords, invitation tokens, provider payloads, or PII.

Request audit records are written by a bounded in-memory queue in batches of up to 200 rows every
50 ms (`AUDIT_WRITE_MODE=async`, the default), which raised write-request throughput by 50–70% in
the baseline measurements. A full queue falls back to a synchronous write, a failed batch is retried
row by row, and the HTTP kernel drains the queue after it stops accepting requests and before it
closes the database. Records still queued when a process is killed without a graceful shutdown are
lost; `AUDIT_WRITE_MODE=sync` restores a write before every response. Commands and other direct
`Record` callers always write synchronously.

## Logging APIs

- Business and event operations use the existing `log/slog` seams.
- HTTP runtime, request, exception-center, and configured output handlers use `pkg/logger`.
- Do not add another logging library or silently mix the two seams inside one operation.
- Use stable event names and structured fields; never interpolate a secret into the message.

## Verification

```bash
go test ./pkg/redact ./pkg/logger ./pkg/errors ./pkg/tracedhttp ./internal/infra/exception ./internal/infra/database ./internal/infra/tracing ./internal/infra/metrics ./internal/bootstrap ./internal/capabilities/workflow ./internal/modules/audit
go test ./pkg/redact -run '^$' -bench '^BenchmarkMap$' -benchmem -count=5
python3 ../.agents/skills/fastbuild-framework-review/scripts/check-sensitive-telemetry.py
```
