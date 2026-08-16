/**
 * @rnchart/core runs in the plain Node environment — no jsdom, no React Native
 * preset. If a test in this package ever needs one, something has leaked across
 * the architectural boundary.
 *
 * d3-scale and friends are pure ESM ("type": "module"), so they must be
 * transformed for Jest's CJS runtime. That is what the transformIgnorePatterns
 * override below is for: the default ignores all of node_modules.
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { rootMode: 'upward' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:d3-[a-z0-9-]+|internmap|delaunator|robust-predicates)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    // Type-only modules compile to nothing, so they report 0% and drag the
    // real numbers down without representing any untested logic.
    '!src/**/types.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
