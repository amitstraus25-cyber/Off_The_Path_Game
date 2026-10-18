/*
 * The two pieces of outdoor joinery: Grandma's garden fence and the river crossing.
 *
 * Redrawn against `reference/mocks/gameplay-concepts.png` rather than against the previous
 * painters. Every size and every tone below was measured off the board with a pixel probe and
 * divided by 2.21, the board-to-our-pixel ratio docs/ART_DIRECTION.md section 2 anchors on Red.
 * The crops are `1200 470 160 110` for the picket run, `1160 370 70 150` for the run seen
 * end-on, and `330 590 240 180` for the bridge.
 *
 * THREE THINGS GOVERN EVERYTHING HERE.
 *
 * ONE: THE KEYLINE. docs/ART_DIRECTION.md section 3 is the reason this file exists. The board
 * rings every built thing in a hard dark line -- measured, the fence keyline runs luma 16 to 35
 * and the bridge's runs luma 2 to 23, against wood faces at luma 110 to 185. The old painters
 * drew none at all, which is why the fence and the bridge read as brown rectangles lying on the
 * lawn. `Img.outline()` cannot help: both of these are drawn edge to edge on tiles that have to
 * tile against their own neighbours, so every keyline here is placed by hand (section 3.4).
 *
 * TWO: THE WARM KEYLINE IS `trunk[0]`, AND IT IS A COMPROMISE. ART_DIRECTION section 14 asks for
 * a `wood` keyline at `#472618`, luma 44, and records that nothing in the palette serves until
 * that lands: `wood[0]` is luma 76, `shadow` is green and `ink` is purple. `trunk[0]` `#4e3520`
 * is luma 58 -- fourteen light of the board, but warm, and listed ✓ in that document's own
 * section 13 table of values inside the board's keyline band. It is used here in preference to
 * the `ink[2]` fallback because a purple-cast bark on the one warm object in a green frame costs
 * more than fourteen levels do. When Ask 1 lands, swap `WOOD_LINE` and nothing else changes.
 *
 * THREE: ONE LIGHT, FROM THE TOP-LEFT. Lit faces are up and left, shade is down and right, and
 * the keyline thickens to 2px on the bottom and lower-right of the bridge (section 3.2) because
 * that is what seats it on the water. It is never thickened on a top or left edge.
 *
 * Both painters also have to survive how `forest-map.ts` actually lays them, which is the thing
 * that constrains them more than the board does. See the notes on each.
 */
import { Img, shade } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/*
 * The one keyline value, for every piece of wood in this file. See note TWO above.
 */
const WOOD_LINE = shade('ink', 1);

/* Wood, dark to light. The board's picket body reads luma 110 and its lit head luma 186 to 201;
   `wood` 1 and 3 land on 110 and 185, so the ramp is used straight with no reinterpretation. */
const WOOD_SHADE = shade('wood', 0);
const WOOD_BASE = shade('wood', 1);
const WOOD_FACE = shade('wood', 2);
const WOOD_LIT = shade('wood', 3);

/* Structural timber -- the bridge's posts. Measured at luma 65 to 115 against a deck at 124 and
   a rail at 170, so the posts are a genuinely darker wood rather than the deck in shadow. */
const POST_SHADE = shade('trunk', 0);
const POST_BASE = shade('trunk', 1);
const POST_LIT = shade('trunk', 2);

/* Grass in deep shade, for the tufts that break the fence's base line and for contact shadows.
   The board's tufts at the foot of a picket sample `#176f54` at luma 82 -- a deep teal-green,
   nothing like the open lawn at luma 182 -- so they come off `shadow` rather than `grass`. */
const TUFT_DEEP = shade('shadow', 1);
const TUFT_BASE = shade('shadow', 2);
const TUFT_LIT = shade('shadow', 3);

/* -------------------------------------------------------------------- fence */

