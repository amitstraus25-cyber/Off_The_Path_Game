import { defineConfig } from 'vitest/config';

/*
 * The security boundary gets the same treatment as the pure rules: a coverage gate on all four
 * metrics, not a suite that happens to be green. `packages/core` is at 100% because a rule with no
 * test is a rule nobody checked; this service recomputes scores and holds the only key in the
 * system, so a line of it nothing executes is worse, not better.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Both the handlers and the two files Vercel actually invokes. Leaving `api/` out is how a
      // route entry point sits at 0% while the summary looks respectable.
      include: ['src/**/*.ts', 'api/**/*.ts'],
      // The fakes and the run builders are test scaffolding; they are exercised by definition and
      // counting them would only pad the number the gate below is supposed to mean something about.
      exclude: ['test/**'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
