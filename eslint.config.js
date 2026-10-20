import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // The dist-* entry sits beside dist because an out-of-tree review build reddened `pnpm lint` for
  // a whole round. Someone ran Vite with `--outDir dist-review` to look at the built page; the dist
  // glob does not match dist-review, so `eslint .` walked into a minified bundle and reported 4,287
  // errors in one file. Eleven owners read that red and each had to prove it was not theirs.
  //
  // The added glob is directory-scoped -- it requires a path separator after the wildcard segment --
  // so it matches only a DIRECTORY whose name starts with "dist-", never a source file that happens
  // to start with those letters. Confirmed before adding: no tracked path in this repo starts with
  // "dist-". These are line comments on purpose. A block comment cannot hold these globs at all,
  // because every one of them contains the two characters that end a block comment, and writing one
  // inline here silently truncated this config twice while it was being written.
  { ignores: ['**/dist/**', '**/dist-*/**', '**/coverage/**', 'reference/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    /*
     * packages/core must stay pure: no DOM, no network, no clock, no randomness (CLAUDE.md rule 2).
     *
     * The list below is the whole of this enforcement, so it has to name every global that would
     * break the rule rather than the four obvious ones. Added after measuring: `performance.now()`,
     * `navigator.userAgent` and `crypto.randomUUID()` all linted clean in this directory, and each
     * is a clock, a DOM fact or a randomness source wearing a different name. `sessionStorage` and
     * `XMLHttpRequest` come along as the siblings of `localStorage` and `fetch`. Core's source
     * contains none of them, so this closes a hole rather than fixing a violation.
     *
     * A `languageOptions.globals` block setting every browser global to 'off' stood here and has
     * been deleted. It could only report through `no-undef`, which typescript-eslint's recommended
     * config turns off for TypeScript files, so it was guard-shaped and inert -- worse than no
     * guard, because it read as proof of purity. Verified before deleting, by linting the three
     * expressions above with the block still in place: exit 0, no diagnostic. `no-restricted-globals`
     * does not depend on it; it reports a reference to a restricted name whether or not that name
     * is a declared global here.
     *
     * The second, independent enforcement of the same rule is packages/core/tsconfig.json's
     * `types: []` with no DOM lib.
     */
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'fetch',
        'localStorage',
        'sessionStorage',
        'XMLHttpRequest',
        { name: 'performance', message: 'Inject the clock.' },
        { name: 'crypto', message: 'Inject a seed.' },
        { name: 'navigator', message: 'Core may not know what it is running on.' },
      ],
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
    /*
     * CLAUDE.md's "no eval, no innerHTML with data" written as rules rather than as a sentence.
     *
     * Only `innerHTML` was restricted here, under a comment that claimed the whole sink. The three
     * names added below reach the same HTML parser: `outerHTML` and `insertAdjacentHTML` are
     * assignments and calls that parse markup, and Preact honours `dangerouslySetInnerHTML`, which
     * is the shortest route to it in a Preact codebase and is an attribute rather than a property,
     * so it needs `no-restricted-syntax` to be seen at all.
     *
     * No file in the tree uses any of the four today (the only matches repo-wide are inside
     * packages/core/coverage/, which is vendored report HTML and is both gitignored and ignored
     * above), so lint stays at exit 0 and this closes a hole rather than fixing a violation.
     *
     * The runtime half of the same claim is apps/game/e2e/smoke.spec.ts's page.on('request')
     * handler, and the shipped-artefact half is apps/game/test/csp.test.ts.
     */
    files: ['apps/game/src/**/*.ts', 'apps/game/src/**/*.tsx'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'No innerHTML with data.' },
        { property: 'outerHTML', message: 'No outerHTML with data; it is the same HTML parser.' },
        {
          property: 'insertAdjacentHTML',
          message: 'No insertAdjacentHTML with data; it is the same HTML parser.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'No dangerouslySetInnerHTML: Preact honours it, and it is innerHTML by another name.',
        },
      ],
    },
  },
);
