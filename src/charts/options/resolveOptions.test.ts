import { computeDomain } from '../../core';
import { SERIES_COLORS } from '../colors';
import { X_KEY, resolveOptions } from './resolveOptions';
import type { CartesianModel, GraphifyModel, PieModel } from './resolveOptions';
import type { GraphifyOptions } from './types';

function cartesian(model: GraphifyModel): CartesianModel {
  if (model.kind !== 'cartesian') throw new Error('expected cartesian');
  return model;
}

function pie(model: GraphifyModel): PieModel {
  if (model.kind !== 'pie') throw new Error('expected pie');
  return model;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** The Highcharts example this API exists to accept, verbatim. */
const MONTHLY_SALES: GraphifyOptions = {
  chart: { type: 'line', height: 400 },
  title: { text: 'Monthly Sales' },
  subtitle: { text: 'Sales performance for 2026' },
  xAxis: { categories: MONTHS },
  yAxis: { title: { text: 'Sales' } },
  tooltip: { shared: true, valuePrefix: '₹' },
  plotOptions: {
    line: { dataLabels: { enabled: true }, enableMouseTracking: true },
  },
  series: [
    {
      name: 'Sales',
      data: [
        12000, 18000, 15000, 22000, 28000, 32000, 30000, 35000, 42000, 39000,
        45000, 52000,
      ],
    },
  ],
  credits: { enabled: false },
};

describe('resolveOptions — the Highcharts line example', () => {
  const model = cartesian(resolveOptions(MONTHLY_SALES));

  it('maps chart, titles and axis title', () => {
    expect(model.height).toBe(400);
    expect(model.title).toBe('Monthly Sales');
    expect(model.subtitle).toBe('Sales performance for 2026');
    expect(model.yTitle).toBe('Sales');
    expect(model.xTitle).toBeUndefined();
  });

  it('builds one row per category on a band axis', () => {
    expect(model.xScale).toBe('band');
    expect(model.rows).toHaveLength(12);
    expect(model.rows[0]).toEqual({ [X_KEY]: 'Jan', Sales: 12000 });
    expect(model.rows[11]).toEqual({ [X_KEY]: 'Dec', Sales: 52000 });
  });

  it('resolves the series from plotOptions.line', () => {
    expect(model.series).toEqual([
      {
        key: 'Sales',
        kind: 'line',
        color: SERIES_COLORS[0],
        curve: 'linear',
        markers: true,
        dataLabels: true,
        connectNulls: false,
      },
    ]);
  });

  it('formats the tooltip with the value prefix', () => {
    expect(model.tooltip.enabled).toBe(true);
    expect(model.tooltip.shared).toBe(true);
    expect(model.tooltip.formatValue(12000)).toBe(
      `₹${new Intl.NumberFormat().format(12000)}`
    );
    expect(model.tooltip.formatLabel(0)).toBe('Jan');
  });

  it('shows a legend by default, as Highcharts does', () => {
    expect(model.legend).toEqual({
      enabled: true,
      align: 'center',
      items: [{ key: 'Sales', color: SERIES_COLORS[0] }],
    });
  });
});

describe('resolveOptions — series types', () => {
  it('maps each Highcharts type to a kind and a curve', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          { type: 'line', data: [1] },
          { type: 'spline', data: [1] },
          { type: 'area', data: [1] },
          { type: 'areaspline', data: [1] },
          { type: 'column', data: [1] },
          { type: 'scatter', data: [1] },
        ],
      })
    );
    expect(model.series.map((s) => [s.kind, s.curve])).toEqual([
      ['line', 'linear'],
      ['line', 'monotone'],
      ['area', 'linear'],
      ['area', 'monotone'],
      ['column', 'linear'],
      ['scatter', 'linear'],
    ]);
  });

  it('defaults to line, and lets a series override chart.type', () => {
    const model = cartesian(
      resolveOptions({
        chart: { type: 'column' },
        series: [{ data: [1] }, { type: 'spline', data: [2] }],
      })
    );
    expect(model.series.map((s) => s.kind)).toEqual(['column', 'line']);
    expect(
      cartesian(resolveOptions({ series: [{ data: [1] }] })).series[0]?.kind
    ).toBe('line');
  });

  it('only draws markers for lines', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          { type: 'line', data: [1] },
          { type: 'area', data: [1] },
          { type: 'line', data: [1], marker: { enabled: false } },
        ],
      })
    );
    expect(model.series.map((s) => s.markers)).toEqual([true, false, false]);
  });

  it('drops a pie series from a cartesian chart', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          { name: 'a', data: [1] },
          { name: 'b', type: 'pie', data: [1] },
        ],
      })
    );
    expect(model.series.map((s) => s.key)).toEqual(['a']);
  });
});

