/**
 * @rnchart/skia imports react-native (Platform) and @shopify/react-native-skia,
 * so it needs React Native's Jest preset and Babel preset — parts of RN's
 * runtime are Flow-typed and the repo's root Babel config cannot parse them.
 *
 * d3-scale and friends are pure ESM and reach here through @rnchart/core.
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
    'node_modules/(?!(?:@react-native|react-native|@shopify/react-native-skia|react-native-reanimated|react-native-worklets|d3-[a-z0-9-]+|internmap)/)',
  ],
  // Skia ships a Jest setup that installs a JS mock of the native module.
  setupFiles: ['@shopify/react-native-skia/jestSetup.js'],
  moduleNameMapper: {
    '^@rnchart/core$': '<rootDir>/../core/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
  ],
};
