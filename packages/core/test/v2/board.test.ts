import { describe, expect, it } from 'vitest';
import {
  HANDLE_FIRST_WORDS,
  HANDLE_SECOND_WORDS,
  HANDLE_MAX_LENGTH,
} from '../../src/leaderboard.ts';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  boardEntrySchema,
  boardResponseSchema,
  checkName,
  isBoardName,
  postResponseSchema,
  tidyName,
} from '../../src/v2/board.ts';
import type { NameRefusal } from '../../src/v2/board.ts';

/*
 * FREE NAMES, FENCED (board.ts). Every rule from both sides: what it refuses, and the ordinary names
 * it must let through -- a name filter that refuses "Assaf" or "Kshitij" is a worse defect on a
 * public page than the word it was written to stop.
 */

const refused = (raw: unknown): NameRefusal | null => {
  const c = checkName(raw);
  return c.ok ? null : c.reason;
};

describe('a name is tidied into one spelling before anything else is asked of it', () => {
  it('trims, collapses runs of whitespace, straightens apostrophes and dashes, and NFC-normalises', () => {
    expect(tidyName('  Amit \t  Straus  ')).toBe('Amit Straus');
    expect(tidyName('O’Brien')).toBe("O'Brien");
    expect(tidyName('Jean–Luc')).toBe('Jean-Luc');
    expect(tidyName('José')).toBe('José');
    expect(checkName('  Little  Purple ')).toEqual({ ok: true, name: 'Little Purple' });
  });
});

describe('what goes on the board', () => {
  it('ordinary names in many languages, with accents, digits, hyphens and apostrophes', () => {
    for (const name of [
      'Amit',
      'Ido',
      'Assaf',
      'Kshitij',
      'Dickens',
      'Sexton',
      'Pornchai',
      'Nigel',
      'Fukuda',
      'Therapist Tom',
      "O'Brien",
      'Jean-Luc',
      'José',
      'Zoë 2026',
      'Łukasz',
      'Ünal',
      'אמית',
      'Алёна',
      'さくら',
      'محمد',
      'नमस्ते',
      'Wolf Spotter 7',
      'Ana',
    ])
      expect(checkName(name), name).toEqual({ ok: true, name: tidyName(name) });
  });

  it('every handle the game can suggest: all 32 x 32 word pairs with every number from 10 to 99', () => {
    const bad: string[] = [];
    for (const a of HANDLE_FIRST_WORDS)
      for (const b of HANDLE_SECOND_WORDS)
        for (let n = 10; n < 100; n++)
          if (!isBoardName(`${a}-${b}-${n}`)) bad.push(`${a}-${b}-${n}`);
    expect(bad).toEqual([]);
  });

  it('is 3 to 16 characters, counted as the table counts them', () => {
    expect(NAME_MIN_LENGTH).toBe(3);
    expect(NAME_MAX_LENGTH).toBe(HANDLE_MAX_LENGTH);
    expect(refused('Al')).toBe('short');
    expect(refused('   ')).toBe('short');
    expect(refused('Abc')).toBeNull();
    expect(refused('a'.repeat(16))).toBeNull();
    expect(refused('a'.repeat(17))).toBe('long');
    // Sixteen letters outside the BMP are sixteen characters to Postgres, not thirty-two.
    expect(refused('\u{10400}'.repeat(16))).toBeNull();
    expect(refused('x'.repeat(65))).toBe('long');
    expect(refused(42)).toBe('long');
  });
});

describe('what is refused, and why', () => {
  it('characters outside letters, digits, spaces, hyphens and apostrophes, and a bad shape', () => {
    for (const name of [
      '<script>',
      'amit@cyera',
      'a.b.c',
      'semi;colon',
      'zero​width',
      'emoji \u{1F43A}',
      '-dash',
      'dash-',
      "'quote",
      'two  -- dashes',
      "it''s",
      'a -b',
      '12345',
      // NFC folds the first mark into the e; four more stay stacked on it.
      `e${'\u0301'.repeat(5)}x`,
      'a ́bc',
    ])
      expect(refused(name), name).toBe('characters');
  });

  it('anything that looks like contact details', () => {
    for (const name of [
      'call 0541234567',
      'tel 555 1234',
      'agent 12345',
      'www cyera',
      'http wolf',
      'cyera com',
      'shop-io',
      'me at gmail',
      'amit dot straus',
    ])
      expect(refused(name), name).toBe('contact');
    expect(refused('Zoe 2026')).toBeNull();
  });

  it('slurs and rude words, through case, accents, digit swaps and stretched letters', () => {
    for (const name of [
      'FUCK',
      'fuuuuck you',
      'Fück',
      'f4gg0t',
      'sh1t',
      'big ass',
      'A S S',
      'a-s-s',
      'Hitler fan',
      'b1tch',
      'porn star',
      'cyera admin',
      'Official Cyera',
      'tiiits',
    ])
      expect(refused(name), name).toBe('blocked');
  });
});

/*
 * THE SECURITY REVIEW'S ROUND (2026-10-22). Every name in the `refused` lists below WENT ON THE
 * BOARD under the gate before it -- proved by running this file against that board.ts, where each
 * of these `it`s fails -- and every name in the `passes` lists is a person the wider gate must not
 * turn away. A refusal list with no pass list beside it is how a filter starts refusing Assaf.
 */

