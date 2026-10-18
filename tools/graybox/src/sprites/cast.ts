/*
 * The cast: the four characters who offer Red something, redrawn at 32 x 48.
 *
 * These are not the 16px sprites scaled up. The 16px versions had to spend every pixel on the
 * silhouette, so each of them is a stack of ellipses with two dots for a face, and three of the
 * four end up sharing the same lollipop outline. The 4x budget here goes entirely on STRUCTURE
 * (docs/PIXEL_STANDARD.md section 1): separate leaf-shaped ears with a lit rim and a shaded rim,
 * layered wing coverts, a lantern with a frame and panes and a flame behind the mullions, a muzzle
 * that actually projects out of the skull. No extra speckle anywhere.
 *
 * The brief every one of them answers: at a 26-tile camera you read the OUTLINE before anything
 * inside it, so each of the four has to be identifiable with the fill removed.
 *
 *   rabbit  -- round, two tall upright leaf ears, cotton tail
 *   owl     -- squat barrel, flat top, two small out-leaning tufts, talons on the ground
 *   keeper  -- a bell-shaped hooded coat with a lantern hanging off a pole to one side
 *   wolf    -- sitting predator: long muzzle thrust down and forward out of a low skull,
 *              tall notched ears, hackles along the back, heavy tail along the ground
 *
 * Colour comes only from shade(ramp, level) -- the 16px rabbit carried two raw pink literals for
 * its inner ears, which is exactly the kind of pixel that would have survived the rebrand. The
 * inner ear is `skin` here, which is the palette's warm pale ramp and is already Red's own face.
 *
 * The wolf takes the `wolf` ramp (now near-black Deep Purple) on frames 0 and 1 and is painted
 * flat in `ink` on frames 2 and 3, which are him in shadow: 2 is the shape in the lit window, 3 is
 * the same shape wearing Grandma's bonnet and shawl. That pair IS the game's title, so the bonnet
 * stays bright (`wall`, luma 175) over fur that is nearly black, and his ear tips stay above the
 * brim where you cannot miss them.
 *
 * `ink` IS the wolf's, and only his (docs/PIXEL_STANDARD.md section 4). Until 2026-10-18 every
 * painter in this file finished with outline(ink 0), which meant the one treatment reserved for the
 * predator was shared with a rabbit, an owl and a lamplighter and so distinguished him from nobody.
 * Each character is now ringed in its OWN dark -- `fur` 0 on the rabbit, `trunk` 0 on the owl,
 * `roof` 0 on the keeper -- and the wolf is the only thing in the forest edged in Cyera Black.
 * The rabbit's and the owl's pupils stay on `ink`: a pupil is a black dot on an eye, not a ring
 * round a silhouette, and nine pixels of it take nothing away from the wolf.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/**
 * A filled ellipse whose centre slides sideways as it descends. Ears, tufts and hackles are cones
 * that lean away from the body; drawn as upright ellipses they come back as matching lollipops,
 * which is most of the reason the old rabbit and the old cat shared an outline.
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

/** A thick line with round caps, tapering along its length: limbs, muzzles, tails, sleeves. */
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
 * The contact shadow every standing thing owes the ground (section 3), painted ONLY where the
 * sprite is not. It runs after `outline`, so the ink edge never wraps round the shadow and leaves
 * the character standing in a dark puddle with a keyline round it.
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

// ----------------------------------------------------------------------------- the rabbit

/**
 * Soft, round, and the only one of the four with the mass up top: two leaf ears that take up a
 * third of the frame. Everything else about him is a circle, so the ears are the whole read.
 *
 * The breath moves the head and ears only; the front paws stay planted, which is what makes a
 * one-pixel bob look like breathing rather than like the sprite sliding.
 */
