import { v2 } from '@otp/core';
import type { Store } from '../store';
import type { HudBasketItem } from '../ui/Hud';

/**
 * WHAT THE FOREST NEEDS TO KNOW ABOUT A RUN, AND NOTHING ELSE.
 *
 * The scene asks this and never reads the store directly: whether Purple may walk, whether the run
 * has reached the door, whether the wolf's prints belong there, and who in the cast still has
 * something to say. `gameRun` below answers it from the store.
 */
export interface WorldRun {
  /**
   * The run's current state object. The scene only compares it by identity: a trigger re-arms
   * when it changes (see `triggered` in forest-scene.ts), so it must change on every dispatch that
   * moved the run and on no other.
   */
  state(): unknown;
  /** The run is in its walking phase. Purple moves and the cast can be talked to only then. */
  exploring(): boolean;
  /** The run has reached the cottage. The arrival is staged once, on the first frame this is true. */
  atCottage(): boolean;
  /** The wolf's prints show on the doorstep for this arrival. */
  pawsEarned(): boolean;
  /**
   * Who a map spawn is: a member of the cast who offers a skill, a bystander who only says a line,
   * or nobody (left off the map). `id` is what interacting emits.
   */
  castOf(spawnName: string): { kind: 'character' | 'bystander'; id: string } | null;
  /** Whether this character still talks: false once their offer has a verdict. */
  stillOffering(characterId: string): boolean;
}

/** The forest's questions, answered from the store. */
export function gameRun(store: Store): WorldRun {
  const { content } = store;
  return {
    state: () => store.getState(),
    exploring: () => store.getState().phase === 'forest',
    atCottage: () => store.getState().phase === 'cottage',
    // Something came up this path ahead of you exactly when the run reached the wolf's ending:
    // a skill dealt bad THIS run was taken. Read from core, never from the skill's own data.
    pawsEarned: () => v2.ending(store.getState(), content) === 'wolf',
    // The cast is read from content, not from the spawn's prefix: the map's bystanders offer here.
    castOf: (spawnName) => {
      const c = content.characters.find((x) => x.spawn === spawnName);
      return c ? { kind: 'character', id: c.id } : null;
    },
    stillOffering: (characterId) => {
      const c = v2.findCharacter(content, characterId);
      return c !== undefined && store.getState().verdicts[c.skillId] === undefined;
    },
  };
}

/**
 * THE CARD OPENS BY ITSELF (the client, 2026-10-22). The skill whose card a run is owed, or null.
 *
 * Owed exactly when the run has just stepped from the forest into a conversation: a MEET, from
 * whatever sent it. Not when it arrives in `talk` from the card, which is BACK on its way out
 * (`walkOn` below) and must be let through, or Walk on could never leave. main.ts dispatches the
 * INSPECT, which is what logs the card as read -- so the reveal's `read` is true because the card
 * was on screen, not because the panel that showed it said so.
 */
export function cardOwed(before: v2.Phase, state: v2.State, content: v2.Content): string | null {
  if (before !== 'forest' || state.phase !== 'talk' || state.active === null) return null;
  return v2.findCharacter(content, state.active)?.skillId ?? null;
}

/**
 * Back to the forest from an open offer, whichever of its two phases the reducer is in: BACK takes
 * `card` to `talk` and `talk` to the forest, and since the card opens by itself there is no
 * conversation without it to go back to. Esc and Walk on both land here (main.ts, ui/App.tsx).
 */
export function walkOn(store: Pick<Store, 'getState' | 'dispatch'>): void {
  for (let step = 0; step < 2; step++) {
    const { phase } = store.getState();
    if (phase !== 'card' && phase !== 'talk') return;
    store.dispatch({ type: 'BACK' });
  }
}

/** What the HUD's basket shows: each skill taken, in the order it was taken. */
export function hudBasket(state: v2.State, content: v2.Content): HudBasketItem[] {
  return state.basket.map((e) => {
    const skill = v2.findSkill(content, e.s);
    return { skillId: e.s, name: skill?.name ?? e.s, icon: skill?.icon ?? null };
  });
}

/** Time left on the HUD: the live clock while the run runs, frozen where it stopped otherwise. */
export function remainingMs(state: v2.State, elapsed: number): number {
  const at = v2.RUNNING.has(state.phase) ? elapsed : state.now;
  return Math.max(0, v2.TIME_LIMIT_MS - at);
}

/** A seed for a run the server did not start: the browser's CSPRNG, as core asks (deal.ts). */
export const localSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;
