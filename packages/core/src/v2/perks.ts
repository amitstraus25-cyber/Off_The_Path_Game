import type { Content, EffectKind, Skill } from './content.ts';
import { TIME_LIMIT_MS } from './state.ts';
import type { Perk, State } from './state.ts';

/*
 * THE PERKS, READ (the client, 2026-10-22). A taken skill's `effect` is recorded on the state by
 * the reducer (`perkFor`, at the verdict) and read through the functions below by everyone who
 * needs it: the reducer for the deadline, the score for the time it counts, the walk floor and the
 * simulator for the time a perk saves, and the game for what to draw. One reading, so the browser,
 * the server and the forest cannot disagree about what a perk did.
 *
 * TWO CLOCKS, AND WHICH IS WHICH. Every stamp (`at`, and `state.now`) is REAL elapsed time since
 * BEGIN: the server bounds it against its own clock, so it may never be adjusted. The RUN clock is
 * that less whatever a rewind gave back (`clockMs`), and it is what the HUD shows, what the speed
 * bonus counts and what the dusk follows. Without a rewind the two are the same number.
 */

type Perks = Pick<State, 'perks'>;

/** Whether the run has a perk of this kind. */
export const hasPerk = (state: Perks, kind: EffectKind): boolean =>
  state.perks.some((p) => p.kind === kind);

/** Everything the run's rewinds have given back, in ms. 0 without one. */
export const rewoundMs = (state: Perks): number =>
  state.perks.reduce((n, p) => n + (p.kind === 'rewind' ? p.ms : 0), 0);

/** The REAL elapsed time at which this run is out of time: the limit plus what was given back. */
export const deadlineMs = (state: Perks): number => TIME_LIMIT_MS + rewoundMs(state);

/** The run clock at real elapsed `at`: what the HUD's elapsed and the speed bonus count. */
export const clockMs = (state: Perks, at: number): number => Math.max(0, at - rewoundMs(state));

/** Time left on the HUD at real elapsed `at`, never below zero. */
export const timeLeftMs = (state: Perks, at: number): number => Math.max(0, deadlineMs(state) - at);

/** How much faster than `WALK_SPEED` Purple walks: every `walk-faster` perk's factor, multiplied. */
export const walkFactor = (state: Perks): number =>
  state.perks.reduce((f, p) => f * (p.kind === 'walk-faster' ? p.factor : 1), 1);

/**
 * HOW DARK THE FOREST IS with `leftMs` on the clock: 0 until `world.dusk.fromLeftMs`, then a
 * straight line to `world.dusk.darkest` at time up, and never darker. For everyone; the lantern
 * perk lights a circle around Purple and changes nothing here. The game turns this share into a
 * tint; the cap is the content's, so the path and the cast always stay readable.
 */
export function duskLevel(content: Content, leftMs: number): number {
  const { fromLeftMs, darkest } = content.world.dusk;
  if (leftMs >= fromLeftMs) return 0;
  return darkest * (1 - Math.max(0, leftMs) / fromLeftMs);
}

/** The dusk at real elapsed `at` in this run: a rewind adds time left, so it pushes dusk back. */
export const duskAt = (content: Content, state: Perks, at: number): number =>
  duskLevel(content, timeLeftMs(state, at));

/**
 * WHETHER PURPLE IS OVER THE RIVER (rules 3, docs/GATEKEEPER.md): the run took a skill whose
 * effect is one of `world.crossing`'s kinds -- the Bridge Key's open gate, or the Wing Ride's
 * flight to the far bank. Content without a river is always across. The reducer refuses the
 * arrival of a run that is not, so a log that reached the door without crossing is not a run.
 */
export function across(content: Content, state: Perks): boolean {
  const crossing = content.world.crossing;
  return crossing === undefined || state.perks.some((p) => crossing.includes(p.kind));
}

/**
 * The perk a take of `skill` records at real elapsed `at`. A rewind gives back its `ms` or as much
 * of the run clock as there is, whichever is less, so the clock never runs below zero and the HUD
 * never shows more than the limit.
 *
 * A WING RIDE CARRIES ITS EFFECT AS IT IS: `lands`, the map point it flies to. Until rules 3 it
 * also carried `to`, the next unmet character it landed beside (`wingRideTarget`, now gone), and
 * a null `to` when nobody was left. The flight now always lands on the far bank, so there is no
 * nobody-left case and nothing to decide at the take.
 */
export function perkFor(state: Pick<State, 'perks'>, skill: Skill, at: number): Perk {
  const e = skill.effect;
  const base = { s: skill.id, at };
  if (e.kind === 'rewind') return { ...base, ...e, ms: Math.min(e.ms, clockMs(state, at)) };
  return { ...base, ...e };
}
