/*
 * Red, at 32 x 48: four facings by four frames, the sixteen she is on screen for the whole game.
 *
 * Redrawn against `reference/mocks/gameplay-concepts.png`. The board shows her three times -- from
 * the front on the forest path (Explore), and from behind at the stall and at the cottage door
 * (Question, Arrive) -- and all three agree on a shape the previous pass did not have. Measured off
 * the Question frame, where her silhouette runs 161 board pixels from crown to sole:
 *
 *   hood          rows   3..75   45% of her height, and 92 board px wide: wider than it is tall
 *   shoulder      rows  76..86   pinched to 61 px, a clear notch under the hood's overhang
 *   cloak         rows  87..132  flaring back out to 95, with the basket past that at 110
 *   legs, boots   rows 133..163  19% of her height, 50 px across
 *
 * That is a dome on a pinch on a bell, and it is a different animal from the old sprite, whose hood
 * was the same width as its body all the way down -- `docs/ART_DIRECTION.md` section 10.4 calls that
 * exact failure by name ("she reads as a bottle"). Those four ratios are what this file is built
 * from: the hood is 20 of her 43 rows and 24 px across, the shoulders pinch to 16, the hem flares to
 * 20, and the legs take the bottom seven rows.
 *
 * Colour, per `docs/PIXEL_STANDARD.md` section 2: nothing here is a raw hex. The garment is `cloak`,
 * which the 2026-10-18 rebrand moved to Cyera purple (section 12's one deliberate departure from
 * the board: match its form, not its red). She is AUBERGINE-LED, and the paragraph below is why,
 * because this file argued the opposite for three rounds and the argument was never measured.
 *
 * Her keyline is `keyline('cloak')` -- Deep Purple taken down 40 luma with the hue kept, #160620 --
 * and `ink` stays reserved for the wolf so that he alone reads as a silhouette. Section 3.2's second
 * pixel is here too: the keyline thickens to 2 px along the bottom and nowhere else, which is what
 * seats her on the ground.
 *
 * Light is top-left always, which is why `left` is not `right` mirrored: mirroring would carry the
 * lit arc round to the shaded side and she would read as a hole in the ground on half her frames.
 *
 * ---
 *
 * WHY AUBERGINE LEADS, measured off the board rather than reasoned from the palette.
 *
 * `ART_PRODUCTION` section 6a offers two cloaks, "both produced by recolouring the real sprite with
 * a LUMINANCE-PRESERVING ramp", and recommends A, Lilac-led, as "easiest to find at a 26-tile
 * camera". Every previous pass in this file took the recommendation and dropped the constraint. So
 * the board's Explore frame was sampled directly -- `reference/mocks/gameplay-concepts.png`, Red at
 * (780,620), the crop around her:
 *
 *     board, measured          luma        ours before this change
 *     cape, the mass          74 ..  83    175  (Lilac, #d28eff)
 *     hood, the lit side      95 .. 104    175 .. 213
 *     lawn she stands beside 166 .. 180    167 .. 179
 *     path she stands on     216           --
 *
 * The board's Red is a DARK figure on a LIGHT ground, 70 to 140 luma below everything around her.
 * Lilac at 175 against a lawn at 167..180 is not a findable figure, it is camouflage: identical
 * luma, and since the rebrand the same hue family as the flowers, the toadstools and the stall
 * awning. Option A's recommendation was a prediction about a camera, and the prediction is simply
 * wrong about this lawn -- it assumed grass darker than the grass we have.
 *
 * AND THE CAMERA IT PREDICTED ABOUT DOES NOT EXIST EITHER, which is worth saying because the phrase
 * is quoted verbatim above and should not be mistaken for a measurement. `ART_PRODUCTION` section 6a
 * wrote "a 26-tile camera"; the game shows 19.41 x 11.22 tiles at 1280x800, and 26 x 15 was the
 * field of view of a 1.5x zoom option `packages/core/src/camera.ts` rejects by name. The real camera
 * is the more generous of the two, so it weakens the recommendation further rather than rescuing it.
 * Ask `cameraFor` in `@otp/core` rather than quoting either figure again.
 *
 * Aubergine, #6d2d93 at luma 76, is the luminance-preserving match for that cape to within two
 * levels. So the ramp is inverted: Aubergine holds the mass, Lilac is the rim light, the hood crown
 * and the fold highlights and nothing else, Haze is a handful of specular pixels, and the keyline
 * stays near-black.
 *
 * The standing objection to this, which earlier headers in this file and in the since-deleted
 * `red-sprite.ts` both stated, is that luma 76 "is the band every cast shadow in the world sits in"
 * -- `shadow` runs 33 to 81 -- so she would read as a hole. That objection is half right and it cost
 * us two rounds, so it is worth being exact about why it does not bind. It measures one channel.
 * `shadow` is a desaturated GREEN (#2c4f2b is R44 G79 B43); Aubergine is a saturated PURPLE
 * (R109 G45 B147).
 * They share a luma band and nothing else, and the board settles the point by doing exactly this:
 * its scarlet cape at luma 74..83 sits in the same band as its own tree shade and is still the
 * first thing the eye lands on, because findability is hue contrast against the GROUND, not
 * absolute brightness. What must not happen -- the real failure mode behind the objection -- is a
 * cloak that is dark AND desaturated. Hence the band below never descends into Deep Purple for
 * cloth: level 0 is the keyline and the deep folds only.
 *
 * ---
 *
 * Re-shaded 2026-10-19, and this is the change worth understanding, because it is not a redraw.
 * Measured against the board's own Red (the Explore frame, crown to sole), in luma buckets of 32:
 *
 *     bucket      0-31   32-63   64-95  96-127  128-159  160-191  192-223   224+
 *     board      14.6%   15.7%   16.6%   15.3%     7.2%    11.3%    18.1%   1.2%
 *     this file   1.1%   33.5%   15.3%    6.4%     4.3%    28.1%     9.8%   1.6%
 *
 * Two faults, and neither is a shape:
 *
 * 1. Nothing was dark. The outline was `shade('cloak', 0)` at L43, which is not an outline, it is a
 *    midtone -- hence 1.1 per cent below L32 against the board's 14.6. The board rings everything in
 *    a near-black of the object's own hue, and that single line is most of why it reads as one
 *    illustrated world. `keyline('cloak')` is that line.
 *
 * 2. A 99-luma canyon ran down the middle of the ramp. Aubergine sits at L76 and Lilac at L175 with
 *    nothing in between, so the two buckets either side of L128 were empty and EVERY boundary
 *    between the shaded side and the lit body was a maximal edge. Four hard steps on a round mass do
 *    not read as roundness, they read as noise -- which is why the edge-density axis sat at twice
 *    the board's while the art was, if anything, over-detailed. `tone()` crosses that canyon
 *    continuously, so the dome and the cloth now round off through a dozen values each.
 *
 * The fix for both is tonal, so the dome-pinch-bell silhouette above is untouched. What went is the
 * three-level dome, the four-level cloth run and the `(y & 1)` dither column that used to stand in
 * for a half-tone -- an alternating L76/L175 checker is a maximal edge on every other pixel, which
 * is the single most expensive thing that was in this file.
 *
 * That tonal work was right and is kept. Its REPORTED numbers were not: the "18 -> 254 distinct
 * colours per frame" in an earlier version of this comment does not appear in any render of this
 * file, and the figure that matters -- 383 distinct colours over the whole sixteen-frame sheet, a
 * variety of 6.81 per thousand pixels -- is what it actually produced. Numbers in this header are
 * now only ever pasted from a run.
 *
 * ---
 *
 * HOW TO MEASURE THIS FILE, because three rounds have measured it wrongly in two different ways.
 *
 * 1. `pnpm world` composes TILES ONLY. It imports `tiles.ts` and `forest-map.ts` and never draws a
 *    sprite; `--at spawn-red` is a camera landmark, not Red. A controlled A/B of this file against
 *    the committed one, tiles held constant, moves `pnpm score` by exactly 0.000. Sprite work has
 *    to be rendered as a sheet and profiled: `node src/score.ts --profile <sheet.png>`.
 *
 * 2. `board-profile.json` is the WRONG TARGET for a sprite, and this is the more expensive mistake.
 *    It is built from board crops at roughly 2.7x our resolution. Downsample the board's own Red to
 *    our scale with NEAREST sampling and profile her, and two of the six axes fall apart:
 *
 *        axis        board Red @ our res    this file    verdict
 *        deep                     50.00        48.90     match
 *        keyline                  35.71        35.32     match
 *        spread                   54.05        56.57     match
 *        texture                  49.30        52.06     match
 *        edges                    40.08        27.85     CONTAMINATED
 *        variety                 554.42         5.54     MEANINGLESS
 *
 *    The downsampled board carries 1163 distinct colours in 1176 pixels -- every pixel unique,
 *    because resampling an interpolated mock produces noise. That noise inflates `variety` by two
 *    orders of magnitude and inflates `edges` with it, since neighbouring noise differs by more
 *    than the 24-luma threshold. Those two axes measure the mock's resolution, not its art. The
 *    other four are aggregate statistics that survive the noise, and they are the ones to trust.
 *
 *    Note which way the contamination points: at matched resolution the board appears to have MORE
 *    edges than us, not fewer. The whole-world score says the opposite and says it loudly, and the
 *    round that chased it sanded the art smooth. Do not chase `edges` or `variety` on a sprite.
 *
 * 3. NEITHER OF THE ABOVE IS THE TEST THAT MATTERS, and this round is the first to run the one
 *    that does. Both of them measure Red against white. She is never seen against white. Composite
 *    a frame onto a real render of the map -- `pnpm world --out /tmp/w.png --at spawn-red`, then
 *    read the PNG back and blit the frame onto the grass -- and look at it. Thirty lines of
 *    throwaway script, and it answered in one glance a question four rounds of statistics had not
 *    asked: what does the eye land on first? The answer was her ankles. See below.
 *
 * ---
 *
 * 2026-10-19, the round that looked at her on the grass. Four faults off the review sheet, and the
 * outcome on each, honestly:
 *
 * 1. "NO KEYLINE." Not true of this file, and it is worth recording why the sheet said so rather
 *    than quietly fixing nothing. `seatOutline(body, keyline('cloak'))` has run on every frame
 *    since the previous round: #160620 at luma 14, against a lawn at 117 and her own cloth at 87.
 *    She has had a near-black outline all along. The note almost certainly described an older
 *    render -- this file's own footer claimed for two rounds that nothing imported it. THAT claim
 *    is now false too, and provably: `sprites.ts` line 14 imports `./sprites/char-red.ts`, and the
 *    committed `apps/game/src/assets/red.png` profiles at 48.81 / 35.23 / 56.52 / 27.66 / 52.03 /
 *    5.54, which is this file's pre-change sheet to the second decimal on all six axes. The import
 *    was moved; the footer was not. Nothing was done to the keyline this round.
 *
 * 2. "THE CLOAK IS A FLAT PURPLE FIELD." Fair, and three marks were added for it -- the hood's
 *    overhang cast onto the shoulders, a hem line under the cloth, and the cowl seam dropped to
 *    the ramp's darkest so the back view is a hood rather than an egg. A fourth change, tapering
 *    the rim light instead of switching it on and off at the cape line, is RIGHT and moved almost
 *    nothing: the boolean it replaced was already true for exactly the six rows the taper covers,
 *    so the whole visible difference is the falloff within them. Recorded as a near-null result
 *    rather than claimed as a win.
 *
 * 3. "THE SIDE FACE HAS NO MOUTH." Half true, which is the interesting half. The mouth was there
 *    and was drawn in `shade('trunk', 0)` -- luma 58, on skin at 180, immediately under a fringe
 *    drawn from the same ramp. It is now the keyline value, like the front face's eyes.
 *
 * 4. "THE CYAN BOOTS PULL THE EYE TO HER FEET." The headline, and the composite is what proved it.
 *    Fixed by rebuilding both ladders under the hem. Measured over the sixteen-frame sheet:
 *
 *        mean luma below the hem        53.0  ->  26.1
 *        denim, the five columns across the leg, by luma
 *                                       99 102 105 109 111  ->  45 45 72 72 101
 *        luma buckets, 0-31 / 32-63     25.9 / 10.2  ->  30.1 / 21.0
 *        sheet profile, deep / keyline  48.81 / 35.23  ->  58.04 / 42.75
 *        distinct colours on the sheet   239  ->  215
 *
 *    That middle row is the whole fault in one line, and it is not the one the review named. The
 *    old leg was not "too cyan": it was five columns spanning twelve levels, which is a flat
 *    bright blue rectangle with no modelling at all, under a cloak whose mass is 87. The brightest
 *    denim pixel has only come down ten levels. What changed is that four of the five columns are
 *    now well below the cloth instead of all five sitting above it, so the leg reads as a round
 *    limb in shadow with one lit edge -- which is what the board draws -- rather than as a lamp.
 *
 *    A first attempt simply darkened all five to 37..69. It measured better on every axis and it
 *    was worse: the legs became one dark block and the cool note the board genuinely has (its
 *    back-view Red is wearing visible blue jeans) went with them. Reverted by eye, against the
 *    numbers. Recorded because the numbers will tempt the next round to do it again.
 *
 *    The colour count FELL, and that is the change working rather than a regression: what went was
 *    a `tone()` sweep across a ramp whose floor is already a bright mid-blue, and what replaced it
 *    is three values that sit where the board's do. Variety is not worth buying at the price of a
 *    figure lit from the feet up.
 *
 * TWO NUMBERS THAT GOT WORSE, stated rather than buried. Against the board's own Red downsampled
 * to our resolution (the table above), `deep` moves 48.81 -> 58.04 against her 50.00 and `keyline`
 * 35.23 -> 42.75 against her 35.71: both were a near-match and both now overshoot by eight points.
 * The cause is known and is not the denim -- swapping the denim between the two ladders above
 * moves `deep` by 0.33 -- it is the boots, four dark rows across two feet on all sixteen frames.
 * The judgement is that a figure whose bottom fifth is dark is what the board shows and what seats
 * her on the ground, and that eight points on an aggregate taken from a resampled mock is the
 * cheaper thing to spend. If a later round wants those two axes back, the place to buy them is the
 * boots, and it should look at the composite before and after rather than at this paragraph.
 *
 * `pnpm score --world` at spawn-red is 0.177 before and 0.177 after, to three decimals. That is
 * expected and is stated so the next round does not read it as a failure: see point 1 above, the
 * world render contains no sprites. PARTIAL 0 on all sixteen frames.
 */
