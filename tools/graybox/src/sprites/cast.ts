/*
 * The cast: the four characters who offer Red something, drawn at 32 x 48.
 *
 * Revised 2026-10-19 against the approved board (reference/mocks/gameplay-concepts.png) and the
 * director's review of the previous pass. The previous pass was right about the palette and wrong
 * about the finish, and this one keeps the first and reverses the second.
 *
 * 1. KEEP: `tone()` and `keyline()`. Four flat steps could not hold a rounded mass and the ramps
 *    had nothing dark enough to outline with, so every character now rounds along its ramp and
 *    finishes in its own near-black. That is the board's defining device and it stays.
 *
 * 2. REVERSE: the continuous gradient. Measured, the cast came back at 27.26 distinct colours per
 *    thousand pixels, which is the board's number almost exactly -- and it got there by airbrushing.
 *    The board is crisp pixel art: crop its rabbit and the white body turns through three or four
 *    readable values with hard boundaries between them, inside a hard black line. A smooth ramp
 *    hits the same colour count while reading as soft focus, which is off-style beside a world of
 *    pixel tiles. So `orb` and `taper` now SNAP to `STEPS` levels. That keeps the colour count an
 *    order of magnitude above the old four-stop fills and gets the crispness back; it costs some
 *    edge density, which is the one axis of the six that the director's review found unreachable
 *    (the board profile is measured off a mock drawn at roughly 3 image pixels to one of ours, so
 *    its conceptual edges are smeared by interpolation and counted at a third weight).
 *
 * 3. NO BAKED GROUND. Every character used to finish with a `ground()` contact shadow painted from
 *    the `shadow` ramp -- which is grass in shade, a dark GREEN. Those pixels are part of the
 *    sprite, so they travelled with the rabbit onto the sand and with the keeper onto the bridge
 *    and left a green smudge under the feet on both. The contact is now made the way the board
 *    makes it: a hard bar of the character's own keyline under the feet, filling the gaps between
 *    the toes, so the figure is planted and nothing of the lawn is carried around with it.
 *
 * 4. ONE BODY PLAN PER CHARACTER (2026-10-19, UX review finding 19). Every figure in this file
 *    used to fill the frame: the four here measured 41 to 45 px tall inside a 48 px box, so the
 *    rabbit, the owl, the keeper and the wolf separated by interior detail and by nothing else --
 *    and interior detail is the one thing a 20-tile camera throws away. They are now drawn to the
 *    heights `docs/ART_DIRECTION.md` section 10.2 assigns, which span 26 to 44 here and 14 to 44
 *    across this file and `bystanders.ts` together. `CAST_PLAN` below is the table, the painters
 *    read their own geometry off it rather than repeating numbers, and `assertBodyPlans()` at the
 *    foot of this file refuses to let the art pipeline run if a silhouette drifts out of its box.
 *
 * SILHOUETTE. All four have to be told apart as flat black shapes at a 20-tile camera, and the
 * test is section 10.1's: fill every opaque pixel black, downscale to 24 px, name each one.
 *
 *   rabbit  -- TALL AND NARROW: two upright ears, 14 px of a 34 px figure, four px of sky between
 *   owl     -- WIDE AND SQUAT: one flat-topped barrel 22 across and 26 high, two 3 px ear tufts
 *   keeper  -- THE LANTERN: a bell with a bright box held clear of it on a stick, at shoulder height
 *   wolf    -- LOW AND LONG: the only horizontal back line, muzzle thrust out over air, tail behind
 *
 * LIGHT. One source, up and to the left, for every character (docs/PIXEL_STANDARD.md section 3).
 * `lightAt` is the only place that is written down, so no painter can disagree with another.
 *
 * ALPHA. Every colour here is opaque. `tone` and `keyline` both take an alpha argument and neither
 * is ever passed one: a partly-transparent colour drawn onto a transparent pixel leaves partial
 * alpha in the file, which docs/ASSETS.md forbids. Soft edges are built out of a darker tone.
 */
import { Img, keyline, shade, tone } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';
import { BYSTANDER_FRAMES, BYSTANDER_PLAN } from './bystanders.ts';

/**
 * How many values a shaded mass is allowed to use between `lo` and `hi`.
 *
 * Six is the number the board's own masses use once you stop counting the interpolation its
 * upscale introduced: the rabbit's body is white, two greys and a keyline; the owl's back is three
 * browns and a keyline. Six leaves room for a rim and a core without the boundaries disappearing.
 * Raise it and the shading goes smooth again; drop it to four and we are back to flat `shade`.
 */
const STEPS = 6;

/** Snap a 0..1 shading parameter to one of `n` evenly spaced levels. */
const snap = (t: number, n: number): number =>
  n <= 1 ? t : Math.round(Math.max(0, Math.min(1, t)) * (n - 1)) / (n - 1);

/**
 * How lit a point on a rounded surface is, 0 (full shade) to 1 (full light), from its offset
 * within the shape. `dx`/`dy` are normalised so that the rim is at distance 1.
 *
 * The light is up and to the left, so `-dx - dy` is the surface facing it. The cubic term darkens
 * the last pixel or two of the rim on every side, which is what gives a mass a soft dark edge for
 * the keyline to sit against -- the board's trick, and the reason its shapes read as round rather
 * than as stickers.
 */
const lightAt = (dx: number, dy: number): number => {
  const d = Math.min(1, Math.hypot(dx, dy));
  const face = (-dx - dy) * 0.5 + 0.5;
  return Math.max(0, Math.min(1, face * 0.88 + 0.12 - 0.42 * d * d * d));
};

/**
 * A ball: an ellipse lit from up-left that turns along `ramp` between `lo` and `hi` in `steps`
 * readable bands rather than either four flat stops or a continuous blur.
 */
function orb(
  img: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: Ramp,
  lo = 0.05,
  hi = 1,
  lean = 0,
  steps = STEPS,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const ox = cx + lean * (y + 0.5 - cy);
    const half = rx * Math.sqrt(1 - dy * dy);
    for (let x = Math.floor(ox - half); x <= Math.ceil(ox + half); x++) {
      const dx = (x + 0.5 - ox) / rx;
      if (dx * dx + dy * dy > 1) continue;
      img.px(x, y, tone(ramp, lo + (hi - lo) * snap(lightAt(dx, dy), steps)));
    }
  }
}

/**
 * A tapering rounded stroke that turns ACROSS its width: limbs, muzzles, tails, ears, poles.
 *
 * The shading is computed from the offset perpendicular to the stroke's axis, not per-disc, so the
 * tone stays consistent down the whole length. Stamping shaded discs along a line instead -- the
 * obvious implementation -- bands the stroke, because each disc re-shades the pixels the last one
 * already covered.
 */
