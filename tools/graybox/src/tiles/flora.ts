/*
 * Flora, redrawn at 32px for docs/PIXEL_STANDARD.md: the tree (one crown cut into four quarters
 * over one trunk cut into two halves), the ground cover that grows under it, and the toadstool
 * ring.
 *
 * Three things drive every painter in this file.
 *
 * **Leaves are clumps, not a blob with speckle.** The 16px crown was one big ellipse with nine
 * lobes and forty speckle pixels on top; four times the speckle would just be dirt. Here the crown
 * is sixteen clumps, each one painted dark-offset / base / lit-cap, in back-to-front order so the
 * dark offset of a near clump cuts a crease against the one behind it. That crease is the whole
 * reason the crown reads as foliage rather than as a green sticker, and it is structure the 16px
 * version had no room for.
 *
 * **The tree is one drawing.** `paintCrown` draws the entire 64x64 crown and `paintTrunkPair` the
 * entire 64x32 trunk-and-roots; the tile painters just shift the origin and let `Img.px` clip. No
 * quadrant knows it is a quadrant, so no seam can drift -- the alternative, four painters each
 * drawing their own corner, is how a crown ends up with a step in its outline.
 *
 * **Flowers grow out of something, and no two of them are the same plant.** The concept board never
 * puts a flower alone on grass, so a flower tile is always blooms rising out of foliage on stems.
 * `flower-white` and `flower-pink` are rosettes on a mound, in different arrangements;
 * `flower-red` is a foxglove, because two tiles that differ only in tint are one tile with two
 * gids. `flower-pink` and `flower-red` both paint from the `cloak` ramp after the 2026-10-18
 * rebrand, at opposite ends of it (Haze and Aubergine); only `flower-white` is off it.
 *
 * The grass under them is the ground group's own painter, called rather than copied: see `ground`.
 */
import { Img, noise, shade } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';
import { GROUND_TILES } from './ground.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/* ------------------------------------------------------------------ shared ground and shading */

/**
 * The opaque grass a decor tile stands on: the shipped field grass itself.
 *
 * This was a local copy of the grass recipe, written while the ground group did not exist yet, and
 * the copy had drifted. Measured, a decor tile's border came out at 109 to 117 mean luma against a
 * field running 113 to 122, so every flower, rock and toadstool printed a faint square of its own
 * green into the lawn. A copy is a second opinion about the floor, and the floor only gets one.
 *
 * Only the two middle variants are ever asked for. `grass-0..3` are four tones about nine luma
 * apart and a decor tile does not get to choose which of them `forest-map.ts` lays beside it, so it
 * takes one of the two nearest the middle of that ladder and is never more than a couple of levels
 * off either neighbour. (The ladder itself is the open problem -- the four variants vary by TONE
 * where the water variants vary by PATTERN, which is what makes a laid field read as squares -- but
 * they are painted by `grass()` in `tiles/ground.ts`, not here.)
 */
const ground = (img: Img, variant: 1 | 2): void => {
  GROUND_TILES[`grass-${variant}`]!(img);
};

/** Grass in shade, pooling under anything that stands on the ground and spilling down-right. */
function contactShadow(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  img.ellipse(cx + 1.2, cy + 0.6, rx, ry, shade('shadow', 0, 70));
  img.ellipse(cx, cy, rx * 0.8, ry * 0.76, shade('shadow', 1, 120));
}

type Clump = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /**
   * The clump's identity, fixed in the mass's own coordinates, for the dapple on its lit face. The
   * four canopy tiles each repaint the whole 64x64 crown at a different origin, so a mark seeded
   * from where the clump lands in a *tile* would fall somewhere else in each quadrant and the
   * dapple would break at all four seams.
   */
  readonly seed?: number;
};

