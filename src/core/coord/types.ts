export type Point = { readonly x: number; readonly y: number };

export type CoordinateSystemType = 'cartesian' | 'polar';

/**
 * How to get from one projected point to the next.
 *
 * THIS is the abstraction that makes existing series work in both coordinate
 * systems. A cartesian system answers "straight line"; a polar system answers
 * "arc along a constant radius". Everything else — scales, domains, stacking —
 * is already coordinate-agnostic, so a series that asks the coordinate system
 * how to connect two points instead of assuming `lineTo` needs no polar-specific
 * code at all.
 */
export type PathSegment =
  | { readonly kind: 'line'; readonly to: Point }
  | {
      readonly kind: 'arc';
      readonly to: Point;
      /** Circle centre the arc sweeps around. */
      readonly center: Point;
      readonly radius: number;
      /** Radians, signed. Negative sweeps anticlockwise. */
      readonly sweep: number;
    };

export type CoordinateSystem = {
  readonly type: CoordinateSystemType;

  /** Data space to pixel space. */
  project(dataX: number, dataY: number): Point;

  /** Pixel space back to data space. */
  invert(px: number, py: number): { dataX: number; dataY: number };

  /**
   * How to draw from `from` to `to`.
   *
   * `fromData`/`toData` are the ORIGINAL data-space x values. Polar needs them
   * to know the angular distance being covered; deriving it from the projected
   * pixels alone is ambiguous once a sweep exceeds half a turn.
   */
  pathBetween(
    from: Point,
    to: Point,
    fromDataX: number,
    toDataX: number
  ): PathSegment;

  /** Where a zero-height bar or an area baseline sits, in pixels. */
  baseline(dataY: number): Point | number;
};
