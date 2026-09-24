import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Chart } from '../Chart';
import { Grid, XAxis, YAxis } from '../axis/Axes';
import { Crosshair } from '../interaction/Crosshair';
import { Tooltip } from '../interaction/Tooltip';
import { DataLabels } from '../overlays/DataLabels';
import { Legend } from '../overlays/Legend';
import { Area } from '../series/Area';
import { Bar } from '../series/Bar';
import { Line } from '../series/Line';
import { PieChart } from '../series/Pie';
import { Scatter } from '../series/Scatter';
import { CHART_COLORS } from '../colors';
import { X_KEY, resolveOptions } from './resolveOptions';
import type { CartesianModel, PieModel } from './resolveOptions';
import type { GraphifyOptions } from './types';

export type GraphifyProps = {
  readonly options: GraphifyOptions;
  readonly style?: StyleProp<ViewStyle>;
};

/**
 * A whole chart from one Highcharts-style options object.
 *
 * An adapter, not a second renderer: it resolves the options into the same
 * `<Chart>`, series, tooltip and legend components the JSX API composes by
 * hand, so both APIs draw identical pixels. Reach for the JSX API when you
 * need something the options subset does not cover.
 */
export function Graphify({ options, style }: GraphifyProps): ReactElement {
  const [hidden, setHidden] = useState<readonly string[]>([]);

  const model = useMemo(
    () => resolveOptions(options, hidden),
    [options, hidden]
  );

  const toggle = useCallback((key: string) => {
    setHidden((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  return (
    <View
      style={[
        { height: model.height },
        model.backgroundColor !== undefined
          ? { backgroundColor: model.backgroundColor }
          : null,
        style,
      ]}
    >
      {model.title !== undefined ? (
        <Text accessibilityRole="header" style={styles.title}>
          {model.title}
        </Text>
      ) : null}
      {model.subtitle !== undefined ? (
        <Text style={styles.subtitle}>{model.subtitle}</Text>
      ) : null}

      {model.kind === 'pie' ? (
        <PieBody model={model} />
      ) : (
        <CartesianBody model={model} />
      )}

      {model.legend.enabled && model.legend.items.length > 0 ? (
        <Legend
          items={model.legend.items}
          hidden={hidden}
          onToggle={toggle}
          align={model.legend.align}
        />
      ) : null}
    </View>
  );
}

function CartesianBody({ model }: { model: CartesianModel }): ReactElement {
  const { series, tooltip } = model;

  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const colors = useMemo(() => series.map((s) => s.color), [series]);
  const columnKeys = useMemo(
    () => series.filter((s) => s.kind === 'column').map((s) => s.key),
    [series]
  );
  const labelKeys = useMemo(
    () => series.filter((s) => s.dataLabels).map((s) => s.key),
    [series]
  );

  return (
    <>
      {model.yTitle !== undefined ? (
        <Text style={styles.yTitle}>{model.yTitle}</Text>
      ) : null}

      <Chart
        data={model.rows}
        xKey={X_KEY}
        yKeys={keys}
        colors={colors}
        xScale={model.xScale}
        {...(model.yDomain !== undefined ? { yDomain: model.yDomain } : {})}
        cursor={tooltip.enabled}
        overlay={
          tooltip.enabled ? (
            <Tooltip
              shared={tooltip.shared}
              formatValue={tooltip.formatValue}
              formatLabel={tooltip.formatLabel}
            />
          ) : undefined
        }
        style={styles.fill}
      >
        <Grid />
        <YAxis />
        <XAxis />
        {/* Columns first so lines and points in a combo draw on top. */}
        {columnKeys.length > 0 ? <Bar seriesKeys={columnKeys} /> : null}
        {series.map((s) => {
          const width =
            s.lineWidth !== undefined ? { strokeWidth: s.lineWidth } : {};
          if (s.kind === 'line') {
            return (
              <Line
                key={s.key}
                seriesKey={s.key}
                curve={s.curve}
                connectNulls={s.connectNulls}
                markers={
                  s.markers
                    ? s.markerRadius !== undefined
                      ? { size: s.markerRadius }
                      : true
                    : false
                }
                {...width}
              />
            );
          }
          if (s.kind === 'area') {
            return (
              <Area
                key={s.key}
                seriesKey={s.key}
                curve={s.curve}
                connectNulls={s.connectNulls}
                {...width}
              />
            );
          }
          if (s.kind === 'scatter') {
            return (
              <Scatter
                key={s.key}
                seriesKey={s.key}
                {...(s.markerRadius !== undefined
                  ? { size: s.markerRadius }
                  : {})}
              />
            );
          }
          return null;
        })}
        {labelKeys.length > 0 ? (
          <DataLabels seriesKeys={labelKeys} barKeys={columnKeys} />
        ) : null}
        {tooltip.enabled ? <Crosshair /> : null}
      </Chart>

      {model.xTitle !== undefined ? (
        <Text style={styles.xTitle}>{model.xTitle}</Text>
      ) : null}
    </>
  );
}

function PieBody({ model }: { model: PieModel }): ReactElement {
  const { slices } = model;
  const data = useMemo(
    () => slices.map((s) => ({ name: s.key, value: s.value })),
    [slices]
  );
  const colors = useMemo(() => slices.map((s) => s.color), [slices]);

  return (
    <PieChart
      data={data}
      valueKey="value"
      colors={colors}
      innerRadius={model.innerRadius}
      startAngle={model.startAngle}
      endAngle={model.endAngle}
      style={styles.fill}
    />
  );
}

// Text uses the same fixed colours as the axes and labels drawn in the canvas.
// Following the OS scheme here alone put near-white titles over a light chart.
const styles = StyleSheet.create({
  // flex: 1 has a zero flex-basis, so the plot takes whatever height the
  // title, axis titles and legend leave — `chart.height` is the TOTAL, as in
  // Highcharts.
  fill: { flex: 1 },
  title: {
    color: CHART_COLORS.foreground,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: CHART_COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  yTitle: {
    color: CHART_COLORS.muted,
    fontSize: 11,
    marginTop: 8,
    marginLeft: 8,
  },
  xTitle: {
    color: CHART_COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
  },
});
