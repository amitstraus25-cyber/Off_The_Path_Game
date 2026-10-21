import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content.ts';
import {
  BANNED_WORDS,
  GIVEAWAY_WORDS,
  LAUNCH_CAST,
  VERDICTS,
  ceiling,
  contentSchema,
  findCharacter,
  findCharacterForSkill,
  findSkill,
  giveaway,
  lintContent,
} from '../../src/v2/content.ts';
import type { Content } from '../../src/v2/content.ts';
import {
  SEED_LIMIT,
  bestVerdict,
  deal,
  dealCount,
  everySeed,
  isSeed,
  kindOf,
  variantOf,
} from '../../src/v2/deal.ts';
import { loadContent } from '../../src/v2/load.ts';
import { raw, variant } from './fixture.ts';

const parsed = (): Content => contentSchema.parse(variant());
const skill = (c: Content, id: string) => c.skills.find((s) => s.id === id)!;

describe('v2 fixture', () => {
  it('loads, lints clean and finds what it holds', () => {
    const c = loadContent(raw);
    expect(lintContent(c)).toEqual([]);
    expect(findSkill(c, 'courier')?.name).toBe('Fixture Courier');
    expect(findSkill(c, 'nope')).toBeUndefined();
    expect(findCharacter(c, 'fox')?.skillId).toBe('locksmith');
    expect(findCharacter(c, 'nope')).toBeUndefined();
    expect(findCharacterForSkill(c, 'lantern')?.id).toBe('glowworm');
    expect(findCharacterForSkill(c, 'nope')).toBeUndefined();
  });
});

