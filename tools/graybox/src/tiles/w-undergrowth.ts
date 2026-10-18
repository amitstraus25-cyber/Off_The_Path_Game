/*
 * Undergrowth: the six things that get strewn across the lawn.
 *
 * `bush`, `flower-white`, `flower-pink`, `flower-red`, `rock`, `toadstool-ring`. These are the most
 * repeated frames in the game -- `forest-map.ts` scatters them more than a hundred times between
 * them -- so each one has to be legible at a 26-tile camera and uninteresting enough to survive
 * being seen a hundred times.
 *
 * Redrawn against `reference/mocks/gameplay-concepts.png` under `docs/ART_DIRECTION.md`. Four
 * things the board does that the previous pass did not, in the order they matter:
 *
 * **1. The keyline (ART_DIRECTION section 3).** Everything is ringed in a hard dark line a long
 * way below its own darkest shade -- not a shade, a line. The old `bush` was one flat blob at luma
 * 131 against grass at 124: seven levels of separation across the whole silhouette. Here the leaf
 * keyline is `shadow` 1 at luma 47 against a field around 184, and the rock's is `ink` 2 at 52
 * against `stone` 1 at 143. Because every tile in this file is opaque ground with the object drawn
 * on top, `Img.outline()` cannot be used directly: it only paints transparent pixels next to
 * opaque ones, so on an opaque tile it paints nothing. Every object here is therefore composed on
 * its own transparent scratch image, keylined there by `keyline()`, and only then blitted onto the
 * grass. That is section 3.4's prescription and it is the whole mechanical fix.
 *
 * **2. Flowers are a bush first (section 7.6).** The board never puts a flower on open grass and
 * never draws a stem rising out of bare ground. A flower tile is a dark fingered bush with three to
 * five four-petal blooms sitting on it. So `bushTile` and the three flower tiles are one drawing
 * with different foliage outlines and different blooms, which is also what makes them read as one
 * planting rather than four unrelated props.
 *
 * **3. The three flowers are three plants, not three tints.** The board carries exactly three
 * flowering silhouettes and this file takes all of them: a dense round mound with three big blooms
 * (the board's white daisy bush, Explore frame and again at 1290 660), a low wide sprawl with more
 * and smaller blooms on wiry stems (the red one beside it), and a tall narrow leafy spire with
 * blooms up its height (Explore frame at 900 350). After the rebrand `flower-pink` and `flower-red`
 * both paint from `cloak`, so colour cannot separate them -- round mound, wide sprawl and upright
 * spire can, at any camera.
 *
 * **4. The board's red stays rebranded (section 12).** White blooms are `fur`, pink is Haze
 * (`cloak` 3), red is Lilac (`cloak` 2), toadstool caps are Aubergine. The one thing kept warm is
 * the bloom centre: section 12 rules the board's orange dot a contrast device rather than a brand
 * colour, and without it a pale bloom on a dark bush has no middle.
 *
 * Nothing here draws its own grass. The floor gets one opinion and it is `tiles/ground.ts`.
 */
