import { describe, expect, it } from 'vitest';
import { MAX_LOG_EVENTS, score } from '@otp/core';
import type { RunEvent } from '@otp/core';
import { handleScore } from '../src/handlers.ts';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';
import { CONFIG, harness, noStore, postChunked, postScore } from './fake.ts';
import { carefulRun, content } from './helpers.ts';

/*
 * POST /api/score is the security boundary, so it is tested as one.
 *
 * CLAUDE.md golden rule 6: "Never trust the client for leaderboard scores. The server recomputes
 * the score from the run log using the same packages/core scoring function." The first two tests
 * below are that sentence. The rest are the hostile bodies: a forged log, an unfinished run, a
 * handle we never minted, a flood of events, a megabyte of JSON, and a smuggled score field.
 */

const HANDLE = 'brave-lantern-42';
const body = (log: RunEvent[], handle = HANDLE): { handle: string; log: RunEvent[] } => ({
  handle,
  log,
});

describe('the score the board stores', () => {
  it('is recomputed from the log, by the same function the results screen used', async () => {
    const run = carefulRun();
    const expected = score(run.log, content).total;
    const h = harness();

    const res = await handleScore(postScore(body(run.log)), h.deps);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ handle: HANDLE, score: expected });
    // The row that reached the table carries that number and nothing else.
    expect(h.written()).toEqual({ handle: HANDLE, score: expected });
    expect(expected).toBeGreaterThan(0);
  });

  it('cannot be claimed: a body carrying a score is refused outright, and nothing is stored', async () => {
    const run = carefulRun();
    const honest = score(run.log, content).total;
    const h = harness();

    const res = await handleScore(postScore({ ...body(run.log), score: 999999 }), h.deps);

    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
    // And the same run without the claim stores the recomputed figure, not the claimed one.
    const fair = harness();
    await handleScore(postScore(body(run.log)), fair.deps);
    expect(fair.written()?.score).toBe(honest);
    expect(fair.written()?.score).not.toBe(999999);
  });

  it('is not raised by a log that claims a careful verdict on a card it never opened', async () => {
    /*
     * The highest-scoring verdicts are worth their points only when the card was read. Strip the
     * `inspected` events out of a careful run and the replay fails with must-open-the-card, which
     * is the reducer refusing to award the points rather than this route guessing at intent.
     */
    const forged = carefulRun().log.filter((e) => e.t !== 'inspected');
    const h = harness();

    const res = await handleScore(postScore(body(forged)), h.deps);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'that run could not be verified' });
    expect(h.calls).toHaveLength(0);
  });

  it('is not stored at all for a run that never reached the cottage', async () => {
    const unfinished = carefulRun().log.filter((e) => e.t !== 'arrived');
    const h = harness();

    const res = await handleScore(postScore(body(unfinished)), h.deps);

    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  it('is not stored under a handle the game did not mint', async () => {
    const log = carefulRun().log;
    for (const handle of ['wolfspotter', 'cyera-admin-42', '<script>alert(1)</script>', '']) {
      const h = harness();
      const res = await handleScore(postScore(body(log, handle)), h.deps);
      expect(res.status, handle).toBe(400);
      expect(h.calls).toHaveLength(0);
    }
  });
});

