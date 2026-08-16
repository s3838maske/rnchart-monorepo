import { clamp, createRect, VERSION } from './index';

describe('VERSION', () => {
  it('matches the package version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});

describe('clamp', () => {
  it('returns the value when it is already inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below the minimum', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('is inclusive at both bounds', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('returns the minimum when the bounds are inverted', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it('propagates NaN rather than inventing a number', () => {
    expect(clamp(Number.NaN, 0, 10)).toBeNaN();
  });

  it('handles infinite bounds', () => {
    expect(clamp(5, -Infinity, Infinity)).toBe(5);
    expect(clamp(Infinity, 0, 10)).toBe(10);
  });
});

describe('createRect', () => {
  it('preserves valid dimensions', () => {
    expect(createRect(1, 2, 30, 40)).toEqual({
      x: 1,
      y: 2,
      width: 30,
      height: 40,
    });
  });

  it('never produces a negative width or height', () => {
    const rect = createRect(0, 0, -100, -50);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  it('allows a negative origin', () => {
    const rect = createRect(-10, -20, 5, 5);
    expect(rect.x).toBe(-10);
    expect(rect.y).toBe(-20);
  });
});