/*
 * THE PICKET RUN, east-west.
 *
 * Measured off the board at `1200 470 160 110`: pickets 46 board pixels apart, 22 across, 58
 * tall, with two rails behind them. Divided by 2.21 that is a 21px pitch and a 10px picket, and
 * 21 does not divide 32. The pitch therefore snaps to 16 -- two pickets a tile, which is also
 * what ART_DIRECTION section 9.2 specifies -- and the picket to 9 across, so the gaps come out
 * at a uniform 7 and the run tiles against itself with no seam.
 *
 * What the old painter got wrong, in order of how much it cost: no keyline anywhere, square
 * tops instead of domed ones, 4px pickets on an 8px pitch (twice the board's density, so the run
 * read as a comb rather than a fence), and no tufts at the base.
 *
 * THE TUFTS ARE NOT DECORATION. Section 9.2 calls them out and the board is emphatic: dark grass
 * grows in front of the bottom of every picket and breaks the line where the wood meets the
 * ground. Without them a fence drawn on transparency sits on the lawn like a sticker, because
 * its base is a straight horizontal edge and nothing else in a forest has one.
 */
const PICKET_PITCH = 16;
const PICKET_W = 9; // 1px keyline, 7px of wood, 1px keyline

/* Row plan, measured. Dome cap 1, wood 2..27 (26 rows, section 16), 2px base keyline 28..29. */
const PICKET_TOP = 1;
const PICKET_BASE = 27;

/*
 * The two rails, drawn before the pickets so the pickets stand in front of them.
 *
 * Rows come straight off the board's gap column: a near-black band, then a face that peaks one
 * pixel below its top edge, then a near-black band again. The rails are NOT darker than the
 * pickets -- measured, the rail face is luma 140 to 155 against a picket body at 110 -- and what
 * separates them is the heavy dark above and below each rail plus every picket's own keyline.
 * Reading section 9.2's "a darker wood" as a darker VALUE is what made the first pass look like
 * a hurdle rather than a fence.
 *
 * Both rails span the full tile width so the run is seamless left to right, and neither carries
 * a keyline at its ends: section 3.3, two surfaces of the same material that meet get a shade
 * line, and a rail meeting the next tile's rail is the same rail.
 */
function rails(img: Img): void {
  const band = (y: number, h: number, c: ReturnType<typeof shade>): void =>
    img.rect(0, y, TILE, h, c);
  band(10, 2, WOOD_LINE);
  band(12, 1, WOOD_LIT);
  band(13, 2, WOOD_FACE);
  band(15, 1, WOOD_BASE);
  band(16, 2, WOOD_LINE);
  band(18, 1, WOOD_LIT);
  band(19, 3, WOOD_FACE);
  band(22, 2, WOOD_BASE);
  band(24, 2, WOOD_LINE);
}

/*
 * One picket: 9 across including its keyline, domed, lit across the top six rows.
 *
 * The head is the whole point of the silhouette. On the board the top 14 board pixels of a
 * picket sit at luma 186 to 201 -- a flat lit cap, the end grain facing the sun -- and then the
 * body drops to 110 and darkens further toward the ground. Squaring that head off, as the old
 * painter did, loses the one piece of shape a 9px-wide object has.
 */
function picket(img: Img, x0: number): void {
  // The dome: one step in, which is all the board uses and all 7px of wood can carry.
  img.rect(x0 + 2, PICKET_TOP, 5, 1, WOOD_LINE);
  img.px(x0 + 1, PICKET_TOP + 1, WOOD_LINE);
  img.px(x0 + 7, PICKET_TOP + 1, WOOD_LINE);

  for (let y = PICKET_TOP + 1; y <= PICKET_BASE; y++) {
    const inset = y === PICKET_TOP + 1 ? 1 : 0;
    const bx = x0 + 1 + inset;
    const bw = 7 - inset * 2;
    if (inset === 0) {
      img.px(x0, y, WOOD_LINE);
      img.px(x0 + PICKET_W - 1, y, WOOD_LINE);
    }
    // The head is end grain facing the sun and takes the light across its full width, which is
    // the one piece of modelling a 7px-wide object gets. The body below it is a flat face
    // (section 4): one tone, a lit column on the left, a shaded one on the right, and nothing in
    // between -- and it darkens over its last three rows, where the board's does.
    const head = y <= PICKET_TOP + 6;
    const foot = y >= PICKET_BASE - 2;
    img.rect(bx, y, bw, 1, head ? (y <= PICKET_TOP + 2 ? WOOD_FACE : WOOD_LIT) : WOOD_BASE);
    if (head && y >= PICKET_TOP + 6) img.rect(bx, y, bw, 1, WOOD_FACE);
    if (!head) {
      img.rect(bx, y, bw, 1, foot ? WOOD_SHADE : WOOD_BASE);
      img.px(x0 + 1, y, foot ? WOOD_BASE : WOOD_FACE);
      img.px(x0 + 7, y, WOOD_SHADE);
    }
  }

  // 2px base keyline: section 3.2's thickening on the side the light does not reach.
  img.rect(x0, PICKET_BASE + 1, PICKET_W, 2, WOOD_LINE);
}

