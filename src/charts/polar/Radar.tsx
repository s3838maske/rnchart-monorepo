import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';

import { usePolar } from '../PolarContext';
import { withAlpha } from '../colors';

export type RadarProps = {
  readonly seriesKey: string;
  readonly color?: string;
  readonly fill?: boolean;
  readonly fillOpacity?: number;
  readonly strokeWidth?: number;
  readonly markers?: boolean;
  readonly markerSize?: number;
};

function buildRadarPath(
  points: readonly { x: number; y: number }[],
  close: boolean
): SkPath {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  const first = points[0]!;
  path.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]!;
    path.lineTo(p.x, p.y);
  }
  if (close) path.close();

  return path;
}

/**
 * One radar series: a closed polygon through every spoke.
 *
 * Overlapping fills use plain alpha compositing at a low opacity rather than
 * `multiply`. Multiply looks richer with two series and goes muddy past three,
 * which is exactly when a radar chart is most likely to be used.
 */
export function Radar({
  seriesKey,
  color,
  fill = true,
  fillOpacity = 0.25,
  strokeWidth = 2,
  markers = true,
  markerSize = 3.5,
}: RadarProps): ReactElement {
  const polar = usePolar();
  const tint = color ?? polar.colorFor(seriesKey);

  const points = useMemo(() => {
    const values = polar.valuesFor(seriesKey);
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < polar.categories.length; i += 1) {
      const v = values[i];
      out.push(
        polar.pointAt(i, v === undefined || !Number.isFinite(v) ? 0 : v)
      );
    }
    return out;
  }, [polar, seriesKey]);

  const path = useMemo(
    () => buildRadarPath(points, polar.fullTurn),
    [points, polar.fullTurn]
  );

  return (
    <Group>
      {fill ? (
        <Path path={path} style="fill" color={withAlpha(tint, fillOpacity)} />
      ) : null}

      {strokeWidth > 0 ? (
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeJoin="round"
          color={tint}
        />
      ) : null}

      {markers
        ? points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={markerSize} color={tint} />
          ))
        : null}
    </Group>
  );
}

export type WindRoseProps = {
  readonly seriesKeys?: readonly string[];
  readonly padAngle?: number;
  readonly innerPadding?: number;
};

/**
 * Wind rose — stacked polar columns.
 *
 * Each category becomes a wedge, and each series stacks outward within it.
 * Stacking is done here rather than through core's `applyStacking` because the
 * accumulation is radial: segment N starts where segment N-1 ended in RADIUS,
 * and radius is not a linear axis the cartesian stacker knows about.
 */
export function WindRose({
  seriesKeys,
  padAngle = 0.02,
  innerPadding = 0,
}: WindRoseProps): ReactElement {
  const polar = usePolar();
  const keys = seriesKeys ?? polar.yKeys;

  const wedges = useMemo(() => {
    const count = polar.categories.length;
    if (count === 0) return [];

    const step = Math.abs(polar.angleFor(1) - polar.angleFor(0)) || Math.PI / 4;
    const half = Math.max(0.01, step / 2 - padAngle);

    const out: { key: string; path: SkPath; color: string }[] = [];

    // Running radius per category, so each series stacks on the previous.
    const acc = new Float64Array(count);
    for (let i = 0; i < count; i += 1) acc[i] = 0;

    for (const key of keys) {
      const values = polar.valuesFor(key);
      const path = Skia.Path.Make();

      for (let i = 0; i < count; i += 1) {
        const raw = values[i];
        const v = raw === undefined || !Number.isFinite(raw) ? 0 : raw;
        if (v <= 0) continue;

        const from = acc[i] as number;
        const to = from + v;
        acc[i] = to;

        const innerR = polar.radiusFor(i, from) + innerPadding;
        const outerR = polar.radiusFor(i, to);
        if (outerR <= innerR) continue;

        const centre = polar.angleFor(i) - Math.PI / 2;
        const a0 = centre - half;
        const a1 = centre + half;

        const outerRect = Skia.XYWHRect(
          polar.centerX - outerR,
          polar.centerY - outerR,
          outerR * 2,
          outerR * 2
        );
        const innerRect = Skia.XYWHRect(
          polar.centerX - innerR,
          polar.centerY - innerR,
          innerR * 2,
          innerR * 2
        );

        const deg = (r: number): number => (r * 180) / Math.PI;
        path.addArc(outerRect, deg(a0), deg(a1 - a0));
        path.arcToOval(innerRect, deg(a1), deg(a0 - a1), false);
        path.close();
      }

      out.push({ key, path, color: polar.colorFor(key) });
    }

    return out;
  }, [polar, keys, padAngle, innerPadding]);

  return (
    <Group>
      {wedges.map((w) => (
        <Path key={w.key} path={w.path} style="fill" color={w.color} />
      ))}
    </Group>
  );
}
