import { describe, expect, it } from 'vitest';
import { MAX_TOP_LIMIT } from '@otp/core';
import { handleTop } from '../src/handlers.ts';
import { harness, jsonResponse, noStore } from './fake.ts';

const get = (query = ''): Request => new Request(`https://off-the-path.test/api/top${query}`);

const board = [
  { handle: 'brave-lantern-42', score: 900 },
  { handle: 'quiet-thicket-11', score: 900 },
  { handle: 'merry-kettle-73', score: 450 },
];

describe('GET /api/top', () => {
  it('ranks the rows the table gave it, in the order it asked for', async () => {
    const h = harness(() => jsonResponse(board));
    const res = await handleTop(get(), h.deps);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      entries: [
        { rank: 1, handle: 'brave-lantern-42', score: 900 },
        { rank: 2, handle: 'quiet-thicket-11', score: 900 },
        { rank: 3, handle: 'merry-kettle-73', score: 450 },
      ],
    });
    // The tie-break is the table's, not this file's: highest score, then whoever got there first.
    expect(h.calls[0]?.url).toContain('order=score.desc%2Ccreated_at.asc');
  });

  it('is cached at the edge so a marketing page does not wake Postgres per visitor', async () => {
    const res = await handleTop(get(), harness(() => jsonResponse(board)).deps);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=10, stale-while-revalidate=20',
    );
  });

  it('is never more than thirty seconds old, fresh and stale together', async () => {
    /*
     * The bound that matters to a visitor is the SUM: s-maxage is how long a copy is fresh, and
     * stale-while-revalidate how much longer it is served while it refetches. It was 60 + 300, so a
     * board up to six minutes old -- which is how the client's own post went missing (handlers.ts
     * `TOP_CACHE`). Parsed from the header rather than restated, so a retune is held to the bound.
     */
    const res = await handleTop(get(), harness(() => jsonResponse(board)).deps);
    const header = res.headers.get('cache-control') ?? '';
    const n = (k: string) => Number(new RegExp(`${k}=(\\d+)`).exec(header)?.[1]);
    expect(n('s-maxage') + n('stale-while-revalidate')).toBeLessThanOrEqual(30);
    expect(n('s-maxage')).toBeGreaterThan(0);
  });

  it('clamps what it will serve, whatever the query string asks for', async () => {
    /*
     * Two numbers, deliberately: the page size this route will serve, and the wider window the
     * store reads so the handle filter has rows to fall through to (store.ts `top`). The second
     * is bounded at 100 rows, which is why `?limit=1000` reads 100 and not four thousand.
     */
    for (const [query, served, read] of [
      ['?limit=5', 5, 20],
      ['?limit=1000', MAX_TOP_LIMIT, 100],
      ['?limit=-1', 10, 40],
      ['?limit=all', 10, 40],
      ['', 10, 40],
    ] as const) {
      const rows = Array.from({ length: served + 5 }, () => ({
        handle: 'brave-lantern-42',
        score: 1,
      }));
      const h = harness(() => jsonResponse(rows));
      const res = await handleTop(get(query), h.deps);
      const parsed = (await res.json()) as { entries: unknown[] };

      expect(h.calls[0]?.url, query).toContain(`limit=${read}`);
      expect(parsed.entries, query).toHaveLength(served);
    }
  });

  it('drops a row whose handle this game could not have minted', async () => {
    // The only way such a row exists is a hand-written insert. It is not rendered.
    const h = harness(() =>
      jsonResponse([...board, { handle: '<script>alert(1)</script>', score: 1e9 }]),
    );
    const res = await handleTop(get(), h.deps);
    const parsed = (await res.json()) as { entries: { handle: string }[] };

    expect(parsed.entries).toHaveLength(3);
    expect(JSON.stringify(parsed)).not.toContain('script');
  });

  it('answers 503, uncached, when the board cannot be read', async () => {
    for (const reply of [
      () => new Response('nope', { status: 500 }),
      () => jsonResponse({ message: 'not an array of rows' }),
    ]) {
      const res = await handleTop(get(), harness(reply).deps);
      expect(res.status).toBe(503);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('answers 503 when whatever went wrong was not even an Error', async () => {
    const res = await handleTop(
      get(),
      harness(() => {
        throw 'postgres said no';
      }).deps,
    );
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('postgres');
  });

  it('answers 503 when the environment is not configured, and reads nothing', async () => {
    const res = await handleTop(get(), noStore);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
  });

  it('refuses every method but GET, and says which one it wanted', async () => {
    const h = harness(() => jsonResponse(board));
    const res = await handleTop(
      new Request('https://off-the-path.test/api/top', { method: 'POST' }),
      h.deps,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
    expect(h.calls).toHaveLength(0);
  });
});
