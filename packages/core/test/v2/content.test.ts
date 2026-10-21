import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content.ts';
import {
  BANNED_WORDS,
  LAUNCH_CAST,
  VERDICTS,
  bestVerdict,
  bestWorth,
  ceiling,
  contentSchema,
  findCharacter,
  findCharacterForSkill,
  findSkill,
  lintContent,
  worth,
} from '../../src/v2/content.ts';
import type { Content } from '../../src/v2/content.ts';
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

  it('rejects unknown keys, empty text and a verdict outcome for leave', () => {
    const extra = variant() as Record<string, unknown>;
    extra['score'] = 1000;
    expect(() => loadContent(extra)).toThrow(ContentError);
    const blank = variant();
    blank.skills[0]!.promise = '   ';
    expect(() => loadContent(blank)).toThrow(/promise/);
    // Leaving is nothing by rule, not by data: content cannot give it points or a wolf.
    const leave = variant();
    (leave.skills[0]!.did as Record<string, unknown>)['leave'] = { line: 'x', points: 900 };
    expect(() => loadContent(leave)).toThrow(ContentError);
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

describe('worth: the one rule scoring and the lint share', () => {
  it('is points, less the wolf cost when the skill served the wolf, and leaving is always 0', () => {
    const c = parsed();
    const { wolfCost } = c.scoring;
    for (const s of c.skills) {
      expect(worth(s, 'leave', c)).toBe(0);
      for (const v of ['take', 'limit'] as const) {
        const d = s.did[v];
        expect(worth(s, v, c)).toBe(d.points - (d.wolf === undefined ? 0 : wolfCost));
      }
    }
  });

  it('picks the verdict worth most, and settles a tie on the safer verdict', () => {
    const c = parsed();
    expect(bestVerdict(skill(c, 'lantern'), c)).toBe('take');
    expect(bestVerdict(skill(c, 'courier'), c)).toBe('limit');
    expect(bestVerdict(skill(c, 'locksmith'), c)).toBe('leave');
    // A tie between take and limit goes to limit; a tie with leave goes to leave.
    const lantern = skill(c, 'lantern');
    lantern.did.limit.points = lantern.did.take.points;
    expect(bestVerdict(lantern, c)).toBe('limit');
    const zero = skill(c, 'courier');
    zero.did.limit.points = 0;
    zero.did.take.points = 0;
    expect(bestVerdict(zero, c)).toBe('leave');
  });

  it('ceiling is the sum of the best worth of every skill', () => {
    const c = parsed();
    const sum = c.skills.reduce((t, s) => t + Math.max(...VERDICTS.map((v) => worth(s, v, c))), 0);
    expect(ceiling(c)).toBe(sum);
    expect(c.skills.map((s) => bestWorth(s, c))).toEqual(
      c.skills.map((s) => worth(s, bestVerdict(s, c), c)),
    );
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
      /skill "lantern" must be offered by exactly one character \(found 0\)/,
    ],
    [
      'a limit that earns more than taking it in full',
      (c) => void (skill(c, 'lantern').did.limit.points = 700),
      /lantern.*limit earns more than take/,
    ],
    [
      'a limit that serves the wolf when taking it in full does not',
      (c) => void (skill(c, 'lantern').did.limit.wolf = 'x'),
      /lantern.*limit serves the wolf and take does not/,
    ],
    [
      'a skill that serves the wolf and still comes out ahead',
      (c) => void (skill(c, 'courier').did.take.points = 500),
      /courier.*take serves the wolf but is worth 0/,
    ],
    [
      'a ceiling that is not the score the player is told it is out of',
      (c) => void (c.scoring.outOf = 1200),
      /best possible run scores 1000, but the score is shown out of 1200/,
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

  it('holds a launch build to six or seven skills and no placeholder text', () => {
    expect(LAUNCH_CAST).toEqual({ min: 6, max: 7 });
    const c = parsed();
    expect(lintContent(c)).toEqual([]);
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(
      /a launch build needs 6 to 7 skills \(found 3\)/,
    );
    c.strings['x'] = 'PLACEHOLDER copy';
    expect(lintContent(c, { launch: true }).join('\n')).toMatch(/strings\.x: placeholder text/);
    expect(lintContent(c)).toEqual([]);
  });

  it('a launch-sized cast passes the count check, at both ends', () => {
    for (const size of [6, 7]) {
      const c = parsed();
      const [first] = c.skills;
      for (let i = c.skills.length; i < size; i++) {
        c.skills.push({ ...structuredClone(first!), id: `extra-${i}` });
        c.characters.push({
          ...structuredClone(c.characters[0]!),
          id: `extra-c-${i}`,
          spawn: `spawn-extra-${i}`,
          skillId: `extra-${i}`,
        });
      }
      expect(lintContent(c, { launch: true }).join('\n')).not.toMatch(/launch build needs/);
    }
  });
});
