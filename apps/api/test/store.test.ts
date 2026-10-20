import { describe, expect, it } from 'vitest';
import { readStoreConfig } from '../src/env.ts';
import { CONFIG, harness, jsonResponse } from './fake.ts';

/*
 * The adapter over PostgREST, and the environment it reads.
 *
 * The service role key bypasses row-level security, which is what makes an RLS-on-no-policies
 * table work at all. The assertions about where that key may and may not appear are the point of
 * this file.
 */

describe('the service role key', () => {
  it('travels in headers and never in the URL', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.add({ handle: 'brave-lantern-42', score: 500 });
    await h.store.top(10);

    expect(h.calls).toHaveLength(2);
    for (const call of h.calls) {
      expect(call.url).not.toContain(CONFIG.serviceRoleKey);
      // PostgREST accepts `?apikey=`; a key in a query string is a key in every log on the way.
      expect(call.url).not.toContain('apikey=');
      const headers = call.init.headers as Record<string, string>;
      expect(headers['apikey']).toBe(CONFIG.serviceRoleKey);
      expect(headers['authorization']).toBe(`Bearer ${CONFIG.serviceRoleKey}`);
    }
  });

  it('is read from the two variables this service is allowed to read', () => {
    const result = readStoreConfig({
      SUPABASE_URL: ' https://project-ref.supabase.co/ ',
      SUPABASE_SERVICE_ROLE_KEY: ' key ',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'never',
      POSTGRES_PASSWORD: 'never',
    });
    expect(result).toEqual({
      ok: true,
      config: { url: 'https://project-ref.supabase.co', serviceRoleKey: 'key' },
    });
  });

  it('keeps the origin and nothing after it', () => {
    // `https://evil.example/x/../` passed a prefix test and was then concatenated into the request
    // path. `new URL(...).origin` is the host alone, so a path cannot ride along in the variable.
    const result = readStoreConfig({
      SUPABASE_URL: 'https://project-ref.supabase.co/x/../',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect(result.ok && result.config.url).toBe('https://project-ref.supabase.co');
  });

  it('refuses a configuration that would send it somewhere it should not go', () => {
    const secret = 'sbp-pretend-secret';
    const cases: [Record<string, string | undefined>, string][] = [
      [{ SUPABASE_SERVICE_ROLE_KEY: secret }, 'SUPABASE_URL is not set'],
      [{ SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: secret }, 'SUPABASE_URL is not set'],
      [{ SUPABASE_URL: 'https://p.supabase.co' }, 'SUPABASE_SERVICE_ROLE_KEY is not set'],
      [
        { SUPABASE_URL: 'http://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not https',
      ],
      // Parsed, not prefix-matched. A string test for `https://` took all four of these.
      [
        { SUPABASE_URL: 'https://', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a URL',
      ],
      [
        { SUPABASE_URL: `https://user:${secret}@p.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL carries credentials',
      ],
      [
        { SUPABASE_URL: 'https://p.supabase.co/rest/v1', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a bare origin',
      ],
      [
        { SUPABASE_URL: 'https://p.supabase.co/?apikey=leak', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a bare origin',
      ],
    ];
    for (const [env, reason] of cases) {
      const result = readStoreConfig(env);
      expect(result.ok, reason).toBe(false);
      expect(result.ok === false && result.reason).toBe(reason);
      // Whatever went wrong, the reason names variables and never values.
      expect(result.ok === false && result.reason).not.toContain(secret);
    }
  });
});

describe('the table adapter', () => {
  it('writes exactly one row, of exactly two columns', async () => {
    const h = harness();
    await h.store.add({ handle: 'brave-lantern-42', score: 500 });

    expect(h.calls[0]?.url).toBe('https://project-ref.supabase.co/rest/v1/leaderboard');
    expect(h.calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(h.calls[0]?.init.body))).toEqual([
      { handle: 'brave-lantern-42', score: 500 },
    ]);
    // Handle and score only (CLAUDE.md): no run id, no duration, no address, nothing else.
    expect(Object.keys(JSON.parse(String(h.calls[0]?.init.body))[0] as object)).toEqual([
      'handle',
      'score',
    ]);
  });

  it('refuses to write a row the game could not have produced, before the network', async () => {
    const h = harness();
    await expect(h.store.add({ handle: 'wolfspotter', score: 10 })).rejects.toThrow();
    await expect(h.store.add({ handle: 'brave-lantern-42', score: -1 })).rejects.toThrow();
    await expect(h.store.add({ handle: 'brave-lantern-42', score: 1.5 })).rejects.toThrow();
    expect(h.calls).toHaveLength(0);
  });

  it('throws rather than inventing a board when the table answers oddly', async () => {
    await expect(harness(() => new Response('', { status: 503 })).store.top(5)).rejects.toThrow();
    await expect(harness(() => jsonResponse('not rows')).store.top(5)).rejects.toThrow();
    await expect(
      harness(() => jsonResponse([{ handle: 'brave-lantern-42' }])).store.top(5),
    ).rejects.toThrow();
  });

  it('asks for the two columns it renders and no others', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(7);
    expect(h.calls[0]?.url).toContain('select=handle%2Cscore');
    // Four pages asked for, one page served: the filter below runs after the table's own limit,
    // so it needs rows to fall through to. See the comment on `top`.
    expect(h.calls[0]?.url).toContain('limit=28');
  });

  it('never asks the table for more than a bounded window', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(25);
    expect(h.calls[0]?.url).toContain('limit=100');
  });

  it('falls through junk rows instead of serving a short page', async () => {
    /*
     * A row the game could not have minted takes a place in the table's own ordering. Filtering
     * after the limit meant a page of them answered with nothing while real rows sat behind them;
     * asking for a wider window means the real rows arrive and the junk is dropped from the middle.
     */
    const junk = Array.from({ length: 10 }, (_, i) => ({
      handle: `hand-written-${i}`,
      score: 1e9,
    }));
    const real = Array.from({ length: 3 }, (_, i) => ({
      handle: 'brave-lantern-42',
      score: 9 - i,
    }));
    const h = harness(() => jsonResponse([...junk, ...real]));

    await expect(h.store.top(3)).resolves.toEqual(real);
  });

  it('throws on a 200 that is not JSON at all', async () => {
    // The branch the comment above `parse()` claims and nothing reached: a proxy's HTML error page
    // served with a 200 must read as "the board cannot be read", not as a SyntaxError with a
    // fragment of someone else's response in the message.
    await expect(
      harness(() => new Response('<!doctype html><title>nope</title>', { status: 200 })).store.top(
        5,
      ),
    ).rejects.toThrow('shape');
  });
});