function paintRabbit(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- ears: shaded leaf, lit leaf inset up-left, warm inner channel ---
  const ear = (cx: number, cy: number, lean: number): void => {
    leanEllipse(img, cx, cy, 3.4, 9.6, lean, shade('fur', 0));
    leanEllipse(img, cx - 0.7, cy - 0.7, 2.7, 8.6, lean, shade('fur', 2));
    leanEllipse(img, cx + 0.1, cy + 1.2, 1.5, 6.4, lean, shade('skin', 0));
    leanEllipse(img, cx - 0.3, cy + 1.0, 0.9, 5.4, lean, shade('skin', 2));
  };
  ear(11.5, 13 + b, -0.26);
  ear(21.0, 12 + b, 0.26);

  /*
   * Body: the full mass in shade, then the base inset two pixels up-left so a broad crescent of
   * shade survives down the bottom-right, then the lit chest. A white animal on `fur` is the
   * hardest thing in this file to give form to -- levels 1 and 2 are nine levels of luma apart --
   * so nearly all of the modelling has to come from how much level 0 is left showing.
   */
  img.ellipse(16, 36, 9.6, 10, shade('fur', 0));
  img.ellipse(14.6, 34.6, 8.8, 9.2, shade('fur', 1));
  img.ellipse(12.4, 32.2, 6, 6.4, shade('fur', 2));
  img.ellipse(17, 42, 7.4, 3.4, shade('fur', 0)); // the belly, sitting in its own shadow

  // Haunch: one curved seam, not a field of speckle. It is what says the body has a leg in it.
  limb(img, 10.2, 33, 13.4, 43, 2, 2.4, shade('fur', 0));

  // Cotton tail, the one place level 3 is allowed to sit as a shape of its own.
  img.ellipse(25.4, 38, 3.6, 3.4, shade('fur', 0));
  img.ellipse(24.9, 37.4, 2.9, 2.7, shade('fur', 3));

  // Front paws, planted; two toe grooves each so they are paws and not pebbles.
  for (const px0 of [11.5, 19]) {
    img.ellipse(px0, 43.6, 3.4, 2.6, shade('fur', 0));
    img.ellipse(px0 - 0.5, 43, 2.7, 1.9, shade('fur', 2));
    img.rect(Math.round(px0) - 1, 43, 1, 2, shade('fur', 0));
    img.rect(Math.round(px0) + 1, 43, 1, 2, shade('fur', 0));
  }

  // The head throws a shadow across the chest, or the two whites merge into one egg.
  img.ellipse(16, 29 + b, 7.8, 2.8, shade('fur', 0));

  // --- head, in front of the ear bases ---
  img.ellipse(16, 21 + b, 7.6, 6.6, shade('fur', 0));
  img.ellipse(15.2, 20.2 + b, 6.9, 5.9, shade('fur', 1));
  img.ellipse(13, 18.2 + b, 4.6, 3.8, shade('fur', 2));
  // Cheek puffs: the rabbit's jaw, and the reason the face is wider than the skull.
  img.ellipse(10.4, 24 + b, 3.4, 2.7, shade('fur', 1));
  img.ellipse(21.6, 24 + b, 3.4, 2.7, shade('fur', 0));
  img.ellipse(10, 23.4 + b, 2.6, 2, shade('fur', 2));
  // Muzzle, so the nose has something to sit on instead of floating on the cheek.
  img.ellipse(16, 25.4 + b, 3.4, 2.4, shade('fur', 2));
  // Where each ear goes behind the skull, so they read as behind and not glued on.
  img.ellipse(12, 15 + b, 2.6, 1.6, shade('fur', 0));
  img.ellipse(20.6, 14.6 + b, 2.6, 1.6, shade('fur', 0));

  // Eyes: three pixels across with a single highlight; no mouth at this size (section 6).
  for (const ex of [10, 19]) {
    if (blink) {
      img.rect(ex, 21 + b, 3, 1, shade('ink', 0));
      img.px(ex, 22 + b, shade('fur', 0));
      img.px(ex + 2, 22 + b, shade('fur', 0));
    } else {
      img.rect(ex, 19 + b, 3, 3, shade('ink', 0));
      img.px(ex, 19 + b, shade('fur', 3));
    }
  }
  // Nose: four pixels in a wedge. A filled rectangle at this size reads as a sticker.
  img.rect(15, 24 + b, 3, 1, shade('skin', 0));
  img.px(16, 25 + b, shade('skin', 0));
  img.px(15, 24 + b, shade('skin', 2));
  img.px(14, 26 + b, shade('fur', 0));
  img.px(18, 26 + b, shade('fur', 0));

  // His own dark, not a key line. A Clay rim round a white animal is a quieter edge than the ink
  // one he used to wear, which is the correct trade: the wolf keeps the hard black silhouette, and
  // the rabbit keeps the soft one that goes with being the friendliest thing in the game. Against
  // the grass field (luma ~117) the Clay rim still separates by about 80 levels.
  img.outline(shade('fur', 0));
  ground(img, 16, 45, 10, 2.6);
}

