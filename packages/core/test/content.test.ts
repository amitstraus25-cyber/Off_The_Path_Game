import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';
import {
  ContentError,
  contentSchema,
  findCharacter,
  findSkill,
  lintContent,
  loadContent,
} from '../src/content.ts';
import type { Content } from '../src/content.ts';

const clone = (): Content => structuredClone(contentSchema.parse(raw));
const skill = (c: Content, id: string) => c.skills.find((s) => s.id === id)!;

describe('game.json', () => {
  it('loads and lints clean', () => {
    const c = loadContent(raw);
    expect(lintContent(c)).toEqual([]);
    expect(findSkill(c, 'night-light')?.finePrint).toBeUndefined();
    expect(findSkill(c, 'nope')).toBeUndefined();
    expect(findCharacter(c, 'owl')?.skillId).toBe('word-weaver');
    expect(findCharacter(c, 'nope')).toBeUndefined();
  });
});

describe('schema', () => {
  it('rejects unknown keys, empty strings and bad enums with a readable list', () => {
    const bad = structuredClone(raw) as Record<string, unknown>;
    bad['extra'] = 1;
    expect(() => loadContent(bad)).toThrow(ContentError);
    const empty = structuredClone(raw);
    empty.characters[0]!.greet = '   ';
    expect(() => loadContent(empty)).toThrow(/greet/);
    const badFlag = structuredClone(raw);
    (badFlag.skills[0]!.outcomes.allow.flagsSet as string[]) = ['nope'];
    expect(() => loadContent(badFlag)).toThrow(ContentError);
  });
  it('exposes issues on the error', () => {
    try {
      loadContent({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ContentError);
      expect((e as ContentError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe('lint rules', () => {
  const cases: [string, (c: Content) => void, RegExp][] = [
    ['duplicate skill id', (c) => void (c.skills[1]!.id = c.skills[0]!.id), /duplicate skill id/],
    [
      'duplicate spawn',
      (c) => void (c.characters[1]!.spawn = c.characters[0]!.spawn),
      /duplicate spawn/,
    ],
    [
      'unknown skill on a character',
      (c) => void (c.characters[0]!.skillId = 'ghost'),
      /unknown skill "ghost"/,
    ],
    ['character missing a question', (c) => void c.characters[0]!.asks.pop(), /exactly one each/],
    [
      'skill offered twice',
      (c) => void (c.characters[1]!.skillId = c.characters[0]!.skillId),
      /exactly one character/,
    ],
    ['empty bonus questions', (c) => void (c.scoring.bonusQuestions = []), /must not be empty/],
    ['show earns bonus', (c) => void c.scoring.bonusQuestions.push('show'), /"show" cannot/],
    [
      'no safe skill',
      (c) => {
        const s = skill(c, 'night-light');
        s.finePrint = { title: 'x', detail: 'y', flag: 'locationLeaked' };
        s.outcomes.allow.flagsSet = ['locationLeaked'];
        s.bestVerdict = 'reject';
        s.outcomes.reject.points = 300;
        s.outcomes.allow.points = 0;
      },
      /at least one skill must have no finePrint/,
    ],
    [
      'best verdict not max',
      (c) => void (skill(c, 'cottage-finder').outcomes.reject.points = 301),
      /maximum points/,
    ],
    [
      'best verdict not maxPerSkill',
      (c) => void (c.scoring.maxPerSkill = 400),
      /maxPerSkill \(400\)/,
    ],
    [
      'points exceed max',
      (c) => void (skill(c, 'night-light').outcomes.restrict.points = 999),
      /exceed maxPerSkill/,
    ],
    [
      'flag without finePrint',
      (c) => void skill(c, 'night-light').outcomes.reject.flagsSet.push('keyStolen'),
      /has no finePrint but reject sets/,
    ],
    [
      'flag differs from finePrint',
      (c) => void skill(c, 'word-weaver').outcomes.reject.flagsSet.push('keyStolen'),
      /finePrint declares/,
    ],
    [
      'allow forgets the flag',
      (c) => void (skill(c, 'cottage-finder').outcomes.allow.flagsSet = []),
      /allow must set/,
    ],
    [
      'best verdict sets a flag',
      (c) => void (skill(c, 'cottage-finder').outcomes.restrict.flagsSet = ['keyStolen']),
      /best verdict must not set flags/,
    ],
    [
      'removes unknown item',
      (c) => void skill(c, 'night-light').outcomes.allow.basketRemoves.push('ghost'),
      /never in the basket/,
    ],
    [
      'restrict grants more than allow',
      (c) => {
        const s = c.skills.find((x) => x.id === 'night-light')!;
        s.outcomes.restrict.grants = ['strangers', 'word'];
      },
      /restrict: grants "word", which allow does not ask for/,
    ],
    [
      'restrict grants a longer list than allow',
      (c) => {
        const s = c.skills.find((x) => x.id === 'night-light')!;
        s.outcomes.allow.grants = [];
        s.outcomes.restrict.grants = ['strangers'];
      },
      /restrict must not grant more than allow/,
    ],
    [
      'reject grants something',
      (c) => void (c.skills[0]!.outcomes.reject.grants = ['basket']),
      /reject must grant nothing/,
    ],
    [
      'duplicate grants',
      (c) => void (c.skills[0]!.outcomes.allow.grants = ['basket', 'basket']),
      /duplicate grants/,
    ],
    [
      'a capability no skill can ever grant',
      (c) => {
        for (const s of c.skills)
          for (const v of ['allow', 'restrict'] as const) s.outcomes[v].grants = [];
      },
      /the trifecta cannot complete/,
    ],
    [
      'a capability with no label',
      (c) => void delete (c.capabilities as Record<string, unknown>)['word'],
      /capability "word" has no label/,
    ],
    [
      'errand goal needing a capability no verdict grants',
      (c) => {
        // Strip every grant of the capability the "sign" goal needs, so it becomes unwinnable.
        for (const s of c.skills)
          for (const v of ['allow', 'restrict', 'reject'] as const)
            s.outcomes[v].grants = s.outcomes[v].grants.filter((g) => g !== 'strangers');
      },
      /which no verdict ever grants/,
    ],
    [
      'errand goal naming an act that is not a notice',
      (c) => void (c.scoring.errandGoals[0]!.act = 'ghost'),
      /which is not a notice/,
    ],
    [
      'duplicate errand goal id',
      (c) => void c.scoring.errandGoals.push({ ...c.scoring.errandGoals[0]! }),
      /duplicate errand goal id/,
    ],
    [
      'notice removing an item that is never carried',
      (c) => void c.notices[0]!.whenExposed!.basketRemoves.push('ghost'),
      /never in the basket/,
    ],
    [
      'duplicate notice id',
      (c) => void c.notices.push({ ...c.notices[0]! }),
      /duplicate notice id/,
    ],
    [
      'basket item with no icon',
      (c) => void delete (c.items as Record<string, string>)['route'],
      /no icon in content\.items/,
    ],
    [
      'icon for an item that never reaches the basket',
      (c) => void ((c.items as Record<string, string>)['ghost'] = 'item-ghost'),
      /never reaches the basket/,
    ],
    [
      'basket overflow',
      (c) => {
        skill(c, 'night-light').outcomes.allow.basketAdds = ['lantern', 'a', 'b', 'c'];
        for (const extra of ['a', 'b', 'c'])
          (c.items as Record<string, string>)[extra] = 'item-key';
      },
      /only 5 slots/,
    ],
    [
      'ending range inverted',
      (c) => void (c.endings[2]!.when = { minFlags: 3, maxFlags: 1 }),
      /below minFlags/,
    ],
    [
      'ending gap',
      (c) => void (c.endings[1]!.when = { minFlags: 5, maxFlags: 5 }),
      /must match exactly one ending \(matched 0\)/,
    ],
    ['ending overlap', (c) => void (c.endings[0]!.when = { minFlags: 0 }), /matched 2/],
    [
      'banned vendor word',
      (c) => void (c.characters[0]!.greet = 'Made by OpenAI.'),
      /banned vendor word "OpenAI"/,
    ],
  ];
  it.each(cases)('flags: %s', (_name, mutate, pattern) => {
    const c = clone();
    mutate(c);
    expect(lintContent(c).join('\n')).toMatch(pattern);
  });

  it('placeholder markers are allowed by default and forbidden for launch', () => {
    const c = clone();
    c.status = 'PLACEHOLDER copy';
    expect(lintContent(c)).toEqual([]);
    expect(lintContent(c, { placeholders: 'forbid' }).join()).toMatch(/placeholder text/);
    expect(() =>
      loadContent({ ...raw, status: 'PLACEHOLDER' }, { placeholders: 'forbid' }),
    ).toThrow(ContentError);
  });
});
