import manifest from '../../../../apps/game/src/assets/manifest.json';
import mapJson from '../../../../apps/game/src/assets/map-forest.json';
import { findObject, readForestMap } from '../../../../apps/game/src/world/map.ts';

/*
 * RULES 3 IS AHEAD OF THE MAP, FOR ONE MERGE (2026-10-25, docs/GATEKEEPER.md).
 *
 * The content names objects the map-and-art builder is drawing in another worktree, in parallel:
 * the Gatekeeper's spawn and sprite `npc-gatekeeper`, and the far bank's `wing-landing`. Until that
 * work is merged, the shipped map and manifest these suites read do not have them, and the guards
 * that walk the real map -- the walk floor's cache, the cast's sprites and spawns, the clock and
 * par -- cannot be measured honestly. Any number they printed would be a number about a map that
 * is about to stop existing.
 *
 * So the names are listed here, and every guard that needs the new map is SKIPPED while this list
 * is not empty -- skipped, so the suite says so on every run, never passed. It is a RATCHET, the
 * same shape as real-content.test.ts's AWAITING_ART: `the objects awaiting the map are still
 * missing` fails the moment any of them appears, until its name comes off this list, and an empty
 * list turns every skipped guard back on. Expect them to fail then until `WALK_WORLD` (floor.ts) is
 * derived again from the new map and `scoring.parMs` is checked against the new tour.
 */
export const AWAITING_MAP: readonly string[] = ['npc-gatekeeper', 'wing-landing'];

/** Whether a name is on the shipped map (as an object) or in the manifest (as a spritesheet). */
export function onTheMap(name: string): boolean {
  const map = readForestMap(mapJson);
  return findObject(map, name) !== undefined || manifest.spritesheets.some((s) => s.key === name);
}

/** True while the guards that walk the real map have to wait for it. */
export const mapPending = AWAITING_MAP.length > 0;
