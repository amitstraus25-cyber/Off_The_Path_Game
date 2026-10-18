/*
 * The four bystanders, redrawn at 32 x 48.
 *
 * None of them offers a skill, none is ever scored, and nobody will stop to inspect one. They exist
 * so the forest reads as inhabited rather than as a test level with four quiz stations in it. That
 * makes them cheap to get wrong and cheap to get right: the whole job is four silhouettes that are
 * instantly nameable at a 26-tile camera and charming for the two seconds anyone looks.
 *
 * These are not the 16px sprites scaled up. At 16px each one was a stack of ellipses with two dots
 * for a face -- the toadstool's cap was three ellipses, the snail's "whorl" was a dot inside a
 * ring, and the cat and the rabbit shared an outline. The 4x budget goes on STRUCTURE
 * (docs/PIXEL_STANDARD.md section 1), not on speckle:
 *
 *   toadstool -- gills under the brim, a ring on the stem, domed spots, a forked twig, a sprout
 *   magpie    -- layered wing coverts with the real white primary flash, a wedge tail in three
 *                feather laminae, a bill with a visible gape
 *   snail     -- an actual two-turn spiral with a groove and a Haze whorl winding into it, a shell
 *                mouth the body enters through, a sole frill, a parcel with a fold and a label
 *   cat       -- separate front legs with toe grooves, a tabby pattern that is five bars and not
 *                fifty, leaning ear cones with a lit rim and a warm inner channel
 *
 * Silhouettes, checked against each other and against the cast in `cast.ts`: a wide dome on a
 * stalk, a long diagonal tail, a low spiral, a sitting triangle with short pointed ears. The only
 * near-miss is cat against rabbit, and the ears settle it -- the rabbit's are tall leaves standing
 * up, the cat's are short cones leaning out, and the cat's tail crosses in front of her feet.
 *
 * Colour, per the rebrand (docs/ART_PRODUCTION.md section 6a):
 *   - the toadstool's cap is `cloak`, because THE TILE IS THE REFERENCE. `toadstoolRing` in
 *     tiles/flora.ts paints its three caps dark/base/lit straight off `cloak`, and the map scatters
 *     that tile round a glade, so there are many more tile toadstools in the world than there are
 *     of him. He was built on `night` instead -- a dark plum two steps below the tile -- and the
 *     result was one species in two colours standing next to each other, which reads as a bug
 *     rather than as variety. (The old note here argued `night` kept `cloak` to Red alone; it did
 *     not, because the tile was already on `cloak`, and docs/PIXEL_STANDARD.md section 2 names the
 *     toadstools as one of the six things brand colour reaches the world through.) The stems agreed
 *     all along: both are the cottage's cream `wall`, and the tile's `fur` is only in its spots, so
 *     the spots here are `fur` too now.
 *   - the snail's shell is Clay with a Haze whorl: `fur` is the palette's warm pale neutral and the
 *     closest it holds to Clay, and the whorl is `cloak` level 3, which IS Haze. One line of it.
 *   - the magpie is black and white: `ink` and `fur`.
 *   - the cat is a ginger tabby in `wood`. The 16px cat was `stone` with `cloak` inner ears, which
 *     handed a bystander Red's Aubergine for free; `wood` also gives her a level 0 dark enough to
 *     be her own outline, which `stone` (luma 96, against a grass field at 117) is not.
 *
 * Outlines follow section 4: each one is drawn in its own ramp's dark, not in a shared key line --
 * `cloak` for the toadstool, `stone` for the snail, `wood` for the cat, and `ink` for the magpie.
 * The magpie is the one place `ink` survives outside the wolf, and it is not a borrowed key line:
 * he is painted in `ink` 0 through 3 from bill to tail, so `ink` 0 IS his own dark, which is
 * exactly what section 4 asks for. There is no second near-black in this palette to move him to --
 * `night` 2 and 3 are Red's purple and `wolf` is the wolf's -- and he never reads as a flat
 * silhouette the way the wolf's frames 2 and 3 do, so the reservation keeps its point.
 *
 * Suffix -0 is open-eyed and -1 is the blink. The rooted things do not bob: the toadstool stands
 * perfectly still, which is the whole joke, and the snail's shell does not move either. On the two
 * animals the blink carries a one-pixel bob of everything above the ground contact and nothing
 * below it, so they breathe instead of sliding.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

// ----------------------------------------------------------------------------- shared brushes

/** A thick line with round caps that tapers along its length: stalks, twigs, legs, tails, bills. */
function taper(
  img: Img,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  c: RGBA,
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = (w0 + (w1 - w0) * t) / 2;
    img.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
  }
}

