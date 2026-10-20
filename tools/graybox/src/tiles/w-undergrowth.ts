/*
 * Undergrowth: the eight things that get strewn across the lawn.
 *
 * `bush`, `bush-low`, `bush-tall`, `flower-white`, `flower-pink`, `flower-red`, `rock`,
 * `toadstool-ring`. These are the most repeated frames in the game -- `forest-map.ts` scatters them
 * more than a hundred times between them -- so each one has to be legible at a 26-tile camera and
 * uninteresting enough to survive being seen a hundred times.
 *
 * 2026-10-20, SEVENTH PASS: `bush` BLEEDS TO ITS SIDE EDGES, SO A BED OF THEM IS ONE MASS.
 *
 * One change and one refusal.
 *
 * 1. THE LATTICE. No tile in this file had ever reached its own horizontal edge, so a bed of
 *    adjacent bushes printed as separate discs with 11 px of lawn between them -- at exactly the
 *    camera's tile pitch, which is what draws a market garden on the lawn and is the last visible
 *    grid in the title and spawn frames. Placement cannot reach it; the map owner has already
 *    clumped these as far as clumping goes. `bush` -- the most numerous plant, and 73 of the
 *    world's 161 adjacent bush pairs -- now runs its mass off its left and right edges, so adjacent
 *    cells merge into one lobed mass. Two tiles that touched on 0 rows now touch on 9, in all four
 *    of the pairings `forest-map.ts`'s flip can produce. See the note above `BUSH_BLEED`, and
 *    `rim()`, which is the half that makes it safe at the END of a run as well as in the middle.
 *
 * 2. `BUSH_LIFT` STAYS AT 0.3, swept rather than assumed. The brief was the 36-luma body-to-lawn
 *    gap against the board's 76, and this constant cannot deliver it: cutting it by two thirds
 *    moves `bush`'s median by 10.6 luma and the flower bushes by 3.4, because `leafBlades` caps a
 *    leaf at `min(0.97, level + lit)` and the lit leaves are all already at the cap. The table and
 *    the lever that does carry it are recorded on `BUSH_LIFT` itself. The bleed moved the same
 *    number from 39.2 to 46.3 on its own.
 *
 * 2026-10-20, SIXTH PASS: A SECOND PLANT, A TUFT THAT IS A TUFT, AND A GUARD ON ALL OF IT.
 *
 * DESIGN_BOARD section 3 asked for three things here and two of them had been answered on paper
 * rather than in the frame.
 *
 * 1. "TWO OR THREE BUSH SILHOUETTES." There were three tiles and one plant. `bush`, `bush-low` and
 *    `bush-tall` all came out of `plainBush` as a mound of clumps under a spray of broad spade
 *    leaves, so they differed in FOOTPRINT and in nothing else -- identical solidity to three
 *    decimals, identical perimeter-to-area. `bush-low` is now a different plant: a low clump of
 *    long narrow fronds with lawn cutting between the points, leaning left over a skirt that runs
 *    right. See the note above `BUSH_LOW`. Measured on the plant alone, `bush` against `bush-low`
 *    -- which are 331 of the map's 353 bushes -- fell from 0.700 of their pixels shared to 0.520,
 *    and `bush-low` against its own mirror from 0.832 to 0.692, so the map's flip now buys a frame
 *    on 142 tiles where it bought almost nothing.
 *
 * 2. "THE GRASS HAS NO TUFTS AT ALL." The lawn's half of that is `w-ground.ts`'s and is done -- it
 *    carries a chevron per variant now. This file's half was not: `blades()` drew ONE single-pixel
 *    stroke per entry while its own docstring claimed "two or three blades crossing an object's
 *    foot", and the widest connected mark any of these eight tiles put on bare lawn was 2 px. It is
 *    now the same three-blade fan the lawn carries, at the same three tones: 7 px across, 3 or 4
 *    tall, 17 to 27 px of ink a tile against 6 to 11. See `SPRIG` and `FOOT_TUFTS`.
 *
 * 3. "THE TOADSTOOL TILE REDUCED FROM THREE CAPS TO ONE OR TWO." Already done, verified at two, and
 *    now held by the guard rather than by a docstring -- the docstring above `toadstool` still said
 *    three, which is how a cut fix gets quietly re-reverted.
 *
 * THE GUARD IS AT THE FOOT OF THIS FILE and it found two faults in this pass's own work that the
 * render did not: a tuft whose left blade came apart into a dash and a speck because
 * `Math.round(-0.5)` is -0, and a first draft of the frond plant that was 87 per cent its own
 * mirror. Neither is visible at zoom 9 and neither is anything the six axes can see.
 *
 * 2026-10-20, FIFTH PASS: THE BUSH IS A BRIGHT OBJECT WITH DARK CUT INTO IT, which is the way round
 * the board draws it and the opposite of what the fourth pass shipped.
 *
 * The review's finding was an inversion -- "the board's bush is a bright mid-green mass with
 * near-black channels cut into it, ours is a dark mass with lit leaf tips on it" -- and at matched
 * scale it is obvious and it was invisible to every number anyone had. Decimate `1218 400 190 90`
 * by 2.21 and put it beside the three bushes at zoom 9: the board's plant is six or seven big flat
 * leaves covering most of it, with the dark reduced to one-pixel lines and the outer scallop. Ours
 * was the photographic negative, a dark body with narrow pale slivers lying on it.
 *
 * THE HISTOGRAM SAID THERE WAS NOTHING WRONG, and that cost most of a round, so it is recorded
 * first. The review quoted the board at q1 96 / median 133 against ours at 65 / 108, off
 * `1240 424 44 34`. That rect is about half white-and-red BLOOM at luma 200 and over. Probed on a
 * bloom-free sample -- `1227 438 24 30`, the left bush below its flower -- the board runs min 15 /
 * q1 64 / med 103 / q3 147 and the fourth pass's bush ran 43 / 65 / 109 / 142. The two were the
 * same distribution. The gap was never tonal; it was WHERE the light sat, and the six axes cannot
 * see that and say so themselves.
 *
 * Three changes, in `channelAt`, `leafBlades` and the three blade lists:
 *
 * - A CHANNEL IS AN ABSOLUTE DARK. It was `mass - gap`, so lifting the plant lifted its channels
 *   with it and every attempt at this came back the same drawing one stop brighter. See `channelAt`.
 * - AN OVERLAP IS NOT A SEAM. Every pixel two leaves both claimed used to be darkened to a channel,
 *   so widening a leaf converted the extra width into dark rather than into leaf. That is why the
 *   first attempt at bigger leaves came out DARKER than the smaller ones it replaced -- 45% of the
 *   body under luma 70 against 31%. The earlier leaf now simply keeps the pixel and `edge` draws
 *   one dark line along the boundary, which is what the board has.
 * - LEAVES ARE A QUARTER OF THE PLANT'S WIDTH. `wide` is a half-width and it was 2.0 to 2.4, which
 *   draws a leaf five pixels across on a bush of twenty-six. The board's is eight. This file's own
 *   third-pass note worked that out ("a leaf is a QUARTER of the bush's width, not a seventh") and
 *   never applied it. Eight leaves at half-width 3.0 to 3.6, down from ten at 2.0 to 2.4.
 *
 * Measured, same rect, before and after: med 109 -> 122, q3 142 -> 149, over luma 170 10.7% -> 14.7%,
 * under 70 31% -> 34.1% against the board's bloom-free 28.6%. BOTH TAILS GREW, which is the whole
 * point: a bright mass with near-black channels has more of each than a uniformly dark one.
 *
 * 2026-10-20, FOURTH PASS: the bushes are a wide low spray of pointed leaves with real dark between
 * them, which is what the board draws and what three passes of rounded lobes never got to.
 *
 * The review's finding was that our bush is "a rounded cauliflower of mid-green lobes with low
 * internal contrast and no pointed tips", against a board that draws "a WIDE LOW SPRAY of distinctly
 * pointed leaf blades with dark lawn slivers between them and bright lit tips". Both halves held up
 * when crop `1222 406 78 64 11` -- one bush out of the pair inside the cottage fence -- was put
 * beside the render. Five things changed and each carries its own reasoning at the thing itself:
 *
 * - `rosette()` takes an ELLIPTICAL rim and the leaf tips stand three or four pixels PROUD of the
 *   mass, so the silhouette is leaf points rather than the clumps' own scallop.
 * - `leafBlades()` keeps a dark edge between every pair of adjacent leaves -- the seam where one
 *   overlaps another, and the shared border where they merely touch. Without it the best-lit leaves
 *   are always neighbours and merge into one plateau, which is what three renders in a row did.
 * - A leaf is a FLAT fill at one level with two steps in it, read off the mass at its own root,
 *   where the third pass shaded it pixel by pixel. At six by five pixels a leaf is read by its
 *   silhouette and its border and both need a flat interior; the shaded version read as camouflage.
 * - `bush`, `bush-low` and `bush-tall` have their leaves WRITTEN OUT rather than generated. Nine or
 *   ten each, in descending order of how lit they are, laid out so no two bases are within three
 *   pixels. The flower bushes still use `rosette`, which is the right tool for leaves behind blooms.
 * - `flower-white`'s petals are held over the bottom 0.42 of `fur` -- 196 to 232 against 196 to 255
 *   -- because at the map's flower density a 247 peak made them the brightest thing in frame.
 *
 * 2026-10-19, THIRD PASS: there are three bushes, the mirror pass finally buys something, the
 * plants are made of leaves, and the toadstools are two to a tile.
 *
 * Judged against `reference/mocks/gameplay-concepts.png` rather than against the second pass. The
 * crops are `1180 403 209 97` (the two flowering bushes inside the cottage fence -- the clearest
 * bush on the board), `889 389 194 167` (the vermilion spray) and `55 620 170 110` (a daisy bush on
 * open lawn). Our pixel is about twice the board's, so a crop made at scale 3.62 sits beside one of
 * our tiles at zoom 8 at the same physical size; everything below was decided that way round.
 *
 * Four things changed and each has its reasoning at the thing itself:
 *
 * - `BUSH`'s rim is no longer an ellipse. An ellipse stepped by 45 degrees is its own mirror, so
 *   `forest-map.ts` flipping 53 per cent of its decor bought nothing on 273 bushes. See `BUSH`.
 * - `bush-low` and `bush-tall`, two new names APPENDED to `TILE_NAMES`, differing in footprint
 *   rather than outline detail. See the note at the bottom of this file and `tiles.ts`.
 * - `leafBlades()`: the plants are made of individual leaves over a mass, which is how the board
 *   draws them, and the probe in `seat()` records how far out our values were.
 * - `flower-red` carries two big crosses where it carried five small ones, because the review said
 *   it was indistinguishable from `flower-pink` and bloom COUNT AND SIZE is what the board separates
 *   them by. `toadstool-ring` is two caps, not three.
 *
 * ON THE SIX-AXIS SCORE, SO NOBODY SPENDS A ROUND UNDOING THIS. Measured on a 26x15 camera of these
 * tiles alone, the pass is WORSE: distance 1.123 to 1.177, deep shade 4.97 to 4.51, keyline 3.91 to
 * 3.29, spread 30.98 to 29.08, only edge density up at 10.17 to 10.63. That is the arithmetic of
 * lightening the objects and it was predicted before it was measured. The counter-evidence is a
 * direct like-for-like probe of the board: its plain bush runs median luma 106 with 28 per cent of
 * its pixels under 70, and ours ran median 78 with 44 per cent under 70 and not one pixel over 170.
 * Our undergrowth was a dark object with mid accents where the board's is a mid object with dark
 * accents. On the board the deep shade is in the TREE CROWNS; a bush is a mid-green thing. We were
 * buying the census out of the wrong element, and at the whole-world camera the same change scores
 * better on all six axes, not worse.
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
import {
  Img,
  ember,
  keyline,
  lumaOf,
  noise,
  pull,
  rose,
  rust,
  tone,
  valueNoise2D,
} from '../paint.ts';
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

/* ------------------------------------------- the three warm families, now shared from paint.ts */

/*
 * `pull`, `rose`, `ember` and `rust` WERE defined here and now live in `paint.ts`, moved unchanged
 * on 2026-10-20 with the review's approval. The reasoning that built them is recorded with them
 * there; what belongs in this file is only why they had to leave it.
 *
 * They were built here because `PALETTE` has no pink, no red and no russet, so the pass before this
 * one painted `flower-pink`, `flower-red` AND the toadstool caps from `cloak` -- Red's own hue --
 * and the forest came out with roughly fifteen purple objects per camera in the protagonist's
 * colour. PIXEL_STANDARD 3 says Red is the single most findable thing in a green forest; painting
 * the undergrowth in her hue made her the least findable. That is settled and the warm families are
 * the fix.
 *
 * They leave because three painters now want them. `cast.ts` needs `rose` for the rabbit's inner
 * ears, nose and blush -- the review's note on the sprite says in as many words not to re-derive it
 * -- and the props want `ember` and `rust` for the stall cloth and the signpost. A warm family
 * reconstructed by every painter that happens to need one is how three slightly different reds end
 * up in one frame.
 *
 * Nothing about their values changed in the move, and nothing in this file calls them differently.
 */

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

/*
 * THE FOOT TUFT, and it is a tuft now rather than three unrelated strokes.
 *
 * What this used to draw: one blade per entry in the list, a single pixel wide, three tall, bent
 * one pixel right at the root. Three of those scattered along the bottom of a tile is not a tuft,
 * it is three dashes, and the docstring that called them "two or three blades crossing an object's
 * foot" had been describing an intention rather than the drawing for three passes. Measured off the
 * tiles: the biggest connected mark any of these six plants put on bare lawn was 2 px wide, and
 * `flower-red`'s pair landed inside the contact shadow where nothing of them reads at all.
 *
 * The board's tuft is one drawing and `tiles/w-ground.ts` has already measured it, off
 * `240 650 100 80 9`: "a fan of four or five short dark strokes springing from one point, about
 * seven of our pixels across and four tall". The lawn carries that mark now -- one chevron per
 * grass variant -- and the plants' feet carried dashes, so the two halves of the same world were
 * drawing grass two different ways. These are the same three blades at the same three tones.
 *
 * WHY THIS FILE REPEATS THE SHAPE INSTEAD OF IMPORTING IT. `CHEVRON` and `chevron()` are private to
 * `w-ground.ts`, which is not this round's file, and that file's chevron writes a LUMA into its
 * mark field rather than a colour -- it is built for a surface that has to resolve against its own
 * tone field, and these tiles paint onto finished pixels. The two halves agree by value today
 * (`tone('grass', 0.34 - i * 0.1)`, which `w-ground.ts` records as "the same three this project's
 * decor tiles have always cut their tufts in") and that agreement is currently maintained by hand.
 * It wants one home in `paint.ts`, the way `rose`, `ember` and `rust` got one; raised as an ask.
 *
 * A TUFT STAYS WHOLE INSIDE ITS TILE, which is the one place this must NOT copy the lawn. The
 * lawn's chevrons deliberately wrap across a tile edge, because a grass tile is laid against its
 * own kind and a mark cut by the pitch is harder to find than one centred in every square. These
 * tiles are scattered, never tiled, so a wrapped tuft would print half a plant against whatever
 * grass tile happens to sit next door. Every root below is placed so the whole fan lands inside
 * 1..30 on both axes; the guard at the foot of this file checks it rather than trusting the
 * arithmetic.
 */
const TUFT_TOP = 0.34;
const TUFT_STEP = 0.1;

