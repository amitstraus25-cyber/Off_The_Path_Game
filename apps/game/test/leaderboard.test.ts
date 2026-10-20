import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../../../content/game.json';
import {
  HANDLE_FIRST_WORDS,
  HANDLE_SECOND_WORDS,
  createState,
  isMintedHandle,
  loadContent,
  tryReduce,
} from '@otp/core';
import type { Action, Content, GameState } from '@otp/core';
import { createLeaderboardClient, newHandle } from '../src/net/leaderboard';
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

const content: Content = loadContent(raw);
const client = createLeaderboardClient(content);

const DOWN = content.strings['leaderboardDown']!;

/** A finished run, through the real reducer. The adapter posts this log and nothing else. */
function finishedRun(): GameState {
  let state = createState(content);
  let clock = 0;
  const at = (): number => {
    clock += 1000;
    return clock;
  };
  const apply = (action: Action): void => {
    const result = tryReduce(state, action, content);
    if (!result.ok) throw new Error(`${action.type} rejected: ${result.reason}`);
    state = result.state;
  };
  apply({ type: 'START', runId: 'r1', at: at() });
  apply({ type: 'BEGIN' });
  for (const c of content.characters) {
    apply({ type: 'MEET', c: c.id, at: at() });
    apply({ type: 'INSPECT', s: c.skillId, at: at() });
    apply({ type: 'VERDICT', s: c.skillId, v: 'restrict', at: at() });
  }
  apply({ type: 'ENTER_COTTAGE', at: at() });
  return state;
}

const run = finishedRun();

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

const bodyOf = (sent: Sent): { handle: string; log: unknown[] } =>
  JSON.parse(String(sent.init.body)) as { handle: string; log: unknown[] };

const okScore = (handle: string, score = 500): Response =>
  new Response(JSON.stringify({ handle, score }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('submit', () => {
  it('posts a run log to our own origin, and no score', async () => {
    const sent = intercept(() => okScore('brave-lantern-42'));
    await client.submit(run, 'brave-lantern-42');

    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe('/api/score');
    expect(sent[0]!.init.method).toBe('POST');
    // Same-origin by decision D3, which is why connect-src stays 'self'. No cookies, ever.
    expect(sent[0]!.init.credentials).toBe('omit');
    expect(sent[0]!.init.mode).toBe('same-origin');

    const body = bodyOf(sent[0]!);
    expect(Object.keys(body).sort()).toEqual(['handle', 'log']);
    expect(body.log).toEqual(JSON.parse(JSON.stringify(run.log)));
    expect('score' in body).toBe(false);
  });

  it('names the handle that went up when the board took it', async () => {
    intercept(() => okScore('brave-lantern-42'));
    const message = await client.submit(run, 'brave-lantern-42');
    // Never a silent success: the name is minted, so the player is told which one it was.
    expect(message).toContain('brave-lantern-42');
    expect(message).not.toContain('{handle}');
  });

  it('never sends a handle the game did not mint, and says which name went up', async () => {
    const sent = intercept(() => okScore('quiet-thicket-11'));
    const message = await client.submit(run, 'wolfspotter');

    expect(isMintedHandle(bodyOf(sent[0]!).handle)).toBe(true);
    expect(bodyOf(sent[0]!).handle).not.toBe('wolfspotter');
    expect(message).toContain('quiet-thicket-11');
    expect(message).not.toContain('{handle}');
  });

  it('never throws, whatever the network does', async () => {
    for (const reply of [
      (): never => {
        throw new TypeError('Failed to fetch');
      },
      (): Response => new Response('', { status: 503 }),
      (): Response => new Response('', { status: 500 }),
    ]) {
      intercept(reply);
      await expect(client.submit(run, 'brave-lantern-42')).resolves.toBe(DOWN);
      vi.unstubAllGlobals();
    }
  });

  it('separates "the board refused this" from "the board is down"', async () => {
    intercept(() => new Response(JSON.stringify({ error: 'nope' }), { status: 400 }));
    const message = await client.submit(run, 'brave-lantern-42');
    expect(message).not.toBe(DOWN);
    expect(message).toBeTruthy();
  });

  it('calls an undeployed API a board that is down, not a run that was refused', async () => {
    // What `vite preview` and a deployment without apps/api both answer. Phase 5's promise was
    // that the game is the same game when the board is not there, and e2e/game.spec.ts holds us
    // to the wording: a 404 must not read as "that run could not be posted".
    intercept(() => new Response('<!doctype html>', { status: 404 }));
    await expect(client.submit(run, 'brave-lantern-42')).resolves.toBe(DOWN);
  });

  it('believes nothing it cannot parse', async () => {
    for (const reply of [
      (): Response => new Response('not json at all', { status: 200 }),
      (): Response => new Response(JSON.stringify({ handle: 'wolfspotter', score: 1 })),
      (): Response => new Response(JSON.stringify({ handle: 'brave-lantern-42', score: -5 })),
      (): Response => new Response(JSON.stringify({ handle: 'brave-lantern-42' })),
    ]) {
      intercept(reply);
      await expect(client.submit(run, 'brave-lantern-42')).resolves.toBe(DOWN);
      vi.unstubAllGlobals();
    }
  });

  it('gives up rather than hanging on a request that never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', neverAnswers);
    const pending = client.submit(run, 'brave-lantern-42');
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toBe(DOWN);
    vi.useRealTimers();
  });

  it('gives up on a reply whose headers arrive and whose body never does', async () => {
    /*
     * The one that used to hang. `fetch()` settles when the HEADERS arrive, so a stalled proxy or
     * a function that writes a status and then blocks hands back a good Response over a body that
     * never produces a chunk. If the abort timer is cleared when fetch resolves, the read below
     * is unbounded and `submit()` never settles at all.
     */
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalledBody);
    const pending = client.submit(run, 'brave-lantern-42');
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toBe(DOWN);
    vi.useRealTimers();
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
    const entries = await client.top(5);

    expect(sent[0]!.url).toBe('/api/top?limit=5');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ rank: 1, handle: 'brave-lantern-42', score: 900 });
  });

  it('clamps a limit the caller got wrong instead of asking for everything', async () => {
    const sent = intercept(() => new Response(JSON.stringify({ entries: [] })));
    await client.top(100000);
    expect(sent[0]!.url).toBe('/api/top?limit=25');
  });

  it('comes back empty, never thrown, when the board is down or lying', async () => {
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
      await expect(client.top(5)).resolves.toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  it('comes back empty rather than hanging on a body that never arrives', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', stalledBody);
    const pending = client.top(5);
    await vi.advanceTimersByTimeAsync(10000);
    await expect(pending).resolves.toEqual([]);
    vi.useRealTimers();
  });
});