/**
 * The upper half of an ellipse, flat along `baseY`. A mushroom cap is a dome with a brim, and a
 * whole ellipse with its bottom hidden behind the stem is not the same shape -- the brim is where
 * the gills hang, so the flat edge has to be real.
 */
function dome(img: Img, cx: number, baseY: number, rx: number, ry: number, c: RGBA): void {
  for (let y = Math.floor(baseY - ry); y <= Math.floor(baseY); y++) {
    const dy = (y + 0.5 - baseY) / ry;
    if (dy < -1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++)
      if (x + 0.5 >= cx - half && x + 0.5 <= cx + half) img.px(x, y, c);
  }
}

/**
 * A logarithmic-ish spiral, drawn one pixel at a time. `dr` offsets the track outward, so the same
 * call drawn twice gives a groove and the lit line that rides just above it -- which is the only
 * way a whorl reads at this size. Four levels of Clay cannot carry a spiral on their own.
 */
function whorl(
  img: Img,
  cx: number,
  cy: number,
  r0: number,
  turns: number,
  phase: number,
  dr: number,
  c: RGBA,
): void {
  const steps = 320;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * Math.PI * 2;
    const r = r0 * (1 - 0.86 * t) + dr;
    if (r <= 0.5) continue;
    img.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.94, c);
  }
}

/** A thick arc along an ellipse, for anything that wraps a round surface: string round a shell. */
function arc(
  img: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  w: number,
  c: RGBA,
): void {
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    img.ellipse(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, w / 2, w / 2, c);
  }
}

/**
 * The contact shadow every standing thing owes the ground (section 3), painted ONLY where the
 * sprite is not. It runs after `outline`, so the ink edge never wraps round the shadow and leaves
 * the character standing in a dark puddle with a key line round it.
 */
function ground(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      if (img.get(x, y)[3] !== 0) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      img.px(x, y, shade('shadow', d > 0.5 ? 1 : 0));
    }
}

// ----------------------------------------------------------------------------- the toadstool

/**
 * Convinced he is a signpost. Everything above the stem is cap, so the silhouette is a toadstool
 * before the face is read at all, and the face plus the pointing twig are what turn it into
 * somebody with an opinion about where you should be going.
 *
 * He is rooted and never bobs. The blink moves the twig arm a pixel instead, which is the only
 * tell that the thing addressing you is the mushroom and not something behind it.
 */
