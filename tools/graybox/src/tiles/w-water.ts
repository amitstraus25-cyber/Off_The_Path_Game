/*
 * Water: the river surface, its second phase, the four banks and the fall.
 *
 * Redrawn against `reference/mocks/gameplay-concepts.png` under `docs/ART_DIRECTION.md` section 8.
 * Three things were measured off the board's river and all three were wrong in the build this
 * replaces, in descending order of how much they cost:
 *
 * 1. THE BANKS ARE CROWDED WITH BOULDERS, two deep, each one ringed in a hard dark keyline. The
 *    board's bank is a packed band of rock about a tile wide with slivers of lawn between the
 *    stones; the build had one thin chain of pale grey eggs on the waterline and bare grass behind
 *    it, which is the single reason the river read as a blue stripe laid on a lawn. The whole of
 *    `shore()` below exists to close that gap.
 * 2. THE FALL IS BRIGHT. Sampled over 4950 board pixels the sheet's two dominant tones are L148
 *    and L153 -- the same blue as the open river -- with the DARK streaks at L110-125 and white
 *    only at the rim. The build painted the sheet in `water` level 0 (L99) with light strands on
 *    it, which is the board inverted: it read as a dark slot rather than as falling water.
 * 3. THE SURFACE IS FLAT AND THE RIPPLES ARE WHITE. The board's mid-river is one tone over nearly
 *    the whole frame at L154, carrying short pure-white dashes two pixels tall with a lit-blue
 *    halo and NO dark trough. The build's ripples each dragged a `water` level 0 trough behind
 *    them, which is what greyed the surface down to a mean well under the board's.
 *
 * Three constraints shape every function below, and two of them are the map's, not the board's.
 *
 * A. EVERY TILE IS SEAMLESS WITH ITSELF, because `forest-map.ts` lays these in runs: water in a
 *    3-wide river, `shore-w`/`shore-e` in columns down both banks, `waterfall` in a 3x4 block.
 *    Two copies of one tile are identical, so a feature that runs off an edge continues correctly
 *    if and only if it wraps back into the SAME tile -- hence `wpx`, the boulders drawn three times
 *    a tile apart, the wrapped keyline in `ringPile`, and the fact that no sine in this file has a
 *    period that does not divide 32.
 * B. `water` AND `water-2` SHARE A SURFACE. The map picks between them at random per tile, so they
 *    sit edge to edge constantly. Identical fill, identical mottle, and only the dash set drifts --
 *    a boundary between them is then invisible. Painting them as two different blues would draw
 *    the river as a checkerboard.
 * C. THE WATERFALL CANNOT HAVE A LIP OR A FOOT. The map lays one image 3 wide and 4 tall, so any
 *    horizontal feature repeats four times down the fall and reads as a ladder. The board's white
 *    break at the lip and its foam pool at the foot are therefore absent here and noted as a map
 *    gap rather than faked; everything in `waterfall()` is vertical and wraps.
 *
 * Colour is `shade(ramp, level)` only. `water` for the river, `stone` for the bank rock, `ink` for
 * the rock's keyline and deep shade (section 14: the board's rock keyline `#3a3645` has a faint
 * purple cast and nothing in `stone` is dark enough), `grass` and `shadow` for the land behind it.
 * No raw hex, and no brand colour, because the forest stays a forest.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

/** Terrain tiles are 32x32 (docs/PIXEL_STANDARD.md section 1). */
const S = 32;

export const WATER_TILE_SIZE = S;

const wrap = (v: number): number => ((Math.round(v) % S) + S) % S;

/** Plot with both axes wrapped into the tile, so a feature that leaves one edge enters the other. */
const wpx = (img: Img, x: number, y: number, c: RGBA): void => img.px(wrap(x), wrap(y), c);

