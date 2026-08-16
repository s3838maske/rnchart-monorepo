/**
 * @rnchart/core — renderer-agnostic charting maths.
 *
 * Pure TypeScript, zero React Native, runnable under plain Node. Phase 2 adds
 * the scale and domain engine; the layout solver lands in phase 3 and
 * decimation plus hit-testing in phase 4.
 */

export const VERSION = '0.1.0';

export type { Rect, Size } from './geometry';
export { clamp, createRect } from './geometry';

export {
  contrastRatio,
  contrastTheme,
  darkTheme,
  defineTheme,
  lightTheme,
  mergeTheme,
  PALETTES,
  paletteColorAt,
  parseHex,
  perceptualDistance,
  readableTextColor,
  relativeLuminance,
  simulate,
  verifyPalette,
} from './theme';
export type {
  ChartTheme,
  ChartThemeInput,
  ColorVisionType,
  PaletteName,
  PaletteReport,
  Rgb,
} from './theme';

export {
  autoDecimate,
  clipToViewport,
  createHitTester,
  lttb,
  minMaxDecimate,
} from './perf';
export type {
  AutoDecimateOptions,
  DecimationStrategy,
  HitMode,
  HitResult,
  HitTester,
  ViewportSlice,
} from './perf';

export {
  describeChart,
  describeOutliers,
  describePoint,
  describeSeries,
} from './a11y';
export type {
  DescribeOptions,
  SeriesDescription,
  TrendDirection,
} from './a11y';

export { computeBoxStats, notchWidth, quantileSorted } from './stats';
export type {
  BoxStats,
  BoxStatsOptions,
  QuantileType,
  WhiskerMethod,
} from './stats';

export {
  bellCurve,
  chooseBinCount,
  histogram,
  pareto,
  waterfall,
  waterfallDomain,
} from './derive';
export type {
  BinMethod,
  HistogramBin,
  HistogramOptions,
  ParetoPoint,
  WaterfallBar,
  WaterfallStep,
} from './derive';

export { createRingBuffer } from './stream';
export type { RingBuffer, RingView } from './stream';

export {
  categoryAngle,
  createCartesian,
  createPolar,
  samePoint,
  uprightRotation,
} from './coord';
export type {
  CartesianOptions,
  CoordinateSystem,
  CoordinateSystemType,
  PathSegment,
  Point,
  PolarOptions,
} from './coord';

export { computeArcs, monotoneTangents } from './curve';
export type { Arc, ArcOptions } from './curve';

export { resolveLabelPlacement } from './layout';
export type {
  LabelCandidate,
  LabelPlacementOptions,
  PlacedLabel,
} from './layout';

export {
  formatValue,
  generateTicks,
  resolveCollisions,
  solveLayout,
} from './layout';

export type {
  AxisInput,
  AxisPlacement,
  AxisScaleSpec,
  CollisionOptions,
  CollisionStrategy,
  FormatSpec,
  FormatType,
  LabelledTick,
  Layout,
  LayoutInput,
  LegendInput,
  MeasureText,
  Padding,
  ResolvedTick,
  SolvedAxis,
  TickOptions,
  TitleInput,
} from './layout';

export {
  applyStacking,
  computeDomain,
  createScale,
  normaliseMissing,
} from './scale';

export type {
  BandScaleSpec,
  Category,
  ContinuousScaleSpec,
  ContinuousScaleType,
  Domain,
  DomainOptions,
  MissingInput,
  MissingPolicy,
  NormalisedSeries,
  OrdinalScaleType,
  PixelRange,
  PointScaleSpec,
  Scale,
  ScaleSpec,
  ScaleType,
  SeriesInput,
  StackMode,
  StackedSeries,
  Tick,
} from './scale';
