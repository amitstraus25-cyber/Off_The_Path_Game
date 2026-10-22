import { topLimit, v2 } from '@otp/core';
import { fail, json, note } from './http.ts';
import type { RecentRuns, WriteBudget } from './limit.ts';
import { submitRunSchema } from './schema.ts';
import type { LeaderboardStore } from './store.ts';
import type { RunTokens } from './token.ts';

/*
 * The three routes, as pure functions of a Request and their dependencies. The files in api/ do
 * nothing but read the environment once and call these, so every path below is reachable from a
 * test with a fake fetch and no database anywhere (see test/).
 */

export interface Deps {
  /** content/game.v2.json, through the same schema, lint and trap the game loads it with. */
  content: v2.Content;
  /** Null when the environment is not configured; every route then answers 503 and stores nothing. */
  store: LeaderboardStore | null;
  /** Null exactly when the store is: the signing key is derived from the store's key. */
  tokens: RunTokens | null;
  /** Writes, per instance, shared by every request it serves. See src/limit.ts for what it is not. */
  budget: WriteBudget;
  /** Run starts, per instance -- a bucket of its own, so a flood of starts cannot block a post. */
  starts: WriteBudget;
  /** Per instance, the run tokens that have already become rows. */
  recent: RecentRuns;
  /** The server's clock, epoch milliseconds. Injected so the time bounds are testable. */
  now: () => number;
}

/**
 * HOW MUCH WALL TIME AN HONEST RUN SPENDS OFF THE GAME CLOCK, at most: the title and how-to before
 * the clock starts, and the reveal after the cottage door, before the player presses Post.
 *
 * NOT "A SMALL SLACK", and on purpose. The reveal is the product (GAME_DESIGN_V2 section 6), and a
 * window of seconds would refuse exactly the player who read it. What a tighter window would buy is
 * small: it bounds how far a late run could be restamped into an in-time one, and a forger has no
 * reason to do that -- the token hands them the seed and `deal()` is public, so a careful log for
 * that seed scores 100 without anyone playing.
 *
 * THAT IS NOT "A FORGER GAINS NOTHING". Ties rank earliest first (README, migration 0005), so a
 * scripted 100 posted today outranks every honest 100 posted after it, for good. What a forger pays
 * per row is `MIN_RUN_MS` of real waiting, below, and one token; what bounds how many rows they
 * make is the per-instance budgets (src/limit.ts) and the Vercel firewall rate limit on /api/*,
 * which is the only cross-instance bound and a precondition for exposing the board (README).
 */
export const POST_WINDOW_MS = 5 * 60_000;

/**
 * THE SHORTEST RUN ANYONE CAN PLAY: no finished run is faster than walking from Purple's spawn
 * straight to the cottage door. Checked against BOTH clocks. `claimed` alone is the log's word and
 * costs nothing to write; `seen` is the server's, so a forger has to actually wait this long between
 * /api/start and /api/score for every row.
 *
 * Derived from the shipped map in test/floor.test.ts, not from memory: the straight-line gap
 * between the spawn and the door, less a tile at each end for Purple's body, at `WALK_SPEED`, is
 * just over 11 s; this sits a little under that so no honest run, however direct, is refused. It is
 * one floor for every score -- a 100 must also meet the three holding good skills, which takes longer,
 * but that bound needs the map's distances on the server, and is recorded as not done (PLAN.md).
 */
export const MIN_RUN_MS = 10_000;

/** Server clocks across instances and rounding between the browser's clock and ours. */
export const CLOCK_SKEW_MS = 2_000;

/**
 * Same origin only. A browser stamps `sec-fetch-site` on every request and a page cannot forge it,
 * so a cross-site page's request is refused by name; a request without the header is not a browser
 * and no origin check could stop it anyway -- the edge rate limit is what bounds those. The game in
 * an iframe on cyera.com is still same-origin here: its document is served from this origin.
 */
const crossSite = (request: Request): boolean => {
  const site = request.headers.get('sec-fetch-site');
  return site !== null && site !== 'same-origin';
};

