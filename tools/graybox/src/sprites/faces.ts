/*
 * The six portraits, the ten items and the three effects, redrawn for the 32px standard.
 *
 * The portraits are the one place in this game with room for a face. Everything else is read at the
 * playing camera, where a character is an outline and two pixels of eye; these are shown in the DOM
 * beside the dialogue, unscaled, so at 64 x 64 they can carry a brow, a lid, a muzzle that projects,
 * a jaw. The 16px versions were a stack of flat ellipses with two dots on the front, which is the
 * right answer at 32 x 32 and the wrong one here. The 4x budget goes on STRUCTURE, per
 * docs/PIXEL_STANDARD.md section 1: layered coverts on the owl, a brim that overhangs a forehead and
 * casts a shadow onto it, a bonnet with gathers and a scalloped band, panes and mullions in a
 * lantern. No extra speckle anywhere.
 *
 * Three rules this file is built on, and they are all in the standard:
 *
 *   Colour is only ever shade(ramp, level). The 16px rabbit portrait carried two raw pink literals
 *   for its inner ears and its nose -- exactly the kind of pixel that would have survived the
 *   rebrand untouched. The inner ear here is `skin`, which is the palette's warm pale ramp and is
 *   already Purple's own face, so the rabbit and Purple agree.
 *
 *   One light, from the top-left. Nearly every rounded mass here is built the same way, in three
 *   calls: the full shape in level 0, a slightly smaller copy up-left in level 2, then the base
 *   inset back over it. What survives is a dark rim down the bottom-right and a lit rim along the
 *   top-left, which is what a sphere looks like, consistently across fourteen frames. (A shared
 *   helper for it was written and then not used -- every mass here tunes its own offsets -- so it
 *   has been removed rather than left as dead code claiming to be the house style.)
 *
 *   Zero partial alpha. `Img.px` blends source-over, so a translucent colour laid on a transparent
 *   pixel leaves a partly-transparent pixel in the PNG, which docs/ASSETS.md forbids. All three
 *   effects broke that rule: the dust scattered grit at alpha 170/120/64, the pawprints were ink at
 *   alpha 170, and the keeper portrait threw a gold halo at alpha 60. Nothing in this file passes an
 *   alpha to `shade`. Dust thins by dropping to a darker LEVEL and spending fewer pixels; the prints
 *   are sunk into the ground by their own shading; the keeper's lantern lands solid gold pixels on
 *   the things it lights and nothing in the air between.
 *
 * The portrait backdrop is the `night` ramp, as it has always been, but as a niche rather than a
 * flat field: level 0 in the corners, a level 1 dome behind the head, a level 2 rim up its top-left.
 * paint.ts flags the reason this had to change -- the rebrand left Purple's hood (`cloak` 1) sitting on
 * a `night` 2 field at 33 levels of luma and the same hue, which is mud. Against `night` 1 it is 40
 * levels and the dome's edge does the separating.
 *
 * The five ITEMS are transparent-backed and finish with an outline in THEIR OWN DARK -- `gold` 0
 * round the compass and the key, `stone` 0 round the silver horn, `wood` 0 round the lantern's
 * bronze, `wall` 0 round the letter. All of them used to finish with outline(ink 0), which is the
 * treatment docs/PIXEL_STANDARD.md section 4 reserves for the wolf; shared with half the art it
 * told you nothing about him. On the near-black panels these items sit on (`--cyera-black`) the
 * old black ring was invisible anyway, so nothing is lost. Portraits never call `outline`, because
 * the backdrop is opaque and there is nothing for it to bite on.
 *
 * THE SPEECH BUBBLE IS THE EXCEPTION and it is the only frame in here that is read against the
 * WORLD rather than against a panel. `wall` 0 is luma 175 and the lawn it floats over measures
 * 162..168, so that sweep left the game's one "this character will talk to you" mark as a cream
 * shape on cream ground. It keeps `ink` 0; the argument is at the call site in
 * `paintInteractPromptFrame`.
 */
import { clamp01, ember, Img, keyline, mix, pull, rose, shade } from '../paint.ts';
import type { Painter, RGBA } from '../paint.ts';

/** Portraits and items. The effects are smaller and say their own size at the top of each painter. */
export const FACE_SIZE = 64;

// ----------------------------------------------------------------------------- the toolkit

/**
 * A filled ellipse whose centre slides sideways as it descends. Ears, tufts and ribbons are cones
 * that lean away from the body; drawn upright they come back as matching lollipops.
 */
function leanEllipse(
  img: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lean: number,
  c: RGBA,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const x = cx + lean * (y + 0.5 - cy);
    for (let i = Math.floor(x - half); i <= Math.ceil(x + half); i++)
      if (i + 0.5 >= x - half && i + 0.5 <= x + half) img.px(i, y, c);
  }
}

/** A thick line with round caps, tapering along its length: muzzles, tubes, shafts, ribbons. */
function limb(
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
 * An annulus. `Img.ellipse` with a transparent fill cannot cut a hole -- `px` takes the MAX of the
 * two alphas, so painting clear over gold leaves gold -- which is why the 16px key's bow was a solid
 * disc however hard it tried to be a ring. A key with no hole in it is not a key.
 */
function ring(img: Img, cx: number, cy: number, rx: number, ry: number, t: number, c: RGBA): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const outer = (dx / rx) ** 2 + (dy / ry) ** 2;
      const inner = (dx / Math.max(0.5, rx - t)) ** 2 + (dy / Math.max(0.5, ry - t)) ** 2;
      if (outer <= 1 && inner > 1) img.px(x, y, c);
    }
}

/**
 * The niche every portrait sits in. Dark in the corners, a dome behind the head, one lit pixel of
 * rim up its left shoulder, so the subject has an edge to separate against and the six portraits
 * read as one set.
 */
function backdrop(img: Img): void {
  img.rect(0, 0, 64, 64, shade('night', 0));
  img.ellipse(32, 32, 30, 30, shade('night', 2));
  img.rect(2, 32, 60, 32, shade('night', 2));
  img.ellipse(33, 33, 29, 29, shade('night', 1));
  img.rect(4, 33, 57, 31, shade('night', 1));
}

/*
 * The costume, in two halves with a face drawn between them: the knitted shawl under the chin, and
 * the bonnet with its scalloped band and its ribbons over the brow.
 *
 * It is ONE pair of functions shared by two portraits, which is the only place in this file that
 * shares anything. The whole ending turns on the player not being sure which of the two they are
 * looking at until they look (docs/GAME_DESIGN.md), so the wolf cannot be wearing a near-copy of
 * Grandma's bonnet tuned to its own offsets, and nobody editing one of them later should be able to
 * drift them apart by a pixel. Everything that differs between the two is the face in between --
 * which is the honest difference, and the one the player is being asked to notice.
 */

/** The largest pale mass and the first thing read. Drawn before the face, so the chin laps it. */
function shawl(img: Img): void {
  img.ellipse(32, 86, 35, 34, shade('stone', 0));
  img.ellipse(30.4, 84.6, 34, 33, shade('stone', 2));
  img.ellipse(33, 87, 32.4, 32, shade('stone', 1));
  // Knitted courses: two rows of chevrons, at the shoulders where they would show. A full field of
  // them is a fishnet, which is what the first pass came back as.
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++) {
      const x = 4 + c * 11 + (r % 2 ? 5.5 : 0) + (c > 1 ? 18 : 0);
      const y = 59 + r * 4;
      img.line(x, y, x + 3, y - 2, shade('stone', 0));
      img.line(x + 3, y - 2, x + 6, y, shade('stone', 0));
    }
  img.ellipse(32, 60, 11, 6, shade('stone', 0)); // pulled closed at the throat
}

/**
 * The bonnet, over whatever head was drawn between this and `shawl`. `brow` is the one pixel of it
 * that belongs to the wearer rather than to the hat: the shadow the band drops on the forehead, in
 * the dark of the fur or the skin it falls on.
 */
function bonnet(img: Img, brow: RGBA): void {
  img.ellipse(32, 15, 19, 11.4, shade('wall', 0));
  img.ellipse(30.6, 13.8, 18.2, 10.6, shade('wall', 3));
  img.ellipse(33, 16, 17, 9.8, shade('wall', 1));
  // Two short gathers near the crown. Three seams converging on a point drew a V across the cap
  // and the bonnet came back looking like the envelope two cells along.
  img.line(23, 9.5, 21.5, 15, shade('wall', 0));
  img.line(36, 7, 37, 13, shade('wall', 0));
  img.ellipse(28, 9.5, 6, 2.4, shade('wall', 3));
  // The scalloped band: the Grandma tell, and the only shape here that is purely decorative.
  img.rect(11, 22, 42, 2, shade('wall', 0));
  img.rect(11, 22, 42, 1, shade('wall', 2));
  for (let i = 0; i < 7; i++) {
    img.ellipse(13.5 + i * 6, 26, 3.4, 2.8, shade('wall', 1));
    img.ellipse(13 + i * 6, 25.4, 2.4, 1.9, shade('wall', 3));
    img.px(13.5 + i * 6, 28.4, shade('wall', 0));
  }
  img.rect(13, 28, 38, 1, brow); // and what the band drops onto the brow

  // Ribbons, down past the jaw to a bow tied on the shawl. Narrow: at two pixels of half-width the
  // right-hand tie came back as a pale tube hanging off her ear.
  leanEllipse(img, 11, 33, 1.4, 8, 0.2, shade('wall', 1));
  leanEllipse(img, 10.6, 32, 0.7, 7, 0.2, shade('wall', 3));
  leanEllipse(img, 53, 33, 1.4, 8, -0.2, shade('wall', 1));
  leanEllipse(img, 50.4, 45, 1.3, 6, -0.26, shade('wall', 1));
  img.ellipse(44, 55, 3.2, 3.2, shade('wall', 0));
  img.ellipse(51, 55, 3.2, 3.2, shade('wall', 0));
  img.ellipse(43.6, 54.6, 2.3, 2.3, shade('wall', 3));
  img.ellipse(51.4, 54.6, 2.3, 2.3, shade('wall', 1));
  img.ellipse(47.5, 55, 2, 2.4, shade('stone', 0));
  img.ellipse(47.2, 54.6, 1.3, 1.7, shade('wall', 2));
}

// ----------------------------------------------------------------------------- portraits (64x64)

/**
 * Purple. The hood is the portrait: it is half the frame, it is the colour the whole rebrand turned on,
 * and it has to read as the same garment the sprite wears -- `cloak` 1 for the body of it, level 2
 * as a rim and the brim, level 3 as a few pixels of specular on the crown and nowhere else. The
 * ramp's trap is that levels 1 and 2 are 99 levels of luma apart (see paint.ts), so a broad level-2
 * hood and a level-1 shoulder would read as two garments; everything lit here is kept to a rim.
 *
 * She is one of the two characters who get a mouth, Grandma being the other, and for the same
 * reason: section 6 bans one below 32px because it smears; at 64px it is four pixels and it is the
 * difference between a girl and a doll. The animals do not get one.
 */
const portraitPurple: Painter = (img) => {
  backdrop(img);

  // --- shoulders: the cloak, running off both edges of the frame ---
  img.ellipse(32, 74, 32, 26, shade('cloak', 0));
  img.ellipse(30.4, 72.6, 31, 25, shade('cloak', 2));
  img.ellipse(33, 75, 30, 24.4, shade('cloak', 1));
  // Two folds falling off the shoulders. Seams, not shading: this is where the 4x budget goes.
  for (const [fx, y0] of [
    [14, 56],
    [49, 58],
    [24, 60],
  ] as const)
    for (let y = y0; y < 64; y++) img.px(fx + (y - y0) * 0.14, y, shade('cloak', 0));

  // --- the hood: a dome, with the light landing along its top-left ---
  img.ellipse(32, 30, 21, 23, shade('cloak', 0));
  img.ellipse(31, 29, 20.2, 22.2, shade('cloak', 2));
  img.ellipse(33.4, 31, 18.8, 20.8, shade('cloak', 1));
  // Crown specular: three dashes following the curve, and the only level 3 above her shoulders.
  img.rect(25, 8, 5, 1, shade('cloak', 3));
  img.rect(21, 10, 4, 1, shade('cloak', 3));
  img.rect(18, 13, 3, 1, shade('cloak', 3));

  /*
   * The brim is the ring left over between the hood and the face, which is how a hood actually
   * works: draw it as a lit ellipse two pixels larger than the opening and then carve the opening
   * out of it. The first pass drew it as a separate dome on her forehead and she wore a helmet.
   */
  img.ellipse(32, 33, 16.6, 17.6, shade('cloak', 0));
  img.ellipse(31.2, 32.2, 16, 17, shade('cloak', 2));

  // --- the face, carved out of the brim ---
  img.ellipse(32, 33.6, 14.4, 15.4, shade('skin', 0));
  img.ellipse(32.6, 34, 13.6, 14.6, shade('skin', 1));
  img.ellipse(29.4, 30.4, 10.4, 10.4, shade('skin', 2));

  // Hair: a fringe with a broken edge, and a lock down each side of the jaw.
  img.ellipse(32, 22, 13, 6.4, shade('trunk', 1));
  img.ellipse(30.4, 21, 11.6, 5.4, shade('trunk', 2));
  for (const [hx, hy, r] of [
    [22, 25.5, 2.6],
    [27, 26.5, 2.4],
    [33, 26.5, 2.6],
    [38.5, 25.5, 2.4],
    [42.5, 24, 2.2],
  ] as const)
    img.ellipse(hx, hy, r, 2.2, shade('trunk', hx < 31 ? 1 : 0));
  for (const [hx, lean] of [
    [21, 0.1],
    [43, -0.1],
  ] as const)
    leanEllipse(img, hx, 31, 2.4, 8, lean, shade('trunk', lean > 0 ? 1 : 0));

  // --- features ---
  for (const ex of [25.5, 38.5]) {
    img.rect(Math.round(ex) - 4, 30, 8, 1, shade('trunk', 0)); // brow
    img.ellipse(ex, 35, 4, 3.2, shade('wall', 3));
    img.rect(Math.round(ex) - 4, 33, 8, 1, shade('trunk', 0)); // lash line
    img.ellipse(ex, 35.4, 2.1, 2.3, shade('ink', 0));
    img.px(ex - 1.4, 34, shade('wall', 3));
  }
  img.rect(31, 38, 2, 3, shade('skin', 0)); // nose
  img.px(30, 40, shade('skin', 0));
  img.rect(29, 44, 6, 1, shade('cloak', 0)); // mouth: four pixels, and no more
  img.px(30, 45, shade('skin', 0));
  img.px(33, 45, shade('skin', 0));
  img.rect(23, 39, 2, 1, shade('skin', 0)); // cheeks
  img.rect(40, 39, 2, 1, shade('skin', 0));
};