import { Img, noise, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';
import { GROUND_TILES } from './ground.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/* ------------------------------------------------------------------------------- the two ramps */

/*
 * Foliage, five tones, ART_DIRECTION section 5's "large mass" ladder.
 *
 * The board's crown runs luma 44 keyline / 70-80 deep shade / 135-145 shade / 156 base / 178-188
 * lit. `canopy` holds four values at 83 / 113 / 143 / 176 and `shadow` 1 sits at 47, so the ladder
 * below lands within about fifteen levels of the board at every step. Section 14 asks for a teal
 * keyline and a deep-shade step in `canopy`; until those land, `shadow` 1 and 2 are the right
 * VALUES in a neutral green where the board is teal, which section 14 explicitly sanctions.
 *
 * Six tones, which is one more than section 5's five for a large mass and is what the board
 * actually spends on a crown -- section 14 counts them: keyline 44, deep shade 70-80, clump shade
 * 135-145, base 156, lit 178-188. Keyline and under-mass are one role played at two depths, and
 * dropping either of them is what makes the bottom of a bush mush into the grass instead of
 * seating on it. Bottom to top the mass steps body 113, crease 83, under-mass 64, keyline 47, so
 * no two adjacent tones are closer than seventeen levels.
 *
 * The mass averages around luma 125, which is section 7.6's "core at 100-130 against the lawn's
 * 190": shaded lobes on `canopy` 1 and lit ones on `canopy` 2.
 */
const LEAF_LINE = shade('shadow', 1);
const LEAF_SHADE = shade('shadow', 2);
const LEAF_DEEP = shade('canopy', 0);
const LEAF_BODY = shade('canopy', 1);
const LEAF_FACE = shade('canopy', 2);
const LEAF_LIT = shade('canopy', 3);

/*
 * Granite, five tones. The board's boulders are faceted rather than round: a pale top face, a band
 * down the side it turns away on, a dark foot, and a near-black line round the whole thing.
 *
 * The keyline is `ink` 2 rather than the `ink` 3 ART_DIRECTION section 14 suggests, and the
 * arithmetic is the reason. The board's own rock keyline is #3a3645, which is luma 57 by Rec.601;
 * `ink` 3 #543d66 is 72 and `ink` 2 #3d2a4d is 52. Against `stone` 0 at 95, `ink` 2 is 43 levels
 * below -- section 3.1's "roughly 40 luma below the object's darkest shade" -- where `ink` 3 is
 * only 23 and reads as one more grey. Section 14's luma column disagrees with Rec.601 for these
 * two entries; the board's measured hex is the thing both of us were aiming at, so it wins.
 */
const ROCK_LINE = shade('ink', 2);
const ROCK_BASE = shade('ink', 3);
const ROCK_FOOT = shade('stone', 0);
const ROCK_SIDE = shade('stone', 1);
const ROCK_TOP = shade('stone', 2);
const ROCK_CAP = shade('stone', 3);

/* ---------------------------------------------------------------------------- shared machinery */

/** The shipped field grass this tile stands on. Never a local copy: see the note at the top. */
const ground = (img: Img, variant: 1 | 2): void => {
  GROUND_TILES[`grass-${variant}`]!(img);
};

/** A transparent canvas the size of a tile, so an object can be keylined before it is planted. */
const scratch = (): Img => new Img(TILE, TILE);

/**
 * The keyline, per ART_DIRECTION section 3.2: 1 px all the way round, 2 px along the bottom and the
 * lower-right flank of any mass wider than 16 px, and never on the top or the left.
 *
 * The second pixel is not a second outline. It is the line thickening on the side the light does
 * not reach, and it is the thing that seats a boulder or a bush onto the ground rather than leaving
 * it floating on it. The two tests below say which side an empty pixel is on without needing to
 * know anything about the shape: a pixel with two solid pixels stacked above it is under the mass,
 * and a pixel with two solid pixels to its left is off the mass's right flank. At the top edge the
 * pixel above the ring is empty, so the first test cannot fire there, which is what keeps the
 * thickening off the lit side for free.
 */
function keyline(img: Img, c: RGBA, thicken = true): void {
  img.outline(c);
  if (!thicken) return;
  const copy = new Uint8Array(img.data);
  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && copy[(y * img.w + x) * 4 + 3]! > 0;
  let top = img.h;
  let bottom = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (solid(x, y)) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  const waist = (top + bottom) / 2;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (solid(x, y)) continue;
      if (solid(x, y - 1) && solid(x, y - 2)) img.px(x, y, c);
      else if (y > waist && solid(x - 1, y) && solid(x - 2, y)) img.px(x, y, c);
    }
}

/**
 * The bottom of a leaf mass falls away into deep shade before the keyline (section 7.4), in two
 * steps rather than one: four pixels of crease tone and two of the under-mass tone inside it. One
 * flat dark band under a bush is only seventeen levels off the keyline and the two of them read as
 * a smudge; two steps give the eye a ramp down to the line and are what seats the thing.
 *
 * Done per column against the silhouette's own lowest pixel rather than as a horizontal band,
 * because a band across a scalloped bottom edge cuts some lobes in half and misses others, and the
 * straight line it leaves is the single easiest way to make a hand-drawn mass look stamped.
 */
function underShade(img: Img, mid: RGBA, deep: RGBA, seed: number): void {
  const rnd = noise(seed);
  for (let x = 0; x < img.w; x++) {
    let bottom = -1;
    for (let y = img.h - 1; y >= 0; y--)
      if (img.get(x, y)[3] !== 0) {
        bottom = y;
        break;
      }
    if (bottom < 0) continue;
    const d = 4 + (rnd() < 0.4 ? 1 : 0);
    for (let y = bottom; y > bottom - d; y--) if (img.get(x, y)[3] !== 0) img.px(x, y, mid);
    for (let y = bottom; y > bottom - 2; y--) if (img.get(x, y)[3] !== 0) img.px(x, y, deep);
  }
}

