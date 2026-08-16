import fc from 'fast-check';

import { createScale } from './createScale';
import type { ContinuousScaleType } from './types';

const CONTINUOUS: ContinuousScaleType[] = ['linear', 'log', 'time', 'sqrt'];

describe('createScale — range endpoints', () => {
  // The phase 2 acceptance test: every scale type must land exactly on its
  // range endpoints. If this drifts, every axis in the library is off by a
  // sub-pixel amount that compounds.
  it.each(CONTINUOUS)('%s maps domain endpoints to range endpoints', (type) => {
    const domain: [number, number] = type === 'log' ? [1, 1000] : [0, 100];
    const scale = createScale({ type, domain, range: [0, 500] });

    expect(scale.map(domain[0])).toBeCloseTo(0, 9);
    expect(scale.map(domain[1])).toBeCloseTo(500, 9);
  });

  it('honours an inverted range, as a y-axis needs', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 10],
      range: [400, 0],
    });

    expect(scale.map(0)).toBeCloseTo(400, 9);
    expect(scale.map(10)).toBeCloseTo(0, 9);
    expect(scale.map(5)).toBeCloseTo(200, 9);
  });

  it('clamps to the range when clamp is set', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 10],
      range: [0, 100],
      clamp: true,
    });

    expect(scale.map(-5)).toBe(0);
    expect(scale.map(50)).toBe(100);
  });

  it('extrapolates beyond the range when clamp is not set', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 10],
      range: [0, 100],
    });

    expect(scale.map(20)).toBeCloseTo(200, 9);
  });
});

describe('createScale — log safety', () => {
  it('never emits Infinity or NaN for a domain touching zero', () => {
    const scale = createScale({
      type: 'log',
      domain: [0, 100],
      range: [0, 300],
    });

    for (const v of [0, -1, -1e9, 0.5, 100]) {
      const pixel = scale.map(v);
      expect(Number.isFinite(pixel)).toBe(true);
    }
  });

  it('clamps a non-positive domain to the smallest positive value present', () => {
    const scale = createScale({
      type: 'log',
      domain: [0, 250],
      range: [0, 100],
    });

    expect(scale.domain).toEqual([250, 250 * 10]);
  });

  it('reports non-positive inputs as unsupported rather than hiding them', () => {
    const scale = createScale({
      type: 'log',
      domain: [1, 100],
      range: [0, 100],
    });

    expect(scale.supports(10)).toBe(true);
    expect(scale.supports(0)).toBe(false);
    expect(scale.supports(-3)).toBe(false);
    expect(scale.supports(Number.NaN)).toBe(false);
  });

  it('survives an all-negative domain', () => {
    const scale = createScale({
      type: 'log',
      domain: [-100, -1],
      range: [0, 100],
    });

    expect(Number.isFinite(scale.map(5))).toBe(true);
    expect(Number.isFinite(scale.map(-5))).toBe(true);
  });

  it('treats non-finite input as the range start rather than propagating it', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 10],
      range: [7, 100],
    });

    expect(scale.map(Number.NaN)).toBe(7);
    expect(scale.map(Number.POSITIVE_INFINITY)).toBe(7);
  });
});

describe('createScale — band', () => {
  const domain = ['Jan', 'Feb', 'Mar', 'Apr'];

  it('exposes a positive bandwidth and step', () => {
    const scale = createScale({ type: 'band', domain, range: [0, 400] });

    expect(scale.bandwidth).toBeGreaterThan(0);
    expect(scale.step).toBeGreaterThanOrEqual(scale.bandwidth);
  });

  it('places bands in order across the range', () => {
    const scale = createScale({ type: 'band', domain, range: [0, 400] });
    const positions = domain.map((d) => scale.map(d));

    expect(positions[0]).toBeLessThan(positions[1] as number);
    expect(positions[1]).toBeLessThan(positions[2] as number);
    expect(positions[2]).toBeLessThan(positions[3] as number);
    expect(positions[3]).toBeLessThan(400);
  });

  it('accepts a numeric index where a category is expected', () => {
    const scale = createScale({ type: 'band', domain, range: [0, 400] });

    expect(scale.map(2)).toBeCloseTo(scale.map('Mar'), 9);
  });

  it('inverts a pixel back to a category index, clamped to the domain', () => {
    const scale = createScale({ type: 'band', domain, range: [0, 400] });

    expect(scale.invert(scale.map('Jan') + 1)).toBe(0);
    expect(scale.invert(scale.map('Mar') + 1)).toBe(2);
    expect(scale.invert(-999)).toBe(0);
    expect(scale.invert(99999)).toBe(3);
  });

  it('applies padding', () => {
    const tight = createScale({ type: 'band', domain, range: [0, 400] });
    const padded = createScale({
      type: 'band',
      domain,
      range: [0, 400],
      padding: 0.5,
    });

    expect(padded.bandwidth).toBeLessThan(tight.bandwidth);
  });

  it('handles an empty domain without dividing by zero', () => {
    const scale = createScale({ type: 'band', domain: [], range: [0, 400] });

    expect(scale.invert(200)).toBe(0);
    expect(scale.ticks(5)).toEqual([]);
    expect(scale.map('anything')).toBe(0);
  });

  it('falls back to the range start for an unknown category', () => {
    const scale = createScale({ type: 'band', domain, range: [10, 400] });

    expect(scale.map('NotAMonth')).toBe(10);
  });

  it('falls back to the range start for an out-of-bounds index', () => {
    const scale = createScale({ type: 'band', domain, range: [10, 400] });

    expect(scale.map(99)).toBe(10);
    expect(scale.map(-1)).toBe(10);
    expect(scale.map(1.5)).toBe(10);
  });

  it('supports numeric-category domains directly', () => {
    const scale = createScale({
      type: 'band',
      domain: [2020, 2021, 2022],
      range: [0, 300],
    });

    expect(scale.map(2021)).toBeGreaterThan(scale.map(2020));
    expect(scale.invert(scale.map(2022) + 1)).toBe(2);
  });

  it('respects paddingInner, paddingOuter and align', () => {
    const scale = createScale({
      type: 'band',
      domain,
      range: [0, 400],
      paddingInner: 0.2,
      paddingOuter: 0.4,
      align: 0.5,
    });

    expect(scale.bandwidth).toBeGreaterThan(0);
    expect(scale.step).toBeGreaterThan(scale.bandwidth);
  });
});

