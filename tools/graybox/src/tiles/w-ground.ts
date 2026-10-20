/*
 * Ground: grass and path at 32x32, redrawn against the approved concept board.
 *
 * This is the floor of the whole game -- forty of these are on screen at once -- so it is the group
 * that decides whether the world looks drawn or generated.
 *
 * THE BOARD'S OPEN LAWN. Re-probed this round on a bigger and cleaner sample than before: the
 * largest unbroken square on the Explore frame with no tree, bush, path or figure in it, found by
 * search rather than by eye, 63x63 board pixels at (1156,700). At our own pixel density:
 *
 *     darkest 127   p02 143   p05 150   p50 179   p90 183   p98 193   stdev 10.5
 *     0.00% under luma 81      0.00% under luma 60      edge density 1.68%
 *
 * Read the two ends of that, because together they are this round's whole brief. The board's lawn
 * is a BRIGHT YELLOW-GREEN at 179 whose darkest pixel anywhere is 138 -- a mid-green, #71a444. Not
 * one pixel of open lawn on the board is near-black, and its edge density is a fifth of what our
 * own lawn tile was carrying. The lawn is calm; all the dark and all the busyness on that frame
 * belong to the canopies, the bushes and the objects.
 *
 * 2026-10-20: THE QUILT IS BACK, IT IS NOT THE VIGNETTE, AND IT IS A SEED ACCIDENT IN THE RIM FIELD.
 *
 * A client looking at a phone reported "glitches" in the undergrowth and the lawn. On a phone the
 * camera is zoom 1 and shows 11.5 x 16.7 tiles against the desktop's 19.4 x 11.2, so a per-tile
 * artefact is about three times as frequent in the frame -- which is why this surfaced there first
 * and had been passing on desktop.
 *
 * IT IS NOT THE VIGNETTE AND IT IS NOT UNDERGROWTH. Both were checked before anything was changed.
 * The vignette depth really is gone -- `BANDS` are re-centred and the counterfactual with the
 * envelope forced flat has a column ripple of exactly 0.0 on all four variants. And the undergrowth
 * tiles do NOT replace their grass square: `w-undergrowth.ts` paints the shipped `GROUND_TILES`
 * backing and their untouched border pixels measure 153.1 to 154.6 against the bare variants'
 * 153.3 to 154.8, so the backing is correct to a luma and inherits whatever this file does.
 *
 * WHAT IT ACTUALLY IS: `SHARED.rim` is equalised to a field mean of exactly 0.500, but nothing ever
 * asked its BORDER to be unbiased and it is not -- 0.273, every one of the four sides low, 7.7 luma
 * of darkening on the outer two-pixel ring of every grass tile and every path verge in the world, in
 * the same direction and the same phase. `massField` pins the envelope to zero on exactly that ring,
 * so those are the pixels where the rim is the ONLY term and the accident is shown undiluted. The
 * note above `EDGE_OCTAVES` had already measured this to three decimals and deferred it to "a round
 * that owns the boundary figures". This is that round. See `levelBorder`.
 *
 *     composed lawn, 240 ground tiles of the spawn frame      before   after
 *     folded peak-to-peak, column axis                          16.5    11.5
 *     folded peak-to-peak, row axis                             12.2    10.8
 *     worst frame deficit, ring against its own interior        +10.4    +4.7
 *     `assertNoSeamBand`, worst of sixteen pairings              11.7     6.8
 *
 * AND `assertNoSeamBand` WAS GREEN THE WHOLE TIME, at 11.7 against its limit of 14, because a frame
 * printed by every tile darkens its `band` and its `rest` together. That is a different fault from
 * the one it names and it now has `assertRimBorderUnbiased` watching it.
 *
 * WHAT IT COST, recorded because it is not small and the next round has to pick it up: the mid-range
 * share over the composed lawn falls 37.8% -> 29.6%. The dark ring is a quarter of every tile and it
 * sat just under the 96-160 band's ceiling, so a quarter of the lawn was counting as mid-range
 * BECAUSE it was too dark -- the figure the 2026-10-19 `EDGE_L` sweep tuned on was partly measuring
 * the grid. Winning it back means bringing the CORES down to the ring rather than the ring up to the
 * cores, which is `BANDS` and `EDGE_L`, and it is deliberately not done here: two large changes to
 * the lawn in one round and neither can be judged. The full argument is in `levelBorder`.
 *
 * 2026-10-20: THE LAWN HAS TUFTS. One chevron per variant, and it is the only mark in this file
 * drawn at an absolute tone rather than at a share of the ground under it. The design board's
 * finding was that "five by six tiles of w-grass.png at 5.6x contain not one three-blade sprig" and
 * that the board's "are plainly visible as little chevrons", and both halves were true: `sprig` drew
 * the right shape at a depth of 13 to 36 luma, which is inside the mottle's own range and therefore
 * not a plant. See the long note above `CHEVRON`, which also records why the withdrawn luma-36 floor
 * is not being re-opened by this. Two of the four sit ON a tile edge and wrap, so the common joins
 * carry a tuft that straddles them rather than a motif centred in every square.
 *
 * WHAT THE LAST THREE ROUNDS CHANGED, AND WHY EACH CHANGE COST THE SCORE SOMETHING.
 *
 * 1. THE MARKS ARE GREEN AGAIN. The previous pass pinned every blade root and contact pool to an
 *    absolute floor of luma 36 and won four axes doing it. On the forest floor that was defensible;
 *    on a lawn at 176 it was a near-black speck, and a tile of them reads as flies on grass. Depth
 *    is now a SHARE of the ground the mark stands on (`MARK_FALL`), so a lawn tuft bottoms out at
 *    127 -- the board's own figure to the pixel -- and a tuft on shaded ground at 83. See the note
 *    on `MARK_FALL`.
 *
 * 2. EVERY GRASS TILE NOW HOLDS THE SAME TONE AT ITS BORDER. The four variants' border rings
 *    measured 92.8, 125.2, 155.0 and 164.6 mean luma: steps of 32, 30 and 10 landing on a dead
 *    straight line every 32 pixels, which is the quilt the director found and which no amount of
 *    overlapping the bands had removed. A tile cannot see its neighbours, so the fix is to stop
 *    carrying a variant's identity at its border at all -- see the note on `BANDS`.
 *
 *    THIS FILE THEN STATED FOUR RINGS OF 173.3, 172.6, 172.7 AND 171.4 FOR A YEAR AND NEVER DREW
 *    THEM. Re-measured off the painters on 2026-10-20, before this round's change: 153.2, 153.3,
 *    155.2 and 153.9, against interiors of 167.0, 165.7, 171.0 and 174.9. The rings were right
 *    about the thing they were asserting -- all four within two luma of each other, so there is
 *    no step BETWEEN tiles -- and silent about the thing that matters as much: every one of them
 *    sat twelve to twenty-one luma under its own tile's middle, so composed grass printed a dark
 *    line every 32 pixels in both axes. See `BANDS` for the fix and `assertNoSeamBand` for the
 *    guard that now watches it. The rings themselves barely move; the interiors come down to meet
 *    them.
 *
 *    STATED PRECISELY, because the loose version of this claim is wrong and someone will check it.
 *    The FIELD cannot step: at a boundary both tiles evaluate the same shared rim at the same phase
 *    with a mass of zero, so they are the same colour, in all sixteen pairings. The MARKS can, where
 *    a tuft happens to be cut by the tile edge. Re-measured over all 1024 grass-to-grass boundary
 *    pixels after the chevron went in: median step 0.0, mean 5.6, 8.40% of them above the 24 luma
 *    the score calls an edge, against 5.76% before. Split by pairing, same variant on both sides
 *    gives 7.42% and different variants 8.72%. Every one of those is a blade edge two or three
 *    pixels long -- a chevron's point row is wider than the row under it, so its own silhouette
 *    registers wherever it lands, join or no join. The median is the number that matters and it is
 *    still zero: the quilt was a continuous straight edge running the whole length of every tile,
 *    and there is not one of those anywhere.
 *
 *     variant   share   core band    centre   rim    role
 *     grass-0   30.6%   159 .. 177    168     164    open lawn
 *     grass-1   58.9%   144 .. 172    158     164    the lawn's shaded side, and most of the grass
 *     grass-2    8.6%   160 .. 180    170     164    open lawn -- the board's own 179
 *     grass-3    1.9%   164 .. 180    172     164    full sun
 *
 * THOSE SHARES ARE OF THE GRASS CELLS, not of the whole ground layer, and the distinction matters
 * because the figures this table replaced (44.9 / 33.3 / 6.0 / 1.2) were of the ground. Counted
 * off the generator on 2026-10-20: 658 / 1268 / 185 / 40 of 2151 grass cells, in a ground layer of
 * 2520 of which 116 are path family.
 *
 * AND THE SHARES WERE THE WRONG WAY ROUND IN THIS FILE UNTIL NOW, which matters because every
 * decision below was argued from them. It said grass-0 was 53.7% and grass-1 38.3%, and reasoned
 * from that which variant "has to be quiet" and which join "is the join the player sees". Counted
 * off the same generator the game ships, grass-1 is 58.9% and grass-0 30.6% -- the two are
 * swapped. So the variant the map actually lays over most of the lawn is `grass-1`, and it is
 * `grass-1` that is now pitched BELOW the shared rim while the other three sit above it, which is
 * what makes the four vignettes cancel rather than add. See `BANDS`.
 *
 * THE RIM IS 164, NOT 173. The four rows above said `~173` for a rim that `EDGE_L` has set to 164
 * since 2026-10-19, and that single stale number is the whole of this round's lawn defect: the
 * bands were left centred on a rim that had moved nine to twenty luma out from under them.
 *
 * 3. THE SHADE TILE IS GONE AND THE LATTICE WENT WITH IT (2026-10-19, blocker 4 of the design
 *    review). A seam-free border is not a seam-free frame: `rim + (core - rim) * mass` with a mass
 *    that is zero at the border and one in the middle is a tile-centred vignette whose depth is
 *    `rim - core`, and change 2 above spent that freedom on an 80-luma one, on the tile the map
 *    lays over half the grass. Dappling it and cutting its coverage was this file's answer to the
 *    chequerboard, and it could not work, because the fault was the vignette's DEPTH and not its
 *    shape. grass-0's band was centred on the shared rim -- on the rim as it then was.
 *
 *    THE 9.1 / 12.6 IT CLAIMED FOR THE FOLD IS NOT A NUMBER THIS FILE HAS EVER PRODUCED EITHER,
 *    and it was measured before `EDGE_L` moved. Run on 2026-10-20 over the same 2151 grass cells:
 *    x 22.0, y 13.1, mean luma 163.0. Change 4 below brings it to x 16.9, y 10.1 at 158.8.
 *
 * 4. THE BANDS ARE CENTRED ON THE RIM THE FILE ACTUALLY HAS (2026-10-20). Change 3 centred
 *    grass-0's band on a rim of 176 and the round that followed took `EDGE_L` to 164 without
 *    moving a band, so all four core bands ended up nine, four, fourteen and twenty luma ABOVE the
 *    tone their own borders hold. `rim + (core - rim) * mass` with `mass` zero at the border turns
 *    any such offset into a vignette of exactly that depth, in the same direction, on every tile --
 *    which is a dark grid at the tile pitch, and is what change 3 set out to remove.
 *
 *    The four offsets are now +4 / -6 / +6 / +8 and they are deliberately MIXED IN SIGN, weighted
 *    by the shares above so that the map-wide mean offset is -1.6 luma: where one variant's middle
 *    is a shade lighter than its border, its commonest neighbour's is a shade darker, and the two
 *    cancel in the fold instead of stacking. Measured, per variant, outer ring against interior:
 *
 *                       before            after
 *     grass-0     153.2 / 167.0  13.8    153.1 / 162.0   8.9
 *     grass-1     153.3 / 165.7  12.4    153.3 / 156.1   2.9
 *     grass-2     155.2 / 171.0  15.8    155.2 / 163.7   8.5
 *     grass-3     153.9 / 174.9  21.0    153.9 / 165.0  11.1
 *
 *    And composed, which is the only form a player ever sees: the four columns straddling a join,
 *    against the rest of a two-tile strip, worst of all sixteen pairings -- 17.3 -> 11.7 luma on
 *    the column axis and 13.1 -> 9.0 on the row axis. The column axis is reported first because
 *    the camera is a letterbox and it was the worse of the two. `assertNoSeamBand` holds it.
 *
 *    THE SHARED-RIM RESULT IS UNTOUCHED, which was the condition on this change: over all 1024
 *    grass-to-grass boundary pixels the median step is still 0.0, the maximum still 64.3 and the
 *    share above 24 luma still 8.40%, because the border pixel is evaluated at `mass` 0, where the
 *    band drops out of the expression entirely. Only the vignette depth moved.
 *
 *    IT COSTS SIX LUMA OF LAWN, honestly and on purpose: the grass cells' mean falls 163.0 -> 158.8
 *    against the board's own open lawn at 177.6, and the spawn camera's board distance rises 0.239
 *    -> 0.247 on spread (51.44 -> 50.47) and texture (31.20 -> 30.62), with deep shade and keyline
 *    unmoved at 18.45 and 12.76. Both of the axes that moved were counting the vignette as range.
 *    The six axes cannot see repetition, which is the whole of what this change fixes. What it buys
 *    back on the same instrument is the ladder the map's cast shadow rides on: grass-1 to grass-0,
 *    the two variants that cover 89.5% of the lawn, were 2.1 luma apart and are now 4.6.
 *
 *    THE EIGHTEEN CELLS THIS MOVES, decoded out of the sheet and diffed against the gid manifest
 *    rather than assumed: `grass-0..3`, every one of the eight undergrowth tiles, and the six props
 *    that bed on a lawn variant. Those fourteen call `GROUND_TILES` for their floor on purpose --
 *    "the floor gets one opinion" -- so they inherit this and should. Nothing else in the 79 moves:
 *    all nine path-family cells are byte-identical, which is the check that `PATH_BAND` was left
 *    alone, and so are the trees, the water, the fence, the cottage, the three stall awnings and
 *    `door-note`, none of which draws grass.
 *
 * MEASURED, changes 1 and 2 against this file's then-committed state with every sibling file held
 * at the same moment: five play cameras 0.220 / 0.216 / 0.221 / 0.183 / 0.260 -> 0.148 / 0.127 /
 * 0.146 / 0.124 / 0.206, whole map 0.473 -> 0.440. Change 3 moves the board distance the other way
 * -- the spawn camera 0.290 -> 0.353, on deep shade (19.23% -> 16.74%) and texture (33.75 -> 29.65)
 * -- and says so here rather than hiding it: the six axes cannot see repetition, which is the whole
 * of what change 3 fixes, and the deep shade they are counting was a dark square on open meadow.
 *
 * AIRBRUSHING WAS A REAL FAULT AND STAYS FIXED. Every field here is quantised -- the tone field, the
 * warmth field and the mass envelope -- so a tile carries flat colours in patches with real
 * boundaries rather than a photographic gradient sampled in 2x2 squares.
 *
 * HOW A GROUND PIXEL GETS ITS COLOUR, in one line:
 *
 *     luma = rim + (core - rim) * mass
 *
 *   - `rim`  one shared tone, from one shared field. Every grass tile, and the verge of every path
 *            tile, holds it at the border.
 *   - `core` where this variant's own tone field puts the pixel inside its band. Every band is
 *            centred near the rim, so `core - rim` changes sign across the tile and the envelope
 *            below has no systematic direction to pull in. That is the lattice fix: see `BANDS`.
 *   - `mass` an envelope that is ZERO on the outermost pixels and rises inward, its contour
 *            displaced by a wrapping blob field so the shape is not the tile's.
 *   - `warm` then leans the result toward sun or shade without moving it much in brightness.
 *
 * SOFT EDGES WITHOUT ALPHA. Every mark that sits on the ground -- blade, clover leaf, the lawn side
 * of a path lip -- gets a one-pixel halo whose colour is the midpoint of the mark and THE PIXEL IT
 * IS COVERING, computed arithmetically and written opaque. Nothing in this file is drawn at partial
 * alpha onto anything.
 *
 * SEAMS. The eight path edges share one periodic depth profile per side (`ringProfile`), so
 * `path-n` ends its north tear at exactly the depth `path-ne` starts its north tear at. Every tone
 * field wraps over exactly one tile. Marks are kept clear of every corner, where four tiles meet
 * and a mark would print as a repeated cross across the whole map.
 */
