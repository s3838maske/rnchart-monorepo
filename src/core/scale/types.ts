/**
 * Shared vocabulary for the scale layer.
 *
 * Everything here is data, not behaviour — the phase 16 polar coordinate system
 * and the phase 39 web renderer both consume these same types, so they must not
 * assume a cartesian or a Skia context.
 */

export type ContinuousScaleType = 'linear' | 'log' | 'time' | 'sqrt';
export type OrdinalScaleType = 'band' | 'point';
export type ScaleType = ContinuousScaleType | OrdinalScaleType;

/** A continuous input domain, `[min, max]`. Time domains are epoch millis. */
export type Domain = readonly [number, number];

/** A pixel output range, `[start, end]`. `end < start` for inverted axes. */
export type PixelRange = readonly [number, number];

/** Categories for band and point scales. */
export type Category = string | number;

export type ContinuousScaleSpec = {
  readonly type: ContinuousScaleType;
  readonly domain: Domain;
  readonly range: PixelRange;
  /** Clamp outputs to the range instead of extrapolating. Default false. */
  readonly clamp?: boolean;
};

export type BandScaleSpec = {
  readonly type: 'band';
  readonly domain: readonly Category[];
  readonly range: PixelRange;
  /** Shorthand setting both inner and outer padding. */
  readonly padding?: number;
  readonly paddingInner?: number;
  readonly paddingOuter?: number;
  readonly align?: number;
};

export type PointScaleSpec = {
  readonly type: 'point';
  readonly domain: readonly Category[];
  readonly range: PixelRange;
  readonly padding?: number;
};

export type ScaleSpec = ContinuousScaleSpec | BandScaleSpec | PointScaleSpec;

export type Tick = {
  readonly value: number;
  readonly position: number;
};

/**
 * The uniform interface every scale type presents.
 *
 * Deliberately a plain object of closures rather than a class: it has to cross
 * the worklet boundary in phase 12, and class instances do not survive that.
 */
export type Scale = {
  readonly type: ScaleType;
  readonly domain: Domain | readonly Category[];
  readonly range: PixelRange;

  /** Data value to pixel. Never returns NaN or Infinity for finite input. */
  map(value: number | Category): number;

  /**
   * Pixel back to data value.
   *
   * For band and point scales this returns the category INDEX, since the
   * category itself may be a string and the signature must stay numeric for
   * worklet use.
   */
  invert(pixel: number): number;

  /** Width of one band. Present on band scales only; 0 elsewhere. */
  readonly bandwidth: number;

  /** Step between band starts, including padding. 0 on continuous scales. */
  readonly step: number;

  ticks(count: number): number[];

  /**
   * Whether `value` can be represented on this scale at all.
   *
   * Only ever false for non-positive values on a log scale. Callers use this to
   * build the validity mask rather than discovering an Infinity downstream.
   */
  supports(value: number): boolean;
};
