import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../../src/v2/content.ts';
import type { Content, Verdict } from '../../src/v2/content.ts';
import { everySeed } from '../../src/v2/deal.ts';
import { loadContent } from '../../src/v2/load.ts';
import { ending, result, reveal, score } from '../../src/v2/scoring.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { begin, content, encounter, fresh, fullRun, run } from './helpers.ts';
import { variant } from './fixture.ts';

/** What a run that gave these verdicts is worth in a deal, recomputed from the data. */
const expected = (verdicts: Record<string, Verdict>, good: string[], c: Content = content) => {
  const taken = c.skills.filter((s) => verdicts[s.id] === 'take').map((s) => s.id);
  if (taken.some((id) => !good.includes(id))) return 0;
  return c.scoring.clean + c.scoring.good * taken.length;
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
    tuned.scoring = { outOf: 100, good: 70, clean: 30 };
    const c = loadContent(tuned);
    expect(score(run([...begin, { type: 'ENTER_COTTAGE' }]), c)).toBe(30);
    expect(score(fullRun(careful), c)).toBe(100);
  });
});

describe('zero, with an ending that says why, for a run that never made it or has not finished', () => {
  it('a late run has its own ending and scores 0: always an integer, never a run for the board', () => {
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
