/*
 * Purple, at 32 x 48: four facings by four frames, the sixteen she is on screen for the whole game.
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
 * the board's Explore frame was sampled directly -- `reference/mocks/gameplay-concepts.png`, Purple at
 * (780,620), the crop around her:
 *
 *     board, measured          luma        ours before this change
 *     cape, the mass          74 ..  83    175  (Lilac, #d28eff)
 *     hood, the lit side      95 .. 104    175 .. 213
 *     lawn she stands beside 166 .. 180    167 .. 179
 *     path she stands on     216           --
 *
 * The board's Purple is a DARK figure on a LIGHT ground, 70 to 140 luma below everything around her.
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
 * Measured against the board's own Purple (the Explore frame, crown to sole), in luma buckets of 32:
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
 *    sprite; `--at spawn-purple` is a camera landmark, not Purple. A controlled A/B of this file against
 *    the committed one, tiles held constant, moves `pnpm score` by exactly 0.000. Sprite work has
 *    to be rendered as a sheet and profiled: `node src/score.ts --profile <sheet.png>`.
 *
 * 2. `board-profile.json` is the WRONG TARGET for a sprite, and this is the more expensive mistake.
 *    It is built from board crops at roughly 2.7x our resolution. Downsample the board's own Purple to
 *    our scale with NEAREST sampling and profile her, and two of the six axes fall apart:
 *
 *        axis        board Purple @ our res    this file    verdict
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
 *    that does. Both of them measure Purple against white. She is never seen against white. Composite
 *    a frame onto a real render of the map -- `pnpm world --out /tmp/w.png --at spawn-purple`, then
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
 *    is now false too, and provably: `sprites.ts` line 14 imports `./sprites/char-purple.ts`, and the
 *    committed `apps/game/src/assets/purple.png` profiles at 48.81 / 35.23 / 56.52 / 27.66 / 52.03 /
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
 *    back-view Purple is wearing visible blue jeans) went with them. Reverted by eye, against the
 *    numbers. Recorded because the numbers will tempt the next round to do it again.
 *
 *    The colour count FELL, and that is the change working rather than a regression: what went was
 *    a `tone()` sweep across a ramp whose floor is already a bright mid-blue, and what replaced it
 *    is three values that sit where the board's do. Variety is not worth buying at the price of a
 *    figure lit from the feet up.
 *
 * TWO NUMBERS THAT GOT WORSE, stated rather than buried. Against the board's own Purple downsampled
 * to our resolution (the table above), `deep` moves 48.81 -> 58.04 against her 50.00 and `keyline`
 * 35.23 -> 42.75 against her 35.71: both were a near-match and both now overshoot by eight points.
 * The cause is known and is not the denim -- swapping the denim between the two ladders above
 * moves `deep` by 0.33 -- it is the boots, four dark rows across two feet on all sixteen frames.
 * The judgement is that a figure whose bottom fifth is dark is what the board shows and what seats
 * her on the ground, and that eight points on an aggregate taken from a resampled mock is the
 * cheaper thing to spend. If a later round wants those two axes back, the place to buy them is the
 * boots, and it should look at the composite before and after rather than at this paragraph.
 *
 * `pnpm score --world` at spawn-purple is 0.177 before and 0.177 after, to three decimals. That is
 * expected and is stated so the next round does not read it as a failure: see point 1 above, the
 * world render contains no sprites. PARTIAL 0 on all sixteen frames.
 */
import { Img, keyline, lumaOf, shade, tone } from '../paint.ts';
import type { RGBA } from '../paint.ts';

export const PURPLE_FRAME_W = 32;
export const PURPLE_FRAME_H = 48;

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
 * Where the dome's band starts climbing towards the rim -- `plateau`'s `upper`, for the sphere.
 *
 * Read the long note on `plateau` first: this exists because a fraction of the LIT RANGE is not a
 * fraction of the SURFACE, and on a sphere the two diverge badly. Tuned by measuring the arc rather
 * than by eye, on the back frame where the dome is the whole figure, by the review's own method:
 * walk in from the left keyline on each row of the hood and count pixels until the plateau value.
 * Rows 2 to 9 of `up-0`, pasted from the run:
 *
 *     upper    rows 2..9, px to the plateau    verdict
 *     0.78     9 11 11 11 11 11 10  9          what shipped; the spec says two or three
 *     0.88     6  8  8  8  7  7  6  5          still a gradient, just a shorter one
 *     0.93     4  6  6  7  6  5  4  2
 *     0.955    3  5  5  6  4  4  2  0          what this file now does
 *     0.97     3  5  5  5  4  3  0  0          the arc starts breaking up row by row
 *
 * Read that column with the LUMAS beside it, because the count includes the falloff. At 0.78 row 3
 * runs 114 161 161 159 152 143 133 123 112 99 87 -- three pixels of rim and then EIGHT of even
 * descent, which is an airbrush. At 0.955 the same row runs 114 161 161 150 113 -- three pixels of
 * rim and a two-pixel turn into the mass. That is `ART_DIRECTION`'s lit arc, and it is what the
 * docstring above this function has promised since it was written.
 *
 * The flat mass is untouched by this: `plateau` returns `mid` everywhere below `upper`, so raising
 * it GROWS the flat band and shrinks only the climb. That is the direction the previous round's
 * caution asks for -- "the mass is not the problem" -- and it is why the dome's colour count falls
 * without a single pixel of the plateau moving.
 */
const DOME_RIM = 0.955;

/**
 * THE DOME'S SHADED FACE, which 2026-10-21 is the round that found there wasn't one.
 *
 * `DOME_RIM` above fixed the LIT limb and nobody looked at the other one. Measured off the shipped
 * back frame, rows 9 and 10 of the hood -- the two widest rows, the middle of the largest mass on
 * her -- are:
 *
 *     14 | 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 87 | 54 | 14
 *
 * THREE DISTINCT COLOURS ACROSS TWENTY-FOUR PIXELS, one of which is the keyline and one of which is
 * the single-pixel fold lip. The dome has no shaded side at all: twenty-one of its twenty-four
 * columns are the same value. That, and not the absence of a seam, is why the back view reads as an
 * egg -- `domeRun`'s note has promised "a distinctly darker zone in the lower-right quadrant"
 * (sampled off the board) since it was written, and the pixels never had one.
 *
 * The cause is `plateau`'s LOWER join and it is trap 1 in the shape this file keeps meeting: 0.24 is
 * a fraction of the LIT RANGE, and on a sphere the shaded limb flattens towards the terminator
 * exactly as the lit limb flattens towards the pole. So 0.24 of range buys one pixel of the surface
 * -- measured, exactly one, on every row from 2 to 10 -- while the same figure on the cloth's
 * cylinder buys a quarter of the run. `DOME_RIM` is the identical argument, written out at length on
 * `plateau` below, applied to the other end and never carried across.
 *
 * RAISING THE JOIN IS NOT THE FIX, and it was tried first. Sweeping it 0.24 -> 0.66 and pasting the
 * run, row 9's shaded limb comes out as:
 *
 *     0.24   87 (nothing)
 *     0.34   86
 *     0.42   84 80
 *     0.50   85 82 79 76
 *     0.58   85 83 80 78 76 74
 *     0.66   85 83 81 79 77 75 74
 *
 * which is an eight-pixel even descent in two-luma steps: the airbrush, arriving on the limb that
 * had not been looked at yet, by the identical mechanism. Two-luma steps are invisible at 1x and the
 * whole effect is that the right edge is slightly dimmer.
 *
 * So the shaded face is a SECOND FLAT FIELD, which is what the board was sampled as having -- a
 * zone, not a falloff -- and it mirrors the lit arc exactly: three pixels of flat value, a two-pixel
 * turn, then the mass. `DOME_OCCIPUT` is where the flat dark field ends and `DOME_TURN` where it
 * has finished turning into the mass. Pasted from the run that chose them, rows 2..10, counting in
 * from the silhouette past the fold lip:
 *
 *     occiput/turn    flat px, rows 2..10      turn px, rows 2..10
 *     0.30 / 0.40     0 0 0 0 0 0 0 0 1        0 0 0 0 0 1 1 2 2
 *     0.36 / 0.46     0 0 0 0 0 0 1 1 2        0 0 0 0 0 2 1 2 2
 *     0.40 / 0.50     0 0 0 0 0 1 1 2 3        0 0 0 1 1 2 2 2 2
 *     0.44 / 0.54     0 0 0 0 0 2 2 3 4        0 0 0 2 2 2 2 2 2   <- this file
 *     0.48 / 0.58     0 0 0 1 1 3 3 4 5        0 0 1 1 2 2 2 2 2
 *
 * It grows DOWN the dome and is absent at the crown, which is what a sphere does and what keeps the
 * top of the hood open. The turn holds at two pixels on every row that has one, which is the lit
 * arc's own budget read back the other way.
 *
 * All three of the lower pairs were rendered on grass at 1x and 3x and looked at together. 0.40 is
 * a thin dark edge and reads as a one-pixel accident; 0.44 is a face; 0.48 is also a face and is
 * REJECTED, because its turn reaches row 4 and its flat band row 5 -- it has started closing the
 * crown, which is the one part of this dome the previous round's caution rules out touching. 0.44
 * is the strongest reading that leaves rows 2 to 6 of the crown pixel-identical to what shipped.
 *
 * The lit arc does not move: row 4 is `114 161 161 161 126 87 ...` before and after, to the pixel.
 * Nor does the flat mass, which the previous round's caution asks for -- what this adds is a face
 * the light does not reach, which `docs/PIXEL_STANDARD.md` section 3 requires of everything in the
 * world ("bottom and right faces fall to level 0") and which the largest object on the protagonist
 * was the one thing not doing.
 */
const DOME_OCCIPUT = 0.44;
const DOME_TURN = 0.54;

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
 *
 * ---
 *
 * `upper` IS THE WHOLE ARGUMENT, and 2026-10-20 is the round that measured it instead of asserting
 * it. The paragraph above promises "the lit arc, two or three pixels wide". On the shipped sheet
 * the back hood's arc measured NINE TO ELEVEN pixels wide on rows 2 to 10, running luma 161 down to
 * 87 in ten near-even steps -- a soft photographic falloff, which is the exact thing this function
 * was written to remove, surviving in the one limb nobody re-measured. That is most of why the back
 * view read as a latex balloon with a studio highlight on it.
 *
 * The cause is that 0.78 is a fraction of the LIT RANGE, not of the surface, and the two are not
 * proportional. On a cylinder `lit` is nearly linear across the run, so the top 22 per cent of the
 * range is the top 22 per cent of the pixels -- one pixel of a four-pixel sleeve, which is right.
 * On a sphere `lit` flattens towards the pole, so the same 22 per cent of range spends nearly half
 * the dome's radius. One constant could not serve both, and the dome is the surface that shows.
 *
 * So the join is a parameter: the cloth keeps 0.78, the dome takes `DOME_RIM`. The flat middle, the
 * lower limb and both continuity guarantees are untouched, which is what the previous round's own
 * caution asks for -- the mass is not the problem and must not be sanded again.
 *
 * ---
 *
 * 2026-10-21 SAID THE SAME THING ABOUT THE LOWER LIMB, and `DOME_OCCIPUT` above is the long version.
 * `lower` and `floor` are now parameters for the same reason `upper` is: a fraction of the lit range
 * is not a fraction of the surface, and the cloth's cylinder and the dome's sphere want different
 * numbers at BOTH ends. `floor` holds the band at `lo` below it, so the dark side can be a flat
 * field rather than a descent -- the cloth does not use it and the defaults are exactly the old
 * behaviour, since at `floor = 0` the first limb still returns `lo` at `u = 0`.
 */
