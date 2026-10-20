// Tiny zero-dependency raster + PNG encoder, plus the palette the tile and sprite painters share.
import { deflateSync } from 'node:zlib';

export type RGBA = [number, number, number, number];

export const rgb = (hex: string, a = 255): RGBA => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  a,
];

/**
 * Each entry is a shade ramp: dark, base, light, highlight.
 *
 * Retuned 2026-10-17 to the concept board's own colours. The previous ramps were a flat olive
 * world: measured against the board, the live render sat at a median luminance of 108 with an
 * interquartile range of 108..117 -- nine levels of brightness across half the screen -- while the
 * board's median is 154 with an IQR of 87..190. The board is bright daylight with deep local
 * shade, not an overcast field, so the fix is a wider, warmer range rather than an overall tint.
 *
 * `shadow` is the one dusk-shadow ramp docs/ASSETS.md allows. It extends `grass` downward rather
 * than introducing a hue: the board's shadows are grass in shade, never black and never purple.
 *
 * Rebranded 2026-10-18 per docs/ART_PRODUCTION.md section 6a. Red's cloak is 50 to 64 per cent of
 * each of her sixteen frames, which is the whole reason she is findable in a green forest, so when
 * the cloak moves to Cyera purple everything else that was red has to move off red or she stops
 * being the one thing the eye catches. Only `cloak`, `roof` and `wolf` change here. The world is
 * still a forest: Cyera's palette has no green, no brown and no water blue, so grass, water, wood,
 * stone and sand are untouched, and Lime appears nowhere in the world art -- it is one call to
 * action per screen.
 *
 * The new values were picked against the ladders already in this table, not by pasting brand hexes:
 * every ramp still climbs in four stops, and each step is kept inside the range the rest of the
 * palette uses (roughly 20 to 45 levels of luma) so the painters' existing shading still reads at
 * 16px.
 */
