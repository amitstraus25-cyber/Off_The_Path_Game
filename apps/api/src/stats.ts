import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { StoreConfig } from './env.ts';
import { fail, json, note } from './http.ts';
import type { FetchLike } from './store.ts';

/*
 * GET /api/stats -- THE DASHBOARD'S READ (the client, 2026-11-04). The play stats in aggregate,
 * read from the three views migration 0009 makes: the totals, plays per day, and which malicious
 * skills were taken most. Never a row of `public.play_stats`.
 *
 * PRIVATE. It answers only a caller holding `OTP_STATS_KEY` (a Vercel variable, 32+ characters,
 * separate from the database key): `authorization: Bearer <key>`. That key reads these totals and
 * nothing else, so the scheduled job that fills the dashboard holds it and never the database key.
 * Unset, the route is 503; a wrong or missing key is 401, and which of the two is not said.
 */

const VIEWS = {
  totals: '/rest/v1/play_stats_totals',
  daily: '/rest/v1/play_stats_daily?order=day.asc',
  fooled: '/rest/v1/play_stats_fooled?order=times_taken.desc',
} as const;
const TIMEOUT_MS = 4000;
/** The shortest key worth the name: 32 characters of `openssl rand -base64 32` is 256 bits. */
export const MIN_KEY_CHARS = 32;

/** The key, or null when it is unset or too short to be one. Never logged. */
export function readStatsKey(env: Record<string, string | undefined>): string | null {
  const key = env['OTP_STATS_KEY']?.trim();
  return key && key.length >= MIN_KEY_CHARS ? key : null;
}

const cell = z.union([z.number(), z.string(), z.null()]);
const totalsSchema = z.array(z.record(z.string(), cell)).length(1);
const dailySchema = z.array(
  z.object({ day: z.string(), started: z.number(), finished: z.number() }),
);
const fooledSchema = z.array(z.object({ skill: z.string(), times_taken: z.number() }));

export interface Stats {
  totals: Record<string, number | string | null>;
  daily: z.infer<typeof dailySchema>;
  fooled: z.infer<typeof fooledSchema>;
}

export interface StatsReader {
  read(): Promise<Stats>;
}

export function createStatsReader(config: StoreConfig, fetchImpl: FetchLike): StatsReader {
  const get = async (path: string): Promise<unknown> => {
    const res = await fetchImpl(`${config.url}${path}`, {
      method: 'GET',
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`stats read refused with ${res.status}`);
    return res.json() as Promise<unknown>;
  };
  return {
    async read() {
      const [totals, daily, fooled] = await Promise.all([
        get(VIEWS.totals),
        get(VIEWS.daily),
        get(VIEWS.fooled),
      ]);
      const t = totalsSchema.safeParse(totals);
      const d = dailySchema.safeParse(daily);
      const f = fooledSchema.safeParse(fooled);
      if (!t.success || !d.success || !f.success)
        throw new Error('the stats came back in a shape they have never had');
      return { totals: t.data[0]!, daily: d.data, fooled: f.data };
    },
  };
}

export interface StatsDeps {
  key: string | null;
  reader: StatsReader | null;
}

/** Equal keys, compared in constant time. A length mismatch is answered without comparing. */
const sameKey = (given: string, key: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function handleStats(request: Request, deps: StatsDeps): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'method not allowed', { allow: 'GET' });
  if (!deps.key || !deps.reader) return fail(503, 'the stats are unavailable');
  const given = /^Bearer (.+)$/u.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
  if (!sameKey(given, deps.key)) return fail(401, 'not allowed');
  try {
    return json(await deps.reader.read());
  } catch (err) {
    note(`stats: could not read: ${err instanceof Error ? err.message : 'unknown error'}`);
    return fail(503, 'the stats are unavailable');
  }
}
