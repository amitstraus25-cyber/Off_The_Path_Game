/*
 * Undergrowth: the six things that get strewn across the lawn.
 *
 * `bush`, `flower-white`, `flower-pink`, `flower-red`, `rock`, `toadstool-ring`. These are the most
 * repeated frames in the game -- `forest-map.ts` scatters them more than a hundred times between
 * them -- so each one has to be legible at a 26-tile camera and uninteresting enough to survive
 * being seen a hundred times.
 *
 * 2026-10-19, SECOND PASS: the purple came out of the world, and the bush stopped being a cabbage.
 *
 * Read the next three paragraphs before touching anything here, because the pass before this one
 * was steered by a broken instrument and this file still carries its fingerprints.
 *
 * **The ruler was wrong, and it has been fixed.** `board-profile.json` used to be measured off
 * `reference/mocks/gameplay-concepts.png` at the BOARD's own resolution, which is three to four
 * image pixels to one of ours. At that density the board's hard steps are smeared across
 * interpolation, so the edge test missed most of them and reported 4.50 per cent -- half of ours.
 * The score therefore told every painter the art was too busy when the board is in fact crisper
 * than ours. The profile was rebuilt mid-pass from nearest-decimated crops and the same axis now
 * reads 20.88. Everything the previous header argued from that number is void, including its
 * "edge density has a floor at twice the board's" finding: there is no floor, we are UNDER the
 * board, and the direction is harder steps, not softer ones.
 *
 * **So do not smooth anything else to chase a number.** `tone()` is still right for a mass that
 * should look round or lit -- a leaf clump, a boulder, a cap -- and `keyline()` is still right
 * round everything that meets the ground. Neither is a licence to dissolve a readable step into a
 * gradient. There is no longer a measurement that rewards it, and there never was a drawing that
 * wanted it.
 *
 * **Measured before and after, with the lawn held constant.** This matters: `w-ground.ts` changed
 * during this pass and every tile here paints its own grass from it, so a straight before/after of
 * the finished tiles would have scored the lawn owner's work as mine. Both sides below are the
 * same six objects composited onto the same current grass, tiled to a 26x15 camera (the size the
 * variety axis is calibrated for):
 *
 *     axis                          before   after   board   ratio after
 *     deep shade (% under luma 81)   25.28   24.54   25.71   0.95
 *     keyline    (% under luma 60)   19.47   18.72   17.55   1.07
 *     luma spread (stdev)            50.69   48.77   60.12   0.81
 *     edge density (%)               24.75   24.86   18.91   1.31
 *     texture (mean 16px stdev)      47.52   45.65   42.17   1.08
 *     colour variety per 1000px       0.63    0.58    2.60   0.22
 *     distance                        0.350   0.362
 *
 * Say it plainly, because the alternative wastes the next round: on this scorer the second pass is
 * TWELVE THOUSANDTHS WORSE. Keyline came from 1.11 to 1.07 and texture from 1.13 to 1.08, both
 * real; deep shade moved off 0.98 to 0.95, and spread, edges and variety each slipped by a
 * hundredth or two. The work in it -- the purple out of the forest, three flowers a player can
 * tell apart, a bush that is not a cabbage -- is visible in any render and invisible to all six
 * axes. Do not undo it to buy the twelve thousandths back.
 *
 * (Both columns were re-measured together at the end, on the same lawn and the same ruler. Earlier
 * figures in this pass are not comparable with these: `w-ground.ts` and `board-profile.json` both
 * changed more than once while it was being written, and each change moved both columns.)
 *
 * **Why spread went DOWN, which is the one number worth understanding before changing it back.**
 * The old `flower-pink`, `flower-red` and toadstool caps all painted from `cloak`, and `cloak` is
 * a very light ramp: Lilac is luma 175 and Haze 214. Bright purple blooms put a lot of high-luma
 * pixels on a dark mass, which widens a luma histogram beautifully and is completely wrong. The
 * board's own flowers probe at 101 to 145 -- below the lawn, not above it. Painting them where the
 * board paints them necessarily narrows our spread. That is the axis being wrong, not the art, and
 * the right response is to leave it.
 *
 * Two things about the remaining gap, because they say the rest of the work is somebody else's:
 *
 * - **Spread and variety on these six tiles are mostly the lawn's.** About half of every tile here
 *   is grass. Profiled alone, `grass-1` and `grass-2` come in at spread 6.6 and 4.4 and variety
 *   0.67 and 1.10. Nothing drawn in this file moves those; `tiles/w-ground.ts` can, and is.
 *
 * - **Six prop tiles cannot reach the board's spread, whatever they look like.** The board crops
 *   the target is built from contain whole trees, trunks, water and path -- big dark masses beside
 *   bright lawn. A camera of nothing but small props on grass is a narrower histogram by
 *   construction. Judge this file on deep, keyline, edges and texture, which are distributional
 *   and comparable; judge spread and variety at a real camera, with trees in frame.
 *
 * What survives from the previous pass, because the measurement never argued with it:
 *
 * **1. Everything is keylined, and on its own scratch.** The board rings every object in a hard
 * near-black of the object's own hue, and that is most of why it reads as one illustrated world.
 * Because every tile here is opaque ground with the object drawn on top, `Img.outline()` cannot be
 * used directly -- it only paints transparent pixels next to opaque ones, so on an opaque tile it
 * paints nothing. Every object is therefore composed on its own transparent scratch, ringed there,
 * and only then blitted onto the grass.
 *
 * **2. Flowers are a bush first.** The board never puts a lone flower on open grass and never
 * draws a stem rising out of bare ground. A flower tile is a low green bush with four to six
 * four-petal blooms sitting in it. So the bush and the three flower tiles are one drawing with
 * different foliage outlines and different blooms, which is also what makes them read as one
 * planting rather than four unrelated props.
 *
 * **3. The three flowers are three plants, not three tints.** A dense round mound with big blooms
 * (the board's white daisy bush, at 1290 660 and again beside the well), a low wide sprawl with
 * more and smaller blooms on wiry stems (the pale red one beside it), and a tall narrow spire with
 * blooms up its height. They now differ in hue as well, but the silhouettes stay: a player should
 * be able to tell them apart in a grey screenshot.
 *
 * And the one thing this pass CHANGED about the previous pass's colour thinking:
 *
 * **4. Cyera purple is out of the undergrowth.** The old note here read "the board's red stays
 * rebranded" and painted the sprawl Haze, the spire Lilac and the toadstool caps Aubergine. That
 * was a misreading of the rebrand. Moving RED's cloak to purple is what makes her findable; it
 * does not make purple the world's accent. On the board, purple is UI chrome and the logo and
 * nothing else, the flowers are pink, red, white and yellow, and Red is the only saturated figure
 * in frame. Fifteen Lilac objects a camera, in her exact hue and at her exact luma, inverted the
 * standard they were meant to serve. See the note on `rose`, `ember` and `rust` below, which also
 * flags that those three families want to live in `PALETTE` rather than here.
 *
 * Nothing here draws its own grass. The floor gets one opinion and it is `tiles/w-ground.ts` --
 * the module `tiles.ts` actually ships. Importing the retired `tiles/ground.ts` here instead is a
 * silent bug rather than a loud one: every tile still paints, but a bush then stands on a 32x32
 * patch of the OLD lawn, and the mismatch prints a hard rectangle round every plant in the field.
 */
import { Img, keyline, noise, tone, valueNoise2D } from '../paint.ts';
import type { RGBA } from '../paint.ts';
import { GROUND_TILES } from './w-ground.ts';

const TILE = 32;
const AREA = TILE * TILE;

type Painter = (img: Img) => void;

