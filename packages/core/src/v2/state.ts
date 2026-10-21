import '../zod-config.ts';
import { z } from 'zod';
import { VERDICTS } from './content.ts';
import type { CharacterId, Content, SkillId, Take, Verdict } from './content.ts';

/**
 * Three minutes, hard. The client's decision (GAME_DESIGN_V2 section 3, "do not re-litigate").
 *
 * A RULE, NOT CONTENT. It is not in the content file because it is not a tuning knob: the server
 * replays a run against this number, and a content edit that moved it would quietly change what
 * "in time" means for every run already played. Phase F's test-mode override for the e2e suite
 * belongs in the CLOCK the game injects -- slow the clock, not the limit -- so core keeps exactly
 * one limit and the shipped bundle cannot carry a second one.
 */
export const TIME_LIMIT_MS = 180_000;

export type Phase = 'title' | 'howto' | 'forest' | 'talk' | 'card' | 'cottage' | 'late';

/** The phases the clock runs in. Before the forest it has not started; after, it no longer matters. */
export const RUNNING: ReadonlySet<Phase> = new Set<Phase>(['forest', 'talk', 'card']);

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const at = z.number().finite().min(0);

/**
 * One entry of the append-only v2 run log. Key order matters: it is what the reducer emits.
 *
 * KEYED `e`, NOT `t`, ON PURPOSE. v1's events are keyed `t` and both schemas are strict, so no
 * event of one version parses as an event of the other. Three of v1's kinds (met, inspected,
 * arrived) have exactly the fields v2's do; with a shared key, a v2 log stripped of its envelope
 * would parse as v1. test/v2/runlog.test.ts enumerates every kind of both against the other.
 *
 * `at` is ELAPSED milliseconds since the clock started at BEGIN, not a wall-clock reading: the log
 * is self-contained, and the server needs no start time to replay it.
 */
export const runEventSchema = z.union([
  z.strictObject({ e: z.literal('met'), c: slug, at }),
  z.strictObject({ e: z.literal('inspected'), s: slug, at }),
  z.strictObject({ e: z.literal('verdict'), s: slug, v: z.enum(VERDICTS), at }),
  z.strictObject({ e: z.literal('arrived'), at }),
  z.strictObject({ e: z.literal('late'), at }),
]);
export type RunEvent = z.infer<typeof runEventSchema>;

/** One thing in the basket: which skill, and how it was taken. In the order it was taken. */
export interface BasketEntry {
  s: SkillId;
  v: Take;
}

export interface State {
  phase: Phase;
  contentVersion: string;
  runId: string | null;
  /**
   * The latest time the run has accepted, in elapsed milliseconds. Kept apart from the log because
   * BACK is timed but not logged, and "time only goes forward" has to include it.
   */
  now: number;
  met: CharacterId[];
  inspected: SkillId[];
  verdicts: Record<SkillId, Verdict>;
  basket: BasketEntry[];
  /** Who Purple is talking to, in `talk` and `card`. */
  active: CharacterId | null;
  log: RunEvent[];
}

export function createState(content: Content): State {
  return {
    phase: 'title',
    contentVersion: content.version,
    runId: null,
    now: 0,
    met: [],
    inspected: [],
    verdicts: {},
    basket: [],
    active: null,
    log: [],
  };
}

/**
 * Time is always injected: every action inside the run carries `at`, the elapsed milliseconds the
 * game's own clock reports. The reducer never reads a clock.
 */
export type Action =
  | { type: 'START'; runId: string }
  /** Leaves the how-to-play. The clock starts here, at 0. */
  | { type: 'BEGIN' }
  | { type: 'MEET'; c: CharacterId; at: number }
  | { type: 'INSPECT'; s: SkillId; at: number }
  | { type: 'VERDICT'; s: SkillId; v: Verdict; at: number }
  | { type: 'BACK'; at: number }
  | { type: 'ENTER_COTTAGE'; at: number }
  /** The game's timer firing. Legal only at or after the limit. */
  | { type: 'TIME_UP'; at: number }
  | { type: 'RESET' };

export type RejectReason =
  | 'wrong-phase'
  | 'unknown-character'
  | 'wrong-skill'
  | 'already-decided'
  /** Limiting names what to strip, and from the conversation nothing has been named. */
  | 'must-open-the-card'
  | 'time-went-backwards'
  /** NaN, infinite or negative: not a reading any clock gives. */
  | 'bad-time'
  /** TIME_UP before the limit: a fast timer cannot end a run early. */
  | 'time-not-up'
  /** The action arrived at or after the limit. It was not applied, and the run has ended late. */
  | 'out-of-time';
