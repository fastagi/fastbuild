# AGENTS.md - @fastbuild/ui

Shared React 19 + Tailwind 4 web UI primitives reusable by Web, Admin, and Desktop.

## Ownership

- `src/cn.ts`: Class name merger (`clsx` + `tailwind-merge`).
- `src/brand-mark.tsx`: `FastBuildMark` and `BrandMark` consuming `@fastbuild/tokens`.
- Core primitives: `src/button.tsx`, `src/card.tsx`, `src/input.tsx`, `src/textarea.tsx`, `src/label.tsx`, `src/badge.tsx`, `src/alert.tsx`, `src/separator.tsx`, `src/skeleton.tsx`, `src/status-dot.tsx`, `src/section-header.tsx`, `src/empty-state.tsx`, `src/stat-card.tsx`, `src/table.tsx`.
- Interactive & Auth primitives: `src/tabs.tsx`, `src/switch.tsx`, `src/dialog.tsx`, `src/mfa-code-input.tsx`, `src/recovery-codes-grid.tsx`.

## Rules

1. Keep primitives framework-agnostic across web runtimes: never import `next/*`, `@tanstack/react-router`, `electron`, or `react-native`.
2. Never import from `apps/*`.
3. Style exclusively with semantic token classes (`bg-primary`, `text-muted-foreground`, `border-border`) so light/dark themes work identically everywhere.
