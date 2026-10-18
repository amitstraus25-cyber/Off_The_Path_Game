/*
 * Ground: grass and path, at 32x32, per docs/PIXEL_STANDARD.md.
 *
 * This is the floor of the entire game -- forty of these are on screen at once -- so it is the group
 * that decides whether the world looks cheap. Two rules drive everything below.
 *
 * 1. The grass is QUIET. A tile that is individually interesting becomes a visible repeating pattern
 *    the moment it is laid forty times, which is the single most common way a tileset fails. The
 *    four variants are four brightness steps over one base, not four different drawings, and the
 *    variation the player sees comes from `forest-map.ts` scattering them in patches several tiles
 *    wide. Inside a tile the contrast stays low on purpose: a previous 16px pass used three opaque
 *    tones at full contrast and it made the grid MORE obvious, not less.
 *
 * 2. Nothing is ever cut by a frame edge. Every blade, clump, pebble and stone is drawn fully inside
 *    its 32x32 square, so any tile in this file abuts any other tile in this file without half a
 *    feature showing. Features are still allowed to TOUCH an edge, which is what keeps the border
 *    from going bald and printing a visible grid of empty margins when the field is tiled.
 *
 * The eight path edges and corners are seam-free for a different reason: the ragged boundary between
 * sand and grass on a given side is one shared periodic profile, so `path-n` and `path-ne` carry
 * the identical north wobble and two of them laid side by side meet at the same depth. See
 * `ringProfile`.
 *
 * The detail budget over the old 16px tiles is 4x and it is spent on structure: a stone is now a lit
 * cap, a body, a shaded right edge and a contact shadow pressed into the sand, where it used to be
 * two pixels. It is not spent on four times the speckle, which only reads as dirt.
 */
import { Img, noise, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/** 32px per docs/PIXEL_STANDARD.md section 1. `tiles.ts` still carries the old 16px constant. */
const TILE = 32;

type Painter = (img: Img) => void;
type Side = 'n' | 's' | 'e' | 'w';
/**
 * How far through the grass-to-sand transition a pixel is. The ranks run in one direction, grass to
 * sand, which is what lets a corner tile take the minimum across its two sides and get a correct
 * merge for free.
 *
 * 0 grass body | 1 one pixel of grass dark | 2 the lip, grass in shade | 3 the dry crumb line |
 * 4 the pale sand margin | 5 open path.
 */
type Zone = 0 | 1 | 2 | 3 | 4 | 5;

const wrap = (t: number, n: number): number => ((t % n) + n) % n;
const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * A value in 0..1 along a ring of length TILE: `f(TILE)` is exactly `f(0)`, and the walk between
 * them is smooth.
 *
 * This is the whole seam-free-edges trick. Every tile that carries a north band asks this same
 * function for its depth at column x, so `path-n` ends its top edge at the depth `path-ne` starts
 * its top edge at, and a run of edge tiles reads as one wandering boundary rather than a row of
 * squares each with its own idea of where the grass stops.
 */
function ringProfile(seed: number, cells: number): (t: number) => number {
  const rnd = noise(seed);
  const v = Array.from({ length: cells }, () => rnd());
  return (t) => {
    const u = wrap(t, TILE) * (cells / TILE);
    const i = Math.floor(u);
    const e = smooth(u - i);
    return v[i % cells]! * (1 - e) + v[(i + 1) % cells]! * e;
  };
}

/**
 * A filled ellipse that wraps at the tile edge instead of being clipped by it.
 *
 * This is how a feature gets to sit ON a boundary without ever being cut in half. The part that
 * runs off the right edge comes back on the left of the same tile, so the tile still carries its
 * full share of ink right up to the border -- which is what keeps a tiled field from printing a
 * grid of bald margins where the painter was being careful.
 */
function wrapEllipse(img: Img, cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.px(wrap(x, TILE), wrap(y, TILE), c);
    }
}

/* ---------------------------------------------------------------- grass -- */

