import { describe, expect, it } from 'vitest';
import raw from '../../../../content/game.v2.json';
import mapJson from '../../../../apps/game/src/assets/map-forest.json';
import { findObject, readForestMap } from '../../../../apps/game/src/world/map.ts';
import type { MapObject } from '../../../../apps/game/src/world/map.ts';
import {
  INTERACT_RADIUS,
  PURPLE_FEET_BELOW_SPAWN,
  TILE,
  WALK_SPEED,
} from '../../../../apps/game/src/world/logic.ts';
import { WALK_WORLD, walkFloor } from '../../src/v2/floor.ts';
import type { WalkWorld } from '../../src/v2/floor.ts';
import { parseContent } from '../../src/v2/load.ts';
import { play } from '../../src/v2/sim.ts';
import type { RunEvent } from '../../src/v2/state.ts';
import { content as fixture } from './helpers.ts';

/*
 * THE WALK FLOOR'S NUMBERS ARE THE MAP'S, AND THE FLOOR IS A FLOOR.
 *
 * `WALK_WORLD` is a cache of the shipped map and the game's own walking constants (floor.ts says
 * why it is a cache and not an import). This derives every field of it from
 * `apps/game/src/assets/map-forest.json` and `apps/game/src/world/logic.ts` and demands equality,
 * so moving a character, the door or Purple's spawn without regenerating it fails here rather than
 * on the server, where a stale spot could refuse an honest run.
 */

const content = parseContent(raw);
const map = readForestMap(mapJson);
const need = (name: string): MapObject => {
  const o = findObject(map, name);
  if (!o) throw new Error(`map-forest.json has no "${name}"`);
  return o;
};
const centreOf = (o: MapObject) => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
/** forest-scene.ts `createCharacter`: the sprite, and the point `nearest` measures, half a tile down. */
const talkedToFrom = (o: MapObject) => ({ x: centreOf(o).x, y: centreOf(o).y + TILE / 2 });
/** forest-scene.ts `create`: Purple's feet, half a tile in and PURPLE_FEET_BELOW_SPAWN down. */
const feetAt = (o: MapObject) => ({ x: o.x + TILE / 2, y: o.y + PURPLE_FEET_BELOW_SPAWN });

describe('WALK_WORLD is the shipped map and the game’s walking constants, exactly', () => {
  it('derives every field from the map and logic.ts', () => {
    const door = need('trigger-cottage');
    const derived: WalkWorld = {
      walkSpeed: WALK_SPEED,
      // A meeting needs the talking radius and no closer; the door needs her feet inside it.
      reach: { start: 0, character: INTERACT_RADIUS, door: 0 },
      start: feetAt(need('spawn-purple')),
      door: { x: door.x, y: door.y, width: door.width, height: door.height },
      spots: Object.fromEntries(
        content.characters.map((c) => [c.spawn, talkedToFrom(need(c.spawn))]),
      ),
    };
    expect(WALK_WORLD).toEqual(derived);
  });
});

/** A met event for each character in content order, then the door, stamped as given. */
const tourLog = (stamps: number[]): RunEvent[] => [
  ...content.characters.map((c, i): RunEvent => ({ e: 'met', c: c.id, at: stamps[i]! })),
  { e: 'arrived', at: stamps[content.characters.length]! },
];

describe('the floor of a log', () => {
  it('straight to the door is the straight line from her feet to the door, at walking speed', () => {
    const s = WALK_WORLD.start;
    const d = WALK_WORLD.door;
    const px = Math.hypot(d.x - s.x, Math.max(0, d.y - s.y, s.y - (d.y + d.height)));
    const { floorMs, tooFast } = walkFloor(content, [{ e: 'arrived', at: 60_000 }]);
    expect(floorMs).toBeCloseTo((px / WALK_SPEED) * 1000, 6);
    // About eleven seconds on today's map: the old single MIN_RUN_MS was 10 s.
    expect(floorMs).toBeGreaterThan(10_000);
    expect(tooFast).toBeNull();
  });

  it('a full tour in content order costs more than the walk to the door alone', () => {
    const all = walkFloor(content, tourLog(Array(8).fill(170_000))).floorMs;
    const direct = walkFloor(content, [{ e: 'arrived', at: 170_000 }]).floorMs;
    // About 15 s against 12 s on today's map: a straight line, so a floor and not an estimate.
    expect(all).toBeGreaterThan(direct + 2_000);
  });

  it('names the first meeting or arrival stamped faster than walking there allows', () => {
    // Everybody met at once: even the first meeting is a walk.
    expect(walkFloor(content, tourLog(Array(8).fill(0))).tooFast).toBe(0);
    // The rabbit is a 1.75 s walk and the toadstool a fraction more; the owl another two seconds,
    // and all three are stamped at 2.5 s.
    const stamps = [2_500, 2_500, 2_500, 170_000, 170_000, 170_000, 170_000, 170_000];
    expect(walkFloor(content, tourLog(stamps)).tooFast).toBe(2);
    // The arrival alone too fast.
    expect(walkFloor(content, [{ e: 'arrived', at: 1_000 }]).tooFast).toBe(0);
  });

  it('only meeting and arriving move Purple: cards and verdicts cost no distance', () => {
    const c = content.characters[2]!;
    const bare: RunEvent[] = [
      { e: 'met', c: c.id, at: 100_000 },
      { e: 'arrived', at: 120_000 },
    ];
    const busy: RunEvent[] = [
      bare[0]!,
      { e: 'inspected', s: c.skillId, at: 100_001 },
      { e: 'verdict', s: c.skillId, v: 'take', at: 100_002 },
      bare[1]!,
    ];
    expect(walkFloor(content, busy)).toEqual({ ...walkFloor(content, bare), tooFast: null });
  });

  it('a character whose spawn is not on the map costs nothing, and neither does the leg after it', () => {
    // The fixture's spawns are not the shipped map's: every leg is unknown, so the floor is 0.
    const events: RunEvent[] = [
      { e: 'met', c: 'magpie', at: 0 },
      { e: 'met', c: 'nobody', at: 0 },
      { e: 'arrived', at: 0 },
    ];
    expect(walkFloor(fixture, events)).toEqual({ floorMs: 0, tooFast: null });
  });

  it('every honest simulated run on the shipped map is at or over its floor at every step', () => {
    // The api's paced runs: five seconds a walk, which the longest straight leg here is under.
    for (let seed = 0; seed < 35; seed++) {
      const p = play(content, 'careful', {
        seed,
        pace: { walkMs: 5_000, talkMs: 1_000 },
        reading: { msPerWord: 0, buttonWords: 0, decideMs: 1_000 },
      });
      expect(walkFloor(content, p.state.log).tooFast, `deal ${seed}`).toBeNull();
    }
  });
});
