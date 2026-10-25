/*
 * The game's rules, exported from core as the `v2` namespace (src/index.ts). The number is the
 * rules version every run log and content file is tagged with (`rules: 3` since the Gatekeeper
 * and the river, 2026-10-25), so a file written for any other rulebook is refused by the schema.
 */
export * from './content.ts';
export * from './deal.ts';
export * from './state.ts';
export * from './reducer.ts';
export * from './scoring.ts';
export * from './runlog.ts';
export * from './sim.ts';
export * from './load.ts';
export * from './floor.ts';
export * from './perks.ts';
export * from './board.ts';
export * from './contact.ts';