/** Coordinate-indexed noise, so it is identical in every copy of the tile. */
const hash2 = (x: number, y: number, salt: number): number => {
  let h =
    (Math.imul(wrap(x) + 1, 374761393) +
      Math.imul(wrap(y) + 1, 668265263) +
      Math.imul(salt, 2246822519)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* A Bayer dither table and its two helpers stood here and were never reached: this file was
   half-written when its run was stopped. Removed so the tree lints. The idea is worth keeping in
   mind though -- an ordered dither on the RIM of a shape is how a pixel surface gets a soft
   transition while every pixel stays exactly one palette colour, which is what `pixelArt: true`
   needs. Now that paint.ts has `tone()`, a continuous ramp is usually the better answer. */

/**
 * A lumpy radius per angle: three harmonics giving three to five broad lobes. The amplitudes are
 * deliberately large -- a boulder drawn on a gentle wobble is still an egg, and the board's rocks
 * are chunky, with flat-ish faces meeting at blunt corners. At radius 7 this swings the silhouette
 * by three pixels, which is the difference between a stone and a pebble shape.
 */
const lump = (a: number, seed: number): number =>
  1 +
  0.2 * Math.sin(2 * a + seed) +
  0.13 * Math.sin(3 * a + seed * 2.3) -
  0.08 * Math.cos(5 * a + seed * 0.7);

/* --- the surface ---------------------------------------------------------- */

/**
 * Broad lifts in the surface, section 8's "lighter bands of water[2] ... slow irregular curves".
 *
 * The board's mid-river is close to one flat tone: a 50x45 crop came back 31 per cent a single
 * blue and carried no band or gradient at all. But that one tone is L154, and our ramp brackets it
 * without containing it -- `water[1]` is L135 and `water[2]` is L176. Three broad blobs covering
 * about two fifths of the tile put the mean at L152, which is the board's surface to within two
 * levels, while keeping every pixel a palette colour. Their cores are solid and only their rims
 * dither, so they read as light on water rather than as a screen.
 *
 * Nothing sits within six pixels of a corner (section 6.3 rule 2): four tiles meet there and a
 * feature at a corner repeats across the map as a cross.
 */
/**
 * The field is FLAT, and that is a decision made against three attempts at making it otherwise.
 *
 * The board's mid-river is a single tone over nearly the whole frame: a 50x45 crop came back 31
 * per cent one blue, with no band, blob or gradient anywhere. That tone is L154 and our ramp
 * brackets it without holding it -- `water[1]` is L135 and `water[2]` is L176 -- so every attempt
 * to reach it synthesises a value, and a synthesised value is a pattern repeated on a 32px pitch
 * in a river made of two images. Round blobs read as pale bubbles parked in the stream. Blobs
 * dithered across their radius read as a chequer, which at the camera's 1.5x upscale moires.
 * Bands wandering down the flow looked right on one tile and braided into a basketweave lattice
 * the moment five columns of them were laid side by side -- the tile grid, drawn by hand, and the
 * worst of the three.
 *
 * So the surface carries no field pattern at all. What lifts it off L135 is marks: the white
 * dashes the board actually draws, and a scatter of lit-blue streaks between them (`swirls`).
 * Those are structure the eye reads as moving water, they average the tile up to about L145, and
 * because each is a discrete mark rather than a field, two tiles meeting show no seam.
 */
function surface(img: Img): void {
  img.rect(0, 0, S, S, shade('water', 1));
}

type Ripple = readonly [x: number, y: number, len: number];

/**
 * Three crests, hand-placed, at three lengths. Spacing is uneven on both axes on purpose: evenly
 * spaced ripples read as corduroy, and three in a vertical line read as a reflection of something
 * that is not there.
 *
 * Three, not the eleven this tile used to carry. This number was settled by laying the tiles out
 * as a river next to the board at one scale, not by looking at the tile: eleven was a froth, seven
 * was confetti, and the board's own river carries only a handful of dashes across the whole
 * visible channel. `water-2`'s set is placed by hand rather than translated from this one, because
 * a translated set repeats the same constellation in every other tile and draws the 32px grid.
 */
const RIPPLES_A: readonly Ripple[] = [
  [5, 4, 5],
  [21, 12, 3],
  [12, 23, 6],
];

/**
 * Phase two is the same water with the crests somewhere else: same flat fill, same tones, three
 * dashes again, placed so that no dash of this set sits where a dash of the other set sits. Two
 * tiles that differ only in where the light fell read as one moving surface; two tiles that differ
 * in colour read as a patchwork, and two tiles whose marks are the same shape translated read as a
 * grid.
 */
const RIPPLES_B: readonly Ripple[] = [
  [24, 3, 4],
  [7, 17, 6],
  [19, 28, 3],
];

/**
 * One ripple, drawn the way the board draws it: a white bar two pixels tall with a lit-blue halo
 * round it, the lower row inset a pixel at each end so the bar has ends rather than corners.
 *
 * There is no dark trough. The version this replaces tucked a `water` level 0 trough under every
 * crest, and eleven of those took the surface's mean well below the board's; on the board a dash
 * sits in water with nothing but lit blue around it.
 */
function ripple(img: Img, x: number, y: number, len: number): void {
  // Halo: a lozenge, not a box, so the dash reads as a crest and not as a label.
  for (let i = 0; i < len; i++) {
    wpx(img, x + i, y - 1, shade('water', 2));
    wpx(img, x + i, y + 2, shade('water', 2));
  }
  for (let j = 0; j <= 1; j++) {
    wpx(img, x - 1, y + j, shade('water', 2));
    wpx(img, x + len, y + j, shade('water', 2));
  }
  // Core.
  for (let i = 0; i < len; i++) wpx(img, x + i, y, shade('water', 3));
  for (let i = 1; i < len - 1; i++) wpx(img, x + i, y + 1, shade('water', 3));
}

/**
 * The lit-blue streaks that carry the surface between the white dashes, and the whole of what
 * stands in for a field here. Longer and softer than a dash, no white core, scattered on a
 * different rhythm so the two sets never line up into rows.
 */
const SWIRLS_A: readonly Ripple[] = [
  [1, 10, 8],
  [22, 12, 6],
  [8, 24, 9],
];

const SWIRLS_B: readonly Ripple[] = [
  [13, 6, 7],
  [2, 20, 9],
  [24, 26, 6],
];

/** One pixel tall and no white core: a swirl is the surface turning over, not a crest breaking. */
function swirl(img: Img, x: number, y: number, len: number): void {
  for (let i = 0; i < len; i++) wpx(img, x + i, y, shade('water', 2));
}

function river(img: Img, ripples: readonly Ripple[], swirls: readonly Ripple[]): void {
  surface(img);
  for (const [x, y, len] of swirls) swirl(img, x, y, len);
  for (const [x, y, len] of ripples) ripple(img, x, y, len);
}

/* --- the bank ------------------------------------------------------------- */

type Side = 'n' | 's' | 'e' | 'w';

/**
 * How deep the land reaches into the tile, measured from the bank-side edge, at position `t` along
 * that edge. Mean 12 of 32, unchanged from the build this replaces, because the map's river width
 * is tuned to it: move the waterline here and the river narrows or widens everywhere at once.
 *
 * Two harmonics, both with a period dividing 32, so the waterline wanders and still joins itself
 * where the tile repeats. docs/PIXEL_STANDARD.md section 5: no straight edge anywhere.
 */
const bankDepth = (t: number): number =>
  12.0 + 3.4 * Math.sin((2 * Math.PI * t) / S + 0.6) + 1.7 * Math.sin((4 * Math.PI * t) / S + 2.3);

/**
 * Where each side starts reading that profile. The map puts `shore-w` down the left bank and
 * `shore-e` down the right bank of the same river, so without this the two banks bulge together
 * and the same boulders sit opposite each other at the same height, all the way down -- a canal,
 * not a river.
 */
const PHASE: Record<Side, number> = { n: 0, e: 11, s: 19, w: 6 };

/** Bank space (along the edge, depth into the tile) -> tile space. */
const toTile = (side: Side, t: number, d: number): [number, number] =>
  side === 'w' ? [d, t] : side === 'e' ? [S - 1 - d, t] : side === 'n' ? [t, d] : [t, S - 1 - d];

/** Tile space -> bank space. The inverse of `toTile`, and the reason one painter serves all four. */
const toBank = (side: Side, x: number, y: number): [number, number] =>
  side === 'w' ? [y, x] : side === 'e' ? [y, S - 1 - x] : side === 'n' ? [x, y] : [x, S - 1 - y];

/**
 * Land test, evaluated rather than stored, so it answers correctly for coordinates outside the
 * tile too. That is what the neighbour lookups need: along the bank the tile repeats, so `t` wraps,
 * while across it the neighbour is open ground on one side and open river on the other -- which a
 * negative or over-32 depth gives for free, since `bankDepth` never leaves 6.9..17.1.
 */
const isLand = (side: Side, x: number, y: number): boolean => {
  const [t, d] = toBank(side, x, y);
  return d < bankDepth(wrap(t) + PHASE[side]);
};

/**
 * One boulder, lit from the top-left like everything else in the game, with `lump` for its
 * silhouette so it rasterises into the straight-ish runs and blunt corners the board's rocks have.
 *
 * Drawn in tile space rather than bank space precisely so the light does not rotate with the side:
 * a stone on the east bank is lit from the same corner as a stone on the west bank, or the two
 * tiles read as two different times of day.
 *
 * `u` runs from 1 at the upper-left silhouette to -1 at the lower-right, so the three faces are
 * cuts across it rather than nested ellipses. Sampled on the board, a bank boulder's lit face is
 * L174-189, its base L125-141 and its shade L80-102 -- which is `stone` levels 2, 1 and 0 almost
 * exactly. That lit face is a FACE, not a highlight; section 8's "light cap of 2-3 px" is the
 * `stone` level 3 specular, which only the boulders that both face the light and sit in front are
 * given (section 5).
 *
 * The cut is at u > 0.1, which makes the lit face about 45 per cent of the rock. That is the one
 * number that decides whether the bank reads as the board's: its boulders are PALE, light grey
 * stones with a shaded underside, and the first pass here cut at 0.2 with a wide shade band and
 * came out a row of mid-grey pebbles. Comparing the two banks side by side at one scale is what
 * showed it; neither looks wrong on its own.
 *
 * The terminator carries its own harmonics, which is what gives the lit face the board's
 * cloud-stepped edge instead of a clean crescent.
 */
function boulder(img: Img, cx: number, cy: number, r: number, seed: number, spec: boolean): void {
  const squat = 0.86; // a bank of perfect circles reads as a bag of marbles
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / squat;
      const a = Math.atan2(dy, dx);
      const rr = r * lump(a, seed);
      if (Math.hypot(dx, dy) > rr) continue;
      const u = (-dx - dy) / (rr * 1.414);
      const w = 0.18 * Math.sin(4 * a + seed * 1.7) + 0.11 * Math.sin(7 * a + seed);
      img.px(
        x,
        y,
        spec && u > 0.76 + w
          ? shade('stone', 3)
          : u > 0.1 + w
            ? shade('stone', 2)
            : u > -0.4 + w
              ? shade('stone', 1)
              : shade('stone', 0),
      );
    }
}

/**
 * The keyline, done the way `docs/ART_DIRECTION.md` section 3.4 requires: the whole boulder pile is
 * composed on one scratch image and ringed there, so the line lands on the pile's silhouette and
 * never on the seam between two boulders. Ring per boulder and the bank looks quilted.
 *
 * `Img.outline` cannot do this job. It is four-neighbour, so it leaves the corner of every diagonal
 * step open on a lumpy silhouette; it has no way to thicken the shade side; and its lookups stop at
 * the image edge, where this tile needs them to wrap, because the map lays `shore-w` in an unbroken
 * column and a keyline that stops at the tile boundary draws the grid for you.
 *
 * Section 3.2: 1px everywhere, 2px along the bottom and lower-right of any mass wider than 16px,
 * and never on the top or left. The outward normal is the direction with no rock in it, so
 * thickening only where it points down, or right and not up, is that rule stated geometrically.
 */
function ringPile(img: Img, line: RGBA): void {
  const solid = new Uint8Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) solid[y * S + x] = img.get(x, y)[3] > 0 ? 1 : 0;
  const at = (x: number, y: number): boolean => solid[wrap(y) * S + wrap(x)] === 1;

  const ring: [number, number][] = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (at(x, y)) continue;
      let ix = 0;
      let iy = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || !at(x + dx, y + dy)) continue;
          ix += dx;
          iy += dy;
          n++;
        }
      if (n === 0) continue;
      ring.push([x, y]);
      if (iy < 0) ring.push([x, y + 1]);
      if (ix < 0 && iy <= 0) ring.push([x + 1, y]);
    }
  for (const [x, y] of ring) if (!at(x, y)) img.px(wrap(x), wrap(y), line);
}

