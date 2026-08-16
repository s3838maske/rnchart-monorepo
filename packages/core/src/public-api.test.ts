import {
  applyStacking,
  clamp,
  computeDomain,
  createRect,
  createScale,
  normaliseMissing,
  VERSION,
} from './index';

/**
 * Guards the public surface itself.
 *
 * Every other test imports modules directly, which means a broken barrel
 * export would not fail anything — consumers would be the ones to find out.
 */
describe('@rnchart/core public API', () => {
  it('exports the phase 1 and phase 2 surface', () => {
    expect(VERSION).toBe('0.1.0');
    expect(typeof clamp).toBe('function');
    expect(typeof createRect).toBe('function');
    expect(typeof createScale).toBe('function');
    expect(typeof computeDomain).toBe('function');
    expect(typeof applyStacking).toBe('function');
    expect(typeof normaliseMissing).toBe('function');
  });

  it('composes end to end: raw data through to pixels', () => {
    // The path every chart takes in phase 5 onward, exercised in miniature.
    const raw = [10, null, 30, 40];

    const { values, valid } = normaliseMissing(raw, 'connect');
    expect(valid[1]).toBe(0);
    expect(values[1]).toBeCloseTo(20, 5);

    const domain = computeDomain(values, { includeZero: true, padding: 0.05 });
    expect(domain[0]).toBeLessThanOrEqual(0);
    expect(domain[1]).toBeGreaterThan(40);

    const scale = createScale({ type: 'linear', domain, range: [200, 0] });
    expect(scale.map(domain[0])).toBeCloseTo(200, 6);
    expect(scale.map(domain[1])).toBeCloseTo(0, 6);

    const stacked = applyStacking([values, values], 'percent');
    const height =
      stacked[0]!.high[0]! -
      stacked[0]!.low[0]! +
      (stacked[1]!.high[0]! - stacked[1]!.low[0]!);
    expect(height).toBeCloseTo(100, 3);
  });
});