import { Img, keyline, shade, tone } from '../paint.ts';
import type { RGBA } from '../paint.ts';

export const RED_FRAME_W = 32;
export const RED_FRAME_H = 48;

const CX = 16;
/**
 * Bottom row of the boot's sole. `seatOutline` lays its two rows of keyline under it, so the
 * figure's lowest INK row is `FOOT + 2` and that row is what a player sees her standing on.
 *
 * 45, not 43, and this is a seating fix rather than a redraw. Her origin is the bottom edge of the
 * 48-row frame, so at 43 her contact line sat two rows SHORT of it and she hovered 2px over
 * whatever she was standing on. Every character in `cast.ts` and `bystanders.ts` draws to the last
 * row of their frame -- measured off the shipped sheets, all eight have their lowest ink at row 47
 * -- which is why the cast plant on the ground and she did not. With the NPCs re-seated onto the
 * bottom edge of their tile (`forest-scene.ts`, half a TILE rather than half a FRAME), the two
 * halves of that 10px disagreement close to nothing only if both land together; on its own, either
 * one leaves her high by the other's share.
 *
 * The shin follows it. `paintLegs` runs the denim from under the hem down to the boot's top row
 * rather than for a fixed three rows, so moving the boot lengthens the shin instead of opening a
 * two-row hole above the ankle. Her silhouette therefore grows from 46 rows to 48; she is the
 * tallest figure in the cast either way (the Lantern Keeper is 44) and nothing in the body-plan
 * guard covers her.
 */
const FOOT = 45;
/** Bottom row of cloth. Fixed: the body bobs into the hem, which is what makes a walk. */
const HEM = 36;

type Facing = 'down' | 'left' | 'right' | 'up';
const FACINGS: readonly Facing[] = ['down', 'left', 'right', 'up'];

/** Frame 0 stands; 1 and 3 are the strides, 2 passes back through standing. */
const STRIDE: readonly (-1 | 0 | 1)[] = [0, -1, 0, 1];

/**
 * The cloak's tonal band, written as `tone()` positions rather than ramp indices, because the whole
 * point is the values BETWEEN the four stops. `t` runs 0 at Deep Purple to 1 at Haze.
 *
 * Retargeted onto the board's measured cape (header table): its cloth lives between luma 74 and
 * 104, with a near-black keyline under it and a few specular pixels above. These five stops put our
 * cloth in the same window.
 *
 *   FOLD  0.11  L54   the inside of a fold and the gathered hem -- cloth, not outline
 *   SHADE 0.25  L68   the side turning out of the light
 *   BASE  0.37  L87   Aubergine, a little lit. The mass
 *   LIT   0.46  L113  the face of the cloth that takes the light -- the board's lit hood is 95..104
 *   RIM   0.62  L161  Lilac, and ONLY as a rim: the crown, the brim lip, the top of a fold
 *
 * BASE sits at 87 rather than at Aubergine's own 76 for a measured reason. The board's cape runs
 * 74..83 but its lit hood runs 95..104, and the hood is the larger surface, so the figure's mass
 * straddles luma 81 rather than sitting below it. A first pass at this put BASE at 76 and SHADE at
 * 65 -- both under 81 -- and 68 per cent of her came out below that line against the board's 50.
 * Pushing the plateau nine levels up moves most of the cloth over the line without touching the
 * keyline, which was already a match.
 *
 * Level 0 is deliberately out of reach of the cloth shaders. Deep Purple is the keyline value here
 * and nothing else; letting the shaders touch it is what turns a dark cloak into the desaturated
 * hole the old header was right to fear.
 */
