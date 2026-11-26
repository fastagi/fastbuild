# Agent Loop Upgrade — Iteration Plan

Status: Proposed (2026-11-26). Vocabulary follows [CONTEXT.md](../../../CONTEXT.md).

## 1. Thesis

FastBuild's product is the loop a coding agent runs: read context, generate, verify, repair. The
HTTP kernel is already fast and measured. The remaining cost sits in the number of steps an agent
must remember, the number of files it must touch, the defaults it can get wrong, and browser-side
rendering. This plan spends effort there and leaves the kernel mostly alone.

## 2. Measured Baseline

Measured on a clean clone at `f4044bd` (Apple M3 Max, Go 1.26.10) unless marked otherwise.

| Area | Fact |
|---|---|
| HTTP middleware chain | 2.1 µs and 18 allocations per request (budget 21) |
| API read paths | p95 1–4 ms under k6 ([PERFORMANCE.md](../../../api/docs/PERFORMANCE.md)) |
| `make wire` | 3.3 s; [ADR 0014](../../../api/docs/adr/0014-wire-maintenance-posture.md) revisits at 10 s |
| Module test loop | `go test ./internal/modules/<m>/...` in 1.3 s |
| CLI after any Go edit | about 12 s to relink `cmd/fastbuild` or `cmd/server` |
| `go test ./...` | 60 s wall; one package takes 45 s, one plugin install test 15.6 s |
| `make governance` | 9.3 s warm; 23 of 28 Python guards are marker-string checks, none use an AST |
| `make:module` | writes 12 files and wires the starter, then prints 5 manual follow-up steps |
| After one new endpoint | 5–7 separate regenerate and check commands, no single entry point |
| Generated module | signed-in user only; no organization scoping, and no guard enforces it |
| Guidance for one CRUD task | about 2,150 lines before code; the plan standard is 809 of them |
| Web feature | about 20 files in 6 directories, no generator, one hand-written route per path |
| API client | types generated twice (6,612 lines each); services hand-written on two transports |
| UI primitives | three diverged copies: web (34 files), admin (31), `packages/ui` (22) |
| Web rendering | 79 of 105 components are client components; no server prefetch or hydration |
| Web first-load budget | 600 KB–1.07 MB per route; admin sits at 297.8 of 300 KiB gzip |
| Stale guidance | Web guidance named Radix; primitives are shadcn-style on `@ui-sdk/react` |

Frontend and governance rows come from a read-only audit and were not re-measured by a second
method. Token estimates are not included because none were measured.

## 3. Decisions Already Made That This Plan Keeps

- Keep Wire ([ADR 0014](../../../api/docs/adr/0014-wire-maintenance-posture.md)). The trigger is a
  10 s warm run; the measured run is 3.3 s. The agent cost of Wire is the forgotten regenerate
  step, which iteration 1 removes without replacing the tool.
- Keep `simple_protocol` and GORM default transactions as defaults
  ([DATABASE.md](../../../api/docs/DATABASE.md)). Iteration 4 changes them only behind a
  transaction audit and a k6 comparison.
- Keep explicit Web route handlers; a catch-all proxy stays forbidden
  ([ADDING_FEATURE.md](../../../apps/web/docs/ADDING_FEATURE.md)). The handlers become generated.

## 4. Rejected Or Deferred

| Proposal | Reason |
|---|---|
| Replace Wire with hand-written lazy assembly | Contradicts ADR 0014; saves 3.3 s that one command hides |
| `slog.LogAttrs` to halve allocations as a goal | The whole chain costs 2.1 µs against millisecond database work |
| Profile-guided optimization in the scaffold | Needs a production profile that only a downstream product has |
| Generic `hooks.Chain[E]` extension points | No second consumer exists yet |
| `LISTEN/NOTIFY` as the queue wake-up | Breaks under PgBouncer transaction pooling; optional at most |
| Mass-migrating 94 handlers to a generic endpoint | Handlers average 15 lines; adopt in generated code first |

## 5. Iterations

Each iteration is independently shippable and ends with a measured exit criterion.

### Iteration 0 — Truth And Hygiene (small) — done 2026-11-26

1. Guidance names `@ui-sdk/react` as the behavior layer under the shadcn-style primitives and
   forbids new `@radix-ui/*` packages; `ROADMAP.md` records OIDC and MFA as landed.
