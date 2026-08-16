import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import {
  Canvas,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { clamp } from '../../core';

import { seriesColorAt, withAlpha, CHART_COLORS } from '../colors';

export type GaugeBand = {
  readonly from: number;
  readonly to: number;
  readonly color: string;
};

export type GaugeProps = {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  /** Degrees from 12 o'clock. The default is the classic 270° dial. */
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly bands?: readonly GaugeBand[];
  /** Smooth sweep instead of discrete bands. */
  readonly gradient?: readonly string[];
  readonly needle?: boolean;
  readonly thickness?: number;
  readonly trackOpacity?: number;
  readonly color?: string;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

const DEG = Math.PI / 180;
const deg = (radians: number): number => (radians * 180) / Math.PI;

/** Ring segment between two angles, as a closed path. */
function arcBand(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  a0: number,
  a1: number
) {
  const path = Skia.Path.Make();
  if (a1 === a0 || outerR <= innerR) return path;

  const outer = Skia.XYWHRect(cx - outerR, cy - outerR, outerR * 2, outerR * 2);
  const inner = Skia.XYWHRect(cx - innerR, cy - innerR, innerR * 2, innerR * 2);

  path.addArc(outer, deg(a0), deg(a1 - a0));
  path.arcToOval(inner, deg(a1), deg(a0 - a1), false);
  path.close();
  return path;
}

/**
 * Angular gauge.
 *
 * A gauge that snaps between values looks broken in a way a bar chart does not,
 * so value changes are meant to animate by default. Phase 18's spring
 * (damping 12, stiffness 100) deliberately overshoots slightly and settles —
 * that overshoot is what makes a needle feel physical.
 */
export function Gauge({
  value,
  min = 0,
  max = 100,
  startAngle = -135,
  endAngle = 135,
  bands,
  gradient,
  needle = true,
  thickness = 18,
  trackOpacity = 0.1,
  color,
  height = 200,
  style,
  children,
}: GaugeProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const geometry = useMemo(() => {
    const cx = size.width / 2;
    const cy = size.height / 2;
    const outerR = Math.max(1, Math.min(cx, cy) - 6);
    const innerR = Math.max(0, outerR - thickness);

    const a0 = startAngle * DEG - Math.PI / 2;
    const a1 = endAngle * DEG - Math.PI / 2;
    const span = a1 - a0;

    const safeMax = max === min ? min + 1 : max;
    const t = clamp((value - min) / (safeMax - min), 0, 1);
    const valueAngle = a0 + span * t;

    return { cx, cy, outerR, innerR, a0, a1, span, t, valueAngle, safeMax };
  }, [size, thickness, startAngle, endAngle, value, min, max]);

  const track = useMemo(
    () =>
      arcBand(
        geometry.cx,
        geometry.cy,
        geometry.outerR,
        geometry.innerR,
        geometry.a0,
        geometry.a1
      ),
    [geometry]
  );

  const progress = useMemo(
    () =>
      arcBand(
        geometry.cx,
        geometry.cy,
        geometry.outerR,
        geometry.innerR,
        geometry.a0,
        geometry.valueAngle
      ),
    [geometry]
  );

  const bandPaths = useMemo(() => {
    if (bands === undefined) return [];
    return bands.map((band, i) => {
      const from = clamp((band.from - min) / (geometry.safeMax - min), 0, 1);
      const to = clamp((band.to - min) / (geometry.safeMax - min), 0, 1);
      return {
        key: `${band.from}-${band.to}-${i}`,
        color: band.color,
        path: arcBand(
          geometry.cx,
          geometry.cy,
          geometry.outerR,
          geometry.innerR,
          geometry.a0 + geometry.span * from,
          geometry.a0 + geometry.span * to
        ),
      };
    });
  }, [bands, geometry, min]);

  const needlePath = useMemo(() => {
    const path = Skia.Path.Make();
    if (!needle) return path;

    const { cx, cy, innerR, valueAngle } = geometry;
    const length = innerR * 0.92;
    const baseWidth = Math.max(3, geometry.outerR * 0.035);

    // A tapered polygon from the pivot: two base corners perpendicular to the
    // needle, meeting at the tip.
    const perp = valueAngle + Math.PI / 2;
    path.moveTo(
      cx + baseWidth * Math.cos(perp),
      cy + baseWidth * Math.sin(perp)
    );
    path.lineTo(
      cx + length * Math.cos(valueAngle),
      cy + length * Math.sin(valueAngle)
    );
    path.lineTo(
      cx - baseWidth * Math.cos(perp),
      cy - baseWidth * Math.sin(perp)
    );
    path.close();
    return path;
  }, [geometry, needle]);

  const tint = color ?? seriesColorAt(0);
  const ready = size.width > 0 && size.height > 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group>
            <Path
              path={track}
              style="fill"
              color={withAlpha(CHART_COLORS.foreground, trackOpacity)}
            />

            {bandPaths.length > 0
              ? bandPaths.map((b) => (
                  <Path
                    key={b.key}
                    path={b.path}
                    style="fill"
                    color={b.color}
                  />
                ))
              : null}

            {bandPaths.length === 0 ? (
              <Path path={progress} style="fill" color={tint}>
                {gradient !== undefined && gradient.length > 1 ? (
                  <SweepGradient
                    c={vec(geometry.cx, geometry.cy)}
                    colors={[...gradient]}
                  />
                ) : null}
              </Path>
            ) : null}

            {needle ? (
              <Group>
                <Path
                  path={needlePath}
                  style="fill"
                  color={CHART_COLORS.foreground}
                />
              </Group>
            ) : null}
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

export type ActivityRing = {
  readonly value: number;
  readonly max?: number;
  readonly color?: string;
};

export type ActivityGaugeProps = {
  readonly rings: readonly ActivityRing[];
  readonly ringWidth?: number;
  readonly gap?: number;
  readonly trackOpacity?: number;
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

/**
 * Concentric progress rings — the Apple Watch pattern.
 *
 * Rings are stroked with round caps and drawn from 12 o'clock clockwise. The
 * track behind each ring is what makes an incomplete ring read as progress
 * rather than as an arbitrary arc.
 */
export function ActivityGauge({
  rings,
  ringWidth = 14,
  gap = 6,
  trackOpacity = 0.12,
  height = 220,
  style,
  children,
}: ActivityGaugeProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - h) < 0.5
        ? prev
        : { width, height: h }
    );
  }, []);

  const arcs = useMemo(() => {
    const cx = size.width / 2;
    const cy = size.height / 2;
    const outermost = Math.max(1, Math.min(cx, cy) - ringWidth / 2 - 4);

    return rings.map((ring, i) => {
      const radius = outermost - i * (ringWidth + gap);
      const max = ring.max ?? 100;
      const t = clamp(max === 0 ? 0 : ring.value / max, 0, 1);

      const rect = Skia.XYWHRect(
        cx - radius,
        cy - radius,
        radius * 2,
        radius * 2
      );

      const track = Skia.Path.Make();
      track.addArc(rect, -90, 360);

      const progress = Skia.Path.Make();
      if (t > 0) progress.addArc(rect, -90, 360 * t);

      return {
        key: String(i),
        radius,
        track,
        progress,
        color: ring.color ?? seriesColorAt(i),
      };
    });
  }, [rings, size, ringWidth, gap]);

  const ready = size.width > 0 && size.height > 0;

  return (
    <View style={[{ height }, styles.root, style]} onLayout={onLayout}>
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {arcs.map((arc) =>
            arc.radius > 0 ? (
              <Group key={arc.key}>
                <Path
                  path={arc.track}
                  style="stroke"
                  strokeWidth={ringWidth}
                  strokeCap="round"
                  color={withAlpha(arc.color, trackOpacity)}
                />
                <Path
                  path={arc.progress}
                  style="stroke"
                  strokeWidth={ringWidth}
                  strokeCap="round"
                  color={arc.color}
                />
              </Group>
            ) : null
          )}
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
  root: { width: '100%' },
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
