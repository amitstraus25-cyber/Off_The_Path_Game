import { describe, expect, it } from 'vitest';
import { result } from '../../src/v2/scoring.ts';
import { TIME_LIMIT_MS } from '../../src/v2/state.ts';
import { playSummary } from '../../src/v2/stats.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';

/* Seed 0 deals the lantern good and the courier and the locksmith bad (fixture.ts). */

describe('the play stats: what a replayed run comes to, and nothing about who played it', () => {
  it('a careful arrival: every count, the good skill taken, and its score', () => {
    const state = fullRun({ lantern: 'take', courier: 'leave', locksmith: 'leave' });
    expect(playSummary(state, content)).toEqual({
      ending: 'grandma',
      durationMs: state.now,
      met: 3,
      opened: 3,
      left: 2,
      takenGood: ['lantern'],
      takenBad: [],
      score: 100,
    });
  });

  it('a run the wolf got into names the malicious skill that did it', () => {
    const state = fullRun({ lantern: 'take', courier: 'take', locksmith: 'leave' });
    const summary = playSummary(state, content);
    expect(summary).toMatchObject({
      ending: 'wolf',
      takenGood: ['lantern'],
      takenBad: ['courier'],
    });
    expect(summary.score).toBe(result(state, content).total);
  });

  it('a run left partway is a quit, with no score, counted up to where it stopped', () => {
    const state = run([...begin, ...encounter('lantern', 'take', false)]);
    expect(playSummary(state, content)).toEqual({
      ending: 'quit',
      durationMs: state.now,
      met: 1,
      opened: 0,
      left: 0,
      takenGood: ['lantern'],
      takenBad: [],
      score: null,
    });
  });

  it('a run the clock ran out on is late, and scores what a late run scores', () => {
    const state = run([...begin, { type: 'TIME_UP', at: TIME_LIMIT_MS }]);
    expect(playSummary(state, content)).toMatchObject({
      ending: 'late',
      durationMs: TIME_LIMIT_MS,
      score: result(state, content).total,
    });
  });
});
