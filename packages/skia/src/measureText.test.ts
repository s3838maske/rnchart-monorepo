import { createMeasureText } from './measureText';

type FakeFont = {
  getTextWidth: (t: string) => number;
  getMetrics: () => { ascent: number; descent: number } | undefined;
};

function fakeFont(overrides: Partial<FakeFont> = {}): FakeFont {
  return {
    getTextWidth: (t) => t.length * 7,
    getMetrics: () => ({ ascent: -9, descent: 3 }),
    ...overrides,
  };
}

// The real parameter is an SkFont; only these two methods are exercised.
const asFont = (f: FakeFont): never => f as never;

describe('createMeasureText — without a font', () => {
  const measure = createMeasureText(null);

  it('estimates rather than returning zero', () => {
    // A zero-width measurement makes the layout solver reserve no space, and
    // the first frame renders with its axis labels clipped.
    const { width, height } = measure('Hello', 11);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('estimates wider for longer text', () => {
    expect(measure('mmmmmmmm', 11).width).toBeGreaterThan(
      measure('mm', 11).width
    );
  });
});

describe('createMeasureText — with a font', () => {
  it('uses the font metrics', () => {
    const measure = createMeasureText(asFont(fakeFont()));
    const { width, height } = measure('abcd', 11);

    expect(width).toBe(28);
    expect(height).toBe(12); // |ascent| + |descent|
  });

  it('falls back to an estimate when the font returns non-finite values', () => {
    const measure = createMeasureText(
      asFont(fakeFont({ getTextWidth: () => Number.NaN }))
    );

    expect(Number.isFinite(measure('abc', 11).width)).toBe(true);
  });

  it('falls back when metrics are unavailable', () => {
    const measure = createMeasureText(
      asFont(fakeFont({ getMetrics: () => undefined }))
    );

    expect(measure('abc', 12).height).toBeCloseTo(14.4, 5);
  });

  it('caches repeat measurements instead of re-entering native', () => {
    let calls = 0;
    const measure = createMeasureText(
      asFont(
        fakeFont({
          getTextWidth: (t) => {
            calls += 1;
            return t.length * 7;
          },
        })
      )
    );

    measure('January', 11);
    measure('January', 11);
    measure('January', 11);

    expect(calls).toBe(1);
  });

  it('keys the cache on font size', () => {
    let calls = 0;
    const measure = createMeasureText(
      asFont(
        fakeFont({
          getTextWidth: (t) => {
            calls += 1;
            return t.length * 7;
          },
        })
      )
    );

    measure('x', 11);
    measure('x', 13);

    expect(calls).toBe(2);
  });

  it('evicts the oldest entry once capacity is reached', () => {
    let calls = 0;
    const measure = createMeasureText(
      asFont(
        fakeFont({
          getTextWidth: (t) => {
            calls += 1;
            return t.length * 7;
          },
        })
      ),
      { capacity: 2 }
    );

    measure('a', 11); // 1
    measure('b', 11); // 2
    measure('c', 11); // 3 — evicts 'a'
    const before = calls;
    measure('a', 11); // recomputed

    expect(calls).toBe(before + 1);
  });

  it('keeps a recently used entry alive under eviction pressure', () => {
    let calls = 0;
    const measure = createMeasureText(
      asFont(
        fakeFont({
          getTextWidth: (t) => {
            calls += 1;
            return t.length * 7;
          },
        })
      ),
      { capacity: 2 }
    );

    measure('a', 11);
    measure('b', 11);
    measure('a', 11); // refreshes 'a', making 'b' the oldest
    measure('c', 11); // evicts 'b', not 'a'

    const before = calls;
    measure('a', 11);

    expect(calls).toBe(before); // still cached
  });
});
