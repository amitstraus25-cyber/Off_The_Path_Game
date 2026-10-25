/*
 * GRANDMA'S GARDEN FENCE: a cottage picket fence in brown wood (the client, 2026-10-25, picking
 * option A of three previews -- the painted picket -- "just with brown wood").
 *
 * The nine fence and gate tiles ('fence-h', 'fence-post', 'fence-corner', 'fence-corner-e',
 * 'fence-corner-w', 'gate-n', 'gate-s', 'gate-n-swing', 'gate-s-swing'), spread into
 * s-outdoor.ts `OUTDOOR_TILES`; the bridge stays there.
 *
 * The timber is the `wood` ramp the bridge and the signs are cut from, so nothing here is a new
 * colour. Its darks are `keyline('wood', ...)` -- the ramp's darkest scaled down with the hue
 * kept. One light from the top-left: the left column of every board is lit, the right falls to the
 * ramp's dark.
 */
import { Img, keyline, mix, TILE, tone, type Painter, type RGBA } from '../paint.ts';

/* ------------------------------------------------------------------ colours */

const OUT = keyline('wood', 140); // the outline of every board
const DEEP = keyline('wood', 112); // the darkest timber, under a cap or a rail
/** Timber: 0 is `wood` level 0 (a board in shade), 1 its highlight. Below 0 dips to DEEP. */
const paint = (t: number): RGBA =>
  t >= 0 ? tone('wood', Math.min(t, 1)) : mix(tone('wood', 0), DEEP, Math.min(-t, 1));
const turf = (t: number): RGBA => tone('shadow', t);
const CONTACT = turf(0.08);

function tuft(img: Img, x: number, y: number): void {
  img.rect(x + 1, y + 3, 3, 1, turf(0.04));
  img.px(x, y + 2, turf(0.14));
  img.rect(x + 1, y + 2, 3, 1, turf(0.26));
  img.px(x + 4, y + 2, turf(0.18));
  img.px(x, y + 1, turf(0.44));
  img.px(x + 1, y + 1, turf(0.34));
  img.px(x + 3, y + 1, turf(0.52));
  img.px(x + 2, y + 1, turf(0.62));
  img.px(x + 2, y, turf(0.74));
}

/* --------------------------------------------------------- the picket run */

const PITCH = 8; // four pickets a tile
const P_OFF = 2; // first picket's left keyline; keeps a whole picket clear of each corner post
const P_W = 5; // keyline, lit, face, shade, keyline
const P_TIP = 4; // the point's top row
const P_BASE = 27; // last row of paint
/* Across one picket's three painted columns, and down it: flat paint, a slight fade at the foot. */
const P_ACROSS = [0.92, 0.6, 0.06];
const pAlong = (y: number): number => (y > P_BASE - 5 ? -(y - (P_BASE - 5)) * 0.05 : 0);

/* Two rails behind the pickets, seen only in the gaps: lit top, shaded body, dark underside. */
const RAILS: readonly [number, readonly (RGBA)[]][] = [
  [9, [OUT, paint(0.5), paint(0.05), paint(-0.6), OUT]],
  [19, [OUT, paint(0.5), paint(0.05), paint(-0.6), OUT]],
];

function picket(img: Img, x0: number): void {
  for (let y = P_TIP; y <= P_BASE; y++) {
    const d = y - P_TIP;
    const ins = d === 0 ? 2 : d === 1 ? 1 : 0; // the point: 1, 3, then 5 wide
    for (let i = ins; i < P_W - ins; i++) {
      const edge = i === ins || i === P_W - 1 - ins || d === 0;
      img.px(x0 + i, y, edge ? OUT : paint(P_ACROSS[i - 1]! + pAlong(y)));
    }
  }
  // The point catches the light on its left slope.
  img.px(x0 + 2, P_TIP + 1, paint(1));
  img.rect(x0, P_BASE + 1, P_W, 1, OUT);
}

/** The run, optionally clipped to the columns `keep` allows (for the stubs beside a corner post). */
function run(img: Img, keep: (x: number) => boolean = () => true): void {
  for (const [top, rows] of RAILS)
    rows.forEach((c, i) => {
      for (let x = 0; x < TILE; x++) if (keep(x)) img.px(x, top + i, c);
    });
  const xs: number[] = [];
  for (let x = P_OFF; x < TILE; x += PITCH) xs.push(x);
  const whole = (x: number): boolean => {
    for (let i = 0; i < P_W; i++) if (!keep(x + i)) return false;
    return true;
  };
  for (const x of xs) if (whole(x)) img.ellipse(x + 3.5, P_BASE + 2.5, 4, 1.4, CONTACT);
  for (const x of xs) if (whole(x)) picket(img, x);
  for (const [x, y] of [
    [0, 26],
    [9, 27],
    [20, 26],
    [27, 27],
  ] as const)
    if (keep(x) && keep(x + 4)) tuft(img, x, y);
}