import { clamp01, Img, keyline, lumaOf, mix, noise, smooth, TILE, tone } from '../paint.ts';
import type { Painter, RGBA, Side } from '../paint.ts';

/** Which pixels a mark is allowed to land on. Edge tiles use it to keep grass off the sand. */
type Inside = (x: number, y: number) => boolean;
/**
 * The luma of the finished ground at a pixel.
 *
 * Marks ask for this instead of being told a band, which is what lets one tuft be a mid-green on a
 * sunlit lawn and a dark one on a shadowed patch of the SAME tile.
 */
type Ground = (x: number, y: number) => number;

const ALL: Inside = () => true;

const wrap = (t: number, n: number): number => ((t % n) + n) % n;

/**
 * Lean a colour toward a pole, then put most of its brightness back.
 *
 * This is the one piece of machinery that lets the ground vary in colour without varying in tone,
 * and it exists because the first version of the warmth axis quietly wrecked the lawn. Mixing 22%
 * of a shade tone into a grass pixel takes twenty-one luma off it, so a warmth field that was
 * meant to change hue was in fact a second brightness field -- and a variant's band opened from the
 * nine luma it was designed for to twenty-eight. At 5x it read as camouflage.
 *
 * `pin` is how much of the lost brightness is restored, by scaling the channels rather than adding
 * to them, so the ratios between them -- the hue -- survive exactly. At 0.75 the sun and shade
 * leans still move a pixel a few luma, which is true of real sun and shade, while four fifths of
 * their effect lands where it was wanted: on the colour.
 */
const LUMA_PIN = 0.75;

function lean(base: RGBA, pole: RGBA, k: number): RGBA {
  const m = mix(base, pole, k);
  const want = lumaOf(base) + (lumaOf(m) - lumaOf(base)) * (1 - LUMA_PIN);
  const have = lumaOf(m);
  if (have <= 0) return m;
  const f = want / have;
  return [
    Math.min(255, Math.round(m[0] * f)),
    Math.min(255, Math.round(m[1] * f)),
    Math.min(255, Math.round(m[2] * f)),
    255,
  ];
}

/* ------------------------------------------------------------ smooth fields -- */

/*
 * THE FIELDS ARE BUILT AT 2x2 BLOCK RESOLUTION AND THEN QUANTISED.
 *
 * Both halves of that matter and an early pass only had the first. Sampling per 2x2 block makes the
 * field chunky in the way pixel art is chunky; it does NOT stop the field being a gradient, and a
 * fine tone field crossed with a continuous warmth field was an airbrush made of 2x2 squares.
 * ART_DIRECTION section 6.2 asks for mottle that steps in two-to-four pixel jumps and is never
 * anti-aliased, and a thirteen-level ramp inside a nine-luma band is anti-aliasing by another name.
 *
 * Quantising gives flat colours per tile arranged in patches with real boundaries -- which is what
 * the board's lawn is, and what a person drawing a tile would do. How MANY levels is not fixed: see
 * `levelsFor`, which picks the count from the band's width so the step stays constant at about
 * fifteen luma whether the band spans ninety or thirty.
 */
const BLOCK = 2;
const CELLS = TILE / BLOCK;

/**
 * Smooth value noise on a `cells x cells` lattice, periodic over exactly CELLS blocks (one tile).
 *
 * The lattice index wraps at `cells`, so sampling at b and at b+CELLS lands on the same lattice
 * point whatever `cells` is -- which means the cell count does NOT have to divide 16. That matters:
 * a lattice of 5 or 9 cells gives a pattern with no axis that lines up with the tile grid, where 4
 * or 8 quietly reintroduce the thing this file exists to remove.
 */
function wrapNoise(seed: number, cells: number): (bx: number, by: number) => number {
  const rnd = noise(seed);
  const g = new Float64Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (i: number, j: number): number => g[wrap(j, cells) * cells + wrap(i, cells)]!;
  const step = cells / CELLS;
  return (bx, by) => {
    const u = (bx + 0.5) * step;
    const v = (by + 0.5) * step;
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fx = smooth(u - i);
    const fy = smooth(v - j);
    const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
    const bot = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };
}

/** `[cells, weight]`: one octave of a summed field. */
type Octave = readonly [number, number];

function field(seed: number, octaves: readonly Octave[]): Float64Array {
  const fns = octaves.map((o, i) => wrapNoise(seed + i * 131, o[0]));
  const total = octaves.reduce((a, o) => a + o[1], 0);
  const out = new Float64Array(CELLS * CELLS);
  for (let by = 0; by < CELLS; by++)
    for (let bx = 0; bx < CELLS; bx++) {
      let v = 0;
      for (let i = 0; i < fns.length; i++) v += fns[i]!(bx, by) * octaves[i]![1];
      out[by * CELLS + bx] = v / total;
    }
  return out;
}

/** Snap a field to `levels` evenly spaced values, so a patch has a boundary instead of a gradient. */
function quantise(f: Float64Array, levels: number): void {
  for (let i = 0; i < f.length; i++) f[i] = Math.round(f[i]! * (levels - 1)) / (levels - 1);
}

/**
 * Replace every value by where it RANKS, passed through `curve`.
 *
 * This is the anti-checkerboard, and it is still needed now that the four variants differ on
 * purpose. Summed noise has whatever histogram the seed happened to give it, so two variants built
 * from two seeds differ in average brightness by a few luma of pure accident -- which was the
 * tile-sized brightness step that made a laid field read as a grid of squares. After this, every
 * variant holds the same distribution of positions WITHIN ITS OWN CORE BAND, so the only brightness
 * difference between two variants is the one `BANDS` states, and a variant cannot wander off the
 * step forest-map.ts assigned it by accident of seed.
 *
 * `curve` decides the shape inside a band. It is centre-heavy, so two thirds of a tile sits on the
 * middle of its three levels and the light and dark patches are a sixth each: the board's lawn is
 * one green with patches in it, not three greens in equal measure.
 */
function equalise(f: Float64Array, curve: (u: number) => number): void {
  const order = Array.from(f.keys()).sort((a, b) => f[a]! - f[b]!);
  const n = order.length;
  for (let r = 0; r < n; r++) f[order[r]!] = curve((r + 0.5) / n);
}

/* ------------------------------------------------------------------ tones -- */

/*
 * GROUND IS ASKED FOR BY BRIGHTNESS, NOT BY RAMP POSITION.
 *
 * Everything below -- the four variants' bands, every blade, the path lip -- is stated as a LUMA,
 * and `groundTone` finds the colour. That is not a stylistic preference, it is the thing that made
 * the rest of this file checkable: the board can be probed for luma, the score is defined in luma,
 * and a ramp position cannot be compared with either. The first attempt at this round's ladder was
 * written in ramp positions, which hid the fact that four evenly spaced slices of `t` are not four
 * evenly spaced brightnesses -- the grass ramp's top third spans 42 luma and its middle third 25 --
 * and it put the frame 11 luma below the board instead of 7 above.
 *
 * Two ramps, end to end. `shadow` runs luma 33 to 81 and `grass` runs 93 to 184; `shadow` is the
 * one dusk ramp docs/ASSETS.md allows and it extends grass downward rather than introducing a hue,
 * so the pair behave as a single green ladder from near-black forest floor to lawn in full sun.
 * The eleven luma between them are bridged by a blend of the two touching stops.
 */
const GRASS_L: readonly number[] = [92.7, 117.2, 142.3, 184.1];
const SHADOW_L: readonly number[] = [33.0, 47.2, 64.4, 81.2];

/** Where luma `l` sits on a ramp whose stops have those lumas: the piecewise-linear inverse. */
function atLuma(stops: readonly number[], l: number): number {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (l <= b || i === stops.length - 2)
      return clamp01((i + (l - a) / (b - a)) / (stops.length - 1));
  }
  return 1;
}

/** A green at (near enough) luma `l`, anywhere from deep forest floor to lawn in full sun. */
function groundTone(l: number): RGBA {
  if (l >= GRASS_L[0]!) return tone('grass', atLuma(GRASS_L, l));
  if (l <= SHADOW_L[3]!) return tone('shadow', atLuma(SHADOW_L, l));
  return mix(
    tone('shadow', 1),
    tone('grass', 0),
    (l - SHADOW_L[3]!) / (GRASS_L[0]! - SHADOW_L[3]!),
  );
}

/** The luma band one variant's field lives in. */
interface Band {
  readonly lo: number;
  readonly hi: number;
}

/*
 * THE LADDER, rebuilt round a RIM THAT EVERY VARIANT SHARES. This is the quilt fix and it is the
 * largest change in this round, so the reasoning is worth setting out in full.
 *
 * WHAT WAS MEASURED. The four tiles' BORDER rings -- the outermost pixel of each edge, which is
 * what actually abuts the next tile -- came in at 92.8, 125.2, 155.0 and 164.6 mean luma. Those are
 * steps of 32, 30 and 10 luma, and they land on a dead straight line every 32 pixels. That is the
 * quilt, and it is not an artefact of the previous pass's choices: it is what ANY design produces
 * if a variant's identity is carried by its overall brightness, because the only place two variants
 * can meet is the tile grid.
 *
 * The previous pass tried to hide it by OVERLAPPING the bands -- grass-0 spanning 56..146 against
 * grass-1's 98..178 -- which made the step between two tiles' means small relative to the spread
 * inside one tile. It did reduce the quilt and it was a reasonable move, but it is the move that
 * cost the cast shadow: with both bands covering the same ninety luma, a shadow tile and the lawn
 * beside it land at whatever their two independent noise fields happen to say, so the shadow edge
 * is sometimes ninety luma and sometimes nothing. The director measured the shadow landing in the
 * data (72.2% grass-0 east of a trunk against 24.9% in open ground) and not reading on screen. Both
 * of those are the same fact: a random step is not an edge.
 *
 * THE WAY OUT IS TO STOP CARRYING THE VARIANT'S IDENTITY AT ITS BORDER. A tile cannot see its
 * neighbours, but it can be built so that its border does not depend on which variant it is:
 *
 *   luma = rim + (core - rim) * mass
 *
 * `rim` is one tone, from one field, shared by all four variants and by the path tiles' verge.
 * `mass` is an envelope that is ZERO on the outermost pixels and rises inward. So at any grass-to-
 * grass boundary, in any combination of variants, both sides evaluate to exactly the same rim tone
 * and the seam cannot exist -- not reduced, absent by construction. Everything that makes a variant
 * a variant is carried in the middle of the tile, on fields that wrap.
 *
 * WHAT THAT ARGUMENT DOES NOT BUY, AND THE ROUND BEFORE THIS ONE SPENT IT ANYWAY. A seam-free
 * BORDER is not a seam-free FRAME. The rim argument removes the step between two tiles; it says
 * nothing about the shape each tile paints inside its own four edges, and `rim + (core - rim) *
 * mass` with `mass` zero at the border and one in the middle is, by construction, a tile-centred
 * vignette of depth `rim - core`. Lay that on every tile and the vignette IS the tile grid, however
 * irregular its contour: the eye does not need a straight edge to find a rhythm, it needs the same
 * event every 32 pixels.
 *
 * So the previous pass took grass-0's core to luma 92 against a rim of 172 -- an 80-luma vignette on
 * what the map lays over half the grass -- and recorded, in this same comment, that it had bought
 * back "the whole dynamic range". What it had bought was a lattice. The design review found it on
 * the title screen, which is the hero image of the whole asset, and measured it: grass-0's own
 * rim-to-core 91.5 luma against ART_DIRECTION section 6.2's 20-luma in-tile cap, a 4.6x breach, and
 * a peak-to-peak of 40.1 luma in x and 43.0 in y on the ground layer folded over the tile pitch.
 *
 * THE MEASUREMENT THAT SETTLES IT, because three rounds of this file have argued about the lattice
 * from tile crops that cannot show it. Take the whole ground layer -- all 2151 grass cells the map
 * actually lays -- and average each tile's luma by its position WITHIN the tile. If every tile
 * carries the same vignette the fold comes back as a bow, and its peak-to-peak is the lattice in
 * luma. A ground with no tile-pitch structure folds flat. That instrument is reproducible by anyone
 * and it does not care what any single tile looks like in isolation, which is the trap every
 * previous pass fell into.
 *
 *     ground layer, 2151 grass cells, folded over the tile pitch
 *     2026-10-19, before the lattice fix    x 40.12   y 42.96   mean luma 147.3
 *     2026-10-20, as that fix shipped       x 22.0    y 13.1    mean luma 163.0
 *     2026-10-20, bands re-centred          x 16.9    y 10.1    mean luma 158.8
 *
 *                                        board's own open lawn: 177.6
 *
 * THE MIDDLE ROW IS THE ONE WORTH READING. The lattice fix reported 9.12 / 12.55 and never produced
 * it, because the figure was taken before `EDGE_L` came down from 176 to 164 and the bands were
 * left where they were. A claim and a measurement is the same sentence in this file, so the row it
 * actually drew is printed beside the row it claimed.
 *
 * WHAT CHANGED THIS ROUND. Four numbers: the centre of each band, moved onto the rim the file has
 * rather than the rim it used to have, and MIXED IN SIGN so the four vignettes cancel. Where a
 * variant's core sits above the rim its middle is a shade lighter than its border; where below, a
 * shade darker; and because `grass-1` -- 58.9% of the grass -- is the one pitched below, the map
 * lays the two signs side by side in the proportion that flattens the fold. Per variant, on the
 * tile:
 *
 *     variant   core band   centre  rim   offset   ring -> interior   own fold x/y   role
 *     grass-0   159 .. 177   168    164     +4       153.1 -> 162.0   14.4 / 15.3    open lawn
 *     grass-1   144 .. 172   158    164     -6       153.3 -> 156.1   19.1 / 14.1    the shaded side
 *     grass-2   160 .. 180   170    164     +6       155.2 -> 163.7   18.1 / 14.2    board's own 177.6
 *     grass-3   164 .. 180   172    164     +8       153.9 -> 165.0   24.1 / 11.5    full sun
 *
 * The widths are untouched -- 18, 28, 20 and 16 -- so `levelsFor` still cuts every band into three
 * and the mottle's step inside a tile is the same step it was. Only the centres moved.
 *
 * THE OWN-FOLD COLUMN IS NOT YET WHERE IT SHOULD BE. Three of the four are inside section 6.2's
 * 20-luma in-tile cap and grass-3 is over it at 24.1, on 40 tiles in the whole world. The reason is
 * NOT the bands -- centring them took every one of those four figures down, from 17.6 / 25.1 / 23.3
 * / 28.9 -- it is the shared rim field, which is measured in the note on `EDGE_OCTAVES` carrying a
 * seven-luma dark bias on its own border ring. That is the largest single term left in the fold and
 * it is flagged there with its numbers rather than fixed here, because moving the rim moves the 1024
 * boundary pixels this change was required to leave alone.
 *
 * WHICH VARIANT TAKES THE OPEN-LAWN ROLE. ART_DIRECTION section 6.3 assigns grass-0 the shade and
 * grass-2 "the quiet one that lets the map breathe", and that assignment assumed shares this file
 * has twice now measured and found wrong -- most recently its OWN figures, which had grass-0 and
 * grass-1 swapped. Counted off the generator: grass-1 58.9%, grass-0 30.6%, grass-2 8.6%,
 * grass-3 1.9%. The variant that covers most of the grass is the one that has to be quiet,
 * whatever it is called, and it is grass-1. Re-dealing the roles would mean editing the shares in
 * forest-map.ts, which this change may not touch -- and that file's own note already asks for
 * exactly this remedy: "the real fix is for the ground painter to narrow the steps between the
 * variants and carry the variation inside each tile instead. Flagged."
 *
 * AND THE CAST SHADOW, WHICH IS WHAT THE DARK grass-0 WAS FOR. It goes, and it should: this file
 * has recorded for two rounds that a shadow drawn as a tile is always a shadow the shape of a tile,
 * because a tile cannot know where the tree above it stands. Of grass-0's tiles, the ones under a
 * canopy or a bush are not visible anyway and the bare ones came in runs of one and two, so what the
 * 80-luma vignette actually drew was isolated dark squares in open meadow. A shadow that hugs its
 * own trunk has to be a decoration sprite placed at map resolution. Still the joint decision this
 * file cannot make alone; it is now flagged without a lattice standing in for it.
 *
 * The hue walk still comes free. Low on the grass ramp R sits a shade BELOW B, a true blue-green;
 * at 180 R leads B by 63. The board does the same -- its shaded greens probe R-B -20 and its lawn
 * +70 -- so shaded ground comes out cool and sunlit ground yellow with no second hue invented.
 */
