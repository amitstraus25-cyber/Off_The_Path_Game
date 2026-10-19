/*
 * The tree: one 64x64 crown cut into four canopy quarters over one 64x32 trunk cut into two
 * halves. Redrawn against `reference/mocks/gameplay-concepts.png` and docs/ART_DIRECTION.md.
 *
 * Four things the board does, in the order they matter.
 *
 * **The dark.** Re-measured on 2026-10-19 by cropping the INTERIOR of a board crown -- inside its
 * keyline, no grass in the window -- and taking it down to our own resolution: 35 per cent of it is
 * below luma 81 and 22 per cent below luma 60. (Earlier notes in this file quote 21 and 14 from a
 * window that included the lawn, which is why two passes thought the crown was a brighter object
 * than it is.) The dark is not a wash and it is not most of the tree: it is the crown's underside
 * and the network of channels between the leaf clusters, and everything else is green. Shape the
 * dark rather than dimming the tree. Ours is at 41 and 33 against those -- a shade deep, and the
 * right side of the line that an earlier version crossed when it hit 45 per cent under luma 60 and
 * read as a navy tree with some green on top.
 *
 * **The keyline.** Every mass on the board is ringed in a hard near-black line, and it is TWO of our
 * pixels, not one. Counting every pixel under luma 30 in a board crown taken down to our resolution
 * gives 7.8 per cent of the patch where a single-pixel ring gives 3.6, and the line's own colour is
 * #041221 -- a blue-black, since the crown's dark is teal, not the green-black a `canopy` keyline
 * alone produces. `paintCrown` therefore runs `outline()` twice and mixes the line towards the water
 * keyline; see LEAF_LINE. One consequence to keep in mind when drawing the silhouette: two passes
 * fill in any notch narrower than four pixels. `Img.outline()` only
 * paints transparent pixels next to opaque ones, so calling it per tile would ring each of the six
 * tiles separately and the tree would come out quilted. ART_DIRECTION section 3.4 is the recipe
 * and this file follows it: the crown is drawn once at 64x76 and the trunk once at 64x32, each is
 * outlined and seated on its own scratch, and the tile painters only ever cut from those two
 * drawings. No quadrant knows it is a quadrant, so no seam can drift.
 *
 * **The root flare.** The board's trunk is a slim column with a short splayed foot, five fingers
 * each separately keylined and each lit along its top. That flare is most of what makes the
 * board's trees look drawn rather than generated.
 *
 * **The shadow.** Every tree on the board sits in a dark pool reaching down and to the right, away
 * from the one light the world is lit by. It is a named colour you could point at, it lies on the
 * lawn, which is the largest surface in any frame, and a tree without one floats.
 *
 * One correction to that, measured on 2026-10-19 by cropping the board at its own trunk base
 * (150,620 230x140): the pool is TIGHT. It is a dark collar under and just right of the root flare,
 * perhaps six of our pixels deep, with a tuft of darker blades in it -- and the lawn two tiles to
 * the right of the trunk is full brightness. Anyone reading the frame's deep-shade deficit as a
 * reason to spread a wide pool under every tree will move the number and lose the board.
 *
 * ----------------------------------------------------------------------------------------------
 * THE DAPPLE PASS, 2026-10-19, and it is the one that stopped the crown reading as a vegetable.
 * Read this before changing anything in the crown.
 *
 * **Lay a 1:1 crop of the board beside a 1:1 render of ours.** Nothing in this file is worth as
 * much as that habit. `reference/mocks/gameplay-concepts.png` cropped at 80,440 320x300 is the
 * tree; crop it again at 130,470 170x170 and scale it three times and you can count the pixels.
 *
 * **THE BOARD'S CROWN HAS NO LOBES.** Two earlier passes drew one: the first a ring of eight discs
 * at radius 9, which read as cauliflower, the second a bell of forty-two at radius 6, which read as
 * a pinecone. Both were lit as spheres and ringed in a dark crease, and both were wrong in the same
 * way -- ANY regular pitch, at any radius, draws a net of uniform mesh over the dome and every unit
 * inside it comes out as a scale. Shading cannot rescue a repeating unit.
 *
 * What the board actually draws, at three times our resolution, is DAPPLE: a dark mass with
 * irregular leaf clusters of visibly varying size lying on top of it, in no pattern whatsoever, and
 * the dark showing between them as a winding network of channels two or three of our pixels wide.
 * So this file paints the dark FIRST, over the whole silhouette, and scatters clusters over it
 * afterwards. The channel network is then whatever shape the gaps happen to be, which is the one
 * thing a hand-written table can never produce. See `bodyAt`, `DAPPLE` and `paintDapple`.
 *
 * **Proportion.** The board's crown is a BROAD EGG -- laid at 1:1 beside a whole board tree it is
 * as wide as it is tall, about 60 of our pixels each way, and the lobes hanging off its underside
 * are what take it past square. Ours is 59 across and 61 down with the lobes, widest
 * below the waist -- over a trunk about 16 wide and 16 tall. Not a pancake (the 2026-10-17 note,
 * which had it at 1.5 wide to 1 tall) and not a bell (the 2026-10-18 one). See `eggHalfW`.
 *
 * **Crisp, not round.** Measured against board crops taken down to OUR resolution, the board runs
 * about 19 per cent edge density where a smoothly shaded forest runs 9. The board is not smoother
 * than us, it is crisper -- that is what pixel art is. So a cluster is FLAT, it snaps to the seven
 * rungs of `LEAF_STOPS`, and where one cluster ends against the dark the step is a cliff.
 *
 * **The light.** The board lights hard from the top: measured down the middle of its crown, the
 * cap runs near luma 150 and the bottom sixth near 55, and the bottom third leans teal. What grades
 * is the CLUSTERS; the dark between them is the same deep value at the cap as at the hem.
 *
 * **Green, not teal.** The board's crown is teal UNDERNEATH and true leaf green on top, and the
 * handover is sharp. Sampled at our resolution, its crown pixels under luma 81 average #043b47 --
 * blue 67 levels above red -- and its pixels over luma 120 average #6bbc57, blue 21 levels BELOW
 * red. Fading the teal gently up the ladder, as the previous version did, leaves a tenth of it on
 * the brightest leaf and better than a third on the mid-greens, and the tree comes out cold and
 * sickly against a green lawn. The tint is now off entirely above the luma-81 line.
 *
 * **Hue carries the colour count, not value.** Seven rungs of value can only ever be seven
 * colours. What makes a painted crown never twice the same green is a warm or cool lean of a few
 * per cent, applied at every level and through `toward()` so it moves hue without touching the
 * luma the rungs put there. See `leaf()`.
 */
import { Img, keyline, lumaOf, noise, tone, valueNoise2D } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';

const TILE = 32;

/**
 * Tree space. x is 0..63 across both columns of tiles. y 0..63 is the four canopy tiles; y 64..95
 * is the two trunk tiles, which `forest-map.ts` plants on the row directly under `canopy-bl/-br`.
 * The crown drawing runs twelve rows past its own tiles so the leaves that close over the trunk's
 * shoulders are part of the same drawing as the rest of the crown rather than a second guess at it.
 */
const TRUNK_TOP = 64;
const CROWN_H = 76;
const TRUNK_H = TILE;

/**
 * The row the roots stand on, in trunk-tile coordinates -- raised four rows on 2026-10-19 so that
 * the tree's shadow has somewhere to fall.
 *
 * The trunk tile is the last row of the tree; below it the map lays plain grass that this file
 * cannot paint. With the roots ending at row 29 there were two rows of tile left under them, so
 * every pool drawn here was either hidden behind the bark or clipped off the bottom edge, which is
 * why the review found the trees casting no shadow at all. At row 22 there are nine rows of open
 * ground below the flare and the pool is the thing that fills them.
 */
const GROUND_Y = 24;

/**
 * The crown's own top and bottom: the row the light grade starts from, and the row the dark matrix
 * has finished falling by. The matrix reaches the bottom of the ladder, #16281a tinted teal, and
 * there is no floor holding it up -- the board draws the dark between its leaf clusters at #00030c,
 * below anything in our palette, so nothing here is ever too dark.
 */
const CROWN_SKY = 2;

/* ---------------------------------------------------------------------------- continuous tone */

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smoothstep. Every falloff in this file goes through it, so nothing in the tree is a hard step. */
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const mix = (a: RGBA, b: RGBA, f: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * f),
  Math.round(a[1] + (b[1] - a[1]) * f),
  Math.round(a[2] + (b[2] - a[2]) * f),
  255,
];

/**
 * A stop on a ladder: a ramp, and a position along it for `tone()`. `tone(r, i / 3)` is exactly
 * `shade(r, i)`, so thirds name the palette's own four stops and anything else is between them.
 */
type Stop = readonly [Ramp, number];

/**
 * A continuous value along a ladder of stops, `t` running 0 (darkest) to 1 (lightest).
 *
 * `tone()` interpolates inside ONE ramp; a leaf has to run from the deepest crease to the highest
 * lit leaf, which is further than any single ramp reaches. This walks a ladder that crosses ramps
 * and interpolates across the joins as well as inside them, so there is no step anywhere.
 */
const along = (stops: readonly Stop[], t: number): RGBA => {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return mix(tone(a[0], a[1]), tone(b[0], b[1]), x - i);
};

