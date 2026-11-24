---
name: data-state-management
description: Implement Web server state, client state, and API error handling. Use for TanStack Query, Zustand, service-hook-type flow, ApiErrorCode, ClientErrorCode, or auth failure states.
---

# Data, State Management, and API Error Handling

## Purpose

Keep Web data flow layered (types -> stateless services -> TanStack Query hooks ->
UI) and enforce canonical backend/client error contracts without leaking state
across requests or duplicating error surfaces.

## State Categories

- **Auth State**: `src/features/auth/store/auth-store.ts` (provider-owned Zustand
  vanilla store, never persisted in browser storage). Keep `unauthenticated`,
  `forbidden`, and `unavailable` distinct; never collapse transport failure into
  logout state.
- **UI State**: `src/store/ui-store.ts` (Zustand) for shared temporary UI state.
- **Server State**: TanStack Query for all API-driven data; one `QueryClient` per
  `QueryProvider`, never a module-level singleton across requests.

## Service-Hook-Type Pattern

1. **Types (`src/types/*.ts` or feature `types/`)**: strictly type domain models,
   DTOs, and query schemas.
2. **Stateless Services (`src/services/*.ts` or feature `services/`)**: pure
   wrappers around `request` / `fileRequest` from `src/http/request.ts`; no hooks
   or state.
3. **Hooks (`src/hooks/*.ts` or feature `hooks/`)**: TanStack Query hooks with
   constant key factories, optimistic updates with rollback + invalidation on
   settled, and `meta: LOCAL_ERROR_HANDLING_META` whenever the hook/form owns its
   error UI (preventing duplicate global toasts).
4. **Write Retry Safety**: Mutations do not retry by default; opt in only with
   contract idempotency evidence.

## Canonical API Error Contract

All backend/mock error responses follow:
`{ "code": 404, "error_code": "COMMON.NOT_FOUND", "message": "...", "request_id": "req_123" }`.

- Branch on `ApiErrorCode` (`COMMON.*`, `AUTH.*`, `USER.*`, `API_KEY.*`, etc.),
  never on `message`.
- Browser-owned transport/timeout/parse failures use `ClientErrorCode` (`CLIENT.*`,
  including `CLIENT.INVALID_RESPONSE`).
- Mock BFF handlers call `guardMockBffRoute()` first and `guardSameOriginMutation(request)`
  on unsafe methods. Return `400 COMMON.INVALID_INPUT` for malformed JSON and
  `422 COMMON.VALIDATION_FAILED` with `errors` for field validation.
- Map `error_code` and `fieldErrors` to reviewed local i18n copy; never render raw
  `ApiError.message` on auth or sensitive forms.

## Auth Resolution & Mutations

- `/auth/me` bypasses React Query; `AuthProvider` / `AuthGuard` own it.
  - `401` / `AUTH.UNAUTHORIZED` -> `unauthenticated` (redirect to login).
  - `403` / `AUTH.FORBIDDEN` / `AUTH.ACCOUNT_DISABLED` -> `forbidden` (block without loop).
  - `CLIENT.*`, `429`, `5xx`, malformed JSON -> `unavailable` (keep unresolved, offer retry).
- Receive auth payloads as `unknown` and validate with endpoint guards in
  `auth-response.ts`; malformed `2xx` becomes `CLIENT.INVALID_RESPONSE`.
- Logout `401` is idempotent completion; preserve local state on unknown availability
  in client-owned modes.

## Verification

Run focused contract and state tests from `apps/web/`:

```bash
corepack pnpm vitest run \
  src/test/error-code-vocabulary.test.ts \
  src/test/mock-bff-route-contract.test.ts
corepack pnpm type-check
```

## Related Skills

- `web-testing`: mocking services, stores, and assertions in tests.
- `i18n-handler`: localized error-copy mappings.
- `web-perf`: memoization or request-waterfall optimization.
