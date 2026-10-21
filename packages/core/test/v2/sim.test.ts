import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content.ts';
import { VERDICTS, bestVerdict, lintContent, worth } from '../../src/v2/content.ts';
import type { Content } from '../../src/v2/content.ts';
import { loadContent, parseContent } from '../../src/v2/load.ts';
import { checkRunLog, toRunLog } from '../../src/v2/runlog.ts';
import { score } from '../../src/v2/scoring.ts';
import {
  GREEDY_SHARE,
  STRATEGIES,
  clockCheck,
  mulberry32,
  play,
  table,
  trapChecks,
} from '../../src/v2/sim.ts';
import type { Pace } from '../../src/v2/sim.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { content } from './helpers.ts';
import { raw, variant } from './fixture.ts';

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
    expect(p.state.inspected).toEqual(content.skills.map((s) => s.id));
    expect(p.state.verdicts).toEqual(
      Object.fromEntries(content.skills.map((s) => [s.id, bestVerdict(s, content)])),
    );
  });

  it('greedy and leave-everything read nothing; limit-everything has to read everything', () => {
    expect(play(content, 'greedy').state.inspected).toEqual([]);
    expect(play(content, 'leave-all').state.inspected).toEqual([]);
    expect(play(content, 'limit-all').state.inspected).toEqual(content.skills.map((s) => s.id));
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

describe('the trap stays a trap: properties checked against any content', () => {
  it('the fixture passes every one, and each is named', () => {
    const t = trapChecks(content);
    expect(t.ok).toBe(true);
    expect(t.checks.map((c) => c.name)).toEqual([
      'careful reaches the ceiling',
      'greedy scores near zero',
      'greedy lets the wolf in',
      'limiting everything is not a strategy',
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

  it('greedy scores near zero: fails when the wolf is cheap enough that greed pays', () => {
    // wolfCost 455 still costs the player on every wolf verdict (450 < 455, 100 < 455), so the
    // lint passes; but greedy is now 600 - 5 - 355 = 240, over a fifth of 1000.
    const c = unchecked((v) => void (v.scoring.wolfCost = 455));
    const greedy = Math.max(
      0,
      c.skills.reduce((t, s) => t + worth(s, 'take', c), 0),
    );
    expect(greedy).toBeGreaterThan(c.scoring.outOf * GREEDY_SHARE);
    expect(failing(c)).toEqual(['greedy scores near zero']);
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
  });

  it('limiting everything is not a strategy: fails when every skill is best limited', () => {
    const c = unchecked((v) => {
      v.skills[0]!.did.take.points = 600;
      v.skills[0]!.did.limit.points = 600;
      v.skills[1]!.did.limit.points = 400;
      v.skills[2]!.did.limit = { line: 'Fixture: opened the door.', points: 0 };
      v.skills[2]!.did.take.points = 0;
    });
    expect(play(c, 'limit-all').total).toBe(c.scoring.outOf);
    expect(failing(c)).toEqual([
      'limiting everything is not a strategy',
      'taking in full is the best answer somewhere',
      'leaving is the best answer somewhere',
    ]);
  });

  it('limiting everything is not a strategy: fails ON ITS OWN when limiting is one point short of best', () => {
    /*
     * The counterexample that refuted the old, margin-free version of this check. Every skill is
     * best answered by something -- lantern taken in full, courier limited, locksmith left -- so the
     * existence checks all pass, the lint passes, greed still ends with the wolf; and yet limiting
     * everything loses ONE POINT on lantern and nothing else, scoring 998 of 1000. A rote strategy
     * that close to the ceiling is a strategy. This is the only check that may refuse it.
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
    expect(failing(c)).toEqual(['limiting everything is not a strategy']);
  });

  it('limiting is the best answer somewhere: fails when no skill is best limited', () => {
    // Courier's limit is worth nothing, so it ties leave and nothing is strictly best limited.
    // Lantern carries the whole ceiling and a dearer wolf keeps greed down, so nothing else trips.
    const c = unchecked((v) => {
      v.scoring.wolfCost = 1000;
      v.skills[0]!.did.take.points = 1000;
      v.skills[1]!.did.limit.points = 0;
    });
    expect(failing(c)).toEqual(['limiting is the best answer somewhere']);
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
