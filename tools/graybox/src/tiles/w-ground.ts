/*
 * Ground: grass and path at 32x32, redrawn against the approved concept board.
 *
 * This is the floor of the whole game -- forty of these are on screen at once -- so it is the group
 * that decides whether the world looks drawn or generated. Everything below was measured off
 * `reference/mocks/gameplay-concepts.png` with a quantising histogram rather than described, and the
 * numbers in the comments are the board's own, in Rec.709 luma.
 *
 * WHAT THE BOARD ACTUALLY DOES, and what the previous pass got wrong:
 *
 * 1. The lawn is a BRIGHT field, not a mid green. The board's lawn is `#98d050` at L187, with a
 *    tight spread of L185-189. The old painter filled at `grass[1]`, L129, which is 58 levels down,
 *    and that one number is why every bush, trunk and rock in the build had nothing to separate
 *    from. docs/ART_DIRECTION.md section 6.1 makes this binding: ground is painted FIELD-LED at
 *    level 3, which is the one documented exception to PIXEL_STANDARD section 2's "most of any
 *    object is level 1".
 *
 * 2. The lawn is MOTTLED, in broad chunky patches, not speckled. The board carries five values over
 *    the lawn -- L194 / L187 / L178 / L173 / L154 -- in soft blobs twelve to thirty pixels across.
 *    The old painter drew 74 single-pixel alpha blades per tile in three greens, which averages to
 *    one flat tone at any distance and reads as felt. Single-pixel speckle is banned outright by
 *    ART_DIRECTION section 6.2.
 *
 * 3. Tufts, not blades. The board scatters small sprigs of curved blades, FLAT in one dark green
 *    measured at L124-132, which is `grass[1]` to within five levels. They are a third of a tile
 *    each, about one per tile, and they are the only high-contrast mark on open grass.
 *
 * 4. The path edge is a TORN COLOUR BOUNDARY and never a line. Grass side: a broken, dappled lip of
 *    `grass[2]` with `grass[1]` crumbs in it, measured at L156-170. Sand side: a broken pale crumb
 *    margin. The old painter drew the lip in `shadow[3]` at L87, which against an L188 field is a
 *    hard key line drawn round the path -- the one thing ART_DIRECTION section 3.3 forbids on
 *    ground. Ground carries no keyline anywhere in this file.
 *
 * HOW THE MISSING COLOURS ARE MADE. The board's lawn spans L173-194 and the only ramp step we own
 * inside that band is `grass[3]` at L194 (ART_DIRECTION section 14, Ask 2, asks for a mid-light step
 * and it has not landed). Rather than block, every intermediate tone here is a ramp step composited
 * at alpha onto an already-opaque tile, which `Img.px` resolves to a hard opaque pixel and which
 * PIXEL_STANDARD section 4 explicitly permits ("drawing a semi-transparent colour onto an opaque
 * pixel is fine -- the result is opaque"). No raw hex appears anywhere. Every constant below carries
 * the luma it resolves to and the board value it is matching.
 *
 * SEAMS. Two different mechanisms, for two different jobs.
 *   - Mottle blobs WRAP at the tile edge (`wrapEllipse`), so the field carries its full share of ink
 *     right up to the border and a laid field prints no grid of bald margins.
 *   - Tufts, clover and stones are drawn FULLY INSIDE their square and kept six pixels clear of
 *     every corner. ART_DIRECTION section 6.3.1 asks for tufts to wrap too, and that is right only
 *     when a tile's neighbour is the same tile; here the map lays four different variants against
 *     each other, so a wrapped tuft would show as half a sprig against a neighbour that has no other
 *     half. A 60-luma mark cut by a frame edge is PIXEL_STANDARD section 5's named failure, so the
 *     low-contrast marks wrap and the high-contrast ones do not.
 *   - The eight path edges share one periodic depth profile per side (`ringProfile`), so `path-n`
 *     ends its north tear at exactly the depth `path-ne` starts its north tear at.
 */