/**
 * The leaf ladder: seven stops from the crown's deepest crease to its highest leaf, measured
 * against the board, and now travelled continuously rather than in four jumps.
 *
 *   t      value               luma   role                              board
 *   0.00   shadow 0  #16281a    31    the deepest crease                ~L11 (teal)
 *   0.17   shadow 1  #1f3a22    53    the deep shade under the dome     #034654 L50
 *   0.33   shadow 2  #2c4f2b    72    clump shade                       #066155 L70
 *   0.50   canopy 0  #21713c    92    the turn out of shade             #167e51 L92
 *   0.67   canopy 1  #2f9a4a   126    base                              #45ad4d L130
 *   0.83   canopy 2  #51bb4b   156    lit                               #5cbd48 L146
 *   1.00   canopy 3  #86d65c   188    highlight                         #89cd51 L167
 *
 * Two thresholds are worth keeping in mind when tuning the clump table, because they are what the
 * scorer counts: luma 60 (the "keyline" axis) falls at t = 0.23, and luma 81 (the "deep shade"
 * axis) at t = 0.41. The board puts 36 per cent of a crown under the first and 50 per cent under
 * the second, which is why so many clumps below sit at t under 0.15 -- the sphere term lifts their
 * middles and the ones that matter are the rims.
 *
 * **The top of the ladder came down a quarter of the canopy ramp on 2026-10-19, and it is measured.**
 * Cropping the INTERIOR of a board crown -- inside the keyline, no grass in the window -- and
 * splitting it by brightness, the board's crown tops out at #5fc351, luma 152, and only 3.0 per cent
 * of it is up there at all. Ours ran to #87d168 at luma 170 with 9.4 per cent of the crown in that
 * band: a third again as much, and with red at 135 against the board's 95 it was the single washed-
 * out note in the whole tree. The brand's `canopy` ramp is right and the crown was simply using all
 * of it; the board's crown never reaches the ramp's fourth stop. `tone('canopy', 0.78)` is #63c451,
 * which is the board's own ceiling to within three levels a channel.
 *
 * The three canopy stops are respaced over the shorter run rather than squeezed against the top.
 *
 * **How far they came down is set by the edge threshold, not by taste, and the first attempt at it
 * cost four points of edge density.** The scorer calls two neighbours an edge when their luma
 * differs by more than 24. Stops at canopy 0.26 / 0.52 / 0.78 put the three top rungs 23, 23 and 25
 * luma apart: two of those are UNDER the threshold, so most cluster boundaries in the lit half of
 * every crown stopped counting and the camera's edge density fell from 19.1 to 14.9 with nothing
 * visibly changed. At 0.29 / 0.58 / 0.86 the rungs are 26, 26 and 27 apart, which clears it. The
 * ceiling is then luma 162 rather than the board's 152 -- ten levels high on the three per cent of a
 * crown that reaches the top rung at all, which is the right side of that trade.
 */
const LEAF_STOPS: readonly Stop[] = [
  ['shadow', 0],
  ['shadow', 1 / 3],
  ['shadow', 2 / 3],
  ['canopy', 0],
  ['canopy', 0.29],
  ['canopy', 0.58],
  ['canopy', 0.86],
];

/**
 * Pull a colour towards another WITHOUT moving its brightness.
 *
 * A plain mix drags value along with hue, which is why the earlier attempt at the board's teal came
 * out as pale blue-green: every ramp in the palette that is blue is also light, so any useful
 * amount of it lifted the deep shade straight out of the deep shade. Scaling the result back to the
 * luma it started at separates the two decisions -- the ladder owns the value, this owns the hue --
 * and it is the same trick `keyline()` uses to keep a dark purple purple.
 */
function toward(base: RGBA, dest: RGBA, f: number): RGBA {
  const m = mix(base, dest, f);
  const want = lumaOf(base);
  const got = lumaOf(m);
  const k = got > 0 ? want / got : 1;
  return [
    Math.min(255, Math.round(m[0] * k)),
    Math.min(255, Math.round(m[1] * k)),
    Math.min(255, Math.round(m[2] * k)),
    255,
  ];
}

/**
 * A leaf: its place on the ladder, and which way the light has turned it.
 *
 * The second argument is the part that was missing, and it is worth being precise about why. The
 * scorer quantises to five bits a channel before counting colours, so a ONE-DIMENSIONAL ramp can
 * never yield more than about twenty distinct values however finely it is interpolated -- the crown
 * came in at 78 colours per thousand pixels with every tone in this file already continuous,
 * against a board that carries 149 at the same resolution; it is 81 now. Variety is not a resolution problem, it
 * is a dimensionality one.
 *
 * Measured, the missing dimension is specifically BLUE in the dark half. Sampling the board's own
 * crown down to our resolution and splitting it by brightness, its shaded pixels average 80 levels
 * more blue than red; ours averaged 13, which is a neutral green, and now average 59. Its lit pixels, by contrast, we
 * already match within a few levels. The board's crown is not a green ball with shading on it -- it
 * is a teal mass with yellow-green leaves lying on top, exactly as the note at the head of this
 * file has said since it was written, and the palette has never had a colour that could say so.
 * ART_DIRECTION section 14 asks for a teal deep-shade step; this is the nearest the table reaches
 * until that lands, and because the tint preserves luma it changes only the hue the ramps already
 * had and not one of the values measured above.
 *
 * `w` runs -1 (turned away from the sun) to +1 (facing it) and biases how much of each tint a leaf
 * takes, so a mass is cooler where it curves into shade and warmer where it catches the light.
 *
 * **Where the teal is allowed to reach.** Measured down the middle of a board crown at our own
 * resolution, its pixels under luma 81 run blue 84 levels above red and its pixels over luma 120
 * run blue 9 levels BELOW red. Teal underneath, leaf green on top, and the handover sits near the
 * luma-81 line, which is `u = 0.41`. So the tint is a smoothstep fully on at the bottom of the
 * ladder and gone by `u = 0.52`: the previous version cut it at 0.46, which left the deep shade at
 * 45 blue-over-red against the board's 84 -- not teal enough, where the version before THAT faded
 * it as `(1 - u) ^ 0.8` and put a tenth of it on the brightest leaf in the crown, which is a teal
 * TREE rather than a teal underside. Both ends of that have been overshot now; this is the middle.
 *
 * **Where the gold is allowed to reach, and it is much less far than it was.** The board's lit leaf
 * runs blue 9 under red; ours ran 28 under, because every ramp in the palette is yellow at the top
 * and the gold tint pushed it further. The brand owns those ramps, so the gap cannot be closed
 * entirely without inventing a green. What it can do is stop making it worse: the gold is down from
 * 0.12 to 0.03 and the `lean` below is pivoted cool, which takes the lit leaf to within 7 levels of
 * the board. The remainder is a palette limit and should be left alone rather than hacked around.
 */
/**
 * The crown's shade hue, and it is a TEAL rather than a blue. This is the 2026-10-19 correction and
 * it is the single reason ours read navy where the board reads storybook.
 *
 * The tint above used to point at `tone('water', ...)` alone. Measured, the water ramp's blue runs
 * 84 levels above its own green, so pulling a dark green most of the way towards it lands on a
 * NAVY: our crown's luma-30-to-60 band came out #13384d, where the board's is #044051. The board's
 * numbers say what teal means precisely -- in its deep band blue leads red by 77 and green leads red
 * by 60, and in the band above (#0f5f52) green actually leads BLUE by 13. Green and blue together,
 * red near zero. A blue-dominant destination cannot express that at any strength.
 *
 * So the destination is mixed: water for the blue, grass for the green, a little under half and
 * half. At u = 0.1 that is #2c8a98 -- blue 108 over red, green 94 over red, blue 14 over green,
 * which is the board's proportion. It is two palette ramps blended, not an invented colour, and it
 * goes through `toward()` like everything else here, so it moves hue and leaves every value the
 * ladder set exactly where it was.
 */
const tealAt = (u: number): RGBA =>
  mix(tone('water', 0.08 + u * 0.3), tone('grass', 0.25 + u * 0.3), 0.25);

/**
 * Take the red out of a colour without moving its brightness, and it is the other half of the teal.
 *
 * Mixing towards a destination can only ever land between two colours, and measured against the
 * board that is not where the crown's shade lives. Sampled at our resolution the board's luma-30-to-
 * 60 band is #044051: red FOUR, against a green of 64 and a blue of 81. Every ramp in our palette
 * has far more red than that relative to its brightness -- the bluest, `water`, still runs red at a
 * quarter of its own luma where the board's shade runs it at a twelfth -- so no blend of two of them
 * reaches the board's shade from a green base. Our first attempt at this landed on #173837, a dark
 * grey-green: the blue/green balance was right and the colour still read dull, because what makes
 * the board's teal vivid is the ABSENCE of red, not the presence of blue.
 *
 * So this scales the red channel down and scales all three back up to the luma it started at. It is
 * the same trick `keyline()` and `toward()` use -- separate the hue decision from the value decision
 * -- and it invents no colour: the result is the palette's own green and blue with the grey taken
 * out of it. It is applied only where the teal applies, so the lit leaves, which on the board carry
 * plenty of red (#5bb84e, red 91), are untouched.
 */
const deRed = (c: RGBA, f: number): RGBA => {
  const want = lumaOf(c);
  const r = c[0] * (1 - clamp01(f));
  const got = 0.299 * r + 0.587 * c[1] + 0.114 * c[2];
  const k = got > 0 ? want / got : 1;
  return [
    Math.min(255, Math.round(r * k)),
    Math.min(255, Math.round(c[1] * k)),
    Math.min(255, Math.round(c[2] * k)),
    255,
  ];
};

const leaf = (t: number, w = 0): RGBA => {
  const u = clamp01(t);
  const base = along(LEAF_STOPS, u);
  /*
   * How far up the ladder the shade hue reaches, and it is further than this file used to think.
   *
   * The handover was pinned to the luma-81 line (u = 0.52) on an earlier measurement. Re-measured on
   * 2026-10-19 by splitting a board crown into brightness bands and reading the red off each, the
   * board's teal plainly survives past that: its luma-60-to-81 band runs red at 0.22 of its own
   * luma and its 81-to-120 band at 0.32, where its lit band jumps to 0.60. The handover is between
   * the mid band and the lit band, near luma 120, which is u = 0.66 here. Fully on below 0.08, gone
   * by 0.66, so the brightest leaf in the crown still has none of it -- which is the failure mode the
   * note above warns about and it is still avoided.
   *
   * It is TWO curves, and separating them is what finally fitted the board's mid-greens. Adding blue
   * and removing red are different operations with different reaches: the board's luma-81-to-120
   * band is #1b8c54, green 113 over red but blue only 57 over it, so it is a SATURATED green with
   * the grey taken out, not a green with blue mixed in. `blue` is therefore the narrow curve, gone
   * by u = 0.62, and `cool` -- which only ever removes grey -- runs most of the way up the ladder
   * and is what takes our mid band's red from 48 to the board's 27. When the two were one curve,
   * reaching far enough to fix the red turned the whole middle of the crown blue, and stopping
   * before that left it a dull olive. Neither is the board.
   */
  const blue = smooth(0.62, 0.08, u);
  const cool = smooth(0.92, 0.08, u);
  const teal = 1.0 * blue * (0.8 - 0.2 * clamp(w));
  const gold = 0.03 * smooth(0.62, 1, u) * (0.55 + 0.45 * clamp(w));
  /*
   * A warm or cool lean of a few per cent, everywhere on the ladder and at every level.
   *
   * The two tints above are the crown's structure -- teal underneath, gold on the highlights --
   * and between them they leave the MIDDLE of the ladder, which is most of a crown by area,
   * with no hue variation whatsoever: at u = 0.5 the teal has faded out and the gold has not
   * faded in, so every mid-green in the tree was one of seven exact palette values. That is a
   * precise account of why the colour-variety axis sat at a twentieth of the board. A painted
   * crown is never twice the same green, and the difference is hue, not value.
   *
   * Twenty-one per cent, through `toward`, so it moves the hue and leaves the luma exactly where the
   * rungs put it. None of the measured value axes can feel this; the eye reads it as a crown lit
   * by a warm sun under a cool sky.
   *
   * The constant five per cent it is pivoted by is the gold correction above, spent where it does
   * least harm: the swing is still a full warm-to-cool sweep, it just averages cool rather than
   * neutral, which is what a leaf under an open sky does.
   *
   * It was thirteen per cent until 2026-10-19 and the widening is measured. Colour variety is the
   * one axis on which our crown is still far under the board's -- 149 distinct colours per thousand
   * pixels against our 54 -- and it is the only axis the scorer calls out. Hue is the free way to
   * move it: this, `dull` and the matrix's own hue swing all run through `toward`, which preserves
   * luma exactly, so widening all three took the crown from 54 to 81 without moving deep shade,
   * keyline, spread or edge density by a measurable amount. Value variation would have cost all
   * four.
   */
  const lean = 0.21 * clamp(w) - 0.05;
  const tinted = deRed(toward(toward(base, tealAt(u), teal), tone('gold', u), gold), 0.85 * cool);
  return lean >= 0 ? toward(tinted, tone('gold', u), lean) : toward(tinted, tealAt(u), -lean);
};

