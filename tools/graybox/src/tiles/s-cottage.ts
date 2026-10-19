/*
 * Grandma's cottage at 32x32, redrawn from the concept board's Arrive frame.
 *
 * The board crops this was measured from, all against
 * `reference/mocks/gameplay-concepts.png`:
 *
 *   whole facade   2000 1140 720 350
 *   roof courses   2030 1140 210 130
 *   the left eave  2000 1130 260 200
 *   the door       2230 1180 220 320
 *   left window    2080 1270 200 210
 *
 * FIRST, THE RULER, because the last three rounds of this file were optimised against a broken one
 * and the art bent itself out of shape to satisfy it.
 *
 * `board-profile.json` is built from crops taken at the mock's OWN resolution. The mock is drawn at
 * roughly 3.75 image pixels to one of ours, so its conceptual pixel edges are smeared across
 * interpolation and counted at a fraction of their weight. Measured both ways, the same facade crop:
 *
 *                       native 720x350     nearest our 192x93
 *     deep shade              29.46               29.87
 *     keyline                 17.68               17.89
 *     luma spread             58.24               58.42
 *     edge density             5.42               28.24      <- 5.2x
 *     colour variety          28.24              160.45      <- 5.7x
 *
 * Deep shade, keyline and spread are stable under resampling; edge density and colour variety move
 * by a factor of five. So the stored target's 4.50 edges and 25.74 variety are artifacts, and the
 * instruction they imply -- "the art is too busy, soften it" -- is backwards. Against the board at
 * OUR resolution this facade was at 0.55 of its edge density, not 1.94 times it. This file is drawn
 * to the three stable axes and to the crops, and the artifact axes are reported but not chased.
 *
 * WHAT THE STABLE AXES ASK FOR. The board facade is 29.9 per cent below luma 81 and 17.9 per cent
 * below luma 60: nearly a fifth of the building is a near-black line. Almost all of it is in the
 * roof's joints, the window frames and glass, and the door. The plaster contributes none of it, and
 * the plaster is fourteen of the eighteen facade tiles -- which is why the one thing that must not
 * happen here is a bright blank wall. It was 225 luma; it is now about 198.
 *
 * ONE LIGHT, FROM THE TOP-LEFT. Every slate takes its catch on its own top edge, every stone block
 * is lit on its top-left corner, every plank carries its light down its left edge. Nothing is lit
 * from below.
 *
 * THE COURSES LINE UP, which is the only reason eight separate squares read as one building.
 * Horizontally the slate seams repeat on 32, so the courses run unbroken across the facade's six
 * columns. Vertically a course is addressed by its position in ROOF SPACE -- Y=0 at the top of
 * `roof-peak`, Y=63 at the bottom of `roof-l/m/r` -- and each painter subtracts its own row offset.
 * `COURSES` is that list and it is the contract between the two roof rows.
 *
 * THE ONE DEPARTURE FROM THE BOARD, per docs/ART_PRODUCTION.md section 6a and ART_DIRECTION section
 * 12: the board's roof is terracotta and ours is slate. The tile SHAPE and the per-tile LIGHTING are
 * copied exactly; only the ramp changes.
 *
 * TWO GREYS, not one. The board's chimney, quoins and threshold are COOL grey with a faint blue cast
 * sitting against a WARM slate roof, and the two greys reading against each other is half of why the
 * stonework is legible. Worked stone is `stone` here; the roof is `roof`.
 *
 * NO CYERA PURPLE IN THE WORLD. The window-box blooms were Lilac and Haze. On the board the only
 * saturated figure in the frame is Red herself, and the garden flowers are white, pink and yellow;
 * putting her hue on the cottage is what made her hard to find. The blooms are now `fur`, `skin` and
 * `gold`, and the single warm `gold` centre stays because it is a contrast device on a dark bush.
 *
 * FOUR THINGS THE BOARD HAS THAT THE FROZEN TILE LIST CANNOT HOLD, flagged rather than faked:
 *
 *   - The board's roof is a CHEVRON, a gable with its ridge running front-to-back and grass showing
 *     in the two upper corners. `forest-map.ts` lays `roof-peak` six times across the top row, so
 *     that row is the same 32 pixels repeated and cannot taper. Cutting a diagonal into `roof-l`
 *     alone would put a floating wedge of grass under an opaque ridge. So this roof is the other
 *     real cottage roof: the ridge runs left to right and we are looking at its front slope, with a
 *     proper ridge cap, foreshortened courses, a deep overhanging eave and a verge at each end.
 *   - Stone quoins at the building's two outer corners. `wall` is laid fourteen times in a 6x3
 *     block and a tile cannot know it is at a corner; quoins drawn there would rule a stone grid
 *     across the whole elevation. The door tile carries quoins for its own two columns, where they
 *     are genuinely at an opening.
 *   - A base keyline under the whole facade, and the flowering bushes the board runs along it, for
 *     the same reason. The door tile carries both for its own column; the rest of the facade meets
 *     the grass without them.
 *   - The attic window. On the board it sits in the gable, and there is no gable to put it in.
 *
 * ONE OF THOSE FOUR HAS NOW BECOME AVAILABLE AND IS TAKEN. `forest-map.ts` used to lay `door` twice
 * side by side, so a 32-wide painter had to be symmetric about its own centre and a single arch with
 * its own stone surround was impossible. The map now lays ONE door tile at `cx + 2`. The symmetry
 * constraint is gone with it, and `cottageDoor` is rebuilt as the board's doorway: a stone surround,
 * a segmental timber arch, a planked leaf, a threshold step and the bushes either side.
 */
import { Img, keyline, tone } from '../paint.ts';
import type { RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

/*
 * The keylines. Each is its own ramp's darkest stop taken down 40 luma with the hue preserved, which
 * is the board's own trick: a brown object is ringed in near-black BROWN, a slate in near-black
 * slate, and the building reads as one illustration rather than as objects pasted onto grass.
 *
 * `stone` and `gold` are dropped further than the default because their darkest stops start high
 * (#5f5f66 is luma 96, #9c7420 is luma 118): at the default drop they land in the 50s and 70s, which
 * is a shade, not a line.
 */
const SLATE_LINE = keyline('roof'); // luma 30 -- under every slate butt, and the roof's silhouette
const STONE_LINE = keyline('stone', 58); // luma 38 -- round the chimney, the quoins, the threshold
const WOOD_LINE = keyline('wood'); // luma 35 -- under the eave fascia, and round the door
const FRAME_LINE = keyline('trunk'); // luma 16 -- round the windows, the darkest line on the facade
const BOX_LINE = keyline('gold', 60); // luma 58 -- round the flower box only

const clamp = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** A straight lerp between two opaque colours. No alpha: `k` picks a colour, it does not blend one. */
function mix(a: RGBA, b: RGBA, k: number): RGBA {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
    255,
  ];
}

/*
 * The deepest row of the overhang's shadow on the plaster: the roof's own floor taken halfway to
 * the slate keyline, about luma 50.
 *
 * It is deliberately below the keyline threshold of 60 and deliberately NOT `SLATE_LINE` itself. A
 * cast shadow is the wall with the light taken off it, not a drawn line, so it stops short of the
 * value the slate butts are outlined in; sitting between the two is what lets the fascia's own
 * keyline still read as an edge against the shadow beneath it, instead of the two merging into a
 * single black band and the overhang losing its underside.
 */
const EAVE_SHADE = mix(tone('roof', 0.02), SLATE_LINE, 0.5);

/* ------------------------------------------------------------------ plaster */

/*
 * Weathered lime plaster, and nothing else.
 *
 * The board's wall is flat plaster with stone ONLY at the corners and around the door
 * (ART_DIRECTION section 9.1), so there is no brick here and no coursing.
 *
 * THE WALL HAS GONE BACK UP, FROM 175 TO ABOUT 203, AND THE ARGUMENT THAT DROVE IT DOWN WAS WRONG.
 * This is worth setting out in full, because it was a careful argument, it was acted on twice, and
 * it is the reason the review found a concrete shed at the end of the game.
 *
 * The argument was: "on the board the ROOF HIGHLIGHT is the brightest thing in the frame and the
 * wall sits under it; slate's lit cap tops out at luma 183, so the plaster has to come below that or
 * the tonal hierarchy inverts." So the field was taken from 225 to 203 and then to 175.
 *
 * Measured on the board, the ordering is the other way round and it is not close:
 *
 *     board plaster, x 2200..2240 y 1330..1340          203..219, call it 210
 *     board roof, course caps, x 2450..2700             128..132, call it 130
 *     board roof, course joints                          58..66
 *     board eave band, deepest row                       33
 *
 * The board's wall is EIGHTY LUMA BRIGHTER than its own roof caps. The wall is the brightest large
 * area in the Arrive frame and the roof is a mid-value mass under it, which is simply what a clay
 * roof over lime plaster does in daylight. The "roof highlight is brightest" reading came from
 * looking at the single lit pixel on the ridge, not at the roof.
 *
 * Ours, before this pass, measured plaster 174 against roof caps 176. A two-luma separation between
 * the two biggest masses in the frame is why wall and roof read as one object: the building had a
 * silhouette but no PARTS. No amount of texture on either surface can fix that, and three rounds of
 * texture did not.
 *
 * The fix is the pair, not the wall alone, and the other half is in `roll` and `courses`: the wall
 * comes up to about 203 and the roof's caps come down and are graded 176 at the ridge to about 132
 * at the eave. At the eave, where the two masses actually meet, that is a separation of about
 * seventy -- within ten of the board's own. At the ridge the roof stays light against the grass, so
 * the building still has a top.
 *
 * WHY 0.26 AND NOT SIMPLY "BRIGHTER". `wall`'s ramp is steep from level 0 to level 1 (luma 175 to
 * 220 across the first third of `t`) and nearly flat above it (220 to 250 across the other two
 * thirds). So the field's own swing of about +/-0.15 is worth +/-20 luma down at t=0.26 and only
 * +/-6 up at t=0.5. Brightening by riding further up the ramp would have bought the mean and spent
 * the entire range -- a brighter flat sheet, which is the same defect one stop lighter. 0.26 is as
 * bright as this ramp goes while the weathering still reads.
 *
 * The mix towards cool `stone` is back down to 0.20 for the same reason it was pushed to 0.58 in
 * the first place, in reverse: that mix was buying darkness, the darkness is no longer wanted, and
 * at 0.58 it was also what made the surface read as poured concrete rather than as lime.
 *
 * It does not reach the board's hue, and that is a palette limit rather than a drawing one. The
 * board's plaster is neutral between red and green (a gap of 8) and strongly yellow between green
 * and blue (a gap of 21). `wall` is a pink-orange cream, 26 and 24; `stone` is neutral, 0 and -4.
 * Any mix of the two that neutralises red against green also kills the yellow, so the two gaps
 * cannot both be hit without a hex this file is not allowed to invent. Ours lands at 12 and 9 -- a
 * neutral warm off-white. The thing that matters is that it is nowhere near a yellow-lime, which is
 * the brand risk the direction flagged on the lawn.
 *
 * Everything here wraps on 32, because `wall` is laid 6 across and 3 down and anything that stops at
 * a tile edge draws the grid for you.
 */