const BANDS: readonly Band[] = [
  { lo: 159, hi: 177 },
  { lo: 144, hi: 172 },
  { lo: 160, hi: 180 },
  { lo: 164, hi: 180 },
];

/**
 * The one tone every grass tile holds at its border, and how far the shared rim field moves it.
 *
 * It was once pitched just under the board's own open lawn (mean 177.6, median 178) on the argument
 * that the rim is the tile's lightest common ground; the 2026-10-19 sweep below took it to 164 to
 * win back the mid-range, which leaves it thirteen luma UNDER the board's lawn and makes it the
 * tone the four core bands have to be centred on rather than the ceiling they hang from. That is
 * the reading the per-variant table in `BANDS` now uses.
 *
 * The swing has to stay well under the 24 luma the score counts as an edge, or the rim field would
 * print steps of its own along the border ring. It also has to stay small for a reason the sweep
 * below does not mention and the note on `EDGE_OCTAVES` measures: this field is periodic over ONE
 * TILE, so whatever it says, it says in every tile of the world at the same phase, border ring
 * included.
 */
/*
 * Reopened 2026-10-19, after the lattice fix above cost the ground its shade.
 *
 * Killing the vignette moved grass-0 from a dark 62..116 to a bright 164..182 on 30.6 per cent of
 * the grass, which removed the tile grid and, with it, every dark green in the world. Measured
 * against the board: 42 per cent of every green pixel on screen landed in ONE luma bucket against
 * the board's 24, and the mid-range (luma 96-160) was 28 per cent against 42. That reads as dark
 * objects sitting on a flat bright field rather than as a wood, and it is what a viewer called
 * creepy before anyone measured it.
 *
 * THE TWO AXES ARE NOT THE SAME AXIS, and this is the whole lesson of the round. Variation INSIDE a
 * tile is a lattice, because every tile carries the same one. Variation ACROSS tiles is sun and
 * shade, because the field is low-frequency and a patch spans many tiles. The cap in
 * ART_DIRECTION 6.2 is about the first; this constant is the second, and widening it does not bring
 * the grid back -- the tile-lag autocorrelation stays negative at every setting swept, -0.157 at 9
 * and -0.160 at 34.
 *
 * READ THAT PARAGRAPH AGAINST THE CODE, 2026-10-20, BECAUSE IT PUTS THIS CONSTANT ON THE WRONG
 * AXIS. `SHARED.rim` is one `field()` of CELLS x CELLS blocks built once and sampled by every tile
 * at the same phase, so it is not a field that "spans many tiles" at all -- it is the first kind of
 * variation, the kind that is inside a tile and identical in all of them. Its swing therefore buys
 * cross-tile shade only through the four core bands, which do differ per variant; what it buys
 * directly is a fixed pattern stamped every 32 pixels. Measured in the note on `EDGE_OCTAVES`. The
 * sweep's own choice is left standing -- the mid-range it was bought for is real and re-opening it
 * moves the protected boundary figures -- but the reasoning above does not support it.
 *
 * Swept 176/9 (26% middle, 44% peak), 170/22 (29/50), 164/34 (42/40), 158/46 (52/31), 152/58
 * (54/28) against the board's 42/24. 164/34 matches the board's mid-range exactly.
 *
 * 158/46 scored BETTER on concentration and is not used, because it looks worse: at that swing the
 * rim field moves enough between neighbours that the border ring itself prints a faint rectangular
 * mesh over the lawn. The column autocorrelation cannot see it -- it averages whole columns, and
 * this is a thin line on a tile edge -- so the number said -0.156 and the eye said grid. Look at the
 * render before trusting this file's own metrics.
 *
 * EDGE_LEVELS makes no difference here: 6, 9 and 12 all give the same 31 per cent peak, so the
 * remaining concentration is not quantisation and is somewhere else.
 */
const EDGE_L = 164;
const EDGE_SWING = 34;

/**
 * How far in, in pixels, a tile climbs from the shared rim to its own core.
 *
 * Eight is a quarter of the tile. It mattered a great deal when a core sat eighty luma under the
 * rim -- too short and the tile read as a dark square in a thin bright frame, too long and there
 * was no room for a core at all -- and it matters little now that every band is centred near the
 * rim, because the climb is a few luma whatever distance it is given. Left where it is: a quarter
 * of the tile is also what keeps the mottle's patches clear of the border, where `nearCorner` and
 * the rim pin are doing the seam work.
 */
const INSET = 8;

/*
 * THE ENVELOPE'S SHAPE, AND THE SENTENCE THIS FILE GOT RIGHT AND THEN ARGUED ITSELF OUT OF.
 *
 * Distance to the border, smoothed, is a rounded-rectangle vignette, and -- in the words this
 * comment has carried for two rounds -- "a field of tiles each with a soft dark lozenge in the
 * middle is a 32-pixel lattice however soft each lozenge is". That is exactly true, and the
 * conclusion drawn from it was wrong twice over: the file went looking for a better-shaped lozenge,
 * first by scaling the envelope and then by displacing its contour and dappling it, when what the
 * sentence says is that no shape of lozenge survives being repeated and the only safe depth is
 * none. The design review measured the lattice that followed. See `BANDS`.
 *
 * So the depth is gone -- every band is centred near the shared rim -- and the shaping stays,
 * because it is free and it still does one useful thing: a WRAPPING blob field DISPLACES the
 * contour rather than scaling the envelope, so the mottle's few luma of patches do not run parallel
 * to the tile edge. Scaling was tried and left the contour a rounded rectangle anyway, because
 * multiplying a rectangle by anything is still a rectangle.
 *
 * `BLOB_PUSH` is how far it may displace, as a share of `INSET`, and it is windowed to zero at both
 * ends of the ramp: it cannot reach the border, where it would break the seam argument above, and
 * it cannot eat into the solid core.
 *
 * MASS_LEVELS quantises the finished envelope rather than the fields behind it, which is what keeps
 * this from being an airbrush. Eight levels across grass-0's span is a 15-luma step -- crisp to the
 * eye, under the 24 the edge axis counts, and the contours wander with the blob field instead of
 * running parallel to the tile edge.
 */
const BLOB_PUSH = 1.4;
const MASS_LEVELS = 8;

/**
 * How big a step between two adjacent quantised levels inside a tile is allowed to be.
 *
 * The score counts a neighbouring pair as an edge at 24 luma, and edge density is the one axis the
 * world was already OVER the board on when this round started, so no step inside a tile may reach
 * it. Fifteen leaves margin for the warmth lean and the mass envelope to push a pair a little
 * further apart without tipping one over. Holding to it is why a fifty-four-luma shade band costs
 * nothing there: measured on our own lawn tile, edge density is 6.75% against the board's own open
 * lawn at 1.68%, so the ground has margin to spare on that axis and none to spend.
 */
const STEP_LUMA = 15;

/**
 * How many flat levels a band is cut into: as many as it takes to keep every step under STEP_LUMA.
 *
 * This is the one line that lets the ladder be wide and the tile stay crisp at the same time, and
 * it is why the four variants no longer share a level count. A fixed three levels ties a band's
 * RANGE to its step size: widen the band to reach deep shade and the steps inside it widen with it
 * until the tile crackles. Deriving the count from the range breaks that tie -- grass-0 spans 90
 * luma in seven levels of fifteen, grass-3 spans 34 in three of eleven, and neither registers as an
 * edge. Without this the overlapping ladder above would be unbuildable: at a fixed three levels a
 * 54-luma band is three flat greens 27 apart, which is camouflage.
 *
 * It also pays on the variety axis, which is the one we are furthest behind on. A band's own levels
 * crossed with the warmth field's seven, and then crossed again with the eight levels of the mass
 * envelope, give one tile a few hundred distinct greens where four flat stops gave it four -- and
 * none of them costs a hard step. That is where the variety has to come from now that no band is
 * wide enough to carry it on brightness alone.
 */
const levelsFor = (b: Band): number =>
  Math.max(3, Math.min(8, Math.round((b.hi - b.lo) / STEP_LUMA) + 1));

/**
 * The core band a path-edge tile's grass uses.
 *
 * There is one `path-n` image in the game and the map lays it wherever a track runs, so it cannot
 * know which grass variant the sun/shade field put beside it. That used to matter a great deal and
 * now matters hardly at all: the verge holds the same shared rim as every grass tile, so whatever
 * the map puts beside it meets it with no step whichever variant that is. Only the verge's INTERIOR
 * is a choice, and it is pitched a little under the open lawn, which reads as grass trodden down
 * beside the track -- which the board's path edges have.
 */
const PATH_BAND: Band = { lo: 148, hi: 172 };

const LAWN_OCTAVES: readonly Octave[] = [
  [3, 0.38],
  [6, 0.34],
  [11, 0.28],
];
/**
 * Centre-heavy: the mass of a tile sits on its middle levels and the ends of its band are patches.
 *
 * The exponent is the whole of that. At 1.0 the levels come out evenly and the lawn reads as
 * camouflage: a tile is then equal parts of three or four greens, which is a pattern rather than a
 * field with patches in it. At 2.0 two thirds of a tile sits on the middle of its band and the two
 * ends are occasional patches, so the tile has one green and some variation -- which is what the
 * board's lawn is, and what keeps a band's extremes from reading as a second surface.
 */
const LAWN_SHAPE = 2.0;
const centreHeavy =
  (p: number) =>
  (u: number): number => {
    const d = u * 2 - 1;
    return 0.5 + 0.5 * Math.sign(d) * Math.pow(Math.abs(d), p);
  };
const lawnCurve = centreHeavy(LAWN_SHAPE);

/*
 * THE WARMTH AXIS.
 *
 * Within a band the grass still wanders in hue: sunlit grass is yellower, grass in the lee of a
 * canopy is bluer. A second, INDEPENDENT field leans each pixel toward one of two poles. Sun is the
 * sand ramp taken at a lightness that tracks the pixel's own, so the lean adds yellow without
 * bleaching; shade is the one dusk ramp docs/ASSETS.md allows, which extends grass downward rather
 * than introducing a hue.
 *
 * THIS FIELD IS QUANTISED TOO, and that is the de-airbrushing fix. Left continuous it made every
 * 2x2 block a slightly different colour from its neighbour, which is a gradient whatever the tone
 * field does. Quantised, a tile carries flat colours in patches with real boundaries, which is what
 * a person drawing a tile would do.
 *
 * The mixes are gentle -- 0.18 and 0.28 against the 0.38 and 0.34 they once were. The ladder
 * carries the hue walk by itself, because the grass ramp is cool at the bottom and warm at the top,
 * so the lean only has to say "a little more of what this height already is". At the old strength
 * the top of grass-3 came out yellower than the board.
 *
 * SEVEN LEVELS HERE, AND THE ASYMMETRY WITH THE TONE FIELD IS THE POINT. Quantising is there to
 * give a patch a BOUNDARY instead of a gradient, and a boundary is a thing the eye finds by
 * brightness. `lean` pins three quarters of the brightness back, so a step on this field is a step
 * in hue at near-constant value -- it has no boundary to find, cannot read as a gradient, and
 * cannot register on the edge axis. Levels here are therefore nearly free, which makes this the
 * cheapest move available on the colour-variety axis: raising it from five to seven, and handing
 * the same field to the marks via `groundLean`, took a play camera from 1.12 to about 1.5 per
 * thousand pixels with no other change.
 */
const WARM_LEVELS = 7;
const WARM_OCTAVES: readonly Octave[] = [
  [3, 0.45],
  [6, 0.4],
  [11, 0.15],
];
const warmCurve = centreHeavy(1.15);
const SUN_MIX = 0.18;
const SHADE_MIX = 0.28;

/*
 * THE FIELDS EVERY GRASS TILE SHARES, built once.
 *
 * All four fields a grass tile uses are common to all four variants and to the verge of every path
 * tile: the rim tone, the mass envelope, and the warmth. Only the core field -- the one whose
 * influence the envelope takes to zero at the border -- is drawn per variant.
 *
 * Sharing them is not an optimisation, it is the seam proof. Two neighbouring tiles evaluate the
 * same rim field at the same phase (every field here wraps over exactly one tile), the same mass,
 * and the same warmth; the only term that differs is the core, and the core is multiplied by a mass
 * that is zero at the border. So the two border pixels are the same colour, whatever pair of
 * variants the map happens to put side by side. The previous design could only make that step
 * small; this one makes it nothing, and it does so for every one of the sixteen variant pairings
 * rather than for the ones that were sampled.
 *
 * THE MASS USED TO BE THE ONE THING THAT WAS NOT SHARED, and the exception is what the design
 * review found. grass-0 took a second, finer envelope with its lower half cut away, to dapple a
 * tile that was then 90 luma below the lawn in its middle. The envelope's shape was not the fault
 * -- its DEPTH was, and no shape of envelope hides a core that far from the rim. See `BANDS`. One
 * envelope now serves every variant, so the mass term is identical on both sides of every
 * boundary as well as zero there.
 *
 * The blob is coarse -- three, five and nine cells -- because the mass is barely visible when a
 * core sits within a few luma of the rim, and a broad shape is what keeps it from reading as
 * texture. ART_DIRECTION section 6.2 asks for blobs 12 to 30 px across; three cells is 10.7, which
 * is the closest of the octaves and still short. Flagged rather than fixed: widening it is a change
 * to all four variants and the review scoped this one to grass-0.
 */
