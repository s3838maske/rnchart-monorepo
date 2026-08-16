# The global context block

Paste this once at the start of every AI session, before any phase prompt.

This is the roadmap's original block **corrected for the August 2026 dependency
reality**. The roadmap was written against Reanimated 3 and React Native 0.76;
both have moved, and the worklet API now lives in a separate package. Pasting
the roadmap's original wording will produce code that does not compile.

See [Deviations from the roadmap](#deviations-from-the-roadmap) below for why
each line changed.

---

```
You are helping me build `@rnchart` — a high-performance, cross-platform charting library for React
Native.

LOCKED TECHNICAL DECISIONS (do not suggest alternatives):
- Rendering: @shopify/react-native-skia 2.x (NOT react-native-svg, NOT WebView, NOT native
  Kotlin/Swift views)
- Animation: react-native-reanimated v4+
- Worklets: react-native-worklets v0.10+. In Reanimated 4 the worklet runtime is a SEPARATE
  package. Import `runOnJS`, `runOnUI` and `createWorkletRuntime` from 'react-native-worklets',
  NOT from 'react-native-reanimated'. The Babel plugin is 'react-native-worklets/plugin'.
- Gestures: react-native-gesture-handler v2.32+
- Math: d3-scale, d3-shape, d3-array ONLY (never the full d3 bundle)
- Language: TypeScript 5.9, strict mode, no `any`. NOT TypeScript 7 — typescript-eslint, ts-jest
  and typedoc do not support it yet.
- Monorepo: yarn 4 workspaces + react-native-builder-bob
- Testing: Jest 29 (React Native's jest-preset is still pinned to the 29 line)
- Target: React Native 0.86 (Expo SDK 57), New Architecture (Fabric) only. Never write bridge-era
  code.

REPO STRUCTURE:
packages/core   -> pure TypeScript. ZERO react/react-native imports. Runs in plain Node.
packages/skia   -> Skia renderer adapter. Bridges core geometry to Skia draw calls.
packages/charts -> public API. Preset components consumers import.
example/        -> Expo dev-client app used for visual verification.

HARD PERFORMANCE RULES (violating these fails review):
- No setState / useState updates during gestures or animation frames. SharedValue only.
- Point data flows as Float32Array in [x0,y0,x1,y1,...] layout, never as arrays of objects.
- Skia Paint, Font and Path objects are memoised, never recreated per render.
- Path construction happens inside useDerivedValue worklets, not on the JS thread.
- Any function called from a worklet must be marked 'worklet' and must not close over JS-thread
  state.

OUTPUT RULES:
- Show complete, runnable files with their full path as a header comment. No "..." elisions.
- Include the Jest test file alongside any core logic you write.
- If a decision is ambiguous, state the assumption you made in one line and continue. Do not stop
  to ask.
```

---

## Deviations from the roadmap

Each of these was verified against npm on 2026-08-16, not assumed.

| Roadmap says | Reality | Why it matters |
| --- | --- | --- |
| Reanimated **v3+** | **4.5.1** (Expo SDK 57 pin); 4.5.3 latest | Reanimated 4 extracted worklets into `react-native-worklets`. Code written for v3 imports `runOnJS` from the wrong package and uses a Babel plugin that no longer exists there. |
| React Native **0.76+** | **0.86.2** | Reanimated 4.5.3's peer range is `0.83 - 0.86`, so RN 0.87 is not yet usable. The published peer floor is `>=0.78`, which is what Skia 2.x requires. |
| Gesture Handler **v2+** | **2.32.0** | GH 3.2.1 exists but Expo SDK 57 pins the 2.x line. Peer range is `>=2.16.0` so consumers on either can install. |
| TypeScript strict | **5.9.3**, not 7.0.2 | TypeScript 7 is out, but typescript-eslint requires `<6.1.0`, ts-jest requires `<7`, and typedoc caps at `6.0.x`. Adopting TS 7 would break lint, test and docs generation at once. |
| Skia (unversioned) | **2.6.2** | Skia 2.x requires React >=19, RN >=0.78, Reanimated >=4 — this is what forces the Reanimated 4 migration. |
| Jest (unstated) | **29.7.0** | `@react-native/jest-preset` still depends on the Jest 29 line, on RN 0.87 as well as 0.86. Jest 30 produces a `clearMocksOnScope` runtime error. |
| Babel (unstated) | **7.29.x**, not 8 | Babel 8 is released, but `react-native-builder-bob` 0.43 depends on `@babel/core ^7`, as does React Native. |
| `react-native-screenshot-test` for phase 15 | v0.0.9, last touched April 2026 | Effectively unmaintained. A different tool must be chosen when phase 15 arrives. Not decided yet. |

## Structural deviations

**Project references were dropped; path aliases were kept.** The roadmap asks for
both. They conflict: `paths` pointing at `packages/*/src` means a dependent
package pulls its dependency's source files into its own TypeScript project,
which `composite: true` rejects. The working arrangement is:

- `tsconfig.json` (root) carries the `paths` aliases and is what `yarn typecheck`
  and the editor use — development resolves to source.
- `packages/*/tsconfig.build.json` carries **no** aliases, so `bob` resolves
  cross-package imports through the workspace symlink to built declarations —
  publishing resolves to output.

**Metro resolves `@rnchart/*` to source via an explicit `resolveRequest`.** The
packages publish an `exports` map, and Metro honours `exports` ahead of the
`react-native` field, so the usual `"react-native": "./src/index.ts"` trick sends
development builds to a `lib/` directory that does not exist before a build. See
`example/metro.config.js`.

**The core-purity rule is enforced, not documented.** `eslint.config.mjs` fails
the build if anything under `packages/core` imports react, react-native, a
`react-native-*` package, or Skia. This is the v0.1.0 exit criterion, and it is
the single assumption every later version rests on.
