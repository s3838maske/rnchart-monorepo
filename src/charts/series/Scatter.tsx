import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Path, Skia } from '@shopify/react-native-skia';

import { useChart } from '../ChartContext';

export type ScatterShape = 'circle' | 'square' | 'diamond';

export type ScatterProps = {
  readonly seriesKey: string;
  readonly shape?: ScatterShape;
  readonly size?: number;
  readonly color?: string;
  readonly opacity?: number;
  /** Map a second key to radius via a sqrt scale — a bubble chart. */
  readonly sizeKey?: string;
  readonly minRadius?: number;
  readonly maxRadius?: number;
};

/**
 * Scatter and bubble.
 *
 * All points of a series accumulate into one path, as with Bar — the phase 11
 * Picture-based strategy for 1k-50k points builds on the same idea.
 *
 * Bubble radius uses a sqrt mapping, because AREA should encode magnitude, not
 * radius. Mapping the value straight to radius makes a 4x value look 16x
 * bigger, which is the most common way a bubble chart lies.
 */
export function Scatter({
  seriesKey,
  shape = 'circle',
  size = 4,
  color,
  opacity = 0.85,
  sizeKey,
  minRadius = 3,
  maxRadius = 18,
}: ScatterProps): ReactElement {
  const { valuesFor, validFor, xAt, yScale, colorFor } = useChart();

  const path = useMemo(() => {
    const values = valuesFor(seriesKey);
    const valid = validFor(seriesKey);
    const p = Skia.Path.Make();

    const sizes = sizeKey === undefined ? undefined : valuesFor(sizeKey);
    let sizeMin = Number.POSITIVE_INFINITY;
    let sizeMax = Number.NEGATIVE_INFINITY;
    if (sizes !== undefined) {
      for (let i = 0; i < sizes.length; i += 1) {
        const v = sizes[i];
        if (v === undefined || !Number.isFinite(v)) continue;
        if (v < sizeMin) sizeMin = v;
        if (v > sizeMax) sizeMax = v;
      }
    }

    const radiusAt = (i: number): number => {
      if (
        sizes === undefined ||
        !Number.isFinite(sizeMin) ||
        sizeMax === sizeMin
      ) {
        return size;
      }
      const v = sizes[i];
      if (v === undefined || !Number.isFinite(v)) return minRadius;
      const t = (v - sizeMin) / (sizeMax - sizeMin);
      // sqrt so area, not radius, tracks the value.
      return minRadius + Math.sqrt(t) * (maxRadius - minRadius);
    };

    for (let i = 0; i < values.length; i += 1) {
      if (valid[i] !== 1) continue;
      const cx = xAt(i);
      const cy = yScale.map(values[i] as number);
      const r = radiusAt(i);

      if (shape === 'circle') {
        p.addCircle(cx, cy, r);
      } else if (shape === 'square') {
        p.addRect(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2));
      } else {
        p.moveTo(cx, cy - r);
        p.lineTo(cx + r, cy);
        p.lineTo(cx, cy + r);
        p.lineTo(cx - r, cy);
        p.close();
      }
    }

    return p;
  }, [
    seriesKey,
    sizeKey,
    valuesFor,
    validFor,
    xAt,
    yScale,
    shape,
    size,
    minRadius,
    maxRadius,
  ]);

  return (
    <Path
      path={path}
      style="fill"
      color={color ?? colorFor(seriesKey)}
      opacity={opacity}
    />
  );
}