/**
 * `[base dx, tip dx, height relative to the centre blade]`, the lawn's own chevron.
 *
 * The centre blade is tallest and vertical; the two flankers spring from beside it and splay out,
 * so the fan is seven pixels across at the tips and one at the root. Three and not five: five welds
 * into one dark mass inside seven pixels and the tuft reads as a small mushroom, which is the
 * failure `w-ground.ts` records from the same experiment.
 */
const SPRIG: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [-1, -2, -1],
  [1, 2, -1],
];

/**
 * Round away from zero, which `Math.round` does not do and which this fan needs.
 *
 * `Math.round(0.5)` is 1 and `Math.round(-0.5)` is -0: it rounds half UP, not away from zero, so a
 * splay curve that is symmetric in the arithmetic comes out asymmetric on the pixels. The first
 * render of this tuft had it exactly: the right blade stepped 9, 8, 7 across three rows and the
 * left one stepped 3, 5, 5, which leaves the tip a single pixel two columns clear of the rest of
 * the mark. The guard at the foot of this file is what found it -- it was not visible at zoom 9 and
 * nothing in the six axes can see a one-pixel hole.
 */
const away = (v: number): number => Math.sign(v) * Math.round(Math.abs(v));

/**
 * One tuft per entry: `[x, y, h]` is the ROOT of the centre blade and its height, not the top.
 *
 * `i` counts DOWN from the point, which is where the tone ramp starts: a blade is lightest where it
 * catches the light and darkest at the root. The sideways step is squared in the remaining height,
 * so a blade stands vertical for its lower half and gives way only near its point -- a blade that
 * steps sideways on every row is a 45-degree dash, and a handful of those is pen hatching.
 */
function blades(img: Img, spots: readonly (readonly [number, number, number])[]): void {
  for (const [bx, by, h] of spots)
    for (const [bdx, tdx, dh] of SPRIG) {
      const n = h + dh;
      // A BLADE MAY NOT STEP SIDEWAYS FASTER THAN ONE PIXEL A ROW, so the splay is capped by the
      // blade's own height. Without the cap a short flanker reaches its full splay in a single row
      // and lands two columns clear of the pixel below it: the stroke comes apart into a dash and a
      // speck, which is what the three-row tufts did until the guard counted the marks. It also
      // gives the two sizes their own silhouettes for free -- the four-row fan is seven across, the
      // three-row one five -- rather than making the small one a clipped copy of the big one.
      const splay = Math.sign(tdx) * Math.min(Math.abs(tdx), n - 1);
      for (let i = 0; i < n; i++) {
        const u = n < 2 ? 1 : i / (n - 1);
        const x = bx + bdx + away(splay * (1 - u) ** 2);
        img.px(x, by - (n - 1) + i, tone('grass', TUFT_TOP - i * TUFT_STEP));
      }
    }
}

/**
 * Where each tile's tufts stand, in one table rather than eight literals down the file.
 *
 * Gathered here for two reasons. The first is that the thing DESIGN_BOARD section 3 asks for is
 * "positioned differently in each", which is a statement about the SET and cannot be read off eight
 * separate call sites. The second is that the guard at the foot of this file checks the fan's shape
 * and its distance from the tile edge, and a guard that cannot see the data it is guarding is a
 * guard on something else.
 *
 * `[x, y, h]` is the ROOT of the centre blade and its height. A four-row fan is seven pixels across
 * and a three-row one is five -- the splay is capped by the blade's own height, see `blades` -- so a
 * root covers `x-3 .. x+3` at worst and `y-3 .. y`. Every root below keeps the whole mark inside
 * 1..30 on both axes (`x` in 4..27, `y` in 4..30), because a mark on a tile's own edge prints
 * against whatever grass tile is laid next door, and these tiles are scattered rather than tiled.
 *
 * Two or three per tile, never more. These are 400-odd tiles of the map between them; a fourth tuft
 * buys nothing and starts to read as a lawn of its own inside the square.
 */
type Tufts = readonly (readonly [number, number, number])[];

const FOOT_TUFTS: Record<string, Tufts> = {
  bush: [
    [6, 27, 4],
    [15, 29, 3],
    [24, 28, 4],
  ],
  'bush-low': [
    [5, 28, 4],
    [16, 30, 3],
    [26, 29, 3],
  ],
  'bush-tall': [
    [9, 29, 4],
    [21, 28, 3],
  ],
  'flower-white': [
    [7, 28, 4],
    [20, 29, 3],
  ],
  'flower-pink': [
    [5, 28, 3],
    [27, 29, 4],
  ],
  'flower-red': [
    [8, 29, 4],
    [22, 28, 3],
  ],
  rock: [
    [5, 26, 3],
    [26, 29, 4],
  ],
  'toadstool-ring': [
    [5, 28, 3],
    [19, 29, 4],
    [26, 27, 3],
  ],
};

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
/*
 * `LIFT` used to live here at 0.22 and the flower bushes used it while the plain bushes used
 * `BUSH_LIFT`. There is now one level for all six plants and it is `BUSH_LIFT`, declared beside the
 * bushes; the reasoning for merging them is on it. Two names for one number is how the two families
 * drifted fifty luma apart without anyone deciding they should.
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

/**
 * Every pixel of a finished mass a constant distance up its own ramp.
 *
 * This is a LEVEL, not a shape, and it is here because the probe in `seat()` says the level is what
 * was wrong. `BAND_BASE` puts a clump's three bands at -0.04, 0.07 and 0.2, and the hemisphere then
 * swings each by about 0.3, so a band-0 clump's shaded side lands near -0.24 -- which `leafTone`
 * resolves into `shadow` at about luma 65. A third of every mass therefore sat at or below canopy's
 * own darkest step before `slope` had said anything, and the board's bush body is 110 to 150.
 *
 * Deliberately a separate pass rather than an edit to `BAND_BASE` or to the dome, because those are
 * the clump construction DESIGN_BOARD section 4.3 asks not to be rebuilt: the bands' spacing, the
 * hemisphere, the wobble and the crease all stay exactly as they were and the whole thing moves up
 * the ramp together. Swept at 0.16, 0.22 and 0.28 against the board's distribution and 0.22 is the
 * one that lands the median; see the figures in `seat()`.
 */
function lift(m: Mass, amount: number): void {
  for (let i = 0; i < AREA; i++) if (m.on[i]) m.t[i] = m.t[i]! + amount;
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
 * The right flank is on both sides for the same reason: the board shades a bush on two sides, not
 * one, and doing the bottom alone left the whole shaded flank of every plant in the mid-greens. Both
 * passes take the darker of what is there and what they want, so they never lighten a clump that is
 * already deeper, and the two meet in the corner without a seam.
 *
 * SHALLOWER AND LESS DEEP THAN IT WAS -- six rows to four, and a floor of -0.30 rather than -0.46 --
 * and this is the one change in the round that the six-axis score will dislike, so here is the
 * evidence for it.
 *
 * Probed as luma distributions rather than argued about. The board's plain bush, the right-hand one
 * inside the cottage fence at `1296 412 44 42 1`, runs median 106, ninth decile 169, and 28 per cent
 * of its pixels under luma 70. Ours ran median 78, ninth decile 146, 44 per cent under 70 and NOT ONE
 * PIXEL over 170. Our bushes were a dark object with mid accents; the board's is a mid-to-bright
 * object with dark accents, and that one inversion is most of why a forest of them read as holes in
 * a lawn rather than as planting.
 *
 * At depth 6 and -0.46 the bottom quarter of every plant was pushed to about luma 37 -- DARKER than
 * `LEAF_LINE` at 43, so a plant's own underside went deeper than the line drawn round it, which is
 * the one value relationship a keylined illustration cannot have. Four rows to -0.30 bottoms out
 * near 60, which is where the board's underside sits.
 *
 * The census consequence, stated rather than discovered later: this file's deep-shade share will
 * fall, because it was being paid for out of objects that are too dark. The board's deep shade comes
 * from tree crowns, not from undergrowth -- a bush is a mid-green thing on the board. Chasing the
 * share back from here would mean re-darkening the objects the probe says are wrong.
 */
function seat(m: Mass, depth = 4, flank = 3, fall = 1): void {
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
      const want = 0.16 - 0.46 * fall * g * g;
      if (m.t[i]! > want) m.t[i] = want;
    }
  }
  for (let y = 0; y < TILE; y++) {
    // A ROW THAT RUNS OFF THE TILE HAS NO RIGHT FLANK -- its right flank is in the next tile.
    //
    // Added with the bleed (see `BUSH_BLEED`). This pass turns the plant's right side away from the
    // light by finding the outermost pixel of each row and shading three columns in from it; on a
    // row that reaches column 31 that outermost pixel is the tile boundary, not the plant's edge, so
    // it was laying deep shade down columns 29..31 of the very rows that are supposed to MERGE.
    // Two tiles then met as six columns of dark, and the first render of the bleed printed a dark
    // block bridging the bushes where the board (`1180 395 230 110 4`, its two bushes touching
    // inside the cottage fence) runs its lit leaves straight through the join and marks it with
    // nothing but a notch in the outline. `rim()` still takes the single outermost column to a
    // channel, which is the one or two pixels of dark the board does draw there.
    if (m.on[y * TILE + (TILE - 1)]) continue;
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
      const want = 0.22 - 0.32 * fall * g * g;
      if (m.t[i]! > want) m.t[i] = want;
    }
  }
}

/* ------------------------------------------------------------------- the leaves, and the points */

/*
 * INDIVIDUAL LEAF BLADES, laid over a finished mass. This is the change that turns the bush from a
 * dark disc into a plant, and it came from the board rather than from a number.
 *
 * Put `1180 403 209 97 6` -- the two flowering bushes inside the cottage fence -- beside our `bush`
 * at the same magnification and the difference is not the silhouette's scallop depth, which is what
 * the last two passes argued about. It is that the board's bush is MADE OF LEAVES. Six or eight
 * separate blades, each a pointed oval three or four of our pixels long, lie on top of a dark teal
 * mass in a loose rosette, each one two or three stops LIGHTER than the mass and each with a dark
 * channel round it where the mass shows between them. The silhouette is spiky because the blades
 * that lie along the rim stick their tips out past it. Ours was one smooth dome from luma 100 to
 * 150 with creases quilted into it: the right tonal range, drawn as a vegetable rather than as
 * foliage.
 *
 * Three things fall out of doing it as blades rather than as more clumps, and all three are why it
 * is a blade pass and not another `Lobe` band:
 *
 * - It runs AFTER `weather()`, so a blade keeps a crisp edge against the mass. Shading it into the
 *   same float field the clumps use would have `weather` wander it a bucket or two either way,
 *   which is right for a mass and wrong for a mark.
 * - Its tips are added to `m.on`, so `ring()` outlines them and they become the silhouette's points.
 *   The board's bush outline is pointed, not scalloped, and this is where the points come from.
 * - The dark channel is drawn only onto pixels that are ALREADY part of the mass, exactly as
 *   `seatBloom` does, so a blade can never widen a plant past its safe box -- only its own tip can,
 *   by the pixel or two the layouts below leave room for.
 *
 * This is NOT the per-clump dome the header's negative result warns about. That failure was eleven
 * full-range domes each ringed by its own dark crescent, so the mass had no single light on it. The
 * mass here keeps exactly the one light `slope()` puts across it; the blades are a handful of marks
 * on top, which is the order the board draws in.
 *
 * A BLADE IS RELATIVE TO THE MASS UNDER IT, not an absolute place on the ramp, and getting that
 * wrong cost two renders in opposite directions. Painted at a fixed lit value the blades overwrote
 * `seat()` wherever they landed, so the plant lost its shaded underside and came out as a pale
 * cauliflower. Moved in front of `slope` and `seat` so the plant's light was applied over them, they
 * went soft: the low blades were clamped flat and `weather` wandered their edges, and the bush read
 * as a green pillow lit from the top -- a vertical gradient where the board has discrete leaves at
 * every height.
 *
 * Put `1180 403 209 97 3.62` beside our tiles at zoom 8 and the board settles it. Its bush is lit
 * leaf by leaf, not top to bottom: there are bright leaves hard against its bottom rim and dark
 * channels up at its crown. The light across the whole plant is carried by how MUCH of each leaf is
 * lit, not by where the leaf is.
 *
 * So a blade now RAISES whatever it lands on -- the mass's own value plus a rise, capped -- and runs
 * last, after `weather`. A low blade sits on `seat`'s dark underside and comes out mid-green against
 * it; a high blade sits on the lit crown and comes out near the top of the ramp. One light, kept,
 * and crisp leaves at every height, which is the thing the board is doing and the two earlier
 * orderings each lost one half of.
 */
type Blade = {
  /** Where the blade springs from: a point inside the mass. */
  readonly x: number;
  readonly y: number;
  /** Direction in turns -- 0 points right, 0.25 down, 0.5 left, 0.75 up. */
  readonly a: number;
  readonly len: number;
  readonly wide: number;
  /** How far up the ramp this blade lifts the mass it lands on. */
  readonly lit: number;
};

/**
 * How wide a blade is at a fraction along its own axis: a pointed oval, zero at both ends.
 *
 * The exponent under 1 pushes the widest point back towards the base, which is what makes it read
 * as a leaf rather than as a lozenge -- a leaf is broadest about a third of the way up and tapers
 * to a point. The outer power is the second correction off the board: at 1 the oval was too full in
 * the last quarter and a four-pixel-wide blade came out as a pea, which is what the render showed
 * before `1180 403 209 97 3.62` was put beside it at matched scale. Its leaves are about 7 by 4 --
 * nearer two to one than three to two -- and they end in an actual point. Raising the power narrows
 * the whole blade towards its tip without shortening it.
 *
 * SHARPENED AGAIN IN THE FOURTH PASS, from 0.52/1.25 to 0.45/1.7, because at five pixels wide the
 * old curve held nearly its full width over the middle two thirds and a leaf rendered as a BAR with
 * rounded ends -- plainly a bright rectangle in the render at zoom 22, which is the shape the review
 * called a blob rather than a blade. At 0.45/1.7 the blade is widest a quarter of the way up and
 * then falls away continuously: half-width 2.46 of 2.5 at a quarter, 1.5 at the half, a single pixel
 * by three quarters. That is a spade, and the board's leaves are spades.
 */
const bladeHalf = (u: number, len: number, wide: number): number =>
  wide * Math.sin(Math.PI * (u / len) ** 0.45) ** 1.7;

/**
 * Lay blades over a finished mass: the blades themselves, then the dark channel between them.
 *
 * Two passes rather than one, because a channel must not be cut into a neighbouring blade. With one
 * pass the blades drawn later would darken the ones drawn earlier along every shared border, and
 * eight leaves in a rosette share a lot of border -- which is the artichoke the `CREASE_DEPTH` note
 * records, arrived at from the other direction.
 */