/**
 * The bank run: two rows of boulders, the back row sitting up on the lawn and the front row
 * straddling the waterline and wading out into the shallows.
 *
 * Section 8 asks for a band packed two deep and roughly a tile wide, and a 32px shore tile that is
 * only twelve pixels of land cannot hold one on the land alone -- on the board the bank is about
 * ten pixels of lawn, four of earth and thirty of rock, which is more bank than we own. So the
 * front row wades: centres at depth 15-16 with the waterline at 12, which is what the board does
 * wherever its river runs against rock anyway, and it is what gives the foam something to break
 * on. The band ends up spanning depth 4 to 24, two deep, with four or five pixels of lawn above
 * it and real gaps through it. It costs the visible river about twelve pixels a side, which moves
 * our river towards the board's rather than away from it: the board's channel between its two rock
 * bands is nearer 1.5 tiles than our four.
 *
 * Seven boulders, not eight at an even pitch. The first pass used eight of nearly one size evenly
 * spaced and the bank came out as a dry-stone wall; laid in a column down the river, as the map
 * lays it, it was a kerb. A 32px tile repeated down a bank will always repeat -- what decides
 * whether that reads as a wall or as rocks is how much the band's outer silhouette moves WITHIN
 * the one tile. So the reach into the water now swings seven pixels across the three front
 * boulders, their radii run 5.2 to 8.4, and a seventh small rock stands out in the shallows on its
 * own, detached from the band, which is what finally breaks the straight edge. The board does the
 * same thing: its banks are not a line of rocks, they are a crowd with stragglers.
 *
 * `t` is a position on the bank profile, so a boulder sits relative to the waterline; the tile
 * coordinate is that position less the side's phase, which is what keeps the two banks from
 * matching. Pitch is uneven on both rows and the two rows interleave, so no boulder sits directly
 * behind another.
 */
