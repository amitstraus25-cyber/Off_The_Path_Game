import { createState, tryReduce, v2 } from '@otp/core';
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

/** A v2 action with its timestamp optional; the store stamps it from the run clock. */
export type V2Dispatchable = v2.Action extends infer A
  ? A extends { at: number }
    ? Omit<A, 'at'> & { at?: number }
    : A
  : never;

export interface V2Store {
  getState(): v2.State;
  /** Dispatches an action, stamping it with the run clock. Returns the rejection reason, or null. */
  dispatch(action: V2Dispatchable): v2.RejectReason | null;
  subscribe(listener: (state: v2.State) => void): () => void;
  /** Milliseconds since BEGIN on the injected clock; 0 before the run starts. */
  elapsed(): number;
  readonly content: v2.Content;
}

/**
 * v2's store (Phase C, behind the dev/e2e switch until Phase D). The same shape as v1's, with two
 * differences the v2 reducer asks for.
 *
 * THE CLOCK IS THE RUN'S, NOT THE PAGE'S. v2 stamps every action with ELAPSED milliseconds since
 * BEGIN (v2/state.ts), so the store remembers the clock reading at the BEGIN it applied and
 * subtracts it. The clock itself is injected, which is where an e2e build's override lives
 * (main.ts): core keeps one limit and the test moves the clock, never the limit.
 *
 * THE DEAL IS THE CALLER'S. Core has no randomness (golden rule 2): the seed that picks this run's
 * three good skills is drawn by the wiring (world/v2-wiring.tsx) and handed in here for the first
 * run and on every RESET after it.
 *
 * A REFUSAL CAN MOVE THE STATE. An action stamped at or after the limit is refused as
 * `out-of-time` and hands back the LATE state, because the clock that refused it has ended the run
 * (v2/reducer.ts). So the store keeps whatever state comes back, refused or not, and notifies when
 * it changed.
 */
export function createV2Store(content: v2.Content, clock: Clock, seed: number): V2Store {
  // The first run's deal. Every later one comes in on RESET, with a seed the caller drew.
  let state = v2.createState(content, seed);
  let begunAt: number | null = null;
  const listeners = new Set<(state: v2.State) => void>();
  const elapsed = (): number => (begunAt === null ? 0 : Math.max(0, clock() - begunAt));
  return {
    content,
    getState: () => state,
    elapsed,
    dispatch(action) {
      const before = clock();
      const stamped = { at: Math.round(elapsed()), ...action } as v2.Action;
      const result = v2.tryReduce(state, stamped, content);
      if (action.type === 'BEGIN' && result.ok) begunAt = before;
      if (action.type === 'RESET' && result.ok) begunAt = null;
      if (result.state !== state) {
        state = result.state;
        for (const l of listeners) l(state);
      }
      return result.ok ? null : result.reason;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
