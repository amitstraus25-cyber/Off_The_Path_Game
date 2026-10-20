/*
 * The two pieces of outdoor joinery: Grandma's garden fence and the river crossing.
 *
 * Drawn against `reference/mocks/gameplay-concepts.png`, crops `1178 470 165 70` for the picket run
 * and `345 600 215 160` for the bridge. Sizes are board pixels divided by 2.21, the board-to-our-
 * pixel ratio docs/ART_DIRECTION.md section 2 anchors on Red.
 *
 * REDRAWN 2026-10-19 AGAINST THE BOARD RESAMPLED TO OUR OWN RESOLUTION, which is the thing that
 * changed and the reason this pass could see what the last two could not. Every earlier version was
 * fitted to quartiles probed off the board at its native 2.21x, where a conceptual 1px keyline is
 * smeared over five interpolated pixels and a flat plank face is smeared into a gradient. Taking
 * the same two crops NEAREST-downsampled to 1:1 shows the drawing the board is actually made of:
 *
 *     axis                         board @1x   this file, before      after
 *     deep shade (% under luma 81)     42.73          38.14         42.17
 *     keyline    (% under luma 60)     26.01          23.28         24.75
 *     luma spread (stdev)              45.26          45.34         51.66
 *     edge density (%)                 17.87          14.01         22.32
 *
 * Measured on the five tiles ALONE, composed as `forest-map.ts` lays them and masked to their wood,
 * against the board's own crossing masked the same way. The whole-frame `pnpm score` cannot see
 * this file: these five tiles are about three per cent of a camera, and the grass, water and trees
 * around them belong to other painters and move between renders. The frame number moved 0.278 to
 * 0.326 across this session while this file's own bridge improved, and almost none of either was
 * this file.
 *
 * WHAT THIS PASS DID NOT DO, because the previous one already had: convert the file to `tone()`
 * and `keyline()`. Counted, the five tiles carried 312 distinct colours before and 310 after. The
 * 24-colour four-flat-step version is two rounds back, and anyone reading this for the tone()
 * conversion should look at that commit, not this one. What was still wrong was STRUCTURE.
 *
 * The bridge was short of dark, not short of detail, and the shape of the shortfall is specific:
 *
 *   THE BOARD'S PLANKS ARE FLAT, NOT ROUND. A deck plank is a sawn board seen from above. The board
 *   draws it as a 2px lit edge, a long face that moves about 10 luma across its whole width, and a
 *   2px dark edge into the seam. This file drew a continuous 127-luma sweep from 189 down to 62
 *   across every plank -- a barrel, not a board -- and ten barrels in a row with dark gaps between
 *   them is a ladder. That one profile is most of why the render reads as rungs. `tone()` is the
 *   right tool for a thing that should look round; a deck is not one, and the fix is to spend the
 *   tonal range on the RAILS and the POSTS, which are round, and to flatten the deck.
 *
 *   THE POSTS DID NOT STAND CLEAR. On the board the four corner posts are heavier than the rails,
 *   taller than them, lighter than the deck, and ringed in near-black on all four sides. Here they
 *   were the same height as the rail band, the same value as the deck, and keylined only outboard,
 *   so the rail ran straight through them and the corners vanished. They are 14 and 15 columns wide
 *   now, they project six rows past the rail into the deck, and they carry a lit end-grain cap.
 *
 *   THERE WAS NO GAP UNDER THE RAIL. The board puts 5 board pixels of luma 22 to 54 between the
 *   underside of a rail and the start of the deck -- that shadow is what lifts a handrail off the
 *   planking. This file had one pixel of luma 32. It is two pixels of near-black now, at both ends
 *   of every tile, which also gives the centre beam a real joint instead of a seam.
 *
 * The same resample settled the fence. The board's rail between two pickets is a ONE-PIXEL LIT TOP
 * EDGE over three pixels of near-black: a rail is dark, and the bright line along its top is the
 * whole of how you read it as passing behind. This file drew both rails as five rows falling 139 to
 * 77 -- a pale band, brighter on average than the gap it was meant to be receding into -- so the
 * pickets had nothing to stand in front of.
 *
 * THE WOOD IS STILL CONTINUOUS. `timber()` is unchanged; what changed is where its range is spent.
 *
 * ONE AXIS IS WORSE AND IS LEFT WORSE ON PURPOSE. Luma spread went from a dead match at 45.34 to
 * 51.66, and the fence's from 45.39 to 54.92. Both come from `WOOD_BLACK`: a keyline at luma 7
 * sitting beside a lit face at 189 is a wider range than one at luma 32. The board's own crossing
 * carries a silhouette at luma 2 and its pickets keyline at 10 to 26, so the near-black is right
 * and the spread is the price of it. Edge density is 25 per cent over the board for the same
 * reason, and that axis is the one most distorted by nearest-sampling an upscaled mock. Neither is
 * worth softening a keyline for.
 *
 * ONE LIGHT, FROM THE TOP-LEFT. Lit faces are up and left, shade is down and right, and the
 * keyline thickens to 2px on the bottom and lower-right (section 3.2) because that is what seats a
 * thing on the ground. It is never thickened on a top or left edge.
 *
 * Both painters also have to survive how `forest-map.ts` actually lays them, which constrains them
 * more than the board does. See the notes on each.
 */
import { Img, keyline, TILE, tone, type RGBA } from '../paint.ts';
import type { Painter } from '../paint.ts';

/* ---------------------------------------------------------------- the wood */

/*
 * THE FOUR DARK VALUES, all of them the wood's own hue.
 *
 * Measured off the board at 1:1: the bridge's outer silhouette and the shadow under a rail bottom
 * out at luma 2 to 14, the fence keyline runs 16 to 35, and the seam between two deck planks runs
 * 37 to 50. Four jobs, four drops, one ramp -- so nothing in this file is outlined in a colour that
 * is not a darker version of itself.
 *
 * `WOOD_BLACK` is new and it is the correction the resampled crops forced. The previous darkest was
 * `WOOD_DEEP` at luma 16, which `keyline`'s own `minLuma` floor would not let past; passing a lower
 * floor reaches luma 7, which is where the board's silhouette actually sits. A near-black ring is
 * the single device that makes the board read as one illustrated world, and at luma 16 we were
 * drawing it in dark brown.
 */
const WOOD_BLACK = keyline('wood', 70, 255, 4); // luma 7: silhouettes, and under every rail
const WOOD_DEEP = keyline('wood', 60); // luma 16: deep joints and ground contact
const WOOD_LINE = keyline('wood', 44); // luma 32: ordinary edges, and the rails' dark bands
const WOOD_SEAM = keyline('wood', 34); // luma 42: two boards of the same timber meeting

/**
 * Wood as one continuous surface: `t` 0 is the damp foot of a picket, 1 is end grain in full sun.
 *
 * It crosses two ramps at the halfway point, and that is the whole trick. `wood` alone bottoms out
 * at luma 76, which is nowhere near the board's shaded timber, and extending it downward would
 * have meant a fifth palette stop. `trunk` already sits exactly below it -- its lightest is luma
 * 132 and `wood`'s midpoint is 132.5 -- so the two ramps stack into one unbroken climb from 58 to
 * 189 with no step at the join.
 *
 * The second gain is chromatic. Shaded wood on the board is not merely a darker version of lit
 * wood, it is REDDER, and `trunk` is redder than `wood`. So a picket's shaded side genuinely
 * changes hue as it turns away, the way the board's does, and the file draws on two ramps' worth of
 * distinct values rather than one ramp's four.
 */
