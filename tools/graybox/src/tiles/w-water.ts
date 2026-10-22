/*
 * Water: the river surface, its second phase, the four banks and the fall.
 *
 * Drawn against `reference/mocks/gameplay-concepts.png` under `docs/ART_DIRECTION.md` section 8.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE, because the pass before this one was argued from
 * numbers that were wrong, and the argument is still persuasive if you meet it cold.
 *
 * That pass replaced every hard palette step in this file with a continuous `tone()` gradient, on
 * the evidence that our edge density was 11.34 against the board's 4.50 -- two and a half times
 * too busy. It followed that reasoning carefully and the result was airbrushed water: soft white
 * clouds blurred into cyan, and a waterfall that was a slightly lighter band of the same slab.
 *
 * The 4.50 was an artifact. `board-profile.json` was built from board crops that had been scaled
 * UP and interpolated, which smears a hard pixel step across several soft ones and counts it at a
 * fraction of its weight. The profile has since been rebuilt from crops NEAREST-downsampled to our
 * own resolution, and the target moved from 4.50 to 18.91. We were never too busy. We were, and
 * the airbrushed pass made us much more so, too SOFT.
 *
 * Measured like for like -- a board river crop nearest-downsampled 3:1 to our pixel scale, against
 * this file's tiles laid as the map lays them:
 *
 *     axis                          ours    board's own water
 *     deep shade (% under luma 81)  11.89   17.04
 *     keyline    (% under luma 60)   8.26   10.69
 *     luma spread (stdev)           47.87   45.36
 *     edge density (%)              12.54   17.44   <- we are UNDER, not over
 *     texture (mean 16px stdev)     35.73   34.69
 *
 * and the fall was worse than anything else in the game: spread 26.18 against 48.25, edge density
 * 7.62 against 22.37, texture 25.23 against 44.00. Wallpaper, not falling water.
 *
 * The luma histogram says the same thing more usefully than the summary axes do. Sampling the
 * board's open river and our open water over the same bands:
 *
 *     band        board    ours
 *     L  81-109   14.4%     2.2%
 *     L 110-134   23.8%     2.3%     <- the board's water is 38% DARK BLUE; ours was 4.5%
 *     L 135-164   33.9%    31.2%
 *     L 165-194    6.7%    38.9%     <- and ours was six times too pale
 *     L 225-255    1.4%     4.7%     <- with three times too much white
 *
 * So the board's river is not one bright cyan. It is a dark blue body with a mid-blue surface, a
 * little lit blue, and white used sparingly as a hard-edged accent. Ours was a pale cyan slab with
 * white smeared over it, which is why at whole-map scale the river read as a glowing ribbon.
 *
 * THE RULE FOR THIS FILE IS THEREFORE:
 *
 *   - WATER IS QUANTISED. Five flat values and nothing between them. The surface field is still a
 *     smooth wrapping sum of sines, but it is used as a MASK that is cut into bands, not as a
 *     gradient that is painted. Hard boundaries between flat masses is what pixel-art water is, it
 *     is what the board draws, and it is what moves edge density, spread and texture together.
 *   - WHITE IS AN ACCENT, about one and a half per cent, in short hard-edged dashes. No glow, no
 *     halo, no Gaussian. A white pixel sits directly against blue.
 *   - ROCK IS ROUNDED. `tone()` stays for the boulders, because the board's bank stones really do
 *     round off smoothly through their greys. The quantising applies to water, not to stone.
 *   - `keyline()` goes round everything that meets the water, including a dark water line at the
 *     foot of rock, which is where this file's deep shade actually comes from.
 *
 * Other values measured off the board, to say what we are aiming at rather than guessing:
 *
 *   - the open river body is #38bcfc / #34b8fc, luma 152-156, over about a third of the surface,
 *     with a darker blue near luma 122 under about a quarter of it.
 *   - the bank boulders run L96 (shade) to L210 (lit cap) through everything in between, ringed in
 *     a near-black grey and cracked with dark grey lines, and they sit SCATTERED with grass between
 *     them rather than packed into a wall.
 *   - the fall is 21 per cent pure white, 39 per cent body blue and 16 per cent dark channel, with
 *     nothing at all under luma 81. A waterfall is bright; its darkness is channels, not shadow.
 *
 * Three constraints shape every function below, and two of them are the map's, not the board's.
 *
 * A. EVERY TILE IS SEAMLESS WITH ITSELF, because `forest-map.ts` lays these in runs: water in a
 *    3-wide river, `shore-w`/`shore-e` in columns down both banks, `waterfall` in a 3x4 block.
 *    Two copies of one tile are identical, so a feature that runs off an edge continues correctly
 *    if and only if it wraps back into the SAME tile -- hence `wpx`, the boulders drawn
 *    three times a tile apart, the wrapped keyline in `ringPile`, and the fact that no sine in this
 *    file has a period that does not divide 32. That last one now covers `field` too, which is why
 *    its harmonics are 32 and 16 and never 20 or 24.
 * B. `water` AND `water-2` SHARE A SURFACE. The map picks between them at random per tile, so they
 *    sit edge to edge constantly. Identical fill, identical field, and only the mark set drifts --
 *    a boundary between them is then invisible. Painting them as two different blues would draw
 *    the river as a checkerboard.
 * C. THE WATERFALL CANNOT HAVE A LIP OR A FOOT. The map lays one image 3 wide and 4 tall, so any
 *    horizontal feature repeats four times down the fall and reads as a ladder. The board's white
 *    break at the lip and its foam pool at the foot are therefore absent here and noted as a map
 *    gap rather than faked; everything in `waterfall()` is vertical and wraps.
 *
 * Colour is `tone`, `shade` and `keyline` on the shared ramps only. `water` for the river, `stone`
 * for the bank rock and its outline, `grass` and `shadow` for the land behind it. No raw hex, no
 * partial alpha, and no brand colour, because the forest stays a forest.
 */
import { clamp01, Img, keyline, lumaOf, mix, shade, smooth, TILE, tone } from '../paint.ts';
import type { RGBA, Side } from '../paint.ts';
import { UNDERGROWTH_TILES } from './w-undergrowth.ts';

/**
 * Terrain tiles are one TILE square (docs/PIXEL_STANDARD.md section 1).
 *
 * `S` is kept as a one-line local alias rather than renamed: it is read at about fifty sites in this
 * file, and fifty edits to spell one constant differently is churn with a pixel risk and no reader
 * benefit. What mattered was that it stopped being its own `32`.
 */
const S = TILE;

const TAU = Math.PI * 2;

const wrap = (v: number): number => ((Math.round(v) % S) + S) % S;

/** Plot with both axes wrapped into the tile, so a feature that leaves one edge enters the other. */
const wpx = (img: Img, x: number, y: number, c: RGBA): void => img.px(wrap(x), wrap(y), c);

type Phases = readonly [number, number, number, number];

/**
 * A smooth, tile-wrapping field in roughly -1..1. This replaces every dither, hash-block and
 * ordered pattern that used to live in this file, and the reason is arithmetic rather than taste.
 *
 * A dither or a block hash puts two palette stops next to each other, and on the `water` ramp the
 * nearest two stops are 42 luma apart -- so every such pixel pair scores as a hard edge, and the
 * whole river came out at two and a half times the board's edge density. This field changes by at
 * most about a quarter of a `t` unit per pixel at its steepest term, and the painters below scale
 * it to a tenth of that, so no two neighbouring pixels differ by anything the eye or the score
 * reads as an edge -- while the tile still ends up carrying a dozen distinct blues instead of one.
 *
 * Every term runs on a DIAGONAL, and that is the correction this field needed after its first
 * render. The first version led with `sin(x/32) * cos(y/32)`, which puts exactly one bright column
 * in the middle of every tile -- and the river is a vertical column of tiles, so the result was a
 * pale stripe running the whole length of the water, the 32px grid drawn in light. Four diagonals
 * at two spacings cross each other instead, and nothing in the sum has a vertical or horizontal
 * axis for the eye to catch. Every term is periodic in 32 on both axes, so the field is identical
 * where one tile meets the next and there is no seam to find.
 *
 * The WEIGHTING was then corrected a second time, once the surface began to be quantised. Led by
 * its two period-16 terms the field has a regular diamond lattice in it, which a continuous paint
 * hides and a hard band boundary draws in outline -- the first quantised render came out as
 * camouflage. Leading instead with the two period-32 terms gives masses twice as broad, no visible
 * repeat inside a tile, and about a third fewer band boundaries, which is also most of the edge
 * density that render overshot by. The total amplitude is held near its old value (sd 0.368
 * against 0.383) so the band thresholds below still mean what they say.
 */
const field = (x: number, y: number, p: Phases): number =>
  0.2 * Math.sin((TAU * (x + y)) / 16 + p[0]) +
  0.17 * Math.cos((TAU * (x - y)) / 16 + p[1]) +
  0.36 * Math.sin((TAU * (x + 2 * y)) / S + p[2]) +
  0.27 * Math.cos((TAU * (2 * x - y)) / S + p[3]);

/**
 * A lumpy radius per angle: three harmonics giving three to five broad lobes. The amplitudes are
 * deliberately large -- a boulder drawn on a gentle wobble is still an egg, and the board's rocks
 * are chunky, with flat-ish faces meeting at blunt corners. At radius 7 this swings the silhouette
 * by three pixels, which is the difference between a stone and a pebble shape.
 */
const lump = (a: number, seed: number): number =>
  1 +
  0.2 * Math.sin(2 * a + seed) +
  0.13 * Math.sin(3 * a + seed * 2.3) -
  0.08 * Math.cos(5 * a + seed * 0.7);

/* --- the surface ---------------------------------------------------------- */

/**
 * The five values the open river is drawn in, and nothing between them.
 *
 * Taken from the board's own histogram rather than from the ramp's four stops, which is why three
 * of them are `tone()` calls used as CONSTANTS rather than as a gradient: the `water` ramp's stops
 * land at luma 99, 135, 176 and 243, and the board's river body sits at 152-156 with its shade
 * near 122. Neither of those is a stop, and three previous passes tried to synthesise them with
 * dithers and glows and got a lattice. Evaluated once, here, they are exact and they are flat.
 *
 *   W_LIT   L 176   the top of a swell: the lit strokes that carry the open surface
 *   W_PALE  L 202   the step below white, which only the fall is bright enough to need
 *   W_FOAM  L 243   white: the shoreline rim, the rope cores and the crest
 *
 * The three mid values this block used to name -- a 99, a 122 and a 151 -- are gone as CONSTANTS,
 * and that is the substance of this pass rather than a tidy-up. They were the whole vocabulary of
 * both the open surface and the fall, and three flat blues is what made the river read as a tiled
 * pool and the fall as three stripes. Both are now `snap`ped off `tone('water', t)` over a range
 * with sixteen or eighteen levels in it, which spans the same luma and spells it in twenty values
 * instead of three. `W_LINE`, the near-black water line, went with them: it was being drawn the
 * length of both banks directly against the grass keyline, and it is what made the shore tile five
 * and a half per cent black where the board's bank is one and a half.
 */
const W_LIT = shade('water', 2);
const W_PALE = tone('water', 0.8);
const W_FOAM = shade('water', 3);

const SURFACE_PHASES: Phases = [0.7, 2.4, 1.1, 3.9];

/**
 * A tone snapped to one of `steps` even levels between `lo` and `hi` on the `water` ramp.
 *
 * This replaces the four-value band cut the surface used to be painted with, and the reason is a
 * scanline off the board rather than a preference. Sampled straight across the board's channel at
 * three heights, every row says the same thing:
 *
 *     midstream -> right bank, board pixels, 6px apart
 *     158 155 153 153 155 152 | 133 132 142 132 132 | 117 108 105 | 202 219 239 | bank
 *     \------ body, flat -----/ \--- darker ----/  \-- darkest --/ \-- foam --/
 *
 * The body is FLAT: luma 152 to 159 over sixteen consecutive samples, and at y=600 it holds 152 to
 * 159 across the entire channel without a single excursion. All of the board's water darkness is a
 * band hugging the bank, two to six pixels wide at our scale, and none of it is scattered over the
 * open surface.
 *
 * Ours was the other way round. Measured on the painted tile, `water` put 18.6 per cent of itself
 * at luma 81-109 and 28.7 per cent at 110-134 -- 47 per cent of the open surface in the two bands
 * the board keeps for its banks -- organised as blobs eight to sixteen pixels across. That is why
 * the river read as pool mosaic: the right values in the wrong places, in camouflage patches.
 *
 * So the surface is still quantised -- flat masses meeting at a boundary is what pixel-art water is
 * -- but into MANY levels over a NARROW range instead of four levels over a wide one. Sixteen
 * levels between luma 131 and 167 is a two-to-three luma step, which is below anything the eye or
 * the edge axis reads as a boundary, while the tile carries sixteen distinct blues where it used to
 * carry five. That is the brief's point exactly: the range goes INSIDE the mass as grade, and the
 * contrast moves to the bank where the board puts it.
 */
const snap = (lo: number, hi: number, steps: number, t: number): RGBA => {
  const k = Math.round(clamp01((t - lo) / (hi - lo)) * (steps - 1));
  return tone('water', lo + (k * (hi - lo)) / (steps - 1));
};

/**
 * The open body: mean t 0.48 (luma 151, the board's own 152-159), swinging a tenth either way.
 *
 * `field` has a standard deviation near 0.37 and a range of roughly +-1, so this puts the bulk of
 * the surface between t 0.42 and 0.54 -- luma 146 to 158 -- with tails to 131 and 167 in the broad
 * patches where several harmonics agree. The patches are the board's: it does carry slightly
 * deeper water in places mid-channel (132-142 at y=480), just not as half the surface.
 */
const SURF_LO = 0.34;
const SURF_HI = 0.62;
const SURF_STEPS = 16;

