/*
 * Props, redrawn against the concept board: the stall, the lantern post, the fountain, the well and
 * the signpost.
 *
 * This is the `docs/ART_DIRECTION.md` pass over `tiles/props.ts`. The structure that file built --
 * planks with seams, stone courses, shingle courses, a windlass with rope on it -- was right and is
 * kept. What it had none of, and what section 1 of the direction names as the whole gap between our
 * build and the board, is a KEYLINE. Nothing in the old file called `outline()`; measured, these
 * tiles put well under a tenth of their pixels below L81 where a populated frame on the board puts
 * nearly a third. Every object here is now ringed.
 *
 * What was cropped from the board, and what it said:
 *
 *   stall      2240 250 470 360 @2   cream awning, four flat fold panels divided by 1px seams, a
 *                                    scalloped hem with a dark V at every join, round timber posts,
 *                                    a plank counter of round wicker baskets, a barrel, and a
 *                                    hanging sign on two metal rings from a crossbar.
 *   signpost    650 420 170 200 @5   TWO arrow boards on a capped post, pointed ends, visible grain
 *                                    and a knot. No writing on them.
 *   well       1340 500 220 260 @4   a ring of INDIVIDUAL stone blocks, each separately keylined
 *                                    with a lit top face, around a capped timber post. A bucket on
 *                                    the rim. (The board's well has no roof; ours keeps one.)
 *   lantern    2010 140 180 300 @4   a DARK slate lantern -- near-black metal with a cool grey lit
 *                                    edge -- with a warm gold pane, on a cross-arm tenoned into a
 *                                    capped post, hung on an S-hook.
 *
 * And what the board's colours measured, sampled at scale 1 with `tilecolors` so no resampling is
 * in the numbers. These are why the keyline constants below are what they are:
 *
 *   stall post edge   #010000 #000000 #452019   near-black core, warm mid-dark just inside it
 *   signpost edge     #0a0b03 #1c1306 #5c371e   same structure, same two values
 *   well mortar       #050508 #423e58           near-black core, COOL purple-cast shade inside it
 *   lantern body      #201f25 #262943 #636171   dark slate climbing to mid grey, not stone-light
 *   awning cloth      #fde7c9                   a warm cream, L232
 *
 * So the board does not draw one keyline value -- it draws a near-black line with the object's own
 * deep shade banked just inside it. That is reproduced here with `KEYLINE` plus `WOOD_DEEP` /
 * `STONE_DEEP`, and it needs no palette change: `trunk[0]` #4e3520 (L57) lands inside the direction
 * section 3.1's own measured wood band of L44-59, and `ink[3]` #543d66 (L57) is a near match in both
 * value and cast for the board's #423e58 mortar. Section 14 of the direction says wood "has to wait
 * for Ask 1"; it does not, and `trunk[0]` is the value, which is worth reporting back.
 *
 * Two standing rules this file deliberately reads against `docs/PIXEL_STANDARD.md`, both because
 * `docs/ART_DIRECTION.md` supersedes them and says so in its own section 0 table:
 *
 *   PIXEL_STANDARD section 4 "outline with the object's own dark" and "reserve `ink` for the wolf".
 *   The direction's section 3.1 asks for a dedicated line roughly 40 luma BELOW the object's own
 *   dark, and its section 14 names `ink[0]`, `ink[3]` as the values available today.
 *
 *   PIXEL_STANDARD section 2 "most of any object is level 1". The direction's section 6.1 makes
 *   ground field-led at level 3, which is what `groundUnder` below now does.
 *
 * Everything else is unchanged: one light from the top left, hard pixels, colour only ever from
 * `shade(ramp, level)`, and no partial alpha laid against transparency.
 */
import { Img, noise, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;
type Level = 0 | 1 | 2 | 3;

/* ------------------------------------------------------------------ the keyline */

/*
 * The three values the board draws its edges with. See the sampled numbers in the header.
 *
 * `KEYLINE` is the hard line itself -- near-black, and the same value for every material, which is
 * what the board does. `WOOD_DEEP` and `STONE_DEEP` are the band of the object's own deep shade
 * that sits just inside that line; they are what keep a near-black ring from reading as ink pen on
 * timber.
 */
const KEYLINE = shade('ink', 0);
const WOOD_DEEP = shade('trunk', 0);
const STONE_DEEP = shade('ink', 3);

/**
 * Ring whatever has been drawn on a transparent image in the keyline.
 *
 * `Img.outline()` cannot be used for any of this (direction section 3.4): it paints only transparent
 * pixels next to opaque ones, so it gives 1px everywhere and nothing else -- no second pixel on the
 * shade side, and nothing at all on art drawn edge to edge. This does the board's version: 1px all
 * round, and a second pixel along the bottom and along the lower-right, which is the band that seats
 * a thing on the ground rather than leaving it floating on it.
 *
 * It never paints over art. A pixel already opaque is left alone, so an interior keyline -- a basket
 * against a counter top, a post against cloth -- has to be drawn by hand where it is wanted.
 */
function keyline(img: Img, c: RGBA = KEYLINE): void {
  const solid = new Uint8Array(img.w * img.h);
  for (let i = 0; i < solid.length; i++) solid[i] = img.data[i * 4 + 3]! > 0 ? 1 : 0;
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && solid[y * img.w + x] === 1;

  // Where the shape's lower half starts, so only the LOWER right edge thickens. Section 3.2 is
  // explicit that the top and the left are never thickened.
  let top = img.h;
  let bottom = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (at(x, y)) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  const midY = (top + bottom) / 2;

  const ring: [number, number][] = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) ring.push([x, y]);
    }
  for (const [x, y] of ring) img.px(x, y, c);

  // The second pixel, on the side the light does not reach.
  for (const [x, y] of ring) {
    if (at(x, y - 1) && !at(x, y + 1)) img.px(x, y + 1, c);
    if (at(x - 1, y) && !at(x + 1, y) && y > midY) img.px(x + 1, y, c);
  }
}