const onLeaf = (img: Img, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < img.w && y < img.h && img.get(x, y)[3] !== 0;

/**
 * The sunlit face of a clump, as dapple rather than as a disc.
 *
 * It used to be one level-3 ellipse about six pixels across, on each of the two or three clumps
 * facing the light. On a single tree that is a highlight. On the map it is not: there is exactly
 * one tree, and `forest-map.ts` plants it every two tiles along all four borders, so that blob
 * appeared at the same place on every crown in the treeline and a row of them read as one stamp
 * repeated rather than as trees. `TILE_NAMES` is frozen at 53, so there is no second tree to cut
 * to; what can change is how self-identifying the crown's own texture is. The same ink, broken
 * into leaf-sized marks scattered along the clump's lit arc, reads as dapple and gives the eye no
 * shape to memorise.
 *
 * Marks only land on leaf already painted, which both keeps them off the grass and lets the ragged
 * edge of the clump trim them.
 */
function dapple(img: Img, c: Clump, ramp: Ramp, count: number): void {
  const rnd = noise(c.seed ?? Math.round(c.x * 73 + c.y * 131));
  for (let i = 0; i < count; i++) {
    // Up and to the left, give or take: one light, from the top-left, everywhere. Out towards the
    // rim rather than round the middle -- a dapple gathered at the centre of a clump is just the
    // old blob with holes in it, where light actually breaks along the edge of a mass of leaves.
    const a = Math.PI * 1.25 + (rnd() - 0.5) * 2.4;
    const d = c.r * (0.42 + rnd() * 0.44);
    const x = Math.round(c.x + Math.cos(a) * d);
    const y = Math.round(c.y + Math.sin(a) * d * 0.9);
    // One, two or three pixels across: a leaf catching the sun, not a speck of dust.
    const run = rnd() < 0.4 ? 1 : rnd() < 0.75 ? 2 : 3;
    for (let k = 0; k < run; k++) if (onLeaf(img, x + k, y)) img.px(x + k, y, shade(ramp, 3));
    if (rnd() < 0.45 && onLeaf(img, x, y + 1)) img.px(x, y + 1, shade(ramp, 3));
  }
}

/**
 * One clump of leaves at one of four distances from the sun.
 *
 * Band 0 is the underside of the mass: its *body* is the dark step, not just a ring round it. That
 * is the difference between a crown with form and the pile of identical bubbles you get when every
 * clump is painted the same green and told apart only by an outline. Bands 1 and 2 are the body
 * colour with a growing lit cap, and band 3 adds the highlight -- kept to the two or three clumps
 * actually facing the light, which holds level 3 to a few per cent of the mass.
 */
function clump(img: Img, c: Clump, ramp: Ramp, band: 0 | 1 | 2 | 3): void {
  const off = Math.max(1.2, c.r * 0.22);
  if (band === 0) {
    img.ellipse(c.x, c.y, c.r, c.r * 0.9, shade(ramp, 0));
    img.ellipse(c.x - off * 0.8, c.y - off, c.r * 0.5, c.r * 0.44, shade(ramp, 1));
    return;
  }
  img.ellipse(c.x + off, c.y + off, c.r, c.r * 0.9, shade(ramp, 0));
  img.ellipse(c.x, c.y, c.r, c.r * 0.9, shade(ramp, 1));
  // The lit cap is nearly the size of the clump and pushed hard up-left, so it runs off that edge
  // and leaves a crescent of body colour on the shaded one. A smaller, centred cap reads as a
  // bright disc stuck onto the clump -- the crown came out looking like a bowl of apples.
  if (band >= 2) img.ellipse(c.x - off, c.y - off * 1.1, c.r * 0.76, c.r * 0.68, shade(ramp, 2));
  if (band === 3) dapple(img, c, ramp, 8);
}

/**
 * A mass of clumps. `x + y` is distance along the light axis, so one ranking does two jobs: it
 * paints back to front, so a near clump's shade cuts a crease against the one behind it, and it
 * decides how much sun each clump gets, which puts one gradient across the whole mass instead of
 * shading every clump identically. `cap` holds small masses below the highlight band -- a level-3
 * sparkle on a three-clump flower mound is a glint, not a highlight.
 */
function clumps(img: Img, list: readonly Clump[], ramp: Ramp, cap: 0 | 1 | 2 | 3 = 3): void {
  const order = [...list].sort((a, b) => b.x + b.y - (a.x + a.y));
  const n = order.length;
  order.forEach((c, i) => {
    const rank = i / Math.max(1, n - 1); // 0 = deepest shade, 1 = facing the light
    const band = rank < 0.25 ? 0 : rank < 0.5 ? 1 : rank < 0.78 ? 2 : 3;
    clump(img, c, ramp, Math.min(band, cap) as 0 | 1 | 2 | 3);
  });
}

/* ------------------------------------------------------------------------------------ the tree */

/**
 * The crown, in its own 64x64 space with the trunk's centre line at x = 32. Thirteen clumps of
 * eight different sizes: a ring of eight round the rim and five filling the middle. The sizes vary
 * on purpose -- a ring of equal circles gives a silhouette that is itself a circle, and a tree
 * whose outline is a circle reads as a lollipop whatever is painted inside it.
 *
 * Every body stays inside 2..61 so no leaf is cut in half by a tile edge, with one deliberate
 * exception: `CROWN_BELLY` runs off the bottom, because down there the drawing continues into the
 * trunk tile.
 */
const CROWN_CX = 32;
const CROWN_CY = 31;
const CROWN: readonly Clump[] = [
  { x: 31, y: 15, r: 13, seed: 311 },
  { x: 15, y: 21, r: 11, seed: 322 },
  { x: 47, y: 20, r: 10.5, seed: 333 },
  { x: 12, y: 34, r: 10, seed: 344 },
  { x: 49, y: 35, r: 9.5, seed: 355 },
  { x: 18, y: 47, r: 10.5, seed: 366 },
  { x: 45, y: 47, r: 10.5, seed: 377 },
  { x: 31, y: 52, r: 11, seed: 388 },
  { x: 31, y: 32, r: 12, seed: 399 },
  { x: 21, y: 29, r: 9.5, seed: 410 },
  { x: 42, y: 30, r: 9, seed: 421 },
  { x: 25, y: 42, r: 8.5, seed: 432 },
  { x: 38, y: 41, r: 8, seed: 443 },
];

/**
 * The belly of the same crown: the leaves that close over the top of the trunk.
 *
 * Measured, the crown used to taper to six pixels of leaf at y 61 and then stop, two rows short of
 * the bottom edge, while `paintTrunkPair` draws a trunk sixteen pixels wide from the very first
 * row of the tile below -- so grass showed at both of the trunk's shoulders and the tree read as a
 * bush balanced on a stump. These three reach the edge and span 22..42, wider than the trunk on
 * purpose: a crown that meets the trunk exactly at its own width is a lollipop on a stick.
 *
 * Painted before `CROWN` and forced to the shade band, because this is the underside of the mass.
 * Ranking it by the light axis like the rest would have lit the bottom-left of it, and a crown with
 * a bright belly reads as two bushes rather than as one tree.
 */
const CROWN_BELLY: readonly Clump[] = [
  { x: 25, y: 56, r: 9, seed: 701 },
  { x: 39, y: 56, r: 9, seed: 702 },
  { x: 32, y: 59, r: 9.5, seed: 703 },
];

const shift = (list: readonly Clump[], ox: number, oy: number): Clump[] =>
  list.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));

