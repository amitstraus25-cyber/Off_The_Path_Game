/*
 * Grandma's cottage at 32x32, redrawn from the concept board's Arrive frame.
 *
 * The board crops this was measured from, all against
 * `reference/mocks/gameplay-concepts.png`:
 *
 *   whole facade   2000 1140 720 350  @1.5
 *   roof courses   2030 1140 210 130  @5
 *   the door       2240 1250 200 240  @4
 *   left window    2080 1280 185 200  @4
 *   right window   2460 1280 190 200  @4
 *   the chimney    2650 1130 140 220  @4
 *
 * WHAT THE BOARD ACTUALLY DRAWS, and what each of these eight painters owes it.
 *
 * THE KEYLINE IS THE WHOLE DIFFERENCE. docs/ART_DIRECTION.md section 1 measures the board's cottage
 * at 28.2 per cent of pixels below luma 81 against 8.6 per cent for the shipped tileset, and section
 * 3 says why: every object on the board is ringed in a hard line well below its own darkest shade.
 * Neither `roof` nor `wood` owns such a step yet (section 14, Ask 1), so this file uses the two
 * stand-ins that document names: `ink` level 3 for slate and stone (#543d66, luma 57, against the
 * board's own cool-cast #3a3645 at 55) and `trunk` level 0 for wood (#4e3520, luma 57, inside the
 * board's warm keyline band of 44 to 59). Both are named once, below, so they can be moved to real
 * ramp steps in one edit when Ask 1 lands.
 *
 * ONE LIGHT, FROM THE TOP-LEFT. Every slate takes its lit cap on its own top edge, every stone block
 * is lit on its top-left corner, every plank carries its light down its left edge, and the arch is
 * lit on the upper-left quarter of its ring. Nothing here is lit from below.
 *
 * THE COURSES LINE UP, which is the only reason eight separate squares read as one building.
 * Horizontally the slate grid is 16 and the stone bond is 16, and 16 divides 32, so the shingles and
 * the quoins run unbroken across the facade's six columns. Vertically the slate grid is 9, which does
 * NOT divide 32, so a course is addressed by its position in ROOF SPACE -- Y=0 at the top of
 * `roof-peak`, Y=63 at the bottom of `roof-l/m/r` -- and each painter subtracts its own row offset.
 * `COURSE_Y` is that list and it is the contract between the two roof rows.
 *
 * THE ONE DEPARTURE FROM THE BOARD, per docs/ART_PRODUCTION.md section 6a and ART_DIRECTION section
 * 12: the board's roof is terracotta and ours is slate. The tile SHAPE and the per-tile LIGHTING are
 * copied exactly; only the ramp changes.
 *
 * ONE GREY PER BUILDING, kept from the painter this replaces. Everything worked-stone on the cottage
 * -- the quoins, the arch voussoirs, the doorstep, the chimney -- is the `roof` ramp read one step
 * up, so a quoin sits at luma 145 where a slate sits at 114. That is the board's own relationship
 * (its quoins run 147 to 195 against slates the eye reads as the darker mass) and it keeps the cool
 * `stone` ramp out on the well and the riverbed where undressed rock belongs.
 *
 * THREE THINGS THE BOARD HAS THAT THE FROZEN TILE LIST CANNOT HOLD, flagged rather than faked:
 * the gable window over the door, the timber corner posts at the building's two ends, and a base
 * keyline under the whole facade. All three would have to live in `wall`, which the map lays
 * eighteen times in a 6x3 block, so any of them would repeat eighteen times. The door tile carries
 * the base keyline for its own two columns; the rest of the facade meets the grass without one.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/*
 * The two keylines, per ART_DIRECTION section 14's "what painters may do today".
 *
 * SLATE_LINE is cool with a faint purple cast, which is what the board's stone keyline has; it rings
 * the roof, the chimney and the doorstep. WOOD_LINE is warm; it rings the door, its frame and the
 * window. Each has to sit well below the darkest step of the ramp it is ringing -- `roof` level 0 is
 * luma 70 and `wood` level 0 is 75, and a line at those values is a shade, not a keyline.
 *
 * ONE CORRECTION TO ART_DIRECTION SECTION 14, which says to prefer `ink` level 3 for cool keylines
 * because it measures at luma 57 against the board's #3a3645 at 55. On the 0.299/0.587/0.114 scale
 * the rest of this project uses, `ink` level 3 #543d66 is luma 72 and #3a3645 is 57 -- fifteen
 * apart, and two levels above `roof` level 0, so a roof ringed in it has no keyline at all. `ink`
 * level 2 #3d2a4d is luma 52, within five of the board's own value, and it is what is used here.
 * The first pass of this file used level 3 and the roof came out ringed in a pale lilac line.
 */