/** Draw a prop on its own transparent image, ring it, and set it down on the tile. */
function stand(img: Img, draw: (s: Img) => void, w = TILE, h = TILE): void {
  const s = new Img(w, h);
  draw(s);
  keyline(s);
  img.blit(s, 0, 0);
}

/* ------------------------------------------------------------------- the ground */

/*
 * The patch of grass a ground-standing prop carries under itself.
 *
 * Still a stand-in, as it was in the file this replaces -- whoever assembles the tileset should
 * swap it for the ground group's real painter, and all these props need from it is an opaque field
 * of the right brightness. But the brightness has changed, and that is not cosmetic: direction
 * section 1's second number is that the board's lawn sits at L190 while our `grass-0` sits at L124,
 * so a prop standing on it has almost nothing to separate from. This is now field-led at level 3
 * (L192) per section 6.1, with broad chunky mottling instead of single-pixel speckle, and tufts at
 * roughly one a tile. Every blob and every tuft is drawn again at x-32 and y-32 so it continues into
 * the neighbouring tile rather than drawing the grid for you.
 */
function tuft(img: Img, x: number, y: number): void {
  for (const [bx, lean, h] of [
    [-4, -1, 7],
    [0, 0, 9],
    [4, 1, 7],
  ] as const)
    for (let i = 0; i < h; i++)
      img.px(
        x + bx + Math.round((lean * i * i) / (h * 1.4)),
        y - i,
        shade('grass', i > h - 3 ? 2 : 1),
      );
}

function groundUnder(img: Img, variant: 0 | 1 | 2 | 3, seed: number): void {
  const rnd = noise(seed);
  img.rect(0, 0, TILE, TILE, shade('grass', 3));

  // Broad soft blobs, each built from three offset lobes so its edge steps rather than curving.
  for (let i = 0; i < 3 + variant; i++) {
    const cx = rnd() * TILE;
    const cy = rnd() * TILE;
    const r = 5 + rnd() * 4;
    const c = shade('grass', rnd() > 0.45 ? 2 : 1, 130);
    for (const [jx, jy, jr] of [
      [0, 0, r],
      [r * 0.5, r * 0.3, r * 0.7],
      [-r * 0.45, r * 0.4, r * 0.6],
    ] as const)
      for (const dx of [0, -TILE, TILE])
        for (const dy of [0, -TILE, TILE])
          img.ellipse(cx + jx + dx, cy + jy + dy, jr, jr * 0.72, c);
  }

  // Tufts: a third of a tile each, never within six pixels of a corner.
  for (let i = 0; i < 1 + (variant % 2); i++) {
    const x = 8 + rnd() * (TILE - 16);
    const y = 11 + rnd() * (TILE - 14);
    for (const dx of [0, -TILE, TILE]) tuft(img, Math.round(x) + dx, Math.round(y));
  }
}

/** The flattened ellipse that stops a thing floating. Always a touch down and to the right. */
const contactShadow = (img: Img, cx: number, cy: number, rx: number, ry: number): void =>
  img.ellipse(cx, cy, rx, ry, shade('shadow', 1, 120));

/* --------------------------------------------------------------- timber helpers */

/** A vertical timber, lit per direction section 4: lit column in, base, shade down the right. */
function postV(img: Img, x: number, y: number, w: number, h: number): void {
  img.rect(x, y, w, h, shade('wood', 1));
  img.rect(x, y, 1, h, shade('wood', 2));
  img.rect(x + w - 1, y, 1, h, shade('wood', 0));
}

/** A horizontal timber. The same thing rotated: lit line on top, shade underneath. */
function beamH(img: Img, x: number, y: number, w: number, h: number): void {
  img.rect(x, y, w, h, shade('wood', 1));
  img.rect(x, y, w, 1, shade('wood', 2));
  img.rect(x, y + h - 1, w, 1, shade('wood', 0));
}

/** The cap block the board puts on top of every free-standing post, wider than the post itself. */
function capBlock(img: Img, x: number, y: number, w: number, h: number): void {
  img.rect(x, y, w, h, shade('wood', 1));
  img.rect(x, y, w, 1, shade('wood', 2));
  img.rect(x, y, 1, h, shade('wood', 2));
  img.rect(x, y + h - 1, w, 1, WOOD_DEEP);
}

/**
 * One of the board's stone blocks: a lit top-left face, base, and a mortar line down its right and
 * along its bottom. The well's ring is built of these and so is the fountain's.
 *
 * The mortar is `stone[0]`, NOT the keyline. Direction section 3.3 is explicit that two surfaces of
 * the same material which meet get a 1px shade line rather than a line, and that keyline is for the
 * silhouette against the world. Mortaring every block in `STONE_DEEP` was the first pass's mistake:
 * it put a keyline on every internal seam, took the well to 46 per cent of its pixels below L81
 * against section 15's ceiling of 30, and made the ring read as a grey donut.
 */
function block(img: Img, x: number, y: number, w: number, h: number): void {
  img.rect(x, y, w, h, shade('stone', 1));
  img.rect(x, y, w, 1, shade('stone', 2));
  img.rect(x, y, 1, h, shade('stone', 2));
  img.rect(x + w - 1, y, 1, h, shade('stone', 0));
  img.rect(x, y + h - 1, w, 1, shade('stone', 0));
}

/* ------------------------------------------------------------------ the stall */

