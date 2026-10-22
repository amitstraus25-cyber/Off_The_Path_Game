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
 * the plaster was fourteen of the eighteen facade tiles -- which is why the one thing that must not
 * happen here is a bright blank wall. It was 225 luma; it is now about 198. (The facade is five
 * columns and one wall course now, so the plaster is the surround of the openings rather than the
 * field between them; the rule it set is the one that mattered and it still holds.)
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
 * saturated figure in the frame is Purple herself, and the garden flowers are white, pink and yellow;
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
 * TWO THINGS THIS BUILDING NEEDS THAT ARE NOT IN THIS FILE, raised rather than faked, now that
 * `TILE_NAMES` is unfrozen and both are buildable by whoever owns `tiles.ts`, `forest-map.ts` and
 * `map-forest.json` together:
 *
 *   - IT IS THE WRONG SHAPE, and no amount of detail fixes that from in here. `forest-map.ts` lays
 *     the facade six tiles wide and three tiles of wall deep -- eighteen wall tiles -- against
 *     ART_DIRECTION section 9.1's four wide, two of wall and one and a half of roof. Rendered, the
 *     middle wall course is six tiles of unbroken plaster with nothing on it, because the windows
 *     are on the course below and a tile laid fifteen times cannot carry a one-off. Half the
 *     elevation is blank for a layout reason, not a painting one. Narrowing it to four columns and
 *     two wall courses would put the windows, the door, the quoins and the planting into one dense
 *     facade, which is the board's.
 *     [DONE -- see the block at the foot of this comment. It went to five columns and ONE course of
 *     wall rather than four and two, and the reasoning for that is there.]
 *   - A SECOND WINDOW TILE, `wall-window-lit`, so the board's amber-and-wolf window can exist
 *     without appearing on every ending. The argument is at the head of the window section.
 *
 * ONE OF THOSE FOUR HAS NOW BECOME AVAILABLE AND IS TAKEN. `forest-map.ts` used to lay `door` twice
 * side by side, so a 32-wide painter had to be symmetric about its own centre and a single arch with
 * its own stone surround was impossible. The map now lays ONE door tile at `cx + 2`. The symmetry
 * constraint is gone with it, and `cottageDoor` is rebuilt as the board's doorway: a stone surround,
 * a segmental timber arch, a planked leaf, a threshold step and the bushes either side.
 *
 * =============================================================================================
 * AND THE SHAPE ASK IS NOW DONE, WHICH CHANGES THE PREMISE OF HALF THE NOTES BELOW. READ THIS
 * BEFORE BELIEVING ANY SENTENCE IN THIS FILE THAT BEGINS "`wall` IS LAID N TIMES".
 * =============================================================================================
 *
 * The facade was six columns wide with two courses of wall -- eighteen tiles, fourteen of them plain
 * `wall`, and a whole upper course of them that nothing could be drawn on, because the door's
 * threshold is the ground and the window boxes hang off their sills, so both are painted at the FOOT
 * of their tile and only the lower course can carry an opening. That upper course measured, on the
 * composed payoff frame, as 1,556 pixels of unbroken featureless cream -- "roughly four tiles of
 * empty cream in the middle of the payoff shot", which is what the product manager finally called it.
 *
 * `forest-map.ts` now lays the facade FIVE COLUMNS WIDE WITH ONE COURSE OF WALL:
 *
 *     the gable and chimney row      gable, gable mirrored, and `chimney` at the east end
 *     the ridge row                  `roof-peak` x5
 *     the slope row                  `roof-l`, `roof-m` x3, `roof-r`
 *     the wall                       `wall-corner`, `wall-window`, `door`, `wall-window-lit`,
 *                                    `wall-corner` mirrored
 *
 * Three consequences, and every one of them matters to somebody editing this file:
 *
 *   1. PLAIN `wall` IS NO LONGER LAID ANYWHERE ON THE MAP. It is still painted -- `TILE_NAMES` order
 *      is gid order and removing it would repaint every tile on the map -- and `plaster()` is still
 *      the surface under the windows, the corner posts, the door's surround and the gable's
 *      tympanum. So the plaster work is all still on screen; the tile that was fourteen eighteenths
 *      of the facade is simply not one of its tiles any more.
 *   2. THE "A TILE LAID N TIMES CANNOT CARRY A MOTIF" ARGUMENT NO LONGER BINDS THE WAY IT DID, and
 *      it is the premise of the three rejected weathering schemes in `wrapNoise`, of the trowel
 *      striation in `plasterT`, of the ghost masonry in `stoneAt`, of the mid-rail reading of
 *      `sillPlate`, and of the "a shadow that happens once on the elevation" refusals in `eave` and
 *      `cottageDoor`. Plaster now appears in five tiles: `wall-corner` twice (mirrored), the two
 *      window tiles once each, and the door once. Each is laid in ONE known place. A one-off mark --
 *      quoins at the outer corners, ivy on one of them, a cast shadow that happens once -- is
 *      buildable for the first time. Nothing in this round spends that; it is recorded so the next
 *      owner does not re-derive a constraint that has lifted.
 *   3. THE WALL IS NOW THE BOARD'S HEIGHT. The roof tiles carry the top eleven rows of the wall
 *      (`EAVE_Y` puts the fascia at row 20 of `roof-l/m/r` and the overhang's shadow on plaster
 *      beneath it), so one 32-pixel course of openings under them is 42 pixels of wall, not 32.
 *      Measured against Purple -- 48 pixels tall here, 162 of the mock's own pixels in its Arrive frame
 *      -- the board's cottage is 49 pixels of wall under about 48 of roof. Ours is 42 under 54.
 *      Within seven pixels on a 96-pixel elevation, where it used to be 75 under 53.
 */
import { ember, Img, keyline, lumaOf, mix, rose, smooth, TILE, tone } from '../paint.ts';
import type { Painter, RGBA } from '../paint.ts';

/**
 * How far in from the end of the facade the WALL stops, so that the roof above it can hang past it.
 *
 * Sixteen pixels, half a tile, measured off the board -- the full argument is above `eave`, and the
 * two tiles that share this number are `wall-corner` and `roof-l`/`roof-r`. It is declared up here
 * only because `POST_L` is computed from it and module constants are evaluated in order.
 */
const WALL_IN = 16;

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

/*
 * `clamp` STAYS, and it stays under its own name, which is worth a line because it looks exactly
 * like the `clamp01` this round deleted five copies of.
 *
 * `w-trees.ts` also has a `clamp` and it clamps to -1..1, not 0..1. Two functions with one name and
 * different ranges is the trap here: merging by name would have silently rescaled every weight in
 * one of the two files. They are left apart deliberately, and renaming this one to `clamp01` is a
 * rename of every call site in this file for no behaviour change, which is not a ship-day edit. The
 * promoted `clamp01` in `paint.ts` is the one new code should reach for.
 */
