import { describe, expect, it } from 'vitest';
import { VERDICTS, worth } from '../../src/v2/content.ts';
import type { Content, Verdict } from '../../src/v2/content.ts';
import { loadContent } from '../../src/v2/load.ts';
import { ending, reveal, score } from '../../src/v2/scoring.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';
import { variant } from './fixture.ts';

/** What a run that gave these verdicts is worth, recomputed from the data rather than remembered. */
const expected = (verdicts: Record<string, Verdict>, c: Content = content): number =>
  Math.max(
    0,
    c.skills.reduce((t, s) => t + worth(s, verdicts[s.id] ?? 'leave', c), 0),
  );

const skill = (id: string) => content.skills.find((s) => s.id === id)!;

describe('the score is what the skills did, never how many', () => {
  it('a careful run reaches the ceiling, and the ceiling is what the score is out of', () => {
    const careful = { lantern: 'take', courier: 'limit', locksmith: 'leave' } as const;
    const s = score(fullRun(careful).log, content);
    expect(s.total).toBe(expected(careful));
    expect(s.total).toBe(content.scoring.outOf);
    expect(s.outOf).toBe(content.scoring.outOf);
    expect(s.ending).toBe('grandma');
  });

  it('a full basket of the wrong things scores near zero and lets the wolf in', () => {
    const greedy = { lantern: 'take', courier: 'take', locksmith: 'take' } as const;
    const s = score(fullRun(greedy).log, content);
    expect(s.total).toBe(expected(greedy));
    // "Near zero" is the spec's word, and its own sketch scores a six-skill haul 120 / 1000.
    expect(s.total!).toBeLessThanOrEqual(content.scoring.outOf * 0.2);
    expect(s.served).toBe(2);
    expect(s.ending).toBe('wolf');
  });

  /*
   * THE LESSON AS ARITHMETIC. Courier taken in full kept its promise -- its `did.take.points` is
   * real value -- and it ALSO served the wolf. Taking it must leave the player worse off than not
   * taking it at all, not merely worse off than limiting it. Measured against the same run with
   * only that one verdict changed, so nothing else in the basket can hide the cost.
   */
  it('a skill that kept its promise AND served the wolf costs the player', () => {
    const d = skill('courier').did.take;
    expect(d.points).toBeGreaterThan(0);
    expect(d.wolf).toBeDefined();
    const without = score(
      fullRun({ lantern: 'take', courier: 'leave', locksmith: 'leave' }).log,
      content,
    );
    const withIt = score(
      fullRun({ lantern: 'take', courier: 'take', locksmith: 'leave' }).log,
      content,
    );
    expect(withIt.total!).toBeLessThan(without.total!);
    expect(withIt.earned).toBeGreaterThan(without.earned);
  });

  it('more skills is not more points: adding a dangerous one to a good basket lowers it', () => {
    const fewer = score(
      fullRun({ lantern: 'take', courier: 'limit', locksmith: 'leave' }).log,
      content,
    );
    const more = score(
      fullRun({ lantern: 'take', courier: 'limit', locksmith: 'take' }).log,
      content,
    );
    expect(more.entries.length).toBeGreaterThan(fewer.entries.length);
    expect(more.total!).toBeLessThan(fewer.total!);
  });

  it('every combination of verdicts scores exactly the sum of worths, floored at zero', () => {
    for (const a of VERDICTS)
      for (const b of VERDICTS)
        for (const c of VERDICTS) {
          const v = { lantern: a, courier: b, locksmith: c };
          const s = score(fullRun(v).log, content);
          expect(s.total, JSON.stringify(v)).toBe(expected(v));
          expect(s.earned - s.lost).toBe(
            content.skills.reduce((t, sk) => t + worth(sk, v[sk.id as keyof typeof v], content), 0),
          );
        }
  });

  it('is floored at zero rather than going negative', () => {
    const v = { lantern: 'leave', courier: 'take', locksmith: 'take' } as const;
    expect(expected(v)).toBe(0);
    const s = score(fullRun(v).log, content);
    expect(s.total).toBe(0);
    expect(s.earned - s.lost).toBeLessThan(0);
  });

  it('a skill passed by without a verdict is worth what leaving it is worth', () => {
    const s = score(
      run([...begin, ...encounter('lantern', 'take'), { type: 'ENTER_COTTAGE' }]).log,
      content,
    );
    expect(s.total).toBe(worth(skill('lantern'), 'take', content));
  });

  it('scores by the content it is given, so Phase B can retune it without code', () => {
    const tuned = variant();
    tuned.scoring.wolfCost = 900;
    tuned.scoring.outOf = 1000;
    const c = loadContent(tuned);
    const greedy = { lantern: 'take', courier: 'take', locksmith: 'take' } as const;
    const log = fullRun(greedy).log;
    expect(score(log, c).total).toBe(expected(greedy, c));
    expect(score(log, c).total).not.toBe(score(log, content).total);
  });
});

describe('no score for a run that never made it, or has not finished', () => {
  it('a late run has its own ending and no number: it is not a penalty, it is not scored', () => {
    const late = run([
      ...begin,
      ...encounter('lantern', 'take'),
      { type: 'TIME_UP', at: TIME_LIMIT_MS },
    ]);
    const s = score(late.log, content);
    expect(s).toMatchObject({ total: null, ending: 'late' });
    // The reveal still knows what was carried, for a screen that wants to show it.
    expect(s.entries.map((e) => e.skillId)).toEqual(['lantern']);
  });

  it('a run still in the forest has no ending and no score', () => {
    const s = score(run([...begin, ...encounter('lantern', 'take')]).log, content);
    expect(s).toMatchObject({ total: null, ending: null });
  });
});

describe('the reveal, as data', () => {
  it('lists each skill taken, in basket order, with what it promised and what it did', () => {
    const s = run([
      ...begin,
      ...encounter('locksmith', 'take', false),
      ...encounter('lantern', 'leave'),
      ...encounter('courier', 'limit'),
      { type: 'ENTER_COTTAGE' },
    ]);
    const lock = skill('locksmith');
    const courier = skill('courier');
    expect(reveal(s.log, content)).toEqual([
      {
        skillId: 'locksmith',
        name: lock.name,
        promise: lock.promise,
        verdict: 'take',
        read: false,
        did: lock.did.take.line,
        wolf: lock.did.take.wolf,
        points: lock.did.take.points,
        worth: worth(lock, 'take', content),
      },
      {
        skillId: 'courier',
        name: courier.name,
        promise: courier.promise,
        verdict: 'limit',
        read: true,
        did: courier.did.limit.line,
        wolf: null,
        points: courier.did.limit.points,
        worth: worth(courier, 'limit', content),
      },
    ]);
    expect(reveal(s.log, content).map((e) => e.skillId)).toEqual(s.basket.map((b) => b.s));
  });

  it('only the ones that served the wolf carry the sentence that lands the lesson', () => {
    const s = fullRun({ lantern: 'take', courier: 'take', locksmith: 'limit' });
    const rows = reveal(s.log, content);
    expect(rows.map((r) => r.wolf !== null)).toEqual(
      rows.map((r) => skill(r.skillId).did[r.verdict].wolf !== undefined),
    );
    expect(rows.filter((r) => r.wolf !== null).map((r) => r.skillId)).toEqual([
      'courier',
      'locksmith',
    ]);
  });

  it('an empty basket reveals nothing and arrives at grandma', () => {
    const s = run([...begin, { type: 'ENTER_COTTAGE' }]);
    expect(reveal(s.log, content)).toEqual([]);
    expect(ending(s.log, content)).toBe('grandma');
    expect(score(s.log, content).total).toBe(0);
  });
});
