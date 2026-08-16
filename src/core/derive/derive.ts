export type BinMethod = 'sturges' | 'scott' | 'freedman-diaconis' | 'sqrt';

export type HistogramBin = {
  readonly x0: number;
  readonly x1: number;
  readonly count: number;
  /** count / (n * binWidth). Integrates to 1. */
  readonly density: number;
};

export type HistogramOptions = {
  readonly bins?: number | readonly number[] | 'auto';
  readonly method?: BinMethod;
};

function stdDev(values: readonly number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (h - lo) * (b - a);
}

/**
 * Choose a bin count.
 *
 * Freedman–Diaconis is the default because it uses the IQR rather than the
 * standard deviation, which makes it robust to outliers — the case where
 * Sturges and Scott both produce uselessly wide bins. It degenerates when the
 * IQR is zero (a highly repetitive dataset), so it falls back to Sturges,
 * which is what NumPy's `histogram_bin_edges` does for the same reason.
 */
export function chooseBinCount(
  values: readonly number[],
  method: BinMethod = 'freedman-diaconis'
): number {
  const n = values.length;
  if (n < 2) return 1;

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0] as number;
  const max = sorted[n - 1] as number;
  const range = max - min;
  if (range === 0) return 1;

  if (method === 'sqrt') return Math.max(1, Math.ceil(Math.sqrt(n)));
  if (method === 'sturges') return Math.max(1, Math.ceil(Math.log2(n) + 1));

  if (method === 'scott') {
    const mean = sorted.reduce((s, v) => s + v, 0) / n;
    const width = (3.49 * stdDev(sorted, mean)) / Math.cbrt(n);
    return width > 0 ? Math.max(1, Math.ceil(range / width)) : 1;
  }

  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const width = (2 * iqr) / Math.cbrt(n);
  if (width <= 0) return Math.max(1, Math.ceil(Math.log2(n) + 1));
  return Math.max(1, Math.ceil(range / width));
}

/**
 * Bin values into a histogram.
 *
 * Bins are half-open `[x0, x1)` except the last, which includes its upper edge
 * — otherwise the single largest value silently vanishes, which is the classic
 * off-by-one in hand-rolled histograms.
 */
export function histogram(
  values: ArrayLike<number>,
  options: HistogramOptions = {}
): HistogramBin[] {
  const clean: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && Number.isFinite(v)) clean.push(v);
  }
  if (clean.length === 0) return [];

  const sorted = [...clean].sort((a, b) => a - b);
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;

  let edges: number[];

  if (Array.isArray(options.bins)) {
    edges = [...(options.bins as readonly number[])].sort((a, b) => a - b);
  } else {
    const count =
      typeof options.bins === 'number'
        ? Math.max(1, Math.floor(options.bins))
        : chooseBinCount(clean, options.method ?? 'freedman-diaconis');

    const width = (max - min) / count || 1;
    edges = Array.from({ length: count + 1 }, (_, i) => min + i * width);
  }

  if (edges.length < 2) return [];

  const counts = new Array<number>(edges.length - 1).fill(0);

  for (const v of clean) {
    // Binary search for the bin, so a large dataset does not become O(n*bins).
    let lo = 0;
    let hi = edges.length - 2;
    let bin = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const x0 = edges[mid] as number;
      const x1 = edges[mid + 1] as number;
      const isLast = mid === edges.length - 2;
      if (v < x0) hi = mid - 1;
      else if (v > x1 || (v === x1 && !isLast)) lo = mid + 1;
      else {
        bin = mid;
        break;
      }
    }
    if (bin >= 0) counts[bin] = (counts[bin] as number) + 1;
  }

  const n = clean.length;

  return counts.map((count, i) => {
    const x0 = edges[i] as number;
    const x1 = edges[i + 1] as number;
    const width = x1 - x0;
    return {
      x0,
      x1,
      count,
      density: width > 0 ? count / (n * width) : 0,
    };
  });
}