/*
 * Awning canvas. Section 6a of docs/ART_PRODUCTION.md takes it off red and onto Haze and Offwhite,
 * so the wide panel is the palette's neutral white (`fur`) and the accent stripe is the top of
 * `cloak`. Nothing here is red and nothing here is Lime.
 *
 * The tone-down the previous pass made is kept in full and deliberately not undone. That pass found
 * the awning painted flat at level 3 across 44 to 52 per cent of each tile, carrying 1,151 purple
 * pixels to Red's 525 -- one tile off her route the awning was the most findable thing on screen and
 * the protagonist was not. The repeat is still sixteen with four pixels of Haze, the stripe body
 * still sits on Lilac under a Haze crown, and level 3 is still only that crown: measured on the
 * composed sheet it is 3 per cent of the cloth, against the direction section 5 budget of 12.
 *
 * What the board adds on top of that, and what this redraw is for:
 *
 *   The whole sheet is RINGED -- 1px along the top, 2px under the scalloped hem. That single line is
 *   most of the difference between the board's stall and ours.
 *   Each fold is a FLAT FACE, not a gradient: section 4 says one flat tone with a 1px lighter line
 *   down its left edge and a 1px shade line down its right, and the interior left alone.
 *   The scallops are broader -- about 26 of our pixels on the board, so sixteen here, which puts a
 *   scallop join on every fold seam the way the board does -- and deeper, with a hard dark notch
 *   driven up into the cloth at each join.
 *
 * And the mechanic, which is direction section 3.4 and the reason this is not three painters: the
 * three awning tiles are ONE object. They are composed on a single 104x40 image, keylined there, and
 * only then cut into tiles. Ringing each tile on its own would put a keyline down every internal
 * seam and the awning would read as three separate flags.
 */
const STRIPE_REPEAT = 16;
/*
 * Three, not four. The previous pass brought the accent down from half the cloth to four pixels in
 * sixteen and that was the right direction; this goes one further, because taking the green wash off
 * the cream lifted the panel around 40 luma and the stripe gained all of that contrast back. Three
 * in sixteen is 19 per cent of the cloth against 25, the repeat still divides the tile, and the
 * `l, m, m, r` rhythm still lands a stripe boundary on every seam. The tone-down is continued here,
 * not undone: level 3 is still the crown of the accent and nothing else.
 */
const HAZE_WIDTH = 3;

const LEVELS = [0, 1, 2, 3] as const;
/** A ramp level moved by `by` and held inside its ramp, without a cast at the call site. */
const step = (level: number, by: number, ceiling: number): Level =>
  LEVELS[Math.max(0, Math.min(ceiling, level + by))]!;

/** Where a column falls in the stripe pattern: which panel it is in, and how far into it. */
const stripeAt = (x: number): { haze: boolean; offset: number; width: number } => {
  const i = ((x % STRIPE_REPEAT) + STRIPE_REPEAT) % STRIPE_REPEAT;
  const pale = STRIPE_REPEAT - HAZE_WIDTH;
  return i < pale
    ? { haze: false, offset: i, width: pale }
    : { haze: true, offset: i - pale, width: HAZE_WIDTH };
};

/*
 * The cloth's own two ladders, pale panel and Haze stripe, dark to light.
 *
 * The pale ladder is three steps of `fur` with `wall[0]` under them, and that bottom step is the fix
 * for the worst thing in the previous render. Both the 16px set and the first 32px pass expressed
 * the sheet's fall to the hem by laying bands of `shade('shadow', 1, a)` over Offwhite -- but
 * `shadow` is the GREEN ramp, the one `paint.ts` describes as grass in shade. Measured, the most
 * common colour in the old awning tiles was #969988 and in the first pass #9c9e8d: an OLIVE, not a
 * cream. The board's cloth samples #fde7c9 top to bottom. So the fall is carried on cream's own
 * shade instead, `wall[0]` at L174, and no `shadow` touches the canvas at all.
 *
 * The pale panel never reaches `fur[3]`, which is pure white, and nothing in a forest at a 26-tile
 * camera should be pure white.
 *
 * The Haze ladder repeats `cloak[2]` at indices 1 and 2 on purpose, so the fold lift below can never
 * push the stripe to Haze anywhere but the crown: `cloak` falls from 175 to 76 between levels 2 and
 * 1, and an unbounded lift would run a line of level 3 from the crown all the way to the hem, which
 * is how an earlier pass ended up with half a tile of highlight.
 */
const PALE = [shade('wall', 0), shade('fur', 0), shade('fur', 1), shade('fur', 2)] as const;
const HAZE = [shade('cloak', 1), shade('cloak', 2), shade('cloak', 2), shade('cloak', 3)] as const;

/*
 * Row by row from the rail to the hem: [index into PALE, index into HAZE].
 *
 * The sheet is FLAT. Direction section 4 is explicit about a flat face -- one tone, a 1px lighter
 * line along its top edge, a 1px shade line along its bottom inside the keyline, and the interior
 * left alone: "resist the urge to gradient a wall; the board does not." Cropped and set beside our
 * render, the board's awning is one even cream from the rail to the hem with nothing in it but the
 * fold seams, where the version before this one fell through three tones and grew a tan band across
 * its lower third that the board has no trace of. The fall is gone. What is left is the top line,
 * the bottom line, and the per-fold lighting, which is all the board uses.
 */
const CLOTH_TOP = 7;
const CLOTH_SECTION: readonly (readonly [number, number])[] = [
  [1, 2], // the rail's shade on the cloth
  [3, 3], // the lit line along the top edge
  [2, 2], // ... and flat from here to the hem
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [2, 2],
  [1, 2], // the 1px shade line at the bottom, inside the keyline
];

/** The cloth's tone at a pixel: the row's step, lifted one on the lit edge of each fold. */
const canvasTone = (x: number, row: number): RGBA => {
  const { haze, offset } = stripeAt(x);
  const section = CLOTH_SECTION[row]!;
  const i = haze ? section[1] : section[0];
  const lit = offset === 0 ? 1 : 0;
  return haze ? HAZE[step(i, lit, 3)]! : PALE[step(i, lit, 3)]!;
};

/*
 * The scalloped hem as a depth per column rather than as a row of ellipses, so the stripes carry
 * straight down into the scallops. Sixteen wide to put a join on every fold seam, and seven deep,
 * which is what the board's hang measures once converted. The join goes to one rather than to zero:
 * taking it to zero turns the hem into a row of triangular teeth at this size.
 */
const SCALLOP = STRIPE_REPEAT;
const SCALLOP_DEEP = 7;
const scallopDepth = (x: number): number => {
  const u = ((((x % SCALLOP) + SCALLOP) % SCALLOP) + 0.5) / (SCALLOP / 2) - 1;
  return 1 + Math.round((SCALLOP_DEEP - 1) * Math.sqrt(Math.max(0, 1 - u * u)));
};

