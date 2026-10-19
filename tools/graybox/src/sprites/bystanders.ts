/*
 * The four bystanders, drawn at 32 x 48.
 *
 * None of them offers a skill, none is ever scored, and nobody will stop to inspect one. They exist
 * so the forest reads as inhabited rather than as a test level with four quiz stations in it. That
 * makes them cheap to get wrong and cheap to get right: the whole job is four silhouettes that are
 * instantly nameable at a 26-tile camera and charming for the two seconds anyone looks.
 *
 * THE SIZE IS THE DRAWING (2026-10-19, UX review finding 19). These four used to stand as tall as
 * Red: the snail, whom `docs/ART_DIRECTION.md` section 10.2 puts LOWEST in the cast at 14 px, was
 * 41 px and taller than the magpie, and the cat and the rabbit shared an outline at 22 x 44 each.
 * Nine characters inside a 1.4:1 band cannot be told apart from across a clearing however well each
 * one is shaded, which is the whole of the finding. They are now drawn to the section 10.2 boxes --
 * 22 x 18, 28 x 22, 27 x 14 and 14 x 30 -- and `BYSTANDER_PLAN` below is that table. `cast.ts`
 * reads it, measures every finished silhouette against it, and refuses to let the art pipeline run
 * if one drifts; see `assertBodyPlans()` there.
 *
 * Three rows of about twenty pixels and one narrow upright is also what the forest needed: the
 * bystanders now sit in the undergrowth at a glance rather than lining up with the characters who
 * matter, so a player scanning a clearing finds the rabbit and the keeper first.
 *
 * What each one spends its pixels on, now that it has fewer (docs/PIXEL_STANDARD.md section 1 --
 * structure, not speckle):
 *
 *   toadstool -- a T. Everything above the stem is cap, gills under the brim, a pointing twig
 *   magpie    -- the only HORIZONTAL wedge tail in the cast, 14 px behind a 12 px body
 *   snail     -- a spiral and no legs: one continuous sole, a shell mouth, a parcel on the back
 *   cat       -- NARROW: 14 px across, ears flush with the skull, tail upright off the top-right
 *
 * Silhouettes, checked against each other and against the cast in `cast.ts`: a wide low dome on a
 * stalk, a long horizontal wedge, a low spiral, a tall thin triangle. The pair that used to be the
 * near-miss -- cat against rabbit -- is now 14 x 30 against 21 x 34, and the ears settle what is
 * left of it: the rabbit's are tall leaves standing up with sky between them, the cat's are short
 * triangles flush with the skull.
 *
 * Colour, per the rebrand (docs/ART_PRODUCTION.md section 6a):
 *   - the toadstool's cap is RUSSET, because THE TILE IS THE REFERENCE. `tiles.ts` assembles the
 *     tileset from the `w-*`/`s-*` modules, and the live `toadstoolRing` in
 *     `tiles/w-undergrowth.ts` paints its caps from a russet off `wood`. Until this was fixed the
 *     world held a russet toadstool TILE and a purple toadstool BYSTANDER side by side -- one
 *     species in two colours. The stems agreed all along (both the cottage's cream `wall`); the
 *     spots follow the tile from `fur` to `wall` for the same reason.
 *
 *     FLAGGED, NOT DECIDED HERE: docs/PIXEL_STANDARD.md section 2 still reads "Brand colour
 *     reaches the world through Red, the wolf, the toadstools, the flowers, the stall awning and
 *     the night, and nowhere else." Four of those six moved off brand colour -- the flowers and
 *     toadstool caps in `w-undergrowth.ts`, the awning in `s-props.ts`, the wolf in `cast.ts` --
 *     on the director's "standard 3 inversion" note and on probes of the board. The doc has not
 *     been updated to match, so the art and the standard disagree, and that is a call for the
 *     director rather than for this file. A sprite and its own tile disagreeing is a bug under
 *     either policy; if purple toadstools are reinstated, the tile and this sprite move back
 *     together.
 *   - the snail's shell is Clay with a Haze whorl: `fur` is the palette's warm pale neutral and the
 *     closest it holds to Clay, and the whorl is `cloak` level 3, which IS Haze. One line of it.
 *   - the cat is a ginger tabby in `wood`.
 *   - the magpie is black and white: `fur` for the white, and -- as of 2026-10-19 -- the BOTTOM
 *     HALF of `night` for the black, where he used to be painted and outlined in literal `ink`.
 *     `docs/PIXEL_STANDARD.md` section 4 reserves `ink` for the wolf, who is the one character
 *     meant to read as a flat silhouette, and a second near-black bird in the same ramp is exactly
 *     what makes that reservation mean nothing. `tone('night', 0..0.5)` runs #1a1026 to #2d1b3d,
 *     luma 22 to 36: a blue-black, which is what a magpie's gloss actually is, a step lighter than
 *     `ink` 0 at luma 16 so the wolf keeps the darkest mass in the game, and capped below level 2
 *     because `night` 2 and 3 are byte-identical to Red's cloak. He carries almost no internal
 *     modelling as a result, and should not: on a bird this dark the white belly and the white
 *     primary flash are the structure, and that is how the board would draw him too.
 *
 * Outlines follow section 4 -- `keyline(ramp)`, the object's own darkest taken down with the hue
 * kept, not `shade(ramp, 0)`. The snail and the cat used to finish on `shade('stone', 0)` (luma 96)
 * and `shade('wood', 0)` (luma 76), both of which section 13 item 16 names as out of the board's
 * L15-57 keyline band and neither of which is dark enough to hold an edge against grass at luma
 * 117. They are now `keyline('stone', 60)` at luma 36 and `keyline('wood')` at luma 32.
 *
 * CONTACT, NOT SHADOW. Every one of these used to finish with a `ground()` ellipse painted from the
 * `shadow` ramp -- grass in shade, a dark GREEN -- and those pixels are part of the sprite, so they
 * travelled with the snail onto the sand and left a green smudge under him. `cast.ts` fixed this
 * for the cast and the same fix applies here: a hard bar of the character's own keyline under the
 * feet, drawn before `outline` so the outline wraps it. It matters twice over at these sizes -- a
 * 13-px-wide shadow ellipse under a 14-px-tall snail is most of his silhouette, and it was the
 * reason three of these four measured 31 px wide whatever was actually drawn.
 */
