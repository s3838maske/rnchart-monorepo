# Why not react-native-svg?

The honest version, with the trade-offs included.

## The architectural difference

`react-native-svg` maps each SVG element to a **native view**. A 500-point line
is 500 views. React reconciles them, the platform lays them out, and the
shadow tree grows with your data.

Skia draws into a **single canvas**. A 500-point line is one path in one view.
The cost of adding a point is appending to a path, not mounting a view.

That is the whole argument. Everything else follows from it.

## What it changes in practice

Because drawing is cheap and views are not, this library batches everything it
can into a single path:

| Thing | Draw calls |
| --- | --- |
| All grid lines of one orientation | 1 |
| All bars of a series | 1 |
| All scatter points of a series | 1 |
| All tick marks of an axis | 1 |

At 200 bars, one accumulated `RRect` path versus 200 nodes is the difference
between 60fps and roughly 20fps on a mid-range Android device.

## The second difference: the JS thread

An SVG chart updates by re-rendering React components. During a drag that means
React work on every frame.

Skia values can be driven from Reanimated shared values on the **UI thread**.
Dragging a cursor across a 10,000-point line moves the crosshair without React
being involved at all. See [Interaction](./interaction.md).

## What you give up

Being fair about the costs:

- **Binary size.** Skia adds several megabytes of native code. For an app with
  one small chart, `react-native-svg` may genuinely be the better trade.
- **Expo Go.** Skia needs a development build. `react-native-svg` runs in Expo Go.
- **Text.** Skia text is drawn, not laid out by the platform. It does not
  select, and it needs more care for accessibility — which is why this
  library's legend and tooltip are React Native views rather than canvas
  elements.
- **Ecosystem age.** `react-native-svg` is older, more widely deployed, and has
  seen far more edge cases.
- **Web.** Neither helps directly today. SVG at least renders in a browser via
  react-native-web; Skia needs CanvasKit or a Canvas2D adapter, which is why a
  web renderer is planned as a separate package.

## When SVG is the right answer

- One or two small, static charts
- You must run in Expo Go
- Binary size is tightly constrained
- You need selectable or fully accessible text inside the chart

## When Skia is

- Many points, or data that updates continuously
- Gesture-driven interaction that must stay at 60fps
- Identical rendering across iOS and Android
- Charts as a core surface of the product rather than a decoration