const bandAt = (x: number, y: number): RGBA =>
  snap(SURF_LO, SURF_HI, SURF_STEPS, 0.48 + 0.16 * field(x, y, SURFACE_PHASES));

type Ripple = readonly [x: number, y: number, len: number];

/**
 * The white dashes, and both the count and the LENGTH are the decision.
 *
 * Measured on the board, white is 1.4 per cent of the river and arrives in short hard marks two to
 * five pixels long. The pass this replaces had one fifteen-pixel and one eleven-pixel streak per
 * tile wrapped in a Gaussian halo, which came to 4.7 per cent white and read as cloud rather than
 * as catchlight -- at whole-map scale it was the main reason the river glowed.
 *
 * Seven short dashes a tile at two to four pixels is about 20 pixels of white in 1024, or 1.9 per
 * cent before the bands overwrite some of them. They are scattered on an irregular pitch and the
 * two variants share no position, so the map's coin-flip between them breaks up the 32px rhythm
 * that turned the previous short-dash attempt into polka dots.
 *
 * Nothing here is drawn with a halo. A white pixel sits directly against the band under it, which
 * is a 60 to 120 luma step -- the hard edge the board has and the thing this file had lost.
 */
const RIPPLES_A: readonly Ripple[] = [
  [3, 6, 3],
  [19, 3, 2],
  [11, 13, 4],
  [25, 17, 3],
  [16, 27, 3],
  [7, 21, 4],
  [29, 9, 2],
  [13, 2, 3],
  [21, 30, 3],
];

const RIPPLES_B: readonly Ripple[] = [
  [22, 8, 3],
  [2, 12, 3],
  [14, 18, 2],
  [27, 21, 4],
  [9, 25, 3],
  [17, 5, 4],
  [5, 30, 3],
  [30, 14, 2],
  [23, 28, 3],
];

/**
 * The lit-blue strokes that carry the surface between the white dashes: longer, one value down,
 * and on a different rhythm so the two sets never line up into rows. Drawn flat in `W_LIT`, hard
 * against whatever band they land on -- these are where most of this file's edge density now
 * comes from, and they are what stops the quantised field reading as contour lines.
 */
const SWIRLS_A: readonly Ripple[] = [
  [20, 2, 6],
  [1, 15, 5],
  [9, 28, 6],
];

const SWIRLS_B: readonly Ripple[] = [
  [6, 4, 6],
  [16, 17, 5],
  [25, 26, 5],
];

/** A flat horizontal run, wrapped. The only mark-making primitive the surface needs now. */
const dash = (img: Img, x0: number, y: number, len: number, c: RGBA): void => {
  for (let i = 0; i < len; i++) wpx(img, x0 + i, y, c);
};

function river(img: Img, ripples: readonly Ripple[], swirls: readonly Ripple[]): void {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img.px(x, y, bandAt(x, y));

  /*
   * Lit strokes first, then white over them, so a white dash that happens to cross a lit stroke
   * reads as the crest of that stroke rather than as two marks fighting. The board's brighter
   * catchlights sit on its lit water for the same reason.
   */
  for (const [x, y, len] of swirls) dash(img, x, y, len, W_LIT);
  for (const [x, y, len] of ripples) dash(img, x, y, len, W_FOAM);
}

/* --- the bank ------------------------------------------------------------- */

/**
 * How deep the land reaches into the tile, measured from the bank-side edge, at position `t` along
 * that edge. Mean 12 of 32, unchanged from the build this replaces, because the map's river width
 * is tuned to it: move the waterline here and the river narrows or widens everywhere at once.
 *
 * Two harmonics, both with a period dividing 32, so the waterline wanders and still joins itself
 * where the tile repeats. docs/PIXEL_STANDARD.md section 5: no straight edge anywhere.
 */
const bankDepth = (t: number): number =>
  12.0 + 3.4 * Math.sin((2 * Math.PI * t) / S + 0.6) + 1.7 * Math.sin((4 * Math.PI * t) / S + 2.3);

/**
 * Where each side starts reading that profile. The map puts `shore-w` down the left bank and
 * `shore-e` down the right bank of the same river, so without this the two banks bulge together
 * and the same boulders sit opposite each other at the same height, all the way down -- a canal,
 * not a river.
 */
const PHASE: Record<Side, number> = { n: 0, e: 11, s: 19, w: 27 };

/** Bank space (along the edge, depth into the tile) -> tile space. */
const toTile = (side: Side, t: number, d: number): [number, number] =>
  side === 'w' ? [d, t] : side === 'e' ? [S - 1 - d, t] : side === 'n' ? [t, d] : [t, S - 1 - d];

/** Tile space -> bank space. The inverse of `toTile`, and the reason one painter serves all four. */
const toBank = (side: Side, x: number, y: number): [number, number] =>
  side === 'w' ? [y, x] : side === 'e' ? [y, S - 1 - x] : side === 'n' ? [x, y] : [x, S - 1 - y];

/**
 * Land test, evaluated rather than stored, so it answers correctly for coordinates outside the
 * tile too. That is what the neighbour lookups need: along the bank the tile repeats, so `t` wraps,
 * while across it the neighbour is open ground on one side and open river on the other -- which a
 * negative or over-32 depth gives for free, since `bankDepth` never leaves 6.9..17.1.
 */
const isLand = (side: Side, x: number, y: number): boolean => {
  const [t, d] = toBank(side, x, y);
  return d < bankDepth(wrap(t) + PHASE[side]);
};

/**
 * The outline the board puts round the whole rock pile. `stone[0]` is luma 96, far too light to
 * read as a line against a luma 155 river, and the pass this replaces reached for `ink[2]` instead
 * -- a purple at luma 52, which is dark enough but is not the rock's own hue. `keyline` takes the
 * ramp's darkest stop down by scaling rather than subtracting, so the result is grey at luma 37:
 * properly dark, unmistakably rock, and the single biggest reason the board's bank reads as one
 * illustrated object rather than as a scatter of stones.
 *
 * THE DROP IS 30, NOT 58, and that correction is worth more than anything else on this tile.
 *
 * At 58 this comes out at luma 37, a near-black, and with `rockTone` melting every boulder's shade
 * side down into it as well, our bank column measured 19.4 per cent of its pixels under luma 60.
 * The board's bank, sampled at its own resolution over rock, grass and waterline together, is 1.6
 * per cent under luma 60 -- we were twelve times too black. What the board actually has is a broad
 * dark MASS: 18.6 per cent at luma 81-109 and 20.2 at 110-134, which is rock in shade, not rock in
 * outline. Its outlines live around luma 60-80 and are thin.
 *
 * At 30 this is luma 66. Against water at 151 and grass at 140-180 it still reads as a hard dark
 * line -- an 80-luma step -- and the shade side it anchors now bottoms out in the band the board
 * actually uses instead of punching a hole in the tile.
 */
const ROCK_LINE = keyline('stone', 30);

/**
 * Where two boulders in the pile touch. Sampled on the board that line comes back luma 80-102, so
 * it is deep shade rather than outline -- the separation is carried by the lit face of the near
 * boulder landing against it, not by the line being black. `keyline('stone', 18)` is luma 79, the
 * bottom of that measured band; the first pass of this file drew these rims near-black and the
 * bank came out as mosaic tile and grout.
 */
const ROCK_CONTACT = keyline('stone', 14);

/** The cracks the board draws across its larger boulders: dark grey, not black. Luma 74. */
const ROCK_CRACK = keyline('stone', 22);

const STONE_FLOOR = tone('stone', 0);

/**
 * The floor the shade side of a boulder melts down to, luma 85, and it is deliberately NOT
 * `ROCK_LINE`.
 *
 * Melting the shade side all the way into the outline value is what made our bank twelve times
 * blacker than the board's. The board keeps the two jobs separate: a thin outline at luma 60-80
 * and a broad shaded mass at 81-134, which together are 39 per cent of its bank. Stopping the melt
 * at 80 puts that mass exactly where the board keeps it while leaving the outline a value of its
 * own to be read against.
 */
const ROCK_SHADE = keyline('stone', 11);

/**
 * `tone('stone', t)` extended BELOW the ramp, from `stone[0]` at luma 96 down into the keyline at
 * luma 37, and the reason for it is the most useful thing the score said all round.
 *
 * The board carries 18.95 per cent of its pixels under luma 60 and only 4.5 per cent hard edges.
 * Those two numbers cannot both be true of 1px outlines -- an outline pixel has light on both
 * sides, so every one of them is two or three edges. They are true of MASSES: the board's darks
 * are big soft regions whose pixels mostly border other dark pixels. Our first pass put all its
 * darkness in outlines, so it bought 17 per cent keyline at a cost of 33 per cent edge density on
 * this tile, which is seven times the board's.
 *
 * So the shade side of a boulder now runs down past the bottom of the `stone` ramp and melts into
 * the colour of its own outline, over a third of the rock, continuously. That is dark AREA: it
 * reads as a stone with a deep shadow on it, it puts real weight under luma 81 and 60, and because
 * the keyline outside it now meets a rock edge that is already nearly as dark, the silhouette
 * costs a fraction of the edges it used to.
 */
const rockTone = (t: number): RGBA =>
  t >= 0 ? tone('stone', t) : mix(STONE_FLOOR, ROCK_SHADE, Math.min(1, -t / 0.6));

/**
 * One boulder, lit from the top-left like everything else in the game, with `lump` for its
 * silhouette so it rasterises into the straight-ish runs and blunt corners the board's rocks have.
 *
 * Drawn in tile space rather than bank space precisely so the light does not rotate with the side:
 * a stone on the east bank is lit from the same corner as a stone on the west bank, or the two
 * tiles read as two different times of day.
 *
 * The shading is the part that changed, and it is the single most valuable edit in this file.
 * Before, a rock was four flat faces cut out of `shade('stone', 0..3)`; the stops are 47, 37 and 30
 * luma apart, so all three terminators scored as hard edges and a rock contributed exactly four
 * colours. Now `u` -- which runs 1 at the upper-left silhouette to -1 at the lower-right -- drives
 * `tone` continuously, so one boulder rounds off through about twenty greys, every neighbouring
 * pair moves by about five luma, and the same silhouette that used to read as a faceted pebble
 * reads as a rounded stone. Measured on the board a bank boulder runs luma 96 in its shade to 210
 * on its lit cap through everything in between, which is exactly the span `tone('stone', 0..1)`
 * covers.
 *
 * Three terms shape it:
 *
 *   - the light itself, `u`, carrying most of the range;
 *   - a rim roll-under over the outer quarter of the radius, which is what turns a lit disc into a
 *     ball and is where the deep shade on this tile actually comes from;
 *   - a slow surface mottle from `field`, because the board's rocks are blotchy rather than clean,
 *     and because a mottle built from a continuous field adds colours without adding edges.
 *
 * `spec` adds a lit cap on the boulders that both face the light and sit in front (section 5's
 * highlight budget). It is a lift on the existing gradient rather than a fifth flat face.
 */
const ROCK_PHASES: Phases = [2.0, 0.3, 4.4, 1.6];

function boulder(img: Img, cx: number, cy: number, r: number, seed: number, spec: boolean): void {
  const squat = 0.86; // a bank of perfect circles reads as a bag of marbles
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / squat;
      const a = Math.atan2(dy, dx);
      const rr = r * lump(a, seed);
      const dist = Math.hypot(dx, dy);
      if (dist > rr) continue;
      const u = (-dx - dy) / (rr * 1.414);
      // The terminator carries its own harmonics, which is what gives the lit face the board's
      // cloud-stepped edge instead of a clean crescent.
      const w = 0.12 * Math.sin(4 * a + seed * 1.7) + 0.08 * Math.sin(7 * a + seed);
      const edge = dist / rr;
      const s = u + w;
      let t = 0.46 + 0.5 * s;
      // The shadow the rock casts on itself: everything past the terminator keeps going down,
      // through the bottom of the ramp and into the keyline. About a third of the boulder, graded
      // over ten pixels, which is dark area rather than a dark line.
      t -= 0.45 * Math.max(0, -s - 0.25);
      // The rim rolls under on every side over the outer 28 per cent of the radius. 0.40 of `t` is
      // about 23 luma per pixel there -- the steepest thing on the rock and still inside the edge
      // threshold, which is what makes the form read as round rather than as cut out.
      t -= (0.4 * Math.max(0, edge - 0.72)) / 0.28;
      if (spec) t += 0.3 * Math.max(0, u - 0.62);
      t += 0.05 * field(x, y, ROCK_PHASES);
      img.px(x, y, rockTone(Math.min(1, t)));
    }

  /*
   * One crack across the larger stones. The board draws these on nearly every boulder big enough to
   * hold one and they are a good part of why its rock band reads as rock rather than as dough; they
   * also put a few genuinely dark pixels inside a pale mass, which is where some of the missing
   * deep shade lives. Small rocks get none -- a crack on a three-pixel pebble is a smudge.
   */
  if (r < 4.6) return;
  const ca = seed * 1.31;
  const cx0 = cx + Math.cos(ca) * r * 0.55;
  const cy0 = cy + Math.sin(ca) * r * 0.55 * squat;
  const steps = Math.round(r * 1.3);
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const b = ca + Math.PI + 0.7 * Math.sin(k * 3 + seed);
    const px = cx0 + Math.cos(b) * r * 1.1 * k;
    const py = cy0 + Math.sin(b) * r * 1.1 * k * squat;
    const dx = px + 0.5 - cx;
    const dy = (py + 0.5 - cy) / squat;
    if (Math.hypot(dx, dy) > r * lump(Math.atan2(dy, dx), seed) - 1.2) continue;
    img.px(px, py, ROCK_CRACK);
  }
}