const SLATE_LINE = shade('ink', 2);
const WOOD_LINE = shade('trunk', 0);

/* The cottage's one grey: the `roof` ramp read one step up, so dressed stone sits above slate. */
const STONE_DEEP = shade('roof', 0); // the joint against plaster, and the flue's opening
const STONE_DARK = shade('roof', 1); // shaded faces, mortar joints, voussoir joints
const STONE_BASE = shade('roof', 2);
const STONE_LIT = shade('roof', 3);

/* ------------------------------------------------------------------ plaster */

/*
 * Cream plaster, and nothing else.
 *
 * The painter this replaces drew dressed brick over the whole elevation; the board's wall is flat
 * plaster with stone ONLY at the corners and around the door (ART_DIRECTION section 9.1, and section
 * 13 item 12 names the brick by name). Sampled off the board between the gable window and the right
 * slope, clean plaster is 68 per cent two values at luma 216 and 225, which is `wall` levels 1 and 2
 * almost exactly -- so the field is level 1 and the mottle is level 2, thirteen levels apart.
 *
 * Section 4's flat-face rule -- a lighter line along the top and left, a shade line along the bottom
 * and right -- is a rule for ONE face, and this tile is a sixth of one. Drawing those lines per tile
 * would rule a grid across the elevation every 32 pixels, so the wall carries the mottle and the
 * weathering only, and the building's lighting is carried by the roof, the arch and the window
 * frames that sit on it.
 *
 * Everything here wraps, because `wall` is laid 6 across and 3 down and a blotch that stops at a tile
 * edge draws the grid for you.
 */
function mottle(img: Img, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      img.px((((x + i) % TILE) + TILE) % TILE, (((y + j) % TILE) + TILE) % TILE, c);
}

/*
 * Three soft patches, stepped in 2 to 4 pixel jumps so no edge is a straight run.
 *
 * Deliberately few. The first pass covered 40 per cent of the tile, which is the mottling density
 * section 6.2 asks of GROUND, and on a wall laid eighteen times it came out as camouflage with a
 * visible 32px repeat: the patches, not the windows, were the first thing the eye found on the
 * facade. Ground is a field the player looks past; a wall is a face they look at.
 */
const PLASTER_PATCHES: ReadonlyArray<readonly [number, number, number, number]> = [
  [5, 4, 6, 2],
  [3, 6, 9, 3],
  [6, 9, 5, 2],
  [21, 16, 7, 2],
  [20, 18, 10, 3],
  [22, 21, 6, 2],
  [12, 26, 7, 2],
  [11, 28, 10, 3],
];

/* Weathering: short marks and two hairline cracks, the small grey flecks the board's plaster has. */
const PLASTER_MARKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [6, 19, 2, 1],
  [22, 9, 2, 1],
  [12, 15, 1, 2],
  [28, 25, 1, 1],
  [17, 2, 2, 1],
  [2, 13, 1, 1],
  [19, 23, 1, 1],
  [9, 21, 1, 3],
  [10, 24, 1, 1],
  [25, 6, 1, 3],
];