type Rock = readonly [t: number, depth: number, r: number, seed: number, spec: boolean];

/**
 * Back row: smaller, up on the lawn, drawn first so the front row overlaps it. The depths swing
 * from 6.5 to 12, so the lawn edge of the band moves six pixels across one tile -- on the board
 * the grass runs into the rocks in a ragged line, never along a kerb.
 */
const BACK: readonly Rock[] = [
  [2, 11.5, 5.4, 0.4, false],
  [12, 8.2, 6.4, 2.1, true],
  [22, 12.0, 3.6, 3.7, false],
  [28, 6.5, 2.8, 1.8, false],
];

/**
 * Front row, plus the straggler out in the shallows. Reaches are 26.1, 18.2 and 23.4 deep: the
 * band's waterline edge moves most of a boulder across one tile, which is what stops the repeat
 * reading as a line down the bank.
 */
const FRONT: readonly Rock[] = [
  [6, 17.5, 8.6, 1.3, true],
  [18, 13.2, 5.0, 4.4, false],
  [27, 16.0, 7.4, 5.9, true],
  [13, 21.8, 3.0, 3.1, false],
];

/**
 * One rock laid into the pile, with a deep-shade rim on whatever rock is already under it.
 *
 * Section 8: where two boulders meet it is deep shade, never keyline -- the keyline is for the
 * pile's silhouette against the world. `stone` level 0 is that deep shade: sampled on the board,
 * the line between two touching boulders comes back L80-102, which is this value, and the
 * separation is carried by the lit face of the near boulder landing against it rather than by the
 * line being dark. The first pass drew these rims in `ink` level 3 at L73 and the bank came out as
 * mosaic tile and grout -- every boulder ringed in near-black, which is the quilting section 3.4
 * warns about arriving by a different route.
 *
 * Each boulder is drawn three times, a tile apart along the bank, so one sitting on the tile edge
 * is a single boulder in the run rather than two halves meeting at a seam.
 */