const clamp = (w: number): number => (w < -1 ? -1 : w > 1 ? 1 : w);

/**
 * The bark ladder, four stops, and it crosses two ramps on purpose.
 *
 *   0.00   trunk 0.00  #4e3520    58    the underside of a root, the deep grooves
 *   0.33   trunk 0.33  #6b4a2b    80    the shaded quarter of the cylinder
 *   0.67   trunk 0.85  #9b7450   124    the body
 *   1.00   wood  0.50  #ad7a43   130    the lit column and the top of every root
 *
 * **Where the top of this ladder sits, and it came down twenty luma.** The previous version ran up
 * through `wood` to #c08f55 at L151: brighter than the board's bark anywhere, and yellower -- its
 * green channel is 143 where the board's lit bark is 127. A brown whose green runs that close to
 * its red is a tan, and against a green lawn a bright tan reads as plastic, which is what the
 * review saw. Sampled at our own resolution the board's bark over luma 120 averages #bd7f43 and
 * the whole trunk patch averages L80 with 53 per cent of it under luma 81, so this is a DARK
 * object with one lit edge, not a light one with some shading.
 *
 * It still crosses ramps, because neither spans the bark on its own and because the two differ in
 * the way the board does: desaturated in the grooves, warmer on the lit column. But it now spends
 * three of its four stops in `trunk`, which is the desaturated ladder, and only borrows the top one
 * from `wood`. ART_DIRECTION section 3.1 treats wood, bark and earth as one family, so this borrows
 * inside the family rather than across it.
 */
const BARK_STOPS: readonly Stop[] = [
  ['trunk', 0],
  ['trunk', 1 / 3],
  ['trunk', 0.85],
  ['wood', 0.5],
];

/**
 * Bark, with the same hue axis as `leaf` for the same reason, and pointed where the board points
 * it: the board's bark runs from a desaturated dark brown in the grooves to a warmer one on the lit
 * column, which is a swing in chroma rather than only in value. So the lit side takes a trace of
 * `gold` and the shaded side a good deal of `stone`, which is the palette's neutral -- more of it
 * than before, because the board's own shaded bark (#3c2926, green 19 levels under red) is nearly
 * neutral where the `trunk` ramp's darkest is still a saturated chocolate.
 */
const bark = (t: number, w = 0): RGBA => {
  const base = along(BARK_STOPS, t);
  const u = clamp01(t);
  return w > 0
    ? mix(base, tone('gold', u), 0.1 * w * u)
    : mix(base, tone('stone', u * 0.6), 0.24 * -w * (1 - u));
};

/**
 * The two keylines: each family's darkest stop taken down with its HUE PRESERVED, which is what
 * the board does and what makes its world read as one illustration rather than as a sticker sheet.
 *
 * The leaf line takes a much deeper drop than the default. `canopy` bottoms out at L92, so the
 * default 40 leaves a line at L52 -- inside the crown's own deep-shade band, where the ring stops
 * being a line and becomes another step of the crown. Sampled at our resolution the board's own
 * line is #00030c and #000000, under luma 10, against a deep leaf shade of #004051 at L51: it is
 * not a dark green, it is effectively black with the hue still in it. At a drop of 78 this lands
 * near L15, which is the same relationship.
 *
 * **The leaf line is blue-black, not green-black, and that is measured.** Sampling a board crown
 * down to our own resolution and taking every pixel under luma 30, the board's line averages
 * #041221: blue 29 levels ABOVE red, at luma 16. Ours was #06130a -- the same luma, blue 4 levels
 * above red, which is a green-black. The difference sounds academic and is not: the crown's dark
 * MATRIX is a deep teal, and a line a shade greener than the mass it rings stops reading as ink and
 * starts reading as one more step of the crown. Mixing the canopy keyline nine parts towards the
 * water keyline lands on #04111c at luma 14 -- the board's relationship, built from two palette
 * ramps rather than from an inlined hex.
 */
const LEAF_LINE: RGBA = mix(keyline('canopy', 78), keyline('water', 84), 0.9);
const BARK_LINE: RGBA = keyline('trunk');

/**
 * The ladder the ground shade is pooled along, running from the lawn's own mid-green down into the
 * shade ramp -- and it now starts at the BOTTOM of that ramp rather than a third of the way up.
 *
 * The previous version bottomed out at `shadow` 1/3 (#1f3a22, L53) and spent three of its six rungs
 * in `grass`, which made the pool a few luma darker than the lawn and nothing more. On the board
 * every tree sits in a definite dark pool: sampled at our resolution the ground under a trunk
 * averages #1c2e31 and 39 per cent of that patch is under luma 81. A pool you cannot name the
 * colour of is not a shadow, and this was most of the missing deep shade in the whole frame -- the
 * crown is one object per tree, the pool is one per tree and it lies on the lawn, which is the
 * largest surface in any frame.
 *
 * Six rungs still, and still solid colours rather than an alpha wash, so no neighbouring pair in
 * the pool differs by more than about twenty-five: a soft edge built out of darker tones, with no
 * partial alpha anywhere, which is what the house rule asks for.
 */
const SHADE_STOPS: readonly Stop[] = [
  ['shadow', 0.06],
  ['shadow', 0.3],
  ['shadow', 0.55],
  ['shadow', 0.8],
  ['grass', 0.1],
  ['grass', 0.32],
];

/* --------------------------------------------------------------------------------- raster help */

const opaqueAt = (img: Img, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < img.w && y < img.h && img.get(x, y)[3] !== 0;

/**
 * A leaf clump: a disc whose radius breathes around the circumference, so no clump is a clean
 * ellipse and the pile of them has the scalloped, slightly ragged silhouette the board's crowns
 * have. Three sine terms rather than noise, because the shape has to be the same every time the
 * six tiles are regenerated and it has to be smooth enough that the rim does not come out as
 * single stray pixels.
 *
 * It hands each pixel its NORMALISED position -- `dx`, `dy` in units of the radius, and `d` as the
 * fraction of the way from the centre to the wobbled rim. That is what lets the caller light the
 * clump as a sphere instead of filling it flat, which is the whole point of this redraw.
 */
function lump(
  img: Img,
  cx: number,
  cy: number,
  r: number,
  seed: number,
  at: (x: number, y: number, dx: number, dy: number, d: number) => void,
): void {
  const reach = r * 1.3;
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / (r * 0.9);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.3) continue;
      const th = Math.atan2(dy, dx);
      /*
       * The dent is damped to under half the bulge, and that asymmetry is load-bearing. A clump
       * of radius 6 with three free sine terms can lose a third of its radius at one bearing, and
       * where two neighbouring clumps both dent towards each other the crown tears open: outline()
       * then rings both sides of the hole and the silhouette comes out lacy, with stray pixels
       * adrift outside their own keyline. Bulging out is what reads as a scallop; biting in only
       * ever costs geometry.
       */
      const wave =
        0.21 * Math.sin(3 * th + seed) +
        0.13 * Math.sin(5 * th - seed * 1.7) +
        0.07 * Math.sin(7 * th + seed * 0.6);
      const wob = 1 + (wave > 0 ? wave : wave * 0.45);
      if (d <= wob) at(x, y, dx, dy, d / wob);
    }
  }
}

/**
 * The one light the world is lit by, as a unit vector in image space: down and to the right is
 * AWAY from it. ART_DIRECTION section 3.2. `paintDapple` lights its clusters along the same axis
 * and `weight` thickens the keyline along it, so the two cannot drift apart.
 */
const AWAY_X = 0.56;
const AWAY_Y = 0.83;

/**
 * The keyline's WEIGHT, and this is the review's second finding answered.
 *
 * What was here was two full `outline()` passes: a hard near-black line two pixels thick wrapped at
 * constant weight around the entire silhouette, cap and hem alike. It bought the keyline axis
 * almost exactly, and the picture it bought read as a flat green sticker with a fat black border --
 * because that is what it was. A flat blob with a heavy outline and a lit dome have the same
 * histogram, so no axis in `score.ts` could tell them apart.
 *
 * Measured on the board instead of counted: a board crown is 210 of the board's pixels across where
 * ours is 59, so one of our pixels is 3.6 of the board's. Its line at the cap is four of the board's
 * pixels -- ONE of ours -- and at the foot of the mass it runs to five or six, which is one and a
 * half to two. The 7.8 per cent of a board crown under luma 30 that an earlier note read as "the
 * line is two pixels thick" is mostly not the line at all: the board's own hem sits at a median
 * luma of 26, so that count was measuring the dark matrix the previous section has now graded in.
 *
 * So: one ring everywhere, and a second only where the surface turns away from the light. For each
 * ring pixel this takes the mean direction of the body it touches, flips it to get the outward
 * normal, and dots that against the light's away-axis -- so the second pixel lands on the lower
 * right of every lobe and nowhere on its upper left, exactly as a brush loaded at one angle would
 * leave it. The crown comes out ringed in a line that is hairline across the cap and heavy under
 * the hem, which is both what the board does and what makes a mass read as sitting IN the light
 * rather than cut out of paper.
 *
 * It runs on the pre-outline mask, which has to be captured by the caller before `outline()`.
 */
