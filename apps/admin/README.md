# FastBuild Admin

`admin/` is FastBuild's project management system. It owns operator and
administrator workflows and is implemented as a lightweight Vite SPA. It
produces static assets that can be uploaded directly to OSS/S3-compatible
object storage and served through a CDN, or served by the hardened nginx image
built from `Dockerfile`.

It complements the customer-facing `web/` application and is never imported by
it. Projects may deploy either application or both. They follow the same
feature-first and HTTP-contract architecture while keeping independent source,
dependencies, builds, and deployment policy.

## Role And Boundaries

| This application owns | This application does not own |
| --- | --- |
| Project operations, administration, audit, and configuration screens | Public marketing and customer product journeys |
| Operator-focused navigation, tables, forms, and status views | API domain rules or PostgreSQL persistence |
| Static browser assets for OSS/S3-compatible storage and CDN delivery | SSR, Server Components, or a production Node.js runtime |
| Admin UI state and contract-backed HTTP services | Browser storage of bearer tokens, API keys, or secrets |

`Admin` is the stable project and directory name. `SPA` describes only its
browser implementation and deployment model; it is not the product name.

## Stack

| Concern          | Choice                                                             |
| ---------------- | ------------------------------------------------------------------ |
| Build            | Vite 8                                                             |
| UI               | React 19 + TypeScript                                              |
| Routing          | TanStack Router with generated file routes and automatic splitting |
| Server state     | TanStack Query                                                     |
| Browser UI state | Zustand                                                            |
| Validation       | Zod                                                                |
| Styling          | Tailwind CSS 4 + shadcn/ui New York theme + Lucide                 |
| Localization     | i18next + react-i18next                                            |
| Tests            | Vitest + Testing Library                                           |
| Transport        | Native Fetch with FastBuild envelope/error normalization                |

TanStack Start is intentionally not used. It is a full-stack framework for SSR,
server functions, API routes, and client/server builds. This surface knows that
it needs none of those capabilities, so TanStack Router keeps the type-safe
routing benefits without introducing another production runtime.

## Quick Start

```bash
corepack pnpm install
cp .env.example .env.local
corepack pnpm dev
```

The development server listens on `http://127.0.0.1:4173` and proxies `/api`
to `http://127.0.0.1:8025` by default.

Build the deployable artifact:

```bash
corepack pnpm build
```

Deploy it one of two ways:

- **Container:** `docker build -t fastbuild-admin --build-arg VITE_OPTIONAL_FEATURES=operator .`
  produces a non-root nginx image that serves the SPA with deep-link fallback and proxies
  same-origin `/api/*` to the API. Kubernetes wiring lives in
  [`../deploy/kubernetes/base/admin.yaml`](../deploy/kubernetes/base/admin.yaml).
- **Object storage + CDN:** upload `dist/` and configure the CDN to route `/api/*` to the API
  with the prefix stripped, serve existing assets, rewrite unknown application routes to
  `index.html` with `200`, cache hashed assets immutably, and revalidate `index.html`.

Either way, the console's public origin must be in the API's `OPERATOR_ALLOWED_ORIGINS`. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete contract.

## Architecture

```text
TanStack route
  -> feature component
  -> feature hook
  -> feature service
  -> src/http/client.ts
  -> documented HTTP API
```

Feature-owned code lives under `src/features/<feature>/`. Routes remain thin,
TanStack Query owns remote state, Zustand owns shared browser-only UI state,
and Zod validates important successful responses before caching.

`system` and `preferences` are core features. The rest are optional and selected
at build time with `VITE_OPTIONAL_FEATURES`:

| Value | Adds | API starter required |
| --- | --- | --- |
| `operator` | Operator sign-in, users, audit log, app settings, system status | `operator` (`setting` for app settings) |
| `organization` | Organization directory and members | `operator`, `organization` |
| `webhook` | Webhook endpoints, deliveries, attempts, and replay on the organization page | `operator`, `organization`, `webhook` |
| `notification` | Notification delivery ledger | `operator`, `notification` |

These are operator support views, not tenant self-service; that stays in the
Next.js Web application. New screens are built against their contract rather
than copied from Next.js.

The console uses the official shadcn/ui Sidebar composition with an inset
content surface, icon-collapse mode on desktop, and a Sheet-backed navigation
drawer on mobile. Theme and sidebar preferences remain browser-only UI state,
so the static shell does not require cookies or a frontend server.

## Internationalization

The Admin Console uses the same public locale identifiers as Web and the settings
contract: `en-US` and `zh-Hans`. i18next resolves a stored display preference,
browser language preferences, then `VITE_DEFAULT_LOCALE`. Locale choice is
browser-only display state and contains no account or credential data.

Read [docs/INTERNATIONALIZATION.md](docs/INTERNATIONALIZATION.md) before adding
messages, locales, localized formatting, or locale persistence.

## Authentication Boundary

Static hosting removes the Next.js BFF. It does not make browser credential
storage safe. Protected production applications should route same-origin
`/api` requests to a gateway or Go browser adapter that owns HttpOnly cookies,
CSRF/Origin checks, and fixed upstream operations. Never persist FastBuild bearer
session tokens or API keys in browser storage.

The optional `operator` API starter is the shipped Go browser adapter: it sets an
HttpOnly operator session cookie and enforces Origin and CSRF. Read
[docs/SECURITY.md](docs/SECURITY.md) before changing sign-in or adding protected
routes.

## Verification

```bash
corepack pnpm type-check
corepack pnpm lint
corepack pnpm test -- --run
corepack pnpm build
```

The production build fails if it emits a server bundle or source map, or if its
compressed JavaScript/CSS exceeds the reviewed budgets.
