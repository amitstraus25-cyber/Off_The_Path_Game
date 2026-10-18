/*
 * The built world at 32x32: Grandma's cottage, the garden fence and the river crossing.
 *
 * Redrawn from the 16px painters in `../tiles.ts` rather than scaled up. The extra pixels all go
 * into structure that 16px could only imply -- individual dressed stones, overlapping slate tabs,
 * separate door planks, pickets with a gap you can see grass through -- and none of it goes into
 * speckle, per docs/PIXEL_STANDARD.md section 1.
 *
 * Three things govern every painter here.
 *
 * ONE LIGHT, FROM THE TOP-LEFT. Top and left faces carry level 2 (and a sparing level 3); bottom
 * and right faces fall to level 0. Every joint in the masonry, every shingle lip and every plank
 * edge is lit on the same two sides, which is what makes six wall tiles and six roof tiles read as
 * one building instead of twelve squares.
 *
 * COURSES LINE UP TILE TO TILE. `wall` repeats on a 16x8 block grid, so its vertical period is 16
 * and its horizontal period is 16 -- both divide 32, so the courses run unbroken across the
 * cottage's six columns and three rows with no seam. The roof's shingle grid has a period of 8 in
 * both axes and is indexed by an absolute course number, so `roof-peak` (courses 1-3) hands over to
 * `roof-l/m/r` (courses 4-6) with the half-tab offset still alternating across the join.
 *
 * WOOD KEEPS ITS OWN BROWN. The forest is still a forest: the fence, the bridge, the door and the
 * window frames are all on the `wood` ramp. Only the roof moved, onto the deliberately-neutral
 * slate `roof` ramp, so it stops competing with Red for the eye.
 */
import { Img, shade } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/* ------------------------------------------------------------------ masonry */

/*
 * Dressed stone, 16 wide by 8 tall, running bond.
 *
 * The block size is chosen so the pattern tiles: two blocks across a tile, four courses down it,
 * and the half-block offset alternates on a 16px vertical period. A joint reads as one dark pixel
 * on the block's bottom and right and one light pixel on its top and left, which is the same
 * lighting rule as everything else here, so the whole wall shades as a single surface.
 */
const BLOCK_W = 16;
const COURSE_H = 8;

function masonry(img: Img): void {
  img.rect(0, 0, TILE, TILE, shade('wall', 1));
  for (let row = 0; row < TILE / COURSE_H; row++) {
    const y = row * COURSE_H;
    const offset = row % 2 === 0 ? 0 : BLOCK_W / 2;
    for (let bx = offset - BLOCK_W; bx < TILE + BLOCK_W; bx += BLOCK_W) {
      // Lit top and left faces of the block.
      img.rect(bx, y, BLOCK_W, 1, shade('wall', 2));
      img.rect(bx, y, 1, COURSE_H, shade('wall', 2));
      // The mortar joint: the block's own shaded bottom and right.
      img.rect(bx, y + COURSE_H - 1, BLOCK_W, 1, shade('wall', 0));
      img.rect(bx + BLOCK_W - 1, y, 1, COURSE_H, shade('wall', 0));
      // One highlight where the light actually lands, on the top-left corner of the stone.
      img.px(bx + 1, y + 1, shade('wall', 3));
    }
  }
}

/* -------------------------------------------------------------------- fence */

/*
 * A picket fence, drawn on transparency so the ground the map actually laid shows through the gaps.
 * The 16px version painted its own grass, which froze one patch of lawn into the tile and showed up
 * as a rectangle wherever the fence crossed a shaded patch.
 *
 * Pickets sit on an 8px period so `fence-h` tiles against itself and against `fence-post`.
 */
const PICKET_TOP = 5;
const PICKET_BOTTOM = 27;

function rails(img: Img): void {
  for (const y of [12, 21]) {
    img.rect(0, y, TILE, 1, shade('wood', 2));
    img.rect(0, y + 1, TILE, 1, shade('wood', 1));
    img.rect(0, y + 2, TILE, 1, shade('wood', 0));
  }
}