function paintCrown(img: Img, qx: 0 | 1, qy: 0 | 1): void {
  const ox = -qx * TILE;
  const oy = -qy * TILE;
  clumps(img, shift(CROWN_BELLY, ox, oy), 'canopy', 0);
  clumps(img, shift(CROWN, ox, oy), 'canopy');

  /*
   * Leaf tips, and only on the sunlit shoulder. There was a matching pass of dark notches down the
   * shaded side: at zoom 8 it was leaf detail, and at zoom 2 -- the size a player actually sees --
   * it was a scatter of dark dashes that read as holes punched in the crown. The creases between
   * clumps already carry all the dark structure the shaded side needs.
   *
   * Placed from one fixed seed in crown space and only onto leaf already painted, so the pattern
   * runs continuously across all four seams.
   *
   * The sunlit half now runs to the crown's own middle rather than stopping six pixels short of it.
   * Holding the tips out at the rim concentrated every bright pixel the crown had into one corner,
   * and a treeline of crowns each bright in the same corner is the repeat this tree is trying not
   * to be; letting them reach the centre spreads the light over the whole lit side.
   */
  const rnd = noise(4242);
  for (let i = 0; i < 52; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 7 + rnd() * 20;
    const x = Math.round(CROWN_CX + Math.cos(a) * d) + ox;
    const y = Math.round(CROWN_CY + Math.sin(a) * d * 0.95) + oy;
    if (x < 1 || y < 1 || x >= TILE - 1 || y >= TILE - 1) continue;
    if (img.get(x, y)[3] === 0) continue;
    if (x - (CROWN_CX + ox) + (y - (CROWN_CY + oy)) > -1) continue;
    img.px(x, y, shade('canopy', 3));
    img.px(x - 1, y, shade('canopy', 2));
  }
}

