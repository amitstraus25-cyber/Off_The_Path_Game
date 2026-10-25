import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/v2/load.ts';
import {
  BANNED_WORDS,
  EFFECT_KINDS,
  EFFECT_MAX_MS,
  GIVEAWAY_WORDS,
  LAUNCH_CAST,
  REAL_WORLD_SENTENCES,
  REAL_WORLD_WORDS,
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
import { loadContent, parseContent } from '../../src/v2/load.ts';
import { raw, variant } from './fixture.ts';

const parsed = (): Content => contentSchema.parse(variant());
const skill = (c: Content, id: string) => c.skills.find((s) => s.id === id)!;
/** The fixture grown to seven skills, three dealt good, each offered by its own character. */
const sevenSkills = (): Content => {
  const c = parsed();
  for (let i = 0; i < 4; i++) {
    const id = `extra-${i}`;
    c.skills.push({ ...structuredClone(c.skills[0]!), id });
    c.characters.push({
      ...structuredClone(c.characters[0]!),
      id: `extra-c-${i}`,
      spawn: `spawn-extra-${i}`,
      skillId: id,
    });
  }
  c.deal.good = 3;
  c.scoring.outOf = ceiling(c);
  return c;
};

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

  it('holds the deal to its shape: a count, skill ids to always deal good, and groups of two or more', () => {
    const refused: [string, unknown][] = [
      ['a bare id for always', { good: 1, always: 'lantern' }],
      ['a flat list for oneOf', { good: 1, oneOf: ['lantern', 'courier'] }],
      ['a group of one', { good: 1, oneOf: [['lantern']] }],
      ['an id that is not a slug', { good: 1, always: ['Lantern!'] }],
      ['a stray key', { good: 1, never: ['lantern'] }],
    ];
    for (const [name, deal] of refused) {
      const v = variant() as Record<string, unknown>;
      v['deal'] = deal;
      expect(() => loadContent(v), name).toThrow(/deal/);
    }
    const v = variant() as Record<string, unknown>;
    v['deal'] = { good: 1, always: [], oneOf: [['lantern', 'courier', 'locksmith']] };
    expect(loadContent(v).deal).toEqual(v['deal']);
  });

  it('names a river by the effect kinds that cross it, at least one and each a kind the game has', () => {
    for (const crossing of [[], ['swim'], 'bridge-gate']) {
      const v = variant() as { world: Record<string, unknown> };
      v.world['crossing'] = crossing;
      expect(() => loadContent(v), JSON.stringify(crossing)).toThrow(/world\.crossing/);
    }
    // The fixture's locksmith opens a gate; a river it alone can cross parses. (Whether careful
    // can cross in every deal is the trap check's, and seed 0 deals the locksmith bad.)
    const v = variant() as { world: Record<string, unknown> };
    v.world['crossing'] = ['bridge-gate'];
    expect(parseContent(v).world.crossing).toEqual(['bridge-gate']);
    expect(() => loadContent(v)).toThrow(/trap: careful reaches the ceiling/);
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
    // Nor its own perk: what a taken skill does in the forest is the skill's, in both variants.
    const perk = variant();
    (perk.skills[0]!.bad as Record<string, unknown>)['effect'] = { kind: 'rewind', ms: 20_000 };
    expect(() => loadContent(perk)).toThrow(ContentError);
  });

  /*
   * THE PERK IS DATA, ONE OF THE KINDS THE GAME HAS (content.ts `EFFECT_KINDS`). Every skill needs
   * one; a kind the game has no code for, a number out of range, or a stray field is refused.
   */
  it('holds every skill to one perk of a known kind, with its numbers in range', () => {
    const none = variant() as { skills: Record<string, unknown>[] };
    delete none.skills[0]!['effect'];
    expect(() => loadContent(none)).toThrow(/effect/);
    const refused: unknown[] = [
      { kind: 'teleport-to-cottage' },
      { kind: 'walk-faster', factor: 1 },
      { kind: 'walk-faster', factor: 3 },
      { kind: 'rewind', ms: 0 },
      { kind: 'rewind', ms: EFFECT_MAX_MS + 1 },
      { kind: 'rewind', ms: 1.5 },
      { kind: 'wing-ride' },
      { kind: 'wing-ride', flightMs: -1, lands: 'fixture-landing' },
      { kind: 'wing-ride', flightMs: 1, lands: 'Not A Slug' },
      { kind: 'wing-ride', flightMs: 1 },
      { kind: 'minimap', ms: 5 },
    ];
    for (const effect of refused) {
      const v = variant();
      (v.skills[0] as Record<string, unknown>)['effect'] = effect;
      expect(() => loadContent(v), JSON.stringify(effect)).toThrow(ContentError);
    }
    const kinds = [
      { kind: 'minimap' },
      { kind: 'bridge-gate' },
      { kind: 'early-welcome' },
      { kind: 'wing-ride', flightMs: 0, lands: 'fixture-landing' },
      { kind: 'walk-faster', factor: 2 },
      { kind: 'lantern' },
      { kind: 'rewind', ms: EFFECT_MAX_MS },
    ];
    expect(kinds.map((k) => k.kind)).toEqual([...EFFECT_KINDS]);
    for (const effect of kinds) {
      const v = variant();
      (v.skills[0] as Record<string, unknown>)['effect'] = effect;
      expect(loadContent(v).skills[0]!.effect, effect.kind).toEqual(effect);
    }
  });

  it('holds the knock and the dusk to their ranges: never more than half dark, never dark from the start', () => {
    const refused: [string, (v: ReturnType<typeof variant>) => void, RegExp][] = [
      ['a negative knock', (v) => void (v.world.knockMs = -1), /world\.knockMs/],
      [
        'a knock longer than a perk may be',
        (v) => void (v.world.knockMs = EFFECT_MAX_MS + 1),
        /knockMs/,
      ],
      ['a dusk darker than half', (v) => void (v.world.dusk.darkest = 0.51), /darkest/],
      ['no dusk at all', (v) => void (v.world.dusk.darkest = 0), /darkest/],
      ['a dusk that never starts', (v) => void (v.world.dusk.fromLeftMs = 0), /fromLeftMs/],
      [
        'a dusk from before the clock starts',
        (v) => void (v.world.dusk.fromLeftMs = 180_001),
        /would open in the dark/,
      ],
    ];
    for (const [name, mutate, message] of refused) {
      const v = variant();
      mutate(v);
      expect(() => loadContent(v), name).toThrow(message);
    }
    const whole = variant();
    whole.world.dusk.fromLeftMs = 180_000;
    whole.world.dusk.darkest = 0.5;
    expect(loadContent(whole).world.dusk).toEqual({ fromLeftMs: 180_000, darkest: 0.5 });
  });

  it('needs a real-world note on every skill, and only the ui keys the screens ask for', () => {
    const bare = variant() as { skills: Record<string, unknown>[] };
    delete bare.skills[0]!['realWorld'];
    expect(() => loadContent(bare)).toThrow(/realWorld/);
    const stray = variant();
    (stray.ui.reveal as Record<string, unknown>)['subtitle'] = 'Fixture: a key nobody asked for.';
    expect(() => loadContent(stray)).toThrow(ContentError);
    const noHud = variant() as Record<string, unknown>;
    delete (noHud['ui'] as Record<string, unknown>)['hud'];
    expect(() => loadContent(noHud)).toThrow(/ui\.hud/);
  });

  it('holds the chrome to its named keys, no fewer and no more', () => {
    const missing = variant();
    delete (missing.ui.chrome as Record<string, unknown>)['postUnavailable'];
    expect(() => loadContent(missing)).toThrow(/ui\.chrome\.postUnavailable/);
    const stray = variant();
    (stray.ui.chrome as Record<string, unknown>)['postLater'] = 'Fixture: a typo of a key.';
    expect(() => loadContent(stray)).toThrow(ContentError);
    expect(() => loadContent(variant())).not.toThrow();
  });

  // The card opens by itself (the client, 2026-10-22): a key for a step that no longer exists is
  // refused, so it cannot come back as copy nothing renders.
  it('has no key for opening the card, which opens by itself', () => {
    const stale = variant();
    (stale.ui.offer as Record<string, unknown>)['openCard'] = 'Fixture open';
    expect(() => loadContent(stale)).toThrow(/ui\.offer/);
  });

  it('holds every template to the holes its screen fills', () => {
    const cases: [string, (c: ReturnType<typeof variant>) => void, RegExp][] = [
      ['outOf', (c) => void (c.ui.reveal.outOf = 'Fixture of a hundred'), /\{outOf\}/],
      ['caught', (c) => void (c.ui.reveal.caught = 'Fixture caught {caught}'), /\{bad\}/],
      ['caught', (c) => void (c.ui.reveal.caught = 'Fixture caught of {bad}'), /\{caught\}/],
    ];
    for (const [key, spoil, hole] of cases) {
      const v = variant();
      spoil(v);
      expect(() => loadContent(v), key).toThrow(hole);
    }
  });

  it('holds the how-to to three or four lines', () => {
    for (const n of [2, 5]) {
      const v = variant();
      v.ui.howTo.steps = Array.from({ length: n }, (_x, i) => `Fixture: step ${i}.`);
      expect(() => loadContent(v), `${n} steps`).toThrow(/ui\.howTo\.steps/);
    }
    const four = variant();
    four.ui.howTo.steps.push('Fixture: arrive.');
    expect(() => loadContent(four)).not.toThrow();
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

  /*
   * BACK-COMPATIBLE BY CONSTRUCTION: a deal with no `always` and no `oneOf` is the plain
   * lexicographic unranking it always was. The 35 hands are rebuilt here by three nested loops,
   * independently of deal.ts, and every seed must name the same hand it named before rules 3.
   */
  it('without always or oneOf, seed n is still the n-th hand in lexicographic order', () => {
    const c = sevenSkills();
    const ids = c.skills.map((s) => s.id);
    const lexicographic: string[][] = [];
    for (let a = 0; a < 7; a++)
      for (let b = a + 1; b < 7; b++)
        for (let d = b + 1; d < 7; d++) lexicographic.push([ids[a]!, ids[b]!, ids[d]!]);
    expect(dealCount(c)).toBe(35);
    expect(everySeed(c).map((s) => deal(c, s))).toEqual(lexicographic);
    // Empty constraints are no constraints.
    c.deal.always = [];
    c.deal.oneOf = [];
    expect(everySeed(c).map((s) => deal(c, s))).toEqual(lexicographic);
  });

  /*
   * THE GATEKEEPER'S DEAL (docs/GATEKEEPER.md): one skill always good, exactly one of a pair good,
   * and the third good drawn from the other four. 1 x 2 x 4 = 8 deals, each exactly once.
   */
  it('always and oneOf: the always skill in every hand, one of each group, the rest drawn from the others', () => {
    const c = sevenSkills();
    const [a, b, d, ...rest] = c.skills.map((s) => s.id) as [string, string, string, ...string[]];
    c.deal.always = [a];
    c.deal.oneOf = [[b, d]];
    expect(dealCount(c)).toBe(8);
    const hands = everySeed(c).map((s) => deal(c, s));
    expect(hands).toHaveLength(8);
    expect(new Set(hands.map((h) => h.join(','))).size).toBe(8);
    const order = c.skills.map((s) => s.id);
    for (const h of hands) {
      expect(h).toHaveLength(3);
      expect(h).toContain(a);
      expect([b, d].filter((x) => h.includes(x))).toHaveLength(1);
      expect(rest.filter((x) => h.includes(x))).toHaveLength(1);
      // In content order, like every hand.
      expect([...h].sort((x, y) => order.indexOf(x) - order.indexOf(y))).toEqual(h);
    }
    // Every free skill is good in a quarter of the deals, each of the pair in half.
    for (const x of rest)
      expect(
        hands.filter((h) => h.includes(x)),
        x,
      ).toHaveLength(2);
    for (const x of [b, d])
      expect(
        hands.filter((h) => h.includes(x)),
        x,
      ).toHaveLength(4);
    // Seed modulo the deal count: it wraps.
    expect(deal(c, 8)).toEqual(deal(c, 0));
    expect(deal(c, SEED_LIMIT - 1)).toEqual(deal(c, (SEED_LIMIT - 1) % 8));
    // The low digit is the free draw, then the groups: seeds 0 to 3 keep the pair's first member.
    expect(hands.slice(0, 4).every((h) => h.includes(b))).toBe(true);
    expect(hands.slice(4).every((h) => h.includes(d))).toBe(true);
  });

  it('several groups, and a deal the groups fill on their own', () => {
    const c = sevenSkills();
    const ids = c.skills.map((s) => s.id);
    c.deal.always = [ids[6]!];
    c.deal.oneOf = [
      [ids[0]!, ids[1]!],
      [ids[2]!, ids[3]!, ids[4]!],
    ];
    // 2 x 3 x (one other skill, none to draw) = 6.
    expect(dealCount(c)).toBe(6);
    const hands = everySeed(c).map((s) => deal(c, s).join(','));
    expect(new Set(hands).size).toBe(6);
    expect(hands.every((h) => !h.includes(ids[5]!))).toBe(true);
  });

  it('content that cannot be dealt has no deals, and dealing it says so', () => {
    const c = sevenSkills();
    c.deal.always = c.skills.slice(0, 4).map((s) => s.id);
    expect(dealCount(c)).toBe(0);
    expect(everySeed(c)).toEqual([]);
    expect(() => deal(c, 0)).toThrow(/no deals/);
    const thin = sevenSkills();
    thin.deal.good = 6;
    thin.deal.oneOf = [thin.skills.slice(0, 2).map((s) => s.id)];
    // Five to draw from the five others is one deal; six would be none.
    expect(dealCount(thin)).toBe(2);
    thin.deal.oneOf = [thin.skills.slice(0, 3).map((s) => s.id)];
    expect(dealCount(thin)).toBe(0);
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

  it('the ceiling is a clean arrival with every dealt-good skill taken, at par', () => {
    const c = parsed();
    expect(ceiling(c)).toBe(c.scoring.clean + c.scoring.good * c.deal.good + c.scoring.speed);
    expect(ceiling(c)).toBe(100);
  });
});

describe('the giveaway: the bad card is the good card with one line swapped', () => {
  it('finds the swapped line', () => {
    const c = parsed();
    expect(giveaway(skill(c, 'lantern'))).toBe('Fixture: signals a stranger.');
    expect(giveaway(skill(c, 'courier'))).toBe('Fixture: and a copy elsewhere.');
    expect(giveaway(skill(c, 'locksmith'))).toBe('Fixture: opens any door.');
  });

  /*
   * SWAPPED, NEVER ADDED: an added line makes the bad card the longer one, and then the line count
   * is the verdict without a word read. Refused wherever the extra line stands.
   */
  it('finds a swapped line in either place, and refuses an added line wherever it stands', () => {
    const c = parsed();
    const s = skill(c, 'lantern');
    const [a, b] = s.good.card.take as [string, string];
    for (const take of [
      ['x.', b],
      [a, 'x.'],
    ]) {
      s.bad.card.take = take;
      expect(giveaway(s), take.join(' | ')).toBe('x.');
    }
    for (const take of [
      ['x.', a, b],
      [a, 'x.', b],
      [a, b, 'x.'],
    ]) {
      s.bad.card.take = take;
      expect(giveaway(s), take.join(' | ')).toBeNull();
    }
  });

  const cases: [string, (c: Content) => void, RegExp][] = [
    [
      'identical cards',
      (c) => void (skill(c, 'lantern').bad.card.take = [...skill(c, 'lantern').good.card.take]),
      /skill "lantern": the bad card must be the good card with exactly one line swapped/,
    ],
    [
      'two lines changed',
      (c) => void (skill(c, 'lantern').bad.card.take = ['Fixture: one.', 'Fixture: two.']),
      /skill "lantern": the bad card must be the good card with exactly one line swapped/,
    ],
    [
      'a line added',
      (c) => void skill(c, 'courier').bad.card.take.push('Fixture: another.'),
      /skill "courier": the bad card must be the good card with exactly one line swapped/,
    ],
    [
      'a line taken away',
      (c) => void skill(c, 'lantern').bad.card.take.pop(),
      /skill "lantern": the bad card must be the good card with exactly one line swapped/,
    ],
    [
      'a swapped-in line that is a copy of one already there',
      (c) =>
        void (skill(c, 'courier').bad.card.take = [
          'Fixture: sends your word.',
          'Fixture: sends your word.',
        ]),
      /skill "courier": the bad card must be the good card with exactly one line swapped/,
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
      'a real-world note over the word limit',
      (c) =>
        void (skill(c, 'courier').realWorld.note = Array(REAL_WORLD_WORDS + 1)
          .fill('word')
          .join(' ')),
      new RegExp(
        `skill "courier": the real-world note is ${REAL_WORLD_WORDS + 1} words in 1 sentences, at most ${REAL_WORLD_WORDS} in ${REAL_WORLD_SENTENCES}`,
      ),
    ],
    [
      'a real-world note of three sentences',
      (c) => void (skill(c, 'courier').realWorld.note = 'Fixture one. Fixture two! Fixture three?'),
      /skill "courier": the real-world note is 6 words in 3 sentences/,
    ],
    [
      'a landing highlight that is not a word of its title',
      (c) => void (c.ui.landing.titleHighlight = 'tit'),
      /ui\.landing: the highlight "tit" is not a word of "Fixture title"/,
    ],
    [
      'a reveal highlight that is not in its title',
      (c) => void (c.ui.reveal.titleHighlight = 'wolf'),
      /ui\.reveal: the highlight "wolf" is not a word of "Fixture reveal"/,
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

  it('ten words is on the line and passes; so is a two-sentence note of twenty-five', () => {
    const c = parsed();
    skill(c, 'locksmith').bad.card.take = ['one two three four five six seven eight nine ten.'];
    skill(c, 'courier').realWorld.note =
      `${Array(12).fill('word').join(' ')}. ${Array(13).fill('word').join(' ')}.`;
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
      'an always-good skill the content does not have',
      (c) => void (c.deal.always = ['ghost']),
      /deal\.always names unknown skill "ghost"/,
    ],
    [
      'a oneOf group naming a skill the content does not have',
      (c) => void (c.deal.oneOf = [['lantern', 'ghost']]),
      /deal\.oneOf\[0\] names unknown skill "ghost"/,
    ],
    [
      'a skill both always good and in a oneOf group',
      (c) => {
        c.deal.good = 2;
        c.deal.always = ['lantern'];
        c.deal.oneOf = [['lantern', 'courier']];
      },
      /deal: skill "lantern" is named more than once across always and oneOf/,
    ],
    [
      'two oneOf groups that overlap',
      (c) => {
        c.deal.good = 2;
        c.deal.oneOf = [
          ['lantern', 'courier'],
          ['courier', 'locksmith'],
        ];
      },
      /deal: skill "courier" is named more than once across always and oneOf/,
    ],
    [
      'a skill named twice in one group',
      (c) => void (c.deal.oneOf = [['lantern', 'lantern']]),
      /deal: skill "lantern" is named more than once across always and oneOf/,
    ],
    [
      'more always-good skills and groups than the deal has good places',
      (c) => {
        c.deal.always = ['lantern'];
        c.deal.oneOf = [['courier', 'locksmith']];
      },
      /a deal of 1 good has no room for 1 always-good skills and 1 oneOf groups/,
    ],
    [
      'too few other skills to draw the rest of the good from',
      (c) => {
        c.deal.good = 3;
        c.deal.oneOf = [['lantern', 'courier']];
      },
      /a deal of 3 good must draw 2 more from the 1 skills outside always and oneOf/,
    ],
    [
      'a river nothing in the content can cross',
      (c) => void (c.world.crossing = ['wing-ride']),
      /world\.crossing: no skill has an effect that crosses the river \(wing-ride\)/,
    ],
    [
      'a ceiling that is not the score the player is told it is out of',
      (c) => void (c.scoring.outOf = 120),
      /best possible run scores 100, but the score is shown out of 120/,
    ],
    [
      'a speed bonus that lets a faster basket one good skill short outscore a full one',
      (c) => {
        c.deal.good = 2;
        c.scoring.speed = 90;
      },
      /a speed bonus of 90 lets a fast run with 1 good skills outscore a slow run with all 2/,
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
      c.ui.landing.subtitle = `Fixture mentions ${word.toUpperCase()} here.`;
      expect(lintContent(c), word).toHaveLength(1);
    }
    const c = parsed();
    c.ui.landing.subtitle = 'Slackline and awsome are not vendors.';
    expect(lintContent(c)).toEqual([]);
  });

  it('holds a launch build to seven skills, three dealt good, and no placeholder text', () => {
    expect(LAUNCH_CAST).toEqual({ skills: 7, good: 3 });
    const c = parsed();
    expect(lintContent(c)).toEqual([]);
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(
      /a launch build needs 7 skills, 3 dealt good \(found 3, 1 good\)/,
    );
    c.ui.reveal.again = 'PLACEHOLDER copy';
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(
      /ui\.reveal\.again: placeholder text/,
    );
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
