export type StackMode = 'none' | 'normal' | 'percent';

/**
 * One series' stacked geometry.
 *
 * `low` and `high` are parallel to the input, so index `i` of every array
 * describes the same x-position. The area renderer in phase 8 takes `high` as
 * its top edge and `low` as its baseline directly — no recomputation in the
 * component.
 */
export type StackedSeries = {
  readonly low: Float32Array;
  readonly high: Float32Array;
};

function readAt(values: ArrayLike<number>, i: number): number {
  const v = values[i];
  return v === undefined || !Number.isFinite(v) ? 0 : v;
}

/**
 * Stack a set of series.
 *
 * Two rules make this different from a naive running sum:
 *
 * 1. Negative values stack DOWNWARD from zero while positives stack upward.
 *    They do not cancel. A bar of +5 and a bar of -5 at the same x produce a
 *    stack from -5 to +5, not an empty stack of height 0. Getting this wrong
 *    is the classic "bar with negative stack" bug.
 *
 * 2. Percent mode normalises ABSOLUTE magnitudes per x-position, so a column
 *    mixing +8 and -2 splits 80%/20% of the visible height rather than
 *    producing 400% and -100%.
 *
 * Series that are entirely zero at an x-position leave the stack untouched
 * rather than dividing by zero.
 */
export function applyStacking(
  series: readonly ArrayLike<number>[],
  mode: StackMode = 'normal'
): StackedSeries[] {
  const seriesCount = series.length;
  if (seriesCount === 0) return [];

  let pointCount = 0;
  for (const s of series) pointCount = Math.max(pointCount, s.length);

  const out: StackedSeries[] = [];
  for (let s = 0; s < seriesCount; s += 1) {
    out.push({
      low: new Float32Array(pointCount),
      high: new Float32Array(pointCount),
    });
  }

  for (let i = 0; i < pointCount; i += 1) {
    if (mode === 'none') {
      for (let s = 0; s < seriesCount; s += 1) {
        const v = readAt(series[s] as ArrayLike<number>, i);
        const target = out[s] as StackedSeries;
        target.low[i] = Math.min(0, v);
        target.high[i] = Math.max(0, v);
      }
      continue;
    }

    // Percent mode needs the total magnitude at this x before it can place
    // anything, so compute it up front.
    let magnitude = 0;
    if (mode === 'percent') {
      for (let s = 0; s < seriesCount; s += 1) {
        magnitude += Math.abs(readAt(series[s] as ArrayLike<number>, i));
      }
    }

    let positiveAcc = 0;
    let negativeAcc = 0;

    for (let s = 0; s < seriesCount; s += 1) {
      const raw = readAt(series[s] as ArrayLike<number>, i);
      const value =
        mode === 'percent'
          ? magnitude === 0
            ? 0
            : (raw / magnitude) * 100
          : raw;

      const target = out[s] as StackedSeries;

      if (value >= 0) {
        target.low[i] = positiveAcc;
        target.high[i] = positiveAcc + value;
        positiveAcc += value;
      } else {
        target.high[i] = negativeAcc;
        target.low[i] = negativeAcc + value;
        negativeAcc += value;
      }
    }
  }

  return out;
}