/*
 * THE RIM'S DOMINANT OCTAVE HAS FOUR CELLS, AND FOUR DIVIDES SIXTEEN. FLAGGED AND MEASURED
 * 2026-10-20; FIXED THE SAME DAY, AND NOT BY CHANGING THE OCTAVE. See `levelBorder`, which
 * subtracts the measured border bias every load. Everything below stands as written -- it is the
 * diagnosis the fix is built on, and the swept alternatives in it are still the ones NOT taken.
 *
 * `wrapNoise`'s own note, forty lines up, says it plainly: "a lattice of 5 or 9 cells gives a
 * pattern with no axis that lines up with the tile grid, where 4 or 8 quietly reintroduce the thing
 * this file exists to remove". `EDGE_OCTAVES` carries 4 cells at weight 0.5 -- half the rim field --
 * and CELLS is 16, so the lattice line at index 0 falls exactly on the tile's border in both axes
 * and the whole border ring reads one random lattice value rather than an average of many.
 *
 * It is not a theoretical worry; it has a sign and a size. Rebuilding the field exactly as `SHARED`
 * does -- `field(6101, EDGE_OCTAVES)`, equalised, quantised to `EDGE_LEVELS` -- and splitting it
 * into its 60 border blocks and its 196 interior blocks:
 *
 *     as shipped, [4, 7, 13]     border 0.273   interior 0.569   whole 0.500
 *     with 5 for the 4           border 0.460   interior 0.512   whole 0.500
 *     with 3 for the 4           border 0.483   interior 0.505   whole 0.500
 *     BLOB_OCTAVES [3, 5, 9]     border 0.433   interior 0.520   whole 0.500
 *
 * `equalise` gets the WHOLE field to 0.500 exactly, which is what it is for; nothing asks the
 * border subset to be unbiased, and with a 4-cell octave it is not. At `EDGE_SWING` 34 a border
 * mean of 0.273 is 7.7 luma of darkening on the outer ring of every grass tile and every path
 * verge in the world, in the same direction, by accident of one seed. It is the largest single term
 * left in the ground's fold over the tile pitch, larger than the vignette `BANDS` has just taken
 * out, and `assertNoSeamBand` measures its effect rather than this number.
 *
 * WHY THE OCTAVE IS NOT THE FIX. Swapping the 4 for a 5 takes the ground's folded peak-to-peak from
 * x 22.0 / y 13.1 to x 12.1 / y 16.0 -- it halves the column axis and makes the row axis worse,
 * because the next seed's border bias is a different accident in a different axis -- and it moves
 * the 1024 grass-to-grass boundary pixels the design board protects: the share above 24 luma goes
 * 8.40% -> 11.62% and the maximum step 64.3 -> 69.3. Choosing a seed whose border happens to be
 * unbiased is luck, not a fix; the fix is a rim field whose border distribution matches its
 * interior BY CONSTRUCTION.
 *
 * RE-SWEPT 2026-10-20 WITH `levelBorder` IN PLACE, which is the measurement that settles it. Even
 * with the bias subtracted, swapping the octave only moves the lattice from one axis to the other:
 *
 *     [4, 7, 13] + levelBorder   col 14.6  row  8.9   above 24  9.08%   worst frame +7.2
 *     [5, 7, 13] + levelBorder   col 10.0  row 14.4   above 24 11.62%   worst frame +4.8
 *     [3, 7, 13] + levelBorder   col  9.3  row 13.7   above 24 10.25%   worst frame +4.1
 *     [5, 9, 13] + levelBorder   col 11.2  row  9.0   above 24  9.86%   worst frame -4.6
 *
 * `[5, 9, 13]` is the tempting one and is still not taken: it buys a point of column axis for a
 * point and a half of boundary share, it flips the frame deficit's SIGN (a bright frame is the same
 * fault), and it is the same gamble on a different seed that this note has twice declined. The
 * octaves stay where they are and the construction carries the fix.
 */
const EDGE_OCTAVES: readonly Octave[] = [
  [4, 0.5],
  [7, 0.32],
  [13, 0.18],
];
const BLOB_OCTAVES: readonly Octave[] = [
  [3, 0.5],
  [5, 0.32],
  [9, 0.18],
];
const EDGE_LEVELS = 6;

/**
 * An envelope that is zero on the tile's border and rises inward, its contour displaced by a
 * wrapping blob field.
 *
 * The blob DISPLACES the contour rather than scaling the envelope, so the contour is not a rounded
 * rectangle -- multiplying a rectangle by anything is still a rectangle. That matters much less
 * than it used to, now that no variant's core is far enough from the rim for the envelope's shape
 * to be legible at all, but it costs nothing and it is what keeps the mottle's patches from running
 * parallel to the tile edge.
 *
 * The displacement is windowed to zero at both ends of the ramp, so it can neither reach the border,
 * where it would break the seam argument, nor eat into the solid core.
 */
function massField(seed: number, octaves: readonly Octave[]): Float64Array {
  const blob = field(seed, octaves);
  equalise(blob, (u) => u);
  const mass = new Float64Array(CELLS * CELLS);
  for (let by = 0; by < CELLS; by++)
    for (let bx = 0; bx < CELLS; bx++) {
      // Measured from the block's centre pixel, so the outermost block of every edge sits at a
      // distance of half a pixel and its envelope rounds to zero.
      const px = bx * BLOCK + (BLOCK - 1) / 2;
      const py = by * BLOCK + (BLOCK - 1) / 2;
      const d = Math.min(px + 0.5, py + 0.5, TILE - 0.5 - px, TILE - 0.5 - py);
      const k = by * CELLS + bx;
      const r = clamp01(d / INSET);
      const window = 4 * r * (1 - r);
      mass[k] = smooth(clamp01(r + BLOB_PUSH * window * (blob[k]! - 0.5)));
    }
  quantise(mass, MASS_LEVELS);
  // Quantising can round a border block up off zero, which would put the variant's core back on the
  // boundary and undo the seam argument. The outermost ring is pinned afterwards.
  for (let i = 0; i < CELLS; i++) {
    mass[i] = 0;
    mass[(CELLS - 1) * CELLS + i] = 0;
    mass[i * CELLS] = 0;
    mass[i * CELLS + CELLS - 1] = 0;
  }
  return mass;
}

interface Shared {
  /** The rim tone's own variation, 0..1, quantised. */
  readonly rim: Float64Array;
  /** The envelope every variant takes: one broad shape, zero on the border. */
  readonly mass: Float64Array;
  /** The warmth axis, shared so a hue step cannot appear at a boundary either. */
  readonly warm: Float64Array;
}

/**
 * Take the seed's accidental bias off the rim field's BORDER, which is the fix the note above
 * `EDGE_OCTAVES` named and deferred: "a rim field whose border distribution matches its interior BY
 * CONSTRUCTION, and that is a round that owns the boundary figures and can re-ratchet them".
 *
 * THIS IS THAT ROUND, and the figures are re-ratcheted at the foot of this comment.
 *
 * `equalise` gets the WHOLE field to a mean of 0.500 exactly, which is what it is for. Nothing asked
 * the BORDER SUBSET to be unbiased, and it was not: 0.273 against the field's 0.500, every one of the
 * four sides low, which at `EDGE_SWING` is 7.7 luma of darkening on the outer ring of every grass
 * tile in the world, in the same direction, in the same phase. That is a dark two-pixel frame stamped
 * every 32 pixels -- the lattice this file exists to remove, arriving by a different route than the
 * vignette `BANDS` took out, and bigger than the vignette was.
 *
 * TWO BORDER SETS APPEAR IN THESE NUMBERS AND THEY ARE NOT THE SAME SET. Read carefully, because a
 * future round will otherwise take one figure for the other:
 *
 *     the outermost BLOCK ring, 60 blocks     mean 0.2733   7.7 luma under the field
 *     every block with `mass === 0`, 91       mean 0.3714   4.4 luma under the field
 *
 * The second is larger because quantising the envelope rounds some near-border blocks down to zero as
 * well. The note above `EDGE_OCTAVES` measured the FIRST, and the painted "frame deficit" in the
 * table below is the first too, because a two-pixel ring is the thing that prints as a frame. But
 * `levelBorder` corrects, and `assertRimBorderUnbiased` watches, the SECOND -- because `mass === 0`
 * is the exact condition under which the rim is the only term in `lawnLuma`, and correcting a set
 * defined by the geometry rather than by the envelope would leave the blocks the envelope happened to
 * round to zero still carrying the bias.
 *
 * WHY IT SHOWS AND THE INTERIOR'S OWN BIAS DOES NOT. `lawnLuma` is `edge + (core - edge) * mass`, and
 * `massField` pins `mass` to zero on exactly this ring. So these are the blocks where the rim is the
 * ONLY term -- the core cannot pull them anywhere, and whatever the field happens to say here is what
 * the player sees, undiluted, in every tile. Everywhere else the core is already pulling the pixel
 * somewhere, and the rim's bias is diluted by exactly the amount the envelope has risen. The
 * correction therefore applies to that set and nothing else, read off `mass === 0` rather than from a
 * second copy of the ring's geometry, so it cannot drift from the pin that creates it.
 *
 * A DRAFT SMEARED THE CORRECTION INWARD, weighting it by `1 - mass` for continuity, and it was worse
 * on three measures of four: it lifted interior pixels the core had already taken over, which bought
 * 1.0 luma on the column axis and cost 1.2 on the row axis, 3.7 points of mid-range share and 1.9 of
 * peak bucket. The envelope leaves no shallow band for the discontinuity to matter in -- it is pinned
 * at 0 on the ring and its next block already averages 0.64 -- so the sharp version is both tighter
 * to the argument and better in the frame.
 *
 * IT IS A CONSTRUCTION, NOT A SEED. The bias is measured from the field itself every time the module
 * loads and subtracted, so a reseed, a different `EDGE_OCTAVES`, or a change to `EDGE_LEVELS` cannot
 * bring it back -- which is the thing choosing a luckier octave could not promise. The note above
 * `EDGE_OCTAVES` swept 5 and 3 in place of the 4 and measured exactly that: each halves one axis and
 * makes the other worse, "because the next seed's border bias is a different accident in a different
 * axis". Both are still true and neither is used.
 *
 * THE SEAM ARGUMENT IS UNTOUCHED. The correction is a function of the shared field and the shared
 * mass, so every variant still evaluates the identical rim at the identical phase; the two pixels
 * either side of a boundary stay the same colour for all sixteen pairings. Measured on the painted
 * field with the marks off, all four variants' border rings read the same value to one decimal
 * before this change and the same value to one decimal after it.
 *
 * WHAT MOVED. Two populations, because they answer different questions -- the four painted tiles are
 * what the guards see, and the composed lawn is what the player sees. The lawn is the ground layer of
 * the desktop spawn frame, 240 tiles, laid from the committed map:
 *
 *     four painted tiles                                  before   after
 *     worst frame deficit, ring against its own interior   +10.4    +4.7
 *     folded peak-to-peak, column axis                      18.0    12.6
 *     folded peak-to-peak, row axis                         10.0    10.1
 *     grass-to-grass boundary, share above 24 luma         8.40%   9.38%
 *     grass-to-grass boundary, maximum step                 64.3    71.1
 *
 *     composed lawn, 240 tiles                            before   after
 *     folded peak-to-peak, column axis                      16.5    11.5
 *     folded peak-to-peak, row axis                         12.2    10.8
 *     mid-range share (luma 96-160)                        37.8%   29.6%
 *     peak bucket                                          49.3%   53.6%
 *
 * AND IT WAS LOOKED AT, because this file's own `EDGE_L` note says in as many words "look at the
 * render before trusting this file's own metrics". Composed and rendered at 1x, the quilt that was
 * plainly visible across the open grass in the before frame is substantially gone in the after one.
 *
 * THE BOUNDARY FIGURES AND THE MID-RANGE ARE A REAL COST, PAID DELIBERATELY, AND NEITHER IS WHAT IT
 * LOOKS LIKE. The boundary steps are not the field -- with the marks off, the step across every
 * boundary is zero, by the seam argument -- they are the chevron tufts `VARIANTS` plants ON the
 * border ring, `grass-1`'s at column 31. Lifting the grass behind a dark mark by eight luma lifts the
 * step across it by about seven, and nothing about the mark changed.
 *
 * The mid-range share is the sharper lesson: IT WAS BEING PROPPED UP BY THE LATTICE. The dark ring is
 * 240 of every tile's 1024 pixels, it sat at 153 against a band whose ceiling is 160, and the core
 * sits at 164 to 172 -- so a quarter of the lawn counted as mid-range precisely because it was too
 * dark, and the figure the 2026-10-19 sweep tuned `EDGE_L` and `EDGE_SWING` on was partly measuring
 * the grid. A number bought from the tile border is bought from the tile grid.
 *
 * WHAT IS LEFT, so the next round does not look for it here. With the bias gone, the residual frame
 * deficit is no longer an accident at all -- it is `BANDS` sitting above `EDGE_L`, measured on the
 * field alone as +5.6, +0.1, +7.2, +8.1 against band midpoints of 168, 158, 170 and 172 over a rim
 * at 164. `grass-1` is 58.9% of the world's grass and `grass-0` is 30.6%, so the lawn the player
 * actually walks on is at +0.1 and +5.6 and the two worst variants carry a tenth of it between them.
 *
 * THE REMAINING FRAME AND THE LOST MID-RANGE ARE THE SAME PROBLEM AND HAVE ONE FIX. The ring cannot
 * be both level with the core and inside a band whose ceiling is four luma under it; the way to have
 * both is to bring the CORES DOWN to the ring rather than the ring up to the cores, which is `BANDS`
 * and `EDGE_L` and moves the distribution the 2026-10-19 sweep bought. That is a round that owns
 * THOSE figures, it is the one that should re-take the mid-range, and it should take it from a term
 * that is not locked to the tile grid -- `lit` is seeded per variant and is the obvious candidate.
 * Not this round: two large changes to the lawn at once and neither can be judged.
 */
