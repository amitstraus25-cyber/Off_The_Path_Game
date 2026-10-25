/*
 * The cast: the four characters who offer Purple something, drawn at 32 x 48.
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
 *    and interior detail is the one thing the playing camera throws away. They are now drawn to the
 *    heights `docs/ART_DIRECTION.md` section 10.2 assigns, which span 26 to 44 here and 14 to 44
 *    across this file and `bystanders.ts` together. `CAST_PLAN` below is the table, the painters
 *    read their own geometry off it rather than repeating numbers, and `assertBodyPlans()` at the
 *    foot of this file refuses to let the art pipeline run if a silhouette drifts out of its box.
 *
 * SILHOUETTE. All four have to be told apart as flat black shapes at the playing camera, and the
 * test is section 10.1's: fill every opaque pixel black, downscale to 24 px, name each one.
 *
 * "THE PLAYING CAMERA" FOUR TIMES IN THIS FILE USED TO READ "a 20-tile camera", AND THAT WAS A
 * FIGURE RATHER THAN A MEASUREMENT. The camera shows 19.41 x 11.22 tiles at 1280x800; `paint.ts`
 * and nine other files simultaneously claimed 26 x 15, which was the field of view of a 1.5x zoom
 * option `packages/core/src/camera.ts` rejects by name. Two different wrong numbers in one
 * generator is how this project lost two rounds. Ask `cameraFor` in `@otp/core`; the silhouette
 * argument above does not depend on the exact figure and is not weakened by dropping it.
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
import { ember, Img, keyline, lumaOf, pull, rose, shade, tone } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';
import { BLINK, BYSTANDER_FRAMES, BYSTANDER_PLAN, BYSTANDER_SEATS, REST } from './bystanders.ts';
import type { Pose, PosedPainter } from './bystanders.ts';
import { seat } from './seat.ts';

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
 *
 * `hue` overrides where the colour comes from without touching how the stroke is shaped or shaded.
 * The warm families -- `rose`, `ember`, `rust` -- are transforms of a ramp rather than ramps of their
 * own, so `Ramp` cannot name them and the rabbit's pink inner ear had no way to reach one. Left
 * undefined it is `tone(ramp, …)` exactly as before, so every existing call renders byte for byte
 * what it rendered; `ramp` stays required so that no call site had to change to gain the parameter.
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
  hue?: (t: number) => RGBA,
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
        const t = lo + (hi - lo) * snap(k, steps);
        img.px(x, y, hue ? hue(t) : tone(ramp, t));
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
 *   what separates him from Purple, so the bbox is what is written down here, with the body width in
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

/** The rabbit's own near-black: the keyline, the grooves and the contact bar. `fur` starts at luma 195. */
const RABBIT_DARK: RGBA = keyline('fur', 165);

/**
 * His grounding shadow (`seat`, sprites/seat.ts): `fur`'s own keyline, held at luma 50 -- a step
 * lighter than `RABBIT_DARK` at 29, so the line and the shade under it read as two things.
 */
const RABBIT_SHADOW: RGBA = keyline('fur', 144);

/**
 * The eye, and it is deliberately NOT `RABBIT_DARK`.
 *
 * Painting the eyes in the value the sprite is outlined in is what made the face read as perforated
 * rather than as looking at you: the highest-contrast feature on a white animal was drawn in the
 * silhouette's own line, so at the playing camera the eyes joined the outline and the head came back
 * as a white shape with two holes in it. `ink` carries a trace of violet, so the eye is a dark
 * glossy bead INSIDE a white face and the keyline stays the darkest thing on the sprite, which is
 * where a keyline belongs.
 *
 * LEVEL 2, NOT LEVEL 1 (2026-10-20, design board section 3: "a value that is NOT the keyline
 * value"). Level 1 is luma 34 against a keyline at 29. Five luma is a different hex and the same
 * ink: nothing at 1x can tell them apart, so the sprite still satisfied the letter of the rule and
 * none of it. Level 2 is luma 52, a 23-luma step, and it costs nothing visible -- against fur at
 * 243 the bead is still 191 luma down, which is as black as the face can tell. Rendered side by
 * side at zoom 22 the two frames are all but identical, which is the point: the metric moved and
 * the picture did not.
 *
 * Worth recording against the board rather than against the prescription: the board's own rabbit
 * draws its eyes in very nearly the black it outlines in (crop `990 565 58 58 10`). What makes them
 * read there is that they are small, rounded and ringed in white, not that they are a different
 * ink. The value step is cheap insurance and it is not what fixed the face.
 */
const RABBIT_EYE: RGBA = shade('ink', 2);

/**
 * The warm family, and the reason he is no longer a white shape with holes in it.
 *
 * `rose`, `ember` and `pull` are `paint.ts`'s, promoted there this round from `w-undergrowth.ts` for
 * exactly this: three painters wanted the warm hues the palette does not carry as ramps, and the
 * bunny is the one where their absence was doing visible damage. They are imported, never
 * re-derived -- the factors inside `rose` were set against `ember`'s gap on a 32 px tile and nothing
 * here may drift from them.
 *
 * Four warm marks, against the board's four:
 *
 *   the inner ear   the biggest warm mass on him; `rose` across a range, so it is passed to `taper`
 *                   as a hue function rather than fixed here -- a mass that turns needs the ramp
 *   RABBIT_NOSE     CRIMSON on the board, and it was a tan dash
 *   RABBIT_MUZZLE   the philtrum and the mouth bar; see its own note for why it is not the nose's value
 *   RABBIT_BLUSH    one pixel on each cheek
 *
 * Why not `skin`, which is what all of them used to be: `skin` is a peach built for faces and hands,
 * and at two pixels on a `fur` ground it is four luma off white. `portraitRabbit` gets away with it
 * because a 64 px portrait gives the inner ear eighty pixels; the sprite gives it eleven. Measured on
 * the old frame, the warmest thing on his face was 19 luma from the fur around it. These sit between
 * 85 and 135 from it, which is what makes them marks rather than smudges.
 */
const RABBIT_NOSE: RGBA = rose(0.86);
const RABBIT_BLUSH: RGBA = rose(0.78);

/**
 * The philtrum and the mouth bar: `rose` at the bottom of its ramp, and the depth is MEASURED.
 *
 * Probing the board's muzzle pixel by pixel says near-black maroon -- (126,5,18) and (94,18,40) at
 * luma 43 -- and acting on that is a mistake this pass made and backed out. The board is drawn at
 * roughly 3.6 image pixels to one of ours, so a single probe reads its sub-pixel detail, not the
 * pixel we have to draw. Averaged 4 x 4 into our own resolution the same muzzle comes back as
 * (182,91,110) at luma 120, (154,52,66) at 84 and (163,88,102) at 112: a MID crimson, which is a
 * different instruction entirely. `rust(0.22)` at luma 73 was drawn from the raw probe and rendered
 * as a chunky brown T -- too dark, and too far towards brown once `wood`'s green came through.
 *
 * `rose(0)` is (201,72,57) at luma 109, inside the board's own averaged range and still unambiguously
 * red. It keeps the whole muzzle in one family, which is what makes nose, stem and bar read as one
 * small warm muzzle.
 *
 * Nose 159 over bar 109 is only fifty luma apart, and that is enough HERE where it was not before,
 * because the old pair fused for a reason that was never about value: a 2 px nose directly above a
 * 2 px mouth of the same width is a 2 x 2 block whatever the two values are. The glyph does the
 * separating now -- 2 px nose, 1 px stem, 4 px bar -- so the values only have to sit in the right
 * place on the ramp.
 */
const RABBIT_MUZZLE: RGBA = rose(0);

/**
 * The garment, in the WARM RED family the toadstool caps and `flower-red` already use -- `ember`,
 * not `cloak`.
 *
 * The board puts a red garment on him and we had nothing on him at all, which is how a white animal
 * with one tan dash became the brightest object in the title frame. Aubergine is Purple's and must stay
 * hers; warm red is already sanctioned world colour in this build, so the answer was never "leave
 * him white". `RABBIT_CLOTH_SEAT` is its keyline, pulled from `gold`'s own outline value by the same
 * transform, so the cloth is ringed the way the basket beside it is ringed and does not bleed into
 * the white hip.
 */
const RABBIT_CLOTH_DARK: RGBA = ember(0.34);
const RABBIT_CLOTH_MID: RGBA = ember(0.64);
const RABBIT_CLOTH_LIT: RGBA = ember(0.92);
const RABBIT_CLOTH_SEAT: RGBA = pull(keyline('gold', 70), 0.32, 0.24);

/**
 * TALL AND NARROW, which is the whole of him: 21 x 34, and fourteen of those rows are ear.
 *
 * The board's rabbit is a chibi -- a head nearly as wide as the body is tall, two broad ears
 * leaning apart with a wide pink inner, two paws, two feet, a round tail, and a face of black oval
 * eyes, a warm nose, a small "w" mouth and a blush on each cheek. All of that is kept. What
 * changed on 2026-10-19 is the PROPORTION, and it is the only thing the playing camera reads: he was
 * 22 x 44, which put him in the same box as the cat and within three rows of Purple, so the forest
 * held three upright figures of one size. At 21 x 34 he is two thirds of Purple's height and the
 * tallest thing on him is a pair of ears with sky between them.
 *
 * THE GAP IS THE SIGNATURE and it has to survive the outline. Section 10.2 asks for 4 px of sky
 * between two 4 px ears; `outline()` eats one pixel off each facing edge, so the ears are drawn
 * with SIX px of air between them and four px of it is still sky in the finished frame. Drawn with
 * a four-pixel gap -- the obvious reading -- the finished rabbit has two pixels of sky and the ears
 * read as one notched slab.
 *
 * HE WAS CREEPY, AND IT WAS THE FACE (2026-10-19, the client's first note on the landing screen;
 * `docs/DESIGN_BOARD.md` section 2 names it pixel by pixel). He is the first living thing a
 * visitor sees, so this is the prescription and the reasoning, against a crop of the board's own
 * rabbit at `955 500 130 130 8`:
 *
 * - **The eyes were a third of the head's height, in the keyline's own value, with no light.** Each
 *   was a 3 x 4 solid ellipse of `RABBIT_DARK` at x 12.8 and 19.2 -- vertically elongated, which is
 *   the shape a NARROWED eye makes, spanning 63% of the face and running out to within a pixel of
 *   the head's outline on both sides. Now: 2 x 2, four columns of ink on a sixteen-column face
 *   (25%), three clear columns of white outside each and five between, a glossy `ink` value that is
 *   not the line the sprite is drawn in, and one light pixel at the outer top of each. The
 *   catchlight is the whole difference between an eye and a hole, and the old docstring's claim
 *   that "the board's are solid dark ovals with no highlight" was simply wrong about the board.
 * - **There was no chin.** The face was crammed into eight rows with the mouth two rows off the
 *   jaw, and every bit of the board rabbit's sweetness lives in the blank white below its mouth.
 *   The head is a row taller and the whole face sits higher in it: five rows of brow above the
 *   eyes, four rows of empty cheek and chin below the mouth.
 * - **The mouth was five near-black pixels in a zigzag**, which at 1x is a bar of stitches. It is
 *   now two, in `RABBIT_MOUTH`, under a two-pixel warm nose.
 * - **He stared.** Both ears were drawn dead vertical and dead parallel, which no live animal does.
 *   The board's lean apart at different angles and the right one is shorter for it. That asymmetry
 *   is the head tilt, bought without moving the head.
 * - **The satchel was a brown gash across a white chest.** A `wood` strap tapering over the ribs to
 *   a lump on the near hip reads at 1x as a wound. The board gives him a woven warm-gold basket on
 *   the BACK, so it is now a `gold` basket behind the far hip, drawn before the body so the body
 *   overlaps it -- the one warm mass on him, and still the point of him: he is the character who
 *   hands Purple a thing.
 *
 * What is NOT changed, because it was right: 21 x 34 and two thirds of Purple; thirteen rows of ear
 * with four px of surviving sky; the splayed feet that make him widest at the base; and the breath,
 * which moves the head, ears and face only -- the body, paws and feet stay planted, which is what
 * makes a one-pixel bob look like breathing rather than like the sprite sliding.
 */
