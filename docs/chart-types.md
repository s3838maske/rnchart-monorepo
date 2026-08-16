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
