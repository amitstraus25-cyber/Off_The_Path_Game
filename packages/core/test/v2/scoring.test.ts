import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../../src/v2/content.ts';
import type { Content, Verdict } from '../../src/v2/content.ts';
import { everySeed } from '../../src/v2/deal.ts';
import { loadContent } from '../../src/v2/load.ts';
import { arrivalMs, ending, result, reveal, score, speedBonus } from '../../src/v2/scoring.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { begin, content, encounter, fresh, fullRun, run } from './helpers.ts';
import { variant } from './fixture.ts';

/**
 * What a run that gave these verdicts is worth in a deal, recomputed from the data, for a run inside
 * par (every suite's one-second clock is): the whole bonus, shared by the good skills taken.
 */
const expected = (verdicts: Record<string, Verdict>, good: string[], c: Content = content) => {
  const taken = c.skills.filter((s) => verdicts[s.id] === 'take').map((s) => s.id);
  if (taken.some((id) => !good.includes(id))) return 0;
  return (
    c.scoring.clean + c.scoring.good * taken.length + (c.scoring.speed * taken.length) / c.deal.good
  );
};

const skill = (id: string) => content.skills.find((s) => s.id === id)!;
const careful = { lantern: 'take', courier: 'leave', locksmith: 'leave' } as const;

describe('the score: a clean arrival plus each good skill, and the wolf takes it all', () => {
  it('a careful run reaches the ceiling, and the ceiling is what the score is out of', () => {
    const r = result(fullRun(careful), content);
    expect(r).toMatchObject({ total: 100, outOf: 100, ending: 'grandma', good: 1, served: 0 });
    expect(score(fullRun(careful), content)).toBe(100);
  });

  it('the same verdicts are judged by the deal: careful in one deal is the wolf in another', () => {
    expect(score(fullRun(careful, 0), content)).toBe(100);
    expect(result(fullRun(careful, 1), content)).toMatchObject({ total: 0, ending: 'wolf' });
  });

  it('taking everything lets the wolf in and scores 0', () => {
    const greedy = { lantern: 'take', courier: 'take', locksmith: 'take' } as const;
    expect(result(fullRun(greedy), content)).toMatchObject({
      total: 0,
      ending: 'wolf',
      good: 1,
      served: 2,
    });
  });

  it('leaving everything is a clean arrival with nothing in hand: the clean weight alone', () => {
    const r = result(run([...begin, { type: 'ENTER_COTTAGE' }]), content);
    expect(r).toMatchObject({ total: content.scoring.clean, ending: 'grandma', good: 0 });
  });

  it('every combination in every deal scores as the rule says; every wolf run is below every clean one', () => {
    const totals = { wolf: [] as number[], grandma: [] as number[] };
    for (const seed of everySeed(content))
      for (const a of VERDICTS)
        for (const b of VERDICTS)
          for (const c of VERDICTS) {
            const v = { lantern: a, courier: b, locksmith: c };
            const s = fullRun(v, seed);
            const r = result(s, content);
            expect(r.total, `${seed} ${JSON.stringify(v)}`).toBe(expected(v, s.good));
            totals[r.ending as 'wolf' | 'grandma'].push(r.total);
            expect(Number.isInteger(r.total)).toBe(true);
          }
    expect(Math.max(...totals.wolf)).toBeLessThan(Math.min(...totals.grandma));
  });

  it('a skill passed by without a verdict counts as left', () => {
    const s = run([...begin, ...encounter('lantern', 'take'), { type: 'ENTER_COTTAGE' }]);
    expect(score(s, content)).toBe(content.scoring.outOf);
  });

  it('scores by the content it is given, so the weights retune without code', () => {
    const tuned = variant();
    tuned.scoring = { outOf: 100, played: 0, good: 70, clean: 30, speed: 0, parMs: 60_000 };
    const c = loadContent(tuned);
    expect(score(run([...begin, { type: 'ENTER_COTTAGE' }]), c)).toBe(30);
    expect(score(fullRun(careful), c)).toBe(100);
  });
});

