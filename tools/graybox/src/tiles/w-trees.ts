/*
 * The tree: one 64x64 crown cut into four canopy quarters over one 64x32 trunk cut into two
 * halves. Redrawn against `reference/mocks/gameplay-concepts.png` and docs/ART_DIRECTION.md.
 *
 * Three things the board does that the previous pass did not, in the order they matter.
 *
 * **The dark.** Measured over a 140x105 crop of a board crown, 50 per cent of the crown is below
 * luma 81 and 36 per cent below luma 60, against 8.6 and 0.7 per cent across our whole shipped
 * tileset; the darkest pixel in the shipped `canopy-*` group is L92 where the board's crown spends
 * a third of its area beneath that. The board's crown is, by area, a deep teal mass with bright
 * green lobes sitting on its lit side -- not a green mass with shading. So the leaf ladder here is
 * seven steps, `shadow` 0..2 carrying the whole dark half and `canopy` 0..3 the light half, and
 * most clumps in the lower-right of the crown are painted ENTIRELY out of the `shadow` end.
 *
 * **The keyline.** Every mass on the board is ringed in a hard near-black line (sampled #040b17
 * on leaves, #020304 on bark), 1 px, thickening to 2 px along the bottom. `Img.outline()` only
 * paints transparent pixels next to opaque ones, so calling it per tile would ring each of the six
 * tiles separately and the tree would come out quilted. ART_DIRECTION section 3.4 is the recipe
 * and this file follows it: the crown is drawn once at 64x76 and the trunk once at 64x32, each is
 * outlined and seated on its own scratch, and the tile painters only ever cut from those two
 * drawings. No quadrant knows it is a quadrant, so no seam can drift.
 *
 * **The root flare.** The board's trunk is 21 of our pixels wide where it leaves the crown and 43
 * at the ground, splayed into five fingers each separately keylined and each lit along its top.
 * That flare is most of what makes the board's trees look drawn rather than generated. The shipped
 * `trunk-l`/`trunk-r` pair went 16 wide to 26 with no keyline and no lighting on the roots at all.
 *
 * Sizes follow ART_DIRECTION section 16: leaf clumps 14-17 across with centres about 10 apart, a
 * trunk 24 wide over 26 visible rows flaring to 37, keyline 1 px and 2 px underneath.
 *
 * The one thing taken from the board and then thrown away is its colour temperature: the board's
 * leaf dark is teal and ours is `shadow`, which is grass in shade. ART_DIRECTION section 14 asks
 * for a teal deep-shade step and a leaf keyline step in the palette; until those land this is the
 * closest the ramps reach, and it is within a few luma of the board at every step but the keyline.
 */
import { Img, noise, shade } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';
import { GROUND_TILES } from './ground.ts';

const TILE = 32;

/**
 * Tree space. x is 0..63 across both columns of tiles. y 0..63 is the four canopy tiles; y 64..95
 * is the two trunk tiles, which `forest-map.ts` plants on the row directly under `canopy-bl/-br`.
 * The crown drawing runs twelve rows past its own tiles so the leaves that close over the trunk's
 * shoulders are part of the same drawing as the rest of the crown rather than a second guess at it.
 */
const TRUNK_TOP = 64;
const CROWN_H = 76;
const TRUNK_H = TILE;

/** The row the roots stand on, in trunk-tile coordinates. */
const GROUND_Y = 26;

/* ------------------------------------------------------------------------------ the leaf ladder */

type Step = readonly [Ramp, 0 | 1 | 2 | 3];

/**
 * Seven steps from the crown's deepest crease to its highest leaf, measured against the board.
 *
 *   0  shadow 0  #16281a  L31   deepest crease, and the crown's keyline        board ~L11 (teal)
 *   1  shadow 1  #1f3a22  L53   the deep shade that is a third of the crown    board #034654 L50
 *   2  shadow 2  #2c4f2b  L72   clump shade                                    board #066155 L70
 *   3  canopy 0  #21713c  L92   the turn out of shade                          board #167e51 L92
 *   4  canopy 1  #2f9a4a  L126  base                                           board #45ad4d L130
 *   5  canopy 2  #51bb4b  L156  lit                                            board #5cbd48 L146
 *   6  canopy 3  #86d65c  L188  highlight                                      board #89cd51 L167
 *
 * Every step but the first lands within six luma of the board's own. The first is the ask in
 * ART_DIRECTION section 14: there is no leaf keyline in the palette, and `shadow` 0 is the darkest
 * green the ramps hold.
 */
