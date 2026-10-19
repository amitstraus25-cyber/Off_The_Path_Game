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
import { Img, keyline, tone, type RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

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
 */
const PICKET_PITCH = 16;
const PICKET_W = 9; // keyline, 7 of wood, keyline
const PICKET_BASE = 27; // last row of wood; the 2px ground keyline follows it

/**
 * The picket's tone down its length, as a `timber` t.
 *
 * Fitted to a probe of one board picket -- luma p25 77, median 106, p75 120, max 205 -- rather than
 * to its extremes: a narrow lit cap, a fast turn off it into the body at the measured median, then
 * a long fade into the grass shade that puts the bottom quarter of the picket under luma 81 where
 * the board puts it.
 */
function picketT(y: number): number {
  const h = y / PICKET_BASE; // 0 at the cap, 1 at the ground
  if (h <= 0.13) return 0.98 - h * 0.4;
  if (h <= 0.3) return 0.93 - (h - 0.13) * 2.9;
  return 0.44 - (h - 0.3) * 0.52;
}

/*
 * And across it, and this is the change the brief asked for by name.
 *
 * The board's picket is not a cylinder. It is a sawn board turned a few degrees: a LIT FACE of
 * three columns, a short turn, and a DISTINCTLY DARKER SIDE of three more, inside a black keyline.
 * The previous profile here spanned 0.08 to -0.27 and rounded smoothly through it, which at a 7px
 * face is a 50-luma gradient and reads as a dowel. This one spans 0.20 to -0.26: at the body tone
 * the seven columns come out 144, 149, 142, 133, 111, 95, 83, so the face sits together in the
 * 140s and the side sits together between 83 and 111, with one clear turn between them. That turn
 * is the "made of boards" the brief is after, and it costs no extra keyline.
 *
 * The side bottoms out at 83 rather than at the 69 a first pass used. 69 is below the score's
 * deep-shade threshold, and one whole column of every picket sitting there took the run to 45 per
 * cent deep against the board's 33. The board's picket does not have a column of shadow down its
 * side; it has a column of timber turned away from the light.
 */
const PICKET_ACROSS = [0.16, 0.2, 0.14, 0.06, -0.08, -0.18, -0.26];

/*
 * The two rails, drawn before the pickets so the pickets stand in front of them.
 *
 * REVERSED FROM THE PREVIOUS VERSION, which is the fence's biggest single fix. Probed at 1:1, the
 * board's rail between two pickets is one pixel of luma ~170 over three of luma 60 to 90, then
 * near-black down to the next rail. It is a DARK object with a bright line along its top edge.
 * This file drew five rows falling 139 to 77 -- a pale band whose average was brighter than the
 * picket face in front of it -- so the fence read as one slab of wood with a groove in it.
 *
 * ONE NEAR-BLACK ROW, NOT FOUR. A first attempt at this ran the keyline value across the full tile
 * at rows 14 to 17 and measured 38.2 per cent of the fence's wood under luma 60, against the
 * board's 23.8. A full-width row is 32 pixels, so each one costs about five points of that number:
 * the band between the rails has to be DARK TIMBER with one black line in it, not a black bar.
 *
 * Both rails span the full tile width so the run is seamless left to right, and neither carries a
 * keyline at its ends: section 3.3, two surfaces of the same material that meet get no line, and a
 * rail meeting the next tile's rail is the same rail.
 */
const RAIL_ROWS: readonly Step[] = [
  WOOD_LINE, // 10  the keyline above the upper rail
  0.86, // 11  the lit top edge: one pixel, and the whole of how a rail reads
  0.4, // 12  straight off it into the body
  0.28, // 13
  0.21, // 14  the rail's own underside
  WOOD_DEEP, // 15  the one near-black row: the shadowed gap between the two rails
  0.2, // 16
  0.25, // 17
  0.8, // 18  the lower rail's lit edge, a shade down: it is further into the fence's own shadow
  0.34, // 19
  0.26, // 20
  0.21, // 21
  WOOD_LINE, // 22
];
const RAIL_TOP = 10;

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
 * THE RUN SEEN END-ON, north-south -- and the one tile in this file with a hard placement
 * constraint rather than an aesthetic one.
 *
 * `forest-map.ts` stacks `fence-post` nine times down the single column at x = 46 and never once
 * places it beside itself horizontally. So it must run EDGE TO EDGE vertically, carry no rail or
 * picket stub out into the lawn on either side, and hold no feature that breaks at a tile
 * boundary. Those three rules killed an earlier chamfered head and they still bind.
 *
 * WHAT THE BRIEF CALLED A BROWN LADDER, AND WHY IT WAS ONE. The previous version ran one unbroken
 * lit column the full 288px of the stack and pinched the silhouette by two columns every sixteen
 * rows. The argument for the unbroken highlight was that it holds a tall thin object together, and
 * the render settled it: a constant-value band with regular notches in its edges is bamboo. The
 * board does the opposite. Its north-south run is a stack of picket HEADS seen from above -- each
 * one lit across its own crown, falling away down its own length, and separated from the next by a
 * near-black joint. The tone has to restart every period, because that restart is the only thing
 * that says "another picket" rather than "another notch".
 *
 * So the period now carries a lengthwise profile of its own (`HEAD_ALONG`) on top of the
 * cross-section: the tone restarts every head, because that restart is the only thing that says
 * "another picket" rather than "another notch". The cross-section is still sampled by ABSOLUTE
 * column through the pinch rather than rescaled into the narrower band: rescaling slid the lit
 * column inward at every joint, which turned the run into a string of beads.
 *
 * THE PERIOD IS 8, AND THAT OVERTURNS THIS FILE'S OWN NOTE SAYING IT COULD NOT BE. The note recorded
 * that 8 "was a rope ladder at a 26-tile camera" and moved to 16 on the reasoning that halving the
 * picket run's pitch under foreshortening was too fine to read. Scanning the board's own north-south
 * run settles it: the crowns sit 20 board pixels apart, which is 9 of ours, and the column swings
 * from luma 100 in the joint to 200 on the crown every one of them. At 16 we were drawing half as
 * many heads as the board, each twice as long, which is exactly the shape a ladder has. What made
 * the earlier 8 read as rungs was not the pitch but that it was a flat band with notches cut in its
 * edges; a tight stack of individually lit crowns is a different drawing at the same frequency.
 *
 * 8 also still divides 32, so the ninth tile of the column joins the eighth with no break, and four
 * heads land wholly inside every tile.
 *
 * 17 across: 1 of keyline, 14 of wood, 2 of keyline. The board's posts are noticeably heavier
 * timber than its pickets, and 14px of wood stands half again as thick as the 9px picket.
 */
const POST_X = 8; // left keyline; wood 9..22; right keyline 23..24; cast shadow 25..26
const POST_WOOD = 14;
const JOINT_PITCH = 8;

/*
 * The head's cross-section, as `timber` t per column of wood.
 *
 * IT IS FLAT-TOPPED, NOT A CYLINDER, and that is this tile's last correction. Scanning across the
 * board's own run gives 112, 118, 118, 121, 124, 126, 124, 124, 124, 121, 116, 109, 101, 94, 85,
 * 82, 76, 62 before the keyline: seven or eight columns sitting together within six luma, then a
 * long fall down the shaded side. A fence run is a row of SAWN BOARDS seen end-on, so its lit face
 * is flat. Every version of this before peaked in the middle and tapered at both edges, and that
 * taper is what kept the column reading as a tube however the heads were separated -- the lit face
 * never touched the keyline, so each head rounded off at its own left edge.
 *
 * Columns 6 and 7 carry a deliberate 0.26 step, about 36 luma, the same turn the picket run has
 * across its face. A fourteen-column ramp with no step in it measured 16.5 per cent edge density
 * against the board's 29.9: perfectly smooth shading on an object this narrow reads as an
 * airbrushed tube, and it was the one place this file had drifted into the soft focus the review
 * called out elsewhere.
 *
 * It tops out at 0.70 rather than at 0.9 so that `HEAD_ALONG` has somewhere to put the crown, and
 * the tail runs down to 0.09, luma 68, because the far side of a fence seen edge-on is genuinely
 * dark and a tail that stopped at luma 90 read as a row of pale cushions.
 */
const POST_ACROSS = [
  0.56, 0.64, 0.68, 0.7, 0.69, 0.68, 0.66, 0.4, 0.34, 0.29, 0.24, 0.19, 0.14, 0.09,
];

/*
 * Below this the shaded side of a head would stop being timber and start being shadow. The board's
 * north-south run troughs at luma 94 between crowns and keylines at 16 to 46; it has no middle
 * band of near-black, and letting `HEAD_ALONG` drag the dark columns down to the bottom of the ramp
 * measured 33.7 per cent of the column under luma 60 against the board's 21.9. The joint row is
 * exempt -- that one is genuinely in shadow, and it is the only row that is.
 */
const HEAD_FLOOR = 0.09; // luma 68

/*
 * One 8-row period, as [columns pinched off each side, tone offset]. Row 0 is the joint and it
 * straddles nothing -- four whole heads land inside every tile -- so the nine stacked tiles give
 * one unbroken rhythm with no feature sitting astride a join.
 *
 * IT IS TWO FLAT FACETS AND A JOINT, not a gradient. Rows 1 to 3 are the picket's sawn END GRAIN
 * catching the light, rows 4 to 6 are its front face a full step below, rows 7 and 0 are the joint
 * to the next head. Down the centre column that is 189, 188, 187, 157, 155, 152, 127, 88 -- three
 * hard steps a head and three flat runs between them.
 *
 * Grading those eight rows smoothly instead, which two versions of this did, turns every head into
 * a dome and the run into a stack of cushions. It scored the same both ways: deep within half a
 * point of the board and keyline within one. What the board is doing is showing you two planes of
 * a cut piece of wood, and planes are flat.
 *
 * THE SILHOUETTE PINCHES BY TWO COLUMNS AND NO MORE, and getting that wrong is worth recording
 * because the score could not see it. An intermediate version pinched three columns at the joint
 * and one either side of it, which on paper is a head widest through its own middle. It measured
 * almost exactly on the board -- deep 32.6 against 33.1, keyline 21.7 against 21.9 -- and it
 * rendered as a stack of bread rolls. A picket seen end-on has VERTICAL SIDES and a flat top; it is
 * not an ellipse. The separation between heads has to come from the tone restart and a one-column
 * notch, because those are the only two things that do not round the object off.
 */
const JOINT_IN = [1, 0, 0, 0, 0, 0, 0, 0];
const HEAD_ALONG = [0, 0.3, 0.29, 0.28, 0.0, -0.02, -0.05, -0.22];

/*
 * The joint row does not take a `HEAD_ALONG` offset; it takes the cross-section SCALED DOWN, so
 * the seam between two heads is dark but still lit from the left like everything above and below
 * it. Subtracting a constant instead drove the whole right-hand half of that row into the bottom of
 * the ramp, where `tone` clamps: five columns of identical luma 58 beside a left half at 86 made
 * every head round off at its own corners, and the column came out as a stack of cushions however
 * the facets above it were drawn. A seam is a dark line across a lit object, not a shadow pooled at
 * one end of it.
 */
const JOINT_SCALE = 0.34;

const fencePost: Painter = (img) => {
  for (let y = 0; y < TILE; y++) {
    const p = y % JOINT_PITCH;
    const inset = JOINT_IN[p]!;
    const along = HEAD_ALONG[p]!;
    const left = POST_X + inset;
    const right = POST_X + 1 + POST_WOOD - inset;

    /*
     * The keyline deepens at the joint, but only to `WOOD_DEEP`. Probed at 1:1 the board's own
     * north-south run keylines at luma 16 to 46, not at the near-black it uses round the bridge --
     * and drawing it black here measured 31.4 per cent of the column under luma 60 against the
     * board's 21.9. A keyline is the object's own darkest, and this object is not in deep shade.
     */
    const joint = p === 0;
    img.px(left, y, joint ? WOOD_DEEP : WOOD_LINE);
    img.rect(right, y, 2, 1, joint ? WOOD_DEEP : WOOD_LINE);
    for (let i = inset; i < POST_WOOD - inset; i++) {
      const base = POST_ACROSS[i]!;
      const t = joint ? base * JOINT_SCALE : Math.max(base + along, HEAD_FLOOR);
      img.px(POST_X + 1 + i, y, timber(t));
    }

    // Cast shadow to the right, every row, so it carries across every join in the column.
    img.px(right + 2, y, turf(0.06 + (p % 3) * 0.05));
    if (p % 3 !== 1) img.px(right + 3, y, turf(0.2));
  }

  // Grass, where grass grows: against the joint between two heads, on both sides, plus a sprig
  // against each flank. Each is wholly inside the tile, so nothing breaks at a tile boundary.
  tuft(img, POST_X - 2, 13);
  tuft(img, POST_X + POST_WOOD - 1, 14);
  tuft(img, POST_X - 3, 4);
  tuft(img, POST_X + POST_WOOD, 22);
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
     * grain, and at a 26-tile camera read as a row of dashes. Each sits at its own height so
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

export const OUTDOOR_TILES: Record<string, (img: Img) => void> = {
  'fence-h': fenceRail,
  'fence-post': fencePost,
  'bridge-l': bridgePlank('left'),
  'bridge-m': bridgePlank('middle'),
  'bridge-r': bridgePlank('right'),
};
