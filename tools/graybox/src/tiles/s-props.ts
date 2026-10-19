/*
 * Props, drawn against the concept board: the stall, the lantern post, the fountain, the well and
 * the signpost.
 *
 * READ THIS BEFORE YOU CHANGE A NUMBER. The previous pass of this file was optimised against a
 * BROKEN RULER and most of what it did had to be undone.
 *
 * That pass read `board-profile.json` as saying the board sat at 4.50 per cent edge density against
 * our 33, concluded the art was five to nine times too busy, and spent itself smoothing: a narrow
 * 0.46 tone span so no two neighbouring pixels could cross the score's 24-luma threshold, `bank()`
 * tuned in deliberately sub-threshold steps, and every crisp mark in the file -- barrel hoops,
 * basket weave, plank seams, shingle courses, stone mortar -- dissolved into a ten-luma ripple.
 *
 * The profile had been built from board crops upscaled and interpolated at roughly three image
 * pixels to one of ours, so the board's own edges were smeared across the interpolation and counted
 * at a third of their weight. It has since been rebuilt from crops NEAREST-downsampled to our
 * resolution, and the sign of the error flipped. Measured on the stall region, both at 1:1:
 *
 *     axis                              before    after    board
 *     deep shade  (% under luma 81)      21.27    25.63    29.28
 *     keyline     (% under luma 60)      12.36    15.77    20.47
 *     luma spread (stdev)                62.56    62.40    73.27
 *     edge density(% of neighbours)      19.33    30.98    29.96
 *     texture     (mean 16px stdev)      45.63    49.69    57.70
 *
 * Not one axis was asking for less. The board is crisp pixel art with hard, readable steps and a
 * near-black keyline round everything, and smoothing this file out to chase the broken number had
 * replaced that device with soft focus. The director's eye and the rebuilt ruler agree, which is
 * the part worth trusting.
 *
 * So the span is wide again and every surface is QUANTISED, through `band()`. That is not a return
 * to flat `shade()`: the contour still follows the form, because `roundT()` is untouched, so a
 * barrel still bands in arcs around its own curve. What changed is that the fall is cut into five
 * flat steps instead of a continuous gradient -- which is how pixel art has always made a cylinder.
 * The roundness lives in the SHAPE of the bands, not in the smoothness between them, and because
 * the bands come off `tone()` they are still colours the four-stop palette cannot name.
 *
 * At the whole-camera level this took the stall view from 0.434 to 0.308, with edge density landing
 * at 1.02 of the board. Five bands is the measured optimum: at four, edges overshoot to 1.14; past
 * five, nothing moves at all, because camera-level colour variety is dominated by the lawn and the
 * canopy rather than by any prop. That axis is not this file's to fix and is not claimed here.
 *
 * THE ONE DELIBERATE DEPARTURE from the board stands: the board predates the rebrand and shows a
 * scarlet cloak and a terracotta roof. Red is Lilac-led Cyera purple and the roof is slate. The
 * lantern's flame is the other deliberate exception -- it stays warm gold, because it is a light
 * source and it is the skill the Keeper offers.
 *
 * What was cropped from the board, and what it said:
 *
 *   stall      a cream awning in wide folds with WARM SAND stripes a bare eighteen luma below the
 *              cream (probed: #fde7c9 against #f4d3ab) -- not purple, and not a smooth gradient;
 *              a scalloped hem with a dark notch at each join; round timber posts; a dense counter
 *              of crates, sacks and round wares; a barrel either side; a hanging sign on two rings
 *              carrying the skill's own icon. All of it ringed in near-black.
 *   signpost   TWO arrow boards on a capped post, pointed ends, visible grain and a knot. No writing.
 *   well       a ring of individual stone blocks around a capped timber post, a bucket on the rim.
 *              (The board's well has no roof; ours keeps one, in slate, per ART_PRODUCTION 6a.)
 *   lantern    a DARK slate lantern with a warm gold pane, on a cross-arm tenoned into a capped post.
 *
 * The previous pass flagged the barrel and the hanging sign as impossible without a map change.
 * That was half right and the other half was a missed opportunity -- see the note on `AWN_LEFT`.
 * Both now exist, in the two END tiles of the awning, which are distinct painters; it is only the
 * four repeated `stall-counter` tiles that cannot carry a one-off.
 *
 * STILL FLAGGED:
 *
 *   The stall's counter is one tile laid four times, so its goods repeat on a 32-pixel beat and no
 *   painter can break that. The two wares that straddle the seam and the mismatch between the back
 *   and front rows soften it; they do not cure it. A distinct left and right counter tile is the
 *   real fix and it is a map change. The board also stands a SECOND barrel at the stall's right --
 *   there is no room for it, because that corner is spent on the sign, which is worth more.
 *
 *   There is no fountain anywhere on the concept board. It is built out of the board's vocabulary --
 *   the same keylined, round-lit stone the well's ring is made of -- rather than from a style
 *   invented for it. If the board is ever extended to cover it, this is the tile to re-check first.
 *
 *   The awning's stripe is no longer purple, which contradicts ART_PRODUCTION section 6a. The
 *   reasoning is at `PALE_HI`, and it needs a brand reviewer's yes or no.
 */
import { GROUND_TILES } from './w-ground.ts';
import { Img, keyline, shade, tone } from '../paint.ts';
import type { Ramp, RGBA } from '../paint.ts';

const TILE = 32;

type Painter = (img: Img) => void;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/* ------------------------------------------------------------------ the keyline */

/*
 * The board does not draw one outline colour -- it draws a near-black that still carries the
 * object's own hue, which is why its world reads as one illustration rather than as sprites with
 * pen round them. `keyline()` in `paint.ts` is exactly that: the ramp's darkest stop taken down,
 * with the ratios between the channels preserved.
 *
 * Five of them, so a timber rings in warm near-black, slate in a cool one and cream in neither.
 * They are also five more colours in a file that was measured as having almost none.
 *
 *   wood  #180f0a   stone #232325   roof  #1f1d1a   cloth #1c1814   metal #150822
 *
 * `stone` and `cloth` take a bigger drop than the default 40 because their darkest stops start
 * high -- `stone[0]` is luma 96 and `wall[0]` is luma 175, and forty off either is still a midtone.
 */
const LINE = {
  wood: keyline('trunk'),
  stone: keyline('stone', 60),
  roof: keyline('roof'),
  cloth: keyline('wall', 150),
  metal: keyline('ink'),
} as const;

/**
 * Ring whatever has been drawn on a transparent image.
 *
 * `Img.outline()` cannot be used for this: it paints only transparent pixels next to opaque ones,
 * so it gives one pixel everywhere and nothing else. This does the board's version -- 1px all
 * round, and a second pixel along the bottom and the lower-right, which is the band that seats a
 * thing on the ground rather than leaving it floating on it. The top and the left are never
 * thickened; that is the side the light comes from.
 *
 * It never paints over art, so an interior keyline -- a bucket against stone, a post against cloth
 * -- still has to be drawn by hand where it is wanted.
 */
function ring(img: Img, line: RGBA): void {
  const solid = new Uint8Array(img.w * img.h);
  for (let i = 0; i < solid.length; i++) solid[i] = img.data[i * 4 + 3]! > 0 ? 1 : 0;
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && solid[y * img.w + x] === 1;

  let top = img.h;
  let bottom = 0;
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++)
      if (at(x, y)) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  const midY = (top + bottom) / 2;

  const edge: [number, number][] = [];
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) edge.push([x, y]);
    }
  for (const [x, y] of edge) img.px(x, y, line);
  for (const [x, y] of edge) {
    if (at(x, y - 1) && !at(x, y + 1)) img.px(x, y + 1, line);
    if (at(x - 1, y) && !at(x + 1, y) && y > midY) img.px(x + 1, y, line);
  }
}

