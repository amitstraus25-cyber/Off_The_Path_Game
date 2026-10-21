import { loadContent } from '../../src/v2/load.ts';
import { tryReduce } from '../../src/v2/reducer.ts';
import { createState } from '../../src/v2/state.ts';
import type { Verdict } from '../../src/v2/content.ts';
import type { Action, State } from '../../src/v2/state.ts';
import { deepFreeze } from '../helpers.ts';
import { raw } from './fixture.ts';

export { deepFreeze };

export const content = loadContent(raw);

/** A fresh title. Seed 0 deals the lantern good (fixture.ts). */
export const fresh = (seed = 0): State => deepFreeze(createState(content, seed));

/**
 * An action whose `at` may be left out: `run` stamps it from a fake clock that ticks one second
 * per timed action, starting from the last time the state accepted.
 */
type Loose<A> = A extends { at: number } ? Omit<A, 'at'> & { at?: number } : A;
export type Step = Loose<Action>;

const TIMED = new Set(['MEET', 'INSPECT', 'VERDICT', 'BACK', 'ENTER_COTTAGE', 'TIME_UP']);

/** Applies steps and throws on the first refusal, naming it. Freezes every state on the way. */
export function run(steps: Step[], from: State = fresh()): State {
  let state = from;
  let clock = state.now;
  for (const step of steps) {
    clock += 1000;
    const action = (
      TIMED.has(step.type) ? { ...step, at: ('at' in step ? step.at : undefined) ?? clock } : step
    ) as Action;
    if ('at' in action) clock = action.at;
    const r = tryReduce(state, action, content);
    if (!r.ok) throw new Error(`${step.type} refused: ${r.reason}`);
    state = deepFreeze(r.state);
  }
  return state;
}

export const begin: Step[] = [{ type: 'START', runId: 'r1' }, { type: 'BEGIN' }];

/** Meet the character who offers `skill`, open the card when asked to, and decide. */
export function encounter(skill: string, verdict: Verdict, inspect = true): Step[] {
  const c = content.characters.find((x) => x.skillId === skill)!;
  return [
    { type: 'MEET', c: c.id },
    ...(inspect ? [{ type: 'INSPECT', s: skill } as Step] : []),
    { type: 'VERDICT', s: skill, v: verdict },
  ];
}

/** Title to cottage, one verdict per skill in content order, every card opened. */
export function fullRun(verdicts: Record<string, Verdict>, seed = 0): State {
  return run(
    [
      ...begin,
      ...content.skills.flatMap((s) => encounter(s.id, verdicts[s.id]!)),
      { type: 'ENTER_COTTAGE' },
    ],
    fresh(seed),
  );
}