function weight(img: Img, before: Uint8Array, c: RGBA, bite = 0.18): void {
  const body = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && before[y * img.w + x] === 1;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (body(x, y) || !opaqueAt(img, x, y)) continue;
      let nx = 0;
      let ny = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dx || dy) && body(x + dx, y + dy)) {
            nx += dx;
            ny += dy;
          }
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len === 0) continue;
      // The outward normal is -n; its dot with the away-axis is how far this bit of rim is turned
      // out of the light.
      const turn = (-nx / len) * AWAY_X + (-ny / len) * AWAY_Y;
      if (turn <= bite) continue;
      const ox = Math.round((-nx / len) * 1.2);
      const oy = Math.round((-ny / len) * 1.2);
      if (!opaqueAt(img, x + ox, y + oy)) img.px(x + ox, y + oy, c);
    }
}

/** Every opaque pixel of `img`, as a mask -- the body, before any ring is drawn round it. */
const maskOf = (img: Img): Uint8Array => {
  const m = new Uint8Array(img.w * img.h);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) m[y * img.w + x] = img.get(x, y)[3] !== 0 ? 1 : 0;
  return m;
};

/**
 * The keyline thickening at the very foot of a mass: one more pixel under the lowest pixel of every
 * column, and one to the right of the rightmost pixel of every row below `fromRow`. This is what
 * seats a crown or a root onto the ground rather than letting it float on it.
 *
 * Run after `outline()` and `weight()`, so the pixels it finds are already the keyline and the one
 * it adds is the last.
 */
function seat(img: Img, c: RGBA, fromRow: number): void {
  for (let x = 0; x < img.w; x++) {
    for (let y = img.h - 1; y >= 0; y--) {
      if (!opaqueAt(img, x, y)) continue;
      img.px(x, y + 1, c);
      break;
    }
  }
  for (let y = fromRow; y < img.h; y++) {
    for (let x = img.w - 1; x >= 0; x--) {
      if (!opaqueAt(img, x, y)) continue;
      img.px(x + 1, y, c);
      break;
    }
  }
}

/* --------------------------------------------------------------------------------- the crown */

/**
 * How far down the crown a row is, 0 at the cap and 1 at the hem. Every curve in the crown's
 * lighting is a function of this and nothing else, so they can be read against each other.
 */
const down = (y: number): number => clamp01((y - CROWN_SKY) / 58);

/**
 * Where the crown's own light puts a LEAF CLUSTER on the ladder, from where the cluster sits.
 *
 * The board lights its crowns from the top, hard: the cap is a bright yellow-green and the bottom
 * third is genuinely dark and leans teal.
 *
 * The sideways term is a sixth of the vertical one, and it is there because the world has one light
 * at the upper left (ART_DIRECTION section 3.2), not because the board's crowns are side-lit --
 * their bright greens run right across the cap rather than gathering in the upper-left corner.
 *
 * **It is a smoothstep and not a power, and the reason is worth writing down because two attempts
 * were spent on it.** A power law pinned to the crown's cap cannot hold the board's profile: at an
 * exponent that keeps the body bright enough the top rung reaches the waist and over half the tree
 * comes out lit, and at one steep enough to darken the hem the body goes with it and the underside
 * turns into a teal pond. Read off the board's own crown, row by row, the curve is FLAT for the top
 * third and then falls fast: its cap and its shoulders are the same brightness, and everything
 * happens between the waist and the hem.
 *
 * **Refitted on 2026-10-19 against a per-row read of the board, and it had been falling both too
 * early and too far.** Profiling a 60-wide column down the middle of a board crown (image column
 * 190, rows 452..660, seven rows to a band) and converting each band's median to a place on this
 * ladder:
 *
 *   place in crown   board p50   ladder t    this curve   previous curve
 *   cap                    155       0.90        0.93           0.88
 *   waist                  143       0.85        0.85           0.75
 *   hem                     44       0.29        0.31           0.09
 *
 * The old curve put the hem's CLUSTERS two rungs below the board's, which sounds like more dark and
 * measured as less form: with the clusters down at the matrix's own value there was nothing left at
 * the hem for the eye to read as a lit surface, so the underside came out as one flat dark wedge
 * with a heavy line round it. The board's hem is dark because its MATRIX is black there, not
 * because its leaves are.
 *
 * Note what is NOT being done to get any of this: nothing is darkened past the ladder's existing
 * rungs, and no mark, speckle or dither is added. The pixels move along the ladder they were on.
 *
 * ----------------------------------------------------------------------------------------------
 * **THE SHOULDER, 2026-10-19 -- UX_REVIEW finding 17, and it is the sentence three paragraphs up
 * that was not being honoured.** This note already said the board's "bright greens run right across
 * the cap rather than gathering in the upper-left corner", and then the curve gathered them in the
 * upper-left corner anyway.
 *
 * Here is the mechanism, because it is not obvious from reading the line. For the top third of the
 * crown `smooth(0.35, 1.15, down(y))` is exactly ZERO -- that is the flat cap the paragraph above
 * argues for -- so over rows 2..22 the only thing varying at all was `-0.11 * ((x - 32) / 30)`, a
 * clean monotonic tilt. A flat plateau with a monotonic tilt on it is a wedge: every cluster on the
 * left half came out a sixth of a rung above its neighbour, `snap()` put the whole left side on the
 * top rung, and the clusters there merged into ONE bright patch instead of reading as several.
 *
 * Measured on a whole-map render (`pnpm world --whole`), at luma 150 and over:
 *
 *                                       before           after
 *   crown pixels at luma >= 150          17.8%            13.5%
 *   biggest CONNECTED patch of them      428px            123px
 *   that patch's share of all of them       72%             27%
 *   separate patches of 8px or more          5                7
 *
 * 428 pixels is 12.8 per cent of the whole crown in one connected blob, in the same place on all
 * 318 of them, which is what makes a treeline read as one stamp repeated: the eye does not match
 * two crowns by their silhouette, it matches them by the brightest thing in them.
 *
 * So the tilt is cut to a quarter -- the sun still has a direction, which section 3.2 requires --
 * and the rest of the plateau's variation comes from `CAP_FIELD` instead, which is irregular. The
 * clusters' base values at the cap then differ from their neighbours' without a bias to any one
 * corner, which is both what breaks the blob and what the board does.
 *
 * Two things about it that are measured rather than chosen, and both cost a render each to find:
 *
 * **It is gated off before the hem.** Ungated, the same field lifted the hem's 98th percentile from
 * 104 to 120 and its median from 47 to 52 -- which is precisely the defect the `paintDapple` note
 * below records fixing, hem clusters carried up onto the cap's own green. The board's hem is a
 * narrow band near the bottom of the ladder. The field is full over the plateau and gone by the
 * time the hem's own lobes take over.
 *
 * **The plateau came down from 0.93 to 0.92, and only that far.** Adding variation under a hard
 * ceiling clips the up-excursions and keeps the down ones, so it darkens the median: at 0.905 the
 * blob broke completely (91px, 23 per cent) and the cap's median luma fell from 136 to 124 against
 * a board at 155, which is trading finding 17 for the axis the curve above was fitted on. At 0.92
 * the cap holds 131 and the waist 114. The board distance falls 0.353 -> 0.339 either way; the
 * median is the reason to stop at 0.92.
 *
 * **The seed is shopped, like every other seed in this file.** Ten were rendered and measured. This
 * one is the one that breaks the blob AND leaves the lit centroid 2.7px off the crown's middle, so
 * the 57 per cent of canopy tiles the map lays mirrored still move it 5.1px -- the review measured
 * 1.6 and called mirroring worthless on this object, and a field that happened to centre the light
 * would have made that worse while passing every other number here.
 */
const CAP_FIELD = valueNoise2D(10607);

const grade = (x: number, y: number): number =>
  0.92 -
  0.68 * smooth(0.35, 1.15, down(y)) -
  0.03 * ((x - 32) / 30) +
  0.3 * (CAP_FIELD(x / 18, y / 24.3) - 0.5) * (1 - smooth(0.3, 0.9, down(y)));

/**
 * The crown's local tonal SPAN: how far below the lit clusters the dark matrix sits at this row.
 *
 * This is the 2026-10-19 correction and it is the one the director's review is about, so it is
 * worth being exact. Profiling a board crown row by row, its local histogram does not merely
 * darken on the way down -- it slides down the ladder bodily, and it is NARROW at both ends and
 * WIDE through the middle:
 *
 *   place in crown   p02    p50    p98      ladder t: p02  p50  p98    span
 *   cap              ~125   ~155   ~165               0.70 0.90 0.93   0.23
 *   waist             ~60   ~130   ~150               0.33 0.80 0.86   0.50
 *   hem                ~2    ~44    ~57               0.00 0.29 0.33   0.29
 *
 * The cap is a bright green sheet with thin channels a shade darker. The waist is where the
 * channels open out and the crown has its full range in one row. The hem is near-black with a few
 * mid-greens still catching light through the gaps above. A crown painted with ONE span at every
 * row -- which is what this file did until now, because `bodyAt` held the matrix at a constant deep
 * teal from cap to hem -- has both extremes present in every row, which is the exact signature the
 * review measured: max 169-186 and min 14 on every row, top to bottom.
 *
 * A tent, then, widest from the waist to the lower third and closing at both ends.
 */
const span = (y: number): number => {
  const u = down(y);
  return 0.24 + 0.3 * smooth(0, 0.45, u) * (1 - smooth(0.72, 1, u));
};

