/**
 * Fritsch–Carlson monotone tangents.
 *
 * Returns one tangent (dy/dx) per point. Feeding these into a cubic Bézier
 * produces a curve that is smooth AND never overshoots the data.
 *
 * That last property is the entire reason this exists. A cardinal or
 * catmull-rom spline through 0, 100, 0 dips visibly below zero between the
 * points — which on a revenue chart draws negative revenue that never
 * happened. The Fritsch–Carlson limiter clamps each tangent to at most three
 * times the adjacent secant slope, which is provably enough to keep the cubic
 * monotone on every interval where the data is monotone.
 *
 * Operates on the flat parallel arrays the renderer already holds; allocates
 * exactly one output array and nothing per point.
 */
export function monotoneTangents(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>
): Float32Array {
  const n = Math.min(xs.length, ys.length);
  const tangents = new Float32Array(n);
  if (n < 2) return tangents;

  // Secant slope of each interval.
  const secants = new Float32Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (xs[i + 1] as number) - (xs[i] as number);
    const dy = (ys[i + 1] as number) - (ys[i] as number);
    secants[i] = dx === 0 ? 0 : dy / dx;
  }

  tangents[0] = secants[0] as number;
  tangents[n - 1] = secants[n - 2] as number;

  for (let i = 1; i < n - 1; i += 1) {
    const prev = secants[i - 1] as number;
    const next = secants[i] as number;

    // A sign change is a local extremum: flatten it so the curve turns without
    // bulging past the data point.
    if (prev * next <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (prev + next) / 2;
    }
  }

  // Limiter: clamp every tangent to 3x the adjacent secants.
  for (let i = 0; i < n - 1; i += 1) {
    const secant = secants[i] as number;

    if (secant === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }

    const a = (tangents[i] as number) / secant;
    const b = (tangents[i + 1] as number) / secant;
    const magnitude = Math.hypot(a, b);

    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangents[i] = scale * a * secant;
      tangents[i + 1] = scale * b * secant;
    }
  }

  return tangents;
}
