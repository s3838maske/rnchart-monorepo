# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] — unreleased

v1.1.0 of the roadmap: polar and radial charts.

### Added

- **`<PolarChart>`** — a polar coordinate container. Publishes a
  `CoordinateSystem` rather than raw scales, so series ask it how to connect
  two points instead of assuming a straight line.
- **`<Radar>`** — closed polygons over categorical spokes, with
  `independentAxes` so each spoke can normalise to its own min/max. That is the
  feature that makes comparing revenue in lakhs against an NPS out of 10
  actually readable.
- **`<WindRose>`** — stacked polar columns.
- **`<Gauge>`** — angular gauge with coloured bands, an optional sweep
  gradient and a tapered needle.
- **`<ActivityGauge>`** — concentric progress rings with rounded caps.
- **`<PolarGrid>`, `<AngularAxis>`, `<RadialAxis>`** — spiderweb or circular
  grid, category labels around the circumference, value labels along a spoke.
- Core: `createCartesian`, `createPolar`, `categoryAngle`, `uprightRotation`
  and the `CoordinateSystem` / `PathSegment` contract.

### Fixed

- `<WindRose>` wedges overflowed the chart because the radial domain was
  computed from individual values rather than stacked totals. `<PolarChart>`
  now takes a `stacked` prop that scales the radius to per-category sums.

## [0.1.0] — unreleased

First release. Pre-1.0 while the public API settles.

### Added

- **Chart shell** — `<Chart>` measures itself, derives domains, runs the layout
  solver and publishes solved scales through context.
- **Series** — `<Line>` (linear, monotone, step, stepAfter), `<Area>` with an
  eased three-stop gradient, `<Bar>` (grouped, rounded outer corners),
  `<Scatter>` and bubbles with sqrt radius mapping, `<PieChart>` covering pie,
  donut and arbitrary angle ranges.
- **Axes** — `<Grid>`, `<XAxis>`, `<YAxis>` with tick counts derived from
  available pixels, time ticks snapped to natural boundaries, and automatic
  label collision resolution (skip, rotate, truncate).
- **Interaction** — `cursor` and `haptics` props, `<Crosshair>` and `<Tooltip>`.
  Touch tracking, snapping and crosshair drawing run entirely on the UI thread.
- **Legend** — `<Legend>` with tap-to-toggle and 44pt minimum touch targets.
- **Theming** — light and dark following the OS, three palettes verified against
  colour-vision-deficiency simulation, `setDefaults()`, `<ChartThemeProvider>`,
  and `useChartAnimation()` honouring reduce-motion.
- **Core maths**, exported for custom series: scales, domain computation,
  stacking, missing-data policies, the layout solver, LTTB and min/max
  decimation, and binary-search plus quadtree hit-testers.

### Known limitations

See [What's not done](./README.md#whats-not-done). In short: no device
benchmarks, no screenshot regression tests, no accessibility layer, and no
pan/zoom, polar, statistical or financial chart types yet.
