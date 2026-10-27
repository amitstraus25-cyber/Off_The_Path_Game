import { DEFAULT_TOP_LIMIT, topLimit, v2 } from '@otp/core';
import { fail, json, note } from './http.ts';
import type { RecentRuns, WriteBudget } from './limit.ts';
import { submitRunSchema } from './schema.ts';
import type { ContactRow, LeaderboardStore } from './store.ts';
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
  /**
   * OTP_WORK_EMAIL is exactly `required` (src/env.ts): a post must carry a work email and the
   * consent, and the two are written with the score in one transaction. False is today's board --
   * a handle and a score -- with any email fields a post carries ignored and stored nowhere.
   */
  emailRequired: boolean;
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
 * per row is the walk its own log describes (`v2.walkFloor`, below) of real waiting, and one token; what bounds how many rows they
 * make is the per-instance budgets (src/limit.ts) and the Vercel firewall rate limit on /api/*,
 * which is the only cross-instance bound and a precondition for exposing the board (README).
 */
export const POST_WINDOW_MS = 5 * 60_000;

/*
 * THE SHORTEST RUN ANYONE CAN PLAY is now per run, not one number: `v2.walkFloor` reads the order
 * the log met the characters in and charges the straight-line walk from the spawn to each of them
 * and on to the door, at `WALK_SPEED` (core floor.ts, its numbers derived from the shipped map in
 * core's test/v2/floor.test.ts). It replaced the single 10 s `MIN_RUN_MS`, which held only for the
 * walk straight to the door and let a forged three-good log claim any time over ten seconds. With
 * speed worth points, a log that claims to have met all seven and arrived must have walked all
 * seven. Checked against BOTH clocks: every meeting and the arrival against the log's own stamps,
 * and the whole walk against `seen`, so a forger has to actually wait that long between
 * /api/start and /api/score for every row.
 */

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

/**
 * JSON-only, so a cross-origin page cannot reach a route without a preflight it will fail. The
 * MEDIA TYPE is compared exactly, parameters aside: a substring match let `text/plain;x=application/json`
 * through -- a type a browser sends cross-origin with no preflight -- and `application/jsonx` too.
 */
const isJson = (request: Request): boolean =>
  (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase() ===
  'application/json';

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
  /*
   * `emailRequired` rides on the start because the start is the one request every run makes
   * before Results, so the screen knows whether to ask for an address before the player is there.
   * It is advisory: the score route decides, and a game that never read this meets the same
   * refusal (422 `email-missing`) with nothing spent.
   */
  return json({ ...deps.tokens.issue(deps.now()), emailRequired: deps.emailRequired });
}

