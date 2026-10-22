import { describe, expect, it, vi } from 'vitest';
import { MAX_LOG_EVENTS, v2 } from '@otp/core';
import { CLOCK_SKEW_MS, MIN_RUN_MS, POST_WINDOW_MS, handleScore } from '../src/handlers.ts';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';
import { createRunTokens, signingKey } from '../src/token.ts';
import { CONFIG, T0, TOKENS, harness, noStore, postChunked, postScore, ticketed } from './fake.ts';
import type { Call, Clock } from './fake.ts';
import { createStore } from '../src/store.ts';
import { claimedMs, content, runOf } from './helpers.ts';

/*
 * POST /api/score is the security boundary, so it is tested as one.
 *
 * CLAUDE.md golden rule 6: "Never trust the client for leaderboard scores. The server recomputes
 * the score from the run log using the same packages/core scoring function." The first tests below
 * are that sentence. Then the token -- the server's seed and the server's clock -- and then the
 * hostile bodies: a forged log, an unfinished or late run, a handle we never minted, a flood of
 * events, a megabyte of JSON, and a smuggled score field.
 */

const HANDLE = 'brave-lantern-42';

/** The score core's own `result()` gives a log, replayed. */
const scoreOf = (log: v2.RunLog): number => {
  const replay = v2.checkRunLog(log, content);
  if (!replay.legal) throw new Error(replay.reason);
  return v2.result(replay.state, content).total;
};

describe('the score the board stores', () => {
  it('is recomputed from the log, by the same function the results screen used', async () => {
    const h = harness();
    const run = ticketed(h.clock);

    const res = await handleScore(postScore(run), h.deps);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: HANDLE, score: 100 });
    // The row that reached the table carries that number and nothing else.
    expect(h.written()).toEqual({ handle: HANDLE, score: scoreOf(run.log) });
  });

  it('cannot be claimed: a body carrying a score is refused outright, and nothing is stored', async () => {
    const h = harness();
    const run = ticketed(h.clock, { strategy: 'leave-all' });

    const res = await handleScore(postScore({ ...run, score: 999999 }), h.deps);

    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
    // And the same run without the claim stores the recomputed figure, not the claimed one.
    await handleScore(postScore(run), h.deps);
    expect(h.written()?.score).toBe(10);
  });

  it('stores a wolf run at zero: it finished, and the board says what it did', async () => {
    const h = harness();
    const res = await handleScore(postScore(ticketed(h.clock, { strategy: 'greedy' })), h.deps);
    expect(res.status).toBe(200);
    expect(h.written()?.score).toBe(0);
  });

  it('does not post a late run at all', async () => {
    // Ended, but not finished: the clock ran out on the way (core scoring.ts, "the board reads
    // the ending"). Played honestly at thirty seconds a walk, so the reducer itself ended it.
    const h = harness();
    const { seed, token } = TOKENS.issue(h.clock.now);
    const log = v2.toRunLog(runOf('careful', seed, { walkMs: 30_000, talkMs: 1000 }));
    expect(log.events.at(-1)?.e).toBe('late');
    h.clock.now += claimedMs(log) + 10_000;

    const res = await handleScore(postScore({ handle: HANDLE, log, token }), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'a late run is not posted' });
    expect(h.calls).toHaveLength(0);
  });

  it('is not stored at all for a run that never reached the cottage', async () => {
    const h = harness();
    const run = ticketed(h.clock);
    const unfinished = { ...run, log: { ...run.log, events: run.log.events.slice(0, -1) } };

    const res = await handleScore(postScore(unfinished), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run has not reached the cottage' });
    expect(h.calls).toHaveLength(0);
  });

  it('is not stored for a log the reducer will not replay', async () => {
    const h = harness();
    const run = ticketed(h.clock);
    const forged = { ...run, log: { ...run.log, events: [...run.log.events].reverse() } };

    const res = await handleScore(postScore(forged), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    expect(h.calls).toHaveLength(0);
  });

  it('is not stored under a handle the game did not mint', async () => {
    for (const handle of ['wolfspotter', 'cyera-admin-42', '<script>alert(1)</script>', '']) {
      const h = harness();
      const res = await handleScore(postScore(ticketed(h.clock, { handle })), h.deps);
      expect(res.status, handle).toBe(400);
      expect(h.calls).toHaveLength(0);
    }
  });

  it('never scores a v1 log, a bare array of events, as a v2 run', async () => {
    const h = harness();
    const run = ticketed(h.clock);
    const res = await handleScore(postScore({ ...run, log: run.log.events }), h.deps);
    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });
});

