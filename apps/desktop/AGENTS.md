# AGENTS.md - FastBuild Desktop

Rules for the Electron + Vite 8 + React 19 desktop application under `apps/desktop/`.

## Scope

`apps/desktop/` is an independently deployable desktop client sharing design tokens,
UI primitives, error/validation helpers, and the typed HTTP client from `packages/*`.
It never imports source from `apps/web/`, `apps/admin/`, `apps/mobile/`, or `api/`.

## Electron Security Rules

- Every `BrowserWindow` MUST enforce `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, and `allowRunningInsecureContent: false`.
- Never enable the deprecated `remote` module or expose raw `ipcRenderer` to the renderer.
- Expose only the minimal typed `window.fastbuildDesktop` bridge via `contextBridge` in
  `electron/preload.ts`.
- Block unexpected popups (`setWindowOpenHandler(() => ({ action: 'deny' }))`) and
  restrict `will-navigate` to `file:` or the configured local dev server origin.
- Persist auth tokens only in the main process using Electron `safeStorage`
  (`electron/token-store.ts`, `0o600` encrypted file under `app.getPath('userData')`).
  When `safeStorage.isEncryptionAvailable()` is false (e.g. headless tests), fall back
  to in-memory storage—never write plaintext tokens to disk or `localStorage`.

## Shared Package & Auth Rules

- Import `@fastbuild/tokens/tokens.css` for the zero-chroma alabaster/obsidian theme,
  `@fastbuild/ui` for shared UI primitives, `@fastbuild/core` for validation and
  normalized `ApiError` handling, and `@fastbuild/api-client` for HTTP transport.
- Configure `@fastbuild/api-client` in `authMode: 'bearer'` targeting
  `/v1/auth/native/login`, `/v1/auth/native/refresh`, and `/v1/auth/native/logout`,
  backed by `DesktopTokenStore`.
- Only non-sensitive display preferences (theme mode, API base URL) may use
  `localStorage`.

## Structure

```text
electron/main.ts         hardened Electron main process & IPC handlers
electron/preload.ts      minimal typed contextBridge (`window.fastbuildDesktop`)
electron/token-store.ts  safeStorage encrypted token store + headless fallback
src/lib/                 DesktopTokenStore adapter, API client factory, theme sync
src/components/          Sign-in screen and authenticated workspace shell
src/styles/globals.css   Tailwind 4 + @fastbuild/tokens/tokens.css theme wiring
```

## Verification

```bash
cd apps/desktop && corepack pnpm install
cd apps/desktop && corepack pnpm type-check
cd apps/desktop && corepack pnpm lint
cd apps/desktop && corepack pnpm test -- --run
cd apps/desktop && corepack pnpm build
python3 tools/guards/check-import-direction.py
```