function paintRabbit(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip;
  /**
   * His beat is an EAR TWITCH: the upright left ear's tip flicks out and drops (`pose.beat` 1 is the
   * full flick). Only the tip moves -- the base stays where the four px of sky are measured from --
   * and it flicks OUTWARD, so the sky between the ears only ever widens.
   */
  const tw = pose.beat;

  /*
   * --- the basket, first, so the body laps over it and it reads as carried on the far hip ---
   *
   * Only its right three columns survive the body orb, which is exactly the board's read: a warm
   * lump behind the hip, not a bag hung on the front of the animal. It also sets the sprite's right
   * edge at x 26, which is what keeps the silhouette 21 wide now the tail has moved off that side.
   */
  // Its own dark seat first, a pixel proud of the dome on every side. `outline()` only rings pixels
  // that touch air, so a basket lapped by the body would meet the white hip with no line between
  // them at all and read as a yellow stain on the fur. This is the ring the board puts round it.
  img.ellipse(22.8, 41.6, 2.9, 3.2, keyline('gold', 70));
  orb(img, 22.8, 41.8, 2.3, 2.6, 'gold', 0.14, 0.9);
  // Two courses of weave, dark enough to read as the gap between withies at 1x, held inside the
  // dome so the lit rim survives above them.
  img.rect(22, 41, 3, 1, shade('gold', 0));
  img.rect(22, 43, 3, 1, shade('gold', 0));

  /*
   * --- ears: 4 px wide, 14 rows of the 34, ONE UPRIGHT AND ONE LEANING OUT ---
   *
   * The bases stay centred on 11.4 and 20.6 -- that pair spans x 9..23, wider than the head and
   * narrower than the feet, so the outline reads ear, head, base as three different widths going
   * down, and it is the spacing the four px of surviving sky is measured from. Only the tips move.
   *
   * THE SPLAY IS ASYMMETRIC, and that is the whole of this edit. Crop `975 525 80 70 14`: the
   * board's LEFT ear is dead vertical -- both its edges and its pink run straight up -- and its
   * RIGHT ear leans out about 23 degrees from vertical, so the pair opens into a V. Ours had the
   * left leaning 3.6 degrees out and the right 10.9, which at 1x is two parallel uprights, and an
   * animal with both ears straight up and level is at attention rather than at ease. So: the left
   * tip goes to 11.4, directly over its own base, and the right tip to 24.0.
   *
   * 24.0 IS THE EDGE OF THE BOX, NOT A CHOICE OF ANGLE. The silhouette is 21 wide at x 6..26 and
   * `CAST_PLAN` is locked; the basket already sets x1 = 26. At the tip the stroke's half-width is
   * 1.5, so a tip centre of 24.0 puts its last painted pixel at 25 and `outline()` at 26 -- flush
   * with the basket, no wider. That buys 17.8 degrees against the board's 23, and the remaining
   * five degrees are not available without taking the figure to 22 wide. Raising the right tip a
   * row (17.6 -> 18.4) spends height rather than width on the angle, which the leaning ear owes
   * anyway: an ear tilted away from the camera is shorter in y. The left tip's row is untouched,
   * because it is what sets y0 = 14 and therefore the plan's h = 34.
   */
  const ear = (xb: number, xt: number, yt: number): void => {
    taper(img, xb, 29 + b, xt, yt + b, 4.4, 3.0, 'fur', 0.12, 1);
    /*
     * The inner ear: ON THE EAR'S OWN AXIS, 2.4 at the base down to 0.9 at the point, and stopping
     * two rows short of the tip so white caps it.
     *
     * PINK, not `skin`. It is the largest warm mass on the whole animal -- the thing that stops a
     * white rabbit on a sunlit lawn being the brightest object in the frame. Drawn in `skin` it was
     * a peach four luma off the fur beside it, so eleven pixels of the sprite's best colour were
     * spent on nothing. `rose` is held wide, 0.34 to 0.92, because the ear is the one place on him
     * with room for a mass to turn.
     *
     * THE NUMBERS ARE MEASURED THIS TIME, and the two earlier values were both guessed at zoom.
     * Crop `990 530 42 36 1` -- the board's left ear at 1:1, no upscale to read through -- and
     * classify it by hue. Every row of the ear's body comes back
     * `### WWWW PPPPPPPPPP WWWWW ###`: three of keyline, FOUR of white, ten of pink, FIVE of white,
     * three of keyline. So the pink is 53% of the fur, not the 40% the last pass assumed and not the
     * 68% it actually drew -- and, far more important than the ratio, THERE IS A WHITE COLUMN ON
     * BOTH SIDES OF IT IN EVERY SINGLE ROW. The board's keyline never touches pink anywhere on
     * either ear.
     *
     * Ours did, and that is the whole of what read as raw. At 3.0, and still at 2.5, the same scan
     * of our own sprite came back `# PP W #` through the upper half of the ear: the fur there is
     * only three columns wide, the pink took two of them, and the one it took first was the lit
     * outer column -- so the pink ran into the keyline down the side of the ear that faces the
     * light. A white rabbit whose ear edge is pink has no ear edge; it has a wound. The lower half
     * was always fine, because the ear is four columns wide there and two of pink still leaves one
     * of white on each side.
     *
     * So the fix is not a flat narrowing, it is a TAPER that keeps pace with the fur: 2.4 at the
     * base holds two pink columns where the ear is four or five wide, and 0.9 at the point drops to
     * a single centred column where the ear is only three, which is the only arrangement at this
     * resolution that leaves white on both sides for the ear's whole length. One pink column is a
     * seam when it runs the full ear -- that was the 2.3/1.2 failure -- and it is a point when it is
     * the narrow end of a mass that is two columns wide below it. That is a lozenge, which is what
     * the board draws.
     *
     * No `inset`. It existed to walk the pink off the ear's axis, and with the left ear now vertical
     * it was pushing that ear's pink into the lit keyline rather than away from it. Centred on the
     * axis, the inner leans with the ear it is in -- upright in the left, out at 17.8 degrees in the
     * right -- which is what the board's leaning ear does.
     *
     * `ax()` is why the inner's ends are computed rather than written down. The inner is shorter
     * than the ear at both ends, so its endpoints are not the ear's endpoints: they are the points
     * ON THE EAR'S AXIS at the inner's own two rows. Passing `xb` and `xt` straight through -- which
     * is what this did -- put the inner's base 0.7 px left of the axis in the leaning right ear,
     * and 0.7 px is a whole pixel of pink hanging off the outer side of the ear once it is rounded.
     * That is precisely where the scan found the right ear's keyline touching pink while the left
     * ear's did not, and no width would have fixed it, because the mass was in the wrong place
     * rather than too big.
     */
    const ax = (y: number): number => xb + (xt - xb) * ((29 - y) / (29 - yt));
    taper(
      img,
      ax(26.9),
      26.9 + b,
      ax(yt + 2.2),
      yt + 2.2 + b,
      2.4,
      0.9,
      'skin',
      0.34,
      0.92,
      STEPS,
      rose,
    );
  };
  ear(11.4, 11.4 - 1.6 * tw, 16.3 + 0.8 * tw);
  ear(20.6, 24.0, 18.4);

  // --- body: small, under a big head, and narrow enough to leave the paws against the chest ---
  orb(img, 16, 42.4, 6.4, 4.6, 'fur', 0.0, 1);
  // The turn down his right side. The board's rabbit is white with one grey side, and `fur` is so
  // pale that the rim's own falloff cannot supply it: it has to be painted as its own mass.
  orb(img, 18.6, 42.8, 3.8, 4.0, 'fur', 0.0, 0.3);

  /*
   * Feet, planted, splayed, and never bobbing with the breath. They are what makes him "widest at
   * the base" (10.2): the pair reaches x 7..25, two pixels wider each side than the body above.
   */
  for (const fx of [10.4, 21.6]) orb(img, fx, 44.8, 3.2, 2.2, 'fur', 0.18, 0.9);
  img.line(16, 43.8, 16, 46.2, RABBIT_DARK); // the groove that makes them two feet, not a base

  // Cotton tail, now on the LEFT, where the basket is not. The one thing on him allowed to sit at
  // the top of the ramp.
  orb(img, 9.6, 41.8, 1.9, 1.8, 'fur', 0.5, 1);

  // Front paws against the chest, as the board draws them -- not arms hanging clear of the flanks.
  // At a twelve-row body an arm is three pixels of nothing; two paws and a groove read at once.
  // They sit a row lower than before, because the chin they used to touch now reaches row 39.
  for (const px0 of [13.4, 18.6]) orb(img, px0, 41.2, 2.0, 1.8, 'fur', 0.08, 0.72);
  /*
   * NO GROOVE BETWEEN THE PAWS ANY MORE, and this is the satchel's "dark gash" caught a third time.
   *
   * The groove was `img.line(16, 40.4, 16, 42.2, RABBIT_DARK)`, and it was right when both paws were
   * white and needed telling apart. The garment below covers the right paw entirely, so from the
   * moment the cloth landed the groove's only remaining neighbour was the cloth's own near-black
   * seat one column over at x 17 -- and `RABBIT_DARK` at luma 29 beside `RABBIT_CLOTH_SEAT` at 28
   * is a TWO-pixel near-black column standing between a white chest and a red garment. That is
   * precisely the fault section 2 of the design board convicts the old satchel of ("at 1x a dark
   * gash on a white animal"), in a new hue, at a smaller size, and it was visible at zoom 3.
   *
   * One keyline is a boundary; two side by side is a hole. The seat already rings the cloth on
   * every side, so the read -- white paw, line, red cloth -- survives the groove's removal intact,
   * and `assertFaceMetrics()`' rabbit numbers are untouched because nothing above row 43 moves.
   */

  /*
   * --- the garment, over the near flank, between the white chest and the basket ---
   *
   * The fourth warm mass, and the one that finishes what the inner ears start. The board's rabbit is
   * white PLUS pink inners PLUS a crimson nose PLUS a red garment PLUS a big tan basket: five masses,
   * four of them warm. Ours had one, which is how a white animal with a single tan dash became the
   * brightest object in the title frame -- the client's eye went to the first living thing on the
   * landing screen and found nothing in it.
   *
   * `ember`, not `cloak`. Aubergine is Purple's and is the one colour on this sprite that could make a
   * player wonder which of them is the protagonist. Warm red is already sanctioned world colour here
   * -- the toadstool caps and `flower-red` are this same family -- so the answer was never "nothing".
   *
   * DRAWN AFTER THE PAWS, which is the whole of what went wrong on the first attempt. Put in before
   * them, where the board's white-diagonal-across-the-red looked like it could be had for free from
   * the draw order, the right paw and the right foot both stamped over it and left the cloth as four
   * disconnected fragments with its near-black seat showing between them: not a garment, a spatter,
   * and on a white animal that is the satchel's "dark gash" failure a second time in a new hue. Over
   * the paw it is one mass. Crop `975 590 110 85 11`: the board's cloth covers the rear half of the
   * body from under the shoulder to the hip and the FAR front paw is not visible at all, so covering
   * ours is what the board does, not a compromise. The white left paw survives, the chest groove at
   * x 16 becomes the boundary between it and the cloth, and the read is white paw, red cloth, gold
   * basket across the body -- three masses in three hues.
   *
   * Its bottom is held at row 43 so the right foot still reads in front of it, and its top tucks
   * under the chin at row 39. The seat goes down first, a pixel proud on every side, for the reason
   * the basket's does: `outline()` only rings pixels that touch air, so cloth lapped by a white hip
   * would meet the fur with no line between them and read as a stain in it rather than as something
   * worn on top of it.
   */
  img.ellipse(20.2, 41.0, 3.1, 2.5, RABBIT_CLOTH_SEAT);
  img.ellipse(20.2, 40.9, 2.5, 2.0, RABBIT_CLOTH_DARK);
  img.ellipse(20.0, 40.6, 2.0, 1.6, RABBIT_CLOTH_MID);
  img.ellipse(19.5, 40.1, 1.2, 1.0, RABBIT_CLOTH_LIT);

  // --- head, big and round, in front of the ear bases ---
  // Thirteen rows now, not twelve, and the row is spent entirely on the chin: rows 27..39, with the
  // muzzle finished by row 35. Still flatter in y than in x, which is what leaves thirteen of the
  // thirty-four rows reading as ear against the forty per cent section 10.2 asks for.
  orb(img, 16, 33.0 + b, 7.6, 6.2, 'fur', 0.08, 1);
  // The same turn, on the head -- but kept BELOW the eye line. Centred on the face, as it was, it
  // put the right eye in shade and lit the left, and a face lit unevenly across the eyes is the
  // other half of what the client was looking at.
  orb(img, 20.4, 37.0 + b, 3.4, 3.4, 'fur', 0.0, 0.34);

  /*
   * Eyes: 2 x 2 at columns 12-13 and 19-20, rows 32-33, light in the upper-left pixel of each.
   *
   * The placement is measured off the board rather than reasoned about, because the first pass at
   * this put them a row too high and 6 px apart and he came back sly. On the board crop the head is
   * 57 source px wide and 55 tall; each eye is about 3.75 px, the centres are 24.6 px apart, and the
   * eye centre sits 47% of the way down the head with 42% of it as brow above. Scaled to a 16-column
   * head that is: eyes as small as pixels allow, centres SEVEN columns apart, and the pair on row 33
   * of a head running 27..39 -- five rows of brow over the eyes and four of chin under the mouth.
   * A high brow over low eyes is the whole of the board rabbit's sweetness, and close-set eyes high
   * in the skull is the arrangement that reads as a stare.
   *
   * SOLID, AND WITH NO CATCHLIGHT AT ALL -- the board settles it and the previous pass had it
   * backwards. Crop `940 495 150 160 5`: every eye on the board's rabbit is a small solid dark bead
   * with white showing all the way round it and no light in it anywhere. The 2 x 2 with one lit
   * pixel that replaced the old ellipse was drawn to avoid a squint and bought a frown instead: a
   * lit outer-top pixel leaves three dark pixels in an L, the left one leaning down-right and the
   * right one down-left, so the pair reads as two wedges converging on the nose, which is the glyph
   * for a frown. Four solid pixels cannot lean. The catchlight argument is sound at portrait scale,
   * where `portraitRabbit` has a 4 x 4 pupil to put a light inside; at 2 x 2 the light is a quarter
   * of the eye and it decides the eye's shape rather than wetting it.
   *
   * Blink closes to the lower lid alone rather than to a wider bar: a blink broader than the open eye
   * reads as a wince.
   */
  for (const ex of [12, 19] as const) {
    if (blink) img.rect(ex, 33 + b, 2, 1, RABBIT_EYE);
    else img.rect(ex, 32 + b, 2, 2, RABBIT_EYE);
  }

  /*
   * THE MUZZLE, AND THERE WAS NONE. Three marks, rows 34 to 36, directly under the eyes.
   *
   * The old face had a two-pixel `skin` pad at row 34 and two pixels of `keyline('skin', 70)` at 35,
   * and at 8x those two rows fuse into one small brown block: a tan dash, four rows of blank white
   * below it, and no mouth. A face with eyes and no mouth is the thing being complained about.
   *
   * The board's (`985 570 60 45 18`) is unmistakable at that zoom: a CRIMSON nose, a one-pixel stem
   * dropping out of it, and a dark-red bar wider than the nose at the stem's foot -- the 'ɷ' -- and
   * that mark plus the chin is where all of the sweetness lives. Measured off the crop against a
   * 57 px head: the nose is 18% of the face wide and the bar 30%, so on a fifteen-column face the
   * nose is two columns and the bar four.
   *
   * The symmetry axis is x 16.0 -- the eye centres sit at 12.5 and 19.5 -- so nose and bar are both
   * EVEN widths straddling it, and the stem takes x 16, which is the column the body and foot grooves
   * already run down. An odd-width nose centred on 16.5 put the whole muzzle half a pixel right of
   * the eyes and read as a face turning away.
   *
   * Three rows of muzzle leave three rows of chin rather than four. That is the trade and it is the
   * right way round: the blank rows were the complaint, not the asset.
   */
  img.rect(15, 34 + b, 2, 1, RABBIT_NOSE);
  img.px(16, 35 + b, RABBIT_MUZZLE);
  img.rect(14, 36 + b, 4, 1, RABBIT_MUZZLE);
  /*
   * Blush: ONE pixel on each cheek, level with the nose, one column in from the rim.
   *
   * Quietened by area, because `rose` cannot quieten it by value: its red channel is pinned at 255
   * across the whole upper half of the ramp, so the paler blush the board shows -- a soft wash
   * beside a saturated nose -- is not a tone this family can express. Two pixels each side at
   * `rose(0.78)` came back as bright as the nose itself, and sitting on the stem's row it made the
   * lower face one dashed pink band from cheek to cheek, which is the exact failure the previous
   * pass's note warned about. One pixel, on the nose's row with four blank columns either side of it,
   * is a dot of colour in the cheek and cannot line up into anything.
   */
  for (const cx of [11, 21]) img.px(cx, 34 + b, RABBIT_BLUSH);

  base(img, 7, 25, 47, RABBIT_DARK);
  img.outline(RABBIT_DARK);
  seat(img, RABBIT_DARK, RABBIT_SHADOW);
}

