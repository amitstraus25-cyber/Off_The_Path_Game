import { v2 } from '@otp/core';
import { z } from 'zod';
import type { StoreConfig } from './env.ts';
import {
  CLOCK_SKEW_MS,
  MAX_BODY_BYTES,
  POST_WINDOW_MS,
  crossSite,
  isJson,
  readCapped,
} from './handlers.ts';
import { fail, json, note } from './http.ts';
import type { RecentRuns, WriteBudget } from './limit.ts';
import { runTokenSchema } from './schema.ts';
import { believeInsert } from './store.ts';
import type { FetchLike } from './store.ts';
import type { RunTokens } from './token.ts';

/*
 * POST /api/play -- THE PLAY STATS (the client, 2026-11-04: how many played, for how long, with how
 * many interactions). Anonymous, and the table they land in is `public.play_stats` (migration 0009).
 *
 * Three notes per run, each sent quietly by the game and each allowed once per run token:
 *
 *   - `start`: the player pressed Start walking. Nothing but the device and whether it was embedded.
 *   - `end`:   the run reached the cottage or ran out of time.
 *   - `quit`:  the player left the page, or walked it again, before either.
 *
 * `end` and `quit` carry the run LOG and the TOKEN, exactly as a post does, and the summary is the
 * server's own replay of that log (core `playSummary`): the browser reports no count and no time
 * that is believed. A run gets one summary, whichever of the two arrives first.
 *
 * WHAT IS NOT KEPT: no name, no address, no cookie, no run id, no token. The row is a stage, a
 * device, an embedded flag and the replay's counts. A start row and an end row of the same run are
 * not linked, on purpose, and each row is stamped to the HOUR and its run time to five seconds, so
 * neither can be matched to the other or to a leaderboard post by its time (docs/DATABASE.md).
 */

const PATH = '/rest/v1/play_stats';
const TIMEOUT_MS = 4000;

/**
 * How long after its token a run's note is taken. Longer than a post's window, because a quit can
 * come from a tab left open in the background: the run's deadline is 3:20 at most, and this is
 * half an hour. A token older than that is not a run anyone is still playing.
 */
export const PLAY_WINDOW_MS = 30 * 60_000;

/** Run times are stored to this step, so a row cannot be matched to a board post by its time. */
export const DURATION_STEP_MS = 5000;

const where = {
  device: z.enum(['phone', 'desktop']),
  embedded: z.boolean(),
  token: runTokenSchema,
};

/** The one body the route takes. Strict: an unknown key -- a count, a time -- is a 400. */
export const playSchema = z.discriminatedUnion('stage', [
  z.strictObject({ stage: z.literal('start'), ...where }),
  z.strictObject({ stage: z.literal('end'), log: v2.runLogSchema, ...where }),
  z.strictObject({ stage: z.literal('quit'), log: v2.runLogSchema, ...where }),
]);
export type PlayNote = z.infer<typeof playSchema>;

/** One row of `public.play_stats`, named as its columns are. */
export interface PlayRow {
  stage: PlayNote['stage'];
  device: PlayNote['device'];
  embedded: boolean;
  ending: v2.PlayEnding | null;
  duration_ms: number | null;
  met: number | null;
  opened: number | null;
  left_count: number | null;
  taken_good: string[] | null;
  taken_bad: string[] | null;
  score: number | null;
}

export interface PlayStore {
  add(row: PlayRow): Promise<void>;
}

