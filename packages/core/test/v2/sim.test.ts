import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/v2/load.ts';
import type { Content } from '../../src/v2/content.ts';
import { deal, everySeed } from '../../src/v2/deal.ts';
import { loadContent, parseContent } from '../../src/v2/load.ts';
import { checkRunLog, toRunLog } from '../../src/v2/runlog.ts';
import { score } from '../../src/v2/scoring.ts';
import {
  BRISK,
  READING,
  ROTE_SHARE,
  STRATEGIES,
  blindAverages,
  cardWords,
  carefulVerdicts,
  clockCheck,
  everyRun,
  mulberry32,
  play,
  readMs,
  table,
  trapChecks,
} from '../../src/v2/sim.ts';
import type { Pace } from '../../src/v2/sim.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { content } from './helpers.ts';
import { variant } from './fixture.ts';

/** Comfortably inside the clock for the fixture, so time never decides a test that is not about it. */
const brisk: Pace = { walkMs: 20_000, talkMs: 5_000 };
const skill = (id: string) => content.skills.find((s) => s.id === id)!;

describe('strategies play through the real reducer, in every deal', () => {
  it('every strategy reaches the cottage in every deal, and the server would accept its log', () => {
    const rows = table(content);
    expect(rows).toHaveLength(Object.keys(STRATEGIES).length * 3);
    for (const p of rows) {
      expect(p.state.phase, `${p.strategy} ${p.seed}`).toBe('cottage');
      const r = checkRunLog(toRunLog(p.state), content);
      expect(r, `${p.strategy} ${p.seed}`).toMatchObject({ legal: true, ended: true });
      expect(score(p.state, content)).toBe(p.total);
    }
    expect(table(content, brisk).every((p) => p.elapsedMs > 0)).toBe(true);
  });

  it('careful reads every card and scores 100 in every deal; greedy and leave-all read none', () => {
    for (const seed of everySeed(content)) {
      const careful = play(content, 'careful', { seed });
      expect(careful.state.inspected).toHaveLength(3);
      expect(careful).toMatchObject({ total: 100, ending: 'grandma' });
      expect(careful.state.basket.map((b) => b.s)).toEqual(deal(content, seed));
      expect(play(content, 'greedy', { seed })).toMatchObject({ total: 0, ending: 'wolf' });
      expect(play(content, 'leave-all', { seed })).toMatchObject({ total: 40, ending: 'grandma' });
      expect(play(content, 'greedy', { seed }).state.inspected).toEqual([]);
    }
  });

  it('random is seeded: one seed is one run, and the seeds between them try both verdicts and both habits', () => {
    expect(play(content, 'random', { seed: 7 }).state.log).toEqual(
      play(content, 'random', { seed: 7 }).state.log,
    );
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++)
      for (const e of play(content, 'random', { seed }).state.log)
        if (e.e === 'verdict' || e.e === 'inspected') seen.add(e.e === 'verdict' ? e.v : 'read');
    expect([...seen].sort()).toEqual(['leave', 'read', 'take']);
  });

  it('mulberry32 is a unit interval and deterministic', () => {
    const a = mulberry32(3);
    const b = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
  });

  it('refuses a strategy it does not know', () => {
    expect(() => play(content, 'psychic')).toThrow(/unknown strategy "psychic"/);
  });
});

describe('every combination, in every deal', () => {
  it('everyRun plays all 2^n combinations once each, and exactly one per deal scores 100: the careful one', () => {
    for (const seed of everySeed(content)) {
      const runs = everyRun(content, seed);
      expect(runs).toHaveLength(8);
      expect(new Set(runs.map((r) => r.verdicts.join(','))).size).toBe(8);
      expect(runs.filter((r) => r.total === 100).map((r) => r.verdicts)).toEqual([
        carefulVerdicts(content, deal(content, seed)),
      ]);
    }
  });

  it('blindAverages scores each fixed basket over every deal, best first', () => {
    const rows = blindAverages(content);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({ verdicts: ['leave', 'leave', 'leave'], mean: 40 });
    // Take one, leave two: right in one deal of three.
    expect(rows[1]!.mean).toBeCloseTo(100 / 3);
  });
});

