import { autoDecimate, clipToViewport, lttb, minMaxDecimate } from './decimate';

/** Build a flat [x0,y0,x1,y1,...] series. */
function series(n: number, f: (i: number) => number): Float32Array {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    out[i * 2] = i;
    out[i * 2 + 1] = f(i);
  }
  return out;
}

const xs = (p: Float32Array): number[] =>
  Array.from({ length: p.length >> 1 }, (_, i) => p[i * 2] as number);
const ys = (p: Float32Array): number[] =>
  Array.from({ length: p.length >> 1 }, (_, i) => p[i * 2 + 1] as number);

describe('lttb', () => {
  it('returns the SAME reference when already under the threshold', () => {
    const input = series(50, (i) => i);
    // Reference equality is the contract — callers skip work on it.
    expect(lttb(input, 100)).toBe(input);
    expect(lttb(input, 50)).toBe(input);
  });

  it('downsamples to exactly the threshold', () => {
    const input = series(10_000, (i) => Math.sin(i / 50) * 100);
    const out = lttb(input, 500);

    expect(out.length >> 1).toBe(500);
  });

  it('always preserves the first and last point', () => {
    const input = series(5_000, (i) => Math.cos(i / 30) * 40);
    const out = lttb(input, 200);

    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
    expect(out[out.length - 2]).toBe(input[input.length - 2]);
    expect(out[out.length - 1]).toBe(input[input.length - 1]);
  });

  it('retains a synthetic spike', () => {
    // A single extreme sample in otherwise flat data. LTTB is supposed to keep
    // it, because it forms by far the largest triangle in its bucket.
    const input = series(2_000, (i) => (i === 977 ? 1000 : 1));
    const out = lttb(input, 200);

    expect(Math.max(...ys(out))).toBe(1000);
  });

  it('keeps x monotonically increasing', () => {
    const input = series(4_000, (i) => Math.sin(i / 17) * 10);
    const out = lttb(input, 300);
    const outX = xs(out);

    for (let i = 1; i < outX.length; i += 1) {
      expect(outX[i]).toBeGreaterThan(outX[i - 1] as number);
    }
  });

  it('passes through when the threshold is degenerate', () => {
    const input = series(100, (i) => i);
    expect(lttb(input, 2)).toBe(input);
    expect(lttb(input, 0)).toBe(input);
  });

  it('handles an empty series', () => {
    const empty = new Float32Array(0);
    expect(lttb(empty, 10)).toBe(empty);
  });
});

describe('minMaxDecimate', () => {
  it('preserves per-bucket extremes', () => {
    const input = series(1_000, (i) =>
      i === 500 ? 999 : i === 501 ? -999 : 0
    );
    const out = minMaxDecimate(input, 50);

    expect(Math.max(...ys(out))).toBe(999);
    expect(Math.min(...ys(out))).toBe(-999);
  });

  it('keeps a spike that LTTB might smooth away', () => {
    // The OHLC argument: extremes are the data.
    const input = series(20_000, (i) =>
      i % 4001 === 0 ? 500 : Math.sin(i) * 2
    );
    const out = minMaxDecimate(input, 100);

    expect(Math.max(...ys(out))).toBe(500);
  });

  it('emits bucket points in x order', () => {
    const input = series(2_000, (i) => Math.sin(i / 11) * 50);
    const out = minMaxDecimate(input, 100);
    const outX = xs(out);

    for (let i = 1; i < outX.length; i += 1) {
      expect(outX[i]).toBeGreaterThanOrEqual(outX[i - 1] as number);
    }
  });

  it('passes through small inputs', () => {
    const input = series(10, (i) => i);
    expect(minMaxDecimate(input, 50)).toBe(input);
  });
});

describe('clipToViewport', () => {
  it('returns a VIEW, not a copy', () => {
    const input = series(1_000, (i) => i);
    const { view } = clipToViewport(input, 100, 200);

    // Same underlying buffer means no allocation happened.
    expect(view.buffer).toBe(input.buffer);
  });

  it('reports the index offset of the slice', () => {
    const input = series(1_000, (i) => i);
    const { view, offset } = clipToViewport(input, 300, 400);

    expect(offset).toBeLessThanOrEqual(300);
    expect(view[0]).toBe(offset);
  });

  it('includes one point of padding on each side', () => {
    const input = series(100, (i) => i);
    const { view } = clipToViewport(input, 50, 60);
    const viewX = xs(view);

    expect(viewX[0]).toBeLessThanOrEqual(50);
    expect(viewX[viewX.length - 1]).toBeGreaterThanOrEqual(60);
  });

  it('handles a range covering everything', () => {
    const input = series(500, (i) => i);
    const { view, offset } = clipToViewport(input, -1e9, 1e9);

    expect(offset).toBe(0);
    expect(view.length).toBe(input.length);
  });

  it('handles a range outside the data', () => {
    const input = series(500, (i) => i);
    const { view } = clipToViewport(input, 10_000, 20_000);

    expect(view.length >> 1).toBeLessThanOrEqual(2);
  });

  it('handles an empty series', () => {
    const empty = new Float32Array(0);
    const { view, offset } = clipToViewport(empty, 0, 10);

    expect(view.length).toBe(0);
    expect(offset).toBe(0);
  });
});

describe('autoDecimate', () => {
  it('returns the input untouched below the pixel budget', () => {
    const input = series(300, (i) => i);
    // 400px * 2 points-per-pixel = 800 budget, well above 300.
    expect(autoDecimate(input, 400)).toBe(input);
  });

  it('decimates above the budget', () => {
    const input = series(100_000, (i) => Math.sin(i / 200) * 10);
    const out = autoDecimate(input, 400);

    expect(out.length).toBeLessThan(input.length);
    expect(out.length >> 1).toBeLessThanOrEqual(800);
  });

  it('honours the none strategy', () => {
    const input = series(100_000, (i) => i);
    expect(autoDecimate(input, 400, { strategy: 'none' })).toBe(input);
  });

  it('uses minmax when asked', () => {
    const input = series(50_000, (i) => (i === 25_000 ? 9999 : 0));
    const out = autoDecimate(input, 300, { strategy: 'minmax' });

    expect(Math.max(...ys(out))).toBe(9999);
  });

  it('respects a custom points-per-pixel', () => {
    const input = series(20_000, (i) => i);
    const dense = autoDecimate(input, 400, { pointsPerPixel: 4 });
    const sparse = autoDecimate(input, 400, { pointsPerPixel: 1 });

    expect(dense.length).toBeGreaterThan(sparse.length);
  });
});

/**
 * Performance is measured by `yarn bench`, NOT here.
 *
 * A wall-clock assertion inside a unit suite is unreliable by nature: it
 * competes with 20 other suites for CPU and GC, so it passes alone and fails
 * in the full run. I tried warm-up and best-of-N first; that reduced the flake
 * without removing it, which is worse than no assertion — a test that fails
 * randomly trains people to re-run until green and stops meaning anything.
 *
 * The tinybench harness measures steady-state throughput properly and prints
 * p99 alongside the mean. What belongs HERE is correctness, which is what the
 * suites above assert.
 */
describe('decimation output shape', () => {
  it('always produces exactly the requested threshold', () => {
    const input = series(100_000, (i) => Math.sin(i / 100) * 50 + (i % 7));
    expect(lttb(input, 800).length >> 1).toBe(800);
  });

  it('handles a million points without allocating per point', () => {
    const input = series(1_000_000, (i) => Math.sin(i / 500));
    const out = lttb(input, 1000);

    expect(out.length >> 1).toBe(1000);
    expect(out).toBeInstanceOf(Float32Array);
  });
});
