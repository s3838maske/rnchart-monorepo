import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';

import { useChart } from '../ChartContext';
import { SeriesGradient, resolveGradient } from '../gradient';
import type { GradientInput } from '../gradient';
import { Pattern } from '../patterns';
import type { PatternKind } from '../patterns';

export type BarProps = {
  readonly seriesKey?: string;
  /**
   * Render these keys as one grouped set — for a combo chart, where the other
   * yKeys are lines. Ignored when seriesKey is given.
   */
  readonly seriesKeys?: readonly string[];
  /** Render every yKey as a grouped set. Ignored when seriesKey is given. */
  readonly grouped?: boolean;
  readonly color?: string;
  readonly cornerRadius?: number;
  /** Fraction of the band each group occupies. */
  readonly barPadding?: number;
  /** Minimum visible height so near-zero values do not vanish. */
  readonly minBarLength?: number;
  /** Gradient fill. `true`, a colour array, or a full spec. */
  readonly gradient?: GradientInput;
  /**
   * Texture fill, clipped to the bars.
   *
   * Redundant encoding: colour plus pattern means the series stays readable to
   * someone who cannot separate two hues, and still prints in greyscale. Use
   * `<Pattern>` directly if you want to texture something other than a series.
   */
  readonly pattern?: PatternKind;
  readonly patternColor?: string;
};

/**
 * Where column `slot` of a `count`-wide group sits within the band centred
 * on `centre`. Shared with `<DataLabels>` so a label can never drift off its bar.
 */
export function barSlot(
  centre: number,
  bandwidth: number,
  barPadding: number,
  slot: number,
  count: number
): { readonly x: number; readonly width: number } {
  const band = bandwidth > 0 ? bandwidth : 24;
  const groupWidth = band * (1 - barPadding);
  const width = Math.max(1, groupWidth / Math.max(1, count));
  return { x: centre - groupWidth / 2 + slot * width, width };
}

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
  seriesKeys,
  grouped = false,
  color,
  cornerRadius = 4,
  barPadding = 0.15,
  minBarLength = 2,
  gradient,
  pattern,
  patternColor,
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
        : seriesKeys !== undefined
          ? [...seriesKeys]
          : grouped
            ? [...yKeys]
            : yKeys.slice(0, 1),
    [seriesKey, seriesKeys, grouped, yKeys]
  );

  const paths = useMemo(() => {
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
        const { x, width: barWidth } = barSlot(
          xAt(i),
          xScale.bandwidth,
          barPadding,
          k,
          keys.length
        );

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
      {paths.map((p) => {
        const spec = resolveGradient(gradient, p.color);
        return (
          <Group key={p.key}>
            <Path path={p.path} style="fill" color={p.color}>
              {spec !== null ? (
                <SeriesGradient spec={spec} frame={plotArea} />
              ) : null}
            </Path>
            {/* Clipped to the bar path, so the texture lands on the series
                rather than washing over the whole plot. */}
            {pattern !== undefined ? (
              <Group clip={p.path}>
                <Pattern
                  kind={pattern}
                  color={patternColor ?? p.color}
                  bounds={plotArea}
                />
              </Group>
            ) : null}
          </Group>
        );
      })}
    </>
  );
}