function taper(
  img: Img,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  ramp: Ramp,
  lo = 0.05,
  hi = 1,
  steps = STEPS,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // Which side of the stroke faces the light; +1 means the +n side is the lit one.
  const facing = -(nx + ny) / Math.SQRT2;
  const stamps = Math.ceil(len * 3);
  for (let i = 0; i <= stamps; i++) {
    const t = i / stamps;
    const r = (w0 + (w1 - w0) * t) / 2;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const ax = x + 0.5 - cx;
        const ay = y + 0.5 - cy;
        if (ax * ax + ay * ay > r * r) continue;
        const s = r > 0 ? Math.max(-1, Math.min(1, (ax * nx + ay * ny) / r)) : 0;
        const k = Math.max(
          0,
          Math.min(1, (s * facing * 0.5 + 0.5) * 0.9 + 0.1 - 0.3 * Math.abs(s) ** 3),
        );
        img.px(x, y, tone(ramp, lo + (hi - lo) * snap(k, steps)));
      }
  }
}

/**
 * The contact the ground is owed, made out of the character's own keyline instead of out of the
 * lawn.
 *
 * Runs BEFORE `outline`, so the outline then wraps it and the base reads as two dark pixels thick
 * where the feet touch and one everywhere else. It only paints transparent pixels that have
 * something of the sprite within three rows above them, which is what closes the gaps between the
 * toes into one planted line without drawing a puddle out to the edges of the frame.
 */
function base(img: Img, x0: number, x1: number, y: number, c: RGBA): void {
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    if (x < 0 || x >= img.w || y < 0 || y >= img.h) continue;
    if (img.get(x, y)[3] !== 0) continue;
    let near = false;
    for (let k = 1; k <= 3 && !near; k++) if (y - k >= 0 && img.get(x, y - k)[3] !== 0) near = true;
    if (near) img.px(x, y, c);
  }
}

// ------------------------------------------------------------------------ the body plan (10.2)

/**
 * The box each character's flat black shape has to fill, and the feature that breaks its outline.
 *
 * Straight out of `docs/ART_DIRECTION.md` section 10.2, which is binding, and the whole answer to
 * UX review finding 19. Two things about these numbers are worth knowing before changing one:
 *
 * - **They are the OUTLINED bbox**, because that is the shape a player sees and the shape section
 *   10.1 tests. `Img.outline()` rings every opaque edge on four neighbours, so it grows the bbox
 *   by exactly one pixel on each side: a painter aiming at `h: 34` draws its art between rows
 *   `top + 1` and 46 and lets `base()` and the outline reach rows 47 and `top`.
 * - **`w` is the whole figure**, signature feature included. Section 10.2 quotes the keeper's body
 *   at 24 and then hangs a lantern off it, and the two numbers cannot both be the bbox. The bbox is
 *   what separates him from Red, so the bbox is what is written down here, with the body width in
 *   the note beside it.
 *
 * `h` is held to the section 10.2 figure exactly. `w` is held to it except where a breaking feature
 * legitimately sits outside the body -- the keeper's lantern, the magpie's bill, the snail's
 * stalks -- and except where two characters would otherwise land inside each other's bands; the
 * three that moved are commented at their entry in this table and in `BYSTANDER_PLAN`.
 */
export const CAST_PLAN = {
  'npc-rabbit': { w: 21, h: 34, widest: 'the base', breaks: 'two upright ears, 4 px of sky apart' },
  'npc-owl': { w: 22, h: 26, widest: 'mid-height', breaks: 'two 3 px ear tufts at the corners' },
  // Body 24 wide at the hem, per 10.2; the lantern on its pole takes the bbox out to the frame.
  'npc-lantern-keeper': { w: 32, h: 44, widest: 'the hem', breaks: 'the lantern, held clear' },
  'npc-wolf': { w: 30, h: 30, widest: 'the shoulder', breaks: 'the tail, off the rear edge' },
} as const satisfies Record<string, { w: number; h: number; widest: string; breaks: string }>;

// ----------------------------------------------------------------------------- the rabbit

/** The rabbit's own near-black: eyes, mouth, and the keyline. `fur` starts at luma 195. */
const RABBIT_DARK: RGBA = keyline('fur', 165);

/**
 * TALL AND NARROW, which is the whole of him: 21 x 34, and fourteen of those rows are ear.
 *
 * The board's rabbit is a chibi -- a head nearly as wide as the body is tall, two broad ears
 * leaning apart with a wide pink inner, two paws, two feet, a round tail, and a face of black oval
 * eyes, a warm nose, a small "w" mouth and a blush on each cheek. All of that is kept. What
 * changed on 2026-10-19 is the PROPORTION, and it is the only thing a 20-tile camera reads: he was
 * 22 x 44, which put him in the same box as the cat and within three rows of Red, so the forest
 * held three upright figures of one size. At 21 x 34 he is two thirds of Red's height and the
 * tallest thing on him is a pair of ears with sky between them.
 *
 * THE GAP IS THE SIGNATURE and it has to survive the outline. Section 10.2 asks for 4 px of sky
 * between two 4 px ears; `outline()` eats one pixel off each facing edge, so the ears are drawn
 * with SIX px of air between them and four px of it is still sky in the finished frame. Drawn with
 * a four-pixel gap -- the obvious reading -- the finished rabbit has two pixels of sky and the ears
 * read as one notched slab.
 *
 * The satchel is his, and it is the point of him: he is the character who hands Red a thing. It
 * hangs on the near hip on a strap across the chest, drawn in `wood` so it is the one warm mass on
 * an otherwise white animal.
 *
 * The breath moves the head, ears and face only; the body, paws and feet stay planted, which is
 * what makes a one-pixel bob look like breathing rather than like the sprite sliding.
 */
