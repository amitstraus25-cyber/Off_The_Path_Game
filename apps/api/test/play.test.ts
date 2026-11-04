import { afterEach, describe, expect, it, vi } from 'vitest';
import { v2 } from '@otp/core';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';
import type { WriteBudget } from '../src/limit.ts';
import { POST_WINDOW_MS } from '../src/handlers.ts';
import { DURATION_STEP_MS, PLAY_WINDOW_MS, createPlayStore, handlePlay } from '../src/plays.ts';
import type { PlayDeps, PlayRow } from '../src/plays.ts';
import type { FetchLike } from '../src/store.ts';
import { CONFIG, T0, TOKENS, created } from './fake.ts';
import { claimedMs, content, runOf } from './helpers.ts';

/*
 * POST /api/play: the anonymous play stats. Every count stored is the server's own replay of the
 * run's log, and nothing about the player is: no name, no address, no token, no run id.
 */

interface Call {
  url: string;
  init: RequestInit;
}

function harness(reply: () => Response | Promise<Response> = created, budget?: WriteBudget) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(reply());
  };
  const clock = { now: T0 };
  const deps: PlayDeps = {
    content,
    plays: createPlayStore(CONFIG, fetchImpl),
    tokens: TOKENS,
    budget: budget ?? createWriteBudget(),
    recent: createRecentRuns(),
    now: () => clock.now,
  };
  const rows = (): PlayRow[] => calls.flatMap((c) => JSON.parse(String(c.init.body)) as PlayRow[]);
  return { calls, clock, deps, rows };
}

const post = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://off-the-path.test/api/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const where = { device: 'desktop', embedded: true } as const;

/** A token issued at T0 and the careful run dealt from its seed, posted `after` ms past its end. */
function careful() {
  const { seed, token } = TOKENS.issue(T0);
  const state = runOf('careful', seed);
  const log = v2.toRunLog(state);
  return { seed, token, state, log, ends: T0 + claimedMs(log) };
}