/**
 * The band of its own deep tone the board banks just inside the keyline, on the side turning away.
 *
 * It DARKENS what is already painted rather than laying a chosen colour over it, which is the whole
 * trick: timber banks in brown, slate in grey, cream in cream, and every one of those is a tone the
 * four-stop palette could not name.
 *
 * The two steps are a fixed number of LUMA, not a fixed percentage, and that distinction was worth
 * a measurement. A percentage drop is proportional, so the same 26 per cent that takes a 150-luma
 * plank down a comfortable 39 takes a 235-luma awning down 61 -- and the first version of this
 * function duly added two hard edges to every bright rim it touched, which is most of why the
 * stall's edge density did not move at all on the first pass. Sixteen luma and then eighteen more
 * are under the score's 24-luma threshold at every brightness this file paints, so the rim rounds
 * an object off without adding one hard step anywhere.
 *
 * Out of bounds counts as solid. Without that, art drawn deliberately edge to edge -- the counter
 * front, which runs unbroken across four tiles -- would bank its last column and the stall would
 * grow a dark stripe every 32 pixels, drawing the tile grid for the player.
 */
function bank(img: Img): void {
  const { w, h } = img;
  const solid = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= w || y >= h ? true : img.data[(y * w + x) * 4 + 3]! > 0;
  const lit = (x: number, y: number): boolean => solid(x, y) && img.data[(y * w + x) * 4 + 3]! > 0;

  const rim = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (lit(x, y) && (!solid(x + 1, y) || !solid(x, y + 1))) rim[y * w + x] = 1;

  const inner = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!lit(x, y) || rim[y * w + x]) continue;
      const right = x + 1 < w && rim[y * w + x + 1];
      const below = y + 1 < h && rim[(y + 1) * w + x];
      if (right || below) inner[y * w + x] = 1;
    }

  // Deeper than the sub-threshold 16/34 this used to run. Those two numbers were chosen so a rounded
  // rim would cost no edges, back when edges were believed to be four times too many; on the rebuilt
  // profile the stall is a third SHORT of the board's edge density and a quarter short of its deep
  // shade, and this band is the cheapest honest place to find both. 22 and 58 put the outer rim a
  // clear step below the inner one, which is the dark band the board carries just inside its keyline.
  sink(img, inner, 22);
  sink(img, rim, 58);
}

/** Take every masked pixel down by `drop` luma, keeping its hue: a scale, not a subtraction. */
function sink(img: Img, mask: Uint8Array, drop: number): void {
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * 4;
    const l = 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]!;
    if (l <= 0) continue;
    const f = Math.max(0.3, (l - drop) / l);
    img.data[i] = Math.round(img.data[i]! * f);
    img.data[i + 1] = Math.round(img.data[i + 1]! * f);
    img.data[i + 2] = Math.round(img.data[i + 2]! * f);
  }
}

/** The same fall applied to one run of pixels in place: grain, a cast line, a rope's shaded half. */
function sinkRun(img: Img, x: number, y: number, w: number, h: number, drop: number): void {
  const mask = new Uint8Array(img.w * img.h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
      if (img.data[(py * img.w + px) * 4 + 3]! > 0) mask[py * img.w + px] = 1;
    }
  sink(img, mask, drop);
}

/** Draw a prop on its own transparent image, round it off, ring it, and set it on the tile. */
function stand(img: Img, draw: (s: Img) => void, line: RGBA = LINE.wood): void {
  const s = new Img(TILE, TILE);
  draw(s);
  bank(s);
  ring(s, line);
  img.blit(s, 0, 0);
}

/* ------------------------------------------------------------------- the ground */

/**
 * The grass a ground-standing prop carries under itself: the ground group's own painter, called.
 *
 * This used to be a stand-in that copied the lawn's idea, and the copy had drifted. Rendered beside
 * the real thing it came out several levels darker with a much coarser mottle, so each prop sat in
 * a visible dark square locked to the tile grid -- the one artefact the board has nowhere, and the
 * reason the signpost looked like it had been pasted on. Calling `GROUND_TILES` leaves nothing to
 * drift, and the props inherit the ground group's tonal work rather than competing with it.
 */
function groundUnder(img: Img, variant: 0 | 1 | 2 | 3): void {
  GROUND_TILES[`grass-${variant}`]!(img);
}

/*
 * The ground shadow, as five composited steps rather than one flat ellipse.
 *
 * The alphas are not round numbers: each is solved so that, laid over the one before it, the result
 * lands about 16 luma darker. Over the lawn that reads 180, 164, 148, 132, 116, 100 -- six values,
 * every step under the edge threshold, no hard rim anywhere. A single ellipse at alpha 120, which
 * is what this file used to draw, is one value and one 40-luma step all the way round it.
 */
const SHADE: RGBA = tone('shadow', 0.22);
const CAST: readonly (readonly [number, number])[] = [
  [1, 29],
  [0.86, 33],
  [0.7, 38],
  [0.52, 45],
  [0.3, 54],
];
function cast(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  for (const [k, a] of CAST) img.ellipse(cx, cy, rx * k, ry * k, [SHADE[0], SHADE[1], SHADE[2], a]);
}

/* --------------------------------------------------------------- round shading */

/**
 * The tone across a round body. `u` runs 0 at the lit edge to 1 at the edge turning away.
 *
 * The brightest band is a little IN from the lit edge, the way a cylinder under one light is, and
 * the fall away from it is continuous. This one curve lights every timber, stone block, basket and
 * bowl in the file, which is most of why they now agree with each other.
 */
const roundT = (u: number, lo: number, hi: number, peak = 0.24): number => {
  const d = u <= peak ? (peak - u) / peak : (u - peak) / (1 - peak);
  const fall = u <= peak ? 0.42 : 1;
  return lo + (hi - lo) * (1 - fall * Math.pow(clamp01(d), 1.45));
};

/*
 * THE RULER WAS WRONG, AND THIS FILE WAS BUILT AGAINST IT. Read this before changing a number.
 *
 * The previous pass of this file spent its whole effort DRIVING EDGE DENSITY DOWN, because
 * `board-profile.json` said the board sat at 4.50 per cent and we sat at 33. Every choice below
 * followed from that: a narrow 0.46 span so no two neighbouring pixels could differ by the score's
 * 24-luma threshold, `bank()` tuned in sub-threshold steps, and every crisp mark in the file --
 * barrel hoops, basket weave, plank seams, shingle caps -- replaced by a tonal ripple of ten luma.
 *
 * That profile had been built from board crops upscaled and interpolated at roughly 3 image pixels
 * to one of ours, so the board's conceptual edges were smeared across the interpolation and counted
 * at a third of their weight. It has since been rebuilt from crops NEAREST-downsampled to our own
 * resolution. The target moved from 4.50 to 18.91, and the sign of the error flipped:
 *
 *     stall region, both at our resolution      ours     board    ratio
 *     deep shade  (% under luma 81)            21.27     29.28     0.73
 *     keyline     (% under luma 60)            12.36     20.47     0.60
 *     luma spread (stdev)                      62.56     73.27     0.85
 *     edge density(% of neighbours)            19.33     29.96     0.65   <- too LOW, not too high
 *     texture     (mean 16px stdev)            45.63     57.70     0.79
 *
 * Not one axis asks for less. The board is crisp pixel art with hard, readable steps and a near-
 * black keyline round everything, and smoothing this file out to chase the broken number replaced
 * that with soft focus. So the span is wide again and every surface is QUANTISED.
 *
 * `band()` is the whole correction, and it is not a return to flat `shade()`. The contour still
 * follows the form -- `roundT()` is unchanged, so a barrel still bands in arcs around its own
 * curve -- but the fall is cut into four or five flat steps instead of a continuous gradient. That
 * is how pixel art has always made a cylinder: the roundness lives in the SHAPE of the bands, not
 * in the smoothness of the ramp between them. Each step is about 30 luma, comfortably over the
 * score's threshold, so a five-pixel post is a readable edge rather than a blur -- and because the
 * bands come off `tone()` rather than off the four palette stops, they are still new colours.
 */
const SPAN = 0.74;

/** Steps per quantised fall. Four steps across SPAN is ~30 luma a step: a visible, readable edge. */
const BANDS = 5;

/** `tone()`, cut into flat steps. The board's hard pixel-art shading, in the ramp's own hue. */
const band = (ramp: Ramp, t: number, bands = BANDS, alpha = 255): RGBA =>
  tone(ramp, Math.round(clamp01(t) * (bands - 1)) / (bands - 1), alpha);