function plaster(img: Img): void {
  img.rect(0, 0, TILE, TILE, shade('wall', 1));
  for (const [x, y, w, h] of PLASTER_PATCHES) mottle(img, x, y, w, h, shade('wall', 2));
  for (const [x, y, w, h] of PLASTER_MARKS) mottle(img, x, y, w, h, shade('wall', 0));
}

const cottageWall: Painter = (img) => {
  plaster(img);
};

/* --------------------------------------------------------------------- roof */

/*
 * Slate, in the board's tile shape.
 *
 * On the board a roof tile is a rounded rectangle half again as wide as it is tall, with a bright
 * cap along its own top edge, its two bottom corners cut away, and a dark band under its butt. Three
 * tiles meeting put their cut corners together and the band becomes a row of V notches -- that
 * notch, repeated, is what tells a roof from a coursed wall at a 26-tile camera, and the painter this
 * replaces had the scallop but gave every course an identical lit stripe instead of lighting each
 * tile on its own (ART_DIRECTION section 9.1, and section 13 item 11).
 *
 * SHINGLE_W is 16 rather than the direction's measured 14 because 16 divides 32 and 14 does not: the
 * courses have to run unbroken across `roof-l`, four `roof-m` and `roof-r`, and a 14px grid would
 * step by two pixels at every tile seam. 16 also sits between the direction's 14 and the 19 the
 * Arrive frame actually measures, so it is the closer of the two numbers to the board.
 *
 * Courses are drawn BOTTOM UP so each one's butt lands on the head of the course below it, the way
 * slate is laid, and the tile is flooded with level 0 first so the notches between butts show the
 * dark under-roof rather than whatever was there before.
 */
const SHINGLE_W = 16;
const COURSE = 11;

/*
 * Roof space: Y=0 is the top of `roof-peak`, Y=63 the bottom of `roof-l/m/r`. Five courses of 11,
 * starting under the ridge cap and ending where the eave fascia begins. `roof-peak` draws the first
 * three and `roof-l/m/r` the tail of the third plus the last two; each subtracts its own row offset.
 * The alternating half-tab offset is the course's index parity, so it carries across the seam
 * between the two rows.
 */
const COURSE_Y = [5, 16, 27, 38, 49] as const;
const EAVE_Y = 27; // in `roof-l/m/r`'s own rows: fascia, then the 2px keyline that seats the roof

/*
 * The bottom of one slate, column by column: the row its body stops on.
 *
 * This curve is the single most important number in the roof. The painter this replaces ruled a
 * straight course line under a full-height vertical joint, and a straight line crossing a full-height
 * joint is a brick grid however it is shaded -- which is what the first pass of this file came out
 * as too. Here the butt is deepest in the middle and climbs four rows at both ends, so where three
 * slates meet the dark under-roof shows through as a V. That V, repeated, is what reads as slate at a
 * 26-tile camera; the shading inside the tile is only read close up.
 */
const BUTT = [5, 6, 7, 8, 8, 9, 9, 9, 9, 9, 9, 8, 8, 7, 6, 5] as const;

/** One slate: 16 wide on an 11-row pitch, lit on its own top edge, its butt curved. */
function shingle(img: Img, x0: number, y: number): void {
  for (let i = 0; i < SHINGLE_W; i++) {
    const top = i === 0 || i === SHINGLE_W - 1 ? 1 : 0;
    const bottom = BUTT[i]!;
    img.rect(x0 + i, y + top, 1, bottom - top + 1, shade('roof', 1));
    img.px(x0 + i, y + top, shade('roof', 2)); // the lit cap follows the tile's own top edge
    img.px(x0 + i, y + bottom + 1, shade('roof', 0)); // the butt's shade, hugging the curve
  }
  // The brightest pixels, left of centre and short: seven of a 176-pixel cell, well inside section
  // 5's 12 per cent ceiling on level 3.
  img.rect(x0 + 2, y, 7, 1, shade('roof', 3));
  // Light down the left edge and the joint to the next slate on the shaded right. Three rows, not
  // nine: a full-height joint under a course line is brickwork.
  img.rect(x0, y + 1, 1, 3, shade('roof', 2));
  img.rect(x0 + SHINGLE_W - 1, y + 2, 1, 3, shade('roof', 0));
}

