import { createState, loadContent, tryReduce } from '@otp/core';
import type { Action, Content, GameState, RunEvent } from '@otp/core';
import raw from '../../../content/game.json';

/*
 * Real runs, through the real reducer, against the shipped content. Nothing in this directory
 * fabricates a log by hand except where a test is deliberately forging one: a fixture the reducer
 * would not have produced proves nothing about a route whose whole job is replaying.
 */

export const content: Content = loadContent(raw);

/** An action with its timestamp left to the fake clock. Distributes, so the union survives. */
type Loose<A> = A extends { at: number } ? Omit<A, 'at'> & { at?: number } : A;
export type Step = Loose<Action>;

const TIMED = ['START', 'MEET', 'ASK', 'INSPECT', 'VERDICT', 'READ_NOTICE', 'ENTER_COTTAGE'];

/** Applies steps and throws on the first one the reducer rejects. One second per step. */
export function play(steps: Step[]): GameState {
  let state = createState(content);
  let clock = 0;
  for (const step of steps) {
    clock += 1000;
    const action = (TIMED.includes(step.type) ? { ...step, at: clock } : step) as Action;
    const result = tryReduce(state, action, content);
    if (!result.ok) throw new Error(`${step.type} rejected: ${result.reason}`);
    state = result.state;
  }
  return state;
}

const VERDICTS: Record<string, 'allow' | 'restrict' | 'reject'> = {
  rabbit: 'restrict',
  owl: 'reject',
  'lantern-keeper': 'allow',
};

/**
 * The careful run: both bonus questions asked of all three, every card opened, both notices read,
 * and the cottage reached. Legal, complete, and worth a good score.
 */
export const carefulRun = (): GameState =>
  play([
    { type: 'START', runId: 'test' },
    { type: 'BEGIN' },
    { type: 'READ_NOTICE', n: 'forest-post' },
    ...content.characters.flatMap((c): Step[] => [
      { type: 'MEET', c: c.id },
      { type: 'ASK', c: c.id, q: 'needs' },
      { type: 'ASK', c: c.id, q: 'who' },
      { type: 'INSPECT', s: c.skillId },
      { type: 'VERDICT', s: c.skillId, v: VERDICTS[c.id]! },
    ]),
    { type: 'READ_NOTICE', n: 'cottage-door' },
    { type: 'ENTER_COTTAGE' },
  ]);

/** A log as the wire carries it. */
export const logOf = (state: GameState): RunEvent[] => state.log;
