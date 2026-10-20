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
import { clamp01, Img, keyline, lumaOf, mix, shade, TILE, tone } from '../paint.ts';
import type { RGBA, Side } from '../paint.ts';

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

function shore(side: Side): (img: Img) => void {
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
     * The boulder band, composed on one scratch image and keylined there (section 3.4). Back row
     * first so the front row overlaps it, and the keyline goes on last so it rings the pile and
     * not the seams.
     */
    const pile = new Img(S, S);
    for (const rock of BACK) layRock(pile, side, rock);
    for (const rock of FRONT) layRock(pile, side, rock);
    ringPile(pile, ROCK_LINE);
    img.blit(pile, 0, 0);

    const solid = new Uint8Array(S * S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        solid[y * S + x] = isLand(side, x, y) || pile.get(x, y)[3] > 0 ? 1 : 0;

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

    const dist = new Int8Array(S * S).fill(-1);
    let front: [number, number][] = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) if (solid[y * S + x] === 1) front.push([x, y]);
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
          const i = ny * S + nx;
          if (solid[i] === 1 || dist[i] !== -1) continue;
          dist[i] = d;
          next.push([nx, ny]);
        }
      front = next;
    }
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
         * the board's dark band is wider under an overhang and narrower off a shallow spit.
         */
        const k = Math.min(CHANNEL.length - 1, d - 2);
        img.px(
          x,
          y,
          snap(APRON_LO, APRON_HI, APRON_STEPS, CHANNEL[k]! + 0.05 * field(x, y, FOAM_PHASES)),
        );
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
};

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
}