/** The real weights, on the fixture's rules: three dealt good, 25 played, 15 / 15 / 15, par 1:47. */
const shipped = {
  ...content,
  deal: { good: 3 },
  scoring: { outOf: 100, played: 25, clean: 15, good: 15, speed: 15, parMs: 107_000 },
} as Content;

describe('speed: a bonus on being right, never a second way to score', () => {
  it('is whole at or under par, falls in a straight line, and is nothing at the limit', () => {
    expect(speedBonus(shipped, 3, 0)).toBe(15);
    expect(speedBonus(shipped, 3, 107_000)).toBe(15);
    // Halfway from par to the buzzer is half the bonus: 7.5, rounded to the whole point above.
    expect(speedBonus(shipped, 3, (107_000 + TIME_LIMIT_MS) / 2)).toBe(8);
    expect(speedBonus(shipped, 3, TIME_LIMIT_MS - 1)).toBe(0);
    expect(speedBonus(shipped, 3, TIME_LIMIT_MS)).toBe(0);
    expect(speedBonus(shipped, 3, TIME_LIMIT_MS + 60_000)).toBe(0);
  });

  it('is scaled by the share of good skills taken, so leaving everything earns none however fast', () => {
    expect([0, 1, 2, 3].map((g) => speedBonus(shipped, g, 0))).toEqual([0, 5, 10, 15]);
  });

  it('never lets a faster basket one good skill short beat a full one, at any time that arrives', () => {
    const full = (t: number) => 25 + 15 + 15 * 3 + speedBonus(shipped, 3, t);
    const short = 25 + 15 + 15 * 2 + speedBonus(shipped, 2, 0);
    for (let t = 0; t < TIME_LIMIT_MS; t += 1_000) expect(full(t), `${t}ms`).toBeGreaterThan(short);
    // The fastest two-good basket is 80; the slowest full one is 85, five clear of it.
    expect(short).toBe(80);
    expect(full(TIME_LIMIT_MS - 1)).toBe(85);
  });

  it('is a whole number at every millisecond, so the browser and the server cannot round apart', () => {
    for (let t = 0; t <= TIME_LIMIT_MS; t += 997)
      for (const g of [0, 1, 2, 3]) expect(Number.isInteger(speedBonus(shipped, g, t))).toBe(true);
  });

  it('is read off the run: the arrival stamp, the choices and the bonus, and the par it was measured against', () => {
    const slow = run([
      ...begin,
      ...encounter('lantern', 'take'),
      { type: 'ENTER_COTTAGE', at: 120_000 },
    ]);
    expect(arrivalMs(slow)).toBe(120_000);
    // 60 s past a 60 s par, 120 s from par to the buzzer: half of 20.
    expect(result(slow, content)).toMatchObject({
      total: 90,
      choices: 80,
      speed: 10,
      timeMs: 120_000,
      parMs: 60_000,
      ending: 'grandma',
    });
    const wolf = result(fullRun({ lantern: 'take', courier: 'take', locksmith: 'leave' }), content);
    expect(wolf).toMatchObject({ total: 0, choices: 0, speed: 0, ending: 'wolf' });
    expect(wolf.timeMs).toBeGreaterThan(0);
    expect(result(fresh(), content)).toMatchObject({ timeMs: null, speed: 0, choices: 0 });
  });

  it('a par the clock cannot reach is refused at load', () => {
    const v = variant();
    v.scoring.parMs = TIME_LIMIT_MS;
    expect(() => loadContent(v)).toThrow(/scoring\.parMs 180000 is not under the 180000ms limit/);
  });
});

describe('`played`, with an ending that says why, for a run that ended without a clean basket', () => {
  it('a late run has its own ending and scores `played` (0 in the fixture)', () => {
    const late = run([
      ...begin,
      ...encounter('lantern', 'take'),
      { type: 'TIME_UP', at: TIME_LIMIT_MS },
    ]);
    expect(result(late, content)).toMatchObject({ total: 0, ending: 'late', good: 1 });
  });

  it('a run still in the forest has no ending and scores 0', () => {
    const s = run([...begin, ...encounter('lantern', 'take')]);
    expect(result(s, content)).toMatchObject({ total: 0, ending: null });
  });
});

