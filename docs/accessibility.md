# Accessibility

A Skia canvas is a single opaque view. VoiceOver and TalkBack see one
unlabelled rectangle where the chart is, and everything in it — every value,
every trend, every outlier — is unreachable. No React Native charting library
ships a fix for this today.

`<ChartAccessibility>` is the fix: a spoken summary, plus one focusable
element per datum layered over the canvas.

```tsx
<Chart
  data={monthly}
  xKey="month"
  yKeys={['revenue']}
  overlay={
    <ChartAccessibility
      chartType="Line chart"
      title="Monthly revenue"
      formatValue={(v) => `${Math.round(v)} thousand`}
    />
  }
>
  <Grid />
  <YAxis />
  <XAxis />
  <Line seriesKey="revenue" markers />
</Chart>
```

A screen-reader user now hears:

> Line chart. Monthly revenue. Jan to Aug. 8 data points. Values range from
> 180 thousand at Mar to 610 thousand at Aug. Overall trend: increasing.
> Overall up 190 percent. Swipe right to explore data points.

then swipes through `Jan, 210 thousand, 1 of 8` … `Aug, 610 thousand, 8 of 8`.

## Props

| Prop | Default | Notes |
| --- | --- | --- |
| `seriesKey` | first `yKey` | Which series to describe. |
| `chartType` | `'Chart'` | Leads the summary. Say what it is: `'Line chart'`, `'Bar chart'`. |
| `title` | — | Included after the type. |
| `formatValue` | rounds to 2dp | Applied to **values**, never to the percentage. |
| `maxPoints` | `100` | Above this, only the summary is exposed. |

`maxPoints` exists because a thousand invisible focusable views is worse for a
screen-reader user than none — focus order becomes unusable and the view-tree
cost is real. Above the cap, the summary still carries the shape of the data.

## Three things that are easy to get wrong

These were all found by dumping the real accessibility tree on both platforms.
None of them are visible to typecheck, lint, or unit tests.

**Do not mark the container `accessible`.** On iOS a view with `accessible`
collapses everything beneath it into one element, so marking the layer makes
the summary the only thing VoiceOver can reach and silently swallows every
per-point element. The summary is a **sibling** of the points, not their
parent. Android's semantics differ, which is why this kind of bug passes on
one platform and fails on the other.

**Per-point elements are full-height columns, not boxes at the data point.**
Android orders accessibility traversal by view bounds, top row first. Boxes
positioned at their y values therefore get read in *value* order — real
revenue data came out as `Jan, Feb, Apr, Jun, May, Jul, Aug, Mar`. Columns
share a top edge, so the only thing left to order by is x, which is data
order.

**Do not run percentages through `formatValue`.** It formats values in the
series' own units and a percentage is not one. Reusing it produced
`Overall up 190 thousand percent`.

## The data table

The numbers as a real table — a fallback for screen-reader users, and a plain
"show me the values" affordance that sighted users want too.

```tsx
const [open, setOpen] = useState(false);

<DataTableToggle expanded={open} onPress={() => setOpen((v) => !v)} />
{open ? <DataTable data={monthly} xKey="month" seriesKeys={['revenue']} /> : null}
```

Pass `data` and `xKey` when rendering **outside** a `<Chart>`, which is the
normal case: a chart has a fixed height and clips its children, so a table
placed inside it would be cropped and drawn over the plot. Omit them and it
reads the surrounding chart instead.

## Announcements

```ts
import { announce } from 'react-native-graphify';

announce('Filtered to last 30 days. 412 points.');
```

No-ops when no screen reader is running, so it is safe to call unconditionally.

## Colour is never the only channel

Add `pattern` to a series so it stays distinguishable in greyscale and under
colour-vision deficiency:

```tsx
<Bar grouped pattern="diagonal" />
```

The built-in palettes are checked against simulated deuteranopia, protanopia
and tritanopia by `verifyPalette`, which is run as a test rather than trusted.
`muted` alternates dark and light deliberately: lightness is the one channel
every type of colour-vision deficiency preserves.

## Describing data without rendering

The analysis is pure and exported, so you can use it for a caption, a summary
card, or your own overlay:

```ts
import {
  describeChart,
  describeSeries,
  describePoint,
  describeOutliers,
} from 'react-native-graphify';

describeSeries([10, 20, 30]).trend;  // 'increasing'
describeOutliers(values, { categoryLabels });  // 'One outlier, at Aug.'
```

Trend is the regression slope measured **relative to the data's own standard
deviation**, not against a fixed threshold. A slope of 5 is a strong rise in
data that varies by 2 and statistical noise in data that varies by 500; an
absolute cutoff would have to call both the same thing, which is worse than
saying nothing. Data with no clear direction is reported as `volatile` rather
than being forced into "increasing" or "decreasing".

## Verifying it yourself

Turn on the screen reader and swipe, but also read the tree directly:

```sh
# Android
adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml
grep -o 'content-desc="[^"]*"' ui.xml
```

The order the nodes come back in **is** the order a screen reader will read
them. That is how the traversal-order bug above was found.