/**
 * A CHANNEL IS AN ABSOLUTE DARK, not the mass minus a constant. This is the fifth pass's hinge and
 * it is what lets the mass be lifted at all.
 *
 * The fourth pass wrote every channel as `mass - gap`, floored. That is a sound way to draw a
 * shadow and a hopeless way to draw a line: the channel is then a fixed distance below whatever it
 * sits on, so lifting the plant lifts its channels with it and the drawing comes back out at the
 * same contrast one stop brighter. Three settings of `LIFT` were swept against it and every one of
 * them moved the median and left the picture alone, which is the symptom.
 *
 * The board's channels do not work that way. Probed down a line between two of its leaves at
 * `1218 400 190 90` decimated to our density, the dark between a BRIGHT upper leaf and the one
 * beside it and the dark between two shaded lower leaves are within a few luma of each other -- the
 * channel is a property of the drawing, like the keyline, not a shadow cast by the leaf above it.
 *
 * So a channel is clamped into a narrow band near the bottom of the ramp. `CHANNEL_HI` is the
 * brightest a channel may ever be, `CHANNEL_LO` the darkest; between them it still follows the mass,
 * so a channel at the plant's foot is a little deeper than one at its crown and the plant keeps one
 * light. In luma that is 46 to 56, against `LEAF_LINE` at 43 -- just above the line drawn round the
 * whole plant, which is the one relationship a keylined illustration has to keep.
 */
const CHANNEL_HI = -0.22;
const CHANNEL_LO = -0.36;

/** The four orthogonal neighbours. A diagonal is not a border; see the channel pass. */
const CROSS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const channelAt = (under: number, gap: number): number =>
  Math.max(CHANNEL_LO, Math.min(CHANNEL_HI, under - gap));

function leafBlades(m: Mass, list: readonly Blade[], gap = 0.3): void {
  /*
   * WHICH leaf owns each pixel, and where one leaf's territory meets an earlier one's.
   *
   * The channel pass at the bottom can only darken pixels that are mass and not leaf, so two leaves
   * that touch get no channel between them at all. At eight blades round a rim the two best-lit ones
   * are always neighbours, so three renders in a row came back with a pale plateau across the whole
   * lit quadrant and a leaf legible only in the corners. The board draws a dark teal line between
   * every pair of its leaves, which is exactly why you can count them, and that line is a property
   * of the leaves rather than of the mass between. So a pixel whose four-neighbour belongs to a
   * lower-numbered leaf is an EDGE and resolves to a channel. Four-neighbours and not eight: on a
   * diagonal border eight-connectivity takes two pixels off a five-pixel leaf and there is no leaf
   * left.
   *
   * AN OVERLAP IS NOT A SEAM, which the fourth pass had the other way round and which is why the
   * fifth pass's bigger leaves came out darker than the smaller ones they replaced. Every pixel two
   * leaves both claimed used to be darkened to a channel, so widening a leaf from five pixels to
   * eight did not widen what you see -- it converted the extra width into dark. At eight big leaves
   * on a 26 px plant the overlaps are most of the drawing and the bush came back as pale blobs in a
   * dark net: the inversion the review named, reproduced by the fix meant to cure it.
   *
   * The earlier leaf simply keeps the pixel. `edge` then draws the line one pixel inside the LATER
   * leaf, along the boundary of whatever is left of it, which is the same single dark line the board
   * draws and costs no interior at all.
   */
  const owner = new Uint16Array(AREA);
  const edge = new Uint8Array(AREA);
  const blade = new Uint8Array(AREA);
  // The mass as it stood before any blade touched it. Read from this rather than from `m`, so two
  // blades that overlap both lift the MASS and the second does not lift the first again.
  const under = Float32Array.from(m.t);
  const wasOn = Uint8Array.from(m.on);
  /*
   * The mass at a leaf's root, AVERAGED over the three by three around it.
   *
   * One sample is the wrong number to read a flat leaf's level off. The mass a root stands on has
   * the clump's own hemisphere in it, which swings 0.3 of the ramp over three or four pixels, and
   * then `weather`'s wobble on top; sampled at one pixel, two leaves whose roots are three pixels
   * apart could come out nine levels of luma different for no reason the eye can account for, and
   * the dump of the third fourth-pass render showed exactly that -- single bright pixels scattered
   * through mid ones, a confetti rather than leaves. Averaging over nine takes the clump's local
   * curvature out and leaves the thing the level is supposed to carry: where in the PLANT this leaf
   * sits, which `slope()` spread across twenty-six pixels and which no average over three can blur.
   */
  const at = (x: number, y: number): number => {
    let sum = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const jx = Math.round(x) + dx;
        const jy = Math.round(y) + dy;
        if (jx < 0 || jy < 0 || jx >= TILE || jy >= TILE) continue;
        const i = jy * TILE + jx;
        if (!wasOn[i]) continue;
        sum += under[i]!;
        n += 1;
      }
    return n === 0 ? Number.NaN : sum / n;
  };
  list.forEach((b, bi) => {
    const ca = Math.cos(b.a * Math.PI * 2);
    const sa = Math.sin(b.a * Math.PI * 2);
    const reach = Math.ceil(b.len + b.wide + 1);
    /*
     * ONE base value for the whole leaf, read off the mass at the leaf's own root.
     *
     * This is the fourth pass's other finding and it splits the difference between the two orderings
     * the third pass's docstring argues between. A blade still RISES over the mass, so the plant
     * keeps one light and keeps its seated foot -- a low leaf comes out mid-green against `seat()`'s
     * dark underside and a high one comes out near the top of the ramp. But it rises over ONE value,
     * sampled once, instead of over the mass pixel by pixel.
     *
     * The difference is legibility at this size. A board leaf is about 6 by 5 of our pixels and its
     * interior is one nearly uniform green inside a one-or-two-pixel dark border. Rising over the
     * mass pixel by pixel gave ours four to six interior values -- the mass is wobbled by the clumps
     * and again by `weather`, and the rise fell along both the blade's length and its width -- and
     * thirty pixels carrying six values has no shape in it. Three renders came back reading as
     * camouflage: plenty of contrast, no leaves. A shape this small is read by its silhouette and
     * its border, and both need a flat interior.
     *
     * It also fixes the overhanging tip for free, which was the reason `root` existed: a tip outside
     * the silhouette has nothing to be relative to, and the obvious fallback of treating it as zero
     * makes every point on the outline a dark spike. Now the whole leaf, tip included, is at one
     * level.
     */
    const root = at(b.x, b.y);
    const level = Number.isNaN(root) ? 0.2 : root;
    for (let y = Math.max(0, Math.floor(b.y - reach)); y <= Math.min(TILE - 1, b.y + reach); y++)
      for (
        let x = Math.max(0, Math.floor(b.x - reach));
        x <= Math.min(TILE - 1, b.x + reach);
        x++
      ) {
        const dx = x + 0.5 - b.x;
        const dy = y + 0.5 - b.y;
        const u = dx * ca + dy * sa;
        const v = -dx * sa + dy * ca;
        if (u < 0 || u > b.len) continue;
        if (Math.abs(v) > bladeHalf(u, b.len, b.wide)) continue;
        const i = y * TILE + x;
        // The earlier leaf keeps it, whole. See the note on the three arrays above.
        if (owner[i] !== 0) continue;
        owner[i] = bi + 1;
        blade[i] = 1;
        m.on[i] = 1;
        // Two steps inside the leaf and no gradient. The outer two fifths come down an eighth of the
        // ramp so the tip turns over and the leaf points; the side of the blade's own axis facing
        // away from the light comes down a twelfth, which is the fold down the middle of a leaf.
        // Capped just under the top of the ramp so a leaf on an already-bright crown does not
        // flatten against its neighbours.
        const tipOff = clamp01((u / b.len - 0.6) / 0.4);
        m.t[i] = Math.min(0.97, level + b.lit - 0.12 * tipOff - (v > 0 ? 0.08 : 0));
      }
  });
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      const o = owner[i]!;
      if (o === 0) continue;
      const lower = (jx: number, jy: number): boolean => {
        if (jx < 0 || jy < 0 || jx >= TILE || jy >= TILE) return false;
        const p = owner[jy * TILE + jx]!;
        return p !== 0 && p < o;
      };
      if (lower(x - 1, y) || lower(x + 1, y) || lower(x, y - 1) || lower(x, y + 1)) edge[i] = 1;
    }
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      // A shared border is the mass showing between two leaves, so it resolves to exactly what an
      // ordinary channel resolves to.
      if (edge[i]) {
        m.t[i] = channelAt(wasOn[i] ? under[i]! : 0.1, gap);
        continue;
      }
      if (blade[i] || !m.on[i]) continue;
      // FOUR-WAY, not eight. A mass pixel sitting diagonally between two leaf corners is not between
      // them in any sense the eye cares about, and darkening it welds the channels into a connected
      // net: at eight-way the dark round two leaves two pixels apart meets in the middle and the
      // plant comes back as a chain-link fence with green behind it, which is the mesh this file's
      // own `rosette` note records falling for once already.
      let touches = false;
      for (const [nx, ny] of CROSS) {
        const jx = x + nx;
        const jy = y + ny;
        if (jx < 0 || jy < 0 || jx >= TILE || jy >= TILE) continue;
        if (blade[jy * TILE + jx]) {
          touches = true;
          break;
        }
      }
      // The band is luma 46 to 56, which is where the fourth pass's floor of -0.32 already sat; what
      // changed is that it is now a CEILING as well, so the channel cannot drift up with the mass.
      // The board settles the depth: crop `1222 406 78 64 11` and the dark between two of its leaves
      // is a near-black teal, its bush's first decile luma 50 and its minimum 33. A render at -0.40
      // proved the old worry real -- at 54 per cent of the body under luma 70 the plant came apart
      // into a dark tangle with bright chips in it -- so the floor stays near where it was.
      if (touches) m.t[i] = channelAt(m.t[i]!, gap);
    }
}

/**
 * A rosette of blades round a centre: the arrangement both board crops show.
 *
 * The blades radiate, but their LENGTH and their place on the ramp do not: the ones pointing up and
 * left are long and near the top of the ramp, the ones pointing down and right are short and sit
 * where the mass already is. That is the same single light the mass carries, which is what stops a
 * rosette reading as a starfish.
 *
 * `rim` is the distance from this centre to the mass's own edge, and a blade is placed by its TIP
 * rather than by its base: the tip lands `rim` plus a pixel or so out for a blade facing the light
 * and a pixel short of the rim for one facing away, and the base is then wherever the blade's own
 * length puts it. Two earlier arrangements got this wrong in opposite directions and both are worth
 * recording, because the second looked like progress on every axis and was the worse of the two.
 *
 * Placing the base at a third of the rim put every blade entirely inside the silhouette: the
 * interior read as leaves and the outline stayed a smooth scallop, which is half a fix.
 *
 * Placing the base at 0.55 of the rim and keeping the blades small and numerous -- an outer rosette
 * of seven plus an inner one of five, three pixels wide -- gave the points, and printed a MESH. With
 * that many small blades the pixels between them form one connected network rather than slivers, and
 * `gap` then darkens the whole network at once: the bush came out as lighter patches behind a dark
 * chain-link fence. Nothing in the six axes can see that; it is plainly visible in the render, and
 * it is the same class of mistake as the setting that scored better on every axis and printed a
 * visible lattice.
 *
 * The board settles it. Measured off `1180 403 209 97 6` at matched scale, its bush is about 31 of
 * our pixels across and carries six or seven leaves of roughly 7 by 4 -- so a leaf is a QUARTER of
 * the bush's width, not a seventh, and the dark between two leaves is one or two pixels. Fewer,
 * bigger leaves leave the dark as slivers, and slivers are what the board draws.
 *
 * FOURTH PASS, 2026-10-20: the rim is an ELLIPSE and the tips stand PROUD of it, and those two
 * together are what finally make the silhouette pointed.
 *
 * The review's finding was that our bush is a rounded cauliflower of mid-green lobes with no
 * pointed tips, against a board that draws a wide low spray of distinctly pointed blades. Both
 * halves of that were arithmetic in this function rather than anything in the layouts.
 *
 * POINTED. `bladeHalf` has always tapered to zero at both ends, so a blade was already a pointed
 * oval -- but `tip = rim + facing * 2 - 0.8` put a down-facing blade's tip 0.8 px INSIDE the mass
 * and the best-lit one only 1.2 px outside it. A point one pixel proud of a scalloped rim is not a
 * point; `ring()` rounds it off and the silhouette comes back as the mass's own scallop. Blades now
 * reach `facing * 3.1 + 0.5` past the rim, so every blade clears the mass and the lit ones clear it
 * by three or four pixels. The leaf tips ARE the outline, which is how the board draws a plant.
 *
 * WIDE. One scalar rim makes a round plant however the lobes are laid out, because the blades then
 * reach equally in every direction and they are the outer boundary. `ry` defaults to `rx` so the
 * four flower bushes are untouched, and the three bushes pass a real pair: the board's bush spans
 * about 1.5 of its own height, and with `rx` 11.5 against `ry` 7 the leaves put that proportion
 * into the silhouette instead of asking the clumps to carry it inside a 28 px box they do not fit.
 *
 * THE SAFE BOX IS NOW THIS FUNCTION'S PROBLEM, which it was not when tips sat inside the mass. A
 * blade's tip lands at `rx + 3.1 + 0.5` from the centre on the lit side and `ry - 0.3` on the far
 * one, `facing` is 1 up and left and 0 down and right, and `ring()` adds one pixel above and left
 * and two below and right of the waist. So a rosette at (cx, cy) needs
 * `cx - rx - 3.6 >= 1`, `cx + rx - 0.3 <= 29`, `cy - ry - 3.6 >= 1` and `cy + ry - 0.3 <= 29`.
 * Every call below is the result of that arithmetic rather than of nudging numbers until a render
 * stopped clipping.
 */
/**
 * THE SEAM COLUMN: any mass that reaches the tile's own left or right edge resolves to a channel.
 *
 * This is the half of the bleed that makes it safe, and it is deliberately a property of the EDGE
 * rather than of the plant that happens to be bleeding. A tile here is scattered, never tiled, so
 * the painter cannot know what will be laid beside it: `bush` meets another `bush` on 75 of the
 * world's seams and meets lawn, a path, a trunk or a rock on the other 214. One drawing has to be
 * right on both, and the only mark that is right against foliage AND against lawn is the plant's
 * own near-black -- between two leaves it is the fold the board cuts between its own leaf masses,
 * and against bare ground it is a keyline. `channelAt` is the same clamp `leafBlades` uses, so the
 * seam is not a new value in the file: it is the dark that is already between every pair of leaves,
 * and it still follows the mass, so it is a little deeper at the plant's foot than at its crown.
 *
 * It runs LAST, after `leafBlades`, for the reason the blade pass itself runs last: a leaf whose
 * tip is clipped by the tile boundary would otherwise put a flat lit value -- 107 to 175 on this
 * plant -- hard against the grass tile next door. The guard at the foot of this file holds the
 * resulting columns under luma 72, which no leaf on this plant can pass.
 *
 * On `bush-low`, `bush-tall` and the four flower bushes nothing reaches an edge, so this is a
 * no-op on them and needs no flag to say so.
 */
function rim(m: Mass, gap = 0.3): void {
  for (let y = 0; y < TILE; y++)
    for (const x of [0, TILE - 1]) {
      const i = y * TILE + x;
      if (m.on[i]) m.t[i] = channelAt(m.t[i]!, gap);
    }
}