const LEAF: readonly Step[] = [
  ['shadow', 0],
  ['shadow', 1],
  ['shadow', 2],
  ['canopy', 0],
  ['canopy', 1],
  ['canopy', 2],
  ['canopy', 3],
];

const leaf = (i: number): RGBA => {
  const step = LEAF[Math.max(0, Math.min(LEAF.length - 1, Math.round(i)))]!;
  return shade(step[0], step[1]);
};

/**
 * The keylines. Both are a line rather than a shade: the board rings its leaves at #040b17 and its
 * bark at #020304, which are the same near-black to within fifteen luma of each other, and neither
 * family's own ramp reaches anywhere near it -- `canopy` bottoms out at L92 and `trunk` at L57.
 *
 * `ink` 0 is L15, which is the board's value, and section 14 already blesses it for characters.
 * Using it here is a departure from that section's interim advice of `shadow` 1 (L53) for leaves
 * and `ink` 2 (L41) for wood, both of which were measured off the board's deep SHADE rather than
 * off its line: at L53 the ring stops being a line and becomes another step of the crown, which is
 * exactly the failure this redraw exists to fix. The shade is still drawn, at `LEAF` 1, which is
 * that same L53.
 */
const LEAF_LINE: RGBA = shade('ink', 0);
const BARK_LINE: RGBA = shade('ink', 0);

/**
 * The bark ladder, four steps, and it crosses two ramps on purpose.
 *
 *   0  trunk 0  #4e3520  L58   the underside of a root, and the deep grooves   board #542b23 L54
 *   1  trunk 1  #6b4a2b  L80   the shaded quarter of the cylinder              board #6c3d2b L73
 *   2  wood  1  #9a6a36  L114  the body                                        board #a36533 L114
 *   3  wood  2  #c08f55  L151  the lit column and the top of every root        board #cc924b L155
 *
 * `trunk` alone tops out at L132 and `wood` alone bottoms out at L75, so neither ramp spans the
 * board's bark, which runs L54 to L155 within one trunk. They also differ in exactly the way the
 * board does: its darks are desaturated browns (#542b23, red minus blue 49) and its lights are
 * saturated orange (#cc924b, red minus blue 129), which is `trunk` at the bottom and `wood` at the
 * top. ART_DIRECTION section 3.1 treats wood, bark and earth as one family, so this borrows inside
 * the family rather than across it, and it lands the trunk's lit tones on the same values the
 * bridge, the fence and the stall are drawn from.
 */
const BARK: readonly Step[] = [
  ['trunk', 0],
  ['trunk', 1],
  ['wood', 1],
  ['wood', 2],
];

const bark = (i: number): RGBA => {
  const step = BARK[Math.max(0, Math.min(BARK.length - 1, Math.round(i)))]!;
  return shade(step[0], step[1]);
};

/* --------------------------------------------------------------------------------- raster help */

const opaqueAt = (img: Img, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < img.w && y < img.h && img.get(x, y)[3] !== 0;

/**
 * A leaf clump: a disc whose radius breathes around the circumference, so no clump is a clean
 * ellipse and the pile of them has the scalloped, slightly ragged silhouette the board's crowns
 * have. Three sine terms rather than noise, because the shape has to be the same every time the
 * six tiles are regenerated and it has to be smooth enough that the rim does not come out as
 * single stray pixels.
 */
function lump(img: Img, cx: number, cy: number, r: number, c: RGBA, seed: number): void {
  const ry = r * 0.9;
  const reach = r * 1.2;
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * (r / ry);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach) continue;
      const th = Math.atan2(dy, dx);
      const wob =
        1 +
        0.14 * Math.sin(3 * th + seed) +
        0.08 * Math.sin(5 * th - seed * 1.7) +
        0.05 * Math.sin(7 * th + seed * 0.6);
      if (d <= r * wob) img.px(x, y, c);
    }
  }
}

/**
 * The keyline thickening, on the two edges the light does not reach: a second pixel under the
 * lowest pixel of every column, and one to the right of the rightmost pixel of every row in the
 * lower half. ART_DIRECTION section 3.2 -- never the top, never the left. This is what seats a
 * crown or a root onto the ground rather than letting it float on it.
 *
 * Run after `outline()`, so the pixel it finds is already the keyline and the one it adds is the
 * second.
 */
