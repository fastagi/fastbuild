# AGENTS.md - @fastbuild/tokens

Platform-neutral design tokens, Modular Stack "F" SVG geometry, CSS variables, and React Native theme.

## Ownership

- `src/tokens.ts`: Zero-chroma alabaster (light) and obsidian (dark) OKLCH semantic tokens, radii, spacing, motion, typography.
- `src/brand.ts`: Canonical `BRAND_MARK_VIEWBOX` and `BRAND_MARK_RECTS` geometry for Web, Admin, Desktop, and Mobile.
- `src/rn-theme.ts`: Hex/rgba React Native / NativeWind theme mirroring the OKLCH palettes.
- `css/tokens.css`: Shared `:root` and `.dark` CSS variables for Web, Admin, and Desktop.

## Rules

1. Stay 100% platform-neutral: never import `react`, `react-dom`, `next/*`, `electron`, or `react-native`.
2. Keep neutral surfaces zero-chroma (`oklch(L 0 0)`).
3. Run `node --test src/tokens.test.ts` after edits.
