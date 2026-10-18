/*
 * Water: the river surface, its second phase, the four banks and the fall.
 *
 * Redrawn at 32x32 per docs/PIXEL_STANDARD.md. The 16px versions spent their pixels on per-pixel
 * random speckle, which is the one thing four times the resolution must NOT buy: at 32px the same
 * trick is four times the dirt. So nothing here is speckled. The surface is a base, one undulating
 * swell band, and eleven drawn ripples -- each with a crest, a trough under it and a glint on its
 * lit end. That is structure, and it survives being looked at from a 26-tile camera.
 *
 * Three constraints shape every function below.
 *
 * 1. EVERY TILE IS SEAMLESS WITH ITSELF, because `forest-map.ts` lays these in runs: water in a
 *    3-wide river, `shore-w`/`shore-e` in columns down both banks, `waterfall` in a 3x4 block.
 *    Two copies of one tile are identical, so a feature that runs off an edge continues correctly
 *    if and only if it wraps back into the SAME tile -- hence `wpx` and the fact that every shape
 *    here is periodic with a period that divides 32. No sine in this file has a period that does
 *    not divide the tile.
 *
 * 2. `water` AND `water-2` SHARE A BASE. The map picks between them at random per tile
 *    (`rnd() > 0.5`), so they sit edge to edge constantly. They are the same water with the
 *    highlights moved -- identical fill and identical swell, and only the ripple set drifts -- so
 *    a boundary between them is invisible. Painting them as two different blues would draw the
 *    river as a checkerboard.
 *
 * 3. THE BANK IS ROCK. docs/ART_PRODUCTION.md section 3: rock where the bank is steep, sand only
 *    where the path crosses. The path never crosses a shore tile -- the bridge tiles carry the
 *    crossing -- so there is no sand in this file at all, and the bank is four stones straddling
 *    an irregular waterline with grass behind and a foam line in front.
 *
 * Colour is `shade(ramp, level)` only. `water` for the river, `stone` for the bank rock, `grass`
 * for the land behind it; no raw hex, and no brand colour, because the forest stays a forest.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/** Terrain tiles are 32x32 (docs/PIXEL_STANDARD.md section 1). */
const S = 32;

export const WATER_TILE_SIZE = S;

const wrap = (v: number): number => ((Math.round(v) % S) + S) % S;

/** Plot with both axes wrapped into the tile, so a feature that leaves one edge enters the other. */
const wpx = (img: Img, x: number, y: number, c: RGBA): void => img.px(wrap(x), wrap(y), c);

