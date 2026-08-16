import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import { useChart } from '../ChartContext';
import { withAlpha } from '../theme';
import { buildLinePath, useSeriesPoints } from './Line';
import type { CurveKind } from './Line';

export type AreaProps = {
  readonly seriesKey: string;
  readonly curve?: CurveKind;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly fillOpacity?: number;
  readonly gradient?: boolean;
  readonly connectNulls?: boolean;
};

/**
 * Line's sibling, and where the default styling does the most selling.
 *
 * The default fill is a three-stop gradient at positions [0, 0.7, 1] with
 * opacities [0.6, 0.15, 0] rather than a linear fade. The eased falloff reads
 * as depth; a straight linear ramp reads as a flat wash and is the single most
 * common reason a chart library looks dated.
 */
export function Area({
  seriesKey,
  curve = 'monotone',
  color,
  strokeWidth = 2.5,
  fillOpacity = 0.6,
  gradient = true,
  connectNulls = false,
}: AreaProps): ReactElement {
  const { colorFor, plotArea, yScale } = useChart();
  const { points, valid } = useSeriesPoints(seriesKey);
  const tint = color ?? colorFor(seriesKey);

  const strokePath = useMemo(
    () => buildLinePath(points, valid, curve, connectNulls),
    [points, valid, curve, connectNulls]
  );

  // Fill: the stroke path, then back along the baseline, then closed.
  const fillPath = useMemo(() => {
    const baselineY = yScale.map(0);
    const clampedBaseline = Math.min(
      Math.max(baselineY, plotArea.y),
      plotArea.y + plotArea.height
    );

    const p = buildLinePath(points, valid, curve, true);

    let firstX: number | undefined;
    let lastX: number | undefined;
    for (let i = 0; i < points.xs.length; i += 1) {
      if (valid[i] !== 1) continue;
      if (firstX === undefined) firstX = points.xs[i];
      lastX = points.xs[i];
    }

    if (firstX === undefined || lastX === undefined) return Skia.Path.Make();

    p.lineTo(lastX, clampedBaseline);
    p.lineTo(firstX, clampedBaseline);
    p.close();
    return p;
  }, [points, valid, curve, yScale, plotArea]);

  const top = plotArea.y;
  const bottom = plotArea.y + plotArea.height;

  return (
    <Group>
      <Path
        path={fillPath}
        style="fill"
        color={tint}
        opacity={gradient ? 1 : fillOpacity}
      >
        {gradient ? (
          <LinearGradient
            start={vec(0, top)}
            end={vec(0, bottom)}
            colors={[
              withAlpha(tint, fillOpacity),
              withAlpha(tint, fillOpacity * 0.25),
              withAlpha(tint, 0),
            ]}
            positions={[0, 0.7, 1]}
          />
        ) : null}
      </Path>

      {strokeWidth > 0 ? (
        <Path
          path={strokePath}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          strokeJoin="round"
          color={tint}
        />
      ) : null}
    </Group>
  );
}
