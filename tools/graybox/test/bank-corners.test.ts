/*
 * EVERY CORNER OF THE RIVER BANK HAS ITS CORNER TILE, AND EVERY CORNER TILE MEETS ITS NEIGHBOURS.
 *
 * The client, 2026-10-22: "look at all the stones along the bank of the river, make sure there's
 * no issues there". On HEAD (2b42743) there were two kinds, and they were one fault: the bank was
 * chosen from a cell's four SIDES only, and a diagonal river is a staircase.
 *   - the nose of each step, water on two adjacent sides, drew a straight bank whose lawn and
 *     stones ran on to the tile edge and stopped against open water: (32,8), (29,4), (33,2);
 *   - the inside of each step, water across one diagonal only, drew plain grass, so the waterline
 *     beside it ran into a lit lawn square across a tile seam: (28,7), and every step of the
 *     south-west reach.
 * 82 cells off the deck and the track. The fix is eight tiles (`corner()` in `tiles/w-water.ts`)
 * and a pass that places them (`bankFor` in `forest-map.ts`).
 *
 * TWO GUARDS, BECAUSE THE FAULT HAD TWO HALVES.
 *
 * 1. PLACEMENT, on the generated map and on the committed `map-forest.json` (the file the game
 *    ships). Asked of the DRAWN ground, cell by cell, and stated here as geometry rather than by
 *    calling `bankFor` -- a guard that calls the function it guards passes whenever that function
 *    is wrong in the same way twice (PAUL_BRIEF trap 5). The rule: wherever a cell of land has two
 *    wet sides meeting at a corner, it carries the point for the opposite corner; wherever its only
 *    water is across a diagonal, it carries the cove for that diagonal; and no cell of land has
 *    water on two opposite sides, which no tile in the set can draw.
 *
 *    Two kinds of cell are exempt, by name and for a reason each: the DECK and the TRACK, which are
 *    the crossing and have no bank tile; and a cell under a crown quarter opaque in every pixel,
 *    whose ground nobody can see (see the corner pass in `forest-map.ts`, and audit 12 for why
 *    lifting the cover there is the worse fault).
 *
 * 2. THE TILES, on their pixels. A corner tile is only as good as its seams, and the way these
 *    failed before was a seam: a bank that stops at a tile edge, a stone sawn off at one. So every
 *    edge of every corner tile is read pixel by pixel as water, stone or land and compared with
 *    what is on the other side of it on the map:
 *      - the edge where an arm of the bank runs on must read EXACTLY as the straight bank's own
 *        edge does at that position -- the straight tile is periodic, so its far edge is what
 *        meets ours -- which is the waterline crossing at the same pixel and the same stones
 *        crossing with it;
 *      - a point's other two edges face open river and must be water from end to end, no stone
 *        reaching them and no lawn;
 *      - a cove's other two edges face open lawn and must be land from end to end, no water and no
 *        stone reaching them.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BASE_GID, generateForestMap, MAP_H, MAP_W } from '../src/forest-map.ts';
import { Img } from '../src/paint.ts';
import { TILE, TILE_NAMES, TILE_PAINTERS } from '../src/tiles.ts';

interface MapFile {
  layers: { name: string; data?: number[] }[];
}

const committed = JSON.parse(
  readFileSync(new URL('../../../apps/game/src/assets/map-forest.json', import.meta.url), 'utf8'),
) as MapFile;
const generated = JSON.parse(generateForestMap().json) as MapFile;

const painted = new Map<string, Img>();
const paint = (name: string): Img => {
  let img = painted.get(name);
  if (!img) {
    img = new Img(TILE, TILE);
    TILE_PAINTERS[name]!(img);
    painted.set(name, img);
  }
  return img;
};

/** A tile nobody can see the ground under: opaque in all of its pixels. */
const blind = (name: string): boolean => {
  if (name === '') return false;
  const d = paint(name).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return false;
  return true;
};

const WET = new Set(['water', 'water-2', 'waterfall']);

/** Every place a cell of land meets the water at a corner and does not carry the tile for it. */
function untiledCorners(map: MapFile): string[] {
  const layer = (n: string): number[] => map.layers.find((l) => l.name === n)!.data!;
  const ground = layer('ground');
  const above = layer('decor-above');
  const nameOf = (raw: number): string => TILE_NAMES[((raw >>> 0) & BASE_GID) - 1] ?? '';
  const at = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? '' : nameOf(ground[y * MAP_W + x]!);
  const wet = (x: number, y: number): boolean => WET.has(at(x, y));

  const faults: string[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const here = at(x, y);
      if (WET.has(here) || here.startsWith('path') || here.startsWith('bridge')) continue;
      if (blind(nameOf(above[y * MAP_W + x]!))) continue;
      const where = `(${x},${y}) ${here}`;
      if ((wet(x, y - 1) && wet(x, y + 1)) || (wet(x - 1, y) && wet(x + 1, y)))
        faults.push(`${where}: water on two opposite sides, which no tile can draw`);
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const ns = dy < 0 ? 'n' : 's';
        const ew = dx < 0 ? 'w' : 'e';
        const side = wet(x, y + dy);
        const edge = wet(x + dx, y);
        // Two wet sides meeting at this corner: a point, whose land is the corner ACROSS from it.
        if (side && edge) {
          const want = `shore-${dy < 0 ? 's' : 'n'}${dx < 0 ? 'e' : 'w'}`;
          if (here !== want) faults.push(`${where}: water ${ns} and ${ew}, wants ${want}`);
        }
        // Water across this diagonal and nowhere else near it: a cove.
        if (!side && !edge && wet(x + dx, y + dy)) {
          const want = `shore-cove-${ns}${ew}`;
          if (here !== want)
            faults.push(`${where}: water across the ${ns}${ew} corner, wants ${want}`);
        }
      }
    }
  return faults;
}

