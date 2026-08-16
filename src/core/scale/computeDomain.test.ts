import { computeDomain } from './computeDomain';

describe('computeDomain — basics', () => {
  it('returns the extent of a single series', () => {
    expect(computeDomain([3, 1, 7, 4])).toEqual([1, 7]);
  });

  it('accepts a Float32Array', () => {
    expect(computeDomain(new Float32Array([2, 9, 5]))).toEqual([2, 9]);
  });

  it('shares one domain across multiple series', () => {
    expect(computeDomain([[3, 5], [-2, 8], new Float32Array([10])])).toEqual([
      -2, 10,
    ]);
  });

  it('ignores NaN and Infinity', () => {
    expect(computeDomain([1, Number.NaN, 5, Number.POSITIVE_INFINITY])).toEqual(
      [1, 5]
    );
  });
});

describe('computeDomain — degenerate input', () => {
  it('returns a unit domain for an empty series', () => {
    expect(computeDomain([])).toEqual([0, 1]);
  });

  it('returns a unit domain when every value is unusable', () => {
    expect(computeDomain([Number.NaN, Number.NaN])).toEqual([0, 1]);
  });

  it('widens a single data point into a drawable domain', () => {
    const [lo, hi] = computeDomain([42]);

    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeLessThan(42);
    expect(hi).toBeGreaterThan(42);
  });

  it('widens an all-equal series', () => {
    const [lo, hi] = computeDomain([7, 7, 7, 7]);

    expect(hi).toBeGreaterThan(lo);
  });

  it('widens a series of all zeros symmetrically', () => {
    expect(computeDomain([0, 0, 0])).toEqual([-1, 1]);
  });
});

describe('computeDomain — options', () => {
  it('applies includeZero', () => {
    expect(computeDomain([5, 9], { includeZero: true })).toEqual([0, 9]);
    expect(computeDomain([-9, -5], { includeZero: true })).toEqual([-9, 0]);
  });

  it('applies padding as a fraction of the extent, each side', () => {
    expect(computeDomain([0, 100], { padding: 0.05 })).toEqual([-5, 105]);
  });

  it('honours hard min and max over padding', () => {
    expect(computeDomain([10, 90], { padding: 0.5, min: 0, max: 100 })).toEqual(
      [0, 100]
    );
  });

  it('allows a hard bound on one side only', () => {
    const [lo, hi] = computeDomain([10, 90], { min: 0 });

    expect(lo).toBe(0);
    expect(hi).toBe(90);
  });

  it('rounds outward with nice', () => {
    const [lo, hi] = computeDomain([2.3, 97.8], { nice: true });

    expect(lo).toBeLessThanOrEqual(2.3);
    expect(hi).toBeGreaterThanOrEqual(97.8);
  });

  it('applies padding AFTER nice so nice cannot round it away', () => {
    // The bug this guards: nice() snaps 97.8 up to 100, and if padding ran
    // first the headroom is absorbed and the top point sits on the axis.
    const withBoth = computeDomain([2.3, 97.8], { nice: true, padding: 0.05 });
    const niceOnly = computeDomain([2.3, 97.8], { nice: true });

    expect(withBoth[1]).toBeGreaterThan(niceOnly[1]);
    expect(withBoth[0]).toBeLessThan(niceOnly[0]);
  });

  it('never returns an inverted domain, even with swapped overrides', () => {
    const [lo, hi] = computeDomain([1, 10], { min: 100, max: 0 });

    expect(lo).toBeLessThan(hi);
  });

  it('never returns a zero-width domain from equal overrides', () => {
    const [lo, hi] = computeDomain([1, 10], { min: 5, max: 5 });

    expect(hi).toBeGreaterThan(lo);
  });
});
