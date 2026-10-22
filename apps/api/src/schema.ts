import { v2 } from '@otp/core';
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

/**
 * The name as typed, bounded and nothing more. Whether it may go on the board is `v2.checkName`'s
 * question, asked by the handler AFTER the shape is known good, so a refused name can be answered
 * with its own status (422) and the player can fix it and post the same run again.
 */
export const submitRunSchema = z.strictObject({
  handle: z.string().max(64),
  log: v2.runLogSchema,
  token: runTokenSchema,
});
export type SubmitRun = z.infer<typeof submitRunSchema>;
