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
import type { Content } from '../../src/v2/content.ts';
import { parseContent } from '../../src/v2/load.ts';
import { wingRideTarget } from '../../src/v2/perks.ts';
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
    // The rabbit is a 1.75 s walk and the toadstool a fraction more; the owl another two seconds,
    // and all three are stamped at 2.5 s.
    const stamps = [2_500, 2_500, 2_500, 170_000, 170_000, 170_000, 170_000, 170_000];
    expect(walkFloor(content, tourLog(stamps)).tooFast).toBe(2);
    // The arrival alone too fast.
    expect(walkFloor(content, [{ e: 'arrived', at: 1_000 }]).tooFast).toBe(0);
  });

  it('only meeting and arriving move Purple: cards and verdicts cost no distance', () => {
    // The toadstool's fork signs: a perk that saves no time, so taking it changes no floor.
    const c = content.characters[1]!;
    expect(findSkill(content, c.skillId)!.effect.kind).toBe('fork-signs');
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
      for (let seed = 0; seed < 35; seed++) {
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

  it('wing ride: the take flies her to the next unmet friend for the flight time, and the meeting there costs nothing more', () => {
    const { s, c } = owner('wing-ride');
    const flightMs = s.effect.kind === 'wing-ride' ? s.effect.flightMs : NaN;
    const order = content.characters.map((x) => x.id);
    const before = order.slice(0, order.indexOf(c.id) + 1);
    const to = wingRideTarget(content, before, c.id)!;
    const tour = (verdict: RunEvent): RunEvent[] => [
      ...before.map((id): RunEvent => ({ e: 'met', c: id, at: late })),
      verdict,
      { e: 'met', c: to, at: late },
    ];
    const upToGiver = walkFloor(content, tour(take(s.id, late)).slice(0, before.length)).floorMs;
    const flown = walkFloor(content, tour(take(s.id, late)));
    expect(flown.floorMs).toBeCloseTo(upToGiver + flightMs, 6);
    // Stamped inside the flight, the landing meeting is faster than the map allows.
    const early = tour(take(s.id, late)).map((e, i, all) =>
      i === all.length - 1 ? { ...e, at: upToGiver + flightMs - 1 } : e,
    );
    expect(walkFloor(content, early).tooFast).toBe(before.length + 1);
    // Left, it is a walk like any other.
    expect(walkFloor(content, tour(leave(s.id, late))).floorMs).not.toBeCloseTo(flown.floorMs, 3);
  });

  it('wing ride with nobody left unmet flies nowhere and charges nothing', () => {
    const { s, c } = owner('wing-ride');
    const all = content.characters.map((x): RunEvent => ({ e: 'met', c: x.id, at: late }));
    const giverLast = [
      ...all.filter((e) => e.e === 'met' && e.c !== c.id),
      all.find((e) => e.e === 'met' && e.c === c.id)!,
    ];
    const bare = walkFloor(content, giverLast).floorMs;
    expect(walkFloor(content, [...giverLast, take(s.id, late)]).floorMs).toBe(bare);
  });

  it('a take the content cannot place -- an unknown skill, or a wing ride nobody offers -- moves nothing it should not', () => {
    const bare: RunEvent[] = [{ e: 'arrived', at: late }];
    expect(walkFloor(content, [take('nobody', 0), ...bare])).toEqual(walkFloor(content, bare));
    // A wing ride offered by nobody (only a content the lint refused can say so) reads its
    // giver as standing before the first character, so it lands by the first unmet one.
    const orphan: Content = {
      ...content,
      characters: content.characters.filter((x) => x.id !== owner('wing-ride').c.id),
    };
    const { effect } = owner('wing-ride').s;
    const flightMs = effect.kind === 'wing-ride' ? effect.flightMs : NaN;
    const first = WALK_WORLD.spots[orphan.characters[0]!.spawn]!;
    // The first character stands level with the door, so the walk on is the horizontal gap.
    expect(first.y).toBeGreaterThanOrEqual(WALK_WORLD.door.y);
    expect(first.y).toBeLessThanOrEqual(WALK_WORLD.door.y + WALK_WORLD.door.height);
    expect(walkFloor(orphan, [take(owner('wing-ride').s.id, 0), ...bare]).floorMs).toBeCloseTo(
      flightMs + ((WALK_WORLD.door.x - first.x) / WALK_SPEED) * 1000 + orphan.world.knockMs,
      6,
    );
  });
});