/** Every course that lands in this tile, bottom up, with the half-tab offset alternating. */
function courses(img: Img, rowOffset: number): void {
  for (let i = COURSE_Y.length - 1; i >= 0; i--) {
    const y = COURSE_Y[i]! - rowOffset;
    if (y > TILE || y < -COURSE) continue;
    const off = (i % 2) * (SHINGLE_W / 2);
    for (let x = off - SHINGLE_W; x < TILE + SHINGLE_W; x += SHINGLE_W) shingle(img, x, y);
  }
}

function roof(kind: 'left' | 'middle' | 'right' | 'peak'): Painter {
  return (img) => {
    /*
     * The under-roof, flooded first so it shows through the V notches where three slates meet. It is
     * the KEYLINE value and not `roof` level 0, because level 0 is already spoken for as the butt
     * line and the joints: the board's roof runs its tile bodies around luma 130, its joints at 65
     * to 75 and its deepest notches at 51, and that third value is twelve per cent of the roof's
     * area. Without it the whole tileset's census below luma 60 stays at nothing (section 1).
     */
    img.rect(0, 0, TILE, TILE, SLATE_LINE);

    if (kind === 'peak') {
      courses(img, 0);

      // Ridge cap: half-round tiles along the crest, lit on top, segmented every 16px. The joints
      // sit at 7 and 23 so no joint lands on a tile seam -- `roof-peak` is laid six times across.
      img.rect(0, 0, TILE, 1, SLATE_LINE); // the building's top silhouette
      img.rect(0, 1, TILE, 1, shade('roof', 3));
      img.rect(0, 2, TILE, 1, shade('roof', 2));
      img.rect(0, 3, TILE, 1, shade('roof', 1));
      img.rect(0, 4, TILE, 1, shade('roof', 0));
      for (const x of [7, 23]) img.rect(x, 1, 1, 3, shade('roof', 0));
      return;
    }

    courses(img, TILE);

    /*
     * The eave: a fascia board standing proud of the butts, the 2px keyline, and the shadow the
     * overhang throws on the plaster. Section 3.2 -- the second keyline pixel is the thickening on
     * the side the light does not reach, and it is what seats the roof on the wall instead of
     * letting it float above it. The last row is `wall` level 0 rather than any roof value, because
     * it is not the roof: it is the eave's shade falling on the course of plaster below, and it is
     * the only shadow the building can cast on itself with `wall` repeating eighteen times.
     */
    img.rect(0, EAVE_Y, TILE, 1, shade('roof', 2));
    img.rect(0, EAVE_Y + 1, TILE, 1, shade('roof', 0));
    img.rect(0, EAVE_Y + 2, TILE, 2, SLATE_LINE);
    img.rect(0, EAVE_Y + 4, TILE, 1, shade('wall', 0));

    /*
     * The verge. `roof-peak` runs the full width of the ridge row and is laid six times, so it cannot
     * carry an end treatment: the roof's left and right silhouette is keylined on the lower row only.
     * Kept to a line and a shade rather than a barge board for the same reason -- a piece of joinery
     * that appears halfway down the roof is worse than none.
     */
    if (kind === 'left') {
      img.rect(0, 0, 1, EAVE_Y + 2, SLATE_LINE);
      img.rect(1, 0, 1, EAVE_Y + 2, shade('roof', 0));
    }
    if (kind === 'right') {
      img.rect(TILE - 2, 0, 2, EAVE_Y + 2, SLATE_LINE); // 2px: this is the lower-right edge
      img.rect(TILE - 3, 0, 1, EAVE_Y + 2, shade('roof', 0));
    }
  };
}

