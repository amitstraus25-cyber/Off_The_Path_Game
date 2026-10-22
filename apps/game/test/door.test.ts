/*
 * GRANDMA'S DOOR, OPEN (world/door.ts), against the tileset the game actually ships.
 *
 * world/door.ts restates the door's opening as graybox paints it, because the game must not import
 * graybox. A restated geometry is trap 1 waiting to happen, so this reads the shipped PNG back and
 * holds the restatement to the art: the arch's keyline is where `archTop` says it is, the open door
 * touches nothing outside the opening and its threshold, and the light it fills the room with is
 * the lit window's own and is warmer and brighter than the closed leaves were.
 *
 * The door's tile is found the way the scene finds it -- one row above the lane's top-left on
 * `decor-below` -- and never by its name.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readPng } from '../../../tools/graybox/src/png-read';
import gids from '../src/assets/tileset-forest.gids.json';
import { DOOR, archTop, brightestWarm, openDoor } from '../src/world/door';
import type { Rgb } from '../src/world/door';
import { TILE } from '../src/world/logic';

interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: { name: string; x: number; y: number }[];
}
const map = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/assets/map-forest.json', import.meta.url)), 'utf8'),
) as { width: number; layers: TiledLayer[]; tilesets: { columns: number; firstgid: number }[] };
const sheet = readPng(
  readFileSync(fileURLToPath(new URL('../src/assets/tileset-forest.png', import.meta.url))),
);

/** One tile of the shipped sheet as RGBA, by gid (flip bits masked off). */
function tile(gid: number): Uint8Array {
  const { columns, firstgid } = map.tilesets[0]!;
  const i = (gid & 0x1fffffff) - firstgid;
  const ox = (i % columns) * TILE;
  const oy = Math.floor(i / columns) * TILE;
  const out = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      for (let c = 0; c < 4; c++)
        out[(y * TILE + x) * 4 + c] = sheet.data[((oy + y) * sheet.width + ox + x) * 4 + c]!;
  return out;
}

const lane = map.layers.flatMap((l) => l.objects ?? []).find((o) => o.name === 'trigger-cottage')!;
const below = map.layers.find((l) => l.name === 'decor-below')!.data!;
const doorGid = below[(lane.y / TILE - 1) * map.width + lane.x / TILE]!;
const closed = tile(doorGid);
const lamp = brightestWarm(tile((gids as Record<string, number>)['wall-window-lit']!))!;
const open = openDoor(closed, TILE, lamp);

const px = (rgba: ArrayLike<number>, x: number, y: number): Rgb => {
  const p = (y * TILE + x) * 4;
  return [rgba[p]!, rgba[p + 1]!, rgba[p + 2]!];
};
const luma = ([r, g, b]: Rgb): number => 0.299 * r + 0.587 * g + 0.114 * b;

describe("Grandma's open door, against the shipped art", () => {
  it('finds a door on the map, and a warm lamp in the lit window', () => {
    expect(doorGid & 0x1fffffff, 'no tile above the lane').toBeGreaterThan(0);
    expect(lamp, 'the lit window has no warm light').not.toBeNull();
    expect(lamp[0] - lamp[2]).toBeGreaterThanOrEqual(90);
  });

  it("the arch's keyline is where archTop says, across the whole opening", () => {
    // The keyline under the arch band is the darkest row of the band and the leaf starts under it.
    for (let x = DOOR.left; x <= DOOR.right; x++) {
      const line = luma(px(closed, x, archTop(x) + 3));
      expect(line, `column ${x}`).toBeLessThan(luma(px(closed, x, archTop(x) + 1)));
      expect(line, `column ${x}`).toBeLessThan(60);
    }
  });

  it("the opening's edges are the art's reveal lines, with stone outside them", () => {
    // Read four rows above the leaf's foot: under the note's shadow, clear of the planting and the
    // daisies at the step, where the reveal is near-black and the jamb is worked stone. So
    // DOOR.left and DOOR.right are measured against the drawing, not remembered.
    const y = DOOR.foot - 4;
    for (const [edge, outside] of [
      [DOOR.left, DOOR.left - 1],
      [DOOR.right, DOOR.right + 1],
    ] as const) {
      expect(luma(px(closed, edge, y)), `reveal at ${edge}`).toBeLessThan(60);
      expect(luma(px(closed, outside, y)), `stone at ${outside}`).toBeGreaterThan(100);
      expect(
        luma(px(closed, edge + Math.sign(edge - outside), y)),
        `leaf inside ${edge}`,
      ).toBeGreaterThan(60);
    }
    // The gap under the leaf, then the threshold's lit tread.
    expect(luma(px(closed, 16, DOOR.gap))).toBeLessThan(60);
    expect(luma(px(closed, 16, DOOR.step))).toBeGreaterThan(luma(px(closed, 16, DOOR.gap)));
  });

  it('changes nothing outside the opening and the threshold it lights', () => {
    const changed: string[] = [];
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const inOpening = x > DOOR.left && x < DOOR.right && y >= archTop(x) + 4 && y <= DOOR.gap;
        const onStep =
          x > DOOR.left + 2 && x < DOOR.right - 2 && (y === DOOR.step || y === DOOR.step + 1);
        if (inOpening || onStep) continue;
        const p = (y * TILE + x) * 4;
        for (let c = 0; c < 4; c++) if (open[p + c] !== closed[p + c]) changed.push(`${x},${y}`);
      }
    expect(changed, 'pixels outside the opening').toEqual([]);
  });

  it('fills the room with light that is brighter and warmer than the closed leaves', () => {
    const middle = Math.round((DOOR.left + DOOR.right) / 2);
    const low = DOOR.foot - 3;
    const lit = px(open, middle, low);
    expect(luma(lit)).toBeGreaterThan(luma(px(closed, middle, low)) + 60);
    expect(lit[0] - lit[2], 'the light is warm').toBeGreaterThan(40);
    // And it is the lamp's own colour at its heart, not an invented one.
    expect(lit).toEqual(lamp);
  });

  it('is pure: the closed tile handed in is left as it was', () => {
    const copy = Uint8Array.from(closed);
    openDoor(closed, TILE, lamp);
    expect(closed).toEqual(copy);
  });
});
