import type { CharacterId, Content, EffectKind, Skill } from './content.ts';
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
 * WHERE A WING RIDE LANDS: the next character in walking order (content order) after the one who
 * gave it that has not been met, wrapping round to the start; null if everybody has been met. Never
 * the cottage -- the door is not a character -- which is the client's rule for every perk. A giver
 * the content does not have (only a forged log can name one) is read as standing before the first.
 */
export function wingRideTarget(
  content: Content,
  met: readonly CharacterId[],
  giver: CharacterId | undefined,
): CharacterId | null {
  const order = content.characters.map((c) => c.id);
  const from = giver === undefined ? -1 : order.indexOf(giver);
  for (let k = 1; k <= order.length; k++) {
    const c = order[(from + k) % order.length]!;
    if (!met.includes(c)) return c;
  }
  return null;
}

/**
 * The perk a take of `skill`, from `giver`, records at real elapsed `at`. A rewind gives back its
 * `ms` or as much of the run clock as there is, whichever is less, so the clock never runs below
 * zero and the HUD never shows more than the limit.
 */
export function perkFor(
  state: Pick<State, 'perks' | 'met'>,
  content: Content,
  skill: Skill,
  giver: CharacterId,
  at: number,
): Perk {
  const e = skill.effect;
  const base = { s: skill.id, at };
  if (e.kind === 'wing-ride')
    return { ...base, ...e, to: wingRideTarget(content, state.met, giver) };
  if (e.kind === 'rewind') return { ...base, ...e, ms: Math.min(e.ms, clockMs(state, at)) };
  return { ...base, ...e };
}