import { Img, keyline, shade } from '../paint.ts';
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
 *
 * `squash` flattens it in y, and it is not cosmetic. The shell it has to sit inside is an ellipse
 * now that the snail is 14 px tall, and a circular spiral in an ellipse escapes through the top: at
 * `squash` 0.94 -- the value this took as a constant while the shell was round -- the outermost
 * Haze turn stood two rows PROUD of the shell and carried the finished silhouette a pixel over its
 * body plan, which is how it was found.
 */
function whorl(
  img: Img,
  cx: number,
  cy: number,
  r0: number,
  turns: number,
  phase: number,
  dr: number,
  squash: number,
  c: RGBA,
): void {
  const steps = 320;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * Math.PI * 2;
    const r = r0 * (1 - 0.86 * t) + dr;
    if (r <= 0.5) continue;
    img.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash, c);
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
 * The contact the ground is owed, made out of the character's own keyline instead of out of the
 * lawn. The twin of `base()` in `cast.ts`, and deliberately duplicated rather than imported: that
 * module imports this one for the body-plan gate, and a cycle between two painters is a worse
 * trade than ten lines said twice.
 *
 * Runs BEFORE `outline`, so the outline wraps it and the base reads as two dark pixels thick where
 * the feet touch and one everywhere else. It only paints transparent pixels with something of the
 * sprite within three rows above them, which closes the gaps between the toes into one planted line
 * without drawing a puddle out to the edges of the frame.
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

// --------------------------------------------------------------------- the body plan (10.2)

/**
 * The box each bystander's flat black shape has to fill, straight out of `docs/ART_DIRECTION.md`
 * section 10.2. `cast.ts` holds the other four and the note on how to read these numbers: they are
 * the OUTLINED bbox, because that is the shape a player sees and the shape 10.1 tests, and
 * `Img.outline()` grows it by one pixel on every side.
 *
 * Section 10.2's own figures are held exactly on height. Two widths moved by a pixel or two, and
 * both moves are to keep a pair out of each other's bands rather than to make a drawing easier:
 *
 * - **magpie 26 -> 28 wide, 20 -> 22 tall.** Against the snail at 26 x 14 the spec pair sits at
 *   dw 0, dh 6, which is inside 10.2's own "no two may share both a width band (+-4) and a height
 *   band (+-6)" -- the rule fails on the table that states it. Two rows of crown and the bill in
 *   front of the 12 px body take him to dh 8 and dw 1, which clears it on height.
 * - **snail 26 -> 27 wide.** Against the toadstool at 22 x 18 the spec pair is dw 4, dh 4, inside
 *   the band on both axes. One pixel of eye stalk clears it on width.
 */
export const BYSTANDER_PLAN = {
  'bystander-toadstool': { w: 22, h: 18, widest: 'the cap', breaks: 'the pointing twig' },
  'bystander-magpie': { w: 28, h: 22, widest: 'the tail', breaks: 'the horizontal wedge tail' },
  'bystander-snail': { w: 27, h: 14, widest: 'the shell', breaks: 'two eye stalks' },
  'bystander-cat': { w: 14, h: 30, widest: 'the shoulder', breaks: 'the tail, off the top-right' },
} as const satisfies Record<string, { w: number; h: number; widest: string; breaks: string }>;

// ----------------------------------------------------------------------------- the toadstool

