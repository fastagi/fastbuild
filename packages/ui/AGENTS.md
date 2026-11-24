# AGENTS.md - @fastbuild/ui

Shared React 19 + Tailwind 4 web UI primitives reusable by Web, Admin, and Desktop.

## Ownership

- `src/cn.ts`: Class name merger (`clsx` + `tailwind-merge`).
- `src/brand-mark.tsx`: `FastBuildMark` and `BrandMark` consuming `@fastbuild/tokens`.
- `src/button.tsx`, `src/card.tsx`, `src/input.tsx`, `src/badge.tsx`, `src/status-dot.tsx`, `src/section-header.tsx`: Stateless UI primitives styled via FastBuild semantic CSS tokens.

## Rules

1. Keep primitives framework-agnostic across web runtimes: never import `next/*`, `@tanstack/react-router`, `electron`, or `react-native`.
2. Never import from `apps/*`.
3. Style exclusively with semantic token classes (`bg-primary`, `text-muted-foreground`, `border-border`) so light/dark themes work identically everywhere.