/**
 * Trunk and roots, in their own 64x32 space shared by the two halves. The trunk is a cylinder: a
 * dark rim, three pixels of lit bark just inside the left edge, the body, then four pixels of
 * shade at the right. The structure the 16px version could not afford is here -- two bark grooves
 * that wander, lenticel dashes, a knot, and three roots flaring onto the grass.
 */
const GROUND_Y = 28;

/** The crown's lowest leaves, hanging into the top of the trunk tile. See the note at the foot. */
const TRUNK_LEAF: readonly Clump[] = [
  { x: 26, y: -6, r: 8.5, seed: 711 },
  { x: 37, y: -6, r: 8.5, seed: 712 },
  { x: 32, y: -4, r: 7.5, seed: 713 },
];

function paintTrunkPair(img: Img, half: 'left' | 'right'): void {
  const ox = half === 'left' ? 0 : -TILE;
  const rnd = noise(8123);

  // The crown's shadow, thrown down-right across both tiles. Drawn first: the roots sit on it.
  contactShadow(img, 37 + ox, GROUND_Y + 0.5, 23, 5.4);

  const span = (y: number): readonly [number, number] => {
    const flare = y > 20 ? (y - 20) * 0.55 : 0;
    return [Math.round(24 - flare - y * 0.045), Math.round(39 + flare + y * 0.045)] as const;
  };

  // Two bark grooves that wander a pixel either way and break every few rows, so they read as the
  // edges of bark plates rather than as two ruled lines.
  const groove = (y: number, k: number): number => {
    const [x0, x1] = span(y);
    const w = x1 - x0;
    const wobble = Math.round(Math.sin((y + k * 11) * 0.42) * 1.4);
    return x0 + Math.round(w * (k === 0 ? 0.44 : 0.66)) + wobble;
  };

  for (let y = 0; y < GROUND_Y; y++) {
    const [x0, x1] = span(y);
    img.rect(x0 + ox, y, x1 - x0 + 1, 1, shade('trunk', 1));
    img.px(x0 + ox, y, shade('trunk', 0));
    img.rect(x0 + 1 + ox, y, 3, 1, shade('trunk', 2));
    img.rect(x1 - 3 + ox, y, 4, 1, shade('trunk', 0));
    // A broken highlight on the lit edge; every bark plate catches it, the gaps do not.
    if (y % 7 !== 3 && y % 11 !== 5) img.px(x0 + 1 + ox, y, shade('trunk', 3));
    for (const k of [0, 1]) {
      if ((y + k * 5) % 9 < 7) img.px(groove(y, k) + ox, y, shade('trunk', 0));
    }
  }

  // Lenticels: short dashes across the grain, with a lit pixel above each so they read as relief.
  for (let i = 0; i < 9; i++) {
    const y = 2 + Math.floor(rnd() * (GROUND_Y - 6));
    const [x0, x1] = span(y);
    const x = x0 + 4 + Math.floor(rnd() * Math.max(1, x1 - x0 - 9));
    const len = 2 + Math.floor(rnd() * 2);
    img.rect(x + ox, y, len, 1, shade('trunk', 0));
    img.rect(x + ox, y - 1, len, 1, shade('trunk', 2));
  }

  // A knot. One piece of deliberate structure beats twenty pixels of noise.
  img.ellipse(33 + ox, 10, 3.4, 2.6, shade('trunk', 0));
  img.ellipse(32.6 + ox, 9.6, 2, 1.4, shade('trunk', 1));
  img.px(31 + ox, 9, shade('trunk', 2));
  img.px(32 + ox, 8, shade('trunk', 2));

  // Roots. Left, right and one coming forward, each a lobe with its lit top and its own shade.
  const root = (cx: number, cy: number, rx: number, ry: number): void => {
    img.ellipse(cx + 0.6 + ox, cy + 0.8, rx, ry, shade('trunk', 0));
    img.ellipse(cx + ox, cy, rx, ry, shade('trunk', 1));
    img.ellipse(cx - 0.8 + ox, cy - 0.9, rx * 0.72, ry * 0.5, shade('trunk', 2));
  };
  root(19, 26, 5.4, 2.4);
  root(45, 26, 5.2, 2.3);
  root(38, 28.5, 4.4, 2);
  root(27, 28.5, 4, 1.8);

  // Seat the whole thing: a dark line where bark meets earth, then a few blades over the front of
  // it so the tree grows out of the grass instead of being parked on it.
  const [bx0, bx1] = span(GROUND_Y - 1);
  img.rect(bx0 + ox, GROUND_Y, bx1 - bx0 + 1, 1, shade('trunk', 0));
  for (let i = 0; i < 14; i++) {
    const x = 16 + Math.floor(rnd() * 32);
    const y = GROUND_Y - 1 + Math.floor(rnd() * 3);
    img.px(x + ox, y, shade('grass', rnd() > 0.5 ? 1 : 0));
    img.px(x + ox, y + 1, shade('grass', 0));
  }

  /*
   * The last of the crown, drawn here because the crown cannot draw it.
   *
   * `canopy-bl` and `canopy-br` stop at their own bottom edge, so whatever closes the gap over the
   * trunk's shoulders has to be painted in this tile -- three clumps hanging in from above, in the
   * shade band, narrowing from the belly's 22..42 to the trunk's own width over four rows. Drawn
   * last so the bark goes behind them, which is what makes the trunk read as going up INTO the
   * mass rather than stopping underneath it.
   *
   * Safe to draw unconditionally: `forest-map.ts` only ever plants a trunk under a canopy pair, and
   * sweeps half trees away at the end of generation, so a bare trunk tile does not ship.
   */
  clumps(img, shift(TRUNK_LEAF, ox, 0), 'canopy', 0);
}

