# Options API

`<Graphify>` draws a whole chart from one Highcharts-style options object. If
you already have Highcharts configs, most of them port by changing the import.

```tsx
import { Graphify } from 'react-native-graphify';
import type { GraphifyOptions } from 'react-native-graphify';

const options: GraphifyOptions = {
  chart: { type: 'line', height: 400 },
  title: { text: 'Monthly Sales' },
  subtitle: { text: 'Sales performance for 2026' },
  xAxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
  yAxis: { title: { text: 'Sales' } },
  tooltip: { shared: true, valuePrefix: '₹' },
  plotOptions: {
    line: { dataLabels: { enabled: true } },
  },
  series: [{ name: 'Sales', data: [12000, 18000, 15000, 22000, 28000, 32000] }],
  credits: { enabled: false },
};

export function MonthlySales() {
  return <Graphify options={options} />;
}
```

Annotate the object as `GraphifyOptions`. Without the annotation TypeScript
infers `type: string` rather than `type: 'line'`, and the object no longer
type-checks. `Highcharts.Options` has the same requirement.

The touch tooltip needs a `GestureHandlerRootView` at the root of your app —
see [Getting started](getting-started.md#gesture-root).

## It is an adapter

`<Graphify>` resolves the options into the same `<Chart>`, series, tooltip and
legend components the [JSX API](getting-started.md#the-shape-of-a-chart)
composes by hand. Both APIs draw identical pixels. When you need something the
options don't cover — zoom, annotations, drilldown, statistical series — use the
JSX API for that chart.

## Supported options

The type is a **subset** of Highcharts, and every key in it does something. A
key that is not supported is missing from `GraphifyOptions`, so it fails to
compile rather than being silently ignored. `credits` is the one exception: it
is accepted so copied configs compile, and it has no effect.

| Option | Notes |
| --- | --- |
| `chart.type` | `line`, `spline`, `area`, `areaspline`, `column`, `scatter`, `pie`. Defaults to `line`. |
| `chart.height` | The **total** height, including title and legend, as in Highcharts. Defaults to 400. |
| `chart.backgroundColor` | |
| `title.text`, `subtitle.text` | |
| `colors` | Series palette. Wraps around when there are more series than colours. |
| `xAxis.categories` | |
| `xAxis.type` | `category`, `linear`, `datetime`. Inferred as `linear` when the data is `[x, y]` pairs. |
| `xAxis.title.text`, `yAxis.title.text` | |
| `yAxis.min`, `yAxis.max` | Hard bounds. Set one and the other end is computed as usual. |
| `tooltip.enabled`, `shared`, `valuePrefix`, `valueSuffix`, `valueDecimals` | |
| `legend.enabled`, `legend.align` | Tap an entry to hide or show its series or slice. |
| `plotOptions.series`, `plotOptions.<type>` | `lineWidth`, `marker.enabled`, `marker.radius`, `dataLabels.enabled`, `enableMouseTracking`, `connectNulls`. |
| `plotOptions.pie` | Also `innerSize` (`'60%'` or pixels), `startAngle`, `endAngle`. |
| `series[]` | `name`, `type`, `color`, `data`, and any of the `plotOptions` keys above. |

Options resolve the same way they do in Highcharts: `plotOptions.series`, then
`plotOptions.<type>`, then the series itself. The narrowest setting wins.

### Data

A series' `data` accepts the three Highcharts shapes, and you can mix them:

```ts
data: [5, 8, null, 3]                          // with xAxis.categories
data: [[0, 5], [1, 8], [3, 3]]                 // numeric x
data: [{ name: 'Chrome', y: 61, color: '#4285f4' }] // named points
```

- `null` breaks a line. Set `connectNulls: true` to draw across the gap instead.
- Without `categories`, point names become the categories.
- `[x, y]` series are merged onto one sorted x axis. A series is connected
  across x values that only *other* series have, so two series sampled at
  different times still draw as lines.

### Combos

A series `type` overrides `chart.type`, so a column chart with one `spline`
series draws grouped columns with a line on top.

## Where it differs from Highcharts

These are mobile decisions, not omissions:

- **The tooltip follows the finger.** It shows the values at the x position
  you are touching. `shared: true` (the default here, unlike Highcharts) lists
  every series; `shared: false` lists only the first.
- **Data labels use the y axis's compact format** (`52k`, not `52000`), so
  labels and axis always write numbers the same way. Labels that would overlap
  are dropped, and the larger value keeps its label.
- **The y-axis title sits above the axis**, not rotated along it. A rotated
  title takes horizontal space a phone does not have.
- **Line markers hide automatically** when points are too close together for
  a marker to show anything.

## Not supported yet

Horizontal `bar`, stacking, bubbles, per-point colours on cartesian series,
pie data labels and a pie tooltip, `pie` mixed into a cartesian chart (the pie
series is dropped), point click events, and `formatter` callbacks. The JSX API
covers several of these today — for example `onPointPress` on `<Chart>`.
