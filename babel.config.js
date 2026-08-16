/**
 * Root Babel config — used by Jest (via `babel-jest` with `rootMode: 'upward'`)
 * for the three publishable packages.
 *
 * This is NOT the config used to build the packages: `react-native-builder-bob`
 * ships its own preset and runs with `babelrc: false, configFile: false`.
 * It is also NOT the config used by the example app, which has its own
 * `babel.config.js` using `babel-preset-expo`.
 *
 * Pinned to Babel 7 deliberately: builder-bob 0.43 depends on `@babel/core ^7`,
 * and React Native's toolchain is still Babel 7. Mixing in Babel 8 here would
 * load two incompatible Babel instances.
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
