# Chart types

![Cartesian series on iOS](./assets/ios-cartesian.png)

## Line

```tsx
<Line seriesKey="revenue" curve="monotone" markers strokeWidth={2.5} />
```

| Prop | Default | Notes |
| --- | --- | --- |
| `curve` | `'monotone'` | `linear`, `monotone`, `step`, `stepAfter` |
| `strokeWidth` | `2.5` | |
| `color` | series colour | |
| `markers` | `false` | Auto-hidden when points crowd closer than ~3× the marker |
| `connectNulls` | `false` | |

### Why monotone is the default

`monotone` uses Fritsch–Carlson tangents, which are clamped so the curve **never
overshoots the data**. A cardinal or catmull-rom spline through `0, 100, 0` dips
below zero between the points — on a revenue chart that draws negative revenue
that never happened.

## Area

```tsx
<Area seriesKey="revenue" fillOpacity={0.6} gradient />
```

Everything `<Line>` has, plus `fillOpacity` and `gradient`.

The default fill is a three-stop gradient at positions `[0, 0.7, 1]` rather than
a linear fade. The eased falloff reads as depth; a straight linear ramp reads as
a flat wash.

An `<Area>` with `strokeWidth > 0` draws its own top edge, so you do not need to
declare a `<Line>` as well.

## Column

![Grouped columns](./assets/android-bar-missing.png)

```tsx
<Bar grouped cornerRadius={4} minBarLength={2} />
```

| Prop | Default | Notes |
| --- | --- | --- |
| `grouped` | `false` | Render every `yKey` side by side |
| `seriesKey` | — | Render one series only |
| `cornerRadius` | `4` | Applied to the **outer** end only |
| `barPadding` | `0.15` | Fraction of the band left empty |
| `minBarLength` | `2` | So near-zero values still show |

Corners round on the outer end only — the top of a positive column, the bottom
of a negative one. Rounding all four makes a column look like a pill floating
off its baseline.

Every bar of a series accumulates into a single `SkPath`. At 200 bars that is
the difference between 60fps and roughly 20fps.

## Scatter and bubble

```tsx
<Scatter seriesKey="y" shape="circle" size={4} />
<Scatter seriesKey="y" sizeKey="weight" minRadius={3} maxRadius={18} />
```

Passing `sizeKey` makes it a bubble chart. Radius maps through a **sqrt** scale,
because area should encode magnitude, not radius. Mapping value straight to
radius makes a 4× value look 16× bigger — the most common way a bubble chart
lies.

## Pie, donut, semi-circle

![Donut, pie and semi-circle](./assets/android-pie.png)

```tsx
<PieChart data={split} valueKey="share" innerRadius={0.62}>
  <Text>46%</Text>
</PieChart>
```

| Prop | Default | Notes |
| --- | --- | --- |
| `innerRadius` | `0` | Fraction of outer radius; `0` is a pie |
| `startAngle` / `endAngle` | `-90` / `270` | Degrees. `-180`/`0` gives a semi-circle |
| `padAngle` | `0.01` | Radians between slices |
| `sortSlices` | `false` | Largest first |

`<PieChart>` owns its own canvas rather than living inside `<Chart>`: it has no
axes and no plot rectangle, so forcing it through the cartesian layout solver
would reserve space for axes that will never be drawn.

Children render in the donut hole.

## Missing data

`null`, `undefined` and `NaN` are all treated as missing. The policy decides
what the renderer does:

| Policy | Behaviour |
| --- | --- |
| `gap` (default) | Emit `NaN`; the line genuinely breaks |
| `connect` | Interpolate across the hole |
| `zero` | Treat the hole as zero |

`zero` is correct for counts and badly misleading for prices, which is why it is
not the default.

Every policy returns a parallel `Uint8Array` validity mask, so a genuine zero
stays distinguishable from a hole — under `zero` they look identical in the
values alone.

## Gradients

Every series takes the same `gradient` prop. Three forms, shortest first:

```tsx
<Area seriesKey="revenue" gradient />                        {/* series colour → transparent */}
<Bar  seriesKey="revenue" gradient={['#8b5cf6', '#06b6d4']} /> {/* colour array */}
<Radar
  seriesKey="alpha"
  gradient={{
    type: 'radial',
    colors: ['rgba(139,92,246,0.05)', 'rgba(59,130,246,0.45)', 'rgba(6,182,212,0.75)'],
    positions: [0, 0.55, 1],
  }}
/>
```

