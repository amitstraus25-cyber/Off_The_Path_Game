import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content.ts';
import { VERDICTS, bestVerdict, lintContent, worth } from '../../src/v2/content.ts';
import type { Content } from '../../src/v2/content.ts';
import { loadContent, parseContent } from '../../src/v2/load.ts';
import { checkRunLog, toRunLog } from '../../src/v2/runlog.ts';
import { score } from '../../src/v2/scoring.ts';
import {
  GREEDY_SHARE,
  ROTE_DEPTH,
  ROTE_SHARE,
  STRATEGIES,
  clockCheck,
  everyRun,
  foldWord,
  mulberry32,
  play,
  roteRuns,
  surfaceWords,
  table,
  trapChecks,
} from '../../src/v2/sim.ts';
import type { Pace } from '../../src/v2/sim.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { content } from './helpers.ts';
import { raw, variant } from './fixture.ts';

/** Who offers a skill in the fixture: `characters` is in walking order, not in `skills` order. */
const offererOf = (v: typeof raw, skillId: string) =>
  v.characters.find((c) => c.skillId === skillId)!;

/** Comfortably inside the clock for the fixture, so time never decides a test that is not about it. */
const brisk: Pace = { walkMs: 20_000, talkMs: 5_000 };

const unchecked = (mutate: (c: typeof raw) => void): Content => {
  const v = variant();
  mutate(v);
  // Parsed, and proved lint-clean, so that what refuses it below is the trap and nothing else.
  const c = parseContent(v);
  expect(lintContent(c)).toEqual([]);
  return c;
};

describe('strategies play through the real reducer', () => {
  it('every strategy reaches the cottage, and the server would accept its log', () => {
    for (const name of Object.keys(STRATEGIES)) {
      const p = play(content, name, { pace: brisk, seed: 3 });
      expect(p.state.phase, name).toBe('cottage');
      expect(checkRunLog(toRunLog(p.state), content), name).toMatchObject({ legal: true });
      expect(p.total).toBe(score(p.state.log, content).total);
    }
  });

  it('careful reads every card and gives every skill its best verdict', () => {
    const p = play(content, 'careful');
    // In the order met, which is content order -- the walking order, not `skills` order.
    expect(p.state.inspected).toEqual(content.characters.map((c) => c.skillId));
    expect(p.state.verdicts).toEqual(
      Object.fromEntries(content.skills.map((s) => [s.id, bestVerdict(s, content)])),
    );
  });

  it('greedy and leave-everything read nothing; limit-everything has to read everything', () => {
    expect(play(content, 'greedy').state.inspected).toEqual([]);
    expect(play(content, 'leave-all').state.inspected).toEqual([]);
    expect(play(content, 'limit-all').state.inspected).toEqual(
      content.characters.map((c) => c.skillId),
    );
    expect(Object.values(play(content, 'greedy').state.verdicts)).toEqual(['take', 'take', 'take']);
    expect(Object.values(play(content, 'leave-all').state.verdicts)).toEqual([
      'leave',
      'leave',
      'leave',
    ]);
  });

  it('random is seeded: one seed is one run, and the seeds between them try every verdict', () => {
    const a = play(content, 'random', { seed: 11 });
    expect(play(content, 'random', { seed: 11 }).state).toEqual(a.state);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++)
      for (const v of Object.values(play(content, 'random', { seed }).state.verdicts)) seen.add(v);
    expect([...seen].sort()).toEqual([...VERDICTS].sort());
  });

  it('mulberry32 is a unit interval and deterministic', () => {
    const r = mulberry32(5);
    const xs = Array.from({ length: 200 }, r);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(Array.from({ length: 200 }, mulberry32(5))).toEqual(xs);
  });

  it('refuses a strategy it does not know', () => {
    expect(() => play(content, 'cheat')).toThrow(/unknown strategy "cheat"/);
  });

  it('the table has one row per strategy, scored as the reducer and score() agree', () => {
    const rows = table(content, { pace: brisk, seed: 1 });
    expect(rows.map((r) => r.strategy)).toEqual(Object.keys(STRATEGIES));
    for (const r of rows)
      expect(r.total).toBe(play(content, r.strategy, { pace: brisk, seed: 1 }).total);
  });
});

