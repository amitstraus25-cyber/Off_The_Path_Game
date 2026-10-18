import { describe, expect, it } from 'vitest';
import { tryReduce } from '../src/reducer.ts';
import { checkLog } from '../src/runlog.ts';
import { score } from '../src/scoring.ts';
import { derive } from '../src/outcomes.ts';
import { VERDICTS } from '../src/content.ts';
import { createState } from '../src/state.ts';
import type { Action } from '../src/state.ts';
import { content, deepFreeze } from './helpers.ts';

// Small seeded PRNG so the property test is deterministic without a new dependency.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAction(rnd: () => number, clock: number): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const c = pick([...content.characters.map((x) => x.id), 'ghost']);
  const s = pick(content.skills.map((x) => x.id));
  const at = clock;
  return pick<Action>([
    { type: 'MEET', c, at },
    { type: 'MEET', c, at },
    { type: 'ASK', c, q: pick(['needs', 'who', 'show', 'bogus']), at },
    { type: 'ASK', c, q: pick(['needs', 'who']), at },
    { type: 'INSPECT', s, at },
    { type: 'INSPECT', s, at },
    { type: 'VERDICT', s, v: pick(VERDICTS), at },
    { type: 'VERDICT', s, v: pick(VERDICTS), at },
    { type: 'BACK' },
    { type: 'ENTER_COTTAGE', at },
    { type: 'READ_NOTICE', n: 'forest-post', at },
    { type: 'READ_NOTICE', n: pick(['forest-post', 'ghost-post']), at },
    { type: 'FINISH', at },
    { type: 'LEADERBOARD' },
  ]);
}

describe('property: random play', () => {
  it('replaying any live log reproduces the live state, score and ending inputs', () => {
    let accepted = 0;
    let complete = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const rnd = mulberry32(seed);
      let state = deepFreeze(createState(content));
      let clock = 0;
      let incremental = 0;
      for (const a of [{ type: 'START', runId: `r${seed}`, at: 0 }, { type: 'BEGIN' }] as Action[])
        state = tryReduce(state, a, content).state;

      for (let step = 0; step < 120; step++) {
        clock += 1 + Math.floor(rnd() * 5000);
        const r = tryReduce(state, randomAction(rnd, clock), content);
        if (!r.ok) {
          expect(r.state).toBe(state); // rejected actions never change anything
          continue;
        }
        accepted++;
        const last = r.state.log.at(-1);
        if (r.state.log.length > state.log.length && last?.t === 'verdict')
          incremental += content.skills.find((s) => s.id === last.s)!.outcomes[last.v].points;
        state = deepFreeze(r.state);
      }

      // 1. the log is legal and replays exactly to the same verdicts, basket and flags
      const check = checkLog(state.log, content, 0);
      expect(check.legal, `seed ${seed}`).toBe(true);
      if (!check.legal) continue;
      expect(check.state.verdicts).toEqual(state.verdicts);
      expect(check.state.basket).toEqual(state.basket);
      expect(check.state.flags).toEqual(state.flags);
      expect(derive(state.log, content)).toEqual({
        basket: state.basket,
        flags: state.flags,
        verdicts: state.verdicts,
      });

      // 2. score(log) equals the incremental running total plus every bonus
      const result = score(state.log, content);
      expect(result.total, `seed ${seed}`).toBe(
        incremental + result.bonus + result.boundaryBonus + result.errandBonus,
      );
      if (check.complete) complete++;
    }
    expect(accepted).toBeGreaterThan(1000);
    expect(complete).toBeGreaterThan(0); // the generator does reach the cottage
  });
});
