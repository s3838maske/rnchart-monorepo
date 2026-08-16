import {
  scaleBand,
  scaleLinear,
  scaleLog,
  scalePoint,
  scaleSqrt,
  scaleTime,
} from 'd3-scale';
import type { ScaleContinuousNumeric } from 'd3-scale';

import type {
  BandScaleSpec,
  Category,
  ContinuousScaleSpec,
  Domain,
  PointScaleSpec,
  Scale,
  ScaleSpec,
} from './types';

/**
 * The smallest positive value a log scale will accept.
 *
 * Anything at or below zero is clamped to the smallest positive value actually
 * present in the domain; if the domain contains no positive value at all we
 * fall back to this so the scale is still constructible.
 */
const LOG_FLOOR = 1e-9;

/**
 * Sanitise a log domain.
 *
 * A log scale over a domain touching zero produces -Infinity, which then
 * propagates into path geometry and silently corrupts an entire chart. Rather
 * than throwing — charts re-render every frame and must not crash on one bad
 * datum — clamp to the smallest positive value present and let `supports()`
 * report which inputs were unrepresentable.
 */
function sanitiseLogDomain(domain: Domain): Domain {
  const [a, b] = domain;
  const positives = [a, b].filter((v) => v > 0 && Number.isFinite(v));
  const smallestPositive =
    positives.length > 0 ? Math.min(...positives) : LOG_FLOOR;

  const lo = a > 0 ? a : smallestPositive;
  const hi = b > 0 ? b : smallestPositive;

  // A zero-width domain makes d3 return the range midpoint for every input.
  // Widen it by a decade so the axis is still readable.
  if (lo === hi) return [lo, lo * 10];
  return [lo, hi];
}

function createContinuous(spec: ContinuousScaleSpec): Scale {
  const isLog = spec.type === 'log';
  const domain = isLog ? sanitiseLogDomain(spec.domain) : spec.domain;

  const domainPair = [domain[0], domain[1]];
  const rangePair = [spec.range[0], spec.range[1]];
  const shouldClamp = spec.clamp === true;

  let project: (value: number) => number;
  let unproject: (pixel: number) => number;
  let tickValues: (count: number) => number[];

  if (spec.type === 'time') {
    // Time is kept separate rather than folded into the union below because
    // d3's time scale inverts to a Date and ticks to Date[]. Core speaks epoch
    // milliseconds everywhere so the boundary is converted here, once, instead
    // of leaking Date into the worklet-facing Scale type.
    const timeScale = scaleTime().domain(domainPair).range(rangePair);
    if (shouldClamp) timeScale.clamp(true);

    project = (value) => timeScale(value);
    unproject = (pixel) => timeScale.invert(pixel).getTime();
    tickValues = (count) => timeScale.ticks(count).map((t) => t.getTime());
  } else {
    const numericScale: ScaleContinuousNumeric<number, number> =
      spec.type === 'linear'
        ? scaleLinear()
        : spec.type === 'log'
          ? scaleLog()
          : scaleSqrt();

    numericScale.domain(domainPair).range(rangePair);
    if (shouldClamp) numericScale.clamp(true);

    project = (value) => numericScale(value);
    unproject = (pixel) => numericScale.invert(pixel);
    tickValues = (count) => numericScale.ticks(count);
  }

  return {
    type: spec.type,
    domain,
    range: spec.range,
    bandwidth: 0,
    step: 0,

    map(value) {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numeric)) return spec.range[0];

      // Clamp rather than emitting -Infinity. The point is separately flagged
      // as unsupported, so the renderer can drop it; what matters here is that
      // no non-finite number escapes into geometry.
      const safe = isLog && numeric <= 0 ? domain[0] : numeric;
      const pixel = project(safe);
      return Number.isFinite(pixel) ? pixel : spec.range[0];
    },

    invert(pixel) {
      const value = unproject(pixel);
      return Number.isFinite(value) ? value : domain[0];
    },

    ticks(count) {
      return tickValues(count);
    },

    supports(value) {
      if (!Number.isFinite(value)) return false;
      return isLog ? value > 0 : true;
    },
  };
}