/**
 * POST /api/score -- the security boundary.
 *
 * Takes `{ handle, log, token }` and no score -- and, when OTP_WORK_EMAIL requires it, a work
 * `email` and `consent: true`, checked before anything is spent. The token must be one this service issued; the log
 * must be dealt from the token's seed; its claimed duration must fit the time the server saw pass
 * since the token was issued; and it is replayed through the real v2 reducer and scored with the
 * game's own `result()`. That recomputed number is the only one ever stored. CLAUDE.md golden rule
 * 6, as a function. Every run that ENDED is a run for the board -- `grandma`, `wolf` or `late` --
 * since the client's floor of 2026-10-25: each scores at least `played` (25) for playing, so every
 * player has a score to post (and, with OTP_WORK_EMAIL on, a work email to leave with it).
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

  /*
   * THE NAME, and this is the authority on it (core board.ts): the game asks the same function
   * for a friendly message, and nothing relies on that. 422 with `reason: 'name'`, before anything
   * is spent, so the player can change the name and post the same run. The name stored is the
   * tidied one this returns, never the raw string. Which rule refused it is not said: the game
   * already told an honest player, and a prober should not be told which list a word is on.
   */
  const name = v2.checkName(parsed.data.handle);
  if (!name.ok) return refuse('name', 'that name cannot go on the board');

  /*
   * THE WORK EMAIL AND THE CONSENT (the client, 2026-10-22), when OTP_WORK_EMAIL requires them --
   * and only then: with the flag off the two fields are not read at all, so nothing a game sends
   * can reach the table or a log line.
   *
   * Refused like the name, with 422 and a `reason` the game words, BEFORE THE TOKEN IS SPENT:
   * a player who typed a personal address fixes it and posts the same run. The address that goes
   * on is the normalised one `checkContact` returns (core contact.ts), never the raw string. The
   * consent version is read from this service's own copy of the content -- the words the game
   * shipped -- never from the request, which could name any version it liked.
   *
   * THE ADDRESS IS NEVER SAID BACK. Not in a refusal (the error strings below are fixed), not in
   * the success body (`row` is a handle and a score), not in a log line (`note` is never handed
   * it, and the store logs a failed write by status and SQLSTATE code only).
   */
  let contact: ContactRow | null = null;
  if (deps.emailRequired) {
    const checked = v2.checkContact(parsed.data.email, parsed.data.consent);
    if (!checked.ok) return refuse(checked.reason, CONTACT_REFUSED[checked.reason]);
    contact = { email: checked.email, consentVersion: deps.content.ui.contact.consentVersion };
  }

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
  /*
   * A WOLF RUN AND A LATE RUN ARE POSTED (the client, 2026-10-25), at `played` and nothing more.
   * From 2026-10-22 to then neither was: a wolf run scored 0 and a 0 on a quiet board read as broken.
   * The floor is what changed that -- every ended run scores 25, so no row on the board is a 0 --
   * and every one of them still ranks below every run that kept the wolf out (core scoring.ts).
   *
   * The bounds below hold for a late run exactly as for an arrival: its last stamp is the deadline,
   * the reducer's own, and it cannot claim more time than its token has existed.
   */

  /*
   * THE CLOCK, bounded from both sides by the one clock the player does not control.
   *
   * `claimed` is the run's own elapsed time at the door; `seen` is how long ago this service
   * issued the token. An honest run starts after its token and is posted after it ends, so
   * claimed <= seen always, and the difference is the time spent off the game clock.
   *
   *   - claimed > seen: the log says more time passed than had. Not a run anyone played.
   *   - seen - claimed > POST_WINDOW_MS: too long off the clock. This is the bound on restamping a
   *     slow run, and it also makes the token short-lived: since claimed is under the run's
   *     deadline -- 3:00, plus 20 s for a Long Evening rewind (core perks.ts) -- no token older
   *     than that plus the window can pass it. 410, because the run was real and its window shut.
   *   - any meeting, or the arrival, stamped sooner than walking there allows, or `seen` under the
   *     whole walk (`v2.walkFloor`): faster than the map. Not a run.
   *
   * THE SPEED BONUS IS READ OFF `claimed` (core `speedBonus`), so these bounds are what the bonus
   * rests on: claimed is at most what the server saw, and at least the walk the log describes.
   * `claimed` is REAL elapsed time even after a rewind; the bonus counts it less what the rewind
   * gave back (core `result().timeMs`), which the replay re-derives from the log's own take, so
   * the twenty seconds are never the client's word. The floor reads the log's perks the same way:
   * a faster walk, a wing ride and an early welcome lower it only for a log that took them.
   * What they cannot do is tell an honest 1:45 from a forger who waits 1:45 with a careful log for
   * the seed the token handed them -- `deal()` is public. That was true of the 100 before speed
   * counted, and it is the reason the edge rate limit is a precondition (README).
   */
  const claimed = replay.state.now;
  const seen = deps.now() - ticket.issuedAt;
  if (claimed > seen + CLOCK_SKEW_MS) {
    note('refused a log that claims more time than its token has existed');
    return fail(400, 'that run could not be verified');
  }
  if (seen - claimed > POST_WINDOW_MS) return fail(410, 'posting has closed for that run');
  const floor = v2.walkFloor(deps.content, log.events);
  if (floor.tooFast !== null || seen < floor.floorMs) {
    note('refused a run faster than the shortest walk it describes');
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

  const row = { handle: name.name, score: run.total };
  try {
    /*
     * With an address, ONE call that writes both rows or neither (migration 0007's function, one
     * transaction): if the address cannot be stored, neither is the score, and the player is told
     * the board is unavailable rather than shown a row whose required email does not exist.
     */
    await (contact ? deps.store.addWithContact(row, contact) : deps.store.add(row));
  } catch (err) {
    // Not a row, so not spent: a player whose insert hit a blip can post again.
    deps.recent.release(ticket.id);
    note(`could not store a score: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }

  /*
   * WHERE IT LANDED, AND THE BOARD AS IT STANDS NOW -- read from the table, not the edge.
   *
   * This is the fix for the client's "I posted and I don't see my score". `GET /api/top` is cached
   * at the edge, so the read the game made straight after posting was answered with the page from
   * before the post (handleTop). The post itself is never cached, so it carries the fresh answer:
   * the row's rank, counted right after the insert, and the top of the board read right after it.
   * Both are best-effort. The row is in the table whatever happens here, so a failed count is
   * `rank: null` and a failed read is no `entries` -- never a failed post.
   */
  const [rank, entries] = await Promise.all([
    deps.store.rank(row.score).catch((err: unknown) => {
      note(
        `could not rank a stored score: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return null;
    }),
    deps.store
      .top(DEFAULT_TOP_LIMIT)
      .then((rows) => rows.map((r, i) => ({ rank: i + 1, handle: r.handle, score: r.score })))
      .catch((err: unknown) => {
        note(
          `could not read the board after a post: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
        return undefined;
      }),
  ]);

  return json({ ...row, rank, ...(entries ? { entries } : {}) });
}

/** Why a post was refused with 422: the name, a wolf run, or the work email and its consent. */
export type RefusalReason = 'name' | v2.ContactRefusal;

/** A refusal the game words by `reason` rather than by status: 422, nothing spent. */
const refuse = (reason: RefusalReason, error: string): Response => json({ error, reason }, 422);

/**
 * The caller-facing sentence for each contact refusal. FIXED STRINGS: none of them is built from
 * the request, so the address a player typed cannot come back in one.
 */
const CONTACT_REFUSED: Record<v2.ContactRefusal, string> = {
  'email-missing': 'a work email is needed to post a score',
  'email-invalid': 'that email address is not valid',
  'email-personal': 'a work email is needed, not a personal one',
  'consent-missing': 'consent is needed to post a score',
};

/**
 * How long the edge may serve a board: fresh for 10 s, then served stale for up to 20 s more while
 * it refetches. So the board anyone sees is at most 30 s old.
 *
 * IT WAS `s-maxage=60, stale-while-revalidate=300`, and that is half of the client's "I posted and
 * I don't see my score" (2026-10-22). Results reads the board when it opens and again the moment
 * the post answers, and both reads went to the same edge copy: the first one had just filled it
 * (or found it fresh), so the second -- a few seconds later -- was served the page from BEFORE the
 * post, and under stale-while-revalidate a page up to six minutes old. The browser's
 * `cache: 'no-store'` does not reach past the CDN. The other half is fixed in `handleScore`, which
 * now answers with the fresh board itself; this shortens how long anyone else waits to see it.
 * At 30 s the database still sees at most a few reads a minute per edge region.
 */
export const TOP_CACHE = 'public, max-age=0, s-maxage=10, stale-while-revalidate=20';

/**
 * GET /api/top -- the read-mostly list.
 *
 * Cached at the edge so a marketing page does not reach Postgres once per visitor (`TOP_CACHE`).
 * A post is never cached and answers with its own rank and the fresh board, so the player who just
 * posted never depends on this copy (`handleScore`).
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
      { 'cache-control': TOP_CACHE },
    );
  } catch (err) {
    note(`could not read the board: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, UNAVAILABLE);
  }
}