describe('every combination, played', () => {
  it('everyRun plays all 3^n verdict combinations once each, scored as score() scores them', () => {
    const runs = everyRun(content);
    expect(runs).toHaveLength(VERDICTS.length ** content.skills.length);
    expect(new Set(runs.map((r) => r.verdicts.join(','))).size).toBe(runs.length);
    for (const r of runs) {
      // An independent sum, so the enumeration is checked against arithmetic and not only itself.
      const sum = content.skills.reduce((t, s, i) => t + worth(s, r.verdicts[i]!, content), 0);
      const served = content.skills.some(
        (s, i) => r.verdicts[i] !== 'leave' && s.did[r.verdicts[i] as 'take' | 'limit'].wolf,
      );
      expect(r.total, r.verdicts.join(',')).toBe(Math.max(0, sum));
      expect(r.ending, r.verdicts.join(',')).toBe(served ? 'wolf' : 'grandma');
    }
    const careful = content.skills.map((s) => bestVerdict(s, content));
    expect(runs.find((r) => r.verdicts.join(',') === careful.join(','))!.total).toBe(
      content.scoring.outOf,
    );
  });

  it('surfaceWords reads who offers it, their greeting, its name and its promise, and folds plurals', () => {
    const v = variant();
    offererOf(v, 'lantern').greet = "A traveller's tale. Travellers came, through the glass.";
    const c = parseContent(v);
    const w = surfaceWords(c, c.skills[0]!);
    for (const word of [
      'traveller',
      'tale',
      'came',
      'glass',
      'the',
      'glowworm',
      'lantern',
      'light',
    ])
      expect(w.has(foldWord(word)), word).toBe(true);
    for (const word of ["traveller's", 'travellers', 'glas', 'Fixture', 'lights'])
      expect(w.has(word), word).toBe(false);
    // The card is NOT surface: reading it is the inspection the rote player skips.
    expect(w.has('every')).toBe(false);
  });

  /*
   * THE FOLD, word by word. The first fold dropped a trailing "s" and nothing else, so "foxes" was
   * "foxe", "wishes" was "wishe" and "this" was "thi" -- and a refuter made a 1000-point rote rule
   * out of exactly that (the case is replayed against the real content in real-content.test.ts).
   * Each pair below must meet; each word in the last list must be left alone.
   */
  it('foldWord folds -s, -es, -ies, -ed, -ied, -ing and possessives, and leaves short and double-s words alone', () => {
    for (const [a, b] of [
      ['fox', 'foxes'],
      ['fox', "fox's"],
      ['wish', 'wishes'],
      ['glass', 'glasses'],
      ['berry', 'berries'],
      ['walk', 'walked'],
      ['walk', 'walking'],
      ['walk', 'walks'],
      ['carry', 'carried'],
      ['carry', 'carries'],
      ['stop', 'stopped'],
      ['run', 'running'],
      ['make', 'making'],
      ['horse', 'horses'],
      ['call', 'called'],
      ['kiss', 'kissed'],
      ['add', 'added'],
      ['see', 'sees'],
      ['traveller', 'Travellers'],
      ['wolf', "wolf's"],
    ] as const)
      expect(foldWord(b), `${a} / ${b}`).toBe(foldWord(a));
    for (const [w, folded] of [
      ['this', 'this'],
      ['thing', 'thing'],
      ['need', 'need'],
      ['bus', 'bus'],
      ['status', 'status'],
      ['the', 'the'],
      ['door', 'door'],
    ] as const)
      expect(foldWord(w), w).toBe(folded);
  });

  it('roteRuns builds its rules from words two skills share, and scores each from the played table', () => {
    const rote = roteRuns(content);
    const by = new Map(rote.map((r) => [r.rule, r]));
    // "the" is in the lantern's and the locksmith's promises and nowhere else in the fixture.
    expect(by.get('"the" -> leave, else limit')!.verdicts).toEqual(['leave', 'limit', 'leave']);
    // Rules name the FOLDED word, so "fixture" reads "fixtur": the fold is what the rule matches on.
    expect(by.get('"the" -> take, "fixtur" -> limit, else leave')!.verdicts).toEqual([
      'take',
      'limit',
      'take',
    ]);
    expect(by.get('everything -> limit')).toMatchObject({ depth: 0, total: 300, ending: 'wolf' });
    // A word only one skill says names that skill, not a pattern, so it is never a rule.
    // "lights" (stemmed "light") is the lantern's alone; "ahead" the courier's alone.
    for (const own of ['"light"', '"ahead"'])
      expect(
        [...by.keys()].some((r) => r.includes(own)),
        own,
      ).toBe(false);
    expect(new Set(rote.map((r) => r.depth))).toEqual(new Set([0, ROTE_DEPTH - 1, ROTE_DEPTH]));
    // "greeting" and "promise" are said by exactly the skills that say "fixture" (all three), so
    // they make exactly its rules and are folded into it: named once, by the first of them.
    expect([...by.keys()].some((r) => r.includes('"fixtur"'))).toBe(true);
    for (const twin of ['"greet"', '"promis"'])
      expect(
        [...by.keys()].some((r) => r.includes(twin)),
        twin,
      ).toBe(false);
  });

  /*
   * WHERE AN OFFER STANDS. The fixture meets the courier first and the lantern last (`fixture.ts`
   * says why), and `skills` is in a different order, so a position is read off `characters`, never
   * off `skills`. A rule that decides every skill by a clause of its own is the cast memorised and is
   * not counted: in three skills, "the first offer -> limit, the last offer -> take, else leave" is
   * exactly careful, and so is the last offer and "the" -- because "the" then decides one skill.
   */
  it('roteRuns counts the first and the last offer as clauses, and never a rule that decides every skill alone', () => {
    const rote = roteRuns(content);
    const by = new Map(rote.map((r) => [r.rule, r]));
    expect(content.characters.map((c) => c.skillId)).toEqual(['courier', 'locksmith', 'lantern']);
    expect(by.get('the first offer -> limit, else take')!.verdicts).toEqual([
      'take',
      'limit',
      'take',
    ]);
    expect(by.get('the last offer -> take, else leave')).toMatchObject({
      verdicts: ['take', 'leave', 'leave'],
      total: 600,
      ending: 'grandma',
      depth: 1,
    });
    // A position with a word that decides two skills is a rule, and is counted.
    expect(by.get('the first offer -> limit, "the" -> take, else leave')!.depth).toBe(2);
    // Each of these decides every skill by a clause of its own.
    for (const memorised of [
      'the first offer -> limit, the last offer -> take, else leave',
      'the last offer -> take, "the" -> leave, else limit',
      'the last offer -> take, the first offer -> limit, else leave',
    ])
      expect(by.has(memorised), memorised).toBe(false);
    // So nothing a rule reads before a card reaches the fixture's ceiling.
    expect(Math.max(...rote.map((r) => r.total))).toBeLessThan(content.scoring.outOf);
  });

  it('roteRuns goes as deep as it is asked, and a deeper family contains the shallower one', () => {
    // Three tells that sort the fixture differently ("bright", "quiet", and "fixture" said by all),
    // so a three-word list exists at all: the plain fixture has only two.
    const v = variant();
    offererOf(v, 'lantern').greet = 'Fixture greeting, bright.';
    offererOf(v, 'courier').greet = 'Fixture greeting, quiet.';
    offererOf(v, 'locksmith').greet = 'Fixture greeting, bright and quiet.';
    const c = parseContent(v);
    const one = roteRuns(c, everyRun(c), 1);
    const three = roteRuns(c, everyRun(c), 3);
    expect(new Set(one.map((r) => r.depth))).toEqual(new Set([0, 1]));
    expect(new Set(three.map((r) => r.depth))).toEqual(new Set([0, 1, 2, 3]));
    const rules = new Set(three.map((r) => r.rule));
    for (const r of roteRuns(c)) expect(rules.has(r.rule), r.rule).toBe(true);
    // The last word's verdict never repeats the "else": that rule is already one level up.
    for (const r of three.filter((x) => x.depth > 0)) {
      const clauses = r.rule.split(', ');
      expect(clauses.at(-2)!.split(' -> ')[1], r.rule).not.toBe(clauses.at(-1)!.slice(5));
    }
  });
});