/* ---------------------------------------------------------------------------- ground cover */

const bushTile: Painter = (img) => {
  ground(img, 2);
  contactShadow(img, 17, 27.5, 12, 3);
  clumps(
    img,
    [
      { x: 11, y: 18, r: 8 },
      { x: 20, y: 17, r: 8 },
      { x: 16, y: 12, r: 7 },
      { x: 22, y: 22, r: 6.5 },
      { x: 10, y: 23, r: 6.5 },
      { x: 16, y: 21, r: 7.5 },
    ],
    'canopy',
  );
  // Blades over the foot of it, so the bush grows out of the grass instead of sitting on it.
  const rnd = noise(2211);
  for (let i = 0; i < 9; i++) {
    const x = 7 + Math.floor(rnd() * 18);
    const y = 24 + Math.floor(rnd() * 4);
    img.px(x, y, shade('grass', 1));
    img.px(x, y + 1, shade('grass', 0));
  }
};

/** Petal, its shade and its tip, so each flower stays on one ramp. */
type Bloom = { readonly petal: RGBA; readonly dark: RGBA; readonly tip: RGBA };

/** Five petals round a lit centre. A disc would read as a berry at this size. */
function bloom(img: Img, cx: number, cy: number, b: Bloom): void {
  const petals = [-90, -18, 54, 126, 198].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + Math.cos(a) * 2.2, y: cy + Math.sin(a) * 2 };
  });
  for (const p of petals) img.ellipse(p.x + 1, p.y + 1, 2, 1.9, b.dark);
  for (const p of petals) img.ellipse(p.x, p.y, 2, 1.9, b.petal);
  for (const p of petals) {
    if (p.x - cx + (p.y - cy) < -1) img.ellipse(p.x - 0.7, p.y - 0.7, 1, 0.9, b.tip);
  }
  img.ellipse(cx, cy, 1.5, 1.4, shade('gold', 2));
  img.px(Math.round(cx + 1), Math.round(cy + 1), shade('gold', 1));
  img.px(Math.round(cx - 1), Math.round(cy - 1), shade('gold', 3));
}

/** A stem: two pixels wide, dark on the right and lit on the left, like everything standing up. */
function stem(img: Img, x: number, top: number, foot: number): void {
  img.rect(x, top, 1, foot - top, shade('canopy', 0));
  img.rect(x - 1, top, 1, foot - top, shade('canopy', 2));
}

