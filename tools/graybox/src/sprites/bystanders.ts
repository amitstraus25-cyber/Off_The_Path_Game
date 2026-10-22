/*
 * The four bystanders, drawn at 32 x 48.
 *
 * None of them offers a skill, none is ever scored, and nobody will stop to inspect one. They exist
 * so the forest reads as inhabited rather than as a test level with four quiz stations in it. That
 * makes them cheap to get wrong and cheap to get right: the whole job is four silhouettes that are
 * instantly nameable at the playing camera and charming for the two seconds anyone looks.
 *
 * THE SIZE IS THE DRAWING (2026-10-19, UX review finding 19). These four used to stand as tall as
 * Purple: the snail, whom `docs/ART_DIRECTION.md` section 10.2 puts LOWEST in the cast at 14 px, was
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
 *     reaches the world through Purple, the wolf, the toadstools, the flowers, the stall awning and
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
 *   - the magpie is black and white: `fur` for the white, and -- as of 2026-10-20 -- a NEUTRAL
 *     near-black keylined off `stone` for the black. She has now been through all three near-blacks
 *     the palette can reach. `ink` is reserved by `docs/PIXEL_STANDARD.md` section 4 for the wolf,
 *     who is the one character meant to read as a flat silhouette, and a second near-black bird in
 *     the same ramp makes that reservation mean nothing. `night` was the answer to that and it was
 *     a violet: the design board's 2026-10-20 note is "it is currently purple-black rather than
 *     black, the same ink family as Purple's cloak", which is exactly what #1a1026 to #2d1b3d is.
 *     `keyline('stone', 64..30)` runs #1f1f21 to #3e3e43, luma 31 to 66 -- a cool grey-black that
 *     is nobody else's hue, with enough range for the lit crown the board gives every mass, and
 *     with its keyline at luma 22 still clear of `ink` 0 at 16, so the wolf keeps the darkest mass
 *     in the game. See the note over `MAGPIE_DARK` for the full argument.
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
import { clamp01, Img, keyline, mix, pull, rust as rustTone, shade } from '../paint.ts';
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

// ------------------------------------------------------------------------------- the pose

/**
 * One pose of a character, which is what every painter here and in `cast.ts` now draws.
 *
 * THE TWO LEGACY FRAMES ARE TWO POSES, and that is the whole of why this exists. Every character's
 * frame 1 did two things at once -- shut the eyes AND dipped a pixel (the head, the twig, the
 * stalks) -- because a two-frame sheet had room for one change. The idle and hop strips
 * (`sprites.ts`) need the breath without the blink and the blink without the breath, plus one beat
 * that is the character's own, so the three are separate fields and `REST` and `BLINK` are the two
 * old frames spelled as poses. Those two draw byte for byte what the boolean drew: every beat below
 * enters its painter as an offset that is exactly zero at rest.
 */
export interface Pose {
  /** Eyes shut. */
  readonly blink: boolean;
  /** The one-row breath: whatever this character moves when it breathes dips a row. */
  readonly dip: 0 | 1;
  /** The character's own beat, signed; 0 is at rest. What it moves is up to the painter. */
  readonly beat: number;
}

/** Frame 0 of every two-frame sheet: open eyes, at rest. */
export const REST: Pose = { blink: false, dip: 0, beat: 0 };
/** Frame 1 of every two-frame sheet: the blink and the dip together, as the boolean drew them. */
export const BLINK: Pose = { blink: true, dip: 1, beat: 0 };

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
 * THAT ASK HAS BEEN ANSWERED. This paragraph used to end "Kept deliberately duplicated rather than
 * exported from a tile module: a sprite reaching into `tiles/` would invert the layering. If a third
 * caller ever wants it, it belongs in `paint.ts`." Both `rust` and `pull` now live in `paint.ts`,
 * which every painter already imports and which imports nothing but `node:zlib`, so the sprite
 * reaches sideways rather than into `tiles/` and the layering is intact.
 *
 * The private copy is gone and the pixels did not move. `paint.ts`'s `rust(t)` sweeps the continuous
 * ramp where this sprite wants the four discrete stops, and `tone('wood', i / 3)` is exactly
 * `shade('wood', i)` -- i / 3 * 3 round-trips to each of 0, 1, 2 and 3 exactly in IEEE doubles, so
 * `Math.floor` lands on the stop itself and the interpolation term is zero. Checked rather than
 * assumed: all four levels come back [107,38,14], [154,58,23], [192,79,36], [220,101,55], which are
 * the RGBAs the two lines deleted here produced.
 */
const rust = (level: 0 | 1 | 2 | 3): RGBA => rustTone(level / 3);
const CAP_LINE = pull(keyline('wood'), 0.62, 0.52);

/**
 * Convinced he is a signpost. A T: 22 px of cap over a 6 px stem, 18 px tall in all, which is the
 * lowest thing in the forest apart from the snail.
 *
 * He was 31 x 40 -- a mushroom the height of a wolf -- and the cost was not only that he broke his
 * own row in section 10.2 but that he broke the joke: a toadstool is funny because it is a small
 * thing with opinions, and at Purple's height he was a tree. Everything above the stem is still cap,
 * so the silhouette is a toadstool before the face is read at all, and the face plus the pointing
 * twig are what turn it into somebody with a view about where you should be going.
 *
 * At a six-pixel stem the face is two eyes and a brow bar and that is the whole budget
 * (docs/PIXEL_STANDARD.md section 6: two pixels of eye, no mouth). The spots drop from five to
 * three for the same reason -- five on a cap this size is gravel.
 *
 * He is rooted and never bobs. The blink moves the twig arm a pixel instead, which is the only tell
 * that the thing addressing you is the mushroom and not something behind it.
 *
 * HIS BEAT IS THE CAP, which wobbles a whole pixel sideways on the stem (`pose.beat`, signed). The
 * stem, the ring and the face stay planted, so it reads as a hat settling and not as the mushroom
 * sliding; the gills and the spots travel with the cap because they are on it.
 */
