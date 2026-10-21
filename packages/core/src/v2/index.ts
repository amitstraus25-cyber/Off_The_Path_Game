/*
 * v2's rules, built beside v1 and exported from core as the `v2` namespace (src/index.ts), so that
 * every bare name production imports today -- `reduce`, `score`, `checkLog` -- still means v1.
 * Phase D switches the game over; until then nothing outside this directory changes behaviour.
 */
export * from './content.ts';
export * from './state.ts';
export * from './reducer.ts';
export * from './scoring.ts';
export * from './runlog.ts';
export * from './sim.ts';
export * from './load.ts';