/**
 * The keyline, done the way `docs/ART_DIRECTION.md` section 3.4 requires: the whole boulder pile is
 * composed on one scratch image and ringed there, so the line lands on the pile's silhouette and
 * never on the seam between two boulders. Ring per boulder and the bank looks quilted.
 *
 * `Img.outline` cannot do this job. It is four-neighbour, so it leaves the corner of every diagonal
 * step open on a lumpy silhouette; it has no way to thicken the shade side; and its lookups stop at
 * the image edge, where this tile needs them to wrap, because the map lays `shore-w` in an unbroken
 * column and a keyline that stops at the tile boundary draws the grid for you.
 *
 * Section 3.2: 1px everywhere, 2px along the bottom and lower-right of any mass wider than 16px,
 * and never on the top or left. The outward normal is the direction with no rock in it, so
 * thickening only where it points down, or right and not up, is that rule stated geometrically.
 */
function ringPile(img: Img, line: RGBA): void {
  const solid = new Uint8Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) solid[y * S + x] = img.get(x, y)[3] > 0 ? 1 : 0;
  const at = (x: number, y: number): boolean => solid[wrap(y) * S + wrap(x)] === 1;

  const ring: [number, number][] = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (at(x, y)) continue;
      let ix = 0;
      let iy = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || !at(x + dx, y + dy)) continue;
          ix += dx;
          iy += dy;
          n++;
        }
      if (n === 0) continue;
      ring.push([x, y]);
      if (iy < 0) ring.push([x, y + 1]);
      if (ix < 0 && iy <= 0) ring.push([x + 1, y]);
    }
  for (const [x, y] of ring) if (!at(x, y)) img.px(wrap(x), wrap(y), line);
}

/**
 * The bank run: two rows of boulders, the back row sitting up on the lawn and the front row
 * straddling the waterline and wading out into the shallows.
 *
 * Section 8 asks for a band packed two deep and roughly a tile wide, and a 32px shore tile that is
 * only twelve pixels of land cannot hold one on the land alone -- on the board the bank is about
 * ten pixels of lawn, four of earth and thirty of rock, which is more bank than we own. So the
 * front row wades: centres at depth 13-22 with the waterline at 12, which is what the board does
 * wherever its river runs against rock anyway, and it is what gives the foam something to break on.
 *
 * HOW MANY, and this is the number the first render of this pass got badly wrong. It carried ten
 * boulders per tile, drawn three times each, on the reading that the board's bank is "crowded".
 * The bank is crowded -- but with BIG rocks. Counted and measured off the board, where one game
 * tile is about 57 screen pixels, its bank boulders are 35 to 50 pixels across and sit about one
 * per 45 pixels of bank: at our scale that is a rock of radius 9 to 11, roughly one and a half per
 * tile. Ten a tile is fourteen times the board's density, and the score said so without ambiguity
 * -- the shore tile alone profiled at 32.7 per cent edge density against the board's 4.5, where
 * the open water profiled at 1.0 and the fall at 0.2. Every one of those boulders brings its own
 * keyline and its own contact rims, and on a 32px tile the silhouette per unit area is what the
 * edge axis is measuring.
 *
 * Five now, two of them big. Fewer, larger rocks is also simply what the board looks like: its
 * bank reads as a few substantial stones with grass and water between them, not as shingle.
 *
 * Pitch is uneven on both rows and the two rows interleave, so no boulder sits directly behind
 * another, and the reach into the water swings nine pixels across the front row so that a column
 * of these tiles does not read as a kerb.
 *
 * `t` is a position on the bank profile, so a boulder sits relative to the waterline; the tile
 * coordinate is that position less the side's phase, which is what keeps the two banks from
 * matching.
 */
type Rock = readonly [t: number, depth: number, r: number, seed: number, spec: boolean];

/**
 * Back row: one rock, up on the lawn, drawn first so the front row overlaps it.
 *
 * Back and front together now occupy only about three quarters of the bank, and THAT IS THE POINT.
 * The map lays `shore-w` down the whole left bank and `shore-e` down the whole right bank, so
 * whatever this tile covers is covered continuously for forty-two tiles. The previous build packed
 * five boulders evenly across all 32 pixels, and the result -- visible at whole-map scale and
 * called out in review -- was two unbroken parallel grey walls flanking a straight canal.
 *
 * A tile laid in a column repeats every 32 pixels no matter what, so the only way to make a run
 * breathe from inside the tile is to leave part of the tile EMPTY. The rocks are therefore
 * clustered into roughly t = -3..18 and the remaining eleven pixels are left as plain grass
 * running down to the water. A column then reads as clumps of rock with open bank between them,
 * which is what the board's river has: a few big stones, grass to the waterline, and gaps.
 *
 * The cluster had to be tightened twice, because `lump` is easy to forget when choosing these
 * numbers: it swings a boulder's radius by up to about 30 per cent, so a rock nominally of radius
 * 8 reaches more than 10, and the first attempt at a gap -- nominal span 23 of 32 -- closed up to
 * almost nothing once the keylines were on. Size these against the LUMPED reach, not the radius.
 *
 * Placing the clumps so the two banks do not line up is what `PHASE` is for, and `e` and `w` are
 * now half a tile apart so the gap on one bank faces rock on the other.
 */
const BACK: readonly Rock[] = [[3, 10.5, 4.0, 0.4, false]];

/**
 * Front row: two substantial stones straddling the waterline, plus one straggler out in the
 * shallows. Sizes follow the board, where a bank boulder is 35 to 50 screen pixels against a tile
 * of about 57 -- a radius of 6 to 9 at our scale, not shingle.
 *
 * The straggler sits inside the cluster's span rather than beyond it, so it adds a stone in the
 * water without widening the band and closing the gap the run needs.
 */
const FRONT: readonly Rock[] = [
  [5, 17.0, 7.5, 1.3, true],
  [12, 15.5, 5.0, 5.9, true],
  [9, 23.0, 2.4, 3.1, false],
];

/**
 * One rock laid into the pile, with a deep-shade rim on whatever rock is already under it.
 *
 * Section 8: where two boulders meet it is deep shade, never keyline -- the keyline is for the
 * pile's silhouette against the world.
 *
 * Each boulder is drawn three times, a tile apart along the bank, so one sitting on the tile edge
 * is a single boulder in the run rather than two halves meeting at a seam.
 */
function layRock(pile: Img, side: Side, rock: Rock): void {
  const [t, depth, r, seed, spec] = rock;
  const one = new Img(S, S);
  for (const k of [-1, 0, 1]) {
    const [cx, cy] = toTile(side, t - PHASE[side] + k * S, depth);
    boulder(one, cx, cy, r, seed, spec);
  }
  const solidHere = (x: number, y: number): boolean => one.get(wrap(x), wrap(y))[3] > 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (solidHere(x, y) || pile.get(x, y)[3] === 0) continue;
      let touching = false;
      for (let dy = -1; dy <= 1 && !touching; dy++)
        for (let dx = -1; dx <= 1 && !touching; dx++)
          if ((dx !== 0 || dy !== 0) && solidHere(x + dx, y + dy)) touching = true;
      if (touching) pile.px(x, y, ROCK_CONTACT);
    }
  pile.blit(one, 0, 0);
}

/**
 * Grass sprigs on the bank. Three blades, small: section 6.2 asks for 10x11 tufts on a grass tile,
 * and a tuft that size does not fit the four to six pixels of lawn a shore tile has left above its
 * rock band. Noted as a departure rather than squeezed in at the wrong scale. Drawn a third of the
 * way down the `grass` ramp so a blade sits in its own shade against the lit lawn.
 */
function sprig(img: Img, x: number, y: number): void {
  const blade = tone('grass', 0.4);
  img.px(x, y + 2, blade);
  img.px(x, y + 1, blade);
  img.px(x + 1, y + 2, blade);
  img.px(x + 2, y, blade);
  img.px(x + 2, y + 1, blade);
  img.px(x + 3, y + 2, blade);
  img.px(x + 4, y + 1, blade);
  img.px(x + 4, y + 2, blade);
}

/**
 * The land's `t` profile, read inwards from the waterline, and the other place a keyline earns its
 * keep on this tile.
 *
 * The board draws a near-black line wherever ground meets water, then a narrow band of wet earth in
 * shade, then the lawn climbing to full daylight. The pass this replaces had a 2.2px slab of flat
 * `shadow[1]` and then a 4px-block hash between `grass[2]` and `grass[3]` -- 33 luma apart, so the
 * lawn was a field of hard little squares. Four continuous bands instead, each handing over to the
 * next inside the edge threshold:
 *
 *   into <= 1.0   keyline('grass')          luma 53   the line itself
 *   into <= 2.5   tone('shadow', .80 -> 1)  luma 72 -> 81   wet earth in the bank's own shade
 *   into <= 5.5   tone('grass', 0 -> .30)   luma 93 -> 121  the lawn coming up out of shade
 *   beyond        tone('grass', .55 -> .95) luma 147 -> 192 daylight, modulated by `field`
 *
 * The wet-earth band used to start at `tone('shadow', .28)`, luma 46, and run four pixels wide, on
 * the reasoning that "dark AREA is what the board is made of". The area was right and the VALUE
 * was wrong. Measured at its own resolution the board's bank is 1.6 per cent under luma 60 and 39
 * per cent between 81 and 134: its darkness is a broad mid-dark mass, not a black one. Ours ran
 * 7.7 per cent under 60 with this band supplying most of it. Starting at luma 70 and handing over
 * to shaded grass keeps every pixel of the area and moves it into the band the board uses.
 *
 * The one hard step left in the whole profile is the first: white foam at luma 243 against that
 * keyline at 53. That step is the board's as well, and it is most of what makes a waterline read.
 */
const LAND_PHASES: Phases = [1.4, 3.1, 0.2, 2.7];
const BANK_LINE = keyline('grass');

function landTone(into: number, x: number, y: number): RGBA {
  if (into <= 1) return BANK_LINE;
  if (into <= 2.5) return tone('shadow', 0.8 + (0.2 * (into - 1)) / 1.5);
  if (into <= 5.5) return tone('grass', (0.3 * (into - 2.5)) / 3);
  return tone('grass', 0.55 + 0.2 * (1 + field(x, y, LAND_PHASES)));
}

/**
 * The shoreline, as five hard rings out from whatever the water is touching.
 *
 * The pass this replaces ran six rings down a continuous `tone('water', t)` ramp from 0.98 to
 * 0.56, so the bank faded into the river over six pixels and every step was small enough to score
 * as no edge at all. That is the airbrush, and it is the opposite of the board, whose shoreline is
 * the crispest thing in the frame.
 *
 * Read off the board, from the bank outwards:
 *
 *   d1     W_FOAM   the white break where the water piles against the bank -- or W_LINE, the dark
 *                   water line, where it runs quiet in the lee. The two ALTERNATE along the
 *                   shoreline rather than stacking, and that is a correction: drawing a dark line
 *                   at d1 and foam at d2 put a two-pixel black rule next to the grass keyline all
 *                   the way down both banks, so the river came out drawn in outline like a sticker
 *                   rather than lying in the ground. One pixel, one or the other, is the board.
 *   d2,d3  W_LIT    the shallow water the break runs out into, the outer edge left ragged.
 *   d4,d5  W_DARK   the bank's own shadow lying on the water.
 *
 * That last band is the correction to a note in section 8, which asks for a darker band and was
 * then removed in an earlier pass on the grounds that "the board's water is BRIGHTEST where it
 * meets rock". Both are true and the ORDER is what matters: the board is brightest in the first
 * two pixels and then distinctly deeper for the next few before it reaches open water. Removing
 * the band lost the only tonal structure the bank had; putting it back outside the foam rather
 * than under it is what section 8 was asking for.
 *
 * The outer two bands are two pixels wide rather than one, and that is an edge-density decision
 * taken by measurement. Five single-pixel rings means five hard steps stacked in five pixels along
 * every shoreline and around every boulder, and the first render of this shoreline came back at
 * 25.89 edge density against the board's 17.44. Doubling the outer bands keeps every tone and
 * halves the boundaries, and a 2px band also simply reads better: a 1px ring is a line round a
 * shape, a 2px band is water doing something.
 *
 * THAT ORDER WAS WRONG, and the scanline says so flatly. The apron above ran bright-bright-dark
 * from the bank outwards: W_LIT at luma 176 in the two pixels next to the foam, and the darker band
 * two pixels further out. The board runs the other way, at every height it was sampled:
 *
 *     foam 239 219 202 | 105 108 117 | 132 132 142 133 | 152 153 153 155 155 158
 *     d1               | d2  d3  d4  | d5  d6  d7  d8  | open body, flat to midstream
 *
 * Darkest immediately inside the foam, climbing to the body over six or eight pixels. That is a
 * CROSS-SECTION -- the channel has a near bank, a deep middle and a far bank, and the eye reads
 * depth from it. Ours had a bright halo round the bank instead, which is why the river read as a
 * tiled pool: a pool is lit from inside its own edge, a river is dark where the bank overhangs it.
 *
 * So `CHANNEL` is the board's own profile, as `t` on the `water` ramp per pixel out from the
 * waterline, and `shore` now runs the apron twelve rings deep instead of five. Twelve is not
 * arbitrary: a shore tile holds about twenty pixels of water, so twelve rings put the hand-over to
 * the open body inside the tile, and the `water` tiles beyond it are already at the body value --
 * the cross-section therefore completes across the river's whole three-to-five tile width rather
 * than stopping at a tile edge.
 *
 * Every step here is between two and nine luma, so the whole gradient is below the edge threshold
 * and adds eleven distinct blues without adding one boundary. All of this tile's contrast stays
 * where the board puts it: the single hard step from foam at 243 to dark water at 100.
 *
 * THAT PARAGRAPH WAS AN INTENTION AND NOT A MEASUREMENT, and for three passes the apron did not
 * draw any of it. `CHANNEL` was being snapped through the OPEN BODY's band -- `snap(SURF_LO=0.34,
 * SURF_HI=0.62, ...)` -- and `snap` clamps `(t - lo) / (hi - lo)` into 0..1, so every ring below
 * 0.34 resolved to the identical `tone('water', 0.34)`. Six of the eleven rings are below it
 * (0.02, 0.05, 0.11, 0.19, 0.27, 0.33), which is the whole near half of the cross-section, the
 * half that carries the depth. Measured on the painted tile: eleven rings drew FOUR distinct
 * blues, the apron spanned 16.2 luma against the 51.8 these numbers ask for, and no pixel of water
 * anywhere in a shore tile went below luma 135.6 where the board's channel reaches 105. A quarter
 * of every shore tile came out one flat colour in runs of up to 22 pixels, which is why the river
 * read as a sticker cut out of the lawn rather than as a channel with a near bank.
 *
 * So the apron gets its OWN band, and the one thing to understand about it is that `CHANNEL` is
 * already in ramp units: 0.02 is `tone('water', 0.02)` and means it. The band therefore has to
 * start at the bottom of the ramp, not at the bottom of the open body's swing.
 *
 *   APRON_LO 0.0 .. APRON_HI 0.52 over APRON_STEPS 20 is a step of 0.027 `t`, which near the foot
 *   of the `water` ramp is about 3 luma -- the same sub-threshold step the body's own band uses,
 *   so the cross-section still grades rather than banding, and the eleven rings now draw eleven
 *   tones instead of collapsing to one.
 *
 * `APRON_HI` sits a little above `CHANNEL`'s outermost ring (0.48, the body's own mean) so the
 * hand-over from the apron to the open water lands within a luma of the body value and the two
 * meet without a step. The body's band is untouched: `SURF_LO`, `SURF_HI` and `SURF_STEPS` still
 * belong to `bandAt` alone, and `water`'s mean stays at 155.9.
 */
