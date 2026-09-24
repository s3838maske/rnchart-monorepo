/**
 * A Highcharts-style options object for `<Graphify>`.
 *
 * A deliberate SUBSET of the Highcharts API: every key typed here does
 * something. Keys Highcharts has and this library does not are absent from the
 * type, so an unsupported option is a compile error rather than a silent no-op.
 * `credits` is the one exception — accepted so configs copied from Highcharts
 * compile, with nothing to hide.
 */

export type GraphifySeriesType =
  'line' | 'spline' | 'area' | 'areaspline' | 'column' | 'scatter' | 'pie';

/** A named point. `color` applies to pie slices. */
export type GraphifyPointObject = {
  readonly name?: string;
  readonly y: number | null;
  readonly color?: string;
};

/**
 * One data point, in any of the three shapes Highcharts accepts:
 * a bare value, an `[x, y]` pair, or a named point object.
 */
export type GraphifyPoint =
  number | null | readonly [x: number, y: number | null] | GraphifyPointObject;

export type GraphifyDataLabels = {
  readonly enabled?: boolean;
};

/** Options shared by `plotOptions.series`, `plotOptions.<type>` and a series. */
export type GraphifySeriesOptions = {
  readonly lineWidth?: number;
  readonly marker?: {
    readonly enabled?: boolean;
    readonly radius?: number;
  };
  readonly dataLabels?: GraphifyDataLabels;
  /** `false` on every series turns the touch tooltip off. */
  readonly enableMouseTracking?: boolean;
  /** Draw across `null` values instead of breaking the line. */
  readonly connectNulls?: boolean;
};

export type GraphifyPieOptions = {
  /** Donut hole: `'60%'` of the radius, or pixels. */
  readonly innerSize?: number | `${number}%`;
  /** Degrees clockwise from 12 o'clock, as in Highcharts. */
  readonly startAngle?: number;
  readonly endAngle?: number;
};

export type GraphifySeries = GraphifySeriesOptions &
  GraphifyPieOptions & {
    readonly type?: GraphifySeriesType;
    readonly name?: string;
    readonly color?: string;
    readonly data: readonly GraphifyPoint[];
  };

export type GraphifyAxisTitle = {
  readonly text?: string | null;
};

export type GraphifyOptions = {
  readonly chart?: {
    /** Default series type. Defaults to `'line'`. */
    readonly type?: GraphifySeriesType;
    /** Total height, including title and legend. Defaults to 400. */
    readonly height?: number;
    readonly backgroundColor?: string;
  };
  readonly title?: { readonly text?: string | null };
  readonly subtitle?: { readonly text?: string | null };
  /** Series palette. Wraps when there are more series than colours. */
  readonly colors?: readonly string[];
  readonly xAxis?: {
    readonly categories?: readonly string[];
    /** Inferred: `datetime`/`linear` when points are `[x, y]` pairs. */
    readonly type?: 'category' | 'linear' | 'datetime';
    readonly title?: GraphifyAxisTitle;
  };
  readonly yAxis?: {
    readonly title?: GraphifyAxisTitle;
    readonly min?: number;
    readonly max?: number;
  };
  readonly tooltip?: {
    readonly enabled?: boolean;
    /**
     * On touch the tooltip always follows the finger's x position. `true`
     * (the default) lists every series there; `false` lists only the first.
     */
    readonly shared?: boolean;
    readonly valuePrefix?: string;
    readonly valueSuffix?: string;
    readonly valueDecimals?: number;
  };
  readonly legend?: {
    readonly enabled?: boolean;
    readonly align?: 'left' | 'center' | 'right';
  };
  readonly plotOptions?: {
    readonly series?: GraphifySeriesOptions;
    readonly line?: GraphifySeriesOptions;
    readonly spline?: GraphifySeriesOptions;
    readonly area?: GraphifySeriesOptions;
    readonly areaspline?: GraphifySeriesOptions;
    readonly column?: GraphifySeriesOptions;
    readonly scatter?: GraphifySeriesOptions;
    readonly pie?: GraphifySeriesOptions & GraphifyPieOptions;
  };
  readonly series: readonly GraphifySeries[];
  /** Accepted for Highcharts compatibility. There are no credits to show. */
  readonly credits?: { readonly enabled?: boolean };
};