function rosette(
  cx: number,
  cy: number,
  n: number,
  rx: number,
  seed: number,
  len = 5,
  ry = rx,
): readonly Blade[] {
  const rnd = noise(seed);
  const out: Blade[] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n + (rnd() - 0.5) * 0.06;
    const ca = Math.cos(a * Math.PI * 2);
    const sa = Math.sin(a * Math.PI * 2);
    // How much this blade faces the light: 1 up-left, 0 down-right.
    const facing = clamp01(0.5 - (ca * 0.5 + sa * 0.58));
    // The rim at this angle. An ellipse in the radius, not in the angle: close enough at eight
    // blades, and it keeps the blade pointing straight out from the centre, which a true elliptical
    // normal would not -- a leaf that leans off its own radius reads as wind, not as a wide plant.
    const rim = (rx * ry) / Math.hypot(ry * ca, rx * sa);
    const tip = rim + facing * 3.1 + 0.5;
    const grown = len * (0.78 + facing * 0.34) * (0.9 + rnd() * 0.2);
    // A LEAF IS AN ISLAND ON THE RIM, and the floor under the base is what makes it one.
    //
    // At `Math.max(0.6, ...)` -- which is what the first fourth-pass render used -- every blade's
    // base sat four to seven pixels from the centre with two and a half pixels of half-width, so
    // all of them covered the middle and merged there. The render came out as one flat pale plateau
    // across the top left with long straight dark lines where two big blades shared a border: the
    // mesh failure again, in bars rather than in a net. The board's bush has nothing like it,
    // because its leaves are separate rounded shapes with dark showing all the way round each one
    // and its CENTRE is dark mass, not a convergence of leaf bases.
    //
    // Two fifths of the rim, which is the setting AFTER the seam pass went in and is looser than
    // the half-rim it replaced. With overlaps turning into seams rather than merges, a blade
    // reaching further in costs a dark border instead of a flat plateau, so the leaves may cover
    // most of the plant and the one thing the floor still has to prevent is all of them converging
    // on the exact centre.
    const base = Math.max(rim * 0.38, tip - grown);
    out.push({
      x: cx + ca * base,
      y: cy + sa * base,
      a,
      len: tip - base,
      // Half-width, and it moved from 2.1 to 3.0 in the fifth pass for the same reason the three
      // plain bushes' did: a board leaf is about eight of our pixels across on a plant of thirty and
      // this was drawing five. Widening it here is also what closes the fifty-luma gap between a
      // flowering bush and a plain one -- a flower bush's green is mostly MASS rather than leaf,
      // because it carries five or six blades where a plain bush carries eight big ones, so lifting
      // the mass alone moved its median by four luma and widening the leaves moved it properly.
      wide: 3.0 + facing * 0.5,
      lit: 0.3 + facing * 0.34,
    });
  }
  return out;
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
/*
 * AND THE RIM IS NO LONGER AN ELLIPSE. This is the other half of the bush fix and it is the half
 * the client asked for by name.
 *
 * The previous layout put eight clumps on an ellipse centred (16,17), with the arithmetic of the
 * scallop dip worked out and correct -- two circles of radius r with centres d apart dip by
 * r - sqrt(r^2 - (d/2)^2), so r 3.6 at d 6 dips 1.6 px and the per-clump wobble swings that by
 * another 0.8. All of that stands and the three new layouts are built to it. What it got wrong is
 * that an ellipse stepped by 45 degrees is BILATERALLY SYMMETRIC, and `forest-map.ts` mirrors
 * fifty-three per cent of its decor horizontally: mirroring a shape that is already its own mirror
 * is a no-op, so 273 bushes were 273 copies of one frame with a coin flip that changed nothing.
 * Two hypotheses were spent on this upstream, both wrong, and this is the third: it was never the
 * scallop depth, it was the axis of symmetry.
 *
 * So `bush` is now a crown with a skirt -- a big rounded mass up and left, a smaller hump running
 * out to the lower right, and a notch between them where the lawn comes back in. There is no axis
 * it is symmetric about, and the mirror pass therefore buys a second silhouette for nothing.
 *
 * `bush-low` and `bush-tall` are the two new ones, and they differ in FOOTPRINT rather than in
 * outline detail, which is what reads at a 26-tile camera: `bush` fills its tile, `bush-low` is a
 * wide bank in the bottom half with lawn above it, `bush-tall` is a narrow leaning shrub with lawn
 * either side. Three plants with three footprints and a meaningful mirror is six frames where
 * there was one.
 *
 * Every centre below is inside the safe box, computed rather than eyeballed: a clump reaches
 * `r * 1.32`, and `ring()` adds one pixel above and left and two below and right of the waist, so a
 * clump of radius r needs its centre inside `1 + 1.32r .. 29 - 1.32r` horizontally and
 * `1 + 1.32r .. 29 - 1.32r` vertically. The border invariant in DESIGN_BOARD section 4.2 is the
 * reason: a keyline pixel on a tile's own edge prints a hard line against the grass tile beside it.
 */
/*
 * 2026-10-20, SEVENTH PASS: `bush` BLEEDS TO ITS LEFT AND RIGHT EDGES, so a bed of them prints as
 * one lobed mass instead of as a market garden.
 *
 * THE FAULT, measured rather than described. Lay two `bush` tiles side by side and walk each row:
 * the two plants are separated by lawn on 24 of the 32 rows, by a mean of 11.2 px and a maximum of
 * 27, and they touch on NONE. Every bush in the world is therefore a disc with a moat round it, and
 * the moat is drawn at exactly the camera's tile pitch -- which is what prints the lattice the title
 * and spawn frames still carry. `forest-map.ts` has already done everything placement can do (lone
 * bushes are 4.7 per cent and P(lag1) 0.592 beats P(lag2) 0.428), and the frame is still a grid of
 * pom-poms, because no amount of clumping closes a gap that is built into the tile.
 *
 * After: the same two tiles touch on 9 rows, and on 9, 11, 11 and 9 of the four pairings
 * `forest-map.ts`'s flip can produce. The 12 rows that still have lawn between them are the crowns
 * and the feet, which is the waist this is meant to be and not a failure to merge.
 *
 * WHY `bush` AND NOT ONE OF THE OTHER TWO. Counted off the map as it generates today -- the map
 * owner is mid-pass, so these move by a few either way: 187 `bush`, 118 `bush-low`, 16 `bush-tall`,
 * and of the 161 horizontally adjacent bush pairs in the world, 73 are `bush|bush` against 42
 * `bush-low|bush-low` and 3 `bush-tall|bush-tall`. `bush` is both the most numerous plant and the
 * one that stands beside itself most often, so bleeding it alone closes 45 per cent of every seam in
 * the world against `bush-low`'s 26. It is also the right plant on the drawing: its mass spans rows
 * 8..28, so the bleed lands on its WAIST and the two tiles join where both are widest. `bush-low` is
 * a bank in the bottom third, and merging a run of those end to end is how you draw the 26-tile
 * hedge `forest-map.ts` has its own guard against; `bush-tall` is deliberately narrow with lawn
 * either side, and 3 seams would not pay for it.
 *
 * THE SEAM IS THE WHOLE RISK, and it is answered by `rim()` rather than by the lobes. Mass running
 * flat to a tile edge gives you two faults for the price of one: at a seam the join is invisible
 * (good), but at the END of a run -- and 214 of the 364 `bush` edges in the world have something
 * other than a bush beside them -- a lit leaf is cut off square against the lawn with no keyline,
 * which is a rectangle, which is worse than the moat. So the outermost column of the bleed is
 * resolved to a CHANNEL, the same near-black `leafBlades` already cuts between two leaves. Then the
 * one drawing reads correctly both ways: at a seam the two tiles share a two-pixel dark fold, which
 * is what the board draws between two leaf masses (`1218 400 190 90`, the dark between its leaves
 * is one or two pixels); at the end of a run that same column is a one-pixel dark edge, which is
 * what a keyline is. Nothing is ever cut.
 *
 * AND IT IS A WAIST, NOT A BAR. The two lobes below are 7 and 8 rows tall against a plant 23 rows
 * tall, and they sit at different heights, so a run of bushes is lobe-waist-lobe-waist rather than
 * one rectangle with a scalloped top. The guard at the foot of this file holds all of it: one run
 * per edge, its height, the plant standing clear above and below it, the overlap between the two
 * edges that makes every one of the four mirror pairings join, the darkness of the seam column, and
 * -- the one that cannot be satisfied by accident -- that two tiles laid side by side are ONE
 * connected mass in all four pairings.
 */
const BUSH_BLEED: readonly Lobe[] = [
  // Centres OUTSIDE the safe box, which is the point: `lobeInto` clips its own raster to the tile,
  // so what lands is the inboard crescent of each clump and its edge at column 0 / 31 is the
  // clump's own wobbled rim rather than a ruled line. Both reach far enough in to meet the body --
  // a clump reaches `r * 1.32`, so the left one covers columns 0..6 against a body whose left edge
  // is column 3 over these rows, and the right one columns 25..31 against a body reaching 26..28.
  // A crescent that failed to meet the body would be ringed on its own and read as a chip of
  // foliage floating off the plant; the seam guard's connectivity check is what proves it does not.
  //
  // Different heights on purpose. Equal ones would make the plant its own mirror across the edges
  // and cost `forest-map.ts`'s flip the second frame it buys on 182 tiles (see PLANT_MIRROR_CAP);
  // they overlap on rows 17..21 regardless, which is what makes all four pairings join.
  // TWO CLUMPS A SIDE, NOT ONE, and the reason is the only thing the first render of this got
  // wrong. One clump a side bridged the two tiles correctly and printed a flat-topped slab doing
  // it: a single crescent is a single arc, so the keyline ran dead straight across the top of the
  // join for five or six pixels and the bridge read as a connector rather than as foliage. Two at
  // different heights scallop it, which is the same reason `BUSH`'s own rim carries eleven clumps
  // and not four.
  { x: 1.6, y: 17.0, r: 3.0, band: 1 },
  { x: 0.4, y: 20.4, r: 3.2, band: 0 },
  { x: 30.6, y: 19.0, r: 3.2, band: 1 },
  { x: 31.4, y: 22.4, r: 2.8, band: 0 },
];

/*
 * FOURTH PASS, 2026-10-20: a WIDE LOW SPRAY, because that is what the board draws and the crown
 * -with-a-skirt was still a dome.
 *
 * The third pass fixed the axis of symmetry and left the proportion alone, and the review was right
 * that the proportion was the visible half. Crop `1222 406 78 64 11` -- one bush out of the pair
 * inside the cottage fence -- and the board's plant is a broad, low thing whose widest run is about
 * one and a half times its height, with its mass gathered below the middle and its leaves spraying
 * out sideways. Four of ours in one frame read as four identical blobs because each was a 1:1
 * rounded mound, and the mirror of a near-square mass is a near-square mass.
 *
 * The proportion is carried by the BLADES, not by the clumps, and that is the change. A 28 px safe
 * box cannot hold a 1.5:1 clump mass big enough to still read as a bush -- the third pass proved
 * that by spending nine clumps filling the square. `rosette` now takes an elliptical rim and the
 * tips stand three or four pixels proud of the mass, so the silhouette is 25 by 19 where the clumps
 * are 24 by 18, and the leaves do the widening.
 *
 * The clumps therefore shrank in number and in spread: eleven, gathered in a bank with a tall
 * shoulder up and LEFT and a low skirt running out to the RIGHT, so there is still no axis it is
 * symmetric about and `forest-map.ts` flipping half its decor still buys a second plant.
 *
 * Every centre is inside the box: a clump reaches `r * 1.32` and `ring()` adds one pixel above and
 * left and two below and right of the waist, so a clump of radius r needs its centre inside
 * `1 + 1.32r .. 29 - 1.32r` on both axes. The widest lobe here is r 3.5 at x 8.6, which reaches
 * x 4.0 and, with the line, 3.0.
 */
const BUSH: readonly Lobe[] = [
  // The shoulder, up and left, and the crown just inboard of it. This is the high ground; nothing
  // on the right half reaches above y 14.6, which is the whole asymmetry.
  { x: 9.6, y: 14.0, r: 3.2, band: 2 },
  { x: 13.8, y: 12.4, r: 3.3, band: 2 },
  { x: 18.4, y: 14.6, r: 3.0, band: 2 },
  // The body: one row across the waist, wider than it is deep.
  { x: 6.4, y: 17.4, r: 3.0, band: 2 },
  { x: 11.4, y: 17.2, r: 3.4, band: 1 },
  { x: 16.6, y: 17.8, r: 3.2, band: 1 },
  { x: 21.4, y: 19.4, r: 2.8, band: 1 },
  // The foot, and the skirt running out low to the right. The lawn comes back in above the skirt,
  // between (18.4, 14.6) and (21.4, 19.4) -- 5.6 apart against radii summing to 5.8, so they meet
  // only at the base.
  { x: 9.4, y: 21.8, r: 3.2, band: 0 },
  { x: 14.6, y: 22.6, r: 3.4, band: 0 },
  { x: 19.4, y: 22.4, r: 3.0, band: 0 },
  { x: 24.0, y: 22.0, r: 2.6, band: 0 },
  ...BUSH_BLEED,
];

/*
 * `bush-low`: A SECOND PLANT, not a third footprint of the first one.
 *
 * 2026-10-20, SIXTH PASS. DESIGN_BOARD section 3 asks for "two or three bush silhouettes" and the
 * three tiles here answered it with three FOOTPRINTS of one plant: `bush` fills its tile,
 * `bush-low` banked along the bottom, `bush-tall` stood up. Every one of them was a mound of clumps
 * under a spray of spade leaves, so all three came out of `plainBush` with the same solidity to
 * three decimal places -- 0.775, 0.762, 0.779 -- and the same perimeter-to-area ratio, 10.5 to
 * 10.8. Measured where it matters: `bush` and `bush-low` are 189 and 142 of the map's 353 bushes
 * and their silhouettes agreed on 70 per cent of their pixels. At a 26-tile camera that is one
 * plant, and the spawn frame shows it -- a row of four by the stall reads as four copies.
 *
 * TWO HYPOTHESES ARE ALREADY DISPROVEN HERE AND NEITHER IS BEING RE-RUN. Mirroring is a no-op on a
 * near-circular disc, and thinning the fine octave of the layout noise did not change the spacing.
 * Both were attempts to vary the SAMPLING of one shape. The shape is what has to change.
 *
 * So this is a different plant rather than a shorter one: a low clump of long splayed FRONDS. Seven
 * small clumps make a base that barely shows, and nine narrow blades -- half-width 2.3 to 2.7
 * against `bush`'s 3.4, and half again as long -- fan up and out of it, so what you see is a spray
 * of separate points with lawn cutting between them down to the root. `bush` is a mass with leaves
 * lying on it; this is leaves with a mass behind them. The board draws both: the right-hand plant
 * in `1218 400 190 90 7` is a rosette of bright blades radiating from one centre with the dark
 * showing all the way between them, where the left-hand one is a filled mound.
 *
 * It is still a wide low bank and still leaves lawn above it -- the highest tip is row 14 and the
 * whole plant is about 28 by 16 against `bush`'s 26 by 23 -- so the map's use of it along the
 * cottage wall is unchanged.
 *
 * THE MESH IS THE FAILURE MODE AND THE LENGTHS ARE WHAT AVOID IT. This file's own note on
 * `rosette` records an outer ring of seven short blades plus an inner ring of five printing a
 * connected dark net -- "lighter patches behind a dark chain-link fence" -- because `leafBlades`
 * darkens every mass pixel that touches a blade and short blades packed round one centre leave the
 * mass as a network rather than as slivers. These blades spring from a base nine pixels wide
 * instead of from a point, and they are six to nine long, so the gaps between them WIDEN outwards
 * into lawn notches instead of closing into a net. Rendered and looked at, not assumed.
 */
