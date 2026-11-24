---
name: web-perf
description: Measure and fix Next.js/React performance regressions. Use for bundle budgets, LCP/INP/CLS lab evidence, waterfalls, serialization, or render churn, not routine JSX edits.
---

# Web Performance & React Patterns

## Purpose

Measure before optimizing, then route the proven bottleneck to the smallest
React 19 / Next.js 16 fix. Keep three evidence classes explicit: deterministic route
bundle diagnostics, repeatable synthetic lab medians, and field Web Vitals (p75).

## Field Targets (Core Web Vitals "Good")

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | <= 2.5s |
| INP (Interaction to Next Paint) | <= 200ms |
| CLS (Cumulative Layout Shift) | <= 0.1 |

## Audit Workflow

1. **Measure**: Read [`../../../docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md).
   Run a clean `corepack pnpm build` (records route bytes/chunks) and
   `corepack pnpm bundle:analyze` when a dependency is non-obvious. Run Lighthouse
   at least 3 times with identical settings and report the median.
2. **Identify**: Isolate the biggest contributor (render-blocking assets, client
   waterfalls, large hydration boundary, long tasks > 50ms, unsized media/fonts).
3. **Fix**: Apply one targeted fix at a time using the rule routing table below.
4. **Verify**: Re-run the exact same build budget and Lighthouse protocol; confirm
   the targeted metric improved without regressing other metrics.

## Focused React/Next.js Rule Routing

Read only the one or two matching files under `references/react-patterns/` (do
not preload the whole catalog; use [`references/full-guide.md`](references/full-guide.md)
only for a multi-category audit):

| Problem | Read |
|---|---|
| Sequential async waterfalls | `references/react-patterns/async-*.md` |
| Bundle growth or heavy optional UI | `references/react-patterns/bundle-*.md` |
| Server caching or serialized props | `references/react-patterns/server-*.md` |
| Client fetching or global listeners | `references/react-patterns/client-*.md` |
| Re-render churn | `references/react-patterns/rerender-*.md` |
| Long-list or hydration rendering | `references/react-patterns/rendering-*.md` |
| Proven hot JavaScript loop | `references/react-patterns/js-*.md` |
| Stable callback edge case | `references/react-patterns/advanced-*.md` |

## Guardrails

- Prefer Server Components, parallel fetching, and smaller client boundaries
  before speculative `useMemo` or `dynamic()` wrappers.
- Never lazy-load above-the-fold LCP images; use `<Image priority />` with `sizes`.
- Do not add cross-request caches without lifecycle, privacy, and size bounds.
- A code-pattern change is not a performance win until measured evidence moves.

## Verification

Run from `apps/web/`:

```bash
corepack pnpm build
corepack pnpm bundle:check
```

Report route bytes/budget headroom, median lab delta, field p75 status, and any
reverted experiments.

## Related Skills

- `frontend-design`: visual changes constrained by a route budget.
- `accessibility-audit`: dedicated WCAG review.