function paintRabbit(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  /*
   * --- ears: 4 px wide, 14 rows of the 34, leaning apart, six px of air between them ---
   *
   * Centred on 11 and 21 rather than on 12 and 20: the pair then spans x 9..23, which is wider
   * than the head and narrower than the feet, so the outline reads ear, head, base as three
   * different widths going down. Set any closer together and the head's own silhouette swallows
   * their bases.
   */
  const ear = (xb: number, xt: number): void => {
    taper(img, xb, 29 + b, xt, 16.3 + b, 4.4, 3.0, 'fur', 0.12, 1);
    taper(img, xb + (xt - xb) * 0.12, 27.6 + b, xt, 18.0 + b, 2.4, 1.6, 'skin', 0.0, 0.5);
  };
  ear(11.4, 10.2);
  ear(20.6, 21.8);

  // --- body: small, under a big head, and narrow enough to leave the paws against the chest ---
  orb(img, 16, 42, 6.4, 4.6, 'fur', 0.0, 1);
  // The turn down his right side. The board's rabbit is white with one grey side, and `fur` is so
  // pale that the rim's own falloff cannot supply it: it has to be painted as its own mass.
  orb(img, 18.6, 42.4, 3.8, 4.0, 'fur', 0.0, 0.3);

  /*
   * Feet, planted, splayed, and never bobbing with the breath. They are what makes him "widest at
   * the base" (10.2): the pair reaches x 7..25, two pixels wider each side than the body above.
   */
  for (const fx of [10.4, 21.6]) orb(img, fx, 44.8, 3.2, 2.2, 'fur', 0.18, 0.9);
  img.line(16, 43.4, 16, 46.2, RABBIT_DARK); // the groove that makes them two feet, not a base

  // Cotton tail, out to the right: the one thing on him allowed to be at the top of the ramp.
  orb(img, 23.4, 41.4, 2.0, 1.9, 'fur', 0.5, 1);

  // Front paws against the chest, as the board draws them -- not arms hanging clear of the flanks.
  // At a twelve-row body an arm is three pixels of nothing; two paws and a groove read at once.
  for (const px0 of [13.2, 18.8]) orb(img, px0, 39.4, 2.0, 1.8, 'fur', 0.08, 0.72);
  img.line(16, 38.4, 16, 40.4, RABBIT_DARK);

  // --- the satchel: strap over the far shoulder, pouch on the near hip, in front of the paw ---
  taper(img, 20.4, 36.4, 12.4, 41.0, 2.0, 2.0, 'wood', 0.06, 0.5);
  orb(img, 9.8, 42.0, 2.8, 2.6, 'wood', 0.0, 0.46); // the bag
  taper(img, 7.4, 40.4, 12.0, 39.8, 2.2, 2.2, 'wood', 0.4, 0.95); // its lid, a band lighter
  img.px(10, 42, shade('gold', 2)); // and its buckle

  // --- head, big and round, in front of the ear bases ---
  // Flatter in y than in x by half a pixel, which buys a row of visible ear: thirteen of the
  // thirty-four rows are ear, against the forty per cent section 10.2 asks for.
  orb(img, 16, 32.4 + b, 7.4, 5.8, 'fur', 0.08, 1);
  orb(img, 19.0, 33.0 + b, 4.0, 4.2, 'fur', 0.0, 0.34); // the same turn, on the head

  // Eyes: the board's are solid dark ovals with no highlight.
  for (const ex of [12.8, 19.2]) {
    if (blink) img.rect(Math.round(ex) - 1, 31 + b, 3, 1, RABBIT_DARK);
    else img.ellipse(ex, 30.8 + b, 1.5, 1.9, RABBIT_DARK);
  }
  // Blush, in `skin` rather than a pink of its own: the palette has no pink, and purple is Red's.
  for (const cx of [10.6, 21.4]) img.ellipse(cx, 33.4 + b, 1.7, 1.1, shade('skin', 1));
  // Nose: a small warm wedge, and the one place `skin` appears on his face.
  img.rect(15, 33 + b, 3, 1, shade('skin', 0));
  img.px(16, 34 + b, shade('skin', 0));
  // Mouth: the board's little "w" under the nose, three pixels of it.
  for (const [mx, my] of [
    [14, 35],
    [15, 36],
    [16, 35],
    [17, 36],
    [18, 35],
  ] as const)
    img.px(mx, my + b, RABBIT_DARK);

  base(img, 7, 25, 47, RABBIT_DARK);
  img.outline(RABBIT_DARK);
}

// ----------------------------------------------------------------------------- the owl

/**
 * WIDE AND SQUAT, which is the whole of him: 22 x 26, against the rabbit's 21 x 34.
 *
 * Crop the owl off the board (panel 01, in the crown left of the signpost) and he is one rounded
 * barrel about as wide as he is tall, with no neck, a flat-ish crown, two SMALL pointed tufts at
 * the top corners, two enormous white facial discs, a cream breast and two stubby talons. Measured
 * off the board at roughly 3.3 image pixels to one of ours he comes back about 23 x 29, which is
 * section 10.2's 22 x 26 within a pixel either way.
 *
 * The build had him at 30 x 45 with two ten-pixel tufts leaning out of a dome, and the cost was
 * exact: at 24 px his silhouette was a blob with two ears on it, which is also the cat's, and the
 * two were the closest pair in the whole cast. Both faults are the same fault -- he was drawn at
 * Red's height instead of at an owl's -- and shrinking him to the barrel fixes the tufts for free,
 * because a 3 px tuft on a 26 px bird cannot be mistaken for a cat's ear.
 *
 * He keeps `trunk` with a `wall` breast, which is the board's own recipe, and the gold talons and
 * beak are the only saturated marks on him.
 */
function paintOwl(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  /*
   * --- ear tufts: three pixels wide, at the corners, and that is all they are ---
   *
   * They own the top three rows of the figure and nothing else. Drawn behind the head so the crown
   * laps over their bases, which is what stops them reading as two things balanced on a ball.
   */
  taper(img, 9.6, 28.6 + b, 8.2, 23.4 + b, 3.4, 1.6, 'trunk', 0.08, 0.8);
  taper(img, 22.4, 28.6 + b, 23.8, 23.4 + b, 3.4, 1.6, 'trunk', 0.05, 0.6);

  // --- body and head, one merged mass: an owl has no neck. The head orb is deliberately flatter
  // than it is wide, which is what gives him the board's flat crown instead of a second ball. ---
  orb(img, 16, 37.6, 9.6, 9.4, 'trunk', 0.06, 0.92);
  orb(img, 16, 30.6 + b, 9.2, 5.6, 'trunk', 0.1, 1);

  /*
   * Wings folded down the sides, dark, with two primaries overhanging the tail on each.
   *
   * Their width is load-bearing, not taste: at 5.2 they reached a pixel past the barrel on both
   * sides and took the finished silhouette to 24, which put him back inside the magpie's bands. The
   * barrel is the widest thing on an owl and the wings lie ON it.
   */
  taper(img, 8.6, 31.4, 9.4, 42.6, 4.6, 3.8, 'trunk', 0.04, 0.58);
  taper(img, 23.4, 31.4, 22.6, 42.6, 4.6, 3.8, 'trunk', 0.0, 0.34);
  for (const [wx, dir] of [
    [8.8, -1],
    [23.2, 1],
  ] as const)
    for (let i = 0; i < 2; i++)
      taper(
        img,
        wx + dir * i * 1.4,
        41,
        wx + dir * i * 1.7,
        45.4 - i * 1.2,
        2.2,
        1.6,
        'trunk',
        0.02,
        0.3,
      );

  // The cream breast the wings then frame. `wall` is the only pale warm ramp in the palette and it
  // is what the board puts here; on `trunk` the breast and the wings are one brown.
  orb(img, 15.6, 39.6, 5.6, 6.2, 'wall', 0.05, 0.62);

  // Tail wedge between the primaries.
  orb(img, 16, 45.2, 3.4, 1.8, 'trunk', 0.04, 0.4);

  // Talons, gripping the ground in front of the tail, and never bobbing with the breath.
  for (const fx of [11, 17.4] as const) {
    taper(img, fx, 44.4, fx + 3.4, 44.4, 2.0, 2.0, 'gold', 0.1, 0.9);
    for (let t = 0; t < 3; t++)
      taper(img, fx + t * 1.7, 45.2, fx + t * 1.7, 46.4, 1.4, 1.1, 'gold', 0.05, 0.6);
  }

  // --- the facial discs, which are the owl: two thirds of his width between them ---
  for (const dx of [-4.4, 4.4]) {
    const cx = 16 + dx;
    orb(img, cx, 30.8 + b, 4.4, 4.6, 'trunk', 0.0, 0.2);
    orb(img, cx, 30.8 + b, 3.7, 3.9, 'wall', 0.35, 1);
    if (blink) {
      // Lid down, with the lash line above it: a closed eye, not a missing one.
      orb(img, cx, 31.6 + b, 3.1, 1.8, 'wall', 0.0, 0.3);
      img.line(cx - 2.8, 30.0 + b, cx + 2.8, 30.0 + b, keyline('trunk'));
    } else {
      img.ellipse(cx, 30.8 + b, 2.1, 2.2, keyline('trunk'));
      img.rect(Math.round(cx) - 2, 29.4 + b, 2, 2, shade('wall', 3));
    }
  }

  // Beak between the discs.
  taper(img, 16, 32.8 + b, 16, 35.8 + b, 3.6, 1.2, 'gold', 0.08, 0.85);

  base(img, 7, 25, 47, keyline('trunk'));
  img.outline(keyline('trunk'));
}