const BUSH_LOW: readonly Lobe[] = [
  { x: 10.6, y: 21.6, r: 3.0, band: 2 },
  { x: 14.8, y: 20.8, r: 2.9, band: 2 },
  { x: 18.8, y: 22.4, r: 2.7, band: 1 },
  { x: 7.0, y: 22.8, r: 2.6, band: 1 },
  // The foot, staggered in y rather than ruled. Four clumps on one row leave `seat()` a straight
  // horizontal band to clamp dark and the plant comes out standing on a brick.
  { x: 12.2, y: 24.0, r: 2.8, band: 0 },
  { x: 17.0, y: 24.6, r: 2.6, band: 0 },
  { x: 21.4, y: 23.6, r: 2.4, band: 0 },
  { x: 24.4, y: 24.8, r: 2.0, band: 0 },
];

/*
 * `bush-tall`: a leggy upright shrub leaning right, narrow enough that lawn shows either side of it.
 *
 * The lean is what makes its mirror worth having -- flipped, it leans left, and the two read as two
 * plants at any distance. The clumps climb in a zigzag rather than a column, so the silhouette has
 * blades out of alternate sides instead of being a sausage.
 */
const BUSH_TALL: readonly Lobe[] = [
  { x: 19, y: 6.4, r: 2.6, band: 2 },
  { x: 21.2, y: 9.6, r: 2.6, band: 1 },
  { x: 16.4, y: 9, r: 2.8, band: 2 },
  { x: 19, y: 13, r: 3, band: 1 },
  { x: 14.6, y: 13, r: 2.8, band: 2 },
  { x: 17, y: 17, r: 3, band: 1 },
  { x: 12.6, y: 17, r: 2.8, band: 2 },
  { x: 15, y: 21, r: 3.2, band: 0 },
  { x: 11.2, y: 21, r: 3, band: 0 },
  { x: 13.6, y: 24.6, r: 3, band: 0 },
  { x: 17.4, y: 24, r: 2.8, band: 0 },
];

/**
 * SIX PLANTS, ONE GREEN. The fourth pass lifted the plain bushes and the flower bushes by different
 * amounts and seated them to different depths, on the argument that "a bloom is the bright mark on
 * those and their foliage is genuinely a mid-green backing for it". The fifth pass lifted the plain
 * bushes further and turned that difference into a visible fault.
 *
 * MEASURE THIS WITH THE BLOOM SEAT EXCLUDED OR THE NUMBER IS MEANINGLESS. `BLOOM_SEAT` is
 * `leafTone(0.02)`, rgb 34,115,66, luma 85 -- a GREEN, and four blooms ring themselves in about
 * ninety pixels of it, which is half of everything green inside a flower bush's body. A green-only
 * probe therefore reports a median of exactly 85 for all three flower bushes whatever the foliage is
 * doing, and sweeping the lift and the seat against it moves nothing. An hour went into that before
 * the histogram showed a single 92-pixel spike sitting on the median.
 *
 * With the seat colour excluded, green-only over the body: the plain bushes run median 131 to 147
 * and the flower bushes 88 to 91. The board's own bloom-free leaf slice at `1227 438 24 30` -- taken
 * off a FLOWERING bush -- runs median 103, so the flower bushes are about thirteen luma under the
 * board and the plain bushes twenty-eight to forty over it. The two families bracket the target
 * rather than one of them being wrong, and in the Arrive frame the map banks both along the same
 * stretch of cottage wall, where the split between them is visible.
 *
 * So there is one lift for all six and the seat falls by three quarters rather than fully, and the
 * bloom is separated from the leaf the way the board separates it -- by hue, and by the one-pixel
 * near-black ring `seatBloom` draws round every petal. Not by making the whole plant dark. The pink
 * and vermilion blooms probe 108 to 145, which is inside the foliage's own range and always was; it
 * is the seat ring that makes them read, and this is simply the board's own arrangement.
 *
 * WHAT IS LEFT, named rather than quietly left. The flower bushes' remaining forty luma is not the
 * lift and not the seat -- both were swept and neither moves it. Their mass is lower because
 * `MOUND`, `SPRAWL` and `SPIRE` pack eight or nine clumps of radius 3 to 4.5 at a five-pixel pitch,
 * so almost every clump sits inside another's `CREASE_DEPTH` falloff and the mass is creased away
 * before any leaf lands on it; the plain bushes use eleven clumps of radius 2.6 to 3.5 and crease
 * far less. Fixing it means re-spacing three approved silhouettes, which is a bigger change than the
 * one this round was asked for, and it should be done against the board rather than against this
 * paragraph.
 */
/*
 * FIFTH PASS, 2026-10-20: the mass goes UP and the channels stay where they are.
 *
 * The review's finding was an INVERSION -- "the board's bush is a bright mid-green mass with
 * near-black channels cut into it, ours is a dark mass with lit leaf tips on it" -- and the crop
 * that settles it is `1218 400 190 90` decimated to our density and put beside the three tiles at
 * zoom 9. At matched scale the board's bush is unmistakably a BRIGHT object: six or seven big flat
 * leaves at luma 110 to 170 covering most of it, with the dark reduced to one-pixel lines between
 * them and the scallop round the outside. Ours was the photographic negative of that -- a dark body
 * with narrow pale slivers lying on it -- and at a 26-tile camera a field of them reads as holes
 * punched in the lawn, which is the complaint the client has made twice.
 *
 * The histogram did not say so, and that is worth recording because it cost most of a round. Probed
 * body against body on a BLOOM-FREE board sample (`1227 438 24 30`, the left bush below its flower)
 * the two were already the same drawing by the numbers: board min 15 / q1 64 / med 103 / q3 147
 * against ours 43 / 65 / 109 / 142. The 96-and-133 figures the review quoted come from
 * `1240 424 44 34`, which is about half white-and-red bloom at luma 200+. There was never a tonal
 * gap to close. The gap is WHERE the light is, and no axis the score has can see that.
 *
 * Three changes, and only the third is a number:
 *
 * - The leaves are BIGGER AND FEWER. Measured off the matched-scale crop a board leaf is about
 *   eight of our pixels across on a bush of thirty -- a quarter of the plant, which is what this
 *   file's own third-pass note worked out and then never applied to `wide`, which stayed at a
 *   half-width of 2.0 to 2.4 and drew leaves five pixels across. At half-width 3.4 the leaf is
 *   seven or eight across, eight of them fill the plant, and they overlap into connected bright
 *   regions the way the board's do.
 * - The CHANNEL is clamped rather than subtracted, so lifting the mass cannot lift it. See
 *   `channelAt`. Without that this whole change is a no-op at one stop brighter.
 * - `BUSH_LIFT` rises, so the mass that still shows between the leaves is a mid-green rather than a
 *   near-black. It is the thing the board shows between its leaves and we showed a hole.
 */
/*
 * SEVENTH PASS, 2026-10-20: ASKED TO MOVE THIS, SWEPT IT, AND LEFT IT. READ THIS BEFORE SWEEPING IT
 * AGAIN -- IT IS A NO-OP ON THE NUMBER IT IS BEING ASKED TO MOVE.
 *
 * The brief was the honest gap the review named: our bush body sits about 36 luma off the lawn and
 * the board's sits about 76, and `BUSH_LIFT` is the obvious lever. The reason recorded above for
 * the current value still holds -- the mass between the leaves has to be a mid-green and not a hole
 * -- and that turns out not to be the interesting half of the answer.
 *
 * MEASURED, on the plant alone with the keyline excluded, against a lawn whose median is 169.8:
 *
 *     BUSH_LIFT                0.30    0.26    0.22    0.18    0.14    0.10
 *     bush        median      130.6   129.9   128.6   125.6   122.9   120.0
 *     bush-low    median      124.4   124.4   123.5   122.9   122.0   120.9
 *     bush-tall   median      124.1   122.0   120.9   119.1   116.4   112.9
 *     flower-white median      92.4    94.6    94.6    95.6    95.6    95.8
 *     flower-pink  median     103.0   102.8   102.8   101.4    99.8    98.0
 *     flower-red   median     109.1   109.1   109.1   109.1   108.5   108.0
 *
 * Cutting it by two thirds moves `bush` by 10.6 luma against the 28 the board is asking for, and
 * moves the three flower bushes -- which are already UNDER the board -- by 3.4 at most. There is no
 * setting of this constant that lands the plain bushes on the board without being a no-op on them
 * first, and the direction it would have to go is away from the fifth pass's finding.
 *
 * WHY, because the why is what tells the next pass where to go. `leafBlades` writes a leaf as
 * `Math.min(0.97, level + b.lit - ...)`, and the leaves ARE the plant: 46 of `bush`'s 264 body
 * pixels sit at luma 175, which is the ramp's ceiling, and the rest sit on nine flat leaf plateaus
 * at 107 to 162. The lift goes into `level`, `level + lit` is already over 0.97 on every lit leaf,
 * and the cap eats it. Swept the cap too, 0.97 down to 0.72: the median does not move at all, only
 * q3, because the median is not at the ceiling, it is on the plateaus.
 *
 * SO THE LEVER IS THE `lit` LADDER in `BUSH_BLADES` (0.32 to 0.64), not this constant and not the
 * cap. That is the fifth pass's central decision -- "a bright mass with near-black channels", which
 * it argued for from the board and measured both tails of -- and lowering it is a round of its own
 * with the board crop open, not a line in somebody else's pass. Raised as an ask.
 *
 * WHAT THIS PASS DID MOVE IT WITH, by accident and worth knowing: the bleed. `bush`'s body median
 * went 130.6 -> 123.5 and its share under luma 70 went 29.5 -> 34.2 per cent, because the edge
 * lobes add mass and `rim()` takes their outermost column to a channel. The gap to the lawn is
 * therefore 46.3 where it was 39.2, against the board's 69.9. A third of the way, from the other
 * end of the file entirely.
 */
const BUSH_LIFT = 0.3;

/**
 * And the plain bushes barely slope, where the flower bushes slope by 0.62.
 *
 * `slope()` lays one light diagonally across a whole mass, and for a flower bush -- whose foliage IS
 * the object and whose blooms are the marks on it -- that is right and stays. For a plain bush it
 * now fights the leaves. With the mass sloped, its upper left is as bright as the leaves lying on
 * it, so the leaves there have nothing to be seen against: the fourth pass's third render had a
 * legible leaf in every corner except the lit one, where six leaves and the mass under them were one
 * pale plateau.
 *
 * The board is unambiguous about this and the review quoted it: "there are bright leaves hard
 * against its bottom rim and dark channels up at its crown". The mass is dark at EVERY height and
 * the light is carried by how much of each leaf is lit. 0.22 keeps just enough tilt that the plant
 * is not a flat cut-out, and `seat()` still runs after it to put the plant's foot into the ground.
 */
const BUSH_SLOPE = 0.62;

/**
 * The plant alone, ringed on its own transparent scratch, before it meets the lawn.
 *
 * Split out of `plainBush` so the guard at the foot of this file can measure a SILHOUETTE. A
 * finished tile is opaque ground with the plant blitted onto it, so the only way to recover the
 * plant's outline from one is to diff it against the bare grass -- and that diff also catches the
 * contact shadow, a solid ellipse that fills in exactly the notches between the leaf points this
 * round is about. Measured both ways on the same tiles, the shadow moves a bush's solidity by six
 * hundredths and its cross-tile overlap by a tenth, which is the whole size of the effect being
 * guarded. The alpha of this scratch is the plant and nothing else.
 */
const plainBushPlant = (list: readonly Lobe[], blds: readonly Blade[], seed: number): Img => {
  const m = mass();
  foliage(m, list, seed);
  lift(m, BUSH_LIFT);
  slope(m, BUSH_SLOPE);
  // Three rows rather than four, and the reason is the leaves. `seat()` clamps the bottom of the
  // mass to a fixed dark and `leafBlades` then rises OVER that, so at depth 4 the lowest leaf on
  // the plant started from -0.30 and the bottom quarter of every bush came out as one black band
  // with no leaf in it. Three rows still seats the plant -- the contact shadow under it does most
  // of that work anyway -- and leaves the lowest row of leaves somewhere to rise from.
  // `fall` 0.62 rather than the flower bushes' full depth, and this is the black-skirt fix.
  //
  // At full fall the bottom row of the mass is clamped to -0.30, luma 51, which is thirteen levels
  // under the channels and eight under the keyline drawn round the whole plant: the foot of every
  // bush was a solid band darker than its own outline. The board's bush foot is dark and it is
  // dark in the way a leaf underside is dark -- crop `1218 400 190 90` and there are plainly lit
  // leaves hard against its bottom rim with the near-black only in the scallop between them. At
  // 0.62 the floor is -0.13, luma 68, which sits above the channels and leaves the lowest row of
  // leaves somewhere to rise from. The contact shadow under the plant does the seating.
  seat(m, 3, 3, 0.62);
  weather(m, seed + 77, 0.07);
  leafBlades(m, blds);
  rim(m);
  const leaves = render(m, leafTone);
  ring(leaves, LEAF_LINE);
  return leaves;
};

/**
 * One plain bush: the lawn, its shadow, the plant, and the tufts that cross its foot.
 *
 * `shadowAt` is the contact shadow's own centre and width, which is not the tile's centre any more:
 * a bush that leans has its weight somewhere other than the middle, and a shadow under the middle
 * of a lopsided plant is the fastest way to make it float.
 */
const plainBush = (
  list: readonly Lobe[],
  blds: readonly Blade[],
  seed: number,
  shadowAt: readonly [number, number, number],
  tufts: readonly (readonly [number, number, number])[],
  variant: 1 | 2 = 2,
): Painter =>
  function paintPlainBush(img) {
    ground(img, variant);
    contactShadow(img, shadowAt[0], shadowAt[1], shadowAt[2]);
    img.blit(plainBushPlant(list, blds, seed), 0, 0);
    blades(img, tufts);
  };

/*
 * The blade sets: an outer rosette per leaf mass, whose long up-and-left blades make the points,
 * and a short inner rosette for the texture between them.
 *
 * Each set is checked against the safe box rather than eyeballed. A rosette's longest blade reaches
 * `radius * 0.55 + len * 1.18 * 1.12` from its centre, and `ring()` then wants one more pixel above
 * and left and two below and right, so that distance plus the margin has to land inside 1..30. The
 * numbers below are the result of doing that arithmetic for each centre, and `bush-low`'s two
 * rosettes in particular are pulled in from where the humps' own middles are because a rosette
 * centred on the left hump at radius 6.5 put its leftmost tip on column 0.
 */