import { Img, noise, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/** 32px per docs/PIXEL_STANDARD.md section 1. */
const TILE = 32;

type Painter = (img: Img) => void;
type Side = 'n' | 's' | 'e' | 'w';
/** Which pixels a mark is allowed to land on. Edge tiles use it to keep grass off the sand. */
type Inside = (x: number, y: number) => boolean;

const ALL: Inside = () => true;

const wrap = (t: number, n: number): number => ((t % n) + n) % n;
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Six pixels of every corner stays empty: four tiles meet there and a mark lands as a repeated
 *  cross across the whole map (ART_DIRECTION section 6.3.2). */
const CLEAR = 6;
const nearCorner = (x: number, y: number): boolean =>
  (x < CLEAR || x >= TILE - CLEAR) && (y < CLEAR || y >= TILE - CLEAR);

/* ------------------------------------------------------------- the tones -- */

/*
 * The lawn, matched value for value against the board. `grass[3]` alone is L194, seven levels above
 * the board's field, which leaves nothing lighter to mottle with; knocking it back by a thin wash of
 * `grass[2]` lands the field on L188 and frees `grass[3]` to be the light mottle.
 */
/**
 * The lawn's four tones, as washes over a bare `grass[3]` base. Index is the tone number below.
 * `null` is "leave the base showing", which is how the light mottle gets to be bare `grass[3]`.
 *
 *   0 field  L188, against the board's `#98d050` L187
 *   1 light  L194, against the board's `#a0d850` L194
 *   2 mid    L180, against the board's `#88c850` L178
 *   3 deep   L173, against the board's `#70c850` L173
 */
const FIELD = shade('grass', 3);
const LAWN: readonly (RGBA | null)[] = [
  shade('grass', 2, 40),
  null,
  shade('grass', 2, 95),
  shade('grass', 2, 145),
];
/**
 * The dappled grass lip at a path edge, measured on the board at L158-170 along the tear.
 *
 * Three values, not one, and the darkest is rare. A single flat value at 1-2 px closes into a
 * continuous dark line, which is a keyline round the path, and ART_DIRECTION section 3.3 says
 * ground carries none. The previous painter drew this band in `shadow[3]` at L87, sixty levels
 * below the lawn: that is the line the board does not have.
 */
const LIP_SOFT = shade('grass', 2, 180); // L167, against the board's `#90b850` L168
const LIP = shade('grass', 2); // L156, against the board's `#80b048` L158
/** The rare darkest crumb in that lip, and every tuft and clover leaf.
 *  L129, against the board's `#309840` L124. */
const TUFT = shade('grass', 1);
/** The one lit pixel on a clover leaf. L156. */
const LEAF_LIT = shade('grass', 2);

/**
 * Packed sand, the same four tones over a bare `path[2]` base. `path[2]` lands on L211 against the
 * board's `#f8d098` L212, so the field itself needs no adjustment at all.
 *
 *   0 field  L211, against the board's L212
 *   1 light  L215, sun-dried, against the board's L216-219
 *   2 dark   L205, compacted, against the board's `#f0c890` L204
 *   3 damp   L200, the deepest tone the open path carries
 *
 * These are deliberately the FAINTEST tones in this file. There is one `path` image and the map lays
 * it in blocks, so whatever shape the sand carries prints every 32 pixels: a first pass ran the
 * blotches at a twenty-luma spread and six path tiles in a row came out as corduroy, the same comma
 * repeating across the track. The board's own path is nearly flat -- a clean warm field with faint
 * specks -- so the fix is to drop the contrast until the repeat falls below the threshold at which
 * an eye can find it, not to make the blotches cleverer.
 */
const SAND = shade('path', 2);
const TRACK: readonly (RGBA | null)[] = [
  null,
  shade('path', 3, 60),
  shade('path', 1, 80),
  shade('path', 0, 55),
];
/** Grit. Twelve to ten levels off the field in each direction -- the board's specks are faint. */
const GRIT_DARK = shade('path', 0, 90);
const GRIT_LIGHT = shade('path', 3, 140);
/** The dry crumb margin just inside the tear. L221. */
const CRUMB = shade('path', 3, 140);
/**
 * A pressed stone: a lit cap, a body and a contact shade in the sand's own dark.
 *
 * All three are washed hard rather than painted opaque. `stone` is the cool grey the rocks use and a
 * solid block of it on a warm track reads as a dropped brick; letting the sand through pulls each
 * stone toward the ground it is bedded in. They are kept this faint because the board shows no
 * stones at all on its open path -- there are nine path tiles and whatever they carry repeats.
 */
const STONE_CAP = shade('stone', 2, 110);
const STONE_BODY = shade('stone', 1, 120);
const STONE_SHADE = shade('path', 0, 95);

/* --------------------------------------------------------------- drawing -- */

/*
 * MOTTLING, AND WHY IT IS A MAP AND NOT A SEQUENCE OF WASHES.
 *
 * The first pass drew each mottle tone straight onto the tile as a translucent blob. Two blobs of
 * the same tone that happened to overlap then composited twice, a third over them a third time, and
 * the lawn came out at a median of L167 against a planned field of L188 -- the tile went two steps
 * darker than the board by accident, which is the exact failure this whole redraw exists to undo.
 *
 * So the blobs are resolved into a TONE MAP first, one byte per pixel, and the tile is painted from
 * it once. Every pixel then carries exactly one of the four planned values and the measured
 * histogram is the planned histogram. `over` says which tones a stamp is allowed to claim, which is
 * what keeps the light and mid patches from eating one another and lets the deep patch sit as a
 * core inside a mid one, the way a shadow deepens toward its middle.
 */
const FIELD_TONE = 0;
const LIGHT_TONE = 1;
const MID_TONE = 2;
const DEEP_TONE = 3;

/**
 * One mottle patch per `count`: four to six overlapping lobes, so the silhouette is lumpy and steps
 * in two to four pixel jumps rather than describing a clean ellipse. `span` is roughly how far
 * across the finished patch lands; the board's run twelve to thirty pixels.
 *
 * Lobes WRAP at the tile edge -- the part that runs off the right comes back on the left -- so the
 * tile carries its full share of mottle right up to its border and a laid field prints no grid of
 * bald margins. Safe only because no lobe radius here reaches TILE/2.
 */
function stamp(
  map: Uint8Array,
  rnd: () => number,
  count: number,
  span: number,
  tone: number,
  over: readonly number[],
  inside: Inside,
): void {
  for (let b = 0; b < count; b++) {
    // A patch that may only claim one other tone is seated ON that tone, rather than dropped at
    // random and mostly missing it: the deep patch is the CORE of a mid one, the way a shadow
    // deepens toward its middle, and a blind centre landed outside the mid region two times in
    // three and painted nothing at all.
    const seats: number[] = [];
    if (!over.includes(FIELD_TONE))
      for (let k = 0; k < map.length; k++) if (over.includes(map[k]!)) seats.push(k);
    let cx = rnd() * TILE;
    let cy = rnd() * TILE;
    if (!over.includes(FIELD_TONE)) {
      if (seats.length === 0) continue;
      const seat = seats[Math.floor(rnd() * seats.length)]!;
      cx = (seat % TILE) + 0.5;
      cy = Math.floor(seat / TILE) + 0.5;
    }
    const lobes = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < lobes; i++) {
      const rx = 2 + rnd() * (span / 5);
      const ry = 2 + rnd() * (span / 5);
      const ox = cx + (rnd() - 0.5) * span * 0.55;
      const oy = cy + (rnd() - 0.5) * span * 0.55;
      for (let y = Math.floor(oy - ry); y <= Math.ceil(oy + ry); y++)
        for (let x = Math.floor(ox - rx); x <= Math.ceil(ox + rx); x++) {
          const dx = (x + 0.5 - ox) / rx;
          const dy = (y + 0.5 - oy) / ry;
          if (dx * dx + dy * dy > 1) continue;
          const px = wrap(x, TILE);
          const py = wrap(y, TILE);
          const k = py * TILE + px;
          if (over.includes(map[k]!) && inside(px, py)) map[k] = tone;
        }
    }
  }
}