export const PALETTE = {
  grass: ['#2f7a3e', '#3f9a46', '#50ba51', '#9ed858'],
  shadow: ['#16281a', '#1f3a22', '#2c4f2b', '#3a6332'],
  path: ['#c89a62', '#e2bc86', '#f2cf99', '#fae3bd'],
  water: ['#1a74c8', '#2f9ff0', '#5fcbfc', '#e2f9fc'],
  trunk: ['#4e3520', '#6b4a2b', '#8a6440', '#a37d55'],
  // The darkest step stays in the leaf hue. Sampled straight off the board it came back teal
  // (#1d6b52), which at 16px reads as a hard ink outline round every tree rather than shade.
  canopy: ['#21713c', '#2f9a4a', '#51bb4b', '#86d65c'],
  stone: ['#5f5f66', '#8f8f93', '#b4b4b8', '#d2d2d6'],
  /*
   * The wolf, and only the wolf. He was drawn in `stone` -- the ramp the rocks use -- which is why
   * he read as a grey teddy rather than a predator.
   *
   * The attacker takes the brand's darkest tokens. Deep Purple #441363 sits at level 1 exactly;
   * levels 2 and 3 carry it upward with the chroma pulled out, because saturated purple fur reads
   * as a velvet costume rather than an animal. Level 0 is Black #160923 lifted 13 levels towards
   * Deep Purple rather than Black itself: `paintWolf` finishes with `outline(shade('ink', 0))`,
   * which IS Black, so a Black base would swallow his own outline and cost him the silhouette edge
   * at 16px. It also keeps frames 2 and 3 meaningful -- those are painted straight in `ink`, and
   * the flat-silhouette-in-shadow trick only works if the lit frames are not already ink.
   *
   * Darker than before (span 69 against 72) and he now separates further from Grandma's cool grey
   * shawl than the warm grey-brown did: fur at 29..67 under a shawl at 143..180.
   */
  wolf: ['#241632', '#441363', '#4a3a61', '#6a5789'],
  /*
   * The cottage roof is the biggest red mass in the game and the one thing that would compete with
   * Red, so it goes neutral. Slate is deliberately not a Cyera token -- the brand does not own a
   * roof -- but it is kept warm (R > G > B, Clay's own cast) so the cottage still reads as a
   * cottage and not as rendered concrete.
   *
   * The highlight lands in the Clay #D4D2C8 family one step below Clay itself. Level 3 is the lit
   * cap on every shingle, close to half the painted roof surface; put it on Clay at luma 210 and
   * the roof's mean lands within about fifteen levels of the cream wall beneath it (`wall` base is
   * 222) and the cottage reads as one pale mass at a 26-tile camera. Level 0 is pushed deeper than
   * the old red to compensate for losing hue contrast: the grooves and course lines are drawn in
   * it, and that texture is now what tells a roof from a lawn.
   */
  roof: ['#4a453e', '#787266', '#979082', '#bdb6a7'],
  wall: ['#c4ab8c', '#f3d9c1', '#faeada', '#fffaf0'],
  wood: ['#6b4522', '#9a6a36', '#c08f55', '#dcb882'],
  /*
   * Red herself, option A from section 6a: Lilac-led, so she is findable at a 26-tile camera.
   * ART_PRODUCTION section 6a names three stops for the cloak -- Deep Purple, Lilac, Haze -- and
   * Aubergine is the midtone this table added between the first two. That addition is what went
   * wrong at 16px and again in the first 32px pass, so the roles are written down here as the
   * painter must use them, not as the ramp index would suggest:
   *
   *   0 Deep Purple #441363  her outline, the deep folds and the cloth gathered at the hem
   *   1 Aubergine   #6d2d93  the shaded side only -- the two or three columns turning away
   *   2 Lilac       #d28eff  the lit body, and most of every frame
   *   3 Haze        #e8c6ff  a real highlight: the crown, the brim lip and the lit rim
   *
   * Level 2 carrying the mass is a deliberate departure from PIXEL_STANDARD section 2's "most of
   * any object is level 1", and it is confined to Red. The spec picked four tokens for a four-step
   * ramp with two of them at the dark end, so a Lilac-led cloak cannot also be a level-1-led one.
   * Reordering the ramp instead would silently restyle the toadstool cap, flower-red, the stall
   * awning and the Red portrait, which paint from these same stops in their own roles.
   *
   * Measured after the 2026-10-18 fix, per frame across all sixteen: Lilac 333 px (37.4%),
   * Aubergine 103 px (11.5%), Deep Purple 184 px (20.7%, three quarters of it the one-pixel
   * outline), Haze 39 px (4.4%). Lilac now leads Aubergine 3.2 to 1, where Aubergine led Lilac
   * between 4.6 and 6 to 1 in every frame.
   *
   * Her lightness is the point, and it is worth being careful about which number says so. The
   * median is brittle on a sprite this bimodal -- half of her is cloth and most of the rest is rim,
   * boots and basket -- so it swings between L*34 and L*70 by frame, having sat at exactly L*32 on
   * all sixteen before, pinned there by the Aubergine mass. The stable measures: her mean moves
   * from L*33 to L*49, and the share of her that is at least as light as the grass she stands on
   * (L*57) moves from 17 per cent to about 50. She is no longer in the cast-shadow band with the
   * tree shade and the wolf; she is a pale figure inside a Deep Purple rim at L*18, which is what
   * finds her at a 20-tile camera -- by value, not by hue alone.
   *
   * Two hexes in this table are shared, and both are specified rather than accidental. Level 0 is
   * also `wolf` level 1 and `night` level 2; level 1 is also `night` level 3. Section 6a gives Deep
   * Purple to Red's dark and to the wolf in the same breath, and the pair never collide because the
   * roles differ by an order of magnitude in area: on Red it is a one-pixel rim around an L*70 body,
   * on the wolf it is the body itself at L*18. `night` only ever appears behind a portrait, in the
   * DOM, where Red is not standing on it. Left alone on purpose; see the note on `night` below.
   */
  cloak: ['#441363', '#6d2d93', '#d28eff', '#e8c6ff'],
  skin: ['#c98f63', '#f0c9a0', '#ffe0c0', '#fff0e0'],
  fur: ['#c9c2b4', '#ece6da', '#f8f4ec', '#ffffff'],
  /*
   * Dusk, and every portrait backdrop. Section 6a asks whether this should move onto Deep Purple.
   * It already has: level 2 is Deep Purple #441363 and level 3 is Aubergine #6d2d93, both exact
   * tokens, so there is nothing to move and it is left alone.
   *
   * Two things it is now worth knowing, both of which have to be fixed where the pixels are placed
   * rather than here. Its level 1 to level 2 step is 6 levels of luma, the flattest in this table,
   * which is why the Lantern Keeper's spines (level 1) barely separate from his body (level 2).
   * And `portraitRed` paints the hood in cloak level 1 directly onto a level 2 backdrop: that was
   * 53 levels and a red-against-purple hue flip, and with the rebrand it is 33 levels of the same
   * hue. Moving this ramp would silently restyle all five portrait backdrops and the interact
   * prompt, so the backdrop choice belongs to whoever owns the portrait painters.
   */
  night: ['#1a1026', '#2d1b3d', '#441363', '#6d2d93'],
  gold: ['#9c7420', '#d4a72c', '#f0c84a', '#ffe88a'],
  ink: ['#160923', '#2a1a38', '#3d2a4d', '#543d66'],
} as const satisfies Record<string, readonly [string, string, string, string]>;

