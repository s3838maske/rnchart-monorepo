# Screenshot regression testing

**Status: not implemented. A tool has not been chosen.**

## Why this page exists

The roadmap specifies `react-native-screenshot-test` for phase 15. That package
is at **v0.0.9** and was last published in April 2026. Adopting an
effectively-unmaintained package as the *only* sane way to test a rendering
library would be a poor trade, so the decision is deferred rather than made
badly.

## What is actually needed

A rendering library's correctness is visual. Unit tests cover the maths in
`react-native-graphify` well — 231 of them — but they cannot catch:

- A path built with the wrong winding order
- A gradient that renders differently on iOS and Android
- An axis label clipped by one pixel
- A regression in the layout solver that only shows at 320px width

## Candidates

| Option | For | Against |
| --- | --- | --- |
| **Maestro** + screenshot assertions | Maintained, drives real devices, already a common RN choice | Slower; flows are separate from the test suite |
| **Detox** + `jest-image-snapshot` | Mature, real devices, integrates with Jest | Heavy setup; Detox has its own maintenance history |
| **Expo/EAS build + manual capture** | No new dependency | Manual, so it will not run in CI, so it will not happen |
| **Skia `makeImageSnapshot`** in-process | Fast, no device, tests the canvas directly | Does not test platform text or native composition — the parts most likely to differ |

## Leaning

A hybrid looks right, and cheap:

1. **Skia `makeImageSnapshot`** for geometry — runs in-process and catches the
   large class of "the path is wrong" regressions without a device.
2. **Maestro** on one iOS and one Android device in CI for the small set of
   screens where platform text and composition actually matter.

Approach 1 alone would miss exactly the cross-platform differences that
motivate a screenshot suite; approach 2 alone is too slow to run per commit.

## Until then

The gap is real and stated in the README. Every visual change in this repo has
been verified by hand on the Android emulator and the iOS simulator, with
captures committed under `docs/assets/`. That is not a substitute for automation
— it does not run in CI and it does not fail a build.