const timber = (t: number): RGBA => (t < 0.5 ? tone('trunk', t * 2) : tone('wood', t));

/*
 * Grass in deep shade, for the tufts that break the fence's base line and for contact shadows.
 * The board's tufts at the foot of a picket sample `#176f54` at luma 82 -- a deep teal-green,
 * nothing like the open lawn at luma 182 -- so they come off `shadow`, whose whole span (33 to 81)
 * sits inside the score's deep-shade band.
 */
const turf = (t: number): RGBA => tone('shadow', t);

/*
 * A row or column is either a point on the timber ramp or one of the four dark values. Writing the
 * dark ones inline rather than as `null` is what lets a single table say "lit edge, dark body,
 * black gap" in the order the board draws it, which is how every band in this file is now spelled.
 */
type Step = number | RGBA;
const stepColour = (s: Step): RGBA => (typeof s === 'number' ? timber(s) : s);

/* -------------------------------------------------------------------- fence */

/*
 * THE PICKET RUN, east-west.
 *
 * Measured off the board: pickets 41 board pixels apart, 21 across, two rails behind them. Divided
 * by 2.21 that is an 18.6px pitch and a 9.5px picket, and 18.6 does not divide 32. The pitch
 * therefore snaps to 16 -- two pickets a tile, which is also what ART_DIRECTION section 9.2
 * specifies -- and the run tiles against itself with no seam. That makes our fence about a sixth
 * denser than the board's; 32 would be far too sparse and there is nothing between the two. Flagged.
 *
 * THE TUFTS ARE NOT DECORATION. Section 9.2 calls them out and the board is emphatic: dark grass
 * grows in front of the bottom of every picket and breaks the line where the wood meets the
 * ground. Without them a fence drawn on transparency sits on the lawn like a sticker, because its
 * base is a straight horizontal edge and nothing else in a forest has one.
 *
 * THIS PASS DID NOT RESIZE THE PICKET, and that is a finding rather than an omission. Resampling the
 * board's own run to our resolution gives a picket 11 of our pixels wide including keylines on a
 * pitch of 21, which is 52 per cent wood. Ours is 9 on a pitch of 16, which is 56 per cent. The
 * proportion is already the board's; only the pitch is compressed, and that was forced by 32.
 */
const PICKET_PITCH = 16;
const PICKET_W = 9; // keyline, 7 of wood, keyline
const PICKET_BASE = 27; // last row of wood; the 2px ground keyline follows it

/*
 * The picket's tone down its length, as a `timber` t, read straight off the board.
 *
 * IT IS A TABLE AND NOT A CURVE NOW, and that is this run's correction. The previous version was
 * three line segments fitted to the quartiles of a probe -- a narrow cap, a fast turn, then a long
 * continuous fade from t 0.44 at the shoulder to t 0.08 at the ground. A continuously graded
 * vertical object is a DOWEL, and nineteen of the picket's twenty-eight rows were on that fade,
 * which is why the run reads as a row of sausages in the composed render.
 *
 * Resampling the board's own picket to our resolution (tools read it as a 14x30 grid of luma, then
 * inverted through `timber`) gives something quite different and much simpler:
 *
 *     board row   3  4  5  6  7  8 |  9 | 10 ...  23 | 24 ...  28 | 29
 *     luma      189 190 191 199 200 177 | 124 | 121 ... 117 |  96 ...  79 | 56
 *
 * -- SIX rows of cap sitting flat at the top of the ramp, one step row, FOURTEEN rows of body
 * sitting flat around t 0.42, and only then a five-row fall into the grass shade. A bright flat cap
 * on a flat body, with one hard step between them, is what makes the board's picket read as a
 * capped post rather than as a turned spindle. The fade is the last fifth of the picket, not
 * two thirds of it.
 */
const PICKET_ALONG: readonly number[] = [
  1.0, // 0   the cap: six rows, flat, at the top of the ramp
  1.0, // 1
  1.0, // 2
  1.0, // 3
  1.0, // 4
  0.95, // 5   the cap's own last row, a shade off the others, as the board's is
  0.52, // 6   ONE step row. The whole of the turn from cap to body happens here.
  0.44, // 7   the body: fourteen rows, flat
  0.43, // 8
  0.43,
  0.42,
  0.42,
  0.43,
  0.43,
  0.42,
  0.42,
  0.41,
  0.41,
  0.4,
  0.39,
  0.38, // 20
  0.34, // 21  and only now the fall, over the last seven rows
  0.31,
  0.28,
  0.25,
  0.22,
  0.19,
  0.16, // 27  PICKET_BASE: the damp foot, luma 79, where the board puts it
];
const picketT = (y: number): number => PICKET_ALONG[Math.min(y, PICKET_BASE)]!;

/*
 * And across it, as offsets from the body tone.
 *
 * The board's picket is not a cylinder. It is a sawn board turned a few degrees -- but it is not a
 * smooth ramp either, and the previous profile here fell monotonically from +0.20 to -0.26, which
 * at the new flat body tone comes out 141, 146, 139, 128, 108, 93, 79. The board's own body row,
 * resampled, is 143, 142, 116, 118, 122, 115, 94: TWO columns of lit edge, a hard 28-luma TURN, a
 * flat face of four, and one dark column into the keyline.
 *
 * So the turn the previous note was after is real and it is sharper than it was drawn: it happens
 * between columns 1 and 2 in a single step, rather than being spread over the whole face. A face
 * that keeps one value after the turn is a sawn board; a face that keeps falling is a dowel.
 *
 * The far column bottoms out at luma 94 rather than the 79 the old ramp reached. 79 is near the
 * deep-shade threshold, and a whole column of every picket sitting there took the run too dark: the
 * board's picket has no column of shadow down its side, only timber turned away from the light.
 */
const PICKET_ACROSS = [0.18, 0.16, -0.05, -0.02, 0.01, -0.04, -0.17];