/*
 * The composed awning. One image, three tiles wide, with a transparent margin round it so the ring
 * has somewhere to land, and the cloth inset one pixel at each end so the outer keyline falls inside
 * the first and last tile rather than outside them.
 */
const AWN_M = 4;
const AWN_SPAN = TILE * 3;
const AWN_INSET = 1;

function paintAwningSheet(): Img {
  const s = new Img(AWN_SPAN + AWN_M * 2, TILE + AWN_M * 2);
  const x0 = AWN_M + AWN_INSET;
  const x1 = AWN_M + AWN_SPAN - AWN_INSET; // exclusive
  const width = x1 - x0;
  const row = (y: number): number => AWN_M + y;

  // The cloth, row by row down its section. `tx` is the tile-relative column, so the stripe pattern
  // and the scallops repeat identically across all three tiles.
  for (let r = 0; r < CLOTH_SECTION.length; r++)
    for (let x = x0; x < x1; x++) s.px(x, row(CLOTH_TOP + r), canvasTone(x - AWN_M, r));

  // Each fold is a flat face: a lighter line already runs down its left in `canvasTone`, and this is
  // the 1px shade line down its right. Direction section 4 leaves the interior flat.
  for (let x = x0; x < x1; x++) {
    const { offset, width: w } = stripeAt(x - AWN_M);
    // `PALE[1]`, not `PALE[0]`: cream's own shade down a full-height column read as a tan batten
    // nailed over the awning. One step is a fold; two is a plank.
    if (offset === w - 1) s.rect(x, row(CLOTH_TOP), 1, CLOTH_SECTION.length, PALE[1]!);
  }

  /*
   * The scallops hanging off the hem, in the same cloth and the same stripes so the pattern carries
   * straight down into them, and one step LIGHTER than the sheet just above: they are the turn-under,
   * and on the board they tilt toward the viewer and catch the light while the sheet above them is
   * sloping away. Run the other way -- a dark hem band over bright scallops, which is what the first
   * attempt drew -- and the awning reads as a dark pelmet with a bright fringe under it.
   *
   * The V-notch the board drives up into the cloth at every join is not drawn: the hem profile goes
   * down to a single row at the join and the ring dips up into it on its own.
   */
  const HEM = CLOTH_TOP + CLOTH_SECTION.length;
  for (let x = x0; x < x1; x++) {
    const depth = scallopDepth(x - AWN_M);
    const { haze } = stripeAt(x - AWN_M);
    for (let i = 0; i < depth; i++) {
      // A shade line where the sheet turns under, the same flat cloth across the face, and a shade
      // line at the bottom inside the keyline. Those two lines are what make the scallops read as
      // their own plane without having to brighten them away from the sheet.
      const edge = i === 0 || i === depth - 1;
      s.px(x, row(HEM + i), edge ? (haze ? HAZE[1]! : PALE[1]!) : canvasTone(x - AWN_M, 4));
    }
  }

  // The front rail the canvas is tacked to, and the hard line it throws on the cloth under it.
  beamH(s, x0, row(3), width, 4);
  s.rect(x0, row(6), width, 1, WOOD_DEEP);

  /*
   * The corner posts. Each carries its own interior keyline down the edge that meets cloth, because
   * the ring only reaches pixels that are transparent -- above the hem the post's inner edge is
   * against opaque canvas and the ring cannot see it.
   */
  const POST_W = 5;
  const postTop = row(2);
  const postH = TILE + AWN_M - 2 - 2;

  postV(s, x0, postTop, POST_W, postH);
  capBlock(s, x0, postTop, POST_W, 2);
  s.rect(x0 + POST_W, postTop, 1, postH, KEYLINE);
  s.line(x0 + POST_W, row(11), x0 + POST_W + 6, row(6), WOOD_DEEP);
  s.line(x0 + POST_W, row(10), x0 + POST_W + 5, row(6), shade('wood', 1));

  const rx = x1 - POST_W;
  postV(s, rx, postTop, POST_W, postH);
  capBlock(s, rx, postTop, POST_W, 2);
  s.rect(rx - 1, postTop, 1, postH, KEYLINE);
  s.line(rx - 1, row(11), rx - 7, row(6), WOOD_DEEP);
  s.line(rx - 1, row(10), rx - 6, row(6), shade('wood', 1));

  keyline(s);
  return s;
}

let awningSheet: Img | undefined;

/** Cut one tile out of the composed sheet. The sheet is built once and all three tiles share it. */
const stallAwning =
  (slot: 0 | 1 | 2): Painter =>
  (img) => {
    awningSheet ??= paintAwningSheet();
    const sheet = awningSheet;
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const c = sheet.get(AWN_M + slot * TILE + x, AWN_M + y);
        if (c[3] !== 0) img.px(x, y, c);
      }
  };

/**
 * The counter: a plank front with a knot in it, a lipped top, and round wicker baskets of goods
 * standing on it, which is what the board puts there.
 *
 * Four of these sit side by side, so the body is drawn edge to edge across the full width and the
 * ring finds no transparent pixel to its left or right -- the counter carries no vertical keyline
 * and runs unbroken across the stall, exactly as it should. Only its top, its bottom, its legs and
 * the baskets standing proud of it get ringed.
 */