/**
 * A lumpy disc: a circle whose radius wanders by about a fifth around its circumference.
 *
 * Section 7.6 is explicit that a bush silhouette is fingered rather than a smooth ellipse, and
 * section 7.1 asks for the same wobble on a leaf clump. Doing it with a handful of radii
 * interpolated round the angle, rather than per-pixel noise, keeps the edge in soft lobes instead
 * of turning it into static -- the detail budget buys structure, not speckle.
 */
function lump(
  img: Img,
  cx: number,
  cy: number,
  r: number,
  c: RGBA,
  seed: number,
  amp = 0.18,
  fingers = 7,
): void {
  const rnd = noise(seed);
  const k: number[] = [];
  for (let i = 0; i < fingers; i++) k.push(1 - amp + rnd() * amp * 2);
  const reach = r * (1 + amp) + 1;
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++)
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / 0.9;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach) continue;
      const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * fingers;
      const i0 = Math.floor(a) % fingers;
      const i1 = (i0 + 1) % fingers;
      const f = a - Math.floor(a);
      if (d <= r * (k[i0]! * (1 - f) + k[i1]! * f)) img.px(x, y, c);
    }
}

/**
 * One leaf clump, lit from the top-left like everything else in the world.
 *
 * `band` is section 7.3's rule in one number. 0 is a clump that is behind or facing away: body
 * only. 1 faces the light: body with a lit face. 2 both faces the light and is in front: the whole
 * clump steps up a tone and earns the highlight. The direction expects three to five band-2 clumps
 * on a full crown, so a bush this size gets two.
 *
 * Each clump is a crease-tone disc a pixel and a half larger than itself with the body set very
 * slightly up and left inside it, so the crease shows about one pixel on the lit flank and two on
 * the shaded one. Because the clumps are painted back to front and overlap by about a third, that
 * same crease lands across whatever this clump tucks in front of: section 7.2's depth line, drawn
 * from the near clump's side.
 *
 * The offset has to stay small and this is the one number in the file worth guarding. At minus one
 * and a third against a ring of plus one and a half the body overhangs the crease on the upper
 * left by two tenths of a pixel, which rounds to nothing, so every clump's body spilled over the
 * crease of the clump above it and the whole bush came out as one flat green pillow with a dark
 * edge. Under half a pixel of offset the crease survives on both flanks and the lobes come back.
 */
type Lobe = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly band: 0 | 1 | 2;
};

function lobe(img: Img, l: Lobe, seed: number): void {
  // A clump the light does not reach creases in the deeper of the two shade tones. That is what
  // puts the gradient across the mass the board has: light clumps parting on thin creases at the
  // top, dark clumps parting on heavy ones at the bottom, rather than one even quilt.
  lump(img, l.x, l.y, l.r + 1.5, l.band === 0 ? LEAF_SHADE : LEAF_DEEP, seed, 0.22, 6);
  lump(img, l.x - 0.4, l.y - 0.45, l.r, l.band === 2 ? LEAF_FACE : LEAF_BODY, seed + 7, 0.22, 6);
  if (l.band === 0) return;
  lump(
    img,
    l.x - 1.4,
    l.y - 1.7,
    l.r * 0.6,
    l.band === 2 ? LEAF_LIT : LEAF_FACE,
    seed + 13,
    0.3,
    5,
  );
  if (l.band !== 2) return;
  // Dapple rather than a disc: broken leaf-sized marks along the lit arc, which gives the eye no
  // shape to memorise when the same tile turns up thirty squares away.
  const rnd = noise(seed + 23);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 1.25 + (rnd() - 0.5) * 1.8;
    const d = l.r * (0.3 + rnd() * 0.4);
    const x = Math.round(l.x + Math.cos(a) * d);
    const y = Math.round(l.y + Math.sin(a) * d * 0.9);
    for (let k = 0; k < (rnd() < 0.5 ? 1 : 2); k++)
      if (img.get(x + k, y)[3] !== 0) img.px(x + k, y, LEAF_LIT);
  }
}

/** A mass of clumps, painted top to bottom so the near ones crease the ones they tuck under. */
function foliage(img: Img, list: readonly Lobe[], seed: number): void {
  [...list]
    .sort((a, b) => a.y + a.x * 0.3 - (b.y + b.x * 0.3))
    .forEach((l, i) => lobe(img, l, seed + i * 31));
}

/**
 * One bloom: a four-petal plus with a warm centre, which is the board's entire flower vocabulary.
 *
 * Two departures from section 16's "9-10 px across with a 2 x 2 centre", both taken off the board
 * rather than invented, and both about the same thing: at the camera the player plays at, a bloom
 * is its centre. Measured at matched scale against the board -- our pixel is 2.21 of its -- the
 * board's open blooms are 11 to 13 of our pixels wide with a centre about a third of that, so
 * `arm` 4 gives an 11 px bloom and `arm` 2 a 7 px one for the smaller plant, and the centre is
 * 3 x 3 with its own lit and shaded pixel. At 9 px with a 2 x 2 centre the warm dot was two pixels
 * and the flower read as a white smudge.
 *
 * No stem and no keyline: a bloom sits inside its bush, and where a petal overhangs the bush's
 * edge the mass's own keyline catches it, which is what the board does too.
 */
