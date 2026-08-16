import { createScale } from '../scale/createScale';
import { generateTicks } from './ticks';
import { resolveCollisions } from './collisions';
import type { LabelledTick } from './ticks';

describe('generateTicks — count derives from pixels, not a constant', () => {
  it('produces fewer ticks in less space', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 1000],
      range: [0, 1000],
    });

    const narrow = generateTicks(scale, 120);
    const wide = generateTicks(scale, 1200);

    expect(narrow.length).toBeLessThan(wide.length);
  });

  it('returns value, position and label together', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 100],
      range: [0, 500],
    });

    const [first] = generateTicks(scale, 500);

    expect(first).toBeDefined();
    expect(typeof first!.value).toBe('number');
    expect(typeof first!.position).toBe('number');
    expect(typeof first!.label).toBe('string');
  });

  it('positions ticks inside the range', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 100],
      range: [30, 530],
    });

    for (const tick of generateTicks(scale, 500)) {
      expect(tick.position).toBeGreaterThanOrEqual(30);
      expect(tick.position).toBeLessThanOrEqual(530);
    }
  });

  it('never emits a tick a log scale cannot represent', () => {
    const scale = createScale({
      type: 'log',
      domain: [1, 1e6],
      range: [0, 400],
    });

    for (const tick of generateTicks(scale, 400)) {
      expect(tick.value).toBeGreaterThan(0);
      expect(Number.isFinite(tick.position)).toBe(true);
    }
  });

  it('handles a zero-width available space', () => {
    const scale = createScale({
      type: 'linear',
      domain: [0, 10],
      range: [0, 100],
    });

    expect(() => generateTicks(scale, 0)).not.toThrow();
  });
});

describe('generateTicks — time snaps to natural boundaries', () => {
  it('lands on month starts across a year', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2026, 11, 31);
    const scale = createScale({
      type: 'time',
      domain: [start, end],
      range: [0, 800],
    });

    const ticks = generateTicks(scale, 800);
    expect(ticks.length).toBeGreaterThan(2);

    // Month-start ticks fall on day 1 in local time.
    const onDayOne = ticks.filter((t) => new Date(t.value).getDate() === 1);
    expect(onDayOne.length).toBeGreaterThanOrEqual(ticks.length - 1);
  });

  it('picks a finer granularity for a single day', () => {
    const start = Date.UTC(2026, 0, 1, 0);
    const end = Date.UTC(2026, 0, 1, 23);
    const scale = createScale({
      type: 'time',
      domain: [start, end],
      range: [0, 600],
    });

    const ticks = generateTicks(scale, 600);
    expect(ticks.length).toBeGreaterThan(1);

    const spans = ticks.slice(1).map((t, i) => t.value - ticks[i]!.value);
    for (const span of spans) expect(span).toBeLessThan(24 * 3.6e6);
  });

  it('handles a zero-width time domain', () => {
    const t = Date.UTC(2026, 5, 1);
    const scale = createScale({
      type: 'time',
      domain: [t, t],
      range: [0, 100],
    });

    expect(() => generateTicks(scale, 100)).not.toThrow();
  });
});

describe('generateTicks — ordinal axes', () => {
  it('centres band ticks in their band', () => {
    const scale = createScale({
      type: 'band',
      domain: ['a', 'b', 'c'],
      range: [0, 300],
    });

    const ticks = generateTicks(scale, 300);
    expect(ticks).toHaveLength(3);
    expect(ticks[0]!.position).toBeCloseTo(
      scale.map('a') + scale.bandwidth / 2,
      6
    );
  });

  it('thins categories by whole steps when space is tight', () => {
    const domain = Array.from({ length: 40 }, (_, i) => `cat-${i}`);
    const scale = createScale({ type: 'band', domain, range: [0, 200] });

    const ticks = generateTicks(scale, 200);
    expect(ticks.length).toBeLessThan(domain.length);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('labels numeric categories through the formatter', () => {
    const scale = createScale({
      type: 'band',
      domain: [1000, 2000],
      range: [0, 200],
    });

    const ticks = generateTicks(scale, 200);
    expect(ticks[0]!.label).toBe('1k');
  });
});

describe('resolveCollisions', () => {
  const evenly = (count: number, spacing: number): LabelledTick[] =>
    Array.from({ length: count }, (_, i) => ({
      value: i,
      position: i * spacing,
      label: `Label ${i}`,
    }));

  it('leaves well-spaced labels untouched', () => {
    const ticks = evenly(4, 200);
    const out = resolveCollisions(ticks, 800, 'auto', {
      labelWidths: ticks.map(() => 40),
    });

    expect(out.every((t) => !t.hidden && t.rotation === 0)).toBe(true);
  });

  it('skips alternates first under auto', () => {
    const ticks = evenly(12, 26);
    const out = resolveCollisions(ticks, 320, 'auto', {
      labelWidths: ticks.map(() => 44),
    });

    expect(out.some((t) => t.hidden)).toBe(true);
  });

  it('rotates when skipping cannot resolve it', () => {
    const ticks = evenly(6, 20);
    const out = resolveCollisions(ticks, 120, 'rotate', {
      labelWidths: ticks.map(() => 90),
    });

    expect(out.every((t) => t.rotation !== 0)).toBe(true);
  });

  it('truncates with an ellipsis when asked', () => {
    const ticks = evenly(6, 20);
    const out = resolveCollisions(ticks, 120, 'truncate', {
      labelWidths: ticks.map(() => 90),
      charWidthPx: 7,
    });

    expect(out.some((t) => t.label.endsWith('…'))).toBe(true);
  });

  it('does nothing under the none strategy', () => {
    const ticks = evenly(12, 5);
    const out = resolveCollisions(ticks, 60, 'none', {
      labelWidths: ticks.map(() => 80),
    });

    expect(out.every((t) => !t.hidden && t.rotation === 0)).toBe(true);
  });

  it('handles zero and one tick', () => {
    expect(resolveCollisions([], 100, 'auto', { labelWidths: [] })).toEqual([]);
    const single = evenly(1, 0);
    expect(
      resolveCollisions(single, 100, 'auto', { labelWidths: [500] })
    ).toHaveLength(1);
  });

  it('always keeps at least one label under skip', () => {
    const ticks = evenly(20, 2);
    const out = resolveCollisions(ticks, 40, 'skip', {
      labelWidths: ticks.map(() => 120),
    });

    expect(out.filter((t) => !t.hidden).length).toBeGreaterThanOrEqual(1);
  });
});