/**
 * Smooth value noise that WRAPS on the tile, built here rather than taken from `valueNoise2D`
 * because the shared one is sampled in world space and does not close on 32.
 *
 * Three things were tried for this surface before this one, and each failed in its own visible way,
 * so they are worth recording:
 *
 *   - discrete weathering marks: on a tile laid fourteen times they came out as a polka-dot grid,
 *     and the repeat was the first thing the eye found on the facade;
 *   - harmonics in (x + y): directional, so the wall came out combed with a diagonal corduroy;
 *   - products of a sine in x and a sine in y: non-directional, but a product of two sines on a
 *     32-grid IS a perfectly regular lattice of blobs, and at any amplitude big enough to be worth
 *     having it reads as argyle -- a diamond trellis right across the elevation.
 *
 * Hashed lattice noise has no period shorter than the tile and no preferred direction, so it is the
 * only one of the four that reads as plaster. Taking the lattice indices modulo `cells` is what
 * makes it close seamlessly.
 */
function wrapNoise(seed: number, cells: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number): number => {
    const gx = ((ix % cells) + cells) % cells;
    const gy = ((iy % cells) + cells) % cells;
    let h = (Math.imul(gx, 374761393) + Math.imul(gy, 668265263) + Math.imul(seed, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const step = TILE / cells;
  return (x, y) => {
    const fx = x / step;
    const fy = y / step;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = ease(fx - x0);
    const ay = ease(fy - y0);
    const top = hash(x0, y0) * (1 - ax) + hash(x0 + 1, y0) * ax;
    const bottom = hash(x0, y0 + 1) * (1 - ax) + hash(x0 + 1, y0 + 1) * ax;
    return top * (1 - ay) + bottom * ay;
  };
}

/* Four octaves each, on two independent seeds: one for brightness, one for how cool the patch is. */
const LIT = [wrapNoise(11, 2), wrapNoise(12, 4), wrapNoise(13, 8), wrapNoise(14, 16)] as const;
const COOL = [wrapNoise(21, 2), wrapNoise(22, 4), wrapNoise(23, 8), wrapNoise(24, 16)] as const;

/*
 * The lowest octave is held right down and a fourth, fine one has been added above the other three.
 *
 * `wall` is laid six across and three down, so whatever this field does at 16-pixel scale is drawn
 * eighteen times and the repeat is the first thing the eye finds on the elevation -- at 0.26 it was
 * a legible rhythm of blobs marching across the facade, and at 0.16 it was still camouflage: broad
 * soft patches of light and dark that read as a painted pattern rather than as a surface. It is 0.07
 * now, which is weathering you notice rather than a shape you can trace.
 *
 * The 16-cell octave is two-pixel grain, and it was added on measurement rather than taste. At this
 * camera the facade sits at 0.79 of the board's texture and 0.91 of its edge density: BELOW the
 * board on both, so fine detail is what is missing here, not what is in excess. That is the opposite
 * of the whole-map picture, where edge density runs at twice the board's and the instruction is to
 * stop adding marks -- the two cameras want opposite things, and this file only answers for one of
 * them. Grain this fine also multiplies the colour count without touching the silhouette.
 *
 * THE BASE HAS GONE FROM 0.11 TO 0.26, which is the single biggest change in this file and is
 * measured rather than felt. See `plasterAt` for the numbers; in short, the wall was the same
 * brightness as the roof and the building had no parts.
 *
 * THE STRIATION IS THE "INCIDENT" THE REVIEW ASKED FOR, and it is the only kind of incident a tile
 * laid eighteen times can carry. Timber, quoins and weathering patches were all considered again
 * and all fail the same way: `wall` cannot know where it is on the elevation, so any MOTIF is drawn
 * eighteen times on a 6x3 lattice and rules a grid across the facade -- which is what the three
 * earlier attempts recorded in `wrapNoise` each discovered in their own way. A trowel striation is
 * not a motif: it has no shape to repeat, it closes on the tile in y (period 32/5), and its phase is
 * dragged about by the noise so it never rules a straight line. Six soft horizontal passes per tile
 * is what a plasterer's float leaves, it is visible on the board between the gable and the right
 * slope, and at about eight luma it reads at the 26-tile camera without touching the silhouette.
 */
function plasterT(x: number, y: number): number {
  return (
    0.26 +
    0.07 * (LIT[0](x, y) - 0.5) +
    0.17 * (LIT[1](x, y) - 0.5) +
    0.24 * (LIT[2](x, y) - 0.5) +
    0.17 * (LIT[3](x, y) - 0.5) +
    /*
     * THE TROWEL, AT DOUBLE ITS OLD AMPLITUDE AND IN TWO PASSES, because the review's verdict was
     * "the wall is a large blank cream rectangle and the trowel striation is invisible at 1x" and
     * that was simply true. At 0.06 on a ramp whose upper two thirds span thirty luma, the float
     * marks were worth about four levels: real, measurable, and under the threshold at which an eye
     * at a 26-tile camera can see anything at all.
     *
     * 0.13 is about nine levels on the coarse pass. Two passes rather than one louder one, at
     * periods of 32/5 and 32/9 rows, because a single sine at a visible amplitude is a corduroy --
     * five even stripes, and `wall` is laid three tiles deep so that is fifteen even stripes down
     * the elevation. Two incommensurate periods beat against each other into bands of uneven weight,
     * which is what a plasterer's float actually leaves, and both still close on the tile.
     *
     * The phase of each is dragged about by its own octave of the noise, so neither ever rules a
     * straight line across the facade's six columns -- the thing that killed the three motifs
     * recorded in `wrapNoise`. Steepest neighbour-to-neighbour step is still about six luma against
     * the edge axis's threshold of twenty-four, so this buys texture and spread without buying edges.
     */
    0.13 * Math.sin((Math.PI * 5 * y) / 16 + 6 * (LIT[1](x, y) - 0.5)) +
    0.06 * Math.sin((Math.PI * 9 * y) / 16 + 5 * (LIT[2](x, y) - 0.5))
  );
}

/*
 * Plaster drifts COOL independently of how dark it drifts, which is what makes this surface worth
 * anything to the colour count.
 *
 * Measured on its own, the wall tile carried five distinct colours -- and it is fourteen of the
 * building's eighteen tiles, so nearly half the facade was contributing nothing to the variety axis.
 * Tying the grey to the brightness -- cooler where darker, which an earlier version did -- is still a
 * single one-dimensional path through colour space, and a 1-D path can only hold as many colours as
 * it has steps. Two independent fields make the path a SURFACE, and the count multiplies.
 *
 * Edges stay at zero, measured: every term in both fields is smooth, and the steepest
 * neighbour-to-neighbour step is about four luma against a threshold of twenty-four.
 */
function plasterCool(x: number, y: number): number {
  return clamp(
    0.2 +
      0.26 * (COOL[0](x, y) - 0.5) +
      0.19 * (COOL[1](x, y) - 0.5) +
      0.12 * (COOL[2](x, y) - 0.5) +
      0.08 * (COOL[3](x, y) - 0.5),
  );
}

/**
 * The plaster colour at one point, optionally pushed `k` of the way into the eave's shadow.
 *
 * THE GREY MIX IS DOWN TO 0.20 AND THE VALUE COMES OFF `wall` INSTEAD. Buying brightness or
 * darkness on the `stone` axis closes the warm gaps -- an earlier pass at 0.58 landed at 10 and 8,
 * where the board's plaster sits at 8 between red and green and 21 between green and blue -- and a
 * cool off-white next to a slate roof makes the whole building read as one grey material. Lime
 * plaster is a WARM off-white, in light and in shade. The mix is back to doing what it is for,
 * which is weathering a warm surface rather than setting its value.
 *
 * THE GREY ALSO DEEPENS WHERE THE FIELD IS DARK, by half the field's own distance below 0.2. That
 * is a partial coupling and it is deliberate: the two noise fields stay independent, so the colour
 * path is still a surface rather than a line, but `wall` level 0 is a tan and the darkest plaster
 * would otherwise drift orange instead of into shade. It also buys range at the dark end without
 * clamping `t` at zero, which is where variety goes to die.
 */
function plasterAt(x: number, y: number, k = 0): RGBA {
  const raw = plasterT(x, y) * (1 - k);
  const t = clamp(raw);
  const cool = clamp(plasterCool(x, y) + 0.5 * (0.2 - t));
  let c = mix(tone('wall', t), tone('stone', clamp(0.25 + 0.9 * t)), cool);
  /*
   * Below the ramp's own floor the surface keeps going down instead of flattening against it. The
   * field has to swing wide to stop fourteen tiles reading as one sheet, and a wide swing on a ramp
   * whose dark end is a TAN spends its whole lower half clamped at a single colour -- which is a
   * flat patch, the exact thing the swing was widened to prevent, and it costs the spread and
   * variety axes at the same time. Carrying the tail into `roof` gives the deepest weathering
   * somewhere to go and keeps it in shade rather than in sand.
   */
  if (raw < 0) c = mix(c, tone('roof', 0.1), clamp(-raw * 1.6));
  return k > 0 ? mix(c, EAVE_SHADE, k) : c;
}

function plaster(img: Img): void {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) img.px(x, y, plasterAt(x, y));
}

const cottageWall: Painter = (img) => {
  plaster(img);
};

/* --------------------------------------------------------------------- roof */

/*
 * Slate, in the board's tile shape.
 *
 * WHAT THE BOARD'S ROOF TILE ACTUALLY IS, from the roof crop at 5x, because the pass this replaces
 * had it wrong in a way that was visible from across the room: the roof read as a cobbled street
 * stood on end. The board's tile is
 *
 *   - a rounded rectangle about 11 by 8 of our pixels, so wider than it is tall but nowhere near the
 *     16 by 11 slab this used to draw;
 *   - FLAT across its face. Almost all of the body sits inside forty luma. The pass this replaces
 *     rolled each tile from its head to its butt AND darkened its last two columns, which turns a
 *     slate into a cylinder; a grid of cylinders is a cobble, and that is exactly what it looked
 *     like;
 *   - carrying a near-white catch along its TOP edge, one pixel, brightest at the left;
 *   - separated from the course below by a hard near-black line under its butt, and from its
 *     neighbours by a joint that is an HOURGLASS -- two pixels at the middle of the seam, four where
 *     the corners are nipped. That flare, where three tiles meet, is the single mark that tells a
 *     roof from coursed masonry, and the old uniform 2px slot is what made it masonry.
 *
 * The joint is also two values rather than one. On the board only the butt line and the flares are
 * near-black; the rest of the joint is a dark slate that sits just under luma 81. Flooding the whole
 * joint with the keyline put the roof at 39 per cent below luma 60 against the board's 17.5. Split
 * this way a cell is 67 per cent face, 17 per cent keyline and 16 per cent mid-dark, which lands on
 * the board's roof crop almost exactly.
 */

/*
 * Roof space: Y=0 is the top of `roof-peak`, Y=63 the bottom of `roof-l/m/r`. A ridge cap, six
 * courses, then the eave.
 *
 * THE COURSES FORESHORTEN, and this is the only pitch cue the frozen tile list leaves available. A
 * roof slope seen from in front is compressed near the ridge and open near the eave, so the courses
 * run 7, 7, 8, 9, 9, 9. Both rows used to draw the same 11-row course, which is a flat plane seen
 * face-on -- a wall. Three rows of difference across the slope is enough to read as a roof, and it
 * costs nothing: the contract between the two tiles is this table and the row offset, exactly as
 * before.
 */
const COURSES = [
  [7, 7],
  [14, 7],
  [21, 8],
  [29, 9],
  [38, 8],
  [46, 9],
] as const;

const RIDGE_H = 7; // rows 0..6 of `roof-peak`
/*
 * In `roof-l/m/r`'s own rows: fascia, keyline, then the shadow the overhang throws on the plaster.
 *
 * MOVED UP TWO MORE ROWS, FROM 22, SO THE SHADOW GETS NINE INSTEAD OF FIVE. The rows below this
 * tile belong to `wall`, which is laid fourteen times and so cannot carry any part of a shadow that
 * happens once on the elevation, so every row the shadow gets has to be taken from the roof above
 * it. The two taken here cost the last course its butt line and the bottom of its turn-under -- and
 * a fascia board is exactly the thing that covers a bottom course's butt in real carpentry, so the
 * roof loses nothing it should have been showing.
 *
 * Nine rows is what the board's own transition needs: measured down a column through its eave, it
 * runs about fourteen of our pixels from near-black to full plaster, and nine is as close to that
 * as the frozen tile list allows.
 */
const EAVE_Y = 20;

/*
 * Where the vertical seams fall, as positions modulo 32, alternating course by course.
 *
 * TWO CELLS PER TILE, NOT THREE, and this is the other half of why the roof read as a cobbled street
 * rather than a roof. Three cells on 32 gives a slate about ten wide against a course seven to nine
 * tall -- near enough square that the vertical joints read exactly as strongly as the horizontal
 * ones, and two equal grids crossing is masonry no matter how the faces are shaded. Measured off the
 * board's roof crop at 5x, its tile is about thirteen of our pixels wide to seven tall: roughly two
 * to one, so the course line wins and the perpend is a detail inside it. Two cells give fifteen and
 * seventeen, which is that ratio, and the slate stops being a cobble because of its proportion
 * rather than because of anything done to its face.
 *
 * The widths stay unequal -- 15 and 17 -- rather than a uniform 16. Uniform cells on a 32 grid are a
 * perfect lattice and the eye finds a lattice instantly. Two unequal cells still repeat on 32, so
 * the courses run unbroken across the facade's six columns.
 */
const SEAMS_EVEN = [0, 15] as const;
const SEAMS_ODD = [8, 23] as const;

/** Each seam paired with the width that runs from it to the next, wrapping on the tile. */
function runs(seams: readonly number[]): [number, number][] {
  return seams.map((s, j) => {
    const next = j === seams.length - 1 ? seams[0]! + TILE : seams[j + 1]!;
    return [s, next - s];
  });
}

/**
 * The three-tone roll down one slate, from its head (d=0) to its butt (d=1).
 *
 * THIS IS THE CHANGE THAT STOPS THE ROOF BEING A CINDER-BLOCK WALL, and it is worth saying what was
 * wrong because the previous pass was not lazy, it was aimed at the wrong target. It read the board
 * tile as FLAT -- "almost all of the body sits inside forty luma" -- and drew a one-pixel catch on
 * the head with a single smooth fall of 0.55 beneath it. A smooth fall over six rows has no features
 * in it, so each cell came back as an evenly shaded lozenge, and a lattice of evenly shaded lozenges
 * is a cobbled street. Rendered at a 26-tile camera the roof read as grey masonry laid on its side.
 *
 * Measured off the board's roof crop at 5x, a tile is not flat and it is not a smooth gradient
 * either. It is THREE BANDS with hard transitions between them:
 *
 *   the lit cap        top ~26 per cent, at the top of the ramp and barely falling across it
 *   the body           middle ~46 per cent, nearly level -- this is the "flat" the last pass saw
 *   the turned butt    bottom ~28 per cent, falling off a cliff into the joint
 *
 * A level body between a bright cap and a dark underside is what the eye reads as a glazed tile.
 * The same total range spread evenly is what it reads as a stone. The numbers below are the three
 * segments; the flat middle is the whole point of the middle one.
 *
 * THE CAP IS A BAND AND NOT A GRADIENT, and that is the second correction. A first attempt at this
 * dropped 0.30 across the cap, which is a gradient with a bright pixel at the top of it -- so each
 * course still came back as a smooth roll and the roof was still masonry. The board's cap holds its
 * value for two or three rows and then STEPS to the body. Rendered, that step is about twenty luma,
 * under the twenty-four the edge-density axis counts, so the crisp line the eye wants costs nothing
 * on the one axis that is already at the board's own level.
 *
 * THE FACE HAS BEEN FLATTENED FROM 125 LUMA OF ROLL TO ABOUT 34, which is the correction this pass
 * makes and which goes the opposite way to what the review's words suggest. The review says the
 * roof has "no vertical form ... the fish-scale texture reads as a cobbled courtyard seen from
 * above", and the obvious reading of that is "add contrast". Measured, the opposite was true.
 *
 * Down a single column of the board's roof, one tile from its cap to the joint beneath it:
 *
 *     128 128 128 128 126 126 126 126 125 125 125 124 123 122 120 117 113 109 108 99 82 69 61 58
 *     \_________________ the FACE, 128 to 99 _________________________________/ \_ the JOINT _/
 *
 * The board's slate face moves by TWENTY-NINE LUMA across its whole height. It is, to the eye,
 * flat. All of the drama is in the joint beneath it, which drops another forty in four rows. Ours
 * ran 176 to 106 on the face -- two and a half times the board's roll -- and then into the joint on
 * top of that.
 *
 * That is the cobble, and it is a question of what the shading DESCRIBES. A big tonal roll across a
 * small face says "this object is round": it is how you draw a pebble, a cobble, a boulder. A
 * nearly flat face with a hard dark line under it says "this object is a thin plate lying on
 * another one", which is what a slate is. Six rounds of work went into the OUTLINE of the tab --
 * the comment above records six shapes tried and rejected -- while the shading inside it went on
 * saying "pebble" the whole time. No silhouette can outvote that.
 *
 * So the two contrasts move in opposite directions on purpose: LOCAL contrast down, so a slate
 * stops being a lump, and GLOBAL contrast up (see `courses`), so the plane reads as lit at the
 * ridge and in shade at the eave. Together they are what turns a field of lumps into a pitched
 * roof. Neither works without the other: flattening the face alone gives a flat grey sheet, and
 * grading the slope alone leaves the lumps in place to swamp it, which is what the first attempt at
 * this pass did.
 */
function roll(d: number): number {
  if (d < 0.26) return 0.94 - 0.02 * (d / 0.26); // the cap: a BAND, barely falling
  if (d < 0.78) return 0.88 - 0.06 * ((d - 0.26) / 0.52); // the body: level, and most of the tab
  return 0.8 - 0.16 * ((d - 0.78) / 0.22); // the butt: turns under, into the joint
}

/**
 * One slate: a lit cap, a level body, a turned-under butt, and a hard line beneath it.
 *
 * TWO THINGS MAKE THIS A ROOF RATHER THAN A WALL, and both took a render to find.
 *
 * THE SEAM IS ASYMMETRIC. The first attempt inset the face by a pixel on BOTH sides of every cell,
 * which puts a two-pixel gap between neighbours all the way down -- a vertical line exactly as
 * strong as the horizontal one. Two equal grids is a brick wall, and that is what it rendered as.
 * Here each cell insets one pixel on its LEFT only, so the seam is a single pixel and it comes from
 * the neighbour. The course wins over the perpend, which is how a roof is laid.
 *
 * THE TAB IS A SCALLOP, AND THIS TOOK THREE RENDERS TO GET RIGHT, in both directions. The first
 * version drew a flat slab with a straight bottom edge and it rendered as a stretcher-bond
 * cinder-block wall, because offset courses of flat rectangles separated by a ruled dark line IS
 * brickwork. The correction after that nipped a single column off each end -- argued, in a comment
 * that is now deleted, as "a rectangle with its corners nipped, not a pebble". Rendered at the
 * proper width that produced the clearest brick wall of the three: a 15-wide rectangle with one
 * pixel off each corner is a brick, and no amount of shading on its face changes what its outline
 * says.
 *
 * THE TAB IS A FISH-SCALE: SQUARE SHOULDERS, DEEP ROUND BOTTOM. Six shapes were drawn and rendered
 * before this one, and the first five were all some kind of wall:
 *
 *   ten wide, flat faced            a cobbled street stood on end
 *   fifteen wide, corners nipped    the clearest brick wall of the lot
 *   fifteen wide, both ends round   stones set in mortar -- a rubble wall
 *   flat top, continuous cap        corrugated iron: the tabs stopped separating at all
 *   nipped top, shallow bottom      a dry-stone wall, and the best-measuring of the five
 *
 * That is the finding, and it is worth more than the shape that finally worked: the six measured
 * axes moved by less than two hundredths of a point across all of them. Deep shade stayed between
 * 24.4 and 24.8, the distance between 0.164 and 0.167. The score cannot see the difference between
 * a roof and a wall, so nothing in this paragraph could have been found by chasing it.
 *
 * What separates the sixth from the other five is that a WALL IS NEVER SCALLOPED. Square shoulders
 * keep each tab separate from its neighbour along the course, and a bottom that drops three or four
 * rows in a deep arc puts a row of half-circles across the slope -- which is fish-scale slate, a
 * form that has no masonry equivalent to be mistaken for. Shallow arcs read as rounded blocks and
 * blocks read as a wall, so the arc has to be deep enough to be unmistakable. The cut is `u^2.6`,
 * nearly nothing across the middle nine columns and then falling away fast.
 *
 * It only reads at all because the tab is also WIDE: a scallop as tall as it is broad is a cobble,
 * which is what three cells to the tile was producing.
 *
 * The joint is two values, and the near-black one FOLLOWS THE ARC rather than ruling across the
 * cell. Two rows of keyline under each column's own butt, then the soft value down to the course
 * line. A keyline at a fixed row would be a mortar bed, and a mortar bed under offset tabs is
 * brickwork however the tabs are shaped -- which is the same mistake as the flat face, one layer
 * down.
 */
/*
 * THE CAST RUNS BOTH WAYS, and getting this backwards was holding the roof in the stonework's own
 * colour family for three passes.
 *
 * The header of this file says, correctly, that the board's chimney, quoins and threshold are COOL
 * grey against a WARM slate roof, and that the two greys reading against each other is half of why
 * the stonework is legible. The painter then mixed every slate towards `stone` -- the rocks' own
 * ramp, the chimney's own ramp -- so each tab was pulled cooler, into the exact family it was
 * supposed to be read against. Grey tabs laid in courses are a dry-stone wall, and at the cottage
 * camera that is what the roof was: masonry, not roofing. Shape could not fix it, and three rounds
 * of shape did not.
 *
 * A slate now takes a SIGNED cast: negative towards cool `stone`, positive towards warm `wood`.
 * Real slate is patchy both ways, the warm end restores the contrast with the chimney, and -- the
 * measured part -- a signed cast makes the colour path a two-dimensional region rather than a line
 * out of `roof` in one direction, which is where the variety axis has been losing the roof's share.
 *
 * `wood` is sampled at 0.8 of the tab's own `t` and `stone` at 0.75, both below it, for the same
 * reason in each direction: `stone` tops out at luma 210 against `roof`'s 183 and was bleaching the
 * lightest tabs, and `wood` is a saturated brown whose own ramp would take a warm tab orange.
 *
 * ROUND 4, INTEGRATION: the cast was right in principle and too wide at the warm end. Measured on
 * the rendered cottage camera, over the roof's own 176x48 rectangle, our warm axis (red minus blue)
 * ran mean 22.6 with a spread of 7.3 and a MAXIMUM of 44 in the 128..159 band -- the brightest tabs
 * sat at twice the roof's own mean, which at 1x is a tan slate in a grey roof.
 *
 * The board does not do that. Its roof over 250x100 is warm in every single luma band and never
 * leaves the family: mean red-minus-blue 128.6, and per band the spread is about a fifth of the
 * mean (32.5 on 155.6, 32.5 on 146.9). Value carries the roof; hue is held still. Ours was the
 * other way round, a small warm base with proportionally larger swings, which is exactly how a
 * roof comes out grey-with-occasional-tan instead of one material.
 *
 * So the cast is now CENTRED and its warm reach halved: the old expression ran -0.144..+0.261,
 * biased warm, and it now runs -0.13..+0.12. Both directions survive, because real slate is patchy
 * both ways and because the two-dimensional colour region is still what keeps the roof's share of
 * the variety axis. No tab reaches far enough into `wood` to leave the family.
 *
 * NOT CHANGED, deliberately, and it is the integrator's call to leave alone: the `roof` ramp itself
 * is warm grey (#4a453e..#bdb6a7, red over green over blue). `paint.ts` documents that as Clay's
 * own cast and a rebrand decision, so a roof that measures warm overall is the palette working as
 * specified, not a fault. Re-hueing the ramp to a blue-grey slate would be a brand change and
 * belongs to whoever owns `reference/brand/`, not to this file.
 */
function shingle(
  img: Img,
  x0: number,
  y: number,
  w: number,
  h: number,
  v: number,
  cast: number,
  dim: number,
) {
  // Faded out towards the dark end: both neighbours are lighter than `roof` at the floor, so a cast
  // butt was coming back well above the deep-shade band the turned-under edge exists to fill.
  const face = (t: number): RGBA => {
    const c = clamp(t);
    const k = Math.abs(cast) * clamp(t * 1.5);
    return cast < 0
      ? mix(tone('roof', c), tone('stone', clamp(t * 0.75)), k)
      : mix(tone('roof', c), tone('wood', clamp(t * 0.8)), k);
  };

  /*
   * The perpend, drawn rather than left to the flood.
   *
   * THE COURSE LINE HAS TO BEAT THE SEAM or the roof is a grid, and a grid of rounded grey cells is
   * a dry-stone wall -- which is what the render still said after the tabs were given their proper
   * shape. On the board the horizontal joint is the strong one and the vertical between two tiles in
   * the same course is visibly thinner and lighter; that difference is what makes a roof read as
   * COURSES rather than as masonry. Leaving the seam at the flood put it at luma 29, exactly the
   * course line's value, so both grids read equally.
   *
   * It stays dark enough to separate the tabs -- about luma 76, under the deep-shade threshold --
   * and the flares at the tab's two ends still get the keyline from the flood above and below it.
   */
  /*
   * THE PERPEND STOPS SHORT OF THE COURSE'S HEAD, AND THAT IS THIS ROUND'S CORRECTION.
   *
   * It used to run the full height of the cell at the joint's own value. The review's reading --
   * "six identical slate tabs across by five identical courses reads as a brick wall lying down" --
   * is exactly what a full-height perpend produces: a dark vertical from the head of the cell to its
   * butt, meeting the course line at both ends, closes a RECTANGLE round every tab, and a grid of
   * closed rectangles in offset rows is stretcher bond however the faces are shaded. Six rounds of
   * work went into the tab's outline while the joint around it went on drawing brickwork.
   *
   * Measured off the board's roof crop at 3x, the board does the opposite in both directions:
   *
   *   each course carries ONE CONTINUOUS BRIGHT CATCH along its whole head, unbroken by the
   *   verticals -- that single line is what makes a course read as a course;
   *   the vertical between two tiles in the same course is a SHORT NICK in the lower two thirds,
   *   visibly thinner and lighter than the horizontal, and it never reaches the catch above it.
   *
   * So the cap's top two rows are drawn across the joint in the tab's own face colour, and the nick
   * runs from there to about seven tenths of the cell before giving way to the flood. What is left
   * below it merges into the course line -- which is where a real joint pools -- so the dark is
   * concentrated on the horizontal and the eye gets courses on a slope instead of bonded masonry.
   */
  const cap = Math.min(2, h - 2);
  for (let r = 0; r < cap; r++)
    img.px(x0, y + r, face((roll(r / Math.max(1, h - 1)) + v + 0.06) * dim));
  const nick = Math.max(cap + 1, Math.round((h - 2) * 0.72));
  for (let r = cap; r < nick; r++) img.px(x0, y + r, tone('roof', 0.14 * dim));

  for (let i = 1; i < w; i++) {
    const u = Math.abs(i - (w - 1) / 2) / ((w - 1) / 2); // 0 mid-tab, 1 at its two ends
    const cut = Math.pow(u, 2.6);
    const bot = h - 2 - Math.round(3.4 * cut);
    const lean = 0.06 * (1 - (i - 1) / (w - 2)); // the light comes from the left of each tab
    for (let r = 0; r <= bot; r++) {
      const d = r / bot; // 0 at the head, 1 at the butt
      /*
       * `dim` SCALES rather than subtracts, which matters at the eave. Subtracting a constant from
       * every row of a shaded course drives its butt below the ramp's floor, where `clamp` flattens
       * it: the darkest courses would lose their internal modelling entirely and come back as solid
       * slabs, which is the cobble problem again one step further down the slope. Scaling keeps the
       * shape of the roll and compresses it, so a course in shade has less contrast than one in the
       * light -- which is also what shade does.
       */
      img.px(x0 + i, y + r, face((roll(d) + v + lean) * dim));
    }
    for (let r = bot + 1; r <= h - 1; r++)
      img.px(x0 + i, y + r, r === bot + 1 ? SLATE_LINE : tone('roof', 0.03 * dim));
  }
}

/*
 * Every course that lands in this tile, bottom up.
 *
 * NO TWO NEIGHBOURING SLATES ARE QUITE THE SAME TONE OR QUITE THE SAME GREY. A slate gets two
 * independent draws -- one that moves it along the `roof` ramp, one that mixes it towards cool
 * `stone` -- so the colour path across the roof is a surface rather than a line, and real slate is
 * exactly this patchy.
 *
 * The variation is keyed on the seam's position MODULO 32 and on the course index, never on the
 * drawn x. The map lays these tiles six across, so anything keyed on the unreduced position would
 * differ from tile to tile and the courses would stop lining up.
 */
function courses(img: Img, rowOffset: number): void {
  for (let i = COURSES.length - 1; i >= 0; i--) {
    const [top, h] = COURSES[i]!;
    const y = top - rowOffset;
    if (y > TILE || y < -h) continue;
    /*
     * THE SLOPE FALLS INTO ITS OWN EAVE. This is the one pitch cue left once the frozen tile list
     * has taken the gable away, and until this pass it was not working at all.
     *
     * It was a subtractive term of 0.2 across the whole slope, and the per-slate random spread
     * sitting beside it in `vary` was +/-0.2 -- the same size. So any one course could be lighter or
     * darker than the one above it by more than the slope's entire intended fall, and rendered, the
     * caps came out 176 172 170 160 149 157: not monotonic, and a nineteen-luma drop over the whole
     * roof. The eye reads a gradient only when it is monotonic, so what it actually saw was six
     * identical bands of grey, which is the "cobbled courtyard" the review named.
     *
     * Three things changed together and all three are needed:
     *
     *   - the fall is now a SCALE, 1.0 at the ridge down to 0.48 at the eave, applied to the whole
     *     of the tab's tone rather than added to it (see `shingle` for why scaling and not
     *     subtracting);
     *   - it is worth about fifty-five luma on the caps, against nineteen before -- comfortably
     *     more than the thirty-four a single slate's face now spans, which is the condition for the
     *     slope to be what the eye reads first rather than the individual tabs;
     *   - the per-slate spread is halved, from +/-0.2 to +/-0.1, so it varies the slope instead of
     *     erasing it. Slates still differ from their neighbours; they no longer out-shout the roof.
     *
     * Forty-four luma of fall is deliberately more than the board's own roof has -- measured, the
     * board's course caps barely move down its slope at all. The board does not need the gradient
     * because its roof is a CHEVRON: it has a gable silhouette, two slopes meeting at a ridge, and
     * grass showing in the upper corners, so the shape alone says "roof". `forest-map.ts` lays
     * `roof-peak` six times across the top row, so ours cannot taper and has no such silhouette.
     * With the shape unavailable, the lighting has to carry the pitch on its own, and that is the
     * one place in this file where matching the board's NUMBER would miss the board's PICTURE.
     */
    const dim = 1 - 0.52 * (i / (COURSES.length - 1));
    for (const [seam, w] of runs(i % 2 === 0 ? SEAMS_EVEN : SEAMS_ODD)) {
      const hash = Math.imul(seam + i * 37 + 1, 2654435761) >>> 0;
      const vary = (((hash >>> 28) & 15) / 15 - 0.5) * 0.2;
      // Signed: some slates run cool towards `stone`, some warm towards `wood`. Centred, not biased
      // warm -- see the note above `shingle`. The chimney separates from the roof on VALUE (`stone`
      // tops at luma 210 against `roof`'s 183) and does not need a warm roof to read against.
      const cast = (((hash >>> 20) & 15) / 15 - 0.5) * 0.26;
      for (let k = -1; k <= 1; k++) shingle(img, seam + k * TILE, y, w, h, vary, cast, dim);
    }
  }
}

/*
 * The ridge cap: half-round tiles along the crest, rolled from a lit crown down to a shaded
 * under-edge and segmented. The joints sit at 7 and 23 so no joint lands on a tile seam --
 * `roof-peak` is laid six times across and a joint on the seam would draw the tile grid.
 *
 * This is new. There was a four-row band here before, but it was the same value top to bottom as the
 * courses beneath it, so the roof had no crest: the eye found no top edge to the building and the
 * whole thing read as a slab. A cap that is lighter than the slope at its crown and darker than it
 * at its underside is what makes the ridge a ridge.
 */
function ridge(img: Img): void {
  img.rect(0, 0, TILE, 1, SLATE_LINE); // the building's top silhouette
  img.rect(0, RIDGE_H - 1, TILE, 1, SLATE_LINE); // and the cap's own shadow onto the slope
  /*
   * THREE CAPS TO THE TILE, EACH ROLLING ALONG ITS OWN LENGTH. There were two, and each was a flat
   * sixteen-pixel slab, so the ridge rendered as a coping stone laid along the top of a wall -- which
   * on a roof that was already reading as masonry was the last thing it needed. A ridge cap is a
   * half-round pot: it is lit on its left shoulder and turns under at its right, and it is SHORT, so
   * what the eye gets along the crest is a row of beads rather than one long bar.
   *
   * The joints sit at 6, 15 and 25. None of them lands on 0 or 31: `roof-peak` is laid six times
   * across and a joint on the tile seam would draw the tile grid along the skyline. The spacing is
   * deliberately uneven -- 9, 10, 13 -- for the same reason the slate seams are.
   *
   * Brighter at the crown and deeper at the under-edge than the first version. This is the
   * building's top edge against the sky, and on the board it is the lightest run of pixels in the
   * whole frame -- which is also what pins the wall below it in its place in the tonal order.
   */
  const joints: readonly number[] = [6, 15, 25];
  const crown = [0.82, 1.06, 0.96, 0.52, 0.08] as const;
  for (let y = 1; y < RIDGE_H - 1; y++) {
    const base = crown[y - 1] ?? 0.08;
    for (let x = 0; x < TILE; x++) {
      let start = joints[joints.length - 1]! - TILE;
      let end = joints[0]!;
      for (let j = 0; j < joints.length; j++)
        if (x >= joints[j]!) {
          start = joints[j]!;
          end = j === joints.length - 1 ? joints[0]! + TILE : joints[j + 1]!;
        }
      const u = (x - start) / Math.max(1, end - 1 - start); // 0 at the cap's lit shoulder
      img.px(x, y, tone('roof', clamp(base + 0.12 * (1 - u) - 0.06)));
    }
  }
  for (const x of joints) img.rect(x, 1, 1, RIDGE_H - 2, SLATE_LINE);
}

/*
 * The eave, which is the other half of making this read as a roof rather than a bunker.
 *
 * There was a thin grey line here before. The board has a deep overhang: a dark BROWN fascia board
 * standing proud of the slate butts, a hard near-black line under it, and then the plaster below in
 * the overhang's shadow, climbing back to its own value over four rows. That shadow is the only one
 * this building can cast on itself -- `wall` repeats fourteen times, so it cannot carry one -- and it
 * is what seats the roof on the wall instead of letting it float above it.
 *
 * The fascia is `wood` and not `roof`, deliberately. On the board it is timber, the same timber as
 * the window frames and the door, and that is what ties the three together across the elevation.
 */
function eave(img: Img): void {
  /*
   * The fascia catches the light along its own top edge, where it stands proud of the slate butts.
   * Without that line the board stops being a board standing in front of the roof and becomes a
   * brown stripe painted across it.
   *
   * It is two rows now rather than three, and its keyline one rather than two. The three rows the
   * eave gives back go to the shadow below, which is where the review said the frame was failing.
   */
  for (const [row, t] of [
    [EAVE_Y, 0.82],
    [EAVE_Y + 1, 0.44],
  ] as const)
    img.rect(0, row, TILE, 1, tone('wood', t));
  img.rect(0, EAVE_Y + 2, TILE, 1, WOOD_LINE);
  /*
   * The shadow is drawn as PLASTER, darkened, rather than as a grey ramp off the `roof` ramp. The
   * first version used `roof` because it is dark enough, and the result read as a grey stripe
   * painted under the eave rather than as the wall in shade -- the material changed, so the eye took
   * it for a separate band of something. Rows of the same cream, taken down and let back up, is
   * what says "that is the wall, and the roof is in front of it".
   *
   * IT IS NINE ROWS NOW, NOT FIVE, AND IT STARTS AT ABOUT LUMA 50 RATHER THAN 80. This is the
   * review's first named fault -- "critically no shadow under the eave, so the roof looks pasted on
   * top rather than overhanging" -- and the shadow WAS there; it was five rows climbing 81, 89,
   * 109, 131, 149 into a wall at 175, so its deepest row was already brighter than half the roof
   * above it and its whole range was under a hundred luma. Against a wall that is now 203 it would
   * have been fainter still.
   *
   * The board, measured down a column through its own eave at x 2420..2600: the keyline bottoms at
   * 33, then the shadow climbs 36, 54, 63, 75, 88, 102, 119 and reaches its plaster at about 203 --
   * about fourteen of our pixels, from near-black to full wall. These nine rows are that curve,
   * compressed into what the tile has room for.
   *
   * Nine is the ceiling and not a choice. The rows below this tile belong to `wall`, which is laid
   * fourteen times and so cannot carry any part of a shadow that happens once on the elevation --
   * the same frozen-tile-list limit that keeps the quoins and the base keyline off the facade.
   */
  for (const [row, k] of [
    [EAVE_Y + 3, 1],
    [EAVE_Y + 4, 1],
    [EAVE_Y + 5, 0.97],
    [EAVE_Y + 6, 0.9],
    [EAVE_Y + 7, 0.8],
    [EAVE_Y + 8, 0.66],
    [EAVE_Y + 9, 0.5],
    [EAVE_Y + 10, 0.33],
    [EAVE_Y + 11, 0.16],
  ] as const)
    for (let x = 0; x < TILE; x++) img.px(x, row, plasterAt(x, row, k));
}

function roof(kind: 'left' | 'middle' | 'right' | 'peak'): Painter {
  return (img) => {
    /*
     * The joint, flooded first so it shows in every seam and under every butt. `shingle` draws the
     * softer upper half of each horizontal joint back over it, so what is left at the keyline value
     * is the butt line and the flares where three slates meet.
     */
    img.rect(0, 0, TILE, TILE, SLATE_LINE);

    if (kind === 'peak') {
      courses(img, 0);
      ridge(img);
      return;
    }

    courses(img, TILE);
    eave(img);

    /*
     * The verge. `roof-peak` runs the full width of the ridge row and is laid six times, so it
     * cannot carry an end treatment: the roof's left and right silhouette is keylined on the lower
     * row only. Kept to a line and a shade rather than a barge board for the same reason -- a piece
     * of joinery that appears halfway down the roof is worse than none.
     */
    if (kind === 'left') {
      img.rect(0, 0, 1, EAVE_Y, SLATE_LINE);
      img.rect(1, 0, 1, EAVE_Y, tone('roof', 0.12));
    }
    if (kind === 'right') {
      img.rect(TILE - 2, 0, 2, EAVE_Y, SLATE_LINE); // 2px: this is the lower-right edge
      img.rect(TILE - 3, 0, 1, EAVE_Y, tone('roof', 0.12));
    }
  };
}

/* -------------------------------------------------------------------- glass */

/**
 * One pane: a navy sheet with the sky caught in the top of it, lit from the left.
 *
 * NAVY, and built by mixing rather than by picking a ramp, because neither ramp alone is the board's
 * colour. `night` on its own is a dark PURPLE -- it is Deep Purple and Aubergine, Red's own hues --
 * and putting her colour in Grandma's windows is the inversion this file has just taken out of the
 * flower boxes. `water` on its own is a sunlit stream and far too saturated for a reflection. Mixed,
 * they run from luma 45 at the bottom of a pane to 91 at the top, which is the board's pane almost
 * exactly, and the glass is one of the three places this building gets its sub-60 pixels.
 */
function pane(img: Img, x: number, y: number, w: number, h: number): void {
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const s = h > 1 ? 1 - v / (h - 1) : 1; // 1 at the top of the pane, 0 at its bottom
      const lean = 0.06 * (1 - u / Math.max(1, w - 1));
      img.px(
        x + u,
        y + v,
        mix(
          tone('night', clamp(0.35 + 0.25 * s)),
          tone('water', clamp(0.02 + 0.1 * s)),
          clamp(0.25 + 0.35 * s + lean),
        ),
      );
    }
}