// ----------------------------------------------------------------------------- the owl

/**
 * The owl's pupil, and the single most important value in this file.
 *
 * It is NOT `keyline('trunk')`. Painting an eye in the colour the sprite is outlined in makes the
 * eye the highest-contrast mark on the figure and the face reads as perforated -- the fault the
 * design board names on the rabbit and then again, "and worse", on the owl. At `drop` 24 against
 * the outline's 40 the pupil lands at luma 34 inside a rim at luma 18: still plainly the darkest
 * thing in the face, and no longer the same ink as its own silhouette.
 */
const OWL_PUPIL: RGBA = keyline('trunk', 24);

/**
 * His grounding shadow (`seat`, sprites/seat.ts): `trunk`'s keyline at luma 50, a step lighter than
 * the line at 17 and clear of the pupil at 34, which is a different place and a different job.
 */
const OWL_SHADOW: RGBA = keyline('trunk', 8);

/**
 * The glint, and WHERE it goes is the whole of it (2026-10-20, design board section 3).
 *
 * The value was never the problem and neither was the size: one pixel of `wall` level 3 is right.
 * It was drawn at the pupil's own LEFT COLUMN, so it had the white disc immediately beside it at
 * luma 247 against its own 250 -- three luma apart, which is no boundary at all. At 1x the glint
 * and the sclera were one mass and the pupil was a C opening towards the nose: not an eye with a
 * light in it, a bead with a bite out of it, which is the same failure the previous pass thought it
 * had fixed by shrinking a 2 x 2 highlight to one pixel. A notch is a notch at any size.
 *
 * It is now at the pupil's second column, so pupil encloses it above, below and on both sides, and
 * `assertFaceMetrics()` below measures that enclosure rather than trusting this note.
 */
const OWL_CATCH: RGBA = shade('wall', 3);

