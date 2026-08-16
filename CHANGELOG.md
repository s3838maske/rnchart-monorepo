# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-08-17

**First stable release.** All 27 phases of the v1 roadmap are complete:
cartesian and polar series, interaction, streaming, drilldown, annotations,
statistical series and a screen-reader layer.

Semver applies from here. Breaking changes to the public API mean 2.0.0 —
which is where the plugin architecture and the remaining roadmap phases
(28–41) are headed.

Supersedes 0.2.0 and 0.3.0, which were tagged in git but never published.

Includes phases 22 through 27:

### Added — annotations (v1.2.0)

- `<PlotLine>`, `<PlotBand>` and `<Annotations>`. Positioned in DATA
  coordinates, so they track pan and zoom through the same scales the series
  use. Collision handling reuses `resolveLabelPlacement` — the same function
  the data labels use, not a second implementation.

### Added — statistical series (v1.3.0)

- `<AreaRange>`, `<Dumbbell>` for `[low, high]` pairs.
- `<BoxPlot>` with tukey / minmax / stddev whiskers, notches and jittered
  outliers. `<ErrorBars>` attachable over any series.
- `<Waterfall>` with running totals and connectors.
- Core maths: `computeBoxStats`, `quantileSorted` (R types 6 and 7),
  `histogram` with Freedman–Diaconis binning, `waterfall`, `pareto`,
  `bellCurve`.

### Added — accessibility (v1.4.0)

- `<ChartAccessibility>` — an automatic spoken summary plus one focusable
  invisible view per datum, so a screen-reader user can swipe through the
  data a Skia canvas would otherwise hide entirely.
- `<DataTable>` and `<DataTableToggle>` — the numbers as an accessible table,
  useful to sighted users too.
- `<Pattern>` — texture fills so series are distinguishable without colour,
  and a `pattern` prop on `<Bar>` that clips the texture to the bars.
- Core: `describeChart`, `describeSeries`, `describePoint`,
  `describeOutliers`. Trend is measured relative to the data's own standard
  deviation, not an absolute threshold.

### Fixed — found by running phases 22–27 on real devices

Every one of these passed typecheck, lint and the full unit suite.

- `<PlotLine dash>` was typed, documented and defaulted to `[4, 4]`, but never
  applied — it only set `strokeCap`. Every plot line drew solid, including the
  dashed default. It is a `DashPathEffect` now.
- `<Waterfall>` was clipped by default. A chart derives its y domain from the
  values it is handed — the deltas — while the bars are drawn at cumulative
  positions that climb higher, so bars past the top vanished with nothing to
  indicate it. Added `waterfallDomain(steps)` to pass as `yDomain`.
- The accessibility layer exposed **nothing at all on iOS**. A view marked
  `accessible` collapses its children into one element there, so the container
  swallowed every per-point element. The summary is a sibling now, not a
  parent.
- Screen-reader focus order was wrong on Android: the per-point views were
  boxes at each data point, and Android orders traversal by bounds, so real
  revenue data was read as `Jan, Feb, Apr, Jun, May, Jul, Aug, Mar`. They are
  full-height columns now, which share a top edge and so order by x.
- `describeChart` ran the change percentage through `formatValue`, producing
  `Overall up 190 thousand percent` for a formatter that appends "thousand".
  A percentage is not a value in the series' units.
- Notched box plots turned inside out for n < 10, where the notch is wider
  than the box. Clamped to the quartiles.
- `<DataTable>` could only be rendered inside a `<Chart>`, which has a fixed
  height and clips its children — so the table was cropped and drawn over the
  plot. It now takes `data` and `xKey` directly.

### Fixed

- Drilldown pushed a duplicate level for every tap that landed while an async
  resolution was still in flight, producing breadcrumbs like
  `Countries › India › MH › MH › MH`. Taps are now ignored while a drill is
  resolving.
- The leaf case cleared its loading flag with a push immediately followed by a
  pop. Replaced with a `settle` action that does what it says.
- Removed the wall-clock assertions from the unit suite. They were flaky by
  nature — competing with 20 other suites for CPU — and a randomly failing
  test trains people to re-run until green. `yarn bench` measures properly.

## [0.2.0] — never published

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

## [0.1.0] — 2026-08-14

First release to npm. Phases 1 through 15.

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