function bloom(img: Img, cx: number, cy: number, arm: number, petal: RGBA, dark: RGBA): void {
  const reach = arm + 1;
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++)
      if (
        (Math.abs(dx) <= 1 && Math.abs(dy) <= reach) ||
        (Math.abs(dy) <= 1 && Math.abs(dx) <= reach)
      )
        img.px(cx + dx, cy + dy, petal);
  // The shaded flank: the far row of the lower petal, the far column of the right one, and the two
  // inner shoulders where they turn. One light, from the top-left, on a flower as on a boulder.
  for (let d = -1; d <= 1; d++) {
    img.px(cx + d, cy + reach, dark);
    img.px(cx + reach, cy + d, dark);
  }
  img.px(cx + 1, cy + 2, dark);
  img.px(cx + 2, cy + 1, dark);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) img.px(cx + dx, cy + dy, shade('gold', 2));
  img.px(cx - 1, cy - 1, shade('gold', 3));
  img.px(cx + 1, cy + 1, shade('gold', 0));
  img.px(cx + 1, cy, shade('gold', 1));
  img.px(cx, cy + 1, shade('gold', 1));
}

/** A bud: the same flower a week earlier, for the top of a spike where the board puts them. */
function bud(img: Img, cx: number, cy: number, petal: RGBA, dark: RGBA): void {
  img.rect(cx - 1, cy - 1, 3, 3, petal);
  img.px(cx + 1, cy + 1, dark);
  img.px(cx, cy + 1, dark);
  img.px(cx, cy, shade('gold', 1));
}

/**
 * Grass in shade under anything that stands on the ground (section 4): a flattened ellipse about
 * 1.4 times the object's base, offset down and right, in the ground's own dark rather than in black.
 * These tiles are opaque, so the soft edge may use alpha; a sprite's could not.
 */
function contactShadow(img: Img, cx: number, cy: number, rx: number): void {
  img.ellipse(cx + 1.4, cy + 0.8, rx, 2.8, shade('shadow', 0, 70));
  img.ellipse(cx + 0.6, cy, rx * 0.78, 2.1, shade('shadow', 1, 130));
}

/** Two or three blades crossing an object's foot, so it grows out of the lawn instead of onto it. */
function blades(img: Img, spots: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, h] of spots) {
    img.px(x, y, shade('grass', 1));
    for (let i = 1; i < h; i++) img.px(x + (i > 1 ? 1 : 0), y + i, shade('grass', 0));
  }
}

/** Scanline fill of a closed outline, for the boulders' straight facet edges. */
function poly(img: Img, pts: readonly (readonly [number, number])[], c: RGBA): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [, y] of pts) {
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  for (let y = Math.floor(lo); y <= Math.ceil(hi); y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      if (y0 === y1) continue;
      if ((sy >= y0 && sy < y1) || (sy >= y1 && sy < y0))
        xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++) img.px(x, y, c);
  }
}

/* ------------------------------------------------------------------------------------- the bush */

/*
 * Section 7.6 asks for a bush 36-40 px across, and a 32 px tile cannot have one: a tile that is
 * scattered rather than tiled must keep its whole silhouette, keyline included, off its own edges,
 * or every copy of it prints a hard seam into the grass beside it. So this is 26 px of mass inside
 * a 28 px keylined silhouette, which is as large as the square allows.
 *
 * That makes a lobe's CENTRE a lot less free than it looks. A lobe reaches `(r + 1.5) * 1.22` --
 * its crease ring, times `lump`'s largest finger -- so at radius 4.5 a centre has to stay between
 * x 9.3 and x 21.7 for the mass to land inside 2..29, and the width of the bush comes from the
 * lobes' reach rather than from spreading their centres out. Every layout in this file is built to
 * that rule and `edges` in the preview notes checks it.
 */
const BUSH: readonly Lobe[] = [
  { x: 12, y: 10, r: 4, band: 2 },
  { x: 18, y: 10, r: 3.5, band: 2 },
  { x: 9, y: 13, r: 4, band: 2 },
  { x: 15, y: 13, r: 4.5, band: 1 },
  { x: 21, y: 13, r: 4, band: 1 },
  { x: 10, y: 17, r: 4.5, band: 1 },
  { x: 16, y: 17, r: 4.5, band: 0 },
  { x: 22, y: 17, r: 4, band: 0 },
  { x: 11, y: 21, r: 4.5, band: 0 },
  { x: 17, y: 21, r: 4.5, band: 0 },
  { x: 22, y: 21, r: 4, band: 0 },
];