function paintToadstool(img: Img, blink: boolean): void {
  const t = blink ? 1 : 0;

  // --- stem: a tapered column with a swollen base, lit down the left ---
  for (let y = 22; y <= 45; y++) {
    const hw = 4.2 + (y - 22) * 0.1 + (y > 39 ? (y - 39) * 0.45 : 0);
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, shade('wall', 1));
    img.rect(left, y, 3, 1, shade('wall', 2));
    img.rect(right - 2, y, 2, 1, shade('wall', 0));
  }
  // Fibres, three of them, down the shaded side. Three is structure; thirty would be dirt.
  img.rect(19, 31, 1, 11, shade('wall', 0));
  img.rect(21, 34, 1, 8, shade('wall', 0));
  img.rect(17, 38, 1, 6, shade('wall', 0));

  // --- the ring: the torn veil, flared wider than the stem and catching light on its top face ---
  for (let y = 26; y <= 29; y++) {
    const hw = 9.2 - (y - 26) * 1.3;
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, y === 26 ? shade('wall', 3) : shade('wall', 1));
    if (y === 29) img.rect(left, y, right - left, 1, shade('wall', 0));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  /*
   * --- cap: full mass in shade, body inset up-left, Lilac kept to the lit quarter ---
   *
   * The three levels are the tile's three levels, in the tile's order: `cloak` 0 for the dark a
   * pixel proud of everything, `cloak` 1 for the cap proper, `cloak` 2 for the quarter facing the
   * light. He and `toadstoolRing` are now the same mushroom at two sizes.
   */
  dome(img, 16, 25, 14, 15, shade('cloak', 0));
  dome(img, 15.2, 24.2, 13.2, 14.2, shade('cloak', 1)); // the cap proper
  dome(img, 12.8, 20.4, 8.8, 9.6, shade('cloak', 2)); // the lit quarter only
  // The shaded flank: a crescent down the low right, where the dome turns away from the light.
  for (let y = 12; y <= 22; y++) {
    const dy = (y + 0.5 - 24.2) / 14.2;
    const half = 13.2 * Math.sqrt(Math.max(0, 1 - dy * dy));
    const edge = Math.round(15.2 + half);
    img.rect(edge - 2, y, 2, 1, shade('cloak', 0));
  }
  // Rim light along the very top of the dome, one pixel thick and no more. The tile is too small
  // to carry a rim, so this is the one place the sprite says more than the tile does.
  for (let x = 6; x <= 19; x++) {
    const dx = (x + 0.5 - 15.2) / 13.2;
    const y = Math.round(24.2 - 14.2 * Math.sqrt(Math.max(0, 1 - dx * dx)));
    img.px(x, y + 1, shade('cloak', 3));
  }

  // Gills: short radial ticks under the brim, deepest in the middle where the brim is widest.
  for (let x = 3; x <= 29; x += 2) {
    const dx = (x + 0.5 - 16) / 14;
    const depth = Math.round(3 * (1 - dx * dx));
    for (let d = 0; d < depth; d++) img.px(x, 23 + d, shade('cloak', 0));
  }
  img.line(2, 23, 29, 23, shade('cloak', 0));

  // Spots: a dark seat, a mid face, an Offwhite core inset up-left, so each one sits on the curve.
  // Offwhite is `fur`, which is what the tile spots this cap with.
  for (const [sx, sy, r] of [
    [10, 14, 3.3],
    [21, 12, 2.9],
    [25, 18, 2.6],
    [14, 20, 2.2],
    [6, 20, 1.9],
  ] as const) {
    img.ellipse(sx, sy, r, r * 0.9, shade('cloak', 0));
    img.ellipse(sx - 0.3, sy - 0.4, r - 0.5, (r - 0.5) * 0.9, shade('fur', 2));
    img.ellipse(sx - 0.7, sy - 0.8, r - 1.2, (r - 1.2) * 0.9, shade('fur', 3));
  }

  /*
   * Face, well inside the stem so the outline never eats an eye. The brow bar above each eye is
   * what stops the pair reading as two holes punched in the stem -- and it also gives him the
   * expression of somebody about to tell you the way whether or not you asked.
   */
  for (const ex of [12, 18]) {
    img.rect(ex - 1, 31, 5, 1, shade('wall', 0));
    if (!blink) {
      img.rect(ex, 33, 3, 3, shade('cloak', 0));
      img.px(ex, 33, shade('wall', 3));
    } else {
      img.rect(ex, 35, 3, 1, shade('cloak', 0));
      img.px(ex, 36, shade('wall', 0));
      img.px(ex + 2, 36, shade('wall', 0));
    }
  }

  /*
   * The twig arm, held out with great authority, pointing at nothing in particular.
   *
   * Thin. A twig drawn three pixels wide is a club, and the first pass read as one: the shape that
   * says "branch" is the taper plus the two side shoots, not the mass.
   */
  taper(img, 21, 33 - t, 29, 29 - t, 2, 1, shade('wood', 0));
  taper(img, 21, 32.6 - t, 28.6, 28.6 - t, 1, 0.8, shade('wood', 2));
  taper(img, 25.4, 30.8 - t, 27.4, 26 - t, 1.4, 0.8, shade('wood', 0));
  taper(img, 25.2, 30.4 - t, 27.2, 26 - t, 0.8, 0.8, shade('wood', 2));
  taper(img, 27, 29.6 - t, 30, 32 - t, 1.2, 0.8, shade('wood', 0));

  // --- a sprout at the foot, so the silhouette is not symmetrical ---
  img.rect(4, 41, 3, 5, shade('wall', 1));
  img.rect(4, 41, 1, 5, shade('wall', 2));
  dome(img, 5.5, 41, 4.4, 3.8, shade('cloak', 0));
  dome(img, 5, 40.4, 3.8, 3.2, shade('cloak', 1));
  img.ellipse(4, 38.6, 1.2, 1, shade('wall', 3));

  img.outline(shade('cloak', 0));
  ground(img, 17, 46.5, 11.5, 2.4);
}

