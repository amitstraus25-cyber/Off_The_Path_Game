import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOURS, createStatsReader, handleStats, perHour, readStatsKey } from '../src/stats.ts';
import type { StatsDeps } from '../src/stats.ts';
import type { FetchLike } from '../src/store.ts';
import { CONFIG } from './fake.ts';

/*
 * GET /api/stats: the dashboard's read. Aggregates from the three views, behind its own key, and
 * never a row of the table.
 */

const KEY = 'k'.repeat(40);
const TOTALS = [{ plays_started: 12, plays_finished: 9, avg_score: 71.5, last_hour: null }];
const DAILY = [{ day: '2026-11-04', started: 12, finished: 9 }];
const FOOLED = [{ skill: 'courier', times_taken: 4 }];
const NOW = Date.parse('2026-11-04T16:20:00Z');
const ROWS = [
  { created_at: '2026-11-04T16:00:00+00:00', stage: 'start' },
  { created_at: '2026-11-04T16:00:00+00:00', stage: 'end' },
  { created_at: '2026-11-04T15:00:00+00:00', stage: 'start' },
  { created_at: '2026-11-04T15:00:00+00:00', stage: 'quit' },
];

interface Call {
  url: string;
  init: RequestInit;
}

function views(reply: (url: string) => Response = (url) => answer(url)) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(reply(url));
  };
  const deps: StatsDeps = { key: KEY, reader: createStatsReader(CONFIG, fetchImpl, () => NOW) };
  return { calls, deps };
}

const body = (rows: unknown) =>
  new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
const answer = (url: string): Response =>
  body(
    url.includes('totals')
      ? TOTALS
      : url.includes('daily')
        ? DAILY
        : url.includes('fooled')
          ? FOOLED
          : url.includes('leaderboard')
            ? [{ score: 100 }, { score: 61 }]
            : ROWS,
  );

const get = (auth?: string, method = 'GET'): Request =>
  new Request('https://off-the-path.test/api/stats', {
    method,
    headers: auth === undefined ? {} : { authorization: auth },
  });

describe('GET /api/stats', () => {
  it('answers the totals, the days and the skills that fooled people, to the key', async () => {
    const v = views();
    const res = await handleStats(get(`Bearer ${KEY}`), v.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const got = (await res.json()) as { hourly: { hour: string; started: number }[] };
    expect(got).toMatchObject({ totals: TOTALS[0], daily: DAILY, fooled: FOOLED });
    expect(got.hourly).toHaveLength(HOURS);
    expect((got as unknown as { board: unknown }).board).toEqual({ posted: 2, best: 100 });
    expect(got.hourly.at(-1)).toEqual({
      hour: '2026-11-04T16:00:00.000Z',
      started: 1,
      finished: 1,
    });
    expect(got.hourly.at(-2)).toEqual({
      hour: '2026-11-04T15:00:00.000Z',
      started: 1,
      finished: 0,
    });
    // The three views, and of the table only each row's stage and hour, for twelve hours.
    expect(v.calls.map((c) => new URL(c.url).pathname).sort()).toEqual([
      '/rest/v1/leaderboard',
      '/rest/v1/play_stats',
      '/rest/v1/play_stats_daily',
      '/rest/v1/play_stats_fooled',
      '/rest/v1/play_stats_totals',
    ]);
    const table = new URL(v.calls.find((c) => c.url.includes('play_stats?'))!.url).searchParams;
    expect(table.get('select')).toBe('created_at,stage');
    // Of the board, scores only: never a name.
    const board = new URL(v.calls.find((c) => c.url.includes('leaderboard'))!.url).searchParams;
    expect(board.get('select')).toBe('score');
    expect(table.get('created_at')).toBe(
      `gte.${new Date(Date.parse('2026-11-04T16:00:00Z') - (HOURS - 1) * 3_600_000).toISOString()}`,
    );
    for (const c of v.calls) expect(c.url).not.toContain(CONFIG.serviceRoleKey);
  });

  it('refuses a missing key, a wrong one and one of another length alike', async () => {
    const v = views();
    expect((await handleStats(get(), v.deps)).status).toBe(401);
    expect((await handleStats(get(`Bearer ${'x'.repeat(40)}`), v.deps)).status).toBe(401);
    expect((await handleStats(get(`Bearer ${KEY}x`), v.deps)).status).toBe(401);
    expect((await handleStats(get(KEY), v.deps)).status).toBe(401);
    expect(v.calls).toHaveLength(0);
  });

  it('is GET only, and 503 while it has no key or no store', async () => {
    const v = views();
    const post = await handleStats(get(`Bearer ${KEY}`, 'POST'), v.deps);
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET');
    expect((await handleStats(get(`Bearer ${KEY}`), { ...v.deps, key: null })).status).toBe(503);
    expect((await handleStats(get(`Bearer ${KEY}`), { ...v.deps, reader: null })).status).toBe(503);
  });

  it('answers 503 when a view is refused, misshapen, or the read fails outright', async () => {
    const refused = views(() => new Response('{}', { status: 500 }));
    expect((await handleStats(get(`Bearer ${KEY}`), refused.deps)).status).toBe(503);
    const odd = views((url) => (url.includes('daily') ? body([{ day: 3 }]) : answer(url)));
    expect((await handleStats(get(`Bearer ${KEY}`), odd.deps)).status).toBe(503);
    const rows = views((url) => (url.includes('play_stats?') ? body([{ hour: 1 }]) : answer(url)));
    expect((await handleStats(get(`Bearer ${KEY}`), rows.deps)).status).toBe(503);
    const noBoard = views((url) =>
      url.includes('leaderboard') ? body([{ handle: 'x' }]) : answer(url),
    );
    expect((await handleStats(get(`Bearer ${KEY}`), noBoard.deps)).status).toBe(503);
    const empty = views((url) => (url.includes('leaderboard') ? body([]) : answer(url)));
    const none = (await (await handleStats(get(`Bearer ${KEY}`), empty.deps)).json()) as {
      board: unknown;
    };
    expect(none.board).toEqual({ posted: 0, best: null });
    const gone: StatsDeps = { key: KEY, reader: { read: () => Promise.reject('gone') } };
    expect((await handleStats(get(`Bearer ${KEY}`), gone)).status).toBe(503);
  });

  it('counts per hour only the twelve hours it shows, and only starts and ends', () => {
    const hours = perHour(
      [...ROWS, { created_at: '2026-10-03T16:00:00+00:00', stage: 'start' }],
      NOW,
    );
    expect(hours.reduce((n, h) => n + h.started, 0)).toBe(2);
    expect(hours.reduce((n, h) => n + h.finished, 0)).toBe(1);
    expect(hours[0]!.hour).toBe(
      new Date(Date.parse('2026-11-04T16:00:00Z') - (HOURS - 1) * 3_600_000).toISOString(),
    );
  });

  it('reads its key from OTP_STATS_KEY, and only one long enough to be a key', () => {
    expect(readStatsKey({ OTP_STATS_KEY: ` ${KEY} ` })).toBe(KEY);
    expect(readStatsKey({ OTP_STATS_KEY: 'short' })).toBeNull();
    expect(readStatsKey({})).toBeNull();
  });
});

describe('the stats route as Vercel invokes it', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is 503 while it is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('OTP_STATS_KEY', '');
    const route = (await import('../api/stats.ts')).default.fetch;
    expect((await route(get(`Bearer ${KEY}`))).status).toBe(503);
  });
});