describe.each([
  ['the generated map', generated],
  ['the committed map-forest.json', committed],
])('%s: the bank turns every corner with a corner tile', (_which, map) => {
  it('has a river with corners at all, or the check below is vacuous', () => {
    const ground = map.layers.find((l) => l.name === 'ground')!.data!;
    const names = new Set(ground.map((raw) => TILE_NAMES[((raw >>> 0) & BASE_GID) - 1]));
    for (const corner of ['shore-nw', 'shore-se', 'shore-cove-nw', 'shore-cove-se'])
      expect(names.has(corner), `${corner} is laid nowhere`).toBe(true);
  });

  it('leaves no land corner meeting the water without its corner tile', () => {
    expect(untiledCorners(map)).toEqual([]);
  });
});

/* --- the tiles' seams -------------------------------------------------------------------- */

type Edge = 'n' | 's' | 'e' | 'w';
type Kind = 'water' | 'stone' | 'land';

/*
 * What a pixel is, from the palette alone (the same reading `w-water.ts`'s own guard uses): the
 * `water` ramp is blue over green over red; every `stone` value has red equal to green to within a
 * rounding; the lawn, the bank line and the wet earth are green over both.
 */
const kindOf = (c: readonly number[]): Kind =>
  c[2]! > c[1]! && c[1]! > c[0]! ? 'water' : Math.abs(c[0]! - c[1]!) < 3 ? 'stone' : 'land';

const edgeOf = (img: Img, e: Edge): Kind[] =>
  Array.from({ length: TILE }, (_, i) =>
    kindOf(
      e === 'n'
        ? img.get(i, 0)
        : e === 's'
          ? img.get(i, TILE - 1)
          : e === 'w'
            ? img.get(0, i)
            : img.get(TILE - 1, i),
    ),
  );
const spell = (k: Kind[]): string => k.map((v) => v[0]).join('');

/** The straight bank whose land is on side `s`, and which of its own edges a seam on `e` meets. */
const straight = (s: Edge): string => `shore-${s}`;

/*
 * Each corner tile, edge by edge: the straight bank that runs on across it, or what it faces.
 * Written out rather than derived, so a change to the painter's own notion of which way an arm
 * opens fails here instead of moving with it.
 */
const SEAMS: Record<string, Record<Edge, string>> = {
  'shore-nw': { w: straight('n'), n: straight('w'), e: 'water', s: 'water' },
  'shore-ne': { e: straight('n'), n: straight('e'), w: 'water', s: 'water' },
  'shore-sw': { w: straight('s'), s: straight('w'), e: 'water', n: 'water' },
  'shore-se': { e: straight('s'), s: straight('e'), w: 'water', n: 'water' },
  'shore-cove-nw': { n: straight('e'), w: straight('s'), s: 'land', e: 'land' },
  'shore-cove-ne': { n: straight('w'), e: straight('s'), s: 'land', w: 'land' },
  'shore-cove-sw': { s: straight('e'), w: straight('n'), n: 'land', e: 'land' },
  'shore-cove-se': { s: straight('w'), e: straight('n'), n: 'land', w: 'land' },
};

describe('the corner tiles meet the straight banks at every seam', () => {
  it('names all eight corner tiles in the tileset', () => {
    for (const name of Object.keys(SEAMS)) expect(TILE_NAMES).toContain(name);
  });

  for (const [name, seams] of Object.entries(SEAMS))
    for (const [e, against] of Object.entries(seams) as [Edge, string][])
      it(`${name}'s ${e} edge meets ${against}`, () => {
        const mine = edgeOf(paint(name), e);
        if (against === 'water' || against === 'land') {
          expect(spell(mine), `${name}'s ${e} edge faces open ${against}`).toBe(
            against[0]!.repeat(TILE),
          );
          return;
        }
        // The straight bank is periodic along itself, so the edge of it that meets ours is the
        // one in the same position on our side: our west edge meets its east, which is its own
        // west edge again one tile on.
        expect(spell(mine), `${name}'s ${e} edge against ${against}`).toBe(
          spell(edgeOf(paint(against), e)),
        );
      });
});
