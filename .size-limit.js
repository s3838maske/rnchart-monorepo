/**
 * Bundle size budgets, enforced in CI.
 *
 * The risk register is explicit that these belong from phase 1 rather than
 * after the first complaint — a budget added late just ratifies whatever bloat
 * already accumulated.
 *
 * HOW TO READ THESE NUMBERS
 * Each entry is the package's ESM output, bundled and tree-shaken by esbuild,
 * minified and gzipped, with peer dependencies excluded. Peers are excluded
 * because consumers already ship React Native, Skia and Reanimated; counting
 * them would measure their app, not our library. Real (non-peer) dependencies
 * ARE counted — so when d3-scale lands in phase 2, core's number jumps and it
 * SHOULD, because consumers genuinely pay for it.
 *
 * HOW TO CHANGE THEM
 * Budgets ratchet deliberately, never automatically. When a phase legitimately
 * grows a package, raise the limit IN THE SAME COMMIT as the code and say why
 * in the changeset. A failing size check is the tool working; silently bumping
 * it to green is the failure mode this file exists to prevent.
 *
 * v1.0.0 CEILINGS (the roadmap's published targets, phase 15)
 *   Line + Bar only ......  45 kB gzipped
 *   full charts package ... 140 kB gzipped
 * Those entries cannot exist yet — there is no Line or Bar until phases 7 and
 * 9. Add a per-import entry then; measuring "Line + Bar only" is the whole
 * point of the phase 28 plugin architecture and its tree-shaking claim.
 */

const RN_PEERS = [
  'react',
  'react-native',
  '@shopify/react-native-skia',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
];

module.exports = [
  {
    // Phase 1: 127 B. Phase 2: 15.82 kB — the scale engine's d3 dependencies.
    //
    // That jump is almost entirely transitive. Importing scaleLinear/scaleLog/
    // scaleTime pulls d3-interpolate, d3-color, d3-format and d3-time-format
    // along with them, and the two formatters are the bulk of it. The scale
    // maths itself is small.
    //
    // Worth revisiting at phase 28: if time scales become an opt-in plugin
    // rather than part of the core barrel, a chart that never plots a time
    // axis stops paying for d3-time-format. Roughly 11% of the roadmap's
    // 140 kB full-package budget is already committed here at phase 2, so this
    // is worth watching rather than assuming there is room.
    //
    // Phase 4 added decimation, hit-testing and d3-quadtree: 21.41 kB.
    name: '@rnchart/core (full)',
    path: 'packages/core/lib/module/index.js',
    limit: '24 kB',
    gzip: true,
  },
  {
    // Phase 1: 82 B. Phase 5: 670 B — measureText cache and the font hook.
    name: '@rnchart/skia (full)',
    path: 'packages/skia/lib/module/index.js',
    limit: '2 kB',
    gzip: true,
    ignore: RN_PEERS,
  },
  {
    // Phase 1: 551 B. Phases 5-11: 23.74 kB — Chart shell, axes, grid and the
    // five series. The jump is this package finally containing a renderer
    // rather than a placeholder. Phase 12 added the cursor, crosshair and
    // tooltip: 40.51 kB. That is 29% of the 140 kB v1.0.0 ceiling with the
    // legend, theme system and eight more chart families still to come — the
    // plugin architecture in phase 28 is looking less optional than it reads.
    name: '@rnchart/charts (full)',
    path: 'packages/charts/lib/module/index.js',
    limit: '45 kB',
    gzip: true,
    ignore: RN_PEERS,
  },
];
