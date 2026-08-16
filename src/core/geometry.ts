/**
 * The two primitives every later phase builds on.
 *
 * `Rect` is the shape the layout solver returns in phase 3 and the shape
 * `<PlotClip>` consumes in phase 5. `clamp` is what keeps the plot area from
 * going negative on absurd inputs — phase 3's rule (f) in miniature.
 */

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Constrain `value` to the inclusive range [`min`, `max`].
 *
 * Returns `min` when the bounds are inverted rather than throwing — chart
 * layout runs every frame and must never fail on a degenerate input.
 * `NaN` propagates, because silently substituting a number would hide a bug
 * upstream in the domain calculation.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return Number.NaN;
  if (max < min) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Build a `Rect`, guaranteeing non-negative width and height.
 *
 * Phase 3's layout solver leans on this: a chart smaller than its own padding
 * must still produce a drawable (if tiny) plot area.
 */
export function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): Rect {
  return {
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
  };
}