/*
 * The two rails, drawn before the pickets so the pickets stand in front of them.
 *
 * THE PREVIOUS PASS REVERSED THESE AND OVERSHOT, and this one is measured rather than reasoned. Its
 * note says the board's rail is "one pixel of luma ~170 over three of luma 60 to 90" and it drew
 * the bodies at t 0.21 to 0.40, luma 85 to 117. That reading was taken in the gap immediately
 * beside a picket, which is inside the picket's own cast shadow. Sampling the MIDDLE of a gap, clear
 * of it, the board says something else entirely:
 *
 *     row   8 |  9  10  11 | 12  13  14  15 | 16  17  18 | 19  20  21  22 | 23  24  25  26
 *     luma 142 | 49  16  53 |156 144 134 101 | 53  25  60 |156 171 132  91 | 63  24  40  62
 *
 * So a rail is NOT a dark object. Its body is luma 134 to 156, which is BRIGHTER than the picket
 * body at 117, and the lower rail is brighter again -- it crowns at 171, because the near rail's top
 * face is the one turned towards a camera looking down from the front. What makes a picket stand in
 * front of it is not that the rail is darker. It is the THREE DARK ROWS above, between and below the
 * rails: nine of the band's eighteen rows are dark, and that is the whole device.
 *
 * ONLY THE MIDDLE ROW OF EACH DARK BAND IS NEAR-BLACK. A first version of this band drew all nine at
 * `WOOD_LINE` and `WOOD_BLACK`, luma 32 and 7, and the composed run came out as a ladder lying behind
 * the pickets -- three black bars with wood between them. The board's three bands read 49/16/53,
 * 53/25/60 and 63/24/40/62: a near-black core with a shoulder either side at luma 50 to 60, which is
 * `timber(0)` at 58. The bands are the same depth; it is the shoulders that stop them being bars.
 *
 * The previous note argues against exactly this, on the grounds that a full-width dark row costs
 * about five points of "% under luma 60" and that four of them measured 38.2 against the board's
 * 23.8. The arithmetic is right and the conclusion does not follow: the board's own gap carries
 * those rows, so matching it cannot overshoot it. Measured the same way on the same region -- three
 * pickets and the rails between them, masked to the warm pixels in both images -- the run as drawn
 * here comes out at 30.0 per cent under luma 60 against the board's 29.1, and 36.7 under 81 against
 * 39.6, with the mean at 95 against 94. The board's figure was never 23.8 for this region.
 *
 * Both rails span the full tile width so the run is seamless left to right, and neither carries a
 * keyline at its ends: section 3.3, two surfaces of the same material that meet get no line, and a
 * rail meeting the next tile's rail is the same rail.
 *
 * The band starts at row 6, immediately under the picket's six-row cap, because that is where the
 * board starts it -- there is no stretch of picket body above the top rail in the gaps, only on the
 * pickets themselves.
 */
const RAIL_ROWS: readonly Step[] = [
  0.0, // 6   three dark rows above the upper rail, not one -- but only the middle one is near-black
  WOOD_DEEP, // 7
  0.0, // 8
  0.72, // 9   the upper rail's lit top edge
  0.6, // 10  and its body, which is brighter than the picket in front of it
  0.51, // 11
  0.29, // 12  the underside
  0.0, // 13  three more between the rails
  WOOD_DEEP, // 14
  0.0, // 15
  0.72, // 16  the lower rail: lit top
  0.84, // 17  and a brighter crown -- its top face is the one turned towards the camera
  0.5, // 18
  0.22, // 19
  0.03, // 20
  WOOD_DEEP, // 21  and three below, which seat the whole run
  0.0, // 22
  0.02, // 23
];
const RAIL_TOP = 6;

function rails(img: Img): void {
  RAIL_ROWS.forEach((s, i) => img.rect(0, RAIL_TOP + i, TILE, 1, stepColour(s)));
}

/**
 * One picket: 9 across including its keylines, domed, lit across the top six rows.
 *
 * The head is the whole point of the silhouette. On the board the top 14 board pixels of a picket
 * sit at luma 186 to 201 and then the body drops to 110 and darkens toward the ground. Squaring
 * that head off, as a previous painter did, loses the one piece of shape a 9px-wide object has.
 *
 * The keylines are `WOOD_BLACK` rather than `WOOD_LINE` now. At 1:1 the board rings every picket in
 * something very close to black; at luma 32 we were ringing them in dark brown, which against a
 * dark rail is no edge at all, and the pickets had nothing to separate them from what is behind.
 */
function picket(img: Img, x0: number): void {
  for (let y = 0; y <= PICKET_BASE; y++) {
    // The dome: two rows of inset, which is all the board uses and all 7px of wood can carry.
    const ins = y === 0 ? 2 : y === 1 ? 1 : 0;
    const t = picketT(y);
    img.px(x0 + ins, y, WOOD_BLACK);
    img.px(x0 + PICKET_W - 1 - ins, y, WOOD_BLACK);
    for (let i = ins; i < 7 - ins; i++) img.px(x0 + 1 + i, y, timber(t + PICKET_ACROSS[i]!));
  }

  /*
   * Grain. Three short marks, each a sixth of a step darker than the face it sits on rather than a
   * drawn line -- the board's grain is a change in the wood, not a scratch on it, and a hard dark
   * mark on a 7px face is a crack.
   */
  const mark = (x: number, y: number, h: number): void => {
    for (let j = 0; j < h; j++)
      img.px(x0 + x, y + j, timber(picketT(y + j) + PICKET_ACROSS[x - 1]! - 0.15));
  };
  mark(2, 9, 2);
  mark(5, 17, 3);
  mark(3, 23, 2);

  // 2px ground keyline, near-black: section 3.2's thickening on the side the light does not reach.
  img.rect(x0, PICKET_BASE + 1, PICKET_W, 1, WOOD_BLACK);
  img.rect(x0, PICKET_BASE + 2, PICKET_W, 1, WOOD_DEEP);
}

/**
 * A sprig of three blades. Small -- 5 across, 4 tall -- because its job is to break one picket's
 * base line, not to be noticed. Drawn last, over the wood, so it genuinely overlaps.
 */
function tuft(img: Img, x: number, y: number): void {
  img.rect(x + 1, y + 3, 3, 1, turf(0.04));
  img.px(x, y + 2, turf(0.14));
  img.rect(x + 1, y + 2, 3, 1, turf(0.26));
  img.px(x + 4, y + 2, turf(0.18));
  img.px(x, y + 1, turf(0.44));
  img.px(x + 1, y + 1, turf(0.34));
  img.px(x + 3, y + 1, turf(0.52));
  img.px(x + 2, y + 1, turf(0.62));
  img.px(x + 2, y, turf(0.74));
}

const fenceRail: Painter = (img) => {
  rails(img);

  for (const x of [0, PICKET_PITCH]) {
    // Contact shadow first, under the picket: section 4, a flattened ellipse in the ground's own
    // dark, offset down and right. Opaque, never translucent black.
    img.ellipse(x + 5, PICKET_BASE + 4, 6, 1.6, turf(0.08));
  }
  for (const x of [0, PICKET_PITCH]) picket(img, x);

  // Grass at the foot of the run. Five sprigs, not a hedge: the board leaves gaps between them,
  // and a continuous green fringe is just a second straight line under the first one. Two of these
  // wrap, so the sprig at x = -2 continues out of the tile to the left.
  tuft(img, -2, 26);
  tuft(img, 3, 27);
  tuft(img, 13, 25);
  tuft(img, 18, 27);
  tuft(img, 29, 26);
};

