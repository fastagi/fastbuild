# AGENTS.md - FastBuild Web

Rules for the Next.js frontend under `apps/web/`.

## Scope

The Web half uses Next.js 16 App Router, React 19, TypeScript, Tailwind 4,
shadcn, Zustand, TanStack Query, and next-intl. Code is feature-first under
`src/features/` and imports through `@/...`.

Inspect the owning feature, route, and tests first. Load one task-specific
skill or document; do not preload every design, state, testing, and performance
guide for an ordinary component edit.

## Skill Routing

| Skill | Select when |
|---|---|
| `frontend-design` | Visual direction, OKLCH tokens, Tailwind, shadcn primitives, or UI/UX review |
| `data-state-management` | TanStack Query, Zustand, service-hook-type flow, or API error handling |
| `web-testing` | Vitest/Testing Library unit/component tests or browser-driven verification |
| `web-perf` | Measuring route bundles, Web Vitals, or applying React/Next.js perf patterns |
| `accessibility-audit` | Explicit WCAG 2.2 AA or accessibility audit of a completed surface |
| `i18n-handler` | Adding locale keys, namespaces, or changing translation boundaries |

Choose at most one primary skill when its trigger clearly matches; routine
local work may need none. Baseline accessibility, type safety, and responsive
behavior remain mandatory without loading an audit skill every time.

## Structure

```text
src/app/                 App Router routes and route groups
src/app/api/             development mock BFF route handlers
src/features/<feature>/  components, hooks, services, store, server, types
src/components/ui/       shadcn-style primitives built on @ui-sdk/react (no Radix)
src/components/features/ shared composed feature UI
src/components/common/   generic shared components
src/components/blocks/   registry blocks installed with plugin:add; copy arrives via props
src/http/                transport, envelopes, and error parsing
src/providers/           application provider composition
src/i18n/                locale routing and messages
src/themes/              global tokens and theme styles
src/test/                shared test setup and contract tests
```

Route groups:

- `(auth)`: public authentication.
- `(protected)`: authenticated shell.
- `(protected)/(console)`: replaceable scaffold console.
- `(protected)/(devtools)`: development-only tools and examples.
- `(site)`: public pages.

## Architecture Rules

- Prefer Server Components. Add `"use client"` only at the smallest interactive
  boundary.
- Keep feature behavior under `src/features/<feature>/`; expose a small public
  surface from the feature index.
- Feature services own endpoint DTOs and call `src/http/request.ts`. Components
  do not call `fetch` directly.
- TanStack Query owns server state. Zustand owns shared client state. Local UI
  state stays local.
- Create one store instance per provider/request boundary; do not leak
  request-specific state through module singletons.
- Put providers at the lowest layout that needs them.
- Shared composed controls must preserve their semantic host, focus behavior,
  disabled state, and loading state.
- Search before adding a generic hook, utility, primitive, or compatibility
  export.

## Auth And Mock BFF

The default development path uses same-origin `/api` mock BFF handlers.
Production must use the documented real API adapter and keeps mock routes
disabled unless a deployment explicitly opts into demo behavior.

- Mock handlers call `guardMockBffRoute()` before reading input or state.
- Mutating mock handlers also call `guardSameOriginMutation(request)` before
  parsing or mutation.
- Mock success responses use `apiSuccessResponse()`.
- Mock failures use the shared response envelope and stable `error_code`.
- Production-disabled mock routes return
  `503 COMMON.SERVICE_UNAVAILABLE`.
- Mock behavior must match the browser-facing contract of the adapter it
  replaces; a base URL change alone is not authentication integration.

Protected routes resolve serializable auth bootstrap state on the server and
create an isolated client store. Treat session absence (`401`), access denial
(`403`), and temporary resolution failure as different states. `AuthGuard` is
UX; Route Handlers, Server Actions, and the API remain authorization
boundaries.

Use the Next.js 16 `proxy.ts` convention for request interception. Do not add a
legacy `middleware.ts` beside it.

