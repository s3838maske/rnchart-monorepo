import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Group, Path, Skia, Text } from '@shopify/react-native-skia';
import { useChartFont } from '../../skia';

import { usePolar } from '../PolarContext';
import { CHART_COLORS, withAlpha } from '../colors';

export type PolarGridProps = {
  /** Concentric rings. */
  readonly rings?: number;
  /** Radial spokes, one per category. */
  readonly spokes?: boolean;
  readonly color?: string;
  readonly opacity?: number;
  readonly width?: number;
};

/**
 * Circular grid: concentric rings plus radial spokes.
 *
 * Rings follow `gridShape` — `polygon` draws the classic spiderweb by joining
 * the category positions with straight segments, `circle` draws true circles.
 * Both are batched into a single path, as everywhere else in this library.
 */
export function PolarGrid({
  rings = 4,
  spokes = true,
  color = CHART_COLORS.grid,
  opacity = 0.12,
  width = 1,
}: PolarGridProps): ReactElement {
  const polar = usePolar();

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const { centerX, centerY, innerRadius, outerRadius, categories } = polar;
    const count = categories.length;

    for (let ring = 1; ring <= rings; ring += 1) {
      const t = ring / rings;
      const radius = innerRadius + (outerRadius - innerRadius) * t;

      if (polar.gridShape === 'circle' || count === 0) {
        p.addCircle(centerX, centerY, radius);
        continue;
      }

      // Spiderweb: join each category position at this radius.
      for (let i = 0; i <= count; i += 1) {
        const angle = polar.angleFor(i % count) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.close();
    }

    if (spokes) {
      for (let i = 0; i < count; i += 1) {
        const angle = polar.angleFor(i) - Math.PI / 2;
        p.moveTo(
          centerX + innerRadius * Math.cos(angle),
          centerY + innerRadius * Math.sin(angle)
        );
        p.lineTo(
          centerX + outerRadius * Math.cos(angle),
          centerY + outerRadius * Math.sin(angle)
        );
      }
    }

    return p;
  }, [polar, rings, spokes]);

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={width}
      color={withAlpha(color, opacity)}
    />
  );
}

export type AngularAxisProps = {
  readonly fontSize?: number;
  readonly color?: string;
  /** Distance beyond the outer ring at which labels sit. */
  readonly offset?: number;
};

/**
 * Category labels around the circumference.
 *
 * Labels are centred on their spoke and nudged outward. They are NOT rotated to
 * follow the circle: on a phone-sized radar, rotated category labels are harder
 * to read than upright ones, and the upright-flip trick only pays off for dense
 * angular axes. `uprightRotation` in core is there for when that case arrives.
 */
export function AngularAxis({
  fontSize = 11,
  color = CHART_COLORS.muted,
  offset = 14,
}: AngularAxisProps): ReactElement {
  const polar = usePolar();
  const font = useChartFont({ size: fontSize });

  return (
    <Group>
      {polar.categories.map((label, i) => {
        const angle = polar.angleFor(i) - Math.PI / 2;
        const radius = polar.outerRadius + offset;
        const cx = polar.centerX + radius * Math.cos(angle);
        const cy = polar.centerY + radius * Math.sin(angle);
        const width = font.getTextWidth(label);

        return (
          <Text
            key={`${label}-${i}`}
            x={cx - width / 2}
            y={cy + fontSize / 3}
            text={label}
            font={font}
            color={color}
          />
        );
      })}
    </Group>
  );
}

export type RadialAxisProps = {
  readonly ticks?: number;
  readonly fontSize?: number;
  readonly color?: string;
};

/** Value labels along the first spoke. */
export function RadialAxis({
  ticks = 4,
  fontSize = 10,
  color = CHART_COLORS.muted,
}: RadialAxisProps): ReactElement {
  const polar = usePolar();
  const font = useChartFont({ size: fontSize });
  const [lo, hi] = polar.radiusScale.domain as readonly [number, number];

  return (
    <Group>
      {Array.from({ length: ticks }, (_, i) => {
        const t = (i + 1) / ticks;
        const value = lo + (hi - lo) * t;
        const radius =
          polar.innerRadius + (polar.outerRadius - polar.innerRadius) * t;
        const label = String(Math.round(value));

        return (
          <Text
            key={label + String(i)}
            x={polar.centerX + 4}
            y={polar.centerY - radius + fontSize / 3}
            text={label}
            font={font}
            color={withAlpha(color, 0.9)}
          />
        );
      })}
    </Group>
  );
}
