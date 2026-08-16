import { nearestIndexByX } from './cursorState';

describe('nearestIndexByX', () => {
  const xs = [0, 10, 20, 30, 40];

  it('finds an exact match', () => {
    expect(nearestIndexByX(xs, 20)).toBe(2);
  });

  it('snaps to the nearer neighbour', () => {
    expect(nearestIndexByX(xs, 14)).toBe(1);
    expect(nearestIndexByX(xs, 16)).toBe(2);
  });

  it('breaks a tie toward the lower index', () => {
    // Deterministic tie-breaking matters: an unstable choice makes the cursor
    // flicker between two points when a finger rests exactly between them.
    expect(nearestIndexByX(xs, 15)).toBe(1);
  });

  it('clamps outside the range', () => {
    expect(nearestIndexByX(xs, -1000)).toBe(0);
    expect(nearestIndexByX(xs, 1000)).toBe(4);
  });

  it('returns -1 for an empty axis', () => {
    expect(nearestIndexByX([], 5)).toBe(-1);
  });

  it('handles a single point', () => {
    expect(nearestIndexByX([7], 1000)).toBe(0);
  });

  it('agrees with a linear scan across the whole range', () => {
    const positions = Array.from({ length: 200 }, (_, i) => i * 3.5);

    for (let probe = -10; probe < 720; probe += 1.5) {
      const viaSearch = nearestIndexByX(positions, probe);

      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < positions.length; i += 1) {
        const d = Math.abs((positions[i] as number) - probe);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }

      expect(viaSearch).toBe(best);
    }
  });
});