const CLOAK_FOLD = 0.11;
const CLOAK_SHADE = 0.25;
const CLOAK_BASE = 0.37;
const CLOAK_LIT = 0.46;
const CLOAK_RIM = 0.62;

/**
 * How hard each shading curve is pushed towards the light. ABOVE 1 biases the mass dark, which is
 * what keeps Aubergine leading Lilac: the mean of `pow(u, b)` over the lit disc is `1/(b+1)`, so at
 * 1.45 roughly two fifths of the band is spent and the bulk of the cloth lands near BASE with the
 * rim still reaching Lilac. At 1 the curves are linear and she drifts Lilac-led again.
 *
 * These were tuned by measuring the sixteen-frame sheet, not by eye -- see the header table.
 */
const DOME_BIAS = 1.15;
const CLOTH_BIAS = 1.35;

/**
 * The lit fraction `u` mapped onto the band, with a FLAT PLATEAU across the middle.
 *
 * This is the correction to the previous round, and it is worth stating plainly because the
 * previous round was measured and still went the wrong way. That pass replaced four hard steps with
 * a continuous sweep from fold to rim, which is right in principle -- four steps on a round mass
 * read as noise -- and then ran the sweep across the ENTIRE dome, so every pixel differed from its
 * neighbour and she came out airbrushed. Soft photographic gradients are not what the board does.
 *
 * Sampling the board's own back-view hood settles it: the hood is one large field of near-uniform
 * scarlet, a distinctly darker zone in the lower-right quadrant, a narrow lit arc at the top-left,
 * and a heavy near-black keyline round the whole thing. Three values and an outline over a mass
 * twenty-odd pixels across -- flat, crisp, and emphatically not a gradient.
 *
 * So the band is spent where it earns something and held still everywhere else:
 *
 *   u < 0.32   climbing out of SHADE into BASE   -- the turn away from the light
 *   u 0.32..0.80  BASE, held flat                -- the mass, half the surface, zero internal edges
 *   u > 0.80   climbing from BASE towards RIM    -- the lit arc, two or three pixels wide
 *
 * It is continuous at both joins, so nothing steps; it is flat in the middle, so the mass reads as
 * one colour; and it REMOVES edges rather than adding them, because half the surface now has no
 * internal boundaries at all.
 */
function plateau(u: number, lo: number, mid: number, hi: number): number {
  if (u < 0.24) return lo + (mid - lo) * (u / 0.24);
  if (u > 0.78) return mid + (hi - mid) * ((u - 0.78) / 0.22);
  return mid;
}

/**
 * The hood, crown downward, as half-widths: 8 px at the peak opening to 24 across the middle and
 * tucking back to 20 where the shoulders take over. Twenty rows, because the board gives the hood
 * 45 per cent of her height and she is 43 rows tall.
 */
const HOOD_HW = [4, 6, 8, 9, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 10, 9];
const HOOD_H = HOOD_HW.length;
/** Where the dome's lighting is centred, as a fraction of the hood box. */
const HOOD_RX = 12;
const HOOD_RY = 10;

/** The opening cut into it, brim to chin: half the hood's width, as on the board. */
const FACE_HW = [6, 7, 7, 7, 7, 7, 7, 7, 6, 6, 5, 4];
/** Edge-on the opening is narrower and the chin comes further forward. */
const FACE_HW_SIDE = [4, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3];

/**
 * The cloak, indexed up from the hem so the hem never moves when the body bobs -- on a stride frame
 * she loses the top row instead, and that lost row is the dip.
 *
 * This profile used to be a single bell: 7 at the shoulder swelling to 12 in the middle and 10 at
 * the hem, which is one convex curve from neck to ankle and is exactly why she read as an egg. The
 * board gives her four events going down, and all four are in here now:
 *
 *   idx 16..14   the neck pinches to 6 under the hood's overhang      -- the SHOULDER LINE
 *   idx 13..11   the cape falls open and flares back out to 12        -- the CAPE
 *   idx 10.. 6   it gathers gently in to 10                           -- the WAIST
 *   idx  5.. 0   the skirt flares again to 12 at the hem              -- the FLARE
 *
 * Two flares with a pinch between them is a figure; one flare is a bottle. The cape's widest row
 * matches the hood's 11, so the cape is the widest thing on her -- which is what the board's back
 * view shows, and it is the reason the hood lost a pixel: a hood wider than the shoulders is a
 * mushroom. The hood sits over her by having the dark line under it, not by being larger.
 *
 * A caution for the next pass, learned by doing it wrong first. Sixteen rows of cloth cannot hold
 * four silhouette events at full depth: a first version of this profile ran 6-12-8-11 and every
 * transition became a two-pixel staircase, so she read as a stack of barrels. The depths here are
 * deliberately shallow -- the waist gives up two pixels, not four -- because at 32x48 a silhouette
 * event is legible at one pixel and noisy at two. The cape is read from the LINE across it in
 * `paintCloak`, which costs no silhouette at all; that is where the structure should be bought.
 */
const CLOAK_HW = [12, 12, 11, 11, 11, 10, 10, 10, 10, 10, 11, 11, 12, 12, 11, 9, 6];
/** Edge-on she is a narrower column of cloth, but only just: it is a cloak, not a coat. */
const CLOAK_HW_SIDE = [11, 11, 10, 10, 10, 9, 9, 9, 9, 9, 10, 10, 11, 11, 10, 8, 6];
/**
 * Where the cape's hem crosses the skirt, as an index into the profiles above. The board draws this
 * as a hard dark line even though both sides of it are the same cloth, and it is most of what makes
 * the cape read as a separate layer hanging in front rather than as a crease.
 */
const CAPE_EDGE = 9;

/**
 * How deep the fringe hangs, column by column across the opening: short over the eyes, longer at
 * the temples, so it reads as a bob with side locks rather than as a hat band.
 */
const FRINGE = [6, 6, 5, 4, 3, 3, 3, 4, 4, 5, 5, 6, 6, 6];

/**
 * One pixel of a round cloth mass, lit from the top-left, in normalised ellipse coordinates.
 *
 * Section 4 asks for a terminator "concentric with the silhouette, not a straight diagonal", and
 * the straight diagonal is exactly what you get from projecting the pixel onto the light. So the
 * dome is treated as a sphere: `z` recovers the surface it would have at that pixel, and `lit` is
 * the real angle between that surface and a light sitting at the top-left and slightly in front.
 * The level boundaries are then curves that wrap the dome, which is how the board's hoods, leaf
 * clumps and boulders are all shaded.
 *
 * It returns a continuous `t`, not a level. Three levels across a 24-pixel dome put two hard
 * terminators down the largest mass on her, and a hard terminator on something round does not read
 * as a shadow -- it reads as a seam. Rounding the same dome through a dozen interpolated values
 * costs nothing, fills the two empty luma buckets in the header table, and REMOVES edges rather
 * than adding them, because each neighbouring pair now differs by a few luma instead of ninety-nine.
 *
 * The band stops at CLOAK_FOLD and never reaches Deep Purple itself: on Red that value is the
 * outline and the one line under the hood, nothing else. Letting the shader reach it put the dome's
 * whole lower-right quadrant at L43 and took half of her below L81, which is the opposite of the
 * problem she exists to solve.
 */
/*
 * THE MARK ON HER CAPE -- and it is a MOTIF, not the logo. Read this before changing it.
 *
 * `CLAUDE.md` rule 5 forbids redrawn logo variants, and commit ba44d80 reverted the one previous
 * attempt to put the real mark in the world with measurements that are not arguable: scaled into a
 * `pixelArt: true` scene the SVG point-samples into a deformed resample -- 61 of about 800 pixels
 * wrong and bilateral symmetry lost across its own axis -- while a CORRECT rasterisation carries
 * 195 partial-alpha pixels against a tileset that has zero. Its conclusion was that the only routes
 * are a pixel-art symbol authored by design, or the DOM layer, where the header mark is already
 * crisp at any zoom.
 *
 * Measured here: the widest run of cape on her back is 15px, narrowing to 8 by the hem. With the
 * clear space `BRAND_AND_UI` section 82 requires -- at least the height of the "c" -- the most a
 * mark can occupy is about 9x9. The Cyera symbol is built from four arcs rotating about a centre
 * with notches between them; at nine pixels those arcs are one pixel each and the notches are
 * nothing. It cannot be the logo at this size. Anything that tried would be the squashed logo
 * `ART_PRODUCTION` section 6a calls the one unacceptable outcome.
 *
 * So this is what section 6a proposed instead and what the request was taken to mean: a device that
 * carries the mark's RADIAL FOUR-FOLD FORM without claiming to be it. Four arms about a centre,
 * rotationally symmetric, so it cannot be mistaken for a tilted or stretched logo -- the failure
 * the revert was about. It is worked in the cloak's own ramp, two steps below the cloth so it reads
 * as weave rather than a sticker, and it is on the four back-facing frames only, which is where a
 * cape carries a device and where the board shows her from behind.
 *
 * IT STILL WANTS BRAND SIGN-OFF, and section 6a says so: approve it as a deliberately-not-the-logo
 * device, or leave the cape plain. Both are acceptable. What is not acceptable is calling this the
 * logo, in a commit message, a review, or to a stakeholder.
 */