function seat(img: Img, c: RGBA, fromRow: number): void {
  for (let x = 0; x < img.w; x++) {
    for (let y = img.h - 1; y >= 0; y--) {
      if (!opaqueAt(img, x, y)) continue;
      img.px(x, y + 1, c);
      break;
    }
  }
  for (let y = fromRow; y < img.h; y++) {
    for (let x = img.w - 1; x >= 0; x--) {
      if (!opaqueAt(img, x, y)) continue;
      img.px(x + 1, y, c);
      break;
    }
  }
}

/* --------------------------------------------------------------------------------- the crown */

type Clump = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /**
   * How far into the light this clump sits, as an index into `LEAF`: the clump's own body is
   * `lv` and its lit cap `lv + 1`. A clump at 1 is painted entirely out of the `shadow` end of
   * the ladder -- on the board most of the lower-right half of a crown is exactly that.
   */
  readonly lv: number;
  /** Catches the sun: a `LEAF` 6 cap and a heavier dapple. Four of them, per section 7.3. */
  readonly hl?: true;
};

/**
 * Twelve clumps round the rim, six filling the middle, eight in the belly.
 *
 * The rim is an ellipse of rx 19, ry 15 about (32, 28) with the clump radii varied 7.5..8.5, which
 * puts twelve bumps on the silhouette at centres a touch over nine pixels apart -- ART_DIRECTION
 * section 7.2's ring of twelve to fourteen, overlapping by about a third. It is that scallop and
 * nothing inside it that says "tree" at a 26-tile camera, so the radii are never equal: a ring of
 * identical circles has a silhouette that is itself a circle.
 *
 * The levels are deliberately NOT a smooth gradient round the ring. Measured, the board's crown is
 * bimodal -- 22.6 per cent of it inside twenty luma of #034654 and 21.1 per cent inside twenty of
 * #5cbd48, with a thin middle -- so a crown is a dark mass with a lit shoulder on it, not a ball
 * shaded evenly from one side. Fourteen of these twenty-six clumps are at level 1, six are at
 * level 4, and only six sit in between.
 */
const RIM: readonly Clump[] = [
  { x: 31, y: 12, r: 8.5, lv: 4, hl: true },
  { x: 40, y: 16, r: 7.5, lv: 4 },
  { x: 45, y: 20, r: 7, lv: 3 },
  { x: 50, y: 27, r: 7.5, lv: 2 },
  { x: 50, y: 37, r: 7, lv: 1 },
  { x: 47, y: 45, r: 8, lv: 1 },
  { x: 40, y: 50, r: 7.5, lv: 1 },
  { x: 32, y: 52, r: 8, lv: 1 },
  { x: 24, y: 50, r: 8.5, lv: 2 },
  { x: 17, y: 44, r: 7, lv: 3 },
  { x: 14, y: 36, r: 7.5, lv: 4 },
  { x: 15, y: 26, r: 7, lv: 4 },
  { x: 19, y: 19, r: 8, lv: 4, hl: true },
  { x: 24, y: 15, r: 8, lv: 4, hl: true },
];

/** The middle of the pile. Smaller, so the rim keeps the silhouette to itself. */
const CORE: readonly Clump[] = [
  { x: 33, y: 23, r: 7.5, lv: 4 },
  { x: 24, y: 30, r: 7.5, lv: 4, hl: true },
  { x: 41, y: 25, r: 7.5, lv: 3 },
  { x: 31, y: 33, r: 8.5, lv: 3 },
  { x: 23, y: 40, r: 7.5, lv: 3 },
  { x: 41, y: 34, r: 7, lv: 1 },
  { x: 33, y: 42, r: 8, lv: 1 },
  { x: 25, y: 46, r: 7, lv: 2 },
];

/**
 * The belly: the leaves that close over the trunk's shoulders, hanging seven rows past the canopy
 * tiles into the two trunk tiles below. All at level 1, because this is the underside of the mass
 * and the board never lights it -- a crown with a bright belly reads as two bushes.
 *
 * Four of them, not eight. The rim's own bottom now reaches row 60, so there is no long neck left
 * to fill: the board's crown ends in the underside of the dome with the trunk coming straight out
 * of it, and a stack of belly clumps under a smaller dome turns that into an egg on a stick.
 *
 * They span 21..42 at the trunk's top row, against a trunk 21 wide there, and taper over the four
 * rows below it. A crown that meets its trunk at exactly the trunk's width is a lollipop on a
 * stick, and one that stops short of it leaves grass showing at both shoulders.
 */
const BELLY: readonly Clump[] = [
  { x: 25, y: 57, r: 8.5, lv: 1 },
  { x: 39, y: 57, r: 8.5, lv: 1 },
  { x: 32, y: 61, r: 8, lv: 1 },
  { x: 32, y: 64, r: 6.5, lv: 1 },
];

