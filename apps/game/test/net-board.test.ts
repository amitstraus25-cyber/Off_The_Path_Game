import { afterEach, describe, expect, it, vi } from 'vitest';
import rawV2 from '../../../content/game.v2.json';
import { v2 } from '@otp/core';
import {
  BOARD_LAG_MS,
  forgetLastPost,
  readBoard,
  startRun,
  submit,
  withYourRow,
} from '../src/net/leaderboard';
import type { BoardRead, LastPost, LeaderboardEntry } from '../src/net/leaderboard';

/*
 * THE CLIENT'S "I POSTED AND I DON'T SEE MY SCORE" (2026-10-22), on this side of the wire.
 *
 * The board read straight after a post was the edge's copy from before it. The post now answers
 * with its rank and a board read from the table, and `withYourRow` lays that over any read that
 * has not caught up. These are the four cases its docstring names, and the flow end to end through
 * a fake fetch that serves exactly the stale page the client saw.
 */

const contentV2 = v2.loadContent(rawV2);
const log = v2.toRunLog(
  v2.play(contentV2, 'careful', { seed: 9, pace: { walkMs: 5000, talkMs: 1000 } }).state,
);
const TOKEN = 'cGF5bG9hZA.c2lnbmF0dXJl';

const row = (rank: number, handle: string, score: number): LeaderboardEntry => ({
  rank,
  handle,
  score,
});
const rows = (...entries: LeaderboardEntry[]): BoardRead => ({ state: 'rows', entries });
/** What the client photographed: one wolf run at 0, before the board stopped showing zeros. */
const STALE = rows(row(1, 'warm-candle-17', 10));
const T = 1_000_000;
const post = (over: Partial<LastPost> = {}): LastPost => ({
  handle: 'swift-apron-51',
  score: 88,
  rank: 1,
  at: T,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetLastPost();
});

