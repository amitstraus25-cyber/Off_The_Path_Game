import { z } from 'zod';
import { isMintedHandle } from '@otp/core';
import type { StoreConfig } from './env.ts';

/*
 * The leaderboard table, over plain HTTP.
 *
 * Supabase exposes PostgREST, so this is `fetch` against /rest/v1/leaderboard with two headers.
 * That is the whole adapter, and it is why this service has no database driver: a Postgres client
 * would be a new dependency doing a job that four fetch options already do (CLAUDE.md rule 7).
 *
 * The table is `public.leaderboard (id, handle, score, created_at)` with RLS on and no policies.
 * Nothing but the service role can read or write it, and the service role key stays in headers --
 * PostgREST also accepts `?apikey=`, and this never uses it, because a key in a query string is a
 * key in every log and referrer on the way.
 */

const PATH = '/rest/v1/leaderboard';
/** Long enough for a cold Postgres, short enough that the game's own timeout is the backstop. */
const TIMEOUT_MS = 4000;
/** The most rows one read will ever ask the table for, however the page is filtered down after. */
const MAX_ROWS_READ = 100;

export interface LeaderboardRow {
  handle: string;
  score: number;
}

export interface LeaderboardStore {
  add(row: LeaderboardRow): Promise<void>;
  /** Highest score first, then the earliest to get there. */
  top(limit: number): Promise<LeaderboardRow[]>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/*
 * Rows come back over the network, so they are parsed before they are believed (CLAUDE.md: treat
 * anything from the network as untrusted). A row whose handle is not one the game mints is dropped
 * rather than rendered: the only way one could exist is if somebody wrote to the table by hand.
 */
const rowsSchema = z.array(z.object({ handle: z.string(), score: z.number() }));

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export function createStore(config: StoreConfig, fetchImpl: FetchLike): LeaderboardStore {
  const headers = {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
  };

  return {
    async add({ handle, score }) {
      // Belt and braces over the schema at the edge: the last thing before the insert refuses to
      // write a handle the game did not mint, so no route can ever reach the table without it.
      if (!isMintedHandle(handle)) throw new Error('refusing to store an unminted handle');
      if (!Number.isInteger(score) || score < 0)
        throw new Error('refusing to store a score that is not a whole number of points');

      const res = await fetchImpl(`${config.url}${PATH}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify([{ handle, score }]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`insert refused with ${res.status}`);
    },

    async top(limit) {
      /*
       * Ask for more rows than the page needs, because the handle filter below runs AFTER the
       * table has applied its limit. A row the game could not have minted -- a hand-written
       * insert, or one whose word was later taken out of the list -- would otherwise take a place
       * on the page and leave a hole where a real row should have fallen through. Over-fetching
       * four pages means the filter has somewhere to fall through to; it is not unbounded, and
       * `GET /api/top` serving a short page is still better than serving a poisoned one.
       */
      const window = Math.min(limit * 4, MAX_ROWS_READ);
      const query = new URLSearchParams({
        select: 'handle,score',
        order: 'score.desc,created_at.asc',
        limit: String(window),
      });
      const res = await fetchImpl(`${config.url}${PATH}?${query.toString()}`, {
        method: 'GET',
        headers: { ...headers, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`select refused with ${res.status}`);
      // Read as text and parse here, so a body that is not JSON at all fails with a sentence of
      // ours rather than a SyntaxError carrying a fragment of whatever came back.
      const rows = rowsSchema.safeParse(parse(await res.text()));
      if (!rows.success) throw new Error('the board came back in a shape it has never had');
      return rows.data
        .filter((r) => isMintedHandle(r.handle) && Number.isInteger(r.score))
        .slice(0, limit);
    },
  };
}
