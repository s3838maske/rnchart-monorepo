# Theming

## One call to rebrand

```tsx
import { setDefaults } from 'react-native-graphify';

setDefaults({
  palette: 'muted',
  colors: { foreground: '#1a1a2e' },
  radii: { bar: 8 },
});
```

Call once at app start. Resolution order, narrowest wins:

```
chart `theme` prop  >  <ChartThemeProvider>  >  setDefaults()  >  built-in
```

## Scoping to a subtree

```tsx
<ChartThemeProvider palette="mono" colorScheme="dark">
  <ReportCharts />
</ChartThemeProvider>
```

## Dark mode

Follows the OS by default through `useColorScheme`. Force it with
`colorScheme="light" | "dark" | "system"`.

Dark mode raises grid opacity from 8% to 12%, because light-on-dark lines read
weaker at the same value.

## Palettes

| Name | For |
| --- | --- |
| `vivid` | Saturated, high contrast. Consumer apps. |
| `muted` | Desaturated. Dense analytics where many series share one chart. |
| `mono` | Single hue at varying lightness. Print-style reports. |

All three are **verified programmatically** against deuteranopia, protanopia and
tritanopia simulation — adjacent series must stay perceptually apart, because a
chart assigns colours in order.

`muted` deliberately alternates dark and light. Lightness is the one channel
every colour-vision type preserves, so alternating it is what keeps adjacent
series apart. An all-mid-tone muted palette fails deuteranopia — the first
version of it did, and the test caught it.

Check your own:

```ts
import { verifyPalette } from 'react-native-graphify';

const report = verifyPalette(['#3b82f6', '#f59e0b']);
if (!report.ok) console.warn(report.failures);
```

## Tokens

```ts
type ChartTheme = {
  colors: { series; background; foreground; muted; grid; tooltip: { bg; text; border } };
  typography: { fontFamily?; axisLabel; dataLabel; title; letterSpacing };
  grid: { width; dash; opacity };
  animation: { duration; stagger; spring: { damping; stiffness }; enabled };
  radii: { bar; tooltip };
};
```

Overrides are deep-merged one level, so changing one tooltip colour does not
require restating the other two.

Use `defineTheme()` for autocomplete when authoring one.

## Animation and reduced motion

Every series animates through one hook:

```ts
const animation = useChartAnimation();
```

It reads the theme's `animation.enabled` **and** the OS reduce-motion setting.
When reduce motion is on, animations **snap to their final state** rather than
running faster — a fast animation is still an animation, and the setting exists
for people who get motion sickness from it.

`staggerFor(index, count)` caps the **total** stagger at 800ms, so a 30ms
stagger across 200 bars does not take six seconds.
