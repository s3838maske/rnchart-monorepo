import { computeDomain, formatValue } from '../../core';
import type { SeriesDatum } from '../ChartContext';
import type { XScaleKind } from '../Chart';
import type { LegendItem } from '../overlays/Legend';
import type { CurveKind } from '../series/Line';
import { seriesColorAt } from '../colors';
import type {
  GraphifyOptions,
  GraphifyPoint,
  GraphifySeries,
  GraphifySeriesOptions,
  GraphifySeriesType,
} from './types';

/** The row key the x value is stored under. */
export const X_KEY = '__x';

const DEFAULT_HEIGHT = 400;

export type CartesianKind = 'line' | 'area' | 'column' | 'scatter';

export type ResolvedSeries = {
  /** Unique, and also the display name the tooltip and legend show. */
  readonly key: string;
  readonly kind: CartesianKind;
  readonly color: string;
  readonly curve: CurveKind;
  readonly lineWidth?: number;
  /** Line markers. Scatter always draws its points. */
  readonly markers: boolean;
  readonly markerRadius?: number;
  readonly dataLabels: boolean;
  readonly connectNulls: boolean;
};

type ModelBase = {
  readonly title?: string;
  readonly subtitle?: string;
  readonly height: number;
  readonly backgroundColor?: string;
  readonly legend: {
    readonly enabled: boolean;
    readonly align: 'start' | 'center' | 'end';
    /** Every series or slice, hidden ones included, so they can be re-enabled. */
    readonly items: readonly LegendItem[];
  };
};

export type CartesianModel = ModelBase & {
  readonly kind: 'cartesian';
  readonly rows: readonly SeriesDatum[];
  readonly xScale: XScaleKind;
  readonly yDomain?: readonly [number, number];
  /** Visible series only. */
  readonly series: readonly ResolvedSeries[];
  readonly xTitle?: string;
  readonly yTitle?: string;
  readonly tooltip: {
    readonly enabled: boolean;
    readonly shared: boolean;
    readonly formatValue: (value: number) => string;
    readonly formatLabel: (index: number) => string;
  };
};

export type PieModel = ModelBase & {
  readonly kind: 'pie';
  /** Visible slices only. */
  readonly slices: readonly {
    readonly key: string;
    readonly value: number;
    readonly color: string;
  }[];
  /** In `<PieChart>` terms: a fraction of the radius when <= 1, else pixels. */
  readonly innerRadius: number;
  /** In `<PieChart>` terms: degrees clockwise from 3 o'clock. */
  readonly startAngle: number;
  readonly endAngle: number;
};

export type GraphifyModel = CartesianModel | PieModel;

type Point = {
  readonly x: number;
  readonly y: number | null;
  readonly name?: string;
};

function isPair(p: GraphifyPoint): p is readonly [number, number | null] {
  return Array.isArray(p);
}

/** Bare values and named points take their index as x, as in Highcharts. */
function toPoint(p: GraphifyPoint, index: number): Point {
  if (p === null || typeof p === 'number') return { x: index, y: p };
  if (isPair(p)) return { x: p[0], y: p[1] };
  return p.name === undefined
    ? { x: index, y: p.y }
    : { x: index, y: p.y, name: p.name };
}

function text(value: { readonly text?: string | null } | undefined) {
  const t = value?.text;
  return t === undefined || t === null || t === '' ? undefined : t;
}