const fenceRail: Painter = (img) => run(img);

/* ------------------------------------------------ the run seen from above */

/*
 * North-south the camera looks along the run, so the pickets stack: each one's point stands in
 * front of the foot of the one behind it, on the same eight-pixel pitch as the face-on run. A
 * narrow strip of rail shows down the garden side (the right), and the run throws one column of
 * shadow on the lawn beyond it.
 */
const NS_X = 10; // left keyline of the stacked pickets; nine columns, to x18
const NS_W = 9;
/* Across the seven painted columns: lit left, falling to the shaded right. */
const NS_ACROSS = [0.22, 0.12, 0.08, 0.04, 0.0, -0.08, -0.3];
/*
 * Down one stacked picket, as a paint t: the point catches the sun, the face under it is plain
 * paint, and the last rows go into the shade of the next picket's point. That pulse, four times a
 * tile, is what makes it a row of pickets rather than a painted pole.
 */
const NS_ALONG = [0, 0.95, 0.85, 0.72, 0.62, 0.48, 0.3, 0.02];
const NS_INSET = [4, 3, 2, 1, 0, 0, 0, 0];
const NS_RAIL = 19; // x19 rail in the pickets' shade, x20 keyline, x21 cast shadow

function nsPicket(img: Img, top: number): void {
  for (let r = 0; r < PITCH; r++) {
    const y = top + r;
    if (y < 0 || y >= TILE) continue;
    const ins = NS_INSET[r]!;
    for (let i = 0; i < NS_W; i++) {
      const x = NS_X + i;
      if (i < ins || i > NS_W - 1 - ins) {
        // Beside the point: the foot of the picket behind, in the point's shadow.
        if (r > 0) img.px(x, y, i === 0 || i === NS_W - 1 ? OUT : paint(-0.12));
        continue;
      }
      const edge = i === ins || i === NS_W - 1 - ins || r === 0;
      img.px(x, y, edge ? OUT : paint(NS_ALONG[r]! + NS_ACROSS[i - 1]!));
    }
  }
}

const fencePost: Painter = (img) => {
  for (let y = 0; y < TILE; y++) {
    img.px(NS_RAIL, y, paint(y % PITCH < 2 ? 0.1 : -0.45));
    img.px(NS_RAIL + 1, y, OUT);
    img.px(NS_RAIL + 2, y, turf(0.1));
  }
  // Draw from the back (top) of the tile to the front so each point overlaps the one behind.
  for (let top = 0; top < TILE; top += PITCH) nsPicket(img, top);
  tuft(img, NS_RAIL - 1, 5);
  tuft(img, NS_X - 3, 21);
};

/* ------------------------------------------------------- the newel post */

/*
 * One square post at every corner, at the posts either side of the gate and at intervals down the
 * long runs: a low pyramid cap over a square slab, then a plain painted shaft. The cap is what says
 * "post" at a glance; the pickets never have one.
 */
const POST_L = 10; // shaft keyline; paint 11..19; keyline 20
const POST_R = 20;
const SHAFT = [0.95, 0.66, 0.6, 0.56, 0.52, 0.48, 0.34, 0.2, 0.04];

const fenceCorner: Painter = (img) => {
  img.ellipse(16.5, 29.5, 8, 1.7, CONTACT);
  // Pyramid cap, rows 0..3, 3 / 7 / 11 / 15 wide: the lit west slope, the shaded east one.
  for (let r = 0; r < 4; r++) {
    const half = 1 + 2 * r;
    const x0 = 15 - half;
    const x1 = 15 + half;
    img.rect(x0, r, 2, 1, OUT);
    img.rect(x1 - 1, r, 2, 1, OUT);
    if (r === 0) img.px(15, 0, OUT);
    for (let x = x0 + 2; x <= x1 - 2; x++) img.px(x, r, paint(x <= 15 ? 1 - r * 0.03 : 0.3 - r * 0.04));
  }
  img.rect(13, 0, 5, 1, OUT);
  // The slab under it, a pixel proud of the shaft on both sides: a lit fascia, then its shadow line.
  for (const [y, t] of [
    [4, 0.78],
    [5, 0.5],
  ] as const) {
    img.px(8, y, OUT);
    img.px(22, y, OUT);
    img.rect(9, y, 13, 1, paint(t));
    img.px(9, y, paint(t + 0.2));
  }
  img.rect(8, 6, 15, 1, OUT);
  // The shaft.
  for (let y = 7; y <= 27; y++) {
    const under = y === 7 ? -0.45 : y === 8 ? -0.2 : 0; // the slab's shadow on the shaft
    const foot = y > 23 ? -(y - 23) * 0.06 : 0;
    img.px(POST_L, y, OUT);
    SHAFT.forEach((t, i) => img.px(POST_L + 1 + i, y, paint(t + under + foot)));
    img.px(POST_R, y, OUT);
    if (img.get(POST_R + 1, y)[3] === 0) img.px(POST_R + 1, y, turf(0.1)); // never over a rail
  }
  img.rect(POST_L, 28, 11, 1, OUT);
  img.rect(POST_L, 29, 11, 1, DEEP);
  tuft(img, POST_L - 3, 26);
  tuft(img, POST_R - 2, 27);
};

