import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text,
} from '@shopify/react-native-skia';
import { resolveLabelPlacement } from '../../core';
import type { LabelCandidate } from '../../core';
import { useChartFont } from '../../skia';

import { useChart } from '../ChartContext';
import { CHART_COLORS, withAlpha } from '../colors';

export type PlotLineProps = {
  readonly axis?: 'x' | 'y';
  readonly value: number;
  readonly color?: string;
  readonly width?: number;
  readonly dash?: readonly [number, number] | null;
  readonly label?: string;
  readonly labelAlign?: 'start' | 'end';
  readonly fontSize?: number;
};

/**
 * A reference line at a fixed data value — a target, a threshold, a mean.
 *
 * Positioned in DATA coordinates, so it tracks pan and zoom automatically
 * through the same scales the series use. A line drawn at a fixed pixel would
 * drift away from its value the moment the chart moved.
 */
export function PlotLine({
  axis = 'y',
  value,
  color = CHART_COLORS.foreground,
  width = 1,
  dash = [4, 4],
  label,
  labelAlign = 'end',
  fontSize = 10,
}: PlotLineProps): ReactElement | null {
  const { plotArea, xScale, yScale } = useChart();
  const font = useChartFont({ size: fontSize });

  const geometry = useMemo(() => {
    const path = Skia.Path.Make();

    if (axis === 'y') {
      const y = Math.round(yScale.map(value)) + 0.5;
      if (y < plotArea.y || y > plotArea.y + plotArea.height) return null;
      path.moveTo(plotArea.x, y);
      path.lineTo(plotArea.x + plotArea.width, y);
      return { path, x: plotArea.x + plotArea.width, y };
    }

    const x = Math.round(xScale.map(value)) + 0.5;
    if (x < plotArea.x || x > plotArea.x + plotArea.width) return null;
    path.moveTo(x, plotArea.y);
    path.lineTo(x, plotArea.y + plotArea.height);
    return { path, x, y: plotArea.y + fontSize + 2 };
  }, [axis, value, plotArea, xScale, yScale, fontSize]);

  if (geometry === null) return null;

  const labelWidth = label === undefined ? 0 : font.getTextWidth(label);
  // Flip the label inward when it would otherwise run off the plot.
  const labelX =
    labelAlign === 'end'
      ? Math.min(
          geometry.x - labelWidth - 4,
          plotArea.x + plotArea.width - labelWidth - 2
        )
      : plotArea.x + 4;

  return (
    <Group>
      <Path
        path={geometry.path}
        style="stroke"
        strokeWidth={width}
        color={withAlpha(color, 0.55)}
        strokeCap="butt"
      >
        {/* Dashes come from a path effect, not a stroke property — a plain
            strokeCap leaves the line solid, which is how this shipped drawing
            every plot line solid including the dashed default. */}
        {dash !== null ? (
          <DashPathEffect intervals={[dash[0], dash[1]]} />
        ) : null}
      </Path>
      {label !== undefined ? (
        <Text
          x={labelX}
          y={geometry.y - 4}
          text={label}
          font={font}
          color={withAlpha(color, 0.8)}
        />
      ) : null}
    </Group>
  );
}

export type PlotBandProps = {
  readonly axis?: 'x' | 'y';
  readonly from: number;
  readonly to: number;
  readonly color?: string;
  readonly opacity?: number;
  readonly label?: string;
  readonly fontSize?: number;
};

/**
 * A shaded region between two data values.
 *
 * Renders BEHIND the series by default — declare it before your series in the
 * chart's children. A band drawn on top would hide the very data it is meant
 * to give context to.
 */
export function PlotBand({
  axis = 'y',
  from,
  to,
  color = CHART_COLORS.foreground,
  opacity = 0.07,
  label,
  fontSize = 10,
}: PlotBandProps): ReactElement | null {
  const { plotArea, xScale, yScale } = useChart();
  const font = useChartFont({ size: fontSize });

  const rect = useMemo(() => {
    if (axis === 'y') {
      const a = yScale.map(from);
      const b = yScale.map(to);
      const top = Math.max(plotArea.y, Math.min(a, b));
      const bottom = Math.min(plotArea.y + plotArea.height, Math.max(a, b));
      if (bottom <= top) return null;
      return {
        x: plotArea.x,
        y: top,
        width: plotArea.width,
        height: bottom - top,
      };
    }

    const a = xScale.map(from);
    const b = xScale.map(to);
    const left = Math.max(plotArea.x, Math.min(a, b));
    const right = Math.min(plotArea.x + plotArea.width, Math.max(a, b));
    if (right <= left) return null;
    return {
      x: left,
      y: plotArea.y,
      width: right - left,
      height: plotArea.height,
    };
  }, [axis, from, to, plotArea, xScale, yScale]);

  if (rect === null) return null;

  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height));

  return (
    <Group>
      <Path path={path} style="fill" color={withAlpha(color, opacity)} />
      {label !== undefined ? (
        <Text
          x={rect.x + 6}
          y={rect.y + fontSize + 4}
          text={label}
          font={font}
          color={withAlpha(color, 0.6)}
        />
      ) : null}
    </Group>
  );
}