/*
 * FEWER, BIGGER, AND PLACED BY HAND. The third pass's own failure note says the first two and the
 * review repeated them; the fourth pass found out the hard way that the third is what makes them
 * stick.
 *
 * `rosette` still exists and the four flower bushes still use it, because a flower bush wants a
 * loose ring of leaves behind its blooms and does not much care where each one lands. For the three
 * plain bushes -- where the leaves ARE the drawing -- a generator was the wrong tool. Eight blades
 * from one centre overlap heavily near their roots however the floor is set, so most of the later
 * ones survive only as slivers between seams, and a dump of the render bore that out: no compact
 * bright shape anywhere in the body, just single bright pixels scattered through mid ones.
 *
 * So each plain bush's leaves are written out. Nine or ten of them, each a spade of about 5 by 7 --
 * the board's own leaf at matched scale, measured off `1222 406 78 64 11` -- with its base on the
 * body and its tip on the silhouette, laid out so no two bases are closer than three pixels and
 * adjacent leaves meet along one pixel of edge rather than lying across one another. They are in
 * reading order round the plant, which matters: `leafBlades` resolves an overlap in favour of the
 * EARLIER leaf, so the list runs from the best-lit leaf at the top left round to the darkest at the
 * bottom right, and where two meet it is the shaded one that gives up the pixel.
 *
 * `lit` is how far up the ramp this leaf stands above the mass under it, and it is the one light:
 * 0.76 at the top left falling to 0.42 at the bottom right. That floor is higher than the first
 * hand-placed layout used, and the dump is why: at 0.28 the bottom leaves sat on `seat()`'s dark
 * underside and resolved into it, so rows 16 to 28 of the tile held no bright pixel at all and the
 * plant was a lit crown over a black skirt. The board has bright leaves hard against its BOTTOM rim
 * -- the clearest thing in `1222 406 78 64 11` is four of them along the bottom edge -- and the
 * light across the plant is carried by how much of each leaf is lit, not by which leaves are. `wide` is the half-width at the leaf's
 * broadest, a quarter of the way up from the base.
 *
 * THE SAFE BOX. A tip has to land inside 1..29 horizontally and vertically for `ring()`'s one pixel
 * above and left and two below and right to stay on the tile; a keyline pixel on a tile's own edge
 * prints a hard line against the grass beside it (DESIGN_BOARD section 4.2). Every tip below is
 * `base + len` along its own angle, computed rather than nudged: `bush`'s furthest are (3.5, 18.5)
 * on the left, (26.5, 19.5) on the right, (15.5, 8.5) at the top and (15.5, 27.4) at the bottom.
 */
/**
 * `wide` is a HALF-width and its default went from 2.4 to 3.4 in the fifth pass, which is the
 * single largest change in the file: it is the difference between a leaf five pixels across and one
 * eight across, and eight is what the board draws on a bush of thirty. See the note on `BUSH_LIFT`.
 */
const leaf = (x: number, y: number, a: number, len: number, lit: number, wide = 3.4): Blade => ({
  x,
  y,
  a,
  len,
  wide,
  lit,
});

/*
 * `bush`: a wide low spray, 23 px of leaf across against 19 of height, with the high ground up and
 * left and a low skirt running out to the lower right. There is no axis it is symmetric about, so
 * `forest-map.ts` mirroring half its decor buys a second plant rather than the same one twice.
 */
const BUSH_BLADES: readonly Blade[] = [
  leaf(12.2, 15.8, 0.625, 8.0, 0.64, 3.6),
  // The crown's two points, at slightly different heights. With one up-pointing leaf the top of the
  // plant was the MASS's own rim, which the clumps leave nearly flat, and a flat top with a single
  // notch in it is the one place the silhouette still read as stamped rather than grown.
  leaf(15.6, 14.6, 0.75, 6.2, 0.6, 3.4),
  leaf(18.8, 15.2, 0.86, 5.8, 0.52, 3.2),
  // AN INTERIOR LEAF, lying ACROSS the plant rather than out to its rim, and it is here to break a
  // channel rather than to make a point. With every leaf radiating from the middle to the edge, the
  // boundary between the up-and-left half and the down-and-right half is one continuous dark line
  // running corner to corner, and a bush with a straight channel through it reads as split rather
  // than as leafy -- plainly visible at zoom 8 and invisible to all six axes. The board's channels
  // are short and broken because some of its leaves lie over others instead of beside them.
  leaf(13.6, 18.6, 0.08, 5.6, 0.5, 3.0),
  leaf(10.6, 18.4, 0.5, 7.1, 0.56, 3.5),
  leaf(11.8, 21.4, 0.375, 6.0, 0.42, 3.4),
  leaf(15.5, 22.0, 0.25, 5.4, 0.36, 3.4),
  leaf(20.4, 19.4, 0.0, 6.1, 0.38, 3.4),
  // The skirt's own leaf, out past everything else: the one lobe the main spray cannot reach, and
  // the one place a smooth dome would still show.
  leaf(22.8, 22.2, 0.06, 4.2, 0.32, 2.8),
  // THE TWO LEAVES THAT RUN OFF THE TILE, and they are the only tips in this file that deliberately
  // break the safe box. Without them the bleed lobes are bare mass: a five-pixel pad of flat
  // mid-green at each edge, which is the one part of the plant with no leaf in it, and a bed of
  // them would read as discs joined by webbing. With them, two adjacent tiles meet leaf to leaf
  // across the fold, which is what the board shows wherever two of its bushes touch.
  //
  // Their tips land at column -0.1 and column 32.2, so `bladeHalf` is still rising when the raster
  // clips them: what prints is the broad part of a leaf, not a point, which is correct -- the point
  // is in the neighbouring tile. `rim()` runs after this pass and takes the outermost column of
  // each down to a channel, so no lit value ever reaches a tile edge; the guard holds that at 72.
  leaf(5.6, 17.4, 0.47, 5.6, 0.44, 2.6),
  leaf(4.8, 20.8, 0.53, 5.0, 0.34, 2.4),
  leaf(26.6, 19.4, 0.97, 5.4, 0.34, 2.6),
  leaf(27.2, 22.4, 0.04, 4.8, 0.28, 2.4),
];

/*
 * `bush-low`'s fronds: nine of them, springing from a nine-pixel-wide base rather than from a
 * point, fanning from due left round through vertical to due right.
 *
 * NARROW AND LONG, which is the opposite of what the fifth pass did to `bush` and is the whole
 * reason the two plants no longer look alike. A `bush` leaf is a spade -- half-width 3.4, length
 * 4 to 8, a quarter of the plant across -- and eight of them cover the mass. A frond here is
 * half-width 2.3 to 2.7 and six to nine long, so it is a sixth of the plant across and twice as
 * long as it is wide, and nine of them cover about half the mass and leave the rest as lawn
 * between the points.
 *
 * In reading order, best-lit first, because `leafBlades` resolves an overlap in favour of the
 * EARLIER blade: the up-and-left fronds come first and the down-and-right ones give up the pixel.
 *
 * Every tip is `base + len` along its own angle, computed rather than nudged, and the extremes are
 * (3.2, 20.7) and (2.8, 24.0) on the left, (27.8, 20.6) and (27.8, 24.5) on the right, (12.6, 14.4)
 * at the top and (11.8, 28.2) at the bottom. `ring()` adds one pixel above and left and two below
 * and right of the waist, so those land inside 1..30 on both axes -- and the guard at the foot of
 * this file checks the rendered tile rather than this paragraph.
 */
const BUSH_LOW_BLADES: readonly Blade[] = [
  leaf(12.0, 23.0, 0.66, 9.6, 0.7, 2.6),
  leaf(14.6, 22.2, 0.73, 9.0, 0.66, 2.7),
  leaf(10.0, 23.6, 0.58, 8.0, 0.62, 2.5),
  leaf(17.4, 22.8, 0.79, 7.2, 0.56, 2.6),
  leaf(8.6, 24.6, 0.52, 5.8, 0.48, 2.3),
  leaf(20.2, 23.4, 0.87, 7.0, 0.46, 2.5),
  leaf(21.8, 24.4, 0.94, 6.0, 0.4, 2.4),
  leaf(22.6, 25.6, 1.0, 4.8, 0.34, 2.2),
  // TWO FRONDS DOWN ONTO THE BOTTOM RIM, and they are the fix for a dark bar the first render of
  // this layout printed right across the plant's foot. With every blade springing UPWARD, the row
  // of clumps under them stayed bare mass, `seat()` clamped its bottom three rows dark, and the
  // result was a straight horizontal near-black band the width of the plant -- a mouth. `bush`
  // never shows it because two of its leaves point down and reach its own bottom rim. The board
  // agrees: crop `1218 400 190 90 7` and there are plainly lit leaves hard against the bottom edge
  // of both its bushes, with the near-black only in the scallops between them. These two also
  // break the straight channel the radiating fronds leave up the middle.
  leaf(11.4, 24.4, 0.3, 4.6, 0.42, 2.4),
  leaf(16.6, 24.6, 0.21, 4.2, 0.36, 2.4),
];

/*
 * `bush-tall`: a leggy upright shrub leaning right, narrow enough that lawn shows either side. The
 * lean is what makes its mirror worth having, and the leaves alternate sides up its height so the
 * silhouette has points out of both flanks instead of being a sausage.
 */
const BUSH_TALL_BLADES: readonly Blade[] = [
  leaf(17.6, 10.2, 0.7, 5.4, 0.66, 3.0),
  leaf(15.8, 13.0, 0.55, 5.4, 0.6, 3.1),
  leaf(19.4, 12.6, 0.88, 4.8, 0.54, 2.9),
  leaf(14.6, 16.6, 0.51, 5.2, 0.5, 3.1),
  // The same channel-breaker as `bush`'s, and this plant needed it more: with its leaves alternating
  // out of the left and right flanks all the way up, the two columns met along a dead straight
  // vertical line the full height of the shrub, which reads as a crack.
  leaf(15.6, 18.2, 0.1, 4.6, 0.42, 2.9),
  leaf(18.2, 17.0, 0.95, 4.8, 0.44, 2.9),
  leaf(13.8, 20.6, 0.44, 5.0, 0.4, 3.0),
  leaf(16.8, 21.4, 0.06, 5.0, 0.38, 2.9),
  leaf(15.0, 23.8, 0.23, 4.6, 0.34, 3.0),
];

const bushTile = plainBush(BUSH, BUSH_BLADES, 4100, [15, 27, 12], FOOT_TUFTS['bush']!);

const bushLowTile = plainBush(
  BUSH_LOW,
  BUSH_LOW_BLADES,
  4300,
  [16, 27, 12.5],
  FOOT_TUFTS['bush-low']!,
  1,
);

const bushTallTile = plainBush(
  BUSH_TALL,
  BUSH_TALL_BLADES,
  4400,
  [14, 27, 8],
  FOOT_TUFTS['bush-tall']!,
);

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
    lift(m, BUSH_LIFT);
    slope(m, 0.62);
    seat(m, 4, 3, 0.75);
    weather(m, 5233, 0.07);
    leafBlades(m, rosette(16, 17, 5, 9.5, 5250, 6));
    // Fewer blades than a plain bush, and none where a bloom is going to land. A flower bush on the
    // board carries both -- `55 620 170 110 7` shows three lit leaf patches between its two daisies
    // -- but a blade under a bloom is nine pixels of drawing nobody will ever see.
    const plant = render(m, leafTone);
    // Far enough apart to keep a run of leaf between them. At eleven pixels across, blooms any
    // closer than this merge into one white mass and the plant loses its count.
    bloom(plant, 10, 14, 3, b, 0.04);
    bloom(plant, 19, 13, 3, b, -0.05);
    bloom(plant, 15, 21, 3, b, 0);
    bloom(plant, 24, 19, 2, b, -0.08);
    ring(plant, LEAF_LINE);
    img.blit(plant, 0, 0);
    blades(img, FOOT_TUFTS['flower-white']!);
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
    lift(m, BUSH_LIFT);
    slope(m, 0.62);
    seat(m, 4, 3, 0.75);
    weather(m, 6333, 0.07);
    leafBlades(m, rosette(15, 19, 5, 8.5, 6350, 5.6));
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
    blades(img, FOOT_TUFTS['flower-pink']!);
  };

/**
 * `flower-red`: the board's vermilion spray, Explore frame at `889 389 194 167 6`.
 *
 * REBUILT THIS ROUND, and the reason is the one thing a review can see that a measurement cannot.
 * `flower-pink` and `flower-red` were reported as near-indistinguishable at 1x, and putting the two
 * tiles side by side at a 26-tile camera says that is right -- not because the hues failed, but
 * because both plants carried FIVE blooms of the same size, so both read as "small red dots on a
 * green mound" and the sprawl-versus-spire distinction lived entirely in a silhouette that is only
 * six pixels different in height.
 *
 * The board does not draw them the same size. Measured off `889 389 194 167 6` at matched scale,
 * its red plant is about 38 of our pixels across and each of its two crosses about 14 -- so a bloom
 * is better than a third of its plant, against the pink's five blooms at a fifth each. Count and
 * size are the separator, and they survive any distance: TWO BIG CROSSES against FIVE SMALL ONES is
 * legible in a thumbnail, where coral against vermilion is not.
 *
 * So the spire opens out into a spray: still the tallest of the three and still upright, but about
 * twenty pixels wide rather than sixteen, because a nine-pixel bloom on a sixteen-pixel plant
 * covers it. The clumps climb in a zigzag with real gaps, which is what the board's spray does --
 * its foliage is an open, lacy thing with lawn showing through it, not a column.
 */
const SPIRE: readonly Lobe[] = [
  { x: 16, y: 7, r: 2.8, band: 2 },
  { x: 12, y: 10, r: 3, band: 2 },
  { x: 20, y: 11, r: 2.8, band: 1 },
  { x: 15, y: 13, r: 3.2, band: 1 },
  { x: 10, y: 16, r: 3, band: 2 },
  { x: 21, y: 16, r: 3, band: 1 },
  { x: 16, y: 17, r: 3.2, band: 1 },
  { x: 12, y: 21, r: 3.2, band: 0 },
  { x: 20, y: 21, r: 3.2, band: 0 },
  { x: 16, y: 23, r: 3.4, band: 0 },
];

const spireFlower = (b: Petals): Painter =>
  function paintSpireFlower(img) {
    ground(img, 1);
    contactShadow(img, 16, 27, 11);
    const m = mass();
    stemInto(m, 16, 4, 26, -1);
    foliage(m, SPIRE, 7400);
    lift(m, BUSH_LIFT);
    slope(m, 0.62);
    seat(m, 4, 3, 0.75);
    weather(m, 7433, 0.07);
    leafBlades(m, rosette(16, 15, 5, 8.5, 7450, 5.8));
    const plant = render(m, leafTone);
    // One closed bud at the tip, then TWO open crosses at `arm` 3 -- nine pixels, the mound's own
    // bloom size -- one high on the lit side and one low and forward. Three marks, not five, and
    // two of them big: that is the whole difference from `flower-pink` at a distance, and it is the
    // board's own arrangement rather than a guess.
    budAt(plant, 16, 6, b);
    bloom(plant, 12, 12, 3, b, 0.05);
    bloom(plant, 19, 19, 3, b, -0.04);
    ring(plant, LEAF_LINE);
    img.blit(plant, 0, 0);
    blades(img, FOOT_TUFTS['flower-red']!);
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
  blades(img, FOOT_TUFTS['rock']!);
};

/* ------------------------------------------------------------------------------- the toadstools */