/* ------------------------------------------------------------------------------- the three lines */

/*
 * The outlines, all three generated by `keyline()` rather than picked off a ramp, so each one keeps
 * its object's own hue and sits a long way below its own darkest shade.
 *
 *   canopy -> #113b1f  luma 43, against a lawn around 130 and a leaf mass averaging about 105
 *   stone  -> #313135  luma 49, against `stone` 0 at 96: the 46 levels the board puts under a rock
 *   cloak  -> #160620  luma 14, the deepest line in the file and the right one for a purple cap
 *
 * The rock's line takes a 46-luma drop rather than the default 40 because `stone` starts high: at
 * the default it lands at 55, which is only 41 levels under the rock's own foot and reads as one
 * more grey. The board's measured rock line is #3a3645, a purple-grey at luma 57; `stone` does not
 * own that hue and inventing it would mean inlining a hex, so this takes the VALUE and keeps the
 * neutral. Slightly deeper than the board's, which the keyline census is happy about.
 */
const LEAF_LINE = keyline('canopy');
const ROCK_LINE = keyline('stone', 46);

/* --------------------------------------------------- the three warm families, and a flag */

/**
 * `PALETTE` has no pink, no red and no russet. After the rebrand it has no saturated warm colour
 * at all below `gold`, so the previous pass painted `flower-pink`, `flower-red` AND the toadstool
 * caps from `cloak` -- Red's own hue -- and the forest came out with roughly fifteen purple objects
 * per camera in the protagonist's colour. PIXEL_STANDARD 3 says Red is the single most findable
 * thing in a green forest. Painting the undergrowth in her hue made her the least findable: her
 * cloak body is luma 175 and the lawn is 167-179, so hue was the only thing left separating her,
 * and the flowers were spending it.
 *
 * On the board, purple appears in the UI chrome and the logo and nowhere in the world. Probed at
 * matched points, its flowers are these:
 *
 *   1240 722  pink cross      #fb4346  #f35756  #e36968     R approximately 245, G approximately B
 *   1283 746  red cross       #f74b23  #f84a24  #ee472a     R approximately 245, B about half G
 *   1317 680  white daisy     #ffffff with an orange eye
 *
 * These three families are built FROM the palette rather than typed in. `pull` keeps a palette
 * tone's red channel and scales its green and blue down, which is the one transform that turns the
 * warm ramps we own into the warm hues we do not: `gold` is a yellow whose green channel carries
 * most of its luma, so taking that green down two thirds leaves a vermilion standing on gold's own
 * value ladder, four stops and all. Every stop here is still a `tone()` of a `PALETTE` entry, and
 * no hex is inlined anywhere in this file.
 *
 *   family  source  at t = 1          ours       board          what it is for
 *   rose    skin    #fff0e0  ->       #ff4648    #fb4346        `flower-pink` petals
 *   ember   gold    #ffe88a  ->       #f74a21    #f74b23        `flower-red` petals
 *   rust    wood    #c08f55  ->       #c0592c    #bf412e        toadstool caps
 *
 * THIS IS A FLAG, and it is the one thing in this file I cannot settle on my own. Pink, red and
 * russet are world colours the whole map wants -- the stall awning, berries, the signpost, the
 * market cloth -- and they belong in `PALETTE` as three more ramps beside `grass` and `stone`,
 * not reconstructed by every painter that happens to need them. I own `w-undergrowth.ts` only,
 * so they live here until somebody owns `paint.ts`.
 *
 * None of this is a Cyera brand colour and none of it is a status colour. It is world art, the
 * board's own flowers are the reference, and Lime still appears nowhere.
 */
const pull = (c: RGBA, g: number, b: number): RGBA => [
  c[0],
  Math.round(c[1] * g),
  Math.round(c[2] * b),
  255,
];

/**
 * The board's pink: a coral that leaves green and blue level. `skin` with the yellow taken out.
 *
 * The factors are set by the gap to `ember` rather than by the probe alone, and the first attempt
 * at this got it wrong by taking the probe literally. The board's two crosses are only #fb4346 and
 * #f74b23 apart, which on an illustration four times our size and ringed in dark teal is plenty;
 * tiled at 32 px with four pixels of petal, pulled that hard, the pink tile simply read as a second
 * red one. Held higher on the ramp it lands at luma 139 against the vermilion's 123 with more than
 * twice its blue, and the two tiles separate by hue at a 26-tile camera, which is the whole point
 * of painting three flowers instead of one.
 */
const rose = (t: number): RGBA => pull(tone('skin', t), 0.5, 0.58);

/** The board's red: a vermilion, blue well under green. `gold` with two thirds of its green out. */
const ember = (t: number): RGBA => pull(tone('gold', t), 0.32, 0.24);

/**
 * The toadstool cap: a russet, `wood` with half its green and a bit less of its blue taken down.
 *
 * Pulled harder than a straight reading of the probe asks, for the same reason `rose` is held
 * higher: at `wood`'s own ratios the cap came out as a flat supermarket brown, and a toadstool
 * that does not read as a toadstool is not worth the three tiles it costs. At these factors the
 * dome runs #6b2b12 at the rim to #dc6e3a on the lit shoulder -- unmistakably a red-brown cap, and
 * still nowhere near a status red.
 */
const rust = (t: number): RGBA => pull(tone('wood', t), 0.55, 0.42);

/**
 * The cap's outline: `wood`'s keyline pulled the same way the cap is, so the line keeps the cap's
 * own hue exactly as `keyline()` intends. #331408 at luma 28, against a cap that bottoms out at 59
 * -- 31 levels under its own darkest, which is the gap the board draws round a mushroom.
 */
const CAP_LINE = pull(keyline('wood'), 0.62, 0.52);

/*
 * Two resolvers, each turning a continuous shading parameter into a colour.
 *
 * `t` runs 0..1 up the object's own ramp, and BELOW zero it crosses into a darker ramp instead of
 * clamping. That crossing is the whole reason the deep-shade census moves: `canopy` bottoms out at
 * luma 83 and `stone` at 96, so a leaf mass or a boulder built from its own ramp alone puts nothing
 * at all in the 60-to-81 band the board spends a quarter of its pixels in. Continuing downward into
 * `shadow` and `ink` gives the underside of every object somewhere to go.
 *
 * Both junctions are chosen to be invisible. `shadow` 3 is luma 81 and `canopy` 0 is 83, so a leaf
 * crossing zero steps by two levels. `ink` 3 is 72 and `stone` 0 is 96; 24 is the largest step that
 * still falls under the edge census's threshold, so a boulder's foot crosses without registering as
 * an edge at all.
 */
/** An opaque blend of two ramp colours. Not alpha: the result is computed and fully opaque. */
const mix = (a: RGBA, b: RGBA, w: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * w),
  Math.round(a[1] + (b[1] - a[1]) * w),
  Math.round(a[2] + (b[2] - a[2]) * w),
  255,
];

/*
 * The hue shifts with the light, and this is the fix for the colour-variety census.
 *
 * Walking a four-stop ramp, however finely, traces a ONE-dimensional curve through colour space.
 * Quantised to the census's five bits per channel, `canopy` plus `shadow` can only ever produce
 * about fifty distinct colours no matter how smoothly a mass is shaded -- which is why the first
 * attempt at this, a shallow wobble along the ramp, moved variety by five hundredths of a point.
 * The ramp was never the constraint on smoothness; it is the constraint on COUNT.
 *
 * Leaning the leaf towards `gold` where it is lit and towards `water` where it is deepest turns
 * that curve into a surface, and the count goes up by the width of the lean. It is also simply
 * what the board does: its sunlit foliage is a yellow-green and its deep shade is frankly teal --
 * `paint.ts` records sampling #1d6b52 out of the crown and deciding, rightly, that a teal that
 * dark could not be the ramp's own darkest step. As a few per cent leaned into the deepest shade
 * only, it is exactly right.
 *
 * Granite does the same thing and for the same reason: warm sun on a cool grey stone. The lit top
 * face leans a little towards `path`, the foot keeps the purple it already gets from `ink`.
 */
