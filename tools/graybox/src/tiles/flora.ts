/*
 * Flora, redrawn at 32px for docs/PIXEL_STANDARD.md: the tree (one crown cut into four quarters
 * over one trunk cut into two halves), the ground cover that grows under it, and the toadstool
 * ring.
 *
 * Three things drive every painter in this file.
 *
 * **Leaves are clumps, not a blob with speckle.** The 16px crown was one big ellipse with nine
 * lobes and forty speckle pixels on top; four times the speckle would just be dirt. Here the crown
 * is eleven clumps, each one painted dark-offset / base / lit-cap, in back-to-front order so the
 * dark offset of a near clump cuts a crease against the one behind it. That crease is the whole
 * reason the crown reads as foliage rather than as a green sticker, and it is structure the 16px
 * version had no room for.
 *
 * **The tree is one drawing.** `paintCrown` draws the entire 64x64 crown and `paintTrunkPair` the
 * entire 64x32 trunk-and-roots; the tile painters just shift the origin and let `Img.px` clip. No
 * quadrant knows it is a quadrant, so no seam can drift -- the alternative, four painters each
 * drawing their own corner, is how a crown ends up with a step in its outline.
 *
 * **Flowers grow out of something.** The concept board never puts a flower alone on grass, so each
 * flower tile is a low foliage mound with three blooms rising out of it on stems. `flower-pink`
 * and `flower-red` paint from the `cloak` ramp after the 2026-10-18 rebrand (Haze and Lilac); only
 * `flower-white` is off it.
 *
 * NOTE for whoever wires these into the tileset: `grassBase` here is a local copy of the shipped
 * grass recipe (level-1 fill, one alpha wash, blades) at 32px, because the ground group owns the
 * real grass painter and it does not exist yet. When it lands, delete `grassBase` and call theirs,
 * or every decor tile will sit on grass that is a shade off the field around it.
 */
import { Img, noise, shade } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/* ------------------------------------------------------------------ shared ground and shading */

/** Shade wash per grass variant: 0 is the shaded patch, 3 the sunlit one. */
const GRASS_WASH: readonly (readonly [0 | 1 | 2 | 3, number])[] = [
  [0, 44],
  [0, 15],
  [2, 22],
  [2, 52],
];

/**
 * The opaque grass every decor tile stands on. Blades are two and three pixels tall rather than
 * single dots -- same ink, same density, but a blade instead of a fleck -- and everything is inset
 * from the tile edge so nothing is cut in half by the boundary.
 */
function grassBase(img: Img, variant: 0 | 1 | 2 | 3): void {
  const rnd = noise(1009 + variant * 977);
  img.rect(0, 0, TILE, TILE, shade('grass', 1));
  const wash = GRASS_WASH[variant] ?? ([1, 0] as const);
  if (wash[1] > 0) img.rect(0, 0, TILE, TILE, shade('grass', wash[0], wash[1]));
  for (let i = 0; i < 34; i++) {
    const x = 1 + Math.floor(rnd() * (TILE - 2));
    const y = 2 + Math.floor(rnd() * (TILE - 5));
    const level = rnd() > 0.5 ? 0 : 2;
    img.px(x, y, shade('grass', level, 110));
    img.px(x, y + 1, shade('grass', level, 70));
  }
  for (let i = 0; i < 4 + variant; i++) {
    const x = 2 + Math.floor(rnd() * (TILE - 4));
    const y = 4 + Math.floor(rnd() * (TILE - 10));
    img.px(x, y, shade('grass', 3, 185));
    img.px(x, y + 1, shade('grass', 3, 140));
    img.px(x, y + 2, shade('grass', 2, 120));
  }
}

/** Grass in shade, pooling under anything that stands on the ground and spilling down-right. */
function contactShadow(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  img.ellipse(cx + 1.2, cy + 0.6, rx, ry, shade('shadow', 0, 70));
  img.ellipse(cx, cy, rx * 0.8, ry * 0.76, shade('shadow', 1, 120));
}

type Clump = { readonly x: number; readonly y: number; readonly r: number };

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
  if (band === 3)
    img.ellipse(c.x - off * 1.9, c.y - off * 1.9, c.r * 0.26, c.r * 0.24, shade(ramp, 3));
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
 * Every body stays inside 2..61 so no leaf is cut in half by a tile edge; the bottom clump is the
 * exception that matters, reaching y 62 so the crown meets the trunk tile below it.
 */