/**
 * A lamplit room behind the glass: warm amber, brightest where the lamp stands, falling off down
 * and to the right.
 *
 * `pane` is the board's LEFT window and `lamp` is its RIGHT one, and the two are genuinely
 * different pictures rather than two moods of one. Measured off the two crops at 6x, the left
 * window's glass runs luma 45 to 91 in navy; the right window's runs 146 to 225 in amber, because
 * there is a lamp lit behind it and a wolf standing in front of the lamp.
 *
 * `gold` rather than a mix, because this is the one surface on the building that is a light SOURCE
 * rather than a lit material: the ramp runs #9c7420 to #ffe88a, which is a lamp seen through glass,
 * and it is the only place in the world art that ramp is used at full reach.
 */
function lamp(img: Img, x: number, y: number, w: number, h: number): void {
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) {
      const s = h > 1 ? 1 - v / (h - 1) : 1; // 1 at the top of the opening, 0 at the sill
      // The lamp stands a third of the way across, so the glow is off-centre and not a vignette.
      const across = w > 1 ? 1 - Math.abs(u - (w - 1) * 0.34) / (w - 1) : 1;
      img.px(x + u, y + v, tone('gold', clamp(0.14 + 0.56 * s + 0.26 * across)));
    }
}

/* ------------------------------------------------------------------- window */

