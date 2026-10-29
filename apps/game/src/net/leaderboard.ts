import { DEFAULT_TOP_LIMIT, mintHandle, topLimit, v2 } from '@otp/core';

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
  /**
   * Set on exactly one row at most: the run THIS PAGE posted since its run started, and only when
   * it is that row and not merely one carrying the same name (see `withYourRow`).
   *
   *   - `confirmed`: a read of the table holds it at the rank the server counted -- or the server
   *                  counted it BELOW the visible page, in which case it is the last entry, after
   *                  a gap in the ranks, at that counted rank (`withYourRow` case 0).
   *   - `pending`:   no read has shown it yet -- the edge copy predates the post -- so it is placed
   *                  where the server said it landed, honestly marked as not yet confirmed.
   *
   * Absent on every other row, and on every row before this page has posted anything.
   */
  yours?: 'confirmed' | 'pending';
}

/**
 * What a read of the board came back with. THREE answers, not an array, because an array cannot
 * say which of two quite different things happened and this product has to.
 *
 * `empty` is a board that answered, parsed, and holds no runs. On a just-launched research page it
 * is the COMMON case and it is not an error.
 *
 * `unavailable` is everything else: a network failure, a timeout, a 4xx/5xx, a body in a shape we
 * have never seen, AND -- the case this type exists for -- the 200 of `index.html` that the SPA
 * catch-all serves when the `/api/(.*)` rewrite never reaches apps/api. Measured 2026-10-20 on a
 * plain `vite preview`: GET /api/top?limit=10 -> 200, text/html, 654 bytes. It is not loud, it is
 * not a 404, and before this type the screen could only have called it "no scores yet".
 *
 * A row whose handle is not one this game mints also lands here rather than in `empty`:
 * `topResponseSchema` fails the WHOLE array, so one poisoned row drops the board. That is the
 * right way round -- a board we cannot believe is a board that is not answering -- and it is what
 * `test/leaderboard.test.ts` already pins with `'x'` and `'<img src=x>'`.
 */
export type BoardRead =
  { state: 'rows'; entries: LeaderboardEntry[] } | { state: 'empty' } | { state: 'unavailable' };

/**
 * The content key of every sentence a post can answer with. Five, and no sixth without a line
 * here: `Results.tsx` declares what each one ASSERTS, and a key with no declaration is a line
 * nobody has thought about.
 *
 * `leaderboardClosed` is v2's (Phase E): the server answers 410 when a run's posting window has
 * shut -- the run was real, it was simply posted too long after the token was issued
 * (apps/api/src/handlers.ts, POST_WINDOW_MS). It is not a refusal of the run and not a board that
 * is down, so it is neither of their sentences. Only the v2 `submit` below produces it.
 */
export type NoticeKey =
  | 'handleAssigned'
  | 'leaderboardAlready'
  | 'leaderboardRefused'
  | 'leaderboardDown'
  | 'leaderboardClosed';

/**
 * Why a post was refused when the answer is not "the run could not be verified": the NAME (the
 * board's rules, core board.ts -- `nameRefusal` says which). It travels under
 * `leaderboardRefused`, because it makes exactly the claim that key declares (the run did not go
 * up). The work email's three refusals went with the work email (the client, 2026-10-29).
 */
export type RefusalReason = 'name';

/** Where a posted run landed: what the server stored and the rank it counted, or null. */
export interface PostedRun {
  handle: string;
  score: number;
  rank: number | null;
}

/**
 * What a post answered: the sentence to show, AND which of the four it is.
 *
 * THE KEY IS WHY THIS IS NOT A STRING ANY MORE, and it is worth saying what it bought. The screen
 * used to receive a sentence and nothing else, so the only way it could have known whether the
 * notice denied the player's run was to match that sentence against the content file -- a coupling
 * this module refused, and rightly: it is a bound written against a SPELLING, which is the trap
 * `Results.tsx` already walked into once over the board note.
 *
 * It had a cost. `.otp-board__row--you` says "This is your run." in the same section as the
 * notice, and on 2026-10-21 a 400 was measured in Chromium rendering "That run could not be
 * posted." directly above it. The screen could not decline the row's claim, because it could not
 * tell a refusal from a success without reading the words. It can now, and the words stay free to
 * change.
 */
export interface PostOutcome {
  key: NoticeKey;
  /** The sentence, with `{handle}` already substituted where the line has one. */
  text: string;
  /** Only on `leaderboardRefused`, when the refusal had a reason (above). */
  reason?: RefusalReason;
  /** Only with `reason: 'name'` when the game itself refused it: which rule. */
  nameRefusal?: v2.NameRefusal;
  /** Only on `handleAssigned`: the stored name (tidied), the score and the rank. */
  posted?: PostedRun;
}

