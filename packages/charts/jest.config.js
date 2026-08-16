/**
 * @rnchart/charts imports react-native, so it needs React Native's Jest preset
 * (module mocks, the RN environment) plus React Native's Babel preset — parts
 * of RN's own runtime are still Flow-typed and the repo's root Babel config
 * cannot parse them.
 *
 * Jest is pinned to the 29 line repo-wide because @react-native/jest-preset
 * still depends on it, including on RN 0.87.
 */
module.exports = {
  preset: '@react-native/jest-preset',
  // Reanimated 4 splits its runtime into react-native-worklets, which ships
  // this resolver to point Jest at the JS-only build.
  resolver: 'react-native-worklets/jest/resolver.js',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: ['@react-native/babel-preset'],
        babelrc: false,
        configFile: false,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@shopify/react-native-skia|react-native-reanimated|react-native-worklets|react-native-gesture-handler|d3-[a-z0-9-]+|internmap)/)',
  ],
  // Every native-backed dependency needs its JS mock installed before the
  // module graph loads. Importing a component that touches a TurboModule
  // throws at import time otherwise, which surfaces as "suite failed to run"
  // rather than as a normal assertion failure.
  setupFiles: [
    '@shopify/react-native-skia/jestSetup.js',
    'react-native-gesture-handler/jestSetup.js',
  ],
  moduleNameMapper: {
    // Test against workspace source, not built output, so `yarn test` does not
    // require a prior `yarn build`.
    '^@rnchart/core$': '<rootDir>/../core/src/index.ts',
    '^@rnchart/skia$': '<rootDir>/../skia/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
  ],
};