const bushTile: Painter = (img) => {
  ground(img, 2);
  contactShadow(img, 16, 27, 12);
  const mass = scratch();
  foliage(mass, BUSH, 4100);
  underShade(mass, LEAF_DEEP, LEAF_SHADE, 4133);
  keyline(mass, LEAF_LINE);
  img.blit(mass, 0, 0);
  blades(img, [
    [6, 25, 3],
    [14, 27, 3],
    [24, 26, 3],
  ]);
};

/* ---------------------------------------------------------------------------------- the flowers */

/** Petal and its shaded flank. The warm centre is the same on all three, by section 12. */
type Petals = { readonly petal: RGBA; readonly dark: RGBA };

/**
 * `flower-white`: the board's daisy bush, at 1290 660 on the concept board and again beside the
 * well in the Explore frame. A dense round mound with three big blooms in a loose triangle -- two
 * up, one down and forward -- which is the arrangement the board actually draws, twice.
 */
const MOUND: readonly Lobe[] = [
  { x: 14, y: 11, r: 4, band: 2 },
  { x: 10, y: 14, r: 4.5, band: 2 },
  { x: 20, y: 13, r: 4, band: 1 },
  { x: 15, y: 16, r: 4.5, band: 1 },
  { x: 21, y: 18, r: 4.5, band: 1 },
  { x: 10, y: 19, r: 4.5, band: 0 },
  { x: 15, y: 21, r: 4.5, band: 0 },
  { x: 20, y: 21, r: 4.5, band: 0 },
];

const moundFlower = (b: Petals): Painter =>
  function paintMoundFlower(img) {
    ground(img, 1);
    contactShadow(img, 16, 27, 12);
    const mass = scratch();
    foliage(mass, MOUND, 5200);
    underShade(mass, LEAF_DEEP, LEAF_SHADE, 5233);
    // Far enough apart to keep a run of leaf between them. At eleven pixels across, three blooms
    // any closer than this merge into one white mass and the plant loses its count.
    bloom(mass, 8, 12, 4, b.petal, b.dark);
    bloom(mass, 22, 14, 4, b.petal, b.dark);
    bloom(mass, 15, 22, 4, b.petal, b.dark);
    keyline(mass, LEAF_LINE);
    img.blit(mass, 0, 0);
    blades(img, [
      [7, 26, 3],
      [20, 27, 3],
    ]);
  };

/**
 * `flower-pink`: the board's other bedding plant, the one growing beside the daisies at 1180 600.
 * It sprawls rather than mounds -- wider than it is tall, kept low, with thin wiry stems arching up
 * out of the foliage and more, smaller blooms strung along them. Five blooms at 7 px against the
 * mound's three at 9 px, and a silhouette half the height, so the two separate by shape at the
 * camera distance the player actually plays at and not only at zoom 8.
 */
/*
 * The wings use radius 3, which buys them two and a half pixels of centre travel each way. That is
 * how the sprawl gets to be wider than the mound inside the same safe box: small lobes can stand
 * further out than large ones, so the silhouette widens at the ends instead of mounding.
 */
const SPRAWL: readonly Lobe[] = [
  { x: 11, y: 15, r: 3.5, band: 2 },
  { x: 17, y: 14, r: 3.5, band: 2 },
  { x: 8, y: 18, r: 3, band: 1 },
  { x: 14, y: 18, r: 4.5, band: 1 },
  { x: 20, y: 17, r: 4, band: 1 },
  { x: 23, y: 20, r: 3, band: 0 },
  { x: 10, y: 21, r: 4, band: 0 },
  { x: 16, y: 22, r: 4.5, band: 0 },
  { x: 21, y: 22, r: 4, band: 0 },
];

/** A wiry stem: the board draws these inside the plant, never rising out of bare grass. */
function stem(img: Img, x: number, top: number, foot: number, lean: number): void {
  for (let y = foot; y >= top; y--) {
    const t = (foot - y) / Math.max(1, foot - top);
    const px = Math.round(x + lean * t * t);
    img.px(px, y, LEAF_DEEP);
    if (y % 3 === 0) img.px(px - 1, y, LEAF_FACE);
  }
}