/*
 * The cap's russet, and why it is no longer Cyera purple.
 *
 * This file's header used to argue the cap had to be `cloak` "because THE TILE IS THE REFERENCE":
 * `toadstoolRing` in `tiles/flora.ts` painted its three caps straight off `cloak`, so matching it
 * was the consistent choice. That argument expired. `tiles/flora.ts` is no longer shipped -- the
 * tileset is assembled from the `w-*`/`s-*` modules -- and the live `toadstoolRing`, now in
 * `tiles/w-undergrowth.ts`, paints its caps from a russet built off `wood`.
 *
 * These two lines are the live tile's own recipe at `tiles/w-undergrowth.ts` (`rust` and
 * `CAP_LINE`), restated against `shade()` because this sprite steps through discrete levels where
 * the tile sweeps a continuous `t`. Levels 0..3 land on #6b260e / #9a3a17 / #c04f24 / #dc6537,
 * inside the #6b2b12..#dc6e3a span the tile's dome actually covers, so the two read as one
 * mushroom at two sizes.
 *
 * Kept deliberately duplicated rather than exported from a tile module: a sprite reaching into
 * `tiles/` would invert the layering. If a third caller ever wants it, it belongs in `paint.ts`.
 */
const rustPull = (c: RGBA): RGBA => [c[0], Math.round(c[1] * 0.55), Math.round(c[2] * 0.42), 255];
const rust = (level: 0 | 1 | 2 | 3): RGBA => rustPull(shade('wood', level));
const CAP_LINE = ((c: RGBA): RGBA => [c[0], Math.round(c[1] * 0.62), Math.round(c[2] * 0.52), 255])(
  keyline('wood'),
);

/**
 * Convinced he is a signpost. A T: 22 px of cap over a 6 px stem, 18 px tall in all, which is the
 * lowest thing in the forest apart from the snail.
 *
 * He was 31 x 40 -- a mushroom the height of a wolf -- and the cost was not only that he broke his
 * own row in section 10.2 but that he broke the joke: a toadstool is funny because it is a small
 * thing with opinions, and at Red's height he was a tree. Everything above the stem is still cap,
 * so the silhouette is a toadstool before the face is read at all, and the face plus the pointing
 * twig are what turn it into somebody with a view about where you should be going.
 *
 * At a six-pixel stem the face is two eyes and a brow bar and that is the whole budget
 * (docs/PIXEL_STANDARD.md section 6: two pixels of eye, no mouth). The spots drop from five to
 * three for the same reason -- five on a cap this size is gravel.
 *
 * He is rooted and never bobs. The blink moves the twig arm a pixel instead, which is the only tell
 * that the thing addressing you is the mushroom and not something behind it.
 */
function paintToadstool(img: Img, blink: boolean): void {
  const t = blink ? 1 : 0;

  // --- stem: a short tapered column with a swollen base, lit down the left ---
  for (let y = 38; y <= 46; y++) {
    const hw = 2.8 + (y > 43 ? (y - 43) * 0.45 : 0);
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, shade('wall', 1));
    img.rect(left, y, 2, 1, shade('wall', 2));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  // --- the ring: the torn veil, flared wider than the stem and catching light on its top face ---
  for (let y = 39; y <= 40; y++) {
    const hw = 4.2 - (y - 39) * 1.2;
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, y === 39 ? shade('wall', 3) : shade('wall', 1));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  /*
   * --- cap: full mass in shade, body inset up-left, the lit quarter kept to the top-left ---
   *
   * The three levels are the tile's three levels, in the tile's order: `rust` 0 for the dark a
   * pixel proud of everything, `rust` 1 for the cap proper, `rust` 2 for the quarter facing the
   * light. He and `toadstoolRing` are the same mushroom at two sizes.
   */
  dome(img, 16, 38, 9.6, 7.0, rust(0));
  dome(img, 15.4, 37.4, 9.0, 6.4, rust(1)); // the cap proper
  dome(img, 13.6, 35.4, 5.6, 4.0, rust(2)); // the lit quarter only
  // The shaded flank: a crescent down the low right, where the dome turns away from the light.
  for (let y = 33; y <= 37; y++) {
    const dy = (y + 0.5 - 37.4) / 6.4;
    const half = 9.0 * Math.sqrt(Math.max(0, 1 - dy * dy));
    const edge = Math.round(15.4 + half);
    img.rect(edge - 2, y, 2, 1, rust(0));
  }
  // Rim light along the very top of the dome, one pixel thick and no more. The tile is too small
  // to carry a rim, so this is the one place the sprite says more than the tile does.
  for (let x = 8; x <= 19; x++) {
    const dx = (x + 0.5 - 15.4) / 9.0;
    const y = Math.round(37.4 - 6.4 * Math.sqrt(Math.max(0, 1 - dx * dx)));
    img.px(x, y + 1, rust(3));
  }

  // Gills: short radial ticks under the brim, deepest in the middle where the brim is widest.
  // CAP_LINE rather than `rust` 0: the tile takes its gills a full keyline under the cap's own
  // darkest, and at this size the brim needs that gap or the ticks vanish into the flank.
  for (let x = 7; x <= 25; x += 2) {
    const dx = (x + 0.5 - 16) / 9.6;
    const depth = Math.round(2 * (1 - dx * dx));
    for (let d = 0; d < depth; d++) img.px(x, 38 + d, CAP_LINE);
  }
  img.line(6, 38, 25, 38, CAP_LINE);

  // Spots: a dark seat, a mid face, a cream core inset up-left, so each one sits on the curve.
  // `wall` rather than `fur`, which is what the live tile spots this cap with: the cottage cream
  // rather than a near-white, so the mushroom reads as one material at both sizes.
  for (const [sx, sy, r] of [
    [11, 34, 2.4],
    [19, 33, 2.1],
    [22, 36, 1.7],
  ] as const) {
    img.ellipse(sx, sy, r, r * 0.9, rust(0));
    img.ellipse(sx - 0.3, sy - 0.4, r - 0.5, (r - 0.5) * 0.9, shade('wall', 1));
    img.ellipse(sx - 0.7, sy - 0.8, r - 1.1, (r - 1.1) * 0.9, shade('wall', 2));
  }

  /*
   * Face, well inside the stem so the outline never eats an eye. The brow bar above each eye is
   * what stops the pair reading as two holes punched in the stem -- and it also gives him the
   * expression of somebody about to tell you the way whether or not you asked.
   */
  for (const ex of [13, 17]) {
    img.rect(ex, 41, 3, 1, shade('wall', 0));
    if (!blink) {
      img.rect(ex, 42, 2, 2, CAP_LINE);
      img.px(ex, 42, shade('wall', 3));
    } else {
      img.rect(ex, 43, 2, 1, CAP_LINE);
    }
  }

  /*
   * The twig arm, held out with great authority, pointing at nothing in particular.
   *
   * Thin. A twig drawn three pixels wide is a club: the shape that says "branch" is the taper plus
   * the side shoot, not the mass. One shoot now rather than two -- at this length two is a hand.
   */
  taper(img, 19.4, 41 - t, 24.2, 38.6 - t, 1.8, 0.9, shade('wood', 0));
  taper(img, 19.4, 40.6 - t, 24.0, 38.4 - t, 1.0, 0.8, shade('wood', 2));
  taper(img, 22.2, 39.6 - t, 23.6, 37.0 - t, 1.2, 0.8, shade('wood', 0));

  base(img, 11, 21, 47, CAP_LINE);
  img.outline(CAP_LINE);
}

