/*
 * The built world at 32x32: Grandma's cottage, the garden fence and the river crossing.
 *
 * Redrawn from the 16px painters in `../tiles.ts` rather than scaled up. The extra pixels all go
 * into structure that 16px could only imply -- individual dressed stones, overlapping slate tabs,
 * separate door planks, pickets with a gap you can see grass through -- and none of it goes into
 * speckle, per docs/PIXEL_STANDARD.md section 1.
 *
 * Four things govern every painter here.
 *
 * ONE LIGHT, FROM THE TOP-LEFT, WITH NO EXCEPTION. Top and left faces carry level 2 (and a sparing
 * level 3); bottom and right faces fall to level 0. Every joint in the masonry, every shingle lip
 * and every plank edge is lit on the same two sides, which is what makes six wall tiles and six
 * roof tiles read as one building instead of twelve squares. The roof used to be the exception,
 * lit from below; see the note above `shingleCourse` for what that cost and why it is gone.
 *
 * COURSES LINE UP TILE TO TILE. `wall` repeats on a 16x8 block grid, so both its periods are 16 --
 * 16 divides 32, so the courses run unbroken across the cottage's six columns and three rows with
 * no seam. The roof's shingle grid is 8 across and 6 down, and 6 does not divide 32, which is why
 * a course is addressed by an ABSOLUTE index rather than by its position in the tile: `roof-peak`
 * carries courses 1-4 and hands the alternating half-tab offset over to `roof-l/m/r`, which carries
 * courses 5-8. The fence has a third period again: `fence-post` is the one tile the map stacks
 * against ITSELF vertically, so its post runs the full 32 rows, edge to edge.
 *
 * WOOD KEEPS ITS OWN BROWN. The forest is still a forest: the fence, the bridge, the door and the
 * window frames are all on the `wood` ramp. Only the roof moved, onto the deliberately-neutral
 * slate `roof` ramp, so it stops competing with Red for the eye.
 *
 * ONE GREY PER BUILDING. Everything grey on the cottage -- slate, chimney, door surround -- comes
 * off the `roof` ramp; the cool `stone` ramp is undressed rock and stays out on the well and the
 * riverbed. The long note above the cottage section has the rule and the numbers behind it.
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

/*
 * The post, and the one tile in this file that has to tile against ITSELF vertically.
 *
 * `forest-map.ts` stacks `fence-post` down a single column at x=46 -- the garden's west side, nine
 * tiles of it split either side of the gate, on the approach every player walks. So the post runs
 * the FULL HEIGHT of the tile, edge to edge. It used to stand from y=2 to y=27 under a chamfered
 * head, which is a fine drawing of one post and a broken drawing of a run: stacked, it put four
 * rows of lawn through the fence at every tile boundary.
 *
 * The head went with it, and had to: a chamfer is a feature that cannot continue across the edge
 * (PIXEL_STANDARD section 5), and the top of the real run is capped by the `fence-h` corner tile
 * the map lays above the column. Nothing else is carved into the post for the same reason -- any
 * mark inside the tile becomes a dotted line repeating every 32px once nine of these are stacked.
 *
 * It carries NO rails and NO pickets. It used to keep both, on the reasoning that a horizontal
 * `fence-h | fence-post | fence-h` run should still meet on the 8px picket period -- but the map
 * never lays one: `fence-post` appears exactly nine times, all in this one column, with no two
 * instances horizontally adjacent. The rails and pickets therefore served a placement that does not
 * exist, while putting a horizontal stub out into the lawn on both sides of every tile of the
 * placement that does. A north-south fence shows its rails end-on, which is to say it shows the
 * post line and little else.
 */
