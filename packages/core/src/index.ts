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

export { computeArcs, monotoneTangents } from './curve';
export type { Arc, ArcOptions } from './curve';

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