/**
 * Snap the finished map to a 2x2 grid by majority.
 *
 * ART_DIRECTION section 6.2 asks for mottle that steps in two-to-four pixel jumps and is never
 * anti-aliased. A union of ellipses steps in ones, and laid as a field that reads as an airbrush
 * rather than as pixel art. Blocks land on even coordinates and TILE is even, so the quantisation
 * lines up across a tile boundary and the wrapped patches still continue into the neighbour.
 */
function chunk(map: Uint8Array): void {
  for (let by = 0; by < TILE; by += 2)
    for (let bx = 0; bx < TILE; bx += 2) {
      const tally = [0, 0, 0, 0];
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) tally[map[(by + y) * TILE + bx + x]!]!++;
      let win = 0;
      for (let t = 1; t < 4; t++) if (tally[t]! > tally[win]!) win = t;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) map[(by + y) * TILE + bx + x] = win;
    }
  despeckle(map);
}

/**
 * Drop any 2x2 block that disagrees with all four of its neighbours.
 *
 * Quantising a union of ellipses to a 2x2 grid leaves a rim of stray single blocks around every
 * patch, and a field of those reads as a pixelated gradient -- the look of a photo scaled down --
 * rather than as the board's chunky stepped patch edge. Neighbours are looked up WRAPPED, so this
 * cannot introduce a difference at the tile border that the stamping was careful to avoid.
 */