/*
 * THE RUN SEEN FROM ABOVE, north-south: A CHANNEL OF POST TOPS, FORESHORTENED.
 *
 * This is the client's own complaint -- "the fence is nice, but from the top view, in the front, it
 * looks weird" -- and the sixth version of this tile. The history is kept because the evidence that
 * killed each one is worth more than the code that replaced it, and because this version revisits a
 * shape a previous one rejected. It does not revisit it on taste.
 *
 * VERSIONS ONE TO FOUR: A CONTINUOUS CHANNEL with a rhythm of pale caps standing in it. Rejected as
 * a ROPE: the caps were a four-pixel lozenge at `timber` 0.34 to 0.43 inside a ten-column brown
 * band, so the band was the object and the caps were texture on it.
 *
 * VERSION FIVE: SEPARATE POSTS WITH LAWN BETWEEN THEM, two to a tile on the picket run's own
 * 16-pixel pitch, twelve rows of post and four of nothing, joined by a four-column rail. The
 * reasoning was that a fence reads as a fence because you can see between its posts, which is true.
 * Rendered into the arrival frame at 2x and cropped out as a column (`before-fencecol`), it reads as
 * a CHAIN -- identical links on a cord, or a strip of film. Three numbers say why, measured on four
 * stacked tiles against the board's own north-south run (board `1176 376 40 110`, masked to its
 * warm pixels, both scanned row by row for the brightest wood pixel in the run):
 *
 *     axis                                     version five   the board (in our px)
 *     narrowest point of the silhouette             5 px            10.4 px
 *     darkest scanline's brightest wood pixel      luma 7          luma 98
 *     share of scanlines reading as CAP             0.250           0.359
 *
 * The first two are the chain. Our run drops to five columns in the gaps, half its own width, and it
 * lays a full-width near-black bar across itself twice per post -- so every sixteen rows the object
 * vanishes and comes back. The board's never narrows below eighty per cent of its width and never
 * goes black across itself at all: between two of its caps the wood is luma 121 to 150, which is
 * SHADED TIMBER, not a gap.
 *
 * SO THE CHANNEL IS RIGHT AND THE OLD CHANNEL'S RATIO WAS WRONG. Scanned at the board's own
 * resolution down `1176 376 40 116`, one period runs:
 *
 *     ourY   0.0  1.4  2.7  4.1  5.4  6.8  8.1  9.5 (the next cap's lit top)
 *     luma   218  197  190  184  171  155  121  209
 *
 * -- a 9.0px period, a HARD RISE into each cap's lit top in a single pixel, then a gradual fall of
 * about 90 luma across the rest of it. That sawtooth is the whole drawing: a domed top with its own
 * near face under it, repeated, seen down the line. The pitch is 8 rather than 9 because 8 divides
 * 32 and 9 does not, and foreshortening is why it is half the picket run's 16: a fence seen along
 * its length shows its posts compressed, and the board's own ratio of cap period to picket pitch is
 * 9.0 to 21, which is 0.43.
 *
 * THE PITCH IS NOT "THE SAME FENCE SO THE SAME PITCH". That was version five's reasoning and it is
 * the one piece of it that was simply a mistake.
 *
 * AND IT IS NO LONGER MIRRORED. `forest-map.ts` took `fence-post` out of its `SIDEWAYS` set in the
 * same change, which is what lets this tile have a real light direction: the board's channel is a
 * face of nine columns with TWO COLUMNS OF SHADED TIMBER down its far side and a cast shadow on the
 * lawn beyond that, all on the same side for the whole run. Under a horizontal flip that shaded side
 * alternates every other tile and the run zigzags, which is exactly why version five's across-
 * profile was flat to within 14 luma. The caps carry the variation instead, four to a tile.
 *
 * TWO THINGS TRIED AND REJECTED, recorded so they are not tried again. SHEARING the head to make the
 * joint diagonal: it renders as a BARBER POLE. A NEAR-BLACK RING under each cap inside the channel:
 * a LADDER. Both are the same mistake, and so was the 16-pitch chain -- all three break the run into
 * pieces, where what it needs is to stay one object whose brightness pulses.
 */

/*
 * THE CHANNEL. Thirteen columns, which is `fenceCorner`'s own wood span (9 to 21) exactly, so the
 * run and the post it dies into are flush on both sides instead of stepping in by two.
 *
 *     x 9        near-black keyline
 *     x 10..18   the post face, nine columns, lit from the upper left
 *     x 19..20   the shaded far side of the run
 *     x 21       near-black keyline
 *     x 22       the run's cast shadow on the lawn, in the ground's own dark
 *
 * The board's own section, sampled across at `1176..1214` and divided by 2.21: 1 column of keyline,
 * 7.2 of face, 2.7 of fall, 1.8 of keyline -- 12.7 in all.
 */
const RUN_X = 9;
const RUN_FACE = 10; // first column of the nine-column face
const RUN_FACE_W = 9;
const RUN_SHADE_X = 19; // the two columns of shaded timber down the far side
const RUN_EDGE = 21; // the far keyline
const RUN_PITCH = 8; // four caps a tile; the board's period is 9.0 of our pixels

/*
 * ONE CAP, down its length, as a `timber` t. A sawtooth, not a curve: the rise into row 0 is the
 * whole of what reads as a separate post top, and it must stay in one row.
 */
const CAP_ALONG: readonly number[] = [
  1.0, // 0  the lit top of the cap -- the board's 218 after a 121
  0.88, // 1  it falls fast out of the top row and then slowly, which is the board's own shape
  0.83, // 2
  0.8, // 3
  0.74, // 4  and away into the near face of the post under it
  0.65, // 5
  0.52, // 6
  0.34, // 7  the trough, which is shaded timber and never a gap
];

/*
 * And across the nine columns of face, as offsets from the row tone. A crown left of centre falling
 * away to the right, 0.24 of a step end to end, which is the board's own 197-to-167 across its face.
 * It can be this strong because nothing flips the tile any more.
 */
const RUN_ACROSS: readonly number[] = [-0.1, 0.02, 0.02, 0.0, -0.04, -0.07, -0.1, -0.13, -0.17];

/**
 * The cap's silhouette: how many columns of the face are given up to the dark at each end, row by
 * row. A flat lit top on angled shoulders, full width through the middle, and a two-column pinch
 * where one cap meets the next -- the board's rounded hexagon, at nine columns.
 */
const CAP_INSET: readonly number[] = [2, 1, 0, 0, 0, 0, 1, 2];

/*
 * FOUR CAPS IN A TILE, because a 32px tile at an 8px pitch holds four and the run must not print the
 * same post every eight rows. `gain` takes one a few luma below its neighbour, `grainCol` moves its
 * one grain mark across the face, and `sprig` says whether grass breaks the channel's edge beside
 * it. The run's repeat is therefore the tile, 32px, the same as the picket run's.
 */
interface Head {
  readonly gain: number;
  readonly grainCol: number;
  readonly sprig: 'none' | 'left' | 'right';
}
const RUN_HEAD: readonly Head[] = [
  { gain: 1.0, grainCol: 3, sprig: 'none' },
  { gain: 0.95, grainCol: 6, sprig: 'right' },
  { gain: 0.98, grainCol: 2, sprig: 'none' },
  { gain: 0.93, grainCol: 5, sprig: 'left' },
];

