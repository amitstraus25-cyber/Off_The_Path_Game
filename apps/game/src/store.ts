import { createState, tryReduce } from '@otp/core';
import type { Action, Content, GameState, RejectReason } from '@otp/core';

export type Listener = (state: GameState) => void;
/** Returns milliseconds since the page loaded; the only clock the game uses. */
export type Clock = () => number;

/** An action with its timestamp optional; the store stamps it from the clock. */
export type Dispatchable = Action extends infer A
  ? A extends { at: number }
    ? Omit<A, 'at'> & { at?: number }
    : A
  : never;

export interface Store {
  getState(): GameState;
  /** Dispatches an action, stamping it with the clock. Returns the rejection reason, or null. */
  dispatch(action: Dispatchable): RejectReason | null;
  subscribe(listener: Listener): () => void;
  readonly content: Content;
}

export function createStore(content: Content, clock: Clock): Store {
  let state = createState(content);
  const listeners = new Set<Listener>();
  return {
    content,
    getState: () => state,
    dispatch(action) {
      const stamped = { at: Math.round(clock()), ...action } as Action;
      const result = tryReduce(state, stamped, content);
      if (!result.ok) return result.reason;
      if (result.state === state) return null;
      state = result.state;
      for (const l of listeners) l(state);
      return null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