// ----------------------------------------------------------------------------- the lantern keeper

/** His near-black: the hood's inside, the badger's mask, the grip, and the keyline. */
const KEEPER_DARK: RGBA = keyline('roof');

/**
 * No reference exists for this character anywhere (docs/ART_PRODUCTION.md section 5), so this is
 * the design that file asks for: a badger in a hooded coat carrying the lantern on a short pole.
 *
 * THE LANTERN IS THE SILHOUETTE, and section 10.2 says so in as many words -- he is the one
 * character the player is meant to name by what he is holding rather than by his face, because the
 * lantern IS the skill he is offering. So the lantern body occupies x 1..9 and the coat does not
 * begin before x 10: as a flat black shape he is a bell with a box held away from it on a stick,
 * and nothing else in the cast is that shape. At 32 x 44 he is also the tallest and the widest of
 * the eight, which is the second half of the read: he fills the frame where the owl fills a corner.
 *
 * LANTERN HAND, NOT LANTERN SIDE. Section 10.2 puts the lantern off the RIGHT edge, as it does
 * Red's basket. It stays on the left here, deliberately and against the letter of that line: with
 * both on the right the two tallest figures in the game break their outline on the same side at
 * roughly the same height, and the keeper's one job is to not be mistaken for Red. Flipping him is
 * a one-line change to the pole, the hand and the rim loop if a director would rather have the
 * letter.
 *
 * A HEAD, AND A HAND. The review before last found him unreadable -- "a grey tombstone with two
 * white chevrons that look like origami birds, no head distinct from the body, and a lantern pole
 * with no hand gripping it". There is now a pale badger skull filling the hood's opening with the
 * brim casting a hard band of shade across it, two solid eyes on that pale field, a snout coming
 * out of the bottom of it, and a cuff and a closed paw where the sleeve meets the pole. A face in
 * a hood reads as a person at a glance; two white smears never will, however carefully placed.
 *
 * COAT COLOUR. He is painted from `roof`, the one ramp in the palette no character owns and a warm
 * neutral, which is what makes gold the only saturated colour on him. He was once `night`, whose
 * top two steps are byte-identical to Red's cloak, so the forest held two purple-hooded figures.
 */
