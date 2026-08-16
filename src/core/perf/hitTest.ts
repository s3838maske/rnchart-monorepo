import { quadtree } from 'd3-quadtree';

export type HitMode = 'x' | 'nearest';

export type HitResult = {
  readonly index: number;
  readonly distance: number;
};

export type HitTester = {
  readonly mode: HitMode;
  /**
   * Find the datum under a touch.
   *
   * Safe to call from a Reanimated worklet: no closure over mutable
   * JS-thread state, and no allocation in the hot path beyond the single
   * result object.
   */
  find(x: number, y: number, radius?: number): HitResult | null;
};

const pointCount = (points: Float32Array): number => points.length >> 1;

/**
 * Binary-search hit tester for x-ordered series.
 *
 * O(log n), which is what lets a tooltip track a 100k-point line at 60fps.
 * Correct for line, area and bar, where the user is pointing at an x position
 * and expects the nearest column of data, not the nearest pixel.
 */
function createXHitTester(points: Float32Array): HitTester {
  const n = pointCount(points);

  return {
    mode: 'x',
    find(x) {
      'worklet';
      if (n === 0) return null;

      let lo = 0;
      let hi = n - 1;

      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((points[mid * 2] as number) < x) lo = mid + 1;
        else hi = mid;
      }

      // lo is the first index at or past x; the neighbour may be closer.
      let best = lo;
      if (lo > 0) {
        const dCurr = Math.abs((points[lo * 2] as number) - x);
        const dPrev = Math.abs((points[(lo - 1) * 2] as number) - x);
        if (dPrev <= dCurr) best = lo - 1;
      }

      return {
        index: best,
        distance: Math.abs((points[best * 2] as number) - x),
      };
    },
  };
}

/**
 * Quadtree hit tester for unordered clouds.
 *
 * Scatter and bubble have no meaningful x-ordering — the visually nearest
 * point is what the user means — so binary search does not apply. The tree is
 * built once per data change and must never be rebuilt during a gesture.
 */
function createNearestHitTester(points: Float32Array): HitTester {
  const n = pointCount(points);

  const indices: number[] = [];
  for (let i = 0; i < n; i += 1) indices.push(i);

  const tree = quadtree<number>()
    .x((i) => points[i * 2] as number)
    .y((i) => points[i * 2 + 1] as number)
    .addAll(indices);

  return {
    mode: 'nearest',
    find(x, y, radius) {
      if (n === 0) return null;
      const found = tree.find(x, y, radius ?? Number.POSITIVE_INFINITY);
      if (found === undefined) return null;

      const dx = (points[found * 2] as number) - x;
      const dy = (points[found * 2 + 1] as number) - y;

      return { index: found, distance: Math.hypot(dx, dy) };
    },
  };
}

/**
 * Build a hit tester over pixel-space points.
 *
 * Takes pixel coordinates rather than data values deliberately: "nearest" has
 * to mean nearest on screen. In data space, a scatter plot with revenue in
 * lakhs against a 0-10 satisfaction score would treat a 1-lakh gap as closer
 * than a 2-point gap, which is not what the finger is pointing at.
 */
export function createHitTester(
  points: Float32Array,
  mode: HitMode = 'x'
): HitTester {
  return mode === 'nearest'
    ? createNearestHitTester(points)
    : createXHitTester(points);
}
