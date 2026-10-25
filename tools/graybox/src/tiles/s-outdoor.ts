/*
 * The two pieces of outdoor joinery: Grandma's garden fence and the river crossing.
 *
 * Drawn against `reference/mocks/gameplay-concepts.png`, crops `1178 470 165 70` for the picket run
 * and `345 600 215 160` for the bridge. Sizes are board pixels divided by 2.21, the board-to-our-
 * pixel ratio docs/ART_DIRECTION.md section 2 anchors on Purple.
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
import { FENCE_TILES } from './s-fence.ts';

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
 * THE CONTACT VALUE, and this constant is the whole of what this file contributes to task P13.
 *
 * What the ground reads in the pixel where an object MEETS it, as opposed to the pool of shade it
 * throws beside itself. Every family in the world had independently arrived at the same answer and
 * none of them had written it down: the bush, the rock and the tree roots bottom out at luma 43, 52
 * and 42 in the rows under them, and the three fence tiles -- `fenceRail`'s picket shadow and
 * `fenceCorner`'s -- bottom out at 35, which is this value, opaque.
 *
 * It had no home, which is why `tiles/s-props.ts` re-derived it five times and missed by between 22
 * and 95 luma on every one of them: the six placed props were the only objects in the world whose
 * ground did not darken at all under them, and the fountain's darkest pixel WAS the open lawn. That
 * file now imports this, so there is one declaration of "touching the ground" and the props cannot
 * drift off it again without the fence drifting with them.
 *
 * It is `turf(0.08)` and not a new number: the fence is the family that already had it right, and
 * naming a value is not an excuse to move it. The two call sites below are the ones it was extracted
 * from and both render byte-identically.
 *
 * OPAQUE, not an alpha. `turf()` is a tone of `shadow`, which paint.ts describes as grass in shade,
 * so a contact pixel is a colour computed between two greens and written solid -- the pixel standard's
 * "no partial alpha" rule. A prop composing down TO this value through alpha over its own opaque lawn
 * is the other legal half of the same rule, and is what `cast()` in `s-props.ts` does.
 */
export const CONTACT: RGBA = turf(0.08);

/*
 * A row or column is either a point on the timber ramp or one of the four dark values. Writing the
 * dark ones inline rather than as `null` is what lets a single table say "lit edge, dark body,
 * black gap" in the order the board draws it, which is how every band in this file is now spelled.
 */
type Step = number | RGBA;
const stepColour = (s: Step): RGBA => (typeof s === 'number' ? timber(s) : s);

/* -------------------------------------------------------------------- fence */

/*
 * THE FENCE IS ITS OWN FILE NOW (s-fence.ts): the client's pick of 2026-10-25, option A's pickets in
 * this file's own brown wood. The six versions of the old run, its rope and chain, its open gate and
 * the two import-time guards that held them are in the history before that commit.
 */

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

export const OUTDOOR_TILES: Record<string, (img: Img) => void> = {
  ...FENCE_TILES,
  'bridge-l': bridgePlank('left'),
  'bridge-m': bridgePlank('middle'),
  'bridge-r': bridgePlank('right'),
};
