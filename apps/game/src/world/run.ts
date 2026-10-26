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
   * The wolf is in Grandma's chair for this arrival, his shape in the lit window. The wolf's ending
   * and nothing else: never during the walk (the scene only asks at the door), never on Grandma's
   * ending, never on the late one, which does not reach the door at all.
   */
  wolfInside(): boolean;
  /**
   * Who a map spawn is: a member of the cast who offers a skill, a bystander who only says a line,
   * or nobody (left off the map). `id` is what interacting emits.
   */
  castOf(spawnName: string): { kind: 'character' | 'bystander'; id: string } | null;
  /** Whether this character still talks: false once their offer has a verdict. */
  stillOffering(characterId: string): boolean;
  /**
   * Whether the player has met this character this run: true from the MEET on, whatever the
   * verdict, and false again on a replay. The ground glow and the "!" over a character's head
   * stand for exactly as long as this is false (forest-scene.ts `drawBeckons`). Not
   * `stillOffering`: a player who meets someone and walks on without answering HAS found them,
   * and finding them is all the beckon is for.
   */
  met(characterId: string): boolean;
  /**
   * Who the run is talking to right now, or null. The scene hops that character once when this
   * changes to them, whatever sent the MEET -- a press of A, a wing ride landing, or a spec.
   */
  talkingTo(): string | null;
  /**
   * THE PERKS, as the forest draws them (core v2 perks.ts, read through `hasPerk` and friends and
   * never by skill id): how much faster Purple walks, whether the fork signs and the lantern are
   * out, whether the Gatekeeper's key has opened the bridge gate, and how dark the dusk is right now
   * (0 until 2:00 left, never past the content's cap).
   */
  walkFactor(): number;
  /** The run took Bridge Key (`bridge-gate`): the gate on the bridge stands open. */
  gateOpen(): boolean;
  lantern(): boolean;
  /** Word went ahead (`early-welcome`): Grandma's door stands open as Purple comes up the lane. */
  welcome(): boolean;
  dusk(): number;
  /** The darkest the dusk ever gets (the content's cap), so the lantern can scale against it. */
  darkest(): number;
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
    // The same fact as the trail, asked separately so the two can be told apart if content ever
    // splits them: who is inside is the ending's, and core says which ending this is.
    wolfInside: () => v2.ending(store.getState(), content) === 'wolf',
    // The cast is read from content, not from the spawn's prefix: the map's bystanders offer here.
    castOf: (spawnName) => {
      const c = content.characters.find((x) => x.spawn === spawnName);
      return c ? { kind: 'character', id: c.id } : null;
    },
    stillOffering: (characterId) => {
      const c = v2.findCharacter(content, characterId);
      return c !== undefined && store.getState().verdicts[c.skillId] === undefined;
    },
    met: (characterId) => store.getState().met.includes(characterId),
    talkingTo: () => store.getState().active,
    walkFactor: () => v2.walkFactor(store.getState()),
    // The effect kind is the contract's (docs/GATEKEEPER.md); cast so this reads on a core that
    // has the kind and still compiles on one that has not merged it yet.
    gateOpen: () => v2.hasPerk(store.getState(), 'bridge-gate' as v2.EffectKind),
    lantern: () => v2.hasPerk(store.getState(), 'lantern'),
    welcome: () => v2.hasPerk(store.getState(), 'early-welcome'),
    dusk: () => {
      const state = store.getState();
      return v2.duskAt(content, state, runAt(state, store.elapsed()));
    },
    darkest: () => content.world.dusk.darkest,
  };
}

/**
 * The run's REAL elapsed time for the screens: the live clock while the run runs, frozen where it
 * stopped otherwise. Real, not the rewound run clock: core's `timeLeftMs` and `duskAt` take the real
 * stamp and subtract what a rewind gave back themselves (perks.ts, "two clocks").
 */
export const runAt = (state: v2.State, elapsed: number): number =>
  v2.RUNNING.has(state.phase) ? elapsed : state.now;

/**
 * Back to the forest from an open offer, whichever of its two phases the reducer is in: BACK takes
 * `card` to `talk` and `talk` to the forest. Walk on and "No thanks" leave the offer altogether,
 * from the card or the conversation, rather than stepping back one panel. Esc lands here too
 * (main.ts, ui/App.tsx).
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

/**
 * Time left on the HUD: the live clock while the run runs, frozen where it stopped otherwise.
 *
 * Against the run's own DEADLINE (core `timeLeftMs`), not the bare three minutes: a Long Evening
 * moves the deadline 20 s later, and a HUD that kept reading `TIME_LIMIT_MS` showed 0:00 for the
 * whole of the time it gave back while the run was still alive.
 */
export function remainingMs(state: v2.State, elapsed: number): number {
  return v2.timeLeftMs(state, runAt(state, elapsed));
}

/** Whether the run's clock has reached its deadline: the hard stop main.ts sends TIME_UP on. */
export const outOfTime = (state: v2.State, elapsed: number): boolean =>
  v2.RUNNING.has(state.phase) && elapsed >= v2.deadlineMs(state);

/** A seed for a run the server did not start: the browser's CSPRNG, as core asks (deal.ts). */
export const localSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;

/*
 * THE RIVER'S NOTICES (Paul's review of the Gatekeeper, 2026-10-26). Read off effect KINDS, never
 * off a skill id, like the perks: the drawbridge is whichever skill has the `bridge-gate` effect,
 * and the ways over are content's `world.crossing`.
 */

/** The skills whose effect is one of these kinds. */
const skillsOfKind = (content: v2.Content, kinds: readonly string[]): v2.Skill[] =>
  content.skills.filter((s) => kinds.includes(s.effect.kind));

/**
 * What the raised drawbridge says to a bump (`chrome.gateLocked`): that the Gatekeeper has the key
 * -- until the run has LEFT the key, when it says what leaving it meant (`chrome.gateLockedLeft`)
 * and points at the other way over, not at a Gatekeeper the player already turned down.
 */
export function gateNotice(state: v2.State, content: v2.Content): 'gateLocked' | 'gateLockedLeft' {
  const left = skillsOfKind(content, ['bridge-gate']).some((s) => state.verdicts[s.id] === 'leave');
  return left ? 'gateLockedLeft' : 'gateLocked';
}

/**
 * Whether this run has LEFT every way over the river (content `world.crossing`): with none taken
 * and none still to answer, Purple cannot reach the door, and main.ts says so once
 * (`chrome.noWayOver`). False for content without a river, and false again on a replay, because a
 * RESET empties the verdicts. Changes no rule and no score: the clock still ends the run late.
 */
export function stranded(state: v2.State, content: v2.Content): boolean {
  const ways = skillsOfKind(content, content.world.crossing ?? []);
  return ways.length > 0 && ways.every((s) => state.verdicts[s.id] === 'leave');
}
