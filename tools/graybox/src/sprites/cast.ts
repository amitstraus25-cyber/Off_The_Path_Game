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
 * SILHOUETTE. All four have to be told apart as flat black shapes at a 20-tile camera.
 *
 *   rabbit  -- a big round head on a small body, two broad leaf ears, arms at the sides, a satchel
 *   owl     -- a wide squat barrel, 22 px across, with two out-leaning tufts
 *   keeper  -- a bell with a dome on top and a bright box hanging off a stick, clear of the body
 *   wolf    -- low shoulder, heavy haunch, four legs under him, long muzzle thrust out over air
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

// ----------------------------------------------------------------------------- the rabbit

/** The rabbit's own near-black: eyes, mouth, and the keyline. `fur` starts at luma 195. */
const RABBIT_DARK: RGBA = keyline('fur', 165);

/**
 * Rebuilt to the board's rabbit, which is a different animal from the one this file had.
 *
 * Crop the board at the stall and what is there is a CHIBI: a head nearly as wide as the body is
 * tall, two broad rounded ears leaning apart with a wide pink inner, two arms hanging clear of the
 * flanks, two feet, a round tail, and a face -- black oval eyes, a pink nose, a small "w" mouth, a
 * blush on each cheek. The previous version had 19-pixel ears two pixels wide with a pink hairline
 * down each, which read as antennae, and no arms at all, so the body was an egg. Both are fixed by
 * proportion rather than by detail: the ears are now 12 px long and 6 wide, the head is r 8.2 where
 * the body is r 6.2, and the arms are drawn after the body so a keyline groove separates them.
 *
 * The satchel is his, and it is the point of him: he is the character who hands Red a thing. It
 * hangs on the near hip on a strap across the chest, drawn in `wood` so it is the one warm mass on
 * an otherwise white animal.
 *
 * The breath moves the head, ears and face only; the body, arms and paws stay planted, which is
 * what makes a one-pixel bob look like breathing rather than like the sprite sliding.
 */
function paintRabbit(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- ears: short, broad, rounded, leaning apart, with a wide warm inner ---
  const ear = (xb: number, xt: number): void => {
    taper(img, xb, 19 + b, xt, 7.5 + b, 6.6, 5.2, 'fur', 0.12, 1);
    taper(img, xb + (xt - xb) * 0.1, 17.5 + b, xt, 9.5 + b, 3.8, 2.8, 'skin', 0.0, 0.5);
  };
  ear(12.6, 10.0);
  ear(19.4, 22.0);

  // --- body: small, below a big head, and narrow enough to leave the arms outside it ---
  orb(img, 16, 38.0, 5.8, 7.6, 'fur', 0.0, 1);
  // The turn down his right side. The board's rabbit is white with one grey side, and `fur` is so
  // pale that the rim's own falloff cannot supply it: it has to be painted as its own mass.
  orb(img, 18.6, 38.6, 4.2, 6.6, 'fur', 0.0, 0.3);

  // Feet, planted, and never bobbing with the breath.
  for (const fx of [12.6, 19.4]) orb(img, fx, 45.0, 3.0, 2.4, 'fur', 0.18, 0.9);
  img.line(16, 43.4, 16, 46.4, RABBIT_DARK); // the groove that makes them two feet, not a base

  // Cotton tail, out to the right: the one thing on him allowed to be at the top of the ramp.
  orb(img, 23.0, 40.0, 3.0, 2.8, 'fur', 0.5, 1);

  /*
   * Arms, pushed out past the flanks so each has open air on its outer side, and separated from the
   * body by a groove on its inner one. Drawn inside the silhouette they vanished entirely -- `fur`
   * has 60 luma of range in total, so an arm on a body can only be told from the body by a line.
   */
  taper(img, 9.6, 33.8, 9.0, 41.2, 4.4, 3.8, 'fur', 0.05, 0.8);
  taper(img, 22.4, 33.8, 23.0, 41.2, 4.4, 3.8, 'fur', 0.0, 0.42);
  img.line(11.6, 34.4, 11.2, 41.4, RABBIT_DARK);
  img.line(20.4, 34.4, 20.8, 41.4, RABBIT_DARK);

  // --- the satchel: strap over the far shoulder, pouch on the near hip, in front of the arm ---
  taper(img, 21.0, 31.6, 12.2, 39.2, 2.4, 2.4, 'wood', 0.06, 0.5);
  orb(img, 10.0, 41.6, 3.4, 3.2, 'wood', 0.0, 0.46); // the bag
  taper(img, 7.0, 39.6, 12.8, 38.8, 2.6, 2.6, 'wood', 0.4, 0.95); // its lid, a band lighter
  img.px(10, 41, shade('gold', 2)); // and its buckle

  // --- head, big and round, in front of the ear bases ---
  orb(img, 16, 24 + b, 8.2, 7.0, 'fur', 0.08, 1);
  orb(img, 19.4, 24.8 + b, 4.6, 5.2, 'fur', 0.0, 0.34); // the same turn, on the head

  // Eyes: the board's are solid dark ovals with no highlight.
  for (const ex of [12.6, 19.4]) {
    if (blink) img.rect(Math.round(ex) - 1, 24 + b, 3, 1, RABBIT_DARK);
    else img.ellipse(ex, 23.6 + b, 1.6, 2.0, RABBIT_DARK);
  }
  // Blush, in `skin` rather than a pink of its own: the palette has no pink, and purple is Red's.
  for (const cx of [10.4, 21.6]) img.ellipse(cx, 26.6 + b, 1.9, 1.2, shade('skin', 1));
  // Nose: a small warm wedge, and the one place `skin` appears on his face.
  img.rect(15, 27 + b, 3, 1, shade('skin', 0));
  img.px(16, 28 + b, shade('skin', 0));
  // Mouth: the board's little "w" under the nose, three pixels of it.
  for (const [mx, my] of [
    [14, 29],
    [15, 30],
    [16, 29],
    [17, 30],
    [18, 29],
  ] as const)
    img.px(mx, my + b, RABBIT_DARK);

  base(img, 8, 24, 47, RABBIT_DARK);
  img.outline(RABBIT_DARK);
}