describe('the run token', () => {
  it('is required: a body without one is not a submission', async () => {
    const h = harness();
    const { handle, log } = ticketed(h.clock);
    const res = await handleScore(postScore({ handle, log }), h.deps);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that submission is not valid' });
  });

  it('must be one this service signed', async () => {
    // Same shape, same seed, a different key: what a forger who read src/token.ts can make.
    const h = harness();
    const forger = createRunTokens(signingKey('a-guessed-key'));
    const { seed, token } = forger.issue(h.clock.now);
    const log = v2.toRunLog(runOf('careful', seed));
    h.clock.now += claimedMs(log) + 1000;

    const res = await handleScore(postScore({ handle: HANDLE, log, token }), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    expect(h.calls).toHaveLength(0);
  });

  it('decides the deal: a log dealt from any other seed is refused', async () => {
    /*
     * The hole this whole route closes. Before the token, a forger could take any basket of three
     * and post the one seed whose deal makes it careful. Now the seed is the server's: the same
     * careful play, dealt from a different number, is not this run.
     */
    const h = harness();
    const run = ticketed(h.clock);
    const other = (run.log.seed + 1) % 2 ** 32;
    const elsewhere = v2.toRunLog(runOf('careful', other));

    const res = await handleScore(postScore({ ...run, log: elsewhere }), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    expect(h.calls).toHaveLength(0);
  });

  it('is single use: one token is one row, whatever log or handle comes with it again', async () => {
    const instance = { recent: createRecentRuns(), clock: { now: T0 } };
    const first = harness(undefined, instance);
    const run = ticketed(instance.clock);
    // A different legal log for the same seed: the cheap way to try one token many times.
    const greedy = { ...run, log: v2.toRunLog(runOf('greedy', run.log.seed)) };

    expect((await handleScore(postScore(run), first.deps)).status).toBe(200);
    const again = harness(undefined, instance);
    const second = await handleScore(postScore(run), again.deps);
    const third = await handleScore(
      postScore({ ...greedy, handle: 'quiet-thicket-11' }),
      again.deps,
    );

    expect(second.status).toBe(409);
    expect(third.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ error: 'that run is already on the board' });
    expect(first.calls).toHaveLength(1);
    expect(again.calls).toHaveLength(0);
  });

  it('lets a run be posted again when the table, not the player, was the problem', async () => {
    // A reservation is released when no row results, so the retry after a 503 is a 200 and not
    // "already on the board".
    const instance = { recent: createRecentRuns(), clock: { now: T0 } };
    const failed = harness(() => new Response('', { status: 503 }), instance);
    const run = ticketed(instance.clock);
    const retry = harness(undefined, instance);

    expect((await handleScore(postScore(run), failed.deps)).status).toBe(503);
    expect((await handleScore(postScore(run), retry.deps)).status).toBe(200);
    expect(retry.written()).toEqual({ handle: HANDLE, score: 100 });
  });

  it('lets a run be posted again when the budget, not the player, shed it', async () => {
    // The 429 made no row either: the token must not be spent by a write that never happened.
    const instance = { recent: createRecentRuns(), clock: { now: T0 } };
    const shed = harness(undefined, { ...instance, budget: createWriteBudget(0, 60_000, () => 0) });
    const run = ticketed(instance.clock);
    const retry = harness(undefined, instance);

    expect((await handleScore(postScore(run), shed.deps)).status).toBe(429);
    expect((await handleScore(postScore(run), retry.deps)).status).toBe(200);
  });

  /** A table that answers `status` only when the test lets it, so two posts can overlap for sure. */
  function gatedTable(status: number): {
    store: ReturnType<typeof createStore>;
    calls: Call[];
    open: () => void;
  } {
    let open = (): void => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const calls: Call[] = [];
    const store = createStore(CONFIG, async (url, init) => {
      calls.push({ url, init });
      await gate;
      return new Response(null, { status });
    });
    return { store, calls, open: () => open() };
  }

  it('is single use even when two posts of one token are in flight at once', async () => {
    /*
     * THE RACE. The insert is an await, and the token used to be checked before it and recorded
     * after it, so a second request that arrived while the first insert was still pending found
     * nothing recorded and wrote a second row. The table here answers only when the test lets it,
     * so the second request is provably made while the first is still waiting on it.
     */
    const instance = { recent: createRecentRuns(), clock: { now: T0 } };
    const run = ticketed(instance.clock);
    const { deps } = harness(undefined, instance);
    const table = gatedTable(201);

    const first = handleScore(postScore(run), { ...deps, store: table.store });
    // Let the first reach the table before the second is sent.
    await vi.waitFor(() => expect(table.calls).toHaveLength(1));
    const second = await handleScore(postScore({ ...run, handle: 'quiet-thicket-11' }), {
      ...deps,
      store: table.store,
    });

    expect(second.status).toBe(409);
    expect(table.calls).toHaveLength(1);
    table.open();
    expect((await first).status).toBe(200);
    expect(table.calls).toHaveLength(1);
  });

  it('releases the token when the insert it was waiting on fails, so the retry gets through', async () => {
    const instance = { recent: createRecentRuns(), clock: { now: T0 } };
    const run = ticketed(instance.clock);
    const { deps } = harness(undefined, instance);
    const table = gatedTable(503);

    const first = handleScore(postScore(run), { ...deps, store: table.store });
    await vi.waitFor(() => expect(table.calls).toHaveLength(1));
    // Turned away while the first holds it...
    expect((await handleScore(postScore(run), { ...deps, store: table.store })).status).toBe(409);
    table.open();
    expect((await first).status).toBe(503);
    // ...and let through once the first has failed and given it back.
    const retry = harness(undefined, instance);
    expect((await handleScore(postScore(run), retry.deps)).status).toBe(200);
  });
});

describe('the clock the player does not control', () => {
  /** Posts a careful run whose token was issued `seenMs` before the post. */
  async function postSeen(seenMs: (claimed: number) => number): Promise<Response> {
    const clock: Clock = { now: T0 };
    const h = harness(undefined, { clock });
    const run = ticketed(clock, { postAfterMs: 0 });
    const claimed = claimedMs(run.log);
    clock.now = T0 + seenMs(claimed);
    return handleScore(postScore(run), h.deps);
  }

  it('refuses a log that claims more time than its token has existed', async () => {
    // The 0ms-forgery's mirror: a run cannot have lasted longer than the server has known about it.
    const res = await postSeen((claimed) => claimed - CLOCK_SKEW_MS - 1);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    expect((await postSeen((claimed) => claimed - CLOCK_SKEW_MS)).status).toBe(200);
  });

  it('closes the post once the run has been off the clock longer than the window', async () => {
    // The bound on restamping a slow run, and the token's lifetime: claimed < 3:00, so no token
    // older than 3:00 plus the window can pass it.
    expect((await postSeen((claimed) => claimed + POST_WINDOW_MS)).status).toBe(200);
    const late = await postSeen((claimed) => claimed + POST_WINDOW_MS + 1);
    expect(late.status).toBe(410);
    await expect(late.json()).resolves.toEqual({ error: 'posting has closed for that run' });
  });

  /** A careful run with every stamp scaled so it claims `claimed` ms, posted `seen` ms after its token. */
  async function postTimed(claimed: number, seen: number): Promise<Response> {
    const clock: Clock = { now: T0 };
    const h = harness(undefined, { clock });
    const run = ticketed(clock, { postAfterMs: 0 });
    const last = claimedMs(run.log);
    const events = run.log.events.map((e) => ({ ...e, at: Math.round((e.at * claimed) / last) }));
    clock.now = T0 + seen;
    return handleScore(postScore({ ...run, log: { ...run.log, events } }), h.deps);
  }

  it('refuses the scripted 100: a careful log for the seed, claiming 15 ms, posted at once', async () => {
    // The seed is the server's but deal() is public, so this log replays as legal and scores 100.
    // Without a floor it was a row, and ties rank earliest first.
    const res = await postTimed(15, 15);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    // A log that claims less than the shortest walk is refused however long the poster waited.
    expect((await postTimed(MIN_RUN_MS - 1, 60_000)).status).toBe(400);
  });

  it('refuses a run the server has not known for as long as the shortest walk, whatever the log says', async () => {
    // Inside the skew allowance, so only the floor on `seen` catches it: the wait a forger must pay.
    expect((await postTimed(MIN_RUN_MS, MIN_RUN_MS - 1)).status).toBe(400);
    expect((await postTimed(MIN_RUN_MS, MIN_RUN_MS)).status).toBe(200);
  });

  it('refuses a fast log restamped onto a token that has sat for ten minutes', async () => {
    // The forgery the token exists for: every event at 0ms, posted long after the token was issued.
    const clock: Clock = { now: T0 };
    const h = harness(undefined, { clock });
    const run = ticketed(clock);
    const zero = { ...run.log, events: run.log.events.map((e) => ({ ...e, at: 0 })) };
    clock.now = T0 + 10 * 60_000;

    const res = await handleScore(postScore({ ...run, log: zero }), h.deps);
    expect(res.status).toBe(410);
    expect(h.calls).toHaveLength(0);
  });
});

describe('the bodies a hostile caller sends', () => {
  it('refuses a flood of events before replaying any of them', async () => {
    const h = harness();
    const run = ticketed(h.clock);
    const events = Array.from(
      { length: MAX_LOG_EVENTS + 1 },
      (_, i) => run.log.events[i % run.log.events.length]!,
    );

    const res = await handleScore(postScore({ ...run, log: { ...run.log, events } }), h.deps);

    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses a body too large to be a run', async () => {
    const h = harness();
    const res = await handleScore(
      postScore(`{"handle":"${HANDLE}","log":"${'x'.repeat(40000)}"}`),
      h.deps,
    );
    expect(res.status).toBe(413);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses one that declares no length and arrives in pieces', async () => {
    /*
     * `content-length` is advisory and absent on a chunked body, so a caller who simply omits it
     * used to have the whole thing buffered before anything measured it. The cap now meters the
     * read: these 40 KB are refused somewhere around the 32nd, with nothing held after that.
     */
    const h = harness();
    const chunks = [
      `{"handle":"${HANDLE}","log":"`,
      ...Array.from({ length: 40 }, () => 'x'.repeat(1000)),
      '"}',
    ];
    const request = postChunked(chunks);

    expect(request.headers.get('content-length')).toBeNull();
    const res = await handleScore(request, h.deps);

    expect(res.status).toBe(413);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses one that declares itself too large without reading a byte of it', async () => {
    const h = harness();
    const res = await handleScore(
      new Request('https://off-the-path.test/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '999999' },
        body: JSON.stringify(ticketed(h.clock)),
      }),
      h.deps,
    );
    expect(res.status).toBe(413);
    expect(h.calls).toHaveLength(0);
  });

  it('still measures a body a runtime hands over already buffered', async () => {
    /*
     * `request.body` is a stream on Node and on Vercel, but a runtime is allowed to buffer for us
     * and hand back null, and then the metered read has nothing to meter. Both paths cap: this is
     * that second shape, which no real Request in this suite produces.
     */
    const buffered = (raw: string): Request =>
      ({
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: null,
        text: () => Promise.resolve(raw),
      }) as unknown as Request;

    const honest = harness();
    const good = await handleScore(buffered(JSON.stringify(ticketed(honest.clock))), honest.deps);
    expect(good.status).toBe(200);

    const hostile = harness();
    const big = await handleScore(buffered(`{"log":"${'é'.repeat(20000)}"}`), hostile.deps);
    expect(big.status).toBe(413);
    expect(hostile.calls).toHaveLength(0);
  });

  it('counts bytes, not UTF-16 units, so multibyte characters buy no extra room', async () => {
    // 20,000 two-byte characters: 20,030 units and over 40 KB on the wire. A length check in
    // `raw.length` waved this through at up to four times the budget it was supposed to enforce.
    const h = harness();
    const padded = `{"handle":"${HANDLE}","log":"${'é'.repeat(20000)}"}`;

    expect(padded.length).toBeLessThan(32 * 1024);
    expect(new TextEncoder().encode(padded).length).toBeGreaterThan(32 * 1024);
    const res = await handleScore(postScore(padded), h.deps);

    expect(res.status).toBe(413);
    expect(h.calls).toHaveLength(0);
  });

  it('refuses a body that is not JSON, and a request that does not say it is', async () => {
    const h = harness();
    await expect(handleScore(postScore('{nope'), h.deps).then((r) => r.status)).resolves.toBe(400);
    await expect(
      handleScore(postScore(ticketed(h.clock), 'text/plain'), h.deps).then((r) => r.status),
    ).resolves.toBe(415);
    // No content-type at all is the same answer as the wrong one.
    await expect(
      handleScore(new Request('https://off-the-path.test/api/score', { method: 'POST' }), h.deps),
    ).resolves.toMatchObject({ status: 415 });
    expect(h.calls).toHaveLength(0);
  });

  it('refuses a request a browser marks as coming from another site', async () => {
    const h = harness();
    const run = ticketed(h.clock);
    const from = (site: string): Request =>
      new Request('https://off-the-path.test/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': site },
        body: JSON.stringify(run),
      });

    for (const site of ['cross-site', 'same-site']) {
      const res = await handleScore(from(site), h.deps);
      expect(res.status, site).toBe(403);
    }
    expect(h.calls).toHaveLength(0);
    // The game's own request, from its own document -- including inside the cyera.com iframe.
    expect((await handleScore(from('same-origin'), h.deps)).status).toBe(200);
  });

  it('refuses every method but POST, and says which one it wanted', async () => {
    const h = harness();
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await handleScore(
        new Request('https://off-the-path.test/api/score', { method }),
        h.deps,
      );
      expect(res.status, method).toBe(405);
      // Stated rather than implied: the 405 to OPTIONS is also what fails a cross-origin preflight.
      expect(res.headers.get('allow'), method).toBe('POST');
    }
    expect(h.calls).toHaveLength(0);
  });

  it('tells a caller nothing it could tune a forgery against', async () => {
    const h = harness();
    const res = await handleScore(postScore({ handle: HANDLE, log: [{ t: 'nope' }] }), h.deps);
    const text = await res.text();

    expect(res.status).toBe(400);
    // No zod path, no field name, no count: the schema is not published one 400 at a time.
    expect(text).toBe(JSON.stringify({ error: 'that submission is not valid' }));
  });
});