describe('schema', () => {
  it('is tagged with the rules it was written for, so v1 content can never load as v2', () => {
    const v1 = variant() as Record<string, unknown>;
    v1['rules'] = 1;
    expect(() => loadContent(v1)).toThrow(ContentError);
    const untagged = variant() as Record<string, unknown>;
    delete untagged['rules'];
    expect(() => loadContent(untagged)).toThrow(/rules/);
  });

  it('rejects unknown keys, empty text, and a third verdict', () => {
    const extra = variant() as Record<string, unknown>;
    extra['score'] = 1000;
    expect(() => loadContent(extra)).toThrow(ContentError);
    const blank = variant();
    blank.skills[0]!.promise = '   ';
    expect(() => loadContent(blank)).toThrow(/promise/);
    const limitCard = variant();
    (limitCard.skills[0]!.good.card as Record<string, unknown>)['limit'] = 'Fixture card: some.';
    expect(() => loadContent(limitCard)).toThrow(ContentError);
    expect(VERDICTS).toEqual(['take', 'leave']);
  });

  /*
   * NOTHING BEFORE THE CARD DIFFERS BETWEEN THE VARIANTS, held by construction: a variant is a card
   * and a reveal, strictly, so there is one name, promise, icon and greeting and nowhere to put a
   * second. Proved by trying to put one there.
   */
  it('refuses a variant that carries anything seen before the card', () => {
    for (const key of ['name', 'promise', 'icon', 'greet']) {
      const v = variant();
      (v.skills[0]!.bad as Record<string, unknown>)[key] = 'Fixture: a different one.';
      expect(() => loadContent(v), key).toThrow(ContentError);
    }
  });

  it('lists every issue on the error', () => {
    try {
      loadContent({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      expect((e as ContentError).issues.length).toBeGreaterThan(3);
    }
  });
});

describe('the deal', () => {
  it('seeds 0 to dealCount-1 are every deal exactly once, in content order, and then it wraps', () => {
    const c = parsed();
    expect(dealCount(c)).toBe(3);
    expect(everySeed(c).map((s) => deal(c, s))).toEqual([['lantern'], ['courier'], ['locksmith']]);
    expect(deal(c, 3)).toEqual(deal(c, 0));
    expect(deal(c, SEED_LIMIT - 1)).toEqual(deal(c, (SEED_LIMIT - 1) % 3));
  });

  it('a seed is a 32-bit unsigned integer; anything else is refused', () => {
    expect([0, 1, SEED_LIMIT - 1].map(isSeed)).toEqual([true, true, true]);
    expect([-1, 0.5, SEED_LIMIT, Number.NaN, '1', null].map(isSeed)).toEqual(Array(6).fill(false));
    expect(() => deal(parsed(), -1)).toThrow(/not a seed: -1/);
  });

  it('picks larger hands too: seven choose three is 35 distinct deals of three', () => {
    const c = parsed();
    for (let i = 0; i < 4; i++) {
      const s = structuredClone(c.skills[0]!);
      c.skills.push({ ...s, id: `extra-${i}` });
    }
    c.deal.good = 3;
    const hands = everySeed(c).map((s) => deal(c, s).join(','));
    expect(hands).toHaveLength(35);
    expect(new Set(hands).size).toBe(35);
    expect(hands.every((h) => h.split(',').length === 3)).toBe(true);
  });

  it('reads the dealt variant and the careful verdict off the good set', () => {
    const c = parsed();
    const good = deal(c, 1);
    expect(c.skills.map((s) => [s.id, kindOf(good, s.id), bestVerdict(good, s.id)])).toEqual([
      ['lantern', 'bad', 'leave'],
      ['courier', 'good', 'take'],
      ['locksmith', 'bad', 'leave'],
    ]);
    expect(variantOf(good, skill(c, 'courier'))).toBe(skill(c, 'courier').good);
    expect(variantOf(good, skill(c, 'lantern'))).toBe(skill(c, 'lantern').bad);
  });

  it('the ceiling is a clean arrival with every dealt-good skill taken', () => {
    const c = parsed();
    expect(ceiling(c)).toBe(c.scoring.clean + c.scoring.good * c.deal.good);
    expect(ceiling(c)).toBe(100);
  });
});

describe('the giveaway: the bad card is the good card and one line', () => {
  it('finds the replaced line and the added line', () => {
    const c = parsed();
    expect(giveaway(skill(c, 'lantern'))).toBe('Fixture: signals a stranger.');
    expect(giveaway(skill(c, 'courier'))).toBe('Fixture: and a copy elsewhere.');
    expect(giveaway(skill(c, 'locksmith'))).toBe('Fixture: opens any door.');
  });

  it('finds an added line wherever it stands, first, middle or last', () => {
    const c = parsed();
    const s = skill(c, 'lantern');
    const [a, b] = s.good.card.take as [string, string];
    for (const take of [
      ['x.', a, b],
      [a, 'x.', b],
      [a, b, 'x.'],
    ]) {
      s.bad.card.take = take;
      expect(giveaway(s), take.join(' | ')).toBe('x.');
    }
  });

  const cases: [string, (c: Content) => void, RegExp][] = [
    [
      'identical cards',
      (c) => void (skill(c, 'lantern').bad.card.take = [...skill(c, 'lantern').good.card.take]),
      /skill "lantern": the bad card must be the good card with exactly one new line/,
    ],
    [
      'two lines changed',
      (c) => void (skill(c, 'lantern').bad.card.take = ['Fixture: one.', 'Fixture: two.']),
      /skill "lantern": the bad card must be the good card with exactly one new line/,
    ],
    [
      'two lines added',
      (c) => void skill(c, 'courier').bad.card.take.push('Fixture: another.'),
      /skill "courier": the bad card must be the good card with exactly one new line/,
    ],
    [
      'a line taken away',
      (c) => void skill(c, 'lantern').bad.card.take.pop(),
      /skill "lantern": the bad card must be the good card with exactly one new line/,
    ],
    [
      'an "added" line that is a copy of one already there',
      (c) =>
        void (skill(c, 'courier').bad.card.take = [
          'Fixture: sends your word.',
          'Fixture: sends your word.',
        ]),
      /skill "courier": the bad card must be the good card with exactly one new line/,
    ],
    [
      'a different leave line',
      (c) => void (skill(c, 'locksmith').bad.card.leave = 'Fixture card: knock louder.'),
      /skill "locksmith": the bad card's leave line must be the good card's/,
    ],
    [
      'a giveaway over the word limit',
      (c) =>
        void (skill(c, 'locksmith').bad.card.take = [
          'Fixture: opens any door for anyone at all who happens to ask nicely.',
        ]),
      new RegExp(`skill "locksmith": the giveaway line is 13 words, at most ${GIVEAWAY_WORDS}`),
    ],
    [
      'one reveal line for both variants',
      (c) => void (skill(c, 'courier').bad.reveal = skill(c, 'courier').good.reveal),
      /skill "courier": the two variants need their own reveal lines/,
    ],
  ];
  for (const [name, mutate, expected] of cases)
    it(`flags ${name}`, () => {
      const c = parsed();
      mutate(c);
      expect(lintContent(c).join('\n')).toMatch(expected);
    });

  it('ten words is on the line and passes', () => {
    const c = parsed();
    skill(c, 'locksmith').bad.card.take = ['one two three four five six seven eight nine ten.'];
    expect(lintContent(c)).toEqual([]);
  });
});

describe('lint rules', () => {
  const cases: [string, (c: Content) => void, RegExp][] = [
    ['duplicate skill id', (c) => void (c.skills[1]!.id = c.skills[0]!.id), /duplicate skill id/],
    [
      'duplicate character id',
      (c) => void (c.characters[1]!.id = c.characters[0]!.id),
      /duplicate character id/,
    ],
    [
      'duplicate spawn',
      (c) => void (c.characters[1]!.spawn = c.characters[0]!.spawn),
      /duplicate spawn/,
    ],
    [
      'a character offering an unknown skill',
      (c) => void (c.characters[0]!.skillId = 'ghost'),
      /offers unknown skill "ghost"/,
    ],
    [
      'a skill nobody offers',
      (c) => void (c.characters[0]!.skillId = c.characters[1]!.skillId),
      /skill "courier" must be offered by exactly one character \(found 0\)/,
    ],
    [
      'a deal with nothing bad in it',
      (c) => void (c.deal.good = 3),
      /a deal of 3 good among 3 skills leaves nothing bad/,
    ],
    [
      'a ceiling that is not the score the player is told it is out of',
      (c) => void (c.scoring.outOf = 120),
      /best possible run scores 100, but the score is shown out of 120/,
    ],
    [
      'a banned vendor word',
      (c) => void (c.skills[0]!.promise = 'Works with Slack.'),
      /content\.skills\[0\]\.promise: banned vendor word "Slack"/,
    ],
  ];
  for (const [name, mutate, expected] of cases)
    it(`flags ${name}`, () => {
      const c = parsed();
      mutate(c);
      expect(lintContent(c).join('\n')).toMatch(expected);
    });

  it('bans every word on the list, whole words only', () => {
    for (const word of BANNED_WORDS) {
      const c = parsed();
      c.strings['x'] = `Fixture mentions ${word.toUpperCase()} here.`;
      expect(lintContent(c), word).toHaveLength(1);
    }
    const c = parsed();
    c.strings['x'] = 'Slackline and awsome are not vendors.';
    expect(lintContent(c)).toEqual([]);
  });

  it('holds a launch build to seven skills, three dealt good, and no placeholder text', () => {
    expect(LAUNCH_CAST).toEqual({ skills: 7, good: 3 });
    const c = parsed();
    expect(lintContent(c)).toEqual([]);
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(
      /a launch build needs 7 skills, 3 dealt good \(found 3, 1 good\)/,
    );
    c.strings['x'] = 'PLACEHOLDER copy';
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(/strings\.x: placeholder text/);
    expect(lintContent(c)).toEqual([]);
  });

  it('a launch-sized cast passes the count check only with seven skills and three good', () => {
    const grow = (extra: number, good: number): Content => {
      const c = parsed();
      for (let i = 0; i < extra; i++) {
        const id = `extra-${i}`;
        c.skills.push({ ...structuredClone(c.skills[0]!), id });
        c.characters.push({
          ...structuredClone(c.characters[0]!),
          id: `extra-c-${i}`,
          spawn: `spawn-extra-${i}`,
          skillId: id,
        });
      }
      c.deal.good = good;
      c.scoring.outOf = ceiling(c);
      return c;
    };
    expect(lintContent(grow(4, 3), { launch: true })).toEqual([]);
    expect(lintContent(grow(4, 2), { launch: true }).join('\n')).toMatch(/found 7, 2 good/);
    expect(lintContent(grow(5, 3), { launch: true }).join('\n')).toMatch(/found 8, 3 good/);
  });
});