function layRock(pile: Img, side: Side, rock: Rock): void {
  const [t, depth, r, seed, spec] = rock;
  const one = new Img(S, S);
  for (const k of [-1, 0, 1]) {
    const [cx, cy] = toTile(side, t - PHASE[side] + k * S, depth);
    boulder(one, cx, cy, r, seed, spec);
  }
  const solidHere = (x: number, y: number): boolean => one.get(wrap(x), wrap(y))[3] > 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (solidHere(x, y) || pile.get(x, y)[3] === 0) continue;
      let touching = false;
      for (let dy = -1; dy <= 1 && !touching; dy++)
        for (let dx = -1; dx <= 1 && !touching; dx++)
          if ((dx !== 0 || dy !== 0) && solidHere(x + dx, y + dy)) touching = true;
      if (touching) pile.px(x, y, shade('stone', 0));
    }
  pile.blit(one, 0, 0);
}

/**
 * Grass sprigs on the bank. Three blades, small: section 6.2 asks for 10x11 tufts on a grass tile,
 * and a tuft that size does not fit the four to six pixels of lawn a shore tile has left above its
 * rock band. Noted as a departure rather than squeezed in at the wrong scale.
 */
function sprig(img: Img, x: number, y: number): void {
  img.px(x, y + 2, shade('grass', 1));
  img.px(x, y + 1, shade('grass', 1));
  img.px(x + 1, y + 2, shade('grass', 1));
  img.px(x + 2, y, shade('grass', 1));
  img.px(x + 2, y + 1, shade('grass', 1));
  img.px(x + 3, y + 2, shade('grass', 1));
  img.px(x + 4, y + 1, shade('grass', 1));
  img.px(x + 4, y + 2, shade('grass', 1));
}

