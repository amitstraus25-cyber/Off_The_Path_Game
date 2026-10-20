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

export interface LeaderboardClient {
  /** Returns a message to show the player, or null when there is nothing to say. Never throws. */
  submit(state: GameState, handle: string): Promise<string | null>;
  top(limit: number): Promise<LeaderboardEntry[]>;
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

/*
 * Two player-facing lines that are NOT read from content, and should be.
 *
 * CLAUDE.md rule 3 puts these in content/game.json, which is owned by a human this round --
 * `apps/game/test/strings.test.ts` fails the build on a key the shipped file does not carry, and
 * its PENDING handover list is deliberately empty. So they are written down here, next to the
 * `leaderboardDown` read that does come from content, and the move is recorded as an ask. The keys
 * they want are `leaderboardRefused` and `handleAssigned`.
 */
const REFUSED = 'That run could not be posted.';
const ASSIGNED = 'Posted to the board as {handle}.';

export function createLeaderboardClient(content: Content): LeaderboardClient {
  const unavailable = content.strings['leaderboardDown'] ?? 'Leaderboard unavailable right now.';
  const assigned = (handle: string): string => ASSIGNED.replace('{handle}', handle);

  return {
    async submit(state, handle) {
      /*
       * The handle is minted, so a handle this game did not mint is not sent: the server would
       * refuse it, and a player-typed string reaching the table is the thing the decision rules
       * out. Until the results screen offers a minted handle to show and reroll, this mints one
       * and the message below says which name went up -- the alternative is a board nobody can
       * reach from the shipped UI.
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
       */
      if (!reply.ok) return reply.status === 400 || reply.status === 409 ? REFUSED : unavailable;

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

    async top(limit) {
      const wanted = topLimit(limit);
      const reply = await ask(`${TOP_PATH}?limit=${wanted}`, { method: 'GET' });
      if (!reply?.ok) return [];
      const parsed = topResponseSchema.safeParse(reply.body);
      return parsed.success ? parsed.data.entries.slice(0, wanted) : [];
    },
  };
}
