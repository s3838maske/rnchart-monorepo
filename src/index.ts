/**
 * react-native-graphify — Skia-powered charts for React Native.
 *
 * One package, three layers:
 *
 *   src/core   pure TypeScript maths. No React, no React Native. Runs in Node.
 *   src/skia   the Skia renderer adapter.
 *   src/charts the components you import.
 *
 * That core boundary is the load-bearing decision, and it is enforced by a lint
 * rule rather than left to discipline: nothing under `src/core` may import
 * React Native. It is why a web renderer stays adapter work rather than a
 * rewrite — the same reason victory-native had to drop web parity when it moved
 * to Skia.
 */

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { Chart } from './charts/Chart';
export type { ChartProps, XScaleKind } from './charts/Chart';

export { useChart } from './charts/ChartContext';
export type { ChartContextValue, SeriesDatum } from './charts/ChartContext';

export { Grid, XAxis, YAxis } from './charts/axis/Axes';
export type { AxisProps, GridProps } from './charts/axis/Axes';

export { Line } from './charts/series/Line';
export type { CurveKind, LineProps } from './charts/series/Line';

export { Area } from './charts/series/Area';
export type { AreaProps } from './charts/series/Area';

export { Bar } from './charts/series/Bar';
export type { BarProps } from './charts/series/Bar';

export { Scatter } from './charts/series/Scatter';
export type { ScatterProps, ScatterShape } from './charts/series/Scatter';

export { PieChart } from './charts/series/Pie';
export type { PieChartProps } from './charts/series/Pie';

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

export { Crosshair } from './charts/interaction/Crosshair';
export type { CrosshairProps } from './charts/interaction/Crosshair';

export { Tooltip } from './charts/interaction/Tooltip';
export type { TooltipProps } from './charts/interaction/Tooltip';

export { nearestIndexByX, useCursor } from './charts/interaction/cursorState';
export type { CursorState } from './charts/interaction/cursorState';

// ---------------------------------------------------------------------------
// Overlays and theming
// ---------------------------------------------------------------------------

export { Legend } from './charts/overlays/Legend';
export type {
  LegendItem,
  LegendProps,
  LegendSymbol,
} from './charts/overlays/Legend';

export {
  ChartThemeProvider,
  resetDefaults,
  seriesColor,
  setDefaults,
  useChartTheme,
} from './charts/theme/ThemeProvider';
export type {
  ChartThemeProviderProps,
  ColorSchemeName,
  UseChartThemeOptions,
} from './charts/theme/ThemeProvider';

export { useChartAnimation } from './charts/theme/useChartAnimation';
export type { ChartAnimation } from './charts/theme/useChartAnimation';

export { SERIES_COLORS, seriesColorAt, withAlpha } from './charts/colors';

// ---------------------------------------------------------------------------
// Renderer adapter
// ---------------------------------------------------------------------------

export { createMeasureText, useChartFont } from './skia';
export type { FontSpec, FontWeight, RendererInfo } from './skia';

// ---------------------------------------------------------------------------
// Core — exported so consumers can build custom series and run the maths
// outside a chart. Everything here is pure and testable in plain Node.
// ---------------------------------------------------------------------------

export {
  applyStacking,
  autoDecimate,
  clamp,
  clipToViewport,
  computeArcs,
  computeDomain,
  contrastRatio,
  contrastTheme,
  createHitTester,
  createRect,
  createScale,
  darkTheme,
  defineTheme,
  formatValue,
  generateTicks,
  lightTheme,
  lttb,
  mergeTheme,
  minMaxDecimate,
  monotoneTangents,
  normaliseMissing,
  PALETTES,
  paletteColorAt,
  parseHex,
  perceptualDistance,
  readableTextColor,
  relativeLuminance,
  resolveCollisions,
  resolveLabelPlacement,
  simulate,
  solveLayout,
  verifyPalette,
} from './core';

export type {
  Arc,
  ArcOptions,
  AutoDecimateOptions,
  AxisInput,
  AxisPlacement,
  AxisScaleSpec,
  BandScaleSpec,
  Category,
  ChartTheme,
  ChartThemeInput,
  CollisionOptions,
  CollisionStrategy,
  ColorVisionType,
  ContinuousScaleSpec,
  ContinuousScaleType,
  DecimationStrategy,
  Domain,
  DomainOptions,
  FormatSpec,
  FormatType,
  HitMode,
  HitResult,
  HitTester,
  LabelCandidate,
  LabelledTick,
  LabelPlacementOptions,
  Layout,
  LayoutInput,
  LegendInput,
  MeasureText,
  MissingInput,
  MissingPolicy,
  NormalisedSeries,
  OrdinalScaleType,
  Padding,
  PaletteName,
  PaletteReport,
  PixelRange,
  PlacedLabel,
  PointScaleSpec,
  Rect,
  ResolvedTick,
  Rgb,
  Scale,
  ScaleSpec,
  ScaleType,
  SeriesInput,
  Size,
  SolvedAxis,
  StackedSeries,
  StackMode,
  Tick,
  TickOptions,
  TitleInput,
  ViewportSlice,
} from './core';