function levelBorder(rim: Float64Array, mass: Float64Array): void {
  // SOLVED, NOT SUBTRACTED, and TWO drafts went wrong here before this one. Both were caught by
  // `assertRimBorderUnbiased` rather than by reading the code, which is the whole case for the
  // guard being a guard and not a docstring.
  //
  //   1. Shifting by the raw deficit and clamping delivers LESS than the deficit, because the ring
  //      values already at the top of the ladder cannot move. Came up 0.0623 short.
  //   2. Solving the clamp but against the PRE-correction field mean still misses, because the
  //      correction is self-referential: `1 - mass` is non-zero over most of the tile, so lifting
  //      the ring lifts the field mean it is being measured against. Came up 0.0593 short.
  //
  // So the quantity bisected is the DIFFERENCE between the two means, each evaluated at the same
  // candidate shift. It is monotone in the shift because the border set takes the whole of it while
  // the field mean, which that set is only a part of, takes its share -- so the difference always
  // closes and one bisection settles it. The bracket is wide enough to cover a fully inverted field
  // in either direction, so it is not an assumption about this seed.
  const borderMean = (s: number): number => {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < rim.length; k++)
      if (mass[k] === 0) {
        sum += clamp01(rim[k]! + s);
        n++;
      }
    return sum / n;
  };
  const wholeMean = (s: number): number => {
    let sum = 0;
    for (let k = 0; k < rim.length; k++) sum += clamp01(rim[k]! + (mass[k] === 0 ? s : 0));
    return sum / rim.length;
  };
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 64; i++) {
    const s = (lo + hi) / 2;
    if (borderMean(s) < wholeMean(s)) lo = s;
    else hi = s;
  }
  const shift = (lo + hi) / 2;
  for (let k = 0; k < rim.length; k++) rim[k] = clamp01(rim[k]! + (mass[k] === 0 ? shift : 0));
}

const SHARED: Shared = (() => {
  const rim = field(6101, EDGE_OCTAVES);
  const warm = field(6577, WARM_OCTAVES);
  equalise(rim, (u) => u);
  equalise(warm, warmCurve);
  quantise(rim, EDGE_LEVELS);
  quantise(warm, WARM_LEVELS);
  const mass = massField(6373, BLOB_OCTAVES);
  levelBorder(rim, mass);
  return { rim, mass, warm };
})();

/** The tone a tile holds at its border, before the core pulls it anywhere. */
const rimLuma = (rim: number): number => EDGE_L + (rim - 0.5) * EDGE_SWING;

/**
 * Lean a ground colour toward sun or shade, given the luma it was asked for.
 *
 * Split out of `lawnColour` so the MARKS can use it as well as the field, which is the cheapest
 * colour on offer anywhere in this file. Every blade, pool and clover pixel used to be
 * `groundTone(l)` and nothing else -- a single one-dimensional curve, so the whole mark layer
 * contributed one colour per luma however many thousand pixels it covered. Running it through the
 * same warmth field the field uses spreads those same pixels across seven hues at the same
 * brightness: `lean` pins three quarters of the luma back, so it cannot move a mark onto or off the
 * deep-shade threshold and cannot create an edge. It is also true to the subject -- a tuft in the
 * lee of a canopy is cooler than the same tuft in full sun.
 */
function groundLean(base: RGBA, l: number, warm: number): RGBA {
  const u = clamp01((l - GRASS_L[0]!) / (GRASS_L[3]! - GRASS_L[0]!));
  return warm >= 0
    ? lean(base, tone('path', 0.3 + 0.55 * u), warm * SUN_MIX)
    : lean(base, tone('shadow', 0.45 + 0.5 * u), -warm * SHADE_MIX);
}

/**
 * The luma one ground pixel wants: the shared rim, pulled toward this variant's core by the mass.
 *
 * At `mass` 0 the variant drops out of the expression entirely, which is the whole seam argument.
 */
const lawnLuma = (band: Band, lit: number, rim: number, mass: number): number => {
  const core = band.lo + lit * (band.hi - band.lo);
  const edge = rimLuma(rim);
  return edge + (core - edge) * mass;
};

const lawnColour = (l: number, warm: number): RGBA => groundLean(groundTone(l), l, warm);

/*
 * THE SAND BAND, re-pitched against the board's own open track.
 *
 * A 32x36 patch of board that is nothing but path, decimated to our density, against the same area
 * of our `path` tile:
 *
 *     axis                     board sand   ours (before)
 *     mean luma                  193.0         214.7
 *     p25 / p50 / p75         178 /195 /216   211/214/223
 *     luma spread                 25.35          7.20
 *     edge density                 5.68          0.00
 *     texture                     18.02          7.06
 *
 * Two faults, and the second is the larger. The track was twenty-two luma too bright -- a previous
 * note in this file put the board's path at a median of 214, which was measured at the board's own
 * resolution across a crop that also held grass and a figure. And it was FLAT: an interquartile
 * range of twelve luma against the board's thirty-eight, with not one step in the whole tile large
 * enough to count as an edge. The board's track is a worn surface with broad patches of damp and
 * dry in it, several tones apart.
 *
 * So the band is both lowered and opened: 0.12 to 1.0 of the path ramp, luma 173 to 229. Quantised
 * to five levels, which puts about fourteen luma between neighbouring patches -- under the
 * twenty-four an edge needs, so the sand reads as broad crisp patches rather than as grit, and only
 * where the field skips a level does it register. Four levels was tried first and came back at
 * 13.59% edge density against the board sand's 5.68: twenty-luma steps skip too readily, and a
 * track that crackles is as wrong as one that is blank.
 *
 * THE CURVE IS A TABLE RATHER THAN AN EXPONENT, and it is worth saying why because a power was
 * tried first. The board's sand quartiles are 178 / 195 / 216, which on the path ramp are positions
 * 0.173 / 0.365 / 0.753 -- and no single exponent passes through all three: they want p = 2.03,
 * 1.85 and 1.15 respectively. The track's brightness is not a power law, it is steep at the dark
 * end and flat at the light end, because dry sand saturates. Fitting a power to it cost the upper
 * quartile twelve luma, which is most of why the whole frame's p75 came back sixteen short of the
 * board's. Four control points, taken straight off the board's own quartiles, cost nothing and are
 * checkable by anyone who re-probes the crop.
 *
 * Its octaves are finer than the lawn's -- 5, 9 and 15 cells. There is exactly one `path` image in
 * the game and the map lays it in blocks, so any shape big enough to recognise prints every 32
 * pixels and a run of path tiles becomes corduroy.
 */
const SAND_LO = 0.12;
const SAND_HI = 1.0;
const SAND_LEVELS = 5;
const SAND_OCTAVES: readonly Octave[] = [
  [5, 0.4],
  [9, 0.36],
  [15, 0.24],
];
/** The board's own sand quartiles, as positions in the band: 178 / 195 / 216 luma. */
const SAND_SHAPE: readonly number[] = [0, 0.06, 0.278, 0.719, 1];
const sandCurve = (u: number): number => {
  const x = clamp01(u) * (SAND_SHAPE.length - 1);
  const i = Math.min(Math.floor(x), SAND_SHAPE.length - 2);
  return SAND_SHAPE[i]! + (SAND_SHAPE[i + 1]! - SAND_SHAPE[i]!) * (x - i);
};
const DUST_MIX = 0.26;
const DAMP_MIX = 0.26;

function sandColour(lit: number, warm: number): RGBA {
  const t = SAND_LO + lit * (SAND_HI - SAND_LO);
  const base = tone('path', t);
  return warm >= 0
    ? lean(base, tone('wood', 0.5 + 0.4 * t), warm * DAMP_MIX)
    : lean(base, tone('stone', 0.55 + 0.4 * t), -warm * DUST_MIX);
}

/*
 * THE BLADES, and the sample they are pitched against was rebuilt this round because the old one
 * was wrong.
 *
 * What stood here was a 32x28 patch described as "the board's OPEN LAWN -- no tree, no bush, no
 * path", reporting 4.80% of it under luma 81 and 2.12% under 60. A lawn cannot be 2% near-black,
 * and that figure is most of why the marks ended up pinned to an absolute floor of 36: the sample
 * had vegetation in it, and every later decision inherited the error.
 *
 * The sample is now found by search rather than by eye -- the largest square anywhere on the
 * Explore frame containing no pixel that is dark, grey or warm, which comes out at 63x63 board
 * pixels at (1156,700) -- and decimated to our own density the way board-profile.json does it:
 *
 *     axis                        board lawn   ours now
 *     p02 / p05 / p50 / p98    143/150/179/193   143/154/176/185
 *     darkest pixel                   127          127
 *     deep shade (% under 81)        0.00         0.00
 *     keyline    (% under 60)        0.00         0.00
 *     luma spread                   10.48         9.17
 *     edge density                   1.68         6.75
 *     texture (16px stdev)          13.66         8.95
 *
 * THE BOARD'S LAWN IS CALM. It is a flat bright field at 179 with mid-green tufts cut into it whose
 * deepest pixel is 127, and at our pixel density fewer than two neighbouring pairs in a hundred
 * differ by enough to count as an edge. Ours is still four times busier than that. Nothing in this
 * file should be made busier to chase the whole-frame edge-density target: that target is 18.91
 * because the board's CANOPIES, BUSHES AND OBJECTS are crisp and dark, and it has to be met there.
 * Adding marks to the lawn to meet it is the proxy beating the picture, which is how the specks got
 * here in the first place.
 *
 * THE HALO IS GONE FROM THE BLADES and stays gone. Every mark used to be drawn with a one-pixel
 * halo at the midpoint of the mark and the pixel under it, so that no step could exceed the
 * twenty-four the score counts as an edge. That was written against a board profile since rebuilt
 * and withdrawn, which had measured the board through its own interpolation blur and told every
 * painter to soften art that was already softer than the board. The board's blades have hard edges;
 * these do too.
 *
 * `paintMarks` keeps the halo as an option because the path lip still wants it -- a lip is a
 * gradient on the ground rather than a blade standing in front of it.
 *
 * DEPTHS ARE PROPORTIONAL to the ground the mark stands on, so a tuft on shaded ground is a darker
 * green than the shade around it by the same ratio that a lawn tuft is darker than the lawn. That
 * is not a compromise, it is true: contrast is made by light, and the light that would make more of
 * it is not reaching the forest floor.
 *
 * THE ABSOLUTE FLOOR IS GONE, AND THIS IS THE ROUND'S CLEAREST CASE OF THE RULER BEATING THE
 * PICTURE. The previous pass took `MARK_FLOOR` from 56 to 36 and won four axes with it, on the
 * perfectly sound arithmetic that edge density counts a neighbouring pair ONCE however far apart it
 * is, so extra depth is free there and pays everywhere else. The arithmetic was right and the
 * result was wrong: a mark whose root is pinned at luma 36 while the lawn around it sits at 178 is
 * a near-black speck, and a tile of them reads as flies or dirt on a lawn, not as grass.
 *
 * THE BOARD SETTLES IT, and it is not a close call. A 44x44 patch of the board that is nothing but
 * open lawn and its tufts:
 *
 *     mean 176.8   stdev 8.02   min 138   p02 152   p05 160   p50 178   max 197
 *     under luma 81: 0.00%      under luma 60: 0.00%
 *
 * The DARKEST pixel anywhere on the board's open lawn is luma 138, a mid-green #71a444. Not one
 * pixel in the sample falls under 81. Our grass-3 -- the full-sun tile, the one pitched at that
 * same lawn -- bottomed out at 33.
 *
 * So depth is now PROPORTIONAL to the ground the mark stands on rather than absolute. `MARK_FALL`
 * is the share of the local luma the deepest part of a mark may give up, and every root, tip and
 * pool is a fraction of that. On a lawn at 178 the roots land at 136..157 and the pools at 134,
 * against the board's floor of 138 and its p02 of 152. On the forest floor at luma 92 the same
 * marks land at 70..81 -- genuinely dark, because the light that would lift them is not reaching
 * there. That is the relationship the old fixed floor destroyed in both directions at once: it made
 * lawn tufts black and it made shade tufts, measured from a band mid that was already near the
 * floor, too shallow to see.
 *
 * It also costs the score, honestly and on purpose. Most of this world's deep-shade and keyline
 * numbers were those specks. They are reported in the summary rather than hidden.
 */
const MARK_FALL = 0.23;
/**
 * How far ABOVE the ground a light fleck sits, as a share of the local luma -- see `tuft`.
 *
 * Small, and it has to be: the grass ramp tops out at luma 184, so anything asked for above that
 * clamps onto one colour and the fleck stops contributing either brightness or variety. Six per
 * cent lifts a 176 lawn to 186, which is at the ceiling; the board reaches 193 and we cannot
 * without a fifth stop on the grass ramp, which is paint.ts and not this file.
 */
const MARK_LIFT = 0.06;
/** Root and tip, as shares of `MARK_FALL` -- so of the local ground's own luma. */
const ROOT_DEEP = 0.52;
const ROOT_SPAN = 0.45;
const TIP_DEEP = 0.2;
const TIP_SPAN = 0.28;
/**
 * How the blade lightens from root to tip: a blade is dark for most of its length and lifts only
 * near the point.
 *
 * It was linear, and linear is why the first version of the scatter came back at 1.04% deep shade
 * against the board lawn's 4.80. Half of a linearly graded stroke sits in the top half of its own
 * range, so a stroke whose root reached luma 68 still spent most of its pixels near 140 and the
 * dark end existed on one pixel in five. At 1.7 the stroke holds its root tone up most of its
 * height, which is both what a grass blade in shadow looks like and where the deep band comes from.
 */
const BLADE_LIFT = 1.7;

/** Clover leaves: shallower than a blade, with one lit pixel. */
const LEAF_DEEP = 0.3;
const LEAF_LIT = 0.1;

/**
 * Three pixels of every corner stays empty: four tiles meet there, and a mark that straddles one
 * prints as a repeated cross across the whole map.
 *
 * It was six. Six was right when a tile carried one distinctive sprig, because a lone silhouette
 * repeated at the tile pitch is the most findable thing a tilemap can show. At the density below
 * the marks are a texture rather than a shape, and a six-pixel bald ring round every corner is
 * itself a visible 32-pixel lattice -- the grid coming back as an absence instead of a presence.
 */
const CLEAR = 3;
const nearCorner = (x: number, y: number): boolean =>
  (x < CLEAR || x >= TILE - CLEAR) && (y < CLEAR || y >= TILE - CLEAR);

/* --------------------------------------------------------------- drawing -- */

/** Lay a finished pair of block fields down over the tile, 2x2 pixels to the block. */
function paintField(
  img: Img,
  lit: Float64Array,
  warm: Float64Array,
  colour: (lit: number, warm: number) => RGBA,
  inside: Inside,
): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (!inside(x, y)) continue;
      const k = ((y / BLOCK) | 0) * CELLS + ((x / BLOCK) | 0);
      img.px(x, y, colour(lit[k]!, warm[k]! * 2 - 1));
    }
}

/**
 * A mark buffer: the LUMA each pixel wants, or NONE.
 *
 * Marks are collected before any of them is drawn so a soft mark's halo can be computed once,
 * against the field, rather than one mark fringing against another mark's fringe.
 */
const NONE = -1;

function markAt(mark: Float64Array, x: number, y: number, l: number): void {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const k = y * TILE + x;
  // Darkest wins where two blades cross, so a sprig reads as one plant rather than as a lattice.
  if (mark[k] === NONE || l < mark[k]!) mark[k] = l;
}

const AROUND: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Draw a mark buffer, halo first when one is asked for.
 *
 * `soft` is the path lip and nothing else. A lip is a gradient ON the ground -- grass that the
 * track has worn down -- so a one-pixel halo at the midpoint of the mark and the pixel under it is
 * what it should be, and it keeps the step proportional to whatever the local contrast happens to
 * be rather than to a fixed chosen tone.
 *
 * A BLADE IS NOT THAT, and drawing one as though it were is what flattened this tile group. A blade
 * stands in front of the lawn; the board gives it a hard edge, and the rebuilt board profile says
 * the world as a whole is at 0.43 of the board's edge density. Marks are drawn hard unless the
 * caller says otherwise.
 *
 * Four-way rather than eight-way. Eight fattens every sprig into a blob, and the orthogonal
 * neighbours are the ones that decide whether a mark reads as drawn or as cut out.
 */