const fencePost: Painter = (img) => {
  // The rail running away from the viewer, catching the light along its top edge.
  img.rect(10, 0, 3, TILE, shade('wood', 1));
  img.rect(10, 0, 1, TILE, shade('wood', 2));

  const x0 = 13;
  const w = 7;
  img.rect(x0, 0, w, TILE, shade('wood', 1));
  img.rect(x0, 0, 1, TILE, shade('wood', 2)); // lit left face
  img.rect(x0 + w - 2, 0, 2, TILE, shade('wood', 0)); // shaded right face, and the post's own edge

  // The ground shadow the run casts to its right, full height so it carries across the join.
  img.rect(x0 + w, 0, 2, TILE, shade('shadow', 2));
  img.rect(x0 + w + 2, 0, 1, TILE, shade('shadow', 3));
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

/*
 * ONE GREY PER BUILDING, AND THE COTTAGE'S GREY IS `roof`.
 *
 * The palette holds two greys in opposite casts: `stone` is cool (R = G < B) and `roof` is warm
 * (R > G > B). The cottage used to wear both -- slate on the pitch, cool `stone` on the chimney
 * standing directly on that slate and on the dressed surround set into the wall -- and two greys
 * of the same value in opposite casts on one facade do not read as two materials. They read as one
 * material mis-tinted, which is the single thing a pixel at this size cannot afford.
 *
 * The rule, which the four `COTTAGE_STONE_*` constants below exist to enforce -- they are named for
 * the cottage and not for the ramp precisely so that nobody reaches for `shade('stone', ...)` here
 * out of habit:
 *
 *   `stone` is UNDRESSED ROCK -- the well's rubble ring, boulders, the river. `roof` is the
 *   cottage's own worked stone: the slates, the chimney cut from them, the surround round the door.
 *   An object gets a second grey only when it is honestly two materials, which is why `well` in
 *   props.ts keeps its cool rubble ring under its warm slate roof and is right to.
 *
 * The worked stone is painted one step UP the ramp from the roof itself -- base at shade 2 where
 * the slates are shade 1 -- because a chimney at the slates' own value disappears into the pitch it
 * stands on and into the grass behind it (`roof` 1 is luma 114, grass 1 is 117). One step up puts
 * it back at the value the cool `stone` gave it, to within two levels at every step: 144/182
 * against 143/180. The clash goes and nothing gets dimmer.
 */
const COTTAGE_STONE_DEEP = shade('roof', 0); // openings, and the silhouette against grass
const COTTAGE_STONE_DARK = shade('roof', 1); // shaded faces and mortar joints
const COTTAGE_STONE_BASE = shade('roof', 2);
const COTTAGE_STONE_LIT = shade('roof', 3);

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

  // Worked-stone surround: jambs both sides and a lintel across the head, coursed like the wall.
  // The cottage's one grey, per the note above the cottage section -- the same stone the slates
  // overhead are cut from, not the cool rock of the well and the riverbed.
  for (const x0 of [0, TILE - 4]) {
    img.rect(x0, 0, 4, TILE, COTTAGE_STONE_BASE);
    img.rect(x0, 0, 1, TILE, COTTAGE_STONE_LIT);
    img.rect(x0 + 3, 0, 1, TILE, COTTAGE_STONE_DARK);
    for (let y = 7; y < TILE; y += 8) img.rect(x0, y, 4, 1, COTTAGE_STONE_DARK);
  }
  img.rect(0, 0, TILE, 4, COTTAGE_STONE_BASE);
  img.rect(0, 0, TILE, 1, COTTAGE_STONE_LIT);
  img.rect(0, 3, TILE, 1, COTTAGE_STONE_DARK);
  for (const x of [10, 21]) img.rect(x, 1, 1, 2, COTTAGE_STONE_DARK);

  // Iron ring handle on the leaf, and the keyhole under it. A filled ring at this size came out as
  // a star, so the knob is a plain boss: dark rim, lit top-left, shaded bottom-right.
  img.ellipse(22, 18, 2.4, 2.4, shade('gold', 0));
  img.rect(21, 17, 3, 3, shade('gold', 1));
  img.rect(21, 17, 2, 1, shade('gold', 2));
  img.px(21, 17, shade('gold', 3));
  img.rect(21, 22, 2, 3, shade('wood', 0));

  // Doorstep, and the dark line where the leaf meets it.
  img.rect(4, 29, 24, 1, shade('wood', 0));
  img.rect(2, 30, 28, 1, COTTAGE_STONE_LIT);
  img.rect(2, 31, 28, 1, COTTAGE_STONE_BASE);
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
 * ONE LIGHT, FROM THE TOP-LEFT, HERE TOO. The head of each slate takes the light and the butt
 * drops its shadow onto the course below, exactly as a stone's top and left faces are lit and its
 * bottom and right fall away. This file used to declare the roof the one exception to
 * PIXEL_STANDARD section 3 and light it from underneath -- a bright cap along the bottom of every
 * tab -- on the argument that the butt is the face standing proud of the course beneath. The
 * argument is sound for one slate and wrong for a roof: the cottage's six roof tiles sit directly
 * on six wall tiles lit the other way, and at a 26-tile camera the building stopped reading as a
 * building. It came out as a grey coursed block stacked on a cream coursed block, because
 * bottom-lit courses are exactly how the masonry below would look if you flipped its light.
 *
 * What keeps the slates from reading as more brickwork is their SHAPE, not their lighting: a slate
 * is wider than its exposure, every course breaks on the half tab where the wall's bond breaks on
 * the half block, the joints are short dashes rather than a ruled grid, and the butt is scalloped
 * -- its two corners climb two pixels -- so the line between two courses is a row of bowls where a
 * mortar joint is a rule. The roof also sits a good deal darker than it did, now that level 3 is three pixels a
 * tab instead of half the surface, which is the other half of separating it from the cream wall.
 */
const COURSE = 6;

function shingleCourse(img: Img, y: number, index: number): void {
  const offset = index % 2 === 0 ? 0 : 4;
  for (let x0 = offset - 8; x0 < TILE + 8; x0 += 8) {
    img.rect(x0, y, 8, COURSE, shade('roof', 1));
    // The head of the slate, lit, stopping a pixel short of the next tab so the light reads as a
    // row of tabs rather than as a stripe ruled across the whole roof. The highlight is kept short
    // and left of centre for the same reason.
    img.rect(x0, y, 7, 1, shade('roof', 2));
    img.rect(x0 + 1, y, 3, 1, shade('roof', 3));
    img.rect(x0, y + 1, 1, 2, shade('roof', 2)); // lit left edge
    // The butt, and the shadow it throws on the course below -- a bowl two pixels deep rather than
    // a ruled line. This is the whole difference between a roof and a wall at a 26-tile camera: a
    // mortar joint is straight, and a run of slate is a row of scallops.
    img.rect(x0 + 2, y + 5, 4, 1, shade('roof', 0));
    img.px(x0 + 1, y + 4, shade('roof', 0));
    img.px(x0 + 6, y + 4, shade('roof', 0));
    img.px(x0, y + 3, shade('roof', 0));
    img.px(x0 + 7, y + 3, shade('roof', 0));
    // The joint to the next slate along, on the shaded right, running down into the scallop. Two
    // pixels, not six: a full-height joint under a full-width course line is a grid, and a grid is
    // brickwork.
    img.rect(x0 + 7, y + 1, 1, 2, shade('roof', 0));
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
 * it, so it needs its own silhouette. Masonry rather than slate -- a chimney is the one part of
 * the roofline that is built rather than laid -- but masonry in the COTTAGE's stone, which is the
 * `roof` ramp one step up, not the cool `stone` of the well and the riverbed. See the note above
 * the cottage section: the stack stands directly on the slates it rises out of, and that contact
 * is the one place in the game where two greys of the same value in opposite casts touched.
 */
const chimney: Painter = (img) => {
  // Flue, and the dark of the opening.
  img.rect(12, 1, 8, 6, COTTAGE_STONE_BASE);
  img.rect(12, 1, 1, 6, COTTAGE_STONE_LIT);
  img.rect(19, 1, 1, 6, COTTAGE_STONE_DARK);
  img.rect(13, 1, 6, 2, COTTAGE_STONE_DEEP);

  // Crown, overhanging the stack on both sides.
  img.rect(7, 5, 18, 4, COTTAGE_STONE_BASE);
  img.rect(7, 5, 18, 1, COTTAGE_STONE_LIT);
  img.rect(7, 6, 1, 3, COTTAGE_STONE_LIT);
  img.rect(24, 5, 1, 4, COTTAGE_STONE_DARK);
  img.rect(7, 8, 18, 1, COTTAGE_STONE_DEEP);

  // Stack: coursed rubble, lit down the left. Two pixels rather than the old three: the lit band
  // is the top of the ramp now, and a third of the stack at level 3 is a fill, not a highlight.
  img.rect(9, 9, 14, 23, COTTAGE_STONE_BASE);
  img.rect(9, 9, 2, 23, COTTAGE_STONE_LIT);
  img.rect(21, 9, 2, 23, COTTAGE_STONE_DARK);
  for (let y = 13; y < TILE; y += 5) {
    img.rect(9, y, 14, 1, COTTAGE_STONE_DARK);
    const joint = (y - 13) % 10 === 0 ? 14 : 18;
    img.rect(joint, y + 1, 1, 4, COTTAGE_STONE_DARK);
  }

  img.outline(COTTAGE_STONE_DEEP);
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
