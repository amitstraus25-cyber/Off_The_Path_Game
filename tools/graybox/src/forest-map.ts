// Lays out the forest: a winding river with a waterfall, curving paths, tree clusters with 2x2
// canopies, and the landmarks the story needs. Objects keep the names apps/game reads.
import { Img, noise, valueNoise2D } from './paint.ts';
import { COLUMNS, TILE, TILE_NAMES, TILE_PAINTERS, gid } from './tiles.ts';

export const MAP_W = 60;
export const MAP_H = 42;

type Layer = number[];
const blank = (): Layer => new Array<number>(MAP_W * MAP_H).fill(0);

/** The four tiles a tone can bleed across. Diagonals are not seams; only edges are. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

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
   * tall, which suits a 26x15 letterbox camera: a wood that reads as a mass across a frame reads
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
       * The west margin carried DOWN BEHIND RED, which is the other half of the title screen's
       * complaint. The spawn camera is clamped to x 0, so the left column of the title frame is
       * always the edge of the world; with the margin wood stopping at row 18 and Red's glade
       * subtracting below it, what the frame showed down that column was the sealed band itself --
       * the 2x6 block of near-identical bushes the review named. Canopy over the band is the only
       * thing that hides it, and it is what the file's own note on `sealBorder` says: where a wood
       * stands on the margin, the longest visible run of hedge is not the length of the band at all.
       */
      { cx: 1, cy: 21, r: 4.2, strength: 0.9, why: 'the west margin behind Red, under her glade' },
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
    { cx: 7, cy: 21, r: 3.4, why: 'where Red is standing when the game starts' },
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
     * empty -- Red's own glade and the well's are places with nothing in them, which is what makes
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

  const grassTiles = [gid('grass-0'), gid('grass-1'), gid('grass-2'), gid('grass-3')];
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
   * Raised again, from 17, because the ground painter's four grass variants are further apart in
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
   * itself. The finest is deliberately weak: an octave of 0.1 at a six-tile period swings the
   * total by under 0.02 between neighbours, well under the gap between two quantile cuts, so it
   * bends a boundary and still cannot cross one on its own.
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
       * A second, finer octave keeps the patch edges from looking like contour lines -- but only
       * just. At a sixth of the field it swung the total by about half a band, which meant that
       * over any broad stretch of ground the field crossed a threshold and crossed back every few
       * tiles, and the four grass variants came out interleaved tile by tile. Two greens this far
       * apart, alternating at 32px, is a chequerboard however the choice between them is made:
       * it is the AMPLITUDE at tile scale that does it, not the dither.
       *
       * At a sixteenth it still bends a boundary and can no longer cross one on its own.
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
   * 32px squares, because the variants are 25, 16 and 6 luma apart (123, 148, 164, 170) and a
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
   * matters most: the darkest grass is 104 mean luma and the deep-shade threshold is 81, so no rung
   * of grass counts as deep shade whatever share it has, and the measured deep shade comes from the
   * canopy and the keylines. What it buys is luma SPREAD -- the gap between a shaded wood floor and
   * a sunlit clearing -- which is the axis sitting at 0.79 of the board's.
   *
   * It also reduces the one boundary this file has to be careful about. Measured off the painters
   * the rungs are 104, 143, 163 and 174, so the 0|1 seam is a 39-luma step across a hard tile edge
   * and the 2|3 seam is 11. Moving share off rung 0 makes the big step rarer and the invisible one
   * commoner, which is the right direction for both faults at once.
   */
  const cut = [0.14, 0.44].map((q) => {
    const sorted = [...light].sort((a, b) => a - b);
    return sorted[Math.floor(q * (sorted.length - 1))]!;
  });
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const v = light[y * MAP_W + x]!;
      const band = v < cut[0]! ? 0 : v < cut[1]! ? 1 : 2;
      const lit = dapple(x / 3.1, y / 3.1) * 0.7 + dapple(x / 1.7 + 61, y / 1.7 + 61) * 0.3;
      set(ground, x, y, grassTiles[band === 2 && lit > 0.47 ? 3 : band]!);
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
  const nearLimit = (v: number, limit: number, sign: number, k = 3.2): number => {
    const slack = (v - limit) * sign;
    return slack > k ? v : limit + sign * k * Math.exp((slack - k) / k);
  };
  /** The furthest east the water may reach: short of the well glade, and of Grandma's garden. */
  const westOf = (y: number): number => (y >= 34 ? 30 : y >= 22 ? 26.5 : y >= 8 ? 34 : 42);
  /** The furthest west: short of the fountain glade, the owl's fork and the market. */
  const eastOf = (y: number): number => (y >= 22 ? 12 : y >= 8 ? 25.5 : 20);
  const centreCache = new Map<number, number>();
  const riverCentre = (y: number): number => {
    const hit = centreCache.get(y);
    if (hit !== undefined) return hit;
    const wander = (bend(0, y / 5.1) - 0.5) * 11.5 + (bend(31, y / 2.3) - 0.5) * 3.4;
    const free = riverTrend(y) + wander * meanderFreedom(y);
    const held = nearLimit(nearLimit(free, eastOf(y), 1), westOf(y), -1);
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
  // A waterfall spilling in at the north end.
  for (let y = 0; y < 4; y++)
    for (let x = Math.round(riverCentre(y)) - 1; x <= Math.round(riverCentre(y)) + 1; x++) {
      set(ground, x, y, gid('waterfall'));
      solid(x, y);
    }

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
  layPath([
    [2, 20],
    [6, 20],
    [9, 21],
    [14, 21],
    [17, 20],
    [30, 20],
    [33, 19],
    [37, 18],
    [40, 19],
    [43, 20],
    [52, 20],
  ]);
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
  layPath(
    [
      [11, trackTop(11)],
      [10, 18],
      [10, 14],
      [12, 13],
      [15, 12],
      [18, 13],
    ],
    1,
  );
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
  layPath(
    [
      [31, trackTop(31) + 1],
      [32, 23],
      [34, 25],
      [35, 28],
      [36, 31],
      [37, 33],
    ],
    1,
  );

  /*
   * ===========================================================================
   * THE TRACK'S EDGE WANDERS BY ONE TILE, which is what stops it being a motorway.
   * ===========================================================================
   *
   * THE COMPLAINT IS ABOUT THE EDGES, NOT THE WIDTH, and that took three rounds to see. The sand is
   * two tiles and cannot be fewer: the bridge deck is read off the track, the gate lane is two rows
   * and `map.test.ts` asserts the notice spans both of them. But `layPath` resolves a chain and
   * stamps exactly `width` tiles PERPENDICULAR to it, so on a flat run both edges of the road are
   * the same two dead-straight horizontal lines for fifty columns. At the spawn camera that is a
   * pale band entering the left edge of the frame and leaving the right edge of it, at the exact
   * vertical middle, with two ruled edges -- which is a surveyed road seen from a helicopter, and is
   * the thing the client is looking at when he says the map does not make sense.
   *
   * The file has already tried to fix this by BENDING the chain, twice, and reverted both times with
   * the measurement written up: a lean costs three rows of sand wherever the chain steps across, so
   * a road that wanders renders as a staircase delta, which is worse. The note concludes that "the
   * amount of SAND is what reads as a motorway". That is right, and it means the fix cannot be in
   * the chain at all.
   *
   * So the chain stays dead straight and the EDGE gets a one-tile fringe. A single extra tile above
   * or below, in short stretches, read off a field: the road's average width goes from two tiles to
   * about two and a third, and its silhouette stops being a ruled line. One side at a time, so a
   * fringe never widens the carriageway itself -- which is also why this cannot produce the delta
   * the bend produced.
   *
   * WHERE IT MAY NOT RUN, and all three are load-bearing rather than cautious:
   *   - within four columns of the bridge. `bridgeRows` is read off `isPath` at bridgeCentre - 3 and
   *     the crossing test checks the columns either side of the deck, so one fringe tile there adds
   *     a deck row or a dead-end row of track running into the water.
   *   - from x 40 east. The notice spans x 42 to 45 on both path rows and the gate is the gap in
   *     the fence on those rows; the zero-click beat depends on the approach being exactly two
   *     rows wide.
   *   - against the water, anywhere. A track tile on a bank is the exact bug the crossing test
   *     exists to catch, wherever on the map it happens.
   */
  /*
   * CUT AT ITS OWN QUANTILES, not at a fixed threshold, and this is the third time this file has had
   * to learn it. A road occupies ONE row, so any field read along it is sampled on a line of
   * near-constant y -- about fifteen lattice cells across a sixty-column map -- and whether those
   * fifteen draws happen to straddle a fixed threshold is a property of the seed, not of the design.
   * The first version of this used `v > 0.38 || v < 0.74` and put FOUR fringe tiles on thirty-five
   * eligible columns. The ground field a thousand lines up solves the identical problem the
   * identical way: fix the SHARE and let the field decide where.
   */
  const fringe = valueNoise2D(20261061);
  const eligible: { x: number; top: number; bottom: number; v: number }[] = [];
  for (let x = 1; x < 40; x++) {
    if (Math.abs(x - Math.round(riverCentre(20))) <= 4) continue;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < MAP_H; y++)
      if (pathTiles.has(y * MAP_W + x)) {
        if (top < 0) top = y;
        bottom = y;
      }
    if (top < 0 || bottom - top !== 1) continue;
    eligible.push({ x, top, bottom, v: fringe(x / 2.6 + 11, 7.5) });
  }
  const byValue = eligible.map((c) => c.v).sort((a, b) => a - b);
  /** A fringe above on the lowest fifth of the field, below on the highest fifth. */
  const lowCut = byValue[Math.floor(0.22 * (byValue.length - 1))] ?? 0;
  const highCut = byValue[Math.floor(0.78 * (byValue.length - 1))] ?? 1;
  let fringed = 0;
  for (const c of eligible) {
    if (c.v > lowCut && c.v < highCut) continue;
    const y = c.v <= lowCut ? c.top - 1 : c.bottom + 1;
    if (!inside(c.x, y) || isWater(c.x, y)) continue;
    if (NEIGHBOURS.some(([dx, dy]) => isWater(c.x + dx, y + dy))) continue;
    pathTiles.add(y * MAP_W + c.x);
    fringed++;
  }
  console.log(`  track: ${fringed} fringe tile(s) breaking the road's ruled edge`);

  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
    set(ground, x, y, gid('path'));
  }
  // Soft edges where the track meets grass.
  const isPath = (x: number, y: number): boolean => pathTiles.has(y * MAP_W + x) && inside(x, y);
  const pathEdge = (x: number, y: number): void => {
    const n = !isPath(x, y - 1);
    const s = !isPath(x, y + 1);
    const e = !isPath(x + 1, y);
    const w = !isPath(x - 1, y);
    const name =
      n && e
        ? 'path-ne'
        : n && w
          ? 'path-nw'
          : s && e
            ? 'path-se'
            : s && w
              ? 'path-sw'
              : n
                ? 'path-n'
                : s
                  ? 'path-s'
                  : e
                    ? 'path-e'
                    : w
                      ? 'path-w'
                      : 'path';
    set(ground, x, y, gid(name));
  };
  for (const index of pathTiles) pathEdge(index % MAP_W, Math.floor(index / MAP_W));

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
      set(below, x, y, gid('rock'));
      solid(x, y);
    }

  // --- forest border and tree clusters ---------------------------------------
  /*
   * Red's clearing, reserved BEFORE anything is planted in it.
   *
   * The first attempt cleared the decor layers in a square around the spawn after the fact, which
   * cut trees in half: a tree is a 2x1 trunk on `below` plus a 2x2 canopy two rows above it on
   * `above`, so a square that caught one and not the other left canopies floating in the air with
   * nothing under them and trunks standing bare. Refusing to plant inside the clearing in the
   * first place cannot produce a half tree.
   */
  const SPAWN = { x: 5, y: 20 };
  /*
   * TWO TILES, NOT THREE, and the difference is 24 tiles of guaranteed bare lawn.
   *
   * This was a 7x7 square in which nothing may be planted, centred on a spawn pad that is 2x2 --
   * and because every later pass tests it too, nothing at all was planted there: no tree, no scrub,
   * no verge tuft, no flower. Forty-nine tiles of flat lit grass, in the exact middle of the one
   * frame a visitor looks at first, which is 12% of a 26x15 camera and the single largest
   * contiguous void on the map. The product manager traced the word "creepy" partly to this: a
   * bright field evenly dotted with dark holes reads as watched, and the board never shows open
   * lawn larger than 3x3.
   *
   * A 5x5 is still more than Red needs. She stands on two tiles, she needs somewhere to step in
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
   * -- and the comb survived all of them, because the comb is not in the arrangement. There are 53
   * tiles, four of them cover most of the ground, and no arrangement of four images over 2520
   * cells can avoid repeating.
   *
   * Tiled keeps three mirror bits in the top of every gid and Phaser's loader honours them, so a
   * tile can be laid flipped at no cost: no new tile, no new painter, TILE_NAMES still frozen at
   * 53. Four orientations of a grass tile are four different images to a hash and to the eye, so
   * mirroring multiplies the ground's vocabulary by four and takes the phase out of every lattice
   * at the same time. It is invisible to all six scored axes -- a mirror preserves the luma
   * histogram and the palette exactly -- which is precisely why the score kept saying the map was
   * close while it plainly was not.
   *
   * These live up here rather than beside the pass that uses them because the crowns are now
   * stamped mirrored at the moment they are rebuilt, several hundred lines above that pass.
   */
  const FLIP_H = 0x80000000;
  const FLIP_V = 0x40000000;
  /** The transpose. Only safe on a square texture with no up and no light in it: ground and water. */
  const FLIP_D = 0x20000000;
  /*
   * The gid with the three mirror bits taken off, and every pass that READS a tile back by name
   * has to use it. This lives up here, with the bits it undoes, because the passes that need it run
   * both before the mirroring and after it -- `clearArea` is called from the verge and connectivity
   * sweeps at the very bottom of the file -- and a comparison that forgot the mask is silent: the
   * tile is simply never recognised, so a felled tree keeps its trunk on the map and loses its
   * collision, which is the one thing this file warns about in three separate places.
   */
  const BASE_GID = 0x1fffffff;
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
     * both bark and leaf. That row goes on `below` like any other trunk -- Red walks in front of
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
  }
  const trees: Tree[] = [];
  const CANOPY_GIDS = new Set(
    Object.values(KINDS).flatMap((k) => k.crown.map(([dx, dy]) => gid(k.tileAt(dx, dy)))),
  );
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
  const sites: [number, number][] = [];
  for (let y = 2; y < MAP_H - 1; y++) for (let x = 0; x < MAP_W - 1; x++) sites.push([x, y]);
  for (let i = sites.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [sites[i], sites[j]] = [sites[j]!, sites[i]!];
  }
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
  for (const [x, y] of sites) {
    const want = woodAt(x, y);
    /*
     * Deeper in than the mid tree's floor, and masked by the grain, so elders arrive as STANDS of
     * three or four rather than evenly through the wood. An elder every few tiles everywhere would
     * swap one scale of wallpaper for another, and the point of three scales is depth: big trees
     * grouped, with smaller ones coming up between them and around the edge.
     */
    if (want < 0.56 || grainAt(x, y) < 0.44) continue;
    plantKind('elder', x, y);
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
     * mixed, which at a 26-tile camera reads as noise: three sizes alternating is as regular as one
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
    if (big && plantKind('elder', x, y)) continue;
    if (small && plantKind('sapling', x, y)) continue;
    if (plantTree(x, y)) continue;
    /*
     * A refused site is only answered with a sapling out at the TREELINE. In the middle of a wood a
     * refusal now means the crowns there cannot be stacked without punching a hole in one of them,
     * and the honest answer to that is the empty trunk row the wood already has, not a seedling
     * wedged under a canopy where nobody will ever see it and the floor sweep will cover it anyway.
     */
    if (want < 0.62) plantKind('sapling', x, y);
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
   * centred ON the track -- Red's, the bridge reach, the gate approach -- and subtract another two
   * or three rows on top. The corridor is the sum of two effects that are each individually
   * correct, and the only thing that fixes it is planting the verge deliberately.
   *
   * THE GEOMETRY, which decides everything about this pass. A crown may not be laid on sand: the
   * road is the one line the player follows and `decor-above` draws at depth 10,000, so a crown over
   * the track would hide Red while she walks it. So on the NORTH side a tree's trunk row may be the
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
   * an earlier pass closed both verges and Red had no room to round a corner.
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
    // Only the two-lane trunk road. A one-wide footpath is cleared on both sides by the sweep.
    if (top < 0 || bottom - top !== 1) {
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
   * FOOTPRINT rather than in outline detail, which is the only kind of difference that reads at a
   * 26-tile camera: `bush` fills its tile, `bush-low` is a wide bank in the bottom half with lawn
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
   * the whole point of a glade is to be able to walk into it. Red pushes through fern; she still
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
       * the exact case: wood field high, Red's glade cutting the trees out of it, and what the title
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
        // A BOULDER IS NOT UNDERGROWTH. The note above this sweep says Red pushes through fern and
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
  const place = (name: string, x: number, y: number, tile: string, makeSolid = true): void => {
    set(below, x, y, gid(tile));
    if (makeSolid) solid(x, y);
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
        if (trees.some((other) => crownsOver(other, tx, ty))) continue;
        set(above, tx, ty, 0);
      }
    }
  };

  // Rabbit's market stall, just west of the bridge.
  clearArea(11, 15, 4, 5);
  for (const [i, kind] of (
    ['stall-awning-l', 'stall-awning-m', 'stall-awning-m', 'stall-awning-r'] as const
  ).entries())
    set(above, 11 + i, 16, gid(kind));
  for (let i = 0; i < 4; i++) {
    set(below, 11 + i, 17, gid('stall-counter'));
    solid(11 + i, 17);
  }
  landmarks['stall'] = { x: 11 * TILE, y: 17 * TILE };

  place('signpost', 9, 19, 'signpost');
  // The notice post stands on the main track, so every route to the cottage passes it.
  place('notice-post', 43, 19, 'signpost');
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
  clearArea(18, 9, 2, 3);
  if (!plantKind('mid', 18, 11)) throw new Error('the owl has no tree to sit under');
  place('lantern-post', 36, 32, 'lantern-post');

  // Grandma's cottage at the east end, behind a fence with one gate.
  const cx = 50;
  const cy = 14;
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
  clearArea(cx, cy, 6, 6);
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
  const roofTop = cy + 1;
  const wallTop = cy + 3;
  const doorstep = cy + 4;
  for (let i = 0; i < 6; i++) {
    const kind = i === 0 ? 'roof-l' : i === 5 ? 'roof-r' : 'roof-m';
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
  set(below, cx + 4, roofTop - 1, gid('chimney'));
  solid(cx + 4, roofTop - 1);
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
   */
  set(below, cx + 2, roofTop - 1, gid('gable'));
  set(below, cx + 3, roofTop - 1, gid('gable') + FLIP_H);
  solid(cx + 2, roofTop - 1);
  solid(cx + 3, roofTop - 1);
  for (let row = wallTop; row <= doorstep; row++)
    for (let i = 0; i < 6; i++) {
      set(below, cx + i, row, gid('wall'));
      solid(cx + i, row);
    }
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
  for (let row = wallTop; row <= doorstep; row++) {
    set(below, cx, row, gid('wall-corner'));
    set(below, cx + 5, row, gid('wall-corner') + FLIP_H);
  }
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
   * spill on its sill, and it goes at the window the tabby sits under. One of the two, not both --
   * the board lights one side and leaves the other blue, and two lit windows on a two-window facade
   * is a lantern, not a cottage. No animal in it, by the painter's own note: a tile is the same
   * pixels on every ending, and the wolf belongs to the panel.
   */
  set(below, cx + 4, doorstep, gid('wall-window-lit'));
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
  set(below, cx + 2, doorstep, gid('door'));
  /*
   * The landmark is the BUILDING, not the row above it. `prop-cottage` is built from this and is
   * asserted solid over its whole rectangle, and the arrival camera is framed on it, so it has to
   * name the roof's own top row: anchored a row higher it would claim a row of lawn as cottage and
   * fail the generator's own audit.
   */
  landmarks['cottage'] = { x: cx * TILE, y: roofTop * TILE };

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
  const gardenTop = cy - 1;
  const gardenBottom = cy + 8;
  const gardenEast = MAP_W - 3;
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
  for (let y = gardenTop; y <= gardenBottom; y++) {
    if (y === gateRows[0] || y === gateRows[1]) continue;
    panel(fenceX, y, 'fence-post');
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
  for (let y = gardenTop + 1; y < gardenBottom; y++) panel(gardenEast, y, 'fence-post');
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
  for (let x = gardenEast; x < MAP_W; x++)
    for (const y of [gardenTop, gardenBottom]) {
      solid(x, y);
      if (x > gardenEast && at(below, x, y) === 0) set(below, x, y, gid(scrub(x, y)));
    }
  landmarks['gate'] = { x: fenceX * TILE, y: gateRows[0] * TILE };

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
   * ...and now that they are track, they get the rim every other stretch of sand has. Only the lane
   * and the tiles around it: re-running the rim over the whole of `pathTiles` would repaint the
   * bridge, whose deck sits on path rows and is written onto the ground layer after the rim pass.
   */
  for (let y = gateRows[0] - 1; y <= gateRows[1] + 1; y++)
    for (let x = fenceX - 1; x <= cx + 4; x++) if (isPath(x, y)) pathEdge(x, y);
  for (let y = doorstep; y <= gateRows[1]; y++)
    for (const x of [cx + 1, cx + 2, cx + 3, cx + 4]) if (isPath(x, y)) pathEdge(x, y);

  /*
   * Grandma's garden is planted, because an enclosed rectangle of bare lawn is the one place on
   * the map that reads as unfinished rather than as open. It is also the last thing the player
   * sees, and the board's Arrive frame has beds along the fence.
   *
   * This runs after the lane and the door approach are cut, and it skips anything already placed,
   * so it can only land on the lawn between them. Nothing here is solid: the walk to the door
   * must stay clear whichever row Red is on.
   */
  for (let y = gardenTop + 1; y < gardenBottom; y++)
    for (let x = fenceX + 1; x < gardenEast; x++) {
      if (!inside(x, y) || at(below, x, y) !== 0 || at(above, x, y) !== 0) continue;
      if (at(ground, x, y) === gid('path')) continue;
      /*
       * NOTHING ON THE ROW DIRECTLY ABOVE THE ROOF. The enclosure's north run is one row clear of
       * the roof peak, so this bed had a single row to plant between them -- and a 32px bush drawn
       * immediately above the roof's top course reads as a shrub growing out of the roof, which is
       * exactly what the arrival render showed, four of them along the ridge. The strip behind the
       * house stays lawn.
       */
      if (y === roofTop - 1) continue;
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
   * gates -- the landmark dressing and the verge tufts -- is soft: flower and scrub that Red pushes
   * through, never a boulder, which is why `rock` came out of the mix. Refusing to plant soft cover
   * round the spawn is what left her standing in the middle of a mown field; the board's Red stands
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
  const tuft = (x: number, y: number, flowers: number): void => {
    const pick =
      bloom(x / 2.6 + 131, y / 2.6 + 131) * 0.72 + bloom(x / 1.3 + 83, y / 1.3 + 83) * 0.28;
    set(
      below,
      x,
      y,
      gid(
        pick < flowers * 0.4
          ? 'flower-white'
          : pick < flowers * 0.7
            ? 'flower-pink'
            : pick < flowers * 0.85
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
  const deeper = valueNoise2D(20261059);
  const bank = (
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    len: number,
    /** Which way the bank may thicken: away from the thing it is banked against. */
    out: readonly [number, number],
    flowers = 0.7,
  ): void => {
    for (let i = 0; i < len; i++) {
      const x = ox + dx * i;
      const y = oy + dy * i;
      if (onGrass(x, y)) tuft(x, y, flowers);
      const bx = x + out[0];
      const by = y + out[1];
      if (deeper(x / 2.9 + 211, y / 2.9 + 211) > 0.58 && onGrass(bx, by)) tuft(bx, by, flowers);
    }
  };
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
  const dress = (ox: number, oy: number, spread: number, count: number, flowers = 0.5): void => {
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const r = 1 + rnd() * spread;
      // Squashed, because the camera is a 26x15 letterbox and a circle of dressing reads as an
      // ellipse taller than it is wide.
      const x = ox + Math.round(Math.cos(angle) * r);
      const y = oy + Math.round(Math.sin(angle) * r * 0.75);
      if (!onGrass(x, y)) continue;
      tuft(x, y, flowers);
    }
  };
  /*
   * WHERE RED IS STANDING, which had no dressing at all and is the first thing anybody sees.
   *
   * Every other landmark on the map got a ring of planting and the spawn did not, because until a
   * few hundred lines up nothing was allowed to grow inside the spawn clearing. So the hero frame
   * of the asset opened on a character standing in the middle of a mown field. The board's Red
   * stands at a fork with flower beds and tufts right up to the sand on both sides.
   *
   * Wider and heavier than the other rings: this is the one clearing a player looks at for several
   * seconds before she touches a key.
   */
  dress(SPAWN.x, SPAWN.y, 3.4, 18);
  dress(9, 22, 2.6, 10, 0.5); // the shoulder south of the fork, so the junction has a floor
  dress(34, 27, 3.2, 20); // the well
  dress(19, 13, 3.2, 16); // the fountain
  dress(12, 18, 3.2, 14, 0.5); // the market
  dress(9, 19, 2.2, 8); // the signpost at the start of the walk
  dress(43, 19, 2.2, 8); // the forest notice on the gate approach
  dress(36, 32, 2.8, 12, 0.5); // the lantern
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
  bank(cx - 1, doorstep + 1, 1, 0, 8, [0, 1]);
  /* Up the gable end, so the house is not banked on one side only and bare on the other. */
  bank(cx + 6, roofTop + 1, 0, 1, 4, [1, 0]);
  dress(cx + 6, wallTop, 2.4, 10); // the east corner of the house, clear of the wall itself
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
  bank(fenceX + 1, gardenTop + 1, 1, 0, gardenEast - fenceX - 1, [0, 1], 0.8);
  bank(gardenEast - 1, gardenTop + 2, 0, 1, gardenBottom - gardenTop - 3, [-1, 0], 0.8);
  bank(fenceX + 1, gardenBottom - 1, 1, 0, gardenEast - fenceX - 1, [0, -1], 0.8);

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
      const n = TILE_NAMES[at(ground, x + dx, y + dy) - 1];
      return n !== undefined && (n.startsWith('path') || n.startsWith('bridge'));
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
   * BLOOM -- `flowers` at 0.72 is roughly two blooms to one bush -- which is what the board's verges
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
      tuft(x, y, 0.5);
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
    const bank = TILE_NAMES[at(ground, x, y) - 1];
    if (bank === undefined || !bank.startsWith('shore')) return false;
    if (bank === 'shore-n' || bank === 'shore-s') return true;
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
      const standing = TILE_NAMES[at(below, x, y) - 1];
      if (standing === undefined || !OPAQUE_FLOOR.has(standing)) continue;
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
    const touchesTrack = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => isPath(x + dx!, y + dy!));
    if (!touchesTrack) throw new Error(`${name} at ${x},${y} does not touch the track`);
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

  const spawnX = SPAWN.x;
  const spawnY = SPAWN.y;
  clearArea(spawnX, spawnY, 2, 2);
  for (const y of [spawnY, spawnY + 1]) {
    set(ground, spawnX, y, gid('path'));
    set(ground, spawnX + 1, y, gid('path'));
  }

  const objects = [
    { name: 'spawn-red', x: spawnX * TILE, y: spawnY * TILE, width: TILE, height: TILE },
    npc('npc-rabbit', 13, 19),
    // Directly below the trunk of the tree planted for him in the fountain glade, at the end of the
    // footpath, so the trunk and its crown stand behind his head. See the note beside that tree.
    npc('npc-owl', 18, 12),
    npc('npc-lantern-keeper', 37, 33),
    // One per stretch of the walk: the start, the far side of the bridge, and the gate approach.
    bystander('bystander-toadstool', 10, besideTrack(10)),
    // East of the deck. It used to stand at x 22, which the river now runs through: the water
    // crosses the track at a slant and the far bank has moved with it.
    bystander('bystander-magpie', 30, besideTrack(30)),
    bystander('bystander-snail', 41, besideTrack(41)),
    /*
     * Inside the garden, north of the path, between the gate and the door. She is the only
     * bystander past the notice post, so by the time she speaks every decision has been made and
     * the forest notice has already done whatever it was going to do.
     */
    /*
     * ON THE DOORSTEP ROW, TOUCHING THE WALL, east of the door.
     *
     * She stood at (47,19) and then at (49,19), and both are lawn: (47,19) is the middle of
     * Grandma's front garden and (49,19) is a tile off the west corner of the house with the lane on
     * one side and grass on the other three. The product manager has now called a tabby standing
     * alone on that lawn "nobody's intention" twice, which is twice more than a placement fault
     * should need. A cat sits AGAINST something.
     *
     * (54,19) is under the east window, with the wall directly above her, the flower bank the
     * dressing puts along the front of the house either side, and the single file of door lane one
     * tile west -- which is what `bystander` requires, since she has to touch the track to be met.
     * It is clear of the note on the door, which covers the two columns at the other end of the wall,
     * so neither trigger can fire from the tile the other one is standing on.
     */
    bystander('bystander-cat', 54, doorstep + 1),
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
     * on Red's feet, and a player who only ever holds Right keeps her feet on row 21 for the whole
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
      height: TILE * 2,
    },
    {
      /*
       * The note on Grandma's door, which the `sign` errand goal needs. It sits in the lane
       * immediately WEST of the doorstep and matches the trigger row for row, so every approach
       * from the garden crosses the note first and the trigger second, whichever row Red walks.
       * Putting it east of the gate but west of the door is what makes the ordering hold without
       * the two rects ever sharing a tile, which would race inside one frame.
       *
       * This belongs HERE, in the generator, and not in the generated map-forest.json: a previous
       * pass added it by hand to the JSON and every later `pnpm graybox` silently wiped it, which
       * left the goal advertised in the HUD and impossible to complete.
       */
      name: 'notice-cottage-door',
      x: cx * TILE,
      y: 19 * TILE,
      width: TILE * 2,
      height: TILE * 3,
    },
    { name: 'prop-signpost', ...landmarks['signpost']!, width: TILE, height: TILE },
    { name: 'prop-well', ...landmarks['well']!, width: TILE, height: TILE },
    { name: 'prop-fountain', ...landmarks['fountain']!, width: TILE, height: TILE },
    { name: 'prop-lantern-post', ...landmarks['lantern-post']!, width: TILE, height: TILE },
    // Four courses since the middle one was dropped; see the note on the facade.
    { name: 'prop-cottage', ...landmarks['cottage']!, width: TILE * 6, height: TILE * 4 },
    { name: 'prop-stall', ...landmarks['stall']!, width: TILE * 4, height: TILE },
  ].map((o, i) => ({ id: i + 1, rotation: 0, visible: true, ...o }));

  // The gate tiles must stay walkable even after the fence loop.
  for (const y of [20, 21]) clear(fenceX, y);

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
   * CAST SHADOW -- the last pass, and the one that stops nine hundred trees floating on a lawn.
   *
   * There was not a single shadow anywhere in the world. The board darkens the ground under every
   * crown and spills it south-east, which is visible as a green pool at the foot of any tree you
   * crop out of it; ours had crowns and trunks pasted onto flat, evenly lit grass, which is the
   * difference between a layered wood and a tile demo.
   *
   * This is PLACEMENT, not painting: the four grass variants are already four brightness steps
   * (123, 148, 164, 170 mean luma), so a shadow is a tile that has been walked a step or two down
   * that ramp. Which means it also does something the painters cannot. Both halves of a trunk tile
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
   * of the bridge: the four variants are 6, 16 and 25 luma apart, so one step is nearly invisible
   * at the light end of the ramp and a wall at the dark end, and two overlapping trees compounded
   * to the floor. A real shadow is about as bright as the other shadows near it whatever it falls
   * on, which is what clamping to a level gives -- and it is idempotent, so a tile deep in the
   * wood is shaded once however many crowns reach over it.
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
      const beside = NEIGHBOURS.some(([dx, dy]) => {
        const n = TILE_NAMES[at(ground, x + dx, y + dy) - 1];
        return n !== undefined && (n.startsWith('path') || n.startsWith('bridge'));
      });
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

  /*
   * THE REST OF THE MIRRORING. The crowns were already laid flipped when the canopy was rebuilt;
   * the trunks waited for the cast shadow above to finish reading `trunk-l` by name, and now join
   * them off the same register, so a tree's trunk and crown can never disagree about which way it
   * faces.
   *
   * What may be mirrored is decided by LIGHTING, not by convenience:
   *   - Ground texture and water have no light direction in them, so they take both axes.
   *   - Anything that stands up -- scrub, boulders, flowers, toadstools, trees -- takes the
   *     horizontal axis only. Flipping those top to bottom would stand them on their heads.
   *   - The fence takes the horizontal axis. Its pales are a vertical pattern with no left and no
   *     right in them, and `map.test.ts` reads only `path` and `bridge` back by name, so a flipped
   *     fence gid breaks nothing -- while an unflipped one printed the same picket, 24 times in a
   *     row, along the top of the one frame the game ends on.
   *   - Sand, shores, bridge and every other built thing take nothing. They either encode a
   *     direction in the tile itself or are read back by name in the map tests, and a flipped gid
   *     is not the gid those tests look up.
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

  const BOTH_AXES = new Set(['grass-0', 'grass-1', 'grass-2', 'grass-3', 'water', 'water-2']);
  const SIDEWAYS = new Set([
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
    'waterfall',
    'fence-h',
    'fence-post',
  ]);
  for (const layer of [ground, below, above])
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const name = TILE_NAMES[at(layer, x, y) - 1];
        if (name === undefined) continue;
        const both = BOTH_AXES.has(name);
        if (!both && !SIDEWAYS.has(name)) continue;
        let flips = 0;
        if (heads(x, y, 1)) flips += FLIP_H;
        if (both && heads(x, y, 2)) flips += FLIP_V;
        // All three bits on an isotropic texture give its eight symmetries rather than four, which
        // halves the share of the map any single image covers for nothing.
        if (both && heads(x, y, 3)) flips += FLIP_D;
        if (flips) set(layer, x, y, at(layer, x, y) + flips);
      }

  /*
   * THE VERGES. A road you cannot walk beside is a corridor, not a road.
   *
   * `plantTree` already refuses a path tile, so the track itself is always clear -- but it happily
   * plants a trunk in the tile NEXT to it, on both sides, and a wood that presses right up to the
   * sand turns every road into a one-tile slot. Measured by the end-to-end suite rather than by
   * eye: with the verges closed, five tests that walk Red somewhere timed out, including the whole
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
   * only ever holds Right actually walks. Every unit test passed. `pnpm e2e` failed on "Red never
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
   * five end-to-end tests timed out when the verges closed, because Red had no room to round a
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
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as [number, number][]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || at(collision, nx, ny) === 0) continue;
        if (!fellable(nx, ny)) continue;
        if (isPath(x - dx, y - dy) && pressesTheSand(nx, ny)) {
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

  /*
   * ===========================================================================
   * THE DUE-EAST LINE, which was an accident of the pass above and is now a stated invariant.
   * ===========================================================================
   *
   * `overlaps` in `world/logic.ts` is a point test on Red's FEET, so a player who only ever holds
   * Right walks the whole map along one exact row -- the spawn row plus one -- and `map.test.ts`
   * asserts that both notices lie on it. The end-to-end suite walks her that way and has already
   * failed once on "Red never reached both notices walking east", sixty seconds of pressing Right
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
   * IT IS TWO ROWS, AND THE REASON IS WORTH WRITING DOWN BECAUSE IT IS COUNTER-INTUITIVE. Red's
   * position is her FEET, and `logic.ts` puts her foot box three sixteenths of a tile ABOVE that
   * point: at the spawn her feet sit on y = (spawnY + 1) * 32 exactly, which is the top edge of row
   * spawnY + 1, and the box she is tested against spans y 660 to 672 -- entirely inside row spawnY.
   * So the row a due-east walker reads as a notice and the row she COLLIDES along are not the same
   * row, and the first version of this pass cleared only the latter. `map.test.ts` could not see it
   * either, because the notice test compares her feet against the rect and both notices span both
   * rows. `pnpm e2e` caught it: "Red never reached both notices walking east", sixty seconds of
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
   * "Red never reached both notices walking east".
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
  const STEPS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const reachableFromSpawn = (): Set<number> => {
    const seen = new Set<number>([spawnY * MAP_W + spawnX]);
    const queue = [spawnY * MAP_W + spawnX];
    for (let head = 0; head < queue.length; head++) {
      const key = queue[head]!;
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) || at(collision, nx, ny) !== 0) continue;
        const next = ny * MAP_W + nx;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  };

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
      for (const [dx, dy] of STEPS) {
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
        for (const [dx, dy] of STEPS) {
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

  const walkable = collision.filter((v) => v === 0).length;
  const open = reachableFromSpawn().size;
  console.log(
    `  connectivity: ${felled} tile(s) opened; ${open}/${walkable} walkable tiles reachable ` +
      `(${Math.round((open / walkable) * 100)}%)`,
  );

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
  const mayBush = (x: number, y: number): boolean =>
    inside(x, y) &&
    !onBorder(x, y) &&
    at(below, x, y) === 0 &&
    at(above, x, y) === 0 &&
    !isPath(x, y) &&
    !isWater(x, y) &&
    !inClearing(x, y) &&
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
  const nameAt = (layer: Layer, x: number, y: number): string =>
    TILE_NAMES[(at(layer, x, y) & BASE_GID) - 1] ?? '';
  const walkableAt = (x: number, y: number): boolean => inside(x, y) && at(collision, x, y) === 0;
  const faults: string[] = [];
  const fault = (what: string, where: [number, number][]): void => {
    if (where.length === 0) return;
    const shown = where
      .slice(0, 8)
      .map(([x, y]) => `(${x},${y})`)
      .join(' ');
    faults.push(`${where.length} ${what}: ${shown}${where.length > 8 ? ' ...' : ''}`);
  };

  /*
   * 1. NO BANK ENDS IN MID-AIR. Water may meet the deck, the waterfall or the track -- a bridge
   * crosses water, the fall IS water, and the one place the sand meets the river is the ford west
   * of the deck, where a shore tile would break the bridge approach `map.test.ts` measures. Water
   * meeting GRASS is the bank that stopped.
   */
  const bare: [number, number][] = [];
  const miszoned: [number, number][] = [];
  const smothered: [number, number][] = [];
  const shores: Record<string, number> = {};
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const here = nameAt(ground, x, y);
      if (here.startsWith('shore')) {
        shores[here] = (shores[here] ?? 0) + 1;
        // The side in the name is the land, so the water must be on the other one.
        const wetSide: Record<string, [number, number]> = {
          'shore-w': [1, 0],
          'shore-e': [-1, 0],
          'shore-n': [0, 1],
          'shore-s': [0, -1],
        };
        const [dx, dy] = wetSide[here]!;
        if (!isWater(x + dx, y + dy)) miszoned.push([x, y]);
        // A one-tile step has nothing either side to carry the waterline, so an opaque tile on it
        // hides the whole shoreline and the seam is bare again however good the ground tile is.
        if (!onBorder(x, y) && soleShoreline(x, y) && OPAQUE_FLOOR.has(nameAt(below, x, y)))
          smothered.push([x, y]);
      }
      if (!here.startsWith('grass') || isWater(x, y)) continue;
      if (NEIGHBOURS.some(([dx, dy]) => isWater(x + dx, y + dy))) bare.push([x, y]);
    }
  fault('grass tile(s) meeting the water with no shore on them', bare);
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
    'roof-l',
    'roof-m',
    'roof-r',
    'roof-peak',
    'chimney',
    'stall-counter',
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
      if (!walkableAt(x, y) && b === '' && nameAt(above, x, y) === '' && !wetTile)
        undrawn.push([x, y]);
      /*
       * A crown is stamped from the register, so one with no trunk under it is half a tree. Asked
       * of the gid set rather than of a name prefix: the three scales are `canopy-*`, `elder-*` and
       * `sapling-*`, and a prefix test would have audited one of them and waved the other two
       * through -- including the elder, whose crown is nine tiles and whose half-tree is therefore
       * the most visible one it is possible to leave on the map.
       */
      if (!CANOPY_GIDS.has(at(above, x, y) & BASE_GID)) continue;
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
  {
    const start = spawnY * MAP_W + spawnX;
    const seen = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const key = queue[head]!;
      const x = key % MAP_W;
      const y = (key - x) / MAP_W;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!walkableAt(nx, ny)) continue;
        if (nx >= notice.x0 && nx <= notice.x1 && ny >= notice.y0 && ny <= notice.y1) continue;
        const next = ny * MAP_W + nx;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    for (let y = gap.y0; y <= gap.y1; y++)
      for (let x = gap.x0; x <= gap.x1; x++)
        if (seen.has(y * MAP_W + x))
          faults.push(`the gate at (${x},${y}) can be reached without reading the notice`);
  }

  /*
   * 5. EVERY OBJECT STANDS WHERE IT SAYS IT DOES. Anything the player or a traveller occupies has
   * to be walkable over its whole rectangle -- a bystander carved out of a tree is never met, and
   * a notice whose tiles are solid can never be stood on -- and every `prop-` is solid over its
   * whole rectangle, because each one is a thing in the way.
   */
  for (const o of objects) {
    const r = rectOf(o.name);
    const bad: [number, number][] = [];
    const wantsSolid = o.name.startsWith('prop-');
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) if (walkableAt(x, y) === wantsSolid) bad.push([x, y]);
    fault(`tile(s) of "${o.name}" that are ${wantsSolid ? 'not solid' : 'not walkable'}`, bad);
    if (wantsSolid) continue;
    const onWater = [];
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) {
        const g = nameAt(ground, x, y);
        // Any scale of trunk. `startsWith('trunk')` caught the mid tree and missed the elder and
        // the sapling, which is how an NPC ends up standing inside a tree and never being met.
        const inTree = TRUNK_GIDS.has(at(below, x, y) & BASE_GID);
        if (g === 'water' || g === 'water-2' || g === 'waterfall' || inTree)
          onWater.push([x, y] as [number, number]);
      }
    fault(`tile(s) of "${o.name}" standing in the water or inside a tree`, onWater);
  }

  console.log(
    `  shoreline: ${Object.entries(shores)
      .map(([k, v]) => `${k.slice(6)}=${v}`)
      .sort()
      .join(' ')}; 0 grass tiles left against the water`,
  );
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