const sprawlFlower = (b: Petals): Painter =>
  function paintSprawlFlower(img) {
    ground(img, 2);
    contactShadow(img, 16, 27, 12);
    const mass = scratch();
    stem(mass, 9, 9, 20, -2);
    stem(mass, 15, 8, 21, 2);
    stem(mass, 22, 11, 22, 3);
    foliage(mass, SPRAWL, 6300);
    underShade(mass, LEAF_DEEP, LEAF_SHADE, 6333);
    // Four open blooms gathered on the lit side with one reaching out right, which is how the
    // board strings them: a clump, not a scattering. Five evenly spaced dots read as polka dots.
    // They sit ON the foliage with only a pixel or two of stem showing above it -- a bloom with a
    // clear run of bare stem under it is the one thing the board never draws.
    bloom(mass, 7, 10, 2, b.petal, b.dark);
    bloom(mass, 16, 8, 2, b.petal, b.dark);
    bloom(mass, 11, 15, 2, b.petal, b.dark);
    bloom(mass, 25, 13, 2, b.petal, b.dark);
    bud(mass, 20, 14, b.petal, b.dark);
    keyline(mass, LEAF_LINE);
    img.blit(mass, 0, 0);
    blades(img, [
      [4, 26, 3],
      [29, 27, 3],
    ]);
  };

/**
 * `flower-red`: the board's upright flowering spire, Explore frame at 900 350. A narrow lacy column
 * of small leaf clumps with blooms up its height -- buds at the top where they have not opened,
 * open blooms lower down -- on a foot of foliage. Tall and thin against the mound's round and the
 * sprawl's wide, which is the third silhouette this file needed and the only one the board gives.
 */
const SPIRE: readonly Lobe[] = [
  { x: 16, y: 7, r: 2.5, band: 2 },
  { x: 13, y: 10, r: 3, band: 2 },
  { x: 19, y: 10, r: 2.5, band: 1 },
  { x: 14, y: 13, r: 3, band: 1 },
  { x: 19, y: 14, r: 3, band: 1 },
  { x: 12, y: 16, r: 3, band: 1 },
  { x: 18, y: 18, r: 3, band: 0 },
  { x: 13, y: 19, r: 3.5, band: 0 },
  { x: 19, y: 21, r: 3.5, band: 0 },
  { x: 15, y: 22, r: 4, band: 0 },
  { x: 11, y: 22, r: 3, band: 0 },
];

const spireFlower = (b: Petals): Painter =>
  function paintSpireFlower(img) {
    ground(img, 1);
    contactShadow(img, 16, 27, 11);
    const mass = scratch();
    stem(mass, 16, 4, 26, -1);
    foliage(mass, SPIRE, 7400);
    underShade(mass, LEAF_DEEP, LEAF_SHADE, 7433);
    // Buds at the top where the board leaves them closed, open blooms down the spike on alternate
    // sides, biggest and lowest last. A spike with its blooms in a column is a string of beads.
    bud(mass, 16, 4, b.petal, b.dark);
    bud(mass, 19, 7, b.petal, b.dark);
    // Nine pixels, not the mound's eleven. The spire is sixteen wide where the mound is twenty-six,
    // so blooms at the mound's size swallow the plant and three of them merge into one purple
    // cross. The third size in the file, and the third thing separating these three tiles.
    bloom(mass, 11, 10, 3, b.petal, b.dark);
    bloom(mass, 20, 16, 3, b.petal, b.dark);
    bloom(mass, 12, 21, 3, b.petal, b.dark);
    keyline(mass, LEAF_LINE);
    img.blit(mass, 0, 0);
    blades(img, [
      [8, 27, 3],
      [22, 27, 3],
    ]);
  };

/* ------------------------------------------------------------------------------------- the rock */

/**
 * A boulder: faceted, not a shaded ball.
 *
 * Section 8 and the board agree. Seen from this camera a rock is mostly its top face, so there is a
 * pale top, a band down the side it turns away on, a dark foot where it meets the ground, and a
 * hard value step at each boundary -- a smooth gradient between them says "potato" at 32 px. Both
 * dividing lines tilt with the light, so the right of the rock turns away sooner than the left.
 *
 * The lit cap runs along the upper-left edge and is allowed to touch the keyline, which is section
 * 8's "light cap of 2-3 px on the top-left face" rather than section 4's inset arc for round
 * masses; on the board the pale face does meet the dark line, with no shade between.
 *
 * `ROCK_BASE` is the fifth tone section 5 wants on a large mass and the one `stone` does not own.
 * The ramp's own darkest step is luma 95, so a rock built from `stone` alone puts nothing at all
 * in the 60-to-81 band the dark census looks for and reads as a pale pebble whatever its keyline
 * does. Two pixels of `ink` 3 at the very foot fix that and are also what the board draws, where a
 * boulder's base goes almost as dark as the line around it.
 */