/** Coordinate-indexed noise, so it is identical in every copy of the tile. */
const hash2 = (x: number, y: number, salt: number): number => {
  let h =
    (Math.imul(wrap(x) + 1, 374761393) +
      Math.imul(wrap(y) + 1, 668265263) +
      Math.imul(salt, 2246822519)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/*
 * Ordered dither. Where two tones meet, half the pixels take the near tone and half the far one in
 * a fixed 4x4 pattern. This is how a pixel surface gets a soft transition without a gradient: every
 * pixel is still exactly one palette colour, which is what `pixelArt: true` needs.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;
const ordered = (x: number, y: number, t: number): boolean =>
  (BAYER[wrap(y) & 3]![wrap(x) & 3]! + 0.5) / 16 < t;

/* --- the surface ---------------------------------------------------------- */

/**
 * The swell: how far the lighter band bows away from level across the tile. One full period per
 * tile plus a half-amplitude second harmonic, so the band undulates instead of ruling a line
 * across the river -- the mistake the 16px tile's three full-width crests made.
 */
const swell = (x: number): number =>
  3.1 * Math.sin((2 * Math.PI * x) / S) + 1.3 * Math.sin((4 * Math.PI * x) / S + 0.9);

/**
 * Base plus swell. Deliberately low contrast: this is the field the ripples sit on, and if it
 * carries much contrast of its own the 32px grid shows through it the moment forty tiles are laid
 * side by side.
 */
function surface(img: Img): void {
  img.rect(0, 0, S, S, shade('water', 1));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const s = Math.sin((2 * Math.PI * (y - swell(x))) / S);
      if (s > 0.66) img.px(x, y, shade('water', 2, 150));
      else if (s > 0.2) img.px(x, y, shade('water', 2, ordered(x, y, 0.55) ? 94 : 66));
      else if (s < -0.66) img.px(x, y, shade('water', 0, 130));
      else if (s < -0.2) img.px(x, y, shade('water', 0, ordered(x, y, 0.55) ? 82 : 56));
    }
}

type Ripple = readonly [x: number, y: number, len: number];

/**
 * Eleven crests, hand-placed. Spacing is uneven on both axes on purpose: evenly spaced ripples
 * read as corduroy, and three in a vertical line read as a reflection of something that is not
 * there.
 */
const RIPPLES_A: readonly Ripple[] = [
  [3, 1, 8],
  [19, 4, 6],
  [27, 6, 7],
  [9, 9, 10],
  [22, 13, 6],
  [1, 15, 7],
  [14, 19, 9],
  [28, 22, 6],
  [6, 24, 8],
  [20, 28, 7],
  [11, 30, 5],
];

/**
 * Phase two is phase one drifted downstream, not a second water: same base, same swell, every
 * crest moved a few pixels and one pixel of length traded. Two tiles that differ only in where the
 * light sits read as one moving surface; two tiles that differ in colour read as a patchwork.
 */
const RIPPLES_B: readonly Ripple[] = RIPPLES_A.map(([x, y, len], i): Ripple => [
  x + 6 + (i % 3),
  y + 2,
  len + (i % 2 ? -1 : 1),
]);

/**
 * One ripple: a lit crest, a trough tucked under and to the right of it, and a two-pixel glint on
 * the left end. Light is top-left everywhere in this project, so the glint is always on the left
 * and the trough always below-right. The end pixels of the crest drop a value so the crest has
 * ends rather than being a dash someone cut with scissors.
 */
function ripple(img: Img, x: number, y: number, len: number): void {
  // Crest, tapered at both ends so it is a wave and not a dash someone cut with scissors.
  for (let i = 0; i < len; i++) {
    const end = i === 0 || i === len - 1;
    wpx(img, x + i, y, shade('water', 2, end ? 120 : 255));
  }
  // Trough tucked under and one pixel right of the crest.
  for (let i = 1; i <= len; i++)
    wpx(img, x + i, y + 1, shade('water', 0, i === len ? 70 : i === 1 ? 90 : 125));
  // Glint on the lit shoulder: a row ABOVE the crest, left of centre. Three rows of value is what
  // turns a line into a wave at 32px, and the whole reason the 16px tile could not do this.
  const g = 1 + Math.floor(len * 0.15);
  const lit = Math.max(2, Math.round(len * 0.3));
  for (let i = 0; i < lit; i++)
    wpx(img, x + g + i, y - 1, shade('water', 3, i === lit - 1 ? 170 : 255));
  wpx(img, x + g - 1, y - 1, shade('water', 2, 150));
}

function river(img: Img, ripples: readonly Ripple[]): void {
  surface(img);
  for (const [x, y, len] of ripples) ripple(img, x, y, len);
}

/* --- the bank ------------------------------------------------------------- */

type Side = 'n' | 's' | 'e' | 'w';

/**
 * How deep the land reaches into the tile, measured from the bank-side edge, at position `t` along
 * that edge. Mean 10.5 of 32, so the tile is about a third land -- close to what the 16px shore
 * gave, which matters because the map's river width is tuned to it: widen the bank here and the
 * river visibly narrows everywhere.
 *
 * Two harmonics, both with a period dividing 32, so the waterline wanders and still joins itself
 * where the tile repeats. docs/PIXEL_STANDARD.md section 5: no straight edge anywhere.
 */
const bankDepth = (t: number): number =>
  12.0 + 3.0 * Math.sin((2 * Math.PI * t) / S + 0.6) + 1.6 * Math.sin((4 * Math.PI * t) / S + 2.3);

/**
 * Where each side starts reading that profile. The map puts `shore-w` down the left bank and
 * `shore-e` down the right bank of the same river, so without this the two banks bulge and the same
 * boulders sit opposite each other at the same height, all the way down -- a canal, not a river.
 */
const PHASE: Record<Side, number> = { n: 0, e: 11, s: 19, w: 6 };

/** Bank space (along the edge, depth into the tile) -> tile space. */
const toTile = (side: Side, t: number, d: number): [number, number] =>
  side === 'w' ? [d, t] : side === 'e' ? [S - 1 - d, t] : side === 'n' ? [t, d] : [t, S - 1 - d];

/** Tile space -> bank space. The inverse of `toTile`, and the reason one painter serves all four. */
const toBank = (side: Side, x: number, y: number): [number, number] =>
  side === 'w' ? [y, x] : side === 'e' ? [y, S - 1 - x] : side === 'n' ? [x, y] : [x, S - 1 - y];

/**
 * Land test, evaluated rather than stored, so it answers correctly for coordinates outside the
 * tile too. That is what the neighbour lookups need: along the bank the tile repeats, so `t` wraps,
 * while across it the neighbour is open ground on one side and open river on the other -- which a
 * negative or over-32 depth gives for free, since `bankDepth` never leaves 6..15.
 */
const isLand = (side: Side, x: number, y: number): boolean => {
  const [t, d] = toBank(side, x, y);
  return d < bankDepth(wrap(t) + PHASE[side]);
};

/**
 * One bank stone, lit top-left. Drawn in tile space rather than bank space precisely so the light
 * does not rotate with the side: a stone on the east bank is lit from the same corner as a stone on
 * the west bank, or the two tiles read as two different times of day.
 *
 * Four ellipses: the shadow side offset down-right, the body, the lit cap, the highlight. Then one
 * crack, which is the 32px detail budget spent on structure -- at 16px this stone was three pixels
 * and could not have had a face.
 */
function stone(img: Img, cx: number, cy: number, rx: number, ry: number, tilt: number): void {
  // A second lobe offset against the first, so the silhouette is a lump of rock rather than a
  // perfect oval. Six identical ovals in a row read as a string of eggs; this is the cheapest fix.
  const lx = cx + rx * 0.42 * tilt;
  const ly = cy + ry * 0.3;
  img.ellipse(cx + 0.9, cy + 1.0, rx, ry, shade('stone', 0));
  img.ellipse(lx + 0.9, ly + 1.0, rx * 0.7, ry * 0.72, shade('stone', 0));
  img.ellipse(cx, cy, rx, ry, shade('stone', 1));
  img.ellipse(lx, ly, rx * 0.7, ry * 0.72, shade('stone', 1));
  img.ellipse(cx - rx * 0.22, cy - ry * 0.28, rx * 0.7, ry * 0.62, shade('stone', 2));
  img.ellipse(cx - rx * 0.44, cy - ry * 0.46, rx * 0.34, ry * 0.3, shade('stone', 3));
  // The cleft between the two lobes. Two pixels, not a drawn crescent: at full length it curled
  // round the body and every stone on the bank read as a beetle.
  if (rx >= 2.6 && ry >= 2.6)
    img.line(cx + rx * 0.3 * tilt, cy + ry * 0.05, lx - rx * 0.1 * tilt, ly, shade('stone', 0));
}

/**
 * The bank run: six stones at uneven intervals, with `push` moving each one off the waterline --
 * positive sits it back on the land, negative wades it out into the shallows. Even spacing at one
 * depth ticks like a ruler; this is a bank.
 */
const STONES: readonly (readonly [
  t: number,
  along: number,
  deep: number,
  push: number,
  tilt: number,
])[] = [
  [2, 3.9, 2.9, 1.0, 1],
  [9, 2.4, 2.0, -2.6, -1],
  [15, 3.4, 2.7, 1.4, -1],
  [21, 2.7, 2.3, -1.6, 1],
  [26, 4.1, 3.1, 0.7, -1],
  [31, 2.0, 1.6, -3.0, 1],
];

function shore(side: Side): (img: Img) => void {
  return (img) => {
    // The river first, and the whole tile of it, so the swell and the crests run unbroken from the
    // open water into the bank. Clipping the surface to the wet part would put a phase break along
    // the waterline, which is exactly where the eye is looking.
    river(img, RIPPLES_A);

    // Grass, with a dark lip wherever it ends. The lip is the land's own contact shadow; without it
    // the bank reads as a sticker laid on the water.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!isLand(side, x, y)) continue;
        const lip =
          !isLand(side, x - 1, y) ||
          !isLand(side, x + 1, y) ||
          !isLand(side, x, y - 1) ||
          !isLand(side, x, y + 1);
        const n = hash2(x, y, 17);
        img.px(
          x,
          y,
          lip
            ? shade('grass', 0)
            : n > 0.92
              ? shade('grass', 2, 64)
              : n < 0.1
                ? shade('grass', 0, 56)
                : shade('grass', 1),
        );
      }
    // A few upright blades, never on the lip row, so the bank is grass rather than green paint.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (
          isLand(side, x, y) &&
          isLand(side, x, y + 1) &&
          isLand(side, x, y - 1) &&
          hash2(x, y, 91) > 0.982
        ) {
          img.px(x, y, shade('grass', 3, 200));
          img.px(x, y + 1, shade('grass', 2, 160));
        }

    // The stones, onto their own layer so their coverage can be read back as a mask. Each is drawn
    // three times, a tile apart along the bank, so a stone sitting on the edge is one stone in the
    // run rather than two half stones meeting at a seam.
    const rocks = new Img(S, S);
    for (const [t, along, deep, push, tilt] of STONES) {
      // `t` is a position on the profile, so the stone sits on the waterline; the tile coordinate
      // is that position less the side's phase, which is what keeps the two banks from matching.
      const d = bankDepth(t) - 0.5 + push;
      const vertical = side === 'w' || side === 'e';
      for (const k of [-1, 0, 1]) {
        const [cx, cy] = toTile(side, t - PHASE[side] + k * S, d);
        stone(rocks, cx, cy, vertical ? deep : along, vertical ? along : deep, tilt);
      }
    }
    img.blit(rocks, 0, 0);

    const isSolid = (x: number, y: number): boolean =>
      isLand(side, x, y) || rocks.get(wrap(x), wrap(y))[3] > 0;

    /*
     * Foam. The first pass of this traced every rock exactly, at full white, one pixel out all the
     * way round -- which is not a waterline, it is a sticker outline, and it made six grey eggs
     * look like clip art. Water breaks where it is pushed against something and runs quiet in the
     * lee, so the line is broken: about two pixels in three take the white, the rest take the lit
     * blue, and the gaps fall in a fixed dither pattern rather than randomly.
     */
    const contact = new Set<number>();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (isSolid(x, y)) continue;
        if (!(isSolid(x - 1, y) || isSolid(x + 1, y) || isSolid(x, y - 1) || isSolid(x, y + 1)))
          continue;
        contact.add(y * S + x);
        img.px(x, y, ordered(x, y, 0.68) ? shade('water', 3) : shade('water', 2, 210));
      }
    // Spray carried off the line: sparse single pixels, never a second ring.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (isSolid(x, y) || contact.has(y * S + x)) continue;
        const near =
          contact.has(wrap(y) * S + wrap(x - 1)) ||
          contact.has(wrap(y) * S + wrap(x + 1)) ||
          contact.has(wrap(y - 1) * S + wrap(x)) ||
          contact.has(wrap(y + 1) * S + wrap(x));
        if (near && hash2(x, y, 137) > 0.62) img.px(x, y, shade('water', 3, 160));
      }
  };
}