const FOAM_PHASES: Phases = [3.6, 1.2, 2.9, 0.5];
const CHANNEL: readonly number[] = [
  0.02, 0.05, 0.11, 0.19, 0.27, 0.33, 0.38, 0.42, 0.45, 0.47, 0.48,
];
const APRON_LO = 0.0;
const APRON_HI = 0.52;
const APRON_STEPS = 20;

/*
 * ===========================================================================
 * THE HAND-OVER: A BANK TILE ENDS IN OPEN WATER, NOT IN THE MIDDLE OF ITS OWN APRON.
 * ===========================================================================
 *
 * The client, 2026-10-22, on the straight banks: a faint seam where each one meets the open river.
 * Measured on HEAD (3c88684), straight across the seam -- the bank's outer line against the `water`
 * tile's first -- the luma step averaged 20.4 on `shore-w`, 25.0 on `shore-e`, 15.8 and 13.7 on
 * `shore-n` and `shore-s`, against 2.2 to 10.4 between neighbouring columns inside the open water
 * and about 6 inside the bank itself. Two causes, and they add:
 *
 *   1. THE CROSS-SECTION RAN OFF THE TILE. `CHANNEL` is eleven rings out from whatever is solid, and
 *      the front-row boulders wade out to depth 27, so along those stretches the apron was still on
 *      its third or fourth ring -- luma 99 to 120 -- when it hit the tile edge, and the open river
 *      on the far side is at 150. A dark band sawn off by the grid.
 *   2. THE LAST RING WAS NOT THE RIVER. Where the apron did complete, it finished at `CHANNEL`'s 0.48
 *      wobbled by `FOAM_PHASES` at a twentieth, while the open water is `bandAt`: 0.48 wobbled by
 *      `SURFACE_PHASES` at a sixth, through a different quantiser. Two fields that agree on average
 *      and nowhere in particular, so the seam drew itself even where the band had ended.
 *
 * So the apron now hands over to `bandAt` -- the open body, exactly, the same function the `water`
 * tile paints -- in two ways at once, and takes whichever is further along:
 *
 *   - BY RING. Over the outer half of `CHANNEL` the ring's own tone slides into the surface's, and
 *     the last ring IS the surface. That closes the line inside the tile where the apron used to
 *     stop and `river()`'s pixels began (cause 2), and it is why the hand-over starts at ring
 *     `HAND_RING` rather than at the foam: the dark near half of the cross-section, which is what
 *     the board's scanline is about and what `SHORE_DARK_FLOOR` guards, is not touched.
 *   - BY EDGE. Over the last `HAND_EDGE` pixels before the tile's water-facing boundary the same
 *     slide runs on distance to that boundary, and on the boundary itself the pixel IS `bandAt`.
 *     The field is periodic in the tile, so `bandAt` on our outer column and on the next tile's first
 *     column are two neighbouring samples of one continuous surface: the seam is as visible as any
 *     other column of the river, which is to say not at all (cause 1).
 *
 * Where a stone wades close to the edge the cross-section is compressed into what room is left
 * rather than cut: the dark still sits at the foot of the rock, it just climbs to the body faster.
 * The foam is untouched -- a white rim against open blue is the board's own hardest step and it is
 * meant to be there.
 *
 * The corners take the same hand-over off each arm, composed the way their land is: a point's water
 * is either arm's water, so it hands over by the NEARER of its two open edges (`max`); a cove's
 * water is both arms' at once, so by the FURTHER (`min`). Either way, along an arm the weight is
 * exactly the straight bank's, so an arm still meets its straight neighbour pixel for pixel in kind
 * and in tone, and a point's two open edges are `bandAt` from end to end.
 */
const HAND_RING = 5;
const HAND_EDGE = 8;

/** The open body's `t` at a pixel, before `bandAt` snaps it: the surface the apron hands over to. */
const surfaceT = (x: number, y: number): number => 0.48 + 0.16 * field(x, y, SURFACE_PHASES);

/** How far a pixel `e` pixels in from a water-facing tile edge is handed over to the open body. */
const edgeHand = (e: number): number => smooth(clamp01(1 - e / HAND_EDGE));

/**
 * One pixel of the apron, `d` rings out from what is solid (`d >= 2`; ring 1 and the wide ring 2 are
 * foam and the caller paints them), with `open` the edge hand-over at this pixel.
 *
 * Untouched -- byte for byte the cross-section this file drew before -- wherever neither hand-over
 * has begun. Once one has, the tone is mixed towards `surfaceT` and snapped on a grid that spans
 * both bands at the apron's own step, so nothing clamps at `APRON_HI`; at full weight it is `bandAt`.
 */
function apron(d: number, x: number, y: number, open: number): RGBA {
  const k = Math.min(CHANNEL.length - 1, d - 2);
  const own = CHANNEL[k]! + 0.05 * field(x, y, FOAM_PHASES);
  const h = Math.max(open, smooth(clamp01((k - HAND_RING) / (CHANNEL.length - 1 - HAND_RING))));
  if (h <= 0) return snap(APRON_LO, APRON_HI, APRON_STEPS, own);
  if (h >= 1) return bandAt(x, y);
  const step = (APRON_HI - APRON_LO) / (APRON_STEPS - 1);
  const steps = Math.round((SURF_HI - APRON_LO) / step) + 1;
  return snap(APRON_LO, SURF_HI, steps, own + (surfaceT(x, y) - own) * h);
}

/* --- the sealed banks ----------------------------------------------------------- */

/*
 * ===========================================================================
 * WHERE THE RIVER CROSSES THE BORDER BAND, THE BANK IS SEALED WITH STONE, NOT HIDDEN UNDER A HEDGE.
 * ===========================================================================
 *
 * The client, 2026-10-22: where the river meets the map's top and bottom border rows, "water meets
 * hedge or rock with a hard edge" -- (31,0), (35,0), (30,1), (29,0), (27,1), (36,1) at the top and
 * (15,41)/(16,41) at the bottom. Walked through `pnpm world`, every one is the same picture: the
 * border band is solid by rule, so a bank tile on it carried the band's cover, and every cover tile
 * (`bush`, `bush-low`, `bush-tall`, `rock`) paints its own opaque 32x32 of lawn. The bank's foam,
 * its keyline and its stones went under that square, and the open water beside it ran straight into
 * lit grass across the tile edge -- the same square-bitten-out-of-the-bank fault the dredge pass in
 * `forest-map.ts` cured everywhere BELOW the band, left standing on it for a reason that still holds.
 *
 * THE REASON, AND WHY THIS DOES NOT BREAK IT. The band is the edge of the world: two rows (one at the
 * bottom) of solid ground. Lifting the cover off a bank there would show a lawn the player can see
 * and cannot walk onto, which is an invisible wall at the top of the frame; that is why the cover
 * was kept. So the cover stays, and only what it DRAWS changes. A sealed bank is the bank tile
 * itself, whole -- the same waterline, foam, apron, hand-over and boulders, pixel for pixel on all
 * four edges -- with its lawn given over to stones: the band's own vocabulary where it meets the
 * river (`sealTile` there already chooses `rock` in the gorge) and the thing that reads as "you
 * cannot stand here" without a square of anything. The map lays these in `decor-below`, opaque, over
 * the same bank in `ground`, and the cell stays solid, as the band requires.
 *
 * THE STONES ARE PLACED BY MEASUREMENT, NOT BY HAND, because twelve shapes of land is twelve answers
 * and a hand-placed list is a guess at each. `sealStones` stands each stone on open lawn, lets its
 * body run back behind the bank's own stones and out into the shallows (`SEAL_WADE`) -- the foam is
 * drawn after the pile, so it breaks round a sealing stone exactly as round the bank's own -- puts
 * the biggest one that fits where there is most room, takes that ground away, and goes again. The
 * room is bounded by the tile's edges EXACTLY, not by a margin (see `sealStones`): a sealed bank
 * meets every neighbour as the plain bank does, and the guard at the foot of this file checks all
 * four edges of all twelve against their plain banks, pixel for pixel.
 *
 * HOW MUCH LAWN IS LEFT, AND WHY THAT IS ENOUGH. The straight banks' lawn is a strip seven to
 * seventeen pixels deep against a land edge no stone may cross, so what fits there is a stone of
 * radius two to four, not the band's big boulder; a point's land is a wedge its own stones already
 * cover, and nothing more fits at all (`shore-nw`, `-ne` and `-se` seal to themselves, `-sw` gains
 * one pebble). That is a measured limit rather than an omission, and the measure that matters is
 * the band's own: `rock`, the cover the band already uses as "a cell you cannot stand on", shows
 * 528 pixels of open lawn round its boulder (measured 2026-10-22). Every sealed bank shows fewer --
 * 11 to 393, the straight four 158 to 186 against 192 to 201 unsealed -- and the guard holds them
 * under the `rock` tile's figure, read off its painter, so the border reads as solid by the band's
 * own standard and not by one invented for these tiles.
 */
/**
 * How far past the waterline a sealing stone may wade. The bank's own front row wades eleven pixels
 * out (`FRONT`); a sealing stone stays nearer the land, so it reads as the bank's stones piled
 * higher rather than as a new spit, and so it leaves the river its width at the border.
 */
const SEAL_WADE = 9;
/** The keyline round a stone, a pixel and a half on the diagonal and one more on its shaded side. */
const SEAL_RING = 2.5;
const SEAL_COUNT = 5;
const SEAL_R_MIN = 2.2;
const SEAL_R_MAX = 6.5;

/**
 * The furthest a boulder of nominal radius `r` reaches from its centre, pixel centre to pixel centre:
 * `lump` carries it to 1.41 r, and `boulder()` scans only r + 1 either side of a centre on a half
 * pixel, which clips it at r + 2. The inverse, below, is what a measured room allows.
 */
const reachOf = (r: number): number => Math.min(1.41 * r, r + 2);
const radiusFor = (reach: number): number => (reach <= reachOf(4.88) ? reach / 1.41 : reach - 2);

/**
 * The shoreline distance field: how many 4-neighbour steps each water pixel is from what is solid,
 * up to the apron's depth, -1 beyond it and on the solid itself. `step` says which moves exist --
 * the straight banks wrap along the bank and not across it, the corners do not wrap at all.
 */
function rings(
  solid: Uint8Array,
  w: number,
  h: number,
  step: (x: number, y: number, dx: number, dy: number) => [number, number] | null,
): Int8Array {
  const dist = new Int8Array(w * h).fill(-1);
  let front: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid[y * w + x]) front.push([x, y]);
  for (let d = 1; d <= CHANNEL.length + 1 && front.length; d++) {
    const next: [number, number][] = [];
    for (const [x, y] of front)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const to = step(x, y, dx, dy);
        if (to === null) continue;
        const [nx, ny] = to;
        const i = ny * w + nx;
        if (solid[i] || dist[i] !== -1) continue;
        dist[i] = d;
        next.push([nx, ny]);
      }
    front = next;
  }
  return dist;
}

/**
 * The stones a sealed bank adds, as `[cx, cy, rock]` in tile pixels.
 *
 *   into(x, y)      how far inland a tile pixel is: positive on the lawn, negative in the water
 *                   (how far past the waterline), and -Infinity on a stone the bank already has;
 *   edgeRoom(x, y)  how far a stone's whole footprint, keyline included, may reach from a centre
 *                   at (x, y) and leave every pixel on the tile's four edges exactly as it was.
 *
 * `edgeRoom` is the part that makes a sealed bank safe to lay, and it is EXACT rather than a margin
 * guessed wide. An edge pixel of land or stone must simply not be covered. An edge pixel of water is
 * coloured by its ring -- its 4-neighbour distance to the nearest solid pixel, `d0` -- so a stone may
 * come no nearer to it than `d0`: a path of steps is never shorter than the straight line, so a stone
 * whose nearest pixel is `d0` away cannot shorten that distance, and the foam, the channel and the
 * hand-over on the edge are untouched. Beyond the apron's depth the bound is the depth itself.
 */