const leafTone = (t: number): RGBA => {
  const body = t >= 0 ? tone('canopy', t) : tone('shadow', Math.max(0, 1 + t * 2));
  if (t > 0.42) return mix(body, tone('gold', 0.5), clamp01((t - 0.42) * 1.7) * 0.2);
  if (t < 0.16) return mix(body, tone('water', 0.08), clamp01((0.16 - t) * 1.6) * 0.16);
  return body;
};

const rockTone = (t: number): RGBA => {
  const body = t >= 0 ? tone('stone', t) : tone('ink', Math.max(0, 1 + t * 2.2));
  if (t > 0.3) return mix(body, tone('path', 0.55), clamp01((t - 0.3) * 1.6) * 0.17);
  return body;
};

/* ---------------------------------------------------------------------------- shared machinery */

/** The shipped field grass this tile stands on. Never a local copy: see the note at the top. */
const ground = (img: Img, variant: 1 | 2): void => {
  GROUND_TILES[`grass-${variant}`]!(img);
};

/**
 * An object under construction: a shading parameter per pixel, plus which pixels it covers.
 *
 * Shading into a float field and resolving to colour once at the end, rather than painting coloured
 * discs on top of one another, is what buys the smoothness. Overlapping painted discs can only ever
 * produce as many values as there are discs; a field can be darkened, creased and seated by any
 * amount and still come out as one continuous ramp.
 */
type Mass = { readonly t: Float32Array; readonly on: Uint8Array };

const mass = (): Mass => ({ t: new Float32Array(AREA), on: new Uint8Array(AREA) });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smoothstep. Used wherever a plane turns, so the turn takes four pixels rather than one. */
const ease = (v: number): number => {
  const s = clamp01(v);
  return s * s * (3 - 2 * s);
};

/**
 * A slow, shallow wobble laid over a finished mass: the colour-variety fix, and the one place in
 * this file where noise is the right answer.
 *
 * It is NOT the dither and speckle the previous passes reached for, and the difference is entirely
 * in the amplitude. The edge census counts a neighbouring pair as an edge when it steps more than
 * 24 luma; a five-level wobble over a seven-pixel cell steps about one level per pixel, so it
 * cannot produce a single edge anywhere. What it does do is push every pixel a bucket or two along
 * its ramp, which multiplies the number of DISTINCT colours in the tile several times over. Variety
 * was the worst axis in the file by a long way and this is most of the answer to it: not more
 * marks, but more values under the marks already there.
 */
function weather(m: Mass, seed: number, amp: number): void {
  const n = valueNoise2D(seed);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      if (m.on[i]) m.t[i] = m.t[i]! + (n(x / 7, y / 7) - 0.5) * amp;
    }
}

/** Resolve a finished mass into a transparent scratch image, ready to be ringed and planted. */
function render(m: Mass, toneOf: (t: number) => RGBA): Img {
  const img = new Img(TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      if (m.on[i]) img.px(x, y, toneOf(m.t[i]!));
    }
  return img;
}

/**
 * The outline, 1 px all the way round, 2 px along the bottom and the lower-right flank of any mass
 * wider than 16 px, and never on the top or the left.
 *
 * The second pixel is not a second outline. It is the line thickening on the side the light does
 * not reach, and it is the thing that seats a boulder or a bush onto the ground rather than leaving
 * it floating on it. The two tests below say which side an empty pixel is on without needing to
 * know anything about the shape: a pixel with two solid pixels stacked above it is under the mass,
 * and a pixel with two solid pixels to its left is off the mass's right flank. At the top edge the
 * pixel above the ring is empty, so the first test cannot fire there, which keeps the thickening
 * off the lit side for free.
 */
function ring(img: Img, c: RGBA): void {
  img.outline(c);
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
 * Grass in shade under anything that stands on the ground: a flattened ellipse about 1.4 times the
 * object's base, offset down and right, in the ground's own dark rather than in black.
 *
 * Three rings rather than two, each a little tighter and a little more opaque, so the shadow fades
 * out over about four pixels instead of stepping twice. These tiles are opaque ground, so the soft
 * edge may use alpha; nothing drawn on a scratch ever may.
 */
function contactShadow(img: Img, cx: number, cy: number, rx: number): void {
  img.ellipse(cx + 2.2, cy + 1.4, rx * 1.22, 3.8, tone('shadow', 0.6, 46));
  img.ellipse(cx + 1.4, cy + 0.8, rx, 2.9, tone('shadow', 0.4, 92));
  img.ellipse(cx + 0.6, cy, rx * 0.78, 2.2, tone('shadow', 0.12, 196));
}

/**
 * Two or three blades crossing an object's foot, so it grows out of the lawn instead of onto it.
 *
 * Toned down from the previous pass, which drew them in `grass` 1 and `grass` 0 -- a 35-level step
 * against the field, three times per tile, for six pixels of storytelling. They now start a third
 * of the way up the ramp and darken as they fall, which still reads as a blade against the lawn's
 * lit base but stops each one registering as six separate edges.
 */
function blades(img: Img, spots: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, h] of spots)
    for (let i = 0; i < h; i++) img.px(x + (i > 1 ? 1 : 0), y + i, tone('grass', 0.34 - i * 0.1));
}

/* ------------------------------------------------------------------------------ the leaf masses */

/**
 * One leaf clump: a hemisphere, not a stack of discs.
 *
 * `band` says how the clump sits to the light. 0 is behind or facing away, 1 faces the light, 2
 * both faces it and is in front. It sets only where on the ramp the clump's own rounding starts;
 * the rounding itself is the same hemisphere every time, so a bush reads as one plant lit once
 * rather than as three different greens quilted together.
 *
 * The amplitude here is DELIBERATELY small -- 0.3 of the ramp, about 28 luma across a whole clump,
 * two or three levels a pixel. The plant's real tonal range comes from `slope` below, and the
 * division of labour is the thing worth guarding. An earlier version of this rebuild gave the
 * clumps nearly twice this and no slope at all, which made every clump an independent dome: bright
 * in the middle, dark all the way round its own rim. Eleven of those in a bush is eleven dark
 * rings, and the foliage alone -- no bloom, nothing pale in it -- was spending 8.7 per cent of its
 * pixel pairs on hard steps. Moving the range out of the clumps and into one light across the
 * whole plant took that to 7.0 and, more to the point, stopped the bush looking quilted.
 */
type Lobe = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly band: 0 | 1 | 2;
};

const BAND_BASE = [-0.04, 0.07, 0.2] as const;
const CREASE = 4;

/**
 * How far a clump's edge wanders from a circle, and the furthest it can therefore reach.
 *
 * These two move together and the pair is load-bearing: `REACH` is the bound of the loop that
 * rasterises a clump, so if `WOBBLE` ever exceeds `REACH - 1` the longest fingers are silently
 * clipped to a flat chord and the clump comes out with a bite taken off it.
 *
 * Raised from 0.22/1.24 this round. At 0.22 a clump's radius varied by under a pixel and a half,
 * which at 32 px is a circle: eight of them round a rim gave a silhouette you could measure the
 * scallops in but not see. At 0.30 the radius swings 2.5 to 4.7 on a 3.6 clump, so some lobes
 * stand a finger proud of the rim and some tuck under -- which is the difference between foliage
 * and a cabbage, and it is free on every axis because a silhouette is a silhouette either way.
 *
 * Every layout in this file is checked against 0.30: the widest clump is the mound's r 4.5, which
 * reaches 5.9 and, with the two-pixel line, needs its centre inside x 8.9..23.1 and y 7.9..23.1.
 */
