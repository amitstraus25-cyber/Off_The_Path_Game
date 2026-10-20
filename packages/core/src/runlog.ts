import './zod-config.ts';
import { z } from 'zod';
import { findCharacterForSkill } from './content.ts';
import type { Content } from './content.ts';
import { tryReduce } from './reducer.ts';
import { createState, runEventSchema } from './state.ts';
import type { Action, GameState, RunEvent } from './state.ts';

export type LogCheck =
  { legal: true; complete: boolean; state: GameState } | { legal: false; reason: string };

const sameEvent = (a: RunEvent, b: RunEvent): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Replays a run log through the reducer. The log is legal when every event is accepted in order
 * and the replay produces exactly the same log (nothing dropped, nothing invented).
 * Navigation between events (closing panels, walking back to a character) is not logged, so the
 * replay inserts BACK and MEET steps itself; MEET for a never-met character would add a "met" event
 * and is therefore caught by the equality check.
 */
export function checkLog(raw: unknown, content: Content, startedAt = 0): LogCheck {
  const parsed = z.array(runEventSchema).safeParse(raw);
  if (!parsed.success) return { legal: false, reason: 'malformed log' };

  let state = createState(content);
  const run = (action: Action): string | null => {
    const r = tryReduce(state, action, content);
    state = r.state;
    return r.ok ? null : r.reason;
  };
  const closePanels = (): void => {
    while (state.phase === 'dialogue' || state.phase === 'inspect') run({ type: 'BACK' });
  };
  const focus = (c: string, at: number): string | null => {
    if (state.phase === 'inspect' && state.activeCharacter === c) return run({ type: 'BACK' });
    if (state.phase === 'dialogue' && state.activeCharacter === c) return null;
    closePanels();
    return run({ type: 'MEET', c, at });
  };

  // A fresh state always accepts these two, so their results are not checked.
  run({ type: 'START', runId: 'replay', at: startedAt });
  run({ type: 'BEGIN' });

  for (const [i, e] of parsed.data.entries()) {
    let reason: string | null;
    switch (e.t) {
      case 'met':
        closePanels();
        reason = run({ type: 'MEET', c: e.c, at: e.at });
        break;
      case 'asked':
        reason = focus(e.c, e.at) ?? run({ type: 'ASK', c: e.c, q: e.q, at: e.at });
        break;
      case 'inspected': {
        const c = findCharacterForSkill(content, e.s);
        reason = c
          ? (focus(c.id, e.at) ?? run({ type: 'INSPECT', s: e.s, at: e.at }))
          : 'unknown-skill';
        break;
      }
      case 'verdict': {
        const c = findCharacterForSkill(content, e.s);
        if (!c) {
          reason = 'unknown-skill';
          break;
        }
        /*
         * A verdict the log never opened a card for must replay WITHOUT opening one. Inserting an
         * INSPECT here would append an `inspected` event the submitted log does not have, and the
         * replay check below would then reject an honest run as forged.
         *
         * This is also what makes the rule self-enforcing on the server. Only `allow` is legal
         * from the conversation, so a submitted log claiming an unread `restrict` replays into
         * `dialogue` and fails with `must-open-the-card`. A client cannot award itself the points
         * for a careful verdict it never made.
         */
        const onCard = state.phase === 'inspect' && state.activeCharacter === c.id;
        const everOpened = state.inspected.includes(e.s);
        reason = onCard
          ? null
          : everOpened
            ? (focus(c.id, e.at) ?? run({ type: 'INSPECT', s: e.s, at: e.at }))
            : focus(c.id, e.at);
        reason ??= run({ type: 'VERDICT', s: e.s, v: e.v, at: e.at });
        break;
      }
      case 'read':
        closePanels();
        reason = run({ type: 'READ_NOTICE', n: e.n, at: e.at });
        break;
      case 'arrived':
        closePanels();
        reason = run({ type: 'ENTER_COTTAGE', at: e.at });
        break;
    }
    if (reason) return { legal: false, reason: `event ${i}: ${reason}` };
    if (state.log.length !== i + 1 || !sameEvent(state.log[i]!, e))
      return { legal: false, reason: `event ${i}: log does not replay exactly` };
  }
  return { legal: true, complete: state.phase === 'cottage', state };
}

export const isLegalLog = (raw: unknown, content: Content, startedAt = 0): boolean =>
  checkLog(raw, content, startedAt).legal;

/** Milliseconds from the run start to arrival, or null if the log has not arrived yet. */
export function durationMs(log: readonly RunEvent[], startedAt: number): number | null {
  const arrived = log.find((e) => e.t === 'arrived');
  return arrived ? arrived.at - startedAt : null;
}
