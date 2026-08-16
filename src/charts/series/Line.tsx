import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import { monotoneTangents } from '../../core';

import { useChart } from '../ChartContext';

export type CurveKind = 'linear' | 'monotone' | 'step' | 'stepAfter';

export type LineProps = {
  readonly seriesKey: string;
  readonly curve?: CurveKind;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  /** Draw across gaps instead of breaking the line. */
  readonly connectNulls?: boolean;
  readonly markers?: boolean | { readonly size?: number };
};

type Points = { readonly xs: Float32Array; readonly ys: Float32Array };

/**
 * Build the stroke path for one contiguous run of valid points.
 *
 * Monotone uses tangents computed in core, converted here into the cubic
 * control points Skia wants: for the interval [i, i+1] the control points sit
 * one third of the way along in x, offset by the tangent in y. That is the
 * standard Hermite-to-Bézier conversion.
 */
function appendRun(
  path: SkPath,
  xs: Float32Array,
  ys: Float32Array,
  from: number,
  to: number,
  curve: CurveKind
): void {
  const n = to - from;
  if (n <= 0) return;

  path.moveTo(xs[from] as number, ys[from] as number);
  if (n === 1) return;

  if (curve === 'monotone') {
    const sliceX = xs.subarray(from, to);
    const sliceY = ys.subarray(from, to);
    const tangents = monotoneTangents(sliceX, sliceY);

    for (let i = 0; i < n - 1; i += 1) {
      const x0 = sliceX[i] as number;
      const y0 = sliceY[i] as number;
      const x1 = sliceX[i + 1] as number;
      const y1 = sliceY[i + 1] as number;
      const dx = (x1 - x0) / 3;

      path.cubicTo(
        x0 + dx,
        y0 + (tangents[i] as number) * dx,
        x1 - dx,
        y1 - (tangents[i + 1] as number) * dx,
        x1,
        y1
      );
    }
    return;
  }

  for (let i = from + 1; i < to; i += 1) {
    const x = xs[i] as number;
    const y = ys[i] as number;

    if (curve === 'step') {
      path.lineTo(x, ys[i - 1] as number);
    } else if (curve === 'stepAfter') {
      path.lineTo(xs[i - 1] as number, y);
    }
    path.lineTo(x, y);
  }
}

/** Split into runs of valid points so gaps genuinely break the line. */
export function buildLinePath(
  points: Points,
  valid: Uint8Array,
  curve: CurveKind,
  connectNulls: boolean
): SkPath {
  const path = Skia.Path.Make();
  const { xs, ys } = points;
  const n = xs.length;

  if (connectNulls) {
    // Compact to only the valid points, then draw one continuous run.
    const cx = new Float32Array(n);
    const cy = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < n; i += 1) {
      if (valid[i] === 1) {
        cx[k] = xs[i] as number;
        cy[k] = ys[i] as number;
        k += 1;
      }
    }
    appendRun(path, cx, cy, 0, k, curve);
    return path;
  }

  let i = 0;
  while (i < n) {
    if (valid[i] !== 1) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < n && valid[i] === 1) i += 1;
    appendRun(path, xs, ys, start, i, curve);
  }
  return path;
}

/** Pixel coordinates for one series. */
export function useSeriesPoints(seriesKey: string): {
  points: Points;
  valid: Uint8Array;
} {
  const { valuesFor, validFor, xAt, yScale } = useChart();

  return useMemo(() => {
    const values = valuesFor(seriesKey);
    const valid = validFor(seriesKey);
    const n = values.length;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);

    for (let i = 0; i < n; i += 1) {
      xs[i] = xAt(i);
      ys[i] = yScale.map(valid[i] === 1 ? (values[i] as number) : 0);
    }

    return { points: { xs, ys }, valid };
  }, [seriesKey, valuesFor, validFor, xAt, yScale]);
}

/**
 * The most-used series in every app.
 *
 * Path construction goes through explicit moveTo/lineTo/cubicTo rather than an
 * SVG path string. Round-tripping through a string is a large hidden cost:
 * it serialises every coordinate to text and reparses it, every frame.
 */
export function Line({
  seriesKey,
  curve = 'monotone',
  color,
  strokeWidth = 2.5,
  opacity = 1,
  connectNulls = false,
  markers = false,
}: LineProps): ReactElement {
  const { colorFor } = useChart();
  const { points, valid } = useSeriesPoints(seriesKey);
  const stroke = color ?? colorFor(seriesKey);

  const path = useMemo(
    () => buildLinePath(points, valid, curve, connectNulls),
    [points, valid, curve, connectNulls]
  );

  const markerSize =
    markers === false
      ? 0
      : typeof markers === 'object'
        ? (markers.size ?? 4)
        : 4;

  // Hide markers once points crowd closer than ~3x the marker size, which is
  // the density at which they merge into a blob and stop conveying anything.
  const spacing =
    points.xs.length > 1
      ? Math.abs((points.xs[1] as number) - (points.xs[0] as number))
      : Number.POSITIVE_INFINITY;
  const showMarkers = markerSize > 0 && spacing > markerSize * 3;

  return (
    <Group>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        color={stroke}
        opacity={opacity}
      />
      {showMarkers
        ? Array.from({ length: points.xs.length }, (_, i) =>
            valid[i] === 1 ? (
              <Circle
                key={i}
                cx={points.xs[i] as number}
                cy={points.ys[i] as number}
                r={markerSize}
                color={stroke}
              />
            ) : null
          )
        : null}
    </Group>
  );
}