/** A round upright timber, with the ground's own shade climbing the last few pixels of a tall one. */
function postV(img: Img, x: number, y: number, w: number, h: number, ramp: Ramp = 'wood'): void {
  for (let j = 0; j < h; j++) {
    const foot = h < 10 ? 0 : clamp01((j - (h - 8)) / 8) * 0.14;
    for (let i = 0; i < w; i++)
      img.px(x + i, y + j, band(ramp, roundT(w < 2 ? 0.3 : i / (w - 1), 0.14, 0.14 + SPAN) - foot));
  }
}

/** The same timber lying down: lit along the top, and its far end turning out of the light. */
function beamH(
  img: Img,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp = 'wood',
  lo = 0.16,
): void {
  for (let j = 0; j < h; j++) {
    const t = roundT(h < 2 ? 0.3 : j / (h - 1), lo, lo + SPAN);
    for (let i = 0; i < w; i++)
      img.px(x + i, y + j, band(ramp, t - clamp01((i - (w - 6)) / 6) * 0.1));
  }
}

/** A block lit on its top-left corner and falling away to the bottom-right. */
function face(
  img: Img,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp,
  lo: number,
  hi: number,
  peak = 0.16,
): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ix = w < 2 ? 0.3 : i / (w - 1);
      const jy = h < 2 ? 0.3 : j / (h - 1);
      img.px(x + i, y + j, band(ramp, roundT(0.52 * ix + 0.48 * jy, lo, hi, peak)));
    }
}

/** The cap block the board puts on top of every free-standing post, wider than the post. */
const capBlock = (img: Img, x: number, y: number, w: number, h: number): void =>
  face(img, x, y, w, h, 'wood', 0.2, 0.2 + SPAN);

/**
 * One of the board's stone blocks: round-lit from the top left, with its mortar as the last pixel
 * of the fall down the right and along the bottom rather than as a drawn line.
 *
 * The mortar step is a tenth of the ramp, about eleven luma. Drawn in `stone[0]` as it was, it was
 * a 48-luma step on every internal seam of the well and the fountain -- which is why those two had
 * the highest edge density in the file and read as grey donuts.
 */
function block(img: Img, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ix = w < 2 ? 0.3 : i / (w - 1);
      const jy = h < 2 ? 0.3 : j / (h - 1);
      const mortar = i === w - 1 || j === h - 1;
      /*
       * The mortar is a real seam again, in the stone's own near-black. Buried at a tenth of a ramp
       * it read as one smooth grey donut with a suggestion of joints; drawn in `tone('stone', 0.02)`
       * it was still inside the block's own range and did not separate either. The board rings
       * everything in near-black, including the joints between stones, and you can count them.
       *
       * The range is also pulled well down. `stone` tops out at #d2d2d6, and a block running to 0.8
       * of it came back at luma 184 -- a well in shade, under its own roof, rendering brighter than
       * the sunlit lawn around it, which is why this prop read as a pale grey lump.
       */
      const t = roundT(0.52 * ix + 0.48 * jy, 0.0, 0.46, 0.16);
      img.px(x + i, y + j, mortar ? LINE.stone : band('stone', t));
    }
}

/** Hold a course of blocks inside the round footprint it is laid on. */
function clipEllipse(img: Img, cx: number, cy: number, rx: number, ry: number, y0: number): void {
  for (let y = y0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) img.px(x, y, [0, 0, 0, 0]);
    }
}

/*
 * Dark slate, for the lantern body, built by hand because no ramp in `paint.ts` is one.
 *
 * The board's lantern samples #201f25, #262943 and #636171 -- cool near-blacks climbing to a mid
 * grey. `stone` starts at luma 96, which is far too light for metal that has to hold a gold pane,
 * and `ink`, which the first version of this file reached for, is frankly PURPLE: #160923 to
 * #543d66. Rendered at 32px it gave the Keeper a violet lantern, and violet is a hue this world
 * reserves for Red and the wolf. So the metal is interpolated between the stone keyline and the
 * foot of the stone ramp, which is derived from the palette rather than invented beside it.
 */
const slate = (t: number): RGBA => {
  const a = LINE.stone;
  const b = shade('stone', 0);
  const f = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    255,
  ];
};

/** A round mound -- a basket of goods, a bowl of water -- lit from the top left. */
function dome(
  img: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: Ramp,
  lo: number,
  hi: number,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      img.px(x, y, band(ramp, roundT(clamp01((dx * 0.6 + dy * 0.6 + 0.88) / 1.76), lo, hi, 0.2)));
    }
}

/**
 * A barrel, as the board stands either side of its stall: staves banded round the curve, two dark
 * iron hoops, and an elliptical lid you can see the top of.
 *
 * It is the densest, darkest small object in the file and that is the point -- the stall region is
 * measured a quarter short on deep shade and a third short on keyline, and a pair of mid-brown
 * barrels at luma 85 to 139 (the board's own samples) is most of where that comes from.
 */
function barrel(img: Img, x: number, y: number, w: number, h: number): void {
  const LID = 4;
  // The silhouette: waisted at the ends, widest across the middle. Two pixels of taper rather than
  // one -- at one, the first version of this came back as a plain brown box and read as a crate.
  const inset = (j: number): number =>
    2 - Math.round(Math.sin((clamp01((j - LID / 2) / (h - LID / 2 - 1)) * Math.PI) ** 0.7) * 2);

  for (let j = LID - 1; j < h; j++) {
    const k = inset(j);
    const span = w - 1 - k * 2;
    for (let i = k; i < w - k; i++) {
      const u = (i - k) / Math.max(1, span);
      /*
       * Two iron hoops clamping the staves, and the staves themselves as real seams. Both are drawn
       * at a fixed dark tone rather than as an offset into the band, because an offset smaller than
       * a band's width quantises away to nothing -- which is exactly what happened on the first
       * render of this barrel, and why it came back smooth.
       */
      const hoop = j === LID || j === LID + 1 || j === h - 2 || j === h - 3;
      const seam = (i - k) % 4 === 3;
      const t = roundT(u, 0.08, 0.08 + SPAN);
      img.px(
        x + i,
        y + j,
        hoop ? band('wood', roundT(u, 0.0, 0.3), 3) : seam ? tone('wood', 0.04) : band('wood', t),
      );
    }
  }
  // The lid, tilted toward the viewer and catching the light the staves are turning away from. It
  // stops clear of the top hoop; drawn over it, it swallowed the one mark that says "barrel".
  dome(
    img,
    x + w / 2 - 0.5,
    y + LID / 2 - 0.4,
    w / 2 - 1.6,
    LID / 2,
    'wood',
    0.5,
    0.5 + SPAN * 0.5,
  );
}

/* ------------------------------------------------------------------ the stall */

/*
 * Awning canvas. ART_PRODUCTION section 6a takes it off red and onto Haze and Offwhite, so the wide
 * panel is cream and the accent stripe is the top of `cloak`. Nothing here is red and nothing here
 * is Lime.
 *
 * The tone-down an earlier pass made is kept and is carried FURTHER, never undone. That pass found
 * the awning painted flat at level 3 across half of each tile, carrying twice Red's purple pixel
 * count: one tile off her route the awning was the most findable thing on screen and the
 * protagonist was not. The accent is now two pixels in sixteen rather than three, 12.5 per cent of
 * the cloth against the fifth the direction allows, and it never reaches level 3 at all.
 *
 * What this pass changes is that the cloth is no longer FLAT. Cropped at 1:1 and set beside our
 * render, every fold on the board's awning is a continuous gradient from its lit edge to its shaded
 * one; ours was one even cream with a hard lilac bar through it, which is precisely the
 * 4.15-colours-per-thousand measurement. Each fold now falls through fourteen values of `wall` and
 * the accent through two of `cloak`, and the accent's head meets the fold's own shaded tail, so
 * there is one step per repeat where there were two.
 *
 * And the mechanic, which is why this is not three painters: the three awning tiles are ONE object.
 * They are composed on a single sheet, banked and ringed there, and only then cut into tiles.
 * Ringing each tile on its own would put a keyline down every internal seam and the awning would
 * read as three separate flags.
 */