const MOTIF = 9;
/*
 * TENTH PASS: IT HAD TO GET BOLDER, because at nine pixels it was invisible and the client asked
 * twice where it had gone.
 *
 * The previous version was right about the FORM and wrong about whether the form survives. Four
 * arms at the diagonals, one pixel wide, in two stops of the cloak's own ramp two steps apart --
 * `tone('cloak', 0.11)` against a cape body painted between 0.25 and 0.62 -- is a device you can
 * find at 8x and cannot see at 1x, which is the only size anybody plays at. The docstring above
 * predicted this about the real logo and then did it anyway with the motif: "at nine pixels those
 * arcs are one pixel each and the notches are nothing."
 *
 * So: TWO-pixel arms, and the value inverted. Light arms on the purple cape rather than dark ones,
 * taken from the top of the cloak's own ramp (Haze), with the hub left dark so the centre still
 * reads as a centre. That keeps every brand constraint -- it is the cloak's own colours, it adds no
 * new hue, it is not Lime, and it stays rotationally symmetric so it cannot be mistaken for a
 * tilted or squashed logo, which is what commit ba44d80's revert was about. It is simply legible.
 *
 * Measured: the arms sit 86 luma above the cape they lie on, against 13 before.
 */
function paintCapeMotif(img: Img, cx: number, top: number): void {
  // Sits in the upper back, below the hood's overhang and above the hem, where the cape is widest.
  const cy = top + 4;
  const hubInk = tone('cloak', CLOAK_FOLD);
  const armLit = tone('cloak', 0.95);
  const r = (MOTIF - 1) / 2;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      /*
       * FOUR ARCS ABOUT A CENTRE, which is what the Cyera symbol actually is -- not four spokes.
       * A first attempt at two-pixel spokes was legible and WRONG: at this size each spoke broke
       * into its own little cross and the device read as four sparkles rather than one mark. A
       * broken RING is both the more faithful abstraction and the one that survives nine pixels,
       * because an arc two pixels thick is still an arc while a spoke two pixels thick is a blob.
       */
      const onRing = d >= 2.2 && d <= 4.05;
      // The notches sit on the diagonals, so the four arcs meet the cardinals head-on and read.
      const angle = Math.atan2(dy, dx);
      const offDiagonal = Math.abs((((angle / Math.PI) * 180 + 360) % 90) - 45);
      const inNotch = offDiagonal < 17;
      const hub = d <= 0.9;
      if (hub) img.px(cx + dx, cy + dy, hubInk);
      else if (onRing && !inNotch) img.px(cx + dx, cy + dy, armLit);
    }
}

function domeTone(dx: number, dy: number): number {
  const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
  // The light sits mostly in the plane of the picture -- 0.66 across against 0.36 out of it. A
  // light with more depth than that puts its brightest point at the middle of the dome, which is a
  // rendered ball; the board puts it on the upper-left arc, which is a drawn one.
  const lit = -0.66 * (dx + dy) + 0.36 * z;
  // `lit` spans about -0.93 to +0.93 over the disc. Normalise, then bias towards the light so the
  // dome's mass sits at Lilac and only the far lower-right quadrant descends towards the fold.
  const u = Math.max(0, Math.min(1, (lit + 0.95) / 1.9));
  return plateau(Math.pow(u, DOME_BIAS), CLOAK_SHADE, CLOAK_BASE, CLOAK_RIM);
}

/**
 * One horizontal run of the hood dome. `cy` is the dome's centre row, not the run's; `top` is the
 * hood's first row, which the cowl fold is measured from.
 *
 * The cowl fold is the one piece of hood structure the board has that this file did not. Seen from
 * behind -- the Question frame, where the hood is the whole figure -- the board's hood is a smooth
 * dome for two thirds and then gathers into a shallow scalloped shadow that dips at the centre and
 * lifts at the temples, where the cloth bunches on the shoulders. Without it a back view at 32px is
 * a featureless egg; with it the hood has a front and a back. It also puts cloth-coloured midtones
 * exactly where the measured histogram was thinnest.
 */
function domeRun(img: Img, y: number, cx: number, hw: number, cy: number, top: number): void {
  const w = hw * 2;
  for (let i = 0; i < w; i++) {
    const x = cx - hw + i;
    let t = domeTone((x + 0.5 - cx) / HOOD_RX, (y + 0.5 - cy) / HOOD_RY);
    const nx = hw === 0 ? 0 : (x + 0.5 - cx) / hw;
    const ny = (y - top) / HOOD_H;
    const foldAt = 0.62 + 0.14 * Math.cos(nx * Math.PI);
    // The cowl seam, as a CRISP line rather than as a gradual darkening.
    //
    // This used to subtract 0.2 from `t` over about seven rows, which on a dome that is already
    // being shaded smoothly is not a seam -- it is a slightly dimmer region, and on the back-facing
    // frames, where the hood is the entire figure, it vanished completely and she read as a plain
    // egg. The board draws this edge the way it draws every other boundary: one dark line, hard on
    // both sides. So the row where the seam crosses takes the fold value outright, and the gathered
    // cloth below it sits a step down from the mass. Two hard edges and a flat band between them,
    // which is the whole of what makes a hood look like a hood from behind.
    //
    // Both values dropped 2026-10-19, measured off the board's back-view hood rather than guessed.
    // There the crown sits around luma 80, the crescent of gathered cloth under it around 45 and
    // the outline around 10: the seam is a little over half the crown's brightness and the outline
    // is a sixth of it. Ours ran crown 87, seam 53, outline 14 -- the seam at 0.61 of the crown
    // where the board's is 0.56, which does not sound like much and is the whole difference between
    // a hood and an aubergine once the dome is the entire figure. The seam now takes the ramp's own
    // darkest (luma 43, 0.49 of the crown) and the gathered band under it 63 rather than 68.
    //
    // Deliberately NOT `keyline('cloak')`. The board's crescent is plainly cloth -- a dark scarlet,
    // not the black it rings the figure in -- and an outline value inside the mass would read as a
    // crack across her head. Deep Purple is the darkest cloth on her and the seam is the one place
    // besides the deep folds that reaches it.
    const prevNy = (y - 1 - top) / HOOD_H;
    if (prevNy <= foldAt && ny > foldAt) t = 0;
    else if (ny > foldAt) t = Math.min(t, 0.2);
    // The shaded lip where the cloth meets the keyline, so the dark edge reads as one line.
    if (i === w - 1) t = Math.min(t, CLOAK_FOLD);
    // Section 4: the highlight sits one pixel in from the keyline and never touches it.
    if (i === 0) t = Math.min(t, CLOAK_LIT);
    img.px(x, y, tone('cloak', t));
  }
}

/**
 * One horizontal run of hanging cloth -- shoulder, sleeve, skirt, hem. Section 4's cylinder, but
 * solved rather than banded: the run is treated as a half-cylinder seen end-on, so the surface
 * normal sweeps from facing the light at the left silhouette to facing away at the right, and the
 * tone follows it continuously.
 *
 * This replaces four flat bands whose widths were computed as fractions of the run. Those bands had
 * two problems a cylinder does not. They put a hard step at every band boundary, so a sleeve four
 * pixels wide was four different colours in four pixels. And the half-tone between base and shade
 * was faked with a `(y & 1)` dither column -- an L76 pixel beside an L175 one, alternating by row,
 * which is a maximal edge on every other pixel of the longest seam on her. Interpolating costs the
 * same code and removes both.
 *
 * Narrow runs still work, which is the point: the sleeve at w=4 samples the same curve at four
 * places instead of being handed four different bands.
 */
