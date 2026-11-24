---
name: admin-feature-development
description: Build or modify a FastBuild Admin Console feature with TanStack Router, TanStack Query, permission guards, audit hooks, and dangerous-action confirmations.
---

# Admin Feature Development

## Purpose

Implement features in `apps/admin/` (static Vite + React 19 SPA) while preserving
strict static-asset boundaries, type-safe routing, permission gating, auditability,
and bundle budgets.

## Layering & Architecture

Follow the unidirectional flow:
`src/routes/ (thin file route) -> src/features/<feature>/ (page, components, hooks, services, types) -> src/http/client.ts -> HTTP API`.

- **Thin Routes**: Keep `src/routes/` declarative (layout, search/param validation,
  permission gate, feature page). Never edit `src/routeTree.gen.ts` manually.
- **Services & Schemas**: Feature services own fixed root-relative endpoint paths
  and validate security- or state-sensitive responses with Zod before caching.
  Components never call `fetch` directly.
- **State**: TanStack Query owns remote state (no automatic mutation retries);
  Zustand owns shared display preferences only. Never persist tokens or secrets
  in `localStorage`, `sessionStorage`, URLs, or `VITE_*`.
- **No Cross-App Imports**: Never import source from `apps/web/` or `api/`.
  Never introduce SSR, server functions, or Node runtime requirements.

## Permissions, Audit & Dangerous Actions

- **Permission Guards**: Gate routes and action controls using the Admin Console
  permission hooks/guards for UX clarity, knowing the Go API remains the
  authoritative enforcement boundary.
- **Audit Hooks**: Trigger and display audit metadata for administrative mutations
  (role grants, operator actions, tenant/webhook/setting changes) and preserve
  `request_id` in error diagnostics.
- **Dangerous Actions**: Require an explicit confirmation dialog (clearly stating
  target and irreversibility) for destructive or privilege-changing actions
  (delete, revoke, disable, role escalation). Keep loading/disabled states stable
  during submission to prevent duplicate mutations.
- **Copy & Styling**: Use `en-US` as canonical i18next schema, map backend
  `error_code` to localized copy, and reuse shadcn/ui primitives with obsidian
  and alabaster zero-chroma tokens.
- **Responsive Table & Control Hygiene**: Keep status badges `whitespace-nowrap`,
  constrain long request/ID columns (`max-w-* truncate`) so tablet viewports never
  clip trailing badges, and suppress native `<select>` arrows (`appearance-none`)
  when rendering a custom chevron.
- **Session Expiry**: Rely on the centralized mid-session 401 handler in
  `src/app/query-client.ts` + `src/app/router.ts` rather than duplicating
  per-page redirect effects.

## Verification

Run focused checks from `apps/admin/` and the architecture guard from repo root:

```bash
node apps/admin/scripts/check-architecture.mjs
cd apps/admin && corepack pnpm type-check
cd apps/admin && corepack pnpm lint
cd apps/admin && corepack pnpm vitest run <test-file>
cd apps/admin && corepack pnpm build
```

## Related Skills

- `contract-evolution`: when public HTTP contracts under `packages/contracts/` change.
- `security-and-tenant-review`: for explicit RBAC, tenant isolation, or audit review.
