import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOP_LIMIT,
  HANDLE_FIRST_WORDS,
  HANDLE_MAX_LENGTH,
  HANDLE_SECOND_WORDS,
  MAX_LOG_EVENTS,
  MAX_TOP_LIMIT,
  handleSchema,
  isMintedHandle,
  mintHandle,
  submitRequestSchema,
  submitResponseSchema,
  topLimit,
  topResponseSchema,
} from '../src/leaderboard.ts';
import { fullRun } from './helpers.ts';

/*
 * The handle rules are a database constraint and a moderation policy written as code, so they are
 * tested as both: every handle the game can mint fits `char_length(handle) between 1 and 16`, and
 * nothing the game did not mint parses.
 */

const EVERY_HANDLE = HANDLE_FIRST_WORDS.flatMap((first) =>
  HANDLE_SECOND_WORDS.map((second) => `${first}-${second}-99`),
);

describe('minted handles', () => {
  it('fits the table check constraint for every word pair', () => {
    expect(EVERY_HANDLE).toHaveLength(1024);
    for (const handle of EVERY_HANDLE) {
      expect(handle.length).toBeLessThanOrEqual(HANDLE_MAX_LENGTH);
      expect(handle.length).toBeGreaterThan(0);
    }
  });

  it('accepts every word pair it can mint', () => {
    for (const handle of EVERY_HANDLE) expect(isMintedHandle(handle)).toBe(true);
  });

  it('draws the ends of both lists from the ends of the rng', () => {
    expect(mintHandle(() => 0)).toBe(`${HANDLE_FIRST_WORDS[0]}-${HANDLE_SECOND_WORDS[0]}-10`);
    expect(mintHandle(() => 0.999999)).toBe(
      `${HANDLE_FIRST_WORDS.at(-1)}-${HANDLE_SECOND_WORDS.at(-1)}-99`,
    );
  });

  it('stays in range for an rng that hands back 1, or something worse', () => {
    // An injected dependency is a dependency: a fake that returns 1 (or -1) must not mint
    // `undefined-undefined-NaN`, which would then be refused by the insert rather than here.
    expect(isMintedHandle(mintHandle(() => 1))).toBe(true);
    expect(isMintedHandle(mintHandle(() => -1))).toBe(true);
    expect(mintHandle(() => -1)).toBe(`${HANDLE_FIRST_WORDS[0]}-${HANDLE_SECOND_WORDS[0]}-10`);
  });

  it('walks both lists as the rng walks', () => {
    const minted = new Set<string>();
    for (let i = 0; i < 90; i++) minted.add(mintHandle(() => i / 90));
    expect(minted.size).toBeGreaterThan(30);
    for (const handle of minted) expect(isMintedHandle(handle)).toBe(true);
  });

  it('refuses anything it did not mint', () => {
    for (const bad of [
      'wolfspotter',
      'brave-lantern',
      'brave-lantern-7',
      'brave-lantern-07',
      'brave-lantern-100',
      'Brave-Lantern-42',
      'brave-wolf-42',
      'notaword-lantern-42',
      'brave-lantern-42 ',
      '',
      'cyera-admin-42',
      'brave_lantern_42',
      'brave-lantern-42; drop table public.leaderboard',
    ])
      expect(isMintedHandle(bad)).toBe(false);
  });

  it('refuses a handle that is not a string at all', () => {
    for (const bad of [null, undefined, 42, {}, ['brave-lantern-42']])
      expect(isMintedHandle(bad)).toBe(false);
  });

  it('is the same rule as the schema', () => {
    expect(handleSchema.safeParse('brave-lantern-42').success).toBe(true);
    expect(handleSchema.safeParse('wolfspotter').success).toBe(false);
  });
});

describe('the submission body', () => {
  const log = fullRun({ rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' }).log;

  it('accepts a handle and a log', () => {
    const parsed = submitRequestSchema.safeParse({ handle: 'brave-lantern-42', log });
    expect(parsed.success).toBe(true);
  });

  it('cannot carry a score (golden rule 6: the server recomputes it)', () => {
    const parsed = submitRequestSchema.safeParse({
      handle: 'brave-lantern-42',
      log,
      score: 999999,
    });
    expect(parsed.success).toBe(false);
  });

  it('refuses an empty log, an oversized log and a handle it did not mint', () => {
    expect(submitRequestSchema.safeParse({ handle: 'brave-lantern-42', log: [] }).success).toBe(
      false,
    );
    const flood = Array.from({ length: MAX_LOG_EVENTS + 1 }, () => log[0]!);
    expect(submitRequestSchema.safeParse({ handle: 'brave-lantern-42', log: flood }).success).toBe(
      false,
    );
    expect(submitRequestSchema.safeParse({ handle: 'wolfspotter', log }).success).toBe(false);
  });

  it('refuses an event shape the reducer never emits', () => {
    const forged = [{ t: 'verdict', s: 'cottage-finder', v: 'allow', at: 1, points: 9999 }];
    expect(submitRequestSchema.safeParse({ handle: 'brave-lantern-42', log: forged }).success).toBe(
      false,
    );
  });
});

describe('the responses, which the game treats as untrusted', () => {
  it('parses a well-formed board and tolerates a field it does not know', () => {
    const parsed = topResponseSchema.safeParse({
      entries: [{ rank: 1, handle: 'brave-lantern-42', score: 900 }],
      servedAt: 'ignored',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.entries[0]?.handle).toBe('brave-lantern-42');
  });

  it('refuses a row whose handle is not one this game mints', () => {
    const parsed = topResponseSchema.safeParse({
      entries: [{ rank: 1, handle: '<script>alert(1)</script>', score: 900 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuses a negative or fractional score', () => {
    expect(submitResponseSchema.safeParse({ handle: 'brave-lantern-42', score: -1 }).success).toBe(
      false,
    );
    expect(submitResponseSchema.safeParse({ handle: 'brave-lantern-42', score: 1.5 }).success).toBe(
      false,
    );
    expect(submitResponseSchema.safeParse({ handle: 'brave-lantern-42', score: 0 }).success).toBe(
      true,
    );
  });
});

describe('the page size', () => {
  it('clamps, defaults and refuses nonsense', () => {
    expect(topLimit(5)).toBe(5);
    expect(topLimit('5')).toBe(5);
    expect(topLimit(MAX_TOP_LIMIT + 1)).toBe(MAX_TOP_LIMIT);
    expect(topLimit(0)).toBe(DEFAULT_TOP_LIMIT);
    expect(topLimit(-3)).toBe(DEFAULT_TOP_LIMIT);
    expect(topLimit(1.5)).toBe(DEFAULT_TOP_LIMIT);
    expect(topLimit('all of them')).toBe(DEFAULT_TOP_LIMIT);
    expect(topLimit(undefined)).toBe(DEFAULT_TOP_LIMIT);
    expect(topLimit(null)).toBe(DEFAULT_TOP_LIMIT);
  });
});