function despeckle(map: Uint8Array): void {
  const copy = map.slice();
  const block = (bx: number, by: number): number =>
    copy[wrap(by * 2, TILE) * TILE + wrap(bx * 2, TILE)]!;
  const blocks = TILE / 2;
  for (let by = 0; by < blocks; by++)
    for (let bx = 0; bx < blocks; bx++) {
      const me = block(bx, by);
      const around = [block(bx - 1, by), block(bx + 1, by), block(bx, by - 1), block(bx, by + 1)];
      if (around.some((v) => v === me)) continue;
      const tally = [0, 0, 0, 0];
      for (const v of around) tally[v]!++;
      let win = 0;
      for (let t = 1; t < 4; t++) if (tally[t]! > tally[win]!) win = t;
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) map[(by * 2 + y) * TILE + bx * 2 + x] = win;
    }
}

/** Lay the finished map down over a base that is already filled. */
function paintTones(
  img: Img,
  map: Uint8Array,
  base: RGBA,
  tones: readonly (RGBA | null)[],
  inside: Inside,
): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (!inside(x, y)) continue;
      img.px(x, y, base);
      const c = tones[map[y * TILE + x]!];
      if (c) img.px(x, y, c);
    }
}

/**
 * One sprig of grass: five or six blades rising from a common root.
 *
 * Measured on the board at 8x, a tuft is a single flat dark green with no internal shading at all --
 * the light does not model a mark one pixel wide -- so this stays flat, which is also the only way
 * it survives being laid forty times without becoming a landmark.
 *
 * The first pass drew one-pixel blades splaying hard from the root and they read as antennae rather
 * than as grass. The board's blades are SWORDS: two pixels wide for most of their length, tapering
 * to one only at the tip, standing nearly upright and leaning over only near the top, with their
 * roots touching so the sprig reads as one dense fan. The curve is t^1.7 rather than t^2 for exactly
 * that reason -- a blade leaves the root vertical and gives way late.
 *
 * `[reach, height]` per blade: reach is where the tip lands relative to the root. Widths come out at
 * 10-11px and heights at 9-10, per ART_DIRECTION section 16.
 */