describe('the trap stays a trap: properties checked against any content', () => {
  const ROTE = 'no card-blind strategy averages above the rote line over every deal';
  const failing = (c: Content): string[] =>
    trapChecks(c)
      .checks.filter((x) => !x.ok)
      .map((x) => x.name);

  it('the fixture passes every one, each is named, and leaving everything is exactly on the line', () => {
    const t = trapChecks(content);
    expect(t.ok).toBe(true);
    expect(t.checks.map((c) => c.name)).toEqual([
      'careful reaches the ceiling in every deal',
      ROTE,
    ]);
    expect(content.scoring.played).toBe(0);
    expect(Math.floor(content.scoring.outOf * ROTE_SHARE + 1e-9)).toBe(40);
    expect(t.checks[1]!.detail).toBe(
      'best blind basket (leave,leave,leave) averages 40.0; at most 40 allowed',
    );
  });

  it('the rote line fails ON ITS OWN when the weights make a blind basket pay', () => {
    const v = variant();
    v.scoring = { outOf: 100, played: 0, good: 50, clean: 50, speed: 0, parMs: 60_000 };
    const c = parseContent(v);
    expect(failing(c)).toEqual([ROTE]);
    expect(() => loadContent(v)).toThrow(/trap: no card-blind strategy/);
  });

  it('the rote line stands on `played`: points for playing raise it, and are not a blind basket paying', () => {
    // 40 for playing, and the same 40 / 20 / 0 a skill as the fixture's on the 60 left: every
    // blind basket gains 40, and the line, 40 + 40% of 60, gains the same.
    const v = variant();
    v.scoring = { outOf: 100, played: 40, good: 24, clean: 24, speed: 12, parMs: 60_000 };
    const t = trapChecks(parseContent(v));
    expect(t.checks[1]!.detail).toMatch(/at most 64 allowed$/);
    expect(t.ok).toBe(true);
  });

  it('careful reaches the ceiling: the simulated run is checked, not only the static sum', () => {
    const v = variant();
    v.scoring.outOf = 110;
    expect(failing(parseContent(v))).toContain('careful reaches the ceiling in every deal');
  });

  it('the trap is not run on content the lint already refused', () => {
    const v = variant();
    v.characters[0]!.skillId = 'ghost';
    expect(() => loadContent(v)).toThrow(ContentError);
    expect(() => loadContent(v)).toThrow(/offers unknown skill "ghost"/);
    expect(() => loadContent(v)).not.toThrow(/trap:/);
  });
});

describe('the clock is honest: a reader can make it, in every deal, at the pace the world is measured at', () => {
  it('reads the card the deal shows, giveaway line included', () => {
    const courier = skill('courier');
    // The bad courier card swaps a four-word line for a five-word one.
    expect(cardWords(courier, false) - cardWords(courier, true)).toBe(1);
    expect(readMs(courier, false)).toBe(cardWords(courier, false) * READING.msPerWord + 3000);
  });

  it('reads at whatever pace it is handed: BRISK is the meta-analysis rate with no pause to decide', () => {
    const courier = skill('courier');
    expect(readMs(courier, true, BRISK)).toBe(cardWords(courier, true, BRISK) * (60_000 / 238));
    const quick = play(content, 'careful', { pace: brisk, reading: BRISK });
    expect(quick.elapsedMs).toBeLessThan(play(content, 'careful', { pace: brisk }).elapsedMs);
  });

  it('careful arrives in time at a brisk pace, says by how much, and names the tightest deal', () => {
    const c = clockCheck(content, brisk);
    expect(c.ok).toBe(true);
    const modelled = (seed: number) =>
      content.skills.length * (brisk.walkMs + brisk.talkMs) +
      content.skills.reduce((t, s) => t + readMs(s, deal(content, seed).includes(s.id)), 0) +
      brisk.walkMs;
    const worst = Math.max(...everySeed(content).map(modelled));
    expect(c.elapsedMs).toBe(worst);
    expect(modelled(c.seed)).toBe(worst);
    expect(c.marginMs).toBe(TIME_LIMIT_MS - worst);
  });

  // Wherever the tightest deal falls in seed order -- first or later -- it is the one named.
  it('names the tightest deal wherever it falls among the seeds', () => {
    // The courier's good card made long, so its deal (seed 1, the middle one) is the slowest read.
    const v = variant();
    v.skills.find((x) => x.id === 'courier')!.good.card.take[1] =
      'Fixture: to her alone, and to nobody else in the whole fixture wood.';
    const middle = parseContent(v);
    const times = everySeed(middle).map(
      (seed) => play(middle, 'careful', { seed, pace: brisk }).elapsedMs,
    );
    expect(Math.max(...times)).toBe(times[1]);
    expect(times[1]).toBeGreaterThan(Math.max(times[0]!, times[2]!));
    expect(clockCheck(middle, brisk)).toMatchObject({ seed: 1, elapsedMs: times[1] });
  });

  it('fails when reading every card at that pace cannot be done inside three minutes', () => {
    const c = clockCheck(content, { walkMs: 60_000, talkMs: 5_000 });
    expect(c).toMatchObject({ ok: false, ending: 'late' });
    expect(c.marginMs).toBeLessThan(0);
  });

  it('a strategy that runs out of time ends late and scores 0', () => {
    const p = play(content, 'careful', { pace: { walkMs: 90_000, talkMs: 0 } });
    expect(p).toMatchObject({ ending: 'late', total: 0 });
    // greedy is fast at the same pace, which is the failure the game reproduces.
    expect(play(content, 'greedy', { pace: { walkMs: 40_000, talkMs: 0 } }).ending).toBe('wolf');
  });
});