export type WaterfallStep = {
  readonly label: string;
  readonly value: number;
  /** Rises from zero instead of from the running total. */
  readonly isSum?: boolean;
};

export type WaterfallBar = {
  readonly label: string;
  readonly value: number;
  readonly start: number;
  readonly end: number;
  readonly isSum: boolean;
  readonly kind: 'positive' | 'negative' | 'sum';
};

/**
 * Running totals for a waterfall.
 *
 * Each bar starts where the previous ended. Subtotal columns are the exception:
 * they rise from ZERO to the running total, because a subtotal is an absolute
 * position, not another delta. Treating them as deltas is the bug that makes
 * waterfall charts silently wrong.
 */
export function waterfall(steps: readonly WaterfallStep[]): WaterfallBar[] {
  let running = 0;

  return steps.map((step) => {
    const value = Number.isFinite(step.value) ? step.value : 0;

    if (step.isSum === true) {
      const bar: WaterfallBar = {
        label: step.label,
        value: running,
        start: 0,
        end: running,
        isSum: true,
        kind: 'sum',
      };
      return bar;
    }

    const start = running;
    running += value;

    return {
      label: step.label,
      value,
      start,
      end: running,
      isSum: false,
      kind: value >= 0 ? ('positive' as const) : ('negative' as const),
    };
  });
}

/**
 * The y extent a waterfall actually occupies.
 *
 * Needed because a chart derives its domain from the VALUES it is given, while
 * a waterfall draws at CUMULATIVE positions — deltas of 120 and 86 reach 206,
 * which a domain built from the deltas stops well short of. The bars above the
 * top are then clipped and simply missing, with nothing to indicate it. Pass
 * this to the chart's `yDomain` whenever the running total can exceed the
 * largest single step, which is most of the time.
 */
export function waterfallDomain(
  steps: readonly WaterfallStep[]
): [number, number] {
  const bars = waterfall(steps);
  if (bars.length === 0) return [0, 1];

  // Zero is always included: a waterfall is read against its baseline.
  let min = 0;
  let max = 0;
  for (const bar of bars) {
    min = Math.min(min, bar.start, bar.end);
    max = Math.max(max, bar.start, bar.end);
  }

  return min === max ? [min, min + 1] : [min, max];
}

export type ParetoPoint = {
  readonly label: string;
  readonly value: number;
  /** Running percentage of the total, 0 to 100. */
  readonly cumulative: number;
};

/**
 * Sort descending and accumulate to a running percentage.
 *
 * The cumulative line is the entire point of a Pareto chart — without it you
 * have a sorted bar chart.
 */
export function pareto(
  items: readonly { readonly label: string; readonly value: number }[]
): ParetoPoint[] {
  const clean = items
    .filter((i) => Number.isFinite(i.value) && i.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = clean.reduce((s, i) => s + i.value, 0);
  if (total === 0) {
    return clean.map((i) => ({ ...i, cumulative: 0 }));
  }

  let running = 0;
  return clean.map((i) => {
    running += i.value;
    return {
      label: i.label,
      value: i.value,
      cumulative: (running / total) * 100,
    };
  });
}

/**
 * Normal PDF sampled across a range — the bell curve overlaid on a histogram.
 */
export function bellCurve(
  values: ArrayLike<number>,
  samples = 64
): { readonly x: number; readonly y: number }[] {
  const clean: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && Number.isFinite(v)) clean.push(v);
  }
  if (clean.length < 2) return [];

  const n = clean.length;
  const mean = clean.reduce((s, v) => s + v, 0) / n;
  const sd = stdDev(clean, mean);
  if (sd === 0) return [];

  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const step = (hi - lo) / Math.max(1, samples - 1);
  const coefficient = 1 / (sd * Math.sqrt(2 * Math.PI));

  return Array.from({ length: samples }, (_, i) => {
    const x = lo + i * step;
    const z = (x - mean) / sd;
    return { x, y: coefficient * Math.exp(-0.5 * z * z) };
  });
}