/**
 * WIDE AND SQUAT, which is the whole of him: 22 x 26, against the rabbit's 21 x 34.
 *
 * Crop the owl off the board (`648 282 104 118 9`, panel 01, in the crown left of the signpost) and
 * he is one rounded barrel about as wide as he is tall, with no neck, a flat-ish crown, two SMALL
 * pointed tufts at the top corners, two enormous white facial discs, a cream breast and two stubby
 * talons. Measured off the board at roughly 3.3 image pixels to one of ours he comes back about
 * 23 x 29, which is section 10.2's 22 x 26 within a pixel either way.
 *
 * THE EYES ARE THE WHOLE CHARACTER, and the 2026-10-19 board review is blunt about where the last
 * pass went wrong: "two white facial discs with small dark pupils floating inside them, white
 * visible all the way round. Ours fills each disc with a near-black blob under a heavy brow. That
 * one ratio is the whole difference between an owl and a lunatic." Put the two crops side by side
 * and it was worse than that, because of HOW the catchlight was placed. The old code drew the
 * pupil, then stamped a 2 x 2 highlight over its upper-left corner -- so the light was not inside
 * the pupil, it was BITTEN OUT of it, and what was left was a dark wedge sloping down towards the
 * nose on each side. Two inward-sloping dark wedges on a face are not eyes with a glint in them,
 * they are eyebrows, and the owl was scowling. Hence, measured off the board this pass:
 *
 *   - the pupil is ROUND and is 0.47 of the white disc's diameter (board: about 0.55), so a clear
 *     two pixels of white survive all the way round it on every side;
 *   - the catchlight is ONE pixel of `wall` level 3 set INSIDE the pupil, never on its rim, so it
 *     reads as a light in a round eye and cannot cut the shape. The pass that wrote this line put
 *     it on the rim anyway; see `OWL_CATCH`, and `assertFaceMetrics()` now measures it;
 *   - the white disc's floor is raised from 0.35 to 0.6, because at 0.35 its own lower-right went
 *     dingy enough to merge into the dark rim and the "white all the way round" was only true at
 *     the top.
 *
 * The rest of this pass is the board's other owl facts, which the last one had generically: pointed
 * tufts with a lit warm tip rather than two flat-topped posts; a SMALL dark-russet hooked beak
 * rather than a four-pixel bright-gold plug (the old one was the most saturated mark on the sprite
 * and sat dead centre, which is why the face read as a corn cob); the pale gold fringe under the
 * discs that joins the face to the throat; the near wing lapping over the left of the breast with a
 * warm tip at the bottom, which is what pushes the cream breast right of centre exactly as the
 * board has it; and two stubby rounded toes per foot instead of three bright prongs.
 *
 * He keeps `trunk` with a `wall` breast, which is the board's own recipe.
 */
function paintOwl(img: Img, pose: Pose): void {
  // His beat IS the blink, so he has no `beat` of his own: an idle strip shuts his eyes without
  // the dip, which the two-frame sheet never could.
  const blink = pose.blink;
  const b = pose.dip;

  /*
   * --- ear tufts: pointed, leaning out, with the lit tip the board gives them ---
   *
   * They own the top three rows and nothing else, and they are drawn behind the head so the crown
   * laps over their bases -- which is what stops them reading as two things balanced on a ball.
   * Tapering to a true 1.0 (half-pixel radius, so a single column) is what makes them points; the
   * old 1.6 left two pixels at the top and they came out as flat-topped posts, or handles.
   */
  taper(img, 9.8, 29.0 + b, 7.6, 23.6 + b, 3.2, 1.0, 'trunk', 0.1, 0.92);
  taper(img, 22.2, 29.0 + b, 24.4, 23.6 + b, 3.2, 1.0, 'trunk', 0.06, 0.66);
  // The board's tufts finish in a warm lit tip, which is the one thing that tells them from twigs.
  img.px(8, 24 + b, tone('wood', 0.8));
  img.px(24, 24 + b, tone('wood', 0.5));

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

  /*
   * The cream breast. `wall` is the only pale warm ramp in the palette and it is what the board puts
   * here; on `trunk` the breast and the wings are one brown.
   *
   * It is centred on 17.8, not on 16, and that is measured rather than drifted: on the board the
   * breast runs from 35% to 86% of the body's width, because the NEAR WING laps across its left.
   * Centring it put equal brown down both flanks and lost the overlap that makes a folded wing.
   */
  orb(img, 17.8, 39.6, 4.9, 6.0, 'wall', 0.14, 0.68);
  // Mottle: the board's breast is speckled, not a flat cream field. Six pixels is enough at 1x.
  for (const [mx, my] of [
    [15, 37],
    [19, 38],
    [17, 41],
    [21, 41],
    [16, 43],
    [20, 44],
  ] as const)
    img.px(mx, my, tone('wall', 0.04));

  /*
   * The near wing, lapping over the left of the breast and finishing in a rounded tip low on the
   * left -- the board's single clearest piece of owl anatomy and the thing that stops the figure
   * reading as a barrel with a bib painted on it. Its tip carries the board's warm highlight.
   */
  taper(img, 11.0, 32.6, 9.6, 42.8, 6.4, 4.8, 'trunk', 0.14, 0.74);
  orb(img, 9.4, 43.2, 2.2, 1.9, 'wood', 0.26, 0.72);

  // Tail wedge between the primaries.
  orb(img, 16, 45.2, 3.4, 1.8, 'trunk', 0.04, 0.4);

  /*
   * Toes: two short rounded ones per foot, planted, never bobbing with the breath. The board's are
   * stubby tan mittens with the keyline under them. The old three-prong `gold` version read as two
   * forks, and bright gold on the only pair of marks at the sprite's base dragged the eye down off
   * the face.
   */
  for (const fx of [13.0, 19.0] as const) {
    orb(img, fx, 45.6, 2.3, 1.5, 'wood', 0.34, 0.88);
    img.px(Math.round(fx), 46, keyline('trunk')); // the split that makes each a pair of toes
  }

  /*
   * --- the facial discs, which are the owl: four fifths of his head width between them ---
   *
   * THE PUPILS ARE PLACED AS INTEGER PIXELS, not as an ellipse, and that is the whole lesson of the
   * first pass. `img.ellipse` at rx 1.7 rasterised differently for a centre at 11.6 than for one at
   * 20.4, because the two have different sub-pixel phase: one eye came back a ring and the other a
   * hook, and a face whose two eyes are different shapes is the most unsettling thing a sprite can
   * do. Column 10..12 mirrors to 19..21 about the owl's centre line, so the pair is now exactly
   * symmetrical by construction and cannot drift when anything else on him moves.
   *
   * The pupil is 3 wide by 4 tall inside a white disc 7 by 8, which is the board's ratio, and two
   * pixels of white survive on every side of it.
   */
  /*
   * `px0` is the pupil's left column and `lit` the column the glint goes in -- the SECOND one, not
   * the first. They were the same number until 2026-10-20 and that is the whole of what read as a
   * bitten eye; see `OWL_CATCH`. Carried as a pair rather than as `px0 + 1` so the two numbers are
   * visible side by side at the one place a reader will look for them.
   */
  for (const [px0, lit] of [
    [10, 11],
    [19, 20],
  ] as const) {
    const cx = px0 === 10 ? 11.6 : 20.4;
    // The dark rim the board rings the discs in, dropped 0.7 of a row so it shows below and beside
    // the white but NOT above it. Ringed all the way round it read as a heavy brow over each eye.
    orb(img, cx, 31.5 + b, 4.3, 4.5, 'trunk', 0.0, 0.18);
    orb(img, cx, 30.8 + b, 3.6, 3.8, 'wall', 0.6, 1); // the white, which stays white
    if (blink) {
      /*
       * The blink is the most characterful thing about him, so it is a CLOSED eye and not a missing
       * one: the white disc stays, a lid of shaded cream fills its lower half, and one dark lash
       * line runs across the middle with a lit lid fold above. Three marks, and all of them land
       * inside the disc, so the silhouette does not change when he blinks.
       */
      orb(img, cx, 32.0 + b, 3.0, 2.2, 'wall', 0.12, 0.42);
      img.line(cx - 2.9, 30.9 + b, cx + 2.9, 30.9 + b, OWL_PUPIL);
      img.line(cx - 2.4, 29.9 + b, cx + 2.4, 29.9 + b, tone('wall', 0.9));
    } else {
      img.rect(px0, 29 + b, 3, 4, OWL_PUPIL);
      // ONE pixel of light, with pupil on all four sides of it, so it reads as a glint in a round
      // eye and cannot cut the shape. Measured: the glint is luma 250 and the white disc beside the
      // pupil is 247, so anywhere on the pupil's rim the two fuse and the bead becomes a crescent.
      img.px(lit, 30 + b, OWL_CATCH);
    }
  }

  /*
   * The warm throat, drawn AFTER the discs so it caps their lower edge, which is how the board
   * joins the face to the breast: a pale gold band running under both eyes and over the top of the
   * cream. Drawn before them instead, the white disc's bottom pixel survived under the rim and each
   * eye finished in a white pip, like a drip.
   *
   * Kept DARK and narrow. The first pass had it at `hi` 0.86 across 13 pixels, and a bright tan band
   * running the full width of a face under two eyes is a moustache.
   */
  orb(img, 16, 34.9 + b, 4.4, 1.7, 'wood', 0.2, 0.52);

  /*
   * The beak: small, hooked, and dark russet, sitting LOW in the gap between the discs -- level with
   * their bottom third, which is where the board puts it. Two pixels wide narrowing to one, in the
   * bottom of `wood`, the board's own beak colour: a near-maroon brown, not gold. The old pass had
   * it as a four-pixel bright `gold` plug dead centre, the most saturated mark on the sprite, and
   * the face read as a corn cob.
   *
   * No lit top edge. One was tried this pass to make it project and it read as a bright pip stuck
   * between the eyes -- at two pixels wide there is no room for a highlight AND a form, and the form
   * is the one that matters. It projects because it is darker than the head behind it.
   *
   * It is placed as explicit pixels, and it is WIDER THAN THE BRIDGE on purpose. The two white discs
   * leave a two-pixel brown bridge at x 15..16, and a beak drawn inside that bridge -- which is what
   * a `taper` at 2.6 gives -- is indistinguishable from the bridge: the pair read as one long dark
   * stripe down the middle of the face, a nose rather than a beak. The board's beak notches a pixel
   * into the inner white of BOTH discs, which is what makes it a separate object, and three rows is
   * all it gets, so it stays short against a head that is six rows deep between the eyes.
   */
  img.rect(14, 33 + b, 4, 1, tone('wood', 0.2));
  img.rect(15, 34 + b, 2, 1, tone('wood', 0.04));
  img.px(16, 35 + b, keyline('wood', 18)); // the hook

  base(img, 7, 25, 47, keyline('trunk'));
  img.outline(keyline('trunk'));
  seat(img, keyline('trunk'), OWL_SHADOW);
}

// ----------------------------------------------------------------------------- the lantern keeper

/** His near-black: the hood's inside, the badger's mask, the grip, and the keyline. */
const KEEPER_DARK: RGBA = keyline('roof');

/**
 * His grounding shadow (`seat`, sprites/seat.ts): `roof`'s keyline at luma 50, a step lighter than
 * `KEEPER_DARK` at 29.
 */
const KEEPER_SHADOW: RGBA = keyline('roof', 19);