/**
 * Resolve a value that may be a category or a positional index.
 *
 * Charts routinely pass an index where a label is expected — the hit-tester
 * works in indices, the axis works in labels. Accepting both here keeps that
 * mismatch from becoming every caller's problem.
 */
function resolveCategory(
  value: number | Category,
  domain: readonly Category[],
  lookup: (category: Category) => number | undefined
): number | undefined {
  const direct = lookup(value);
  if (direct !== undefined) return direct;

  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 0 || value >= domain.length) return undefined;

  const category = domain[value];
  return category === undefined ? undefined : lookup(category);
}

function createBand(spec: BandScaleSpec): Scale {
  const d3Scale = scaleBand<Category>()
    .domain(spec.domain)
    .range([spec.range[0], spec.range[1]]);

  if (spec.padding !== undefined) d3Scale.padding(spec.padding);
  if (spec.paddingInner !== undefined) d3Scale.paddingInner(spec.paddingInner);
  if (spec.paddingOuter !== undefined) d3Scale.paddingOuter(spec.paddingOuter);
  if (spec.align !== undefined) d3Scale.align(spec.align);

  const step = d3Scale.step();
  const bandwidth = d3Scale.bandwidth();

  // Distance from the range start to the first band's start. d3 does not
  // expose this, so read it back off the first band once at construction.
  const first = spec.domain[0];
  const firstStart = first === undefined ? undefined : d3Scale(first);
  const offset = firstStart === undefined ? 0 : firstStart - spec.range[0];

  return {
    type: 'band',
    domain: spec.domain,
    range: spec.range,
    bandwidth,
    step,

    map(value) {
      const position = resolveCategory(value, spec.domain, (c) => d3Scale(c));
      return position ?? spec.range[0];
    },

    invert(pixel) {
      if (step === 0 || spec.domain.length === 0) return 0;
      const raw = Math.floor((pixel - spec.range[0] - offset) / step);
      return Math.min(Math.max(raw, 0), spec.domain.length - 1);
    },

    ticks() {
      return spec.domain.map((_, i) => i);
    },

    supports: (value) => Number.isFinite(value),
  };
}

function createPoint(spec: PointScaleSpec): Scale {
  const d3Scale = scalePoint<Category>()
    .domain(spec.domain)
    .range([spec.range[0], spec.range[1]]);

  if (spec.padding !== undefined) d3Scale.padding(spec.padding);

  const step = d3Scale.step();

  const first = spec.domain[0];
  const firstPosition =
    first === undefined ? spec.range[0] : (d3Scale(first) ?? spec.range[0]);

  return {
    type: 'point',
    domain: spec.domain,
    range: spec.range,
    bandwidth: 0,
    step,

    map(value) {
      const position = resolveCategory(value, spec.domain, (c) => d3Scale(c));
      return position ?? spec.range[0];
    },

    invert(pixel) {
      if (step === 0 || spec.domain.length === 0) return 0;
      const raw = Math.round((pixel - firstPosition) / step);
      return Math.min(Math.max(raw, 0), spec.domain.length - 1);
    },

    ticks() {
      return spec.domain.map((_, i) => i);
    },

    supports: (value) => Number.isFinite(value),
  };
}

/**
 * Build a scale from a declarative spec.
 *
 * A thin typed wrapper over d3-scale that guarantees three things d3 does not:
 * a uniform shape across every scale type, no non-finite output for finite
 * input, and an explicit `supports()` predicate instead of silent Infinity.
 */
export function createScale(spec: ScaleSpec): Scale {
  switch (spec.type) {
    case 'band':
      return createBand(spec);
    case 'point':
      return createPoint(spec);
    default:
      return createContinuous(spec);
  }
}