const CROWN_CX = 32;
const CROWN_CY = 31;
const CROWN: readonly Clump[] = [
  { x: 31, y: 15, r: 13 },
  { x: 15, y: 21, r: 11 },
  { x: 47, y: 20, r: 10.5 },
  { x: 12, y: 34, r: 10 },
  { x: 49, y: 35, r: 9.5 },
  { x: 18, y: 47, r: 10.5 },
  { x: 45, y: 47, r: 10.5 },
  { x: 31, y: 52, r: 11 },
  { x: 31, y: 32, r: 12 },
  { x: 21, y: 29, r: 9.5 },
  { x: 42, y: 30, r: 9 },
  { x: 25, y: 42, r: 8.5 },
  { x: 38, y: 41, r: 8 },
];

function paintCrown(img: Img, qx: 0 | 1, qy: 0 | 1): void {
  const ox = -qx * TILE;
  const oy = -qy * TILE;
  clumps(
    img,
    CROWN.map((c) => ({ x: c.x + ox, y: c.y + oy, r: c.r })),
    'canopy',
  );

  /*
   * Leaf tips, and only on the sunlit shoulder. There was a matching pass of dark notches down the
   * shaded side: at zoom 8 it was leaf detail, and at zoom 2 -- the size a player actually sees --
   * it was a scatter of dark dashes that read as holes punched in the crown. The creases between
   * clumps already carry all the dark structure the shaded side needs.
   *
   * Placed from one fixed seed in crown space and only onto leaf already painted, so the pattern
   * runs continuously across all four seams.
   */
  const rnd = noise(4242);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 7 + rnd() * 20;
    const x = Math.round(CROWN_CX + Math.cos(a) * d) + ox;
    const y = Math.round(CROWN_CY + Math.sin(a) * d * 0.95) + oy;
    if (x < 1 || y < 1 || x >= TILE - 1 || y >= TILE - 1) continue;
    if (img.get(x, y)[3] === 0) continue;
    if (x - (CROWN_CX + ox) + (y - (CROWN_CY + oy)) > -6) continue;
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
}

/* ---------------------------------------------------------------------------- ground cover */

const bushTile: Painter = (img) => {
  grassBase(img, 1);
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

/**
 * Three blooms growing out of a low mound of foliage, per the board. The stems come out of the
 * mound rather than out of bare grass, which is the detail that stops the tile reading as three
 * stickers.
 */
const flower = (b: Bloom): Painter =>
  function paintFlower(img) {
    grassBase(img, 0);
    contactShadow(img, 17, 27.5, 11, 2.2);
    const heads: readonly (readonly [number, number, number])[] = [
      [10, 12, 20],
      [17, 8, 19],
      [23, 13, 20],
    ];
    // Two pixels wide: dark on the right, lit on the left, like everything else standing up in
    // this forest. A one-pixel stem vanished against the mound the moment it was rendered.
    for (const [x, y, foot] of heads) {
      img.rect(x, y + 3, 1, foot - y - 2, shade('canopy', 0));
      img.rect(x - 1, y + 3, 1, foot - y - 2, shade('canopy', 2));
    }
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
  grassBase(img, 2);
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
  grassBase(img, 1);

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
  'flower-white': flower({ petal: shade('fur', 2), dark: shade('fur', 0), tip: shade('fur', 3) }),
  'flower-pink': flower({
    petal: shade('cloak', 3),
    dark: shade('cloak', 1),
    tip: shade('fur', 3),
  }),
  'flower-red': flower({
    petal: shade('cloak', 2),
    dark: shade('cloak', 0),
    tip: shade('cloak', 3),
  }),
  bush: bushTile,
  rock: rockTile,
  'trunk-l': (img) => {
    grassBase(img, 0);
    paintTrunkPair(img, 'left');
  },
  'trunk-r': (img) => {
    grassBase(img, 0);
    paintTrunkPair(img, 'right');
  },
  'canopy-tl': (img) => paintCrown(img, 0, 0),
  'canopy-tr': (img) => paintCrown(img, 1, 0),
  'canopy-bl': (img) => paintCrown(img, 0, 1),
  'canopy-br': (img) => paintCrown(img, 1, 1),
  'toadstool-ring': toadstoolRing,
};