function boulder(img: Img, outline: readonly (readonly [number, number])[], seed: number): void {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  // A rim of the foot tone first, then the body one pixel inside it. Where this boulder sits
  // against another, that rim is the deep shade section 8 asks for between two rocks, and the
  // keyline only ever appears on the outside of the pile.
  poly(img, outline, ROCK_FOOT);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const inset = outline.map(([x, y]) => [cx + (x - cx) * 0.84, cy + (y - cy) * 0.82] as const);
  poly(img, inset, ROCK_SIDE);

  const h = y1 - y0;
  const turn = (x: number): number => y0 + h * 0.36 - 0.3 * (x - cx);
  const foot = (x: number): number => y0 + h * 0.68 - 0.3 * (x - cx);
  // The cap is the top-LEFT face, not the top edge. Without the x gate it wrapped round to the
  // top-right corner as well, which puts the brightest pixels on the side the sun is not on and
  // turns a boulder into a bald head.
  const lit = (x: number, y: number): boolean =>
    x < cx + (x1 - x0) * 0.2 &&
    (img.get(x - 1, y - 1)[3] === 0 || img.get(x, y - 2)[3] === 0 || img.get(x - 2, y)[3] === 0);
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (img.get(x, y)[3] === 0) continue;
      if (y > foot(x) + 2.8) img.px(x, y, ROCK_BASE);
      else if (y > foot(x)) img.px(x, y, ROCK_FOOT);
      else if (y > turn(x)) img.px(x, y, ROCK_SIDE);
      // One more plane on the top face, canted the other way: granite breaks along two directions
      // and a single top face reads as a pebble worn smooth, which is the opposite of the board.
      else if (x - cx > (turn(x) - y) * 1.6) img.px(x, y, ROCK_TOP);
      else img.px(x, y, lit(x, y) ? ROCK_CAP : ROCK_SIDE);
    }

  // One fracture across the top face, lit on its upper-left lip. It leans hard with the light and
  // stops at the turn: a crack that runs the full height of the rock from rim to foot is a zipper,
  // which is what the first pass of this drew, and a curved one is a worm. Short, straight, canted.
  if (h < 10) return;
  const rnd = noise(seed);
  let fx = Math.round(cx - 2 + rnd() * 2);
  let fy = Math.round(y0 + h * 0.22);
  for (let i = 0; i < Math.round(h * 0.45); i++) {
    if (img.get(fx, fy)[3] !== 0 && fy <= turn(fx) + 1) {
      img.px(fx, fy, ROCK_FOOT);
      if (img.get(fx - 1, fy)[3] !== 0) img.px(fx - 1, fy, ROCK_CAP);
    }
    fy += 1;
    if (rnd() < 0.7) fx += 1;
  }
}

const ROCK_BIG: readonly (readonly [number, number])[] = [
  [4, 18],
  [5, 13],
  [9, 9],
  [15, 8],
  [20, 10],
  [22, 14],
  [22, 21],
  [18, 25],
  [9, 25],
  [5, 22],
];

const ROCK_SMALL: readonly (readonly [number, number])[] = [
  [21, 20],
  [24, 17],
  [28, 18],
  [29, 22],
  [27, 26],
  [22, 26],
];

const ROCK_CHIP: readonly (readonly [number, number])[] = [
  [5, 25],
  [8, 24],
  [10, 26],
  [8, 28],
  [5, 28],
];

const rockTile: Painter = (img) => {
  ground(img, 1);
  contactShadow(img, 15, 26, 13);
  const mass = scratch();
  // Back to front: the small one leans on the big one, so it is drawn second and its foot rim cuts
  // the seam between them.
  boulder(mass, ROCK_BIG, 9100);
  boulder(mass, ROCK_SMALL, 9200);
  boulder(mass, ROCK_CHIP, 9300);
  keyline(mass, ROCK_LINE);
  img.blit(mass, 0, 0);
  blades(img, [
    [3, 24, 3],
    [26, 27, 3],
  ]);
};

/* -------------------------------------------------------------------------------- the toadstools */

