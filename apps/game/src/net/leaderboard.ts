import {
  isMintedHandle,
  mintHandle,
  submitResponseSchema,
  topLimit,
  topResponseSchema,
} from '@otp/core';
import type { Content, GameState } from '@otp/core';

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
 * The content key of every sentence a post can answer with. Four, and no fifth without a line
 * here: `Results.tsx` declares what each one ASSERTS, and a key with no declaration is a line
 * nobody has thought about.
 */
export type NoticeKey =
  'handleAssigned' | 'leaderboardAlready' | 'leaderboardRefused' | 'leaderboardDown';

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

export interface LeaderboardClient {
  /** Returns what to show the player, or null when there is nothing to say. Never throws. */
  submit(state: GameState, handle: string): Promise<PostOutcome | null>;
  /** Never throws, never hangs, and never reports an absent board as an empty one. */
  top(limit: number): Promise<BoardRead>;
}

/*
 * Phase 6: the real adapter, behind the interface Phase 5 shipped against and unchanged from it.
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

const SCORE_PATH = '/api/score';
const TOP_PATH = '/api/top';
/** Past this the board is down as far as the player is concerned. */
const TIMEOUT_MS = 6000;

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
async function ask(path: string, init: RequestInit): Promise<Reply | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
     * signal errors the body stream too, so this read is bounded by the same six seconds as the
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
 * A FREE FUNCTION rather than only a method, because it needs nothing from `Content`: it reads no
 * string, so there is no reason for the one screen that shows a board to have to be handed a whole
 * client to get at it. `createLeaderboardClient().top()` is this function, so there is one
 * implementation and `test/leaderboard.test.ts` exercises it through the interface either way.
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
 * Every player-facing line this adapter can produce now comes out of content/game.json, which is
 * CLAUDE.md rule 3 and was an ask the last round could not close: the three keys below were written
 * in code because the content file belonged to someone else. They are shipped now --
 * `handleAssigned`, `leaderboardRefused`, `leaderboardAlready` -- and `test/strings.test.ts` holds
 * the file and these reads against each other in both directions.
 *
 * The literals that remain are BACKSTOPS, not copy. `submit()` promises an outcome or null, and a
 * key deleted from the content file must not turn that promise into `undefined` rendered on the
 * payoff screen; the build-time guard is the thing that keeps them unreachable.
 */
