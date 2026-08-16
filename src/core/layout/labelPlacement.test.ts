import { resolveLabelPlacement } from './labelPlacement';
import type { LabelCandidate } from './labelPlacement';

const label = (
  id: string,
  x: number,
  y: number,
  priority = 0,
  nudgeable = false
): LabelCandidate => ({
  id,
  rect: { x, y, width: 40, height: 12 },
  priority,
  ...(nudgeable ? { nudgeable: true } : {}),
});

describe('resolveLabelPlacement', () => {
  it('keeps every label when nothing overlaps', () => {
    const out = resolveLabelPlacement([
      label('a', 0, 0),
      label('b', 100, 0),
      label('c', 200, 0),
    ]);

    expect(out.every((l) => l.visible)).toBe(true);
  });

  it('drops the lower-priority label of an overlapping pair', () => {
    const out = resolveLabelPlacement([
      label('low', 0, 0, 1),
      label('high', 5, 0, 9),
    ]);

    expect(out.find((l) => l.id === 'high')?.visible).toBe(true);
    expect(out.find((l) => l.id === 'low')?.visible).toBe(false);
  });

  it('nudges a nudgeable label instead of dropping it', () => {
    const out = resolveLabelPlacement([
      label('fixed', 0, 20, 9),
      label('movable', 5, 20, 1, true),
    ]);

    const movable = out.find((l) => l.id === 'movable');
    expect(movable?.visible).toBe(true);
    expect(movable?.offsetY).not.toBe(0);
  });

  it('drops a nudgeable label when no nudge resolves it', () => {
    const blockers = Array.from({ length: 12 }, (_, i) =>
      label(`block-${i}`, 0, i * 13, 9)
    );

    const out = resolveLabelPlacement(
      [...blockers, label('crowded', 2, 60, 0, true)],
      { maxNudge: 6 }
    );

    expect(out.find((l) => l.id === 'crowded')?.visible).toBe(false);
  });

  it('rejects labels outside the bounds', () => {
    const out = resolveLabelPlacement([label('outside', 500, 500)], {
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });

    expect(out[0]?.visible).toBe(false);
  });

  it('accepts a label exactly on the bounds edge', () => {
    const out = resolveLabelPlacement([label('edge', 160, 188)], {
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });

    expect(out[0]?.visible).toBe(true);
  });

  it('returns results in the caller order, not priority order', () => {
    const out = resolveLabelPlacement([
      label('first', 0, 0, 1),
      label('second', 200, 0, 9),
    ]);

    expect(out.map((l) => l.id)).toEqual(['first', 'second']);
  });

  it('is stable — identical input gives identical output', () => {
    // Stability matters more than optimality: an unstable result makes labels
    // flicker in and out while a chart animates.
    const input = [
      label('a', 0, 0, 5),
      label('b', 10, 0, 5),
      label('c', 20, 0, 5),
    ];

    expect(resolveLabelPlacement(input)).toEqual(resolveLabelPlacement(input));
  });

  it('breaks priority ties deterministically by id', () => {
    const out = resolveLabelPlacement([
      label('zzz', 0, 0, 5),
      label('aaa', 5, 0, 5),
    ]);

    // Equal priority: the lexicographically smaller id wins.
    expect(out.find((l) => l.id === 'aaa')?.visible).toBe(true);
    expect(out.find((l) => l.id === 'zzz')?.visible).toBe(false);
  });

  it('honours the padding option', () => {
    const tight = resolveLabelPlacement(
      [label('a', 0, 0, 9), label('b', 41, 0, 1)],
      { padding: 0 }
    );
    const loose = resolveLabelPlacement(
      [label('a', 0, 0, 9), label('b', 41, 0, 1)],
      { padding: 20 }
    );

    expect(tight.find((l) => l.id === 'b')?.visible).toBe(true);
    expect(loose.find((l) => l.id === 'b')?.visible).toBe(false);
  });

  it('handles an empty input', () => {
    expect(resolveLabelPlacement([])).toEqual([]);
  });
});