// ----------------------------------------------------------------------------- the magpie

/**
 * Repeats whatever she last overheard, and is holding a bead she is not going to give back.
 *
 * Perched and facing left. Three things make a magpie rather than a generic black bird, and all
 * three get real pixels here: the white belly, the white flash along the folded wing, and a tail
 * longer than the body, angled down and back so the outline is a diagonal nothing else in the
 * forest has.
 */
function paintMagpie(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- legs and feet, planted; they never bob ---
  for (const lx of [13, 19]) {
    img.rect(lx, 39, 3, 6, shade('gold', 0));
    img.rect(lx, 39, 1, 6, shade('gold', 1));
    for (let i = 0; i < 3; i++) img.rect(lx - 2 + i * 2, 45, 2, 1, shade('gold', 1));
    img.rect(lx - 2, 45, 1, 1, shade('gold', 0));
    img.rect(lx + 2, 45, 1, 1, shade('gold', 0));
  }

  /*
   * Tail: longer than the body and clearly cut away from it.
   *
   * The first pass lost it -- body, wing and tail were all `ink` and merged into one dark mass
   * going right, which is a puffin. What separates them is an `ink` 2 line running the whole upper
   * edge of the tail and an `ink` 0 trough where it leaves the body, so the eye finds a cylinder
   * leaving a sphere rather than one silhouette with a corner.
   */
  taper(img, 18, 32.6 + b, 28.4, 43.6 + b, 8.6, 3.6, shade('ink', 0));
  taper(img, 17.8, 32 + b, 27.8, 42.4 + b, 6.4, 2.4, shade('ink', 1));
  taper(img, 19.6, 35.4 + b, 28.2, 44.4 + b, 1.2, 1.2, shade('ink', 0));
  taper(img, 21, 34 + b, 28.8, 42.8 + b, 1.2, 1.2, shade('ink', 0));

  // --- body: mass in shade, inset up-left, lit cap on the breast ---
  img.ellipse(15, 30 + b, 8, 8.8, shade('ink', 0));
  img.ellipse(14.3, 29.3 + b, 7.4, 8.2, shade('ink', 1));
  img.ellipse(12.6, 26 + b, 4.2, 4.6, shade('ink', 2));

  /*
   * White belly, then the black breast painted back over its top. A white ellipse on its own came
   * back as an egg stuck to the bird; what makes it plumage is the hard curved boundary where the
   * black bib ends, which only exists if something is drawn over it afterwards.
   */
  img.ellipse(13.4, 34.4 + b, 6, 5.4, shade('fur', 1));
  img.ellipse(12.8, 33.6 + b, 5.2, 4.6, shade('fur', 3));
  img.ellipse(13.6, 26.6 + b, 7, 5.2, shade('ink', 1));
  img.ellipse(12.2, 24.6 + b, 4.4, 3.6, shade('ink', 2));

  // --- folded wing over the back: coverts, then the white primary flash in one clean wedge ---
  taper(img, 18.4, 24.6 + b, 20.8, 36.6 + b, 8.6, 5, shade('ink', 0));
  taper(img, 18, 24.2 + b, 20.4, 35.6 + b, 7, 3.8, shade('ink', 1));
  taper(img, 16.8, 24.8 + b, 18.8, 31 + b, 2.2, 1.4, shade('ink', 2));
  for (const [cy0, cy1] of [
    [27, 28.4],
    [30, 31.4],
  ] as const)
    taper(img, 15.6, cy0 + b, 21.6, cy1 + b, 1.2, 1.2, shade('ink', 0));
  taper(img, 19.4, 31.4 + b, 20.8, 37.2 + b, 4.2, 2.6, shade('fur', 3));

  /*
   * The tail's lit edge, drawn LAST so the wing cannot bury it.
   *
   * At the size a player actually sees, the separation between wing and tail is this line and
   * nothing else: with the tail painted in its own two levels under a wing painted in the same
   * ramp, the whole back half of the bird came back as one dark wedge and the magpie read as a
   * puffin. The four pixels of `water` are the sheen a magpie really has; four, not forty.
   */
  taper(img, 21.5, 34.6 + b, 27.2, 41.4 + b, 2.8, 1.6, shade('ink', 2));
  taper(img, 21.8, 34.2 + b, 25.4, 38.6 + b, 1.4, 1.2, shade('ink', 3));
  img.px(25, 38 + b, shade('water', 0));
  img.px(25, 39 + b, shade('water', 0));

  // --- head: a trough under the jaw, or head and breast are one unbroken black lump ---
  img.ellipse(11.4, 18.6 + b, 6.2, 5.8, shade('ink', 0));
  img.ellipse(10.8, 18 + b, 5.6, 5.2, shade('ink', 1));
  img.ellipse(9.2, 15.8 + b, 3.4, 2.8, shade('ink', 2));
  img.ellipse(8.6, 14.8 + b, 1.8, 1.4, shade('ink', 3));
  taper(img, 7.6, 23.4 + b, 16.4, 25 + b, 1.8, 1.4, shade('ink', 0));

  // --- bill: long and pointed, lit on the upper mandible with a gape line under it ---
  taper(img, 8, 19.6 + b, 1.8, 21.6 + b, 4.6, 1.2, shade('ink', 1));
  taper(img, 8, 19 + b, 2, 21 + b, 2.4, 1, shade('ink', 3));
  img.line(7.4, 20.8 + b, 2, 21.8 + b, shade('ink', 0));

  // --- eye ---
  if (!blink) {
    img.ellipse(9.4, 17 + b, 2.3, 2.3, shade('fur', 3));
    img.ellipse(9.8, 17.3 + b, 1.5, 1.5, shade('ink', 0));
    img.px(9, 16 + b, shade('fur', 3));
  } else {
    img.rect(8, 18 + b, 4, 1, shade('ink', 0));
    img.rect(8, 17 + b, 4, 1, shade('ink', 2));
  }

  // --- the bead she is not going to give back ---
  img.ellipse(2.6, 23.4 + b, 2.1, 2.1, shade('gold', 0));
  img.ellipse(2.3, 23.1 + b, 1.5, 1.5, shade('gold', 2));
  img.px(2, 22 + b, shade('gold', 3));

  img.outline(shade('ink', 0));
  ground(img, 18, 46.5, 12.5, 2.2);
}