/**
 * The eye, and the two values of the lantern caught in it.
 *
 * At module scope because `FACE_PLAN` at the foot of this file measures the drawn face against
 * them. A guard that re-derives a colour the painter also derives is a guard that silently stops
 * measuring the thing it names the moment one of the two moves.
 *
 * `KEEPER_EYE` is a real step above `KEEPER_DARK` -- luma 54 against the outline's 30 -- for the
 * reason the design board gives about the rabbit: an eye painted in the value its own silhouette is
 * drawn in makes the face read as perforated.
 */
const KEEPER_EYE: RGBA = keyline('wood', 22);
const KEEPER_CATCH_NEAR: RGBA = tone('gold', 0.22);
const KEEPER_CATCH_FAR: RGBA = tone('gold', 0.08);

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
 * Purple's basket. It stays on the left here, deliberately and against the letter of that line: with
 * both on the right the two tallest figures in the game break their outline on the same side at
 * roughly the same height, and the keeper's one job is to not be mistaken for Purple. Flipping him is
 * a one-line change to the pole, the hand and the rim loop if a director would rather have the
 * letter.
 *
 * THE INVERSION (2026-10-19, design board section 3). Three passes tried to make this face read and
 * all three failed the same way, and the board finally names the cause rather than the symptom:
 * "The Lantern Keeper is the creepiest sprite in the game and the client has not seen it yet. A grey
 * hood over a dark head with a pale blaze and two dark marks in it is a skull in a cowl at 48px,
 * whatever the marks are." Put the render beside that sentence and it is exactly what was there --
 * a near-black hood interior at `roof` 0.00..0.06, a `fur` head at luma 195..255 glowing out of it,
 * a hard band of shade across the brow and two solid near-black 2 x 2 eyes. The previous docstring
 * concluded from this that the badger mask was too fine to survive at nine pixels. That conclusion
 * is wrong and it is what kept the sprite broken: the mask was never the problem. A pale blaze
 * inside a dark hole is a skull whether or not it has stripes.
 *
 * So the values are inverted, which is the board's own prescription in four parts:
 *
 *   1. A LIGHTER HOOD. Its floor goes from 0.10 to 0.32 and the opening's from 0.00 to 0.07, so the
 *      hood is a mid grey with a shaded interior rather than a black void with a hole in it. (This
 *      one was only half done; the opening went to 0.30..0.50 a round later. See below.)
 *   2. VISIBLE WARM FUR. The head moves off `fur` -- which is the rabbit's near-white and was 130
 *      levels of luma above the hole it sat in -- onto the top half of `wood`. At luma 115..180 it
 *      is plainly an animal's head, and it is now INSIDE the hood's own band rather than glowing
 *      out of it. Nothing on him is near-white any more except the lantern flame.
 *   3. A LEGIBLE MUZZLE, longer, lit on top with a cream stripe and finishing in a dark nose, so
 *      the thing projecting from the hood is a snout and not a jaw.
 *   4. THE LANTERN CAUGHT IN THE EYES. One pixel of `gold` level 2 in the upper-left of each eye.
 *      It is a single pixel and it does more than everything else here: it is the difference
 *      between two holes in a face and two eyes looking at the lamp they are carrying. The eye's
 *      dark is `keyline('wood', 22)` and not the outline's value, for the reason the board gives
 *      about the rabbit -- an eye painted in the colour its own silhouette is drawn in makes the
 *      face read as perforated.
 *
 * No forehead blaze. The board asks for warm fur and a legible muzzle and does not ask for the mask
 * back, and the one marking that has never failed here is the cream on the snout, so the badger is
 * carried by the muzzle alone. He is the character who carries the thesis; he cannot be the one
 * players flinch at.
 *
 * THE SECOND HALF OF THE INVERSION (2026-10-20, review). The pass above did parts 3 and 4 and only
 * announced parts 1 and 2, and the reviewer's note is exact: "HE IS STILL A PALE BLAZE INSIDE A
 * DARK HOOD. The hood is unchanged grey, there is no visible warm fur anywhere on him." Both halves
 * were measurable and both were true.
 *
 *   THE STRIPE WAS THE BLAZE. Measured on the render at 231 luma, the brightest mass on the sprite
 *   after the flame itself -- on a snout, under a hood, which is lighting from below. `wall` at
 *   0.22..0.60 is simply too far up a ramp whose own FLOOR is luma 175. It is now 0.02..0.28, which
 *   renders 178..207: inside the 180..211 the review asked for, still plainly cream against fur, and
 *   no longer the thing the eye lands on. The order of brightness on the face is now stripe 207,
 *   lit fur 178, catch 150 -- the order the note requires, and the order it is on a live animal.
 *
 *   THE DARK HOOD WAS THE OPENING, NOT THE DOME. This is the part worth writing down, because the
 *   obvious fix is wrong. The dome was already a mid grey at luma 112..182; what sat against the
 *   face was the OPENING, `roof` 0.07..0.26, luma 78..104 -- a dark ring two pixels thick all the
 *   way round the head. That ring is what made a warm face read as a blaze in a hole, and it is now
 *   0.30..0.50, luma 108..129. Lightening the DOME instead was tried first and made it worse twice
 *   over: at 0.52..1.00 the hood went paler than the face and read as a bouffant or a bonnet, and
 *   the garment split into a pale hat on a darker coat when the board draws hood and cloak as one
 *   material. The dome is back near where it was, 0.32..0.88.
 *
 *   AND THE FUR IS BIGGER. See the note at the head orb: the reviewer could not see warm fur
 *   because nine pixels of it ringed by its own garment is not a mass.
 *
 * MEASURED AGAINST THE BOARD, which never drew this character, so the comparison is to the only
 * hooded figure it does draw -- Purple, crop `770 625 110 130 8`. Hers is the relationship to copy: a
 * mid-value hood and a face at a similar value above it, separated as much by HUE as by brightness,
 * with no dark ring between them. On the board her hood peaks at luma 187 and her face at 221, a
 * gap of 34; here the hood peaks at 156 and the lit fur at 178, a gap of 22, with the rest of the
 * separation carried by warm brown against neutral grey. Matching her gap by MEAN was tried and
 * abandoned: her hood is saturated scarlet, which carries a low value without reading as gloom,
 * and a neutral grey taken to the same luma just makes him grim again.
 *
 * COAT COLOUR. He is painted from `roof`, the one ramp in the palette no character owns and a warm
 * neutral, which is what makes gold the only saturated colour on him. He was once `night`, whose
 * top two steps are byte-identical to Purple's cloak, so the forest held two purple-hooded figures.
 */
