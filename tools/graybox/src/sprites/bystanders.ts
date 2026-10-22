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
 *   cat       -- NARROW: 15 px across, a round head with two broad ear points, a thin hooked tail
 *
 * Silhouettes, checked against each other and against the cast in `cast.ts`: a wide low dome on a
 * stalk, a long horizontal wedge, a low spiral, a tall thin triangle. The pair that used to be the
 * near-miss -- cat against rabbit -- is now 15 x 30 against 21 x 34, and the ears settle what is
 * left of it: the rabbit's are tall leaves standing up with sky between them, the cat's are short
 * broad triangles out on the corners of a round skull.
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
  'bystander-snail': { w: 27, h: 15, widest: 'the shell', breaks: 'two eye stalks' },
  'bystander-cat': {
    w: 14,
    h: 30,
    widest: 'the head',
    breaks: 'the tail, clear of her right side',
  },
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

/**
 * His keyline: warm, from `wall` taken down to about luma 32 (Paul's round, 2026-10-22). It was
 * `stone`'s cold grey, and with a grey shell inside a grey keyline the whole animal read as a stone
 * on the path; a warm dark edge belongs to the amber shell it now goes round.
 */
const SNAIL_DARK: RGBA = keyline('wall', 140);

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
const SHELL_GROOVE: RGBA = mix(shade('wood', 0), SNAIL_DARK, 0.35);

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
  /*
   * AMBER, WITH A TWO-RING COIL, AND TWO ROWS TALLER (Paul's round, 2026-10-22: "a snail that reads
   * as a stone"). Everything above was right about the construction and the round shell; what read
   * as a pebble was its VALUE AND HUE -- a pale grey-cream shell on a grey body inside a grey
   * keyline is a stone by every cue the eye has. So the shell is `wood`'s warm tan with a lit
   * `wood` 3 shoulder, and the coil is two rings cut in the dark amber groove, each a pixel wide and
   * offset toward an apex up and to the right, with a `gold` band between them -- the nested-whorl
   * construction recorded above, in a shell's own colours. A row taller (15, not 14): at 14 the coil
   * had no room for a second ring, and 16 -- the size first asked for -- puts him in the magpie's
   * height band (dh 6, BYSTANDER_PLAN), which the body-plan check refuses. The body stays grey, so
   * the two masses still part by value.
   */
  img.ellipse(19.6, 39.3, 7.6, 5.5, SHELL_GROOVE);
  img.ellipse(19.2, 38.9, 7.0, 4.9, shade('wood', 2)); // the shell's face
  img.ellipse(16.0, 36.9, 3.0, 1.6, shade('wood', 3)); // the lit near shoulder, up-left
  img.ellipse(20.2, 38.9, 4.7, 3.4, SHELL_GROOVE); // the outer ring of the coil
  img.ellipse(20.4, 38.8, 3.7, 2.5, shade('gold', 1)); // the turn between the two rings
  img.ellipse(20.9, 38.6, 2.5, 1.6, SHELL_GROOVE); // the inner ring
  img.ellipse(21.1, 38.5, 1.4, 0.8, shade('wood', 3));
  img.px(21, 38, shade('gold', 3)); // the apex, one lit pixel

  // Shell mouth, with a lip: the body goes IN here, which is what makes it a shell and not a ball.
  img.ellipse(12.8, 41.8, 2.8, 2.0, shade('wood', 3));
  img.ellipse(12.8, 41.9, 2.0, 1.4, shade('stone', 0));

  /*
   * The parcel -- strapped to the shell's REAR FLANK, five pixels by four, as before. Brown paper
   * now (`wall`), with a `wood` 0 strap: on an amber shell a `wood` box was the shell's own colour
   * and vanished into it.
   */
  arc(img, 19.4, 40.0, 7.0, 4.1, Math.PI * 1.9, Math.PI * 2.1, 1.2, shade('wood', 0));
  img.rect(23, 37, 4, 4, shade('wood', 0));
  img.rect(23, 37, 3, 3, shade('wall', 0));
  img.rect(23, 37, 3, 1, shade('wall', 1));
  img.rect(24, 39, 2, 2, shade('wall', 3)); // the label
  img.px(25, 37, shade('gold', 2)); // the knot

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
 * A filled triangle, sampled at pixel centres. The cat's ears are the one shape in this file that
 * is neither round nor a stroke: a broad base on the skull and a point, and `taper` can only make
 * a point by narrowing a line, which is what drew her old ears as two tall spikes.
 */
function tri(
  img: Img,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  c: RGBA,
): void {
  const side = (px: number, py: number, x0: number, y0: number, x1: number, y1: number): number =>
    (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
  const area = side(cx, cy, ax, ay, bx, by);
  for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++)
    for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const s0 = side(px, py, ax, ay, bx, by) * area;
      const s1 = side(px, py, bx, by, cx, cy) * area;
      const s2 = side(px, py, cx, cy, ax, ay) * area;
      if (s0 >= 0 && s1 >= 0 && s2 >= 0) img.px(x, y, c);
    }
}

