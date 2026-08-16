import { nice as d3Nice } from 'd3-array';

import type { Domain } from './types';

export type DomainOptions = {
  /** Hard lower bound. Wins over padding, nice and includeZero. */
  readonly min?: number;
  /** Hard upper bound. Wins over padding, nice and includeZero. */
  readonly max?: number;
  /**
   * Headroom as a fraction of the data extent, applied to each side.
   * `0.05` means 5% above and below.
   */
  readonly padding?: number;
  /** Extend the domain to include zero — the honest default for bar charts. */
  readonly includeZero?: boolean;
  /** Round the domain outward to human-friendly numbers. */
  readonly nice?: boolean;
  /** Target tick count used by `nice`. Default 10. */
  readonly niceCount?: number;
};

export type SeriesInput = ArrayLike<number> | readonly ArrayLike<number>[];

/** Domain used when there is no usable data at all. */
const EMPTY_DOMAIN: Domain = [0, 1];

function isSingleSeries(input: SeriesInput): input is ArrayLike<number> {
  if (input.length === 0) return true;
  const first = (input as ArrayLike<unknown>)[0];
  return typeof first === 'number';
}

/**
 * Widen a zero-width domain into something drawable.
 *
 * A single data point, or a series where every value is identical, would
 * otherwise produce `[v, v]` — which maps every point to the same pixel and
 * makes the chart look broken rather than flat.
 */
function widenFlatDomain(value: number): Domain {
  if (value === 0) return [-1, 1];
  const half = Math.abs(value) * 0.1;
  return [value - half, value + half];
}

/**
 * Derive the value domain for one or more series.
 *
 * Order of operations matters and is deliberate:
 *   extent → includeZero → nice → padding → hard min/max
 *
 * `padding` is applied AFTER `nice` specifically so that nice() cannot round
 * the headroom away. Applying them the other way round is a common bug: the
 * caller asks for 5% of breathing room, nice() snaps the bound back down to a
 * round number, and the topmost data point sits exactly on the axis.
 *
 * Hard `min`/`max` are applied last because "hard" has to mean hard — a caller
 * pinning an axis to zero does not want padding pushing it to -3.
 */
export function computeDomain(
  series: SeriesInput,
  options: DomainOptions = {}
): Domain {
  const list: readonly ArrayLike<number>[] = isSingleSeries(series)
    ? [series]
    : series;

  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let seen = 0;

  for (const values of list) {
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      if (v === undefined || !Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      seen += 1;
    }
  }

  let domain: Domain =
    seen === 0 ? EMPTY_DOMAIN : lo === hi ? widenFlatDomain(lo) : [lo, hi];

  if (options.includeZero === true && seen > 0) {
    domain = [Math.min(domain[0], 0), Math.max(domain[1], 0)];
    if (domain[0] === domain[1]) domain = widenFlatDomain(domain[0]);
  }

  if (options.nice === true) {
    const count = options.niceCount ?? 10;
    const [a, b] = d3Nice(domain[0], domain[1], count);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) domain = [a, b];
  }

  const padding = options.padding ?? 0;
  if (padding > 0) {
    const extent = domain[1] - domain[0];
    const headroom = extent * padding;
    domain = [domain[0] - headroom, domain[1] + headroom];
  }

  const min = options.min ?? domain[0];
  const max = options.max ?? domain[1];

  // Never hand back an inverted or zero-width domain, however absurd the
  // overrides were. Downstream scale construction assumes lo < hi.
  if (min === max) return widenFlatDomain(min);
  if (min > max) return [max, min];
  return [min, max];
}