export type Ramp = keyof typeof PALETTE;
/** 0 = darkest, 3 = lightest. */
export const shade = (ramp: Ramp, level: 0 | 1 | 2 | 3, alpha = 255): RGBA =>
  rgb(PALETTE[ramp][level], alpha);

/** Perceptual luminance, 0..255. */
export const lumaOf = (c: RGBA): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/*
 * Two additions, both measured rather than felt.
 *
 * `tools/graybox/src/score.ts` compares a rendered region of our world against crops of the
 * approved concept board. At the time these were added the numbers were:
 *
 *     axis                         ours     board
 *     keyline (% under luma 60)    0.64     18.95     <- 1/30th
 *     deep shade (% under luma 81) 2.17     26.68     <- 1/12th
 *     colour variety per 1000px    0.53     25.74     <- 1/50th
 *     luma spread (stdev)         29.88     61.23
 *
 * Those three gaps are not a drawing problem, they are a PALETTE problem, and no amount of
 * redrawing fixes them:
 *
 * - Every ramp has four stops and nothing below the darkest, so there is no value dark enough to
 *   outline with. The board outlines everything in a near-black of the object's own hue, which is
 *   most of why it reads as one illustrated world. Hence `keyline`.
 * - Four stops per ramp caps how many distinct tones a shape can use, which is why variety came in
 *   at a fiftieth of the board's. Hence `tone`, which interpolates along the ramp continuously, so
 *   a leaf clump can round off through a dozen values instead of stepping through four.
 *
 * `shade` is unchanged and remains correct for flat fills -- there are over fifteen hundred calls
 * to it and this does not disturb one of them.
 */

/**
 * The outline value for a ramp: its darkest stop taken down by `drop` luma, hue preserved.
 *
 * Scaled rather than subtracted, so a brown stays brown instead of sliding towards black.
 *
 * The floor is applied to the SCALE, not to each channel. Clamping channels independently is what
 * a first version did, and on an already-dark ramp it turned Red's #441363 into a neutral #060606:
 * every channel hit the same floor, so the hue was gone and the protagonist would have been
 * outlined in the same grey as a rock. Flooring the scale keeps the ratios exactly, so a dark
 * purple outlines in dark purple and only its brightness moves.
 */
export function keyline(ramp: Ramp, drop = 40, alpha = 255, minLuma = 14): RGBA {
  const base = shade(ramp, 0, alpha);
  const l = lumaOf(base);
  if (l <= 0) return base;
  const factor = Math.min(1, Math.max(minLuma / l, (l - drop) / l));
  return [
    Math.round(base[0] * factor),
    Math.round(base[1] * factor),
    Math.round(base[2] * factor),
    alpha,
  ];
}

/**
 * A continuous tone along a ramp: `t` runs 0 (darkest) to 1 (lightest), between the four stops.
 *
 * `tone(r, 0)` is `shade(r, 0)` and `tone(r, 1)` is `shade(r, 3)`; everything between is an
 * interpolation the four-stop palette could not previously express. Use it for anything that should
 * round -- a leaf mass, a trunk, a boulder -- and keep `shade` for flat faces and single-pixel marks.
 */
export function tone(ramp: Ramp, t: number, alpha = 255): RGBA {
  const stops = PALETTE[ramp];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = rgb(stops[i]!, alpha);
  const b = rgb(stops[i + 1]!, alpha);
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    alpha,
  ];
}

/**
 * Smooth value noise over a 2D grid, for variation that spans many tiles.
 *
 * Picking a grass variant per tile with plain random gives white noise: every tile differs from
 * its neighbour and the field averages out to one flat tone at any distance. The board's ground
 * varies in broad patches of sun and shade, which needs a field that is correlated across tiles --
 * so the map samples this at a low frequency and the patches come out several tiles wide.
 */