/** One 4px picket with a chamfered head, lit down its left edge. */
function picket(img: Img, x0: number): void {
  img.rect(x0 + 1, PICKET_TOP, 2, 1, shade('wood', 2));
  img.rect(x0, PICKET_TOP + 1, 4, PICKET_BOTTOM - PICKET_TOP, shade('wood', 1));
  img.rect(x0, PICKET_TOP + 1, 1, PICKET_BOTTOM - PICKET_TOP, shade('wood', 2));
  img.rect(x0 + 3, PICKET_TOP + 1, 1, PICKET_BOTTOM - PICKET_TOP, shade('wood', 0));
  img.px(x0 + 3, PICKET_TOP, shade('wood', 0));
  // Contact shadow, offset down-right, so the picket stands on the grass rather than floating.
  img.rect(x0 + 1, PICKET_BOTTOM + 1, 3, 1, shade('shadow', 2));
  img.rect(x0 + 2, PICKET_BOTTOM + 2, 2, 1, shade('shadow', 3));
}

const fenceRail: Painter = (img) => {
  rails(img);
  for (const x of [0, 8, 16, 24]) picket(img, x);
};

const fencePost: Painter = (img) => {
  rails(img);
  // The middle picket's slot is given over to the post, so the post reads as a thickening of the
  // run rather than as a separate object standing behind it.
  for (const x of [0, 8, 24]) picket(img, x);
  const x0 = 13;
  const w = 7;
  img.rect(x0 + 2, 2, 3, 1, shade('wood', 2));
  img.rect(x0 + 1, 3, 5, 1, shade('wood', 2));
  img.rect(x0, 4, w, PICKET_BOTTOM - 3, shade('wood', 1));
  img.rect(x0, 4, 1, PICKET_BOTTOM - 3, shade('wood', 2));
  img.rect(x0 + 1, 4, 1, 1, shade('wood', 3));
  img.rect(x0 + w - 2, 4, 2, PICKET_BOTTOM - 3, shade('wood', 0));
  img.px(x0 + w - 1, 3, shade('wood', 0));
  img.rect(x0 + 1, PICKET_BOTTOM + 1, w, 1, shade('shadow', 2));
  img.rect(x0 + 2, PICKET_BOTTOM + 2, w - 1, 1, shade('shadow', 3));
};

/* ------------------------------------------------------------------- bridge */

/*
 * The crossing. The planks are laid ACROSS the span, the way deck planks actually are, so each one
 * runs the full height of the tile and the deck is seamless where the crossing's two rows meet.
 * The gap between two planks is the dark line, and the plank period is 8, so the deck is seamless
 * left to right as well.
 *
 * Planks running along the bridge instead was tried first and came out reading as the side of a
 * barn: five tiles of unbroken horizontal boards with nothing to say which way a player walks.
 * Across the span, the plank direction itself points the way over.
 *
 * `bridge-l` and `bridge-r` carry the threshold beam where the deck meets each bank -- a heavier
 * board, bolted, with the deck's own shadow falling off it. There is deliberately no rail on the
 * top and bottom edges: the deck is two rows tall, and an edge treatment on every tile would put a
 * beam straight down the middle of the bridge.
 */
const PLANK_W = 8;

function deck(img: Img): void {
  img.rect(0, 0, TILE, TILE, shade('wood', 1));
  for (let x = 0; x < TILE; x += PLANK_W) {
    img.rect(x, 0, 1, TILE, shade('wood', 2)); // lit left edge of the board
    img.rect(x + PLANK_W - 2, 0, 1, TILE, shade('wood', 0)); // the board's shaded right edge
    img.rect(x + PLANK_W - 1, 0, 1, TILE, shade('wood', 0)); // the gap to the next board
    // Grain and a worn patch, two marks per board, each at its own height so four boards side by
    // side do not line up into a stripe across the deck.
    const k = x / PLANK_W;
    img.rect(x + 2, 6 + k * 7, 3, 1, shade('wood', 0));
  }
}

/*
 * The threshold beam where the deck meets the bank. It has to be a different WIDTH and a different
 * VALUE from a deck plank, not just a darker one: the first version was five pixels of the same
 * brown laid in the same direction and disappeared into the deck entirely.
 */
function endBeam(img: Img, side: 'left' | 'right'): void {
  const x0 = side === 'left' ? 0 : TILE - 6;
  img.rect(x0, 0, 6, TILE, shade('wood', 0));
  img.rect(x0 + 1, 0, 4, TILE, shade('wood', 1));
  img.rect(x0 + 1, 0, 1, TILE, shade('wood', 2));
  img.rect(x0 + 4, 0, 1, TILE, shade('wood', 0));
  // Bolt heads down the beam, and the shadow the beam throws onto the deck beside it.
  for (let y = 4; y < TILE; y += 9) {
    img.rect(x0 + 2, y, 2, 2, shade('stone', 1));
    img.rect(x0 + 2, y, 1, 1, shade('stone', 2));
    img.rect(x0 + 3, y + 1, 1, 1, shade('stone', 0));
  }
  if (side === 'left') img.rect(x0 + 6, 0, 1, TILE, shade('wood', 0));
  else img.rect(x0 - 1, 0, 1, TILE, shade('wood', 0));
}

