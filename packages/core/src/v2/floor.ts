import type { Content } from './content.ts';
import { wingRideTarget } from './perks.ts';
import type { RunEvent } from './state.ts';

/*
 * THE SHORTEST WALK A RUN LOG CAN HAVE TAKEN, so the server can refuse a log stamped faster than
 * anyone could walk it.
 *
 * A run's stamps are the browser's word. The server already bounds them from above by its own clock
 * (claimed <= what it saw pass since /api/start, apps/api handlers.ts). This bounds them from BELOW
 * by the map: to meet a character Purple has to walk to them, and to arrive she has to walk to the
 * door, and nothing on the map moves faster than `walkSpeed`. With speed now worth points
 * (scoring.ts `speedBonus`) the lower bound is worth having per run rather than as one number for
 * every run: it replaces the single 10 s `MIN_RUN_MS` that held only for the walk straight to the
 * door.
 *
 * A LOWER BOUND, BY THE STRAIGHT LINE. Every leg is the straight line between the points the game
 * itself measures from -- which no walk around a tree can beat -- less the talking radius at each
 * character, because a meeting needs Purple within `INTERACT_RADIUS` of them and no closer. The
 * points are the game's own anchors, not the objects' centres: Purple's feet start half a tile in
 * and a tile down from `spawn-purple` (forest-scene.ts), a character is talked to from half a tile
 * below their spawn's centre (`createCharacter`), and Purple arrives when her feet are inside
 * `trigger-cottage` (`overlaps`). An honest run walks further than this, always -- on today's map
 * the content-order tour is about 15 s by straight line and 29 s by the four-connected path the
 * clock check walks -- so the floor refuses only what cannot be walked at all.
 *
 * THE NUMBERS ARE A CACHE OF THE MAP, NOT A MEMORY OF IT (PAUL_BRIEF trap 1). Every field of
 * `WALK_WORLD` is derived from `apps/game/src/assets/map-forest.json` and the game's own
 * `logic.ts` in test/v2/floor.test.ts, which fails if either moves without this. They live here,
 * as data, rather than the server importing the map, because the deploy bundles core and the
 * content file and nothing else from outside apps/api -- and the deploy is where this project has
 * lost the most rounds. A character whose spawn is not listed contributes no distance: adding one
 * to the content weakens the floor for that leg and refuses nothing.
 */

export interface Point {
  x: number;
  y: number;
}

export interface WalkWorld {
  /** Logical pixels per second: the game's `WALK_SPEED`. Diagonals are normalised, so no faster. */
  walkSpeed: number;
  /** How far from each kind of point a leg may begin or end, in logical pixels. */
  reach: { start: number; character: number; door: number };
  /** Where Purple's feet stand when the clock starts. */
  start: Point;
  /** `trigger-cottage`, the rectangle Purple's feet step into to arrive. */
  door: { x: number; y: number; width: number; height: number };
  /** The point each character is talked to from, by spawn object name. */
  spots: Readonly<Record<string, Point>>;
}

export const WALK_WORLD: WalkWorld = {
  walkSpeed: 120,
  reach: { start: 0, character: 48, door: 0 },
  start: { x: 176, y: 672 },
  door: { x: 1600, y: 608, width: 64, height: 96 },
  spots: {
    'npc-rabbit': { x: 432, y: 640 },
    'bystander-toadstool': { x: 496, y: 736 },
    'npc-owl': { x: 592, y: 416 },
    'bystander-magpie': { x: 976, y: 736 },
    'bystander-snail': { x: 1232, y: 768 },
    'npc-lantern-keeper': { x: 1200, y: 1088 },
    'bystander-cat': { x: 1264, y: 640 },
  },
};

/** Straight-line distance from a point to the nearest point of a rectangle: 0 inside it. */
const toRect = (p: Point, r: WalkWorld['door']): number =>
  Math.hypot(
    Math.max(0, r.x - p.x, p.x - (r.x + r.width)),
    Math.max(0, r.y - p.y, p.y - (r.y + r.height)),
  );

export interface WalkFloor {
  /** The least elapsed time, in ms, at which the log's last walk could have ended. */
  floorMs: number;
  /** The first `met` or `arrived` event stamped earlier than walking there allows; null if none. */
  tooFast: number | null;
}

/**
 * The shortest walk the log describes: from the spawn to each character in the order the log met
 * them, then to the door. Only `met` and `arrived` move Purple, and one perk; every other event
 * happens where she stands. Pure, and assumes nothing about whether the log is otherwise legal --
 * the replay decides that (runlog.ts).
 *
 * THE PERKS (content.ts `effect`), each read off the log's own take verdicts, so the floor never
 * refuses an honest run that used one -- and never charges a run for a perk it did not take:
 *
 *  - `walk-faster`: every leg after the take is walked at `walkSpeed` x `factor`.
 *  - `wing-ride`: the take flies Purple to the talking spot of `wingRideTarget` (perks.ts) at the
 *    flight's cost, `flightMs`, instead of any walk; she lands ON the spot, so the meeting after
 *    it costs no further distance. Nobody unmet: no flight, nothing charged.
 *  - `early-welcome`: the arrival is not charged the knock (`content.world.knockMs`), which every
 *    other arrival is, because the game holds the knock on the clock before stamping `arrived`.
 *
 * A `rewind` changes no stamp -- stamps are real elapsed time (perks.ts) -- so it is not here.
 */
export function walkFloor(
  content: Content,
  events: readonly RunEvent[],
  world: WalkWorld = WALK_WORLD,
): WalkFloor {
  let speed = world.walkSpeed;
  const msFor = (pixels: number): number => (Math.max(0, pixels) / speed) * 1000;
  const spotOf = (c: string): Point | undefined => {
    const spawn = content.characters.find((x) => x.id === c)?.spawn;
    return spawn === undefined ? undefined : world.spots[spawn];
  };
  const met: string[] = [];
  let from: Point | null = world.start;
  let reach = world.reach.start;
  let welcome = false;
  let floorMs = 0;
  let tooFast: number | null = null;
  events.forEach((e, i) => {
    if (e.e === 'met') {
      const to = spotOf(e.c);
      if (from && to)
        floorMs += msFor(Math.hypot(to.x - from.x, to.y - from.y) - reach - world.reach.character);
      from = to ?? null;
      reach = world.reach.character;
      met.push(e.c);
    } else if (e.e === 'arrived') {
      if (from) floorMs += msFor(toRect(from, world.door) - reach - world.reach.door);
      if (!welcome) floorMs += content.world.knockMs;
    } else {
      if (e.e === 'verdict' && e.v === 'take') {
        const effect = content.skills.find((s) => s.id === e.s)?.effect;
        const giver = content.characters.find((c) => c.skillId === e.s)?.id;
        if (effect?.kind === 'walk-faster') speed *= effect.factor;
        if (effect?.kind === 'early-welcome') welcome = true;
        if (effect?.kind === 'wing-ride') {
          const to = wingRideTarget(content, met, giver);
          if (to !== null) {
            floorMs += effect.flightMs;
            from = spotOf(to) ?? null;
            reach = 0;
          }
        }
      }
      return;
    }
    if (tooFast === null && e.at < floorMs) tooFast = i;
  });
  return { floorMs, tooFast };
}
