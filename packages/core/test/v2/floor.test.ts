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
import { findSkill } from '../../src/v2/content.ts';
import { everySeed } from '../../src/v2/deal.ts';
import { parseContent } from '../../src/v2/load.ts';
import { play } from '../../src/v2/sim.ts';
import type { RunEvent } from '../../src/v2/state.ts';
import { content as fixture } from './helpers.ts';
import { AWAITING_MAP, mapPending } from './awaiting-map.ts';

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
  // Skipped while rules 3's new objects are not on the shipped map yet (awaiting-map.ts).
  it.skipIf(mapPending)(
    `derives every field from the map and logic.ts (waits for: ${AWAITING_MAP.join(', ') || 'nothing'})`,
    () => {
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
        // Where a wing ride sets her down: the landing point itself (a Tiled point has no size).
        landings: Object.fromEntries(
          content.skills.flatMap((s) =>
            s.effect.kind === 'wing-ride' ? [[s.effect.lands, centreOf(need(s.effect.lands))]] : [],
          ),
        ),
      };
      expect(WALK_WORLD).toEqual(derived);
    },
  );
});

/** A met event for each character in content order, then the door, stamped as given. */
const tourLog = (stamps: number[]): RunEvent[] => [
  ...content.characters.map((c, i): RunEvent => ({ e: 'met', c: c.id, at: stamps[i]! })),
  { e: 'arrived', at: stamps[content.characters.length]! },
];

describe('the floor of a log', () => {
  it('straight to the door is the straight line from her feet to the door, at walking speed, then the knock', () => {
    const s = WALK_WORLD.start;
    const d = WALK_WORLD.door;
    const px = Math.hypot(d.x - s.x, Math.max(0, d.y - s.y, s.y - (d.y + d.height)));
    const { floorMs, tooFast } = walkFloor(content, [{ e: 'arrived', at: 60_000 }]);
    expect(content.world.knockMs).toBeGreaterThan(0);
    expect(floorMs).toBeCloseTo((px / WALK_SPEED) * 1000 + content.world.knockMs, 6);
    // About eleven seconds of walking on today's map, and the knock: the old MIN_RUN_MS was 10 s.
    expect(floorMs - content.world.knockMs).toBeGreaterThan(10_000);
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
    // Every stamp exactly at its own floor is honest; the last meeting a millisecond early is not.
    const floors = content.characters.map(
      (_c, i) => walkFloor(content, tourLog(Array(8).fill(170_000)).slice(0, i + 1)).floorMs,
    );
    const exact = [...floors, 170_000];
    expect(walkFloor(content, tourLog(exact)).tooFast).toBeNull();
    const last = content.characters.length - 1;
    expect(floors[last]!).toBeGreaterThan(0);
    exact[last] = floors[last]! - 1;
    expect(walkFloor(content, tourLog(exact)).tooFast).toBe(last);
    // The arrival alone too fast.
    expect(walkFloor(content, [{ e: 'arrived', at: 1_000 }]).tooFast).toBe(0);
  });

  it('only meeting and arriving move Purple: cards and verdicts cost no distance', () => {
    // The lantern keeper's night light: a perk that saves no time, so taking it changes no floor.
    const c = content.characters.find((x) => x.id === 'lantern-keeper')!;
    expect(findSkill(content, c.skillId)!.effect.kind).toBe('lantern');
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
    // Careful and greedy both, so every perk is taken in some run: greedy takes all seven.
    for (const strategy of ['careful', 'greedy'])
      for (const seed of everySeed(content)) {
        const p = play(content, strategy, {
          seed,
          pace: { walkMs: 5_000, talkMs: 1_000 },
          reading: { msPerWord: 0, buttonWords: 0, decideMs: 1_000 },
        });
        expect(walkFloor(content, p.state.log).tooFast, `${strategy} ${seed}`).toBeNull();
      }
  });
});

/*
 * THE PERKS IN THE FLOOR (content.ts `effect`). Each is read off the log's own take verdict, so a
 * run is charged for exactly the perks it took: an honest run that flew, walked faster or was
 * welcomed is never refused for it, and a log that did none of those gets no discount.
 */
