import type { Content, SkillId } from './content.ts';
import { result } from './scoring.ts';
import type { Ending } from './scoring.ts';
import type { State } from './state.ts';

/*
 * THE PLAY STATS (the client, 2026-11-04: "how many people played, how long they played, how many
 * interactions"). One summary per run, read off a REPLAYED run by the server, never reported by
 * the browser: the browser sends its run log and token, apps/api replays the log exactly as it
 * replays a post (`checkRunLog`), and this is what it keeps of the replay.
 *
 * NOTHING ABOUT THE PLAYER. No name, no address, no id of any kind: a run's skills, its counts and
 * its clock. Two summaries of the same person's two runs cannot be told from two strangers'.
 */

/** How a run ended, or `quit` for one the player left before the cottage or the clock ran out. */
export type PlayEnding = Ending | 'quit';

export interface PlaySummary {
  ending: PlayEnding;
  /** The run clock at its last accepted moment, in ms: how long it was played. */
  durationMs: number;
  /** How many characters Purple talked to. */
  met: number;
  /** How many cards the player opened before deciding. */
  opened: number;
  /** How many offers the player turned down out loud (Leave it). */
  left: number;
  /** The good skills taken, in the order taken. */
  takenGood: SkillId[];
  /** The malicious skills taken, in the order taken: who fooled this player. */
  takenBad: SkillId[];
  /** The score the run earned, or null for a run that did not end. */
  score: number | null;
}

/** What a replayed run comes to, for the stats table. */
export function playSummary(state: State, content: Content): PlaySummary {
  const run = result(state, content);
  const good = new Set(state.good);
  const taken = state.basket.map((b) => b.s);
  return {
    ending: run.ending ?? 'quit',
    durationMs: state.now,
    met: state.met.length,
    opened: state.inspected.length,
    left: Object.values(state.verdicts).filter((v) => v === 'leave').length,
    takenGood: taken.filter((s) => good.has(s)),
    takenBad: taken.filter((s) => !good.has(s)),
    score: run.ending === null ? null : run.total,
  };
}