describe('resolveOptions — option precedence', () => {
  it('narrowest wins: plotOptions.series, then the type, then the series', () => {
    const model = cartesian(
      resolveOptions({
        plotOptions: {
          series: { dataLabels: { enabled: true }, lineWidth: 1 },
          line: { dataLabels: { enabled: false }, lineWidth: 2 },
        },
        series: [
          { type: 'line', data: [1] },
          { type: 'line', data: [1], lineWidth: 3 },
          { type: 'area', data: [1] },
        ],
      })
    );
    expect(model.series.map((s) => [s.dataLabels, s.lineWidth])).toEqual([
      [false, 2],
      [false, 3],
      [true, 1],
    ]);
  });

  it('merges nested marker options instead of replacing them', () => {
    const model = cartesian(
      resolveOptions({
        plotOptions: { series: { marker: { radius: 6 } } },
        series: [{ data: [1], marker: { enabled: true } }],
      })
    );
    expect(model.series[0]?.markerRadius).toBe(6);
    expect(model.series[0]?.markers).toBe(true);
  });
});

describe('resolveOptions — names and colours', () => {
  it('names unnamed series and de-duplicates repeats', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          { data: [1] },
          { name: 'A', data: [1] },
          { name: 'A', data: [1] },
        ],
      })
    );
    expect(model.series.map((s) => s.key)).toEqual(['Series 1', 'A', 'A (2)']);
  });

  it('takes series.color, then the colors option (wrapping), then the palette', () => {
    const model = cartesian(
      resolveOptions({
        colors: ['#111111', '#222222'],
        series: [{ data: [1] }, { data: [1], color: '#ff0000' }, { data: [1] }],
      })
    );
    expect(model.series.map((s) => s.color)).toEqual([
      '#111111',
      '#ff0000',
      '#111111',
    ]);
    expect(
      cartesian(resolveOptions({ series: [{ data: [1] }, { data: [1] }] }))
        .series[1]?.color
    ).toBe(SERIES_COLORS[1]);
  });
});

describe('resolveOptions — hiding series from the legend', () => {
  const options: GraphifyOptions = {
    xAxis: { categories: ['a', 'b'] },
    series: [
      { name: 'Revenue', data: [1, 2] },
      { name: 'Target', data: [3, 4] },
    ],
  };

  it('removes the series from what is drawn but keeps it in the legend', () => {
    const model = cartesian(resolveOptions(options, ['Revenue']));
    expect(model.series.map((s) => s.key)).toEqual(['Target']);
    expect(model.rows[0]).toEqual({ [X_KEY]: 'a', Target: 3 });
    expect(model.legend.items.map((i) => i.key)).toEqual(['Revenue', 'Target']);
  });

  it('keeps each remaining series on its own colour', () => {
    const model = cartesian(resolveOptions(options, ['Revenue']));
    expect(model.series[0]?.color).toBe(SERIES_COLORS[1]);
  });
});

describe('resolveOptions — data shapes', () => {
  it('keeps nulls as gaps', () => {
    const model = cartesian(
      resolveOptions({
        xAxis: { categories: ['a', 'b', 'c'] },
        series: [{ name: 's', data: [1, null, 3] }],
      })
    );
    expect(model.rows.map((r) => r.s)).toEqual([1, null, 3]);
    expect(model.series[0]?.connectNulls).toBe(false);
  });

  it('pads a series shorter than the categories', () => {
    const model = cartesian(
      resolveOptions({
        xAxis: { categories: ['a', 'b', 'c'] },
        series: [{ name: 's', data: [1] }],
      })
    );
    expect(model.rows.map((r) => r.s)).toEqual([1, null, null]);
  });

  it('uses point names as categories when there are none', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          {
            name: 's',
            data: [
              { name: 'Chrome', y: 61 },
              { name: 'Safari', y: 19 },
            ],
          },
        ],
      })
    );
    expect(model.rows).toEqual([
      { [X_KEY]: 'Chrome', s: 61 },
      { [X_KEY]: 'Safari', s: 19 },
    ]);
  });

  it('merges [x, y] pairs from every series onto one sorted linear axis', () => {
    const model = cartesian(
      resolveOptions({
        series: [
          {
            name: 'a',
            data: [
              [3, 30],
              [1, 10],
            ],
          },
          { name: 'b', data: [[2, 20]] },
        ],
      })
    );
    expect(model.xScale).toBe('linear');
    expect(model.rows).toEqual([
      { [X_KEY]: 1, a: 10, b: null },
      { [X_KEY]: 2, a: null, b: 20 },
      { [X_KEY]: 3, a: 30, b: null },
    ]);
    // Absent rows are another series' x values, not missing data.
    expect(model.series.map((s) => s.connectNulls)).toEqual([true, true]);
  });

  it('uses a time axis and time labels for datetime', () => {
    const jan = Date.UTC(2026, 0, 15);
    const model = cartesian(
      resolveOptions({
        xAxis: { type: 'datetime' },
        series: [{ data: [[jan, 5]] }],
      })
    );
    expect(model.xScale).toBe('time');
    expect(model.tooltip.formatLabel(0)).toMatch(/Jan|15/);
  });
});

