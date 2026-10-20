import { checkLog, score, submitRequestSchema, topLimit } from '@otp/core';
import type { Content } from '@otp/core';
import { fail, json, note } from './http.ts';
import { fingerprint } from './limit.ts';
import type { RecentRuns, WriteBudget } from './limit.ts';
import type { LeaderboardStore } from './store.ts';

/*
 * The two routes, as pure functions of a Request and their dependencies. The files in api/ do
 * nothing but read the environment once and call these, so every path below is reachable from a
 * test with a fake fetch and no database anywhere (see test/).
 */

export interface Deps {
  content: Content;
  /** Null when the environment is not configured; every route then answers 503 and stores nothing. */
  store: LeaderboardStore | null;
  /** Per instance, shared by every request it serves. See src/limit.ts for what it is not. */
  budget: WriteBudget;
  /** Per instance, the runs it has already written. */
  recent: RecentRuns;
}

/**
 * A submission is a handle and a log. 32 KB is about forty times the largest honest body, and the
 * cap binds the READ rather than a buffer that has already been filled: `readCapped` stops pulling
 * at the limit, so a hostile caller cannot buy a bigger budget by omitting `content-length` or by
 * sending characters that take four bytes each.
 */
const MAX_BODY_BYTES = 32 * 1024;

const UNAVAILABLE = 'the leaderboard is unavailable';

/**
 * Reads at most `max` bytes of a request body, or null if there are more than that.
 *
 * `content-length` is advisory: it is absent on a chunked body, and it counts bytes a caller has
 * promised rather than bytes a caller sends. It is still worth checking first -- it refuses a
 * declared megabyte without reading a byte of it -- but the gate is the byte count below, taken
 * as the body arrives, which is why nothing here ever holds more than 32 KB of someone else's JSON.
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
 * POST /api/score -- the security boundary.
 *
 * The body carries NO score. The log is replayed through the real reducer (`checkLog`) and the
 * score is recomputed with the game's own `score()`, and that recomputed number is the only one
 * that is ever stored. CLAUDE.md golden rule 6, as a function.
 */
export async function handleScore(request: Request, deps: Deps): Promise<Response> {
  // The Allow header is stated rather than implied. A JSON-only POST route that answers 405 to
  // OPTIONS is also the CORS answer -- a cross-origin preflight fails -- and that too is deliberate.
  if (request.method !== 'POST') return fail(405, 'method not allowed', { allow: 'POST' });

  // A JSON-only endpoint cannot be reached by a plain cross-origin form post, which is worth
  // having even for an API that sets no cookies and reads no credentials.
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json'))
    return fail(415, 'expected application/json');

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

  const parsed = submitRequestSchema.safeParse(body);
  // The issues are deliberately not returned. A caller who is guessing at the shape of an
  // acceptable log should not be handed the schema one field at a time.
  if (!parsed.success) return fail(400, 'that submission is not valid');

  const replay = checkLog(parsed.data.log, deps.content, 0);
  if (!replay.legal) {
    note(`refused a log that does not replay: ${replay.reason}`);
    return fail(400, 'that run could not be verified');
  }
  if (!replay.complete) return fail(400, 'that run has not reached the cottage');

  /*
   * Recomputed here, from the replayed log, with the same function the results screen used. Every
   * `points` field in the content schema is `int().min(0)`, so a legal log cannot produce a
   * negative total and the table's `score >= 0` check cannot be reached from this route; the store
   * refuses one anyway.
   */
  const total = score(replay.state.log, deps.content).total;

  if (!deps.store) return fail(503, UNAVAILABLE);

  /*
   * A legal log is not a licence to write it repeatedly. One run is one row: the same log posted
   * again -- under this handle or twenty-five others -- is the same run, and 409 says so. Per
   * instance only; src/limit.ts is honest about the bound and the README asks for the unique
   * column that would make it durable.
   */
  const print = fingerprint(parsed.data.log);
  if (deps.recent.has(print)) {
    note('refused a run this instance has already written');
    return fail(409, 'that run is already on the board');
  }

  // Spent here and nowhere earlier, so only a row that is about to exist costs anything: a caller
  // sending nonsense cannot exhaust the budget and take the board down for everyone else.
  if (!deps.budget.take()) {
    note('shed a write: this instance has spent its write budget');
    return fail(429, UNAVAILABLE, { 'retry-after': '60' });
  }

  try {
    await deps.store.add({ handle: parsed.data.handle, score: total });
  } catch (err) {
    note(`could not store a score: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }

  // Remembered only now that it is a row, so a player whose insert hit a blip can post again.
  deps.recent.remember(print);
  return json({ handle: parsed.data.handle, score: total });
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
