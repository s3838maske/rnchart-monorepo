import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Group, Text } from '@shopify/react-native-skia';
import { formatValue, resolveLabelPlacement } from '../../core';
import type { FormatSpec, LabelCandidate } from '../../core';
import { useChartFont } from '../../skia';

import { useChart } from '../ChartContext';
import { CHART_COLORS } from '../colors';
import { barSlot } from '../series/Bar';

export type DataLabelsProps = {
  /** Series to label. Collisions resolve across all of them together. */
  readonly seriesKeys: readonly string[];
  /**
   * The keys drawn as one grouped `<Bar>`, in the same order, so each label
   * centres on its own column rather than on the band.
   */
  readonly barKeys?: readonly string[];
  /** Must match the `<Bar>`'s `barPadding`. */
  readonly barPadding?: number;
  /** Defaults to the y axis' compact format, so labels and axis agree. */
  readonly format?: FormatSpec;
  readonly color?: string;
  /** Outline behind the text, so a line crossing a label cannot hide it. */
  readonly haloColor?: string;
  readonly fontSize?: number;
};

const COMPACT: FormatSpec = { type: 'compact' };
const NO_BARS: readonly string[] = [];
/** Clears a default line marker (radius 4) with a little air. */
const GAP = 6;

/**
 * Value labels above each point, or below it for a negative value.
 *
 * Overlapping labels are DROPPED rather than drawn on top of each other, the
 * larger value winning, via the same `resolveLabelPlacement` the annotations
 * use. Twelve full-precision labels do not fit across a phone; a readable
 * subset beats an unreadable full set.
 */
export function DataLabels({
  seriesKeys,
  barKeys = NO_BARS,
  barPadding = 0.15,
  format = COMPACT,
  color = CHART_COLORS.foreground,
  haloColor = '#ffffff',
  fontSize = 10,
}: DataLabelsProps): ReactElement {
  const { valuesFor, validFor, xAt, xScale, yScale, plotArea } = useChart();
  const font = useChartFont({ size: fontSize });

  const labels = useMemo(() => {
    const candidates: LabelCandidate[] = [];
    const texts = new Map<string, string>();

    for (const key of seriesKeys) {
      const values = valuesFor(key);
      const valid = validFor(key);
      const slot = barKeys.indexOf(key);

      for (let i = 0; i < values.length; i += 1) {
        if (valid[i] !== 1) continue;
        const value = values[i] as number;
        const text = formatValue(value, format);
        const width = font.getTextWidth(text);

        let centre = xAt(i);
        if (slot >= 0) {
          const bar = barSlot(
            centre,
            xScale.bandwidth,
            barPadding,
            slot,
            barKeys.length
          );
          centre = bar.x + bar.width / 2;
        }

        const y = yScale.map(value);
        const top = value >= 0 ? y - GAP - fontSize : y + GAP;
        // Nudge edge labels inward rather than letting them clip.
        const x = Math.min(
          Math.max(centre - width / 2, plotArea.x),
          plotArea.x + plotArea.width - width
        );

        const id = `${key}:${String(i)}`;
        texts.set(id, text);
        candidates.push({
          id,
          rect: { x, y: top, width, height: fontSize },
          priority: Math.abs(value),
        });
      }
    }

    return resolveLabelPlacement(candidates)
      .filter((placed) => placed.visible)
      .map((placed) => ({
        id: placed.id,
        x: placed.rect.x,
        // Skia positions text by its baseline.
        y: placed.rect.y + fontSize,
        text: texts.get(placed.id) ?? '',
      }));
  }, [
    seriesKeys,
    barKeys,
    barPadding,
    format,
    font,
    fontSize,
    valuesFor,
    validFor,
    xAt,
    xScale,
    yScale,
    plotArea,
  ]);

  return (
    <Group>
      {labels.map((label) => (
        <Group key={label.id}>
          <Text
            x={label.x}
            y={label.y}
            text={label.text}
            font={font}
            color={haloColor}
            style="stroke"
            strokeWidth={3}
            strokeJoin="round"
          />
          <Text
            x={label.x}
            y={label.y}
            text={label.text}
            font={font}
            color={color}
          />
        </Group>
      ))}
    </Group>
  );
}