describe('the bodies a hostile caller sends', () => {
  it('refuses a flood of events before replaying any of them', async () => {
    const log = carefulRun().log;
    const flood = Array.from({ length: MAX_LOG_EVENTS + 1 }, (_, i) => log[i % log.length]!);
    const h = harness();

    const res = await handleScore(postScore(body(flood)), h.deps);

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
        body: JSON.stringify(body(carefulRun().log)),
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
    const good = await handleScore(buffered(JSON.stringify(body(carefulRun().log))), honest.deps);
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
      handleScore(postScore(body(carefulRun().log), 'text/plain'), h.deps).then((r) => r.status),
    ).resolves.toBe(415);
    // No content-type at all is the same answer as the wrong one.
    await expect(
      handleScore(new Request('https://off-the-path.test/api/score', { method: 'POST' }), h.deps),
    ).resolves.toMatchObject({ status: 415 });
    expect(h.calls).toHaveLength(0);
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
  /*
   * The thing recomputation does NOT stop. A maximal log can be built offline by driving the real
   * reducer, and before these two gates that one log could be posted under twenty-five minted
   * handles and fill the entire served page without anyone playing the game once. Per instance
   * only -- see src/limit.ts and the README -- but the near case is the cheap case.
   */
  it('writes one row for one run, however many times it posts it', async () => {
    const log = carefulRun().log;
    const instance = { recent: createRecentRuns() };
    const first = harness(undefined, instance);
    const again = harness(undefined, instance);
    const renamed = harness(undefined, instance);

    expect((await handleScore(postScore(body(log)), first.deps)).status).toBe(200);
    const second = await handleScore(postScore(body(log)), again.deps);
    // The same log under a different minted handle is the same run.
    const third = await handleScore(postScore(body(log, 'quiet-thicket-11')), renamed.deps);

    expect(second.status).toBe(409);
    expect(third.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ error: 'that run is already on the board' });
    expect(first.calls).toHaveLength(1);
    expect(again.calls).toHaveLength(0);
    expect(renamed.calls).toHaveLength(0);
  });

  it('lets a run be posted again when the table, not the player, was the problem', async () => {
    // The duplicate check must not punish a blip: a run is remembered when it becomes a row, not
    // when it is submitted, so the retry after a 503 is a 200 and not "already on the board".
    const log = carefulRun().log;
    const instance = { recent: createRecentRuns() };
    const failed = harness(() => new Response('', { status: 503 }), instance);
    const retry = harness(undefined, instance);

    expect((await handleScore(postScore(body(log)), failed.deps)).status).toBe(503);
    expect((await handleScore(postScore(body(log)), retry.deps)).status).toBe(200);
    expect(retry.written()).toEqual({ handle: HANDLE, score: score(log, content).total });
  });

  it('stops writing at all once the instance has spent its budget', async () => {
    const instance = { budget: createWriteBudget(2, 60_000, () => 0), recent: createRecentRuns() };
    // Three DIFFERENT runs, so it is the budget refusing and not the duplicate check: the same
    // careful run, arriving at the cottage a millisecond apart each time.
    const logs: RunEvent[][] = [99_997, 99_998, 99_999].map((at) => [
      ...carefulRun().log.slice(0, -1),
      { ...carefulRun().log.at(-1)!, at },
    ]);

    const seen: { status: number; wrote: number }[] = [];
    for (const log of logs) {
      const h = harness(undefined, instance);
      const res = await handleScore(postScore(body(log)), h.deps);
      seen.push({ status: res.status, wrote: h.calls.length });
    }

    expect(seen).toEqual([
      { status: 200, wrote: 1 },
      { status: 200, wrote: 1 },
      { status: 429, wrote: 0 },
    ]);
  });

  it('tells a shed write to come back later without naming a reason', async () => {
    const instance = { budget: createWriteBudget(0, 60_000, () => 0) };
    const h = harness(undefined, instance);
    const res = await handleScore(postScore(body(carefulRun().log)), h.deps);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    await expect(res.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
    expect(h.calls).toHaveLength(0);
  });
});

describe('when the board is not there', () => {
  it('answers 503 for a perfectly good run rather than losing it quietly', async () => {
    const res = await handleScore(postScore(body(carefulRun().log)), noStore);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'the leaderboard is unavailable' });
  });

  it('answers 503 when the table refuses the insert, and leaks nothing about why', async () => {
    const h = harness(
      () => new Response('{"message":"permission denied for table leaderboard"}', { status: 401 }),
    );
    const res = await handleScore(postScore(body(carefulRun().log)), h.deps);
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
    const res = await handleScore(postScore(body(carefulRun().log)), h.deps);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('ECONNRESET');
  });

  it('answers 503 when whatever went wrong was not even an Error', async () => {
    // A thrown string has no `.message`; the log line must not become "undefined" and the caller
    // must still get the one sentence it gets for everything else.
    const h = harness(() => {
      throw 'postgres said no';
    });
    const res = await handleScore(postScore(body(carefulRun().log)), h.deps);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('postgres');
  });
});

describe('the response headers', () => {
  it('are JSON, never cached, and never sniffed', async () => {
    const res = await handleScore(postScore(body(carefulRun().log)), harness().deps);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