// ----------------------------------------------------------------------------- the owl

/**
 * A barrel with a flat top. Where the rabbit is tall and narrow the owl is wide and low, and the
 * two facial discs push the width out past the body, so nothing else in the cast has this outline.
 *
 * The wings carry the 32px budget: four layered coverts each, lit on the left and in shade on the
 * right, which is a wing rather than a dark smudge down the side.
 */
function paintOwl(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- body and head, one merged mass: an owl has no neck ---
  img.ellipse(16, 31 + b, 10.6, 12.4, shade('trunk', 0));
  img.ellipse(15.4, 30.4 + b, 10, 11.8, shade('trunk', 1));
  img.ellipse(16, 19 + b, 9.4, 7.8, shade('trunk', 0));
  img.ellipse(15.4, 18.4 + b, 8.9, 7.3, shade('trunk', 1));
  img.ellipse(12.8, 16 + b, 6, 4.8, shade('trunk', 2));

  /*
   * The pale breast, which the two dark wings then frame. Without this field the wings and the
   * body are both `trunk` and the coverts read as bands running right across the bird -- which is
   * exactly how the first pass came out.
   */
  img.ellipse(15.6, 31 + b, 6.4, 10.4, shade('trunk', 2));
  // Barring: nine chevrons in three courses. Nine, not ninety: barring is structure, speckle is dirt.
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const y = 27 + r * 5 + b;
      const x = 12 + c * 4 + (r % 2 ? 2 : 0);
      img.line(x - 1, y, x, y + 1, shade('trunk', 0));
      img.line(x, y + 1, x + 1, y, shade('trunk', 0));
    }

  /*
   * Wings, folded down the sides. Four courses of coverts each, the lit edge on the left wing and
   * nothing but shade on the right, plus three primaries overhanging the tail.
   */
  const wing = (cx: number, dir: 1 | -1): void => {
    leanEllipse(img, cx, 30 + b, 4.4, 12, dir * 0.05, shade('trunk', 0));
    for (let i = 0; i < 4; i++) {
      const y = 23 + i * 4.4 + b;
      img.ellipse(cx + dir * 0.6, y, 3.6 - i * 0.3, 2.5, shade('trunk', dir < 0 ? 1 : 0));
      if (dir < 0) img.ellipse(cx - 1.4, y - 0.4, 2, 1.4, shade('trunk', 2));
      img.line(cx - 3.4, y + 2, cx + 3.4, y + 2.4, shade('trunk', 0));
    }
    for (let i = 0; i < 3; i++)
      img.rect(Math.round(cx - 2.5 + i * 2), 40 + b, 2, 5 - i, shade('trunk', 0));
  };
  wing(6.6, -1);
  wing(25.4, 1);

  // Tail wedge between the primaries.
  img.ellipse(16, 43 + b, 4.4, 2.6, shade('trunk', 0));
  img.ellipse(16, 42 + b, 3.6, 1.6, shade('trunk', 1));

  // Talons, gripping the ground in front of the tail, and never bobbing with the breath.
  for (const fx of [10, 18]) {
    img.rect(fx, 42, 5, 2, shade('gold', 0));
    img.rect(fx, 42, 5, 1, shade('gold', 1));
    for (let t = 0; t < 3; t++) {
      img.rect(fx + t * 2, 44, 1, 2, shade('gold', 1));
      img.px(fx + t * 2, 45, shade('gold', 0));
    }
  }

  // --- ear tufts: narrow, pointed and leaning out. Rounded ones turn him into a cat ---
  for (const [tx, lean] of [
    [9.4, -0.42],
    [22.6, 0.42],
  ] as const) {
    for (let i = 0; i < 8; i++) {
      const w = Math.max(1, Math.round(1 + i * 0.42));
      img.rect(Math.round(tx - w / 2 + lean * i), 7 + i + b, w, 1, shade('trunk', 0));
      if (i > 2 && w > 1)
        img.px(Math.round(tx - w / 2 + lean * i), 7 + i + b, shade('trunk', lean < 0 ? 2 : 1));
    }
  }

  // --- the facial discs, which are the owl ---
  for (const dx of [-4.9, 4.9]) {
    const cx = 16 + dx;
    img.ellipse(cx, 20 + b, 5.6, 5.6, shade('trunk', 0));
    img.ellipse(cx, 20 + b, 4.8, 4.8, shade('wall', 1));
    img.ellipse(cx - 0.8, 19.2 + b, 3.7, 3.7, shade('wall', 2));
    if (blink) {
      // Lid down, with the lash line above it: a closed eye, not a missing one.
      img.ellipse(cx, 21.4 + b, 4.1, 2.4, shade('trunk', 1));
      img.line(cx - 3.6, 20 + b, cx + 3.6, 20 + b, shade('trunk', 0));
    } else {
      img.ellipse(cx, 20 + b, 2.7, 2.7, shade('ink', 0));
      img.rect(Math.round(cx) - 2, 18 + b, 2, 2, shade('wall', 3));
    }
  }

  // Beak between the discs: four courses, lit on the left, dark at the tip.
  img.rect(14, 23 + b, 4, 1, shade('gold', 0));
  img.rect(14, 24 + b, 4, 2, shade('gold', 1));
  img.rect(14, 24 + b, 1, 2, shade('gold', 2));
  img.rect(15, 26 + b, 2, 1, shade('gold', 0));
  img.px(16, 27 + b, shade('gold', 0));

  // Bark-dark, which is his own ramp and 60 levels under the grass field: the owl loses nothing by
  // giving the black keyline back to the wolf.
  img.outline(shade('trunk', 0));
  ground(img, 16, 45, 10.5, 2.4);
}

