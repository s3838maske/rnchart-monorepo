# Interaction

## Cursor, crosshair and tooltip

```tsx
<Chart data={data} xKey="month" yKeys={['revenue']} cursor haptics overlay={<Tooltip />}>
  <Grid />
  <YAxis />
  <XAxis />
  <Area seriesKey="revenue" />
  <Crosshair />
</Chart>
```

`cursor` enables a pan gesture composed with a long press. Both write to
Reanimated shared values. `<Crosshair>` draws from those shared values inside
the canvas; `<Tooltip>` is a React Native overlay positioned from them.

## What runs where

This is the part that decides whether a chart feels native.

| On the UI thread | On the JS thread |
| --- | --- |
| Touch tracking | Tooltip **text** |
| Index snapping (binary search) | `onCursorChange`-style callbacks |
| Crosshair position | |
| Cursor dot positions | |
| Tooltip **position** and opacity | |

Nothing causes a React render while the finger is down except the tooltip's
text, and that updates only when the snapped **index changes** — not per frame.

## Worklet rules

If you extend the interaction layer, one rule matters more than the rest:

> **Worklets may only read plain data.**

Passing a scale, or any closure, and calling it from the UI runtime throws:

```
[Worklets] Tried to synchronously call a Remote Function.
```

Precompute pixel positions on the JS thread into plain `number[]` and **index**
into them inside the worklet. It is also faster — the scale runs once per data
change instead of once per series per frame.

## Haptics

`haptics` fires a light impact when the snapped index **changes**, never per
frame. Per-frame haptics produce a continuous buzz users read as a malfunction.

`expo-haptics` is an optional peer dependency, resolved defensively. Without it,
haptics degrade to silence.

## Android: elevation and opacity

If you build your own animated overlay with a shadow, note that Android
composites an `elevation` shadow as a layer **separate** from the view it
belongs to. Animating a parent's opacity fades the card and its shadow on
different schedules — the card appears, then the shadow catches up, and on
release the shadow leaves first.

Two fixes, both required:

1. Put the shadow on the animated view itself, not a child.
2. Set `needsOffscreenAlphaCompositing` on Android so card and shadow composite
   as one layer before opacity applies.

## Legend

![Legend](./assets/android-legend.png)

```tsx
const [hidden, setHidden] = useState<string[]>([]);
const visible = keys.filter((k) => !hidden.includes(k));

<Chart data={data} xKey="month" yKeys={visible}>…</Chart>
<Legend
  items={keys}
  hidden={hidden}
  onToggle={(k) => setHidden((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
/>
```

Removing a key from `yKeys` recomputes the domain against what remains:

![Toggled](./assets/android-legend-toggled.png)

Hidden series dim rather than disappear, so they can still be found and
re-enabled. Every item presents a 44pt minimum touch target regardless of how
small the swatch renders.

The legend is a React Native view, not Skia — it needs real touch targets and
screen-reader labels.