describe('a caller with a for-loop', () => {
  it('stops writing at all once the instance has spent its budget', async () => {
    // Three DIFFERENT tokens, so it is the budget refusing and not the single-use check.
    const instance = {
      budget: createWriteBudget(2, 60_000, () => 0),
      recent: createRecentRuns(),
      clock: { now: T0 },
    };
    const seen: { status: number; wrote: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const h = harness(undefined, instance);
      const res = await handleScore(postScore(ticketed(instance.clock)), h.deps);
      seen.push({ status: res.status, wrote: h.calls.length });
    }

    expect(seen).toEqual([
      { status: 200, wrote: 1 },
      { status: 200, wrote: 1 },
      { status: 429, wrote: 0 },
    ]);
  });

  it('tells a shed write to come back later without naming a reason', async () => {
    const h = harness(undefined, { budget: createWriteBudget(0, 60_000, () => 0) });
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    await expect(res.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
    expect(h.calls).toHaveLength(0);
  });
});

describe('when the board is not there', () => {
  it('answers 503 for a perfectly good run rather than losing it quietly', async () => {
    const res = await handleScore(postScore(ticketed({ now: T0 })), noStore);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
  });

  it('answers 503 when the table refuses the insert, and leaks nothing about why', async () => {
    const h = harness(
      () => new Response('{"message":"permission denied for table leaderboard"}', { status: 401 }),
    );
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(text).not.toContain('permission denied');
    expect(text).not.toContain(CONFIG.serviceRoleKey);
    expect(text).not.toContain('supabase');
  });

  it('answers 503 when the request to the table never comes back', async () => {
    const h = harness(() => {
      throw new Error('ECONNRESET');
    });
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('ECONNRESET');
  });

  it('answers 503 when whatever went wrong was not even an Error', async () => {
    // A thrown string has no `.message`; the log line must not become "undefined" and the caller
    // must still get the one sentence it gets for everything else.
    const h = harness(() => {
      throw 'postgres said no';
    });
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('postgres');
  });
});

describe('the response headers', () => {
  it('are JSON, never cached, and never sniffed', async () => {
    const h = harness();
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