const clamp = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

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
  const step = TILE / cells;
  return (x, y) => {
    const fx = x / step;
    const fy = y / step;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    // `fx - x0` is a fraction in 0..1 by construction, which is `smooth`'s precondition.
    const ax = smooth(fx - x0);
    const ay = smooth(fy - y0);
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
 * THE BASE IS NOW 0.42, measured rather than felt, and it has come up twice -- 0.11, then 0.26, now
 * 0.42. Probed across the board's own facade at native resolution (row y=1330) the sequence through
 * a quoin reads `229 225 222 | 140 | 167 170 173 173 170 | 139`: its plaster is 222 to 229 and its
 * worked stone is 167 to 173, a separation of fifty-five luma. At 0.26 ours came back at about 203,
 * with a door surround at 190 that it simply swallowed. 0.42 puts it at about 217 against a surround
 * now at 157 -- the board's own interval, and the reason the stonework reads at all.
 *
 * THE STRIATION IS THE "INCIDENT" THE REVIEW ASKED FOR, and it is the only kind of incident a tile
 * laid eighteen times can carry. Timber, quoins and weathering patches were all considered again
 * and all fail the same way: `wall` cannot know where it is on the elevation, so any MOTIF is drawn
 * eighteen times on a 6x3 lattice and rules a grid across the facade -- which is what the three
 * earlier attempts recorded in `wrapNoise` each discovered in their own way. A trowel striation is
 * not a motif: it has no shape to repeat, it closes on the tile in y (period 32/5), and its phase is
 * dragged about by the noise so it never rules a straight line. Six soft horizontal passes per tile
 * is what a plasterer's float leaves, it is visible on the board between the gable and the right
 * slope, and at about eight luma it reads at the playing camera without touching the silhouette.
 */
function plasterT(x: number, y: number): number {
  return (
    0.42 +
    0.07 * (LIT[0](x, y) - 0.5) +
    0.15 * (LIT[1](x, y) - 0.5) +
    0.22 * (LIT[2](x, y) - 0.5) +
    0.17 * (LIT[3](x, y) - 0.5) +
    /*
     * THE TROWEL IS BACK DOWN TO A QUARTER OF ITS AMPLITUDE, AND THE ROUND THAT DOUBLED IT WAS
     * ANSWERING A FAULT THAT HAD A DIFFERENT CAUSE.
     *
     * It was taken to 0.13 because the review said "the wall is a large blank cream rectangle and
     * the trowel striation is invisible at 1x". The striation duly became visible. Rendered at 1x
     * beside the board's own plaster (`2060 1250 230 230 3`) what it reads as is GRAIN: nine levels
     * of horizontal banding over fifteen tiles is a sheet of sanded timber or a bed of silt, and it
     * was the first thing the eye found on the elevation -- the board's plaster has no horizontal
     * anything in it. What the board has is soft, irregular, slightly COOLER weathering patches a
     * few pixels across, which is what the hashed octaves above already draw.
     *
     * The blankness the review named was a VALUE problem, not a texture one: at 175 luma the wall
     * sat two luma off its own roof, so wall and roof read as one object and the wall looked bare
     * because it had no edges anywhere near it. That is fixed in the base term, which is now 0.42.
     *
     * Two passes are kept rather than one, at periods of 32/5 and 32/9 rows, because a single sine
     * is a corduroy -- and at about three luma each they are a float mark you feel rather than a
     * stripe you can trace. Both still close on the tile, and the phase of each is dragged about by
     * its own octave of the noise, so neither ever rules a straight line across the six columns.
     */
    0.035 * Math.sin((Math.PI * 5 * y) / 16 + 6 * (LIT[1](x, y) - 0.5)) +
    0.02 * Math.sin((Math.PI * 9 * y) / 16 + 5 * (LIT[2](x, y) - 0.5))
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
    0.13 +
      0.2 * (COOL[0](x, y) - 0.5) +
      0.19 * (COOL[1](x, y) - 0.5) +
      0.12 * (COOL[2](x, y) - 0.5) +
      0.08 * (COOL[3](x, y) - 0.5),
  );
}

/* -------------------------------------------------------- the stone under it */

/*
 * THE STONE SHOWING THROUGH THE PLASTER, which is the review's first named fault on this building:
 * "the wall is a vast flat cream plane ... roughly 100 by 190 px carrying only the faintest mottle,
 * with the openings crammed into the bottom quarter and the top three-fifths dead. The board's
 * plaster has irregular stone blocks visible through it across the WHOLE wall, not only at the door."
 *
 * Crop the board at `2340 1180 200 300 4` -- the strip between the door and the lit window -- and
 * there are two quite different things on it. Beside the opening the quoins are full ashlar: hard
 * grey blocks, about fifty luma under the plaster, which this file already draws in `ashlar`. Away
 * from the opening the same masonry is a GHOST: soft grey rectangles a few pixels across, maybe
 * twenty luma down, scattered irregularly with whole stretches of clean plaster between them. It is
 * a rubble wall that has been limewashed, and the wash has worn thin over some stones and not others.
 *
 * WHY THIS IS SAFE WHEN A MOTIF IS NOT. `wrapNoise`'s own note records three weathering schemes that
 * each failed because `wall` is laid five times -- four across the upper course and once beside the
 * door -- so anything with a SHAPE is drawn five times on a lattice and rules a grid across the
 * facade. A stone bond is the one exception, and for a reason rather than by luck: coursed masonry is
 * ALREADY a repeating pattern, so a viewer reads the repeat as the material rather than as a seam.
 * The things that would still betray the tile are a distinctive blotch or a block cut in half at the
 * edge, and both are handled: the courses wrap on 32 in x, the course height divides 32 so the beds
 * line up across the two wall rows, and which stones show is a wrapping noise field rather than a
 * hand-placed mark.
 *
 * THE BLOCKS ARE NOT ALL THE SAME SIZE and no two courses break in the same place, which is what
 * separates rubble from brick. Each course's seams are listed as positions modulo 32; the widths
 * between them run 8 to 13.
 */
const STONE_COURSE_H = 8; // four courses to a tile, so the beds line up across the two wall rows
const STONE_SEAMS = [
  [0, 11, 21],
  [6, 17, 25],
  [3, 12, 24],
  [8, 19, 28],
] as const;

/*
 * Which stones have worn through, and how each one weathers. Both wrap on the tile.
 *
 * THE MASK IS SAMPLED FINER THAN A BLOCK IS WIDE, at eight cells to the tile against the four a
 * first render used. At four cells a lattice feature is eight to sixteen pixels across and a block
 * is eight to thirteen, so neighbouring stones kept drawing the same number and came through in
 * RUNS -- whole courses revealed end to end, with their bed joints meeting into unbroken horizontals.
 * Rendered, that is a blockwork wall: the thing the board draws around its door and nowhere else.
 * At eight cells each stone gets its own draw, so what shows is a scatter.
 */
const STONE_SHOW = wrapNoise(31, 8);
const STONE_GRAIN = wrapNoise(32, 8);

/**
 * The block containing column `x` in `course`: its left seam and its width.
 *
 * The seams are a sorted ring, so the block for a column left of the first seam is the LAST block of
 * the course wrapped round the tile edge -- which is what makes a stretch of wall six tiles wide read
 * as one bond instead of as six panels.
 */
function stoneBlock(x: number, course: number): [number, number] {
  const seams = STONE_SEAMS[course]!;
  let left: number = seams[seams.length - 1]! - TILE;
  let right: number = seams[0]!;
  for (let j = 0; j < seams.length; j++)
    if (x >= seams[j]!) {
      left = seams[j]!;
      right = j === seams.length - 1 ? seams[0]! + TILE : seams[j + 1]!;
    }
  return [left, right - left];
}

/**
 * The plaster at one point with whatever stone shows through it, or the plaster unchanged.
 *
 * `reveal` is per BLOCK rather than per pixel -- sampled at the block's own centre -- because
 * limewash wears off a whole stone at a time. A per-pixel mask gives a stone with a ragged hole in
 * the middle of it, which at this size is a smudge rather than a block.
 *
 * The target values are the board's ghost stones, not its quoins: the face lands about twenty luma
 * under the plaster and the bed and perpend joints about forty-five under it, against `ashlar`'s
 * fifty-five for worked stone at the opening. That interval is the whole point. A wall whose rubble
 * reads as strongly as its dressed quoins has no hierarchy, and the quoins are what carry the door.
 */
function stoneAt(x: number, y: number, c: RGBA): RGBA {
  const course = Math.floor(((((y % TILE) + TILE) % TILE) / STONE_COURSE_H) % STONE_SEAMS.length);
  const [left, w] = stoneBlock(x, course);
  const cx = left + (w - 1) / 2;
  const cy = course * STONE_COURSE_H + STONE_COURSE_H / 2;
  /*
   * ABOUT A THIRD OF THE STONES SHOW, not nine tenths. The first render thresholded at 0.44 over a
   * ramp of 3.2 and brought nearly every block through at nearly full strength, which is a wall of
   * blockwork however softly each block is drawn -- the board's plaster has long clean stretches
   * between its ghosts, and the clean stretches are half of what says "limewash" rather than "wall".
   */
  const reveal = clamp((STONE_SHOW(((cx % TILE) + TILE) % TILE, cy) - 0.52) * 2.6);
  if (reveal <= 0) return c;
  const top = course * STONE_COURSE_H;
  if (x === left || y === top)
    /*
     * The bed and the perpend, one pixel each, and only where a stone has worn through strongly: a
     * joint drawn across clean plaster would rule the bond over the whole wall, and a joint under a
     * stone that is barely showing draws the bond louder than the stone it belongs to.
     */
    return reveal < 0.45 ? c : mix(c, tone('stone', 0.22), 0.3 * reveal);
  /*
   * The face, lit on its own top-left like every other surface on this building, with a fine grain
   * over it so no two stones come out at the same value. The grain is worth about six luma, which is
   * under the twenty-four the edge axis counts, so it buys colour without buying edges.
   */
  const u = (x - left) / Math.max(1, w - 1);
  const v = (y - top) / (STONE_COURSE_H - 1);
  const lit = 0.1 - 0.14 * u - 0.12 * v + 0.12 * (STONE_GRAIN(x, y) - 0.5);
  return mix(c, tone('stone', clamp(0.52 + lit)), 0.26 * reveal);
}

/**
 * The plaster colour at one point, optionally pushed `k` of the way into the eave's shadow.
 *
 * THE GREY MIX IS DOWN TO 0.13 AND THE VALUE COMES OFF `wall` INSTEAD. Buying brightness or
 * darkness on the `stone` axis closes the warm gaps -- an earlier pass at 0.58 landed at 10 and 8,
 * where the board's plaster sits at 8 between red and green and 21 between green and blue -- and a
 * cool off-white next to a slate roof makes the whole building read as one grey material. Lime
 * plaster is a WARM off-white, in light and in shade. The mix is back to doing what it is for,
 * which is weathering a warm surface rather than setting its value.
 *
 * THE GREY ALSO DEEPENS WHERE THE FIELD IS DARK, by half the field's own distance below 0.42. That
 * is a partial coupling and it is deliberate: the two noise fields stay independent, so the colour
 * path is still a surface rather than a line, but `wall` level 0 is a tan and the darkest plaster
 * would otherwise drift orange instead of into shade. It also buys range at the dark end without
 * clamping `t` at zero, which is where variety goes to die.
 */
function plasterAt(x: number, y: number, k = 0): RGBA {
  const raw = plasterT(x, y) * (1 - k);
  const t = clamp(raw);
  const cool = clamp(plasterCool(x, y) + 0.5 * (0.42 - t));
  let c = stoneAt(x, y, mix(tone('wall', t), tone('stone', clamp(0.25 + 0.9 * t)), cool));
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

/* ------------------------------------------------------------- the wall base */

/*
 * THE BUILDING LANDS ON THE GROUND, which is the review's third cottage fault: "the cream wall meets
 * bright lawn on a hard line and the building floats. Every tree in this world has a contact shadow;
 * the house has none. The board has a dark band at the wall base all the way along."
 *
 * WHAT THE BOARD ACTUALLY DRAWS THERE, from `1980 1400 700 230 3`: not a shadow. A warm BROWN BAND
 * three or four of our pixels deep running along the whole foot of the wall, with a near-black line
 * under it and the planting banked in front of it. It is a timber sill plate, the same timber as the
 * corner posts and the fascia -- which is the same reading of this facade the corner tile already
 * took, and took correctly.
 *
 * AND THAT IS WHY IT IS A PLATE AND NOT A SHADOW, because a shadow here is not available. The map
 * lays `wall` on BOTH wall courses -- four times across the upper one and once beside the door -- and
 * lays `wall-corner` on both as well, so whatever goes at the bottom of those tiles is also drawn
 * across the middle of the elevation, at the seam between the two courses. A five-row band of deep
 * shade there is a black stripe across the facade and reads as exactly what it is, the tile grid. A
 * timber rail there is a MID-RAIL, which is what a framed wall with corner posts has between its
 * courses, so the repeat is carpentry instead of a seam. The same three rows do both jobs: a sill
 * plate at the foot, a mid-rail at the junction, and the posts the rails die into were already here.
 *
 * It is deliberately slim -- one lit row, one face, one keyline -- because it is drawn twice. The
 * fascia above is the same three rows in the same ramp, so the elevation now reads as fascia, rail,
 * plate between two posts: one piece of joinery, which is what the board's does.
 *
 * ...AND IT IS NOT DRAWN TWICE ANY MORE. The wall is ONE course now (the block at the head of this
 * file), so there is no seam across the middle of the elevation for a mid-rail to cover and these
 * three rows do one job: the sill plate at the foot of the building, where the board draws it. The
 * compromise has simply gone away, and the drawing that was the compromise turns out to be the thing
 * the board has, so nothing here changes. What DOES become available is the deep shade the paragraph
 * above says is "not available" -- a cast shadow at the wall base happens once on the elevation now,
 * and a future pass may spend it. Kept slim regardless: the board's band is three or four of our
 * pixels and the plate is the thing the planting banks against, not the thing it hides.
 *
 * The near-black row is the one that matters for the complaint. It is the building's own contact
 * line, it runs the full width of every tile, and at the door the threshold step takes over in stone
 * -- a step projects into the light, so a bright tread breaking the band is the board's own picture
 * rather than a gap in ours.
 */
const PLATE_Y = TILE - 3; // the lit top edge of the rail; the keyline is the tile's last row

/** The three rows of rail across `x0..x1`, laid over whatever is already there. */
function sillPlate(img: Img, x0 = 0, x1 = TILE - 1): void {
  for (let x = x0; x <= x1; x++) {
    img.px(x, PLATE_Y, tone('wood', 0.74));
    img.px(x, PLATE_Y + 1, tone('wood', 0.4));
    img.px(x, PLATE_Y + 2, WOOD_LINE);
  }
}

/*
 * The four rows above the rail, taken down towards the shade the overhang casts.
 *
 * A plate sitting against plaster still has to be SEATED: the board's wall darkens for a few pixels
 * above its band, where the light coming down the wall stops reaching. Without it the rail is a brown
 * stripe painted across a flat cream field, which is the same fault one row down from where it was.
 */
const BASE_K = [0.08, 0.14, 0.24, 0.38] as const;

/** `k` for row `y`: how deep into the wall's own shade the foot of the plaster sits. */
function baseK(y: number): number {
  return BASE_K[y - (PLATE_Y - BASE_K.length)] ?? 0;
}

/**
 * The foot of the wall across `x0..x1`: the plaster seated into its own shade, then the rail.
 *
 * It reads back what is already drawn rather than painting plaster, so the flower box, the planting
 * and the corner post all go into the same shade as the wall they stand against. Fully transparent
 * pixels are left alone -- the overhang under `wall-corner` is grass, and a shaded pixel there would
 * be a floating smudge of brown on the lawn.
 */
function seatFoot(img: Img, x0 = 0, x1 = TILE - 1): void {
  for (let y = PLATE_Y - BASE_K.length; y < PLATE_Y; y++)
    for (let x = x0; x <= x1; x++) {
      const c = img.get(x, y);
      if (c[3] === 0) continue;
      img.px(x, y, mix(c, EAVE_SHADE, baseK(y)));
    }
}

/** The seating and the rail together: the whole foot, for the tiles with nothing hanging on it. */
function wallFoot(img: Img, x0 = 0, x1 = TILE - 1): void {
  seatFoot(img, x0, x1);
  sillPlate(img, x0, x1);
}

const cottageWall: Painter = (img) => {
  plaster(img);
  wallFoot(img);
};

/* ------------------------------------------------------------- the corner */

/*
 * THE BUILDING'S OUTER CORNER, and the board says it is TIMBER, not stone.
 *
 * This is worth being exact about, because the brief for this element asked for "grey stone quoins at
 * the corners and round the opening" and the board's own corner (`2040 1220 180 300 6`) shows
 * something else: a broad brown POST, about nine of our pixels wide, running the full height of the
 * wall from under the eave down into the planting, with a hard dark line down each of its edges. The
 * grey ashlar quoins are real and they are around the DOOR, where this file already draws them. At
 * the corners the board frames its plaster in the same timber as the window frames, the fascia and
 * the barge -- which is also why the facade reads as one carpentered object rather than as a wall
 * with things stuck on it.
 *
 * Timber is the better mark here anyway, and not only because it is what is drawn. Worked stone sits
 * about fifty luma below the plaster and brown timber sits about a hundred and twenty below it, so a
 * post is more than twice the corner event a quoin is, at the one place on the elevation where the
 * building has to stop against a bright lawn. A grey corner on a cream wall at the playing camera is
 * the "stain" this file's own ashlar note warned about.
 *
 * THE TILE IS ALSO WHAT MAKES THE ROOF OVERHANG, which is the half of its job that shows from across
 * the garden: its outer sixteen columns are transparent, so the wall stops half a tile in from the
 * end of the facade and the roof above it keeps going. See the note above `eave`.
 *
 * IT IS DRAWN AS THE LEFT CORNER AND LAID TWICE, the second one with Tiled's horizontal mirror bit,
 * which `forest-map.ts` already uses for the ground and the crowns and Phaser's loader already
 * honours. One asymmetry survives the mirror and is accepted rather than hidden: the catch is on the
 * post's OUTER arris, so on the right-hand copy it falls on the right-hand face. On a real building
 * lit from the top-left that face would be in shade. It is one pixel of a nine-pixel post at the far
 * side of the frame, and the alternative is a second tile and a second gid for a mirror image.
 */
const POST_L = WALL_IN + 1; // the post's lit outer face begins here
const POST_R = WALL_IN + 8; //  ... and its shaded inner face ends here

/**
 * The corner post down rows `y0..y1`, with `k` giving how deep in the eave's shadow each row sits so
 * the post can run up under the overhang inside the roof tile and down the wall inside this one.
 */
function cornerPost(
  img: Img,
  side: 'l' | 'r',
  y0: number,
  y1: number,
  k: (y: number) => number,
): void {
  const at = (x: number): number => (side === 'l' ? x : TILE - 1 - x);
  for (let y = y0; y <= y1; y++) {
    const shade = 1 - 0.78 * clamp(k(y)); // the overhang darkens the post exactly as it does the wall
    img.px(at(WALL_IN), y, WOOD_LINE); // the corner itself: the facade's one vertical near-black
    for (let dx = 0; dx < 8; dx++) {
      /*
       * Across the post: a catch on the outer arris, then the face falling away to the inner edge.
       * The two darker streaks are grain, and they run the whole height with no horizontal feature
       * in them -- this tile used to be laid on both wall courses, so anything that varied down the
       * post drew a line across the elevation every thirty-two rows.
       *
       * The wall is one course now, so that reason has lapsed and the drawing stays anyway: `eave`
       * runs this same post up through the roof tile above it, and it is still two tiles' worth of
       * post stacked on a 32 pitch. A peg, a joint or a taper would draw that seam in the one place
       * on the facade where the eye is already looking for a vertical.
       */
      const grain = dx === 2 || dx === 6 ? 0.08 : 0;
      /*
       * 0.62 down to 0.26, which is darker than it first was and is set against a probe. Drawn at
       * 0.78..0.38 the post came back at luma 158 to 119 against plaster at 218: a seventy-luma
       * separation, where the board's corner post sits about a hundred and fifteen below its own
       * plaster. Seventy is a brown stripe on a cream wall; a hundred is a post holding up a corner,
       * and the corner is the one place on this elevation where the building has to stop dead against
       * a bright lawn.
       */
      img.px(at(POST_L + dx), y, tone('wood', clamp((0.62 - 0.36 * (dx / 7) - grain) * shade)));
    }
    img.px(at(POST_R + 1), y, WOOD_LINE); // and the line between the post and the plaster
  }
}

const wallCorner: Painter = (img) => {
  // Plaster from the post's inner line to the far edge of the tile; the outer sixteen columns stay
  // transparent, which is the overhang.
  for (let y = 0; y < TILE; y++)
    for (let x = POST_R + 2; x < TILE; x++) img.px(x, y, plasterAt(x, y));
  cornerPost(img, 'l', 0, TILE - 1, () => 0);
  /*
   * The rail runs on the plaster and DIES INTO THE POST, which is the whole reason this facade can
   * carry a rail at all: a sill plate that ran across its own corner post would be a board nailed
   * over the frame rather than framed into it.
   *
   * The post still has to land. It takes the same four rows of seating as the plaster beside it, and
   * its last row goes to the timber keyline, so the building's contact line is unbroken from one
   * corner to the other -- rail, post foot, rail -- which is the line the review said was missing.
   */
  wallFoot(img, POST_R + 2, TILE - 1);
  for (let y = PLATE_Y - BASE_K.length; y < TILE - 1; y++)
    for (let x = WALL_IN; x <= POST_R + 1; x++)
      img.px(x, y, mix(img.get(x, y), EAVE_SHADE, baseK(y) + (y >= PLATE_Y ? 0.3 : 0)));
  img.rect(WALL_IN, TILE - 1, POST_R + 2 - WALL_IN, 1, WOOD_LINE);
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
 * run 10, 11, 12, 12. Both rows used to draw the same 11-row course, which is a flat plane seen
 * face-on -- a wall. Two rows of difference across the slope is enough to read as a roof, and it
 * costs nothing: the contract between the two tiles is this table and the row offset, exactly as
 * before.
 *
 * FOUR TALL COURSES, NOT SIX SHORT ONES, AND THIS IS WHAT STOPS THE ROOF BEING CORRUGATED IRON.
 * Rendered at 1x beside the board (`2030 1140 260 150 4`) the six-course roof came back as a grey
 * band with horizontal ribs: the only marks the eye could find were the five course lines running
 * the full width of the building, which is a sheet of corrugated steel, not a tiled slope.
 *
 * The cause is proportion, measured off that crop at the board's own resolution. Its tile is 52
 * native pixels wide by 44 tall; the facade is 720 native wide against our 192, so the board draws
 * at 3.75 image pixels to one of ours and its tile is about 14 by 12 OF OURS -- very nearly square.
 * Ours was 15 to 17 wide by 7 to 9 tall, better than two to one, and a grid of 2:1 cells separated by
 * a strong horizontal and a weak vertical has no reading other than corrugation.
 *
 * So the cell keeps its width -- two unequal cells on 32 is the closest the tile grid gets to 14 --
 * and gains its height. Four courses of 10 to 12 put the cell at about 1.3:1, the horizontal joints
 * drop from five to three across the slope, and with the perpend restored to full height (see
 * `shingle`) what the eye now finds is a lattice of near-square lozenges, which is the board's roof.
 */
const COURSES = [
  [7, 10],
  [17, 11],
  [28, 12],
  [40, 12],
] as const;

/*
 * HOW MUCH LIGHTER OR DARKER EACH COURSE HAS WEATHERED, on top of the slope's own fall.
 *
 * "Ten courses of near-identical scallops at a dead-regular pitch, one flat value across the whole
 * span." The fall down the slope is monotonic by design -- `courses` argues at length why it has to
 * be, and that stands -- but monotonic and EVEN is a ramp, and a ramp of identical rows is the
 * corrugation this file has been fighting since it had six courses. On a clay roof no two courses
 * weather alike: one run of tiles came out of a different firing, one has moss, one faces the
 * weather. The board's own roof is plainly patchy course to course at `2020 1130 280 160 4`.
 *
 * These are small -- about a tenth of the tone, call it twelve luma -- and they do not reorder the
 * slope: the largest of them is well under the thirty-odd luma between one course and the next, so
 * the roof still reads as lit at the ridge and shaded at the eave. What they take away is the
 * EVENNESS, which is the part the eye was reading as sheet metal.
 */
const COURSE_TONE = [0.06, -0.05, 0.04, -0.07] as const;

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
 * is a cobbled street. Rendered at the playing camera the roof read as grey masonry laid on its side.
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
/*
 * ROUND FIVE, MEASURED AGAINST THE BOARD RATHER THAN AGAINST THE LAST VERSION, and it moves the
 * numbers in both directions at once.
 *
 * Probed across the board's own roof at native resolution (row y=1200, x 2040..2200), one cell reads:
 *
 *     136 140 150 142 | 62 47 90 | 163 178 153 | 146 146 147 148 149 | 174 | 133 63 39
 *     \__ face ____/    \_ joint _/  \_ CATCH _/  \______ face ______/  \_/
 *
 * and down a column through a cell (x=2100, y 1150..1260): 136..149 flat, then 110 68 92 at the
 * joint, then flat again. So the board's cell is
 *
 *     the catch       174..178, one to two pixels, at the cell's own top-left
 *     the face        134..150 -- SIXTEEN luma across the whole of it, effectively flat
 *     the joint       39..68
 *
 * Ours ran 142 to 176 on the face with a "cap" at 180 -- so the face was eighteen luma too bright,
 * spanned twice the board's range, and the cap stood only EIGHT luma proud of the body where the
 * board's stands thirty. A cap that close to its own body is not a catch; it is the top of a
 * gradient, which is why the courses read as ribs rather than as tiles with a lit edge.
 *
 * These three segments are the three bands above: a two-row catch at the top of the ramp, a long
 * level body at about 140, and a butt that falls off a cliff into the joint. The catch is worth
 * about thirty-five luma over the body, which is a hard step the eye reads as an edge -- and that is
 * the point. It is the one mark that separates a roof tile from a stone.
 */
function roll(d: number): number {
  /*
   * The catch: two rows that HOLD, and a hard step out of them.
   *
   * It fell 0.30 across its own two rows, which made its second row land on the body's own value --
   * so the band the comment above describes was in fact a single bright pixel followed by a ramp,
   * and a ramp into a flat body is the roll that makes a slate read as a pebble. Rendered at 8x
   * beside the board's roof (`2020 1130 280 160 4`) the difference is the whole character of the
   * tile: its catch holds for two rows at 174 to 178 and then drops thirty-odd luma to a face at
   * 136 to 150, in one step. Holding ours to 0.04 gives the same two-row band and the same step.
   */
  if (d < 0.18) return 0.97 - 0.08 * (d / 0.18);
  if (d < 0.74) return 0.66 - 0.06 * ((d - 0.18) / 0.56); // the body: level, and most of the tab
  return 0.58 - 0.26 * ((d - 0.74) / 0.26); // the butt: turns under, into the joint
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
  capDim: number,
) {
  /*
   * THE ROOF IS A CLAY ROOF AND NOT A GREY MAT, which is the review's second cottage fault: "ten
   * courses of near-identical scallops at a dead-regular pitch, one flat value across the whole span,
   * no ridge, no warmth, and it reads heavy because it is ... the board's roof is clearly a different
   * material from its wall rather than a grey mat above a cream one."
   *
   * The board's roof is terracotta and ours cannot be -- section 6a takes the biggest red mass in the
   * game off red so that Purple stays the one saturated figure in the frame, and that decision stands.
   * But what the board is actually doing there is not "red": it is putting a SATURATED, MID-VALUE
   * material above a DESATURATED, HIGH-VALUE one. Ours had the value half and none of the chroma
   * half, which is why two different materials read as one.
   *
   * So every slate now takes a fixed step towards `wood` before its own cast is applied. It is a
   * warm clay-grey -- nowhere near brown, nowhere near Purple's hue -- and it separates from the cream
   * plaster by chroma as well as by value, which is what the board's separates by.
   *
   * THE CAST STAYS SIGNED AND ITS CENTRE MOVES WARM rather than widening. The round that was pulled
   * back here found the real fault: a wide cast gives tan slates in a grey roof, which is a patchy
   * roof, not a warm one. A warm BASE with a narrow signed cast about it gives one material whose
   * tiles differ slightly, which is a roof. Measured on the rendered cottage camera the warm axis is
   * meant to move from a mean of about 23 with a maximum of 44 to a mean near 55 with its spread
   * still about a fifth of its mean, which is the shape of the board's own distribution.
   */
  const face = (t: number): RGBA => {
    const c = clamp(t);
    const warm = mix(tone('roof', c), tone('wood', clamp(t * 0.82)), 0.14 * clamp(t * 1.6));
    const k = Math.abs(cast) * clamp(t * 1.5);
    return cast < 0
      ? mix(warm, tone('stone', clamp(t * 0.75)), k)
      : mix(warm, tone('wood', clamp(t * 0.8)), k);
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
   * THE PERPEND IS FULL HEIGHT AGAIN, AND THE ROUND THAT SHORTENED IT HAD THE BOARD BACKWARDS.
   *
   * It was cut to a short nick in the lower two thirds on the argument that "each course carries ONE
   * CONTINUOUS BRIGHT CATCH along its whole head, unbroken by the verticals", because a full-height
   * joint meeting the course line at both ends closes a rectangle round every tab and a grid of
   * closed rectangles in offset rows is stretcher bond.
   *
   * Crop the board at `2030 1140 260 150 4` and look: the vertical joints run the WHOLE height of
   * every cell, they meet the course line above and below, and the bright catch is broken by them
   * -- it is per-tile, not per-course. The board's roof is a closed lattice of cells. Probed, its
   * perpend is 39 to 62 against a horizontal joint of 62 to 68, so the vertical is if anything the
   * DARKER of the two.
   *
   * What stops that lattice reading as masonry is not a weak joint. It is three other things, all of
   * which this file now has: the cell is near-square rather than 2:1 (see `COURSES`), it carries a
   * hard thirty-five-luma catch on its own top edge (see `roll`), and its bottom is a deep scallop
   * no wall has. With those in place the short nick was buying nothing and costing the roof its
   * second grid -- which is why the render came back corrugated.
   *
   * It is drawn one step above the flood rather than at it, so the butt line and the flares where
   * the scallops pull away still read as the darkest marks on the slope.
   */
  for (let r = 0; r < h; r++) img.px(x0, y + r, tone('roof', 0.05 * dim));

  for (let i = 1; i < w; i++) {
    const u = Math.abs(i - (w - 1) / 2) / ((w - 1) / 2); // 0 mid-tab, 1 at its two ends
    const cut = Math.pow(u, 2.6);
    const bot = h - 2 - Math.round(4.6 * cut);
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
       *
       * THE CATCH TAKES HALF THE SLOPE'S DIMMING, which is the other half of why the roof read flat.
       * A catch is the sun on a tile's own top arris: it is near-specular, so it survives into the
       * shaded courses where the diffuse face does not. Dimmed with the body it fell from thirty-odd
       * luma over the body at the ridge to barely twenty at the eave, and at the eave is exactly
       * where the courses are closest together and need the most help telling themselves apart.
       */
      img.px(x0 + i, y + r, face((roll(d) + v + lean) * (d < 0.18 ? capDim : dim)));
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
    const dim = (1 - 0.38 * (i / (COURSES.length - 1))) * (1 + COURSE_TONE[i]!);
    const capDim = (1 - 0.19 * (i / (COURSES.length - 1))) * (1 + COURSE_TONE[i]!);
    for (const [seam, w] of runs(i % 2 === 0 ? SEAMS_EVEN : SEAMS_ODD)) {
      const hash = Math.imul(seam + i * 37 + 1, 2654435761) >>> 0;
      const vary = (((hash >>> 28) & 15) / 15 - 0.5) * 0.26;
      /*
       * Signed, and its centre is now warm: see the note above `shingle`. The slate's base is a step
       * into `wood` already, so this says how much warmer or cooler than the roof's own clay a
       * single tile has weathered, and both directions survive because real clay does both.
       *
       * The chimney still separates from the roof on VALUE -- `stone` tops at luma 210 against
       * `roof`'s 183 -- and now on hue as well, which is the pairing the head of this file describes
       * and the one thing the grey roof had quietly given up.
       */
      const cast = (((hash >>> 20) & 15) / 15 - 0.38) * 0.24;
      for (let k = -1; k <= 1; k++) shingle(img, seam + k * TILE, y, w, h, vary, cast, dim, capDim);
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
  /*
   * The crown falls faster than it did. Five rows of near-equal pale grey read as a kerbstone laid
   * along the top of the building; a half-round pot is bright on its crown and in shade under its
   * lower edge, and three quarters of its height is the turn-under.
   */
  const joints: readonly number[] = [6, 15, 25];
  /*
   * THE RIDGE HAS A LIT EDGE NOW, which is the third thing the review asked of this roof: "no ridge
   * ... vary the course tone and give the ridge a lit edge".
   *
   * It was not that the cap had no highlight -- row two already sat at the top of the `roof` ramp.
   * It is that the top of the ramp is luma 183 and the lawn behind the building reads about 180, so
   * the building's own crest had three luma of separation from the grass it was drawn against. A
   * ridge pot is the highest thing on a cottage and takes the most sun; it has to be the lightest
   * run of pixels on the roof by a margin the eye can find.
   *
   * `roof` cannot go above 183, so the crown's two brightest rows take a step into `wall` -- the
   * lightest ramp the palette holds, and the one the chimney's smoke already borrows for exactly
   * this reason. It lands about twenty luma above the ramp's own head, still well under the
   * plaster, and it is three rows out of sixty-four so it costs the roof nothing in mass.
   */
  const crown = [0.9, 1.0, 1.0, 0.6, 0.14] as const;
  const CAP_LIT = [0.18, 0.3, 0.18, 0, 0] as const; // how far into `wall` each crown row steps
  for (let y = 1; y < RIDGE_H - 1; y++) {
    const base = crown[y - 1] ?? 0.08;
    const lit = CAP_LIT[y - 1] ?? 0;
    for (let x = 0; x < TILE; x++) {
      let start = joints[joints.length - 1]! - TILE;
      let end = joints[0]!;
      for (let j = 0; j < joints.length; j++)
        if (x >= joints[j]!) {
          start = joints[j]!;
          end = j === joints.length - 1 ? joints[0]! + TILE : joints[j + 1]!;
        }
      const u = (x - start) / Math.max(1, end - 1 - start); // 0 at the cap's lit shoulder
      const t = clamp(base + 0.12 * (1 - u) - 0.06);
      img.px(x, y, mix(tone('roof', t), tone('wall', 0.55), lit * t));
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
/*
 * THE ROOF NOW HANGS PAST THE WALL, which is the outline fault the review put above every detail in
 * this file -- "the roof is exactly the wall's width, dead-flat along its top edge and dead-flat
 * along its bottom, with NO eaves overhang, NO verge, NO ridge and NO GABLE. Ours is a grey mat on a
 * cream mat; per-tile scalloping cannot rescue a wrong outline."
 *
 * Measured on the board's own facade: its wall's outer face is at image x 2077 and its roof's edge at
 * 2017, so the roof hangs SIXTY board pixels past the wall. At the mock's 3.75 image pixels to one of
 * ours that is SIXTEEN of our pixels, each side -- exactly half a tile, which is the one measurement
 * in this whole file that falls on a convenient number.
 *
 * It cannot be drawn by widening the roof: `forest-map.ts` lays the roof and the wall on the same six
 * columns, so a roof that reaches its own tile edges is already as wide as the wall. The overhang has
 * to come from the WALL being narrower, and that is `wall-corner` -- a new tile whose outer sixteen
 * columns are transparent, so at the two ends of the facade the wall stops half a tile in and the
 * roof above it keeps going. The two tiles are one change: a roof that overhangs a full-width wall
 * covers nothing, and a wall inset under a roof that stops with it leaves half a tile of grass under
 * the eave.
 *
 * `WALL_IN` is the contract between them, declared at the head of this file because a module
 * constant has to exist before the one computed from it. Both tiles are painted here, which is the
 * only reason a contract this tight is safe to hold at all.
 */

/**
 * The eave, across `wallL..wallR` of the tile.
 *
 * Outside that span the tile is OVERHANG: the fascia and its keyline still run (an eave projects as
 * one board along the whole elevation, it does not stop where the wall does), then two rows of soffit
 * in the overhang's own shadow, and then nothing -- the grass of the garden, seen under a projecting
 * corner of roof. Those two rows are what makes the overhang read as a solid with an underside rather
 * than as a flap: a roof edge with daylight immediately beneath it is a sheet of card.
 */
function eave(img: Img, wallL = 0, wallR = TILE - 1): void {
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
    for (let x = wallL; x <= wallR; x++) img.px(x, row, plasterAt(x, row, k));

  /*
   * The soffit, under the part of the eave that projects past the wall. Two rows: the board's own
   * underside, taken from the shadow the overhang throws on the plaster so the two read as the same
   * darkness seen on two surfaces, then a hair darker where it meets the air.
   */
  for (let x = 0; x < TILE; x++) {
    if (x >= wallL && x <= wallR) continue;
    img.px(x, EAVE_Y + 3, EAVE_SHADE);
    img.px(x, EAVE_Y + 4, mix(EAVE_SHADE, SLATE_LINE, 0.55));
  }
}

/**
 * Punch a pixel back to fully transparent.
 *
 * `Img.px` is source-over: it takes the maximum of the old and new alpha, so it can lay a pixel down
 * and it can never take one away. The overhang needs grass under it, and the grass is the ground
 * layer showing through a hole in this tile. Fully transparent, never partially -- a soft edge here
 * would be a half-lit pixel of slate floating on the lawn.
 */
function clear(img: Img, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = 0;
  img.data[i + 1] = 0;
  img.data[i + 2] = 0;
  img.data[i + 3] = 0;
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

    const over = kind === 'left' ? 'l' : kind === 'right' ? 'r' : null;
    courses(img, TILE);
    eave(img, over === 'l' ? WALL_IN : 0, over === 'r' ? TILE - 1 - WALL_IN : TILE - 1);

    /*
     * THE VERGE IS A COURSE OF UNDER-TILE, and it is slate.
     *
     * It was drawn as a timber barge board for one render, on the reasoning that the fascia is timber
     * and the two would be one piece of joinery turning the corner. Rendered (`crop 100 230 260 300
     * 2.4` of the composed facade) that is plainly wrong, and the original comment in this file had
     * already said why: `roof-peak` is laid six times across the ridge row and can carry no end
     * treatment, so anything drawn on the eave row's end STARTS HALFWAY DOWN THE ROOF. In slate that
     * discontinuity is invisible, because the peak row's own edge above it is slate too. In brown it
     * was a bracket bolted to the middle of the roof's left edge, and the eye went straight to it.
     *
     * AND IT IS ONE PIXEL, NOT FOUR, WHICH IS THE SECOND THING THE RENDER SETTLED. Drawn as a
     * near-black edge plus two columns of deep slate plus an inner line -- a verge with real
     * thickness, which is what the board has -- it came back as a dark bar down the BOTTOM HALF of
     * the roof's left edge and nothing down the top half, because the peak row above cannot carry it.
     * A verge that exists on half of an edge is worse than no verge; it reads as damage. So the end
     * is a single clean near-black column, continuous from ridge to fascia, which at least obeys the
     * shared border ring that every other opaque tile in this world obeys.
     *
     * The thickness is not available from this file. It needs `roof-peak` split into a middle and two
     * ends -- two more tiles and two more gids -- and at two pixels of extra darkness on a 192-pixel
     * facade that is not worth a renumbering risk this round. Raised, not faked.
     */
    if (over) {
      /*
       * The corner post, carried up through the eave's shadow so it reaches the soffit.
       *
       * Without this the post starts at the top of the wall course below, which is nine rows below
       * the roof -- a post that stops short of the eave reads as a plank leaning on the house. These
       * are the same nine rows of shadow `eave` lays on the plaster, at the same depths, so the post
       * goes into shade with the wall it stands against rather than being a brown bar across it.
       */
      const EAVE_K = [1, 1, 0.97, 0.9, 0.8, 0.66, 0.5, 0.33, 0.16] as const;
      cornerPost(img, over, EAVE_Y + 3, TILE - 1, (y) => EAVE_K[y - (EAVE_Y + 3)] ?? 0);

      const edge = over === 'l' ? 0 : TILE - 1;
      for (let y = 0; y < EAVE_Y; y++) img.px(edge, y, SLATE_LINE);
      // `eave` has already run the fascia the full width of the tile, overhang included, which is
      // what closes the bottom of the verge. All it needs is its own end grain: without a dark column
      // here the brightest row on the roof runs off the edge of the building into the lawn.
      for (let r = 0; r <= 2; r++) img.px(edge, EAVE_Y + r, WOOD_LINE);
      /*
       * The overhang's lower corner is open air. Below the soffit `eave` draws, the tile has to be
       * nothing at all -- the flood at the top of this painter filled every pixel with the slate
       * keyline, so without this the projecting corner is a solid black block standing on the lawn.
       */
      for (let y = EAVE_Y + 5; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const outside = over === 'l' ? x < WALL_IN : x > TILE - 1 - WALL_IN;
          if (outside) clear(img, x, y);
        }
    }
  };
}

/* -------------------------------------------------------------------- gable */

/*
 * THE GABLE, which is the fault the review put first and the one thing on this building that could
 * not be drawn at all until `TILE_NAMES` came unfrozen.
 *
 * "The board has a steeply pitched roof that overhangs the wall on both sides and meets in a clear
 * gable with a lit attic window in it. Ours is a grey mat on a cream mat." Both halves of that are
 * outline, and the gable is the half no amount of work inside the four existing roof painters could
 * have reached: `forest-map.ts` lays `roof-peak` SIX TIMES across the ridge row, so that row is the
 * same thirty-two pixels repeated and its top edge is a ruler-straight line a hundred and ninety-two
 * pixels long. A gable is by definition a thing that happens ONCE, in the middle, so it needs a tile
 * of its own, and until this round there was no way to have one.
 *
 * WHERE IT GOES, and this is a one-line change in a file this element does not own: the row ABOVE
 * the ridge, at `cx + 2` and `cx + 3` -- over the door, where the board puts it -- the second copy
 * laid with Tiled's horizontal mirror bit so the two halves meet in an apex on the seam between them.
 * That row is cleared grass today apart from the chimney, so the gable rises against the garden and
 * breaks the flat skyline, which is the whole point of it.
 *
 * ITS PITCH IS MEASURED, not chosen. On the board (`1950 1110 740 280 3`) the apex sits at image
 * (2295, 1138) and the left rake lands on its bracket at (2170, 1255): a half-width of 125 board
 * pixels against a rise of 117. At the mock's 3.75 image pixels to one of ours that is 33 wide by 31
 * tall -- one tile each way, which is why the gable is two tiles wide and one tall and why the rake
 * runs very nearly corner to corner. A shallower pitch is a dormer and a steeper one is a steeple.
 *
 * WHAT IS ON THE RAKE, from the attic crop (`2245 1180 110 90 10`), reading from the sky inwards:
 * the roof's own near-black silhouette, a band of slate about five pixels thick running up the slope
 * with a catch along its upper edge, a hard near-black step, a cool grey barge about three pixels
 * thick, and then the cream tympanum. Five bands in nine pixels is a lot for a 32px tile, and all
 * five are in the board at this size, which is most of why its gable reads as built.
 */
const GABLE_APEX_Y = 4; // a little sky above the apex, so the point is not clipped by the tile edge
const GABLE_RISE = 27;
const GABLE_BLUNT = 3; // columns of flat apex: a one-pixel point reads as a spike, not a roof
const RAKE_SLATE = 4;
const RAKE_BARGE = 3;
/** Slate, step, barge, and the line under the barge: how deep the rake's trim runs. */
const RAKE_TRIM = 1 + RAKE_SLATE + 1 + RAKE_BARGE + 1;

/** The top of the gable at column `x`, in the plain (left-hand) copy: the apex is at the right. */
function rakeTop(x: number): number {
  const run = TILE - GABLE_BLUNT;
  if (x >= run) return GABLE_APEX_Y;
  return GABLE_APEX_Y + Math.round((GABLE_RISE * (run - x)) / run);
}

/* The attic window, in the plain copy's columns: its mirror supplies the other half. */
const ATTIC_L = 25;
const ATTIC_T = 19;
const ATTIC_B = 30;

const cottageGable: Painter = (img) => {
  for (let x = 0; x < TILE; x++) {
    const top = rakeTop(x);

    // The tympanum first, flooded from the rake down, so the trim is laid over its top edge.
    for (let y = top; y < TILE; y++) img.px(x, y, plasterAt(x, y));

    img.px(x, top, SLATE_LINE); // the roof against the sky

    /*
     * The slate on the slope, laid as TILES rather than as a graded band.
     *
     * The first render of this gable put a smooth four-pixel ramp up the rake with a nick every
     * sixth column, and what came back was a grey pipe with a dotted line on it: the band had no
     * structure, so the eye read one long extruded object instead of a slope with roofing on it. Each
     * tile along the rake now gets its own tone off a hash of its position and a full-depth dark
     * perpend between it and the next, which is the same construction as a course tab in `shingle`,
     * turned on its side.
     *
     * The perpends are five columns apart and unequal in effect because the tone varies, so the rake
     * does not rule a ladder; the catch still runs along the whole band's upper edge, because on the
     * board the light on the rake is continuous and the joints are cut into it.
     */
    const cell = Math.floor(x / 5);
    const seam = x % 5 === 0;
    const vary = (((Math.imul(cell + 1, 2654435761) >>> 28) & 15) / 15 - 0.5) * 0.16;
    for (let r = 1; r <= RAKE_SLATE; r++) {
      const d = (r - 1) / RAKE_SLATE;
      /*
       * One row of catch and then the body, at the same values a course tab is drawn at. The first
       * render held 0.96 across most of the band and the rake came back BRIGHTER than the ridge --
       * the gable read as a pale grey chevron laid on the roof rather than as the roof turning up to
       * meet itself. A roof's edge is not lighter than its field; only its topmost pixel is.
       */
      img.px(
        x,
        top + r,
        seam ? tone('roof', 0.08) : tone('roof', clamp((r === 1 ? 0.93 : 0.58 - 0.2 * d) + vary)),
      );
    }
    img.px(x, top + RAKE_SLATE + 1, SLATE_LINE); // the step out of the slate

    /*
     * THE BARGE BOARD IS TIMBER, and this is where "match the form, not the palette" bites.
     *
     * On the board the band under the rake's step is GREY, and it reads because the roof above it is
     * red: a cool grey board against terracotta is a change of material you cannot miss. Our roof is
     * slate, by the one deliberate rebrand departure this building is allowed, and a grey board under
     * a grey roof rendered as exactly what it is -- two parallel grey stripes, a ribbed tube running
     * up the rake. The relationship the board is drawing is "the roof stops and a different material
     * carries its edge", and with a grey roof the only material on this facade that says that is the
     * timber the fascia, the window frames and the corner posts are already made of.
     *
     * Lit along its upper edge and turning under, like every other board on this building.
     */
    for (let r = 0; r < RAKE_BARGE; r++)
      img.px(x, top + RAKE_SLATE + 2 + r, tone('wood', clamp(0.78 - 0.34 * (r / RAKE_BARGE))));
    img.px(x, top + RAKE_TRIM - 1, WOOD_LINE);
  }

  /*
   * THE LIT ATTIC WINDOW, straddling the seam so the two mirrored halves make one window centred
   * under the apex. The board's is about thirteen of our pixels square with a dark timber frame, a
   * brass corner block at each corner and a warm core; ours is fourteen by twelve, which is as near
   * as an even split across two tiles gets.
   *
   * It carries no mullion. The board's has one and at thirteen pixels wide it is the only mark on
   * that window the eye cannot resolve from the gate -- drawn, it closes the glass up into four dark
   * smudges and the one thing this window is for, which is being the warm point at the top of the
   * payoff frame, goes with it.
   *
   * The glow is centred ON THE SEAM, off the right edge of this tile, so the brightest pixels in the
   * plain copy are its last column and the mirror puts its own against them.
   */
  img.rect(ATTIC_L, ATTIC_T, TILE - ATTIC_L, 1, FRAME_LINE);
  img.rect(ATTIC_L, ATTIC_B, TILE - ATTIC_L, 1, FRAME_LINE);
  img.rect(ATTIC_L, ATTIC_T, 1, ATTIC_B - ATTIC_T + 1, FRAME_LINE);
  img.rect(ATTIC_L + 1, ATTIC_T + 1, TILE - ATTIC_L - 1, 1, tone('wood', 0.56));
  img.rect(ATTIC_L + 1, ATTIC_B - 1, TILE - ATTIC_L - 1, 1, tone('wood', 0.24));
  img.rect(ATTIC_L + 1, ATTIC_T + 1, 1, ATTIC_B - ATTIC_T - 1, tone('wood', 0.5));
  litGlass(img, ATTIC_L + 2, ATTIC_T + 2, TILE - ATTIC_L - 2, ATTIC_B - ATTIC_T - 3, (px, py) => {
    // Centred on the seam, off this tile's right edge, so the mirror brings its own half against it.
    const d = Math.hypot((px - TILE) / 7, (py - 24) / 5.5);
    return 1.0 - 0.5 * d;
  });
  // The brass corner blocks, which is what the board has instead of a mullion at this size.
  img.px(ATTIC_L + 2, ATTIC_T + 2, tone('gold', 0.34));
  img.px(ATTIC_L + 2, ATTIC_B - 2, tone('gold', 0.3));
};

/* -------------------------------------------------------------------- glass */

/**
 * One pane: a navy sheet with the sky caught in the top of it, lit from the left.
 *
 * NAVY, and built by mixing rather than by picking a ramp, because neither ramp alone is the board's
 * colour. `night` on its own is a dark PURPLE -- it is Deep Purple and Aubergine, Purple's own hues --
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
 * LAMPLIT glass: amber, across a whole opening, with `heat` giving how hot each pixel of it is.
 *
 * THERE IS NO WHITE CORE, AND THE RENDER THAT HAD ONE IS WHY THIS NOTE EXISTS. The first pass put a
 * radial falloff on the opening with its peak carried past the head of `gold` into `wall`, on the
 * reasoning that a lamp seen through glass has to be the brightest thing in the frame. Put beside the
 * board's own lit window (`2440 1240 260 230 4`) that is simply not what is drawn, in two ways:
 *
 *   - its amber tops out at luma 225 against a plaster wall at 222. The glass is NOT brighter than
 *     the wall. What makes it read as lit is that it is SATURATED warm inside a near-black frame,
 *     and a window needs no more than that. Ours reaching into `wall` put a white smudge behind a
 *     timber cross, which at the playing camera is a smear, not a lamp;
 *   - the board's falloff is VERTICAL. It is brightest along the head of the opening and deepens
 *     evenly to the sill -- light coming into a room from above and falling down the glass -- with no
 *     hot spot anywhere. A radial core centred behind a mullion crossing reads as a blob.
 *
 * So the body is the top two thirds of `gold` and nothing else, and the shape of the glow is the
 * caller's business: the wall window falls from its head, and the attic window, which is fourteen
 * pixels across and is meant to be a point of light at the top of the payoff frame, glows from the
 * middle.
 */
function litGlass(
  img: Img,
  x: number,
  y: number,
  w: number,
  h: number,
  heat: (px: number, py: number) => number,
): void {
  for (let v = 0; v < h; v++)
    for (let u = 0; u < w; u++) img.px(x + u, y + v, tone('gold', clamp(heat(x + u, y + v))));
}

/* ------------------------------------------------------------------- window */

/*
 * The window, its box and its blooms.
 *
 * THE WOLF HAS COME OUT OF THE TILE, AND THAT IS A BUG FIX, NOT A RETREAT. Read this before putting
 * him back.
 *
 * `forest-map.ts` lays ONE window tile TWICE, at `cx + 1` and `cx + 4` of the same wall course. A
 * tile cannot know which of the two it is and it cannot know which ending the player reached, so a
 * wolf painted into it appeared in BOTH windows on EVERY ending -- including the endings where Purple
 * refused every skill and the thing in the cottage is Grandma. The arrival screen gates its portrait
 * on the ending; this tile is the same thirty-two pixels every time and no amount of gating upstream
 * can reach it. It was reported and never fixed, and it was the one defect on this building that
 * actively told the player the wrong story.
 *
 * It was also, rendered at 1x, not reading as a wolf. Two windows each eight pixels of purple with
 * two gold dots in them, twice across the facade, read as a pair of soft toys sitting on the sills.
 *
 * SO THE TILE IS NOW THE BOARD'S LEFT-HAND WINDOW, which is the window the board draws twice as
 * often and the one that works in both copies: dark timber frame, NAVY glass in four panes, a stone
 * sill, an ochre flower box with a bush spilling over it. Crop `2060 1250 230 230 3` and it is all
 * there. Measured off that crop, the board's own geometry, converted at 3.75 image pixels to one of
 * ours: the glass is about 19 by 19 -- very nearly SQUARE -- inside a frame about 24 wide, and it is
 * divided by one mullion and one transom into four roughly equal panes. Ours was 18 by 14 in three
 * unequal lights, a shape chosen to leave room for the animal; with the animal gone the opening can
 * be the board's.
 *
 * WHAT IS LOST AND HOW TO GET IT BACK, because this is a real loss and it should not be quietly
 * dropped. The board's RIGHT window is a different picture: amber glass at luma 146 to 225 with the
 * wolf cut out of it, which is the staging of "That's Not My Grandma" and the reason a player walking
 * east out of the forest has something to walk towards. That needs a SECOND TILE -- `wall-window-lit`
 * -- and `TILE_NAMES` is unfrozen this round, so it is now buildable. It is not buildable from this
 * file alone: the name has to go into `tiles.ts` next to `wall-window`, `forest-map.ts` has to lay it
 * at `cx + 4` instead of a second `wall-window`, and `map-forest.json` has to be regenerated in the
 * same change or every gid after it shifts. That is three files this element does not own, so it is
 * raised rather than done. The painter it needs is the one deleted here and it is in git history at
 * 5c3650b; gated on the ending it would be a lamplit room the player can read from the gate.
 */

/*
 * The bush's top edge, column by column across the box's 24 pixels. Three fingers of different
 * heights with a notch between each -- a hand of leaves, never a curve.
 *
 * The tallest finger reaches the sill's own row and nothing reaches the glass. The board's box hangs
 * below the sill and its tallest leaf just laps the sill's lip; a profile that climbs into the
 * opening swallows the lower panes, and the four panes are the point of this window.
 */
/*
 * TWO ROWS HIGHER THAN THEY WERE, and the box with them, because the wall now has a foot.
 *
 * The box used to run to the tile's last row: on a two-course facade that is the ground, so the
 * trough stood ON the lawn like a planter rather than hanging under a sill. The board's box hangs
 * clear with plaster showing beneath it and the bank of planting in front of that. Giving the last
 * three rows to the sill plate takes the box off the floor and lands the wall in the same move.
 */
const BUSH_TOP = [
  26, 25, 24, 23, 24, 25, 24, 22, 22, 23, 24, 25, 24, 23, 23, 22, 23, 24, 23, 22, 23, 24, 25, 26,
] as const;

/*
 * The glass: one opening, FOUR panes, which is what the board draws.
 *
 * Nearly square -- 18 by 17 -- because the board's is 19 by 19. The mullion and the transom both sit
 * at the middle, so the four panes are equal, as the board's are.
 */
const GLASS_L = 7;
const GLASS_R = 24;
const GLASS_T = 4;
const GLASS_B = 20;
const MULLION = 15; // columns 15..16
const TRANSOM = 11; // rows 11..12

/*
 * THE SECOND WINDOW TILE EXISTS NOW, and it is the same window with the lamp on.
 *
 * `wall-window-lit` is the board's RIGHT-hand window: amber glass, a warm spill down the sill and a
 * faint bounce on the plaster under it. Everything else -- frame, reveal, mullion, transom, sill,
 * flower box, blooms -- is shared, because on the board they ARE shared; only the glass changes. So
 * this is one builder taking one flag rather than two painters that will drift apart.
 *
 * NO ANIMAL IN IT. The wolf belongs to the arrival PANEL, which is gated on the ending; a tile is
 * the same thirty-two pixels on every ending, so a wolf painted here would appear in the window on
 * the endings where Purple refused every skill and the thing in the cottage is Grandma. The earlier
 * fix that took him out of `wall-window` was right and this is how it keeps being right: the lamp is
 * the part of that picture a tile is allowed to carry, and the Arrive panel's "The lamp is lit" --
 * protected copy, written over two dark windows until now -- is the part it has to carry.
 */
function windowTile(lit: boolean, wolf = false): Painter {
  return (img) => {
    plaster(img);

    // The keyline, as a filled block; the frame and the glass are laid inside it.
    img.rect(3, 1, 26, 22, FRAME_LINE);
    img.rect(2, 1, 28, 3, FRAME_LINE); // the lintel cap, a pixel proud at each shoulder

    /*
     * Frame face, rounded rather than flat: the board's frame is a moulding, brightest on its upper
     * left and turning under on its lower right.
     */
    for (let y = 2; y <= 21; y++)
      for (let x = 4; x <= 27; x++) {
        const dIn = Math.min(x - 4, y - 2, 27 - x, 21 - y);
        img.px(
          x,
          y,
          tone(
            'wood',
            clamp(0.66 - 0.11 * dIn + 0.14 * (1 - (x - 4) / 23) - 0.12 * ((y - 2) / 19)),
          ),
        );
      }

    /*
     * The glass, flooded across the whole opening, then the reveal, then the bars over the top of it.
     * Order matters: the bars have to cross IN FRONT of the glass or the window reads as a picture of
     * a window.
     */
    const gw = GLASS_R - GLASS_L + 1;
    const gh = GLASS_B - GLASS_T + 1;
    /*
     * The lamplight falls from the head of the opening down to the sill, which is the board's own
     * gradient rather than a hot spot -- the argument is above `litGlass`. The slight lean carries it
     * left, from the same top-left sun as every other surface on this building, and the pinch at the
     * two jambs keeps the glass from reading as a flat wash of paint filling a frame.
     */
    if (lit)
      litGlass(img, GLASS_L, GLASS_T, gw, gh, (px, py) => {
        const down = (py - GLASS_T) / (GLASS_B - GLASS_T);
        const inset = clamp(Math.min(px - GLASS_L, GLASS_R - px) / 3);
        /*
         * 0.76 of the ramp across the drop, which is measured rather than felt. Probed, the board's
         * amber runs luma 225 at the head to 146 at the sill. At a fall of 0.5 ours came back 226 to
         * 191 -- the head exact and the foot forty-five luma too bright, so the glass read as one
         * flat sheet of yellow with the top panes very slightly paler. The full fall puts the foot at
         * about 150, and the gradient becomes something the eye can actually see.
         */
        return (1.0 - 0.76 * down + 0.05 * (1 - (px - GLASS_L) / gw)) * (0.88 + 0.12 * inset);
      });
    else pane(img, GLASS_L, GLASS_T, gw, gh);
    /*
     * The reveal: the frame is a box and the glass sits at the back of it, so the inner edge is in
     * shadow all the way round. Without it the glass butts straight onto the lit timber face and the
     * opening has no depth -- the same fault the door had before it got its own reveal.
     */
    img.frame(GLASS_L - 1, GLASS_T - 1, GLASS_R - GLASS_L + 3, GLASS_B - GLASS_T + 3, FRAME_LINE);

    img.rect(MULLION, GLASS_T, 2, GLASS_B - GLASS_T + 1, tone('wood', 0.3)); // the mullion
    img.rect(MULLION, GLASS_T, 1, GLASS_B - GLASS_T + 1, tone('wood', 0.52)); // lit down its left
    img.rect(GLASS_L, TRANSOM, GLASS_R - GLASS_L + 1, 2, tone('wood', 0.3)); // the transom
    img.rect(GLASS_L, TRANSOM, GLASS_R - GLASS_L + 1, 1, tone('wood', 0.46)); // lit along its top

    // Who is sitting up in Grandma's chair. Only ever on the overlay, never on a laid tile: see
    // `WINDOW_WOLF` below for why, and for how he is drawn.
    if (wolf) sitter(img);

    /*
     * The sill, standing proud of the frame and lit along its top -- and STONE, not timber.
     *
     * Drawn in `wood` it was the same material and nearly the same value as the frame sitting on it,
     * so the window had no bottom edge: frame, sill and flower box ran together into one brown-green
     * block. In cool `stone` it separates the frame above from the planting below, and it pairs with
     * the door's threshold and the chimney as the building's three pieces of worked stone.
     *
     * It has come down with the rest of the stonework, from 0.74 to 0.58. See `ashlar`: the board's
     * worked stone sits fifty-five luma below its plaster, and against a wall now at 217 a sill at 189
     * was a brighter horizontal than anything else on the elevation -- it out-shouted the glass it was
     * meant to sit under.
     */
    img.rect(2, 22, 28, 1, tone('stone', 0.58));
    img.rect(2, 23, 28, 1, STONE_LINE);

    /*
     * THE SPILL, and it is the whole reason a lit window reads as lit rather than as a yellow pane.
     *
     * A lamp behind glass throws light OUT. On the board the stone sill under the amber window is
     * visibly warmer and lighter than the sill under the blue one, and the plaster for a few pixels
     * below it carries a faint warm bounce that fades out sideways. Without it the amber sits inside
     * its frame like a sticker and the eye reads a coloured rectangle; with it the window becomes a
     * source and the wall becomes a thing being lit.
     *
     * Drawn as the sill's own stone and the wall's own plaster taken TOWARDS `gold` rather than as a
     * gold wash laid over them, so neither surface changes material. Strongest under the middle of
     * the opening, gone by the shoulders, and never on a transparent pixel -- there are none here.
     */
    if (lit) {
      for (let x = 2; x < 30; x++) {
        const across = clamp(1 - Math.abs(x - 15.5) / 13);
        img.px(x, 22, mix(tone('stone', 0.58), tone('gold', 0.94), 0.52 * across));
        img.px(x, 23, mix(STONE_LINE, tone('gold', 0.34), 0.45 * across));
      }
      // The bounce onto the plaster that is actually visible around this frame: the two strips beside
      // it and the row above the lintel. The rows below the sill belong to the flower box.
      for (let y = 1; y <= 23; y++) {
        const down = clamp(1 - Math.abs(y - 12) / 15);
        for (const x of [0, 1, 30, 31])
          img.px(x, y, mix(plasterAt(x, y), tone('gold', 0.72), 0.26 * down));
      }
      for (let x = 0; x < TILE; x++)
        img.px(
          x,
          0,
          mix(plasterAt(x, 0), tone('gold', 0.72), 0.2 * clamp(1 - Math.abs(x - 15.5) / 18)),
        );
    }

    /*
     * The flower box: an ochre trough with its slats showing, under a bush that spills over it.
     * Never a stem, and never a bloom on its own.
     *
     * THE TROUGH IS VISIBLE NOW. The bush used to top out two rows below the sill and cover all but
     * the box's last row, so what rendered was a green smear with a dark line under it; on the board
     * the box is plainly a wooden trough -- a warm ochre band two or three pixels deep showing under
     * the leaves, with its uprights drawn. Those uprights are the slats below.
     */
    seatFoot(img);
    for (let y = 24; y <= 27; y++)
      for (let x = 4; x <= 27; x++)
        img.px(x, y, tone('gold', clamp(0.46 - 0.3 * ((y - 24) / 4) + 0.05 * Math.sin(x * 1.9))));
    for (const sx of [8, 14, 20, 25]) img.rect(sx, 25, 1, 3, tone('gold', 0.1));
    img.rect(3, 23, 1, 6, BOX_LINE);
    img.rect(28, 23, 1, 6, BOX_LINE);
    img.rect(4, 28, 24, 1, BOX_LINE);

    /*
     * Each column rolls from a lit lobe top down into the box. The roundness comes from the per-column
     * fall and from the keyline over each lobe, nothing else -- a brightening applied per raised finger
     * is an alternating stripe at this width and renders as a row of blades.
     *
     * BRIGHTER THAN IT WAS, AND IT STOPS TWO ROWS HIGHER. The board's window planting is a mid-green
     * mass with its own lit top, sitting in the trough rather than hiding it; ours ran from `canopy`
     * 0.4 down to near-black over five rows, which at 1x is a dark green-black bar under the glass.
     */
    for (let i = 0; i < BUSH_TOP.length; i++) {
      const x = 4 + i;
      const top = BUSH_TOP[i]!;
      for (let y = top; y <= 26; y++) {
        const down = (y - top) / Math.max(1, 26 - top);
        const lift = 0.07 * Math.cos((i - 9) * 0.5); // one broad highlight across the whole mass
        img.px(x, y, tone('canopy', clamp(0.58 + lift - 0.42 * Math.pow(down, 0.65))));
      }
      img.px(x, top - 1, keyline('canopy')); // the keyline over each lobe
    }
    img.rect(4, 26, 24, 1, keyline('canopy'));

    /*
     * Blooms: four petals, a pale catch and a warm centre, 3px across.
     *
     * THEY ARE WARM NOW. They were drawn in `fur` and `skin` -- a near-white cross with a gold eye --
     * at a round when `PALETTE` held no saturated warm colour at all and the only alternative was
     * Purple's own Lilac, which is why the note above them still says "pink and red" about a pair of
     * white flowers. `rose` and `ember` are in `paint.ts` now, measured off the board's own blooms,
     * and the board's window box is unambiguous at `2060 1250 230 230 3`: red and pink four-petal
     * crosses with a pale eye, not white ones.
     *
     * The catch stays. These sit on a bush at about luma 145 and a rose petal is 155, so hue is
     * carrying nearly all of the contrast and ten luma is not enough to find a three-pixel mark at the
     * playing camera. One pale pixel at the top petal is what the board gives them too.
     */
    for (const [bx, by, warm] of [
      [6, 23, rose],
      [11, 21, ember],
      [17, 22, rose],
      [22, 21, ember],
    ] as const) {
      img.rect(bx + 1, by, 1, 3, warm(0.82));
      img.rect(bx, by + 1, 3, 1, warm(0.82));
      img.px(bx + 1, by, tone('skin', 0.86));
      img.px(bx, by + 1, warm(1));
      img.px(bx + 1, by + 1, tone('gold', 0.86));
      img.px(bx + 2, by + 2, warm(0.35)); // the shaded petal, under and right
    }

    sillPlate(img);
  };
}

/* ---------------------------------------------------- who is in the lit window */

/*
 * THE WOLF IS BACK IN THE WINDOW, AND THIS TIME HE CANNOT BE THERE ON THE WRONG ENDING.
 *
 * Read the note above `windowTile` first: he came out of `wall-window` because a TILE is the same
 * thirty-two pixels on every ending, so a wolf painted into one sat in Grandma's window on the runs
 * where the thing in the cottage is Grandma. That argument is still right, and nothing here weakens
 * it -- `wall-window-lit` is laid exactly as before and is byte-for-byte the tile it was.
 *
 * What is new is that he is no longer a tile. `fx-window-wolf` is an OVERLAY: the pixels the wolf
 * adds to the lit window and nothing else, transparent everywhere he is not. The scene lays it over
 * the lit window's own cell, read off the map, ONLY on the wolf ending and only once Purple is at
 * the door (forest-scene.ts, `stageArrival`). During the walk it does not exist on screen, so it
 * cannot give the ending away from across the garden; on the clean ending the window is the lamp
 * and an empty room, which is what the tile has always shown. There is no Grandma shape to put in
 * it -- she exists only as a portrait -- and inventing one is not this file's call.
 *
 * HOW HE IS DRAWN, measured off the board's own lit window (`2440 1240 260 230 3`, the wolf at
 * `2468 1298 120 98 9`): a flat dark shape against amber, two tall pointed ears with a notch of
 * light between them, and one warm mark. Ours adds the two things the client asked for in words --
 * a muzzle and the slope of a shoulder in Grandma's chair -- because at 18 x 17 pixels of glass a
 * front-on head is a cat as easily as a wolf, and the long muzzle in profile is the feature no other
 * animal in this world has. He faces WEST, towards the door and the girl on its step.
 *
 *   ears      two, nearly upright, single-pixel points, the near one taller. The notch between them
 *             runs down to the skull and is the board's tell; the guard below holds it open.
 *   muzzle    driven four and a half pixels out of the skull over clear amber. Cut it by three and
 *             he is a dog -- the same arithmetic `paintWolf` records for the full figure.
 *   shoulder  the front of him falls from under the jaw to the bottom-left corner of the glass in
 *             one slope, with the ruff breaking it twice. That slope is the "sitting up" read.
 *   hackles   three single pixels standing off the nape, so the back of him is fur and not a coat.
 *   chair     a wing-back behind him, east of his back, in the deepest step of `wood`. Lighter than
 *             he is by about sixty luma, so the eye reads a chair with something IN it, not one
 *             shape. It is the only piece of Grandma's in the picture and it is the point of it.
 *   eye       one, two pixels of `gold` level 2 -- the lamp catching it. The single amber mark the
 *             board puts in its silhouette, and the only unsettling thing about him. No teeth, no
 *             open jaw: a family forest, and a shape that is wrong is scarier than one that snarls.
 *
 * IN FRONT OF THE BARS, as the board draws him. Physically he is behind the glass and the mullion
 * and transom would cross him; at this size they cross his head dead centre (the mullion is column
 * 15, the transom row 11, and his skull is centred on both), which cuts one wolf into four dark
 * fragments that read as nothing. The board's painter made the same call and so does this one: the
 * bars show wherever he does not, which is three panes' worth, and the window is still a window.
 *
 * FLAT `ink`, which PIXEL_STANDARD section 4 reserves for him so that he reads as a silhouette. The
 * same ink as his frame 2, which is the full-figure "shape in the window" no scene ever stood up --
 * it is 30 pixels long and the glass is 18, so it was never going to fit, and this is the head and
 * shoulders it would have shown.
 */

/*
 * The sitter, pixel for pixel, over the glass: column 0 is `GLASS_L`, row 0 is `GLASS_T`.
 *
 * HAND-PLACED, NOT RASTERISED. A first pass built him out of an ellipse and four polygons and he
 * came back a jackal -- ears that tapered to one pixel and a muzzle that thinned to a beak, because
 * a polygon at this size decides its own edge pixels by where their centres fall. The board's
 * animals are placed a pixel at a time, and so is this one.
 *
 * Laid out AROUND THE BARS rather than over them. The mullion is columns 8 and 9 and the transom
 * rows 7 and 8, so the notch between his ears is column 8 -- where the mullion shows through, a
 * brown bar between two black ears rather than the two merging -- and the gap between the back of
 * his head and the chair is column 13, where the transom shows. The bars still read as one cross.
 *
 *   W  him, flat `ink` level 0       E  the eye, `gold` level 2: the lamp catching it
 *   C  the chair, `wood` level 0     c  its crest, a step lighter where the lamp behind it catches
 *   .  the glass, untouched
 */
const SITTER = [
  '..................',
  '......W...W.......',
  '.....WW..WW.....cc',
  '.....WWW.WWW...cCC',
  '....WWWWWWWW..cCCC',
  '...WWWWWWWWW..CCCC',
  '.WWWEEWWWWWWW.CCCC',
  'WWWWWWWWWWWWW.CCCC',
  '.WWWWWWWWWWWWWCCCC',
  '...WWWWWWWWWWWCCCC',
  '.....WWWWWWWWWCCCC',
  '......WWWWWWWWWCCC',
  '.....WWWWWWWWWWCCC',
  '.....WWWWWWWWWWWCC',
  '....WWWWWWWWWWWWCC',
  '....WWWWWWWWWWWWWC',
  '...WWWWWWWWWWWWWWC',
] as const;

/** What the sitter puts on one pixel of the tile, or null where the glass shows. */
function sitterAt(x: number, y: number): 'W' | 'E' | 'C' | 'c' | null {
  const mark = SITTER[y - GLASS_T]?.[x - GLASS_L];
  return mark === 'W' || mark === 'E' || mark === 'C' || mark === 'c' ? mark : null;
}

/** Paints the sitter over the glass of a window already drawn, clipped to its opening. */
function sitter(img: Img): void {
  for (let y = GLASS_T; y <= GLASS_B; y++)
    for (let x = GLASS_L; x <= GLASS_R; x++) {
      const what = sitterAt(x, y);
      if (what === 'W') img.px(x, y, tone('ink', 0));
      else if (what === 'E') img.px(x, y, tone('gold', 2 / 3));
      else if (what === 'C') img.px(x, y, tone('wood', 0));
      else if (what === 'c') img.px(x, y, tone('wood', 0.3));
    }
}

/**
 * `fx-window-wolf`: the pixels the wolf ADDS to `wall-window-lit`, transparent everywhere else.
 *
 * Derived by painting the lit window twice, with and without him, and keeping what differs -- so
 * the overlay is the tile's own pixels wherever it is opaque and the two can never drift apart. It
 * is a whole 32 x 32 cell on purpose: the scene lays it at the lit window's tile origin, read off
 * the map, and needs no offset into the tile that only this file knows.
 */
export const WINDOW_WOLF: Painter = (img) => {
  const plain = new Img(TILE, TILE);
  windowTile(true)(plain);
  const sat = new Img(TILE, TILE);
  windowTile(true, true)(sat);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const a = plain.get(x, y);
      const b = sat.get(x, y);
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) img.px(x, y, b);
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
 * arch and the leaf are `wood`, the light is `gold`, and nothing here is purple -- that is Purple's.
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
 * also what survives at the playing camera, where a dome just reads as a blur.
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
 * difference where the board has 110 -- so at the playing camera the door was a slightly darker patch
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
 * AND IT IS DOWN TO 0.46, WHICH IS THE THIRD TIME THIS NUMBER HAS MOVED AND THE FIRST TIME IT HAS
 * BEEN SET AGAINST A PROBE RATHER THAN AGAINST AN ARGUMENT.
 *
 * It was 0.78, taken there from 0.66 on the reasoning that "with the wall now at about 203 a
 * surround at 179 was the nearer of two greys on a cream field and simply disappeared into it". The
 * conclusion was right and the remedy went the wrong way: 0.78 is luma 190 against a wall at 203,
 * which is THIRTEEN luma, and thirteen luma between two large neutral surfaces is not a material
 * change, it is a stain -- exactly the thing the move was meant to cure. Rendered, the jambs read as
 * two faint grey brackets.
 *
 * The board settles it. Probed along row y=1330, straight through a quoin beside the door:
 *
 *     plaster  229 225 222 | joint 140 | BLOCK 167 170 173 173 170 | joint 139
 *
 * Its worked stone sits FIFTY-FIVE luma below its plaster, not thirteen. 0.56 is about luma 166
 * against our wall's measured 217 -- a fifty-one-luma interval, the board's own, in the cool grey
 * the chimney and the threshold are already painted in. It is darker than the plaster by enough to
 * be a different material and lighter than the leaf inside it by enough to frame it.
 *
 * It was set at 0.46 first and probed at 144 to 149 against the wall's 217, which is seventy luma --
 * past the board and into a pair of dark grey posts. 0.56 is where the probe lands on the board.
 *
 * What carries the surround at the playing camera is this interval, the near-black bed joint every
 * seventh row, and the keyline up its outer edge. The last two are unchanged.
 */
const COURSE_H = 7;

function ashlar(img: Img, x: number, y: number, dx: number, course: number): void {
  const down = y % COURSE_H;
  if (down === 0) {
    img.px(x, y, STONE_LINE);
    return;
  }
  const t =
    0.56 -
    0.16 * ((down - 1) / (COURSE_H - 2)) -
    0.1 * (dx / (JAMB_W - 2)) +
    0.05 * Math.sin(course * 2.1 + dx * 0.8);
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
   * It costs two of the leaf's twenty-two columns and buys the opening its depth, which at the
   * playing camera is the only thing about this door that is legible at all.
   */
  img.rect(OPEN_L, archTop(OPEN_L) + 4, 1, DOOR_FOOT - archTop(OPEN_L) - 3, WOOD_LINE);
  img.rect(OPEN_R, archTop(OPEN_R) + 4, 1, DOOR_FOOT - archTop(OPEN_R) - 3, WOOD_LINE);

  /*
   * The brass light: a cross-muntin of four panes over the same navy glass as the wall windows, the
   * astragal that carries it above and below, and the pair of knobs. Together they are the only gold
   * on the building.
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

  /*
   * THE ASTRAGAL, which is the board's and which we did not have: the vertical muntin does not stop
   * at the light's frame, it runs on past it in both directions.
   *
   * Probed on the mock (gold pixels in the Arrive frame's doorway, x 2260..2420, y 1300..1450), the
   * light's frame spans y 1353..1397 and the gold bar spans y 1341..1401 -- twelve board pixels
   * proud above it and four below, on a bar twelve board pixels wide. Ours is a two-pixel bar, so
   * on the light's own ruler (53 board px of frame against our 8, call it 6.6 to one) that is two
   * rows above and one below.
   *
   * It is six pixels and it is worth them. A four-pane light centred in a slab is a WINDOW; the same
   * light with a bar running out of the top and bottom of it is the meeting of two door leaves, and
   * which of those two this reads as is the whole difference between Grandma's front door and a
   * cupboard. The knobs below do the other half of the same job.
   */
  img.rect(15, 11, 2, 2, tone('gold', 0.46));
  img.rect(15, 11, 1, 2, tone('gold', 0.74));
  img.rect(15, 20, 2, 1, tone('gold', 0.34));
  img.px(15, 20, tone('gold', 0.6));

  /*
   * THE KNOBS, ONE ON EACH LEAF. There was one, on the right, and a single knob on a plank slab is
   * a cupboard door.
   *
   * The board's pair is symmetric about the astragal and measured: its left knob sits at x 2290..2297
   * and its right at 2367..2376, so their centres are 78 board pixels apart about a centre line at
   * 2332, which the light's own frame puts at 2334. On the same 6.6-to-one ruler that is about twelve
   * of our pixels apart -- six either side of the leaf's centre at 15.5 -- and the knob already here
   * is at seven. So the second one is the first one mirrored, and nothing moves.
   */
  for (const kx of [8, 22] as const) {
    img.rect(kx, 21, 2, 3, tone('gold', 0.56));
    img.px(kx, 21, tone('gold', 0.92));
    img.rect(kx, 24, 2, 1, WOOD_LINE);
  }

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
   * needs to survive the playing camera. Three toes over a pad, twice, the second one further in and
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
 *
 * ---------------------------------------------------------------------------------------------
 * ROUND TWO: IT WAS LYING DOWN, AND THE BOARD'S IS STANDING UP.
 *
 * Three puffs "up and to the right" came out as a shallow dash. Measured on the painted tile: a
 * bounding box 13 wide by 6 tall, h/w = 0.46, widest in its middle and NARROW at the flue. At the
 * playing camera that is a white tick flying off the chimney -- it reads as something thrown, not
 * as something rising, and it was the last thing left on this building that the board does and we
 * did not.
 *
 * The board's, probed on the mock itself (`2660 1130 130 90 8`, and the row scan is in the handback)
 * is the opposite shape in every respect:
 *
 *     y 1190..1201   x 2701..2720     ~18 board px wide   <- at the flue, NARROWEST
 *     y 1167..1182   x 2696..2737     ~41
 *     y 1142..1157   x 2714..2772     ~58                 <- at the top, WIDEST, and drifted right
 *
 * So it is a CONE standing on the flue: it leaves the pot about as wide as the pot, widens as it
 * climbs, and only leans right at the very top where the air takes it. Its bounding box is 78 by 60
 * board pixels -- h/w 0.77 -- and it is a continuous billowing mass with a lumpy edge, not a row of
 * separate discs.
 *
 * TWO NUMBERS CONVERT IT, and both are taken off this same chimney rather than off the facade,
 * because the two are not drawn at the same scale. The board's crown is 83 board px wide against our
 * 26, which is 3.19 board px to one of ours. On that ruler its plume is 60/3.19 = 19 of our rows
 * tall, which this tile does not have and never will -- the row above the chimney is lawn. What
 * transfers instead is the RATIO to the stack it stands on: the board's plume is 0.47 of its own
 * stack's height (60 against 129), and its aspect is 0.77.
 *
 * THE CROWN GIVES UP A ROW AND THE STACK TWO, which buys the plume nine rows against seven. At a
 * stack of eighteen rows, nine is a ratio of 0.50 -- the board's 0.47, as near as whole rows get --
 * and nine rows against an eleven-wide cone is an aspect of 0.82 against the board's 0.77. The crown
 * loses nothing by it: five rows still carry the lit top edge, the flue notch and the dark
 * under-edge of the overhang, which is everything it was drawing in six.
 *
 * THE PUFFS ARE SEVEN, NOT THREE, AND THEY DO NOT SIT IN A LINE. Three discs on a path is a string
 * of beads however the path is drawn; what makes a mass look like vapour is that its edge is lumpy,
 * and the cheapest lumpy edge is the union of more, smaller, off-axis circles. Four climb the middle
 * and three sit out to one side or the other, so the silhouette bulges and pinches on both edges
 * without a single pixel having to be knocked out of it -- which matters, because knocking pixels
 * out of an opaque mass drawn on transparency is how this project puts holes in things.
 */
const SMOKE_Y = 9; // rows 0..8 are the plume; the crown starts here
const CROWN_H = 5; // the crown slab, flue notch included
const STACK_Y = SMOKE_Y + CROWN_H; // and the stack below it

/**
 * The plume: centre, radii and tone per puff, ordered from the flue upward.
 *
 * `t` fades as the puffs climb, which is the dispersal the board draws at the top of its own column
 * -- but it fades slowly and it never goes near the floor. The plume has to stay LIGHTER than the
 * lawn it is seen against (about luma 180) along its whole height, or the top of it simply vanishes
 * and the cone becomes a blob again. At the thinnest puff the body still lands around 192 and its
 * core around 228, and the guard at the foot of this file holds that.
 */
const PLUME = [
  [15.0, 8.3, 2.6, 2.0, 1.0], // in the flue mouth, and no wider than the flue
  [16.2, 6.2, 3.2, 2.1, 0.98],
  [14.2, 5.2, 2.2, 1.9, 0.94], // a lobe out to the left, so the column is not a tube
  [18.0, 4.2, 3.4, 2.2, 0.92],
  [15.2, 3.2, 2.8, 2.0, 0.9],
  [19.8, 2.4, 3.0, 2.0, 0.86],
  [17.0, 1.8, 2.8, 1.7, 0.82],
  [21.4, 1.6, 2.0, 1.4, 0.78], // the last of it, breaking up as it goes over
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
      img.px(
        x,
        y,
        tone('stone', clamp(0.72 - 0.46 * ((y - SMOKE_Y) / (CROWN_H - 1)) - 0.12 * ((x - 3) / 25))),
      );
  img.rect(3, STACK_Y - 1, 26, 1, tone('stone', 0.08)); // the dark under-edge of the overhang
  img.rect(11, SMOKE_Y, 10, 3, tone('night', 0.35)); // the flue
  img.rect(11, SMOKE_Y, 10, 1, keyline('night', 10));

  /*
   * THE FLASHING, and it is the whole of the review's third cottage fault: "the chimney stands on
   * the lawn. At that crop its base sits above the roof's top course with bushes either side, so it
   * reads as a stone box in the garden that happens to smoke; on the board it rises from behind the
   * ridge."
   *
   * The diagnosis is exact and the cause is that this tile is laid a ROW ABOVE the roof, on cleared
   * grass, and it is only twenty of its thirty-two columns wide -- so what the frame contained was a
   * grey box with six pixels of lawn either side of it and two bushes beyond that. Nothing about the
   * stonework could fix it, because the fault was that there was no roof anywhere near the chimney.
   *
   * A stack does not stand on a roof, it comes THROUGH one, and where it does the roofer dresses a
   * skirt of slate up against it on every side. That skirt is the fix: a wedge of the roof's own
   * material flaring out of the stack's base down to the tile's bottom edge, where the ridge row
   * begins. It is two pixels at the top and five at the bottom, it is `roof` rather than `stone`, and
   * `outline()` below gives it the same silhouette as the stack, so it reads as one object rising out
   * of roofing rather than as a box with a plinth.
   *
   * It does not touch the stack itself: the courses, the bond and the crown are all as they were.
   * What it replaces is the lawn.
   */
  for (let y = TILE - 6; y < TILE; y++) {
    const spread = Math.round(((y - (TILE - 7)) / 6) * 5);
    const t = 0.46 - 0.26 * ((y - (TILE - 6)) / 5);
    for (let d = 1; d <= spread; d++) {
      img.px(6 - d, y, tone('roof', clamp(t + (d === spread ? 0.18 : 0))));
      img.px(25 + d, y, tone('roof', clamp(t - 0.1 + (d === spread ? 0.12 : 0))));
    }
  }

  img.outline(STONE_LINE);
  // outline() cannot give the 2px band on the side the light does not reach, so the shade-side
  // keyline is thickened by hand -- against the stack only, where the mass is 20 wide. The crown is
  // left at one pixel: a second line beside a 6px-tall overhang reads as a loose tick floating off
  // the chimney rather than as a thicker edge.
  // It stops where the flashing starts: carried to the tile's bottom edge it ruled a black line
  // straight down through the skirt and cut the stack back off its roof.
  img.rect(27, STACK_Y + 2, 1, TILE - 6 - (STACK_Y + 2), STONE_LINE);

  /*
   * The plume, LAST, after `outline()`, so the stonework keeps its silhouette and the smoke does not
   * get one: vapour has no edge, and a near-black ring round each puff would read as three grey
   * rocks floating over the roof. The board's cottage has a plume, which is most of what says
   * somebody is home -- and in a story about a house that is not what it looks like, smoke from the
   * chimney is the lie the player can see from the gate.
   *
   * Each puff is a lit sphere rather than a flat disc: a body at the puff's own tone with a brighter
   * core set up and to the left, from the same top-left sun as every other object on this building.
   *
   * The bodies are laid FIRST and the cores second, in two passes over the same list rather than one
   * pass drawing both. In one pass a later puff's body covers an earlier puff's core, so the column
   * came out as a row of bright crescents with dark gaps between them -- the beads this round is
   * getting rid of. Two passes let the cores read as one continuous lit spine up the middle of the
   * mass, which is what the board's does. (This is not the old "it was drawn twice" bug, which was
   * two loops drawing the whole puff at two different tone pairs; here each pass draws a different
   * part of it.)
   *
   * AND THE CORE IS `wall`, NOT `stone`. `stone` tops out at luma 210 and the grass behind this tile
   * reads about 180, so a puff built entirely from that ramp had thirty luma of silhouette at its
   * very brightest and under ten across most of its body -- rendered against the lawn the plume was
   * invisible, which is the whole point of the tile gone. Smoke in sunlight is the lightest thing in
   * a frame; `wall`'s head is the lightest value the palette holds, and the body stays in `stone` so
   * the puff still has a shaded underside.
   */
  for (const [px, py, rx, ry, t] of PLUME)
    img.ellipse(px, py, rx, ry, tone('stone', clamp(t - 0.16)));
  for (const [px, py, rx, ry, t] of PLUME)
    img.ellipse(px - rx * 0.28, py - ry * 0.28, rx * 0.62, ry * 0.62, tone('wall', clamp(t - 0.3)));
};

export const COTTAGE_TILES: Record<string, Painter> = {
  wall: cottageWall,
  'wall-corner': wallCorner,
  'wall-window': windowTile(false),
  'wall-window-lit': windowTile(true),
  gable: cottageGable,
  door: cottageDoor,
  'roof-l': roof('left'),
  'roof-m': roof('middle'),
  'roof-r': roof('right'),
  'roof-peak': roof('peak'),
  chimney,
};

/* ------------------------------------------------- the guards, at import time */

/*
 * Two things on this building are one edit away from going back to what the board round found, and
 * neither of them says anything at runtime when it does. They are checked here rather than in a test
 * file for the same reason `w-trees.ts` checks its crown here: every tool that paints a tile loads
 * this module, so `pnpm graybox`, `pnpm world`, `pnpm score` and `pnpm preview` all run them, and
 * two 32x32 paints is a cost nobody will notice.
 *
 * Both are TWO-SIDED where a one-sided bound could be satisfied by deleting the thing. The cheapest
 * way to pass "the plume stands up" is to paint no plume at all -- an empty region has whatever
 * aspect you like -- so the area floor is the load-bearing line here, not the aspect.
 */

/**
 * The plume: everything above the crown that is lighter than the stonework's keyline.
 *
 * The luma floor is what separates smoke from the line `outline()` lays along the top of the crown,
 * which lands in the same rows. `STONE_LINE` is about luma 38 and the dimmest smoke about 175, so
 * 160 is nowhere near either of them.
 */
function plumeSignature(): {
  area: number;
  w: number;
  h: number;
  rise: number;
  pale: number;
  base: number;
} {
  const img = new Img(TILE, TILE);
  chimney(img);
  let area = 0;
  let pale = 0;
  let minx = TILE;
  let maxx = -1;
  let miny = TILE;
  let maxy = -1;
  let base = 0;
  for (let y = 0; y < SMOKE_Y; y++)
    for (let x = 0; x < TILE; x++) {
      const c = img.get(x, y);
      if (c[3] === 0 || lumaOf(c) < 160) continue;
      area++;
      if (y === SMOKE_Y - 1) base++;
      // The lawn behind this tile reads about 180, so smoke under that value is smoke nobody sees.
      if (lumaOf(c) >= 185) pale++;
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
    }
  const w = maxx - minx + 1;
  const h = maxy - miny + 1;
  return { area, w, h, rise: area > 0 ? h / w : 0, pale: area > 0 ? pale / area : 0, base };
}

/*
 * Measured on the tile as drawn: area 73, bbox 11 x 9, rise 0.82, pale share 0.86, base row 6 wide.
 * Measured by this same function on the version it replaces -- the failure these bounds are aimed
 * at -- area 49, bbox 13 x 7, rise 0.54, base row 5 wide: a dash lying across the crown.
 *
 * Every bound sits between the two and nearer the failure, so there is room to retune the puffs and
 * none to lay the plume down again. The old plume trips BOTH of the two that matter rather than one
 * of them, which is what says they discriminate: 49 is under the area floor of 58 and 0.54 is under
 * the aspect floor of 0.62. Proven by reverting this file's `SMOKE_Y`, `CROWN_H` and `PLUME` to
 * their old values and watching each throw in turn, then restoring and watching it pass.
 */
const PLUME_GUARD = {
  areaLo: 58,
  areaHi: 110,
  riseLo: 0.62,
  riseHi: 1.4,
  paleLo: 0.7,
  baseLo: 4,
  baseHi: 10, // the flue is ten columns: smoke leaves the pot no wider than the pot
} as const;

{
  const s = plumeSignature();
  const say = `area ${s.area}px, bbox ${s.w}x${s.h}, rise ${s.rise.toFixed(2)}, pale ${s.pale.toFixed(2)}, base ${s.base}px`;
  if (s.area < PLUME_GUARD.areaLo || s.area > PLUME_GUARD.areaHi)
    throw new Error(
      `Chimney plume out of band (want ${PLUME_GUARD.areaLo}..${PLUME_GUARD.areaHi}px): ${say}. Under the floor there is barely a plume left; over the ceiling it is a cloud sitting on the roof.`,
    );
  if (s.rise < PLUME_GUARD.riseLo || s.rise > PLUME_GUARD.riseHi)
    throw new Error(
      `Chimney plume is not standing up (want h/w ${PLUME_GUARD.riseLo}..${PLUME_GUARD.riseHi}, the board's is 0.77): ${say}. Below the floor it is the dash that read as something thrown off the chimney; above the ceiling it is a stick.`,
    );
  if (s.pale < PLUME_GUARD.paleLo)
    throw new Error(
      `Chimney plume has gone darker than the lawn it is seen against (want at least ${PLUME_GUARD.paleLo} of it over luma 185): ${say}.`,
    );
  if (s.base < PLUME_GUARD.baseLo || s.base > PLUME_GUARD.baseHi)
    throw new Error(
      `Chimney plume does not leave the flue properly (want its lowest row ${PLUME_GUARD.baseLo}..${PLUME_GUARD.baseHi}px wide): ${say}.`,
    );
}

/*
 * THE DOOR HAS TWO KNOBS, one on each leaf, symmetric about the astragal.
 *
 * It had one, on the right, and a single knob on a plank slab is a cupboard. The pair is what says
 * the board's double door, and it is three lines of drawing that a tidy-up would happily fold back
 * into one. Gold is told from the timber around it by its green-to-blue gap, which runs 84 to 126
 * across the `gold` ramp and 35 to 58 across `wood`: 70 sits in the middle of that with room either
 * side, and it needs no hex.
 */
{
  const img = new Img(TILE, TILE);
  cottageDoor(img);
  const furniture = (x: number, y: number): boolean => {
    const c = img.get(x, y);
    return c[3] > 0 && c[1] - c[2] > 70;
  };
  const seen = new Set<string>();
  const centres: number[] = [];
  for (let y = 21; y <= DOOR_FOOT; y++)
    for (let x = OPEN_L; x <= OPEN_R; x++) {
      if (!furniture(x, y) || seen.has(`${x},${y}`)) continue;
      let n = 0;
      let sum = 0;
      const queue: [number, number][] = [[x, y]];
      while (queue.length) {
        const [cx, cy] = queue.pop()!;
        if (cx < OPEN_L || cx > OPEN_R || cy < 21 || cy > DOOR_FOOT) continue;
        const key = `${cx},${cy}`;
        if (seen.has(key) || !furniture(cx, cy)) continue;
        seen.add(key);
        n++;
        sum += cx;
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      centres.push(sum / n);
    }
  const middle = (OPEN_L + OPEN_R) / 2;
  const say = `${centres.length} mark(s) at x ${centres.map((c) => c.toFixed(1)).join(', ')}`;
  if (centres.length !== 2)
    throw new Error(`Grandma's door wants exactly two knobs, one per leaf; found ${say}.`);
  const skew = Math.abs((centres[0]! + centres[1]!) / 2 - middle);
  if (skew > 1)
    throw new Error(
      `The door's knobs are not symmetric about the astragal at x ${middle} (out by ${skew.toFixed(1)}px): ${say}.`,
    );
}

/*
 * THE WOLF IN THE WINDOW, THREE WAYS IT CAN GO WRONG WITHOUT A SOUND.
 *
 *   1. He leaks into the TILE. `wall-window-lit` is laid on every ending and seen all walk; if his
 *      ink ever reaches it, the ending is given away from across the garden and Grandma's ending
 *      has a wolf in it -- the exact defect the note above `windowTile` took him out of the tile to
 *      fix. So the laid tile carries not one pixel of the wolf's ink.
 *   2. He leaks out of the GLASS. The overlay is laid over the whole cell, so a stray mark would be
 *      painted on the frame, the sill or the flower box on one ending only, which is a building that
 *      changes shape. Every opaque overlay pixel sits inside the opening.
 *   3. He stops READING. Two-sided, because both failures are a window that says nothing: a speck
 *      (under a quarter of the glass) is not "something in there", and a blackout (over three
 *      fifths) is a window with the lamp off. Then the two features that make him a wolf and not a
 *      cat or a man in a chair: two ears with lamplight between them on his top row, and a muzzle
 *      that runs at least three columns past his eye.
 *
 * Measured on the overlay as drawn: 154 of the 306 glass pixels (0.50) are his, with 45 of chair
 * and 2 of eye (201 in all, every one inside the opening); his top row is two single-pixel tips
 * four columns apart; the muzzle runs four columns past the eye. Each check was proved by breaking
 * it -- the sitter painted into the laid tile (154px leaked), the ears filled in (1 run), the muzzle
 * cut to the eye (1 column), a pixel on the sill (1 outside), him cut to his ears (0.09) and the
 * glass blacked out (0.85) -- and the file restored and checked back with `cmp`.
 */
{
  const INK = tone('ink', 0);
  const isInk = (c: RGBA): boolean => c[0] === INK[0] && c[1] === INK[1] && c[2] === INK[2];
  const lit = new Img(TILE, TILE);
  windowTile(true)(lit);
  let leaked = 0;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (isInk(lit.get(x, y))) leaked++;
  if (leaked > 0)
    throw new Error(
      `wall-window-lit carries ${leaked}px of the wolf's ink. That tile is laid on every ending and seen the whole walk; the wolf belongs to the fx-window-wolf overlay, which the scene shows on his ending only.`,
    );

  const over = new Img(TILE, TILE);
  WINDOW_WOLF(over);
  let outside = 0;
  let him = 0;
  let eyeX = TILE;
  let nose = TILE;
  let crown = TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const c = over.get(x, y);
      if (c[3] === 0) continue;
      if (x < GLASS_L || x > GLASS_R || y < GLASS_T || y > GLASS_B) outside++;
      if (isInk(c)) {
        him++;
        nose = Math.min(nose, x);
        crown = Math.min(crown, y);
      } else if (c[0] > c[2] + 60 && lumaOf(c) > 150) eyeX = Math.min(eyeX, x);
    }
  const glass = (GLASS_R - GLASS_L + 1) * (GLASS_B - GLASS_T + 1);
  // The top row he reaches, as runs of ink: the ears are two of them with light between.
  const runs: number[] = [];
  for (let x = GLASS_L, inRun = false; x <= GLASS_R; x++) {
    const ink = isInk(over.get(x, crown));
    if (ink && !inRun) runs.push(x);
    inRun = ink;
  }
  const say =
    `${him} of ${glass} glass pixels (${(him / glass).toFixed(2)}), ${outside} outside the opening, ` +
    `${runs.length} ink run(s) on his top row, nose at x ${nose}, eye at x ${eyeX}`;
  if (outside > 0)
    throw new Error(
      `fx-window-wolf paints outside the window's glass: ${say}. It is laid over the whole cell, so anything outside the opening redraws the building on one ending only.`,
    );
  if (him / glass < 0.25 || him / glass > 0.6)
    throw new Error(
      `The wolf in the window is out of band (want 0.25..0.6 of the glass): ${say}. Under it he is a speck nobody notices; over it the window stops reading as lit.`,
    );
  if (runs.length !== 2)
    throw new Error(
      `The wolf in the window has lost his ears (want two tips with light between them on his top row): ${say}. Two pointed ears are what the board's silhouette is read by; one lump is a bear or a hat.`,
    );
  if (eyeX - nose < 3)
    throw new Error(
      `The wolf in the window has lost his muzzle (want it at least 3 columns past his eye): ${say}. Shorten the muzzle and he is a dog, or Grandma.`,
    );
}
