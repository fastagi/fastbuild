# AGENTS.md - @fastbuild/core

Platform-neutral core utilities shared by Web, Admin, Desktop, and Mobile.

## Ownership

- `src/errors.ts`: `ApiError`, `ERROR_CODES`, `CLIENT_ERROR_CODES`, `isUnauthorizedError`, `normalizeApiError`.
- `src/validation.ts`: Contract-aligned email, password, username, and slug validators.
- `src/i18n.ts`: Shared auth/common/status i18n keys and `errorCodeToMessageKey`.

## Rules

1. Stay 100% platform-neutral: never import `react`, `react-dom`, `next/*`, `electron`, or `react-native`.
2. Keep `ERROR_CODES` aligned with `packages/contracts/README.md` and `openapi.yaml`.
3. Run `node --test src/core.test.ts` after edits.