/*
 * The window, its box and its blooms -- and the wolf behind it.
 *
 * THE WOLF IN THE WINDOW IS THE PREMISE OF THE GAME AND IT WAS NOT DRAWN. The board puts him in the
 * right-hand window of the Arrive frame: a dark purple silhouette, two pointed ears over a broad
 * head, an amber muzzle mark, standing against a lamplit room with the flower box across his chest.
 * He is the whole staging of "That's Not My Grandma" -- the player can see from the gate that
 * something is in there -- and this file had two identical sheets of navy glass instead.
 *
 * HE IS DRAWN IN `wolf`, THE SAME RAMP THE SPRITE USES, so the thing in the window and the thing
 * that meets you are recognisably one animal. Deep Purple is what the board uses for him too, which
 * is the one place the rebrand and the board agree without a departure.
 *
 * WHAT THE LAMP BUYS BESIDES THE STORY. The lit glass is 11 by 14 of amber at luma 146 to 225 with
 * a near-black animal cut out of it -- about seventy pixels under luma 35 inside a frame that is
 * otherwise the brightest part of the elevation. That pairing is the largest local contrast on the
 * building after the door, it is a hue nothing else on the facade carries, and it is the reason a
 * player walking east out of the dark forest has something to walk TOWARDS. A dark cottage at the
 * end of the map is scenery; a lit one with a shape in the window is a destination.
 *
 * THE MAP LAYS ONE WINDOW TILE TWICE, SO BOTH WINDOWS GET THE WOLF. See the escalation at the head
 * of this file: the board's two windows are different pictures and the frozen list has one tile for
 * them. Both lit and both occupied is the better of the two readings available -- he paces between
 * the rooms -- and `pane` is kept, drawn in the door's fanlight, so the navy glass is not lost.
 *
 * IT IS BIGGER AND IT IS WARMER. The pane used to be a 2x2 of near-black at 15 by 13, floating in
 * the middle of a blank cream sheet, and at a 26-tile camera it read as a hole punched in the wall.
 * Measured off the board crop the glass is about 18 by 15 of our pixels inside a frame of 26 by 23,
 * and the frame is warm mid-BROWN timber with a near-black keyline round it -- not the near-black
 * `trunk` body this used to paint, which gave the window no material at all. `wood` for the frame,
 * `trunk`'s keyline round it, and a lintel cap that steps a pixel proud at the head, as the board's
 * does.
 *
 * THE GLAZING IS THREE LIGHTS, NOT FOUR PANES, which is what the board draws and what leaves room
 * for him: a narrow light at the left split by a transom, and one tall light beside it. A 2x2 grid
 * cut the animal into quarters and none of the four read as anything.
 */

