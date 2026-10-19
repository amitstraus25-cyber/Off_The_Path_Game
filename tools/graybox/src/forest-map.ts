// Lays out the forest: a winding river with a waterfall, curving paths, tree clusters with 2x2
// canopies, and the landmarks the story needs. Objects keep the names apps/game reads.
import { noise, valueNoise2D } from './paint.ts';
import { COLUMNS, TILE, TILE_NAMES, gid } from './tiles.ts';

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
   * FEWER AND BIGGER, which is how the run-length target and the deep-shade target are met at the
   * same time rather than traded off.
   *
   * MEASURED AND LEFT ALONE. A six-tile wood is three trees across, so its crowns can only make
   * runs of four and six however freely they overlap, and the obvious move was fewer, bigger
   * thickets. Tried twice: twelve woods of radius 8 to 21.5 lengthened the runs properly (mean 4.9
   * to 5.3, with masses of 22, 33 and 44 tiles) and cost five of the six cameras 0.01 to 0.03,
   * because a camera then frames one uniform wood instead of a wood and a glade; sixteen of radius
   * 8 to 20 was a wash, better at the well and worse at the cottage by the same amount. The grain
   * of the wood is not where the remaining short runs come from, so these are as they were.
   */
  const thickets = Array.from({ length: 17 }, () => {
    const size = rnd();
    return {
      cx: rnd() * MAP_W,
      cy: 2 + rnd() * (MAP_H - 4),
      r: 6.5 + size * size * 12.5,
      /** How far the canopy closes at the core. The spread here is the order of magnitude. */
      strength: 0.72 + rnd() * 0.28,
      /** Each thicket warps its own outline, so no two are the same shape. */
      phase: rnd() * 64,
    };
  });
  const woodAt = (x: number, y: number): number => {
    let best = 0;
    for (const t of thickets) {
      /*
       * The radius is warped by a fine field before it is compared, which turns a disc into a
       * lobed blob with bays and spurs. A circle of trees reads as an orchard; and two overlapping
       * blobs with different warps merge into one wood rather than into a figure of eight.
       */
      const warp = (lobe(x / 4.4 + t.phase, y / 4.4) - 0.5) * 0.52;
      const d = Math.hypot(x - t.cx, (y - t.cy) * 1.2) / t.r + warp;
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
    const toEdge = Math.min(x, y - 2, MAP_W - 2 - x, MAP_H - 2 - y);
    const depth = 2 + lobe(x / 9.5, y / 9.5) * 4.5;
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
    return Math.max(best, rim);
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
  const cut = [0.2, 0.56].map((q) => {
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
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (isWater(x, y)) continue;
      const nextToWater = isWater(x - 1, y) || isWater(x + 1, y);
      if (!nextToWater) continue;
      set(ground, x, y, isWater(x + 1, y) ? gid('shore-w') : gid('shore-e'));
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
  layPath([
    [2, 20],
    [5, 20],
    [8, 21],
    [12, 22],
    [15, 21],
    [19, 20],
    [31, 20],
    [34, 19],
    [38, 18],
    [41, 19],
    [43, 20],
    [52, 20],
  ]);
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
   * It also passes east of the market rather than through it: the stall's counter row is x 11 to
   * 14, and the old waypoint at (14,17) put the footpath inside the shop.
   */
  layPath(
    [
      [16, 21],
      [16, 18],
      [15, 15],
      [17, 12],
      [17, 9],
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
      [31, 21],
      [32, 23],
      [34, 25],
      [35, 28],
      [36, 31],
      [37, 33],
    ],
    1,
  );

  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
    set(ground, x, y, gid('path'));
  }
  // Soft edges where the track meets grass.
  const isPath = (x: number, y: number): boolean => pathTiles.has(y * MAP_W + x) && inside(x, y);
  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
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
  }

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
  const inClearing = (x: number, y: number): boolean =>
    Math.abs(x - SPAWN.x) <= 3 && Math.abs(y - SPAWN.y) <= 3;

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
  const coin = valueNoise2D(20261041);
  /** Independent per-tile bits: `valueNoise2D` hashes exactly on integer coordinates. */
  const heads = (x: number, y: number, which: number): boolean => coin(x + which * 97, y) > 0.5;

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
  const trees: { x: number; y: number }[] = [];
  const CROWN = [
    [0, -2, 'canopy-tl', 'canopy-tr'],
    [1, -2, 'canopy-tr', 'canopy-tl'],
    [0, -1, 'canopy-bl', 'canopy-br'],
    [1, -1, 'canopy-br', 'canopy-bl'],
  ] as const;
  const CANOPY_GIDS = new Set(CROWN.map(([, , name]) => gid(name)));
  const isCanopy = (x: number, y: number): boolean => CANOPY_GIDS.has(at(above, x, y));

  const plantTree = (x: number, y: number): boolean => {
    /*
     * The TRUNK's own two tiles still have to be genuinely empty on the ground layer, and they are
     * the only cells that do: they are the collision footprint the reachability tests walk around.
     *
     * One of the two also has to be clear of other crowns, which is the whole of what is left of
     * the old rule. A trunk may stand behind a neighbour's crown -- that is what a wood looks
     * like, and refusing it is what pinned every tree onto its own three-row lattice -- but a tree
     * with BOTH halves hidden is a solid tile the player cannot see, and it contributes nothing to
     * the picture it is paying for.
     */
    let visible = false;
    for (let dx = 0; dx <= 1; dx++) {
      const tx = x + dx;
      if (!inside(tx, y) || isPath(tx, y) || isWater(tx, y) || inClearing(tx, y)) return false;
      if (at(below, tx, y) !== 0) return false;
      if (at(above, tx, y) === 0) visible = true;
      else if (!isCanopy(tx, y)) return false;
    }
    if (!visible) return false;
    /*
     * The CROWN may land on another crown. That single permission is what turns an orchard into a
     * wood: a tree one row down and one column across from its neighbour now shares a cell with it,
     * so runs come out odd -- three, five, seven -- and the crowns interlock into a mass with real
     * clearings punched in it rather than a dot grid with a lawn showing through every gap.
     *
     * It may not land on anything else up there, which at present means the market awning; and it
     * stays off the track, because the road is the thing the player follows and a crown hanging
     * over it hides the one line of sand that says where to go.
     */
    for (let dy = -2; dy <= -1; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (!inside(tx, ty) || inClearing(tx, ty) || isPath(tx, ty)) return false;
        if (at(above, tx, ty) !== 0 && !isCanopy(tx, ty)) return false;
      }
    set(below, x, y, gid('trunk-l'));
    set(below, x + 1, y, gid('trunk-r'));
    solid(x, y);
    solid(x + 1, y);
    for (const [dx, dy, name] of CROWN) set(above, x + dx, y + dy, gid(name));
    trees.push({ x, y });
    return true;
  };

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
    plantTree(x, y);
  }
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
      for (const [dx, dy] of CROWN) {
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
      const beside = [t.x - 1, t.x + 2].some((nx) => covered(nx, t.y - 1) || covered(nx, t.y - 2));
      if (beside) continue;
      changed++;
      if (
        plantTree(t.x + 2, t.y) ||
        plantTree(t.x - 2, t.y) ||
        plantTree(t.x + 1, t.y + 2) ||
        plantTree(t.x - 1, t.y + 2)
      )
        continue;
      const i = trees.indexOf(t);
      if (i >= 0) trees.splice(i, 1);
      for (const dx of [0, 1]) {
        set(below, t.x + dx, t.y, 0);
        clear(t.x + dx, t.y);
      }
      // Only the quarters nothing else is standing under: a shared cell belongs to its neighbour.
      for (const [dx, dy] of CROWN)
        if ((cover.get((t.y + dy) * MAP_W + (t.x + dx)) ?? 0) <= 1)
          set(above, t.x + dx, t.y + dy, 0);
    }
    if (changed === 0) break;
  }

  // The border must be solid even where a tree could not be planted.
  for (let x = 0; x < MAP_W; x++)
    for (const y of [0, 1, MAP_H - 1]) {
      solid(x, y);
      if (at(below, x, y) === 0 && at(ground, x, y) !== gid('waterfall'))
        set(below, x, y, gid('bush'));
    }
  for (let y = 0; y < MAP_H; y++)
    for (const x of [0, MAP_W - 1]) {
      solid(x, y);
      if (at(below, x, y) === 0) set(below, x, y, gid('bush'));
    }

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
  const clump = (tile: string, sites: number, spread: number, each: number, hard = false): void => {
    for (let i = 0; i < sites; i++) {
      const ox = 2 + Math.floor(rnd() * (MAP_W - 4));
      const oy = 3 + Math.floor(rnd() * (MAP_H - 6));
      for (let j = 0; j < each; j++) {
        const x = ox + Math.round((rnd() - 0.5) * spread);
        const y = oy + Math.round((rnd() - 0.5) * spread);
        if (!inside(x, y)) continue;
        if (isPath(x, y) || isWater(x, y) || at(below, x, y) !== 0 || at(above, x, y) !== 0)
          continue;
        if (inClearing(x, y)) continue;
        set(below, x, y, gid(tile));
        if (hard) solid(x, y);
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
      const underWood = Math.min(woodAt(x, y) ** 2 * 1.4, 1);
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
      const open = Math.max(meadow(x / 4.6, y / 4.6) - 0.6, 0) * 2.2;
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
        set(below, x, y, gid(floor > 0.86 ? 'rock' : floor > 0.8 ? 'flower-white' : 'bush'));
        continue;
      }
      const pick = speckle(x * 2.7, y * 2.7);
      set(
        below,
        x,
        y,
        gid(
          pick < 0.46
            ? 'bush'
            : pick < 0.64
              ? 'flower-white'
              : pick < 0.8
                ? 'flower-pink'
                : pick < 0.92
                  ? 'flower-red'
                  : 'rock',
        ),
      );
    }

  // Thickets of solid scrub out in the open, and beds of flowers in what is left of it.
  clump('bush', 18, 3.4, 5, true);
  clump('rock', 16, 2.6, 3, true);
  clump('flower-white', 18, 2.4, 4);
  clump('flower-pink', 15, 2.2, 3);
  clump('flower-red', 12, 2.2, 3);

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
      const hitsColumns = t.x + 1 >= x && t.x <= x + w - 1;
      const hitsRows = t.y >= y && t.y - 2 <= y + h - 1;
      if (!hitsColumns || !hitsRows) continue;
      trees.splice(i, 1);
      for (const dx of [0, 1]) {
        if (at(below, t.x + dx, t.y) === gid(dx === 0 ? 'trunk-l' : 'trunk-r'))
          set(below, t.x + dx, t.y, 0);
        clear(t.x + dx, t.y);
      }
      for (const [dx, dy, name] of CROWN)
        if (at(above, t.x + dx, t.y + dy) === gid(name)) set(above, t.x + dx, t.y + dy, 0);
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
   * A few toadstools about the glade. They were a ring of twelve, evenly spaced, which read as
   * twelve identical caps someone had put there rather than as anything that grew: a perfect
   * circle is the one arrangement nature never makes. Scattered unevenly instead, clustered in
   * twos and threes with gaps between, none of them solid.
   */
  for (const [mx, my] of [
    [17, 11],
    [18, 11],
    [21, 12],
    [17, 14],
    [18, 15],
    [21, 15],
    [20, 11],
  ] as const)
    set(below, mx, my, gid('toadstool-ring'));
  place('lantern-post', 36, 32, 'lantern-post');

  // Grandma's cottage at the east end, behind a fence with one gate.
  const cx = 50;
  const cy = 14;
  clearArea(cx - 1, cy - 1, 9, 9);
  for (let i = 0; i < 6; i++) {
    const kind = i === 0 ? 'roof-l' : i === 5 ? 'roof-r' : 'roof-m';
    set(below, cx + i, cy, gid('roof-peak'));
    set(below, cx + i, cy + 1, gid(kind));
    solid(cx + i, cy);
    solid(cx + i, cy + 1);
  }
  set(below, cx + 4, cy - 1, gid('chimney'));
  for (let row = 2; row <= 4; row++)
    for (let i = 0; i < 6; i++) {
      set(below, cx + i, cy + row, gid('wall'));
      solid(cx + i, cy + row);
    }
  set(below, cx + 1, cy + 3, gid('wall-window'));
  set(below, cx + 4, cy + 3, gid('wall-window'));
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
  set(below, cx + 2, cy + 4, gid('door'));
  landmarks['cottage'] = { x: cx * TILE, y: cy * TILE };

  /*
   * Garden fence with a single gate on the main path. The garden has to be ENCLOSED: a fence that
   * only runs north-south can be walked around at either end, which would let the player reach the
   * cottage without passing the notice post. The run north of the gate, the run south of it, and
   * the two returns east to the treeline are all load-bearing.
   */
  const fenceX = 46;
  const gardenTop = cy - 2;
  const gardenBottom = cy + 10;
  const gardenEast = MAP_W - 3;
  for (let y = gardenTop; y <= gardenBottom; y++) {
    if (y === 20 || y === 21) continue; // the gate
    set(below, fenceX, y, gid('fence-post'));
    solid(fenceX, y);
  }
  for (let x = fenceX; x <= gardenEast; x++) {
    for (const y of [gardenTop, gardenBottom]) {
      set(below, x, y, gid('fence-h'));
      solid(x, y);
    }
  }
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
  for (const y of [gardenTop, gardenBottom]) {
    set(below, fenceX, y, gid('fence-post'));
    set(below, gardenEast, y, gid('fence-post'));
  }
  for (let x = gardenEast; x < MAP_W; x++)
    for (const y of [gardenTop, gardenBottom]) {
      solid(x, y);
      if (x > gardenEast && at(below, x, y) === 0) set(below, x, y, gid('bush'));
    }
  landmarks['gate'] = { x: fenceX * TILE, y: 20 * TILE };

  // Make sure the path through the gate and up to the door is walkable.
  for (let x = fenceX; x <= cx + 3; x++)
    for (const y of [20, 21]) {
      set(ground, x, y, gid('path'));
      clear(x, y);
      set(below, x, y, 0);
      set(above, x, y, 0);
    }
  for (let y = cy + 5; y <= 21; y++)
    for (const x of [cx + 2, cx + 3]) {
      set(ground, x, y, gid('path'));
      clear(x, y);
      set(below, x, y, 0);
      set(above, x, y, 0);
    }

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
      // A field again, for the same reason as the forest floor and the bank: these tiles are
      // opaque, so a bed has to be a connected patch or it is a scatter of squares on a lawn.
      const bed = scrubNoise(x / 2.9, y / 2.9);
      if (bed < 0.58) continue;
      set(
        below,
        x,
        y,
        gid(bed > 0.78 ? 'bush' : speckle(x, y) < 0.5 ? 'flower-white' : 'flower-pink'),
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
  const onGrass = (x: number, y: number): boolean =>
    inside(x, y) &&
    grassStep.get(at(ground, x, y)) !== undefined &&
    at(below, x, y) === 0 &&
    at(above, x, y) === 0 &&
    !inClearing(x, y);
  /** Mixed, because a ring of one repeated tile is a different kind of wallpaper. */
  const tuft = (x: number, y: number, flowers: number): void => {
    const pick = rnd();
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
              : pick < flowers * 0.85 + (1 - flowers) * 0.65
                ? 'bush'
                : 'rock',
      ),
    );
  };
  const dress = (ox: number, oy: number, spread: number, count: number, flowers = 0.7): void => {
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
  dress(cx + 1, cy + 5, 3, 14); // banked against the front wall, either side of the door
  dress(cx + 5, cy + 2, 2.6, 10); // the corner of the house
  dress(fenceX + 2, gardenBottom - 2, 3, 12, 0.8); // the bed inside the south fence
  dress(fenceX + 2, gardenTop + 2, 3, 12, 0.8); // and the north one

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
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (!onGrass(x, y) || !besideSand(x, y)) continue;
      if (verge(x / 1.9 + 11, y / 1.9 + 11) < 0.62) continue;
      tuft(x, y, 0.75);
    }

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
    npc('npc-owl', 17, 11),
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
    bystander('bystander-cat', 47, 19),
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
    { name: 'prop-cottage', ...landmarks['cottage']!, width: TILE * 6, height: TILE * 5 },
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
  for (const t of trees) {
    const flip = heads(t.x, t.y, 0);
    for (const [dx, dy, name, mirrored] of CROWN)
      set(above, t.x + dx, t.y + dy, flip ? gid(mirrored) + FLIP_H : gid(name));
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
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (at(below, x, y) !== gid('trunk-l')) continue;
      // Under the trunk itself, where the crown blocks the light outright. Both halves of a trunk
      // tile are largely transparent, so this is the half of the shadow the player actually sees.
      shade(x, y, 0);
      shade(x + 1, y, 0);
      /*
       * The two rows the CROWN stands over, which is the half the first attempt missed and the
       * reason it looked like a quilt rather than a wood. A canopy quarter is opaque over about
       * three quarters of its square, so bright ground shows at its corners; shading the trunk row
       * and not the crown rows left a dark square and a light square alternating under every tree
       * on the map, which is a chequerboard drawn in exactly the place a shadow was meant to be.
       */
      /*
       * ...AND A RUNG LIGHTER THAN IT WAS, now that the crowns merge.
       *
       * Those two rows used to be driven to the floor as well, which was right for 173 trees
       * standing apart and is wrong for 377 whose crowns touch. Counted over the finished map, 71%
       * of every grass tile on it had been walked down to the darkest rung: the shadow had stopped
       * being a shadow and become the baseline, which is exactly as flat as having no shadow at all
       * and left the open lawn in the arrival frame printed with dark squares between the crowns.
       * One rung up puts the floor back under the trunk, where the light genuinely cannot reach,
       * and leaves the crown rows as shade rather than as night.
       */
      shade(x, y - 1, 1);
      shade(x + 1, y - 1, 1);
      shade(x, y - 2, 1);
      shade(x + 1, y - 2, 1);
      // The pool at the foot of the tree, deeper on the side the sun does not reach.
      shade(x, y + 1, 1);
      shade(x + 1, y + 1, 0);
      // And the fringe it throws east, which is the only thing that says where the sun is.
      shade(x + 2, y - 1, 2);
      shade(x + 2, y, 2);
      shade(x + 2, y + 1, 2);
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
      if (beside) shade(x, y, verge(x / 2.7, y / 2.7) > 0.44 ? 1 : 2);
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
    if (!heads(t.x, t.y, 0)) continue;
    if (at(below, t.x, t.y) !== gid('trunk-l')) continue;
    set(below, t.x, t.y, gid('trunk-r') + FLIP_H);
    set(below, t.x + 1, t.y, gid('trunk-l') + FLIP_H);
  }

  const BOTH_AXES = new Set(['grass-0', 'grass-1', 'grass-2', 'grass-3', 'water', 'water-2']);
  const SIDEWAYS = new Set([
    'bush',
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
  const BASE_GID = 0x1fffffff;
  const treeTrunkAt = (x: number, y: number): boolean =>
    trees.some((t) => t.y === y && (t.x === x || t.x + 1 === x));
  const fellable = (x: number, y: number): boolean =>
    treeTrunkAt(x, y) || (at(below, x, y) & BASE_GID) === gid('rock');
  let verged = 0;
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
        clearArea(nx, ny, 1, 1);
        verged++;
      }
    }
  console.log(`  verges: ${verged} obstacle(s) cleared beside the track`);

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

  let felled = 0;
  for (let guard = 0; guard < 300; guard++) {
    const reachable = reachableFromSpawn();
    let pocket = -1;
    for (let y = 2; y < MAP_H - 1 && pocket < 0; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        if (at(collision, x, y) === 0 && !reachable.has(y * MAP_W + x)) {
          pocket = y * MAP_W + x;
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
    for (let ring = 0; ring <= 4 && landed < 0; ring++) {
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
    if (landed < 0) break;

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
    if (cut === 0) break;
    felled += cut;
  }

  const walkable = collision.filter((v) => v === 0).length;
  const open = reachableFromSpawn().size;
  console.log(
    `  connectivity: ${felled} tile(s) opened; ${open}/${walkable} walkable tiles reachable ` +
      `(${Math.round((open / walkable) * 100)}%)`,
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
