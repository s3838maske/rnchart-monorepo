import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { createRingBuffer } from '../core';

import { seriesColorAt, withAlpha, CHART_COLORS } from './colors';

export type StreamMode = 'scroll' | 'sweep' | 'grow';

export type StreamPoint = { readonly x: number; readonly y: number };

export type StreamingChartRef = {
  /** Append one sample. No setState, no re-render. */
  append(point: StreamPoint): void;
  /** Append many at once — cheaper than N calls. */
  appendBatch(points: readonly StreamPoint[]): void;
  clear(): void;
  /** Entries currently held. */
  size(): number;
};

export type StreamingChartProps = {
  /** Points held in the ring buffer. Memory is allocated once from this. */
  readonly capacity?: number;
  readonly mode?: StreamMode;
  readonly yDomain?: readonly [number, number];
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly fill?: boolean;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly label?: string;
};

/**
 * Live-updating chart driven by an imperative ref.
 *
 * The problem this solves is specific and common: appending points to an
 * ordinary chart makes it narrower and narrower as the domain grows, instead
 * of scrolling a fixed window. victory-native issue #251 is exactly this.
 *
 * How it avoids re-rendering:
 *
 *   append() -> ring buffer (JS memory, no allocation)
 *            -> pixel coordinates written into a SHARED VALUE
 *            -> useDerivedValue rebuilds the SkPath on the UI THREAD
 *
 * No `setState`, so React never reconciles. At 60 appends a second that is the
 * difference between 60 reconciliations a second and none.
 */
export const StreamingChart = forwardRef<
  StreamingChartRef,
  StreamingChartProps
>(function StreamingChart(
  {
    capacity = 300,
    mode = 'scroll',
    yDomain,
    color,
    strokeWidth = 2,
    fill = true,
    height = 200,
    style,
    label,
  },
  ref
): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const buffer = useMemo(() => createRingBuffer(capacity, 2), [capacity]);

  // Pixel coordinates, flat [x0,y0,x1,y1,...]. Plain numbers so the worklet can
  // read them; a typed array would not survive the boundary reliably.
  const points = useSharedValue<number[]>([]);

  // The fill worklet needs the baseline. It MUST be a shared value, not a ref:
  // capturing a ref inside a worklet freezes it, and every later write to
  // `.current` is silently dropped with a "[Worklets] Tried to modify key
  // `current`" warning. That is precisely what made this chart render empty —
  // the size stayed {0,0} forever and `publish` early-returned every frame.
  const bottomY = useSharedValue(0);

  // Plain mutable state that never crosses into a worklet is fine as a ref.
  const domainRef = useRef<[number, number]>([0, 1]);

  /**
   * Recompute pixel coordinates and publish them.
   *
   * Runs on the JS thread but does NOT touch React. The y domain auto-fits
   * unless pinned, because a live feed rarely knows its range up front.
   */
  const publish = useCallback(() => {
    const { width, height: h } = size;
    if (width <= 0 || h <= 0) return;

    const { view, length } = buffer.toView();
    if (length === 0) {
      points.value = [];
      return;
    }

    let lo: number;
    let hi: number;
    if (yDomain !== undefined) {
      [lo, hi] = yDomain as [number, number];
    } else {
      lo = Number.POSITIVE_INFINITY;
      hi = Number.NEGATIVE_INFINITY;
      for (let i = 1; i < length * 2; i += 2) {
        const v = view[i] as number;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (lo === hi) {
        lo -= 1;
        hi += 1;
      }
      // Ease the domain toward the new range instead of snapping, so an
      // outlier does not make the whole trace jump.
      const [prevLo, prevHi] = domainRef.current;
      const blend = 0.25;
      lo = prevLo + (lo - prevLo) * blend;
      hi = prevHi + (hi - prevHi) * blend;
    }
    domainRef.current = [lo, hi];

    const span = hi - lo || 1;
    const pad = 6;
    const usable = Math.max(1, h - pad * 2);

    const out = new Array<number>(length * 2);

    for (let i = 0; i < length; i += 1) {
      // In every mode the window is FIXED; only where the newest sample sits
      // differs. That is the whole fix for the shrinking-chart problem.
      const t =
        mode === 'grow'
          ? i / Math.max(1, capacity - 1)
          : i / Math.max(1, length - 1);

      const x =
        mode === 'sweep'
          ? (((buffer.total - length + i) % capacity) /
              Math.max(1, capacity - 1)) *
            width
          : t * width;

      const y = view[i * 2 + 1] as number;
      out[i * 2] = x;
      out[i * 2 + 1] = pad + usable - ((y - lo) / span) * usable;
    }

    points.value = out;
    bottomY.value = h;
  }, [buffer, points, bottomY, yDomain, mode, capacity, size]);

  useImperativeHandle(
    ref,
    () => ({
      append(point) {
        buffer.push(point.x, point.y);
        publish();
      },
      appendBatch(batch) {
        const flat = new Array<number>(batch.length * 2);
        for (let i = 0; i < batch.length; i += 1) {
          flat[i * 2] = batch[i]!.x;
          flat[i * 2 + 1] = batch[i]!.y;
        }
        buffer.pushBatch(flat);
        publish();
      },
      clear() {
        buffer.clear();
        publish();
      },
      size: () => buffer.length,
    }),
    [buffer, publish]
  );

  const tint = color ?? seriesColorAt(0);

  const strokePath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const xs = points.value;
    if (xs.length < 4) return p;

    p.moveTo(xs[0] as number, xs[1] as number);
    for (let i = 2; i < xs.length; i += 2) {
      p.lineTo(xs[i] as number, xs[i + 1] as number);
    }
    return p;
  }, [points]);

  const fillPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const xs = points.value;
    if (!fill || xs.length < 4) return p;

    const bottom = bottomY.value;
    p.moveTo(xs[0] as number, bottom);
    for (let i = 0; i < xs.length; i += 2) {
      p.lineTo(xs[i] as number, xs[i + 1] as number);
    }
    p.lineTo(xs[xs.length - 2] as number, bottom);
    p.close();
    return p;
  }, [points, fill, bottomY]);

  const ready = size.width > 0 && size.height > 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {fill ? (
            <Path path={fillPath} style="fill" color={withAlpha(tint, 0.18)} />
          ) : null}
          <Path
            path={strokePath}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
            color={tint}
          />
        </Canvas>
      ) : null}

      {label !== undefined ? (
        <View style={styles.label} pointerEvents="none">
          <Text style={styles.labelText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { width: '100%' },
  label: { position: 'absolute', top: 6, left: 8 },
  labelText: { fontSize: 11, color: CHART_COLORS.muted },
});