/**
 * The rabbit, from the board's dialogue frame: white, round, two tall leaf ears, eyes with no iris
 * at all. He is the friendliest thing in the game and the first skill you are offered, and that
 * contrast is the joke, so nothing here is sharpened.
 *
 * A white animal is the hardest subject in this palette -- `fur` levels 1 and 2 are nine levels of
 * luma apart -- so almost all of the modelling is how much level 0 is left showing.
 */
const portraitRabbit: Painter = (img) => {
  backdrop(img);

  // --- ears: shaded leaf, lit leaf inset up-left, warm inner channel ---
  const ear = (cx: number, cy: number, lean: number): void => {
    leanEllipse(img, cx, cy, 6, 17, lean, shade('fur', 0));
    leanEllipse(img, cx - 1.2, cy - 1, 4.8, 15.4, lean, shade('fur', 2));
    leanEllipse(img, cx + 0.2, cy + 2, 2.8, 11.6, lean, shade('skin', 0));
    leanEllipse(img, cx - 0.6, cy + 1.6, 1.7, 9.6, lean, shade('skin', 2));
  };
  ear(21, 20, -0.26);
  ear(43, 19, 0.26);

  // --- head, over the ear bases ---
  img.ellipse(32, 40, 18, 16, shade('fur', 0));
  img.ellipse(30.6, 38.6, 17.2, 15.2, shade('fur', 1));
  img.ellipse(27, 35, 11, 9, shade('fur', 2));
  // Cheek puffs: the jaw, and the reason the face is wider than the skull.
  img.ellipse(18.6, 46, 7, 5.6, shade('fur', 1));
  img.ellipse(45.4, 46, 7, 5.6, shade('fur', 0));
  img.ellipse(17.8, 45, 5.4, 4.2, shade('fur', 2));
  // Where each ear goes behind the skull, so they read as behind and not glued on. Two pixels of
  // it, tucked right against the skull's own edge: any more and he has a grey smudge on his brow.
  img.ellipse(22.6, 27.5, 4, 1.6, shade('fur', 0));
  img.ellipse(41.4, 26.5, 4, 1.6, shade('fur', 0));

  // --- eyes: all pupil, with one square of catchlight ---
  for (const ex of [24, 40]) {
    img.ellipse(ex, 39, 4.6, 5.2, shade('fur', 0));
    img.ellipse(ex, 39, 3.8, 4.4, shade('ink', 0));
    img.rect(ex - 3, 36, 2, 2, shade('wall', 3));
  }

  // Nose and the two lips under it: a wedge, never a filled square.
  img.rect(30, 47, 4, 2, shade('skin', 0));
  img.rect(31, 49, 2, 1, shade('skin', 0));
  img.rect(30, 47, 2, 1, shade('skin', 2));
  img.line(32, 50, 28, 52, shade('fur', 0));
  img.line(32, 50, 36, 52, shade('fur', 0));
  // Two front teeth, which is the rest of the rabbit.
  img.rect(30, 52, 2, 3, shade('wall', 3));
  img.rect(32, 52, 2, 3, shade('wall', 2));
  img.rect(30, 52, 4, 1, shade('fur', 0));

  // Whiskers, off both cheeks, out over the backdrop.
  for (const wy of [45, 49]) {
    img.line(2, wy - 2, 14, wy, shade('fur', 0));
    img.line(50, wy, 62, wy - 2, shade('fur', 0));
  }
};

/**
 * The owl: wide and low where the rabbit is tall and narrow, with two facial discs that push the
 * width out past the skull. The 4x budget goes on the coverts -- four layered courses on each
 * shoulder, lit on the left and in shade on the right -- which is what makes a bird rather than a
 * brown smudge with eyes.
 */
const portraitOwl: Painter = (img) => {
  backdrop(img);

  /*
   * Shoulders: a pale breast with the two wings folded over it. The first pass laid an even grid of
   * scallops across the whole width and it came back as a brick wall -- which is the warning in
   * section 1 exactly: four times the pixels bought four times the speckle. Here the breast is one
   * flat field, the barring is nine chevrons in three courses, and the layered coverts are kept to
   * the wings where a bird actually has them.
   */
  img.ellipse(32, 76, 31, 30, shade('trunk', 0));
  img.ellipse(30.6, 74.6, 30, 29, shade('trunk', 2));
  img.ellipse(33, 77, 29, 28, shade('trunk', 1));
  img.ellipse(32, 78, 15, 26, shade('trunk', 2));
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const y = 56 + r * 5;
      const x = 26 + c * 7 + (r % 2 ? 3.5 : 0);
      img.line(x - 2, y + 1.6, x, y, shade('trunk', 0));
      img.line(x, y, x + 2, y + 1.6, shade('trunk', 0));
    }
  for (const [wx, dir] of [
    [13, -1],
    [51, 1],
  ] as const)
    for (let i = 0; i < 3; i++) {
      const y = 53 + i * 5;
      img.ellipse(wx + dir * 0.8, y, 7.4 - i * 0.6, 3.6, shade('trunk', dir < 0 ? 1 : 0));
      if (dir < 0) img.ellipse(wx - 2.4, y - 0.8, 4.4, 2, shade('trunk', 2));
      img.line(wx, y + 3, wx + dir * 7, y + 3.4, shade('trunk', 0));
    }

  // --- the head: a flat-topped barrel, no neck ---
  img.ellipse(32, 34, 21, 18, shade('trunk', 0));
  img.ellipse(30.6, 32.6, 20.2, 17.2, shade('trunk', 2));
  img.ellipse(33, 35, 19, 16.4, shade('trunk', 1));

  // --- ear tufts: narrow, pointed, leaning out. Rounded ones turn him into a cat ---
  for (const [tx, lean] of [
    [19, -0.44],
    [45, 0.44],
  ] as const) {
    for (let i = 0; i < 14; i++) {
      const w = Math.max(1, Math.round(1 + i * 0.5));
      img.rect(Math.round(tx - w / 2 + lean * i), 6 + i, w, 1, shade('trunk', 0));
      if (i > 3 && w > 2)
        img.rect(Math.round(tx - w / 2 + lean * i), 6 + i, 1, 1, shade('trunk', lean < 0 ? 2 : 1));
    }
  }

  // --- the facial discs, which are the owl ---
  for (const dx of [-10, 10]) {
    const cx = 32 + dx;
    img.ellipse(cx, 35, 11.4, 11.4, shade('trunk', 0));
    img.ellipse(cx, 35, 10.2, 10.2, shade('wall', 1));
    img.ellipse(cx - 1.4, 33.6, 8, 8, shade('wall', 2));
    img.ellipse(cx, 35, 5.4, 5.4, shade('ink', 0));
    img.rect(Math.round(cx) - 4, 31, 3, 3, shade('wall', 3));
    // The ruff: one broken ring of dark feather ends round each disc.
    for (let a = 0; a < 14; a++) {
      const t = (a / 14) * Math.PI * 2;
      img.px(cx + Math.cos(t) * 11, 35 + Math.sin(t) * 11, shade('trunk', 0));
    }
  }

  // Beak between the discs: four courses, lit on the left, dark at the tip.
  img.rect(29, 40, 6, 2, shade('gold', 0));
  img.rect(29, 42, 6, 4, shade('gold', 1));
  img.rect(29, 42, 2, 4, shade('gold', 2));
  img.rect(30, 46, 4, 2, shade('gold', 0));
  img.rect(31, 48, 2, 2, shade('gold', 0));
  // Chin feathers, over the join of beak and breast.
  for (let i = 0; i < 5; i++) img.ellipse(23 + i * 4.5, 51, 2.4, 1.8, shade('trunk', 2));
};

/**
 * The Lantern Keeper. No reference exists for him anywhere (docs/ART_PRODUCTION.md section 5), so
 * this follows the design the cast sprite settled on: a badger in a hooded coat, carrying the
 * lantern on a pole. The lantern IS the skill, so it is the only bright object in the frame and it
 * sits bottom-left -- the corner the world's one light comes from -- with solid `gold` pixels where
 * it lands on his hood and snout and nothing at all in the air between.
 *
 * The badger reads by his head stripes alone. His face is five pixels tall on the sprite; here it is
 * twenty, so the stripes can run properly from the crown down past the eye.
 */
const portraitKeeper: Painter = (img) => {
  backdrop(img);

  /*
   * His coat is `roof`, the same slate the cast sprite wears, and for the same reason: `night` 2
   * and 3 are #441363 and #6D2D93, which are `cloak` 0 and 1 exactly, so a coat lit in them was a
   * second character wearing Purple's two tokens. See the note on `paintKeeper` in cast.ts.
   *
   * It also retires the one collision this set had. His coat used to BE the backdrop ramp -- a
   * `night` 1 cloth on a `night` 1 niche has no edge at all -- and the fix was an `ink` 0
   * under-shape a pixel larger round every mass, a black key line on a character the standard
   * reserves that treatment away from. Slate on a purple niche needs no such trick: `roof` 0 sits
   * 37 levels off the niche and flips hue against it, so each mass is its own dark again.
   */
  img.ellipse(32, 74, 32, 27, shade('roof', 0));
  img.ellipse(30.4, 72.6, 30.2, 25.2, shade('roof', 2));
  img.ellipse(33.4, 75, 28.6, 24, shade('roof', 1));

  // --- the hood ---
  img.ellipse(32, 30, 22.6, 21.6, shade('roof', 0));
  img.ellipse(30.4, 28.4, 20.8, 19.8, shade('roof', 2));
  img.ellipse(33.6, 31, 18.4, 17.8, shade('roof', 1));
  // The peak at the back of the hood, and the brim rolled round the opening.
  img.ellipse(46, 17, 7, 5.4, shade('roof', 0));
  img.ellipse(45.4, 16, 5.6, 4, shade('roof', 1));
  img.ellipse(32, 25, 16, 6.4, shade('roof', 0));

  /*
   * The badger, and the two things that kept going wrong with him. Wide stripes beside two plain
   * eyes made a skull; stripes running through the eyes with a pale rim round each made spectacles.
   * What he needed was neither: thin stripes outboard, plain dark eyes on the white, and above all
   * a SNOUT that reads as projecting. White fur on a white face has no edge of its own, so the
   * muzzle is built the way every other mass here is -- a `fur` 0 under-shape, the base inset, the
   * lit plane along its top -- and it gets a dark lip beneath, which is what finally turned a white
   * blob with holes in it into an animal pointing somewhere.
   */
  img.ellipse(32, 35.5, 15.4, 13, shade('fur', 0));
  img.ellipse(31, 34.5, 14.6, 12.2, shade('fur', 1));
  img.ellipse(28.4, 31.5, 10.4, 7.6, shade('fur', 2));

  // The stripes: narrow, well inside the white, and running on past the face onto the hood. Drawn
  // at the face's edge they merged into the hood's own dark and the whole head read as a void.
  // `roof` 0 is the dark of his own coat and reads black against his white at 162 levels, which is
  // all a badger stripe needs; Cyera Black stays with the wolf.
  for (const [sx, lean] of [
    [24, -0.12],
    [40, 0.1],
  ] as const) {
    leanEllipse(img, sx, 35.5, 2.4, 10, lean, shade('roof', 0));
    leanEllipse(img, sx - lean * 14, 25, 1.7, 5, lean, shade('roof', 0));
  }

  // Snout, out of the bottom of the face and down-left.
  limb(img, 32, 40, 28, 47, 13, 9, shade('fur', 0));
  limb(img, 31.4, 39.4, 27.6, 46.2, 10, 6, shade('fur', 1));
  limb(img, 30.6, 38.4, 27, 45, 5.4, 3.2, shade('fur', 2));
  img.ellipse(27.6, 47.6, 4.4, 3.2, shade('roof', 0));
  img.px(25.4, 46.2, shade('fur', 3));
  img.line(28, 51, 32.5, 52, shade('roof', 0)); // the lip, which is what gives him a mouth
  img.line(32.5, 52, 36, 50.6, shade('roof', 0));

  // Eyes: plain, dark, on the white, and set just inboard of the stripes.
  for (const ex of [28, 36]) {
    img.ellipse(ex, 34.5, 2.4, 2.4, shade('roof', 0));
    img.px(ex - 1, 33.3, shade('fur', 3));
  }

  // --- the lantern, hung off the pole at his shoulder. It is the skill, so it is the only bright
  //     object in the frame, and it sits in the corner the world's one light comes from.
  limb(img, 11, 64, 13, 22, 3, 3, shade('wood', 1));
  limb(img, 10.2, 64, 12.2, 22, 1.2, 1.2, shade('wood', 2));
  img.frame(10, 20, 5, 5, shade('wood', 0));
  img.rect(4, 25, 15, 3, shade('wood', 0));
  img.rect(6, 23, 11, 2, shade('wood', 1));
  img.rect(6, 23, 3, 1, shade('wood', 2));
  img.rect(4, 28, 15, 15, shade('wood', 0));
  img.rect(6, 30, 11, 11, shade('gold', 1));
  img.rect(6, 30, 11, 4, shade('gold', 2));
  img.rect(11, 30, 1, 11, shade('wood', 0)); // mullions, which the flame passes in front of
  img.rect(6, 35, 11, 1, shade('wood', 0));
  img.ellipse(11.5, 36, 3, 4.6, shade('gold', 3));
  img.ellipse(11.5, 37.4, 1.6, 2.4, shade('wall', 3));
  img.rect(4, 43, 15, 3, shade('wood', 0));
  img.rect(6, 46, 11, 2, shade('wood', 0));
  img.px(4, 43, shade('wood', 1));

  // What the lantern lands on. Solid pixels on the objects, never a halo in the air -- and few
  // enough of them to read as light: a pixel every row down the hood's edge is a zip fastener.
  for (const [lx, ly] of [
    [15, 24],
    [14, 31],
    [15, 39],
    [18, 47],
    [23, 54],
    [24, 46],
  ] as const)
    img.px(lx, ly, shade('gold', 1));
};

/**
 * That's not my grandma.
 *
 * The whole ending turns on this frame being genuinely ambiguous at a glance, so it is built to be
 * read in two passes. First pass: two big pale masses -- a bonnet with a scalloped band and a
 * knitted shawl -- a ribbon tied under the chin, and a dark round face between them. That is a
 * grandmother, and it is all the eye takes at portrait size.
 *
 * Second pass, and only if you look: the eyes are gold with a vertical slit, there is a muzzle
 * hanging a third of the frame below the skull, one fang clears the lip, and the two points you took
 * for the bonnet's own corners are ears. The ear tips are deliberately kept LOW, level with the
 * crown and in the same near-black as the backdrop's corners -- a pair of tall ears standing clear
 * above the brim would give it away from across the room, and then there is no game.
 *
 * He stays at the bottom of his ramp: `wolf` 0 and 1 carry almost all of the fur, level 2 is a rim.
 * Pale bonnet at `wall` 1..3 (luma 175 to 250) over fur at 29 to 67 is the only contrast the frame
 * needs, and it is the same contrast the cast sprite's frame 3 uses.
 */
