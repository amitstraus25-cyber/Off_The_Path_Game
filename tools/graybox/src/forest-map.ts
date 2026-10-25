// Lays out the forest: a winding river with a waterfall, curving paths, tree clusters with 2x2
// canopies, and the landmarks the story needs. Objects keep the names apps/game reads.
import {
  cameraCentreTiles,
  cameraFor,
  MIN_VIEW,
  PORTRAIT_WORLD_BAND,
  REFERENCE_VIEWPORTS,
  topEdgeRows,
  v2,
  visibleTitleColumns,
} from '@otp/core';
import { Img, lumaOf, noise, valueNoise2D } from './paint.ts';
import { COLUMNS, TILE, TILE_NAMES, TILE_PAINTERS, gid } from './tiles.ts';
import { SEALED_BANK } from './tiles/w-water.ts';
import { LOGO_FACE } from './tiles/s-props.ts';

export const MAP_W = 60;
export const MAP_H = 42;

/*
 * ===========================================================================
 * THE TILED MIRROR BITS, OWNED IN ONE PLACE.
 * ===========================================================================
 *
 * Tiled keeps a tile's mirror state in the top three bits of its gid and Phaser's `tilemapTiledJSON`
 * loader honours them, so the generator writing the map and anything READING the map back have to
 * agree about all four of these exactly. `world.ts` -- the renderer every framing decision is judged
 * with -- declared its own copies, which is two files owning one wire format.
 *
 * They are up here rather than inside `generateForestMap` so that agreement is an import.
 */
export const FLIP_H = 0x80000000;
export const FLIP_V = 0x40000000;
/** The transpose. Only safe on a square texture with no up and no light in it: ground and water. */
export const FLIP_D = 0x20000000;
/*
 * The gid with the three mirror bits taken off, and every pass that READS a tile back by name
 * has to use it. It lives with the bits it undoes, because the passes that need it run both before
 * the mirroring and after it -- `clearArea` is called from the verge and connectivity sweeps at the
 * very bottom of the file -- and a comparison that forgot the mask is silent: the tile is simply
 * never recognised, so a felled tree keeps its trunk on the map and loses its collision, which is
 * the one thing this file warns about in three separate places.
 */
export const BASE_GID = 0x1fffffff;

/*
 * ===========================================================================
 * THE RIVER'S TWO WAYS OVER (the client's design, 2026-10-25, docs/GATEKEEPER.md).
 * ===========================================================================
 *
 * The bridge has a gate on it now, and the Gatekeeper at its west end holds the key; the Magpie
 * waits on the west bank, south of the bridge, and flies Purple over to `wing-landing` on the far
 * side. These are the two spots that design leaves open, written once here so moving either is one
 * edit: the client is sending a picture of exactly where the Magpie should stand.
 *
 * `MAGPIE_SPOT` is the cell she stands on. Her footpath leaves the main road at the first fork and
 * is routed to her from here (see `magpieLane`), so it follows her wherever she goes; she must stay
 * on the west bank, and the audit's BALANCE check (15) fails the build if the walk through her and
 * the flight stops being within ten per cent of the walk over the bridge.
 *
 * `WING_LANDING` is the cell the flight sets Purple down on, on the path from the well up to the road
 * at the second fork, which joins the road to Grandma. The map object is a POINT at that cell's
 * centre. It moves the flight's half of the balance, so the audit checks it too.
 */
export const MAGPIE_SPOT = { x: 19, y: 27 } as const;
export const WING_LANDING = { x: 35, y: 28 } as const;

type Layer = number[];
const blank = (): Layer => new Array<number>(MAP_W * MAP_H).fill(0);

/*
 * ===========================================================================
 * THE THREE RECTANGLES A VISITOR ACTUALLY SEES, ASKED FOR RATHER THAN QUOTED.
 * ===========================================================================
 *
 * Three rounds of composition were aimed at "about 26 x 15 tiles at 1280 wide", a figure that came
 * from a zoom option considered and abandoned during the remaster and that lived in a COMMENT in
 * this file. No test could catch it and no renderer disagreed with it. The real camera is a third
 * smaller, and it is derived in `packages/core/src/camera.ts`, which this workspace depends on.
 *
 * So nothing below ever DERIVES a camera size. `cameraFor()` gives the size, the game's own focus
 * rule gives the centre, and `frameAt` turns the two into tiles. If the frame chrome, the margins
 * or the zoom rule change, the composition and the guards move with them or neither does.
 *
 * That sentence read "nothing below ever states a camera size", and thirteen comments below state
 * one. All thirteen are correct today -- they quote 19.41 x 11.22, which is what `cameraFor()`
 * returns for the desktop reference viewport -- but a reader who takes the banner at its word has
 * no reason to doubt the fourteenth, and a quoted figure is exactly how the abandoned 26 x 15 came
 * to survive three rounds of composition. A figure in prose here is an ILLUSTRATION of what the
 * code computes. Nothing is allowed to compute from one.
 */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/*
 * CAMERA_LIFT USED TO LIVE HERE, and its own docstring is why this file was wrong for a round. It
 * argued: "It is not a camera size, which is the thing this file is forbidden to remember: it is
 * where the shot is pointed." The rule was known and reasoned around -- and the shot was pointed
 * one tile too high, because the lift is only half of the answer. Purple's feet are one tile BELOW her
 * spawn object, so the camera centre is `spawn.y + 1 - 5/8`, not `spawn.y - 5/8`.
 *
 * A rectangle has four numbers; publishing two of them is not publishing the rectangle. The centre
 * now comes from `cameraCentreTiles()` in @otp/core along with the size.
 */
/** The camera's rectangle in TILES for one viewport, centred on a point and clamped to the map. */
const frameAt = (
  viewport: { width: number; height: number },
  centre: { x: number; y: number },
): Rect => {
  const { tiles } = cameraFor(viewport);
  const hold = (v: number, span: number, limit: number): number =>
    Math.min(Math.max(v - span / 2, 0), Math.max(0, limit - span));
  const x0 = hold(centre.x, tiles.width, MAP_W);
  const y0 = hold(centre.y, tiles.height, MAP_H);
  return { x0, y0, x1: x0 + tiles.width, y1: y0 + tiles.height };
};
/** Every whole tile column the rectangle shows any part of. */
const columnsOf = (r: Rect): number[] => {
  const out: number[] = [];
  for (let x = Math.floor(r.x0); x < Math.ceil(r.x1) && x < MAP_W; x++) if (x >= 0) out.push(x);
  return out;
};
/** Every whole tile row the rectangle shows any part of. */
const rowsOf = (r: Rect): number[] => {
  const out: number[] = [];
  for (let y = Math.floor(r.y0); y < Math.ceil(r.y1) && y < MAP_H; y++) if (y >= 0) out.push(y);
  return out;
};

/** The four tiles a tone can bleed across. Diagonals are not seams; only edges are. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * THE BANK TILE A CELL OF LAND NEEDS, read off its whole neighbourhood -- the four sides AND the
 * four diagonals -- given whether each of the eight neighbours is drawn as water.
 *
 *   one wet side                 the straight bank, `shore-w` etc.: the side in the name is the land
 *   two wet sides that meet      a POINT, `shore-nw` etc.: land holds the corner the two dry sides meet in
 *   no wet side, one wet corner  a COVE, `shore-cove-se` etc.: named for the corner the water reaches into
 *   nothing wet                  `null`: not a bank
 *
 * Anything else -- two OPPOSITE wet sides, three or four, two wet corners with no wet side, or a
 * wet corner on the far side from a wet edge -- is `'unresolved'`. The tileset has no tile for
 * those and the caller must not leave one on the map; see the corner pass.
 *
 * Exported so the map test can check the committed map cell by cell against the rule it was laid
 * by. The four-sides-only rule this replaces is the bank loop under the river, which still runs
 * first: every pass between there and the corner pass reads the ground it laid, and the forest they
 * plant is unchanged by this.
 */
export function bankFor(wetAt: (dx: number, dy: number) => boolean): string | null | 'unresolved' {
  const n = wetAt(0, -1);
  const s = wetAt(0, 1);
  const e = wetAt(1, 0);
  const w = wetAt(-1, 0);
  const corners = (['ne', 'nw', 'se', 'sw'] as const).filter((c) =>
    wetAt(c.endsWith('e') ? 1 : -1, c.startsWith('s') ? 1 : -1),
  );
  const sides = [n, s, e, w].filter(Boolean).length;
  if (sides === 0) {
    if (corners.length === 0) return null;
    return corners.length === 1 ? `shore-cove-${corners[0]}` : 'unresolved';
  }
  /** A wet corner is accounted for when one of the two sides it touches is wet. */
  const covered = corners.every((c) => (c.startsWith('n') ? n : s) || (c.endsWith('e') ? e : w));
  if (!covered) return 'unresolved';
  if (sides === 1) return e ? 'shore-w' : w ? 'shore-e' : s ? 'shore-n' : 'shore-s';
  if (sides === 2 && (n || s) && (e || w)) return `shore-${n ? 's' : 'n'}${e ? 'w' : 'e'}`;
  return 'unresolved';
}

export interface GeneratedMap {
  json: string;
  /** Where the map generator decided each landmark sits, in pixels. */
  landmarks: Record<string, { x: number; y: number }>;
}

export function generateForestMap(): GeneratedMap {
  const rnd = noise(20261016);
  const ground = blank();
  const below = blank();
  const above = blank();
  const collision = blank();

  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const set = (layer: Layer, x: number, y: number, tile: number): void => {
    if (inside(x, y)) layer[y * MAP_W + x] = tile;
  };
  const at = (layer: Layer, x: number, y: number): number =>
    inside(x, y) ? layer[y * MAP_W + x]! : 0;
  const solid = (x: number, y: number): void => set(collision, x, y, 1);
  const clear = (x: number, y: number): void => set(collision, x, y, 0);

  // --- grass base: broad patches of sun and shade, not per-tile static -------
  // The four variants are four brightness steps, chosen by a field that is correlated across
  // tiles. Picking one at random per tile is white noise: every tile differs from its neighbour,
  // and at any distance the whole field averages to one flat tone, which is what made the ground
  // read as a single green with stickers on it.
  /*
   * WHERE THE WOOD IS, AND -- the part that was missing -- WHERE IT IS NOT.
   *
   * This was two octaves of value noise, and the whole-map render showed why that can never work.
   * A smooth field offers nearly every tile on the map a tree at nearly the same probability, so
   * what you see is not the field at all: it is the tree's own FOOTPRINT tiling the plane. A tree
   * is a 2x1 trunk under a 2x2 crown, so greedy packing puts trunks on a two-column, three-row
   * lattice, and once the field is willing everywhere that lattice percolates from one edge of the
   * map to the other. Sixty columns of one drawing on a fixed pitch is wallpaper, and at whole-map
   * scale the alternating crown and trunk rows comb into corduroy.
   *
   * Jittering the field does not break the lattice, because the lattice is not in the field. Only
   * STOPPING breaks it. So the wood is grown from seeds with genuinely empty ground between them:
   * packing cannot percolate across a glade, every thicket settles into its own row phase, and the
   * map-wide banding has nowhere to form.
   *
   * Radii are drawn as a square, which spreads them over an order of magnitude -- a lot of copses
   * of three or four trees, a few woods a dozen tiles across -- rather than the third of a decade
   * the old field managed, which is what made every part of the map look like every other part.
   */
  const woodNoise = valueNoise2D(20261019);
  const lobe = valueNoise2D(20261029);
  /*
   * =============================================================================
   * THE WOODS ARE NAMED AND PLACED BY HAND. The density field is drawn, not rolled.
   * =============================================================================
   *
   * WHAT WAS HERE, AND WHY IT COULD NEVER BE RIGHT. Seventeen thickets at uniformly random
   * centres, with radii drawn from a squared uniform. Every previous pass tuned the COUNT and the
   * RADII and measured the result on the six-axis score, and the score cannot see composition and
   * says so. So what the tuning converged on is the thing that scores best and looks worst: blobs
   * of a similar size, at a similar spacing, over the whole 60x42 map. Counted on the render that
   * came out of it -- 288 trees, 960 canopy tiles, 38% of the world, a tree every third tile from
   * one edge to the other, canopy between 24% and 46% of every one of the seven cameras. A map
   * where every region is as wooded as every other region has no regions.
   *
   * The client's note is two sentences and they are one request: "all the trees need to be in the
   * correct place", "not too many trees". A tree is in the correct place when it is doing a job in
   * a frame -- closing the top of the camera, backing a landmark, hiding the edge of the world,
   * narrowing the road for a stretch -- and seventeen random discs cannot do a job, because nobody
   * told them what the jobs are.
   *
   * So the woods are a REGISTER, like the trees themselves. Each one is written down with the
   * frame it serves. Everything about the blob machinery below is unchanged and was right: the
   * lobe warp that turns a disc into a bay-and-spur outline, the cubic-and-a-half falloff that
   * gives a wood a closed middle and a definite edge, and the max over overlapping blobs that
   * merges two of them into one wood rather than a figure of eight. Only the centres are drawn
   * rather than rolled.
   *
   * MEASURED AGAINST THE BOARD, not against the last round. The board's Explore frame, classified
   * by hue and luma over its own art area, is 32% open bright grass; the spawn camera was 52%. The
   * two frames carry almost exactly the same mass of dark green (12.9% against 13.1%), so the gap
   * was never the quantity of tree. It is that the board's frame is FULL -- a waterfall, a river,
   * a bridge, boulders, a signpost, a cottage, a fence, a well and a forked path, all at once,
   * with canopy closing the top and the bottom -- and ours framed a lawn.
   */
  /**
   * The wood register. `why` is the frame each one is there to serve; it is not decoration, it is
   * the thing to check the render against when one of them is moved.
   *
   * y is compressed by 1.2 in the distance below, so a blob is about a fifth wider than it is
   * tall, which suits a letterbox camera (19.41 x 11.22 tiles; the ASPECT this reasoning depends
   * on is right, it was the tile COUNT that was a third too big): a wood that reads as a mass
   * across a frame reads
   * as a column down a portrait one.
   */
  const WOODS: ReadonlyArray<{ cx: number; cy: number; r: number; strength: number; why: string }> =
    [
      /*
       * ...AND THE MARGINS CAME DOWN TO PAY FOR THE MIDDLE.
       *
       * Rendered whole and counted: 1,121 canopy cells, 44 per cent of the map, with the trees
       * forming a continuous belt round the perimeter -- the top three rows, the bottom four, both
       * side columns -- and the entire band the player actually walks left as open lawn with
       * scattered scrub. The trees were where the player is not, which is why every camera framed a
       * lawn with a distant treeline, and it is also the whole of the client's "too many trees": a
       * tree in row 39 is paid for in density and seen by nobody.
       *
       * So every margin wood loses a tile or two of radius and a step of strength, and the saving is
       * spent on the SHOULDER WOODS and the four new woods in the walked band below. The border rim
       * a few dozen lines down came down with them; between them they are most of the reduction, and
       * none of it comes out of a frame anyone looks at.
       */
      // --- the north treeline: closes the top of the spawn, stall and fountain cameras ---------
      { cx: 5, cy: 5.5, r: 7.5, strength: 0.9, why: 'north-west block, top of the 375 portrait' },
      {
        cx: 15,
        cy: 3.5,
        r: 6,
        strength: 0.86,
        why: 'north treeline between the block and the falls',
      },
      { cx: 12.5, cy: 12, r: 5.2, strength: 0.86, why: 'the stall stands in a notch of this one' },
      { cx: 26, cy: 5, r: 6.5, strength: 0.88, why: 'the wood the waterfall comes out of' },
      { cx: 38, cy: 4.5, r: 6.8, strength: 0.89, why: 'north-central, top of the notice camera' },
      { cx: 50, cy: 5, r: 7.5, strength: 0.9, why: 'above the cottage: top of the arrival frame' },
      // --- the margins: the player must never see the end of the world ------------------------
      { cx: 1.5, cy: 14, r: 5.5, strength: 0.86, why: 'west margin, mid' },
      /*
       * The top-left of the spawn camera, which was a void. Rendered and measured: with the west
       * margin wood alone, x 0 to 10 of rows 13 to 18 came out as flat lit grass with one row of
       * crowns along the very top of the frame -- a comb at the edge of a lawn, which is the
       * arrangement the client called creepy and the board does not contain anywhere. This closes
       * the corner so the camera is framed on three sides and the glade opens to the south-east,
       * towards the road she is about to walk.
       */
      { cx: 3, cy: 16.5, r: 4.6, strength: 0.86, why: 'closes the top-left of the spawn camera' },
      /*
       * The west margin carried DOWN BEHIND PURPLE, which is the other half of the title screen's
       * complaint. The spawn camera is clamped to x 0, so the left column of the title frame is
       * always the edge of the world; with the margin wood stopping at row 18 and Purple's glade
       * subtracting below it, what the frame showed down that column was the sealed band itself --
       * the 2x6 block of near-identical bushes the review named. Canopy over the band is the only
       * thing that hides it, and it is what the file's own note on `sealBorder` says: where a wood
       * stands on the margin, the longest visible run of hedge is not the length of the band at all.
       */
      {
        cx: 1,
        cy: 21,
        r: 4.2,
        strength: 0.9,
        why: 'the west margin behind Purple, under her glade',
      },
      { cx: 58.5, cy: 10, r: 6, strength: 0.88, why: 'east margin, north' },
      { cx: 58.5, cy: 27, r: 6, strength: 0.88, why: 'east margin, south' },
      // --- the middle band: backs the landmarks and narrows the road in stretches --------------
      { cx: 29, cy: 14, r: 6, strength: 0.88, why: 'between the fountain glade and the garden' },
      {
        cx: 41,
        cy: 12.5,
        r: 5.5,
        strength: 0.85,
        why: 'behind the notice post, north of the road',
      },
      /*
       * THE SHOULDER WOODS. Small, and placed against the road on purpose, between the glades.
       *
       * The road is two tiles of sand; the verge sweep fells trees one tile either side of it so
       * it can be walked beside; and a crown stands two rows above its trunk. So the narrowest
       * light band the track can occupy is six or seven rows, and with nothing but glades along it
       * that band ran unbroken from one edge of the map to the other -- a pale stripe across the
       * middle of every frame, which is what a trunk road looks like from above. These bring the
       * treeline down to the verge in four places, so the walk alternates between a stretch with
       * wood close on one side and an opening, which is what makes a road feel walked rather than
       * surveyed. None of them can close it: `plantTree` refuses a path tile and refuses to hang a
       * crown over one, and the verge sweep fells anything that lands beside the sand anyway.
       */
      { cx: 19, cy: 18.5, r: 4.4, strength: 0.9, why: 'presses the road to a single lane once' },
      { cx: 10, cy: 24, r: 4.6, strength: 0.9, why: 'south shoulder, west of the crossing' },
      { cx: 21.5, cy: 23.5, r: 4.2, strength: 0.9, why: 'south shoulder, east of the crossing' },
      {
        cx: 33,
        cy: 16.5,
        r: 4,
        strength: 0.8,
        why: 'north shoulder, between the river and the gate',
      },
      { cx: 39.5, cy: 23, r: 4.4, strength: 0.88, why: 'south shoulder, below the notice' },
      /*
       * ===========================================================================
       * FOUR WOODS IN THE BAND THE PLAYER WALKS. This is where the margins' tiles went.
       * ===========================================================================
       *
       * The spawn camera is rows 13 to 27 and the arrival camera rows 8 to 22, and between them
       * they are most of what anybody ever sees. Before these, rows 14 to 20 across the middle of
       * the map carried the road, the market, the signpost and nothing else -- a pale band from one
       * edge of the frame to the other with a treeline on the horizon. The board plants its trees
       * AMONG its landmarks: in its Explore frame a crown touches the cottage wall, another stands
       * between the signpost and the owl, and the top and bottom of the frame are both closed by
       * canopy that is cut off by the edge.
       *
       * These are small, because a wood in the walked band has to leave the walk walkable and the
       * landmark readable. They sit in the gaps BETWEEN the glades rather than against them, so
       * each one closes a stretch of the frame without touching the clearing either side of it.
       */
      /*
       * THEY ARE STRONGER THAN THE SHOULDER WOODS ABOVE, and the arithmetic is the reason rather
       * than a preference. Planting needs `want` at 0.44, and `want` is `strength * (1 - d^3.5)`
       * with a warp of up to a quarter on `d`, so a wood at strength 0.8 plants only inside about
       * 0.8 of its own radius and the warp can take a whole lobe of it below the floor. The first
       * attempt at these put them in at r 2.8 to 3.4 and strength 0.84, and the render showed two or
       * three trees apiece -- a wood that exists in the register and not in the frame. At 0.9 and a
       * tile more radius each they come out as stands of six to ten, which is what closes an edge.
       */
      { cx: 9, cy: 15.5, r: 3.8, strength: 0.9, why: 'top of the spawn camera, left of centre' },
      { cx: 15, cy: 14.5, r: 3.2, strength: 0.9, why: 'top of the spawn camera, centre' },
      /*
       * ===========================================================================
       * THE TWO THAT CLOSE THE TOP OF THE SPAWN FRAME, which nothing did.
       * ===========================================================================
       *
       * Rendered at the spawn and read row by row: the camera is rows 13 to 27, and its top row
       * carries wood from x 0 to 7, then the footpath, then open lawn from x 12 to 21 with only the
       * fountain in it. So the one frame a visitor sees first is open along most of its top edge --
       * and a bright field with the sky showing above it is the arrangement the client called
       * creepy. Every board frame is CUT OFF by canopy at the top, which is what tells you the
       * forest carries on past the camera instead of ending at it.
       *
       * They sit between the market glade and the fountain glade rather than against either, so
       * neither landmark loses its clearing: the market's counter row and the fountain's own glade
       * are both outside these at their stated radii. The footpath to the owl runs through this
       * ground and is unaffected -- the planter refuses a path tile and refuses to hang a crown over
       * one, so a wood laid across a track simply grows up to both sides of it.
       */
      {
        cx: 17,
        cy: 15.5,
        r: 3.2,
        strength: 0.9,
        why: 'closes the top of the spawn camera, centre',
      },
      { cx: 21, cy: 14.5, r: 3.4, strength: 0.9, why: 'closes the top of the spawn camera, right' },
      {
        cx: 23.5,
        cy: 14,
        r: 3.4,
        strength: 0.9,
        why: 'top of the spawn camera, above the west bank',
      },
      { cx: 21, cy: 17, r: 3.8, strength: 0.88, why: 'between the market and the fountain glade' },
      { cx: 29.5, cy: 22, r: 3.8, strength: 0.88, why: 'the east bank below the bridge' },
      /*
       * West of the fence on purpose. Its effective radius is about two and a half tiles, so a
       * centre any further east would plant trunks at x 47 and 48 -- inside Grandma's enclosure,
       * where the fence strikes off whatever it runs over and the rest stands in her garden.
       */
      {
        cx: 43.5,
        cy: 16.5,
        r: 3.4,
        strength: 0.88,
        why: 'presses the gate approach from the north',
      },
      // --- the south treeline: closes the bottom of the spawn, well and lantern cameras --------
      { cx: 3.5, cy: 29, r: 6.8, strength: 0.9, why: 'south-west, bottom of the 375 portrait' },
      { cx: 16.5, cy: 27.5, r: 6, strength: 0.89, why: 'bottom of the spawn camera, centre' },
      { cx: 9, cy: 37, r: 6.5, strength: 0.86, why: 'south margin, west' },
      { cx: 23, cy: 35, r: 7, strength: 0.88, why: 'south-central block' },
      { cx: 35, cy: 38.5, r: 6, strength: 0.85, why: 'south margin, below the lantern glade' },
      { cx: 47, cy: 34, r: 6.5, strength: 0.86, why: 'south-east, below the garden' },
      { cx: 44, cy: 25, r: 5.5, strength: 0.85, why: 'backs the well glade from the east' },
    ];
  /**
   * ...AND THE GLADES, which is the half the old field had no way to express.
   *
   * A density field built from maxima can only ever ADD wood, so the only clearings it could
   * produce were the gaps left where no blob happened to reach -- which is why the clearings came
   * out the same size and the same shape as the woods, and why the one place a player stands at
   * the start of the game was a lawn. A glade has to be stated.
   *
   * These subtract, with the same lobe warp on their outline, so a glade has bays too and its edge
   * is a treeline rather than a traced circle. The landmark clearings further down the file still
   * run: `clearArea` is a rectangle that wipes decor for a building's footprint, which is a
   * different job from a glade. This is the open ground the wood is asked to leave round them.
   */
  const GLADES: ReadonlyArray<{ cx: number; cy: number; r: number; why: string }> = [
    { cx: 7, cy: 21, r: 3.4, why: 'where Purple is standing when the game starts' },
    { cx: 13, cy: 18.5, r: 2.8, why: 'the ground in front of the market stall' },
    /*
     * Smaller than it was, by a tile. At 4.6 it was centred on row 13 and so held the wood off rows
     * 11 to 15 across eight columns -- which is the entire top edge of the spawn camera, and the
     * reason that frame opened on a lawn with no canopy over it. The fountain, the owl's tree and
     * the end of the footpath all fit in 3.6, and the clearing still reads as a clearing because the
     * wood round it is now the thing closing the top of the frame.
     */
    { cx: 19, cy: 12.5, r: 3.6, why: 'the fountain glade and the owl' },
    { cx: 25, cy: 20.5, r: 3.6, why: 'the reach the bridge crosses' },
    { cx: 34.5, cy: 26.5, r: 6, why: 'the well glade: the biggest hole in the wood' },
    { cx: 36.5, cy: 32, r: 4.2, why: 'where the Lantern Keeper is met' },
    { cx: 44, cy: 20, r: 3.4, why: 'the gate approach and the forest notice' },
    /*
     * Smaller than the garden, on purpose. A glade the size of the enclosure would hold the wood
     * off every side of the house; the board's Arrive frame has canopy touching the walls. This
     * keeps the lane and the lawn either side of the door open and lets the east margin wood stand
     * behind the cottage, which is where the frame needs its right-hand edge closed.
     */
    { cx: 51, cy: 18, r: 5.2, why: "the lane and the lawn either side of Grandma's door" },
  ];
  /** Each blob warps its own outline, so no two are the same shape. */
  const phases = [...WOODS, ...GLADES].map(() => rnd() * 64);
  /** The warped, normalised distance from a blob's centre: under 1 is inside it. */
  const reachOf = (
    blob: { cx: number; cy: number; r: number },
    phase: number,
    x: number,
    y: number,
  ): number => {
    /*
     * The radius is warped by a fine field before it is compared, which turns a disc into a
     * lobed blob with bays and spurs. A circle of trees reads as an orchard; and two overlapping
     * blobs with different warps merge into one wood rather than into a figure of eight.
     */
    const warp = (lobe(x / 4.4 + phase, y / 4.4) - 0.5) * 0.52;
    return Math.hypot(x - blob.cx, (y - blob.cy) * 1.2) / blob.r + warp;
  };
  const woodAt = (x: number, y: number): number => {
    let best = 0;
    for (const [i, t] of WOODS.entries()) {
      const d = reachOf(t, phases[i]!, x, y);
      if (d >= 1) continue;
      /*
       * Flat across the middle and falling off a cliff at the rim, rather than the dome a squared
       * falloff gives. A dome spends most of its area at half strength, which plants one tree in
       * three or four over a very wide skirt -- scatter, which is what the first attempt at this
       * rendered: the map went from dense wallpaper to sparse wallpaper, canopies never touched,
       * and the dark mass the wood is supposed to provide went with them. A wood needs a closed
       * middle and a definite edge, which is this curve.
       */
      best = Math.max(best, t.strength * (1 - d ** 3.5));
    }
    /*
     * The border is wood too, so the player cannot see the end of the world -- but its DEPTH
     * wanders, and that is a correction rather than a flourish. At a constant five tiles the band
     * packed solid all the way round the map, and a solid band of a 2x3 footprint is a perfect
     * lattice: once the thickets stopped producing corduroy in the middle, the border was by a
     * long way the most regular thing left in the frame, four straight combs of trees framing it.
     * Letting the treeline come and go between two and eight tiles deep breaks the packing into
     * separate runs and gives the edge of the map bays and headlands instead of a hedge.
     */
    /*
     * ...AND IT IS SHALLOWER THAN IT WAS, for the reason the margin woods are smaller: a band that
     * wanders between two and six and a half tiles deep, all the way round a 60x42 map, is on its
     * own about a fifth of the world in canopy, and the great majority of those tiles are in rows
     * and columns no camera ever frames. One and a half to four and a half still hides the end of
     * the world -- the seal below guarantees that outright -- and gives the saving to the middle.
     */
    /*
     * ...AND IT COMES DOWN AGAIN, TO PAY FOR THE WOOD ALONG THE ROAD.
     *
     * The scale mix, the sapling infill and the road's own treeline together took the map from 37.6
     * to 45.9 per cent canopy, against a client note that already said there were too many trees.
     * That note and the extra canopy are not in conflict, and the file has written down why once
     * before: "a tree in row 39 is paid for in density and seen by nobody". Every tile the three
     * passes added is in the band the camera frames -- beside the track, inside a mass, closing the
     * top of the spawn frame -- and the cheapest tiles on the map to give back are the ones in the
     * border rim, which exists only so the player cannot see the end of the world.
     *
     * It can be given back safely because the rim is not what seals the map. `sealBorder` plants the
     * outermost rows and columns outright and runs twice, after every pass that can open a cell, so
     * the edge of the world is closed whatever this does. The rim behind it is picture, and two and
     * a half tiles of it is as much picture as four and a half.
     */
    const toEdge = Math.min(x, y - 2, MAP_W - 2 - x, MAP_H - 2 - y);
    const depth = 1.1 + lobe(x / 9.5, y / 9.5) * 2.4;
    /*
     * ...and its DENSITY wanders too, right down to nothing, which is what finally breaks the
     * bottom of the map. Measured on the trunk rows, row 40 carried 23 trunks and rows 37 to 39
     * carried 17, 14 and 19: the outermost usable row is at the same distance from the edge for
     * its whole length, so a rim of constant strength plants it solid and prints a full-width
     * tonal wall under the frame. Letting the strength fall below the planting floor over whole
     * stretches gives the treeline headlands and bays instead of a hem, and the bush border below
     * keeps the edge of the world sealed wherever the trees stand back.
     */
    const rimStrength = 0.2 + lobe(x / 5.5 + 13, y / 5.5 + 13) * 1.1;
    /*
     * Capped below 1 on purpose, so even the outermost row is planted at a shade under certainty
     * and the band keeps gaps in it. Forced to full density the border packed solid, and a solid
     * band of a 2x3 footprint is a perfect comb; at five tiles deep on a map this size that comb
     * was a third of every frame, which made the border, not the wood, the most regular thing in
     * the picture.
     */
    const rim =
      toEdge <= depth ? Math.min(0.95, rimStrength) * (1 - Math.max(toEdge, 0) / (depth + 1.5)) : 0;
    const wood = Math.max(best, rim);
    if (wood <= 0) return 0;
    /*
     * A GLADE WINS, and it wins over the border rim too.
     *
     * Subtracting rather than multiplying, and subtracting the glade's own falloff, is what keeps
     * the treeline round a clearing from being a traced curve: the wood thins towards the glade
     * over two or three tiles, so the planting floor below cuts the outline somewhere different
     * along every stretch of it. Full strength at the glade's core means a clearing is genuinely
     * empty -- Purple's own glade and the well's are places with nothing in them, which is what makes
     * the thing that IS in them readable from across the frame.
     */
    let cut = 0;
    for (const [i, g] of GLADES.entries()) {
      const d = reachOf(g, phases[WOODS.length + i]!, x, y);
      if (d >= 1) continue;
      cut = Math.max(cut, 1 - d ** 2.2);
    }
    return Math.max(wood - cut, 0);
  };

  /*
   * ===========================================================================
   * THE GRASS RAMP IS MEASURED OFF THE PAINTED TILES. IT USED TO BE THEIR ORDER IN `TILE_NAMES`.
   * ===========================================================================
   *
   * Three passes in this file -- the cast shadow, the road keyline and the penumbra sweep -- treat
   * the four grass variants as a BRIGHTNESS RAMP and only ever walk a tile DOWN it. Every one of
   * them asked `grassStep` which rung a tile was on, and `grassStep` answered with the variant's
   * INDEX: `grass-0` is rung 0, `grass-1` is rung 1, and so on. That is a contract between this
   * file and `tiles/w-ground.ts`, and nothing anywhere checked it.
   *
   * It has not been true for at least a round. Measured off the tiles the game actually loads, the
   * four variants are 161.4 / 156.8 / 162.1 / 162.3 mean luma, so `grass-1` is the DARKEST of the
   * four and `grass-0` -- the rung every pass here drives its deepest shade to -- is 4.6 luma
   * BRIGHTER than it. A cast shadow laid on a `grass-1` tile therefore made the ground lighter, and
   * it did so under every trunk on the map that happened to stand on that variant, which is 1,268
   * of the 2,151 grass tiles. The twenty-five lines of comment on the cast-shadow pass below quote
   * "123, 148, 164, 170" for the same four tiles; no such tile exists in the sheet and no test
   * could see that, because the ramp was an assumption about an array's order.
   *
   * So the order is MEASURED. Each grass painter is run once into a 32x32 raster and the four gids
   * are sorted by mean luma, darkest first. A painter may now reorder, rename or re-tune its
   * variants and the shade passes follow it; what they can no longer do is disagree silently.
   *
   * WHAT THIS DOES NOT FIX, said plainly because the number is the headline of this whole area: the
   * ramp is 5.4 luma wide end to end (156.8 to 162.3). Sorting it stops a shadow BRIGHTENING the
   * ground; it cannot make one visible, because the darkest tile in the set is five luma below the
   * lightest. Nine hundred trees and the cottage still cast a shadow no player can see. Widening
   * the ramp is `tiles/w-ground.ts`'s -- `BANDS` is where a variant's tone is decided -- and
   * `RAMP_SPAN_FLOOR` below is the ratchet that stops it narrowing further in the meantime.
   */
  const GRASS_VARIANTS = ['grass-0', 'grass-1', 'grass-2', 'grass-3'] as const;
  /** The mean luma of a painted tile, which is what a tile swap moves the ground by. */
  const tileLuma = (name: string): number => {
    const img = new Img(TILE, TILE);
    TILE_PAINTERS[name]!(img);
    let sum = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) sum += lumaOf(img.get(x, y));
    return sum / (TILE * TILE);
  };
  const grassRamp = GRASS_VARIANTS.map((name) => ({ name, gid: gid(name), luma: tileLuma(name) }))
    .slice()
    .sort((a, b) => a.luma - b.luma);
  /** The four grass gids, DARKEST FIRST. Rung 0 is the deepest shade this file can lay. */
  const grassTiles = grassRamp.map((r) => r.gid);
  /** Where a gid sits on the grass ramp, so the shade pass can walk a tile down it. */
  const grassStep = new Map<number, number>(grassTiles.map((g, i) => [g, i]));
  const sun = valueNoise2D(20261017);
  /** Uncorrelated per tile: `valueNoise2D` samples its own hash exactly on integer coordinates. */
  const speckle = valueNoise2D(20261023);
  /**
   * Patch size, in tiles. Big, and bigger than it was.
   *
   * At 9.5 with a strong two-tile octave on top, the field changed its mind every tile or two and
   * the four grass variants came out as a checkerboard of light and dark squares -- the tile grid
   * drawn in the one place it was meant to be hidden, and visible from across the room once the
   * wood was dense enough to frame it. Broad patches with only a gentle fine octave give the
   * meadow light moving across it instead, which is what the board shows.
   */
  /*
   * Changed again, from 17 -- DOWN, not up, which is what this line used to say. It went 9.5, then
   * 17, then the 14.5 below, and the next paragraph explains why the middle move was overshot:
   * raising PATCH makes the lattice artefact WORSE, so the fix for the rectangles was a rotated,
   * warped sample frame rather than a broader field. The reason for moving off 9.5 in the first
   * place still stands, and it is this: the ground painter's four grass variants are further apart in
   * tone than they were and a field tuned to the old spread no longer holds. The chequerboard this
   * guards against is not a property of the field alone: it is the field's amplitude AT TILE SCALE
   * multiplied by however far apart the two tones either side of a threshold happen to be. When
   * the painter widens that gap, a field that was comfortably sub-threshold starts printing the
   * tile grid across every open stretch of meadow on the map -- which is what the render showed
   * the moment the new grass landed. Broader patches, a weaker fine octave and less jitter put the
   * crossings back to a handful per region instead of one every tile or two, and they do it in a
   * way that stays right whatever the painter does next.
   */
  /*
   * ...AND THE REASON IT STILL CAME OUT AS RECTANGLES.
   *
   * The whole-map render showed large blocks of a single grass variant with axis-aligned straight
   * edges in the lower-left and lower-centre -- long runs of one identical tile in both directions
   * at once. That is not the field being too coarse, it is the field's LATTICE showing through.
   * `valueNoise2D` interpolates a grid of random values, so at a 30-tile period a 60x42 map holds
   * barely two cells by one and a half, the cell boundaries sit on exact multiples of 30 -- x=30,
   * y=30 -- and the iso-lines of a bilinear patch run parallel to those axes near the corners.
   * Quantise that into four bands and the bands come out as rectangles with their sides on the
   * tile grid, which is the one artefact a ground field must never produce.
   *
   * Raising PATCH further makes it worse, not better: fewer lattice cells means more of the map
   * sits in the region where the interpolation is effectively linear in x and y.
   *
   * Two changes fix it without touching the amplitude at tile scale, which is what the
   * chequerboard above is sensitive to:
   *
   *   1. SAMPLE ON A ROTATED FRAME. The lattice still exists, but none of its edges runs along a
   *      tile row or column any more, so a band boundary crosses the grid at an angle and reads as
   *      an edge of a patch rather than as a seam in the map.
   *   2. WARP THE DOMAIN. Displacing the sample point by a second, broad field bends straight
   *      iso-lines into bays and promontories. This is the part that abolishes the rectangle: a
   *      warped bilinear patch has no straight contours left anywhere. It costs nothing at tile
   *      scale because the warp field itself is broad -- it moves neighbouring tiles by almost the
   *      same amount, so the field they read is as smooth as it was.
   *
   * Three octaves at non-harmonic periods then stop the surviving lattice from repeating on
   * itself: weights 0.5, 0.35 and 0.15 at periods of PATCH, 7.3 and 3.9 tiles. The finest is
   * deliberately the weakest. Measured over the whole map on 2026-10-20, it moves the total by at
   * most 0.096 between two neighbouring tiles -- it bends a band boundary and cannot cross one on
   * its own, which is the property that matters. (This paragraph said "an octave of 0.1 at a
   * six-tile period swings the total by under 0.02". Neither the weight, the period nor the swing
   * was the one in the code; the conclusion drawn from them happens to survive the real numbers,
   * which is luck and not a reason to leave them standing.)
   */
  const PATCH = 14.5;
  /** A shade over 31 degrees: no small whole-number ratio, so the lattice never lines up twice. */
  const COS_A = 0.8572;
  const SIN_A = 0.515;
  const warp = valueNoise2D(20261037);
  const light: number[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      /*
       * The finer octaves keep the patch edges from looking like contour lines -- but only just.
       * Carrying a sixth of the field at a period of two tiles or so swung the total by about half
       * a band, which meant that over any broad stretch of ground the field crossed a threshold and
       * crossed back every few tiles, and the four grass variants came out interleaved tile by
       * tile. Two greens this far apart, alternating at 32px, is a chequerboard however the choice
       * between them is made: it is the AMPLITUDE at tile scale that does it, not the dither.
       *
       * What fixed it was the PERIOD, not the weight. The finest octave below still carries 0.15 --
       * about a sixth of the total, which is where this note used to claim the fault was -- and at
       * a 3.9-tile period it moves the total by at most 0.096 between neighbours (measured, whole
       * map). It bends a boundary and cannot cross one on its own.
       */
      const wx = x + (warp(x / 9, y / 9) - 0.5) * 12;
      const wy = y + (warp(x / 9 + 37, y / 9 + 37) - 0.5) * 12;
      const rx = wx * COS_A - wy * SIN_A;
      const ry = wx * SIN_A + wy * COS_A;
      const octaves =
        sun(rx / PATCH, ry / PATCH) * 0.5 +
        sun(rx / 7.3 + 53, ry / 7.3 + 53) * 0.35 +
        sun(rx / 3.9 + 91, ry / 3.9 + 91) * 0.15;
      /*
       * A 17-tile octave across a 60x42 map is barely three lattice cells wide, so its realised
       * mean and range are whatever those dozen lattice samples happened to be for this seed, not
       * the 0.5 the maths promises. Cutting it at fixed thresholds put 1673 of 2166 ground tiles
       * on the same variant: four grass tones in the tileset and one of them on the map, which is
       * as flat as the chequerboard was loud, and a change of seed would have moved it somewhere
       * else just as arbitrary. The thresholds are taken from the field's own quantiles instead,
       * below, which fixes what SHARE of the map each tone covers and leaves the field to decide
       * where. Broad regions, every tone used, and no seed can undo it.
       */
      /*
       * Ground under the wood is in shade -- but read off a field of its OWN, deliberately much
       * broader than the one that plants the trees.
       *
       * Sharing `woodAt` was the obvious thing and it was wrong. That field is high exactly where
       * the trees are, so the ground went a step darker exactly on the tiles a tree stood on, and
       * every tree came out sitting in its own hand-drawn dark square. It outlined the wood at
       * tile resolution instead of shading it. An 18-tile octave with no rim term moves slowly
       * enough that nothing on the map can be traced in it.
       */
      const v = octaves - (woodNoise(x / 18, y / 18) - 0.5) * 0.4;
      /*
       * Jitter on the threshold, so the boundary between two grass variants scatters instead of
       * running along a straight line of tile edges.
       *
       * This used to be an ordered Bayer dither, and ordered dithering is the right tool when the
       * thing being dithered is a PIXEL. Here it is a whole 32px tile, which makes the 4x4 matrix
       * a 128px repeating weave -- and once the field above was smoothed out, broad stretches of
       * the map sat near one threshold at once and printed that weave across the open ground as a
       * checkerboard, several screens wide and visible from across the room. It was the single
       * most conspicuous thing left on the map, and it was the anti-grid measure drawing a grid.
       *
       * Per-tile white noise flips exactly the same tiles -- only ones already within a hair of a
       * boundary -- and has no repeating structure of its own to show through.
       */
      light.push(v + (speckle(x, y) - 0.5) * 0.01);
    }
  /*
   * Shares of the ground, darkest first -- now weighted hard towards the MIDDLE two tones.
   *
   * Measured off the painters, the four grass variants mean luma 147.6, 163.5, 176.6 and 187.2:
   * steps of 16, 13 and 11. A 16-luma step across a hard, grid-aligned, 32-pixel edge is plainly
   * visible, and the old shares put a third of the map on grass-0, which made that biggest step
   * also the most common boundary on the map. Every open stretch of meadow came out chequered.
   *
   * Pushing most of the ground onto grass-1 and grass-2 leaves the common boundary the smallest
   * of the three and keeps the darkest and lightest as accents, where they read as shade and
   * sunlight rather than as tiling. It costs nothing measurable: at 147.6 even the darkest grass
   * is far above the deep-shade threshold, so none of this moves that axis either way.
   *
   * This is mitigation and not a cure. Four tones spread over 40 luma cannot be laid on a tile
   * grid without the grid showing somewhere; the real fix is for the ground painter to narrow the
   * steps between the variants and carry the variation inside each tile instead. Flagged.
   */
  /*
   * TWO fields at two scales, and which one is allowed to do what is decided by how far apart the
   * tones it chooses between are.
   *
   * Cutting one field into four bands is what tied the map in a knot for three rounds. A broad
   * field gives huge regions with the lattice showing as rectangles; a fine one gives a quilt of
   * 32px squares, because the variants WERE 25, 16 and 6 luma apart -- they are 4.6, 0.7 and 0.2
   * apart as the sheet ships today, see the ramp note above -- and a
   * 25-luma step on a hard tile edge is a drawn line whatever decides where it goes. Every setting
   * in between trades one fault for the other -- measured over a sweep, fragmenting the field from
   * 11 regions to 94 took the share of tiles differing from BOTH their neighbours from 0.2% to
   * 6.1%, and 6% of 2400 tiles is a visible weave.
   *
   * The way out is that the four tones are NOT evenly spaced. grass-2 and grass-3 are six luma
   * apart, which at 32px is below the threshold where an edge reads as an edge at all. So the
   * broad field cuts three bands -- shade, middle, sun -- and carries all the steps big enough to
   * see, at a scale where they read as weather rather than as tiling; and a FINE field dapples the
   * sunlit band between its two tones only, where the step it makes is invisible as a grid and
   * still counts as a different tile to a cell hash and as a different value to the eye at a
   * distance.
   *
   * This is the mitigation the previous pass flagged and could not reach: fine variation in the
   * open meadow, with no fine-scale boundary anywhere that is big enough to draw the grid.
   */
  const dapple = valueNoise2D(20261043);
  /*
   * THE FIELD STARTS LIGHTER THAN IT USED TO, because three later passes only ever darken.
   *
   * These were 0.2 and 0.56 -- a fifth of the ground on the darkest rung, a third on the next, and
   * the rest in the sunlit band. Counted on the finished map, what actually shipped was 45% on
   * grass-0, 34% on grass-1 and 5.6% on grass-2 and grass-3 together: four tones in the tileset and
   * two of them effectively unused. The cause is not this cut, it is everything after it. The tree
   * shadows clamp to rungs 0 and 1 over every tile a crown stands on, the road keyline walks the
   * whole verge down a rung or two, and the penumbra sweep then drops any tile more than one rung
   * above its darkest neighbour -- so the sunlit band is eaten from every side and only survives in
   * the middle of a glade.
   *
   * Starting a notch lighter gives those passes something to take. It is also free on the axis that
   * matters most: the darkest grass is nowhere near the deep-shade threshold of 81 whatever rung it
   * is on, so no rung of grass counts as deep shade whatever share it has, and the measured deep
   * shade comes from the canopy and the keylines. What it buys is luma SPREAD -- the gap between a
   * shaded wood floor and a sunlit clearing -- which is the axis sitting at 0.79 of the board's.
   *
   * THE SECOND HALF OF THIS NOTE QUOTED RUNGS OF 104, 143, 163 AND 174 and argued that moving share
   * off rung 0 made a 39-luma seam rarer. There is no 39-luma seam and there has not been one for
   * at least a round: the four rungs are measured at the top of this block and span 5.4 luma in
   * total. The argument for the cut still stands -- the later passes only ever darken, so the field
   * has to start with something for them to take -- but it buys spread only to the extent that the
   * ramp has any, and today it has almost none. See `RAMP_SPAN_FLOOR`.
   */
  /*
   * ...AND THEY CAME DOWN AGAIN, by a notch, and the honest note is that a notch is all they are
   * worth. `docs/DESIGN_BOARD.md` asks for the four-variant scheme of `ART_DIRECTION` section 6.3
   * to be "in effect" and gives the measurement: 58% of the ground on grass-1, 1.5% on grass-3.
   * Moving this cut moves it by about two points and no further, and the reason is structural
   * rather than a tuning failure, so it is written down here rather than tuned at again next round.
   *
   * THIS FILE USES THE FOUR VARIANTS AS A BRIGHTNESS RAMP, not as four interchangeable textures.
   * Section 6.3 describes four tiles that differ in tuft count and mottle and asks the map to
   * scatter them; the cast-shadow pass, the road keyline and the penumbra sweep all CLAMP a tile to
   * a rung of that ramp by meaning -- trunk and pool to rung 0, crown rows to rung 1, verge and
   * east fringe to rung 2 -- and every one of them only ever walks a tile DOWN. Measured on the
   * finished map, canopy covers 43% of the world and half of every grass tile on it lies under a
   * crown, so rung 1 is most of the map whatever this cut says.
   *
   * Over the ground a player can actually SEE -- grass with no crown over it, which is the half the
   * frame is made of -- the same map reads 36 / 46 / 15 / 4, which is a four-variant distribution.
   * The headline number is dominated by tiles nobody looks at. The real lever on it is fewer trees,
   * and the one place this file can give canopy back is the border rim; that was tried this round
   * and reverted with the measurement, because at a shallower rim the treeline stops covering the
   * sealed band and the audit fails on a sixteen-tile hedge along column 59. Flagged for the owner
   * of the shadow ramp rather than fixed here.
   */
  const cut = [0.12, 0.38].map((q) => {
    const sorted = [...light].sort((a, b) => a - b);
    return sorted[Math.floor(q * (sorted.length - 1))]!;
  });
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const v = light[y * MAP_W + x]!;
      const band = v < cut[0]! ? 0 : v < cut[1]! ? 1 : 2;
      const lit = dapple(x / 3.1, y / 3.1) * 0.7 + dapple(x / 1.7 + 61, y / 1.7 + 61) * 0.3;
      set(ground, x, y, grassTiles[band === 2 && lit > 0.42 ? 3 : band]!);
    }

  // --- the river -------------------------------------------------------------
  /*
   * A meander, not a canal. The old curve was two sines, and its dominant term had a period of
   * forty-four rows on a map forty-two rows tall -- barely half a wavelength end to end, which is
   * a gentle lean, not a bend. Fixed at 1.6 half-width on top of that, it rendered as a dead
   * straight blue stripe down the middle of the map with two parallel grey walls beside it.
   *
   * What makes water read as a river is a SHORT and IRREGULAR period and a width that changes:
   * a pool, then a narrows, then a pool. So the centre line is value noise at about a ten-row
   * wavelength with a finer octave on top, and the half-width is a field of its own.
   */
  const bend = valueNoise2D(20261031);
  /*
   * How free the river is to wander at this row, and the reason there is a bridge HERE.
   *
   * The crossing is the one place on the map where the river's shape is load-bearing rather than
   * decorative: the deck spans a fixed five columns on both of its rows, the track must meet sand
   * squarely at each end of it, and `map.test.ts` fails the build if any other row of track runs
   * into the water. A river mid-meander at the crossing breaks all three. Damping the wander and
   * the width to nothing across the crossing rows means the two can never disagree -- and a river
   * that runs straight and narrow at exactly the point it is bridged is what a ford looks like,
   * so the constraint and the drawing want the same thing.
   */
  const meanderFreedom = (y: number): number => {
    const fromCrossing = Math.abs(y - 20.5);
    return fromCrossing <= 3 ? 0 : Math.min((fromCrossing - 3) / 4, 1);
  };
  /*
   * THE RIVER RUNS DIAGONALLY, and that is the single change that unquarters the map.
   *
   * It used to wander about a fixed mean of 26 on a map 60 wide -- a vertical stripe through the
   * middle -- while the track ran left to right through the middle, so the level was drawn as a
   * plus sign and each of the four quadrants looked like the other three. A previous pass reported
   * this fixed by widening the meander, and the whole-map render shows it was not: a wander of
   * seven columns about a constant mean is still, at a glance, a vertical line.
   *
   * What breaks a vertical line is a TREND, not more noise. The water enters at the top right and
   * leaves at the bottom left, so it crosses the track once, at a slant, well off centre, and the
   * four regions it cuts the map into are four different shapes and four different sizes.
   */
  const riverTrend = (y: number): number => 32.5 - y * 0.4;
  /*
   * ...WITHIN A CORRIDOR, because a river that wanders twelve columns on a map this small will
   * eventually run through the market, the fountain glade or the well, and a landmark standing in
   * the water is a bug no test here would catch: `clearArea` wipes the decor layers and the
   * collision, and leaves the ground exactly as it found it.
   *
   * The limits are soft rather than clipped. A hard `Math.max` would park the river against the
   * limit for a run of rows, which is a straight vertical edge -- the very thing being removed.
   * This eases the last three columns asymptotically instead, so the water bends away from a glade
   * the way it would bend away from a bluff and never quite reaches it.
   */
  /** How wide the asymptotic easing is, in tiles. Both calls below used the default; it is named
   * here rather than offered as a parameter nothing ever passes. */
  const EASE_K = 3.2;
  const nearLimit = (v: number, limit: number, sign: number): number => {
    const slack = (v - limit) * sign;
    return slack > EASE_K ? v : limit + sign * EASE_K * Math.exp((slack - EASE_K) / EASE_K);
  };
  /** The furthest east the water may reach: short of the well glade, and of Grandma's garden. */
  const westOf = (y: number): number => (y >= 34 ? 30 : y >= 22 ? 26.5 : y >= 8 ? 34 : 42);
  /** The furthest west: short of the fountain glade, the owl's fork and the market. */
  const eastOf = (y: number): number => (y >= 22 ? 12 : y >= 8 ? 25.5 : 20);
  const centreCache = new Map<number, number>();
  const heldCentre = (y: number): number => {
    const wander = (bend(0, y / 5.1) - 0.5) * 11.5 + (bend(31, y / 2.3) - 0.5) * 3.4;
    const free = riverTrend(y) + wander * meanderFreedom(y);
    return nearLimit(nearLimit(free, eastOf(y), 1), westOf(y), -1);
  };
  /*
   * ===========================================================================
   * THE JOIN UNDER THE DECK: THE RIVER LEAVES THE BRIDGE ONE COLUMN A ROW, NOT THREE AT ONCE.
   * ===========================================================================
   *
   * The client, 2026-10-22, on a screenshot of the crossing: "fix little rocks here by the under the
   * bridge. I'd make it a little cleaner." What they were looking at was a three-column step in the
   * water directly below the deck. Both limits above change at row 22 -- `eastOf` lets go of the
   * owl's fork (25.5 -> 12) and `westOf` takes up the well glade (34 -> 26.5) -- and rows 18 to 23 are
   * the damped crossing, where nothing is allowed to wander, so the river did all its moving in one
   * row: water at columns 25-28 under the planks and 22-25 the row after. Measured off the map, that
   * left `shore-s` at (27,22) and (28,22) with NO water north of them -- a strip of waterline and two
   * boulders drawn against the underside of the deck, the "little rocks" -- and the track's own sand
   * at (22,21) and (23,21) meeting open water across a bare tile edge, with no bank at all.
   *
   * So the rows between the last plank and the first row the limits are settled on are a straight
   * blend of the two, which is a staircase of one column a row: the same step the river takes
   * everywhere else it runs on the diagonal, and a step the four shore tiles can draw.
   *
   * THE ROW COUNT IS HELD, ON PURPOSE. Rows 22 and 23 are inside the damped crossing, where the
   * half-width is exactly 2, so a fractional centre gives four water cells a row whatever the blend
   * does -- and the water loop below draws one `rnd()` per water cell, in row order, so the same count
   * keeps every draw after it where it was and the rest of the forest does not reshuffle. Moving the
   * join outside the damped rows would change that count and replant the wood.
   */
  /** The last row the deck's line holds, and the first row the downstream limits are settled on. */
  const JOIN = { from: 21, to: 24 } as const;
  const riverCentre = (y: number): number => {
    const hit = centreCache.get(y);
    if (hit !== undefined) return hit;
    const held =
      y > JOIN.from && y < JOIN.to
        ? heldCentre(JOIN.from) +
          ((heldCentre(JOIN.to) - heldCentre(JOIN.from)) * (y - JOIN.from)) / (JOIN.to - JOIN.from)
        : heldCentre(y);
    centreCache.set(y, held);
    return held;
  };
  /** Pools and narrows. Forced to exactly 2 at the crossing, so the deck always spans the water. */
  const riverHalf = (y: number): number => {
    const w = 1.15 + bend(57, y / 4.7) * 1.5;
    return 2 + (w - 2) * meanderFreedom(y);
  };
  const isWater = (x: number, y: number): boolean => Math.abs(x - riverCentre(y)) <= riverHalf(y);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (isWater(x, y)) {
        set(ground, x, y, rnd() > 0.5 ? gid('water') : gid('water-2'));
        solid(x, y);
      }
  // Banks.
  /*
   * ALL FOUR NEIGHBOURS, which is the whole difference between a bank and a bank that stops.
   *
   * This asked `x - 1` and `x + 1` and nothing else. The river runs diagonally -- it enters at the
   * top right and leaves at the bottom left -- so every row where its column range steps sideways
   * leaves a tile whose water is to the NORTH or the SOUTH while its east and west neighbours are
   * dry. The bank reached a corner and simply stopped: deep water met flat lit grass across a hard
   * 32px tile edge, with no shoreline, no foam and no boulders in between. Counted on the generated
   * map, 29 water-to-land seams carried no shore tile at all and 25 of them were vertical -- 14
   * against open grass, two on the track just west of the deck -- and `shore-n` and `shore-s`, both
   * painted in `w-water.ts`, both in `TILE_NAMES`, both exported into the tileset, were placed
   * exactly zero times.
   *
   * THE HORIZONTAL CASES STILL WIN A CORNER, and that is a decision rather than an accident. The
   * river is broadly north-south, so `shore-w` and `shore-e` run in long unbroken columns down the
   * two banks, and `w-water.ts` phases its waterline (`PHASE`) so that those columns join tile to
   * tile. A tile that put its land along the TOP in the middle of such a column would read as a
   * notch bitten out of the bank. So the vertical tiles take only what the columns cannot reach:
   * the steps between them. A tile with water on two sides keeps the horizontal tile and still
   * shows water along part of its second wet edge; four side tiles cannot draw an inside corner,
   * and inventing a fifth is a painter's change, not this file's.
   *
   * The side in the name is the LAND, which is how the painter reads it: `shore-w` is land to the
   * west with the water lapping at its eastern edge.
   */
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (isWater(x, y)) continue;
      const bank = isWater(x + 1, y)
        ? 'shore-w'
        : isWater(x - 1, y)
          ? 'shore-e'
          : isWater(x, y + 1)
            ? 'shore-n'
            : isWater(x, y - 1)
              ? 'shore-s'
              : null;
      if (bank !== null) set(ground, x, y, gid(bank));
    }
  /*
   * A waterfall spilling in at the north end, BANK TO BANK (Paul's round, 2026-10-22).
   *
   * It was three tiles wide round the river's centre on each of its four rows, and the centre walks
   * three tiles west over those rows, so the fall was three rectangles of falling water floating on
   * open river, each stepped off the one above it, each with hard left and right edges against
   * still water -- and every cell mirrored at random by the mirror pass, so the streaks did not run
   * on from one row to the next. "A pasted-block waterfall". The ask was one fixed column range for
   * all four rows, and the river cannot give it: the channel on those rows is x 31-35, 30-33, 28-31
   * and 29-31, which share one column. Moving the river to make room would re-plan its banks, the
   * gorge's trees and the composition guards that stand on them. So the fall fills the channel
   * instead: every river cell of the four rows falls, its edges are the banks rather than still
   * water, and the step from row to row reads as the gorge bending, which is what a cascade does.
   * No mirror bits (`SIDEWAYS` no longer lists it), so the streaks are one drawing all the way down,
   * and a row of `water-2`'s broken water at its foot where it meets the river.
   */
  const FALL_ROWS = 4;
  for (let y = 0; y < FALL_ROWS; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!isWater(x, y)) continue;
      set(ground, x, y, gid('waterfall'));
      solid(x, y);
    }
  for (let x = 0; x < MAP_W; x++)
    if (isWater(x, FALL_ROWS) && isWater(x, FALL_ROWS - 1))
      set(ground, x, FALL_ROWS, gid('water-2'));

  /*
   * Where Purple stands when the game opens, and therefore where two of the three rectangles below
   * are pointed. It is declared here, above the track, because the carriageway's swing is held
   * flat across her pad: she steps onto the road, and a road that is mid-lean under her feet
   * arrives at the spawn as a four-row delta of sand in the one frame a visitor sees first.
   */
  const SPAWN = { x: 5, y: 20 };
  /**
   * THE HERO SHOT. The title screen and the first seconds of play: the camera is on Purple at the
   * spawn, and in landscape the copy column is opaque over the left of it (`visibleTitleColumns`).
   */
  const HERO = frameAt(REFERENCE_VIEWPORTS.desktop, cameraCentreTiles(SPAWN));
  /**
   * THE PORTRAIT SHOT, which nobody has ever composed. Same focus, a phone's camera, and the card
   * docks BELOW the world rather than beside it, so what a visitor sees is the top band of it.
   */
  const PORTRAIT_FULL = frameAt(REFERENCE_VIEWPORTS.phone, cameraCentreTiles(SPAWN));
  /*
   * The share of the portrait camera the title card leaves uncovered comes from
   * PORTRAIT_WORLD_BAND, which is screens.css's own cap (`0.6 * --otp-canvas-h`) rather than a
   * measurement. The figure that was here -- "7.3 tiles, measured on the game" -- is true at no
   * viewport at all: the real band is 12.80 tiles at 375x812, 13.00 at 390x844, 8.84 at 768x1024
   * and 6.71 at 320x568. A share is derivable; a tile count is not.
   */
  const PORTRAIT: Rect = {
    ...PORTRAIT_FULL,
    y1: PORTRAIT_FULL.y0 + (PORTRAIT_FULL.y1 - PORTRAIT_FULL.y0) * PORTRAIT_WORLD_BAND,
  };

  // --- paths -----------------------------------------------------------------
  const pathTiles = new Set<number>();
  /*
   * A TRACK, NOT A HIGHWAY, and the bug was in the stamp rather than in the waypoints.
   *
   * `layPath` used to walk the centre line in half-tile steps and stamp a `width` x `width` BLOCK
   * at each one. A square stamp is only `width` wide when the line it follows is axis-aligned: the
   * moment the road leans, consecutive blocks land a tile apart diagonally and their union is
   * three or four tiles across. So the main track rendered as a four-to-six tile band of bare sand
   * with blocky stepped edges -- by area the brightest thing on the map, at 196 mean luma against
   * a wood in the 70s, and nothing like the narrow winding ribbon the board draws.
   *
   * Stamping PERPENDICULAR to the segment instead makes the width mean what it says. Step along
   * the dominant axis one tile at a time, round the other coordinate, and lay exactly `width`
   * tiles across. A lean then shows as a one-tile jog -- which is what a path through a wood looks
   * like -- instead of as a wedge, and the road stays the same width whatever the waypoints do.
   *
   * The jog is the one place the stamp can break: two columns whose runs do not overlap touch only
   * at a corner, and a corner is not a step the player can take. A run of `width` tiles offset by
   * one still overlaps while `width > 1`, so only the one-wide footpaths need the elbow, and they
   * get it.
   */
  /*
   * ...AND THE REASON IT STILL BLOOMED AT EVERY JUNCTION.
   *
   * Stamping perpendicular fixed the leaning runs and left the corners broken, because the width
   * was still laid per SEGMENT. Two segments meeting at a waypoint each stamped that waypoint from
   * their own dominant axis, the `previous` back-fill stamped a second full run of `width` across
   * the jog, and the result was a lobe: measured off the generated map, the track swung between
   * one and five tiles wide, had an outright one-tile HOLE at (4,20) where the spawn pad failed to
   * meet the first segment, and the whole stretch between the bridge and the gate came out as a
   * ragged rectangular delta of sand rather than as a road.
   *
   * So the centre line is resolved ONCE, end to end, into a four-connected chain of cells -- at
   * most one tile of movement per step, with an elbow cell inserted wherever the line would
   * otherwise cut a corner -- and each cell of that chain is stamped exactly once, perpendicular to
   * the LOCAL direction of the chain rather than to the segment it happens to belong to. The width
   * then means what it says everywhere, including at a waypoint, and a junction costs one elbow
   * tile instead of a blob. A hole is impossible by construction: the chain is connected and every
   * stamp contains its own chain cell.
   */
  const layPath = (points: [number, number][], width = 2): void => {
    const chain: [number, number][] = [];
    const step = (x: number, y: number): void => {
      const last = chain[chain.length - 1];
      if (last && last[0] === x && last[1] === y) return;
      // Never leave the chain on a diagonal: a corner is not a step the player can take, and at
      // width 1 it would be a gap in a footpath.
      if (last && last[0] !== x && last[1] !== y) chain.push([x, last[1]]);
      chain.push([x, y]);
    };
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]!;
      const [x1, y1] = points[i + 1]!;
      const span = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= span; s++) {
        const t = span === 0 ? 0 : s / span;
        step(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
      }
    }
    for (const [i, [x, y]] of chain.entries()) {
      const [px, py] = chain[i - 1] ?? [x, y];
      const [nx, ny] = chain[i + 1] ?? [x, y];
      const alongX = Math.abs(nx - px) >= Math.abs(ny - py);
      for (let k = 0; k < width; k++) {
        const tx = alongX ? x : x + k;
        const ty = alongX ? y + k : y;
        if (!inside(tx, ty) || isWater(tx, ty)) continue;
        pathTiles.add(ty * MAP_W + tx);
      }
    }
  };

  /*
   * Main east-west track, plus a north fork to the owl and a south fork to the lantern.
   * The track meanders a row for looks, but it must be FLAT where it crosses the river: the
   * bridge is two rows tall, and a track that is mid-meander there meets it one row high and
   * leaves a visible step in the sand. The river sits around x 25 to 29, so the bends live
   * well clear of it.
   */
  /*
   * The main track wanders two rows either side of 20 where it is free to, and runs dead flat
   * where it is not. The two jogs it used to have were a single row each and read as a surveying
   * error on an otherwise straight road; a road that holds one row for forty-eight tiles is the
   * other reason the map looked municipal.
   *
   * x 18 to 34 is the stretch it may not bend in. The bridge deck rows are read off the track at
   * the west bank, and `map.test.ts` asserts that no OTHER row of track reaches either bank --
   * a track mid-bend at the river leaves a dead-end row of sand running into the water.
   *
   * x 40 east is flat for a different reason: the notice post spans rows 20 and 21 of the gate
   * approach and the gate itself is the gap in the fence on those two rows. A track that arrived
   * at the garden mid-bend would leave the notice standing in the grass beside the road it is
   * supposed to be blocking.
   */
  /*
   * The bends are bigger than they were, because the two the track used to have were a single row
   * each and read as a surveying error rather than as a road going round something. A track that
   * holds one row for most of the width of the map, crossed by a river holding one column, drew
   * the whole level as a plus sign.
   *
   * Everything between x 18 and x 34 is the bridge's, and everything from x 42 east is the gate's;
   * the swings live in the two stretches that are free, and they are worth three or four rows each
   * so that the road genuinely leaves the frame it entered.
   */
  /*
   * The slopes are GENTLE, about a row for every three or four columns, and that is a hard
   * constraint rather than a preference. `layPath` stamps a two-by-two block at every step along
   * the segment, so on a steep diagonal the blocks overlap only at their corners and the track
   * comes out as a staircase several tiles thick -- a wedge of bare sand far wider than the road
   * it belongs to. The first attempt at these bends rose four rows in three columns and put a
   * sand delta in the middle of the forest that looked far worse than the straight road had.
   * A road bends by leaning, not by turning a corner.
   */
  /*
   * ...AND THE AMPLITUDE CAME DOWN, which is the other half of unblocking the junction.
   *
   * The old bends were worth three and four rows -- [32,20] climbed to [36,17] and fell back to
   * [40,19] -- on the theory that a road should genuinely leave the frame it entered. At two tiles
   * wide over four columns that is not a bend, it is a hairpin: the chain spends more steps moving
   * across the road than along it, so the stamps stack into a wedge and the eye reads a sand delta
   * rather than a road going round something. Two rows over ten or twelve columns leans without
   * stacking, and leaning is what the board's ribbon does.
   *
   * The west end starts ON the spawn pad rather than two tiles short of it, which is what left the
   * hole at (4,20): the pad is laid later, in plain sand, and nothing joined the two.
   */
  /*
   * ...AND THE BENDS ARE A ROW EACH AGAIN, which is a reversal, measured, and worth writing down.
   *
   * The two one-row jogs were called a surveying error, so this round tried the opposite: a single
   * two-row lean across the whole western stretch, on the theory that a road should hold one
   * direction of travel. Rendered at the spawn camera it was far worse than what it replaced. The
   * stamp is `width` tiles laid PERPENDICULAR to the local direction, so a lean costs three rows of
   * sand wherever the chain steps across, and a chain that steps every third or fourth column over
   * sixteen columns is in that state for most of its length: the frame came out with a four-row
   * staircase of bare sand across the bottom left -- the exact delta the file's own note on gentle
   * slopes warns about, arrived at from the other direction.
   *
   * The lesson is that the amount of SAND is what reads as a motorway, and a bend buys wander at the
   * price of sand. One-row jogs separated by long flat runs are the cheapest wander there is: four
   * of them across the map, each costing one row for three columns, against the sixteen-column
   * staircase. What breaks the straight edge is not the geometry -- it is the wood coming down to
   * the sand in stretches, which the verge sweep at the foot of the file now allows.
   *
   * The two stretches that may not bend are unchanged and the reasons are unchanged: x 22 to 30 is
   * the bridge's -- `map.test.ts` asserts that no row of track but the deck's reaches either bank,
   * and the deck rows are read off the track at the west approach -- and x 42 east is the gate's,
   * where the notice spans the two path rows of the approach and the gate is the gap in the fence
   * on those same rows.
   */
  /*
   * ===========================================================================
   * THE CARRIAGEWAY IS A CURVE LAID COLUMN BY COLUMN, and that is why it may bend at all.
   * ===========================================================================
   *
   * Everything above this is the record of four rounds spent trying to make `layPath` draw a road
   * that wanders, and every one of them failed the same way, measured and written up: the stamp is
   * `width` tiles laid PERPENDICULAR to the local direction of the chain, so the moment the chain
   * steps across a row it lays three tiles in a column, and a chain that steps every third column
   * is in that state for most of its length. The conclusion the file reached was "the amount of
   * SAND is what reads as a motorway", and the remedy it adopted was to stop bending: dead-straight
   * runs joined by one-row jogs, with seven fringe tiles sprinkled on the edge.
   *
   * Which produced exactly what the design board now calls the bug. Seven broken tiles on a
   * sixty-column map is nothing; inside any ONE camera the road is two ruled horizontal lines
   * entering at the left edge and leaving at the right, with a right-angle spur off it. The board's
   * path is a narrow band that curves continuously and whose edge is torn.
   *
   * THE PERPENDICULAR STAMP WAS NEVER NEEDED HERE. This road is east-west for its whole length --
   * it has to be, the walk is a due-east walk and `map.test.ts` asserts the notice lies on the line
   * a player who only holds Right actually walks. For an east-west road the honest stamp is a
   * COLUMN: at each x, lay exactly two tiles starting at that column's north edge. The thickness is
   * then two whatever the curve does, there is no delta to accumulate, and because the north edge
   * moves by at most one row per column the two-tile runs of neighbouring columns always share a
   * row, so the band is four-connected by construction. A lean costs nothing. It took four rounds
   * to see because the bend was always attempted through the one machine that could not express it.
   *
   * WHERE IT MAY NOT BEND, and both are load-bearing rather than cautious:
   *   - within four columns of the crossing. `bridgeRows` is read off `isPath` at bridgeCentre - 3
   *     and `map.test.ts` checks every row at the columns either side of the deck, so a band that
   *     is mid-lean at the river leaves a dead-end row of sand running into the water.
   *   - from x 39 east. `gateRows` is [20, 21], the notice spans x 42 to 45 on both of them and the
   *     gate is the gap in the fence on those same rows; the zero-click beat depends on the
   *     approach being exactly those two rows.
   *
   * AND IT MAY ONLY SWING ONE ROW, which is a third constraint and a quieter one. The due-east pass
   * at the foot of this file fells anything standing on rows 20 and 21 between the spawn and the
   * door lane. With the band held to rows 19-20, 20-21 or 21-22, whichever of those two rows is not
   * sand is the verge immediately beside it, which that pass was always going to clear anyway. A
   * wider swing would cut a two-row lane through a wood somewhere and leave a notch in it.
   */
  const CROSSING = Math.round(riverCentre(20));
  /** Columns either side of the deck the band is held dead flat across. */
  const BRIDGE_FLAT = 4;
  /** East of this the band is the gate approach, and the notice spans it row for row. */
  const GATE_FLAT_FROM = 42;
  const TRACK_W = 2;
  const TRACK_X0 = 2;
  const TRACK_X1 = 52;
  /**
   * The column the footpath leaves the carriageway at.
   *
   * It is declared up here, hundreds of lines before the fork is laid, because the BAND has to know
   * about it. See the clamp in `northEdge` below: a one-wide footpath climbing out of a two-wide
   * band stacks sand in the column it climbs, and how much it stacks is a property of where the band
   * is sitting when it gets there.
   */
  const FORK_X = 8;
  /**
   * The row the footpath stops climbing in `FORK_X` and turns east out of it.
   *
   * `layPath` puts its elbow in the NEW column at the OLD row, so a turn at this row costs column
   * `FORK_X` exactly two cells -- this row and the one below it -- and costs `FORK_X + 1` the row
   * below it as well. Nothing can be routed around that while the signpost stands on (9,18).
   */
  const FORK_TURN = 17;
  const wander = valueNoise2D(20261067);
  /**
   * How much of its swing the band is allowed at this column: one inside the free stretches, nought
   * in the two windows, ramped over three columns between, so the curve arrives at the flat parts
   * already flat instead of stepping onto them.
   */
  const swingRoom = (x: number): number => {
    const slack = Math.min(
      Math.abs(x - CROSSING) - BRIDGE_FLAT,
      GATE_FLAT_FROM - x,
      x - TRACK_X0 - 1,
      /*
       * ...AND IT IS FLAT UNDER PURPLE'S FEET, which is the third window and the newest. The spawn
       * pad is two tiles of plain sand laid later, in a fixed place; a band that is mid-lean there
       * meets it a row off and their union is a four-row delta of sand in the exact middle of the
       * hero shot. Two columns of flat either side, then the same three-column ramp as the others.
       *
       * NARROWING IT TO ONE COLUMN WAS TRIED AND PUT BACK, which is worth the line it costs. The
       * pad is laid as two rows of plain sand at columns 5 and 6, so the band has to be ON those
       * two rows there or their union is three tiles deep -- and the trace in guard 7a can only read
       * an EDGE off a column whose run is the carriageway's own width, so a three-deep column is not
       * merely ugly, it is a column the instrument goes blind on. At half-width 1 the build failed on
       * "only 14 column(s) of readable carriageway west of the notice" against a floor of twenty. The
       * six flat columns this costs are bought back by the periods below, which is where the
       * straightness actually lived.
       */
      Math.abs(x - SPAWN.x) - 2,
    );
    return Math.max(0, Math.min(1, slack / 3));
  };
  /*
   * THE SWING IS COSINES PLUS A LITTLE NOISE, and that is a correction with a number behind it.
   *
   * The first version of this read the swing off `valueNoise2D` alone, the way every other field in
   * the file does, and the band came out occupying rows 20 and 21 for its whole length: not one
   * column reached row 19. A road is ONE row, so a 2-D field read along it is sampled on a line of
   * near-constant y, and at an 8.5-tile period that is seven lattice cells across sixty columns --
   * seven draws, whose realised range is a property of the seed rather than of the amplitude asked
   * for. The fringe pass this replaces hit the same wall and solved it by cutting at its own
   * quantiles, which works for a share and cannot work for a SHAPE.
   *
   * Two cosines at incommensurate periods have the amplitude they say they have, every time, and
   * never repeat inside sixty columns; the noise term is there so the curve is not a waveform.
   */
  /*
   * ...AND THE AMPLITUDE IS TWO ROWS, NOT ONE, which is the correction this round.
   *
   * At one row the band held rows 19, 20 and 21 across sixty columns, and in a camera 11.22 tiles
   * TALL a one-row wander is five per cent of the frame height: at the hero shot it reads as a pale
   * ruled bar running edge to edge, which is what the design board calls a trunk road. The board's
   * track swings far enough to leave the frame it entered.
   *
   * Two rows is affordable now for a reason that did not hold before: the tear SUBTRACTS, so the
   * band costs two tiles a column instead of two-and-a-half, and the sand freed by that is what
   * pays for the extra rows of travel. Three windows hold it flat where the level needs it -- the
   * crossing, the gate approach and Purple's own pad -- and each is ramped over three columns, which
   * is one more than the deepest swing needs to come back to twenty.
   */
  /*
   * ===========================================================================
   * ...AND THE PERIODS ARE SHORTER THAN THE FRAME, which is this round's correction and the whole
   * of what "drawn with a set square" meant.
   * ===========================================================================
   *
   * The amplitude was right and the WAVELENGTH was wrong. `cos(x / 5.7)` has a period of 35.8 tiles
   * and `cos(x / 11.3)` of 71, against a camera 19.41 tiles WIDE: half a cycle and a quarter of a
   * cycle across the whole picture. A curve whose shortest period is nearly twice the frame is
   * locally straight everywhere inside it, so every frame showed one slow rise -- three axis-aligned
   * bands meeting at right angles, with beautiful organic erosion applied to geometry drawn with a
   * set square. The board's path bends about every three tiles: no straight segment longer than
   * roughly 15 per cent of the frame it is in.
   *
   * So the two periods come inside the frame: `cos(x / 1.95)` is 12.25 tiles and `cos(x / 3.12)` is
   * 19.60. The short one is what puts a bend
   * where the camera can see one -- a cosine spends about a quarter of its period near each extreme,
   * so 12.25 gives flat runs of about three columns, which is the 15 per cent of a 19.41-tile frame
   * the board draws -- and the long one keeps the band travelling somewhere rather than oscillating
   * about one row.
   *
   * THE RATIO IS EXACTLY 8/5, AND IT IS NOT INCOMMENSURATE. This read "28.9" and "the ratio is
   * 2.36", and both were wrong: 3.12 / 1.95 is 1.6 on the nose, so the two cosines share a common
   * period of 98 tiles. What the file wanted from "incommensurate" it still gets, because 98 is
   * comfortably more than the 60 columns of map -- the pair cannot repeat inside the world -- but
   * it gets it from the map being short rather than from the periods being irrational, and anyone
   * widening the map should know which of those two facts they are relying on. The slew limit of
   * one row per column turns the steepest stretches into the one-tile jogs the stamp is built for.
   *
   * SHORTER THAN THIS COSTS MORE THAN IT BUYS, measured. At 9.4 tiles the band moved on nearly every
   * column, and three of this file's own guards failed at once: the tear needs a bitten column to
   * have two full neighbours whose bands both contain the row it keeps, which a band that steps every
   * column rarely has (7 bitten against a floor of 8); and the trace that reads the edge could only
   * find fourteen columns of readable carriageway west of the notice against a floor of twenty,
   * because a band that wanders runs into the forks and stops being separable from them. A curve the
   * instruments cannot read is not an improvement on a straight line.
   */
  const northEdge: number[] = [];
  {
    let held = SPAWN.y;
    for (let x = 0; x < MAP_W; x++) {
      const swing =
        Math.cos(x / 1.95 + 0.9) * 4.0 +
        Math.cos(x / 3.12 + 2.4) * 1.2 +
        (wander(x / 3.1, 4.5) - 0.5) * 0.9;
      /*
       * ...AND THE AMPLITUDE IS CLAMPED RATHER THAN SUMMED TO TWO, which is what lets a short period
       * travel as far as a long one.
       *
       * The terms used to sum to 2.4, so `want` only reached two rows out when both cosines happened
       * to peak together -- which at a 36-tile period they do for several columns at a stretch, and
       * at a 12-tile period for one column, less than the slew limit of one row per column needs to
       * walk the band out there. The first cut of this change kept the old sum and the band collapsed
       * onto three rows (19-21) where it had used five: more bends, less journey, and the build
       * failed on "the carriageway's north edge sits on only 3 row(s)". Terms that overshoot and a
       * hard clamp at two give the curve a PLATEAU at each extreme instead of a spike, so it reaches
       * row 18 and row 22 and holds them for a column or two, which is what a track does at the
       * outside of a bend.
       */
      const reach = Math.max(-2, Math.min(2, Math.round(swing * swingRoom(x))));
      /*
       * ===========================================================================
       * ...AND THE JUNCTION IS THE FOURTH WINDOW, and it was being paid for by the seed.
       * ===========================================================================
       *
       * The footpath climbs out of `FORK_X` and turns east at `FORK_TURN`, which costs that column
       * rows 17 and 18 and the next column row 18 as well (see `FORK_TURN`). Where the band sits
       * underneath decides two separate things, and both of them are measured:
       *
       *   band top 20  the fork's two cells and the band's two are CONTIGUOUS over five rows at
       *                FORK_X, and guard 7a fails the build on "a junction drawn as a yard".
       *   band top 18  the band meets the fork's elbow at FORK_X + 1, so the two merge into one
       *                five-row run there -- and guard 7a's trace, which follows the contiguous run
       *                containing the row before it, LATCHES ONTO THE FOOTPATH and walks away east
       *                along row 12. Measured: sixteen traced columns of which fourteen readable,
       *                against a floor of twenty, with the carriageway itself never examined.
       *   band top 19  four rows at FORK_X, and row 18 clear at FORK_X + 1, so the fork and the
       *                carriageway are separable. The only value that satisfies both.
       *
       * The old curve sat on 19 there because its periods were long and its phase happened to put it
       * there; nothing asked for it. So the junction gets a window like the bridge, the gate and
       * Purple's pad have -- except that this one clamps to a row one NORTH of the spawn rather than
       * damping towards it, because that is the row the arithmetic above names.
       *
       * Clamping `want` rather than `held` keeps the one-row-per-column slew intact, which is what
       * the column stamp relies on for its own connectivity.
       */
      const atJunction = x >= FORK_X - 1 && x <= FORK_X + 1;
      const want = atJunction ? FORK_TURN + 2 : SPAWN.y + reach;
      // One row per column, always: the step the column stamp relies on for its own connectivity.
      held = Math.max(held - 1, Math.min(held + 1, want));
      northEdge.push(held);
    }
  }
  /*
   * ===========================================================================
   * AND THE EDGE IS TORN BY TAKING SAND AWAY, which is a reversal and the point of this round.
   * ===========================================================================
   *
   * The previous tear ADDED a tile on one bank of about half the columns, on the argument that the
   * board's verge has teeth and at 32px a tooth is a tile. The teeth were right and the material
   * was wrong: the guard that certified it defined a bitten column as `bottom - top === 2`, which
   * is a THREE-tile carriageway, and its floor of fourteen therefore MANDATED a wider road. Measured
   * in the rectangle a 1280 visitor actually sees, sand came out at 30.7% of the frame against 24%
   * of canopy -- a band two to three tiles deep in a camera 11.22 tiles tall, so 18 to 27 per cent
   * of the frame's HEIGHT. The board's is about a tenth of its frame. An edge broken by making the
   * road wider is not a broken edge, it is a wider road with a ragged side.
   *
   * So a tooth is a tile REMOVED. The band is laid two tiles everywhere and then bitten back to one
   * on scattered columns, which breaks the ruled edge and spends sand instead of buying it.
   *
   * WHAT KEEPS THE BAND CONNECTED. A bite leaves one row where there were two, so the row that is
   * left has to be inside both neighbours' bands or the carriageway comes apart at that column --
   * four-connectivity is the whole reason the column stamp was adopted. Two rules hold it: never
   * two bites running, so a bitten column always has two full neighbours; and the row that is left
   * must lie inside both of them. Neither is a preference -- a chain of sand with a diagonal in it
   * is not a road a player can walk.
   *
   * A tear is still refused in the flat windows and anywhere near the water, for the reasons above.
   */
  const tear = valueNoise2D(20261069);
  /**
   * Where the edge may be bitten. Narrower than the stretch the band may bend in, and the extra
   * column either side of the notice is the reason: the notice spans x 42 to 45 on the two gate
   * rows and the audit floods the map refusing to step on it, so a third row of sand anywhere in
   * that approach is a corridor round the one beat the level is for.
   */
  /*
   * ...AND NOT THE COLUMN THE FOOTPATH CLIMBS OUT OF, which is the one place a legal tooth does
   * real damage.
   *
   * At `FORK_X` the fork's two cells sit directly on top of the band, so the column's sand is one
   * four-row run. A tooth off its SOUTH bank leaves a three-row run whose middle is a row the next
   * column does not have, and guard 7a's trace -- which steps forward from the middle of the run it
   * just read -- loses the carriageway there and follows the footpath east along row 12 instead: it
   * reported fourteen readable columns against a floor of twenty, having never looked at the road. A
   * tooth off its NORTH bank is worse than a measurement problem: it removes the one cell joining the
   * footpath to the road, and `meets` cannot see that because the fork is laid after this runs.
   *
   * `FORK_X + 1` goes with it for the same reason from the other side: it is the column the fork
   * elbows into, so the band's own top row there is the row the trace steps forward onto, and a
   * tooth that takes it leaves the trace nothing to land on.
   */
  const tearable = (x: number): boolean =>
    x > TRACK_X0 &&
    x < GATE_FLAT_FROM &&
    x !== FORK_X &&
    x !== FORK_X + 1 &&
    Math.abs(x - CROSSING) > BRIDGE_FLAT;
  let torn = 0;
  const layTrack = (): void => {
    for (let x = TRACK_X0; x <= TRACK_X1; x++) {
      const t = northEdge[x]!;
      for (let k = 0; k < TRACK_W; k++) {
        if (!inside(x, t + k) || isWater(x, t + k)) continue;
        pathTiles.add((t + k) * MAP_W + x);
      }
    }
    /** Does the row left behind by a bite still lie inside the band at the neighbouring column? */
    const meets = (nx: number, kept: number): boolean => {
      const n = northEdge[nx];
      return n === undefined || nx < TRACK_X0 || nx > TRACK_X1 || (kept >= n && kept < n + TRACK_W);
    };
    let last = TRACK_X0 - 2;
    for (let x = TRACK_X0 + 1; x < TRACK_X1; x++) {
      if (!tearable(x)) continue;
      // Never two bites running: a bitten column has to have two full neighbours to hang from.
      if (x - last < 2) continue;
      /*
       * ONE SIDE PER COLUMN, which the first version of this did not hold and the render showed
       * immediately: two independent fields at a 1.6-tile period agree about a third of the time,
       * so a tenth of the columns bit both banks at once and removed the whole carriageway. The
       * stronger of the two fields wins the column, so the tooth alternates between the banks.
       */
      /*
       * ...AND IF THE FIELD'S OWN BANK CANNOT TAKE THE TOOTH, THE OTHER ONE DOES. One side per
       * column still; which side is now a question the geometry gets a vote in.
       *
       * On a flat stretch both banks pass `meets` and the field decides, exactly as before. On a
       * stepping one it very often does not: where the band climbs a row the only row shared with
       * both neighbours is the one the step has in common, so a tooth may be taken off one bank and
       * not the other, and taking it off the wrong one is illegal rather than ugly. The old code read
       * the field, built the one pair it implied, and skipped the column if that pair failed -- so
       * the teeth could only land where the road was straight.
       *
       * That was invisible while the curve had a 36-tile period, because the road WAS straight nearly
       * everywhere. With the periods inside the frame it cost two thirds of them: 5 bitten columns
       * against this file's own floor of 8, which is the shape of trade this round is supposed to
       * refuse -- a bend bought by paying for it in torn edge.
       */
      /*
       * THE THRESHOLD IS A SHARE OF THE COLUMNS A TOOTH CAN BE TAKEN FROM, and that set got smaller.
       *
       * 0.52 was tuned against a band that was straight nearly everywhere, so almost every column in
       * the tearable stretch was a candidate. A band that bends is only biteable where the row left
       * behind is shared with both neighbours -- nineteen columns of the thirty-four, counted on the
       * generated map -- and "never two bites running" halves that again. At 0.52 the realised count
       * came out at seven against this file's floor of eight. The share asked for per CANDIDATE comes
       * up to compensate, so the torn edge keeps the length it had rather than paying for the curve.
       */
      const north = tear(x / 1.6, 13.5);
      const south = tear(x / 1.6 + 47, 20.5);
      if (Math.max(north, south) <= 0.42) continue;
      const t = northEdge[x]!;
      /*
       * ===========================================================================
       * ...AND A TOOTH IS NEVER TAKEN OFF THE OUTSIDE OF A BEND.
       * ===========================================================================
       *
       * At a column where the north edge reaches further north than either of its neighbours, the
       * only row `meets` will let the column keep is the southern one -- so the tooth is FORCED onto
       * the north bank, and the north bank there is the furthest the band travels. Measured: the
       * trough at columns 17 to 19 was bitten at 17 and at 19, which left (18,18) with one sand
       * neighbour, the dangle trimmer took it, and three columns of carriageway came out as one row
       * on row 19. The curve reached row 18 and nothing drawn on the map said so -- guard 7a counted
       * four rows travelled against its floor of five, and the thing it was counting had been shaved
       * off by the pass that is supposed to be roughening the edge.
       *
       * It is the north bank specifically rather than both, and that is not tidiness: `northEdge` is
       * the row the band is laid from, it is the row the guard reads the curve off, and it is the
       * edge that meets the wood standing above the road, which is where a player sees the bend.
       */
      const juts = (nx: number): boolean => (northEdge[nx] ?? t) > t;
      const banks = (north >= south ? [t, t + TRACK_W - 1] : [t + TRACK_W - 1, t]).filter(
        (candidate) => candidate !== t || !(juts(x - 1) || juts(x + 1)),
      );
      const took = banks.find((candidate) => {
        const kept = candidate === t ? t + TRACK_W - 1 : t;
        return (
          meets(x - 1, kept) &&
          meets(x + 1, kept) &&
          pathTiles.has(candidate * MAP_W + x) &&
          pathTiles.has(kept * MAP_W + x)
        );
      });
      if (took === undefined) continue;
      pathTiles.delete(took * MAP_W + x);
      last = x;
      torn++;
    }
  };
  layTrack();
  /*
   * THE FORKS ARE RECORDED AS THEY ARE LAID, which is the only moment the map knows them.
   *
   * After this point a cell of sand is a cell of sand: nothing in `pathTiles` says whether it is the
   * carriageway or a footpath, and a junction read back off the finished ground is a guess about
   * which of two meeting runs is the road. So the carriageway is snapshotted here, each footpath
   * records what it added and where it set out from, and `forkAt` below turns that into the cell
   * where the walkable path actually branches -- the carriageway tile the footpath leaves from. The
   * `fork-*` objects (for the Way Teller's signs) are placed from it, one per footpath, west to east.
   */
  const carriageway = new Set(pathTiles);
  const footpaths: { from: readonly [number, number]; added: number[] }[] = [];
  const layFootpath = (points: [number, number][]): void => {
    const before = new Set(pathTiles);
    layPath(points, 1);
    footpaths.push({ from: points[0]!, added: [...pathTiles].filter((k) => !before.has(k)) });
  };
  /**
   * Where a footpath branches: the carriageway cell beside the footpath cell nearest its start.
   * Both are measured from the start waypoint, so a footpath that runs alongside the road for a few
   * cells (the south fork does, for three) forks where it LEAVES, not somewhere along the run.
   */
  const forkAt = (f: (typeof footpaths)[number]): { x: number; y: number } => {
    const [fx, fy] = f.from;
    const dist = (x: number, y: number): number => Math.abs(x - fx) + Math.abs(y - fy);
    let best: { x: number; y: number; d: number } | undefined;
    for (const key of f.added) {
      if (!pathTiles.has(key)) continue;
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      for (const [dx, dy] of NEIGHBOURS) {
        const nk = (y + dy) * MAP_W + (x + dx);
        if (!carriageway.has(nk) || !pathTiles.has(nk)) continue;
        const d = dist(x, y) * 100 + dist(x + dx, y + dy);
        if (!best || d < best.d) best = { x: x + dx, y: y + dy, d };
      }
    }
    if (!best) throw new Error(`the footpath from (${fx},${fy}) never meets the carriageway`);
    return { x: best.x, y: best.y };
  };
  /**
   * The northernmost track row at this column.
   *
   * A footpath that leaves the road has to leave it from a tile that is ACTUALLY ON IT -- the file
   * has already shipped a fork dangling in the wood with a tile of grass between it and the road,
   * which made the glade, the fountain and the owl reachable only across country. Now that the main
   * track leans, a hard-coded row and a bend disagree silently, so the row is read off the track.
   */
  const trackTop = (x: number): number => {
    for (let y = 0; y < MAP_H; y++) if (pathTiles.has(y * MAP_W + x)) return y;
    throw new Error(`no track at column ${x} to branch a footpath from`);
  };
  /*
   * The two forks are ONE tile wide, and they wind.
   *
   * The main track is two wide because it has to be: the bridge deck is read off it and the gate
   * lane is two rows, so a one-wide track would leave a step at the river and a wall at the gate.
   * Nothing holds the forks to that, and at two wide they read as a second and third ROAD. The
   * board has one road and two footpaths, and the difference between them is most of why the
   * board's forest looks walked-in and ours looked municipal: four wide sandy rectangles meeting
   * at right angles in the middle of a lawn.
   *
   * The extra waypoints are the other half of it. A fork with two segments is two straight lines;
   * a fork with four bends around whatever is in its way, which is what a path through a wood is.
   * Every bend here stays well clear of the river -- the crossing test asserts that no track but
   * the main one reaches a bank.
   */
  /*
   * It leaves the track from a tile that is ACTUALLY ON IT. Measured on the generated map, the old
   * fork started at (15,20) while the track at that column ran along rows 22 and 23, so the two
   * never met: a flood fill along sand reached 126 of the map's 142 path tiles, and the missing
   * sixteen were this footpath, dangling in the wood with a one-tile gap of grass between it and
   * the road. The glade, the fountain and the owl were reachable only by walking across country.
   *
   * It also passes WEST of the market rather than through it: the stall's counter row is x 11 to
   * 14 and its clearing runs x 11 to 14, so the footpath keeps to column 10 until it is clear of
   * the awning and then crosses above it.
   */
  /*
   * ...AND IT FORKS AT THE SIGNPOST, which is the whole reason there is a signpost.
   *
   * It used to leave the track at x 16 while the signpost stood at x 9 -- seven tiles apart, so
   * the one object on the map whose entire job is to mark a choice stood in open grass beside a
   * road that did not divide, and the choice it marked happened out of frame. The board's Explore
   * frame is built on exactly this: a path that forks, with a signpost in the crook of it, and the
   * fork is what tells a player at a glance that this is a place where you decide something rather
   * than a corridor you are being walked down.
   *
   * Moving the branch to column 10 puts it one tile from the post, turns the spawn camera from a
   * road crossing a lawn into a junction, and gives the footpath an honest route: up the west side
   * of the market, over its roof line, and east into the fountain glade where the owl is waiting.
   * Which means the player can see, from where she is standing when the game starts, that the walk
   * has more than one direction in it.
   */
  /*
   * ...AND IT LEAVES THE ROAD AT AN ANGLE, AND IT ARRIVES SOMEWHERE.
   *
   * Two faults, both visible in the whole-map render. It used to meet the track at a right angle,
   * which draws a T: a side road, not a fork, and a T is the shape that made the level read as a
   * street plan. And it used to run PAST the fountain glade and stop at row 9, in the middle of the
   * wood, so the one footpath on the map went nowhere -- the board's paths all arrive at something,
   * which is what tells a player a direction is worth taking.
   *
   * So it peels off the road over two columns and then climbs, and it ENDS one tile west of the
   * fountain. The owl is met at the end of it, under the tree the glade is given below, which is the
   * board's own arrangement: the path forks at the signpost, one arm goes to the thing in the
   * clearing, and you can see from the junction that it does.
   *
   * It keeps to column 10 and 11 past the market for the old reason: the stall's counter and its
   * clearing both run x 11 to 14, so the footpath stays west of the awning and crosses above it.
   */
  /*
   * ...AND IT NO LONGER CLIMBS SIX TILES IN A DEAD STRAIGHT COLUMN. That run is the "right-angle
   * spur" the design board names in the title frame: against a carriageway that now curves, one
   * perfectly vertical ribbon of sand through the middle of the hero shot is the most surveyed
   * thing left in it. It leans across to column 11 as soon as it is clear of the stall's awning,
   * which halves the longest straight and puts a bend where the frame can see one. It still keeps
   * to column 10 beside the market -- the counter row and its clearing both run x 11 to 14 -- so
   * the lean happens above the roof line, where there is nothing to walk into.
   */
  /*
   * ===========================================================================
   * ...AND IT CLIMBS ON THE DIAGONAL, AND IT IS WEST OF WHERE IT WAS. Three reasons, measured.
   * ===========================================================================
   *
   *   1. IT WAS A HOLE IN THE HERO SHOT. It left the road at column 11 and climbed columns 10 and
   *      11 to row 13, so in the rectangle a 1280 visitor sees those two columns carried SIX rows
   *      of sand each -- a pale vertical ribbon through the middle of the picture, joined to the
   *      road at the bottom, which is the single deepest stretch of sand in the frame.
   *   2. IT CLOSED THE CANOPY OVER THE MIDDLE OF THE SAME SHOT, TWICE. `plantKind` refuses to hang
   *      a crown over sand, so its row-13 run blocked three columns of the camera's top edge
   *      outright; and the verge sweep clears BOTH sides of a one-wide footpath, so the trees
   *      standing at columns 7, 8 and 9 -- which the framing pass had put there on purpose -- were
   *      felled for being beside it. Traced on the generated map: the framing pass closed nine
   *      columns and the sweep took three of them straight back.
   *   3. NOBODY HAD EVER COMPOSED THE PORTRAIT FRAME. A 375 phone sees columns 0 to 11 and a band
   *      about seven tiles deep. The fork sat in the half-cut column at its right edge, so the one
   *      thing in that frame telling a player there is a walk to take was clipped off the side.
   *
   * So it leaves the road at the signpost, jogs west for a column, and then climbs on a DIAGONAL --
   * two or three tiles a column rather than six in one -- until it is above the camera's own crown
   * rows, where it turns east and runs to the fountain along a row no canopy needs. The glade, the
   * owl and the end of the walk are all where they were; what moved is the shape of getting there.
   */
  /*
   * TWO ROWS A COLUMN, AND ONE COLUMN ACROSS THE CROWN ROWS. The shape is arithmetic rather than
   * taste. A footpath that climbs seven rows has to spend them somewhere: all in one column and it
   * is a six-tile ribbon of sand standing in the middle of the frame, spread thin and it crosses
   * the two rows the camera's top edge cuts in four different columns, every one of which then
   * refuses a crown. Two rows a column keeps the deepest stack of sand in the hero frame at four,
   * and the last climb is taken in a single column so exactly ONE column of the camera's top edge
   * is spent on it. Everything above row 13 runs along row 12, which no canopy needs.
   */
  /*
   * ...AND IT CROSSES THE TWO ROWS THE TOP EDGE CUTS IN ONE COLUMN, not three.
   *
   * `topEdgeRows(HERO.y0)` is rows 15 and 16, and the old waypoints put sand on (9,16), (10,16),
   * (10,15) and (11,15) -- three of the fifteen columns a landscape visitor can see, every one of
   * which then refuses a crown, because `plantKind` will not hang one over the road. The paragraph
   * above claims "exactly ONE column", and it was written against a frame whose origin was a tile
   * out; measured on the real rows it was three. Climbing inside column 9 until the path is clear of
   * both of them spends the one column the claim promised.
   */
  layFootpath([
    [FORK_X, trackTop(FORK_X)],
    [FORK_X, FORK_TURN],
    [9, 16],
    [9, 14],
    [10, 13],
    [11, 12],
    [14, 12],
    [16, 12],
    [18, 12],
  ]);
  /*
   * The south fork now runs THROUGH the well glade on its way to the lantern, which is what turns
   * the glade from scenery into a destination: the path visibly goes somewhere, and the thing it
   * goes to can be seen from the track long before you reach it.
   */
  /*
   * It leaves the main track inside the flat stretch rather than out at x 41, which is now on the
   * rise towards the gate: a footpath that branches off a slope meets it at a corner, and the two
   * together drew a third straight edge across the east of the map.
   */
  layFootpath([
    [31, trackTop(31) + 1],
    [32, 23],
    [34, 25],
    [35, 28],
    [36, 31],
    [37, 33],
  ]);

  /*
   * ===========================================================================
   * THE MAGPIE'S LANE (2026-10-25, docs/GATEKEEPER.md): south from the first fork to the west bank.
   * ===========================================================================
   *
   * The second way over the river starts here: a footpath that leaves the road at the signpost's
   * junction, on the south side where the north footpath leaves on the north, and runs south and
   * east through the wood to `MAGPIE_SPOT` on the bank below the bridge. It is one tile wide, like
   * the other footpaths, and it is laid with `layPath` rather than `layFootpath` on purpose: the
   * `fork-*` objects are one per `layFootpath` call, numbered west to east, and a third footpath
   * would renumber the second fork. This one leaves from the first fork's own junction, so it adds
   * no fork of its own.
   *
   * THE SHAPE IS THE HERO FRAME'S ARITHMETIC, like the north footpath's. Composition guard 7a holds
   * every column of the title camera to at most four rows of sand in an unbroken stack, and the
   * fork's column already carries four (the north footpath's two over the band's two). So the lane
   * leaves from the column WEST of the fork, drops the two rows that column can spare, and then
   * steps down the diagonal two rows a column, so no column it passes stacks into the road. Below the
   * frame it runs east along the wood to her, with one gentle bend so it is not a ruled line.
   *
   * Its last tile is her own, and the dangling-end trim below takes it, so she stands at the end of
   * the lane on the grass, the way the Owl used to stand at the end of his.
   */
  const magpieLane = (): [number, number][] => {
    const x0 = FORK_X - 1;
    const y0 = trackTop(x0) + TRACK_W;
    return [
      [x0, y0],
      [x0, y0 + 1],
      // Down the diagonal and out of the bottom of the title camera (its last row is 25): nine
      // tiles of sand inside the frame, which is what guard 7a's share has room for.
      [x0 + 4, y0 + 5],
      // A dip below the line to her, so the run east is two short legs rather than one ruled one.
      [x0 + 7, MAGPIE_SPOT.y + 1],
      [MAGPIE_SPOT.x, MAGPIE_SPOT.y],
    ];
  };
  layPath(magpieLane(), 1);

  /*
   * The old one-tile fringe pass stood here. It is gone, and the note it left is worth keeping: it
   * cut its share at the field's OWN QUANTILES rather than at a fixed threshold, because a road
   * occupies one row, so any field read along it is sampled on a line of near-constant y -- about
   * fifteen lattice cells across a sixty-column map -- and whether those fifteen draws straddle a
   * fixed threshold is a property of the seed and not of the design. The tear above is read off a
   * 2.3-tile field instead, which is fine enough that a sixty-column sample is a hundred lattice
   * cells rather than fifteen, so the share it realises is the share it asks for.
   */
  /*
   * ===========================================================================
   * AND NO PATH ENDS IN A SINGLE DANGLING TILE.
   * ===========================================================================
   *
   * Four of them on the map, at (18,13), (4,22), (36,23) and (37,33): one tile of sand with sand on
   * exactly one side. At 32px that is not a path going somewhere, it is a pale smudge on the lawn
   * -- the tile where a chain happened to stop, or the single tooth a bite left standing. The board
   * never draws one; its paths arrive at something or leave the frame.
   *
   * A tile with one neighbour or none is a LEAF, and removing a leaf cannot disconnect anything,
   * which is why this is safe to do over the whole set at once rather than reasoned about per fork.
   * One pass, deliberately: the tile behind a trimmed end is itself a leaf afterwards, and chasing
   * that would walk each footpath back to the road. What this removes is the dangle.
   */
  let trimmed = 0;
  for (const key of [...pathTiles]) {
    const x = key % MAP_W;
    const y = (key - x) / MAP_W;
    const touching = NEIGHBOURS.filter(([dx, dy]) =>
      pathTiles.has((y + dy) * MAP_W + (x + dx)),
    ).length;
    if (touching > 1) continue;
    pathTiles.delete(key);
    trimmed++;
  }

  console.log(
    `  track: ${torn} tile(s) bitten OUT of the carriageway's edge, ${trimmed} dangling end(s) ` +
      'trimmed; ' +
      `mean width ${(TRACK_W - torn / (TRACK_X1 - TRACK_X0 + 1)).toFixed(2)} tiles, ` +
      `north edge rows ${Math.min(...northEdge)}-${Math.max(...northEdge)}`,
  );

  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
    set(ground, x, y, gid('path'));
  }
  // Soft edges where the track meets grass.
  const isPath = (x: number, y: number): boolean => pathTiles.has(y * MAP_W + x) && inside(x, y);
  /*
   * ===========================================================================
   * WHICH VERGE A TRACK TILE DRAWS IS A FOUR-BIT NEIGHBOUR MASK, asked of what is DRAWN.
   * ===========================================================================
   *
   * This was an if-chain -- `n && e`, then `n && w`, then `s && e`, then `s && w`, then each side
   * alone -- and an if-chain cannot say "both". Two faults came out of that and they are different
   * faults, so they are separated here.
   *
   * ONE: THE TILE SET CANNOT DRAW A CORRIDOR, which is `tiles/w-ground.ts`'s finding and is NOT
   * fixed by this change. There is no tile carrying grass on two OPPOSITE sides and none carrying
   * it on three, so a one-tile-wide run of track has no tile that fits and the far side gets no
   * verge, no lip and no teeth: sand running flush into lawn down a dead-straight tile boundary.
   * The painter has the six entries written out ready -- `path-ns`, `path-ew` and the four
   * three-sided cases -- and they are six table entries in `GROUND_TILES` plus six names appended
   * to `TILE_NAMES` in `tiles.ts`, which throws at import for any painter it does not list. Neither
   * of those two files is this task's to edit, so the six gids are NOT in this regeneration.
   *
   * What the mask does instead is make the gap EXPLICIT and COUNTED. `VERGE` maps all sixteen
   * neighbourhoods; the ten the tileset can draw resolve exactly, and the six it cannot resolve to
   * the closest tile that exists and declare, in `undrawn`, which side they had to leave bare.
   * Audit 8 at the foot of this file counts those sides and names the worst straight run of them,
   * so the defect is a number on every run instead of a paragraph in a painter's docstring. When
   * the six gids land, the six `undrawn` entries become `''` and the audit falls to zero.
   *
   * TWO: IT ASKED THE WRONG QUESTION, and this change does fix that. `isPath` answers from
   * `pathTiles`, the set of cells the track PLANNER claimed, and the bridge deck is not in it --
   * the planner does not lay sand over water. So the two sand tiles abutting the deck drew a grass
   * verge against a plank: `(29,20)` came out `path-nw` and `(29,21)` `path-sw`, each with a lawn
   * lip down the edge it shares with `bridge-r`. The mask asks the GROUND LAYER what is drawn, and
   * the verge sweep now runs AFTER the deck is laid rather than before it, so a tile cannot be
   * edged against a neighbour that is about to change under it.
   */
  const TRACK_GIDS = new Set(
    [
      'path',
      'path-n',
      'path-s',
      'path-e',
      'path-w',
      'path-ne',
      'path-nw',
      'path-se',
      'path-sw',
      'bridge-l',
      'bridge-m',
      'bridge-r',
    ].map(gid),
  );
  /** Is the cell DRAWN as something a walker stays on -- sand or deck? Not "was it planned as one". */
  const carriesTrack = (x: number, y: number): boolean =>
    inside(x, y) && TRACK_GIDS.has(at(ground, x, y) & BASE_GID);
  const N_SIDE = 1;
  const S_SIDE = 2;
  const E_SIDE = 4;
  const W_SIDE = 8;
  /**
   * Mask -> the tile to draw, and the sides that tile cannot draw a verge on.
   *
   * `undrawn` is the whole of the corridor defect, written down. A bound is NOT derived from it:
   * audit 8 counts bare sides off the finished ground layer.
   */
  const VERGE: ReadonlyArray<{ readonly tile: string; readonly undrawn: string }> = [
    /*  0            */ { tile: 'path', undrawn: '' },
    /*  1 n          */ { tile: 'path-n', undrawn: '' },
    /*  2 s          */ { tile: 'path-s', undrawn: '' },
    /*  3 n s        */ { tile: 'path-n', undrawn: 's' },
    /*  4 e          */ { tile: 'path-e', undrawn: '' },
    /*  5 n e        */ { tile: 'path-ne', undrawn: '' },
    /*  6 s e        */ { tile: 'path-se', undrawn: '' },
    /*  7 n s e      */ { tile: 'path-ne', undrawn: 's' },
    /*  8 w          */ { tile: 'path-w', undrawn: '' },
    /*  9 n w        */ { tile: 'path-nw', undrawn: '' },
    /* 10 s w        */ { tile: 'path-sw', undrawn: '' },
    /* 11 n s w      */ { tile: 'path-nw', undrawn: 's' },
    /* 12 e w        */ { tile: 'path-e', undrawn: 'w' },
    /* 13 n e w      */ { tile: 'path-ne', undrawn: 'w' },
    /* 14 s e w      */ { tile: 'path-se', undrawn: 'w' },
    /* 15 n s e w    */ { tile: 'path-ne', undrawn: 'sw' },
  ];
  /*
   * THE DECK IS TRACK AND IS NOT SAND, and moving this sweep below the bridge block is exactly how
   * that stops being obvious. `pathTiles` contains the two cells where the planned track reaches
   * the near bank, and the deck is laid from `bridgeCentre - 2`, which is one of them -- so the
   * first run of the moved sweep put `path-n` and `path-s` back over `bridge-l` and took the left
   * end off the crossing in both rows. Caught by diffing the generated map cell by cell against the
   * committed one, not by any test: the bridge was still five tiles wide, three of them planks.
   * Audit 8 asserts the deck is whole now, so it cannot be silent a second time.
   */
  const DECK_GIDS = new Set(['bridge-l', 'bridge-m', 'bridge-r'].map(gid));
  const pathEdge = (x: number, y: number): void => {
    if (DECK_GIDS.has(at(ground, x, y) & BASE_GID)) return;
    const mask =
      (carriesTrack(x, y - 1) ? 0 : N_SIDE) |
      (carriesTrack(x, y + 1) ? 0 : S_SIDE) |
      (carriesTrack(x + 1, y) ? 0 : E_SIDE) |
      (carriesTrack(x - 1, y) ? 0 : W_SIDE);
    set(ground, x, y, gid(VERGE[mask]!.tile));
  };

  /*
   * The bridge, where the main track meets the river.
   *
   * Its rows are read off the track rather than hard-coded. Hard-coding them is what put the
   * deck a row below the sand: the waypoints moved, the constant did not, and the crossing
   * gained a step that no test could see. Measuring the approach means the two can never
   * disagree, whatever the waypoints do later.
   */
  const bridgeCentre = Math.round(riverCentre(20));
  const approachX = bridgeCentre - 3; // dry land, just west of the water
  const bridgeRows: number[] = [];
  for (let y = 0; y < MAP_H; y++) if (isPath(approachX, y)) bridgeRows.push(y);
  if (bridgeRows.length === 0) throw new Error('the main track does not reach the river crossing');

  for (const y of bridgeRows)
    for (let x = bridgeCentre - 2; x <= bridgeCentre + 2; x++) {
      const kind =
        x === bridgeCentre - 2 ? 'bridge-l' : x === bridgeCentre + 2 ? 'bridge-r' : 'bridge-m';
      set(ground, x, y, gid(kind));
      clear(x, y);
    }
  /**
   * THE DRAWBRIDGE'S SPAN (2026-10-25, docs/GATEKEEPER.md as the client revised it that day): every
   * deck cell, from the west end post's column to the east one's, on every deck row. Raised, it is
   * laid over them at the end of the file in `decor-below`, and they STAY WALKABLE in `collision`:
   * the game blocks them while the drawbridge is up, because it is the game that lowers it.
   */
  const gateX = bridgeCentre - 2;
  const spanX1 = bridgeCentre + 2;
  /** Which raised/lowered pair a deck column takes: -0 the west end, -1 the middle, -2 the east. */
  const spanKind = (x: number): 0 | 1 | 2 => (x === gateX ? 0 : x === spanX1 ? 2 : 1);

  /*
   * ...AND THE VERGES GO ON NOW, with the deck already down.
   *
   * This loop used to stand above the bridge block. It ran against `pathTiles`, which does not
   * contain the deck, so the two sand tiles either side of the crossing drew a lawn lip against a
   * plank. See the mask's note: the sweep reads what is DRAWN, so it has to run after everything
   * that draws track.
   */
  for (const index of pathTiles) pathEdge(index % MAP_W, Math.floor(index / MAP_W));

  // --- boulders crowding the banks ---------------------------------------------
  /*
   * The board's river runs through a field of stone. Ours ran through a lawn with a blue stripe
   * in it, and that single difference accounts for most of the missing grey: measured against the
   * board's own Explore frame, dark grey is 5.0% of the board and was 1.4% of our map.
   *
   * This runs BEFORE the trees on purpose. `plantTree` refuses a tile that already holds decor,
   * so laying the scree first means stone wins the bank and the wood starts a tile or two back,
   * which is the order the board shows. Done the other way round, trees take the bank and the
   * boulders end up as the occasional pebble in a gap.
   *
   * Nothing here can strand the player: the river is already impassable and the one crossing is
   * the bridge, whose deck and approach are path tiles, which this skips.
   */
  const scree = valueNoise2D(20261021);
  /** Where the gorge has walls at all, and how far back from the water they stand. */
  const bankField = valueNoise2D(20261033);
  /*
   * ...AND A BANK IS NOT A DRY-STONE WALL. Boulders planted in vertical files of five and six in
   * columns 28 and 31 -- the same topiary defect the trees have, in a material no guard watches and
   * on the one object the art direction asks to be "crowded, overlapping, two deep" rather than
   * stacked. A field thresholded column by column will do this wherever its gradient happens to run
   * north-south, which on a river flowing north-south is most of the map.
   *
   * Three is a bank two deep with one spilling inland. Four and up is masonry.
   */
  const BOULDER_FILE = 3;
  /** How tall a vertical run of stone this cell would stand in, itself included. */
  const stoneFile = (x: number, y: number): number => {
    let run = 1;
    for (let k = y - 1; k >= 0 && at(below, x, k) === gid('rock'); k--) run++;
    for (let k = y + 1; k < MAP_H && at(below, x, k) === gid('rock'); k++) run++;
    return run;
  };
  for (let y = 2; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (isWater(x, y) || isPath(x, y)) continue;
      if (at(below, x, y) !== 0) continue;
      /** 0 at the water's edge, growing with every tile inland. */
      const inland = Math.abs(x - riverCentre(y)) - riverHalf(y) - 1;
      /*
       * How far the stone reaches inland HERE -- and for long stretches, not at all.
       *
       * A constant reach of three gave the river two grey walls of even thickness running its
       * whole length, perfectly parallel, which is the single thing that made it read as a
       * municipal canal rather than a gorge. Real rivers pile stone on the outer bank of a bend
       * and leave the inner bank bare, and run through plain meadow in between. Because this field
       * is sampled at the tile's own x, the two banks of any given row get different values from
       * it, so one side can be a cliff while the other is grass.
       */
      const reach = bankField(x / 7.5, y / 7.5);
      if (reach < 0.46) continue;
      const span = (reach - 0.46) * 9;
      if (inland < 0 || inland > span) continue;
      /*
       * Thick at the edge and thinning inland, cut out of a field rather than sprinkled.
       *
       * Every decor tile in this set is a fully opaque 32x32 -- `rock` included -- so it paints
       * its own ground rather than a shape over the grass. A per-tile coin flip therefore does not
       * scatter boulders, it scatters hard-edged grey SQUARES through green, at exactly the tile
       * pitch. Thresholding a continuous field covers the same share of the bank in outcrops
       * several tiles across, with gaps between them, which is what the board's gorge is.
       */
      /*
       * ...AND IT HAS TO HAVE REAL GAPS IN IT, which the first attempt at this did not.
       *
       * Thresholding a field was the right instinct and the level was wrong: at the water's edge
       * the cut-off worked out at 0.05, which a field averaging 0.5 clears almost everywhere, so
       * the bank came out as a rectangle of identical boulders paved along the river and spilling
       * square-edged into the lawn. The cut now starts high and only falls to a little under half
       * at the very edge, so even the thickest stretch is scattered rather than paved, and the
       * second octave bites into the outline of each outcrop instead of cutting it straight.
       */
      const depth = 1 - inland / Math.max(span, 1);
      const field = scree(x / 3.1, y / 3.1) * 0.7 + scree(x / 1.45 + 29, y / 1.45 + 29) * 0.3;
      if (field < 0.58 - depth * 0.34) continue;
      if (stoneFile(x, y) > BOULDER_FILE) continue;
      set(below, x, y, gid('rock'));
      solid(x, y);
    }
  /*
   * A scree apron spilling out of the waterfall, so the north end reads as the head of a gorge --
   * thinning both with distance from the water and with distance downstream, because a fixed
   * threshold over a fixed nine-by-six box filled the box and printed a rectangle of stone across
   * the top of the map.
   */
  for (let y = 2; y < 9; y++)
    for (let x = Math.round(riverCentre(y)) - 4; x <= Math.round(riverCentre(y)) + 4; x++) {
      if (!inside(x, y) || isWater(x, y) || isPath(x, y) || at(below, x, y) !== 0) continue;
      const out = Math.abs(x - riverCentre(y)) / 4.5 + (y - 2) / 7;
      if (scree(x / 2.4, y / 2.4) < 0.3 + out * 0.6) continue;
      if (stoneFile(x, y) > BOULDER_FILE) continue;
      set(below, x, y, gid('rock'));
      solid(x, y);
    }

  // --- forest border and tree clusters ---------------------------------------
  /*
   * Purple's clearing, reserved BEFORE anything is planted in it.
   *
   * The first attempt cleared the decor layers in a square around the spawn after the fact, which
   * cut trees in half: a tree is a 2x1 trunk on `below` plus a 2x2 canopy two rows above it on
   * `above`, so a square that caught one and not the other left canopies floating in the air with
   * nothing under them and trunks standing bare. Refusing to plant inside the clearing in the
   * first place cannot produce a half tree.
   */
  /*
   * TWO TILES, NOT THREE, and the difference is 24 tiles of guaranteed bare lawn.
   *
   * This was a 7x7 square in which nothing may be planted, centred on a spawn pad that is 2x2 --
   * and because every later pass tests it too, nothing at all was planted there: no tree, no scrub,
   * no verge tuft, no flower. Forty-nine tiles of flat lit grass, in the exact middle of the one
   * frame a visitor looks at first, which is 22% of the real 19.41 x 11.22 camera -- not the 12%
   * of a 26x15 one this line used to claim -- and the single largest
   * contiguous void on the map. The product manager traced the word "creepy" partly to this: a
   * bright field evenly dotted with dark holes reads as watched, and the board never shows open
   * lawn larger than 3x3.
   *
   * A 5x5 is still more than Purple needs. She stands on two tiles, she needs somewhere to step in
   * every direction before she meets anything, and the verge sweep at the foot of the file plants
   * the ring around her pad with tufts and flower the way the board's Explore frame does.
   */
  const inClearing = (x: number, y: number): boolean =>
    Math.abs(x - SPAWN.x) <= 2 && Math.abs(y - SPAWN.y) <= 2;

  /*
   * MIRRORING, and why it is the only thing on this map that could fix the wallpaper.
   *
   * Hashing every 32x32 cell of the whole-map render counted 2520 cells and 87 distinct images:
   * 3.5% unique, one image on 22.3% of the map, five on 41.4%, with literal repeating motifs
   * printed across the border and canopy rows. Three previous passes attacked that by rearranging
   * WHERE tiles go -- thickets instead of a density field, clumped undergrowth, a wandering border
   * -- and the comb survived all of them, because the comb is not in the arrangement. At the time
   * of that count there were 53 tiles, four of them covering most of the ground, and no arrangement
   * of four images over 2520 cells can avoid repeating. (`TILE_NAMES` has since grown to 79 and is
   * not frozen; the argument is about the four GROUND tiles, so it did not move with the count.)
   *
   * Tiled keeps three mirror bits in the top of every gid and Phaser's loader honours them, so a
   * tile can be laid flipped at no cost: no new tile, no new painter, no new gid. Four orientations
   * of a grass tile are four different images to a hash and to the eye, so
   * mirroring multiplies the ground's vocabulary by four and takes the phase out of every lattice
   * at the same time. It is invisible to all six scored axes -- a mirror preserves the luma
   * histogram and the palette exactly -- which is precisely why the score kept saying the map was
   * close while it plainly was not.
   *
   * The four constants themselves are at MODULE scope, above `generateForestMap`, because the map
   * file is not the only thing that has to agree about them: `world.ts` renders the committed map
   * and has to honour the same bits in the same order, and it kept its own private copies of all
   * four until this round. Two files owning one wire format is how a change gets reported as landed
   * when it has not.
   */
  /**
   * The NAME of the tile on a layer, masked, or `''` where there is nothing.
   *
   * It lived four hundred lines from the bottom, beside the audit that uses it most, while four
   * passes above it read a tile back by name with their own `TILE_NAMES[at(layer, x, y) - 1]` and
   * no mask. Those four all run BEFORE the mirror pass, so they were correct; they were correct by
   * accident of ordering, and the comment directly above `BASE_GID` says what that costs if the
   * ordering ever changes. It is declared here, with the mask it applies, so that the masked read
   * is the easiest one to reach for anywhere in the file.
   */
  const nameAt = (layer: Layer, x: number, y: number): string =>
    TILE_NAMES[(at(layer, x, y) & BASE_GID) - 1] ?? '';
  const coin = valueNoise2D(20261041);
  /** Independent per-tile bits: `valueNoise2D` hashes exactly on integer coordinates. */
  const heads = (x: number, y: number, which: number): boolean => coin(x + which * 97, y) > 0.5;
  /*
   * WHICH WAY THE TREE AT THIS TRUNK FACES, asked once and answered the same way everywhere.
   *
   * A tree has to mirror as a WHOLE -- crown and trunk, and crown cell by crown cell -- or its two
   * halves meet at a seam down the middle. Until now the answer was written out twice, once where
   * the canopy is rebuilt and once where the trunks are flipped, and the pass that PLANTS a crown
   * did not ask it at all: it stamped the unflipped tile and let the rebuild swap it later. That was
   * survivable while nothing read the crown back, and it is not survivable now that planting has to
   * compare the incoming crown's own pixels against the one already sitting in the cell, because the
   * mask of a tile and the mask of its mirror are not the same mask.
   *
   * Sampled at about a third of a tile in x, so trees face the same way in runs of three or four and
   * a mirror seam between two neighbours is rare -- see the note on the canopy rebuild.
   */
  const facesLeft = (x: number, y: number): boolean => coin(x / 3.4 + 301, y) > 0.5;

  /*
   * THE WOOD IS A REGISTER OF TREES, not a pattern of tiles, and that is what lets crowns merge.
   *
   * A tree is a 2x1 trunk with a 2x2 crown two rows above it, and until now `plantTree` refused
   * the site if ANY of those six cells was occupied -- including by another tree's crown. Crown
   * overlap was therefore structurally impossible, and the map measured it exactly: 181 trees made
   * 715 canopy cells, which is 181x4 with nothing merged anywhere, and 174 of 250 horizontal
   * canopy runs were exactly two tiles long -- one lone crown with grass on both sides. Seventy
   * per cent of the forest was single trees standing apart on a lawn. The file's own comments
   * above promised "canopy touching canopy over whole regions" and the line below them forbade it.
   *
   * Letting crowns overlap breaks the old bookkeeping, though: two trees can now write to the same
   * cell of `above`, so the tile sitting there no longer says which tree put it there, and the old
   * tidy pass -- which inferred a tree from finding `canopy-bl` over a `trunk-l` -- would fell a
   * perfectly good tree the moment a neighbour's crown overwrote that one quarter. So the trees
   * are kept in a list, `clearArea` strikes off the ones it cuts into, and the whole canopy layer
   * is rebuilt from the survivors at the end. Half a tree then cannot exist by construction.
   */
  /*
   * ===========================================================================
   * THREE SCALES OF TREE, AND ONE SET OF INVARIANTS OVER ALL OF THEM.
   * ===========================================================================
   *
   * The tree owner has appended two more trees to `TILE_NAMES` -- appended, so no existing gid
   * moves and the committed map stays valid -- and they are the thing this map needed most. One
   * crown, at one scale, stamped 288 times, is why the forest was wallpaper, and no arrangement of
   * a single image over 2,520 tiles can avoid looking like an arrangement of a single image.
   *
   *   mid     (`trunk-l/r`, `canopy-*`)       2 cols wide, crown 2 rows above a 1-row trunk
   *   elder   (`elder-trunk-*`, `elder-*`)    3 cols wide, crown 3 rows above a 1-row trunk
   *   sapling (`sapling-*`)                   2 cols wide, one crown row above its own trunk row
   *
   * WHY A REGISTER OF KINDS RATHER THAN THREE COPIES OF THE PLANTING CODE. Every invariant this
   * file protects is a statement about a tree's FOOTPRINT: the lonely-tree sweep asks whether
   * another crown reaches the column beside this one, `clearArea` asks which trees a rectangle cuts
   * into, the canopy is rebuilt from the register so half a tree cannot exist, the connectivity
   * sweep fells whole trees so it cannot leave an invisible solid tile, and the audit at the foot
   * of the file fails the build on a canopy tile with no tree under it. Three hand-written copies
   * of that would be three chances to get one of them wrong, silently, in the one file where a
   * silent mistake is an invisible wall in a shipped game. So a kind is DATA -- its trunk tiles,
   * its crown cells, and nothing else -- and every pass reads the footprint off the kind.
   *
   * The mirrored name of a cell is the cell at the same row and the mirrored column, which is why
   * it is derived here rather than written out: a 3x3 crown mirrors about its middle column, and
   * writing that out nine times is nine chances to transpose two names and print a seam down the
   * middle of every mirrored elder on the map.
   */
  interface TreeKind {
    /** Trunk tiles, left to right, laid on `below` at the tree's own row. */
    readonly trunk: readonly string[];
    /** Crown cells as [dx, dy], dy negative for rows above the trunk row, laid on `above`. */
    readonly crown: readonly (readonly [number, number])[];
    /** The crown tile at [dx, dy], and the one that replaces it when the tree is mirrored. */
    readonly tileAt: (dx: number, dy: number) => string;
  }
  const grid = (prefix: string, cols: readonly string[], rows: readonly string[]): TreeKind => ({
    trunk: [],
    crown: rows.flatMap((_, ry) => cols.map((_c, cx) => [cx, ry - rows.length] as const)),
    tileAt: (dx, dy) => `${prefix}${rows[dy + rows.length]}${cols[dx]}`,
  });
  const KINDS: Record<string, TreeKind> = {
    mid: {
      ...grid('canopy-', ['l', 'r'], ['t', 'b']),
      trunk: ['trunk-l', 'trunk-r'],
    },
    elder: {
      ...grid('elder-', ['l', 'c', 'r'], ['t', 'm', 'b']),
      trunk: ['elder-trunk-l', 'elder-trunk-m', 'elder-trunk-r'],
    },
    /*
     * The sapling is ONE 64x64 drawing cut into four, trunk included, so its bottom row carries
     * both bark and leaf. That row goes on `below` like any other trunk -- Purple walks in front of
     * it -- and only the top row goes on `above`, where she passes behind the crown. Putting all
     * four on `above` would draw a knee-high shrub over her head.
     */
    sapling: {
      trunk: ['sapling-bl', 'sapling-br'],
      crown: [
        [0, -1],
        [1, -1],
      ],
      tileAt: (dx) => `sapling-t${(['l', 'r'] as const)[dx]}`,
    },
  };
  /** Mirroring swaps the columns and keeps the row, which a 3-wide crown needs and a 2-wide survives. */
  const mirroredTile = (k: TreeKind, dx: number, dy: number): string =>
    k.tileAt(k.trunk.length - 1 - dx, dy);
  const mirroredTrunk = (k: TreeKind, dx: number): string => k.trunk[k.trunk.length - 1 - dx]!;

  interface Tree {
    x: number;
    y: number;
    k: TreeKind;
    /**
     * Which way this tree faces, DECIDED ONCE AND REMEMBERED, rather than re-derived from position.
     *
     * It used to be `facesLeft(t.x, t.y)` asked again at each of the three places that need it --
     * planting, the canopy rebuild, the trunk flip -- on the argument that a pure function of
     * position cannot disagree with itself. True, and it is the wrong property to want. The field is
     * sampled at a third of a tile in x and at FULL resolution in y, so two crowns one row apart are
     * independent draws: the trees owner measured mirrored crowns sitting directly against unmirrored
     * ones all over the map, and bilateral symmetry is the one repetition the eye finds instantly.
     * 69 such seams on the horizontal axis alone, counted off the generated map.
     *
     * A field cannot fix that, whatever its period, because a field has boundaries and a boundary
     * between two values IS the seam. What fixes it is that the answer stops being a function of
     * position at all: the first tree of a mass draws from the field, and every tree that grows
     * against it ADOPTS its answer, so a merged mass faces one way throughout and a seam can only
     * occur between two masses that do not touch. Storing it is what makes the three readers agree
     * about a decision that is no longer re-computable.
     */
    flip: boolean;
    /**
     * Planted deliberately against the sand by the road's treeline pass, and therefore exempt from
     * the verge sweep that fells scenery off a shoulder.
     *
     * The first version of that pass asked the sweep's own `shoulderField` before planting, so that
     * the two could not disagree. They did not disagree, and it still did not work: that field is
     * sampled along a line of near-constant y all the way across the map, the line crosses about
     * fifteen lattice cells, and for this seed most of them sit below the threshold. Seventeen of
     * the forty-seven road columns were even offered a tree, and six kept one. A shared threshold on
     * an unlucky row is not agreement, it is two passes being wrong together -- which is the failure
     * the note on `pressesTheSand` already records once, from the other direction.
     *
     * A flag cannot be unlucky. The pass that wants a treeline says which trees it is, and the sweep
     * spares exactly those. Everything else on a shoulder is still scenery and still comes out.
     */
    verge?: boolean;
    /**
     * Planted by the camera-framing pass, on the two rows a camera's top edge cuts.
     *
     * It is a second flag rather than a reuse of `verge` because the two are spared on different
     * terms. A verge tree was put against the sand deliberately and the sweep leaves it wherever
     * the road is two lanes wide. A framing tree is usually nowhere near the road -- it is beside a
     * one-wide FOOTPATH, which the sweep clears on both sides, and that is how three columns of the
     * hero shot's canopy were felled by a pass with no opinion about cameras at all.
     */
    framing?: boolean;
  }
  const trees: Tree[] = [];
  const CANOPY_GIDS = new Set([
    ...Object.values(KINDS).flatMap((k) => k.crown.map(([dx, dy]) => gid(k.tileAt(dx, dy)))),
    // The four elder overlaps are canopy too: only the pass after the rebuild lays them, but every
    // audit that asks "is this cell crown" has to say yes to them.
    ...[
      'elder-tr-over-mc',
      'elder-tl-over-mc',
      'elder-mr-over-bc',
      'elder-ml-over-bc',
      'elder-tc-over-mr',
      'elder-tc-over-ml',
      'elder-tl-over-sapling-tr',
      'elder-tr-over-sapling-tl',
      'elder-tl-over-br',
      'elder-tr-over-bl',
    ].map(gid),
  ]);
  /** Masked, because the canopy is re-stamped mirrored and a flipped gid is not that gid. */
  const isCanopy = (x: number, y: number): boolean => CANOPY_GIDS.has(at(above, x, y) & BASE_GID);
  const TRUNK_GIDS = new Set(Object.values(KINDS).flatMap((k) => k.trunk.map((n) => gid(n))));
  /**
   * The tile a tree stands on, whichever way round it faces and whatever its scale.
   *
   * The mirror pass swaps the halves as well as flipping them, so a mirrored tree carries
   * `trunk-r` on its LEFT cell. Asking "is there a trunk here" rather than "is this the left half"
   * is the only form of the question that survives that.
   */
  const isTrunk = (x: number, y: number): boolean => TRUNK_GIDS.has(at(below, x, y) & BASE_GID);
  /** Whether a tree still on the register has a crown over this cell. */
  const crownsOver = (t: Tree, x: number, y: number): boolean =>
    t.k.crown.some(([dx, dy]) => t.x + dx === x && t.y + dy === y);

  /*
   * ===========================================================================
   * THE CROWN BITE, AND WHY A CROWN MAY ONLY COVER WHAT IT REPAINTS.
   * ===========================================================================
   *
   * WHAT SHIPPED. Letting crowns overlap was right and it was implemented as an unconditional
   * `set(above, ...)`, and `above` holds exactly one gid per cell. So the second tree's quarter did
   * not composite over the first's, it REPLACED it -- and a crown quarter is transparent over a
   * quarter to a half of its own square. Where the two tiles' opaque regions were complementary, the
   * ground showed through a 32x32 square hole punched in a neighbour's canopy, with no keyline on
   * the cut edge, which at 1x is a window of lawn in the middle of a tree.
   *
   * Counted off the generated map, and this is the measurement rather than an impression: canopy-tl
   * 209 against canopy-bl 142, canopy-tr 206 against canopy-br 144, elder-tc 42 against elder-bc 19,
   * elder-tl 32 against elder-bl 17, elder-tr 40 against elder-br 22. A crown lays its quarters in
   * equal numbers, so every one of those differences is a destroyed quarter: 185 holes in 1,121
   * canopy cells. A sixth of the forest was a hole.
   *
   * WHY NOT A SECOND `above` LAYER, which is the fix that composites properly. `forest-scene.ts`
   * creates its layers by NAME -- `ground`, `decor-below`, `decor-above` -- so a fourth tile layer
   * is written into the map and never drawn by the game. That is apps/game's change to make, not
   * this file's, and a layer the game never draws is worse than the bite: it is invisible here and
   * invisible there. Raised, not taken.
   *
   * SO THE RULE IS THE OTHER ONE: a crown cell that already holds a crown may be taken only if the
   * incoming tile is opaque over every pixel the sitting tile is opaque over. Then nothing the
   * covered tile drew is lost -- its interior keyline goes, which is exactly what two crowns merging
   * into one mass means, and its silhouette cannot, because every pixel of it is repainted.
   *
   * THIS IS NOT "FORBID OVERLAP AGAIN", and the masks say so rather than the prose. Measured off
   * the painters, 29 ordered pairs of crown tiles satisfy it: `elder-mc` and `elder-bc` are fully
   * opaque so they swallow anything, and every mid quarter covers the elder quarter in the same
   * corner, because an elder's corner cell carries less of its bigger crown. So a stand of elders
   * absorbs the mid trees growing between them and a mid tree closes over a sapling -- overlap
   * BETWEEN SCALES, which is the interlock the three scales were added for, while two identical mid
   * quarters meeting corner to corner, which is the case that made the holes, is refused and the
   * site is left to a tree that fits.
   *
   * WHAT WAS TRIED INSTEAD, AND WHAT THE RENDER SAID. Since refusing a site costs merging, the
   * obvious alternative is to RESOLVE a contested cell rather than refuse it, by laying the one
   * crown tile that is opaque over all 1,024 of its pixels -- `elder-mc`, the middle of an elder's
   * 3x3 -- on the argument that a cell two crowns both reach is interior to the mass they make and
   * the inside of a crown has no keyline in it. It cost no pixel and it was plainly worse: at 3x on
   * the spawn camera, 338 of 1,122 canopy cells came out as that tile, each a flat pale square with
   * dead-straight edges, and the ones that landed at the OUTSIDE of a mass gave it square corners
   * with no keyline at all. The board's merged crowns (`crop 360 180 400 300 2.4`) keep the lumpy
   * clump texture and the deep-teal underside right through the join and carry one scalloped keyline
   * round the whole mass; a flat tile cannot do either. Rejected on the render, not on the numbers.
   *
   * The mask is taken in the orientation the tile is actually STAMPED in, mirror bit included: the
   * mirror of a crown quarter is a different shape, and comparing unflipped masks would have let
   * through exactly the overlaps the mirror pass then broke.
   */
  const crownMask = new Map<number, readonly boolean[]>();
  const maskOf = (tile: number): readonly boolean[] => {
    const cached = crownMask.get(tile);
    if (cached) return cached;
    const img = new Img(TILE, TILE);
    TILE_PAINTERS[TILE_NAMES[(tile & BASE_GID) - 1]!]!(img);
    const flipped = (tile & FLIP_H) !== 0;
    const mask: boolean[] = [];
    for (let py = 0; py < TILE; py++)
      for (let px = 0; px < TILE; px++)
        mask.push(img.get(flipped ? TILE - 1 - px : px, py)[3] !== 0);
    crownMask.set(tile, mask);
    return mask;
  };
  /** Whether `incoming` paints every pixel `sitting` painted, both as they will be laid. */
  const coversWholly = (incoming: number, sitting: number): boolean => {
    if (incoming === sitting) return true;
    const over = maskOf(incoming);
    return maskOf(sitting).every((opaque, i) => !opaque || over[i]);
  };
  /**
   * Lay a crown tile into a cell that may already hold one, losing nothing either way.
   *
   * Used both when a tree is planted and when the canopy is rebuilt from the register, which is the
   * only way the two can agree about what ends up in a shared cell. Planting has already refused any
   * site where neither tile covers the other, so the bigger of the two always wins and the cell
   * always ends up opaque over everything that was ever drawn in it. `unresolved` counts the case
   * that should therefore be impossible, and the audit at the foot of the file fails the build on
   * it: if a later pass ever stamps a crown without going through the planter, that is the line that
   * says so rather than a hole somebody notices in a screenshot.
   */
  let unresolved = 0;
  const layCrown = (x: number, y: number, tile: number): void => {
    const sitting = at(above, x, y);
    if (sitting === 0 || !isCanopy(x, y)) return set(above, x, y, tile);
    if (coversWholly(tile, sitting)) return set(above, x, y, tile);
    if (coversWholly(sitting, tile)) return;
    unresolved++;
    // The more opaque of the two, so the hole this should never reach is as small as it can be.
    if (maskOf(tile).filter(Boolean).length > maskOf(sitting).filter(Boolean).length)
      set(above, x, y, tile);
  };

  /**
   * Which way the tree occupying each cell faces, so a tree growing against one can match it.
   *
   * Written for every cell a planted tree touches -- trunk and crown -- and never erased. A tree
   * struck off by `clearArea` leaves its answer behind on purpose: the next tree to grow into that
   * ground then faces the way the mass there faced, which is the way its surviving neighbours still
   * face. Erasing would hand that site back to the field and put the seam back.
   */
  const facingAt = new Map<number, boolean>();
  /**
   * The facing a tree of this kind at this site must take: its neighbours' if it has any, the
   * field's if it is the first tree of a mass.
   *
   * The footprint is read off the kind and widened by one cell, because the rule is about crowns
   * that TOUCH. Reading only the cells the tree itself occupies would let a tree land flush against
   * a mass it never overlaps and face the other way, which is the commonest butterfly of all: two
   * crowns side by side with a mirror line between them.
   */
  const facingFor = (k: TreeKind, x: number, y: number): boolean => {
    let left = 0;
    let right = 0;
    /*
     * A SIDEWAYS neighbour counts for three, and that is where the butterfly actually lives. The
     * symmetry the eye catches is two crowns SIDE BY SIDE about a vertical mirror line; a crown
     * above another one is two different rows of a mass and reads as depth whichever way each
     * faces. Counting all four directions equally let a vertical neighbour outvote a horizontal one
     * and put the seam back on the axis it is visible on.
     *
     * It is worth 35 seams to 32, and the honest reading of that small number is that the weighting
     * is not what the remaining seams are made of. Adoption took them from 69 to about 32 and the
     * rest are STRUCTURAL: a tree that grows into the gap between two masses which face opposite
     * ways has to seam with one of them, and no local rule can decide that. Removing them outright
     * needs the masses themselves to be two-coloured before anything is planted, which is a change
     * to how the wood is laid out rather than to how a tree picks its facing. Flagged, not taken.
     */
    const cells = [...k.crown, ...k.trunk.map((_n, dx) => [dx, 0] as const)];
    const around: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0, 3],
      [1, 0, 3],
      [-1, 0, 3],
      [0, 1, 1],
      [0, -1, 1],
    ];
    for (const [dx, dy] of cells)
      for (const [ex, ey, weight] of around) {
        const seen = facingAt.get((y + dy + ey) * MAP_W + (x + dx + ex));
        if (seen === undefined) continue;
        if (seen) left += weight;
        else right += weight;
      }
    if (left === right) return facesLeft(x, y);
    return left > right;
  };

  /*
   * ===========================================================================
   * THE BRICK COURSE: A TRUNK BURIED UNDER A CROWN, AND THEN ANOTHER ONE ABOVE IT.
   * ===========================================================================
   *
   * WHAT THE CLIENT IS LOOKING AT. "Look at the trees there in the middle, they're messed up."
   * Rendered at the spawn camera and at 5x, the trees in the middle of that frame are a vertical
   * FILE of crowns -- four of them, stacked -- with a dead-straight dark rule along every tile
   * boundary between them and no trunk, no bark and no ground anywhere in the column. It reads as
   * a course of green bricks, or as one tree drawn four times and cut up. It is the single worst
   * thing in the wood and it is placement, not painting.
   *
   * HOW IT HAPPENS, and it is not an overlap bug. Two layers, no coverage rule between them: a
   * tree's crown goes on `above` and a tree's trunk goes on `below`, and `above` draws over
   * `below`. So a tree standing one row higher than its neighbour has its TRUNK painted and then
   * painted over. Measured on the committed map, 248 cells are a crown over another tree's trunk
   * and 56.6% of all trunk and root art drawn on this map -- 81,426 pixels of it -- never reaches
   * the screen.
   *
   * ONE OF THEM IS A WOOD. A SECOND ONE DIRECTLY ABOVE IT IS A BRICK COURSE. A single buried
   * trunk is a tree standing behind a neighbour's crown, which is what a wood looks like and what
   * the note on the trunk loop above is defending; the crown above it still has that tree's own
   * trunk under its own feet, so the column reads as depth. Stack TWO and there is no trunk left
   * anywhere in the run: the only thing between one crown's hem and the next crown's cap is the
   * tile boundary, and the hem keyline draws it as a rule. The committed map has 35 runs of two,
   * seven of three, and one each of four, five and six -- the worst at column 54, rows 27 to 32.
   *
   * SO THE CAP IS ON THE RUN, NOT ON THE COUNT. Refusing every buried trunk was tried in the round
   * that introduced the scales and is written up on the trunk loop below: it pins every tree onto
   * its own three-row lattice and gives back the orchard. A cap keeps the interlock -- a tree may
   * still stand behind its neighbour's crown, and 142 of them do -- and takes out only the ones
   * that close a file.
   *
   * AND IT IS SWEPT, NOT REFUSED, which is the half of this that took two attempts to get right.
   * The first version declined the site inside `plantKind`, which is where a tree can still be
   * offered somewhere else, and it was plainly wrong: the passes that plant for a REASON do not
   * take no for an answer usefully. Refusing them cost 13 of the 20 columns of the arrival
   * camera's top edge, put a six-tile lattice file down column 54 and opened a hole in the garden's
   * enclosure -- three composition guards firing at once, every one of them a pass being denied the
   * tree it was written to place. So the rule lives in the thinning sweep below instead, with the
   * wall and the topiary file: a shape that does not exist until several trees have gone in, judged
   * once they all have, with framing and verge trees spared exactly as they are there.
   *
   * It is asserted again at the foot of the file, where it is the guard: felling can only shorten a
   * run and the canopy rebuild replays the register, so anything that lengthens one afterwards is a
   * pass stamping a crown or a trunk outside the register, which is what the audit should say out
   * loud rather than leave in a screenshot.
   */

  const plantKind = (kind: string, x: number, y: number): boolean => {
    const k = KINDS[kind]!;
    /*
     * The tile this tree will put in a crown cell, in its final orientation. Decided here rather
     * than at the rebuild because the overlap test above compares pixels, and the rebuild replays
     * the facing this tree recorded, so the two can never disagree about which way a tree faces.
     */
    const flip = facingFor(k, x, y);
    const crownGid = (dx: number, dy: number): number =>
      flip ? gid(mirroredTile(k, dx, dy)) + FLIP_H : gid(k.tileAt(dx, dy));
    /*
     * The TRUNK's own tiles still have to be genuinely empty on the ground layer, and they are
     * the only cells that do: they are the collision footprint the reachability tests walk around.
     *
     * One of them also has to be clear of other crowns, which is the whole of what is left of
     * the old rule. A trunk may stand behind a neighbour's crown -- that is what a wood looks
     * like, and refusing it is what pinned every tree onto its own three-row lattice -- but a tree
     * with EVERY half hidden is a solid tile the player cannot see, and it contributes nothing to
     * the picture it is paying for.
     */
    let visible = false;
    for (let dx = 0; dx < k.trunk.length; dx++) {
      const tx = x + dx;
      if (!inside(tx, y) || isPath(tx, y) || isWater(tx, y) || inClearing(tx, y)) return false;
      if (at(below, tx, y) !== 0) return false;
      if (at(above, tx, y) === 0) visible = true;
      else if (!isCanopy(tx, y)) return false;
    }
    if (!visible) return false;
    /*
     * The CROWN may land on another crown -- where it repaints all of it. That permission is what
     * turns an orchard into a wood: a tree one row down and one column across from its neighbour
     * shares a cell with it, so runs come out odd -- three, five, seven -- and the crowns interlock
     * into a mass with real clearings punched in it rather than a dot grid with a lawn showing
     * through every gap. The limit on it is the long note above `crownMask`: one gid per cell means
     * a cover is a REPLACEMENT, so a tile that does not repaint what it covers leaves a hole.
     *
     * It may not land on anything else up there, which at present means the market awning; and it
     * stays off the track, because the road is the thing the player follows and a crown hanging
     * over it hides the one line of sand that says where to go.
     */
    for (const [dx, dy] of k.crown) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inside(tx, ty) || inClearing(tx, ty) || isPath(tx, ty)) return false;
      if (at(above, tx, ty) === 0) continue;
      if (!isCanopy(tx, ty)) return false;
      const sitting = at(above, tx, ty);
      const incoming = crownGid(dx, dy);
      if (!coversWholly(incoming, sitting) && !coversWholly(sitting, incoming)) return false;
    }
    for (const [dx, name] of k.trunk.entries()) {
      set(below, x + dx, y, gid(name));
      solid(x + dx, y);
    }
    for (const [dx, dy] of k.crown) layCrown(x + dx, y + dy, crownGid(dx, dy));
    for (const [dx, dy] of [...k.crown, ...k.trunk.map((_n, dx) => [dx, 0] as const)])
      facingAt.set((y + dy) * MAP_W + (x + dx), flip);
    trees.push({ x, y, k, flip });
    return true;
  };
  /** The mid tree, which is what every pass that just wants "a tree here" still means. */
  const plantTree = (x: number, y: number): boolean => plantKind('mid', x, y);

  /*
   * HOW MUCH WOOD A TILE WANTS. This is the change the map needed most.
   *
   * What was here before was ninety plant attempts at uniformly random positions, plus a single
   * row of trees around the border. Uniform random is the problem, not the ninety: scattering a
   * fixed number of trees evenly over 2520 tiles produces a lawn with trees ON it, every tree
   * standing alone in its own circle of grass, which is exactly what the render showed. The board
   * is the opposite -- canopy touching canopy over whole regions, and then a real clearing.
   *
   * Measured with one classifier over both images, open light grass was 65% of our spawn camera
   * against 28% of the board's Explore frame. That 2.3x is the gap, and no painter can close it:
   * a better tree painted in the same place is still a tree alone on a lawn.
   *
   * So density becomes a FIELD rather than a count. A low-frequency octave decides where the wood
   * is and where the glades are; a finer one breaks the region edges so they do not read as
   * contours. Trees are then offered every position on the map in random order and planted where
   * the field is willing, which packs them tight in the wood and leaves the glades genuinely open.
   * Random order matters: scanning row by row packs trees into a grid, and a grid of trees looks
   * planted.
   */
  /*
   * THE LAST ROW IS A PLANTING ROW, and excluding it was the whole of why the bottom of the world
   * was a hedge.
   *
   * This ran `y < MAP_H - 1`, so no trunk was ever offered row 41. A trunk carries its crown two
   * rows ABOVE it, so a tree on the last row needs nothing off the map and takes nothing from the
   * walked band -- but with the row closed to planting, the south treeline's trunks all landed on
   * row 40 and row 41 fell to `sealBorder`, which is scrub. Printed, the bottom of the map read:
   *
   *     row 40  #ooooooo...........oo#oooo##..ooooooo...ooTToooo.ooooo.oooo#
   *     row 41  ########oooo##oo##########################oo################
   *
   * -- fifty-two tiles of bush in a row along the bottom edge of the world, in one unbroken run of
   * twenty-six, with not one crown over it. That is the "dotted line along the top and bottom edges
   * of the world" the design board names as the clearest "the map does not make sense" artefact,
   * arrived at a second time in a different material after the toadstools were taken out of it.
   *
   * The band is still sealed and still solid: `sealBorder` only plants where `below` is empty and
   * calls `solid` on every border cell either way, so a tree standing there replaces the hedge
   * without changing one tile of collision. The edge of the world is now a treeline, which is what
   * the file's own note on `sealBorder` promised and could not deliver while this loop stopped
   * short.
   */
  const sites: [number, number][] = [];
  for (let y = 2; y < MAP_H - 1; y++) for (let x = 0; x < MAP_W - 1; x++) sites.push([x, y]);
  for (let i = sites.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [sites[i], sites[j]] = [sites[j]!, sites[i]!];
  }
  /*
   * ...AND THE LAST ROW IS APPENDED AFTER THE SHUFFLE, which is not fussiness.
   *
   * Row 41 belongs in this list for the reason above, and the first version of that change simply
   * widened the loop. That re-rolls the Fisher-Yates over a list 59 entries longer, so every tree
   * on the map moves, and measured it cost 3.3 points of canopy across the whole world and about
   * 0.03 of score distance on every one of the four frames -- a forest rebuilt from scratch as the
   * price of a hedge at the bottom edge.
   *
   * Appended after the shuffle, the first 2,301 sites come out in exactly the order they did
   * before, so rows 2 to 40 are planted tree for tree as they were, and the last row is offered at
   * the end, left to right, into whatever the density field still allows. A single row filled in
   * scan order is the one case where "scanning packs trees into a grid" does not apply: there is
   * only one row, so there is no lattice for it to pack into.
   */
  for (let x = 0; x < MAP_W - 1; x++) sites.push([x, MAP_H - 1]);
  /** The field that decides which SCALE a site wants, read in both passes so they agree. */
  const grainAt = (x: number, y: number): number => lobe(x / 5.5 + 211, y / 5.5 + 211);
  /**
   * Which stretches of verge keep their trees.
   *
   * Declared here rather than beside the sweep that spares them, because the road's treeline is
   * PLANTED from it as well as filtered by it: a verge tree planted where this field is low would
   * be felled by that sweep a couple of thousand lines later, and the pass that planted it would
   * report a treeline that is not on the finished map. One field, read twice, is the only
   * arrangement in which those two passes cannot disagree.
   */
  const shoulderField = valueNoise2D(20261057);
  /*
   * ===========================================================================
   * THE ELDERS GO IN FIRST, AND THAT ONE LINE IS MOST OF THE SCALE PROBLEM.
   * ===========================================================================
   *
   * Counted off the generated map: 160 mid trees, 24 elders, 25 saplings. Seventy-six per cent of
   * everything the camera shows was the same 2x2 crown, which is why the 375 title frame reads as a
   * lattice of identical crowns with lawn round every one -- the three scales existed in the tileset
   * and not in the picture.
   *
   * THE BANDS WERE NOT THE LIMIT. They were tuned three times on the theory that they were, and the
   * share barely moved, because the thing refusing the elders was never the field -- it was the
   * ORDER. Sites were offered once, in random order, and each site asked for the biggest tree it
   * could take. An elder needs three clear columns and three clear crown rows; a mid tree needs two
   * and two. So by the time any given deep-wood site came up, a mid tree had usually already been
   * planted across one of the three columns the elder needed, and the elder was refused by ground
   * its own wood had given away to a smaller tree a few hundred draws earlier. Widening the band
   * cannot fix that: it offers the elder more sites that are already taken.
   *
   * Running the scales as separate passes fixes it outright. The elders walk the whole map while the
   * ground is empty and take the stands the field gives them; the mid trees then fill between them,
   * which is the arrangement that merges, because every mid quarter covers the elder quarter in its
   * own corner; and the saplings come last, into the gaps at the treeline where nothing else fits.
   * That is also the order a wood actually grows in, which is why the result looks like one.
   */

  /*
   * ===========================================================================
   * AND NO THIRD TREE ON THE SAME ANCHOR COLUMN, which is what a grove is not.
   * ===========================================================================
   *
   * `docs/DESIGN_BOARD.md` section 3's third complaint, and nobody had named it before: trees plant
   * in dead-straight vertical files of three and four crowns, plainly visible beside the garden
   * fence and in the cottage frame. It reads as a topiary column rather than as a grove.
   *
   * IT IS A FOOTPRINT ARTEFACT, not a field artefact, which is why no amount of tuning the woods
   * moved it. A mid tree is two columns of trunk under a 2x2 crown and an elder three under a 3x3,
   * so the tightest packing the overlap rule allows is the next tree two rows up in the SAME
   * columns -- and once a stretch of the field is willing, greedy planting walks straight up it.
   * Counted on the generated map: files of four and five at a two-row pitch, with every crown's
   * left edge on the same column.
   *
   * So a site whose anchor column already carries two trees within six rows is offered ONE COLUMN
   * ACROSS instead of refused. The wood keeps its mass -- the tree still goes in, a tile over --
   * and the left edges stop lining up, which is the whole of what the eye was reading. Refusing
   * outright was the first version and it thinned the deep wood by about a tenth for nothing: the
   * problem was never how many trees there are in a column, it was that they were in a LINE.
   */
  /*
   * A MATE IN A FILE IS ONE WITH DAYLIGHT BETWEEN THE CROWNS. Two trees in the same column two
   * rows apart have crowns that touch or overlap, and that is a mass -- the thing the overlap rule
   * was relaxed for. What reads as topiary is crowns that line up with grass showing between them,
   * which on a 2x2 crown means a trunk-row gap of three or more. Counting the merged pairs as
   * files was the first version and it shifted trees that were doing no harm.
   */
  const fileMate = (ty: number, y: number): boolean => {
    const gap = Math.abs(ty - y);
    return gap >= 3 && gap <= 7;
  };
  const filed = (x: number, y: number): boolean =>
    trees.filter((t) => t.x === x && fileMate(t.y, y)).length >= 2;
  const plantSpaced = (kind: string, x: number, y: number): boolean => {
    if (!filed(x, y)) return plantKind(kind, x, y);
    for (const nx of [x + 1, x - 1]) if (!filed(nx, y) && plantKind(kind, nx, y)) return true;
    return false;
  };

  for (const [x, y] of sites) {
    const want = woodAt(x, y);
    /*
     * Deeper in than the mid tree's floor, and masked by the grain, so elders arrive as STANDS of
     * three or four rather than evenly through the wood. An elder every few tiles everywhere would
     * swap one scale of wallpaper for another, and the point of three scales is depth: big trees
     * grouped, with smaller ones coming up between them and around the edge.
     */
    if (want < 0.56 || grainAt(x, y) < 0.44) continue;
    plantSpaced('elder', x, y);
  }
  for (const [x, y] of sites) {
    const want = woodAt(x, y);
    /*
     * A hard floor, and then a steep curve above it.
     *
     * The floor is the part that matters and the part the first attempt lacked. Without it the
     * weakest reach of every thicket still planted one tree in three or four, and since sixteen
     * overlapping blobs touch most of the map, "one in four everywhere" is exactly the even
     * scatter the field was introduced to abolish. Refusing outright below 0.4 is what makes a
     * glade a glade: not fewer trees, none.
     */
    /*
     * A HARD EDGE AND A SOLID MIDDLE, with barely a tile of fringe between them.
     *
     * What was here was a probability curve running from nothing at 0.4 to certainty at about
     * 0.7, which means a third of the thicket's area was planted at a coin flip. A coin flip over
     * a 2x3 footprint does not thin a wood, it dissolves its edge into scatter: measured, 40% of
     * all horizontal canopy runs were two tiles -- a single crown with grass on both sides -- and
     * almost all of them were in that margin. The board's woods have a drawn outline. So the
     * field's own level set is the treeline, the fringe is one tile of dither so the contour is
     * not a traced curve, and everything inside it is planted.
     */
    if (want < 0.44) continue;
    if (want < 0.5 && rnd() > (want - 0.44) / 0.06) continue;
    /*
     * WHICH SCALE, and it is decided by where the tile sits in its wood rather than by a die.
     *
     * Rolling the scale per tree is the obvious thing and it produces a wood of mixed trees evenly
     * mixed, which in a camera 19.41 tiles wide reads as noise: three sizes alternating is as regular as one
     * size repeating, and it loses the one thing three scales are worth having for, which is DEPTH.
     * A wood reads as deep when its big trees are grouped -- a stand of elders with saplings coming
     * up between them and mid trees around the edge -- because that is what a wood does.
     *
     * So the scale is read off the SAME field that planted the tree. Deep in a wood, where `want`
     * is at its highest, elders; out at the treeline, where the field is near its own floor and the
     * wood is thinning into the glade, saplings; the mid tree everywhere between, which is most of
     * it. That gives every wood a heavy middle and a soft edge for free, and it means the treeline
     * round a glade is drawn in the smallest crown, so a clearing opens gradually instead of ending
     * at a wall.
     *
     * A coarse field breaks the grouping up just enough that the bands are not contour lines: the
     * elders arrive as stands of three or four rather than as a disc in the middle of each wood.
     *
     * ORDER MATTERS AND IT IS THE REASON ELDERS ARE TRIED FIRST. Sites are offered in random order,
     * so by the time a site deep in a wood comes up its neighbours may already be planted, and an
     * elder needs three clear columns where a mid tree needs two. Asking for the biggest tree the
     * site can take, and falling back, means the big trees are not simply the ones that happened to
     * be offered early.
     */
    /*
     * ...AND THE BANDS MOVED, twice over, because both things they are cut against moved.
     *
     * The margin woods came down a tile or two of radius each and the border rim came down with
     * them, so `want` is lower over most of the map than it was: bands tuned to the old field put
     * `big` out of reach almost everywhere and `small` within reach almost everywhere. And the
     * overlap rule refuses a site the OTHER two scales cannot take, which the unconditional sapling
     * fallback below then answered with a shrub. Counted on the first render after both changes: 8
     * elders, 135 mid trees and 125 saplings, against 37, 220 and 31 before. A wood of waist-high
     * shrubs is not what three scales were added for -- the point of them is DEPTH, which needs the
     * big trees to be there at all.
     */
    /*
     * ...AND ELDERS ARE DELIBERATELY COMMON NOW, which is the one lever the overlap rule leaves.
     *
     * `elder-mc` and `elder-bc` are the only crown cells that are opaque over their whole square, so
     * they are the only cells another crown can be laid over without punching a hole -- and every
     * mid quarter covers the elder quarter in its own corner. An elder is therefore the one tree
     * other trees can genuinely grow INTO, and a stand of them is where the wood is allowed to
     * interlock rather than merely touch. Fewer elders is fewer merges, which is why the band is
     * wide rather than reserved for the deepest wood.
     */
    /*
     * ...AND THE ELDER IS STILL TRIED HERE, for the sites the first pass could not take. A site
     * inside the elder band whose third column was occupied when the elder pass reached it may be
     * clear by now -- nothing has been planted since but mid trees, and a mid tree that failed its
     * own test leaves the ground as it found it. This is the cheap half of a second pass and it
     * costs one call.
     */
    const grain = grainAt(x, y);
    const big = want > 0.56 && grain > 0.44;
    /*
     * The sapling band is WIDER than it was, and it is the other half of the scale mix. A sapling is
     * the board's background tree: a whole tree inside one 2x2, which is the only thing that fits
     * between two crowns that are already touching. 25 of them on a map of 209 trees is not a scale,
     * it is a rounding error, and it left every treeline on the map drawn in the one mid crown -- so
     * a wood ended at a wall of identical 2x2s instead of thinning into the grass.
     */
    const small = want < 0.58 && grain < 0.5;
    if (big && plantSpaced('elder', x, y)) continue;
    if (small && plantSpaced('sapling', x, y)) continue;
    if (plantSpaced('mid', x, y)) continue;
    /*
     * A refused site is only answered with a sapling out at the TREELINE. In the middle of a wood a
     * refusal now means the crowns there cannot be stacked without punching a hole in one of them,
     * and the honest answer to that is the empty trunk row the wood already has, not a seedling
     * wedged under a canopy where nobody will ever see it and the floor sweep will cover it anyway.
     */
    if (want < 0.62) plantSpaced('sapling', x, y);
  }
  /*
   * ===========================================================================
   * THE INFILL: SAPLINGS INTO THE GAPS, which is what turns a dot field into a wood.
   * ===========================================================================
   *
   * MEASURED, AND IT IS THE NUMBER THAT EXPLAINS THE RENDER. Flood the map over everything that is
   * neither canopy nor trunk, and the answer is ONE region of 1,104 tiles -- 44 per cent of the
   * world -- touching column 0 and column 59 and row 0 and row 41. The wood has no interior. Six
   * hundred trees' worth of canopy is laid out as islands in a single continuous lawn, which is
   * precisely why the frames read as "a tree every three tiles" however the density is tuned: a
   * mass is not made by having enough trees, it is made by the ground between them running out.
   *
   * THE GAP IS STRUCTURAL AND THE FIRST TWO PASSES CANNOT CLOSE IT. A mid tree is two columns of
   * trunk under a 2x2 crown, so the tightest the field can pack them still leaves the trunk row of
   * one tree showing beside the crown of the next, and the overlap rule refuses any site where two
   * crowns would punch a hole in each other -- correctly, and that refusal is a hole in the canopy
   * every time it fires. Both effects leave one- and two-tile gaps all through the wood, and a wood
   * with a gap every three tiles is a lawn with trees on it.
   *
   * A SAPLING IS THE ONLY THING THAT FITS. It is a whole tree inside a 2x2 -- its bottom row carries
   * bark and leaf together and goes on `below`, its top row is the only crown it has -- so it needs
   * no clear trunk row below a clear crown and no three-row column. That is exactly the shape of the
   * gaps, and it is the board's own answer: its wood is big crowns with small ones pushed in
   * between, which is what gives the mass a scalloped edge instead of a row of circles.
   *
   * ONLY INTO GAPS THAT ARE ALREADY IN A WOOD, which is what keeps this from being "more trees". It
   * asks for canopy or a trunk on at least two sides before it plants: a tile with wood all round it
   * is a hole in a mass and wants closing, a tile with wood on one side is the EDGE of that mass and
   * must stay open or the mass loses the scalloped outline it is being built for, and a tile with
   * none is a glade and is none of this pass's business.
   */
  let infilled = 0;
  for (const [x, y] of sites) {
    const around = [...NEIGHBOURS, [1, 1], [-1, 1], [1, -1], [-1, -1]].filter(
      ([dx, dy]) => isCanopy(x + dx!, y + dy!) || isTrunk(x + dx!, y + dy!),
    ).length;
    if (around < 4) continue;
    if (plantKind('sapling', x, y)) infilled++;
  }
  console.log(`  infill: ${infilled} sapling(s) into gaps inside the wood`);

  /*
   * A few trees standing out in the open -- in COPSES of two or three, never singly.
   *
   * Without any, a glade reads as a mown lawn with a wall of wood around it: the boundary between
   * thicket and clearing is the only tree line on the map, and the eye reads it as a hedge. The
   * board's clearings all have a tree or two standing in them, which is what tells you the
   * clearing is part of the same forest rather than a hole cut in it.
   *
   * They come in copses because a single 2x2 crown alone on grass is the exact shape this round
   * set out to abolish, and scattering nine of them deliberately would have put nine of them back.
   * A second trunk two columns over shares a row with the first, so the two crowns make one
   * four-tile mass; a third, a row down and a column across, interlocks with both.
   */
  for (let i = 0; i < 9; i++) {
    const x = 2 + Math.floor(rnd() * (MAP_W - 6));
    const y = 5 + Math.floor(rnd() * (MAP_H - 9));
    if (woodAt(x, y) > 0.3) continue;
    if (!plantTree(x, y)) continue;
    plantTree(x + 2, y);
    if (rnd() > 0.5) plantTree(x + 1, y + 2);
  }

  /*
   * ===========================================================================
   * THE ROAD'S OWN TREELINE, which is how a motorway becomes a track.
   * ===========================================================================
   *
   * MEASURED, PER COLUMN, AND IT IS THE WORST NUMBER ON THE MAP. Take the track row at each column
   * and count the unbroken run of tiles with no canopy and no trunk in it, up and down. The median
   * came out at THIRTEEN ROWS, with stretches of 17, 18 and 20, and a minimum of 4. The sand itself
   * is two rows. So the road is not two tiles of path through a wood at all -- it is a thirteen-row
   * corridor of open lawn running the full width of a forty-two-row map, with two tiles of sand
   * drawn down the middle of it. That corridor is the pale stripe across every frame, it is the
   * single biggest contributor to the client's "the map needs to make sense", and no amount of
   * narrowing the SAND can touch it, because the sand was never what was wide.
   *
   * WHY THE DENSITY FIELD CANNOT CLOSE IT, which is why this is a pass rather than a tuning. A
   * wood's strength has to fall to its planting floor somewhere, and the woods beside the road are
   * small ones placed between the glades; their floor contour lands two or three rows short of the
   * sand, every time, because that is what a falloff does. Then the glades the landmarks need are
   * centred ON the track -- Purple's, the bridge reach, the gate approach -- and subtract another two
   * or three rows on top. The corridor is the sum of two effects that are each individually
   * correct, and the only thing that fixes it is planting the verge deliberately.
   *
   * THE GEOMETRY, which decides everything about this pass. A crown may not be laid on sand: the
   * road is the one line the player follows and `decor-above` draws at depth 10,000, so a crown over
   * the track would hide Purple while she walks it. So on the NORTH side a tree's trunk row may be the
   * row touching the sand and its crown sits above that; on the SOUTH side the trunk has to stand
   * three rows clear, or its crown lands on the path and the planter refuses the site. Either way
   * the nearest DARK row to the sand is the one immediately beside it, which is all that is needed:
   * what breaks a sight line is the treeline's silhouette against the sand, not canopy over it.
   *
   * ONE SIDE AT A TIME, AND ALWAYS ONE SIDE. Which side swaps every five or six columns, read off a
   * field sampled along a single row so it gives STRETCHES rather than a dotted line: wood hard
   * against the sand for four or five columns, then the other bank, then back. That alternation is
   * what the board's road has and it is most of what makes a track read as walked rather than
   * surveyed. The far shoulder is never touched on the same column, so the corridor is never
   * narrower than two lanes plus one open side -- the invariant five end-to-end tests failed on when
   * an earlier pass closed both verges and Purple had no room to round a corner.
   *
   * THE TREES ARE FLAGGED, NOT FILTERED, and the long note on `Tree.verge` is the reason. The sweep
   * at the foot of the file fells scenery off a shoulder; these are not scenery, so they are marked
   * and spared. Asking the sweep's own field before planting -- which is what the first version of
   * this did -- put six trees on forty-seven columns and moved the median not at all.
   *
   * A SECOND RANK BEHIND THE FIRST, on the stretches that take it, because a single row of trunks
   * along a road is a hedge and a hedge is what the client already complained about once. Two ranks
   * is a treeline with depth: a crown behind a crown, which is what the board shows wherever its
   * path runs beside a wood.
   */
  let verges = 0;
  for (let x = 1; x < MAP_W - 2;) {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < MAP_H; y++)
      if (isPath(x, y)) {
        if (top < 0) top = y;
        bottom = y;
      }
    /*
     * Only the trunk road, and now one OR two tiles of it: the carriageway's edge is bitten, so
     * some of its columns carry a single tile. Held at exactly two this pass skipped every one of
     * them and the road's treeline came out on half the columns it used to. Three or more means a
     * fork has joined here, and a junction is not the road's shoulder.
     *
     * A one-wide FOOTPATH still has to be excluded, and a bitten column of carriageway looks just
     * like one from here. It is not: the column either side of it is two tiles of road, which is
     * what the corridor rule needs, so the span is measured over the three columns together.
     */
    const span = (nx: number): number => {
      let first = -1;
      let last = -1;
      for (let y = 0; y < MAP_H; y++)
        if (isPath(nx, y)) {
          if (first < 0) first = y;
          last = y;
        }
      return first < 0 ? -1 : last - first;
    };
    if (top < 0 || bottom - top > 1 || Math.max(span(x - 1), bottom - top, span(x + 1)) !== 1) {
      x++;
      continue;
    }
    /*
     * Sampled on ONE row, so this is a function of x alone. Two dimensions bought nothing here --
     * the road occupies one row -- and cost the whole pass: a 2-D field read along a near-constant
     * y is fifteen lattice samples that can all happen to sit the same side of a threshold.
     */
    const north = shoulderField(x / 5.5 + 67, 23.5) > 0.5;
    /*
     * A sapling on the north verge, because its own bottom row carries bark and leaf together, so
     * the dark starts in the row touching the sand rather than a row further up. On the south side
     * a mid tree stands three rows clear and throws its crown back down to the row beside the sand,
     * which is the only arrangement that gets canopy to the roadside without putting any on it.
     */
    /*
     * The preferred side first, then the other one, because the thing being bought is wood AT THE
     * SAND ON ONE SIDE and the field only decides which side is nicer. Trying one side and giving up
     * is how the first version put four trees on the whole road: most of its refusals were columns
     * where the chosen bank was a glade, the river or already wooded, with the opposite bank wide
     * open and three rows of lawn between it and the track.
     */
    const plantNorth = (): boolean =>
      plantKind('sapling', x, top - 1) || plantKind('mid', x, top - 1);
    const plantSouth = (): boolean =>
      plantKind('mid', x, bottom + 3) || plantKind('sapling', x, bottom + 2);
    const planted = north ? plantNorth() || plantSouth() : plantSouth() || plantNorth();
    if (!planted) {
      x++;
      continue;
    }
    trees[trees.length - 1]!.verge = true;
    verges++;
    // The second rank, two rows further from the sand, where there is room for it.
    if (north) plantKind('mid', x, top - 3);
    else plantKind('mid', x, bottom + 5);
    /*
     * Step by the width of the thing just planted. Advancing one column at a time asks the next
     * column for a tree whose own trunk cell is the one this tree is standing on, which is refused,
     * so the treeline came out on every other column at best.
     */
    x += 2;
  }
  console.log(`  road: ${verges} tree(s) planted hard against the track`);

  /*
   * NO TREE STANDS ALONE -- the sweep that finishes the job the overlap rule started.
   *
   * Letting crowns merge took the share of two-tile canopy runs from 70% to 40%, and the 40% that
   * was left turned out to be one thing: single trees at the margin of a thicket, each with grass
   * on both sides of its crown. A density field cannot fix those, because a margin is exactly where
   * a field is near its own threshold and plants one tree rather than three.
   *
   * So loneliness is measured off the register -- a tree is alone if no OTHER tree's crown reaches
   * the column either side of its own, on either crown row -- and then either answered or removed.
   * A companion two columns over shares a row and makes one four-tile mass of the pair; a companion
   * a row down and a column across interlocks with it instead. Only where neither will fit, which
   * means the tree is boxed in by a path or a glade rather than standing in open wood, does the
   * tree come out. Repeated, because a companion can itself land lonely.
   */
  const crownCover = (): Map<number, number> => {
    const counted = new Map<number, number>();
    for (const t of trees)
      for (const [dx, dy] of t.k.crown) {
        if (!inside(t.x + dx, t.y + dy)) continue;
        const key = (t.y + dy) * MAP_W + (t.x + dx);
        counted.set(key, (counted.get(key) ?? 0) + 1);
      }
    return counted;
  };
  for (let pass = 0; pass < 4; pass++) {
    const cover = crownCover();
    const covered = (x: number, y: number): boolean =>
      inside(x, y) && (cover.get(y * MAP_W + x) ?? 0) > 0;
    let changed = 0;
    for (const t of [...trees]) {
      /*
       * Loneliness is read off the tree's OWN footprint, which is what makes this work for three
       * scales: the column either side of an elder is t.x-1 and t.x+3, and its crown rows run three
       * deep, while a sapling has one crown row. Hard-coded at two columns and two rows, every
       * elder on the map would have been measured against the wrong cells -- and because the test
       * only ever fails to FIND a neighbour, it would have answered perfectly companionable elders
       * with a companion each, or felled them.
       */
      const w = t.k.trunk.length;
      const rows = t.k.crown.map(([, dy]) => dy);
      const beside = [t.x - 1, t.x + w].some((nx) => rows.some((dy) => covered(nx, t.y + dy)));
      if (beside) continue;
      changed++;
      if (
        plantTree(t.x + w, t.y) ||
        plantTree(t.x - 2, t.y) ||
        plantTree(t.x + 1, t.y + 2) ||
        plantTree(t.x - 1, t.y + 2)
      )
        continue;
      const i = trees.indexOf(t);
      if (i >= 0) trees.splice(i, 1);
      for (let dx = 0; dx < w; dx++) {
        set(below, t.x + dx, t.y, 0);
        clear(t.x + dx, t.y);
      }
      // Only the quarters nothing else is standing under: a shared cell belongs to its neighbour.
      for (const [dx, dy] of t.k.crown)
        if ((cover.get((t.y + dy) * MAP_W + (t.x + dx)) ?? 0) <= 1)
          set(above, t.x + dx, t.y + dy, 0);
    }
    if (changed === 0) break;
  }

  /*
   * ===========================================================================
   * AND THEN THE TREELINE IS BROUGHT DOWN TO THE BAND, which is what deletes the hem.
   * ===========================================================================
   *
   * The design board's first instruction to this file is "delete the border hem", and the whole of
   * the reason it cannot simply be deleted is two lines below: the band is the WALL. What it can
   * stop being is a DRAWN LINE, and the file's own note on `sealBorder` already says how -- "where a
   * wood stands on the margin, its canopy covers this band outright, so the longest visible run of
   * hedge is not the length of the band at all". It said so and it was not true. Printed, with the
   * last row opened to planting and every density pass finished:
   *
   *     col  0  #########TTTTTTo###########TTTTo####TTTTo#
   *     col 59  ########TTo##################TTo####TTTTo#
   *
   * -- `#` is uncovered hedge, `T` canopy, `o` a trunk. Eighteen tiles of unbroken bush down the
   * east edge behind Grandma's garden, eleven down the west edge beside the title camera. A hedge
   * of eighteen is a line; four hedges of four with trees between them is undergrowth at the foot
   * of a wood, and the difference costs about a dozen trees rather than a hundred.
   *
   * So this is a LIMIT rather than a quota: walk each of the four bands, and whenever the run of
   * cells that nothing is standing on reaches `HEM_RUN`, plant one tree that lands on the band and
   * start counting again. It cannot plant where a path, a glade, the water or the enclosure already
   * says no -- `plantKind` refuses all of those -- so the pass simply gives up on that stretch and
   * carries on, which is correct: the gate approach and the river mouth are meant to be open.
   *
   * WHICH TREE COVERS WHICH BAND is geometry and it is worth writing down, because it is not the
   * same answer on all four sides. A crown sits ABOVE its trunk, never beside it.
   *
   *   rows 0 and 1   a trunk on row 2 carries its crown over both of them, two columns at a time.
   *   row 41         nothing can put a crown there, because there is no row 42 to stand on. What
   *                  covers it is the TRUNK itself: `below` is then occupied, `sealBorder` steps
   *                  over the cell, and the bottom of the world shows the feet of the treeline
   *                  instead of a hedge. That is the right picture anyway -- it is the row the
   *                  camera clamps to, so it is seen edge-on.
   *   cols 0 and 59  a trunk on the column covers its own cell and the two above it, so one tree
   *                  takes three tiles out of a vertical run. Column 59 is reached by planting at
   *                  58, since a mid trunk is two wide and `sites` stops at MAP_W - 2.
   */
  const HEM_RUN = 4;
  /** Nothing is standing here yet, so the seal will reach it. The predicate for the EARLY call. */
  const bandIsBare = (x: number, y: number): boolean =>
    at(below, x, y) === 0 && at(above, x, y) === 0;
  /**
   * Nothing is standing here but the seal itself. The predicate for the LATE call, which runs after
   * `sealBorder` has filled the band, so "bare" there means "bare or already hedge".
   *
   * `SCRUB_GIDS` is declared below this point and read only from inside this body, which the late
   * call evaluates long after it exists. It is the one backward reference in this pass and it is
   * deliberate: the alternative is a second copy of the same three gids.
   */
  const bandIsHedge = (x: number, y: number): boolean =>
    at(above, x, y) === 0 && (at(below, x, y) === 0 || SCRUB_GIDS.has(at(below, x, y) & BASE_GID));
  /** Plant the first of several candidates that will take, or report that none would. */
  const anyOf = (...tries: (readonly [string, number, number])[]): boolean =>
    tries.some(([kind, x, y]) => plantKind(kind, x, y));
  /**
   * The same, for the late call: lift whatever cover is on the trunk row first, because by then it
   * is the seal's own hedge and replacing it is the entire point. A candidate that then fails on
   * its crown leaves the row bare, which `sealBorder` fills again two lines later and the lone-bush
   * sweep tidies after that -- so an unsuccessful try costs nothing.
   */
  const anyOver = (...tries: (readonly [string, number, number])[]): boolean =>
    tries.some(([kind, x, y]) => {
      const w = KINDS[kind]!.trunk.length;
      for (let dx = 0; dx < w; dx++)
        if (bandIsHedge(x + dx, y) && at(below, x + dx, y) !== 0) set(below, x + dx, y, 0);
      return plantKind(kind, x, y);
    });
  /*
   * ===========================================================================
   * ...AND THE BREAK NO LONGER HINGES ON ONE COLUMN BEING FREE.
   * ===========================================================================
   *
   * Every candidate this pass can offer for the east margin is anchored at column 58, because a mid
   * trunk is two wide and planting stops at `MAP_W - 2`. So the moment anything else owns column 58
   * -- the garden's east fence, the scrub the seal puts beyond it, a tree the connectivity sweep
   * felled to open a dead end -- the pass has nothing to offer at all and the build fails on
   * "tile(s) of unbroken hedge along column 59": a fault with no relation whatever to the change
   * that caused it. Three rounds have gone that way, each one hunting a bug in the wrong file.
   *
   * A tree is the best break and it is no longer the only one. What the invariant measures is a RUN
   * OF HEDGE, and what makes it a run is that every tile in it is the same material. A stone outcrop
   * breaks it as surely as a crown does, it is what `sealTile` scatters through the band anyway, and
   * it needs no column but its own. So the tree is tried first and the stone catches what it cannot
   * reach.
   */
  const dropStone = (x: number, y: number): boolean => {
    if (!inside(x, y) || at(above, x, y) !== 0) return false;
    set(below, x, y, gid('rock'));
    solid(x, y);
    return true;
  };
  const breakHem = (
    cells: readonly (readonly [number, number])[],
    bare: (x: number, y: number) => boolean,
    cover: (x: number, y: number) => boolean,
  ): number => {
    let run = 0;
    let planted = 0;
    for (const [x, y] of cells) {
      if (!bare(x, y)) {
        run = 0;
        continue;
      }
      run++;
      if (run <= HEM_RUN) continue;
      if (!cover(x, y) && !dropStone(x, y)) continue;
      planted++;
      run = 0;
    }
    return planted;
  };
  const down = (x: number): readonly (readonly [number, number])[] =>
    Array.from({ length: MAP_H }, (_v, y) => [x, y] as const);
  const across = (y: number): readonly (readonly [number, number])[] =>
    Array.from({ length: MAP_W }, (_v, x) => [x, y] as const);
  /** All four bands, each with the tree that can reach it. Run twice; see the second call. */
  const breakEveryHem = (
    bare: (x: number, y: number) => boolean,
    any: (...tries: (readonly [string, number, number])[]) => boolean,
  ): number =>
    breakHem(across(0), bare, (x) => any(['mid', x, 2], ['mid', x - 1, 2], ['elder', x - 1, 3])) +
    breakHem(across(1), bare, (x) => any(['mid', x, 2], ['mid', x - 1, 2], ['elder', x - 1, 3])) +
    breakHem(across(MAP_H - 1), bare, (x) =>
      any(['mid', x, MAP_H - 1], ['mid', x - 1, MAP_H - 1], ['sapling', x, MAP_H - 1]),
    ) +
    breakHem(down(0), bare, (_x, y) => any(['mid', 0, y], ['sapling', 0, y])) +
    breakHem(down(MAP_W - 1), bare, (_x, y) =>
      any(['mid', MAP_W - 2, y], ['sapling', MAP_W - 2, y]),
    );
  const hemTrees = breakEveryHem(bandIsBare, anyOf);

  /*
   * THE EDGE OF THE WORLD. The border must be solid even where a tree could not be planted.
   *
   * It is a function, and it is called twice, because sealing it once was not enough. A tree may
   * straddle column 0 -- planting offers every x from 0 up -- and `clearArea` strikes a tree off
   * with BOTH of its cells, so a sweep at the bottom of the file that cuts through the half at
   * column 1 clears the half at column 0 with it, after this seal has already run. That is exactly
   * what had happened at (0,36): one walkable tile on the border of the map, with a tree trunk
   * drawn on it. Sealing again after the last pass that can open a tile cannot leave one behind,
   * and it is idempotent, so running it twice costs nothing but the second pass.
   */
  /** The two rows and two columns of sealed scrub that stop the player seeing the end of the map. */
  const onBorder = (x: number, y: number): boolean =>
    x === 0 || x === MAP_W - 1 || y <= 1 || y === MAP_H - 1;
  /*
   * WHAT SEALS THE EDGE, and why it cannot be one tile.
   *
   * This planted `bush` and nothing else, and the product manager's report named the result -- "the
   * 2x6 column of byte-identical bushes down the left margin of the title screen" -- as the most
   * visible instance of the whole repetition finding. Measured: 223 bushes in the band, in connected
   * runs of 118 and 63, drawn from a vocabulary of exactly two images, because `bush` has a lit top
   * and a shadow under it so the mirror pass may only flip it sideways. Two images over 223 tiles
   * puts a 2x6 block of one of them somewhere by arithmetic, and the title camera sits on the west
   * margin, so the block it puts there is the first thing a visitor sees.
   *
   * Three changes, all placement, none of them a new tile:
   *
   *   1. THE BAND IS SCRUB, NOT HEDGE. Stone drifts and the odd toadstool ring among the bushes
   *      take the vocabulary from two images to six. They are read off a broad field rather than a
   *      coin flip per tile, so they arrive as outcrops two or three tiles long -- the same reason
   *      the gorge banks and the forest floor are cut out of fields: every decor tile here is a
   *      fully opaque 32x32, so one dropped singly is a hard-edged square, not a speck.
   *      Deliberately no flowers: the frame of the picture should recede, and three bright tiles
   *      along the top edge would pull the eye straight to it.
   *   2. IT IS PLANTED ALREADY MIRRORED. `sealBorder` is called twice, and the second call runs
   *      AFTER the mirror pass -- that is the whole point of the second call, since felling a tree
   *      that straddles column 0 reopens a border cell late. So every tile the second call planted
   *      came out unflipped while its neighbours from the first call were flipped half the time,
   *      which is a seam the mirror pass can never reach. Flipping here, off the same `heads` bits
   *      the mirror pass uses, makes the two calls agree by construction.
   *   3. THE DEPTH WANDERS. The band is two rows at the top and one everywhere else, so row 1 and
   *      the two columns are each a single file of cover with clean grass on one side -- a drawn
   *      line, whatever is drawn on it. Letting the inner row or column fall back to grass over
   *      whole stretches, and the treeline behind it come forward, gives the margin a ragged inner
   *      edge. It only ever ADDS cover one tile inside the sealed band, never removes any, so the
   *      edge of the world stays sealed and nothing about the collision layer changes.
   */
  /*
   * ===========================================================================
   * THREE SILHOUETTES OF SCRUB, AND WHICH ONE GOES WHERE.
   * ===========================================================================
   *
   * The undergrowth owner has appended `bush-low` and `bush-tall` to `TILE_NAMES` -- appended, so
   * no existing gid moves and the committed map stays valid -- and they differ from `bush` in
   * FOOTPRINT rather than in outline detail, which is the only kind of difference that reads in a
   * camera 19.41 tiles wide: `bush` fills its tile, `bush-low` is a wide bank in the bottom half with lawn
   * showing above it, `bush-tall` a narrow leaning shrub with lawn either side.
   *
   * WHY THIS IS THE MAP'S PROBLEM AND NOT THE PAINTER'S. Counted on the committed map, 273 tiles
   * carried `bush` -- 10.8% of the world, one 32px image, on more of the map than any other single
   * thing on it. A tile does not become wallpaper by being drawn badly; it becomes wallpaper by
   * being the only answer a placement pass has. Six separate passes in this file reach for scrub --
   * the sealed border, the forest floor, the open islands, five `clump` calls, the verge, the
   * garden beds and the lone-bush sweep -- and every one of them asked for the same gid.
   *
   * CHOSEN OFF A BROAD FIELD, for the reason every other choice in this file is: a variant picked
   * per tile from white noise is three unrelated silhouettes alternating at 32px, which is
   * confetti, and the file has already made that mistake twice and written it up both times. A
   * three-tile field means a mass of scrub is mostly one silhouette with a drift of another
   * through it -- one thicket, with variety inside it, rather than a chequer of three.
   *
   * Because the field is a function of position only, every pass agrees about what grows where
   * without any of them knowing about the others, which is what the lone-bush sweep at the foot of
   * the file needs: it decides shape from what is already on the map.
   */
  const thicketShape = valueNoise2D(20261051);
  const scrub = (x: number, y: number): string => {
    const v =
      thicketShape(x / 3.3, y / 3.3) * 0.72 + thicketShape(x / 1.6 + 23, y / 1.6 + 23) * 0.28;
    return v < 0.55 ? 'bush' : v < 0.79 ? 'bush-low' : 'bush-tall';
  };
  /** Every silhouette the three scrub tiles can take, masked, for the passes that read scrub back. */
  const SCRUB_GIDS = new Set(['bush', 'bush-low', 'bush-tall'].map((n) => gid(n)));

  const hem = valueNoise2D(20261049);
  /*
   * SCRUB, AND STONE ONLY WHERE THERE IS A RIVER TO JUSTIFY IT. No toadstools, ever.
   *
   * WHAT THIS USED TO BE and why it had to go. The mix was bush, then `toadstool-ring` above a
   * threshold, then `rock` above a higher one, chosen by a fine field -- which is a perfectly good
   * answer to the question it was asked ("how do I get more than two images along 200 tiles of
   * hedge") and the wrong question. `toadstool-ring` draws THREE red caps, so a field that hands
   * it one tile in eight along the top and bottom rows of the world prints a dotted line of red
   * mushrooms across the whole width of the map, twice. Counted: 58 stamps on the map, 174 caps, and
   * the great majority of them in this band. The product manager's note names it as the clearest
   * "the map does not make sense" artefact in the build, and names the stone down the edge columns
   * in the same breath: a boulder is a thing a river put there, and the east and west margins of
   * this map are nowhere near the water.
   *
   * So the vocabulary problem is answered by WHERE rather than by WHAT. Stone belongs to the gorge,
   * so the band carries it where the band meets the river -- the waterfall at the top, the reach
   * where the water leaves the map at the bottom left -- and carries scrub everywhere else. The
   * repetition the old mix was fighting is answered properly a few lines down, by the treeline
   * being allowed to reach the border: where a wood stands on the margin, its canopy covers this
   * band outright, so the longest visible run of hedge is not the length of the band at all.
   */
  const sealTile = (x: number, y: number): string => {
    const drift = hem(x / 2.1, y / 2.1) * 0.7 + hem(x / 1.15 + 71, y / 1.15 + 71) * 0.3;
    const gorge = Math.abs(x - riverCentre(Math.min(Math.max(y, 0), MAP_H - 1))) < 5;
    return gorge && drift > 0.46 ? 'rock' : scrub(x, y);
  };
  /** Already flipped, so the late re-seal and the early one cannot disagree about a tile. */
  const sealGid = (x: number, y: number): number =>
    gid(sealTile(x, y)) + (heads(x, y, 1) ? FLIP_H : 0);
  /*
   * The same mix with the boulders taken out, for anywhere the cover is SOFT.
   *
   * `rock` is in the generator's own `MUST_STOP_HER` list -- it is drawn as a boulder, so it has to
   * stop her -- and the audit caught the first version of the ragged edge below planting two soft
   * ones at (24,40) and (25,40). A boulder the player walks through and an invisible wall are the
   * same bug seen from either side, and this file has shipped both.
   */
  const softSealGid = (x: number, y: number): number =>
    gid(sealTile(x, y) === 'rock' ? scrub(x, y) : sealTile(x, y)) + (heads(x, y, 1) ? FLIP_H : 0);
  const sealBorder = (): void => {
    for (let x = 0; x < MAP_W; x++)
      for (const y of [0, 1, MAP_H - 1]) {
        solid(x, y);
        // Masked: by the second call the waterfall carries its mirror bits.
        if (at(below, x, y) === 0 && (at(ground, x, y) & BASE_GID) !== gid('waterfall'))
          set(below, x, y, sealGid(x, y));
      }
    for (let y = 0; y < MAP_H; y++)
      for (const x of [0, MAP_W - 1]) {
        solid(x, y);
        if (at(below, x, y) === 0) set(below, x, y, sealGid(x, y));
      }
    /*
     * The ragged inner edge. One tile in from the seal, where the field says the thicket comes
     * forward, and only onto ground that is genuinely empty -- never over a tree, the waterfall,
     * a path, the water or a shoreline that has nothing else to carry it. Soft on purpose: this is
     * the undergrowth the band stands in, not part of the wall, and adding collision here would
     * narrow the walkable map for a decoration.
     */
    for (let y = 1; y < MAP_H - 1; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        if (
          !onBorder(x - 1, y) &&
          !onBorder(x + 1, y) &&
          !onBorder(x, y - 1) &&
          !onBorder(x, y + 1)
        )
          continue;
        if (at(below, x, y) !== 0 || at(above, x, y) !== 0) continue;
        if (isPath(x, y) || isWater(x, y) || inClearing(x, y)) continue;
        if (!TILE_NAMES[(at(ground, x, y) & BASE_GID) - 1]?.startsWith('grass')) continue;
        /*
         * Raised from 0.56. The spawn and title cameras are both clamped to x 0, so this inner row
         * is the left column of the two frames a visitor sees first, and at 0.56 it carried cover on
         * more than half of its length -- which, beside the sealed band itself, is a two-wide hedge
         * running the height of the frame. That is the "2x6 column of byte-identical bushes" the
         * review named, arrived at a second time by a different pass. Above 0.7 it comes forward in
         * three or four short stretches instead, which is what a ragged edge was meant to be.
         */
        if (hem(x / 5.2 + 17, y / 5.2 + 17) < 0.7) continue;
        set(below, x, y, softSealGid(x, y));
      }
  };
  sealBorder();

  // --- undergrowth ------------------------------------------------------------
  /*
   * Undergrowth in CLUMPS, not confetti.
   *
   * The old scatter dropped single tiles at uniformly random positions, so a flower was one bright
   * speck alone on flat green. The board has none of those: its flowers come in beds of three to
   * five and its bushes in thickets. The difference is not decoration, it is measurable. Every
   * isolated speck adds two high-contrast boundaries to the image, and the edge-density axis is
   * already two and a half times the board's -- the art is BUSIER than the board, not emptier.
   * Clumping puts those same tiles shoulder to shoulder, where they share their boundaries
   * instead of each buying its own, and the mass reads as something that grew.
   *
   * Which is why the flower counts below are roughly unchanged and the BUSH count is not. Bushes
   * are big, dark and low-contrast against the wood; they are the tile that can fill ground
   * without adding edges, and filling ground is the job.
   */
  /*
   * ...AND THE REASON THE CLUMPS THEMSELVES CAME OUT ON A LATTICE.
   *
   * This used to scatter `each` independent picks about a centre with `Math.round((rnd() - 0.5) *
   * spread)`, which at spread 3.4 draws from exactly {-2,-1,0,1,2}. Five picks in a 5x5 box, and
   * the box's own middle column and row heavily favoured by the rounding, is not a clump: it is a
   * tight rosette with holes in it, and a rosette is a SHAPE. Lay eighteen of them at random
   * centres and the eye reads the shape, not the scatter -- and because a one-tile hole inside a
   * rosette is as regular as the disc beside it, the result on the title camera was a near-checker
   * of identical dark discs separated by single tiles of grass. The product manager's report called
   * the whole class of this "uncanny rather than lush", and this is where the undergrowth half of
   * it comes from.
   *
   * A mass GROWS instead. Start at the seed and repeatedly take a random cell off the frontier --
   * the 4-neighbours of what has been taken so far -- until the mass is as big as it wanted to be
   * or there is nowhere left to go. Three properties fall out of that and none of them can be had
   * from independent picks:
   *
   *   - it is CONNECTED, so there are no one-tile holes inside it and no isolated outliers;
   *   - its OUTLINE is ragged, because which arm of the frontier grows next is random, so it has
   *     bays and spurs instead of being a disc;
   *   - it FLOWS round things. A path, a tree or another mass simply removes cells from the
   *     frontier, so a thicket grows along a verge or wraps a trunk the way real scrub does,
   *     rather than being clipped off square by a box.
   *
   * Size is drawn over a wide range and squared, so most masses are small and a few are big: the
   * board's undergrowth varies in size, and a fixed `each` is the one thing that guarantees it
   * cannot. Masses are free to grow into each other -- a seed landing beside an existing mass just
   * grows away from it -- which is the "overlaps itself" half of the brief.
   */
  const clump = (tile: string, sites: number, small: number, large: number, hard = false): void => {
    const plantable = (x: number, y: number): boolean =>
      inside(x, y) &&
      !isPath(x, y) &&
      !isWater(x, y) &&
      !inClearing(x, y) &&
      at(below, x, y) === 0 &&
      at(above, x, y) === 0;
    /*
     * ===========================================================================
     * A BANK STARTS AGAINST SOMETHING. Nothing is seeded in the middle of a lawn.
     * ===========================================================================
     *
     * Cropped at 2x out of the spawn frame, the ground north of the track carried a dozen flowering
     * bushes, each a single tile, each with clean grass on all four sides, at an even two-tile pitch
     * across an otherwise empty meadow. That is the market-garden finding in its purest form, and
     * note what it is NOT: it is not a lattice, the masses are grown and ragged and connected, and
     * the per-tile placement is beyond reproach. It is simply a bed of three tiles sitting on its own
     * in a field, repeated, and three tiles on their own in a field read as one dot however they are
     * arranged among themselves.
     *
     * Look at where the board puts its undergrowth and the rule is plain: banked along the whole base
     * of the cottage wall, in the crook of the fence, round the foot of a trunk, along the edge of the
     * sand. Never in the middle of open ground. A bank reads as a bank because it has something to be
     * a bank AGAINST -- the thing it touches gives it a straight edge on one side and a ragged one on
     * the other, which is what makes a few tiles look like planting instead of like litter.
     *
     * So a seed has to touch something: wood, water, sand, a wall, a fence, or scrub already grown.
     * Masses can still grow out into the open from there, which is how they keep their outline. It
     * also costs nothing in count -- the sites that are refused are precisely the ones that produced
     * the isolated dots.
     */
    const anchored = (x: number, y: number): boolean =>
      NEIGHBOURS.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) return false;
        return (
          at(below, nx, ny) !== 0 || at(above, nx, ny) !== 0 || isPath(nx, ny) || isWater(nx, ny)
        );
      });
    for (let i = 0; i < sites; i++) {
      const ox = 2 + Math.floor(rnd() * (MAP_W - 4));
      const oy = 3 + Math.floor(rnd() * (MAP_H - 6));
      if (!plantable(ox, oy) || !anchored(ox, oy)) continue;
      const want = Math.round(small + (large - small) * rnd() ** 2);
      const taken = new Set<number>([oy * MAP_W + ox]);
      const frontier: [number, number][] = [[ox, oy]];
      let grown = 0;
      while (grown < want && frontier.length > 0) {
        /*
         * ===========================================================================
         * THE NEAREST OF THREE DRAWS, which is what stops a bank becoming a stripe.
         * ===========================================================================
         *
         * Taking a uniformly random cell off the frontier grows a mass that is ragged and connected,
         * which was the point, and it also grows a mass that takes WHATEVER SHAPE the free ground
         * has. Between the verge sweep's cleared shoulder and the treeline there is a band of empty
         * ground one or two tiles deep running the length of the road, so a bed seeded in it has
         * nowhere to go but along -- and the render shows exactly that: a row of eight red blooms at
         * an even pitch beside the track, and a column of six beside the garden fence. The review
         * called them "neat rows" and read them as placement; they are not placed at all, they are a
         * growth rule meeting a corridor.
         *
         * Best-of-three biases the frontier towards the cells nearest the seed, which costs the
         * outline none of its raggedness -- the three draws are still random, and the frontier is
         * still whatever the obstacles left of it -- and makes the mass grow round rather than long.
         * In open ground it is a bed; in a corridor it now fills the corridor's width first and
         * stops, instead of running down it.
         */
        let pick = Math.floor(rnd() * frontier.length);
        for (let draw = 0; draw < 2; draw++) {
          const other = Math.floor(rnd() * frontier.length);
          const near = (i: number): number =>
            Math.hypot(frontier[i]![0] - ox, frontier[i]![1] - oy);
          if (near(other) < near(pick)) pick = other;
        }
        const [x, y] = frontier[pick]!;
        // Swap-remove: the frontier is a bag, so order does not matter and this stays O(1).
        frontier[pick] = frontier[frontier.length - 1]!;
        frontier.pop();
        if (!plantable(x, y)) continue;
        // A thicket asked for as `bush` takes whichever silhouette grows at that tile, so a mass
        // of eleven is one thicket with variety in it rather than eleven copies of one drawing.
        set(below, x, y, gid(tile === 'bush' ? scrub(x, y) : tile));
        if (hard) solid(x, y);
        grown++;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          const key = ny * MAP_W + nx;
          if (taken.has(key)) continue;
          taken.add(key);
          frontier.push([nx, ny]);
        }
      }
    }
  };
  /*
   * THE FOREST FLOOR, and the reason the lawn survived the trees.
   *
   * A tree is a 2x1 trunk under a 2x2 crown, so two trees standing side by side still leave their
   * trunk row showing between the crowns. Pack the wood as tight as the footprints allow and the
   * gaps still come to a third of it -- bright, flat grass in bands, which is why the map stayed
   * at 40% open green after the canopy had doubled. The board has no such bands: under its trees
   * there is always scrub.
   *
   * So this sweeps every tile the wood left empty and fills it in proportion to how deep in the
   * wood it is. Nothing is offered a tile in a glade, which keeps the glades glades.
   *
   * These are NOT solid, and that is a deliberate change from the old scattered bushes.
   * Undergrowth this dense would otherwise be a second collision layer over most of the map, and
   * the whole point of a glade is to be able to walk into it. Purple pushes through fern; she still
   * cannot walk through a trunk, a boulder or the river.
   */
  const scrubNoise = valueNoise2D(20261025);
  /** Cover out in the open, independent of the wood: islands of scrub in the glades. */
  const meadow = valueNoise2D(20261035);
  for (let y = 3; y < MAP_H - 2; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (isPath(x, y) || isWater(x, y) || at(below, x, y) !== 0 || at(above, x, y) !== 0) continue;
      if (inClearing(x, y)) continue;
      /*
       * How much of this stretch of floor is under scrub -- and nothing at all below a floor.
       *
       * Where the wood thins out, the figure lands near the middle of the field's own range, and
       * a field cut near its middle crosses the line constantly: the blobs break up into one- and
       * two-tile islands and the opaque-tile problem below comes straight back at the margins,
       * which is exactly where it is most visible against open grass. Refusing the thin third
       * outright keeps every patch of scrub big enough to read as a patch, and gives the wood a
       * fringe of clean grass before it opens out, which the board has too.
       */
      /*
       * ===========================================================================
       * ...AND IT IS BANKED AGAINST THE TREES, NOT SPREAD OVER THE REGION THEY LIVE IN.
       * ===========================================================================
       *
       * This is where almost all of the 439 scrub tiles came from, and the cause is one line: the
       * cover was a function of `woodAt`, which is the field that DECIDES where trees go, not a
       * statement about where any tree actually is. `underWood` saturates at 1 wherever the field is
       * above about 0.85, so every empty tile in a wooded region was floored -- including the
       * regions a GLADE has emptied. A glade subtracts from the planting, so the trees are gone, and
       * it does not subtract from this, so the bushes stay. The west margin of the spawn camera is
       * the exact case: wood field high, Purple's glade cutting the trees out of it, and what the title
       * frame shows is thirty-odd bushes standing in open sunlit grass on a four-column pitch. The
       * review called it a hedge wall and the client called it a market garden; both were looking at
       * a forest floor with no forest over it.
       *
       * So the floor now asks a question about the MAP rather than about the field: is there a crown
       * or a trunk in one of the four tiles touching this one? If there is, this tile is a gap
       * between trees and wants the dark continuous floor the wood needs. If there is not, it is
       * open ground, and the only thing that may cover it is the `open` term below -- which is
       * exactly the "banks that touch the things they sit against" the board does and we did not.
       *
       * It costs nothing where the wood is genuinely closed, because there every empty tile has a
       * trunk or a crown beside it by construction.
       */
      /*
       * TWO SIDES, not one, and the second is what takes the count down rather than just moving it.
       * A tile with wood on one side is the EDGE of a mass: floor it and the mass grows a skirt of
       * scrub all the way round itself, which is both the commonest tile on the map and the thing
       * that makes every treeline read as a hedge. A tile with wood on two sides is genuinely inside
       * the wood -- a trunk-row gap, or the notch between two crowns -- which is the floor this
       * sweep exists to lay. It leaves clean grass at the foot of the outermost trees, which is what
       * the board shows: its scrub is banked in the crooks of a wood, never ringed around it.
       */
      const againstWood = NEIGHBOURS.filter(
        ([dx, dy]) => isCanopy(x + dx, y + dy) || isTrunk(x + dx, y + dy),
      ).length;
      const underWood = againstWood >= 2 ? Math.min(woodAt(x, y) ** 2 * 1.4, 1) : 0;
      /*
       * AND A GLADE IS NOT A LAWN. This is the second half of opening the wood up.
       *
       * Once the thickets stopped planting everywhere, everything they stopped planting on came
       * out as flat bright grass, and the map swapped one uniform surface for another: the render
       * went from trees edge to edge to mown parkland edge to edge, and the measured dark fell
       * with it. The board's open ground is never bare -- it carries islands of scrub and beds of
       * flower between the tree masses, which is what gives a clearing a floor.
       *
       * This is a field of its OWN rather than a share of the wood's, because it has to be high
       * exactly where the wood is not. Thresholded well above its midpoint so the glades keep far
       * more open ground than cover: islands in grass, not grass in scrub.
       */
      /*
       * Sparser and finer than the first attempt, which cut a broad field barely above its own
       * midpoint and so carpeted the glades: whole blocks of open ground went over to bush, and
       * because `bush` is an opaque tile that paints its own dark floor, the result read as a
       * second green chequered against the grass rather than as scrub lying on it. Islands in
       * grass is the brief; the threshold has to sit well up the field's range to get them.
       */
      /*
       * ...AND IT CAME DOWN AGAIN, HARD, because it had quietly become the biggest single object on
       * the map. Counted off the generated map: 234 `bush` + 180 `bush-low` + 25 `bush-tall` = 439
       * tiles of scrub, plus 98 of bloom, which is 21% of a 60x42 world under planting -- up 61% on
       * the round before, against a client note that already said there was too much of it. At 768
       * and at 375 the open ground reads as a four-column, six-row lattice of near-identical discs,
       * which is the "market garden" finding, and it is a quantity problem wearing a composition
       * problem's clothes: every one of those tiles is individually well placed, by a field, in a
       * connected mass, and there are simply too many masses for any of them to read as one.
       *
       * The threshold moves from 0.6 to 0.72 and the gain from 2.2 to 1.9, which takes the open
       * islands from roughly a fifth of the glades to a twentieth. The FOREST FLOOR above is left
       * exactly as it was: that cover lies between trunk rows under a closed canopy, where it is the
       * dark floor the wood needs and is barely visible as individual tiles at all. What the client
       * is looking at is the cover out in the open, and that is the half this cuts.
       */
      const open = Math.max(meadow(x / 4.6, y / 4.6) - 0.72, 0) * 1.9;
      const want = Math.max(underWood, open);
      if (want < 0.2) continue;
      /*
       * Thresholded against a FIELD, not against a fresh random number per tile, and this is the
       * whole difference between undergrowth and a chequerboard.
       *
       * `bush` is a fully opaque 32x32 tile -- it paints its own dark ground rather than a shape
       * over the grass -- so a coin flip per tile scatters hard-edged dark squares through light
       * grass at exactly the tile pitch, which is the most conspicuous thing a tilemap can do and
       * was plainly visible across the whole wood on the first attempt at this. A continuous field
       * cut at the same level covers the same fraction of ground, but in connected blobs three or
       * four tiles across: one dark mass with one outline, which is what the board's undergrowth
       * is, and which costs far fewer boundaries than the same tiles scattered.
       */
      const field = scrubNoise(x / 6.2, y / 6.2) * 0.84 + scrubNoise(x / 3.1, y / 3.1) * 0.16;
      if (field <= 1 - want) continue;
      /*
       * WHAT the cover is, which matters as much as where it is.
       *
       * Under the wood it is all bush: the job there is a dark continuous floor between the trunk
       * rows, and a dark continuous floor wants one tile, repeated. Out in the open the job is the
       * opposite one -- the board's clearings carry beds of several different things, and a glade
       * floored in a single repeated tile is just a second lawn in a darker green, which is what
       * the first attempt at this produced. Mixing flower beds and the odd stone into the open
       * cover is also the only lever this file has on the colour-variety axis, which measures
       * distinct colours and cannot be moved by placing more of a tile that is already placed.
       */
      const openCover = open > underWood;
      if (!openCover) {
        /*
         * Mostly bush, and not only bush. A measured count of the whole-map render found one
         * single 32px image on 11% of the map, and it is this tile: `bush` is opaque, it floors
         * most of the wood, and it can only be mirrored on one axis because it has a lit top and
         * a shadow under it. Monoculture is also simply wrong -- the board's forest floor carries
         * stones and the odd white flower among the scrub.
         *
         * Read off a broad field rather than per tile, so the stones come in small drifts the way
         * the scrub does. Scattered one by one they would be the confetti this sweep exists to
         * abolish, and every one of them would buy its own pair of high-contrast boundaries on an
         * edge-density axis that is already exactly at the board's.
         */
        const floor = meadow(x / 2.3 + 17, y / 2.3 + 17);
        const tile = floor > 0.86 ? 'rock' : floor > 0.8 ? 'flower-white' : scrub(x, y);
        set(below, x, y, gid(tile));
        // A BOULDER IS NOT UNDERGROWTH. The note above this sweep says Purple pushes through fern and
        // still cannot walk through "a trunk, a boulder or the river", and the stone drifts were
        // the one thing here contradicting it: `rock` is solid on the gorge banks and solid in
        // `clump`, and was soft in the only two places it was drawn as scatter. It is drawn as a
        // boulder, so it stops her. The verge sweep at the foot of the file fells any that end up
        // beside the track, and the connectivity sweep opens any pocket one of them happens to seal.
        if (tile === 'rock') solid(x, y);
        continue;
      }
      /*
       * LIKE GOES WITH LIKE, and this was the last per-tile coin flip left in the file.
       *
       * `speckle(x * 2.7, y * 2.7)` is white noise by construction -- `valueNoise2D` is sampled far
       * enough apart that neighbouring tiles share nothing -- so an island of open cover came out
       * as a confetti of five different opaque stickers, one per tile: a dark disc, then a bright
       * white square, then a pink one, then a disc. Every one of those boundaries is a hard 32px
       * edge between two unrelated images, which is both the busiest thing the tileset can do and
       * the reason the mass never reads as a mass. The branch directly above this one already knows
       * better -- it reads the stone drifts off `meadow(x / 2.3 + 17, ...)` "so the stones come in
       * small drifts the way the scrub does" -- and this branch simply never got the same treatment.
       *
       * Two broad octaves instead, so a glade carries a mass of scrub HERE and a bed of white
       * flowers THERE, each several tiles across, the way the board's clearings do. The shares are
       * unchanged, so nothing about how much of each tile is on the map moves; only which of its
       * neighbours each one sits next to.
       *
       * It also feeds the two sweeps at the foot of the file: once like sits with like, a bush with
       * no bush beside it is genuinely a lone disc on grass rather than one sticker in a mixed bed,
       * so "give it a companion" means what it says.
       *
       * ...AND THE SHARES MOVED WITH IT, which is the part that took two goes. Grouping alone, at
       * the old 46/18/16/12/8 split, does not fix anything -- it just decides WHICH confetti you
       * get. The first attempt used a four-tile field, and since the camera's glade is about eight
       * tiles across, a single draw of that field took the whole hero frame over to flowers: the
       * grid of dark discs became a scatter of bright squares, every axis in the score went up a
       * notch, and the picture was no better. A sticker is a sticker whatever colour it is.
       *
       * So the open floor is a BUSH MATTER with beds set into it, and the beds are small. Three
       * `clump` calls above already grow real flower beds of three to six; this sweep's job is
       * cover, and a glade reads as a clearing in a wood when the cover in it is mostly leaf with
       * flowers at the edges of it. A two-and-a-half-tile field at these shares puts a bed of two
       * or three white or pink at the rim of most masses and leaves the middle of them dark, which
       * is what the board's clearings show -- and it keeps the colour-variety axis, which is what
       * the mix was here for, since the flowers are still placed, just gathered.
       */
      const pick =
        meadow(x / 2.5 + 53, y / 2.5 + 53) * 0.74 + meadow(x / 1.3 + 7, y / 1.3 + 7) * 0.26;
      const coverTile =
        pick < 0.7
          ? scrub(x, y)
          : pick < 0.81
            ? 'flower-white'
            : pick < 0.89
              ? 'flower-pink'
              : pick < 0.95
                ? 'flower-red'
                : 'rock';
      set(below, x, y, gid(coverTile));
      if (coverTile === 'rock') solid(x, y);
    }

  /*
   * Thickets of solid scrub out in the open, and beds of flowers in what is left of it. The two
   * numbers are now the smallest and largest a mass may grow to, not a spread and a count: a bed of
   * three white flowers and a thicket of eleven bushes are both things the board has, and the point
   * of the range is that the same call produces both.
   */
  /*
   * ...AND THERE ARE HALF AS MANY SITES AND BIGGER MASSES, which is the same trade the open-cover
   * sweep above just made and for the same measured reason.
   *
   * Seventy-nine clump sites over a 60x42 map is one every thirty-two tiles. At three to eleven
   * tiles a mass, that is scrub or bloom within two or three tiles of almost anywhere on the map,
   * and what the camera shows is not masses at all -- it is a field of evenly spaced small dark
   * discs, which is exactly how the client described it. Fewer seeds and a wider size range gives
   * the same ground cover in FEWER, LARGER banks, and a larger bank is the only kind that reads as
   * one thing: the board's undergrowth is three or four big banks per frame, each touching something
   * -- a wall, a trunk, the verge -- and nothing at all in between them.
   *
   * The flowers come down hardest. There were 98 blooms on the map and the Arrive frame carried a
   * vertical column of six at even pitch beside the fence; a bloom is the highest-contrast thing the
   * tileset can put on grass, so it is the tile that can least afford to be common.
   */
  clump('bush', 10, 4, 14, true);
  clump('rock', 8, 2, 5, true);
  clump('flower-white', 8, 3, 7);
  clump('flower-pink', 6, 3, 6);
  clump('flower-red', 5, 2, 5);

  // --- landmarks ---------------------------------------------------------------
  const landmarks: Record<string, { x: number; y: number }> = {};
  /**
   * Draw a landmark, make its tile solid, and record where it stands.
   *
   * It took a `makeSolid` flag and all five callers below left it at `true`, so the soft branch
   * was never taken. A landmark the player walks through is the invisible-wall bug seen from the
   * other side, which this file warns about in three places; if one ever needs to be soft, that is
   * a decision to argue for at the call site rather than a default sitting here unused.
   */
  const place = (name: string, x: number, y: number, tile: string): void => {
    set(below, x, y, gid(tile));
    solid(x, y);
    landmarks[name] = { x: x * TILE, y: y * TILE };
  };
  /*
   * Wipes both decor layers over a rectangle -- and strikes off any tree it cuts into.
   *
   * A clearing is free to take one half of a tree and leave the other: the crown is two rows above
   * the trunk, so a rectangle that catches the trunk leaves a crown hanging in the air, and one
   * that catches the crown leaves a trunk that is still solid and, once the canopy is rebuilt,
   * invisible. The old sweep inferred the pairing from the tiles, which stops working the moment
   * crowns are allowed to overlap. Striking the tree off the register instead cannot be fooled.
   *
   * ...EXCEPT BY THE MIRROR BITS, WHICH IS WHAT IT WAS BEING FOOLED BY.
   *
   * The register was right and the two tile comparisons underneath it were wrong, and because they
   * only ever failed to RECOGNISE a tile, they failed silently. The mirror pass flips a tree by
   * swapping its halves as well as setting `FLIP_H`, so a mirrored tree carries `trunk-r` + the
   * flip bit on its left cell -- which is neither `gid('trunk-l')` nor equal to anything this
   * function was testing for. The two sweeps at the bottom of the file run AFTER that pass, so
   * every tree they felled kept its trunk and its crown on the map and lost only its collision.
   * Counted on the generated map: 61 trunk tiles the player walked straight through, 17 of them
   * standing on the main track, and one of them on the map's own border, where striking the tree
   * cleared the seal at (0,36) and left a walkable tile at the edge of the world.
   *
   * So both comparisons ask the masked gid, and the crown asks the register rather than the tile
   * for ownership. The cause was a comparison that could not match, not bookkeeping: the comment
   * above was true, and the code below it did not implement it.
   */
  const clearArea = (x: number, y: number, w: number, h: number): void => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        set(below, x + dx, y + dy, 0);
        set(above, x + dx, y + dy, 0);
        clear(x + dx, y + dy);
      }
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i]!;
      /*
       * The footprint comes off the KIND. An elder is three columns wide and reaches three rows
       * above its trunk; a sapling reaches one. Hard-coded at `t.x + 1` and `t.y - 2`, a clearing
       * that caught an elder's third column or its top crown row would not recognise it as hit, and
       * would leave a strip of 32px crown hanging over a cleared rectangle with no tree under it --
       * which the audit at the foot of this file fails the build for, but only if the strip happens
       * to fall on a cell the audit walks.
       */
      const top = Math.min(0, ...t.k.crown.map(([, dy]) => dy));
      const hitsColumns = t.x + t.k.trunk.length - 1 >= x && t.x <= x + w - 1;
      const hitsRows = t.y >= y && t.y + top <= y + h - 1;
      if (!hitsColumns || !hitsRows) continue;
      strike(i);
    }
  };
  /**
   * Strike the tree at register index `i` off the map: its own trunk tiles and collision, and every
   * crown cell no surviving tree also covers. Shared by `clearArea` and the river sweep, so the two
   * cannot disagree about what felling a tree means.
   */
  const strike = (i: number): void => {
    const t = trees[i]!;
    trees.splice(i, 1);
    /*
     * ...AND IT ONLY EVER TAKES ITS OWN TILE, collision included.
     *
     * This used to `clear()` both trunk cells unconditionally, which is a loaded gun pointing at
     * the one invariant the level cannot lose. Later passes write over a trunk cell and make it
     * solid for their own reasons -- the garden fence runs along row 12 through planted wood --
     * and clearing the collision under a fence rail opens a way round the notice post. So a cell
     * that no longer holds a trunk is somebody else's now: it keeps its tile and its collision,
     * and the tree simply goes off the register. Cells inside the rectangle have already had
     * both wiped by the sweep above.
     */
    for (let dx = 0; dx < t.k.trunk.length; dx++) {
      if (!isTrunk(t.x + dx, t.y)) continue;
      set(below, t.x + dx, t.y, 0);
      clear(t.x + dx, t.y);
    }
    /*
     * A shared cell belongs to its neighbour, asked of the REGISTER rather than of the tile. The
     * tile cannot answer it -- two crowns write the same cell and the second one wins -- and `t`
     * is already struck off above, so anything still covering this cell is somebody else's tree.
     */
    for (const [dx, dy] of t.k.crown) {
      const tx = t.x + dx;
      const ty = t.y + dy;
      if (!isCanopy(tx, ty)) continue;
      const survivors = trees.filter((other) => crownsOver(other, tx, ty));
      /*
       * ...AND A CELL ONE SURVIVOR NOW COVERS ALONE GETS THAT SURVIVOR'S OWN QUARTER BACK (Paul's
       * round, 2026-10-22). The river sweep strikes trees AFTER the pass that draws a shared cell
       * as one quarter laid over another (`elder-tl-over-mc` and its kind, near the foot of the
       * file), and leaving the cell alone left that composite standing for a tree that no longer
       * exists: the struck tree's top-left corner printed inside the survivor's crown, and the
       * survivor's own bottom-right corner was a square `elder-mc`, cut hard by the tile grid. That
       * was the "hard-edged rectangle where two elders stack" at (27,5), (57,6) and (12,32).
       * test/crown-depth.test.ts holds every `elder-mc` on the shipped map to a crown on both sides.
       */
      if (survivors.length === 1) {
        const o = survivors[0]!;
        const odx = tx - o.x;
        const ody = ty - o.y;
        set(
          above,
          tx,
          ty,
          o.flip ? gid(mirroredTile(o.k, odx, ody)) + FLIP_H : gid(o.k.tileAt(odx, ody)),
        );
        continue;
      }
      if (survivors.length > 0) continue;
      set(above, tx, ty, 0);
    }
  };

  // Rabbit's market stall, just west of the bridge.
  clearArea(11, 15, 4, 5);
  for (const [i, kind] of (
    ['stall-awning-l', 'stall-awning-m', 'stall-awning-m', 'stall-awning-r'] as const
  ).entries())
    set(above, 11 + i, 16, gid(kind));
  // The outer two are the counter's finished ends (2026-10-22); the middle two stay the seamless run.
  for (let i = 0; i < 4; i++) {
    set(
      below,
      11 + i,
      17,
      gid(i === 0 ? 'stall-counter-l' : i === 3 ? 'stall-counter-r' : 'stall-counter'),
    );
    solid(11 + i, 17);
  }
  landmarks['stall'] = { x: 11 * TILE, y: 17 * TILE };

  /*
   * THE SIGNPOST STANDS IN THE CROOK OF THE FORK, which is the whole reason there is one, and it
   * now stands in the crook the fork actually makes. It was at (9,19), which the carriageway runs
   * through at this seed: the one object on the map whose job is to mark a choice was planted in
   * the middle of the road it was marking. (9,18) is the tile the junction encloses -- fork above,
   * fork to the west, carriageway below -- and it is clear of the two rows a due-east walker walks.
   * Cleared first, because `place` writes a tile without striking off whatever tree was holding it.
   */
  clearArea(9, 18, 1, 1);
  place('signpost', 9, 18, 'signpost');
  /*
   * THE FOREST NOTICE IS NO LONGER THE SAME OBJECT AS THE SIGNPOST FOUR TILES FROM THE SPAWN.
   *
   * It stands on the main track, so every route to the cottage passes it -- and it was drawn with
   * `signpost`, the identical tile to the decorative one at (9,18), which is in the hero frame and
   * is the first post a player ever meets. That post has no writing on it and nothing behind it:
   * it marks a fork. Teaching the player in the first ten seconds that a post with arms on it is
   * scenery, and then resting the level's one mandatory zero-click beat on a post with arms on it,
   * is a teaching bug rather than a drawing one.
   *
   * `notice-board` is the same carpenter's post carrying a pale page ruled with writing -- what
   * `content/game.json` has always called it, "A notice nailed to a post". Arrows point; paper
   * speaks. The signpost at the fork STAYS, and stays as it is: the carriageway genuinely divides
   * there, the board's own Explore frame is built on a fork with a sign in the crook of it, and now
   * that the two are different objects the decorative one teaches nothing false. Deleting it would
   * leave the one real choice of route on the map unmarked to buy a problem that no longer exists.
   */
  place('notice-post', 43, 19, 'notice-board');
  /*
   * ...AND SINCE 2026-10-23 IT SAYS "I ♥ CYERA RESEARCH", WHICH TAKES TWO TILES OF PAGE.
   *
   * The client's ask: the notice's paper lettered in the sign font. "RESEARCH" is 31 pixels and a
   * page on one tile cannot carry it (s-props.ts, `NOTICE_PAGE`), so the page widens EAST onto
   * `notice-board-r` at (44,19) and the post moves to the seam. East, because west of (43,19) is the
   * sand of the approach -- (41,19) and (42,19) are the road's own north edge here -- and a notice on
   * the carriageway is the signpost's old fault.
   *
   * Only the LANDMARKS are written here. The tiles are laid in the second pass (section 6 there),
   * after every planting pass, and that is a measured choice rather than tidiness: laid here, the
   * three new solid cells changed what the planting passes after this point drew -- the wood is
   * planted off a noise stream and a new obstacle moves every later draw -- and the generation came
   * back with five more walkable cells under opaque crowns, a crown over the river at (33,1), and
   * trees moved at (10,2) and (13,2), forty tiles from any sign. Laid last, nothing else on the map
   * moves: the cmp against the committed map is the proof.
   *
   *   the notice's east half   (44,19): a sapling's west trunk until now; see section 6 for the fell.
   *   "Cyera Speed!"           (36,3): the clearing on the river's right bank at the head of the
   *                            waterfall, directly under the low hedge (35..37, 2) and a tile east of
   *                            the bank stones (34..36, 1), where the client's screenshot put it.
   *                            Open lawn from x 34 to 38 and rows 3 to 6, so one solid cell in its
   *                            north row closes no way through.
   *   the logo board           (20..21, 22): the left bank's clearing near the spawn, at its lower
   *                            right, where the client's screenshot put it -- two rows south of the
   *                            road to the bridge (row 20 there), the bank at (22,22) east of it and a
   *                            sapling at (18..19, 22) west. Off the sand and off both walk rows.
   *   "DEAD END"               (18,12), since 2026-10-25: the Speed! board, moved and repainted, at
   *                            the end of the north footpath where the Owl stood until he went over
   *                            the river (docs/GATEKEEPER.md). His cell was already solid -- nobody
   *                            in the cast is a ghost -- so the sign closes no way through, and the
   *                            old spot at (36,3) goes back to lawn.
   */
  landmarks['notice-post-r'] = { x: 44 * TILE, y: 19 * TILE };
  landmarks['sign-dead-end'] = { x: 18 * TILE, y: 12 * TILE };
  landmarks['sign-logo'] = { x: 20 * TILE, y: 22 * TILE };
  landmarks['sign-logo-r'] = { x: 21 * TILE, y: 22 * TILE };
  /*
   * THE WELL GLADE, and the one thing on this map a player can aim at.
   *
   * The well used to stand alone on the bank at (23,24), a single tile in an unbroken field of
   * trees, invisible until you were beside it. A map with no landmark readable at distance gives
   * the player nowhere to go: the plus sign of road and river told you only that you could walk
   * east, and every direction looked exactly like every other.
   *
   * So the well gets a clearing of its own -- the biggest hole in the wood on the map, eight by
   * six, with the south fork running through it and beds of flower round its edge. A bright gap in
   * a dark canopy reads from several screens away, which is the whole point: it is somewhere to
   * walk toward, and the fork going on through it says the walk continues.
   */
  clearArea(31, 24, 8, 6);
  place('well', 34, 27, 'well');
  for (const [fx, fy] of [
    [32, 25],
    [33, 25],
    [32, 29],
    [36, 24],
    [37, 25],
    [33, 29],
    [34, 24],
    [38, 28],
  ] as const)
    if (at(ground, fx, fy) !== gid('path') && !isWater(fx, fy))
      set(below, fx, fy, gid(fy % 2 === 0 ? 'flower-white' : 'flower-pink'));
  /*
   * A glade off the owl's fork, cleared of trees so the fountain is the only thing in it, and
   * with a few toadstools under the trees. Nothing happens here. It is somewhere to find.
   */
  clearArea(17, 11, 5, 5);
  place('fountain', 19, 13, 'fountain');
  /*
   * THREE STAMPS, AND ONLY IN THE SHADE AT THE BACK OF THE GLADE.
   *
   * This was seven, scattered about the glade, and before that a ring of twelve. The ring was
   * plainly wrong -- a perfect circle is the one arrangement nature never makes -- and scattering
   * them was a fix for the arrangement and not for the quantity. `toadstool-ring` draws three red
   * caps, so seven stamps is twenty-one mushrooms, and the glade sits inside the spawn camera: the
   * product manager traced the client's word "creepy" partly to exactly this, "red caps in clusters
   * read as poison, not as decoration", and noted that the board's own Explore frame contains none
   * at all.
   *
   * So: three stamps, in a line along the glade's north edge where the canopy shades it, which is
   * where fungus grows and is also the part of the glade the camera reads as its back wall. They
   * are decoration at the treeline rather than a hazard in the open, and nine caps in the shade is
   * about what the board's Question frame carries at the foot of its own wood.
   */
  /*
   * ...AND OFF THE SAND, which two of the three were on.
   *
   * The footpath runs along row 11 from x 13 to 18 and these were stamped at (17,11) and (18,11)
   * without asking, so two of the three rings of mushrooms were growing out of the middle of the
   * track. One of them was hidden by the owl's own clearing and the other was not. They move to the
   * glade's north-east, at the foot of the tree below, which is where fungus grows.
   */
  for (const [mx, my] of [
    [20, 11],
    [21, 11],
    [21, 12],
  ] as const)
    if (!isPath(mx, my)) set(below, mx, my, gid('toadstool-ring'));
  /*
   * ===========================================================================
   * THE OWL GETS A TREE TO SIT UNDER, which is a placement fix for a drawing complaint.
   * ===========================================================================
   *
   * On the board the owl is perched in a crown at head height, and that perch is most of why he
   * reads as an owl rather than as a brown barrel: a round bird against foliage is a bird, and the
   * same bird alone on a mown lawn is a barrel. Ours stood at (17,11) in the middle of a clearing
   * that had just had every tree in it removed, which is the one place on the map where nothing can
   * be behind him.
   *
   * The cheap and honest answer is placement rather than new art. This plants a tree at the glade's
   * north-east, AFTER the clearing is cut -- the clearing would otherwise strike it straight off the
   * register -- and stands him on the tile directly below its trunk, so the trunk rises behind his
   * head and the crown stands over it. The footpath now ends one tile west of the fountain, so he is
   * met at the end of the walk he is at the end of.
   *
   * The two cells the trunk takes are cleared first so the plant cannot be refused by whatever the
   * wood left there: a perch that silently fails to appear is the same bug as no perch at all.
   */
  /*
   * (2026-10-25, docs/GATEKEEPER.md: the Owl has moved over the river and this tile is the DEAD END
   * sign's now. The tree stays, for the same reason it was planted: the board end of a footpath
   * stands against something, and the sign stands under it where the Owl sat.)
   */
  clearArea(18, 9, 2, 3);
  if (!plantKind('mid', 18, 11)) throw new Error('the dead-end sign has no tree to stand under');
  place('lantern-post', 36, 32, 'lantern-post');

  /*
   * ===========================================================================
   * GRANDMA'S COTTAGE, at the east end, behind a fence with one gate.
   *
   * WEST BY TWO COLUMNS, BECAUSE THE PAYOFF CAMERA CLAMPS AND THE BUILDING WAS RIDING THE CLAMP.
   * ===========================================================================
   *
   * `frameAt` holds the camera inside the world, so a centre east of `MAP_W - tiles.width / 2` is
   * pushed back west and the SUBJECT slides right inside the frame instead. At `cx` 50 with a
   * six-tile facade the centre asked for was column 53 against a limit of 50.3, so the shot was
   * clamped by 2.7 tiles and the building sat in the right third of its own payoff frame -- which
   * is the product manager's placement note, and it is arithmetic rather than taste.
   *
   * The remedy is the one number that moves it: put the facade's own centre AT the clamp, so the
   * camera is still framed on the building and the building is in the middle of the picture. With
   * five columns that is `cx + 2.5 <= 50.3`, so `cx` 48 -- which is as far east as the house can
   * stand and still be centred, and it keeps the gate, the lane and the notice in the same
   * relationship to the door they have always had. Nothing here is quoted: `ARRIVE` below derives
   * the rectangle, and the audit at the foot of the file measures where the facade lands in it.
   */
  const cx = 48;
  /*
   * THE ROW THE GABLE AND THE CHIMNEY STAND ON. The facade proper starts one row below it.
   *
   * It moved down a row with the wall course that was dropped (see FOUR COURSES... below), because
   * the rows UNDER the building are fixed by the level: the lane is rows 20-21, the notice and the
   * trigger span 19-21, and a due-east walker's feet are on row 21 all the way across the map. The
   * doorstep is therefore row 18 whatever the building does above it, and the building is built up
   * from there rather than down from here.
   */
  const cy = 15;
  /**
   * The facade, in tiles, and the lane the arrival camera frames with it. See `ARRIVE` below.
   *
   * Declared up here, above the clearing it sizes, because every row and column of the building is
   * derived from these two and `cx`: the clearing, the roof loop, the wall course, the gable's
   * columns, the bank along the foot of the wall, the tabby against its east corner (until
   * 2026-10-22, when she moved off the doorstep to the main track; see her placement), the treeline's
   * `standsOnTheRoof`, the `prop-cottage` rectangle the game points its payoff camera with, and the
   * audit that measures where the facade lands in that camera. The only figures written out below
   * are the ones the LEVEL fixes rather than the building: the gate rows and the notice's.
   */
  const FACADE_W = 5;
  const FACADE_H = 3;
  /** The garden's east side, where the fence turns; declared here because the clearing stops at it. */
  const gardenEast = MAP_W - 3;
  /** `LANE_ROWS` in apps/game/src/world/forest-scene.ts: the rows of lane the payoff shot includes. */
  const LANE_ROWS = 3;
  const roofTop = cy + 1;
  const doorstep = roofTop + FACADE_H - 1;
  /*
   * THE CLEARING IS THE BUILDING'S FOOTPRINT AND A MARGIN, not a nine-by-nine square.
   *
   * This was `clearArea(cx - 1, cy - 1, 9, 9)` -- x 49 to 57, y 13 to 21 -- which is every tile of
   * the garden the fence encloses. So the payoff frame, the one every player ends on, was a
   * building standing in the middle of a mown rectangle with a treeline a long way off on both
   * sides. Put `b-cottage.png` beside the board's Arrive frame and the difference that reads first
   * is not the facade at all: the board's cottage is CROWDED. Big crowns press against it left and
   * right, hard up against the walls, and the fence runs a short way and disappears into them.
   *
   * Eight by seven clears the roof, the chimney a row above it, the walls and the doorstep row, and
   * stops one column short of the garden's east side. The margin wood then keeps its trees at x 57
   * and 58, so the arrival camera is framed by canopy on its right edge rather than ending in lawn
   * -- and the rows the lane and the door approach need are cut further down the file anyway, by
   * the passes that know which rows those are.
   */
  /*
   * ...AND IT IS NOW THE FOOTPRINT AND THE DOORSTEP ROW, WITH NO MARGIN AT ALL.
   *
   * Eight by seven, from cx - 1, held the wood a clear column off both ends of the facade. Put our
   * Arrive frame beside the board's (`crop reference/mocks/gameplay-concepts.png out.png 1536 1024
   * 1536 1024 0.72`) and the thing that reads first is how CROWDED the board's cottage is: a big
   * crown overlaps the left-hand wall outright, another presses the right, and the fence runs a
   * couple of panels out of each side and disappears into them. Ours stood in the middle of a
   * clearing with a tree line a column and a half away on both sides, which is the difference
   * between a cottage in a wood and a model on a table.
   *
   * Six by six is the building itself -- the gable and chimney row, the two roof courses, the two
   * wall courses -- plus the doorstep row below it, and nothing else. Trees may now stand at cx - 1
   * and cx - 2 and at cx + 6, which is a crown touching the wall on both sides. None of them can
   * reach the house: a trunk at the doorstep row would be on the lane, and a trunk below that throws
   * its crown onto the path, which the planter refuses.
   */
  /*
   * ...AND NOW IT IS THE HOUSE AND THE LAWN BETWEEN ITS EAST GABLE AND THE WOOD.
   *
   * Five rows: the gable and chimney row, the two roof courses, the one wall course, and the
   * doorstep row below it. The columns are the part that changed twice over, and the reason is
   * worth recording rather than re-derived.
   *
   * The footprint-only clearing was written for a facade six wide standing two columns further east,
   * so it covered three columns of garden that a five-wide facade at `cx` does not -- and the forest
   * floor was still standing on them. What that printed on the first render of the narrowed house was
   * FOUR BUSHES AND FLOWERS IN AN UNBROKEN VERTICAL FILE down column 55, from the row above the roof
   * to the row beside it, which guard 7g caught and the build refused. It is the cross-pass case that
   * guard exists for: the forest's cover, the undergrowth sweep's companions and the garden bed each
   * cap their own runs at three and none of them can see the others.
   *
   * The garden's interior is the cottage's own ground -- the bank along the foot of the wall, the
   * ring round the east corner and the bed between the lane and the fence all plant it, and all
   * three go through `tuft`, which refuses the fourth tile in a line. Forest floor inside the fence
   * is a pass that does not know it is in a garden. So the clearing runs from the facade out to two
   * columns short of the garden's east side, which leaves the wood the two columns it stands in and
   * is the same ground the committed map happened to clear with a wider house.
   *
   * WHAT IS GIVEN UP, SO IT IS NOT CLAIMED TWICE: the paragraph above says "a crown touching the wall
   * on both sides", and after this that is true on the WEST only. The wood still presses the west
   * gable at cx - 1 and the treeline stands on the rows above the roof, but on the east it is now the
   * banked planting and the dressing ring that meet the house, with the wood two columns behind them.
   * That is also what the board does on that side -- its right-hand wall is met by a water butt, a log
   * stack and the chimney, and its crowns press the LEFT -- so this is a trade rather than a loss.
   */
  clearArea(cx, cy, gardenEast - 1 - cx, FACADE_H + 2);
  /*
   * ===========================================================================
   * FOUR COURSES, NOT FIVE: roof-peak / roof / wall / wall.
   * ===========================================================================
   *
   * The facade was five rows -- peak, roof, and THREE courses of wall -- which is 160 pixels of
   * elevation. Measured off the board's own Arrive frame, its cottage is about 100 of our pixels
   * tall, 48 of roof over 52 of wall. Ours was 64 over 96: two thirds wall, where the board is half,
   * and the extra course is the reason the building reads long and low -- a shed rather than a
   * cottage. There is nothing the painter can do about it either, because with the door and the
   * windows on the bottom course the top course of a three-course wall can only ever be blank
   * plaster, which is 192 pixels of flat cream across the payoff frame.
   *
   * Dropping the middle course costs nothing and fixes the proportion: 64 of roof over 64 of wall.
   * The row the building gave up goes BACK to the building rather than to the lawn -- everything
   * moves down a row, so the doorstep, the lane, the arrival trigger and the note on the door all
   * keep the rows they are measured on, and the chimney stands on the row the peak used to have,
   * which is still directly behind the ridge.
   */
  /*
   * ===========================================================================
   * ...AND NOW THREE: roof-peak / roof / ONE course of wall, five columns wide.
   *
   * The paragraph above halved the blank plaster and left the other half standing. This takes it.
   * ===========================================================================
   *
   * WHAT WAS STILL WRONG, measured on the payoff frame rather than on the tile sheet. Four courses
   * means two courses of wall, and only the LOWER one can carry an opening: the door's threshold is
   * the ground and the windows' boxes hang off their sills, so both are drawn at the foot of their
   * tile. A tile laid four times across the upper course therefore cannot carry a one-off, and what
   * it printed was a hundred and ninety-two pixels of unbroken cream -- the largest connected patch
   * of flat colour anywhere in the last frame of the game, measured at 1,626 pixels centred on the
   * wall two tiles east of the door. "Roughly four tiles of empty cream in the middle of the payoff
   * shot" is that blob, and the audit at the foot of this file now measures it.
   *
   * MEASURED ON THE BOARD, and this is the part that settles it. Purple is 48 pixels tall in our build
   * and 162 of the mock's own pixels in its Arrive frame, so the mock is drawn at about 3.4 of its
   * pixels to one of ours (ART_DIRECTION section 2 derives the same ratio off the Explore frame).
   * Converted at that ratio, the board's cottage is:
   *
   *     wall, outside of post to outside of post      176 px   -- about 5.5 of our tiles
   *     wall, eave to the foot of the plaster          49 px   -- about 1.5 tiles
   *     roof, eave to ridge (the ridge is cut)        >=37 px
   *     door                                        47 x 48 px
   *     window                                      26 x 24 px
   *
   * So the board's wall is HALF AS TALL AS OURS and its windows sit right up under the eave -- its
   * blue window's head is six of our pixels below the eave line. Ours were a whole blank course and
   * part of a second below it. The width was never the problem; the wall's HEIGHT was, and the
   * blank course was the height.
   *
   * THREE ROWS IS 53 PIXELS OF ROOF OVER 42 OF WALL, which is the board's 48 over 49 within five
   * pixels either way. The roof tile already carries the top eleven rows of the wall -- `EAVE_Y` in
   * s-cottage.ts puts the fascia at row 20 of `roof-l/m/r` and the overhang's shadow on plaster
   * beneath it -- so one 32-pixel course of openings under it is a wall of 42, not of 32.
   *
   * AND FIVE COLUMNS, WHICH IS WHAT "FOUR TILES WIDE" MEANS WITH AN OVERHANG. `wall-corner` keeps
   * its outer sixteen columns transparent so the roof projects, so a five-column roof stands over
   * exactly 128 pixels -- four tiles -- of plaster, which is ART_DIRECTION section 9.1's figure and
   * what DESIGN_BOARD section 3 has asked for for three rounds. Five is also the narrowest the
   * accepted facade fits in: corner post, window, door, window, corner post, with nothing left over.
   * Six columns left one slot spare, which is why the door sat a column west of the gable's apex
   * with two tiles of bare cream between it and the lit window.
   */
  for (let i = 0; i < FACADE_W; i++) {
    const kind = i === 0 ? 'roof-l' : i === FACADE_W - 1 ? 'roof-r' : 'roof-m';
    set(below, cx + i, roofTop, gid('roof-peak'));
    set(below, cx + i, roofTop + 1, gid(kind));
    solid(cx + i, roofTop);
    solid(cx + i, roofTop + 1);
  }
  /*
   * The chimney is part of the building, so it stops her like the rest of it. It sits a row above
   * the roof peak, outside the `prop-cottage` rectangle, and it was the one tile of the cottage
   * with no collision under it: a player walking the strip between the garden's north fence and the
   * roof passed straight through the chimney stack, drawn over her as she went.
   */
  /* At the east end of the ridge, as the board puts it, and clear of the gable by a column. */
  set(below, cx + FACADE_W - 1, roofTop - 1, gid('chimney'));
  solid(cx + FACADE_W - 1, roofTop - 1);
  /*
   * THE GABLE, over the door, on the row the chimney stands on.
   *
   * `roof-peak` is laid six times, so the ridge is a dead straight 192-pixel rule across the payoff
   * frame and the review's verdict on the building was that no amount of per-tile scalloping can
   * rescue a wrong outline. A gable happens ONCE, which is why the cottage owner made it a tile
   * rather than a variant: two halves meeting in an apex on the seam between them, the second laid
   * with the horizontal mirror bit so the attic window straddles the join.
   *
   * It stands on the row above the roof peak, which the facade gave up when the wall dropped a
   * course -- so the one row of lawn between the enclosure's north run and the roof now carries the
   * gable and the chimney, and the building reads against the garden instead of stopping flat.
   *
   * THE APEX IS ALWAYS HALF A TILE OFF THE DOOR'S CENTRE, and it is worth saying why rather than
   * letting the next owner hunt it. The gable's apex sits at the RIGHT edge of the plain copy, so
   * the pair meets on the seam BETWEEN two tiles; the door is one tile wide, so its centre is in the
   * MIDDLE of a tile. A seam and a tile centre are sixteen pixels apart and no placement closes
   * that -- only a two-tile door would, and Grandma has one front door. Sixteen pixels of a
   * hundred-and-sixty-pixel facade is what we pay. It was the same sixteen at six columns; what is
   * new is that the door is now the facade's own middle column, so the gable leans off the door
   * rather than the door sitting off the gable.
   */
  set(below, cx + 1, roofTop - 1, gid('gable'));
  set(below, cx + 2, roofTop - 1, gid('gable') + FLIP_H);
  solid(cx + 1, roofTop - 1);
  solid(cx + 2, roofTop - 1);
  /*
   * ONE COURSE OF WALL, AND EVERY TILE OF IT CARRIES SOMETHING.
   *
   * The loop that laid plain `wall` across two courses is gone with the upper course: at five
   * columns the wall is corner post, window, door, window, corner post, so there is no cell left for
   * a blank tile to stand in. Each tile is set by name below; the collision is laid here, over the
   * whole course, so a tile that is overwritten later still stops her.
   */
  for (let i = 0; i < FACADE_W; i++) solid(cx + i, doorstep);
  /*
   * ...AND THE FACADE ENDS IN A CORNER POST, which is what makes the roof overhang.
   *
   * `wall` runs to the edge of its tile, so the wall and the roof were exactly the same width and
   * met the lawn on the same two vertical lines: two stacked rectangles, no eaves, no verge. The
   * cottage owner's `wall-corner` carries a timber corner post with its outer sixteen columns
   * TRANSPARENT, so laying it at each end of every wall course stops the plaster half a tile inside
   * the roof and leaves `roof-l` and `roof-r` projecting over the grass on both sides.
   *
   * The cell stays solid. What is transparent is the half tile UNDER the eaves, and a player walking
   * into the side of the house should stop at the house, not half a tile inside it.
   */
  set(below, cx, doorstep, gid('wall-corner'));
  set(below, cx + FACADE_W - 1, doorstep, gid('wall-corner') + FLIP_H);
  /*
   * The windows move down to the doorstep course, flanking the door, which is where the board puts
   * them: a blue one on one side and a lit one on the other, each with a box under it. On a
   * three-course wall they sat on the middle course and the course below them was blank; on two
   * courses there is one row that can carry a window at all, and it is this one.
   */
  set(below, cx + 1, doorstep, gid('wall-window'));
  /*
   * ...AND THE RIGHT-HAND ONE IS LIT. The Arrive panel says "The lamp is lit" and the copy is
   * protected, so the art moves: `wall-window-lit` is the board's own amber window with the warm
   * spill on its sill, and it goes at the window the tabby sat under until she moved to the main
   * track on 2026-10-22. One of the two, not both --
   * the board lights one side and leaves the other blue, and two lit windows on a two-window facade
   * is a lantern, not a cottage. No animal in it, by the painter's own note: a tile is the same
   * pixels on every ending, and the wolf belongs to the panel.
   *
   * It is at `cx + 3` now rather than `cx + 4`: the two windows sit one column either side of the
   * door, which is the board's own symmetry and was not available while a sixth column had to be
   * filled with something.
   */
  set(below, cx + 3, doorstep, gid('wall-window-lit'));
  /*
   * ONE front door. There were two.
   *
   * `door` is not a door leaf, it is a complete arched door with its own stone surround, so laying
   * it at cx+2 and again at cx+3 gave Grandma's cottage a matched pair of front doors side by side
   * -- on the game's payoff screen, in the one frame of the board every player ends on. The porch
   * stays two tiles wide because the door lane, the arrival trigger and the door note are all two
   * tiles wide and are measured from these columns; it is the tile beside the door that was wrong,
   * and the wall course laid above already has the right tile for it.
   */
  /*
   * ...AND THE NOTE SHE PINNED TO IT, which is the other half of the same defect.
   *
   * `scoring.errandGoals` pays a hundred points for `sign` -- "Read the note she pinned to her
   * door" -- and half of one of the two lines that reach the game's 1,000 ceiling runs through it.
   * The rect that fires it, `notice-cottage-door`, covers two columns of the lane west of the door
   * and the garden tile above them: before this it was one flower bed and five tiles of lane, with
   * both decor layers empty over every one of them. Nothing was drawn. A player walked over a flower
   * bed and a panel opened.
   *
   * `door-note` is the cottage owner's `door` repainted exactly, with a sheet pinned to its west
   * leaf -- west because the lane arrives from the west, so the note faces the walk and is in view
   * for the whole approach rather than appearing once she is on top of it. The cell is the same
   * cell, with the same collision: this is one gid, not a new object. `GAME_DESIGN` 5b's "reachable,
   * not unavoidable" is a design decision about the TRIGGER and it is unchanged; what changes is
   * that there is now something to miss.
   */
  set(below, cx + 2, doorstep, gid('door-note'));
  /*
   * The landmark is the BUILDING, not the row above it. `prop-cottage` is built from this and is
   * asserted solid over its whole rectangle, and the arrival camera is framed on it, so it has to
   * name the roof's own top row: anchored a row higher it would claim a row of lawn as cottage and
   * fail the generator's own audit.
   */
  landmarks['cottage'] = { x: cx * TILE, y: roofTop * TILE };
  /*
   * GRANDMA'S MAILBOX, flag up (UI_FOUNDATIONS section 8, the 04 Arrive scene; approved by the
   * client 2026-10-23). Where the lane meets the road, one column east of the facade's last
   * column, on the first walk row below the doorstep: (53,20) on this map.
   *
   * EAST OF THE LANE, NOT WEST WHERE THE BOARD STANDS IT, and the reasons are all audits in this
   * file. The board's spot is the lawn between the fence and the doorstep. Every tile of
   * `notice-cottage-door` -- columns cx and cx + 1 under the doorstep -- must stay walkable (audit 5),
   * so it cannot stand there; and the column west of that is the only way into the strip of garden
   * between the fence and the west wall, so a solid post there seals the strip into a pocket. East
   * of the lane's mouth is open lawn with nothing that depends on it, it is inside the payoff frame
   * at every viewport the arrival is framed for (guard 7k holds it whole there, through its object),
   * and it stands half a tile clear of the wolf's prints, which run up the lane's east edge (the
   * prints' 32px sprites are centred on the lane's east boundary, so they end where this cell's
   * western neighbour is half spent).
   *
   * Laid in the second pass, after every planting pass, so nothing grows on it afterwards.
   */
  landmarks['mailbox'] = { x: (cx + FACADE_W) * TILE, y: (doorstep + 2) * TILE };
  /*
   * ===========================================================================
   * THE PAYOFF FRAME, derived the way the game derives it rather than guessed at.
   * ===========================================================================
   *
   * `forest-scene.ts` stops following Purple the moment she arrives and frames the BUILDING instead:
   * the span from the chimney row above the facade down through the three rows of lane below it,
   * centred, so the smoke stays off the top edge. The camera is then clamped to the east edge of
   * the world, which is why this shot is NOT symmetrical about the cottage and why the facade sits
   * right of centre in it -- a fact that has to be composed around rather than wished away.
   */
  const ARRIVE_AT = {
    x: cx + FACADE_W / 2,
    y: roofTop + (FACADE_H + LANE_ROWS - 1) / 2,
  };
  const ARRIVE = frameAt(REFERENCE_VIEWPORTS.desktop, ARRIVE_AT);
  /*
   * THE SAME SHOT ON A PHONE, WHICH IS THE TALLER OF THE TWO. Asked for, not assumed: `cameraFor`
   * answers 11.22 tiles of height for the desktop reference viewport and 16.69 for the phone, so
   * the arrival frame a phone shows reaches about three rows further north and three further south
   * than the desktop one. Anything composed to sit just OUTSIDE the desktop frame therefore sits
   * comfortably INSIDE the phone's.
   */
  const ARRIVE_PHONE = frameAt(REFERENCE_VIEWPORTS.phone, ARRIVE_AT);

  /*
   * Garden fence with a single gate on the main path. The garden has to be ENCLOSED: a fence that
   * only runs north-south can be walked around at either end, which would let the player reach the
   * cottage without passing the notice post. The run north of the gate, the run south of it, and
   * the two returns east to the treeline are all load-bearing.
   */
  const fenceX = 46;
  /*
   * THE ENCLOSURE IS DRAWN TO FIT THE FRAME IT APPEARS IN, which it was not.
   *
   * It ran from cy-2 to cy+10, thirteen rows, on a camera fifteen rows tall that is centred on the
   * cottage: so the arrival frame -- the payoff of the whole game -- showed the north run along the
   * top, the gate below it, and the south run three rows past the bottom edge. A fence you only ever
   * see one side of does not read as a garden; it reads as a rail lying across the lawn, which is
   * the picture half of the client's note about the fence. Ten rows puts the whole enclosure, both
   * corners and the gate inside the frame at once, which is what makes it a garden.
   *
   * The gate is the two rows the main track arrives on, and it is the only gap: `map.test.ts` floods
   * the map refusing to step on the notice and asserts the gate cannot be reached, so the run north
   * of the gate, the run south of it and the two returns east are all load-bearing.
   */
  /*
   * ===========================================================================
   * THE TWO HORIZONTAL RUNS SIT OUTSIDE THE PAYOFF FRAME, which is how the enclosure is broken.
   * ===========================================================================
   *
   * `docs/DESIGN_BOARD.md` section 3 asked for "an enclosure with a gate", and the product manager
   * has since withdrawn that line: the board never draws one. It puts two short lengths of fence
   * beside the building and lets the wood do the rest. Measured on our arrival frame, the top edge
   * of the payoff shot -- the last thing every player sees -- was a FENCE RAIL across twelve of its
   * twenty columns, with a second rail across the bottom. A pen, photographed.
   *
   * The enclosure cannot simply be opened. `map.test.ts` floods the map refusing to step on the
   * forest notice and asserts the gate is unreachable, and that zero-click beat is the whole lesson
   * of the level; the fence is the only thing holding it, because every other solid tile out here
   * is `fellable` and the connectivity sweep is free to cut through it. Breaking the barrier would
   * trade the point of the game for a nicer photograph.
   *
   * So the barrier stays and the PHOTOGRAPH changes: the two horizontal runs move out of the shot
   * altogether, one row above its top edge and one row below its bottom. The camera then sees the
   * two vertical runs -- the gate side and the far side, both of which read as a receding line of
   * post tops rather than as a rail lying on the lawn -- and the north strip the move opens up is
   * planted as treeline, so what cuts the top edge of the payoff frame is canopy.
   *
   * Both rows come off `ARRIVE` rather than off the cottage, so they follow the camera.
   */
  /*
   * ===========================================================================
   * ...AND "OUT OF THE SHOT" MEANS OUT OF BOTH SHOTS. It meant out of the desktop one.
   * ===========================================================================
   *
   * Both rails were derived from `ARRIVE`, the DESKTOP arrival rectangle, and placed one row
   * outside it. That is exactly one row of clearance on one viewport and none at all on the other:
   * the phone's arrival frame is 16.69 tiles tall against the desktop's 11.22, so it reaches about
   * three rows further out on each side, and rows 11 and 25 sat well INSIDE it. The payoff frame
   * the previous round moved a fence rail out of still had a fence rail across the top of it and a
   * second across the bottom -- the pen, photographed -- on the device most visitors to a research
   * page arrive on. The guard at the foot of this file measured `ARRIVE` and reported a rail run of
   * zero while this was true, which is the familiar shape of the mistake: a bound aimed at one
   * viewport reporting green for all of them.
   *
   * So the enclosure is derived from the TALLER rectangle and the rails leave both frames. Nothing
   * about the barrier changes: the two rows are solid from the fence out to the edge of the world
   * either way, the gate is still the two rows the track arrives on, and `map.test.ts` still finds
   * the notice unwalkable-around. What changes is which rows carry the picture.
   *
   * THE FRAMING DOES NOT FOLLOW THE FENCE, which is the half that had to be separated out. Three
   * things were written as `gardenTop + n` and only one of them is about the enclosure:
   *   - the treeline strip behind the house, whose whole job is to be what cuts the TOP EDGE of the
   *     arrival camera;
   *   - the short east run, whose whole job is to be seen in the payoff frame;
   *   - the garden beds, which really do fill the enclosure and really do follow it.
   * The first two now come off `stripTop`, the desktop frame's own first row, so moving the fence
   * leaves the wood and the payoff frame exactly where they were. Checked: `stripTop + 1` and
   * `stripTop + 2` are rows 13 and 14, which is what `gardenTop + 2` and `gardenTop + 3` were, and
   * the separation is byte-neutral on today's map -- proved by making it on its own and diffing the
   * generated map against the previous one, which came back identical.
   *
   * ===========================================================================
   * AND THE MOVE ITSELF IS NOT MADE HERE. MEASURED, COSTED, AND HANDED BACK. 2026-10-20.
   * ===========================================================================
   *
   * `ARRIVE_PHONE` is computed and the two lines below are a one-word change away from using it.
   * They are not using it because the move was tried, measured and reverted, and the next owner
   * should have the measurement rather than the attempt:
   *
   *   - Derived from the phone's rectangle the rails go to rows 9 and 27 and leave both frames,
   *     which is the fix and it works. Barrier and reachability hold: 1488/1488 walkable tiles
   *     reachable, the gate still unreachable with the notice refused.
   *   - It costs an ELDER at the garden's east margin. The wood at rows 6-8 of columns 57-58 gains
   *     a tree, the thinning pass answers by felling one (10 -> 11), and the one it takes is the
   *     elder whose trunk stood at row 20 of columns 57-59 and whose crown was the only thing
   *     covering the border band at column 59 for rows 17, 18 and 19. `sealBorder` backfills the
   *     cells with scrub and the result is a FOUR-TILE FILE of hedge down column 59, rows 17-20,
   *     inside the arrival camera.
   *   - That is composition guard 7g, whose bound is 3 and whose own note says "lower it as the
   *     planting improves; never raise it". The hem-stone pass cannot reach it either: its run
   *     limit is 4 and the file is exactly 4, so it is legal there and illegal in the frame.
   *
   * Which leaves three ways through, none of them this task's: lower `HEM_RUN`, which moves the
   * border band over the whole map; teach the hem stones about the cameras, which is the shared
   * threshold this section's preamble warns against; or plant the east margin so the flood stops
   * felling it, which is `w-trees.ts` and the crown merge. The fault is real and the remedy is two
   * lines. It is held here by a bound nobody should move on a cosmetic argument.
   */
  const gardenTop = Math.floor(ARRIVE.y0) - 1;
  const gardenBottom = Math.ceil(ARRIVE.y1);
  /** The payoff frame's own top row. What is composed FOR the shot is measured from here. */
  const stripTop = Math.floor(ARRIVE.y0);
  const gateRows = [20, 21] as const;
  /*
   * Every panel clears its own cell first. The fence runs through ground the wood was planted on,
   * and laying a rail over a trunk leaves the tree on the register with a fence post for a trunk --
   * a crown floating over a picket, which is drawn from the register and so passes every audit in
   * this file. `clearArea` strikes the tree off with its crown, and the `solid` on the next line
   * puts the collision straight back, so nothing about the barrier changes.
   */
  const panel = (x: number, y: number, tile: string): void => {
    clearArea(x, y, 1, 1);
    set(below, x, y, gid(tile));
    solid(x, y);
  };
  /*
   * ===========================================================================
   * THE RUN IS BROKEN BY POSTS, which is the client's fence note for the third round running and
   * the one part of it that was never a drawing problem.
   * ===========================================================================
   *
   * `fence-post` is four receding caps at an eight-pixel pitch, and the tile is right: at zoom 10
   * it is a domed cap over a shaded body with lawn and a sprig breaking its base, and it was
   * accepted two rounds ago. Stamped on thirteen consecutive rows it is FIFTY-TWO caps in an
   * unbroken column with no daylight anywhere in it, and fifty-two caps at a constant pitch do not
   * read as fifty-two posts. They read as one brown rope running off the top of the payoff frame
   * and off the bottom of it.
   *
   * Crop the board at `1130 380 300 230 4` and its answer is plain: its receding run is about SEVEN
   * caps long and then it hits a wide flat-capped post, and its picket run is three pickets with
   * lawn between them. Nothing on the board repeats a rhythm for longer than the eye can count.
   *
   * So the posts go in. `fence-corner` is a single wide post with a flat cap, a hard step, a grain
   * line and no rhythm at all -- its own docstring says a post is a post and the tile works at the
   * head of a run, at the foot of one, and in the middle where a run passes it. Dropped into the
   * file at an IRREGULAR pitch it breaks fifty-two caps into runs of eight, eight and four, each
   * ending at something that stops the eye.
   *
   * NOT ONE CELL OF COLLISION CHANGES. Every row of the run is still panelled and still solid; what
   * changes is which of two post tiles is drawn on it. `map.test.ts` floods the map refusing to
   * step on the notice and asserts the gate is unreachable, and that is still held by an unbroken
   * column of solid cells.
   *
   * The pitch is read off the same grain the wood is shaped by rather than written out, so the
   * three segments are not themselves a rhythm -- which is the fault one level up, and the one this
   * round is about.
   */
  for (let y = gardenTop; y <= gardenBottom; y++) {
    if (y === gateRows[0] || y === gateRows[1]) continue;
    panel(fenceX, y, 'fence-post');
  }
  {
    /*
     * A post every third or fourth tile, counted from the gate outward so the two posts flanking the
     * gap stay where they are and the rhythm walks away from them in both directions.
     *
     * The number is the board's, converted. `fence-post` carries four caps a tile at an eight-pixel
     * pitch and the board's run shows about seven caps between posts, so two or three run tiles is
     * the length to leave: a post every second tile reads as a chain of short links, which is a
     * second rhythm rather than no rhythm.
     */
    /*
     * ...AND THE WALK STOPS ONE ROW SHORT OF THE CORNER, which it did not.
     *
     * Counted off the shipped map, column 46 read: row 11 `fence-corner-e`, row 12 `fence-corner`,
     * then three plain posts. Two wide flat-capped posts stacked one on top of the other is not a
     * run broken by a post -- it is a doubled post, and it is the first thing in the column the
     * payoff frame's top edge cuts. The cause is arithmetic: the walk counted down to
     * `gardenTop + 1` and the pitch came due on exactly that row, so the post landed against the
     * corner that was already there. Bounding the walk at `gardenTop + 1` instead leaves at least
     * one plain post between any wide post and a corner, which is what "a run broken by a post"
     * means. The south walk never reached its corner, so it is unchanged and is left alone.
     *
     * Nothing about the rhythm moves: the two runs are still 3 and 3 tiles of receding cap, which
     * is what composition guard 7h bounds, and audit 10 now refuses a doubled post outright.
     */
    let run = 0;
    for (let y = gateRows[0] - 2; y > gardenTop + 1; y--) {
      run++;
      if (run < (grainAt(fenceX, y) > 0.5 ? 4 : 3)) continue;
      panel(fenceX, y, 'fence-corner');
      run = 0;
    }
    run = 0;
    for (let y = gateRows[1] + 2; y < gardenBottom - 1; y++) {
      run++;
      if (run < (grainAt(fenceX, y) > 0.5 ? 4 : 3)) continue;
      panel(fenceX, y, 'fence-corner');
      run = 0;
    }
  }
  for (let x = fenceX; x <= gardenEast; x++)
    for (const y of [gardenTop, gardenBottom]) panel(x, y, 'fence-h');
  /*
   * ===========================================================================
   * AND THE EAST SIDE, which was open, so the garden was three sides of a rectangle.
   * ===========================================================================
   *
   * The two horizontal runs ended at `gardenEast` and nothing joined them. What closed the garden in
   * practice was the loop below, which makes the cells from `gardenEast` out to the map edge solid on
   * those two rows and leaves the strip between them open to the east -- it is a barrier, and the
   * reachability tests are satisfied by it, and it is INVISIBLE. So the payoff frame shows a fence
   * that starts at a corner post, runs eleven tiles and stops in mid-air on both sides, with the
   * cottage standing between two parallel rails rather than inside anything. The client's note is
   * about the fence looking wrong from above and the review's is about the fence relating to nothing;
   * this is the half of both that the map owns.
   *
   * It is drawn with the same end-on post the north-south run west of the gate uses, and the two
   * corners already carry `fence-corner-w` from the loop above, so the run meets a post at each end
   * exactly as the west side does. Nothing about what is solid changes -- those cells were already
   * solid -- so no reachability test can see this, which is the point: it is picture, not barrier.
   */
  /*
   * ===========================================================================
   * ...AND IT IS A SHORT LENGTH OF FENCE, NOT A SECOND ROPE. Same defect, opposite remedy, because
   * this side is picture and the west side is barrier.
   * ===========================================================================
   *
   * Drawn down the whole height of the frame this was the second brown rope in the payoff shot:
   * twelve tiles, forty-eight caps, entering the top edge and leaving the bottom with nothing at
   * either end to turn it, parallel to the first one at eleven columns' remove. Two parallel
   * vertical rules either side of the house is most of what makes the last frame of the game read
   * as a pen rather than as a garden.
   *
   * The board does not draw an enclosure at all. It puts two SHORT lengths of fence beside the
   * building -- a corner post, a few caps, another post -- and lets the wood do the rest. This side
   * can simply be that, because nothing in the level hangs on it: the enclosure is held by the two
   * horizontal runs, which are solid from the fence out to the edge of the world on both rows, and
   * every reachability test is satisfied by those alone. So the run comes down to three tiles
   * hanging off the north-east corner and ending at a post, and the eight rows it vacates become
   * garden.
   *
   * THEY VACATE THEIR COLLISION WITH THEIR TILE, deliberately. A solid cell with nothing drawn on it
   * is a fault this file fails the build for ("solid tile(s) with nothing drawn on them"), and an
   * invisible wall down the middle of the one garden the player walks into is exactly the bug that
   * audit exists to catch. The strip east of them is inside the enclosure either way.
   */
  const EAST_FENCE_ROWS = 3;
  /*
   * ANCHORED TO THE PAYOFF FRAME, NOT TO THE FENCE. This ran from `gardenTop + 1`, so the moment
   * the enclosure's north rail moved out of the phone's frame as well this short run would have
   * marched three rows north with it and left the east side of the last frame of the game showing
   * no fence at all. Its job is to be SEEN, so it is measured from the frame.
   */
  for (let y = stripTop; y < stripTop + EAST_FENCE_ROWS; y++)
    panel(gardenEast, y, y === stripTop + EAST_FENCE_ROWS - 1 ? 'fence-corner' : 'fence-post');
  /*
   * THE FENCE STAYS SOLID AND STOPS BEING WALLPAPER, which are not the same request.
   *
   * It has to be an unbroken barrier: `map.test.ts` depends on it enclosing the cottage on three
   * sides so the notice post cannot be walked around, and that zero-click beat is the lesson of
   * the level. Breaking the run into lengths with gaps in it would destroy the one thing the level
   * teaches. So nothing here changes what is solid; what changes is the picture.
   *
   * Two moves, both pure dressing. The mirror pass now gives `fence-h` and `fence-post` the
   * horizontal flip bit -- neither is read back by name in that test, only `path` and `bridge` are
   * -- which stops the same picket printing twenty-four times in a row along the top of the frame
   * the game ends on. And the runs TERMINATE: a corner post where the two axes meet, a post at the
   * far end, and scrub carrying on past it, rather than the line running out to the edge of the
   * frame and stopping in mid-air.
   */
  /*
   * A REAL CORNER POST WHERE THE TWO AXES MEET, now that there is a tile for one.
   *
   * These four cells used to carry `fence-post`, which is a face-on picket with rails -- the same
   * drawing the run is made of. So the one place the fence changes direction was drawn as though it
   * did not, and the board's answer is the opposite: where its fence turns, it puts a single wide
   * post with a flat cap that reads from both runs at once. The fence owner has appended
   * `fence-corner` for exactly this, and it is the cheap half of the fence problem.
   *
   * The expensive half HAS now landed, in the painter rather than here, and this note is kept
   * because it was written when it had not and the correction is the useful part. `fence-post` was
   * a picket seen face-on, which cannot be seen end-on from above, so the north-south run rendered
   * as the brown ladder the client meant by "from the top view, in the front, it looks weird". The
   * fence owner has since REDRAWN that tile in place, keeping its gid: it is now two post tops
   * joined by a narrow dark rail, four columns against the post's ten, with lawn either side of the
   * rail and a sprig that changes side. Verified on the composed map at 7x -- the run reads as a
   * receding line of posts, and lawn shows between them.
   *
   * Nothing here had to change for that, which is the point worth keeping: the fix cost no gid, no
   * map regeneration and no line in this file. If a third and fourth post silhouette are ever
   * wanted, THAT is the change that needs a placement here and an entry in `MUST_STOP_HER`.
   */
  /*
   * ...AND WHICH CORNER POST IS A PROPERTY OF THE CORNER.
   *
   * Plain `fence-corner` paints columns 8 to 24 while `fence-h` paints its rails across the full
   * width, so a picket run arriving at a corner left seven columns of bare lawn between the post and
   * the first rail: the fence came apart at all four corners. The fence owner's two new posts carry
   * the rails out of one side of the tile. `fence-corner-e` is the post a run leaves to the east --
   * the garden's two west corners -- and `fence-corner-w` is the post a run arrives at from the
   * west, which is the two east ones. Neither may be mirrored by the pass at the foot of the file,
   * and neither is in its list: the side is the whole content of the tile.
   */
  for (const y of [gardenTop, gardenBottom]) {
    panel(fenceX, y, 'fence-corner-e');
    panel(gardenEast, y, 'fence-corner-w');
  }
  /*
   * ...AND AT BOTH SIDES OF THE GATE, which is the half that was missing.
   *
   * The north-south run simply stopped a row above the sand and started a row below it, so the gate
   * was not a gate: it was two lengths of picket ending in open lawn with a road between them. The
   * board's fence never stops in the middle of anything -- every run it draws ends at a post. A gate
   * is a gap BETWEEN TWO POSTS, and these are the two.
   *
   * Plain `fence-corner` here, and that is the painter's own rule rather than an omission: the two
   * new posts carry a rail stub out of one side for a picket run to meet, and nothing runs
   * horizontally into either side of a gate post. The row below the gate is also the garden's
   * south-west corner, where a run DOES leave eastward along the bottom of the enclosure, so it
   * keeps the `fence-corner-e` the loop above gave it and is skipped here.
   */
  for (const y of [gateRows[0] - 1, gateRows[1] + 1])
    if (y !== gardenTop && y !== gardenBottom) panel(fenceX, y, 'fence-corner');
  /*
   * ===========================================================================
   * ...AND THE GATE ITSELF, which the gap has never had.
   * ===========================================================================
   *
   * THE OPENING WAS AN ABSENCE OF FENCE, not an under-drawn one. Read down column 46 before this
   * loop existed: post run, flat terminator plank, NOTHING, NOTHING, flat plank, post run.
   * `decor-below` at (46,20) and (46,21) was literally `0`. The two `fence-corner` terminators the
   * loop above plants are the least-finished object in the payoff frame precisely because they
   * terminate against thin air -- they are the right tile doing the right job with nothing to hand
   * off to.
   *
   * WHY IT SURVIVED THREE QUEUED ROUNDS, and this is the part worth keeping, because the same
   * blind spot will swallow the next picture-only defect:
   *
   *   1. THE GATE IS DEFINED AS A HOLE IN A BARRIER, AND EVERY TEST THAT WATCHES IT WATCHES THE
   *      BARRIER. `map.test.ts` floods the map refusing the notice and asserts the gate is
   *      unreachable; audit 2a asserts a due-east walk is unobstructed; audit 4 asserts the notice
   *      spans the approach; the connectivity flood asserts the garden is reachable through it.
   *      ALL FOUR PASS PERFECTLY ON AN EMPTY CELL -- an absence of fence is maximally reachable.
   *      Reachability cannot see a picture. `tiles/s-outdoor.ts:1000-1021` records exactly the same
   *      blind spot for the north-south run ("neither `pnpm score` nor any test could see it").
   *   2. THERE WAS NO TILE TO PLACE. `TILE_NAMES` was frozen for most of this project's life, and
   *      `fence-corner`, `fence-corner-e` and `fence-corner-w` were each appended to solve a
   *      DIFFERENT joint. The note above is correct that plain `fence-corner` belongs at a gate
   *      post because nothing runs horizontally INTO one -- and silent about the opening between
   *      the two.
   *   3. THE TERMINATORS LOOK FINISHED IN ISOLATION. `fence-corner` is an approved tile and renders
   *      correctly at zoom 10. The defect exists only in the composition of four cells, which is
   *      the same class of fault as the rail stub its own docstring records: "Nothing in the tile
   *      itself shows this; it only appears once two tiles are laid side by side, which is why four
   *      passes over the corner post missed it."
   *
   * WHY TWO LEAVES AND NOT ONE TILE STAMPED TWICE. The opening is two cells tall along the fence
   * axis -- 64px -- so one tile repeated is 32px of identical pixels printed twice: it can carry a
   * hinge or a latch but not both, and it cannot leave daylight in the MIDDLE of the gap, which is
   * the one place daylight says "open". Which END a leaf is hung at is a property of the leaf,
   * exactly as `fence-corner-e`/`-w` record that which SIDE a rail leaves on is a property of the
   * corner. The painters and their measured bounds are in `tiles/s-outdoor.ts`.
   *
   * THE GATE STANDS OPEN, and that is forced rather than chosen: these two cells MUST stay
   * walkable (`map.test.ts:240`, audit 2a's due-east walk, and the fact that the player walks
   * through here to reach the cottage), so a rail drawn from post to post would be a picture of a
   * shut gate over a cell Purple strolls through. Read down column 46 now: post, rail, daylight,
   * rail, post.
   *
   * NOT `panel`. `panel` clears the cell, draws AND makes it solid -- it is the barrier's helper
   * and this is the opening, which is the one part of the fence that is not a barrier. `set` alone,
   * and no `clearArea` either: both cells are measured empty on `decor-below` and `0` on collision
   * at this point in the file, so there is nothing to strike off, and `clearArea` would reach for
   * trees and collision it has no business touching. The `ground` layer is untouched either way --
   * `clearArea` never writes `ground` -- so `path-n`/`path-s` survive regardless.
   *
   * Audit 13 at the foot of this file checks both halves of this: that the opening is DRAWN, and
   * that what is drawn is still WALKABLE. Its bound is the published `gate-fence-gap` rectangle,
   * not `gateRows`, so it also catches those two drifting apart.
   *
   * THE LEAVES THEMSELVES ARE NOT PLACED HERE, AND THAT IS MEASURED RATHER THAN PREFERRED. See the
   * placement next to the gate lane further down this file, and the note there: the lane pass runs
   * after this point and wipes `decor-below` on exactly these two cells, so a placement here draws
   * the gate and then silently loses it. It was written here first and produced a zero-cell diff.
   */
  for (let x = gardenEast; x < MAP_W; x++)
    for (const y of [gardenTop, gardenBottom]) {
      solid(x, y);
      if (x > gardenEast && at(below, x, y) === 0) set(below, x, y, gid(scrub(x, y)));
    }
  landmarks['gate'] = { x: fenceX * TILE, y: gateRows[0] * TILE };

  /*
   * ===========================================================================
   * AND WHAT CUTS THE TOP EDGE OF THE PAYOFF SHOT IS A TREELINE.
   * ===========================================================================
   *
   * Moving the north run out of the frame opens two rows of garden above the cottage, and two rows
   * of mown lawn running off the top of the last frame of the game is the same fault as the one the
   * title screen had: a bright field with the sky above it. So the strip is planted, with its
   * crowns on the rows the camera's top edge cuts and its trunks on the row below them -- the wood
   * carrying on behind Grandma's house rather than stopping at a line.
   *
   * ONE ROW OF TRUNKS, WITH GAPS IN IT, and both halves of that are load-bearing. A second rank
   * directly below would seal the strip above it into a pocket, and the connectivity sweep opens a
   * pocket by felling whatever is thinnest -- which would be these trees, after every count here
   * had been taken. The gaps are what keep the strip connected to the rest of the garden, and they
   * are also what makes it read as a treeline rather than as a hedge.
   *
   * Nothing stands on the row directly above the roof: a trunk drawn there is a tree growing out of
   * the ridge, which is the same fault the garden bed below refuses for the same row.
   */
  /*
   * ...AND "THE ROW DIRECTLY ABOVE THE ROOF" IS ASKED OF THE MAP, NOT COUNTED OFF THE FACADE.
   *
   * It read `x + 1 < cx || x > cx + FACADE_W - 1` -- any column the building stands in, at any row.
   * That was the same rule as this one while the facade's top drawn row was the one directly below
   * the deep trunk row, and it stopped being the same rule the moment the building dropped a course:
   * the gable row moved down with it, so the deep row is now a clear row above the roof in every
   * column except the three the gable and chimney stand in, and the old test refused all five.
   *
   * What it cost was not planting, it was the PAYOFF FRAME'S TOP EDGE. The deep row is the only one
   * of the two whose crown reaches the rows `topEdgeRows` measures -- a trunk on the shallow row
   * throws its crown above the camera entirely -- so refusing it over the house dropped the arrival
   * camera from nine closed columns to seven and opened a thirteen-column run of sky, which the
   * guard at the foot of this file caught.
   *
   * So the question is asked of the cell: is there anything drawn directly below this trunk? A tree
   * whose trunk sits on the roof's own top row is a tree growing out of the ridge and a tree one
   * clear row above it is a tree behind the house, and only the map knows which this is.
   */
  const standsOnTheRoof = (x: number, row: number): boolean =>
    [x, x + 1].some((c) => at(below, c, row + 1) !== 0 && c >= cx && c < cx + FACADE_W);
  let behind = 0;
  for (let x = fenceX + 1; x < gardenEast;) {
    const tries: ReadonlyArray<readonly [string, number]> = [
      ...(standsOnTheRoof(x, stripTop + 2)
        ? []
        : [['mid', stripTop + 2] as const, ['sapling', stripTop + 2] as const]),
      ['mid', stripTop + 1],
      ['sapling', stripTop + 1],
    ];
    const took = tries.find(([kind, row]) => plantKind(kind, x, row));
    if (!took) {
      x += 1;
      continue;
    }
    const planted = trees[trees.length - 1]!;
    planted.framing = true;
    behind++;
    // A gap of one or two columns, read off the same grain the rest of the wood is shaped by, so
    // the line breaks irregularly instead of at a fixed pitch.
    x += planted.k.trunk.length + (grainAt(x, stripTop - 1) > 0.5 ? 2 : 1);
  }
  /*
   * A DEDICATED EAST-MARGIN PLANTING PASS STOOD HERE AND IS DELETED, 2026-10-20.
   *
   * It walked the seven rows between the garden's east fence and the bottom of the garden, lifting
   * the seal's hedge off each one and offering `plantKind('mid', gardenEast + 1, y)` the cell. It
   * reported `0 down the east margin` on every run -- seven attempts, seven refusals -- while the
   * twenty-five lines of comment above it asserted a composition RESULT it did not produce: three
   * trees closing the corner of the arrival frame. A comment that claims an effect the code does
   * not have is the expensive kind, so the pass and the claim go together.
   *
   * The margin is closed anyway, by the general wood and the sapling infill: the late `breakHem`
   * call below finds the band already deep in canopy, which is the reason a dedicated pass finds no
   * room. See the note on `breakHem` running twice for how the east margin actually gets its cover.
   */
  console.log(`  cottage: ${behind} tree(s) of treeline behind the garden's north strip`);

  /*
   * Make sure the path through the gate and up to the door is walkable -- AND THAT IT IS TRACK.
   *
   * These tiles were painted sand and never put in `pathTiles`, so for the whole of the rest of the
   * file the garden's own lane was not a path. Three things followed from that and all three were
   * silent:
   *
   *   1. The canopy is rebuilt from the register, hundreds of lines below, so the `set(above, 0)`
   *      this used to do was undone: any tree whose crown reached the lane had it redrawn over the
   *      sand, which is the one thing `plantKind` refuses to do deliberately.
   *   2. Nothing downstream treated the lane as road -- not the verge planting, not the sweep that
   *      keeps a shoulder walkable, not the lone-bush sweep.
   *   3. The lane got no path-edge tiles, so it met the lawn on a dead straight seam on all four
   *      sides while every other stretch of track on the map is rimmed.
   *
   * `clearArea` is what strikes the tree off the register, which is the only thing that can stop the
   * crown coming back; registering the tile is what fixes the other two.
   */
  const lane = (x: number, y: number): void => {
    clearArea(x, y, 1, 1);
    set(ground, x, y, gid('path'));
    pathTiles.add(y * MAP_W + x);
  };
  for (let x = fenceX; x <= cx + 3; x++) for (const y of gateRows) lane(x, y);
  /*
   * ===========================================================================
   * AND HERE THE GATE IS ACTUALLY DRAWN -- after the lane, because the lane erases it.
   * ===========================================================================
   *
   * THE REASON THIS IS NOT UP WITH THE FENCE, WHERE IT BELONGS BY SUBJECT. `lane()` on the line
   * above calls `clearArea`, and `clearArea` sets `below` to 0. The gate-lane loop runs from
   * `fenceX` eastward across BOTH `gateRows` -- which is precisely (46,20) and (46,21), the two
   * cells the gate is drawn on. So the fence section, 170 lines up, is upstream of a pass that
   * wipes the exact cells it would be writing.
   *
   * THIS IS NOT A GUESS, IT IS THE MEASUREMENT, and it cost a round to make: the placement WAS
   * written up with the two `fence-corner` terminators, the obvious and tidy home for it, and
   * regenerating produced a diff of ZERO cells. Not a wrong tile, not a misplaced one -- no change
   * at all, because the gate was drawn and then erased 170 lines later by a pass whose name says
   * nothing about decor. Tracing every write to `below(46,20)` and `below(46,21)` gives exactly
   * three: this placement, and the two `clearArea`s inside `lane()`. `lane()` is the LAST writer,
   * and nothing below this point touches either cell -- which is why here, immediately after it,
   * is both correct and the earliest correct position.
   *
   * THE GENERAL LESSON, because the next owner will hit it with a different tile: in this file the
   * owner of a cell is WHATEVER WROTE IT LAST, not whichever pass the cell belongs to by subject.
   * A tile placed in the section that is about it, by a pass that runs before a clearing pass, is
   * a tile that does not exist in the output. The section above has the full note on what the gate
   * is and why it is two leaves; this is only where the pixels survive to the artefact.
   *
   * NOT `panel`, and NOT `lane` either. `panel` would make the opening SOLID and close the only
   * way into the garden -- audit 2a's due-east walk and `map.test.ts:240` both fail on that, which
   * is the right way round: the barrier is the run either side of the opening, never the opening.
   * `set` alone leaves `ground` (`path-n`/`path-s`, just laid by the lane) and `collision` (0)
   * exactly as they are, and writes only the decor the gap has never had.
   */
  for (const [i, y] of gateRows.entries()) {
    set(below, fenceX, y, gid(i === 0 ? 'gate-n' : 'gate-s'));
    // The leaf swung open runs on into the garden's first cell (tiles/s-outdoor.ts, 2026-10-25).
    set(below, fenceX + 1, y, gid(i === 0 ? 'gate-n-swing' : 'gate-s-swing'));
  }
  /*
   * THE APRON AT THE DOOR IS LOAD-BEARING, and this is the note rather than the fix.
   *
   * The sand inside the garden is the two rows of gate lane plus the two columns of door approach,
   * and the review is right that their union reads as a rectangle. Neither half can be narrowed.
   * The gate is two rows because the notice spans the two path rows of its approach and the
   * zero-click beat depends on that; the approach is two columns because the door is two tiles wide
   * and `trigger-cottage`, `notice-cottage-door` and the row a due-east walker walks are all
   * measured from them. Narrowing either one moves a rect the tests assert against, and the one
   * tile it would save is not worth that. What the arrival frame needs instead is planting banked
   * against the sand, which the dressing below does.
   */
  for (let y = doorstep + 1; y <= gateRows[1]; y++) for (const x of [cx + 2, cx + 3]) lane(x, y);
  /*
   * ...AND THE THRESHOLD GETS A STEP.
   *
   * The lane reached the door through a two-tile neck one row deep, rimmed on three sides, and at
   * 1x that reads as a pale stain on the lawn rather than as a doorstep -- on the destination of
   * the whole game, under the one door every player walks to. The board carries an unbroken sand
   * apron right across the front of its cottage and runs the pawprints over it.
   *
   * Three tiles, centred on the door rather than on the two-tile porch, so the step is symmetrical
   * about the thing it belongs to. It stops short of the east window, where the tabby sat until
   * 2026-10-22: she had to touch the track to be met and must not stand in the middle of it. She
   * has since left the doorstep altogether, because a talking ring beside the door lane is inside
   * the run's ending; (52,19) is an ordinary walkable bush now.
   */
  for (const x of [cx + 1, cx + 2, cx + 3]) lane(x, doorstep + 1);
  /*
   * ...and now that they are track, they get the rim every other stretch of sand has. Only the lane
   * and the tiles around it: re-running the rim over the whole of `pathTiles` would repaint the
   * bridge, whose deck sits on path rows and is written onto the ground layer after the rim pass.
   */
  for (let y = gateRows[0] - 1; y <= gateRows[1] + 1; y++)
    for (let x = fenceX - 1; x <= cx + 4; x++) if (isPath(x, y)) pathEdge(x, y);
  for (let y = doorstep; y <= gateRows[1]; y++)
    for (const x of [cx, cx + 1, cx + 2, cx + 3, cx + 4]) if (isPath(x, y)) pathEdge(x, y);

  /*
   * Grandma's garden is planted, because an enclosed rectangle of bare lawn is the one place on
   * the map that reads as unfinished rather than as open. It is also the last thing the player
   * sees, and the board's Arrive frame has beds along the fence.
   *
   * This runs after the lane and the door approach are cut, and it skips anything already placed,
   * so it can only land on the lawn between them. Nothing here is solid: the walk to the door
   * must stay clear whichever row Purple is on.
   */
  /*
   * BEDS GO WHERE THE BEDS ARE SEEN, which is the payoff frame and not the whole enclosure.
   *
   * This walked `gardenTop + 1` to `gardenBottom - 1`, and while the enclosure was derived from the
   * desktop frame those two were the same thing. They stopped being the same thing the moment the
   * rails moved out to the phone's frame: the enclosure gained two rows at each end, the beds
   * followed it into them, and four extra rows of planting round the edge of the garden moved the
   * thinning pass by one tree and put a four-tile file of scrub down column 59 inside the arrival
   * camera -- composition guard 7g, whose own note says to lower that bound and never raise it.
   *
   * A bed is dressing. Its rows come off the frame, intersected with the enclosure so a bed can
   * never land on or outside a rail. Checked: `rowsOf(ARRIVE)` is rows 12 to 24, which is exactly
   * what `gardenTop + 1 .. gardenBottom - 1` enumerated before the fence moved.
   */
  for (const y of rowsOf(ARRIVE))
    for (let x = fenceX + 1; x < gardenEast; x++) {
      if (y <= gardenTop || y >= gardenBottom) continue;
      if (!inside(x, y) || at(below, x, y) !== 0 || at(above, x, y) !== 0) continue;
      if (at(ground, x, y) === gid('path')) continue;
      /*
       * NOTHING ABOVE THE ROOF AT ALL: the whole strip between the enclosure's north run and the
       * building is treeline and lawn, never bed.
       *
       * It used to be the single row `roofTop - 1`, which was the one row of garden there was when
       * the facade was four courses and its gable stood on that row. A 32px bush drawn immediately
       * above the roof's top course reads as a shrub growing out of the roof, which is what the
       * arrival render showed, four of them along the ridge.
       *
       * At three courses the building sits a row lower, so the strip is three rows deep -- and the
       * rule, pinned to one row, let the bed into the other two. What it printed on the first render
       * of the narrowed facade was EIGHT bushes in an unbroken file along the row above the gable,
       * from the house out to the garden's east fence, which guard 7g caught and the build refused.
       * That strip is where the treeline behind the house goes (see the pass above), so the bed has
       * no business in it at any depth, and the rule now says so rather than naming a row.
       */
      if (y < roofTop) continue;
      // A field again, for the same reason as the forest floor and the bank: these tiles are
      // opaque, so a bed has to be a connected patch or it is a scatter of squares on a lawn.
      const bed = scrubNoise(x / 2.9, y / 2.9);
      if (bed < 0.58) continue;
      set(
        below,
        x,
        y,
        gid(bed > 0.78 ? scrub(x, y) : speckle(x, y) < 0.5 ? 'flower-white' : 'flower-pink'),
      );
    }

  /*
   * DRESSING THE LANDMARKS, which is a placement fault and not a painting one.
   *
   * At 7x the well is a good little well -- stone courses, slate roof, posts, bucket, a strong
   * near-black keyline. In the camera it is a brown dot, and repainting it would have wasted a
   * round. What is wrong is that it is one tile standing by itself in an empty lawn, and the same
   * is true of the fountain, the signpost and the lantern. The board never does that: its well
   * sits in a bed of flowers with tufts and a stone or two around it, and the ring of dressing is
   * what makes a one-tile object read from across the frame and makes the player want to walk
   * there -- which is the test for this, not the score.
   *
   * Nothing placed here is solid. The landmarks sit on or beside the track, and the gate approach
   * in particular has to stay exactly as walkable as it was.
   */
  /*
   * The spawn clearing is NOT excluded here, and that is deliberate. Everything this predicate
   * gates -- the landmark dressing and the verge tufts -- is soft: flower and scrub that Purple pushes
   * through, never a boulder, which is why `rock` came out of the mix. Refusing to plant soft cover
   * round the spawn is what left her standing in the middle of a mown field; the board's Purple stands
   * at a fork with tufts and flower beds right up to the sand.
   */
  const onGrass = (x: number, y: number): boolean =>
    inside(x, y) &&
    grassStep.get(at(ground, x, y)) !== undefined &&
    at(below, x, y) === 0 &&
    at(above, x, y) === 0;
  /**
   * Mixed, because a ring of one repeated tile is a different kind of wallpaper -- and soft, every
   * tile of it.
   *
   * `rock` used to take the last fifth of this mix, and it was the one tile here that cannot be
   * soft. A boulder is solid everywhere else on the map: the gorge banks and `clump('rock', ...)`
   * both make theirs solid, and a boulder is drawn as a boulder -- it reads as a thing you walk
   * round. Seventeen of them stood on the verge of the track and in the rings around the well, the
   * signpost and the forest notice, and the player walked straight through every one. The dressing
   * cannot answer that by going solid: these rings sit ON the road, the gate approach among them,
   * and it has to stay exactly as walkable as it was or the zero-click beat has a way round it. So
   * the stone comes out of the mix instead and the scrub takes its share. Four tiles still, and
   * nothing in this pass now draws a thing it does not mean.
   */
  /*
   * ...AND WHAT IT PLANTS IS READ OFF THE GROUND, NOT OFF A DIE. This was the last per-tile coin
   * flip in the file and it is the one the camera actually shows.
   *
   * `pick` was `rnd()`, drawn fresh per tile, so two neighbouring tiles of verge got two unrelated
   * drawings. Every pass that calls this covers a CONTINUOUS line or ring -- two thirds of the
   * length of every verge on the map, and a ring round each of nine landmarks -- so what it printed
   * was a chain of alternating bush, white, pink and bush, tile after tile, the whole way along the
   * road. The review's "six objects in a straight horizontal line at even spacing" and "chains of
   * alternating bush-and-flower following the road" are both this one line, and neither is a
   * placement fault: the tiles are in the right places and the sequence is wrong.
   *
   * The file has already fixed exactly this once, for the open-island cover, and wrote up why --
   * "LIKE GOES WITH LIKE". Two broad octaves sampled at the tile's own position give a stretch of
   * verge that is leaf for several tiles with a bed of white set into it and a bed of pink further
   * on, which is what the board's verges are: green with flowers at the edges of it. The shares are
   * unchanged, so the same number of each tile is planted; only which of its neighbours each one
   * sits beside moves.
   */
  const bloom = valueNoise2D(20261053);
  /**
   * How long a file of planting this cell would be part of, along one axis, if it were planted.
   *
   * `bush` and `flower-*` only: a crown, a trunk or a boulder beside a bed is the bed having an edge
   * against something, which is what a bed wants.
   */
  const plantedRun = (x: number, y: number, dx: number, dy: number): number => {
    let n = 1;
    for (const sign of [1, -1])
      for (let k = 1; ; k++) {
        const nx = x + dx * k * sign;
        const ny = y + dy * k * sign;
        if (!inside(nx, ny)) break;
        const name = TILE_NAMES[(at(below, nx, ny) & BASE_GID) - 1] ?? '';
        if (!name.startsWith('bush') && !name.startsWith('flower')) break;
        n++;
      }
    return n;
  };
  /*
   * ===========================================================================
   * ...AND NO BED EVER REACHES FOUR TILES IN A STRAIGHT LINE. One rule, in the one place the three
   * passes that lay a BED go through.
   * ===========================================================================
   *
   * NOT "every soft planting on the map", which is what this said and it was not true. `clump` and
   * the forest-floor sweep both write scrub and bloom straight to the `below` layer and neither
   * goes anywhere near here, so neither is capped: `clump` is a grown mass that is allowed to be
   * whatever shape the free ground leaves it, and the floor sweep is a continuous field cut at a
   * level, which is a floor rather than a bed. Routing either through this cap would move hundreds
   * of tiles and is not what the cap is for. What the cap owns is the three passes below, and the
   * separate run cap `mayBush` carries is the matching rule for the other half; the note above the
   * lone-bush sweep says why the same three cannot live in one place.
   *
   * Three passes lay planting -- the banks against the wall and the fences, the rings round the
   * landmarks, and the verge along the road -- and none of them can see the others. Each one is
   * individually reasonable and where two of them aim at the same strip their union is a file: the
   * product manager counted two dead-straight rows of flower bushes under the facade and a one-per-row
   * file down the frame's edge, and a third turned up during this round at column 54, four deep,
   * where the wall bank's thickening met the south bed's.
   *
   * Capping the RUN rather than the count is what keeps a bed a bed. A three-by-three mass of leaf
   * with blooms in it passes untouched -- that is the shape the board banks against a wall -- and the
   * fourth tile in a straight line is refused, which is the tile at which a mass stops reading as
   * grown and starts reading as laid out. It is checked here because here is the only place that
   * knows what is already on the ground, whichever pass is asking.
   */
  /*
   * HALF, NOT SEVEN TENTHS, and it is the same finding `dress` already carries: a `flower-*` tile
   * is a bloom bush drawn well inside its own 32x32, so a connected run of them reads at 1x as a
   * row of bright dots at a one-tile pitch however tidily they are gathered. Mostly leaf with
   * blooms set into it is one dark mass with colour in it, which is what the board banks against a
   * wall. The two defaults being different was the whole reason the garden beds printed as rows
   * while the verges did not.
   */
  /*
   * The default bloom share comes down from 0.7, which is the last of the "neat rows" finding.
   *
   * A `flower-*` tile is a bloom bush drawn well inside its own 32x32, so it shows lawn at all four
   * corners -- which means that even a CONNECTED bank of four of them reads at 1x as four separate
   * bright dots at a one-tile pitch. That is why the beds kept looking like rows however they were
   * gathered: gathering fixes where they are and cannot fix what one of them looks like beside
   * another. `bush` is opaque and fills its tile, so a bank that is mostly leaf with two or three
   * blooms set into it reads as one dark mass with colour in it, which is what the board's beds are.
   * Half rather than seven tenths is the share that gets there without touching the settled decision
   * that the blooms stay warm.
   */
  /*
   * THE TWO NOTES ABOVE ARGUE ABOUT ONE NUMBER, so the number is declared once and they sit over it.
   *
   * It used to be a `flowers` parameter threaded through `tuft`, `bank` and `dress`, with the same
   * 0.5 at every one of the fourteen call sites -- five of `bank`, eight of `dress` and one direct
   * `tuft` -- and the two paragraphs above were each attached to one of the two defaults, which is
   * how the two defaults came to disagree in the first place. The three cuts stay written as this
   * share times 0.4, 0.7 and 0.85 rather than as 0.2, 0.35 and 0.425: the ratios between white,
   * pink and red are a separate decision from how much bloom there is, and spelling the products
   * out would pin them to the share's current value and let the two drift apart again.
   */
  const BLOOM_SHARE = 0.5;
  const tuft = (x: number, y: number): void => {
    if (plantedRun(x, y, 1, 0) > 3 || plantedRun(x, y, 0, 1) > 3) return;
    const pick =
      bloom(x / 2.6 + 131, y / 2.6 + 131) * 0.72 + bloom(x / 1.3 + 83, y / 1.3 + 83) * 0.28;
    set(
      below,
      x,
      y,
      gid(
        pick < BLOOM_SHARE * 0.4
          ? 'flower-white'
          : pick < BLOOM_SHARE * 0.7
            ? 'flower-pink'
            : pick < BLOOM_SHARE * 0.85
              ? 'flower-red'
              : scrub(x, y),
      ),
    );
  };
  /*
   * ===========================================================================
   * A BANK, which is the shape `dress` cannot make and the board uses everywhere.
   * ===========================================================================
   *
   * `dress` scatters `count` points in a squashed disc about a centre. That is the right tool for a
   * ring of planting round a well or a signpost, and it is the wrong tool for the thing the board
   * actually does with undergrowth, which is to run it in a CONTINUOUS line along the foot of
   * something: the whole base of the cottage wall, the inside of the fence, the edge of the sand.
   * A disc of fourteen tiles laid against a wall puts planting at the wall on four or five of its
   * columns and a tile or two out in the lawn on the rest, so the wall still meets clean grass along
   * most of its length and the frame reads as a building standing on a lawn -- which is exactly the
   * verdict on the payoff frame.
   *
   * This walks the run instead and plants every tile of it that is free, so the bank has one
   * straight edge against the thing it is banked on -- that is what makes it read as planting rather
   * than as litter -- and a ragged one on the other side, from a field rather than a coin flip per
   * tile. A tile the wall, the gable or the lane already occupies is simply skipped, so the bank
   * flows round the door and the gable without any of the callers knowing where those are.
   */
  /*
   * ===========================================================================
   * ...AND THE SECOND ROW WAS A FIELD READ ALONG A LINE, which is the mistake this file has now
   * made four times and written up three.
   * ===========================================================================
   *
   * `deeper(x / 2.9, y / 2.9) > 0.58` decides whether the bank thickens by a tile. A bank runs along
   * ONE ROW, so that is a two-dimensional field sampled on a line of near-constant y: a ten-tile run
   * crosses three and a bit lattice cells of a 2.9-tile field, so the answer is the same for three or
   * four tiles at a time and frequently the same for the whole run. What it printed in the payoff
   * frame was the bank's own row and a SECOND ROW DIRECTLY ABOVE IT, both continuous, both planted
   * from the same mix -- two dead-straight rows of near-identical flower bushes under the facade,
   * which is the product manager's third complaint this round.
   *
   * The remedy is the one `northEdge` already uses for the identical reason: a term in the run's own
   * parameter, at a period shorter than the run, so the depth genuinely varies ALONG it. The bank
   * then has a lobed outer edge -- three tiles of two-deep, four of one -- which is what the board's
   * beds have, instead of a rectangle of planting. The phase is seeded off the run's own origin so
   * two banks in one frame are not in step with each other.
   */
  const deeper = valueNoise2D(20261059);
  const bank = (
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    len: number,
    /** Which way the bank may thicken: away from the thing it is banked against. */
    out: readonly [number, number],
  ): void => {
    for (let i = 0; i < len; i++) {
      const x = ox + dx * i;
      const y = oy + dy * i;
      if (onGrass(x, y)) tuft(x, y);
      const swell =
        Math.cos(i / 1.15 + ox * 0.7 + oy * 1.3) * 0.6 +
        (deeper(x / 1.4 + 211, y / 1.4 + 211) - 0.5);
      if (swell <= 0.18) continue;
      const bx = x + out[0];
      const by = y + out[1];
      if (onGrass(bx, by)) tuft(bx, by);
    }
  };
  const dress = (ox: number, oy: number, spread: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 1 + rnd() * spread;
      // Squashed, because the camera is a letterbox (19.41 x 11.22 tiles, the same aspect the
      // old 26x15 figure had) and a circle of dressing reads as an
      // ellipse taller than it is wide.
      const x = ox + Math.round(Math.cos(angle) * r);
      const y = oy + Math.round(Math.sin(angle) * r * 0.75);
      if (!onGrass(x, y)) continue;
      tuft(x, y);
    }
  };
  /*
   * WHERE PURPLE IS STANDING, which had no dressing at all and is the first thing anybody sees.
   *
   * Every other landmark on the map got a ring of planting and the spawn did not, because until a
   * few hundred lines up nothing was allowed to grow inside the spawn clearing. So the hero frame
   * of the asset opened on a character standing in the middle of a mown field. The board's Purple
   * stands at a fork with flower beds and tufts right up to the sand on both sides.
   *
   * Wider and heavier than the other rings: this is the one clearing a player looks at for several
   * seconds before she touches a key.
   */
  dress(SPAWN.x, SPAWN.y, 3.4, 18);
  dress(9, 22, 2.6, 10); // the shoulder south of the fork, so the junction has a floor
  dress(34, 27, 3.2, 20); // the well
  dress(19, 13, 3.2, 16); // the fountain
  dress(12, 18, 3.2, 14); // the market
  dress(9, 19, 2.2, 8); // the signpost at the start of the walk
  dress(43, 19, 2.2, 8); // the forest notice on the gate approach
  dress(36, 32, 2.8, 12); // the lantern
  /*
   * ...AND THE GARDEN HARDEST OF ALL, because it is the last frame of the game.
   *
   * The arrival frame is the place the whole story walks toward and it rendered as a building on a
   * rectangle of mown lawn. The board's Arrive frame has beds right along the fence and planting
   * banked against the walls, which is most of why its cottage reads as lived in. Three rings:
   * against the house, either side of the lane, and along the inside of the fence.
   */
  /*
   * ALONG THE WHOLE BASE OF THE WALL, which is the one arrangement the board's cottage makes
   * unmistakable and ours had never had. The run is the full width of the facade plus a tile of
   * verge at each end, on the row below the doorstep; the two columns of door approach are lane and
   * are skipped by `onGrass`, so the planting arrives at the step from both sides and stops, which
   * is what the board draws. It thickens south into the garden where the field says so.
   */
  bank(cx - 1, doorstep + 1, 1, 0, FACADE_W + 2, [0, 1]);
  /* Up the gable end, so the house is not banked on one side only and bare on the other. */
  bank(cx + FACADE_W, roofTop + 1, 0, 1, 4, [1, 0]);
  // The east corner of the house, clear of the wall itself.
  dress(cx + FACADE_W, doorstep, 2.4, 10);
  /*
   * ...AND THE TWO FENCE BEDS ARE AT OPPOSITE CORNERS, which is a shape fix.
   *
   * Both of them used to be centred on column 48, one at each end of the strip between the fence and
   * the west wall -- and that strip is three columns wide and seven rows tall, so two rings of
   * twelve in it is not two beds, it is one column of planting six tiles long. Rendered at 3x it was
   * a file of six near-identical flower bushes at a one-tile pitch down the left of the payoff
   * frame, which is the same lattice the verge had and in the one frame that matters most.
   *
   * North-west and south-east instead, with fewer in each. The garden's open lawn is along the two
   * horizontal runs, which are eleven tiles wide, so a bed laid against one of those is a bed.
   */
  /*
   * ...AND NOW THEY ARE RUNS ALONG THE FENCE RATHER THAN DISCS NEAR IT. Same reasoning as the wall:
   * the thing that makes a garden read as a garden is planting with its back to the boundary, all
   * the way along, not a bed in the middle of the lawn. Three runs -- inside the north fence, inside
   * the new east fence, and inside the south fence east of the gate -- which between them give the
   * payoff frame a planted border on every side the camera shows, and leave the lawn in the middle
   * of it clean.
   */
  /*
   * The three garden runs take the default bloom share with everything else, rather than the 0.8
   * they carried. Eight tenths over a ten-tile run is eight blooms in a line in the one frame the
   * whole story walks towards, and the frame is the test: this is where the product manager counted
   * them.
   */
  bank(fenceX + 1, gardenTop + 1, 1, 0, gardenEast - fenceX - 1, [0, 1]);
  /*
   * The east run is now as long as the east FENCE is, which is three tiles. A bank is planting with
   * its back to a boundary; run down a boundary that is no longer drawn it is just a file, and a
   * ten-tile vertical file of scrub down the right of the payoff frame is the same fault as the
   * fence rope it was banked against.
   */
  // Follows the short east run, which is anchored to the payoff frame rather than to the enclosure.
  bank(gardenEast - 1, stripTop + 1, 0, 1, EAST_FENCE_ROWS, [-1, 0]);
  bank(fenceX + 1, gardenBottom - 1, 1, 0, gardenEast - fenceX - 1, [0, -1]);

  /*
   * ...AND FEATHERING THE EDGE OF THE ROAD.
   *
   * Where sand meets grass it meets it on a dead-straight tile edge, and over the stretches whose
   * rows are load-bearing -- the twelve tiles of gate approach, the thirteen across the crossing --
   * the road cannot be made to jog without breaking the bridge alignment or the zero-click beat.
   * The board's verges are not straight either, and it does not get that from the road's geometry:
   * it gets it from what grows along it. Tufts and flower at irregular intervals, read off a fine
   * field so they come in drifts, break the line without moving a single path tile.
   */
  const verge = valueNoise2D(20261047);
  const besideSand = (x: number, y: number): boolean =>
    NEIGHBOURS.some(([dx, dy]) => {
      const n = nameAt(ground, x + dx, y + dy);
      return n.startsWith('path') || n.startsWith('bridge');
    });
  /*
   * ...AND THE SHOULDERS ARE PLANTED ALONG THE WHOLE LENGTH, not sprinkled.
   *
   * The threshold was 0.62, which plants about a third of the verge, and a third of a verge is a
   * dotted line beside a road rather than a shoulder. What the whole-map render showed is the
   * reason the track still read as a highway after every other fix: the sand is two tiles, the
   * verge sweep below fells trees one tile either side of it so the road is walkable, and a crown
   * sits two rows above its trunk -- so the smallest light band the road can occupy is six or seven
   * rows, and at a third cover those rows were bare lit grass from one edge of the map to the
   * other. A full-width pale band across the middle of every frame is the single thing that made
   * the level read as a municipal road rather than as a track through a wood.
   *
   * ...AND THEN TWO THIRDS OF LEAF BOTH SIDES TURNED OUT TO BE A HEDGE. Reversed, measured, and the
   * reasoning behind the reversal matters more than the numbers.
   *
   * Two thirds cover at three bushes to two blooms, applied to every tile touching sand on a road
   * that runs the width of the map, plants a near-continuous double row of opaque dark discs down
   * both sides of it. In the spawn camera that came out as eleven columns of bush flanking the
   * track, which is a hedge either side of a lane -- and because the lone-bush sweep then closes the
   * gaps in it, it is a hedge with no gaps. The review's "six objects in a straight horizontal line
   * at even spacing" and "chains of alternating bush-and-flower following the road" are both this
   * pass, and lowering it is most of what answers them.
   *
   * The pale band it was planted to cover is answered properly now, by the verge sweep at the foot
   * of the file letting the wood come down to the sand on two-lane stretches: cover from a treeline
   * rather than from a kerb of shrubs. So this goes back to about half cover, and the mix swings to
   * BLOOM -- a bloom share of 0.72, roughly two blooms to one bush -- which is what the board's verges
   * are: lawn with beds of flower set along the edges of the sand, not a shrub border. With the mix
   * read off a field rather than a die (see `tuft`) those beds arrive gathered, two or three
   * together, instead of alternating tile by tile.
   */
  /*
   * ===========================================================================
   * ...AND IT COMES IN DRIFTS NOW, because a field with a two-tile period cannot.
   * ===========================================================================
   *
   * THE PERIOD WAS THE BUG, not the share. `verge(x / 1.9, y / 1.9)` cut at a half plants about
   * every other tile that touches sand, and the road touches sand along fifty columns, so what this
   * drew was a dotted line of opaque discs running parallel to the track from one edge of the map to
   * the other -- on BOTH sides. Rendered at 2x on the portrait frame it is unmistakable: five
   * flowering bushes in a dead straight row at an even one-tile pitch along the road's north edge,
   * and another three above them. The review's "chains of alternating bush-and-flower following the
   * road" and the client's "the flowers arrive in neat rows" are the same artefact and this is it.
   * Halving the share would have given a sparser dotted line, which is the same drawing.
   *
   * A five-tile period cut well above its middle gives the same ground cover as four or five tiles
   * TOGETHER with eight or ten bare between them -- a bank at the roadside, then open verge, then
   * another bank. That is what the board's path edges carry, and it is the only arrangement that
   * does not trace the road.
   *
   * The bloom share comes down with it. Two blooms to one bush was tuned when this pass was the only
   * cover the roadside had; the road's own treeline now brings wood to the sand on three quarters of
   * its length, so this is dressing at the foot of that rather than a substitute for it, and leaf
   * is what dressing at the foot of a wood is made of.
   */
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (!onGrass(x, y) || !besideSand(x, y)) continue;
      if (verge(x / 5.2 + 11, y / 5.2 + 11) < 0.62) continue;
      tuft(x, y);
    }

  /*
   * ...AND NOTHING OPAQUE STANDS WHERE THE WATERLINE HAS NOWHERE ELSE TO BE DRAWN.
   *
   * Teaching the bank pass its other two neighbours puts the right tile on the ground and does not
   * finish the job, because every decor tile in this set paints its own full 32x32 of ground --
   * that is why half this file is about fields rather than coin flips. A bush or a boulder dropped
   * on a bank tile does not stand beside the waterline, it ERASES it. Measured straight after that
   * change, 10 of the 18 new `shore-n` and `shore-s` tiles came out under a bush or a rock, which
   * put eight of the eighteen mid-air river ends back exactly as they were: an opaque green square
   * meeting deep water across a hard tile edge, which is the finding, not the gid under it.
   *
   * WHICH TILES, and the rule is the same sentence in both halves: a tile whose shoreline nothing
   * else can carry.
   *   - A STEP (`shore-n` or `shore-s`) is one tile long by construction -- it is the tile where
   *     the bank column jogs sideways -- so covering it covers the whole shoreline there.
   *   - A CORNER (water on two or more sides) carries the only waterline its second wet edge will
   *     ever get, because the tileset has four side tiles and no inside corner.
   *   - A tile in the middle of a long `shore-w` or `shore-e` COLUMN is left alone. The drawn
   *     waterline runs above and below it, so the river still reads as a river and the boulder
   *     reads as standing in it -- the gorge the board draws, which nobody has complained about.
   *     (Until 2026-10-22, when the client did: the dredge pass now lifts that cover too, below
   *     the border band. See `onBank` there.)
   *
   * Trunks stay. A trunk tile is opaque over barely half its area, so the waterline still shows
   * under a tree standing on the bank, and the tree is solid either way.
   */
  /*
   * `bush-low` and `bush-tall` are in here with `bush` although they show lawn at one edge. The
   * rule this list serves is "a tile whose shoreline nothing else can carry", and a step or a
   * corner is one tile long: a shrub that leaves lawn above it still erases the waterline drawn
   * along the bottom of the same tile. Guessing per silhouette which edge survives is the kind of
   * cleverness that puts a hard seam between deep water and lit grass back on the map.
   */
  const OPAQUE_FLOOR = new Set([
    'bush',
    'bush-low',
    'bush-tall',
    'rock',
    'flower-white',
    'flower-pink',
    'flower-red',
    'toadstool-ring',
  ]);
  /** A bank tile that is the only shoreline its water will get: a step, or a corner. */
  const soleShoreline = (x: number, y: number): boolean => {
    const bank = nameAt(ground, x, y);
    if (!bank.startsWith('shore')) return false;
    if (bank === 'shore-n' || bank === 'shore-s') return true;
    // A cove's water is one corner and nothing else carries it. (Coves are laid only by the
    // corner pass at the bottom of the file, so this line changes nothing for the uncover pass
    // that also calls this; it is for audit 1, which reads the finished map.)
    if (bank.startsWith('shore-cove')) return true;
    return NEIGHBOURS.filter(([dx, dy]) => isWater(x + dx, y + dy)).length > 1;
  };
  let uncovered = 0;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      // ...except on the border, where the seal wins. The edge of the world is two rows of solid
      // scrub so the player cannot see the end of it, and `sealBorder` runs last and would put the
      // bush straight back anyway. A shoreline she can see and cannot walk onto is worse than one
      // under a bush: it is an invisible wall at the top of the frame.
      if (onBorder(x, y) || !soleShoreline(x, y)) continue;
      const standing = nameAt(below, x, y);
      if (!OPAQUE_FLOOR.has(standing)) continue;
      set(below, x, y, 0);
      // Whatever it was is gone, and its collision goes with it -- `clump` and the stone drifts
      // both plant solid, and a solid tile with nothing drawn on it is the invisible wall this
      // file keeps warning about.
      clear(x, y);
      uncovered++;
    }
  console.log(`  banks: ${uncovered} shoreline tile(s) cleared of opaque cover`);

  // --- NPC positions, each on walkable ground beside its landmark ---------------
  const npc = (name: string, x: number, y: number) => {
    clearArea(x, y, 1, 1);
    return {
      name,
      x: x * TILE,
      y: y * TILE,
      width: TILE,
      height: TILE,
    };
  };

  /*
   * Bystanders stand one tile off the track rather than on it, so they decorate the walk instead
   * of interrupting it. The assertion is the point: a bystander carved out of the middle of a
   * tree cluster is unreachable and would simply never be met, which is a bug nobody would see.
   */
  const bystander = (name: string, x: number, y: number) => {
    // `NEIGHBOURS` rather than a fifth copy of the same four vectors. It is typed as readonly
    // tuples, so the non-null assertions this line used to carry on `dx` and `dy` are gone with it.
    const touchesTrack = NEIGHBOURS.some(([dx, dy]) => isPath(x + dx, y + dy));
    if (!touchesTrack) throw new Error(`${name} at ${x},${y} does not touch the track`);
    /*
     * ...AND A BITE OUT OF THE CARRIAGEWAY IS NOT A VERGE.
     *
     * `besideTrack` answers "the row below the last path row", which is a verge wherever the track
     * is a solid band. It is not a verge where the track-edge pass has BITTEN a tile out of the
     * sand: the snail stood at (41,20) with path at (40,20) and (42,20) and path again directly
     * above him, which is a grass tile in the middle of the road rather than the shoulder of it.
     * It read as a verge to every check there was, and it is the one row a player who only ever
     * holds Right walks, so the moment the cast was given collision he became a wall across the
     * gate approach -- which audit 2a then failed the build on, correctly, pointing at the symptom.
     *
     * Path on BOTH sides is the test, because that is what "the road runs through here" means. It
     * is asked of every bystander rather than of the one that was wrong: the three forest columns
     * are data and the next owner may move them.
     */
    if (isPath(x - 1, y) && isPath(x + 1, y))
      throw new Error(
        `${name} at ${x},${y} stands in the carriageway, not on the verge: the track runs through ` +
          'that cell (path either side of it), so giving him collision walls the road',
      );
    clearArea(x, y, 1, 1);
    return { name, x: x * TILE, y: y * TILE, width: TILE, height: TILE };
  };

  /**
   * A member of the cast seated OFF the track, in open ground. `bystander`'s opposite: it refuses a
   * cell on the sand or touching it, and a cell that already holds anything -- a trunk, a bush, a
   * stone -- because clearing one away to seat somebody is how a character ends up carved out of the
   * middle of a tree. Reachability is not asserted here; the audit's flood and `map.test.ts` both
   * walk to every member of the cast on the finished map, which is the only map that counts.
   */
  const inTheClearing = (name: string, x: number, y: number) => {
    if (isPath(x, y) || NEIGHBOURS.some(([dx, dy]) => isPath(x + dx, y + dy)))
      throw new Error(`${name} at ${x},${y} is on the track or beside it, not in the clearing`);
    if (isWater(x, y) || at(below, x, y) !== 0 || at(collision, x, y) !== 0)
      throw new Error(`${name} at ${x},${y} is not open ground: something already stands there`);
    clearArea(x, y, 1, 1);
    return { name, x: x * TILE, y: y * TILE, width: TILE, height: TILE };
  };

  /**
   * The row just south of the track at this column.
   *
   * The three forest bystanders used to carry hard-coded rows, which was fine while the track
   * held one row for the width of the map. Now that it wanders, a constant and a bend disagree
   * silently and the assertion above turns a decorative character into a crash. Reading the row
   * off the track means the two can never drift apart, whatever the waypoints do later.
   */
  const besideTrack = (x: number): number => {
    let last = -1;
    for (let y = 0; y < MAP_H; y++) if (isPath(x, y)) last = y;
    if (last < 0) throw new Error(`no track at column ${x} to stand a bystander beside`);
    return last + 1;
  };
  /*
   * (`aboveTrack`, `besideTrack`'s mirror, stood here. Its one caller was the Cat on the north verge,
   * and she left the track for the clearing on 2026-10-22; an unused helper is lint's to refuse.)
   */

  // --- Purple's pad and the spawn clearing ----------------------------------------------------------
  const spawnX = SPAWN.x;
  const spawnY = SPAWN.y;
  /*
   * Purple's pad, and it is TRACK rather than two tiles painted to look like it.
   *
   * It used to be two `set(ground, ..., 'path')` calls and nothing else, so for the whole of the
   * rest of this file the two tiles she is standing on were not a path: they got no rim, which is
   * why the hero shot carried a hard-edged rectangle of sand at Purple's feet with a ruled vertical
   * side, against a carriageway whose every other tile is torn. The garden lane had exactly this
   * bug and the note above `lane` records the three silent consequences of it.
   */
  clearArea(spawnX, spawnY, 2, 2);
  for (const y of [spawnY, spawnY + 1])
    for (const x of [spawnX, spawnX + 1]) {
      set(ground, x, y, gid('path'));
      pathTiles.add(y * MAP_W + x);
    }
  for (let y = spawnY - 1; y <= spawnY + 2; y++)
    for (let x = spawnX - 1; x <= spawnX + 2; x++) if (isPath(x, y)) pathEdge(x, y);

  const objects = [
    { name: 'spawn-purple', x: spawnX * TILE, y: spawnY * TILE, width: TILE, height: TILE },
    npc('npc-rabbit', 13, 19),
    /*
     * OVER THE RIVER, 2026-10-25 (docs/GATEKEEPER.md). He sat at (18,12), directly below the trunk
     * of the tree planted for him at the end of the north footpath; that tile is the DEAD END sign's
     * now. (35,19) keeps the arrangement that made him read as an owl -- he stands on the tile
     * directly below a trunk, the row of trees at (33..37,18) behind his head and their crowns over
     * it -- in the meadow north of the road between the bridge and the climb to the cottage. Off the
     * road (it runs on row 22 below him) and off rows 20 and 21, the due-east walker's line; his
     * talking ring (34-36 x 18-20) touches neither the Cat's (38-40 x 15-17) nor the Snail's
     * (37-39 x 22-24).
     */
    npc('npc-owl', 35, 19),
    npc('npc-lantern-keeper', 37, 33),
    /*
     * FIVE TILES EAST, ON THE SAME SOUTH VERGE -- moved for v2 Phase C (2026-10-22).
     *
     * He stood at (10, besideTrack(10)) = (10,22), five tiles from Purple's pad, which made him the
     * first face in the forest. v2 meets the cast in CONTENT order (content/game.v2.json: rabbit,
     * toadstool, owl, magpie, snail, lantern keeper, cat), and GAME_DESIGN_V2 section 10 records why
     * that order is not cosmetic: the first and the last offer are a rote clause, and with the
     * Toadstool met first "take the first offer" scored 850 clean. The Rabbit has to be met first,
     * and she cannot move -- composition guard 7k holds her inside her own stall's columns -- so he
     * does: past her stall, at column 15, still on the track's south verge.
     *
     * THE FIRST MOVE WENT TO (14,13), on the Owl's row-12 lane, and was reverted the same day. It
     * kept the v2 order but took him out of the opening shot and off the straight walk from the pad:
     * `e2e/scene-second-pass.spec.ts` found only Purple and the Rabbit left in shot to measure
     * shadows on, and `e2e/bystanders.spec.ts`'s walk to him stuck in the planting. Column 15 keeps
     * both, because the live game is still v1 and he is its bystander there.
     *
     * Measured on the regenerated map, four-connected walk from `spawn-purple` to talking range:
     * rabbit 7, toadstool 10, owl 19, magpie 25, snail 34, lantern keeper 44, cat 46 -- each further
     * than the one before, and the cat close enough to the door that the tour's last leg is zero
     * tiles. That order is NOT asserted anywhere; what is asserted is the content-order tour's
     * total (108 tiles at this placement, 104 before the move) against the clock's maximum in
     * `packages/core/test/v2/real-content.test.ts`.
     *
     * (2026-10-22, after the Cat moved to (39,19): the tour is 107 tiles -- rabbit 7, toadstool 3,
     * owl 19, magpie 34, snail 9, lantern keeper 10, cat 13, door 12 -- against a measured edge of
     * 125. That ZERO-tile last leg above was the defect, not a nicety: it meant the Cat's talking
     * ring already stood in `trigger-cottage`, which ends the run. See the note on her placement.)
     *
     * (2026-10-22 again, after the Cat moved up into the clearing at (39,16): 113 tiles -- rabbit 7,
     * toadstool 3, owl 19, magpie 34, snail 9, lantern keeper 10, cat 16, door 15. The six tiles are
     * the walk up the lane to her and back down to the sand; they moved the derived par past the
     * content's `scoring.parMs` of 106000, to 106,749 ms, which the core par test reports.)
     *
     * The other three bystanders keep the stretch of the walk they were placed for: the far side
     * of the bridge, the gate approach, and the doorstep.
     */
    /*
     * THE GATEKEEPER, 2026-10-25 (docs/GATEKEEPER.md): the Toadstool, who stood here at
     * (15, besideTrack(15)) = (15,22), is the keeper of the bridge gate now, so he stands at the
     * bridge's west end, by the gate: on the north verge of the approach, the tile diagonally off the
     * gate's top cell, read off the deck rather than written in figures. North rather than south
     * because the south side of the approach is the river's bank stones. `bystander`'s checks are
     * the ones he needs -- touching the road, not standing in it -- whatever his name's prefix.
     */
    bystander('npc-gatekeeper', gateX - 1, bridgeRows[0]! - 1),
    /*
     * ON THE WEST BANK, SOUTH OF THE BRIDGE, 2026-10-25 (docs/GATEKEEPER.md): at `MAGPIE_SPOT`, the
     * end of her lane from the first fork. A DEFAULT until the client's picture of her spot arrives;
     * the constant is the one edit. She stood east of the deck at (30, besideTrack(30)).
     */
    bystander('bystander-magpie', MAGPIE_SPOT.x, MAGPIE_SPOT.y),
    /*
     * COLUMN 39, NOT 41, AND THE TWO COLUMNS MATTER.
     *
     * At 41 the track is one row tall -- the edge pass has bitten (41,20) out of the sand -- so
     * `besideTrack` offered row 20, which is the carriageway with a tile of grass showing through
     * it, not the verge. He sat in the middle of the road: path at (40,20), path at (42,20) and
     * path directly above him, and row 20 is the one row a player who only ever holds Right walks
     * from the spawn to the door. Harmless while he had no collision and a wall across the gate
     * approach the moment he got some. The assertion in `bystander` above now refuses that cell
     * outright, so this is two columns west, where the track is its full two rows (20 and 21) and
     * row 22 is a genuine shoulder. Still the gate-approach stretch, still clear of the notice.
     */
    bystander('bystander-snail', 38, besideTrack(38)),
    /*
     * Inside the garden, north of the path, between the gate and the door. She is the only
     * bystander past the notice post, so by the time she speaks every decision has been made and
     * the forest notice has already done whatever it was going to do.
     */
    /*
     * ===========================================================================
     * OFF THE TRACK AND UP INTO THE CLEARING: (39,16). Moved 2026-10-22, second time that day, on
     * the client's word, and the (39,19) block below it is now HISTORY too.
     * ===========================================================================
     *
     * The client, on a screenshot of Purple at the cottage approach (they call her "the fox"):
     * "I'd take him off the path and put him there in between the trees there and that opening."
     * The opening is the lane of lawn above the climb past the snail, columns 38 to 40, between the
     * wood on the west and the elder whose trunk stands at (40-42,16) -- three rows up from where she
     * sat on the verge. (39,16) is its middle: the elder's roots on her east, the bank of white
     * flowers at (38,16)-(38,18) on her west, open lawn north and south. "A cat sits AGAINST
     * something" (the history below) holds better here than it ever did on the verge.
     *
     * WHAT STILL HOLDS, each asserted somewhere rather than argued here:
     *  - she is still the LAST face before the door: the player comes back up from the Lantern
     *    Keeper's fork, passes the snail at (38,23), turns up the lane at column 39, meets her, and
     *    walks back down to the notice (x 42) and the gate (x 46). The core clock test derives that
     *    tour from this map and holds it under the measured edge;
     *  - she is reachable, and from below: (39,17), (39,18) and (39,19) are open lawn down to the
     *    sand at (40,19), and `map.test.ts` asserts a cell beside her she can be spoken to from;
     *  - she is nowhere near the door: about nine tiles of talking distance from `trigger-cottage`
     *    against the five `cast-clear-of-door.test.ts` demands;
     *  - her talking ring (38-40 x 15-17) touches neither the snail's (37-39 x 22-24) nor
     *    `notice-forest-post` (42-45 x 20-22), so speaking to her opens nobody else's card;
     *  - she is not on rows 20 or 21, the due-east walker's line.
     *
     * `bystander` would refuse this cell -- it requires the track as a neighbour, which is the whole
     * of what the client asked to change -- so `inTheClearing` seats her instead, and asserts the
     * two things that matter off the track: that she is not standing on or beside it, and that the
     * cell is open ground rather than a tree she would be carved out of.
     */
    inTheClearing('bystander-cat', 39, 16),
    /*
     * ===========================================================================
     * HISTORY (until the second move, 2026-10-22): OFF THE DOORSTEP, ONTO THE MAIN TRACK: (39,19),
     * the north verge of the climb past the snail.
     * ===========================================================================
     *
     * The client, verbatim: "You can't reach the cat because the cat is after the door." She stood
     * at (52,19), the tile directly EAST of `trigger-cottage` (50-51 x 19-21), so every cell she
     * could be spoken to from touched the trigger or sat a tile off it. The walk to her went through
     * the door lane, `trigger-cottage` is a point test on Purple's feet, and the run ended on the way:
     * Latch Lifter came out "You walked past" on runs where the player had walked straight at her.
     * Every guard passed, because every guard asked whether she was REACHABLE -- and she was, by a
     * flood that is allowed to walk through the trigger. Nothing asked whether reaching her ENDS THE
     * RUN. `tools/graybox/test/cast-clear-of-door.test.ts` asks that now, over the committed map.
     *
     * Why this cell, of the stretch between the south-fork junction and the forest notice:
     *  - She is still the LAST face before the door on the eastward walk: the player comes back up
     *    from the Lantern Keeper's fork, passes the snail at (38,23), meets her, and only then
     *    reaches the notice (x 42) and the gate (x 46). Her talking ring (38-40 x 18-20) touches
     *    neither the snail's (37-39 x 22-24) nor `notice-forest-post` (42-45 x 20-22), so speaking
     *    to her opens nobody else's card and fires no notice.
     *  - Row 19, not 20 or 21. Those two are the due-east walker's line, and `apps/game/test/
     *    map.test.ts` fails on any solid cell along them; (40,21) -- the inside of the bend -- was
     *    the other candidate and is ruled out by that alone. (41,20) is carriageway (path at 40 and
     *    42) and `bystander` refuses it. (40,19)-(42,19) are the lane's own sand.
     *  - "A cat sits AGAINST something" (the note below) still holds as well as this stretch allows:
     *    the sapling pair at (40-41,18) stands on her north-east corner and the white flowers at
     *    (38,18) on her north-west, with the road wrapping her on the east and the south.
     *  - Her nearest talking position is about nine tiles from the trigger; the guard demands five.
     *
     * `aboveTrack(39)` rather than 19 in figures, so a later bend in the track moves her with it
     * instead of planting her in the sand. Core's `WALK_WORLD` (packages/core/src/v2/floor.ts) caches
     * her talking spot and `test/v2/floor.test.ts` fails until it is re-derived, which is the point.
     *
     * (That placement was `bystander('bystander-cat', 39, aboveTrack(39))`.)
     */
    /*
     * HISTORY (until 2026-10-22): ON THE DOORSTEP ROW, TOUCHING THE WALL, east of the door.
     *
     * She stood at (47,19) and then at (49,19), and both are lawn: (47,19) is the middle of
     * Grandma's front garden and (49,19) is a tile off the west corner of the house with the lane on
     * one side and grass on the other three. The product manager has now called a tabby standing
     * alone on that lawn "nobody's intention" twice, which is twice more than a placement fault
     * should need. A cat sits AGAINST something.
     *
     * The east end of the frontage, with the wall directly above her, the flower bank the dressing
     * puts along the front of the house either side, and the doorstep's own sand one tile west --
     * which is what `bystander` requires, since she has to touch the track to be met. It is clear of
     * the note on the door, which covers the two columns at the other end of the wall, so neither
     * trigger can fire from the tile the other one is standing on.
     *
     * SHE MOVED WITH THE HOUSE. She stood at column 54, which was under the east window of a facade
     * six columns wide starting at 50; the facade is five columns starting at 48 and 54 is open lawn
     * two tiles clear of the building -- the exact placement fault ("a tabby standing alone on that
     * lawn") this note was written to close, reopened by a column count. `cx + FACADE_W - 1` is the
     * east corner post whatever the facade does next.
     *
     * (That placement was `bystander('bystander-cat', cx + FACADE_W - 1, doorstep + 1)` = (52,19),
     * and it is the one the client could not reach without walking into the run's ending. Do not
     * put her back against the house: anywhere on the doorstep row is inside the door lane.)
     */
    /*
     * The walk ends on the DOORSTEP, not at the garden gate.
     *
     * It used to end at the gate (x 46), which is the only gap in the fence. That put the end of
     * the run in front of the door note, so a player who did the natural thing -- meet all three
     * travellers, then walk east -- had the run taken off them at the gate and could never reach
     * the note. The `sign` errand goal was advertised in the HUD on every run and, in that order,
     * could not be earned. It was reachable only by slipping through the gate with a verdict still
     * outstanding, reading the note, and walking back, which nobody does.
     *
     * It spans all three rows of the door lane, not just the doorstep. `overlaps` is a point test
     * on Purple's feet, and a player who only ever holds Right keeps her feet on row 21 for the whole
     * map. A trigger on row 19 alone is invisible to that player: she walks straight past the door,
     * out across the lawn, and the run never ends. That is worse than the bug this move fixed.
     */
    {
      name: 'trigger-cottage',
      x: (cx + 2) * TILE,
      y: 19 * TILE,
      width: TILE * 2,
      height: TILE * 3,
    },
    /*
     * The gap in the garden fence. Nothing in the game reads it; the map tests do, to assert that
     * the forest notice spans the only way in. That invariant used to be checked against
     * `trigger-cottage`, which happened to sit on the gap until the trigger moved to the door.
     * Naming the gap directly means the test says what it means.
     */
    { name: 'gate-fence-gap', x: fenceX * TILE, y: 20 * TILE, width: TILE, height: TILE * 2 },
    {
      // Spans the whole gate approach (x 42 to 45, both path rows). The gate at x 46 is only
      // reachable along these two rows, so the notice cannot be walked around: the zero-click
      // beat is the point of the level and must not be optional.
      name: 'notice-forest-post',
      x: 42 * TILE,
      y: 20 * TILE,
      width: TILE * 4,
      /*
       * THREE ROWS, AND THE THIRD IS THE ONE THAT MAKES IT A BARRIER.
       *
       * Two rows spanned the gate approach tile for tile and the zero-click beat was still
       * optional, because `overlaps` is a point test on Purple's POSITION and her position is the
       * bottom edge of her foot box. Standing in the lowest row of the approach she presents a y
       * of exactly 704 -- the rect's own bottom edge, which `overlaps` reads as the row below --
       * and 704 is on the 2px-per-frame grid she walks on from the spawn. Hold Down, then hold
       * Right, and she goes through the gate with the notice never opening.
       *
       * A tile-level flood cannot see this and said the gate was sealed for as long as the fault
       * existed. Audit 4 now floods over POSITIONS. The third row is walkable the whole width of
       * the approach, so nothing about where she may stand changes; what changes is that the rect
       * reaches past the last y she can present in the rows that matter.
       */
      height: TILE * 3,
    },
    {
      /*
       * The note on Grandma's door, which the `sign` errand goal needs. It sits in the lane
       * immediately WEST of the doorstep and matches the trigger row for row, so every approach
       * from the garden crosses the note first and the trigger second, whichever row Purple walks.
       * Putting it east of the gate but west of the door is what makes the ordering hold without
       * the two rects ever sharing a tile, which would race inside one frame.
       *
       * This belongs HERE, in the generator, and not in the generated map-forest.json: a previous
       * pass added it by hand to the JSON and every later `pnpm graybox` silently wiped it, which
       * left the goal advertised in the HUD and impossible to complete.
       *
       * ===========================================================================
       * ...AND "EVERY APPROACH CROSSES THE NOTE" WAS A CLAIM, NOT AN INVARIANT. ONE ROW SOUTH.
       * ===========================================================================
       *
       * Matching the trigger row for row is what the comment above describes and it is not what
       * it claims. Measured on the committed map: the trigger is 50-51 x 19-21 and has EIGHT
       * walkable entry tiles -- (49,19) (49,20) (49,21) from the west, (52,19) (52,20) (52,21)
       * from the east, and (50,22) (51,22) from the south. Only the three western ones are inside
       * the note. Row 22 is walkable from x47 clear through to x56, so a player who drops one row
       * below the lane walks under the note, comes up the east side of the door and ends the run
       * without the `sign` errand ever firing: 900 against 1,000 on identical verdicts, and on a
       * line where that hundred is the margin the ending itself flips.
       *
       * ...AND "ONE ROW SOUTH" WAS THE FIRST ANSWER AND IT WAS WRONG, which is worth more than
       * the fix. A tile-level flood with the four-row rect as a wall says the trigger is sealed.
       * Driven in the running game it is not: `overlaps` is a point test on Purple's POSITION, her
       * position is the BOTTOM EDGE of her foot box, so standing in the lowest row of the lane she
       * presents a y of exactly the rect's bottom edge -- which the half-open test reads as the
       * row below -- and the rows below that are open garden. Measured by walking her: from (47,22)
       * holding Right she goes clean under the note AND under the trigger to x58, `read` empty.
       *
       * So the bound is the last y she can PRESENT anywhere in these two columns, not the last row
       * she can stand in, and audit 4a floods over positions to prove it. Five rows: at the fifth
       * the only cells left below her are at x48, and x48 alone is a dead end -- column 50 stops
       * at y 736, so there is nothing to walk east onto. Every tile of the rect is still walkable,
       * and a note pinned at (50,18) is still the thing she is reading from the top of it.
       */
      name: 'notice-cottage-door',
      x: cx * TILE,
      y: 19 * TILE,
      width: TILE * 2,
      height: TILE * 5,
    },
    { name: 'prop-signpost', ...landmarks['signpost']!, width: TILE, height: TILE },
    { name: 'prop-well', ...landmarks['well']!, width: TILE, height: TILE },
    { name: 'prop-fountain', ...landmarks['fountain']!, width: TILE, height: TILE },
    { name: 'prop-lantern-post', ...landmarks['lantern-post']!, width: TILE, height: TILE },
    /*
     * THE BUILDING'S OWN RECTANGLE, DERIVED. It said `TILE * 6 x TILE * 4` in figures, and those
     * figures are what the game frames the payoff shot on -- `doorFocus()` in forest-scene.ts reads
     * this object's width and height and nothing else. So a narrowed facade with a quoted rectangle
     * here would move the building and leave the camera pointing at where it used to be, which is
     * the same class of fault as the camera that was remembered rather than asked for.
     */
    {
      name: 'prop-cottage',
      ...landmarks['cottage']!,
      width: TILE * FACADE_W,
      height: TILE * FACADE_H,
    },
    { name: 'prop-stall', ...landmarks['stall']!, width: TILE * 4, height: TILE },
    /*
     * THE FORKS, for the Way Teller's signs: one tile each, on the carriageway cell the footpath
     * leaves from (see `forkAt`), numbered west to east. APPENDED, so every object above keeps the
     * id it had. They are NOT props -- a `prop-*` must be solid, and this cell is the road -- so
     * the audit holds them to the other rule: every tile of a non-prop, non-cast object walkable.
     * Where the game stands the sign is its business; the crook of each fork is the tile beside
     * this one on the side away from both runs of sand.
     */
    ...footpaths
      .map(forkAt)
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((f, i) => ({
        name: `fork-${i + 1}`,
        x: f.x * TILE,
        y: f.y * TILE,
        width: TILE,
        height: TILE,
      })),
    // Grandma's mailbox. APPENDED, like the forks, so every object above keeps its id. A `prop-*`,
    // so audit 5 holds it solid and guard 7k holds it whole in every composed frame it is in.
    { name: 'prop-mailbox', ...landmarks['mailbox']!, width: TILE, height: TILE },
    /*
     * THE THREE CYERA SIGNS (the client, 2026-10-23). APPENDED, like the forks and the mailbox, so
     * every object above keeps its id. `sign-<key>`: the game reads `<key>` and looks its caption up
     * in content's `ui.world.signs`, so the map names a sign and content says what it says. Audit 5
     * holds a `sign-*` solid over every tile, as it holds a `prop-*`; guard 7k holds it whole.
     *
     * The research sign is the forest notice's own two tiles; its zero-click rect is still
     * `notice-forest-post`, on the road below, and this object is only the thing that is drawn.
     *
     * `sign-logo` carries the blank face the DOM lays the logo over, as Tiled properties in art
     * pixels from the object's top-left -- read from `LOGO_FACE` in s-props.ts, the painter that drew
     * it, so the face is written once and the game cannot be pointed at a rectangle nobody painted.
     */
    { name: 'sign-research', ...landmarks['notice-post']!, width: TILE * 2, height: TILE },
    { name: 'sign-dead-end', ...landmarks['sign-dead-end']!, width: TILE, height: TILE },
    {
      name: 'sign-logo',
      ...landmarks['sign-logo']!,
      width: TILE * 2,
      height: TILE,
      properties: [
        { name: 'faceX', type: 'int', value: LOGO_FACE.x },
        { name: 'faceY', type: 'int', value: LOGO_FACE.y },
        { name: 'faceW', type: 'int', value: LOGO_FACE.w },
        { name: 'faceH', type: 'int', value: LOGO_FACE.h },
      ],
    },
    /*
     * THE RIVER'S TWO WAYS OVER (2026-10-25, docs/GATEKEEPER.md). APPENDED, like the signs, so every
     * object above keeps its id.
     *
     * `gate-bridge` is the DRAWBRIDGE'S SPAN (the client's revision, 2026-10-25): every cell that
     * is deck when it is down, end post to end post, every deck row. The game reads it to block
     * those cells while it is raised and, when the Gatekeeper's key is taken, to swap each cell's
     * `decor-below` tile from `bridge-gate-shut-<n>` to `bridge-gate-open-<n>`. Audit 3 holds every
     * tile of it walkable, as it holds every non-prop object, which is what the contract asks.
     *
     * `wing-landing` is a POINT, at the centre of the `WING_LANDING` cell: where the Magpie's flight
     * sets Purple down, on the east bank's path up to the road.
     */
    {
      name: 'gate-bridge',
      x: gateX * TILE,
      y: bridgeRows[0]! * TILE,
      width: TILE * (spanX1 - gateX + 1),
      height: TILE * bridgeRows.length,
    },
    {
      name: 'wing-landing',
      x: WING_LANDING.x * TILE + TILE / 2,
      y: WING_LANDING.y * TILE + TILE / 2,
      width: 0,
      height: 0,
      point: true,
    },
  ].map((o, i) => ({ id: i + 1, rotation: 0, visible: true, ...o }));

  // The gate tiles must stay walkable even after the fence loop.
  for (const y of [20, 21]) clear(fenceX, y);

  // --- framing: canopy across the top of the three cameras ---------------------------------------
  /*
   * ===========================================================================
   * CANOPY ACROSS THE TOP OF THE CAMERA, which is the half of "creepy" still standing.
   * ===========================================================================
   *
   * MEASURED ON THE FRAME RATHER THAN ON THE MAP, which is the only reason this exists. The game's
   * camera shows 19.41 x 11.22 tiles at 1280x800 -- NOT the "about 26 x 15" this file claimed in
   * four places, which came from the abandoned 1.5x zoom option and sent three rounds of
   * composition at a rectangle a third too big. Ask `cameraFor()` in @otp/core, never a comment.
   * Counted over the top two rows -- the rows a crown has to occupy to be CUT OFF by the edge of
   * the screen -- and over the columns a landscape visitor can actually see past the title card,
   * which `visibleTitleColumns()` returns. The other sixteen were open lawn running off the top
   * of the hero shot of a marketing asset. `docs/DESIGN_BOARD.md` section 2 cause 2 is exactly
   * this: "a bright field evenly dotted with dark holes reads as watched", and every frame on the
   * board has canopy cut off by its top AND bottom edges, which is what says the wood carries on
   * past the camera instead of ending at it.
   *
   * WHY THE WOOD REGISTER COULD NOT DO IT. Six woods in that register name closing the top of the
   * spawn camera as their job and none of them delivers one tile of it, because the fountain glade
   * sits at (19, 12.5) with a radius of 3.6 and `woodAt` subtracts a glade at FULL strength over
   * its own core. The glade is right -- the fountain and the owl need a clearing -- and it straddles
   * the camera's top edge, so what the player sees is the bottom half of a clearing, which is a
   * lawn running off the top of the screen. Moving the glade moves the owl, the fountain and the
   * end of the footpath, all of which `map.test.ts` has an opinion about.
   *
   * So the framing is stated, like the woods are, and planted directly: `plantKind` does not read
   * `woodAt`, so a stand laid here stands whatever the density field thinks. It plants in CLUMPS of
   * two or three at mixed scales and jittered rows with irregular gaps between them, which is the
   * same thing section 3's third complaint asks for -- a grove rather than a file -- and it is also
   * what keeps the lone-tree sweep below from culling a framing tree for standing by itself in a
   * glade.
   *
   * A crown may not be hung over anything solid that is not a trunk. `plantKind` guards the ground
   * it stands on and the canopy it overlaps; it has no opinion about a fountain, because until now
   * nothing ever planted into a glade. Hiding the one object a clearing was cut for would be a
   * clear loss for a frame measured in canopy.
   */
  /*
   * ...AND THE BANDS ARE THE RECTANGLES THEMSELVES, not numbers that once described them.
   *
   * The title band ran to column 25 and the camera stops at 19.41, so a quarter of everything this
   * pass planted was off the right of the screen; and its trunk row was typed out rather than taken
   * from the frame. Both ends of every band now come off `HERO`, `ARRIVE` and `PORTRAIT`, and the
   * trunk row is simply "two above the first row the camera shows", which is where a mid tree has
   * to stand for its crown to be the thing the top edge cuts.
   *
   * The title band keeps column 0 as its western end even though the copy column hides the first
   * five columns in landscape, because in PORTRAIT the card docks below the world and every one of
   * them is in shot.
   */
  /*
   * The trunk row whose 2x2 crown lands on the two rows the frame's top edge is MEASURED over.
   *
   * It used to be `rowsOf(r)[0]! + 2`, which floors, while the audit measures `topEdgeRows`, which
   * ceils -- so the planter and the checker were one row apart and the pass planted into a row the
   * guard never looked at. Both now come off the same function, so they cannot drift: whatever
   * `topEdgeRows` calls the top edge is where the crowns go.
   */
  const crownRow = (r: Rect): number => topEdgeRows(r.y0)[0]! + 2;
  const FRAMINGS: ReadonlyArray<{ x0: number; x1: number; row: number; why: string }> = [
    {
      x0: 0,
      x1: Math.ceil(PORTRAIT.x1) - 1,
      row: crownRow(PORTRAIT),
      why: 'the 375 portrait camera, which nobody had ever composed',
    },
    {
      x0: 0,
      x1: Math.ceil(HERO.x1) - 1,
      row: crownRow(HERO),
      why: 'the title and spawn camera',
    },
    /*
     * It stops at the garden's west fence, and the audit is why. The first version ran to x 59 and
     * the build failed on "16 tile(s) of unbroken hedge along column 59". Traced: the strip between
     * the enclosure's east fence and the edge of the world is two columns wide and a dead end, so a
     * tree planted in it seals it, the connectivity sweep fells the tree to open it again, and
     * `sealBorder` fills the cell it vacated with scrub -- which is the eighteen-tile hedge behind
     * Grandma's garden that `docs/DESIGN_BOARD.md` names by name, rebuilt by a pass meant to close
     * a frame. East of x 45 the arrival camera's top edge is the fence, the cottage roof and the
     * margin wood, which are the frame's own subject and already close it.
     */
    {
      x0: Math.floor(ARRIVE.x0),
      x1: fenceX - 1,
      row: crownRow(ARRIVE),
      why: 'the arrival camera',
    },
  ];
  /** Would this tree hang a crown over something drawn and solid that is not another tree? */
  const overSomething = (kind: string, x: number, y: number): boolean =>
    KINDS[kind]!.crown.some(
      ([dx, dy]) => at(collision, x + dx, y + dy) !== 0 && !isTrunk(x + dx, y + dy),
    );
  /*
   * SOFT COVER ON THE TRUNK ROW IS LIFTED, and it is put back if the tree still will not stand.
   *
   * `plantKind` refuses any trunk cell whose `below` is occupied, which is right for a boulder, a
   * fence or another trunk and wrong for a flower. Measured on the generated map, four columns of
   * the title camera's top edge were open because the second cell of the pair carried a tuft of
   * soft scrub -- dressing that the forest floor scattered and that the lone-bush sweep at the foot
   * of this file would have tidied anyway. `anyOver` already does exactly this for the hem band,
   * for the same reason and with the same cost: an unsuccessful try costs nothing, because what it
   * lifted goes straight back.
   *
   * Only SOFT cover: a cell that is drawn and walkable. Anything with collision on it is a thing,
   * and a thing is not moved to make room for a view.
   */
  const frame = (kind: string, x: number, y: number): boolean => {
    if (overSomething(kind, x, y)) return false;
    const lifted: [number, number][] = [];
    for (let dx = 0; dx < KINDS[kind]!.trunk.length; dx++) {
      const tx = x + dx;
      if (!inside(tx, y) || at(below, tx, y) === 0 || at(collision, tx, y) !== 0) continue;
      lifted.push([tx, at(below, tx, y)]);
      set(below, tx, y, 0);
    }
    if (plantKind(kind, x, y)) {
      // Flagged the moment it goes in, so the verge sweep knows it is composition rather than
      // scenery. See `Tree.framing`, and the note in that sweep about what the corridor rule needs.
      trees[trees.length - 1]!.framing = true;
      return true;
    }
    for (const [tx, tile] of lifted) set(below, tx, y, tile);
    return false;
  };
  /**
   * Does a crown already cover this column on the two rows the camera's top edge cuts?
   *
   * ASKED OF THE REGISTER, NOT OF `above`, and that is the difference between this pass doing
   * something and doing nothing. By the time it runs, `above` still carries crown tiles left
   * behind by trees that the clearings felled -- the canopy rebuild a few lines below exists to
   * wipe exactly those and re-stamp the survivors. Reading the tiles, the pass saw canopy over
   * x 6 to 9 of the spawn frame, skipped all four columns, and the rebuild then deleted the very
   * crowns it had deferred to: three columns of open lawn at the top of the hero shot, left there
   * by a check that trusted a layer the file's own next pass does not.
   */
  const alreadyFramed = (x: number, row: number): boolean =>
    [row - 2, row - 1].every((y) => trees.some((t) => crownsOver(t, x, y)));
  let framed = 0;
  for (const band of FRAMINGS) {
    let x = band.x0;
    while (x <= band.x1) {
      if (alreadyFramed(x, band.row)) {
        x += 1;
        continue;
      }
      const grain = grainAt(x, band.row);
      const lean = grain > 0.52 ? 1 : 0;
      /*
       * The elder first where the grain allows it: its crown is three rows deep, so it is the one
       * scale that genuinely runs off the top of the frame rather than sitting just inside it.
       */
      const tries: readonly (readonly [string, number])[] = [
        ...(grain > 0.56 ? ([['elder', band.row + lean]] as const) : []),
        ['mid', band.row + lean],
        ['mid', band.row + 1 - lean],
        ['sapling', band.row - 1],
      ];
      const took = tries.find(([kind, row]) => frame(kind, x, row));
      if (!took) {
        x += 1;
        continue;
      }
      framed++;
      const row = took[1];
      const w = trees[trees.length - 1]!.k.trunk.length;
      /*
       * THE COMPANION HAS TO SHARE A CROWN ROW, and the first version of this did not, which cost
       * the pass everything it bought. It put the companion two rows BELOW, so the pair's crowns
       * never touched; the lone-tree sweep at the foot of the planting measures loneliness as
       * "no other tree's crown reaches the column either side of mine, on either of my crown rows",
       * found both of them alone in a glade with nowhere to put a companion, and took them out
       * again. Twenty-five trees planted, canopy over the camera's top rows DOWN by three tiles.
       *
       * Two columns over on the same row makes one four-tile mass of the pair; failing that, one
       * column across and one row down overlaps by a row and interlocks. Those are the sweep's own
       * two remedies, which is the point: a stand built the way the sweep repairs stands is a stand
       * the sweep leaves alone.
       */
      let span = w;
      const mate = (
        [
          ['mid', x + w, row],
          ['sapling', x + w - 1, row + 1],
        ] as const
      ).find(([kind, mx, my]) => frame(kind, mx, my));
      if (mate) {
        framed++;
        span += mate[1] - x + trees[trees.length - 1]!.k.trunk.length - w;
      }
      /*
       * No gap is LEFT here, and that is the second correction. Walking the band with a jittered
       * stride of three or four columns put twenty trees across fifty-three columns, of which four
       * landed in the nineteen columns a landscape visitor can actually see -- the title card
       * covers the left 24% of that frame, so everything this pass bought was behind it.
       *
       * The gaps in a treeline are not a thing to ration. They are the footpath, the fountain, the
       * stall and the glade, all of which refuse a tree on their own, so every column is offered
       * one and the shape comes out of what the ground already says. The stride is the width of
       * what was just planted.
       */
      x += span;
    }
  }
  /*
   * ===========================================================================
   * ...AND A TREE THE WOOD ALREADY PUT THERE IS COMPOSITION TOO.
   * ===========================================================================
   *
   * `alreadyFramed` skips a column the wood has already closed, which is right: there is nothing
   * to add. But the tree doing the closing carries no flag, so the verge sweep judged it as
   * scenery and felled it on a draw of `shoulderField`. Traced on the generated map: one elder
   * standing across columns 8, 9 and 10 with its crown on the row the camera's top edge cuts was
   * taken out for being beside the owl's footpath, and three columns of the middle of the hero shot
   * opened up AFTER every count in this pass had been taken.
   *
   * What matters is where the crown IS, not which pass put it there. So the flag is applied by
   * position, over every band, once the planting is done.
   */
  let adopted = 0;
  for (const band of FRAMINGS)
    for (const t of trees) {
      if (t.framing) continue;
      if (
        !t.k.crown.some(
          ([dx, dy]) =>
            t.x + dx >= band.x0 &&
            t.x + dx <= band.x1 &&
            (t.y + dy === band.row - 2 || t.y + dy === band.row - 1),
        )
      )
        continue;
      t.framing = true;
      adopted++;
    }
  console.log(
    `  framing: ${framed} tree(s) planted and ${adopted} adopted, ` +
      'closing the top of the title, portrait and arrival cameras',
  );
  // --- thinning: walls of foliage and topiary files ----------------------------------------------
  /*
   * ===========================================================================
   * THINNING: NO WALL OF FOLIAGE, AND NO TOPIARY FILE.
   * ===========================================================================
   *
   * Two shapes the planting cannot refuse for itself, because neither of them exists until several
   * trees have gone in and neither is visible to the tree going in next.
   *
   *   A WALL is an unbroken vertical run of crown. The longest on the map was THIRTEEN tiles at
   *   column 47 -- taller than the camera, which is 11.22 -- and the file guard at the foot of this
   *   file could not see it: `fileMate` asks for DAYLIGHT between two crowns before it calls them a
   *   file, on the good argument that two trees two rows apart are a mass rather than a line. A
   *   solid stack has no daylight in it at all, so by that definition it was not a file and nothing
   *   counted it. Measured off the crowns themselves, where no definition of a file can step over
   *   it.
   *
   *   A FILE is the old complaint and it is still worth watching: trees sharing an anchor column at
   *   a tight pitch. `plantSpaced` offers a site one column across when it sees one forming, but
   *   the passes that plant for a REASON -- the road's own treeline, the sapling infill, this
   *   framing -- call `plantKind` directly and cannot, so a file can still assemble out of three
   *   different passes none of which was looking.
   *
   * Nothing holding a frame open is felled: a framing tree and a verge tree were both put where
   * they are on purpose, and taking one out to tidy a column is how a composition pass gets undone
   * by a housekeeping one. The sweep takes the tree nearest the MIDDLE of the offending run, which
   * is what breaks it into two short ones rather than shortening it by a tile.
   */
  const CROWN_STACK_LIMIT = 9;
  /*
   * THREE, NOT FOUR. A file of four crowns on one anchor column with daylight between every pair is
   * still a file -- the product manager found one at columns 48 and 49 beside the cottage and read
   * it as topiary, which is the same word this sweep was written to answer. Four is what the eye
   * counts most readily; a limit that permits four permits the complaint. Two trees in a column are
   * a pair and three is a stand, and both are things a wood does.
   */
  const FILE_LIMIT = 3;
  const spare = (t: Tree): boolean => t.framing === true || t.verge === true;
  let thinned = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    const crowns = new Set<number>();
    for (const t of trees)
      for (const [dx, dy] of t.k.crown) crowns.add((t.y + dy) * MAP_W + (t.x + dx));
    let worst = { col: -1, top: 0, run: 0 };
    for (let x = 0; x < MAP_W; x++) {
      let run = 0;
      for (let y = 0; y < MAP_H; y++) {
        run = crowns.has(y * MAP_W + x) ? run + 1 : 0;
        if (run > worst.run) worst = { col: x, top: y - run + 1, run };
      }
    }
    if (worst.run <= CROWN_STACK_LIMIT) break;
    const middle = worst.top + Math.floor(worst.run / 2);
    const victim = trees
      .filter(
        (t) =>
          !spare(t) &&
          t.k.crown.some(
            ([dx, dy]) =>
              t.x + dx === worst.col && t.y + dy >= worst.top && t.y + dy < worst.top + worst.run,
          ),
      )
      .sort((a, b) => Math.abs(a.y - middle) - Math.abs(b.y - middle))[0];
    if (!victim) break;
    clearArea(victim.x, victim.y, victim.k.trunk.length, 1);
    thinned++;
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const byCol = new Map<number, Tree[]>();
    for (const t of trees)
      if (t.x > 1 && t.x < MAP_W - 3) byCol.set(t.x, [...(byCol.get(t.x) ?? []), t]);
    let worstFile: Tree[] = [];
    for (const [, list] of byCol) {
      let run: Tree[] = [];
      for (const t of [...list].sort((a, b) => a.y - b.y)) {
        run = run.length > 0 && fileMate(t.y, run[run.length - 1]!.y) ? [...run, t] : [t];
        if (run.length > worstFile.length) worstFile = [...run];
      }
    }
    if (worstFile.length <= FILE_LIMIT) break;
    const victim =
      worstFile.slice(1, -1).find((t) => !spare(t)) ?? worstFile.find((t) => !spare(t));
    if (!victim) break;
    clearArea(victim.x, victim.y, victim.k.trunk.length, 1);
    thinned++;
  }
  /*
   * A BRICK COURSE is the third shape, and it is the one the client is pointing at. See the long
   * note above `plantKind` for what it is and why it is swept rather than refused: a run of cells
   * down one column where every trunk is painted and then painted over by somebody else's crown,
   * so the only thing between one crown's hem and the next crown's cap is the tile boundary, and
   * the hem keyline draws it as a rule. Four stacked discs with three dark rules through them and
   * no bark anywhere, which is "the trees in the middle are messed up".
   *
   * TWO, NOT ONE AND NOT THREE. Read off the register, a run of ONE buried trunk is two crown rows
   * meeting once with that tree's own trunk still on the ground beneath them -- a tree standing
   * behind its neighbour, which is a wood, and there are 143 of those. A run of TWO is three crown
   * rows and the middle tree has lost its feet; it is the shortest run that reads as a course, and
   * a limit of one costs nine extra fellings to take out a shape the eye does not yet call a brick.
   * A run of THREE is the picture in the client's screenshot. So the limit permits the pair and
   * refuses the course: measured, the committed map has 35 runs of two, seven of three, and one
   * each of four, five and six, and this sweep has to reach only the ten over the limit. Nine
   * fellings later there are 31 runs of two and nothing longer.
   *
   * WHY IT ASKS THE REGISTER AND NOT THE LAYERS. The canopy rebuild below has not run yet, so
   * `above` still holds what planting stamped rather than what will ship, and a felled tree's
   * crown is cleared from the register before it is cleared from the raster. The register is what
   * the rebuild replays, so the register is what this must agree with -- the same reason the wall
   * sweep above counts `t.k.crown` rather than `isCanopy`.
   *
   * EITHER TREE ENDS THE RUN, so the victim is chosen from both: the tree whose crown is doing the
   * burying and the tree whose trunk is buried both stop being a pair if either goes. Taking the
   * one nearest the middle of the run breaks it into two short ones instead of shortening it by a
   * tile, which is the wall sweep's rule and it is right for the same reason.
   */
  const BURIED_COURSE_LIMIT = 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const crownsBy = new Map<number, Tree>();
    const trunksBy = new Map<number, Tree>();
    for (const t of trees) {
      for (const [dx, dy] of t.k.crown) crownsBy.set((t.y + dy) * MAP_W + (t.x + dx), t);
      for (let dx = 0; dx < t.k.trunk.length; dx++) trunksBy.set(t.y * MAP_W + (t.x + dx), t);
    }
    const isBuried = (x: number, y: number): boolean => {
      const key = y * MAP_W + x;
      return crownsBy.has(key) && trunksBy.has(key);
    };
    const courses: { col: number; top: number; run: number }[] = [];
    for (let x = 0; x < MAP_W; x++) {
      let run = 0;
      for (let y = 0; y <= MAP_H; y++) {
        if (y < MAP_H && isBuried(x, y)) {
          run++;
          continue;
        }
        if (run > BURIED_COURSE_LIMIT) courses.push({ col: x, top: y - run, run });
        run = 0;
      }
    }
    /*
     * A FRAMING TREE THAT IS NOT THE ONLY ONE CLOSING ITS COLUMN MAY GO AFTER ALL, and this is the
     * difference between a sweep that answers the client and one that stops just short of him.
     *
     * `spare` as the two sweeps above use it is the right rule for a WALL and a FILE, because those
     * are about the shape of the wood and a framing tree is there for the picture. It was the wrong
     * rule here. The course the client photographed -- column 2, rows 15 to 17, in the middle of
     * the phone's opening frame -- is held by FOUR trees and every one of them is framing, so the
     * sweep looked at the one course the brief is about and declined it. They are framing because
     * adoption marks any tree with a crown on the two rows a camera's top edge cuts, by position,
     * which is right for the tree that closes the edge and says nothing at all about the three
     * stacked behind it: a file is exactly the case where several trees claim the same columns.
     *
     * So the question is sharpened from "was this tree adopted" to "would felling it OPEN a
     * column". Count, per band and per column, how many trees have a crown on the band's two rows;
     * a framing tree whose every column is closed twice over is redundant there and may be felled,
     * and one that is the sole closer of any column is spared as before. Guard 7b and the arrival
     * edge guard measure the result independently, so if this is ever wrong the build says so
     * rather than the frame quietly opening.
     *
     * A VERGE TREE IS STILL SPARED OUTRIGHT. It was put against the sand deliberately and there is
     * no equivalent of "closed twice over" for it -- the road either has a treeline or it does not.
     */
    const closes = new Map<number, number>();
    const closedBy = (t: Tree): number[] => {
      const keys: number[] = [];
      for (const [bi, band] of FRAMINGS.entries())
        for (const [dx, dy] of t.k.crown) {
          const cx = t.x + dx;
          const cy = t.y + dy;
          if (cx < band.x0 || cx > band.x1) continue;
          if (cy !== band.row - 2 && cy !== band.row - 1) continue;
          if (!keys.includes(bi * MAP_W + cx)) keys.push(bi * MAP_W + cx);
        }
      return keys;
    };
    closes.clear();
    for (const t of trees)
      for (const key of closedBy(t)) closes.set(key, (closes.get(key) ?? 0) + 1);
    const heldForTheFrame = (t: Tree): boolean =>
      t.verge === true ||
      (t.framing === true && closedBy(t).some((key) => (closes.get(key) ?? 0) < 2));
    const fellable = (c: { col: number; top: number; run: number }): Tree | undefined => {
      const middle = c.top + Math.floor(c.run / 2);
      const inRun: Tree[] = [];
      for (let y = c.top; y < c.top + c.run; y++) {
        const key = y * MAP_W + c.col;
        for (const owner of [crownsBy.get(key), trunksBy.get(key)])
          if (owner && !heldForTheFrame(owner) && !inRun.includes(owner)) inRun.push(owner);
      }
      return inRun.sort((a, b) => Math.abs(a.y - middle) - Math.abs(b.y - middle))[0];
    };
    /*
     * THE LONGEST COURSE THAT CAN ACTUALLY BE BROKEN, not simply the longest.
     *
     * The first draft took the longest and stopped the sweep when every tree in it was spared --
     * and that is not a rare case, it is the common one: a framing tree holds a camera's top edge
     * open and the courses nearest a camera are where framing trees are. One unbreakable course at
     * column 2 ended the sweep with seven more still standing, including the four-high file in the
     * portrait frame. Falling through to the next longest leaves the unbreakable one standing --
     * which is the honest outcome, since the alternative is felling the tree that holds the frame
     * -- and takes out every course that is anybody's to take.
     */
    const course = courses
      .filter((c) => fellable(c) !== undefined)
      .sort((a, b) => b.run - a.run)[0];
    if (!course) break;
    const victim = fellable(course)!;
    clearArea(victim.x, victim.y, victim.k.trunk.length, 1);
    thinned++;
  }
  console.log(
    `  thinning: ${thinned} tree(s) out of a wall of foliage, a topiary file or a brick course`,
  );

  // --- the Tiled file: layers, tileset, objects --------------------------------------------------
  const tileLayer = (id: number, name: string, data: Layer) => ({
    id,
    name,
    type: 'tilelayer',
    width: MAP_W,
    height: MAP_H,
    x: 0,
    y: 0,
    opacity: 1,
    visible: name !== 'collision',
    data,
  });

  const rows = Math.ceil(TILE_NAMES.length / COLUMNS);
  /*
   * THE CANOPY IS REBUILT FROM THE REGISTER, which is both the tidy pass and the mirror pass.
   *
   * Overlapping crowns mean the tile in a cell of `above` no longer says which tree put it there,
   * so nothing can be inferred from it: a crown quarter overwritten by a neighbour used to make
   * the old sweep fell a healthy tree, and a crown left behind by a clearing used to hang in the
   * air. Wiping every canopy tile and re-stamping the trees that are still on the register settles
   * both at once, and it cannot leave half a tree however the clearings fall.
   *
   * Mirroring happens here rather than in the pass below, because a tree has to mirror as a WHOLE:
   * the halves go on swapping as well as flipping, or the two sides of a crown meet at a seam down
   * the middle of every mirrored tree on the map. The trunks wait -- the cast shadow below reads
   * `trunk-l` by name, and a flipped gid is not that gid.
   */
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) if (isCanopy(x, y)) set(above, x, y, 0);
  /*
   * WHICH WAY A TREE FACES IS CORRELATED ALONG A ROW, and that is a fix rather than a flourish.
   *
   * The flip used to be `heads(t.x, t.y, 0)`, which is white noise per tree, so every pair of
   * neighbouring trees in the same row had an even chance of facing OPPOSITE ways -- and two crowns
   * facing opposite ways share a seam about which they are exact mirror images. The eye catches
   * bilateral symmetry instantly, far faster than it catches repetition, so a butterfly in the
   * canopy is worse than the plain tiling the mirror pass was introduced to break: the product
   * manager found them at 5.6x and they are plainly visible at 1x in the 375 portrait frame.
   *
   * A field sampled at about a third of a tile in x gives runs of three or four trees facing the
   * same way, so a seam occurs only where one run meets the next -- roughly a third as often -- and
   * where it does, the two crowns are usually at different scales or different rows, which breaks
   * the symmetry anyway. The vocabulary the mirror pass buys is unchanged: half the trees on the
   * map still face the other way.
   */
  /*
   * ...AND IT IS A FAITHFUL REPLAY, which is what the overlap rule depends on. Planting stamps the
   * final orientation and refuses a cover that would not repaint what it covers; this pass replays
   * the facing each tree RECORDED, in register order, so the tile that wins a shared cell here is
   * the tile that won it at planting. If the two ever diverged, every overlap the planter had
   * cleared would be re-decided by a different tile and the holes would be back. Re-deriving it from
   * position cannot do that any more: a tree's facing is now its neighbours' as much as the field's.
   */
  for (const t of trees) {
    const flip = t.flip;
    for (const [dx, dy] of t.k.crown)
      layCrown(
        t.x + dx,
        t.y + dy,
        flip ? gid(mirroredTile(t.k, dx, dy)) + FLIP_H : gid(t.k.tileAt(dx, dy)),
      );
  }
  /*
   * ===========================================================================
   * AND WHERE TWO CROWNS SHARE A CELL, THE ONE IN FRONT IS DRAWN IN FRONT.
   * ===========================================================================
   *
   * `layCrown` gives a shared cell to whichever quarter covers the other's pixels, which is the
   * rule that keeps holes out of the canopy -- and it is blind to depth. An elder's middle and
   * bottom quarters are opaque in every pixel, so they cover anything, and where an elder stands a
   * row in front of another (one column across) the BACK tree took cells of the FRONT tree's crown:
   * its dark underside printed as a square inside the front crown, cut on two sides by the tile
   * grid. It was the clearest seam left in the wood, visible at the game's own zoom in the keeper's
   * frame, the magpie's frame and along the south of the map.
   *
   * The pairs that occur are drawn in `tiles/w-trees.ts` as one tile each -- the front quarter laid
   * over the back -- and this puts them down, which is the only change to the canopy: a cell that is
   * not an inversion of one of those pairs is not touched. Measured on this map by the count printed
   * below: 65 cells, 48 of them elder over elder and 17 an elder's top corner over a sapling behind
   * it. Only where the winning quarter and the front-most crown it beat face the same way, so the
   * tile is that pair or its mirror with the flip bit; a mixed pair is left as it was (one remains,
   * at (57,17)). Where three crowns share a cell the middle one had already lost and still does.
   * Audit 9's blind-cell ratchet reads 101 before and after, so no cell Purple could be seen in has
   * become one she vanishes in. `test/crown-depth.test.ts` reads the result back off the shipped map
   * by the elders' trunks, with none of this code: 22 back-over-front cells before, 0 after.
   */
  {
    const OVERLAP: Record<string, string> = {
      'elder-tr/elder-mc': 'elder-tr-over-mc',
      'elder-tl/elder-mc': 'elder-tl-over-mc',
      'elder-mr/elder-bc': 'elder-mr-over-bc',
      'elder-ml/elder-bc': 'elder-ml-over-bc',
      'elder-tc/elder-mr': 'elder-tc-over-mr',
      'elder-tc/elder-ml': 'elder-tc-over-ml',
      'elder-tl/sapling-tr': 'elder-tl-over-sapling-tr',
      'elder-tr/sapling-tl': 'elder-tr-over-sapling-tl',
      'elder-tl/elder-br': 'elder-tl-over-br',
      'elder-tr/elder-bl': 'elder-tr-over-bl',
    };
    /** Every crown quarter laid on each cell, as drawn: name, flip and the tree's trunk row. */
    const laid = new Map<number, { name: string; flip: boolean; y: number }[]>();
    trees.forEach((t) => {
      if (t.k !== KINDS['elder'] && t.k !== KINDS['sapling']) return;
      for (const [dx, dy] of t.k.crown) {
        const key = (t.y + dy) * MAP_W + t.x + dx;
        const name = t.flip ? mirroredTile(t.k, dx, dy) : t.k.tileAt(dx, dy);
        const list = laid.get(key) ?? [];
        list.push({ name, flip: t.flip, y: t.y });
        laid.set(key, list);
      }
    });
    let fronted = 0;
    for (const [key, list] of laid) {
      if (list.length < 2) continue;
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      // The quarter that actually won the cell, and the front-most crown it beat, if any. Where
      // three crowns share a cell the middle one lost before this pass and still does.
      let back = list.find((q) => at(above, x, y) === gid(q.name) + (q.flip ? FLIP_H : 0));
      if (!back) continue;
      /*
       * A BURIED CROWN DOES NOT GET TO SHOW THROUGH (the client's screenshot, 2026-10-25). Where
       * three crowns share a cell, the quarter that won it can be the MIDDLE crown's -- a tree that
       * lost the cells round it to the rearmost crown's opaque underside -- and its bright middle
       * then printed as a lighter square inside that underside, cut by the grid on two sides, at
       * (33,15). The rearmost crown is what surrounds such a cell, so the front crown is laid over
       * it instead: a three-crown cell reads as the front tree over the one the eye sees round it.
       */
      if (list.length >= 3) {
        const rearmost = [...list].sort((p, q) => p.y - q.y)[0]!;
        if (rearmost !== back && rearmost.y < back.y) {
          back = rearmost;
          set(above, x, y, gid(back.name) + (back.flip ? FLIP_H : 0));
        }
      }
      const front = list.filter((q) => q.y > back.y).sort((p, q) => q.y - p.y)[0];
      if (!front || front.flip !== back.flip) continue;
      const tile = OVERLAP[`${front.name}/${back.name}`];
      if (!tile) continue;
      set(above, x, y, gid(tile) + (front.flip ? FLIP_H : 0));
      fronted++;
    }
    console.log(`  overlaps: ${fronted} cell(s) where a crown in front is now drawn in front`);
  }
  // --- cast shadow -------------------------------------------------------------------------------
  /*
   * CAST SHADOW -- the last pass, and the one that stops nine hundred trees floating on a lawn.
   *
   * There was not a single shadow anywhere in the world. The board darkens the ground under every
   * crown and spills it south-east, which is visible as a green pool at the foot of any tree you
   * crop out of it; ours had crowns and trunks pasted onto flat, evenly lit grass, which is the
   * difference between a layered wood and a tile demo.
   *
   * This is PLACEMENT, not painting: the four grass variants are four brightness steps, so a shadow
   * is a tile that has been walked a step or two down that ramp. WHICH STEP IS WHICH IS MEASURED
   * off the painters at the head of this function, not read off their order in `TILE_NAMES` -- this
   * note used to quote "123, 148, 164, 170", and on the sheet that ships `grass-1` is the darkest
   * of the four, so for at least a round a shadow laid on it made the ground BRIGHTER.
   * Which means it also does something the painters cannot. Both halves of a trunk tile
   * and all four quarters of a canopy are substantially transparent -- `trunk-l` is opaque over
   * barely half its area -- so the ground under a tree is SEEN, and until now it was the same tile
   * under every tree on the map. Varying it multiplies the number of distinct composites a 32px
   * cell can be, which is the measured wallpaper problem attacked at its root rather than by
   * placing yet more different objects.
   *
   * It runs after the tidy pass, off the trunks that actually survived, so a tree removed by a
   * clearing cannot leave its shadow behind on the grass.
   *
   * The sun is in the north-west, consistently with the painters' own highlights, so the pool is
   * deepest under the trunk and trails east and south.
   *
   * A shadow is laid as a LEVEL, not as a number of steps down from whatever was there. The first
   * attempt stepped down, and it printed a quilt of hard dark squares across the open ground east
   * of the bridge: the four variants were 6, 16 and 25 luma apart then, so one step was nearly
   * invisible at the light end of the ramp and a wall at the dark end, and two overlapping trees
   * compounded to the floor. A real shadow is about as bright as the other shadows near it whatever
   * it falls on, which is what clamping to a level gives -- and it is idempotent, so a tile deep in
   * the wood is shaded once however many crowns reach over it.
   *
   * THE RAMP IS NOW 5.4 LUMA WIDE END TO END, which is the uncomfortable half of this pass and the
   * reason the trees still float. Clamping to a level is still the right mechanism; there is simply
   * almost nothing left to clamp to. The run prints the ramp on its own line and `RAMP_SPAN_FLOOR`
   * stops it narrowing further, but the fix is in `tiles/w-ground.ts`'s `BANDS`, not here.
   */
  const shade = (x: number, y: number, level: number): void => {
    const step = grassStep.get(at(ground, x, y));
    if (step === undefined || step <= level) return;
    set(ground, x, y, grassTiles[level]!);
  };
  /** The ground a solid object stands on, plus the sunlight it takes off its east and south. */
  const groundShadow = (x: number, y: number, w: number, h: number): void => {
    for (let dx = 0; dx < w; dx++) shade(x + dx, y + h, 1);
    for (let dy = 0; dy < h; dy++) shade(x + w, y + dy, 2);
    shade(x + w, y + h, 2);
  };
  /*
   * WALKED OFF THE REGISTER RATHER THAN OFF THE TILES, which is what lets three scales each cast
   * their own shadow. This used to scan for `gid('trunk-l')` and then shade a hard-coded 2x3 box
   * around it, which an elder's three columns would have been shaded two-thirds of and a sapling's
   * would have been overshaded by a row -- and, worse, neither elder nor sapling carries a
   * `trunk-l` at all, so every one of them would have come out with no shadow whatsoever: the
   * biggest trees on the map floating on a lawn, which is the exact fault this pass exists to fix.
   *
   * It still runs before the trunks are mirrored, so the register is the only thing that can be
   * asked anyway.
   */
  for (const t of trees) {
    const w = t.k.trunk.length;
    const top = Math.min(...t.k.crown.map(([, dy]) => dy));
    /*
     * How dark the pool under this tree goes. A sapling is a waist-high shrub whose crown is one
     * tile deep; driving the ground under it to the darkest rung would make a seedling cast the
     * same shadow as a forty-foot elder, which is both wrong and, because the penumbra pass below
     * grows a ring around every rung-0 pool, a way of spreading night across a glade from the one
     * tree that was put there to make the glade feel open.
     */
    const floor = top <= -2 ? 0 : 1;
    // Under the trunk itself, where the crown blocks the light outright. Every half of a trunk
    // tile is largely transparent, so this is the half of the shadow the player actually sees.
    for (let dx = 0; dx < w; dx++) shade(t.x + dx, t.y, floor);
    /*
     * The rows the CROWN stands over, which is the half the first attempt missed and the
     * reason it looked like a quilt rather than a wood. A canopy quarter is opaque over about
     * three quarters of its square, so bright ground shows at its corners; shading the trunk row
     * and not the crown rows left a dark square and a light square alternating under every tree
     * on the map, which is a chequerboard drawn in exactly the place a shadow was meant to be.
     *
     * ...AND A RUNG LIGHTER THAN IT WAS, now that the crowns merge.
     *
     * Those rows used to be driven to the floor as well, which was right for 173 trees
     * standing apart and is wrong for 377 whose crowns touch. Counted over the finished map, 71%
     * of every grass tile on it had been walked down to the darkest rung: the shadow had stopped
     * being a shadow and become the baseline, which is exactly as flat as having no shadow at all
     * and left the open lawn in the arrival frame printed with dark squares between the crowns.
     * One rung up puts the floor back under the trunk, where the light genuinely cannot reach,
     * and leaves the crown rows as shade rather than as night.
     */
    for (let dy = top; dy <= -1; dy++) for (let dx = 0; dx < w; dx++) shade(t.x + dx, t.y + dy, 1);
    // The pool at the foot of the tree, deeper on the side the sun does not reach.
    for (let dx = 0; dx < w; dx++) shade(t.x + dx, t.y + 1, dx === w - 1 ? floor : 1);
    // And the fringe it throws east, which is the only thing that says where the sun is.
    for (let dy = top; dy <= 1; dy++) shade(t.x + w, t.y + dy, 2);
  }
  // The buildings cast too, and the cottage is the one thing on the map the player walks towards.
  groundShadow(cx, cy + 1, 6, 4);
  groundShadow(11, 17, 4, 1);

  // --- road keyline ------------------------------------------------------------------------------
  /*
   * AND THE ROAD IS KEYLINED, like everything else on the board.
   *
   * The board puts a darker rim around its path where the sand meets the grass; ours met it at full
   * brightness on both sides, which is why the track read as a cut-out of sand laid on a lawn
   * rather than as a road worn into it. This walks the grass down the ramp for one tile along the
   * verge -- deeper where a fine field says so, barely at all where it does not, so the rim is a
   * worn edge and not a drawn outline. The penumbra pass below then carries it out one more rung,
   * which is the soft falloff the board has.
   *
   * It is laid as a LEVEL for the same reason the tree shadows are: stepping down from whatever
   * happened to be there put a quilt of hard squares along the road, because the rungs are not
   * evenly spaced.
   */
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (grassStep.get(at(ground, x, y)) === undefined) continue;
      // `besideSand`, declared with the verge planting, rather than a second copy of its body.
      const beside = besideSand(x, y);
      /*
       * MOSTLY ONE RUNG, OCCASIONALLY TWO -- and the threshold moved from 0.44 to 0.72 because of
       * what the pass below it does with the result.
       *
       * At 0.44 about half the verge went down to rung 1, and the penumbra sweep that follows
       * drops any tile more than one rung above its darkest neighbour. The road runs through every
       * glade on the map, so a rung-1 ribbon the length of it put a rung-2 ceiling on the whole
       * clearing either side: the two lightest grasses ended up on 5.6% of the ground between them,
       * four tones in the tileset and two of them unused, and every open stretch came out one flat
       * green. A worn edge should be a rung off the sunlight, not a trench.
       */
      if (beside) shade(x, y, verge(x / 2.7, y / 2.7) > 0.72 ? 1 : 2);
    }

  // --- penumbra ----------------------------------------------------------------------------------
  /*
   * PENUMBRA -- no two grass tones more than one rung apart may share an edge.
   *
   * THE MEASUREMENT THAT FOUND THIS. The six scored axes are all whole-frame histograms, so none
   * of them can see WHERE a tone sits; a straight grid-aligned tonal wall and the same tones
   * scattered score identically. So I counted the walls directly: for every tile seam in a render,
   * the mean luma of the 32 pixels either side of it, then the runs of >=4 consecutive seams
   * stepping the same way by >12 luma. The spawn camera had 13 such runs covering 64 seam tiles.
   * The board, through the same detector, had one run of 6 -- and that one is the frame's own top
   * edge, where the art meets the UI chrome, not a seam inside the art at all. Ten times the
   * straight grid walls, invisible to every axis in the score.
   *
   * WHAT WAS MAKING THEM. Nothing in the pipeline kept non-adjacent rungs apart. The field quantises
   * into three bands and the shadow pass clamps to a LEVEL, and both are perfectly entitled to put
   * rung 0 against rung 2 or 3 wherever the field's gradient is steep or the wood's edge is tidy.
   * Measured off the painters the rungs mean 104.3, 143.0, 163.5 and 173.6, so a 0|2 seam is a 59
   * luma step and a 0|3 seam is 69, laid dead straight along a tile edge for six tiles at a stretch.
   * That is the rectangle you see in the open ground west of the stall.
   *
   * WHY NOT FIX IT UPSTREAM. Tried first, measured, rejected: moving the field off rung 0 entirely
   * so the darkest grass belonged to the shadow pass alone cost 0.010 at spawn, 0.027 at the
   * cottage and 0.012 at the stall, gained 0.013 on the whole map -- and left the wall standing,
   * because most of these seams are the shadow's own outer edge, not the field's.
   *
   * SO IT IS FIXED WHERE IT IS MADE. One rung per ring, lowering the LIGHT side: a tile two or more
   * rungs above its darkest neighbour drops to one above it. Repeated to a fixpoint that is a ring
   * of rung 2 around a rung-0 pool, and then rung 3 outside that -- which is what a penumbra is.
   * Lowering the light side rather than raising the dark one keeps every pixel the shadow pass won
   * on the deep-shade axis, and the ring only ever grows into ground that was already next to a
   * shadow. It is the last ground pass, so it catches the field, the shadows and the buildings
   * alike, and nothing after it writes a grass tile.
   */
  for (let pass = 0; pass < 8; pass++) {
    let moved = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const step = grassStep.get(at(ground, x, y));
        if (step === undefined) continue;
        let darkest = step;
        for (const [dx, dy] of NEIGHBOURS) {
          const n = grassStep.get(at(ground, x + dx, y + dy));
          if (n !== undefined && n < darkest) darkest = n;
        }
        if (step > darkest + 1) {
          set(ground, x, y, grassTiles[darkest + 1]!);
          moved++;
        }
      }
    if (moved === 0) break;
  }

  // --- mirroring: the rest of it -----------------------------------------------------------------
  /*
   * THE REST OF THE MIRRORING. The crowns were already laid flipped when the canopy was rebuilt;
   * the trunks waited for the cast shadow above to finish reading `trunk-l` by name, and now join
   * them off the same register, so a tree's trunk and crown can never disagree about which way it
   * faces.
   *
   * What may be mirrored is decided by LIGHTING, and by what the renderer can draw without a seam:
   *   - Anything that stands up -- scrub, boulders, flowers, toadstools, trees -- takes the
   *     horizontal axis only. Flipping those top to bottom would stand them on their heads.
   *   - The fence takes the horizontal axis. Its pales are a vertical pattern with no left and no
   *     right in them, and `map.test.ts` reads only `path` and `bridge` back by name, so a flipped
   *     fence gid breaks nothing -- while an unflipped one printed the same picket, 24 times in a
   *     row, along the top of the one frame the game ends on.
   *   - Sand, shores, bridge and every other built thing take nothing. They either encode a
   *     direction in the tile itself or are read back by name in the map tests, and a flipped gid
   *     is not the gid those tests look up.
   *   - Ground texture and water have no light direction in them, so the ART would take all eight
   *     symmetries. THE RENDERER WILL NOT, so they take the horizontal axis like everything else.
   *     This is the client's "lagginess in the top right" and the whole of the note below.
   */
  for (const t of trees) {
    // The facing the crowns were laid from, or a tree's trunk and its crown face opposite ways.
    if (!t.flip) continue;
    /*
     * Every trunk cell still has to be the tile the register says it is before any of them is
     * touched. A later pass is entitled to have written over one of them -- the garden fence runs
     * along a row through planted wood -- and flipping half a trunk row while the other half is a
     * fence rail is the sort of thing that shows up as one bad pixel column in a shipped build.
     * An elder has three cells, so "all of them" is not "both of them" any more.
     */
    if (t.k.trunk.some((n, dx) => at(below, t.x + dx, t.y) !== gid(n))) continue;
    for (const [dx] of t.k.trunk.entries())
      set(below, t.x + dx, t.y, gid(mirroredTrunk(t.k, dx)) + FLIP_H);
  }

  /*
   * ===========================================================================
   * ONE AXIS. THE HORIZONTAL ONE. NOTHING HERE MAY EMIT `FLIP_V` OR `FLIP_D`.
   * ===========================================================================
   *
   * This set used to be two. `BOTH_AXES` held the isotropic textures -- `grass-0..3`, `water`,
   * `water-2` -- and gave them all three bits, on the sound argument that a texture with no up and
   * no light in it has eight symmetries rather than two, which halves the share of the map any
   * single image covers for nothing. The argument is still true about the DRAWINGS. It is false
   * about the renderer, and the renderer is what the client sees.
   *
   * WHAT THE CLIENT SEES, which is "I still see the lagginess in the top right": a one-pixel dashed
   * line of the camera backdrop drawn straight across the world near the top of the frame, on the
   * launch screen and in play. Not frame pacing, not a canvas offset, not a tear -- a HOLE, and the
   * black showing through it is `--cyera-black` behind the world.
   *
   * WHY. Tiled keeps mirror state in the top three gid bits, and Phaser's `tilemapTiledJSON` loader
   * decodes six of the eight combinations as a ROTATION. Measured in the running game, over all
   * 2520 ground tiles, bit pattern -> what Phaser makes of it:
   *
   *     H V D  ->  rotation   flipX        H V D  ->  rotation   flipX
   *     - - -  ->  0          false        H - -  ->  0          true     <- the only two that are safe
   *     - V -  ->  180        true         H V -  ->  180        false
   *     - - D  ->  270        true         H - D  ->  90         false
   *     - V D  ->  270        false        H V D  ->  90         true
   *
   * Phaser's tilemap renderer rotates the quad about the tile centre, and a rotated quad lands a
   * hair short of its cell, so the tile drops a pixel row. It does not drop it everywhere -- it
   * depends on where the tile and the camera land against the device pixel grid, which is why only
   * three or four dashes show at a time and why this survived seven rounds and three "ruled out"
   * measurements. A tile at rotation 0 cannot do it at all.
   *
   * PROVEN, not reasoned. With the camera backdrop painted magenta (it appears nowhere in the
   * tileset, so a magenta pixel is a hole and nothing else), at 1673x449 -- the client's own window
   * -- and at 1280x800, DPR 1 and 2: 80, 320, 192 and 768 magenta pixels respectively, every one of
   * them on the single scanline at world y=480.00, the row 14/15 boundary. Clearing `rotation` on
   * every ground tile at runtime and changing nothing else took all four to ZERO. `roundPixels` was
   * already `true` and `antialias` already `false`, so there was no renderer setting left to turn:
   * the gids are where this has to be fixed.
   *
   * THE NEAR MISS, recorded so it is not tried again. The first fix forced `FLIP_D` on whenever H
   * and V both landed, on the theory that the half-turn was the culprit. It moved all 289 `H|V`
   * tiles to `H|V|D` and the leak did not move one pixel -- because `H|V|D` is a 90 degree rotation,
   * which drops a row just as happily as 180. The half-turn was never the thing; ANY rotation is.
   * Dropping `FLIP_D` instead is worse again, for the same reason in the other direction.
   *
   * So the two sets are one set, and the only bit it may ever add is `FLIP_H`. The guard in
   * `apps/game/test/map.test.ts` holds this: it fails if any layer emits a rotating combination.
   */
  const SIDEWAYS = new Set([
    // The isotropic textures. They would take all eight symmetries as art and take one as pixels.
    'grass-0',
    'grass-1',
    'grass-2',
    'grass-3',
    'water',
    'water-2',
    'bush',
    // Both new silhouettes have a lit top and a shadow under them, like `bush`, so they take the
    // horizontal axis and not the vertical one. `bush-tall` leans, so its mirror is a genuinely
    // different shape rather than the same shrub the other way up.
    'bush-low',
    'bush-tall',
    'rock',
    'flower-white',
    'flower-pink',
    'flower-red',
    'toadstool-ring',
    // `waterfall` WAS HERE and is not any more (Paul's round, 2026-10-22): mirrored at random, its
    // streaks broke at every other cell and the fall read as pasted blocks. One drawing, unflipped.
    'fence-h',
    /*
     * `fence-post` IS NOT IN THIS SET AND MUST NOT BE PUT BACK.
     *
     * It was, and the reason was sound while the tile was two post tops on a 16-pixel pitch with
     * lawn between them: that drawing is almost symmetric across, so a flip only moved its grass
     * sprigs and it bought a second image for free. The tile has since been redrawn as the board's
     * own foreshortened channel -- a nine-column lit face, two columns of shaded timber down the FAR
     * side and a cast shadow on the lawn beyond that, all on one side. A horizontal flip puts the
     * shade and the shadow on the near side instead, so with half the cells flipped the run zigzags
     * down its length and is lit from both directions at once. Variation comes from the four
     * distinct caps inside the tile now, which is more than the flip ever gave it. See the long note
     * in `tiles/s-outdoor.ts`.
     */
  ]);
  for (const layer of [ground, below, above])
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        /*
         * UNMASKED, AND IT HAS TO STAY UNMASKED. This is the one read in the file that `nameAt`
         * must not replace: a tile that already carries flip bits is one this pass has flipped
         * already, and the undefined it comes back with is what makes the pass skip it. Mask it
         * and the pass would re-roll `heads` on a cell it has already decided and ADD a second set
         * of bits to the gid, which is no longer a flip -- it is a gid pointing at nothing.
         */
        const name = TILE_NAMES[at(layer, x, y) - 1];
        if (name === undefined) continue;
        if (!SIDEWAYS.has(name)) continue;
        // `FLIP_H` alone, for every tile in the set. See the note above the set: it is the only bit
        // of the three that Phaser does not decode as a rotation, and a rotated tile drops a pixel
        // row. The vertical mirror and the transpose are not a style choice here, they are a hole.
        if (heads(x, y, 1)) set(layer, x, y, at(layer, x, y) + FLIP_H);
      }

  // --- verges ------------------------------------------------------------------------------------
  /*
   * THE VERGES. A road you cannot walk beside is a corridor, not a road.
   *
   * `plantTree` already refuses a path tile, so the track itself is always clear -- but it happily
   * plants a trunk in the tile NEXT to it, on both sides, and a wood that presses right up to the
   * sand turns every road into a one-tile slot. Measured by the end-to-end suite rather than by
   * eye: with the verges closed, five tests that walk Purple somewhere timed out, including the whole
   * errand line to the cottage, because every journey became a single-file shuffle with no room to
   * round a corner. The connectivity pass below cannot see this -- a one-tile corridor is perfectly
   * connected.
   *
   * So one tile either side of every path tile stays walkable. It costs very little of the wood,
   * since the track is a small share of the map, and it is also what the board does: its paths have
   * grass shoulders with the treeline set back, never trunks growing out of the sand.
   *
   * IT FELLS TREES AND NOTHING ELSE. The first version cleared any solid tile beside the track,
   * which quietly demolished a panel of the garden fence and opened a way round the notice post --
   * and the notice spanning the gate approach is the level's whole zero-click lesson, so
   * `apps/game/test/map.test.ts` failed on "the gate is unreachable if the notice is refused". The
   * fence, the cottage wall, the river and the boulders are all deliberate obstacles that happen to
   * touch a road. Only a tree in the register is fair game, and asking the register rather than
   * reading the tile also survives the flip flags that are baked in above.
   */
  /*
   * What may be cleared to make a way through, and what may not.
   *
   * Trees and loose boulders are scatter: the density field put them wherever it liked and moving
   * one costs the picture nothing. The garden fence, the cottage wall, the river and the waterfall
   * are deliberate, and the notice spanning the gate approach is the level's whole zero-click
   * lesson -- an earlier version of this pass cleared "any solid tile beside the track", quietly
   * took out a panel of fence, and `map.test.ts` failed on "the gate is unreachable if the notice
   * is refused". So the test is a whitelist, not a blacklist.
   *
   * The flip flags are already baked into the gids by the pass above, so the base gid has to be
   * masked out before it can be compared with anything.
   */
  const treeTrunkAt = (x: number, y: number): boolean =>
    trees.some((t) => t.y === y && x >= t.x && x < t.x + t.k.trunk.length);
  /*
   * ...AND SOLID SCRUB COUNTS, which is the bug this round shipped and the e2e suite caught.
   *
   * `clump('bush', ..., true)` plants thickets that stop her, on purpose: a dense bank of scrub is
   * a thing you walk round. The sealed border plants solid scrub too. But `bush` is also planted
   * SOFT by the forest floor and the dressing, so the same drawing means two different things
   * depending on which pass put it there -- an ambiguity this file documents and deliberately does
   * not assert its way out of, which is why `bush` is not in `MUST_STOP_HER` and why no audit here
   * could see what happened next.
   *
   * What happened next: a thicket grew into the notch at (38,20) and (39,20), where the main track
   * steps a row south, and planted `bush-low` and `bush-tall` solid in the one row a player who
   * only ever holds Right actually walks. Every unit test passed. `pnpm e2e` failed on "Purple never
   * reached both notices walking east", 60 seconds of pressing Right against a knee-high shrub, and
   * that is the whole class of fault the client's "movement has to work where it should" is about.
   *
   * Beside the track there is no ambiguity to preserve: a shrub on the shoulder of the road is
   * scenery, and scenery does not stop her. So the verge sweep fells it like a tree. It cannot
   * breach the edge of the world -- this sweep and the connectivity search are both bounded a tile
   * inside the border, and `sealBorder` runs after both of them anyway.
   */
  const fellable = (x: number, y: number): boolean =>
    treeTrunkAt(x, y) ||
    (at(below, x, y) & BASE_GID) === gid('rock') ||
    SCRUB_GIDS.has(at(below, x, y) & BASE_GID);
  /*
   * ===========================================================================
   * ...AND IT ONLY CLEARS ONE SHOULDER AT A TIME, which is where the road stops being a motorway.
   * ===========================================================================
   *
   * This felled everything beside every path tile on both sides, and that is the single biggest
   * reason the track read as a trunk road. The sand is two tiles; this cleared one tile either side
   * of it; and a crown stands two or three rows above its trunk, so nothing could be planted within
   * two rows of the sand in either direction. The narrowest light band the road could occupy was
   * therefore six or seven rows, running the full sixty columns -- a pale stripe across the middle of
   * every frame, with the four shoulder woods in the register pressing up against it and being
   * demolished for their trouble. The board's road has trees growing right at the sand on one side
   * and an open shoulder on the other, and that alternation is most of what makes it read as walked
   * rather than surveyed.
   *
   * WHAT KEEPS IT SAFE. The reason this pass exists is that a one-tile corridor cannot be walked --
   * five end-to-end tests timed out when the verges closed, because Purple had no room to round a
   * corner. A shoulder may therefore only stay wooded where the track beside it is AT LEAST TWO
   * TILES WIDE: the test is whether the tile directly across from the obstacle, on the far side of
   * the path tile, is itself sand. On the main track that is true everywhere, so the corridor is
   * never narrower than the two lanes plus the far shoulder. On the two one-wide footpaths it is
   * false everywhere, so they are cleared on both sides exactly as before and nothing about walking
   * them changes.
   *
   * The field's period is four tiles rather than the five and a half it started at, and that is the
   * second thing the debug dump corrected. A tree is spared on one draw, and the road runs along one
   * row, so the samples taken along a stretch of it walk a LINE through the field: at five and a half
   * tiles a run of eight columns crosses barely one and a half lattice cells, and this seed happened
   * to put that whole line under the threshold -- all four trees in the band either side of the
   * spawn camera's road came out felled while the pass reported seven spared at the far end of the
   * map. Four tiles gives a stretch of two or three trees at a time, which is still a stretch and no
   * longer a single draw deciding a whole camera.
   *
   * IT IS SAMPLED AT THE TREE, NOT AT THE CELL, and the first version of this got that wrong and
   * produced nothing. A tree is two or three trunk cells wide and `clearArea` strikes the whole tree
   * off whichever cell is cleared, so asking the field once per CELL means a tree survives only if
   * every one of its cells draws above the threshold -- a coin flip squared, or cubed for an elder.
   * The debug dump told the story exactly: eight trunk cells, four trees, stood in the band either
   * side of the road at planting time and none of them was there on the finished map, while the pass
   * reported seven cells spared somewhere else entirely. Asking once per tree keeps or fells it
   * whole, which is also the only answer that can produce a STRETCH of treeline rather than a
   * scatter of survivors.
   */
  /** The field at the obstacle's own tree, so a tree is kept or felled as one thing. */
  const pressesTheSand = (nx: number, ny: number): boolean => {
    const tree = trees.find((t) => t.y === ny && nx >= t.x && nx < t.x + t.k.trunk.length);
    // The road's own treeline is not scenery: it was put there to close the corridor. See Tree.verge.
    if (tree?.verge) return true;
    const ax = tree?.x ?? nx;
    const ay = tree?.y ?? ny;
    return shoulderField(ax / 4 + 67, ay / 4 + 67) > 0.42;
  };
  let verged = 0;
  let pressed = 0;
  for (let y = 2; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (!isPath(x, y)) continue;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || at(collision, nx, ny) === 0) continue;
        if (!fellable(nx, ny)) continue;
        /*
         * ===========================================================================
         * ROOM ACROSS, NOT SAND ACROSS. The rule this pass was always about, stated directly.
         * ===========================================================================
         *
         * What keeps a path walkable is TWO WALKABLE TILES ABREAST -- five end-to-end tests timed
         * out when the verges closed, because Purple had no room to round a corner. "The tile across
         * the path is also sand" is ONE way of having them and it is not the only one: open ground
         * across the path does just as well. On the two-lane carriageway the two are the same test,
         * so nothing there changes. On a one-wide footpath the proxy is false everywhere, which is
         * why both its sides were cleared along its whole length -- and that is a bald three-tile
         * corridor cut through the wood wherever a footpath goes.
         *
         * Measured, it cost the hero shot three columns of its canopy: an elder standing at columns
         * 8 to 10 with its crown on the row the camera's top edge cuts was felled for being beside
         * the owl's footpath, with four rows of open lawn on the other side of it.
         *
         * The guarantee survives intact, and it survives by construction rather than by luck: the
         * far side is read AT THIS MOMENT, so two trees facing each other across a one-wide path
         * can never both be spared -- the first is judged while the second is still standing.
         *
         * A FRAMING TREE SKIPS THE FIELD TEST ON TOP OF THAT. `pressesTheSand` is a field, and a
         * tree it has no flag for is kept only where that field happens to be high; composition
         * cannot be left to a coin flip. See `Tree.framing`.
         */
        const standing = trees.find((t) => t.y === ny && nx >= t.x && nx < t.x + t.k.trunk.length);
        const roomAcross =
          inside(x - dx, y - dy) && (isPath(x - dx, y - dy) || at(collision, x - dx, y - dy) === 0);
        if (roomAcross && (standing?.framing || pressesTheSand(nx, ny))) {
          pressed++;
          continue;
        }
        clearArea(nx, ny, 1, 1);
        verged++;
      }
    }
  console.log(
    `  verges: ${verged} obstacle(s) cleared beside the track, ` +
      `${pressed} left standing at the sand on a two-lane stretch`,
  );

  // --- the due-east walk -------------------------------------------------------------------------
  /*
   * ===========================================================================
   * THE DUE-EAST LINE, which was an accident of the pass above and is now a stated invariant.
   * ===========================================================================
   *
   * `overlaps` in `world/logic.ts` is a point test on Purple's FEET, so a player who only ever holds
   * Right walks the whole map along one exact row -- the spawn row plus one -- and `map.test.ts`
   * asserts that both notices lie on it. The end-to-end suite walks her that way and has already
   * failed once on "Purple never reached both notices walking east", sixty seconds of pressing Right
   * against a knee-high shrub that had grown into a notch where the track steps a row.
   *
   * Until now that row was kept clear by accident: the track occupied it for most of the width of
   * the map, and the verge sweep above cleared both shoulders everywhere else. Both of those have
   * just changed -- the track leans off the row between the spawn and the bridge, and a shoulder may
   * now stay wooded -- so the thing the e2e suite depends on has to be stated rather than inherited.
   * It is felled here and asserted in the audit at the foot of the file, where a future bend or a
   * denser wood will fail the build at `pnpm graybox` rather than sixty seconds into a browser.
   *
   * Only `fellable` things come out, so the fence, the cottage and the notice are untouchable; if
   * one of them ever lands on this row the audit says so instead of this pass quietly demolishing it.
   *
   * IT IS TWO ROWS, AND THE REASON IS WORTH WRITING DOWN BECAUSE IT IS COUNTER-INTUITIVE. Purple's
   * position is her FEET, and `logic.ts` puts her foot box three sixteenths of a tile ABOVE that
   * point: at the spawn her feet sit on y = (spawnY + 1) * 32 exactly, which is the top edge of row
   * spawnY + 1, and the box she is tested against spans y 660 to 672 -- entirely inside row spawnY.
   * So the row a due-east walker reads as a notice and the row she COLLIDES along are not the same
   * row, and the first version of this pass cleared only the latter. `map.test.ts` could not see it
   * either, because the notice test compares her feet against the rect and both notices span both
   * rows. `pnpm e2e` caught it: "Purple never reached both notices walking east", sixty seconds of
   * holding Right against something standing on row 20 where the track had just been leaned off it.
   *
   * Clearing both rows either side of the line costs eight tiles and is correct whatever the foot
   * box does next, which a single row derived from the current offset would not be.
   */
  const walkRows = [spawnY, spawnY + 1];
  let cleared = 0;
  for (const row of walkRows)
    for (let x = spawnX; x <= cx + 3; x++) {
      if (at(collision, x, row) === 0 || !fellable(x, row)) continue;
      clearArea(x, row, 1, 1);
      cleared++;
    }
  console.log(`  east walk: ${cleared} obstacle(s) cleared off rows ${walkRows.join(' and ')}`);

  /*
   * CONNECTIVITY. A dense wood is only a forest if you can walk through it.
   *
   * The density field plants trees wherever the field is willing, and it has no idea whether the
   * trunks it lays down happen to close a ring around a glade. Measured before this pass existed:
   * 49 per cent of the map solid, and only 67 per cent of the WALKABLE tiles reachable from the
   * spawn -- the other third sat in sealed pockets. Every named object stayed reachable, which is
   * why `apps/game/test/map.test.ts` passed throughout: it floods for object reachability, not for
   * whether the player has room. The end-to-end suite is what caught it, as five walk timeouts and
   * "Purple never reached both notices walking east".
   *
   * So rather than thin the whole wood -- which costs the density the board is made of, and a sweep
   * of the treeline threshold from 0.44 to 0.62 only moved solid from 49 to 44 per cent anyway --
   * this opens the specific walls that seal a pocket, and nothing else.
   *
   * For each unreachable pocket it runs a 0-1 breadth-first search outward: stepping onto open
   * ground costs nothing, cutting through a solid tile costs one. That finds the THINNEST wall
   * between the pocket and the reachable world, so the fewest possible trees come out, and they
   * come out where the wood was already narrowest -- which is where a gap looks natural.
   *
   * Felling is done with `clearArea`, so a tree is struck off the register with its crown: clearing
   * a trunk tile on its own would leave a crown hanging in the air and, worse, the invisible solid
   * tile this file warns about twice already.
   */
  /*
   * Every walkable tile Purple can reach on foot from the spawn.
   *
   * `floodPocket` below is the same breadth-first walk from an arbitrary seed, in the same
   * `NEIGHBOURS` order, so this is that walk seeded at the spawn rather than a second copy of it.
   * A private four-vector `STEPS` array stood above this and was `NEIGHBOURS` written out again;
   * the order matters to both -- it fixes BFS visit order -- which is exactly why one array for
   * both is safe and two are not.
   */
  const reachableFromSpawn = (): Set<number> => new Set(floodPocket(spawnY * MAP_W + spawnX));

  /*
   * ...AND ONE POCKET IT CANNOT OPEN MUST NOT ABANDON THE OTHER THIRTY.
   *
   * This loop used to `break` the moment a pocket defeated the search, which was survivable while
   * every wall on the map was two tiles of mid-tree thick. It is not survivable now. An elder's
   * trunk row is THREE tiles wide, so two overlapping elders make a wall six solid tiles deep, and
   * the search below gave up at four -- and because the first unsolvable pocket ended the whole
   * loop, one thick wall in the north-west left 235 walkable tiles sealed off in pockets all over
   * the map. The audit at the foot of the file failed the build on it, which is the system working;
   * but the fault was this loop treating "I cannot open THIS one" as "I cannot open any".
   *
   * So a pocket that defeats the search is recorded and skipped, and the loop carries on to the
   * next one. `givenUp` holds every tile of it, flooded from the seed, because the scan below picks
   * the first unreachable tile it finds and would otherwise offer the same pocket for ever.
   */
  const givenUp = new Set<number>();
  const floodPocket = (seed: number): number[] => {
    const seen = [seed];
    const mark = new Set([seed]);
    for (let head = 0; head < seen.length; head++) {
      const key = seen[head]!;
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || at(collision, nx, ny) !== 0) continue;
        const nk = ny * MAP_W + nx;
        if (mark.has(nk)) continue;
        mark.add(nk);
        seen.push(nk);
      }
    }
    return seen;
  };
  // --- the hem, a second time --------------------------------------------------------------------
  /*
   * AND THE TREELINE IS BROUGHT DOWN TO THE BAND AGAIN, for the same reason the seal runs twice.
   *
   * `breakHem` is called once up with the planting, where it belongs, and once here, where it
   * matters. Everything between the two FELLS: the shoreline sweep, the verge sweep and the east
   * walk all call `clearArea`, and `clearArea` strikes a tree off with its whole crown.
   * Instrumented, the first call found the east margin already 24 cells deep in canopy and so
   * planted nothing there -- and by the time the map was written, thirteen of those trees had been
   * felled by passes that had no idea they were holding up the edge of the world, so the band under
   * them fell back to scrub and printed as an eighteen-tile hedge down the right of the arrival
   * frame.
   *
   * IT RUNS IMMEDIATELY BEFORE THE CONNECTIVITY FLOOD, and that is the whole of why it is here
   * rather than beside the second seal. A tree on the margin stands on cells that are walkable --
   * the trunk of the tree covering column 59 is at column 58, inside the map -- so planting one can
   * close a pocket behind it. A first version ran after the flood and the generator's own audit
   * caught it at once: eleven walkable tiles sealed off from the spawn at (5,2), (58,16) and six
   * other places. Put in front of the flood, every pocket it makes is found and opened by the pass
   * that exists to do exactly that, and the audit is clean. The flood is also the last thing that
   * fells, so nothing after this can undo it.
   */
  const hemTreesLate = breakEveryHem(bandIsHedge, anyOver);

  console.log(`  hem: ${hemTrees} tree(s) with the planting, ${hemTreesLate} after the felling`);

  // --- connectivity: pockets opened --------------------------------------------------------------
  let felled = 0;
  for (let guard = 0; guard < 400; guard++) {
    const reachable = reachableFromSpawn();
    let pocket = -1;
    for (let y = 2; y < MAP_H - 1 && pocket < 0; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        const key = y * MAP_W + x;
        if (at(collision, x, y) === 0 && !reachable.has(key) && !givenUp.has(key)) {
          pocket = key;
          break;
        }
      }
    if (pocket < 0) break;

    // 0-1 BFS out of the pocket: free across open ground, one per solid tile cut through.
    const cost = new Map<number, number>([[pocket, 0]]);
    const from = new Map<number, number>();
    let front = [pocket];
    let next: number[] = [];
    let landed = -1;
    /*
     * Eight rings, not four. A ring is one solid tile cut through, and the thickest wall the wood
     * can now build is wider than it was: an elder occupies three columns of trunk, so two of them
     * side by side are six, and a mid tree leaning on the end of that is eight. Four rings found
     * the thinnest wall only when every wall was thin.
     */
    for (let ring = 0; ring <= 8 && landed < 0; ring++) {
      for (let head = 0; head < front.length && landed < 0; head++) {
        const key = front[head]!;
        const x = key % MAP_W;
        const y = (key - x) / MAP_W;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 1 || ny < 2 || nx >= MAP_W - 1 || ny >= MAP_H - 1) continue;
          const nk = ny * MAP_W + nx;
          const blocked = at(collision, nx, ny) !== 0;
          // Only a tree may be cut through, for the same reason the verge pass fells only trees:
          // the fence, the cottage wall, the river and the boulders are deliberate obstacles, and
          // the notice spanning the gate approach is the level's whole lesson. A pocket that can
          // only be opened by demolishing one of those is left closed and reported below.
          if (blocked && !fellable(nx, ny)) continue;
          const step = blocked ? 1 : 0;
          const total = cost.get(key)! + step;
          if (cost.has(nk) && cost.get(nk)! <= total) continue;
          cost.set(nk, total);
          from.set(nk, key);
          if (reachable.has(nk)) {
            landed = nk;
            break;
          }
          (step === 0 ? front : next).push(nk);
        }
      }
      if (landed >= 0) break;
      front = next;
      next = [];
    }
    // Nothing fellable stands between this pocket and the world. Record it whole and move on:
    // the audit below is what decides whether the map ships, and it needs to see every pocket.
    if (landed < 0) {
      for (const key of floodPocket(pocket)) givenUp.add(key);
      continue;
    }

    // Walk the path back and fell whatever was solid along it.
    let cursor: number | undefined = landed;
    let cut = 0;
    while (cursor !== undefined) {
      const x = cursor % MAP_W;
      const y = (cursor - x) / MAP_W;
      if (at(collision, x, y) !== 0) {
        clearArea(x, y, 1, 1);
        cut++;
      }
      cursor = from.get(cursor);
    }
    if (cut === 0) {
      for (const key of floodPocket(pocket)) givenUp.add(key);
      continue;
    }
    felled += cut;
  }

  // --- no tree stands in the river ----------------------------------------------------------------
  /*
   * ===========================================================================
   * NO TREE IN THE RIVER, AND NONE ON A BANK STEP. 2026-10-22, on the client's "look at all the
   * stones along the bank of the river, make sure there's no issues there".
   * ===========================================================================
   *
   * Walked bank by bank through `pnpm world`, the worst thing on the river was not a stone. It was
   * three trees in the south-west reach, where the water steps two columns a row: a sapling at
   * (16,36) whose trunk stood on a `shore-s` and whose whole crown -- a sapling's crown is the row
   * directly above its trunk -- sat on open water at (16-17,35), so a tree grew out of the middle of
   * the river with grey bank stones poking out either side of its roots; a mid tree at (18,36) with
   * half its crown on the water at (18-19,34); and a sapling at (20,29) with half of its on (21,28).
   * Counted off the shipped map, those three are the only trees with as much as half a crown over
   * water. The other two crowns that reach the water -- the west-bank elders at (22,17) and (21,35),
   * one quarter of nine each -- are a tree leaning over the edge, which is what a wooded bank looks
   * like, and they stay.
   *
   * And seven more stood with a trunk on a bank STEP or CORNER -- (11,35) (14,34) (18,32) (19,31)
   * (29,6) (10,39), and (21,23), the sapling the bridge join above grew on the new bank under the
   * deck. Those are the tiles the uncover pass calls the only waterline their water will ever get
   * (`soleShoreline`), and a trunk on one sits on the grey stones with the waterline showing in
   * slivers either side of its roots: the "stones overlapping water and grass edges" of the brief.
   * The uncover pass exempted trunks because a trunk is half transparent; that holds on a long bank
   * column, where the waterline runs on above and below, and not on a tile that IS the waterline.
   *
   * THE RULE, both halves read off the kind: half the crown or more on open water, so an elder's
   * corner leaning out is allowed and a sapling with one of its two crown cells on the water is not;
   * or any trunk cell on a `soleShoreline` tile. A trunk on a long bank column stays.
   *
   * WHY HERE, after the connectivity flood -- three positions were tried and measured:
   *  - refused inside `plantKind` from the start: it replanted the whole map. The undergrowth clumps
   *    draw `rnd()` once per frontier step and the frontier grows with every tree that took, so one
   *    refused sapling by the river moved every draw after it, and the arrival camera's top edge,
   *    thirty columns from any water, fell from 9 of 20 closed columns to 6 and failed its guard;
   *  - struck at the landmarks, past the last state-dependent draw (and again just above the second
   *    hem): no reshuffle, but trees struck that early are trees the later passes plan around. The
   *    mid at (32,8) and the elder at (20,35) are felled by the connectivity flood anyway; taking
   *    them first changed what the flood did, it stopped felling the elder above the waterfall at
   *    (33,4), and that elder's fully opaque middle quarter put blind cells at (34,2) (34,3) while
   *    (35,5) (35,6) opened onto another: 105 against `OPEN_ENOUGH`'s ratchet of 101, and 108 with
   *    the step half of the rule;
   *  - struck HERE, once every pass that fells has run and before the pass that seals what is left
   *    over: exactly the ten trees above, and the blind count stays at 101. Nothing after this line
   *    plants a tree, so nothing can put one back; audit 14 at the foot of the file says so.
   */
  const standsInRiver = (t: Tree): boolean =>
    t.k.crown.filter(([dx, dy]) => isWater(t.x + dx, t.y + dy)).length * 2 >= t.k.crown.length ||
    t.k.trunk.some((_n, dx) => soleShoreline(t.x + dx, t.y));
  {
    const struck: string[] = [];
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i]!;
      if (!standsInRiver(t)) continue;
      struck.push(`(${t.x},${t.y})`);
      strike(i);
    }
    console.log(
      `  river: ${struck.length} tree(s) struck from a bank step or from over open water` +
        (struck.length ? ` -- ${struck.join(' ')}` : ''),
    );
  }

  // --- pockets that would not open, sealed -------------------------------------------------------
  /*
   * WHAT IS LEFT OVER BECOMES THICKET, which is the honest answer rather than a patch.
   *
   * A pocket the search could not open is one the player can never stand in -- it is walled by the
   * river, the gorge, a building or the fence, none of which may be demolished. Measured after the
   * fix above, exactly one tile was in that state: (23,14), a notch of west bank with deep water on
   * one side and boulders on the others. A walkable tile nobody can walk to is not a feature, it is
   * a hole in the map, and leaving it walkable fails this file's own audit for good reason.
   *
   * So it is planted and made solid. That is not a fudge: a scrap of bank behind a boulder field,
   * drawn as scrub, is exactly what that tile is. Both halves matter -- planting without the
   * collision would be a bush the player walks through, and the collision without the planting
   * would be the invisible wall this file warns about three times.
   *
   * Objects are spared, and that is the safety catch rather than politeness: every named object is
   * asserted reachable a few lines below, so an unreachable one is a genuine defect that must
   * surface as itself. Sealing it would hide the defect under a bush.
   */
  if (givenUp.size > 0) {
    const occupied = new Set<number>();
    for (const o of objects) {
      if (o.name.startsWith('prop-')) continue;
      for (let y = Math.floor(o.y / TILE); y < Math.ceil((o.y + o.height) / TILE); y++)
        for (let x = Math.floor(o.x / TILE); x < Math.ceil((o.x + o.width) / TILE); x++)
          occupied.add(y * MAP_W + x);
    }
    let sealed = 0;
    for (const key of givenUp) {
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      if (occupied.has(key) || at(collision, x, y) !== 0) continue;
      if (at(below, x, y) === 0) set(below, x, y, gid(scrub(x, y)) + (heads(x, y, 1) ? FLIP_H : 0));
      solid(x, y);
      sealed++;
    }
    console.log(`  pockets: ${sealed} unreachable tile(s) planted over and sealed`);
  }

  // The last pass that can open a tile has run, so the edge of the world is re-sealed (see
  // `sealBorder`): felling a tree that straddles column 0 clears the border cell with it.
  sealBorder();

  // --- hem stones --------------------------------------------------------------------------------
  /*
   * ===========================================================================
   * AND THE LAST WORD ON THE HEM IS MATERIAL, NOT PLANTING.
   * ===========================================================================
   *
   * `breakHem` runs twice and both calls answer a long run of hedge by planting a TREE, which is
   * the right answer and cannot be the only one, because both calls run before the connectivity
   * flood and the flood is free to fell what they planted. On the east margin it reliably does: the
   * strip between the garden's far fence and the edge of the world is a dead end, a tree planted in
   * it seals that dead end, the flood opens it again by felling the tree, and `sealBorder` fills
   * the cell it vacated with scrub. The run comes back after every count has been taken, and the
   * build fails on a column that has nothing to do with whatever was changed. Three rounds.
   *
   * After the last seal the question is no longer what is SOLID -- every tile of the border band is
   * solid and stays solid -- it is only what is DRAWN. So the final break swaps material: a stone
   * where the hedge has run too long. It cannot seal a pocket, because it changes no collision; it
   * cannot be felled, because nothing fells after this; and it needs no neighbouring column to be
   * free, which was the whole of the fragility.
   */
  let hemStones = 0;
  for (const cells of [across(0), across(1), across(MAP_H - 1), down(0), down(MAP_W - 1)]) {
    let run = 0;
    for (const [x, y] of cells) {
      // No `&& !isTrunk(x, y)` clause: it stood here and could never fire. `SCRUB_GIDS` is the
      // three bush silhouettes and `TRUNK_GIDS` is every trunk tile of every scale, and the two
      // sets are disjoint by construction, so a gid that is in the first is never in the second.
      const drawnAsHedge = SCRUB_GIDS.has(at(below, x, y) & BASE_GID) && at(above, x, y) === 0;
      if (!drawnAsHedge || at(collision, x, y) === 0) {
        run = 0;
        continue;
      }
      run++;
      if (run <= HEM_RUN) continue;
      set(below, x, y, gid('rock'));
      hemStones++;
      run = 0;
    }
  }
  console.log(`  hem stones: ${hemStones} swapped into the border band where the hedge ran long`);

  const walkable = collision.filter((v) => v === 0).length;
  const open = reachableFromSpawn().size;
  console.log(
    `  connectivity: ${felled} tile(s) opened; ${open}/${walkable} walkable tiles reachable ` +
      `(${Math.round((open / walkable) * 100)}%)`,
  );

  // --- lone bushes and one-tile holes ------------------------------------------------------------
  /*
   * ===========================================================================
   * NO BUSH STANDS ALONE, AND NO SCRUB HAS A ONE-TILE HOLE IN IT.
   * ===========================================================================
   *
   * WHAT THIS IS FOR. `bush` is a fully opaque 32x32 with its own dark ground and a hard outline, so
   * a lone one is a dark disc on a lawn, and a dozen of them at a similar spacing is a polka dot --
   * the texture of mould, as the product manager's report put it, rather than undergrowth. Measured
   * on the committed map, 36% of the bushes visible on open ground had no bush on any of their four
   * sides, the mean mass was 1.8 tiles, and only a quarter of them stood in a mass of four or more.
   * The board has no lone discs at all: its scrub comes in masses of several tiles with ragged
   * edges, usually against a path edge, a fence or the foot of a tree.
   *
   * WHY IT IS DOWN HERE, past the audit's own section marker and everything else. Shape is the one
   * property of the undergrowth that no single pass can own: the forest floor, the open islands and
   * five `clump` calls each lay their own tiles without seeing the others, and then the landmarks
   * clear rectangles through the result, the garden plants a hedge, the banks strip cover off the
   * shoreline and the verge and connectivity sweeps fell whatever is in the way. Sitting beside the
   * `clump` calls -- which is where this started -- it answered three lone bushes out of
   * twenty-four, because the lattice the title camera actually shows is assembled by the passes
   * that come AFTER it. The mass the player looks at only exists once every one of them has
   * finished, so this is the first line at which it can be measured, and the last at which it can
   * be changed.
   *
   * IT IS SAFE BY CONSTRUCTION, which is the other half of why it can run after the collision layer
   * has been signed off. Everything it writes is decor and nothing calls `solid` or `clear`, so the
   * collision layer is bit-for-bit what the connectivity pass left: no pocket can be sealed, no
   * obstacle demolished, no reachability test disturbed, and `map.test.ts` -- which floods from the
   * spawn and checks that the notice cannot be walked around -- sees exactly the map it saw before.
   * It also never removes a tile, so no shoreline can be uncovered and no landmark undressed.
   */
  /**
   * A bush the player can actually see: one under a canopy is not part of the picture.
   *
   * Any of the three silhouettes counts. The fault this sweep answers is a shape -- a lone dark
   * mass on a lawn, or a one-tile hole punched in a mass -- and a shrub of a different footprint
   * beside a bush is still a mass with one outline. Asking only for `bush` would have left every
   * `bush-low` and `bush-tall` on the map reading as lonely to this pass, and would have answered
   * each of them with a companion they did not need.
   */
  const visibleBush = (x: number, y: number): boolean =>
    inside(x, y) && SCRUB_GIDS.has(at(below, x, y) & BASE_GID) && at(above, x, y) === 0;
  /**
   * Somewhere a soft bush may be added: empty, walkable-looking ground out in the open.
   *
   * The grass test is doing real work rather than being tidy. A shore tile that is the only
   * shoreline its water will get must not end up under an opaque tile -- the audit below fails the
   * build for it, because a waterline hidden under a bush is a hard seam between deep water and lit
   * grass. Requiring plain grass underneath excludes every shore, every path tile, the bridge and
   * the cottage floor in one test.
   */
  /*
   * ...AND NOT WHERE IT WOULD BE THE FOURTH IN A LINE, which is the same rule `tuft` carries and the
   * reason it cannot live only in `tuft`.
   *
   * This sweep runs last, it adds cover, and it chooses the free side with the MOST scrub around it
   * -- which is a rule for growing towards a mass and, where the mass is already a line, a rule for
   * lengthening the line. Traced during this round: the four-deep file at column 54 was the wall
   * bank's planting finished off by a companion this pass added underneath it, after every count the
   * banks had taken. The run cap is the same three as `tuft`'s, for the same reason, so a bed may be
   * a three-by-three mass and may not be a rule.
   */
  /*
   * ...AND NEVER UNDER ONE OF THE CAST, added 2026-10-25. The Gatekeeper stands on the verge west
   * of the bridge, a tile cleared out of a row of scrub (docs/GATEKEEPER.md), and to "close the
   * holes" below his cleared tile IS a hole -- so it planted a bush under his feet. Nobody in the
   * cast stood in a hedge row before, which is why nothing asked.
   */
  const castCells = new Set(
    objects
      .filter((o) => o.name.startsWith('npc-') || o.name.startsWith('bystander-'))
      .map((o) => (o.y / TILE) * MAP_W + o.x / TILE),
  );
  const mayBush = (x: number, y: number): boolean =>
    inside(x, y) &&
    !castCells.has(y * MAP_W + x) &&
    !onBorder(x, y) &&
    at(below, x, y) === 0 &&
    at(above, x, y) === 0 &&
    !isPath(x, y) &&
    !isWater(x, y) &&
    !inClearing(x, y) &&
    plantedRun(x, y, 1, 0) <= 3 &&
    plantedRun(x, y, 0, 1) <= 3 &&
    (TILE_NAMES[(at(ground, x, y) & BASE_GID) - 1] ?? '').startsWith('grass');
  const bushesBeside = (x: number, y: number): number =>
    NEIGHBOURS.filter(([dx, dy]) => visibleBush(x + dx, y + dy)).length;
  /** Planted already mirrored: the mirror pass is behind us, and an unflipped tile here is a seam. */
  const plantBush = (x: number, y: number): void =>
    set(below, x, y, gid(scrub(x, y)) + (heads(x, y, 1) ? FLIP_H : 0));

  /*
   * 1. CLOSE THE HOLES. A single tile of grass with scrub on three or four sides is not a glade, it
   * is a gap in a mass -- and because every tile here is the same opaque disc, a regular field of
   * one-tile gaps is exactly as conspicuous as a regular field of discs. Filling them merges
   * neighbouring discs into one region with one outline, which is both what the board shows and
   * what the edge-density axis wants: tiles that were each buying two high-contrast boundaries
   * start sharing them.
   *
   * TWO SHAPES COUNT AS A HOLE, and the first version only caught one of them. Three sides out of
   * four catches a bay bitten into the edge of a mass. It does not catch the shape that was
   * actually on the title screen, which is a single tile of grass with scrub directly above and
   * directly below it, or directly left and right, and nothing on the other pair: two neighbours,
   * not three -- a LADDER, and a ladder of identical discs at a fixed two-tile pitch is the exact
   * pattern the report called uncanny. A gap with cover on opposite sides is a gap whichever pair
   * of sides it is, so both count.
   *
   * COMPUTED OFF A SNAPSHOT AND THEN APPLIED, which is what keeps it bounded. Filling as it scans
   * lets one fill qualify the next, and on a chequer that cascades across a whole glade and carpets
   * it -- the failure this file's notes warn about twice. Deciding every cell against the state at
   * the START of the pass means one pass can only close the holes that were already there. Two
   * passes, because closing a hole can leave a real bay beside it.
   */
  let closed = 0;
  for (let pass = 0; pass < 2; pass++) {
    const fill: [number, number][] = [];
    for (let y = 2; y < MAP_H - 1; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!mayBush(x, y)) continue;
        const straddled =
          (visibleBush(x, y - 1) && visibleBush(x, y + 1)) ||
          (visibleBush(x - 1, y) && visibleBush(x + 1, y));
        if (bushesBeside(x, y) >= 3 || straddled) fill.push([x, y]);
      }
    for (const [x, y] of fill) plantBush(x, y);
    closed += fill.length;
    if (fill.length === 0) break;
  }

  /*
   * 2. ANSWER THE LONE ONES, which is the undergrowth's version of the sweep the trees already get
   * a thousand lines above -- and it is the same fault underneath: a field cut near its own
   * threshold plants one of a thing where it should plant three.
   *
   * IT ADDS AND NEVER REMOVES, and the first version of it got that wrong. Pulling a lone bush out
   * looked like the tidy answer and it cost 26 tiles of dark cover on a map whose deep shade is
   * 0.58 of the board's -- the axis that is furthest off. A companion fixes the shape and keeps the
   * tile, so it is the better trade wherever there is anywhere to put one, and out on grass there
   * always is. The lone ones with no free side are wedged against a trunk, a boulder, a wall or a
   * verge, which is exactly where the board puts its scrub, so those are left where they are.
   *
   * The companion goes on whichever free side already has the most cover around it, so a pair grows
   * towards the nearest mass rather than starting a second lone pair one tile over. Repeated,
   * because a companion can itself land lonely.
   */
  let joined = 0;
  let wedged = 0;
  for (let pass = 0; pass < 3; pass++) {
    let changed = 0;
    for (let y = 2; y < MAP_H - 1; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!visibleBush(x, y) || bushesBeside(x, y) > 0) continue;
        const spots = NEIGHBOURS.map(([dx, dy]) => [x + dx, y + dy] as const).filter(([nx, ny]) =>
          mayBush(nx, ny),
        );
        if (spots.length === 0) {
          if (pass === 0) wedged++;
          continue;
        }
        let best = spots[0]!;
        let bestScore = -1;
        for (const [nx, ny] of spots) {
          const score = bushesBeside(nx, ny);
          if (score > bestScore) {
            bestScore = score;
            best = [nx, ny];
          }
        }
        plantBush(best[0], best[1]);
        joined++;
        changed++;
      }
    if (changed === 0) break;
  }
  console.log(
    `  undergrowth: ${closed} hole(s) closed, ${joined} lone bush(es) given a companion, ` +
      `${wedged} left wedged against something`,
  );

  // --- the bank turns its corners ----------------------------------------------------------------
  /*
   * ===========================================================================
   * EVERY CORNER OF THE BANK GETS ITS CORNER TILE.
   * ===========================================================================
   *
   * The client, 2026-10-22, again: "look at all the stones along the bank of the river, make sure
   * there's no issues there". After the bridge join was fixed there were still two faults, and
   * they were the same fault -- the bank loop under the river asks a cell's four SIDES and nothing
   * else, and a diagonal river is a staircase, whose every step has two cells that question cannot
   * describe:
   *   - the NOSE of the step, land with water on two adjacent sides. It got `shore-w` or `shore-e`,
   *     whose lawn and boulders run the full height of the tile, so the strip of bank ran on into
   *     the open water of the next row and stopped at the tile edge: a square patch of water with a
   *     rock in it and no outline on its land side -- (32,8), (29,4), (33,2) at the waterfall head.
   *   - the INSIDE of the step, land whose water is only across a diagonal. It got grass, so the
   *     waterline of the two bank tiles beside it ran straight into a lit lawn square: the V-shaped
   *     inlet with a tile seam beside it, at (28,7) and on every step of the south-west reach.
   * Counted on HEAD (2b42743): 41 noses and 41 insides off the deck and the track.
   *
   * `bankFor` reads all eight neighbours and the eight corner tiles in `tiles/w-water.ts` draw what
   * it names. WHY IT RUNS HERE, at the bottom, and not in the bank loop: everything between there
   * and here reads the ground tile -- the planting passes ask for lawn, the uncover pass and the
   * river sweep ask for `shore` -- and several of them draw `rnd()` per cell they accept. Turning
   * forty-one cells of grass into bank at the top would move every draw after the first of them and
   * replant the wood. Here, it re-points ground tiles and nothing else, and the forest is the
   * forest it was. The dredge pass, directly below, then lifts any opaque cover off a new cove
   * exactly as it does off every other bank tile below the border band.
   *
   * WATER IS READ OFF THE DRAWN GROUND, not off `isWater` -- the waterfall is laid over the river's
   * geometry after the bank loop, and the deck covers it -- for the same reason audit 1 does.
   *
   * THE DECK AND THE TRACK ARE NOT BANKS and keep their own tiles: a plank or a cell of sand with
   * water across one corner is the crossing, and there is no path tile with a waterline in it.
   *
   * ONE SPIT IS FLOODED. A cell of land with water on two opposite sides, or on three, is a
   * one-tile finger of bank the tileset cannot draw -- its land would have to be thinner than the
   * bank's own profile -- and HEAD has exactly one, at (22,30), which drew as `shore-w` with its
   * lawn running into the water above and below it. It becomes river: ground `water`, solid. It is
   * a dead end with land on one side only, so no walk on the map runs through it and nothing is
   * reachable through it; the audit's flood says so. A spit carrying anything -- decor, a crown,
   * one of the cast -- is refused loudly instead, because flooding it would drown something.
   */
  {
    const DRAWN_WET = new Set(['water', 'water-2', 'waterfall']);
    const wetCell = (x: number, y: number): boolean => DRAWN_WET.has(nameAt(ground, x, y));
    const isBankable = (x: number, y: number): boolean => {
      const here = nameAt(ground, x, y);
      return here.startsWith('grass') || here.startsWith('shore');
    };
    const castAt = (x: number, y: number): boolean =>
      objects.some(
        (o) =>
          (o.name.startsWith('npc-') || o.name.startsWith('bystander-')) &&
          Math.floor(o.x / TILE) === x &&
          Math.floor(o.y / TILE) === y,
      );
    const flooded: [number, number][] = [];
    for (let changed = true; changed;) {
      changed = false;
      for (let y = 0; y < MAP_H; y++)
        for (let x = 0; x < MAP_W; x++) {
          if (!isBankable(x, y)) continue;
          const n = wetCell(x, y - 1);
          const s = wetCell(x, y + 1);
          const e = wetCell(x + 1, y);
          const w = wetCell(x - 1, y);
          if (!((n && s) || (e && w))) continue;
          if (at(below, x, y) !== 0 || at(above, x, y) !== 0 || castAt(x, y))
            throw new Error(
              `the bank at (${x},${y}) is a one-tile spit with water on opposite sides, and it ` +
                `carries something, so it cannot be flooded. The tileset has no tile for a spit.`,
            );
          set(ground, x, y, gid('water'));
          solid(x, y);
          flooded.push([x, y]);
          changed = true;
        }
    }
    /*
     * A cell under a crown quarter opaque in every pixel is not drawn at all -- `decor-above` covers
     * it edge to edge -- so its ground is left as it is. Re-pointing it would change nothing anybody
     * sees and would cost a real fault: the dredge below lifts cover off every bank tile, and the
     * one such cell on HEAD, (24,33), is a boulder under an `elder-mc`. Lifted, it is a walkable
     * cell Purple vanishes on, which is the ratchet in audit 12 going up by one.
     */
    const blind = new Map<string, boolean>();
    const hiddenUnder = (x: number, y: number): boolean => {
      const over = nameAt(above, x, y);
      if (over === '') return false;
      let known = blind.get(over);
      if (known === undefined) {
        const img = new Img(TILE, TILE);
        TILE_PAINTERS[over]!(img);
        known = true;
        for (let i = 3; i < img.data.length && known; i += 4)
          if (img.data[i] !== 255) known = false;
        blind.set(over, known);
      }
      return known;
    };
    const turned: Record<string, number> = {};
    let unseen = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (!isBankable(x, y)) continue;
        const bank = bankFor((dx, dy) => wetCell(x + dx, y + dy));
        if (bank === 'unresolved')
          throw new Error(
            `the bank at (${x},${y}) has a water neighbourhood no tile in the set can draw ` +
              `(water on a corner the wet side does not reach). See bankFor.`,
          );
        if (bank === null) {
          if (nameAt(ground, x, y).startsWith('shore'))
            throw new Error(`(${x},${y}) is a bank with no water beside it`);
          continue;
        }
        if (nameAt(ground, x, y) === bank) continue;
        if (hiddenUnder(x, y)) {
          unseen++;
          continue;
        }
        set(ground, x, y, gid(bank));
        turned[bank] = (turned[bank] ?? 0) + 1;
      }
    const total = Object.values(turned).reduce((p, q) => p + q, 0);
    console.log(
      `  corners: ${total} bank tile(s) re-pointed from the full neighbourhood (` +
        Object.entries(turned)
          .sort()
          .map(([k, v]) => `${k} ${v}`)
          .join(', ') +
        `); ${unseen} left as drawn under a fully opaque crown; ${flooded.length} spit(s) flooded` +
        (flooded.length ? ` -- ${flooded.map(([x, y]) => `(${x},${y})`).join(' ')}` : ''),
    );
  }

  // --- nothing grows in the river or on the road -------------------------------------------------
  /*
   * ===========================================================================
   * THE LAST PASS THAT WRITES A TILE: OPAQUE DECOR COMES OFF THE WATER AND OFF THE SAND.
   * ===========================================================================
   *
   * Counted off the shipped map, twenty-four cells stood a bush, a boulder or a flower bed on
   * water, a waterfall, a shoreline or the track. The three on sand are the ones a player meets at
   * reading distance: `flower-pink` at (52,20) and (52,21) is a flower bed growing out of the lane
   * TWO TILES FROM GRANDMA'S DOOR, in the frame the whole game walks towards, and `flower-white` at
   * (34,24) is another in the middle of the south fork.
   *
   * THREE PASSES PUT THEM THERE AND NONE OF THEM IS WRONG ON ITS OWN, which is why this is a sweep
   * and not three edits:
   *   - `sealBorder` plants the band on rows 0, 1 and 41 wherever `below` is empty. It already
   *     steps over the waterfall, and it did not step over the water, so the reach where the river
   *     leaves the map carried five bushes and boulders STANDING ON OPEN WATER along the bottom of
   *     the frame and three more along the top, which is the title camera's own top edge.
   *   - the bank scree runs before the seal, so where it has already dropped a boulder the seal
   *     finds `below` occupied and leaves it -- which is how `rock` came to stand on the waterfall
   *     at (32,0) and (32,1) despite the seal's exception for it.
   *   - the undergrowth and the lane dressing between them put a flower bed on three tiles of sand.
   *
   * WHAT THIS DOES NOT TOUCH: a shoreline. `shore-*` has its own pass five hundred lines up, with
   * its own reasoning -- a step or a corner is uncovered because nothing else can carry its
   * waterline, the middle of a long bank column is LEFT covered because the boulder reads as
   * standing in the gorge the board draws, and the border is left alone because a shoreline the
   * player can see and cannot walk onto is worse than one under a bush. Eleven of the twenty-four
   * are shore tiles held by those three rules and they stay; audit 9 permits them by name and
   * counts them, so the number is on the run rather than in a comment.
   *
   * (SUPERSEDED IN PART, 2026-10-22: it now DOES lift cover off a bank tile below the border band
   * -- the "middle of a long bank column" rule is reversed, see the note at `onBank` below. The
   * border rule stands -- and since later the same day the border's banks keep their cover as a
   * SEALED bank rather than as a square of lawn; see the note below `byDeck`, and audit 9b.)
   *
   * It is the LAST writer on purpose. Every earlier position for it loses: `sealBorder` runs twice
   * and the second call is below the connectivity flood, the hem-stone swap is below that, and the
   * lone-bush pass above plants a companion beside whatever it finds. A clearing pass that anything
   * can replant behind is a clearing pass that reports a number nobody can trust.
   */
  {
    const WET_GROUND = new Set(['water', 'water-2', 'waterfall'].map(gid));
    const dredged: [number, number][] = [];
    const sealedBanks: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const standing = nameAt(below, x, y);
        if (!OPAQUE_FLOOR.has(standing)) continue;
        const floor = at(ground, x, y) & BASE_GID;
        const onWater = WET_GROUND.has(floor);
        const onSand = (TILE_NAMES[floor - 1] ?? '').startsWith('path');
        /*
         * ...AND OFF EVERY BANK TILE BELOW THE BORDER BAND, 2026-10-22, which reverses half of the
         * uncover pass's third rule. That rule left a bush or a boulder standing in the middle of a
         * long `shore-w`/`shore-e` column, on the argument that the waterline above and below carries
         * the river and the boulder "reads as standing in the gorge". Walked through `pnpm world` on
         * the client's "look at all the stones along the bank", it does not read that way: every
         * cover tile here paints its own full 32x32 of lawn, so what it draws is a square of grass
         * bitten out of the stone bank with deep water meeting it across a straight tile edge --
         * (29,17) beside the bridge, (29,12) above it, (11,36) and (30,5) further off. A bank tile
         * is walkable land, so the cell gets its collision back with its tile.
         *
         * THE BORDER BAND KEEPS ITS COVER, for the uncover pass's own reason, which still holds: the
         * seal is solid scrub so the player cannot see the end of the world, and a bank she can see
         * and cannot walk onto at the top of the frame is an invisible wall. What the cover DRAWS
         * there changed later the same day: see the sealed banks below.
         */
        const onBank = (TILE_NAMES[floor - 1] ?? '').startsWith('shore') && !onBorder(x, y);
        /*
         * ...AND NO BOULDER TOUCHES THE DECK, corner or edge. The scree is laid by a field that knows
         * nothing about the crossing, and it put a boulder at (29,22), hard against the planks' south-
         * east corner and the bank stones under them: three kinds of grey edge meeting in one tile, at
         * the one spot of the river every player stands on. The client's "make it a little cleaner"
         * there is this tile as much as the join. Lifted here, by the last writer, rather than refused
         * in the scree pass, because a cell the scree leaves empty is a cell the undergrowth frontier
         * can grow into, and that frontier draws `rnd()` per step -- see the river sweep's note.
         */
        const byDeck =
          standing === 'rock' &&
          [...NEIGHBOURS, [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) =>
            nameAt(ground, x + dx!, y + dy!).startsWith('bridge'),
          );
        /*
         * ...AND ON THE BORDER BAND THE COVER STAYS, BUT IT IS DRAWN AS THE BANK, 2026-10-22.
         *
         * The client, on the river where it crosses the top and bottom rows: "water meets hedge or
         * rock with a hard edge" -- (31,0), (35,0), (30,1), (29,0), (27,1), (36,1) and (15,41),
         * (16,41). The band's reason for keeping its cover still holds (a bank she can see and cannot
         * walk onto is an invisible wall), so the cell stays solid and stays covered; what changes
         * is the cover. Every one of the band's cover tiles paints a full 32x32 of lawn, so the river
         * ran into a square of grass across the tile edge with its foam and keyline underneath it.
         * The sealed bank (`bank-stones-*`, "THE SEALED BANKS" in `tiles/w-water.ts`) is the bank
         * itself, identical on every edge, with stones piled on its lawn: the waterline comes back,
         * and the stones are what say the cell is not ground to stand on. Audit 9 now fails on any
         * bank under opaque cover anywhere, and audit 9b holds the sealed banks to the band.
         */
        const bankName = TILE_NAMES[floor - 1] ?? '';
        if (bankName.startsWith('shore') && onBorder(x, y)) {
          set(below, x, y, gid(SEALED_BANK[bankName]!) + ((at(ground, x, y) >>> 0) - floor));
          sealedBanks.push([x, y]);
          continue;
        }
        if (!onWater && !onSand && !onBank && !byDeck) continue;
        set(below, x, y, 0);
        /*
         * The collision goes with the tile. `rock` is in `MUST_STOP_HER`, so leaving the cell solid
         * with nothing drawn on it is the invisible wall this file fails the build for -- except on
         * water, which is impassable in its own right and which the solid-and-undrawn audit already
         * exempts, so the river keeps its barrier and the sand gets its lane back.
         */
        if (!onWater) clear(x, y);
        dredged.push([x, y]);
      }
    console.log(
      `  dredged: ${dredged.length} opaque tile(s) lifted off water, waterfall, sand or bank` +
        (dredged.length ? ` -- ${dredged.map(([x, y]) => `(${x},${y})`).join(' ')}` : ''),
    );
    console.log(
      `  sealed: ${sealedBanks.length} border-band bank(s) drawn as the bank with stones on it` +
        (sealedBanks.length ? ` -- ${sealedBanks.map(([x, y]) => `(${x},${y})`).join(' ')}` : ''),
    );
  }

  /*
   * ===========================================================================
   * SECOND PASS: THE CAST STOPS HER, AND THREE HOLES CLOSE. The last writer, by design.
   * ===========================================================================
   *
   * WHY IT IS DOWN HERE rather than beside the placements it corrects. Everything above this line
   * either plants or fells, and three of those passes call `clearArea`, which clears collision:
   * the verge sweep, the east-walk sweep and the connectivity flood. A cell made solid at the top
   * of the file is a cell any of them may hand straight back, silently, which is precisely how the
   * second hole below opened in the first place. Nothing below this block writes a tile, so what
   * is laid here is what ships -- and every invariant the audit measures is measured AFTER it.
   *
   * `sealCell` is the pocket pass's own two-liner (see "WHAT IS LEFT OVER BECOMES THICKET"): plant
   * where nothing is drawn, then make solid. Both halves or neither -- planting without collision
   * is a bush you walk through, collision without planting is the invisible wall this file fails
   * the build for.
   */
  const sealCell = (x: number, y: number): void => {
    if (at(below, x, y) === 0) set(below, x, y, gid(scrub(x, y)) + (heads(x, y, 1) ? FLIP_H : 0));
    solid(x, y);
  };

  /*
   * 1. NOBODY IN THE CAST IS A GHOST.
   *
   * Measured in the running game: Purple walks through all seven of them -- three travellers and four
   * bystanders -- and is drawn INSIDE them at equal depth on the way past, because the cast is
   * seated by `npc()`/`bystander()`, both of which call `clearArea` and so leave the cell open. A
   * character you walk through is not a character standing there; it is a decal.
   *
   * The spawn cell becomes solid. Talking survives it: `INTERACT_RADIUS` is 48px against a 32px
   * tile, so Purple standing in the next cell is 32px from the spawn centre (40px approaching from
   * the south, where her feet sit a row below her tile) and well inside reach. `map.test.ts`
   * asserts that rather than leaving it to this comment.
   *
   * Nothing is planted under them: the scene draws the figure on that cell, so it is the one kind
   * of solid-and-undrawn cell that is not an invisible wall. Audit 3 is told about them by name.
   */
  const castTiles = new Set<number>();
  for (const o of objects) {
    if (!o.name.startsWith('npc-') && !o.name.startsWith('bystander-')) continue;
    const x = Math.floor(o.x / TILE);
    const y = Math.floor(o.y / TILE);
    castTiles.add(y * MAP_W + x);
    solid(x, y);
  }

  /*
   * 2. SHE CANNOT STAND ON GRANDMA'S ROOF.
   *
   * The facade is solid over the roof and wall courses and NOT over the row above them, where only
   * the gable and the chimney stand -- which leaves the two columns between and beside them open:
   * one-tile alcoves wedged into the building's own silhouette, reachable from the garden strip
   * behind the house and from the alley between the house and the west fence. Driven to them in
   * the running game at 1280x860, Purple is drawn standing on the ridge with the gable at her elbow
   * and the chimney smoking beside her head, in the frame every player ends the game on.
   *
   * The whole bounding box of the building is solid, gable row included, and that is the invariant
   * rather than two coordinates: she cannot be inside the house. Nothing about the PICTURE changes
   * -- the tileset has no tile for the sky beside a gable and inventing one is the cottage owner's
   * call, not this file's -- so audit 3 is told about these cells too, by the same derivation.
   */
  const facadeCells = new Set<number>();
  for (let y = roofTop - 1; y <= doorstep; y++)
    for (let x = cx; x < cx + FACADE_W; x++) {
      facadeCells.add(y * MAP_W + x);
      solid(x, y);
    }

  /*
   * 3. THE ENCLOSURE'S NORTH RAIL REACHES THE EDGE OF THE WORLD AGAIN.
   *
   * The fence pass seals both enclosure rows from `gardenEast` out to the map edge and plants
   * scrub on the cells past the corner post, exactly so the garden cannot be entered round the
   * end of the rail. On the shipped map (58,11) was open and bare: the connectivity flood had cut
   * it. It is not a bug in the flood -- scrub is `fellable` by design, the flood found two
   * walkable tiles at (58,12) and (58,13) sealed in behind the rail by the east fence posts and a
   * trunk, and it opened the thinnest wall it could find, which was the rail's own scrub.
   *
   * So the rail is re-laid after the last pass that can cut it, and the dead end it closes is
   * sealed with it. The second loop is deliberately not "seal (58,12) and (58,13)": it floods from
   * the spawn and seals what the rail actually cut off, in the margin columns only. A column that
   * is still reachable from the garden is left alone, and anything stranded anywhere else stays
   * stranded for the audit below to fail on, which is where a surprise belongs.
   *
   * What this buys is not the two tiles. It is that the garden's east side stops depending on a
   * TREE: with the gap open, felling the trunk at (58,14) -- which every planting pass in this
   * file is free to do -- would have opened a way into the garden that skips the notice post, and
   * the audit watches the gate tiles rather than the garden, so nothing would have said so.
   */
  for (let x = gardenEast + 1; x < MAP_W; x++) sealCell(x, gardenTop);
  let behindTheRail = 0;
  {
    const reached = reachableFromSpawn();
    for (let x = gardenEast + 1; x < MAP_W; x++)
      for (let y = 0; y < MAP_H; y++) {
        if (at(collision, x, y) !== 0 || reached.has(y * MAP_W + x)) continue;
        sealCell(x, y);
        behindTheRail++;
      }
  }

  /*
   * 4. AND NOTHING GROWS IN THE MIDDLE OF THE ROAD.
   *
   * The edge pass bites tiles out of the carriageway so the sand does not run with a ruled edge,
   * and a bitten cell is still ROAD -- path to its east and path to its west -- it is just drawn
   * as grass. The dressing pass reads the ground tile, sees lawn, and plants on it. While the
   * snail was standing on (41,20) nothing showed; the moment he moved to a real verge a flower bed
   * came up in the gap, on the one row a player who only ever holds Right walks down.
   *
   * It is the same predicate as the one `bystander` refuses a spawn on, applied to planting rather
   * than to people, and it is deliberately bounded to the walk rows between the spawn and the door
   * lane -- the stretch audit 2a already treats as load-bearing. There are two more bitten cells
   * carrying a bush elsewhere on the map, at (18,19) and (4,21); they are off that stretch, they
   * are nobody's regression, and widening a rule to sweep them up is how a map round turns into an
   * art round. The next owner has the measurement and can decide.
   *
   * `below` only. A crown on `above` belongs to a tree standing beside the road, which is the wood
   * doing its job, and clearing half of one is how this file gets a crown with no tree under it.
   */
  let weeded = 0;
  for (const row of walkRows)
    for (let x = spawnX; x <= cx + 3; x++) {
      if (isPath(x, row) || !isPath(x - 1, row) || !isPath(x + 1, row)) continue;
      if (at(below, x, row) === 0) continue;
      set(below, x, row, 0);
      weeded++;
    }

  /*
   * 5. GRANDMA'S MAILBOX, laid last so no planting pass can put a bush on it, and solid because it
   * is a post: a thing in the way, on MUST_STOP_HER below. See its landmark for why it stands here.
   */
  {
    const mx = Math.floor(landmarks['mailbox']!.x / TILE);
    const my = Math.floor(landmarks['mailbox']!.y / TILE);
    set(below, mx, my, gid('mailbox'));
    set(above, mx, my, 0);
    solid(mx, my);
  }

  /*
   * 6. THE NOTICE'S SECOND HALF AND THE TWO CYERA SIGNS, laid last for the mailbox's reason -- no
   * planting pass may put a bush or a crown over a sign -- and for the one recorded at their
   * landmarks: laid any earlier, they move the wood. Every cell is read back off its landmark, so
   * the landmark is the one place a sign's position is written.
   *
   * THE SAPLING UNDER THE NOTICE'S EAST HALF IS FELLED BY HAND, because the register's own felling
   * (`clearArea`) runs before the canopy rebuild and would move it. Its two crown cells go back to
   * open sky and its west trunk is the notice. Its EAST trunk cell (45,19) STAYS SOLID and becomes a
   * boulder: opened, it would be a new way down from the lawn north of the gate approach onto the
   * road, a shorter walk to the cottage than the one `packages/core`'s clock test measures the tour
   * on, and the signs must not move that clock. A boulder is on MUST_STOP_HER, so it is drawn as the
   * thing that stops her.
   */
  {
    const nx = Math.floor(landmarks['notice-post-r']!.x / TILE);
    const ny = Math.floor(landmarks['notice-post-r']!.y / TILE);
    for (const dx of [0, 1]) set(above, nx + dx, ny - 1, 0);
    set(below, nx + 1, ny, gid('rock'));
    set(above, nx + 1, ny, 0);
    solid(nx + 1, ny);
  }
  for (const [name, tile] of [
    ['notice-post-r', 'notice-board-r'],
    ['sign-dead-end', 'sign-dead-end'],
    ['sign-logo', 'sign-logo-l'],
    ['sign-logo-r', 'sign-logo-r'],
  ] as const) {
    const sx = Math.floor(landmarks[name]!.x / TILE);
    const sy = Math.floor(landmarks[name]!.y / TILE);
    set(below, sx, sy, gid(tile));
    set(above, sx, sy, 0);
    solid(sx, sy);
  }

  /*
   * 7. THE DRAWBRIDGE, RAISED (2026-10-25, docs/GATEKEEPER.md as the client revised it), laid last
   * for the signs' reason: `bridge-gate-shut-<n>` on `decor-below` over every cell of the span, and
   * NOT made solid. `ground` keeps the lowered deck (`bridge-l/m/r`), which is exactly what each
   * `bridge-gate-open-<n>` paints, so the game's swap shows the bridge every deck guard above already
   * holds. The collision layer says the span is walkable because, once the key is taken, it is; the
   * game holds the cells shut until then. `clear` is said again so that stays true whatever a later
   * pass is taught to do.
   */
  for (const y of bridgeRows)
    for (let x = gateX; x <= spanX1; x++) {
      set(below, x, y, gid(`bridge-gate-shut-${spanKind(x)}`));
      set(above, x, y, 0);
      clear(x, y);
    }

  console.log(
    `  second pass: ${castTiles.size} of the cast made solid, the facade's gable row closed, ` +
      `${behindTheRail} tile(s) sealed behind the enclosure's north rail, ` +
      `${weeded} planted cell(s) lifted out of the carriageway`,
  );

  // --- THE AUDIT. Nothing below writes a tile ----------------------------------------------------
  /*
   * ===========================================================================
   * THE TRAVERSAL AND SHORELINE AUDIT, checked rather than hoped for.
   * ===========================================================================
   *
   * WHY IT IS HERE AND NOT ONLY IN A TEST. `apps/game/test/map.test.ts` is the safety net for the
   * committed map and it floods from the spawn, so it catches a map that drifted from the
   * generator. It cannot catch a GENERATOR that writes a bad map: it reads what this file produced
   * and the bad map is what it reads. Everything below is a property of this file's own passes, so
   * this file is where it fails -- loudly, at `pnpm graybox`, before the map reaches the repo.
   *
   * Each of these has a bug behind it that shipped:
   *   - the shoreline, which stopped dead in 29 places because the bank pass tested two neighbours;
   *   - 61 tree trunks you could walk through and 17 boulders you could walk through, because a
   *     comparison forgot the mirror bits and because the dressing drew stone it did not mean;
   *   - a walkable tile on the map border, from a felled tree straddling column 0;
   *   - and the notice post, which a verge pass once walked round by clearing a panel of fence.
   *
   * The last one is the level's whole zero-click lesson, so it is asserted twice on purpose: here,
   * where the fence and the collision layer are built, and again in `map.test.ts` against the
   * shipped artefact.
   */
  const walkableAt = (x: number, y: number): boolean => inside(x, y) && at(collision, x, y) === 0;
  const faults: string[] = [];
  /*
   * Numbers an audit MEASURED and did not fail on, printed whether or not anything fired.
   *
   * Three of the audits below are ratchets pinned to a figure the map currently produces, and the
   * whole value of a ratchet is that the next owner can see the figure MOVE. A guard that only
   * speaks when it fails tells you nothing on the run where the number drifted one tile closer to
   * its bound, which is the run where it was cheap to look.
   */
  const verdictLines: string[] = [];
  const fault = (what: string, where: [number, number][]): void => {
    if (where.length === 0) return;
    const shown = where
      .slice(0, 8)
      .map(([x, y]) => `(${x},${y})`)
      .join(' ');
    faults.push(`${where.length} ${what}: ${shown}${where.length > 8 ? ' ...' : ''}`);
  };

  /*
   * 1. NO BANK ENDS IN MID-AIR. Water may meet the deck or the waterfall -- a bridge crosses water
   * and the fall IS water. Water meeting GRASS is the bank that stopped.
   *
   * ...AND NO LONGER THE TRACK, since 2026-10-22. This used to allow "the ford west of the deck",
   * the one place the sand met the river, because a shore tile there would break the bridge
   * approach. The ford was never a ford: it was the river taking its three-column step directly
   * under the deck (the JOIN note on `riverCentre`), which left the sand at (22,21) and (23,21)
   * meeting open water across a bare tile edge. With the join a staircase, the water clears the
   * track everywhere but under the planks, so sand against water is now a fault like grass.
   *
   * THE WET SIDE IS READ OFF THE DRAWN GROUND, not off `isWater`. `isWater` is the river's
   * geometry, and the geometry runs on under the deck; so `shore-s` at (27,22) and (28,22), drawing
   * a waterline against the underside of the planks with no water there to draw, passed this for as
   * long as it shipped. That pair was the "little rocks under the bridge" the client circled.
   */
  const DRAWN_WET = new Set(['water', 'water-2', 'waterfall']);
  const bare: [number, number][] = [];
  const forded: [number, number][] = [];
  const miszoned: [number, number][] = [];
  const smothered: [number, number][] = [];
  const shores: Record<string, number> = {};
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const here = nameAt(ground, x, y);
      if (here.startsWith('shore')) {
        shores[here] = (shores[here] ?? 0) + 1;
        // The side in the name is the land, so the water must be on the other one -- both other
        // sides for a point, and for a cove the one corner its name gives the water.
        const wetSide: Record<string, [number, number][]> = {
          'shore-w': [[1, 0]],
          'shore-e': [[-1, 0]],
          'shore-n': [[0, 1]],
          'shore-s': [[0, -1]],
          'shore-nw': [
            [1, 0],
            [0, 1],
          ],
          'shore-ne': [
            [-1, 0],
            [0, 1],
          ],
          'shore-sw': [
            [1, 0],
            [0, -1],
          ],
          'shore-se': [
            [-1, 0],
            [0, -1],
          ],
          'shore-cove-nw': [[-1, -1]],
          'shore-cove-ne': [[1, -1]],
          'shore-cove-sw': [[-1, 1]],
          'shore-cove-se': [[1, 1]],
        };
        const wants = wetSide[here];
        if (!wants || wants.some(([dx, dy]) => !DRAWN_WET.has(nameAt(ground, x + dx, y + dy))))
          miszoned.push([x, y]);
        // A one-tile step has nothing either side to carry the waterline, so an opaque tile on it
        // hides the whole shoreline and the seam is bare again however good the ground tile is.
        if (!onBorder(x, y) && soleShoreline(x, y) && OPAQUE_FLOOR.has(nameAt(below, x, y)))
          smothered.push([x, y]);
      }
      if (
        here.startsWith('path') &&
        NEIGHBOURS.some(([dx, dy]) => DRAWN_WET.has(nameAt(ground, x + dx, y + dy)))
      )
        forded.push([x, y]);
      if (!here.startsWith('grass') || isWater(x, y)) continue;
      if (NEIGHBOURS.some(([dx, dy]) => isWater(x + dx, y + dy))) bare.push([x, y]);
    }
  fault('grass tile(s) meeting the water with no shore on them', bare);
  fault('track tile(s) meeting the water off the deck, with no bank between', forded);
  fault('shore tile(s) with the water on the wrong side', miszoned);
  fault('shoreline(s) with no second tile to carry them, hidden under an opaque tile', smothered);

  // 2. EVERY WALKABLE TILE IS REACHABLE, and nothing walkable is in the river or over the edge.
  const stranded: [number, number][] = [];
  const inTheRiver: [number, number][] = [];
  const onTheEdge: [number, number][] = [];
  const reached = reachableFromSpawn();
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!walkableAt(x, y)) continue;
      if (!reached.has(y * MAP_W + x)) stranded.push([x, y]);
      const g = nameAt(ground, x, y);
      if (g === 'water' || g === 'water-2' || g === 'waterfall') inTheRiver.push([x, y]);
      if (x === 0 || y === 0 || y === 1 || x === MAP_W - 1 || y === MAP_H - 1)
        onTheEdge.push([x, y]);
    }
  fault('walkable tile(s) sealed off from the spawn', stranded);
  fault('walkable tile(s) standing in the water', inTheRiver);
  fault('walkable tile(s) on the border of the map', onTheEdge);

  /*
   * 2a. A PLAYER WHO ONLY EVER HOLDS RIGHT CAN STILL GET THERE. See the pass that clears this row:
   * `overlaps` is a point test on her feet, so this one row is the whole of her journey, and a
   * single solid tile on it between the spawn and the door lane costs her both notices and the
   * ending. A flood fill cannot see it -- the map stays perfectly connected around any obstacle --
   * which is why this is asserted as a row rather than as reachability.
   */
  const barred: [number, number][] = [];
  for (const row of walkRows)
    for (let x = spawnX; x <= cx + 3; x++) if (!walkableAt(x, row)) barred.push([x, row]);
  fault('tile(s) stopping a due-east walk from the spawn to the door lane', barred);

  /*
   * 3. WHAT IS DRAWN AND WHAT IS SOLID AGREE. A trunk or a boulder you can walk through, and a
   * solid tile with nothing drawn on it, are the same bug seen from either side.
   */
  /*
   * Everything drawn as a thing you walk round. `bush` is deliberately not on this list and cannot
   * be: the sealed border and `clump(..., true)` plant it solid while the forest floor plants it
   * soft, on purpose, so the same picture means two different things depending on where it stands.
   * That is a real ambiguity and a design decision, not something a generator can assert its way
   * out of -- it is written up in the review notes rather than fixed here.
   */
  const MUST_STOP_HER = new Set([
    // Every trunk tile of every scale. A sapling's bottom row carries its bark, so it stops her
    // too: the rule here is what is DRAWN, and a shrub-sized tree is still drawn as a tree.
    ...Object.values(KINDS).flatMap((k) => k.trunk),
    'rock',
    // The sealed banks: a bank drawn with stones piled on it, laid only on the border band.
    ...Object.values(SEALED_BANK),
    'fence-h',
    'fence-post',
    'fence-corner',
    // The two corner posts with a rail stub, and the three tiles that gave the cottage an outline.
    // Every one of them is drawn as part of a barrier or a building, so every one of them stops her;
    // a new tile that is solid and not on this list is exactly the hole this audit exists to catch.
    'fence-corner-e',
    'fence-corner-w',
    'wall',
    'wall-corner',
    'wall-window',
    'wall-window-lit',
    'gable',
    'door',
    // The door with Grandma's note on it, and the forest notice. Both are a thing in the way and
    // both are new this round, which is exactly the shape of hole this list exists to close.
    'door-note',
    'notice-board',
    // Grandma's mailbox, 2026-10-23: a post, so a thing in the way.
    'mailbox',
    // The forest notice's second half and the two Cyera signs, 2026-10-23: posts and stakes.
    'notice-board-r',
    'sign-dead-end',
    'sign-logo-l',
    'sign-logo-r',
    'roof-l',
    'roof-m',
    'roof-r',
    'roof-peak',
    'chimney',
    'stall-counter',
    'stall-counter-l',
    'stall-counter-r',
    'well',
    'fountain',
    'signpost',
    'lantern-post',
  ]);
  const soft: [number, number][] = [];
  const undrawn: [number, number][] = [];
  const hanging: [number, number][] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const b = nameAt(below, x, y);
      if (MUST_STOP_HER.has(b) && walkableAt(x, y)) soft.push([x, y]);
      const g = nameAt(ground, x, y);
      const wetTile = g === 'water' || g === 'water-2' || g === 'waterfall';
      /*
       * TWO CELLS THIS AUDIT MUST NOT FIRE ON, both from the second pass above, both solid with
       * nothing laid on them and neither an invisible wall. The exemption is narrow on purpose:
       * it is two derived SETS, not a coordinate list, so it cannot quietly grow to cover a third
       * kind of hole.
       *   - a cell the cast stands on. The scene draws a traveller or a bystander there, which is
       *     the thing that stops her; a tile under his feet would be a bush he is standing in.
       *   - the facade's own bounding box. The gable row steps -- the building is drawn as a
       *     gable and a chimney on that row and the tileset has no tile for the sky between them
       *     -- and what stops her at the step is the house she can see, one cell either side and
       *     one below.
       */
      const partOfSomethingDrawn = castTiles.has(y * MAP_W + x) || facadeCells.has(y * MAP_W + x);
      if (
        !walkableAt(x, y) &&
        b === '' &&
        nameAt(above, x, y) === '' &&
        !wetTile &&
        !partOfSomethingDrawn
      )
        undrawn.push([x, y]);
      /*
       * A crown is stamped from the register, so one with no trunk under it is half a tree. Asked
       * of the gid set rather than of a name prefix: the three scales are `canopy-*`, `elder-*` and
       * `sapling-*`, and a prefix test would have audited one of them and waved the other two
       * through -- including the elder, whose crown is nine tiles and whose half-tree is therefore
       * the most visible one it is possible to leave on the map.
       */
      if (!isCanopy(x, y)) continue;
      if (!trees.some((t) => crownsOver(t, x, y))) hanging.push([x, y]);
    }
  fault('solid-looking tile(s) the player walks through', soft);
  fault('solid tile(s) with nothing drawn on them', undrawn);
  fault('canopy tile(s) with no tree on the register under them', hanging);
  if (unresolved > 0)
    faults.push(
      `${unresolved} crown cell(s) covered by a tile that does not repaint what was under it ` +
        '(see the note on `crownMask`: this is the hole the overlap rule exists to prevent)',
    );

  /*
   * 4. THE NOTICE POST SPANS THE GATE APPROACH. The garden is enclosed on three sides by the fence
   * and on the fourth by the map border, so the gate is the only way in and the notice covers every
   * tile of its approach. Flood the map again while refusing to step on the notice: the gate must
   * not be reachable. This is the level's zero-click lesson and it must never become optional.
   */
  const rectOf = (name: string): { x0: number; x1: number; y0: number; y1: number } => {
    const o = objects.find((candidate) => candidate.name === name);
    if (!o) throw new Error(`the map has no "${name}" to check`);
    return {
      x0: Math.floor(o.x / TILE),
      x1: Math.floor((o.x + o.width) / TILE) - 1,
      y0: Math.floor(o.y / TILE),
      y1: Math.floor((o.y + o.height) / TILE) - 1,
    };
  };
  const notice = rectOf('notice-forest-post');
  const gap = rectOf('gate-fence-gap');
  if (notice.x1 !== gap.x0 - 1 || notice.y0 > gap.y0 || notice.y1 < gap.y1)
    faults.push('the notice post does not span the gate approach');
  /*
   * ===========================================================================
   * THE FLOOD THESE THREE AUDITS ARE BUILT ON, AND IT IS OVER POSITIONS, NOT TILES.
   * ===========================================================================
   *
   * This was a tile flood, and a tile flood is the wrong instrument for the question. Everything
   * these audits are about -- a notice opening, the run ending -- is `overlaps()` in
   * world/logic.ts, which is a POINT test on Purple's position, and her position is the BOTTOM EDGE
   * of her foot box rather than the middle of a tile. The two models disagree exactly at a row
   * boundary: standing in the lowest row of a rect she presents a y equal to the rect's bottom
   * edge, the half-open test reads that as the row below, and the notice does not fire. 704 for
   * the forest post, 736 for the door note -- and both are on the 2px-per-frame grid she walks on
   * from the spawn, so this is not a theoretical seam. The tile flood reported both sealed, for
   * as long as both faults existed, which is the whole reason the model is written out here.
   *
   * So: nodes are integer FEET POSITIONS, the wall test is `blocked()` -- her foot box against the
   * collision layer, not her centre tile -- and a refused rect is refused by position. One pixel
   * per step is exact rather than approximate: every edge of the unblocked region falls on an
   * integer, because the box is 20 x 12 against a 32px grid, so there is no sub-pixel corridor for
   * it to miss. Axis-separated steps, because `moveWithCollision` moves one axis at a time.
   */
  const FOOT = { w: (TILE * 5) / 8, h: (TILE * 3) / 8, oy: (-TILE * 3) / 16 };
  const PW = MAP_W * TILE;
  const PH = MAP_H * TILE;
  const EPS = 0.0001;
  const blockedAt = (x: number, y: number): boolean => {
    const top = y + FOOT.oy - FOOT.h / 2;
    const bottom = y + FOOT.oy + FOOT.h / 2;
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((bottom - EPS) / TILE); ty++)
      for (
        let tx = Math.floor((x - FOOT.w / 2) / TILE);
        tx <= Math.floor((x + FOOT.w / 2 - EPS) / TILE);
        tx++
      )
        if (!walkableAt(tx, ty)) return true;
    return false;
  };
  const standingFlood = (refuse?: { x0: number; x1: number; y0: number; y1: number }) => {
    const seen = new Uint8Array(PW * PH);
    const sx = spawnX * TILE + TILE / 2;
    const sy = spawnY * TILE + TILE;
    const queue = [sy * PW + sx];
    seen[sy * PW + sx] = 1;
    for (let head = 0; head < queue.length; head++) {
      const key = queue[head]!;
      const x = key % PW;
      const y = (key - x) / PW;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= PW || ny >= PH) continue;
        const next = ny * PW + nx;
        if (seen[next] === 1 || blockedAt(nx, ny)) continue;
        if (
          refuse &&
          nx >= refuse.x0 * TILE &&
          nx < (refuse.x1 + 1) * TILE &&
          ny >= refuse.y0 * TILE &&
          ny < (refuse.y1 + 1) * TILE
        )
          continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    return seen;
  };
  /** Where inside a rect she can still stand, as tiles, for a message a reader can act on. */
  const standingIn = (
    seen: Uint8Array,
    r: { x0: number; x1: number; y0: number; y1: number },
  ): [number, number][] => {
    const hit = new Set<number>();
    for (let y = r.y0 * TILE; y < (r.y1 + 1) * TILE; y++)
      for (let x = r.x0 * TILE; x < (r.x1 + 1) * TILE; x++)
        if (seen[y * PW + x] === 1) hit.add(Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE));
    return [...hit].map((k) => [k % MAP_W, Math.floor(k / MAP_W)] as [number, number]);
  };
  fault(
    'tile(s) of the gate reachable without reading the notice',
    standingIn(standingFlood(notice), gap),
  );

  /*
   * 4a. THE NOTE ON THE DOOR IS ON THE WAY TO THE DOOR, which is the same kind of claim as 4 and
   * was carrying the same kind of hole.
   *
   * `trigger-cottage` ENDS THE RUN. `notice-cottage-door` pays the hundred points for the `sign`
   * errand and half of one of the two lines that reach the thousand-point ceiling. The comment on
   * the note says every approach crosses it first; the map said otherwise, because the note and
   * the trigger were the same three rows and the lane is walkable a row below both of them. Five
   * of the trigger's eight entry tiles were outside the note -- the three on its east side and the
   * two underneath it -- so the natural walk round the south of the lane and up the far side of
   * the door scored 900 instead of 1,000 on identical verdicts.
   *
   * It is asserted as reachability rather than as geometry, which is why this fires on a map where
   * the rects still look right. Two rectangles that line up row for row prove nothing on their
   * own: what matters is whether the world lets her round them, and only a flood knows that.
   */
  fault(
    'tile(s) of the cottage trigger reachable without standing on the door note',
    standingIn(standingFlood(rectOf('notice-cottage-door')), rectOf('trigger-cottage')),
  );

  /*
   * 4b. ...AND NOTHING INSIDE THE ENCLOSURE IS REACHABLE WITH THE FOREST NOTICE REFUSED.
   *
   * Audit 4 watches the GATE, which is one column of two tiles, so it says nothing at all about a
   * way in that does not come through the gate. One such way was open on the shipped map: the
   * connectivity flood had cut the enclosure's north rail at (58,11) to reach two tiles sealed in
   * behind it, and a player who refused the notice could walk through the gap and stand inside the
   * line the fence draws. It went nowhere -- a trunk at (58,14) stopped her -- and that is exactly
   * why it is worth an audit: the barrier was being held by a tree that every planting pass in
   * this file is free to fell, and the only check there was looked somewhere else.
   *
   * The region is the enclosure's own interior, derived from the fence that draws it: east of the
   * gate column, between the two rails. Not a rectangle anyone typed.
   */
  fault(
    'tile(s) inside the garden enclosure reachable without reading the notice',
    standingIn(standingFlood(notice), {
      x0: fenceX + 1,
      x1: MAP_W - 1,
      y0: gardenTop + 1,
      y1: gardenBottom - 1,
    }),
  );

  /*
   * 5. EVERY OBJECT STANDS WHERE IT SAYS IT DOES. The spawn she starts on, the rect a notice is
   * read from and the rect that ends the run have to be walkable over every tile -- a notice whose
   * tiles are solid can never be stood on -- and everything that is a THING has to be solid over
   * every tile: the props, because each one is in the way, and now the cast as well.
   *
   * THE CAST MOVED SIDES THIS ROUND, and the sense of the check is the point rather than the list.
   * It read `wantsSolid = startsWith('prop-')`, so it was the thing asserting that a traveller is
   * walkable -- it was holding the ghosts in place. A character is a thing in the way exactly as a
   * well or a signpost is; what makes him different is that nothing is drawn on his tile, which is
   * audit 3's business and not this one's. The water-and-trunk check below still runs for him,
   * because a solid traveller standing in the river is as wrong as a soft one was.
   */
  for (const o of objects) {
    const r = rectOf(o.name);
    const bad: [number, number][] = [];
    const isCast = o.name.startsWith('npc-') || o.name.startsWith('bystander-');
    // A `sign-*` is a thing in the way exactly as a `prop-*` is (the Cyera signs, 2026-10-23).
    const wantsSolid = o.name.startsWith('prop-') || o.name.startsWith('sign-') || isCast;
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) if (walkableAt(x, y) === wantsSolid) bad.push([x, y]);
    fault(`tile(s) of "${o.name}" that are ${wantsSolid ? 'not solid' : 'not walkable'}`, bad);
    if (wantsSolid && !isCast) continue;
    const onWater = [];
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) {
        const g = nameAt(ground, x, y);
        // Any scale of trunk. `startsWith('trunk')` caught the mid tree and missed the elder and
        // the sapling, which is how an NPC ends up standing inside a tree and never being met.
        // `isTrunk` is that question asked once, up with the gid sets; this was a fourth copy of it.
        const inTree = isTrunk(x, y);
        if (g === 'water' || g === 'water-2' || g === 'waterfall' || inTree)
          onWater.push([x, y] as [number, number]);
      }
    fault(`tile(s) of "${o.name}" standing in the water or inside a tree`, onWater);
  }

  /*
   * 5a. EVERY NOTICE THE GAME SCORES HER FOR READING IS DRAWN, AND NOTICE ART IS DRAWN NOWHERE
   * ELSE.
   *
   * This is the audit the `cottage-door` goal needed and did not have. `notice-cottage-door` has
   * covered six tiles since the errand existed -- one flower bed and five of lane -- with both
   * decor layers empty over every one of them, so a hundred points and half of one of the two
   * thousand-point lines fired from walking over a flower bed. Section 5 above passed it happily,
   * because section 5 only asks whether the rectangle is WALKABLE. Nothing asked whether there was
   * anything there to read.
   *
   * It is two-sided on purpose, and the second side is the one that catches the defect the forest
   * post had. The forest notice WAS drawn -- as `signpost`, the identical tile to the decorative
   * one in the hero frame -- so a one-sided "is something drawn near the rect" test would have
   * waved it through. Requiring notice art to appear at the notices AND NOWHERE ELSE means the
   * moment a notice wears scenery's clothes, or a piece of scenery wears a notice's, this fires.
   *
   * One tile of slack, in both directions: the note is pinned to the door and the rect she reads it
   * from is the lane in front of the door, which is the tile beside it rather than the tile under
   * it. Slack of one is what "within arm's reach of where the panel opens" means in tiles; two
   * would let the art drift off the thing it belongs to.
   */
  {
    const NOTICE_TILES = new Set(['notice-board', 'notice-board-r', 'door-note']);
    const noticeArt: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (NOTICE_TILES.has(nameAt(below, x, y)) || NOTICE_TILES.has(nameAt(above, x, y)))
          noticeArt.push([x, y]);

    const rects = objects
      .filter((o) => o.name.startsWith('notice-'))
      .map((o) => ({ name: o.name, r: rectOf(o.name) }));
    const near = (r: { x0: number; x1: number; y0: number; y1: number }): boolean =>
      noticeArt.some(([x, y]) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);

    if (rects.length === 0) faults.push('no notice rectangle on the map, so this check is vacuous');
    for (const { name, r } of rects)
      if (!near(r))
        faults.push(
          `"${name}" scores the player for reading something that is not drawn: no notice tile ` +
            `within a tile of (${r.x0},${r.y0})-(${r.x1},${r.y1})`,
        );

    const stray = noticeArt.filter(([x, y]) =>
      rects.every(({ r }) => x < r.x0 - 1 || x > r.x1 + 1 || y < r.y0 - 1 || y > r.y1 + 1),
    );
    fault('notice tile(s) standing somewhere the game never scores a reading', stray);
  }

  /*
   * 6. NO STRETCH OF THE BORDER BAND IS A DRAWN LINE OF HEDGE.
   *
   * The band has to be sealed and it must not look sealed, and the two are easy to confuse because
   * only the first one is load-bearing: every pass in this file that fells a tree is free to drop
   * the edge of the world back to scrub without breaking anything a test can see. That is how the
   * bottom row became fifty-two bushes in a row with a twenty-six-tile unbroken run in it, and how
   * the east margin became an eighteen-tile hedge behind Grandma's garden, both AFTER the note on
   * `sealBorder` claimed the treeline would cover them.
   *
   * So the limit is asserted rather than hoped for, in the same place and for the same reason as
   * the five above. `breakHem` runs twice and the stone swap after the last seal holds it.
   *
   * TWELVE NO LONGER DESCRIBES WHAT IS DRAWN, and that is this round's correction. The ceiling was
   * set when `bush` was a disc with lawn showing round it, so a run of twelve was a dotted line and
   * the number was a fair ceiling for one. The undergrowth owner has since taken the bush out to
   * its tile edges, which is right -- a mass with one outline is what the board draws -- and the
   * same twelve tiles now print as ONE CONTINUOUS BAND of foliage along the edge of the world. A
   * ceiling that no longer describes the thing it is watching is a ceiling that will never fire.
   * Six is a clump; the runs this file leaves are four and five.
   */
  const HEM_LIMIT = 6;
  {
    // `isCanopy` is the file's one answer to "is there a crown here". A private copy stood here
    // under the name `isCrown`, character-identical to it, and a third under the name `crowned` in
    // the composition audit below; both are deleted.
    const isHedge = (x: number, y: number): boolean =>
      SCRUB_GIDS.has(at(below, x, y) & BASE_GID) && !isCanopy(x, y);
    const bands: [string, [number, number][]][] = [
      ['row 0', Array.from({ length: MAP_W }, (_v, x) => [x, 0] as [number, number])],
      ['row 1', Array.from({ length: MAP_W }, (_v, x) => [x, 1] as [number, number])],
      [
        `row ${MAP_H - 1}`,
        Array.from({ length: MAP_W }, (_v, x) => [x, MAP_H - 1] as [number, number]),
      ],
      ['column 0', Array.from({ length: MAP_H }, (_v, y) => [0, y] as [number, number])],
      [
        `column ${MAP_W - 1}`,
        Array.from({ length: MAP_H }, (_v, y) => [MAP_W - 1, y] as [number, number]),
      ],
    ];
    for (const [where, cells] of bands) {
      let run: [number, number][] = [];
      let worst: [number, number][] = [];
      for (const [x, y] of cells) {
        run = isHedge(x, y) ? [...run, [x, y] as [number, number]] : [];
        if (run.length > worst.length) worst = run;
      }
      if (worst.length > HEM_LIMIT)
        fault(`tile(s) of unbroken hedge along ${where}, over the ${HEM_LIMIT} limit`, worst);
    }
  }

  /*
   * ===========================================================================
   * 8. THE TRACK'S EDGES. The deck is whole, and the bare verges are COUNTED.
   * ===========================================================================
   *
   * Two things, both about what a walker sees at the edge of the sand, and both measured off the
   * finished ground layer rather than off the pass that wrote it.
   *
   * FIRST, THE CROSSING IS FIVE PLANKS WIDE. Moving the verge sweep below the bridge block -- which
   * it had to be, so a verge is drawn against what is really there -- immediately put `path-n` and
   * `path-s` back over `bridge-l` in both of the deck's rows, because `pathTiles` contains the cell
   * the deck starts on. The bridge was still five tiles wide, three of them planks, and nothing
   * failed: `map.test.ts` crosses the river on the collision layer and the collision was right. A
   * hole in the one crossing in the game is worth a plain assertion.
   *
   * SECOND, A BARE VERGE IS A NUMBER. The tileset has no tile carrying grass on two OPPOSITE sides
   * and none carrying it on three, so the mask resolves those six neighbourhoods to the nearest
   * tile that exists and records, in `VERGE[...].undrawn`, the side it could not draw. This counts
   * the result on the shipped map: how many sides are bare, and the longest straight run of them,
   * which is what a player actually sees -- an unbroken edge where sand meets lawn with no verge,
   * no lip and no teeth on it, against a spec of no straight run over 4px.
   *
   * THE BOUND IS A RATCHET AND IT IS NOT DERIVED FROM `VERGE`. It is 23 bare sides and a worst run
   * of 6 tiles, which is exactly what the map produces today, so it has no margin: adding the six
   * missing gids drops it and the bound comes down with them in the same commit. It is written as a
   * count rather than as "the mask has gaps", because a bound written in terms of the table it
   * watches moves when the table does. The worst run today is (12..17, 12) -- 192px of dead-straight
   * seam in the spawn frame -- with (12..13, 22) and (35..37, 22) behind it.
   */
  {
    const holes: [number, number][] = [];
    for (const y of bridgeRows)
      for (let x = bridgeCentre - 2; x <= bridgeCentre + 2; x++)
        if (!DECK_GIDS.has(at(ground, x, y) & BASE_GID)) holes.push([x, y]);
    fault('tile(s) of the river crossing with no deck drawn on them', holes);

    const bareSides: Array<{ x: number; y: number; side: string }> = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const here = nameAt(ground, x, y);
        if (!here.startsWith('path')) continue;
        const mask =
          (carriesTrack(x, y - 1) ? 0 : N_SIDE) |
          (carriesTrack(x, y + 1) ? 0 : S_SIDE) |
          (carriesTrack(x + 1, y) ? 0 : E_SIDE) |
          (carriesTrack(x - 1, y) ? 0 : W_SIDE);
        for (const side of VERGE[mask]!.undrawn) bareSides.push({ x, y, side });
      }
    /** The longest straight line of cells that leave the SAME side bare. */
    let worstRun = 0;
    let worstAt = 'nowhere';
    for (const side of ['n', 's', 'e', 'w']) {
      const bare = new Set(bareSides.filter((b) => b.side === side).map((b) => b.y * MAP_W + b.x));
      // A bare north or south side runs along a ROW; a bare east or west side runs down a COLUMN.
      const alongRow = side === 'n' || side === 's';
      for (let a = 0; a < (alongRow ? MAP_H : MAP_W); a++) {
        let run = 0;
        for (let b = 0; b < (alongRow ? MAP_W : MAP_H); b++) {
          const x = alongRow ? b : a;
          const y = alongRow ? a : b;
          run = bare.has(y * MAP_W + x) ? run + 1 : 0;
          if (run > worstRun) {
            worstRun = run;
            worstAt = alongRow
              ? `row ${y}, columns ${x - run + 1}-${x}, ${side} side`
              : `column ${x}, rows ${y - run + 1}-${y}, ${side} side`;
          }
        }
      }
    }
    /*
     * 23 -> 27 ON 2026-10-25, and the four are the Magpie's lane (docs/GATEKEEPER.md), not a wider
     * track: a one-wide footpath that runs east for a tile has grass on two OPPOSITE sides, which is
     * the neighbourhood the tileset cannot draw, and the lane from the first fork to the west bank
     * has four such tiles -- (13,27), (15,28), (16,28) and (18,27) -- after it was routed as a
     * staircase to keep the count that low. The worst run did not move. Same ratchet, same rule: the
     * six missing gids bring it down.
     */
    const VERGE_GAP = { sides: 27, run: 6 } as const;
    if (bareSides.length > VERGE_GAP.sides || worstRun > VERGE_GAP.run)
      faults.push(
        `${bareSides.length} track side(s) have no verge drawn on them (want at most ` +
          `${VERGE_GAP.sides}), worst straight run ${worstRun} tile(s) at ${worstAt} (want at most ` +
          `${VERGE_GAP.run}). The tileset has no opposite-pair or three-sided path tile; see the ` +
          'note on `VERGE`. If this went UP, something widened the track into a corridor. If it ' +
          'went DOWN, the six missing gids landed -- bring this bound down with them.',
      );
    verdictLines.push(
      `verges bare on ${bareSides.length} side(s), worst run ${worstRun} at ${worstAt}`,
    );
  }

  /*
   * ===========================================================================
   * 9. NOTHING OPAQUE STANDS ON WATER, ON THE FALL OR ON THE SAND.
   * ===========================================================================
   *
   * The dredge pass above is the fix; this is what stops it coming back. Three separate passes --
   * the border seal, the bank scree and the undergrowth -- are each able to put a bush, a boulder
   * or a flower bed on the river or on the track, and each of them is right about its own job, so
   * the only place the rule can live is here, after all three have run.
   *
   * ZERO, AND IT IS NOT A RATCHET. A flower bed growing out of the lane two tiles from Grandma's
   * door has no acceptable count. The one exception is written out by name: a SHORELINE may carry
   * cover, for the three reasons set out at the uncover pass five hundred lines above -- the middle
   * of a long bank column reads as the gorge the board draws, and the border band's seal beats a
   * shoreline the player can see and cannot walk onto. Those are counted and reported rather than
   * waved through, so if the number moves somebody has to say why.
   */
  {
    const WET = new Set(['water', 'water-2', 'waterfall'].map(gid));
    const aground: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (!OPAQUE_FLOOR.has(nameAt(below, x, y))) continue;
        const floor = at(ground, x, y) & BASE_GID;
        const here = TILE_NAMES[floor - 1] ?? '';
        /*
         * NO BANK CARRIES OPAQUE COVER, ON THE BAND OR OFF IT, since 2026-10-22, later. Below the
         * band a covered bank was a lawn square bitten out of the stones; ON the band it was the
         * same square with the open river running into it, which is the hard edge the client
         * named at (31,0) and (16,41). The band's banks are sealed instead (the dredge pass), and
         * audit 9b below holds the sealed ones to their rules. This exemption used to count seven.
         */
        const touchesDeck = [...NEIGHBOURS, [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) =>
          nameAt(ground, x + dx!, y + dy!).startsWith('bridge'),
        );
        if (nameAt(below, x, y) === 'rock' && touchesDeck) aground.push([x, y]);
        if (WET.has(floor) || here.startsWith('path') || here.startsWith('shore'))
          aground.push([x, y]);
      }
    fault(
      'opaque tile(s) standing on water, on the waterfall, on the track or on a bank, or a ' +
        'boulder against the deck',
      aground,
    );
  }

  /*
   * ===========================================================================
   * 9b. THE BORDER'S BANKS ARE SEALED, AND ONLY THE BORDER'S.
   * ===========================================================================
   *
   * A `bank-stones-*` tile is a bank drawn whole with stones on its lawn, laid in `decor-below` over
   * that same bank on the border band (the dredge pass; "THE SEALED BANKS" in `tiles/w-water.ts`).
   * Three things can go wrong with one and each is checked here, on the finished map:
   *   - it stands over a DIFFERENT bank, or no bank: its waterline then crosses the ground's at an
   *     angle, which is a worse seam than the one it replaced;
   *   - it stands off the band, where a bank is walkable and the stones would be a wall;
   *   - its cell is walkable, so the stones are a decal;
   * Whether a sealed bank READS as solid is the painter's guard, not this audit's: every one of the
   * twelve shows less open lawn than the band's own `rock` tile, checked on its pixels in
   * `tiles/w-water.ts`, so any of them may stand anywhere on the band.
   */
  {
    const SEALED = new Set(Object.values(SEALED_BANK));
    const misplaced: [number, number][] = [];
    let count = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const b = nameAt(below, x, y);
        if (!SEALED.has(b)) continue;
        count++;
        if (SEALED_BANK[nameAt(ground, x, y)] !== b || !onBorder(x, y) || walkableAt(x, y))
          misplaced.push([x, y]);
      }
    fault('sealed bank(s) off the border band, over the wrong bank, or walkable', misplaced);
    verdictLines.push(`${count} border-band bank(s) sealed with stone instead of covered`);
  }

  /*
   * ===========================================================================
   * 10. NO DOUBLED FENCE POST, which is what a wide post next to a wide post is.
   * ===========================================================================
   *
   * The run is deliberately broken by a wide flat-capped post every three or four tiles -- that is
   * composition guard 7h's whole subject, and 7h bounds the RECEDING run between them. What it
   * cannot see is the opposite failure: two wide posts stacked against each other, which is not a
   * run broken by a post but a doubled post, and which is what column 46 shipped at rows 11 and 12,
   * at the top of the payoff frame. Measured as adjacency on the finished layer, so moving the
   * pitch arithmetic back fails here rather than moving the bound with it.
   */
  {
    const WIDE = new Set(['fence-corner', 'fence-corner-e', 'fence-corner-w']);
    const doubled: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (!WIDE.has(nameAt(below, x, y))) continue;
        // One direction each, so a pair is reported once and at its upper-left member.
        if (WIDE.has(nameAt(below, x, y + 1)) || WIDE.has(nameAt(below, x + 1, y)))
          doubled.push([x, y]);
      }
    fault('wide fence post(s) standing against another wide post', doubled);

    /*
     * ...AND WHERE THE TWO RAILS SIT RELATIVE TO BOTH PAYOFF FRAMES, reported every run.
     *
     * Composition guard 7h asserts that no picket rail lies across the DESKTOP arrival camera, and
     * it passes. It says nothing about the phone's, which is five and a half tiles taller and which
     * both rails sit inside. The fix and what it costs are written out at `gardenTop`; this is the
     * number, on every run, so the fault cannot go quiet the way it did behind a rail run of zero.
     */
    const span = (r: Rect): string => `${Math.floor(r.y0)}-${Math.ceil(r.y1) - 1}`;
    const insidePhone = [gardenTop, gardenBottom].filter(
      (y) => y >= Math.floor(ARRIVE_PHONE.y0) && y < Math.ceil(ARRIVE_PHONE.y1),
    );
    verdictLines.push(
      `enclosure rails on rows ${gardenTop}/${gardenBottom}: desktop arrival frame is rows ` +
        `${span(ARRIVE)}, the phone's is rows ${span(ARRIVE_PHONE)}, ` +
        `${insidePhone.length} rail(s) inside the phone's payoff frame`,
    );
  }

  /*
   * ===========================================================================
   * 11. THE GRASS RAMP STILL GOES DOWNHILL, AND IT IS STILL WIDE ENOUGH TO BE A SHADOW.
   * ===========================================================================
   *
   * `grassStep` is measured off the painted tiles now, so the ORDER cannot be wrong any more; what
   * can still be wrong is the ramp itself. Two things are asserted and they fail for opposite
   * reasons.
   *
   *   - Two variants painted to the same luma make a rung that is not a rung: `shade()` would move
   *     a tile from one to the other and change nothing a player can see, which is the fault the
   *     index-order bug produced and the one hardest to notice once the order is right.
   *   - The SPAN is what a shadow is worth. Walking a tile from the lightest rung to the darkest is
   *     the deepest shadow this file is able to lay anywhere on the map.
   *
   * WHERE IT SITS TODAY, AND WHY THE FLOOR IS WHERE IT IS. The span is 5.4 luma. That is not a
   * shadow; nine hundred trees and the cottage stand on ground that is, to the eye, exactly as
   * bright as the ground beside them. For comparison the lawn's own join guard in
   * `tiles/w-ground.ts` treats 14 luma as the level at which a person sees a line across a field,
   * and the board's own pools are tens of luma deep. So 5.0 is a FLOOR UNDER A KNOWN-BAD NUMBER,
   * not a specification: it stops the ramp being flattened further while the real fix -- widening
   * `BANDS` in the ground painter -- is somebody else's commit. Raise it as the painter improves.
   * It is a plain luma figure and is deliberately not derived from anything in `BANDS`.
   */
  {
    const RAMP_SPAN_FLOOR = 5;
    const flat = grassRamp
      .slice(1)
      .map((r, i) => ({ r, below: grassRamp[i]! }))
      .filter(({ r, below }) => r.luma - below.luma < 0.05);
    for (const { r, below } of flat)
      faults.push(
        `the grass ramp has two rungs at the same brightness: ${below.name} at ` +
          `${below.luma.toFixed(1)} and ${r.name} at ${r.luma.toFixed(1)}. A shade pass that ` +
          'walks a tile between them changes nothing a player can see.',
      );
    const span = grassRamp[grassRamp.length - 1]!.luma - grassRamp[0]!.luma;
    if (span < RAMP_SPAN_FLOOR)
      faults.push(
        `the grass ramp spans ${span.toFixed(1)} luma end to end (want at least ` +
          `${RAMP_SPAN_FLOOR}): ${grassRamp.map((r) => `${r.name} ${r.luma.toFixed(1)}`).join(', ')}. ` +
          'Every cast shadow, road keyline and penumbra on this map is a walk down that ramp, so ' +
          'this is the deepest shadow the world can have. Widen `BANDS` in `tiles/w-ground.ts`.',
      );
    verdictLines.push(
      `grass ramp ${grassRamp.map((r) => `${r.name.slice(-1)}:${r.luma.toFixed(1)}`).join(' ')} ` +
        `(span ${span.toFixed(1)} luma, darkest first)`,
    );
  }

  /*
   * ===========================================================================
   * 12. WHERE THE PLAYER CAN STAND, THE PLAYER CAN BE SEEN.
   * ===========================================================================
   *
   * `decor-above` is drawn OVER Purple. A tile on it that is opaque across all 1,024 of its pixels
   * therefore hides her outright: she walks onto the cell and disappears, with no shadow, no outline
   * and nothing to say where she went. Every other crown quarter in the set is drawn with daylight
   * in it -- `canopy-tl` is 51% opaque, `canopy-bl` 85%, `elder-tc` 28% -- so the ones that do this
   * are outliers rather than the rule.
   *
   * ASKED OF THE ALPHA, NOT OF A LIST OF NAMES. The finding this came from named four tiles:
   * `elder-mc`, `elder-bc`, `canopy-bl` and `canopy-br`. Rendered and counted, only the first two
   * are actually opaque everywhere; `canopy-bl` and `canopy-br` leave 152 and 111 pixels of daylight,
   * so Purple is dimmed under them and not erased. A guard written from the list would have been wrong
   * about half of it in both directions, and -- the expensive half -- it would keep passing after a
   * painter opened those two quarters up and closed a different one. So each `decor-above` painter is
   * rendered once and asked whether any pixel of it is not opaque.
   *
   * 101 IS A RATCHET OVER A KNOWN-BAD NUMBER, exactly like the grass ramp's floor, and for the same
   * reason: the remedy is a painter's. `elder-mc` and `elder-bc` are the middle and bottom centre of
   * an elder's 3x3 crown and they are solid green squares; opening a few pixels of sky into them
   * costs nothing and fixes all 101 cells at once, and `tiles/w-trees.ts` is where that is done. The
   * map's own alternatives are both worse than the fault -- making 101 cells solid turns a drawing
   * problem into a collision problem and hands the connectivity flood 101 new pockets to open by
   * felling the wood, and refusing to plant an elder whose crown reaches walkable ground would
   * remove most of the elders. So this holds the line and reports the number. Lower it as the
   * crowns open up; never raise it.
   *
   * IT STOOD AT 109 UNTIL 2026-10-21 AND THE MAP HAD BEEN AT 101 FOR SOME TIME, so the guard was
   * carrying eight cells of slack: eight new blind tiles could have been planted and it would have
   * gone on passing. A ratchet left above the measurement is not a ratchet, it is a ceiling nobody
   * is near, and this one was quoted as "109" in three sentences of prose above as well. Checked
   * independently from the other end at the same time -- decoding `tileset-forest.png` and counting
   * alpha per cell against the committed map, then flooding from `spawn-purple` -- which found the
   * same 101 cells, the same two tiles (gids 60 and 63, which are these two), all of them genuinely
   * reachable, spread over rows 2 to 37. Two instruments that share no code agreeing on 101 is the
   * reason this is a tightening rather than a guess.
   *
   * 98 SINCE PAUL'S ROUND OF 2026-10-22. Restoring a struck tree's shared cells to the survivor's
   * own quarter (`strike`) took three ghost `elder-mc`s off walkable ground: the map measures 98,
   * and the ratchet follows it down the same day rather than carrying the slack.
   */
  {
    const OPEN_ENOUGH = 98;
    const seeThrough = new Map<string, boolean>();
    const hidesHer = (name: string): boolean => {
      const known = seeThrough.get(name);
      if (known !== undefined) return known;
      const img = new Img(TILE, TILE);
      TILE_PAINTERS[name]!(img);
      let solidPx = 0;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) if (img.get(x, y)[3] === 255) solidPx++;
      const blind = solidPx === TILE * TILE;
      seeThrough.set(name, blind);
      return blind;
    };
    const blindCells: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const over = nameAt(above, x, y);
        /*
         * REACHABLE, not merely walkable -- and this axis was blind until 2026-10-21.
         *
         * The test was `walkableAt(x, y)`, which asks whether the collision layer would let a foot
         * stand there, not whether a foot can ever GET there. Those differ: audit 2 above exists
         * precisely because walkable tiles can be stranded, and it floods from `spawn-purple` to find
         * them. So this counted cells a player cannot reach, and it would have gone on passing
         * unchanged if a future map sealed every blind cell off -- which would be a real
         * improvement it could not see, in either direction.
         *
         * It matters for the BOUND and not just for the report. 101 is a ratchet, and it is only
         * the right number because all 101 happen to be reachable; had some been enclosed, the
         * honest ratchet would have been lower and tightening to 101 would have set it too high.
         * The count is unchanged by this line today, which is the measurement that says the two
         * readings agree right now, not a reason the line is unnecessary.
         *
         * `reached` is audit 2's own flood, reused rather than re-derived, so the two cannot drift.
         */
        if (over === '' || !walkableAt(x, y) || !reached.has(y * MAP_W + x)) continue;
        if (hidesHer(over)) blindCells.push([x, y]);
      }
    if (blindCells.length > OPEN_ENOUGH)
      fault(
        `walkable tile(s) under a crown quarter that is opaque in all ${TILE * TILE} of its ` +
          `pixels, so Purple vanishes when she stands on one (want at most ${OPEN_ENOUGH}; open the ` +
          'quarter up in `tiles/w-trees.ts` rather than making the ground solid)',
        blindCells,
      );
    const blindTiles = [...seeThrough.entries()]
      .filter(([, blind]) => blind)
      .map(([name]) => name)
      .sort();
    verdictLines.push(
      `${blindCells.length} walkable tile(s) hidden under a fully opaque crown` +
        (blindTiles.length ? ` (${blindTiles.join(', ')})` : ''),
    );
  }

  /*
   * ===========================================================================
   * 13. THE GATE IS A GATE: the opening is DRAWN, and what is drawn is WALKABLE.
   * ===========================================================================
   *
   * THE DEFECT THIS EXISTS FOR WAS AN ABSENCE, AND AN ABSENCE IS WHAT NOTHING HERE COULD SEE.
   * `decor-below` at (46,20) and (46,21) was `0` -- the fence simply stopped and started again,
   * with two flat terminator planks and a hole between them. It was queued three times and lost
   * three times, and the reason it kept surviving is the thing worth writing down:
   *
   *   EVERY EXISTING TEST THAT WATCHES THE GATE WATCHES THE BARRIER, AND AN EMPTY CELL IS THE
   *   BEST BARRIER-OPENING THERE IS. `map.test.ts` floods refusing the notice and asserts the gate
   *   is unreachable; audit 2a asserts the due-east walk is unobstructed; audit 4 asserts the
   *   notice spans the approach; connectivity asserts the garden is reachable. All four passed,
   *   perfectly and honestly, on a cell with nothing drawn on it. Reachability cannot see a
   *   picture. This audit is the one that looks at the picture.
   *
   * WHY THE BOUND IS THE PUBLISHED RECTANGLE AND NOT `gateRows`. `gateRows` is the constant the
   * placement loop itself iterates; an audit written against it is an audit written in terms of
   * the thing it guards, so moving the gate would move the audit with it and it would pass in
   * silence -- the exact failure this repo has already paid for more than once. `gate-fence-gap`
   * is an independent statement of the same fact, published into the objects layer and read by
   * `map.test.ts` too, so checking against it ALSO catches the two drifting apart.
   *
   * THE SECOND FAULT IS NOT A FORMALITY. A gate the player cannot walk through is a worse bug than
   * no gate, and it is invisible in a screenshot: `panel()` instead of `set()` draws exactly the
   * same pixels and seals the only way into the garden. Audit 2a fires on that independently,
   * which is the point -- two guards, two different measurements, one defect.
   */
  {
    const GATE = new Set(['gate-n', 'gate-s']);
    const gap = rectOf('gate-fence-gap');
    const cells: [number, number][] = [];
    for (let y = gap.y0; y <= gap.y1; y++)
      for (let x = gap.x0; x <= gap.x1; x++) cells.push([x, y]);

    fault(
      'cell(s) of the gate opening with no gate drawn on them, so the fence stops and starts ' +
        'again with a hole between its two terminators',
      cells.filter(([x, y]) => !GATE.has(nameAt(below, x, y))),
    );
    fault(
      'cell(s) of the gate opening made solid, which closes the only way into the garden',
      cells.filter(([x, y]) => !walkableAt(x, y)),
    );

    const placed: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) if (GATE.has(nameAt(below, x, y))) placed.push([x, y]);
    fault(
      'gate leaf/leaves drawn outside the published gate opening',
      placed.filter(([x, y]) => x < gap.x0 || x > gap.x1 || y < gap.y0 || y > gap.y1),
    );

    const distinct = new Set(placed.map(([x, y]) => nameAt(below, x, y)));
    if (distinct.size < GATE.size)
      faults.push(
        `the gate is drawn with ${distinct.size} of its ${GATE.size} leaves: ` +
          `${[...GATE].filter((n) => !distinct.has(n)).join(', ')} unplaced, so the opening is ` +
          'half a gate',
      );

    verdictLines.push(
      `gate: ${placed.length} leaf/leaves across the ${cells.length}-cell opening at column ` +
        `${gap.x0}, rows ${gap.y0}-${gap.y1}`,
    );
  }

  /*
   * ===========================================================================
   * 14. NO TREE IN THE RIVER, read off what is DRAWN rather than off the register the sweep used.
   * ===========================================================================
   *
   * The river sweep strikes trees off the register by a rule about the register; a guard written
   * the same way would move with the sweep and pass in silence (PAUL_BRIEF trap 5). So this asks
   * the layers. Two counts, two different kinds of bound:
   *  - a TRUNK TILE drawn on a bank step or corner is zero, and is not a ratchet: those are the
   *    tiles that carry the only waterline their water gets;
   *  - a CROWN TILE drawn over open water is a RATCHET at 2. Those two are the west-bank elders at
   *    (22,17) and (21,35) leaning one corner out over the water, at (24,14) and (23,32), which is a
   *    wooded bank and is kept on purpose. Lower it if they go; never raise it. A third is a tree
   *    growing out of the river, which is what the sapling at (16,36) was.
   */
  {
    const RIVER_CROWNS = 2;
    /*
     * A COVE IS ASKED OF ITS PIXELS, since the corner pass, 2026-10-22. A step or a point carries
     * its waterline along a whole edge and a trunk on it is a fault outright. A cove's water is one
     * corner, and a trunk tile is opaque over barely half of itself -- so whether a tree on a cove
     * stands IN the river is a question of where the two drawings overlap, and it is answered by
     * rendering both and counting the cove's water pixels the trunk covers. The one case on the map
     * is the elder at the waterfall head whose `elder-trunk-r` stands on `shore-cove-ne` at (27,3):
     * its contact shadow and root flare cover 9 of the cove's 123 water pixels, the corner is open
     * river beside it, and felling it would replant the treeline over the fall. More than a
     * QUARTER of the water under the trunk is a tree standing in the cove, and fails.
     */
    const COVE_UNDER_TRUNK = 0.25;
    const drawn = new Map<string, Img>();
    const paintOf = (name: string): Img => {
      let img = drawn.get(name);
      if (!img) {
        img = new Img(TILE, TILE);
        TILE_PAINTERS[name]!(img);
        drawn.set(name, img);
      }
      return img;
    };
    const coveUnderTrunk = (x: number, y: number): number => {
      const cove = paintOf(nameAt(ground, x, y));
      const trunk = paintOf(nameAt(below, x, y));
      const flipped = (at(below, x, y) & FLIP_H) !== 0;
      let wet = 0;
      let under = 0;
      for (let py = 0; py < TILE; py++)
        for (let px = 0; px < TILE; px++) {
          const c = cove.get(px, py);
          if (!(c[2] > c[1] && c[1] > c[0])) continue;
          wet++;
          if (trunk.get(flipped ? TILE - 1 - px : px, py)[3] === 255) under++;
        }
      return wet === 0 ? 1 : under / wet;
    };
    const rooted: [number, number][] = [];
    const overhung: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (
          isTrunk(x, y) &&
          soleShoreline(x, y) &&
          (!nameAt(ground, x, y).startsWith('shore-cove') ||
            coveUnderTrunk(x, y) > COVE_UNDER_TRUNK)
        )
          rooted.push([x, y]);
        if (isWater(x, y) && isCanopy(x, y)) overhung.push([x, y]);
      }
    fault('tree trunk(s) drawn on a bank step or corner, over the only waterline there', rooted);
    if (overhung.length > RIVER_CROWNS)
      fault(
        `crown tile(s) drawn over open water (want at most ${RIVER_CROWNS}, the two west-bank ` +
          'elders leaning out; any more is a tree standing in the river)',
        overhung,
      );
    verdictLines.push(
      `river: ${overhung.length} crown tile(s) over open water, ${rooted.length} trunk(s) on a bank step`,
    );
  }

  /*
   * ===========================================================================
   * 7. COMPOSITION. The four things `docs/DESIGN_BOARD.md` priority 1 asks this file for.
   * ===========================================================================
   *
   * Every one of these is measured off the FINISHED layers rather than off the pass that produced
   * it, and no BOUND here is written in terms of the constant it is watching -- that mistake was
   * made in this repo last round, where a guard restated the bound it was guarding, so putting the
   * constant back to the broken value moved the bound with it and the guard passed in silence.
   * Setting `TRACK_W` back to a straight stamp, deleting the edge tear, dropping the framing bands
   * or taking the anchor-column spacing out all fail here, because here the numbers come from the
   * map and the bounds are plain.
   *
   * THAT USED TO SAY "none of them", FLATLY, AND TWO OF THEM DID IT. Corrected 2026-10-20, in the
   * same edit that fixed the two. A preamble that overclaims is quoted back at the next reader as a
   * reason not to check:
   *
   *   - 7c measured a file of crowns with `fileMate`, the PLANTER's own predicate for what counts
   *     as a file. Widen the planter's idea of daylight between two crowns and its auditor widened
   *     with it, so the planter could never fail its own test. The gap test is now written out at
   *     the audit, deliberately restating the planter, with a comment on each saying so.
   *   - 7a filtered the columns it measures with `TRACK_W - 1`, so two of its four bounds -- the
   *     ruled edge and the bitten count -- loosened the moment the carriageway was widened, which
   *     is the one change they exist to catch. It is written as `<= 1` now.
   *
   * There is a third kind of sharing on this page and it is RIGHT: `topEdgeRows` is shared between
   * the framing planter and 7b, because that is a COORDINATE DERIVATION. A guard and a pass must
   * agree about which rows they are talking about or the guard certifies rows nobody plants.
   * Sharing a THRESHOLD is the opposite. Do not "unify" the first into the second.
   *
   * AND THE BOUNDS ARE RATCHETS PINNED TO THE TRUTH. NOT HEADROOM.
   *
   * The sentence that used to stand here said they were "set a little above what the map does
   * today, on purpose", and it was false of most of them. It had also been quoted twice as a reason
   * NOT to look at a failure here, which is the expensive half: a comment that misdescribes its own
   * guards sends the next reader hunting for a defect that is not there. Counted on 2026-10-20,
   * ELEVEN of the bounds below -- in six of this section's lettered parts -- sit at EXACT equality
   * with what the map produces, so they have no margin at all:
   *
   *     7a         deepest column of sand in the hero frame       at most 4      4
   *     7a         rows the carriageway's north edge sits on      at least 5      5
   *     7b         columns of the title's top edge closed         at least 8     8 of 15
   *     7b         the title's worst open run                      at most 7      7
   *     7b-arrive  columns of the arrival's top edge closed       at least 9     9 of 20
   *     7b-arrive  the arrival's worst open run                    at most 9      9
   *     7g         unbroken planting file, in each of 3 cameras    at most 3      3 / 3 / 3
   *     7h         fence run between posts                         at most 3      3
   *     7c         longest file of crowns                          at most 3      3
   *
   * Four more carry one tile: 7a's straightest ruled edge (5 of 6) and bitten columns (9 of 8), 7e's
   * tallest scree (3 of 4) and 7c's tallest stack (9 of 10). Only the rest are genuinely roomy --
   * 7a's hero sand at 18.9% of 24% and 31 readable columns of 20, 7b-portrait's 29 tiles of 10 and
   * 2 landmarks of 1, 7h's rail at 0 of 3, 7i's plaster at 1454px inside 480..2600 with its widest
   * featureless patch 70px of 240, and 7d's ground shares of 47/34/16/3 against a 2.5..60 band.
   *
   * TWO OF THOSE FIGURES MOVED ON 2026-10-20 and neither is a composition change. 7i's plaster was
   * 1462px: the dredge pass lifted a flower bed off the lane at (52,20) and (52,21), inside this
   * frame, and eight of its pixels were being counted as plaster. 7d's first two shares swapped
   * because the grass ramp is now ordered by MEASURED luma rather than by the variants' order in
   * `TILE_NAMES`, so what used to be reported as `grass-0`'s share is `grass-1`'s -- the same tiles
   * in the same places under their right names. Every other figure above is unchanged, which is the
   * check that neither of those two touched the picture.
   *
   * AND THREE MORE RATCHETS NOW SIT OUTSIDE THIS SECTION, in audits 8, 11 and 12, because they are
   * about what a tile IS rather than about where the camera is pointed: 23 bare track verges with a
   * worst run of 6, a grass ramp spanning 5.4 luma against a floor of 5, and 109 walkable tiles
   * under a fully opaque crown quarter. All three are pinned at exactly what the map produces, all
   * three say in their own note which file fixes them, and all three print their figure on every run
   * whether or not they fire. Two of them are floors under a number that is already bad; the right
   * move on those is to tighten them, never to loosen them.
   *
   * WHAT THAT MEANS FOR A CHANGE, which is the part worth carrying away. Anything that moves one
   * tile of the generated map is odds-on to fail here, and a failure here is NOT by itself evidence
   * that the change was wrong: it is this section asking to be re-measured. Re-read the composition
   * line the run prints, satisfy yourself the picture is still the one `docs/DESIGN_BOARD.md`
   * priority 1 asks for, and then move the bound to the new truth -- in either direction, in the
   * same commit. What a ratchet buys is that the move is DELIBERATE and shows up in a diff, which is
   * what catches a return of the defect. What it does not buy is room to move a tile for free.
   */
  {
    const notice = rectOf('notice-forest-post');
    const isSand = (x: number, y: number): boolean => nameAt(ground, x, y).startsWith('path');
    /*
     * ===========================================================================
     * 7a. THE CARRIAGEWAY, MEASURED IN THE RECTANGLE A VISITOR ACTUALLY SEES.
     * ===========================================================================
     *
     * THE PREVIOUS VERSION OF THIS GUARD WAS AIMED WRONG, AND IT WAS AIMED WRONG TWICE.
     *
     *   1. It `continue`d on any column carrying four or more rows of sand, which is EXACTLY the
     *      widest and worst stretch of road in the hero frame: the two worst columns carried six
     *      rows each and the guard stepped over both of them. A guard that skips the defect it is
     *      named after is worse than no guard, because it reports green.
     *   2. Its floor of fourteen "bitten" columns defined bitten as `bottom - top === 2` -- a
     *      THREE-tile carriageway -- so the guard MANDATED a wider road. The tear that satisfied it
     *      made the edge ragged by adding sand, and the band came out 30.7% of the hero rectangle.
     *
     * So this measures two different things and neither of them can be stepped over.
     *
     * FIRST, THE RECTANGLE. Sand as a share of the hero frame, and the deepest single column of it,
     * over the columns a landscape visitor can see past the title card. A junction, a fork, a tear
     * or a widened band all land in these two numbers whatever caused them; there is no `continue`
     * in either, and the rectangle comes from `cameraFor()` rather than from a remembered size.
     *
     * SECOND, THE SHAPE OF THE BAND, which needs the band separated from the forks that join it.
     * That is done by TRACING it -- at each column, the run of sand that overlaps the run at the
     * column before, seeded on the spawn's own row -- rather than by discarding columns that look
     * inconvenient. A column where a fork joins is still measured: it is what sets `deepest`.
     * Straightness and the count of rows travelled are then read off the columns where the trace is
     * the carriageway alone, and the comment says so instead of a silent skip doing it.
     */
    /*
     * `visibleTitleColumns()` answers in columns FROM THE CAMERA'S LEFT EDGE, and `columnsOf` gives
     * map-absolute ones, so the frame's own origin has to be added before they can be compared.
     *
     * Without it this was right by luck. Purple spawns at column 5 and the hero camera is 19.41 tiles
     * wide, so `frameAt` clamps `HERO.x0` to exactly 0 and the two coordinate systems coincide --
     * move the spawn east by one tile and this guard, and 7b below it, would quietly start reading
     * the wrong columns while still reporting a number. The call is also lifted out of the filter
     * callback, where it rebuilt the whole camera once per column.
     */
    const vis = visibleTitleColumns();
    const visFirst = Math.ceil(HERO.x0 + vis.from);
    const visLast = Math.floor(HERO.x0 + vis.to);
    const heroCols = columnsOf(HERO).filter((x) => x >= visFirst && x <= visLast);
    const heroRows = rowsOf(HERO);
    let heroSand = 0;
    /*
     * The deepest UNBROKEN stack of sand in any one column, which is how deep the pale mass gets.
     * Unbroken rather than total, because a column that carries two rows of road and, three rows
     * away, two rows of footpath is a road and a footpath; a column that carries six in a row is a
     * yard. The old guard counted neither -- it `continue`d past both.
     */
    let deepestColumn = 0;
    let deepestAt = '';
    for (const x of heroCols) {
      let run = 0;
      for (const y of heroRows) {
        if (isSand(x, y)) {
          heroSand++;
          run++;
          if (run > deepestColumn) {
            deepestColumn = run;
            deepestAt = `column ${x}, rows ${y - run + 1}-${y}`;
          }
        } else run = 0;
      }
    }
    const heroShare = (heroSand / Math.max(heroCols.length * heroRows.length, 1)) * 100;
    if (heroShare > 24)
      faults.push(
        `sand is ${heroShare.toFixed(1)}% of the hero frame a 1280 visitor sees ` +
          '(a carriageway, not a track: the board gives its path about a tenth of the frame)',
      );
    if (deepestColumn > 4)
      faults.push(
        `${deepestColumn} rows of sand stand one on top of another at ${deepestAt} in the hero ` +
          'frame (a junction drawn as a yard: see composition guard 7a)',
      );

    /** The contiguous run of sand in this column that contains `through`, or nothing. */
    const runThrough = (x: number, through: number): { top: number; bottom: number } | null => {
      if (!isSand(x, through)) return null;
      let top = through;
      let bottom = through;
      while (isSand(x, top - 1)) top--;
      while (isSand(x, bottom + 1)) bottom++;
      return { top, bottom };
    };
    const traced: { x: number; top: number; bottom: number }[] = [];
    let through = spawnY;
    for (let x = 2; x < notice.x0; x++) {
      let run = runThrough(x, through);
      // The band stepped a row: pick it up again from whichever of its rows this column still has.
      if (!run) {
        const prev = traced[traced.length - 1];
        for (let y = (prev?.top ?? spawnY) - 1; y <= (prev?.bottom ?? spawnY) + 1 && !run; y++)
          run = runThrough(x, y);
      }
      if (!run) continue;
      traced.push({ x, ...run });
      through = Math.round((run.top + run.bottom) / 2);
    }
    /**
     * The columns where the trace is carriageway alone, which is where an EDGE can be read.
     *
     * The literal 1 is deliberate and must NOT go back to `TRACK_W - 1`. This filter decides which
     * columns `straightest` and `bitten` are measured over, so writing it in terms of the track's
     * own width meant that widening the track widened the guard's idea of "carriageway alone" with
     * it -- and both of those bounds exist to catch exactly that widening. A guard may not take its
     * threshold from the thing it is watching. Two tiles abreast is what this audit calls a
     * carriageway, whatever the planter is currently stamping.
     */
    const edges = traced.filter((e) => e.bottom - e.top <= 1);
    const ruled = (pick: (e: { top: number; bottom: number }) => number): number => {
      let best = 0;
      let run = 0;
      for (const [i, e] of edges.entries()) {
        const prev = edges[i - 1];
        run = prev && prev.x === e.x - 1 && pick(prev) === pick(e) ? run + 1 : 1;
        best = Math.max(best, run);
      }
      return best;
    };
    const straightest = Math.max(
      ruled((e) => e.top),
      ruled((e) => e.bottom),
    );
    /** Bitten: a column the band has been cut back to a single tile on. */
    const bitten = edges.filter((e) => e.bottom === e.top).length;
    const rowsUsed = new Set(edges.map((e) => e.top)).size;
    if (edges.length < 20)
      faults.push(`only ${edges.length} column(s) of readable carriageway west of the notice`);
    /*
     * RATCHETED FROM 9 TO 6, 2026-10-20. Measured: five.
     *
     * Nine was set when the band's shortest cosine had a period of 35.8 tiles against a camera 19.41
     * tiles wide -- half a cycle across the whole picture, so the road was locally straight everywhere
     * inside every frame and a ceiling of nine could never fire. With the periods brought inside the
     * frame the worst ruled stretch is five columns, and three of those five sit behind the title
     * card. Six is one above the truth, which is this guard's own convention; the point is to catch a
     * RETURN of the set square, and putting either period back fails here at seven.
     */
    if (straightest > 6)
      faults.push(
        `the carriageway's edge runs ruled for ${straightest} columns west of the notice ` +
          '(a road, not a track: see composition guard 7a)',
      );
    if (bitten < 8)
      faults.push(
        `only ${bitten} column(s) of the carriageway are bitten back to a single tile ` +
          "(the board's path has a torn boundary, and a tooth is sand REMOVED)",
      );
    if (rowsUsed < 5)
      faults.push(
        `the carriageway's north edge sits on only ${rowsUsed} row(s) west of the notice ` +
          '(a straight road re-laid, not a curve)',
      );

    /*
     * 7b. CANOPY CLOSES THE TOP OF THE TITLE CAMERA.
     *
     * THE RECTANGLE IS NO LONGER QUOTED HERE. This guard used to say "the camera shows about
     * 26 x 15 tiles at 1280 wide" and count columns 7..25. The camera shows 19.41 x 11.22 tiles,
     * so columns 20-25 are off the right of the screen and were never visible to anyone: the
     * guard certified a framing pass by counting five columns the game does not draw. The figure
     * came from the ABANDONED 1.5x zoom option (see MAX_ZOOM in @otp/core's camera.ts, which has
     * said "~19 tiles across at 1280px wide" since the remaster), and three rounds of composition
     * were aimed at it.
     *
     * `visibleTitleColumns()` derives the range from the same function the game sizes its canvas
     * with, so this cannot drift again: change the frame, the margins or the zoom rule and both
     * move together.
     *
     * THE FLOOR IS A RATCHET, NOT THE TARGET. The board closes its top edge except the single gap
     * the path exits through. Raise this as the framing improves; never lower it. It stood at 6 of
     * the 15 a visitor sees, which was a seven-column unbroken hole at the dead centre of the
     * picture; the framing pass now closes most of the frame and the floor moves with it.
     *
     * THE TWO ROWS ARE NO LONGER WRITTEN DOWN EITHER. They are the first two rows of the hero
     * rectangle -- the one the top edge cuts and the one directly below it -- so they follow the
     * camera and the spawn rather than a number typed here.
     */
    /*
     * The visible range is `visFirst`..`visLast`, computed once up in 7a. This made a second
     * `visibleTitleColumns()` call of its own and compared the camera-relative answer against
     * map-absolute columns, the same way 7a did and with the same `HERO.x0 === 0` luck holding it
     * up. One call, one offset, both guards.
     */
    /**
     * How a frame's top edge reads: how many of its columns canopy closes, and -- the number the
     * design board actually named -- the longest UNBROKEN run of open sky across it.
     *
     * The run is the one that matters. Six closed columns of fifteen was reported as "nearly half"
     * and what a visitor saw was a SEVEN-COLUMN HOLE at the dead centre of the picture, because the
     * six were at the two ends. A count cannot tell those apart and a run can.
     *
     * THE ROWS COME FROM `topEdgeRows`, NOT FROM `rowsOf(r).slice(0, 2)`. Those differ, and the
     * difference was visible on the landing screen: `rowsOf` floors, so it offered the row the
     * camera's edge cuts 78% of the way into. A crown there shows only the bottom fifth of itself,
     * which is its blue-black keyline and nothing else -- a hard dark rule ruled across open lawn,
     * which is worse than leaving the sky open. A row has to be mostly in frame to be closeable.
     */
    const topEdge = (
      r: Rect,
      cols: number[],
    ): { closed: number; open: number[]; run: number; of: number } => {
      const rows = topEdgeRows(r.y0);
      const open: number[] = [];
      let run = 0;
      let longest = 0;
      for (const x of cols) {
        if (rows.some((y) => isCanopy(x, y))) {
          run = 0;
          continue;
        }
        open.push(x);
        run++;
        longest = Math.max(longest, run);
      }
      return { closed: cols.length - open.length, open, run: longest, of: cols.length };
    };
    const visible: number[] = [];
    for (let x = visFirst; x <= visLast; x++) visible.push(x);
    const title = topEdge(HERO, visible);
    const closed = title.closed;
    const visibleCols = title.of;
    /*
     * RATCHETED TO THE TRUTH, 2026-10-20, and it went DOWN because it was measured wrong before.
     *
     * This read 11 while the audit looked at rows the camera does not draw: the frame's origin was
     * hand-rolled a tile high (see the note where CAMERA_LIFT used to be), so both the planter and
     * the checker worked a row above the visible edge and the pass scored 12 of 15 on rows nobody
     * sees. Pointed at the real rows, with `crownRow` now derived from the same `topEdgeRows` the
     * audit uses, the map closes EIGHT of 15 with a seven-column hole at 8-14.
     *
     * WHY THOSE SEVEN, because the next owner should not have to re-derive it: columns 8-10 are the
     * fork climbing to the stall and 11-16 are the market stall itself, and the framing register
     * will not hang a crown over something drawn and solid that is not another tree. That rule is
     * right in general -- a crown over a roof reads as a mistake -- and here it is what leaves the
     * middle of the hero shot open. Closing it is a composition decision, not a threshold: drop the
     * stall a row, let the band plant above a structure, or close that stretch with something other
     * than canopy. The guard counts CROWNS, so a stall standing at the edge does not score even
     * though it does occupy the eye.
     *
     * TRACED PROPERLY THIS ROUND, and the count did not move. Three of the seven -- 9, 10 and 11 --
     * were the footpath crossing these two rows in three different columns, and it now crosses them
     * in one, which is what the note above its waypoints always claimed. The other six did not come
     * back, and here is why, so that nobody spends a fourth round on it:
     *
     *   A crown on these rows needs a trunk on row 17 (mid, elder) or row 16 (sapling). Row 17 at
     *   columns 11-14 is the stall's COUNTER and row 16 is its AWNING, which sits on the `above`
     *   layer -- so `plantKind` refuses the crown outright at 16 and `overSomething` refuses it at
     *   17, and a trunk pair is two columns wide, so column 10 is refused by the awning at 11 as
     *   well. Every candidate the band can offer is blocked by the stall, at both scales, in every
     *   column it touches.
     *
     * WHAT WAS CONSIDERED AND NOT DONE. Counting the awning as closure was rejected: it is ONE row
     * deep, so the row above it is open lawn, and a guard that passed on that would be certifying
     * exactly the "bright field with the sky above it" it exists to catch. Dropping the stall a row
     * moves its clearing with it, which still covers these rows, and puts its counter on the
     * carriageway at this seed. Raising it a row -- awning on 15, counter on 16 -- WOULD make the
     * structure genuinely cut this edge over four columns, and then counting it would be honest; that
     * is the recommendation, and it is a change to where a landmark stands rather than to a framing
     * pass, so it is left for its owner to weigh against what the market is for.
     *
     * Raise this as the framing improves. Never lower it.
     */
    if (closed < 8)
      faults.push(
        `only ${closed} of the ${visibleCols} visible columns of the title camera's top edge ` +
          `carry canopy -- open at ${title.open.join(',')} ` +
          '(an open field with the sky above it: see DESIGN_BOARD section 2, cause 2)',
      );
    // Same ratchet, same cause: seven is the hole above the fork and the stall, not a target.
    if (title.run > 7)
      faults.push(
        `${title.run} columns of unbroken open sky run across the top of the title camera ` +
          `(at ${title.open.join(',')}): a hole in the middle of the hero shot`,
      );

    /*
     * 7b-arrive. AND THE SAME OF THE PAYOFF FRAME, which is the one every player ends on.
     *
     * It was worse than the title screen and nobody was counting: canopy closed five of its twenty
     * columns, all five bunched at the left edge, and for TWELVE of the rest the top edge of the
     * last frame of the game was a fence rail. The two horizontal runs of the enclosure have moved
     * out of shot and the strip that opened behind the cottage is planted, so what cuts this edge
     * is canopy, the roof and the two vertical post lines.
     *
     * The columns still open are the fence column itself at either side, the lawn between the gate
     * and the house, and the margin strip past the garden's far fence -- which is a post line and a
     * treeline rather than sky. Raise this as that corner improves; never lower it.
     */
    const arrive = topEdge(ARRIVE, columnsOf(ARRIVE));
    /*
     * RAISED TO 9 OF 20, WORST RUN 9, 2026-10-20. It stood at 7 and 10.
     *
     * Two changes bought it and both were about the garden's east side. Taking the east fence down to
     * a three-tile stub opened the margin strip to the garden, so it is no longer a dead end the
     * connectivity sweep has to reopen, and a treeline can stand in it: the first margin tree's crown
     * lands on the two rows this edge is measured over, which closes the corner the post line used to
     * fill. See the note on the east margin beside the treeline pass.
     *
     * WHAT IS STILL OPEN, so the next owner does not re-derive it: columns 49 to 55 are the cottage.
     * Its roof occupies the two rows below this edge and its gable and chimney the two rows ON it, so
     * a crown there needs a trunk on row 15 or 16 -- which is the ridge and the wall. There is no
     * routing for canopy over a house, and `standsOnTheRoof` is right to refuse a trunk directly above
     * the roof's own top row. Closing that stretch means moving the building, which is a bigger
     * decision than a framing pass should take on its own.
     *
     * Raise this as the garden improves. Never lower it.
     */
    if (arrive.closed < 9)
      faults.push(
        `only ${arrive.closed} of the ${arrive.of} columns of the arrival camera's top edge ` +
          `carry canopy -- open at ${arrive.open.join(',')} (the payoff frame's top edge)`,
      );
    if (arrive.run > 9)
      faults.push(
        `${arrive.run} columns of unbroken open sky run across the top of the arrival camera ` +
          `(at ${arrive.open.join(',')})`,
      );

    /*
     * ===========================================================================
     * 7g. NOTHING IS STAMPED IN A FILE INSIDE A FRAME A VISITOR SEES. This is the whole of the
     * regularity class, measured where it is read rather than where it is planted.
     * ===========================================================================
     *
     * Five materials have now been caught printing as a rule or a lattice -- trees, boulders, bushes,
     * flowers and fence posts -- and every one of them was a correctly drawn object on an even pitch.
     * The crowns have 7c, the boulders have 7e, and until this round the other three had nothing: a
     * ten-tile vertical bank of scrub down the right of the payoff frame, two rows of flower bushes
     * across the bottom of it, and a one-per-row file down the edge column all passed every invariant
     * in this file, because each pass only ever asked about its own material in its own place.
     *
     * So this asks the frames. Along any row and any column of a rectangle a visitor actually sees,
     * how long a run of PLANTING stands with no crown over it? Planting rather than everything,
     * because a fence, a wall and a river are barriers and have to be unbroken -- the fence gets its
     * own guard below, where the bound can be a fence's bound. The crown exclusion is the same one
     * the hem band uses and for the same reason: canopy over a run genuinely breaks it.
     *
     * THREE, AND IT IS NOT A MARGIN ABOVE THE TRUTH -- it is the design statement, which happens to
     * be what the map does in all three frames. A three-by-three mass of leaf with blooms in it is
     * the shape the board banks against a wall; the fourth tile in a straight line is where a mass
     * stops reading as grown. `tuft` and `mayBush` refuse that fourth tile at the source, and the
     * number is written out independently in both places and here, so putting either cap back to
     * something generous fails this rather than moving the bound with it. The file counted FIVE under
     * the facade before this round and FOUR at column 54 while the cap was only in `tuft`.
     *
     * Lower it as the planting improves; never raise it.
     */
    const plantedCover = (x: number, y: number): boolean => {
      const b = nameAt(below, x, y);
      return (b.startsWith('bush') || b.startsWith('flower')) && !isCanopy(x, y);
    };
    const fileIn = (cols: number[], rows: number[]): { run: number; where: string } => {
      let worst = 0;
      let where = 'nowhere';
      const walk = (
        cells: [number, number][],
        label: (from: number, to: number) => string,
      ): void => {
        let run = 0;
        for (const [i, [x, y]] of cells.entries()) {
          run = plantedCover(x, y) ? run + 1 : 0;
          if (run > worst) {
            worst = run;
            where = label(i - run + 1, i);
          }
        }
      };
      for (const x of cols)
        walk(
          rows.map((y) => [x, y] as [number, number]),
          (from, to) => `column ${x}, rows ${rows[from]}-${rows[to]}`,
        );
      for (const y of rows)
        walk(
          cols.map((x) => [x, y] as [number, number]),
          (from, to) => `row ${y}, columns ${cols[from]}-${cols[to]}`,
        );
      return { run: worst, where };
    };
    const planting: ReadonlyArray<{ what: string; cols: number[]; rows: number[]; limit: number }> =
      [
        { what: 'the title camera', cols: visible, rows: rowsOf(HERO), limit: 3 },
        { what: 'the arrival camera', cols: columnsOf(ARRIVE), rows: rowsOf(ARRIVE), limit: 3 },
        {
          what: 'the portrait camera',
          cols: columnsOf(PORTRAIT),
          rows: rowsOf(PORTRAIT),
          limit: 3,
        },
      ];
    const files = planting.map((f) => ({ ...f, ...fileIn(f.cols, f.rows) }));
    for (const f of files)
      if (f.run > f.limit)
        faults.push(
          `${f.run} tiles of planting stand in one unbroken file at ${f.where}, inside ` +
            `${f.what} (a bed is a mass with an edge; a file at a one-tile pitch is a lattice, ` +
            'however tidily it is gathered: see composition guard 7g)',
        );

    /*
     * ===========================================================================
     * 7i. THE FACADE IN THE PAYOFF FRAME IS NOT A FIELD OF BLANK PLASTER.
     *
     * Measured in PIXELS on the composed frame, because that is the unit the complaint was made in
     * and the only unit that can see it.
     * ===========================================================================
     *
     * "The cottage is six columns wide with a whole upper wall course of blank plaster, so roughly
     * four tiles of empty cream sit in the middle of the payoff shot and the building reads long and
     * low." Every existing guard in this section passed that map. 7g counts PLANTING in files; 7a
     * counts sand; 7b counts canopy on an edge. None of them can see a wall, and the six-axis score
     * cannot arbitrate it either -- it reported 0.416 while this was on screen, and swapping a hedge
     * for a treeline moved its distance by 0.006, because a bush and a crown have nearly the same
     * luma histogram and so do a blank wall and a detailed one.
     *
     * So this composes the arrival camera the way the renderer composes it -- three layers, each tile
     * in the orientation its mirror bits put it in -- and asks two questions of the pixels a player
     * is actually shown:
     *
     *   HOW MUCH LIME PLASTER IS IN THE FRAME AT ALL, and
     *   HOW BIG IS THE LARGEST UNBROKEN PATCH OF IT THAT CARRIES NO INCIDENT.
     *
     * WHAT COUNTS AS PLASTER IS A COLOUR, NOT A BRIGHTNESS, and the distinction is load-bearing. A
     * luma floor alone catches the sand apron, which is the other big bright mass in this frame and is
     * SUPPOSED to be plain. `wall` mixed towards `stone` is a warm NEUTRAL off-white -- its own note
     * records it landing eight to twelve between red and green and nine between green and blue --
     * while `path` is a deep tan at about thirty-five and fifty-four across the same two gaps, grass
     * is green (so red never leads), and slate is cool (so blue never trails). Those four materials
     * separate cleanly on the two gaps with room to spare.
     *
     * AND THE PATCH IS WHAT MAKES IT A GUARD RATHER THAN A HEADCOUNT. A plastered cottage is supposed
     * to have plaster on it; what it must not have is a bare 192-pixel band with nothing on it. The
     * incident test is the same 3x3 local-contrast question the edge axis asks, so a pixel counts as
     * featureless only if nothing within a pixel of it is more than fourteen luma away -- which the
     * ghost stones, the window reveals, the corner posts, the sill plate and the eave shadow all
     * break, and which an empty course does not.
     *
     * TWO-SIDED, like the plume guard in s-cottage.ts and for the same reason: the cheapest way to
     * pass a ceiling on flat cream is to paint no cream at all. The floor is what stops the fix being
     * "take the plaster off", and it is the bound that would fire if the building were narrowed again
     * past the point where the facade reads as a wall.
     *
     * MEASURED, both ways round, on the frame this renders:
     *
     *     four courses, six columns (the failure)       plaster 5,411 px   largest patch 1,556 px
     *     the same course restored at five columns      plaster 3,978 px   largest patch 1,207 px
     *     ONE blank wall tile where the lit window goes  plaster 2,171 px   largest patch   413 px
     *     three courses, five columns (now)             plaster 1,462 px   largest patch    70 px
     *
     * The first row is off the committed map at 1,280x800; the middle two were produced by editing
     * this file, re-rendering `--frame arrive` and reading the composition line, then restoring it
     * and checking it back with sha1. Both bounds fire on the restored course and the patch bound
     * fires on one bare tile, which is what says it discriminates rather than only catching the
     * worst case.
     */
    /** Reported on the composition line so the next owner reads the numbers rather than re-deriving. */
    const facade = ((): { plaster: number; patch: number } => {
      /** Per raw gid, the tile as it is STAMPED -- mirror bits included, copied rather than drawn. */
      const stampCache = new Map<number, Img | null>();
      const stamped = (raw: number): Img | null => {
        const hit = stampCache.get(raw);
        if (hit !== undefined) return hit;
        const name = TILE_NAMES[(raw & BASE_GID) - 1];
        const painter = name === undefined ? undefined : TILE_PAINTERS[name];
        if (!painter) {
          stampCache.set(raw, null);
          return null;
        }
        const base = new Img(TILE, TILE);
        painter(base);
        const h = (raw & FLIP_H) !== 0;
        const v = (raw & FLIP_V) !== 0;
        const d = (raw & FLIP_D) !== 0;
        const out = new Img(TILE, TILE);
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++) {
            const ax = h ? TILE - 1 - x : x;
            const ay = v ? TILE - 1 - y : y;
            // Bytes, not `px`: a mirror must not change a colour, and `px` composites.
            out.data.set(base.get(d ? ay : ax, d ? ax : ay), (y * TILE + x) * 4);
          }
        stampCache.set(raw, out);
        return out;
      };
      const cols = columnsOf(ARRIVE);
      const rows = rowsOf(ARRIVE);
      const shot = new Img(cols.length * TILE, rows.length * TILE);
      for (const layer of [ground, below, above])
        for (const [ty, y] of rows.entries())
          for (const [tx, x] of cols.entries()) {
            const src = stamped(at(layer, x, y));
            if (src) shot.blit(src, tx * TILE, ty * TILE);
          }

      /** Weathered lime: bright, warm-led, and never far from neutral. */
      const isPlaster = (x: number, y: number): boolean => {
        const c = shot.get(x, y);
        return (
          c[3] !== 0 &&
          lumaOf(c) >= 195 &&
          c[0] > c[1] &&
          c[1] > c[2] &&
          c[0] - c[1] <= 22 &&
          c[1] - c[2] <= 22
        );
      };
      let plaster = 0;
      const featureless = new Uint8Array(shot.w * shot.h);
      for (let y = 0; y < shot.h; y++)
        for (let x = 0; x < shot.w; x++) {
          if (!isPlaster(x, y)) continue;
          plaster++;
          if (x < 1 || y < 1 || x >= shot.w - 1 || y >= shot.h - 1) continue;
          let lo = Infinity;
          let hi = -Infinity;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const l = lumaOf(shot.get(x + dx, y + dy));
              lo = Math.min(lo, l);
              hi = Math.max(hi, l);
            }
          if (hi - lo <= 14) featureless[y * shot.w + x] = 1;
        }
      let patch = 0;
      let patchAt = '';
      const seenPx = new Uint8Array(shot.w * shot.h);
      for (let y = 0; y < shot.h; y++)
        for (let x = 0; x < shot.w; x++) {
          const start = y * shot.w + x;
          if (!featureless[start] || seenPx[start]) continue;
          let n = 0;
          let sx = 0;
          let sy = 0;
          const stack = [start];
          seenPx[start] = 1;
          while (stack.length) {
            const i = stack.pop()!;
            const px = i % shot.w;
            const py = (i / shot.w) | 0;
            n++;
            sx += px;
            sy += py;
            for (const [dx, dy] of NEIGHBOURS) {
              const nx = px + dx;
              const ny = py + dy;
              if (nx < 0 || ny < 0 || nx >= shot.w || ny >= shot.h) continue;
              const j = ny * shot.w + nx;
              if (featureless[j] && !seenPx[j]) {
                seenPx[j] = 1;
                stack.push(j);
              }
            }
          }
          if (n > patch) {
            patch = n;
            patchAt = `tile (${(cols[0]! + sx / n / TILE).toFixed(1)}, ${(rows[0]! + sy / n / TILE).toFixed(1)})`;
          }
        }

      /*
       * THE THREE BOUNDS, each set against a render rather than chosen.
       *
       *   plaster, at least 480    a third of what a cottage with one course of wall shows. Below
       *                            this the facade has stopped being a plastered wall, which is the
       *                            cheap way to pass the other two.
       *   plaster, at most 2,600   the blank upper course measured 3,978 and the facade without it
       *                            1,462. This is the "field of cream" bound.
       *   patch, at most 240       the sharp one. The good facade's widest featureless patch is 70;
       *                            a SINGLE blank wall tile dropped in where the lit window goes
       *                            measures 413, and the whole blank course 1,207. 240 sits between
       *                            70 and 413 -- so the painter may treble the flat plaster it
       *                            leaves and one bare tile still fires. An earlier draft of this
       *                            guard said 420, which the whole course tripped and one tile
       *                            missed by seven pixels; a bound that only catches the worst case
       *                            is a bound that will be walked back to one tile at a time.
       *
       * All three were measured by editing this file, re-rendering `--frame arrive` and reading the
       * composition line, then restoring it and checking it back with sha1.
       */
      const FACADE_PIXELS = { plasterLo: 480, plasterHi: 2600, patchHi: 240 } as const;
      const say =
        `plaster ${plaster}px, largest featureless patch ${patch}px` +
        (patch > 0 ? ` at ${patchAt}` : '');
      if (plaster < FACADE_PIXELS.plasterLo)
        faults.push(
          `the payoff frame has almost no lime plaster in it (want at least ` +
            `${FACADE_PIXELS.plasterLo}px): ${say}. Grandma's cottage is a plastered cottage; a ` +
            'facade that passes guard 7i by having no wall left has not passed it.',
        );
      if (plaster > FACADE_PIXELS.plasterHi)
        faults.push(
          `${plaster}px of the payoff frame is lime plaster (want at most ` +
            `${FACADE_PIXELS.plasterHi}px): ${say}. That is a field of cream in the middle of the ` +
            'last frame of the game -- see the facade note in the cottage block.',
        );
      if (patch > FACADE_PIXELS.patchHi)
        faults.push(
          `${patch}px of unbroken featureless plaster stand in the payoff frame (want at most ` +
            `${FACADE_PIXELS.patchHi}px): ${say}. A wall course with nothing on it is the "four ` +
            'tiles of empty cream" the design board named; break it with an opening, not a texture.',
        );
      return { plaster, patch };
    })();

    /*
     * ===========================================================================
     * 7h. AND THE FENCE RUN IS BROKEN BY POSTS, which is the client's note three rounds running.
     * ===========================================================================
     *
     * `fence-post` is four receding caps at an eight-pixel pitch. Stamped down thirteen consecutive
     * rows it is fifty-two caps with no daylight and nothing at either end to turn them, which is the
     * brown rope the client keeps seeing; the painter is not the problem and never was. What breaks it
     * is a wide flat-capped post every two or three tiles, and the board's own run shows about seven
     * caps between posts, which is two of our tiles.
     *
     * Measured in plain tiles off the finished layer, so putting the planter's pitch back to "every
     * row" fails here rather than moving the bound with it. It is deliberately NOT restricted to a
     * frame: a rope is a rope wherever the player meets it, and the whole of this fence is in the
     * payoff frame anyway.
     */
    let postRun = 0;
    let postAt = 'nowhere';
    for (let x = 0; x < MAP_W; x++) {
      let run = 0;
      for (let y = 0; y < MAP_H; y++) {
        run = nameAt(below, x, y) === 'fence-post' ? run + 1 : 0;
        if (run > postRun) {
          postRun = run;
          postAt = `column ${x}, rows ${y - run + 1}-${y}`;
        }
      }
    }
    if (postRun > 3)
      faults.push(
        `${postRun} tiles of receding fence run stand unbroken at ${postAt} -- ${postRun * 4} caps ` +
          'at one pitch with no post to turn them (the board puts a post every seven caps: see ' +
          'composition guard 7h)',
      );
    /*
     * ...AND NO PICKET RAIL LIES ACROSS THE PAYOFF FRAME. The two horizontal runs of the enclosure
     * were moved out of that shot last round because the top edge of the last frame of the game was a
     * fence rail across twelve of its twenty columns. Nothing but this stops them coming back: they
     * are solid either way, so no reachability test can see where they are. Three is the board's own
     * picket run, so a short length beside the building still passes.
     */
    let railRun = 0;
    let railAt = 'nowhere';
    for (const y of rowsOf(ARRIVE)) {
      let run = 0;
      for (const x of columnsOf(ARRIVE)) {
        run = nameAt(below, x, y) === 'fence-h' ? run + 1 : 0;
        if (run > railRun) {
          railRun = run;
          railAt = `row ${y}, columns ${x - run + 1}-${x}`;
        }
      }
    }
    if (railRun > 3)
      faults.push(
        `${railRun} tiles of picket rail run across ${railAt}, inside the arrival camera ` +
          '(a pen, photographed: see composition guard 7h)',
      );

    /*
     * 7b-portrait. THE PHONE FRAME, which until this round nobody had composed at all.
     *
     * A 375-wide phone shows 11.53 x 16.69 tiles and the title card docks BELOW the world rather
     * than beside it, so what a visitor sees is the top band of the camera -- about seven tiles of
     * it. For three rounds that band was a lattice of same-scale crowns on the left, five columns
     * of bare lawn on the right, a sliver of the market stall clipped at a corner, and no path, no
     * fork and no landmark anywhere in it.
     *
     * Two things are asserted, because they are the two a player needs: she can see the path, and
     * she can see something to walk to. Neither is a share or a histogram -- both of those were
     * perfectly healthy while the frame was unreadable.
     */
    const portraitCols = columnsOf(PORTRAIT);
    const portraitRows = rowsOf(PORTRAIT);
    let portraitSand = 0;
    for (const y of portraitRows) for (const x of portraitCols) if (isSand(x, y)) portraitSand++;
    const portraitMarks = objects.filter((o) => {
      if (!o.name.startsWith('prop-') && !o.name.startsWith('npc-')) return false;
      const r = rectOf(o.name);
      return (
        r.x1 >= portraitCols[0]! &&
        r.x0 <= portraitCols[portraitCols.length - 1]! &&
        r.y1 >= portraitRows[0]! &&
        r.y0 <= portraitRows[portraitRows.length - 1]!
      );
    }).length;
    if (portraitSand < 10)
      faults.push(
        `only ${portraitSand} tile(s) of path in the band a 375 portrait visitor sees ` +
          '(she has to be able to see the walk she is being asked to take)',
      );
    if (portraitMarks < 1)
      faults.push('no landmark stands in the band a 375 portrait visitor sees');

    /*
     * ===========================================================================
     * 7k. NO PROP IS CUT BY THE EDGE OF A COMPOSED FRAME -- and the market stall is the single
     * exception, which is a PROOF that no placement avoids it rather than a waiver.
     * ===========================================================================
     *
     * The client photographed the market stall sliced down its length at the right edge of a phone
     * and called it a broken box against the border, which is exactly right: a tree or a bush
     * cropped by the frame reads as forest continuing past the screen, and a drawn, rectilinear
     * STRUCTURE cropped by the frame reads as a rendering fault. That is the defect class, and
     * until this pass nothing measured it.
     *
     * WHY THE STALL CANNOT BE MOVED TO FIX IT, measured through the real `cameraFor` at twenty
     * viewports before anything was touched, so that nobody spends a round re-running it:
     *
     *   1. AT THE SPAWN THE CAMERA IS PINNED TO THE MAP'S WEST EDGE AT EVERY VIEWPORT. Purple stands
     *      5.5 tiles from the west wall and the NARROWEST camera the game will build is MIN_VIEW,
     *      11 tiles -- so `frameAt`'s clamp puts x0 at 0.00 for all of them, phone to studio
     *      display. The stall's distance from the right border is therefore a pure function of the
     *      camera's WIDTH and nothing else. That is the premise everything below rests on, and it
     *      is asserted rather than remembered, two paragraphs down.
     *   2. SO A PLACEMENT AT x0 IS SLICED BY EXACTLY THOSE CAMERAS WITH x0 < width < x0 + 4. The
     *      reviewed cameras run from 11.00 tiles (a 320 phone) to 40.00 (the client's 1673x449),
     *      continuously -- portrait phones cluster at 11.06 to 13.25, landscape at 15.38 and up.
     *      Being whole everywhere therefore needs x0 + 4 <= 11, i.e. x0 <= 7; being absent
     *      everywhere needs x0 >= 40. Every column from 8 to 24 is cut by something.
     *   3. AND x0 <= 7 IS OCCUPIED BY THE TWO THINGS THE SPAWN FRAME IS BUILT OUT OF. Columns 4-8
     *      carry the north treeline -- trunks on rows 14-17 under canopy on rows 13-16 -- which is
     *      the stand that closes the top of the title camera and that 7b ratchets and forbids
     *      lowering. Column 9 carries the fork climbing north, rows 14-17, with the signpost in its
     *      crook at (9,18). A four-wide counter at x0 <= 7 spans one or both.
     *   4. MOVING IT EAST DOES NOT FIX IT, IT RELOCATES IT. x0 = 13 clears the named phones and
     *      starts slicing 1024- and 1100-wide landscape windows; x0 = 14 clears every phone and
     *      cuts the stall out of the narrow laptop range instead. Trading a phone slice for a
     *      laptop slice on a B2B research page is not a trade worth making, and it would also fell
     *      the sapling pair standing at columns 15-17 and move the market away from the rabbit who
     *      keeps it.
     *
     * SO THE STALL STAYS AT ITS PUBLISHED COLUMN and the slice is accepted, with two things locked
     * down so the acceptance cannot rot into a silent drift:
     *
     *   - EVERY OTHER PROP, IN EVERY COMPOSED FRAME, MUST BE WHOLE OR ABSENT. Measured: today the
     *     stall is the only object any frame's edge cuts, in all four. This is the pass that will
     *     catch the NEXT structure planted at a frame edge, which is the general defect and the
     *     reason this is not simply a note about one stall.
     *   - AND THE STALL MAY ONLY BE CUT BY A PORTRAIT FRAME'S EAST EDGE. If it is ever cut by the
     *     title or payoff camera, or on its north, south or west side, the proof above no longer
     *     describes the map and the next owner has to re-derive it rather than inherit a waiver.
     *
     * THE BOUNDS COME FROM `rectOf`, THE PUBLISHED OBJECT RECTANGLE, NOT FROM THE `11 + i` LOOP
     * THAT LAYS THE TILES. This is trap 5 and it is the whole reason this pass is worth writing: a
     * guard that asked the placement loop where the stall is would move with the stall and go on
     * passing while the client went on seeing a sliced box. `prop-stall`'s rectangle is what
     * `forest-scene.ts` and every framing decision read, so it is what this measures.
     */
    const composed: ReadonlyArray<readonly [string, Rect, boolean]> = [
      ['the title camera', HERO, false],
      ['the phone camera', PORTRAIT_FULL, true],
      ['the payoff camera', ARRIVE, false],
      ["the phone's payoff camera", ARRIVE_PHONE, true],
    ];
    for (const [what, frame, portrait] of composed)
      for (const o of objects) {
        // A `sign-*` is a drawn structure as a `prop-*` is (2026-10-23), and is held whole the same.
        if (!/^(prop|npc|sign)-/.test(o.name)) continue;
        // `rectOf` is inclusive at both ends; a frame is half-open, so take the span to x1 + 1.
        const r = rectOf(o.name);
        const [x0, x1, y0, y1] = [r.x0, r.x1 + 1, r.y0, r.y1 + 1];
        if (!(x1 > frame.x0 && x0 < frame.x1 && y1 > frame.y0 && y0 < frame.y1)) continue;
        if (x0 >= frame.x0 && x1 <= frame.x1 && y0 >= frame.y0 && y1 <= frame.y1) continue;
        const sides = [
          x0 < frame.x0 ? 'west' : '',
          x1 > frame.x1 ? 'east' : '',
          y0 < frame.y0 ? 'north' : '',
          y1 > frame.y1 ? 'south' : '',
        ].filter(Boolean);
        if (o.name === 'prop-stall' && portrait && sides.length === 1 && sides[0] === 'east')
          continue;
        /*
         * THE NOTICE'S EAST HALF AT THE PHONE'S PAYOFF FRAME (2026-10-23), and it is not a waiver: it
         * is the same rule asked of the PIXELS rather than of the rectangle. Since the notice is two
         * tiles its rectangle reaches column 44, and the phone's payoff frame opens at x 44.75, so the
         * rectangle is cut. What that frame shows of the notice is the last quarter of
         * `notice-board-r`, and the page, its ring and its tufts all end well west of that quarter --
         * the drawn east edge is measured here off the tile against the lawn it is painted on, so a
         * wider page that did reach the frame edge would fire this exactly as before.
         */
        if (o.name === 'sign-research' && sides.length === 1 && sides[0] === 'west') {
          const drawn = new Img(TILE, TILE);
          TILE_PAINTERS['notice-board-r']!(drawn);
          const lawn = new Img(TILE, TILE);
          TILE_PAINTERS['grass-1']!(lawn);
          let east = -1;
          for (let y = 0; y < TILE; y++)
            for (let x = 0; x < TILE; x++) {
              const a = drawn.get(x, y);
              const b = lawn.get(x, y);
              if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) east = Math.max(east, x);
            }
          if (r.x1 + (east + 1) / TILE <= frame.x0) continue;
        }
        faults.push(
          `${o.name} is cut by the ${sides.join(' and ')} edge of ${what} ` +
            `(its rectangle is columns ${r.x0}-${r.x1}, rows ${r.y0}-${r.y1}; the frame is ` +
            `x ${frame.x0.toFixed(2)}-${frame.x1.toFixed(2)}, y ${frame.y0.toFixed(2)}-` +
            `${frame.y1.toFixed(2)}): a drawn structure sliced by the border reads as a fault`,
        );
      }

    /*
     * THE PREMISE OF ALL OF THAT, ASSERTED RATHER THAN REMEMBERED. Every figure in 7k follows from
     * the camera being pinned to the map's west edge at the spawn, which holds only while Purple
     * stands within half of the NARROWEST camera of that edge. Move the spawn east, or raise
     * MIN_VIEW, and the stall's framing stops being a function of camera width alone -- at which
     * point 7k's exception is describing a map that no longer exists. This is the fact that would
     * otherwise sit in the prose above and quietly go stale, which is trap 1.
     */
    const narrowest = Math.min(
      ...Object.values(REFERENCE_VIEWPORTS).map((vp) => cameraFor(vp).tiles.width),
      MIN_VIEW.width / TILE,
    );
    if (cameraCentreTiles(SPAWN).x > narrowest / 2)
      faults.push(
        `the spawn camera is no longer pinned to the map's west edge (centre ` +
          `${cameraCentreTiles(SPAWN).x.toFixed(2)} tiles, narrowest camera ${narrowest.toFixed(2)}): ` +
          "7k's proof that the market stall cannot be moved out of the slice must be re-derived",
      );

    /*
     * AND THE KEEPER STANDS AT THE COUNTER SHE KEEPS. Both are literals in this file, placed four
     * hundred lines apart, and nothing tied them together: the rabbit is the reason the stall is
     * drawn at all, so a round that nudges the market east to chase the phone frame would leave her
     * standing in open lawn beside it. Asked of the two PUBLISHED rectangles, so it moves with
     * neither placement loop.
     */
    const stallRect = rectOf('prop-stall');
    const keeper = rectOf('npc-rabbit');
    if (keeper.x0 < stallRect.x0 || keeper.x1 > stallRect.x1)
      faults.push(
        `the rabbit stands at columns ${keeper.x0}-${keeper.x1}, outside her own stall's ` +
          `columns ${stallRect.x0}-${stallRect.x1}`,
      );

    /*
     * 7e. BOULDERS DO NOT STACK, which is the trees' topiary complaint in a material no guard was
     * watching. Measured off the finished map and in plain tiles, so putting the planter's own
     * limit back to something generous fails here rather than moving the bound with it.
     */
    let tallestScree = 0;
    let screeAt = '';
    for (let x = 0; x < MAP_W; x++) {
      let run = 0;
      for (let y = 0; y < MAP_H; y++) {
        run = (at(below, x, y) & BASE_GID) === gid('rock') ? run + 1 : 0;
        if (run > tallestScree) {
          tallestScree = run;
          screeAt = `column ${x}, rows ${y - run + 1}-${y}`;
        }
      }
    }
    if (tallestScree > 4)
      faults.push(
        `${tallestScree} boulders stand one on top of another at ${screeAt} ` +
          '(a dry-stone wall, not a bank)',
      );

    /*
     * 7f. NO PATH ENDS IN A DANGLING TILE, unless it is arriving at something.
     *
     * One tile of sand with sand on one side is a smudge, not a path -- four of them were on the
     * map. The exception is what a footpath is FOR: the last tile of the owl's path stands against
     * him, the last tile of the lantern's stands against the post. A terminus beside a prop or a
     * traveller is an arrival; anywhere else it is a leftover.
     *
     * SIGNS AND BYSTANDERS ARRIVE TOO, since 2026-10-25 (docs/GATEKEEPER.md), and it is this
     * guard's own rule rather than a new one: the north footpath used to end against the Owl, an
     * `npc-`, and ends against the DEAD END sign where he stood, a `sign-` (which audit 5 holds solid
     * as it holds a `prop-`); the Magpie's lane ends against her, a `bystander-`. Both are the
     * "something" a path arrives at. A path end in open lawn still fails.
     */
    const marks = new Set<number>();
    for (const o of objects) {
      if (!['prop-', 'npc-', 'sign-', 'bystander-'].some((p) => o.name.startsWith(p))) continue;
      const r = rectOf(o.name);
      for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) marks.add(y * MAP_W + x);
    }
    const dangling: [number, number][] = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        if (!isSand(x, y)) continue;
        if (NEIGHBOURS.filter(([dx, dy]) => isSand(x + dx, y + dy)).length > 1) continue;
        if (NEIGHBOURS.some(([dx, dy]) => marks.has((y + dy) * MAP_W + (x + dx)))) continue;
        dangling.push([x, y]);
      }
    fault('path tile(s) dangling off the end of nothing', dangling);

    /*
     * 7c. NO TOPIARY COLUMNS, AND NO WALLS OF FOLIAGE EITHER.
     *
     * A file is trees sharing an anchor column at a tight pitch, which is what greedy packing on a
     * 2x3 footprint produces and what the board's groves never show.
     *
     * THE FILE TEST ALONE COULD NOT SEE THE WORST CASE ON THE MAP. `fileMate` asks for daylight
     * between the crowns -- a trunk-row gap of three or more -- because two trees two rows apart
     * are a MASS rather than a line, which is true and is the reason the test is written that way.
     * The consequence was that a SOLID stack is invisible to it: the longest unbroken vertical run
     * of crown on the map was thirteen tiles at column 47, and because it had no daylight in it at
     * all it was not a file by this definition and nothing counted it. Thirteen tiles is longer
     * than the camera is tall. So the stack is measured directly, off the canopy layer, where no
     * definition of a file can step over it.
     *
     * AND THE GAP TEST IS WRITTEN OUT HERE RATHER THAN CALLING `fileMate`. This guard used to call
     * the planter's own predicate, which meant the planter set its own auditor's idea of what a
     * file is: widen `fileMate`'s window and this count falls without a single tree moving. The
     * duplication below is deliberate, it is the point, and the two are meant to be compared by
     * eye rather than kept in step by sharing a body. If `fileMate` ever changes, come and decide
     * separately whether the AUDIT's definition of a topiary column should change with it.
     */
    /** Deliberately a copy of `fileMate`'s window, not a call to it. See directly above. */
    const auditedFileMate = (a: number, b: number): boolean => {
      const gap = Math.abs(a - b);
      return gap >= 3 && gap <= 7;
    };
    let longestFile = 0;
    let fileAt = '';
    const byColumn = new Map<number, number[]>();
    /*
     * The two columns `breakHem` plants down are not in this. It walks column 0 and column 58 top
     * to bottom and drops a tree wherever the sealed band has run bare for five tiles, so a line of
     * trees there is that pass doing its job -- and those two columns are the edge of the world,
     * which the camera clamps to and shows half of. The complaint is about files INSIDE the wood.
     */
    for (const t of trees)
      if (t.x > 1 && t.x < MAP_W - 3) byColumn.set(t.x, [...(byColumn.get(t.x) ?? []), t.y]);
    for (const [x, ys] of byColumn) {
      const sorted = [...ys].sort((a, b) => a - b);
      let run = 1;
      for (let i = 1; i < sorted.length; i++) {
        run = auditedFileMate(sorted[i]!, sorted[i - 1]!) ? run + 1 : 1;
        if (run > longestFile) {
          longestFile = run;
          fileAt = `column ${x}, rows ${sorted.slice(i - run + 1, i + 1).join(',')}`;
        }
      }
      longestFile = Math.max(longestFile, 1);
    }
    if (longestFile > 3)
      faults.push(
        `${longestFile} crowns stand in one straight vertical file at ${fileAt} ` +
          '(a topiary column, not a grove)',
      );
    let tallestStack = 0;
    let stackAt = '';
    for (let x = 0; x < MAP_W; x++) {
      let run = 0;
      for (let y = 0; y < MAP_H; y++) {
        run = isCanopy(x, y) ? run + 1 : 0;
        if (run > tallestStack) {
          tallestStack = run;
          stackAt = `column ${x}, rows ${y - run + 1}-${y}`;
        }
      }
    }
    if (tallestStack > 10)
      faults.push(
        `${tallestStack} tiles of unbroken crown stand in one column at ${stackAt} ` +
          '(a wall of foliage taller than the camera, which a file test cannot see)',
      );

    /*
     * ===========================================================================
     * 7j. NO BRICK COURSE: NO COLUMN WHERE TWO BURIED TRUNKS STAND ONE ABOVE ANOTHER.
     * ===========================================================================
     *
     * The third shape, and the one the client is pointing at. A cell with a trunk on `below` and
     * somebody else's crown on `above` paints the trunk and then paints over it -- see the long
     * note above `plantKind` -- and a RUN of those down one column leaves no bark anywhere between
     * one crown's hem and the next crown's cap, so the tile boundaries read as mortar and the
     * column reads as a course of green bricks. 7c cannot see it: the crowns in a brick course are
     * a solid stack, which `auditedFileMate` calls a mass, and the stack is nine high at worst,
     * which is inside `tallestStack`'s ten.
     *
     * TWO IS WRITTEN OUT HERE AND IT IS NOT `BURIED_COURSE_LIMIT`, deliberately, and for the same
     * reason 7c copies `fileMate`'s window instead of calling it: a guard that reads its subject's
     * own constant cannot catch that constant being loosened. Raise the sweep's limit and this
     * fires -- proved, by raising it to five and watching seven courses print. Compare the two by
     * eye; do not join them.
     *
     * THE ESCAPE CLAUSE IS A DELIBERATE COPY OF THE SWEEP'S OWN TEST, NOT A CALL TO IT, and the
     * first draft of it was wrong in a way worth recording. It excused any course whose trees were
     * all flagged `framing` or `verge` -- the sweep's old, coarse rule -- and that is precisely the
     * rule this round had to narrow. Proved by breaking it: put the coarse rule back in the sweep
     * and the client's own course at column 2 rows 15-17 returns to the map AND THE GUARD STAYS
     * SILENT, because the same coarseness that let the course stand also excused it. A guard whose
     * exemption widens with its subject's is not a guard. So the copy below asks the sharpened
     * question -- a verge tree, or a framing tree that is the SOLE closer of one of its columns --
     * and the coarse version now fires. If `heldForTheFrame` changes again, come and decide
     * separately whether this should; do not make them share a body.
     *
     * It fires on nothing today: the sweep reaches every course and the count is zero. The clause
     * stays because the alternative is a build that cannot be made green without editing code -- if
     * the only way to break a future course were to fell the one tree holding a camera's top edge
     * open, this should record that decision rather than block on it.
     *
     * MEASURED, on the committed map before this round: 35 runs of two, seven of three, and one
     * each of four, five and six, the worst at column 54 rows 27-32. After the sweep: 31 runs of
     * two and nothing longer anywhere on the map.
     */
    {
      const crownOwner = new Map<number, Tree>();
      const trunkOwner = new Map<number, Tree>();
      for (const t of trees) {
        for (const [dx, dy] of t.k.crown) crownOwner.set((t.y + dy) * MAP_W + (t.x + dx), t);
        for (let dx = 0; dx < t.k.trunk.length; dx++) trunkOwner.set(t.y * MAP_W + (t.x + dx), t);
      }
      /** Deliberately a copy of the sweep's cap, not a reference to it. See directly above. */
      const AUDITED_COURSE = 2;
      /** Deliberately a copy of `heldForTheFrame`, not a call to it. See directly above. */
      const auditedHold = ((): ((t: Tree) => boolean) => {
        const closing = new Map<number, number>();
        const columns = (t: Tree): number[] => {
          const keys: number[] = [];
          for (const [bi, band] of FRAMINGS.entries())
            for (const [dx, dy] of t.k.crown) {
              const cx = t.x + dx;
              const cy = t.y + dy;
              if (cx < band.x0 || cx > band.x1) continue;
              if (cy !== band.row - 2 && cy !== band.row - 1) continue;
              if (!keys.includes(bi * MAP_W + cx)) keys.push(bi * MAP_W + cx);
            }
          return keys;
        };
        for (const t of trees)
          for (const key of columns(t)) closing.set(key, (closing.get(key) ?? 0) + 1);
        return (t) =>
          t.verge === true ||
          (t.framing === true && columns(t).some((key) => (closing.get(key) ?? 0) < 2));
      })();
      const courses: string[] = [];
      for (let x = 0; x < MAP_W; x++) {
        let run = 0;
        for (let y = 0; y <= MAP_H; y++) {
          const key = y * MAP_W + x;
          if (y < MAP_H && crownOwner.has(key) && trunkOwner.has(key)) {
            run++;
            continue;
          }
          if (run > AUDITED_COURSE) {
            const held: Tree[] = [];
            for (let ry = y - run; ry < y; ry++)
              for (const owner of [crownOwner.get(ry * MAP_W + x), trunkOwner.get(ry * MAP_W + x)])
                if (owner && !held.includes(owner)) held.push(owner);
            if (!held.every((t) => auditedHold(t)))
              courses.push(`column ${x}, rows ${y - run}-${y - 1} (${run} deep)`);
          }
          run = 0;
        }
      }
      if (courses.length > 0)
        faults.push(
          `${courses.length} brick course(s) of buried trunk under crown at ${courses.join('; ')} ` +
            '(a column of stacked crowns with no bark between them: see composition guard 7j)',
        );
    }

    /*
     * 7d. ALL FOUR GROUND VARIANTS ARE IN USE WHERE THEY CAN BE SEEN. Measured over grass with no
     * crown over it, which is the half of the ground a frame is made of; over the whole map the
     * number is dominated by tiles under canopy, which the cast shadow clamps to one rung by
     * design. See the long note on the field's own cuts.
     */
    const seen = new Map<string, number>();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const name = nameAt(ground, x, y);
        if (!name.startsWith('grass') || at(above, x, y) !== 0) continue;
        seen.set(name, (seen.get(name) ?? 0) + 1);
      }
    const lit = [...seen.values()].reduce((a, b) => a + b, 0);
    for (const name of ['grass-0', 'grass-1', 'grass-2', 'grass-3']) {
      const share = ((seen.get(name) ?? 0) / Math.max(lit, 1)) * 100;
      if (share < 2.5)
        faults.push(`${name} is ${share.toFixed(1)}% of the ground a player can see (under 2.5%)`);
      if (share > 60)
        faults.push(`${name} is ${share.toFixed(1)}% of the ground a player can see (over 60%)`);
    }
    console.log(
      `  composition: hero sand ${heroShare.toFixed(1)}%, deepest column ${deepestColumn}; ` +
        `edge ruled for ${straightest} column(s) at worst, ${bitten} bitten, ` +
        `north edge on ${rowsUsed} rows; title top edge ${closed}/${visibleCols} closed (worst ` +
        `open run ${title.run}), arrival ${arrive.closed}/${arrive.of} (worst run ${arrive.run}); ` +
        `longest planting file ${files.map((f) => f.run).join('/')} (title/arrival/portrait), ` +
        `fence run ${postRun}, rail ${railRun}; ` +
        `facade plaster ${facade.plaster}px with its widest featureless patch ${facade.patch}px; ` +
        `longest crown file ${longestFile}, tallest stack ${tallestStack}; visible ground ${[
          'grass-0',
          'grass-1',
          'grass-2',
          'grass-3',
        ]
          .map((n) => (((seen.get(n) ?? 0) / Math.max(lit, 1)) * 100).toFixed(0))
          .join('/')}`,
    );
    /*
     * THE ACCEPTED SLICE, PRINTED EVERY REGENERATION. 7k proves the market stall cannot be moved
     * out of the phone frame's right edge, and an accepted defect that nobody can see the size of
     * is one round away from being an accepted defect nobody remembers accepting. So the share of
     * the stall each reference camera actually shows is reported rather than described: if a
     * future change to the camera, the spawn or the stall moves these numbers, they move in the
     * build log where somebody will read them.
     */
    const stallSeen = rectOf('prop-stall');
    console.log(
      `  market stall in frame: ${Object.entries(REFERENCE_VIEWPORTS)
        .map(([name, vp]) => {
          const frame = frameAt(vp, cameraCentreTiles(SPAWN));
          const span = stallSeen.x1 + 1 - stallSeen.x0;
          const shown =
            Math.max(0, Math.min(frame.x1, stallSeen.x1 + 1) - Math.max(frame.x0, stallSeen.x0)) /
            span;
          return `${name} ${(shown * 100).toFixed(0)}%`;
        })
        .join(', ')} (columns ${stallSeen.x0}-${stallSeen.x1}; see composition guard 7k)`,
    );
  }

  /*
   * ===========================================================================
   * 15. THE TWO WAYS OVER THE RIVER TAKE ABOUT THE SAME TIME (2026-10-25, docs/GATEKEEPER.md).
   * ===========================================================================
   *
   * The client's rule: "The two routes, bridge and flight, must take about the same time to Grandma
   * (within 10% of each other, flight included). Otherwise the choice is about the clock, not the
   * skill." So both are WALKED here, on the finished collision layer, and the build fails when
   * they drift apart:
   *
   *   bridge  the spawn, to a cell beside the Gatekeeper, over the deck (the gate's cells are
   *           walkable in `collision`; the game is what shuts them), to `trigger-cottage`;
   *   flight  the spawn, to a cell beside the Magpie, then the flight's time, then from
   *           `wing-landing` to `trigger-cottage`.
   *
   * A walk is the shortest path over walkable cells, eight ways with diagonals at root two, the way
   * the game moves Purple (`logic.ts`: normalised diagonals). A diagonal is refused when either cell
   * it cuts past is solid, because her foot box cannot pass between two corners. Speed is core's
   * `v2.WALK_WORLD.walkSpeed`, which `packages/core`'s floor test derives from the game's own
   * `WALK_SPEED`, so the flight converts to tiles off the same number the clock is kept with.
   *
   * `FLIGHT_MS` is the brief's two seconds -- content's `short-cut` effect carries `flightMs: 2000`.
   * This file does not read content, so if the flight is ever retimed this constant moves with it.
   * Talking is not counted on either side: each route meets exactly one stranger.
   */
  {
    const FLIGHT_MS = 2000;
    const tilesPerSecond = v2.WALK_WORLD.walkSpeed / TILE;
    // The contract puts the landing ON a path that joins the road to Grandma, so it is asked: a
    // flight that sets her down in the scrub or in the river is not that.
    if (!nameAt(ground, WING_LANDING.x, WING_LANDING.y).startsWith('path'))
      faults.push(
        `wing-landing (${WING_LANDING.x},${WING_LANDING.y}) is not on a path ` +
          `(${nameAt(ground, WING_LANDING.x, WING_LANDING.y)})`,
      );
    const walkFrom = (sx: number, sy: number): Float64Array => {
      const dist = new Float64Array(MAP_W * MAP_H).fill(Infinity);
      const done = new Uint8Array(MAP_W * MAP_H);
      dist[sy * MAP_W + sx] = 0;
      // A map of 2,520 cells: a linear scan for the nearest open cell is fast enough and has no
      // heap to get wrong.
      for (;;) {
        let k = -1;
        for (let i = 0; i < dist.length; i++)
          if (!done[i] && dist[i]! < Infinity && (k < 0 || dist[i]! < dist[k]!)) k = i;
        if (k < 0) break;
        done[k] = 1;
        const x = k % MAP_W;
        const y = (k - x) / MAP_W;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (!walkableAt(x + dx, y + dy)) continue;
            if (dx && dy && (!walkableAt(x + dx, y) || !walkableAt(x, y + dy))) continue;
            const n = (y + dy) * MAP_W + (x + dx);
            const d = dist[k]! + (dx && dy ? Math.SQRT2 : 1);
            if (d < dist[n]!) dist[n] = d;
          }
      }
      return dist;
    };
    const cellsOf = (name: string): [number, number][] => {
      const r = rectOf(name);
      const out: [number, number][] = [];
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push([x, y]);
      return out;
    };
    /** Where a character is spoken to from: the walkable cells beside their own. */
    const besideOf = (name: string): [number, number][] => {
      const [[cx, cy]] = cellsOf(name) as [[number, number]];
      return NEIGHBOURS.map(([dx, dy]) => [cx + dx, cy + dy] as [number, number]).filter(([x, y]) =>
        walkableAt(x, y),
      );
    };
    const door = cellsOf('trigger-cottage');
    const toDoor = (d: Float64Array): number =>
      Math.min(...door.map(([x, y]) => d[y * MAP_W + x]!));
    const fromSpawn = walkFrom(spawnX, spawnY);
    const via = (name: string): number =>
      Math.min(
        ...besideOf(name).map(([x, y]) => fromSpawn[y * MAP_W + x]! + toDoor(walkFrom(x, y))),
      );
    const bridge = via('npc-gatekeeper');
    const toMagpie = Math.min(
      ...besideOf('bystander-magpie').map(([x, y]) => fromSpawn[y * MAP_W + x]!),
    );
    const landed = toDoor(walkFrom(WING_LANDING.x, WING_LANDING.y));
    const flightTiles = (FLIGHT_MS / 1000) * tilesPerSecond;
    const flight = toMagpie + flightTiles + landed;
    const seconds = (tiles: number): string => (tiles / tilesPerSecond).toFixed(1);
    const apart = Math.abs(bridge - flight) / Math.min(bridge, flight);
    if (!Number.isFinite(bridge) || !Number.isFinite(flight) || apart > 0.1)
      faults.push(
        `the two ways over the river are ${(apart * 100).toFixed(1)}% apart (want at most 10%): ` +
          `the bridge is ${bridge.toFixed(1)} tiles (${seconds(bridge)} s), the flight is ` +
          `${toMagpie.toFixed(1)} to the Magpie + ${flightTiles.toFixed(1)} in the air + ` +
          `${landed.toFixed(1)} from the landing (${seconds(flight)} s). Move MAGPIE_SPOT or ` +
          'WING_LANDING, not this bound.',
      );
    verdictLines.push(
      `river crossings: bridge ${bridge.toFixed(1)} tiles (${seconds(bridge)} s), flight ` +
        `${toMagpie.toFixed(1)} + ${flightTiles.toFixed(1)} + ${landed.toFixed(1)} = ` +
        `${flight.toFixed(1)} tiles (${seconds(flight)} s), ${(apart * 100).toFixed(1)}% apart`,
    );
  }

  console.log(
    `  shoreline: ${Object.entries(shores)
      .map(([k, v]) => `${k.slice(6)}=${v}`)
      .sort()
      .join(' ')}; 0 grass tiles left against the water`,
  );
  for (const line of verdictLines) console.log(`  ${line}`);
  if (faults.length > 0)
    throw new Error(
      `the generated map breaks ${faults.length} invariant(s):\n  - ${faults.join('\n  - ')}`,
    );

  const json = JSON.stringify({
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: MAP_W,
    height: MAP_H,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 6,
    nextobjectid: objects.length + 1,
    layers: [
      tileLayer(1, 'ground', ground),
      tileLayer(2, 'decor-below', below),
      tileLayer(3, 'decor-above', above),
      tileLayer(4, 'collision', collision),
      {
        id: 5,
        name: 'objects',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'tileset-forest',
        image: 'tileset-forest.png',
        imagewidth: COLUMNS * TILE,
        imageheight: rows * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: TILE_NAMES.length,
        columns: COLUMNS,
        margin: 0,
        spacing: 0,
      },
    ],
  });

  return { json, landmarks };
}
