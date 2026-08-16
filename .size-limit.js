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
    // Phase 1 actual: 127 B. Rises in phase 2 when d3-scale is added.
    name: '@rnchart/core (full)',
    path: 'packages/core/lib/module/index.js',
    limit: '1 kB',
    gzip: true,
  },
  {
    // Phase 1 actual: 82 B. Rises in phase 5 with the real Skia adapter.
    name: '@rnchart/skia (full)',
    path: 'packages/skia/lib/module/index.js',
    limit: '1 kB',
    gzip: true,
    ignore: RN_PEERS,
  },
  {
    // Phase 1 actual: 551 B. Rises steadily across phases 5-15.
    name: '@rnchart/charts (full)',
    path: 'packages/charts/lib/module/index.js',
    limit: '2 kB',
    gzip: true,
    ignore: RN_PEERS,
  },
];
