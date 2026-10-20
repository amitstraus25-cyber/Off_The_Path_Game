import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/*
 * CLAUDE.md's "no eval, no innerHTML with data" written as rules rather than as a sentence.
 *
 * `outerHTML` and `insertAdjacentHTML` reach the same HTML parser as `innerHTML`; Preact honours
 * `dangerouslySetInnerHTML`, which is the shortest route to it in a Preact codebase and is an
 * attribute rather than a property, so it needs `no-restricted-syntax` to be seen at all.
 */
const HTML_SINK_PROPERTIES = [
  { property: 'innerHTML', message: 'No innerHTML with data.' },
  { property: 'outerHTML', message: 'No outerHTML with data; it is the same HTML parser.' },
  {
    property: 'insertAdjacentHTML',
    message: 'No insertAdjacentHTML with data; it is the same HTML parser.',
  },
];

const HTML_SINK_SYNTAX = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'No dangerouslySetInnerHTML: Preact honours it, and it is innerHTML by another name.',
  },
];

/*
 * packages/core must stay pure: no DOM, no network, no clock, no randomness (CLAUDE.md rule 2).
 *
 * The list has to name every global that would break the rule rather than the four obvious ones.
 * Added after measuring: `performance.now()`, `navigator.userAgent` and `crypto.randomUUID()` all
 * linted clean in this directory, and each is a clock, a DOM fact or a randomness source wearing a
 * different name. `sessionStorage` and `XMLHttpRequest` come along as the siblings of
 * `localStorage` and `fetch`. Core's source contains none of them, so this closes a hole rather
 * than fixing a violation.
 *
 * A `languageOptions.globals` block setting every browser global to 'off' stood here and has been
 * deleted. It could only report through `no-undef`, which typescript-eslint's recommended config
 * turns off for TypeScript files, so it was guard-shaped and inert -- worse than no guard, because
 * it read as proof of purity. Verified before deleting, by linting the three expressions above
 * with the block still in place: exit 0, no diagnostic. `no-restricted-globals` does not depend on
 * it; it reports a reference to a restricted name whether or not that name is a declared global.
 *
 * The second, independent enforcement of the same rule is packages/core/tsconfig.json's
 * `types: []` with no DOM lib.
 */
const CORE_PURITY_GLOBALS = [
  'window',
  'document',
  'fetch',
  'localStorage',
  'sessionStorage',
  'XMLHttpRequest',
  { name: 'performance', message: 'Inject the clock.' },
  { name: 'crypto', message: 'Inject a seed.' },
  { name: 'navigator', message: 'Core may not know what it is running on.' },
];

const CORE_PURITY_PROPERTIES = [
  { object: 'Date', property: 'now', message: 'Inject the clock.' },
  { object: 'Math', property: 'random', message: 'Inject a seed.' },
];

const CORE_PURITY_SYNTAX = [
  {
    selector: "NewExpression[callee.name='Date']:not([arguments.length>0])",
    message: 'Inject the clock.',
  },
];

/*
 * EVERY DIRECTORY THAT SHIPS, not just the one the rules were written in.
 *
 * This list named `apps/game/src` alone. The other two were never exempt -- they were never
 * considered. apps/api is a Node service that renders nothing, which is the argument for leaving
 * the HTML sinks out of it and exactly the argument that ends with a template literal in an error
 * page; and `eval` in a request handler is worse than `eval` in a game, not better. packages/core
 * is the one place in the repo whose purity is already load-bearing. None of the three contains a
 * single match today -- verified with `eslint .` at exit 0 both before and after this widened --
 * so this closes a hole rather than fixing a violation.
 *
 * `apps/api/api` is listed beside `apps/api/src` because that is where the deployed functions
 * live: the two entry points a request actually reaches are not under src at all.
 *
 * AND THEN THE DEPLOYED FUNCTIONS MOVED, AND THIS LIST DID NOT. On 2026-10-21 the routes became
 * `apps/game/api/score.ts` and `top.ts`, because a second Vercel service produced no functions at
 * all. `apps/api/api` still exists and still matches this glob -- but nothing serves it, so for
 * most of a day every rule below was armed on a DEAD COPY and unset on the live one.
 * `eslint --print-config apps/game/api/top.ts` reported `no-eval`, `no-implied-eval`,
 * `no-restricted-properties` and `no-restricted-syntax` all undefined: the two files a request
 * actually reaches were the only shipped code in the repository with no shipped-code rules.
 *
 * Both locations are listed now. The dead copy keeps its rules because a glob that is wrong in the
 * harmless direction costs nothing, and because if that service is ever revived it must arrive
 * already covered rather than needing someone to remember this paragraph.
 *
 * THE REAL LESSON IS THAT THIS LIST IS A SECOND OPINION ABOUT WHAT SHIPS. `vercel.json` is the
 * first, and when the two disagree this one loses silently -- no error, no warning, just rules
 * quietly not applying. If the routes move again, they must move here in the same commit.
 */
const SHIPPED_SOURCE = [
  'apps/game/src/**/*.ts',
  'apps/game/src/**/*.tsx',
  'apps/game/api/**/*.ts',
  'apps/api/src/**/*.ts',
  'apps/api/api/**/*.ts',
  'packages/core/src/**/*.ts',
];

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
     * The runtime half of the same claim is apps/game/e2e/smoke.spec.ts's page.on('request')
     * handler; the shipped-artefact half is apps/game/test/csp.test.ts, and the one that loads the
     * built page under the real policy is apps/game/e2e/shipped-headers.spec.ts.
     */
    files: SHIPPED_SOURCE,
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-properties': ['error', ...HTML_SINK_PROPERTIES],
      'no-restricted-syntax': ['error', ...HTML_SINK_SYNTAX],
    },
  },
  {
    /*
     * THIS BLOCK MUST STAY AFTER THE ONE ABOVE, AND MUST RESTATE WHAT IT RESTATES.
     *
     * Flat config does not merge two entries that set the same rule: the last one that matches a
     * file wins outright. Both blocks now match packages/core/src, and both want to configure
     * `no-restricted-properties` and `no-restricted-syntax` -- so whichever is written second
     * silently replaces the other's list. Widening the sinks to core without this would have
     * switched core's purity rules OFF while appearing to add protection, which is the worst shape
     * a guard can take and the one this config has already shipped once.
     *
     * Hence the spreads. apps/game/test/lint-rules.test.ts lints a probe of every forbidden
     * construct against this config and fails if any of them stops being reported, in any of the
     * three directories, which is a thing a reader cannot verify by eye.
     */
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...CORE_PURITY_GLOBALS],
      'no-restricted-properties': ['error', ...CORE_PURITY_PROPERTIES, ...HTML_SINK_PROPERTIES],
      'no-restricted-syntax': ['error', ...CORE_PURITY_SYNTAX, ...HTML_SINK_SYNTAX],
    },
  },
);