export function valueNoise2D(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ease = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = ease(x - x0);
    const fy = ease(y - y0);
    const top = hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx;
    const bottom = hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** Deterministic noise so regenerating the art never churns the diff. */
export function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------- the three warm families, promoted here */

/**
 * `PALETTE` has no pink, no red and no russet: after the rebrand it has no saturated warm colour at
 * all below `gold`. These four were built in `tiles/w-undergrowth.ts` for the flowers and the
 * toadstool caps, measured against the board's own blooms, and they are MOVED here unchanged --
 * `cast.ts` wants them for the rabbit's inner ears, nose and blush, `s-props.ts` for the stall cloth
 * and the signpost, and a warm family reconstructed by every painter that happens to need one is how
 * three slightly different reds end up in one frame. Appended rather than inserted, and nothing
 * above this line is touched.
 *
 * `pull` keeps a palette tone's red channel and scales its green and blue down, which is the one
 * transform that turns the warm ramps we own into the warm hues we do not: `gold` is a yellow whose
 * green channel carries most of its luma, so taking that green down two thirds leaves a vermilion
 * standing on gold's own value ladder, four stops and all. Every stop is still a `tone()` of a
 * `PALETTE` entry and no hex is inlined.
 *
 * Probed off `reference/mocks/gameplay-concepts.png` at matched points:
 *
 *   family  source  at t = 1          ours       board          what it is for
 *   rose    skin    #fff0e0  ->       #ff4648    #fb4346        pink petals, inner ears, a blush
 *   ember   gold    #ffe88a  ->       #f74a21    #f74b23        vermilion petals, a warm garment
 *   rust    wood    #c08f55  ->       #c0592c    #bf412e        toadstool caps
 *
 * None of this is a Cyera brand colour and none of it is a status colour. It is world art, the
 * board's own flowers are the reference, and Lime still appears nowhere in the world.
 *
 * ON WHERE TO HOLD EACH ONE, because the obvious choice is wrong for two of the three. `rose` keeps
 * the red channel untouched, so the top of its ramp is pinned near luma 165 -- lighter than the lawn
 * it stands on, which is the one thing a flower must never be. Held over 0 to 0.42 its petals run
 * 108 to 145, which is where the board's pink cross probes. `rust` is pulled harder than a straight
 * reading of the probe asks because at `wood`'s own ratios a cap came out as a flat supermarket
 * brown. Both are deliberate and both are recorded at their callers.
 */
export const pull = (c: RGBA, g: number, b: number): RGBA => [
  c[0],
  Math.round(c[1] * g),
  Math.round(c[2] * b),
  255,
];

/** The board's pink: a coral that leaves green and blue level. `skin` with the yellow taken out. */
export const rose = (t: number): RGBA => pull(tone('skin', t), 0.5, 0.58);

/** The board's red: a vermilion, blue well under green. `gold` with two thirds of its green out. */
export const ember = (t: number): RGBA => pull(tone('gold', t), 0.32, 0.24);

/** The toadstool cap: a russet, `wood` with half its green and a bit less of its blue taken down. */
export const rust = (t: number): RGBA => pull(tone('wood', t), 0.55, 0.42);

/* --------------------------------------------- the tuft, promoted here for the same reason as above */

/*
 * THE CHEVRON TUFT, the one grass mark this project draws twice.
 *
 * It is the board's own, measured off `240 650 100 80 9` and recorded in `tiles/w-ground.ts`: "a fan
 * of four or five short dark strokes springing from one point, about seven of our pixels across and
 * four tall". Two files draw it. `tiles/w-ground.ts` puts one in every lawn variant, and
 * `tiles/w-undergrowth.ts` crosses the foot of all eight of its plants with two or three. They were
 * two copies of one shape and one tone ladder, kept in agreement BY HAND -- `w-undergrowth.ts`'s own
 * note said so and raised the move as an ask, which is this.
 *
 * WHAT MOVED AND WHAT DID NOT. The shape table, the tone ladder and the stepping arithmetic are
 * here. Where a blade's pixel GOES is not: the lawn wraps its tufts across the tile edge on purpose,
 * because a grass tile is laid against its own kind and a mark cut by the pitch is harder to find
 * than one centred in every square, while a scattered decor tile must keep its whole fan inside its
 * own border or it prints half a plant against whatever lawn sits next door. So `chevron` emits
 * `(x, y, i)` and the caller decides -- one wraps and writes a luma into its own tone field, the
 * other clips and writes a colour onto finished pixels.
 *
 * THE TABLE IS RELATIVE, which is the one thing that changed in the move. `w-ground.ts` writes its
 * blade heights absolutely (4, 3, 3) because its tuft is always four rows; `w-undergrowth.ts` needs
 * three-row fans as well, so a height here is an offset from the centre blade's. At `h` 4 this
 * table is the lawn's table exactly.
 *
 * `w-ground.ts` STILL CARRIES ITS OWN COPY and is another owner's file this round, so this is one
 * home and not yet the only one. Its copy also predates `away()` below: at `Math.round`, a left
 * flanker's half-pixel step rounds to -0 where the right one's rounds to 1, so the lawn's fan is a
 * column wider on one side than the other. Raised as an ask rather than reached for.
 */

/** The ramp position of a blade's brightest row, and the step down it per row towards the root. */
export const TUFT_TOP = 0.34;
export const TUFT_STEP = 0.1;

/**
 * A blade's colour `i` rows down from its point: lightest where it catches the light, darkest at the
 * root. Luma 118 falling to 96, which against the four lawn variants' 154 to 192 is a plant standing
 * in front of the grass rather than a patch of it.
 */
export const tuftTone = (i: number): RGBA => tone('grass', Math.max(0, TUFT_TOP - i * TUFT_STEP));

/**
 * `[base dx, tip dx, height relative to the centre blade]` per blade.
 *
 * The centre blade is tallest and vertical; the two flankers spring from beside it and splay out, so
 * the fan is seven pixels across at the tips and one at the root. Three blades and not five: at five
 * the fan welds into one dark mass inside seven pixels and the tuft reads as a small mushroom, which
 * both callers record falling for once.
 */
export const CHEVRON: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [-1, -2, -1],
  [1, 2, -1],
];

