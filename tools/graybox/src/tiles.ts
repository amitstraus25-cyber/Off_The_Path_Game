/*
 * The tileset: assembly only.
 *
 * Every tile is painted in one of the five modules under `tiles/`, at 32x32, from the shared ramps
 * in `paint.ts` (docs/PIXEL_STANDARD.md). This file owns three things and nothing else:
 *
 *   1. `TILE`, the size of a square, which `forest-map.ts` and the game both measure the world in.
 *   2. `TILE_NAMES`, whose ORDER is the gid order, which is baked into `map-forest.json` and into
 *      `tileset-forest.gids.json`. Reordering it silently repaints the whole map, so the list is
 *      written out by hand here rather than derived from the modules' own key order -- the modules
 *      group their painters by subject, which is the right order to read them in and the wrong
 *      order to lay them out in.
 *   3. `paintTileset()`, which lays the named painters out 12 to a row.
 *
 * The previous 16px painters lived in this file and are gone: docs/ART_PRODUCTION.md section 1 is
 * explicit that none of the 106 frames could be salvaged, and upscaled 16px art looks exactly like
 * upscaled 16px art.
 */
import { Img } from './paint.ts';
import { GROUND_TILES } from './tiles/ground.ts';
import { WATER_TILES } from './tiles/water.ts';
import { FLORA_TILES } from './tiles/flora.ts';
import { BUILT_TILES } from './tiles/built.ts';
import { PROP_TILES } from './tiles/props.ts';

/** 32 since the remaster. One tile is one square of ground, everywhere. */
export const TILE = 32;

/** How wide the sheet is. Unchanged at 32px: 12 columns of 32 is a 384px-wide image. */
export const COLUMNS = 12;

type Painter = (img: Img) => void;

/** Every painter, merged. Keys are the contract; see the note on `TILE_NAMES` about order. */
export const TILE_PAINTERS: Record<string, Painter> = {
  ...GROUND_TILES,
  ...WATER_TILES,
  ...FLORA_TILES,
  ...BUILT_TILES,
  ...PROP_TILES,
};

/**
 * Tileset layout order, and therefore gid order. **Do not reorder.**
 *
 * A gid is this array's index plus one, and those numbers are written into every tile of
 * `map-forest.json`. Moving a name here without regenerating the map turns grass into roof.
 */
export const TILE_NAMES: readonly string[] = [
  'grass-0',
  'grass-1',
  'grass-2',
  'grass-3',
  'path',
  'path-n',
  'path-s',
  'path-e',
  'path-w',
  'path-ne',
  'path-nw',
  'path-se',
  'path-sw',
  'water',
  'water-2',
  'shore-n',
  'shore-s',
  'shore-e',
  'shore-w',
  'waterfall',
  'flower-white',
  'flower-pink',
  'flower-red',
  'bush',
  'rock',
  'trunk-l',
  'trunk-r',
  'canopy-tl',
  'canopy-tr',
  'canopy-bl',
  'canopy-br',
  'fence-h',
  'fence-post',
  'bridge-l',
  'bridge-m',
  'bridge-r',
  'wall',
  'wall-window',
  'door',
  'roof-l',
  'roof-m',
  'roof-r',
  'roof-peak',
  'chimney',
  'stall-awning-l',
  'stall-awning-m',
  'stall-awning-r',
  'stall-counter',
  'lantern-post',
  'fountain',
  'toadstool-ring',
  'well',
  'signpost',
];

/*
 * The layout list and the painters have to agree exactly, in both directions. A name here with no
 * painter is a blank square in the middle of the map; a painter nobody lists is a tile somebody
 * drew and nobody can place. Both are silent at runtime, so they are checked at import time.
 */
{
  const missing = TILE_NAMES.filter((name) => !TILE_PAINTERS[name]);
  if (missing.length > 0) throw new Error(`Tiles with no painter: ${missing.join(', ')}`);
  const unplaced = Object.keys(TILE_PAINTERS).filter((name) => !TILE_NAMES.includes(name));
  if (unplaced.length > 0) throw new Error(`Painters not in TILE_NAMES: ${unplaced.join(', ')}`);
}

/** Tiled gids are 1-based. */
export const gid = (name: string): number => {
  const i = TILE_NAMES.indexOf(name);
  if (i === -1) throw new Error(`Unknown tile "${name}"`);
  return i + 1;
};

export function paintTileset(): Img {
  const rows = Math.ceil(TILE_NAMES.length / COLUMNS);
  const sheet = new Img(COLUMNS * TILE, rows * TILE);
  TILE_NAMES.forEach((name, i) => {
    // Each tile is painted on its own canvas, so a painter's `outline()` sees only its own art and
    // never reaches across a cell boundary into its neighbour.
    const tile = new Img(TILE, TILE);
    TILE_PAINTERS[name]!(tile);
    sheet.blit(tile, (i % COLUMNS) * TILE, Math.floor(i / COLUMNS) * TILE);
  });
  return sheet;
}