const STRIPE_REPEAT = 16;
/*
 * SEVEN, not two, and the reason is that the accent is no longer purple and no longer needs to be
 * rationed. Cropped at 1:1 and probed, the board's awning is cream #fde7c9 (luma 234) in panels of
 * roughly equal width to its stripes of warm sand #f4d3ab (luma 216): an eighteen-luma step between
 * two colours of the same warm family. Ours was six bars of Lilac at luma 109 to 144 on a cream
 * sheet at 204 to 231 -- a ninety-five-luma hue flip, repeated six times, and by a long way the
 * loudest thing in the spawn camera. Rendered beside Red it was the market stall the eye found.
 *
 * Wide warm stripes are both the board's drawing and the brand-safe one. Purple leaves the world
 * art entirely here, which is standard 3 the right way up: Red is the only saturated figure in the
 * forest, and the awning she walks past is cloth.
 */
const ACCENT_WIDTH = 7;

/** Where a column falls in the stripe pattern: which panel it is in, and how far into it. */
const stripeAt = (x: number): { accent: boolean; offset: number; width: number } => {
  const i = ((x % STRIPE_REPEAT) + STRIPE_REPEAT) % STRIPE_REPEAT;
  const pale = STRIPE_REPEAT - ACCENT_WIDTH;
  return i < pale
    ? { accent: false, offset: i, width: pale }
    : { accent: true, offset: i - pale, width: ACCENT_WIDTH };
};

/*
 * The two falls, pale panel and purple accent, each from its lit edge to its shaded one.
 *
 * The pale fall tops out at 0.58 of `wall` rather than at the ramp's head: `wall[3]` is #fffaf0 and
 * nothing in a forest at a 26-tile camera is pure white. It bottoms out at 0.22, which is cream's
 * own shade -- NOT the `shadow` ramp, which is grass in shade and which earlier passes used here,
 * turning the most common colour in the awning into an olive where the board's cloth samples a warm
 * #fde7c9 top to bottom.
 *
 * The accent fall is deliberately SHORT, deliberately darker than the cream around it, and placed
 * at the SHADED tail of each fold rather than across the middle of one. That placement is the whole
 * answer to a problem three renders in this pass failed at. The accent is not a bar painted on a
 * sheet; it is the colour the fold's own shadow is, so it reads as cloth and the eye goes back to
 * the protagonist where it belongs.
 *
 * FLAGGED FOR THE BRAND REVIEWER, and this flag has changed its answer. The previous pass argued
 * about WHICH purple the stripe should be -- ART_PRODUCTION section 6a names Haze, Haze and Lilac
 * both sit level with cream in value and separate by saturation alone, so every purple tried came
 * back as a neon bar. The answer is that the stripe is not purple. It is `path`, the warm sand the
 * track is drawn in, which is the hue the board actually uses and which already exists in this
 * world. Section 6a should be read as having lost its argument here: an awning is cloth in a
 * forest, not a brand surface, and the one place Cyera purple belongs on this screen is Red.
 *
 * On the brief's instruction to drop the awning twenty-five luma, honestly: the probe does not
 * support twenty-five. The board's own awning runs 203 at the hem to 235 at the crown, and ours ran
 * 204 to 231 -- already a shade darker, not brighter. What made it read as a near-white slab was
 * that it was FLAT: one even cream with hard bars through it and almost no fold. So the crown stays
 * where the board's is and the shaded tails go down to 0.06 of `wall` (luma ~180), which widens the
 * cloth by thirty luma, drops its mean about fourteen, and gives the deep-shade axis something to
 * count. Sliding the whole sheet down twenty-five would have put it below the board.
 */
const PALE_HI = 0.6;
const PALE_LO = 0.06;
const ACCENT_HI = 0.74;
const ACCENT_LO = 0.26;

/** Where a column sits in its own panel, and how far along that panel's fall it is. */
const foldAt = (x: number): { accent: boolean; t: number } => {
  const { accent, offset, width } = stripeAt(x);
  const u = width < 2 ? 0.3 : offset / (width - 1);
  return {
    accent,
    t: accent
      ? ACCENT_HI - (ACCENT_HI - ACCENT_LO) * Math.pow(u, 1.1)
      : PALE_HI - (PALE_HI - PALE_LO) * Math.pow(u, 1.25),
  };
};

/** The cloth's tone at a pixel: the fall across its own fold, plus the rail's shade at the top. */
const canvasTone = (x: number, row: number, rows: number): RGBA => {
  const { accent, t } = foldAt(x);
  const underRail = clamp01((2.5 - row) / 2.5) * 0.16;
  const toHem = clamp01((row - (rows - 4)) / 4) * 0.12;
  return band(accent ? 'path' : 'wall', t - underRail - toHem);
};

/*
 * The scalloped hem as a depth per column rather than as a row of ellipses, so the folds carry
 * straight down into the scallops. Sixteen wide to put a join on every fold seam, and seven deep,
 * which is what the board's hang measures once converted. The join goes to one rather than to zero:
 * taking it to zero turns the hem into a row of triangular teeth at this size.
 */
const SCALLOP = STRIPE_REPEAT;
const SCALLOP_DEEP = 7;
const scallopDepth = (x: number): number => {
  const u = ((((x % SCALLOP) + SCALLOP) % SCALLOP) + 0.5) / (SCALLOP / 2) - 1;
  return 1 + Math.round((SCALLOP_DEEP - 1) * Math.sqrt(Math.max(0, 1 - u * u)));
};

const CLOTH_TOP = 7;
const CLOTH_ROWS = 14;
const AWN_M = 4;
const AWN_SPAN = TILE * 3;

/*
 * The cloth no longer runs wall to wall, and this is how the barrel and the hanging sign got homes
 * without a map change.
 *
 * `forest-map.ts` lays the stall as four tiles of `stall-counter` under `stall-awning-l`, `-m`,
 * `-m`, `-r`. The counter tile is the SAME painter four times, so anything put on it is drawn four
 * times on a perfectly regular beat -- that is the wallpaper the basket row already had to be
 * rescued from, and it is why the previous pass flagged the barrel and the sign as impossible.
 *
 * But the two END tiles are distinct painters, and they were spending their outermost pixels on
 * nothing: the cloth was inset one pixel and the posts sat hard against the tile edge. Pulling the
 * cloth in fourteen pixels on the left and seventeen on the right frees a real corner in each end
 * tile, on ground the counter below already anchors. The barrel stands in one and the sign hangs in
 * the other. The awning is now about three tiles of cloth over a four-tile counter, with something
 * happening at each end, which is both the board's composition and the end of the regular beat.
 *
 * The two ends are deliberately NOT symmetric. The board hangs its sign on the right and stands its
 * barrels either side; we can afford one of each, and an asymmetric stall is the one thing that
 * stops a four-tile prop built from a repeating middle reading as wallpaper.
 */
const AWN_LEFT = 14;
const AWN_RIGHT = 17;