function plateau(
  u: number,
  lo: number,
  mid: number,
  hi: number,
  upper = 0.78,
  lower = 0.24,
  floor = 0,
): number {
  if (u <= floor) return lo;
  if (u < lower) return lo + (mid - lo) * ((u - floor) / (lower - floor));
  if (u > upper) return mid + (hi - mid) * ((u - upper) / (1 - upper));
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
 * The band stops at CLOAK_FOLD and never reaches Deep Purple itself: on Purple that value is the
 * outline and the one line under the hood, nothing else. Letting the shader reach it put the dome's
 * whole lower-right quadrant at L43 and took half of her below L81, which is the opposite of the
 * problem she exists to solve.
 */
/*
 * THE MARK ON HER CAPE -- and it is a MOTIF, not the logo. Read this before changing it.
 *
 * SUPERSEDED 2026-10-22: at the client's explicit request the motif is retired and the mark is now a
 * pixel trace of the official symbol. The THIRTEENTH PASS below says how and why; what follows is
 * kept as the record of why it took nine pixels and a lifted cape line to do it honestly.
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
 * ELEVENTH PASS, 2026-10-20: THE FORM WAS RIGHT AND THE EXECUTION WAS NOT DRAWN, IT WAS SAMPLED.
 *
 * The form is settled and this pass does not reopen it. Three shapes were tried and rejected before
 * two arcs -- one-pixel spokes (invisible at 1x), two-pixel spokes (four sparkles), a four-notch
 * ring (a jumble) -- and all three rejections stand. What changed is HOW the two arcs are produced.
 *
 * Every version above computed the shape by evaluating `hypot` and `atan2` at integer offsets. That
 * is sampling an analytic figure on a nine-pixel grid, and at nine pixels a grid does not have the
 * angular resolution to carry the result. Measured off the shipped sheet, what it produced was:
 *
 *     22 pixels of #e5beff, bounding box x13..20 y28..35
 *     FOUR 4-connected components of 11 + 8 + 2 + 1 -- one of them a single orphan pixel
 *     180 degrees about its own centre maps 10 of 22 pixels onto another; 90 degrees, 11 of 22
 *     eight rows tall for a MOTIF = 9 design, because row 36 is the hem keyline and overwrote it
 *
 * So the docstring above claimed rotational symmetry -- the one property the revert in ba44d80 was
 * about, the thing that is supposed to stop this being mistaken for a squashed logo -- and the
 * pixels did not have it. A device that is four fragments, asymmetric, and clipped is not a device.
 * It is also, at 122 luma over the cloth, the highest-contrast edge anywhere on the figure, so it
 * was the first thing the eye landed on in the back view, ahead of her hood and her basket.
 *
 * Two changes, and neither touches the form:
 *
 * 1. IT IS DRAWN, NOT SAMPLED. `MOTIF_ROWS` below is the picture, literally. Nine by nine, so the
 *    bound it is checked against is its own size; two 4-connected arcs of eleven pixels each; exact
 *    180-degree symmetry by construction, since the grid is its own mirror. The top and bottom rows
 *    are EMPTY, which is what keeps the hem keyline off it -- the clip is designed out rather than
 *    moved one row and left to drift back.
 *
 * 2. THE CONTRAST COMES DOWN. The arcs were `tone('cloak', 0.95)`, which is a value nothing else on
 *    her uses. They are now `CLOAK_RIM` -- the same stop as the hood's lit arc, the brim lip and
 *    the hem gathers. It is still the brightest cloth on her, so it is findable; it is no longer
 *    brighter than the protagonist's own rim light, so it stops shouting.
 *
 * The notches are at the top and the bottom rather than on the diagonals, which is the one visual
 * consequence of drawing it by hand: on a nine-pixel grid the diagonal is the one direction a
 * two-pixel arc cannot keep a constant thickness, and the four fragments above are what that looks
 * like. Vertical notches put the two breaks on the axis the grid is exact about.
 *
 * IT STILL WANTS BRAND SIGN-OFF. See the docstring above: approve it as a deliberately-not-the-logo
 * device, or leave the cape plain. Both are acceptable, and that question is not mine to close.
 *
 * ---
 *
 * TWELFTH PASS, 2026-10-21: THE CLIENT SAYS IT "SITS LOW AND OFF-CENTRE AND READS AS A FLOATING
 * RING". Both halves of that are TRUE and MEASURED, and NEITHER is cheap to fix. Nothing was
 * changed here; what follows is the measurement, so the brand owner's decision has numbers under
 * it instead of two more rounds of eyeballing.
 *
 * OFF-CENTRE: IT IS, BY TWO PIXELS, AND THEY ARE RIGHT ABOUT WHICH WAY. The ink measures x13..x19
 * on `up-0`, so the device is centred on x16 -- which is `CX`, the GARMENT's own centre, and by
 * that measure it is dead straight. But the cloth a player can SEE in its own rows runs x11..x25
 * (rows 29..31) and x11..x26 (rows 32..34), because the basket and its keyline cover the skirt's
 * left five columns from x6 to x10. The midpoint of the visible cloth is therefore 18.0 to 18.5,
 * and the device sits 2 to 2.5 px LEFT of it -- a sixth of the width of the cloth it is drawn on,
 * towards her right, which is exactly what was reported.
 *
 * NOT CHEAP, and the reason is an ordering one rather than a drawing one. `paintCloak` runs BEFORE
 * `paintBasket` (`paintFrame` paints cloak, sleeve, basket, hand, hood, in that order and for
 * reasons its own note gives), so at the moment the device is placed nothing in scope knows where
 * the basket is going to be. Centring it on the visible cloth means threading the basket's column
 * into `paintCloak`, and the hem gathers move with it or collide -- they already sit at x9/x10 and
 * x21/x22 precisely to clear a device at x12..x20, with ONE pixel of slack on the left and NONE on
 * the right. That is three couplings across two functions plus the guard's scan window, to move a
 * mark two pixels, on an object that has no brand sign-off and might be removed.
 *
 * SITS LOW: IT CANNOT BE CENTRED VERTICALLY, and this is arithmetic rather than a judgement. The
 * band between the cape line (`capeY`, row 27) and the hem (`HEM`, row 36) is EIGHT rows, 28..35.
 * `MOTIF_ROWS` is nine rows with its top and bottom deliberately empty, so its ink is SEVEN rows.
 * Seven in eight leaves one row of slack, which has to be all above or all below: the device
 * either touches the cape keyline or it touches the hem keyline, and today it is the hem. Moving
 * the box up a row swaps which line it rests on and centres nothing. Closing it properly needs
 * either a smaller device -- which reopens a form this file records settling after three rejected
 * shapes, and is not a thing to do to an unapproved brand-adjacent mark -- or `CAPE_EDGE` to move,
 * which changes the silhouette's layering on all four facings.
 *
 * THE "FLOATING RING" IS THE FORM, NOT A FAULT, and that is worth saying plainly because it is the
 * one part a round might try to fix by drawing. Rows 31, 32 and 33 carry exactly two pixels each,
 * at x13 and x19 -- the arcs are one pixel thick down their flanks by construction. A one-pixel
 * ring on a flat field reads as a ring. Thickening it is redrawing the device, and the note above
 * records two-pixel spokes having already been rejected as "four sparkles".
 *
 * ONE THING THAT IS NOT THE PROBLEM, measured so it is not chased: the hem gather's own highlight
 * is `tone('cloak', CLOAK_RIM)`, the IDENTICAL value to the arms, and the worry that it reads as a
 * satellite beside the mark does not survive a count. Over `up-0` it survives on exactly ONE pixel,
 * (9,35) -- the basket covers x9 on rows 32 to 34 -- so it is a speck below the basket, four
 * columns clear of the device, not a cluster.
 *
 * SO THE RECOMMENDATION, and it is the same one section 6a and `PAUL_BRIEF` already carry: this is
 * the brand owner's call and it is now a cheap call to make. Approve the device as it stands and
 * accept two pixels of visual offset and one keyline contact, or remove it and the question with
 * it. Removing it is one line and would also hand the hem gathers their natural positions back.
 * What must NOT happen is a round spending the coupling above to move a mark nobody has approved.
 *
 * ---
 *
 * THIRTEENTH PASS, 2026-10-22: THE CLIENT ASKED FOR THE LOGO ITSELF, IN SO MANY WORDS -- "fix
 * Purple's back and get it perfect to really look like Cyera's logo". That is the brand owner's
 * side of the question the two passes above left open, answered the other way from the motif, so
 * the motif is retired and the mark on her back is now a PIXEL TRACE OF THE OFFICIAL SYMBOL,
 * `reference/brand/logos/cyera-symbol-black.svg`. Everything above is kept because it is why the
 * trace is drawn the way it is, and because two of its warnings still bind.
 *
 * IT STILL WANTS BRAND SIGN-OFF, and more than before, not less. `CLAUDE.md` rule 5 forbids redrawn
 * logo variants, and a nine-pixel rendering of the mark IS a redrawing, however faithful. The client
 * asked for it explicitly; the brand team has not seen it. Until they say yes, call it what it is in
 * every review and commit: a pixel rendering of the Cyera symbol awaiting brand approval.
 *
 * HOW IT WAS TRACED, so the next pass can check it rather than eyeball it. The SVG's two paths were
 * flattened and sampled 16 x 16 per pixel onto a 9 x 9 grid over the symbol's own 280 x 281 box --
 * coverage, not a point sample, which is what ba44d80 found deformed. Coverage per pixel:
 *
 *     r0   .00 .00 .75 .86 .12 .84 .68 .00 .00
 *     r1   .00 .05 1.0 .95 .20 .98 .84 .00 .00     the symbol, read at this size: a RING of
 *     r2   .73 1.0 .38 .09 .00 .11 .13 .88 .74     eight lobes, two a side, round a hollow
 *     r3   .86 .96 .09 .00 .00 .00 .09 .96 .86     centre; OPEN at the top right; and a
 *     r4   .33 .52 .00 .00 .00 .00 .00 .52 .32     detached DOT sitting in the opening.
 *     r5   .86 .96 .09 .00 .00 .00 .09 .96 .86     Those three facts are the logo, and
 *     r6   .74 1.0 .38 .09 .00 .09 .38 1.00 .73    nothing else about it survives nine
 *     r7   .00 .05 1.0 .96 .52 .96 1.0 .05 .00     pixels.
 *     r8   .00 .00 .75 .87 .34 .88 .74 .00 .00
 *
 * `MARK_ROWS` is that table THRESHOLDED AT 0.35, with no pixel edited by hand. The threshold is the
 * one tracing decision, and the table shows why it sits where it does: the inked pixels nearest it
 * are 0.38 and the blank ones 0.34, so there is a clean gap. At the usual 0.5 the three 0.38s drop
 * out -- the ring's inner corners at top left (r2,c2), bottom left (r6,c2) and bottom right (r6,c6)
 * -- and the ring's top-left joint becomes a DIAGONAL contact, the same as the dot's contact with the
 * right-hand lobe. The ring and its opening then become the same picture and the C is lost. The
 * fourth inner corner, (r2,c6) at 0.13, is where the SVG's ring genuinely does not close, and it
 * stays open. `test/art-guards.test.ts` re-derives the table from the SVG and requires the shipped
 * frame to be exactly this threshold of it, so the mark cannot drift from the artwork -- or be
 * "improved" by hand -- without a test naming the pixel.
 *
 * WHY NINE, not the eight the band had room for. At eight the symbol's two top lobes centre at
 * x 2.74 and 5.25 and each is 1.9 px wide: they meet, and the gap that separates the dot from the
 * ring falls on a pixel boundary and vanishes. Nine is the smallest grid on which the gap is a
 * column of its own (col 4, coverage 0.1 to 0.2). So the band was made nine rows instead of the mark
 * eight: ON THE BACK VIEW ONLY the cape line rises one row (`BACK_CAPE_LIFT`), which the twelfth pass
 * named as the other way to close "sits low" and declined because it would change all four facings.
 * Confined to `up`, it changes none of the others -- their frames regenerate byte-identical -- and
 * the line's one-row jump as she turns is inside the one-pixel bob she already makes.
 *
 * The cost, stated: the mark's lobes now touch the cape line above and the hem below. Both are
 * keyline, both are about a hundred and sixty luma under the mark, and only the lobes touch -- the ring's
 * flanks have cloth round them -- so nothing is overwritten and the guard checks that it is not.
 *
 * COLOUR: Lilac, `shade('cloak', 2)`, the exact brand token -- the official symbol ships in Lilac for
 * dark grounds (`reference/brand/logos/README.md`), and her skirt is the darkest cloth on her. Mono,
 * one value, no hub and no shading, because the logo has none.
 *
 * ORIENTATION: as printed. A badge on the outside of a cape reads the right way round from behind,
 * so the dot is at the viewer's top right, as in the SVG. CENTRING: on `CX`, her spine, under the
 * seam -- and the seam lands in the gap column. The two-pixel offset against the visible cloth that
 * the twelfth pass measured is unchanged and is the basket's, not the mark's.
 */
const MARK_ROWS = [
  '..XX.XX..',
  '..XX.XX..',
  'XXX....XX',
  'XX.....XX',
  '.X.....X.',
  'XX.....XX',
  'XXX...XXX',
  '..XXXXX..',
  '..XX.XX..',
] as const;

/** The mark's one colour: Lilac, the brand token, which the official symbol ships in on dark. */
const MARK_INK = shade('cloak', 2);

/**
 * What `test/art-guards.test.ts` needs to find the mark on the rendered frame and hold it to the
 * SVG: its colour and its grid. Not its pixels -- those are read off the frame, so the test checks
 * what ships rather than what this file says it drew.
 */
export const CAPE_MARK = { ink: MARK_INK, size: MOTIF } as const;

/** How far the back view's cape line sits above the other facings'. See the thirteenth pass. */
const BACK_CAPE_LIFT = 1;

/** The row the cape's hem line is drawn on, for a facing. The hem never moves; this is fixed too. */
const capeLineRow = (facing: Facing): number =>
  HEM - CAPE_EDGE - (facing === 'up' ? BACK_CAPE_LIFT : 0);

function paintCapeMark(img: Img, cx: number, top: number): void {
  // `top` is the first row under the cape line; the mark fills the band from there to the hem.
  const r = (MOTIF - 1) / 2;
  MARK_ROWS.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === 'X') img.px(cx - r + dx, top + dy, MARK_INK);
  });
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
  return plateau(
    Math.pow(u, DOME_BIAS),
    CLOAK_SHADE,
    CLOAK_BASE,
    CLOAK_RIM,
    DOME_RIM,
    DOME_TURN,
    DOME_OCCIPUT,
  );
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
/**
 * Where the cowl crosses, as a fraction of the hood's height, for a column `nx` across it (0 at the
 * centre, +/-1 at the flanks). It dips at the centre -- the nape, where the opening is -- and lifts
 * at the temples, where the cloth bunches onto the shoulders.
 *
 * Pulled out of `domeRun` 2026-10-20 so that `paintNape` can hang the back of her head off the SAME
 * curve the shading uses. Two copies of this expression would be two things free to drift, and the
 * nape sitting one row off the fold it is supposed to be under is precisely the kind of
 * near-miss this file has spent rounds on.
 */