// ----------------------------------------------------------------------------- the snail

/**
 * Delivering a parcel. He set out on Tuesday. It is going very well.
 *
 * The shell is the loudest shape and gets the whole 32px budget: two real turns of spiral with a
 * groove and a Haze line riding above it, a shell mouth at the lower left that the body visibly
 * goes into, and a lip round the opening. At 16px this was a dot inside a ring and read as a
 * boiled sweet.
 *
 * He does not bob -- a snail that bobbed would be moving, and the joke is that he is not.
 */
function paintSnail(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- foot: a long low wedge with the head end raised, and a frilled sole ---
  for (let i = 0; i < 6; i++) img.ellipse(4 + i * 4.4, 44, 2.6, 1.6, shade('stone', 0));
  img.ellipse(14, 41, 12.6, 4.2, shade('stone', 0));
  img.ellipse(13.4, 40.4, 12, 3.6, shade('stone', 2));
  img.ellipse(11, 39.2, 8.4, 2.1, shade('stone', 3));
  img.ellipse(7, 34, 4.6, 6.4, shade('stone', 0));
  img.ellipse(6.4, 33.4, 4, 5.8, shade('stone', 2));
  img.ellipse(5.4, 31, 2.4, 3, shade('stone', 3));

  // --- shell: mass, body, lit upper-left. Centred at 19, not 20: at 20 it ran to x 31 and the
  // outline had nowhere to go on the right-hand edge of the frame. ---
  img.ellipse(19, 26, 10.8, 10.6, shade('fur', 0));
  img.ellipse(18.4, 25.4, 10, 9.8, shade('fur', 1));
  img.ellipse(15.8, 22.4, 5.6, 4.8, shade('fur', 2));

  /*
   * The whorl: a Clay groove with the Haze line winding in just above it (section 6a).
   *
   * The groove is drawn twice, one pixel apart, because a single-pixel track at this radius breaks
   * into dashes where the curve runs diagonally and the spiral stops reading as one continuous
   * line. Haze and Clay are four levels of luma apart, so without the groove the whorl is invisible.
   */
  whorl(img, 19.2, 26.2, 9.2, 1.85, Math.PI * 0.72, 0, shade('fur', 0));
  whorl(img, 19.2, 26.2, 9.2, 1.85, Math.PI * 0.72, 0.9, shade('fur', 0));
  whorl(img, 19.2, 26.2, 9.2, 1.85, Math.PI * 0.72, 2.4, shade('cloak', 3));

  // Shell mouth, with a lip: the body goes IN here, which is what makes it a shell and not a ball.
  img.ellipse(12.2, 31.4, 4.8, 4, shade('fur', 2));
  img.ellipse(12, 31.2, 3.8, 3.1, shade('fur', 0));
  img.ellipse(12.2, 31.6, 2.8, 2.2, shade('stone', 0));

  /*
   * The parcel, tied on top and going nowhere fast. It has to look strapped to the shell rather
   * than balanced on it: the string crosses the box and then carries on round the shell as two
   * arcs that follow its curve, which is the only thing that joins the two shapes together.
   */
  /*
   * Both bands start under the box and run down the flanks from there. Drawn as two arcs that did
   * NOT reach the box, they read as a pair of gold clamps bolted to the shell -- a wrapped string
   * has to be seen leaving the thing it is tied to.
   */
  for (const [a0, a1] of [
    [1.46, 1.1],
    [1.54, 1.86],
  ] as const) {
    arc(img, 19.2, 26.2, 10, 9.6, Math.PI * a0, Math.PI * a1, 1.6, shade('gold', 0));
    arc(img, 19.2, 26.2, 9.7, 9.3, Math.PI * a0, Math.PI * a1, 1, shade('gold', 1));
  }
  img.rect(16, 11, 10, 9, shade('wood', 0));
  img.rect(16, 11, 9, 8, shade('wood', 1));
  img.rect(16, 11, 9, 3, shade('wood', 2));
  img.line(16, 15, 24, 15, shade('wood', 0)); // the fold where the paper is tucked under
  img.rect(20, 16, 5, 3, shade('wall', 3)); // the label
  img.line(21, 17, 23, 17, shade('wood', 0));
  // String, one pixel of it: the first pass used two and the parcel came back gold rather than brown.
  img.rect(19, 11, 1, 9, shade('gold', 1));
  img.rect(16, 13, 9, 1, shade('gold', 1));
  img.px(19, 13, shade('gold', 3)); // the knot, where the two bands cross

  // --- eye stalks, high and clear of the shell, and thin: a thick stalk is a chimney ---
  const stalk = (x0: number, y0: number, x1: number, y1: number): void => {
    taper(img, x0, y0, x1, y1 + b, 2.4, 1.8, shade('stone', 0));
    taper(img, x0 - 0.4, y0 - 0.4, x1 - 0.4, y1 - 0.4 + b, 1.4, 1, shade('stone', 2));
  };
  stalk(6, 34, 3, 14);
  stalk(9, 35, 12.5, 12);
  for (const [ex, ey] of [
    [3, 13],
    [12.5, 11],
  ] as const) {
    img.ellipse(ex, ey + b, 2.7, 2.7, shade('stone', 0));
    img.ellipse(ex - 0.4, ey - 0.4 + b, 2.1, 2.1, shade('fur', 3));
    if (!blink) {
      img.rect(ex - 1, ey - 1, 2, 2, shade('stone', 0));
      img.px(ex - 1, ey - 1, shade('fur', 3));
    } else {
      img.rect(ex - 2, ey + 1, 4, 1, shade('stone', 0));
    }
  }
  // Lower tentacles, the short pair he actually smells with. Short: any longer and they read as a
  // second pair of legs under the chin.
  taper(img, 6, 37, 3, 39.4, 2.2, 1.2, shade('stone', 0));
  taper(img, 5.6, 36.6, 3.2, 38.8, 1.3, 0.9, shade('stone', 2));

  img.outline(shade('stone', 0));
  ground(img, 15, 46.5, 13.5, 2.2);
}