// ----------------------------------------------------------------------------- the lantern keeper

/**
 * No reference exists for this character anywhere (docs/ART_PRODUCTION.md section 5), so this is
 * the design pass that file asks for, built to its recommendation: a badger in a hooded coat
 * carrying the lantern on a short pole.
 *
 * Two things drive every decision here. First, the LANTERN is the skill, so the lantern is what
 * the silhouette is about -- it hangs clear of the body on a pole, out in the frame's left column
 * where nothing else in the cast puts anything, and it is the only bright object on the sprite.
 * Second, the face must not compete with it, so the badger reads by its head stripes alone.
 *
 * The coat is `roof`, and the comment that used to sit here was wrong in a way worth recording.
 * It claimed the coat was "the forest's night ramp rather than anything that could be mistaken for
 * Red's purple". `night` 2 is #441363 and `night` 3 is #6D2D93 -- those ARE `cloak` 0 and `cloak` 1,
 * so the rim light down his coat, his creases and his hood's lit dome were painted in Red's own two
 * tokens, 63 pixels of Aubergine per frame. At a 26-tile camera the forest held two purple-hooded
 * figures, which is the exact competition the rebrand exists to prevent, and docs/PIXEL_STANDARD.md
 * section 2 does not list him among the things brand colour reaches the world through.
 *
 * `roof` is the one ramp in the palette no character owns -- it was added for the cottage's slate,
 * a building he is never beside -- so it is the only place he can have an identity of his own
 * without borrowing another cast member's. It is also a warm NEUTRAL, which is what finally makes
 * the lantern the loudest thing on him: gold against grey is the only saturated colour in the
 * frame, where gold against a purple coat was just one bright thing among two. `roof` 0 (luma 69)
 * is a proper own-dark against the grass field at 117, which is what `stone` could never be.
 *
 * The lantern is up and to the left, which is exactly where the world's one light comes from
 * (section 3), so the warm pixels it throws onto the hood and the snout are consistent with every
 * other sprite rather than a second light source. They are solid `gold` 1 pixels, never a
 * translucent halo: the 16px keeper painted its glow at alpha 45 over transparency, which left
 * partly-transparent pixels in the file that docs/ASSETS.md forbids.
 */