function paintMarks(
  img: Img,
  mark: Float64Array,
  inside: Inside,
  warm: Float64Array | null = null,
  soft = false,
): void {
  const colour = (l: number, x: number, y: number): RGBA => {
    const base = groundTone(l);
    if (!warm) return base;
    const k = ((y / BLOCK) | 0) * CELLS + ((x / BLOCK) | 0);
    return groundLean(base, l, warm[k]! * 2 - 1);
  };
  if (soft)
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const k = y * TILE + x;
        if (mark[k] !== NONE || !inside(x, y)) continue;
        let near = NONE;
        for (const [dx, dy] of AROUND) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= TILE || ny >= TILE) continue;
          const l = mark[ny * TILE + nx]!;
          if (l !== NONE && (near === NONE || l < near)) near = l;
        }
        if (near !== NONE) img.px(x, y, mix(img.get(x, y), colour(near, x, y), 0.5));
      }
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const k = y * TILE + x;
      if (mark[k] !== NONE && inside(x, y)) img.px(x, y, colour(mark[k]!, x, y));
    }
}

/*
 * THE CHEVRON TUFT: the one mark on this lawn that is a drawing rather than a texture.
 *
 * The design board's verdict was that "the grass has no tufts at all ... the board's tufts are
 * plainly visible as little chevrons", and it is right about the picture even though this file had
 * a `sprig` in every variant. Crop `240 650 100 80 9` -- open lawn east of the big trunk on the
 * Explore frame -- and the board's tuft is unmistakable: a fan of four or five short dark strokes
 * springing from one point, about seven of our pixels across and four tall, in a teal-green sixty
 * to seventy luma under the lawn around it. Everything else on that lawn is one- and two-pixel
 * flecks. One drawing, a lot of mottle.
 *
 * `sprig` drew the right SHAPE at the wrong DEPTH. Its tones came off `MARK_FALL`, which is a share
 * of the local ground, so on a lawn at 170 its root landed at 134 and its tip at 157 -- a 13-to-36
 * luma mark, which is inside the mottle's own range and therefore invisible as a plant. `MARK_FALL`
 * is right for the mottle and it is right for the reason the long note above gives; it is not a
 * depth at which anything can be drawn.
 *
 * So the chevron takes ABSOLUTE tones off the grass ramp, which is the one mark in this file that
 * does. The values are the board's own and they are the same three this project's decor tiles have
 * always cut their tufts in -- `tone('grass', 0.34 - i * 0.1)`, luma 118 at the point falling to 96
 * at the root. Against the four variants' bands, 154 to 192, that is a fall of 36 to 96: a plant
 * standing in front of the lawn rather than a patch of it.
 *
 * THE FLOOR ARGUMENT IS NOT RE-OPENED BY THIS. What the previous pass withdrew was a mark pinned at
 * luma 36 -- a near-black speck on a bright lawn, three hundred of them a tile. 96 is a mid-green,
 * forty-two levels above the board's own deepest open-lawn pixel of 127 only in the sense that a
 * tuft is vegetation and the sample that produced 127 was chosen to exclude vegetation. The board's
 * tuft in the crop above probes well under 127, and there are four of these marks in the whole
 * tileset against several hundred flecks.
 */
const TUFT_TOP = 0.34;
const TUFT_STEP = 0.1;
const tuftLuma = (i: number): number =>
  lumaOf(tone('grass', Math.max(0, TUFT_TOP - i * TUFT_STEP)));

/**
 * `[base offset, tip offset, height]` per blade. The centre is tallest and vertical, the two
 * flankers spring from beside it and splay to either side, which is the chevron.
 *
 * Three blades and not five. At five the fan welds into one dark mass inside seven pixels and the
 * tuft reads as a small mushroom, which is the failure the `tuft` note below records from the other
 * direction. Three strokes with a pixel of lawn between them read as blades.
 */
const CHEVRON: readonly (readonly [number, number, number])[] = [
  [0, 0, 4],
  [-1, -2, 3],
  [1, 2, 3],
];

/**
 * One chevron tuft, drawn with WRAPPING arithmetic so it may sit across a tile edge.
 *
 * The wrap is the anti-grid half of this mark and it is worth being exact about what it buys. Every
 * field in this file is periodic over one tile, so two tiles of the SAME variant laid side by side
 * draw the same chevron at the same phase: a tuft placed at y 1 puts its point on rows 30 and 31
 * and its root on rows 0 and 1, and the tile above it does likewise, so across that join the eye
 * sees one whole tuft straddling the boundary. `grass-1` is 58.9% of the grass and `grass-0` 30.6%,
 * so their joins are the common case and their tufts are the two that wrap.
 *
 * A tuft that sits wholly inside its tile is a silhouette repeated at the tile pitch, which is the
 * most findable thing a tilemap can show -- the reason this file cut its marks to mottle in the
 * first place. A tuft cut by the pitch is not: half of its instances read as a tuft on a join and
 * the rest as a tuft in a field, and there is no 32-pixel rhythm to find.
 *
 * WHICH AXIS EACH WRAP LANDS ON WAS CHOSEN FROM THE SWAPPED SHARES, AND IT SHOWS (2026-10-20,
 * flagged, not changed). `VARIANTS` wraps grass-0 over the TOP edge and grass-1 over the RIGHT, on
 * the belief that grass-0 was the commoner of the two. It is not: grass-1 is, by two to one, so the
 * wrap the map lays most often is the one on the vertical boundary, and 58.9% of all grass tiles
 * carry a dark chevron on columns 30, 31, 0 and 1. That is most of why the composed fold is worse on
 * the column axis than the row axis -- 16.9 against 10.1 after this round's band work -- and the
 * camera is a letterbox, so the column axis is the one to spend on. Swapping the two tuft positions
 * measures at x 14.8 / y 11.9: it buys 2.1 on the worse axis for 1.8 on the better one and balances
 * the two. Left for the round that owns the chevron, because this one was scoped to the vignette
 * depth and a tuft is a mark rather than a band.
 */
function chevron(mark: Float64Array, bx: number, by: number): void {
  for (const [bdx, tdx, h] of CHEVRON)
    for (let i = 0; i < h; i++) {
      // `i` counts DOWN from the point, which is where the tone ramp starts: a blade is lightest
      // where it catches the light and darkest at the root, which is what the board draws.
      const u = i / (h - 1);
      // Squared, so the blade is vertical for its lower half and gives way only near the point. A
      // blade that steps sideways on every row is a 45-degree dash, and a tile of dashes reads as
      // pen hatching -- this file has made that mistake once already, see `tuft`.
      const x = bx + bdx + Math.round(tdx * (1 - u) ** 2);
      markAt(mark, wrap(x, TILE), wrap(by - (h - 1) + i, TILE), tuftLuma(i));
    }
}

/**
 * grass-3's one small ground detail: three round leaves about 7 x 6, each with a single lit pixel
 * on its top-left per the one light from the top-left.
 *
 * A clover rather than a pebble. A pebble is the highest-contrast mark a ground tile could carry
 * and grass-3 is laid a few hundred times across the map, so a pebble prints a grid of dots; a
 * clover is vegetation, it shares the blades' green, and it disappears into the field the moment it
 * repeats.
 */
const CLOVER_LEAVES: readonly (readonly [number, number])[] = [
  [-3, -1],
  [0, -3],
  [2, 1],
];

function clover(mark: Float64Array, cx: number, cy: number, ground: Ground): void {
  const here = ground(cx, cy);
  const fall = here * MARK_FALL;
  const leaf = here - fall * LEAF_DEEP;
  const lit = here - fall * LEAF_LIT;
  for (const [ox, oy] of CLOVER_LEAVES)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        markAt(mark, cx + ox + dx, cy + oy + dy, dx === 0 && dy === 0 ? lit : leaf);
}

/*
 * THE BLADE SCATTER, and the shape of these marks was settled by looking rather than by measuring,
 * because the thing that is wrong with them is invisible to every axis the score has.
 *
 * The run of this round went: no marks at all (the inherited tile, 2.89% edge density against the
 * board lawn's 15.70, three identical quartiles, a dead flat green); then twenty distinct tufts a
 * tile, which matched the board's open lawn on every measured axis -- deep 4.2 against 4.80, spread
 * 34.0 against 33.59, texture 33.9 against 32.12 -- and rendered as WALLPAPER. Looked at on the
 * real map, the same sixteen plants were stamped at every 32 pixels in a plainly visible grid, the
 * exact fault the director named at the top of the review.
 *
 * THE CONFLICT IS REAL AND IT IS NOT RESOLVABLE INSIDE THIS FILE. There are four ground tiles --
 * `grass-0` to `grass-3` -- so whatever one of them carries is repeated across a whole patch. A
 * distinct object repeated at the tile pitch is found by the eye immediately; the measured axes
 * cannot see repetition at all, so they reward exactly the density that causes it. The score is
 * silent on the single most visible property of a tiled floor.
 *
 * THE REASON THIS PARAGRAPH USED TO GIVE WAS "TILE_NAMES is frozen at 53 names", AND THAT IS NO
 * LONGER TRUE IN EITHER HALF: the list holds 79 names and it is append-only rather than frozen. So
 * the constraint has genuinely weakened and the conclusion has to be re-argued rather than
 * re-worded. A fifth and sixth lawn variant COULD now be appended, because appending renumbers no
 * gid and leaves `map-forest.json` valid exactly as committed.
 *
 * What it would cost is the part that keeps the conclusion standing: the map chooses a lawn variant
 * from a value-noise field in `forest-map.ts`, so new variants are not free decoration -- they are a
 * change to that selection, a regenerated map, and a regenerated sheet, which moves tiles. Six
 * variants would halve the repeat rate of any one mark; they would not remove the pitch, because the
 * pitch is the tile and not the count. MOTTLE RATHER THAN OBJECTS, below, is what removes the pitch,
 * and it works at four variants. More variants are an improvement available to a round that can
 * afford to move the map, not the fix for this.
 *
 * So the marks are MOTTLE RATHER THAN OBJECTS: one or two blades, two or three pixels tall, close
 * together and shallow, with a contact pool on three in five and a light fleck beside two in five.
 * A two-pixel fleck has no silhouette to recognise, so twenty of them repeat as "the same grass"
 * where sixteen five-pixel plants repeat as "the same drawing".
 *
 * AND THE RE-PROBED BOARD SAYS THAT COSTS NOTHING. The figure this paragraph used to apologise to
 * -- the board's lawn at 15.70% edge density -- came from a crop with vegetation in it. Measured on
 * a crop that is genuinely nothing but lawn, the board sits at 1.68% and we sit at 6.75%: ours is
 * the busier of the two, by four times. There is no gap on this axis to make up, and the density
 * the next round should be careful of is more, not less.
 *
 * One mark per cell of a jittered lattice rather than N free positions: free positions clump, and a
 * bare 16x16 block scores zero on the texture axis however good the rest of the tile is.
 */
const SCATTER_COLS = 5;
const SCATTER_ROWS = 4;
/** How deep the contact pool under a tuft goes, as a share of `MARK_FALL`. */
const POOL_DEEP = 1.06;

/**
 * One tuft: two or three near-vertical blades sharing a root, over a dark contact pool.
 *
 * THE SHAPE MATTERS AS MUCH AS THE TONE, and the first version of this got the tone right and the
 * shape wrong in a way only looking could catch. It drew single strokes that stepped sideways twice
 * on the way up, so every mark came out as a 45-degree dash; a tile of them read as pen hatching
 * or tally marks, and because they all leaned the same way the lawn looked scratched rather than
 * grown. The board's blades are near-vertical and curl only at the point, and they come in little
 * fans of two or three rather than singly.
 *
 * The blades of one tuft share a root luma, which is what makes them read as one plant. The pool
 * underneath is the board's own device -- every tuft on it sits in a small dark contact shadow --
 * and it is where this tile group's keyline band comes from. Open ground takes no outline, but a
 * thing standing ON open ground does.
 */
function tuft(mark: Float64Array, rnd: () => number, bx: number, by: number, ground: Ground): void {
  const here = ground(bx, by);
  const fall = here * MARK_FALL;
  const root = here - fall * (ROOT_DEEP + rnd() * ROOT_SPAN);
  const blades = 1 + Math.floor(rnd() * 2);
  for (let b = 0; b < blades; b++) {
    const dx = b === 0 ? 0 : (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2));
    const base = by - (rnd() < 0.3 ? 1 : 0);
    const h = 2 + Math.floor(rnd() * 2);
    const curl = rnd() < 0.5 ? -1 : 1;
    const tip = here - fall * (TIP_DEEP + rnd() * TIP_SPAN);
    for (let k = 0; k < h; k++) {
      const u = h === 1 ? 0 : k / (h - 1);
      markAt(
        mark,
        bx + dx + (u > 0.75 ? curl : 0),
        base - k,
        root + (tip - root) * u ** BLADE_LIFT,
      );
    }
  }
  /*
   * The contact pool: the deepest pixel of the tuft, under its root.
   *
   * It used to be described here as a near-black pixel, and that was the trouble. It is now the
   * deepest point of a PROPORTIONAL fall, so on a lawn at 176 it lands at 133 -- the board's own
   * lawn bottoms out at 127 -- and on the shaded ground at 110 it lands at 83. A tuft sits in a
   * small darker patch of its own green, which is what the board does; it does not sit in ink.
   *
   * At three in five rather than on all of them, because a pool on every tuft reads as a dotted
   * grid at the tile pitch, and on none the tufts float.
   */
  if (rnd() < 0.6) {
    markAt(mark, bx, by + 1, here - fall * POOL_DEEP);
    if (rnd() < 0.45) markAt(mark, bx + (rnd() < 0.5 ? -1 : 1), by + 1, here - fall * POOL_DEEP);
  }
  /*
   * THE LIGHT FLECK, which the board has and this file did not.
   *
   * Probed on the board's largest unbroken patch of open lawn (63x63 at 1156,700, the biggest
   * square on the Explore frame with no tree, bush, path or figure in it), the lawn runs:
   *
   *     darkest 127   p02 143   p05 150   p50 179   p90 183   p98 193
   *
   * Note the TOP of that distribution as well as the bottom. Every tuft on the board carries a
   * lighter yellow-green catch beside it as well as a darker blade, and together they are what
   * makes the board's lawn read as lit rather than as a flat fill -- fourteen luma above the median
   * where the blade is fifty below it. Ours had only the dark half, so the lawn's own p98 sat nine
   * luma under the board's.
   *
   * `markAt` keeps the darkest where two marks meet, so a fleck can only land on ground no mark has
   * claimed. That is exactly right: it is a catch of light on open grass, not a highlight painted
   * onto a blade.
   */
  if (rnd() < 0.45) {
    const fx = bx + (rnd() < 0.5 ? -2 : 2);
    const fy = by - 2 - Math.floor(rnd() * 2);
    const lit = here * (1 + MARK_LIFT);
    markAt(mark, fx, fy, lit);
    if (rnd() < 0.5) markAt(mark, fx + 1, fy, lit);
  }
}

