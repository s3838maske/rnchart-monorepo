# Getting started

## Requirements

- React Native 0.78 or newer, New Architecture (Fabric) enabled
- React 19
- A development build. **Skia does not run in Expo Go.**

## Install

```sh
npm install @rnchart/charts @rnchart/core @rnchart/skia
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler
```

`expo-haptics` is optional. Install it only if you want haptic feedback on the
touch cursor; without it the library degrades to silence rather than failing.

### Babel

Reanimated 4 moved the worklet transform into `react-native-worklets`. It must
be **last** in the plugin list:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
```

### Gesture root

Interaction needs a gesture root at the top of your app:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}>{/* … */}</GestureHandlerRootView>;
}
```

## The shape of a chart

`<Chart>` measures itself, derives the domains, runs the layout solver and
publishes the solved scales through context. Children draw — they never compute
a domain or a plot rectangle.

That split matters: two components computing the same domain independently is
how axes and data drift apart by a pixel and nobody can work out why.

```tsx
<Chart data={data} xKey="month" yKeys={['revenue', 'target']} height={220}>
  <Grid />
  <YAxis />
  <XAxis />
  <Line seriesKey="revenue" />
  <Line seriesKey="target" />
</Chart>
```

Order inside `<Chart>` is z-order. Put `<Grid />` first so it sits behind the
data.

## Data

Data is an array of plain objects. `xKey` names the category or numeric x
field; `yKeys` names the numeric series.

```tsx
const data = [
  { month: 'Jan', revenue: 210, target: 180 },
  { month: 'Feb', revenue: 340, target: 240 },
];
```

Values may be `null`, `undefined` or `NaN`. All three are treated identically
and the renderer breaks the line at that point. See
[Chart types → Missing data](./chart-types.md#missing-data).

## Scales

| `xScale` | Use for |
| --- | --- |
| `band` (default) | Categories. Bars need this. |
| `point` | Categories without a band width — lines and scatter over categories. |
| `linear` | Numeric x. |
| `time` | Epoch-millisecond x. Ticks snap to natural boundaries. |

The y scale is always linear and derived from the data. Override it with
`yDomain`, or shape it with `includeZero` (default `true`) and `yPadding`.

```tsx
<Chart data={data} xKey="t" yKeys={['v']} xScale="time" yDomain={[0, 100]} />
```

## Common props

| Prop | Default | Notes |
| --- | --- | --- |
| `height` | `240` | The chart fills its parent's width. |
| `includeZero` | `true` | An honest baseline for bar charts. |
| `yPadding` | `0.08` | Headroom as a fraction of the extent. |
| `padding` | `8` all round | Outer padding around the whole chart. |
| `cursor` | `false` | Enables touch tracking. |
| `haptics` | `false` | Requires `cursor`. |
| `overlay` | — | React Native nodes drawn above the canvas. |
| `emptyMessage` | `'No data'` | Shown when `data` is empty. |

## Next

- [Chart types](./chart-types.md)
- [Interaction](./interaction.md)
- [Theming](./theming.md)