/*
 * The bush's top edge, column by column across the box's 24 pixels. Three fingers of different
 * heights with a notch between each -- a hand of leaves, never a curve.
 *
 * IT HAS COME DOWN FIVE ROWS AND THAT IS A CORRECTION, not a trim. The profile used to top out at
 * row 17, which was argued for as "three pixels up into the glass -- the one place on this elevation
 * where a dark mass crosses a light one". Rendered, the window's lower two panes sit at rows 14 to
 * 19 and the sill at 22: a bush topping at 17 swallowed BOTH lower panes and the sill with them, so
 * the window came back as a single blue block with a green hedge across its bottom half, the glazing
 * bars invisible and the four panes the board makes so much of reduced to two. The board's box hangs
 * below the sill and its tallest leaf just laps the sill's lip. That is what these numbers are: the
 * tallest finger reaches 22, the sill's own row, and nothing reaches the glass.
 */
const BUSH_TOP = [
  27, 26, 25, 24, 25, 26, 25, 23, 22, 22, 23, 24, 26, 25, 24, 23, 24, 25, 23, 22, 23, 25, 26, 27,
] as const;

/* The glass: one opening, three lights. The transom splits the narrow left light only. */
const GLASS_L = 7;
const GLASS_R = 24;
const GLASS_T = 6;
const GLASS_B = 19;
const MULLION = 12; // columns 12..13
const TRANSOM = 12; // rows 12..13, left light only