// ----------------------------------------------------------------------------- the cat

/**
 * Sitting, facing out, tail curled round the front of her feet, entirely uninterested in your
 * errand.
 *
 * The ears are the whole read against the rabbit in `cast.ts`: short cones leaning OUT, where his
 * are tall leaves standing up. The tail crossing the feet is the second tell, and it is also the
 * reason she is a sitting cat rather than a loaf of bread -- without it the outline below the
 * haunch is just a rectangle.
 */
function paintCat(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0; // the head and ears dip; the paws and the tail stay planted

  // --- body: mass in shade, inset up-left, lit shoulder ---
  img.ellipse(16, 33, 9.6, 11.6, shade('wood', 0));
  img.ellipse(15.2, 32.2, 9, 11, shade('wood', 1));
  img.ellipse(12.6, 28, 5.4, 6.4, shade('wood', 2));
  // Haunch, pushed out to the right: a sitting cat is widest at the hip, not at the chest.
  img.ellipse(21.4, 37.4, 6.6, 6.2, shade('wood', 0));
  img.ellipse(20.8, 36.8, 6, 5.6, shade('wood', 1));

  // Haunch bars: four of them, two pixels thick. Four is a tabby; forty is a dirty sprite.
  for (const [by, bx0, bx1] of [
    [30, 19.4, 26],
    [33.5, 20, 27],
    [37, 20, 27.4],
    [40.5, 19.4, 26.6],
  ] as const)
    taper(img, bx0, by, bx1, by + 1.6, 2.4, 1.6, shade('wood', 0));

  /*
   * Cream bib: a broad wedge under the chin, drawn BEFORE the legs so they crop it into a V.
   *
   * Drawn after them it was a two-pixel stripe running the whole chest, which read as a necktie.
   * The shape a bib actually makes on a sitting cat is the bit of chest the legs do not cover.
   */
  taper(img, 15.5, 26, 15.5, 35, 11.5, 3, shade('wood', 0));
  taper(img, 15.1, 25.6, 15.1, 34.2, 9.8, 2.2, shade('fur', 1));
  taper(img, 14.6, 25.4, 14.6, 32.6, 6.8, 1.6, shade('fur', 2));

  /*
   * Front legs and paws.
   *
   * The grooves matter more than the legs do. The first pass drew both legs in the body's own two
   * levels and the entire lower half came back as one brown mass -- so each leg now gets a level 0
   * trough down its outer edge and the pair are split by a trough of their own, which is what turns
   * a mass into two columns.
   */
  for (const [lx, lit] of [
    [11.5, 1],
    [18.5, 0],
  ] as const) {
    taper(img, lx, 33, lx, 43, 7, 6.2, shade('wood', 0));
    taper(img, lx - 0.4, 32.6, lx - 0.4, 42.6, 5.4, 4.6, shade('wood', 1));
    if (lit) taper(img, lx - 1.6, 33.4, lx - 1.6, 41, 2.2, 1.8, shade('wood', 2));
    img.ellipse(lx, 44, 3.9, 2.8, shade('wood', 0));
    img.ellipse(lx - 0.4, 43.5, 3.2, 2.2, shade('fur', 1));
    img.ellipse(lx - 0.8, 43.1, 2.4, 1.5, shade('fur', 2));
    img.rect(Math.round(lx) - 1, 44, 1, 2, shade('wood', 0));
    img.rect(Math.round(lx) + 1, 44, 1, 2, shade('wood', 0));
  }
  taper(img, 15, 35, 15, 45, 2.2, 2, shade('wood', 0));

  /*
   * The tail, over the front of the paws. It is the second thing that says cat rather than rabbit,
   * and it only works if it reads as a separate cylinder: a level 0 trough along its underside and
   * a level 2 line along its whole lit top, or it sinks into the body it is lying against.
   */
  taper(img, 27.4, 36, 24.4, 44.4, 6.8, 6, shade('wood', 0));
  taper(img, 24.4, 44.4, 8.6, 45.2, 6, 4.6, shade('wood', 0));
  taper(img, 27, 35.6, 24, 43.6, 5, 4.4, shade('wood', 1));
  taper(img, 24, 43.6, 9, 44.4, 4.4, 3.2, shade('wood', 1));
  taper(img, 26.2, 35.4, 23.4, 42.4, 2, 1.6, shade('wood', 2));
  taper(img, 23.4, 42.4, 9.4, 43.2, 1.6, 1.4, shade('wood', 2));
  for (const tx of [13, 17, 21]) taper(img, tx, 42.6, tx - 0.6, 45.8, 1.8, 1.6, shade('wood', 0));
  img.ellipse(9, 44.2, 2.6, 2, shade('fur', 1));
  img.ellipse(8.6, 43.8, 1.9, 1.4, shade('fur', 2));

  // --- ears first, so the skull laps over their bases and no gap is left for the outline ---
  const ear = (baseX: number, apexX: number, lit: boolean): void => {
    taper(img, baseX, 16 + b, apexX, 6 + b, 9, 1.8, shade('wood', 0));
    taper(img, baseX - 0.5, 15.6 + b, apexX - 0.5, 7 + b, 7, 1.3, shade('wood', lit ? 2 : 1));
    taper(img, baseX, 15.4 + b, apexX, 8.4 + b, 4.2, 1, shade('skin', 0));
    taper(img, baseX - 0.4, 15 + b, apexX - 0.4, 9.4 + b, 2.6, 0.9, shade('skin', 2));
  };
  ear(10.5, 7.5, true);
  ear(21.5, 24.5, false);

  // --- head ---
  img.ellipse(16, 19 + b, 8.2, 7.2, shade('wood', 0));
  img.ellipse(15.3, 18.3 + b, 7.6, 6.6, shade('wood', 1));
  img.ellipse(12.8, 15.8 + b, 4.4, 3.6, shade('wood', 2));
  // Cheek ruffs, which is why a cat's face is wider than her skull.
  img.ellipse(9.4, 22.4 + b, 3.8, 3.2, shade('wood', 1));
  img.ellipse(22.6, 22.4 + b, 3.8, 3.2, shade('wood', 0));
  img.ellipse(9, 21.8 + b, 3, 2.4, shade('wood', 2));
  // The tabby M on the forehead: three bars, which is the oldest cat shorthand there is.
  for (const [mx, my, len] of [
    [12, 12, 4],
    [15, 11, 5],
    [19, 12, 4],
  ] as const)
    img.rect(mx, my + b, 2, len, shade('wood', 0));

  // --- face ---
  for (const ex of [11, 18]) {
    if (blink) {
      img.rect(ex, 20 + b, 4, 1, shade('wood', 0));
      img.px(ex, 21 + b, shade('wood', 0));
      img.px(ex + 3, 21 + b, shade('wood', 0));
    } else {
      img.rect(ex, 18 + b, 4, 3, shade('gold', 2));
      img.rect(ex + 2, 18 + b, 1, 3, shade('wood', 0));
      img.px(ex, 18 + b, shade('gold', 3));
    }
  }
  /*
   * Muzzle: two small lobes with a seam between them and a nose above, each lobe sitting on its
   * own shade.
   *
   * One wide pale patch with a dark crescent under it came back as a little mask, and a straight
   * dark bar under it came back as a mouth -- which section 6 forbids outright at this size. Two
   * lobes is the oldest cat shorthand there is and costs the same pixels.
   */
  for (const mx of [13.8, 18.2]) {
    img.ellipse(mx, 25.4 + b, 2.6, 2, shade('wood', 0));
    img.ellipse(mx - 0.3, 24.9 + b, 2.1, 1.5, shade('fur', 1));
    img.ellipse(mx - 0.6, 24.6 + b, 1.4, 1, shade('fur', 2));
  }
  img.rect(16, 24 + b, 1, 3, shade('wood', 0)); // the seam between the lobes
  img.ellipse(16, 22.8 + b, 1.8, 1.3, shade('skin', 0));
  img.px(15, 22.4 + b, shade('skin', 2));
  // Whisker dimples rather than whiskers: a drawn whisker leaves the silhouette and comes back as
  // a fat dark bristle once `outline` wraps it.
  for (const dx of [12, 13.6, 15.2, 17, 18.6, 20.2]) img.px(dx, 26 + b, shade('wood', 0));

  img.outline(shade('wood', 0));
  ground(img, 17, 46.5, 12.5, 2.4);
}

/**
 * Keyed by the texture name the scene looks up; a renamed key is a broken build.
 *
 * `-0` is the open-eyed frame, `-1` the blink.
 */
export const BYSTANDER_FRAMES: Record<string, (img: Img) => void> = {
  'bystander-toadstool-0': (img) => paintToadstool(img, false),
  'bystander-toadstool-1': (img) => paintToadstool(img, true),
  'bystander-magpie-0': (img) => paintMagpie(img, false),
  'bystander-magpie-1': (img) => paintMagpie(img, true),
  'bystander-snail-0': (img) => paintSnail(img, false),
  'bystander-snail-1': (img) => paintSnail(img, true),
  'bystander-cat-0': (img) => paintCat(img, false),
  'bystander-cat-1': (img) => paintCat(img, true),
};