const stallCounter: Painter = (img) => {
  groundUnder(img, 1, 4301);
  /*
   * The ground behind the counter is under the awning, so it is in shade. This is also what ties the
   * two tiles together: the awning tile's posts stop at its own bottom edge, ten pixels above the
   * counter top, and a band of full sunlight in that gap made the awning look like it was floating
   * over a separate table.
   */
  img.rect(0, 0, TILE, 10, shade('shadow', 1, 104));
  // The stall's own shade on the grass, before anything stands in it.
  img.ellipse(16, 29, 15, 3.4, shade('shadow', 1, 110));

  stand(img, (s) => {
    // Legs, then the board that laps over them.
    for (const lx of [4, 23]) {
      s.rect(lx, 25, 5, 4, shade('wood', 0));
      s.rect(lx, 25, 1, 4, WOOD_DEEP);
    }

    /*
     * Front boards, running the length of the stall the way a counter front is built. Vertical
     * panels came out as sixteen identical cupboard doors with a handle in one of them.
     */
    s.rect(0, 15, TILE, 10, shade('wood', 1));
    for (const by of [15, 19, 22]) {
      s.rect(0, by, TILE, 1, shade('wood', 2));
      s.rect(0, by + 2, TILE, 1, shade('wood', 0));
    }
    // Grain, two pegs, and a knot low on the bottom board where nothing reads it as a handle.
    for (const [gx, gy, gw] of [
      [3, 17, 7],
      [19, 20, 8],
      [24, 16, 5],
    ] as const)
      s.rect(gx, gy, gw, 1, shade('wood', 0, 150));
    s.ellipse(11, 23.5, 1.6, 1.2, shade('wood', 0));
    s.px(11, 23, shade('wood', 2));
    for (const px0 of [6, 25]) {
      s.px(px0, 20, shade('wood', 0));
      s.px(px0, 19, shade('wood', 2));
    }
    // The deep shade banked inside the keyline along the bottom of the front.
    s.rect(0, 24, TILE, 1, WOOD_DEEP);

    // The top: a lit surface with a dark lip under its front edge.
    s.rect(0, 10, TILE, 4, shade('wood', 2));
    s.rect(0, 10, TILE, 1, shade('wood', 3));
    s.rect(0, 14, TILE, 1, WOOD_DEEP);

    /*
     * Goods. The board sets out round wicker baskets in a row, so these are baskets: a rim, a darker
     * well inside it, and something in the well. Two of them at different sizes with the gap between
     * them drawn in, because four tiles of one basket twice over would be a row of eight identical
     * lids.
     */
    const basket = (cx: number, cy: number, r: number, fill: RGBA): void => {
      s.ellipse(cx, cy, r, r * 0.78, shade('wood', 1));
      s.ellipse(cx, cy, r - 1, r * 0.78 - 1, shade('wood', 0));
      s.ellipse(cx, cy + 0.4, r - 1.6, r * 0.78 - 1.6, fill);
      // The lit arc on the rim's upper left, one pixel in from the edge.
      s.line(cx - r + 1, cy - 1, cx - 1, cy - r * 0.78 + 0.5, shade('wood', 3));
      // Weave: short dashes round the rim, never a full ring.
      for (let a = 0; a < 6; a++) {
        const t = (a / 6) * Math.PI * 2;
        s.px(cx + Math.cos(t) * (r - 0.5), cy + Math.sin(t) * (r * 0.78 - 0.5), shade('wood', 0));
      }
    };
    /*
     * Three baskets, and the third one straddles the tile edge -- drawn once at cx 31.5 and again at
     * cx -0.5, so the two halves meet when the tiles abut and the eye reads a continuous row rather
     * than a motif.
     *
     * Composed and looked at as the four tiles the map actually lays down, the first version of this
     * was wallpaper: an identical gold basket, tan basket and bright blue jar, four times over on a
     * perfectly regular beat, with the jar advertising the repeat from across the clearing. Section
     * 11 is the rule it broke -- a tile used this often cannot be individually interesting. So the
     * jar is gone, the two baskets are close in tone, and the straddling one breaks the beat. The
     * board does the same thing: a row of similar round baskets, not a pattern.
     */
    basket(8, 6.5, 4.6, shade('gold', 1));
    s.px(7, 5.5, shade('gold', 2));
    s.px(9, 6.5, shade('gold', 2));
    basket(19, 7, 4, shade('path', 1));
    s.px(18, 6, shade('path', 2));
    for (const cx of [-0.5, 31.5]) {
      basket(cx, 6, 4.4, shade('gold', 1));
      s.px(cx - 1, 5, shade('gold', 2));
    }

    // The interior keyline under each basket, which the ring cannot reach: they stand on opaque top.
    for (const [bx, bw, by] of [
      [3, 11, 11],
      [15, 9, 11],
      [27, 5, 10],
      [0, 4, 10],
    ] as const)
      s.rect(bx, by, bw, 1, WOOD_DEEP);
  });

  // What the goods throw onto the counter top.
  img.ellipse(8, 11.6, 5, 0.9, shade('wood', 0, 120));
  img.ellipse(21, 11.6, 4, 0.9, shade('wood', 0, 120));
};

/* ------------------------------------------------------------ the lantern post */

/*
 * The lantern post. The flame stays warm gold: it is a light source and it is the skill the Keeper
 * offers, and section 6a of docs/ART_PRODUCTION.md leaves it alone on purpose while everything else
 * moves off red. So the gold here is the one warm note in the tile, and the pool of light under it
 * is the reason the post is worth a whole tile rather than a silhouette.
 *
 * The lantern itself is rebuilt off the board, where it is DARK metal -- sampled #201f25, #262943
 * and #636171 -- with only a cool grey lit edge, not the mid-grey `stone` box the old painter drew.
 * A pale lantern cannot hold a gold pane; a near-black one can, and that is the whole point of it.
 */