/*
 * Phase 6: the real adapter, the same-origin calls to apps/api.
 *
 * Three promises from the stub's docstring are kept here rather than inherited:
 *   - nothing blocks results or the CTA. Both calls are same-origin, time-limited, and every
 *     failure -- network, timeout, 4xx, 5xx, a body in a shape we have never seen -- comes back as
 *     a message to show, never as a thrown error and never as a hang.
 *   - every response is untrusted. The two schemas in packages/core parse what comes back before
 *     anything here reads a field off it, which also means a handle out of the database is a handle
 *     this game could have minted or it is not rendered at all.
 *   - the board is optional. If apps/api is not deployed, these are two 404s and the game is
 *     exactly the game it was in Phase 5.
 *
 * It posts a RUN LOG and no score. There is no number here for the server to trust (CLAUDE.md
 * golden rule 6); the score on the results screen and the score on the board are computed by the
 * same function from the same log, one of them on a machine the player does not control.
 */

const START_PATH = '/api/start';
const SCORE_PATH = '/api/score';
const TOP_PATH = '/api/top';
/** Past this the board is down as far as the player is concerned. */
const TIMEOUT_MS = 6000;
/**
 * Past this a run start is not coming, and the player is waiting on it: Begin is held until the
 * start answers (main.ts, `startTheRun`), so this is time added to the title screen. It is much
 * shorter than `TIMEOUT_MS` because what it costs is different -- a slow score post only delays a
 * notice, a slow start delays the game. On timeout the run deals locally and cannot be posted.
 */
const START_TIMEOUT_MS = 2500;

/** A unit interval from the browser's CSPRNG, for the one injected randomness core allows. */
const unit = (): number => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

/**
 * A SUGGESTED name such as `brave-lantern-42`, from the wordlist in packages/core.
 *
 * Since 2026-10-22 players type their own name (the client: "I want people to put their own
 * name"); this is the fun default the field starts with and the "suggest a name" button draws, and
 * every name it can draw passes the board's own rules (core test/v2/board.test.ts walks all of
 * them). What a player types is checked by `checkName` below and, with authority, by the server.
 */
export const newHandle = (): string => mintHandle(unit);

/**
 * The board's name rules, the same function the server applies (core board.ts): the tidied name
 * to post, or which rule refused it. For a friendly message before posting; the server decides.
 */
export const checkName = (raw: string): v2.NameCheck => v2.checkName(raw);

/** What came back: a status, and the body already read. Never a Response with a body still open. */
interface Reply {
  ok: boolean;
  status: number;
  /** Parsed JSON for a 2xx, null otherwise. Unvalidated -- the schemas below do that. */
  body: unknown;
}

/** `res.json()` types as `any`; this is the one place that widening is spelled out. */
const readJson = async (res: Response): Promise<unknown> => res.json();