export function createPlayStore(config: StoreConfig, fetchImpl: FetchLike): PlayStore {
  return {
    async add(row) {
      const res = await fetchImpl(`${config.url}${PATH}`, {
        method: 'POST',
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify([row]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await believeInsert(res);
    },
  };
}

export interface PlayDeps {
  content: v2.Content;
  /** Null when the environment is not configured: the route answers 503 and stores nothing. */
  plays: PlayStore | null;
  tokens: RunTokens | null;
  /** Its own bucket, so a flood of notes can never take a post's place. */
  budget: WriteBudget;
  /** The notes this instance has written, keyed by token id and stage. */
  recent: RecentRuns;
  now: () => number;
}

const UNAVAILABLE = 'the play stats are unavailable';
const UNVERIFIED = 'that run could not be verified';

const startRow = (n: PlayNote): PlayRow => ({
  stage: n.stage,
  device: n.device,
  embedded: n.embedded,
  ending: null,
  duration_ms: null,
  met: null,
  opened: null,
  left_count: null,
  taken_good: null,
  taken_bad: null,
  score: null,
});

/** The row for a note, or the reason it is refused. Every count is the replay's, never the body's. */
function rowFor(n: PlayNote, seed: number, seen: number, content: v2.Content): PlayRow | string {
  if (n.stage === 'start') return startRow(n);
  if (n.log.seed !== seed) return "a log whose seed is not its token's";
  const replay = v2.checkRunLog(n.log, content);
  if (!replay.legal) return `a log that does not replay: ${replay.reason}`;
  if (replay.ended !== (n.stage === 'end'))
    return `a ${n.stage} note for a run that says otherwise`;
  const claimed = replay.state.now;
  if (claimed > seen + CLOCK_SKEW_MS) return 'a log that claims more time than its token';
  /*
   * THE WALK, as the score route checks it: no leg faster than the map, and for a finished run no
   * end sooner than the whole walk, nor long after it. Without this a scripted log could claim a
   * three-second 100 and pull the averages wherever it liked (the security review, 2026-11-04).
   */
  const floor = v2.walkFloor(content, n.log.events);
  if (floor.tooFast !== null) return 'a log faster than the map';
  if (n.stage === 'end' && (seen < floor.floorMs || seen - claimed > POST_WINDOW_MS))
    return 'an end the clock does not bear out';
  const s = v2.playSummary(replay.state, content);
  return {
    ...startRow(n),
    ending: s.ending,
    // To five seconds: enough for an average, too coarse to match a row to a leaderboard post.
    duration_ms: Math.round(s.durationMs / DURATION_STEP_MS) * DURATION_STEP_MS,
    met: s.met,
    opened: s.opened,
    left_count: s.left,
    taken_good: s.takenGood,
    taken_bad: s.takenBad,
    score: s.score,
  };
}

export async function handlePlay(request: Request, deps: PlayDeps): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'method not allowed', { allow: 'POST' });
  if (crossSite(request)) return fail(403, 'same-origin only');
  if (!isJson(request)) return fail(415, 'expected application/json');

  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return fail(413, 'that note is too large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'that note could not be read');
  }
  const parsed = playSchema.safeParse(body);
  if (!parsed.success) return fail(400, 'that note is not valid');

  if (!deps.plays || !deps.tokens) return fail(503, UNAVAILABLE);
  const ticket = deps.tokens.open(parsed.data.token);
  if (!ticket) {
    note('play: refused a token this service did not sign');
    return fail(400, UNVERIFIED);
  }
  const seen = deps.now() - ticket.issuedAt;
  if (seen > PLAY_WINDOW_MS) return fail(410, 'that run is too old to count');

  const row = rowFor(parsed.data, ticket.seed, seen, deps.content);
  if (typeof row === 'string') {
    note(`play: refused ${row}`);
    return fail(400, UNVERIFIED);
  }

  // One start and one summary per run: `end` and `quit` share a key, so a run is summed up once.
  const key = `${ticket.id}:${row.stage === 'start' ? 'start' : 'run'}`;
  if (!deps.recent.claim(key)) return fail(409, 'that run is already counted');
  if (!deps.budget.take()) {
    deps.recent.release(key);
    note('play: shed a note: this instance has spent its budget');
    return fail(429, UNAVAILABLE, { 'retry-after': '60' });
  }
  try {
    await deps.plays.add(row);
  } catch (err) {
    deps.recent.release(key);
    note(`play: could not store a note: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }
  return json({ counted: true }, 201);
}