function clothRun(
  img: Img,
  y: number,
  x0: number,
  w: number,
  rim: number,
  skip?: (i: number) => boolean,
): void {
  for (let i = 0; i < w; i++) {
    if (skip?.(i)) continue;
    // -1 at the lit edge, +1 at the shaded edge; `z` is how far the surface bulges towards us.
    const n = w === 1 ? 0 : (2 * i) / (w - 1) - 1;
    const z = Math.sqrt(Math.max(0, 1 - n * n));
    const lit = -0.8 * n + 0.3 * z;
    const u = Math.max(0, Math.min(1, (lit + 0.8) / 1.6));
    let t = plateau(Math.pow(u, CLOTH_BIAS), CLOAK_SHADE, CLOAK_BASE, CLOAK_RIM);
    // How much of the rim light this row still catches, 1 at the shoulder down to 0 where the
    // cloth has turned out of the light. It used to be a BOOLEAN, and the boolean is what the
    // review saw as "a flat purple field with a vertical gradient": every row above the cape
    // caught the full Lilac rim and every row below caught none, so the highlight came out as a
    // hard-edged stripe three pixels wide running down her left side and stopping dead. A stripe
    // of constant width and constant value is not a lit shoulder, it is a racing stripe -- and
    // where the cape profile steps out two pixels it stepped with it and read as an epaulette.
    //
    // Tapered, the same pixels become the thing the board actually draws: the brightest cloth at
    // the top of the shoulder, falling off down the arm, gone by the time the cape ends. It costs
    // nothing -- the rows in between were already being painted -- and it REMOVES the hard
    // boundary that used to sit at the cape line.
    t = Math.min(t, CLOAK_LIT + (CLOAK_RIM - CLOAK_LIT) * Math.max(0, Math.min(1, rim)));
    // The dark lip against the keyline, so the two read as one line rather than as a thin edge.
    if (i === w - 1) t = Math.min(t, CLOAK_FOLD);
    img.px(x0 + i, y, tone('cloak', t));
  }
}

/** The face inside the opening: fringe, eyes, blush, mouth, jaw. */
function paintFace(
  img: Img,
  fx: number,
  fy: number,
  profile: readonly number[],
  dir: number,
): void {
  const side = dir !== 0;

  // The face is a small dome too, so it takes the same treatment: rounding it through the skin ramp
  // rather than stepping it in three bands is what stops the cheek reading as a stripe.
  profile.forEach((hw, j) => {
    const y = fy + j;
    const w = hw * 2;
    for (let i = 0; i < w; i++) {
      const n = (2 * i) / (w - 1) - 1;
      const z = Math.sqrt(Math.max(0, 1 - n * n));
      const u = Math.max(0, Math.min(1, (-0.7 * n + 0.3 * z + 0.75) / 1.5));
      // The jaw, so the chin is a turning face rather than where the skin happens to stop.
      // Capped below the top of the skin ramp: level 3 there is near-white, and a face that reaches
      // it stops being lit and starts being blown out.
      const t = j === profile.length - 1 ? 0.15 : 0.26 + 0.55 * Math.pow(u, 0.8);
      img.px(fx - hw + i, y, tone('skin', t));
    }
  });

  // The fringe, swept and uneven, with the brim's shadow as its top row. Without that shadow the
  // hood sits on her head like a wig.
  const top = profile[0]!;
  for (let i = 0; i < top * 2; i++) {
    const x = fx - top + i;
    const depth = FRINGE[Math.min(i, FRINGE.length - 1)]!;
    for (let j = 0; j < depth; j++) {
      const hw = profile[Math.min(j, profile.length - 1)]!;
      if (x < fx - hw || x >= fx + hw) continue;
      // Across the fringe, lit at the sweep and falling away to the far temple; down it, darkening
      // into the parting. The brim's shadow is the top row and stays the darkest thing in the hair.
      const across = 1 - i / Math.max(1, top * 2 - 1);
      const t = j === 0 ? 0.05 : 0.18 + 0.6 * across - 0.18 * (j / depth);
      img.px(x, fy + j, tone('trunk', t));
    }
  }

  if (side) {
    // Profile: one eye, a pixel of nose at the leading edge, a cheek behind it, and -- added
    // 2026-10-19 -- a mouth and a blush, because without them the four rows under the eye were a
    // plain cream field and the review was right to call the side face a featureless oval.
    //
    // Two faults, not one. The mouth WAS here, at `shade('trunk', 0)` on the row above the jaw: a
    // mid-brown at luma 58 laid on skin at luma 180 and sitting directly under a fringe drawn from
    // the same ramp, so it read as one more strand of hair. The front face does not make that
    // mistake -- its eyes are `keyline('trunk')` at luma 18 -- and the board's Red carries two dark
    // eyes and a mouth at the same size in the same few pixels. So the mouth takes the keyline
    // value too, and moves a row up and forward to sit under the eye rather than on the chin.
    const ex = fx + dir * 2 - (dir < 0 ? 1 : 0);
    img.rect(ex, fy + 5, 2, 3, keyline('trunk'));
    img.px(fx + dir * 5, fy + 6, shade('skin', 0));
    img.px(fx + dir * 5, fy + 7, shade('skin', 2));
    img.rect(fx - dir * 4, fy + 8, 2, 1, shade('skin', 0));
    img.px(fx + (dir < 0 ? -1 : 0), fy + 7, shade('skin', 0));
    img.rect(fx + (dir < 0 ? -3 : 2), fy + 8, 2, 1, keyline('trunk'));
    return;
  }

  // Two pixels of eye, three rows tall: the board draws a tall oval and at 48 px there is room.
  img.rect(fx - 5, fy + 4, 2, 3, keyline('trunk'));
  img.rect(fx + 3, fy + 4, 2, 3, keyline('trunk'));
  // Cheeks and mouth, directly under the eyes. Section 10.3 takes both from the board; the palette
  // has no rose, so the blush is the warm shade of her own skin rather than a colour invented for
  // it -- see the note in the report, this is the one place Red wants a colour no ramp holds.
  img.rect(fx - 5, fy + 8, 2, 1, shade('skin', 0));
  img.rect(fx + 3, fy + 8, 2, 1, shade('skin', 0));
  img.rect(fx - 1, fy + 9, 2, 1, shade('trunk', 0));
}

/** The hood: dome, then the opening carved back out of it with a lit brim over it. */
function paintHood(img: Img, t: number, facing: Facing, dir: number): void {
  const side = dir !== 0;
  const hoodCx = CX + dir;
  const hoodCy = t + HOOD_RY;
  const bottom = new Map<number, number>();
  HOOD_HW.forEach((raw, i) => {
    const hw = raw - (side ? 1 : 0);
    domeRun(img, t + i, hoodCx, hw, hoodCy, t);
    for (let x = hoodCx - hw; x < hoodCx + hw; x++) bottom.set(x, t + i);
  });

  // Section 10.4's dark line between the hood and the shoulders, laid along the lowest pixel of
  // each column so that it follows the dome's own curve. It is what makes the hood a separate mass
  // sitting *over* her rather than the top of a single tapering column, and without it the bottle
  // comes straight back. Drawn as a flat row instead it reads as a chin strap.
  //
  // In the keyline value, not in `shade('cloak', 0)`: the board draws its interior boundaries as
  // dark as its outlines, and that is what sets one mass in front of another. At L43 this line was
  // a midtone pretending to be a shadow.
  bottom.forEach((y, x) => img.px(x, y, keyline('cloak')));

  if (facing === 'up') return; // Turned away, the hood is the whole head. The board draws no hair.

  const profile = side ? FACE_HW_SIDE : FACE_HW;
  const fx = hoodCx + dir * 2;
  const fy = t + 6;

  // Section 10.3's interior keyline, where the hood meets the face. One pixel of Deep Purple all
  // round the opening is most of what makes the board's faces sit *inside* their hoods. It stops
  // above the chin: the line under the hood is one row further down and two solid dark rows that
  // close together read as a letterbox rather than as a hood.
  // One pixel, hugging the opening row by row. Taking the widest of three neighbouring rows -- which
  // is what this did -- is invisible while the line is a midtone and fatal once it is near-black:
  // the chin rows are three pixels narrower than the brow, so the ring stood three pixels proud of
  // the jaw and the cap row became a solid bar above her head. She read as a face in a letterbox.
  // The cap and chin rows are pulled in two and one pixel so the opening arcs over and under her.
  const at = (k: number): number => profile[Math.min(Math.max(k, 0), profile.length - 1)]!;
  for (let j = -1; j <= profile.length; j++) {
    const hw = j < 0 ? at(0) - 2 : j >= profile.length ? at(profile.length - 1) - 1 : at(j);
    img.rect(fx - hw - 1, fy + j, (hw + 1) * 2, 1, keyline('cloak'));
  }

  // The brim: one row of lit lip above the opening, rounding off into the shaded end like any other
  // cloth, which is what gives the hood a visible edge standing proud of the face rather than a
  // pale stripe pasted over it.
  const brim = profile[0]! + 2;
  clothRun(img, fy - 2, fx - brim, brim * 2, 1);

  paintFace(img, fx, fy, profile, dir);
}