function paintAwningSheet(): Img {
  const s = new Img(AWN_SPAN + AWN_M * 2, TILE + AWN_M * 2);
  const x0 = AWN_M + AWN_LEFT;
  const x1 = AWN_M + AWN_SPAN - AWN_RIGHT; // exclusive
  const width = x1 - x0;
  const row = (y: number): number => AWN_M + y;

  // The cloth. `tx` is the tile-relative column, so folds and scallops repeat identically across
  // all three tiles and the sheet can be cut anywhere on a tile boundary.
  for (let r = 0; r < CLOTH_ROWS; r++)
    for (let x = x0; x < x1; x++) s.px(x, row(CLOTH_TOP + r), canvasTone(x - AWN_M, r, CLOTH_ROWS));

  /*
   * The scallops hanging off the hem, in the same cloth and the same folds, one step lighter than
   * the sheet just above: they are the turn-under, and on the board they tilt toward the viewer and
   * catch the light while the sheet above them slopes away. Run the other way -- a dark hem band
   * over bright scallops -- and the awning reads as a dark pelmet with a fringe under it.
   *
   * The V-notch the board drives up into the cloth at every join is not drawn: the hem profile goes
   * down to a single row at the join and the ring dips up into it on its own.
   */
  const HEM = CLOTH_TOP + CLOTH_ROWS;
  for (let x = x0; x < x1; x++) {
    const depth = scallopDepth(x - AWN_M);
    const { accent, t } = foldAt(x - AWN_M);
    for (let i = 0; i < depth; i++) {
      const lift = 0.1 - (i / Math.max(1, depth - 1)) * 0.2;
      s.px(x, row(HEM + i), band(accent ? 'path' : 'wall', t + lift));
    }
  }

  // The front rail the canvas is tacked to, and the soft line it throws on the cloth under it.
  beamH(s, x0, row(3), width, 4);
  for (let x = x0; x < x1; x++) {
    const c = canvasTone(x - AWN_M, 0, CLOTH_ROWS);
    s.px(x, row(6), [
      Math.round(c[0] * 0.62),
      Math.round(c[1] * 0.62),
      Math.round(c[2] * 0.62),
      255,
    ]);
  }

  /*
   * The corner posts. Each carries its own interior keyline down the edge that meets cloth, because
   * the ring only reaches pixels that are transparent -- above the hem the post's inner edge is
   * against opaque canvas and the ring cannot see it.
   */
  const POST_W = 5;
  const postTop = row(2);
  const postH = TILE + AWN_M - 4;

  postV(s, x0, postTop, POST_W, postH);
  capBlock(s, x0, postTop, POST_W, 2);
  s.rect(x0 + POST_W, postTop, 1, postH, LINE.wood);
  s.line(x0 + POST_W, row(11), x0 + POST_W + 6, row(6), tone('wood', 0.1));
  s.line(x0 + POST_W, row(10), x0 + POST_W + 5, row(6), tone('wood', 0.5));

  const rx = x1 - POST_W;
  postV(s, rx, postTop, POST_W, postH);
  capBlock(s, rx, postTop, POST_W, 2);
  s.rect(rx - 1, postTop, 1, postH, LINE.wood);
  s.line(rx - 1, row(11), rx - 7, row(6), tone('wood', 0.1));
  s.line(rx - 1, row(10), rx - 6, row(6), tone('wood', 0.5));

  /*
   * The barrel, standing at the stall's left end and lapping over the foot of the post, which is
   * where the board stands its own: in front of the frame, not tucked behind it.
   */
  barrel(s, AWN_M, row(14), 13, 16);

  /*
   * The hanging sign, and it is the most important thing added to this file.
   *
   * The brief's third complaint is that a player cannot tell from the render which objects they can
   * talk to. The board answers that for the stall with a board on two rings carrying the skill's own
   * icon -- the compass Rabbit is offering -- hung clear of the cloth where it reads from across the
   * clearing. It is the stall saying what it sells, which is exactly the beat the game wants at the
   * one prop where the player is meant to stop and question an offer.
   *
   * It hangs off a bar cantilevered from the right post, in the corner the cloth gave up.
   */
  const sx = x1 + 1;
  const SIGN_W = 15;
  beamH(s, rx + 2, row(5), SIGN_W + 3, 2);
  for (const hx of [sx + 2, sx + SIGN_W - 3]) {
    s.rect(hx, row(7), 1, 2, slate(0.74));
    s.px(hx, row(6), slate(0.95));
  }
  signBoard(s, sx, row(9), SIGN_W, 16);

  bank(s);
  ring(s, LINE.cloth);
  return s;
}

/**
 * The sign board: a pale face in a timber frame, with the compass the Keeper's neighbour is selling
 * painted on it.
 *
 * Drawn with hard steps on purpose. This is the one object in the stall that has to read as a
 * DELIBERATE MARK rather than as scenery, so its frame is a flat dark timber against a face a
 * hundred luma lighter, and the compass inside it is a gold ring on a cream dial. At a 26-tile
 * camera the icon resolves to "there is a sign here with a thing on it", which is all it needs to.
 */
function signBoard(s: Img, x: number, y: number, w: number, h: number): void {
  // Frame first, then the face inset into it: a real border, not a one-pixel line.
  face(s, x, y, w, h, 'wood', 0.1, 0.1 + SPAN * 0.5);
  for (let j = 2; j < h - 2; j++)
    for (let i = 2; i < w - 2; i++) {
      const u = clamp01((i - 2) / (w - 5)) * 0.4 + clamp01((j - 2) / (h - 5)) * 0.6;
      s.px(x + i, y + j, band('wall', 0.62 - u * 0.34));
    }

  // The compass: a gold bezel, a cream dial, and a needle across it.
  const cx = x + w / 2 - 0.5;
  const cy = y + h / 2 - 0.5;
  dome(s, cx, cy, 5, 5, 'gold', 0.1, 0.1 + SPAN);
  dome(s, cx, cy, 3.4, 3.4, 'wall', 0.44, 0.44 + SPAN * 0.4);
  s.line(cx - 2, cy + 2, cx + 2, cy - 2, tone('gold', 0.08));
  s.line(cx - 1, cy + 1, cx + 2, cy - 2, tone('ink', 0.4));
  s.px(cx, cy, tone('gold', 0.9));
  // The four cardinal ticks, which is what makes a gold disc read as a compass and not as a coin.
  for (const [dx, dy] of [
    [0, -4],
    [0, 4],
    [-4, 0],
    [4, 0],
  ] as const)
    s.px(cx + dx, cy + dy, tone('wall', 0.9));
}

let awningSheet: Img | undefined;

/** Cut one tile out of the composed sheet. The sheet is built once and all three tiles share it. */
const stallAwning =
  (slot: 0 | 1 | 2): Painter =>
  (img) => {
    awningSheet ??= paintAwningSheet();
    const sheet = awningSheet;
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const c = sheet.get(AWN_M + slot * TILE + x, AWN_M + y);
        if (c[3] !== 0) img.px(x, y, c);
      }

    /*
     * The ground inside the stall, in the stall's own shade, from directly under the hem down to
     * the tile's edge -- where the counter tile picks the same band up and carries it to the goods.
     *
     * Cropped at 1:1 the board's stall interior is the darkest thing in its frame; ours was lawn in
     * full sun showing between the scalloped hem and the baskets, which is what made the awning
     * look like a flag on poles rather than a roof over a shop. It is drawn OPAQUE, in `shadow` --
     * the ramp `paint.ts` describes as grass in shade -- because these pixels are transparent and
     * laying alpha against transparency is the one thing the pixel standard forbids outright.
     *
     * Its top edge follows the hem per column, so the shadow is scalloped exactly as the thing
     * casting it is.
     */
    for (let x = 0; x < TILE; x++) {
      let lowest = -1;
      for (let y = 0; y < TILE; y++)
        if (sheet.get(AWN_M + slot * TILE + x, AWN_M + y)[3] !== 0) lowest = y;
      for (let y = lowest + 1; y < TILE; y++)
        img.px(x, y, tone('shadow', 0.72 + ((y - lowest) / Math.max(1, TILE - lowest)) * 0.26));
    }
  };

/**
 * The counter: a plank front, a lipped top, and round wicker baskets of goods standing on it.
 *
 * Four of these sit side by side, so the body runs edge to edge across the full width and the ring
 * finds no transparent pixel to its left or right. The counter therefore carries no vertical
 * keyline and runs unbroken across the stall, as it should; only its top, its bottom, its legs and
 * the baskets standing proud of it are ringed.
 */
