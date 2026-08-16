import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { describeChart, describePoint } from '../../core';

import { useChart } from '../ChartContext';
import { CHART_COLORS } from '../colors';

export type ChartAccessibilityProps = {
  readonly seriesKey?: string;
  readonly chartType?: string;
  readonly title?: string;
  readonly formatValue?: (value: number) => string;
  /**
   * Cap on per-point overlay views.
   *
   * Above this the summary alone is exposed. A thousand invisible views is
   * worse for a screen-reader user than none: focus order becomes unusable and
   * the view tree cost is real.
   */
  readonly maxPoints?: number;
};

/**
 * Screen-reader layer for a chart.
 *
 * No React Native charting library ships this today, and Highcharts' equivalent
 * is one of its strongest enterprise selling points — so it is both the correct
 * engineering and the clearest differentiator available.
 *
 * Skia draws into a canvas, which is opaque to accessibility services. The fix
 * is a layer of invisible, absolutely-positioned RN views — one per datum —
 * carrying real labels. Focus order follows data order.
 */
export function ChartAccessibility({
  seriesKey,
  chartType = 'Chart',
  title,
  formatValue,
  maxPoints = 100,
}: ChartAccessibilityProps): ReactElement | null {
  const { yKeys, valuesFor, validFor, data, xKey, plotArea, xAt, yScale } =
    useChart();

  const key = seriesKey ?? yKeys[0];

  const labels = useMemo(
    () =>
      data.map((d, i) => {
        const raw = d[xKey];
        return typeof raw === 'string' || typeof raw === 'number'
          ? String(raw)
          : `Point ${String(i + 1)}`;
      }),
    [data, xKey]
  );

  const summary = useMemo(() => {
    if (key === undefined) return `${chartType}. No data.`;
    return describeChart(valuesFor(key), {
      chartType,
      categoryLabels: labels,
      ...(title !== undefined ? { title } : {}),
      ...(seriesKey !== undefined ? { seriesName: seriesKey } : {}),
      ...(formatValue !== undefined ? { formatValue } : {}),
    });
  }, [key, valuesFor, chartType, labels, title, seriesKey, formatValue]);

  if (key === undefined) return null;

  const values = valuesFor(key);
  const valid = validFor(key);
  const total = values.length;
  const showPoints = total > 0 && total <= maxPoints;

  return (
    <View
      style={styles.layer}
      // The summary is what a screen-reader user hears FIRST. It must carry
      // the point of the chart, not merely announce that a chart exists.
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      {showPoints
        ? Array.from({ length: total }, (_, i) => {
            const value = valid[i] === 1 ? (values[i] as number) : Number.NaN;
            const cx = xAt(i);
            const cy = Number.isFinite(value) ? yScale.map(value) : plotArea.y;

            return (
              <View
                key={i}
                // Deliberately invisible but focusable: a screen reader reads
                // it, a sighted user never sees it.
                style={[styles.point, { left: cx - 16, top: cy - 16 }]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={describePoint(i, total, value, {
                  ...(labels[i] !== undefined ? { label: labels[i] } : {}),
                  ...(formatValue !== undefined ? { formatValue } : {}),
                })}
              />
            );
          })
        : null}
    </View>
  );
}

export type DataTableProps = {
  readonly seriesKeys?: readonly string[];
  readonly maxRows?: number;
  readonly formatValue?: (value: number) => string;
};

/**
 * The underlying data as an accessible table.
 *
 * A fallback for screen-reader users, and genuinely useful as a plain
 * "show me the numbers" affordance for everyone else — which is why it is a
 * visible component rather than something only assistive tech can reach.
 */
export function DataTable({
  seriesKeys,
  maxRows = 50,
  formatValue,
}: DataTableProps): ReactElement {
  const { yKeys, valuesFor, validFor, data, xKey } = useChart();
  const keys = seriesKeys ?? yKeys;
  const format =
    formatValue ?? ((v: number) => String(Math.round(v * 100) / 100));

  const rows = Math.min(data.length, maxRows);

  return (
    <View accessibilityRole="summary" style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.cell, styles.header]}>{xKey}</Text>
        {keys.map((k) => (
          <Text key={k} style={[styles.cell, styles.header]}>
            {k}
          </Text>
        ))}
      </View>

      {Array.from({ length: rows }, (_, i) => {
        const raw = data[i]?.[xKey];
        const label =
          typeof raw === 'string' || typeof raw === 'number'
            ? String(raw)
            : String(i + 1);

        return (
          <View key={i} style={styles.row} accessible>
            <Text style={styles.cell}>{label}</Text>
            {keys.map((k) => {
              const v = valuesFor(k)[i];
              const ok = validFor(k)[i] === 1 && v !== undefined;
              return (
                <Text key={k} style={styles.cell}>
                  {ok ? format(v) : '—'}
                </Text>
              );
            })}
          </View>
        );
      })}

      {data.length > rows ? (
        <Text style={styles.more}>
          {`${String(data.length - rows)} more rows not shown`}
        </Text>
      ) : null}
    </View>
  );
}

/** Announce a message through the screen reader, if one is running. */
export function announce(message: string): void {
  void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
    if (enabled) AccessibilityInfo.announceForAccessibility(message);
  });
}

export type DataTableToggleProps = {
  readonly onPress: () => void;
  readonly expanded: boolean;
};

/** Button exposing the data table, for sighted and non-sighted users alike. */
export function DataTableToggle({
  onPress,
  expanded,
}: DataTableToggleProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? 'Hide data table' : 'Show data table'}
      hitSlop={10}
      style={styles.toggle}
    >
      <Text style={styles.toggleText}>
        {expanded ? 'Hide data table' : 'Show data table'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  point: { position: 'absolute', width: 32, height: 32 },
  table: { marginTop: 8 },
  row: { flexDirection: 'row', paddingVertical: 3 },
  cell: { flex: 1, fontSize: 11, color: CHART_COLORS.muted },
  header: { fontWeight: '600', color: CHART_COLORS.foreground },
  more: { fontSize: 10, opacity: 0.5, marginTop: 4 },
  toggle: { minHeight: 44, justifyContent: 'center' },
  toggleText: { fontSize: 12, color: CHART_COLORS.muted },
});