const lanternPost: Painter = (img) => {
  groundUnder(img, 0, 9173);

  /*
   * The pool, in four falling steps so the light has an edge that is not a ring. Alpha over the
   * opaque grass above, which is what PIXEL_STANDARD section 4 allows.
   */
  img.ellipse(10, 26, 13, 6, shade('gold', 3, 52));
  img.ellipse(10, 26, 10, 4.6, shade('gold', 3, 68));
  img.ellipse(10, 26.5, 6.5, 3, shade('gold', 2, 76));
  img.ellipse(10, 27, 3.5, 1.6, shade('gold', 2, 92));

  contactShadow(img, 17.5, 29.5, 4.8, 1.6);

  stand(img, (s) => {
    /*
     * Post, cap block, and a little grain. The post was four pixels wide and the arm four deep on
     * the first pass, which made the two the same mass and the arm stopped reading as a cantilever.
     * The post is three now and the arm sits a row clear of the cap, with its own keyline under it.
     */
    postV(s, 16, 6, 3, 23);
    capBlock(s, 15, 3, 5, 3);
    for (const gy of [15, 21, 26]) s.px(17, gy, shade('wood', 0));
    s.rect(16, 28, 3, 1, WOOD_DEEP);

    // The cross-arm, tenoned into the post, with its end face showing at the tip.
    beamH(s, 7, 7, 12, 3);
    s.rect(7, 7, 1, 3, shade('wood', 2));
    s.rect(7, 9, 12, 1, WOOD_DEEP);
    s.line(14, 13, 17, 10, WOOD_DEEP);
    s.line(14, 12, 16, 10, shade('wood', 1));

    // The S-hook the lantern hangs on.
    s.rect(10, 10, 1, 2, shade('stone', 1));
    s.px(11, 10, shade('stone', 0));
    s.px(10, 12, shade('stone', 0));

    /*
     * The lantern: a pitched metal cap, a glazed box, a foot. Near-black body with a cool grey lit
     * edge down its left, which is what the board draws, so the gold pane is the brightest thing in
     * the tile by a long way.
     */
    for (let r = 0; r < 3; r++) {
      s.rect(7 - r, 12 + r, 7 + r * 2, 1, STONE_DEEP);
      s.rect(7 - r, 12 + r, 2, 1, shade('stone', 0));
    }
    s.rect(6, 15, 9, 1, shade('stone', 0));
    s.px(6, 15, shade('stone', 1));

    // The glazed box: dark uprights, gold between them.
    s.rect(7, 16, 7, 6, shade('gold', 0));
    s.rect(7, 16, 1, 6, shade('stone', 0));
    s.rect(13, 16, 1, 6, STONE_DEEP);
    s.rect(8, 16, 5, 1, STONE_DEEP);
    // The flame, and what it throws on the glass behind it.
    s.ellipse(10.5, 19.4, 2.4, 2.8, shade('gold', 1));
    s.ellipse(10.5, 19.4, 1.6, 2, shade('gold', 2));
    s.ellipse(10.5, 19.8, 0.9, 1.4, shade('gold', 3));

    // The foot.
    s.rect(6, 22, 9, 2, STONE_DEEP);
    s.rect(6, 22, 5, 1, shade('stone', 0));
  });

  // The post catches the lantern on its lit side.
  img.rect(16, 16, 1, 7, shade('gold', 2, 90));
};

/* --------------------------------------------------------------- the fountain */

/*
 * A fountain in a glade: a basin, a spout and falling water. Scenery, and nothing more.
 *
 * FLAGGED: there is no fountain anywhere on the concept board. This is the one tile here with no
 * reference to match, so rather than invent a style for it, it is built out of the board's own
 * vocabulary -- the same individually keylined stone blocks the well's ring is made of, the same
 * lit top-left face on each, the same ring round the whole -- and the `water` ramp for everything
 * wet. If the board is ever extended to cover it, this is the tile to re-check first.
 */
const fountain: Painter = (img) => {
  groundUnder(img, 2, 5519);
  contactShadow(img, 16.5, 29, 13, 3);

  stand(img, (s) => {
    // Basin wall, as a course of blocks rather than a smooth bowl.
    s.ellipse(16, 24.5, 13, 5.4, shade('stone', 1));
    for (const [bx, bw] of [
      [4, 7],
      [11, 7],
      [18, 7],
      [25, 6],
    ] as const) {
      const t = (bx + bw / 2 - 16) / 13;
      const drop = Math.round(5 * Math.sqrt(Math.max(0, 1 - t * t)));
      if (drop < 2) continue;
      block(s, bx, 22, bw, drop + 3);
    }
    // Hold the course inside the basin's round footprint.
    for (let y = 22; y < 31; y++)
      for (let x = 0; x < TILE; x++) {
        const dx = (x + 0.5 - 16) / 13;
        const dy = (y + 0.5 - 24.5) / 5.4;
        if (dx * dx + dy * dy > 1) s.px(x, y, [0, 0, 0, 0]);
      }

    // Rim, then the water inside it. Water takes `water[1]` with one lit sweep, not a field of
    // `water[3]`: a basin of highlight read as a dish of foil.
    s.ellipse(16, 21, 13, 4.2, shade('stone', 0));
    s.ellipse(16, 20.8, 12.2, 3.4, shade('stone', 2));
    s.ellipse(16, 21.3, 9.6, 2.6, shade('stone', 0));
    s.ellipse(16, 21.4, 9, 2.2, shade('water', 1));
    s.ellipse(12.5, 20.6, 3.2, 0.9, shade('water', 2));
    s.line(19, 22, 22, 22, shade('water', 2));

    // Pedestal and upper bowl.
    s.rect(14, 13, 5, 8, shade('stone', 1));
    s.rect(14, 13, 1, 8, shade('stone', 2));
    s.rect(18, 13, 1, 8, shade('stone', 0));
    s.rect(12, 11, 9, 2, shade('stone', 1));
    s.rect(12, 11, 9, 1, shade('stone', 2));
    s.rect(12, 12, 9, 1, shade('stone', 0));
    s.ellipse(16, 10, 8, 2.8, shade('stone', 0));
    s.ellipse(16, 9.6, 7.2, 2.2, shade('stone', 2));
    s.ellipse(16, 9.9, 5.6, 1.4, shade('stone', 0));
    s.ellipse(16, 10, 5, 1, shade('water', 1));
    s.ellipse(13.8, 9.7, 1.6, 0.6, shade('water', 2));

    /*
     * The jet. Four pixels of spray either side made a spiky crown that read as a thistle rather
     * than as water, so it is a short plume now -- a lit column out of the finial, two beads at the
     * top of the arc, and nothing else.
     */
    s.rect(15, 5, 3, 5, shade('stone', 1));
    s.rect(15, 5, 1, 5, shade('stone', 2));
    s.rect(17, 5, 1, 5, shade('stone', 0));
    s.ellipse(16.5, 4.2, 2.4, 1.2, shade('stone', 2));
    s.rect(16, 1, 1, 3, shade('water', 2));
    s.px(16, 1, shade('water', 3));
    // One bead either side at the foot of the arc. Two pairs made a trident.
    s.px(15, 4, shade('water', 2));
    s.px(18, 4, shade('water', 2));

    /*
     * Two falls from the bowl's lip into the basin. An unbroken column from lip to waterline read as
     * a blue post holding the bowl up; water falling this short a distance breaks up, so the column
     * breaks up -- solid where it leaves the lip, then beads, then a splash where it lands.
     */
    for (const fx of [10, 22]) {
      s.rect(fx, 11, 1, 3, shade('water', 1));
      s.px(fx, 11, shade('water', 2));
      for (const dy of [15, 17] as const) s.px(fx, dy, shade('water', 2));
      s.px(fx - 1, 19.5, shade('water', 2));
      s.px(fx + 1, 19.5, shade('water', 2));
    }
  });
};

