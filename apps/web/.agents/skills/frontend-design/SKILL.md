---
name: frontend-design
description: Design, style, or review a FastBuild Web page or component using OKLCH tokens, Tailwind, and shadcn primitives. Use for visual direction, UI styling, or UX review.
---

# FastBuild Frontend Design

## Purpose

Establish visual direction, apply the FastBuild Web design system (OKLCH tokens,
Tailwind 4, shadcn/ui primitives), and review UI quality while keeping FastBuild
product-neutral. Use `accessibility-audit` for a dedicated WCAG 2.2 AA audit.

## Direction & System Rules

1. Identify the surface (console, public site, auth, devtool, or downstream page)
   and inspect the nearest existing layout, primitives, and tokens first.
2. Preserve Rhine blue brand ownership and shadcn semantics unless the user
   explicitly requests a new downstream brand.
3. For operational consoles: prioritize scanning, compact headings, stable
   toolbars, and clear state; avoid decorative card grids and novelty motion.
4. Cards represent real repeated or framed units, not arbitrary page sections.

## Tokens & Component Ownership

- Use semantic classes backed by `src/themes/light.css` and `src/themes/dark.css`;
  never consume primitives from `src/themes/primitives.css` directly in components.
- Use `text-error` for readable error copy; reserve `destructive` for destructive
  action surfaces and borders. Update light and dark mappings together.
- `src/components/ui/` owns shadcn primitives; `src/features/<feature>/components/`
  owns feature UI; `src/components/features/` owns cross-feature UI;
  `src/components/common/` stays generic and product-neutral.
- Add a variant only for a repeatable semantic state; one-off layout belongs at
  the caller.

## Interaction Contracts

- Keep `Input` native; import `DatePicker`, `ColorPicker`, and `PasswordInput`
  explicitly. Style `Calendar` through DayPicker slots.
- Preserve stable form-control IDs, `aria-invalid`, merged `aria-describedby`,
  and polite error announcements.
- Caller-owned labels are required for icon-only actions; shared title primitives
  remain heading-neutral so pages own the document outline.
- Build complete states: loading, empty, error, disabled, focus, and mobile.

## UI/UX Review Mode

When asked to review existing UI code, evaluate hierarchy, interaction, states,
responsive reflow, design-system consistency, and localized copy. Return findings
ordered by severity (`block`, `fix`, `note`) with `file:line`, problem, and
smallest useful correction.

## Verification

Run the narrowest checks from `apps/web/`:

```bash
corepack pnpm lint:theme-contrast
corepack pnpm vitest run \
  src/test/form-control-accessibility.test.tsx \
  src/test/calendar-date-picker.test.tsx \
  src/test/button-composition.test.tsx
corepack pnpm type-check
```

## Related Skills

Navigation only; do not load automatically:

- `accessibility-audit`: dedicated WCAG 2.2 AA pass.
- `i18n-handler`: translation-boundary changes.
- `web-perf`: measured visual or runtime performance concern.
