import { describe, expect, it } from 'vitest';
import * as core from '../../src/index.ts';
import * as barrel from '../../src/v2/index.ts';
import { VERDICTS } from '../../src/v2/content.ts';
import { tryReduce } from '../../src/v2/reducer.ts';
import { checkRunLog, toRunLog } from '../../src/v2/runlog.ts';
import { result } from '../../src/v2/scoring.ts';
import { mulberry32 } from '../../src/v2/sim.ts';
import { TIME_LIMIT_MS, createState } from '../../src/v2/state.ts';
import type { Action } from '../../src/v2/state.ts';
import { content, deepFreeze } from './helpers.ts';

function randomAction(rnd: () => number, at: number): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const c = pick([...content.characters.map((x) => x.id), 'ghost']);
  const s = pick([...content.skills.map((x) => x.id), 'ghost']);
  return pick<Action>([
    { type: 'MEET', c, at },
    { type: 'MEET', c, at },
    { type: 'INSPECT', s, at },
    { type: 'INSPECT', s, at },
    { type: 'VERDICT', s, v: pick(VERDICTS), at },
    { type: 'VERDICT', s, v: pick(VERDICTS), at },
    { type: 'BACK', at },
    { type: 'BACK', at },
    { type: 'ENTER_COTTAGE', at },
    { type: 'TIME_UP', at },
  ]);
}

describe('property: random play under a random clock', () => {
  /*
   * The clock is drawn so that a good share of runs cross the three-minute line mid-encounter:
   * steps of up to 12s over up to 45 steps is up to nine minutes. That is the case the late rule
   * exists for, so the generator is built to reach it rather than to avoid it. The step count
   * varies by seed so that some runs also stop short, still in the forest: with a fixed 40 steps
   * every run ended, and the "not ended" half of `ended` was never once exercised.
   */
  it('the server replays every live log to the same state, score and reveal', () => {
    let accepted = 0;
    const endings = { cottage: 0, late: 0, open: 0 };
    for (let seed = 1; seed <= 800; seed++) {
      const rnd = mulberry32(seed);
      let state = deepFreeze(createState(content, seed % 3));
      for (const a of [{ type: 'START', runId: `r${seed}` }, { type: 'BEGIN' }] as Action[])
        state = tryReduce(state, a, content).state;
      let clock = 0;
      const steps = 5 + Math.floor(rnd() * 41);
      for (let step = 0; step < steps; step++) {
        clock += Math.floor(rnd() * 12_000);
        const r = tryReduce(state, randomAction(rnd, clock), content);
        if (!r.ok && r.reason !== 'out-of-time') {
          expect(r.state).toBe(state); // a refusal changes nothing...
          continue;
        }
        // ...except the clock running out, which always ends the run at the limit.
        if (!r.ok) expect(r.state.log.at(-1)).toEqual({ e: 'late', at: TIME_LIMIT_MS });
        accepted++;
        state = deepFreeze(r.state);
      }
      const check = checkRunLog(toRunLog(state), content);
      expect(check, `seed ${seed}`).toMatchObject({ legal: true });
      if (!check.legal) continue;
      expect(check.state.log).toEqual(state.log);
      expect(check.state.basket).toEqual(state.basket);
      expect(check.state.verdicts).toEqual(state.verdicts);
      expect(check.state.phase === 'late' || check.state.phase === 'cottage').toBe(check.ended);
      expect(check.state.good).toEqual(state.good);
      expect(result(check.state, content)).toEqual(result(state, content));
      // The reveal's takes are the basket: nothing taken is missing, nothing left is counted.
      const taken = result(state, content).entries.filter((e) => e.verdict === 'take');
      expect(taken.map((e) => e.skillId).sort()).toEqual(state.basket.map((b) => b.s).sort());
      if (state.phase === 'cottage') endings.cottage++;
      else if (state.phase === 'late') endings.late++;
      else endings.open++;
    }
    expect(accepted).toBeGreaterThan(2000);
    // The generator reaches all three outcomes, or the property above says nothing about one.
    expect(endings.cottage).toBeGreaterThan(20);
    expect(endings.late).toBeGreaterThan(20);
    expect(endings.open).toBeGreaterThan(20);
  });
});

describe('the v2 barrel', () => {
  it('is exported from core under its own name', () => {
    expect(core.v2).toBe(barrel);
    for (const name of [
      'contentSchema',
      'loadContent',
      'parseContent',
      'lintContent',
      'createState',
      'tryReduce',
      'reduce',
      'score',
      'result',
      'reveal',
      'deal',
      'dealCount',
      'variantOf',
      'giveaway',
      'ending',
      'checkRunLog',
      'toRunLog',
      'runLogSchema',
      'play',
      'trapChecks',
      'everyRun',
      'blindAverages',
      'clockCheck',
      'TIME_LIMIT_MS',
      'RULES',
    ])
      expect(barrel, name).toHaveProperty(name);
    expect(core.ContentError).toBe(barrel.ContentError);
  });
});
