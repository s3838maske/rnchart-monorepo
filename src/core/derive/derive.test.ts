import {
  bellCurve,
  chooseBinCount,
  histogram,
  pareto,
  waterfall,
  waterfallDomain,
} from './derive';

describe('chooseBinCount', () => {
  it('uses sqrt when asked', () => {
    expect(chooseBinCount([1, 2, 3, 4, 5, 6, 7, 8, 9], 'sqrt')).toBe(3);
  });

  it('uses Sturges when asked', () => {
    // ceil(log2(8) + 1) = 4
    expect(chooseBinCount([1, 2, 3, 4, 5, 6, 7, 8], 'sturges')).toBe(4);
  });

  it('falls back to Sturges when the IQR is zero', () => {
    // Freedman-Diaconis divides by the IQR, which is 0 for highly repetitive
    // data. NumPy falls back for the same reason.
    const repetitive = [...Array(50).fill(5), 1, 100];
    expect(chooseBinCount(repetitive, 'freedman-diaconis')).toBeGreaterThan(0);
  });

  it('returns 1 for a zero-range dataset', () => {
    expect(chooseBinCount([7, 7, 7, 7])).toBe(1);
  });

  it('returns 1 for fewer than two values', () => {
    expect(chooseBinCount([1])).toBe(1);
    expect(chooseBinCount([])).toBe(1);
  });

  it('is robust to an outlier where Scott is not', () => {
    // The reason Freedman-Diaconis is the default: it uses the IQR, so one
    // extreme value does not blow the bin width out.
    const base = Array.from({ length: 100 }, (_, i) => i % 10);
    const fd = chooseBinCount([...base, 10_000], 'freedman-diaconis');
    const scott = chooseBinCount([...base, 10_000], 'scott');

    expect(fd).toBeGreaterThan(scott);
  });
});

describe('histogram', () => {
  it('bins values and counts them', () => {
    const bins = histogram([1, 1, 2, 2, 2, 3], { bins: 3 });

    expect(bins).toHaveLength(3);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(6);
  });

  it('includes the maximum value in the LAST bin', () => {
    // Half-open bins would silently drop the single largest value — the
    // classic off-by-one in hand-rolled histograms.
    const bins = histogram([0, 5, 10], { bins: 2 });

    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(3);
    expect(bins[bins.length - 1]?.count).toBeGreaterThan(0);
  });

  it('accepts explicit edges', () => {
    const bins = histogram([1, 5, 9], { bins: [0, 4, 8, 12] });

    expect(bins).toHaveLength(3);
    expect(bins[0]?.count).toBe(1);
    expect(bins[1]?.count).toBe(1);
    expect(bins[2]?.count).toBe(1);
  });

  it('sorts unsorted explicit edges', () => {
    const bins = histogram([1, 5], { bins: [8, 0, 4] });
    expect(bins[0]?.x0).toBe(0);
  });

  it('density integrates to 1', () => {
    const values = Array.from({ length: 200 }, (_, i) => i % 20);
    const bins = histogram(values, { bins: 10 });

    const integral = bins.reduce((s, b) => s + b.density * (b.x1 - b.x0), 0);
    expect(integral).toBeCloseTo(1, 6);
  });

  it('ignores non-finite values', () => {
    const bins = histogram([1, Number.NaN, 3, Number.POSITIVE_INFINITY]);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(2);
  });

  it('returns an empty array for no usable data', () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([Number.NaN])).toEqual([]);
  });

  it('handles a zero-range dataset', () => {
    const bins = histogram([5, 5, 5]);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});

describe('waterfall', () => {
  it('chains each bar from where the previous ended', () => {
    const bars = waterfall([
      { label: 'Start', value: 100 },
      { label: 'Up', value: 50 },
      { label: 'Down', value: -30 },
    ]);

    expect(bars[0]).toMatchObject({ start: 0, end: 100 });
    expect(bars[1]).toMatchObject({ start: 100, end: 150 });
    expect(bars[2]).toMatchObject({ start: 150, end: 120 });
  });

  it('rises subtotals from ZERO, not from the running total', () => {
    // A subtotal is an absolute position, not another delta. Treating it as a
    // delta is the bug that makes waterfall charts silently wrong.
    const bars = waterfall([
      { label: 'A', value: 60 },
      { label: 'B', value: 40 },
      { label: 'Total', value: 0, isSum: true },
    ]);

    expect(bars[2]).toMatchObject({
      start: 0,
      end: 100,
      isSum: true,
      kind: 'sum',
    });
  });

  it('classifies each bar', () => {
    const bars = waterfall([
      { label: 'Up', value: 10 },
      { label: 'Down', value: -5 },
      { label: 'T', value: 0, isSum: true },
    ]);

    expect(bars.map((b) => b.kind)).toEqual(['positive', 'negative', 'sum']);
  });

  it('treats non-finite values as zero', () => {
    const bars = waterfall([
      { label: 'A', value: 10 },
      { label: 'B', value: Number.NaN },
    ]);

    expect(bars[1]).toMatchObject({ start: 10, end: 10 });
  });

  it('handles an empty input', () => {
    expect(waterfall([])).toEqual([]);
  });
});