| Field | Notes |
| --- | --- |
| `type` | `linear` (default), `radial`, `sweep` |
| `colors` | Two or more stops. Use `rgba()` to control alpha per stop. |
| `positions` | 0 to 1, same length as `colors` |
| `direction` | `vertical` (default) or `horizontal`. Linear only. |
| `opacity` | Multiplies every stop's alpha |

**Which type suits which chart.** `radial` reads best on a radar, because it
runs centre-outward and that is how the eye already reads distance from the
middle as magnitude. `linear` vertical suits area and column fills. `sweep`
suits gauges, where the ramp should follow the arc.

The gradient spec is plain data, not a Skia node, because the series knows its
own geometry and you do not — a radar supplies the bounding circle, a column
chart supplies the plot rect. You describe the ramp; the series supplies the
frame.

## Pan and zoom

```tsx
<Chart data={data} xKey="month" yKeys={['revenue']} zoomable>
  <Grid />
  <YAxis />
  <XAxis />
  <ZoomPan>
    <Line seriesKey="revenue" />
  </ZoomPan>
</Chart>
```

Put the series inside `<ZoomPan>` and leave the grid and axes outside — the
grid should not stretch with the data.

| Prop | Default | Notes |
| --- | --- | --- |
| `zoomable` | `false` | Enables pinch, pan and double-tap-to-reset |
| `maxZoom` | `8` | |
| `momentum` | `true` | Flick carries with decay and rubber-bands at the edges |

Pinch anchors at the **focal point between your fingers**, not the plot centre.
Centre-anchoring makes content slide out from under the fingers, which reads as
the chart fighting you.

## Streaming

The problem this solves is specific: appending points to an ordinary chart
makes it **narrower and narrower** as the domain grows, instead of scrolling a
fixed window. victory-native issue #251 is exactly this.

```tsx
const chart = useRef<StreamingChartRef>(null);

useEffect(() => {
  const id = setInterval(() => {
    chart.current?.append({ x: Date.now(), y: readSensor() });
  }, 16);
  return () => clearInterval(id);
}, []);

<StreamingChart ref={chart} mode="scroll" capacity={240} height={160} />
```

| Mode | Behaviour |
| --- | --- |
| `scroll` | Window slides; newest sample at the right edge. The finance pattern. |
| `sweep` | Fixed window overwritten left to right by a moving write head. The ECG pattern. |
| `grow` | Fills the window, then behaves like `scroll`. |

### How it avoids re-rendering

```
append()  →  ring buffer (fixed Float32Array, allocated once)
          →  pixel coordinates into a SHARED VALUE
          →  useDerivedValue rebuilds the SkPath on the UI THREAD
```

No `setState`, so React never reconciles. At 60 appends a second that is the
difference between 60 reconciliations a second and none. Memory is flat: the
ring buffer is allocated at construction and never grows, and `toView()` avoids
copying unless the buffer has wrapped — and copies exactly once when it has.

### A worklet trap worth knowing

Do not capture a React **ref** inside a worklet. Reanimated freezes the object,
every later write to `.current` is silently dropped, and you get:

```
[Worklets] Tried to modify key `current` of an object which has been
already passed to a worklet.
```

This chart hit exactly that: the size ref froze at `{0, 0}`, so the publish step
early-returned on every append and the chart rendered empty with no error. Use a
**shared value** for anything a worklet reads.

### Using the ring buffer directly

```ts
import { createRingBuffer } from 'react-native-graphify';

const rb = createRingBuffer(1000, 2); // 1000 entries of [x, y]
rb.push(x, y);
const { view, copied, length } = rb.toView();
```

## Annotations

Plot lines, bands and callouts. All three are positioned in **data
coordinates**, so they track pan and zoom through the same scales the series
use — a line pinned to a pixel drifts the moment the chart moves.

```tsx
<Chart data={monthly} xKey="month" yKeys={['revenue']}>
  <Grid />
  <YAxis />
  <XAxis />

  <PlotBand axis="y" from={380} to={520} label="Target range" />
  <PlotLine axis="y" value={450} label="Goal" color="#ef4444" />
  <PlotLine axis="y" value={300} label="Break-even" dash={[4, 4]} />

  <Line seriesKey="revenue" markers />

  <Annotations
    items={[
      { id: 'peak', x: 'Aug', y: 610, text: 'Record month', connector: true },
      { id: 'dip', x: 'Mar', y: 180, text: 'Supply issue' },
    ]}
  />
</Chart>
```