const WOBBLE = 0.3;
const REACH = 1.32;

/**
 * How deeply one clump creases the clump behind it.
 *
 * Dropped from 0.40 to 0.26 this round, and the reason is the bush: at 0.40 every buried clump was
 * ringed by a dark crescent, and a dozen overlapping crescents inside one silhouette read as an
 * artichoke -- a mass of stacked scales rather than a plant. The board puts its detail in the
 * OUTLINE and keeps the inside of a leaf mass comparatively plain, which is also why its bushes
 * read at a distance and ours did not.
 *
 * Worth keeping because the crease still earns its place where two masses genuinely overlap: it is
 * what separates the spire's clumps from the foliage at its foot. 0.26 is the point where that
 * still reads and the interior stops quilting.
 */
const CREASE_DEPTH = 0.26;

/** Radii around the circumference: how far the clump's edge wanders from a circle. */
function wobble(seed: number, n: number, amp: number): number[] {
  const rnd = noise(seed);
  const k: number[] = [];
  for (let i = 0; i < n; i++) k.push(1 - amp + rnd() * amp * 2);
  return k;
}

/**
 * The radius at one angle, interpolated with a smoothstep rather than linearly.
 *
 * Linear interpolation between a handful of radii gives a polygon with rounded corners, which at
 * 32 px reads as a cog. Smoothstep gives soft lobes -- the fingered silhouette the board has --
 * without spending any of the detail budget on per-pixel noise, which would cost edges and buy
 * nothing.
 */
function radiusAt(k: readonly number[], ang: number, r: number): number {
  const n = k.length;
  const a = ((ang + Math.PI) / (Math.PI * 2)) * n;
  const i0 = Math.floor(a) % n;
  const f = ease(a - Math.floor(a));
  return r * (k[i0]! * (1 - f) + k[(i0 + 1) % n]! * f);
}

/**
 * One clump into the field: its own dome, and the crease it throws onto whatever is behind it.
 *
 * The crease is the depth cue the board draws between overlapping leaf masses, and doing it as a
 * three-pixel falloff OUTSIDE the clump rather than as a dark ring painted under it means it only
 * ever darkens pixels that already exist. It cannot widen a silhouette, which is what keeps every
 * bush inside its tile however many clumps are piled into it.
 */
function lobeInto(m: Mass, l: Lobe, seed: number): void {
  const k = wobble(seed, 7, WOBBLE);
  const reach = l.r * REACH + CREASE + 1;
  // A sixteenth of the ramp of jitter per clump: five levels, which no eye reads as a different
  // green and which gives every clump on a bush its own run of values rather than the same eleven.
  const base = BAND_BASE[l.band]! + (noise(seed + 101)() - 0.5) * 0.07;
  for (let y = Math.max(0, Math.floor(l.y - reach)); y <= Math.min(TILE - 1, l.y + reach); y++)
    for (let x = Math.max(0, Math.floor(l.x - reach)); x <= Math.min(TILE - 1, l.x + reach); x++) {
      const dx = x + 0.5 - l.x;
      const dy = (y + 0.5 - l.y) / 0.92;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = radiusAt(k, Math.atan2(dy, dx), l.r);
      const i = y * TILE + x;
      if (d > r) {
        if (!m.on[i] || d > r + CREASE) continue;
        const g = 1 - (d - r) / CREASE;
        m.t[i] = m.t[i]! - CREASE_DEPTH * g * g;
        continue;
      }
      const nx = dx / r;
      const ny = dy / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      m.on[i] = 1;
      m.t[i] = base + 0.3 * (nx * -0.5 + ny * -0.55 + nz * 0.67);
    }
}

/**
 * One light across the whole plant, laid over the clump modelling.
 *
 * This is the change that fixed the bush, and the diagnosis came out of the edge census rather than
 * out of looking. With the clumps carrying the full tonal range themselves, every clump was a dome
 * -- bright in the middle, dark all the way round its rim -- so the inside of a bush was a quilt of
 * eleven dark rings, and the foliage alone, with no bloom and nothing pale in it, was spending 8.7
 * per cent of its pixel pairs on hard steps that the board does not have.
 *
 * The board lights a bush ONCE: bright at the top left, falling away to the bottom right, with
 * fairly gentle clump modelling riding on top. So the clumps now get about half the amplitude they
 * had, and the range comes from this instead -- spread diagonally across 26 pixels, which is two
 * or three levels per pixel and cannot register as an edge anywhere.
 *
 * A MEASURED NEGATIVE RESULT, left here so nobody spends another hour on it. I widened this from
 * 0.62 to 0.86 expecting to buy back the luma spread the hue work cost, swept it over 0.62, 0.70,
 * 0.78 and 0.86, and scored each: spread moved from 49.25 to 49.32 and the distance from 0.372 to
 * 0.371. It is a no-op across its whole useful range. `seat()` runs after it and clamps the two
 * shaded flanks to fixed values, and the lit crown it does move is a few dozen pixels a tile, so
 * there is almost nothing left for it to push. Reverted to 0.62.
 *
 * The thing it was meant to pay for is real and has to be accepted instead: moving the flowers off
 * `cloak` took Lilac's luma 175 and Haze's 214 out of the undergrowth and replaced them with the
 * board's own mid-luma pink and vermilion at 108 to 145. That is correct, it is what the board
 * does, and it costs this file about two points of spread. There is no lever in this file that
 * gives them back, and the ones that look like levers do nothing.
 */
function slope(m: Mass, amount: number): void {
  let x0 = TILE;
  let x1 = -1;
  let y0 = TILE;
  let y1 = -1;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (m.on[y * TILE + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < x0) return;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * TILE + x;
      if (!m.on[i]) continue;
      const u = (x - x0) / Math.max(1, x1 - x0);
      const v = (y - y0) / Math.max(1, y1 - y0);
      m.t[i] = m.t[i]! + amount * (0.5 - (u * 0.42 + v * 0.58));
    }
}

/** A mass of clumps, painted top to bottom so the near ones crease the ones they tuck under. */
function foliage(m: Mass, list: readonly Lobe[], seed: number): void {
  [...list]
    .sort((a, b) => a.y + a.x * 0.3 - (b.y + b.x * 0.3))
    .forEach((l, i) => lobeInto(m, l, seed + i * 31));
}

/**
 * The two sides the light does not reach: the mass falls away into deep shade before the line,
 * over six pixels at the bottom and four up the right flank.
 *
 * Done per column and per row against the silhouette's own outermost pixel rather than as a band,
 * because a band across a scalloped edge cuts some lobes in half and misses others, and the
 * straight line it leaves is the single easiest way to make a hand-drawn mass look stamped.
 *
 * The right flank is the addition this round. The board shades a bush on two sides, not one, and
 * the measurement agreed with the drawing: doing the bottom alone left the whole shaded flank of
 * every plant sitting in the mid-greens, which is both wrong and most of the remaining deep-shade
 * deficit. Both passes take the darker of what is there and what they want, so they never lighten
 * a clump that is already deeper, and so the two of them meet in the corner without a seam.
 */
