import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'reference/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // packages/core must stay pure: no DOM, no network, no clock, no randomness.
    files: ['packages/core/src/**/*.ts'],
    languageOptions: {
      globals: { ...Object.fromEntries(Object.keys(globals.browser).map((k) => [k, 'off'])) },
    },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'fetch', 'localStorage'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Inject the clock.' },
        { object: 'Math', property: 'random', message: 'Inject a seed.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']:not([arguments.length>0])",
          message: 'Inject the clock.',
        },
      ],
    },
  },
  {
    files: ['apps/game/src/**/*.ts', 'apps/game/src/**/*.tsx'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'No innerHTML with data.' },
      ],
    },
  },
);
