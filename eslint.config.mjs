import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const D3_BUNDLE_RESTRICTION = {
  name: 'd3',
  message:
    'Import the individual d3 modules (d3-scale, d3-shape, d3-array) — the full bundle pulls in the DOM and blows the bundle budget.',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/lib/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/.yarn/**',
      '**/android/**',
      '**/ios/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Never import the full d3 bundle — only the individual modules.
  //
  // NOTE: `no-restricted-imports` is REPLACED, not merged, by a later matching
  // config block. The core-purity block below therefore repeats this d3 entry.
  // Removing it there would silently un-restrict d3 inside core.
  {
    files: ['packages/**/*.ts', 'packages/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [D3_BUNDLE_RESTRICTION] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // ---------------------------------------------------------------------
  // The architectural rule the whole roadmap rests on.
  //
  // @rnchart/core is pure TypeScript. If it ever imports React Native, every
  // future renderer adapter (Skia today, web in v3.0.0) stops being an
  // adapter and starts being a rewrite. This is the v0.1.0 exit criterion,
  // enforced rather than merely documented.
  //
  // Must come AFTER the block above so it wins for files under packages/core.
  // ---------------------------------------------------------------------
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [D3_BUNDLE_RESTRICTION],
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-native',
                'react-native/*',
                'react-native-*',
                '@shopify/react-native-skia',
                '@shopify/react-native-skia/*',
              ],
              message:
                '@rnchart/core must stay renderer-agnostic and runnable in plain Node. Put platform code in @rnchart/skia or @rnchart/charts instead.',
            },
          ],
        },
      ],
    },
  },

  // Test files may be looser.
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Plain JS config files are not part of any tsconfig project.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  prettier
);