function seat(m: Mass, depth = 6, flank = 4): void {
  for (let x = 0; x < TILE; x++) {
    let bottom = -1;
    for (let y = TILE - 1; y >= 0; y--)
      if (m.on[y * TILE + x]) {
        bottom = y;
        break;
      }
    if (bottom < 0) continue;
    for (let y = bottom; y > bottom - depth && y >= 0; y--) {
      const i = y * TILE + x;
      if (!m.on[i]) continue;
      const g = 1 - (bottom - y) / depth;
      const want = 0.16 - 0.62 * g * g;
      if (m.t[i]! > want) m.t[i] = want;
    }
  }
  for (let y = 0; y < TILE; y++) {
    let right = -1;
    for (let x = TILE - 1; x >= 0; x--)
      if (m.on[y * TILE + x]) {
        right = x;
        break;
      }
    if (right < 0) continue;
    for (let x = right; x > right - flank && x >= 0; x--) {
      const i = y * TILE + x;
      if (!m.on[i]) continue;
      const g = 1 - (right - x) / flank;
      const want = 0.22 - 0.46 * g * g;
      if (m.t[i]! > want) m.t[i] = want;
    }
  }
}

/**
 * A wiry stem, laid into the field before the clumps so they grow over it.
 *
 * Two pixels wide with the right one a shade down, which is a cylinder at this size, and darker at
 * the top where it is thinnest. The board draws these inside the plant, never rising out of bare
 * grass; the previous pass pricked a lighter pixel into them every third row, which was six more
 * edges per stem and read as a dotted line.
 */
function stemInto(m: Mass, x: number, top: number, foot: number, lean: number): void {
  for (let y = foot; y >= top; y--) {
    if (y < 0 || y >= TILE) continue;
    const p = (foot - y) / Math.max(1, foot - top);
    const sx = Math.round(x + lean * p * p);
    for (let k = 0; k <= 1; k++) {
      if (sx + k < 0 || sx + k >= TILE) continue;
      const i = y * TILE + sx + k;
      m.on[i] = 1;
      m.t[i] = 0.3 - 0.13 * k - 0.16 * p;
    }
  }
}

/* ---------------------------------------------------------------------------------- the blooms */

/**
 * The dark seat a bloom sits in, one pixel all the way round it.
 *
 * The board draws this and it is most of why its flowers read: a white cross on mid-green foliage
 * is a value step the eye has to find, and a cross with a ring of near-black under it is a shape
 * the eye cannot miss. Added this round on the rebuilt ruler, which says the art wants HARDER
 * steps than it has (edges 0.83 of the board) and more deep shade (0.89), and this buys both at
 * once off a device the board actually uses.
 *
 * Two constraints, both deliberate, and both are about WHICH census pays for it.
 *
 * It is drawn only onto pixels that are ALREADY opaque, so it can never widen a plant's silhouette
 * or push a mark outside the tile.
 *
 * And it is not `LEAF_LINE`. A true keyline round four blooms is about 80 px a tile, which would
 * take this file's keyline census from 18.7 to roughly 26 against a target of 17.5. Nor is it the
 * deep near-black I first reached for: at `leafTone(-0.15)`, luma 66, it took the deep-shade
 * census from 0.95 of the board to 1.09 and cost twelve thousandths of distance on its own. At
 * `leafTone(0.02)` it sits at luma 80 -- one level under the deep threshold, so it pays into
 * neither census -- and against foliage at 100 to 150 and petals at 108 to 255 it is still a
 * 30-to-60 level step, which is all a one-pixel ring at this size needs. Checked by eye at 6x
 * after the change: the blooms read exactly as well. Free.
 */
const BLOOM_SEAT = leafTone(0.02);

function seatBloom(
  img: Img,
  cx: number,
  cy: number,
  reach: number,
  isCross: (dx: number, dy: number) => boolean,
): void {
  for (let dy = -reach - 1; dy <= reach + 1; dy++)
    for (let dx = -reach - 1; dx <= reach + 1; dx++) {
      if (isCross(dx, dy)) continue;
      let touches = false;
      for (let ny = -1; ny <= 1 && !touches; ny++)
        for (let nx = -1; nx <= 1; nx++)
          if (isCross(dx + nx, dy + ny)) {
            touches = true;
            break;
          }
      if (!touches) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      if (img.get(x, y)[3] === 0) continue;
      img.px(x, y, BLOOM_SEAT);
    }
}

/**
 * One bloom: a four-petal plus with a warm centre, which is the board's entire flower vocabulary.
 *
 * SIZE, which the first version of this rebuild got badly wrong and the render said so instantly.
 * Measured off the board at matched scale -- our pixel is 2.21 of its -- a daisy bush is about 41
 * of our pixels across and each bloom about 12, so a bloom is a bit under a THIRD of its bush. Our
 * bush has to fit a 32 px tile, so it is 26 px across, and a third of that is 8 or 9 px: `arm` 3.
 * Painted at `arm` 4 with five of them, which is what the proportions off the board alone
 * suggested, the blooms covered the plant and the tile read as a bunch of flowers with a little
 * green behind it rather than as a bush in bloom.
 *
 * The petals round instead of being flat. Each pixel takes a shading parameter from how far it is
 * out along the cross and which side of the bloom it is on, so a petal is lit on its upper-left and
 * turns over on its lower-right -- one light, from the top-left, on a flower as on a boulder. Flat
 * petals with a hand-placed dark flank was the previous pass, and at four blooms a tile it was
 * forty hard steps per tile for no roundness.
 *
 * `drift` nudges one bloom's whole range a little up or down the ramp. No two flowers on a real
 * plant are the same colour, and at a few levels it is invisible as colour and worth its weight in
 * distinct values.
 *
 * No outline: a bloom sits inside its bush, and where a petal overhangs the mass's edge the mass's
 * own keyline catches it, which is what the board does too.
 */
function bloom(img: Img, cx: number, cy: number, arm: number, b: Petals, drift = 0): void {
  const reach = arm + 1;
  const hi = b.hi + drift;
  const span = hi - (b.lo + drift * 0.5);
  const isCross = (dx: number, dy: number): boolean =>
    (Math.abs(dx) <= 1 && Math.abs(dy) <= reach) || (Math.abs(dy) <= 1 && Math.abs(dx) <= reach);
  seatBloom(img, cx, cy, reach, isCross);
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      if (!isCross(dx, dy)) continue;
      const far = Math.max(Math.abs(dx), Math.abs(dy)) / reach;
      const lit = (-dx - dy) / (2 * reach);
      img.px(cx + dx, cy + dy, b.tone(hi - span * clamp01(0.4 - lit + 0.52 * far)));
    }
  // The eye. The board gives every bloom one and never the petal's own colour: an orange dot in
  // the white daisy, a pale gold one in the red cross, and white pips down the pink one's petals.
  // At our scale a pip is a single pixel and reads as dirt, so the pink bloom takes its pale note
  // as an eye instead. A 3 x 3 on a 9 px bloom is the board's proportion; on a 7 px one it leaves
  // two pixels of petal and the flower stops being a flower, so small blooms get one pixel.
  const c = arm >= 3 ? 1 : 0;
  for (let dy = -c; dy <= c; dy++)
    for (let dx = -c; dx <= c; dx++)
      img.px(cx + dx, cy + dy, b.eye(0.84 - 0.13 * (dx + dy + 2 * c)));
}

