import { handleSchema, v2 } from '@otp/core';
import { z } from 'zod';

/*
 * The one body `POST /api/score` accepts, v2. Kept free of `node:` imports on purpose, so the
 * game's own unit test can hold the adapter's real request body against this exact schema
 * (apps/game/test/leaderboard.test.ts) without pulling the server into a browser workspace.
 *
 * Strict, like v1's: an unknown key -- `score` above all -- is a 400. The log is core's versioned
 * v2 run log, so a v1 log (a bare array) cannot be scored as a v2 run.
 */

/** Two base64url segments joined by a dot, and short: an honest token is about 130 characters. */
export const runTokenSchema = z
  .string()
  .max(256)
  .regex(/^[\w-]+\.[\w-]+$/);

export const submitRunSchema = z.strictObject({
  handle: handleSchema,
  log: v2.runLogSchema,
  token: runTokenSchema,
});
export type SubmitRun = z.infer<typeof submitRunSchema>;