/**
 * Leaves catching the sun on a clump's lit shoulder, and leaves of the clump behind showing
 * through on a shaded one. Two or three pixels at a time, out along the rim rather than gathered
 * in the middle -- light breaks along the edge of a mass of leaves, and a mark in the centre of a
 * clump is just the old highlight blob with holes in it.
 *
 * Seeded from the clump's place in CROWN space, not in tile space, so the pattern is identical
 * however the drawing is later cut up.
 */
function dapple(img: Img, c: Clump, level: number, count: number, lit: boolean): void {
  const rnd = noise(Math.round(c.x * 73 + c.y * 131 + c.r * 7));
  for (let i = 0; i < count; i++) {
    const a = lit ? Math.PI * 1.25 + (rnd() - 0.5) * 2.6 : rnd() * Math.PI * 2;
    const d = c.r * (0.4 + rnd() * 0.5);
    const x = Math.round(c.x + Math.cos(a) * d);
    const y = Math.round(c.y + Math.sin(a) * d * 0.9);
    const run = rnd() < 0.45 ? 1 : rnd() < 0.8 ? 2 : 3;
    for (let k = 0; k < run; k++) if (opaqueAt(img, x + k, y)) img.px(x + k, y, leaf(level));
    if (rnd() < 0.4 && opaqueAt(img, x, y + 1)) img.px(x, y + 1, leaf(level));
  }
}

/**
 * One clump, in four passes: the crease it throws onto whatever is behind it, its own body, its
 * lit cap pushed up-left, and -- only if it faces the light -- a highlight.
 *
 * The crease is the whole reason the crown reads as a pile of masses rather than one textured
 * blob. It is a full copy of the clump offset down and right into the step below the clump's own,
 * so wherever this clump sits over a neighbour there is a hard dark line along the neighbour's
 * upper-left arc, and wherever it is the silhouette the same offset becomes the shade-side band
 * the keyline then rings.
 *
 * The lit cap is big and pushed hard up-left so it runs off that edge and leaves a crescent of
 * body colour on the shaded one. A smaller centred cap reads as a bright disc stuck on, and the
 * crown comes out as a bowl of apples.
 */
function paintClump(img: Img, c: Clump): void {
  const seed = (c.x * 0.37 + c.y * 0.61) % 6.283;
  // The cap's offset wanders with the seed. Offsetting every cap by the same vector lays the
  // crown out as a grid of identical crescents and the whole thing reads as brickwork.
  const ox = 1 + 0.4 * Math.sin(seed * 2.1);
  const oy = 1.2 + 0.4 * Math.cos(seed * 1.7);
  // The crease is the DEEP shade whatever the clump's own level is -- on the board a bright green
  // lobe sits in a #034654 crease exactly as a dark one does, and that one decision is most of
  // what makes the board's crowns bimodal rather than smoothly shaded. It is also only about a
  // pixel wide: creases two or three pixels thick stack into horizontal bands and the crown comes
  // out looking like an artichoke.
  lump(img, c.x + ox, c.y + oy, c.r, leaf(c.lv >= 2 ? 1 : 0), seed);
  lump(img, c.x, c.y, c.r, leaf(c.lv), seed);
  // The lit cap grows with the clump's level: a shaded clump keeps barely half its face, a lit one
  // keeps almost all of it, which is what gives the crown two populations instead of six.
  const capR = c.r * (c.lv >= 4 ? 0.8 : c.lv === 3 ? 0.74 : c.lv === 2 ? 0.68 : 0.62);
  lump(img, c.x - ox * 0.8, c.y - oy * 0.9, capR, leaf(c.lv + 1), seed + 0.9);
  if (c.hl) {
    lump(img, c.x - ox * 2.1, c.y - oy * 2.2, c.r * 0.42, leaf(c.lv + 2), seed + 1.8);
    dapple(img, c, c.lv + 2, 7, true);
  } else if (c.lv >= 3) {
    dapple(img, c, c.lv + 2, 5, true);
  } else {
    dapple(img, c, c.lv + 2, 5, false);
  }
}

/**
 * The whole crown, once, at 64x76 -- then ringed and seated. Painted back to front along the
 * light axis so a near clump's crease cuts against the one behind it; the belly goes first
 * whatever its coordinates say, because it is the underside of everything.
 */
