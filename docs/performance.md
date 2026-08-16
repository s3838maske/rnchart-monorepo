# Performance

## Measured today

Node on an Apple Silicon laptop, via `yarn bench`.

| Operation | Mean | p99 | Target |
| --- | --- | --- | --- |
| LTTB 1k → 800 | 0.0095 ms | 0.021 ms | — |
| LTTB 10k → 800 | 0.038 ms | 0.071 ms | — |
| LTTB 100k → 800 | **0.32 ms** | 0.41 ms | < 15 ms |
| LTTB 1M → 800 | 2.70 ms | 3.03 ms | — |
| minMaxDecimate 100k → 400 buckets | 0.16 ms | 0.23 ms | — |
| clipToViewport 1M | **0.0001 ms** | 0.0001 ms | — |
| Hit-test x, 100k | **0.0002 ms** | 0.0003 ms | < 0.1 ms |
| Hit-test nearest, 50k | 0.0061 ms | 0.020 ms | — |
| Quadtree build, 50k | 6.4 ms | 8.0 ms | once per data change |

`clipToViewport` staying constant from 1k to 1M is the point: it returns a
`subarray` **view**, never a copy. During a pan it runs every frame, so an
allocating implementation would churn megabytes at 60Hz.

## What is NOT measured

**Device numbers do not exist yet.** Everything above is Node on a laptop.

The roadmap's targets — 10k-point line pan at 60fps, 0% JS thread during a
tooltip drag, 200 bars under 16ms — must be measured on a real mid-range
Android device in a **release** build. Debug React Native is misleadingly slow.

Publishing laptop numbers as device numbers is how benchmark tables lose their
credibility, so this page does not.

## How to measure honestly

- **Release builds only.**
- **Report the 1% low frame time**, not the average. Averages hide the stutters
  users notice.
- **Watch the JS thread separately from the UI thread.** The entire interaction
  architecture exists to keep the JS thread idle during a gesture. If it is not
  idle, something regressed.
- **Name the device**, its OS version and the React Native version alongside
  every number.

## Bundle budgets

Enforced in CI via `yarn size`. Tree-shaken, minified, gzipped, with React
Native peers excluded — consumers already ship those.

| Package | Size | Budget |
| --- | --- | --- |
| `@rnchart/core` | 23.0 kB | 24 kB |
| `@rnchart/skia` | 0.7 kB | 2 kB |
| `@rnchart/charts` | 42.3 kB | 45 kB |

Core's size is dominated by transitive d3 (`d3-interpolate`, `d3-color`,
`d3-format`, `d3-time-format`), not by the scale maths. Making time scales an
opt-in plugin would let charts that never plot a time axis stop paying for
`d3-time-format`.

Budgets **ratchet deliberately**. When a change legitimately grows a package,
raise the limit in the same commit and say why. A failing size check is the tool
working.

## Decimation

```ts
import { autoDecimate } from '@rnchart/core';

const visible = autoDecimate(points, plotWidthPx, { strategy: 'lttb' });
```

| Strategy | Use for |
| --- | --- |
| `lttb` | Default. Preserves visual shape. |
| `minmax` | OHLC and spiky sensor data — preserves per-bucket extremes. |
| `none` | Opt out. |

Use `minmax` for candlesticks. LTTB optimises for shape and will smooth a
single-sample spike away; in an OHLC chart the extremes **are** the data.

Below roughly two points per pixel nothing is decimated — every point already
maps to its own pixel column.