/**
 * Cream stems under russet caps, TWO to a tile -- see the note in `toadstoolRing` below, which is
 * where the count lives and why. (This line used to say three, which is what the tile drew before
 * the rash was cut, and a docstring that argues for the count the code no longer uses is how a
 * reverted fix gets re-reverted. The guard at the foot of this file now holds the number.)
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
  // TWO, not three, and off-centre. Back to front, which here is highest and smallest first.
  //
  // `forest-map.ts` stamps 58 of these, which at three caps a tile put 174 red mushrooms into a
  // forest whose board shows none at all in its Explore frame, and the client's note about the
  // landing screen named them: red caps in clusters read as poison. Three domes also filled the
  // tile corner to corner, so two stamps side by side produced a continuous brown band -- a rash
  // rather than a ring.
  //
  // Two is still a cluster, which one cap is not: a single mushroom a tile gives a map the dotted
  // line DESIGN_BOARD section 2 complains about along the world's border. At a third less russet
  // per tile the map owner can group them without the group becoming a blob.
  //
  // They sit left of centre so the mirror pass finally buys something here too: flipped, the big
  // cap stands on the right and the pair leans the other way, which at a 26-tile camera is a
  // different clump rather than the same one twice. The three still stand clear of one another --
  // domes that touch keyline their outsides only and read as one lumpy mass.
  one(22, 13, 4.2, 2.7, 21, [
    [20, 11, false],
    [23, 13, true],
  ]);
  one(13, 19, 6.2, 4, 27, [
    [9, 16, true],
    [15, 15, true],
    [17, 19, false],
  ]);
  blades(img, FOOT_TUFTS['toadstool-ring']!);
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
  /*
   * `fur` held to the bottom of its own range, not the whole of it.
   *
   * The petals used to run `tone('fur', 0..1)` -- 196 to 255 -- and peaked at a measured 247, which
   * made them the brightest thing in any frame they appear in at the map's current flower density.
   * The board's own daisy does reach white, but it reaches it on a bush whose body probes at a
   * median of 124 with a quarter of it under luma 72, and against that a white cross is a flower.
   * Against our foliage it was a headlight.
   *
   * Held over 0 to 0.42 the petals run 196 to about 232, which is within a few levels of the 226 the
   * review asked for and still unmistakably white: the step from petal to the leaf under it is over
   * eighty levels, where the board's is about a hundred. The eye stays `gold` and stays bright --
   * one orange pixel is what the board gives it and it is three per cent of the bloom.
   */
  'flower-white': moundFlower({
    tone: (t) => tone('fur', t),
    lo: 0,
    hi: 0.42,
    eye: (t) => tone('gold', t),
  }),
  // `rose` is held LOW on its ramp, not high, and that is the opposite of the obvious choice. The
  // pull keeps the red channel untouched, so the top of the ramp is pinned near luma 165 -- lighter
  // than the lawn it stands on, which is both wrong against the board (its pink cross probes 101 to
  // 141) and the one thing a flower must never be. Held over 0 to 0.42 the petals run 108 to 145
  // and the plant reads as a pink mass sitting ON the grass instead of dissolving into it.
  'flower-pink': sprawlFlower({ tone: rose, lo: 0, hi: 0.42, eye: (t) => tone('wall', t) }),
  'flower-red': spireFlower({ tone: ember, lo: 0.08, hi: 0.95, eye: (t) => tone('gold', t) }),
  // TWO PLANTS IN THREE TILES, which is not what this comment used to claim. `bush` and `bush-tall`
  // are one plant at two footprints -- a mound of clumps under a spray of broad spade leaves --
  // and `bush-low` is now a second species: a low clump of long narrow fronds with lawn cutting
  // between the points. See the note above `BUSH_LOW`. The map lays 189, 142 and 22 of them, so the
  // second silhouette lands on 40 per cent of the bushes in the world.
  //
  // The mirror still buys a frame on top of that: none of the three is symmetric about any axis, so
  // `forest-map.ts` flipping about half its decor gives six frames rather than three.
  //
  // `bush-low` and `bush-tall` are NEW NAMES, appended to the end of `TILE_NAMES`. Appending cannot
  // move an existing gid -- a gid is the index plus one -- so `map-forest.json` stays valid and no
  // tile on the map shifts. `pnpm graybox` has to be re-run by whoever owns the generated assets
  // before any change in this file reaches the game.
  bush: bushTile,
  'bush-low': bushLowTile,
  'bush-tall': bushTallTile,
  rock: rockTile,
  'toadstool-ring': toadstoolRing,
};

/* ------------------------------------------------------------------------------- the guards */

/*
 * Three findings this round closed, checked on the rendered tiles rather than asserted in a
 * docstring. The idiom is `w-trees.ts`'s crown guard: paint the thing, take a signature, throw with
 * the numbers in the message. It runs at module load, so `pnpm graybox`, `pnpm world`, `pnpm score`
 * and `pnpm preview` all fail loudly rather than writing a quietly reverted asset.
 *
 * Every bound here is TWO-SIDED, because each of these has a cheap one-sided way to pass that is
 * worse than the fault:
 *
 *   - A tuft could satisfy "at least five pixels across" by growing into a bush at the plant's
 *     foot, so it is also capped, and the mark count is capped at three a tile.
 *   - Two bush silhouettes could stop overlapping by one of them shrinking to a pea, so each
 *     plant's area is held in a band as well.
 *   - The toadstool count is an equality, which is the only shape of bound that holds a number
 *     somebody has already had to cut twice.
 *
 * WHAT EACH ONE IS ACTUALLY PROTECTING, so a future pass can tell a retune from a regression:
 *
 *   1. THE FOOT TUFT IS A FAN. It was three single-pixel dashes for three passes while the
 *      docstring above it said "two or three blades crossing an object's foot". The thing being
 *      held is the board's own measure, recorded in `w-ground.ts`: "about seven of our pixels
 *      across and four tall".
 *   2. THERE ARE TWO PLANTS. DESIGN_BOARD section 3 asks for "two or three bush silhouettes" and
 *      three tiles of one plant at three footprints answered it on paper and not in the frame --
 *      `bush` and `bush-low` are 331 of the map's 353 bushes and their silhouettes agreed on 70
 *      per cent of their pixels. Measured on the PLANT alone, which is why `plainBushPlant` exists:
 *      a diff against the bare lawn also catches the contact shadow, and the shadow is a solid
 *      ellipse filling exactly the notches between the leaf points that carry the difference.
 *   3. THE TOADSTOOL IS TWO CAPS. It was three, `forest-map.ts` stamped 58 tiles, and 174 red caps
 *      in a forest whose board shows none in its Explore frame is the rash the client's note about
 *      the landing screen named. The map is down to three stamps; this holds the other factor.
 *
 *   4. NOTHING PAINTS ON A TILE'S OWN EDGE BY ACCIDENT. Not a finding, and the easiest thing in
 *      this file to break: these tiles are scattered, never tiled, so a keyline pixel or a blade
 *      tip that strays onto row 0 or column 31 prints a hard line against whatever grass tile is
 *      laid next door -- DESIGN_BOARD section 4.2, "the shared border ring". Checked by holding
 *      every border pixel within 32 levels of one of the four bare grass variants, which a clipped
 *      blade cannot be.
 *   5. AND `bush` BLEEDS ON PURPOSE. The seventh pass runs `bush`'s mass off its two side edges so
 *      a bed of them merges, which is the one place 4 above had to give way -- and it gives way to
 *      a stricter check rather than to a hole. Guard 5 owns those two columns: one run on each,
 *      its height, the plant standing clear above and below it, the rows the two share, the
 *      darkness of every pixel in them, and that two tiles side by side are ONE connected mass in
 *      all four mirror pairings. Row 0 and row 31 stay under 4 on every tile including this one.
 */

/** The eight neighbours, for marks the eye reads as one stroke along a diagonal. */
const RING8: readonly (readonly [number, number])[] = [
  ...CROSS,
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * Connected marks in a mask: width, height and pixel count each.
 *
 * `diagonal` picks the neighbourhood, and which one is right depends on what is being counted. A
 * TUFT is eight-connected, because a blade that gives way near its tip steps a pixel sideways on
 * every row and the eye reads that as one stroke; counting it four-connected reports a three-pixel
 * blade as three marks. TWO TOADSTOOL CAPS are four-connected, because two domes that touch at a
 * corner are still two mushrooms and eight-connectivity would weld them into one and hide exactly
 * the thing the cap count is guarding.
 */
/*
 * `width` is here for the seam check and defaults to one tile, so every existing caller is
 * unchanged. The seam check needs to flood a TWO-tile strip, because the question it asks -- are
 * these two plants one mass or two? -- cannot be asked of either tile on its own.
 */
function marksOf(
  on: Uint8Array,
  diagonal = false,
  width = TILE,
): { w: number; h: number; n: number }[] {
  const near = diagonal ? RING8 : CROSS;
  const area = on.length;
  const height = area / width;
  const seen = new Uint8Array(area);
  const out: { w: number; h: number; n: number }[] = [];
  for (let s = 0; s < area; s++) {
    if (!on[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = width;
    let x1 = -1;
    let y0 = height;
    let y1 = -1;
    let n = 0;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i / width) | 0;
      n += 1;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const [dx, dy] of near) {
        const jx = x + dx;
        const jy = y + dy;
        if (jx < 0 || jy < 0 || jx >= width || jy >= height) continue;
        const j = jy * width + jx;
        if (on[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    out.push({ w: x1 - x0 + 1, h: y1 - y0 + 1, n });
  }
  return out;
}

const opaqueMask = (img: Img): Uint8Array => {
  const on = new Uint8Array(AREA);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) if (img.get(x, y)[3] > 0) on[y * TILE + x] = 1;
  return on;
};

const mirrorMask = (on: Uint8Array): Uint8Array => {
  const out = new Uint8Array(AREA);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) out[y * TILE + x] = on[y * TILE + (TILE - 1 - x)]!;
  return out;
};

/** Intersection over union of two silhouettes: 1 is the same shape, 0 is no shared pixel. */
const overlapOf = (a: Uint8Array, b: Uint8Array): number => {
  let both = 0;
  let either = 0;
  for (let i = 0; i < AREA; i++) {
    if (a[i] || b[i]) either += 1;
    if (a[i] && b[i]) both += 1;
  }
  return either === 0 ? 1 : both / either;
};

const paintedTile = (name: string): Img => {
  const img = new Img(TILE, TILE);
  UNDERGROWTH_TILES[name]!(img);
  return img;
};

/* 1. The foot tuft is a fan, two or three to a tile, clear of every edge. */

const TUFT_BOUNDS = { wide: [5, 9], tall: [3, 5], ink: [6, 16], perTile: [2, 3] } as const;

for (const [name, spots] of Object.entries(FOOT_TUFTS)) {
  const scratch = new Img(TILE, TILE);
  blades(scratch, spots);
  const on = opaqueMask(scratch);
  const found = marksOf(on, true);
  const say = `${name}: ${found.length} tuft(s) ${found.map((m) => `${m.w}x${m.h}:${m.n}px`).join(' ')}`;
  if (spots.length < TUFT_BOUNDS.perTile[0] || spots.length > TUFT_BOUNDS.perTile[1])
    throw new Error(
      `A plant tile carries two or three foot tufts, never ${spots.length} (DESIGN_BOARD section 3). ${say}`,
    );
  if (found.length !== spots.length)
    throw new Error(
      `Two foot tufts have merged into one mark, which reads as a patch rather than as blades: ${say}.`,
    );
  for (const m of found)
    if (
      m.w < TUFT_BOUNDS.wide[0] ||
      m.w > TUFT_BOUNDS.wide[1] ||
      m.h < TUFT_BOUNDS.tall[0] ||
      m.h > TUFT_BOUNDS.tall[1] ||
      m.n < TUFT_BOUNDS.ink[0] ||
      m.n > TUFT_BOUNDS.ink[1]
    )
      throw new Error(
        `A foot tuft is not a fan any more (want ${TUFT_BOUNDS.wide.join('..')} px across, ` +
          `${TUFT_BOUNDS.tall.join('..')} tall, ${TUFT_BOUNDS.ink.join('..')} px of ink -- the board's own ` +
          `tuft is 7 by 4, see w-ground.ts). ${say}`,
      );
}

/*
 * 2. Two plants in three tiles, neither of them shrunk to get there, and a mirror that still buys
 *    a frame.
 *
 * Measured on the plant alone, this round's change against the fifth pass's drawing:
 *
 *     overlap                         before   after   cap
 *     bush vs bush-low                 0.700   0.520
 *     worst cross-tile pair            0.700   0.591   0.64
 *     bush-low against its own mirror  0.874   0.712   0.80
 *     bush against its own mirror      0.733   0.729   0.80
 *     bush-tall against its own mirror 0.624   0.624   0.80
 *
 * `bush` and `bush-low` are the first row because they are 331 of the map's 353 bushes; the worst
 * cross-tile pair is now `bush` against a mirrored `bush-tall`, which SHOULD be alike -- they are
 * one plant at two footprints and nobody asked for a third species.
 *
 * THE MIRROR CAP IS NOT DECORATION. `forest-map.ts` flips about half its decor, so a tile that is
 * its own mirror halves the vocabulary of every scatter it appears in. This file's third pass found
 * that the hard way -- 273 copies of a bush whose rim was an ellipse, with a coin flip that changed
 * nothing -- and the first draft of the frond plant below walked straight back into it at 0.874,
 * because a fan laid symmetrically about the tile's centre is a symmetric fan. The guard caught it;
 * the render did not.
 *
 * Both caps sit between the before and the after, nearer the failure, so there is room to retune a
 * layout without tripping them and none to put either drawing back.
 */

/*
 * EXPORTED, although both guards that read it live in this file, because every body-luma figure in
 * this file's notes was measured through it and the next pass will want to re-take them. A plant's
 * silhouette cannot be recovered from a finished tile -- the tile is opaque ground with the plant
 * blitted onto it, and a diff against the bare lawn also catches the contact shadow, which fills in
 * exactly the notches between the leaf points. This is the only honest handle on the drawing.
 */
export const PLANT_GUARDS = [
  // `bush`'s ceiling went 420 -> 470 in the seventh pass and the reason is the bleed, not a retune:
  // the four edge lobes and their leaves add a measured 93 px of plant (358 -> 451), which is the
  // whole of the change. The floor is untouched, which is the end of this bound that does the work.
  { name: 'bush', plant: plainBushPlant(BUSH, BUSH_BLADES, 4100), lo: 300, hi: 470 },
  { name: 'bush-low', plant: plainBushPlant(BUSH_LOW, BUSH_LOW_BLADES, 4300), lo: 215, hi: 320 },
  { name: 'bush-tall', plant: plainBushPlant(BUSH_TALL, BUSH_TALL_BLADES, 4400), lo: 260, hi: 370 },
] as const;

const PLANT_OVERLAP_CAP = 0.64;
const PLANT_MIRROR_CAP = 0.8;

{
  const frames: { name: string; on: Uint8Array }[] = [];
  for (const g of PLANT_GUARDS) {
    const on = opaqueMask(g.plant);
    let n = 0;
    for (let i = 0; i < AREA; i++) n += on[i]!;
    if (n < g.lo || n > g.hi)
      throw new Error(
        `${g.name} is ${n} px of plant, outside ${g.lo}..${g.hi}. The band is here because the cheap ` +
          `way to pass the overlap bounds below is to shrink one of the three, and a pea on a lawn is ` +
          `worse than two bushes that look alike.`,
      );
    const self = overlapOf(on, mirrorMask(on));
    if (self > PLANT_MIRROR_CAP)
      throw new Error(
        `${g.name} is ${(self * 100).toFixed(1)}% its own mirror, over the ` +
          `${(PLANT_MIRROR_CAP * 100).toFixed(0)}% cap, so forest-map.ts flipping half its decor buys ` +
          `nothing on it. Lean the plant: the fault is a layout laid symmetrically about x 16, not the ` +
          `sampling. See the note above BUSH_LOW.`,
      );
    frames.push({ name: g.name, on }, { name: `${g.name} mirrored`, on: mirrorMask(on) });
  }
  let worst = 0;
  let pair = '';
  for (let i = 0; i < frames.length; i++)
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i]!;
      const b = frames[j]!;
      if (a.name.split(' ')[0] === b.name.split(' ')[0]) continue;
      const v = overlapOf(a.on, b.on);
      if (v > worst) {
        worst = v;
        pair = `${a.name} vs ${b.name}`;
      }
    }
  if (worst > PLANT_OVERLAP_CAP)
    throw new Error(
      `Two bush silhouettes have converged again: ${pair} share ${(worst * 100).toFixed(1)}% of ` +
        `their pixels, over the ${(PLANT_OVERLAP_CAP * 100).toFixed(0)}% cap (DESIGN_BOARD section 3, ` +
        `"two or three bush silhouettes"). Mirroring and resampling were both tried upstream and ` +
        `neither moves this -- the LEAF has to change: see the note above BUSH_LOW.`,
    );
}

