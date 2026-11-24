# Admin Console Performance

## Build Budgets

`pnpm build` measures compressed production assets:

| Metric                           |  Budget |
| -------------------------------- | ------: |
| Application JavaScript gzip      | 300 KiB |
| Optional library JavaScript gzip |  20 KiB |
| Largest JavaScript chunk gzip    | 180 KiB |
| Total CSS gzip                   |  50 KiB |

Application JavaScript is everything the console can load: the entry, its static
imports, and the lazy chunks of its own source, such as route pages. Optional
library JavaScript is a lazy chunk whose module belongs to a dependency, fetched
only when that library opts into a feature at runtime; ui-sdk's touch-sheet
presentation is one, and the console never enables it. The script reads
`dist/.vite/manifest.json` to tell the two apart.

The build also fails when source maps or a server bundle appear. Budget changes
must include before/after production measurements and a clear user-facing
reason.

The application/optional split replaced a single total-JavaScript budget when the
console moved from Radix to ui-sdk. Measured gzip: Radix total 290,665 B;
ui-sdk with a native Select 297,807 B of application JavaScript plus 13,388 B for
the sheet chunk the console never fetches (311,195 B total). Counting that chunk
against the application budget would have rejected code no user downloads.

## Implementation Rules

- Keep TanStack Router automatic code splitting enabled.
- Route entries import feature pages; avoid importing all optional features
  through the root layout.
- Use TanStack Query for remote cache behavior instead of duplicate global
  stores.
- Keep provider composition small and stable.
- Prefer native platform APIs and existing dependencies over another runtime
  package.
- Import icons by name and avoid broad barrel imports for large libraries.
- Treat `index.html` as revalidated and content-hashed assets as immutable.

## Evidence

Build budgets are synthetic engineering evidence, not field Web Vitals.
Production applications should collect LCP, INP, and CLS at the 75th
percentile under an explicit device/reporting policy before making user
performance claims.

Use a bundle analyzer only when a shared dependency or route regression needs
diagnosis. Do not add analyzer runtime to the default production graph.