/** Where a rosette's heads sit: the head's x and y, and the y its stem reaches down to. */
type Heads = readonly (readonly [number, number, number])[];

/**
 * Rosettes: open blooms growing out of a low mound of foliage, per the board. The stems come out of
 * the mound rather than out of bare grass, which is the detail that stops the tile reading as three
 * stickers.
 */
const rosette = (b: Bloom, heads: Heads, variant: 1 | 2): Painter =>
  function paintRosette(img) {
    ground(img, variant);
    contactShadow(img, 17, 27.5, 11, 2.2);
    // A one-pixel stem vanished against the mound the moment it was rendered.
    for (const [x, y, foot] of heads) stem(img, x, y + 3, foot + 1);
    // Leaves on two of the stems, before the mound so they tuck behind the foliage.
    img.ellipse(7, 17, 2.8, 1.3, shade('canopy', 0));
    img.ellipse(6.6, 16.5, 2.4, 1, shade('canopy', 2));
    img.ellipse(26, 18, 2.8, 1.3, shade('canopy', 0));
    img.ellipse(25.6, 17.5, 2.4, 1, shade('canopy', 2));
    clumps(
      img,
      [
        { x: 9, y: 25, r: 5 },
        { x: 17, y: 24, r: 5.5 },
        { x: 24, y: 25, r: 4.5 },
      ],
      'canopy',
      2,
    );
    for (const [x, y] of heads) bloom(img, x, y, b);
  };

/**
 * One hanging bell: taller than it is wide, lit on the shoulder it turns to the sun, with its own
 * dark a pixel proud down the shaded side and a flared lip left in shade at the mouth.
 *
 * Taller than wide is the whole trick. A round one is a berry, and the first pass of this tile was
 * five berries on a stick.
 */
function bell(img: Img, cx: number, cy: number, b: Bloom): void {
  img.ellipse(cx + 0.7, cy + 0.7, 2.2, 2.8, b.dark);
  img.ellipse(cx, cy, 2.2, 2.8, b.petal);
  img.ellipse(cx - 0.8, cy - 0.9, 1.5, 1.8, b.tip);
  img.rect(cx - 2, cy + 3, 5, 1, b.dark);
  // The same gold the rosettes carry in their centres, so the two still read as one forest.
  img.px(cx, cy + 3, shade('gold', 2));
}

/**
 * A different plant, not a different tint.
 *
 * `flower-pink` and `flower-red` came out of the 2026-10-18 rebrand as one drawing in two shades
 * of the same ramp: measured, 14 per cent of their pixels differed and their silhouettes were
 * identical to the pixel, which spends two of the 53 frozen gids on one flower. Silhouette is what
 * separates two things at a 26-tile camera -- docs/PIXEL_STANDARD.md section 6 says it of
 * characters and it is no less true of a tile -- so this is a foxglove: two upright spikes of
 * drooping bells over flat strap leaves, against the rosettes' round heads on a round mound. The
 * colour is still `cloak`, as the rebrand requires; it is the shape that tells them apart.
 */
const foxglove = (b: Bloom): Painter =>
  function paintFoxglove(img) {
    ground(img, 2);
    contactShadow(img, 16, 27, 12, 2.2);
    // Two spikes, a tall one and a short one, with the bells hanging off alternating sides close
    // enough to touch the stem. A bell floating a pixel clear of its stem reads as a bug.
    stem(img, 11, 5, 27);
    stem(img, 22, 13, 28);
    // Strap leaves at the foot, where the rosettes have a mound of clumps: flat, long and pointed,
    // which is half of what makes this a different plant rather than the same one in another tint.
    // Staggered in height on purpose -- at one height the three of them merged into a single green
    // bar across the bottom of the tile, which reads as a hedge, not as a plant.
    for (const [cx, cy, rx, tip] of [
      [8, 25.5, 5, -1],
      [22, 27, 4.5, 1],
      [14, 28, 3, 1],
    ] as const) {
      img.ellipse(cx + 0.5, cy + 0.6, rx, 1.7, shade('canopy', 0));
      img.ellipse(cx, cy, rx * 0.9, 1.1, shade('canopy', 1));
      img.ellipse(cx - 0.8, cy - 0.6, rx * 0.66, 0.8, shade('canopy', 2));
      // A pixel past the end, so a strap leaf comes to a point instead of a round cap.
      img.px(cx + tip * (rx + 1), cy, shade('canopy', 0));
    }
    for (const [x, y] of [
      [7, 9],
      [14, 13],
      [7, 18],
      [25, 17],
      [18, 22],
    ] as const)
      bell(img, x, y, b);
  };