type Blade = readonly [number, number];
const TUFT_SHAPES: readonly (readonly Blade[])[] = [
  [
    [-3, 6],
    [-2, 9],
    [0, 7],
    [1, 10],
    [3, 7],
  ],
  [
    [-3, 8],
    [-1, 6],
    [0, 10],
    [2, 7],
    [3, 5],
  ],
  [
    [-3, 5],
    [-2, 8],
    [0, 10],
    [2, 8],
    [3, 6],
    [1, 4],
  ],
  [
    [-3, 7],
    [-1, 10],
    [1, 6],
    [2, 9],
    [3, 4],
  ],
  // A half sprig, about 6 x 6. Not every mark on the board's lawn is a full tuft, and a tileset
  // whose only strewn mark is one size prints a lattice the moment forty tiles are laid: this sits
  // between a fleck and a tuft and is what breaks the eye's lock on the repeat.
  [
    [-2, 4],
    [0, 6],
    [2, 5],
  ],
];

function tuft(img: Img, shape: readonly Blade[], bx: number, by: number, inside: Inside): void {
  for (const [reach, h] of shape) {
    for (let k = 0; k < h; k++) {
      const t = h === 1 ? 0 : k / (h - 1);
      const x = Math.round(bx + reach * Math.pow(t, 1.7));
      const y = by - k;
      if (inside(x, y)) img.px(x, y, TUFT);
      // Two pixels wide for the lower seven tenths, thickening away from the lean, so the blade is a
      // blade and the roots of the fan close up into one plant.
      if (k < h * 0.7) {
        const xb = x + (reach < 0 ? 1 : -1);
        if (inside(xb, y)) img.px(xb, y, TUFT);
      }
    }
  }
}

/**
 * grass-3's one small ground detail (ART_DIRECTION section 6.3.3): three round leaves about 7 x 6,
 * each with a single lit pixel on its top-left per the one light from the top-left.
 *
 * A clover rather than the pebble the same sentence offers. A pebble is the highest-contrast mark a
 * ground tile could carry and grass-3 is laid a few hundred times across the map, so a pebble prints
 * a grid of dots; a clover is vegetation, it shares the tufts' green, and it disappears into the
 * field the moment it repeats.
 */
const CLOVER_LEAVES: readonly (readonly [number, number])[] = [
  [-3, -1],
  [0, -3],
  [2, 1],
];

function clover(img: Img, cx: number, cy: number, inside: Inside): void {
  for (const [ox, oy] of CLOVER_LEAVES)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const x = cx + ox + dx;
        const y = cy + oy + dy;
        if (inside(x, y)) img.px(x, y, dx === 0 && dy === 0 ? LEAF_LIT : TUFT);
      }
}

/**
 * The scattered two-and-three pixel sprigs the board drops between its tufts. Not speckle: each one
 * is a deliberate little V with a root, there are only a handful, and they are the smallest mark in
 * the tuft vocabulary rather than noise in a third green.
 */
function flecks(img: Img, rnd: () => number, count: number, inside: Inside): void {
  for (let i = 0; i < count; i++) {
    const x = 1 + Math.floor(rnd() * (TILE - 2));
    const y = 1 + Math.floor(rnd() * (TILE - 1));
    const wide = rnd() < 0.55;
    if (nearCorner(x, y)) continue;
    const cells: readonly (readonly [number, number])[] = wide
      ? [
          [0, 0],
          [-1, -1],
          [1, -1],
        ]
      : [
          [0, 0],
          [0, -1],
        ];
    for (const [dx, dy] of cells) if (inside(x + dx, y + dy)) img.px(x + dx, y + dy, TUFT);
  }
}

/* ----------------------------------------------------------------- grass -- */

/**
 * The four variants, per ART_DIRECTION section 6.3.3: grass-0 the shade variant with the heaviest
 * mottle and one tuft, grass-1 two tufts and moderate mottle, grass-2 the quiet one with no tuft so
 * the map can breathe, grass-3 one tuft plus one ground detail. Tuft count averages one per tile.
 *
 * THE ONE DEPARTURE, and it is deliberate. Section 6.3.4 also asks for about 38 luma of field tone
 * between grass-0 and grass-3. Every variant here shares ONE field tone instead, and the variants
 * differ by how much dark mottle covers them -- grass-0 is covered heavily enough to average several
 * levels darker, grass-2 barely at all. The reason is that a mottle blob cannot cross a tile
 * boundary into a different variant, so any difference in FIELD tone shows up as a dead straight
 * edge exactly on the tile grid, which is the rectangle artefact the board has nowhere and which the
 * previous painter's own comment records having hit twice. Coverage gets the board's broad sun and
 * shade patches without drawing the grid for the player.
 */