describe('createScale — point', () => {
  const domain = ['A', 'B', 'C'];

  it('has zero bandwidth but a positive step', () => {
    const scale = createScale({ type: 'point', domain, range: [0, 300] });

    expect(scale.bandwidth).toBe(0);
    expect(scale.step).toBeGreaterThan(0);
  });

  it('inverts to the nearest category index', () => {
    const scale = createScale({ type: 'point', domain, range: [0, 300] });

    expect(scale.invert(scale.map('A'))).toBe(0);
    expect(scale.invert(scale.map('C'))).toBe(2);
  });

  it('handles an empty domain', () => {
    const scale = createScale({ type: 'point', domain: [], range: [0, 300] });

    expect(scale.invert(100)).toBe(0);
    expect(scale.map('x')).toBe(0);
  });

  it('accepts a numeric index where a category is expected', () => {
    const scale = createScale({ type: 'point', domain, range: [0, 300] });

    expect(scale.map(1)).toBeCloseTo(scale.map('B'), 9);
  });

  it('falls back to the range start for unknown or out-of-bounds input', () => {
    const scale = createScale({ type: 'point', domain, range: [12, 300] });

    expect(scale.map('Z')).toBe(12);
    expect(scale.map(42)).toBe(12);
  });

  it('applies padding', () => {
    const scale = createScale({
      type: 'point',
      domain,
      range: [0, 300],
      padding: 0.5,
    });

    expect(scale.map('A')).toBeGreaterThan(0);
  });
});

describe('createScale — ticks', () => {
  it('returns numeric ticks inside the domain for continuous scales', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 100],
      range: [0, 500],
    });
    const ticks = scale.ticks(5);

    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(100);
    }
  });

  it('returns category indices for band scales', () => {
    const scale = createScale({
      type: 'band',
      domain: ['a', 'b', 'c'],
      range: [0, 300],
    });

    expect(scale.ticks(10)).toEqual([0, 1, 2]);
  });

  it('returns category indices for point scales', () => {
    const scale = createScale({
      type: 'point',
      domain: ['a', 'b'],
      range: [0, 300],
    });

    expect(scale.ticks(10)).toEqual([0, 1]);
  });
});

describe('createScale — supports on ordinal scales', () => {
  it.each(['band', 'point'] as const)(
    '%s accepts finite input and rejects the rest',
    (type) => {
      const scale = createScale({ type, domain: ['a', 'b'], range: [0, 100] });

      expect(scale.supports(0)).toBe(true);
      expect(scale.supports(-4)).toBe(true);
      expect(scale.supports(Number.NaN)).toBe(false);
      expect(scale.supports(Number.POSITIVE_INFINITY)).toBe(false);
    }
  );
});

describe('createScale — round-trip property', () => {
  // invert(map(v)) ≈ v is the invariant every interaction feature depends on:
  // the tooltip in phase 12 and the pan/zoom viewport in phase 19 both convert
  // pixels back to data values on every frame.
  it('linear: invert(map(v)) recovers v', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (a, b, v) => {
          fc.pre(Math.abs(a - b) > 1e-3);
          const domain: [number, number] = a < b ? [a, b] : [b, a];
          const scale = createScale({
            type: 'linear',
            domain,
            range: [0, 800],
          });

          const recovered = scale.invert(scale.map(v));
          const tolerance = Math.max(1e-6, Math.abs(v) * 1e-6);
          expect(Math.abs(recovered - v)).toBeLessThanOrEqual(tolerance);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('log: invert(map(v)) recovers v for positive values', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-3, max: 1e6, noNaN: true }), (v) => {
        const scale = createScale({
          type: 'log',
          domain: [1e-3, 1e6],
          range: [0, 800],
        });

        const recovered = scale.invert(scale.map(v));
        expect(Math.abs(recovered - v)).toBeLessThanOrEqual(
          Math.abs(v) * 1e-6 + 1e-9
        );
      }),
      { numRuns: 300 }
    );
  });

  it('sqrt: invert(map(v)) recovers v', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (v) => {
        const scale = createScale({
          type: 'sqrt',
          domain: [0, 1e6],
          range: [0, 800],
        });

        const recovered = scale.invert(scale.map(v));
        expect(Math.abs(recovered - v)).toBeLessThanOrEqual(
          Math.abs(v) * 1e-6 + 1e-6
        );
      }),
      { numRuns: 300 }
    );
  });

  it('never produces non-finite pixels for any finite input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ContinuousScaleType>('linear', 'log', 'time', 'sqrt'),
        fc.double({ min: -1e9, max: 1e9, noNaN: true }),
        (type, v) => {
          const domain: [number, number] =
            type === 'log' ? [1, 1e6] : [-1e6, 1e6];
          const scale = createScale({ type, domain, range: [0, 500] });

          expect(Number.isFinite(scale.map(v))).toBe(true);
        }
      ),
      { numRuns: 400 }
    );
  });
});