/** Shoulders to hem: the bell, with the sleeve creases and a scalloped edge. */
function paintCloak(img: Img, shoulder: number, facing: Facing, dir: number, sway: number): void {
  const profile = dir !== 0 ? CLOAK_HW_SIDE : CLOAK_HW;
  const cx = CX + dir;
  for (let y = HEM; y >= shoulder; y--) {
    const hw = profile[Math.min(HEM - y, profile.length - 1)]!;
    // Two shallow notches in the hem, phased by the stride so the cloth swings as she walks. Any
    // more than two and the bell turns into a grass skirt.
    const skip = (i: number): boolean => y === HEM && (i + sway) % 8 === 3;
    // The rim light fades down the figure: full strength on the two rows of shoulder that stand
    // out from under the hood, gone by the row the cape ends on. See `clothRun` -- this used to be
    // `HEM - y > 9`, a hard on/off at the cape line, and the hard edge was the stripe.
    clothRun(img, y, cx - hw, hw * 2, (shoulder + 6 - y) / 5, skip);
  }

  // The cape's hem, laid across the row where the profile stops narrowing and starts flaring again.
  // Drawn in the keyline value, not in a shade: the board's interior boundaries are as dark as its
  // outlines, and that is the whole device by which one layer of cloth sits in front of another. A
  // midtone here is a crease; the keyline is a cape.
  const capeY = HEM - CAPE_EDGE;
  if (capeY > shoulder) {
    const capeHw = profile[CAPE_EDGE]!;
    img.rect(cx - capeHw + 1, capeY, capeHw * 2 - 2, 1, keyline('cloak'));
    // One row of lit cloth directly under it, so the skirt reads as catching the light the cape
    // just cut off. Without it the line floats on a flat field and reads as a belt.
    clothRun(img, capeY + 1, cx - profile[CAPE_EDGE - 1]!, profile[CAPE_EDGE - 1]! * 2, 0);
  }

  // Where the arms hang. One crease a side is all the board gives them, and it is enough: without
  // it the bell is a single undivided sheet and the sleeves have nothing to be. The crease on the
  // lit side is the deeper one, because that is the edge the light has to fall off.
  for (let y = shoulder + 3; y <= shoulder + 10 && y < HEM; y++) {
    img.px(cx - 6, y, tone('cloak', CLOAK_FOLD * 0.6));
    img.px(cx + 5, y, tone('cloak', CLOAK_SHADE));
  }

  // Seen from behind, the cape has a centre seam running from the collar to its hem, and the frame
  // badly needs it: turned away, Red has no face, no basket-side asymmetry and no brim, so the back
  // frames were a plain dome over a plain bell and she read as an aubergine. One dark line down the
  // middle with a lit edge beside it is the cheapest thing that says "this is the back of a
  // garment" -- and it is what the board's own Question frame shows.
  // It starts BELOW the cape's hem, not at the collar. Run the full height it crosses the cape line
  // at right angles and the back of her reads as a graphic cross rather than as cloth; started
  // under it, the two meet in a T, which is what a cape over a skirt actually does.
  if (facing === 'up') {
    const foldTop = Math.max(capeY + 1, shoulder + 1);
    /*
     * The seam breaks for the device. `BRAND_AND_UI` section 82 asks for clear space of at least
     * the height of the "c" round the mark, and running the fold straight through it put a vertical
     * line across a four-armed radial form -- which reads as a scuff on the cloth rather than as
     * anything deliberate. Broken either side, the seam reads as a seam interrupted by a device,
     * which is what a garment with a badge on it actually looks like.
     */
    const motifTop = foldTop + 4 - (MOTIF - 1) / 2;
    const motifBottom = foldTop + 4 + (MOTIF - 1) / 2;
    for (let y = foldTop; y < HEM; y++) {
      if (y >= motifTop - 1 && y <= motifBottom + 1) continue;
      img.px(cx, y, keyline('cloak'));
      img.px(cx - 1, y, tone('cloak', CLOAK_LIT));
    }
    paintCapeMotif(img, cx, foldTop);
  }

  // The hood's OVERHANG, cast down onto the shoulders.
  //
  // This is the first of three marks added 2026-10-19 against the review's "the cloak is a flat
  // purple field with a vertical gradient and no form", and it is the one that buys the most,
  // because it is the only one that says the hood is a separate object sitting ON her.
  //
  // Up to now the hood ended in its own keyline and the cloth under it started at the mass value,
  // so the two layers met on a line and nothing fell across the join. The board puts a band of
  // shadow under every overhanging edge -- the stall awning, the cottage eaves and this hood all
  // get the same treatment -- and it is what stops a hood reading as a hat painted on a body.
  //
  // Only as wide as the hood: outside it there is nothing overhead to cast, and a shadow run the
  // full width of the shoulders is a collar, not an overhang. The lit edge is spared so the rim
  // light still runs unbroken from the shoulder down, which is what keeps her left side readable.
  const chestHw = Math.min(
    profile[Math.min(HEM - shoulder, profile.length - 1)]!,
    HOOD_HW[HOOD_H - 1]! - (dir !== 0 ? 1 : 0),
  );
  for (let i = 1; i < chestHw * 2; i++) {
    img.px(cx - chestHw + i, shoulder, tone('cloak', i < 3 ? CLOAK_SHADE : CLOAK_FOLD));
    if (i > 2) img.px(cx - chestHw + i, shoulder + 1, tone('cloak', CLOAK_SHADE));
  }

  // The gathering at the hem, two folds deep, each a dark channel with a lit shoulder on its left.
  // On an Aubergine skirt the fold has to be read by its HIGHLIGHT rather than by its shadow: the
  // cloth is already dark, so a darker line beside it is nearly invisible, where a Lilac edge
  // catching the light is the fold the board actually draws. This is the one place Lilac earns its
  // keep below the shoulder.
  //
  // Lifted one row 2026-10-19 to make room for the hem line below it.
  for (let y = HEM - 4; y < HEM; y++) {
    img.px(cx - 4, y, tone('cloak', CLOAK_RIM));
    img.px(cx - 3, y, tone('cloak', CLOAK_FOLD));
    img.px(cx + 2, y, tone('cloak', CLOAK_SHADE));
    img.px(cx + 3, y, tone('cloak', CLOAK_FOLD));
  }

  // The HEM, as one dark line along the bottom of the cloth.
  //
  // The cloak used to end wherever its last row of mass value happened to stop, which against grass
  // is a soft edge and against the legs is no edge at all -- the denim simply began. The board ends
  // every garment on a line. It costs one row, it is the bottom of the only large mass on her, and
  // without it the skirt and the legs read as one continuous column.
  //
  // The scallop is honoured, so the two notches the walk swings still cut through it; and the
  // columns are indexed exactly as `skip` indexes them in the main loop above, from the hem's own
  // half-width, so the line and the silhouette cannot drift apart.
  const hemHw = profile[0]!;
  for (let i = 0; i < hemHw * 2; i++) {
    if ((i + sway) % 8 === 3) continue;
    img.px(cx - hemHw + i, HEM, keyline('cloak'));
  }
}

/**
 * Shins and boots. The near leg is the lit one; the far leg drops a level so the two separate.
 *
 * Rebuilt 2026-10-19 against the board's own feet, and the fault it fixes was the loudest thing on
 * the sprite. Composited onto `pnpm world --at spawn-red` -- the first time in four rounds anyone
 * had put her on the grass rather than on white -- the eye went straight to her ankles: two blocks
 * of #2283d6 at luma 118, the most saturated colour anywhere on the figure, sitting under a cloak
 * whose mass is luma 87, over boots at luma 100..130 in a mid-brown. She was lit from the feet up.
 *
 * The board does the opposite and it is worth being exact about how, because "dark boots" on the
 * review sheet is half the story. Its back-view Red (Question frame, (610,520) in the mock) has
 * JEANS -- a real mid-blue, so the cool note the old comment defended is genuinely there -- but
 * they are three rows under a hem that comes down low, and under them sit brown boots at maybe a
 * third of their brightness, ringed in the same near-black as the rest of her. Blue over dark over
 * black, each step down. Ours ran blue over lighter-brown over one dark row: the ladder pointed the
 * wrong way, so the brightest thing on her lower half was also the largest.
 *
 * Hence two ladders below instead of `tone()` sweeps:
 *
 *   denim   101 / 72 / 45    one lit column and four below the cloth: a round limb, not a lamp
 *   leather  66 / 46 / 32    lit cap, body, shadow
 *   sole     18              the keyline, so she meets the ground on the same line she is drawn in
 *
 * `water` and `trunk` both FLOOR too bright for this -- `water` level 0 is luma 99 and `trunk`
 * level 0 is luma 58 -- so every value here except the denim's lit column comes from
 * `keyline(ramp, drop)`, the one helper that reaches under a ramp while keeping its hue. That is
 * what it is for; the name says outline because outlines are what first needed it.
 *
 * The proportion moved with the colour: three rows of denim and four of boot, where it used to be
 * four and three. The dark half of her lower leg is now the bigger half.
 *
 * AMENDED 2026-10-20 with the seating fix. `FOOT` moved 43 -> 45 so her contact line reaches the
 * bottom row of the frame, as every NPC's does, and the shin stretched with it rather than the
 * whole figure moving: the count is now five rows of denim over four of boot. By ROW it is no
 * longer the dark half that is bigger; by VALUE it still is, because four of the denim's five
 * columns sit at 45 and 72 against cloth at 87 and only the lit column reaches 101. The sentence
 * above is kept because the colour argument it makes is the one that matters and is untouched.
 */