function sealStones(
  into: (x: number, y: number) => number,
  edgeRoom: (x: number, y: number) => number,
  salt: number,
): [number, number, Rock][] {
  /*
   * `free` is where a stone's body may lie: the lawn, the shallows out to `SEAL_WADE`, and the
   * bank's own stones, which a sealing stone may sit BEHIND -- it is laid first and they are drawn
   * over it, so what shows of it is the part on the lawn, which is the point. `centre` is where one
   * may stand: on open lawn only, so a stone is never wholly hidden behind the bank's own.
   */
  const free = new Uint8Array(S * S);
  const centre = new Uint8Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = into(x, y);
      free[y * S + x] = v === -Infinity || v > -SEAL_WADE ? 1 : 0;
      centre[y * S + x] = v > 0 ? 1 : 0;
    }
  const out: [number, number, Rock][] = [];
  for (let n = 0; n < SEAL_COUNT; n++) {
    let best = 0;
    let bx = -1;
    let by = -1;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!centre[y * S + x]) continue;
        // The room a stone centred here has: to the shallows' edge, to a stone already there and
        // to whatever the tile's edges allow, less its keyline, as a radius.
        let room = edgeRoom(x + 0.5, y + 0.5);
        for (let v = 0; v < S && room > best; v++)
          for (let u = 0; u < S; u++)
            if (!free[v * S + u]) room = Math.min(room, Math.hypot(u - x, v - y) - 0.5);
        const r = Math.min(SEAL_R_MAX, radiusFor(room - SEAL_RING));
        if (r > best) {
          best = r;
          bx = x;
          by = y;
        }
      }
    if (best < SEAL_R_MIN) break;
    out.push([bx + 0.5, by + 0.5, [0, 0, best, 0.9 + salt * 0.37 + n * 2.3, n === 0]]);
    // Take its ground away, but only its body: the next stone may lean on this one's rim, which is
    // what turns three stones into a pile instead of three pebbles in a row.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (Math.hypot(x - bx, y - by) <= best + 1) {
          free[y * S + x] = 0;
          centre[y * S + x] = 0;
        }
  }
  return out;
}

/** The pixels on a tile's four edges, each once. */
const EDGE_PIXELS: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (x === 0 || y === 0 || x === S - 1 || y === S - 1) out.push([x, y]);
  return out;
})();

function shore(side: Side, seal = false): (img: Img) => void {
  return (img) => {
    // The river first, and the whole tile of it, so the field and the dashes run unbroken from the
    // open water into the bank. Clipping the surface to the wet part would put a phase break along
    // the waterline, which is exactly where the eye is looking.
    river(img, RIPPLES_A, SWIRLS_A);

    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!isLand(side, x, y)) continue;
        const [t, d] = toBank(side, x, y);
        img.px(x, y, landTone(bankDepth(wrap(t) + PHASE[side]) - d, x, y));
      }
    // Two sprigs, on the lawn above the rock band and never on the dark edge.
    for (const [t, d] of [
      [4, 2],
      [19, 1],
    ] as const) {
      const [sx, sy] = toTile(side, t - PHASE[side], d);
      sprig(img, wrap(sx), wrap(sy));
    }

    /*
     * One step of the shoreline distance field: WRAPPED ALONG THE BANK, OPEN ACROSS IT.
     *
     * This used to wrap both axes, and that single `wrap` on the across-bank axis drew the worst
     * mark in the file. The map lays `shore-w` down the left bank, so its land is a column at low
     * `x` -- and a wrapped step from `x = 0` lands on `x = 31`, which the flood then recorded as
     * being ONE pixel from the bank. `d === 1` is the foam rim, so every shore tile painted a flat
     * white rule 32 pixels long down its outer edge: `shore-w` column 31 came back 226,249,252
     * thirty-two times, one colour and zero contour, and identically on `shore-e` column 0,
     * `shore-n` row 31 and `shore-s` row 0. The map places these 51 times, 44 of them on a vertical
     * boundary, at luma 243 against abutting open water at 53-88 -- so the river was outlined in
     * white along the tile grid, with nothing continuing past the line on the far side.
     *
     * The two axes are genuinely different and `isLand` above already says so: along the bank the
     * tile repeats, so `t` wraps and a feature that leaves one end re-enters the other; across the
     * bank the neighbour is open ground on one side and the open river on the other, which is
     * nobody's business of this tile. `toTile` puts depth on `x` for the east and west banks and on
     * `y` for the north and south ones, so that is the axis left open: a step off that edge is
     * refused, the far side of the tile keeps the band `river()` already painted there, and the
     * water runs to the edge and straight into the `water` tile beyond it.
     */
    const acrossX = side === 'e' || side === 'w';
    const step = (x: number, y: number, dx: number, dy: number): [number, number] | null => {
      const nx = x + dx;
      const ny = y + dy;
      if (acrossX) return nx < 0 || nx >= S ? null : [nx, wrap(ny)];
      return ny < 0 || ny >= S ? null : [wrap(nx), ny];
    };

    /*
     * The boulder band, composed on one scratch image and keylined there (section 3.4). Back row
     * first so the front row overlaps it, and the keyline goes on last so it rings the pile and
     * not the seams.
     */
    const pile = new Img(S, S);
    if (seal) {
      /*
       * The plain bank's own pile and rings first, on scratch, only to measure: where the lawn is
       * taken and what every edge pixel's ring is. The sealing stones then go down BEFORE the bank's
       * own, because they stand further up the bank, behind them.
       */
      const own = new Img(S, S);
      for (const rock of [...BACK, ...FRONT]) layRock(own, side, rock);
      ringPile(own, ROCK_LINE);
      const solid0 = new Uint8Array(S * S);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          solid0[y * S + x] = isLand(side, x, y) || own.get(x, y)[3] > 0 ? 1 : 0;
      const d0 = rings(solid0, S, S, step);
      const into = (x: number, y: number): number => {
        if (own.get(x, y)[3] > 0) return -Infinity;
        const [t, d] = toBank(side, x, y);
        return bankDepth(wrap(t) + PHASE[side]) - d;
      };
      // The rings wrap along the bank, so a stone near one end is measured round to the other.
      const edgeRoom = (cx: number, cy: number): number => {
        let room = Infinity;
        for (const [x, y] of EDGE_PIXELS) {
          let dx = Math.abs(x + 0.5 - cx);
          let dy = Math.abs(y + 0.5 - cy);
          if (acrossX) dy = Math.min(dy, S - dy);
          else dx = Math.min(dx, S - dx);
          const i = y * S + x;
          const near = solid0[i] ? 0.5 : d0[i]! < 1 ? CHANNEL.length + 2 : d0[i]!;
          room = Math.min(room, Math.hypot(dx, dy) - near);
        }
        return room;
      };
      for (const [cx, cy, rock] of sealStones(into, edgeRoom, PHASE[side]))
        layOpen(pile, cx, cy, rock);
    }
    for (const rock of BACK) layRock(pile, side, rock);
    for (const rock of FRONT) layRock(pile, side, rock);
    ringPile(pile, ROCK_LINE);
    img.blit(pile, 0, 0);

    const solid = new Uint8Array(S * S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        solid[y * S + x] = isLand(side, x, y) || pile.get(x, y)[3] > 0 ? 1 : 0;

    const dist = rings(solid, S, S, step);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = dist[y * S + x]!;
        if (d < 1) continue;
        /*
         * Surf breaks in runs: the water piles up white where it is pushed against the bank and
         * lies dark and quiet in the lee between. At d1 the two ALTERNATE, three to five pixels at
         * a time, and getting that alternation right took three attempts.
         *
         * It is a function of the bank parameter `t`, NOT of the 2-D `field`, and that is the whole
         * trick. The river runs roughly north-south, so on `shore-w` and `shore-e` -- the only two
         * the map lays in quantity -- the waterline is very nearly vertical. `field` varies far too
         * slowly along such a line: sampled down one bank it holds the same sign for twenty pixels
         * at a stretch, so thresholding it drew one bank as a solid white rule and the other as a
         * solid dark one, which is the sticker outline again in two colours. A function of `t` runs
         * ALONG the shore by construction, at a period of 8 that cannot help but alternate, and it
         * divides 32 so it still wraps where the tile repeats.
         */
        const [bt] = toBank(side, x, y);
        const surf = Math.sin((TAU * bt) / 8 + 1.3) + 0.6 * Math.sin((TAU * bt) / 16 + 0.4);
        /*
         * The foam rim, and it is CONTINUOUS now rather than alternating with the dark water line.
         *
         * The previous pass drew foam on the stretches where `surf` is high and `W_LINE` -- a luma
         * 59 near-black -- on the rest, on the reading that the board's water "lies dark and quiet
         * in the lee". Three scanlines across the board say otherwise: the white rim is unbroken at
         * every height sampled, 202-239 against a bank that is already keylined, and the quiet
         * stretches are quiet because the rim narrows to one pixel there, not because it goes dark.
         *
         * Keeping a dark line at d1 was also doing active harm. It sat directly against
         * `BANK_LINE` at luma 53, so wherever `surf` fell the shore carried a two-pixel near-black
         * rule -- and the shore tile measured 5.7 per cent of itself under luma 60 where the board's
         * bank measures 1.6. That rule is most of the difference, and removing it moves those
         * pixels into the 81-134 band where the board keeps three times as much weight as we do.
         *
         * So `surf` now decides the rim's WIDTH, not its colour: one pixel in the lee, two where
         * the water piles against the bank. Varying the width along the shore is also what keeps a
         * column of forty-two identical tiles from reading as a drawn outline -- the rim thickens
         * and thins on a period of 8 that divides 32, so it wraps and never repeats as a rule.
         */
        if (d === 1 || (d === 2 && surf > 0.45)) {
          img.px(x, y, W_FOAM);
          continue;
        }
        /*
         * The cross-section. `CHANNEL` is indexed from the foam outwards, modulated a little by the
         * field so the bands wander across the tile instead of tracking the waterline exactly --
         * the board's dark band is wider under an overhang and narrower off a shallow spit -- and
         * handed over to the open body by ring and by distance to the outer edge (`apron`).
         */
        img.px(x, y, apron(d, x, y, edgeHand(S - 1 - toBank(side, x, y)[1])));
      }
  };
}

/* --- the corners ------------------------------------------------------------ */

/*
 * ===========================================================================
 * THE EIGHT CORNERS: WHERE THE BANK TURNS, IT TURNS IN ONE TILE.
 * ===========================================================================
 *
 * The client, 2026-10-22: "look at all the stones along the bank of the river, make sure there's
 * no issues there". There were, and they were all one fault. The river runs on a diagonal, so the
 * bank is a staircase, and a staircase has two kinds of tile the four straight banks above cannot
 * draw:
 *
 *   a POINT, land with water on two ADJACENT sides -- the nose of each step. The map laid
 *            `shore-w` or `shore-e` there, whose land runs the whole height of the tile, so the
 *            strip of lawn and its boulders ran on to the tile edge and stopped dead against the
 *            open water of the next row: a square of water with a rock in it and no outline on its
 *            land side. Counted on HEAD (2b42743): 40 cells, and one spit.
 *   a COVE,  land whose water is only across a DIAGONAL -- the inside of each step. The map laid
 *            plain grass there, so the waterline of the two tiles beside it ran into a lit lawn
 *            square across a hard tile edge: the V-shaped inlet with a seam beside it, on every step
 *            of the south-west reach. Counted on HEAD: 41 cells off the track and the deck.
 *
 * THE GEOMETRY IS COMPOSED, NOT DRAWN AGAIN, and that is what makes these seamless with what is
 * already on the map. A straight bank is one mask, `isLand(side)`, read off one profile. A point
 * is the land BOTH of its sides' masks agree on; a cove is the land EITHER of them claims. So the
 * NW point is `n AND w` and the SE cove is `n OR w`, and every edge of either is drawn by exactly the
 * profile the straight tile across that edge draws -- the west edge of a NW point is `shore-n`'s east
 * edge, pixel for pixel, because `bankDepth` is periodic in the tile and `PHASE` is per side, not
 * per tile. No new waterline was invented for these, and none could be: the neighbours already fix
 * where it has to cross every edge.
 *
 * The same composition answers OUTSIDE the tile, which is the reason it is worth doing this way.
 * Evaluated at x < 0, `n AND w` is `n` -- the shore-n to the west; at y < 0 it is `w` -- the bank
 * coming down from the north; past the far corner it is open water. So each corner is painted on a
 * 3x3-tile canvas holding its own neighbourhood, and cropped: a boulder that crosses an edge is
 * ringed against the rock it continues into, and the foam and the dark channel are measured from
 * the land actually on the far side of the seam, rather than from a wrap that assumes the tile
 * repeats. These tiles do not repeat. They turn.
 *
 * THE STONES ARE THE STRAIGHT BANKS' STONES. A corner carries the boulder rows of both its sides, at
 * the same positions the straight tiles put them -- so a stone the straight tile next door starts
 * at its edge is finished here, and vice versa -- and keeps a stone of side A only where side A's
 * bank actually RUNS: for a point, where the other side's land is under the stone's centre; for a
 * cove, where it is not. That rule is evaluated at the stone's centre, in the composed geometry,
 * so two tiles sharing a seam always agree on which stones cross it.
 *
 * THE NAMES. A point is named for its land, like the straight banks: `shore-nw` is land in the
 * north-west corner with water to its east and south. A cove is named for its WATER, the one
 * exception, because a cove's land is three quarters of the tile and has no corner to name:
 * `shore-cove-se` is lawn with the river reaching into its south-east corner. Both keep the
 * `shore-` prefix on purpose: every pass in `forest-map.ts` that asks whether a cell is a bank asks
 * `startsWith('shore')`, and these are banks.
 */
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** The two sides that meet at a corner: the sides a point's land touches. */
const SIDES_AT: Record<Corner, readonly [Side, Side]> = {
  nw: ['n', 'w'],
  ne: ['n', 'e'],
  sw: ['s', 'w'],
  se: ['s', 'e'],
};
const ACROSS: Record<Corner, Corner> = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };

/** `bankDepth`'s mean: the depth an arm's waterline calms towards as it turns. */
const BANK_MEAN = 12;
/** Over how many pixels from its straight neighbour an arm's wander fades, and to what share. */
const CALM = 14;
const CALM_FLOOR = 0.25;
/** How hard the turn is rounded, at its fullest: a smooth min of this width blunts it by a quarter. */
const ROUND = 10;
/** The stone a bare point is given on its nose, and how near another stone must be to stand in for it. */
const NOSE: Rock = [0, 0, 5.5, 2.2, true];
const NOSE_CLEAR = 9;

/** The 3x3 canvas a corner is composed on: its own tile in the middle, one tile of context round it. */
const PAD = S;
const WIDE = 3 * S;

/** `ringPile` for a canvas that does not wrap. Same rule, same thickening; no edge is a seam here. */
function ringOpen(img: Img, line: RGBA): void {
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && img.get(x, y)[3] > 0;
  const ring: [number, number][] = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (at(x, y)) continue;
      let ix = 0;
      let iy = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || !at(x + dx, y + dy)) continue;
          ix += dx;
          iy += dy;
          n++;
        }
      if (n === 0) continue;
      ring.push([x, y]);
      if (iy < 0) ring.push([x, y + 1]);
      if (ix < 0 && iy <= 0) ring.push([x + 1, y]);
    }
  for (const [x, y] of ring) if (!at(x, y)) img.px(x, y, line);
}

/** `layRock` for a canvas that does not wrap: one stone, with the deep-shade rim where it overlaps. */
function layOpen(pile: Img, cx: number, cy: number, rock: Rock): void {
  const [, , r, seed, spec] = rock;
  const one = new Img(pile.w, pile.h);
  boulder(one, cx, cy, r, seed, spec);
  const solidHere = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < one.w && y < one.h && one.get(x, y)[3] > 0;
  for (let y = 0; y < pile.h; y++)
    for (let x = 0; x < pile.w; x++) {
      if (solidHere(x, y) || pile.get(x, y)[3] === 0) continue;
      let touching = false;
      for (let dy = -1; dy <= 1 && !touching; dy++)
        for (let dx = -1; dx <= 1 && !touching; dx++)
          if ((dx !== 0 || dy !== 0) && solidHere(x + dx, y + dy)) touching = true;
      if (touching) pile.px(x, y, ROCK_CONTACT);
    }
  pile.blit(one, 0, 0);
}

/** The sprig positions of the straight banks, read as `[t, d]` on a side. */
const SPRIGS: readonly (readonly [number, number])[] = [
  [4, 2],
  [19, 1],
];

/**
 * A corner: `point` is land in corner `c` with water round it on two sides; `cove` is land with
 * the water reaching into corner `c` only. See the long note above.
 */
function corner(kind: 'point' | 'cove', c: Corner, seal = false): (img: Img) => void {
  const [a, b] = kind === 'point' ? SIDES_AT[c] : SIDES_AT[ACROSS[c]];
  const other = (s: Side): Side => (s === a ? b : a);
  /*
   * Which end of each arm meets a straight bank. A point's `n` arm runs off its west edge when the
   * point is in the west, so it opens TOWARDS the other side; a cove's arms open AWAY from it.
   * `open[s]` is true when arm `s` opens at the low end of its own along-bank axis (t = 0).
   */
  const openLow = (s: Side): boolean => {
    const o = other(s);
    const towardsLow = o === 'n' || o === 'w';
    return kind === 'point' ? towardsLow : !towardsLow;
  };
  /** How far along arm `s` a point is from the edge where the straight bank comes in. */
  const along = (s: Side, x: number, y: number): number => {
    const [t] = toBank(s, x, y);
    return openLow(s) ? t + 0.5 : S - 0.5 - t;
  };
  /*
   * THE ARMS STRAIGHTEN AS THEY TURN, and that is the one liberty these tiles take with the bank's
   * profile. Two waterlines that each wander five pixels either way, crossed at the corner, cross at
   * whatever angle their wander gives them -- and at the profile's steepest (a slope of about 1.3)
   * two of them can run nearly parallel, which on the first render drew a land finger one keyline
   * wide out to every point and a sealed pond of water behind every cove's stones. So each arm's
   * wander fades out over `CALM` pixels from the edge where it meets its straight neighbour, down
   * to `CALM_FLOOR` of itself at the turn. At that edge it is the straight bank's own profile,
   * exactly, with zero change of slope -- `smooth` is flat at both ends -- so the seam does not
   * move by a pixel.
   */
  const reach = (s: Side, x: number, y: number): number => {
    const [t, d] = toBank(s, x, y);
    const k = clamp01(along(s, x, y) / CALM);
    const g = 1 - (1 - CALM_FLOOR) * smooth(k);
    return BANK_MEAN + (bankDepth(wrap(t) + PHASE[s]) - BANK_MEAN) * g - d;
  };
  /*
   * ...AND THE TURN IS ROUNDED. `min` of two waterlines meeting at the profile's steepest is a wedge
   * a keyline wide, which drew every point as a dark spike with nothing in it but outline. A smooth
   * minimum (for a cove, maximum) blunts it by up to `ROUND / 4` pixels where the two lines are
   * close -- and `ROUND` itself fades to nothing towards both open edges, so on the arms this is
   * `min` and `max` exactly and the seams stay where the straight banks put them.
   */
  const raw = (x: number, y: number): number => {
    const p = reach(a, x, y);
    const q = reach(b, x, y);
    const k = ROUND * smooth(clamp01(Math.min(along(a, x, y), along(b, x, y)) / CALM));
    const h = k > 0 ? Math.max(k - Math.abs(p - q), 0) / k : 0;
    return kind === 'point' ? Math.min(p, q) - (h * h * k) / 4 : Math.max(p, q) + (h * h * k) / 4;
  };

  /*
   * The land on the wide canvas, and then made of ONE piece of land and ONE piece of water. Any
   * water the river cannot reach from the open corner becomes lawn and any land cut off from the
   * mainland becomes river: a corner has exactly one waterline, and a pond or an islet the size of
   * a few pixels is the profile's arithmetic, not a feature.
   */
  const wet = new Uint8Array(WIDE * WIDE);
  for (let y = 0; y < WIDE; y++)
    for (let x = 0; x < WIDE; x++) wet[y * WIDE + x] = raw(x - PAD, y - PAD) > 0 ? 0 : 1;
  const flood = (sx: number, sy: number, want: number): Uint8Array => {
    const seen = new Uint8Array(WIDE * WIDE);
    const stack: number[] = [sy * WIDE + sx];
    seen[stack[0]!] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % WIDE;
      const y = (i - x) / WIDE;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= WIDE || ny >= WIDE) continue;
        const j = ny * WIDE + nx;
        if (seen[j] || wet[j] !== want) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    return seen;
  };
  const cornerAt = (q: Corner): [number, number] => [
    q.endsWith('w') ? 0 : WIDE - 1,
    q.startsWith('n') ? 0 : WIDE - 1,
  ];
  const [lx, ly] = cornerAt(kind === 'point' ? c : ACROSS[c]);
  const [wx, wy] = cornerAt(kind === 'point' ? ACROSS[c] : c);
  const mainland = flood(lx, ly, 0);
  const river_ = flood(wx, wy, 1);
  for (let i = 0; i < WIDE * WIDE; i++) {
    if (wet[i] === 0 && !mainland[i]) wet[i] = 1;
    else if (wet[i] === 1 && !river_[i]) wet[i] = 0;
  }
  const land = (x: number, y: number): boolean => {
    const X = x + PAD;
    const Y = y + PAD;
    return X >= 0 && Y >= 0 && X < WIDE && Y < WIDE && wet[Y * WIDE + X] === 0;
  };

  /*
   * How far inland, for the lawn's bands. The profile's own number wherever it is good -- which is
   * everywhere on the arms, so the bands meet the straight tiles exactly -- and, where the tidying
   * above turned water into lawn, the distance to the water that is actually left, so a filled pond
   * does not leave its keyline behind as a ring in the grass. `dt - 1` never exceeds the profile's
   * number where the profile is true (the first water pixel is at most one past the waterline), so
   * taking the larger of the two changes nothing on the arms.
   */
  const dt = new Float32Array(WIDE * WIDE).fill(1e9);
  for (let i = 0; i < WIDE * WIDE; i++) if (wet[i] === 1) dt[i] = 0;
  const D = Math.SQRT2;
  for (let y = 0; y < WIDE; y++)
    for (let x = 0; x < WIDE; x++) {
      const i = y * WIDE + x;
      if (x > 0) dt[i] = Math.min(dt[i]!, dt[i - 1]! + 1);
      if (y > 0) dt[i] = Math.min(dt[i]!, dt[i - WIDE]! + 1);
      if (x > 0 && y > 0) dt[i] = Math.min(dt[i]!, dt[i - WIDE - 1]! + D);
      if (x < WIDE - 1 && y > 0) dt[i] = Math.min(dt[i]!, dt[i - WIDE + 1]! + D);
    }
  for (let y = WIDE - 1; y >= 0; y--)
    for (let x = WIDE - 1; x >= 0; x--) {
      const i = y * WIDE + x;
      if (x < WIDE - 1) dt[i] = Math.min(dt[i]!, dt[i + 1]! + 1);
      if (y < WIDE - 1) dt[i] = Math.min(dt[i]!, dt[i + WIDE]! + 1);
      if (x < WIDE - 1 && y < WIDE - 1) dt[i] = Math.min(dt[i]!, dt[i + WIDE + 1]! + D);
      if (x > 0 && y < WIDE - 1) dt[i] = Math.min(dt[i]!, dt[i + WIDE - 1]! + D);
    }
  const depth = (x: number, y: number): number =>
    Math.max(raw(x, y), dt[(y + PAD) * WIDE + x + PAD]! - 1);

  /*
   * Which stones. A stone is laid where the straight bank next door lays it and nowhere a
   * neighbour would cut it:
   *   - centred in the straight bank across an arm's open edge: always, because that tile always
   *     draws it, and its part on this side of the seam has to be here;
   *   - centred in this tile and reaching across its own arm's open edge: always, for the same
   *     reason from the other side;
   *   - centred in this tile and reaching any OTHER edge: never. Across those is open water or open
   *     lawn, which draws no stone, so it would be sawn off at the seam -- exactly the square-edged
   *     boulder the client was pointing at;
   *   - otherwise, where its own bank runs: for a point, where the other side's land is under it;
   *     for a cove, where it is not.
   */
  const inTile = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < S && y < S;
  const inOpenNeighbour = (s: Side, x: number, y: number): boolean => {
    const [t, d] = toBank(s, x, y);
    if (d < 0 || d >= S) return false;
    return openLow(s) ? t < 0 && t >= -S : t >= S && t < 2 * S;
  };
  const lays = (s: Side, cx: number, cy: number, r: number): boolean => {
    if (inOpenNeighbour(s, cx, cy)) return true;
    if (!inTile(cx, cy)) return false;
    // `lump` peaks at 1.41 of the radius, `squat` takes 0.86 off the height, and the keyline
    // and its thickening add two.
    const rx = r * 1.41 + 2;
    const ry = r * 1.41 * 0.86 + 2;
    const crosses = { w: cx - rx < 0, e: cx + rx > S, n: cy - ry < 0, s: cy + ry > S };
    const [t] = toBank(s, cx, cy);
    const opens: Side = s === 'n' || s === 's' ? (openLow(s) ? 'w' : 'e') : openLow(s) ? 'n' : 's';
    if (crosses[opens] && (openLow(s) ? t < S / 2 : t >= S / 2)) return true;
    if ((Object.keys(crosses) as Side[]).some((e) => crosses[e])) return false;
    return reach(other(s), cx, cy) > 0 === (kind === 'point');
  };

  return (img) => {
    river(img, RIPPLES_A, SWIRLS_A);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) if (land(x, y)) img.px(x, y, landTone(depth(x, y), x, y));

    /*
     * Sprigs from both sides' sets, kept only where the whole tuft lands on daylight lawn inside the
     * tile. A sprig is five pixels wide and is not wrapped, so one that would cross an edge is
     * dropped rather than cut.
     */
    for (const s of [a, b])
      for (const [t, d] of SPRIGS) {
        const [sx, sy] = toTile(s, wrap(t - PHASE[s]), d);
        if (sx < 1 || sy < 1 || sx + 5 > S - 1 || sy + 3 > S - 1) continue;
        let lawn = true;
        for (let j = 0; j <= 2 && lawn; j++)
          for (let i = 0; i <= 4 && lawn; i++)
            if (!land(sx + i, sy + j) || depth(sx + i, sy + j) <= 5.5) lawn = false;
        if (lawn) sprig(img, sx, sy);
      }

    /*
     * The stones, both sides' rows, back row first, laid on the wide canvas at every repeat that can
     * reach it, and ringed there so a stone crossing a seam is ringed against what it continues into.
     */
    const layBank = (pile: Img): void => {
      const laid: [number, number][] = [];
      for (const row of [BACK, FRONT])
        for (const rock of row)
          for (const s of [a, b])
            for (const k of [-1, 0, 1, 2]) {
              const [cx, cy] = toTile(s, rock[0] - PHASE[s] + k * S, rock[1]);
              if (cx < -PAD || cy < -PAD || cx >= S + PAD || cy >= S + PAD) continue;
              if (!lays(s, cx, cy, rock[2])) continue;
              layOpen(pile, cx + PAD, cy + PAD, rock);
              laid.push([cx, cy]);
            }
      /*
       * A POINT GETS A STONE ON ITS NOSE if neither row happened to put one there. Which stones a
       * point inherits depends on where the two rows' phases fall, and on two of the four corners
       * they fall clear of the land altogether -- which left the nose as a bare wedge of wet earth
       * and keyline, the darkest and emptiest thing on the bank. The board's headlands are where its
       * stones pile up. One front-row stone, wading off the tip, wholly inside the tile.
       */
      if (kind === 'point') {
        const [ox, oy] = [c.endsWith('w') ? 0 : S - 1, c.startsWith('n') ? 0 : S - 1];
        const [ux, uy] = [c.endsWith('w') ? 1 : -1, c.startsWith('n') ? 1 : -1];
        let i = 0;
        while (i < S && land(ox + ux * i, oy + uy * i)) i++;
        const [tx, ty] = [ox + ux * (i + 1), oy + uy * (i + 1)];
        if (!laid.some(([x, y]) => Math.hypot(x - tx, y - ty) < NOSE_CLEAR))
          layOpen(pile, tx + PAD, ty + PAD, NOSE);
      }
    };
    /*
     * The shoreline distance field over the whole canvas, with no wrap on either axis: the land and
     * the stones on the far side of every seam are on the canvas, so the foam and the dark channel
     * at an edge are measured from what is actually there.
     */
    const openStep = (x: number, y: number, dx: number, dy: number): [number, number] | null => {
      const nx = x + dx;
      const ny = y + dy;
      return nx < 0 || ny < 0 || nx >= WIDE || ny >= WIDE ? null : [nx, ny];
    };
    const solidOf = (p: Img): Uint8Array => {
      const out = new Uint8Array(WIDE * WIDE);
      for (let i = 0; i < WIDE * WIDE; i++) out[i] = wet[i] === 0 || p.data[i * 4 + 3]! > 0 ? 1 : 0;
      return out;
    };

    const pile = new Img(WIDE, WIDE);
    if (seal) {
      // As in `shore()`: the plain bank's own pile and rings on scratch, only to measure, and the
      // sealing stones laid first, behind the bank's own.
      const own = new Img(WIDE, WIDE);
      layBank(own);
      ringOpen(own, ROCK_LINE);
      const solid0 = solidOf(own);
      const d0 = rings(solid0, WIDE, WIDE, openStep);
      const into = (x: number, y: number): number =>
        own.get(x + PAD, y + PAD)[3] > 0
          ? -Infinity
          : land(x, y)
            ? depth(x, y)
            : Math.min(raw(x, y), -0.01);
      const edgeRoom = (cx: number, cy: number): number => {
        let room = Infinity;
        for (const [x, y] of EDGE_PIXELS) {
          const i = (y + PAD) * WIDE + x + PAD;
          const near = solid0[i] ? 0.5 : d0[i]! < 1 ? CHANNEL.length + 2 : d0[i]!;
          room = Math.min(room, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - near);
        }
        return room;
      };
      const salt = (kind === 'cove' ? 5 : 0) + ['nw', 'ne', 'sw', 'se'].indexOf(c);
      for (const [cx, cy, rock] of sealStones(into, edgeRoom, salt))
        layOpen(pile, cx + PAD, cy + PAD, rock);
    }
    layBank(pile);
    ringOpen(pile, ROCK_LINE);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const p = pile.get(x + PAD, y + PAD);
        if (p[3] > 0) img.px(x, y, p);
      }

    const dist = rings(solidOf(pile), WIDE, WIDE, openStep);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = dist[(y + PAD) * WIDE + x + PAD]!;
        if (d < 1) continue;
        // The surf runs along whichever bank this water is nearer, so it carries on from the
        // straight tile across the seam on each arm.
        const near = reach(a, x, y) >= reach(b, x, y) ? a : b;
        const [bt] = toBank(near, x, y);
        const surf = Math.sin((TAU * bt) / 8 + 1.3) + 0.6 * Math.sin((TAU * bt) / 16 + 0.4);
        if (d === 1 || (d === 2 && surf > 0.45)) {
          img.px(x, y, W_FOAM);
          continue;
        }
        // Each arm's own edge hand-over, composed the way the land is: see `apron`'s note.
        const ha = edgeHand(S - 1 - toBank(a, x, y)[1]);
        const hb = edgeHand(S - 1 - toBank(b, x, y)[1]);
        img.px(x, y, apron(d, x, y, kind === 'point' ? Math.max(ha, hb) : Math.min(ha, hb)));
      }
  };
}