describe('the floor of a log that took a perk', () => {
  const owner = (kind: string) => {
    const s = content.skills.find((x) => x.effect.kind === kind)!;
    return { s, c: content.characters.find((c) => c.skillId === s.id)! };
  };
  const take = (s: string, at: number): RunEvent => ({ e: 'verdict', s, v: 'take', at });
  const leave = (s: string, at: number): RunEvent => ({ e: 'verdict', s, v: 'leave', at });
  const late = 170_000;

  it('early welcome: the arrival is not charged the knock; leaving it, it is', () => {
    const { s, c } = owner('early-welcome');
    const met: RunEvent = { e: 'met', c: c.id, at: late };
    const arrived: RunEvent = { e: 'arrived', at: late };
    const welcomed = walkFloor(content, [met, take(s.id, late), arrived]).floorMs;
    const knocked = walkFloor(content, [met, leave(s.id, late), arrived]).floorMs;
    expect(knocked - welcomed).toBeCloseTo(content.world.knockMs, 6);
  });

  it('walk faster: every leg after the take is walked at the faster speed, and none before it', () => {
    const { s, c } = owner('walk-faster');
    const factor = s.effect.kind === 'walk-faster' ? s.effect.factor : NaN;
    const met: RunEvent = { e: 'met', c: c.id, at: late };
    const arrived: RunEvent = { e: 'arrived', at: late };
    const to = walkFloor(content, [met]).floorMs;
    const slow = walkFloor(content, [met, leave(s.id, late), arrived]).floorMs;
    const fast = walkFloor(content, [met, take(s.id, late), arrived]).floorMs;
    const knock = content.world.knockMs;
    expect(fast - to - knock).toBeCloseTo((slow - to - knock) / factor, 6);
    expect(fast).toBeLessThan(slow);
  });

  /*
   * RULES 3: the flight lands on the map point its effect names (`lands`, the far bank's
   * `wing-landing`), not beside a character. The floor charges the flight, then walks on from
   * where she is set down. Tested on worlds that place the landing, because the shipped
   * WALK_WORLD cannot yet (awaiting-map.ts): with it unplaced, the leg after the flight is free.
   */
  it('wing ride: the take charges the flight, and the walk on starts from where she lands', () => {
    const { s, c } = owner('wing-ride');
    const flightMs = s.effect.kind === 'wing-ride' ? s.effect.flightMs : NaN;
    const lands = s.effect.kind === 'wing-ride' ? s.effect.lands : '';
    const order = content.characters.map((x) => x.id);
    const giver = order.indexOf(c.id);
    const next = content.characters[giver + 1]!;
    const nextSpot = WALK_WORLD.spots[next.spawn]!;
    const tour = (verdict: RunEvent): RunEvent[] => [
      { e: 'met', c: c.id, at: late },
      verdict,
      { e: 'met', c: next.id, at: late },
    ];
    const to = walkFloor(content, tour(take(s.id, late)).slice(0, 1)).floorMs;
    // Landing ON the next character's talking spot: the meeting there costs nothing more.
    const onSpot: WalkWorld = { ...WALK_WORLD, landings: { [lands]: nextSpot } };
    expect(walkFloor(content, tour(take(s.id, late)), onSpot).floorMs).toBeCloseTo(
      to + flightMs,
      6,
    );
    // Landing 600 px short of it: the walk on is charged, less the talking radius.
    const short: WalkWorld = {
      ...WALK_WORLD,
      landings: { [lands]: { x: nextSpot.x - 600, y: nextSpot.y } },
    };
    const walkOn = ((600 - WALK_WORLD.reach.character) / WALK_SPEED) * 1000;
    const flown = walkFloor(content, tour(take(s.id, late)), short).floorMs;
    expect(flown).toBeCloseTo(to + flightMs + walkOn, 6);
    // Stamped inside the flight and the walk on, the meeting is faster than the map allows.
    const early = tour(take(s.id, late)).map((e, i) => (i === 2 ? { ...e, at: flown - 1 } : e));
    expect(walkFloor(content, early, short).tooFast).toBe(2);
    // Left, it is a walk like any other, from the giver.
    expect(walkFloor(content, tour(leave(s.id, late)), short).floorMs).not.toBeCloseTo(flown, 3);
    // A landing the world cannot place: the flight is charged and the leg after it is free.
    expect(walkFloor(content, tour(take(s.id, late))).floorMs).toBeCloseTo(to + flightMs, 6);
  });

  it('a take the content cannot place -- an unknown skill -- moves nothing', () => {
    const bare: RunEvent[] = [{ e: 'arrived', at: late }];
    expect(walkFloor(content, [take('nobody', 0), ...bare])).toEqual(walkFloor(content, bare));
  });
});