/* 3. The toadstool is two caps. */

const TOADSTOOL_CAPS = 2;

{
  const img = paintedTile('toadstool-ring');
  const on = new Uint8Array(AREA);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      // `rust` is the only red-dominant family on this tile; the stem, the spots and the gills are
      // all cream or near-black. A 24-level lead in red over both other channels picks the dome and
      // nothing else.
      const [r, g, b] = img.get(x, y);
      if (r > g + 24 && r > b + 24 && r > 60) on[y * TILE + x] = 1;
    }
  const caps = marksOf(on).filter((m) => m.n >= 6);
  if (caps.length !== TOADSTOOL_CAPS)
    throw new Error(
      `toadstool-ring draws ${caps.length} caps, not ${TOADSTOOL_CAPS}. At three caps a tile the map's ` +
        `stamps put 174 red mushrooms in the forest and the client called the landing screen creepy; ` +
        `at one a tile a row of stamps is a dotted line. See the note in toadstoolRing.`,
    );
}

/* 4. Nothing DRAWN lands on a tile's own edge, except where a tile bleeds ON PURPOSE. */

/*
 * THE ONE EXEMPTION, and why it is named here rather than widened into the cap.
 *
 * `bush` runs its mass off its left and right edges so a bed of them merges (see the note above
 * `BUSH_BLEED`), so those two columns cannot be held against bare lawn -- they are 138 levels off
 * it, which is the whole point of the change. They are not unguarded: guard 5 below owns them, and
 * it is stricter than this one, because it holds the shape of the run, its height, the plant
 * standing clear above and below it, and the darkness of every pixel in it.
 *
 * TOP AND BOTTOM STAY GUARDED ON EVERY TILE INCLUDING THIS ONE. A tile bleeds sideways because a
 * bed of bushes is a horizontal run; nothing in this file has any business on row 0 or row 31, and
 * the vertical seam a bleed downward would print has no fix.
 */
const EDGE_BLEEDS: readonly string[] = ['bush'];

/*
 * The cap is a step, not an equality, and the difference is a finding rather than a convenience.
 *
 * Byte equality was the first version of this check and every one of the eight tiles failed it: the
 * contact shadow's outermost ring is a flattened ellipse 1.22 times the object's base, and on all
 * eight it reaches the border. Measured against each tile's own grass variant, 3 to 22 of the 124
 * border pixels differ, by at most 21 to 23 in any channel.
 *
 * That is under 24, which is the step this project's own edge census calls an edge, so the join
 * between a plant tile and the grass beside it does not register as a line -- and it is plainly
 * deliberate, because the three shadow rings are drawn at alpha 46, 92 and 196 and only the
 * faintest reaches that far. It is worth knowing about rather than guarding away: DESIGN_BOARD
 * section 4 states "there is not one seam between ground and decor anywhere in the world", and
 * what is actually true is that there is no seam the census can see. Shrinking the shadow to make
 * the border byte-clean would unseat every plant in the file, which is a worse trade.
 *
 * So the bound is 32: comfortably above the 23 the shadows sit at, and comfortably below what a
 * DRAWN mark on the border costs. A tuft blade on the edge steps about 50 against the lawn and a
 * keyline pixel about 95, which is the fault this is here to catch -- a clipped leaf tip or a tuft
 * nudged one column too far prints a hard line against whatever grass tile is laid next door, and
 * these tiles are scattered rather than tiled, so it prints everywhere they land.
 */
const BORDER_STEP_CAP = 32;

{
  const lawns = [0, 1, 2, 3].map((v) => {
    const img = new Img(TILE, TILE);
    GROUND_TILES[`grass-${v}`]!(img);
    return img;
  });
  const rows: [number, number][] = [];
  for (let x = 0; x < TILE; x++) rows.push([x, 0], [x, TILE - 1]);
  const columns: [number, number][] = [];
  for (let y = 1; y < TILE - 1; y++) columns.push([0, y], [TILE - 1, y]);
  for (const name of Object.keys(UNDERGROWTH_TILES)) {
    const border = EDGE_BLEEDS.includes(name) ? rows : [...rows, ...columns];
    const img = paintedTile(name);
    // The best-matching variant, because a painter picks its own lawn and this guard does not know
    // which. A mark on the border is far outside every variant's spread, so the minimum is enough.
    let step = 255;
    let at = '';
    for (const lawn of lawns) {
      let worst = 0;
      let where = '';
      for (const [x, y] of border) {
        const a = img.get(x, y);
        const b = lawn.get(x, y);
        const d = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
        if (d > worst) {
          worst = d;
          where = `${x},${y}`;
        }
      }
      if (worst < step) {
        step = worst;
        at = where;
      }
    }
    if (step > BORDER_STEP_CAP)
      throw new Error(
        `${name} draws on its own border: ${step} levels off the bare lawn at ${at}, over the ` +
          `${BORDER_STEP_CAP} cap. Every copy of this tile prints a hard line against the grass tile ` +
          `beside it (DESIGN_BOARD section 4, "the shared border ring"). A clipped leaf tip, or a ` +
          `tuft root closer to an edge than half its own fan is wide, is the usual cause.`,
      );
  }
}

/* 5. The bush bleeds, it bleeds as a waist, the seam is dark, and two of them are ONE mass. */

/*
 * This guard exists because the fault it protects against is invisible to everything else we have.
 *
 * The thing being held is a MERGE: `bush` runs its mass off its left and right edges so that a bed
 * of them prints as one lobed mass rather than as separate discs with lawn between (see the note
 * above `BUSH_BLEED`). Nothing already in this file can see that. The border guard above cannot --
 * it is the check the bleed had to be exempted from. The six-axis score cannot: swapping a 26-tile
 * hedge for a treeline moved its distance by 0.006, because a bush and a crown have nearly the same
 * luma histogram, and closing an 11-pixel moat between two bushes moves rather less than that. And
 * a render cannot be relied on either, because the failure mode is a quiet one -- pull the two
 * edge lobes out of `BUSH` and the tile still paints, still passes every other guard in this file,
 * and goes straight back to the market garden.
 *
 * SIX BOUNDS, AND NONE OF THEM IS WRITTEN IN TERMS OF THE CONSTANT IT GUARDS. The numbers below are
 * literals chosen from the drawing -- a plant 23 rows tall, a board channel one or two pixels wide,
 * leaves that run 107 to 175 on this plant -- not from `BUSH_BLEED`'s radii or centres. Putting the
 * lobes back where they were, or shrinking them, or lifting the seam column to a lit value, each
 * fails at least one of these, and (f) fails on all of them.
 *
 *   (0) THE PLANT IS ONE MASS. Checked first, because every bound below is satisfiable by a lobe
 *       that has drifted off the body entirely, and what that leaves is a chip of foliage ringed on
 *       its own beside every bush in the world.
 *   (a) ONE RUN PER EDGE. Column 0 and column 31 each carry exactly one contiguous run of plant.
 *       Two runs means a stray tip has been clipped somewhere else on the edge, which is the fault
 *       the border guard catches on every other tile and which this one would otherwise hide.
 *   (b) THE RUN IS A WAIST. 4 to 14 rows. Under four will not survive the neighbour's own wobble
 *       and the merge comes apart into a dotted join; over fourteen on a plant 23 rows tall is a
 *       bar, and a run of bars is the rectangle this change is meant not to be.
 *   (c) THE PLANT STANDS CLEAR of its own seam, above and below, by at least 8 rows in total. This
 *       is what makes a bed read as lobe-waist-lobe rather than as a hedge with a scalloped top:
 *       satisfying (b) by letting the whole plant shrink to the height of its seam would pass (b)
 *       and fail the drawing.
 *   (d) THE TWO EDGES OVERLAP by at least 4 rows. `forest-map.ts` flips about half its decor, so a
 *       seam is one of four pairings; rows the two edges share are the rows that join in ALL of
 *       them. They are deliberately not identical -- see the note on `BUSH_BLEED` -- and this is
 *       the floor under how far apart they may drift.
 *   (e) THE SEAM IS DARK. Every pixel of both runs at or under luma 72. The channel band is 46 to
 *       56 and `LEAF_LINE` is 43, so this says "the edge column is the plant's own near-black". A
 *       lit leaf reaching a tile edge -- the thing `rim()` exists to prevent -- is 107 at its
 *       darkest on this plant and fails by 35.
 *   (f) AND THE ONE THAT CANNOT BE SATISFIED BY ACCIDENT: two `bush` plants laid side by side are
 *       ONE four-connected mass, in all four mirror pairings. This is the merge itself, stated as
 *       the question a player's eye asks, and it is independent of every number above.
 */

const SEAM_RUN_ROWS = [4, 14] as const;
const SEAM_CLEAR_ROWS = 8;
const SEAM_SHARED_ROWS = 4;
const SEAM_DARK_CAP = 72;

{
  const plant = PLANT_GUARDS.find((g) => g.name === 'bush')!.plant;
  const on = opaqueMask(plant);

  /*
   * THE PLANT IS ONE MASS BEFORE IT IS ANYTHING ELSE, and this check is here because the note on
   * `BUSH_BLEED` claims it and (f) below cannot see it. An edge lobe whose centre drifts outward
   * until its crescent no longer meets the body is still a perfectly good bleed by every bound
   * above -- one run on each edge, the right height, dark, overlapping -- and it still merges with
   * the neighbour, so (f) still finds exactly one mass spanning the seam. What it leaves is a chip
   * of foliage ringed on its own, floating off the side of every bush in the world.
   */
  if (marksOf(on).length !== 1)
    throw new Error(
      `bush's plant is ${marksOf(on).length} separate masses, not 1. An edge lobe has drifted far ` +
        `enough out that its crescent no longer meets the body, so ring() outlines it on its own ` +
        `and every bush in the world carries a chip of foliage floating beside it. Pull the lobe ` +
        `inboard until it overlaps the body: see the note above BUSH_BLEED.`,
    );

  /** The rows on one edge column that carry plant, as contiguous runs. */
  const runsOn = (x: number): { from: number; to: number }[] => {
    const out: { from: number; to: number }[] = [];
    let from = -1;
    for (let y = 0; y <= TILE; y++) {
      const lit = y < TILE && on[y * TILE + x] === 1;
      if (lit && from < 0) from = y;
      if (!lit && from >= 0) {
        out.push({ from, to: y - 1 });
        from = -1;
      }
    }
    return out;
  };

  const edges = [0, TILE - 1].map((x) => ({ x, runs: runsOn(x) }));
  const say = edges
    .map((e) => `col ${e.x}: ${e.runs.map((r) => `${r.from}..${r.to}`).join(',') || 'none'}`)
    .join('; ');

  for (const e of edges) {
    if (e.runs.length !== 1)
      throw new Error(
        `bush must bleed to each of its side edges as exactly ONE run, not ${e.runs.length} ` +
          `(${say}). None at all is the market garden coming back -- a bed of bushes separated by ` +
          `11 px of lawn at the camera's own tile pitch, which is the lattice DESIGN_BOARD section 2 ` +
          `names in the title and spawn frames. Two is a leaf tip clipped somewhere else on the edge, ` +
          `which guard 4 cannot see on this tile because this guard owns its side columns. ` +
          `See the note above BUSH_BLEED.`,
      );
    const rows = e.runs[0]!.to - e.runs[0]!.from + 1;
    if (rows < SEAM_RUN_ROWS[0] || rows > SEAM_RUN_ROWS[1])
      throw new Error(
        `bush's seam on column ${e.x} is ${rows} rows, outside ${SEAM_RUN_ROWS.join('..')} (${say}). ` +
          `Under the floor the merge comes apart into a dotted join once the neighbour's own wobble ` +
          `is counted; over the ceiling, on a plant 23 rows tall, the bleed is a bar and a bed of ` +
          `them is one rectangle with a scalloped top.`,
      );
  }

  let top = TILE;
  let bottom = -1;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (on[y * TILE + x]) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  const seamTop = Math.min(...edges.map((e) => e.runs[0]!.from));
  const seamBottom = Math.max(...edges.map((e) => e.runs[0]!.to));
  const clear = seamTop - top + (bottom - seamBottom);
  if (clear < SEAM_CLEAR_ROWS)
    throw new Error(
      `bush stands only ${clear} row(s) clear of its own seam (plant ${top}..${bottom}, seam ` +
        `${seamTop}..${seamBottom}), under ${SEAM_CLEAR_ROWS}. The bleed has to be a WAIST: the plant ` +
        `bulges above and below it in every tile, so a bed reads as lobe-waist-lobe. A plant no ` +
        `taller than its own seam passes the run bounds above and still prints a hedge.`,
    );

  const shared = edges
    .map((e) => e.runs[0]!)
    .reduce((a, b) => ({ from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) }));
  const overlap = Math.max(0, shared.to - shared.from + 1);
  if (overlap < SEAM_SHARED_ROWS)
    throw new Error(
      `bush's two side seams share only ${overlap} row(s), under ${SEAM_SHARED_ROWS} (${say}). ` +
        `forest-map.ts flips about half its decor, so a seam is one of four pairings and only the ` +
        `rows BOTH edges carry are the rows that join in all of them.`,
    );

  for (const e of edges)
    for (let y = e.runs[0]!.from; y <= e.runs[0]!.to; y++) {
      const l = lumaOf(plant.get(e.x, y));
      if (l > SEAM_DARK_CAP)
        throw new Error(
          `bush puts luma ${l.toFixed(0)} on column ${e.x} at row ${y}, over the ${SEAM_DARK_CAP} cap. ` +
            `The edge column has to be the plant's own near-black, because the SAME column is a fold ` +
            `between two bushes on 73 of the world's seams and a keyline against bare lawn on every ` +
            `other bush edge. A lit leaf there is cut off square against the grass tile next door. ` +
            `rim() is what holds this; check it still runs after leafBlades.`,
        );
    }

  /*
   * (f) The merge itself. Two plants, side by side, in each of the four pairings the map's flip can
   * produce, flooded as one 64 x 32 strip: the mass that touches the left tile must be the same
   * mass that touches the right one.
   */
  const mirrored = mirrorMask(on);
  const pairings: [string, Uint8Array, Uint8Array][] = [
    ['plain|plain', on, on],
    ['plain|flipped', on, mirrored],
    ['flipped|plain', mirrored, on],
    ['flipped|flipped', mirrored, mirrored],
  ];
  for (const [label, left, right] of pairings) {
    const strip = new Uint8Array(TILE * 2 * TILE);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        strip[y * TILE * 2 + x] = left[y * TILE + x]!;
        strip[y * TILE * 2 + TILE + x] = right[y * TILE + x]!;
      }
    const marks = marksOf(strip, false, TILE * 2);
    const spanning = marks.filter((m) => m.w > TILE).length;
    if (spanning !== 1)
      throw new Error(
        `two bush tiles laid side by side (${label}) are ${marks.length} separate mass(es) and ` +
          `${spanning} of them span the seam, not 1. This is the whole of the change: a bed of ` +
          `bushes has to print as one lobed mass, not as discs with lawn between them at the ` +
          `camera's own tile pitch. See the note above BUSH_BLEED.`,
      );
  }
}
