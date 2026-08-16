import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Path, Skia } from '@shopify/react-native-skia';

import { useChart } from '../ChartContext';

export type BarProps = {
  readonly seriesKey?: string;
  /** Render every yKey as a grouped set. Ignored when seriesKey is given. */
  readonly grouped?: boolean;
  readonly color?: string;
  readonly cornerRadius?: number;
  /** Fraction of the band each group occupies. */
  readonly barPadding?: number;
  /** Minimum visible height so near-zero values do not vanish. */
  readonly minBarLength?: number;
};

/**
 * Column series.
 *
 * Every bar of one series accumulates into a SINGLE SkPath via addRRect. This
 * is the difference between 60fps and roughly 20fps at 200 bars — N separate
 * nodes means N draw calls and N reconciliations, and it is the most common
 * reason bar charts stutter on mid-range Android.
 *
 * Rounded corners apply to the OUTER end only: the top of a positive column,
 * the bottom of a negative one. Rounding all four corners makes a column look
 * like a pill floating off its baseline.
 */
export function Bar({
  seriesKey,
  grouped = false,
  color,
  cornerRadius = 4,
  barPadding = 0.15,
  minBarLength = 2,
}: BarProps): ReactElement {
  const {
    yKeys,
    valuesFor,
    validFor,
    xScale,
    yScale,
    plotArea,
    colorFor,
    xAt,
  } = useChart();

  const keys = useMemo(
    () =>
      seriesKey !== undefined
        ? [seriesKey]
        : grouped
          ? [...yKeys]
          : yKeys.slice(0, 1),
    [seriesKey, grouped, yKeys]
  );

  const paths = useMemo(() => {
    const band = xScale.bandwidth > 0 ? xScale.bandwidth : 24;
    const groupWidth = band * (1 - barPadding);
    const barWidth = Math.max(1, groupWidth / Math.max(1, keys.length));
    const zeroY = Math.min(
      Math.max(yScale.map(0), plotArea.y),
      plotArea.y + plotArea.height
    );

    return keys.map((key, k) => {
      const values = valuesFor(key);
      const valid = validFor(key);
      const path = Skia.Path.Make();

      for (let i = 0; i < values.length; i += 1) {
        if (valid[i] !== 1) continue;
        const value = values[i] as number;
        const centre = xAt(i);
        const groupLeft = centre - groupWidth / 2;
        const x = groupLeft + k * barWidth;

        const valueY = yScale.map(value);
        let top = Math.min(valueY, zeroY);
        let height = Math.abs(valueY - zeroY);

        if (height < minBarLength) {
          height = minBarLength;
          if (value < 0) top = zeroY;
          else top = zeroY - minBarLength;
        }

        const radius = Math.min(cornerRadius, barWidth / 2, height);
        const positive = value >= 0;

        // Per-corner radii: only the outer end is rounded.
        const rrect = Skia.RRectXY(
          Skia.XYWHRect(x, top, barWidth, height),
          radius,
          radius
        );

        if (radius <= 0) {
          path.addRect(Skia.XYWHRect(x, top, barWidth, height));
        } else {
          path.addRRect(rrect);
          // Square off the baseline end by overdrawing a plain rect there.
          const flatHeight = Math.min(radius, height);
          path.addRect(
            Skia.XYWHRect(
              x,
              positive ? top + height - flatHeight : top,
              barWidth,
              flatHeight
            )
          );
        }
      }

      return { key, path, color: color ?? colorFor(key) };
    });
  }, [
    keys,
    valuesFor,
    validFor,
    xScale,
    yScale,
    plotArea,
    xAt,
    colorFor,
    color,
    cornerRadius,
    barPadding,
    minBarLength,
  ]);

  return (
    <>
      {paths.map((p) => (
        <Path key={p.key} path={p.path} style="fill" color={p.color} />
      ))}
    </>
  );
}