/** JSON-only, so a cross-origin page cannot reach a route without a preflight it will fail. */
const isJson = (request: Request): boolean =>
  (request.headers.get('content-type') ?? '').toLowerCase().includes('application/json');

/**
 * A submission is a handle, a log and a token. 32 KB is about forty times the largest honest body, and the
 * cap binds the READ rather than a buffer that has already been filled: `readCapped` stops pulling
 * at the limit, so a hostile caller cannot buy a bigger budget by omitting `content-length` or by
 * sending characters that take four bytes each.
 */
export const MAX_BODY_BYTES = 32 * 1024;

const UNAVAILABLE = 'the leaderboard is unavailable';

/**
 * Reads at most `max` bytes of a request body, or null if there are more than that.
 *
 * `content-length` is advisory: it is absent on a chunked body, and it counts bytes a caller has
 * promised rather than bytes a caller sends. It is still worth checking first -- it refuses a
 * declared megabyte without reading a byte of it -- but the gate is the byte count below, taken
 * as the body arrives, which is why nothing here ever holds more than 32 KB of someone else's JSON.
 * (src/node-adapter.ts applies the same cap before a request reaches this file at all.)
 */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const stream = request.body;
  if (stream === null) {
    // No stream to meter (a runtime that buffers for us, or a test's Request). Count the bytes.
    const raw = await request.text();
    return new TextEncoder().encode(raw).length > max ? null : raw;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.length;
    if (bytes > max) {
      // Over the cap: stop pulling and drop whatever else was on the way.
      void reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }

  const joined = new Uint8Array(bytes);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(joined);
}

/**
 * POST /api/start -- issues a run: a seed the server drew, sealed with the moment it drew it.
 *
 * Reads no body, stores nothing, sets no cookie and records no address. The token is the whole
 * state, and it lives in the browser for the length of one run.
 */
export function handleStart(request: Request, deps: Deps): Response {
  if (request.method !== 'POST') return fail(405, 'method not allowed', { allow: 'POST' });
  if (crossSite(request)) return fail(403, 'same-origin only');
  if (!isJson(request)) return fail(415, 'expected application/json');
  if (!deps.tokens) return fail(503, UNAVAILABLE);
  if (!deps.starts.take()) {
    note('shed a start: this instance has spent its start budget');
    return fail(429, UNAVAILABLE, { 'retry-after': '60' });
  }
  return json(deps.tokens.issue(deps.now()));
}

/**
 * POST /api/score -- the security boundary.
 *
 * Takes `{ handle, log, token }` and no score. The token must be one this service issued; the log
 * must be dealt from the token's seed; its claimed duration must fit the time the server saw pass
 * since the token was issued; and it is replayed through the real v2 reducer and scored with the
 * game's own `result()`. That recomputed number is the only one ever stored. CLAUDE.md golden rule
 * 6, as a function. Only a run that FINISHED is a run for the board: `grandma` or `wolf`, never
 * `late`.
 */
