import {
  DEFAULT_TOP_LIMIT,
  isMintedHandle,
  mintHandle,
  submitResponseSchema,
  topLimit,
  topResponseSchema,
  v2,
} from '@otp/core';

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  score: number;
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
 * Mints a handle such as `brave-lantern-42`, from the wordlist in packages/core.
 *
 * Exported for the results screen to show and to reroll. Handles are generated, never typed: a
 * free-text field on a Cyera-branded public page is a moderation problem, and a player-supplied
 * string is one more thing that would have to be sanitised on the way to a database.
 */
export const newHandle = (): string => mintHandle(unit);

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
    const body = res.ok ? await readJson(res) : null;
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
  if (!reply?.ok) return { state: 'unavailable' };
  const parsed = topResponseSchema.safeParse(reply.body);
  if (!parsed.success) return { state: 'unavailable' };
  const entries = parsed.data.entries.slice(0, wanted);
  return entries.length === 0 ? { state: 'empty' } : { state: 'rows', entries };
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
 * Posts a finished v2 run. Always answers an outcome: never throws, never hangs.
 *
 * The statuses: 400 is a run the server refused, 409 a token already
 * on the board (the second press of Post), 410 a run whose posting window shut; everything else --
 * 404 undeployed, 503 unconfigured, 429 shedding, 500, a timeout -- is no board right now.
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
  // The boundary's promise: no string a player composed is ever posted.
  const minted = isMintedHandle(handle) ? handle : newHandle();
  const reply = await ask(SCORE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ handle: minted, log, token }),
  });
  if (!reply) return say('leaderboardDown');
  if (!reply.ok) {
    if (reply.status === 409) return say('leaderboardAlready');
    if (reply.status === 410) return say('leaderboardClosed');
    return say(reply.status === 400 ? 'leaderboardRefused' : 'leaderboardDown');
  }
  const parsed = submitResponseSchema.safeParse(reply.body);
  if (!parsed.success) return say('leaderboardDown');
  const posted = say('handleAssigned');
  return { ...posted, text: posted.text.replace('{handle}', parsed.data.handle) };
}

/** Reads the board: the same three answers as `readTop`, scores now 0 to 100. */
export const readBoard = (limit: number = DEFAULT_TOP_LIMIT): Promise<BoardRead> => readTop(limit);