function paintToadstool(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const t = pose.dip;
  const w = pose.beat;

  /*
   * --- stem: a short tapered column with a swollen base, lit down the left ---
   *
   * Eight columns wide rather than six. The face has to fit inside it with a clear column of stem
   * down each side -- at six the two eyes took four of them and the pair sat against the silhouette
   * edge, where `outline` crowds them and they read as two notches rather than as a face.
   */
  for (let y = 38; y <= 46; y++) {
    const hw = 3.6 + (y > 43 ? (y - 43) * 0.45 : 0);
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, shade('wall', 1));
    img.rect(left, y, 2, 1, shade('wall', 2));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  // --- the ring: the torn veil, flared wider than the stem and catching light on its top face ---
  for (let y = 39; y <= 40; y++) {
    const hw = 5.0 - (y - 39) * 1.2;
    const left = Math.round(16 - hw);
    const right = Math.round(16 + hw);
    img.rect(left, y, right - left, 1, y === 39 ? shade('wall', 3) : shade('wall', 1));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  /*
   * --- cap: full mass in shade, body inset up-left, the lit quarter kept to the top-left ---
   *
   * THE LEVELS MOVED UP ONE, because the claim that this cap and the tile's were "the same mushroom
   * at two sizes" turned out to be measurably false. A value census of both: the keyline agrees
   * exactly (#331408, luma 28 on each), and the deep shade agrees within three levels -- but the
   * TILE's dome carries its body between luma 95 and 121, where this sprite's cap proper was `rust`
   * 1 at luma 83, below everything the tile paints. One step darker over the cap's largest area, and
   * on grass beside the tile the two did read as one species in two ages.
   *
   * So the cap proper is `rust` 2 at 108, which is inside the tile's band; the lit quarter is
   * `rust` 3 at 131, a touch above it, which is what a sprite with twice the diameter is for; the
   * shaded flank comes up off the keyline onto `rust` 1 at 83, which gives the dome a third step
   * where it only had two; and `rust` 0 at 56 stays as the pixel proud of everything.
   *
   * The rim light is now the same value as the lit quarter. That is not a loss -- a rim and the lit
   * face of the same dome under one light ARE the same value -- and with the body at 108 there is no
   * step left above `rust` 3 that is not a pink.
   */
  dome(img, 16 + w, 38, 9.6, 7.0, rust(0));
  dome(img, 15.4 + w, 37.4, 9.0, 6.4, rust(2)); // the cap proper
  dome(img, 13.6 + w, 35.4, 5.6, 4.0, rust(3)); // the lit quarter only
  // The shaded flank: a crescent down the low right, where the dome turns away from the light.
  for (let y = 33; y <= 37; y++) {
    const dy = (y + 0.5 - 37.4) / 6.4;
    const half = 9.0 * Math.sqrt(Math.max(0, 1 - dy * dy));
    const edge = Math.round(15.4 + w + half);
    img.rect(edge - 2, y, 2, 1, rust(1));
  }
  // Rim light along the very top of the dome, one pixel thick and no more.
  for (let x = 8 + w; x <= 19 + w; x++) {
    const dx = (x + 0.5 - (15.4 + w)) / 9.0;
    const y = Math.round(37.4 - 6.4 * Math.sqrt(Math.max(0, 1 - dx * dx)));
    img.px(x, y + 1, rust(3));
  }

  /*
   * Gills: the SHADOW under the brim, and three ticks in it. Not a comb.
   *
   * This used to be a dark tick every second pixel right across the brim, nineteen pixels of
   * alternating dark and cream, and rendered at size it was a row of five white squares with gaps
   * between them sitting directly above the two eyes -- which reads as a mouth full of teeth, on a
   * face that is supposed to be friendly. A brim is a dark band with a little structure in it; the
   * band does the work and the ticks only hint at what it is made of.
   *
   * CAP_LINE rather than `rust` 0: the tile takes its gills a full keyline under the cap's own
   * darkest, and at this size the brim needs that gap or the band vanishes into the flank.
   */
  img.line(6 + w, 38, 25 + w, 38, CAP_LINE);
  img.rect(9 + w, 39, 14, 1, CAP_LINE);

  // Spots: a dark seat, a mid face, a cream core inset up-left, so each one sits on the curve.
  // `wall` rather than `fur`, which is what the live tile spots this cap with: the cottage cream
  // rather than a near-white, so the mushroom reads as one material at both sizes.
  for (const [sx, sy, r] of [
    [11, 34, 2.4],
    [19, 33, 2.1],
    [22, 36, 1.7],
  ] as const) {
    img.ellipse(sx + w, sy, r, r * 0.9, rust(0));
    img.ellipse(sx + w - 0.3, sy - 0.4, r - 0.5, (r - 0.5) * 0.9, shade('wall', 1));
    img.ellipse(sx + w - 0.7, sy - 0.8, r - 1.1, (r - 1.1) * 0.9, shade('wall', 2));
  }

  /*
   * Face, well inside the stem so the outline never eats an eye.
   *
   * It did not read at all before this pass, and both reasons were measurable. The brow was
   * `wall` 0 on a `wall` 1 stem -- 41 luma, which is nothing at six pixels -- and the eyes sat
   * directly under it, so brow and eye were one 3-row dark mark that the brim's own shadow then
   * swallowed. Now the brow is CAP_LINE, the same dark the brim is drawn in, and there is a clear
   * row of lit stem between it and the eye: brow, stem, eye, then three rows of blank stem below.
   * Those three rows are the toadstool's cheek and chin, and they are where the whole expression
   * lives -- the same finding the design board made about the rabbit's missing chin.
   */
  for (const ex of [13, 17]) {
    img.rect(ex, 41, 2, 1, CAP_LINE);
    if (!blink) {
      img.rect(ex, 43, 2, 2, CAP_LINE);
      img.px(ex, 43, shade('wall', 3));
    } else {
      img.rect(ex, 44, 2, 1, CAP_LINE);
    }
  }

  /*
   * The twig arm, held out with great authority, pointing at nothing in particular.
   *
   * IT HAS TO BE IN CLEAR AIR, AND IT HAS TO START OUTSIDE THE STEM. It was drawn from inside the
   * stem up and to the right into the rows the cap occupies, so every pixel after the first two was
   * painted over the cap's own shaded flank, in `wood` against `rust`: what rendered was a brown
   * smudge on the mushroom's right cheek -- no arm, no point, no gesture, and the one thing that
   * makes him a character rather than scenery simply absent. Dropping it to the stem's own rows was
   * worse, because at 1.8 px the root then landed on top of the right eye.
   *
   * So it is held LEVEL, at rows 41 to 42, leaving the stem's right edge at x 20 and running out to
   * x 26 -- open sky from the cap's brim (row 39, out to x 22) all the way down. A level arm is also
   * the funnier one: a signpost's arms are horizontal, and he is convinced he is a signpost.
   *
   * Thin. A twig drawn three pixels wide is a club: the shape that says "branch" is the taper plus
   * the side shoot, not the mass. One shoot -- at this length two is a hand.
   */
  taper(img, 20.2, 42.4 - t, 26.0, 41.8 - t, 1.8, 0.9, shade('wood', 0));
  taper(img, 20.2, 42.0 - t, 25.8, 41.5 - t, 1.0, 0.8, shade('wood', 2));
  // The side shoot goes DOWN. Raised, it ran into the two rows directly under the brim, where the
  // brim's own dark and the outline that follows it swallowed every pixel of it; below the arm it is
  // in open grass and it is the mark that makes the limb a twig rather than a stick.
  taper(img, 23.0, 42.2 - t, 24.2, 44.0 - t, 1.2, 0.8, shade('wood', 0));

  base(img, 11, 21, 47, CAP_LINE);
  img.outline(CAP_LINE);
}

// ----------------------------------------------------------------------------- the magpie

/*
 * `mix` IS NOW `paint.ts`'s, AND IT DOES NOT CLAMP. This file's private copy did.
 *
 * The unclamped body is the one that was promoted, because five of the six copies were unclamped and
 * some of their callers extrapolate past a ramp stop on purpose; promoting the clamping body would
 * have moved pixels in files that had nothing to do with this merge. So the clamp had to come back
 * somewhere, and the honest place is the one caller whose argument is not a literal.
 *
 * It was already dead code, which is worth recording so nobody deletes it as such later: `mix` has
 * exactly three call sites here, two of them constants at 0.45 and 0.66, and the third is `PLUMAGE`
 * below, whose seventeen call sites all pass literals between 0 and 0.74. Nothing in this file has
 * ever reached the clamp. It is kept on `PLUMAGE` because `PLUMAGE` takes a `t` from its caller and
 * the next caller may not be so well behaved, which is exactly the contract the private copy had.
 */

/**
 * HER BLACK IS NEUTRAL NOW, and that is the design board's finding of 2026-10-20: "it is currently
 * purple-black rather than black, the same ink family as Purple's cloak."
 *
 * It was `night` 0 to 1, #1a1026 to #2d1b3d. Those are violets -- the blue channel runs half again
 * the red and nearly four times the green -- and the file's old header argued for them on the
 * grounds that a magpie's gloss is a blue-black. The gloss is, in three pixels on the wing; the
 * other two hundred are plain black, and painting the whole bird in Purple's own hue family put a
 * small purple animal in a forest whose one purple thing is supposed to be the protagonist.
 *
 * `stone` is the palette's neutral, #5f5f66, six points of blue over a flat grey. Taken down by
 * `keyline` the ratio is kept exactly, so the whole plumage is a cool near-black that is not any
 * character's hue: #1f1f21 to #353539, luma 31 to 54. The wolf keeps the darkest mass in the game
 * -- `ink` 0 is luma 16 and his keyline 14, both under this bird's keyline at 22 -- which was the
 * one real constraint the `night` choice was serving.
 */
const MAGPIE_DARK: RGBA = keyline('stone', 74);

/** The plumage, cool near-black, nowhere near Purple's purple. */
const PLUMAGE = (t: number): RGBA => mix(keyline('stone', 64), keyline('stone', 30), clamp01(t));

/**
 * The wing gloss: `water` 0 taken most of the way down to the plumage, which lands at luma 58 -- a
 * deep blue a clear 27 levels above the feathers it sits in.
 *
 * `water` 0 neat is luma 99 and a strong cerulean, and three pixels of it on the wing came back as
 * a little blue FLAG rather than as iridescence. A magpie's gloss is a dark blue that you notice
 * only when the light catches it, which is what a value this close to the feather does.
 */
const GLOSS: RGBA = mix(keyline('stone', 64), shade('water', 0), 0.45);

/** The bill, lit and shaded. Horn, not gold: see the note on the bead at the foot of the painter. */
const HORN: RGBA = shade('stone', 1);
const HORN_DARK: RGBA = keyline('stone', 18);

/**
 * Repeats whatever she last overheard, and is holding a bead she is not going to give back.
 *
 * Perched and facing left, 28 across and 22 high, and the proportion IS the character: she is the
 * only thing in the cast whose silhouette is a long horizontal wedge. Section 10.2 spells out what
 * makes it one -- a 14 px tail behind a 12 px body, carried level rather than swept down.
 *
 * WHAT THE DESIGN BOARD SENT BACK (2026-10-20), after a first pass fixed the white and the gold and
 * the bird still failed: "one near-black horizontal wedge with a white belly patch, a white wing
 * dash, a gold beak nub and a blue tail dash. THE HEAD DOES NOT SEPARATE FROM THE BODY AND THERE IS
 * NO EYE, which is why it reads as a slug with a horn. A magpie is read by its head-body-tail
 * articulation before it is read by its colours."
 *
 * That is a drawing about ARTICULATION, and the previous pass answered it with pattern. Every mark
 * below is one of the four joints the board named, and the colour is what is left over.
 *
 * 1. THE HEAD IS SET OFF BY A NECK, not by a value. Head, breast and wing were three overlapping
 *    ellipses of near-identical width, so the outline ran unbroken from the bill to the tail and
 *    there was no silhouette event anywhere along it -- which is the whole of "it reads as a slug".
 *    The neck is now a stroke NARROWER THAN EITHER MASS, five pixels between a nine-pixel skull and
 *    an eleven-pixel body, which pinches the outline twice: a notch under the jaw at the front and
 *    a step at the nape behind. Both are transparent pixels, so `outline` keylines each side of
 *    them, and both survive to the playing camera because they are shape rather than shading.
 *
 * 2. THE EYE IS THE BOARD'S OWN EYE. `reference/mocks/gameplay-concepts.png` at `650 270 120 130 8`
 *    is the board's bird, and its eye is a third of the width of its head: a hard white ring, a
 *    near-black pupil inside it, and a bright glint at the upper left. Ours was a three-pixel pale
 *    field with a two-pixel pupil in it, which leaves half a pixel of white and renders as a smudge
 *    on the rim of the skull. It is now five across with two of pupil, set in the middle of the
 *    head with black all round it. On a bird whose plumage spans twenty-three luma, the eye is the
 *    only high-contrast mark the head can carry, and it is what makes the head a head.
 *
 * 3. THE BILL IS PALE AND IT BREAKS THE FRONT. A dark bill on a dark head is not a bill at any
 *    size, and the previous one -- plumage-coloured, two pixels of gold at the tip -- gave the
 *    board "a gold beak nub". Horn grey off `stone`, luma 66 under and 143 along the lit top edge,
 *    held clear of the head so the keyline gets all the way round the point.
 *
 * 4. THE TAIL IS HELD APART. It used to leave the BOTTOM of the body and continue its underside,
 *    which makes one wedge however long it is drawn. It now leaves the rump HIGH and narrow, and
 *    the body's belly line rises steeply behind the legs to get out from under it -- so from the
 *    rump back there is sky above the tail and sky below it, and the eye reads body, stick, tip.
 *
 * The pattern that survived the rewrite, because the board liked it: a white belly carried as one
 * low mass, a white scapular patch on the shoulder, and the iridescence as three touching pixels on
 * the wing's trailing edge rather than one blue pixel on the tail.
 */
function paintMagpie(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip; // the head dips; the feet, the body and the tail are planted
  /*
   * HER BEAT IS THE HEAD TILT: the skull, the eye and the bill rise a row (`k`) and the bill's point
   * a row more than its root, so the head cocks up at you rather than lifting off the neck. The neck
   * follows the skull, the body and tail stay planted. At `k` 0 every line below is the old one.
   */
  const k = pose.beat > 0 ? 1 : 0;

  /*
   * TAIL, drawn first and so behind everything. It leaves the rump HIGH -- its axis runs from row
   * 36 to row 38.4 while the body's belly reaches row 44 -- and it is four pixels at the root under
   * an eleven-pixel body. Those two facts are the whole of joint 4: from column 19 back, the only
   * thing in the frame is a narrow bar with air above it and air below it.
   *
   * The underside is the keyline value rather than a plumage step, because the one place a tail has
   * to read against the ground is its bottom edge.
   */
  taper(img, 16.6, 36.2, 26.6, 38.6, 3.8, 2.4, PLUMAGE(0.08));
  taper(img, 16.6, 35.8, 26.2, 38.1, 2.2, 1.2, PLUMAGE(0.55));
  taper(img, 18.4, 37.8, 26.6, 39.8, 1.1, 1.0, MAGPIE_DARK);
  // Graduated tip: a magpie's central feathers are the longest, so the end steps rather than
  // rounding off. Two pixels of it, which is all 22 rows can spare and all the shape needs.
  img.rect(26, 38, 2, 2, PLUMAGE(0.22));
  img.rect(27, 39, 2, 1, PLUMAGE(0.08));

  /*
   * BODY: breast in front, rump behind, and the rump deliberately SHORTER and HIGHER so the belly
   * line climbs away from the tail instead of running level into it.
   */
  img.ellipse(13.0, 39.2, 5.0, 4.8, PLUMAGE(0.08));
  img.ellipse(16.0, 38.8, 3.4, 3.9, PLUMAGE(0.08));
  img.ellipse(12.6, 38.4, 4.3, 4.1, PLUMAGE(0.52));

  /*
   * THE NECK -- joint 1, and the single most important stroke in the sprite. Five pixels between a
   * nine-pixel skull and an eleven-pixel body, running up and forward, so the outline is pinched
   * under the jaw at the front and steps three rows at the nape behind.
   */
  taper(img, 10.4, 33.6 + b - k, 13.2, 35.8, 5.2, 6.2, PLUMAGE(0.34));

  /*
   * THE WHITE UNDERSIDE, drawn as ONE low block along the whole bottom of the body and terminating
   * hard where the black rump begins.
   *
   * It was three whites two passes ago -- a belly, a scapular and a separate primary flash -- and
   * rendered on grass they joined into one diagonal slash and the bird came back wearing a sash.
   * Three pale marks is a polka dot at 22 rows.
   */
  img.ellipse(12.8, 41.4, 4.6, 2.4, shade('fur', 1));
  img.ellipse(12.2, 40.9, 3.0, 1.3, shade('fur', 3));

  /*
   * FOLDED WING: a big mass over the whole flank, from behind the shoulder back to the tail root,
   * and DARKER than the back above it, because the light is up and to the left and a folded wing is
   * the side of the bird. That one step is what lets the scapular read as being above the wing
   * rather than beside it.
   */
  taper(img, 13.6, 37.4, 17.4, 40.4, 5.6, 3.4, PLUMAGE(0.12));
  taper(img, 13.4, 37.0, 16.8, 39.6, 4.0, 2.0, PLUMAGE(0.3));
  // The sheen a magpie really has, on the WING, along its trailing edge where the gloss catches.
  // TOUCHING pixels, hard against the seam: set on a diagonal with corners only between them they
  // came back as three rivets punched in the wing, and out in the middle of the mass they read as
  // damage. Forty of them would be a kingfisher.
  img.rect(16, 37, 1, 2, GLOSS);
  // The seam where the wing crosses the tail root: the only thing at this size saying these are two
  // limbs rather than one wedge.
  img.line(17.4, 36.6, 18.2, 40.4, MAGPIE_DARK);

  /*
   * THE WHITE SCAPULAR, an oval laid along the shoulder immediately behind the neck and one row in
   * from the back line, so black nape, white shoulder, black wing read as three bands rather than
   * as a patch stuck on the skyline. It is the mark that tells a magpie from a crow, and sitting
   * where it does it also does the work of the pale collar the board offered as the alternative to
   * a silhouette step. We have both.
   */
  img.rect(12, 35, 4, 2, shade('fur', 1));
  img.px(15, 36, PLUMAGE(0.3)); // the lower-back corner off, so it is a patch and not a label
  img.rect(12, 35, 3, 1, shade('fur', 3));

  /*
   * HEAD: a round skull nine across and eight deep, carried forward of the breast and above it,
   * with its own lit crown up and to the left (docs/PIXEL_STANDARD.md section 3).
   *
   * No drawn jaw line. The previous pass ran one in the keyline value under the skull and it came
   * back as a black bar across the throat -- the head needs the outline's own edge there and
   * nothing else, which is what the notch between chin and breast now gives it.
   */
  img.ellipse(8.6, 31.2 + b - k, 4.3, 4.1, PLUMAGE(0.08));
  img.ellipse(8.2, 30.8 + b - k, 3.5, 3.3, PLUMAGE(0.5));
  img.ellipse(7.3, 29.3 + b - k, 1.9, 1.4, PLUMAGE(0.74));

  /*
   * BILL -- joint 3. Short, heavy, POINTED and PALE, coming off the lower front of the skull on the
   * row under the eye and projecting two columns clear of it, so `outline` gets a dark edge the
   * whole way round the point. Integer rows, so the upper mandible is one pixel longer than the
   * lower and the bill ends in a point rather than in a blunt grey tube.
   */
  if (k === 0) {
    img.rect(4, 32 + b, 4, 1, HORN);
    img.rect(5, 33 + b, 3, 1, HORN_DARK);
  } else {
    // Cocked: the root a row up with the skull, the point a row above that, so the bill angles.
    img.rect(6, 31 + b, 2, 1, HORN);
    img.rect(4, 30 + b, 2, 1, HORN);
    img.rect(6, 32 + b, 2, 1, HORN_DARK);
    img.px(5, 31 + b, HORN_DARK);
  }

  /*
   * EYE -- joint 2, and the owl's own construction from `cast.ts`: INTEGER pixels, never an ellipse,
   * because at this radius the rasteriser's answer depends on the sub-pixel phase of the centre and
   * what came back last pass was a white hook rather than a ring.
   *
   * Four by four of white with a two-by-two pupil inside it is the board owl's 0.47 ratio, so a
   * whole pixel of white survives on every side, and the head carries a row of brow above it and
   * three of cheek below. The four corners come off again afterwards, or a ring this small reads as
   * a square label rather than as an eye. There is no catchlight: one pixel of `fur` 3 inside a
   * `fur` 1 ring is 25 luma on a mark four pixels wide, which is not a glint, it is a dirty pixel
   * -- on a head this dark the ring itself is the light.
   */
  const e = b - k;
  if (!blink) {
    img.rect(7, 28 + e, 4, 4, shade('fur', 1));
    for (const [cx, cy] of [
      [7, 28],
      [10, 28],
      [7, 31],
      [10, 31],
    ] as const)
      img.px(cx, cy + e, PLUMAGE(0.08)); // the corners off, so the ring is round and not a patch
    img.rect(8, 29 + e, 2, 2, PLUMAGE(0));
  } else {
    // The lid closes to the lower half of the ring, so the eye shuts rather than vanishing.
    img.rect(7, 30 + e, 4, 1, shade('fur', 1));
    img.rect(7, 29 + e, 4, 1, MAGPIE_DARK);
  }

  /*
   * LEGS: dark with a lit front edge, which is what a magpie's legs are. Gold ones put a pair of
   * brass pins under a black bird and were half of the board's "bell" read two passes ago.
   *
   * SHORT. At four rows of leg over a foot bar and a contact row, the bottom five of her twenty-two
   * went to undercarriage and she stood up like a wader; the board's own bird gives its feet two
   * rows out of twenty-six.
   */
  for (const lx of [11, 15]) {
    img.rect(lx, 44, 2, 3, PLUMAGE(0));
    img.rect(lx, 44, 1, 2, HORN_DARK);
    img.rect(lx - 1, 46, 3, 1, MAGPIE_DARK);
    img.px(lx, 46, HORN_DARK);
  }

  /*
   * The bead she is not going to give back: ONE bright pixel, gripped at the tip of the bill.
   *
   * It was a 3 px ellipse of `gold` 0 round a `gold` 2 core, held level with the bill, and the
   * board's note was that the gold hook read as a bell. Two pixels later it was reading as a yellow
   * BEAK, which is a blackbird. One pixel of `gold` 3 on a horn-grey bill is 85 luma above what it
   * sits on: a glint of something carried, with none of the hardware.
   */
  img.px(3, 32 + b - 2 * k, shade('gold', 3));

  base(img, 11, 16, 47, MAGPIE_DARK);
  img.outline(MAGPIE_DARK);
}

// ----------------------------------------------------------------------------- the snail

/** His keyline: `stone` 0 is luma 96 and outlines nothing (section 13 item 16). This is luma 36. */
const SNAIL_DARK: RGBA = keyline('stone', 60);

/**
 * The groove the shell's coil is cut with: `stone` 0 taken two thirds of the way down to the
 * keyline, which lands at luma 60.
 *
 * `stone` 0 neat is luma 96 under a shell at 194 to 230, and that is what the old spiral was drawn
 * in -- rendered on grass it came back as grey blotches scattered over cream rather than as a coil.
 * Sixty is 140 under the shell's lit face and still a clear 24 above SNAIL_DARK, so the coil reads
 * as a groove in the shell and not as the shell's own outline, which is the mistake the design
 * board caught on the rabbit's eyes.
 */
const SHELL_GROOVE: RGBA = mix(shade('stone', 0), SNAIL_DARK, 0.66);

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
function paintSnail(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip;
  /** His beat: both eye stalks sway a pixel sideways at the tip, signed. The roots stay put. */
  const s = pose.beat;

  /*
   * --- foot: one long low wedge with the head end raised, and nothing that could read as a leg ---
   *
   * The sole is the widest thing on him (10.2 says the shell; the sole is what carries it) and its
   * radius is measured rather than chosen: at 11.8 he came back 26 wide, which is inside the
   * toadstool's width band, and 10.2's own figures for those two share both bands. See BYSTANDER_PLAN.
   *
   * THE BODY STAYS IN THE BOTTOM HALF OF `stone`. It used to finish on `stone` 3 at luma 210 at the
   * head end, which is the shell's own value, so the two masses met and the whole animal rendered as
   * one pale mound with marks on it. He has exactly two masses at 14 px -- a grey body and a cream
   * shell -- and they have to be told apart by value before anything inside either one can matter.
   * Also one row shallower on the dark: at ry 2.4 over a 2.0 face the keyline filled rows 45 AND 46
   * across the full 24 px and he sat in a black trench.
   */
  img.ellipse(16.4, 43.6, 12.2, 2.0, SNAIL_DARK);
  img.ellipse(16.0, 43.3, 11.4, 1.7, shade('stone', 0));
  img.ellipse(15.4, 42.9, 10.0, 1.1, shade('stone', 1));
  img.ellipse(7.4, 41.4, 3.6, 3.0, shade('stone', 0));
  img.ellipse(6.9, 41.0, 3.0, 2.4, shade('stone', 1));
  img.ellipse(6.2, 40.0, 1.8, 1.3, shade('stone', 2));

  /*
   * --- THE SHELL, drawn as NESTED WHORLS converging on an apex, not as a spiral ---
   *
   * Three versions of this were a real logarithmic spiral stepped one pixel at a time, and every
   * one failed the same way: at this radius consecutive turns land one or two pixels apart, the
   * track crosses itself, and what renders is not a coil but a scatter of grey dashes on cream --
   * on grass, a dirty shell. A fourth tried the same idea as nested ARCS, and `arc` lays a disc at
   * every step, so at w 1 over a 6 px radius it came back as a thick dark band across the whole
   * top of the shell. The arithmetic was never the problem, which is why tuning the arithmetic
   * three times never fixed it.
   *
   * A shell at eleven rows reads from CONCENTRIC RINGS OFFSET TOWARD AN APEX, each a step of value
   * from the last. That is what a shell is -- turns of one tube seen end-on -- and the eye assembles
   * "spiral" from four rings and a bright point without being shown a single curve. It is also the
   * only construction here that cannot stand proud of the silhouette, since every ring is an
   * ellipse strictly inside the one before it; the old spiral broke the body plan by a row twice.
   *
   * The apex is up and to the RIGHT, behind the aperture at the lower left, because that is the way
   * round a snail's shell actually sits when he is facing left. The light stays up-LEFT like every
   * other light in this project: the lit cap on the near shoulder and the apex are two different
   * things and they belong on opposite sides.
   *
   * CLAY WITH A HAZE WHORL, literally and at last. The shell is `fur`, the palette's warm pale
   * neutral and the closest it holds to Clay; one of its four rings is `cloak` 3, which IS Haze. It
   * used to be an extra arc laid over the top of a finished shell, which rendered as three loose
   * lilac pixels that read as damage. A whorl of it is a whorl of it.
   */
  /*
   * THE SHELL'S OWN EDGE, and it is the change that finally made him a snail.
   *
   * Four passes went into the coil -- a log spiral, nested arcs, four value rings, three -- and
   * every render came back as a pale lump with marks on it, because the coil was never the fault.
   * The fault was that THE SHELL AND THE BODY HAD NO BOUNDARY: cream shell ran straight into cream
   * foot inside one unbroken outline, so there was no round mass for a coil to be a coil ON. A
   * shell is an object sitting on an animal and the eye wants to see it perch.
   *
   * So the shell is laid down a pixel proud in SHELL_GROOVE. Round the top that pixel is the
   * silhouette edge and `outline` covers it; where the shell meets the foot at the lower left it is
   * the only thing drawn there, and it reads as the shell's rim. Same single call, two jobs.
   *
   * ROUNDER, too. At 8.4 x 5.2 the shell was 1.6:1 and every "ring" inside it came out as a pair of
   * horizontal bands with the turns reading as stripes. At 7.2 x 5.0 it is round enough that a ring
   * is a ring.
   */
  img.ellipse(19.6, 39.8, 7.2, 5.0, SHELL_GROOVE);
  img.ellipse(19.2, 39.4, 6.6, 4.4, shade('fur', 0)); // the shell's face
  img.ellipse(16.4, 37.9, 2.8, 1.6, shade('fur', 1)); // the lit near shoulder, up-left
  /*
   * `fur` 0 UNDER `fur` 1, not the other way up, because the brief says CLAY and Clay is #D4D2C8 at
   * luma 209 -- between `fur` 0 at 194 and `fur` 1 at 231, and much nearer the first. Led by 1 the
   * shell averaged near-white: blitted into the real world render beside the path it was the
   * brightest object in the frame, out-shouting Purple, and on the sand it vanished altogether, which a
   * flat-grass preview cannot show you. Led by 0 its mean lands on Clay, where it was always
   * specified, and the dark foot under a mid-pale shell becomes a two-value read at the playing
   * camera, which is the only thing that makes a 14 px animal findable at all.
   */
  /*
   * The whorls: ONE STEP OF SHADE BETWEEN THEM, not a plunge, and the apex offset up and to the
   * RIGHT -- behind the aperture at the lower left, which is the way round a snail's shell sits when
   * he is facing left. An earlier pass cut the innermost whorl in SHELL_GROOVE under a `cloak` 3
   * ring and what rendered was not a shell, it was an EYE: a black pupil in a lilac iris, on the one
   * sprite whose whole job is to be a spiral. The turns of a shell are the same material at
   * different angles, so about fifty luma apart and no more.
   *
   * Clay with a Haze whorl, literally: the shell is `fur`, the palette's warm pale neutral and the
   * closest it holds to Clay, and one of its turns is `cloak` 3, which IS Haze. It used to be an
   * extra arc laid over a finished shell and rendered as three loose lilac pixels reading as damage.
   */
  img.ellipse(20.4, 39.1, 4.4, 3.0, shade('stone', 1));
  img.ellipse(21.0, 38.8, 2.8, 1.9, shade('fur', 0)); // cuts the above into a ring, not a disc
  img.ellipse(21.6, 38.6, 1.2, 0.9, shade('stone', 1)); // the turn inside that
  arc(img, 20.4, 39.1, 3.7, 2.5, Math.PI * 1.08, Math.PI * 1.52, 1, shade('cloak', 3));
  img.px(22, 38, shade('fur', 2)); // the apex, one lit pixel

  // Shell mouth, with a lip: the body goes IN here, which is what makes it a shell and not a ball.
  img.ellipse(12.8, 41.8, 2.8, 2.0, shade('fur', 1));
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
  arc(img, 19.4, 40.0, 7.0, 4.1, Math.PI * 1.9, Math.PI * 2.1, 1.2, shade('wood', 0));
  img.rect(23, 37, 4, 4, shade('wood', 0));
  img.rect(23, 37, 3, 3, shade('wood', 1));
  img.rect(23, 37, 3, 1, shade('wood', 2));
  img.rect(24, 39, 2, 2, shade('wall', 3)); // the label
  img.px(25, 37, shade('gold', 2)); // the knot, and the only gold on him now
  /*
   * The parcel used to carry a `gold` 0 band under a `gold` 1 band wrapping the shell and a `gold`
   * 1 string up the box with a `gold` 3 knot -- eight or nine pixels of brass on a fourteen-row
   * animal, sitting exactly where the coil is. At size it was the loudest thing on the sprite and
   * the shell read as a tin. The strap is `wood` now, the way a strap is, and one pixel of gold is
   * left at the knot.
   */

  /*
   * --- eye stalks, up and clear of the shell, and thin: a thick stalk is a chimney ---
   *
   * PALE, though. Drawn in `stone` 0 at luma 96 they were two mid-grey rods two pixels wide, and
   * `outline` then put SNAIL_DARK down both sides of each: four pixels across of which two were
   * keyline, so on grass the head end came back as a dark thicket with white specks in it rather
   * than as two stalks with eyes on. A stalk this narrow has to be light enough that its core still
   * reads once its own outline has taken a pixel off each side.
   *
   * SHORT, as well. Three rows of 2 px stalk above the body is five or six pixels of which four are
   * keyline, and they came back reading as two black horns. The shell sets his height -- its top row
   * is the sprite's -- so a shorter stalk costs nothing in the body plan and buys a core that shows.
   */
  const stalk = (x0: number, y0: number, x1: number, y1: number): void => {
    taper(img, x0, y0, x1, y1 + b, 2.6, 1.8, shade('stone', 1));
    taper(img, x0 - 0.4, y0 - 0.4, x1 - 0.4, y1 - 0.4 + b, 1.4, 1.0, shade('stone', 2));
  };
  stalk(7.2, 40.8, 5.8 + s, 38.8);
  stalk(9.6, 40.9, 11.2 + s, 39.0);
  /*
   * The eyes on the ends of them: a dark knob with ONE pale pixel of light, not a pale knob with a
   * dark speck in it. `fur` 3 filled to 2 px across, which is what they were, is the brightest
   * value in the palette put on the two smallest shapes on the sprite -- on grass they rendered as
   * a pair of little white ghosts floating over him, and they were the first thing the eye found.
   * The light goes upper-left, where every other light in this project goes.
   */
  for (const [ex, ey] of [
    [5.8, 38.2],
    [11.2, 38.4],
  ] as const) {
    img.ellipse(ex + s, ey + b, 0.9, 0.9, SNAIL_DARK);
    if (!blink) img.px(Math.floor(ex + s), Math.floor(ey) + b, shade('fur', 2));
    else img.px(Math.floor(ex + s), Math.floor(ey) + 1 + b, shade('stone', 2));
  }
  // Lower tentacles, the short pair he actually smells with. Short: any longer and they read as
  // legs, which 10.2 says he does not have.
  taper(img, 6.6, 42.0, 4.6, 43.0, 1.6, 1.0, shade('stone', 0));

  base(img, 8, 25, 47, SNAIL_DARK);
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
function paintCat(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip; // the head and ears dip; the paws and the tail stay planted
  /**
   * Her beat is the tail: its tip swishes out to the right by `sw` pixels and the rings ride along
   * in proportion to how far up the tail they sit. The root stays on the hip. Only rightward --
   * swung left, the tip runs into her own right ear two rows above it.
   */
  const sw = Math.max(0, pose.beat) * 1.2;
  /** How far a point `y` rows up the tail moves with the tip: 0 at the root (row 41), 1 at the tip. */
  const along = (y: number): number => Math.round(sw * ((41 - y) / 15.6));

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
  img.line(18.0 + sw, 26.0, 18.6, 40.6, CAT_DARK);
  taper(img, 19.0, 41.0, 20.4 + sw, 25.4, 3.0, 2.4, CAT_DARK);
  taper(img, 18.9, 40.6, 20.3 + sw, 25.6, 2.2, 1.6, shade('wood', 1));
  taper(img, 18.7, 40.0, 20.1 + sw, 26.4, 1.1, 1.0, shade('wood', 2));
  /*
   * Two rings on it. The tail was drawn in the body's own two levels of `wood` and standing against
   * the hip, which is both the same ramp and the same value, so at size it read as a plank rather
   * than as a limb -- a brown column beside a brown cat. A ringed tail is also the oldest tabby
   * shorthand after the forehead M, and it costs two marks: at three bars on the haunch, three bars
   * on the forehead and two here the count is still inside "three is a tabby, thirty is a dirty
   * sprite", because no one group of them is more than three.
   */
  img.rect(19 + along(35), 35, 2, 1, CAT_DARK);
  img.rect(20 + along(30), 30, 2, 1, CAT_DARK);

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

  /*
   * --- face: two eyes, each a small dark pupil in a lit field with a light on it ---
   *
   * This is the design board's finding about the rabbit and the owl, arriving a third time. Each
   * eye was a 3 x 2 block of `gold` 2 at luma 190 with a one-pixel dark column down its MIDDLE,
   * which does not make a pupil -- it cuts the eye in half, so the face rendered as FOUR bright gold
   * bars in a row across nine columns of head, and they were far and away the brightest thing on
   * the sprite. A cat's eye is mostly iris and that is the charm of it, but the board's rule still
   * holds: the dark mark has to be small, inside the light, with the light showing round it.
   *
   * So: 2 x 2 of `gold` 1 -- a step down from 2, because at 190 the pair out-shouted everything --
   * with the pupil one pixel at the lower-inner corner and the catch one pixel at the upper-left,
   * where every light in this project comes from. Four pixels of eye each, three columns of
   * forehead between them.
   */
  for (const [ex, px] of [
    [11, 12],
    [16, 17],
  ] as const) {
    if (blink) {
      img.rect(ex, 25 + b, 3, 1, shade('wood', 0));
    } else {
      img.rect(ex, 24 + b, 2, 2, shade('gold', 1));
      img.px(px, 25 + b, CAT_DARK);
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
  // The nose: two pixels. At a 1.3 x 0.9 ellipse it came out three wide by two deep, which on a
  // seven-row face is a snout -- the rendered cat had a brown block in the middle of a cream muzzle.
  img.rect(14, 26 + b, 2, 1, shade('skin', 0));
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
  'bystander-toadstool-0': (img) => paintToadstool(img, REST),
  'bystander-toadstool-1': (img) => paintToadstool(img, BLINK),
  'bystander-magpie-0': (img) => paintMagpie(img, REST),
  'bystander-magpie-1': (img) => paintMagpie(img, BLINK),
  'bystander-snail-0': (img) => paintSnail(img, REST),
  'bystander-snail-1': (img) => paintSnail(img, BLINK),
  'bystander-cat-0': (img) => paintCat(img, REST),
  'bystander-cat-1': (img) => paintCat(img, BLINK),
};

/** A character painter that takes a pose, for the idle and hop strips `sprites.ts` assembles. */
export type PosedPainter = (img: Img, pose: Pose) => void;

/** The bystanders' painters by sprite key, posable. `BYSTANDER_FRAMES` is two poses of each. */
export const BYSTANDER_POSED: Record<string, PosedPainter> = {
  'bystander-toadstool': paintToadstool,
  'bystander-magpie': paintMagpie,
  'bystander-snail': paintSnail,
  'bystander-cat': paintCat,
};
