---
'@rnchart/charts': minor
'@rnchart/core': minor
'@rnchart/skia': minor
---

Phase 13 — legend and label placement. `<Legend>` with tap-to-toggle,
wrapping, scrolling and 44pt touch targets. `resolveLabelPlacement` in core,
shared with annotations in phase 22.

Phase 14 — theme system. Full token shape, light/dark following the OS,
three verified palettes (vivid, muted, mono), `setDefaults` /
`<ChartThemeProvider>` / per-chart override, and `useChartAnimation` with
reduce-motion support that SNAPS rather than shortening.

Also fixes an Android tooltip artefact: `elevation` composites as a separate
layer from its view, so animating a parent's opacity faded card and shadow on
different schedules.