const fenceCornerWith =
  (side: 'east' | 'west'): Painter =>
  (img) => {
    run(img, side === 'east' ? (x) => x > POST_R : (x) => x < POST_L);
    fenceCorner(img);
  };

/* ---------------------------------------------------------------- the gate */

/*
 * Each leaf is swung back into the garden and lies along the edge of the lane, seen side-on: a
 * small picket gate with a hinge stile, a latch stile, two rails and a brace, and its points follow
 * a shallow swag down the middle -- the classic cottage gate. The leaf runs from x9 of the opening's
 * cell to x12 of the next, so it is painted once into a 64px strip and cut into the two tiles.
 */
const LEAF_X0 = 9;
const LEAF_X1 = TILE + 12;
const LEAF_H = 17;

function leaf(strip: Img, end: 'north' | 'south'): void {
  const top = end === 'north' ? 0 : TILE - LEAF_H;
  const foot = top + LEAF_H - 1;
  const span = LEAF_X1 - LEAF_X0;
  const swag = (x: number): number => Math.round(4 * Math.sin((Math.PI * (x - LEAF_X0)) / span));
  // Rails and brace behind the pickets.
  for (const ry of [top + 6, foot - 4])
    for (let x = LEAF_X0; x <= LEAF_X1; x++) {
      strip.px(x, ry - 1, OUT);
      strip.px(x, ry, paint(0.45));
      strip.px(x, ry + 1, paint(-0.4));
      strip.px(x, ry + 2, OUT);
    }
  for (let x = LEAF_X0 + 3; x <= LEAF_X1 - 3; x++) {
    const u = (x - LEAF_X0 - 3) / (span - 6);
    const y = Math.round(foot - 4 - u * (foot - 4 - (top + 8)));
    strip.px(x, y, paint(0.4));
    strip.px(x, y + 1, OUT);
  }
  // Pickets, four wide on a six pitch, between the two stiles.
  for (let px = LEAF_X0 + 5; px + 3 <= LEAF_X1 - 4; px += 6) {
    const tip = top + 2 + swag(px + 1);
    for (let y = tip; y <= foot; y++) {
      const d = y - tip;
      if (d === 0) {
        strip.px(px + 1, y, OUT);
        strip.px(px + 2, y, OUT);
        continue;
      }
      strip.px(px, y, OUT);
      strip.px(px + 1, y, paint(d === 1 ? 1 : 0.9));
      strip.px(px + 2, y, paint(0.2));
      strip.px(px + 3, y, OUT);
    }
  }
  // The two stiles, standing a little proud of the pickets, with a ball of a cap on each.
  for (const sx of [LEAF_X0, LEAF_X1 - 3]) {
    for (let y = top + 1; y <= foot; y++) {
      strip.px(sx, y, OUT);
      strip.px(sx + 1, y, paint(y === top + 1 ? 1 : 0.85));
      strip.px(sx + 2, y, paint(0.15));
      strip.px(sx + 3, y, OUT);
    }
    strip.rect(sx, top, 4, 1, OUT);
  }
  strip.rect(LEAF_X0, foot, LEAF_X1 - LEAF_X0 + 1, 1, OUT);
  // A latch on the free stile.
  strip.rect(LEAF_X1 - 5, top + 8, 2, 2, OUT);
}

function cut(paintStrip: (s: Img) => void, half: 0 | 1): Painter {
  return (img) => {
    const strip = new Img(TILE * 2, TILE);
    paintStrip(strip);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const c = strip.get(x + half * TILE, y);
        if (c[3] !== 0) img.px(x, y, c);
      }
  };
}

export const FENCE_TILES: Record<string, Painter> = {
  'fence-h': fenceRail,
  'fence-post': fencePost,
  'fence-corner': fenceCorner,
  'fence-corner-e': fenceCornerWith('east'),
  'fence-corner-w': fenceCornerWith('west'),
  'gate-n': cut((s) => leaf(s, 'north'), 0),
  'gate-s': cut((s) => leaf(s, 'south'), 0),
  'gate-n-swing': cut((s) => leaf(s, 'north'), 1),
  'gate-s-swing': cut((s) => leaf(s, 'south'), 1),
};