/**
 * The blade layer: 1px wide, 2px tall strokes. Two pixels is the smallest mark that reads as a blade
 * of grass rather than as grit, and a field of them averages into a texture instead of a rash.
 *
 * The dark blade takes `shadow` rather than `grass` level 0. `shadow` is the one dusk ramp the
 * standard allows and it is grass extended downward, not a hue: against a level 1 base, grass 0 is
 * only about fourteen levels of luma and simply disappeared, where shadow 3 is forty and reads as a
 * blade lying in its own shade. The lit blade is brighter at the tip and the dark one darker at the
 * root, which is the one light from the top-left applied at the smallest scale there is.
 *
 * `y` never reaches the last row, so no blade is ever cut by the bottom edge.
 */
function blades(
  img: Img,
  seed: number,
  count: number,
  lit: number,
  inside: (x: number, y: number) => boolean,
): void {
  const rnd = noise(seed);
  for (let i = 0; i < count; i++) {
    // A quarter of them stand a pixel taller. Three tones of blade height is most of what separates
    // grass from a flat wash of two greens.
    const h = rnd() < 0.26 ? 3 : 2;
    const x = Math.floor(rnd() * TILE);
    const y = Math.floor(rnd() * (TILE - h + 1));
    const up = rnd() < lit;
    let clear = true;
    for (let j = 0; j < h; j++) if (!inside(x, y + j)) clear = false;
    if (!clear) continue;
    for (let j = 0; j < h; j++) {
      const t = j / (h - 1);
      img.px(
        x,
        y + j,
        up
          ? shade('grass', 2, Math.round(104 - t * 52))
          : shade('shadow', 3, Math.round(58 + t * 30)),
      );
    }
  }
}

/**
 * The occasional two-pixel clump: a dark root pair with one lit crown pixel over it. Three pixels is
 * the entire budget -- anything bigger becomes a landmark, and a landmark laid forty times is the
 * repeat this whole file is trying to avoid.
 */
function clumps(
  img: Img,
  seed: number,
  count: number,
  inside: (x: number, y: number) => boolean,
): void {
  const rnd = noise(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * (TILE - 1));
    const y = Math.floor(rnd() * (TILE - 1));
    if (!inside(x, y) || !inside(x + 1, y + 1) || !inside(x, y + 1)) continue;
    img.px(x, y, shade('grass', 2, 200));
    img.px(x, y + 1, shade('shadow', 3, 185));
    img.px(x + 1, y + 1, shade('shadow', 3, 130));
  }
}

/** A few level-3 tips, in the sunlit variants only. A highlight, never a fill. */
function tips(
  img: Img,
  seed: number,
  count: number,
  inside: (x: number, y: number) => boolean,
): void {
  const rnd = noise(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = 1 + Math.floor(rnd() * (TILE - 2));
    if (!inside(x, y) || !inside(x, y + 1)) continue;
    img.px(x, y, shade('grass', 3, 128));
    img.px(x, y + 1, shade('grass', 2, 96));
  }
}

/**
 * Variant 0 is the shaded patch, 3 the sunlit one. The wash is alpha rather than a ramp step so the
 * jump between two neighbouring patches stays small: at four full ramp levels a patch boundary read
 * as a hard-edged rectangle of lighter grass, which is the tile grid showing through the very thing
 * meant to hide it.
 *
 * These are the values the 16px tileset was measured down to, and a laid field confirms them at
 * 32px: a first pass here ran the two ends wider (46 and 58) and the variant patches came back as
 * visible rectangles of different green. The ladder has to stay shallow enough that the patch is
 * felt rather than seen.
 */
const GRASS_WASH: readonly (readonly [0 | 2, number])[] = [
  [0, 42],
  [0, 14],
  [2, 22],
  [2, 50],
];

const ALL = (): boolean => true;

const grass =
  (variant: number): Painter =>
  (img) => {
    const seed = 4100 + variant * 977;
    img.rect(0, 0, TILE, TILE, shade('grass', 1));
    const [level, alpha] = GRASS_WASH[variant] ?? ([2, 0] as const);
    if (alpha > 0) img.rect(0, 0, TILE, TILE, shade('grass', level, alpha));
    // The sunlit variants get more of their blades lit, which is most of why they read as sun on
    // grass rather than as the same tile turned up. 74 blades is the budget: 108 was tried and it
    // tipped the field into a uniform rash -- a tile with no base colour left showing reads as
    // fabric, not as grass, and the base green has to stay the subject.
    blades(img, seed, 74, 0.3 + variant * 0.13, ALL);
    clumps(img, seed + 41, 3, ALL);
    if (variant >= 2) tips(img, seed + 83, variant, ALL);
  };