describe('lookalike letters are read as the Latin letters they are dressed as', () => {
  it('refuses a reserved or rude word spelt in Cyrillic, Greek, Armenian, small capitals, fullwidth or ł', () => {
    for (const name of [
      'Аdmin', // Cyrillic А
      'Сyеrа', // Cyrillic С, е, а
      'Αdmin', // Greek Α
      'ΑDΜΙΝ', // Greek Α, Μ, Ι, Ν around a Latin D
      'Օfficial', // Armenian Օ
      'ᴀᴅᴍɪɴ', // small capitals
      'Ｃｙｅｒａ', // fullwidth
      '𝐂𝐲𝐞𝐫𝐚', // mathematical bold
      'Słut', // a Latin ł, which NFKD does not take apart
      'Fυck', // Greek υ
      'Аss', // Cyrillic А
    ])
      expect(refused(name), name).toBe('blocked');
  });

  it('reads contact details through lookalikes too', () => {
    for (const name of ['me at gmаil', 'ｗｗｗ wolf', 'shop-іo', 'ԝԝԝ wolf'])
      expect(refused(name), name).toBe('contact');
  });

  it('still lets a name written in its own script through, and stores it as typed', () => {
    for (const name of ['Νίκος', 'Олег', 'Алёна', 'Søren', 'Øystein', 'Łukasz', 'Ilkay', 'Ταμάρα'])
      expect(checkName(name), name).toEqual({ ok: true, name: tidyName(name) });
  });
});

describe('the brand and the staff are reserved', () => {
  it('anywhere in the name with its separators taken out, stretched or digit-swapped', () => {
    for (const name of [
      'Cyera',
      'Cyera CEO',
      'Cyera Support',
      'CyeraSupport',
      'Cy Era',
      'C y e r a',
      'Cyyyera',
      'Support Desk',
      'Suppport',
      'Staff Pick',
      'Superadmin',
      'Anthropic',
      'Claude Fan',
      'Real Claude',
    ])
      expect(refused(name), name).toBe('blocked');
  });

  it('the short ones, ceo and team, anywhere inside one word', () => {
    for (const name of ['CEO', 'TheCEO', 'C3O', 'C E O', 'Team Lead', 'Teamwolf'])
      expect(refused(name), name).toBe('blocked');
  });

  it('not across the join of a first name and a surname, nor inside an ordinary word', () => {
    for (const name of ['Grace Owen', "Joyce O'Neil", 'Kate Amis', 'Stafford', 'Badminton Ben'])
      expect(checkName(name), name).toEqual({ ok: true, name });
  });
});

describe('the wider blocklist', () => {
  it('slurs, sexual and violent abuse, and common profanity', () => {
    for (const name of [
      'Chink',
      'Coon',
      'Tranny',
      'Pedo',
      'Nazis',
      'Kill yourself',
      'Sieg heil',
      'Bullshit',
      'Dumbass',
      'Motherfcker',
      'Jackass',
      'Dickhead',
      'blow job',
      'Pussy Cat',
      'Spaz',
      'Gas the Jews',
      'White Power',
      'kys',
      'Wolf 1488',
      '14 88 wolf',
    ])
      expect(refused(name), name).toBe('blocked');
  });

  it('every entry stretched: a double letter in the word no longer hides it', () => {
    for (const name of ['asssss', 'niiigger', 'Big Aaass', 'pisssss'])
      expect(refused(name), name).toBe('blocked');
  });

  it('single letters typed apart are the word they spell, wherever they stand in the name', () => {
    for (const name of ['big a s s', 'the t i t s', 'k y s now'])
      expect(refused(name), name).toBe('blocked');
  });

  it('without refusing the ordinary names that hold those letters', () => {
    for (const name of [
      'Nazim',
      'Nazia Khan',
      'Coonan',
      'Cooney',
      'Pedro',
      'Torpedo',
      'Yamashita',
      'Jack Assaf',
      'Vince Stone',
      'Fred Skinner',
      'Karim Jobs',
      'Tran Ny',
      'Ashe Malek',
      'Abe Head',
      'Knut Sackett',
      'Killian',
      'Siegfried',
      'Nigel',
      'Hassan',
      'Glass Wolf',
      'Bass Player',
    ])
      expect(checkName(name), name).toEqual({ ok: true, name });
  });
});

describe('the wire shapes carry names, not just minted handles', () => {
  it('a stored name must already be tidy: the server stores what checkName returned', () => {
    expect(isBoardName('Little Purple')).toBe(true);
    expect(isBoardName(' Little Purple')).toBe(false);
    expect(isBoardName('Little  Purple')).toBe(false);
    expect(isBoardName(null)).toBe(false);
  });

  it('a board row, a board and a post reply parse with a free name and refuse a poisoned one', () => {
    expect(boardEntrySchema.safeParse({ rank: 1, handle: 'Amit', score: 100 }).success).toBe(true);
    expect(boardEntrySchema.safeParse({ rank: 1, handle: '<img src=x>', score: 1 }).success).toBe(
      false,
    );
    expect(
      boardResponseSchema.safeParse({ entries: [{ rank: 1, handle: 'Amit', score: 70 }] }).success,
    ).toBe(true);
    expect(postResponseSchema.safeParse({ handle: 'Amit', score: 70 }).success).toBe(true);
    expect(
      postResponseSchema.safeParse({
        handle: 'Amit',
        score: 70,
        rank: 3,
        entries: [{ rank: 3, handle: 'Amit', score: 70 }],
      }).success,
    ).toBe(true);
    expect(postResponseSchema.safeParse({ handle: 'Amit', score: 70, rank: null }).success).toBe(
      true,
    );
    expect(postResponseSchema.safeParse({ handle: 'Amit', score: 70, rank: 0 }).success).toBe(
      false,
    );
  });
});