/** One cap and the eight rows of post under it, inside the channel, at `top`. */
function runCap(img: Img, top: number, head: Head): void {
  for (let r = 0; r < RUN_PITCH; r++) {
    const y = top + r;
    if (y < 0 || y >= TILE) continue;
    const t = CAP_ALONG[r]! * head.gain;

    img.px(RUN_X, y, WOOD_BLACK);
    img.px(RUN_EDGE, y, WOOD_BLACK);
    /*
     * The face, and its OUTLINE is as much of the drawing as its tone.
     *
     * A first version of this pitch drew the face full width on every row but the top, and rendered
     * as a PLANK WITH RUNGS -- one long board with evenly spaced dark lines ruled across it. The
     * board's caps are not a tone on a band, they are SHAPES: crop `1172 370 48 180 8` and each one
     * is a rounded hexagon, flat across its lit top, widening through angled shoulders to the full
     * channel in its middle, then narrowing again into a dark V where it meets the next. That
     * pinch, twice a cap, is what the eye counts. `CAP_INSET` is it.
     */
    const ins = CAP_INSET[r]!;
    for (let i = 0; i < RUN_FACE_W; i++) {
      const x = RUN_FACE + i;
      if (i < ins || i >= RUN_FACE_W - ins) {
        // The corner between two caps: the deepest timber in the run, and never a gap.
        img.px(x, y, timber(0.1));
        continue;
      }
      img.px(x, y, timber(Math.max(t + RUN_ACROSS[i]!, 0.04)));
    }
    // The far side, turned away: two columns that never reach the face's value.
    img.px(RUN_SHADE_X, y, timber(Math.max(t - 0.34, 0.04)));
    img.px(RUN_SHADE_X + 1, y, timber(Math.max(t - 0.46, 0.04)));
  }

  /*
   * Grain: one mark down the lit face, a sixth of a step darker than the face it sits on -- which is
   * where `fenceCorner` and `picket` put theirs, and for the same reason. It runs the cap's lower
   * rows only, where the face is turning, because a dark mark on the one bright row is a chip.
   */
  for (let r = 2; r <= 6; r++) {
    const y = top + r;
    if (y < 0 || y >= TILE) continue;
    img.px(
      RUN_FACE + head.grainCol,
      y,
      timber(Math.max(CAP_ALONG[r]! * head.gain + RUN_ACROSS[head.grainCol]! - 0.15, 0.04)),
    );
  }
}

/**
 * The run's cast shadow: one column of the ground's own dark, down the whole tile, outside the far
 * keyline. A fence standing in sunlight throws a line, not a halo, and with the mirror gone it can
 * stay on the one side for the length of the run.
 */
function runShadow(img: Img): void {
  for (let y = 0; y < TILE; y++) img.px(RUN_EDGE + 1, y, turf(0.1));
}

const fencePost: Painter = (img) => {
  runShadow(img);
  const caps = Math.ceil(TILE / RUN_PITCH);
  for (let i = 0; i < caps; i++) runCap(img, i * RUN_PITCH, RUN_HEAD[i % RUN_HEAD.length]!);
  /*
   * Grass breaking the channel's edge, drawn last so it genuinely overlaps the keyline. Two sprigs a
   * tile, on opposite sides at different heights: without them the run lays two dead-straight
   * near-black rules down ten tiles of lawn, which is the one thing a 32px repeat cannot hide.
   */
  for (let i = 0; i < caps; i++) {
    const head = RUN_HEAD[i % RUN_HEAD.length]!;
    if (head.sprig === 'none') continue;
    tuft(img, head.sprig === 'right' ? RUN_EDGE - 1 : RUN_X - 3, i * RUN_PITCH + 3);
  }
};

/*
 * THE CORNER POST, which is the other half of what the brief asked for and the thing that makes a
 * run end rather than stop.
 *
 * The board puts one at every corner of Grandma's garden and it is a genuinely different object from
 * the heads in the run: where the run is a rhythm of domes, the corner is ONE POST -- a single wide
 * flat cap, four rows of it at the top of the ramp, a hard step, and then eighteen rows of body at a
 * near-constant tone with a grain line down it. It is a column of the same timber with no rhythm at
 * all, and that absence is what reads as "this is where the fence turns".
 *
 * Read off the board at board(1172,486) as a 15x28 grid:
 *
 *     cap   rows 4..7    190 188 185 186 186 185 186 177 170   flat, t ~0.96
 *     step  row  8       135 124 115 112 108 108 110 103  87
 *     body  rows 9..26   132 121 114 102 102 115 112 105  98   flat down its whole length
 *
 * The dip at columns 3 and 4 of the body and its recovery at column 5 is the grain, and it is in the
 * board's drawing rather than something added here.
 *
 * ONE TILE, BOTH ENDS. A post is a post, so this tile works at the north end of a run (the run picks
 * up below it), at the south end (the run dies into it from above), and at either end of a picket
 * run, where the rails butt against its keyline. The map needs one name, not four.
 *
 * It is one column wider than the run, 11 of wood against 10, which is the board's own difference --
 * barely anything measured, and it reads as much heavier because of the flat cap.
 */
const CORNER_X = 8; // left keyline; wood 9..21; right keyline 22..23; cast shadow 24
const CORNER_WOOD = 13;

/*
 * THIRTEEN COLUMNS OF WOOD AGAINST THE RUN'S TEN, and that is the one measurement here that is not
 * the board's. Its own corner post is eleven, barely a column more than its run, and side by side
 * at matched scale a corner post the same width as the run does not read as a corner at all -- the
 * render showed a bright chain that simply stopped above a brown stub. The board gets away with it
 * because its post is lighter than its run and carries a flat cap three rows deeper than anything in
 * the rhythm; at our resolution that cap is two rows and it is not enough on its own. Two extra
 * columns, continuing the measured profile outward at both ends, buys the silhouette what the cap
 * cannot. Flagged as a departure.
 */
/*
 * The cap's own first row is dimmer at both flanks than the rows under it -- board row 4 reads 161,
 * 178, 185, 186, 185, 188, 185, 166, 156, 117 against row 5's 190, 188, 185, 186, 186, 185, 186,
 * 177, 170, 115. One soft step, and it is what stops the cap being a pasted-on rectangle.
 */
const CORNER_CAP_TOP = [0.74, 0.9, 0.95, 0.96, 0.95, 0.97, 0.95, 0.96, 0.88, 0.82, 0.7, 0.5, 0.36];
const CORNER_CAP = [0.9, 0.99, 0.98, 0.95, 0.96, 0.96, 0.95, 0.96, 0.93, 0.89, 0.84, 0.72, 0.58];
const CORNER_STEP = [0.46, 0.52, 0.44, 0.38, 0.36, 0.33, 0.33, 0.34, 0.33, 0.31, 0.26, 0.21, 0.16];
const CORNER_BODY = [0.44, 0.5, 0.42, 0.37, 0.3, 0.3, 0.38, 0.37, 0.35, 0.32, 0.29, 0.27, 0.22];
const CORNER_TOP = 1; // row 0 is the joint where a run meets it from above: ONE line, not a bar
const CORNER_CAP_H = 5; // the flat cap, which is what says "post" rather than "another head"
const CORNER_BASE = 28; // last row of wood; the 2px ground keyline follows it