describe('waterfallDomain', () => {
  it('covers the CUMULATIVE range, not the largest step', () => {
    // The bug this exists to prevent: a domain built from the deltas tops out
    // at 120, so the bars that climb to 206 are clipped and simply missing.
    const steps = [
      { label: 'Open', value: 120 },
      { label: 'Sales', value: 86 },
      { label: 'Costs', value: -52 },
    ];

    expect(waterfallDomain(steps)).toEqual([0, 206]);
  });

  it('includes zero even when every bar is above it', () => {
    const domain = waterfallDomain([
      { label: 'A', value: 50 },
      { label: 'B', value: 20 },
    ]);

    expect(domain[0]).toBe(0);
    expect(domain[1]).toBe(70);
  });

  it('extends below zero when the running total goes negative', () => {
    const domain = waterfallDomain([
      { label: 'A', value: 30 },
      { label: 'B', value: -80 },
    ]);

    expect(domain).toEqual([-50, 30]);
  });

  it('accounts for subtotals rising from zero', () => {
    const domain = waterfallDomain([
      { label: 'A', value: 40 },
      { label: 'B', value: 25 },
      { label: 'Total', value: 0, isSum: true },
    ]);

    expect(domain).toEqual([0, 65]);
  });

  it('never returns a zero-width domain', () => {
    expect(waterfallDomain([{ label: 'A', value: 0 }])).toEqual([0, 1]);
    expect(waterfallDomain([])).toEqual([0, 1]);
  });
});

describe('pareto', () => {
  it('sorts descending and accumulates to 100%', () => {
    const out = pareto([
      { label: 'A', value: 10 },
      { label: 'C', value: 50 },
      { label: 'B', value: 40 },
    ]);

    expect(out.map((p) => p.label)).toEqual(['C', 'B', 'A']);
    expect(out[out.length - 1]?.cumulative).toBeCloseTo(100, 9);
  });

  it('accumulates monotonically', () => {
    const out = pareto([
      { label: 'A', value: 5 },
      { label: 'B', value: 3 },
      { label: 'C', value: 2 },
    ]);

    expect(out[0]?.cumulative).toBeCloseTo(50, 9);
    expect(out[1]?.cumulative).toBeCloseTo(80, 9);
    expect(out[2]?.cumulative).toBeCloseTo(100, 9);
  });

  it('drops non-positive and non-finite values', () => {
    const out = pareto([
      { label: 'A', value: 10 },
      { label: 'B', value: 0 },
      { label: 'C', value: -5 },
      { label: 'D', value: Number.NaN },
    ]);

    expect(out).toHaveLength(1);
  });

  it('handles an empty input', () => {
    expect(pareto([])).toEqual([]);
  });
});

describe('bellCurve', () => {
  it('peaks at the mean', () => {
    const values = Array.from({ length: 200 }, (_, i) => (i % 21) - 10);
    const curve = bellCurve(values, 51);

    const peak = curve.reduce((a, b) => (b.y > a.y ? b : a));
    expect(peak.x).toBeCloseTo(0, 0);
  });

  it('is symmetric about the mean', () => {
    const values = Array.from({ length: 100 }, (_, i) => (i % 21) - 10);
    const curve = bellCurve(values, 51);

    const first = curve[0]?.y ?? 0;
    const last = curve[curve.length - 1]?.y ?? 0;
    expect(first).toBeCloseTo(last, 9);
  });

  it('spans four standard deviations each side', () => {
    const values = [0, 0, 1, 1, 2, 2, 3, 3];
    const curve = bellCurve(values, 9);

    expect(curve).toHaveLength(9);
    expect(curve[0]!.x).toBeLessThan(0);
  });

  it('returns empty for a zero-variance dataset', () => {
    expect(bellCurve([5, 5, 5, 5])).toEqual([]);
  });

  it('returns empty for fewer than two values', () => {
    expect(bellCurve([1])).toEqual([]);
  });
});
