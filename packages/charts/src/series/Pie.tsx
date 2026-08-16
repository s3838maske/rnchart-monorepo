import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { computeArcs } from '@rnchart/core';
import type { Arc } from '@rnchart/core';

import type { SeriesDatum } from '../ChartContext';
import { seriesColorAt } from '../colors';

export type PieChartProps = {
  readonly data: readonly SeriesDatum[];
  readonly valueKey: string;
  /** 0 for a pie; a fraction of the outer radius for a donut. */
  readonly innerRadius?: number;
  /** Degrees. -90 to 90 gives a semi-circle. */
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly padAngle?: number;
  readonly colors?: readonly string[];
  readonly sortSlices?: boolean;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** Rendered in the donut hole. */
  readonly children?: ReactNode;
};

const DEG = Math.PI / 180;

/**
 * Build one slice as a closed path.
 *
 * Drawn with explicit arcs rather than a stroked circle so the donut hole is a
 * real hole in the geometry — a thick stroke would look identical here but
 * breaks the moment a slice explodes or gets a corner radius.
 */
function sliceToPath(arc: Arc, cx: number, cy: number, offset: number) {
  const path = Skia.Path.Make();

  const dx = Math.cos(arc.centroidAngle) * offset;
  const dy = Math.sin(arc.centroidAngle) * offset;
  const x = cx + dx;
  const y = cy + dy;

  const sweepDeg = ((arc.endAngle - arc.startAngle) * 180) / Math.PI;
  const startDeg = (arc.startAngle * 180) / Math.PI;

  const outer = Skia.XYWHRect(
    x - arc.outerRadius,
    y - arc.outerRadius,
    arc.outerRadius * 2,
    arc.outerRadius * 2
  );

  path.addArc(outer, startDeg, sweepDeg);

  if (arc.innerRadius > 0) {
    const inner = Skia.XYWHRect(
      x - arc.innerRadius,
      y - arc.innerRadius,
      arc.innerRadius * 2,
      arc.innerRadius * 2
    );
    path.arcToOval(inner, startDeg + sweepDeg, -sweepDeg, false);
  } else {
    path.lineTo(x, y);
  }

  path.close();
  return path;
}

/**
 * Pie and donut — the first non-cartesian renderer.
 *
 * Owns its own canvas rather than living inside `<Chart>`, because it has no
 * axes and no plot rect; forcing it through the cartesian layout solver would
 * mean reserving space for axes that will never be drawn.
 */
export function PieChart({
  data,
  valueKey,
  innerRadius = 0,
  startAngle = -90,
  endAngle = 270,
  padAngle = 0.01,
  colors,
  sortSlices = false,
  height = 240,
  style,
  children,
}: PieChartProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const values = useMemo(
    () =>
      Float32Array.from(
        data.map((d) => {
          const v = d[valueKey];
          return typeof v === 'number' && Number.isFinite(v) ? v : 0;
        })
      ),
    [data, valueKey]
  );

  const { arcs, cx, cy } = useMemo(() => {
    const centreX = size.width / 2;
    const centreY = size.height / 2;
    const outerRadius = Math.max(1, Math.min(centreX, centreY) - 8);

    return {
      cx: centreX,
      cy: centreY,
      arcs: computeArcs(values, {
        outerRadius,
        innerRadius:
          innerRadius > 0 && innerRadius <= 1
            ? outerRadius * innerRadius
            : innerRadius,
        startAngle: startAngle * DEG,
        endAngle: endAngle * DEG,
        padAngle,
        sort: sortSlices,
      }),
    };
  }, [values, size, innerRadius, startAngle, endAngle, padAngle, sortSlices]);

  const palette = colors ?? null;
  const ready = size.width > 0 && size.height > 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group>
            {arcs.map((arc) => (
              <Path
                key={arc.index}
                path={sliceToPath(arc, cx, cy, 0)}
                style="fill"
                color={
                  palette?.[arc.index % palette.length] ??
                  seriesColorAt(arc.index)
                }
              />
            ))}
          </Group>
        </Canvas>
      ) : null}

      {children !== undefined ? (
        <View style={styles.centre} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