function cowlAt(nx: number): number {
  return 0.62 + 0.14 * Math.cos(nx * Math.PI);
}

/** The first row at or below the cowl, for a column `nx` of a hood whose first row is `top`. */
function cowlRow(nx: number, top: number): number {
  return top + Math.floor(cowlAt(nx) * HOOD_H) + 1;
}

function domeRun(img: Img, y: number, cx: number, hw: number, cy: number, top: number): void {
  const w = hw * 2;
  for (let i = 0; i < w; i++) {
    const x = cx - hw + i;
    let t = domeTone((x + 0.5 - cx) / HOOD_RX, (y + 0.5 - cy) / HOOD_RY);
    const nx = hw === 0 ? 0 : (x + 0.5 - cx) / hw;
    const ny = (y - top) / HOOD_H;
    const foldAt = cowlAt(nx);
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
    /*
     * Profile: one eye, a pixel of nose at the leading edge, a cheek behind it, a mouth and a
     * blush. Three faults were measured off the shipped sheet 2026-10-20 and all three are below.
     *
     * 1. THE EYE AND THE MOUTH WERE ONE BLACK SLOT. The previous round moved the mouth onto the
     *    feature ink to make it visible -- right, and the front face does the same -- and then put
     *    it on `fy + 8` with the eye ending on `fy + 7`. Measured, the ink was a single contiguous
     *    2x4 block on all eight side frames: [[10,12],[11,12],[10,13],[11,13],[10,14],[11,14],
     *    [10,15],[11,15]] on the left and its mirror on the right. The front face gets this right
     *    by accident of layout -- two 2x3 eyes six pixels apart and a mouth two rows lower in a
     *    mid-brown -- so only the profile fused. One row of skin between them is the whole fix, and
     *    the mouth drops rather than the eye rising: the eye's rows are where the fringe ends, and
     *    lifting it would have the hair growing over her eye instead.
     *
     * 2. THE OUTLINE HAD A HOLE IN IT, and on the right frames the pixel leaking through was the
     *    brightest value on the sheet. `#ffe0c0` at luma 230 sat directly against cloth at luma 63
     *    with no keyline between, a 167-luma step at (24,14) on idle and walk1 and (24,15) on
     *    walk0 and walk2 -- while the rows immediately above and below DID carry the line. At a
     *    zoomed crop that reads as damage, which is exactly the word the client used.
     *
     *    The cause was an off-by-one that only bit one way round. `paintFace` lays skin at offsets
     *    -hw .. +hw-1 about `fx`, which is asymmetric by a pixel, and the nose was placed at a
     *    FIXED `fx + dir * 5`. Facing left that landed on the face's own last column, so there was
     *    no nose at all; facing right it landed one past it, on the opening's keyline ring, and
     *    punched through. Both are now derived from the profile -- `proud()` is one pixel outside
     *    the face's leading edge at that row, whichever way she is facing -- and the ring is re-laid
     *    one pixel further out over the rows the nose occupies, so the hood's opening runs unbroken
     *    AROUND it. She now has the same nose on both sides and an outline on both sides.
     *
     * 3. THE BLUSH WAS PAINTED OUTSIDE HER FACE on the left frames, for the same reason: a fixed
     *    `fx - dir * 4` is inside the profile facing right and two pixels past it facing left,
     *    where it landed on the ring and on the cloth beyond it. That was the second leak the probe
     *    found, at (18,15). It is now placed from the profile as well.
     */
    const at = (k: number): number => profile[Math.min(Math.max(k, 0), profile.length - 1)]!;
    /** One pixel outside the face's own leading edge at row `j` -- where a nose breaks the hood. */
    const proud = (j: number): number => (dir > 0 ? fx + at(j) : fx - at(j) - 1);
    /** The first column of the cheek at the BACK of the head, inside the profile either way. */
    const behind = (j: number): number => (dir > 0 ? fx - at(j) : fx + at(j) - 2);

    const ex = fx + dir * 2 - (dir < 0 ? 1 : 0);
    img.rect(ex, fy + 5, 2, 3, keyline('trunk'));
    // The nose, and the hood's opening re-laid around it so the line never breaks. One row above
    // and one below the nub as well, so the ring steps out and back rather than ending in mid-air.
    for (let j = 5; j <= 8; j++) img.px(proud(j) + dir, fy + j, keyline('cloak'));
    img.px(proud(6), fy + 6, shade('skin', 0));
    img.px(proud(7), fy + 7, shade('skin', 2));
    img.rect(behind(8), fy + 8, 2, 1, shade('skin', 0));
    img.px(fx + (dir < 0 ? -1 : 0), fy + 7, shade('skin', 0));
    img.rect(fx + (dir < 0 ? -3 : 2), fy + 9, 2, 1, keyline('trunk'));
    return;
  }

  // Two pixels of eye, three rows tall: the board draws a tall oval and at 48 px there is room.
  img.rect(fx - 5, fy + 4, 2, 3, keyline('trunk'));
  img.rect(fx + 3, fy + 4, 2, 3, keyline('trunk'));
  // Cheeks and mouth, directly under the eyes. Section 10.3 takes both from the board; the palette
  // has no rose, so the blush is the warm shade of her own skin rather than a colour invented for
  // it -- see the note in the report, this is the one place Purple wants a colour no ramp holds.
  img.rect(fx - 5, fy + 8, 2, 1, shade('skin', 0));
  img.rect(fx + 3, fy + 8, 2, 1, shade('skin', 0));
  img.rect(fx - 1, fy + 9, 2, 1, shade('trunk', 0));
}

