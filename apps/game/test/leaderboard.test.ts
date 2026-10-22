import { afterEach, describe, expect, it, vi } from 'vitest';
import rawV2 from '../../../content/game.v2.json';
import { HANDLE_FIRST_WORDS, HANDLE_SECOND_WORDS, isMintedHandle, v2 } from '@otp/core';
import { submitRunSchema } from '@otp/api/src/schema.ts';
import { forgetLastPost, newHandle, readBoard, startRun, submit } from '../src/net/leaderboard';
import { validateHandle } from '../src/ui/Results';

/*
 * The adapter's docstring makes three promises and this file is them.
 *
 * "The game must stay fully playable either way, so nothing here ever blocks results or the CTA."
 * In practice that is: submit() never throws and never hangs, every failure comes back as a
 * message, every response is parsed before it is believed, and no score is ever sent -- only a log.
 *
 * There is no network here. `fetch` is replaced, so these run in CI, offline, with no API deployed.
 */

const chrome: Record<string, string> = rawV2.ui.chrome;
const contentV2 = v2.loadContent(rawV2);
const SEED = 123_456_789;
/** A finished careful run through the real reducer. The adapter posts this log and nothing else. */
const log = v2.toRunLog(
  v2.play(contentV2, 'careful', { seed: SEED, pace: { walkMs: 1000, talkMs: 1000 } }).state,
);
const TOKEN = 'cGF5bG9hZA.c2lnbmF0dXJl';

interface Sent {
  url: string;
  init: RequestInit;
}

/** Replaces fetch with one scripted reply and records what was asked for. */
function intercept(reply: () => Promise<Response> | Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(reply());
  });
  return sent;
}

/*
 * The two ways a request can fail to come back, modelled the way the platform behaves rather than
 * the way the assertion wants. `fetch` rejects with an AbortError when the signal fires before the
 * headers arrive, and errors the body STREAM when it fires after them -- so both stubs listen to
 * the signal this adapter passed and do what a browser would. Neither supplies its own rejection:
 * remove the abort from the adapter and both of these hang, which is the point of having them.
 */
const neverAnswers = (_url: string, init: RequestInit): Promise<Response> =>
  new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });

const stalledBody = (_url: string, init: RequestInit): Promise<Response> => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
    },
  });
  return Promise.resolve(
    new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
  );
};

const okScore = (handle: string, score = 500): Response =>
  new Response(JSON.stringify({ handle, score }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  // A post is remembered for the board's next read (`withYourRow`); no test inherits another's.
  forgetLastPost();
});

describe('minted handles', () => {
  it('are what this game posts, and are its own to validate', () => {
    for (let i = 0; i < 50; i++) expect(isMintedHandle(newHandle())).toBe(true);
  });

  it('are short enough for the table and tame enough for a public page', () => {
    for (let i = 0; i < 50; i++) {
      const handle = newHandle();
      expect(handle.length).toBeLessThanOrEqual(16);
      expect(handle).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
    }
  });

  it('every one of them passes the form the results screen still ships', () => {
    /*
     * The claim "a minted handle also passes the existing validator, so a migrated UI needs no
     * coordination" was true and untested, which is a claim waiting to rot. `validateHandle` and
     * its blocklist live in Results.tsx; one word added to either list here could mint a name the
     * game's own form refuses (`light-support-99` is 16 characters, parses, and is blocked), and
     * with no test on the pair that lands silently. This is that test, across the whole 1024.
     */
    const every = HANDLE_FIRST_WORDS.flatMap((first) =>
      HANDLE_SECOND_WORDS.flatMap((second) =>
        ['10', '42', '99'].map((n) => `${first}-${second}-${n}`),
      ),
    );
    expect(every).toHaveLength(3072);
    for (const handle of every) expect(validateHandle(handle), handle).toBeNull();
  });
});