const fenceCorner: Painter = (img) => {
  // Contact shadow first, in the ground's own dark, offset down and right.
  img.ellipse(CORNER_X + 8, CORNER_BASE + 4, 9, 1.8, turf(0.08));

  for (let y = CORNER_TOP; y <= CORNER_BASE; y++) {
    const d = y - CORNER_TOP;
    /*
     * Five rows of flat cap, one step row, then body all the way down -- and the body fades only
     * over its last five rows, into the grass shade, the same way the picket's does.
     */
    const row =
      d === 0
        ? CORNER_CAP_TOP
        : d < CORNER_CAP_H
          ? CORNER_CAP
          : d === CORNER_CAP_H
            ? CORNER_STEP
            : CORNER_BODY;
    const fade = Math.max(0, y - (CORNER_BASE - 5)) * 0.045;

    img.px(CORNER_X, y, WOOD_BLACK);
    for (let i = 0; i < CORNER_WOOD; i++)
      img.px(CORNER_X + 1 + i, y, timber(Math.max(row[i]! - fade, 0.08)));
    img.rect(CORNER_X + 1 + CORNER_WOOD, y, 2, 1, WOOD_BLACK);
    img.px(CORNER_X + 3 + CORNER_WOOD, y, turf(0.1));
  }

  /*
   * The grain, which the board's post has and its run does not: one mark down the body, a sixth of a
   * step darker than the face it sits on. It is the second thing after the cap that says this is one
   * piece of timber rather than a stack of heads.
   */
  for (let y = CORNER_TOP + CORNER_CAP_H + 2; y < CORNER_BASE - 4; y++)
    img.px(CORNER_X + 5, y, timber(CORNER_BODY[4]! - 0.14));

  // The joint at the top, where the run above dies into the cap: one near-black line. Two rows of it
  // read as a gap between two objects rather than as the seam of one.
  img.rect(CORNER_X, 0, CORNER_WOOD + 3, 1, WOOD_BLACK);

  // 2px ground keyline, near-black: section 3.2's thickening on the side the light does not reach.
  img.rect(CORNER_X, CORNER_BASE + 1, CORNER_WOOD + 3, 1, WOOD_BLACK);
  img.rect(CORNER_X, CORNER_BASE + 2, CORNER_WOOD + 3, 1, WOOD_DEEP);

  // And grass breaking its foot, as at the foot of every picket.
  tuft(img, CORNER_X - 2, CORNER_BASE - 1);
  tuft(img, CORNER_X + 6, CORNER_BASE);
  tuft(img, CORNER_X + CORNER_WOOD - 1, CORNER_BASE - 2);
};

/*
 * THE RAIL STUB, AND THE JOINT IT CLOSES -- which is the defect the review called "one fence joint"
 * and is the only one of this file's problems that is visible in the composed frame rather than in a
 * crop of a single tile.
 *
 * `fenceCorner` paints x 8..24 and leaves the rest of its tile transparent. `fenceRail` paints its
 * rails across the FULL width, 0..31. So a picket run arriving at a corner post stops dead at the
 * tile boundary and seven or eight columns of bare lawn open up between the post's keyline and the
 * first rail -- the fence visibly comes apart at exactly the place a corner is supposed to hold it
 * together. Nothing in the tile itself shows this; it only appears once two tiles are laid side by
 * side, which is why four passes over the corner post missed it.
 *
 * So the rails have to leave the post, and which side they leave on is a property of the corner, not
 * of the post: at a north-west or south-west corner the run goes east, at a north-east or south-east
 * corner it goes west, and at the two posts either side of a gate the run goes away from the gap.
 * Hence two variants over the same post, which is unchanged in both -- the post the review approved
 * is drawn first and the stub is laid beside it.
 *
 * The stub is `RAIL_ROWS` itself, at `RAIL_TOP`, so it is the same two rails at the same two heights
 * as every tile of the picket run and the join is seamless. It reaches the tile edge, where the next
 * tile's rails take over. On the east side it overwrites the post's one column of cast shadow, which
 * is correct: a rail in front of the grass hides the shadow on it.
 */
function railStub(img: Img, side: 'east' | 'west'): void {
  const x0 = side === 'east' ? CORNER_X + CORNER_WOOD + 3 : 0;
  const w = side === 'east' ? TILE - x0 : CORNER_X;
  RAIL_ROWS.forEach((s, i) => img.rect(x0, RAIL_TOP + i, w, 1, stepColour(s)));
  // One sprig breaking the stub's base line, as at the foot of every picket in the run.
  tuft(img, side === 'east' ? x0 + 2 : 1, 26);
}

const fenceCornerWith =
  (side: 'east' | 'west'): Painter =>
  (img) => {
    fenceCorner(img);
    railStub(img, side);
  };

/* ------------------------------------------------------------------- bridge */

/*
 * THE CROSSING.
 *
 * `forest-map.ts` lays this as five columns by two rows: `bridge-l`, three of `bridge-m`,
 * `bridge-r` -- and each of those three tiles is used in BOTH rows. That single fact decides the
 * whole design, because the board's bridge has a rail along its far edge and another along its
 * near edge, and there is no tile that knows which row it is in.
 *
 * The answer is to give every tile half of the structure at its top edge and half at its bottom,
 * sized so the two halves mean the right thing in all three places they land:
 *
 *   at the bridge's top edge     rows 0..7    far rail, silhouette above it, black gap below   OK
 *   at the bridge's bottom edge  rows 24..31  near rail, black gap above, silhouette under it  OK
 *   where the two rows meet      rows 24..31 of one tile over rows 0..7 of the next --
 *                                a 16-row centre beam: two stringers with a 2px black joint
 *
 * That centre beam is the honest reading of a 64px span: a deck that wide is carried on a spine,
 * and two stringers bolted together is what a spine looks like.
 *
 * RAIL_H MOVED FROM 7 TO 8, which is not cosmetic. At 7 the composed span was rail 7, deck 18,
 * beam 14, deck 18, rail 7: 36 of 64 decking. The board's crossing is 31 of 64 deck and the rest
 * structure. At 8 it is 8 + 16 + 16 + 16 + 8, so 32 of 64 is deck -- the board's proportion to
 * within a pixel -- and the extra row at each end is what pays for the black gap under the rail.
 *
 * Measured off the board at 1:1: the silhouette luma 2 to 14, the far rail's lit core 175 to 185
 * with dark shoulders either side, the near rail lit along its TOP edge and dark through its body,
 * the deck 118 to 135, the posts 147 to 182 on the lit face, plank seams 42 to 50.
 */

const RAIL_H = 8;
const DECK_TOP = RAIL_H; // 8
const DECK_BOT = TILE - RAIL_H - 1; // 23

/*
 * Deck planks run ACROSS the span, which is to say vertically, so the direction of the boards
 * points the way over and the deck is seamless where the two rows meet.
 *
 * THE PLANK IS 16 WIDE, NOT 8, AND THAT IS A DELIBERATE DEPARTURE FROM SECTION 16. Measured, the
 * board's deck runs eight planks across 218 board pixels: a 28.6 board-pixel pitch, 12.9 of ours.
 * Only 8 and 16 divide a 32px tile. At 8 our crossing is 160px long, so it would carry twenty
 * planks where the board carries eight, and it rendered as slatted decking rather than as timber;
 * at 16 it carries ten. Section 16's "8 wide, 4/tile" is a derived figure and the board is the
 * authority it is derived from. Flagged in the hand-in either way.
 */
