---
name: web-testing
description: Write Vitest/Testing Library tests or verify a running FastBuild Web UI in a real browser. Use for unit, component, integration, or browser E2E verification.
---

# Web Testing (Unit, Component, and Browser)

## Purpose

Cover both deterministic Vitest/Testing Library tests under `src/test/` and
browser-driven verification of navigation, responsive layout, focus flow, and
runtime console health.

## Part 1: Unit & Component Tests (Vitest + Testing Library)

- **Location**: Place all tests under `src/test/` (never alongside source files);
  global setup lives in `src/test/setup.ts`.
- **Queries**: Prefer accessible queries (`getByRole`, `getByLabelText`); use
  `data-testid` only as a fallback.
- **Public Contracts**: Assert observable DOM, accessibility, and interaction
  contracts rather than private internals (for example,
  `src/test/button-composition.test.tsx` verifies composed controls preserve
  their semantic host, focus, loading, and disabled activation).
- **Isolation**: Create a fresh store per test (`createAuthStore(...)`); mock
  feature services via `vi.mock()` or MSW. Next.js Router is pre-mocked in
  `setup.ts`.
- **Naming**: `describe` names the component/function; `it` starts with `"should"`.

## Part 2: Browser Verification

Use a real browser when verifying behavior static tests cannot prove: navigation,
responsive layout, focus order, browser APIs, runtime console errors, and visuals.

1. Reuse an existing connected browser capability and running local server for
   this workspace before spawning a new process.
2. Confirm URL, viewport, locale, theme, and auth state; inspect DOM or screenshot
   before choosing selectors.
3. Exercise the shortest workflow reaching the changed behavior without fixed
   sleeps; vary desktop/mobile or locales only when the change can differ.
4. Report URL, viewport, workflow, and observed result; clean up temporary tabs
   and files. Never embed credentials in automation code or output.

For repeatable headless CLI/CI flows without a managed browser lifecycle:

```bash
python3 apps/web/.agents/skills/web-testing/scripts/with_server.py --help
```

Optional Python references live under `examples/`; read only when authoring a
persistent headless script.

## Verification

Run the narrowest check from `apps/web/`:

```bash
corepack pnpm vitest run <test-file>
corepack pnpm test -- --run
corepack pnpm type-check
```

## Related Skills

- `data-state-management`: mocking Query/Zustand state and error contracts.
- `accessibility-audit`: dedicated WCAG 2.2 AA audit.
- `systematic-debugging`: root-cause investigation for unexpected test failures.