interface Variant {
  /** How many mottle patches of each tone, and how far across each lands. */
  readonly light: number;
  readonly mid: number;
  readonly deep: number;
  readonly flecks: number;
  /** Root position of each tuft, and which shape it takes. All six pixels clear of every corner. */
  readonly tufts: readonly (readonly [number, number, number])[];
  readonly clover: readonly [number, number] | null;
}

const VARIANTS: readonly Variant[] = [
  { light: 0, mid: 3, deep: 1, flecks: 2, tufts: [[10, 24, 0]], clover: null },
  {
    light: 1,
    mid: 1,
    deep: 0,
    flecks: 1,
    tufts: [
      [22, 12, 1],
      [9, 28, 4],
    ],
    clover: null,
  },
  { light: 2, mid: 0, deep: 0, flecks: 1, tufts: [], clover: null },
  { light: 1, mid: 1, deep: 0, flecks: 1, tufts: [[16, 20, 2]], clover: [11, 7] },
];

/**
 * Field, then mottle. Shared by the grass tiles and by the grass band of an edge tile, so an edge
 *  tile sits correctly against whichever variant the map's noise puts beside it.
 *
 * The patches are BROAD -- a span of 26 against ART_DIRECTION section 6.2's twelve-to-thirty -- and
 * there are only one or two of them. An earlier pass used four and five patches at half the span and
 * the lawn came out as camouflage: enough small patches in one tile stop being mottle and become a
 * texture, and a texture laid forty times is a pattern.
 */
function lawn(img: Img, rnd: () => number, v: Variant, inside: Inside): void {
  const map = new Uint8Array(TILE * TILE);
  stamp(map, rnd, v.light, 26, LIGHT_TONE, [FIELD_TONE], inside);
  stamp(map, rnd, v.mid, 24, MID_TONE, [FIELD_TONE], inside);
  stamp(map, rnd, v.deep, 12, DEEP_TONE, [MID_TONE], inside);
  chunk(map);
  paintTones(img, map, FIELD, LAWN, inside);
}

const grass =
  (n: number): Painter =>
  (img) => {
    const v = VARIANTS[n]!;
    const rnd = noise(4100 + n * 977);
    lawn(img, rnd, v, ALL);
    flecks(img, rnd, v.flecks, ALL);
    for (const [bx, by, shape] of v.tufts) tuft(img, TUFT_SHAPES[shape]!, bx, by, ALL);
    if (v.clover) clover(img, v.clover[0], v.clover[1], ALL);
  };

/* ------------------------------------------------------------------ sand -- */

/**
 * Packed sand: sun-dried blotches and damp compacted hollows, then grit worked into the whole thing.
 *
 * The blotches are placed per tile and wrapped rather than sampled from a field shared between the
 * nine path tiles -- a shared field printed the same comma shape into every tile and a laid path
 * became a grid of identical paisleys. The grit is only the last ten per cent, and it is faint on
 * purpose: the board's path is a clean warm field with a few specks, not dirt.
 */
function sand(img: Img, rnd: () => number, inside: Inside): void {
  const map = new Uint8Array(TILE * TILE);
  stamp(map, rnd, 2, 18, LIGHT_TONE, [FIELD_TONE], inside);
  stamp(map, rnd, 2, 16, MID_TONE, [FIELD_TONE], inside);
  stamp(map, rnd, 1, 9, DEEP_TONE, [MID_TONE], inside);
  chunk(map);
  paintTones(img, map, SAND, TRACK, inside);
  for (let i = 0; i < 13; i++) {
    const x = Math.floor(rnd() * TILE);
    const y = Math.floor(rnd() * TILE);
    if (inside(x, y)) img.px(x, y, rnd() > 0.45 ? GRIT_DARK : GRIT_LIGHT);
  }
}

