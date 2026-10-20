import { describe, expect, it } from 'vitest';
import { createRecentRuns, createWriteBudget, fingerprint } from '../src/limit.ts';
import { carefulRun } from './helpers.ts';

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
  it('knows a run it was told about and nothing else', () => {
    const recent = createRecentRuns();
    expect(recent.has('a')).toBe(false);
    // Asking does not record: only a run that reached the table is remembered.
    expect(recent.has('a')).toBe(false);
    recent.remember('a');
    expect(recent.has('a')).toBe(true);
    expect(recent.has('b')).toBe(false);
  });

  it('forgets the oldest rather than growing without end', () => {
    const recent = createRecentRuns(2);
    for (const key of ['a', 'b', 'c']) recent.remember(key); // 'a' is dropped on 'c'.
    expect([recent.has('a'), recent.has('b'), recent.has('c')]).toEqual([false, true, true]);
  });
});

describe('the fingerprint', () => {
  it('is the same for the same run and different for a different one', () => {
    const log = carefulRun().log;
    expect(fingerprint(log)).toBe(fingerprint(log));
    expect(fingerprint(log)).toHaveLength(64);
    expect(fingerprint(log)).not.toBe(fingerprint(log.slice(0, -1)));
    expect(fingerprint(log)).toMatch(/^[0-9a-f]{64}$/);
  });
});
