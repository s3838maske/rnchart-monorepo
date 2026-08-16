export type QuantileType = 6 | 7;

export type WhiskerMethod = 'tukey' | 'minmax' | 'stddev';

export type BoxStats = {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  readonly mean: number;
  readonly outliers: readonly number[];
  readonly n: number;
};

export type BoxStatsOptions = {
  readonly whiskers?: WhiskerMethod;
  /**
   * Quantile definition.
   *
   * Libraries disagree about this and the discrepancy is a recurring bug
   * report, so it is explicit. Type 7 is R's default and what NumPy uses;
   * type 6 is what Minitab and SPSS use. Defaulting to 7 matches the tools
   * most people will compare against.
   */
  readonly type?: QuantileType;
};

/**
 * Quantile of a SORTED array.
 *
 * Type 7: h = (n - 1) p, linear interpolation between order statistics.
 * Type 6: h = (n + 1) p, which puts the quantiles slightly further out.
 */
export function quantileSorted(
  sorted: readonly number[],
  p: number,
  type: QuantileType = 7
): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0] as number;

  const h = type === 7 ? (n - 1) * p : (n + 1) * p - 1;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);

  if (lo < 0) return sorted[0] as number;
  if (hi >= n) return sorted[n - 1] as number;

  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (h - lo) * (b - a);
}

/**
 * Five-number summary plus mean and outliers.
 *
 * Whisker methods differ in what counts as an outlier:
 *   tukey   — 1.5 x IQR beyond the quartiles. The default, and what "box plot"
 *             means to most people.
 *   minmax  — whiskers reach the extremes; nothing is an outlier.
 *   stddev  — two standard deviations from the mean.
 *
 * Non-finite values are dropped rather than poisoning the whole summary.
 */
export function computeBoxStats(
  values: ArrayLike<number>,
  options: BoxStatsOptions = {}
): BoxStats {
  const { whiskers = 'tukey', type = 7 } = options;

  const clean: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && Number.isFinite(v)) clean.push(v);
  }

  if (clean.length === 0) {
    return {
      min: Number.NaN,
      q1: Number.NaN,
      median: Number.NaN,
      q3: Number.NaN,
      max: Number.NaN,
      mean: Number.NaN,
      outliers: [],
      n: 0,
    };
  }

  clean.sort((a, b) => a - b);

  const n = clean.length;
  const q1 = quantileSorted(clean, 0.25, type);
  const median = quantileSorted(clean, 0.5, type);
  const q3 = quantileSorted(clean, 0.75, type);
  const mean = clean.reduce((s, v) => s + v, 0) / n;

  let lowerFence: number;
  let upperFence: number;

  if (whiskers === 'minmax') {
    lowerFence = clean[0] as number;
    upperFence = clean[n - 1] as number;
  } else if (whiskers === 'stddev') {
    const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const sd = Math.sqrt(variance);
    lowerFence = mean - 2 * sd;
    upperFence = mean + 2 * sd;
  } else {
    const iqr = q3 - q1;
    lowerFence = q1 - 1.5 * iqr;
    upperFence = q3 + 1.5 * iqr;
  }

  // Whiskers extend to the most extreme value still INSIDE the fence — not to
  // the fence itself. Drawing to the fence is a common error that invents a
  // data point which does not exist.
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const outliers: number[] = [];

  for (const v of clean) {
    if (v < lowerFence || v > upperFence) {
      outliers.push(v);
      continue;
    }
    if (v < min) min = v;
    if (v > max) max = v;
  }

  if (!Number.isFinite(min)) {
    min = clean[0] as number;
    max = clean[n - 1] as number;
  }

  return { min, q1, median, q3, max, mean, outliers, n };
}

/**
 * Notch half-width: 1.58 x IQR / sqrt(n).
 *
 * A rough visual confidence interval on the median. Two boxes whose notches do
 * not overlap have significantly different medians at roughly 95%.
 */
export function notchWidth(stats: BoxStats): number {
  if (stats.n === 0) return 0;
  return (1.58 * (stats.q3 - stats.q1)) / Math.sqrt(stats.n);
}
