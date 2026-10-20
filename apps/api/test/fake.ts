import { createStore } from '../src/store.ts';
import type { FetchLike, LeaderboardStore } from '../src/store.ts';
import type { StoreConfig } from '../src/env.ts';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';
import type { RecentRuns, WriteBudget } from '../src/limit.ts';
import { content } from './helpers.ts';
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
  /** The row that was handed to the table, parsed back out of the request body. */
  written(): { handle: string; score: number } | undefined;
}

/** The per-instance state, fresh per harness so one test's writes never reach another's. */
export interface Instance {
  budget?: WriteBudget;
  recent?: RecentRuns;
}

export function harness(
  reply: (call: Call) => Response = () => new Response(null, { status: 201 }),
  instance: Instance = {},
): Harness {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(reply({ url, init }));
  };
  const store = createStore(CONFIG, fetchImpl);
  return {
    calls,
    store,
    deps: {
      content,
      store,
      budget: instance.budget ?? createWriteBudget(),
      recent: instance.recent ?? createRecentRuns(),
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
  budget: createWriteBudget(),
  recent: createRecentRuns(),
};

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