const portraitWolfGrandma: Painter = (img) => {
  backdrop(img);
  shawl(img);

  // --- ears, out from under the bonnet: LOW, leaning out, and the same near-black as the corners.
  //     Tall ears clear of the brim would give the whole thing away from across the room.
  const ear = (cx: number, lean: number): void => {
    for (let i = 0; i < 15; i++) {
      const w = Math.max(1, Math.round(1 + i * 0.58));
      img.rect(Math.round(cx - w / 2 + lean * i), 11 + i, w, 1, shade('wolf', 0));
    }
    for (let i = 5; i < 14; i++) {
      const w = Math.max(1, Math.round((i - 4) * 0.6));
      img.rect(Math.round(cx - w / 2 + lean * i), 11 + i, w, 1, shade('wolf', 2));
    }
  };
  ear(13, -0.22);
  ear(51, 0.22);

  // --- the skull: low and wide, most of it under the bonnet's shadow ---
  img.ellipse(32, 36, 15.5, 13, shade('wolf', 0));
  img.ellipse(31, 35, 14.8, 12.4, shade('wolf', 1));
  img.ellipse(28, 31.5, 9, 6.4, shade('wolf', 2));
  // A lit edge down the left cheek, so the head has a near side and a far side.
  leanEllipse(img, 18.6, 42, 2, 6, -0.16, shade('wolf', 2));

  /*
   * The muzzle, driven down and forward out of the skull. A grandmother has not got one, and it is
   * the one shape here that no amount of bonnet explains away -- but it only reads as a muzzle if
   * the cheeks survive either side of it and the bridge sits a level above them. Drawn at the first
   * pass's width it covered the whole lower face and came back as a beard.
   */
  limb(img, 32, 40, 30, 50, 13, 10, shade('wolf', 0));
  limb(img, 31.4, 39.4, 29.4, 49, 10.4, 7, shade('wolf', 1));
  // The bridge: a lit strip down the top of the muzzle. Without it the muzzle is the same value as
  // the skull it comes out of, and the whole lower face reads as one dark lump.
  limb(img, 30.6, 38, 28.8, 47, 4.6, 3.2, shade('wolf', 2));
  img.ellipse(29.6, 50.4, 4.2, 2.9, shade('ink', 0)); // nose
  img.px(27.8, 49.2, shade('wall', 2));
  // The jaw and the lip under the nose: without a mouth the muzzle is a trunk.
  img.ellipse(32, 53, 6, 3.4, shade('wolf', 0));
  img.ellipse(30.6, 52.4, 3.4, 1.8, shade('wolf', 2)); // the chin's lit edge
  img.line(29.6, 53.4, 35, 54.4, shade('ink', 0));
  img.line(35, 54.4, 39, 52.4, shade('wolf', 0));
  // One fang over the lip. Two is a cartoon; one you notice a second late.
  img.rect(31, 54, 2, 3, shade('wall', 3));
  img.px(31, 56, shade('wall', 1));

  // --- the eyes: gold, narrowed, and slit. Small: two broad gold panes read as headlights ---
  for (const ex of [24.5, 39.5]) {
    img.rect(ex - 4, 30.6, 8, 2, shade('wolf', 0)); // brow ridge, the glare
    img.ellipse(ex, 34.4, 3.4, 1.9, shade('gold', 0));
    img.ellipse(ex, 34.4, 2.7, 1.3, shade('gold', 2));
    img.px(ex - 1, 33.8, shade('gold', 3));
    img.rect(ex, 33.2, 1, 2.6, shade('ink', 0));
  }

  // --- the bonnet, over the skull and under the ear tips ---
  bonnet(img, shade('wolf', 0));
};

/**
 * And this one is.
 *
 * The manifest never budgeted her (docs/ASSETS.md lists five portraits), so until now every ending
 * was captioned with the wolf: "Clean arrival / Grandma waves from her chair" under a wolf in a
 * bonnet, on a run where he never got near the house (docs/UX_REVIEW.md 3). The clean ending is the
 * one the whole lesson is trying to earn, and it was being told it had failed.
 *
 * She wears the same costume as he does, literally -- `shawl` and `bonnet` are the same two calls,
 * in the same order -- because that is the premise: he is wearing HERS. So the whole of the
 * difference sits in the face between them, and all of it is the kind of thing you would notice
 * from the doorstep and not from the garden gate:
 *
 *   a pale face on the warm `skin` ramp where his is near-black fur;
 *   a round skull and a chin, with no muzzle hanging a third of the frame below it;
 *   round dark eyes with a catchlight behind wire spectacles, not gold slits;
 *   silver hair at the temples, where his bonnet has two low grey points that are ears;
 *   and a mouth that is smiling, with nothing over the lip.
 *
 * She is the second face in the game to get a mouth, after Purple's, and for the same reason: section
 * 6 of docs/PIXEL_STANDARD.md bans one below 32px because it smears, and at 64px it is four pixels
 * and it is the difference between a person and a doll. Both human faces here get those four
 * pixels; none of the animals do.
 */
const portraitGrandma: Painter = (img) => {
  backdrop(img);
  shawl(img);

  // --- hair: two silver locks at the temples, laid over the head's own edge and standing a little
  //     proud of it. They sit INBOARD of where his ear tips are, so the frame's top corners stay
  //     empty -- the shape he borrowed is hers, but the points in it are not.
  for (const [hx, lean] of [
    [19, -0.14],
    [45, 0.14],
  ] as const) {
    leanEllipse(img, hx, 36, 3.8, 9.5, lean, shade('stone', 0));
    leanEllipse(img, hx - lean * 7, 34.5, 2.4, 7.6, lean, shade('stone', 2));
  }

  // --- the head: round, and a good deal smaller than his, because nothing is hidden under it ---
  img.ellipse(32, 38, 14.4, 13.4, shade('skin', 0));
  img.ellipse(31, 37, 13.6, 12.6, shade('skin', 1));
  img.ellipse(28.4, 33.6, 9, 7, shade('skin', 2));
  // The lock in front of each temple again, so the hair reads over the face and not behind it.
  for (const [hx, lean] of [
    [20, -0.14],
    [44, 0.14],
  ] as const) {
    leanEllipse(img, hx, 34, 2.6, 7, lean, shade('stone', 0));
    leanEllipse(img, hx - lean * 5, 32.6, 1.5, 5.4, lean, shade('stone', 2));
  }

  /*
   * Eyes first, spectacles over them, because that is the order they are in. Dark and round with
   * one square of catchlight -- the same eye the rabbit has, two sizes down. His are gold with a
   * vertical slit, and that is the tell nobody misses once they have seen hers.
   */
  for (const ex of [25, 39]) {
    img.rect(Math.round(ex) - 4, 31, 8, 1, shade('stone', 0)); // brow, silver like the hair
    img.ellipse(ex, 38.4, 2.9, 2.9, shade('skin', 0));
    img.ellipse(ex, 38.4, 2.3, 2.3, shade('ink', 0));
    img.px(ex - 1.2, 37.2, shade('wall', 3));
  }
  /*
   * Wire rims, one pixel thick, in the tortoiseshell dark of the `wood` ramp. Two pixels of rim
   * came back as sunglasses, which made her a stranger at the door, which is the one thing this
   * portrait cannot be.
   */
  for (const ex of [25, 39]) ring(img, ex, 38.4, 6, 5.4, 1, shade('wood', 0));
  img.rect(31, 38, 2, 1, shade('wood', 0)); // the bridge
  img.line(19, 35.6, 19.6, 37, shade('wood', 0)); // and the arms, back into the hair
  img.line(45, 35.6, 44.4, 37, shade('wood', 0));

  // --- the rest of the face: a nose between the lenses, a smile under it, two warm cheeks ---
  img.rect(31, 42, 2, 3, shade('skin', 0));
  img.px(30, 44, shade('skin', 0));
  /*
   * The mouth: a flat line with its two end pixels lifted. Drawn as two converging strokes it came
   * back as a shallow V -- a frown, on the one portrait in the game whose whole job is to be glad
   * to see you. A raised corner is the only pixel that says smiling at this size.
   */
  img.rect(29, 48, 6, 1, shade('wood', 0));
  img.px(28, 47, shade('wood', 0));
  img.px(35, 47, shade('wood', 0));
  img.rect(30, 49, 4, 1, shade('skin', 2)); // the lit lower lip
  img.ellipse(32, 51.4, 4.6, 1.4, shade('skin', 0)); // and the chin, off the shawl behind it
  img.rect(22, 45, 3, 1, shade('skin', 0));
  img.rect(39, 45, 3, 1, shade('skin', 0));

  // --- and the same bonnet, dropping the same shadow, on skin this time ---
  bonnet(img, shade('skin', 0));
};

// ----------------------------------------------------------------------------- items (64x64)

/**
 * The compass, straight off the board: a gold case with a hinged bow, a pale dial, a needle. The 4x
 * budget buys the things that make it an instrument -- knurling round the bezel, eight ticks on the
 * dial, a glass gloss across the top-left -- rather than a bigger flat disc.
 *
 * The needle's north was Purple's own scarlet on the board and `cloak` in the 16px painter, which after
 * the rebrand means it was wearing her ramp. Her ramp belongs to her: north goes to `night` 2, which
 * is Deep Purple #441363 exactly, and lights to `night` 3, Aubergine. Same two tokens as the wax
 * seal, and the compass stops borrowing from the one character the palette exists to make findable.
 */
const compass: Painter = (img) => {
  // Bow and hinge at twelve o'clock.
  ring(img, 32, 6, 6, 5.4, 2.4, shade('gold', 0));
  ring(img, 31, 5, 5.2, 4.6, 1.4, shade('gold', 2));
  img.rect(28, 9, 8, 5, shade('gold', 0));
  img.rect(28, 9, 3, 5, shade('gold', 2));

  // Case, then the knurled bezel.
  img.ellipse(32, 38, 25, 25, shade('gold', 0));
  img.ellipse(30.8, 36.8, 24, 24, shade('gold', 2));
  img.ellipse(33, 39, 22.6, 22.6, shade('gold', 1));
  for (let a = 0; a < 28; a++) {
    const t = (a / 28) * Math.PI * 2;
    img.px(32 + Math.cos(t) * 23.4, 38 + Math.sin(t) * 23.4, shade('gold', 0));
  }

  // Dial.
  img.ellipse(32, 38, 19.4, 19.4, shade('wall', 0));
  img.ellipse(32, 38, 18.4, 18.4, shade('wall', 1));
  img.ellipse(29.6, 35.6, 14.4, 14.4, shade('wall', 2));
  /*
   * Four cardinal points as inward diamonds, four quarters as single pixels. Eight even ticks
   * turned it into a clock face on the first pass, which is a real failure mode for a round gold
   * object with a pointer in it -- the diamonds are what say instrument rather than hour.
   */
  for (let a = 1; a < 4; a++) {
    const t = (a / 4) * Math.PI * 2 - Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const r = 17 - i;
      const w = Math.max(0.5, (3 - i) * 0.6);
      img.ellipse(32 + Math.cos(t) * r, 38 + Math.sin(t) * r, w, w, shade('ink', 0));
    }
  }
  for (let a = 0; a < 4; a++) {
    const t = ((a + 0.5) / 4) * Math.PI * 2 - Math.PI / 2;
    img.ellipse(32 + Math.cos(t) * 15.5, 38 + Math.sin(t) * 15.5, 1, 1, shade('stone', 0));
  }
  // North gets a letter instead of a mark. Four pixels, and it is the single cheapest thing that
  // stops a round gold case with one pointer in it from being read as a pocket watch.
  img.rect(29, 22, 1, 5, shade('ink', 0));
  img.rect(33, 22, 1, 5, shade('ink', 0));
  img.line(30, 23, 32, 26, shade('ink', 0));

  // Needle: north up-right as on the board, south pale and opposite.
  limb(img, 32, 38, 44, 26, 7, 1, shade('night', 2));
  limb(img, 31, 37, 43, 25, 3, 1, shade('night', 3));
  limb(img, 32, 38, 21, 49, 6, 1, shade('wall', 1));
  limb(img, 32, 38, 21.6, 48.4, 2.6, 1, shade('wall', 3));
  img.ellipse(32, 38, 3, 3, shade('gold', 0));
  img.ellipse(31.4, 37.4, 1.6, 1.6, shade('gold', 3));

  // Glass: two parallel strokes up the top-left, which is all a reflection ever is in pixels.
  img.line(21, 30, 27, 24, shade('wall', 3));
  img.line(22, 31, 28, 25, shade('wall', 3));
  img.line(19, 33, 22, 30, shade('wall', 3));

  // Its own dark: a gold case is ringed in gold's own shade, not in the wolf's black.
  img.outline(shade('gold', 0));
};

/**
 * The translator. Nothing in the fiction says what it looks like (docs/ART_PRODUCTION.md section 6
 * calls it the hardest of the five), and the 16px painter drew an open book -- which says "words"
 * but says nothing about the one thing the card actually does. Its promise is "sends your answers
 * ahead so the forest folk understand you" and its fine print is "also copies every message to a
 * helper", so the object had to be about SENDING, and about sending twice.
 *
 * The decision: a speaking horn. A big silver bell facing the viewer, a wrapped tube, a mouthpiece
 * -- period-correct for this forest, unmistakable in silhouette at 64px, and it says "your voice,
 * carried further" without a word of text. And a SECOND, smaller bell branches off the tube and
 * points away from you, drawn a step darker so it is quiet. That is the fine print, in the shape of
 * the object: it speaks in two directions, and you only see the second one if you look. Same trick
 * as the pawprints, same lesson as the game.
 *
 * Silver rather than brass, because the compass and the key already own the `gold` ramp and three
 * gold items on one card is a pile of treasure. `gold` is kept for the two rim bands.
 */