/* ----------------------------------------------------------------- path -- */

/**
 * Packed sand: sun-dried patches and damp compacted hollows, then grit worked into the whole thing.
 *
 * Two earlier passes failed here and both failures were the same mistake in different clothes. A
 * broad noise field SHARED between the nine path tiles printed one comma shape into every tile and
 * a laid path became a grid of identical paisleys. Making that field finer turned it into a regular
 * diagonal corduroy, because an interpolated lattice has a lattice in it however small the cells
 * are. What works is neither: every patch is placed per tile, so nothing repeats, and every patch
 * WRAPS rather than being clipped, so nothing is cut and no bald margin appears at the borders.
 *
 * The patches are the structure the 4x detail budget buys -- a path that is varying rather than a
 * flat fill with dots on it. The grit is only the last ten per cent.
 */
function sand(img: Img, seed: number): void {
  const rnd = noise(seed);
  img.rect(0, 0, TILE, TILE, shade('path', 1));
  for (let i = 0; i < 9; i++) {
    const dry = rnd() > 0.46;
    wrapEllipse(
      img,
      rnd() * TILE,
      rnd() * TILE,
      2 + rnd() * 4,
      1.5 + rnd() * 2.5,
      dry ? shade('path', 2, 62) : shade('path', 0, 46),
    );
  }
  // Grit. Single pixels cannot be cut by an edge, so no wrapping is needed for these.
  for (let i = 0; i < 54; i++)
    img.px(
      Math.floor(rnd() * TILE),
      Math.floor(rnd() * TILE),
      shade('path', rnd() > 0.45 ? 0 : 3, 70),
    );
}

/**
 * Small stones pressed into the track. Lit cap, body, shaded right edge, and a contact shadow in the
 * sand's own dark -- `shadow` is a grass-at-dusk ramp and would read as a green smear here, so the
 * standard's contact shadow is taken in `path` level 0 instead.
 */
function stones(
  img: Img,
  seed: number,
  count: number,
  inside: (x: number, y: number) => boolean,
): void {
  const rnd = noise(seed);
  for (let i = 0; i < count; i++) {
    const w = 2 + Math.floor(rnd() * 2);
    const x = Math.floor(rnd() * (TILE - w));
    const y = Math.floor(rnd() * (TILE - 3));
    let clear = true;
    for (let j = 0; j < 3 && clear; j++)
      for (let k = -1; k <= w && clear; k++) if (!inside(x + k, y + j)) clear = false;
    if (!clear) continue;
    // Painted at alpha over the sand rather than opaque. `stone` is the cool grey the rocks use and
    // a solid block of it on a warm track reads as a dropped brick; letting the sand through pulls
    // each stone toward the ground it is bedded in, which is what makes it look pressed in.
    img.rect(x, y, w - 1, 1, shade('stone', 2, 190));
    img.rect(x, y + 1, w, 1, shade('stone', 1, 200));
    img.px(x + w - 1, y + 1, shade('stone', 0, 150));
    img.rect(x + 1, y + 2, w, 1, shade('path', 0, 110));
  }
  // Pebbles: one lit pixel over one shaded one. Most of the stone on a worn track is this size.
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = Math.floor(rnd() * (TILE - 1));
    if (!inside(x, y) || !inside(x, y + 1)) continue;
    img.px(x, y, shade('stone', 2, 150));
    img.px(x, y + 1, shade('path', 0, 130));
  }
}

/* ------------------------------------------------------------ path edges -- */

/**
 * One depth profile and one lip profile per side, built once and shared by every tile that carries
 * that side. The concept board has no straight path edge anywhere, so the depth is a slow five-point
 * wander with a sixteen-point jitter on top.
 *
 * There is exactly one `path-n` image in the whole game, so whatever this profile does, it does
 * every 32 pixels along every path edge in the map. The amplitude and the frequency are chosen
 * against that, and it took two passes to get right. At 4 to 12 pixels over five cells the tile
 * carried one big lobe, and a row of them read as a scalloped border with a visible period -- the
 * repeat announcing itself. The fix is not a smaller wobble but a FINER one: nine cells and about
 * two pixels of swing, so the edge is ragged everywhere and nowhere is it a shape you could name.
 * It lands between 5 and 9 pixels deep, and it is never straight for more than two pixels.
 */
