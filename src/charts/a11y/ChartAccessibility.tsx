import { useContext, useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { describeChart, describePoint, normaliseMissing } from '../../core';

import { ChartContext, useChart } from '../ChartContext';
import type { SeriesDatum } from '../ChartContext';
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
  const { yKeys, valuesFor, validFor, data, xKey, plotArea, xAt } = useChart();

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
  // Wide enough to be an easy target, never so wide it overlaps its neighbour
  // — overlapping bounds put Android's traversal ordering back in doubt.
  const columnWidth = total > 0 ? Math.max(8, plotArea.width / total) : 0;

  return (
    // The container is deliberately NOT `accessible`. On iOS a view with
    // `accessible` collapses everything beneath it into ONE element, so
    // marking the layer would have made the summary the only thing VoiceOver
    // could reach and silently swallowed every per-point element — the exact
    // feature this component exists for. Android's semantics differ, which is
    // why it worked there and not here.
    <View style={styles.layer}>
      {/* Summary first: it is what a screen-reader user hears before anything
          else, and it must carry the point of the chart rather than merely
          announce that a chart exists. It spans the whole layer, so its top
          edge sits above every column and both platforms order it first. */}
      <View
        style={styles.layer}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      />

      {showPoints
        ? Array.from({ length: total }, (_, i) => {
            const value = valid[i] === 1 ? (values[i] as number) : Number.NaN;
            const cx = xAt(i);

            return (
              <View
                key={i}
                // Deliberately invisible but focusable: a screen reader reads
                // it, a sighted user never sees it.
                //
                // A FULL-HEIGHT COLUMN, not a box at the data point. Android
                // orders accessibility traversal by view bounds, top row
                // first — so boxes sitting at their y values get read in
                // value order, which for revenue data came out as
                // "Jan, Feb, Apr, Jun, May, Jul, Aug, Mar". Columns share a
                // top edge, so the only thing left to order by is x, which is
                // data order. It is a bigger target for switch control too.
                style={[
                  styles.point,
                  {
                    left: cx - columnWidth / 2,
                    top: plotArea.y,
                    width: columnWidth,
                    height: plotArea.height,
                  },
                ]}
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
  /**
   * Data to tabulate, when rendering OUTSIDE a `<Chart>`.
   *
   * Which is the normal case: a chart has a fixed height and clips its
   * children, so a table placed inside it would be cropped and drawn on top of
   * the plot. Supplying the data directly is what lets the table sit beneath
   * the chart where it belongs. Omit these and it reads the surrounding chart
   * instead, for the rarer in-overlay use.
   */
  readonly data?: readonly SeriesDatum[];
  readonly xKey?: string;
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
  data: dataProp,
  xKey: xKeyProp,
}: DataTableProps): ReactElement {
  // Read the context WITHOUT useChart, which throws when absent — here a
  // missing chart is the expected standalone case, not a mistake.
  const chart = useContext(ChartContext);

  const data = dataProp ?? chart?.data ?? [];
  const xKey = xKeyProp ?? chart?.xKey ?? '';

  const keys = useMemo(() => {
    if (seriesKeys !== undefined) return seriesKeys;
    if (dataProp === undefined && chart !== null) return chart.yKeys;
    // Infer from the first row: every numeric column that is not the x axis.
    const first = data[0];
    if (first === undefined) return [];
    return Object.keys(first).filter(
      (k) => k !== xKey && typeof first[k] === 'number'
    );
  }, [seriesKeys, dataProp, chart, data, xKey]);

  // Columns come from the chart when it owns the data, and are normalised here
  // when the caller supplied it — same missing-data rules either way.
  const columns = useMemo(
    () =>
      keys.map((k) => {
        if (dataProp === undefined && chart !== null) {
          return {
            key: k,
            values: chart.valuesFor(k),
            valid: chart.validFor(k),
          };
        }
        // A non-numeric cell is missing data as far as the table is concerned —
        // it renders as an em dash rather than as a stringified object.
        const raw = data.map((d) => {
          const v = d[k];
          return typeof v === 'number' ? v : null;
        });
        const { values, valid } = normaliseMissing(raw);
        return { key: k, values, valid };
      }),
    [keys, dataProp, chart, data]
  );

  const format =
    formatValue ?? ((v: number) => String(Math.round(v * 100) / 100));

  const rows = Math.min(data.length, maxRows);

  return (
    <View accessibilityRole="summary" style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.cell, styles.header]}>{xKey}</Text>
        {columns.map((c) => (
          <Text key={c.key} style={[styles.cell, styles.header]}>
            {c.key}
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
            {columns.map((c) => {
              const v = c.values[i];
              const ok = c.valid[i] === 1 && v !== undefined;
              return (
                <Text key={c.key} style={styles.cell}>
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
  point: { position: 'absolute' },
  table: { marginTop: 8 },
  row: { flexDirection: 'row', paddingVertical: 3 },
  cell: { flex: 1, fontSize: 11, color: CHART_COLORS.muted },
  header: { fontWeight: '600', color: CHART_COLORS.foreground },
  more: { fontSize: 10, opacity: 0.5, marginTop: 4 },
  toggle: { minHeight: 44, justifyContent: 'center' },
  toggleText: { fontSize: 12, color: CHART_COLORS.muted },
});
