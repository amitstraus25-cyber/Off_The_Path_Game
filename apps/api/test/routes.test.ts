import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { v2 } from '@otp/core';
import { claimedMs, runOf } from './helpers.ts';

/*
 * The route entry points, and the wiring behind them.
 *
 * `api/start.ts`, `api/score.ts` and `api/top.ts` are a few lines each, and until this file nothing executed either
 * of them: every other test calls the handlers directly with a fake Deps, so the Web handler
 * signature, the module-scope read of process.env and the one real `fetch` the store is built with
 * were all unexercised. That is the part of the service a deploy runs first.
 *
 * THESE ARE NOT THE FILES VERCEL INVOKES, AND THIS COMMENT SAID THEY WERE UNTIL 2026-10-21.
 *
 * THE FILES IMPORTED BELOW ARE THE FILES THAT SHIP, and for most of 2026-10-21 that was not true.
 * There were up to three copies of these routes; this file tested `apps/api/api/*.ts` while the
 * deployed copy, elsewhere, was executed by nothing and differed in exactly its import specifiers
 * -- which is where its failure lived. Now there is one copy, `apps/api/api/`, and
 * apps/game/scripts/vercel-output.mjs bundles THIS file into the deploy. So what this proves is
 * the deployed route, not a pattern resembling it.
 *
 * The one thing it still cannot see is the bundle: the `(req, res)` adapter and esbuild's output.
 * That is proved separately, by serving the bundled `.func/index.js` from an isolated directory.
 *
 * The routes `export default { fetch }`, so `load()` unwraps `.fetch`.
 *
 * There is still no database. `fetch` is replaced before the modules are imported, so the store
 * these routes build talks to an in-process function; the environment is stubbed with obvious
 * fakes. Nothing here reaches the network, and `SUPABASE_*` is read by name only.
 */

const HANDLE = 'brave-lantern-42';
const URL_BASE = 'https://off-the-path.test';

interface Call {
  url: string;
  init: RequestInit;
}

type Route = (request: Request) => Promise<Response>;

/** Imports the three routes fresh, after the environment and `fetch` have been replaced. */
async function load(
  env: Record<string, string>,
  reply: () => Response,
): Promise<{ calls: Call[]; startRoute: Route; scoreRoute: Route; topRoute: Route }> {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const calls: Call[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(reply());
  });
  const startRoute = (await import('../api/start.ts')).default.fetch;
  const scoreRoute = (await import('../api/score.ts')).default.fetch;
  const topRoute = (await import('../api/top.ts')).default.fetch;
  return { calls, startRoute, scoreRoute, topRoute };
}

const CONFIGURED = {
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-service-role-key',
};

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const post = (path: string, body: unknown): Request =>
  new Request(`${URL_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('the routes as Vercel invokes them', () => {
  it('answers GET on the two POST routes with our own 405 -- the discriminator', async () => {
    const { startRoute, scoreRoute } = await load(CONFIGURED, () => new Response(null));
    for (const route of [startRoute, scoreRoute]) {
      const res = await route(new Request(`${URL_BASE}/api/x`));
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    }
  });

  it('starts a run on POST /api/start, takes it on POST /api/score, answers the recomputed score', async () => {
    // The server's real clock, faked: the token is stamped by `Date.now()` inside src/deps.ts.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_761_100_000_000);
    const { calls, startRoute, scoreRoute } = await load(
      CONFIGURED,
      () => new Response(null, { status: 201 }),
    );

    const started = await startRoute(post('/api/start', {}));
    expect(started.status).toBe(200);
    const { seed, token } = (await started.json()) as { seed: number; token: string };
    const log = v2.toRunLog(runOf('careful', seed));
    vi.setSystemTime(1_761_100_000_000 + claimedMs(log) + 15_000);

    const res = await scoreRoute(post('/api/score', { handle: HANDLE, log, token }));

    expect(res.status).toBe(200);
    // The fake table answers every call 201 with no body, so the count and the read after the
    // insert both fail: the post still answers, with no rank and no board (handlers.ts).
    await expect(res.json()).resolves.toEqual({ handle: HANDLE, score: 100, rank: null });
    // The row went to the table this environment names, with the key in headers and not in the URL.
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://project-ref.supabase.co/rest/v1/leaderboard');
    expect(calls[0]!.url).not.toContain(CONFIGURED.SUPABASE_SERVICE_ROLE_KEY);
    expect((calls[0]!.init.headers as Record<string, string>)['apikey']).toBe(
      CONFIGURED.SUPABASE_SERVICE_ROLE_KEY,
    );
  });

  it('answers GET /api/top from the same wiring', async () => {
    const { calls, topRoute } = await load(
      CONFIGURED,
      () =>
        new Response(JSON.stringify([{ handle: HANDLE, score: 900 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const res = await topRoute(new Request(`${URL_BASE}/api/top?limit=5`));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      entries: [{ rank: 1, handle: HANDLE, score: 900 }],
    });
    expect(calls[0]!.url).toContain('order=score.desc%2Ccreated_at.asc');
  });

  it('answers 503 from every route when the environment is not configured, and calls nothing', async () => {
    const { calls, startRoute, scoreRoute, topRoute } = await load(
      { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
      () => new Response(null, { status: 201 }),
    );

    const started = await startRoute(post('/api/start', {}));
    const log = v2.toRunLog(runOf('careful', 0));
    const posted = await scoreRoute(post('/api/score', { handle: HANDLE, log, token: 'a.b' }));
    const read = await topRoute(new Request(`${URL_BASE}/api/top`));

    // The start's 503 is what sends the game to its own seed with posting switched off.
    expect(started.status).toBe(503);
    expect(posted.status).toBe(503);
    expect(read.status).toBe(503);
    await expect(read.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
    expect(calls).toHaveLength(0);
  });

  it('reads no NEXT_PUBLIC_ or POSTGRES_ variable, whatever is set around it', async () => {
    const { calls, topRoute } = await load(
      {
        ...CONFIGURED,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-by-name-and-by-convention',
        SUPABASE_PUBLISHABLE_KEY: 'also-not-a-secret',
        POSTGRES_PASSWORD: 'never-read-here',
        POSTGRES_URL: 'postgres://never-read-here',
      },
      () => new Response(JSON.stringify([]), { status: 200 }),
    );

    await topRoute(new Request(`${URL_BASE}/api/top`));

    const seen = JSON.stringify(calls);
    for (const value of [
      'public-by-name-and-by-convention',
      'also-not-a-secret',
      'never-read-here',
    ])
      expect(seen).not.toContain(value);
  });
});