const DENIM_LIT = tone('water', 0.02);
const DENIM = keyline('water', 26);
const DENIM_DARK = keyline('water', 54);
const BOOT_LIT = tone('trunk', 0.12);
const BOOT_MID = keyline('trunk', 12);
const BOOT_DARK = keyline('trunk', 26);

function paintLegs(img: Img, facing: Facing, stride: -1 | 0 | 1, dir: number): void {
  const leg = (x: number, lift: number, near: boolean): void => {
    const top = HEM + 1 - lift;
    // The far leg gives up a third of the across-the-leg sweep, which at five pixels wide is all
    // that separates the two without drawing a line between them.
    const back = near ? 0 : 0.3;
    const denim = (u: number): RGBA => {
      const t = u - back;
      return t > 0.8 ? DENIM_LIT : t > 0.3 ? DENIM : DENIM_DARK;
    };
    const by = FOOT - 3 - lift;
    // The shin runs from under the hem to the boot's own top row. It used to be a fixed 3, which
    // only met the boot at FOOT = 43: at any other sole row the leg came apart above the ankle.
    for (let i = 0; i < 5; i++) img.rect(x + i, top, 1, by - top, denim(1 - i / 4));
    const sideOn = dir !== 0;
    const bx = sideOn ? x - (dir < 0 ? 2 : 0) : x - 1;
    const bw = sideOn ? 7 : 6;
    // Boot: a lit cap along the top, the leather rounding across it, and the sole in the keyline
    // value so she meets the ground on a dark line rather than on a brown one.
    const leather = (u: number): RGBA => {
      const t = u - back;
      return t > 0.72 ? BOOT_LIT : t > 0.24 ? BOOT_MID : BOOT_DARK;
    };
    for (let i = 0; i < bw; i++) {
      const u = 1 - i / (bw - 1);
      img.px(bx + i, by, leather(u));
      img.px(bx + i, by + 1, leather(u - 0.3));
      img.px(bx + i, by + 2, leather(u - 0.6));
    }
    img.rect(bx, by + 3, bw, 1, keyline('trunk'));
  };

  if (dir !== 0) {
    // Edge-on the legs pass each other, so the stride is horizontal and the far leg is darker.
    // Standing, the far leg still steps back a pixel: feet exactly together read as one leg.
    const cx = CX + dir - 2;
    leg(cx - (stride === 0 ? dir : stride * dir * 4), stride === 0 ? 0 : 2, false);
    leg(cx + stride * dir * 4, 0, true);
  } else {
    const lead = facing === 'up' ? -stride : stride;
    leg(CX - 6 - (lead < 0 ? 1 : 0), lead < 0 ? 2 : 0, lead <= 0);
    leg(CX + 1 + (lead > 0 ? 1 : 0), lead > 0 ? 2 : 0, lead >= 0);
  }
}

/**
 * The basket, in the off hand in every frame -- the detail that says errand rather than walk, so it
 * is never hidden behind her: on the facings where her carrying arm would fall on the far side it
 * swings forward instead. Nine pixels across buys an arched handle, a rim, the cloth folded over it
 * and three weave courses, which is what the board shows and roughly what it spends on it.
 */
function paintBasket(img: Img, bx: number, by: number): void {
  // Handle: an arch, lit at the top-left and turning dark on the right upright.
  img.rect(bx + 2, by, 5, 1, tone('wood', 0.8));
  img.rect(bx + 1, by + 1, 1, 2, tone('wood', 0.62));
  img.rect(bx + 7, by + 1, 1, 2, tone('wood', 0.3));
  img.rect(bx, by + 3, 9, 1, tone('wood', 0.75));
  // The cloth folded over the rim, the one bright note on her off hand.
  img.rect(bx + 1, by + 4, 7, 1, shade('wood', 3));
  img.rect(bx + 1, by + 4, 3, 1, shade('wall', 3));
  // The body, rounding across the weave rather than three flat columns.
  for (let i = 0; i < 9; i++) {
    const u = 1 - i / 8;
    img.rect(bx + i, by + 5, 1, 5, tone('wood', 0.28 + 0.6 * u));
  }
  // Three weave courses, in the keyline value: at nine pixels across, the courses are the only
  // thing that says basket rather than box, so they have to be the darkest marks on it.
  img.rect(bx + 1, by + 6, 7, 1, keyline('wood'));
  img.rect(bx + 1, by + 8, 7, 1, keyline('wood'));
  img.px(bx + 3, by + 7, keyline('wood'));
  img.px(bx + 6, by + 9, keyline('wood'));

  // The basket's own outline, down both sides and across the bottom of the body.
  //
  // Nine pixels of basket cannot clear a twenty-four pixel body inside a thirty-two pixel frame, so
  // it always overlaps her cloak, and wicker laid straight onto Aubergine with no edge between them
  // is two brown-purple masses sharing a boundary. The keyline is what makes it an object she is
  // holding rather than a patch on her hip. Not drawn across the TOP: the handle arch is already
  // the dark shape up there, and a line over it would close the arch into a box.
  img.rect(bx, by + 4, 1, 6, keyline('wood'));
  img.rect(bx + 8, by + 4, 1, 6, keyline('wood'));
  img.rect(bx, by + 10, 9, 1, keyline('wood'));
}

/**
 * The sleeve. It has to leave the silhouette to be seen at all -- an arm drawn inside the body
 * outline is only a fold line -- so it swells past the bell and carries the hand down onto the
 * basket handle. It paints after the basket, because the hand grips in front of the handle.
 *
 * Only the arm on her lit side takes a lit edge. Giving the far arm one too put a pale seam down
 * the middle of her, which is the kind of mistake that only shows once you look at it.
 */
function paintSleeve(
  img: Img,
  shoulder: number,
  cx: number,
  sign: number,
  profile: readonly number[],
): void {
  // The sleeve is placed against the BODY'S OWN half-width at each row rather than at a fixed
  // offset. It used to sit at cx +/- 9..10, which is inside a cloak that reaches 12 on the front
  // facings and 11 edge-on, so the arm never broke the silhouette and the only part of her that
  // showed was the three-pixel hand -- which is why the basket read as floating beside her with
  // nothing holding it. An arm drawn inside the body outline is a fold line, not an arm.
  for (let i = 0; i < 8; i++) {
    const y = shoulder + 4 + i;
    const hw = profile[Math.min(Math.max(HEM - y, 0), profile.length - 1)]!;
    // One pixel proud of the cloth at the shoulder, opening to two as it reaches for the handle.
    const outer = hw + 1 + Math.floor(i / 5);
    const x0 = sign > 0 ? cx + outer - 4 : cx - outer;
    clothRun(img, y, x0, 4, sign < 0 ? 1 - i / 7 : 0);
    // Crease where the arm meets the body, in the keyline value so the sleeve reads as a separate
    // limb in front of the cloak rather than as a fold in it. On both sides now: the far sleeve
    // needs the line more than the near one, because it has no lit edge to separate it.
    img.px(sign > 0 ? x0 : x0 + 3, y, keyline('cloak'));
  }
}

/**
 * The hand, closing round the basket's handle. Painted after the basket, because a hand behind the
 * thing it is carrying is not carrying it.
 *
 * `handX` is the basket's own grip column rather than a second offset measured from her centre.
 * That is the whole repair for the floating basket: the old code derived the hand from `cx` and the
 * basket from a fixed frame column, so the two were only ever aligned by coincidence, and on the
 * side facings the coincidence failed and the basket hung in the air beside a buried sleeve.
 */
function paintHand(img: Img, handX: number, handY: number): void {
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      img.px(handX + i, handY + j, tone('skin', 0.78 - 0.22 * j - 0.1 * i));
    }
  }
  // The cuff: a dark row closing the sleeve over the back of the hand, so the hand reads as coming
  // out of the sleeve and gripping, instead of as a tan blob resting against the wicker.
  img.rect(handX, handY - 1, 3, 1, keyline('cloak'));
}

