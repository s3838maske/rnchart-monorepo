---
'@rnchart/charts': minor
'@rnchart/core': minor
'@rnchart/skia': minor
---

Phase 4 — decimation and hit-testing. LTTB, min/max decimation, non-copying
viewport clipping, an auto-decimation policy, and binary-search plus
quadtree hit-testers. Benchmark harness under `yarn bench`.

Phase 12 — the interaction layer. Pan and long-press gestures drive cursor
shared values entirely on the UI thread; crosshair and per-series dots draw
from `useDerivedValue`; the tooltip trails with a spring and flips at the
plot edge. Haptics fire once per snapped-index change, never per frame, via
an optional `expo-haptics` peer.