/* --- the fall ------------------------------------------------------------- */

/**
 * Strands of falling water: x, width, and the row its first bulge sits on. Widths vary and the
 * gaps between them vary, because a sheet of water does not fall in even stripes. The bulge rows
 * are all different from each other, so the five strands inside one tile never swell in unison --
 * which is the only pulse this tile controls, since the three laid side by side are one image.
 */
const STRANDS: readonly (readonly [x: number, w: number, bulge: number])[] = [
  [1, 3, 3],
  [7, 2, 12],
  [12, 3, 7],
  [18, 2, 20],
  [25, 4, 15],
];

/**
 * Lumps of spray at the foot: x, how far down, and how big. Every one of them stays clear of row
 * 31, because `img.ellipse` clips rather than wraps and a lump cut off at the tile edge lays a
 * hard horizontal line across the fall -- the one thing a four-tile stack cannot have.
 */
const SPRAY: readonly (readonly [cx: number, cy: number, r: number])[] = [
  [4, 25, 3.6],
  [16, 22, 3.2],
  [26, 26, 3.0],
];

/**
 * The fall, and the hardest tile in the set, because `forest-map.ts` lays it 3 wide and 4 tall and
 * every one of those twelve tiles is this exact image. Two passes were thrown away here:
 *
 * - A light sheet with lighter streaks on it. That is the blue rectangle the brief warns about:
 *   a fall reads because of what is BETWEEN the strands, so the sheet is now `water` level 0 and
 *   the strands stand on it.
 * - A full-width churn across the bottom rows with a two-row dark shelf under it. On one tile it
 *   looked like a waterfall; stacked four high it was a ladder, and the eye read the shelves
 *   before it read the water. Six overlapping lumps in its place still merged into one pale
 *   ribbon across every tile, so the spray is now THREE lumps with clear channels between them:
 *   the fall breaks in places and runs straight through in others, which is what a cascade does
 *   and what keeps the stack from reading as four falls in a rack. There is no horizontal line
 *   anywhere in this tile.
 */
