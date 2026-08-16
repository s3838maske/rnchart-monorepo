module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { rootMode: 'upward' }],
  },
  // d3-scale and friends are pure ESM and reach here through @rnchart/core.
  transformIgnorePatterns: ['node_modules/(?!(?:d3-[a-z0-9-]+|internmap)/)'],
  // Test against workspace source, not built output, so `yarn test` does not
  // require a prior `yarn build`.
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