describe('resolveOptions — y axis bounds', () => {
  const data = { series: [{ data: [10, 20, 30] }] };

  it('leaves the domain to the chart when no bound is given', () => {
    expect(cartesian(resolveOptions(data)).yDomain).toBeUndefined();
  });

  it('honours min and max as hard bounds', () => {
    expect(
      cartesian(resolveOptions({ ...data, yAxis: { min: 5, max: 50 } })).yDomain
    ).toEqual([5, 50]);
  });

  it('leaves the other end where the chart would put it on its own', () => {
    const domain = cartesian(
      resolveOptions({ ...data, yAxis: { max: 100 } })
    ).yDomain;
    // <Chart>'s own defaults: includeZero, 8% padding, nice.
    const auto = computeDomain([10, 20, 30], {
      includeZero: true,
      padding: 0.08,
      nice: true,
    });
    expect(domain).toEqual([auto[0], 100]);
  });
});

describe('resolveOptions — tooltip and legend switches', () => {
  it('disables the tooltip explicitly', () => {
    expect(
      cartesian(
        resolveOptions({ tooltip: { enabled: false }, series: [{ data: [1] }] })
      ).tooltip.enabled
    ).toBe(false);
  });

  it('disables the tooltip when no series tracks touches', () => {
    expect(
      cartesian(
        resolveOptions({
          plotOptions: { series: { enableMouseTracking: false } },
          series: [{ data: [1] }],
        })
      ).tooltip.enabled
    ).toBe(false);
  });

  it('applies valueDecimals and valueSuffix', () => {
    const format = cartesian(
      resolveOptions({
        tooltip: { valueDecimals: 2, valueSuffix: ' kg' },
        series: [{ data: [1] }],
      })
    ).tooltip.formatValue;
    expect(format(3.14159)).toBe(
      `${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(3.14159)} kg`
    );
  });

  it('maps legend switches', () => {
    const model = resolveOptions({
      legend: { enabled: false, align: 'right' },
      series: [{ data: [1] }],
    });
    expect(model.legend.enabled).toBe(false);
    expect(model.legend.align).toBe('end');
  });

  it('treats an empty or null title as none', () => {
    expect(
      resolveOptions({ title: { text: '' }, series: [] }).title
    ).toBeUndefined();
    expect(
      resolveOptions({ title: { text: null }, series: [] }).title
    ).toBeUndefined();
  });
});

describe('resolveOptions — pie', () => {
  const BROWSERS: GraphifyOptions = {
    chart: { type: 'pie' },
    plotOptions: { pie: { innerSize: '60%' } },
    series: [
      {
        name: 'Share',
        data: [
          { name: 'Chrome', y: 61, color: '#000000' },
          { name: 'Safari', y: 19 },
          20,
        ],
      },
    ],
  };

  it('turns points into slices with names and colours', () => {
    const model = pie(resolveOptions(BROWSERS));
    expect(model.slices).toEqual([
      { key: 'Chrome', value: 61, color: '#000000' },
      { key: 'Safari', value: 19, color: SERIES_COLORS[1] },
      { key: 'Slice 3', value: 20, color: SERIES_COLORS[2] },
    ]);
  });

  it('reads innerSize as a fraction or a pixel diameter', () => {
    expect(pie(resolveOptions(BROWSERS)).innerRadius).toBeCloseTo(0.6);
    expect(
      pie(
        resolveOptions({
          ...BROWSERS,
          plotOptions: { pie: { innerSize: 100 } },
        })
      ).innerRadius
    ).toBe(50);
  });

  it('converts angles from 12 o’clock to 3 o’clock', () => {
    const full = pie(resolveOptions(BROWSERS));
    expect([full.startAngle, full.endAngle]).toEqual([-90, 270]);

    const semi = pie(
      resolveOptions({
        ...BROWSERS,
        plotOptions: { pie: { startAngle: -90, endAngle: 90 } },
      })
    );
    expect([semi.startAngle, semi.endAngle]).toEqual([-180, 0]);
  });

  it('is chosen by the first series type too', () => {
    expect(
      resolveOptions({ series: [{ type: 'pie', data: [1, 2] }] }).kind
    ).toBe('pie');
  });

  it('hides toggled slices but keeps them in the legend', () => {
    const model = pie(resolveOptions(BROWSERS, ['Safari']));
    expect(model.slices.map((s) => s.key)).toEqual(['Chrome', 'Slice 3']);
    expect(model.legend.items.map((i) => i.key)).toEqual([
      'Chrome',
      'Safari',
      'Slice 3',
    ]);
  });

  it('clamps unusable values to an empty slice', () => {
    const model = pie(
      resolveOptions({
        chart: { type: 'pie' },
        series: [{ data: [null, -4, 5] }],
      })
    );
    expect(model.slices.map((s) => s.value)).toEqual([0, 0, 5]);
  });
});