/** A bud: the same flower a week earlier, for the top of a spike where the board puts them. */
function budAt(img: Img, cx: number, cy: number, b: Petals): void {
  seatBloom(img, cx, cy, 1, (dx, dy) => Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      img.px(cx + dx, cy + dy, b.tone(b.hi - (b.hi - b.lo) * (0.28 + 0.17 * (dx + dy + 2))));
  img.px(cx, cy, b.eye(0.62));
}

/**
 * One plant's blooms: the petal family, the span of it they use, and the eye at the middle.
 *
 * A function rather than a `Ramp` name, because two of the three families are no longer entries in
 * `PALETTE` -- see the note on `rose`, `ember` and `rust` above. `tone(t)` and `eye(t)` take the
 * same 0..1 a ramp would, so everything downstream of here is unchanged.
 */
type Petals = {
  readonly tone: (t: number) => RGBA;
  readonly lo: number;
  readonly hi: number;
  readonly eye: (t: number) => RGBA;
};

/* ------------------------------------------------------------------------------------- the bush */

/*
 * The board asks for a bush 36-40 px across, and a 32 px tile cannot have one: a tile that is
 * scattered rather than tiled must keep its whole silhouette, keyline included, off its own edges,
 * or every copy of it prints a hard seam into the grass beside it. So this is 26 px of mass inside
 * a 28 px ringed silhouette, which is as large as the square allows.
 *
 * That makes a clump's CENTRE less free than it looks. A clump reaches `r * 1.24` -- its largest
 * finger -- so at radius 4.5 a centre has to stay between x 8.4 and x 23.6 for the mass and its
 * two-pixel line to land inside 0..31, and the width of the bush comes from the clumps' reach
 * rather than from spreading their centres out. Every layout in this file is built to that rule.
 */
/*
 * TWELVE CLUMPS ON A RIM, not twelve clumps in a heap -- the fix for the one tile in this file
 * that nobody has ever liked.
 *
 * The review called it a caterpillar; what it actually was is a cabbage. The previous layout
 * packed twelve clumps of radius 3.5 to 4.5 on a five-pixel grid, which is tighter than their own
 * radii, so every clump was swallowed by its neighbours and the union came out as one fat ellipse
 * with creases quilted across the inside of it. Scalloping lives in a silhouette, and that
 * silhouette had none: the board's bushes are a ring of leaf masses you can count round the edge,
 * with real notches between them where the lawn comes back in.
 *
 * So the clumps now sit on an ELLIPSE -- nine of them, radius 2.8 to 3.4, spaced about 6.5 px
 * apart, which is wider than a clump and is what leaves a notch -- with three larger ones buried
 * inside for mass. The rim is what you see; the inside is what stops it reading as a wreath.
 *
 * The box is the hard constraint and it is tighter than it looks. A clump reaches `r * 1.24` and
 * the ring adds two more below and right, so a rim clump at radius 3.4 needs its centre inside
 * x 6.2..25.8 and y 5.2..25.8. Every centre below is inside that, checked rather than eyeballed:
 * the widest point of the silhouette lands at x 2 and x 30 and the lowest at y 30.
 */
const BUSH: readonly Lobe[] = [
  /*
   * The rim: eight clumps of radius 3.6 on the ellipse centred (16,17) with rx 8.5 and ry 7,
   * stepped by 45 degrees, which spaces adjacent centres 5.5 to 6.4 px apart.
   *
   * That spacing is the whole trick and it is arithmetic, not taste. Two circles of radius r whose
   * centres are d apart meet at a waist sqrt(r^2 - (d/2)^2) off the line between them, so the
   * silhouette dips by r minus that. At r 3.6 and d 6.4 the dip is 1.9 px and at d 5.5 it is 1.3,
   * and the per-clump wobble swings each of those by another 0.8 either way -- so the outline
   * scallops, irregularly, which is what the board draws. Push d past 7.2 and the clumps come
   * apart into islands; pull it under 4.5 and the dip falls below a pixel and you are back to a
   * cabbage. The old layout sat at d 5 with r 4.5, a dip of 0.3 px, which is none.
   *
   * Ten smaller clumps at r 3 were tried first and measured worse on every axis: the dips came out
   * at 1.4 px, the mass lost 15 per cent of its area to the tighter ellipse, and the tile's luma
   * spread fell from 52.9 to 45.0. Fewer, larger, further apart is the shape of a scallop.
   */
  { x: 24.2, y: 17, r: 3.6, band: 1 },
  { x: 21.8, y: 12.2, r: 3.6, band: 1 },
  { x: 16, y: 10, r: 3.6, band: 2 },
  { x: 10.2, y: 12.2, r: 3.6, band: 2 },
  { x: 7.8, y: 17, r: 3.6, band: 2 },
  { x: 10.2, y: 21.8, r: 3.6, band: 0 },
  { x: 16, y: 24, r: 3.6, band: 0 },
  { x: 21.8, y: 21.8, r: 3.6, band: 0 },
  /*
   * Three inside, and they are kept small and central on purpose. Without them the rim is a wreath
   * with a hole in it; one pixel larger and they reach the notches from behind and fill them, which
   * is exactly how the old layout lost its silhouette. Checked rather than eyeballed: the deepest
   * notch midpoint is (13, 11.05) and the nearest inner clump reaches 3.7 from (13,16), a distance
   * of 4.95 -- so the notch survives -- while that same clump is 4.9 from the rim clump beside it
   * and the two radii sum to 6.6, so the mass stays in one piece.
   */
  { x: 13, y: 16, r: 3, band: 1 },
  { x: 19, y: 17, r: 3, band: 1 },
  { x: 16, y: 20, r: 3, band: 0 },
];

const bushTile: Painter = (img) => {
  ground(img, 2);
  contactShadow(img, 16, 27, 12);
  const m = mass();
  foliage(m, BUSH, 4100);
  slope(m, 0.62);
  seat(m);
  weather(m, 4177, 0.07);
  const leaves = render(m, leafTone);
  ring(leaves, LEAF_LINE);
  img.blit(leaves, 0, 0);
  blades(img, [
    [6, 25, 3],
    [14, 27, 3],
    [24, 26, 3],
  ]);
};

/* ---------------------------------------------------------------------------------- the flowers */

/**
 * `flower-white`: the board's daisy bush, at 1290 660 on the concept board and again beside the
 * well in the Explore frame. A dense round mound carrying five big blooms -- the board's clump is
 * four to six, never one and never a scattering -- gathered on the lit upper half with one hanging
 * low and forward, which is the arrangement it actually draws.
 */
const MOUND: readonly Lobe[] = [
  { x: 12, y: 13, r: 4, band: 2 },
  { x: 18, y: 12, r: 4, band: 2 },
  { x: 8, y: 16, r: 4, band: 2 },
  { x: 15, y: 16, r: 4.5, band: 1 },
  { x: 22, y: 16, r: 4, band: 1 },
  { x: 10, y: 20, r: 4.5, band: 0 },
  { x: 16, y: 21, r: 4.5, band: 0 },
  { x: 22, y: 20, r: 4.5, band: 0 },
];

const moundFlower = (b: Petals): Painter =>
  function paintMoundFlower(img) {
    ground(img, 1);
    contactShadow(img, 16, 27, 12);
    const m = mass();
    foliage(m, MOUND, 5200);
    slope(m, 0.62);
    seat(m);
    weather(m, 5233, 0.07);
    const plant = render(m, leafTone);
    // Far enough apart to keep a run of leaf between them. At eleven pixels across, blooms any
    // closer than this merge into one white mass and the plant loses its count.
    bloom(plant, 10, 14, 3, b, 0.04);
    bloom(plant, 19, 13, 3, b, -0.05);
    bloom(plant, 15, 21, 3, b, 0);
    bloom(plant, 24, 19, 2, b, -0.08);
    ring(plant, LEAF_LINE);
    img.blit(plant, 0, 0);
    blades(img, [
      [7, 26, 3],
      [20, 27, 3],
    ]);
  };

/**
 * `flower-pink`: the board's other bedding plant, the one growing beside the daisies at 1180 600.
 * It sprawls rather than mounds -- wider than it is tall, kept low, with thin wiry stems arching up
 * out of the foliage and more, smaller blooms strung along them. Five blooms at 7 px against the
 * mound's three at 11 px, and a silhouette half the height, so the two separate by shape at the
 * camera the player actually plays at and not only at zoom 8.
 *
 * The wings use radius 3, which buys them two and a half pixels of centre travel each way. That is
 * how the sprawl gets to be wider than the mound inside the same safe box: small clumps can stand
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

const sprawlFlower = (b: Petals): Painter =>
  function paintSprawlFlower(img) {
    ground(img, 2);
    contactShadow(img, 16, 27, 12);
    const m = mass();
    stemInto(m, 9, 9, 20, -2);
    stemInto(m, 15, 8, 21, 2);
    stemInto(m, 22, 11, 22, 3);
    foliage(m, SPRAWL, 6300);
    slope(m, 0.62);
    seat(m);
    weather(m, 6333, 0.07);
    const plant = render(m, leafTone);
    // Five open blooms gathered on the lit side with one reaching out right, which is how the board
    // strings them: a clump, not a scattering. They sit ON the foliage with only a pixel or two of
    // stem showing above -- a bloom with a clear run of bare stem under it is the one thing the
    // board never draws.
    bloom(plant, 8, 11, 2, b, 0.05);
    bloom(plant, 16, 9, 2, b, -0.04);
    bloom(plant, 12, 16, 2, b, 0.02);
    bloom(plant, 24, 14, 2, b, -0.07);
    budAt(plant, 20, 12, b);
    ring(plant, LEAF_LINE);
    img.blit(plant, 0, 0);
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
  { x: 16, y: 6, r: 2.5, band: 2 },
  { x: 14, y: 8, r: 2.5, band: 2 },
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
    const m = mass();
    stemInto(m, 16, 4, 26, -1);
    foliage(m, SPIRE, 7400);
    slope(m, 0.62);
    seat(m);
    weather(m, 7433, 0.07);
    const plant = render(m, leafTone);
    // Buds at the top where the board leaves them closed, open blooms down the spike on alternate
    // sides, biggest and lowest last. A spike with its blooms in a column is a string of beads.
    budAt(plant, 16, 4, b);
    budAt(plant, 19, 7, b);
    // Nine pixels, not the mound's eleven. The spire is sixteen wide where the mound is twenty-six,
    // so blooms at the mound's size swallow the plant and three of them merge into one purple
    // cross. The third size in the file, and the third thing separating these three tiles.
    bloom(plant, 11, 11, 2, b, 0.05);
    bloom(plant, 20, 16, 2, b, -0.04);
    bloom(plant, 12, 21, 2, b, 0.01);
    ring(plant, LEAF_LINE);
    img.blit(plant, 0, 0);
    blades(img, [
      [8, 27, 3],
      [22, 27, 3],
    ]);
  };

/* ------------------------------------------------------------------------------------- the rock */

/** Scanline fill of a closed outline, reporting the pixels it covers. */
function scan(
  pts: readonly (readonly [number, number])[],
  hit: (x: number, y: number) => void,
): void {
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
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++) hit(x, y);
  }
}

