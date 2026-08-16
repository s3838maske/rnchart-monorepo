import fc from 'fast-check';

import { applyStacking } from './stacking';

describe('applyStacking — none', () => {
  it('leaves each series on its own baseline', () => {
    const [a, b] = applyStacking(
      [
        [3, -4],
        [5, 6],
      ],
      'none'
    );

    expect(Array.from(a!.low)).toEqual([0, -4]);
    expect(Array.from(a!.high)).toEqual([3, 0]);
    expect(Array.from(b!.low)).toEqual([0, 0]);
    expect(Array.from(b!.high)).toEqual([5, 6]);
  });
});

describe('applyStacking — normal', () => {
  it('stacks positives upward from zero', () => {
    const [a, b, c] = applyStacking([[1], [2], [3]], 'normal');

    expect(a!.low[0]).toBe(0);
    expect(a!.high[0]).toBe(1);
    expect(b!.low[0]).toBe(1);
    expect(b!.high[0]).toBe(3);
    expect(c!.low[0]).toBe(3);
    expect(c!.high[0]).toBe(6);
  });

  it('stacks negatives downward from zero', () => {
    const [a, b] = applyStacking([[-1], [-2]], 'normal');

    expect(a!.high[0]).toBe(0);
    expect(a!.low[0]).toBe(-1);
    expect(b!.high[0]).toBe(-1);
    expect(b!.low[0]).toBe(-3);
  });

  it('does NOT let positives and negatives cancel', () => {
    // The "bar with negative stack" case. +5 and -5 must span -5..+5, not
    // collapse to an empty stack.
    const [a, b] = applyStacking([[5], [-5]], 'normal');

    expect(a!.low[0]).toBe(0);
    expect(a!.high[0]).toBe(5);
    expect(b!.high[0]).toBe(0);
    expect(b!.low[0]).toBe(-5);

    const spanLow = Math.min(a!.low[0]!, b!.low[0]!);
    const spanHigh = Math.max(a!.high[0]!, b!.high[0]!);
    expect(spanLow).toBe(-5);
    expect(spanHigh).toBe(5);
  });

  it('treats missing and non-finite entries as zero', () => {
    const [a, b] = applyStacking(
      [
        [Number.NaN, 2],
        [3, 4],
      ],
      'normal'
    );

    expect(a!.high[0]).toBe(0);
    expect(b!.low[0]).toBe(0);
    expect(b!.high[0]).toBe(3);
  });

  it('pads shorter series to the longest length', () => {
    const [a, b] = applyStacking([[1, 2, 3], [10]], 'normal');

    expect(a!.high.length).toBe(3);
    expect(b!.high.length).toBe(3);
    expect(b!.high[1]).toBe(2); // nothing added on top of series a
  });

  it('returns an empty array for no series', () => {
    expect(applyStacking([], 'normal')).toEqual([]);
  });
});

describe('applyStacking — percent', () => {
  it('sums to exactly 100 at every x', () => {
    const stacked = applyStacking(
      [
        [10, 1, 7],
        [30, 2, 1],
        [60, 7, 2],
      ],
      'percent'
    );

    for (let i = 0; i < 3; i += 1) {
      const total = stacked.reduce(
        (sum, s) => sum + (s.high[i]! - s.low[i]!),
        0
      );
      expect(total).toBeCloseTo(100, 4);
    }
  });

  it('normalises absolute magnitudes when signs are mixed', () => {
    // +8 and -2 → 80% up and 20% down, not 400% and -100%.
    // `high - low` is a HEIGHT and so is never negative; the sign of the datum
    // shows up in the position, with the negative segment sitting below zero.
    const [a, b] = applyStacking([[8], [-2]], 'percent');

    expect(a!.high[0]! - a!.low[0]!).toBeCloseTo(80, 4);
    expect(a!.low[0]).toBeCloseTo(0, 4);

    expect(b!.high[0]! - b!.low[0]!).toBeCloseTo(20, 4);
    expect(b!.high[0]).toBeCloseTo(0, 4);
    expect(b!.low[0]).toBeCloseTo(-20, 4);
  });

  it('leaves an all-zero column at zero instead of dividing by zero', () => {
    const [a, b] = applyStacking([[0], [0]], 'percent');

    expect(Number.isFinite(a!.high[0]!)).toBe(true);
    expect(Number.isFinite(b!.high[0]!)).toBe(true);
    expect(a!.high[0]).toBe(0);
    expect(b!.high[0]).toBe(0);
  });

  it('percent stacking of any input sums to 100 (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.double({ min: -1e4, max: 1e4, noNaN: true }), {
            minLength: 1,
            maxLength: 6,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (series) => {
          const width = Math.max(...series.map((s) => s.length));
          const padded = series.map((s) => {
            const out = new Float32Array(width);
            s.forEach((v, i) => {
              out[i] = v;
            });
            return out;
          });

          const stacked = applyStacking(padded, 'percent');

          for (let i = 0; i < width; i += 1) {
            const magnitude = padded.reduce(
              (sum, s) => sum + Math.abs(s[i]!),
              0
            );
            const spanned = stacked.reduce(
              (sum, s) => sum + Math.abs(s.high[i]! - s.low[i]!),
              0
            );

            // Columns with no magnitude legitimately span nothing.
            if (magnitude === 0) expect(spanned).toBeCloseTo(0, 3);
            else expect(spanned).toBeCloseTo(100, 2);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