// ----------------------------------------------------------------------------- the magpie

/** His near-black, and the wolf still owns the darker one. See the header on `night`. */
const MAGPIE_DARK: RGBA = keyline('night', 10);
/** The plumage, capped below `night` level 2 so it never reaches Red's purple. */
const PLUMAGE = (t: number): RGBA => {
  const a = shade('night', 0);
  const b = shade('night', 1);
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
    255,
  ];
};

/**
 * Repeats whatever she last overheard, and is holding a bead she is not going to give back.
 *
 * Perched and facing left, 28 across and 22 high, and the proportion IS the character: she is the
 * only thing in the cast whose silhouette is a long horizontal wedge. Section 10.2 spells out what
 * makes it one -- a 14 px tail behind a 12 px body, carried level rather than swept down -- and
 * that is the single change from the old sprite that matters. At 31 x 36 with the tail raked down
 * to the bottom corner she was a dark upright lump with a point on it, which at 24 px is the
 * toadstool, the snail and the owl as well.
 *
 * Three things make a magpie rather than a generic black bird and all three still get real pixels:
 * the white belly, the white flash along the folded wing, and that tail. The belly and the flash do
 * all of the structural work now, because the plumage is a near-flat blue-black by design -- see
 * the note on `night` in the header.
 */
function paintMagpie(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- legs and feet, planted; they never bob ---
  for (const lx of [9, 13]) {
    img.rect(lx, 42, 2, 4, shade('gold', 0));
    img.rect(lx, 42, 1, 4, shade('gold', 1));
    img.rect(lx - 1, 46, 4, 1, shade('gold', 1));
    img.px(lx - 1, 46, shade('gold', 0));
    img.px(lx + 2, 46, shade('gold', 0));
  }

  /*
   * TAIL: level, long, and cut away from the body by a lit line along its whole upper edge.
   *
   * The separation between wing and tail is that line and nothing else at the size a player sees.
   * With the tail painted in the body's own value under a wing painted in the same, the whole back
   * half came back as one dark wedge and the bird read as a puffin.
   */
  taper(img, 14.6, 37.6 + b, 27.2, 38.8 + b, 7.4, 2.8, PLUMAGE(0.1));
  taper(img, 14.6, 37.0 + b, 26.8, 38.0 + b, 5.6, 1.8, PLUMAGE(0.55));
  taper(img, 17.0, 39.4 + b, 27.0, 39.8 + b, 1.2, 1.0, PLUMAGE(0));
  img.px(24, 38 + b, shade('water', 0)); // the sheen a magpie really has: two pixels, not forty
  img.px(25, 38 + b, shade('water', 0));

  // --- body: mass, then the lit cap on the breast ---
  img.ellipse(10.5, 37.0 + b, 5.6, 5.0, PLUMAGE(0.1));
  img.ellipse(9.9, 36.4 + b, 5.0, 4.4, PLUMAGE(0.4));
  img.ellipse(8.6, 34.4 + b, 3.0, 2.6, PLUMAGE(0.75));

  /*
   * White belly, then the black breast painted back over its top. A white ellipse on its own came
   * back as an egg stuck to the bird; what makes it plumage is the hard curved boundary where the
   * black bib ends, which only exists if something is drawn over it afterwards.
   */
  img.ellipse(9.2, 39.6 + b, 4.0, 3.0, shade('fur', 1));
  img.ellipse(8.8, 39.0 + b, 3.4, 2.4, shade('fur', 3));
  img.ellipse(9.6, 34.8 + b, 4.6, 3.0, PLUMAGE(0.4));
  img.ellipse(8.4, 33.6 + b, 2.8, 2.0, PLUMAGE(0.75));

  // --- folded wing over the back, then the white primary flash in one clean wedge ---
  taper(img, 10.4, 33.6 + b, 15.0, 40.4 + b, 5.6, 3.4, PLUMAGE(0.05));
  taper(img, 10.2, 33.2 + b, 14.6, 39.6 + b, 4.4, 2.4, PLUMAGE(0.45));
  taper(img, 13.2, 37.6 + b, 15.0, 41.4 + b, 2.8, 1.8, shade('fur', 3));

  // --- head: a trough under the jaw, or head and breast are one unbroken black lump ---
  img.ellipse(7.2, 31.2 + b, 4.0, 3.8, PLUMAGE(0.1));
  img.ellipse(6.8, 30.8 + b, 3.4, 3.2, PLUMAGE(0.5));
  img.ellipse(5.8, 29.4 + b, 2.0, 1.6, PLUMAGE(0.85));
  taper(img, 4.6, 34.0 + b, 11.4, 35.0 + b, 1.4, 1.2, PLUMAGE(0));

  // --- bill: long and pointed, lit on the upper mandible with a gape line under it ---
  taper(img, 5.4, 32.2 + b, 3.4, 33.0 + b, 2.8, 1.0, PLUMAGE(0.4));
  taper(img, 5.4, 31.8 + b, 3.6, 32.6 + b, 1.6, 0.8, PLUMAGE(0.85));
  img.line(5.0, 33.0 + b, 3.6, 33.4 + b, PLUMAGE(0));

  // --- eye ---
  if (!blink) {
    img.ellipse(6.4, 30.4 + b, 1.7, 1.7, shade('fur', 3));
    img.ellipse(6.7, 30.6 + b, 1.1, 1.1, PLUMAGE(0));
    img.px(6, 29 + b, shade('fur', 3));
  } else {
    img.rect(5, 31 + b, 3, 1, PLUMAGE(0));
    img.rect(5, 30 + b, 3, 1, PLUMAGE(0.7));
  }

  // --- the bead she is not going to give back ---
  img.ellipse(4.2, 36.0 + b, 1.6, 1.6, shade('gold', 0));
  img.ellipse(4.0, 35.8 + b, 1.1, 1.1, shade('gold', 2));
  img.px(4, 35 + b, shade('gold', 3));

  base(img, 7, 16, 47, MAGPIE_DARK);
  img.outline(MAGPIE_DARK);
}