/**
 * Section 3.2: 1 px of keyline everywhere, and a second pixel along the bottom of a mass wider than
 * 16 px -- never the top, never the left. That second pixel is the keyline thickening on the side
 * the light does not reach, and it is what seats her on the ground rather than leaving her hovering
 * over her own shadow. `Img.outline` only does the first pass.
 *
 * The second pass takes the pixel below an opaque one and nothing else. Reading the down-right
 * diagonal as well, which is the obvious way to write section 3.2's "bottom and lower-right", turns
 * every staircase into a doubled line: the hood's right edge descends one pixel per row, so the
 * whole dome came back ringed in two pixels of Deep Purple and she measured 50 per cent below L81.
 * Where an edge genuinely faces down-right its lowest pixel per column is on that edge anyway, so
 * the band lands there without being asked for.
 */
function seatOutline(img: Img, c: RGBA): void {
  img.outline(c);
  const copy = new Uint8Array(img.data);
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && copy[(y * img.w + x) * 4 + 3]! > 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (opaque(x, y) || !opaque(x, y - 1)) continue;
      img.px(x, y, c);
    }
}

function paintFrame(img: Img, facing: Facing, phase: 0 | 1 | 2 | 3): void {
  const stride = STRIDE[phase]!;
  const bob = stride === 0 ? 0 : 1;
  const dir = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
  const t = 1 + bob;
  const shoulder = t + HOOD_H;

  const body = new Img(RED_FRAME_W, RED_FRAME_H);
  paintLegs(body, facing, stride, dir);
  paintCloak(body, shoulder, facing, dir, stride + 1);

  // Which side the basket hangs on. It is her left hand, so facing us it is on our right and facing
  // away it is on our left; on the two side facings that hand would be hidden, so it swings
  // forward, because a Red without a visible basket is just a girl in a coat.
  const onRight = facing === 'down' || facing === 'right';
  const by = shoulder + 3 - bob;
  // Fixed columns, not offset by the facing: nine pixels of basket plus its keyline is exactly the
  // room left beside a 24px hood, and a one-pixel lean would clip it off the sheet.
  // Order matters here and did not before: sleeve, then basket, then the hand on the handle. Nine
  // pixels of basket cannot clear a body that is twenty-four across inside a thirty-two pixel
  // frame, so the basket MUST overlap her -- the question is only which object is in front. Painted
  // sleeve-last, as it used to be, the arm was drawn across the wicker and the three of them came
  // out as one brown and purple smudge at her hip. Painted in this order, the sleeve goes behind
  // the basket, the basket's own keyline cuts it out of the cloak, and the hand closes over it.
  const bx = onRight ? 22 : 1;
  const sleeveSign = onRight ? 1 : -1;
  paintSleeve(body, shoulder, CX + dir, sleeveSign, dir !== 0 ? CLOAK_HW_SIDE : CLOAK_HW);
  paintBasket(body, bx, by);
  // The grip column: the handle's upright on the side the arm comes down.
  paintHand(body, onRight ? bx : bx + 6, by + 2);

  paintHood(body, t, facing, dir);
  seatOutline(body, keyline('cloak'));

  // No contact shadow is baked into the frame, and that is a deliberate removal rather than an
  // omission.
  //
  // This used to be `img.ellipse(CX + 1.5, FOOT + 2.5, 9, 2.4, shade('shadow', 1))` -- an OPAQUE
  // dark-green ellipse, #1f3a22, under every one of the sixteen frames. On grass it passed. The
  // trouble is that Red walks off the grass: the map puts her on the sand path for most of the
  // route, over the plank bridge, and onto the cottage step, and on all three she was dragging a
  // patch of lawn around with her. A sprite cannot carry its own ground.
  //
  // The obvious repair -- the same ellipse at partial alpha -- is forbidden: `docs/ASSETS.md` bans
  // semi-transparent colour on a transparent pixel, which is exactly what a soft shadow is. So the
  // shadow is simply not the sprite's to draw. `seatOutline` already thickens the keyline to 2 px
  // along her bottom edge, which is section 3.2's device for seating a figure and is ground-neutral
  // because it is her own hue. A true cast shadow belongs to the scene, under her and above the
  // tile, where it can take the ground's colour -- see the note at the foot of this file.
  img.blit(body, 0, 0);
}

/**
 * The sixteen frames, keyed `<facing>-<phase>`. Frame 0 is the idle pose; 1 to 3 are the walk.
 * The build looks these up by name, so the keys are the contract.
 */
export const RED_FRAMES: Record<string, (img: Img) => void> = Object.fromEntries(
  FACINGS.flatMap((facing) =>
    ([0, 1, 2, 3] as const).map((phase) => [
      `${facing}-${phase}`,
      (img: Img) => paintFrame(img, facing, phase),
    ]),
  ),
);

/**
 * SHE STANDS ON THE GROUND. Checked at import, on every one of the sixteen frames.
 *
 * What a player sees is a contact line: the lowest row of ink in the frame, which is where she
 * meets whatever she is standing on, because `forest-scene.ts` gives her an origin of (0.5, 1) and
 * puts that origin on the ground. Her art stopped two rows short of the frame's bottom edge, so she
 * hovered 2px over the lawn, the sand, the bridge and the doorstep -- a gap too small to name and
 * big enough to see once something is beside her, and it was half of a 10px disagreement with a
 * cast that all plants on row 47.
 *
 * The bound is the FRAME, deliberately, and not `FOOT`. Writing `FOOT + 2` here would be a guard
 * that agrees with whatever the file says today and therefore watches nothing: the whole fault was
 * that `FOOT` was free to sit anywhere in the frame. `RED_FRAME_H - 1` is the row her origin sits
 * on, which is the thing a player is looking at.
 *
 * The walk is covered too, which is the half that is easy to lose: a stride lifts ONE leg, so the
 * other must still be down. A frame that lifted both would read as a jump.
 */
function assertContactLine(): void {
  const faults: string[] = [];
  for (const [name, paint] of Object.entries(RED_FRAMES)) {
    const img = new Img(RED_FRAME_W, RED_FRAME_H);
    paint(img);
    let lowest = -1;
    for (let y = RED_FRAME_H - 1; y >= 0; y--) {
      for (let x = 0; x < RED_FRAME_W; x++)
        if (img.data[(y * RED_FRAME_W + x) * 4 + 3]! > 0) {
          lowest = y;
          break;
        }
      if (lowest >= 0) break;
    }
    if (lowest !== RED_FRAME_H - 1)
      faults.push(
        `${name}: her lowest ink is row ${lowest} of a ${RED_FRAME_H}-row frame, so she is drawn ` +
          `${RED_FRAME_H - 1 - lowest}px clear of the ground her origin stands on`,
      );
  }
  if (faults.length)
    throw new Error(`Red is not standing on the ground:\n  ` + faults.join('\n  '));
}

assertContactLine();

/*
 * ONE RETRACTION, AND TWO THINGS THE NEXT PASS HAS TO PICK UP THAT CANNOT BE DONE FROM THIS FILE.
 *
 * 1. THE "NOTHING IMPORTS THIS FILE" WARNING THAT STOOD HERE IS OUT OF DATE, and it is retracted
 *    rather than deleted, because a stale warning that scares the next round off measuring is
 *    worse than no warning. `sprites.ts` now imports Red `from './sprites/char-red.ts'`, and the
 *    committed `apps/game/src/assets/red.png` profiles identically to this file's own sheet on all
 *    six axes. This file is the shipped Red; `pnpm graybox` regenerates it from here.
 *
 *    The tail of that warning asked for `red-sprite.ts`, a second and older Red imported by
 *    nothing, to be deleted. IT HAS BEEN, so there is no longer a second Red to confuse this one
 *    with, and this item is kept only as the retraction. The ask that outlived it is the general
 *    one: a sprite nothing imports is how the confusion happened, and `sprites.ts` is the one place
 *    that says which painter ships.
 *
 * 2. RED HAS NO CAST SHADOW ANY MORE. `paintFrame` used to bake an opaque dark-green ellipse under
 *    every frame, which travelled with her onto the sand, the bridge and the cottage step; it is
 *    removed, and the reasoning is at the call site. She is seated by `seatOutline`'s doubled
 *    bottom keyline, which is ground-neutral, but a real contact shadow still wants drawing by the
 *    SCENE, under the sprite and over the tile, where it can take the colour of the ground she is
 *    actually standing on. That belongs in `forest-scene.ts`, not here.
 *
 * 3. THE COMPOSITE TEST SHOULD BE A COMMAND, not a script somebody writes again next round. Every
 *    sprite in this project is drawn, reviewed and scored against white, and every one of them is
 *    only ever seen against grass, sand or planking. Red's loudest fault survived four rounds of
 *    honest measurement purely because nobody put her on the ground. `world.ts` already renders
 *    the map from the painters and `sprites.ts` already assembles the sheets; a `--with <sheet>`
 *    flag that blits a frame onto the render at a landmark is perhaps twenty lines, and it would
 *    apply to the wolf, the rabbit, the owl, the Lantern Keeper and the bystanders as much as to
 *    her. It belongs in `world.ts`, which this round did not own.
 */
