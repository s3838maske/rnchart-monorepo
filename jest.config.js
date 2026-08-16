/**
 * One suite for the whole library.
 *
 * React Native's preset is required because src/charts and src/skia import
 * react-native, and parts of RN's runtime are Flow-typed. src/core is pure
 * TypeScript and would run under a plain node environment, but splitting into
 * two projects to save a few hundred milliseconds is not worth the config.
 *
 * Jest is pinned to the 29 line because @react-native/jest-preset still
 * depends on it, including on RN 0.87.
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
  // d3-scale and friends are pure ESM; every native-backed dependency needs its
  // JS mock installed before the module graph loads.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@shopify/react-native-skia|react-native-reanimated|react-native-worklets|react-native-gesture-handler|d3-[a-z0-9-]+|internmap)/)',
  ],
  setupFiles: [
    '@shopify/react-native-skia/jestSetup.js',
    'react-native-gesture-handler/jestSetup.js',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    // Type-only modules compile to nothing and would report 0%.
    '!src/**/types.ts',
  ],
};