/** Series names double as keys, so duplicates get a numeric suffix. */
function uniqueKeys(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${String(count)})`;
  });
}

function paletteColor(options: GraphifyOptions, index: number): string {
  const palette = options.colors;
  if (palette === undefined || palette.length === 0) {
    return seriesColorAt(index);
  }
  return palette[index % palette.length] ?? seriesColorAt(index);
}

/** Narrowest wins: `plotOptions.series`, then `plotOptions.<type>`, then the series. */
function mergeSeriesOptions(
  layers: readonly (GraphifySeriesOptions | undefined)[]
): GraphifySeriesOptions {
  return layers.reduce<GraphifySeriesOptions>(
    (acc, layer) =>
      layer === undefined
        ? acc
        : {
            ...acc,
            ...layer,
            marker: { ...acc.marker, ...layer.marker },
            dataLabels: { ...acc.dataLabels, ...layer.dataLabels },
          },
    {}
  );
}

function kindOf(type: Exclude<GraphifySeriesType, 'pie'>): {
  kind: CartesianKind;
  curve: CurveKind;
} {
  switch (type) {
    case 'spline':
      return { kind: 'line', curve: 'monotone' };
    case 'area':
      return { kind: 'area', curve: 'linear' };
    case 'areaspline':
      return { kind: 'area', curve: 'monotone' };
    case 'column':
      return { kind: 'column', curve: 'linear' };
    case 'scatter':
      return { kind: 'scatter', curve: 'linear' };
    case 'line':
      return { kind: 'line', curve: 'linear' };
  }
}

function legendOf(
  options: GraphifyOptions,
  items: readonly LegendItem[]
): ModelBase['legend'] {
  const align = options.legend?.align ?? 'center';
  return {
    enabled: options.legend?.enabled ?? true,
    align: align === 'left' ? 'start' : align === 'right' ? 'end' : 'center',
    items,
  };
}

function baseOf(
  options: GraphifyOptions,
  items: readonly LegendItem[]
): ModelBase {
  const title = text(options.title);
  const subtitle = text(options.subtitle);
  const background = options.chart?.backgroundColor;
  return {
    height: options.chart?.height ?? DEFAULT_HEIGHT,
    legend: legendOf(options, items),
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(background !== undefined ? { backgroundColor: background } : {}),
  };
}

function resolvePie(
  options: GraphifyOptions,
  series: GraphifySeries | undefined,
  hidden: readonly string[]
): PieModel {
  const merged = {
    ...options.plotOptions?.pie,
    ...series,
  };

  const points = series?.data ?? [];
  const names = points.map((p, i) =>
    p !== null && typeof p === 'object' && !isPair(p) && p.name !== undefined
      ? p.name
      : `Slice ${String(i + 1)}`
  );
  const keys = uniqueKeys(names);

  const all = points.map((p, i) => {
    const key = keys[i] ?? `Slice ${String(i + 1)}`;
    const own =
      p !== null && typeof p === 'object' && !isPair(p) ? p.color : undefined;
    const y = toPoint(p, i).y;
    return {
      key,
      value: y !== null && Number.isFinite(y) && y > 0 ? y : 0,
      color: own ?? paletteColor(options, i),
    };
  });

  // Highcharts innerSize is a DIAMETER; a percentage is the same ratio either way.
  const inner = merged.innerSize;
  const innerRadius =
    inner === undefined
      ? 0
      : typeof inner === 'number'
        ? inner / 2
        : Math.min(1, Math.max(0, Number.parseFloat(inner) / 100));

  // Highcharts measures from 12 o'clock; Skia from 3 o'clock.
  const start = merged.startAngle ?? 0;
  const end = merged.endAngle ?? start + 360;

  return {
    ...baseOf(
      options,
      all.map(({ key, color }) => ({ key, color }))
    ),
    kind: 'pie',
    slices: all.filter((s) => !hidden.includes(s.key)),
    innerRadius,
    startAngle: start - 90,
    endAngle: end - 90,
  };
}

function resolveCartesian(
  options: GraphifyOptions,
  hidden: readonly string[]
): CartesianModel {
  const baseType = options.chart?.type ?? 'line';
  const xAxis = options.xAxis;
  const categories = xAxis?.categories ?? [];

  // A pie has no place on cartesian axes; it only renders as the whole chart.
  const source = options.series
    .map((s, index) => ({ s, index, type: s.type ?? baseType }))
    .filter(
      (e): e is typeof e & { type: Exclude<GraphifySeriesType, 'pie'> } =>
        e.type !== 'pie'
    );

  const numeric =
    xAxis?.type === 'linear' ||
    xAxis?.type === 'datetime' ||
    (xAxis?.type !== 'category' && source.some((e) => e.s.data.some(isPair)));

  const keys = uniqueKeys(
    source.map((e) => e.s.name ?? `Series ${String(e.index + 1)}`)
  );

  const all = source.map((e, i) => {
    const points = e.s.data.map(toPoint);
    const byX = new Map<number, number | null>();
    for (const p of points) byX.set(p.x, p.y);
    return {
      key: keys[i] ?? `Series ${String(e.index + 1)}`,
      type: e.type,
      points,
      byX,
      color: e.s.color ?? paletteColor(options, e.index),
      merged: mergeSeriesOptions([
        options.plotOptions?.series,
        options.plotOptions?.[e.type],
        e.s,
      ]),
    };
  });

  // Every x any series (hidden or not) has, so the axis stays put on toggle.
  const xSet = new Set<number>();
  if (!numeric) categories.forEach((_, i) => xSet.add(i));
  for (const s of all) for (const p of s.points) xSet.add(p.x);
  const xs = [...xSet].sort((a, b) => a - b);

  const nameAt = new Map<number, string>();
  for (const s of all) {
    for (const p of s.points) {
      if (p.name !== undefined && !nameAt.has(p.x)) nameAt.set(p.x, p.name);
    }
  }

  const visible = all.filter((s) => !hidden.includes(s.key));

  const rows: SeriesDatum[] = xs.map((x) => {
    const row: Record<string, number | string | null> = {
      [X_KEY]: numeric ? x : (categories[x] ?? nameAt.get(x) ?? x),
    };
    for (const s of visible) row[s.key] = s.byX.get(x) ?? null;
    return row;
  });

  const series: ResolvedSeries[] = visible.map((s) => {
    const { kind, curve } = kindOf(s.type);
    const { merged } = s;
    // Rows another series added are ABSENT for this one, not missing data —
    // connect across them rather than breaking the line at every foreign x.
    const covers = s.byX.size >= xs.length;
    return {
      key: s.key,
      kind,
      color: s.color,
      curve,
      markers: kind === 'line' && merged.marker?.enabled !== false,
      dataLabels: merged.dataLabels?.enabled === true,
      connectNulls: merged.connectNulls ?? (numeric && !covers),
      ...(merged.marker?.radius !== undefined
        ? { markerRadius: merged.marker.radius }
        : {}),
      ...(merged.lineWidth !== undefined
        ? { lineWidth: merged.lineWidth }
        : {}),
    };
  });

  const tracking = visible.some((s) => s.merged.enableMouseTracking !== false);

  const yAxis = options.yAxis;
  const yDomain =
    yAxis?.min !== undefined || yAxis?.max !== undefined
      ? computeDomain(
          series.map((s) => rows.map((r) => Number(r[s.key] ?? Number.NaN))),
          {
            includeZero: true,
            padding: 0.08,
            nice: true,
            ...(yAxis.min !== undefined ? { min: yAxis.min } : {}),
            ...(yAxis.max !== undefined ? { max: yAxis.max } : {}),
          }
        )
      : undefined;

  const tip = options.tooltip;
  const prefix = tip?.valuePrefix ?? '';
  const suffix = tip?.valueSuffix ?? '';
  const decimals = tip?.valueDecimals;
  const isTime = xAxis?.type === 'datetime';

  const xTitle = text(xAxis?.title);
  const yTitle = text(yAxis?.title);

  return {
    ...baseOf(
      options,
      all.map((s) => ({ key: s.key, color: s.color }))
    ),
    kind: 'cartesian',
    rows,
    xScale: numeric ? (isTime ? 'time' : 'linear') : 'band',
    series,
    tooltip: {
      enabled: tip?.enabled !== false && tracking,
      shared: tip?.shared ?? true,
      formatValue: (value) =>
        `${prefix}${formatValue(
          value,
          decimals !== undefined ? { decimals } : {}
        )}${suffix}`,
      formatLabel: (index) => {
        const x = rows[index]?.[X_KEY];
        if (typeof x === 'string') return x;
        if (typeof x !== 'number') return '';
        return numeric
          ? formatValue(x, isTime ? { type: 'time' } : {})
          : String(x);
      },
    },
    ...(yDomain !== undefined ? { yDomain } : {}),
    ...(xTitle !== undefined ? { xTitle } : {}),
    ...(yTitle !== undefined ? { yTitle } : {}),
  };
}

/**
 * Turn a Highcharts-style options object into what `<Graphify>` renders.
 *
 * Pure, so every mapping decision is unit-testable without a renderer.
 * `hidden` holds the legend keys the user has toggled off.
 */
export function resolveOptions(
  options: GraphifyOptions,
  hidden: readonly string[] = []
): GraphifyModel {
  const first = options.series[0];
  const firstType = first?.type ?? options.chart?.type ?? 'line';
  return firstType === 'pie'
    ? resolvePie(options, first, hidden)
    : resolveCartesian(options, hidden);
}