/**
 * Granite: three flat planes, not a shaded ball.
 *
 * Seen from this camera a boulder is mostly its top face, with the side it turns away from you
 * showing as a band down the right and a dark foot where it meets the ground. So the top face is
 * one flat `stone` 2 with a `stone` 3 band along the upper-left edge it catches the sun on, the
 * turning side is flat `stone` 1, and the foot is flat `stone` 0 -- each boundary a hard value
 * step, which is what says "faceted rock" at this size. Every ellipse stack I tried before this
 * said "potato".
 *
 * The silhouette is deliberately lopsided, leaning right, for the same reason the crown's is: a
 * symmetrical blob reads as a blob.
 */
const ROCK_TOP = 10;
const ROCK_ROWS: readonly (readonly [number, number])[] = [
  [9, 16],
  [7, 19],
  [6, 22],
  [5, 24],
  [4, 26],
  [4, 27],
  [3, 28],
  [3, 28],
  [3, 28],
  [4, 28],
  [4, 27],
  [5, 27],
  [6, 26],
  [7, 25],
  [9, 23],
  [12, 21],
];

const rockTile: Painter = (img) => {
  ground(img, 1);
  contactShadow(img, 17, 26.5, 12, 3);

  // Its own dark, one pixel proud of the silhouette all the way round.
  ROCK_ROWS.forEach(([x0, x1], i) => {
    const y = ROCK_TOP + i;
    img.rect(x0 - 1, y, x1 - x0 + 3, 1, shade('stone', 0));
    if (i === 0) img.rect(x0, y - 1, x1 - x0 + 1, 1, shade('stone', 0));
    if (i === ROCK_ROWS.length - 1) img.rect(x0, y + 1, x1 - x0 + 1, 1, shade('stone', 0));
  });

  // Where the top face turns into the side, and where the side meets the ground. Both lines tilt
  // with the light, so the right of the rock turns away sooner than the left.
  const turn = (x: number): number => 17.5 - 0.35 * (x - 16);
  const foot = (x: number): number => 21.5 - 0.35 * (x - 16);
  ROCK_ROWS.forEach(([x0, x1], i) => {
    const y = ROCK_TOP + i;
    for (let x = x0; x <= x1; x++) {
      const level = y > foot(x) ? 0 : y > turn(x) ? 1 : (x - 3) * 0.5 + (y - 10) < 4.5 ? 3 : 2;
      img.px(x, y, shade('stone', level));
    }
  });

  // A crack running down off the top face, lit on its upper-left lip, and a shorter one beside it.
  for (let i = 0; i < 10; i++) {
    const x = 15 + Math.round(i * 0.5);
    const y = 13 + i;
    img.px(x, y, shade('stone', 0));
    img.px(x - 1, y, shade('stone', 3));
  }
  img.line(22, 14, 25, 17, shade('stone', 0));
  img.line(21, 14, 24, 17, shade('stone', 3));

  // Granite grain: a sparse, fixed dusting, never enough to be texture in its own right.
  const rnd = noise(5150);
  for (let i = 0; i < 14; i++) {
    const row = Math.floor(rnd() * ROCK_ROWS.length);
    const bounds = ROCK_ROWS[row];
    if (!bounds) continue;
    const x = bounds[0] + 1 + Math.floor(rnd() * Math.max(1, bounds[1] - bounds[0] - 1));
    img.px(x, ROCK_TOP + row, shade('stone', rnd() > 0.5 ? 3 : 0, 110));
  }

  // A chip off the old block, so the tile is a rock in grass and not a rock on grass.
  img.ellipse(26.5, 26, 3.6, 2.1, shade('stone', 0));
  img.ellipse(26, 25.6, 2.8, 1.5, shade('stone', 1));
  img.ellipse(25.3, 25, 1.6, 0.8, shade('stone', 2));
};