const translator: Painter = (img) => {
  // The second bell first, so the main horn overlaps it where they join.
  limb(img, 22, 44, 34, 52, 6, 11, shade('stone', 0));
  img.ellipse(37, 53, 4.6, 6.4, shade('stone', 0));
  img.ellipse(36.4, 52.2, 3.8, 5.6, shade('stone', 1));
  img.ellipse(37.8, 53.6, 2.8, 4.4, shade('ink', 1));
  img.ellipse(38.6, 54.4, 1.8, 2.8, shade('ink', 2));
  ring(img, 37, 53, 4.6, 6.4, 1.2, shade('gold', 0));

  // Mouthpiece, at the narrow end, where a mouth goes.
  img.ellipse(8, 56, 4.6, 4, shade('stone', 0));
  img.ellipse(7.2, 55, 3.6, 3, shade('stone', 2));
  img.ellipse(8.4, 56.6, 2.2, 1.8, shade('ink', 1));

  /*
   * The horn, in two runs with a bend between them. Three passes to get here and every one of them
   * failed in a different way: a parallel tube with a disc on the end was a magnifying glass, a
   * short hard flare was a hairdryer, and a long slow flare with a small mouth was a telescope.
   * What separates a speaking horn from all three is that the bore stays NARROW for most of its
   * length and then opens wide and fast at the end, and that it is not straight. The bend is the
   * cheapest half of that: nothing optical bends.
   */
  limb(img, 10, 54, 26, 42, 7, 11, shade('stone', 0));
  limb(img, 26, 42, 42, 22, 11, 26, shade('stone', 0));
  limb(img, 9.4, 53, 25.6, 41, 5, 8, shade('stone', 1));
  limb(img, 25.6, 41, 41.4, 21, 8, 21, shade('stone', 1));
  limb(img, 9, 51.8, 25, 39.6, 2.2, 3, shade('stone', 2));
  limb(img, 25, 39.6, 40, 19.6, 3, 7, shade('stone', 2));

  // One brass ferrule across the bore, at the bend.
  limb(img, 21, 36, 28, 46, 4.5, 4.5, shade('gold', 1));
  limb(img, 20.4, 35.4, 27.4, 45.4, 2.2, 2.2, shade('gold', 2));

  // The bell mouth: an ellipse taller than it is wide, which is a circle seen at this angle, with a
  // throat that recedes. The far wall of a cone catches the light and the near rim shades into it;
  // without that the mouth is a disc stuck on the end.
  img.ellipse(46, 19, 12, 16, shade('stone', 0));
  img.ellipse(45, 18, 11, 15, shade('stone', 2));
  img.ellipse(46.8, 19.8, 9.6, 13.4, shade('stone', 1));
  img.ellipse(47, 20, 7.6, 11, shade('ink', 1));
  img.ellipse(48, 21, 5.8, 8.4, shade('ink', 2));
  img.ellipse(49, 22, 3.4, 5.2, shade('ink', 3));
  ring(img, 46, 19, 12, 16, 1.6, shade('gold', 1));
  ring(img, 45, 18, 11, 15, 1, shade('gold', 2));

  img.outline(shade('stone', 0)); // silver's own dark
};

/**
 * The lantern, from the board's hanging lamp: a dark frame with warm panes, not the gold brick the
 * 16px painter drew by putting every pixel of it on one ramp. The frame is `wood` (the board's
 * bronze), the glass is `gold`, and the flame is the only level 3 in the frame -- the rebrand leaves
 * it alone on purpose, because it is a light source and it is the skill.
 */
const lantern: Painter = (img) => {
  // Hanging ring and the hook under it.
  ring(img, 32, 6, 5, 4.6, 2, shade('wood', 0));
  img.px(29, 4, shade('wood', 2));
  img.rect(31, 10, 2, 3, shade('wood', 0));

  // Cap: five courses, each wider than the last, lit along the left.
  for (let i = 0; i < 6; i++) {
    const half = 5 + i * 2.2;
    img.rect(Math.round(32 - half), 13 + i, Math.round(half * 2), 1, shade('wood', 0));
    img.rect(Math.round(32 - half), 13 + i, 2, 1, shade('wood', 2));
    if (i < 5)
      img.rect(Math.round(32 - half) + 2, 13 + i, Math.round(half * 2) - 5, 1, shade('wood', 1));
  }
  img.rect(14, 19, 36, 3, shade('wood', 0));
  img.rect(14, 19, 36, 1, shade('wood', 1));

  // Body: frame, four panes, mullions, then the flame in front of them.
  img.rect(16, 22, 32, 26, shade('wood', 0));
  img.rect(19, 25, 26, 20, shade('gold', 1));
  img.rect(19, 25, 26, 7, shade('gold', 2));
  img.rect(31, 25, 2, 20, shade('wood', 0));
  img.rect(19, 33, 26, 2, shade('wood', 0));
  img.rect(16, 22, 3, 26, shade('wood', 1));
  img.rect(16, 22, 1, 26, shade('wood', 2));
  img.rect(45, 22, 3, 26, shade('wood', 0));
  // Glass gloss on the top-left pane only.
  img.line(22, 31, 27, 26, shade('wall', 3));
  img.line(23, 31.6, 28, 26.6, shade('wall', 3));
  // Burner, wick and flame.
  img.rect(28, 41, 8, 4, shade('wood', 0));
  img.rect(28, 41, 8, 1, shade('wood', 1));
  img.ellipse(32, 36, 5, 8, shade('gold', 3));
  img.ellipse(32, 37.6, 2.8, 5, shade('wall', 3));

  // Base and feet.
  img.rect(13, 48, 38, 4, shade('wood', 0));
  img.rect(13, 48, 38, 1, shade('wood', 1));
  img.rect(13, 48, 2, 4, shade('wood', 2));
  img.rect(18, 52, 28, 3, shade('wood', 0));
  img.rect(19, 55, 4, 3, shade('wood', 0));
  img.rect(41, 55, 4, 3, shade('wood', 0));

  img.outline(shade('wood', 0)); // the bronze frame's own dark
};

/**
 * The cottage key: a ringed bow, a collar, a shaft and a bit with two teeth. It only reads as a key
 * because the bow is a RING -- the 16px painter tried to punch the hole by drawing transparent over
 * the disc, which `Img.px` cannot do (it takes the max of the two alphas), so it shipped as a gold
 * lollipop. The `ring` helper at the top of this file exists for that bug.
 */
const key: Painter = (img) => {
  // Finial, then the bow.
  img.rect(30, 2, 4, 4, shade('gold', 0));
  img.rect(30, 2, 2, 2, shade('gold', 2));
  ring(img, 32, 17, 13, 13, 5, shade('gold', 0));
  ring(img, 30.8, 15.8, 12, 12, 3, shade('gold', 2));
  ring(img, 33, 18, 11.6, 11.6, 2.6, shade('gold', 1));

  // Collar: where the bow becomes the shaft, and the one place a key is thickest.
  img.rect(26, 29, 12, 5, shade('gold', 0));
  img.rect(26, 29, 12, 2, shade('gold', 2));
  img.rect(27, 34, 10, 2, shade('gold', 1));

  // Shaft, lit down the left and shaded down the right.
  img.rect(28, 34, 8, 26, shade('gold', 1));
  img.rect(28, 34, 2, 26, shade('gold', 2));
  img.rect(35, 34, 1, 26, shade('gold', 0));

  // Bit: two teeth of different lengths, which is what distinguishes a key from a nail.
  img.rect(36, 42, 10, 5, shade('gold', 1));
  img.rect(36, 42, 10, 2, shade('gold', 2));
  img.rect(36, 46, 10, 1, shade('gold', 0));
  img.rect(36, 52, 13, 6, shade('gold', 1));
  img.rect(36, 52, 13, 2, shade('gold', 2));
  img.rect(36, 57, 13, 1, shade('gold', 0));
  img.rect(44, 52, 2, 6, shade('gold', 0));

  // End cap.
  img.rect(27, 59, 10, 3, shade('gold', 0));
  img.rect(27, 59, 10, 1, shade('gold', 1));

  img.outline(shade('gold', 0)); // the key's own dark
};

/**
 * The letter in Purple's basket, with the flap folded and the wax still on it. The 4x budget goes on
 * the fold: the flap is a plane of its own, one level darker than the paper it lies on, with its
 * creases drawn and a lit edge along its top, instead of the two diagonal scratches the 16px version
 * had room for.
 *
 * The seal is Deep Purple per docs/ART_PRODUCTION.md section 6a: `night` 2 is #441363 exactly and
 * `night` 3 is Aubergine, so the seal takes the brand tokens without borrowing Purple's ramp. The heart
 * is the board's own motif and is pressed INTO the wax -- its near rim shades, its far wall catches
 * the light -- which is the opposite of how a raised shape is lit and the only thing that stops it
 * reading as a sticker.
 */
const letter: Painter = (img) => {
  // Paper.
  img.rect(4, 14, 56, 38, shade('wall', 1));
  img.rect(4, 14, 56, 2, shade('wall', 3));
  img.rect(4, 16, 2, 34, shade('wall', 3));
  img.rect(6, 16, 52, 32, shade('wall', 2));
  img.rect(4, 49, 56, 3, shade('wall', 0));
  img.rect(57, 16, 3, 36, shade('wall', 0));

  // The flap: its own plane, one step down, with the creases that fold it.
  for (let y = 14; y <= 38; y++) {
    const inset = ((y - 14) * 27) / 24;
    img.rect(Math.round(4 + inset), y, Math.round(56 - inset * 2), 1, shade('wall', 1));
    img.px(Math.round(4 + inset), y, shade('wall', 3));
    img.px(Math.round(59 - inset), y, shade('wall', 0));
  }
  img.line(4, 14, 32, 39, shade('wall', 0));
  img.line(60, 14, 32, 39, shade('wall', 0));
  img.rect(4, 14, 56, 1, shade('wall', 3));
  // The two back creases, running up from the bottom corners.
  img.line(4, 51, 24, 37, shade('wall', 0));
  img.line(60, 51, 40, 37, shade('wall', 0));

  // Wax.
  img.ellipse(32, 36, 9, 8.4, shade('night', 0));
  img.ellipse(31, 35, 8.4, 7.8, shade('night', 3));
  img.ellipse(32.8, 36.8, 7.4, 6.8, shade('night', 2));
  for (const [dx, dy] of [
    [-8, 3],
    [7, 4],
    [1, 8],
  ] as const)
    img.ellipse(32 + dx, 36 + dy, 2, 1.6, shade('night', 2));
  // The heart, pressed in: dark on the near rim, lit where the far wall turns up to the light.
  img.ellipse(29.6, 34.4, 2.6, 2.2, shade('night', 0));
  img.ellipse(34.4, 34.4, 2.6, 2.2, shade('night', 0));
  for (let i = 0; i < 6; i++) img.rect(27 + i, 36 + i, 10 - i * 2, 1, shade('night', 0));
  img.px(35.6, 35.6, shade('night', 3));
  img.px(34.6, 37.6, shade('night', 3));
  img.px(33.6, 39, shade('night', 3));

  img.outline(shade('wall', 0)); // the paper's own dark
};

/*
 * THE FOUR THAT WERE MISSING, painted 2026-10-22 for v2's seven-skill deal: the signpost, the
 * parcel, the map and the latch. Until now their cards, the basket and the reveal showed a lettered
 * placeholder ("WT", "SP", "SC", "LL"), and the ratchet in packages/core/test/v2/real-content.test.ts
 * named them.
 *
 * They are drawn in the same hand as the five above, deliberately: chunky masses that fill the
 * frame, flat faces at level 1, a lit top-left edge at level 2, the bottom and right at level 0,
 * level 3 kept to edges and glints, and an outline in the object's own dark. Every colour is a
 * `shade` call; `keyline` appears twice, for the two things that have no level 0 of their own to
 * spare (the parcel's shaded face IS `path` 0, and the grass tuft is a second object).
 *
 * Seven icons share a card, so each new one takes a ramp the set was not already leaning on: the
 * compass and key are `gold`, the horn `stone`, the lantern `wood` frame, the letter `wall`. The
 * signpost stays `wood` because the forest's own signpost (s-props.ts) is `wood` and the card should
 * show the thing you saw; its post drops to `trunk` so the boards separate from it. The parcel is
 * kraft, which is `path`; the map is cream paper, `wall`, told from the letter by everything drawn
 * on it; the door is `trunk` planks with `stone` iron, which is the only dark-ground icon and so the
 * one where the silver reads.
 *
 * Three of them carry the fine print in the shape of the object, the translator's trick: a note
 * pinned to the signpost's post (the bad Way Teller "follows any note pinned to a tree"), and a
 * long way and a short way on the map (the quicker tracks). The icon is the SAME for the good and
 * the bad card, so neither hint gives a deal away; they only reward looking, in the reveal.
 */

/** Fills each row from y0 to y1 between the two columns `span` returns for it, inclusive. */
function rows(
  img: Img,
  y0: number,
  y1: number,
  span: (y: number) => readonly [number, number] | null,
  c: RGBA,
): void {
  for (let y = y0; y <= y1; y++) {
    const s = span(y);
    if (s && s[1] >= s[0]) img.rect(s[0], y, s[1] - s[0] + 1, 1, c);
  }
}

/**
 * One arrow board for the signpost: a plank with a square end and a pointed end. Each row is lit or
 * shaded by which way its pixels face -- the top edge and the upper slant of the point turn to the
 * light, the bottom two rows and the lower slant turn away -- so the point reads as a bevel rather
 * than a flat triangle.
 */
function arrowBoard(
  img: Img,
  x0: number,
  x1: number,
  top: number,
  h: number,
  tip: number,
  pointRight: boolean,
): void {
  const half = (h - 1) / 2;
  const mid = top + half;
  for (let y = top; y < top + h; y++) {
    const ext = Math.round(tip * (1 - Math.abs(y - mid) / half));
    const l = pointRight ? x0 : x0 - ext;
    const r = pointRight ? x1 + ext : x1;
    const w = r - l + 1;
    if (y === top) {
      img.rect(l, y, w, 1, shade('wood', 2));
      img.rect(l, y, 3, 1, shade('wood', 3));
      continue;
    }
    if (y >= top + h - 2) {
      img.rect(l, y, w, 1, shade('wood', 0));
      continue;
    }
    img.rect(l, y, w, 1, shade('wood', 1));
    // The square end: lit on the left board edge, shaded on the right.
    if (pointRight) img.rect(l, y, 2, 1, shade('wood', 2));
    else img.rect(r - 1, y, 2, 1, shade('wood', 0));
    // The point's two slants.
    const slant = y < mid ? shade('wood', 2) : shade('wood', 0);
    if (pointRight) img.rect(r - 1, y, 2, 1, slant);
    else img.rect(l, y, 2, 1, slant);
  }
}

/**
 * The Toadstool's Way Teller: the forest's own signpost, two arrow boards on a capped post, the
 * upper one pointing on and the lower one back, exactly as s-props.ts paints it in the world. It
 * "takes you the old way", and a signpost is the oldest way-teller there is.
 *
 * The small paper pinned to the post under the boards is the fine print. The bad card "follows
 * any note pinned to a tree" -- the indirect prompt injection lesson -- and a signpost that has a
 * stranger's note tacked to it is that lesson as an object. It is quiet: cream on dark, below the
 * boards, a Deep Purple pin. You see it if you look.
 */
