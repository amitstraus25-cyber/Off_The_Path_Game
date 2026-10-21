import { findCharacter } from './content.ts';
import type { Content } from './content.ts';
import { RUNNING, TIME_LIMIT_MS, createState } from './state.ts';
import type { Action, RejectReason, RunEvent, State } from './state.ts';

export type StepResult =
  { ok: true; state: State } | { ok: false; reason: RejectReason; state: State };

const ok = (state: State): StepResult => ({ ok: true, state });
const no = (state: State, reason: RejectReason): StepResult => ({ ok: false, reason, state });
const append = (s: State, e: RunEvent): RunEvent[] => [...s.log, e];

/** The run ends where it stands, stamped at the limit -- not at whenever the news arrived. */
const late = (s: State): State => ({
  ...s,
  phase: 'late',
  active: null,
  now: TIME_LIMIT_MS,
  log: append(s, { e: 'late', at: TIME_LIMIT_MS }),
});

/**
 * Applies one action. Illegal actions return the same state plus a reason; nothing is mutated.
 *
 * ONE EXCEPTION, AND IT IS THE TIMER. An action stamped at or after the limit, in a phase where the
 * clock runs, is NOT applied -- whatever it was, legal or not, even the step through the cottage
 * door -- and the run ends late instead: `{ ok: false, reason: 'out-of-time' }` carrying the LATE
 * state. It is the one refusal that moves the state, because the clock that refused the action has
 * itself ended the run. Checked BEFORE legality: the buzzer does not care what you were trying to
 * do. Why the reducer does not simply wait for TIME_UP: a backgrounded tab throttles the game's
 * timer, so TIME_UP can arrive late or never, and a player returning at 3:40 to press Enter must
 * not arrive in time. The server replays the same rule, so a later stamp cannot buy time either.
 */
export function tryReduce(state: State, action: Action, content: Content): StepResult {
  if ('at' in action) {
    if (!Number.isFinite(action.at) || action.at < 0) return no(state, 'bad-time');
    if (RUNNING.has(state.phase)) {
      if (action.at < state.now) return no(state, 'time-went-backwards');
      if (action.at >= TIME_LIMIT_MS)
        return action.type === 'TIME_UP' ? ok(late(state)) : no(late(state), 'out-of-time');
    }
  }

  switch (action.type) {
    case 'START':
      if (state.phase !== 'title') return no(state, 'wrong-phase');
      return ok({ ...state, phase: 'howto', runId: action.runId });

    case 'BEGIN':
      return state.phase === 'howto'
        ? ok({ ...state, phase: 'forest', now: 0 })
        : no(state, 'wrong-phase');

    case 'MEET': {
      if (state.phase !== 'forest') return no(state, 'wrong-phase');
      const c = findCharacter(content, action.c);
      if (!c) return no(state, 'unknown-character');
      if (state.verdicts[c.skillId] !== undefined) return no(state, 'already-decided');
      const first = !state.met.includes(c.id);
      return ok({
        ...state,
        phase: 'talk',
        now: action.at,
        active: c.id,
        met: first ? [...state.met, c.id] : state.met,
        log: first ? append(state, { e: 'met', c: c.id, at: action.at }) : state.log,
      });
    }

    case 'INSPECT': {
      if (state.phase !== 'talk') return no(state, 'wrong-phase');
      const c = findCharacter(content, state.active!)!;
      if (c.skillId !== action.s) return no(state, 'wrong-skill');
      const first = !state.inspected.includes(action.s);
      return ok({
        ...state,
        phase: 'card',
        now: action.at,
        inspected: first ? [...state.inspected, action.s] : state.inspected,
        log: first ? append(state, { e: 'inspected', s: action.s, at: action.at }) : state.log,
      });
    }

    case 'VERDICT': {
      if (state.phase !== 'talk' && state.phase !== 'card') return no(state, 'wrong-phase');
      const c = findCharacter(content, state.active!)!;
      if (c.skillId !== action.s) return no(state, 'wrong-skill');
      /*
       * Take and leave can be said straight from the conversation, on the offerer's word or on
       * sight. Limit cannot: a boundary names what to strip, and from here nothing has been named.
       * You cannot scope what you have not read -- v1's rule, kept, and it is what lets the server
       * refuse a forged careful verdict (runlog.ts). Once the card has been read, going back to the
       * conversation does not unread it.
       */
      if (action.v === 'limit' && !state.inspected.includes(action.s))
        return no(state, 'must-open-the-card');
      return ok({
        ...state,
        phase: 'forest',
        now: action.at,
        active: null,
        verdicts: { ...state.verdicts, [action.s]: action.v },
        basket:
          action.v === 'leave' ? state.basket : [...state.basket, { s: action.s, v: action.v }],
        log: append(state, { e: 'verdict', s: action.s, v: action.v, at: action.at }),
      });
    }

    case 'BACK':
      if (state.phase === 'card') return ok({ ...state, phase: 'talk', now: action.at });
      if (state.phase === 'talk')
        return ok({ ...state, phase: 'forest', active: null, now: action.at });
      return no(state, 'wrong-phase');

    case 'ENTER_COTTAGE':
      if (state.phase !== 'forest') return no(state, 'wrong-phase');
      return ok({
        ...state,
        phase: 'cottage',
        now: action.at,
        log: append(state, { e: 'arrived', at: action.at }),
      });

    case 'TIME_UP':
      // At or past the limit in a running phase was handled above; what reaches here is early or
      // out of the run.
      return no(state, RUNNING.has(state.phase) ? 'time-not-up' : 'wrong-phase');

    case 'RESET':
      return ok(createState(content));
  }
}

/** Store-friendly form: a refusal leaves the state untouched -- except the clock ending the run. */
export const reduce = (state: State, action: Action, content: Content): State =>
  tryReduce(state, action, content).state;