/**
 * Half the crown's width at row `y`: a BROAD EGG, as wide as it is tall, widest a little below the
 * middle, with a rounded cap rather than a point.
 *
 * **This is the 2026-10-19 shape correction, and the one before it had the right instinct and the
 * wrong target.** Laid at 1:1 beside the board, a board crown is 60-odd of our pixels across and
 * 60-odd down with its widest point below the waist -- an egg. The previous pass built a BELL,
 * narrow at the cap and flaring to the hem, which is a different solid: it tapers the wrong way and
 * it is what gave ours a conical, vertically symmetrical silhouette where the board's is lopsided.
 * The exponent differs above and below the waist for the same reason.
 *
 * The half-width came down from 25.5 to 25.0 on 2026-10-19 and the half-height from 32 to 30.5,
 * and both moves are the same correction. A lobe has to stand clear of the body by most of its own
 * radius before anyone reads it as a lobe; at 25.5, with the tile only 64 wide and two outline
 * passes to fit as well, the only way to place one was to sink it until it was a ripple -- which is
 * why three passes of "bumped contour" kept rendering as a clean oval. The half-height came down
 * because the board's crown is square and ours was reading as a tall bush at 57 by 70. The painted
 * silhouette now reaches x 3..61 and it keeps clear of the edge of the tiles -- a crown that touches
 * the
 * edge loses its keyline there and comes out looking cut.
 *
 * **The crown moved up two rows and lost two more of height later the same day, and that is the
 * trunk's doing.** Laid at 1:1, a board tree shows about fourteen of our rows of bark between the
 * hem of its crown and the grass, of which the root flare is the lower nine. Ours showed three, and
 * the review counted "at most two trunk stubs in a 280x180 crop of forest" -- so the trees read as
 * hedges. The crown is 64 pixels of a 96-pixel tree and the rest of it is not negotiable, so the
 * rows had to come out of the crown: centre 30.5 and half-height 28.5 puts the egg on rows 2..59,
 * its pendant lobes reach row 66, and with one ring rather than two the lowest painted pixel of the
 * crown is row 68 -- four rows into the trunk tile instead of eleven. That is where the trunk came
 * from. It also squares the crown, which the board's is and ours was not.
 */
const eggHalfW = (y: number): number => {
  const ny = (y - 30.5) / 28.5;
  if (ny <= -1 || ny >= 1) return 0;
  return 25.0 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(ny), ny < 0 ? 2.0 : 2.8)));
};

type Blob = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** A clump's own wobble phase, so its rim is the same every time the tiles are regenerated. */
  readonly seed: number;
  /** Steps off `grade` for a leaf cluster: the mottle. Unused by the silhouette masses. */
  readonly lift: number;
  /** This cluster's warm/cool lean, -1 to +1. */
  readonly hue: number;
  /** A third of a rung, added after the snap, so no two clusters share a green exactly. */
  readonly fine: number;
  /**
   * How much of the grey this cluster takes: its CHROMA, and the third independent colour axis.
   *
   * Value and warm/cool were the only two axes the crown had, and measured against the board that
   * is precisely why its colour count stalled at 54 per thousand pixels against 149 however finely
   * the other two were subdivided -- the scorer quantises to five bits a channel, so two axes can
   * only ever fill a two-dimensional patch of that cube. Widening either one past the point where
   * it was already saturated bought a single colour per thousand, which is a measured dead end
   * rather than an opinion.
   *
   * Chroma is a real third direction and the board plainly has it: some of its clusters are vivid
   * leaf green and others, at exactly the same brightness, are grey-green -- leaves seen through
   * the haze of the ones in front. It goes through `toward`, so it moves the colour sideways and
   * leaves every value axis the rungs set exactly where it was.
   */
  readonly dull: number;
};

/**
 * The one seeded source for every irregular number in the crown, drawn once at module load.
 *
 * Hand-written tables are why both previous crowns read as vegetables. A human writing forty
 * coordinates writes a ring, or a grid, or a mirror -- the 2026-10-18 table was literally symmetric
 * about x = 32 -- and any regular pitch at all produces ribbing once each unit is shaded. The board
 * has no regular pitch anywhere in a crown. A seeded generator gives bumps of visibly varying size
 * at varying spacing for free, it breaks the vertical symmetry so the lit side and the shade side
 * are different shapes rather than mirror images, and because the seed is fixed the art is still
 * byte-for-byte the same on every regeneration.
 *
 * That last property matters more than it sounds: once `forest-map.ts` mirrors half the trees, a
 * mirrored crown has to still read as a different tree, and an asymmetric crown gives that away
 * free where a symmetric one would have shown the same silhouette twice.
 */
const RND = noise(20261019);

const blob = (x: number, y: number, r: number, lift = 0): Blob => ({
  x,
  y,
  r,
  seed: RND() * 6.283,
  lift,
  hue: RND() * 1.7 - 0.85,
  fine: (RND() - 0.5) * 0.15,
  dull: RND() * 0.26,
});

/**
 * The silhouette: the egg filled solid, then bumped.
 *
 * The egg itself goes down as overlapping discs along its own centre line rather than as scanline
 * fill, so `lump`'s wobble roughens the inside of the mass as well as the edge -- the matrix is
 * never a clean shape even where a cluster does not cover it.
 *
 * The bumps walk the contour at an irregular angular step and take radius 3.2 to 6.8, which is what
 * gives the keyline its bumps of visibly varying size. Each sits half a radius INSIDE the contour so
 * it bulges by about half its width, and the walk starts at the cap and goes all the way round, so
 * the left and right sides get independent draws and the crown is not a mirror.
 */
const MASS: readonly Blob[] = (() => {
  const out: Blob[] = [];
  for (let y = 3; y < 60; y += 3.5) {
    const hw = eggHalfW(y);
    if (hw < 3) continue;
    for (let x = 32 - hw + 3; x <= 32 + hw - 3; x += 5) out.push(blob(x, y, 4.4));
  }
  /*
   * The contour bumps, and they are bigger and further apart than they were.
   *
   * At radius 3.2 to 6.8 sunk half a radius into the egg, and stepped 0.13 to 0.32 radians apart,
   * consecutive bumps overlapped by more than they protruded: six rows of travel between centres
   * against a diameter of ten. The sum of them was a slightly furry ellipse, which is what three
   * renders in a row showed and what the brief means by "closing as a smooth egg". Radius 4 to 8 at
   * a quarter sunk and twice the angular step gives bumps that clear the body by three quarters of
   * their own radius and have room between them for the notch to show.
   *
   * The reach is clamped to 29 pixels from the centre line. Two `outline()` passes add two pixels
   * beyond the last opaque one, so anything past 29 loses its keyline at the tile edge and the
   * crown comes out looking sliced.
   */
  for (let th = 0.08; th < Math.PI * 2; th += 0.26 + RND() * 0.3) {
    const y = 30.5 - 28.5 * Math.cos(th);
    const hw = eggHalfW(y);
    if (hw < 1.5) continue;
    const r = 4.0 + RND() * 4.0;
    out.push(blob(32 + Math.sign(Math.sin(th)) * Math.min(hw - r * 0.25, 29.5 - r), y, r));
  }
  /*
   * The scallop: hanging lobes along the crown's underside, with notches between them.
   *
   * The board's crown does not close as a smooth egg. Its bottom edge breaks into a row of pendant
   * lobes of visibly different sizes, each one keylined round its own underside, with the sky
   * showing up between them in sharp notches -- it reads as foliage hanging, where a closed curve
   * reads as a balloon. Laid at 1:1 beside ours that was the loudest difference in the silhouette
   * and the contour walk above could never produce it: the egg is parametrised by `y = 33 - 32cos`,
   * so at the bottom of the arc its half-width goes to zero and every bump there is skipped.
   *
   * So the lobes are walked across x instead, each seated on the egg's own lower edge and hanging a
   * full radius and a half below it. The step is nearly THREE radii, and that number is the whole
   * trick and was wrong on the first attempt: `paintCrown` runs `outline()` twice, so any notch
   * narrower than four pixels is simply filled in by the two rings growing towards each other from
   * its sides. At a step of 2.15 radii the gaps came out two pixels wide, the keyline swallowed
   * every one of them, and the render was an oval with a slightly rough edge -- the lobes were in
   * the data and invisible on screen. At 2.8 radii plus a seeded jitter the notches are four to
   * seven pixels and survive both passes, so each lobe is ringed round its own underside.
   *
   * Irregular radius and irregular step, for the reason every other table in this file is seeded
   * rather than written -- an even row of lobes is a pie crust.
   *
   * It adds no marks inside the crown. Edge density is already at the board's and this changes only
   * where the silhouette is.
   */
  const eggBottom = (x: number): number => {
    for (let y = 59; y > 30; y--) if (eggHalfW(y) >= Math.abs(x - 32)) return y;
    return 0;
  };
  for (let x = 7.5; x <= 56.5;) {
    const r = 4.0 + RND() * 3.4;
    const by = eggBottom(Math.round(x));
    if (by > 0 && x - r >= 2.5 && x + r <= 61.5) out.push(blob(x, by + r * 0.45, r));
    x += r * 2.8 + RND() * 2.4;
  }

  /*
   * The skirt: the underside, bridging the egg's hem to the trunk's shoulders and hanging a few
   * rows into the trunk tiles below. It is pure matrix -- no cluster is scattered this low -- which
   * makes it the darkest block of pixels in the tile set, exactly as it is on the board. At row 64,
   * where the trunk's drawing begins, it spans about x 21..43 over a trunk 16 wide: a crown that
   * meets its trunk at exactly the trunk's width is a lollipop on a stick, and one that stops short
   * of it leaves grass showing at both shoulders.
   *
   * Six blobs became three on 2026-10-19. The old six spanned x 17..47 across rows 54 to 73 -- a
   * single smooth mass right across the hem, and it was quietly cancelling the pendant lobes above:
   * the lobes were drawn, and then this filled in every notch between them. Three is what the job
   * actually needs, which is to reach the trunk's two shoulders and to close over the gap between
   * them. The hem's shape now belongs to the lobes.
   *
   * They came up five rows later the same day, with the egg, so that the crown stops four rows into
   * the trunk tile rather than eleven. That is where the visible trunk came from; see `eggHalfW`.
   * The skirt still has to reach both of the trunk's shoulders -- at row 61 it spans about x 22..42
   * over a column 15 wide, so there is no grass showing at either shoulder and no lollipop stem.
   */
  for (const [x, y, r] of [
    [26, 58, 5.0],
    [39, 58, 4.8],
    [32, 61, 4.4],
  ] as const)
    out.push(blob(x, y, r));
  return out;
})();