const signpost: Painter = (img) => {
  // Post, lit down its left, then the cap.
  img.rect(28, 6, 8, 54, shade('trunk', 1));
  img.rect(28, 6, 2, 54, shade('trunk', 2));
  img.rect(35, 6, 1, 54, shade('trunk', 0));
  img.rect(26, 2, 12, 5, shade('trunk', 0));
  img.rect(26, 2, 11, 4, shade('trunk', 1));
  img.rect(26, 2, 11, 1, shade('trunk', 3));
  img.rect(26, 3, 2, 3, shade('trunk', 2));
  // Two runs of grain down the post, where the boards do not cover it.
  img.rect(32, 43, 1, 5, shade('trunk', 0));
  img.rect(31, 55, 1, 4, shade('trunk', 0));

  // The upper board points on; the lower one points back the way you came.
  arrowBoard(img, 7, 47, 9, 14, 9, true);
  arrowBoard(img, 17, 56, 27, 13, 9, false);
  // Each board drops a shadow onto the post under it.
  img.rect(28, 23, 8, 1, shade('trunk', 0));
  img.rect(28, 40, 8, 1, shade('trunk', 0));

  // Grain and a knot in each board, sparingly: one level down, never a hard black dash.
  for (const [gx, gy, gw] of [
    [12, 14, 9],
    [37, 18, 8],
    [21, 31, 7],
    [42, 35, 9],
  ] as const)
    img.rect(gx, gy, gw, 1, shade('wood', 0));
  for (const [kx, ky] of [
    [46, 14],
    [14, 33],
  ] as const) {
    img.ellipse(kx, ky, 1.8, 1.3, shade('wood', 0));
    img.px(kx - 1, ky - 1, shade('wood', 2));
  }
  // A nail where each board meets the post.
  for (const [nx, ny] of [
    [31, 15],
    [31, 32],
  ] as const) {
    img.rect(nx, ny, 2, 2, shade('stone', 0));
    img.px(nx, ny, shade('stone', 3));
  }

  // The pinned note: a scrap of paper, two lines of somebody's writing, and a pin.
  img.rect(25, 44, 13, 10, shade('wall', 2));
  img.rect(25, 44, 13, 1, shade('wall', 3));
  img.rect(25, 44, 1, 10, shade('wall', 3));
  img.rect(25, 53, 13, 1, shade('wall', 0));
  img.rect(37, 45, 1, 9, shade('wall', 0));
  img.rect(34, 52, 3, 1, shade('wall', 1)); // its lifted corner
  img.rect(28, 48, 7, 1, shade('wall', 0));
  img.rect(28, 50, 5, 1, shade('wall', 0));
  img.rect(30, 44, 3, 2, shade('night', 2));
  img.px(30, 44, shade('night', 3));

  img.outline(shade('trunk', 0)); // the post's own dark

  /*
   * The foot of the post stands in a tuft of grass, painted on its own and ringed in its own dark
   * before it is laid over: one `outline` call can only ring an image in one colour, and a brown
   * ring round green blades is the wrong hue.
   */
  const tuft = new Img(img.w, img.h);
  for (const [bx, tx, ty, lit] of [
    [24, 20, 54, false],
    [27, 25, 51, true],
    [30, 31, 53, false],
    [34, 36, 51, true],
    [37, 41, 54, false],
    [40, 44, 57, true],
    [22, 18, 58, true],
  ] as const) {
    limb(tuft, bx, 61, tx, ty, 3.2, 1, shade('grass', 1));
    if (lit) limb(tuft, bx - 0.6, 60, tx - 0.4, ty + 1, 1.2, 1, shade('grass', 2));
  }
  tuft.rect(21, 60, 23, 2, shade('grass', 0));
  tuft.outline(keyline('grass'));
  img.blit(tuft, 0, 0);
};

/**
 * The Snail's Slow Post: a parcel in brown kraft, tied with cord in a cross, a bow on top and Deep
 * Purple wax on the front where the cord is sealed. "I carry the heavy things, sealed." The box is
 * the one three-quarter view in the set, because a parcel drawn flat is a rectangle and reads as a
 * second letter: the lit top, the base front and the shaded side are what say "box".
 *
 * The wax takes the letter's two tokens (`night` 2 is #441363, `night` 3 Aubergine) and the
 * letter's pressed-in lighting, so the two sealed things on the card agree.
 */
const parcel: Painter = (img) => {
  const L = 7;
  const R = 43;
  const T = 30;
  const B = 58;
  const D = 12; // depth, receding up and to the right

  // The three faces: shaded side, lit top, base front.
  for (let k = 1; k <= D; k++) img.rect(R + k, T - k, 1, B - T + 1, shade('path', 0));
  for (let k = 1; k <= D; k++) {
    img.rect(L + k, T - k, R - L + 1, 1, shade('path', 2));
    img.px(L + k, T - k, shade('path', 3)); // the lit left edge of the lid
  }
  img.rect(L + D, T - D, R - L + 1, 1, shade('path', 3)); // the far edge of the lid
  img.rect(L, T, R - L + 1, B - T + 1, shade('path', 1));
  img.rect(L, T, R - L + 1, 1, shade('path', 3)); // where the lid turns to the front
  img.rect(L, T + 1, 2, B - T, shade('path', 2));
  img.rect(L, B - 1, R - L + 1, 2, shade('path', 0));
  // A fold of the wrapping on the front, and the paper's tucked seam on the side.
  img.line(L + 3, B - 3, L + 9, B - 9, shade('path', 0));

  // Cord: loop A runs front-to-back across the lid and straight down the front.
  const cx = 24; // left column of the three-pixel cord on the front
  for (let k = 1; k <= D; k++) {
    img.rect(cx + k, T - k, 3, 1, shade('wood', 1));
    img.px(cx + k, T - k, shade('wood', 2));
  }
  img.rect(cx, T, 3, B - T + 1, shade('wood', 1));
  img.rect(cx, T, 1, B - T + 1, shade('wood', 2));
  img.rect(cx + 2, T, 1, B - T + 1, shade('wood', 0));
  // Loop B runs left-to-right across the middle of the lid and straight down the side.
  const km = 6;
  for (let k = km - 1; k <= km + 1; k++) {
    const c = k === km + 1 ? shade('wood', 2) : k === km - 1 ? shade('wood', 0) : shade('wood', 1);
    img.rect(L + k, T - k, R - L + 1, 1, c);
    img.rect(R + k, T - k, 1, B - T + 1, k === km ? shade('wood', 1) : shade('wood', 0));
  }

  // The bow over the crossing: two loops, a knot, two tails.
  const bx = cx + 1 + km;
  const by = T - km;
  /*
   * Each loop is a filled cone leaning out from the knot with a small dark eye near its root. Drawn
   * first as two rings, the bow read as a pair of spectacles: a bow loop is a flattened tube, and
   * from above you see its body, not its hole.
   */
  for (const [lx, lean, eye] of [
    [bx - 6.5, 0.7, -1],
    [bx + 6.5, -0.7, 1],
  ] as const) {
    leanEllipse(img, lx, by - 5, 6.2, 4.2, lean, shade('wood', 0));
    leanEllipse(img, lx - 0.7, by - 5.7, 5.2, 3.2, lean, shade('wood', 2));
    leanEllipse(img, lx + 0.2, by - 4.8, 4.6, 2.8, lean, shade('wood', 1));
    img.ellipse(lx - eye * 1.6, by - 4.6, 1.6, 1.1, shade('wood', 0));
  }
  limb(img, bx - 1, by + 1, bx - 6, by + 8, 2.8, 2, shade('wood', 1));
  limb(img, bx + 1, by + 1, bx + 6, by + 7, 2.8, 2, shade('wood', 0));
  img.ellipse(bx, by - 1, 3.2, 2.8, shade('wood', 0));
  img.ellipse(bx - 0.6, by - 1.6, 2.4, 2, shade('wood', 1));
  img.px(bx - 1, by - 3, shade('wood', 3));

  // The wax, on the front, where the cord is sealed: pressed in, lit like the letter's.
  const sx = cx + 1;
  const sy = 44;
  img.ellipse(sx, sy, 6.6, 6, shade('night', 0));
  img.ellipse(sx - 0.8, sy - 0.8, 6, 5.4, shade('night', 3));
  img.ellipse(sx + 0.6, sy + 0.6, 5.2, 4.6, shade('night', 2));
  img.ellipse(sx - 5, sy + 3, 1.8, 1.4, shade('night', 2));
  img.ellipse(sx + 5, sy + 3.6, 1.6, 1.4, shade('night', 2));
  ring(img, sx, sy, 2.8, 2.6, 1, shade('night', 0));
  img.px(sx + 1.6, sy + 1.6, shade('night', 3));

  /*
   * Kraft's own dark, one step under the ramp. `path` 0 is already the whole shaded side of the
   * box, so an outline in it would melt the right-hand silhouette into the face beside it.
   */
  img.outline(keyline('path'));
};

/**
 * The Magpie's Short Cut: a map, unrolled between its two rolls. "It gives you the quicker tracks."
 * What makes it a map at 64px is the river and the trees, not the paper; what makes it THIS map is
 * the two routes drawn on it, from the same start ring to the same cross. The long way is a faint
 * dotted trail looping north over a bridge. The short cut is bold Deep Purple dashes straight
 * across, river and all, with an arrowhead.
 *
 * That is the card's lesson drawn without a word: somebody inked a straight line over this map.
 * Whose map it is -- its own, or a stranger's fetched fresh tonight -- is the one thing the picture
 * cannot tell you, which is exactly the point the reveal makes.
 */
const shortcut: Painter = (img) => {
  // The sheet between the rolls.
  img.rect(11, 11, 42, 42, shade('wall', 2));
  img.rect(11, 11, 42, 1, shade('wall', 3));
  img.rect(11, 51, 42, 2, shade('wall', 0));
  img.rect(11, 12, 42, 1, shade('wall', 1));
  // A fold down the middle, as a map has: shaded on its right side, lit on its left.
  img.rect(31, 12, 1, 39, shade('wall', 3));
  img.rect(32, 12, 1, 39, shade('wall', 1));

  // The river, winding north to south.
  const river: readonly (readonly [number, number])[] = [
    [41, 12],
    [44, 20],
    [38, 29],
    [41, 38],
    [37, 46],
    [39, 51],
  ];
  for (let i = 1; i < river.length; i++) {
    const [ax, ay] = river[i - 1]!;
    const [bx, by] = river[i]!;
    limb(img, ax, ay, bx, by, 6, 6, shade('water', 0));
  }
  for (let i = 1; i < river.length; i++) {
    const [ax, ay] = river[i - 1]!;
    const [bx, by] = river[i]!;
    limb(img, ax - 0.6, ay, bx - 0.6, by, 4, 4, shade('water', 1));
  }
  for (const [wx, wy] of [
    [42, 17],
    [40, 33],
    [38, 44],
  ] as const)
    img.rect(wx, wy, 2, 1, shade('water', 3));

  // The bridge the long way crosses, a few planks over the water near the top.
  img.rect(37, 15, 10, 5, shade('wood', 0));
  img.rect(37, 15, 10, 1, shade('wood', 2));
  img.rect(37, 16, 10, 2, shade('wood', 1));
  for (let x = 39; x < 47; x += 3) img.rect(x, 16, 1, 2, shade('wood', 0));

  // Trees, in the board's round-crown hand: dark round, lit up-left, a glint, a trunk.
  for (const [tx, ty] of [
    [17, 18],
    [23, 15],
    [22, 31],
    [28, 26],
    [26, 37],
    [48, 30],
  ] as const) {
    img.rect(tx, ty + 2, 1, 3, shade('trunk', 1));
    img.ellipse(tx, ty, 3.4, 3, shade('canopy', 0));
    img.ellipse(tx - 0.6, ty - 0.6, 2.6, 2.2, shade('canopy', 1));
    img.px(tx - 1, ty - 1.6, shade('canopy', 3));
  }

  // The long way: a faint dotted trail, north round the wood and over the bridge.
  const longWay: readonly (readonly [number, number])[] = [
    [17, 43],
    [14, 33],
    [15, 25],
    [22, 21],
    [31, 19],
    [38, 17],
    [46, 18],
    [50, 25],
    [51, 34],
    [48, 40],
  ];
  let dot = 0;
  for (let i = 1; i < longWay.length; i++) {
    const [ax, ay] = longWay[i - 1]!;
    const [bx, by] = longWay[i]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s < n; s++, dot++)
      if (dot % 3 === 0)
        img.px(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, shade('wall', 0));
  }

  // The start ring, and the short cut: bold dashes, straight across, with an arrowhead.
  ring(img, 17, 45, 3, 3, 1.4, shade('night', 2));
  for (let x = 22; x <= 34; x += 5) {
    img.rect(x, 44, 3, 2, shade('night', 2));
    img.px(x, 44, shade('night', 3));
  }
  for (let i = 0; i < 4; i++) img.rect(37 + i, 41 + i, 1, 8 - i * 2, shade('night', 2));

  // The cross: where she is going.
  for (let i = 0; i < 6; i++) {
    img.rect(43 + i, 42 + i, 2, 1, shade('night', 2));
    img.rect(48 - i, 42 + i, 2, 1, shade('night', 2));
  }

  // The two rolls, round: lit down the left, shaded down the right, a wooden knob at each end.
  for (const rx of [5, 52]) {
    img.rect(rx, 9, 7, 46, shade('wall', 1));
    img.rect(rx, 9, 2, 46, shade('wall', 3));
    img.rect(rx + 5, 9, 2, 46, shade('wall', 0));
    img.rect(rx + 2, 9, 1, 46, shade('wall', 2));
    img.ellipse(rx + 3.5, 7, 3, 2.4, shade('wood', 0));
    img.ellipse(rx + 3, 6.4, 2.2, 1.6, shade('wood', 2));
    img.ellipse(rx + 3.5, 57, 3, 2.4, shade('wood', 0));
    img.ellipse(rx + 3, 56.4, 2.2, 1.6, shade('wood', 1));
  }

  img.outline(shade('wall', 0)); // the paper's own dark, as the letter's
};

/**
 * The Cat's Latch Lifter: Grandma's door, and on it the latch. An arched door of four planks with
 * strap hinges down the hinge side and a thumb latch on the other -- the bar resting in its keeper
 * and a ring pull under it -- because a latch on its own is a bent strip of iron at 64px, and the
 * door is what says whose and what for. "I open Grandma's door."
 *
 * The planks are `trunk`, the darkest wood the palette has, and the iron is `stone`, so the latch
 * is the brightest thing on the door and the first thing read. No keyhole: the key is somebody
 * else's skill, and a latch that lifts for anyone has no lock to draw.
 */
