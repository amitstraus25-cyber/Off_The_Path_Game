import { findCharacter, findSkill } from './content.ts';
import type { Content } from './content.ts';
import { applyOutcome, canEnterCottage, findNotice, trifectaLive } from './outcomes.ts';
import { createState } from './state.ts';
import type { Action, GameState, RejectReason, RunEvent } from './state.ts';

export type StepResult =
  { ok: true; state: GameState } | { ok: false; reason: RejectReason; state: GameState };

const ok = (state: GameState): StepResult => ({ ok: true, state });
const no = (state: GameState, reason: RejectReason): StepResult => ({ ok: false, reason, state });

const lastAt = (s: GameState): number => s.log.at(-1)?.at ?? s.startedAt ?? 0;
const append = (s: GameState, e: RunEvent): RunEvent[] => [...s.log, e];

/** Applies one action. Illegal actions return the same state plus a reason; nothing is mutated. */
export function tryReduce(state: GameState, action: Action, content: Content): StepResult {
  if ('at' in action && action.at < lastAt(state)) return no(state, 'time-went-backwards');

  switch (action.type) {
    case 'START':
      if (state.phase !== 'title') return no(state, 'wrong-phase');
      return ok({ ...state, phase: 'intro', runId: action.runId, startedAt: action.at });

    case 'BEGIN':
      return state.phase === 'intro'
        ? ok({ ...state, phase: 'explore' })
        : no(state, 'wrong-phase');

    case 'MEET': {
      if (state.phase !== 'explore') return no(state, 'wrong-phase');
      const c = findCharacter(content, action.c);
      if (!c) return no(state, 'unknown-character');
      if (state.verdicts[c.skillId] !== undefined) return no(state, 'already-decided');
      const first = !state.met.includes(c.id);
      return ok({
        ...state,
        phase: 'dialogue',
        activeCharacter: c.id,
        met: first ? [...state.met, c.id] : state.met,
        log: first ? append(state, { t: 'met', c: c.id, at: action.at }) : state.log,
      });
    }

    case 'ASK': {
      if (state.phase !== 'dialogue') return no(state, 'wrong-phase');
      if (state.activeCharacter !== action.c) return no(state, 'wrong-character');
      const c = findCharacter(content, action.c)!;
      // "show" is not a question: it opens the skill card through INSPECT.
      if (action.q === 'show' || !c.asks.some((a) => a.id === action.q))
        return no(state, 'unknown-question');
      const already = state.asked[c.id] ?? [];
      if (already.includes(action.q)) return no(state, 'already-asked');
      return ok({
        ...state,
        asked: { ...state.asked, [c.id]: [...already, action.q] },
        log: append(state, { t: 'asked', c: c.id, q: action.q, at: action.at }),
      });
    }

    case 'INSPECT': {
      if (state.phase !== 'dialogue') return no(state, 'wrong-phase');
      const c = findCharacter(content, state.activeCharacter!)!;
      if (c.skillId !== action.s) return no(state, 'wrong-skill');
      const first = !state.inspected.includes(action.s);
      return ok({
        ...state,
        phase: 'inspect',
        inspected: first ? [...state.inspected, action.s] : state.inspected,
        log: first ? append(state, { t: 'inspected', s: action.s, at: action.at }) : state.log,
      });
    }

    case 'VERDICT': {
      /*
       * A verdict normally follows an inspection, because 'inspect' is only reachable through
       * INSPECT. It can also be given in the conversation itself, on the offerer's word, but then
       * ONLY `allow`: restricting or rejecting means naming what to strip, and from here nothing
       * has been named. You cannot scope what you have not read.
       *
       * This is the only path by which a skill starts running with nobody having read what it
       * asks for, which is how permission is usually granted outside a game. Until it existed the
       * reducer made the research's actual failure mode impossible to perform.
       */
      if (state.phase === 'dialogue' && action.v !== 'allow')
        return no(state, 'must-open-the-card');
      if (state.phase !== 'dialogue' && state.phase !== 'inspect') return no(state, 'wrong-phase');
      const c = findCharacter(content, state.activeCharacter!)!;
      if (c.skillId !== action.s) return no(state, 'wrong-skill');
      const outcome = findSkill(content, action.s)!.outcomes[action.v];
      const { basket, flags } = applyOutcome(state.basket, state.flags, outcome);
      return ok({
        ...state,
        phase: 'explore',
        activeCharacter: null,
        verdicts: { ...state.verdicts, [action.s]: action.v },
        basket,
        flags,
        log: append(state, { t: 'verdict', s: action.s, v: action.v, at: action.at }),
      });
    }

    case 'READ_NOTICE': {
      if (state.phase !== 'explore') return no(state, 'wrong-phase');
      const notice = findNotice(content, action.n);
      if (!notice) return no(state, 'unknown-notice');
      if (state.read.includes(notice.id)) return no(state, 'already-read');
      // The words on the post are the same either way. What changes is whether anything is
      // standing there able to read them, carry what you hold, and send word out.
      // A notice with no hidden instruction is just a sign: nothing to act on, whoever is reading.
      const exposed = trifectaLive(state.verdicts, content) ? notice.whenExposed : undefined;
      const { basket, flags } = exposed
        ? applyOutcome(state.basket, state.flags, {
            ...exposed,
            points: 0,
            grants: [],
            basketAdds: [],
          })
        : { basket: state.basket, flags: state.flags };
      return ok({
        ...state,
        read: [...state.read, notice.id],
        basket,
        flags,
        log: append(state, { t: 'read', n: notice.id, at: action.at }),
      });
    }

    case 'BACK':
      if (state.phase === 'inspect') return ok({ ...state, phase: 'dialogue' });
      if (state.phase === 'dialogue')
        return ok({ ...state, phase: 'explore', activeCharacter: null });
      return no(state, 'wrong-phase');

    case 'ENTER_COTTAGE':
      if (state.phase !== 'explore') return no(state, 'wrong-phase');
      if (!canEnterCottage(state, content)) return no(state, 'cottage-locked');
      return ok({
        ...state,
        phase: 'cottage',
        log: append(state, { t: 'arrived', at: action.at }),
      });

    case 'FINISH':
      if (state.phase !== 'cottage') return no(state, 'wrong-phase');
      return ok({ ...state, phase: 'results', finishedAt: action.at });

    case 'LEADERBOARD':
      return state.phase === 'results'
        ? ok({ ...state, phase: 'leaderboard' })
        : no(state, 'wrong-phase');

    case 'RESET':
      return ok(createState(content));
  }
}

/** Store-friendly form: illegal actions leave the state untouched. */
export const reduce = (state: GameState, action: Action, content: Content): GameState =>
  tryReduce(state, action, content).state;