/** One request. Returns null for anything that is not a reply: no throw ever leaves here. */
async function ask(
  path: string,
  init: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Reply | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      // Same origin by decision D3, which is why `connect-src 'self'` needs no widening. No
      // cookies are sent because the board has none to send and never will.
      mode: 'same-origin',
      credentials: 'omit',
      cache: 'no-store',
    });
    /*
     * The body is read HERE, inside the timed region, and the placement is the whole point.
     *
     * `fetch()` resolves when the response HEADERS arrive, not when the body does. A stalled
     * proxy, a function that writes a status and then blocks, or a dead-but-open socket all hand
     * back a perfectly good Response whose body never produces a chunk. Reading it after the
     * `finally` below had cleared the timer -- on a signal already spent -- was a promise that
     * never settled and a Post button disabled forever with nothing to show for it. Aborting the
     * signal errors the body stream too, so this read is bounded by the same limit as the
     * request that carried it.
     *
     * An error status is not read at all: this client acts on the status alone, so there is no
     * body to wait for and nothing in it we would believe.
     */
    // A 422 is read too: it is the one refusal whose body says which (`reason`, handlers.ts).
    const body = res.ok || res.status === 422 ? await readJson(res) : null;
    return { ok: res.ok, status: res.status, body };
  } catch {
    // A network error, an abort, or a 200 whose body is not JSON. All of them mean "no reply".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the board. The three answers, never a throw and never a hang.
 *
 * A FREE FUNCTION because it needs nothing from `Content`: it reads no string, so the one screen
 * that shows a board is not handed a whole client to get at it.
 *
 * THE THREE ANSWERS ARE DERIVED HERE, not written down anywhere else. `entries.length === 0` is
 * what makes a board empty; nothing else may decide it. The alternative -- a screen that checks the
 * array's length itself -- is how the absent board came to be renderable as an empty one.
 */
export async function readTop(limit: number): Promise<BoardRead> {
  const wanted = topLimit(limit);
  const reply = await ask(`${TOP_PATH}?limit=${wanted}`, { method: 'GET' });
  return withYourRow(parseBoard(reply, wanted), lastPost, Date.now(), wanted);
}

/** A GET's reply as one of the three answers, before any row of ours is placed on it. */
function parseBoard(reply: Reply | null, wanted: number): BoardRead {
  if (!reply?.ok) return { state: 'unavailable' };
  const parsed = v2.boardResponseSchema.safeParse(reply.body);
  if (!parsed.success) return { state: 'unavailable' };
  return asRead(parsed.data.entries.slice(0, wanted));
}

const asRead = (entries: LeaderboardEntry[]): BoardRead =>
  entries.length === 0 ? { state: 'empty' } : { state: 'rows', entries };

/*
 * ------------------------------------------------------------------------------------------------
 * THE CLIENT'S "I POSTED AND I DON'T SEE MY SCORE" (2026-10-22), and the half of the fix that lives
 * on this side of the wire.
 *
 * Results reads the board when it opens and again the moment a post answers. Both reads are
 * `GET /api/top`, which the edge caches (apps/api handlers.ts `TOP_CACHE`), and the browser's
 * `cache: 'no-store'` does not reach past the CDN -- so the second read was answered with the copy
 * the first had just filled, from before the post. The post said "Posted to the board as
 * swift-apron-51" and the board below it said otherwise. Both were telling the truth about what
 * they had seen; neither was what the player needed.
 *
 * So a post now answers with the board itself, read from the table straight after the insert, and
 * with the rank the server counted. This module keeps that answer for the length of the edge cache
 * and lays it over any read that has not caught up yet. `startRun()` forgets it: a row from the
 * previous run on this page is not "your run" on the next run's Results.
 * ------------------------------------------------------------------------------------------------
 */

/** How long an edge copy of the board can lag a post: `TOP_CACHE`'s fresh plus stale, 10 + 20 s. */
export const BOARD_LAG_MS = 30_000;

/** The last post this page made in this run: what the server stored, and the board it read after. */
export interface LastPost extends PostedRun {
  /** The board read from the table right after the insert; absent when that read failed. */
  entries?: LeaderboardEntry[];
  /** `Date.now()` when the post answered. */
  at: number;
}

let lastPost: LastPost | null = null;

/** Forgets the last post, as a new run does (`startRun`). Exported for the tests. */
export const forgetLastPost = (): void => {
  lastPost = null;
};

const mark = (rows: LeaderboardEntry[], rank: number, yours: 'confirmed'): LeaderboardEntry[] =>
  rows.map((r) => (r.rank === rank ? { ...r, yours } : r));

/** Our row in a list: first at or below the counted rank carrying our name and score exactly. */
const findOurs = (rows: LeaderboardEntry[], post: PostedRun): LeaderboardEntry | undefined =>
  post.rank === null
    ? undefined
    : rows.find((r) => r.rank >= post.rank! && r.handle === post.handle && r.score === post.score);

/**
 * PLACES THE PLAYER'S OWN ROW ON A BOARD READ, honestly. Pure, and exported for the tests.
 *
 * WHICH ROW IS OURS, AND WHY IT CAN BE TOLD. The server counted the rank right after writing the
 * row. A row can only move DOWN after that -- a later better run goes above it, a later equal one
 * goes below it, ties ranking earliest first -- so ours is the first row at or below the counted
 * rank that carries our name and score. Any other row with the same name and score is either
 * above that rank, so older, or below it, so newer: somebody else's either way. This is what closes
 * the collision PAUL_BRIEF section 7 left open ("a row carrying the name this page posted" was all
 * the screen could match before), and with free names a collision is no longer one in three
 * hundred: two Amits is an ordinary afternoon.
 *
 *   1. The read holds it                    -> marked `confirmed`, at wherever it now stands.
 *   2. Older than the edge can lag          -> the read is the truth: returned unmarked if our row
 *                                              is not on this page (or its rank was never counted).
 *   3. Inside the lag, the post read a board -> that board, which is newer than any read missing
 *                                              our row, with our row `confirmed` on it.
 *   4. Inside the lag, no board came back   -> the read, with our row placed `pending` at the
 *                                              counted rank (or after every score at or above ours
 *                                              when the count failed), and the rows under it
 *                                              moved down one. Never placed past `limit`, and
 *                                              never beside a row that may already be it (no
 *                                              counted rank, same name and score on the page).
 *
 *   0. Counted BELOW the page               -> the page (the post's own board inside the lag, else
 *                                              the read), then our row appended LAST at the counted
 *                                              rank, `confirmed`. The rank jump is the gap Results
 *                                              draws. This is the client's complaint over again
 *                                              for most players: ties rank the earliest first and
 *                                              100 needs par, so the top ten fills with 94 to 100
 *                                              soon after launch and a typical 80 lands at rank 13
 *                                              or 400 -- "Posted to the board" over a board with no
 *                                              row of theirs on it. Not bounded by the lag: no read
 *                                              of the top ten can ever confirm or refute a row
 *                                              below it, and the counted rank is the server's own
 *                                              statement of where the run landed when it landed.
 *
 * An unavailable read stays unavailable unless case 3 applies: a board we could not read is not a
 * board to draw one optimistic row on (nor, in case 0, one row with a gap above it).
 */
export function withYourRow(
  read: BoardRead,
  post: LastPost | null,
  now: number,
  limit: number = DEFAULT_TOP_LIMIT,
): BoardRead {
  if (!post) return read;
  const rows = read.state === 'rows' ? read.entries : [];
  const ours = findOurs(rows, post);
  if (ours) return { state: 'rows', entries: mark(rows, ours.rank, 'confirmed') };
  const inLag = now - post.at < BOARD_LAG_MS;

  if (post.rank !== null && post.rank > limit) {
    const page = inLag && post.entries ? post.entries : read.state === 'unavailable' ? null : rows;
    if (page === null) return read;
    const mine: LeaderboardEntry = {
      rank: post.rank,
      handle: post.handle,
      score: post.score,
      yours: 'confirmed',
    };
    return { state: 'rows', entries: [...page.slice(0, limit), mine] };
  }

  if (!inLag) return read;

  if (post.entries) {
    const fresh = post.entries.slice(0, limit);
    // With no counted rank, ours is the newest of its score in a board read just after it.
    const at =
      post.rank ??
      [...fresh].reverse().find((r) => r.handle === post.handle && r.score === post.score)?.rank ??
      null;
    const found = at === null ? undefined : fresh.find((r) => r.rank === at);
    return asRead(
      found && found.handle === post.handle && found.score === post.score
        ? mark(fresh, at!, 'confirmed')
        : fresh,
    );
  }

  if (read.state === 'unavailable') return read;
  // With no counted rank, a row already carrying our name and score may well be ours: placing a
  // second would show two. Under-claim instead -- the read is left as it is.
  if (post.rank === null && rows.some((r) => r.handle === post.handle && r.score === post.score))
    return read;
  const at = post.rank ?? rows.filter((r) => r.score >= post.score).length + 1;
  if (at > limit) return read;
  const mine: LeaderboardEntry = {
    rank: at,
    handle: post.handle,
    score: post.score,
    yours: 'pending',
  };
  const before = rows.filter((r) => r.rank < at);
  const after = rows.filter((r) => r.rank >= at).map((r) => ({ ...r, rank: r.rank + 1 }));
  return { state: 'rows', entries: [...before, mine, ...after].slice(0, limit) };
}

/*
 * ------------------------------------------------------------------------------------------------
 * v2 (Phase E): a run STARTS on the server, so the server's seed and the server's clock bound it.
 *
 * `startRun()` asks `POST /api/start` for a seed and a token sealing it with the moment it was
 * drawn. The game deals from that seed and keeps the token for the length of the run, then posts
 * `{ handle, log, token }`. The server refuses a log dealt from any other seed, or claiming more
 * time than it saw, or posted more than five minutes off the game clock (`leaderboardClosed`).
 *
 * WHEN TO CALL IT: as close to the run's start as the screens allow, and once per run -- every
 * replay gets a new token. The window counts the title and how-to as well as the reveal, so a
 * token fetched when the page loads and held while a visitor reads the research page for ten
 * minutes will not post.
 *
 * NULL MEANS PLAY ANYWAY. No board, offline, rate-limited, or an answer we cannot believe: the game
 * draws its own seed with `crypto.getRandomValues` and says posting is unavailable for this run.
 * Nothing here blocks play.
 *
 * ------------------------------------------------------------------------------------------------
 */

export interface RunStart {
  seed: number;
  token: string;
}

/** The token's shape, as apps/api/src/schema.ts checks it: two base64url segments, short. */
const TOKEN_PATTERN = /^[\w-]+\.[\w-]+$/;
const TOKEN_MAX = 256;

const isRunStart = (body: unknown): body is RunStart => {
  if (typeof body !== 'object' || body === null) return false;
  const { seed, token } = body as Record<string, unknown>;
  return (
    v2.isSeed(seed) &&
    typeof token === 'string' &&
    token.length <= TOKEN_MAX &&
    TOKEN_PATTERN.test(token)
  );
};

/** Asks the server to start a run. Null for anything but a seed and a token we can believe. */
export async function startRun(): Promise<RunStart | null> {
  // A new run: the last run's row is not this run's, so nothing is marked "yours" until it posts.
  forgetLastPost();
  const reply = await ask(
    START_PATH,
    {
      method: 'POST',
      // JSON on purpose: the route refuses anything else, so a cross-origin page cannot start one
      // without a preflight it fails.
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
    START_TIMEOUT_MS,
  );
  if (!reply?.ok || !isRunStart(reply.body)) return null;
  return { seed: reply.body.seed, token: reply.body.token };
}

/** What a player reads when the content file does not carry the key. Backstops, not copy. */
const BACKSTOPS: Record<NoticeKey, string> = {
  handleAssigned: 'Posted to the board as {handle}.',
  leaderboardAlready: 'That run is already on the board.',
  leaderboardRefused: 'That run could not be posted.',
  leaderboardDown: 'No reply came back for that post.',
  leaderboardClosed: 'Posting has closed for that run.',
};

/**
 * The sentence for the name refusal, which travels under `leaderboardRefused` with a reason. Read
 * from the chrome by `handleBlocked` (the UI's own sentence for a name) when the content carries
 * it, else this.
 */
const NAME_BACKSTOP = 'That name cannot go on the board. Try another.';

/** The server's 422 body, read only for its `reason`, and only one this game knows. */
const reasonOf = (body: unknown): RefusalReason | null => {
  const reason = (body as { reason?: unknown } | null)?.reason;
  return reason === 'name' ? reason : null;
};

/**
 * Posts a finished v2 run under the name the player typed. Always answers an outcome: never throws,
 * never hangs.
 *
 * The NAME is checked here first, by the board's own rules (`checkName`), and a refused one is
 * answered without posting -- `leaderboardRefused` with `reason: 'name'` and which rule in
 * `nameRefusal`, so the screen can say what to change and the run can still be posted. A name that
 * passes is posted in its tidied form. The server checks it again and is the authority.
 *
 * The statuses: 400 is a run the server refused, 409 a token already on the board (the second press
 * of Post), 410 a run whose posting window shut, 422 a refusal with a reason (`name`);
 * everything else -- 404 undeployed, 503 unconfigured, 429 shedding, 500, a timeout -- is no board
 * right now.
 *
 * `strings` is the content file's `ui.chrome`, read by key; a key it does not carry falls back to
 * the sentence above, so a deleted key can never render as `undefined` on the payoff screen.
 */
export async function submit(
  handle: string,
  log: v2.RunLog,
  token: string,
  strings: Readonly<Record<string, string>> = {},
): Promise<PostOutcome> {
  const say = (key: NoticeKey): PostOutcome => ({
    key,
    text: strings[key]?.trim() || BACKSTOPS[key],
  });
  const refused = (reason: RefusalReason): PostOutcome => ({
    key: 'leaderboardRefused',
    text: strings['handleBlocked']?.trim() || NAME_BACKSTOP,
    reason,
  });
  const name = checkName(handle);
  if (!name.ok) return { ...refused('name'), nameRefusal: name.reason };

  const reply = await ask(SCORE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: name.name, log, token }),
  });
  if (!reply) return say('leaderboardDown');
  if (!reply.ok) {
    if (reply.status === 409) return say('leaderboardAlready');
    if (reply.status === 410) return say('leaderboardClosed');
    if (reply.status === 422) {
      const reason = reasonOf(reply.body);
      return reason ? refused(reason) : say('leaderboardRefused');
    }
    return say(reply.status === 400 ? 'leaderboardRefused' : 'leaderboardDown');
  }
  const parsed = v2.postResponseSchema.safeParse(reply.body);
  if (!parsed.success) return say('leaderboardDown');
  const { handle: stored, score, rank = null, entries } = parsed.data;
  const posted: PostedRun = { handle: stored, score, rank };
  lastPost = { ...posted, at: Date.now(), ...(entries ? { entries } : {}) };
  const assigned = say('handleAssigned');
  return { ...assigned, text: assigned.text.replace('{handle}', stored), posted };
}

/** Reads the board: the same three answers as `readTop`, scores now 0 to 100. */
export const readBoard = (limit: number = DEFAULT_TOP_LIMIT): Promise<BoardRead> => readTop(limit);