/**
 * The toadstool ring: Aubergine caps with Offwhite spots, per the 2026-10-18 rebrand. One tile is
 * a cluster of three rather than the single mushroom the 16px tile had -- the map scatters these
 * round a glade, and a cluster gives the ring a rhythm instead of a dotted line.
 */
const toadstoolRing: Painter = (img) => {
  ground(img, 2);

  const toadstool = (cx: number, capY: number, rx: number, ry: number, foot: number): void => {
    contactShadow(img, cx + 1, foot + 1, rx * 0.9, 2);
    // Stem: cream, lit down its left edge, with a skirt where the cap meets it.
    const sw = Math.max(2, Math.round(rx * 0.42));
    img.rect(cx - Math.floor(sw / 2), capY, sw, foot - capY, shade('wall', 1));
    img.rect(cx - Math.floor(sw / 2), capY, 1, foot - capY, shade('wall', 3));
    img.rect(cx - Math.floor(sw / 2) + sw - 1, capY, 1, foot - capY, shade('wall', 0));
    img.rect(cx - Math.floor(sw / 2) - 1, capY + 2, sw + 2, 1, shade('wall', 2));
    // Cap: its own dark a pixel proud, the Aubergine body, a Lilac cap towards the light, and the
    // gills as a dark line under the brim.
    img.ellipse(cx, capY - 1, rx + 1, ry + 1, shade('cloak', 0));
    img.ellipse(cx, capY - 1.4, rx, ry, shade('cloak', 1));
    img.ellipse(cx - rx * 0.26, capY - 1.4 - ry * 0.4, rx * 0.6, ry * 0.52, shade('cloak', 2));
    img.ellipse(cx, capY + ry - 1.8, rx * 0.86, 0.9, shade('cloak', 0));
  };

  toadstool(16, 14, 8.5, 5, 26);
  toadstool(25, 19, 5.5, 3.4, 27);
  toadstool(8, 21, 4.5, 2.8, 27);

  // Offwhite spots, biggest on the cap that faces you.
  const spot = (x: number, y: number, big: boolean): void => {
    img.px(x, y, shade('fur', 3));
    if (!big) return;
    img.px(x + 1, y, shade('fur', 3));
    img.px(x, y + 1, shade('fur', 2));
    img.px(x + 1, y + 1, shade('fur', 2));
  };
  spot(12, 11, true);
  spot(18, 9, true);
  spot(20, 13, true);
  spot(14, 14, false);
  spot(23, 17, false);
  spot(26, 19, true);
  spot(7, 20, false);
  spot(9, 21, false);
};

/* --------------------------------------------------------------------------------- the tiles */

export const FLORA_TILES: Record<string, (img: Img) => void> = {
  // Three plants, three silhouettes: a tight arch of daisies, a wider sprawl of haze-coloured
  // ones, and a foxglove. The two cloak-ramp tiles sit at opposite ends of that ramp as well --
  // haze petals with a white tip against an aubergine bell with a lilac one.
  'flower-white': rosette(
    { petal: shade('fur', 2), dark: shade('fur', 0), tip: shade('fur', 3) },
    [
      [10, 12, 20],
      [17, 8, 19],
      [23, 13, 20],
    ],
    1,
  ),
  'flower-pink': rosette(
    { petal: shade('cloak', 3), dark: shade('cloak', 1), tip: shade('fur', 3) },
    [
      [9, 16, 23],
      [16, 10, 21],
      [24, 14, 22],
    ],
    2,
  ),
  'flower-red': foxglove({
    petal: shade('cloak', 1),
    dark: shade('cloak', 0),
    tip: shade('cloak', 2),
  }),
  bush: bushTile,
  rock: rockTile,
  // The two halves take different grass variants: the tone step between them falls on x = 32,
  // which is the middle of the trunk, so the trunk covers the only place it could show.
  'trunk-l': (img) => {
    ground(img, 1);
    paintTrunkPair(img, 'left');
  },
  'trunk-r': (img) => {
    ground(img, 2);
    paintTrunkPair(img, 'right');
  },
  'canopy-tl': (img) => paintCrown(img, 0, 0),
  'canopy-tr': (img) => paintCrown(img, 1, 0),
  'canopy-bl': (img) => paintCrown(img, 0, 1),
  'canopy-br': (img) => paintCrown(img, 1, 1),
  'toadstool-ring': toadstoolRing,
};
