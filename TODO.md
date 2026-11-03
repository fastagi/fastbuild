# TODO

Handoff notes for continuing FastBuild development on another machine (written 2026-11-03).

## State At Handoff

- All work is on GitHub. `main` is at the merge of #113 (UI design batch 1 and browser coverage).
  Latest release tag: `v0.26.0`.
- No uncommitted changes, stashes, or unpushed branches were left behind. Local-only branches
  (`ui-admin-*`, `ui-web-*`, `test/e2e-coverage`) were already contained in #113.
- Remote branches merged into `main` can be deleted when convenient: `ci/fewer-runs`,
  `claude/*`, `docs/roadmap-status`, `fix/plugin-probe-flake`, `refactor/admin-shared-data-table`,
  `release/v0.26.0`, `ui-design-batch-1`.

## Set Up The New Machine

Requirements: Docker with Compose v2, Go 1.26.10+, Node.js 22.12+ with Corepack.
The `.devcontainer` installs all of them.

```bash
git clone git@github.com:fastagi/fastbuild.git
cd fastbuild
make dev
```

`make dev` starts PostgreSQL, migrates and seeds it, and runs the API, Web, and Admin Console.
Seeded operator: `admin@example.com` / `secret`.

## Open Items

### Check first

- [ ] Confirm the next **Dependency Security** run on `main` is green. The 2026-11-02 run failed
      on OSV advisories (glob, minimatch, seroval, follow-redirects). #113 patched them and its
      OSV scan passed, but `main` has not been rescanned yet.

### From #113 (known limits)

- [ ] Render screenshot baselines on CI (End-to-End workflow, `update_snapshots` input) and
      commit them; screenshot comparison has not run against real baselines yet.
- [ ] Web `/console/<unknown>` renders the 404 page with HTTP 200 because `console/loading.tsx`
      streams first.
- [ ] Registration still requires ticking agreement when no `legalLinks` are configured.

### Dependabot pull requests

- [ ] #94 `deps(api)`: Go minor and patch group (11 updates).
- [ ] #29 `actions/setup-go` 6.4.0 → 7.0.0 (major).
- [ ] #5 `actions/setup-node` 6.4.0 → 7.0.0 (major).
- [ ] #21 `actions/checkout` 5.0.1 → 7.0.1 (major; has merge conflicts, recreate with
      `@dependabot recreate`).

### Admin Console follow-ups

- [ ] Send a mid-session 401 back to `/login` from one place (route error boundaries already
      exist in `src/app/router.ts`; the redirect only happens in the `/console` guard today).
- [ ] Split `src/i18n/resources.ts` into per-feature resource files.
- [ ] Use route `loader`s with `ensureQueryData` on key list routes so hover preload also
      fetches data.

### Roadmap (see `docs/ROADMAP.md`)

- [ ] Stage 2: plugin authoring guide and `make:plugin` generator (the last open Stage 2 item).
- [ ] Stage 3: screenshot and accessibility checks for installed themes, and a single shared base
      token file for Web and Admin.
- [ ] Stage 4: official plugins, starting with `ai-gateway`, `knowledge-vector`, and
      `billing-stripe`.
