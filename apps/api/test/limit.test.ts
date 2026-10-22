import { describe, expect, it } from 'vitest';
import { createRecentRuns, createWriteBudget } from '../src/limit.ts';

/*
 * The two per-instance defences, as units. What they do against a route is in score.test.ts; this
 * file is the arithmetic, including the parts a route test cannot reach cheaply: a budget that
 * refills with time, and a set that forgets its oldest entry rather than growing without end.
 */

describe('the write budget', () => {
  it('spends its capacity and then refuses', () => {
    const budget = createWriteBudget(3, 60_000, () => 0);
    expect([budget.take(), budget.take(), budget.take(), budget.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('refills with time, so a quiet minute buys the next one', () => {
    let now = 0;
    const budget = createWriteBudget(2, 60_000, () => now);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
    now = 30_000; // half the window: one token back.
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
  });

  it('never banks more than its capacity, however long it has been idle', () => {
    let now = 0;
    const budget = createWriteBudget(2, 60_000, () => now);
    now = 10 * 60_000;
    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
  });

  it('defaults to a rate an honest page never reaches', () => {
    // One post per completed playthrough against thirty a minute.
    const budget = createWriteBudget();
    for (let i = 0; i < 30; i++) expect(budget.take(), `write ${i}`).toBe(true);
    expect(budget.take()).toBe(false);
  });
});

describe('the recent runs', () => {
  it('grants a run once, and refuses it for as long as it is held', () => {
    const recent = createRecentRuns();
    expect(recent.claim('a')).toBe(true);
    expect(recent.claim('a')).toBe(false);
    // Another run is unaffected.
    expect(recent.claim('b')).toBe(true);
  });

  it('gives a run back, so a post that made no row can be tried again', () => {
    const recent = createRecentRuns();
    expect(recent.claim('a')).toBe(true);
    recent.release('a');
    expect(recent.claim('a')).toBe(true);
    // Releasing something never held is not an error.
    recent.release('never-held');
  });

  it('forgets the oldest rather than growing without end', () => {
    const recent = createRecentRuns(2);
    for (const key of ['a', 'b', 'c']) recent.claim(key); // 'a' is dropped on 'c'.
    expect([recent.claim('b'), recent.claim('c'), recent.claim('a')]).toEqual([false, false, true]);
  });
});
