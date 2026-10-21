import { v2 } from '@otp/core';

/** Returns milliseconds since the page loaded; the only clock the game uses. */
export type Clock = () => number;

/** An action with its timestamp optional; the store stamps it from the run clock. */
export type Dispatchable = v2.Action extends infer A
  ? A extends { at: number }
    ? Omit<A, 'at'> & { at?: number }
    : A
  : never;

export interface Store {
  getState(): v2.State;
  /** Dispatches an action, stamping it with the run clock. Returns the rejection reason, or null. */
  dispatch(action: Dispatchable): v2.RejectReason | null;
  subscribe(listener: (state: v2.State) => void): () => void;
  /** Milliseconds since BEGIN on the injected clock; 0 before the run starts. */
  elapsed(): number;
  readonly content: v2.Content;
}

/**
 * The game's store, over core's v2 reducer.
 *
 * THE CLOCK IS THE RUN'S, NOT THE PAGE'S. v2 stamps every action with ELAPSED milliseconds since
 * BEGIN (v2/state.ts), so the store remembers the clock reading at the BEGIN it applied and
 * subtracts it. The clock itself is injected, which is where an e2e build's override lives
 * (main.ts): core keeps one limit and the test moves the clock, never the limit.
 *
 * THE DEAL IS THE CALLER'S. Core has no randomness (golden rule 2): the seed that picks this run's
 * three good skills comes from the server's `POST /api/start`, or from `crypto.getRandomValues`
 * when the board is unavailable (main.ts), and is handed in here for the first run and on every
 * RESET after it.
 *
 * A REFUSAL CAN MOVE THE STATE. An action stamped at or after the limit is refused as
 * `out-of-time` and hands back the LATE state, because the clock that refused it has ended the run
 * (v2/reducer.ts). So the store keeps whatever state comes back, refused or not, and notifies when
 * it changed.
 */
export function createStore(content: v2.Content, clock: Clock, seed: number): Store {
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