describe('withYourRow: the player sees their own row the moment they post', () => {
  it('changes nothing before this page has posted', () => {
    expect(withYourRow(STALE, null, T)).toBe(STALE);
  });

  it('1. a read that holds the row marks it confirmed, wherever it has slid to since', () => {
    const read = rows(row(1, 'Ido', 100), row(2, 'swift-apron-51', 88), row(3, 'x-y', 40));
    expect(withYourRow(read, post({ rank: 1 }), T + 5 * BOARD_LAG_MS)).toEqual(
      rows(
        row(1, 'Ido', 100),
        { ...row(2, 'swift-apron-51', 88), yours: 'confirmed' },
        row(3, 'x-y', 40),
      ),
    );
  });

  it('1. ...and never marks a same-named row above the counted rank, which is older and not theirs', () => {
    // Two "Amit"s at 70: the one at rank 1 was there first. Ours was counted at rank 2.
    const read = rows(row(1, 'Amit', 70), row(2, 'Amit', 70));
    const marked = withYourRow(read, post({ handle: 'Amit', score: 70, rank: 2 }), T);
    expect(marked).toEqual(rows(row(1, 'Amit', 70), { ...row(2, 'Amit', 70), yours: 'confirmed' }));
  });

  it('2. once the edge can no longer lag, the read is the truth, and an absent row is not invented', () => {
    expect(withYourRow(STALE, post(), T + BOARD_LAG_MS)).toBe(STALE);
    // Nor marked by name alone when the rank was never counted.
    const read = rows(row(1, 'swift-apron-51', 88));
    expect(withYourRow(read, post({ rank: null }), T + BOARD_LAG_MS)).toBe(read);
  });

  it('3. inside the lag, the board the post read is newer than a read without the row', () => {
    const fresh = [row(1, 'swift-apron-51', 88), row(2, 'warm-candle-17', 10)];
    expect(withYourRow(STALE, post({ entries: fresh }), T + 1000)).toEqual(
      rows({ ...fresh[0]!, yours: 'confirmed' }, fresh[1]!),
    );
    // Even when the read itself failed.
    expect(withYourRow({ state: 'unavailable' }, post({ entries: fresh }), T)).toMatchObject({
      state: 'rows',
    });
  });

  it('3. ...with no counted rank, the newest row of its name and score in that board is ours', () => {
    const fresh = [row(1, 'Amit', 70), row(2, 'Amit', 70), row(3, 'b-c', 10)];
    expect(
      withYourRow(STALE, post({ handle: 'Amit', score: 70, rank: null, entries: fresh }), T),
    ).toEqual(rows(fresh[0]!, { ...fresh[1]!, yours: 'confirmed' }, fresh[2]!));
    // A board that does not carry the row and no rank to place it by: shown, marked nowhere.
    expect(withYourRow(STALE, post({ rank: null, entries: fresh }), T)).toEqual(rows(...fresh));
    expect(withYourRow(STALE, post({ rank: 1, entries: [] }), T)).toEqual({ state: 'empty' });
  });

  it('4. inside the lag with no board from the post, the row is placed pending and the rest move down', () => {
    const read = rows(row(1, 'Ido', 100), row(2, 'warm-candle-17', 10));
    expect(withYourRow(read, post({ rank: 2 }), T)).toEqual(
      rows(
        row(1, 'Ido', 100),
        { ...row(2, 'swift-apron-51', 88), yours: 'pending' },
        row(3, 'warm-candle-17', 10),
      ),
    );
    // On an empty board too, which is the commonest board on a research page that just launched.
    expect(withYourRow({ state: 'empty' }, post(), T)).toEqual(
      rows({ ...row(1, 'swift-apron-51', 88), yours: 'pending' }),
    );
  });

  it('4. ...after every score at or above it when the rank was never counted, and never past the page', () => {
    const read = rows(row(1, 'Ido', 100), row(2, 'Amit', 88), row(3, 'z-z', 5));
    expect(withYourRow(read, post({ rank: null }), T)).toEqual(
      rows(
        row(1, 'Ido', 100),
        row(2, 'Amit', 88),
        { ...row(3, 'swift-apron-51', 88), yours: 'pending' },
        row(4, 'z-z', 5),
      ),
    );
    // The page stays its size: the row pushed off the bottom goes.
    expect(withYourRow(read, post({ rank: 1 }), T, 3)).toMatchObject({
      entries: [{ yours: 'pending' }, { handle: 'Ido' }, { handle: 'Amit' }],
    });
  });

  it('4. ...and never beside a row that may already be it when the rank was never counted', () => {
    const read = rows(row(1, 'swift-apron-51', 88));
    expect(withYourRow(read, post({ rank: null }), T)).toBe(read);
  });

  it('4. ...and an unreadable board is not a board to draw one hopeful row on', () => {
    expect(withYourRow({ state: 'unavailable' }, post(), T)).toEqual({ state: 'unavailable' });
  });

  /*
   * THE REVIEW'S FINDING, 2026-10-22: 12 runs of 100 on the board, a 99 posted as "Assaf". The
   * status said "Posted to the board as Assaf." and the board showed ranks 1 to 10, none of them
   * the player's, although the server had answered rank 13. Ties rank the earliest first and 100
   * needs par, so this is where most players' runs land soon after launch.
   */
  const hundreds = Array.from({ length: 10 }, (_, i) => row(i + 1, `runner ${i + 1}`, 100));
  const assaf = (rank: number): LeaderboardEntry => ({
    ...row(rank, 'Assaf', 99),
    yours: 'confirmed',
  });

  it('0. a run counted below the page is shown after it, at its counted rank, as theirs', () => {
    const fromPost = post({ handle: 'Assaf', score: 99, rank: 13, entries: hundreds });
    expect(withYourRow(rows(...hundreds), fromPost, T)).toEqual(rows(...hundreds, assaf(13)));
    // Over the stale edge page too: inside the lag the post's own board is the page.
    expect(withYourRow(STALE, fromPost, T + 1000)).toEqual(rows(...hundreds, assaf(13)));
    expect(withYourRow({ state: 'unavailable' }, fromPost, T)).toEqual(
      rows(...hundreds, assaf(13)),
    );
  });

  it('0. ...with no board from the post, after the read; and after the lag, still', () => {
    const fromPost = post({ handle: 'Assaf', score: 99, rank: 13 });
    expect(withYourRow(rows(...hundreds), fromPost, T)).toEqual(rows(...hundreds, assaf(13)));
    // No read of the top ten can confirm or refute a row below it, so the lag does not end it.
    expect(withYourRow(rows(...hundreds), fromPost, T + 5 * BOARD_LAG_MS)).toEqual(
      rows(...hundreds, assaf(13)),
    );
    // An empty read (the edge from before anyone posted) shows only the player's own row.
    expect(withYourRow({ state: 'empty' }, fromPost, T)).toEqual(rows(assaf(13)));
    // The page keeps its size; ours is the one row past it.
    expect(withYourRow(rows(...hundreds), post({ ...fromPost, rank: 11 }), T, 3)).toEqual(
      rows(...hundreds.slice(0, 3), assaf(11)),
    );
  });

  it('0. ...but never on a board that failed to load, unless the post read one back', () => {
    const fromPost = post({ handle: 'Assaf', score: 99, rank: 13 });
    expect(withYourRow({ state: 'unavailable' }, fromPost, T)).toEqual({ state: 'unavailable' });
    const later = post({ handle: 'Assaf', score: 99, rank: 13, entries: hundreds });
    expect(withYourRow({ state: 'unavailable' }, later, T + BOARD_LAG_MS)).toEqual({
      state: 'unavailable',
    });
  });
});

