/*
 * Two small defences against a caller with a for-loop, and an honest account of what they are not.
 *
 * The board recomputes every score (golden rule 6), so no one can post a number they did not earn
 * -- but recomputation bounds the VALUE of a row, not the VOLUME of them. A maximal run log can be
 * produced by driving the reducer offline, and before this file the same legal log could be posted
 * under twenty-five minted handles and fill the whole served page in twenty-five requests.
 *
 * What these do: per instance, they cap how many rows (and run starts) a minute can be written and
 * refuse a run token that this instance has already turned into a row. What they do NOT do: span instances. Vercel runs several
 * and each gets its own module scope, so a caller who spreads a flood across cold starts is bounded
 * by the edge and not by this. That is not a reason to leave the near case open; it IS a reason the
 * README still asks for Vercel's rate limiting on /api/*. Durable single use would need a column the
 * table deliberately does not have (docs/DATABASE.md, Decision 1).
 *
 * Neither holds an identifier. There is no IP here, raw or hashed, no cookie and no account --
 * the budget is a single number per instance and the recent set holds random token ids.
 * Nothing in this file is ever written to the table, which is how "a handle and a score only"
 * stays literally true (CLAUDE.md) while duplicates still get refused.
 *
 * v2 changed the dedupe KEY from a hash of the run log to the run token's id (src/token.ts). The log
 * hash only stopped the same log twice; one token could still have carried as many different legal
 * logs for its seed as a forger cared to build. One token is one row covers both.
 */

export interface WriteBudget {
  /** Spends one write. False when the instance has spent its budget for now. */
  take(): boolean;
}

/**
 * A token bucket over writes. Deliberately spent only on a row that is about to be inserted, so a
 * flood of invalid bodies cannot lock honest players out of a board that is working.
 *
 * Thirty a minute per instance against an honest rate of one per completed playthrough. Over
 * budget is a 429, which the game reads as "the board is unavailable" and shows next to results
 * that are already on the screen -- the same quiet absence as a board that is not deployed.
 */
export function createWriteBudget(
  capacity = 30,
  perMs = 60_000,
  now: () => number = Date.now,
): WriteBudget {
  let tokens = capacity;
  let last = now();
  return {
    take() {
      const at = now();
      tokens = Math.min(capacity, tokens + ((at - last) * capacity) / perMs);
      last = at;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

export interface RecentRuns {
  /** True when this instance has already WRITTEN that run. */
  has(id: string): boolean;
  /**
   * Records a run that reached the table. Asking and recording are separate on purpose: a run
   * remembered before the insert would be refused as a duplicate on the retry after a transient
   * failure, which is a player losing a score to a blip in the database.
   */
  remember(id: string): void;
}

/** The last `max` runs this instance wrote, oldest dropped first. A Set iterates in insertion order. */
export function createRecentRuns(max = 500): RecentRuns {
  const keys = new Set<string>();
  return {
    has: (id) => keys.has(id),
    remember(id) {
      keys.add(id);
      if (keys.size > max) {
        // Past the cap the set holds at least `max + 1`, so there is always a first one to drop.
        const [oldest] = keys;
        keys.delete(oldest!);
      }
    },
  };
}