/* ------------------------------------------------------------------- the well */

/*
 * The well: stone, a shingled roof on two posts, a windlass with the rope wound on it, and a bucket.
 *
 * The board's own well is a ring of INDIVIDUAL blocks -- each one separately keylined, each lit on
 * its top face, laid in two staggered courses -- around a capped timber post, and that is the thing
 * the old painter missed: it drew two smooth ellipses with joint lines scratched on afterwards. The
 * ring is built of `block()` here, the same helper the fountain uses, so the two agree.
 *
 * The board's well has no roof. Ours keeps one, because the brief asks for it and because section 6a
 * sends it onto slate with the cottage roof, painted from the same `roof` ramp so the two roofs in
 * this world stay the same roof. Its courses now carry the per-tile lit cap that section 9.1 says is
 * what makes a roof read as tiles rather than as scalloped wallpaper.
 */
const well: Painter = (img) => {
  groundUnder(img, 1, 7741);
  contactShadow(img, 16.5, 30, 12, 2.8);

  stand(img, (s) => {
    // Posts first; the roof sits on them and the stonework laps over their feet.
    for (const px0 of [5, 24]) {
      postV(s, px0, 9, 3, 17);
      s.rect(px0, 25, 3, 1, WOOD_DEEP);
    }

    // Pitched roof: eight courses, each two pixels wider on a side than the one above it.
    for (let r = 0; r < 8; r++) {
      const y = 2 + r;
      const half = 1 + r * 2;
      const x0 = 16 - half;
      const w = half * 2;
      s.rect(x0, y, w, 1, shade('roof', 1));
      s.rect(x0, y, Math.max(2, Math.round(w * 0.3)), 1, shade('roof', 2));
      s.rect(x0 + w - 2, y, 2, 1, shade('roof', 0));
    }
    /*
     * Shingle courses: a seam line, then the lit cap on each shingle's own top-left, which section
     * 9.1 says is the thing that makes a roof read as tiles rather than as wallpaper. The caps are
     * staggered half a shingle course to course -- set on the same beat in every course they came
     * out as a chequerboard net rather than as overlapping tiles.
     */
    for (const [i, y] of [4, 6, 8].entries()) {
      const half = 1 + (y - 2) * 2;
      const x0 = 16 - half;
      const w = half * 2;
      s.rect(x0, y, w, 1, shade('roof', 0));
      for (let x = x0 + (i % 2 ? 2 : 0); x < x0 + w - 1; x += 5)
        s.rect(x, y + 1, 2, 1, shade('roof', 3));
    }
    s.rect(14, 2, 4, 1, shade('roof', 3));
    // The eave, and the dark fascia under it. Slate's own dark -- a cool keyline band here read as a
    // purple stripe across the widest line in the tile, and a fascia running the full span put the
    // well six points over section 15's dark census on its own.
    s.rect(1, 10, 30, 1, shade('roof', 0));
    s.rect(4, 11, 24, 1, shade('roof', 0));

    // Windlass: a drum with the rope wound round it, and a crank on the right.
    beamH(s, 7, 14, 18, 4);
    s.rect(7, 17, 18, 1, WOOD_DEEP);
    // One lit pixel over one dark one per coil. Two pixels of bright hemp turned it into a corn cob.
    for (let x = 9; x < 24; x += 3) {
      s.px(x, 15, shade('path', 1));
      s.px(x, 16, shade('path', 0));
    }
    s.rect(25, 15, 4, 1, shade('wood', 0));
    s.rect(28, 15, 2, 4, shade('wood', 1));
    s.rect(28, 15, 1, 4, shade('wood', 2));

    /*
     * The stonework, as the board lays it: two staggered courses of blocks, each with its own lit
     * top face and its own mortar line down the right and along the bottom.
     */
    s.ellipse(16, 25.2, 12, 4.6, shade('stone', 1));
    for (const [bx, bw] of [
      [5, 7],
      [12, 6],
      [18, 6],
      [24, 5],
    ] as const)
      block(s, bx, 23, bw, 5);
    for (const [bx, bw] of [
      [7, 6],
      [13, 7],
      [20, 6],
    ] as const)
      block(s, bx, 27, bw, 3);
    // Hold the courses inside the well's round footprint.
    for (let y = 23; y < 31; y++)
      for (let x = 0; x < TILE; x++) {
        const dx = (x + 0.5 - 16) / 12;
        const dy = (y + 0.5 - 25.2) / 4.9;
        if (dx * dx + dy * dy > 1) s.px(x, y, [0, 0, 0, 0]);
      }

    /*
     * The rim, and the dark the bucket goes down into. The mouth was seventeen pixels of pure `night`
     * on an earlier pass and it swallowed the tile: at a 26-tile camera the well read as a black blot
     * with a roof over it. It is narrower, and there is water a little way down it.
     */
    s.ellipse(16, 22, 12, 3.8, shade('stone', 0));
    s.ellipse(16, 21.8, 11, 3, shade('stone', 2));
    for (const jx of [7, 12, 17, 22]) s.line(jx, 20, jx, 23, shade('stone', 1));
    // A shaft, not a hole: the lit stone of the far wall first, then the dark a little way down. The
    // mouth was seventeen pixels of pure `night` on an earlier pass and swallowed the whole tile.
    s.ellipse(16, 22.2, 6.6, 1.9, shade('stone', 0));
    s.ellipse(16, 22.6, 5.4, 1.4, shade('night', 1));

    /*
     * Rope and bucket last, in front of the stonework -- drawn before it, the rim ellipse painted
     * straight over both and left a windlass winding nothing. The bucket is narrow and tapered with
     * its hoops in its own dark: nine pixels wide with pale bands it read as a plank laid across the
     * mouth, with the shaft showing either side of it as two black wings.
     */
    s.rect(16, 18, 1, 3, shade('path', 1));
    s.rect(17, 18, 1, 3, shade('path', 0));
    s.line(14, 20, 16, 18, WOOD_DEEP);
    s.line(17, 18, 19, 20, WOOD_DEEP);
    s.rect(14, 20, 5, 5, shade('wood', 1));
    s.rect(14, 20, 1, 5, shade('wood', 2));
    s.rect(18, 20, 1, 5, shade('wood', 0));
    for (const hy of [21, 24]) s.rect(14, hy, 5, 1, WOOD_DEEP);
    // The bucket's own keyline, which the ring cannot reach: it hangs against opaque stone.
    s.rect(13, 20, 1, 5, KEYLINE);
    s.rect(19, 20, 1, 5, KEYLINE);
    s.rect(14, 25, 5, 1, KEYLINE);
  });
};

