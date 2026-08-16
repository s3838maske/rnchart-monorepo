import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type CursorState = {
  /** Touch x in canvas pixels. */
  readonly x: SharedValue<number>;
  /** Snapped datum index, or -1 when nothing is under the cursor. */
  readonly index: SharedValue<number>;
  readonly active: SharedValue<boolean>;
  /** Pixel x of the snapped datum, which is what the crosshair draws at. */
  readonly snappedX: SharedValue<number>;
};

const CursorContext = createContext<CursorState | null>(null);

export const CursorProvider = CursorContext.Provider;

/** Null when the chart has no cursor enabled, so overlays can opt out quietly. */
export function useCursor(): CursorState | null {
  return useContext(CursorContext);
}

/**
 * Binary search for the index whose pixel x is nearest `target`.
 *
 * Deliberately a standalone worklet operating on a plain number[] rather than
 * reusing core's `createHitTester`. The tester returns a closure over a
 * Float32Array, and capturing a typed array plus a closure across the worklet
 * boundary is exactly the kind of thing that works in development and fails
 * mysteriously in a release build. A plain array and a pure function do not
 * have that problem.
 *
 * Same O(log n) as the core tester — this is a boundary concession, not a
 * performance one.
 */
export function nearestIndexByX(xs: readonly number[], target: number): number {
  'worklet';
  const n = xs.length;
  if (n === 0) return -1;

  let lo = 0;
  let hi = n - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] as number) < target) lo = mid + 1;
    else hi = mid;
  }

  if (lo > 0) {
    const dCurr = Math.abs((xs[lo] as number) - target);
    const dPrev = Math.abs((xs[lo - 1] as number) - target);
    if (dPrev <= dCurr) return lo - 1;
  }

  return lo;
}
