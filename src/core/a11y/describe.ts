export type TrendDirection = 'increasing' | 'decreasing' | 'flat' | 'volatile';

export type SeriesDescription = {
  readonly trend: TrendDirection;
  /** Regression slope per index step. */
  readonly slope: number;
  readonly min: { readonly index: number; readonly value: number };
  readonly max: { readonly index: number; readonly value: number };
  readonly first: number;
  readonly last: number;
  /** Percentage change from first to last. */
  readonly changePercent: number;
};

export type DescribeOptions = {
  readonly chartType?: string;
  readonly title?: string;
  readonly categoryLabels?: readonly string[];
  readonly seriesName?: string;
  readonly formatValue?: (value: number) => string;
};

function linearRegressionSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - meanX;
    num += dx * ((values[i] as number) - meanY);
    den += dx * dx;
  }

  return den === 0 ? 0 : num / den;
}

function standardDeviation(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
}

/**
 * Analyse a series for a spoken description.
 *
 * Trend is the regression slope measured RELATIVE to the data's own standard
 * deviation, not an absolute threshold. A slope of 5 is a strong rise in data
 * that varies by 2 and statistical noise in data that varies by 500 — an
 * absolute cutoff would call both the same thing, which is worse than saying
 * nothing.
 */
export function describeSeries(
  values: ArrayLike<number>
): SeriesDescription | null {
  const clean: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && Number.isFinite(v)) clean.push(v);
  }
  if (clean.length === 0) return null;

  let minIndex = 0;
  let maxIndex = 0;
  for (let i = 1; i < clean.length; i += 1) {
    if ((clean[i] as number) < (clean[minIndex] as number)) minIndex = i;
    if ((clean[i] as number) > (clean[maxIndex] as number)) maxIndex = i;
  }

  const slope = linearRegressionSlope(clean);
  const sd = standardDeviation(clean);
  const first = clean[0] as number;
  const last = clean[clean.length - 1] as number;

  // Total movement the trend explains, against the data's own spread.
  const explained = Math.abs(slope) * (clean.length - 1);
  const ratio = sd === 0 ? 0 : explained / sd;

  let trend: TrendDirection;
  if (clean.length < 2 || (sd === 0 && slope === 0)) trend = 'flat';
  else if (ratio < 0.5) trend = 'volatile';
  else if (slope > 0) trend = 'increasing';
  else if (slope < 0) trend = 'decreasing';
  else trend = 'flat';

  return {
    trend,
    slope,
    min: { index: minIndex, value: clean[minIndex] as number },
    max: { index: maxIndex, value: clean[maxIndex] as number },
    first,
    last,
    changePercent: first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100,
  };
}

const DEFAULT_FORMAT = (v: number): string => String(Math.round(v * 100) / 100);

/**
 * A one-paragraph spoken summary of a chart.
 *
 * This is what a screen-reader user hears FIRST, and it has to carry the whole
 * point of the chart in a sentence or two: what kind it is, what it covers, the
 * range, and the direction. Reading out every data point instead is technically
 * accessible and practically useless.
 */
export function describeChart(
  values: ArrayLike<number>,
  options: DescribeOptions = {}
): string {
  const {
    chartType = 'Chart',
    title,
    categoryLabels,
    seriesName,
    formatValue = DEFAULT_FORMAT,
  } = options;

  const description = describeSeries(values);
  if (description === null) return `${chartType}. No data.`;

  const count = values.length;
  const parts: string[] = [];

  parts.push(`${chartType}.`);
  if (title !== undefined) parts.push(`${title}.`);
  if (seriesName !== undefined) parts.push(`${seriesName}.`);

  if (categoryLabels !== undefined && categoryLabels.length > 0) {
    const firstLabel = categoryLabels[0];
    const lastLabel = categoryLabels[categoryLabels.length - 1];
    if (firstLabel !== undefined && lastLabel !== undefined) {
      parts.push(`${firstLabel} to ${lastLabel}.`);
    }
  }

  parts.push(`${String(count)} data points.`);

  const minLabel = categoryLabels?.[description.min.index];
  const maxLabel = categoryLabels?.[description.max.index];

  parts.push(
    `Values range from ${formatValue(description.min.value)}${
      minLabel !== undefined ? ` at ${minLabel}` : ''
    } to ${formatValue(description.max.value)}${
      maxLabel !== undefined ? ` at ${maxLabel}` : ''
    }.`
  );

  const trendWord =
    description.trend === 'volatile'
      ? 'no clear trend, values fluctuate'
      : description.trend;
  parts.push(`Overall trend: ${trendWord}.`);

  if (description.trend !== 'volatile' && description.changePercent !== 0) {
    const direction = description.changePercent > 0 ? 'up' : 'down';
    parts.push(
      `Overall ${direction} ${formatValue(Math.abs(description.changePercent))} percent.`
    );
  }

  parts.push('Swipe right to explore data points.');

  return parts.join(' ');
}

/**
 * Label for one data point.
 *
 * Position is included because a screen reader gives no sense of where you are
 * in a list otherwise — "3 of 12" is what makes swiping through feel navigable
 * rather than endless.
 */
export function describePoint(
  index: number,
  total: number,
  value: number,
  options: {
    readonly label?: string;
    readonly formatValue?: (v: number) => string;
  } = {}
): string {
  const { label, formatValue = DEFAULT_FORMAT } = options;
  const position = `${String(index + 1)} of ${String(total)}`;

  if (!Number.isFinite(value)) {
    return label === undefined
      ? `No data, ${position}`
      : `${label}, no data, ${position}`;
  }

  return label === undefined
    ? `${formatValue(value)}, ${position}`
    : `${label}, ${formatValue(value)}, ${position}`;
}

/**
 * Describe outliers in plain language.
 *
 * Uses the same Tukey fence as the box plot, so a value called an outlier here
 * is the same value drawn as one there.
 */
export function describeOutliers(
  values: ArrayLike<number>,
  options: { readonly categoryLabels?: readonly string[] } = {}
): string {
  const clean: { value: number; index: number }[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v !== undefined && Number.isFinite(v))
      clean.push({ value: v, index: i });
  }
  if (clean.length < 4) return '';

  const sorted = [...clean].sort((a, b) => a.value - b.value);
  const q = (p: number): number => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.min(sorted.length - 1, lo + 1);
    const a = sorted[lo]?.value ?? 0;
    const b = sorted[hi]?.value ?? 0;
    return a + (h - lo) * (b - a);
  };

  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const found = clean.filter((c) => c.value < lower || c.value > upper);
  if (found.length === 0) return 'No outliers.';

  const named = found
    .slice(0, 3)
    .map(
      (c) => options.categoryLabels?.[c.index] ?? `point ${String(c.index + 1)}`
    );

  return found.length === 1
    ? `One outlier, at ${named[0] ?? ''}.`
    : `${String(found.length)} outliers, including ${named.join(', ')}.`;
}