/**
 * Sitting, facing out, tail curled up her right side, entirely uninterested in your errand.
 *
 * SHE READ AS A FOX, and the client said so (2026-10-22). Every feature the last pass gave her is
 * one a fox has and a cat does not, and the redraw is that list turned round:
 *
 *   was                                         is
 *   tall ears tapering to a spike, set close    short BROAD-BASED triangles out on the skull's
 *                                                 corners, pink inside, a V of sky between them
 *   a cream muzzle in two lobes and a           no white anywhere: a whisker pad one step lighter
 *     cream bib wedge -- a fox's white mask       than the face, a pink nose; ginger all over
 *   a skull flatter than it is wide over a      a ROUND head, as wide as her haunches and fuller
 *     narrow chin -- a long wedge of face         at the cheeks than at the brow; the eyes low and
 *                                                 wide on it, the muzzle three rows and no more
 *   long separate legs and white socks:         sitting: a pear of a body, narrow at the chest and
 *     standing, which is how a fox is drawn       widest at the haunches, two short forelegs set
 *                                                 straight down between them
 *   a thick ringed brush lying against the hip  a THIN tail, two pixels from root to tip, standing
 *                                                 clear of her side with a keyline between, hooked
 *                                                 over at the top like a question mark
 *
 * The tail is the change that reads furthest. The old one was drawn OVER the hip in the hip's own
 * ramp, so at the playing camera it was a thicker right flank -- a brush, which is a fox. This one
 * rises from behind the right haunch, one column of keyline clear of her side all the way up, so it
 * is a separate line against the grass, and it hooks back over at the shoulder. No pale tip: that
 * is the fox's mark.
 *
 * THE BOX DOES NOT MOVE. `BYSTANDER_PLAN` holds her at 14 x 30 within a pixel, and she measures 15
 * x 30. The head and the tail set her two outer edges, which is why the body is ten columns and not
 * eleven: the separated tail costs the one pixel the plan allows and nothing more. She stays out of
 * the rabbit's band (dw 6), and the ears own their own rows above the skull.
 *
 * Her beat is still the tail: the hooked tip lifts and curls in a row a beat while the rest of her
 * ignores you, and only up and inward -- never out, because out is where her width runs out. The
 * breath dips the head and ears and nothing else.
 */