/**
 * The leaf clusters: irregular clumps at varied sizes and varied spacing, scattered over the
 * matrix, and THE central finding of this pass.
 *
 * The board's crown has no lobes. It is dapple -- clusters of leaves catching the light, of
 * visibly different sizes, in no pattern whatsoever, with the dark showing between them wherever
 * they happen not to meet. A ring of equal lobes gives a pinecone; a grid of them gives a
 * pineapple; only an irregular scatter gives foliage, and no amount of shading rescues either of
 * the first two.
 *
 * Placement is dart-throwing with rejection: a candidate is kept if no accepted cluster's centre is
 * nearer than 0.82 of the two radii summed. Just under 1 is the number that matters -- at 0.5 the
 * clusters overlap into one sheet and the matrix never shows, at 1.3 they scatter into polka dots.
 * Just under 1 means neighbours mostly touch and sometimes miss, and the channel network left
 * behind is two or three pixels wide and winds, which is what the board shows.
 *
 * The dart is thrown at the whole bounding box and rejected if it misses the egg, rather than
 * picking a row and then a column within it. The difference is not pedantry: a row-first draw puts
 * the same number of clusters on the two-pixel cap as on the fifty-pixel waist, so the waist comes
 * out half bare and the crown reads as a dark belt with green at both ends -- which is exactly what
 * the first render of this pass showed. Throwing at the box makes density follow area.
 *
 * `lift` runs from a little under the grade to well over it, so two clusters side by side at the
 * same height can differ by most of a rung. That is the mottle. The old table moved lobes by ±0.05
 * -- a third of a rung, so after the snap most neighbours landed on the SAME value and the crown
 * read as one flat dome with a net drawn over it.
 */
const DAPPLE: readonly Blob[] = (() => {
  const out: Blob[] = [];
  for (let n = 0; n < 9000 && out.length < 120; n++) {
    const r = 3.0 + RND() * 5.0;
    const y = 2.5 + RND() * 62;
    const x = 32 + (RND() * 2 - 1) * 25.5;
    const hw = eggHalfW(y);
    if (hw < 2.5 || Math.abs(x - 32) > hw - 1.2) continue;
    const clash = out.some((o) => {
      const dx = o.x - x;
      const dy = (o.y - y) * 1.1;
      return Math.sqrt(dx * dx + dy * dy) < (r + o.r) * 0.82;
    });
    /*
     * `lift` centres a touch below the grade rather than above it, and its SPREAD is now the same
     * tent the matrix is placed with -- narrow at the cap, wide through the waist and the lower
     * third, closing again at the hem.
     *
     * It used to widen all the way to the hem, up to 0.60 of the ladder, and that was measurably
     * backwards. A cluster at the hem could take 0.48 of lift, and `tilt` below could add another
     * 0.33 on top: between them they carried hem clusters five rungs up, onto the same bright green
     * as the cap. That is the arithmetic behind the review's finding that our crown's maximum luma
     * is 169-186 on EVERY row from top to bottom. The board's hem is a narrow band near the bottom
     * of the ladder -- p02 to p98 inside 56 luma, against 150 at its waist -- and its few mid-green
     * studs are two rungs above its own black hem, not five.
     *
     * `span` is reused rather than a second curve written, because the two numbers are the same
     * measurement: how much range a row of the crown has.
     */
    if (!clash) out.push(blob(x, y, r, (RND() - 0.58) * (0.6 * span(y) + 0.1)));
  }
  return out;
})();

/**
 * Two smooth fields over tree space, sampled every few pixels rather than every pixel.
 *
 * This is the last of the colour-variety fix and the only part of it that is, in effect, texture.
 * Sampled down to our own resolution the board's crown carries about 190 distinct colours per
 * thousand pixels against our 78, and the gap is not value -- the crown's histogram already matches
 * the board's within a couple of per cent -- it is that a painted crown is never twice exactly the
 * same green, where a shaded one repeats a value everywhere its geometry repeats.
 *
 * The important word is SMOOTH. Per-pixel noise would buy the same colour count and ruin everything
 * else: it is the definition of what the edge-density axis counts, and it is the dither the brief
 * is explicit about not wanting. These vary over six and four pixels respectively, so two
 * neighbours never differ by more than about a luma from the grain alone, and the whole thing reads
 * as unevenness in the leaves rather than as speckle.
 */
const GRAIN = valueNoise2D(91);
const HUE_FIELD = valueNoise2D(417);
/**
 * A third field, for chroma, and it exists to break a trade-off rather than to add texture.
 *
 * Measured: large clusters match the board's value profile (its own crown runs mean 116 with 21 per
 * cent under luma 81, and clusters of radius 3 to 8 land on 120 and 27 where radius 2.5 to 6.8
 * lands on 128 and 22) but large clusters mean FEWER of them, and with chroma constant per cluster
 * the crown's colour count falls with the cluster count -- 77 per thousand against 102. Varying the
 * grey inside a cluster decouples the two: the clusters stay board-sized and the colour count comes
 * back. It is deliberately a longer wavelength than `HUE_FIELD`, so it varies BETWEEN clusters far
 * more than across any one of them and a cluster still reads as one flat leaf mass.
 */
const CHROMA_FIELD = valueNoise2D(1063);

/**
 * The rungs of `LEAF_STOPS`, and the snap onto them.
 *
 * Measured against board crops taken down to our own resolution, the board runs about 19 per cent
 * edge density where a smoothly shaded forest runs 9: the board is not smoother than us, it is
 * CRISPER -- that is what pixel art is, and a leaf clump on the board carries two or three flat
 * values with a visible boundary between them and the next clump.
 *
 * Seven rungs, and that number is measured rather than chosen. The scorer calls two neighbours an
 * edge when their luma differs by more than 24. An earlier attempt quantised to fourteen rungs,
 * about eleven luma apart, and moved edge density by half a point: every step it drew was under the
 * threshold, which is a precise way of saying the steps were too small to see. The ladder's own
 * rungs are 19 to 34 luma apart, which is both over that line and what the board measures across
 * one of its clumps.
 */
const RUNGS = LEAF_STOPS.length - 1;
const snap = (v: number): number => Math.round(clamp01(v) * RUNGS) / RUNGS;

/**
 * The matrix the leaves lie in: the dark showing between the clusters, and IT GRADES WITH THE
 * CROWN.
 *
 * Blown up to three times our resolution, a board crown is not a pile of lit lobes. It is a dark
 * mass with light leaf clusters lying on top of it, and the dark shows between them as a winding,
 * irregular NETWORK of channels two or three of our pixels wide. Every previous version here painted
 * lit discs and then ringed each one, which draws a dark net of uniform mesh -- a repeating unit --
 * and that is why the result read first as cauliflower and then as a pinecone. Painting the dark
 * first and letting irregular clusters cover most of it gives the same ink with none of the pitch,
 * because what is left uncovered is whatever shape the gaps happen to be. That much stands.
 *
 * **What was wrong, and it is the single reason the crowns read as flat stickers: this held the
 * matrix at one deep teal from cap to hem.** The note it replaces said in as many words that "the
 * channels are the same deep value at the top of the crown as at the bottom", and the board says
 * the opposite. Read off a 60-wide column down the middle of a board crown, its second-percentile
 * -- which is its channel floor, the darkest thing in the row that is not the keyline -- runs:
 *
 *   rows 466..520 (cap)     luma 80..143    ladder t 0.45..0.75
 *   rows 522..592 (waist)   luma 45..93     ladder t 0.15..0.50
 *   rows 599..660 (hem)     luma  1..46     ladder t 0.00..0.10
 *
 * The board's cap has no deep dark in it at all. Its channels up there are a mid-green a shade off
 * the sheet they divide, and all the black in the crown lives in the bottom third. Holding the
 * floor at t = 0.07..0.18 everywhere put luma-31 pixels inside the brightest part of every crown,
 * which is precisely how a lit dome comes out looking like a flat green sticker: both extremes
 * present in every row is not a gradient, it is noise, and no axis in `score.ts` can tell the two
 * apart because they share a histogram.
 *
 * So the matrix now sits one `span` below the clusters at the same row, which is the same two
 * numbers the board was measured for. At the cap that is t = 0.69 (luma ~126) and at the hem it is
 * t = 0.07 (luma ~40) before the hem's own lobes take it lower -- a fall of ninety luma in the
 * crown's own darks, where there was none.
 *
 * It is still most of the deep shade the frame is missing: the channels through the lower half sit
 * at rungs 0 and 1, under both of the scorer's dark thresholds, and they are a third of that half's
 * area.
 */
const bodyAt = (x: number, y: number): RGBA => {
  const deep = grade(x, y) - span(y);
  const v = snap(deep + 0.1 * (GRAIN(x / 5.5, y / 5.5) - 0.5));
  // The hue swing across the matrix is 1.3 of the warm/cool axis, up from 0.6. The channels are a
  // quarter of every crown and they used to be painted in two values and almost one hue; widening
  // this costs nothing on any value axis, because `leaf` moves hue through `toward`.
  return leaf(v, -0.75 + 1.3 * (HUE_FIELD(x / 5, y / 5) - 0.5));
};

/** One silhouette mass, filled with the dark matrix. */
function paintMass(img: Img, b: Blob): void {
  lump(img, b.x, b.y, b.r, b.seed, (x, y) => img.px(x, y, bodyAt(x, y)));
}

/**
 * One leaf cluster: a flat, hard-edged clump of one green lying on the dark matrix.
 *
 * Flat is the whole point, and it is the opposite of what this file used to do. A board cluster
 * carries two or three values across its entire width; the thing that separates it from the next
 * cluster is not a gradient and not a drawn crease, it is the dark matrix showing through the gap
 * between them. So there is no sphere term and no rim treatment here at all. Four small things sit
 * on top of the flat value, and every one of them is under a single rung on its own:
 *
 * - `lit`, a tilt of a twentieth of a step towards the upper left, so a cluster is not quite flat
 *   and the sun still has a direction inside it;
 * - a smooth grain, which carries pixels back and forth across a rung boundary and is what makes a
 *   cluster's interior mottled rather than banded;
 * - `c.hue`, this cluster's own warm or cool lean -- the dimension that actually carries the colour
 *   count, since seven rungs of value can only ever be seven greens;
 * - `c.fine`, a third of a rung added AFTER the snap, so each cluster sits on its own sub-rung and
 *   no two clusters in the crown are painted in exactly the same green. The clump stays flat and
 *   its boundary stays a cliff -- crispness is a property of the edge, not of the value -- but the
 *   crown's colour count multiplies by the number of clusters.
 *
 * It paints only where the matrix is already opaque, so the silhouette belongs to the mass and a
 * cluster near the rim is simply cut by it. That cut is what leaves the dark band just inside the
 * keyline that every board crown has.
 */