const latch: Painter = (img) => {
  const L = 11;
  const R = 52;
  const T = 3;
  const B = 61;
  const cx = (L + R) / 2;
  const archR = (R - L + 1) / 2;
  const archY = T + archR;
  const span = (y: number): readonly [number, number] | null => {
    if (y >= archY) return [L, R];
    const dy = archY - y - 0.5;
    if (dy >= archR) return null;
    const h = Math.sqrt(archR * archR - dy * dy);
    return [Math.round(cx - h + 0.5), Math.round(cx + h - 0.5)];
  };
  const within = (x: number, y: number): boolean => {
    const s = span(y);
    return s !== null && x >= s[0] && x <= s[1];
  };

  // The planks, then their seams, each seam lit on its far side.
  rows(img, T, B, span, shade('trunk', 1));
  for (let y = T; y <= B; y++) {
    const s = span(y);
    if (!s) continue;
    img.rect(s[0], y, 2, 1, shade('trunk', 2));
    img.rect(s[1] - 1, y, 2, 1, shade('trunk', 0));
    for (const seam of [21, 31, 41]) {
      if (within(seam, y)) img.px(seam, y, shade('trunk', 0));
      if (within(seam + 1, y)) img.px(seam + 1, y, shade('trunk', 2));
    }
  }
  // The arch's top course catches the light; the threshold falls into shade.
  for (let y = T; y <= T + 2; y++) {
    const s = span(y);
    if (s) img.rect(s[0], y, s[1] - s[0] + 1, 1, shade('trunk', 3));
  }
  for (let y = T + 3; y <= T + 4; y++) {
    const s = span(y);
    if (s) img.rect(s[0] + 2, y, s[1] - s[0] - 3, 1, shade('trunk', 2));
  }
  img.rect(L, B - 1, R - L + 1, 2, shade('trunk', 0));
  // Grain, a few runs down the planks.
  for (const [gx, gy, gh] of [
    [16, 22, 7],
    [26, 13, 6],
    [36, 50, 6],
    [46, 22, 5],
    [17, 52, 5],
  ] as const)
    img.rect(gx, gy, 1, gh, shade('trunk', 0));

  // Two strap hinges down the hinge side, tapering to a point, nailed.
  for (const hy of [20, 52]) {
    for (let i = 0; i < 16; i++) {
      const x = L + i;
      const hh = i < 11 ? 4 : 4 - (i - 10) * 0.6;
      const top = hy - hh / 2;
      for (let y = Math.round(top); y < Math.round(top + hh); y++) {
        if (!within(x, y)) continue;
        const c =
          y === Math.round(top)
            ? shade('stone', 3)
            : y === Math.round(top + hh) - 1
              ? shade('stone', 0)
              : shade('stone', 1);
        img.px(x, y, c);
      }
    }
    for (const nx of [L + 4, L + 10]) img.px(nx, hy, shade('stone', 0));
  }

  // The latch: a backplate, the bar, the keeper that cradles it, and a ring pull below.
  img.rect(29, 28, 6, 12, shade('stone', 0));
  img.rect(29, 28, 5, 11, shade('stone', 1));
  img.rect(29, 28, 5, 1, shade('stone', 3));
  img.rect(29, 29, 1, 10, shade('stone', 2));
  img.px(31, 30, shade('stone', 0));
  img.px(31, 36, shade('stone', 0));
  img.rect(31, 32, 17, 4, shade('stone', 0));
  img.rect(31, 32, 16, 3, shade('stone', 1));
  img.rect(31, 32, 16, 1, shade('stone', 3));
  img.rect(44, 36, 6, 3, shade('stone', 0));
  img.rect(44, 36, 5, 2, shade('stone', 1));
  img.rect(48, 30, 3, 9, shade('stone', 0));
  img.rect(48, 30, 2, 8, shade('stone', 1));
  img.rect(48, 30, 2, 1, shade('stone', 3));
  img.rect(31, 40, 3, 3, shade('stone', 0));
  ring(img, 32.5, 47, 5, 5, 2, shade('stone', 0));
  ring(img, 31.9, 46.4, 4.4, 4.4, 1.2, shade('stone', 2));
  img.px(29.5, 43.5, shade('stone', 3));

  img.outline(shade('trunk', 0)); // the door's own dark
};

/**
 * The Owl's Word Weaver: a quill drawing out a thread of words. "It sends word ahead, so Grandma
 * expects you", and "my sister wove these words" -- so the object is the pen and the yarn at once:
 * a long white feather laid corner to corner, its nib dipped Deep Purple, and from the nib a
 * twisted two-tone cord written out in cursive loops along the bottom, leaving off the right edge
 * on its way ahead of you.
 *
 * It replaces `item-translator`, the speaking horn, which was drawn for the retired v1 skill
 * ("copies every message to a helper") and matched none of this card's words.
 *
 * The feather is `fur`, the one pale ramp no item had used, so it does not read as the letter's
 * paper (`wall`) or the parcel's kraft (`path`); and it is barred, faintly, as an owl's own
 * feathers are. The cord takes the seals' two tokens (`night` 2 is #441363, `night` 3 above it), so
 * the three things on the card that carry a message agree -- and it is the only icon with no box,
 * sheet or envelope in it, which is what keeps it clear of the letter and the map.
 *
 * The fine print is in the cord, the translator's trick. Each cursive loop crosses itself once,
 * and at every crossing hangs a scrap of paper the size of a fingernail: the bad card "leaves a
 * copy at every crossing". The icon is the same for the good and the bad card, so the scraps give
 * nothing away; they only reward looking, in the reveal.
 */
const weaver: Painter = (img) => {
  // ---- the quill: tip at the top-right, nib at the lower-left
  const tipX = 55;
  const tipY = 7;
  const nibX = 11;
  const nibY = 43;
  const len = Math.hypot(nibX - tipX, nibY - tipY);
  const ux = (nibX - tipX) / len; // along the shaft, tip to nib
  const uy = (nibY - tipY) / len;
  const px = uy; // across it: positive is the lower-right, shaded vane
  const py = -ux;
  const vane = len * 0.74; // where the barbs stop and the bare quill begins

  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const rx = x + 0.5 - tipX;
      const ry = y + 0.5 - tipY;
      const s = rx * ux + ry * uy;
      const d = rx * px + ry * py;
      if (s < 0 || s > len) continue;
      if (s <= vane) {
        // The vane: rounded at the tip, widest a third of the way down, tapering into the quill.
        // The lit vane is the narrow one, as on a flight feather.
        const f = s / vane;
        const swell = Math.sin(Math.PI * Math.pow(f, 0.62));
        const w = (d < 0 ? 9 : 13.5) * swell;
        const a = Math.abs(d);
        if (a > w) continue;
        const barb = s - 0.85 * a; // barbs sweep back toward the tip as they leave the shaft
        let c: RGBA;
        if (d < 0) c = a > w - 1.2 ? shade('fur', 3) : shade('fur', 2);
        else c = a > w - 1.6 ? shade('fur', 0) : shade('fur', 1);
        // The owl's bars, in the owl's own brown: she is barred like this in her portrait.
        const bar = (((barb - 4) % 9) + 9) % 9;
        if (bar < 2.4 && s > 6 && a > 1.2)
          c = d < 0 ? shade('trunk', 3) : a > w - 1.6 ? shade('trunk', 1) : shade('trunk', 2);
        if (a <= 0.8) c = shade('fur', 3); // the rachis, a white line down the middle
        img.px(x, y, c);
        continue;
      }
      // The bare quill: a round tube, narrowing to the nib.
      const g = (s - vane) / (len - vane);
      const r = 1.9 * (1 - g) + 0.6 * g;
      if (Math.abs(d) > r) continue;
      if (g > 0.72)
        img.px(x, y, d < 0 ? shade('night', 3) : shade('night', 2)); // dipped
      else img.px(x, y, d < -0.4 ? shade('fur', 3) : d > 0.6 ? shade('fur', 0) : shade('fur', 2));
    }
  img.outline(keyline('fur')); // the feather's own dark

  // ---- the cord: cursive loops, a prolate trochoid, out of the nib and off to the right
  const cord = new Img(img.w, img.h);
  const k = 2.05; // advance per radian
  const loop = 5.6; // loop radius; k < loop is what makes them loop
  const x0 = nibX + 1;
  const yc = nibY + 1 + loop;
  const at = (t: number): readonly [number, number] => [
    x0 + k * t - loop * Math.sin(t),
    yc - loop * Math.cos(t),
  ];
  let arc = 0;
  let [lx, ly] = at(0);
  const tEnd = Math.PI * 6 + 2.6; // just past the third loop's crossing
  for (let t = 0; t <= tEnd; t += 0.02) {
    const [x, y] = at(t);
    arc += Math.hypot(x - lx, y - ly);
    [lx, ly] = [x, y];
    // Two strands twisted together: the colour turns over every few pixels of length.
    cord.ellipse(x, y, 1.3, 1.3, Math.floor(arc / 2.6) % 2 ? shade('night', 3) : shade('night', 2));
  }
  // The tail, leaving the frame on its way ahead.
  for (let x = lx; x <= 63; x += 0.25) {
    const y = ly - (x - lx) * 0.42;
    arc += 0.25;
    cord.ellipse(x, y, 1.3, 1.3, Math.floor(arc / 2.6) % 2 ? shade('night', 3) : shade('night', 2));
  }

  /*
   * Where each loop crosses itself: t = 2n*pi +- tau, with loop * sin(tau) = k * tau. Three Newton
   * steps from 2.4 settle it well inside a pixel. A scrap of paper hangs from each crossing.
   */
  let tau = 2.4;
  for (let i = 0; i < 3; i++) tau -= (loop * Math.sin(tau) - k * tau) / (loop * Math.cos(tau) - k);
  for (let n = 1; 2 * n * Math.PI + tau <= tEnd; n++) {
    const [cx, cy] = at(2 * n * Math.PI + tau);
    const sx = Math.round(cx) - 2;
    const sy = Math.round(cy) + 2;
    cord.rect(sx, sy, 5, 4, shade('wall', 2));
    cord.rect(sx, sy, 5, 1, shade('wall', 3));
    cord.rect(sx + 4, sy + 1, 1, 3, shade('wall', 0));
    cord.rect(sx + 1, sy + 2, 3, 1, shade('wall', 0)); // a line of the copied words
  }
  cord.outline(keyline('night'));
  img.blit(cord, 0, 0);
};

/*
 * THE TWO FOR THE V2 ADDITIONS, painted 2026-10-22: the Magpie's Wing Ride and the Cat's Long
 * Evening. Same hand as the seven above -- masses that fill the frame, light from the top-left, an
 * outline in the object's own dark -- and each on a ramp the card was not already leaning on: the
 * set had no near-black and no glass, and these two are the only icons with either.
 */

/** The magpie's own black, `bystanders.ts`'s PLUMAGE recipe: a cool near-black off `stone`. */
const MAGPIE_BLACK = (t: number): RGBA =>
  mix(keyline('stone', 64), keyline('stone', 30), clamp01(t));
/** Her wing gloss, the sprite's GLOSS: `water` 0 taken most of the way down to the plumage. */
const MAGPIE_GLOSS: RGBA = mix(keyline('stone', 64), shade('water', 0), 0.45);
/** And her keyline, the sprite's MAGPIE_DARK, so the icon and the bird are ringed alike. */
const MAGPIE_RING: RGBA = keyline('stone', 74);

/**
 * The Magpie's Wing Ride: the magpie herself from behind, wings flung wide, mid-swoop. "Hold on,
 * I'll carry you."
 *
 * FROM BEHIND, ON PURPOSE. A bird seen from the front has a face, and a face staring out of the
 * card at the player is a different icon; from behind she is all wing, and the two marks that
 * make a magpie a magpie rather than a crow are exactly the ones a back view shows best -- the
 * white scapular on each shoulder and the long tail with the blue gloss in it. The primaries are
 * white with black tips, which is the third.
 *
 * The right wing is the left one's geometry mirrored about the centre line and NOT its lighting:
 * every lit inset is offset up-left in screen space, so both wings are lit from the same sky.
 */
const wings: Painter = (img) => {
  const C = 31.5;
  /** A feather: its dark self, then a narrower lit inset up-left in the colour `face` gives. */
  const feather = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w0: number,
    w1: number,
    dark: RGBA,
    face: RGBA,
  ): void => {
    limb(img, x0, y0, x1, y1, w0, w1, dark);
    limb(img, x0 - 0.5, y0 - 0.6, x1 - 0.5, y1 - 0.6, w0 - 2.2, Math.max(1, w1 - 2), face);
  };
  for (const side of [-1, 1] as const) {
    // Geometry is written for the LEFT wing and mirrored; the light is never mirrored.
    const X = (x: number): number => (side < 0 ? x : 2 * C - x);
    // Secondaries first, the trailing edge nearest the body, black with the gloss along them.
    for (const [rx, ry, tx, ty] of [
      [25, 29, 19, 41],
      [22, 27, 13, 38],
      [19, 25, 8, 34],
    ] as const) {
      feather(X(rx), ry, X(tx), ty, 6.4, 4.6, MAGPIE_BLACK(0.04), MAGPIE_BLACK(0.4));
      limb(img, X(rx) - 0.4, ry + 1.6, X(tx) - 0.4, ty - 1.2, 1.6, 1.2, MAGPIE_GLOSS);
    }
    // Primaries over them: white, each with its black tip, the leading one longest and last.
    for (const [rx, ry, tx, ty] of [
      [17, 23, 4, 28],
      [15, 21, 2, 20],
      [14, 19, 2, 12],
      [14, 17, 4, 4],
    ] as const) {
      feather(X(rx), ry, X(tx), ty, 6.0, 4.4, shade('fur', 0), shade('fur', 2));
      const k = 0.8; // where the white ends and the tip begins: a magpie's primary is mostly white
      const mx = X(rx + (tx - rx) * k);
      const my = ry + (ty - ry) * k;
      feather(mx, my, X(tx), ty, 4.8, 4.4, MAGPIE_BLACK(0.04), MAGPIE_BLACK(0.34));
    }
    // The arm and its coverts, from shoulder to wrist: the black the feathers spring out of.
    limb(img, X(27), 29, X(14.5), 18, 9.6, 6.4, MAGPIE_BLACK(0.06));
    limb(img, X(26.4), 28.2, X(14), 17.4, 7.2, 4.2, MAGPIE_BLACK(0.42));
    limb(img, X(25.6), 26.4, X(15.2), 15.8, 2.2, 1.6, MAGPIE_BLACK(0.74)); // its lit leading edge
    // The white scapular on the shoulder: THE magpie mark.
    img.ellipse(X(24.6), 27.4, 3.6, 2.4, shade('fur', 1));
    img.ellipse(X(24.6) - 0.8, 26.8, 2.2, 1.3, shade('fur', 3));
  }

  // The tail: long, narrow at the root and widening a little, glossed, graduated at the end.
  limb(img, C, 37, C, 59, 5.2, 7.4, MAGPIE_BLACK(0.04));
  limb(img, C - 0.5, 37, C - 0.5, 58, 3.4, 5.2, MAGPIE_GLOSS);
  limb(img, C - 1.6, 40, C - 1.6, 55, 1.2, 1.4, MAGPIE_BLACK(0.74));
  img.rect(29, 60, 6, 1, MAGPIE_BLACK(0.04));
  img.rect(30, 61, 4, 1, MAGPIE_BLACK(0.2));

  // The back, and the round of the head above it: no face, because she is flying away from you.
  img.ellipse(C, 32, 5.4, 7.2, MAGPIE_BLACK(0.06));
  img.ellipse(C - 0.6, 31.2, 4.4, 6.2, MAGPIE_BLACK(0.4));
  img.ellipse(C - 2, 28, 1.6, 2.6, MAGPIE_BLACK(0.7));
  img.ellipse(C, 21.6, 4.6, 4.3, MAGPIE_BLACK(0.06));
  img.ellipse(C - 0.6, 21, 3.7, 3.4, MAGPIE_BLACK(0.46));
  img.ellipse(C - 1.6, 19.6, 1.8, 1.3, MAGPIE_BLACK(0.8));

  img.outline(MAGPIE_RING); // her own dark, as the sprite's
};