/**
 * THE BACK OF HER HEAD. Four marks, on the `up` frames only, and this is the round's headline.
 *
 * What the client cropped and called messed up was this view, and the measurement agrees with them
 * without needing an opinion: rows 1..19 of the shipped back frame are 422 opaque pixels of cloth
 * carrying ZERO feature pixels -- no cowl opening, no hair, no nape, nothing that is not the
 * garment -- between a 100 per cent keyline row at 0 and another at 20. Three flat purples and the
 * keyline are 54.6 per cent of the whole frame. The front frame, over the same rows, carries a
 * face. So she reads from behind as an aubergine with legs, and no amount of shading fixes that,
 * because the fault is that there is nothing there to shade.
 *
 * The four marks, cheapest first:
 *
 * 1. THE COWL'S LIT LIP, one row above the fold. The fold itself has been a single dark chevron
 *    since it was added, and a dark line alone on a dark dome is a crease. One row of lit cloth
 *    above it makes it an EDGE the cloth turns over -- the same two-part device as the cape hem and
 *    the skirt gathers, which is to say nothing new is being invented here.
 *
 * 2. THE OPENING'S KEYLINE, one pixel round the hair, which is section 10.3's interior ring doing
 *    on the back exactly what it already does round the face on the other three facings. It is
 *    what makes the hair something seen THROUGH the hood rather than painted onto it, and without
 *    it her hair met her garment over sixteen adjacencies with no outline between.
 *
 * 3. HER HAIR AT THE NAPE, under the cowl's lowest point. This is the one that makes her a person,
 *    and it is the one departure worth arguing for rather than slipping in. The board's own back
 *    view has no hair: `domeRun`'s note quotes it as "a smooth dome for two thirds and then gathers
 *    into a shallow scalloped shadow", and an earlier line in this file said outright "the board
 *    draws no hair". That line was written about a mock at roughly 2.7x our resolution, where a
 *    plain dome still carries a dozen values of modelling. At 32x48 it carries four, and the result
 *    is measured above. Her hair already exists on the other three facings, in `trunk`, so this
 *    adds no hue and no ramp -- it puts the colour she already has where the head already is. The
 *    cowl dips at the nape precisely because that is where the opening is, so the hair lands in the
 *    gather rather than on the crown.
 *
 * 4. THE RIM STEPS DOWN UNDER IT, which is `paintHood`'s business and is why this returns the
 *    columns it covered.
 *
 * Deliberately NOT done: a collar, a second notch, or anything on the crown. The dome's flat mass
 * is listed under what works and the previous round's caution about sanding it stands. A CENTRE
 * SEAM down the back of the hood was drawn, rendered at 14x and taken out again: thirteen rows of
 * channel-plus-highlight running into the chevron's apex read as a zip, and with the hair in place
 * it was a second vertical competing with the one mark that matters. Recorded so the next round
 * does not reach for it as the obvious missing thing.
 */
/*
 * SECOND ROUND ON THE NAPE, 2026-10-21. EVERYTHING ABOVE IS DRAWN AND IT STILL DOES NOT READ.
 *
 * The client cropped this view twice. The four marks above are all present -- the bob, the parting,
 * the ring, the rim's step -- and the note calling them deliberate is accurate. So this round
 * measured what they actually produce rather than checking whether they exist, and the gap is not
 * where the previous round left its caution.
 *
 * WHAT THE SHIPPED NAPE MEASURES, off `up-0`:
 *
 *     32 px of warm, rows 17..20, widths 6 / 8 / 10 / 8 -- a lozenge TEN pixels across
 *     the head at those rows is 24 px wide, so the opening is 42 PER CENT OF THE HEAD
 *     luma 58..110, mean 81; the cloth it sits in is 87 and the cowl's gather band is 63
 *     the parting is 11 luma on one column; down the bob it darkens 8 luma over four rows
 *
 * Three conclusions, and the first kills one of the obvious fixes:
 *
 * 1. IT IS NOT WINNING ON VALUE. Mean 81 against cloth at 87 is six luma. Shifting the hair's value
 *    closer to the cloak -- the reading that first suggests itself, since it is the thing the eye
 *    lands on -- is already true and is therefore not the lever. It wins on HUE (it is the only
 *    warm mass on a purple figure, and nothing about this drawing changes that) and on AREA.
 *
 * 2. SO AREA IS THE LEVER, and 42 per cent of the head is a panel rather than a glimpse. A cowl
 *    seen from behind shows a little hair where it gathers, not a window.
 *
 * 3. THE INTERNAL MODELLING IS BELOW THE SIZE IT IS DRAWN AT. Eight to eleven luma over a four-row
 *    mass is invisible at 1x and barely there at 3x, so the modelling that is genuinely drawn
 *    contributes nothing to the read and the lozenge comes out flat. Either it earns a step that
 *    reads or it should not be spent.
 *
 * AND THE RING ABOVE IT WAS THE BAR, which is the part nobody had looked at. The note on mark 2
 * says the cap row "is pulled in a pixel so the opening arcs over her instead of ending in a bar".
 * Measured, row 16 of the shipped frame is:
 *
 *     14 63 63 63 63 63 63 63 63 | 14 14 14 14 14 14 | 63 63 63 63 63 63 63 54 14
 *
 * SIX PIXELS OF FLAT KEYLINE, straight, directly above a six-pixel row of hair. It is narrower than
 * the row below it, which is what the note is describing, and it is still a bar -- "narrower than"
 * and "arcs" are not the same claim. A dark bar over a warm lozenge is a letterbox, which is
 * precisely the fault the FACE ring was fixed for on the other three facings, surviving on the one
 * facing where the ring was laid by hand as three `rect` calls instead of being hugged to the shape.
 *
 * THREE CHANGES, and all three are the same change: let the drawing produce the opening.
 *
 *   a. The hair is NARROWER -- 4 / 6 / 8 / 6, a third less area -- so it is a glimpse through the
 *      gather. It keeps four rows, because the fourth is what reaches the hood's last row and makes
 *      the rim step down, and that step is the only thing breaking row 20's eighteen-pixel keyline
 *      bar. Shortening it to three rows was tried and silently reopens that defect.
 *   b. The ring is DERIVED, not laid. Every opaque pixel four-adjacent to a hair pixel takes the
 *      keyline. The opening then hugs the bob exactly -- 4 px of cap, then 6, then 8, then 6 --
 *      so it arcs because the hair arcs, and the two cannot drift apart. The hand-laid version
 *      could be, and was, a bar above a shape that was not one.
 *   c. The hair has a BOTTOM EDGE rather than stopping. Its last row drops under the `trunk` ramp
 *      through `keyline('trunk', drop)` -- luma 44 at the shaded end to 54 at the lit one, against
 *      the hair's own 69..110 above it. That helper is already how this figure's boots reach below
 *      a ramp whose floor is too bright (`trunk` level 0 is luma 58), and `paintLegs`' note argues
 *      for it on this exact ramp; it is not a new value, a new hue or a new ramp step. The lit end
 *      is one step up from the shaded one for the reason the hem line already gives: an edge the
 *      light reaches is not the same value as an edge in shadow.
 *
 * TWO OF THE THREE WERE PICKED BY RENDERING, so the numbers above are a choice and not the first
 * thing that worked. All of these went onto grass at 1x, 3x and 10x together:
 *
 *   - underside at 32..50 (`drop` 26 - 18 * across). A bottom edge, and it half-dissolves into the
 *     keyline below it -- 18 luma from the outline at the shaded end -- so at 3x the bob reads as
 *     three rows over a thick outline rather than four rows with an underside. Rejected: it is a
 *     fatter keyline, which is not what "a bottom edge" means.
 *   - underside at 44..54 (`drop` 14 - 10 * across). Thirty luma clear of the outline AND thirty
 *     clear of the hair above it, so the underside is its own layer at both joins. KEPT.
 *   - `NAPE_HW = [3, 4, 4, 3]`, 6 / 8 / 8 / 6, with the same underside and the same ring -- the
 *     halfway house between the shipped lozenge and the glimpse. Rejected by eye at 10x: 28 px of
 *     warm against the glimpse's 24 starts reading as the panel again. It is a JUDGEMENT between
 *     two acceptable drawings and not a defect, and `assertBackView` passes it on purpose -- run
 *     through the guard to check, which is where an earlier draft of that note had it backwards.
 *     If a later round wants more hair than this, that profile is the step to take.
 *
 * ONE CROSS-REFERENCE KEPT, because the comment carrying it was rewritten and a dropped pointer is
 * how a record rots. It read: "the correction `paintHood` already records having had to make to the
 * face ring for the same reason" -- that ring originally took the widest of three neighbouring
 * rows, so it stood three pixels proud of the jaw and she read as a face in a letterbox, until its
 * cap and chin rows were pulled in. That lesson is live and still worth following. What this round
 * corrects is only the claim that the NAPE's ring had already learned it.
 *
 * NOT DONE, and recorded as a decision. Strands breaking the silhouette: at this size the only
 * place a strand can break the outline is below the hood's rim, onto the shoulder cloth, and one
 * or two warm pixels adrift on the garment read as damage rather than as hair -- the same
 * population the opening-leak guard exists to catch. The silhouette is broken instead by the
 * opening's own arc, which costs nothing and cannot be mistaken for a defect.
 *
 * ALSO NOT DONE, and this is the one the brief offered that the measurement refuses: the parting
 * is left at its nine luma. On a bob four, six and eight pixels wide it falls on one column of a
 * four-pixel row, and nine luma at 32x48 does not read -- but it is drawn, it is cheap, and taking
 * it out is a separate argument from the one this round is making. It is recorded here as a mark
 * that does not contribute rather than as one that does, so the next round does not count it.
 */
/**
 * The hair at the nape, as half-widths down from the cowl: narrow where it leaves the opening,
 * widening to the jaw. The last row reaches the hood's own last row, which is what lets the rim
 * step down under it.
 */
const NAPE_HW = [2, 3, 4, 3];