/* --- the fall ------------------------------------------------------------- */

/**
 * The fall, and the hardest tile in the set, because `forest-map.ts` lays it 3 wide and 4 tall and
 * every one of those twelve tiles is this exact image.
 *
 * That is why there is no lip and no foam pool here even though the board has both and they are
 * the two best things about its waterfall. A white break across the lip would repeat four times
 * down the fall and read as a ladder; so would a pool. They belong to tiles the map does not have
 * -- see the note handed back with this file. Everything below is vertical, wraps on a period that
 * divides 32, and carries no horizontal feature anywhere.
 *
 * The sheet used to be built from six hard-edged strands: `water[0]` channels at luma 99 and
 * `water[2]` ropes at 177 laid on a `water[1]` field at 135, which is a 36- and a 42-luma step at
 * every strand boundary, six times across every tile, down twelve tiles. Framed on the fall the
 * render scored 14.74 on edge density against the board's 4.50 -- three and a quarter times -- and
 * it was the worst number anywhere in this file.
 *
 * It is one continuous function now. Four sines in `x`, periods 8, 16, 32 and 4, each one's phase
 * dragged sideways by a slow sine in `y` so the ropes sway as they fall. Summed and mapped through
 * `tone('water', 0.45 +- 0.40)` the sheet runs luma 110 in its deepest channels to 201 on its
 * brightest ropes with a mean near 151 -- which is the board's fall measured over 4950 pixels
 * (base 150, channels 110-133, lights 172-191) reproduced as a gradient rather than as a stripe.
 * No two neighbouring pixels across the sheet differ by as much as the edge threshold.
 *
 * The periods all divide 32, so three tiles laid side by side are one sheet; the sways are periodic
 * in 32 down the axis, so four tiles stacked are one fall.
 */
function fallTone(x: number, y: number): number {
  const a = (TAU * (x + 1.5 * Math.sin((TAU * y) / 32 + 0.4))) / 8;
  const b = (TAU * (x + 2.3 * Math.sin((TAU * y) / 16 + 1.9))) / 16 + 2.2;
  const c = (TAU * (x + 2.4 * Math.sin((TAU * y) / 32 + 2.0))) / 32 + 4.1;
  const d = (TAU * (x + 1.0 * Math.sin((TAU * y) / 16 + 3.3))) / 4 + 0.8;
  /*
   * THE WEIGHTING IS THE FIX, and it is the same fault as the crowns in a third ramp.
   *
   * Led by its period-32 term at 0.46 against the period-8 term at 0.18, this sum had about one
   * broad peak per tile -- so the painted fall came out as three fat white ribbons down a pale
   * sheet, which is what the review called it, word for word. The board's fall is the opposite
   * shape: six to eight THIN white ropes across a channel of about the same width, a bright core one
   * or two pixels wide with blue either side of it.
   *
   * Leading with the period-8 term instead, and giving the period-4 term eight times the weight it
   * had, puts a rope roughly every ten pixels. The total amplitude is held at 0.94 against the old
   * 1.00 so the shaping below and the white threshold still mean what they say.
   */
  const rope = 0.3 * Math.sin(a) + 0.24 * Math.sin(b) + 0.24 * Math.cos(c) + 0.16 * Math.sin(d);
  /*
   * Four sines rarely peak together, so their raw sum spends almost all of its time near the
   * middle: the first render of this came back with a luma spread of 17 and not one pixel under
   * 81, a smooth grey-blue slab with no fall in it. The odd root pushes the sum out towards its
   * own extremes while leaving the sign and the zero crossings exactly where they were, so the
   * channels reach the board's luma 110 and the ropes its 200 without any strand boundary turning
   * back into a step.
   */
  const shaped = Math.sign(rope) * Math.pow(Math.abs(rope), 0.62);
  return clamp01(0.45 + 0.4 * shaped);
}

/**
 * The sheet, as `FALL_STEPS` levels between luma 110 and 199, with white on top of it.
 *
 * The six-value band cut this replaces reproduced the board's histogram almost exactly -- measured
 * on the painted tile it came back 23.7 per cent white, 12.4 pale, 7.1 lit, 36.6 body, 17.7 channel
 * and 2.4 deep, against the board's 21/10/12/39/16/2. Every band was within three points, and the
 * tile still read as three white stripes. Six values cannot be anything but stripes: with the ropes
 * running the full height of a tile and the tile repeating four times, six flat masses IS six
 * ribbons, and a histogram cannot tell a ribbon from a rope.
 *
 * So the body is graded and the white is drawn, which separates the two jobs the band cut was
 * conflating. `FALL_LO` is the board's channel value (110) and `FALL_HI` its brightest blue (199);
 * eighteen steps between them is a five-luma step, under the edge threshold, and takes the tile from
 * six distinct colours to around twenty. The white then goes on as thin rope cores at the peaks of
 * a sheet that already has form, instead of being the top sixth of a staircase.
 */
const FALL_LO = 0.1;
const FALL_HI = 0.74;
const FALL_STEPS = 18;

/**
 * Where the rope goes pure white, and it is a threshold on the SHAPED tone rather than a band.
 *
 * Tuned so white lands near the board's 21 per cent once the crest is on. Because `fallTone` now
 * peaks about every ten pixels instead of once a tile, the same share of white arrives as six to
 * eight cores one to three pixels wide rather than as three ribbons eight wide -- the same number of
 * white pixels, organised as the board organises them.
 */
const ROPE_WHITE = 0.655;
const ROPE_PALE = 0.6;

/**
 * The cascade crest: how many pixels of white break over the ledge at column `x`, 0 where it is dry.
 *
 * This is the one deliberate bend of constraint C, and it is taken with the brief's instruction in
 * hand: the fall is to have a lip, a fall and a plunge. A single image laid four tiles tall cannot
 * have one lip -- but it can have FOUR, and four ledges down a gorge is a cascade, which is a real
 * waterfall and a common one in this art's own tradition. The previous build banned horizontal marks
 * outright and the result was vertical wallpaper with no event in it anywhere.
 *
 * What stops a cascade reading as a ladder is that the break is not a rule. Roughly a third of the
 * columns are dry, the wet ones break one to three pixels deep, and both the gaps and the depths run
 * on periods of 32, 16 and 8 -- so the crest wraps where the tile repeats, and the map's own
 * per-tile horizontal mirror reflects the pattern about the tile centre, which means the three
 * columns of the fall carry three different crest profiles at the same height rather than one
 * profile drawn three times.
 *
 * Row 0 is deliberately left as body. A crest starting at the very first row would put the previous
 * tile's bottom row directly against white at the seam, and the seam is the one horizontal line in
 * this tile that the player's eye can actually find.
 */
const crestDepth = (x: number): number => {
  const dry = Math.sin((TAU * x) / S + 0.9) + 0.7 * Math.cos((TAU * x) / 16 + 2.1);
  if (dry < -0.25) return 0;
  return 2 + Math.round(1.4 * Math.sin((TAU * x) / 8 + 1.7));
};

/**
 * Spray: short horizontal white marks scattered down the sheet.
 *
 * The board's fall is covered in these. A THREE-pixel mark is not a rung -- it repeats as texture,
 * the way the white dashes on the open river do -- so unlike the crest these need no justification
 * beyond the board having them. They are placed off the crest rows so the two never merge into a
 * band, and they land only where the sheet is already bright, so a mark never fills a dark channel
 * and breaks the rope structure the fall is read by.
 */
const SPRAY: readonly Ripple[] = [
  [4, 9, 3],
  [21, 14, 3],
  [12, 21, 4],
  [26, 27, 3],
  [8, 17, 2],
  [17, 30, 3],
];

function waterfall(img: Img): void {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = fallTone(x, y);
      const c =
        v > ROPE_WHITE
          ? W_FOAM
          : v > ROPE_PALE
            ? W_PALE
            : // `v` is divided by ROPE_PALE so the body uses the WHOLE of its range before the
              // pale step takes over. Mapping the raw `v` instead left the body topping out at
              // luma 157 and then jumping straight to 202 -- a 45-luma hole in the middle of the
              // sheet, measured as 0.0 per cent of the tile in the 165-194 band. That hole is a
              // hard border inside the mass, which is the exact fault this pass exists to remove.
              snap(FALL_LO, FALL_HI, FALL_STEPS, FALL_LO + (FALL_HI - FALL_LO) * (v / ROPE_PALE));
      img.px(x, y, c);
    }

  /*
   * The crest last, over the ropes, because the water breaking over a ledge is in front of the
   * sheet behind it. One pale row under the white gives the break a lit underside rather than a
   * cut edge, which is what the board draws below its own lip.
   */
  for (let x = 0; x < S; x++) {
    const d = crestDepth(x);
    for (let y = 1; y <= d; y++) img.px(x, y, W_FOAM);
    if (d > 0) img.px(x, d + 1, W_PALE);
  }

  for (const [x, y, len] of SPRAY)
    for (let i = 0; i < len; i++) if (fallTone(wrap(x + i), y) > 0.45) wpx(img, x + i, y, W_FOAM);
}

/* --- the seven tiles ------------------------------------------------------ */