/**
 * One tuft per cell of a jittered 5x4 lattice.
 *
 * One per cell rather than twenty free positions. Free positions clump: with twenty draws on a
 * 32x32 tile several cells come out bare, and a bare 16x16 block scores zero on the texture axis
 * however good the rest of the tile is. The jitter is wide enough that no row or column of roots
 * survives.
 */
function scatter(mark: Float64Array, rnd: () => number, ground: Ground, inside: Inside): void {
  const cw = TILE / SCATTER_COLS;
  const ch = TILE / SCATTER_ROWS;
  for (let r = 0; r < SCATTER_ROWS; r++)
    for (let c = 0; c < SCATTER_COLS; c++) {
      // Clamped, because `c * cw + rnd() * cw` reaches TILE exactly when the last cell draws near
      // 1 -- and `inside` is a lookup into a 32x32 table for a path tile, so an off-tile root threw
      // rather than being quietly ignored the way `markAt` would have.
      const bx = Math.min(TILE - 1, Math.round(c * cw + rnd() * cw));
      const by = Math.min(TILE - 1, Math.round(r * ch + rnd() * ch));
      if (nearCorner(bx, by) || !inside(bx, by)) continue;
      tuft(mark, rnd, bx, by, ground);
    }
  // A tuft is drawn without reference to the mask, so anything that strayed onto sand is cleared
  // here rather than inside the shape, where the test would have to be repeated nine times.
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) if (!inside(x, y)) mark[y * TILE + x] = NONE;
}

/* ----------------------------------------------------------------- grass -- */

/**
 * The four variants.
 *
 * They differ in their CORE BAND -- which is the map's sun and shade -- and in where their marks
 * sit. They do NOT differ at the border, and they no longer differ in their envelope either: the
 * rim tone, the warmth field and the mass envelope are shared by all four, so the only brightness
 * difference between two variants is the one `BANDS` states, it is carried entirely inside the tile,
 * and -- since every band is now centred near the shared rim -- it is a few luma rather than eighty.
 *
 * EVERY VARIANT NOW CARRIES THE FULL SCATTER plus one larger sprig for character, where the
 * previous pass carried 0.75 sprigs a tile and nothing else. The reasoning for that cut is in
 * `scatter` above and it is worth not losing: a distinctive silhouette repeated at the tile pitch
 * is the most findable thing a tilemap can show. The cut was the wrong remedy, though, because it
 * left the tile with no texture at all -- three identical quartiles, 2.89% edge density against the
 * board lawn's 15.70 -- and a lawn with no texture is a lawn with nothing to repeat, which is a
 * different way of being obviously generated.
 */
interface Variant {
  /**
   * Where this variant's one chevron tuft has its root.
   *
   * A different place in each of the four, and the first two sit ON an edge so they wrap -- see
   * `chevron`. Every one of them is clear of `nearCorner`'s three-pixel exclusion, which needs a
   * mark to be near an edge in BOTH axes at once to bite: a tuft at x 12 can sit on row 1, and one
   * on column 31 can sit at y 20.
   */
  readonly tuft: readonly [number, number];
  readonly clover: readonly [number, number] | null;
}

const VARIANTS: readonly Variant[] = [
  // Over the top edge. `grass-0` is 30.6% of the grass.
  { tuft: [12, 1], clover: null },
  // Over the right edge -- and `grass-1` is 58.9%, so this, not the one above, is the join the
  // player sees most. See the last paragraph of `chevron` for what that costs on the column axis.
  { tuft: [31, 20], clover: null },
  { tuft: [8, 25], clover: null },
  { tuft: [22, 13], clover: [12, 10] },
];

/**
 * Rim, core, mass, warmth -- the one expression at the top of this file -- and the luma field it
 * came out as. Shared by the grass tiles and by the grass band of an edge tile.
 *
 * The core field is built and equalised over the WHOLE tile even when `inside` masks most of it
 * away. That is deliberate: a full grass tile and the grass band of a path-edge tile then draw from
 * the same distribution, where equalising only the masked part would give the band its own
 * histogram and put a brightness step exactly along the path.
 *
 * The luma is handed back because the MARKS now measure themselves against the ground they stand
 * on rather than against an absolute floor -- see `MARK_FALL`. That is also what makes the marks
 * seam-free for free: they track a field that is identical on both sides of every boundary.
 */
function lawn(img: Img, seed: number, band: Band, inside: Inside): Float64Array {
  const lit = field(seed, LAWN_OCTAVES);
  equalise(lit, lawnCurve);
  quantise(lit, levelsFor(band));
  const lum = new Float64Array(CELLS * CELLS);
  for (let k = 0; k < lum.length; k++)
    lum[k] = lawnLuma(band, lit[k]!, SHARED.rim[k]!, SHARED.mass[k]!);
  paintField(img, lum, SHARED.warm, lawnColour, inside);
  return lum;
}

/** Read the luma field back at pixel resolution, for the marks. */
const groundAt =
  (lum: Float64Array): Ground =>
  (x, y) =>
    lum[
      Math.min(CELLS - 1, Math.max(0, (y / BLOCK) | 0)) * CELLS +
        Math.min(CELLS - 1, Math.max(0, (x / BLOCK) | 0))
    ]!;

const grass =
  (n: number): Painter =>
  (img) => {
    const v = VARIANTS[n]!;
    const band = BANDS[n]!;
    const seed = 4100 + n * 977;
    const lum = lawn(img, seed, band, ALL);
    const ground = groundAt(lum);
    const rnd = noise(seed + 31);
    const mark = new Float64Array(TILE * TILE).fill(NONE);
    scatter(mark, rnd, ground, ALL);
    if (v.clover) clover(mark, v.clover[0], v.clover[1], ground);
    // Last, so `markAt`'s darkest-wins cannot let a fleck or a pool eat a blade: the chevron is the
    // deepest mark on the tile and it is the one the player is meant to see.
    chevron(mark, v.tuft[0], v.tuft[1]);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) if (nearCorner(x, y)) mark[y * TILE + x] = NONE;
    paintMarks(img, mark, ALL, SHARED.warm);
  };

/* ------------------------------------------------------------------ sand -- */

/**
 * Packed sand, and nothing else on it.
 *
 * The previous painter scattered thirteen grit pixels and three pressed stones into every path
 * tile. Measured, the board's open path carries neither: its pure-sand crop comes back at 0.00%
 * edge density and a luma spread of 18.3, where ours came back at 6.06% and 31.6. Thirteen isolated
 * pixels a tile is twenty-six hard steps a tile for a texture that averages out to nothing at the
 * camera the game plays at, and there is one `path` image, so whatever scatter it carries prints
 * every TILE. The sand's life now comes from the tone and warmth fields.
 */
function sand(img: Img, seed: number, inside: Inside): void {
  const lit = field(seed, SAND_OCTAVES);
  const warm = field(seed + 577, WARM_OCTAVES);
  equalise(lit, sandCurve);
  equalise(warm, warmCurve);
  quantise(lit, SAND_LEVELS);
  quantise(warm, WARM_LEVELS);
  paintField(img, lit, warm, sandColour, inside);
}

/* ------------------------------------------------------------ path edges -- */

/**
 * A value in 0..1 along a ring of length TILE: `f(TILE)` is exactly `f(0)`, and the walk between
 * them is smooth.
 *
 * This is the whole seam-free-edges trick. Every tile that carries a north band asks this same
 * function for its tear depth at column x, so `path-n` ends its top edge at the depth `path-ne`
 * starts its top edge at, and a run of edge tiles reads as one wandering boundary rather than a row
 * of squares each with its own idea of where the grass stops.
 */
function ringProfile(seed: number, cells: number): (t: number) => number {
  const rnd = noise(seed);
  const v = Array.from({ length: cells }, () => rnd());
  return (t) => {
    const u = wrap(t, TILE) * (cells / TILE);
    const i = Math.floor(u);
    const e = smooth(u - i);
    return v[i % cells]! * (1 - e) + v[(i + 1) % cells]! * e;
  };
}

/**
 * How far through the grass-to-sand transition a pixel is, per PIXEL_STANDARD section 5: lawn, a
 * darker grass lip, a damp dirt shoulder, open path, and never a straight line.
 *
 * The ranks run in one direction, grass to sand, which is what lets a corner tile take the MINIMUM
 * across its two sides and get a correct merge for free: grass beats sand, and the two ragged
 * boundaries fuse into one L.
 */
type Zone = 0 | 1 | 2 | 3;

const SIDES: readonly Side[] = ['n', 's', 'e', 'w'];

/**
 * One depth profile and one lip-width profile per side, built once and shared by every tile that
 * carries that side.
 *
 * There is exactly one `path-n` image in the whole game, so whatever this profile does, it does
 * every 32 pixels along every path edge on the map. A slow nine-cell wander of about two pixels
 * carries the shape and a sixteen-cell tear of up to two pixels on top makes the teeth -- measured
 * on the board, the boundary wanders three or four pixels over seventy and tears one to three
 * pixels locally.
 *
 * The tear rides a SIXTEEN-cell ring rather than one cell per column, which is what makes a tooth
 * two pixels wide. A per-column tear was tried first and it came out as one-pixel salt and pepper;
 * the board's teeth are chunky two-to-four pixel tabs of grass overhanging the sand, and chunkiness
 * is the whole difference between a torn edge and a noisy one.
 */
const EDGE = (() => {
  const depth = {} as Record<Side, (t: number) => number>;
  const lip = {} as Record<Side, (t: number) => number>;
  SIDES.forEach((s, i) => {
    const slow = ringProfile(900 + i * 37, 9);
    const fine = ringProfile(960 + i * 37, 16);
    const tear = ringProfile(1020 + i * 37, 16);
    const lipRing = ringProfile(1080 + i * 37, 16);
    depth[s] = (t) => {
      const v = tear(t);
      const base = 7.0 + slow(t) * 2.2 + (fine(t) - 0.5) * 2.0;
      return Math.round(base) + (v < 0.1 ? -2 : v < 0.42 ? -1 : v > 0.9 ? 2 : v > 0.58 ? 1 : 0);
    };
    // Width 0 is the important one, and it has to be COMMON. A lip that is merely thin somewhere
    // is still a band running round the path, which is a key line however dark it is, and
    // PIXEL_STANDARD section 5 asks for a torn boundary instead. At one stretch in seven the lip
    // still read as an unbroken outline at 5x; at three in ten it reads as what the board actually
    // has, clumps of darker grass overhanging the sand with clean gaps between them where the lawn
    // runs straight down onto the track.
    lip[s] = (t) => {
      const v = lipRing(t);
      return v < 0.3 ? 0 : v < 0.44 ? 1 : v < 0.62 ? 2 : v < 0.82 ? 3 : 4;
    };
  });
  return { depth, lip };
})();

/**
 * The shoulder: two pixels of slightly deeper tan on the sand side of the boundary.
 *
 * What was here before was two pixels of LIGHTENED sand, and that was wrong in direction as well as
 * degree -- the track was being haloed in near-white along its whole length, so the one thing
 * standing between bright lawn and bright sand was brighter than either. The brief called it "a
 * hard 1px step straight from tan to green"; it was worse than that, it was a step the boundary was
 * actively widening.
 *
 * FOUR PIXELS OF BROWN WAS ALSO WRONG, and it took looking at the board at our own pixel density to
 * see it. The first version of this fix graded four pixels of damp earth from luma 131 up to the
 * open track, reasoning that no step should exceed the twenty-four the score counts as an edge.
 * Rendered, it was a dark brown band running round every path on the map, and the board has nothing
 * like it: its track edge is a torn boundary with ONE OR TWO pixels of marginally deeper tan on the
 * sand side, and the step from grass to sand is left hard. That hard step is not a defect to be
 * softened -- it is a large part of why the board measures 20.88% edge density where we measure 9.
 *
 * So: two pixels, gently. The earth is `keyline('path')` -- the sand ramp's own darkest taken down
 * with the hue preserved -- mixed into the sand pixel already there, so the shoulder keeps the
 * track's own mottling instead of flattening it into a painted stripe.
 */
const SHOULDER = 2;
const SHOULDER_MIX: readonly number[] = [0.3, 0.13];
const SHOULDER_EARTH = keyline('path', 56);

/**
 * Where a pixel sits, and how deep into the lip or the shoulder it is.
 *
 * `lipT` runs 0 at the lawn side of the lip to 1 at the sand side, and the lip is painted as a
 * gradient across it rather than as a band of one colour. That is the difference between a darker
 * lip and a key line drawn round the path: no single step on the grass side is large enough to cut,
 * and the board has no hard dark line round its paths anywhere.
 *
 * `out` is the same thing for the shoulder: 0 next to the grass, SHOULDER-1 next to the open track.
 */
interface Place {
  readonly zone: Zone;
  readonly lipT: number;
  readonly out: number;
}

function placeOf(sides: readonly Side[], x: number, y: number): Place {
  let zone: Zone = 3;
  let lipT = 0;
  let out = 0;
  for (const s of sides) {
    const t = s === 'n' || s === 's' ? x : y;
    const j = s === 'n' ? y : s === 's' ? TILE - 1 - y : s === 'w' ? x : TILE - 1 - x;
    const g = EDGE.depth[s](t);
    const w = EDGE.lip[s](t);
    const here: Zone = j < g - w ? 0 : j < g ? 1 : j < g + SHOULDER ? 2 : 3;
    if (here < zone) {
      zone = here;
      if (here === 1) lipT = w <= 1 ? 0.5 : (j - (g - w)) / (w - 1);
      if (here === 2) out = j - g;
    }
  }
  return { zone, lipT, out };
}

/**
 * The lip's gradient, lawn side to sand side, with a little wander along its length.
 *
 * Stated as a DROP below the GROUND AT THAT PIXEL rather than below the tile's band, for the same
 * reason the marks are: it is the only form that stays right wherever the rim and mass fields put
 * the verge, and it cannot invent a step the ground beneath it does not have.
 */
const LIP_RUN = ringProfile(1200, 16);
const LIP_TOP = 8;
const LIP_BOTTOM = 22;
const lipTone = (here: number, x: number, y: number, lipT: number): number =>
  here - LIP_TOP - (LIP_BOTTOM - LIP_TOP) * lipT + (LIP_RUN(x + y) - 0.5) * 8;

/**
 * Grass on the named sides, sand in the middle. Read outward from the lawn: field, a one-pixel
 * softening, the graded grass lip, the torn boundary, two pixels of damp dirt shoulder, open track.
 *
 * The grass band is painted with the same fields the four grass variants use, at `PATH_BAND`, so an
 * edge tile sits within one step of 86% of the ground the map could put beside it.
 */
