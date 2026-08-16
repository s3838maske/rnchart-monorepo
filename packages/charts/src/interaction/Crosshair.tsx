import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  Circle,
  Group,
  Line as SkiaLine,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import { useChart } from '../ChartContext';
import { useCursor } from './cursorState';
import { CHART_COLORS, withAlpha } from '../colors';

export type CrosshairProps = {
  readonly color?: string;
  readonly width?: number;
  /** Draw an emphasised dot on each series at the snapped index. */
  readonly dots?: boolean;
  readonly dotRadius?: number;
};

/** Pixel y per index, with NaN marking a missing datum. */
type PixelYs = readonly number[];

/** Off-canvas parking spot for a dot with nothing to point at. */
const OFFSCREEN = -9999;

/**
 * Vertical crosshair plus per-series dots at the snapped point.
 *
 * Every value here comes from a `useDerivedValue` reading the cursor's shared
 * values, so a drag updates the drawing entirely on the UI thread. Nothing in
 * this component causes a React render while the finger is down.
 *
 * IMPORTANT: worklets may only read plain data. Pixel positions are computed on
 * the JS thread into plain `number[]`s and merely INDEXED inside the worklet.
 * Passing a scale — or any closure — and calling it from the UI runtime throws
 * "Tried to synchronously call a Remote Function" at the first touch. It also
 * happens to be faster: the scale runs once per data change instead of once
 * per series per frame.
 */
export function Crosshair({
  color = CHART_COLORS.foreground,
  width = 1,
  dots = true,
  dotRadius = 5,
}: CrosshairProps): ReactElement | null {
  const { plotArea, yKeys, valuesFor, validFor, yScale, colorFor } = useChart();
  const cursor = useCursor();

  const seriesPixels = useMemo(
    () =>
      yKeys.map((key) => {
        const values = valuesFor(key);
        const valid = validFor(key);
        const ys: number[] = [];
        for (let i = 0; i < values.length; i += 1) {
          ys.push(
            valid[i] === 1 ? yScale.map(values[i] as number) : Number.NaN
          );
        }
        return { key, ys, color: colorFor(key) };
      }),
    [yKeys, valuesFor, validFor, yScale, colorFor]
  );

  const top = plotArea.y;
  const bottom = plotArea.y + plotArea.height;

  const p1 = useDerivedValue(
    () => vec(cursor?.snappedX.value ?? 0, top),
    [cursor, top]
  );
  const p2 = useDerivedValue(
    () => vec(cursor?.snappedX.value ?? 0, bottom),
    [cursor, bottom]
  );
  const opacity = useDerivedValue(
    () => (cursor?.active.value === true ? 1 : 0),
    [cursor]
  );

  if (cursor === null) return null;

  return (
    <Group opacity={opacity}>
      <SkiaLine
        p1={p1}
        p2={p2}
        color={withAlpha(color, 0.35)}
        strokeWidth={width}
      />

      {dots
        ? seriesPixels.map((s) => (
            <SeriesDot
              key={s.key}
              ys={s.ys}
              radius={dotRadius}
              color={s.color}
            />
          ))
        : null}
    </Group>
  );
}

type SeriesDotProps = {
  readonly ys: PixelYs;
  readonly radius: number;
  readonly color: string;
};

/**
 * One emphasised marker: a translucent outer ring plus a solid inner dot.
 *
 * The ring is what makes the active point read as active at a glance; a plain
 * filled circle disappears against a line of the same colour.
 */
function SeriesDot({ ys, radius, color }: SeriesDotProps): ReactElement {
  const cursor = useCursor();

  const cx = useDerivedValue(() => cursor?.snappedX.value ?? 0, [cursor]);

  const cy = useDerivedValue(() => {
    const i = cursor?.index.value ?? -1;
    if (i < 0 || i >= ys.length) return OFFSCREEN;
    const y = ys[i];
    // NaN marks a gap in the data — park the dot rather than drawing at NaN,
    // which Skia renders unpredictably.
    if (y === undefined || Number.isNaN(y)) return OFFSCREEN;
    return y;
  }, [cursor, ys]);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={radius * 2} color={withAlpha(color, 0.25)} />
      <Circle cx={cx} cy={cy} r={radius} color={color} />
    </Group>
  );
}
