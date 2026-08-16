import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { computeDomain, normaliseMissing, solveLayout } from '../core';
import type { AxisScaleSpec, Category, FormatSpec, Padding } from '../core';
import { createMeasureText, useChartFont } from '../skia';

import { ChartProvider } from './ChartContext';
import type { ChartContextValue, SeriesDatum } from './ChartContext';
import { seriesColorAt } from './colors';
import { CursorProvider, nearestIndexByX } from './interaction/cursorState';
import type { CursorState } from './interaction/cursorState';
import { triggerImpact } from './interaction/haptics';
import {
  ViewportProvider,
  clampTranslate,
  zoomAboutFocal,
} from './interaction/viewport';
import type { ViewportState } from './interaction/viewport';

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
  /** Enable the touch cursor, crosshair and tooltip plumbing. */
  readonly cursor?: boolean;
  /** Fire a light impact when the snapped index changes. */
  readonly haptics?: boolean;
  /** React Native overlays drawn above the canvas — tooltips, legends. */
  readonly overlay?: ReactNode;
  /** Enable pan and pinch-zoom. Wrap series in `<ZoomPan>` to receive it. */
  readonly zoomable?: boolean;
  readonly maxZoom?: number;
  /** Carry a flick with momentum instead of stopping dead on release. */
  readonly momentum?: boolean;
  /**
   * Fires with the datum index nearest a tap.
   *
   * A JS-thread callback by design: it exists to trigger navigation, a
   * drilldown or analytics, all of which are React work. Unlike the cursor,
   * it fires once per tap rather than per frame, so the thread boundary
   * costs nothing.
   */
  readonly onPointPress?: (index: number) => void;
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
  cursor = false,
  haptics = true,
  overlay,
  zoomable = false,
  maxZoom = 8,
  momentum = true,
  onPointPress,
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

  // ---- Cursor (phase 12) ------------------------------------------------
  // Pixel x per datum, as a plain array so it can cross into a worklet.
  const pixelXs = useMemo(
    () => data.map((_, i) => contextValue.xAt(i)),
    [data, contextValue]
  );

  const cursorX = useSharedValue(0);
  const cursorIndex = useSharedValue(-1);
  const cursorActive = useSharedValue(false);
  const cursorSnappedX = useSharedValue(0);

  const cursorState = useMemo<CursorState>(
    () => ({
      x: cursorX,
      index: cursorIndex,
      active: cursorActive,
      snappedX: cursorSnappedX,
    }),
    [cursorX, cursorIndex, cursorActive, cursorSnappedX]
  );

  const gesture = useMemo(() => {
    const update = (touchX: number): void => {
      'worklet';
      cursorX.value = touchX;
      const idx = nearestIndexByX(pixelXs, touchX);
      if (idx !== cursorIndex.value) {
        cursorIndex.value = idx;
        // Only on an actual change — never per frame.
        if (haptics) runOnJS(triggerImpact)('light');
      }
      const snapped = pixelXs[idx];
      if (snapped !== undefined) cursorSnappedX.value = snapped;
    };

    const pan = Gesture.Pan()
      .onBegin((e) => {
        'worklet';
        cursorActive.value = true;
        update(e.x);
      })
      .onUpdate((e) => {
        'worklet';
        update(e.x);
      })
      .onFinalize(() => {
        'worklet';
        cursorActive.value = false;
        cursorIndex.value = -1;
      });

    const press = Gesture.LongPress()
      .minDuration(120)
      .onStart((e) => {
        'worklet';
        cursorActive.value = true;
        update(e.x);
      })
      .onFinalize(() => {
        'worklet';
        cursorActive.value = false;
        cursorIndex.value = -1;
      });

    return Gesture.Simultaneous(pan, press);
  }, [pixelXs, haptics, cursorX, cursorIndex, cursorActive, cursorSnappedX]);

  // ---- Viewport (phase 19) ----------------------------------------------
  const scaleX = useSharedValue(1);
  const translateX = useSharedValue(0);
  const zoomActive = useSharedValue(false);
  const savedScale = useSharedValue(1);
  const savedTranslate = useSharedValue(0);

  const viewportState = useMemo<ViewportState>(
    () => ({ scaleX, translateX, active: zoomActive }),
    [scaleX, translateX, zoomActive]
  );

  const plotWidth = layout.plotArea.width;

  const zoomGesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onBegin(() => {
        'worklet';
        zoomActive.value = true;
        savedScale.value = scaleX.value;
        savedTranslate.value = translateX.value;
      })
      .onUpdate((e) => {
        'worklet';
        const next = Math.min(maxZoom, Math.max(1, savedScale.value * e.scale));
        // Anchor at the fingers, never the plot centre.
        const focal = e.focalX;
        const nextTranslate = zoomAboutFocal(
          focal,
          savedScale.value,
          next,
          savedTranslate.value
        );
        scaleX.value = next;
        translateX.value = clampTranslate(nextTranslate, next, plotWidth);
      })
      .onEnd(() => {
        'worklet';
        zoomActive.value = false;
        // A pinch back below 1 springs to the full extent rather than
        // leaving the chart smaller than its own plot area.
        if (scaleX.value <= 1.001) {
          scaleX.value = withTiming(1, { duration: 200 });
          translateX.value = withTiming(0, { duration: 200 });
        }
      });

    const drag = Gesture.Pan()
      .minPointers(zoomable && !cursor ? 1 : 2)
      .onBegin(() => {
        'worklet';
        zoomActive.value = true;
        savedTranslate.value = translateX.value;
      })
      .onUpdate((e) => {
        'worklet';
        translateX.value = clampTranslate(
          savedTranslate.value + e.translationX,
          scaleX.value,
          plotWidth
        );
      })
      .onEnd((e) => {
        'worklet';
        zoomActive.value = false;
        if (!momentum || scaleX.value <= 1) return;
        const maxTranslate = plotWidth * (scaleX.value - 1);
        translateX.value = withDecay({
          velocity: e.velocityX,
          // Deceleration tuned to native scroll feel.
          deceleration: 0.997,
          clamp: [-maxTranslate, 0],
          rubberBandEffect: true,
          rubberBandFactor: 0.9,
        });
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        'worklet';
        scaleX.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(0, { duration: 400 });
      });

    return Gesture.Simultaneous(pinch, drag, doubleTap);
  }, [
    zoomable,
    cursor,
    maxZoom,
    momentum,
    plotWidth,
    scaleX,
    translateX,
    zoomActive,
    savedScale,
    savedTranslate,
  ]);

  const tapGesture = useMemo(() => {
    if (onPointPress === undefined) return null;
    return Gesture.Tap()
      .maxDuration(300)
      .onEnd((e) => {
        'worklet';
        const index = nearestIndexByX(pixelXs, e.x);
        if (index >= 0) runOnJS(onPointPress)(index);
      });
  }, [onPointPress, pixelXs]);

  const activeGesture = useMemo(() => {
    const parts = [];
    if (cursor) parts.push(gesture);
    if (zoomable) parts.push(zoomGesture);
    if (tapGesture !== null) parts.push(tapGesture);

    if (parts.length === 0) return gesture;
    if (parts.length === 1) return parts[0]!;
    return Gesture.Simultaneous(...parts);
  }, [zoomable, cursor, gesture, zoomGesture, tapGesture]);

  const ready = size.width > 0 && size.height > 0;
  const isEmpty = data.length === 0;

  const canvas = (
    <Canvas style={StyleSheet.absoluteFill}>
      <ChartProvider value={contextValue}>
        <CursorProvider value={cursor ? cursorState : null}>
          <ViewportProvider value={zoomable ? viewportState : null}>
            {children}
          </ViewportProvider>
        </CursorProvider>
      </ChartProvider>
    </Canvas>
  );

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready && !isEmpty ? (
        <>
          {cursor || zoomable || onPointPress !== undefined ? (
            <GestureDetector gesture={activeGesture}>
              <View style={StyleSheet.absoluteFill}>{canvas}</View>
            </GestureDetector>
          ) : (
            canvas
          )}

          {overlay !== undefined ? (
            <ChartProvider value={contextValue}>
              <CursorProvider value={cursor ? cursorState : null}>
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {overlay}
                </View>
              </CursorProvider>
            </ChartProvider>
          ) : null}
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