function paintKeeper(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;
  const CX = 20;

  // Boots under the hem, planted.
  for (const fx of [17.4, 22.6]) taper(img, fx, 43.6, fx, 45.8, 3.6, 3.0, 'wood', 0.08, 0.7);

  // --- the coat: a bell widening to the hem, lit on the side the lantern is on ---
  for (let y = 21; y <= 46; y++) {
    const half = 7.0 + ((y - 21) / 25) * 3.4;
    for (let x = Math.ceil(CX - half); x <= Math.floor(CX + half); x++) {
      const s = (x + 0.5 - CX) / half;
      // Across the bell only: a cylinder turns in x, and shading it in y as well would make the
      // hem glow. The cubic darkens both rims so the keyline has something to sit against.
      const k = Math.max(0, Math.min(1, (-s * 0.56 + 0.5) * 0.94 + 0.06 - 0.4 * Math.abs(s) ** 3));
      img.px(x, y + b, tone('roof', 0.02 + 0.9 * snap(k, STEPS)));
    }
  }

  // Belt: a dark strap with a gold buckle, and the only horizontal on the coat.
  taper(img, CX - 7.2, 33 + b, CX + 7.2, 33 + b, 2.6, 2.6, 'wood', 0.05, 0.55);
  orb(img, CX - 0.5, 33 + b, 2.0, 2.0, 'gold', 0.25, 1);

  // --- the sleeve that holds the pole, reaching down-left out of the coat ---
  taper(img, 15.6, 25.6 + b, 13.2, 30.6 + b, 5.0, 3.8, 'roof', 0.1, 0.58);

  // Hood: a dome, with a back-swept point. Without the point the dome is a bald head, and in
  // silhouette it is the one mark that says the grey mass is cloth he is wearing.
  orb(img, CX - 0.4, 22.6 + b, 7.6, 2.4, 'roof', 0.02, 0.3); // collar, under the hood
  orb(img, CX + 0.2, 13.2 + b, 7.6, 7.8, 'roof', 0.1, 0.96);
  taper(img, 24.2, 11.6 + b, 27.2, 8.6 + b, 4.4, 1.6, 'roof', 0.02, 0.5);

  /*
   * --- the badger, three-quarter, looking down at his own lantern ---
   *
   * The opening is cut first and deep, then the head is set into it. The head is a real mass with
   * its own rounding, not a flat patch, so it sits INSIDE the hood rather than on it.
   */
  orb(img, 18.8, 17.6 + b, 6.2, 5.2, 'roof', 0.0, 0.06); // the opening, and it stays deep
  orb(img, 18.4, 18.5 + b, 4.1, 3.6, 'fur', 0.12, 0.74); // the skull, lit only to three-quarters

  /*
   * The brim's shade: a hard band across the top of the face. It does two jobs -- it stops the pale
   * skull reading as a bald dome stuck on the coat, and it keeps a visible ring of hood between the
   * face and the hood's lit outside, without which the two pale masses merge into hair.
   */
  orb(img, 18.4, 15.6 + b, 4.1, 2.0, 'roof', 0.0, 0.1);

  // The hood's own edge, round the top of the opening: one dark arc is what puts the face INSIDE
  // the hood rather than on the front of it.
  for (let a = -2.5; a <= 0.6; a += 0.08)
    img.px(18.8 + 5.9 * Math.cos(a), 17.6 + b + 5.0 * Math.sin(a), KEEPER_DARK);

  // Snout, out of the bottom of the face and pointing down at the lantern, nose first. The shade
  // under the brow is what lets it read as something projecting rather than as more of the face.
  orb(img, 18.8, 19.8 + b, 3.2, 1.4, 'roof', 0.0, 0.14);
  taper(img, 18.4, 20.4 + b, 15.6, 22.4 + b, 3.6, 2.4, 'fur', 0.34, 1);
  orb(img, 15.2, 22.6 + b, 1.7, 1.3, 'roof', 0.0, 0.04);

  /*
   * EYES. At a head nine pixels across a badger's mask -- a black stripe down each side of a white
   * blaze -- is too fine a marking to survive, and two passes proved it: both came back as a pale
   * smear with dark marks on it rather than a face. What reads at this size is the oldest signal
   * there is, two dark eyes on a pale field, so each eye is a solid 2x2 of his own near-black with
   * a brow bar over it and the badger identity is carried by the snout alone.
   */
  if (blink) {
    img.rect(16, 19 + b, 3, 1, KEEPER_DARK);
    img.rect(20, 18 + b, 3, 1, KEEPER_DARK);
  } else {
    img.rect(16, 18 + b, 2, 2, KEEPER_DARK);
    img.rect(20, 17 + b, 2, 2, KEEPER_DARK);
    img.px(16, 18 + b, shade('wall', 2)); // the lantern, caught in the near eye
  }

  // --- the pole, and the lantern that is the whole point of him ---
  taper(img, 11.8, 32 + b, 5.2, 16.6, 2.2, 1.8, 'wood', 0.12, 0.8);

  /*
   * The hand. A cuff where the sleeve ends, then the paw closed over the pole, then a groove across
   * it: at four pixels wide that is as much as fingers can be, and it is enough -- without it the
   * pole passes through him and he is standing next to a lantern rather than carrying one.
   */
  orb(img, 13.4, 30.2 + b, 2.6, 2.2, 'roof', 0.06, 0.42); // cuff
  img.line(12.0, 28.6 + b, 12.6, 32.0 + b, KEEPER_DARK); // where the cuff ends and the paw begins
  orb(img, 11.2, 30.8 + b, 2.2, 1.9, 'fur', 0.12, 0.72); // paw, closed over the pole
  orb(img, 12.4, 29.4 + b, 1.2, 1.1, 'fur', 0.3, 0.9); // thumb, over the top of it
  img.line(9.8, 30.8 + b, 12.6, 30.8 + b, KEEPER_DARK); // one groove: at four pixels that is fingers

  /*
   * The lantern, hung at SHOULDER HEIGHT (10.2) -- centred on row 23, where the collar is -- and
   * clear of the coat's left edge, which the bell keeps at x 10 or beyond for the whole of its run.
   */
  img.frame(4, 15, 3, 3, shade('wood', 0)); // hanging ring
  taper(img, 2.0, 19.0, 8.2, 19.0, 2.8, 2.8, 'wood', 0.1, 0.8); // cap
  orb(img, 5, 23.4, 3.8, 4.4, 'gold', 0.05, 0.6); // the frame
  orb(img, 5, 23.4, 2.8, 3.4, 'gold', 0.55, 1); // the panes
  img.rect(5, 20, 1, 7, shade('gold', 0)); // mullions, which the flame passes in front of
  img.rect(2, 23, 7, 1, shade('gold', 0));
  orb(img, 5, 23.8, 1.4, 2.1, 'wall', 0.6, 1); // the flame, the brightest thing in the frame
  taper(img, 2.0, 27.8, 8.2, 27.8, 2.8, 2.8, 'wood', 0.08, 0.7); // base

  /*
   * What the lantern lands on: a contiguous rim up the coat's lit contour and across the hood,
   * solid gold pixels on the objects, never a halo in the air. Walking the silhouette's own left
   * edge means the rim always lands on the sprite and never needs an alpha to fade out.
   */
  for (let y = 9; y <= 45; y++) {
    for (let x = 7; x < 20; x++) {
      if (img.get(x, y + b)[3] === 0) continue;
      if (x > 7 && img.get(x - 1, y + b)[3] !== 0) break;
      img.px(x, y + b, tone('gold', 0.26 + 0.22 * Math.cos(y * 0.4)));
      break;
    }
  }

  base(img, 13, 28, 47, KEEPER_DARK);
  img.outline(KEEPER_DARK);
}

// ----------------------------------------------------------------------------- the wolf

/**
 * The predator, and the title of the game. LOW AND LONG: 30 x 30, and the only horizontal back
 * line in the cast.
 *
 * He was 32 x 41 -- as tall as Red and almost as tall as the keeper -- which is a dog standing up,
 * not a wolf stalking. Section 10.2 gives him a square box and the reason is in the same row:
 * "widest at the shoulder; head carried forward and below the shoulder". Taking eleven rows out of
 * him and leaving the width alone is what turns a vertical animal into a horizontal one, and the
 * horizontal is the read: he is the only shape in the eight that is wider than it is tall apart
 * from the three small bystanders, and none of those has legs under it.
 *
 * INK IS HIS. `docs/PIXEL_STANDARD.md` section 4 reserves the literal `ink` ramp for the wolf
 * because he is the one character meant to read as a flat silhouette, and every other character --
 * the magpie included, as of this pass -- now outlines in a `keyline()` of its own ramp. His
 * outline being the palette's only true black is what makes frames 2 and 3 mean something.
 *
 * LIT. One near foreleg and one hind leg with open air between them, the near foreleg's floor
 * lifted a third of the way up the ramp so it is genuinely lighter than the chest it crosses. Four
 * limbs cannot be told apart inside `wolf`'s thirty levels of range; two can, because `outline`
 * wraps each of them on three sides and the keyline is what the eye actually reads.
 *
 * DARK. Frame 2 -- the shape in the lit window -- is genuinely flat, because that is the one the
 * board draws and it draws it as one unbroken silhouette with a single amber mark in it. Frame 3
 * is the reveal and lights the HEAD almost to the lit frames' range while leaving the body flat:
 * the player has to read WOLF and GRANDMA'S THINGS in the same glance or the title of the game is
 * not on screen. Read as lighting rather than as a cheat, that is a lamp inside the cottage on his
 * face and his back to the dark, which is where the scene puts him anyway.
 *
 * Frames 1 to 3 are not measured by `assertBodyPlans()`: section 10.1 tests the idle frame, and
 * frame 3 is wearing a bonnet, which is allowed to be taller than his head.
 */
