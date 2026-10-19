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
import { Img, keyline, shade, tone } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/** Terrain tiles are 32x32 (docs/PIXEL_STANDARD.md section 1). */
const S = 32;

export const WATER_TILE_SIZE = S;

const TAU = Math.PI * 2;

const wrap = (v: number): number => ((Math.round(v) % S) + S) % S;

/** Plot with both axes wrapped into the tile, so a feature that leaves one edge enters the other. */
const wpx = (img: Img, x: number, y: number, c: RGBA): void => img.px(wrap(x), wrap(y), c);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

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
 *   W_DEEP  L  99   the trough, and the shade a bank throws onto the water
 *   W_DARK  L 122   the body of the river -- a quarter of the board's surface is this
 *   W_BASE  L 151   the lit surface, and the board's single most common water value
 *   W_LIT   L 176   the top of a swell
 *   W_PALE  L 202   the step below white, which only the fall is bright enough to need
 *   W_FOAM  L 243   white, and an accent only: about one and a half per cent
 *
 * `W_LINE` is the dark water line the board draws at the foot of anything standing in the river.
 * The `water` ramp bottoms out at luma 99, far too light to read as a line against a 151 surface,
 * so this takes it down with the hue kept -- luma 59, which is the only thing in this file that
 * puts water pixels into the deep-shade and keyline bands at all.
 */
const W_DEEP = shade('water', 0);
const W_DARK = tone('water', 0.22);
const W_BASE = tone('water', 0.46);
const W_LIT = shade('water', 2);
const W_PALE = tone('water', 0.8);
const W_FOAM = shade('water', 3);
const W_LINE = keyline('water');

const SURFACE_PHASES: Phases = [0.7, 2.4, 1.1, 3.9];

/**
 * The surface, as BANDS cut out of the smooth field rather than as a gradient painted from it.
 *
 * This is the whole correction. `field` is unchanged and still wraps, still runs on diagonals, and
 * still has no term whose period fails to divide 32 -- it is a good field. What was wrong was
 * painting it continuously, which gave a photographic blur. Cutting it at four thresholds gives
 * large flat masses of one value meeting at a hard boundary, which is what the board's water is
 * and what pixel-art water has always been.
 *
 * The thresholds are the board's own band weights read back through the field's distribution.
 * `field` is roughly normal with a standard deviation near 0.37, so the cuts below put about 18
 * per cent of the tile in W_DEEP, 30 in W_DARK, 43 in W_BASE and 9 in W_LIT.
 *
 * Those are the board's water weights renormalised over its four water bands, and the DARK end is
 * the part that matters. The first quantised render used 15/24/45/16 and came back visibly too
 * pale, which is the same fault the airbrushed build had in a different form: the board's river is
 * a dark blue body with a lit surface on it, not a bright cyan with some shade. Ours was six times
 * too heavy in the 165-194 band, and at whole-map scale that is what made the river read as a
 * glowing ribbon through the forest rather than as water lying in a valley.
 *
 * Contour banding of a smooth field is a real risk here -- cut too finely it reads as an oil slick
 * or a topographic map. Four bands over a field whose slowest terms have a period of 32 gives
 * masses eight to sixteen pixels across, which is the scale of the board's own tonal patches.
 */
const BANDS: readonly (readonly [number, RGBA])[] = [
  [-0.337, W_DEEP],
  [-0.018, W_DARK],
  [0.62, W_BASE],
  [Infinity, W_LIT],
];

const bandAt = (x: number, y: number): RGBA => {
  const f = field(x, y, SURFACE_PHASES);
  for (const [limit, c] of BANDS) if (f < limit) return c;
  return W_BASE;
};

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
];

const RIPPLES_B: readonly Ripple[] = [
  [22, 8, 3],
  [2, 12, 3],
  [14, 18, 2],
  [27, 21, 4],
  [9, 25, 3],
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

type Side = 'n' | 's' | 'e' | 'w';

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

const mix = (a: RGBA, b: RGBA, k: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
  255,
];

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
 */
const FOAM_PHASES: Phases = [3.6, 1.2, 2.9, 0.5];
const APRON: readonly RGBA[] = [W_FOAM, W_LIT, W_LIT, W_DARK, W_DARK];

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

    const dist = new Int8Array(S * S).fill(-1);
    let front: [number, number][] = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) if (solid[y * S + x] === 1) front.push([x, y]);
    for (let d = 1; d <= APRON.length && front.length; d++) {
      const next: [number, number][] = [];
      for (const [x, y] of front)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = wrap(x + dx);
          const ny = wrap(y + dy);
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
        if (d === 1) {
          const surf = Math.sin((TAU * bt) / 8 + 1.3) + 0.6 * Math.sin((TAU * bt) / 16 + 0.4) > 0.2;
          img.px(x, y, surf ? W_FOAM : W_LINE);
          continue;
        }
        // The lit shallows lose their outer pixel wherever the field is high, and the shadow band
        // stops short wherever the bank is low, so neither runs as an even stripe down a column of
        // identical tiles.
        if (d === 3 && field(x, y, FOAM_PHASES) > 0.25) continue;
        if (d >= 4 && field(x, y, LAND_PHASES) > 0.1) continue;
        img.px(x, y, APRON[d - 1]!);
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
  const rope = 0.18 * Math.sin(a) + 0.34 * Math.sin(b) + 0.46 * Math.cos(c) + 0.02 * Math.sin(d);
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
 * The sheet's six values and where `fallTone` is cut to get them.
 *
 * The board's fall is 21 per cent pure white, 10 per cent pale, 12 per cent lit, 39 per cent body,
 * 16 per cent channel and 2 per cent deep -- and nothing at all under luma 81, because a waterfall
 * is a bright object whose darkness is channels rather than shadow. The pass this replaces painted
 * `fallTone` continuously, which produced a luma spread of 26 against the board's 48 and almost no
 * white: a slightly lighter band of the same slab, exactly as the review described it.
 *
 * These cuts reproduce that histogram band for band. They also do most of the work on the three
 * axes the fall was failing, because the quantising is what creates edges at all: six flat values
 * across a sheet of vertical ropes gives a hard boundary at every rope flank.
 */
const FALL_BANDS: readonly (readonly [number, RGBA])[] = [
  [0.1, W_DEEP],
  [0.23, W_DARK],
  [0.52, W_BASE],
  [0.585, W_LIT],
  [0.66, W_PALE],
  [Infinity, W_FOAM],
];

/**
 * Spray: short horizontal white marks, and the one place this file bends constraint C.
 *
 * Nothing with a vertical period can read as water breaking, and the board's fall is covered in
 * short horizontal white strokes. A feature that spans the tile would repeat four times down the
 * stack as a rung, which is why the previous build banned horizontal marks outright and ended up
 * with vertical wallpaper. A THREE-pixel mark is not a rung: it repeats as texture, the way the
 * white dashes on the open river do, and at four scattered heights the eye reads spray rather than
 * a grid. The real fix is still a lip tile and a foot tile the map does not have; this is the best
 * that one repeated image can do, and it is noted with the other two map gaps below.
 */
const SPRAY: readonly Ripple[] = [
  [4, 5, 3],
  [21, 11, 3],
  [12, 19, 4],
  [26, 26, 3],
];

function waterfall(img: Img): void {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = fallTone(x, y);
      let c = W_FOAM;
      for (const [limit, band] of FALL_BANDS)
        if (v < limit) {
          c = band;
          break;
        }
      img.px(x, y, c);
    }

  // Spray only where the sheet is already bright, so a mark never lands in a dark channel and
  // breaks the rope structure the fall is read by.
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
