---
name: security-and-tenant-review
description: Audit multi-tenant isolation, RBAC permission boundaries, audit logging, and sensitive telemetry in a diff or module. Use for explicit security reviews, not routine edits.
---

# Security and Tenant Review

## Purpose

Verify that a diff, module, or endpoint preserves multi-tenant isolation,
authorization boundaries, audit trails, and secret/PII hygiene across API, Web,
and Admin surfaces.

## Scope & Inputs

1. Changed files or the target module/surface under review.
2. Owning contract under `packages/contracts/` when public HTTP behavior is touched.
3. Nearest `AGENTS.md` (`api/AGENTS.md`, `apps/web/AGENTS.md`, `apps/admin/AGENTS.md`).

## Review Checklist

### 1. Multi-Tenant & Organization Isolation

- Every tenant-scoped query filters by organization/tenant ID derived from verified
  session or request context, never solely from an unverified client payload.
- Cross-tenant resource lookups return `403`/`404` without leaking existence across
  organizations.
- Background jobs, webhooks, and cache keys include tenant/organization scoping.

### 2. Authentication & RBAC Boundaries

- Protected routes enforce auth and permission middleware/guards; no unauthenticated
  fallback or privilege escalation path.
- Admin and operator actions check explicit permissions and never rely on UI-only
  hiding.
- Auth contract invariants match `packages/contracts/`.

### 3. Audit Trail & Dangerous Actions

- State-changing administrative, permission, API key, and security-sensitive
  operations emit structured audit records with actor, tenant, target, and action.
- Destructive or irreversible actions require explicit confirmation and preserve
  accountability.

### 4. Sensitive Telemetry & Data Exposure

- Logs, traces, metrics, and error responses never leak credentials, tokens,
  API keys, session cookies, or raw secrets.
- Web/Admin clients never expose server-only secrets in client bundles or public env.

## Verification

Run the boundary guards from the repository root to verify automated invariants:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-auth-contract-boundary.py
PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-permission-boundary.py
PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-audit-boundary.py
PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-sensitive-telemetry.py
```

When Web or Admin files are in scope, also run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-web-security-boundary.py
```

## Output

Report findings ordered by severity (`P0`–`P2`) with file/line references,
exploit or leakage scenario, and minimal fix. If all checks pass with no findings,
state the verified scope and any residual manual review gaps.
