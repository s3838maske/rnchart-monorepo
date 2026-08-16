import { formatValue } from './format';

describe('formatValue — compact', () => {
  it.each([
    [1200, '1.2k'],
    [3_400_000, '3.4M'],
    [1_000, '1k'],
    [999, '999'],
    [2_500_000_000, '2.5B'],
    [1_500_000_000_000, '1.5T'],
    [-1200, '-1.2k'],
    [0, '0'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatValue(input, { type: 'compact' })).toBe(expected);
  });

  it('drops the decimal above 10 units', () => {
    expect(formatValue(45_000, { type: 'compact' })).toBe('45k');
  });

  it('honours an explicit decimal count', () => {
    expect(formatValue(1234, { type: 'compact', decimals: 2 })).toBe('1.23k');
  });
});

describe('formatValue — other types', () => {
  it('formats plain numbers', () => {
    expect(formatValue(1234.5, { type: 'number', locale: 'en-US' })).toContain(
      '1,234'
    );
  });

  it('formats currency', () => {
    const out = formatValue(1500, {
      type: 'currency',
      currency: 'INR',
      locale: 'en-IN',
    });
    expect(out).toMatch(/1,500/);
  });

  it('formats percent', () => {
    expect(formatValue(0.42, { type: 'percent', locale: 'en-US' })).toBe('42%');
  });

  it('formats time', () => {
    const out = formatValue(Date.UTC(2026, 0, 15), {
      type: 'time',
      locale: 'en-US',
    });
    expect(out.length).toBeGreaterThan(0);
  });

  it('respects a custom formatter over everything else', () => {
    expect(
      formatValue(5, { type: 'currency', formatter: (v) => `<${v}>` })
    ).toBe('<5>');
  });

  it('returns an empty string for non-finite input', () => {
    expect(formatValue(Number.NaN)).toBe('');
    expect(formatValue(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatValue(Number.NaN, { type: 'time' })).toBe('');
  });

  it('applies a fixed decimal count', () => {
    expect(
      formatValue(3.14159, { type: 'number', decimals: 2, locale: 'en-US' })
    ).toBe('3.14');
  });
});