const PLANK_W = 16;

/*
 * Across one plank -- and this array is the single biggest change in the file.
 *
 * It used to run 189, 168, 155, 146, 139, 134, 127, 121, 115, 108, 100, 91, 79, 70, 62: a smooth
 * 127-luma sweep from one edge to the other. That is the profile of a log. Ten logs side by side
 * with a dark seam between each is the ladder the brief is complaining about, and no amount of
 * keylining the ends fixes it, because the rungs are the planks themselves.
 *
 * A board sawn flat and nailed down does not do that. Probed at 1:1 the board's deck plank is 44
 * (seam), 158, 137, 124, 122, 118, 87, 58 -- a bright lit edge, then a FACE THAT MOVES ABOUT TEN
 * LUMA across its whole width, then a short fall into the next seam. So that is what this is now:
 * two columns of lit edge, eleven columns sitting between 119 and 139 with a gentle crown, and
 * three columns of fall. Its median is 124 against the board's 122.
 *
 * The lit edge is 160 rather than the 175 a first pass used. A 16px plank is already twice as wide
 * as the board's 12.9, and because the two-row crossing leaves each deck section only sixteen rows
 * tall, a plank here is a SQUARE. A square with a hard bright edge and a hard dark edge reads as a
 * raised block, which is a brick wall, not a deck. 160 against a 125 face is the board's own 36
 * luma of separation and no more; the planks join into one surface with seams in it, which is what
 * the deck has to be for the posts and rails to read as the structure carrying it.
 *
 * The range this gives up is not lost. It is spent on the rails and the posts below, which are
 * round things and are the places the board spends it too.
 */
const PLANK: readonly Step[] = [
  WOOD_SEAM, // 0   the seam, shared with the plank to the left
  0.74, // 1   the lit edge, one column in, where the board puts it on all eight of its planks
  0.62, // 2
  0.54, // 3   and down onto the face within three columns, rather than over sixteen
  0.5,
  0.485,
  0.475,
  0.468,
  0.462, // 8   the crown of the face, such as it is: ten luma from end to end
  0.455,
  0.447,
  0.436,
  0.415,
  0.33, // 13  the turn into the shaded edge: three columns wide, as the board's is
  0.18,
  0.05, // 15  with the next plank's seam this reads as one 3px dark edge
];

/**
 * And along it. The deck darkens as it approaches whatever stands over it, which is the far rail,
 * the near rail or the centre beam depending on which of the three places this tile lands in -- and
 * since it is the same at both ends, one symmetric profile is correct in all of them.
 *
 * It reaches luma 77 against the rail and climbs back to the face over six rows, which is measured:
 * scanning down past the board's far rail the deck starts at 61 and runs 80, 92, 101, 108, 117,
 * 126, 130. This is the cheapest deep shade in the file and the only kind worth adding -- it fills
 * the 60-to-100 band the board is full of and this tile had almost nothing in, where another
 * keyline would only have widened a luma spread that is already over the board's.
 */
function deckShade(y: number): number {
  const d = Math.min(y - DECK_TOP, DECK_BOT - y);
  return d >= 6 ? 0 : -0.32 + d * 0.053;
}

function deck(img: Img): void {
  for (let x = 0; x < TILE; x += PLANK_W) {
    for (let y = DECK_TOP; y <= DECK_BOT; y++) {
      const v = deckShade(y);
      for (let i = 0; i < PLANK_W; i++) {
        const s = PLANK[i]!;
        img.px(x + i, y, typeof s === 'number' ? timber(s + v) : s);
      }
    }
    /*
     * Grain, two marks a plank, running WITH the board rather than across it -- an earlier version
     * drew them horizontally, which on a plank whose length runs top to bottom is a crack, not
     * grain, and at the playing camera read as a row of dashes. Each sits at its own height so
     * neither the two boards in a tile nor the three copies of `bridge-m` line their marks up into
     * a stripe across the span, and each is a sixth of a step down from the face it sits on, well
     * under the 24 luma the score counts as an edge and under what the eye reads as a line.
     */
    const k = x / PLANK_W;
    const mark = (i: number, gy: number, n: number, drop: number): void => {
      for (let j = 0; j < n; j++)
        img.px(x + i, gy + j, timber((PLANK[i] as number) + deckShade(gy + j) - drop));
    };
    mark(5, 11 + k * 3, 3, 0.16);
    mark(10, 18 - k * 4, 2, 0.14);
  }
}

/*
 * A rail, drawn as a band at one edge of the tile. `edge` says which: at the top it is the far
 * rail and its outer row is the bridge's silhouette against the water; at the bottom it is the
 * near rail, and its outer row is the same silhouette seating the whole bridge.
 *
 * THE TWO RAILS ARE NOT THE SAME SHAPE, and that is measured rather than stylised. Scanning down
 * the board's crossing: the far rail reads 60, 131, 144, 175, 178, 131, 100, 88, 68 -- dark
 * shoulder, bright core, dark underside, the profile of a round beam seen from slightly above. The
 * near rail reads 117, 136, 149, 156, 164, 172, 176, 176, then 159, 127, 109, 98, 84, 76, 70, 65,
 * 61 -- lit along its TOP edge and dark down its whole body, because the near edge of a bridge
 * faces away from a top-left light. Stacked at the centre beam the pair reads as two stringers,
 * which is what a 64px span bolted together looks like.
 *
 * THE BLACK ROW AT THE DECK END OF EACH BAND IS THE POINT OF THIS PASS. The board puts five board
 * pixels of luma 22 to 54 between the underside of a rail and the first plank. Without it a
 * handrail is a stripe painted on the decking; with it, it stands off the deck and the bridge
 * becomes a structure. It also gives the centre beam a genuine 2px joint.
 */
const RAIL_FAR: readonly Step[] = [
  WOOD_BLACK, // 0  the silhouette against the water
  0.12, // 1  the dark shoulder -- luma 74, which the board has and a first pass here dropped
  0.62,
  0.7,
  0.94, // 4  the lit core
  0.62,
  0.14, // 6  and away into its own underside
  WOOD_DEEP, // 7  THE GAP: the rail's shadow on the deck, which the board probes at luma 22 to 34
];
const RAIL_NEAR: readonly Step[] = [
  WOOD_BLACK, // 24  THE GAP, this time above the rail
  WOOD_LINE, // 25
  0.8, // 26  lit along the top edge only
  0.86,
  0.4, // 28  and dark the whole way down its body
  0.15,
  0.08,
  WOOD_BLACK, // 31  the silhouette that seats the bridge
];

