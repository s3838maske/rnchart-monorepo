/**
 * Bundle size budget, enforced in CI.
 *
 * Measures the ESM output, tree-shaken by esbuild, minified and gzipped, with
 * React Native peers excluded — consumers already ship those, so counting them
 * would measure their app rather than this library. Real dependencies (d3) ARE
 * counted, because consumers genuinely pay for them.
 *
 * The budget ratchets deliberately. When a change legitimately grows the
 * package, raise the limit IN THE SAME COMMIT as the code and say why. A
 * failing size check is the tool working; bumping it silently to green is the
 * failure mode this file exists to prevent.
 */
module.exports = [
  {
    name: 'react-native-graphify (full)',
    path: 'lib/module/index.js',
    limit: '70 kB',
    gzip: true,
    ignore: [
      'react',
      'react-native',
      '@shopify/react-native-skia',
      'react-native-reanimated',
      'react-native-worklets',
      'react-native-gesture-handler',
      'expo-haptics',
    ],
  },
];