/*
 * A sprig of three blades. Small -- 5 across, 4 tall -- because its job is to break one picket's
 * base line, not to be noticed. Drawn last, over the wood, so it genuinely overlaps.
 */
function tuft(img: Img, x: number, y: number): void {
  img.rect(x + 1, y + 3, 3, 1, TUFT_DEEP);
  img.rect(x, y + 2, 5, 1, TUFT_BASE);
  img.px(x + 1, y + 1, TUFT_BASE);
  img.px(x + 3, y + 1, TUFT_BASE);
  img.px(x + 2, y + 1, TUFT_LIT);
  img.px(x, y + 1, TUFT_LIT);
  img.px(x + 2, y, TUFT_LIT);
}

const fenceRail: Painter = (img) => {
  rails(img);

  for (const x of [0, PICKET_PITCH]) {
    // Contact shadow first, under the picket: section 4, a flattened ellipse in the ground's own
    // dark, 1.4x the base width, offset down and right. Opaque, never translucent black.
    img.ellipse(x + 5, PICKET_BASE + 3, 6, 1.6, TUFT_DEEP);
  }
  for (const x of [0, PICKET_PITCH]) picket(img, x);

  // Grass at the foot of the run. Five sprigs, not a hedge: the board leaves gaps between them,
  // and a continuous green fringe is just a second straight line under the first one. Two of
  // these wrap, so the sprig at x = -2 continues out of the tile to the left.
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
 * boundary. Those three rules killed the previous version's chamfered head and they still bind.
 *
 * What the board does here is better than a bare post and costs nothing: a fence running away
 * from the camera shows its pickets foreshortened, so the run reads as a continuous band of wood
 * with the domed picket heads repeating down it. Measured, the board's dome pitch is 23 board
 * pixels against the picket run's 46 -- exactly half, which is what foreshortening predicts --
 * so our 16px picket pitch becomes an 8px dome pitch here. 8 divides 32, so four domes land in
 * every tile and the ninth tile of the column joins the eighth with no break at all.
 *
 * The band itself is 10px of wood between a 1px keyline on the left and a 2px one on the right,
 * measured at 22 and 3 and 4 board pixels. Its cross-section is lit in the middle and falls off
 * both ways, which is section 4's rounded-mass rule rather than its flat-face one: this is the
 * rounded top of a run of pickets, not a plank.
 */
const POST_X = 11; // left keyline; wood 12..21; right keyline 22..23
const DOME_PITCH = 8;

/* Dome widths by position in the 8px period: one trough row, then a head that opens from 4 wide
   to the band's full 10 and closes again, the way a picket's domed top looks foreshortened. */
const DOME_W = [0, 4, 6, 8, 8, 10, 8, 6];

/* How far the cast shadow reaches, by row. Irregular on purpose: a shadow of constant width is
   a ruled line, and nine of these stacked would draw a 288px ruled line down the garden. */
const SHADOW_W = [2, 2, 1, 2, 1, 2, 2, 1];

const fencePost: Painter = (img) => {
  for (let y = 0; y < TILE; y++) {
    // Cast shadow to the right, every row, so it carries across every join in the column.
    img.px(24, y, TUFT_DEEP);
    if (SHADOW_W[y % 8] === 2) img.px(25, y, TUFT_BASE);

    // The band's cross-section: 1px keyline, 10px of wood lit through its middle, 2px keyline.
    // Section 4's rounded-mass rule, not its flat-face one -- this is the rounded top of a run
    // of pickets seen end-on, and the board's profile falls away on both sides of a lit centre.
    img.px(POST_X, y, WOOD_LINE);
    img.px(POST_X + 1, y, WOOD_SHADE);
    img.rect(POST_X + 2, y, 3, 1, WOOD_BASE);
    img.rect(POST_X + 5, y, 3, 1, WOOD_FACE);
    img.px(POST_X + 8, y, WOOD_BASE);
    img.px(POST_X + 9, y, WOOD_SHADE);
    img.rect(POST_X + 10, y, 2, 1, WOOD_LINE);

    // The picket head laid over it. Seven rows of head to one of trough, which is the ratio the
    // board holds: the heads very nearly touch, and a wide gap between them reads as a stack of
    // separate objects rather than as one run of fence going away from you.
    const p = y % DOME_PITCH;
    const w = DOME_W[p]!;
    if (w === 0) continue;
    const x = POST_X + 1 + (10 - w) / 2;
    img.rect(x, y, w, 1, p <= 1 ? WOOD_FACE : p <= 3 ? WOOD_LIT : p <= 5 ? WOOD_FACE : WOOD_BASE);
  }

  // Grass against both sides, on a 16px period: two sprigs a side, each wholly inside the tile,
  // so nine stacked tiles give one unbroken rhythm and no feature sits astride a join.
  for (let y = 3; y < TILE; y += 16) tuft(img, 8, y);
  for (let y = 11; y < TILE; y += 16) tuft(img, 21, y);
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
 *   at the bridge's top edge     rows 0..5    far rail, keyline above it, shade below   ✓
 *   at the bridge's bottom edge  rows 25..31  near rail, with the 2px keyline under it  ✓
 *   where the two rows meet      rows 25..31 of one tile over rows 0..5 of the next --
 *                                a 14-row centre beam: two rails with a 3px dark joint
 *
 * That centre beam is the honest reading of a 64px-wide span, not a compromise: a deck that wide
 * is carried on a spine, and two stringers bolted together is what a spine looks like. The
 * alternative the previous painter chose -- no rail anywhere, so that nothing could land in the
 * middle -- is why the old bridge read as a patch of floorboards rather than a structure.
 *
 * Measured off the board at `330 590 240 180`: keyline luma 2 to 23 (the darkest line anywhere on
 * the board), rails luma 130 to 185, deck luma 110 to 135, posts luma 65 to 115, plank seams
 * luma 37 to 50. The deck is therefore wood 1 with wood 2 edges, the rails are wood 2 capped
 * with wood 3, and the posts are the `trunk` ramp, which is the one place in this file where two
 * brown ramps are used at once -- and it is earned, because on the board the posts are a visibly
 * heavier timber than the deck they carry.
 */

/*
 * Deck planks run ACROSS the span, which is to say vertically, so the direction of the boards
 * points the way over and the deck is seamless where the two rows meet. Seams are a 1px
 * `wood[0]` SHADE line, never the keyline: section 3.3, two surfaces of the same material that
 * meet do not get a line between them. Each plank is lit on its left edge, one column in from
 * the seam, which is where the board puts its brightest pixel on all eight of its planks.
 *
 * THE PLANK IS 16 WIDE, NOT 8, AND THAT IS A DELIBERATE DEPARTURE FROM SECTION 16. Measured, the
 * board's deck runs eight planks across 218 board pixels: a 28.6 board-pixel pitch, which is
 * 12.9 of ours. Only 8 and 16 divide a 32px tile. 16 misses the board by 24 per cent and 8
 * misses it by 38, and the error runs the wrong way -- at 8 our crossing is 160px long, so it
 * would carry twenty planks where the board carries eight, and it rendered as slatted decking
 * rather than as timber. At 16 it carries ten. Section 16's "8 wide, 4/tile" is a derived figure
 * and the board is the authority it is derived from; flagged in the hand-in either way.
 */
const PLANK_W = 16;

function deck(img: Img): void {
  for (let x = 0; x < TILE; x += PLANK_W) {
    img.rect(x, 0, 1, TILE, WOOD_SHADE); // the seam, shared with the plank to the left
    img.rect(x + 1, 0, 1, TILE, WOOD_LIT); // lit edge, one column in
    img.rect(x + 2, 0, 2, TILE, WOOD_FACE);
    img.rect(x + 4, 0, 11, TILE, WOOD_BASE);
    img.rect(x + 15, 0, 1, TILE, WOOD_SHADE);
    // Grain, two marks a plank, each at its own height so neither the two boards in a tile nor
    // the three copies of `bridge-m` line their marks up into a stripe across the span.
    const k = x / PLANK_W;
    img.rect(x + 5, 8 + k * 5, 3, 1, WOOD_SHADE);
    img.rect(x + 10, 19 - k * 6, 2, 1, WOOD_SHADE);
  }
}

/*
 * A rail, drawn as a band at one edge of the tile. `edge` says which: at the top it is the far
 * rail and keeps a shade line beneath it where it throws onto the deck; at the bottom it is the
 * near rail and keeps the 2px keyline under it that seats the whole bridge on the water.
 *
 * The lit line sits one pixel in from the keyline and never touches it (section 4). The board
 * actually carries its highlight about two thirds of the way down each rail, which is what a
 * round-topped beam does under a camera that looks down at it -- but every other object in the
 * game is lit on its top edge, and one rail lit from somewhere else reads as a mistake rather
 * than as perspective. Section 4 wins; the divergence is deliberate and it is one pixel.
 */
function rail(img: Img, edge: 'far' | 'near'): void {
  if (edge === 'far') {
    img.rect(0, 0, TILE, 1, WOOD_LINE);
    img.rect(0, 1, TILE, 1, WOOD_LIT);
    img.rect(0, 2, TILE, 2, WOOD_FACE);
    img.rect(0, 4, TILE, 1, WOOD_BASE);
    img.rect(0, 5, TILE, 1, WOOD_LINE);
  } else {
    img.rect(0, 25, TILE, 1, WOOD_LINE);
    img.rect(0, 26, TILE, 1, WOOD_LIT);
    img.rect(0, 27, TILE, 2, WOOD_FACE);
    img.rect(0, 29, TILE, 1, WOOD_BASE);
    img.rect(0, 30, TILE, 2, WOOD_LINE);
  }
  // Two nails a plank, one into each rail, per section 9.3.
  const y = edge === 'far' ? 3 : 28;
  for (let x = 0; x < TILE; x += PLANK_W) {
    img.px(x + 6, y, WOOD_LINE);
    img.px(x + 11, y, WOOD_LINE);
  }
}

/*
 * The end post. On the board the posts stand at the four corners only -- at the rails -- and
 * between them the deck simply ends in its keyline, which is exactly what the mid-height rows
 * here do. Stacked, the two tiles' post heads meet into one chunky centre post under the centre
 * beam, which is the same trick the rails play and for the same reason.
 *
 * Lit as a cylinder (section 4): a 2px lit column one pixel in from the silhouette, the base
 * across the middle, shade down the right. 12px across, measured at 11 plus its keylines.
 */
const POST_W = 12;

function endPost(img: Img, side: 'left' | 'right'): void {
  const x0 = side === 'left' ? 0 : TILE - POST_W;

  for (let y = 0; y < TILE; y++) {
    const atRail = y <= 5 || y >= 25;
    if (atRail) {
      const capped = y === 0 || y >= 30;
      img.rect(x0, y, POST_W, 1, capped ? POST_SHADE : POST_BASE);
      if (!capped) {
        if (side === 'left') {
          img.px(x0, y, POST_SHADE);
          img.rect(x0 + 1, y, 2, 1, POST_LIT);
          img.rect(x0 + POST_W - 3, y, 1, 1, POST_SHADE);
          img.rect(x0 + POST_W - 2, y, 2, 1, WOOD_LINE);
        } else {
          img.rect(x0, y, 2, 1, WOOD_LINE);
          img.rect(x0 + 2, y, 2, 1, POST_LIT);
          img.rect(x0 + POST_W - 2, y, 2, 1, POST_SHADE);
        }
      }
    } else if (side === 'left') {
      // Mid-height: the deck's cut end, and the bridge's own silhouette against the bank.
      img.px(0, y, WOOD_LINE);
      img.px(1, y, WOOD_SHADE);
    } else {
      // 2px on the right, the side the light never reaches (section 3.2).
      img.px(TILE - 3, y, WOOD_SHADE);
      img.rect(TILE - 2, y, 2, 1, WOOD_LINE);
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