const SIDES: readonly Side[] = ['n', 's', 'e', 'w'];
const PROFILE = (() => {
  const depth = {} as Record<Side, (t: number) => number>;
  const lip = {} as Record<Side, (t: number) => number>;
  SIDES.forEach((s, i) => {
    const slow = ringProfile(900 + i * 37, 9);
    const fine = ringProfile(960 + i * 37, 16);
    const rag = ringProfile(990 + i * 37, 11);
    depth[s] = (t) => Math.round(6.8 + slow(t) * 2 + (fine(t) - 0.5) * 2.2);
    // Mostly one pixel. The dark total is always this plus the single grass-0 pixel inside it, so
    // the band runs 2 dark pixels and occasionally 3. At a flat 2 it stopped being a lip and became
    // a hard key line drawn round the path, which is the one thing the standard forbids outlines to
    // do on terrain.
    lip[s] = (t) => (rag(t) > 0.74 ? 2 : 1);
  });
  return { depth, lip };
})();

/**
 * Which zone a pixel is in. At a corner both bands are evaluated and the lower zone wins, so grass
 * beats sand and the two ragged boundaries merge into one L without either strip painting over the
 * other.
 */
function zoneOf(sides: readonly Side[], x: number, y: number): Zone {
  let z: Zone = 5;
  for (const s of sides) {
    const t = s === 'n' || s === 's' ? x : y;
    const j = s === 'n' ? y : s === 's' ? TILE - 1 - y : s === 'w' ? x : TILE - 1 - x;
    const g = PROFILE.depth[s](t);
    const lip = PROFILE.lip[s](t);
    const here: Zone =
      j < g - lip - 1 ? 0 : j < g - lip ? 1 : j < g ? 2 : j === g ? 3 : j === g + 1 ? 4 : 5;
    if (here < z) z = here;
  }
  return z;
}

/**
 * Grass on the named sides, sand in the middle: roughly two pixels of lighter sand, then a darker
 * grass lip, then the grass body. The grass body is painted at level 1 flat, which is the midpoint
 * of the four grass variants, so an edge tile sits correctly against whichever of them the map's
 * noise happens to put beside it.
 */
const pathTile =
  (sides: readonly Side[], seed: number): Painter =>
  (img) => {
    sand(img, seed);
    const zone = (x: number, y: number): Zone => zoneOf(sides, x, y);
    const rnd = noise(seed + 17);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        // Read outward: grass body, one pixel of grass dark, the lip in shade, a dry crumb line,
        // the pale margin, then open sand. Six steps across about four pixels, which is what stops
        // the boundary being a line and makes it a bank the path is worn into.
        switch (zone(x, y)) {
          case 0:
            img.px(x, y, shade('grass', 1));
            break;
          case 1:
            img.px(x, y, shade('grass', 0));
            break;
          case 2:
            img.px(x, y, shade('shadow', 3));
            break;
          case 3:
            img.px(x, y, shade('path', rnd() > 0.72 ? 3 : 2));
            break;
          case 4:
            img.px(x, y, shade('path', 2, 150));
            break;
          default:
            break;
        }
      }
    const onGrass = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < TILE && y < TILE && zone(x, y) === 0;
    const onSand = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < TILE && y < TILE && zone(x, y) === 5;
    blades(img, seed + 211, 74, 0.36, onGrass);
    clumps(img, seed + 233, 3, onGrass);
    stones(img, seed + 307, 4, onSand);
  };

export const GROUND_TILES: Record<string, Painter> = {
  'grass-0': grass(0),
  'grass-1': grass(1),
  'grass-2': grass(2),
  'grass-3': grass(3),
  path: pathTile([], 2201),
  'path-n': pathTile(['n'], 2311),
  'path-s': pathTile(['s'], 2417),
  'path-e': pathTile(['e'], 2521),
  'path-w': pathTile(['w'], 2633),
  'path-ne': pathTile(['n', 'e'], 2741),
  'path-nw': pathTile(['n', 'w'], 2851),
  'path-se': pathTile(['s', 'e'], 2963),
  'path-sw': pathTile(['s', 'w'], 3079),
};
