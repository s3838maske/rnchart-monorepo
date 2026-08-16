export { createScale } from './createScale';
export { computeDomain } from './computeDomain';
export { applyStacking } from './stacking';
export { normaliseMissing } from './missing';

export type {
  Category,
  ContinuousScaleSpec,
  ContinuousScaleType,
  BandScaleSpec,
  Domain,
  OrdinalScaleType,
  PixelRange,
  PointScaleSpec,
  Scale,
  ScaleSpec,
  ScaleType,
  Tick,
} from './types';
export type { DomainOptions, SeriesInput } from './computeDomain';
export type { StackMode, StackedSeries } from './stacking';
export type { MissingInput, MissingPolicy, NormalisedSeries } from './missing';
