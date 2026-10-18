import { z } from 'zod';
import { VERDICTS } from './content.ts';
import type { CharacterId, Content, Flag, SkillId, Verdict } from './content.ts';

export type Phase =
  'title' | 'intro' | 'explore' | 'dialogue' | 'inspect' | 'cottage' | 'results' | 'leaderboard';

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const at = z.number().finite().min(0);

/** One entry of the append-only run log. Key order matters: it is what the reducer emits. */
export const runEventSchema = z.union([
  z.strictObject({ t: z.literal('met'), c: slug, at }),
  z.strictObject({ t: z.literal('asked'), c: slug, q: slug, at }),
  z.strictObject({ t: z.literal('inspected'), s: slug, at }),
  z.strictObject({ t: z.literal('verdict'), s: slug, v: z.enum(VERDICTS), at }),
  z.strictObject({ t: z.literal('read'), n: slug, at }),
  z.strictObject({ t: z.literal('arrived'), at }),
]);
export type RunEvent = z.infer<typeof runEventSchema>;

export interface GameState {
  phase: Phase;
  contentVersion: string;
  runId: string | null;
  met: CharacterId[];
  asked: Record<CharacterId, string[]>;
  inspected: SkillId[];
  /** Notices Red has read, in order. */
  read: string[];
  verdicts: Record<SkillId, Verdict>;
  basket: string[];
  flags: Flag[];
  activeCharacter: CharacterId | null;
  log: RunEvent[];
  startedAt: number | null;
  finishedAt: number | null;
}

export function createState(content: Content): GameState {
  return {
    phase: 'title',
    contentVersion: content.version,
    runId: null,
    met: [],
    asked: {},
    inspected: [],
    read: [],
    verdicts: {},
    basket: [...content.startBasket],
    flags: [],
    activeCharacter: null,
    log: [],
    startedAt: null,
    finishedAt: null,
  };
}

/** Time is always injected via `at`; core never reads a clock. */
export type Action =
  | { type: 'START'; runId: string; at: number }
  | { type: 'BEGIN' }
  | { type: 'MEET'; c: CharacterId; at: number }
  | { type: 'ASK'; c: CharacterId; q: string; at: number }
  | { type: 'INSPECT'; s: SkillId; at: number }
  | { type: 'READ_NOTICE'; n: string; at: number }
  | { type: 'VERDICT'; s: SkillId; v: Verdict; at: number }
  | { type: 'BACK' }
  | { type: 'ENTER_COTTAGE'; at: number }
  | { type: 'FINISH'; at: number }
  | { type: 'LEADERBOARD' }
  | { type: 'RESET' };

export type RejectReason =
  | 'wrong-phase'
  | 'unknown-character'
  | 'unknown-notice'
  | 'already-read'
  | 'unknown-question'
  | 'wrong-character'
  | 'wrong-skill'
  | 'already-asked'
  | 'already-decided'
  /** Restrict and Reject name what to strip, and from the conversation nothing has been named. */
  | 'must-open-the-card'
  | 'cottage-locked'
  | 'time-went-backwards';