/**
 * The Cat's Long Evening: an hourglass, and the evening is in it. "Stay a while; there's no
 * hurry."
 *
 * Two turned plates and two posts in `wood`, and between them the glass -- the only glass in the
 * set, drawn in the palette's palest cool (`water` 3) with a glint up its left side. The top bulb
 * holds a dusk sky: Deep Purple at the top going down through Aubergine to a band of rose and a
 * line of ember at its horizon, one star in it, and the last of the sand banked under the sunset.
 * The thread of sand falls through the neck to a pile in the bottom bulb.
 *
 * `night` 2 and 3 are the seals' own two tokens (#441363, Aubergine), so the four items that carry
 * a brand colour agree. The rose and ember are the board's flower families from `paint.ts`, world
 * art rather than status colours, and they are here because a dusk sky without a warm band at its
 * horizon is a night sky, which is a different card.
 */
const hourglass: Painter = (img) => {
  const cx = 32;
  const NECK = 32;
  const TOP = 12;
  const BOT = 52;
  /** The glass's half-width at a row: pinched at the neck, widest high in each bulb. */
  const half = (y: number): number => {
    const u = Math.min(1, Math.abs(y + 0.5 - NECK) / (NECK - TOP));
    return 1.4 + 12.6 * Math.sin(Math.PI * 0.62 * u);
  };
  const inGlass = (x: number, y: number): boolean =>
    y >= TOP && y < BOT && Math.abs(x + 0.5 - cx) <= half(y);

  // The two posts, behind the glass, lit down the left.
  for (const px of [10, 50]) {
    img.rect(px, 9, 4, 46, shade('trunk', 1));
    img.rect(px, 9, 1, 46, shade('trunk', 2));
    img.rect(px + 3, 9, 1, 46, shade('trunk', 0));
    for (const by of [20, 31, 42]) img.rect(px - 1, by, 6, 2, shade('trunk', 0)); // the turnings
    for (const by of [20, 31, 42]) img.rect(px - 1, by, 2, 1, shade('trunk', 2));
  }

  // The glass: its rim a step of `stone`, its body the palest cool in the palette.
  for (let y = TOP; y < BOT; y++)
    for (let x = 0; x < 64; x++) {
      if (!inGlass(x, y)) continue;
      const edge = !inGlass(x - 1, y) || !inGlass(x + 1, y);
      img.px(x, y, edge ? shade('stone', 2) : shade('water', 3));
    }

  // The top bulb's dusk, in bands, inside the rim. Sand banks under it, down to the neck.
  const SAND_TOP = 25;
  for (let y = TOP + 1; y < NECK; y++)
    for (let x = 0; x < 64; x++) {
      if (!inGlass(x, y) || !inGlass(x - 1, y) || !inGlass(x + 1, y)) continue;
      let c: RGBA;
      if (y >= SAND_TOP + Math.abs(x + 0.5 - cx) * 0.35)
        c = x < cx - 2 ? shade('path', 2) : shade('path', 1);
      else if (y < 16) c = shade('night', 2);
      else if (y < 20) c = shade('night', 3);
      else if (y < 23) c = rose(0.3);
      else c = ember(0.62);
      img.px(x, y, c);
    }
  img.px(26, 15, shade('wall', 3)); // one star, high in the purple
  img.px(37, 17, shade('cloak', 3)); // and a fainter one

  // The thread of sand through the neck, and the pile it is building.
  img.rect(31, NECK - 1, 2, 1, shade('path', 1));
  img.rect(cx - 0.5, NECK, 1, 13, shade('path', 2));
  for (let y = 44; y < BOT; y++) {
    const w = Math.min(half(y) - 1, (y - 43) * 2.2);
    img.rect(Math.round(cx - w), y, Math.round(w * 2), 1, shade('path', 1));
    img.rect(Math.round(cx - w), y, Math.max(1, Math.round(w * 0.6)), 1, shade('path', 2));
  }
  img.px(31, 44, shade('path', 3)); // the lit top of the cone

  // The glint up the left side of each bulb, which is all a reflection ever is in pixels.
  for (const [x0, y0, x1, y1] of [
    [22, 15, 20, 22],
    [22, 37, 21, 45],
  ] as const) {
    const glint = new Img(img.w, img.h);
    glint.line(x0, y0, x1, y1, shade('wall', 3));
    // Only where there is glass: a reflection cannot sit on the air beside the bulb.
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        if (glint.get(x, y)[3] && inGlass(x - 1, y) && inGlass(x + 1, y))
          img.px(x, y, shade('wall', 3));
  }

  // The plates: turned slabs, lit along the top, shaded underneath, a finial on each.
  for (const py of [4, 52]) {
    img.rect(8, py, 48, 8, shade('wood', 0));
    img.rect(8, py, 47, 7, shade('wood', 1));
    img.rect(8, py, 47, 1, shade('wood', 3));
    img.rect(8, py + 1, 2, 6, shade('wood', 2));
    img.rect(8, py + 4, 48, 1, shade('wood', 0)); // the groove the lathe left
  }
  // A knob on top to lift it by, and two feet under it to stand it on.
  img.ellipse(32, 2.6, 4, 2, shade('wood', 0));
  img.ellipse(31.4, 2.2, 3, 1.3, shade('wood', 2));
  for (const fx of [12, 48]) {
    img.rect(fx, 60, 5, 2, shade('wood', 0));
    img.rect(fx, 60, 4, 1, shade('wood', 1));
  }

  img.outline(keyline('wood')); // the frame's own dark
};

// ----------------------------------------------------------------------------- effects

/*
 * The three effects are smaller than the rest of this file and are drawn into the TOP-LEFT of
 * whatever canvas they are handed, at their own true size: dust 16 x 16, the prompt and the prints
 * 32 x 32. The preview renders them in a 64 x 64 cell so they can sit on one contact sheet with the
 * portraits; the wiring pass gives each one its real frame.
 *
 * Each has a frame function beside it, because all three are animations in the game and the record
 * below can only hold one painter per name. The record entries draw frame 0.
 */

/**
 * Footstep dust, 16 x 16 x 3 frames, kicked up at the heel.
 *
 * Dust in the air is LIGHTER than the ground it came off -- it is sand catching the sky -- so the
 * body of it is `path` 2 and 3 with level 0 only on the undersides. The first pass had it the other
 * way round, in `path` 0 and `wood` 0, and three dark lumps on a sand path read as something the
 * dog left rather than something the boot kicked.
 */
export function paintDustFrame(img: Img, frame: 0 | 1 | 2): void {
  // It thins by spending FEWER pixels at a DARKER level, never by lowering alpha over transparency.
  const body: 1 | 2 = frame === 2 ? 1 : 2;
  const rise = frame * 2;

  // Two puffs, the near one larger, each with a lit cap and a shaded underside.
  if (frame < 2) {
    img.ellipse(4.6, 11 - rise, 3.6, 2.6, shade('path', 0));
    img.ellipse(4.2, 10.2 - rise, 2.8, 1.9, shade('path', body));
    img.rect(3, 8.6 - rise, 2, 1, shade('path', 3));
  }
  img.ellipse(10, 9.6 - rise, 3 - frame * 0.7, 2.3 - frame * 0.5, shade('path', 0));
  img.ellipse(9.7, 8.9 - rise, 2.2 - frame * 0.6, 1.6 - frame * 0.4, shade('path', body));
  img.px(9, 7.6 - rise, shade('path', 3));

  // Grit thrown clear of the puffs: three pixels, then two, then one.
  const grit = [
    [13, 7],
    [1, 7],
    [7, 4],
  ] as const;
  for (let i = 0; i < 3 - frame; i++) img.px(grit[i]![0], grit[i]![1] - rise, shade('path', 0));
}

/**
 * The bobbing "..." over an NPC you can talk to. 32 x 32 x 2 frames.
 *
 * It used to draw a capital A, which was a wrong key twice over. The interact keys are Space,
 * Enter and KeyE (`INTERACT_KEYS` in apps/game/src/world/input.ts), and KeyA in the same file is
 * bound to MOVE LEFT -- so the one thing a player who obeyed the prompt could not do was talk, and
 * what they did instead was walk west. The Title screen teaches "Space to talk", so naming a key
 * here would have to name that one, and a keyboard glyph is wrong on a touch device anyway.
 *
 * An ellipsis names nothing. It is the oldest "this one has something to say" mark there is, it
 * holds at 32px where a letter inside a bubble starts to smear, and it stays true whichever of the
 * three keys the player reaches for.
 */
export function paintInteractPromptFrame(img: Img, frame: 0 | 1): void {
  const y = frame;
  // Bubble: dark edge, lit crescent up-left, base inset back over it.
  img.ellipse(16, 13 + y, 12, 9, shade('wall', 0));
  img.ellipse(15, 12 + y, 11.2, 8.4, shade('wall', 3));
  img.ellipse(17, 14 + y, 10, 7.4, shade('wall', 2));
  // Tail, down-left, with its own shaded side.
  for (let i = 0; i < 6; i++) {
    img.rect(13 - Math.round(i * 0.4), 20 + i + y, Math.max(1, 6 - i), 1, shade('wall', 2));
    img.px(13 - Math.round(i * 0.4) + Math.max(0, 5 - i), 20 + i + y, shade('wall', 0));
  }
  // The three dots, in Deep Purple on cream, each with its own seat so it sits in the bubble
  // rather than on it.
  for (const dx of [-6, 0, 6]) {
    img.ellipse(17 + dx, 14 + y, 2.2, 2.2, shade('wall', 0));
    img.ellipse(17 + dx, 13.6 + y, 1.9, 1.9, shade('night', 2));
  }
  /*
   * The bubble is the one mark in this file that is read AGAINST THE WORLD, and that is why its
   * outline is the exception to the paragraph at the top of the file.
   *
   * Everything else here -- the portraits, the nine items -- sits on a `--cyera-black` DOM panel,
   * where `ink` 0 is invisible and a ring in the object's own dark is the only one that shows.
   * That reasoning is right for those fifteen frames and it was applied to this one by the same
   * sweep without being re-measured. This frame is drawn in the forest, over the lawn, and
   * `wall` 0 is luma 175 against lawn at 161..168: SEVEN luma. The one mark in the game that means
   * "this one will talk to you" was a cream shape on cream ground with no silhouette at all, and a
   * speech bubble with no edge is a smudge.
   *
   * `ink` 0 is a near-black carrying a trace of violet. docs/PIXEL_STANDARD.md section 4 reserves
   * CYERA BLACK for the wolf so that he alone reads as a silhouette, and that is still true -- the
   * wolf's ramp is his own; `ink` is the palette's shared dark and the rabbit's eye already takes
   * it. Against the lawn this ring is about 150 luma down, so the bubble has an edge wherever in
   * the forest it is raised: on grass, on the sand path, on the plank bridge and on the doorstep.
   */
  img.outline(shade('ink', 0));
}

/**
 * The "!" over a character the player has not met yet. 32 x 32 x 2 frames, the bob drawn into the
 * frames exactly as the talk bubble's is (the client's round, 2026-10-25: "players found it hard to
 * find the characters on the map").
 *
 * THE TALK BUBBLE'S OWN HAND, ON PURPOSE. Same cream bubble lit up-left and seated down-right, same
 * tail, the same Deep Purple mark on its own `wall` 0 seat, the same `ink` 0 ring that gives it an
 * edge on grass, sand and planks (`paintInteractPromptFrame` says why that ring is the exception).
 * The two say two halves of one sentence -- "somebody here you have not met", then "you can talk
 * now" -- so they must look like one family, and the scene never shows both over one head.
 *
 * SMALLER AND TALLER than the talk bubble: 17 across against 25, so the "!" reads as the lighter
 * of the two and the eye can tell from a distance which one is up. One mark, a stroke and a dot, and
 * never a colour that could say good or bad -- every unmet character wears the same one.
 */
export function paintUnmetMarkFrame(img: Img, frame: 0 | 1): void {
  const y = frame;
  // Bubble: dark edge, lit crescent up-left, base inset back over it.
  img.ellipse(16, 13 + y, 8, 9.4, shade('wall', 0));
  img.ellipse(15.4, 12.2 + y, 7.4, 8.8, shade('wall', 3));
  img.ellipse(16.6, 13.8 + y, 6.4, 7.8, shade('wall', 2));
  // Tail, down-left, with its own shaded side, shorter than the talk bubble's.
  for (let i = 0; i < 4; i++) {
    img.rect(14 - Math.round(i * 0.4), 21 + i + y, Math.max(1, 4 - i), 1, shade('wall', 2));
    img.px(14 - Math.round(i * 0.4) + Math.max(0, 3 - i), 21 + i + y, shade('wall', 0));
  }
  // The "!": a stroke narrowing to its foot, and the dot, each on a seat a pixel down-right.
  img.rect(16, 7 + y, 3, 7, shade('wall', 0));
  img.rect(17, 18 + y, 2, 2, shade('wall', 0));
  img.rect(15, 6 + y, 3, 4, shade('night', 2));
  img.rect(15, 10 + y, 2, 3, shade('night', 2));
  img.rect(16, 13 + y, 1, 1, shade('night', 2));
  img.rect(16, 17 + y, 2, 2, shade('night', 2));
  img.outline(shade('ink', 0));
}

