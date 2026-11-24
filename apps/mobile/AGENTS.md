# AGENTS.md - FastBuild Mobile

Rules for the Expo Router + React Native + NativeWind application under `apps/mobile/`.

## Scope

`apps/mobile/` is the native iOS/Android client for FastBuild. It uses Expo Router,
React Native, NativeWind, TypeScript, `expo-secure-store`, `react-native-svg`,
and Vitest (headless Node unit tests).

## Structure

```text
app/                    Expo Router layouts and screens (login, (tabs)/index, (tabs)/settings)
src/auth/               SecureTokenStore, native bearer session logic, and AuthProvider
src/components/ui/      shadcn-aligned native primitives (BrandMark, Button, Card, Input, Badge, StatusDot)
src/config/             API base URL resolution and normalization
src/theme/              Theme helpers and ThemeProvider backed by @fastbuild/tokens
```

## Shared Packages & Import Boundaries

- Consume `@fastbuild/tokens` (`getRnTheme`, `rnDarkTheme`, `rnLightTheme`, `BRAND_MARK_RECTS`,
  `BRAND_MARK_VIEWBOX`, `radii`, `spacing`) for all colors and the Modular Stack "F" brand mark.
- Consume `@fastbuild/core` (`ApiError`, `ERROR_CODES`, `validateEmail`, `validateUsername`,
  `validatePassword`, `I18N_KEYS`, `DEFAULT_MESSAGES`, `errorCodeToMessageKey`) for validation
  and error mapping. Never render raw backend error text directly.
- Consume `@fastbuild/api-client` (`createFastBuildClient`) for all HTTP calls.
- Never import from `apps/web/`, `apps/admin/`, `apps/desktop/`, `api/`, or `@fastbuild/ui` (web DOM).
- Keep `packages/tokens`, `packages/core`, and `packages/api-client` free of `react-native` imports.

## Native Auth Rules

- Always configure `createFastBuildClient` in `authMode: 'bearer'` with `SecureTokenStore`.
- Target `/v1/auth/native/login`, `/v1/auth/native/refresh`, and `/v1/auth/native/logout`.
- Never persist access or refresh tokens in unencrypted storage (`AsyncStorage`, plain files, logs).
- Keep `SecureTokenStore` storage injectable via `SecureStorageAdapter` so unit tests run in Node
  without a simulator.

## Verification

```bash
cd apps/mobile && corepack pnpm type-check
cd apps/mobile && corepack pnpm test
python3 tools/guards/check-import-direction.py
```
