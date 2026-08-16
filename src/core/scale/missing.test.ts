import { normaliseMissing } from './missing';

const HOLED = [1, null, undefined, 4, Number.NaN, 6];

describe('normaliseMissing — mask', () => {
  it('flags null, undefined and NaN identically', () => {
    const { valid } = normaliseMissing(HOLED, 'gap');

    expect(Array.from(valid)).toEqual([1, 0, 0, 1, 0, 1]);
  });

  it('produces the same mask under every policy', () => {
    const gap = normaliseMissing(HOLED, 'gap').valid;
    const zero = normaliseMissing(HOLED, 'zero').valid;
    const connect = normaliseMissing(HOLED, 'connect').valid;

    expect(Array.from(zero)).toEqual(Array.from(gap));
    expect(Array.from(connect)).toEqual(Array.from(gap));
  });

  it('handles an empty input', () => {
    const { values, valid } = normaliseMissing([], 'connect');

    expect(values.length).toBe(0);
    expect(valid.length).toBe(0);
  });
});

describe('normaliseMissing — gap', () => {
  it('emits NaN so the renderer can break the line', () => {
    const { values } = normaliseMissing(HOLED, 'gap');

    expect(values[0]).toBe(1);
    expect(Number.isNaN(values[1]!)).toBe(true);
    expect(Number.isNaN(values[2]!)).toBe(true);
    expect(values[3]).toBe(4);
  });

  it('is the default policy', () => {
    const { values } = normaliseMissing([1, null, 3]);

    expect(Number.isNaN(values[1]!)).toBe(true);
  });
});

describe('normaliseMissing — zero', () => {
  it('substitutes zero, distinguishable only via the mask', () => {
    const { values, valid } = normaliseMissing([5, null, 5], 'zero');

    expect(Array.from(values)).toEqual([5, 0, 5]);
    expect(valid[1]).toBe(0);
  });

  it('keeps a genuine zero distinguishable from a hole', () => {
    const { values, valid } = normaliseMissing([0, null], 'zero');

    expect(values[0]).toBe(0);
    expect(values[1]).toBe(0);
    expect(valid[0]).toBe(1);
    expect(valid[1]).toBe(0);
  });
});

describe('normaliseMissing — connect', () => {
  it('interpolates linearly across a single hole', () => {
    const { values } = normaliseMissing([0, null, 10], 'connect');

    expect(values[1]).toBeCloseTo(5, 5);
  });

  it('interpolates evenly across a run of holes', () => {
    const { values } = normaliseMissing([0, null, null, null, 4], 'connect');

    expect(values[1]).toBeCloseTo(1, 5);
    expect(values[2]).toBeCloseTo(2, 5);
    expect(values[3]).toBeCloseTo(3, 5);
  });

  it('carries the first known value backwards for a leading hole', () => {
    const { values } = normaliseMissing([null, null, 7, 9], 'connect');

    expect(values[0]).toBe(7);
    expect(values[1]).toBe(7);
  });

  it('carries the last known value forwards for a trailing hole', () => {
    const { values } = normaliseMissing([3, 5, null, null], 'connect');

    expect(values[2]).toBe(5);
    expect(values[3]).toBe(5);
  });

  it('leaves an all-missing series finite-free but does not hang', () => {
    const { values, valid } = normaliseMissing([null, null, null], 'connect');

    expect(Array.from(valid)).toEqual([0, 0, 0]);
    expect(values.length).toBe(3);
  });

  it('handles alternating holes', () => {
    const { values } = normaliseMissing([0, null, 2, null, 4], 'connect');

    expect(values[1]).toBeCloseTo(1, 5);
    expect(values[3]).toBeCloseTo(3, 5);
  });
});