function paintCat(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const b = pose.dip; // the head and ears dip; the body, the paws and the tail stay planted
  /** How far the tail's hooked tip lifts this beat, in rows: never down, never more than two. */
  const flick = Math.min(2, Math.max(0, pose.beat));

  /*
   * --- the tail, first, so the haunch laps over its root ---
   *
   * Out from behind the right haunch at the ground, up her right side one column clear of it, and
   * hooked back over at the top. Two pixels thick from root to tip, ringed twice in the body's own
   * dark: a tabby's rings, and no pale tip.
   */
  const tail: readonly (readonly [number, number])[] = [
    [18.2, 45.6],
    [20.4, 44.2],
    [21.0, 40.0],
    [21.0, 36.0],
    [20.6 - flick * 0.2, 33.4 - flick * 0.6],
    [19.4 - flick * 0.3, 32.2 - flick],
  ];
  for (let i = 0; i + 1 < tail.length; i++) {
    const [x0, y0] = tail[i]!;
    const [x1, y1] = tail[i + 1]!;
    taper(img, x0, y0, x1, y1, 2.2, 2.2, shade('wood', 1));
  }
  // Its lit edge, on the left of the upright, where the light comes from.
  taper(img, 20.4, 43.0, 20.4, 35.0, 0.9, 0.9, shade('wood', 2));
  img.rect(20, 41, 2, 1, CAT_DARK);
  img.rect(20, 37, 2, 1, CAT_DARK);

  /*
   * --- body: a pear, narrow under the chin and widest at the haunches, lit from the upper left ---
   *
   * The haunches are one broad mass across the bottom and the chest a smaller one on top of it; the
   * waist between them is the whole difference between sitting and standing.
   */
  img.ellipse(13.9, 42.4, 4.8, 4.3, shade('wood', 0)); // the haunches, in shade
  img.ellipse(13.5, 41.9, 4.2, 3.7, shade('wood', 1));
  img.ellipse(11.6, 40.4, 1.6, 2.0, shade('wood', 2)); // the near haunch takes the light
  img.ellipse(14.0, 35.6, 3.1, 4.4, shade('wood', 0)); // the chest
  img.ellipse(13.7, 35.2, 2.5, 3.8, shade('wood', 1));
  img.ellipse(12.8, 34.0, 1.1, 2.0, shade('wood', 2));
  // A tabby bar round each haunch: three marks on the body in all, with the tail's two rings.
  img.rect(10, 42, 2, 1, shade('wood', 0));
  img.rect(17, 41, 1, 2, shade('wood', 0));

  /*
   * Forelegs: two short straight posts down the middle, from the chest to the ground, with a paw at
   * the foot of each. One column of keyline splits the pair and one sits outside each, because `wood`
   * on `wood` is no edge and `outline` cannot reach between them -- without the grooves the lower
   * half is one brown mass, which is what reads as a standing animal's chest.
   */
  for (const [lx, lit] of [
    [12.5, true],
    [15.5, false],
  ] as const) {
    img.rect(Math.round(lx - 1), 39, 2, 7, shade('wood', lit ? 2 : 1));
    img.rect(Math.round(lx - 1), 45, 2, 1, shade('wood', lit ? 3 : 2)); // the paw's top, lit
  }
  img.line(14, 39, 14, 46, CAT_DARK);
  img.line(11, 41, 11, 46, shade('wood', 0));
  img.line(17, 41, 17, 46, shade('wood', 0));

  /*
   * --- ears: two broad triangles out on the corners of the skull ---
   *
   * About as wide at the base as they are tall, with a V of sky between the tips: a fox's are tall
   * and set close, a cat's sit out at the edges of a round head. Pink inside, which is `skin`.
   */
  tri(img, 9.4, 24.4 + b, 13.6, 22.0 + b, 10.4, 18.6 + b, shade('wood', 0));
  tri(img, 9.9, 23.6 + b, 13.0, 22.2 + b, 10.6, 19.6 + b, shade('wood', 2));
  tri(img, 10.8, 23.0 + b, 12.4, 22.4 + b, 11.0, 20.8 + b, shade('skin', 0));
  tri(img, 15.4, 22.0 + b, 19.6, 24.4 + b, 18.6, 18.6 + b, shade('wood', 0));
  tri(img, 16.0, 22.2 + b, 19.1, 23.6 + b, 18.4, 19.6 + b, shade('wood', 1));
  tri(img, 16.6, 22.4 + b, 18.2, 23.0 + b, 18.0, 20.8 + b, shade('skin', 0));

  // --- head: a ball as wide as the haunches, fuller at the cheeks than at the crown ---
  img.ellipse(14.5, 26.6 + b, 5.0, 4.3, shade('wood', 0));
  img.ellipse(14.2, 26.2 + b, 4.5, 3.8, shade('wood', 1));
  img.ellipse(12.6, 24.4 + b, 2.4, 1.7, shade('wood', 2)); // the brow, lit
  // Cheek ruffs: the jaw wider than the brow is the most cat thing a face can do at this size.
  img.ellipse(10.2, 28.6 + b, 1.3, 1.2, shade('wood', 1));
  img.ellipse(18.8, 28.6 + b, 1.3, 1.2, shade('wood', 0));
  // The tabby M: short bars on the forehead between the ears.
  for (const [mx, h] of [
    [12, 2],
    [14, 1],
    [15, 1],
    [17, 2],
  ] as const)
    img.rect(mx, 22 + b, 1, h, shade('wood', 0));

  /*
   * --- face: two eyes, each a small dark pupil in a lit field with a light on it ---
   *
   * 2 x 2 of `gold` 1, the pupil one pixel at the lower-inner corner and the catch one pixel at the
   * upper-left: the design board's rule from the rabbit and the owl, kept -- the dark mark small and
   * inside the light. They sit low and wide on the head with three columns of face between them,
   * which is a round face's proportion; a fox's eyes are high and close on a long one.
   */
  for (const [ex, px] of [
    [11, 12],
    [16, 16],
  ] as const) {
    if (blink) {
      img.rect(ex, 26 + b, 2, 1, CAT_DARK);
    } else {
      img.rect(ex, 25 + b, 2, 2, shade('gold', 1));
      img.px(px, 26 + b, CAT_DARK);
      img.px(ex, 25 + b, shade('gold', 3));
    }
  }
  /*
   * A SHORT muzzle: no snout and no white. A whisker pad one step lighter than the face, directly
   * under the eyes, with a pink nose at its top -- three rows in all. No mouth (section 6).
   */
  img.ellipse(14.5, 28.9 + b, 2.1, 1.1, shade('wood', 2));
  img.rect(14, 28 + b, 2, 1, shade('skin', 0));
  // The chin line: head and body are one ramp, and the keyline under the jaw is what says where one
  // ends. `outline` cannot draw it, because the join never touches the background.
  img.line(11.0, 30.6 + b, 18.0, 30.6 + b, CAT_DARK);

  base(img, 9, 19, 47, CAT_DARK);
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
