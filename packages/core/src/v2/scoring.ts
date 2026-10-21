import { findSkill, worth } from './content.ts';
import type { Content, SkillId, Take } from './content.ts';
import type { RunEvent } from './state.ts';

/**
 * How a run ended. `null` while it is still in the forest.
 *
 *  - `late`     the clock ran out. Its own ending, not a penalty (GAME_DESIGN_V2 section 2).
 *  - `wolf`     arrived, and at least one skill in the basket served the wolf.
 *  - `grandma`  arrived, and nothing in the basket served the wolf.
 */
export type Ending = 'grandma' | 'wolf' | 'late';

/** One row of the reveal: one skill the player took, in the order they took it. */
export interface RevealEntry {
  skillId: SkillId;
  name: string;
  /** What it promised. Always true. */
  promise: string;
  verdict: Take;
  /** Whether the player opened its card before deciding. */
  read: boolean;
  /** What it did on the way. */
  did: string;
  /** For the ones that served the wolf, the sentence that lands the lesson. Otherwise null. */
  wolf: string | null;
  /** What the kept promise earned. */
  points: number;
  /** What it was worth in the end: `points`, less the wolf's cost if it served the wolf. */
  worth: number;
}

/**
 * THE REVEAL, AS DATA: per skill taken, what it promised and what it did, in basket order. The
 * product's payoff (GAME_DESIGN_V2 section 6), ready for Phase D to render and for nothing else to
 * have to work out.
 *
 * A pure function of the log, like `score`, so the browser and the server cannot tell two stories.
 * Assumes a legal log (runlog.ts `checkRunLog`).
 */
export function reveal(log: readonly RunEvent[], content: Content): RevealEntry[] {
  const opened = new Set<SkillId>();
  const rows: RevealEntry[] = [];
  for (const e of log) {
    if (e.e === 'inspected') opened.add(e.s);
    if (e.e !== 'verdict' || e.v === 'leave') continue;
    const s = findSkill(content, e.s)!;
    const d = s.did[e.v];
    rows.push({
      skillId: s.id,
      name: s.name,
      promise: s.promise,
      verdict: e.v,
      read: opened.has(s.id),
      did: d.line,
      wolf: d.wolf ?? null,
      points: d.points,
      worth: worth(s, e.v, content),
    });
  }
  return rows;
}

/** Which ending a log reached. The late event outranks everything; a log cannot hold both. */
export function ending(log: readonly RunEvent[], content: Content): Ending | null {
  if (log.some((e) => e.e === 'late')) return 'late';
  if (!log.some((e) => e.e === 'arrived')) return null;
  return reveal(log, content).some((r) => r.wolf !== null) ? 'wolf' : 'grandma';
}

export interface ScoreResult {
  /**
   * Out of `outOf`, floored at 0. NULL -- not zero -- for a run that never made it or has not
   * arrived: running out of time is an ending, not a score, and a late run is not on the board.
   */
  total: number | null;
  outOf: number;
  ending: Ending | null;
  /** The reveal the total was summed from. */
  entries: RevealEntry[];
  /** Everything the kept promises earned. */
  earned: number;
  /** Everything the wolf took back. */
  lost: number;
  /** How many skills in the basket served the wolf. */
  served: number;
}

/**
 * SCORED BY WHAT THE SKILLS DID, NEVER BY HOW MANY. The total is the sum of `worth` over the
 * basket -- what each kept promise earned, less `wolfCost` for each that also served the wolf --
 * floored at 0. A skill passed by or left adds nothing either way. There is no per-skill bonus for
 * collecting, so a full basket of the wrong things sums to near zero. The lint holds every
 * wolf-serving verdict below zero, so adding one lowers the SUM -- but not always the TOTAL: this
 * used to say "always lowers the total", and at the floor it does not. A basket holding only a
 * wolf-serving skill scores 0, exactly as leaving it does (a reviewer measured it). What differs
 * there is the ENDING, 'wolf' against 'grandma', and the reveal row that says what the skill did.
 * The lesson at the floor is carried by those, not by the number.
 *
 * Every number comes from content, so Phase B tunes it without code (golden rule 3). Pure function
 * of the log and content; assumes a legal log.
 */
export function score(log: readonly RunEvent[], content: Content): ScoreResult {
  const entries = reveal(log, content);
  const end = ending(log, content);
  const earned = entries.reduce((t, r) => t + r.points, 0);
  const lost = entries.reduce((t, r) => t + (r.points - r.worth), 0);
  return {
    total: end === null || end === 'late' ? null : Math.max(0, earned - lost),
    outOf: content.scoring.outOf,
    ending: end,
    entries,
    earned,
    lost,
    served: entries.filter((r) => r.wolf !== null).length,
  };
}
