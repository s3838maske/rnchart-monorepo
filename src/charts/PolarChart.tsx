import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  computeDomain,
  createPolar,
  createScale,
  normaliseMissing,
} from '../core';
import type { CoordinateSystem } from '../core';

import { PolarProvider } from './PolarContext';
import type { PolarContextValue } from './PolarContext';
import type { SeriesDatum } from './ChartContext';
import { seriesColorAt } from './colors';

export type PolarChartProps = {
  readonly data: readonly SeriesDatum[];
  /** Field holding the category for each spoke. */
  readonly categoryKey: string;
  readonly yKeys: readonly string[];
  /** Degrees, from 12 o'clock. */
  readonly startAngle?: number;
  readonly endAngle?: number;
  /** Fraction of the outer radius left empty at the centre. */
  readonly innerRadius?: number;
  readonly direction?: 'clockwise' | 'counterclockwise';
  /** `polygon` is the classic spiderweb; `circle` uses true arcs. */
  readonly gridShape?: 'circle' | 'polygon';
  readonly rDomain?: readonly [number, number];
  /**
   * Give every spoke its OWN min/max instead of one shared radial scale.
   *
   * The feature everyone needs and almost nobody ships: comparing revenue in
   * lakhs against an NPS out of 10 on one shared scale flattens the NPS axis
   * into nothing.
   */
  readonly independentAxes?: boolean;
  /**
   * Scale the radius to per-category STACKED totals rather than to individual
   * values.
   *
   * Required by `<WindRose>`: it accumulates series outward, so a category
   * summing to 33 needs a radial domain reaching 33. Scaling to the largest
   * individual value instead lets stacked wedges shoot past the outer ring —
   * which is exactly what happened the first time this was drawn.
   */
  readonly stacked?: boolean;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Polar coordinate container.
 *
 * Publishes a `CoordinateSystem` rather than scales, so series ask it how to
 * connect two points instead of assuming a straight line. That single
 * indirection is what lets a series render in polar space without polar-specific
 * code — see `pathBetween` in core.
 */
export function PolarChart({
  data,
  categoryKey,
  yKeys,
  startAngle = 0,
  endAngle = 360,
  innerRadius = 0,
  direction = 'clockwise',
  gridShape = 'polygon',
  rDomain,
  independentAxes = false,
  stacked = false,
  height = 280,
  style,
  children,
}: PolarChartProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const series = useMemo(() => {
    const map = new Map<string, { values: Float32Array; valid: Uint8Array }>();
    for (const key of yKeys) {
      map.set(
        key,
        normaliseMissing(
          data.map((d) => readNumber(d[key])),
          'zero'
        )
      );
    }
    return map;
  }, [data, yKeys]);

  const categories = useMemo(
    () => data.map((d, i) => String(d[categoryKey] ?? i)),
    [data, categoryKey]
  );

  const value = useMemo<PolarContextValue>(() => {
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const outerRadius = Math.max(1, Math.min(centerX, centerY) - 28);
    const inner = outerRadius * Math.min(Math.max(innerRadius, 0), 0.95);

    // One extra slot so the last category does not land on top of the first.
    const angleScale = createScale({
      type: 'linear',
      domain: [0, Math.max(1, categories.length)],
      range: [startAngle * DEG, endAngle * DEG],
    });

    const allValues = yKeys
      .map((k) => series.get(k)?.values)
      .filter((v): v is Float32Array => v !== undefined);

    // When stacking, the domain must cover the per-category SUM, not the
    // largest single value.
    const stackedTotals = new Float64Array(categories.length);
    if (stacked) {
      for (const values of allValues) {
        for (let i = 0; i < categories.length; i += 1) {
          const v = values[i];
          if (v !== undefined && Number.isFinite(v) && v > 0) {
            stackedTotals[i] = (stackedTotals[i] as number) + v;
          }
        }
      }
    }

    const sharedDomain =
      rDomain ??
      computeDomain(stacked ? [Array.from(stackedTotals)] : allValues, {
        includeZero: true,
        nice: true,
      });

    const radiusScale = createScale({
      type: 'linear',
      domain: [sharedDomain[0], sharedDomain[1]],
      range: [inner, outerRadius],
    });

    const coord: CoordinateSystem = createPolar({
      angleScale,
      radiusScale,
      centerX,
      centerY,
      direction,
      gridShape,
    });

    // Per-spoke scales, used only when independentAxes is on.
    const perAxis = categories.map((_, index) => {
      const atIndex: number[] = [];
      for (const key of yKeys) {
        const v = series.get(key)?.values[index];
        if (v !== undefined && Number.isFinite(v)) atIndex.push(v);
      }
      const domain = computeDomain(atIndex, { includeZero: true, nice: true });
      return createScale({
        type: 'linear',
        domain: [domain[0], domain[1]],
        range: [inner, outerRadius],
      });
    });

    return {
      coord,
      categories,
      yKeys,
      centerX,
      centerY,
      innerRadius: inner,
      outerRadius,
      angleScale,
      radiusScale,
      independentAxes,
      gridShape,
      radiusFor: (index, dataY) =>
        independentAxes
          ? (perAxis[index]?.map(dataY) ?? radiusScale.map(dataY))
          : radiusScale.map(dataY),
      angleFor: (index) => angleScale.map(index),
      colorFor: (key) => seriesColorAt(Math.max(0, yKeys.indexOf(key))),
      valuesFor: (key) => series.get(key)?.values ?? new Float32Array(0),
      validFor: (key) => series.get(key)?.valid ?? new Uint8Array(0),
      pointAt: (index, dataY) => {
        const angle =
          (direction === 'clockwise' ? 1 : -1) * angleScale.map(index);
        const radius = independentAxes
          ? (perAxis[index]?.map(dataY) ?? radiusScale.map(dataY))
          : radiusScale.map(dataY);
        return {
          x: centerX + radius * Math.cos(angle - Math.PI / 2),
          y: centerY + radius * Math.sin(angle - Math.PI / 2),
        };
      },
      fullTurn: Math.abs((endAngle - startAngle) * DEG) >= TAU - 1e-6,
    };
  }, [
    size,
    categories,
    yKeys,
    series,
    startAngle,
    endAngle,
    innerRadius,
    direction,
    gridShape,
    rDomain,
    independentAxes,
    stacked,
  ]);

  const ready = size.width > 0 && size.height > 0 && data.length > 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <PolarProvider value={value}>{children}</PolarProvider>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
});