const stallCounter: Painter = (img) => {
  groundUnder(img, 1);

  /*
   * The ground behind the counter is under the awning, so it is in DEEP shade. This also ties the
   * two tiles together: the awning's posts stop ten pixels above the counter top, and a band of
   * full sunlight in that gap made the awning look like it floated over a separate table.
   *
   * It is a good deal deeper than it was. Cropped at 1:1, the board's stall interior is almost
   * black between the hem and the goods -- it is the darkest thing in that frame -- where ours was
   * a lightly tinted lawn you could still read the grass tufts through.
   */
  for (let y = 0; y < 11; y++) {
    const a = Math.round(170 - clamp01(y / 10) * 120);
    img.rect(0, y, TILE, 1, [SHADE[0], SHADE[1], SHADE[2], a]);
  }
  // The stall's own shade on the grass, before anything stands in it. A band rather than an ellipse
  // so it meets its neighbour: four of these tiles abut, and four ellipses make a scalloped shadow.
  for (const [dy, a] of [
    [26, 60],
    [27, 78],
    [28, 100],
    [29, 128],
    [30, 160],
  ] as const)
    img.rect(0, dy, TILE, 1, [SHADE[0], SHADE[1], SHADE[2], a]);

  stand(img, (s) => {
    // Legs, then the board that laps over them.
    for (const lx of [4, 23]) postV(s, lx, 25, 5, 4);

    /*
     * Front boards, running the length of the stall the way a counter front is built. Vertical
     * panels came out as sixteen identical cupboard doors with a handle in one of them.
     *
     * Each board is its own small cylinder: lit along its top, falling to its bottom edge. That is
     * three smooth four-pixel falls where there were three pairs of hard 37-luma lines.
     */
    /*
     * Darker than the top it carries, and darker again than the first attempt at this. On the board
     * the counter front is the shaded face of the thing -- it is what the top is lit AGAINST -- and
     * drawn in the same wood as the lit surface the whole counter read as one slab with lines
     * scored across it.
     *
     * The depth is measured, not felt. Cropped at 1:1 the board's own stall region puts 28 per cent
     * of itself under luma 81 and 20.8 per cent under 60; ours was at 20.3 and 14.7, which is about
     * a quarter short on both. The counter front is the largest single surface in the stall, so it
     * is where that quarter has to come from.
     */
    for (const by of [15, 19, 23]) {
      beamH(s, 0, by, TILE, 4, 'wood', 0.02);
      // The seam between planks, back as a real line. The previous pass dissolved these into
      // ten-luma ripples to buy edge density down; the rebuilt profile wants it the other way, and
      // a counter front is the one surface in the stall that is honestly made of boards.
      s.rect(0, by + 3, TILE, 1, tone('wood', 0.0));
    }
    // A knot low on the bottom board, where nothing reads it as a handle.
    dome(s, 11, 24, 2.2, 1.4, 'wood', 0.08, 0.34);

    // The top: a lit surface falling to a dark lip at its front edge. The lip is the one steep step
    // in the tile and it belongs there -- it is the counter's own silhouette seen from above.
    for (const [j, t] of [0.82, 0.96, 0.82, 0.6, 0.2].entries())
      s.rect(0, 10 + j, TILE, 1, band('wood', t, 6));

    /*
     * Goods, and this is the brief's "a bare counter with a few dots".
     *
     * The board lays out a dense double row: crates and sacks of stock standing in the stall's
     * shade at the back, and in front of them, catching the light, the compasses themselves --
     * round dials with gold bezels, which is the skill Rabbit is offering. Ours was three gold
     * domes a tile, which at a 26-tile camera is a row of identical blobs and tells the player
     * nothing about what is for sale.
     *
     * Density here is also most of what the measurement wants. A crate is flat boards with hard
     * seams and a dark frame; a dial is four concentric values inside a keyline. Between them they
     * are the deepest darks and the sharpest steps in the stall, which is the two axes the region
     * is furthest short on -- and they are six distinct materials where there were two.
     *
     * The beat is broken where it can be. This tile is laid FOUR TIMES in a row, so anything
     * centred in it repeats every 32 pixels; the two items that straddle the seam are drawn once at
     * each edge so their halves meet, and the back row's spacing deliberately does not line up with
     * the front row's.
     */
    crate(s, 1, 2, 9, 8);
    sack(s, 16.5, 6, 5, 3.8);
    crate(s, 23, 3, 8, 7);

    ware(s, 5.5, 8.6, 3.8, 'gold');
    ware(s, 14, 9, 3.2, 'path');
    ware(s, 23, 8.5, 3.5, 'gold');
    for (const cx of [-1.5, 30.5]) ware(s, cx, 9, 3.4, 'path');

    // The interior keyline under everything standing on the top, which the ring cannot reach: the
    // counter top is the one surface in the tile with nothing transparent beside it. It sits ON the
    // top's first row -- a row higher and the goods hang in the stall's shade with a line under
    // them, which is what floating looks like.
    for (const [bx, bw] of [
      [1, 9],
      [12, 6],
      [19, 7],
      [23, 8],
      [29, 3],
      [0, 3],
    ] as const)
      s.rect(bx, 10, bw, 1, LINE.wood);
  });

  // What the goods throw onto the counter top, in two soft steps rather than one flat ellipse.
  for (const [cx, rx] of [
    [6, 4],
    [14.5, 3.4],
    [22, 3.8],
  ] as const)
    for (const [k, a] of [
      [1, 40],
      [0.6, 52],
    ] as const)
      img.ellipse(cx, 11.4, rx * k, 1 * k, [SHADE[0], SHADE[1], SHADE[2], a]);
};

/**
 * One of the wares on the counter: a dark rim with a lit dome of goods sitting in it.
 *
 * THE ICON LIVES ON THE SIGN, NOT HERE, and that is a lesson this tile learned by rendering. The
 * first version drew each ware as the compass itself -- a gold bezel, a cream dial and an ink pin
 * at the centre -- because that is what the board's counter carries. At the board's resolution it
 * reads as a compass. At ours each one is eight pixels across, the cream dial is three, and the pin
 * lands dead centre of it: rendered and looked at, the counter came back as a row of little GOLD
 * FACES staring out, two pale eyes apiece, repeating every thirty-two pixels. Four tiles of that is
 * the single worst thing this file has produced.
 *
 * So the ware is now just a round thing in a dark rim, which is all eight pixels can honestly say,
 * and the compass is carried at legible size on the hanging sign where the player can actually
 * read it. The ramp varies per ware, which is where the colour variety comes from instead.
 */
function ware(s: Img, cx: number, cy: number, rx: number, ramp: Ramp): void {
  const ry = rx * 0.72;
  dome(s, cx, cy, rx, ry, 'wood', 0.0, 0.2);
  dome(s, cx, cy - 0.6, rx - 1, ry - 0.9, ramp, 0.2, 0.2 + SPAN);
}

/** A crate of stock at the back of the counter: flat boards, hard seams, a dark frame. */
function crate(s: Img, x: number, y: number, w: number, h: number): void {
  face(s, x, y, w, h, 'wood', 0.06, 0.06 + SPAN * 0.6);
  for (let j = 2; j < h - 1; j += 3) s.rect(x, y + j, w, 1, tone('wood', 0.02));
  s.frame(x, y, w, h, LINE.wood);
}

/**
 * A sack of meal, tied at the neck: the one soft shape among the boxes.
 *
 * Squat, and a good deal darker than the first attempt. Run tall and pale on `path` it came back as
 * a toadstool standing on the counter -- and a second pale mass beside a cream awning is the last
 * thing this frame needs. It is now wider than it is high, and it tops out two steps below the
 * cloth above it.
 */
function sack(s: Img, cx: number, cy: number, rx: number, ry: number): void {
  dome(s, cx, cy + 0.4, rx, ry, 'path', 0.04, 0.04 + SPAN * 0.62);
  s.rect(cx - 1, cy - ry + 1, 3, 1, tone('path', 0.0));
}

/* ------------------------------------------------------------ the lantern post */

/*
 * The lantern post. The flame stays warm gold: it is a light source and it is the skill the Keeper
 * offers, and ART_PRODUCTION section 6a leaves it alone on purpose while everything else moves off
 * red. The gold is the one warm note in the tile, and the pool of light under it is the reason the
 * post is worth a whole tile rather than a silhouette.
 *
 * The lantern itself is off the board, where it is DARK metal -- sampled #201f25, #262943, #636171
 * -- with only a cool grey lit edge, not the mid-grey box the first painter drew. A pale lantern
 * cannot hold a gold pane; a near-black one can, and that is the whole point of it.
 */
