# AGENTS.md - @fastbuild/api-client

Platform-neutral typed HTTP client for FastBuild Web, Admin, Desktop, and Mobile surfaces.

## Ownership

- `src/client.ts`: `createFastBuildClient` supporting `cookie` mode (with CSRF recovery) and `bearer` mode (with pluggable `TokenStore` and single-flight rotating refresh).
- `src/types.ts`: Shared envelope, pagination, health, auth, user, and system DTOs aligned with `packages/contracts/openapi.yaml`.

## Rules

1. Stay 100% platform-neutral: use only Web-standard `fetch`, `Headers`, `AbortController`, and `globalThis` timers; never import `react-dom`, `next/*`, `electron`, or `react-native`.
2. Normalize all non-2xx and transport failures via `@fastbuild/core` `ApiError`.
3. Never persist bearer tokens in browser `localStorage`; callers provide a secure `TokenStore` (Keychain/Keystore/SafeStorage) for native surfaces.
