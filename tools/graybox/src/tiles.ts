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
import { GROUND_TILES } from './tiles/w-ground.ts';
import { WATER_TILES } from './tiles/w-water.ts';
import { TREE_TILES } from './tiles/w-trees.ts';
import { UNDERGROWTH_TILES } from './tiles/w-undergrowth.ts';
import { COTTAGE_TILES } from './tiles/s-cottage.ts';
import { OUTDOOR_TILES } from './tiles/s-outdoor.ts';
import { PROP_TILES } from './tiles/s-props.ts';

/** 32 since the remaster. One tile is one square of ground, everywhere. */
export const TILE = 32;

/** How wide the sheet is. Unchanged at 32px: 12 columns of 32 is a 384px-wide image. */
export const COLUMNS = 12;

type Painter = (img: Img) => void;

/** Every painter, merged. Keys are the contract; see the note on `TILE_NAMES` about order. */
export const TILE_PAINTERS: Record<string, Painter> = {
  ...GROUND_TILES,
  ...WATER_TILES,
  ...TREE_TILES,
  ...UNDERGROWTH_TILES,
  ...COTTAGE_TILES,
  ...OUTDOOR_TILES,
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
  /*
   * APPENDED, which is the only safe way to add a tile while a map exists.
   *
   * `TILE_NAMES` is no longer frozen, but it is unfrozen rather than unconstrained: a gid is this
   * array's index plus one, so inserting a name anywhere but the end renumbers every tile after it
   * and `map-forest.json` has to be regenerated in the same change or grass becomes roof. Appending
   * renumbers nothing -- every existing gid keeps its value, the committed map stays valid, and the
   * sheet's 12-wide layout puts the new tiles in cells nobody referenced before.
   *
   * The cost of appending is only that a new tile does not appear anywhere until the map owner
   * places it, and that `pnpm graybox` must be re-run to get it into `tileset-forest.png` and
   * `tileset-forest.gids.json`.
   *
   * Two more bush silhouettes: `bush-low` is a wide bank in the bottom half of its tile with lawn
   * above it, `bush-tall` a narrow leaning shrub with lawn either side. Both differ from `bush` in
   * FOOTPRINT rather than in outline detail, which is what reads at a 26-tile camera.
   */
  'bush-low',
  'bush-tall',
  /*
   * Two more tree SCALES, appended for the reason above, 2026-10-19.
   *
   * One crown stamped 318 times at one size is 41.8 per cent of the frame and is why the wood reads
   * as an orchard, and the painter owner proved it cannot be fixed from inside a painter:
   * autocorrelation excess at lag 64 is +0.082 before and after breaking up the crown's highlight.
   * The board's wood has trees at three scales -- measured at our own resolution, 80, 55 and 43 px
   * of crown -- and that spread is most of why it reads as a wood. ART_DIRECTION section 7.5.
   *
   *   elder-*       the board's FOREGROUND tree: an 86 px crown in a 3x3 over a trunk row of three.
   *                 Nine canopy cells laid at (0..2, -3..-1) from the trunk row, then
   *                 `elder-trunk-l/-m/-r` across the trunk row itself. The trunk's two cells of
   *                 collision footprint become three. Mirrors by swapping the left and right
   *                 COLUMNS of the nine and leaving the middle column where it is.
   *   sapling-*     the board's BACKGROUND tree: crown, trunk, roots and shadow all inside one 2x2,
   *                 so it needs no trunk row and no six-cell footprint -- four cells and it is a
   *                 whole tree. Mirrors left for right like the mid crown. This is the one that
   *                 lets a grove have an edge: small trees fill between big ones.
   */
  'elder-tl',
  'elder-tc',
  'elder-tr',
  'elder-ml',
  'elder-mc',
  'elder-mr',
  'elder-bl',
  'elder-bc',
  'elder-br',
  'elder-trunk-l',
  'elder-trunk-m',
  'elder-trunk-r',
  'sapling-tl',
  'sapling-tr',
  'sapling-bl',
  'sapling-br',
  /*
   * The garden's corner post, appended for the reason above, 2026-10-19.
   *
   * A fence seen ALONG its run and a fence seen FACE-ON are different objects, and the run has to
   * END somewhere. `fence-corner` is the board's own corner post: one wide flat cap over a body with
   * no rhythm in it, which is what makes a run read as turning rather than stopping. One tile serves
   * all four corners of the garden and both ends of a picket run -- a post is a post.
   *
   * `fence-post` is NOT new and keeps its gid, but it has been REDRAWN as the run seen end-on, which
   * is the only way the map places it (nine times down column 46, never beside itself). So the
   * client's "from the top view, in the front, it looks weird" is fixed with no map change at all;
   * the corners are the part that needs placing. See the long note in s-outdoor.ts.
   */
  'fence-corner',
  /*
   * The corner post with a rail stub, appended for the reason above, 2026-10-19.
   *
   * `fence-corner` paints x 8..24 and `fence-h` paints its rails across the full 0..31, so a picket
   * run arriving at a corner post leaves seven or eight columns of bare lawn between the post and
   * the first rail: the fence comes apart at the corner. These two carry the same approved post with
   * the rails continuing out of one side of the tile, so the run actually meets it.
   *
   * Which side is a property of the corner rather than of the post. `fence-corner-e` is the post a
   * run leaves to the EAST -- the north-west and south-west corners of the garden, and the west side
   * of a gate gap. `fence-corner-w` is the mirror: the north-east and south-east corners, and the
   * east side of a gate. Plain `fence-corner` stays for a post with no picket run against it at all,
   * which is either end of a bare north-south run.
   */
  'fence-corner-e',
  'fence-corner-w',
  /*
   * The cottage's outline, appended for the reason above, 2026-10-19.
   *
   * The review's verdict on the building was that the facade is "two stacked rectangles ... a grey
   * mat on a cream mat; per-tile scalloping cannot rescue a wrong outline". All three of these are
   * outline rather than detail, and none of them could exist while this list was frozen.
   *
   *   gable             the front gable, over the door. Laid at (cx + 2, cy - 1) and again at
   *                     (cx + 3, cy - 1) with the horizontal mirror bit, so the two halves meet in
   *                     an apex on the seam and the attic window straddles it. That row is cleared
   *                     grass today, so the gable rises against the garden and breaks a ridge line
   *                     that is otherwise a straight 192px rule -- `roof-peak` is laid six times and
   *                     a gable happens once, which is the whole reason this is a tile.
   *   wall-corner       the facade's end: a timber corner post, with its outer SIXTEEN COLUMNS
   *                     TRANSPARENT. That transparency is what makes the roof overhang -- the wall
   *                     stops half a tile in and `roof-l`/`roof-r` keep going over the grass. Laid
   *                     at cx and, mirrored, at cx + 5, on every wall course.
   *   wall-window-lit   the board's right-hand window with the lamp on, for ONE of the two window
   *                     positions. The Arrive panel's "The lamp is lit" has been printing over two
   *                     dark windows. No animal in it: a tile is the same pixels on every ending.
   *
   * Appending renumbers nothing, so `map-forest.json` stays valid as it is and needs no regeneration
   * -- the three only have to be PLACED, which is four lines in `forest-map.ts`, and `pnpm graybox`
   * re-run to get them onto the sheet. See the long notes in s-cottage.ts.
   */
  'gable',
  'wall-corner',
  'wall-window-lit',
  /*
   * The two things the game scores the player for READING, appended for the reason above,
   * 2026-10-20.
   *
   * `content/game.json` has paid a hundred points for `cottage-door` since the errand existed and
   * nothing was ever drawn for it: the trigger covered two tiles of flower bed and four of sand,
   * both decor layers were empty over all six, and this list had no notice in it at all. The other
   * notice WAS drawn, as `signpost` -- the identical tile to the decorative one four tiles from the
   * spawn -- so the first post a player met taught them that a post with arms on it means nothing
   * and the level's one mandatory beat then rested on a post with arms on it.
   *
   *   notice-board  the forest post on the gate approach: a pale portrait page nailed to a capped
   *                 post, ruled with writing and dog-eared at the foot. `signpost` is unchanged and
   *                 keeps the fork at (9,18), because a fork still needs marking and because arrows
   *                 and paper now say two different things. See the long note in s-props.ts.
   *   door-note     the cottage owner's `door`, repainted exactly, with a sheet pinned to its west
   *                 leaf. A tile rather than a decor-above overlay: decor-above draws over Red, so
   *                 a note laid there is painted across her face on the doorstep.
   *
   * Appending renumbers nothing, so `map-forest.json` stays valid as committed. Both have to be
   * PLACED -- two lines in `forest-map.ts`, already done -- and `pnpm graybox` re-run to get them
   * onto the sheet and into `tileset-forest.gids.json`.
   */
  'notice-board',
  'door-note',
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