/* --------------------------------------------------------------- the signpost */

/*
 * The signpost, rebuilt from the board: TWO arrow boards on a capped post, the upper one pointed at
 * both ends and the lower one pointing back the way you came, each board showing grain and a knot.
 *
 * The old painter drew one board with rows of dashes on it standing in for writing. The board draws
 * no writing -- it draws grain -- and rule 4 of CLAUDE.md keeps text off the canvas anyway, so the
 * dashes are gone and the grain is what is there instead. It is also the honest thing at this size:
 * a legible word would be a smear.
 */

/** One arrow board: a plank with a chevron point on the ends that are pointed. */
function arrowBoard(
  s: Img,
  y: number,
  h: number,
  left: number,
  right: number,
  tips: { left: boolean; right: boolean },
): void {
  const mid = y + (h - 1) / 2;
  for (let row = 0; row < h; row++) {
    // 1.5 rather than 1: a taper of one pixel a row makes a hexagon, not an arrow.
    const taper = Math.round(Math.abs(y + row - mid) * 1.5);
    const x0 = left + (tips.left ? taper : 0);
    const x1 = right - (tips.right ? taper : 0);
    s.rect(x0, y + row, x1 - x0 + 1, 1, shade('wood', 1));
    if (row === 0) s.rect(x0, y + row, x1 - x0 + 1, 1, shade('wood', 2));
    if (row === h - 1) s.rect(x0, y + row, x1 - x0 + 1, 1, shade('wood', 0));
    s.px(x0, y + row, shade('wood', 2));
    s.px(x1, y + row, WOOD_DEEP);
  }
}

const signpost: Painter = (img) => {
  groundUnder(img, 2, 2207);
  contactShadow(img, 17, 29.5, 6, 2);

  stand(img, (s) => {
    // Post, with a cap block on top the way the board caps every free-standing post.
    postV(s, 13, 6, 5, 23);
    capBlock(s, 12, 3, 7, 4);
    for (const gy of [17, 26] as const) s.rect(14, gy, 2, 1, shade('wood', 0));
    s.rect(13, 28, 5, 1, WOOD_DEEP);

    // The upper board, pointed at both ends: the fork.
    arrowBoard(s, 9, 7, 1, 30, { left: true, right: true });
    // The lower board, pointing back the way you came.
    arrowBoard(s, 19, 6, 3, 26, { left: true, right: false });

    // Grain, and a knot in each board. Short strokes, never a full-length line.
    for (const [gx, gy, gw] of [
      [6, 11, 6],
      [18, 13, 7],
      [8, 21, 5],
      [17, 22, 6],
    ] as const)
      s.rect(gx, gy, gw, 1, shade('wood', 0, 140));
    for (const [kx, ky] of [
      [23, 11],
      [11, 22],
    ] as const) {
      s.ellipse(kx, ky, 1.4, 1, shade('wood', 0));
      s.px(kx, ky - 1, shade('wood', 2));
    }

    // The nails holding each board to the post.
    for (const [nx, ny] of [
      [14, 11],
      [16, 15],
      [14, 21],
    ] as const) {
      // A nail head is iron catching the light with its own dark under it. In `STONE_DEEP` alone it
      // read as a blue speck on brown.
      s.px(nx, ny, shade('stone', 1));
      s.px(nx, ny + 1, WOOD_DEEP);
    }

    // Each board throws a hard line onto the post below it.
    s.rect(13, 16, 5, 2, WOOD_DEEP);
    s.rect(13, 25, 5, 2, WOOD_DEEP);
    // And the interior keyline where the boards cross the post.
    s.rect(13, 8, 5, 1, KEYLINE);
    s.rect(13, 18, 5, 1, KEYLINE);
  });

  // A couple of blades at the foot, so the post grows out of the grass instead of onto it.
  for (const [bx, by] of [
    [12, 28],
    [20, 29],
  ] as const) {
    img.px(bx, by, shade('grass', 2));
    img.px(bx, by + 1, shade('grass', 1));
  }
};

/** Keys are the contract the map generator and the tileset both look these up by. */
export const PROP_TILES: Record<string, Painter> = {
  'stall-awning-l': stallAwning(0),
  'stall-awning-m': stallAwning(1),
  'stall-awning-r': stallAwning(2),
  'stall-counter': stallCounter,
  'lantern-post': lanternPost,
  fountain,
  well,
  signpost,
};
