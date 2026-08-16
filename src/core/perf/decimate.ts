/**
 * Decimation.
 *
 * Every function here operates directly on the flat `[x0,y0,x1,y1,...]` layout
 * with zero intermediate object allocation. That layout is not a
 * micro-optimisation: at 100k points, an array of `{x, y}` objects is roughly
 * 100k allocations the garbage collector has to walk, and a GC pause during a
 * pan is exactly the stutter users notice.
 */

export type DecimationStrategy = 'lttb' | 'minmax' | 'none';

export type AutoDecimateOptions = {
  readonly strategy?: DecimationStrategy;
  /** Points to keep per pixel of plot width. Default 2. */
  readonly pointsPerPixel?: number;
};

const pointCount = (points: Float32Array): number => points.length >> 1;

/**
 * Largest-Triangle-Three-Buckets downsampling.
 *
 * Picks, from each bucket, the point forming the largest triangle with the
 * previously kept point and the next bucket's average. That is what preserves
 * the visual shape — peaks and troughs survive, because a peak forms a large
 * triangle while a point on a straight run forms a degenerate one.
 *
 * Returns the input unchanged (SAME REFERENCE) when it is already at or under
 * the threshold, so callers can use reference equality to skip work.
 */
export function lttb(points: Float32Array, threshold: number): Float32Array {
  const n = pointCount(points);
  if (threshold >= n || threshold < 3) return points;

  const out = new Float32Array(threshold * 2);

  // First point is always kept.
  out[0] = points[0] as number;
  out[1] = points[1] as number;

  const bucketSize = (n - 2) / (threshold - 2);
  let selected = 0; // index of the last kept point

  for (let i = 0; i < threshold - 2; i += 1) {
    // Average of the NEXT bucket, used as the triangle's third vertex.
    const avgStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgEnd = Math.floor((i + 2) * bucketSize) + 1;
    if (avgEnd > n) avgEnd = n;

    let avgX = 0;
    let avgY = 0;
    const avgCount = avgEnd - avgStart;
    if (avgCount > 0) {
      for (let j = avgStart; j < avgEnd; j += 1) {
        avgX += points[j * 2] as number;
        avgY += points[j * 2 + 1] as number;
      }
      avgX /= avgCount;
      avgY /= avgCount;
    } else {
      avgX = points[(n - 1) * 2] as number;
      avgY = points[(n - 1) * 2 + 1] as number;
    }

    // Candidate range for this bucket.
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n - 1);

    const ax = points[selected * 2] as number;
    const ay = points[selected * 2 + 1] as number;

    let bestArea = -1;
    let bestIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j += 1) {
      const bx = points[j * 2] as number;
      const by = points[j * 2 + 1] as number;
      const area = Math.abs((ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay));
      if (area > bestArea) {
        bestArea = area;
        bestIndex = j;
      }
    }

    out[(i + 1) * 2] = points[bestIndex * 2] as number;
    out[(i + 1) * 2 + 1] = points[bestIndex * 2 + 1] as number;
    selected = bestIndex;
  }

  // Last point is always kept.
  out[(threshold - 1) * 2] = points[(n - 1) * 2] as number;
  out[(threshold - 1) * 2 + 1] = points[(n - 1) * 2 + 1] as number;

  return out;
}

/**
 * Bucketed min/max decimation.
 *
 * The correct choice for OHLC and spiky sensor data. LTTB optimises for visual
 * shape and will smooth a single-sample spike away; in a candlestick chart the
 * extremes ARE the data, so losing one is losing the high of the day.
 *
 * Emits both the min and the max of each bucket, in x-order within the bucket,
 * so the resulting polyline still reads left to right.
 */
export function minMaxDecimate(
  points: Float32Array,
  targetBuckets: number
): Float32Array {
  const n = pointCount(points);
  if (targetBuckets < 1 || n <= targetBuckets * 2) return points;

  const bucketSize = n / targetBuckets;
  const out = new Float32Array(targetBuckets * 4);
  let w = 0;

  for (let b = 0; b < targetBuckets; b += 1) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(Math.floor((b + 1) * bucketSize), n);
    if (end <= start) continue;

    let minIdx = start;
    let maxIdx = start;
    let minY = points[start * 2 + 1] as number;
    let maxY = minY;

    for (let j = start + 1; j < end; j += 1) {
      const y = points[j * 2 + 1] as number;
      if (y < minY) {
        minY = y;
        minIdx = j;
      }
      if (y > maxY) {
        maxY = y;
        maxIdx = j;
      }
    }

    const first = Math.min(minIdx, maxIdx);
    const second = Math.max(minIdx, maxIdx);

    out[w] = points[first * 2] as number;
    out[w + 1] = points[first * 2 + 1] as number;
    w += 2;

    if (second !== first) {
      out[w] = points[second * 2] as number;
      out[w + 1] = points[second * 2 + 1] as number;
      w += 2;
    }
  }

  return out.subarray(0, w);
}

export type ViewportSlice = {
  /** A VIEW into the input, not a copy. */
  readonly view: Float32Array;
  /** Index of the first point in the view, within the original array. */
  readonly offset: number;
};

/** Binary search for the first point index with x >= target. */
function lowerBound(points: Float32Array, target: number): number {
  let lo = 0;
  let hi = pointCount(points);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid * 2] as number) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Slice to the visible x range without copying.
 *
 * Returns `subarray`, which shares the underlying buffer — no allocation, no
 * copy. During a pan this runs on every frame, so an allocating implementation
 * would produce a fresh multi-megabyte array 60 times a second.
 *
 * One point of padding is kept on each side so the line still enters and exits
 * the viewport rather than stopping at its edge.
 */
export function clipToViewport(
  points: Float32Array,
  xMin: number,
  xMax: number
): ViewportSlice {
  const n = pointCount(points);
  if (n === 0) return { view: points, offset: 0 };

  const start = Math.max(0, lowerBound(points, xMin) - 1);
  const end = Math.min(n, lowerBound(points, xMax) + 1);

  if (end <= start) return { view: points.subarray(0, 0), offset: start };

  return {
    view: points.subarray(start * 2, end * 2),
    offset: start,
  };
}

/**
 * Policy layer: decimate only when there is genuinely more data than pixels.
 *
 * Below roughly two points per pixel there is nothing to gain — every point
 * already maps to its own pixel column — so the input is returned untouched.
 */
export function autoDecimate(
  points: Float32Array,
  plotWidthPx: number,
  options: AutoDecimateOptions = {}
): Float32Array {
  const strategy = options.strategy ?? 'lttb';
  if (strategy === 'none') return points;

  const perPixel = options.pointsPerPixel ?? 2;
  const budget = Math.max(2, Math.floor(plotWidthPx * perPixel));
  const n = pointCount(points);

  if (n <= budget) return points;

  return strategy === 'minmax'
    ? minMaxDecimate(points, Math.max(1, Math.floor(budget / 2)))
    : lttb(points, budget);
}