function paintWolf(img: Img, frame: 0 | 1 | 2 | 3): void {
  const dark = frame >= 2;
  const b = frame === 1 ? 1 : 0;
  const INK = shade('ink', 0);

  /** The BODY: flat ink on frames 2 and 3, a stepped `wolf` tone on the lit pair. */
  const mass = (fn: (ramp: Ramp, lo: number, hi: number) => void): void =>
    dark ? fn('ink', 0, 0) : fn('wolf', 0.04, 1);

  /** The HEAD, which frame 3 lights and frame 2 does not. See the note above. */
  const head = (fn: (ramp: Ramp, lo: number, hi: number) => void): void =>
    frame === 2 ? fn('ink', 0, 0) : fn('wolf', frame === 3 ? 0.06 : 0.04, frame === 3 ? 0.92 : 1);

  /**
   * Raise a mass's FLOOR as well as its ceiling, staying flat on the ink frames.
   *
   * `mass` hands a painter `lo` and `hi`, and scaling `hi` alone only ever darkens: it pulls the
   * lit side down while the shaded side stays where it was, so a limb drawn that way is uniformly
   * duller than the body rather than separated from it. Lifting the floor is what makes the near
   * foreleg a lighter object. On an ink frame `hi === lo`, and both ends stay pinned to 0.
   */
  const lift = (lo: number, hi: number, floor: number, ceil: number): [number, number] =>
    hi === lo ? [lo, hi] : [lo + (hi - lo) * floor, lo + (hi - lo) * ceil];

  /*
   * The tail: heavy, down behind the haunch, curling under it and stopping short of the hind paw.
   *
   * It breaks the REAR edge (10.2) and nothing else does, which is what tells his back end from his
   * front at 24 px. An earlier version swept it the whole way across the base instead, and a wide
   * horizontal skirt with the legs nowhere is a seal.
   */
  mass((r, lo, hi) => {
    taper(img, 24.6, 29.6, 27.4, 34.4, 4.6, 4.4, r, lo, hi * 0.58);
    taper(img, 27.4, 34.4, 25.4, 40.4, 4.4, 3.6, r, lo, hi * 0.6);
    taper(img, 25.4, 40.4, 22.4, 42.2, 3.6, 2.6, r, lo, hi * 0.7);
  });

  /*
   * --- haunch, chest and the back line between them ---
   *
   * The back is one horizontal stroke from shoulder to hip, and it is the single most distinctive
   * thing in the whole cast's silhouette: every other character's top edge is a dome, a pair of
   * ears or a hood. Both masses stop at about row 38 rather than running to the base, which is what
   * leaves the legs somewhere to be -- while the body reached the bottom of the frame the legs
   * could only ever be grooves drawn on a mass.
   */
  mass((r, lo, hi) => {
    orb(img, 23.2, 32.4, 5.8, 5.8, r, lo, hi * 0.72);
    orb(img, 15.8, 32.0 + b, 5.4, 5.8, r, lo, hi);
    taper(img, 15.6, 27.2 + b, 24.0, 26.8, 4.0, 4.0, r, lo, hi * 0.62); // the back line
    // Shoulder blade, which is what makes a hunched animal look boned rather than stuffed.
    taper(img, 18.2, 28.4 + b, 19.8, 32.4 + b, 2.0, 2.0, r, lo, hi * 0.5);
  });

  /*
   * The hind leg: a thigh laid over the haunch with its own rounding, then a shin and a paw. The
   * thigh is what turns the back end from a bag into a hip, and the arc of ink down its front edge
   * is what the eye actually reads.
   */
  mass((r, lo, hi) => {
    orb(img, 23.4, 35.0, 4.6, 4.4, r, lo, hi * 0.9);
    taper(img, 22.6, 38.4, 22.0, 42.8, 4.2, 3.4, r, lo, hi * 0.56);
    orb(img, 21.8, 43.8, 2.8, 2.0, r, lo, hi * 0.5);
  });
  img.line(19.8, 32.6, 19.4, 38.6, INK); // the hip's front arc

  /*
   * ONE foreleg, propped forward, lifted a third of the way up the ramp by `lift` so its lit edge
   * is a real value above the chest it crosses instead of a nominal one. A second, far leg was
   * tried and removed: it filled the gap, so the only thing separating the pair was a one-pixel
   * groove drawn ON a mass -- and a groove on a mass is a scratch, not an edge. With it gone,
   * `outline` wraps each surviving limb on three sides, which is the board's own method and the
   * only one that survives at this size.
   */
  mass((r, lo, hi) => {
    taper(img, 13.6, 34.4 + b, 12.6, 42.6, 4.4, 3.6, r, ...lift(lo, hi, 0.34, 1));
    orb(img, 12.0, 43.8, 2.9, 2.1, r, ...lift(lo, hi, 0.26, 0.92));
  });
  img.line(15.0, 34.0, 14.4, 42.8, INK); // where the foreleg crosses the chest
  for (const [px0, py] of [
    [11.0, 45.0],
    [12.8, 45.2],
  ] as const)
    img.px(px0, py, INK); // toes

  /*
   * Hackles: five raised spikes along the back line, drawn as mass standing proud of it rather than
   * as a dark marking, so that frames 2 and 3 -- flat ink, no internal shading at all -- keep them
   * in the silhouette.
   */
  mass((r, lo, hi) => {
    for (let i = 0; i < 5; i++)
      orb(img, 17.2 + i * 1.7, 25.6 + i * 0.5 + b, 1.3, 1.8, r, lo, hi * 0.96, 0.42);
  });

  /*
   * --- ears: short, broad-based triangles, leaning out. Tall ones made him a rabbit ---
   *
   * On `head`, not `mass`, so that on frame 3 the two tips standing clear above the bonnet are lit
   * fur rather than black -- they are the tell that the thing in the bonnet is not Grandma.
   *
   * They need `lift` as well as `head`, and the reason is a property of `taper` worth knowing
   * before using it for anything thin. Its shading comes from the offset perpendicular to the
   * stroke, and the cubic rim term takes the outermost pixels down hard. On a four-pixel limb that
   * is a soft edge; on an ear tapering to 2 px there IS nothing but rim, so every pixel of the tip
   * gets the full darkening and the ear comes out near-black however bright its ceiling is.
   * Against a cream bonnet that read as two notches cut out of the hat rather than as ears.
   */
  head((r, lo, hi) => {
    taper(img, 9.6, 24.6, 7.8, 20.1, 4.4, 2.2, r, ...lift(lo, hi, 0.3, 0.9));
    taper(img, 14.8, 24.2, 16.6, 19.9, 4.4, 2.2, r, ...lift(lo, hi, 0.2, 0.68));
  });

  /*
   * Skull carried FORWARD AND BELOW the shoulder (10.2), with the muzzle driven a third of the
   * frame's width out of it over clear air. The muzzle is the single feature doing the work:
   * shorten it by three pixels and he is a dog.
   *
   * The jaw is kept at half the muzzle's ceiling on purpose. A muzzle is only legible as something
   * projecting if the plane under it is darker than the plane on top of it, and on frame 3 that one
   * step is the difference between a snout and a smear.
   */
  head((r, lo, hi) => {
    orb(img, 11.8, 26.6, 5.0, 4.2, r, lo, hi);
    taper(img, 10.2, 28.4, 3.6, 31.4, 6.0, 3.2, r, lo, hi * 0.92);
    taper(img, 9.8, 30.4, 5.4, 32.6, 3.8, 2.4, r, lo, hi * 0.5); // the jaw, under the muzzle
  });
  img.ellipse(3.4, 31.2, 1.7, 1.4, INK); // nose

  // Ruff: the chest fringe, pointing down and out over the chest edge.
  mass((r, lo, hi) => {
    for (let i = 0; i < 3; i++)
      orb(img, 11.8 + i * 0.5, 31.0 + i * 2.4, 1.6, 1.9, r, lo, hi * 0.94, -0.42);
  });

  if (frame === 3) {
    /*
     * Grandma's things, worn by something that is not Grandma. This frame IS the title of the game.
     *
     * The rule the pair has to obey is that a clear gap of wolf runs between them, and what runs
     * through that gap is the muzzle, nose and all -- so the shawl is kept off x < 12 and the
     * bonnet off y > 27.
     *
     * The cloth is the one thing on these two frames that is toned rather than flat: it is not the
     * silhouette, it is what the silhouette is WEARING, and the joke only lands if it reads as soft
     * bright fabric over something hard and black.
     */

    /*
     * THE SHAWL: a cape draped over BOTH shoulders, not a cone hung off one.
     *
     * Four things stop it being a cone, and each answers a way an earlier version failed: it starts
     * as a band across the whole width of his back rather than as a point on his chest; a notch is
     * cut out of the top centre so what sits on the shoulders is two lapels meeting lower down; both
     * sloping edges are scalloped on a four-row round with a fringe of beads hanging off them; and
     * it ends on a scalloped hem, because a point is a cone.
     *
     * COLOUR is the top half of `wood`: a tan, the warmest ramp here that is still a fibre colour.
     * It was `stone` -- the ramp the ROCKS use -- and read exactly as the palette says it should,
     * "grey metal, a breastplate rather than cloth". `skin` was tried next, because it is the
     * obvious reading of "warm it", and is worth recording as wrong: at luma 150..230 on a
     * near-black animal a peach mass with a V cut out of the top reads as a BARE CHEST, ribcage and
     * all. The failure is the hue PLUS the value -- cloth that pale over a dark body reads as the
     * body. `wood` held between 0.44 and 0.90 lands at luma 126..177, plainly a woven thing lying
     * on him and a clear step below the near-white bonnet.
     */
    const SHAWL_TOP = 28;
    const SHAWL_HEM = 34;

    // The hem is SCALLOPED PER COLUMN and the fringe hung from wherever each column ended, so a
    // bead always lands ON cloth and the two can never drift apart.
    const hemAt = (x: number): number => SHAWL_HEM + 1.0 * Math.cos(((x - 14) * Math.PI) / 4);
    const lowest = new Map<number, number>();

    for (let y = SHAWL_TOP; y <= SHAWL_HEM + 2; y++) {
      const t = (y - SHAWL_TOP) / (SHAWL_HEM - SHAWL_TOP);
      // The scallop: a round bump every four rows along both sloping edges.
      const scallop = 1.2 * (0.5 - 0.5 * Math.cos(((y - SHAWL_TOP) * Math.PI) / 2));
      const xl = 14.2 + (16.6 - 14.2) * t - scallop;
      const xr = 26.4 + (24.2 - 26.4) * t + scallop;
      // The neckline, a shallow notch between two lapels. It was a V four and a half pixels deep,
      // and over a dark body that is not a neckline, it is a sternum.
      const neck = Math.max(0, 1.8 * (1 - (y - SHAWL_TOP) / 3));
      for (let x = Math.ceil(xl); x <= Math.floor(xr); x++) {
        if (y > hemAt(x)) continue;
        if (Math.abs(x + 0.5 - 20.3) < neck) continue;
        const s = (x + 0.5 - 20.3) / ((xr - xl) / 2);
        const k = Math.max(0, Math.min(1, (-s * 0.5 + 0.5) * 0.9 + 0.1 - 0.34 * Math.abs(s) ** 3));
        img.px(x, y, tone('wood', 0.44 + 0.46 * snap(k, 5)));
        lowest.set(x, y);
      }
    }

    // Two creases where the cloth gathers out of the neckline, and they are deliberately SOFT.
    // Drawn in the ramp's keyline they were near-black on tan, which at this size is not a fold in
    // wool, it is a stave on a barrel -- hard dark lines read as structure, not as drape.
    img.line(18.4, 30.0, 18.9, 33.0, tone('wood', 0.24));
    img.line(22.2, 30.0, 21.8, 33.0, tone('wood', 0.24));

    for (let fx = 15; fx <= 26; fx += 3) {
      const fy = lowest.get(fx);
      if (fy !== undefined) orb(img, fx, fy + 2.2, 1.0, 1.1, 'wood', 0.3, 0.74);
    }

    /*
     * THE BONNET: a crown between the ears, a brim across the brow, a frill down the back, a ribbon
     * by the jaw -- and, doing most of the work, a hard groove of keyline between crown and brim.
     *
     * Two earlier attempts failed in opposite directions and both are worth recording, because the
     * obvious third try is one of them. Drawing crown and brim as two tones of cream was not enough
     * separation -- `wall` spans 60 luma in total, so the two merged into one amorphous lump and
     * the review called it a wig and a party hat. Then drawing it as a RING, cloth over the whole
     * skull with the face punched back out, which is what a bonnet physically is, ate the ears and
     * left a cream crescent round a black hole.
     *
     * What works is the hat, with the groove: one dark line across cream at the brim's edge is
     * worth more than any amount of tonal modelling. At this head size the crown is also kept
     * NARROWER than the skull and set back towards the nape, which is what leaves both ear tips
     * standing clear above and to the sides of it -- on a 30 px wolf that clearance is two rows,
     * and it is the whole gag, so it is measured rather than eyeballed.
     */
    /*
     * The crown is tipped FORWARD over the brow and sits x 8..15, which is the measured part. The
     * first version centred it on the skull at x 10..17 and, since the ears are drawn before the
     * bonnet, the cream simply painted over the right ear's tip: one ear, and the gag halved. Set
     * forward, the left ear stands clear to the LEFT of the crown and the right ear clear to its
     * RIGHT, both of them two rows above its top edge.
     */
    orb(img, 11.4, 23.4, 3.4, 2.0, 'wall', 0.5, 1); // the crown
    // The brim: a flat lens, thickest in the middle and thinning to nothing at both ends, which is
    // what a brim looks like head-on. Drawn as a straight band of even width it came out as a
    // wooden stick laid across his face.
    orb(img, 10.4, 25.4, 4.4, 1.0, 'wall', 0.08, 0.46);
    img.line(7.6, 24.6, 14.8, 24.0, keyline('wall')); // and the groove that makes it a brim
    for (const fx of [7.4, 9.0]) orb(img, fx, 26.4, 1.0, 0.9, 'wall', 0.06, 0.3); // its frill
    for (const [fx, fy] of [
      [14.8, 22.6],
      [15.4, 24.6],
    ] as const)
      orb(img, fx, fy, 1.4, 1.3, 'wall', 0.5, 1); // the frill, down the back edge only
    taper(img, 15.2, 26.2, 16.6, 29.8, 1.8, 1.4, 'wall', 0.06, 0.4); // the ribbon, by the jaw
  }

  /*
   * --- eyes: amber, the only warm thing about him, and the one colour the silhouette keeps ---
   *
   * Drawn LAST, after the bonnet, so that on frame 3 they look out from under the brim rather than
   * being covered by it. On the other three frames nothing overlaps them and the order is moot.
   *
   * Frame 3 takes the LIT frames' eye, not frame 2's. The two dark frames used to share one dim
   * amber (`gold` level 1) because a silhouette wants a single muted mark -- which is right for
   * frame 2, where the board itself puts exactly one amber cluster in a flat navy shape, and wrong
   * for frame 3, which is no longer flat.
   */
  for (const [ex, ey] of [
    [9.4, 27.0],
    [14.0, 26.2],
  ] as const) {
    const x = Math.round(ex);
    const y = Math.round(ey);
    img.rect(x - 2, y - 2, 4, 1, INK); // brow ridge: the glare, and it costs four pixels
    if (frame === 1) img.rect(x, y, 2, 1, shade('gold', 1));
    else {
      img.rect(x, y - 1, 2, 2, shade('gold', frame === 2 ? 1 : 3));
      img.rect(x, y, 2, 1, shade('gold', 0));
    }
  }

  base(img, 10, 27, 46, INK);
  img.outline(INK);
}