/* ------------------------------------------------------------------- window */

/*
 * The window, its box and its blooms.
 *
 * The board draws two of these and the map lays two, but one painter cannot be both: the left window
 * is dark blue glass in a dark room and the right is warm gold with the wolf's ears in it. Gold is
 * kept, as the painter this replaces chose it -- a blue window reads as an empty house, which is the
 * wrong note on the building Red has walked the whole map to reach, and gold is the board's own
 * colour for the lit room. The wolf is not drawn: he would appear in both windows, which gives the
 * game away two tiles early and states a narrative beat that content, not art, owns.
 *
 * The frame is the board's: dark brown, 2px, with a notched ear standing a pixel proud at each
 * corner, and the whole thing ringed in the warm keyline. There is no stone around it -- the board
 * puts dressed stone at the corners and the door ONLY (section 9.1).
 */
/*
 * The bush's top edge, column by column across the box's 22 pixels. Three fingers of different
 * heights with a notch between each -- the hand of leaves section 7.6 asks for, and never a curve.
 * The tallest finger reaches row 18, three pixels up into the glass.
 */
const BUSH_TOP = [
  23, 22, 21, 21, 22, 23, 22, 20, 19, 18, 19, 21, 23, 22, 21, 20, 21, 22, 20, 19, 21, 23,
] as const;

const cottageWindow: Painter = (img) => {
  plaster(img);

  // Keyline first, as a filled block; the frame and the glass are laid inside it. 2px on the bottom
  // and right, 1px on the top and left (section 3.2).
  img.rect(4, 1, 24, 22, WOOD_LINE);
  for (const [x, y] of [
    [4, 1],
    [26, 1],
    [4, 21],
    [26, 21],
  ] as const)
    img.rect(x, y, 2, 2, WOOD_LINE); // the ears, a pixel proud at each corner

  // Frame face: flat, with its lit top and left edge one pixel in from the keyline.
  img.rect(5, 2, 21, 19, shade('wood', 0));
  img.rect(5, 2, 21, 1, shade('wood', 1));
  img.rect(5, 2, 1, 19, shade('wood', 1));

  /*
   * Glass, four panes. The board's lit window is amber, not lemon: the glow is strongest high in
   * each pane and falls away at the bottom. The first pass filled every pane with level 2 and the
   * two windows became the brightest things on a facade that was already too pale, so the base is
   * level 1 now and level 3 is three pixels a pane.
   */
  img.rect(8, 5, 15, 13, shade('gold', 1));
  for (const [px, py] of [
    [8, 5],
    [16, 5],
    [8, 12],
    [16, 12],
  ] as const) {
    img.rect(px, py, 7, 4, shade('gold', 2));
    img.rect(px, py, 3, 1, shade('gold', 3));
    img.rect(px + 6, py + 4, 1, 2, shade('gold', 0)); // the shaded corner of the pane
  }

  // Glazing bars, in the frame's own dark: two panes across, two down.
  img.rect(15, 5, 1, 13, shade('wood', 0));
  img.rect(8, 11, 15, 1, shade('wood', 0));

  /*
   * The flower box. The board plants a dense dark bush that spills over the box, hides most of it,
   * and climbs high enough to cover the bottom of the glass -- never a stem, and never a bloom on
   * its own (section 7.6). That climb is the point: it is the one place on this elevation where a
   * dark mass crosses a light one, and it is what stops the window reading as a sticker.
   *
   * The silhouette is fingered rather than an ellipse, so the top edge is a per-column profile and
   * not a curve. Lobes that face the light AND sit in front get the lit cap; the rest get base and
   * shade (section 5).
   */
  img.rect(5, 25, 22, 5, shade('wood', 1));
  img.rect(5, 25, 22, 1, shade('wood', 2));
  img.rect(5, 29, 22, 1, shade('wood', 0));
  img.rect(4, 24, 1, 7, WOOD_LINE);
  img.rect(27, 24, 2, 7, WOOD_LINE);
  img.rect(5, 30, 23, 1, WOOD_LINE);

  for (let i = 0; i < BUSH_TOP.length; i++) {
    const x = 5 + i;
    const top = BUSH_TOP[i]!;
    img.rect(x, top, 1, 29 - top, shade('canopy', 1));
    img.rect(x, 26, 1, 3, shade('canopy', 0)); // the mass turning under, into the box
    // A lobe earns its cap only where it is climbing -- the left flank of each finger, which is the
    // side the light is on. The right flank of the same lobe gets nothing.
    if (i === 0 || top < BUSH_TOP[i - 1]!) img.px(x, top, shade('canopy', 2));
    img.px(x, top - 1, shade('shadow', 1)); // the keyline over the lobe
  }
  img.rect(5, 29, 22, 1, shade('shadow', 1));

  /*
   * Blooms: four petals and a warm centre, 5px across -- the board's are 9 to 10 on a bush of 36 to
   * 40, and this bush is 22, so they scale with it. Lilac and Haze for the petals per the rebrand
   * (section 12). The centres stay warm, from `gold`: that one warm dot is what makes a 5px bloom
   * legible on a dark bush, and it is the contrast device section 12 keeps rather than a brand
   * colour it departs from.
   */
  for (const [bx, by, ramp] of [
    [7, 21, 'cloak'],
    [13, 19, 'fur'],
    [17, 22, 'fur'],
    [22, 20, 'cloak'],
  ] as const) {
    img.rect(bx + 1, by, 1, 3, shade(ramp, 2));
    img.rect(bx, by + 1, 3, 1, shade(ramp, 2));
    img.px(bx + 1, by, shade(ramp, 3));
    img.px(bx, by + 1, shade(ramp, 3));
    img.px(bx + 1, by + 1, shade('gold', 2));
    img.px(bx + 2, by + 2, shade(ramp, 1)); // the shaded petal, under and right
  }
};