describe('the whole flow, against the stale edge copy the client was served', () => {
  /** /api/score answers with the fresh board; /api/top keeps serving the copy from before. */
  function edge(reply: Record<string, unknown>): void {
    vi.stubGlobal('fetch', (url: string) =>
      Promise.resolve(
        url === '/api/score'
          ? new Response(JSON.stringify(reply))
          : new Response(JSON.stringify({ entries: (STALE as { entries: unknown[] }).entries })),
      ),
    );
  }

  it('posts, then reads a stale board, and still shows the player their own row, confirmed', async () => {
    edge({
      handle: 'swift-apron-51',
      score: 88,
      rank: 1,
      entries: [row(1, 'swift-apron-51', 88), row(2, 'warm-candle-17', 10)],
    });
    const outcome = await submit('swift-apron-51', log, TOKEN);
    expect(outcome).toMatchObject({
      key: 'handleAssigned',
      posted: { handle: 'swift-apron-51', score: 88, rank: 1 },
    });
    await expect(readBoard()).resolves.toEqual(
      rows({ ...row(1, 'swift-apron-51', 88), yours: 'confirmed' }, row(2, 'warm-candle-17', 10)),
    );
  });

  it('shows it pending when the post could not read the board back', async () => {
    edge({ handle: 'swift-apron-51', score: 88, rank: 1 });
    await submit('swift-apron-51', log, TOKEN);
    await expect(readBoard()).resolves.toEqual(
      rows({ ...row(1, 'swift-apron-51', 88), yours: 'pending' }, row(2, 'warm-candle-17', 10)),
    );
  });

  it('forgets it when the next run starts, so last run’s row is never "your run" again', async () => {
    edge({ handle: 'swift-apron-51', score: 88, rank: 1 });
    await submit('swift-apron-51', log, TOKEN);
    await startRun();
    await expect(readBoard()).resolves.toEqual(STALE);
  });
});

describe('the two refusals that say why', () => {
  const answer = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it('a name the server refused that the game did not, said in the chrome or the backstop', async () => {
    answer(422, { error: 'that name cannot go on the board', reason: 'name' });
    await expect(submit('swift-apron-51', log, TOKEN)).resolves.toEqual({
      key: 'leaderboardRefused',
      text: 'That name cannot go on the board. Try another.',
      reason: 'name',
    });
    answer(422, { error: 'that name cannot go on the board', reason: 'name' });
    await expect(
      submit('swift-apron-51', log, TOKEN, { handleBlocked: 'Pick another name.' }),
    ).resolves.toEqual({ key: 'leaderboardRefused', text: 'Pick another name.', reason: 'name' });
  });

  it('a 422 it cannot read is a plain refusal, claiming nothing more', async () => {
    // `wolf` among them: the board has taken wolf runs since the floor of 2026-10-25.
    for (const body of [{ reason: 'other' }, { reason: 'wolf' }, null, 'x']) {
      answer(422, body);
      await expect(submit('swift-apron-51', log, TOKEN)).resolves.toEqual({
        key: 'leaderboardRefused',
        text: 'That run could not be posted.',
      });
    }
  });
});
