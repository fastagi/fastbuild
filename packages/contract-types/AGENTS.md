# AGENTS.md - @fastbuild/contract-types

TypeScript types generated from `packages/contracts/openapi.yaml`, shared by every client that
checks its requests and responses against the contract.

## Ownership

- `src/openapi.ts`: generated `paths`, `components`, and `operations` types. Never edit it.

## Rules

1. Regenerate with `make sync` (or `cd packages/contracts && corepack pnpm generate`) after a
   contract change; `make sync-check` fails when the committed file is stale.
2. Types only. This package exports no runtime value, so importers use `import type` and no
   bundler or container build needs to compile it.
3. Stay platform-neutral: no imports at all, in particular none from `react`, `next/*`,
   `electron`, or `react-native`.
4. An app adds this package to its `pnpm-workspace.yaml` and depends on it with `workspace:*`.
