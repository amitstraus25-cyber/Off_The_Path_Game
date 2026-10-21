import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOP_LIMIT,
  HANDLE_FIRST_WORDS,
  HANDLE_MAX_LENGTH,
  HANDLE_SECOND_WORDS,
  MAX_TOP_LIMIT,
  handleSchema,
  isMintedHandle,
  mintHandle,
  submitResponseSchema,
  topLimit,
  topResponseSchema,
} from '../src/leaderboard.ts';

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

  it('reaches every word in both lists as the rng walks', () => {
    /*
     * This used to mint ninety handles and assert that more than thirty of them differed, which
     * the two-digit number alone guarantees: re-run with ONE-WORD lists and it still passed. The
     * claim worth making is that the pick reaches the whole of both lists and nothing outside
     * them, so that is what is asserted -- one step per index, and the sets must come out equal.
     */
    const firsts = new Set<string>();
    const seconds = new Set<string>();
    for (let i = 0; i < HANDLE_FIRST_WORDS.length; i++) {
      const [first, second] = mintHandle(() => (i + 0.5) / HANDLE_FIRST_WORDS.length).split('-');
      firsts.add(first!);
      seconds.add(second!);
    }
    expect([...firsts]).toEqual([...HANDLE_FIRST_WORDS]);
    expect([...seconds]).toEqual([...HANDLE_SECOND_WORDS]);
  });

  it('is drawn from two lists that stay the shape the table and the policy need', () => {
    for (const [name, list, longest] of [
      ['first', HANDLE_FIRST_WORDS, 5],
      ['second', HANDLE_SECOND_WORDS, 7],
    ] as const) {
      expect(list, name).toHaveLength(32);
      expect(new Set(list).size, name).toBe(list.length);
      // Sorted, so a duplicate or a misfiled word is visible in a diff.
      expect([...list], name).toEqual([...list].sort());
      for (const word of list) {
        expect(word, word).toMatch(/^[a-z]+$/);
        expect(word.length, word).toBeLessThanOrEqual(longest);
      }
    }
    // The two lists do not overlap, which is why "offensive in either order" cannot arise at all.
    const shared = HANDLE_FIRST_WORDS.filter((w) =>
      (HANDLE_SECOND_WORDS as readonly string[]).includes(w),
    );
    expect(shared).toEqual([]);
  });

  it('mints nothing that reads as a person, which its own docstring requires', () => {
    /*
     * `amber`, `hazel` and `misty` in front of `robin`, `fern` or `brook` minted a plausible real
     * name on a public, Cyera-branded board -- about 4% of handles. The words are gone; this is
     * the guard, because the trap is the next innocuous-looking addition (`rose`, `holly`, `ivy`)
     * rather than the words that have already been taken out.
     */
    const names = [
      'amber',
      'basil',
      'brook',
      'clover',
      'daisy',
      'dawn',
      'ember',
      'fern',
      'hazel',
      'heather',
      'holly',
      'iris',
      'ivy',
      'jasmine',
      'june',
      'laurel',
      'may',
      'meadow',
      'misty',
      'olive',
      'pearl',
      'robin',
      'rose',
      'ruby',
      'sky',
      'willow',
      'wren',
    ];
    for (const word of [...HANDLE_FIRST_WORDS, ...HANDLE_SECOND_WORDS])
      expect(names, word).not.toContain(word);
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