/**
 * Aubergine caps with Offwhite spots, per the rebrand (section 12). Three to a tile rather than one
 * -- `forest-map.ts` lays these round a glade, and a cluster gives the ring a rhythm where a single
 * mushroom gives it a dotted line.
 *
 * Each toadstool is composed and keylined on its own scratch and planted back to front, so the
 * front one's line cuts the one behind it instead of the three of them sharing a silhouette. The
 * keyline is `ink` 0, which is a purple-black and so stays inside the cap's own shade family;
 * `wall` 0, the darkest cream the stem owns, is luma 175 and would outline a mushroom in a tone
 * lighter than the grass it stands in.
 *
 * One gap worth recording: `cloak` jumps from 76 at level 1 to 175 at level 2, so a purple cap can
 * have a lit arc or a smooth one and not both. The arc is kept to two pixels for that reason.
 */
function toadstool(img: Img, cx: number, capY: number, rx: number, ry: number, foot: number): void {
  const sw = Math.max(4, Math.round(rx * 0.56));
  const sx = cx - Math.floor(sw / 2);
  img.rect(sx, capY, sw, foot - capY, shade('wall', 1));
  img.rect(sx, capY, 1, foot - capY, shade('wall', 3));
  img.rect(sx + sw - 1, capY, 1, foot - capY, shade('wall', 0));
  img.rect(sx - 1, capY + 2, sw + 2, 1, shade('wall', 2));
  // Cap: the deep tone a pixel proud all round, the Aubergine body inside it, a short lit arc one
  // pixel in from the edge on the side the sun is on, and the gills as a dark line under the brim.
  img.ellipse(cx, capY - 1, rx + 1, ry + 1, shade('cloak', 0));
  img.ellipse(cx, capY - 1.5, rx, ry, shade('cloak', 1));
  // The lit arc runs along the upper-left edge one pixel in from the keyline, per section 4's rule
  // for a round mass: a disc with a second disc cut back out of it, so what is left is a crescent
  // hugging the rim rather than a bright patch sitting in the middle of the cap.
  img.ellipse(cx - rx * 0.14, capY - 2 - ry * 0.16, rx * 0.88, ry * 0.86, shade('cloak', 2));
  img.ellipse(cx + rx * 0.1, capY - 1 + ry * 0.06, rx * 0.78, ry * 0.76, shade('cloak', 1));
  img.ellipse(cx, capY + ry - 2, rx * 0.88, 0.9, shade('cloak', 0));
}

/** Offwhite, with its own shaded pixel: a spot is a disc on a dome, not a sticker. */
function spot(img: Img, x: number, y: number, big: boolean): void {
  img.px(x, y, shade('fur', 3));
  if (!big) return;
  img.px(x + 1, y, shade('fur', 3));
  img.px(x, y + 1, shade('fur', 2));
  img.px(x + 1, y + 1, shade('fur', 2));
}

const toadstoolRing: Painter = (img) => {
  ground(img, 2);
  const one = (
    cx: number,
    capY: number,
    rx: number,
    ry: number,
    foot: number,
    spots: readonly (readonly [number, number, boolean])[],
  ): void => {
    contactShadow(img, cx, foot, rx * 1.3);
    const s = scratch();
    toadstool(s, cx, capY, rx, ry, foot);
    for (const [x, y, big] of spots) spot(s, x, y, big);
    keyline(s, shade('ink', 0));
    img.blit(s, 0, 0);
  };
  // Back to front, which here is highest and smallest first. The three stand clear of one another
  // on purpose: the first pass overlapped them, and three Aubergine domes that touch keyline their
  // outsides only and read as one lumpy purple mass. A ring is three mushrooms or it is nothing.
  one(8, 12, 4, 2.6, 20, [
    [6, 10, false],
    [9, 12, false],
  ]);
  one(24, 14, 4.5, 2.8, 22, [
    [22, 12, false],
    [25, 14, true],
  ]);
  one(16, 19, 7, 4.4, 27, [
    [12, 16, true],
    [18, 14, true],
    [20, 18, true],
    [14, 19, false],
  ]);
  blades(img, [
    [4, 26, 3],
    [20, 27, 3],
    [29, 24, 3],
  ]);
};

/* ----------------------------------------------------------------------------------- the tiles */

export const UNDERGROWTH_TILES: Record<string, (img: Img) => void> = {
  // Three plants, three silhouettes, three bloom sizes. `flower-pink` and `flower-red` both paint
  // from `cloak` after the rebrand -- Haze and Lilac -- so the sprawl and the spire are what tell
  // them apart, and they do it at any camera.
  'flower-white': moundFlower({ petal: shade('fur', 3), dark: shade('fur', 0) }),
  'flower-pink': sprawlFlower({ petal: shade('cloak', 3), dark: shade('cloak', 1) }),
  'flower-red': spireFlower({ petal: shade('cloak', 2), dark: shade('cloak', 0) }),
  bush: bushTile,
  rock: rockTile,
  'toadstool-ring': toadstoolRing,
};