`dash` takes `[on, off]` in pixels, or `null` for a solid line. Overlapping
annotation labels are resolved by `resolveLabelPlacement` — the same function
the data labels use, because two different answers to "do these labels
overlap" is worse than either answer alone.

## Statistical series

```tsx
<AreaRange lowKey="low" highKey="high" />   {/* confidence band */}
<Line seriesKey="actual" />                 {/* declared after, so it sits on top */}

<Dumbbell lowKey="before" highKey="after" />
<ErrorBars lowKey="low" highKey="high" />
```

### Box plots

```tsx
<BoxPlot groups={samples} whiskers="tukey" notched showMean />
```

`groups` is one array of **raw values** per category — the component computes
the statistics itself.

| `whiskers` | Reach |
| --- | --- |
| `tukey` | The most extreme value inside Q1 − 1.5·IQR … Q3 + 1.5·IQR. Anything beyond is an outlier. |
| `minmax` | The true minimum and maximum. No outliers. |
| `stddev` | Mean ± one standard deviation. |

Two details that are easy to get wrong and are pinned down by tests:

- Whiskers stop at the most extreme value **inside** the fence, never at the
  fence itself. Drawing to the fence invents a data point that does not exist.
- Quantiles come from `computeBoxStats` in core, verified against known R
  output. Libraries disagree about quantile definitions and the discrepancy is
  a recurring bug report, so both R type 6 and type 7 are available; 7 is the
  default, matching R and NumPy.

Notches show the median's confidence interval, `±1.58·IQR/√n`. That is wider
than half the box whenever **n < 10**, so below that the notch is clamped to
the quartiles — otherwise the outline pinches shut into a bowtie that reads as
a rendering fault. It is really the "sample too small to notch" signal; R
prints `notches went outside hinges` for the same situation.

### Waterfall

```tsx
const steps = cashflow.map((s, i) => ({
  label: s.step,
  value: s.delta,
  isSum: i === cashflow.length - 1,
}));

<Chart
  data={cashflow}
  xKey="step"
  yKeys={['delta']}
  yDomain={waterfallDomain(steps)}
>
  <Waterfall valueKey="delta" sumIndices={[cashflow.length - 1]} />
</Chart>
```

**Pass `yDomain={waterfallDomain(steps)}`.** The chart derives its domain from
the values it is handed — the *deltas* — while the bars are drawn at cumulative
positions that usually climb higher. Without it, every bar above the largest
single delta is clipped away with nothing to indicate it.

Subtotal columns rise from **zero**, not from the running total. A subtotal is
an absolute position, not another delta, and treating it as one is what makes
waterfall charts silently wrong.

### Histograms and derived series

These are plain functions in core — they return data, and you render it with
whatever series suits:

```ts
import { histogram, pareto, bellCurve, chooseBinCount } from 'react-native-graphify';

const bins = histogram(samples);                     // Freedman–Diaconis
const bins = histogram(samples, { bins: 20 });       // explicit count
const bins = histogram(samples, { bins: [0, 10, 20] }); // explicit edges
```

Freedman–Diaconis is the default because it uses the IQR rather than the
standard deviation, so a single outlier does not blow the bin width out. It
falls back to Sturges when the IQR is zero, as NumPy does. Bins are half-open
`[x0, x1)` **except the last**, which includes its upper edge — otherwise the
single largest value silently vanishes.

## Pattern fills

Texture as a second channel alongside colour, so a chart stays readable in
greyscale and under colour-vision deficiency.

```tsx
<Bar grouped pattern="diagonal" />
```

Kinds: `diagonal`, `diagonal-reverse`, `cross-hatch`, `dots`, `horizontal`,
`vertical`.

For anything that is not a series — a shaded "below target" zone, a single
highlighted band — use `<Pattern>` directly. It takes explicit bounds rather
than reading the chart, so it can be scoped to a region as easily as the whole
plot:

```tsx
function HatchedZone({ from, to }: { from: number; to: number }) {
  const { plotArea, yScale } = useChart();
  const yTop = yScale.map(to);
  const yBottom = yScale.map(from);

  return (
    <Pattern
      kind="cross-hatch"
      color="#ef4444"
      bounds={{
        x: plotArea.x,
        y: yTop,
        width: plotArea.width,
        height: Math.abs(yBottom - yTop),
      }}
    />
  );
}
```