function paintNape(img: Img, cx: number, top: number): Set<number> {
  // The cowl's own curve, so the hair cannot drift off the fold it is supposed to sit in.
  const centreRow = cowlRow(0, top);

  // 1. The cowl's lit lip, one row above the fold and only across the middle, where the cloth
  //    actually rolls over the opening. Run the full span it doubles the chevron into a light line
  //    over a dark one and the hood reads as an envelope; kept to the centre it reads as the edge
  //    the hood turns on. Rendered both ways at 14x before choosing.
  for (let x = cx - NAPE_HW[1]! - 1; x <= cx + NAPE_HW[1]!; x++) {
    const lip = cowlRow((x + 0.5 - cx) / HOOD_HW[HOOD_H - 1]!, top) - 1;
    if (img.get(x, lip)[3] !== 0) img.px(x, lip, tone('cloak', CLOAK_LIT));
  }

  // 2. The opening's own keyline, one pixel hugging the hair row by row, exactly as section 10.3's
  //    interior ring does round the face on the other three facings. Without it the hair is
  //    painted ONTO the hood rather than seen THROUGH it, and -- measured -- her hair met the
  //    garment over sixteen adjacencies with no outline between, which is the same class of fault
  //    as the nose leak on the side profiles.
  //
  //    REWRITING THIS AS A DERIVED OUTLINE WAS TRIED AND REVERTED, 2026-10-21, and the measurement
  //    is the reason. This round's note above opens by observing that the shipped cap was a flat
  //    six-pixel run of keyline over a six-pixel row of hair, and the obvious reading -- that the
  //    three hand-laid rects ARE the bar, and that hugging the hair with a real outline pass would
  //    make the opening arc -- is WRONG. The derived version was written, rendered and diffed
  //    against these four lines over all sixteen frames: ZERO PIXELS DIFFER. The cap rect is
  //    already exactly the hair's own top row, and each side rect is already one pixel proud of its
  //    own row, so for any profile that widens and then tapers the two algorithms are the same
  //    drawing. What fixed the bar was NARROWING the bob. The ring was never the fault, and the
  //    paragraph above would have shipped claiming a win that measures zero.
  //
  //    The twelve-line version is genuinely the more robust of the two -- a profile whose widest
  //    row is not its last, say [2, 4, 3, 2], leaves this cap a pixel short and opens a leak, which
  //    an outline pass cannot do -- and it is still reverted, because that exact failure is what
  //    `assertPurpleReads`' first check already looks for, by population rather than by construction,
  //    and four lines that read plainly beat twelve that guard something already guarded.
  img.rect(cx - NAPE_HW[0]!, centreRow - 1, NAPE_HW[0]! * 2, 1, keyline('cloak'));
  NAPE_HW.forEach((hw, j) => {
    img.rect(cx - hw - 1, centreRow + j, (hw + 1) * 2, 1, keyline('cloak'));
  });

  // 3. The hair, as a bob seen from behind: narrowest where it leaves the cowl, widening to the
  //    jaw, then cut. The ring above is its brim shadow, so there is no second dark row inside it
  //    -- two of those together is the letterbox the face ring was fixed for.
  //
  //    The profile is a bob and not a rectangle for a reason that cost a render: an even block of
  //    `trunk` eight pixels wide across the bottom of the hood reads as a plank nailed to the back
  //    of her head. Hair has to taper somewhere to be hair.
  //
  //    THE LAST ROW IS THE BOTTOM EDGE, and it is the second of this round's three changes. The bob
  //    used to darken by eight luma over its four rows and then simply stop against the rim, which
  //    at 1x is a lozenge with no underside. It now drops below the ramp's own floor through
  //    `keyline('trunk', drop)` -- the helper `paintLegs` already reaches for on this ramp, and for
  //    the same reason, `trunk` level 0 being luma 58 where this wants the forties. The lit end sits
  //    one step up from the shaded end, for the reason the hem line already gives: an edge the light
  //    reaches is not the same value as an edge in shadow.
  const covered = new Set<number>();
  const last = NAPE_HW.length - 1;
  NAPE_HW.forEach((hw, j) => {
    const y = centreRow + j;
    for (let i = 0; i < hw * 2; i++) {
      const x = cx - hw + i;
      // Across the nape, lit at the sweep and falling to the far side; down it, into the parting.
      const across = 1 - i / (hw * 2 - 1);
      const parting = Math.abs(x - cx) < 1 ? 0.12 : 0;
      img.px(
        x,
        y,
        j === last
          ? keyline('trunk', 14 - Math.round(10 * across))
          : tone('trunk', 0.24 + 0.46 * across - 0.08 * j - parting),
      );
      if (y >= top + HOOD_H - 1) covered.add(x);
    }
  });
  return covered;
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
  //
  // `nape` is the set of columns where the hair hangs below the hood's rim, so the rim steps down a
  // row there and becomes the shadow under her hair instead of cutting across it. That step is also
  // what breaks row 20: it was 18 px of unbroken keyline on every facing, the upper of the two bars
  // that cut the figure into a dome, a box and a pair of legs.
  const nape = facing === 'up' ? paintNape(img, hoodCx, t) : null;
  bottom.forEach((y, x) => img.px(x, nape?.has(x) === true ? y + 1 : y, keyline('cloak')));

  if (facing === 'up') return; // Turned away, the hood is the whole head.

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

/**
 * Shoulders to hem: the bell, with the sleeve creases and a scalloped edge.
 *
 * `stride` is the phase, -1 / 0 / +1. It drives two things: the hem notches, which it always did,
 * and -- new 2026-10-20 -- the HEM SWAY. The review measured the walk cycle as moving rows 36..47
 * and nothing above: no arm swing, no cloak sway, the basket pixel-identical in all four frames of
 * a facing, and 63 to 69 per cent of the pixels that did move sitting at keyline darkness. A walk
 * whose only animation is inside a near-black block is not read as a walk.
 *
 * So the bottom rows of the skirt lean one pixel OPPOSITE the leading foot, which is what cloth
 * does: the hem trails the step. One pixel, on the last three rows, carrying the hem line and the
 * gathers with it so the garment moves as one piece rather than shearing. It is derived here and
 * passed down rather than recomputed anywhere, because a hem line that leaned and a silhouette
 * that did not would come apart exactly the way the scallop and the hem line were warned about.
 */
function paintCloak(img: Img, shoulder: number, facing: Facing, dir: number, stride: number): void {
  const profile = dir !== 0 ? CLOAK_HW_SIDE : CLOAK_HW;
  const cx = CX + dir;
  const sway = stride + 1;
  /** One pixel of lean on the skirt's last rows, opposite the leading foot. */
  const lean = (y: number): number => (y >= HEM - 2 ? -stride : 0);
  for (let y = HEM; y >= shoulder; y--) {
    const hw = profile[Math.min(HEM - y, profile.length - 1)]!;
    // Two shallow notches in the hem, phased by the stride so the cloth swings as she walks. Any
    // more than two and the bell turns into a grass skirt.
    const skip = (i: number): boolean => y === HEM && (i + sway) % 8 === 3;
    // The rim light fades down the figure: full strength on the two rows of shoulder that stand
    // out from under the hood, gone by the row the cape ends on. See `clothRun` -- this used to be
    // `HEM - y > 9`, a hard on/off at the cape line, and the hard edge was the stripe.
    clothRun(img, y, cx - hw + lean(y), hw * 2, (shoulder + 6 - y) / 5, skip);
  }

  // The cape's hem, laid across the row where the profile stops narrowing and starts flaring again.
  // Drawn in the keyline value, not in a shade: the board's interior boundaries are as dark as its
  // outlines, and that is the whole device by which one layer of cloth sits in front of another. A
  // midtone here is a crease; the keyline is a cape.
  // One row higher on the back view, to give the logo the nine rows it needs; see `BACK_CAPE_LIFT`.
  // The widths are read off the profile at the row actually drawn, so on the other three facings
  // this is exactly the `CAPE_EDGE` / `CAPE_EDGE - 1` it always was.
  const capeY = capeLineRow(facing);
  if (capeY > shoulder) {
    const capeHw = profile[HEM - capeY]!;
    const underHw = profile[HEM - capeY - 1]!;
    img.rect(cx - capeHw + 1, capeY, capeHw * 2 - 2, 1, keyline('cloak'));
    // One row of lit cloth directly under it, so the skirt reads as catching the light the cape
    // just cut off. Without it the line floats on a flat field and reads as a belt.
    clothRun(img, capeY + 1, cx - underHw, underHw * 2, 0);
  }

  // Where the arms hang. One crease a side is all the board gives them, and it is enough: without
  // it the bell is a single undivided sheet and the sleeves have nothing to be. The crease on the
  // lit side is the deeper one, because that is the edge the light has to fall off.
  for (let y = shoulder + 3; y <= shoulder + 10 && y < HEM; y++) {
    img.px(cx - 6, y, tone('cloak', CLOAK_FOLD * 0.6));
    img.px(cx + 5, y, tone('cloak', CLOAK_SHADE));
  }

  /*
   * Seen from behind, the cape has a centre seam and carries the device, and this block is where
   * the two were fighting over the same eight rows without anybody noticing.
   *
   * THE SEAM WAS NOT BEING DRAWN AT ALL. It ran `foldTop` (which evaluates to `capeY + 1`, 28) to
   * `HEM` (36) and skipped `motifTop - 1 .. motifBottom + 1`, which with the device centred at
   * `foldTop + 4` and a radius of 4 evaluates to 27..37 -- every row in the loop. So the clearance
   * rule swallowed the whole seam, and the comment that argued for it has described a line nothing
   * painted since the device was centred. That is also why the back frame measured as a plain dome
   * over a plain bell: one of the two marks meant to prevent it was absent.
   *
   * They cannot both have the skirt, so they are separated by height rather than by a skip. The
   * SKIRT, below the cape line, is the device's -- it is the flattest, widest cloth on her and it
   * is where a cape carries a badge. The CAPE, above the line, takes the seam, which now stops ON
   * the cape's hem instead of starting under it: the two still meet in a T, just the other way up,
   * and a T is what the original comment was after.
   */
  if (facing === 'up') {
    for (let y = shoulder + 2; y < capeY; y++) {
      img.px(cx, y, keyline('cloak'));
      img.px(cx - 1, y, tone('cloak', CLOAK_LIT));
    }
    paintCapeMark(img, cx, capeY + 1);
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
  //
  // On the BACK they step outboard, because that is where the device is and the two were overlapping
  // -- the gathers are painted after it, so they were drawing over the device's lower corners, which
  // is most of how a nine-pixel ring came out as four disconnected fragments. Stepping them out
  // leaves the clear space `BRAND_AND_UI` section 82 asks for round the mark, and a skirt that
  // gathers a little wider apart at the back is what a skirt does anyway. The offset is derived from
  // the device's own half-width so the two cannot drift back into each other.
  const gatherOut = facing === 'up' ? (MOTIF - 1) / 2 - 1 : 0;
  for (let y = HEM - 4; y < HEM; y++) {
    const k = lean(y);
    img.px(cx - 4 - gatherOut + k, y, tone('cloak', CLOAK_RIM));
    img.px(cx - 3 - gatherOut + k, y, tone('cloak', CLOAK_FOLD));
    img.px(cx + 2 + gatherOut + k, y, tone('cloak', CLOAK_SHADE));
    img.px(cx + 3 + gatherOut + k, y, tone('cloak', CLOAK_FOLD));
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
  //
  // Its LIT END is one step up from the keyline, 2026-10-20. Measured, row 36 was 100 per cent of
  // its opaque pixels below luma 35 on every facing, as was row 20, and the review's reading of
  // that is right: two full-width dark rules plus the boot slab cut the silhouette into a dome, a
  // box and a pair of legs. An edge the light reaches is not the same value as an edge in shadow,
  // and `clothRun` already ends every row this way -- the hem is the one line that was uniform.
  // The line survives: three pixels of `CLOAK_FOLD` at luma 54 against eighteen of keyline at 14
  // is still emphatically a line, and the board's own hems catch light at one end.
  //
  // NOT TAKEN, and recorded so it is a decision rather than an omission: dropping the hem a row
  // between her feet so the skirt hangs lowest at the centre. That is the fuller answer to the
  // bar, it is what cloth does, and it changes the SILHOUETTE on every walk frame -- which is a
  // bigger thing than this round should spend on a minor finding, with the stride moving the gap
  // between her legs underneath it.
  const hemHw = profile[0]!;
  const hemLean = lean(HEM);
  for (let i = 0; i < hemHw * 2; i++) {
    if ((i + sway) % 8 === 3) continue;
    img.px(cx - hemHw + i + hemLean, HEM, i < 3 ? tone('cloak', CLOAK_FOLD) : keyline('cloak'));
  }
}

/**
 * Shins and boots. The near leg is the lit one; the far leg drops a level so the two separate.
 *
 * Rebuilt 2026-10-19 against the board's own feet, and the fault it fixes was the loudest thing on
 * the sprite. Composited onto `pnpm world --at spawn-purple` -- the first time in four rounds anyone
 * had put her on the grass rather than on white -- the eye went straight to her ankles: two blocks
 * of #2283d6 at luma 118, the most saturated colour anywhere on the figure, sitting under a cloak
 * whose mass is luma 87, over boots at luma 100..130 in a mid-brown. She was lit from the feet up.
 *
 * The board does the opposite and it is worth being exact about how, because "dark boots" on the
 * review sheet is half the story. Its back-view Purple (Question frame, (610,520) in the mock) has
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
 *
 * ---
 *
 * 2026-10-21: "THE BASKET READS AS A YELLOW SMEAR ON HER LEFT." Measured, the complaint lands on one
 * line of this function, and the fix is a PALETTE decision rather than a painter's, so this round
 * states it and leaves it rather than reaching for the nearest ramp step.
 *
 * THE CLOTH FOLDED OVER THE RIM IS THE BRIGHTEST THING ON HER. `shade('wall', 3)` is luma 250, and
 * on the back frame it is three pixels at (3,28)..(5,28) against a figure whose next brightest value
 * is her cloak's Lilac rim at 161. Eighty-nine luma of clear air above everything else on the
 * protagonist, on her shopping. On the FRONT frames it does not read that way and the histogram says
 * why: her face carries sixteen pixels at 235 and a spread from 216 to 250, so there the cream sits
 * inside a population. Turn her round and the face goes, and those three pixels are alone at the top.
 * That is the whole of the "smear", and it is also why this round's nape work makes it louder rather
 * than quieter -- taking the warm panel off the back of her head promotes whatever was second.
 *
 * AND IT CANNOT BE FIXED FROM INSIDE THE `wall` RAMP, which is the finding. The four stops are
 * 175 / 222 / 237 / 250 and `tone` only reads between them, so the ramp's own FLOOR is 175 -- still
 * fourteen luma above her brightest cloth. Every value this rect could take is the brightest thing
 * on the back view. The two candidates were measured and both are worse than the fault:
 *
 *   shade('wall', 2) = 237. Thirteen luma off the peak, which is nothing; the cream is still top of
 *     the hierarchy and the change buys a different number rather than a different reading.
 *   shade('wall', 0) = 175. Low enough, and it collapses the cloth into the wicker: the basket's
 *     own lit top is `tone('wood', 0.8)` at 166, so nine luma apart, and the fold stops being a
 *     fold on all sixteen frames to fix three pixels on four of them.
 *
 * So the honest answer is that the cloth over the rim wants a ramp this palette does not have -- a
 * cream that can sit at about her rim light rather than above it -- and that is `paint.ts`'s
 * business and a brand reviewer's, not this file's. `docs/PIXEL_STANDARD.md` section 2 already
 * carries three families (`rust`, `rose`, `ember`) that live in a painter and want moving into
 * `PALETTE`; this is a fourth of the same kind. The next round that opens `paint.ts` should take it.
 *
 * Until then: left alone deliberately, measured, and NOT quietly stepped down. The front and both
 * side profiles are signed off as shippable and this rect paints on all sixteen frames.
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

  const body = new Img(PURPLE_FRAME_W, PURPLE_FRAME_H);
  paintLegs(body, facing, stride, dir);
  paintCloak(body, shoulder, facing, dir, stride);

  /*
   * Which side the basket hangs on -- HER LEFT HAND, in all four facings, which is a change.
   *
   * It used to be `down || right`, i.e. her left hand facing us and facing away, and then the
   * LEADING side on both profiles, which means it swapped arms between the two of them. Measured
   * off the shipped sheet, the cost of that swap is a figure that slides sideways when the player
   * turns on the spot: whole-figure ink centre 13.0 facing left against 18.0 facing right, five
   * native pixels, ten CSS pixels at the zoom the desktop camera plays at. She is seated with
   * origin (0.5, 1) so the FRAME is centred perfectly; it is the ink inside it that jumps, and
   * most of the jump is the basket crossing her body.
   *
   * Keeping it on one arm costs nothing anatomically. Facing away it is on our left and facing us
   * on our right, which is unchanged and correct. Facing right her left hand is the FAR one, so
   * the basket trails behind her hip -- partly occluded, which is the honest read for a far hand
   * and is the same drawing the `up` and `left` frames already use. Facing left it is the near
   * hand and hangs in front, as now.
   *
   * It also swings. The review found the walk moves only rows 36..47 -- legs and nothing else, in
   * the darkest band on the figure, so the only moving part of the protagonist was a handful of
   * pixels inside a near-black block. A carried basket swings with the stride; one pixel is
   * plenty at this size, and it puts ninety-odd pixels of motion at hip height. The rest position
   * steps one column in from the frame edge so the swing has somewhere to go: nine pixels of
   * basket plus its keyline is exactly the room beside a 24px hood, so an OUTWARD lean from flush
   * would clip off the sheet. Flush is now the far end of the swing rather than the rest pose.
   */
  const onRight = facing === 'down';
  const by = shoulder + 3 - bob;
  // Order matters here and did not before: sleeve, then basket, then the hand on the handle. Nine
  // pixels of basket cannot clear a body that is twenty-four across inside a thirty-two pixel
  // frame, so the basket MUST overlap her -- the question is only which object is in front. Painted
  // sleeve-last, as it used to be, the arm was drawn across the wicker and the three of them came
  // out as one brown and purple smudge at her hip. Painted in this order, the sleeve goes behind
  // the basket, the basket's own keyline cuts it out of the cloak, and the hand closes over it.
  const bx = onRight ? 21 + stride : 2 - stride;
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
  // trouble is that Purple walks off the grass: the map puts her on the sand path for most of the
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
export const PURPLE_FRAMES: Record<string, (img: Img) => void> = Object.fromEntries(
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
 * that `FOOT` was free to sit anywhere in the frame. `PURPLE_FRAME_H - 1` is the row her origin sits
 * on, which is the thing a player is looking at.
 *
 * The walk is covered too, which is the half that is easy to lose: a stride lifts ONE leg, so the
 * other must still be down. A frame that lifted both would read as a jump.
 */
function assertContactLine(): void {
  const faults: string[] = [];
  for (const [name, paint] of Object.entries(PURPLE_FRAMES)) {
    const img = new Img(PURPLE_FRAME_W, PURPLE_FRAME_H);
    paint(img);
    let lowest = -1;
    for (let y = PURPLE_FRAME_H - 1; y >= 0; y--) {
      for (let x = 0; x < PURPLE_FRAME_W; x++)
        if (img.data[(y * PURPLE_FRAME_W + x) * 4 + 3]! > 0) {
          lowest = y;
          break;
        }
      if (lowest >= 0) break;
    }
    if (lowest !== PURPLE_FRAME_H - 1)
      faults.push(
        `${name}: her lowest ink is row ${lowest} of a ${PURPLE_FRAME_H}-row frame, so she is drawn ` +
          `${PURPLE_FRAME_H - 1 - lowest}px clear of the ground her origin stands on`,
      );
  }
  if (faults.length)
    throw new Error(`Purple is not standing on the ground:\n  ` + faults.join('\n  '));
}

/** A frame, painted, for the guards below. */
function frameOf(name: string): Img {
  const img = new Img(PURPLE_FRAME_W, PURPLE_FRAME_H);
  PURPLE_FRAMES[name]!(img);
  return img;
}
const isOpaque = (img: Img, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < PURPLE_FRAME_W && y < PURPLE_FRAME_H && img.get(x, y)[3] > 0;
/** Her face and her hair: the warm ramps, `skin` and `trunk`, which are the only ones with R > B. */
const isWarm = (c: RGBA): boolean => c[3] > 0 && c[0] > c[2];
/** Her garment: the cloak's purples, which are the only ones with B > R, above outline darkness. */
const isCloth = (c: RGBA): boolean => c[3] > 0 && c[2] > c[0] && lumaOf(c) >= 30;
/** The count of 4-connected components in a set of points. */
function componentsOf(pts: readonly (readonly [number, number])[]): number {
  const key = new Set(pts.map(([x, y]) => `${x},${y}`));
  const seen = new Set<string>();
  let n = 0;
  for (const [sx, sy] of pts) {
    if (seen.has(`${sx},${sy}`)) continue;
    n++;
    const queue: [number, number][] = [[sx, sy]];
    seen.add(`${sx},${sy}`);
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${x + dx},${y + dy}`;
        if (key.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push([x + dx, y + dy]);
        }
      }
    }
  }
  return n;
}

/**
 * FOUR THINGS THE 2026-10-20 REVIEW FOUND AND THIS FILE NOW CANNOT LOSE AGAIN.
 *
 * Every one of them was live on the shipped sheet, every one is the kind of fault that survives a
 * typecheck, a lint and a profile, and three of the four survived four rounds of honest measurement
 * because nothing was looking for them. `assertContactLine` above is the model: a module-level
 * throw, armed in CI by `test/art-guards.test.ts` importing the painter.
 *
 * The bounds are deliberately NOT restatements of the constants that produce them. `NAPE_HW` could
 * be rewritten tomorrow and this still asks the question that matters -- is there anything on the
 * back of her head that is not her coat -- rather than agreeing with whatever the file says today.
 * Twelve pixels is a legibility floor at 32x48, not a measurement of the current drawing, which
 * carries considerably more.
 *
 * 1. THE HOOD'S OPENING HAS NO HOLE IN IT. No warm pixel -- skin or hair -- may LEAK through to
 *    the cloak: that is, sit directly against cloth with no keyline between AND differ from it by
 *    enough luma to read as a break in the outline. The shipped sheet had eight: `#ffe0c0` at luma
 *    230 against cloth at 63 on all four right-facing frames, a 167-luma step with no outline, and
 *    four at 92 on the left. It is checked over the hood's own rows, which is where the rule is
 *    "the face sits INSIDE the hood"; below that the basket and the boots meet the cloak on their
 *    own keylines and have their own argument.
 *
 *    THE BOUND IS A LEAK, NOT AN ADJACENCY, and the difference is load-bearing. A first version
 *    forbade the adjacency outright and fired on something that is not a fault: the fringe's own
 *    brim-shadow row meets the hood's cloth at the opening's two upper corners, because the ring's
 *    cap row is deliberately pulled in two pixels so the opening arcs over her rather than ending
 *    in a bar above her head. That join is dark on dark -- 61 against 87 -- and nothing leaks
 *    through it. Measured over all sixteen frames, every remaining warm-against-cloth adjacency on
 *    this sheet is exactly that one join at 26 luma, and the two real defects were 92 and 167. The
 *    floor sits at 60, with 34 luma of daylight below it and 32 above, so it is a gap in the
 *    population rather than a number fitted to today's drawing.
 *
 * 2. HER EYE AND HER MOUTH ARE TWO MARKS, NOT ONE. On the side frames both are drawn in the
 *    feature ink, and the previous round left them vertically adjacent -- one contiguous 2x4 block
 *    on all eight side frames, which reads as a slot. The guard counts connected components of
 *    that ink in the head and wants more than one. The front face already passes, and is included
 *    so that a future layout change cannot fuse it either. The BACK is exempt, and exempt by name
 *    rather than by the count happening to be zero: she has no face on those four frames, and a
 *    guard that accepted zero marks everywhere would have accepted the fused slot too.
 *
 * 3. THE BACK OF HER HEAD IS NOT BLANK. The whole of the client's crop. Rows above the shoulder on
 *    the `up` frames must carry some ink that is not the garment and not its outline.
 *
 * 4. THE WALK IS NOT LEGS-ONLY. Opposite stride frames must differ somewhere above the hem. The
 *    shipped sheet differed in rows 36..47 and nowhere else, on every facing, with two thirds of
 *    the moving pixels at keyline darkness -- so the only animated part of the protagonist was a
 *    handful of pixels inside a near-black block.
 */
function assertPurpleReads(): void {
  const faults: string[] = [];
  const hoodRows = HOOD_H + 1; // the hood and the line under it; the shoulder starts below.
  /** How far apart a warm pixel and a cloth pixel must be before a missing keyline is a leak. */
  const LEAK = 60;

  for (const name of Object.keys(PURPLE_FRAMES)) {
    const img = frameOf(name);

    // 1. No warm pixel leaking into the cloth with no keyline between them.
    const holes: string[] = [];
    for (let y = 0; y < hoodRows; y++)
      for (let x = 0; x < PURPLE_FRAME_W; x++) {
        if (!isOpaque(img, x, y)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ] as const) {
          if (!isOpaque(img, x + dx, y + dy)) continue;
          const a = img.get(x, y);
          const b = img.get(x + dx, y + dy);
          const pair = (isWarm(a) && isCloth(b)) || (isCloth(a) && isWarm(b));
          const step = Math.abs(lumaOf(a) - lumaOf(b));
          if (pair && step >= LEAK)
            holes.push(`(${x},${y})-(${x + dx},${y + dy}) ${Math.round(step)} luma`);
        }
      }
    if (holes.length)
      faults.push(
        `${name}: the hood's opening has ${holes.length} hole(s) in its keyline, where her face ` +
          `leaks into her cloak with no outline between: ${holes.join(' ')}`,
      );

    // 2. The feature ink in the head is at least two marks -- on the facings that have a face.
    const ink = keyline('trunk');
    const feature: [number, number][] = [];
    for (let y = 0; y < hoodRows; y++)
      for (let x = 0; x < PURPLE_FRAME_W; x++) {
        const c = img.get(x, y);
        if (c[3] > 0 && c[0] === ink[0] && c[1] === ink[1] && c[2] === ink[2]) feature.push([x, y]);
      }
    const marks = componentsOf(feature);
    if (!name.startsWith('up-') && marks < 2)
      faults.push(
        `${name}: her face carries ${marks} mark(s) of feature ink in ${feature.length} pixels -- ` +
          `an eye and a mouth that touch are one slot, not two features`,
      );

    // 3. The back of her head carries something that is not her coat.
    if (name.startsWith('up-')) {
      let warm = 0;
      for (let y = 0; y < hoodRows; y++)
        for (let x = 0; x < PURPLE_FRAME_W; x++) if (isWarm(img.get(x, y))) warm++;
      if (warm < 12)
        faults.push(
          `${name}: the back of her head is ${warm} px of anything but garment -- she reads as a ` +
            `dome of cloth rather than as a person seen from behind`,
        );
    }
  }

  // 4. Opposite strides differ above the hem.
  for (const facing of FACINGS) {
    const a = frameOf(`${facing}-1`);
    const b = frameOf(`${facing}-3`);
    let moved = 0;
    for (let y = 0; y < HEM; y++)
      for (let x = 0; x < PURPLE_FRAME_W; x++)
        if (a.get(x, y).join() !== b.get(x, y).join()) moved++;
    if (moved < 20)
      faults.push(
        `${facing}: the two stride frames differ by ${moved} px above the hem -- the walk is her ` +
          `legs and nothing else, inside the darkest band on the figure`,
      );
  }

  if (faults.length) throw new Error(`Purple does not read:\n  ` + faults.join('\n  '));
}

/**
 * THE DEVICE ON HER CAPE IS A DEVICE. Checked on the rendered frame, not on `MOTIF_ROWS`, which is
 * the whole point: the grid was never the problem. What broke it was the hem gathers being painted
 * over its lower corners afterwards, and a grid-only check would have passed a sheet carrying four
 * disconnected fragments. Measured on what shipped: 4 components, 180-degree symmetry on 10 of its
 * 22 pixels, and eight rows of a nine-row design because the hem keyline overwrote the ninth.
 *
 * REWRITTEN 2026-10-22 FOR THE LOGO, and the half-turn symmetry check is GONE ON PURPOSE. It was
 * the property that stopped the motif reading as a tilted logo; the mark is now the logo, and the
 * logo is not symmetric under a half turn -- its dot sits at one corner only -- so the old check
 * would have demanded the very distortion this pass removes. What the frame must show instead:
 *
 *   1. Exactly the traced mark, pixel for pixel, and nothing else in its colour in the band. The
 *      failure being guarded is still the old one -- something painted afterwards eating it -- and
 *      an exact comparison names the pixel. Whether the TRACE is faithful to the SVG is a separate
 *      question with a separate bound, and it lives in `test/art-guards.test.ts`, read off the SVG.
 *   2. The three facts the symbol is at this size, read off the rendered pixels: two 4-connected
 *      pieces, the small one in the top-right corner of the mark, and a hollow centre.
 *   3. All nine rows between the cape line and the hem -- touching is allowed now, overlapping is
 *      not, because whichever line is painted last would clip the lobes.
 */
function assertCapeDevice(): void {
  const faults: string[] = [];
  const capeY = capeLineRow('up');
  const r = (MOTIF - 1) / 2;
  const want = new Set<string>();
  MARK_ROWS.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++)
      if (row[dx] === 'X') want.add(`${CX - r + dx},${capeY + 1 + dy}`);
  });
  if (capeY + MARK_ROWS.length >= HEM || MARK_ROWS.length !== MOTIF)
    faults.push(
      `the band between the back's cape line (row ${capeY}) and the hem (row ${HEM}) holds ` +
        `${HEM - capeY - 1} rows and the mark is ${MARK_ROWS.length} -- the hem would clip its lobes`,
    );
  for (const phase of [0, 1, 2, 3] as const) {
    const name = `up-${phase}`;
    const img = frameOf(name);
    const pts: [number, number][] = [];
    for (let y = capeY; y <= HEM; y++)
      for (let x = 0; x < PURPLE_FRAME_W; x++) {
        const c = img.get(x, y);
        if (c[3] > 0 && c[0] === MARK_INK[0] && c[1] === MARK_INK[1] && c[2] === MARK_INK[2])
          pts.push([x, y]);
      }
    const got = new Set(pts.map(([x, y]) => `${x},${y}`));
    const missing = [...want].filter((k) => !got.has(k));
    const extra = [...got].filter((k) => !want.has(k));
    if (missing.length || extra.length)
      faults.push(
        `${name}: the mark is not the traced mark -- ${missing.length} pixel(s) painted over ` +
          `(${missing.join(' ')}) and ${extra.length} stray pixel(s) in its colour (${extra.join(' ')})`,
      );
    if (!pts.length) continue;
    const comps = componentsOf(pts);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const dot = pts.filter(([x, y]) => x > (x0 + x1) / 2 && y < y0 + 2);
    const dotAlone =
      componentsOf(dot) === 1 && componentsOf(pts.filter((p) => !dot.includes(p))) === 1;
    if (comps !== 2 || !dotAlone)
      faults.push(
        `${name}: the mark is ${comps} piece(s) -- the Cyera symbol at this size is a ring and a ` +
          `detached dot at its top right, and anything else is not the symbol`,
      );
    if (got.has(`${(x0 + x1) / 2},${(y0 + y1) / 2}`))
      faults.push(
        `${name}: the mark's centre is filled -- the symbol is a ring, hollow in the middle`,
      );
  }
  if (faults.length) throw new Error(`Purple's cape mark is broken:\n  ` + faults.join('\n  '));
}

/**
 * THE BACK VIEW READS, 2026-10-21 -- the three things this round fixed and the sheet must not lose.
 *
 * `assertPurpleReads`' third check already holds a FLOOR on this view: that the back of her head
 * carries twelve pixels of something that is not the garment. That check is correct and it passed
 * on every frame the client sent back, twice, because "there is hair there" was never the question.
 * These are the three properties that were actually missing, and each one is measured on the
 * rendered frame rather than read off the constant that produces it.
 *
 * Every bound below fires on the SHIPPED sheet. That is the test of a guard and all three were run
 * against the previous painter before being written down, so none of them is a restatement of a
 * number this round happened to choose.
 *
 * 1. THE DOME HAS A SHADED FACE, not just a lit arc. `docs/PIXEL_STANDARD.md` section 3 requires
 *    every object in this world to catch the light on its top and left and fall away on its bottom
 *    and right; the largest mass on the protagonist was the one thing not doing it. Measured on the
 *    hood's WIDEST rows, with the single lip pixel at each end of the run discarded, counting cloth
 *    darker than the row's own modal value:
 *
 *        shipped        rows 7, 8, 9, 10 -> 0, 0, 0, 0
 *        this file      rows 7, 8, 9, 10 -> 4, 4, 5, 6
 *
 *    Four rows across the middle of her head on which the right-hand side was the IDENTICAL value
 *    to the centre. That is the egg, as a number.
 *
 *    THE BOUND IS TWO AND IT IS NOT A MEASUREMENT OF THIS DRAWING, which carries four to eleven.
 *    One pixel would be satisfied by the silhouette's own shaded lip, which `domeRun` lays on every
 *    row whether the dome is modelled or not -- so one is a bound that the egg itself could pass
 *    once the lip is counted. Two is the shortest run that is a face rather than an edge. The
 *    modal value is taken FROM THE ROW, so the guard never needs to know what `CLOAK_BASE` is or
 *    whether the plateau moved.
 *
 * 2. THE OPENING IS A GLIMPSE, NOT A PANEL. The whole of the client's second crop. On the hair's
 *    widest row the hair must be no wider than the garment left beside it on that same row:
 *
 *        shipped        10 px of hair beside 6 px of garment
 *        this file       8 px of hair beside 8 px of garment
 *
 *    The bound is the GARMENT on the same row, which is a different thing in the drawing from the
 *    hair, so it scales if the hood is ever redrawn wider and cannot be satisfied by renaming a
 *    constant.
 *
 *    WHAT IT ACTUALLY PERMITS, measured by breaking it rather than asserted -- and the first draft
 *    of this paragraph claimed the opposite, which is why it is written out. Profiles run through
 *    the guard:
 *
 *        [2, 3, 4, 3]   8 px of hair beside 8 px of garment   passes -- this file
 *        [2, 4, 4, 3]   8 px, carried a row higher            passes
 *        [3, 4, 4, 3]   8 px, the rejected halfway house      PASSES
 *        [2, 3, 5, 3]  10 px beside 6                         fires
 *        [3, 4, 5, 4]  10 px beside 6, THE SHIPPED PANEL      fires
 *        [4, 5, 6, 5]  12 px beside 4                         fires
 *
 *    So it is NOT the zero-slack ratchet an earlier draft of this comment called it. It bites on
 *    the hood's narrowing rows, where ten pixels of opening leaves six of garment, and it has a
 *    pixel of room on the widest row. The halfway house in `paintNape`'s note passes it, and that
 *    is correct rather than a hole: `[3, 4, 4, 3]` was rejected by eye between two acceptable
 *    drawings, and a guard that cannot tell a judgement from a defect would be enforcing taste.
 *    What it does hold is the thing the client sent back twice -- an opening wider than the cloth
 *    around it.
 *
 * 3. THE HAIR HAS A BOTTOM EDGE. Its lowest row must sit a readable step below the row above it,
 *    or the bob stops rather than ending:
 *
 *        shipped        mean 78.7 -> 72.9, a step of 5.8 luma
 *        this file      mean 78.6 -> 49.0, a step of 29.6 luma
 *
 *    Twenty luma is the floor, with fourteen of daylight under it and ten over it -- a gap in the
 *    population rather than a number fitted to today's ramp. The file's own evidence for where
 *    legibility sits at this size is on `paintNape`: a parting of nine luma does not read.
 */
function assertBackView(): void {
  const faults: string[] = [];
  const ink = keyline('cloak');
  /** Her garment, minus its outline: the cloth whose value the dome's modelling lives in. */
  const isGarment = (c: RGBA): boolean =>
    c[3] > 0 && c[2] > c[0] && !(c[0] === ink[0] && c[1] === ink[1] && c[2] === ink[2]);
  /** One pixel is a lip; two is a face. See the note above -- NOT read off this drawing. */
  const FACE = 2;
  /** A step that reads at 32x48. Nine luma demonstrably does not; see `paintNape`. */
  const EDGE = 20;

  for (const phase of [0, 1, 2, 3] as const) {
    const name = `up-${phase}`;
    const img = frameOf(name);
    const lumaAt = (x: number, y: number): number => Math.round(lumaOf(img.get(x, y)));

    // The hood's extent. The first attempt at this took it as "the lowest warm row", on the
    // reasoning that the hair reaches the hood's last row by construction -- and it was wrong in
    // the way worth recording: `isWarm` is R > B, which is her BOOTS (`keyline('trunk')`), her HAND
    // (`skin`) and her BASKET (`wood`) as much as her hair. It found row 42 and reported her boots
    // as a twelve-pixel panel on the back of her head. So the window is anchored the way
    // `assertPurpleReads` already anchors its own -- from where she starts, plus the hood's height --
    // which also carries the one-row bob without naming it.
    let top = 0;
    while (top < PURPLE_FRAME_H) {
      let any = false;
      for (let x = 0; x < PURPLE_FRAME_W; x++) if (isOpaque(img, x, top)) any = true;
      if (any) break;
      top++;
    }
    const hoodBottom = top + HOOD_H;
    const warmRows: number[] = [];
    for (let y = top; y <= hoodBottom; y++)
      for (let x = 0; x < PURPLE_FRAME_W; x++)
        if (isWarm(img.get(x, y))) {
          warmRows.push(y);
          break;
        }
    if (!warmRows.length) {
      faults.push(
        `${name}: nothing but garment in the hood's own rows, so there is no bob to read`,
      );
      continue;
    }

    // Every row's garment run, over the hood only.
    const runs = new Map<number, number[]>();
    for (let y = top; y <= hoodBottom; y++) {
      const xs: number[] = [];
      for (let x = 0; x < PURPLE_FRAME_W; x++) if (isGarment(img.get(x, y))) xs.push(x);
      if (xs.length) runs.set(y, xs);
    }
    const widest = Math.max(...[...runs.values()].map((xs) => xs.length));

    // 1. The dome's shaded face, on each of its widest rows.
    const flat: string[] = [];
    for (const [y, xs] of runs) {
      if (xs.length < widest) continue;
      // Drop the silhouette's own lip at each end: `domeRun` draws it regardless of the modelling.
      const run = xs.slice(1, -1);
      const freq = new Map<number, number>();
      for (const x of run) freq.set(lumaAt(x, y), (freq.get(lumaAt(x, y)) ?? 0) + 1);
      const mass = [...freq].sort((a, b) => b[1] - a[1])[0]![0];
      const shaded = run.filter((x) => lumaAt(x, y) < mass).length;
      if (shaded < FACE) flat.push(`row ${y} (mass ${mass}, ${shaded} px shaded)`);
    }
    if (flat.length)
      faults.push(
        `${name}: the dome's widest rows have a lit arc and no shaded face -- ${flat.join(', ')} ` +
          `-- so her hood is an egg rather than a hood, which is the client's own word for it`,
      );

    // 2. The opening at the nape is a glimpse, not a panel.
    let hairRow = -1;
    let hairWidth = 0;
    for (let y = top; y <= hoodBottom; y++) {
      let n = 0;
      for (let x = 0; x < PURPLE_FRAME_W; x++) if (isWarm(img.get(x, y))) n++;
      if (n > hairWidth) {
        hairWidth = n;
        hairRow = y;
      }
    }
    const garmentThere = runs.get(hairRow)?.length ?? 0;
    if (hairWidth > garmentThere)
      faults.push(
        `${name}: row ${hairRow} is ${hairWidth} px of hair beside only ${garmentThere} px of ` +
          `garment -- the cowl's opening is a panel on the back of her head, not a glimpse ` +
          `through it`,
      );

    // 3. The hair has a bottom edge rather than stopping.
    const meanWarm = (y: number): number => {
      const v: number[] = [];
      for (let x = 0; x < PURPLE_FRAME_W; x++) if (isWarm(img.get(x, y))) v.push(lumaAt(x, y));
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    };
    const rowsWithHair = [...new Set(warmRows)];
    if (rowsWithHair.length >= 2) {
      const lowest = rowsWithHair[rowsWithHair.length - 1]!;
      const above = rowsWithHair[rowsWithHair.length - 2]!;
      const step = meanWarm(above) - meanWarm(lowest);
      if (step < EDGE)
        faults.push(
          `${name}: the bob's last row sits ${step.toFixed(1)} luma under the row above it -- it ` +
            `stops against the hood's rim rather than having an underside, so at 1x it is a ` +
            `lozenge with no bottom edge`,
        );
    }
  }

  if (faults.length) throw new Error(`Purple's back view does not read:\n  ` + faults.join('\n  '));
}

assertContactLine();
assertPurpleReads();
assertCapeDevice();
assertBackView();

/*
 * ONE RETRACTION, AND TWO THINGS THE NEXT PASS HAS TO PICK UP THAT CANNOT BE DONE FROM THIS FILE.
 *
 * 1. THE "NOTHING IMPORTS THIS FILE" WARNING THAT STOOD HERE IS OUT OF DATE, and it is retracted
 *    rather than deleted, because a stale warning that scares the next round off measuring is
 *    worse than no warning. `sprites.ts` now imports Purple `from './sprites/char-purple.ts'`, and the
 *    committed `apps/game/src/assets/purple.png` profiles identically to this file's own sheet on all
 *    six axes. This file is the shipped Purple; `pnpm graybox` regenerates it from here.
 *
 *    The tail of that warning asked for `red-sprite.ts`, a second and older Purple imported by
 *    nothing, to be deleted. IT HAS BEEN, so there is no longer a second Purple to confuse this one
 *    with, and this item is kept only as the retraction. The ask that outlived it is the general
 *    one: a sprite nothing imports is how the confusion happened, and `sprites.ts` is the one place
 *    that says which painter ships.
 *
 * 2. PURPLE HAS NO CAST SHADOW ANY MORE. `paintFrame` used to bake an opaque dark-green ellipse under
 *    every frame, which travelled with her onto the sand, the bridge and the cottage step; it is
 *    removed, and the reasoning is at the call site. She is seated by `seatOutline`'s doubled
 *    bottom keyline, which is ground-neutral, but a real contact shadow still wants drawing by the
 *    SCENE, under the sprite and over the tile, where it can take the colour of the ground she is
 *    actually standing on. That belongs in `forest-scene.ts`, not here.
 *
 * 3. THE COMPOSITE TEST SHOULD BE A COMMAND, not a script somebody writes again next round. Every
 *    sprite in this project is drawn, reviewed and scored against white, and every one of them is
 *    only ever seen against grass, sand or planking. Purple's loudest fault survived four rounds of
 *    honest measurement purely because nobody put her on the ground. `world.ts` already renders
 *    the map from the painters and `sprites.ts` already assembles the sheets; a `--with <sheet>`
 *    flag that blits a frame onto the render at a landmark is perhaps twenty lines, and it would
 *    apply to the wolf, the rabbit, the owl, the Lantern Keeper and the bystanders as much as to
 *    her. It belongs in `world.ts`, which this round did not own.
 */