/**
 * Keyed by the texture name the scene looks up; a renamed key is a broken build.
 *
 * `-0` is the open-eyed frame and `-1` the blink, except for the wolf: 0 and 1 are him lit, 2 is
 * the silhouette in the window and 3 is the silhouette in Grandma's bonnet and shawl.
 */
export const CAST_FRAMES: Record<string, (img: Img) => void> = {
  'npc-rabbit-0': (img) => paintRabbit(img, false),
  'npc-rabbit-1': (img) => paintRabbit(img, true),
  'npc-owl-0': (img) => paintOwl(img, false),
  'npc-owl-1': (img) => paintOwl(img, true),
  'npc-lantern-keeper-0': (img) => paintKeeper(img, false),
  'npc-lantern-keeper-1': (img) => paintKeeper(img, true),
  'npc-wolf-0': (img) => paintWolf(img, 0),
  'npc-wolf-1': (img) => paintWolf(img, 1),
  'npc-wolf-2': (img) => paintWolf(img, 2),
  'npc-wolf-3': (img) => paintWolf(img, 3),
};

// ------------------------------------------------------------------- the gate (10.1 and 10.2)

/**
 * The bounds of a frame's opaque pixels, which is the shape section 10.1 fills black.
 *
 * The corners come back as well as the size, because the size alone does not tell a painter which
 * end of a figure has grown and that is the first thing anyone fixing this wants to know.
 */
