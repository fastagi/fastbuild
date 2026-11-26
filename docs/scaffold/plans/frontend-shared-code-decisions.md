# Frontend Shared Code — Decisions To Make

Status: Proposed (2026-11-26). Nothing here is implemented. Each section states a question the
[agent loop upgrade](agent-loop-upgrade.md) left open, the facts, and a recommendation for the
maintainer to accept or reject.

## Facts

- Each app is its own pnpm workspace with its own lockfile. An app lists the shared packages it
  uses by relative path in its `pnpm-workspace.yaml`; `apps/desktop` already consumes
  `@fastbuild/ui`, `@fastbuild/core`, `@fastbuild/api-client`, and `@fastbuild/tokens` this way.
- `apps/web` and `apps/admin` list only `@fastbuild/tokens`.
- UI primitives exist three times: `apps/web/src/components/ui` (34 files),
  `apps/admin/src/components/ui` (31 files), and `packages/ui` (22 files). The Web and Admin
  copies share 21 file names and have diverged.
- The generated contract types are written twice, byte for byte: `apps/web` and `apps/admin`
  each hold a 6,612-line `src/http/generated/openapi.ts`.
- `packages/api-client` is hand-written, has no link to the generated types, and is used only by
  desktop and mobile. Web calls the API through axios; Admin through fetch.
- Admin sits at 297.8 of 300 KiB gzip. Web's largest route has 32 KB of raw headroom.
- `make verify-changed` already selects checks by changed path, and a full Web type-check, lint,
  and test run takes about 25 seconds.

## 1. Should Web And Admin Adopt `@fastbuild/ui`?

**Recommendation: yes, one primitive at a time, behind the bundle budgets.**

The existing workspace model already supports it, so it does not touch the rule that every app
stays removable. The risk is size and behavior, not structure: the copies diverged for reasons
that are not all recorded, and Admin has 3% of its budget left.

Proposed rule: a primitive moves to `packages/ui` only when one implementation passes both apps'
existing tests and neither app's route budget grows. Start with the leaf primitives that have no
app-specific variants (separator, skeleton, label, badge). Stop and record the reason for any
primitive that cannot be shared. Do not move `sidebar` until the rest is done.

Rejecting this keeps three copies; the cost is that every primitive fix is made up to three times.

## 2. Should The Repository Get A Root Workspace With Task Caching?

**Recommendation: no, not now.**

A root workspace would replace five lockfiles with one and allow a task cache. It would also make
the apps share one dependency resolution, which weakens two properties the current layout gives:
an app can be deleted without touching another app's lockfile, and each app's supply-chain policy
(`minimumReleaseAge`, `trustPolicy`, overrides) is reviewed on its own.

The speed argument is weak today. The changed-file runner already skips untouched units, and the
slowest step is seconds, not minutes. Cheaper steps are available first: ESLint `--cache`, and
dropping the duplicate type-check that Admin's `build` runs.

Revisit when a single-unit `make verify-changed` exceeds 60 seconds, or when a second shared
package needs a build step.

## 3. Should There Be One Generated API Client?

**Recommendation: share the generated types now; keep per-feature services.**

Generate `openapi.ts` once into a `packages/contract-types` package that Web, Admin, desktop, and
mobile list in their workspaces, and delete the two copies. This removes 6,612 duplicated lines
and gives `packages/api-client` a contract to be checked against, without changing how any app
makes a request.

A single generated client for all four apps is a larger step and is not recommended yet. Web and
Admin differ on purpose: Web calls same-origin route handlers that hold the session, and Admin
calls the API directly with a CSRF token. The per-feature service is also where each response is
validated before it is cached. `make:feature` now writes that service, so its cost to a builder
is already close to zero.

## 4. Should `make:feature` Cover Admin?

**Recommendation: only after an operator route generator exists.**

The Admin Console is the operator surface: it authorizes through `/v1/operator` routes, not the
organization-scoped routes `make:module --scope=organization` generates. An Admin feature
generator therefore needs a matching operator API first; generating the page alone would produce
a screen with no route it is allowed to call.
