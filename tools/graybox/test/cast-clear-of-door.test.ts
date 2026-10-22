/*
 * NOBODY IN THE CAST CAN BE SPOKEN TO FROM NEAR THE DOOR.
 *
 * The client, 2026-10-22: "You can't reach the cat because the cat is after the door." The Cat
 * stood at (52,19), the tile directly east of `trigger-cottage` (50-51 x 19-21). `trigger-cottage`
 * ends the run, it is a point test on Purple's feet, and the walk to the Cat went through the door
 * lane -- so the run ended on the way to her and Latch Lifter came out "You walked past" for players
 * who had walked straight at her. The core tour measured it and nobody read it: the leg to the Cat
 * was 26 tiles and the leg from her to the door was ZERO.
 *
 * Every guard there was passed, because every guard asked whether she was REACHABLE, and she was,
 * by floods that may walk through the trigger. None asked whether reaching her ENDS THE RUN. This
 * asks that, as geometry with a margin rather than as "not overlapping", because a talking ring one
 * tile off the trigger is the same fault with a player who drifts a step: the nearest position
 * Purple can talk to anybody from must sit at least `CLEAR_TILES` tiles from the trigger.
 *
 * THE BOUND IS THE GAME'S OWN, NOT A COPY OF IT (PAUL_BRIEF trap 5). The talking anchor is where the
 * game puts it -- `createCharacter` in forest-scene.ts draws the sprite at the spawn's centre plus
 * half a tile and `nearest()` measures Purple's feet against that point, the same anchor core's
 * `WALK_WORLD` caches -- and the reach is `INTERACT_RADIUS` from logic.ts. `CLEAR_TILES` is the one
 * number written here; it is a margin chosen against the drawing (the whole cast sits nine tiles or
 * more clear on the map this was written against), not derived from anybody's placement.
 *
 * TWO MAPS, ON PURPOSE. The generator's output, so moving somebody back beside the door in
 * `forest-map.ts` fails here before anyone regenerates; and the committed `map-forest.json`, which is
 * the file the game ships and the one the client was standing in.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { INTERACT_RADIUS, TILE } from '../../../apps/game/src/world/logic.ts';
import { generateForestMap } from '../src/forest-map.ts';

/** How many whole tiles clear of `trigger-cottage` the nearest talking position must stay. */
const CLEAR_TILES = 5;

interface Obj {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface MapFile {
  layers: { type: string; objects?: Obj[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../content/game.v2.json', import.meta.url), 'utf8'),
) as { characters: { id: string; spawn: string }[] };

const committed = JSON.parse(
  readFileSync(new URL('../../../apps/game/src/assets/map-forest.json', import.meta.url), 'utf8'),
) as MapFile;
const generated = JSON.parse(generateForestMap().json) as MapFile;

/** Straight-line distance from a point to the nearest point of a rectangle: 0 inside it. */
const toRect = (p: { x: number; y: number }, r: Obj): number =>
  Math.hypot(
    Math.max(0, r.x - p.x, p.x - (r.x + r.width)),
    Math.max(0, r.y - p.y, p.y - (r.y + r.height)),
  );

describe.each([
  ['the generated map', generated],
  ['the committed map-forest.json', committed],
])('%s: every talking spot stays clear of trigger-cottage', (_which, map) => {
  const objects = map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];
  const need = (name: string): Obj => {
    const o = objects.find((q) => q.name === name);
    if (!o) throw new Error(`the map has no "${name}"`);
    return o;
  };
  const door = need('trigger-cottage');

  it('names somebody, or every assertion below is vacuous', () => {
    expect(content.characters.length).toBeGreaterThan(0);
  });

  it.each(content.characters.map((c) => [c.id, c.spawn] as const))(
    `%s (%s) cannot be spoken to from within ${CLEAR_TILES} tiles of the door`,
    (id, spawn) => {
      const o = need(spawn);
      const anchor = { x: o.x + o.width / 2, y: o.y + o.height / 2 + TILE / 2 };
      const nearestTalk = toRect(anchor, door) - INTERACT_RADIUS;
      expect(
        nearestTalk / TILE,
        `${id} at tile (${o.x / TILE},${o.y / TILE}) can be spoken to ` +
          `${(nearestTalk / TILE).toFixed(2)} tiles from trigger-cottage; walking to them ends the run`,
      ).toBeGreaterThanOrEqual(CLEAR_TILES);
    },
  );
});
