import '../zod-config.ts';
import { z } from 'zod';
import { MAX_LOG_EVENTS } from '../leaderboard.ts';
import { findCharacterForSkill } from './content.ts';
import type { Content } from './content.ts';
import { SEED_LIMIT } from './deal.ts';
import { tryReduce } from './reducer.ts';
import { createState, runEventSchema } from './state.ts';
import type { Action, RunEvent, State } from './state.ts';

/** The rules version a v2 log is tagged with. */
export const RULES = 2;

/**
 * The v2 run log: what the browser posts and the server replays (golden rule 6).
 *
 * VERSIONED, so a v1 log can never be scored as a v2 run and a v2 log never as a v1 run. A v1 log
 * is a bare array of events; this is an object tagged `rules: 2`, and both parsers are strict about
 * their outer shape. The events inside are keyed differently too (state.ts), so stripping the
 * envelope does not get a log past the other version either.
 *
 * `content` names the content version the run was played under. The server refuses a log played
 * against other content rather than replaying it into rules it was never played by.
 *
 * `seed` is the deal the run was played under (deal.ts), and the server deals from it. LIKE THE
 * TIMESTAMPS, IT IS CLIENT-REPORTED: a forger can take any basket of three and post the one seed
 * whose deal makes it the careful answer, and it replays as legal and scores 100. Replay proves the
 * log is consistent with its seed, not that the seed was drawn fairly. Closing it is the same fix
 * as the clock's (below): the server issues the seed with the start token at BEGIN.
 */
export const runLogSchema = z.strictObject({
  rules: z.literal(RULES),
  content: z.string().min(1),
  seed: z
    .number()
    .int()
    .min(0)
    .max(SEED_LIMIT - 1),
  events: z.array(runEventSchema).max(MAX_LOG_EVENTS),
});
export type RunLog = z.infer<typeof runLogSchema>;

export const toRunLog = (state: State): RunLog => ({
  rules: RULES,
  content: state.contentVersion,
  seed: state.seed,
  events: state.log,
});

export type LogCheck =
  | { legal: true; /** Reached the cottage or ran out of time. */ ended: boolean; state: State }
  | { legal: false; reason: string };

const sameEvent = (a: RunEvent, b: RunEvent): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Replays a run log through the reducer. Legal when every event is accepted in order and the
 * replay produces exactly the same log: nothing dropped, nothing invented, nothing restamped.
 *
 * Navigation is not logged (closing a card, walking away from a conversation), so the replay
 * inserts BACK and MEET itself, stamped with the next event's time. A MEET for a character the log
 * never met would add a `met` event, which the equality check catches.
 *
 * The clock is the reducer's, not a second copy here: an event stamped at or after the limit is
 * refused by the same rule that refuses it in the browser. A client cannot buy time with a later
 * stamp, and cannot hide a late run by dropping its `late` event -- the replay would add it back
 * and the logs would differ.
 *
 * WHAT THIS CANNOT DO, stated because the first draft overclaimed it: the stamps are CLIENT-
 * REPORTED. A forged log with every event at 0ms, or a slow run restamped to finish at 179,990ms,
 * replays as legal and scores in full -- a reviewer built both. Replay proves the log is
 * internally consistent; it cannot prove the times are real. Closing that needs the server to know
 * when the run began (a start token issued by the API at BEGIN, and an elapsed bound checked
 * against it on submit). That is Phase 9 step E, and until it lands the timer is honest for
 * players and NOT a defence against someone forging the leaderboard.
 */
export function checkRunLog(raw: unknown, content: Content): LogCheck {
  const parsed = runLogSchema.safeParse(raw);
  if (!parsed.success) return { legal: false, reason: 'malformed log' };
  if (parsed.data.content !== content.version) return { legal: false, reason: 'content-mismatch' };

  let state = createState(content, parsed.data.seed);
  const run = (action: Action): string | null => {
    const r = tryReduce(state, action, content);
    state = r.state;
    return r.ok ? null : r.reason;
  };
  /** Closes whatever panel is open, one BACK at a time, stopping at the first refusal. */
  const closePanels = (at: number): string | null => {
    let reason: string | null = null;
    while (reason === null && (state.phase === 'talk' || state.phase === 'card'))
      reason = run({ type: 'BACK', at });
    return reason;
  };
  /** Brings Purple face to face with `c`: in conversation with them, no card open. */
  const focus = (c: string, at: number): string | null => {
    if (state.phase === 'card' && state.active === c) return run({ type: 'BACK', at });
    if (state.phase === 'talk' && state.active === c) return null;
    return closePanels(at) ?? run({ type: 'MEET', c, at });
  };

  // A fresh state always accepts these two, so their results are not checked.
  run({ type: 'START', runId: 'replay' });
  run({ type: 'BEGIN' });

  for (const [i, e] of parsed.data.events.entries()) {
    let reason: string | null;
    switch (e.e) {
      case 'met':
        reason = closePanels(e.at) ?? run({ type: 'MEET', c: e.c, at: e.at });
        break;
      case 'inspected':
      case 'verdict': {
        const c = findCharacterForSkill(content, e.s);
        if (!c) {
          reason = 'unknown-skill';
          break;
        }
        const step: Action =
          e.e === 'inspected'
            ? { type: 'INSPECT', s: e.s, at: e.at }
            : { type: 'VERDICT', s: e.s, v: e.v, at: e.at };
        /*
         * A verdict is replayed from the CONVERSATION, never by opening a card on the player's
         * behalf: inserting an INSPECT here would invent an `inspected` event an honest log does
         * not have, and the equality check would call it a forgery.
         */
        reason = focus(c.id, e.at) ?? run(step);
        break;
      }
      case 'arrived':
        reason = closePanels(e.at) ?? run({ type: 'ENTER_COTTAGE', at: e.at });
        break;
      case 'late':
        reason = run({ type: 'TIME_UP', at: e.at });
        break;
    }
    if (reason) return { legal: false, reason: `event ${i}: ${reason}` };
    if (state.log.length !== i + 1 || !sameEvent(state.log[i]!, e))
      return { legal: false, reason: `event ${i}: log does not replay exactly` };
  }
  return { legal: true, ended: state.phase === 'cottage' || state.phase === 'late', state };
}
