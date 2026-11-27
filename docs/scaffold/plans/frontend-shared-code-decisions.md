# Frontend Shared Code — Decisions To Make

Status: Proposed (2026-11-26). Section 3's first step, one shared copy of the generated types,
is implemented; nothing else here is. Each section states a question the
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
- The generated contract types were written twice, byte for byte: `apps/web` and `apps/admin`
  each held a 6,612-line `src/http/generated/openapi.ts`. They now share
  `packages/contract-types`.
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

**Recommendation: share the generated types (done); keep per-feature services.**

`openapi.ts` is generated once into `packages/contract-types`, a types-only workspace package
that Web and Admin import as `@fastbuild/contract-types/openapi`. This removed 6,612 duplicated
lines without changing how either app makes a request. Desktop and mobile do not use it yet:
`packages/api-client` still has hand-written types, and checking those against the contract is
the next step.

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

## 5. Container Images And Shared Packages

Fixed on 2026-11-26. The Web and Admin images built with their own directory as the context, so
`../../packages/*` was outside the build: the Web `builder` stage failed with
`Can't resolve '@fastbuild/tokens/brand'`, and Admin failed the same way.

Each image now keeps its directory as the main context and receives the shared packages through a
named BuildKit context (`--build-context packages=../../packages`). The Dockerfile copies exactly
the packages its `pnpm-workspace.yaml` lists, and `check-container-supply-chain.py` fails when the
two lists differ. Both `verify-container.sh` scripts pass end to end.

One runtime change in the Web image: `next.config.ts` roots Turbopack at the repository, so the
standalone output mirrors the workspace. The server now runs from `/app/apps/web/server.js`
instead of `/app/server.js`; the command is still `node server.js`.

This was the smallest fix. A root pnpm workspace, phase 2 of the internal client-platforms plan,
would make the repository root the natural build context instead; section 2 does not weigh that
argument and should be read with it in mind.