function paintCrown(): Img {
  const img = new Img(64, CROWN_H);
  for (const c of BELLY) paintClump(img, c);
  const front = [...RIM, ...CORE].sort((a, b) => b.x + b.y - (a.x + a.y));
  for (const c of front) paintClump(img, c);
  img.outline(LEAF_LINE);
  seat(img, LEAF_LINE, 34);
  return img;
}

/* --------------------------------------------------------------------------------- the trunk */

/**
 * Half the trunk's width at a given row, before the roots widen it. Twenty-one pixels where it
 * leaves the crown, which is what the board measures, widening to twenty-six by the flare.
 */
const halfWidth = (y: number): number => 10.2 + y * 0.14;

/**
 * One root finger: a lobe swept along a curve, laid down three times so the underside is not
 * overwritten by the body and the body not by the lit top. The board gives every finger its own
 * keyline, which falls out of drawing them with gaps of two or three pixels between them -- the
 * outline pass then meets in the middle of the gap and the finger is ringed on both sides.
 */
function rootFinger(
  img: Img,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r0: number,
  r1: number,
): void {
  const steps = 16;
  const sweep = (dx: number, dy: number, rs: number, ry: number, c: RGBA): void => {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = r0 + (r1 - r0) * t;
      img.ellipse(x0 + (x1 - x0) * t + dx, y0 + (y1 - y0) * t + dy, r * rs, r * ry, c);
    }
  };
  sweep(1.1, 1.7, 1, 0.86, bark(0));
  sweep(0, 0, 1, 0.86, bark(1));
  sweep(-0.4, -0.9, 0.84, 0.62, bark(2));
  sweep(-0.7, -1.8, 0.6, 0.32, bark(3));
}

/**
 * Trunk and roots, once, at 64x32 -- then ringed and seated.
 *
 * Two lightings at once, both off the board. Across: a cylinder, a two-pixel lit column one pixel
 * in from the left silhouette, the body over the middle sixty per cent and shade down the right
 * quarter. Down: the crown's own shade, which puts the top four rows two steps darker and fades
 * out by the eighth. That second gradient is the thing that makes the bark read as going up INTO
 * the leaves rather than stopping underneath them, and it is unmistakable on the board -- the
 * trunk is L64 where it leaves the crown and L155 at the roots.
 */
function paintTrunk(): Img {
  const img = new Img(64, TRUNK_H);
  const rnd = noise(8123);

  // The two rear fingers first, then the column over them, then the three that come forward.
  rootFinger(img, 25, 16, 12, 24, 5, 2);
  rootFinger(img, 39, 16, 52, 24, 5, 2);

  const colRows = 21;
  for (let y = 0; y < colRows; y++) {
    const hw = halfWidth(y);
    const x0 = Math.round(32 - hw);
    const x1 = Math.round(32 + hw);
    const w = x1 - x0;
    // The crown's own shade, two steps at the top and fading out by row fourteen. On the board the
    // bark is L64 where it leaves the leaves and L155 at the roots, and that gradient is what
    // makes the trunk read as going up INTO the crown rather than stopping underneath it.
    const dim = y < 6 ? 2 : y < 11 ? 1 : 0;
    for (let x = x0; x <= x1; x++) {
      const k = x - x0;
      const lit = k === 0 ? 1 : k <= 2 ? 3 : k < w * 0.72 ? 2 : k < w * 0.89 ? 1 : 0;
      img.px(x, y, bark(lit - dim));
    }
  }

  rootFinger(img, 28, 19, 19, 27, 4.4, 1.8);
  rootFinger(img, 37, 19, 45, 27, 4.4, 1.8);
  rootFinger(img, 31, 19, 29, 29, 5.2, 2.4);

  /*
   * The valley between each pair of fingers. `outline()` fills the gaps the fingers leave between
   * themselves, but the three forward fingers start inside the column, where there is no gap to
   * fill, and without these the five roots merge into one pale paw. Short, and only in the flare:
   * run them up the trunk and they read as scratches rather than as the fold between two roots.
   */
  for (const [x0, y0, x1, y1] of [
    [26, 19, 21, 25],
    [30, 19, 26, 27],
    [35, 19, 38, 27],
    [38, 19, 42, 25],
  ] as const) {
    img.line(x0, y0, x1, y1, bark(0));
  }

  /*
   * Bark grooves: two lines that wander a pixel either way and break every few rows, so they read
   * as the edges of bark plates rather than as two ruled lines, and both run down into the root
   * flare instead of stopping at it. The left one gets a lit lip because it is in the lit column;
   * the right one does not, because it is in shade and a highlight there reads as a scratch.
   */
  const groove = (y: number, k: number): number =>
    Math.round(32 + (k === 0 ? -3 : 4.5) + Math.sin((y + k * 9) * 0.38) * 1.5);
  for (let y = 2; y < colRows + 3; y++) {
    for (const k of [0, 1]) {
      if ((y + k * 5) % 9 >= 7) continue;
      const x = groove(y, k);
      if (!opaqueAt(img, x, y)) continue;
      img.px(x, y, bark(0));
      if (k === 0 && opaqueAt(img, x - 1, y)) img.px(x - 1, y, bark(3));
    }
  }

  // A knot, low enough on the trunk to be out of the crown's shade. One piece of deliberate
  // structure beats twenty pixels of noise.
  img.ellipse(27, 14, 3.2, 2.4, bark(0));
  img.ellipse(26.7, 13.7, 1.9, 1.3, bark(1));
  img.px(25, 13, bark(3));

  // Lenticels, across the grain, with a lit pixel over each so they read as relief rather than dirt.
  for (let i = 0; i < 7; i++) {
    const y = 9 + Math.floor(rnd() * 12);
    const hw = halfWidth(y);
    const x = Math.round(32 - hw) + 3 + Math.floor(rnd() * Math.max(1, Math.round(hw)));
    const len = 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < len; k++) {
      if (!opaqueAt(img, x + k, y)) continue;
      img.px(x + k, y, bark(0));
      if (opaqueAt(img, x + k, y - 1)) img.px(x + k, y - 1, bark(2));
    }
  }

  img.outline(BARK_LINE);
  seat(img, BARK_LINE, 16);
  return img;
}

