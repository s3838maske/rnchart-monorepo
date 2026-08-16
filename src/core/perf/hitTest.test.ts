import { createHitTester } from './hitTest';

function series(n: number, f: (i: number) => number): Float32Array {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    out[i * 2] = i;
    out[i * 2 + 1] = f(i);
  }
  return out;
}

describe('createHitTester — x mode', () => {
  const points = series(100, (i) => i * 2);
  const tester = createHitTester(points, 'x');

  it('finds an exact match', () => {
    expect(tester.find(42, 0)?.index).toBe(42);
  });

  it('snaps to the nearer neighbour', () => {
    expect(tester.find(42.4, 0)?.index).toBe(42);
    expect(tester.find(42.6, 0)?.index).toBe(43);
  });

  it('clamps below the first point', () => {
    expect(tester.find(-500, 0)?.index).toBe(0);
  });

  it('clamps past the last point', () => {
    expect(tester.find(1e6, 0)?.index).toBe(99);
  });

  it('reports the x distance', () => {
    const hit = tester.find(42.25, 0);
    expect(hit?.distance).toBeCloseTo(0.25, 5);
  });

  it('ignores y entirely', () => {
    expect(tester.find(10, -99999)?.index).toBe(tester.find(10, 99999)?.index);
  });

  it('returns null for an empty series', () => {
    expect(createHitTester(new Float32Array(0), 'x').find(5, 5)).toBeNull();
  });

  it('handles a single point', () => {
    const one = createHitTester(
      series(1, () => 7),
      'x'
    );
    expect(one.find(1000, 0)?.index).toBe(0);
  });

  it('is the default mode', () => {
    expect(createHitTester(points).mode).toBe('x');
  });
});

describe('createHitTester — nearest mode', () => {
  const points = new Float32Array([0, 0, 10, 10, 20, 0, 30, 10]);
  const tester = createHitTester(points, 'nearest');

  it('finds the visually nearest point', () => {
    expect(tester.find(11, 9)?.index).toBe(1);
    expect(tester.find(19, 1)?.index).toBe(2);
  });

  it('uses euclidean distance, not x distance', () => {
    // At (11, 0): nearest in X is index 1 (x=10, dx=1), but on screen index 2
    // is nearer — 9px away versus 10.05px. The two modes must disagree here,
    // which is exactly why scatter cannot reuse the binary-search tester.
    expect(tester.find(11, 0)?.index).toBe(2);
    expect(createHitTester(points, 'x').find(11, 0)?.index).toBe(1);
  });

  it('reports the euclidean distance', () => {
    const hit = tester.find(13, 14);
    expect(hit?.distance).toBeCloseTo(5, 5);
  });

  it('respects a search radius', () => {
    expect(tester.find(1000, 1000, 5)).toBeNull();
    expect(tester.find(10.5, 10.5, 5)?.index).toBe(1);
  });

  it('returns null for an empty series', () => {
    expect(
      createHitTester(new Float32Array(0), 'nearest').find(0, 0)
    ).toBeNull();
  });
});

/**
 * Timing lives in `yarn bench`, not here — see the note in decimate.test.ts.
 * What matters in a unit test is that the tester stays CORRECT at scale.
 */
describe('correctness at scale', () => {
  it('finds the right index in a 100,000-point series', () => {
    const points = series(100_000, (i) => Math.sin(i / 100));
    const tester = createHitTester(points, 'x');

    for (const probe of [0, 1, 49_999, 99_999]) {
      expect(tester.find(probe, 0)?.index).toBe(probe);
    }
  });

  it('builds a 50,000-point quadtree and queries it correctly', () => {
    const points = series(50_000, (i) => i % 100);
    const tester = createHitTester(points, 'nearest');

    const hit = tester.find(25_000, 0);
    expect(hit).not.toBeNull();
    expect(hit!.index).toBeGreaterThanOrEqual(0);
    expect(hit!.index).toBeLessThan(50_000);
  });
});
