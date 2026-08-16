---
'@rnchart/charts': minor
'@rnchart/core': minor
'@rnchart/skia': minor
---

Phase 2 — scale and domain engine in `@rnchart/core`.

Adds `createScale`, `computeDomain`, `applyStacking` and `normaliseMissing`.
All pure functions returning plain objects, so they cross the worklet boundary
intact in phase 12.

- `createScale` wraps d3-scale for linear, log, time, band, point and sqrt
  behind one interface. Log domains touching zero are clamped to the smallest
  positive value present rather than emitting -Infinity, and `supports()`
  reports which inputs were unrepresentable. Time scales convert Date to epoch
  milliseconds at the boundary so the interface stays numeric.
- `computeDomain` applies padding AFTER nice(), so requested headroom cannot be
  rounded away. Handles empty, single-point and all-equal series.
- `applyStacking` stacks negatives downward and positives upward without
  cancelling, and percent mode normalises absolute magnitudes so mixed-sign
  columns sum to 100.
- `normaliseMissing` returns values plus a `Uint8Array` validity mask, so a
  genuine zero stays distinguishable from a hole under the `zero` policy.

Core's bundle grows from 127 B to 15.82 kB gzipped. That is the transitive d3
cost — d3-interpolate, d3-color, d3-format and d3-time-format — not the scale
maths. The budget was raised deliberately and the trade-off noted for phase 28.
