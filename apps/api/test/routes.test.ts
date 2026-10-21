import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { score } from '@otp/core';
import { carefulRun, content } from './helpers.ts';

/*
 * The route entry points, and the wiring behind them.
 *
 * `api/score.ts` and `api/top.ts` are four lines each, and until this file nothing executed either
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

/** Imports the two routes fresh, after the environment and `fetch` have been replaced. */
async function load(
  env: Record<string, string>,
  reply: () => Response,
): Promise<{
  calls: Call[];
  scoreRoute: (request: Request) => Promise<Response>;
  topRoute: (request: Request) => Promise<Response>;
}> {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const calls: Call[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(reply());
  });
  const scoreRoute = (await import('../api/score.ts')).default.fetch;
  const topRoute = (await import('../api/top.ts')).default.fetch;
  return { calls, scoreRoute, topRoute };
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the routes as Vercel invokes them', () => {
  it('takes a run on POST /api/score and answers the recomputed score', async () => {
    const run = carefulRun();
    const expected = score(run.log, content).total;
    const { calls, scoreRoute } = await load(CONFIGURED, () => new Response(null, { status: 201 }));

    const res = await scoreRoute(
      new Request(`${URL_BASE}/api/score`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: HANDLE, log: run.log }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: HANDLE, score: expected });
    // The row went to the table this environment names, with the key in headers and not in the URL.
    expect(calls).toHaveLength(1);
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

  it('answers 503 from both routes when the environment is not configured, and calls nothing', async () => {
    const { calls, scoreRoute, topRoute } = await load(
      { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
      () => new Response(null, { status: 201 }),
    );

    const posted = await scoreRoute(
      new Request(`${URL_BASE}/api/score`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: HANDLE, log: carefulRun().log }),
      }),
    );
    const read = await topRoute(new Request(`${URL_BASE}/api/top`));

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
