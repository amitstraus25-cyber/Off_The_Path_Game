import { v2 } from '@otp/core';
import { createStore } from '../src/store.ts';
import type { FetchLike, LeaderboardStore } from '../src/store.ts';
import type { StoreConfig } from '../src/env.ts';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';
import type { RecentRuns, WriteBudget } from '../src/limit.ts';
import { createRunTokens, signingKey } from '../src/token.ts';
import type { RunTokens } from '../src/token.ts';
import { content, runOf } from './helpers.ts';
import type { Deps } from '../src/handlers.ts';

/*
 * A store wired to an in-process fetch. There is no database here and there must never be one:
 * this checkout has no credentials, cannot reach Supabase, and a test that needed to would be a
 * test that only runs on somebody's laptop.
 */

export const CONFIG: StoreConfig = {
  url: 'https://project-ref.supabase.co',
  // Obviously fake, and asserted against: nothing may echo this back or put it in a URL.
  serviceRoleKey: 'not-a-real-service-role-key',
};

export interface Call {
  url: string;
  init: RequestInit;
}

export interface Harness {
  calls: Call[];
  store: LeaderboardStore;
  deps: Deps;
  /** The server clock the deps read. Tests move it. */
  clock: Clock;
  /** The row that was handed to the table, parsed back out of the request body. */
  written(): { handle: string; score: number } | undefined;
}

/** The server's clock, as a box a test can move. */
export interface Clock {
  now: number;
}

/** An arbitrary epoch, so `issuedAt` is a realistic number and not zero. */
export const T0 = 1_761_100_000_000;

/** The signer every harness shares, so a token from one harness opens in another -- as on Vercel. */
export const TOKENS: RunTokens = createRunTokens(signingKey(CONFIG.serviceRoleKey));

/** The per-instance state, fresh per harness so one test's writes never reach another's. */
export interface Instance {
  budget?: WriteBudget;
  starts?: WriteBudget;
  recent?: RecentRuns;
  clock?: Clock;
}

/**
 * What PostgREST answers to the insert this service sends: `201 Created`, and -- because the
 * request carries `Prefer: return=minimal` -- no body at all.
 *
 * The 201 is written here as a literal, taken from PostgREST's documentation for `POST /table`,
 * and NOT imported from `src/store.ts`. A fake that reflects the adapter's own constant back at it
 * would follow that constant wherever it went: change the adapter to believe 200 and every test
 * here would move with it and stay green, which is the exact shape of guard this repo has been
 * caught by before.
 */
export const created = (): Response => new Response(null, { status: 201 });

/**
 * A reply whose body errors instead of arriving -- a connection torn after the headers.
 * `res.text()` rejects on it, which is the one case neither "empty" nor "a body" describes.
 */
export const unreadable = (status: number): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('the connection went away mid-body'));
      },
    }),
    { status },
  );

export function harness(
  reply: (call: Call) => Response = created,
  instance: Instance = {},
): Harness {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(reply({ url, init }));
  };
  const store = createStore(CONFIG, fetchImpl);
  const clock = instance.clock ?? { now: T0 };
  return {
    calls,
    store,
    clock,
    deps: {
      content,
      store,
      tokens: TOKENS,
      budget: instance.budget ?? createWriteBudget(),
      starts: instance.starts ?? createWriteBudget(120),
      recent: instance.recent ?? createRecentRuns(),
      now: () => clock.now,
    },
    written() {
      const body = calls[0]?.init.body;
      if (typeof body !== 'string') return undefined;
      return (JSON.parse(body) as { handle: string; score: number }[])[0];
    },
  };
}

/** A store that is not configured at all: the shape the game must stay playable against. */
export const noStore: Deps = {
  content,
  store: null,
  tokens: null,
  budget: createWriteBudget(),
  starts: createWriteBudget(120),
  recent: createRecentRuns(),
  now: () => T0,
};

export interface Ticketed {
  handle: string;
  log: v2.RunLog;
  token: string;
}

/**
 * A run as an honest browser makes one: a token issued at the clock's current time, a run played
 * through the real reducer on the token's seed, and the clock moved on to `postAfterMs` past the
 * run's own end -- the player reading the reveal before pressing Post.
 */
export function ticketed(
  clock: Clock,
  { strategy = 'careful', postAfterMs = 10_000, handle = 'brave-lantern-42' } = {},
): Ticketed {
  const { seed, token } = TOKENS.issue(clock.now);
  const log = v2.toRunLog(runOf(strategy, seed));
  clock.now += (log.events.at(-1)?.at ?? 0) + postAfterMs;
  return { handle, log, token };
}

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * A POST whose body arrives in chunks and declares no `content-length` -- the shape that made the
 * old cap advisory, because the whole thing was buffered before anything measured it.
 */
export const postChunked = (chunks: string[]): Request => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('https://off-the-path.test/api/score', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
};

export const postScore = (body: unknown, contentType = 'application/json'): Request =>
  new Request('https://off-the-path.test/api/score', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