describe('top', () => {
  it('asks for a sane page and ranks what it is given', async () => {
    const sent = intercept(
      () =>
        new Response(
          JSON.stringify({
            entries: [
              { rank: 1, handle: 'brave-lantern-42', score: 900 },
              { rank: 2, handle: 'merry-kettle-73', score: 450 },
            ],
          }),
        ),
    );
    const read = await readBoard(5);

    expect(sent[0]!.url).toBe('/api/top?limit=5');
    expect(read).toEqual({
      state: 'rows',
      entries: [
        { rank: 1, handle: 'brave-lantern-42', score: 900 },
        { rank: 2, handle: 'merry-kettle-73', score: 450 },
      ],
    });
  });

  it('clamps a limit the caller got wrong instead of asking for everything', async () => {
    const sent = intercept(() => new Response(JSON.stringify({ entries: [] })));
    expect(await readBoard(100000)).toEqual({ state: 'empty' });
    expect(sent[0]!.url).toBe('/api/top?limit=25');
  });

  /*
   * THE WHOLE REASON `top()` RETURNS A STATE AND NOT AN ARRAY.
   *
   * These two answers were indistinguishable until 2026-10-21 and the screen could only have
   * rendered one sentence for both. The third reply is the one that is not loud: it is the 200 of
   * index.html that the SPA catch-all serves when the /api/(.*) rewrite never reaches apps/api,
   * measured on the shipped build on 2026-10-20 at 654 bytes of HTML.
   */
  it('tells an empty board apart from an absent one', async () => {
    intercept(() => new Response(JSON.stringify({ entries: [] })));
    expect(await readBoard(10)).toEqual({ state: 'empty' });
    vi.unstubAllGlobals();

    intercept(() => new Response('<!doctype html><title>Off the Path</title>', { status: 200 }));
    expect(await readBoard(10)).toEqual({ state: 'unavailable' });
  });

  it('comes back unavailable, never thrown, when the board is down or lying', async () => {
    for (const reply of [
      (): never => {
        throw new TypeError('Failed to fetch');
      },
      (): Response => new Response('', { status: 503 }),
      (): Response => new Response('nonsense', { status: 200 }),
      (): Response =>
        new Response(JSON.stringify({ entries: [{ rank: 1, handle: 'x', score: 1 }] })),
      (): Response =>
        new Response(JSON.stringify({ entries: [{ rank: 1, handle: '<img src=x>', score: 1 }] })),
    ]) {
      intercept(reply);
      await expect(readBoard(5)).resolves.toEqual({ state: 'unavailable' });
      vi.unstubAllGlobals();
    }
  });

  it('comes back unavailable rather than hanging on a body that never arrives', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalledBody);
    const pending = readBoard(5);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toEqual({ state: 'unavailable' });
    vi.useRealTimers();
  });
});

/*
 * The game asks the server for a run, plays the seed it is given, and posts the log with the token.
 */