// ----------------------------------------------------------------------------- the snail

/** His keyline: `stone` 0 is luma 96 and outlines nothing (section 13 item 16). This is luma 36. */
const SNAIL_DARK: RGBA = keyline('stone', 60);

/**
 * Delivering a parcel. He set out on Tuesday. It is going very well.
 *
 * LOWEST IN THE CAST at 14 px, which section 10.2 assigns him and the old sprite missed by 27:
 * at 31 x 41 he was taller than the magpie, as tall as the wolf, and the one joke he has -- that he
 * is a very small thing on a very long errand -- was not on screen. A 27 x 14 silhouette is a low
 * horizontal spiral and nothing else in the forest is that.
 *
 * The shell is the loudest shape and gets most of the budget: a real spiral with a groove and a
 * Haze line riding above it, a shell mouth at the lower left that the body visibly goes into, and a
 * lip round the opening. The parcel moved from the TOP of the shell to its back, which is the one
 * thing the new height forced: a box on top is two rows of hat on a fourteen-row animal, and it
 * reads better strapped on anyway.
 *
 * NO LEGS (10.2). The sole is one continuous wedge, not a row of bumps -- the old version stamped
 * six ellipses along the foot and at a glance they were feet.
 *
 * He does not bob. A snail that bobbed would be moving, and the joke is that he is not.
 */