describe('the trap stays a trap: properties checked against any content', () => {
  it('the fixture passes every one, and each is named', () => {
    const t = trapChecks(content);
    expect(t.ok).toBe(true);
    expect(t.checks.map((c) => c.name)).toEqual([
      'careful reaches the ceiling',
      'careful is the only run at the ceiling',
      'greedy scores near zero',
      'greedy lets the wolf in',
      'no rule of two clauses or fewer read off the cast beats the rote line',
      'limiting never scores below taking in full, where taking in full lets the wolf in',
      'no run that let the wolf in comes near a careful one',
      'taking in full is the best answer somewhere',
      'limiting is the best answer somewhere',
      'leaving is the best answer somewhere',
    ]);
  });

  /*
   * Each property is proved by BREAKING it with the smallest edit to the fixture that breaks it,
   * and watching that one check -- and only that check -- fail. A property that cannot be made to
   * fail here is guarding nothing (trap 3).
   */
  const failing = (c: Content): string[] =>
    trapChecks(c)
      .checks.filter((x) => !x.ok)
      .map((x) => x.name);
  const detail = (c: Content, name: string): string =>
    trapChecks(c).checks.find((x) => x.name === name)!.detail;

  /** A fourth skill and the character who offers it, with copy no other fixture skill shares. */
  const addSkill = (
    v: typeof raw,
    id: string,
    take: number,
    limit: number,
    greet: string,
  ): void => {
    v.characters.push({
      id: `${id}-c`,
      name: `Fixture ${id}`,
      spawn: `spawn-${id}`,
      skillId: id,
      greet,
    });
    v.skills.push({
      ...structuredClone(v.skills[0]!),
      id,
      name: `Fixture ${id}`,
      promise: `Fixture promise: ${id} hums.`,
      did: {
        take: { line: `Fixture: ${id} in full.`, points: take },
        limit: { line: `Fixture: ${id} limited.`, points: limit },
      },
    });
  };

  it('careful is the only run at the ceiling: fails ON ITS OWN when a skill ties at its best', () => {
    // A fourth skill worth 0 however it is taken ties all three verdicts, so three combinations
    // reach 1000. Every skill but that one still has a strict best, so no existence check trips.
    const c = unchecked((v) => addSkill(v, 'pebble', 0, 0, 'Fixture greeting four.'));
    expect(failing(c)).toEqual(['careful is the only run at the ceiling']);
    expect(detail(c, 'careful is the only run at the ceiling')).toMatch(
      /^3 of 81 combinations score 1000: .*pebble take.* \| .*pebble limit.* \| .*pebble leave/,
    );
  });

  it('greedy scores near zero: fails when the wolf is cheap enough that greed pays', () => {
    // wolfCost 455 still costs the player on every wolf verdict (450 < 455, 100 < 455), so the
    // lint passes; but greedy is now 600 - 5 - 355 = 240, over a fifth of 1000.
    const c = unchecked((v) => void (v.scoring.wolfCost = 455));
    const greedy = Math.max(
      0,
      c.skills.reduce((t, s) => t + worth(s, 'take', c), 0),
    );
    expect(greedy).toBeGreaterThan(c.scoring.outOf * GREEDY_SHARE);
    /*
     * NOT ALONE ANY MORE, and that is arithmetic rather than a weak edit. Limiting best somewhere
     * and leaving best somewhere each force a take that serves the wolf (a strict best over taking
     * needs a wolf on the take, since a limit can never out-earn it), on two different skills. The
     * wolf bound makes each such take lose at least 1 - WOLF_SHARE = 40% of the ceiling, so greedy
     * keeps at most 100 - 2 x 40 = 20% -- exactly GREEDY_SHARE. While the shares stand where they
     * are, greed cannot pay without a wolf run paying too; the check stays because raising
     * WOLF_SHARE would make it independent again, and it is the one that names greed.
     */
    expect(failing(c)).toEqual([
      'greedy scores near zero',
      'no run that let the wolf in comes near a careful one',
    ]);
  });

  it('greedy lets the wolf in: fails when no skill taken in full serves the wolf', () => {
    // Every wolf moved onto `limit` alone is impossible (a boundary cannot add exposure), so take
    // the wolves away and make taking cost something by points alone.
    const c = unchecked((v) => {
      for (const s of v.skills) {
        delete (s.did.take as { wolf?: string }).wolf;
        delete (s.did.limit as { wolf?: string }).wolf;
      }
      v.skills[0]!.did.take.points = 1000;
      v.skills[0]!.did.limit.points = 0;
      v.skills[1]!.did.take.points = 0;
      v.skills[1]!.did.limit.points = 0;
      v.skills[2]!.did.take.points = 0;
      v.skills[2]!.did.limit.points = 0;
    });
    expect(failing(c)).toContain('greedy lets the wolf in');
    // With no wolf anywhere, the wolf bound has nothing to measure and says so.
    expect(detail(c, 'no run that let the wolf in comes near a careful one')).toBe(
      'no combination lets the wolf in',
    );
  });

  /*
   * THE ROTE LINE, keyed on the content's own words. The fixture's lantern limited is raised to
   * 350, so limiting the lantern and the courier and leaving the locksmith is worth 750 -- over
   * the 700 line. That alone is not rote: nothing a player sees before the card tells those two
   * apart from the locksmith. Then one shared word does, and the same numbers fail.
   */
  it('no rule of two clauses or fewer read off the cast beats the rote line: fails ON ITS OWN when one shared word is a tell', () => {
    const numbers = (v: typeof raw): void => void (v.skills[0]!.did.limit.points = 350);
    expect(failing(unchecked(numbers))).toEqual([]);
    const c = unchecked((v) => {
      numbers(v);
      offererOf(v, 'lantern').greet = 'Fixture greeting, bright.';
      offererOf(v, 'courier').greet = 'Fixture greeting, bright.';
    });
    expect(failing(c)).toEqual([
      'no rule of two clauses or fewer read off the cast beats the rote line',
    ]);
    expect(detail(c, 'no rule of two clauses or fewer read off the cast beats the rote line')).toBe(
      'best rote rule scores 750 ("bright" -> limit, else leave, ending grandma); at most 700 allowed',
    );
  });

  /*
   * ON THE LINE IS INSIDE IT. 700 * 0.7 is 489.99999999999994 in floating point, so before the
   * bound was floored a rote rule scoring exactly 490 against a 700 ceiling failed a "<= 70%" it
   * meets. Here the best rote rule ("bright" -> limit, else leave) scores exactly 490.
   */
  it('a rule scoring exactly the rote line passes, though the share is a float', () => {
    const c = unchecked((v) => {
      v.scoring.outOf = 700;
      v.scoring.wolfCost = 750;
      v.skills[0]!.did.take.points = 400;
      v.skills[0]!.did.limit.points = 190;
      v.skills[1]!.did.take.points = 350;
      v.skills[1]!.did.limit.points = 300;
      offererOf(v, 'lantern').greet = 'Fixture greeting, bright.';
      offererOf(v, 'courier').greet = 'Fixture greeting, bright.';
    });
    expect(c.scoring.outOf * ROTE_SHARE).toBeLessThan(490);
    expect(
      detail(c, 'no rule of two clauses or fewer read off the cast beats the rote line'),
    ).toMatch(/^best rote rule scores 490 \("bright" -> limit, else leave/);
    expect(failing(c)).toEqual([]);
  });

  /*
   * Two-word lists are checked, not just one-word rules -- the refuting line needed two words, so
   * a check that only ever fired on one would pass the real regression (trap 6). Four skills: two
   * best taken, one best limited, one best left. No single word sorts them; "bright" then "quiet"
   * sorts them exactly.
   */
  it('no rule of two clauses or fewer read off the cast beats the rote line: two-word lists are what catch a two-word tell', () => {
    const c = unchecked((v) => {
      v.skills[0]!.did.take.points = 400; // lantern: best taken, and says "bright" and "quiet"
      v.skills[0]!.did.limit.points = 200;
      addSkill(v, 'bell', 200, 100, 'Fixture greeting, bright.'); // best taken, says "bright"
      offererOf(v, 'lantern').greet = 'Fixture greeting, bright and quiet.';
      offererOf(v, 'courier').greet = 'Fixture greeting, quiet.'; // courier: best limited
    });
    const rote = roteRuns(c);
    const shallow = Math.max(...rote.filter((r) => r.depth < 2).map((r) => r.total));
    expect(shallow).toBeLessThanOrEqual(c.scoring.outOf * ROTE_SHARE);
    expect(failing(c)).toEqual([
      'no rule of two clauses or fewer read off the cast beats the rote line',
    ]);
    expect(
      rote.find((r) => r.rule === '"bright" -> take, "quiet" -> limit, else leave'),
    ).toMatchObject({ total: 1000, ending: 'grandma', depth: 2 });
  });

  /*
   * THE WOLF BOUND. The courier's limit is cut to 300 and its wolf priced so taking it in full is
   * worth -5: still below zero, as the lint requires, and greed stays under its fifth. But lantern
   * in full plus courier in full is now 595 of a 900 ceiling -- 66% for a run the wolf won, against a
   * 60% bound -- and nothing else notices.
   *
   * It was a 700 ceiling with the courier's limit at 100, until where an offer stands became a rote
   * clause. The lantern is the fixture's LAST offer, and at 600 of 700 "the last offer -> take, else
   * leave" scored 600 clean against a 490 line, so the rote line fired too and the proof was no
   * longer alone. The lantern's share of the ceiling is what was cut, not the check.
   */
  it('no run that let the wolf in comes near a careful one: fails ON ITS OWN when a wolf is cheap next to its best', () => {
    const c = unchecked((v) => {
      v.scoring.outOf = 900;
      v.scoring.wolfCost = 555;
      v.skills[1]!.did.take.points = 550;
      v.skills[1]!.did.limit.points = 300;
    });
    expect(failing(c)).toEqual(['no run that let the wolf in comes near a careful one']);
    expect(detail(c, 'no run that let the wolf in comes near a careful one')).toBe(
      'best wolf run scores 595 (lantern take, courier take, locksmith leave); at most 540 allowed',
    );
  });

  it('limiting everything is still refused: when every skill is best limited, the rote line catches it', () => {
    const c = unchecked((v) => {
      v.skills[0]!.did.take.points = 600;
      v.skills[0]!.did.limit.points = 600;
      v.skills[1]!.did.limit.points = 400;
      v.skills[2]!.did.limit = { line: 'Fixture: opened the door.', points: 0 };
      v.skills[2]!.did.take.points = 0;
    });
    expect(play(c, 'limit-all').total).toBe(c.scoring.outOf);
    expect(failing(c)).toEqual([
      'careful is the only run at the ceiling',
      'no rule of two clauses or fewer read off the cast beats the rote line',
      'taking in full is the best answer somewhere',
      'leaving is the best answer somewhere',
    ]);
    expect(
      detail(c, 'no rule of two clauses or fewer read off the cast beats the rote line'),
    ).toMatch(/^best rote rule scores 1000 \(everything -> limit, ending grandma\)/);
  });

  it('the 998 counterexample is refused, now twice over', () => {
    /*
     * The counterexample that refuted the old, margin-free limit-everything check. Every skill is
     * best answered by something -- lantern taken in full, courier limited, locksmith left -- so the
     * existence checks all pass, the lint passes, greed still ends with the wolf; and yet limiting
     * everything loses ONE POINT on lantern and nothing else, scoring 998 of 1000. A rote strategy
     * that close to the ceiling is a strategy.
     *
     * It used to be refused by that one check alone, and this test was named for it. Enumerating
     * every combination found one more thing wrong with the same content, and it is real: the
     * locksmith limited is worth -1, so lantern in full, courier limited and locksmith limited is a
     * run that let the wolf in and scores 999. The one-check-alone proof for the rote line is now
     * the shared-word test above.
     */
    const c = unchecked((v) => {
      v.scoring.wolfCost = 2000;
      const lantern = v.skills.find((s) => s.id === 'lantern')!;
      lantern.did.take.points = 600;
      lantern.did.limit.points = 599;
      const courier = v.skills.find((s) => s.id === 'courier')!;
      courier.did.take.points = 400;
      courier.did.limit.points = 400;
      const locksmith = v.skills.find((s) => s.id === 'locksmith')!;
      locksmith.did.take.points = 1999;
      locksmith.did.limit = {
        ...locksmith.did.limit,
        points: 1999,
        wolf: 'Fixture: and the wolf.',
      };
    });
    expect(play(c, 'limit-all').total).toBe(998);
    expect(failing(c)).toEqual([
      'no rule of two clauses or fewer read off the cast beats the rote line',
      'no run that let the wolf in comes near a careful one',
    ]);
  });

  it('limiting is the best answer somewhere: fails ON ITS OWN when no skill is best limited', () => {
    // The courier is made safe in full and worth more taken than limited, so it is best TAKEN,
    // strictly: nothing is best limited and nothing ties. The lantern and the courier carry half
    // the ceiling each, and a dearer wolf keeps greed down.
    //
    // It used to make the courier's limit serve the wolf, so the courier was best left and the
    // lantern carried the WHOLE ceiling. Then where an offer stands became a rote clause, and the
    // lantern is the fixture's last offer: "the last offer -> take, else leave" scored 1000, so the
    // rote line fired too and the proof was not alone. With nothing best limited, whatever is best
    // taken carries the ceiling, so it has to be shared by two skills that no position or word
    // picks out together. (Before that it zeroed the courier's limit, which tied it with leaving
    // -- and the every-combination check reads a tie at the ceiling as its own failure.)
    const c = unchecked((v) => {
      v.scoring.wolfCost = 1000;
      v.skills[0]!.did.take.points = 500;
      v.skills[1]!.did.take = { line: v.skills[1]!.did.take.line, points: 500 };
    });
    expect(c.skills.map((s) => bestVerdict(s, c))).toEqual(['take', 'take', 'leave']);
    expect(failing(c)).toEqual(['limiting is the best answer somewhere']);
  });

  /*
   * PARTIAL CAUTION IS NEVER PUNISHED. The fixture's locksmith limit was 50 against a take of 100,
   * both serving the wolf -- so limiting it was worth -450 and taking it in full -400. That is the
   * edit: the fixture as it stood before this check existed. It is lint-clean (a limit may earn
   * less than its take) and every other trap check passes it, so this one fails ON ITS OWN.
   */
  it('limiting never scores below taking in full: fails ON ITS OWN when a dangerous limit earns less', () => {
    const c = unchecked((v) => void (v.skills[2]!.did.limit.points = 50));
    expect(failing(c)).toEqual([
      'limiting never scores below taking in full, where taking in full lets the wolf in',
    ]);
    expect(
      detail(
        c,
        'limiting never scores below taking in full, where taking in full lets the wolf in',
      ),
    ).toBe('locksmith limited is worth -450, in full -400');
    // A skill SAFE in full is not covered, on purpose: there, limiting is meant to cost something.
    expect(worth(content.skills[0]!, 'limit', content)).toBeLessThan(
      worth(content.skills[0]!, 'take', content),
    );
    expect(
      detail(
        content,
        'limiting never scores below taking in full, where taking in full lets the wolf in',
      ),
    ).toBe('no skill');
  });

  it('careful reaches the ceiling: the simulated run is checked, not only the static sum', () => {
    // outOf moved off the ceiling. The lint catches it too; this proves the sim does on its own.
    const c = contentWith((v) => void (v.scoring.outOf = 1100));
    expect(failing(c)).toContain('careful reaches the ceiling');
  });

  it('a content set that fails the trap does not load', () => {
    const v = variant();
    v.scoring.wolfCost = 455;
    expect(() => loadContent(v)).toThrow(ContentError);
    expect(() => loadContent(v)).toThrow(/trap: greedy scores near zero/);
  });

  it('the trap is not run on content the lint already refused', () => {
    const v = variant();
    v.characters[0]!.skillId = 'ghost';
    expect(() => loadContent(v)).toThrow(/offers unknown skill "ghost"/);
    expect(() => loadContent(v)).not.toThrow(/trap:/);
  });
});

/** Parsed but neither linted nor trapped, for the one property the lint would otherwise pre-empt. */
function contentWith(mutate: (c: typeof raw) => void): Content {
  const v = variant();
  mutate(v);
  return parseContent(v);
}

describe('the clock is honest: a reader can make it, at the pace the world is measured at', () => {
  it('careful arrives in time at a brisk pace, and says by how much', () => {
    const c = clockCheck(content, brisk);
    expect(c.ok).toBe(true);
    const modelled =
      content.skills.length * (brisk.walkMs + brisk.talkMs) +
      content.skills.reduce((t, s) => t + s.inspectMs, 0) +
      brisk.walkMs;
    expect(c.elapsedMs).toBe(modelled);
    expect(c.marginMs).toBe(TIME_LIMIT_MS - modelled);
  });

  it('fails when reading every card at that pace cannot be done inside three minutes', () => {
    const slow: Pace = { walkMs: 60_000, talkMs: 5_000 };
    const c = clockCheck(content, slow);
    expect(c).toMatchObject({ ok: false, ending: 'late' });
    expect(c.marginMs).toBeLessThan(0);
  });

  it('a strategy that runs out of time ends late and has no score', () => {
    const p = play(content, 'careful', { pace: { walkMs: 90_000, talkMs: 0 } });
    expect(p).toMatchObject({ ending: 'late', total: null });
    expect(p.state.phase).toBe('late');
    // greedy is fast at the same pace, which is the failure the game reproduces.
    expect(play(content, 'greedy', { pace: { walkMs: 40_000, talkMs: 0 } }).ending).toBe('wolf');
  });
});