function bridgePlank(kind: 'left' | 'middle' | 'right'): Painter {
  return (img) => {
    deck(img);
    if (kind === 'left') endBeam(img, 'left');
    if (kind === 'right') endBeam(img, 'right');
  };
}

/* ------------------------------------------------------------------ cottage */

const cottageWall: Painter = (img) => {
  masonry(img);
};

/*
 * The one window the player gets close to, so it carries the warmth of the house: a four-pane sash
 * lit from inside, a sill that throws its own shadow on the wall, and a planted box under it. Warm
 * amber rather than cold glass -- a blue window reads as an empty house, which is the wrong note on
 * the building Red has walked the whole map to reach.
 */
const cottageWindow: Painter = (img) => {
  masonry(img);

  // Recess: the wall's own shade behind the frame, so the opening sits back into the stone.
  img.rect(4, 2, 24, 20, shade('wall', 0));

  // Glass.
  img.rect(7, 5, 18, 14, shade('gold', 1));
  img.rect(7, 5, 18, 6, shade('gold', 2));
  img.rect(8, 5, 6, 3, shade('gold', 3));

  // Glazing bars: four panes.
  img.rect(15, 5, 2, 14, shade('wood', 0));
  img.rect(7, 11, 18, 2, shade('wood', 0));

  // Frame, two pixels thick, lit on top and left.
  img.rect(5, 3, 22, 2, shade('wood', 1));
  img.rect(5, 3, 22, 1, shade('wood', 2));
  img.rect(5, 3, 2, 18, shade('wood', 1));
  img.rect(5, 3, 1, 18, shade('wood', 2));
  img.rect(25, 3, 2, 18, shade('wood', 0));
  img.rect(5, 19, 22, 2, shade('wood', 0));

  // Sill, proud of the frame, with the wall below it in its shadow.
  img.rect(3, 21, 26, 1, shade('wood', 2));
  img.rect(3, 22, 26, 1, shade('wood', 1));
  img.rect(3, 23, 26, 1, shade('wood', 0));
  img.rect(4, 24, 26, 1, shade('wall', 0));

  // Window box: planks with visible joints, and three blooms growing out of it.
  img.rect(5, 26, 22, 5, shade('wood', 1));
  img.rect(5, 26, 22, 1, shade('wood', 2));
  img.rect(5, 30, 22, 1, shade('wood', 0));
  img.rect(26, 26, 1, 5, shade('wood', 0));
  for (const x of [11, 17, 23]) img.rect(x, 27, 1, 3, shade('wood', 0));
  img.rect(5, 31, 22, 1, shade('wall', 0)); // the box's contact shadow on the wall

  for (const [x, ramp] of [
    [8, 'cloak'],
    [15, 'gold'],
    [22, 'fur'],
  ] as const) {
    img.rect(x - 2, 25, 6, 1, shade('canopy', 1));
    img.rect(x - 2, 24, 2, 1, shade('canopy', 2));
    img.rect(x + 2, 24, 2, 1, shade('canopy', 0));
    img.rect(x - 1, 22, 3, 3, shade(ramp, 2));
    img.rect(x - 1, 22, 2, 1, shade(ramp, 3));
    img.px(x + 1, 24, shade(ramp, 1));
  }
};

/*
 * The door, in a dressed-stone surround.
 *
 * The map lays TWO of these side by side, so the tile has to be symmetric: each one is a complete
 * leaf with a jamb on both sides, and the pair reads as a double door with a stone pier between
 * them. A left-half tile would have come out backwards on the right-hand instance.
 */