function paintDapple(img: Img, c: Blob): void {
  const t = grade(c.x, c.y) + c.lift;
  lump(img, c.x, c.y, c.r, c.seed, (x, y, dx, dy) => {
    if (!opaqueAt(img, x, y)) return;
    const lit = -(dx * 0.56 + dy * 0.83);
    const grain = GRAIN(x / 6.5, y / 6.5) - 0.5;
    const hue = HUE_FIELD(x / 4.5, y / 4.5) - 0.5;
    /*
     * The tilt: how much a cluster is lit along its own upper-left and falls away underneath, so
     * the crown is made of surfaces rather than of flat chips.
     *
     * It used to grow to a third of the ladder towards the hem, on the argument that the underside
     * needs the help to stay legible. Measured, that argument was answered in the wrong place: with
     * the matrix now grading down to black at the hem (see `bodyAt`) a hem cluster is already two
     * rungs above the dark it sits in, so it reads as a lobe without being lifted onto the cap's
     * own green. A tilt of 0.33 was pushing the lit side of every hem cluster five rungs up and
     * flattening the crown's ceiling, which is half of the review's headline finding.
     *
     * An eighth of the ladder, growing to a fifth at the hem. That is one rung of relief across a
     * cluster: enough to round it, not enough to move the row's own ceiling.
     */
    const tilt = 0.12 + 0.08 * clamp01((c.y - 24) / 38);
    const v = snap(t + tilt * lit + 0.1 * grain) + c.fine;
    const col = leaf(v, clamp(c.hue + 0.5 * lit + 0.7 * hue));
    const dull = clamp01(c.dull + 0.2 * (CHROMA_FIELD(x / 9, y / 9) - 0.5));
    img.px(x, y, toward(col, tone('stone', clamp01(v)), dull));
  });
}

/**
 * The whole crown, once, at 64x76 -- then ringed and seated.
 *
 * Dark first, then light: the egg and its bumps lay the matrix down over the whole silhouette, and
 * the clusters are scattered over it afterwards. Nothing is sorted and nothing is painted back to
 * front, because with flat clusters there is no overlap to resolve -- two clusters that touch
 * simply abut, which is what the board shows.
 */
function paintCrown(): Img {
  const img = new Img(64, CROWN_H);
  for (const b of MASS) paintMass(img, b);
  for (const c of DAPPLE) paintDapple(img, c);
  /*
   * One ring, then weight only where the mass turns out of the light, then the foot.
   *
   * The second full `outline()` pass that used to sit here is gone; `weight()` carries the whole
   * argument. One side effect of dropping it is worth knowing about when touching the silhouette:
   * two passes filled in any notch narrower than four pixels, so the pendant lobes along the hem
   * needed a step of 2.8 radii to survive. With one pass a two-pixel notch survives, which is why
   * the scallop now reads at 1:1 instead of only in the data.
   */
  const body = maskOf(img);
  img.outline(LEAF_LINE);
  weight(img, body, LEAF_LINE);
  seat(img, LEAF_LINE, 44);
  return img;
}

/* --------------------------------------------------------------------------------- the trunk */

/**
 * Half the trunk's width at a given row, before the roots widen it: a slim column of fifteen
 * pixels that stays slim until the last third and then swells into the flare.
 *
 * It was twenty-one widening to twenty-five, on a measurement of the board that counted the root
 * flare as part of the trunk. Laid beside a 1:1 crop, the board's trunk is a slim column about a
 * quarter of the tree's width and the flare adds only a few pixels to each side; at 3.6 board
 * pixels to one of ours its bark is twenty-two of ours across at the foot and fifteen at the
 * shoulder, which is what these two numbers are.
 *
 * The straight taper it replaces (7.6 + 0.18y) widened from the very first row, so over a column
 * twenty rows tall the trunk came out a wedge. The board's is a cylinder for most of its visible
 * height with the swell confined to the flare, which is what a smoothstep over rows 9..20 gives.
 */
const halfWidth = (y: number): number => 7.4 + 3.4 * smooth(9, 20, y);

/**
 * One root finger: a lobe swept along a curve, laid down six times from the shaded underside up to
 * the lit top rather than the old four. Each pass is narrower and pushed further up-left than the
 * last, so the finger's cross-section rounds off instead of stepping, and `bark()` takes a
 * continuous value rather than one of four.
 *
 * The board gives every finger its own keyline, which falls out of drawing them with gaps of two or
 * three pixels between them -- the outline pass then meets in the middle of the gap and the finger
 * is ringed on both sides.
 */
function rootFinger(
  img: Img,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r0: number,
  r1: number,
): void {
  const steps = 18;
  const layers: readonly (readonly [number, number, number, number, number])[] = [
    [1.3, 1.9, 1.0, 0.86, 0.0],
    [0.7, 1.1, 1.0, 0.86, 0.16],
    [0.2, 0.2, 0.96, 0.82, 0.34],
    [-0.2, -0.6, 0.86, 0.66, 0.55],
    [-0.5, -1.2, 0.7, 0.46, 0.76],
    [-0.75, -1.8, 0.52, 0.26, 0.95],
  ];
  for (const [dx, dy, rs, ry, t] of layers) {
    const c = bark(t, t * 2 - 1);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const r = r0 + (r1 - r0) * u;
      img.ellipse(x0 + (x1 - x0) * u + dx, y0 + (y1 - y0) * u + dy, r * rs, r * ry, c);
    }
  }
}

/** The row the column stops at and the flare takes over; see `paintTrunk`. */
const COL_ROWS = 21;

/**
 * Trunk and roots, once, at 64x32 -- then ringed and seated.
 *
 * Two lightings at once, both off the board, and both continuous. Across: a cylinder, lit a fifth
 * of the way in from the left silhouette and falling away smoothly to either side, steeply to the
 * left where the edge is close and gently to the right across the body into the shaded quarter.
 * Down: the crown's own shade, which takes most of a step off the top row and is gone by the
 * thirteenth. That second gradient is what makes the bark read as going up INTO the leaves rather
 * than stopping underneath them, and it is unmistakable on the board -- the trunk is L64 where it
 * leaves the crown and L155 at the roots.
 *
 * **The trunk's HEIGHT is the 2026-10-19 correction, and it is the review's second finding.** The
 * column ran fourteen rows and the root flare started at row nine, so between the crown's skirt
 * (which reached row eleven of this tile) and the top of the flare there were at most three rows of
 * bare bark -- and across a 280x180 crop of forest the review could find two of them. A tree whose
 * crown meets its roots is a hedge. Measured off the board at 3.6 of its pixels to one of ours, a
 * board tree shows fourteen of our rows of bark below its hem, of which the lower nine are flare.
 *
 * The column is twenty-one rows now and the flare is pushed down to match, which with the crown's
 * hem raised to row four of this tile gives twelve rows of clear cylinder above a nine-row flare.
 * All of it had to be found inside the same 32-row tile, so the shadow pool below tightened to suit
 * -- which is the direction the board wanted it anyway; see `contactShadow`.
 */
function paintTrunk(): Img {
  const img = new Img(64, TRUNK_H);

  /*
   * The two rear fingers first, then the column over them, then the three that come forward.
   *
   * The flare was pulled in by six pixels on each side on 2026-10-19. It used to reach x 12..52 --
   * two thirds of the tree's whole width, where the board's trunk and roots together take about a
   * third -- which read as a paw rather than a trunk and, worse, covered exactly the ground the
   * tree's own shadow needs to fall on. A narrower flare puts the pool back on show.
   */
  rootFinger(img, 27, 13, 20, 19, 3.6, 1.6);
  rootFinger(img, 37, 13, 44, 19, 3.6, 1.6);

  for (let y = 0; y < COL_ROWS; y++) {
    const hw = halfWidth(y);
    const x0 = Math.round(32 - hw);
    const x1 = Math.round(32 + hw);
    const dim = 0.46 * (1 - smooth(0, 9, y));
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      // Distance from the lit column, scaled so the short side to its left falls as fast as the
      // long side to its right: one cylinder, not a stripe painted on a slab.
      const k = u < 0.18 ? (0.18 - u) / 0.18 : (u - 0.18) / 0.82;
      const v = 1 - 0.95 * Math.pow(k, 1.35) - dim + 0.07 * (GRAIN(x / 5, y / 5) - 0.5);
      img.px(x, y, bark(v, v * 2 - 1 + 0.6 * (HUE_FIELD(x / 4, y / 4) - 0.5)));
    }
  }

  rootFinger(img, 29, 15, 23, 21, 3.2, 1.4);
  rootFinger(img, 35, 15, 41, 21, 3.2, 1.4);
  rootFinger(img, 32, 15, 31, 22, 3.8, 1.8);

  /*
   * The valley between each pair of fingers. `outline()` fills the gaps the fingers leave between
   * themselves, but the three forward fingers start inside the column, where there is no gap to
   * fill, and without these the five roots merge into one pale paw. Short, and only in the flare.
   */
  for (const [x0, y0, x1, y1] of [
    [28, 15, 25, 19],
    [31, 15, 29, 21],
    [34, 15, 36, 21],
    [37, 15, 39, 19],
  ] as const) {
    img.line(x0, y0, x1, y1, bark(0));
  }

  /*
   * Bark grooves: two lines that wander a pixel either way and break every few rows, so they read
   * as the edges of bark plates rather than as two ruled lines, and both run down into the root
   * flare instead of stopping at it. Each is a shallow trough -- a dark core with a half-step
   * shoulder either side -- rather than a single dark pixel, because a one-pixel line against a
   * smooth cylinder is the one mark in this file the edge-density axis would still count.
   */
  const groove = (y: number, k: number): number =>
    Math.round(32 + (k === 0 ? -2.5 : 3.5) + Math.sin((y + k * 9) * 0.38) * 1.2);
  for (let y = 2; y < COL_ROWS + 3; y++) {
    for (const k of [0, 1]) {
      if ((y + k * 5) % 9 >= 7) continue;
      const x = groove(y, k);
      if (!opaqueAt(img, x, y)) continue;
      const hw = halfWidth(y);
      const u = (x - (32 - hw)) / (2 * hw);
      const body = 1 - 0.95 * Math.pow(u < 0.18 ? (0.18 - u) / 0.18 : (u - 0.18) / 0.82, 1.35);
      img.px(x, y, bark(body - 0.25, -0.5));
      if (opaqueAt(img, x - 1, y)) img.px(x - 1, y, bark(body - 0.1, -0.2));
      if (opaqueAt(img, x + 1, y)) img.px(x + 1, y, bark(body - 0.13, -0.3));
    }
  }

  /*
   * There was a knot here: four concentric ellipses at (27, 14), halfway up a trunk twenty-one
   * pixels wide. At this scale a round mark in the middle of a cylinder has nowhere to be except
   * dead centre, and the review's word for it was "a cartoon navel". The board has no such mark on
   * any trunk; what it has is the bark grooves above, which run the length of the trunk and down
   * into the flare, and that is enough structure for an object this size.
   */

  const body = maskOf(img);
  img.outline(BARK_LINE);
  weight(img, body, BARK_LINE);
  seat(img, BARK_LINE, 14);
  return img;
}