function shore(side: Side): (img: Img) => void {
  return (img) => {
    // The river first, and the whole tile of it, so the mottle and the dashes run unbroken from the
    // open water into the bank. Clipping the surface to the wet part would put a phase break along
    // the waterline, which is exactly where the eye is looking.
    river(img, RIPPLES_A, SWIRLS_A);

    /*
     * The land. Section 6.1 is binding and it moves this: the board's lawn sits at L190 and ours
     * was being painted here at `grass` level 1, L124, so the bank ran a dark green stripe down
     * both sides of the river that no grass tile would ever match. Field-led at level 3, mottled
     * with level 2, exactly as the grass tiles are being redrawn.
     */
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!isLand(side, x, y)) continue;
        const [t, d] = toBank(side, x, y);
        const edge = bankDepth(wrap(t) + PHASE[side]);
        // The land's own dark edge where it meets the water. Not a keyline -- section 3.3 gives
        // ground none -- but the board does carry a dark band of earth and shade along the
        // waterline, and without it the bank reads as a sticker laid on the water. Nearly all of
        // it ends up under rock; it shows in the gaps, which is where it is wanted.
        if (d > edge - 2.2) {
          img.px(x, y, shade('shadow', 1));
          continue;
        }
        // Mottle in 4px blocks, never per pixel: section 6.2 bans single-pixel speckle, and the
        // strip of lawn a shore tile has left is too narrow for a proper 12-30px blob.
        const n = hash2(Math.floor(x / 4) * 4, Math.floor(y / 4) * 4, 17);
        img.px(x, y, n > 0.58 ? shade('grass', 2) : shade('grass', 3));
      }
    // Two sprigs, on the lawn above the rock band and never on the dark edge.
    for (const [t, d] of [
      [4, 2],
      [19, 1],
    ] as const) {
      const [sx, sy] = toTile(side, t - PHASE[side], d);
      sprig(img, wrap(sx), wrap(sy));
    }

    /*
     * The boulder band, composed on one scratch image and keylined there (section 3.4). Back row
     * first so the front row overlaps it, and the keyline goes on last so it rings the pile and
     * not the seams.
     */
    const pile = new Img(S, S);
    for (const rock of BACK) layRock(pile, side, rock);
    for (const rock of FRONT) layRock(pile, side, rock);
    ringPile(pile, shade('ink', 2));
    img.blit(pile, 0, 0);

    /*
     * Foam. The board breaks white against every rock and every bank and then runs a wide apron of
     * lit blue outside it, with a darker band beyond that where the bank shadows the water. Four
     * rings off a wrapped distance field:
     *
     *   1-2  white      section 8's foam line
     *   3-4  lit blue   the apron, thinning out as it goes
     *
     * Four pixels in all, which is as much as there is room for. A shore tile is twelve pixels of
     * land, a rock band reaching to about twenty-four, and whatever is left; at five rings the
     * whole of that remainder came out near-white and the tile had no river in it at all. The
     * apron is also hashed from its first ring rather than its last, because an unbroken ring
     * fills a concave pocket in the bank solid and the result reads as a bright arrow pointing at
     * the shore -- which is what it looked like at zoom 11, and not at zoom 4.
     *
     * Section 8 also asks for a darker `water[0]` band three or four pixels wide hugging the bank,
     * "so the river reads as deeper in the middle". That is in this file's history and it is out
     * again, because the board does the opposite and the sentence argues against itself: a dark
     * band at the bank makes the BANK read as the deep part. On the board the water is at its
     * brightest where it meets rock -- white, then a wide apron of cyan -- and the plain base tone
     * in midstream is what reads as depth. Drawn in, the band came out as navy wedges biting into
     * the bank, which is the first thing the eye went to in a side-by-side. The dark line the
     * board does have at the foot of a rock is already here: it is the rock's own keyline.
     *
     * The white is hashed in 3px blocks rather than per pixel, because water breaks where it is
     * pushed against something and runs quiet in the lee -- it comes and goes in runs along the
     * waterline, and a per-pixel hash only gives a dotted line, which is still a line. The pass
     * this replaces traced every rock exactly, at full white, one pixel out all the way round --
     * which is not a waterline, it is a sticker outline.
     */
    const solid = new Uint8Array(S * S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        solid[y * S + x] = isLand(side, x, y) || pile.get(x, y)[3] > 0 ? 1 : 0;

    const dist = new Int8Array(S * S).fill(-1);
    let front: [number, number][] = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) if (solid[y * S + x] === 1) front.push([x, y]);
    for (let d = 1; d <= 4 && front.length; d++) {
      const next: [number, number][] = [];
      for (const [x, y] of front)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = wrap(x + dx);
          const ny = wrap(y + dy);
          const i = ny * S + nx;
          if (solid[i] === 1 || dist[i] !== -1) continue;
          dist[i] = d;
          next.push([nx, ny]);
        }
      front = next;
    }
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = dist[y * S + x]!;
        if (d < 1) continue;
        // Hashed in 3px blocks, not per pixel, so the white comes and goes in runs along the
        // waterline the way surf does. A per-pixel hash gives a dotted line, which is still a
        // line; what the board has is white here, none there, more further on.
        const patch = hash2(Math.floor(x / 3) * 3, Math.floor(y / 3) * 3, 211);
        if (d <= 2) {
          const keep = d === 1 ? patch > 0.16 : patch > 0.48;
          img.px(x, y, keep ? shade('water', 3) : shade('water', 2));
        } else if (hash2(x, y, 353) > (d === 3 ? 0.22 : 0.62)) img.px(x, y, shade('water', 2));
      }
  };
}