export type AnnotationSpec = {
  readonly id: string;
  /** Data coordinates. */
  readonly x: number | string;
  readonly y: number;
  readonly text: string;
  /** Pixel offset from the anchor to the label. */
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly color?: string;
  /** Draw a leader line from the anchor to the label. */
  readonly connector?: boolean;
};

export type AnnotationsProps = {
  readonly items: readonly AnnotationSpec[];
  readonly fontSize?: number;
  /** Drop labels that cannot be placed without overlapping. */
  readonly avoidOverlap?: boolean;
};

/**
 * Point annotations with callout leaders.
 *
 * Collision handling goes through `resolveLabelPlacement` from phase 13 — the
 * SAME function the data labels use. A second implementation would drift from
 * the first within a release, and two different answers to "do these labels
 * overlap" is worse than either answer alone.
 */
export function Annotations({
  items,
  fontSize = 10,
  avoidOverlap = true,
}: AnnotationsProps): ReactElement {
  const { plotArea, xScale, yScale } = useChart();
  const font = useChartFont({ size: fontSize });

  const placed = useMemo(() => {
    const anchors = items.map((item) => {
      const ax =
        typeof item.x === 'number' ? xScale.map(item.x) : xScale.map(item.x);
      const ay = yScale.map(item.y);
      const width = font.getTextWidth(item.text) + 10;
      const height = fontSize + 8;

      return {
        item,
        anchorX: ax + xScale.bandwidth / 2,
        anchorY: ay,
        labelX: ax + xScale.bandwidth / 2 + (item.offsetX ?? 10),
        labelY: ay + (item.offsetY ?? -22),
        width,
        height,
      };
    });

    if (!avoidOverlap) {
      return anchors.map((a) => ({ ...a, visible: true, offsetY: 0 }));
    }

    const candidates: LabelCandidate[] = anchors.map((a) => ({
      id: a.item.id,
      rect: { x: a.labelX, y: a.labelY, width: a.width, height: a.height },
      // Higher y values sit higher on screen and read as more important.
      priority: -a.anchorY,
      nudgeable: true,
    }));

    const results = resolveLabelPlacement(candidates, {
      bounds: plotArea,
      padding: 3,
    });

    return anchors.map((a, i) => {
      const r = results[i];
      return {
        ...a,
        labelX: r?.rect.x ?? a.labelX,
        labelY: r?.rect.y ?? a.labelY,
        visible: r?.visible ?? true,
      };
    });
  }, [items, xScale, yScale, font, fontSize, plotArea, avoidOverlap]);

  return (
    <Group>
      {placed.map((a) => {
        if (!a.visible) return null;
        const tint = a.item.color ?? CHART_COLORS.foreground;

        const leader = Skia.Path.Make();
        if (a.item.connector !== false) {
          leader.moveTo(a.anchorX, a.anchorY);
          leader.lineTo(a.labelX + 2, a.labelY + a.height / 2);
        }

        const pill = Skia.Path.Make();
        pill.addRRect(
          Skia.RRectXY(
            Skia.XYWHRect(a.labelX, a.labelY, a.width, a.height),
            4,
            4
          )
        );

        return (
          <Group key={a.item.id}>
            {a.item.connector !== false ? (
              <Path
                path={leader}
                style="stroke"
                strokeWidth={1}
                color={withAlpha(tint, 0.4)}
              />
            ) : null}
            <Path path={pill} style="fill" color={withAlpha(tint, 0.12)} />
            <Text
              x={a.labelX + 5}
              y={a.labelY + fontSize + 2}
              text={a.item.text}
              font={font}
              color={tint}
            />
          </Group>
        );
      })}
    </Group>
  );
}
