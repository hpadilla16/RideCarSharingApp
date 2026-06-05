// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    rules: {
      // We log via lib/logger; allow its console usage and warn elsewhere.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Apostrophes in UI copy are fine; we don't render user HTML.
      'react/no-unescaped-entities': 'off',
      // Existing load-on-mount patterns; revisit when adopting React Query
      // or similar. Keep visible as warnings, not CI failures.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Jest globals for test files
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
]);