/**
 * Small stones pressed into the track: a lit cap, a body, and a contact shadow in the sand's own
 * dark. `shadow` is a grass-at-dusk ramp and would read as a green smear on a warm track, so the
 * contact shadow is taken in `path` level 0 instead (ART_DIRECTION section 4).
 *
 * Three per tile, two to three pixels wide. The board shows no stones at all on its open path, so
 * these stay small and low-contrast; any more and nine path tiles laid end to end start printing a
 * recognisable scatter.
 */
function stones(img: Img, rnd: () => number, count: number, inside: Inside): void {
  for (let i = 0; i < count; i++) {
    const w = 2 + Math.floor(rnd() * 2);
    const x = 1 + Math.floor(rnd() * (TILE - w - 2));
    const y = 1 + Math.floor(rnd() * (TILE - 4));
    let clear = !nearCorner(x, y);
    for (let j = 0; j < 3 && clear; j++)
      for (let k = 0; k <= w && clear; k++) if (!inside(x + k, y + j)) clear = false;
    if (!clear) continue;
    img.rect(x, y, w, 1, STONE_CAP);
    img.rect(x, y + 1, w, 1, STONE_BODY);
    img.rect(x + 1, y + 2, w, 1, STONE_SHADE);
  }
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
 *
 * At `cells = TILE` the interpolation collapses and the profile becomes one independent value per
 * column, which still rings. That is how the per-pixel tear is built.
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
 * How far through the grass-to-sand transition a pixel is. The ranks run in one direction, grass to
 * sand, which is what lets a corner tile take the MINIMUM across its two sides and get a correct
 * merge for free: grass beats sand, and the two ragged boundaries fuse into one L.
 *
 * 0 lawn | 1 the dappled grass lip | 2 the dry sand crumb | 3 open path.
 */
type Zone = 0 | 1 | 2 | 3;

const SIDES: readonly Side[] = ['n', 's', 'e', 'w'];

/**
 * One depth profile, one lip profile and one crumb profile per side, built once and shared by every
 * tile that carries that side.
 *
 * There is exactly one `path-n` image in the whole game, so whatever this profile does, it does
 * every 32 pixels along every path edge on the map, and the amplitude and frequency are chosen
 * against that. A slow nine-cell wander of about two pixels carries the shape, a sixteen-cell jitter
 * breaks it up, and a sixteen-cell tear of up to two pixels on top makes the teeth -- measured on
 * the board, the boundary wanders three or four pixels over seventy and tears one to three pixels
 * locally, which is exactly this.
 *
 * The tear rides a SIXTEEN-cell ring rather than one cell per column, which is what makes a tooth
 * two pixels wide. A per-column tear was tried first and it came out as one-pixel salt and pepper
 * along the boundary; the board's teeth are chunky two-to-four pixel tabs of grass overhanging the
 * sand, and chunkiness is the whole difference between a torn edge and a noisy one.
 *
 * The lip runs one to three pixels and the crumb nought to two, both dappled, so neither ever closes
 * into a constant-width line. A constant dark line round the path is a keyline, and ART_DIRECTION
 * section 3.3 says ground carries none.
 */
const EDGE = (() => {
  const depth = {} as Record<Side, (t: number) => number>;
  const lip = {} as Record<Side, (t: number) => number>;
  const crumb = {} as Record<Side, (t: number) => number>;
  SIDES.forEach((s, i) => {
    const slow = ringProfile(900 + i * 37, 9);
    const fine = ringProfile(960 + i * 37, 16);
    const tear = ringProfile(1020 + i * 37, 16);
    const lipRing = ringProfile(1080 + i * 37, 16);
    const crumbRing = ringProfile(1140 + i * 37, TILE);
    depth[s] = (t) => {
      const v = tear(t);
      const base = 7.0 + slow(t) * 2.2 + (fine(t) - 0.5) * 2.0;
      return Math.round(base) + (v < 0.1 ? -2 : v < 0.42 ? -1 : v > 0.9 ? 2 : v > 0.58 ? 1 : 0);
    };
    lip[s] = (t) => {
      const v = lipRing(t);
      return v < 0.16 ? 1 : v > 0.72 ? 3 : 2;
    };
    crumb[s] = (t) => {
      const v = crumbRing(t);
      return v < 0.3 ? 0 : v > 0.8 ? 2 : 1;
    };
  });
  return { depth, lip, crumb };
})();

/**
 * Which of the three lip values a lip pixel takes, as a function of position along the edge.
 *
 * It is a ring of sixteen cells read at `x + y`, which gives runs two to four pixels long whichever
 * direction the edge runs in, and which still meets itself across a tile boundary because the ring's
 * period is TILE. Choosing per pixel at random was tried first and the lip came out as salt and
 * pepper; the board's fringe is a continuous band of chunky tabs that CHANGE VALUE along their
 * length, not a dither.
 */
const LIP_RUN = ringProfile(1200, 16);
const lipTone = (x: number, y: number): RGBA => {
  const v = LIP_RUN(x + y);
  return v < 0.16 ? TUFT : v < 0.58 ? LIP : LIP_SOFT;
};

function zoneOf(sides: readonly Side[], x: number, y: number): Zone {
  let z: Zone = 3;
  for (const s of sides) {
    const t = s === 'n' || s === 's' ? x : y;
    const j = s === 'n' ? y : s === 's' ? TILE - 1 - y : s === 'w' ? x : TILE - 1 - x;
    const g = EDGE.depth[s](t);
    const here: Zone = j < g - EDGE.lip[s](t) ? 0 : j < g ? 1 : j < g + EDGE.crumb[s](t) ? 2 : 3;
    if (here < z) z = here;
  }
  return z;
}

/**
 * Grass on the named sides, sand in the middle. Read outward from the lawn: field, the dappled lip,
 * the torn boundary, the dry crumb margin, open sand. No line anywhere, and the grass band is
 * painted with the same field and mottle the four grass variants use, so an edge tile sits
 * correctly against whichever of them the map's noise puts beside it.
 */
const EDGE_MOTTLE: Variant = {
  light: 1,
  mid: 1,
  deep: 0,
  flecks: 2,
  tufts: [],
  clover: null,
};

const pathTile =
  (sides: readonly Side[], seed: number): Painter =>
  (img) => {
    const rnd = noise(seed);
    const zone = (x: number, y: number): Zone => zoneOf(sides, x, y);
    const on =
      (want: Zone): Inside =>
      (x, y) =>
        x >= 0 && y >= 0 && x < TILE && y < TILE && zone(x, y) === want;

    sand(img, rnd, (x, y) => zone(x, y) >= 2);
    stones(img, rnd, 2, on(3));

    // The grass band, mottled exactly as a grass tile is. It reaches under the lip as well, so the
    // lip is a shade ON grass rather than a stripe between two materials.
    lawn(img, rnd, EDGE_MOTTLE, (x, y) => zone(x, y) <= 1);
    // The lip, dappled a second time: roughly a third of it drops to the tufts' dark green, which is
    // what the board's broken fringe of darker clumps along a path edge actually is.
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const z = zone(x, y);
        if (z === 1) img.px(x, y, lipTone(x, y));
        else if (z === 2 && rnd() > 0.45) img.px(x, y, CRUMB);
      }
    flecks(img, rnd, EDGE_MOTTLE.flecks, on(0));
  };

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
  'path-ne': pathTile(['n', 'e'], 2741),
  'path-nw': pathTile(['n', 'w'], 2851),
  'path-se': pathTile(['s', 'e'], 2963),
  'path-sw': pathTile(['s', 'w'], 3079),
};
