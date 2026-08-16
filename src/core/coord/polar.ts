import type { Scale } from '../scale/types';
import type { CoordinateSystem, PathSegment, Point } from './types';

export type PolarOptions = {
  /** Maps data x to an ANGLE. Its range is set to [startAngle, endAngle]. */
  readonly angleScale: Scale;
  /** Maps data y to a RADIUS. Its range is set to [innerRadius, outerRadius]. */
  readonly radiusScale: Scale;
  readonly centerX: number;
  readonly centerY: number;
  readonly direction?: 'clockwise' | 'counterclockwise';
  /** Straight segments between points (spiderweb) instead of true arcs. */
  readonly gridShape?: 'circle' | 'polygon';
};

const TAU = Math.PI * 2;

/**
 * Polar coordinates.
 *
 * Angle is measured from 12 o'clock and increases clockwise by default, which
 * is what every radar chart in the wild does. Screen y grows downward, so the
 * projection subtracts the cosine term rather than adding it.
 */
export function createPolar(options: PolarOptions): CoordinateSystem {
  const {
    angleScale,
    radiusScale,
    centerX,
    centerY,
    direction = 'clockwise',
    gridShape = 'polygon',
  } = options;

  const sign = direction === 'clockwise' ? 1 : -1;

  const angleOf = (dataX: number): number => sign * angleScale.map(dataX);
  const radiusOf = (dataY: number): number => radiusScale.map(dataY);

  const toPixel = (angle: number, radius: number): Point => ({
    // -PI/2 puts zero at 12 o'clock instead of 3 o'clock.
    x: centerX + radius * Math.cos(angle - Math.PI / 2),
    y: centerY + radius * Math.sin(angle - Math.PI / 2),
  });

  return {
    type: 'polar',

    project(dataX, dataY) {
      return toPixel(angleOf(dataX), radiusOf(dataY));
    },

    invert(px, py) {
      const dx = px - centerX;
      const dy = py - centerY;
      const radius = Math.hypot(dx, dy);

      // atan2 returns (-PI, PI] measured from 3 o'clock; shift to 12 o'clock
      // and normalise to [0, TAU) so the angular scale can invert it.
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      angle *= sign;
      angle = ((angle % TAU) + TAU) % TAU;

      return {
        dataX: angleScale.invert(angle),
        dataY: radiusScale.invert(radius),
      };
    },

    pathBetween(from, to, fromDataX, toDataX): PathSegment {
      // A spiderweb radar joins points with straight segments. True arcs are
      // for continuous angular data, where a straight chord would visibly cut
      // the corner.
      if (gridShape === 'polygon') return { kind: 'line', to };

      const fromRadius = Math.hypot(from.x - centerX, from.y - centerY);
      const toRadius = Math.hypot(to.x - centerX, to.y - centerY);

      // An arc only makes sense at a constant radius. When the radius changes
      // the shape is a spiral, which Skia cannot draw as one arc — fall back
      // to a straight segment rather than drawing something subtly wrong.
      if (Math.abs(fromRadius - toRadius) > 0.5) return { kind: 'line', to };

      return {
        kind: 'arc',
        to,
        center: { x: centerX, y: centerY },
        radius: fromRadius,
        sweep: angleOf(toDataX) - angleOf(fromDataX),
      };
    },

    baseline(dataY) {
      return toPixel(0, radiusOf(dataY));
    },
  };
}

/**
 * Angle at which a category sits, in radians from 12 o'clock.
 *
 * Exposed for the angular axis, which needs to place labels on the
 * circumference without going through a full projection.
 */
export function categoryAngle(
  index: number,
  count: number,
  startAngle = 0,
  endAngle = TAU
): number {
  if (count <= 0) return startAngle;
  return startAngle + ((endAngle - startAngle) * index) / count;
}

/**
 * Keep a label upright.
 *
 * Text placed on the lower half of a circle at its raw angle renders upside
 * down. Flipping it by PI there is what keeps a radar chart readable — and is
 * the detail most implementations miss.
 */
export function uprightRotation(angle: number): number {
  const normalised = ((angle % TAU) + TAU) % TAU;
  const isLowerHalf =
    normalised > Math.PI / 2 && normalised < (3 * Math.PI) / 2;
  return isLowerHalf ? normalised + Math.PI : normalised;
}