function paintKeeper(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;
  const CX = 19;

  // Boots under the hem, planted.
  for (const fx of [15, 21]) {
    img.rect(fx, 42, 4, 4, shade('wood', 0));
    img.rect(fx, 42, 4, 1, shade('wood', 1));
  }

  // --- the coat: a bell, widening to the hem, with a lit edge facing the lantern ---
  for (let y = 23; y <= 44; y++) {
    const half = Math.round(8.5 + ((y - 23) / 21) * 2.5);
    const left = CX - half;
    img.rect(left, y + b, half * 2, 1, shade('roof', 1));
    img.rect(left, y + b, 2, 1, shade('roof', 2)); // rim towards the lantern
    // Five pixels of flank turning away, not three. `roof` 1 is within a few levels of the grass
    // field, so the bell only becomes a bell -- and only stays darker than the ground it stands on
    // -- if a wide band of it has gone over into shade. Level 3 appears nowhere on the cloth: what
    // sparkles on this sprite is the lantern, and the gold pixels it lands are the whole budget.
    img.rect(CX + half - 5, y + b, 5, 1, shade('roof', 0));
  }
  /*
   * Two creases, falling away from the belt the way a belted bell-coat actually folds. A seam has
   * to be a lit edge with a shadow beside it, because a fold drawn in level 0 alone barely exists
   * at this size -- but straight vertical ones every few pixels turned the coat into corduroy, so
   * these lean and there are two.
   */
  for (const [fx0, fx1] of [
    [CX - 4, CX - 7],
    [CX + 3, CX + 6],
  ] as const)
    for (let y = 37; y <= 43; y++) {
      const x = Math.round(fx0 + ((fx1 - fx0) * (y - 37)) / 6);
      img.px(x, y + b, shade('roof', 2));
      img.px(x + 1, y + b, shade('roof', 0));
    }
  img.rect(CX - 12, 44 + b, 24, 1, shade('roof', 0)); // hem

  // Belt: a dark strap with one lit edge. The first pass made it tan and full width, and it read
  // as a plank the keeper was carrying across his middle.
  img.rect(CX - 7, 34 + b, 14, 2, shade('wood', 0));
  img.rect(CX - 7, 34 + b, 14, 1, shade('wood', 1));
  img.rect(CX - 2, 33 + b, 4, 4, shade('gold', 0));
  img.px(CX - 1, 34 + b, shade('gold', 2));

  // --- the arm that holds the pole, reaching down-left out of the coat ---
  limb(img, 14, 27 + b, 12, 34 + b, 6, 4.6, shade('roof', 1));
  limb(img, 13.2, 27 + b, 11.2, 34 + b, 2.4, 2, shade('roof', 2));

  /*
   * Hood: shade dome, a rim-light dome barely larger than the body, then the body inset
   * down-right. The rim stays about a pixel wide -- level 2 is a lit edge, and a broad band of it
   * turns the hood into a lit dome and stops being a highlight (section 2).
   */
  img.ellipse(CX - 0.5, 25.6 + b, 8.6, 2.4, shade('roof', 0)); // collar, under the hood
  img.ellipse(CX + 0.5, 15 + b, 8.6, 7.6, shade('roof', 0));
  img.ellipse(CX - 0.1, 14.4 + b, 8.4, 7.4, shade('roof', 2));
  img.ellipse(CX + 1.1, 15.6 + b, 8.3, 7.3, shade('roof', 1));
  // The opening, cut low and towards the lantern, with the head set down into it.
  img.ellipse(17.6, 20.5 + b, 6.8, 5.2, shade('roof', 0));

  /*
   * --- the badger, in three-quarter view, looking down towards his own lantern ---
   *
   * The head sits low in the dome, so the hood frames it overhead and down both sides without a
   * separate brim shape having to be drawn at all; only the muzzle comes out below.
   *
   * It took three passes to get the badger to read. The animal's two black stripes run down the
   * outside of a white head and through the eyes, and painted straight-on at this size that fails
   * twice: the right-hand stripe merges into the inside of the hood, and a round white face with
   * two big symmetrical dark patches on it is not a badger, it is a skull. Turning the head
   * three-quarter solves both. One wedge, one stripe along the crown, one eye -- and because he is
   * now looking down at his lantern rather than out at the player, the lantern stays the loudest
   * thing on the sprite, which is the entire brief for this character.
   */
  limb(img, 20.2, 22.2 + b, 13.8, 27.6 + b, 8, 5, shade('fur', 0));
  limb(img, 19.8, 21.8 + b, 13.6, 27.1 + b, 6.6, 3.8, shade('fur', 1));
  limb(img, 19.2, 21.2 + b, 14.2, 25.8 + b, 4.4, 2.4, shade('fur', 2));
  /*
   * The crown stripe, from the ear to just short of the nose, with the eye set into it. It reads as
   * black at this size without being Cyera Black: `roof` 0 is a dark warm charcoal 162 levels under
   * the white of his head, it is the dark of the coat he is wearing, and it leaves `ink` to the
   * wolf. A badger needs a near-black marking, and `fur` 0 -- the only dark his own white ramp has
   * -- is Clay, which on a white head is no marking at all.
   */
  limb(img, 20.6, 20.2 + b, 14.4, 24.8 + b, 3.6, 2, shade('roof', 0));
  img.ellipse(22.6, 19.6 + b, 2.2, 2, shade('fur', 0)); // the ear the hood lets through
  img.ellipse(22.7, 19.8 + b, 1.2, 1, shade('roof', 0));
  img.ellipse(13.1, 27.9 + b, 2.2, 1.6, shade('roof', 0)); // nose
  img.px(12.2, 27.1 + b, shade('fur', 3));
  if (!blink) img.rect(16, 23 + b, 2, 1, shade('wall', 3));

  // --- the pole, and the lantern that is the whole point of him ---
  limb(img, 11, 34 + b, 4.6, 11, 2.4, 2, shade('wood', 1));
  limb(img, 10.4, 34 + b, 4, 11, 1, 1, shade('wood', 2));
  // His paw closed round it.
  img.ellipse(10.8, 34 + b, 2.8, 2.3, shade('fur', 1));
  img.ellipse(10.4, 33.4 + b, 2.2, 1.7, shade('fur', 2));
  img.line(9, 34 + b, 12, 34 + b, shade('fur', 0));

  img.frame(4, 9, 3, 3, shade('wood', 0)); // hanging ring
  img.rect(1, 12, 9, 2, shade('wood', 0)); // cap
  img.rect(2, 11, 7, 1, shade('wood', 1));
  img.px(2, 11, shade('wood', 2));
  img.rect(1, 14, 9, 9, shade('gold', 0)); // the frame, then the panes inside it
  img.rect(2, 15, 7, 7, shade('gold', 1));
  img.rect(2, 15, 7, 3, shade('gold', 2));
  img.rect(5, 15, 1, 7, shade('gold', 0)); // mullions, which the flame passes in front of
  img.rect(2, 18, 7, 1, shade('gold', 0));
  img.ellipse(5.5, 19, 1.8, 2.8, shade('gold', 3));
  img.ellipse(5.5, 20, 1, 1.4, shade('wall', 3));
  img.rect(1, 23, 9, 2, shade('wood', 0)); // base
  img.rect(2, 25, 7, 1, shade('wood', 0));
  img.px(1, 23, shade('wood', 1));

  // What the lantern lands on: the hood's left edge, the badger's cheek, the coat's lit rim.
  // Solid pixels on the objects, never a halo in the air (see this painter's note above).
  for (const [lx, ly] of [
    [12, 12],
    [10, 15],
    [10, 18],
    [11, 22],
    [13, 26],
    [10, 29],
    [9, 33],
    [9, 38],
    [8, 43],
  ] as const)
    img.px(lx, ly + b, shade('gold', 1));

  img.outline(shade('roof', 0));
  ground(img, 19, 45, 11, 2.6);
}

