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

/*
 * WHAT THE CAREFUL RUN DECIDES, derived from the content rather than typed out.
 *
 * This was a map of the three shipped character ids to three verdicts. `carefulRun` already walked
 * `content.characters`, so a fourth traveller added as pure content (CLAUDE.md rule 3) would have
 * been met, questioned, inspected and then handed `v: undefined` -- every api test failing at once
 * on a thrown "VERDICT rejected" from a fixture, for a content edit that broke nothing.
 *
 * The rule, which reproduces the three verdicts that were written here: play every offer the way
 * the game itself says is right, except the one offer an errand actually needs granted -- accept
 * that one in full, so the run carries an errand out instead of refusing its way to a boundary and
 * nothing else. That is what makes it "worth a good score" rather than merely legal, and it is the
 * half of the fixture that exercises a GRANTED capability on the way through the replay.
 */
const finalErrand = content.scoring.errandGoals.at(-1)!;

/**
 * The one skill the careful run accepts in full: the errand above needs what it grants, and its
 * own best verdict withholds exactly that. `undefined` if no such skill ships, and then every
 * traveller is simply played at her best.
 */
const acceptedInFull = content.skills.find(
  (s) =>
    s.outcomes.allow.grants.includes(finalErrand.needs) &&
    !s.outcomes[s.bestVerdict].grants.includes(finalErrand.needs),
);

/** The verdict the careful run gives one traveller. */
const verdictFor = (skillId: string): 'allow' | 'restrict' | 'reject' =>
  skillId === acceptedInFull?.id
    ? 'allow'
    : content.skills.find((s) => s.id === skillId)!.bestVerdict;

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
      { type: 'VERDICT', s: c.skillId, v: verdictFor(c.skillId) },
    ]),
    { type: 'READ_NOTICE', n: 'cottage-door' },
    { type: 'ENTER_COTTAGE' },
  ]);

/** A log as the wire carries it. */
export const logOf = (state: GameState): RunEvent[] => state.log;