const pathTile =
  (sides: readonly Side[], seed: number): Painter =>
  (img) => {
    const place: Place[] = [];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) place.push(placeOf(sides, x, y));
    const zone = (x: number, y: number): Zone => place[y * TILE + x]!.zone;

    sand(img, seed, (x, y) => zone(x, y) >= 2);
    // The shoulder. Taken off the pixel already there rather than from a fixed tone, so it still
    // carries the track's own mottling instead of flattening it.
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const p = place[y * TILE + x]!;
        if (p.zone !== 2) continue;
        const k = SHOULDER_MIX[Math.min(p.out, SHOULDER - 1)]!;
        img.px(x, y, mix(img.get(x, y), SHOULDER_EARTH, k));
      }

    // The grass band reaches under the lip, so the lip is a shade ON grass rather than a stripe
    // between two materials. It uses the same shared rim, mass and warmth fields the four grass
    // variants use, so the verge of a path tile meets whatever grass the map puts beside it with
    // no step at all -- the seam argument covers this boundary too, not only grass to grass.
    const lum = lawn(img, seed + 911, PATH_BAND, (x, y) => zone(x, y) <= 1);
    const ground = groundAt(lum);

    // The lip is soft -- a gradient on the ground -- and goes down first, so the blades above can
    // stand on it.
    const lip = new Float64Array(TILE * TILE).fill(NONE);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const p = place[y * TILE + x]!;
        if (p.zone === 1) lip[y * TILE + x] = lipTone(ground(x, y), x, y, p.lipT);
      }
    paintMarks(img, lip, (x, y) => zone(x, y) <= 1, SHARED.warm, true);

    // The verge gets the same blades the open lawn does. Without them an edge tile's grass was the
    // one smooth green left on the map, and it ran along every track on it.
    const mark = new Float64Array(TILE * TILE).fill(NONE);
    scatter(mark, noise(seed + 31), ground, (x, y) => zone(x, y) === 0);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) if (nearCorner(x, y)) mark[y * TILE + x] = NONE;
    paintMarks(img, mark, (x, y) => zone(x, y) === 0, SHARED.warm);
  };

/* ----------------------------------------------------------------- stones -- */

/**
 * The one object the ground itself carries: a pebble pressed into the verge of a corner tile.
 *
 * It exists because `keyline()` is right exactly once on open ground. Ground takes no outline --
 * measured, the board's lawn holds nothing below luma 147 except its tufts -- but a thing SITTING
 * on the ground does, and a pebble with no contact shade floats. The shade is `keyline('path')`,
 * the sand's own darkest taken down with the hue kept, so it reads as damp sand under a stone
 * rather than as ink.
 *
 * Two per corner tile and no more: the board shows no stones at all on its open path, and there is
 * one image per corner, so anything commoner prints a recognisable scatter.
 */
function pebble(img: Img, rnd: () => number, count: number, inside: Inside): void {
  for (let i = 0; i < count; i++) {
    const w = 2 + Math.floor(rnd() * 2);
    const x = 2 + Math.floor(rnd() * (TILE - w - 4));
    const y = 2 + Math.floor(rnd() * (TILE - 6));
    let clear = !nearCorner(x, y);
    for (let j = 0; j < 3 && clear; j++)
      for (let k = -1; k <= w && clear; k++) if (!inside(x + k, y + j)) clear = false;
    if (!clear) continue;
    for (let k = 0; k < w; k++) {
      const bed = img.get(x + k, y);
      img.px(x + k, y, mix(bed, tone('stone', 0.78), 0.5));
      img.px(x + k, y + 1, mix(bed, tone('stone', 0.42), 0.6));
      img.px(x + k + 1, y + 2, mix(img.get(x + k + 1, y + 2), keyline('path', 26), 0.45));
    }
  }
}

const cornerTile =
  (sides: readonly Side[], seed: number): Painter =>
  (img) => {
    pathTile(sides, seed)(img);
    const rnd = noise(seed + 71);
    pebble(img, rnd, 2, (x, y) => placeOf(sides, x, y).zone === 3);
  };

/*
 * THE TILE SET CANNOT DRAW A CORRIDOR. MEASURED AND FLAGGED, NOT FIXED FROM THIS FILE (2026-10-20).
 *
 * There is no tile that carries grass on two OPPOSITE sides, and none that carries it on three. A
 * one-tile-wide run of track therefore has no tile that fits, and `forest-map.ts`'s `pathEdge` --
 * an if-chain that tests `n && e`, then `n && w`, then `s && e`, then `s && w`, then each side alone
 * -- resolves it to a single-sided tile and leaves the far side with no verge, no lip and no teeth:
 * sand running flush into lawn in a dead straight line down the tile boundary.
 *
 * Counted off the generated map, 2026-10-20: 25 of its 116 path-family tiles have at least one
 * grass side the tile they were given does not draw. By case --
 *
 *     14x  path-n  needs n and s, draws n       -> wants `path-ns`
 *      7x  path-e  needs e and w, draws e       -> wants `path-ew`
 *      1x  path-ne needs n, s and e             -> wants `path-nse`
 *      1x  path-se needs s, e and w             -> wants `path-sew`
 *      1x  path-n  needs n and e, draws n       -> `pathEdge` ran before its neighbour changed
 *      1x  path-s  needs s and e, draws s       -> likewise
 *
 * The worst of them is a run of six at (12..17, 12): 192 unbroken pixels of straight seam, in the
 * spawn frame, against a spec of no straight run over 4px. The other long ones are (12..13, 22) and
 * (35..37, 22).
 *
 * `pathTile()` ALREADY TAKES A SIDES ARRAY and `placeOf` already takes the minimum zone across
 * however many sides it is given, so the six missing tiles are six table entries here and no new
 * painter:
 *
 *     'path-ns': pathTile(['n', 's'], ...),   'path-nse': pathTile(['n', 's', 'e'], ...),
 *     'path-ew': pathTile(['e', 'w'], ...),   'path-nsw': pathTile(['n', 's', 'w'], ...),
 *                                             'path-new': pathTile(['n', 'e', 'w'], ...),
 *                                             'path-sew': pathTile(['s', 'e', 'w'], ...),
 *
 * WHAT STOPS THEM BEING WRITTEN HERE TODAY is that a painter is only half a tile. `tiles.ts` throws
 * at import for any painter not in `TILE_NAMES` -- verified, it reports "Painters not in
 * TILE_NAMES: path-ns" and takes the whole graybox suite down with it -- so the six names have to
 * be APPENDED to that list in the same change, and `test/art-guards.test.ts` pins the list's length
 * at 79. Neither file belongs to this task. They are gids 80 to 85, appending renumbers nothing,
 * and the map owner is the one who widens `pathEdge` to a four-bit neighbour mask and regenerates
 * the sheet against them -- so the six entries and the gids belong in that one commit, not split
 * across two owners.
 */
export const GROUND_TILES: Record<string, Painter> = {
  'grass-0': grass(0),
  'grass-1': grass(1),
  'grass-2': grass(2),
  'grass-3': grass(3),
  path: pathTile([], 2201),
  'path-n': pathTile(['n'], 2311),
  'path-s': pathTile(['s'], 2417),
  'path-e': pathTile(['e'], 2521),
  'path-w': pathTile(['w'], 2633),
  'path-ne': cornerTile(['n', 'e'], 2741),
  'path-nw': cornerTile(['n', 'w'], 2851),
  'path-se': cornerTile(['s', 'e'], 2963),
  'path-sw': cornerTile(['s', 'w'], 3079),
};

/* ----------------------------------------------------------------- guard -- */

/*
 * THE RIM FIELD'S BORDER MUST NOT BE BIASED, which is the property `levelBorder` constructs.
 *
 * WHY THIS IS NOT COVERED BY `assertNoSeamBand`, thirty lines down, and why a second guard earns its
 * place. That one compares the four stripes STRADDLING a join against the rest of a two-tile strip.
 * A biased border ring puts a dark stripe on BOTH sides of every join, so it lands in that guard's
 * `band` AND drags down its `rest` -- and the two tiles contribute their bright left edge and their
 * dark right edge to the same average. Measured on the shipped tiles with the bias at its full 7.7
 * luma, `assertNoSeamBand` read 11.7 against its limit of 14 and stayed green while the lawn printed
 * a grid. It is watching the right picture through an average that halves the thing it is looking
 * for. This guard watches the cause instead.
 *
 * IT IS MEASURED ON THE FIELD, NOT ON THE PAINTED TILE, and that is deliberate. By the time a tile is
 * painted, the residual frame deficit is dominated by `BANDS` sitting above `EDGE_L` -- a deliberate
 * placement, +0.1 to +8.1 depending on variant -- so a bound loose enough to pass the design would be
 * far too loose to catch the accident. The accident lives in one number and this checks that number.
 *
 * THE BOUND IS A FRACTION OF THE FIELD'S OWN 0..1 RANGE, not a luma figure, so it is not written in
 * terms of `EDGE_SWING`, `EDGE_L`, `BANDS` or `INSET` -- any of which could move without this bias
 * being either better or worse. The luma in the message is computed for the reader; it is not the
 * test. Two-sided, because a border ring biased BRIGHT prints the same grid with the sign flipped,
 * and `[5, 9, 13]` in the note above `EDGE_OCTAVES` is a real setting that does exactly that.
 *
 * Where it sits today: 0.0000, because `levelBorder` solves for the shift that lands it there. With
 * the `levelBorder` call commented out it reads -0.1286, which is 4.4 luma, and this guard is what
 * fired -- twice -- on the two drafts of `levelBorder` that did not reach zero. Note this is the
 * `mass === 0` set, 91 blocks; the outermost two-pixel ring alone is the more biased 0.2267 and 7.7
 * luma. See the table in `levelBorder` for why both figures are real and which is which.
 */
const BORDER_BIAS = 0.03;

function assertRimBorderUnbiased(): void {
  let border = 0;
  let count = 0;
  let whole = 0;
  for (let k = 0; k < SHARED.rim.length; k++) {
    whole += SHARED.rim[k]! / SHARED.rim.length;
    if (SHARED.mass[k] === 0) {
      border += SHARED.rim[k]!;
      count++;
    }
  }
  const bias = border / count - whole;
  if (Math.abs(bias) > BORDER_BIAS)
    throw new Error(
      `w-ground: the rim field's border ring is biased ${bias >= 0 ? '+' : ''}${bias.toFixed(4)} ` +
        `against its own field mean, over the ${BORDER_BIAS} it is allowed -- ` +
        `${Math.abs(rimLuma(whole + bias) - rimLuma(whole)).toFixed(1)} luma on the outer ring of ` +
        'every grass tile and every path verge in the world, in the same phase, which prints as a ' +
        `${bias >= 0 ? 'bright' : 'dark'} two-pixel frame every ${TILE} pixels. The border blocks ` +
        'are the ones `massField` pins to zero, where the rim is the only term in `lawnLuma` and ' +
        'the core cannot pull them anywhere. Check that `levelBorder` still runs inside `SHARED` ' +
        'and still reads its border set off `mass === 0`.',
    );
}

assertRimBorderUnbiased();

/*
 * A JOIN MUST NOT PRINT A BAND.
 *
 * This file already proves that two grass tiles meet with no STEP -- the border pixel is evaluated
 * at `mass` 0, where the variant drops out of the expression -- and it proved that for three rounds
 * while every tile quietly darkened its own outer ring by twelve to twenty-one luma. No step and a
 * dark band are not the same property: the step is about two pixels either side of one boundary,
 * and the band is about what a player sees when forty tiles are laid out in front of them, which is
 * a dark line every 32 pixels.
 *
 * So this guard measures the composed thing. It lays each ordered pair of grass variants as a
 * two-tile strip, reduces each tile to its column means and its row means, and asks how far the
 * four stripes straddling the join sit BELOW the rest of the strip. That is the quantity a person
 * looking at a lawn sees as a grid, it is defined on the pixels the game ships rather than on any
 * constant in this file, and it is symmetric: a join that printed a LIGHT band would be the same
 * fault with the sign flipped, so both orders of every pair are measured and a bright band shows up
 * as the dark band of the reversed pair.
 *
 * The bound is a plain luma figure and deliberately not derived from `BANDS`, `EDGE_L` or
 * `EDGE_SWING`. A bound written in terms of the thing it watches moves when that thing moves, which
 * is the one way a guard can be green while the fault is back.
 *
 * Where it sits today: worst pairing 6.8 luma on the column axis (grass-3 | grass-2) and 4.7 on
 * the row axis (grass-0 over grass-0). Before the bands were re-centred it was 17.3 and 13.1; with
 * the bands re-centred but the rim field's border still biased it was 11.7 and 9.0, and
 * `levelBorder` took it from there to here. The column axis is evaluated and reported first because
 * the camera is a letterbox and it is the worse of the two.
 *
 * AND THIS GUARD DID NOT CATCH THAT BIAS, which belongs next to its own number and not only in
 * `assertRimBorderUnbiased` where the argument is made. At 11.7 against a limit of 14 it was green,
 * on a lawn that was visibly a quilt. The reason is in the arithmetic above: a biased border ring
 * darkens BOTH tiles of every strip, so it lands in `band` and drags down `rest` at the same time,
 * and each tile contributes its bright left edge and its dark right edge to the same average. This
 * is still the right guard for the thing it names -- a join that prints a band -- but a frame
 * printed by every tile at the same phase is a different fault and now has a guard of its own.
 *
 * It does NOT cover the path verge. A path tile's column mean mixes sand and grass, so the same
 * arithmetic on `path-n` measures the track rather than the join; the verge is held instead by the
 * seam proof plus `PATH_BAND` sitting within a few luma of the rim.
 */
const JOIN_STRIPES = 2;
const JOIN_BAND_DROP = 14;

const GRASS_NAMES: readonly string[] = ['grass-0', 'grass-1', 'grass-2', 'grass-3'];

/** One painted tile reduced to the mean luma of each column and of each row. */
function stripeMeans(img: Img): { readonly cols: number[]; readonly rows: number[] } {
  const cols = new Array<number>(TILE).fill(0);
  const rows = new Array<number>(TILE).fill(0);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const l = lumaOf(img.get(x, y)) / TILE;
      cols[x]! += l;
      rows[y]! += l;
    }
  return { cols, rows };
}

/** How far the stripes straddling the join sit below the rest of an `a | b` strip. */
function joinDrop(a: readonly number[], b: readonly number[]): number {
  const strip = [...a, ...b];
  let band = 0;
  let rest = 0;
  for (let i = 0; i < strip.length; i++)
    if (i >= TILE - JOIN_STRIPES && i < TILE + JOIN_STRIPES) band += strip[i]! / (JOIN_STRIPES * 2);
    else rest += strip[i]! / (strip.length - JOIN_STRIPES * 2);
  return rest - band;
}

function assertNoSeamBand(): void {
  const stripes = GRASS_NAMES.map((name) => {
    const img = new Img(TILE, TILE);
    GROUND_TILES[name]!(img);
    return stripeMeans(img);
  });
  let worst = -Infinity;
  let where = '';
  for (const axis of ['cols', 'rows'] as const)
    for (let a = 0; a < stripes.length; a++)
      for (let b = 0; b < stripes.length; b++) {
        const drop = joinDrop(stripes[a]![axis], stripes[b]![axis]);
        if (drop <= worst) continue;
        worst = drop;
        where = `${axis === 'cols' ? 'column' : 'row'} axis, ${GRASS_NAMES[a]} ${axis === 'cols' ? '|' : 'over'} ${GRASS_NAMES[b]}`;
      }
  if (worst > JOIN_BAND_DROP)
    throw new Error(
      `w-ground: a grass join prints a ${worst.toFixed(1)} luma band (${where}), over the ` +
        `${JOIN_BAND_DROP} the lawn is allowed. Composed grass is drawing a line every ${TILE} ` +
        'pixels. Every grass tile is darkening its own outer ring -- check that each core band in ' +
        '`BANDS` is centred near `EDGE_L` and that the four offsets still differ in sign.',
    );
}

assertNoSeamBand();
