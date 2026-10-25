/** Hand-written typed event bus (~20 lines) so the world and the UI never import each other. */
export interface GameEvents {
  /** The player pressed A next to a character. */
  interact: { characterId: string };
  /** The player stepped on the cottage trigger. */
  enteredCottage: void;
  /** The player talked to someone who offers nothing. Changes no game state. */
  greetBystander: { bystanderId: string };
  /** The player walked up to a notice post. */
  reachedNotice: { noticeId: string };
  /** A replay began: the world must put Purple back at the spawn. */
  restartRun: void;
  /** Purple walked into the shut bridge gate: say the Gatekeeper has the key (once per bump). */
  gateLocked: void;
  /** The cottage is still locked; show the hint line. */
  cottageLocked: void;
  /** Phaser finished booting the forest. */
  worldReady: void;
  /**
   * One or more assets would not load, so the forest was NOT built. The keys are Phaser's own
   * (`map-forest`, `npc-owl`), for the inspector and the specs; the UI never prints them.
   */
  loadFailed: { keys: readonly string[] };
}

type Handler<T> = (payload: T) => void;

export function createBus() {
  const handlers = new Map<keyof GameEvents, Set<Handler<never>>>();
  return {
    on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
      const set = handlers.get(event) ?? new Set();
      handlers.set(event, set);
      set.add(handler as Handler<never>);
      return () => void set.delete(handler as Handler<never>);
    },
    emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
      for (const h of handlers.get(event) ?? []) (h as Handler<GameEvents[K]>)(payload);
    },
  };
}

export type Bus = ReturnType<typeof createBus>;
