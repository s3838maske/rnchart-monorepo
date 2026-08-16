import { computeBoxStats, notchWidth, quantileSorted } from './boxStats';

describe('quantileSorted', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('matches R type 7 (the R and NumPy default)', () => {
    // R: quantile(1:10, c(.25,.5,.75), type = 7) -> 3.25, 5.50, 7.75
    expect(quantileSorted(sorted, 0.25, 7)).toBeCloseTo(3.25, 10);
    expect(quantileSorted(sorted, 0.5, 7)).toBeCloseTo(5.5, 10);
    expect(quantileSorted(sorted, 0.75, 7)).toBeCloseTo(7.75, 10);
  });

  it('matches R type 6', () => {
    // R: quantile(1:10, c(.25,.75), type = 6) -> 2.75, 8.25
    expect(quantileSorted(sorted, 0.25, 6)).toBeCloseTo(2.75, 10);
    expect(quantileSorted(sorted, 0.75, 6)).toBeCloseTo(8.25, 10);
  });

  it('returns the endpoints at p = 0 and p = 1', () => {
    expect(quantileSorted(sorted, 0, 7)).toBe(1);
    expect(quantileSorted(sorted, 1, 7)).toBe(10);
  });

  it('handles a single value', () => {
    expect(quantileSorted([42], 0.5)).toBe(42);
  });

  it('returns NaN for an empty array', () => {
    expect(quantileSorted([], 0.5)).toBeNaN();
  });

  it('clamps type 6 outside the data range', () => {
    // Type 6 extrapolates past the ends; clamping keeps it inside the data.
    expect(quantileSorted([1, 2, 3], 0.01, 6)).toBe(1);
    expect(quantileSorted([1, 2, 3], 0.99, 6)).toBe(3);
  });
});

describe('computeBoxStats', () => {
  it('produces the five-number summary', () => {
    const s = computeBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(s.q1).toBeCloseTo(3.25, 10);
    expect(s.median).toBeCloseTo(5.5, 10);
    expect(s.q3).toBeCloseTo(7.75, 10);
    expect(s.mean).toBeCloseTo(5.5, 10);
    expect(s.n).toBe(10);
  });

  it('flags Tukey outliers beyond 1.5 x IQR', () => {
    // R: boxplot.stats(c(1:10, 100))$out -> 100
    const s = computeBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);

    expect(s.outliers).toContain(100);
    expect(s.max).toBe(10);
  });

  it('extends whiskers to the extreme value INSIDE the fence, not to the fence', () => {
    // Drawing to the fence invents a data point that does not exist.
    const s = computeBoxStats([10, 11, 12, 13, 14, 40]);

    expect(s.max).toBe(14);
    expect(s.outliers).toEqual([40]);
  });

  it('minmax whiskers reach the extremes and flag nothing', () => {
    const s = computeBoxStats([1, 2, 3, 100], { whiskers: 'minmax' });

    expect(s.min).toBe(1);
    expect(s.max).toBe(100);
    expect(s.outliers).toEqual([]);
  });

  it('stddev whiskers use two standard deviations', () => {
    const s = computeBoxStats([10, 10, 10, 10, 10, 90], { whiskers: 'stddev' });
    expect(s.outliers).toContain(90);
  });

  it('handles data with no outliers', () => {
    const s = computeBoxStats([4, 5, 6, 7]);

    expect(s.outliers).toEqual([]);
    expect(s.min).toBe(4);
    expect(s.max).toBe(7);
  });

  it('drops non-finite values rather than poisoning the summary', () => {
    const s = computeBoxStats([1, Number.NaN, 3, Number.POSITIVE_INFINITY, 5]);

    expect(s.n).toBe(3);
    expect(s.median).toBe(3);
  });

  it('does not require sorted input', () => {
    const a = computeBoxStats([5, 1, 4, 2, 3]);
    const b = computeBoxStats([1, 2, 3, 4, 5]);

    expect(a.median).toBe(b.median);
    expect(a.q1).toBeCloseTo(b.q1, 10);
  });

  it('handles a single value', () => {
    const s = computeBoxStats([7]);

    expect(s.median).toBe(7);
    expect(s.min).toBe(7);
    expect(s.max).toBe(7);
    expect(s.n).toBe(1);
  });

  it('returns NaNs for empty input rather than throwing', () => {
    // A chart re-renders every frame; a degenerate series must not crash it.
    const s = computeBoxStats([]);

    expect(s.n).toBe(0);
    expect(s.median).toBeNaN();
    expect(s.outliers).toEqual([]);
  });

  it('handles all-identical values', () => {
    const s = computeBoxStats([5, 5, 5, 5]);

    expect(s.q1).toBe(5);
    expect(s.q3).toBe(5);
    expect(s.outliers).toEqual([]);
  });
});

describe('notchWidth', () => {
  it('is 1.58 x IQR / sqrt(n)', () => {
    const s = computeBoxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const expected = (1.58 * (s.q3 - s.q1)) / Math.sqrt(10);

    expect(notchWidth(s)).toBeCloseTo(expected, 10);
  });

  it('is zero for empty input', () => {
    expect(notchWidth(computeBoxStats([]))).toBe(0);
  });

  it('shrinks as n grows, since confidence tightens', () => {
    const few = computeBoxStats([1, 2, 3, 4]);
    const many = computeBoxStats(
      Array.from({ length: 400 }, (_, i) => (i % 4) + 1)
    );

    expect(notchWidth(many)).toBeLessThan(notchWidth(few));
  });
});