export function createLeaderboardClient(content: Content): LeaderboardClient {
  /*
   * Indexed with a LITERAL key on purpose, not through a helper taking the key as an argument:
   * `test/strings.test.ts` scans these sources for `strings['...']` to decide which keys the UI
   * actually reads, and a key assembled behind a function call is invisible to it. The guard is
   * only worth having if the code it reads is written the way it scans for.
   */
  const say = (value: string | undefined, backstop: string): string => value?.trim() || backstop;
  /*
   * The backstops are the CLAIM as well as the words. `leaderboardDown`'s used to read
   * "Leaderboard unavailable right now.", which asserts something this client never observed --
   * it saw no reply, which is not the same as a board that is down, and on 2026-10-21 that
   * sentence was measured sitting above the player's own run on a board that was plainly
   * answering. A backstop that says more than the shipped line would reintroduce the defect on
   * the day the key goes missing.
   */
  const unavailable: PostOutcome = {
    key: 'leaderboardDown',
    text: say(content.strings['leaderboardDown'], 'No reply came back for that post.'),
  };
  const refused: PostOutcome = {
    key: 'leaderboardRefused',
    text: say(content.strings['leaderboardRefused'], 'That run could not be posted.'),
  };
  const already: PostOutcome = {
    key: 'leaderboardAlready',
    text: say(content.strings['leaderboardAlready'], 'That run is already on the board.'),
  };
  const assigned = (handle: string): PostOutcome => ({
    key: 'handleAssigned',
    text: say(content.strings['handleAssigned'], 'Posted to the board as {handle}.').replace(
      '{handle}',
      handle,
    ),
  });

  return {
    async submit(state, handle) {
      /*
       * The handle is minted, so a handle this game did not mint is not sent: the server would
       * refuse it (`handleSchema` is the same schema on both ends), and a player-typed string
       * reaching the table is the thing decision D4 rules out.
       *
       * THE SCREEN AND THIS FUNCTION NOW AGREE. For four rounds they did not, and it was visible:
       * a player typed `wolfspotter` into the Results field, pressed Post, and the body on the
       * wire carried `deft-cloak-81` while the status line read "Posted to the board as
       * deft-cloak-81." The typed name was discarded in the line below and nothing on the screen
       * said so. `Results.tsx` holds `newHandle()` in state now, renders it as text, offers a
       * reroll, and passes that value to `onPost`, so `handle` arrives here already minted.
       *
       * The line below therefore has nothing left to substitute in the shipped UI, and it stays
       * anyway. It is the boundary, not the screen's helper: this module is what reaches the
       * network, and it is the last place that can promise "no string a player composed is ever
       * posted" independently of whatever a future screen hands it. The cost of keeping it is one
       * comparison; the cost of removing it is that the promise moves into a component.
       */
      const minted = isMintedHandle(handle) ? handle : newHandle();
      const reply = await ask(SCORE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: minted, log: state.log }),
      });
      if (!reply) return unavailable;
      /*
       * 400 and 409 are the two answers that mean "this submission", and they are the only 4xx a
       * well-formed client can provoke: 400 for a log that does not replay or a handle the server
       * did not mint, 409 for a run already on the board. 405/413/415 cannot happen from here.
       * Everything else -- a 404 because apps/api is not deployed, a 503 because the store is not
       * configured, a 429 because the service is shedding writes, a 500, a timeout -- means there
       * is no board to post to right now, which is a different sentence and the one Phase 5
       * promised. A 404 reported as "that run could not be posted" would blame the player for an
       * undeployed service.
       *
       * 409 gets its own sentence, and it is the one a REAL PLAYER meets. The Post button is
       * enabled again the moment a post succeeds, so posting twice is a click, not an attack: the
       * second one is the same run log, the server answers 409 "that run is already on the board",
       * and reading that out as "that run could not be posted" tells a player their score failed
       * when it is sitting on the board under the name they were just shown. Measured against the
       * real handler: `apps/api` answers 409 on the second post of an identical log.
       */
      if (!reply.ok) {
        if (reply.status === 409) return already;
        return reply.status === 400 ? refused : unavailable;
      }

      const parsed = submitResponseSchema.safeParse(reply.body);
      if (!parsed.success) return unavailable;
      /*
       * Always a sentence, never a silent success. The name is minted, so it is not the name the
       * player typed and they have to be told which one went up -- and when the results screen
       * migrates to showing a minted handle (see the ask list), a success that returned null
       * would render nothing at all on the one screen that asked them to post.
       */
      return assigned(parsed.data.handle);
    },

    /*
     * THE MEASUREMENT THAT MADE THIS RETURN A STATE AND NOT AN ARRAY, kept because it is the
     * evidence and not the conclusion.
     *
     * An empty array meant one of two quite different things and the old signature could not tell
     * them apart: a board that answered and has no rows yet, and no board at all. The second is not
     * hypothetical and it is not loud. Measured on 2026-10-20 against the shipped build on a plain
     * `vite preview` -- and it is the same shape a deploy takes if the `/api/(.*)` rewrite never
     * reaches apps/api, because the catch-all rewrite serves the SPA for every path:
     *
     *     GET /api/top?limit=10  ->  200, content-type: text/html, 654 bytes of index.html
     *     POST /api/score        ->  404, no body
     *
     * The 200 is not a board. `ask()` survives it -- `res.json()` throws on the HTML and the catch
     * turns it into "no reply" -- so this used to return `[]` either way, and a screen rendering
     * that as "no scores yet" would have told a visitor to a data-security company's research page
     * that the board was empty when the truth is that it is not there. `readTop` answers
     * `unavailable` for it now, and `test/board.test.ts` fails if that ever becomes `empty` again.
     */
    top: readTop,
  };
}