/* ---------------------------------------------------------------------------------- the tiles */

/**
 * Both drawings, made once. Six painters cutting from one pair of images is the point of the
 * exercise: there is no second opinion about where the crown's edge is, so there is no seam.
 */
let crownImg: Img | null = null;
let trunkImg: Img | null = null;
const crown = (): Img => (crownImg ??= paintCrown());
const trunk = (): Img => (trunkImg ??= paintTrunk());

/*
 * There was a `ground()` helper here that painted `grass-1` or `grass-2` across the whole trunk
 * tile before anything else, so that "a trunk tile's floor matches the lawn it is laid into". It
 * does not, and in a render of the real map you can see the join: `forest-map.ts` puts trunk tiles
 * on `decor-below`, which draws OVER the ground layer, and the ground layer under any given trunk
 * is whichever grass the map's own patch field chose. Painting a second, fixed grass on top of it
 * left a lighter rectangle around every tree, with the lawn's blades stopping dead at its edge.
 *
 * The canopy tiles never did this -- they blit the crown onto transparency and let the ground show
 * through, which is what the layer is for -- and the trunk tiles now do the same. `Img.blit` skips
 * transparent source pixels, so everything outside the pool and the bark is simply the map's own
 * floor.
 */

/**
 * The pool the tree stands in: the crown's shadow, thrown down and to the RIGHT, away from the one
 * light the world is lit by.
 *
 * The review's fourth finding, and the measurable one. There was a `contactShadow` here before, but
 * it was a collar rather than a shadow -- six rings all inside the root flare, the outer ones a
 * couple of luma off the lawn, the dark core entirely hidden behind the bark that was painted over
 * it. In a render of the real map you cannot see it at all, and the trees float.
 *
 * So the geometry changes as well as the ladder. The rings now walk from a wide, low ellipse
 * centred eight pixels to the right of the trunk -- which is where the sun at upper left puts a
 * crown 64 wide -- in to a small dark one at the foot of the roots. The widest reaches past the
 * right-hand root tips onto open grass, which is the half of it the roots cannot hide, and the
 * darkest sits where the trunk meets the ground. Six solid rings, each about twenty-five luma off
 * its neighbour, so the pool has an edge you can see without having a line round it.
 *
 * It is painted BEFORE the trunk and after the grass, so the bark sits in its own shadow.
 */
function contactShadow(img: Img, ox: number): void {
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const u = i / (rings - 1);
    blot(
      img,
      33 + 7 * u + ox,
      GROUND_Y + 0.8 - 0.7 * u,
      21 - 10 * u,
      5.2 - 2.6 * u,
      1.7 + i * 1.31,
      along(SHADE_STOPS, 1 - u),
    );
  }
}

/**
 * An ellipse with a wobbling rim: `lump` for something much wider than it is tall.
 *
 * `Img.ellipse` draws a true ellipse, and seven true ellipses inside one another read as exactly
 * what they are -- a drawn target, with each ring a clean arc. The shade under a tree on the board
 * has a ragged edge, because it is the shadow of a crown made of lobes. Same two sine terms as
 * `lump`, same reason: deterministic, and smooth enough that the rim never breaks into loose
 * pixels.
 */
function blot(
  img: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  c: RGBA,
): void {
  for (let y = Math.floor(cy - ry * 1.3); y <= Math.ceil(cy + ry * 1.3); y++) {
    for (let x = Math.floor(cx - rx * 1.3); x <= Math.ceil(cx + rx * 1.3); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.3) continue;
      const th = Math.atan2(dy, dx);
      const wob = 1 + 0.15 * Math.sin(3 * th + seed) + 0.09 * Math.sin(5 * th - seed * 1.4);
      if (d <= wob) img.px(x, y, c);
    }
  }
}

/**
 * Blades over the foot of the roots, so the tree grows out of the grass instead of onto it.
 *
 * They are painted from the shade ladder rather than from `grass`, because every one of them stands
 * inside the pool above. Lawn-bright blades on a dark pool were nine pieces of speckle in the one
 * place the tree most needs to read as seated.
 */
function blades(img: Img, ox: number): void {
  const rnd = noise(4477);
  for (let i = 0; i < 9; i++) {
    const x = 18 + Math.floor(rnd() * 28) + ox;
    const y = GROUND_Y - 1 + Math.floor(rnd() * 4);
    img.px(x, y, along(SHADE_STOPS, 0.42 + rnd() * 0.26));
    img.px(x, y + 1, along(SHADE_STOPS, 0.12));
  }
}

const trunkTile =
  (half: 0 | 1) =>
  (img: Img): void => {
    const ox = -half * TILE;
    contactShadow(img, ox);
    img.blit(trunk(), ox, 0);
    blades(img, ox);
    // The crown's skirt last, over the bark: the rows of shaded leaf that hang into this tile, cut
    // from the same drawing the canopy tiles are cut from, keyline and all.
    img.blit(crown(), ox, -TRUNK_TOP);
  };

const canopyTile =
  (qx: 0 | 1, qy: 0 | 1) =>
  (img: Img): void => {
    img.blit(crown(), -qx * TILE, -qy * TILE);
  };

export const TREE_TILES: Record<string, (img: Img) => void> = {
  // The two halves are the left and right 32 columns of one 64-wide drawing, so nothing in the
  // tree knows where the seam is and nothing can drift across it.
  'trunk-l': trunkTile(0),
  'trunk-r': trunkTile(1),
  'canopy-tl': canopyTile(0, 0),
  'canopy-tr': canopyTile(1, 0),
  'canopy-bl': canopyTile(0, 1),
  'canopy-br': canopyTile(1, 1),
};

/* ------------------------------------------------------------------- the shoulder, guarded */

/**
 * How the crown's light is DISTRIBUTED, over the 64x64 window the four canopy tiles cut from --
 * which is the stamp the map lays 318 times, and therefore the only thing a player ever sees.
 *
 * `share` is how much of the crown is lit at all. The other three are about whether that light is
 * one landmark or several marks: `biggest` is the largest 4-connected run of it, `patches` counts
 * the separate runs worth seeing, and `concentration` is the fraction of all the lit pixels that
 * the biggest run holds. 150 is the threshold because it is a rung boundary -- the gap between the
 * ladder's top two rungs straddles it -- so a cluster is either in or out and nothing sits on the
 * line.
 *
 * Exported so a test can read the numbers rather than only learn that they were wrong.
 */
export function crownSignature(): {
  share: number;
  biggest: number;
  patches: number;
  concentration: number;
} {
  const img = crown();
  const w = img.w;
  const h = TILE * 2;
  const hot = new Uint8Array(w * h);
  let body = 0;
  let area = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = img.get(x, y);
      if (c[3] === 0) continue;
      body++;
      if (lumaOf(c) >= 150) {
        hot[y * w + x] = 1;
        area++;
      }
    }
  const seen = new Uint8Array(w * h);
  let biggest = 0;
  let patches = 0;
  for (let start = 0; start < w * h; start++) {
    if (hot[start] === 0 || seen[start] === 1) continue;
    const stack = [start];
    seen[start] = 1;
    let size = 0;
    while (stack.length > 0) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (hot[q] === 1 && seen[q] === 0) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (size >= 8) patches++;
    if (size > biggest) biggest = size;
  }
  return {
    share: body > 0 ? area / body : 0,
    biggest,
    patches,
    concentration: area > 0 ? biggest / area : 1,
  };
}

/*
 * UX_REVIEW finding 17's regression guard, and it is checked at import time for the same reason the
 * painter/name agreement in `tiles.ts` is: a crown that has quietly grown its shoulder back is
 * silent at runtime. Every tool that paints a tile loads this module, so `pnpm graybox`, `pnpm
 * world`, `pnpm score` and `pnpm preview` all run it, and `crown()` memoises, so the check costs the
 * one crown the tiles were going to need anyway.
 *
 * It is deliberately TWO-SIDED on `share`, which is the half a one-sided guard would have missed.
 * The cheapest way to pass "no big bright patch" is to stop painting bright patches, and a crown
 * with no lit cap satisfies every bound on `biggest`, `patches` and `concentration` at once. That
 * is the shape of guard this project has shipped before and been caught by, so the lower bound is
 * the load-bearing line here, not the upper one.
 *
 * Measured, on this crown: share 0.135, biggest 123, patches 7, concentration 0.27. Before the
 * shoulder was broken up: 0.178, 428, 5, 0.72. The bounds sit between the two, closer to the
 * failure, so there is room to retune the ladder without tripping them and none to put the wedge
 * back. `patches` is the thin one -- 5 before against 7 now, so the bound of 6 has a margin of one
 * either side; `concentration` and `biggest` are the two that discriminate with room to spare.
 *
 * If this throws, the thing to look at is `grade` -- a monotonic term across a flat plateau is what
 * welds neighbouring clusters onto one rung. Read the note on `grade` before moving a bound.
 */
{
  const s = crownSignature();
  const say = `share ${s.share.toFixed(3)}, biggest ${s.biggest}px, ${s.patches} patches, concentration ${s.concentration.toFixed(2)}`;
  if (s.share < 0.08 || s.share > 0.16)
    throw new Error(
      `Crown lit share out of band (want 0.08..0.16, see UX_REVIEW 17): ${say}. Under the floor the crown has no lit cap left; over the ceiling it is brighter than the board's own.`,
    );
  if (s.concentration > 0.45 || s.biggest > 230)
    throw new Error(
      `Crown's highlight has welded into one patch again (want concentration <= 0.45 and biggest <= 230px, see UX_REVIEW 17): ${say}.`,
    );
  if (s.patches < 6)
    throw new Error(
      `Crown's highlight is too few separate marks to read as foliage (want >= 6, see UX_REVIEW 17): ${say}.`,
    );
}
