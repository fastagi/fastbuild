# Admin Console Deployment

The Admin Console is static browser code. Production needs exactly two things from the host:

1. serve `dist/` with an SPA fallback, correct cache headers, and the security headers below;
2. route same-origin `/api/*` to the Go API with the `/api` prefix removed, so
   `/api/v1/operator/session` reaches `/v1/operator/session` and the operator session cookie stays
   first-party.

Choose one hosting option:

| Option                                                   | Use when                                                   | Owns headers and `/api` routing             |
| -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| [Container](#option-a-container)                         | The API already runs on Kubernetes or a container platform | `admin/Dockerfile` (nginx), configured here |
| [Object storage + CDN](#option-b-object-storage-and-cdn) | You want no admin runtime at all                           | Your CDN rules                              |

Both options share the build contract, the API configuration, and the release rules.

## Build Contract

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

`dist/` is the complete production artifact: `index.html`, content-hashed files under `assets/`,
and a build manifest under `.vite/`. It contains no server runtime, source maps, secrets, or runtime
environment loader. `pnpm build` fails otherwise.

`VITE_*` values are public and compiled into the artifact, validated by `src/config/env.ts`. Build
once per public configuration:

| Variable                      | Default     | Production guidance                                                                              |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `VITE_APP_NAME`               | `FastBuild` | Display name                                                                                     |
| `VITE_API_BASE_URL`           | `/api`      | Keep `/api` (same origin). An absolute HTTPS URL needs CORS and a CSP `connect-src` change       |
| `VITE_API_TIMEOUT_MS`         | `8000`      | 1000-30000                                                                                       |
| `VITE_API_MAX_RESPONSE_BYTES` | `1048576`   | 16384-5242880                                                                                    |
| `VITE_DEFAULT_LOCALE`         | `en-US`     | `en-US` or `zh-Hans`                                                                             |
| `VITE_OPTIONAL_FEATURES`      | empty       | `operator` plus `organization`, `webhook`, `notification` matching the API's `OPTIONAL_STARTERS` |
| `VITE_BASE_PATH`              | `/`         | CDN subpath deployments only; the container always serves `/`                                    |

Never put credentials in `VITE_*`; see [SECURITY.md](SECURITY.md).

## API Configuration

With `VITE_OPTIONAL_FEATURES` containing `operator`, the API must select the `operator` starter and
trust the console's public origin ([`contracts/OPERATORS.md`](../../contracts/OPERATORS.md)):

| API setting                | Value                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPTIONAL_STARTERS`        | Includes `operator` and every starter named in `VITE_OPTIONAL_FEATURES`                                                                                        |
| `OPERATOR_ALLOWED_ORIGINS` | The exact public console origin, for example `https://admin.example.com`: scheme, host, and non-default port, no path or trailing slash, `https` in production |
| `CORS_ALLOW_ORIGINS`       | Unchanged for same-origin `/api`; it never grants operator access                                                                                              |
| `SERVER_TRUSTED_PROXIES`   | The CIDRs of the hop that connects to the API (admin pods or CDN egress), so rate limits and audit see the client address                                      |

The API compares the browser's `Origin` header with `OPERATOR_ALLOWED_ORIGINS` and requires
`X-CSRF-Token` on unsafe requests. Whatever sits in front of the API must forward `Origin`,
`Cookie`, `X-CSRF-Token`, and `Set-Cookie` unchanged. In production the cookie is
`__Host-fastbuild_operator`, which browsers accept only over HTTPS on the exact host, so the console
must be served over TLS.

## Option A: Container

`admin/Dockerfile` builds the console with the reviewed Node base and serves it from a digest-pinned
`nginxinc/nginx-unprivileged` slim image copied into `scratch` without the `apk` binary. It runs as UID 101 on
port 8080 with a read-only root filesystem; only `/tmp` must be writable.

```bash
docker build -t fastbuild-admin \
  --build-arg VITE_OPTIONAL_FEATURES=operator \
  admin
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp:uid=101,gid=101 \
  -e ADMIN_API_UPSTREAM=http://host.docker.internal:8025 \
  fastbuild-admin
```

The `VITE_*` variables in the table above are accepted as `--build-arg`. Runtime environment:

| Variable                | Default                     | Meaning                                                                       |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `ADMIN_API_UPSTREAM`    | `http://fastbuild-api:8025` | API base URL (scheme, host, port; no path). It must resolve when nginx starts |
| `ADMIN_CSP_CONNECT_SRC` | `'self'`                    | CSP `connect-src`; add the API origin only if `VITE_API_BASE_URL` is absolute |

The image serves:

| Path                 | Behavior                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/assets/*`          | Existing file with `Cache-Control: public, max-age=31536000, immutable`; a missing asset is `404`                                    |
| `/api/*`             | Proxied to `ADMIN_API_UPSTREAM` with `/api` removed; `Origin`, cookies, and CSRF headers pass through; `X-Forwarded-For` is appended |
| `/healthz`           | `200 ok` from nginx; it does not call the API                                                                                        |
| Dotfiles, `/.vite/*` | `404`; the build manifest is removed from the image                                                                                  |
| Anything else        | Existing file, otherwise `index.html` with `200`; both `Cache-Control: no-cache`                                                     |

Every static response carries the [security headers](#security-headers). Kubernetes wiring is in
[`deploy/kubernetes/base/admin.yaml`](../../deploy/kubernetes/base/admin.yaml); the example overlay
selects the `operator` starter and sets `OPERATOR_ALLOWED_ORIGINS`. Route the whole admin host to
the `fastbuild-admin` Service and terminate TLS at the ingress. Ingress should overwrite
`X-Real-IP` with the client address, as it does for Web.

Container verification:

```bash
bash scripts/verify-container.sh fastbuild-admin:container-check
```

## Option B: Object Storage And CDN

Upload `dist/` (without `.vite/`) and configure rules in this order:

1. **API.** Route `/api/*` to the Go API origin, strip the `/api` prefix, disable caching, and
   forward `Origin`, `Cookie`, `X-CSRF-Token`, and `Set-Cookie`.
2. **Existing objects.** Serve an existing object exactly. A missing `/assets/*` object must return
   `404`, not `index.html`.
3. **SPA fallback.** Rewrite every other missing path to `/index.html` with HTTP `200`.

The fallback must be an internal rewrite, not a `301`/`302` redirect, so a request for
`/console/preferences` keeps its URL while TanStack Router renders the route. Examples:

```nginx
# nginx-style edge
location ^~ /assets/ { try_files $uri =404; }
location / { try_files $uri /index.html; }
```

```text
# Rule-based CDN (Cloudflare, CloudFront Function, Alibaba Cloud/Tencent Cloud CDN)
if path starts with /api/        -> origin: API, path: strip "/api", cache: bypass
else if object exists            -> serve object
else if path starts with /assets/ -> 404
else                             -> rewrite to /index.html (status 200)
```

Bucket "error document = index.html" settings usually return status `404` with the HTML; use a
real rewrite rule instead.

When deploying under a subpath, set `VITE_BASE_PATH=/subpath/` before the build and scope every
rule to that path.

If the CDN cannot route `/api/*` to the API, a separate API origin is possible only as described in
[SECURITY.md](SECURITY.md#cross-origin-apis): build with an absolute `VITE_API_BASE_URL`, add that
origin to CSP `connect-src`, and configure exact credentialed CORS. The operator cookie is then a
third-party cookie, which many browsers block; same-origin routing is strongly preferred.

## Cache Policy

| Object                                       | Policy                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| `index.html` and every SPA fallback response | `Cache-Control: no-cache` (revalidate)               |
| `/assets/<content-hash>.*`                   | `Cache-Control: public, max-age=31536000, immutable` |
| `/api/*`                                     | Not cached at the edge; the API owns its headers     |
| `.vite/manifest.json`                        | Build evidence; keep out of the public bucket        |

## Security Headers

The container sends these on every static response; a CDN must add the same:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
```

`style-src` allows inline styles because the toast library injects its stylesheet at runtime;
scripts remain `'self'` only. Add explicit API origins to `connect-src` only when same-origin
routing is impossible. Extend HSTS (`includeSubDomains`, preload) at the domain level only after
reviewing every subdomain.

## Release And Rollback

1. Build from a frozen lockfile; `pnpm build` runs the static-output and bundle-budget checks.
2. Container: push by digest and update the kustomization `images` entry. CDN: upload assets to a
   versioned prefix or release bucket before `index.html`, so cached HTML never references assets
   that are not available yet.
3. Smoke-test a deep link (for example `/console`), one hashed asset, and `/api/v1/operator/session`.
4. Switch traffic atomically (rollout or CDN origin/version pointer).
5. Purge or revalidate `index.html`; do not purge immutable hashed assets.
6. Keep prior hashed assets during the rollback window; roll back by restoring the previous image
   digest or HTML/version pointer.

Keep the build manifest and commit SHA with the deployment evidence even though the public host
does not serve the manifest.