const cottageDoor: Painter = (img) => {
  masonry(img);

  // Planked leaf, four boards: one lit column, four of body, one of shade. Two lit columns per
  // board turned the door into a row of bright bars that read as a gate rather than a door.
  img.rect(4, 4, 24, 28, shade('wood', 1));
  for (let x = 4; x < 28; x += 6) {
    img.rect(x, 4, 1, 28, shade('wood', 2));
    img.rect(x + 5, 4, 1, 28, shade('wood', 0));
  }

  // Two ledges across the boards, the structure that stops a plank door being a plank wall. They
  // sit in front of the planks, so they are shaded rather than lit.
  for (const y of [10, 24]) {
    img.rect(5, y, 22, 3, shade('wood', 1));
    img.rect(5, y, 22, 1, shade('wood', 2));
    img.rect(5, y + 2, 22, 1, shade('wood', 0));
  }

  // The lintel and the left jamb cast onto the leaf, which is what makes the door read as recessed.
  img.rect(4, 4, 24, 2, shade('wood', 0));
  img.rect(4, 4, 2, 28, shade('wood', 0));

  // Stone surround: jambs both sides and a lintel across the head, coursed like the wall.
  for (const x0 of [0, TILE - 4]) {
    img.rect(x0, 0, 4, TILE, shade('stone', 1));
    img.rect(x0, 0, 1, TILE, shade('stone', 2));
    img.rect(x0 + 3, 0, 1, TILE, shade('stone', 0));
    for (let y = 7; y < TILE; y += 8) img.rect(x0, y, 4, 1, shade('stone', 0));
  }
  img.rect(0, 0, TILE, 4, shade('stone', 1));
  img.rect(0, 0, TILE, 1, shade('stone', 2));
  img.rect(0, 3, TILE, 1, shade('stone', 0));
  for (const x of [10, 21]) img.rect(x, 1, 1, 2, shade('stone', 0));

  // Iron ring handle on the leaf, and the keyhole under it. A filled ring at this size came out as
  // a star, so the knob is a plain boss: dark rim, lit top-left, shaded bottom-right.
  img.ellipse(22, 18, 2.4, 2.4, shade('gold', 0));
  img.rect(21, 17, 3, 3, shade('gold', 1));
  img.rect(21, 17, 2, 1, shade('gold', 2));
  img.px(21, 17, shade('gold', 3));
  img.rect(21, 22, 2, 3, shade('wood', 0));

  // Doorstep, and the dark line where the leaf meets it.
  img.rect(4, 29, 24, 1, shade('wood', 0));
  img.rect(2, 30, 28, 1, shade('stone', 2));
  img.rect(2, 31, 28, 1, shade('stone', 1));
};

/* --------------------------------------------------------------------- roof */

/*
 * Slate.
 *
 * A slate is WIDER THAN ITS EXPOSURE -- eight pixels across, six down. Square tabs were tried and
 * came out as brickwork however they were shaded, because a grid of squares is a grid of squares.
 * Six is also why the courses are addressed by an ABSOLUTE index rather than by their position in
 * the tile: the grid no longer divides 32, so `roof-peak` (courses 1-4) has to hand the half-tab
 * offset over to `roof-l/m/r` (courses 5-8) explicitly. It can, because these four tiles are only
 * ever laid in that one arrangement -- a ridge row above an eave row.
 *
 * A slate gets brighter DOWN the tab to a lit cap on the butt, and the dark line under it is the
 * shadow that butt throws on the course below. This is the only surface in the game whose lit face
 * is the lower one; on a pitched roof the butt is the face that stands proud of the course beneath.
 */
const COURSE = 6;

function shingleCourse(img: Img, y: number, index: number): void {
  const offset = index % 2 === 0 ? 0 : 4;
  for (let x0 = offset - 8; x0 < TILE + 8; x0 += 8) {
    img.rect(x0, y, 8, 3, shade('roof', 1));
    img.rect(x0, y, 8, 1, shade('roof', 0)); // the course above, overlapping this one
    img.rect(x0, y + 3, 8, 1, shade('roof', 2));
    img.rect(x0, y + 4, 8, 2, shade('roof', 2));
    // The lit butt, kept to the left half of the tab. Running it the full width of every slate
    // turned the roof into rows of even white bars; short and left-of-centre, it reads as one light
    // catching each butt rather than as a stripe painted on it.
    img.rect(x0 + 1, y + 4, 4, 1, shade('roof', 3));
    // Rounded corners on the butt, one pixel each, so the course line below is a scallop and not a
    // ruled edge. Two pixels of rounding boxed each tab in a dark U and read as a row of jars.
    img.px(x0, y + 5, shade('roof', 0));
    img.rect(x0 + 7, y + 1, 1, 5, shade('roof', 0)); // the joint to the next slate along
  }
}