describe('`played`: every run that ends is given it, and nothing else changes (the client, 2026-10-25)', () => {
  // The fixture's weights with 25 of the 100 moved to `played`: 15 clean, 40 the good skill, 20 speed.
  const floored = (() => {
    const v = variant();
    v.scoring = { outOf: 100, played: 25, clean: 15, good: 40, speed: 20, parMs: 60_000 };
    return loadContent(v);
  })();

  it('a wolf run scores `played` however fast, and its parts say so', () => {
    const greedy = { lantern: 'take', courier: 'take', locksmith: 'take' } as const;
    expect(result(fullRun(greedy), floored)).toMatchObject({
      total: 25,
      played: 25,
      choices: 0,
      speed: 0,
      ending: 'wolf',
    });
  });

  it('a late run scores `played`', () => {
    const late = run([
      ...begin,
      ...encounter('lantern', 'take'),
      { type: 'TIME_UP', at: TIME_LIMIT_MS },
    ]);
    expect(result(late, floored)).toMatchObject({ total: 25, played: 25, ending: 'late' });
  });

  it('a run still in the forest has not ended, and has not earned it', () => {
    const s = run([...begin, ...encounter('lantern', 'take')]);
    expect(result(s, floored)).toMatchObject({ total: 0, played: 0, ending: null });
  });

  it('a clean arrival adds its basket and its speed on top, and the careful run is the ceiling', () => {
    expect(result(run([...begin, { type: 'ENTER_COTTAGE' }]), floored)).toMatchObject({
      total: 40,
      played: 25,
      choices: 15,
    });
    expect(result(fullRun(careful), floored)).toMatchObject({
      total: 100,
      played: 25,
      choices: 55,
      speed: 20,
    });
  });

  it('every wolf run is still below every clean one', () => {
    const totals = { wolf: [] as number[], grandma: [] as number[] };
    for (const seed of everySeed(floored))
      for (const a of VERDICTS)
        for (const b of VERDICTS)
          for (const c of VERDICTS) {
            const r = result(fullRun({ lantern: a, courier: b, locksmith: c }, seed), floored);
            totals[r.ending as 'wolf' | 'grandma'].push(r.total);
          }
    expect(new Set(totals.wolf)).toEqual(new Set([25]));
    expect(Math.min(...totals.grandma)).toBe(40);
  });
});

describe('the reveal, as data', () => {
  it('lists every offer in walking order, with the dealt variant and the line that gave a bad one away', () => {
    const s = run([
      ...begin,
      ...encounter('locksmith', 'take', false),
      ...encounter('lantern', 'take'),
      { type: 'ENTER_COTTAGE' },
    ]);
    const lock = skill('locksmith');
    const lantern = skill('lantern');
    const courier = skill('courier');
    expect(reveal(s, content)).toEqual([
      {
        skillId: 'courier',
        name: courier.name,
        promise: courier.promise,
        good: false,
        verdict: null,
        read: false,
        line: courier.bad.reveal,
        giveaway: 'Fixture: and a copy elsewhere.',
      },
      {
        skillId: 'lantern',
        name: lantern.name,
        promise: lantern.promise,
        good: true,
        verdict: 'take',
        read: true,
        line: lantern.good.reveal,
        giveaway: null,
      },
      {
        skillId: 'locksmith',
        name: lock.name,
        promise: lock.promise,
        good: false,
        verdict: 'take',
        read: false,
        line: lock.bad.reveal,
        giveaway: 'Fixture: opens any door.',
      },
    ]);
    expect(ending(s, content)).toBe('wolf');
  });

  it('in another deal the same skill shows its other variant', () => {
    const s = fresh(2);
    expect(reveal(s, content).find((r) => r.skillId === 'locksmith')).toMatchObject({
      good: true,
      line: skill('locksmith').good.reveal,
      giveaway: null,
    });
    expect(ending(s, content)).toBeNull();
  });
});