function paintKeeper(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip;
  /*
   * HIS BEAT IS THE LANTERN FLICKERING: `pose.beat` 1 flares the flame a row taller and the panes a
   * step brighter, 2 gutters it short and dim, and the light it throws on his coat follows. Every
   * offset below is exactly zero at 0, so the two-frame sheet is untouched.
   */
  const flare = pose.beat === 1 ? 1 : 0;
  const gutter = pose.beat === 2 ? 1 : 0;
  const CX = 20;
  /** The nose pad: below the fur ramp, a step under the eye, still clear of the keyline. */
  const NOSE: RGBA = keyline('wood', 30);
  /** The mouth corner: lighter than the pad, so the two do not fuse into one blob. */
  const MOUTH: RGBA = keyline('wood', 16);

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
  taper(img, 15.6, 25.6 + b, 13.2, 30.6 + b, 5.0, 3.8, 'roof', 0.22, 0.62);

  // Hood: a dome, with a back-swept point. Without the point the dome is a bald head, and in
  // silhouette it is the one mark that says the grey mass is cloth he is wearing.
  orb(img, CX - 0.4, 22.6 + b, 7.6, 2.4, 'roof', 0.26, 0.5); // collar, under the hood
  orb(img, CX + 0.2, 13.2 + b, 7.6, 7.8, 'roof', 0.32, 0.88);
  taper(img, 24.2, 11.6 + b, 27.2, 8.6 + b, 4.4, 1.6, 'roof', 0.22, 0.56);

  /*
   * --- the badger, three-quarter, looking down at his own lantern ---
   *
   * The opening is cut first, then the head is set into it. The head is a real mass with its own
   * rounding, not a flat patch, so it sits INSIDE the hood rather than on it. What has changed is
   * the VALUES, not the construction: the opening used to run 0.00..0.06, which on `roof` is a hole
   * at luma 72, and the head used to be `fur` at luma 195..255 inside it. See the inversion note.
   */
  orb(img, 18.8, 17.6 + b, 6.2, 5.2, 'roof', 0.3, 0.5); // the opening: shaded cloth, not a void

  /*
   * The head, and it is BIGGER than it was -- 5.0 x 4.4 against 4.2 x 3.7, about half as much fur
   * again (2026-10-20, review: "there is no visible warm fur anywhere on him").
   *
   * There was fur, and the reviewer still could not see it, which is the useful part of the note:
   * at 4.2 x 3.7 inside an opening of 6.2 x 5.2 the fur was a nine-pixel island with a two-pixel
   * ring of cloth all the way round it, and a mass that small ringed by its own garment reads as a
   * face painted on the front of a hood rather than as an animal inside one. Growing the head
   * thins that ring to a single pixel at the top and lets the fur reach the hood's edge at the
   * cheeks, so the warm mass is continuous with the muzzle that comes out of it.
   *
   * A cheek ruff spilling out of the hood's lower right was tried first and backed out: at this
   * size a warm wedge at muzzle height on the far side of the face is a SECOND SNOUT, and the
   * render came back with two brown protrusions and no way to tell which one had the nose on it.
   * More of the same mass is worth more than a new shape.
   */
  orb(img, 18.4, 18.3 + b, 5.0, 4.4, 'wood', 0.52, 0.96); // the head: warm fur, plainly an animal

  /*
   * The brim's shade: a band across the top of the face, in the FACE's own ramp rather than the
   * hood's. Drawn from `roof` at 0.00..0.10 it was a hard near-black bar laid across a pale blaze,
   * which is the single mark that made him a skull. In `wood` at 0.14..0.40 it is a shaded forehead
   * under a brim -- still the darkest part of the face, still doing the job of keeping a ring of
   * hood visible above it, and no longer a slot cut in a bone.
   */
  orb(img, 18.4, 15.6 + b, 4.2, 1.8, 'wood', 0.32, 0.56);

  /*
   * The hood's own edge, round the top of the opening: an arc is what puts the face INSIDE the hood
   * rather than on the front of it. Drawn in `KEEPER_DARK` it ringed the face in near-black and read
   * as a cowl shadow, so it is a mid-dark `roof` now -- the shape was always right, the value was
   * the horror.
   */
  for (let a = -2.5; a <= 0.6; a += 0.08)
    img.px(18.8 + 5.9 * Math.cos(a), 17.6 + b + 5.0 * Math.sin(a), tone('roof', 0.34));

  /*
   * The muzzle, out of the bottom of the hood and pointing down at his own lantern: lit warm fur on
   * top, a cream stripe along it -- the one badger marking that has ever survived at this size --
   * shade underneath so the plane below reads as lower than the plane above, and a dark nose pad at
   * the tip. It is deliberately longer than the old one and it finishes BELOW the hood's opening,
   * so what breaks the hood's lower edge is a snout.
   *
   * THE NOSE, AND WHY THE LAST ONE WAS NOT THERE (2026-10-20, review). The note returned on the
   * previous pass was blunt and correct: "THERE IS NO NOSE AND NO MOUTH -- the muzzle is a cream
   * vertical blaze that ends in nothing, so the face still has no centre." There WAS a nose in the
   * code: an `orb` at the snout tip drawn from `wood` at 0.0..0.05. The bug is that `tone('wood', 0)`
   * IS the ramp's darkest stop at luma 75, and it was laid on the shaded underside plane, which ran
   * luma 75..103 -- so the nose was drawn in the same value as the thing it was drawn on, one pixel
   * inboard of a keyline at luma 29. Measured on the render it was invisible, and a nose that is
   * invisible is a nose that does not exist.
   *
   * Two things fix it and both are about value rather than shape. The pad is now an explicit
   * `keyline('wood', 30)` -- luma 45, BELOW the ramp, which is the only place a nose can live on a
   * fur-coloured snout -- and the underside plane it sits on is lifted from 0.08..0.26 to 0.20..0.42
   * (luma 94..117), so the tip of the snout is a shaded jaw with a black nose on it rather than one
   * undifferentiated dark smudge. The pad is two pixels square at the blaze's foot and two pixels
   * inboard of the silhouette, so `outline()` cannot absorb it; the single mouth pixel hooking back
   * from its lower corner is as much mouth as four pixels of jaw can carry, and it is what turns the
   * pad from a dot into a face.
   */
  orb(img, 18.8, 19.9 + b, 3.2, 1.4, 'wood', 0.2, 0.46); // the shadow the brow casts on it
  taper(img, 18.2, 20.4 + b, 14.6, 23.0 + b, 3.8, 2.6, 'wood', 0.52, 1);
  // The cream stripe, and it is held at the very BOTTOM of `wall` on purpose. 0.40..0.88 rendered
  // luma 190..240 and 0.22..0.60 rendered 178..231 -- and 231 was still the brightest mass on the
  // sprite after the flame, which on a snout under a hood is a face lit from below. `wall`'s own
  // floor is luma 175, so there is no such thing as a dim stripe on this ramp and the only lever is
  // how little of it is used. 0.02..0.28 renders 178..207, inside the 180..211 the 2026-10-20 review
  // set, and it keeps stripe over lit fur over catch: 207, 178, 150.
  taper(img, 18.0, 20.0 + b, 14.9, 22.1 + b, 1.8, 1.4, 'wall', 0.02, 0.28);
  taper(img, 18.4, 22.3 + b, 15.2, 24.1 + b, 2.2, 1.8, 'wood', 0.2, 0.42); // the plane underneath
  img.rect(14, 22 + b, 2, 2, NOSE); // the nose pad, at the foot of the stripe
  img.px(16, 23 + b, MOUTH); // and the corner of the mouth, hooking back under the cheek

  /*
   * EYES, on warm fur with fur visible all round them, and the lantern in each.
   *
   * Two dark eyes on a pale field is the oldest signal there is and it is still the construction
   * here; what was wrong was that the field was bone and the eyes were the outline's own near-black,
   * so the pair read as holes punched through a skull. `KEEPER_EYE` is a real step lighter than the
   * keyline -- 54 against 30 -- and the gold is the lamp he is carrying reflected back.
   *
   * THE VALUES WERE RIGHT AND THE SHAPE WAS NOT (2026-10-20, design board sections 2 and 3). The
   * previous pass chased brightness: the catch came down from `shade('gold', 2)` to `tone('gold',
   * 0.22)` and `tone('gold', 0.08)`, luma 151 and 130, so the order on the face is stripe 207, fur
   * 178, catch 151, which is the order it is on a live animal and is worth keeping. In the same
   * move it took the pupil to TWO WIDE BY THREE TALL to get the catch enclosed on three sides. That
   * is the measurement the board uses to convict the rabbit -- "a solid ellipse, TALLER THAN IT IS
   * WIDE, which is the shape a narrowed eye makes" -- applied to a face a third the rabbit's size,
   * and it rendered exactly as that sentence predicts: two vertical slots with a spark in each. The
   * enclosure was bought with the one property of an eye that decides whether it is open or narrowed.
   *
   * So the pupil is 2 x 2 -- square, never taller than wide, the same shape the rabbit's is -- and
   * the catch takes its upper-left pixel. That pixel touches fur on two sides, which the previous
   * pass was right to want to avoid and wrong to pay for in aspect: measured, the catch is 151
   * against lit fur at 174 and brow fur at 123, so it stands 23 and 28 luma clear of both and
   * cannot fuse into either. `assertFaceMetrics()` measures that clearance. The owl's glint is
   * enclosed outright because a 3-wide pupil has an inside; a 2-wide one does not, and inventing
   * the width to satisfy the rule is how the slot got here.
   *
   * BOTH catches sit on the LEFT. Mirroring them is what turns two lit corners into a frown (see the
   * rabbit's eye note); matching them makes the pair one glance, and the lamp is on his left, so the
   * glance is at the thing he is carrying.
   *
   * Losing the third row also buys back the gap the previous pass worried about: at rows 17..18 the
   * eye's foot is a clear row above the cream stripe's crown at row 19, so the two cannot fuse into
   * one mark running from brow to nose.
   */
  if (blink) {
    // Lids a pixel wider than the pupil on the OUTER side only, so the two of them stay symmetric
    // about the bridge and leave two pixels of fur between: a lid that runs inward instead closes
    // the gap and the pair becomes one dark band across the eyes, which is the badger mask again.
    // On the pupil's LOWER row, which is where a closing lid finishes -- at row 19, below the open
    // eye entirely, it was a line under the face rather than a shut one.
    img.rect(15, 18 + b, 3, 1, KEEPER_EYE);
    img.rect(20, 18 + b, 3, 1, KEEPER_EYE);
  } else {
    img.rect(16, 17 + b, 2, 2, KEEPER_EYE);
    img.rect(20, 17 + b, 2, 2, KEEPER_EYE);
    img.px(16, 17 + b, KEEPER_CATCH_NEAR); // the lantern, caught in the near eye
    img.px(20, 17 + b, KEEPER_CATCH_FAR); // and dimmer in the far one, which is turned away
  }

  /*
   * The light the lantern throws, taken BEFORE the pole and the lamp are drawn.
   *
   * It walks the silhouette's own left contour and lands solid gold pixels on the objects, never a
   * halo in the air, so it never needs an alpha to fade out. Running it last -- which is where it
   * used to be -- meant it also found the POLE, which lies left of the coat for most of its run, and
   * painted it gold a pixel at a time: the pole came out as a dotted gold chain rather than as the
   * wooden stick the silhouette depends on. Taken here, the pole is drawn over the rim instead,
   * which is also what a stick held in front of a lit coat actually does.
   */
  for (let y = 17; y <= 36; y++) {
    for (let x = 7; x < 20; x++) {
      if (img.get(x, y + b)[3] === 0) continue;
      if (x > 7 && img.get(x - 1, y + b)[3] !== 0) break;
      /*
       * Brightest level with the lamp at row 23 and falling away from it, rather than the old
       * cosine, which alternated bright and dim every two rows and read as a zip up his front.
       *
       * It is also confined to rows 17..36 and held DARK, between tone 0.02 and 0.22. Run from row 9
       * to row 45 at up to 0.52 it traced the hood's whole left contour and then the coat's all the
       * way to the hem, in a saturated mid gold -- and a continuous bright line up the edge of a
       * hood and down the front of a coat is not light falling on cloth, it is gold braid sewn onto
       * it. The lamp hangs over rows 15..29; this is the span it can plausibly reach.
       */
      const lit = 0.22 + 0.04 * flare - 0.06 * gutter;
      img.px(x, y + b, tone('gold', Math.max(0.02, lit - Math.abs(y - 23) * 0.022)));
      break;
    }
  }

  // --- the pole, and the lantern that is the whole point of him ---
  taper(img, 11.8, 32 + b, 5.2, 16.6, 2.2, 1.8, 'wood', 0.12, 0.8);

  /*
   * The hand. A cuff where the sleeve ends, then the paw closed over the pole, then a groove across
   * it: at four pixels wide that is as much as fingers can be, and it is enough -- without it the
   * pole passes through him and he is standing next to a lantern rather than carrying one.
   */
  /*
   * The paw is the SAME FUR AS THE FACE, which it was not: drawn from `fur` at 0.12..0.72 it came
   * back at luma 200..240, the one remaining near-white mass on him besides the flame, and a
   * bone-pale hand on the end of a grey sleeve is the skeleton the inversion was supposed to remove.
   * On `wood` it is his own paw, and it matches the muzzle it is nine pixels away from.
   */
  orb(img, 13.4, 30.2 + b, 2.6, 2.2, 'roof', 0.16, 0.5); // cuff
  img.line(12.0, 28.6 + b, 12.6, 32.0 + b, keyline('wood', 20)); // where the cuff ends, paw begins
  orb(img, 11.2, 30.8 + b, 2.2, 1.9, 'wood', 0.46, 0.96); // paw, closed over the pole
  orb(img, 12.4, 29.4 + b, 1.2, 1.1, 'wood', 0.62, 1); // thumb, over the top of it
  img.line(9.8, 30.8 + b, 12.6, 30.8 + b, keyline('wood', 20)); // one groove: at four px that is fingers

  /*
   * The lantern, hung at SHOULDER HEIGHT (10.2) -- centred on row 23, where the collar is -- and
   * clear of the coat's left edge, which the bell keeps at x 10 or beyond for the whole of its run.
   */
  img.frame(4, 15, 3, 3, shade('wood', 0)); // hanging ring
  taper(img, 2.0, 19.0, 8.2, 19.0, 2.8, 2.8, 'wood', 0.1, 0.8); // cap
  orb(img, 5, 23.4, 3.8, 4.4, 'gold', 0.05, 0.6); // the frame
  orb(img, 5, 23.4, 2.8, 3.4, 'gold', 0.55 + 0.1 * flare - 0.12 * gutter, 1 - 0.1 * gutter); // panes
  img.rect(5, 20, 1, 7, shade('gold', 0)); // mullions, which the flame passes in front of
  img.rect(2, 23, 7, 1, shade('gold', 0));
  // The flame, the brightest thing in the frame: taller when it flares, a stub when it gutters.
  orb(
    img,
    5,
    23.8 - 0.5 * flare + 0.4 * gutter,
    1.4 - 0.3 * gutter,
    2.1 + 0.6 * flare - 0.6 * gutter,
    'wall',
    0.6,
    1,
  );
  taper(img, 2.0, 27.8, 8.2, 27.8, 2.8, 2.8, 'wood', 0.08, 0.7); // base

  base(img, 13, 28, 47, KEEPER_DARK);
  img.outline(KEEPER_DARK);
  seat(img, KEEPER_DARK, KEEPER_SHADOW);
}

