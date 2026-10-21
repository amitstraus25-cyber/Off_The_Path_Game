import { ending } from '@otp/core';
import type { Phase } from '@otp/core';
import type { Store } from '../store';

/**
 * WHAT THE FOREST NEEDS TO KNOW ABOUT A RUN, AND NOTHING ELSE.
 *
 * The scene read the v1 store directly -- its phase names, its verdict map, its `ending()` -- so it
 * could only ever host v1. v2 Phase C walks the same forest with a different rulebook, and until
 * Phase D switches the game both have to run on the one scene. This is the whole of what the scene
 * asks of either: whether Purple may walk, whether the run has reached the door, whether the
 * wolf's prints belong there, and who in the cast still has something to say. Each rulebook
 * answers it from its own store; `v1Run` below is the live one, `v2Run` in `v2-wiring.ts` the one
 * behind the dev/e2e switch.
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
   * Who a map spawn is, for this rulebook: a member of the cast who offers a skill, a bystander
   * who only says a line, or nobody (left off the map). `id` is what interacting emits.
   */
  castOf(spawnName: string): { kind: 'character' | 'bystander'; id: string } | null;
  /** Whether this character still talks: false once their offer has a verdict. */
  stillOffering(characterId: string): boolean;
}

/**
 * The phases that happen at the cottage. From the first arrival beat to the end of the run the
 * camera belongs to the door, not to Purple, so Results does not pan the forest back behind itself.
 */
const AT_THE_COTTAGE: readonly Phase[] = ['cottage', 'results', 'leaderboard'];

/** The live game: v1's store, read exactly as the scene read it before this adapter existed. */
export function v1Run(store: Store): WorldRun {
  return {
    state: () => store.getState(),
    exploring: () => store.getState().phase === 'explore',
    atCottage: () => AT_THE_COTTAGE.includes(store.getState().phase),
    pawsEarned: () =>
      (store.content.strings['arrivePawEndings'] ?? '')
        .split('|')
        .includes(ending(store.getState(), store.content).id),
    castOf: (spawnName) => {
      if (spawnName.startsWith('npc-'))
        return { kind: 'character', id: spawnName.slice('npc-'.length) };
      if (spawnName.startsWith('bystander-'))
        return { kind: 'bystander', id: spawnName.slice('bystander-'.length) };
      return null;
    },
    stillOffering: (characterId) => {
      const character = store.content.characters.find((c) => c.id === characterId);
      return character !== undefined && store.getState().verdicts[character.skillId] === undefined;
    },
  };
}
