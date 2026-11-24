# AGENTS.md - @fastbuild/config

Shared TypeScript and Prettier presets consumed by FastBuild packages and apps.

## Ownership

- `tsconfig.base.json`: Strict ESM/Bundler TypeScript defaults for platform-neutral packages.
- `tsconfig.react.json`: React 19 (`react-jsx`) + DOM extension of `tsconfig.base.json`.
- `prettier.config.mjs`: Canonical formatting preset aligned with Web and Admin.

## Rules

1. Keep presets zero-dependency and platform-neutral.
2. Never import from `apps/*` or other workspace packages.
3. Preserve strict compiler flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