/* --------------------------------------------------------------------- door */

/*
 * The arched door, in its dressed-stone surround.
 *
 * The map lays TWO of these side by side at the foot of the facade, and a tile painter cannot know
 * which half it is, so a single 64-wide arch is not available: two identical tiles can only repeat,
 * never mirror. The board's own door is a DOUBLE door -- a seam down its middle, a brass knob on
 * each leaf -- so each tile is a complete arched leaf in its own jamb, and the pair reads as the
 * board's pair under one stone surround with the meeting stile between them.
 *
 * Everything inside the surround is decided by one radius from the arch's centre, which is what
 * keeps the voussoirs, the frame and the leaf concentric:
 *
 *   r < 10        the plank leaf
 *   10 <= r < 12  the door frame, in the wood's own dark
 *   12 <= r < 13  the warm keyline
 *   13 <= r < 16  dressed stone: voussoirs over the arch, quoins down the jambs
 *
 * Below the springing the same thresholds are read off |dx| instead, which turns the rings into
 * vertical jambs without a second set of numbers.
 */
const ARCH_CX = 16;
const ARCH_CY = 17;
const DOOR_BOTTOM = 27; // the wood ends here; the step and its keyline take the last four rows

const cottageDoor: Painter = (img) => {
  plaster(img);

  for (let y = 0; y <= DOOR_BOTTOM; y++)
    for (let x = 0; x < TILE; x++) {
      const dx = x + 0.5 - ARCH_CX;
      const dy = Math.min(0, y + 0.5 - ARCH_CY); // below the springing the arch becomes a jamb
      const r = Math.hypot(dx, dy);
      if (r >= 16) continue;
      // How squarely this pixel faces the light, for the ring's lit arc (section 4).
      const face = r > 0.5 ? (-dx - dy) / (r * Math.SQRT2) : 1;

      if (r >= 13) {
        img.px(x, y, STONE_BASE);
        if (face > 0.3) img.px(x, y, STONE_LIT);
        else if (face < -0.25) img.px(x, y, STONE_DARK);
        if (r >= 15.3) img.px(x, y, STONE_DEEP); // the joint against the plaster
      } else if (r >= 12) {
        img.px(x, y, WOOD_LINE);
      } else if (r >= 10) {
        // The frame is a round mass: lit arc on the upper left, base across, shade under (section 4).
        img.px(
          x,
          y,
          face > 0.5 ? shade('wood', 2) : face > -0.2 ? shade('wood', 1) : shade('wood', 0),
        );
      } else {
        img.px(x, y, shade('wood', 1));
      }
    }

  /*
   * Stone joints. Over the arch they run radially, every 30 degrees, which is what makes the ring
   * read as cut voussoirs rather than as a bent band -- the board's arch has five of them and they
   * are the only thing distinguishing its stone from a grey horseshoe. Down the jambs they become
   * the beds of the quoins, on the same 9px pitch the chimney's ashlar uses, so the two greys read
   * as one mason's work.
   */
  for (const deg of [-156, -126, -96, -66, -36]) {
    const a = (deg * Math.PI) / 180;
    img.line(
      ARCH_CX + Math.cos(a) * 12.6,
      ARCH_CY + Math.sin(a) * 12.6,
      ARCH_CX + Math.cos(a) * 16,
      ARCH_CY + Math.sin(a) * 16,
      STONE_DEEP,
    );
  }
  for (let y = 19; y <= DOOR_BOTTOM; y += 9) {
    img.rect(0, y, 3, 1, STONE_DEEP);
    img.rect(TILE - 3, y, 3, 1, STONE_DEEP);
    img.rect(0, y + 1, 3, 1, STONE_LIT); // the lit top of the quoin below the bed
    img.rect(TILE - 3, y + 1, 3, 1, STONE_LIT);
  }

  /*
   * The leaf: three planks, each lit down its own left edge and shaded on its right, with the seam
   * between two planks a shade line rather than a keyline (section 3.3 -- same material meeting).
   * The arch cuts their tops, so each column is painted only where the leaf already is.
   */
  for (let x = 7; x <= 25; x++) {
    const rel = (x - 7) % 6;
    const c = rel === 0 ? shade('wood', 2) : rel === 5 ? shade('wood', 0) : null;
    if (!c) continue;
    for (let y = 0; y <= DOOR_BOTTOM; y++) {
      const dx = x + 0.5 - ARCH_CX;
      const dy = Math.min(0, y + 0.5 - ARCH_CY);
      if (Math.hypot(dx, dy) < 10) img.px(x, y, c);
    }
  }

  /*
   * The brass window: a cross-muntin of four panes, exactly the board's. The panes are the one truly
   * dark thing on the elevation -- a lit room behind a door is not a thing the board draws, and the
   * dark is what the cottage's luma census is short of.
   */
  img.rect(11, 12, 11, 9, shade('gold', 1));
  img.rect(11, 12, 11, 1, shade('gold', 2));
  img.rect(11, 12, 1, 9, shade('gold', 2));
  img.rect(11, 20, 11, 1, shade('gold', 0));
  img.rect(21, 12, 1, 9, shade('gold', 0));
  for (const [px, py] of [
    [12, 13],
    [17, 13],
    [12, 17],
    [17, 17],
  ] as const) {
    img.rect(px, py, 4, 3, shade('night', 0));
    img.px(px, py + 2, shade('night', 1)); // the one streak of sky in the glass
    img.px(px + 1, py + 2, shade('night', 1));
  }
  img.rect(16, 12, 1, 9, shade('gold', 1));
  img.rect(11, 16, 11, 1, shade('gold', 1));
  img.px(16, 12, shade('gold', 2));
  img.rect(11, 16, 6, 1, shade('gold', 2));

  // The knob, on the leading edge of the leaf: a boss, lit top-left, shaded under.
  img.rect(20, 23, 3, 3, shade('gold', 1));
  img.rect(20, 23, 2, 1, shade('gold', 2));
  img.rect(20, 25, 3, 1, WOOD_LINE);
  img.rect(22, 23, 1, 3, shade('gold', 0));

  /*
   * The step. The leaf's own shadow, then a stone slab, then the keyline where the building meets
   * the grass -- the only two columns of the facade that get one, because `wall` repeats.
   */
  img.rect(0, 28, TILE, 1, STONE_DARK);
  img.rect(0, 29, TILE, 1, STONE_LIT);
  img.rect(0, 30, TILE, 1, STONE_BASE);
  img.rect(0, 31, TILE, 1, SLATE_LINE);
  img.rect(7, 28, 19, 1, WOOD_LINE);
};

