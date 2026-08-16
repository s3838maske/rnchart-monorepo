---
'@rnchart/charts': minor
'@rnchart/core': minor
'@rnchart/skia': minor
---

Phase 1 — monorepo scaffold.

Establishes the three publishable packages, dual CJS/ESM + declaration builds
via builder-bob, strict TypeScript, Jest, ESLint, a GitHub Actions matrix and an
Expo dev-client example app.

`@rnchart/core` ships `clamp` and `createRect` only. No chart logic yet — the
scale engine lands in phase 2. The architectural boundary is the deliverable:
core has no React Native dependency, and a lint rule now fails the build if that
ever changes.