describe('startRun', () => {
  const TOKEN =
    'eyJpZCI6IngiLCJzZWVkIjo3LCJpc3N1ZWRBdCI6MH0.c2lnbmF0dXJlLWJ5dGVzLWhlcmUtMzItbG9uZw';

  it('asks our own origin for a run, as JSON, with no cookie', async () => {
    const sent = intercept(() => new Response(JSON.stringify({ seed: 7, token: TOKEN })));
    await expect(startRun()).resolves.toEqual({ seed: 7, token: TOKEN });
    expect(sent[0]!.url).toBe('/api/start');
    expect(sent[0]!.init.method).toBe('POST');
    expect(sent[0]!.init.credentials).toBe('omit');
    expect(sent[0]!.init.mode).toBe('same-origin');
    expect((sent[0]!.init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
  });

  it('hands back only a seed and a token, whatever else the reply carried', async () => {
    intercept(() => new Response(JSON.stringify({ seed: 7, token: TOKEN, extra: 'x' })));
    await expect(startRun()).resolves.toEqual({ seed: 7, token: TOKEN });
  });

  it('answers null -- play on a local seed -- for anything it cannot believe', async () => {
    for (const reply of [
      (): never => {
        throw new TypeError('Failed to fetch');
      },
      (): Response => new Response('', { status: 503 }),
      (): Response => new Response('', { status: 429 }),
      (): Response => new Response('<!doctype html>', { status: 404 }),
      (): Response => new Response('not json', { status: 200 }),
      (): Response => new Response('null'),
      (): Response => new Response(JSON.stringify({ seed: -1, token: TOKEN })),
      (): Response => new Response(JSON.stringify({ seed: 2 ** 32, token: TOKEN })),
      (): Response => new Response(JSON.stringify({ seed: 1.5, token: TOKEN })),
      (): Response => new Response(JSON.stringify({ seed: 7 })),
      (): Response => new Response(JSON.stringify({ seed: 7, token: 'no-dot' })),
      (): Response => new Response(JSON.stringify({ seed: 7, token: '<b>.x' })),
      (): Response => new Response(JSON.stringify({ seed: 7, token: `${'a'.repeat(300)}.b` })),
    ]) {
      intercept(reply);
      await expect(startRun()).resolves.toBeNull();
      vi.unstubAllGlobals();
    }
  });

  it('gives up after a couple of seconds, so a hanging start barely holds Begin', async () => {
    // Not the six seconds a score post is given: the player is waiting on this one.
    vi.useFakeTimers();
    vi.stubGlobal('fetch', neverAnswers);
    let answer: unknown = 'pending';
    const pending = startRun().then((r) => (answer = r));
    await vi.advanceTimersByTimeAsync(2400);
    expect(answer).toBe('pending');
    await vi.advanceTimersByTimeAsync(200);
    await expect(pending).resolves.toBeNull();
    expect(answer).toBeNull();
    vi.useRealTimers();
  });

  it('leaves the board and the score post their longer limit', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', neverAnswers);
    let settled = false;
    const post = submit('brave-lantern-42', log, TOKEN).then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(5000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    await post;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });
});

describe('submit', () => {
  const STRINGS = {
    handleAssigned: 'Up as {handle}.',
    leaderboardAlready: 'Already up.',
    leaderboardRefused: 'Refused.',
    leaderboardDown: 'No reply.',
    leaderboardClosed: 'Closed.',
  };
  const v2Body = (sent: Sent): Record<string, unknown> =>
    JSON.parse(String(sent.init.body)) as Record<string, unknown>;

  it('posts the handle, the log and the token, and no score', async () => {
    const sent = intercept(() => okScore('brave-lantern-42', 100));
    await submit('brave-lantern-42', log, TOKEN);

    expect(sent[0]!.url).toBe('/api/score');
    expect(sent[0]!.init.credentials).toBe('omit');
    const body = v2Body(sent[0]!);
    expect(Object.keys(body).sort()).toEqual(['handle', 'log', 'token']);
    expect(body['token']).toBe(TOKEN);
  });

  it('sends a body the server accepts, scoring it to the number the screen showed', async () => {
    /*
     * The two halves held against each other without a server: the real body off the real
     * request, through the server's OWN schema (strict -- an extra key is a 400) and then the
     * replay and `result()` the route runs. A careful run is 100 on both sides.
     */
    const sent = intercept(() => okScore('brave-lantern-42', 100));
    await submit('brave-lantern-42', log, TOKEN);

    const parsed = submitRunSchema.safeParse(v2Body(sent[0]!));
    expect(parsed.success, 'the server would refuse the body this adapter sends').toBe(true);
    const replay = v2.checkRunLog(parsed.data!.log, contentV2);
    expect(replay.legal && replay.ended, 'the server would not replay this run').toBe(true);
    expect(replay.legal && v2.result(replay.state, contentV2).total).toBe(100);
    expect(parsed.data!.log.seed).toBe(SEED);
  });

  it('sends the name the player typed, in the tidy form the board stores', async () => {
    const sent = intercept(() => okScore('Little Purple', 100));
    await submit('  Little   Purple ', log, TOKEN);
    expect(v2Body(sent[0]!)['handle']).toBe('Little Purple');
  });

  it('never sends a name the board refuses: it answers why, and posts nothing', async () => {
    const sent = intercept(() => okScore('quiet-thicket-11', 100));
    await expect(submit('Al', log, TOKEN, STRINGS)).resolves.toEqual({
      key: 'leaderboardRefused',
      text: 'That name cannot go on the board. Try another.',
      reason: 'name',
      nameRefusal: 'short',
    });
    await expect(submit('<script>', log, TOKEN)).resolves.toMatchObject({
      nameRefusal: 'characters',
    });
    expect(sent).toHaveLength(0);
  });

  it.each([
    [409, 'leaderboardAlready'],
    [410, 'leaderboardClosed'],
    [400, 'leaderboardRefused'],
    [404, 'leaderboardDown'],
    [429, 'leaderboardDown'],
    [503, 'leaderboardDown'],
  ] as const)("reads a %i as %s, in the content file's words", async (status, key) => {
    intercept(() => new Response('{}', { status }));
    await expect(submit('brave-lantern-42', log, TOKEN, STRINGS)).resolves.toEqual({
      key,
      text: STRINGS[key],
    });
  });

  it('names the handle that went up, and falls back to a sentence when content has none', async () => {
    intercept(() => okScore('quiet-thicket-11', 100));
    await expect(submit('brave-lantern-42', log, TOKEN, STRINGS)).resolves.toEqual({
      key: 'handleAssigned',
      text: 'Up as quiet-thicket-11.',
      posted: { handle: 'quiet-thicket-11', score: 100, rank: null },
    });
    vi.unstubAllGlobals();
    intercept(() => okScore('quiet-thicket-11', 100));
    const bare = await submit('brave-lantern-42', log, TOKEN);
    expect(bare.text).toContain('quiet-thicket-11');
    expect(bare.text).not.toContain('{handle}');
  });

  it('never throws and believes nothing it cannot parse', async () => {
    for (const reply of [
      (): never => {
        throw new TypeError('Failed to fetch');
      },
      (): Response => new Response('not json at all', { status: 200 }),
      (): Response => new Response(JSON.stringify({ handle: '<img src=x>', score: 1 })),
    ]) {
      intercept(reply);
      await expect(submit('brave-lantern-42', log, TOKEN)).resolves.toMatchObject({
        key: 'leaderboardDown',
      });
      vi.unstubAllGlobals();
    }
  });

  it('says every one of its lines in the words of the content file', async () => {
    /*
     * CLAUDE.md rule 3. A key deleted from `ui.chrome` falls through to a backstop in the adapter
     * and this fails -- and the one template still has its slot to fill.
     */
    const keys = [
      'leaderboardDown',
      'leaderboardRefused',
      'leaderboardAlready',
      'leaderboardClosed',
      'handleAssigned',
    ] as const;
    for (const key of keys) expect(chrome[key], `ui.chrome is missing ${key}`).toBeTruthy();
    expect(chrome['handleAssigned']).toContain('{handle}');

    intercept(() => okScore('quiet-thicket-11', 100));
    await expect(submit('brave-lantern-42', log, TOKEN, chrome)).resolves.toMatchObject({
      key: 'handleAssigned',
      text: chrome['handleAssigned']!.replace('{handle}', 'quiet-thicket-11'),
    });
  });

  it('gives up rather than hanging on a request that never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', neverAnswers);
    const pending = submit('brave-lantern-42', log, TOKEN);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toMatchObject({ key: 'leaderboardDown' });
    vi.useRealTimers();
  });

  it('gives up on a reply whose headers arrive and whose body never does', async () => {
    /*
     * The one that used to hang. `fetch()` settles when the HEADERS arrive, so a stalled proxy hands
     * back a good Response over a body that never produces a chunk. If the abort timer is cleared
     * when fetch resolves, the read is unbounded and `submit()` never settles at all.
     */
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalledBody);
    const pending = submit('brave-lantern-42', log, TOKEN);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toMatchObject({ key: 'leaderboardDown' });
    vi.useRealTimers();
  });
});

describe('readBoard', () => {
  it('is the board read, at the default page size', async () => {
    const sent = intercept(() => new Response(JSON.stringify({ entries: [] })));
    await expect(readBoard()).resolves.toEqual({ state: 'empty' });
    expect(sent[0]!.url).toBe('/api/top?limit=10');
  });
});