/**
 * The wolf's silhouette, as the top row of each of his ten columns, x = 15..24.
 *
 * A per-column profile rather than an ellipse or a blit, for the same reason the bushes in this file
 * use one: a curve reads as a blob and a hand-set profile reads as a creature. Two ears two pixels
 * wide reaching row 9, a four-row notch between them, and shoulders falling away at each side so the
 * lamp shows round him -- which is what makes him a shape against a light rather than a dark patch.
 *
 * He is deliberately NOT centred in his light. The board's wolf is pushed to the right of the glass
 * with the glow open beside him, which is what stops the window reading as a framed portrait.
 */
const WOLF_X = 15;
const WOLF_TOP = [17, 13, 9, 9, 13, 13, 9, 9, 13, 17] as const;
const WOLF_FOOT = GLASS_B;

/**
 * The wolf, standing in the lit room.
 *
 * GRADED, NOT FLAT. The brief on this round is that our masses have no form, and a silhouette is the
 * easiest place in the build to get that wrong: a single flat fill with a hard edge is exactly the
 * "flat sticker with a fat border" the review named on the crowns. He rolls from `wolf` 0.3 at the
 * ear tips -- where the window's own light catches the fur from behind -- down to 0.02 at his chest,
 * which is about luma 35 to 20. The roll is small in absolute terms because he must stay a
 * silhouette against a 200-luma glow, and it is the whole difference between a cut-out and an animal.
 */
function wolf(img: Img): void {
  for (let i = 0; i < WOLF_TOP.length; i++) {
    const x = WOLF_X + i;
    const top = WOLF_TOP[i]!;
    for (let y = top; y <= WOLF_FOOT; y++) {
      const down = (y - top) / Math.max(1, WOLF_FOOT - top);
      img.px(x, y, tone('wolf', clamp(0.3 - 0.28 * Math.pow(down, 0.6))));
    }
    img.px(x, top - 1, keyline('wolf')); // the silhouette's own edge against the lamp
  }
  // Two eye glints and an amber muzzle. The board's wolf is three times this size and can carry a
  // dark eye on dark fur; at ten pixels across, a lit eye is the only thing that reads as a face
  // rather than as a smudge, and the warm catch is the lamp behind him in any case.
  img.px(18, 14, tone('gold', 0.86));
  img.px(21, 14, tone('gold', 0.86));
  img.rect(19, 16, 2, 1, tone('gold', 0.42));
  img.px(19, 17, tone('gold', 0.2));
}

const cottageWindow: Painter = (img) => {
  plaster(img);

  // The keyline, as a filled block; the frame and the glass are laid inside it.
  img.rect(3, 1, 26, 23, FRAME_LINE);
  img.rect(2, 1, 28, 3, FRAME_LINE); // the lintel cap, a pixel proud at each shoulder

  /*
   * Frame face, rounded rather than flat: the board's frame is a moulding, brightest on its upper
   * left and turning under on its lower right.
   */
  for (let y = 2; y <= 22; y++)
    for (let x = 4; x <= 27; x++) {
      const dIn = Math.min(x - 4, y - 2, 27 - x, 22 - y);
      img.px(
        x,
        y,
        tone('wood', clamp(0.66 - 0.11 * dIn + 0.14 * (1 - (x - 4) / 23) - 0.12 * ((y - 2) / 20))),
      );
    }

  /*
   * The lit room, flooded across the whole opening, then the reveal, then the animal, then the bars
   * over the top of him. Order matters: the bars have to cross IN FRONT of the glass or the window
   * reads as a picture of a window.
   */
  lamp(img, GLASS_L, GLASS_T, GLASS_R - GLASS_L + 1, GLASS_B - GLASS_T + 1);
  /*
   * The reveal: the frame is a box and the glass sits at the back of it, so the inner edge is in
   * shadow all the way round. Without it the amber butts straight onto the lit timber face and the
   * opening has no depth -- the same fault the door had before it got its own reveal, and here it
   * matters more because the two values meeting are 200 and 160 of the same hue.
   */
  img.frame(GLASS_L - 1, GLASS_T - 1, GLASS_R - GLASS_L + 3, GLASS_B - GLASS_T + 3, FRAME_LINE);

  wolf(img);

  img.rect(MULLION, GLASS_T, 2, GLASS_B - GLASS_T + 1, tone('wood', 0.3)); // the mullion
  img.rect(MULLION, GLASS_T, 1, GLASS_B - GLASS_T + 1, tone('wood', 0.52)); // lit down its left
  img.rect(GLASS_L, TRANSOM, MULLION - GLASS_L, 2, tone('wood', 0.3)); // the transom, left light only
  img.rect(GLASS_L, TRANSOM, 4, 1, tone('wood', 0.46));

  /*
   * The sill, standing proud of the frame and lit along its top -- and STONE, not timber.
   *
   * The board's sill is a pale slab under a dark timber frame, and the brief names it as a cream
   * sill specifically. Drawn in `wood` it was the same material and nearly the same value as the
   * frame sitting on it, so the window had no bottom edge: frame, sill and flower box ran together
   * into one brown-green block. In cool `stone` it is the one bright horizontal on this part of the
   * elevation, it separates the frame above from the planting below, and it pairs with the door's
   * threshold and the chimney as the building's three pieces of worked stone.
   */
  img.rect(2, 22, 28, 1, tone('stone', 0.74));
  img.rect(2, 23, 28, 1, STONE_LINE);

  /*
   * The flower box: an ochre trough under a dense dark bush that spills over it and hides most of
   * it. Never a stem, and never a bloom on its own.
   *
   * The silhouette is fingered rather than an ellipse, so the top edge is a per-column profile and
   * not a curve. Each column then rolls from a lit lobe top down into the box, which is what gives
   * the mass its roundness without a single hard step.
   */
  for (let y = 25; y <= 29; y++)
    for (let x = 4; x <= 27; x++)
      img.px(x, y, tone('gold', clamp(0.5 - 0.34 * ((y - 25) / 4) + 0.04 * Math.sin(x * 1.9))));
  img.rect(3, 24, 1, 7, BOX_LINE);
  img.rect(28, 24, 1, 7, BOX_LINE);
  img.rect(4, 30, 24, 1, BOX_LINE);

  /*
   * Each column rolls from a lit lobe top down into the box. The brightening that used to be applied
   * to every column whose finger rose above its neighbour has gone: on a 24-column mass that is an
   * alternating stripe, and the box came out as a row of bright green blades rather than as a bush.
   * The roundness comes from the per-column fall and from the keyline over each lobe, nothing else.
   */
  for (let i = 0; i < BUSH_TOP.length; i++) {
    const x = 4 + i;
    const top = BUSH_TOP[i]!;
    for (let y = top; y <= 29; y++) {
      const down = (y - top) / Math.max(1, 29 - top);
      const lift = 0.07 * Math.cos((i - 9) * 0.5); // one broad highlight across the whole mass
      img.px(x, y, tone('canopy', clamp(0.4 + lift - 0.4 * Math.pow(down, 0.65))));
    }
    img.px(x, top - 1, keyline('canopy')); // the keyline over each lobe
  }
  img.rect(4, 29, 24, 1, keyline('canopy'));

  /*
   * Blooms: four petals and a warm centre, 3px across. White and pale pink, which is the board's
   * garden; the Lilac and Haze that used to be here are Red's own hues and belong to her alone.
   */
  for (const [bx, by, ramp] of [
    [6, 25, 'fur'],
    [11, 23, 'skin'],
    [17, 25, 'skin'],
    [22, 24, 'fur'],
  ] as const) {
    img.rect(bx + 1, by, 1, 3, tone(ramp, 0.66));
    img.rect(bx, by + 1, 3, 1, tone(ramp, 0.66));
    img.px(bx + 1, by, tone(ramp, 1));
    img.px(bx, by + 1, tone(ramp, 0.9));
    img.px(bx + 1, by + 1, tone('gold', 0.78));
    img.px(bx + 2, by + 2, tone(ramp, 0.4)); // the shaded petal, under and right
  }
};