function rail(img: Img, edge: 'far' | 'near'): void {
  const rows = edge === 'far' ? RAIL_FAR : RAIL_NEAR;
  const y0 = edge === 'far' ? 0 : TILE - RAIL_H;
  rows.forEach((s, i) => img.rect(0, y0 + i, TILE, 1, stepColour(s)));
  /*
   * Nails: ONE a tile, on the near rail only. Section 9.3 asked for two into each rail; the board
   * carries four or five dots across its whole crossing and none that read on the far rail. At one
   * a plank this was ten isolated dots across the span, which is speckle. Five is the board's own
   * count. Flagged in the hand-in.
   */
  if (edge === 'near') img.px(TILE / 2 + 3, y0 + 4, WOOD_BLACK);
}

/*
 * The end post -- and this is the other thing the brief asked for by name.
 *
 * On the board the posts stand at the four corners only, and three things make them read: they are
 * HEAVIER than the rail, they are TALLER than it, and they are LIGHTER than the deck, all inside a
 * near-black ring on every side. The previous version was 12 columns of the deck's own value,
 * exactly as tall as the rail band, keylined only outboard -- so the rail ran straight through it
 * and the four corners disappeared.
 *
 * Now: 14 columns on the left and 15 on the right (2px of keyline on the side the light does not
 * reach, section 3.2), 12 of them wood either way. The head runs rows 0..12 and the foot rows
 * 19..31, so each projects five rows past the 8-row rail band into the deck, and between them rows
 * 13..18 are the deck's own cut end in near-black. Stacked, the foot of one tile and the head of
 * the next meet into one chunky mid-span pier, which is the same trick the rails play.
 *
 * `POST_FACE` peaks at luma 182 and averages about 142 against the deck's 124, so the post is
 * brighter than the planking it carries -- which is what the board does, and what separates a post
 * from the end of the decking.
 */
const POST_W = 14; // left: 1 keyline, 12 wood, 1 keyline
const POST_W_R = 15; // right: 1 keyline, 12 wood, 2 keyline
const POST_FACE = [0.62, 0.84, 0.94, 0.9, 0.76, 0.64, 0.54, 0.45, 0.35, 0.24, 0.16, 0.08];
const POST_HEAD_BOT = 12; // the head runs rows 0..12
const POST_FOOT_TOP = 19; // the foot runs rows 19..31

function endPost(img: Img, side: 'left' | 'right'): void {
  const w = side === 'left' ? POST_W : POST_W_R;
  const x0 = side === 'left' ? 0 : TILE - w;

  for (let y = 0; y < TILE; y++) {
    const onPost = y <= POST_HEAD_BOT || y >= POST_FOOT_TOP;
    if (!onPost) {
      // Mid-height: the deck's cut end. 2px of near-black is the bridge's own silhouette against
      // the bank, and it is what stops the deck reading as a texture laid on the water.
      if (side === 'left') {
        img.rect(0, y, 2, 1, WOOD_BLACK);
        img.px(2, y, WOOD_SEAM);
      } else {
        img.px(TILE - 3, y, WOOD_SEAM);
        img.rect(TILE - 2, y, 2, 1, WOOD_BLACK);
      }
      continue;
    }

    // Capped top and bottom, so stacked the foot and the head read as one pier and not as a seam.
    const capped = y === 0 || y === POST_HEAD_BOT || y === POST_FOOT_TOP || y >= TILE - 2;
    if (capped) {
      img.rect(x0, y, w, 1, WOOD_BLACK);
      continue;
    }
    // One row of lit end grain under each cap, then a little lengthwise fall, so the post rounds
    // in both axes rather than reading as a flat panel.
    const d = y === 1 || y === POST_FOOT_TOP + 1 ? 0 : Math.min(y, TILE - 3 - y);
    const v = d === 0 ? 0.1 : d <= 2 ? 0.02 : -0.06;
    for (let i = 0; i < w; i++) {
      const outer = side === 'left' ? i === 0 : i >= w - 2;
      const inner = side === 'left' ? i === w - 1 : i === 0;
      if (outer) img.px(x0 + i, y, WOOD_BLACK);
      else if (inner) img.px(x0 + i, y, WOOD_DEEP);
      else {
        const j = side === 'left' ? i - 1 : w - 3 - i;
        img.px(x0 + i, y, timber(POST_FACE[j]! + v));
      }
    }
  }
}

function bridgePlank(kind: 'left' | 'middle' | 'right'): Painter {
  return (img) => {
    deck(img);
    rail(img, 'far');
    rail(img, 'near');
    if (kind === 'left') endPost(img, 'left');
    if (kind === 'right') endPost(img, 'right');
  };
}

/*
 * ===========================================================================
 * THE GUARD ON THE NORTH-SOUTH RUN: it must never come apart into beads again.
 * ===========================================================================
 *
 * Five versions of `fencePost` have been wrong and two of them were wrong in the same way -- the
 * run breaks into separate objects, as a rope's coils or as a chain's links -- and neither
 * `pnpm score` nor any test could see it: these two columns are about three per cent of a camera,
 * and the six axes are whole-frame statistics that a fence cannot move.
 *
 * So the two numbers that separate the board's run from version five's chain are asserted here,
 * at import, which is where this file's neighbours put their own craft guards. Both are measured
 * on four stacked tiles, scanning each row for the warm pixels inside the channel:
 *
 *     axis                                     board (in our px)   version five   now
 *     narrowest point of the silhouette             10.4                 5         11
 *     darkest scanline's brightest wood pixel      luma 98             luma 7     107
 *
 * The first says the run never thins; the second says it never goes black across itself, which is
 * what a gap between two posts looks like and what the board's run never has. Either one failing
 * means the channel has been broken back into pieces.
 */
{
  const cell = new Img(TILE, TILE);
  fencePost(cell);
  let narrowest = TILE;
  let darkest = 255;
  for (let y = 0; y < TILE; y++) {
    let width = 0;
    let brightest = 0;
    for (let x = 0; x < TILE; x++) {
      const [r, g, b, a] = cell.get(x, y);
      // Wood only: the grass sprigs and the cast shadow are green, and they are not the run.
      if (a < 40 || g > r) continue;
      width++;
      brightest = Math.max(brightest, 0.299 * r + 0.587 * g + 0.114 * b);
    }
    if (width === 0) continue;
    narrowest = Math.min(narrowest, width);
    darkest = Math.min(darkest, brightest);
  }
  const MIN_WIDTH = 10; // the board's own channel, resampled to our resolution
  const MIN_DARKEST = 80; // the board's darkest scanline still carries wood at luma 98
  if (narrowest < MIN_WIDTH || darkest < MIN_DARKEST)
    throw new Error(
      `the north-south fence run has come apart again: narrowest ${narrowest} columns ` +
        `(floor ${MIN_WIDTH}), darkest scanline peaks at luma ${darkest.toFixed(0)} ` +
        `(floor ${MIN_DARKEST}). A run that thins or goes black across itself reads as a chain ` +
        `of separate objects -- see the long note above RUN_X.`,
    );
}

export const OUTDOOR_TILES: Record<string, (img: Img) => void> = {
  'fence-h': fenceRail,
  'fence-post': fencePost,
  'fence-corner': fenceCorner,
  'fence-corner-e': fenceCornerWith('east'),
  'fence-corner-w': fenceCornerWith('west'),
  'bridge-l': bridgePlank('left'),
  'bridge-m': bridgePlank('middle'),
  'bridge-r': bridgePlank('right'),
};
