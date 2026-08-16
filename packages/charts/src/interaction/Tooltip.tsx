import { useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import { useChart } from '../ChartContext';
import type { SeriesDatum } from '../ChartContext';
import { useCursor } from './cursorState';
import { CHART_COLORS } from '../colors';

export type TooltipProps = {
  /** Show every series' value at the snapped x, each with a colour swatch. */
  readonly shared?: boolean;
  readonly width?: number;
  readonly formatValue?: (value: number, seriesKey: string) => string;
  readonly formatLabel?: (index: number) => string;
};

const SPRING = { damping: 20, stiffness: 200 } as const;
const EDGE_PADDING = 8;

/**
 * A tooltip that trails the cursor.
 *
 * Two details do most of the work for perceived quality:
 *
 * 1. It follows with a spring rather than sticking rigidly to the finger. The
 *    slight lag reads as physical; a rigidly-attached tooltip reads as a
 *    debug overlay.
 * 2. It flips at the edges. Computed from the measured plot area, so the
 *    tooltip never leaves the screen — which is the single most common way
 *    mobile chart tooltips break.
 *
 * Rendered as a React Native view rather than into the canvas: it needs real
 * text, accessibility and layout, all of which RN does better than Skia.
 */
export function Tooltip({
  shared = true,
  width = 148,
  formatValue,
  formatLabel,
}: TooltipProps): ReactElement | null {
  const { plotArea, yKeys, valuesFor, validFor, colorFor, data, xKey } =
    useChart();
  const cursor = useCursor();

  const targetX = useDerivedValue(() => {
    const x = cursor?.snappedX.value ?? 0;
    const wouldOverflowRight = x + 12 + width > plotArea.x + plotArea.width;
    // Flip to the cursor's left rather than letting it run off the edge.
    const raw = wouldOverflowRight ? x - 12 - width : x + 12;
    return Math.max(EDGE_PADDING, raw);
  }, [cursor, plotArea, width]);

  const style = useAnimatedStyle(() => ({
    opacity: withSpring(cursor?.active.value === true ? 1 : 0, SPRING),
    transform: [{ translateX: withSpring(targetX.value, SPRING) }],
  }));

  if (cursor === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      // Android composites an `elevation` shadow as a layer SEPARATE from the
      // view it belongs to. Fading a parent's opacity therefore animates the
      // card and its shadow on different schedules — the card appears, then the
      // shadow catches up, and on release the shadow leaves first. Two fixes,
      // both required: the shadow lives on this animated view rather than on a
      // child, and offscreen alpha compositing forces card and shadow to
      // composite as ONE layer before opacity is applied.
      needsOffscreenAlphaCompositing={Platform.OS === 'android'}
      style={[
        styles.container,
        styles.card,
        { width, top: plotArea.y + 8 },
        style,
      ]}
    >
      <TooltipBody
        shared={shared}
        yKeys={yKeys}
        valuesFor={valuesFor}
        validFor={validFor}
        colorFor={colorFor}
        data={data}
        xKey={xKey}
        {...(formatValue !== undefined ? { formatValue } : {})}
        {...(formatLabel !== undefined ? { formatLabel } : {})}
      />
    </Animated.View>
  );
}

type BodyProps = {
  readonly shared: boolean;
  readonly yKeys: readonly string[];
  readonly valuesFor: (k: string) => Float32Array;
  readonly validFor: (k: string) => Uint8Array;
  readonly colorFor: (k: string) => string;
  readonly data: readonly SeriesDatum[];
  readonly xKey: string;
  readonly formatValue?: (value: number, seriesKey: string) => string;
  readonly formatLabel?: (index: number) => string;
};

/**
 * The tooltip's contents.
 *
 * Reads the snapped index via `useAnimatedStyle` on each row rather than
 * lifting it into React state. Text cannot be driven from the UI thread in
 * React Native, so the row values do update on the JS thread — but only the
 * text, and only when the index actually changes. The cursor, crosshair and
 * tooltip POSITION all stay on the UI thread.
 */
function TooltipBody({
  shared,
  yKeys,
  valuesFor,
  validFor,
  colorFor,
  data,
  xKey,
  formatValue,
  formatLabel,
}: BodyProps): ReactElement {
  const cursor = useCursor();
  const keys = shared ? yKeys : yKeys.slice(0, 1);

  return (
    <View>
      <TooltipLabel
        data={data}
        xKey={xKey}
        {...(formatLabel !== undefined ? { formatLabel } : {})}
      />
      {keys.map((key) => (
        <TooltipRow
          key={key}
          seriesKey={key}
          color={colorFor(key)}
          values={valuesFor(key)}
          valid={validFor(key)}
          cursorIndexRef={cursor}
          {...(formatValue !== undefined ? { formatValue } : {})}
        />
      ))}
    </View>
  );
}

/** Categories are strings or numbers; anything else has no sensible label. */
function formatCategory(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function TooltipLabel({
  data,
  xKey,
  formatLabel,
}: {
  data: readonly SeriesDatum[];
  xKey: string;
  formatLabel?: (index: number) => string;
}): ReactElement {
  const cursor = useCursor();
  const index = useTrackedIndex(cursor);

  const text =
    index < 0 || index >= data.length
      ? ''
      : formatLabel !== undefined
        ? formatLabel(index)
        : formatCategory(data[index]?.[xKey]);

  return <Text style={styles.label}>{text}</Text>;
}

function TooltipRow({
  seriesKey,
  color,
  values,
  valid,
  cursorIndexRef,
  formatValue,
}: {
  seriesKey: string;
  color: string;
  values: Float32Array;
  valid: Uint8Array;
  cursorIndexRef: ReturnType<typeof useCursor>;
  formatValue?: (value: number, seriesKey: string) => string;
}): ReactElement {
  const index = useTrackedIndex(cursorIndexRef);

  const hasValue = index >= 0 && index < values.length && valid[index] === 1;
  const raw = hasValue ? (values[index] as number) : null;
  const text =
    raw === null
      ? '—'
      : formatValue !== undefined
        ? formatValue(raw, seriesKey)
        : String(Math.round(raw * 100) / 100);

  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.rowKey} numberOfLines={1}>
        {seriesKey}
      </Text>
      <Text style={styles.rowValue}>{text}</Text>
    </View>
  );
}

/**
 * Mirror the cursor's index onto the JS thread, throttled to index CHANGES.
 *
 * Documented as a JS-thread bridge because it is one: text needs React. It
 * fires only when the snapped index changes, never per frame, which is the
 * difference between a few updates per drag and sixty per second.
 */
function useTrackedIndex(cursor: ReturnType<typeof useCursor>): number {
  const [index, setIndex] = useState(-1);

  useAnimatedReaction(
    () => cursor?.index.value ?? -1,
    (current, previous) => {
      if (current !== previous) runOnJS(setIndex)(current);
    },
    [cursor]
  );

  return index;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    color: CHART_COLORS.foreground,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  rowKey: {
    flex: 1,
    fontSize: 11,
    color: CHART_COLORS.muted,
  },
  rowValue: {
    fontSize: 11,
    fontWeight: '600',
    color: CHART_COLORS.foreground,
  },
});