// ----------------------------------------------------------------------------- the wolf

/**
 * The predator. He gets the vocabulary nothing else in the cast uses: he is seated in
 * three-quarter view with his head LOW and forward, a muzzle that projects a third of the frame's
 * width out of the skull, tall ears with a wide notch between them, a ridge of raised hackles down
 * the back, and a heavy tail laid along the ground. Every other character here is bilaterally
 * symmetrical and faces straight out; he is the only one turned, which is most of why he reads as
 * something with intent rather than something waiting to be spoken to.
 *
 * `frame` 0 is him lit and watching, 1 is the same with the eyes narrowed and the chest dropped a
 * pixel. 2 and 3 are him flat in `ink`: the shape in the lit window, then the shape in Grandma's
 * bonnet and shawl. The lit pair uses `wolf` 0 and 1 for nearly all of the mass -- he stays at the
 * bottom of his ramp on purpose, because 2 and 3 only work if the lit frames are not already dark
 * enough to be mistaken for the silhouette.
 */
function paintWolf(img: Img, frame: 0 | 1 | 2 | 3): void {
  const dark = frame >= 2;
  const b = frame === 1 ? 1 : 0;

  const dk = dark ? shade('ink', 0) : shade('wolf', 0);
  const base = dark ? shade('ink', 0) : shade('wolf', 1);
  const mid = dark ? shade('ink', 0) : shade('wolf', 2);
  const lit = dark ? shade('ink', 1) : shade('wolf', 3);

  /*
   * The tail: heavy, down behind the haunch and laid along the ground, its tip coming out past
   * the far side of the forelegs. Drawn FIRST so the legs and the body stand in front of it --
   * curled over them it read as a log across his feet, and tucked behind the haunch it did not
   * read at all. The long horizontal it lays under the frame is a silhouette none of the other
   * three has.
   */
  limb(img, 25.5, 32, 28.5, 40, 6, 6, dk);
  limb(img, 28.5, 40, 18, 45.6, 6, 5, dk);
  limb(img, 18, 45.6, 6.4, 44, 5, 3.6, dk);
  limb(img, 27.6, 39.4, 18, 44.2, 2, 1.8, mid);
  limb(img, 16, 44.2, 7, 43, 1.8, 1.4, mid);
  img.px(6, 43, lit);

  // Forelegs, straight and propped: a seated wolf holds himself up on them.
  for (const [hx, px0] of [
    [12, 11],
    [18.4, 18.4],
  ] as const) {
    limb(img, hx, 31, px0, 40, 5.4, 4.4, dk);
    limb(img, hx - 0.7, 31, px0 - 0.7, 40, 3.2, 2.6, base);
    img.ellipse(px0, 41.4, 3.4, 2.1, dk);
    img.ellipse(px0 - 0.5, 40.8, 2.7, 1.5, base);
    for (let t = 0; t < 2; t++) img.px(px0 - 1 + t * 2, 42, dk);
  }

  // --- haunch and chest: wide and heavy behind, narrow in front. A rabbit is the other way round ---
  img.ellipse(22.4, 34 + b, 7.2, 8.4, dk);
  img.ellipse(21.8, 33.4 + b, 6.6, 7.8, base);
  // Set low and back, which is what leaves the muzzle hanging out over clear air. Drawn any
  // higher, the chest meets the jaw and frames 2 and 3 lose the long nose into one black mass.
  img.ellipse(16, 33 + b, 6.6, 9, dk);
  img.ellipse(15.4, 32.4 + b, 6, 8.4, base);
  img.ellipse(14.2, 29.8 + b, 3.8, 5.2, mid);
  // Shoulder blade, which is what makes a hunched animal look boned rather than stuffed.
  limb(img, 18, 27 + b, 20, 33 + b, 2, 2, dk);

  /*
   * Hackles: six raised spikes down the back, lit along the top. They have to be drawn as mass
   * standing proud of the back line, not as a dark marking, so that frames 2 and 3 -- which are
   * flat ink and have no internal shading at all -- keep them in the silhouette.
   */
  for (let i = 0; i < 6; i++) {
    const hx = 17 + i * 2.1;
    const hy = 24.4 + i * 1.5 + b;
    leanEllipse(img, hx, hy, 1.7, 3, 0.42, dk);
    leanEllipse(img, hx - 0.6, hy - 0.4, 0.9, 2.4, 0.42, mid);
  }

  // Ruff: the chest fringe, pointing down and out over the chest edge.
  for (let i = 0; i < 4; i++) leanEllipse(img, 10.4 + i * 0.5, 29 + i * 3 + b, 1.9, 2.5, -0.42, dk);

  // --- ears: tall, pointed, wide apart, and leaning out. Nothing else here has a notch ---
  const ear = (cx: number, lean: number): void => {
    for (let i = 0; i < 10; i++) {
      const w = Math.max(1, Math.round(1 + i * 0.62));
      img.rect(Math.round(cx - w / 2 + lean * i), 3 + i + b, w, 1, dk);
    }
    for (let i = 3; i < 9; i++) {
      const w = Math.max(1, Math.round(i * 0.4));
      img.rect(Math.round(cx - w / 2 + lean * i), 3 + i + b, w, 1, mid);
    }
  };
  ear(10.4, -0.4);
  ear(19.2, 0.34);

  /*
   * Skull held low and forward, and the muzzle driven a third of the frame's width out of it.
   * The muzzle is the single feature doing the work: shorten it by three pixels and he is a dog.
   */
  img.ellipse(14.6, 18 + b, 5.8, 5, dk);
  img.ellipse(14, 17.4 + b, 5.3, 4.5, base);
  img.ellipse(12.6, 15.8 + b, 3.6, 2.8, mid);
  limb(img, 12.6, 21 + b, 4.4, 25.6 + b, 7.4, 4, base);
  limb(img, 12.2, 20.4 + b, 4.2, 24.9 + b, 4.8, 2.2, mid);
  limb(img, 12, 24 + b, 5.6, 27 + b, 4.2, 2.6, dk); // the jaw, hanging under the muzzle
  img.ellipse(4.1, 25.6 + b, 2.2, 1.7, shade('ink', 0)); // nose
  img.px(3.3, 24.8 + b, lit);

  // Rim light down the top-left contour, one pixel wide, which is all a highlight ever is.
  for (const [rx0, ry0] of [
    [10.6, 13.6],
    [12, 13],
    [13.6, 13.2],
    [9.6, 19.8],
    [8.4, 20.8],
    [7.2, 21.6],
    [6, 22.4],
    [11.8, 26],
    [10, 29],
    [9.4, 32],
  ] as const)
    img.px(rx0, ry0 + b, lit);

  // --- eyes: amber, the only warm thing about him, and the one colour the silhouette keeps ---
  for (const [ex, ey] of [
    [10.4, 17],
    [16, 16.2],
  ] as const) {
    const x = Math.round(ex);
    const y = Math.round(ey) + b;
    img.rect(x - 2, y - 1, 4, 1, dk); // brow ridge: the glare, and it costs four pixels
    if (frame === 1) img.rect(x, y + 1, 2, 1, shade('gold', 1));
    else {
      img.rect(x, y, 2, 2, shade('gold', dark ? 1 : 3));
      img.rect(x, y + 1, 2, 1, shade('gold', 0));
    }
  }

  if (frame === 3) {
    /*
     * Grandma's things, worn by something that is not Grandma.
     *
     * Two bands only, and a clear gap of wolf between them: the bonnet across the crown with both
     * ear tips standing clear above it, and the shawl across the shoulders, pushed right and kept
     * narrow. What runs through that gap is the muzzle, nose and all, and the whole frame exists
     * so that you see it. The first pass stacked three tones of grey into one lumpy mass that
     * swallowed the muzzle entirely, which threw the joke away.
     */
    // The shawl, drawn as a draped triangle rather than stacked ellipses, which is what turned it
    // into a grey stone on his chest for two passes running.
    img.ellipse(20, 29.6, 8.8, 3.6, shade('stone', 2));
    img.ellipse(20.8, 30.4, 8.6, 3.4, shade('stone', 1)); // level 2 survives as a lit top-left rim
    for (let y = 31; y <= 36; y++) {
      const half = Math.round(6 - (y - 31) * 0.8);
      img.rect(20 - half, y, half * 2, 1, shade('stone', 1));
      img.rect(20 - half, y, 2, 1, shade('stone', 2));
      img.px(20 + half - 1, y, shade('stone', 0));
    }
    img.line(20, 27.4, 20.6, 33, shade('stone', 0)); // the neckline it was folded over
    img.line(23.6, 28.6, 21.6, 34, shade('stone', 0));
    for (let i = 0; i < 5; i++)
      img.rect(15.4 + i * 2.4, 36 - Math.abs(i - 2) * 0.7, 1, 2, shade('stone', 0));

    img.ellipse(14.6, 10.4, 6.8, 4.2, shade('wall', 0));
    img.ellipse(14, 9.6, 6.2, 3.6, shade('wall', 1));
    img.ellipse(12.4, 8.6, 3.2, 1.9, shade('wall', 3));
    // The frill: four scallops, spaced so the dark head shows in the dips between them.
    for (let i = 0; i < 4; i++) {
      img.ellipse(9.4 + i * 3.6, 13.8, 2.1, 2.1, shade('wall', 1));
      img.ellipse(9.4 + i * 3.6, 13.2, 1.3, 1.3, shade('wall', 3));
    }
  }

  img.outline(shade('ink', 0));
  ground(img, 18, 45.6, 12, 2.2);
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