export async function handleScore(request: Request, deps: Deps): Promise<Response> {
  // The Allow header is stated rather than implied. A JSON-only POST route that answers 405 to
  // OPTIONS is also the CORS answer -- a cross-origin preflight fails -- and that too is deliberate.
  if (request.method !== 'POST') return fail(405, 'method not allowed', { allow: 'POST' });
  if (crossSite(request)) return fail(403, 'same-origin only');
  if (!isJson(request)) return fail(415, 'expected application/json');

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
    return fail(413, 'that submission is too large');

  const raw = await readCapped(request, MAX_BODY_BYTES);
  if (raw === null) return fail(413, 'that submission is too large');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'that submission could not be read');
  }

  const parsed = submitRunSchema.safeParse(body);
  // The issues are deliberately not returned. A caller who is guessing at the shape of an
  // acceptable log should not be handed the schema one field at a time.
  if (!parsed.success) return fail(400, 'that submission is not valid');

  if (!deps.store || !deps.tokens) return fail(503, UNAVAILABLE);

  const ticket = deps.tokens.open(parsed.data.token);
  if (!ticket) {
    note('refused a token this service did not sign');
    return fail(400, 'that run could not be verified');
  }

  // The seed is the server's, not the log's: a log dealt from any other number is not this run.
  const { log } = parsed.data;
  if (log.seed !== ticket.seed) {
    note("refused a log whose seed is not its token's");
    return fail(400, 'that run could not be verified');
  }

  const replay = v2.checkRunLog(log, deps.content);
  if (!replay.legal) {
    note(`refused a log that does not replay: ${replay.reason}`);
    return fail(400, 'that run could not be verified');
  }
  if (!replay.ended) return fail(400, 'that run has not reached the cottage');

  const run = v2.result(replay.state, deps.content);
  // A late run ended, but it did not finish: the board reads the ending (core scoring.ts).
  if (run.ending === 'late') return fail(400, 'a late run is not posted');

  /*
   * THE CLOCK, bounded from both sides by the one clock the player does not control.
   *
   * `claimed` is the run's own elapsed time at the door; `seen` is how long ago this service
   * issued the token. An honest run starts after its token and is posted after it ends, so
   * claimed <= seen always, and the difference is the time spent off the game clock.
   *
   *   - claimed > seen: the log says more time passed than had. Not a run anyone played.
   *   - seen - claimed > POST_WINDOW_MS: too long off the clock. This is the bound on restamping a
   *     slow run, and it also makes the token short-lived: since claimed < 3:00, no token older
   *     than 3:00 plus the window can pass it. 410, because the run was real and its window shut.
   *   - claimed or seen under MIN_RUN_MS: faster than the shortest walk on the map. Not a run.
   */
  const claimed = replay.state.now;
  const seen = deps.now() - ticket.issuedAt;
  if (claimed > seen + CLOCK_SKEW_MS) {
    note('refused a log that claims more time than its token has existed');
    return fail(400, 'that run could not be verified');
  }
  if (seen - claimed > POST_WINDOW_MS) return fail(410, 'posting has closed for that run');
  if (claimed < MIN_RUN_MS || seen < MIN_RUN_MS) {
    note('refused a run faster than the shortest walk to the cottage');
    return fail(400, 'that run could not be verified');
  }

  /*
   * One token is one row: the same token posted again -- with this log, another log, or under
   * twenty-five other handles -- is the same run, and 409 says so. Per instance only; src/limit.ts
   * is honest about the bound and the README says what would make it durable.
   *
   * RESERVED HERE, BEFORE THE AWAIT, and released if no row results. The insert below yields to
   * other requests, so a check made now and a record made after it let two concurrent posts of one
   * token both through. `claim` is check and reservation in one synchronous step.
   */
  if (!deps.recent.claim(ticket.id)) {
    note('refused a run this instance has already written');
    return fail(409, 'that run is already on the board');
  }

  // Spent here and nowhere earlier, so only a row that is about to exist costs anything: a caller
  // sending nonsense cannot exhaust the budget and take the board down for everyone else.
  if (!deps.budget.take()) {
    deps.recent.release(ticket.id);
    note('shed a write: this instance has spent its write budget');
    return fail(429, UNAVAILABLE, { 'retry-after': '60' });
  }

  try {
    await deps.store.add({ handle: parsed.data.handle, score: run.total });
  } catch (err) {
    // Not a row, so not spent: a player whose insert hit a blip can post again.
    deps.recent.release(ticket.id);
    note(`could not store a score: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }

  return json({ handle: parsed.data.handle, score: run.total });
}

/**
 * GET /api/top -- the read-mostly list.
 *
 * Cached at the edge so a marketing page does not reach Postgres once per visitor. A score posted
 * in the last minute may not be on the cached copy yet; the trade is deliberate and is the reason
 * `POST /api/score` returns the score it stored rather than making the client re-read the board.
 */
export async function handleTop(request: Request, deps: Deps): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'method not allowed', { allow: 'GET' });
  if (!deps.store) return fail(503, UNAVAILABLE);

  const limit = topLimit(new URL(request.url).searchParams.get('limit'));
  try {
    const rows = await deps.store.top(limit);
    return json(
      { entries: rows.map((row, i) => ({ rank: i + 1, handle: row.handle, score: row.score })) },
      200,
      { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    );
  } catch (err) {
    note(`could not read the board: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }
}