describe('POST /api/play', () => {
  it('counts a start: the device and the embed, and nothing else', async () => {
    const h = harness();
    const { token } = TOKENS.issue(T0);
    const res = await handlePlay(post({ stage: 'start', token, ...where }), h.deps);
    expect(res.status).toBe(201);
    expect(h.rows()).toEqual([
      {
        stage: 'start',
        device: 'desktop',
        embedded: true,
        ending: null,
        duration_ms: null,
        met: null,
        opened: null,
        left_count: null,
        taken_good: null,
        taken_bad: null,
        score: null,
      },
    ]);
    // The token is never stored, and the key travels in headers only.
    expect(JSON.stringify(h.rows())).not.toContain(token);
    expect(h.calls[0]!.url).toBe(`${CONFIG.url}/rest/v1/play_stats`);
    expect(h.calls[0]!.init.headers).toMatchObject({
      apikey: CONFIG.serviceRoleKey,
      authorization: `Bearer ${CONFIG.serviceRoleKey}`,
      prefer: 'return=minimal',
    });
  });

  it("counts an end with the replay's own summary", async () => {
    const h = harness();
    const run = careful();
    h.clock.now = run.ends + 1000;
    const res = await handlePlay(
      post({ stage: 'end', token: run.token, log: run.log, device: 'phone', embedded: false }),
      h.deps,
    );
    expect(res.status).toBe(201);
    const s = v2.playSummary(run.state, content);
    expect(h.rows()).toEqual([
      {
        stage: 'end',
        device: 'phone',
        embedded: false,
        ending: 'grandma',
        duration_ms: Math.round(s.durationMs / DURATION_STEP_MS) * DURATION_STEP_MS,
        met: s.met,
        opened: s.opened,
        left_count: s.left,
        taken_good: s.takenGood,
        taken_bad: s.takenBad,
        score: 100,
      },
    ]);
  });

  it('counts a quit from the part of the run that was played', async () => {
    const h = harness();
    const run = careful();
    const log = { ...run.log, events: run.log.events.slice(0, 3) };
    h.clock.now = T0 + claimedMs(log) + 1000;
    const res = await handlePlay(post({ stage: 'quit', token: run.token, log, ...where }), h.deps);
    expect(res.status).toBe(201);
    expect(h.rows()[0]).toMatchObject({ stage: 'quit', ending: 'quit', score: null });
  });

  it('takes one start and one summary per run', async () => {
    const h = harness();
    const run = careful();
    h.clock.now = run.ends + 1000;
    const start = { stage: 'start', token: run.token, ...where };
    const end = { stage: 'end', token: run.token, log: run.log, ...where };
    const quit = { ...end, stage: 'quit', log: { ...run.log, events: run.log.events.slice(0, 2) } };
    expect((await handlePlay(post(start), h.deps)).status).toBe(201);
    expect((await handlePlay(post(start), h.deps)).status).toBe(409);
    expect((await handlePlay(post(end), h.deps)).status).toBe(201);
    // A quit after the end is the same run, summed up already.
    expect((await handlePlay(post(quit), h.deps)).status).toBe(409);
    expect(h.rows().map((r) => r.stage)).toEqual(['start', 'end']);
  });

  it('refuses a note whose log the replay does not bear out', async () => {
    const h = harness();
    const run = careful();
    h.clock.now = run.ends + 1000;
    const send = (body: object) =>
      handlePlay(post({ token: run.token, ...where, ...body }), h.deps).then((r) => r.status);
    const other = { ...run.log, seed: (run.seed + 1) % v2.SEED_LIMIT };
    const forged = { ...run.log, events: [...run.log.events].reverse() };
    const partial = { ...run.log, events: run.log.events.slice(0, 3) };
    expect(await send({ stage: 'end', log: other })).toBe(400);
    expect(await send({ stage: 'end', log: forged })).toBe(400);
    expect(await send({ stage: 'end', log: partial })).toBe(400);
    expect(await send({ stage: 'quit', log: run.log })).toBe(400);
    h.clock.now = T0;
    expect(await send({ stage: 'end', log: run.log })).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses a log faster than the map, and an end the clock does not bear out', async () => {
    const h = harness();
    const run = careful();
    const send = (stage: string, log: v2.RunLog) =>
      handlePlay(post({ stage, token: run.token, log, ...where }), h.deps).then((r) => r.status);
    // Every leg in 10 ms: it replays, but no one walks the forest that fast.
    const quick = { ...run.log, events: run.log.events.map((e, i) => ({ ...e, at: i * 10 })) };
    h.clock.now = run.ends + 1000;
    expect(await send('end', quick)).toBe(400);
    expect(await send('quit', { ...quick, events: quick.events.slice(0, 3) })).toBe(400);
    // An honest end, sent long after the run ended: not the moment it ended.
    h.clock.now = run.ends + POST_WINDOW_MS + 10_000;
    expect(await send('end', run.log)).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses an end the server has not known for as long as the walk it describes', async () => {
    const h = harness();
    const run = careful();
    // Restamped to its own floor plus a second a step, then sent inside the skew but under the floor.
    let at = 0;
    const events = run.log.events.map((e, i) => {
      if (e.e === 'met' || e.e === 'arrived')
        at = Math.max(at, v2.walkFloor(content, run.log.events.slice(0, i + 1)).floorMs + 1000);
      return { ...e, at: Math.ceil(at) };
    });
    const log = { ...run.log, events };
    const { floorMs } = v2.walkFloor(content, events);
    h.clock.now = T0 + floorMs - 1;
    const early = await handlePlay(post({ stage: 'end', token: run.token, log, ...where }), h.deps);
    expect(early.status).toBe(400);
    h.clock.now = T0 + claimedMs(log) + 1000;
    const fine = await handlePlay(post({ stage: 'end', token: run.token, log, ...where }), h.deps);
    expect(fine.status).toBe(201);
  });

  it('refuses a token it did not sign, and one too old to be a run', async () => {
    const h = harness();
    const { token } = TOKENS.issue(T0);
    const bad = await handlePlay(post({ stage: 'start', token: 'a.b', ...where }), h.deps);
    expect(bad.status).toBe(400);
    h.clock.now = T0 + PLAY_WINDOW_MS + 1;
    const old = await handlePlay(post({ stage: 'start', token, ...where }), h.deps);
    expect(old.status).toBe(410);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses anything that is not a same-origin JSON note of the right shape', async () => {
    const h = harness();
    const { token } = TOKENS.issue(T0);
    const ok = { stage: 'start', token, ...where };
    const get = new Request('https://off-the-path.test/api/play');
    const status = async (r: Request) => (await handlePlay(r, h.deps)).status;
    expect(await status(get)).toBe(405);
    expect((await handlePlay(get, h.deps)).headers.get('allow')).toBe('POST');
    expect(await status(post(ok, { 'sec-fetch-site': 'cross-site' }))).toBe(403);
    expect(await status(post(ok, { 'content-type': 'text/plain' }))).toBe(415);
    expect(await status(post('x'.repeat(40 * 1024)))).toBe(413);
    expect(await status(post('{not json'))).toBe(400);
    // A count the browser offers is not a count: unknown keys are refused.
    expect(await status(post({ ...ok, met: 7 }))).toBe(400);
    expect(await status(post({ ...ok, device: 'tablet' }))).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it('answers 503 and stores nothing when it is not configured', async () => {
    const h = harness();
    const { token } = TOKENS.issue(T0);
    const note = { stage: 'start', token, ...where };
    expect((await handlePlay(post(note), { ...h.deps, plays: null })).status).toBe(503);
    expect((await handlePlay(post(note), { ...h.deps, tokens: null })).status).toBe(503);
  });

  it('sheds a note over budget, and gives the run back for a retry', async () => {
    let open = false;
    const h = harness(created, { take: () => open });
    const { token } = TOKENS.issue(T0);
    const note = { stage: 'start', token, ...where };
    const shed = await handlePlay(post(note), h.deps);
    expect(shed.status).toBe(429);
    expect(shed.headers.get('retry-after')).toBe('60');
    open = true;
    expect((await handlePlay(post(note), h.deps)).status).toBe(201);
  });

  it('answers 503 when the table refuses, and the run can be counted again', async () => {
    let refuse = true;
    const h = harness(() => (refuse ? new Response('{}', { status: 500 }) : created()));
    const { token } = TOKENS.issue(T0);
    const note = { stage: 'start', token, ...where };
    expect((await handlePlay(post(note), h.deps)).status).toBe(503);
    refuse = false;
    expect((await handlePlay(post(note), h.deps)).status).toBe(201);
  });

  it('answers 503 for a failure that is not even an Error', async () => {
    const h = harness();
    const { token } = TOKENS.issue(T0);
    const deps: PlayDeps = { ...h.deps, plays: { add: () => Promise.reject('gone') } };
    expect((await handlePlay(post({ stage: 'start', token, ...where }), deps)).status).toBe(503);
  });
});

describe('the play route as Vercel invokes it', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('answers GET with its own 405, and 503 while it is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const route = (await import('../api/play.ts')).default.fetch;
    const get = await route(new Request('https://off-the-path.test/api/play'));
    expect(get.status).toBe(405);
    const { token } = TOKENS.issue(Date.now());
    const res = await route(post({ stage: 'start', token, ...where }));
    expect(res.status).toBe(503);
  });
});