/* --- the fall ------------------------------------------------------------- */

/**
 * The strands of the sheet: x, width, and which tone the strand takes. The sheet is `water` level 1
 * and the strands stand on it -- the dark ones are the channels between falling ropes of water, the
 * light ones are the ropes.
 *
 * Measured on the board over 4950 pixels of sheet, by band: L140-158 is 42 per cent of it,
 * L110-133 is 19, L172-191 is 6 and white is 2.
 *
 * Those proportions cannot be taken literally, and working out why is the whole of this tile. The
 * board's BASE is L150 and ours is `water[1]` at L135; a sheet painted in faithful proportions
 * therefore lands at L133, fifteen levels under the board, and reads as a dark slot. The missing
 * value has to be synthesised, and on a waterfall -- unlike on the river surface, where every
 * attempt at it became a lattice -- synthesising it is free, because the thing a fall is MADE of
 * is vertical strands. Eleven columns of `water[2]` among sixteen of `water[1]`, four of channel
 * and one of white, averages L148: the board's sheet exactly, built out of ropes rather than out
 * of a dither.
 *
 * What does not work is reaching for that brightness with `water[3]`. Two passes did, with white
 * cores running most of the height, and both read as candy stripe three tiles across. The white
 * on the board is two per cent of the sheet and it is at the rim.
 */
