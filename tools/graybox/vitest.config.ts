import { defineConfig } from 'vitest/config';

/*
 * No coverage thresholds here, deliberately. `packages/core` holds the rules and is gated at 100%
 * branch; this workspace holds painters, and a coverage number over a file whose job is to draw
 * would measure how many lines ran, not whether the picture is right. What is gated here is the
 * art's own measurements -- see `test/art-guards.test.ts`.
 */
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