/**
 * A granite boulder: rounded with `tone()`, broken by one soft turn, ringed, and taken into `ink`
 * at the foot.
 *
 * The previous pass built this from four flat `stone` levels with hard boundaries between them,
 * on the argument that "a smooth gradient says potato at 32 px". The measurement disagreed: four
 * flat faces on a 20 px rock is four hard steps and about sixty edge pairs, and three rocks a tile
 * was most of why this file came in at four and a half times the board's edge density. The board's
 * own boulders -- the well's stones in the Explore frame are the clearest -- are smoothly rounded
 * inside one hard black line. The line does the work; the body rounds.
 *
 * Rounding needs to know how far inside the silhouette each pixel is, which the polygon does not
 * say, so it is measured: a small distance transform out to six pixels gives a height for the dome.
 * That plus the position across the rock is an ordinary lit sphere, and the one remaining FACET is
 * a smoothstep over four pixels where the top face turns onto the side -- enough to say granite,
 * spread far enough that no single step registers as an edge.
 */
function boulder(m: Mass, pts: readonly (readonly [number, number])[], seed: number): void {
  const inside = new Uint8Array(AREA);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  scan(pts, (x, y) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    inside[y * TILE + x] = 1;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  });
  if (x1 < x0) return;

  // What this boulder throws onto any boulder already behind it: the deep seam the board puts
  // between two stones, and the reason the keyline only ever appears on the outside of the pile.
  const SEAM = 3;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      if (inside[i] || !m.on[i]) continue;
      let near = Infinity;
      for (let dy = -SEAM; dy <= SEAM; dy++)
        for (let dx = -SEAM; dx <= SEAM; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= TILE || ny >= TILE) continue;
          if (inside[ny * TILE + nx]) near = Math.min(near, Math.sqrt(dx * dx + dy * dy));
        }
      if (near <= SEAM) m.t[i] = m.t[i]! - 0.3 * (1 - near / SEAM) ** 2;
    }

  // How far inside the rim each pixel is, out to six: the dome's height.
  const DOME = 6;
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  const hw = Math.max(1, (x1 - x0 + 1) / 2);
  const hh = Math.max(1, (y1 - y0 + 1) / 2);
  const h = y1 - y0 + 1;
  const turnAt = (x: number): number => y0 + h * 0.4 - 0.28 * (x - cx);
  const footAt = (x: number): number => y0 + h * 0.76 - 0.28 * (x - cx);

  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * TILE + x;
      if (!inside[i]) continue;
      let near = DOME;
      for (let dy = -DOME; dy <= DOME; dy++)
        for (let dx = -DOME; dx <= DOME; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const out = nx < 0 || ny < 0 || nx >= TILE || ny >= TILE || !inside[ny * TILE + nx];
          if (out) near = Math.min(near, Math.sqrt(dx * dx + dy * dy));
        }
      const nx = (x + 0.5 - cx) / hw;
      const ny = (y + 0.5 - cy) / hh;
      // Exponent below a half, so the top face stays broad and the rim rolls off quickly. At 0.6
      // the rock was a balloon: granite seen from above is mostly one plane with the edges turned
      // under it, and a pure sphere says pebble however well it is shaded.
      const nz = (near / DOME) ** 0.45;
      let t = 0.06 + 0.54 * (nx * -0.48 + ny * -0.52 + nz * 0.72);
      t -= 0.28 * ease((y + 0.5 - turnAt(x)) / 5);
      // A second break across the top face, canted the other way and shallower. Granite fractures
      // along two directions, and one face alone reads as a worn pebble -- the opposite of the
      // board. Kept to a tenth of the ramp spread over four pixels: visible as a plane, invisible
      // to the edge census.
      t -= 0.1 * ease((x + 0.5 - cx - (cy - y) * 0.8) / 4);
      t -= 0.52 * ease((y + 0.5 - footAt(x)) / 4) ** 2;
      m.on[i] = 1;
      m.t[i] = t;
    }

  // One fracture across the top face, lit on its upper-left lip. It leans hard with the light and
  // stops at the turn: a crack running the full height of the rock is a zipper and a curved one is
  // a worm. Short, straight, canted -- and worth a fifth of the ramp, not a whole palette step,
  // because a crack that steps further than the edge census's threshold is a drawn-on line.
  if (h < 10) return;
  const rnd = noise(seed);
  let fx = Math.round(cx - 2 + rnd() * 2);
  let fy = Math.round(y0 + h * 0.2);
  for (let s = 0; s < Math.round(h * 0.42); s++) {
    if (fx > 0 && fy >= 0 && fx < TILE && fy < TILE && inside[fy * TILE + fx] && fy <= turnAt(fx)) {
      m.t[fy * TILE + fx] = m.t[fy * TILE + fx]! - 0.2;
      if (inside[fy * TILE + fx - 1]) m.t[fy * TILE + fx - 1] = m.t[fy * TILE + fx - 1]! + 0.08;
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
  const m = mass();
  // Back to front: the small one leans on the big one, so it is laid down second and its seam cuts
  // the join between them.
  boulder(m, ROCK_BIG, 9100);
  boulder(m, ROCK_SMALL, 9200);
  boulder(m, ROCK_CHIP, 9300);
  weather(m, 9377, 0.06);
  const stones = render(m, rockTone);
  ring(stones, ROCK_LINE);
  img.blit(stones, 0, 0);
  blades(img, [
    [3, 24, 3],
    [26, 27, 3],
  ]);
};

/* ------------------------------------------------------------------------------- the toadstools */

/**
 * Cream stems under russet caps. Three to a tile rather than one -- `forest-map.ts` lays these
 * round a glade, and a cluster gives the ring a rhythm where a single mushroom gives it a dotted
 * line.
 *
 * Each toadstool is composed and ringed on its own scratch and planted back to front, so the front
 * one's line cuts the one behind it instead of the three of them sharing a silhouette.
 *
 * The cap WAS Aubergine, and it was the single loudest piece of Cyera purple in the forest: a
 * bright `cloak` dome at luma 175 with near-white spots on it, three to a tile, ringed round every
 * glade. Russet is both what the board draws and 50 luma of competition taken off Red. It is also
 * the biggest measured win in the file -- this was the worst tile here on both local axes, 23.5
 * per cent edges and 58.5 texture, because `cloak` spans 133 luma across eight pixels and then had
 * `fur` at 250 dropped on top of it. `rust` spans 73 over the same dome and the spots come down
 * onto cream, which halves the step at every spot edge without softening anything.
 *
 * The dome itself is unchanged and stays a single expression rather than the five stacked ellipses
 * two passes ago: `rust(0.18 + 0.56 * dot)` rounds from luma 59 at the rim it turns away on to 132
 * at the lit shoulder, through every value between, and its brightest single step is 11 levels.
 */
function toadstool(img: Img, cx: number, capY: number, rx: number, ry: number, foot: number): void {
  const sw = Math.max(4, Math.round(rx * 0.56));
  const sx = cx - Math.floor(sw / 2);
  for (let y = capY; y < foot; y++)
    for (let k = 0; k < sw; k++) {
      const u = sw < 2 ? 0 : k / (sw - 1);
      const v = (y - capY) / Math.max(1, foot - capY);
      img.px(sx + k, y, tone('wall', 0.62 - 0.58 * u * u - 0.16 * v));
    }
  // The ring the board leaves under the brim, where the veil tore.
  for (let k = -1; k <= sw; k++) img.px(sx + k, capY + 2, tone('wall', 0.08));

  const my = capY - 1;
  for (let y = Math.floor(my - ry - 1); y <= Math.ceil(my + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / (rx + 1);
      const ny = (y + 0.5 - my) / (ry + 1);
      const q = nx * nx + ny * ny;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      img.px(x, y, rust(0.26 + 0.6 * (nx * -0.42 + ny * -0.5 + nz * 0.76)));
    }
  // The gills: the brim's underside, the one place a cap goes as dark as its own line.
  for (let x = Math.round(cx - rx * 0.86); x <= Math.round(cx + rx * 0.86); x++)
    img.px(x, Math.round(my + ry) - 1, rust(0.04));
}

/**
 * Cream, with its own shaded corner: a spot is a disc on a dome, not a sticker.
 *
 * `wall` rather than `fur`, which is the same move as the cap: the cottage cream rather than a
 * near-white, so the three mushrooms read as one object in one material.
 *
 * The SPAN is a reversal I made and then undid inside this round, and it is worth recording
 * because the reason was a number that changed under me. I first pulled every spot down the ramp
 * to cut the step against the cap from 150 luma to 96, on the old target's reading that this file
 * was four times too busy. `board-profile.json` was rebuilt mid-pass -- the old edge figure had
 * been measured through the board's own interpolation blur and understated it by 4.6x -- and the
 * corrected target says the opposite: at edges 0.83 of the board, the art wants HARDER steps. So
 * the spots are back near the top of the ramp where they started. A crisp cream disc on a russet
 * cap is both what the board draws and what the ruler now rewards; softening it was obedience to
 * a broken instrument.
 */
function spot(img: Img, x: number, y: number, big: boolean): void {
  img.px(x, y, tone('wall', big ? 0.92 : 0.66));
  if (!big) return;
  img.px(x + 1, y, tone('wall', 0.7));
  img.px(x, y + 1, tone('wall', 0.52));
  img.px(x + 1, y + 1, tone('wall', 0.24));
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
    const s = new Img(TILE, TILE);
    toadstool(s, cx, capY, rx, ry, foot);
    for (const [x, y, big] of spots) spot(s, x, y, big);
    ring(s, CAP_LINE);
    img.blit(s, 0, 0);
  };
  // Back to front, which here is highest and smallest first. The three stand clear of one another
  // on purpose: an earlier pass overlapped them, and three Aubergine domes that touch keyline their
  // outsides only and read as one lumpy purple mass. A ring is three mushrooms or it is nothing.
  one(8, 12, 4, 2.6, 20, [
    [6, 10, false],
    [9, 12, false],
  ]);
  one(24, 14, 4.5, 2.8, 22, [
    [22, 12, false],
    [25, 14, true],
  ]);
  one(16, 19, 6.4, 4.2, 27, [
    [12, 16, true],
    [18, 15, true],
    [20, 19, false],
  ]);
  blades(img, [
    [4, 26, 3],
    [20, 27, 3],
    [29, 24, 3],
  ]);
};

/* ----------------------------------------------------------------------------------- the tiles */

export const UNDERGROWTH_TILES: Record<string, (img: Img) => void> = {
  // Three plants, three silhouettes, three bloom sizes -- and now three hues, which is the one
  // separator these tiles were missing. Until this pass `flower-pink` and `flower-red` both came
  // off `cloak` and shape alone had to tell them apart; they are now the board's own white daisy,
  // its coral pink and its vermilion, and a player can name them at a 26-tile camera.
  //
  // Each takes the eye the board gives it: orange in the white daisy, pale gold in the red cross,
  // and cream in the pink one, which is where its white pips go at this size.
  'flower-white': moundFlower({
    tone: (t) => tone('fur', t),
    lo: 0,
    hi: 1,
    eye: (t) => tone('gold', t),
  }),
  // `rose` is held LOW on its ramp, not high, and that is the opposite of the obvious choice. The
  // pull keeps the red channel untouched, so the top of the ramp is pinned near luma 165 -- lighter
  // than the lawn it stands on, which is both wrong against the board (its pink cross probes 101 to
  // 141) and the one thing a flower must never be. Held over 0 to 0.42 the petals run 108 to 145
  // and the plant reads as a pink mass sitting ON the grass instead of dissolving into it.
  'flower-pink': sprawlFlower({ tone: rose, lo: 0, hi: 0.42, eye: (t) => tone('wall', t) }),
  'flower-red': spireFlower({ tone: ember, lo: 0.08, hi: 0.95, eye: (t) => tone('gold', t) }),
  bush: bushTile,
  rock: rockTile,
  'toadstool-ring': toadstoolRing,
};
