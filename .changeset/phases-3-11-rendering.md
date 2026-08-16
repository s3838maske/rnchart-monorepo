---
'@rnchart/charts': minor
'@rnchart/core': minor
'@rnchart/skia': minor
---

Phases 3, 5-11 — the rendering path. Charts now draw.

Core: tick generator sized from available pixels (never a fixed count), time
ticks snapped to natural boundaries, `formatValue` with compact notation, the
two-pass layout solver, label collision resolution, monotone curve tangents and
pie arc geometry.

Skia: `createMeasureText` with a bounded LRU cache, `useChartFont` via
`matchFont` so no font file ships on day one.

Charts: `<Chart>` shell, `<Grid>`, `<XAxis>`, `<YAxis>`, and five series —
Line, Area, Bar, Scatter/Bubble and PieChart.

Verified rendering on the Android emulator (API 36) and the iOS simulator
(iPhone 17 Pro), visually identical on both.
