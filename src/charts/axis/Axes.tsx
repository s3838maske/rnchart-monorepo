import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Group, Path, Skia, Text } from '@shopify/react-native-skia';
import { useChartFont } from '../../skia';

import { useChart } from '../ChartContext';
import { CHART_COLORS } from '../colors';

export type GridProps = {
  readonly horizontal?: boolean;
  readonly vertical?: boolean;
  readonly color?: string;
  readonly opacity?: number;
  readonly width?: number;
};

/**
 * Grid lines.
 *
 * All lines of one orientation are accumulated into a SINGLE SkPath — one draw
 * call instead of N. At 12 ticks the difference is invisible; at a 200-row
 * heatmap grid it is the difference between 60fps and a slideshow, and the
 * habit is worth forming here rather than retrofitting later.
 *
 * Lines sit on half-pixel offsets so a 1px stroke lands on a pixel boundary and
 * renders crisp instead of as two grey half-pixels.
 */
export function Grid({
  horizontal = true,
  vertical = false,
  color = CHART_COLORS.grid,
  opacity = CHART_COLORS.gridOpacity,
  width = 1,
}: GridProps): ReactElement {
  const { layout, plotArea } = useChart();

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const snap = (v: number): number => Math.round(v) + 0.5;

    if (horizontal) {
      const yAxis = layout.axes.find((a) => a.id === 'y');
      for (const tick of yAxis?.ticks ?? []) {
        if (tick.hidden) continue;
        const y = snap(tick.position);
        p.moveTo(plotArea.x, y);
        p.lineTo(plotArea.x + plotArea.width, y);
      }
    }

    if (vertical) {
      const xAxis = layout.axes.find((a) => a.id === 'x');
      for (const tick of xAxis?.ticks ?? []) {
        if (tick.hidden) continue;
        const x = snap(tick.position);
        p.moveTo(x, plotArea.y);
        p.lineTo(x, plotArea.y + plotArea.height);
      }
    }

    return p;
  }, [layout, plotArea, horizontal, vertical]);

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={width}
      color={color}
      opacity={opacity}
    />
  );
}

export type AxisProps = {
  readonly showTicks?: boolean;
  readonly tickLength?: number;
  readonly color?: string;
  readonly fontSize?: number;
};

/**
 * X axis: tick marks as one path, labels as individual Text nodes.
 *
 * Tick marks batch into a single path for the same reason the grid does. Labels
 * cannot batch — each needs its own transform — but there are only ever a
 * handful after collision resolution has thinned them.
 */
export function XAxis({
  showTicks = false,
  tickLength = 4,
  color = CHART_COLORS.muted,
  fontSize = 11,
}: AxisProps): ReactElement | null {
  const { layout, plotArea } = useChart();
  const font = useChartFont({ size: fontSize });
  const axis = layout.axes.find((a) => a.id === 'x');

  const tickPath = useMemo(() => {
    const p = Skia.Path.Make();
    if (!showTicks || axis === undefined) return p;
    const baseline = plotArea.y + plotArea.height;
    for (const tick of axis.ticks) {
      if (tick.hidden) continue;
      const x = Math.round(tick.position) + 0.5;
      p.moveTo(x, baseline);
      p.lineTo(x, baseline + tickLength);
    }
    return p;
  }, [axis, plotArea, showTicks, tickLength]);

  if (axis === undefined) return null;

  const baseline = plotArea.y + plotArea.height;

  return (
    <Group>
      {showTicks ? (
        <Path
          path={tickPath}
          style="stroke"
          strokeWidth={1}
          color={color}
          opacity={0.4}
        />
      ) : null}

      {axis.ticks.map((tick) => {
        if (tick.hidden) return null;
        const width = font.getTextWidth(tick.label);
        const x = tick.position - width / 2;
        const y = baseline + tickLength + fontSize + 2;

        if (tick.rotation !== 0) {
          return (
            <Group
              key={`${tick.value}-${tick.label}`}
              transform={[{ rotate: tick.rotation }]}
              origin={{ x: tick.position, y }}
            >
              <Text x={x} y={y} text={tick.label} font={font} color={color} />
            </Group>
          );
        }

        return (
          <Text
            key={`${tick.value}-${tick.label}`}
            x={x}
            y={y}
            text={tick.label}
            font={font}
            color={color}
          />
        );
      })}
    </Group>
  );
}

/** Y axis: labels right-aligned against the plot's left edge. */
export function YAxis({
  showTicks = false,
  tickLength = 4,
  color = CHART_COLORS.muted,
  fontSize = 11,
}: AxisProps): ReactElement | null {
  const { layout, plotArea } = useChart();
  const font = useChartFont({ size: fontSize });
  const axis = layout.axes.find((a) => a.id === 'y');

  const tickPath = useMemo(() => {
    const p = Skia.Path.Make();
    if (!showTicks || axis === undefined) return p;
    for (const tick of axis.ticks) {
      if (tick.hidden) continue;
      const y = Math.round(tick.position) + 0.5;
      p.moveTo(plotArea.x - tickLength, y);
      p.lineTo(plotArea.x, y);
    }
    return p;
  }, [axis, plotArea, showTicks, tickLength]);

  if (axis === undefined) return null;

  return (
    <Group>
      {showTicks ? (
        <Path
          path={tickPath}
          style="stroke"
          strokeWidth={1}
          color={color}
          opacity={0.4}
        />
      ) : null}

      {axis.ticks.map((tick) => {
        if (tick.hidden) return null;
        const width = font.getTextWidth(tick.label);
        return (
          <Text
            key={`${tick.value}-${tick.label}`}
            x={plotArea.x - tickLength - 4 - width}
            y={tick.position + fontSize / 3}
            text={tick.label}
            font={font}
            color={color}
          />
        );
      })}
    </Group>
  );
}