/**
 * The paw prints outside the cottage door. 32 x 32 x 3.
 *
 * The smallest sprite in the game and the one that carries the ending: by the time you can read
 * these, the thing that made them is already inside. So they are drawn as prints PRESSED INTO the
 * ground rather than as dark shapes laid on top of it -- the near rim of each pad is its deepest
 * shade, the far wall turns up towards the light, and nothing extends past the print's own
 * footprint, so they read on sand and on grass alike. No pixel is translucent; the 16px version
 * painted `ink` at alpha 170, which left partial alpha all over the file.
 */
export function paintPawprintsFrame(img: Img, frame: 0 | 1 | 2): void {
  const mirror = frame === 1;
  const faint = frame === 2;
  const sx = (x: number): number => (mirror ? 31 - x : x);
  const deep = shade('wood', 0);
  const far = shade('wood', 1);

  /*
   * The pad: narrow at the top, widest two thirds down, with a notch cut up into the bottom edge.
   * Built row by row so the notch stays TRANSPARENT -- painting it back in with a ground colour
   * would put sand-coloured pixels in a sprite that has to sit on grass as well.
   *
   * Each shape is drawn in its deepest shade and then again, smaller and offset DOWN-RIGHT, one
   * level up. That is a depression, not a lump: the near rim at the top-left shades, the far inner
   * wall at the bottom-right turns up towards the light. Getting that backwards is the difference
   * between a print pressed into the path and a sticker lying on it.
   */
  const rows = [3.4, 5, 6.2, 7, 7.5, 7.9, 8.1, 8.2, 8.1, 7.8, 7.2];
  const pad = (dx: number, dy: number, shrink: number, c: RGBA): void =>
    rows.forEach((half, i) => {
      const h = half - shrink;
      if (h < 1) return;
      const y = 15 + i + dy;
      for (let x = Math.round(16 - h + dx); x <= Math.round(16 + h + dx); x++) {
        if (i >= 9 && Math.abs(x - dx - 16) < 1.6) continue;
        img.px(sx(x), y, c);
      }
    });
  pad(0, 0, 0, deep);
  if (!faint) pad(mirror ? -1.5 : 1.5, 1, 3.2, far);

  // Four toes, fanned, the outer pair set lower than the inner pair.
  const toes = [
    [7, 9, 3.2, 3.9, -0.2],
    [13, 5, 3.3, 4.1, -0.07],
    [20, 5, 3.3, 4.1, 0.07],
    [26, 9, 3.2, 3.9, 0.2],
  ] as const;
  for (const [tx, ty, rx, ry, lean] of toes) {
    leanEllipse(img, sx(tx), ty, rx, ry, mirror ? -lean : lean, deep);
    if (!faint)
      leanEllipse(
        img,
        sx(tx) + (mirror ? -1 : 1),
        ty + 1,
        rx - 1.5,
        ry - 1.7,
        mirror ? -lean : lean,
        far,
      );
  }
}

/** Fills a polygon: every pixel whose centre is inside it. For folded paper, which is all facets. */
function poly(img: Img, pts: readonly (readonly [number, number])[], c: RGBA): void {
  const ys = pts.map(([, y]) => y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = 0; x < img.w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) img.px(x, y, c);
    }
}

/**
 * The paper bird, 16 x 16 x 4: a folded note flying, wings up, level, down, level. It is what a
 * message looks like when it is on its way somewhere, which is the whole of the word-sending skills.
 *
 * FOLDED, SO IT IS FACETS. Every plane is one flat value of `wall` -- the letter's own paper -- with
 * the lit faces at level 3 and the turned ones at 0 and 1, and a crease is simply where two values
 * meet. No gradient anywhere, because paper does not have one. The far wing is a step darker than
 * the near one and drawn first, behind the body.
 *
 * It is read AGAINST THE WORLD, like the speech bubble, and for the same reason it cannot outline
 * in `wall` 0: that is luma 175 over a lawn at 160. Its ring is the paper's own hue taken right down,
 * `keyline('wall', 130)`, a warm near-black about 45 luma, so it has an edge over grass, sand and
 * water alike without borrowing the wolf's ink.
 *
 * The body rides a pixel on the downstroke, which is the one-pixel bob section 6 asks of a walk.
 */
export function paintPaperBirdFrame(img: Img, frame: 0 | 1 | 2 | 3): void {
  const dy = frame === 2 ? -1 : 0;
  const at = (x: number, y: number): readonly [number, number] => [x, y + dy];
  // Each wing's tip per frame -- up, level, down, coming back up -- near wing first. The far wing
  // trails the near one by a few pixels back and a row, which is the wing on the other side.
  const tips: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
    [
      [6, 0],
      [9, 1],
    ],
    [
      [1, 4],
      [5, 4],
    ],
    [
      [5, 15],
      [8, 14],
    ],
    [
      [2, 2],
      [6, 2],
    ],
  ];
  const [near, far] = tips[frame]!;
  // The far wing, behind the body, in the paper's shade.
  poly(img, [at(7, 7), at(11, 6), [far[0], far[1]]], shade('wall', 0));
  // The body: a folded keel with a pointed tail and a point of beak. Lit above the fold, shaded
  // below it, and the fold itself is simply where the two meet.
  poly(img, [at(1, 7), at(12, 6), at(15, 5), at(13, 7), at(8, 8)], shade('wall', 3));
  poly(img, [at(1, 7), at(8, 8), at(13, 7), at(8, 10)], shade('wall', 1));
  // The near wing, in front, its crease along the root.
  poly(img, [at(5, 7), at(10, 7), [near[0], near[1]]], shade('wall', 2));
  img.line(5, 7 + dy, 9, 7 + dy, shade('wall', 0));
  img.outline(keyline('wall', 130));
}

/**
 * The fork sign, 32 x 32 x 2: a small blank board on a post, frame 0 pointing LEFT and frame 1
 * RIGHT, for the Way Teller to stand at a fork in the path. "Which way? Ask the sign."
 *
 * BLANK, AND THAT IS THE BRIEF: the game lays a face icon over the board, so the board's face is
 * one flat field of `wood` 1 -- rows 6 to 13 and columns 11 to 22 on both frames, the same
 * rectangle on both, so an overlay placed once is placed for either facing. No grain, no knot and
 * no nail in it; the grain is on the post. It is the forest's own signpost hand (`arrowBoard`, from the signpost
 * icon): lit top edge, shaded bottom two rows, the point bevelled, the post in `trunk` lit down its
 * left with its cap catching the light.
 *
 * No baked ground. A sprite that carries a patch of lawn takes it onto the sand, which is the whole
 * argument of `cast.ts`'s CONTACT note; the post stands on a bar of its own keyline instead.
 */
export function paintForkSignFrame(img: Img, frame: 0 | 1): void {
  // The post, lit down the left, and its cap.
  img.rect(14, 3, 4, 27, shade('trunk', 1));
  img.rect(14, 3, 1, 27, shade('trunk', 2));
  img.rect(17, 3, 1, 27, shade('trunk', 0));
  img.rect(13, 2, 6, 2, shade('trunk', 0));
  img.rect(13, 2, 5, 1, shade('trunk', 3));
  img.rect(15, 20, 1, 4, shade('trunk', 0)); // a run of grain below the board
  // The board, pointing the way the frame says, and the shadow it drops on the post.
  if (frame === 0) arrowBoard(img, 9, 27, 5, 11, 5, false);
  else arrowBoard(img, 4, 22, 5, 11, 5, true);
  img.rect(14, 16, 4, 1, shade('trunk', 0));
  // The contact: a bar of keyline under the foot, wider than the post.
  img.rect(12, 30, 8, 1, keyline('wood'));
  img.outline(keyline('wood'));
}

/**
 * The lantern's glow, 64 x 64 x 1: a radial in hard rings, from the flame's `gold` at the core down
 * the ramp and past its foot through `keyline('gold')` to a near-black rim.
 *
 * MADE FOR AN ADDITIVE BLEND, and that is how it stays inside the no-partial-alpha rule. A soft
 * glow drawn the usual way is a disc of falling alpha, and every one of those pixels is a partly
 * transparent pixel, which docs/ASSETS.md forbids. Laid with `Phaser.BlendModes.ADD` instead, each
 * opaque ring ADDS its colour to whatever is under it -- the core adds a lot, the near-black rim
 * almost nothing -- so the falloff is in the values, every pixel is solid, and the edge of the
 * disc dissolves into the lawn rather than stopping on it. Drawn with a NORMAL blend it is a solid
 * gold coin, which is not what it is for.
 *
 * PIXEL-STEPPED, NOT A GRADIENT: nine flat rings, each two to four pixels wide, so at zoom 2 the
 * light falls in visible bands the way every other shaded mass in this game does. Each ring's edge
 * is nudged a pixel in and out round the circle so the bands read as light and not as a target.
 */
export function paintLanternGlowFrame(img: Img): void {
  /*
   * EMBER, NOT GOLD (Paul's round, 2026-10-22). The glow is drawn with an ADDITIVE blend, and
   * additive gold on a green lawn is yellow-green: gold's light is mostly green channel, so the
   * halo round Purple read as lime -- the one colour the brand keeps for the call to action. The
   * board's own `ember` ramp (paint.ts) is gold with two thirds of its green taken out, so the same
   * rings added to grass come out peach. Same nine rings, same falloff, same keylines, pulled the
   * same way.
   */
  const warm = (c: RGBA): RGBA => pull(c, 0.32, 0.24);
  const rings: readonly RGBA[] = [
    ember(0.92),
    ember(0.72),
    ember(0.52),
    ember(0.3),
    warm(shade('gold', 0)),
    warm(keyline('gold', 36)),
    warm(keyline('gold', 62)),
    warm(keyline('gold', 86)),
    warm(keyline('gold', 104)),
  ];
  const R = 31.5;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const dx = x + 0.5 - 32;
      const dy = y + 0.5 - 32;
      const d = Math.hypot(dx, dy);
      // Under a pixel of wobble round the circle, at two incommensurate lobe counts, so no ring is
      // a compass circle and none is a polygon either.
      const a = Math.atan2(dy, dx);
      const wob = Math.cos(a * 5) * 0.45 + Math.cos(a * 9 + 1.3) * 0.3;
      const r = (d + wob) / R;
      if (r > 1 || d > R) continue;
      // The rings get wider towards the rim: light falls off fast near the flame and slowly far out.
      const i = Math.min(rings.length - 1, Math.floor(r ** 0.75 * rings.length));
      img.px(x, y, rings[i]!);
    }
}

/**
 * The ground glow under a character not yet met, 48 x 48 x 2 (the client's round, 2026-10-25:
 * "players found it hard to find the characters on the map").
 *
 * A RING ON THE GROUND, seen from this camera: an ellipse three times as wide as it is deep, 46
 * across -- wide enough to stand round the broadest pair of feet in the cast, the snail's 25, with
 * the scene's own pool of shade left dark in the middle of it -- centred in the frame, so the scene
 * lays its middle on the feet. Frame 0 is the whole ring. Frame 1 is its FRONT ARC only, the half
 * nearer the camera, and it is what the scene lays over a tree crown that hides a character's feet
 * (`forest-scene.ts`): the back arc runs behind the figure, and drawn over the canopy it would be
 * drawn over the figure too.
 *
 * WARM, NOT LILAC, and not additive. Purple's own hue under seven other figures is the scatter
 * PIXEL_STANDARD section 2 moved the toadstools and the flowers off, and the protagonist and the
 * attacker are meant to be the only saturated purple in frame. Gold is the lantern's light, already
 * world colour, and it reads against both the lawn and the dusk wash. It is laid with a NORMAL blend:
 * additive light on this lawn saturates its green channel and comes out lime, which is the brand's
 * call to action and appears nowhere in the world (the lantern glow's note records falling for it).
 *
 * PIXEL-STEPPED, NOT A BLUR. The ring peaks in `gold` 3 and falls away inward and outward through
 * `gold` 2, then through two DITHER steps -- every other pixel, then one in four -- which is how a
 * pixel drawing goes soft without a partly transparent pixel in the file (docs/ASSETS.md). The
 * dither is laid on the frame's own grid and the scene places the frame on whole pixels, so at
 * zoom 2 it reads as a soft edge and never shimmers. The scene does the pulse, with the sprite's
 * alpha, and holds it steady under reduced motion.
 *
 * It never says good or bad: every character gets the same ring, and it goes when they are met.
 */
export const GROUND_GLOW_SIZE = 48;

export function paintGroundGlowFrame(img: Img, frame: 0 | 1): void {
  const c = GROUND_GLOW_SIZE / 2;
  const rx = 23;
  const ry = rx / 3;
  /** Inner edge to outer edge, by elliptical radius: what is drawn there, and how densely. */
  const bands: readonly { from: number; colour: RGBA; every: 1 | 2 | 4 }[] = [
    { from: 0.5, colour: shade('gold', 2), every: 4 },
    { from: 0.6, colour: shade('gold', 2), every: 2 },
    { from: 0.7, colour: shade('gold', 2), every: 1 },
    { from: 0.78, colour: shade('gold', 3), every: 1 },
    { from: 0.9, colour: shade('gold', 2), every: 2 },
    { from: 0.96, colour: shade('gold', 2), every: 4 },
  ];
  for (let y = 0; y < img.h; y++) {
    // The front arc is the near half: every row from the middle down.
    if (frame === 1 && y < c) continue;
    for (let x = 0; x < img.w; x++) {
      const r = Math.hypot((x + 0.5 - c) / rx, (y + 0.5 - c) / ry);
      if (r > 1) continue;
      let band: (typeof bands)[number] | undefined;
      for (const b of bands) if (r >= b.from) band = b;
      if (!band) continue;
      const on =
        band.every === 1 ||
        (band.every === 2 && (x + y) % 2 === 0) ||
        (band.every === 4 && x % 2 === 0 && y % 2 === 0);
      if (on) img.px(x, y, band.colour);
    }
  }
}

export const FACE_PAINTERS: Record<string, Painter> = {
  'portrait-purple': portraitPurple,
  'portrait-rabbit': portraitRabbit,
  'portrait-owl': portraitOwl,
  'portrait-keeper': portraitKeeper,
  'portrait-wolf-grandma': portraitWolfGrandma,
  'portrait-grandma': portraitGrandma,
  'item-compass': compass,
  'item-translator': translator,
  'item-lantern': lantern,
  'item-key': key,
  'item-letter': letter,
  'item-signpost': signpost,
  'item-parcel': parcel,
  'item-shortcut': shortcut,
  'item-latch': latch,
  'item-weaver': weaver,
  'item-wings': wings,
  'item-hourglass': hourglass,
  'fx-dust': (img) => paintDustFrame(img, 0),
  'fx-interact-prompt': (img) => paintInteractPromptFrame(img, 0),
  'fx-pawprints': (img) => paintPawprintsFrame(img, 0),
};
