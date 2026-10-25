import { findSkill, giveaway } from './content.ts';
import type { Content, SkillId, Verdict } from './content.ts';
import { variantOf } from './deal.ts';
import { clockMs, rewoundMs } from './perks.ts';
import { TIME_LIMIT_MS } from './state.ts';
import type { State } from './state.ts';

/**
 * How a run ended. `null` while it is still in the forest.
 *
 *  - `late`     the clock ran out. Its own ending, not a penalty (GAME_DESIGN_V2 section 2).
 *  - `wolf`     arrived, and at least one skill in the basket was dealt bad.
 *  - `grandma`  arrived, and nothing in the basket was bad.
 */
export type Ending = 'grandma' | 'wolf' | 'late';

/** One row of the reveal: one character's offer, in walking order, and what it really was. */
export interface RevealEntry {
  skillId: SkillId;
  name: string;
  /** What it promised. Kept in both variants: that is the lesson. */
  promise: string;
  /** Whether it was dealt good this run. */
  good: boolean;
  /** What the player said to it, or null if they never answered. Unanswered counts as left. */
  verdict: Verdict | null;
  /** Whether the player opened its card before deciding. */
  read: boolean;
  /** This run's variant's reveal line: what it did, or would have done. */
  line: string;
  /** For a skill dealt bad, the card line that gave it away. Null for a good one. */
  giveaway: string | null;
}

/**
 * THE REVEAL, AS DATA: every offer, in walking order, with what the dealt variant really did and,
 * for a bad one, the line on its card that said so. A pure function of the state's deal and log,
 * like `score`, so the browser and the server cannot tell two stories. Assumes a legal log.
 */
export function reveal(state: State, content: Content): RevealEntry[] {
  const opened = new Set<SkillId>();
  const said = new Map<SkillId, Verdict>();
  for (const e of state.log) {
    if (e.e === 'inspected') opened.add(e.s);
    if (e.e === 'verdict') said.set(e.s, e.v);
  }
  return content.characters.map((c) => {
    const s = findSkill(content, c.skillId)!;
    const good = state.good.includes(s.id);
    return {
      skillId: s.id,
      name: s.name,
      promise: s.promise,
      good,
      verdict: said.get(s.id) ?? null,
      read: opened.has(s.id),
      line: variantOf(state.good, s).reveal,
      giveaway: good ? null : giveaway(s),
    };
  });
}

/** Which ending a run reached. The late event outranks everything; a log cannot hold both. */
export function ending(state: State, content: Content): Ending | null {
  if (state.log.some((e) => e.e === 'late')) return 'late';
  if (!state.log.some((e) => e.e === 'arrived')) return null;
  return reveal(state, content).some((r) => r.verdict === 'take' && !r.good) ? 'wolf' : 'grandma';
}

export interface RunResult {
  /** The score, as `score` gives it: `played` + `choices` + `speed`. */
  total: number;
  outOf: number;
  ending: Ending | null;
  /** The reveal the total was read from. */
  entries: RevealEntry[];
  /** How many good skills are in the basket. */
  good: number;
  /** How many bad skills are in the basket: each one let the wolf in. */
  served: number;
  /** The part of the total every run that ENDED earns: the content's `played`. 0 until it ends. */
  played: number;
  /** The part of the total the basket earned: `clean` + `good` per good skill. 0 unless clean. */
  choices: number;
  /** The part of the total the clock earned (`speedBonus`). 0 unless clean. */
  speed: number;
  /**
   * The RUN CLOCK at the cottage door -- the arrival stamp less whatever a rewind gave back -- or
   * null for a run that never reached it. It is the time the speed bonus counted, so it is the
   * time to show beside par.
   */
  timeMs: number | null;
  /** What the run's rewinds gave back, in ms: 0 without one (perks.ts `rewoundMs`). */
  rewoundMs: number;
  /** The par the speed bonus was measured against, from the content. */
  parMs: number;
}

/**
 * The run's REAL elapsed time at the cottage door, read from its own log, which is the number the
 * server bounds against its clock. Null if it never arrived. The score counts `result().timeMs`.
 */
export const arrivalMs = (state: State): number | null =>
  state.log.find((e) => e.e === 'arrived')?.at ?? null;

/**
 * THE SPEED BONUS: `speed` x speedFactor x good/dealt-good, rounded to a whole point.
 *
 * speedFactor is 1 at or under `parMs`, falls in a straight line to 0 at the time limit, and is
 * never negative. The bonus is scaled by the share of the good skills taken, so speed is a
 * multiplier on being right rather than a second way to score: leaving everything earns no bonus
 * however fast, and the lint (content.ts) holds the weights so that a fast basket one good skill
 * short can never outscore a full basket at any pace that arrives.
 *
 * Integer arithmetic until the one division, so the browser and the server -- the same function on
 * two machines -- round the same way. Pure: the time is the log's own `arrived` stamp on the run
 * clock -- less what a `rewind` perk gave back (perks.ts `clockMs`) -- never a clock read here.
 */
export function speedBonus(content: Content, good: number, timeMs: number): number {
  const { speed, parMs } = content.scoring;
  const span = TIME_LIMIT_MS - parMs;
  const left = Math.min(span, Math.max(0, TIME_LIMIT_MS - timeMs));
  return Math.round((speed * good * left) / (content.deal.good * span));
}

/**
 * EVERYTHING THE END OF A RUN SAYS, in one call: the score, the ending and the reveal.
 *
 * THE SCORE, out of 100 with the shipped weights (GAME_DESIGN_V2 section 9), CORRECTNESS FIRST:
 *
 *   - arrived clean (nothing bad taken):   `played` + `clean` + `good` per good skill + `speedBonus`
 *   - the wolf got in (any bad skill):     `played`, however fast
 *   - late:                                `played`
 *   - not ended yet:                       0
 *
 * `played` (the client, 2026-10-25): every run that ends scores it, so every player has a score
 * to post, and their work email with it. With the shipped 25 / 15 / 15 / 15: three good at or under
 * par is 100, three good just inside the clock is 85, two good at par is 80, one good at par is 60,
 * and leaving everything is 40 at any speed. A wolf run or a late one is 25: every one of them sits
 * below every clean one, because `clean` is at least 1. The weights and the par are content (golden
 * rule 3); `played`-and-nothing-more for the wolf and the limit are rules.
 */
export function result(state: State, content: Content): RunResult {
  const entries = reveal(state, content);
  const end = ending(state, content);
  const taken = entries.filter((r) => r.verdict === 'take');
  const good = taken.filter((r) => r.good).length;
  const { played: base, clean, good: each, outOf, parMs } = content.scoring;
  const arrived = arrivalMs(state);
  const timeMs = arrived === null ? null : clockMs(state, arrived);
  const clear = end === 'grandma';
  const played = end === null ? 0 : base;
  const choices = clear ? clean + each * good : 0;
  const speed = clear ? speedBonus(content, good, timeMs!) : 0;
  return {
    total: played + choices + speed,
    outOf,
    ending: end,
    entries,
    good,
    served: taken.length - good,
    played,
    choices,
    speed,
    timeMs,
    rewoundMs: rewoundMs(state),
    parMs,
  };
}

/** The score: an integer from 0 to `content.scoring.outOf` (100). See `result` for the rule. */
export const score = (state: State, content: Content): number => result(state, content).total;