/* --------------------------------------------------------------------- door */

/*
 * The front door: a stone surround, a segmental timber arch, a planked leaf, a threshold step, and
 * the planting either side of it.
 *
 * THIS IS THE GAME'S DESTINATION AND IT WAS A POSTAGE STAMP. The pass this replaces drew an 18-row
 * leaf between two 3-pixel jambs, unframed, with no step, sitting flush on the bottom edge of the
 * tile -- because the map used to lay `door` TWICE side by side, so the painter had to be symmetric
 * about its own centre (two identical tiles can repeat, never mirror) and could not carry an arch or
 * a surround without giving Grandma two front doors and two stone horseshoes. Everything structural
 * was bent around that constraint.
 *
 * THE CONSTRAINT IS GONE. `forest-map.ts` now lays ONE door tile, at `cx + 2`. So this is drawn as
 * the board draws it, measured off the Arrive frame's facade crop at 2x:
 *
 *   stone surround    large pale ashlar blocks up both jambs, each lit on its top-left, bedded on a
 *                     near-black joint -- after the roof, the biggest tonal event on the elevation
 *                     and the thing that frames the doorway from across the lawn
 *   segmental arch    a timber band over the opening, rising four rows from jamb to crown, with the
 *                     plaster spandrel showing between the arch and the stone
 *   the leaf          four planks, lit down each left edge, with the brass cross-muntin light the
 *                     board centres on it
 *   threshold         a stone slab PROJECTING past the opening, lit along its tread, over the one
 *                     base keyline the facade gets -- `wall` repeats fourteen times and cannot
 *                     carry one, so the building meets the ground here and nowhere else
 *   planting          a low bush at each side, which is what stops the doorway reading as a decal
 *                     and seats the whole building on the grass
 *
 * The rebrand holds: the surround and the step are cool `stone` against the warm slate above, the
 * arch and the leaf are `wood`, the light is `gold`, and nothing here is purple -- that is Red's.
 */

/** The opening, and the stone that frames it. */
const JAMB_W = 5; // columns 0..4 and 27..31
const OPEN_L = JAMB_W;
const OPEN_R = TILE - JAMB_W - 1;
const DOOR_FOOT = 26; // the leaf's last row; 27 is the gap beneath it
const STEP_Y = 28;

/**
 * The top of the opening at column `x`: a SEGMENTAL arch, four rows of rise across 22 columns.
 *
 * Segmental rather than semicircular on purpose. A half round over a 22-wide opening is an 11-row
 * dome, which in a 32-row tile leaves no leaf under it; the board's arch is shallow, and shallow is
 * also what survives at a 26-tile camera, where a dome just reads as a blur.
 */
function archTop(x: number): number {
  const u = (x - (OPEN_L + OPEN_R) / 2) / ((OPEN_R - OPEN_L) / 2);
  return 3 + Math.round(4 * u * u);
}

/* Plank boundaries across the leaf's 22 columns: 6, 5, 6, 5. */
const PLANKS = [OPEN_L, OPEN_L + 6, OPEN_L + 11, OPEN_L + 17, OPEN_R + 1] as const;
/*
 * THE LEAF HAS COME DOWN BY ABOUT THIRTY-FIVE LUMA, and this is the measured half of the review's
 * third fault -- "the DOOR is a one-tile brown smudge at play scale".
 *
 * The smudge is a contrast problem before it is a detail problem. Measured down the centre of the
 * board's own door, its leaf sits between luma 76 and 102 against a wall at about 210: the opening
 * is less than half the value of what surrounds it, which is what makes it the focal point of the
 * Arrive frame from across the lawn. Ours ran 110 to 160 against a wall at 174 -- a 65-luma
 * difference where the board has 110 -- so at a 26-tile camera the door was a slightly darker patch
 * of the same facade, and no amount of muntin light or ashlar detail survives at that separation.
 * Brightening the wall to 203 made it worse before this changed, not better.
 *
 * These stops put the leaf at roughly 83 to 116 once the plank lean and the fall towards the foot
 * are applied, which is the board's own range. The detail inside it is unchanged; it is simply now
 * drawn on something dark enough to read as a doorway.
 */
const PLANK_T = [0.24, 0.34, 0.2, 0.3] as const;

/**
 * The bush at each side of the step, as a per-column top row. Three uneven lobes, never a curve.
 *
 * Kept to six rows. The board banks its planting right up the wall, but the board's wall is broken
 * by a gable, corner posts and a vine; ours is a plain field, and a tall mass here would read as a
 * hedge growing out of the doorstep rather than as planting beside it.
 */
const DOOR_BUSH_L = [28, 26, 25, 26, 28, 30] as const;
const DOOR_BUSH_R = [30, 28, 26, 25, 26, 28] as const;

/*
 * One ashlar block face, lit on its top-left corner, bedded on a near-black joint.
 *
 * SEVEN ROWS TO A COURSE, NOT FIVE. At five, a jamb four pixels wide gives blocks of 4 by 4 with a
 * one-pixel joint between them -- a fifth of the surface is joint, and rendered it came back as a
 * grey ladder propped either side of the door rather than as masonry. The board's surround is four
 * big blocks up the height of the opening. Seven rows gives four here too, and the joint drops to a
 * seventh.
 *
 * AND IT IS BACK UP TO 0.78. It was taken to 0.66 to hold it under the slate's lit cap, on the same
 * mistaken reading of the board's tonal order that drove the plaster down to 175 -- see `plasterAt`
 * for why that reading was backwards. With the wall now at about 203 a surround at 179 was the
 * nearer of two greys on a cream field and simply disappeared into it. At 0.78 it is about 190:
 * still below the plaster, so it does not pull the eye off the opening, but far enough from it, and
 * cool enough against it, to read as worked stone rather than as a stain.
 *
 * What actually carries the surround at a 26-tile camera is not its face value but the near-black
 * bed joint every seventh row and the keyline up its outer edge. Those are unchanged.
 */
const COURSE_H = 7;

function ashlar(img: Img, x: number, y: number, dx: number, course: number): void {
  const down = y % COURSE_H;
  if (down === 0) {
    img.px(x, y, STONE_LINE);
    return;
  }
  const t =
    0.78 -
    0.22 * ((down - 1) / (COURSE_H - 2)) -
    0.12 * (dx / (JAMB_W - 2)) +
    0.06 * Math.sin(course * 2.1 + dx * 0.8);
  img.px(x, y, tone('stone', clamp(t)));
}

/** A low bush: a lit crown rolling down into its own shade, under a keyline. */
function doorBush(img: Img, x0: number, tops: readonly number[]): void {
  for (let i = 0; i < tops.length; i++) {
    const x = x0 + i;
    const top = tops[i]!;
    for (let y = top; y <= 31; y++) {
      const down = (y - top) / Math.max(1, 31 - top);
      img.px(x, y, tone('canopy', clamp(0.5 - 0.46 * Math.pow(down, 0.7))));
    }
    img.px(x, top - 1, keyline('canopy'));
  }
}