// ----------------------------------------------------------------------------- the owl

/**
 * A wide squat barrel, 22 pixels across where the rabbit is 15, which is the whole silhouette
 * difference between them. The two ear tufts lean out past the head and are the only things
 * breaking the dome.
 *
 * The board's owl is one brown turning through a few values with a cream breast laid over it, and
 * that is how this is built: two `orb`s for the mass, a `wall` orb for the breast, two `taper`s for
 * the folded wings. He is the one character here the review left alone, so the only changes are the
 * two this pass makes everywhere -- the shading snaps to `STEPS` instead of blurring, and the green
 * contact shadow under the talons is gone.
 */
function paintOwl(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- ear tufts, behind the head so the dome overlaps their bases ---
  taper(img, 9.6, 15 + b, 6.4, 5 + b, 5.2, 1.4, 'trunk', 0.08, 0.8);
  taper(img, 22.4, 15 + b, 25.6, 5 + b, 5.2, 1.4, 'trunk', 0.05, 0.6);

  // --- body and head, one merged mass: an owl has no neck ---
  orb(img, 16, 31 + b, 11, 12.6, 'trunk', 0.06, 0.92);
  orb(img, 16, 20 + b, 10, 8.4, 'trunk', 0.1, 1);

  // Wings folded down the sides, dark, with three primaries overhanging the tail on each.
  taper(img, 6.8, 21 + b, 8.4, 40 + b, 7, 5.4, 'trunk', 0.04, 0.58);
  taper(img, 25.2, 21 + b, 23.6, 40 + b, 7, 5.4, 'trunk', 0.0, 0.34);
  for (const [wx, dir] of [
    [7.4, -1],
    [24.6, 1],
  ] as const)
    for (let i = 0; i < 3; i++)
      taper(
        img,
        wx + dir * i * 1.8,
        38 + b,
        wx + dir * i * 2.2,
        44 - i * 1.4 + b,
        2.6,
        1.8,
        'trunk',
        0.02,
        0.3,
      );

  // The cream breast the wings then frame. `wall` is the only pale warm ramp in the palette and it
  // is what the board puts here; on `trunk` the breast and the wings are one brown.
  orb(img, 15.6, 32 + b, 6.4, 9.8, 'wall', 0.05, 0.62);

  // Tail wedge between the primaries.
  orb(img, 16, 43.6 + b, 4.2, 2.6, 'trunk', 0.04, 0.4);

  // Talons, gripping the ground in front of the tail, and never bobbing with the breath.
  for (const fx of [10, 18]) {
    taper(img, fx, 42.5, fx + 4, 42.5, 2.4, 2.4, 'gold', 0.1, 0.9);
    for (let t = 0; t < 3; t++)
      taper(img, fx + t * 2, 43.5, fx + t * 2, 45.5, 1.6, 1.2, 'gold', 0.05, 0.6);
  }

  // --- the facial discs, which are the owl ---
  for (const dx of [-4.8, 4.8]) {
    const cx = 16 + dx;
    orb(img, cx, 20.4 + b, 5.0, 5.2, 'trunk', 0.0, 0.2);
    orb(img, cx, 20.4 + b, 4.3, 4.5, 'wall', 0.35, 1);
    if (blink) {
      // Lid down, with the lash line above it: a closed eye, not a missing one.
      orb(img, cx, 21.4 + b, 3.7, 2.2, 'wall', 0.0, 0.3);
      img.line(cx - 3.3, 19.6 + b, cx + 3.3, 19.6 + b, keyline('trunk'));
    } else {
      img.ellipse(cx, 20.4 + b, 2.5, 2.6, keyline('trunk'));
      img.rect(Math.round(cx) - 2, 18.6 + b, 2, 2, shade('wall', 3));
    }
  }

  // Beak between the discs.
  taper(img, 16, 23.4 + b, 16, 27 + b, 4.4, 1.4, 'gold', 0.08, 0.85);

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
 * The review found him unreadable -- "a grey tombstone with two white chevrons that look like
 * origami birds, no head distinct from the body, and a lantern pole with no hand gripping it" --
 * and it was right on all three counts. The previous pass had deliberately shrunk the badger to a
 * snout and an ear on the theory that a face would steal attention from the lantern. What it
 * actually produced was two disconnected pale marks floating on a grey bell. Both marks are gone
 * and there is now a HEAD: a pale badger skull filling the hood's opening, with the hood's brim
 * casting a hard band of shade across the top of it, the black mask running down through the eyes
 * on both sides, and the snout coming out of the bottom of the mask. A face in a hood reads as a
 * person at a glance; two white smears never will, however carefully they are placed.
 *
 * The HAND is the other half of the same fault. The pole used to pass through the coat untouched,
 * so the lantern was a prop floating beside him rather than something he was carrying. There is now
 * a cuff where the sleeve ends and a paw closed round the pole, with two keyline grooves across it
 * for fingers, which is the smallest mark that says "gripped" at this size.
 *
 * The LANTERN is still what the silhouette is about: the lantern body occupies x 0..8 and the coat
 * does not begin before x 11, so as a flat black shape he is a bell with a box held away from it on
 * a stick -- a shape no other character here can be confused with.
 *
 * COAT COLOUR. He is painted from `roof`, the one ramp in the palette no character owns and a warm
 * neutral, which is what makes gold the only saturated colour on him. He was once `night`, whose
 * top two steps are byte-identical to Red's cloak, so the forest held two purple-hooded figures.
 */
function paintKeeper(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;
  const CX = 20;

  // Boots under the hem, planted.
  for (const fx of [17, 22.5]) taper(img, fx, 43, fx, 45.5, 4, 3.4, 'wood', 0.08, 0.7);

  // --- the coat: a bell widening to the hem, lit on the side the lantern is on ---
  for (let y = 24; y <= 45; y++) {
    const half = 7.6 + ((y - 24) / 21) * 2.9;
    for (let x = Math.ceil(CX - half); x <= Math.floor(CX + half); x++) {
      const s = (x + 0.5 - CX) / half;
      // Across the bell only: a cylinder turns in x, and shading it in y as well would make the
      // hem glow. The cubic darkens both rims so the keyline has something to sit against.
      const k = Math.max(0, Math.min(1, (-s * 0.56 + 0.5) * 0.94 + 0.06 - 0.4 * Math.abs(s) ** 3));
      img.px(x, y + b, tone('roof', 0.02 + 0.9 * snap(k, STEPS)));
    }
  }

  // Belt: a dark strap with a gold buckle, and the only horizontal on the coat.
  taper(img, CX - 7.5, 35 + b, CX + 7.5, 35 + b, 3, 3, 'wood', 0.05, 0.55);
  orb(img, CX - 0.5, 35 + b, 2.2, 2.2, 'gold', 0.25, 1);

  // --- the sleeve that holds the pole, reaching down-left out of the coat ---
  taper(img, 15.5, 28 + b, 12.8, 33 + b, 5.4, 4.2, 'roof', 0.1, 0.58);

  // Hood: a dome, with a back-swept point. Without the point the dome is a bald head, and in
  // silhouette it is the one mark that says the grey mass is cloth he is wearing.
  orb(img, CX - 0.4, 26 + b, 8.2, 2.6, 'roof', 0.02, 0.3); // collar, under the hood
  orb(img, CX + 0.2, 16.0 + b, 8.4, 8.2, 'roof', 0.1, 0.96);
  taper(img, 24.5, 14 + b, 27.8, 10.4 + b, 5, 1.6, 'roof', 0.02, 0.5);

  /*
   * --- the badger, three-quarter, looking down at his own lantern ---
   *
   * The opening is cut first and deep, then the head is set into it. The head is a real mass with
   * its own rounding, not a flat patch, so it sits INSIDE the hood rather than on it.
   */
  orb(img, 18.6, 20.8 + b, 7.0, 5.8, 'roof', 0.0, 0.06); // the opening, and it stays deep
  orb(img, 18.2, 21.8 + b, 4.6, 4.0, 'fur', 0.12, 0.74); // the skull, lit only to three-quarters

  /*
   * The brim's shade: a hard band across the top of the face. This is what the review asked for by
   * name and it does two jobs -- it stops the pale skull reading as a bald dome stuck on the coat,
   * and it keeps a visible ring of hood between the face and the hood's lit outside, without which
   * the two pale masses merge and the whole head reads as hair.
   */
  orb(img, 18.2, 18.6 + b, 4.6, 2.2, 'roof', 0.0, 0.1);

  // The hood's own edge, round the top of the opening: one dark arc is what puts the face INSIDE
  // the hood rather than on the front of it, and without it the whole head reads as hair.
  for (let a = -2.5; a <= 0.6; a += 0.08)
    img.px(18.6 + 6.6 * Math.cos(a), 20.8 + b + 5.6 * Math.sin(a), KEEPER_DARK);

  // Snout, out of the bottom of the face and pointing down at the lantern, nose first. The shade
  // under the brow is what lets it read as something projecting rather than as more of the face.
  orb(img, 18.6, 23.0 + b, 3.6, 1.6, 'roof', 0.0, 0.14);
  taper(img, 18.2, 23.6 + b, 15.0, 26.0 + b, 4.0, 2.8, 'fur', 0.34, 1);
  orb(img, 14.5, 26.2 + b, 1.9, 1.5, 'roof', 0.0, 0.04);

  /*
   * EYES, and they are the whole fix.
   *
   * The previous two passes drew the badger's mask -- a black stripe down each side of a white
   * blaze -- and both times the result was a pale smear with dark marks on it rather than a face.
   * At a head ten pixels across the mask is simply too fine a marking to survive; what reads at
   * this size is the oldest signal there is, two dark eyes on a pale field. So the stripes are
   * gone, each eye is a solid 2x2 of his own near-black with a brow bar over it, and the badger
   * identity is carried by the shape of the snout and by nothing else. A face appears at once.
   */
  if (blink) {
    img.rect(15, 22 + b, 3, 1, KEEPER_DARK);
    img.rect(20, 21 + b, 3, 1, KEEPER_DARK);
  } else {
    img.rect(15, 21 + b, 2, 2, KEEPER_DARK);
    img.rect(20, 20 + b, 2, 2, KEEPER_DARK);
    img.px(15, 21 + b, shade('wall', 2)); // the lantern, caught in the near eye
  }

  // --- the pole, and the lantern that is the whole point of him ---
  taper(img, 12, 34 + b, 4.2, 12, 2.4, 2, 'wood', 0.12, 0.8);

  /*
   * The hand. A cuff where the sleeve ends, then the paw closed over the pole, then two grooves
   * across the paw: at five pixels wide that is as much as fingers can be, and it is enough --
   * without it the pole passes through him and he is standing next to a lantern rather than
   * carrying one.
   */
  orb(img, 13.6, 32.6 + b, 3.0, 2.6, 'roof', 0.06, 0.42); // cuff
  img.line(12.0, 30.8 + b, 12.6, 34.6 + b, KEEPER_DARK); // where the cuff ends and the paw begins
  orb(img, 11.0, 33.4 + b, 2.6, 2.2, 'fur', 0.12, 0.72); // paw, closed over the pole
  orb(img, 12.4, 31.8 + b, 1.4, 1.3, 'fur', 0.3, 0.9); // thumb, over the top of it
  img.line(9.4, 33.4 + b, 12.6, 33.4 + b, KEEPER_DARK); // one groove: at five pixels that is fingers

  img.frame(3, 10, 3, 3, shade('wood', 0)); // hanging ring
  taper(img, 0.5, 13.5, 7.5, 13.5, 3, 3, 'wood', 0.1, 0.8); // cap
  orb(img, 4, 19, 4.4, 5.4, 'gold', 0.05, 0.6); // the frame
  orb(img, 4, 19, 3.3, 4.3, 'gold', 0.55, 1); // the panes
  img.rect(4, 15, 1, 8, shade('gold', 0)); // mullions, which the flame passes in front of
  img.rect(1, 19, 7, 1, shade('gold', 0));
  orb(img, 4, 19.4, 1.7, 2.6, 'wall', 0.6, 1); // the flame, the brightest thing in the frame
  taper(img, 0.5, 24.5, 7.5, 24.5, 3, 3, 'wood', 0.08, 0.7); // base

  /*
   * What the lantern lands on: a contiguous rim up the coat's lit contour and across the hood,
   * solid gold pixels on the objects, never a halo in the air. Walking the silhouette's own left
   * edge means the rim always lands on the sprite and never needs an alpha to fade out.
   */
  for (let y = 12; y <= 44; y++) {
    for (let x = 6; x < 20; x++) {
      if (img.get(x, y + b)[3] === 0) continue;
      if (x > 6 && img.get(x - 1, y + b)[3] !== 0) break;
      img.px(x, y + b, tone('gold', 0.26 + 0.22 * Math.cos(y * 0.4)));
      break;
    }
  }

  base(img, 12, 29, 47, KEEPER_DARK);
  img.outline(KEEPER_DARK);
}

// ----------------------------------------------------------------------------- the wolf

/**
 * The predator, and the title of the game.
 *
 * The review had two findings and they pull in opposite directions, so they are answered
 * separately. The LIT frames "read as a seal": no legs, no paws, no ground contact, one airbrushed
 * mass. The DARK frames are flat on purpose -- that is the point of them -- but the disguise did
 * not read: the bonnet was a white blob with no brim and the shawl a grey cone.
 *
 * LIT, and revised again. The previous pass gave him four legs and the review found that none of
 * them read: "the lower half is a solid dark mass with a few vertical grooves in it". Measured, it
 * was not a drawing problem but an arithmetic one -- 98.95 per cent of the lit frame sits under
 * luma 81 and 84.18 per cent under luma 60, because `wolf` tops out at #6a5789 (luma 95) and the
 * lower half of the body never climbs past the middle of that. Four limbs cannot be told apart
 * inside 30 levels of range. So this pass takes the review's SECOND option and simplifies: the far
 * foreleg is gone, there is one near foreleg and one hind leg with five pixels of open air between
 * them, and the near foreleg's floor is lifted a third of the way up the ramp so it is genuinely
 * lighter than the chest it crosses rather than nominally so. The keyline then wraps each leg on
 * three sides, which is how the board's own figures read their legs -- crop Red on the board and
 * her two boots are four pixels each, told apart by nothing but the black line around them.
 *
 * DARK. Frame 2 -- the shape in the lit window -- stays genuinely flat, because that is the one
 * the board actually draws and the board draws it as one unbroken silhouette with a single amber
 * mark in it. Frame 3 does NOT, and that is this pass's main change; see the note on `head` below.
 *
 * SILHOUETTE. Short broad ears (a rabbit's are the tall ones), the muzzle driven a third of the
 * frame clear of the skull over open air, a heavy haunch behind, hackles raised along the back, and
 * the tail laid along the ground. He is the only character here turned three-quarter rather than
 * facing out, which is most of why he reads as something with intent.
 */
function paintWolf(img: Img, frame: 0 | 1 | 2 | 3): void {
  const dark = frame >= 2;
  const b = frame === 1 ? 1 : 0;
  const INK = shade('ink', 0);

  /** The BODY: flat ink on frames 2 and 3, a stepped `wolf` tone on the lit pair. */
  const mass = (fn: (ramp: Ramp, lo: number, hi: number) => void): void =>
    dark ? fn('ink', 0, 0) : fn('wolf', 0.04, 1);

  /*
   * The HEAD, which is the one group frame 3 does not paint flat, and the whole fix for it.
   *
   * The review's verdict on frame 3 was that the gag does not land: "a pale bonnet and a grey-blue
   * bib floating on a black mass with no face between them", with the muzzle, cheek and eyes all
   * swallowed. The measurement says the same thing in one line -- on frame 3, `deep` (share under
   * luma 81) and `keyline` (share under luma 60) came back IDENTICAL at 65.50, which means not one
   * pixel of the frame sat in the midtone band between them. A face is exactly what lives in that
   * band. The frame was two bright cloth shapes and a hole.
   *
   * Flat ink cannot be the answer here even though it is the right answer for frame 2, because the
   * two frames are doing opposite jobs. Frame 2 is a shape seen THROUGH a lit window from outside,
   * where a silhouette is the truth. Frame 3 is the reveal, and the player has to read WOLF and
   * GRANDMA'S THINGS in the same glance or the title of the game is not on screen. So frame 3
   * lights the head -- ears, skull, muzzle, jaw -- almost to the lit frames' own range, and leaves
   * the body flat. Read as lighting rather than as a cheat, that is a lamp inside the cottage on
   * his face and his back to the dark, which is where the scene puts him anyway.
   */
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
   * The tail: heavy, down behind the haunch, curling under it and stopping at x 21.
   *
   * The previous version swept it the whole way across the frame to x 7.6, and that single stroke
   * is most of why the review read him as a seal: a wide horizontal skirt along the base, with the
   * legs nowhere, is a flipper. It now ends behind the hind paw, which leaves the front half of the
   * base as open air for the forelegs to stand in.
   */
  mass((r, lo, hi) => {
    taper(img, 25.5, 32, 29.5, 38.5, 6, 6, r, lo, hi * 0.58);
    taper(img, 29.5, 38.5, 26.5, 44.5, 6, 5, r, lo, hi * 0.6);
    taper(img, 26.5, 44.5, 22.6, 45.8, 5, 3.4, r, lo, hi * 0.7);
  });

  /*
   * --- haunch and chest ---
   *
   * Both end at about y 41 rather than running to the bottom of the frame. That is the structural
   * half of the seal fix: while the body reached the base there was no room for a leg to exist, so
   * the legs could only ever be grooves drawn on a mass. Lifting the body four pixels gives the
   * legs somewhere to be, and the paws then stand against the background with the keyline round
   * them, which is the only way four legs read at this size.
   */
  mass((r, lo, hi) => {
    orb(img, 23.6, 33.4, 7.0, 7.8, r, lo, hi * 0.72);
    orb(img, 17.0, 32.8 + b, 6.2, 8.0, r, lo, hi);
    // Shoulder blade, which is what makes a hunched animal look boned rather than stuffed.
    taper(img, 19.4, 28 + b, 21.4, 34 + b, 2.2, 2.2, r, lo, hi * 0.5);
  });

  /*
   * The hind leg: a thigh laid over the haunch with its own rounding, then a shin and a paw. The
   * thigh is what turns the back end from a bag into a hip, and the arc of ink down its front edge
   * is what the eye actually reads.
   */
  mass((r, lo, hi) => {
    orb(img, 23.8, 35.6, 5.2, 5.6, r, lo, hi * 0.9);
    taper(img, 22.6, 39.4, 22.0, 43.4, 4.8, 4.0, r, lo, hi * 0.56);
    orb(img, 22.0, 44.2, 3.2, 2.2, r, lo, hi * 0.5);
  });
  img.line(20.3, 33.4, 19.8, 39.6, INK); // the hip's front arc

  /*
   * ONE foreleg, and that is the change.
   *
   * There were two, the near one propped forward and the far one set behind it a band darker, and
   * the review could see neither: "the thigh arc, the two forelegs and the toes are not visible at
   * sprite scale". The far leg was the reason. It filled x 16..21 all the way to y 43, so the only
   * thing separating the two forelegs was a one-pixel ink groove drawn ON a mass -- and a groove on
   * a mass is a scratch, not an edge. Removing it opens five pixels of real background between the
   * near foreleg and the hind leg, which lets `outline` wrap each limb on three sides. That is the
   * board's own method and it is the only one that survives at 32 px: a leg reads because the world
   * is visible on both sides of it, not because it is a slightly different purple.
   *
   * The survivor is then lifted a third of the way up the ramp by `lift`, so its lit edge is a real
   * value above the chest it crosses instead of a nominal one, and the old groove is kept on its
   * inner edge where it now does honest work -- body, dark line, lit limb, air.
   */
  mass((r, lo, hi) => {
    taper(img, 13.2, 31.0 + b, 11.9, 43.0, 5.0, 4.2, r, ...lift(lo, hi, 0.34, 1));
    orb(img, 11.3, 44.2, 3.3, 2.3, r, ...lift(lo, hi, 0.26, 0.92));
  });
  img.line(15.3, 34.6, 14.6, 43.6, INK); // where the foreleg crosses the chest
  for (const [px0, py] of [
    [10.4, 45.4],
    [12.4, 45.6],
  ] as const)
    img.px(px0, py, INK); // toes

  /*
   * Hackles: five raised spikes down the back, drawn as mass standing proud of the back line rather
   * than as a dark marking, so that frames 2 and 3 -- flat ink, no internal shading at all -- keep
   * them in the silhouette.
   */
  mass((r, lo, hi) => {
    for (let i = 0; i < 5; i++)
      orb(img, 19 + i * 1.9, 25.6 + i * 1.3 + b, 1.5, 2.1, r, lo, hi * 0.96, 0.42);
  });

  /*
   * --- ears: short, broad-based triangles, leaning out. Tall ones made him a rabbit ---
   *
   * On `head`, not `mass`, so that on frame 3 the two tips standing clear above the bonnet are lit
   * fur rather than black. They are the tell that the thing in the bonnet is not Grandma, the
   * review found them the one part of that frame still working, and giving them the head's colour
   * makes them say "wolf" rather than merely "something pointed".
   *
   * They need `lift` as well as `head`, and the reason is a property of `taper` worth knowing
   * before using it for anything thin. Its shading comes from the offset perpendicular to the
   * stroke, and the cubic rim term takes the outermost pixels down hard. On a six-pixel limb that
   * is a soft edge; on an ear tapering to 1.4 px there IS nothing but rim, so every pixel of the
   * tip gets the full darkening and the ear comes out near-black however bright its ceiling is.
   * Against a cream bonnet that read as two notches cut out of the hat rather than as ears.
   * Raising the floor is the only thing that reaches a stroke this thin.
   */
  head((r, lo, hi) => {
    taper(img, 11.8, 18 + b, 9.4, 9.6 + b, 5.6, 2.6, r, ...lift(lo, hi, 0.3, 0.9));
    taper(img, 18.6, 17.6 + b, 21.1, 9.2 + b, 5.6, 2.6, r, ...lift(lo, hi, 0.2, 0.68));
  });

  /*
   * Skull held low, and the muzzle driven a third of the frame's width out of it over clear air.
   * The muzzle is the single feature doing the work: shorten it by three pixels and he is a dog.
   *
   * The jaw is kept at half the muzzle's ceiling on purpose. A muzzle is only legible as something
   * projecting if the plane under it is darker than the plane on top of it, and on frame 3 that
   * one step is the difference between a snout and a smear.
   */
  head((r, lo, hi) => {
    orb(img, 15.4, 20.4 + b, 5.6, 4.8, r, lo, hi);
    taper(img, 13.4, 22.6 + b, 3.2, 27.4 + b, 7.2, 3.4, r, lo, hi * 0.92);
    taper(img, 13, 25.6 + b, 5.2, 28.8 + b, 4.2, 2.6, r, lo, hi * 0.5); // the jaw, under the muzzle
  });
  img.ellipse(2.9, 27.2 + b, 2.0, 1.6, INK); // nose

  // Ruff: the chest fringe, pointing down and out over the chest edge.
  mass((r, lo, hi) => {
    for (let i = 0; i < 3; i++)
      orb(img, 12.6 + i * 0.6, 31.5 + i * 3.2 + b, 1.8, 2.2, r, lo, hi * 0.94, -0.42);
  });

  if (frame === 3) {
    /*
     * Grandma's things, worn by something that is not Grandma. This frame IS the title of the game,
     * and the review's verdict on the last version was that the gag did not read: "a white wig and
     * a grey CONE that looks like a traffic cone or a party hat". Both rebuilt.
     *
     * The rule the pair has to obey is that a clear gap of wolf runs between them, and what runs
     * through that gap is the muzzle, nose and all. Everything below is kept off x < 12.5 and
     * y 20..28 for that reason.
     *
     * The cloth is the one thing on these two frames that is toned rather than flat: it is not the
     * silhouette, it is what the silhouette is WEARING, and the joke only lands if it reads as soft
     * bright fabric over something hard and black.
     */

    /*
     * THE SHAWL: a triangle draped over BOTH shoulders, not a cone hung off one.
     *
     * Four things stop it being a cone, and each answers a specific way the last one failed:
     *   - it is 16 px wide at the shoulders, which is the whole width of him, so it starts as a
     *     band across the back rather than as a point on the chest;
     *   - a notch is cut out of the top centre, so what sits on the shoulders is two lapels that
     *     meet lower down -- the single most legible sign of draped cloth there is;
     *   - both sloping edges are scalloped on a four-row round, and a fringe of beads hangs off
     *     them, which is a shawl's edge and nothing else's;
     *   - it ends on a scalloped hem rather than on a point, because a point is a cone.
     *
     * COLOUR, and this is the second half of this pass. It was painted from `stone` -- the ramp the
     * ROCKS use -- and the review read it exactly as the palette says it should be read: "grey
     * metal, a breastplate rather than cloth". It is now the top half of `wood`: a tan, the warmest
     * ramp here that is still a fibre colour.
     *
     * `skin` was tried first and rendered, because the review named that family and it is the
     * obvious reading of "warm it". It is wrong, and worth recording so nobody spends a round
     * rediscovering it. At luma 150..230 on a near-black animal, a peach mass with a V cut out of
     * the top and two fold lines down the middle does not read as a shawl -- it reads as a BARE
     * CHEST, ribcage and all, which is a stranger thing to have put on screen than the breastplate
     * was. The failure is not the hue, it is the hue plus the value: cloth that pale over a dark
     * body reads as the body. `wood` held between 0.44 and 0.90 lands at luma 126..177, which is
     * plainly a woven thing lying ON him -- dark enough to be a garment, far enough above `stone`'s
     * floor to stop competing with the keyline for the darkest mass, and a clear step below the
     * near-white bonnet so the two never merge into one pale shape.
     */
    const SHAWL_TOP = 28;
    const SHAWL_HEM = 38;

    /*
     * The hem is SCALLOPED PER COLUMN, not cut flat, and the fringe is then hung from wherever
     * each column actually ended.
     *
     * This is the third shape this garment has had and the reason for the change is worth keeping.
     * As a bib reaching to y 42 it covered the torso from jaw to legs, so there was no wolf left
     * around it -- and a tan trapezoid with two hard creases down it and a straight cut across the
     * bottom is a BARREL. Ending it ten rows down turns it into what it should always have been,
     * a cape over the shoulders, and leaves a band of black animal between the hem and the paws.
     * Four bands then stack the whole way down the sprite and each says one word: cream bonnet,
     * lit wolf face, tan wool, black body. That is the read the frame has to deliver in a glance.
     */
    const hemAt = (x: number): number => SHAWL_HEM + 1.1 * Math.cos(((x - 13.4) * Math.PI) / 4);
    const lowest = new Map<number, number>();

    for (let y = SHAWL_TOP; y <= SHAWL_HEM + 2; y++) {
      const t = (y - SHAWL_TOP) / (SHAWL_HEM - SHAWL_TOP);
      // The scallop: a round bump every four rows along both sloping edges.
      const scallop = 1.3 * (0.5 - 0.5 * Math.cos(((y - SHAWL_TOP) * Math.PI) / 2));
      const xl = 13.2 + (16.6 - 13.2) * t - scallop;
      const xr = 29.2 + (26.2 - 29.2) * t + scallop;
      // The neckline, a shallow notch between two lapels. It was a V four and a half pixels deep,
      // and over a dark body that is not a neckline, it is a sternum -- most of why the warm
      // version first read as a bare chest rather than as something worn.
      const neck = Math.max(0, 2.0 * (1 - (y - SHAWL_TOP) / 3.5));
      for (let x = Math.ceil(xl); x <= Math.floor(xr); x++) {
        if (y > hemAt(x)) continue;
        if (Math.abs(x + 0.5 - 21.2) < neck) continue;
        const s = (x + 0.5 - 21.2) / ((xr - xl) / 2);
        const k = Math.max(0, Math.min(1, (-s * 0.5 + 0.5) * 0.9 + 0.1 - 0.34 * Math.abs(s) ** 3));
        img.px(x, y, tone('wood', 0.44 + 0.46 * snap(k, 5)));
        lowest.set(x, y);
      }
    }

    /*
     * Two creases where the cloth gathers out of the neckline, and they are deliberately SOFT.
     * Drawn in the ramp's keyline they were near-black on tan, which at this size is not a fold in
     * wool, it is a stave on a barrel -- hard dark lines read as structure, not as drape. A tone a
     * quarter of the way up the ramp is about 50 luma under the cloth around it, which is a crease.
     */
    img.line(18.6, 31.4, 19.4, 36.4, tone('wood', 0.24));
    img.line(23.8, 31.4, 23.0, 36.4, tone('wood', 0.24));

    // The fringe, hung from the hem the scallop actually produced rather than from a list of
    // guessed positions, so a bead always lands ON cloth and the two can never drift apart.
    for (let fx = 14; fx <= 29; fx += 3) {
      const fy = lowest.get(fx);
      if (fy !== undefined) orb(img, fx, fy + 2.6, 1.1, 1.2, 'wood', 0.3, 0.74);
    }

    /*
     * THE BONNET: a crown on the skull, a brim across the brow, a frill down the back, a ribbon by
     * the jaw -- and, doing most of the work, a hard groove of keyline between crown and brim.
     *
     * Two earlier attempts failed in opposite directions and both are worth recording, because the
     * obvious third try is one of them. Drawing the crown and the brim as two tones of cream was
     * not enough separation: `wall` spans 60 luma in total, so the two merged into one amorphous
     * lump and the review called it a wig and a party hat. Then drawing it as a RING -- cloth over
     * the whole skull with the face punched back out, which is what a bonnet physically is -- ate
     * the ears and left a cream crescent round a black hole.
     *
     * What works is the hat, with the groove. One dark line across cream at the brim's edge is
     * worth more than any amount of tonal modelling: it is the same device the board uses to tell a
     * roof course from the course below it, and the brim reads at once. The crown is then kept to
     * the skull's own width so both ear tips stand clear above it, which is the tell that the thing
     * wearing it is not Grandma.
     *
     * The whole hat is lifted nine tenths of a pixel from where it sat, and that small move is the
     * third thing this pass fixes. The brim's lens reached y 18.7 and the near eye's top row was
     * y 18, so the eye was drawn INTO the brim: a gold square half-buried in cream, which is why
     * the review read the pair as beads hanging off a hat rather than as eyes. Lifted, the brim
     * stops at y 17.5 and there is a clear row of lit brow between it and the eye beneath.
     */
    orb(img, 15.6, 12.7, 6.2, 3.8, 'wall', 0.5, 1); // the crown
    // The brim: a flat lens, thickest in the middle and thinning to nothing at both ends, which is
    // what a brim looks like head-on. Drawn as a straight band of even width it came out as a
    // wooden stick laid across his face.
    orb(img, 14.9, 15.9, 7.0, 1.6, 'wall', 0.08, 0.46);
    img.line(8.6, 14.6, 21.0, 13.6, keyline('wall')); // and the groove that makes it a brim
    for (const fx of [9.4, 11.6]) orb(img, fx, 17.2, 1.3, 1.2, 'wall', 0.06, 0.3); // its frill
    for (const [fx, fy] of [
      [21.6, 11.3],
      [22.4, 13.9],
    ] as const)
      orb(img, fx, fy, 1.8, 1.7, 'wall', 0.5, 1); // the frill, down the back edge only
    taper(img, 21.6, 16.3, 23.4, 22.0, 2.4, 1.8, 'wall', 0.06, 0.4); // the ribbon, by the jaw
  }

  /*
   * --- eyes: amber, the only warm thing about him, and the one colour the silhouette keeps ---
   *
   * Drawn LAST, after the bonnet, so that on frame 3 they look out from under the brim rather than
   * being covered by it. On the other three frames nothing overlaps them and the order is moot.
   *
   * Frame 3 now takes the LIT frames' eye, not frame 2's. The two dark frames used to share one
   * dim amber (`gold` level 1) because a silhouette wants a single muted mark -- which is right for
   * frame 2, where the board itself puts exactly one amber pixel-cluster in a flat navy shape, and
   * wrong for frame 3, which is no longer flat. A full-brightness eye on a lit muzzle is what the
   * review asked for by name, and with the face behind it now in the midtones it reads as an eye in
   * a head rather than as a light switched on in a cellar.
   */
  for (const [ex, ey] of [
    [11.8, 20.4],
    [17.2, 19.4],
  ] as const) {
    const x = Math.round(ex);
    const y = Math.round(ey) + b;
    img.rect(x - 2, y - 2, 4, 1, INK); // brow ridge: the glare, and it costs four pixels
    if (frame === 1) img.rect(x, y, 2, 1, shade('gold', 1));
    else {
      img.rect(x, y - 1, 2, 2, shade('gold', frame === 2 ? 1 : 3));
      img.rect(x, y, 2, 1, shade('gold', 0));
    }
  }

  base(img, 7, 30, 47, INK);
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
