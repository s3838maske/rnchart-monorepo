import type { Scale } from '../scale/types';
import type { CoordinateSystem, PathSegment, Point } from './types';

export type CartesianOptions = {
  readonly xScale: Scale;
  readonly yScale: Scale;
};

/**
 * The default coordinate system.
 *
 * A thin wrapper over the two scales — it exists so series can be written
 * against `CoordinateSystem` rather than against scales directly. That
 * indirection is what lets the same `<Line>` render inside `<PolarChart>`.
 */
export function createCartesian(options: CartesianOptions): CoordinateSystem {
  const { xScale, yScale } = options;

  return {
    type: 'cartesian',

    project(dataX, dataY) {
      return { x: xScale.map(dataX), y: yScale.map(dataY) };
    },

    invert(px, py) {
      return { dataX: xScale.invert(px), dataY: yScale.invert(py) };
    },

    pathBetween(_from, to): PathSegment {
      return { kind: 'line', to };
    },

    baseline(dataY) {
      return yScale.map(dataY);
    },
  };
}

/** Convenience for callers that only have a projected point. */
export function samePoint(a: Point, b: Point, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}
