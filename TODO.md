# TODO

Handoff notes for the team continuing FastBuild development (updated 2026-11-24).

## State At Handoff

- All work is on GitHub. `main` is at the merge of #120. Latest release tag: `v0.26.0`; everything
  below is unreleased.
- #119 moved the deployable units: `api/`, `web/`, `admin/` are now `apps/api`, `apps/web`,
  `apps/admin`, and `contracts/` is `packages/contracts`. The Go module path is unchanged, and each
  unit still has its own lockfile and pnpm policies. Downstream steps are in `UPGRADING.md`.
- #119 also replaced the "never share source" rule. Apps never import each other; packages never
  depend on apps, form no cycles, and stay platform-neutral; the Go API reads only
  `packages/contracts`; every app stays removable. See `AGENTS.md` and
  `docs/ARCHITECTURE.md#apps-and-packages`.
- CI is lean by default (#119): pull requests run the changed areas; merges to `main` run nothing
  extra; end-to-end and plugins run weekly and on demand; containers and performance run on
  demand. See `docs/CI.md`.
- #120 moved the Admin Console primitives from Radix to `@ui-sdk/react` `1.0.0-beta.14` (a beta).
- No uncommitted changes, stashes, or unpushed branches were left behind.

## Set Up A Machine

Requirements: Docker with Compose v2, Go 1.26.10+, Node.js 22.12+ with Corepack.
The `.devcontainer` installs all of them.

```bash
git clone git@github.com:fastagi/fastbuild.git
cd fastbuild
make dev
```

`make dev` starts PostgreSQL, migrates and seeds it, and runs the API, Web, and Admin Console.
Seeded accounts (password `secret`): `admin@example.com` is a platform operator,
`user@example.com` is a regular user. If a port is taken, set `FASTBUILD_DB_PORT`,
`FASTBUILD_API_PORT`, `FASTBUILD_WEB_PORT`, or `FASTBUILD_ADMIN_PORT`.

## Open Items

### Check first

- [ ] #119 and #120 merged on local verification (`make check`, an initialized project with the
      `tags` plugin, and `make dev` sign-in for Web and Admin). Run **CI** and **End-to-End** on
      `main` from the Actions tab once and fix anything they find.
- [ ] Confirm the next **Dependency Security** run on `main` is green.
- [ ] Dependabot runs that failed on 2026-11-24 with `/web/package.json not found` or `/api` were
      refreshing pull requests opened before the move; they are expected once and need no action.

### From #113 (known limits)

- [ ] Render screenshot baselines on CI (End-to-End workflow, `update_snapshots` input) and
      commit them; screenshot comparison has not run against real baselines yet.
- [ ] Web `/console/<unknown>` renders the 404 page with HTTP 200 because `console/loading.tsx`
      streams first.
- [ ] Registration still requires ticking agreement when no `legalLinks` are configured.

### Admin Console

- [ ] Move `@ui-sdk/react` from `1.0.0-beta.14` to a stable release when one passes the
      1440-minute release-age policy, and rerun the Admin checks.
- [ ] Send a mid-session 401 back to `/login` from one place (route error boundaries already
      exist in `src/app/router.ts`; the redirect only happens in the `/console` guard today).
- [ ] Split `src/i18n/resources.ts` into per-feature resource files.
- [ ] Use route `loader`s with `ensureQueryData` on key list routes so hover preload also
      fetches data.

### Dependabot pull requests

- [ ] #121 and #122: `go.opentelemetry.io/otel` trace and sdk 1.46.0 → 1.47.0 in `/apps/api`.
- [ ] #94 `deps(api)`: Go minor and patch group (11 updates); opened before the move, so let
      Dependabot recreate it for `/apps/api` if it no longer applies.
- [ ] #29 `actions/setup-go` 6.4.0 → 7.0.0 (major).
- [ ] #5 `actions/setup-node` 6.4.0 → 7.0.0 (major).
- [ ] #21 `actions/checkout` 5.0.1 → 7.0.1 (major; has merge conflicts, recreate with
      `@dependabot recreate`).

### Client platforms and shared packages (maintainer plan, not scaffold docs)

The scaffold documents only what ships, so this plan lives here. Phase 1 (the layout) is done in
#119. Run the phases in order; native-client authentication lands before either native app.

- [ ] **Rules and base:** root pnpm workspace with a version catalog and one release-age policy;
      an import-direction governance check (app-to-app imports, platform APIs in neutral
      packages); `packages/config` (tsconfig, ESLint, formatter) and `packages/tokens` (design
      tokens as CSS variables and a React Native theme).
- [ ] **Shared logic:** `packages/api-client` generated from the OpenAPI contract (types, client,
      Zod schemas) and `packages/core` (error codes, i18n messages, validation); Web and Admin
      adopt both. Update the `contract-evolution` skill once codegen exists.
- [ ] **Native-client auth:** a contract and `user` starter support for short-lived access tokens
      with rotating refresh tokens, stored in the OS keychain or `expo-secure-store`. Browser
      clients keep HttpOnly cookies.
- [ ] **Desktop:** `apps/desktop`, an Electron shell around a Vite SPA (context isolation, no Node
      integration in renderers).
- [ ] **Mobile:** `apps/mobile` with Expo Router and NativeWind on `api-client`, `core`, and
      `tokens`. CI runs type check, lint, and unit tests; store builds stay downstream. Check Expo
      with pnpm's isolated `node_modules` first.
- [ ] **Plugins and migration:** registry payloads use logical app paths (`files/{web}/...`)
      resolved by the CLI; add `project:migrate-layout`; plugins may ship desktop and mobile files.
- Not planned: a cross-platform UI layer shared by Web and mobile (react-native-web, Solito);
  they share logic, types, and tokens. `packages/ui-web` waits for real duplication between the
  Vite SPAs.
- Exit: a project keeps only `apps/api` plus `apps/mobile` (or `apps/desktop`), passes
  `make check`, and signs in through the native-client auth contract.

### Roadmap (see `docs/ROADMAP.md`)

- [ ] Stage 2: plugin authoring guide and `make:plugin` generator (the last open Stage 2 item).
- [ ] Stage 3: screenshot and accessibility checks for installed themes, and a single shared base
      token file for Web and Admin.
- [ ] Stage 4: official plugins, starting with `ai-gateway`, `knowledge-vector`, and
      `billing-stripe`.