const cottageDoor: Painter = (img) => {
  plaster(img);

  /*
   * The stone surround. The outermost column of each jamb is the keyline rather than a block face:
   * worked stone meeting plaster with no line between them goes mushy at this size, and it is the
   * one vertical near-black on the elevation, which is most of what carries the doorway across a
   * lawn.
   */
  for (let y = 0; y < STEP_Y; y++) {
    img.px(0, y, STONE_LINE);
    img.px(TILE - 1, y, STONE_LINE);
    const course = Math.floor(y / COURSE_H);
    for (let dx = 0; dx < JAMB_W - 1; dx++) {
      ashlar(img, 1 + dx, y, dx, course);
      ashlar(img, TILE - 2 - dx, y, dx, course);
    }
  }

  for (let x = OPEN_L; x <= OPEN_R; x++) {
    const head = archTop(x);

    /*
     * The arch band, and its keyline above and below. Above it, plaster: the spandrel.
     *
     * It comes down with the leaf, but not as far. On the board the arch over the opening is a
     * medium brown that stays visibly lighter than the leaf hanging inside it -- that difference is
     * what says the leaf is set BACK in its opening rather than flush with the face of the wall.
     * Holding the old 0.76/0.56/0.34 against a leaf that now runs 83 to 116 would have made the
     * arch the brightest timber on the elevation and flattened the reveal it exists to describe.
     */
    img.px(x, head - 1, WOOD_LINE);
    for (const [r, t] of [
      [0, 0.62],
      [1, 0.46],
      [2, 0.3],
    ] as const)
      img.px(x, head + r, tone('wood', t));
    img.px(x, head + 3, WOOD_LINE);

    /*
     * The leaf. Lit down each plank's left edge, from the same top-left sun as everything else on
     * this elevation, and shaded towards the foot so the door sits INSIDE its opening rather than
     * being painted flat across it.
     */
    let p = 0;
    while (p < PLANK_T.length - 1 && x >= PLANKS[p + 1]!) p++;
    const u = (x - PLANKS[p]!) / (PLANKS[p + 1]! - 1 - PLANKS[p]!);
    for (let y = head + 4; y <= DOOR_FOOT; y++) {
      // The seam between two planks grades over two columns. Same material meeting itself does not
      // need a keyline, and a single one-pixel plunge puts a counted edge on both of its sides.
      const t =
        PLANK_T[p]! +
        0.17 * (1 - u) -
        (u > 0.9 ? 0.27 : u > 0.76 ? 0.12 : 0) -
        0.16 * ((y - head) / (DOOR_FOOT - head));
      img.px(x, y, tone('wood', clamp(t)));
    }
    img.px(x, 27, WOOD_LINE); // the gap under the leaf
  }

  /*
   * THE REVEAL: a near-black line down each side of the opening, between the stone jamb and the
   * leaf hanging inside it.
   *
   * A door leaf is set back behind the face of its surround, so there is always a sliver of shadow
   * where the two meet. Without it the leaf butts straight onto the ashlar and the whole doorway
   * reads as flat marquetry laid on the wall -- which, with a pale surround now at 190 beside a
   * leaf at 100, is the one place on this elevation where two materials of very different value
   * meet with nothing between them.
   *
   * It costs two of the leaf's twenty-two columns and buys the opening its depth, which at a
   * 26-tile camera is the only thing about this door that is legible at all.
   */
  img.rect(OPEN_L, archTop(OPEN_L) + 4, 1, DOOR_FOOT - archTop(OPEN_L) - 3, WOOD_LINE);
  img.rect(OPEN_R, archTop(OPEN_R) + 4, 1, DOOR_FOOT - archTop(OPEN_R) - 3, WOOD_LINE);

  /*
   * The brass light: a cross-muntin of four panes over the same navy glass as the wall windows, and
   * with the knob the only gold on the building.
   */
  img.rect(12, 13, 8, 7, tone('gold', 0.5));
  img.rect(12, 13, 8, 1, tone('gold', 0.9));
  img.rect(12, 13, 1, 7, tone('gold', 0.9));
  img.rect(12, 19, 8, 1, tone('gold', 0.14));
  img.rect(19, 13, 1, 7, tone('gold', 0.14));
  pane(img, 13, 14, 2, 2);
  pane(img, 17, 14, 2, 2);
  pane(img, 13, 17, 2, 2);
  pane(img, 17, 17, 2, 2);
  img.rect(15, 14, 2, 5, tone('gold', 0.46));
  img.rect(15, 14, 1, 5, tone('gold', 0.74));
  img.rect(13, 16, 6, 1, tone('gold', 0.46));
  img.rect(13, 16, 3, 1, tone('gold', 0.7));

  // The knob, on the swing side.
  img.rect(22, 21, 2, 3, tone('gold', 0.56));
  img.px(22, 21, tone('gold', 0.92));
  img.rect(22, 24, 2, 1, WOOD_LINE);

  /*
   * The threshold: a stone slab standing proud of the opening on both sides, lit along its tread and
   * turning under to its nosing, then the keyline where the building meets the ground.
   */
  for (const [row, t] of [
    [STEP_Y, 0.86],
    [STEP_Y + 1, 0.56],
    [STEP_Y + 2, 0.28],
  ] as const)
    img.rect(2, row, TILE - 4, 1, tone('stone', t));
  img.rect(0, STEP_Y, 2, 3, STONE_LINE);
  img.rect(TILE - 2, STEP_Y, 2, 3, STONE_LINE);
  img.rect(0, TILE - 1, TILE, 1, STONE_LINE);

  /*
   * THE PAW PRINTS, on the doorstep, and they are the other half of the premise.
   *
   * The board lays a trail of them across the sand from the gate to the door: that is how a player
   * standing at the fence knows what went in before them, and it is the one piece of staging that
   * makes the Arrive frame a scene rather than a picture of a house. The trail across the APPROACH
   * belongs to the path and grass tiles and is escalated at the head of this file. The two on the
   * threshold belong here, they are the last two of that trail, and they are the pair that actually
   * lands the point -- muddy prints on Grandma's own clean step, going IN.
   *
   * Drawn in the window frames' own near-black `trunk`, which is mud rather than ink, on a tread at
   * about luma 190: the strongest small contrast anywhere on the facade, which is what a 5x3 mark
   * needs to survive a 26-tile camera. Three toes over a pad, twice, the second one further in and
   * half a step up, so they read as a stride rather than as a stamp.
   */
  for (const [px, py] of [
    [8, STEP_Y],
    [17, STEP_Y + 1],
  ] as const) {
    for (const dx of [0, 2, 4]) img.px(px + dx, py, tone('trunk', 0.1));
    img.rect(px + 1, py + 1, 3, 1, FRAME_LINE);
    if (py + 2 < TILE - 1) img.rect(px + 1, py + 2, 3, 1, tone('trunk', 0.06));
  }

  // The planting, last, so it sits in front of the step and the jambs.
  doorBush(img, 0, DOOR_BUSH_L);
  doorBush(img, TILE - DOOR_BUSH_R.length, DOOR_BUSH_R);
  for (const [bx, by, ramp] of [
    [1, 26, 'fur'],
    [3, 24, 'skin'],
    [27, 24, 'fur'],
    [29, 26, 'skin'],
  ] as const) {
    img.rect(bx, by + 1, 3, 1, tone(ramp, 0.68));
    img.rect(bx + 1, by, 1, 3, tone(ramp, 0.68));
    img.px(bx + 1, by, tone(ramp, 1));
    img.px(bx + 1, by + 1, tone('gold', 0.8));
    img.px(bx + 2, by + 2, tone(ramp, 0.4));
  }
};

/* ------------------------------------------------------------------ chimney */

/*
 * The chimney, drawn on transparency: the map puts it a row ABOVE the ridge, with grass behind it,
 * so it is the one piece here that owns a full silhouette and can be keylined with `outline()`.
 *
 * The board builds it out of large ashlar blocks, two across, each one separately jointed and
 * rounded on its own top-left, under a crown slab that overhangs both sides with the flue's dark
 * notch cut into it. It is unmistakably COOL grey against the warm roof below it, which is why it
 * paints from `stone` and the roof does not.
 *
 * IT HAS COME DOWN TWICE AND THE SECOND DROP IS THE ONE THAT MATTERS. The first took about fifteen
 * luma off a stack that was, after the wall, the brightest object in the Arrive frame. It still was:
 * rendered beside the board, this reads as a pale grey post standing on a roof, because the roof
 * under it had also been lightened to get its own courses legible and the two ended up at the same
 * value. A chimney is a solid against the sky and it has to be DARKER than the slope it rises from,
 * not lighter -- that difference is the whole of its silhouette, and the silhouette is the only
 * thing a 32-pixel object this far from the camera actually says. The block faces top out at 0.54
 * now, under the slate's lit cap, and the crown keeps a bright edge so the stack still has a top.
 */
const BLOCK_W = 10;
const BLOCK_H = 9;

/*
 * THE STACK AND ITS CROWN HAVE MOVED DOWN FIVE ROWS TO MAKE ROOM FOR SMOKE, and the smoke is the
 * point of this tile now.
 *
 * The board gives the cottage a plume: three pale puffs climbing up and to the right out of the
 * flue, the near one largest and the far one nearly gone. It is the only MOVING thing in the Arrive
 * frame, it is what says somebody is home, and in a story about a house that is not what it looks
 * like, smoke from the chimney is the lie the player can see from the gate. We had a bare post.
 *
 * It fits because the stack is only twenty of the tile's thirty-two columns wide and the tile is
 * drawn on transparency with grass behind it: the five rows the crown gives up cost the stack two
 * pixels of its lowest course and nothing else. The plume runs diagonally so it uses the corner the
 * stack does not, rather than needing height the tile does not have.
 *
 * NO ALPHA, so the puffs are built the way everything else in this file is: a pale crown inset up
 * and to the left over a darker body, which is a lit sphere rather than a flat disc. Nothing here is
 * keylined -- `outline()` runs before the smoke is drawn, deliberately. Vapour has no edge, and a
 * near-black ring round each puff would read as three grey rocks floating over the roof.
 */
const SMOKE_Y = 7; // rows 0..6 are the plume; the crown starts here
const STACK_Y = SMOKE_Y + 6; // and the stack below the crown

/** Three puffs, up and to the right, thinning as they go: x, y, radius, tone. */
const PLUME = [
  [15.5, 5, 3.1, 2.3, 0.92],
  [19.5, 2.6, 2.5, 1.9, 0.84],
  [23, 0.6, 1.9, 1.5, 0.76],
] as const;

const chimney: Painter = (img) => {
  for (let y = STACK_Y; y < TILE; y++)
    for (let x = 6; x < 26; x++) {
      const row = Math.floor((y - STACK_Y - 1) / BLOCK_H);
      const off = (((row % 2) + 2) % 2) * 5; // the bond alternates course by course
      const bx = (((x - 6 - off) % BLOCK_W) + BLOCK_W) % BLOCK_W;
      const by = (((y - STACK_Y - 1) % BLOCK_H) + BLOCK_H) % BLOCK_H;
      if (bx === 0 || by === 0) {
        img.px(x, y, tone('stone', 0.04)); // the bed and perpend joints
        continue;
      }
      // Each block rounds from its lit top-left corner down and across, with a fine mottle on top
      // of it: the board's ashlar is blotchy, not flat, and the mottle is small enough that no two
      // neighbouring pixels differ by enough to read as an edge.
      const t =
        0.54 -
        0.28 * ((by - 1) / (BLOCK_H - 2)) -
        0.17 * ((bx - 1) / (BLOCK_W - 2)) +
        0.05 * Math.sin(x * 1.7 + y * 2.3);
      img.px(x, y, tone('stone', clamp(t)));
    }
  img.rect(25, STACK_Y, 1, TILE - STACK_Y, tone('stone', 0.06)); // the stack's shaded right face

  // Crown, overhanging the stack, with the flue's opening notched into its top. It keeps its lit
  // edge -- the stack went dark, and without one bright row the whole thing loses its top.
  for (let y = SMOKE_Y; y < STACK_Y; y++)
    for (let x = 3; x < 29; x++)
      img.px(x, y, tone('stone', clamp(0.72 - 0.46 * ((y - SMOKE_Y) / 5) - 0.12 * ((x - 3) / 25))));
  img.rect(3, STACK_Y - 1, 26, 1, tone('stone', 0.08)); // the dark under-edge of the overhang
  img.rect(11, SMOKE_Y, 10, 3, tone('night', 0.35)); // the flue
  img.rect(11, SMOKE_Y, 10, 1, keyline('night', 10));

  img.outline(STONE_LINE);
  // outline() cannot give the 2px band on the side the light does not reach, so the shade-side
  // keyline is thickened by hand -- against the stack only, where the mass is 20 wide. The crown is
  // left at one pixel: a second line beside a 6px-tall overhang reads as a loose tick floating off
  // the chimney rather than as a thicker edge.
  img.rect(27, STACK_Y + 2, 1, TILE - STACK_Y - 2, STONE_LINE);

  /*
   * The smoke, drawn last and deliberately after `outline()`, exactly as the note above `PLUME`
   * says: vapour has no edge, and a near-black ring round each puff would read as three grey rocks
   * floating over the roof. The board's cottage has a plume, which is most of what says somebody is
   * home -- and this is the detail the whole errand is walking toward.
   *
   * Each puff is a lit sphere rather than a flat disc: a body at the puff's own tone with a
   * brighter core set up and to the left, where the light comes from.
   */
  for (const [px, py, rx, ry, t] of PLUME) {
    img.ellipse(px, py, rx, ry, tone('stone', clamp(t - 0.18)));
    img.ellipse(px - rx * 0.28, py - ry * 0.28, rx * 0.6, ry * 0.6, tone('stone', clamp(t)));
  }

  /*
   * The plume, LAST, after `outline()`, so the stonework keeps its silhouette and the smoke does not
   * get one. Each puff is a darker body with a lit crown set up and to the left of it, from the same
   * top-left sun as every other object on this building.
   */
  for (const [px, py, rx, ry, t] of PLUME) {
    img.ellipse(px, py, rx, ry, tone('stone', clamp(t - 0.3)));
    img.ellipse(px - 0.5, py - 0.6, rx - 0.7, ry - 0.5, tone('stone', clamp(t)));
  }
};

export const COTTAGE_TILES: Record<string, Painter> = {
  wall: cottageWall,
  'wall-window': cottageWindow,
  door: cottageDoor,
  'roof-l': roof('left'),
  'roof-m': roof('middle'),
  'roof-r': roof('right'),
  'roof-peak': roof('peak'),
  chimney,
};