export const WATER_TILES: Record<string, (img: Img) => void> = {
  water: (img) => river(img, RIPPLES_A, SWIRLS_A),
  'water-2': (img) => river(img, RIPPLES_B, SWIRLS_B),
  'shore-n': shore('n'),
  'shore-s': shore('s'),
  'shore-e': shore('e'),
  'shore-w': shore('w'),
  waterfall,
  'shore-nw': corner('point', 'nw'),
  'shore-ne': corner('point', 'ne'),
  'shore-sw': corner('point', 'sw'),
  'shore-se': corner('point', 'se'),
  'shore-cove-nw': corner('cove', 'nw'),
  'shore-cove-ne': corner('cove', 'ne'),
  'shore-cove-sw': corner('cove', 'sw'),
  'shore-cove-se': corner('cove', 'se'),
};

/**
 * The twelve banks again, SEALED: each the bank above with stones on its lawn, for the border band
 * only (see "THE SEALED BANKS" above). `bank-stones-<x>` seals `shore-<x>`. Named off the `shore-`
 * prefix on purpose: every pass in `forest-map.ts` that asks `startsWith('shore')` is asking about
 * the GROUND, and these are only ever laid in `decor-below`, over the bank they seal.
 */
export const SEALED_BANK: Record<string, string> = {};
for (const side of ['n', 's', 'e', 'w'] as const) {
  WATER_TILES[`bank-stones-${side}`] = shore(side, true);
  SEALED_BANK[`shore-${side}`] = `bank-stones-${side}`;
}
for (const kind of ['point', 'cove'] as const)
  for (const c of ['nw', 'ne', 'sw', 'se'] as const) {
    const suffix = kind === 'point' ? c : `cove-${c}`;
    WATER_TILES[`bank-stones-${suffix}`] = corner(kind, c, true);
    SEALED_BANK[`shore-${suffix}`] = `bank-stones-${suffix}`;
  }

/* --- the guard -------------------------------------------------------------- */

/*
 * THE TWO THINGS A PLAYER COULD SEE WRONG WITH A SHORE TILE, checked on the rendered pixels at
 * import time, which is how the rest of this tool's art guards work (`tiles/w-trees.ts`,
 * `tiles/w-undergrowth.ts`, `tiles/s-outdoor.ts`, `sprites/cast.ts`). `tiles.ts` imports this
 * module and `test/art-guards.test.ts` imports `tiles.ts`, so loading is what arms these and
 * `pnpm test` is where they fire.
 *
 * Both bounds below watch a SYMPTOM and not a constant. Neither is restated from `CHANNEL`,
 * `APRON_LO`, `APRON_HI` or `SURF_LO`: a guard written in terms of the number it is guarding
 * passes by construction the moment someone edits that number, which is exactly how the apron
 * shipped flat for three passes with a docstring describing a gradient it was not drawing.
 */

/**
 * A pixel drawn from the `water` ramp: blue over green over red.
 *
 * This is a property of the palette rather than a probe tuned to today's tones, which is why the
 * guard can tell water from everything else sharing the tile without being told where the water
 * is. Every `water` stop satisfies it; `grass` and `shadow` have green over blue, and all four
 * `stone` stops -- so every value of `rockTone`, `keyline('stone', ...)` and any `mix` of them --
 * have red equal to green. So the set this picks out is exactly the river, the apron and the foam,
 * and never the lawn, the bank line, a boulder or its outline.
 */
const isWaterPixel = (c: RGBA): boolean => c[2] > c[1] && c[1] > c[0];

/**
 * The darkest water a shore tile is allowed to stop at.
 *
 * `shore()` paints an eleven-ring cross-section from `CHANNEL`, which runs from `t` 0.02 -- near
 * the bottom of the `water` ramp, luma 101 -- out to the open body. For three passes it was snapped
 * through the OPEN BODY's band, whose floor clamped the first six rings to one tone, and the
 * measured result was that no pixel of water anywhere in a shore tile went below luma 135.6: the
 * channel had no dark end, and a river with no dark end is a sticker lying on the lawn. The drawing
 * now bottoms out at 98.7. 115 sits between the two with room on both sides, and it is the number a
 * viewer would actually be reporting -- "the water never gets dark" -- rather than any constant
 * this file sets.
 */
const SHORE_DARK_FLOOR = 115;

/**
 * The longest run of one identical colour allowed down a shore tile's OUTER line.
 *
 * The outer line is the tile BOUNDARY, not a bank: the map lays `shore-w` down the left bank of the
 * river and open `water` to the right of it, so whatever is on column 31 abuts open river. The
 * shoreline distance field used to wrap on that axis, which put the foam rim one pixel from "land"
 * there and printed 226,249,252 thirty-two times -- a flat white rule at luma 243 against abutting
 * water at 53-88, drawn 51 times across the map, 44 of them on a vertical boundary, with nothing
 * continuing past it on the far side. One colour for the full height of the tile is the whole
 * signature of that fault, and no legitimate drawing has it: the open `water` tile's own longest
 * single-colour run is 10 along one axis and 11 along the other, and these four now run 3 to 5.
 * 12 is above anything the field itself produces and a long way under 32.
 */
const EDGE_FLAT_RUN_CAP = 12;

/** Index the outer line of a shore tile: the edge AWAY from its land, which is the river's side. */
const OUTER_LINE: Record<Side, (i: number) => [number, number]> = {
  w: (i) => [S - 1, i],
  e: (i) => [0, i],
  n: (i) => [i, S - 1],
  s: (i) => [i, 0],
};

/*
 * THE THIRD THING: THE SEAM WHERE A STRAIGHT BANK HANDS OVER TO THE OPEN RIVER.
 *
 * The client's "faint line" along every straight bank (2026-10-22) was a whole-line tone step across
 * that seam: the bank's outer line still in its apron, the `water` tile's first line in the open
 * body. Measured as the MEDIAN per-pixel luma step over the 32 pairs -- the median because a white
 * dash crossing the seam is the river's own texture and a few pixels of it must not count, while a
 * seam is the whole line -- HEAD (3c88684) stood at 22.6 on `shore-w`, 27.6 on `shore-e`, 6.1 on
 * `shore-n` and 10.8 on `shore-s`.
 *
 * THE BOUND IS THE OPEN WATER'S OWN. For each of `water` and `water-2`, laid as the map lays it
 * beyond the bank, the seam may be no larger than the largest median step between any two
 * neighbouring lines INSIDE that tile along the same axis -- 2.6 across columns and 3.7 to 4.8
 * across rows when this was written, against the hand-over's 2.2. That is "no more visible than any
 * other line of the river", read off the river and not off `HAND_EDGE` or `CHANNEL`, so editing the
 * hand-over cannot move the bound with it.
 */
const medianStep = (a: readonly RGBA[], b: readonly RGBA[]): number => {
  const d = a.map((c, i) => Math.abs(lumaOf(c) - lumaOf(b[i]!))).sort((p, q) => p - q);
  return (d[S / 2 - 1]! + d[S / 2]!) / 2;
};
const OPEN: Record<string, Img> = {};
for (const name of ['water', 'water-2']) {
  OPEN[name] = new Img(S, S);
  WATER_TILES[name]!(OPEN[name]);
}
/** Line `k` of a tile across axis `acrossX` (a column when true, a row when false). */
const lineOf = (img: Img, acrossX: boolean, k: number): RGBA[] =>
  Array.from({ length: S }, (_, i) => (acrossX ? img.get(k, i) : img.get(i, k)));

for (const side of ['n', 's', 'e', 'w'] as const) {
  const name = `shore-${side}`;
  const img = new Img(S, S);
  WATER_TILES[name]!(img);

  let darkest = Infinity;
  let at = '';
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = img.get(x, y);
      if (!isWaterPixel(c)) continue;
      const l = lumaOf(c);
      if (l < darkest) {
        darkest = l;
        at = `${x},${y}`;
      }
    }
  if (!(darkest < SHORE_DARK_FLOOR))
    throw new Error(
      `${name}'s darkest water pixel is luma ${darkest.toFixed(1)} at ${at}, not under ` +
        `${SHORE_DARK_FLOOR}. The shoreline cross-section has lost its dark end, so the channel ` +
        `reads as a flat cut-out against the lawn instead of as water with a near bank. The way ` +
        `this happened before was snapping CHANNEL through a band whose floor is above most of ` +
        `it: snap() clamps, so every ring under the floor collapses to one tone. Check that the ` +
        `apron is still snapped through APRON_LO/APRON_HI and not through the open body's band.`,
    );

  const line: RGBA[] = [];
  for (let i = 0; i < S; i++) {
    const [x, y] = OUTER_LINE[side](i);
    line.push(img.get(x, y));
  }
  let run = 1;
  let longest = 1;
  let colour = line[0]!;
  for (let i = 1; i < S; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    run = a[0] === b[0] && a[1] === b[1] && a[2] === b[2] ? run + 1 : 1;
    if (run > longest) {
      longest = run;
      colour = b;
    }
  }
  if (longest > EDGE_FLAT_RUN_CAP)
    throw new Error(
      `${name} paints ${longest} identical pixels (${colour[0]},${colour[1]},${colour[2]}, luma ` +
        `${lumaOf(colour).toFixed(0)}) in a row down its outer edge, over the ` +
        `${EDGE_FLAT_RUN_CAP} cap. That edge is the TILE BOUNDARY and not a bank -- open water ` +
        `abuts it -- so a flat line there is the map's grid drawn on the river. The way this ` +
        `happened before was the shoreline distance field wrapping on the across-bank axis, which ` +
        `made the far side of the tile read as one pixel from land and gave it the foam rim. ` +
        `Check the step() in shore(): it wraps along the bank only.`,
    );

  const acrossX = side === 'e' || side === 'w';
  // The bank's outer line, and the first line of open water beyond it: the far edge of the tile
  // the map lays next door, which for a west bank is that tile's column 0.
  const mine = line;
  const theirsAt = side === 'w' || side === 'n' ? 0 : S - 1;
  for (const [open, img2] of Object.entries(OPEN)) {
    let bound = 0;
    for (let k = 0; k < S; k++)
      bound = Math.max(
        bound,
        medianStep(lineOf(img2, acrossX, k), lineOf(img2, acrossX, (k + 1) % S)),
      );
    const seam = medianStep(mine, lineOf(img2, acrossX, theirsAt));
    if (seam > bound)
      throw new Error(
        `${name} meets ${open} with a median luma step of ${seam.toFixed(1)} across the seam, ` +
          `over the ${bound.toFixed(1)} that ${open} itself never exceeds between two of its own ` +
          `neighbouring lines. That is the faint line along the bank the client reported: the ` +
          `apron is still on its way to the open body when it reaches the tile edge. Check that ` +
          `apron() still hands over to bandAt() by distance to the outer edge (edgeHand).`,
      );
  }
}

/*
 * THE SEALED BANKS ARE THEIR BANKS ON EVERY EDGE, AND THEY ARE SEALED.
 *
 * A sealed bank is laid over its plain bank and meets that bank's neighbours, so the whole of its
 * job at a seam is to be the plain bank: all four edge lines are compared pixel for pixel. A stone
 * that reached an edge would be sawn off there -- the square-edged boulder the corner pass was
 * written to remove -- and this is where it would show.
 *
 * And it has to read as solid. A sealed bank stands on the border band over a bank the player can
 * see and cannot walk onto, so it may show no more open lawn -- the daylight band of the lawn,
 * green over red and blue and brighter than the shaded band at the waterline -- than the band's
 * own `rock` tile does round its boulder, read off `rock`'s painter. And wherever there is room for
 * a stone (every straight bank and every cove) it must have been given one: a sealed bank that is
 * its plain bank again is the fix quietly undone.
 */
const ROCK_COVER = new Img(S, S);
UNDERGROWTH_TILES['rock']!(ROCK_COVER);
const openLawn = (img: Img): number => {
  let n = 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = img.get(x, y);
      if (c[1] > c[0] && c[1] > c[2] && lumaOf(c) > 120) n++;
    }
  return n;
};
const ROCK_LAWN = openLawn(ROCK_COVER);
for (const [plain, sealed] of Object.entries(SEALED_BANK)) {
  const p = new Img(S, S);
  const q = new Img(S, S);
  WATER_TILES[plain]!(p);
  WATER_TILES[sealed]!(q);
  for (let i = 0; i < S; i++)
    for (const [x, y] of [
      [i, 0],
      [i, S - 1],
      [0, i],
      [S - 1, i],
    ] as const) {
      const a = p.get(x, y);
      const b = q.get(x, y);
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3])
        throw new Error(
          `${sealed} differs from ${plain} at its edge pixel ${x},${y}: a sealing stone has reached ` +
            `the tile edge, where the plain bank's neighbour will cut it off. sealStones() keeps a ` +
            `stone SEAL_RING pixels clear of every edge; check that bound against LUMP_PEAK.`,
        );
    }
  const stone = (img: Img): number => {
    let n = 0;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const c = img.get(x, y);
        if (Math.abs(c[0] - c[1]) < 3 && !isWaterPixel(c)) n++;
      }
    return n;
  };
  if (!plain.match(/^shore-(nw|ne|sw|se)$/) && !(stone(q) > stone(p)))
    throw new Error(
      `${sealed} carries no more stone than ${plain} (${stone(q)} pixels against ${stone(p)}). ` +
        `There is room for a stone on that bank's lawn and sealStones() has stopped finding it, ` +
        `which leaves the border band's bank exactly as it was. Check SEAL_WADE, SEAL_R_MIN and ` +
        `the centre mask.`,
    );
  if (openLawn(q) > ROCK_LAWN)
    throw new Error(
      `${sealed} shows ${openLawn(q)} pixels of open lawn, over the ${ROCK_LAWN} the band's own ` +
        `rock tile shows round its boulder. It is laid on the border band, which is solid, so ` +
        `lawn the player can see and cannot walk onto is an invisible wall; the band's cover was ` +
        `kept to prevent exactly that.`,
    );
}