/* ------------------------------------------------------------------ chimney */

/*
 * The chimney, drawn on transparency: the map puts it a row ABOVE the ridge, with grass behind it,
 * so it is the one piece here that owns a full silhouette and can be keylined with `outline()`.
 *
 * The board builds it out of large ashlar blocks, two across, each one separately jointed and lit on
 * its own top-left, under a crown slab that overhangs both sides with the flue's dark notch cut into
 * it. Proportionally the board's stack is a tenth of the cottage's width; ours is 20 of the facade's
 * 192, which is the same tenth, and that puts the blocks at 10 by 9.
 */
const chimney: Painter = (img) => {
  // Stack, 20 wide, running down into the ridge below. Ashlar: two blocks a course, bond alternating.
  img.rect(6, 7, 20, 25, STONE_BASE);
  for (let i = 0; i < 3; i++) {
    const y = 8 + i * 9;
    const off = i % 2 === 0 ? 0 : 5;
    img.rect(6, y - 1, 20, 1, STONE_DARK); // the bed joint
    for (let x = off - 10; x < 20; x += 10) {
      const bx = 6 + x;
      if (bx + 9 > 5 && bx < 26) img.rect(Math.max(6, bx + 9), y, 1, 8, STONE_DARK); // perpend
      if (bx >= 6) img.rect(bx, y, Math.min(10, 26 - bx), 1, STONE_LIT); // lit top of the block
      if (bx >= 6) img.rect(bx, y, 1, 7, STONE_LIT); // lit left face
    }
    // Two flecks a course: the board's blocks are mottled, not flat.
    img.px(10 + off, y + 4, STONE_DARK);
    img.px(19 - off, y + 6, STONE_DARK);
  }
  img.rect(25, 7, 1, 25, STONE_DARK); // the stack's shaded right face

  // Crown, overhanging the stack, with the flue's opening notched into its top.
  img.rect(3, 2, 26, 6, STONE_BASE);
  img.rect(3, 2, 26, 1, STONE_LIT);
  img.rect(3, 2, 1, 6, STONE_LIT);
  img.rect(28, 2, 1, 6, STONE_DARK);
  img.rect(3, 7, 26, 1, STONE_DARK);
  img.rect(11, 2, 10, 3, STONE_DEEP); // the flue
  img.rect(11, 2, 10, 1, shade('ink', 0));

  img.outline(SLATE_LINE);
  // outline() cannot give the 2px band on the side the light does not reach (section 3.4), so the
  // shade-side keyline is thickened by hand -- against the stack only, where the mass is 20 wide.
  // The crown is left at one pixel: a second line beside a 6px-tall overhang reads as a loose tick
  // floating off the chimney rather than as a thicker edge.
  img.rect(27, 9, 1, 23, SLATE_LINE);
};

export const COTTAGE_TILES: Record<string, Painter> = {
  wall: cottageWall,
  'wall-window': cottageWindow,
  door: cottageDoor,
  'roof-l': roof('left'),
  'roof-m': roof('middle'),
  'roof-r': roof('right'),
  'roof-peak': roof('peak'),
  chimney,
};
