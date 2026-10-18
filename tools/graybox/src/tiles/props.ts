/*
 * Props, redrawn at 32x32: the stall, the lantern post, the fountain, the well and the signpost.
 *
 * These were the most starved tiles in the 16px set. Each one was a single 16x16 square trying to
 * be a whole object, so the well was a stone ring with a bar over it and the stall was four stripes
 * and a plank. At 32x32 the budget goes on structure, per docs/PIXEL_STANDARD.md section 1: the
 * counter has planks with seams and a knot, the well has courses of stone with mortar between them,
 * the roof has shingle courses, and the stall's canvas has panels with a seam at every join.
 *
 * Conventions kept from the 16px set, because `forest-map.ts` depends on them:
 *
 * - The three `stall-awning-*` tiles go on the `above` layer and hang over the player, so they are
 *   transparent outside the cloth and the frame. Nothing in them is drawn with partial alpha:
 *   PIXEL_STANDARD section 4 forbids a half-transparent pixel in the file, and in these three
 *   tiles there is no opaque ground to blend against.
 * - Every other prop goes on the `below` layer over the grass of the ground layer, and carries its
 *   own opaque patch of grass. That is what lets them have contact shadows and -- for the lantern
 *   -- a pool of warm light, both of which are alpha over opaque ground and so are allowed.
 *
 * The four-step stripe rule, the one light from the top left and the contact shadow under anything
 * standing on the ground are all from PIXEL_STANDARD. Colour is only ever `shade(ramp, level)`.
 */