function paintSnail(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0;

  // --- foot: one long low wedge with the head end raised, and nothing that could read as a leg ---
  // The sole is the widest thing on him (10.2 says the shell; the sole is what carries it) and its
  // radius is measured rather than chosen: at 11.8 he came back 26 wide, which is inside the
  // toadstool's width band, and 10.2's own figures for those two share both bands. See BYSTANDER_PLAN.
  img.ellipse(16.4, 43.8, 12.2, 2.4, SNAIL_DARK);
  // The sole keeps `stone` 0 at luma 96 for its face and gives `stone` 2 only a thin lit top edge.
  // Lit across its whole width -- which is how it was drawn when the shell sat 27 rows above it --
  // a luma-180 sole under a luma-230 shell merges into one pale mound, and at 14 px tall the sole
  // and the shell are the only two masses he has.
  img.ellipse(16.0, 43.4, 11.4, 2.0, shade('stone', 0));
  img.ellipse(15.4, 42.9, 10.0, 1.1, shade('stone', 2));
  img.ellipse(7.4, 41.4, 3.6, 3.0, shade('stone', 0));
  img.ellipse(6.9, 40.9, 3.0, 2.4, shade('stone', 2));
  img.ellipse(6.2, 39.8, 1.6, 1.2, shade('stone', 3));

  // --- shell: mass, body, lit upper-left ---
  img.ellipse(19.2, 40.0, 8.4, 5.2, shade('fur', 0));
  img.ellipse(18.7, 39.5, 7.8, 4.6, shade('fur', 1));
  img.ellipse(16.8, 37.8, 4.2, 2.4, shade('fur', 2));

  /*
   * The whorl, and the count of marks is the whole lesson of drawing him at 14 px.
   *
   * At 41 px tall he carried 1.85 turns on three tracks -- two grooves one pixel apart so the curve
   * never broke into dashes, and a Haze line winding in above them. Rebuilt at eleven rows of shell
   * that is not a spiral, it is a filled disc: three tracks at 1.7 turns leave no cream between the
   * turns at all, and the rendered snail came back as a grey and lilac tin. So: ONE groove, ONE and
   * a quarter turns, and the cream of the shell carrying everything between them.
   *
   * The groove is `stone` 0 at luma 96 rather than `fur` 0 at luma 194. `fur` spans 194 to 255, so
   * a groove cut in its own darkest step is 36 luma under a shell that is already near-white --
   * nothing, at this size. The spiral is the one feature 10.2 gives him ("a spiral, no legs"), so it
   * gets a value that can carry it.
   *
   * Section 6a's Haze is now a short lit arc across the shell's upper-left shoulder instead of a
   * second spiral. It is still one line of `cloak` 3 and it lands where the light is.
   */
  whorl(img, 19.6, 40.2, 6.0, 1.25, Math.PI * 0.8, 0, 0.62, shade('stone', 0));
  arc(img, 19.2, 39.6, 6.6, 3.8, Math.PI * 1.08, Math.PI * 1.46, 1, shade('cloak', 3));

  // Shell mouth, with a lip: the body goes IN here, which is what makes it a shell and not a ball.
  img.ellipse(12.8, 41.8, 2.8, 2.0, shade('fur', 0));
  img.ellipse(12.8, 41.9, 2.0, 1.4, shade('stone', 0));

  /*
   * The parcel -- "Parcel for Grandma. I set out on Tuesday." (`content/game.json`) -- strapped to
   * the shell's REAR FLANK rather than across its crown, and down to five pixels by four.
   *
   * It used to sit on top at seven by five with two gold string bands wrapping the whole shell, and
   * at a 14 px snail that is not a parcel, it is a gold cross over the one feature he has: the box
   * and its strapping covered the top of the whorl and the spiral stopped reading. On the flank it
   * still says "carrying something" and the spiral stays whole, which is the trade a small sprite
   * always wants. One string band, running out from under the box down the flank: drawn as an arc
   * that did NOT reach the box it read as a gold clamp bolted on, because a wrapped string has to
   * be seen leaving the thing it is tied to.
   */
  // `arc` interpolates from a0 to a1 the short way round only if a1 > a0: given 1.88pi to 0.12pi it
  // sweeps BACKWARD through 316 degrees and draws a gold hoop round the whole shell, which is what
  // the first version of this did. 2.12pi is the same bearing, said so the sweep is 43 degrees.
  arc(img, 19.4, 40.0, 7.2, 4.2, Math.PI * 1.88, Math.PI * 2.12, 1.4, shade('gold', 0));
  arc(img, 19.4, 40.0, 6.8, 3.8, Math.PI * 1.88, Math.PI * 2.12, 1, shade('gold', 1));
  img.rect(22, 37, 5, 4, shade('wood', 0));
  img.rect(22, 37, 4, 3, shade('wood', 1));
  img.rect(22, 37, 4, 1, shade('wood', 2));
  img.rect(24, 39, 2, 2, shade('wall', 3)); // the label
  img.rect(24, 37, 1, 4, shade('gold', 1)); // string, one pixel of it
  img.px(24, 38, shade('gold', 3)); // the knot

  // --- eye stalks, up and clear of the shell, and thin: a thick stalk is a chimney ---
  const stalk = (x0: number, y0: number, x1: number, y1: number): void => {
    taper(img, x0, y0, x1, y1 + b, 2.0, 1.5, shade('stone', 0));
    taper(img, x0 - 0.4, y0 - 0.4, x1 - 0.4, y1 - 0.4 + b, 1.1, 0.9, shade('stone', 2));
  };
  stalk(7.0, 40.6, 5.6, 37.4);
  stalk(9.6, 40.8, 11.4, 37.6);
  for (const [ex, ey] of [
    [5.6, 36.8],
    [11.4, 37.2],
  ] as const) {
    img.ellipse(ex, ey + b, 1.5, 1.5, shade('stone', 0));
    img.ellipse(ex - 0.3, ey - 0.3 + b, 1.0, 1.0, shade('fur', 3));
    if (!blink) img.px(ex - 0.3, ey - 0.3, shade('stone', 0));
    else img.rect(Math.round(ex) - 1, Math.round(ey) + 1, 3, 1, shade('stone', 0));
  }
  // Lower tentacles, the short pair he actually smells with. Short: any longer and they read as
  // legs, which 10.2 says he does not have.
  taper(img, 6.6, 42.0, 4.6, 43.0, 1.6, 1.0, shade('stone', 0));

  base(img, 6, 27, 47, SNAIL_DARK);
  img.outline(SNAIL_DARK);
}

