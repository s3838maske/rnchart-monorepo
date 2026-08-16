import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { computeDomain, normaliseMissing, solveLayout } from '@rnchart/core';
import type {
  AxisScaleSpec,
  Category,
  FormatSpec,
  Padding,
} from '@rnchart/core';
import { createMeasureText, useChartFont } from '@rnchart/skia';

import { ChartProvider } from './ChartContext';
import type { ChartContextValue, SeriesDatum } from './ChartContext';
import { seriesColorAt } from './theme';

export type XScaleKind = 'band' | 'point' | 'linear' | 'time';

export type ChartProps = {
  readonly data: readonly SeriesDatum[];
  readonly xKey: string;
  readonly yKeys: readonly string[];
  readonly xScale?: XScaleKind;
  readonly yDomain?: readonly [number, number];
  /** Extend the y domain to include zero. Defaults true for honest baselines. */
  readonly includeZero?: boolean;
  readonly yPadding?: number;
  readonly padding?: Padding;
  readonly title?: string;
  readonly xLabelFormat?: FormatSpec;
  readonly yLabelFormat?: FormatSpec;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly animate?: boolean;
  readonly emptyMessage?: string;
  readonly children?: ReactNode;
};

const FALLBACK_HEIGHT = 240;

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * The root every chart mounts inside.
 *
 * Responsibilities, in order: measure itself, derive domains, run the layout
 * solver, and publish the solved scales through context. Series components draw
 * only — they never compute a domain or a plot rect, because two components
 * computing the same domain independently is how axes and data drift apart.
 *
 * The layout solve runs on mount and on resize. It must never run during a
 * gesture or an animation frame; phase 19's pan/zoom derives its scales from a
 * shared value instead.
 */
export function Chart({
  data,
  xKey,
  yKeys,
  xScale = 'band',
  yDomain,
  includeZero = true,
  yPadding = 0.08,
  padding,
  title,
  xLabelFormat,
  yLabelFormat,
  height = FALLBACK_HEIGHT,
  style,
  animate = true,
  emptyMessage = 'No data',
  children,
}: ChartProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const font = useChartFont({ size: 11 });
  const measureText = useMemo(
    () => createMeasureText(font, { family: 'axis-11' }),
    [font]
  );

  // Series values, missing entries normalised once for every consumer.
  const series = useMemo(() => {
    const map = new Map<string, { values: Float32Array; valid: Uint8Array }>();
    for (const key of yKeys) {
      map.set(
        key,
        normaliseMissing(
          data.map((d) => readNumber(d[key])),
          'gap'
        )
      );
    }
    return map;
  }, [data, yKeys]);

  const categories = useMemo<readonly Category[]>(
    () =>
      data.map((d, i) => {
        const raw = d[xKey];
        if (typeof raw === 'string' || typeof raw === 'number') return raw;
        return i;
      }),
    [data, xKey]
  );

  const xSpec = useMemo<AxisScaleSpec>(() => {
    if (xScale === 'band')
      return { type: 'band', domain: categories, padding: 0.2 };
    if (xScale === 'point')
      return { type: 'point', domain: categories, padding: 0.5 };

    const numeric = categories.map((c) =>
      typeof c === 'number' ? c : Number(c)
    );
    return { type: xScale, domain: computeDomain(numeric) };
  }, [categories, xScale]);

  const ySpec = useMemo<AxisScaleSpec>(() => {
    if (yDomain !== undefined) {
      return { type: 'linear', domain: [yDomain[0], yDomain[1]] };
    }
    const all = yKeys
      .map((k) => series.get(k)?.values)
      .filter((v): v is Float32Array => v !== undefined);

    return {
      type: 'linear',
      domain: computeDomain(all, {
        includeZero,
        padding: yPadding,
        nice: true,
      }),
    };
  }, [series, yKeys, yDomain, includeZero, yPadding]);

  const layout = useMemo(
    () =>
      solveLayout({
        width: size.width,
        height: size.height,
        axes: [
          {
            id: 'x',
            placement: 'bottom',
            scale: xSpec,
            ...(xLabelFormat !== undefined
              ? { labelFormat: xLabelFormat }
              : {}),
          },
          {
            id: 'y',
            placement: 'left',
            scale: ySpec,
            ...(yLabelFormat !== undefined
              ? { labelFormat: yLabelFormat }
              : {}),
          },
        ],
        ...(title !== undefined ? { title: { text: title } } : {}),
        ...(padding !== undefined ? { padding } : {}),
        measureText,
      }),
    [
      size,
      xSpec,
      ySpec,
      title,
      padding,
      measureText,
      xLabelFormat,
      yLabelFormat,
    ]
  );

  const contextValue = useMemo<ChartContextValue>(() => {
    const xAxis = layout.axes.find((a) => a.id === 'x')!;
    const yAxis = layout.axes.find((a) => a.id === 'y')!;

    return {
      layout,
      plotArea: layout.plotArea,
      xScale: xAxis.scale,
      yScale: yAxis.scale,
      data,
      xKey,
      yKeys,
      animate,
      colorFor: (key) => seriesColorAt(Math.max(0, yKeys.indexOf(key))),
      valuesFor: (key) => series.get(key)?.values ?? new Float32Array(0),
      validFor: (key) => series.get(key)?.valid ?? new Uint8Array(0),
      xAt: (index) => {
        const category = categories[index];
        const base =
          category === undefined
            ? xAxis.scale.map(index)
            : xAxis.scale.map(category);
        return base + xAxis.scale.bandwidth / 2;
      },
    };
  }, [layout, data, xKey, yKeys, series, categories, animate]);

  const ready = size.width > 0 && size.height > 0;
  const isEmpty = data.length === 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready && !isEmpty ? (
        <>
          <Canvas style={StyleSheet.absoluteFill}>
            <ChartProvider value={contextValue}>{children}</ChartProvider>
          </Canvas>
        </>
      ) : null}

      {isEmpty ? (
        <View style={styles.centre}>
          <Text style={styles.empty}>{emptyMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
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
  empty: {
    fontSize: 13,
    opacity: 0.5,
  },
});