function silhouette(paint: (img: Img) => void): {
  w: number;
  h: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} {
  const img = new Img(32, 48);
  paint(img);
  let x0 = img.w;
  let x1 = -1;
  let y0 = img.h;
  let y1 = -1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (img.get(x, y)[3] !== 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, x0, x1, y0, y1 };
}

/**
 * The regression guard for UX review finding 19, and the reason it is here rather than in a test.
 *
 * Sprite art reaches the game through exactly one door -- `pnpm graybox`, which imports this module
 * to write `apps/game/src/assets/npc-*.png`. Throwing from here means a cast that has drifted out
 * of its body plan cannot be baked into the assets at all, which is a stronger gate than a test
 * reporting it afterwards. `tools/graybox` has no `test` script and CI does not run `pnpm graybox`,
 * so a vitest spec would need `tools/graybox/package.json` and a new spec file; both are outside
 * this pass's remit and the ask is recorded for whoever owns them.
 *
 * It checks the two things finding 19 is about, and nothing else:
 *
 *   1. every idle silhouette fills its plan box (`CAST_PLAN` plus `BYSTANDER_PLAN`), within a pixel on each axis;
 *   2. no two silhouettes share BOTH a width band (+-4) and a height band (+-6), which is section
 *      10.2's assignment rule and the mechanical half of 10.1's "name each one".
 *
 * Red is deliberately NOT in the set. She is painted in `char-red.ts`, which this pass does not
 * own, and a guard that fails on somebody else's file is a guard that gets deleted. Her own
 * proximity to the keeper is reported up rather than enforced here.
 */
export function assertBodyPlans(): void {
  const plan: Record<string, { w: number; h: number }> = { ...CAST_PLAN, ...BYSTANDER_PLAN };
  const frames: Record<string, (img: Img) => void> = { ...CAST_FRAMES, ...BYSTANDER_FRAMES };
  const measured = new Map<string, { w: number; h: number }>();
  const faults: string[] = [];

  for (const [name, want] of Object.entries(plan)) {
    const paint = frames[`${name}-0`];
    if (!paint) {
      faults.push(`${name}: the body plan names a character with no "-0" frame`);
      continue;
    }
    const got = silhouette(paint);
    measured.set(name, got);
    if (Math.abs(got.w - want.w) > 1 || Math.abs(got.h - want.h) > 1)
      faults.push(
        `${name}: silhouette is ${got.w}x${got.h} at x ${got.x0}..${got.x1}, y ${got.y0}..${got.y1}; ` +
          `body plan is ${want.w}x${want.h} (ART_DIRECTION section 10.2)`,
      );
  }

  const names = [...measured.keys()];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = measured.get(names[i]!)!;
      const c = measured.get(names[j]!)!;
      const dw = Math.abs(a.w - c.w);
      const dh = Math.abs(a.h - c.h);
      if (dw <= 4 && dh <= 6)
        faults.push(
          `${names[i]} (${a.w}x${a.h}) and ${names[j]} (${c.w}x${c.h}) share both a width band ` +
            `(dw ${dw}) and a height band (dh ${dh}); ART_DIRECTION section 10.2 allows neither pair`,
        );
    }

  if (faults.length)
    throw new Error(
      `The cast has drifted off its body plan -- see docs/UX_REVIEW.md finding 19:\n  ` +
        faults.join('\n  '),
    );
}

assertBodyPlans();