// ----------------------------------------------------------------------------- the cat

/** Her keyline: `wood` 0 is luma 76, which section 13 item 16 rules out. This is luma 32. */
const CAT_DARK: RGBA = keyline('wood');

/**
 * Sitting, facing out, tail up, entirely uninterested in your errand.
 *
 * NARROW, and that is the whole assignment: 14 px across against the rabbit's 21, 30 tall against
 * his 34. She and the rabbit measured an identical 22 x 44 before this pass, which is the pair the
 * review named -- two upright animals with ears, the same size, in the same forest. The width is
 * what separates them now, and the ears finish the job: hers are short triangles FLUSH with the
 * skull (10.2), his are tall leaves standing up with four pixels of sky between them.
 *
 * The upright tail is her break in the outline. Sitting with the tail curled round the front of her
 * feet -- the old pose -- it ran along the base and widened her to the rabbit's band; up the right
 * side it breaks the top-right corner, which no other character does, and costs two pixels of width
 * rather than nine.
 *
 * Her haunch bars drop from four to three and her whisker dimples from six to four: at twelve
 * pixels of interior width, four bars is a dirty sprite.
 */
function paintCat(img: Img, blink: boolean): void {
  const b = blink ? 1 : 0; // the head and ears dip; the paws and the tail stay planted

  // --- body: mass in shade, inset up-left, lit shoulder ---
  img.ellipse(15.4, 36.4, 4.6, 7.8, shade('wood', 0));
  img.ellipse(14.9, 35.9, 4.1, 7.2, shade('wood', 1));
  img.ellipse(13.6, 31.8, 2.3, 3.2, shade('wood', 2));
  // Haunch, pushed out to the right: a sitting cat is widest at the hip, not at the chest.
  img.ellipse(17.6, 40.2, 3.0, 3.8, shade('wood', 0));
  img.ellipse(17.2, 39.8, 2.5, 3.2, shade('wood', 1));

  // Haunch bars: three of them. Three is a tabby; thirty is a dirty sprite.
  for (const [by, bx0, bx1] of [
    [34.5, 16.2, 20.2],
    [37.5, 16.4, 20.6],
    [40.5, 16.2, 20.2],
  ] as const)
    taper(img, bx0, by, bx1, by + 1.0, 1.8, 1.2, shade('wood', 0));

  /*
   * Cream bib: a wedge under the chin, drawn BEFORE the legs so they crop it into a V. Drawn after
   * them it was a two-pixel stripe running the whole chest, which read as a necktie; the shape a
   * bib actually makes on a sitting cat is the bit of chest the legs do not cover.
   *
   * It starts at row 32 and not a row higher, which at this size is the difference between a bib
   * and a beard. `taper` caps a vertical stroke with a half-disc of its own half-width, so a 6-px
   * bib started at row 29 reaches row 26 -- it filled the bottom two thirds of the FACE with cream,
   * and the rendered cat had no muzzle, just a pale chin running into a pale chest.
   */
  taper(img, 15.0, 32.0, 15.0, 37.0, 6.8, 2.2, shade('wood', 0));
  taper(img, 14.7, 31.8, 14.7, 36.4, 5.8, 1.8, shade('fur', 1));
  taper(img, 14.3, 31.6, 14.3, 35.2, 4.2, 1.4, shade('fur', 2));

  /*
   * Front legs and paws. The grooves matter more than the legs do: drawn in the body's own two
   * levels the whole lower half came back as one brown mass, so each leg gets a level 0 trough down
   * its outer edge and the pair are split by a column of background between them.
   */
  for (const [lx, lit] of [
    [12.8, 1],
    [17.6, 0],
  ] as const) {
    taper(img, lx, 36, lx, 43.4, 3.8, 3.4, shade('wood', 0));
    taper(img, lx - 0.3, 35.7, lx - 0.3, 43.1, 2.8, 2.4, shade('wood', 1));
    if (lit) taper(img, lx - 1.0, 36.2, lx - 1.0, 42.0, 1.2, 1.0, shade('wood', 2));
    img.ellipse(lx, 45.0, 2.6, 1.8, shade('wood', 0));
    img.ellipse(lx - 0.3, 44.6, 2.0, 1.3, shade('fur', 1));
    img.ellipse(lx - 0.6, 44.3, 1.4, 0.9, shade('fur', 2));
    img.px(Math.round(lx) - 1, 45, shade('wood', 0));
    img.px(Math.round(lx) + 1, 45, shade('wood', 0));
  }
  // The column between the legs, and it is the reason there are two of them. `wood` 0 on `wood` 1
  // is 29 luma, which separates a leg from a leg; it does not separate a leg from the ground. The
  // keyline does, and `outline` cannot reach here because the gap never touches the background.
  img.line(15, 36.6, 15, 45.4, CAT_DARK);

  /*
   * The tail, up the right side, and it is drawn LAST over the hip rather than first under it.
   *
   * Drawn first -- so the haunch could lap over its root, which is the usual instinct -- the haunch
   * simply covered it: both are `wood`, the haunch spans x 15..20 and the tail x 17..21, and the
   * finished cat had no tail at all, just a brown plank. Over the hip it reads as what it is, a
   * cylinder lying against the body, and the CAT_DARK groove down its inner edge is the whole of
   * that read.
   */
  img.line(18.0, 26.0, 18.6, 40.6, CAT_DARK);
  taper(img, 19.0, 41.0, 20.4, 25.4, 3.0, 2.4, CAT_DARK);
  taper(img, 18.9, 40.6, 20.3, 25.6, 2.2, 1.6, shade('wood', 1));
  taper(img, 18.7, 40.0, 20.1, 26.4, 1.1, 1.0, shade('wood', 2));

  /*
   * --- ears, and the V between them, which is the whole of her silhouette above the shoulder ---
   *
   * "Flush with the skull, not stalked like the rabbit's" (10.2) does not mean short enough to
   * disappear, and the first attempt at this proved it: with the apexes three rows above a skull
   * that topped out at row 20, and the tabby M's top bar reaching row 19 between them, `outline()`
   * closed the gap completely and she came back as a plain 12 x 30 rectangle -- at 24 px a domino.
   *
   * Three things fix it and all three are measured, not felt. The skull drops a row and flattens,
   * so the ears own rows 19 to 21 outright. The apexes are six pixels apart, because the outline
   * takes one pixel off each facing edge and a six-pixel gap is what leaves four of sky. And the M
   * starts at row 22, on the forehead, where it cannot bridge the two ears.
   */
  const ear = (baseX: number, apexX: number, lit: boolean): void => {
    taper(img, baseX, 23.6 + b, apexX, 19.2 + b, 3.4, 1.2, shade('wood', 0));
    taper(img, baseX - 0.3, 23.4 + b, apexX - 0.3, 19.8 + b, 2.4, 0.9, shade('wood', lit ? 2 : 1));
    taper(img, baseX, 23.2 + b, apexX, 20.2 + b, 1.4, 0.7, shade('skin', 0));
  };
  ear(11.6, 10.8, true);
  ear(18.0, 18.8, false);

  // --- head: flatter than it is wide, which is what buys the ears their three clear rows ---
  img.ellipse(14.8, 25.4 + b, 4.4, 3.8, shade('wood', 0));
  img.ellipse(14.3, 24.9 + b, 3.9, 3.3, shade('wood', 1));
  img.ellipse(12.9, 23.4 + b, 2.2, 1.6, shade('wood', 2));
  // Cheek ruffs, which is why a cat's face is wider than her skull.
  img.ellipse(11.2, 27.4 + b, 2.2, 1.8, shade('wood', 1));
  img.ellipse(18.3, 27.4 + b, 2.2, 1.8, shade('wood', 0));
  img.ellipse(11.0, 27.0 + b, 1.7, 1.3, shade('wood', 2));
  // The tabby M on the forehead: three bars, which is the oldest cat shorthand there is. It starts
  // at row 22 and not a row higher -- see the note on the ears.
  for (const mx of [13, 15, 17]) img.rect(mx, 22 + b, 1, 3, shade('wood', 0));

  // --- face ---
  for (const ex of [11, 16]) {
    if (blink) {
      img.rect(ex, 25 + b, 3, 1, shade('wood', 0));
    } else {
      img.rect(ex, 24 + b, 3, 2, shade('gold', 2));
      img.rect(ex + 1, 24 + b, 1, 2, shade('wood', 0));
      img.px(ex, 24 + b, shade('gold', 3));
    }
  }
  /*
   * Muzzle: two small lobes with a seam between them and a nose above, each lobe on its own shade.
   * One wide pale patch with a dark crescent under it came back as a little mask, and a straight
   * dark bar under it came back as a mouth -- which section 6 forbids outright at this size.
   *
   * The whisker dimples are gone with the height. Four dark pixels in a row across a cream bib is
   * grit, not a muzzle, and at a 7-row face there is no clean row left to put them on.
   */
  for (const mx of [13.4, 16.4]) {
    img.ellipse(mx, 28.0 + b, 1.8, 1.4, shade('wood', 0));
    img.ellipse(mx - 0.3, 27.7 + b, 1.4, 1.0, shade('fur', 1));
  }
  img.px(15, 27 + b, shade('wood', 0)); // the seam between the lobes
  img.px(15, 28 + b, shade('wood', 0));
  img.ellipse(14.9, 26.4 + b, 1.3, 0.9, shade('skin', 0));
  // The jaw line. Head and body are both `wood` and a head on a body in one ramp is a post: the
  // keyline under the chin is the only thing that says where one ends and the other begins, and
  // `outline` cannot help because the join never touches the background.
  img.line(11.6, 29.6 + b, 18.4, 29.6 + b, CAT_DARK);

  base(img, 11, 20, 47, CAT_DARK);
  img.outline(CAT_DARK);
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