/**
 * Round away from zero, which `Math.round` does not do and which this fan needs.
 *
 * `Math.round(0.5)` is 1 and `Math.round(-0.5)` is -0: it rounds half UP, not away from zero, so a
 * splay curve that is symmetric in the arithmetic comes out asymmetric on the pixels. The first
 * render of the undergrowth tuft had it exactly -- the right blade stepped 9, 8, 7 across three rows
 * and the left one stepped 3, 5, 5, which leaves the tip a single pixel two columns clear of the
 * rest of the mark. Its guard is what found it; it was not visible at zoom 9 and nothing in the six
 * axes can see a one-pixel hole.
 */
const away = (v: number): number => Math.sign(v) * Math.round(Math.abs(v));

/**
 * One chevron tuft: `bx, by` is the ROOT of the centre blade and `h` its height, not the top.
 *
 * `put` receives every blade pixel and `i`, its row down from that blade's own point, which is what
 * indexes `tuftTone`.
 *
 * A BLADE MAY NOT STEP SIDEWAYS FASTER THAN ONE PIXEL A ROW, so the splay is capped by the blade's
 * own height. Without the cap a short flanker reaches its full splay in a single row and lands two
 * columns clear of the pixel below it: the stroke comes apart into a dash and a speck. The cap also
 * gives the two sizes their own silhouettes for free -- the four-row fan is seven across, the
 * three-row one five -- rather than making the small one a clipped copy of the big one.
 *
 * The sideways step is squared in the remaining height, so a blade stands vertical for its lower
 * half and gives way only near its point. A blade that steps sideways on every row is a 45-degree
 * dash, and a handful of those is pen hatching.
 */
export function chevron(
  bx: number,
  by: number,
  h: number,
  put: (x: number, y: number, i: number) => void,
): void {
  for (const [bdx, tdx, dh] of CHEVRON) {
    const n = h + dh;
    const splay = Math.sign(tdx) * Math.min(Math.abs(tdx), n - 1);
    for (let i = 0; i < n; i++) {
      const u = n < 2 ? 1 : i / (n - 1);
      put(bx + bdx + away(splay * (1 - u) ** 2), by - (n - 1) + i, i);
    }
  }
}

export class Img {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  px(x: number, y: number, c: RGBA): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (c[3] === 255) {
      this.data.set(c, i);
      return;
    }
    // Source-over so soft shadows and water highlights blend instead of punching holes.
    const a = c[3] / 255;
    const inv = 1 - a;
    this.data[i] = Math.round(c[0] * a + this.data[i]! * inv);
    this.data[i + 1] = Math.round(c[1] * a + this.data[i + 1]! * inv);
    this.data[i + 2] = Math.round(c[2] * a + this.data[i + 2]! * inv);
    this.data[i + 3] = Math.max(this.data[i + 3]!, c[3]);
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  frame(x: number, y: number, w: number, h: number, c: RGBA): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** Filled ellipse; the workhorse for canopies, heads and rocks. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++)
      this.px(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c);
  }

  /** Copies another image, skipping fully transparent pixels. */
  blit(src: Img, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3] !== 0) this.px(dx + x, dy + y, c);
      }
  }

  /** Dark outline around every opaque edge; what makes sprites read at 16px. */
  outline(c: RGBA): void {
    const copy = new Uint8Array(this.data);
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && copy[(y * this.w + x) * 4 + 3]! > 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (opaque(x, y)) continue;
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1))
          this.px(x, y, c);
      }
  }

  png(): Buffer {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    const chunk = (type: string, body: Buffer): Buffer => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const td = Buffer.concat([Buffer.from(type), body]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(td));
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
