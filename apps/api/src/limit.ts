import { createHash } from 'node:crypto';
import type { RunEvent } from '@otp/core';

/*
 * Two small defences against a caller with a for-loop, and an honest account of what they are not.
 *
 * The board recomputes every score (golden rule 6), so no one can post a number they did not earn
 * -- but recomputation bounds the VALUE of a row, not the VOLUME of them. A maximal run log can be
 * produced by driving the reducer offline, and before this file the same legal log could be posted
 * under twenty-five minted handles and fill the whole served page in twenty-five requests.
 *
 * What these do: per instance, they cap how many rows a minute can be written and refuse a run log
 * that this instance has already written. What they do NOT do: span instances. Vercel runs several
 * and each gets its own module scope, so a caller who spreads a flood across cold starts is bounded
 * by the edge and not by this. That is not a reason to leave the near case open; it IS a reason the
 * README still asks for Vercel's rate limiting on /api/*, and for the `log_hash unique` column that
 * would make dedupe durable. Both of those need someone with the project console open.
 *
 * Neither holds an identifier. There is no IP here, raw or hashed, no cookie and no account --
 * the budget is a single number per instance and the fingerprint is a hash of gameplay events.
 * Nothing in this file is ever written to the table, which is how "a handle and a score only"
 * stays literally true (CLAUDE.md) while duplicates still get refused.
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
  has(fingerprint: string): boolean;
  /**
   * Records a run that reached the table. Asking and recording are separate on purpose: a run
   * remembered before the insert would be refused as a duplicate on the retry after a transient
   * failure, which is a player losing a score to a blip in the database.
   */
  remember(fingerprint: string): void;
}

/** The last `max` runs this instance wrote, oldest dropped first. A Set iterates in insertion order. */
export function createRecentRuns(max = 500): RecentRuns {
  const keys = new Set<string>();
  return {
    has: (fingerprint) => keys.has(fingerprint),
    remember(fingerprint) {
      keys.add(fingerprint);
      if (keys.size > max) {
        // Past the cap the set holds at least `max + 1`, so there is always a first one to drop.
        const [oldest] = keys;
        keys.delete(oldest!);
      }
    },
  };
}

/**
 * A run, as a fixed-length string. The log comes out of zod, so its keys are in schema order and
 * two posts of the same run produce the same hash whatever order the caller sent the fields in.
 * Timestamps are part of it: two players producing a byte-identical log would have to have played
 * every beat on the same millisecond.
 */
export const fingerprint = (log: readonly RunEvent[]): string =>
  createHash('sha256').update(JSON.stringify(log)).digest('hex');