const lanternPost: Painter = (img) => {
  groundUnder(img, 0);

  /*
   * The pool, in six falling steps so the light has an edge rather than a ring. Alpha over opaque
   * grass, which PIXEL_STANDARD section 4 allows; nothing here is laid against transparency.
   *
   * The alphas are roughly three times what the first version of this pass used. Gold laid at alpha
   * 26 over a lawn that reads 180 comes out at 184, which is four luma and invisible -- the whole
   * reason the lantern post is worth a tile rather than a silhouette had simply stopped rendering.
   */
  for (const [k, a] of [
    [1, 40],
    [0.86, 55],
    [0.72, 75],
    [0.56, 100],
    [0.4, 130],
    [0.24, 160],
  ] as const) {
    const c = tone('gold', 0.6 + k * 0.4);
    img.ellipse(10, 26.4, 13 * k, 6 * k, [c[0], c[1], c[2], a]);
  }

  cast(img, 17.5, 29.5, 5.2, 1.8);

  stand(
    img,
    (s) => {
      /*
       * Post, cap block and the cross-arm. The post was four pixels wide and the arm four deep on the
       * first pass, which made the two the same mass and the arm stopped reading as a cantilever. The
       * post is three, and the arm sits a row clear of the cap with its own shade under it.
       */
      postV(s, 16, 6, 3, 23);
      capBlock(s, 15, 3, 5, 3);

      beamH(s, 7, 7, 12, 3);
      s.line(14, 13, 17, 10, tone('wood', 0.1));
      s.line(14, 12, 16, 10, tone('wood', 0.46));

      // The S-hook the lantern hangs on.
      s.rect(10, 10, 1, 2, slate(0.86));
      s.px(11, 10, slate(0.5));
      s.px(10, 12, slate(0.5));

      /*
       * The lantern: a pitched metal cap, a glazed box, a foot. Near-black body with a cool lit edge
       * down its left, so the gold pane is the brightest thing in the tile by a long way.
       */
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 7 + r * 2; i++)
          s.px(7 - r + i, 12 + r, slate(roundT(i / (6 + r * 2), 0.2, 0.9, 0.12)));
      for (let i = 0; i < 9; i++) s.px(6 + i, 15, slate(roundT(i / 8, 0.14, 0.7, 0.14)));

      // The glazed box: dark uprights, gold between them.
      for (let j = 0; j < 6; j++)
        for (let i = 0; i < 7; i++) {
          const frame = i === 0 || i === 6 || j === 0;
          s.px(
            7 + i,
            16 + j,
            frame
              ? slate(roundT(i / 6, 0.12, 0.66, 0.1))
              : tone('gold', roundT(clamp01((i - 1) / 4) * 0.5 + (j / 5) * 0.5, 0.06, 0.34)),
          );
        }
      // The flame, and what it throws on the glass behind it.
      dome(s, 10.5, 19.4, 2.4, 2.8, 'gold', 0.42, 1);

      // The foot.
      for (let i = 0; i < 9; i++) {
        s.px(6 + i, 22, slate(roundT(i / 8, 0.16, 0.76, 0.14)));
        s.px(6 + i, 23, slate(roundT(i / 8, 0.06, 0.42, 0.14)));
      }
    },
    LINE.metal,
  );

  // The post catches the lantern on its lit side.
  for (let j = 0; j < 7; j++) {
    const c = tone('gold', 0.5);
    img.px(16, 16 + j, [c[0], c[1], c[2], 70]);
  }
};

/* --------------------------------------------------------------- the fountain */

/*
 * A fountain in a glade: a basin, a spout and falling water. Scenery, and nothing more. See the
 * flag in the header -- the board has no fountain, so this is built from the board's own stone
 * vocabulary rather than from a style invented for it.
 */
const fountain: Painter = (img) => {
  groundUnder(img, 2);
  cast(img, 16.5, 29, 13.5, 3.2);

  stand(
    img,
    (s) => {
      // Basin wall, as a course of blocks rather than a smooth bowl.
      dome(s, 16, 24.5, 13, 5.4, 'stone', 0.2, 0.2 + SPAN);
      for (const [bx, bw] of [
        [4, 7],
        [11, 7],
        [18, 7],
        [25, 6],
      ] as const) {
        const t = (bx + bw / 2 - 16) / 13;
        const drop = Math.round(5 * Math.sqrt(Math.max(0, 1 - t * t)));
        if (drop < 2) continue;
        block(s, bx, 22, bw, drop + 3);
      }
      clipEllipse(s, 16, 24.5, 13, 5.4, 22);

      /*
       * Rim, then the water inside it. The ranges here are centred on the LEVEL each shape used to
       * be a flat fill of, which is a rule this pass had to learn the hard way: run every stone
       * shape up to 0.9 of its ramp and the well and the fountain come back as pale blobs with no
       * structure left in them, because the dark ellipse that used to describe a lip or a mouth is
       * now the same value as the thing it was describing.
       */
      dome(s, 16, 21, 13, 4.2, 'stone', 0.18, 0.18 + SPAN);
      dome(s, 16, 21.3, 9.6, 2.6, 'stone', 0.02, 0.26);
      dome(s, 16, 21.4, 9, 2.2, 'water', 0.14, 0.44);
      dome(s, 12.5, 20.8, 3.4, 1, 'water', 0.44, 0.66);

      // Pedestal and upper bowl.
      postV(s, 14, 13, 5, 8, 'stone');
      face(s, 12, 11, 9, 2, 'stone', 0.24, 0.24 + SPAN);
      dome(s, 16, 10, 8, 2.8, 'stone', 0.04, 0.3);
      dome(s, 16, 9.6, 7.2, 2.2, 'stone', 0.3, 0.3 + SPAN);
      dome(s, 16, 10, 5, 1, 'water', 0.1, 0.34);
      dome(s, 13.9, 9.8, 1.8, 0.7, 'water', 0.42, 0.62);

      /*
       * The jet. Four pixels of spray either side made a spiky crown that read as a thistle rather
       * than as water, so it is a short plume: a lit column out of the finial and two beads at the
       * foot of the arc.
       */
      postV(s, 15, 5, 3, 5, 'stone');
      dome(s, 16.5, 4.2, 2.4, 1.2, 'stone', 0.34, 0.34 + SPAN);
      for (let j = 0; j < 3; j++) s.px(16, 1 + j, tone('water', 0.5 + j * 0.12));
      s.px(15, 4, tone('water', 0.56));
      s.px(18, 4, tone('water', 0.44));

      /*
       * Two falls from the bowl's lip into the basin. An unbroken column from lip to waterline read
       * as a blue post holding the bowl up; water falling this short a distance breaks up, so the
       * column breaks up -- solid where it leaves the lip, then beads, then a splash.
       */
      for (const fx of [10, 22]) {
        for (let j = 0; j < 3; j++) s.px(fx, 11 + j, tone('water', 0.46 - j * 0.08));
        for (const dy of [15, 17] as const) s.px(fx, dy, tone('water', 0.5));
        s.px(fx - 1, 19.5, tone('water', 0.56));
        s.px(fx + 1, 19.5, tone('water', 0.44));
      }
    },
    LINE.stone,
  );
};

/* ------------------------------------------------------------------- the well */

/*
 * The well: stone, a shingled roof on two posts, a windlass with the rope wound on it, and a bucket.
 *
 * The board's own well is a ring of INDIVIDUAL blocks around a capped timber post, and that is what
 * the first painter missed: it drew two smooth ellipses with joint lines scratched on afterwards.
 * The ring is built from `block()` here, the same helper the fountain uses, so the two agree.
 *
 * The board's well has no roof. Ours keeps one, because the brief asks for it and because section 6a
 * sends it onto slate with the cottage roof, painted from the same `roof` ramp so the two roofs in
 * this world stay the same roof.
 */