function waterfall(img: Img): void {
  img.rect(0, 0, S, S, shade('water', 0));

  for (const [sx, w, bulge] of STRANDS) {
    for (let y = 0; y < S; y++) {
      // Each strand swells and thins down its length. Period 16, not 32: at a full tile per swell
      // it widened for eleven rows at a stretch and read as a stack of rectangles.
      const wide = Math.sin((2 * Math.PI * (y + bulge)) / 16) > 0.6 ? 1 : 0;
      for (let i = 0; i < w + wide; i++) wpx(img, sx + i, y, shade('water', 2));
      // One light, from the top-left. The left edge goes straight from the dark sheet to the lit
      // core with nothing in between, which is what gives the strand an edge; the right edge steps
      // down to level 1. No falloff column beyond that: the pass before this one spent two extra
      // columns per strand on it, which over six strands painted the entire tile light and brought
      // back the blue rectangle by a different route.
      wpx(img, sx + w - 1 + wide, y, shade('water', 1));
      // The bright core, only on the swollen runs: carried the full height it is a neon tube, and
      // six of those is far past the fifth of a shape that level 3 is allowed (section 2).
      if (wide || Math.sin((2 * Math.PI * (y + bulge * 2)) / S) > 0.45)
        wpx(img, sx, y, shade('water', 3));
    }
    // Droplets torn off the strand and falling on their own in the dark beside it.
    for (const k of [0, 1, 2]) {
      const dy = bulge * 3 + k * 11;
      const dx = sx - 2;
      wpx(img, dx, dy, shade('water', 1));
      wpx(img, dx, dy + 1, shade('water', 2));
      wpx(img, dx, dy + 2, shade('water', 1, 150));
    }
  }

  // The spray where it lands: each lump is a shadow, a body and a lit cap, drawn a tile left and
  // right as well, because the map lays the fall three wide and a lump on the edge has to be one
  // lump rather than two halves.
  for (const [cx, cy, r] of SPRAY)
    for (const k of [-1, 0, 1]) {
      img.ellipse(cx + k * S + r * 0.3, cy + r * 0.45, r, r * 0.8, shade('water', 1));
      img.ellipse(cx + k * S, cy + r * 0.15, r * 0.95, r * 0.75, shade('water', 2));
      img.ellipse(cx + k * S - r * 0.3, cy - r * 0.2, r * 0.7, r * 0.5, shade('water', 3));
    }
  // Droplets thrown back up off the lumps, thinning with height so the spray has a direction.
  // No tile-left/tile-right copies here, unlike the lumps: `wpx` wraps where `img.ellipse` clips.
  for (const [cx, cy, r] of SPRAY) {
    const top = Math.round(cy - r * 0.6);
    for (let y = Math.round(cy - r * 3); y < top; y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++)
        if (hash2(x, y, 211) > 0.62 + (top - y) * 0.06) wpx(img, x, y, shade('water', 2));
  }
}

/* --- the seven tiles ------------------------------------------------------ */

export const WATER_TILES: Record<string, (img: Img) => void> = {
  water: (img) => river(img, RIPPLES_A),
  'water-2': (img) => river(img, RIPPLES_B),
  'shore-n': shore('n'),
  'shore-s': shore('s'),
  'shore-e': shore('e'),
  'shore-w': shore('w'),
  waterfall,
};
