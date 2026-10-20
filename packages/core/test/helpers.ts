import raw from '../../../content/game.json';
import { loadContent } from '../src/content.ts';
import { createState } from '../src/state.ts';
import { tryReduce } from '../src/reducer.ts';
import type { Verdict } from '../src/content.ts';
import type { Action, GameState } from '../src/state.ts';

export const content = loadContent(raw);

/** Recursively freezes so any accidental mutation in the reducer throws in tests. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

export const fresh = (): GameState => deepFreeze(createState(content));

/** Applies actions and throws if any is rejected. A fake clock ticks 1s per action. */
type Loose<A> = A extends { at: number } ? Omit<A, 'at'> & { at?: number } : A;
export type Step = Loose<Action>;

export function run(actions: Step[], from: GameState = fresh()): GameState {
  let state = from;
  let clock = Math.max(state.log.at(-1)?.at ?? 0, state.startedAt ?? 0);
  for (const a of actions) {
    clock += 1000;
    const action = (
      'at' in a || needsTime(a.type) ? { ...a, at: ('at' in a ? a.at : undefined) ?? clock } : a
    ) as Action;
    const r = tryReduce(state, action, content);
    if (!r.ok) throw new Error(`${a.type} rejected: ${r.reason}`);
    state = deepFreeze(r.state);
  }
  return state;
}

const needsTime = (t: string): boolean =>
  ['START', 'MEET', 'ASK', 'INSPECT', 'VERDICT', 'READ_NOTICE', 'ENTER_COTTAGE', 'FINISH'].includes(
    t,
  );

export const begin: Step[] = [{ type: 'START', runId: 'r1' }, { type: 'BEGIN' }];

/** A full legal encounter: meet, optional questions, show me, verdict. */
export function encounter(character: string, verdict: string, questions: string[] = []): Step[] {
  const c = content.characters.find((x) => x.id === character)!;
  return [
    { type: 'MEET', c: c.id },
    ...questions.map((q): Step => ({ type: 'ASK', c: c.id, q })),
    { type: 'INSPECT', s: c.skillId },
    { type: 'VERDICT', s: c.skillId, v: verdict as Verdict },
  ];
}

/**
 * The cast, in the order the content file lists it.
 *
 * It was `['rabbit', 'owl', 'lantern-keeper'] as const`. Three ids typed into a test helper are
 * three ids the game no longer has to agree with: a fourth traveller added as pure content
 * (CLAUDE.md rule 3) would never be met in any run built here, and every suite downstream would go
 * on passing about a three-character game. Derived, `fullRun` meets whoever is shipped -- and a
 * verdict missing for one of them throws in `run` rather than quietly scoring zero for that skill.
 */
export const CHARACTERS: readonly string[] = content.characters.map((c) => c.id);

/** Whole run from title to cottage with one verdict per character (same verdict for all or per-character). */
export function fullRun(verdicts: Record<string, string>, questions: string[] = []): GameState {
  return run([
    ...begin,
    ...CHARACTERS.flatMap((c) => encounter(c, verdicts[c]!, questions)),
    { type: 'ENTER_COTTAGE' },
  ]);
}