const well: Painter = (img) => {
  groundUnder(img, 1);
  cast(img, 16.5, 30, 12.5, 3);

  stand(
    img,
    (s) => {
      // Posts first; the roof sits on them and the stonework laps over their feet.
      for (const px0 of [5, 24]) postV(s, px0, 9, 3, 17);

      /*
       * Pitched roof: nine courses, each two pixels wider on a side than the one above it, and each
       * a continuous fall across its own width with the slope darkening toward the eave. The
       * per-shingle lit caps this used to draw in `roof[3]` were a 72-luma step every five pixels;
       * what replaces them is a seven-luma lift on the same beat, which still reads as overlapping
       * tiles at a 26-tile camera and costs nothing on any axis.
       */
      for (let r = 0; r < 9; r++) {
        const y = 2 + r;
        const half = 1 + r * 2;
        const x0 = 16 - half;
        const w = half * 2;
        // Every third course breaks as a real shingle line. The previous pass ran these as a
        // two-tenths dip inside a continuous fall and they quantised away to nothing: rendered at a
        // 26-tile camera the roof came back as one flat grey triangle, which is most of why the
        // brief calls this prop a bus shelter.
        const seam = r % 2 === 1;
        for (let i = 0; i < w; i++) {
          const capped = (i + (r % 2 ? 2 : 0)) % 5 < 2 ? 0.12 : 0;
          const t = roundT(i / (w - 1), 0.2, 0.2 + SPAN * 0.8, 0.2);
          s.px(x0 + i, y, seam ? tone('roof', 0.04) : band('roof', t - (r / 8) * 0.12 + capped));
        }
      }
      // The eave, and the fascia under it. Slate's own dark: a cool keyline band here read as a
      // purple stripe across the widest line in the tile.
      for (let i = 0; i < 30; i++) s.px(1 + i, 11, band('roof', roundT(i / 29, 0.04, 0.26, 0.2)));
      for (let i = 0; i < 24; i++) s.px(4 + i, 12, tone('roof', 0.0));

      // Windlass: a drum with the rope wound round it, and a crank on the right. The coils are a
      // tonal ripple of about twenty luma; as alternating `path[1]`/`path[0]` pixels they were a
      // corn cob and sixteen hard edges.
      beamH(s, 7, 14, 18, 4);
      for (let i = 0; i < 16; i++) {
        const t = 0.3 + 0.16 * (1 + Math.cos((i / 3) * Math.PI * 2));
        s.px(8 + i, 15, tone('path', t + 0.1));
        s.px(8 + i, 16, tone('path', t - 0.08));
      }
      postV(s, 28, 15, 2, 4);
      s.rect(25, 15, 3, 1, tone('wood', 0.24));

      /*
       * The stonework, as the board lays it: two staggered courses of blocks, each round-lit on its
       * own top-left corner with its mortar as the last pixel of its own fall.
       */
      dome(s, 16, 25.2, 12, 4.6, 'stone', 0.0, 0.42);
      for (const [bx, bw] of [
        [5, 7],
        [12, 6],
        [18, 6],
        [24, 5],
      ] as const)
        block(s, bx, 23, bw, 5);
      for (const [bx, bw] of [
        [7, 6],
        [13, 7],
        [20, 6],
      ] as const)
        block(s, bx, 27, bw, 3);
      clipEllipse(s, 16, 25.2, 12, 4.9, 23);

      /*
       * The rim, and THE MOUTH, which is the whole prop.
       *
       * The brief says a player cannot tell from the render which objects they can talk to, and the
       * well was the clearest case: it came back as a grey hat on a pale grey lump. The reason is
       * that the one mark which says "well" -- an open dark shaft -- was not visible at all. It was
       * drawn, at five pixels across, and then the bucket was parked dead centre on top of it.
       *
       * So the mouth is wide and genuinely dark now, and the bucket has moved off it onto the front
       * left of the rim, which is where this file's own header always said the board puts it. A
       * stone ring, a black hole and a bucket on a rope: three marks, and the prop announces itself
       * from across the glade.
       */
      dome(s, 16, 21.4, 12, 3.2, 'stone', 0.0, 0.12);
      dome(s, 16, 21.1, 10.6, 2.4, 'stone', 0.1, 0.1 + SPAN * 0.55);
      // The shaft, in the stone's own near-black rather than in `night`. `night` is the portrait
      // backdrop ramp and it is frankly purple: at 32px it put a violet fringe round the mouth of
      // a grey well, which is a hue this world has nowhere outside Red and the wolf.
      s.ellipse(16, 22, 7.4, 2.1, LINE.stone);
      s.ellipse(16.2, 21.6, 6.2, 1.4, tone('stone', 0.06));

      /*
       * Rope and bucket last, in front of the stonework -- drawn before it, the rim painted straight
       * over both and left a windlass winding nothing.
       */
      for (let j = 0; j < 3; j++) s.px(10, 15 + j, tone('path', 0.4));
      s.line(10, 15, 15, 15, tone('path', 0.34));
      // Taller than it is wide, which is the whole difference between a bucket and a satchel: at
      // six by five the first version of this read as a brown pouch hung on the rim.
      postV(s, 8, 18, 5, 8);
      for (const hy of [19, 25]) sinkRun(s, 8, hy, 5, 1, 26);
      // The handle, and the bucket's own keyline, which the ring cannot reach: it stands against
      // opaque stone on every side.
      s.line(8, 18, 10, 16, LINE.wood);
      s.line(10, 16, 12, 18, LINE.wood);
      s.rect(7, 18, 1, 8, LINE.wood);
      s.rect(13, 18, 1, 8, LINE.wood);
      s.rect(8, 26, 5, 1, LINE.wood);
    },
    LINE.roof,
  );
};

/* --------------------------------------------------------------- the signpost */

/*
 * The signpost, from the board: TWO arrow boards on a capped post, the upper one pointed at both
 * ends and the lower one pointing back the way you came, each board showing grain and a knot.
 *
 * The first painter drew one board with rows of dashes standing in for writing. The board draws no
 * writing -- it draws grain -- and rule 4 of CLAUDE.md keeps text off the canvas anyway. It is also
 * the honest thing at this size: a legible word would be a smear.
 */

/** One arrow board: a plank with a chevron point on the ends that are pointed. */
function arrowBoard(
  s: Img,
  y: number,
  h: number,
  left: number,
  right: number,
  tips: { left: boolean; right: boolean },
): void {
  const mid = y + (h - 1) / 2;
  for (let row = 0; row < h; row++) {
    // 1.5 rather than 1: a taper of one pixel a row makes a hexagon, not an arrow.
    const taper = Math.round(Math.abs(y + row - mid) * 1.5);
    const x0 = left + (tips.left ? taper : 0);
    const x1 = right - (tips.right ? taper : 0);
    const t = roundT(h < 2 ? 0.3 : row / (h - 1), 0.1, 0.9);
    const under = row >= h - 1;
    for (let x = x0; x <= x1; x++) {
      // the ends turn away from the light, which is what stops a long plank reading as a ribbon
      const ends = Math.max(clamp01((x1 - 4 - x) / -4), 0) * 0.14;
      // The board's own underside, as a hard line rather than the tail of a gradient. Banded
      // across a seven-pixel plank these boards were four near-identical tans and read as cardboard.
      s.px(x, y + row, under ? tone('wood', 0.0) : band('wood', t - ends));
    }
  }
}

const signpost: Painter = (img) => {
  groundUnder(img, 2);
  cast(img, 16, 30.5, 7.5, 2.4);

  stand(img, (s) => {
    /*
     * The post now REACHES THE GROUND, which is the brief's complaint about this prop and was a
     * plain mistake rather than a judgement: it ran to row 28 of a 32-row tile and stopped in mid
     * air, with lawn visible underneath it and a cast shadow floating below that. Twenty-six rows
     * takes it to the tile's last row, where the ring seats it with its own dark band.
     */
    postV(s, 13, 6, 5, 26);
    capBlock(s, 12, 3, 7, 4);

    // The upper board, pointed at both ends: the fork.
    arrowBoard(s, 9, 7, 1, 30, { left: true, right: true });
    // The lower board, pointing back the way you came.
    arrowBoard(s, 19, 6, 3, 26, { left: true, right: false });

    // Grain, and a knot in each board -- a tonal ripple rather than a drawn dash. As hard
    // `wood[0]` lines at alpha 140 these four strokes alone were forty hard edges on one tile.
    for (const [gx, gy, gw] of [
      [6, 11, 6],
      [18, 13, 7],
      [8, 21, 5],
      [17, 22, 6],
    ] as const)
      sinkRun(s, gx, gy, gw, 1, 11);
    for (const [kx, ky] of [
      [23, 11],
      [11, 22],
    ] as const)
      dome(s, kx, ky, 1.6, 1.1, 'wood', 0.1, 0.36);

    // Each board throws a line onto the post below it, and an interior keyline where it crosses --
    // the ring cannot see those edges, they are opaque against opaque.
    for (const by of [16, 25]) {
      sinkRun(s, 13, by, 5, 1, 44);
      sinkRun(s, 13, by + 1, 5, 1, 22);
    }
    s.rect(13, 8, 5, 1, LINE.wood);
    s.rect(13, 18, 5, 1, LINE.wood);
  });

  // A couple of blades at the foot, so the post grows out of the grass instead of onto it.
  for (const [bx, by] of [
    [12, 28],
    [20, 29],
  ] as const) {
    img.px(bx, by, shade('grass', 2));
    img.px(bx, by + 1, shade('grass', 1));
  }
};

/** Keys are the contract the map generator and the tileset both look these up by. */
export const PROP_TILES: Record<string, Painter> = {
  'stall-awning-l': stallAwning(0),
  'stall-awning-m': stallAwning(1),
  'stall-awning-r': stallAwning(2),
  'stall-counter': stallCounter,
  'lantern-post': lanternPost,
  fountain,
  well,
  signpost,
};