/* ---------------------------------------------------------------------------------- the tiles */

/**
 * Both drawings, made once. Six painters cutting from one pair of images is the point of the
 * exercise: there is no second opinion about where the crown's edge is, so there is no seam.
 */
let crownImg: Img | null = null;
let trunkImg: Img | null = null;
const crown = (): Img => (crownImg ??= paintCrown());
const trunk = (): Img => (trunkImg ??= paintTrunk());

/** The shipped field grass itself, so a trunk tile's floor matches the lawn it is laid into. */
const ground = (img: Img, variant: 1 | 2): void => {
  GROUND_TILES[`grass-${variant}`]!(img);
};

/**
 * Grass in shade under the roots, cast down and to the right. On the board this is a soft, wide,
 * low pool rather than a hard ellipse -- it is barely there, and it is the whole difference
 * between a tree standing in the grass and a tree parked on it.
 */
function contactShadow(img: Img, ox: number): void {
  img.ellipse(35 + ox, GROUND_Y + 3, 25, 5.2, shade('shadow', 0, 54));
  img.ellipse(34 + ox, GROUND_Y + 2.4, 20, 4, shade('shadow', 1, 96));
}

/** Blades over the foot of the roots, so the tree grows out of the grass instead of onto it. */
function blades(img: Img, ox: number): void {
  const rnd = noise(4477);
  for (let i = 0; i < 16; i++) {
    const x = 12 + Math.floor(rnd() * 40) + ox;
    const y = GROUND_Y - 1 + Math.floor(rnd() * 4);
    img.px(x, y, shade('grass', rnd() > 0.5 ? 1 : 0));
    img.px(x, y + 1, shade('grass', 0));
  }
}

const trunkTile =
  (half: 0 | 1, variant: 1 | 2) =>
  (img: Img): void => {
    const ox = -half * TILE;
    ground(img, variant);
    contactShadow(img, ox);
    img.blit(trunk(), ox, 0);
    blades(img, ox);
    // The crown's belly last, over the bark: twelve rows of leaf hanging into this tile, cut from
    // the same drawing the canopy tiles are cut from, keyline and all.
    img.blit(crown(), ox, -TRUNK_TOP);
  };

const canopyTile =
  (qx: 0 | 1, qy: 0 | 1) =>
  (img: Img): void => {
    img.blit(crown(), -qx * TILE, -qy * TILE);
  };

export const TREE_TILES: Record<string, (img: Img) => void> = {
  // The two halves take different grass variants, because the tone step between them falls on
  // x = 32 -- the middle of the trunk, which is the one place it cannot show.
  'trunk-l': trunkTile(0, 1),
  'trunk-r': trunkTile(1, 2),
  'canopy-tl': canopyTile(0, 0),
  'canopy-tr': canopyTile(1, 0),
  'canopy-bl': canopyTile(0, 1),
  'canopy-br': canopyTile(1, 1),
};