## HTTP And Error Rules

- Shared success envelope: `{ code: 0, message: "success", data }`.
- Server failures branch on dotted backend `ApiErrorCode`.
- Browser-owned network, timeout, and invalid-success-payload failures use
  `ClientErrorCode`; never imitate server error codes.
- Validate security- or state-sensitive JSON at the network boundary.
- User-facing text comes from stable local translation mappings, not backend
  message text.
- Preserve `request_id` for diagnostics without exposing sensitive provider or
  server details.

Update the owning file under `../../packages/contracts/` when public request, response,
status, error, session, or pagination behavior changes.

## UI And Internationalization

- Use shadcn primitives and existing variants before creating a new control. Their behavior
  layer is `@ui-sdk/react`; do not add `@radix-ui/*` packages.
- Use theme tokens from `src/themes/`; do not hardcode parallel design systems.
- Keep controls keyboard accessible, visibly focused, responsive, and stable
  during loading/error/empty states.
- Keep cards for actual repeated or framed units, not every page section.
- Use icons from the installed icon library for familiar icon actions and
  provide accessible names/tooltips where needed.
- Keep standard button icons and labels on one horizontal line. Use a distinct
  composed control when an interaction genuinely requires a vertical layout.
- All user-facing copy uses next-intl messages. Reuse the nearest namespace and
  keep locale files structurally aligned.
- Server code uses server translation APIs; client components use scoped
  `useTranslations`.

## Environment And Security

- Browser-safe values resolve through `@/config/env` (`src/config/env.ts`,
  validated by `publicEnvSchema`); server-only values and secrets resolve through
  `@/config/server-env` (`src/config/server-env.ts`, validated by
  `serverEnvSchema` in `src/config/env-validation.ts`). Never re-export
  `server-env` from `src/config/index.ts` or read `process.env` directly outside
  those entry modules (`src/test/env-contract.test.ts` enforces this boundary).
- Distinguish build-time `NEXT_PUBLIC_*` values from runtime server values.
- Search `src/utils/index.ts`, `src/hooks/`, and native Web APIs (`Intl`, `URL`,
  `crypto`, `structuredClone`) before adding shared helpers; keep single-feature
  helpers inside `src/features/<feature>/`.
- Keep browser headers, CSP, HSTS ownership, cookies, and production proxy
  behavior aligned with [docs/SECURITY.md](docs/SECURITY.md).
- Do not log credentials, one-time secrets, private payloads, or raw provider
  errors.

## Authority Map

| Concern | Read |
|---|---|
| Adding a feature | [docs/ADDING_FEATURE.md](docs/ADDING_FEATURE.md) |
| Authentication | [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Mock BFF replacement | [docs/MOCK_BFF.md](docs/MOCK_BFF.md) |
| Browser security | [docs/SECURITY.md](docs/SECURITY.md) |
| Route performance | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) |
| Optional starter UI | The matching file under `docs/` and `../../packages/contracts/` |

Open the matching optional-starter document only when changing that feature.

## Verification

Use the narrowest proof while iterating:

```bash
# One test or contract
corepack pnpm vitest run <test-file>

# Static checks
corepack pnpm type-check
corepack pnpm lint

# All unit/component tests
corepack pnpm test -- --run

# Production graph and route budgets
corepack pnpm build

# Full Web tier
bash ../../.agents/skills/core/verification-before-completion/scripts/run-tiers.sh 2
```

Use browser verification for changed user workflows and visual behavior. Use
bundle analysis only for a performance claim or shared client dependency
change. Use `cd .. && make check` only for a cross-cutting change or explicit
release, not for every Web commit or push.

## Do Not

- Import API source into Web.
- Put feature business logic in `src/http/`, generic stores, or UI primitives.
- Add product-specific behavior to the scaffold default.
- Treat mock data or devtools as production behavior.
- Add dependencies, utilities, or client components without checking whether
  the existing seam already solves the problem.