// ----------------------------------------------------------------------------- the wolf

/**
 * The predator, and the title of the game. LOW AND LONG: 30 x 30, and the only horizontal back
 * line in the cast.
 *
 * He was 32 x 41 -- as tall as Purple and almost as tall as the keeper -- which is a dog standing up,
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
   * --- ears: broad-based triangles rising to a SINGLE-PIXEL POINT, barely leaning out ---
   *
   * The board does draw this wolf, which the previous passes did not have: he is the silhouette in
   * the lit window of the Arrive frame, `2468 1298 120 98 9`. Crop it and the head is a deep navy
   * mass -- not black, which is what validates the `wolf` and `ink` ramps -- and the one feature
   * that makes it a wolf at a glance is a pair of TALL, SHARPLY POINTED, NEARLY UPRIGHT ears with a
   * deep notch between them. Ours tapered to `w1` 2.2, which is a 2 px blunt tip, and leaned 1.8 px
   * outward over four and a half rows, so the pair read as two rounded nubs on a dome: a bear.
   *
   * So `w1` is 1.2 -- a true single-column point, the same correction the owl's tufts needed -- and
   * the outward lean is halved. The tips rise 0.6 of a row, which keeps the idle silhouette inside
   * `CAST_PLAN`'s 30 x 30 to within the one pixel `assertBodyPlans()` allows, and it is the only
   * change made to the wolf this pass: the design board says of him "the wolf is right, leave him",
   * and the pose, the horizontal back, the ramps, the amber eye and the flat frames 2 and 3 are all
   * untouched. Sharper tips also INCREASE the frame 3 bonnet clearance rather than eating it.
   *
   * On `head`, not `mass`, so that on frame 3 the two tips standing clear above the bonnet are lit
   * fur rather than black -- they are the tell that the thing in the bonnet is not Grandma.
   *
   * They need `lift` as well as `head`, and the reason is a property of `taper` worth knowing
   * before using it for anything thin. Its shading comes from the offset perpendicular to the
   * stroke, and the cubic rim term takes the outermost pixels down hard. On a four-pixel limb that
   * is a soft edge; on an ear tapering to a point there IS nothing but rim, so every pixel of the
   * tip gets the full darkening and the ear comes out near-black however bright its ceiling is.
   * Against a cream bonnet that read as two notches cut out of the hat rather than as ears.
   */
  head((r, lo, hi) => {
    taper(img, 9.6, 24.6, 8.4, 19.5, 4.4, 1.2, r, ...lift(lo, hi, 0.3, 0.9));
    taper(img, 14.8, 24.2, 16.0, 19.3, 4.4, 1.2, r, ...lift(lo, hi, 0.2, 0.68));
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
  'npc-rabbit-0': (img) => paintRabbit(img, REST),
  'npc-rabbit-1': (img) => paintRabbit(img, BLINK),
  'npc-owl-0': (img) => paintOwl(img, REST),
  'npc-owl-1': (img) => paintOwl(img, BLINK),
  'npc-lantern-keeper-0': (img) => paintKeeper(img, REST),
  'npc-lantern-keeper-1': (img) => paintKeeper(img, BLINK),
  'npc-wolf-0': (img) => paintWolf(img, 0),
  'npc-wolf-1': (img) => paintWolf(img, 1),
  'npc-wolf-2': (img) => paintWolf(img, 2),
  'npc-wolf-3': (img) => paintWolf(img, 3),
};

/**
 * The three spawned members of the cast by sprite key, posable, for the idle and hop strips. The
 * wolf is not here: he is never spawned on the map and has his own four frames.
 */
export const CAST_POSED: Record<string, PosedPainter> = {
  'npc-rabbit': paintRabbit,
  'npc-owl': paintOwl,
  'npc-lantern-keeper': paintKeeper,
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
 * reporting it afterwards. That is still the reason this lives here, and it is unchanged.
 *
 * THE ASK THIS PARAGRAPH USED TO RECORD HAS BEEN DONE. It said `tools/graybox` had no `test` script
 * and that CI did not run `pnpm graybox`, so nothing ran these guards; both halves are now false.
 * `tools/graybox/test/art-guards.test.ts` imports `CAST_FRAMES` from this module, and because the
 * two calls at the foot of this file run at MODULE SCOPE, that import is what runs them -- so a
 * drifted body plan fails `pnpm test` in CI as well as failing the bake.
 *
 * It checks the two things finding 19 is about, and nothing else:
 *
 *   1. every idle silhouette fills its plan box (`CAST_PLAN` plus `BYSTANDER_PLAN`), within a pixel on each axis;
 *   2. no two silhouettes share BOTH a width band (+-4) and a height band (+-6), which is section
 *      10.2's assignment rule and the mechanical half of 10.1's "name each one".
 *
 * Purple is deliberately NOT in the set. She is painted in `char-purple.ts`, which this pass does not
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

// ------------------------------------------------------- the seat (the client's round, 2026-10-25)

/** The line and the grounding shadow each spawned member of the cast is seated with. */
const CAST_SEATS: Record<string, { readonly line: RGBA; readonly shadow: RGBA }> = {
  'npc-rabbit': { line: RABBIT_DARK, shadow: RABBIT_SHADOW },
  'npc-owl': { line: keyline('trunk'), shadow: OWL_SHADOW },
  'npc-lantern-keeper': { line: KEEPER_DARK, shadow: KEEPER_SHADOW },
};

/** What `assertSeats()` reads back off one painted frame. */
export interface SeatMetrics {
  /** Of the rows whose rightmost pixel is the line, the share where the pixel inside it is too. */
  right: number;
  /** The same on the left, the lit side, which must stay a one-pixel line. */
  left: number;
  /** Of the columns standing on the contact bar, the share whose foot row is the line as well. */
  foot: number;
  /** Pixels of the character's own grounding shadow in the bottom three rows. */
  shadow: number;
}

/**
 * Measured off the frame, never off `seat.ts`: what a player sees is a band down the right and
 * along the foot, a single pixel on the left, and a dark wedge under the heel.
 */
export function measureSeat(name: string): SeatMetrics {
  const seatOf = { ...CAST_SEATS, ...BYSTANDER_SEATS }[name];
  const paint = ({ ...CAST_FRAMES, ...BYSTANDER_FRAMES } as Record<string, (img: Img) => void>)[
    `${name}-0`
  ];
  if (!seatOf || !paint) throw new Error(`${name}: no seat, or no frame to measure`);
  const img = new Img(32, 48);
  paint(img);
  const is = (x: number, y: number, c: RGBA): boolean => sameColour(img.get(x, y), c);
  const { line, shadow } = seatOf;
  let rightRows = 0;
  let rightTwo = 0;
  let leftRows = 0;
  let leftTwo = 0;
  for (let y = 0; y < img.h - 2; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < img.w; x++)
      if (img.get(x, y)[3] !== 0) {
        if (a < 0) a = x;
        b = x;
      }
    if (b <= a) continue;
    if (is(b, y, line)) {
      rightRows++;
      if (is(b - 1, y, line)) rightTwo++;
    }
    if (is(a, y, line)) {
      leftRows++;
      if (is(a + 1, y, line)) leftTwo++;
    }
  }
  let standing = 0;
  let footLine = 0;
  let dark = 0;
  const bottom = img.h - 1;
  for (let x = 0; x < img.w; x++) {
    if (is(x, bottom, line) && img.get(x, bottom - 1)[3] !== 0) {
      standing++;
      if (is(x, bottom - 1, line)) footLine++;
    }
    for (let y = bottom - 2; y <= bottom; y++) if (is(x, y, shadow)) dark++;
  }
  return {
    right: rightRows ? rightTwo / rightRows : 0,
    left: leftRows ? leftTwo / leftRows : 0,
    foot: standing ? footLine / standing : 0,
    shadow: dark,
  };
}

/**
 * The gate for the client's "make them stand out from the grass" (2026-10-25), beside the other two
 * and armed the same way: at module scope, so `pnpm graybox` cannot bake a character without its
 * seat and `tools/graybox/test/art-guards.test.ts` fails in CI if one goes.
 *
 * THE BOUNDS ARE THE SHIPPED FRAMES' WITH HEADROOM, and each is set where the art WITHOUT the seat
 * fails it. Measured on 2026-10-25, without the seat and then with it:
 *
 *   right - left  -0.04..0.17 without (one pixel all round: the two sides nearly match), 0.39..0.86
 *                 with, the cat lowest
 *   foot          0.00..1.00 without -- the snail was already planted on two rows -- 0.90..1.00 with
 *   shadow        0 without: nothing else in the frame is painted in that colour; 3..8 with
 *
 * So a seat taken off any one painter trips the first and the third for that character by name, and
 * taking off only the band or only the shadow trips the one that belongs to it -- both were done by
 * hand on 2026-10-25 and watched to fire for all seven. The foot is held at 0.8, under the lowest
 * shipped figure with room for a pixel of redraw: a foot row that is mostly NOT the line is a figure
 * the band no longer seats, which is the half of the band the first check cannot see.
 */
export function assertSeats(): void {
  const faults: string[] = [];
  for (const name of Object.keys({ ...CAST_SEATS, ...BYSTANDER_SEATS })) {
    const got = measureSeat(name);
    if (got.right - got.left < 0.25)
      faults.push(
        `${name}: the right edge is two pixels deep on ${(got.right * 100).toFixed(0)}% of its rows ` +
          `and the left on ${(got.left * 100).toFixed(0)}%; the shade side has lost its band ` +
          `(ART_DIRECTION section 3.2)`,
      );
    if (got.foot < 0.8)
      faults.push(
        `${name}: only ${(got.foot * 100).toFixed(0)}% of the foot row is the line, under 80%; ` +
          `the figure is no longer seated on two pixels`,
      );
    if (got.shadow < 1)
      faults.push(
        `${name}: no grounding shadow in the bottom three rows (PIXEL_STANDARD section 3)`,
      );
  }
  if (faults.length)
    throw new Error(
      `The cast has come off its seat -- the client's 2026-10-25 round, "players cannot find ` +
        `the characters":\n  ${faults.join('\n  ')}`,
    );
}

// ------------------------------------------------- the face plan (design board sections 2 and 3)

/**
 * What the design board measures when it says "creepy", turned into numbers the build checks.
 *
 * Section 2 convicts the rabbit arithmetically rather than by taste -- "each eye is a third of the
 * head's height, the pair spans 63% of the face width, both are vertically elongated, and
 * `RABBIT_DARK` is the identical value the sprite is outlined in" -- and section 3 then convicts
 * the owl on the same three counts, "and worse". Three passes have since fixed those numbers by
 * hand, and nothing in this repo was watching them: `assertBodyPlans()` guards the silhouette's
 * BOX, which is the one property of a face that stays correct while the face goes wrong. A 3 x 4
 * keyline-valued eye could go back in tomorrow and every gate in the build would stay green.
 *
 * So the four numbers are measured off the rendered frame, not off the source:
 *
 *   area       the eye's ink as a share of the opaque face, which is section 2's "a third of the
 *              head's height" in the form a painter can measure
 *   span       the pair's outer span over the face's width -- section 2's 63%
 *   tall       the taller eye's height over its width. Section 2: "TALLER THAN IT IS WIDE, which
 *              is the shape a narrowed eye makes". The owl is allowed past 1 because his pupil
 *              sits in a disc that is itself taller than wide; nobody else is
 *   lift       the eye's luma above the keyline's -- section 2's "the identical value the sprite
 *              is outlined in", which is lift 0
 *
 * And a fourth this pass added, because it is the shape the fault actually took when I rendered it:
 *
 *   clearance  the smallest luma step from a glint pixel to an opaque neighbour that is not the
 *              eye. The owl's glint sat on the pupil's left column against a white disc at 247 with
 *              its own 250, so the light did not land IN the eye, it opened a notch out of it and
 *              the bead read as a crescent. Three luma. A catchlight that cannot be told from what
 *              it touches is not a catchlight.
 *
 * THE CAPS ARE THIS ROUND'S MEASUREMENTS WITH HEADROOM, not targets to drift up to. Each is
 * commented with the value that would have to come back for it to fire, so the next painter can see
 * what the number is holding shut rather than guessing. Raising one is a decision to be argued in
 * the diff; the board's own failing numbers are in the comments to argue against.
 *
 * The wolf is not in this table. The board says "the wolf is right, leave him", his eye is amber on
 * purpose and his whole point is reading as a silhouette, so a guard built out of the rabbit's
 * problem has nothing true to say about him.
 */
interface FaceWatch {
  /** The pupil's value, taken from the painter's own constant rather than re-derived. */
  readonly eye: RGBA;
  /** Every value the glint is drawn in. Empty when the eye carries no light. */
  readonly light: readonly RGBA[];
  /** The value the sprite is outlined in. */
  readonly line: RGBA;
  /** The face: the box the head fills in the 32 x 48 frame, inclusive at both ends. */
  readonly box: {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
  };
  readonly maxArea: number;
  readonly maxSpan: number;
  readonly maxTall: number;
}

const FACE_PLAN: Record<string, FaceWatch> = {
  // area 0.040 -- the board's own 3 x 4 ellipse pair measures 0.099 here. span 0.563 against
  // section 2's 63%. lift 22.6; it was 5.1 until this round and 0 before that.
  'npc-rabbit-0': {
    eye: RABBIT_EYE,
    light: [],
    line: RABBIT_DARK,
    box: { x0: 8, x1: 23, y0: 27, y1: 39 },
    maxArea: 0.06,
    maxSpan: 0.6,
    maxTall: 1,
  },
  // area 0.136 -- "a near-black blob filling the disc", which is what section 3 describes, measures
  // about 0.5. span 0.75, and an owl's eyes are meant to be far apart. tall 1.33 in a disc that is
  // 7 x 8. clearance is enclosed outright: a 3-wide pupil has an inside and the glint is in it.
  'npc-owl-0': {
    eye: OWL_PUPIL,
    light: [OWL_CATCH],
    line: keyline('trunk'),
    box: { x0: 8, x1: 23, y0: 26, y1: 36 },
    maxArea: 0.18,
    maxSpan: 0.8,
    maxTall: 1.4,
  },
  // area 0.089 -- the 2 x 3 slot this round removed measures 0.133, so the cap holds that shut on
  // area as well as on aspect. tall 1.0 exactly, which is the whole edit. lift 24.7.
  'npc-lantern-keeper-0': {
    eye: KEEPER_EYE,
    light: [KEEPER_CATCH_NEAR, KEEPER_CATCH_FAR],
    line: KEEPER_DARK,
    box: { x0: 14, x1: 23, y0: 14, y1: 22 },
    maxArea: 0.11,
    maxSpan: 0.65,
    maxTall: 1,
  },
};

/** An eye has to clear its own outline by this much, in luma. Section 2's fault is lift 0. */
const MIN_LIFT = 12;

/** And a glint has to clear whatever it touches by this much. The owl's notch was 3. */
const MIN_CLEARANCE = 12;

export interface FaceMetrics {
  /** Pupil and glint pixels together. */
  eye: number;
  /** Opaque pixels inside the face box. */
  head: number;
  /** `eye / head`. */
  area: number;
  /** The pair's outer span in columns, over the face box's width. */
  span: number;
  /** The taller eye's height over its own width. */
  tall: number;
  /** The eye's luma minus the keyline's. */
  lift: number;
  /** The smallest luma step from a glint to an opaque neighbour outside the eye; `Infinity` when
   *  there is no glint, or when the glint has pupil on all four sides. */
  clearance: number;
}

const sameColour = (a: RGBA, b: RGBA): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/**
 * The four numbers, read back off the painted frame.
 *
 * Off the FRAME and not off the source, because every fault the board names is a property of what
 * landed in the PNG: a 2 x 2 eye whose glint merges with the sclera beside it is the wrong shape in
 * the file however square the rectangle in the code was.
 */
export function measureFace(name: string): FaceMetrics {
  const watch = FACE_PLAN[name];
  const paint = CAST_FRAMES[name];
  if (!watch || !paint) throw new Error(`${name}: no face plan, or no frame to measure`);
  const img = new Img(32, 48);
  paint(img);

  const eye: [number, number][] = [];
  const light: [number, number][] = [];
  let head = 0;
  for (let y = watch.box.y0; y <= watch.box.y1; y++)
    for (let x = watch.box.x0; x <= watch.box.x1; x++) {
      const c = img.get(x, y);
      if (c[3] !== 0) head++;
      if (sameColour(c, watch.eye)) eye.push([x, y]);
      else if (watch.light.some((k) => sameColour(c, k))) light.push([x, y]);
    }
  const all = [...eye, ...light];
  if (!all.length) throw new Error(`${name}: the face plan found no eye inside its own box`);

  const xs = all.map((p) => p[0]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const mid = (lo + hi) / 2;
  // The two eyes, split at the midline of their own span. A face with one eye, or with both on one
  // side of the bridge, has no aspect worth quoting and is reported as unbounded.
  const aspect = (side: [number, number][]): number => {
    if (!side.length) return Infinity;
    const sx = side.map((p) => p[0]);
    const sy = side.map((p) => p[1]);
    return (Math.max(...sy) - Math.min(...sy) + 1) / (Math.max(...sx) - Math.min(...sx) + 1);
  };

  const inEye = new Set(all.map(([x, y]) => `${x},${y}`));
  let clearance = Infinity;
  for (const [x, y] of light) {
    const self = lumaOf(img.get(x, y));
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
      if (inEye.has(`${nx},${ny}`)) continue;
      const n = img.get(nx, ny);
      if (n[3] === 0) continue;
      clearance = Math.min(clearance, Math.abs(lumaOf(n) - self));
    }
  }

  return {
    eye: all.length,
    head,
    area: all.length / head,
    span: (hi - lo + 1) / (watch.box.x1 - watch.box.x0 + 1),
    tall: Math.max(aspect(all.filter(([x]) => x < mid)), aspect(all.filter(([x]) => x > mid))),
    lift: lumaOf(watch.eye) - lumaOf(watch.line),
    clearance,
  };
}

/**
 * The gate, beside `assertBodyPlans()` and for the same reason.
 *
 * Sprite art reaches the game through one door -- `pnpm graybox` imports this module to write
 * `apps/game/src/assets/npc-*.png` -- so throwing here means a face that has drifted back towards
 * the board's four complaints cannot be baked into the assets at all. That is still why the gate is
 * here. The vitest spec this paragraph asked for exists: see the note on `assertBodyPlans()`, which
 * names `tools/graybox/test/art-guards.test.ts` and how the module-scope calls arm it.
 */
export function assertFaceMetrics(): void {
  const faults: string[] = [];
  for (const name of Object.keys(FACE_PLAN)) {
    const want = FACE_PLAN[name]!;
    const got = measureFace(name);
    const say = (what: string, is: string, cap: string): void => {
      faults.push(`${name}: ${what} is ${is}, over ${cap}`);
    };
    if (got.area > want.maxArea)
      say(
        'the eye',
        `${(got.area * 100).toFixed(1)}% of the face`,
        `${(want.maxArea * 100).toFixed(0)}% -- design board section 2, "a third of the head's height"`,
      );
    if (got.span > want.maxSpan)
      say(
        'the eye pair',
        `${(got.span * 100).toFixed(1)}% of the face width`,
        `${(want.maxSpan * 100).toFixed(0)}% -- design board section 2, "the pair spans 63%"`,
      );
    if (got.tall > want.maxTall)
      say(
        'the eye',
        `${got.tall.toFixed(2)} times as tall as it is wide`,
        `${want.maxTall.toFixed(2)} -- design board section 2, "the shape a narrowed eye makes"`,
      );
    if (got.lift < MIN_LIFT)
      faults.push(
        `${name}: the eye is only ${got.lift.toFixed(1)} luma above its own keyline, under ${MIN_LIFT} ` +
          `-- design board section 2, "the identical value the sprite is OUTLINED in"`,
      );
    if (got.clearance < MIN_CLEARANCE)
      faults.push(
        `${name}: the glint is only ${got.clearance.toFixed(1)} luma from something beside it that ` +
          `is not the eye, under ${MIN_CLEARANCE}; it is cutting a notch rather than lighting a bead`,
      );
  }

  if (faults.length)
    throw new Error(
      `The cast's faces have drifted back towards docs/DESIGN_BOARD.md sections 2 and 3:\n  ` +
        faults.join('\n  '),
    );
}

assertBodyPlans();
assertFaceMetrics();
assertSeats();