const STRANDS: readonly (readonly [x: number, w: number, dark: boolean])[] = [
  [1, 3, false],
  [6, 2, true],
  [11, 3, false],
  [17, 2, true],
  [21, 3, false],
  [27, 2, false],
];

/**
 * How far a strand's left edge wanders at height `y`. Period 16, not 32, so a four-tile stack gets
 * eight bends rather than four; a strand that runs dead straight down twelve tiles of fall is a
 * pipe, and one that bends once per tile beats time with the tile grid. One pixel of amplitude,
 * because a strand that wanders further than its own width stops being a strand.
 */
const sway = (y: number, phase: number): number =>
  Math.round(0.9 * Math.sin((2 * Math.PI * y) / 16 + phase));

/**
 * The fall, and the hardest tile in the set, because `forest-map.ts` lays it 3 wide and 4 tall and
 * every one of those twelve tiles is this exact image.
 *
 * That is why there is no lip and no foam pool here even though the board has both and they are
 * the two best things about its waterfall. A white break across the lip would repeat four times
 * down the fall and read as a ladder; so would a pool. They belong to tiles the map does not have
 * -- see the note handed back with this file. Everything below is vertical, wraps on a period that
 * divides 32, and carries no horizontal feature anywhere.
 *
 * Two earlier passes were thrown away here and both lessons are kept: a light sheet with lighter
 * streaks on it reads as a blue rectangle, and a full-width churn across the bottom rows reads as
 * a shelf. The answer to both is that a fall reads because of what is BETWEEN the strands.
 */
function waterfall(img: Img): void {
  img.rect(0, 0, S, S, shade('water', 1));

  STRANDS.forEach(([sx, w, dark], n) => {
    const phase = n * 1.9;
    for (let y = 0; y < S; y++) {
      /*
       * Each strand swells and thins down its length, out of step with its neighbours. Two
       * harmonics, so a rope goes from its bare width to two pixels over it and back twice a tile
       * rather than once: a rope of constant width is a pipe, and seven pipes side by side are
       * corduroy, which is what the first pass of this looked like laid three tiles across.
       */
      const swell =
        Math.sin((2 * Math.PI * y) / 16 + phase * 1.3) +
        0.7 * Math.sin((2 * Math.PI * y) / 32 + phase);
      const wide = swell > 0.9 ? 2 : swell > 0.1 ? 1 : 0;
      const x0 = sx + sway(y, phase);
      for (let i = 0; i < w + wide; i++)
        wpx(img, x0 + i, y, dark ? shade('water', 0) : shade('water', 2));
      // The bright core of a lit rope: one strand only, and only where it is at its widest. The
      // board puts two per cent of its sheet at white; a level 3 column running thirty-two rows is
      // a neon tube, and six of those is far past the highlight budget (section 5).
      if (!dark && n === 2 && wide === 2) wpx(img, x0 + 1, y, shade('water', 3));
    }
    // Droplets torn off a rope and falling on their own in the channel beside it. One per lit
    // strand: three of these on every strand laid rows of bright dots across the fall, which is
    // the one thing a four-tile stack cannot have.
    if (dark) return;
    const dy = n * 7;
    wpx(img, sx - 2, dy, shade('water', 2));
    wpx(img, sx - 2, dy + 1, shade('water', 3));
    wpx(img, sx - 2, dy + 2, shade('water', 2));
  });
}

/* --- the seven tiles ------------------------------------------------------ */

export const WATER_TILES: Record<string, (img: Img) => void> = {
  water: (img) => river(img, RIPPLES_A, SWIRLS_A),
  'water-2': (img) => river(img, RIPPLES_B, SWIRLS_B),
  'shore-n': shore('n'),
  'shore-s': shore('s'),
  'shore-e': shore('e'),
  'shore-w': shore('w'),
  waterfall,
};