function roof(kind: 'left' | 'middle' | 'right' | 'peak'): Painter {
  return (img) => {
    img.rect(0, 0, TILE, TILE, shade('roof', 1));

    if (kind === 'peak') {
      // Ridge cap: half-round tiles laid along the crest, segmented every 8px.
      img.rect(0, 0, TILE, 1, shade('roof', 0));
      img.rect(0, 1, TILE, 1, shade('roof', 3));
      img.rect(0, 2, TILE, 2, shade('roof', 2));
      img.rect(0, 4, TILE, 3, shade('roof', 1));
      img.rect(0, 7, TILE, 1, shade('roof', 0));
      for (let x = 7; x < TILE; x += 8) img.rect(x, 1, 1, 6, shade('roof', 0));
      for (let i = 0; i < 4; i++) shingleCourse(img, 8 + i * COURSE, 1 + i);
      return;
    }

    for (let i = 0; i < 4; i++) shingleCourse(img, i * COURSE, 5 + i);

    // The eave: a fascia board standing proud of the slates, then the wall below it in its shadow.
    img.rect(0, 24, TILE, 1, shade('roof', 2));
    img.rect(0, 25, TILE, 2, shade('roof', 1));
    img.rect(0, 27, TILE, 1, shade('roof', 0));
    img.rect(0, 28, TILE, 4, shade('wall', 0));

    /*
     * Verge trim closing the gable ends, three pixels of it and no more.
     *
     * A proper barge board was drawn here first and it was wrong, because `roof-peak` runs the full
     * width of the ridge row and cannot carry one: a board on the eave row alone appears out of
     * nowhere halfway down the roof. A thin trim stops the slates running off into the grass
     * without claiming a piece of joinery that the row above does not have.
     */
    if (kind === 'left') {
      img.rect(0, 0, 1, 28, shade('roof', 0));
      img.rect(1, 0, 1, 28, shade('roof', 2));
      img.rect(2, 0, 1, 28, shade('roof', 0));
    }
    if (kind === 'right') {
      img.rect(TILE - 3, 0, 1, 28, shade('roof', 0));
      img.rect(TILE - 2, 0, 1, 28, shade('roof', 1));
      img.rect(TILE - 1, 0, 1, 28, shade('roof', 0));
    }
  };
}

/* ------------------------------------------------------------------ chimney */

/*
 * Drawn on transparency: it sits on the `below` layer one row above the ridge, with grass behind
 * it, so it needs its own silhouette. Stone rather than slate -- a chimney is the one part of the
 * roofline that is masonry.
 */
const chimney: Painter = (img) => {
  // Flue, and the dark of the opening.
  img.rect(12, 1, 8, 6, shade('stone', 1));
  img.rect(12, 1, 1, 6, shade('stone', 2));
  img.rect(19, 1, 1, 6, shade('stone', 0));
  img.rect(13, 1, 6, 2, shade('stone', 0));

  // Crown, overhanging the stack on both sides.
  img.rect(7, 5, 18, 4, shade('stone', 1));
  img.rect(7, 5, 18, 1, shade('stone', 3));
  img.rect(7, 6, 1, 3, shade('stone', 2));
  img.rect(24, 5, 1, 4, shade('stone', 0));
  img.rect(7, 8, 18, 1, shade('stone', 0));

  // Stack: coursed rubble, lit down the left third.
  img.rect(9, 9, 14, 23, shade('stone', 1));
  img.rect(9, 9, 3, 23, shade('stone', 2));
  img.rect(21, 9, 2, 23, shade('stone', 0));
  for (let y = 13; y < TILE; y += 5) {
    img.rect(9, y, 14, 1, shade('stone', 0));
    const joint = (y - 13) % 10 === 0 ? 14 : 18;
    img.rect(joint, y + 1, 1, 4, shade('stone', 0));
  }
  img.px(10, 10, shade('stone', 3));
  img.px(11, 10, shade('stone', 3));

  img.outline(shade('stone', 0));
};

export const BUILT_TILES: Record<string, Painter> = {
  'fence-h': fenceRail,
  'fence-post': fencePost,
  'bridge-l': bridgePlank('left'),
  'bridge-m': bridgePlank('middle'),
  'bridge-r': bridgePlank('right'),
  wall: cottageWall,
  'wall-window': cottageWindow,
  door: cottageDoor,
  'roof-l': roof('left'),
  'roof-m': roof('middle'),
  'roof-r': roof('right'),
  'roof-peak': roof('peak'),
  chimney: chimney,
};