2. Gate timings are recorded in [CI.md](../../CI.md#local-gate-timings).
3. Kernel hygiene, each with a regression test:
   - route constraints compile at registration, so an invalid pattern stops startup;
   - asynchronous event handlers recover from panics, and `EventBus.Shutdown` drains them before
     the starters stop;
   - modules shut down in reverse registration order;
   - the postgres workflow driver enqueues inside the caller's transaction, under a savepoint so
     an idempotency collision does not abort it.

Carried forward:

- Route-level middleware stays a list of pre-handler guards, now documented and pinned by a
  test. Gin fixes a route's handler chain at registration, so wrapping guards around the handler
  needs deferred route registration; no current guard has logic after `c.Next()`.
- `agent:sync` is neither gated nor retired; its generated outputs are absent from the tree.
- The reference task, "organization-scoped CRUD across API, Admin, and Web", has only its
  deterministic API half recorded: `make:module` writes 12 files, edits 2, and leaves 5 manual
  steps; the generated routes are not organization-scoped. The agent-run baseline (commands,
  wall time, pass or fail) belongs to the stage 6 evaluation and is not yet measured.

### Iteration 1 — One Command To Green (medium) — done 2026-11-26

1. `make sync` regenerates the Wire graph, pending OpenAPI fragments, contract types, the starter
   catalog, and the golden schema when a test database is configured. `make sync-check` writes
   nothing and fails on a stale artifact.
2. `make api-check` runs `wire-check`, so local and CI agree.
3. `make verify-changed` selects the narrowest checks from the changed files and reports them as
   text or JSON. It covers `api/`, contracts, all four apps, and the tested packages.
4. `make:module` prints three steps: edit the fragment, `make sync`, `make verify-changed`.

Measured on a generated `project` module: `make sync` 5 s; the API and contract checks of
`make verify-changed` 19 s; a kernel-only change 16 s including governance.

Changed from the proposal, with the reason:

- The entry points are Make targets backed by `tools/dev/`, not `fastbuild` subcommands. A
  subcommand would pay the 12 s relink after every Go edit; the scripts link nothing. This also
  settles the thin-binary question for these two commands.
- Guards are not mapped to paths. A warm `make governance` takes 9.3 s, already under the 10 s
  target; the earlier 44.5 s reading was a cold run.
- The plugin install test already skips under `-short`, which `make verify-changed` passes.
  `make api-check` still runs it.

Carried forward:

- `fastbuild context` still knows only `api`, `apps/web`, `apps/admin`, and the contracts.
- `make:module` does not invoke `make sync` itself, because the fragment needs review first.
- In the scaffold repository, `check-starter-catalog.py` rejects any optional starter outside its
  fixed list, so a module generated here fails governance until that list is updated. Projects
  created by `project:init` do not carry that guard.

### Iteration 2 — Correct By Default (medium) — done 2026-11-26

1. `make:module <name> --scope=organization` generates a starter confined to the verified active
   organization: `auth` plus `organization_context` routes, a repository whose every query names
   `organization_id`, the foreign key and index, the `Organization-Id` contract parameter with its
   400 and 403 answers, a dependency on the organization starter, service tests that refuse
   another organization, and a PostgreSQL repository test that proves it in SQL. Members read;
   owners and admins write.
2. `make archlint` runs two `go/analysis` analyzers over `internal/modules`, in `make api-check`,
   `make verify-changed`, and CI:
   - `orgscope`: a read, update, or delete of a struct with an `OrganizationID` field must name
     `organization_id` in the same query chain or in the local value the chain starts from;
   - `ownedgo`: every `go` statement carries `//archlint:goroutine <what stops it>`.
3. `check-api-boundaries.sh` allows a module to import a sibling module only along the 24 edges
   that already exist.
4. [CRUD_PLAN_CHECKLIST.md](../../CRUD_PLAN_CHECKLIST.md) is a 54-line plan for one generated
   resource; the plan standard points to it and it states when the full standard applies again.

Verified on a generated `project` module: it passes its own tests, lint, the contract gate, the
route catalog, and `make archlint` without edits; replacing one `organization_id` predicate with
an `id`-only predicate fails `make archlint`.

Limits to know:

- `orgscope` skips 29 existing functions listed in `orgscope/baseline.txt`. They were listed, not
  reviewed one by one; most reach rows through a parent already confined to one organization.
- `orgscope` reads GORM calls and string literals. It does not see raw SQL passed to `Exec` or
  `Raw`, and a query built by a helper in another function needs the directive.
- The unscoped `make:module` default is unchanged, because the organization starter is optional;
  the generator now recommends the scoped form.

Carried forward:

- A typed request actor that replaces the string context keys (`userID`, `apiKey`), and an
  analyzer that forbids them. It needs the 71 existing call sites migrated first.
- A `--scope=user` variant.

### Iteration 3 — Contract-Driven Frontend (large, needs an ADR)

1. Generate one typed client from OpenAPI into `packages/api-client`, used by all four apps.
   Remove per-feature services, the duplicated generated type files, and `assertContract` calls.
2. Generate Web route handlers and mocks from the contract; delete the regexp source tests.
3. `make:feature --web --admin`: page, route, hook, i18n, and co-located test, with registries
   updated through slots.
4. ADR: Web and Admin adopt `@fastbuild/ui`, and whether a root workspace with task caching is
   compatible with the rule that every app stays removable.

Exit: a Web feature touches five files or fewer by hand; one client implementation remains.

### Iteration 4 — Measured Performance (medium)

1. Web: server prefetch with hydration for console routes, a smaller client shell, `next/font`,
   and a React Compiler trial against `@ui-sdk/react`. Lower each route budget to the measured
   value plus 10%.
2. Admin: restore at least 15% headroom under the 300 KiB budget through route-level splitting.
3. API, each change kept only if k6 shows it:
   - a documented direct-connection profile that selects `cache_statement` (the recorded gain
     is about 30% throughput);
   - `SkipDefaultTransaction` after auditing the 35 explicit transaction sites;
   - session lookup cost on authenticated requests, with revocation latency as the constraint.

Exit: console routes render data without a post-hydration fetch; budgets tightened and passing;
every retained API change has a before and after k6 summary.

### Iteration 5 — Agent Interface (medium)

1. MCP tools beyond plugins: `context`, `route_list`, `sync`, `verify_changed`, `make_module`,
   and `make_feature`.
2. Run the reference task as a scheduled agent evaluation and publish the trend.

Exit: the reference task completes through MCP tools alone; the evaluation runs weekly.

## 6. Order And Risk

Iterations 0–2 touch only `api/`, tooling, and guidance, carry no contract change, and deliver
most of the agent benefit. Iteration 3 is the largest change and the only one that alters app
structure. Iteration 4 is independent and can run in parallel with 2 or 3.