import { Img, noise, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/**
 * The patch of grass a ground-standing prop carries under itself.
 *
 * This duplicates the four-variant wash of the ground group's grass rather than importing it: the
 * two files are being drawn at the same time and nothing is wired up yet. Whoever assembles the
 * tileset should swap this for the real grass painter, at which point these props keep working --
 * all they need from it is an opaque field of the right brightness to blend their shadows into.
 */
const GRASS_WASH = [
  [0, 44],
  [0, 15],
  [2, 22],
  [2, 52],
] as const;

function groundUnder(img: Img, variant: 0 | 1 | 2 | 3, seed: number): void {
  const rnd = noise(seed);
  img.rect(0, 0, TILE, TILE, shade('grass', 1));
  const [level, alpha] = GRASS_WASH[variant];
  img.rect(0, 0, TILE, TILE, shade('grass', level, alpha));
  for (let i = 0; i < 80; i++)
    img.px(
      Math.floor(rnd() * TILE),
      Math.floor(rnd() * TILE),
      shade('grass', rnd() > 0.5 ? 0 : 2, 110),
    );
  // Upright blades, three pixels tall so they are a blade rather than a speck.
  for (let i = 0; i < 6 + variant * 3; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = 3 + Math.floor(rnd() * (TILE - 9));
    img.px(x, y, shade('grass', 3, 190));
    img.px(x, y + 1, shade('grass', 2, 160));
    img.px(x, y + 2, shade('grass', 1, 140));
  }
}

/** The flattened ellipse that stops a thing floating. Always a touch down and to the right. */
const contactShadow = (img: Img, cx: number, cy: number, rx: number, ry: number): void =>
  img.ellipse(cx, cy, rx, ry, shade('shadow', 1, 110));

/* ------------------------------------------------------------------ the stall */

/*
 * Awning canvas. Section 6a of docs/ART_PRODUCTION.md takes it off red and onto Haze and Offwhite
 * stripes, so the pale panel is the palette's neutral white (`fur`) and the coloured one is Haze
 * (`cloak` level 3). Haze, not Lilac: Lilac is Red's own lit body tone and a market awning in it
 * would be exactly the false positive the rebrand exists to prevent.
 *
 * Panels are eight pixels wide, which is the 16px tile's four-pixel stripe at the new scale -- four
 * panels per tile, sixteen across the finished stall, and a seam that lands on the tile boundary so
 * `l, m, m, r` carries the rhythm straight across all four tiles.
 */
const paleStripe = (x: number): boolean => Math.floor(x / 8) % 2 === 0;

const canvasTone = (x: number, step: 'field' | 'fold' | 'edge'): RGBA =>
  paleStripe(x)
    ? shade('fur', step === 'field' ? 3 : step === 'fold' ? 1 : 0)
    : shade('cloak', step === 'field' ? 3 : step === 'fold' ? 2 : 1);

const stallAwning =
  (kind: 'left' | 'middle' | 'right'): Painter =>
  (img) => {
    // The scalloped hem first: the straight run of canvas is painted over the tops of the curves,
    // so only the part that hangs below the hem survives.
    for (let p = 0; p < 4; p++) {
      const cx = p * 8 + 4;
      img.ellipse(cx, 21, 4, 6.5, canvasTone(p * 8, 'edge'));
      img.ellipse(cx, 20.4, 3.2, 5.6, canvasTone(p * 8, 'fold'));
    }

    // The cloth itself, panel by panel.
    for (let x = 0; x < TILE; x++) {
      img.rect(x, 7, 1, 16, canvasTone(x, 'field'));
      // The seam where two panels are stitched together, and the hem the cloth turns under on.
      if (x % 8 === 0) img.rect(x, 7, 1, 16, canvasTone(x, 'fold'));
      img.px(x, 7, canvasTone(x, 'fold')); // the rail's shadow on the cloth
      img.rect(x, 21, 1, 2, canvasTone(x, 'fold'));
    }

    // The front rail the canvas is tacked to.
    img.rect(0, 4, TILE, 1, shade('wood', 2));
    img.rect(0, 5, TILE, 1, shade('wood', 1));
    img.rect(0, 6, TILE, 1, shade('wood', 0));

    // Corner posts, with the brace that holds the rail square.
    if (kind === 'left') {
      img.rect(0, 2, 3, TILE - 2, shade('wood', 1));
      img.rect(0, 2, 1, TILE - 2, shade('wood', 2));
      img.rect(2, 2, 1, TILE - 2, shade('wood', 0));
      img.rect(0, 2, 3, 1, shade('wood', 2));
      img.line(3, 11, 9, 5, shade('wood', 0));
      img.line(3, 10, 8, 5, shade('wood', 1));
    }
    if (kind === 'right') {
      img.rect(TILE - 3, 2, 3, TILE - 2, shade('wood', 1));
      img.rect(TILE - 3, 2, 1, TILE - 2, shade('wood', 2));
      img.rect(TILE - 1, 2, 1, TILE - 2, shade('wood', 0));
      img.rect(TILE - 3, 2, 3, 1, shade('wood', 2));
      img.line(TILE - 4, 11, TILE - 10, 5, shade('wood', 0));
      img.line(TILE - 4, 10, TILE - 9, 5, shade('wood', 1));
    }
  };

/**
 * The counter: a plank front with a knot in it, a lipped top, and goods standing on the top.
 * Four of these sit side by side, so the goods are arranged left and right of centre and the legs
 * fall on a regular beat rather than in a clump.
 */
const stallCounter: Painter = (img) => {
  groundUnder(img, 1, 4301);
  /*
   * The ground behind the counter is under the awning, so it is in shade. This is also what ties
   * the two tiles together: the awning tile's corner posts stop at its own bottom edge, ten pixels
   * above the counter top, and a band of full sunlight in that gap made the awning look like it was
   * floating over a separate table.
   */
  img.rect(0, 0, TILE, 10, shade('shadow', 1, 96));
  // The stall's own shade on the grass, before anything stands in it.
  img.ellipse(16, 29, 15, 3.4, shade('shadow', 1, 90));

  // Legs, then the board that laps over them.
  for (const lx of [4, 23]) {
    img.rect(lx, 24, 5, 6, shade('wood', 0));
    img.rect(lx, 24, 1, 6, shade('wood', 1));
    contactShadow(img, lx + 2.5, 30, 3.4, 1.2);
  }

  /*
   * Front boards. These ran vertically on the first pass, one panel every eight pixels with a lit
   * edge down each: across four tiles that came out as sixteen identical panels with a knot in one
   * of them, which read as a row of cupboard doors with a handle. Horizontal boards instead, so the
   * grain runs the length of the stall the way a counter front is actually built.
   */
  img.rect(0, 15, TILE, 11, shade('wood', 1));
  for (const by of [15, 19, 23]) {
    img.rect(0, by, TILE, 1, shade('wood', 2));
    img.rect(0, by + 3, TILE, 1, shade('wood', 0));
  }
  // Grain, two pegs, and a knot low on the bottom board where nothing reads it as a handle.
  for (const [gx, gy, gw] of [
    [3, 17, 7],
    [19, 21, 8],
    [24, 16, 5],
  ] as const)
    img.rect(gx, gy, gw, 1, shade('wood', 0, 150));
  img.ellipse(11, 24.5, 1.6, 1.2, shade('wood', 0));
  img.px(11, 24, shade('wood', 2));
  for (const px0 of [6, 25]) {
    img.px(px0, 20, shade('wood', 0));
    img.px(px0, 19, shade('wood', 2));
  }
  img.rect(0, 25, TILE, 1, shade('wood', 0));

  // The top: a lit surface with a dark lip under its front edge.
  img.rect(0, 10, TILE, 4, shade('wood', 2));
  img.rect(0, 10, TILE, 1, shade('wood', 3));
  img.rect(0, 14, TILE, 1, shade('wood', 0));

  /*
   * Goods. A basket of fruit left of centre, two jars right of it. The basket's rim was a wide flat
   * ellipse on the first pass, which turned the whole thing into a cake on a stand; it is a two-row
   * band now, narrower than the body, so the body is what you read.
   */
  img.ellipse(9, 7, 4.8, 3.6, shade('wood', 0));
  img.ellipse(9, 7, 4, 3, shade('wood', 1));
  img.ellipse(7.4, 6, 1.8, 1.4, shade('wood', 2));
  for (const y of [6, 8]) img.line(6, y, 12, y, shade('wood', 0));
  for (let x = 6; x <= 12; x += 2) {
    img.px(x, 7, shade('wood', 2));
    img.px(x + 1, 9, shade('wood', 2));
  }
  img.rect(5, 3, 9, 2, shade('wood', 1));
  img.rect(5, 3, 9, 1, shade('wood', 2));
  img.rect(5, 5, 9, 1, shade('wood', 0));
  // Two apples, with the gap between them drawn in: as one overlapping mass they read as a lump of
  // butter sitting on the rim.
  img.ellipse(7.2, 2.4, 1.8, 1.6, shade('gold', 1));
  img.ellipse(11, 2.4, 1.8, 1.6, shade('gold', 1));
  img.px(6.5, 1.8, shade('gold', 2));
  img.px(10.3, 1.8, shade('gold', 2));
  img.rect(9, 1, 1, 3, shade('wood', 0));

  img.rect(19, 5, 5, 6, shade('water', 1));
  img.rect(19, 5, 1, 6, shade('water', 2));
  img.rect(23, 5, 1, 6, shade('water', 0));
  img.rect(20, 3, 3, 2, shade('water', 0));
  img.rect(20, 2, 3, 1, shade('wood', 1));
  img.rect(25, 7, 4, 4, shade('gold', 1));
  img.rect(25, 7, 1, 4, shade('gold', 2));
  img.rect(26, 6, 2, 1, shade('wood', 1));

  // What the goods throw onto the counter top.
  img.ellipse(9, 10.6, 5, 1, shade('wood', 0, 120));
  img.ellipse(21.5, 10.6, 3, 0.9, shade('wood', 0, 120));
  img.ellipse(27, 10.6, 2.4, 0.9, shade('wood', 0, 120));
};

/* ------------------------------------------------------------ the lantern post */

/*
 * The lantern post. The flame stays warm gold: it is a light source and it is the skill the Keeper
 * offers, and section 6a of docs/ART_PRODUCTION.md leaves it alone on purpose while everything else
 * moves off red. So the gold here is the one warm note in the tile, and the pool of light under it
 * is the reason the post is worth a whole tile rather than a silhouette.
 */
const lanternPost: Painter = (img) => {
  groundUnder(img, 0, 9173);

  /*
   * The pool, in four falling steps so the light has an edge that is not a ring. Alpha over the
   * opaque grass above, which is what PIXEL_STANDARD section 4 allows. The first pass hung the
   * lantern down at row 25 and put the pool under it at row 27, which left two rows of grass
   * between a lamp and its own light; the lantern now stops at row 21 and the pool has room.
   */
  img.ellipse(10, 26, 13, 6, shade('gold', 3, 30));
  img.ellipse(10, 26, 10, 4.6, shade('gold', 3, 38));
  img.ellipse(10, 26.5, 6.5, 3, shade('gold', 2, 44));
  img.ellipse(10, 27, 3.5, 1.6, shade('gold', 2, 52));

  // Post, with the light-side column and a little grain.
  img.rect(15, 3, 4, 27, shade('wood', 1));
  img.rect(15, 3, 1, 27, shade('wood', 2));
  img.rect(18, 3, 1, 27, shade('wood', 0));
  for (const gy of [13, 20, 26]) img.rect(16, gy, 2, 1, shade('wood', 0));
  img.rect(14, 28, 6, 2, shade('wood', 0));
  contactShadow(img, 17.5, 30, 4.5, 1.6);

  // Cap and cross-arm.
  img.rect(14, 2, 6, 2, shade('wood', 1));
  img.rect(14, 2, 6, 1, shade('wood', 2));
  img.rect(7, 4, 12, 3, shade('wood', 1));
  img.rect(7, 4, 12, 1, shade('wood', 2));
  img.rect(7, 6, 12, 1, shade('wood', 0));
  img.line(12, 11, 16, 7, shade('wood', 0));
  img.line(12, 10, 15, 7, shade('wood', 1));

  // The hanging ring.
  img.rect(10, 7, 1, 2, shade('stone', 0));

  // Lantern: a pitched metal cap, a glazed box, a foot.
  for (let r = 0; r < 3; r++) {
    img.rect(7 - r, 9 + r, 7 + r * 2, 1, shade('stone', 0));
    img.rect(7 - r, 9 + r, 3, 1, shade('stone', 2));
  }
  img.rect(6, 12, 9, 1, shade('stone', 1));
  img.rect(7, 13, 7, 7, shade('gold', 0));
  img.rect(7, 13, 1, 7, shade('stone', 2));
  img.rect(13, 13, 1, 7, shade('stone', 0));
  img.rect(7, 19, 7, 1, shade('stone', 0));
  // The flame, and what it throws on the glass behind it.
  img.ellipse(10.5, 17, 2.6, 3.4, shade('gold', 1));
  img.ellipse(10.5, 17, 1.8, 2.6, shade('gold', 2));
  img.ellipse(10.5, 17.3, 1, 1.8, shade('gold', 3));
  img.px(10, 14, shade('gold', 2));
  img.px(10, 15, shade('gold', 3));
  img.rect(6, 20, 9, 2, shade('stone', 0));
  img.rect(6, 20, 5, 1, shade('stone', 1));

  // The post catches the lantern on its lit side.
  img.rect(15, 12, 1, 8, shade('gold', 2, 90));
};

/* --------------------------------------------------------------- the fountain */

/*
 * A fountain in a glade: a basin, a spout and falling water. Scenery, and nothing more.
 *
 * At 16px the basin was three stacked ellipses and read as a puddle in a saucer. The whole of the
 * new budget goes on giving it a front wall with jointed stone in it, so it reads as masonry
 * standing in the grass rather than as a shape lying on it.
 */
const fountain: Painter = (img) => {
  groundUnder(img, 2, 5519);
  contactShadow(img, 16.5, 29, 13, 3);

  // Basin body, then its jointed face.
  img.ellipse(16, 25, 13, 5.6, shade('stone', 0));
  img.ellipse(16, 24.6, 12.2, 5, shade('stone', 1));
  for (const sx of [5, 10, 16, 22, 27]) {
    const t = (sx - 16) / 12.2;
    const depth = Math.round(5 * Math.sqrt(Math.max(0, 1 - t * t)));
    img.line(sx, 23, sx, 24.6 + depth - 1, shade('stone', 0));
  }
  img.ellipse(10, 23, 4, 1.4, shade('stone', 2));

  // Rim, then the water inside it.
  img.ellipse(16, 21.4, 13, 4.4, shade('stone', 0));
  img.ellipse(16, 21.2, 12, 3.6, shade('stone', 2));
  img.ellipse(16, 21.6, 9.6, 2.6, shade('water', 0));
  img.ellipse(16, 21.6, 9, 2.2, shade('water', 1));
  img.ellipse(12.5, 20.8, 3.4, 1, shade('water', 2));
  img.line(19, 22, 23, 22, shade('water', 2));

  // Pedestal and upper bowl.
  img.rect(14, 12, 5, 9, shade('stone', 1));
  img.rect(14, 12, 1, 9, shade('stone', 2));
  img.rect(18, 12, 1, 9, shade('stone', 0));
  img.rect(12, 12, 9, 1, shade('stone', 0));
  img.rect(12, 11, 9, 1, shade('stone', 2));
  img.ellipse(16, 10, 8, 3, shade('stone', 0));
  img.ellipse(16, 9.6, 7.2, 2.4, shade('stone', 2));
  img.ellipse(16, 9.8, 5.6, 1.6, shade('water', 0));
  img.ellipse(16, 9.8, 5, 1.2, shade('water', 1));
  img.ellipse(13.6, 9.4, 2, 0.8, shade('water', 2));

  // Finial and the jet, which falls back into the bowl on both sides.
  img.rect(15, 5, 3, 5, shade('stone', 1));
  img.rect(15, 5, 1, 5, shade('stone', 2));
  img.ellipse(16.5, 4.4, 2.6, 1.4, shade('stone', 2));
  img.rect(16, 1, 1, 3, shade('water', 3));
  for (const [dx, dy] of [
    [1, 2],
    [2, 3],
    [3, 5],
    [3, 7],
  ] as const) {
    img.px(16 - dx, 2 + dy, shade('water', 2));
    img.px(17 + dx, 2 + dy, shade('water', 2));
  }
  img.px(13, 8, shade('water', 3));
  img.px(20, 8, shade('water', 3));

  /*
   * Two falls from the bowl's lip into the basin. The first pass drew each as an unbroken column
   * from the lip to the waterline, which read as a blue post holding the bowl up. Water falling
   * this short a distance breaks up, so the column breaks up: solid where it leaves the lip, then
   * beads, then the splash ring where it lands.
   */
  for (const fx of [10, 22]) {
    img.rect(fx, 11, 1, 3, shade('water', 2));
    img.px(fx, 12, shade('water', 3));
    for (const [dy, dx] of [
      [15, 0],
      [16, 0],
      [18, 1],
      [19, 1],
    ] as const)
      img.px(fx + dx, dy, shade('water', 2));
    img.px(fx, 15, shade('water', 3));
    img.px(fx - 1, 20, shade('water', 3));
    img.px(fx + 2, 20, shade('water', 3));
  }
};

/* ------------------------------------------------------------------- the well */

/*
 * The well: stone, a shingled roof on two posts, a windlass with the rope wound on it, and a bucket.
 *
 * Section 6a sends the well roof onto slate with the cottage roof, and it is painted from the same
 * `roof` ramp, so the two roofs in this world stay the same roof.
 */
const well: Painter = (img) => {
  groundUnder(img, 1, 7741);
  contactShadow(img, 16.5, 30, 12, 2.8);

  // Posts first; the roof sits on them and the stonework laps over their feet.
  for (const px0 of [5, 24]) {
    img.rect(px0, 9, 3, 18, shade('wood', 1));
    img.rect(px0, 9, 1, 18, shade('wood', 2));
    img.rect(px0 + 2, 9, 1, 18, shade('wood', 0));
  }

  // Pitched roof: eight courses, each two pixels wider on a side than the one above it.
  for (let r = 0; r < 8; r++) {
    const y = 2 + r;
    const half = 1 + r * 2;
    const x0 = 16 - half;
    const w = half * 2;
    img.rect(x0, y, w, 1, shade('roof', 1));
    img.rect(x0, y, Math.max(2, Math.round(w * 0.35)), 1, shade('roof', 2));
    img.rect(x0 + w - 2, y, 2, 1, shade('roof', 0));
  }
  // Shingle courses, and the notches that make a course read as separate shingles.
  for (const y of [4, 6, 8]) {
    const half = 1 + (y - 2) * 2;
    const x0 = 16 - half;
    const w = half * 2;
    img.rect(x0, y, w, 1, shade('roof', 0));
    img.rect(x0, y + 1, w, 1, shade('roof', 2));
    for (let x = x0 + 2; x < x0 + w - 1; x += 4) img.px(x, y + 1, shade('roof', 0));
  }
  img.rect(14, 2, 4, 1, shade('roof', 3));
  img.rect(1, 10, 30, 1, shade('roof', 0));

  // Windlass: a drum with the rope wound round it, and a crank on the right.
  img.rect(7, 14, 18, 4, shade('wood', 1));
  img.rect(7, 14, 18, 1, shade('wood', 2));
  img.rect(7, 17, 18, 1, shade('wood', 0));
  // The rope wound on the drum. Two pixels of bright hemp per coil turned the drum into a corn cob;
  // one lit pixel over one dark one is enough to say "wound" at this size.
  for (let x = 9; x < 24; x += 3) {
    img.px(x, 15, shade('path', 1));
    img.px(x, 16, shade('path', 0));
  }
  img.rect(25, 15, 4, 1, shade('wood', 0));
  img.rect(28, 15, 2, 4, shade('wood', 1));
  img.rect(28, 15, 1, 4, shade('wood', 2));

  // Stonework: two courses with mortar between them, staggered the way a wall is laid.
  img.ellipse(16, 25.6, 12, 4.8, shade('stone', 0));
  img.ellipse(16, 25.2, 11.2, 4.2, shade('stone', 1));
  img.rect(5, 27, 23, 1, shade('stone', 0));
  for (const sx of [8, 14, 20, 25]) img.line(sx, 24, sx, 26, shade('stone', 0));
  for (const sx of [11, 17, 23]) img.line(sx, 28, sx, 29, shade('stone', 0));
  for (const [hx, hy] of [
    [6, 25],
    [12, 24],
    [18, 24],
    [9, 28],
    [15, 28],
  ] as const)
    img.rect(hx, hy, 2, 1, shade('stone', 2));

  /*
   * The rim, and the dark the bucket goes down into. The mouth was a 17-pixel-wide hole of pure
   * `night` on the first pass and it swallowed the whole tile: at a 26-tile camera the well read as
   * a black blot with a roof over it. It is narrower now, and there is water a little way down it
   * rather than nothing at all.
   */
  img.ellipse(16, 22.2, 12, 4, shade('stone', 0));
  img.ellipse(16, 22, 11, 3.2, shade('stone', 2));
  // A shaft, not a hole: the lit stone of the far wall first, then the dark a little way down it.
  // A single wide ellipse of `night` with the bucket hanging in the middle of it left a black wedge
  // either side of the bucket, and the well read as a face.
  img.ellipse(16, 22.4, 6.6, 1.9, shade('stone', 0));
  img.ellipse(16, 22.8, 5.4, 1.4, shade('night', 1));

  /*
   * Rope and bucket last, in front of the stonework. They were drawn before it on the first pass
   * and the rim ellipse painted straight over both, which left a windlass winding nothing.
   *
   * The bucket is narrow and tapered, and its hoops are its own dark rather than stone: nine pixels
   * wide with pale bands it read as a plank laid across the mouth, with the dark of the shaft
   * showing either side of it as two black wings.
   */
  img.rect(16, 18, 1, 3, shade('path', 1));
  img.rect(17, 18, 1, 3, shade('path', 0));
  img.line(13, 20, 16, 18, shade('stone', 0));
  img.line(17, 18, 19, 20, shade('stone', 0));
  img.rect(13, 20, 7, 6, shade('wood', 1));
  img.rect(14, 26, 5, 1, shade('wood', 1));
  img.rect(13, 20, 1, 6, shade('wood', 2));
  img.rect(19, 20, 1, 6, shade('wood', 0));
  for (const hy of [21, 25]) img.rect(13, hy, 7, 1, shade('wood', 0));
  img.rect(14, 27, 5, 1, shade('wood', 0));
  contactShadow(img, 16.5, 28.4, 4.2, 1.2);
};

/* --------------------------------------------------------------- the signpost */

/*
 * A board on a post, pointing the way to the cottage. The writing is a suggestion of writing and
 * nothing more: UI text is never drawn on the canvas, and at this size a legible word would be a
 * smear anyway.
 */
const WRITING_TOP = [3, 2, 4, 2] as const;
const WRITING_BOTTOM = [2, 4, 3] as const;

const signpost: Painter = (img) => {
  groundUnder(img, 2, 2207);
  contactShadow(img, 16.5, 30, 5.5, 1.8);

  // Post.
  img.rect(14, 6, 4, 24, shade('wood', 1));
  img.rect(14, 6, 1, 24, shade('wood', 2));
  img.rect(17, 6, 1, 24, shade('wood', 0));
  img.rect(14, 6, 4, 1, shade('wood', 2));
  for (const gy of [22, 26, 28]) img.rect(15, gy, 2, 1, shade('wood', 0));

  // Board, with a point on the east end.
  for (let y = 8; y < 20; y++) {
    const tip = 25 + Math.round(6 * (1 - Math.abs(y - 13.5) / 5.5));
    img.rect(2, y, tip - 2, 1, shade('wood', 1));
  }
  img.rect(2, 8, 23, 1, shade('wood', 2));
  img.rect(2, 8, 1, 12, shade('wood', 2));
  img.rect(2, 19, 23, 1, shade('wood', 0));
  // The two planks it is made of.
  img.rect(2, 13, 24, 1, shade('wood', 0));
  img.rect(2, 14, 24, 1, shade('wood', 2));
  // The under edge of the point, and the nails holding the board to the post.
  for (let y = 14; y < 20; y++) {
    const tip = 25 + Math.round(6 * (1 - Math.abs(y - 13.5) / 5.5));
    img.px(tip - 1, y, shade('wood', 0));
  }
  for (const ny of [10, 17]) {
    img.px(4, ny, shade('stone', 0));
    img.px(4, ny - 1, shade('stone', 2));
  }

  // Writing: dashes of uneven length, which is what a word looks like from across a clearing.
  let x = 6;
  for (const len of WRITING_TOP) {
    img.rect(x, 10, len, 2, shade('wood', 0));
    x += len + 2;
  }
  x = 6;
  for (const len of WRITING_BOTTOM) {
    img.rect(x, 16, len, 2, shade('wood', 0));
    x += len + 2;
  }

  // What the board throws on the post below it.
  img.rect(14, 20, 4, 2, shade('wood', 0, 110));
  // A couple of blades at the foot, so the post grows out of the grass instead of onto it.
  for (const [bx, by] of [
    [12, 27],
    [20, 28],
  ] as const) {
    img.px(bx, by, shade('grass', 3));
    img.px(bx, by + 1, shade('grass', 2));
  }
};

/** Keys are the contract the map generator and the tileset both look these up by. */
export const PROP_TILES: Record<string, Painter> = {
  'stall-awning-l': stallAwning('left'),
  'stall-awning-m': stallAwning('middle'),
  'stall-awning-r': stallAwning('right'),
  'stall-counter': stallCounter,
  'lantern-post': lanternPost,
  fountain,
  well,
  signpost,
};
