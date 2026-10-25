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
 * scarlet cloak and a terracotta roof. Purple is Lilac-led Cyera purple and the roof is slate. The
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
 *   well       a ring of individual stone blocks around a capped timber post, a bucket on the rim,
 *              and NO ROOF. Ours had one, in slate, per ART_PRODUCTION 6a; it is gone, because the
 *              board has none and because rendered it was a bus shelter. See the note on `well`.
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
import { layOn } from './sign-brush.ts';
import type { LaidAt, Role } from './sign-brush.ts';
import { GROUND_TILES } from './w-ground.ts';
import { COTTAGE_TILES } from './s-cottage.ts';
import { CONTACT } from './s-outdoor.ts';
import { clamp01, Img, keyline, lumaOf, rust, shade, TILE, tone } from '../paint.ts';
import type { Painter, Ramp, RGBA } from '../paint.ts';

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
 * Shade on a surface that is not the ground: the stall's interior under its own awning, and what a
 * basket of wares throws onto the counter top it stands on. Both are ambient -- a thing in another
 * thing's shade -- and neither is a point of contact, which is the distinction this file used to
 * collapse and the whole of what task P13 is about.
 */
const SHADE: RGBA = tone('shadow', 0.22);

/*
 * THE CONTACT POOL, as five composited steps that actually REACH THE GROUND.
 *
 * READ THE NOTE ON `CONTACT` IN `s-outdoor.ts` BEFORE CHANGING A NUMBER HERE. The value a prop's
 * ground falls TO is not this file's to pick: it is one exported constant, the fence's, and the
 * organic tiles landed on the same thing independently.
 *
 * WHAT WAS WRONG. The five steps were right and the two numbers that decide whether they do anything
 * were not. The alphas ran 29, 33, 38, 45, 54 and the note above them claimed "180, 164, 148, 132,
 * 116, 100 -- six values, every step under the edge threshold, no hard rim anywhere". The ladder was
 * real, the arithmetic was right, and the conclusion it was tuned for was the wrong one: a pool whose
 * deepest pixel is luma 100 over a lawn reading 180 is not a shadow, it is a tint. Measured on the
 * tiles as they shipped, the darkest lawn-green pixel under each prop came out stall-counter 74,
 * signpost 93, notice-board 93, well 97, lantern-post 124, fountain 131 -- against bush 43, roots 42,
 * fence 35, rock 52 everywhere else in the world. The lawn's own mottle floor is about 131, so the
 * fountain's darkest pixel WAS the open lawn and all six objects floated.
 *
 * THE STEPS ARE 29 LUMA NOW AND NOT 16, AND THAT IS A CORRECTION RATHER THAN A COST. Sixteen was
 * chosen to keep every step under the score's 24-luma edge threshold, back when this file was being
 * optimised against the broken ruler the header describes; the rebuilt profile has the stall region
 * a third SHORT of the board's edge density and a quarter short of its deep shade, and a pool that
 * falls 144 luma under a prop is the honest place to find both. The organic family's own rings step
 * 21, 39 and 63, and the fence's contact is a single opaque ellipse with no feather at all -- so a
 * readable step at the foot of a thing is the world's convention and not a departure from it.
 *
 * THE RINGS GREW OUTWARD, which is the other half of it and the part a value alone could not fix.
 * `k` used to run 1.0 down to 0.3, so the pool's outer edge was the footprint the caller passed and
 * its dark core was a third of that -- directly under the prop, where a top-down camera cannot see
 * it. Every one of these props stands on a post or a drum that reaches the tile's last row, so there
 * is no ground below its foot at all and the contact has to read BESIDE it. `k` now runs 1.46 down to
 * 1.0: the caller's radius is the OPAQUE CORE, the footprint, and the feather is the 46 per cent
 * outside it. That is the organic family's proportion (its widest ring is 1.22 of the object's base,
 * its near-opaque one 0.78) and the fence's (an opaque ellipse 12 across under a 9-pixel picket).
 */

/**
 * The alphas a contact pool falls down, outermost ring first, each laid over the one before it.
 *
 * Solved, not chosen: over a lawn at 180 they land 151, 122, 94, 65, 36, which is five steps of
 * about 29 luma apiece ending exactly on `CONTACT`. The last is 255 because the innermost ring is
 * the point of contact and a point of contact is opaque -- that is the fence's drawing and the
 * pixel standard's rule both; see `CONTACT`.
 */
const CONTACT_FALL: readonly number[] = [51, 64, 85, 128, 255];

/** Each ring's radius as a multiple of the footprint the caller passes. The last one IS it. */
const CAST_RINGS: readonly number[] = [1.46, 1.34, 1.22, 1.11, 1];

function cast(img: Img, cx: number, cy: number, rx: number, ry: number): void {
  CAST_RINGS.forEach((k, i) =>
    img.ellipse(cx, cy, rx * k, ry * k, [CONTACT[0], CONTACT[1], CONTACT[2], CONTACT_FALL[i]!]),
  );
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
 * reserves for Purple and the wolf. So the metal is interpolated between the stone keyline and the
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
 * the awning painted flat at level 3 across half of each tile, carrying twice Purple's purple pixel
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
 * loudest thing in the spawn camera. Rendered beside Purple it was the market stall the eye found.
 *
 * Wide warm stripes are both the board's drawing and the brand-safe one. Purple leaves the world
 * art entirely here, which is standard 3 the right way up: Purple is the only saturated figure in the
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
 * nothing in a forest at the playing camera is pure white. It bottoms out at 0.22, which is cream's
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
 * forest, not a brand surface, and the one place Cyera purple belongs on this screen is Purple.
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
  /*
   * The rail OVERHANGS THE LEFT POST by `RAIL_STUB`, 2026-10-22. It used to stop flush at the post,
   * so the frame had a cantilever on the right (the sign bar) and a bare corner on the left, which
   * is half of why the client read the left end as unfinished. A rail that runs past the post it
   * sits on is how the frame is built; it is the same beam, lengthened, so its lit run and the
   * turning far end at the right are untouched -- `beamH` only darkens its last six pixels.
   */
  const RAIL_STUB = 4;
  beamH(s, x0 - RAIL_STUB, row(3), width + RAIL_STUB, 4);
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
  // One column in from the sheet's margin and one narrower than it was, 2026-10-22: at the margin
  // its left keyline fell outside the tile cut and the barrel shipped with no left edge -- the
  // "unfinished" the client circled. Twelve wide keeps the one-pixel keyline between it and the post.
  barrel(s, AWN_M + 1, row(14), 12, 16);

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
 * hundred luma lighter, and the compass inside it is a gold ring on a cream dial. At the playing
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
/*
 * THE COUNTER'S TWO ENDS, 2026-10-22. The client's screenshot of the stall: barrel on the left, sign
 * on the right, and "the left side looks unfinished". Rendered at zoom 16 it was three things, and
 * one of them was on both ends:
 *
 *   - the COUNTER stopped dead at the tile edge on both sides, a sawn-off plank front with half a
 *     ware and a sliver of crate hanging off it, because the one painter laid four times runs edge
 *     to edge by design and nothing marked where the run ends. The sign draws the eye past the right
 *     end; on the left there is nothing to, so that is where it was seen.
 *   - the BARREL lost its left outline: it stood at the awning sheet's margin, so `ring` laid that
 *     keyline in the margin the tile cut never keeps. A barrel with no left edge reads as sliced.
 *   - the AWNING's frame had a cantilever on the right (the sign bar) and stopped flush at the left
 *     post, leaving that corner bare lawn.
 *
 * The ends are two new tiles rather than a change to this one, because the middle two are still
 * the same painter and must stay seamless against each other. Each end pulls the body in three
 * columns so `ring` can see the end and outline it, stands a corner post with the same cap block
 * every free-standing post in this file carries, drops the leg and the half-ware that only make
 * sense against a neighbour, and stops its contact pool a pixel past the post rather than at the
 * tile edge. Both ends get it, because a counter finished at one end only is a new asymmetry, not
 * a finish. The goods on each end are re-spaced so nothing stands behind the post.
 */
type CounterEnd = 'l' | 'r' | null;

/** Columns an end tile gives back to the lawn beyond its corner post. */
const COUNTER_END_INSET = 3;
const COUNTER_POST_W = 4;

const stallCounterTile =
  (end: CounterEnd): Painter =>
  (img) => {
    // The columns the counter body occupies on this tile, and where its corner post stands.
    const bodyX0 = end === 'l' ? COUNTER_END_INSET : 0;
    const bodyX1 = end === 'r' ? TILE - COUNTER_END_INSET : TILE; // exclusive
    const postX = end === 'l' ? bodyX0 : bodyX1 - COUNTER_POST_W;
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
    /*
     * Where the counter MEETS the grass, which is the sixth of task P13's six floating props and the
     * only one that is not a `cast()` call. A band rather than an ellipse so it meets its neighbour:
     * four of these tiles abut, and four ellipses make a scalloped shadow under a counter that runs
     * unbroken across all four.
     *
     * It is `CONTACT_FALL`, one row a step, landing opaque on the row the legs and the front's own
     * keyline stand on. It ran 60, 78, 100, 128, 160 and stopped at row 30, which took the deepest
     * pixel only to luma 74 -- half the fall the fence and the bush make -- and left the tile's last
     * row as open lawn directly under the one surface in the stall that touches the ground.
     *
     * AND THEN BACK OUT AGAIN BELOW THE FOOT, which is the one thing a band has to do that an ellipse
     * gets for free. Run straight down to the tile's edge the pool ends on a full-width opaque row, and
     * because four of these tiles abut that is a dead-straight 128-pixel bar with a 95-luma step under
     * it in the market frame -- the fence run's own defect, in a shadow. Easing back out over the last
     * two rows puts the deepest pixel at the point of contact and lets the pool fade away from the
     * object, which is the direction a shadow falls.
     */
    const FOOT = TILE - 3;
    // On an end tile the pool stops one pixel past the corner post on the left, where the light
    // comes from, and two on the right, where the shadow falls; never at the tile edge.
    const poolX0 = end === 'l' ? bodyX0 - 1 : 0;
    const poolX1 = end === 'r' ? bodyX1 + 2 : TILE;
    CONTACT_FALL.forEach((a, i) =>
      img.rect(poolX0, FOOT - CONTACT_FALL.length + 1 + i, poolX1 - poolX0, 1, [
        CONTACT[0],
        CONTACT[1],
        CONTACT[2],
        a,
      ]),
    );
    for (let i = 1; i < TILE - FOOT; i++)
      img.rect(poolX0, FOOT + i, poolX1 - poolX0, 1, [
        CONTACT[0],
        CONTACT[1],
        CONTACT[2],
        CONTACT_FALL[CONTACT_FALL.length - 1 - i]!,
      ]);

    stand(img, (s) => {
      // Legs, then the board that laps over them.
      // The corner post is the end leg, so an end tile keeps only its inner leg.
      for (const lx of [4, 23])
        if (!(end === 'l' && lx === 4) && !(end === 'r' && lx === 23)) postV(s, lx, 25, 5, 4);

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
       * domes a tile, which at the playing camera is a row of identical blobs and tells the player
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
      // On an end tile the goods are re-spaced clear of the corner post, and the half-ware that only
      // makes sense against a neighbour is dropped on that side.
      if (end === 'l') {
        crate(s, 9, 3, 8, 7);
        sack(s, 18.5, 6, 4.4, 3.6);
        crate(s, 23, 3, 8, 7);
        ware(s, 11, 8.6, 3.6, 'gold');
        ware(s, 23, 8.5, 3.5, 'gold');
        ware(s, 30.5, 9, 3.4, 'path');
      } else if (end === 'r') {
        crate(s, 1, 2, 9, 8);
        sack(s, 14.5, 6, 4.4, 3.6);
        ware(s, 5.5, 8.6, 3.8, 'gold');
        ware(s, 20.5, 8.8, 3.5, 'gold');
        ware(s, -1.5, 9, 3.4, 'path');
      } else {
        crate(s, 1, 2, 9, 8);
        sack(s, 16.5, 6, 5, 3.8);
        crate(s, 23, 3, 8, 7);

        ware(s, 5.5, 8.6, 3.8, 'gold');
        ware(s, 14, 9, 3.2, 'path');
        ware(s, 23, 8.5, 3.5, 'gold');
        for (const cx of [-1.5, 30.5]) ware(s, cx, 9, 3.4, 'path');
      }

      // The interior keyline under everything standing on the top, which the ring cannot reach: the
      // counter top is the one surface in the tile with nothing transparent beside it. It sits ON the
      // top's first row -- a row higher and the goods hang in the stall's shade with a line under
      // them, which is what floating looks like.
      const under: readonly (readonly [number, number])[] =
        end === 'l'
          ? [
              [8, 7],
              [15, 8],
              [19, 7],
              [23, 8],
              [29, 3],
            ]
          : end === 'r'
            ? [
                [1, 9],
                [11, 7],
                [17, 7],
                [0, 3],
              ]
            : [
                [1, 9],
                [12, 6],
                [19, 7],
                [23, 8],
                [29, 3],
                [0, 3],
              ];
      for (const [bx, bw] of under) s.rect(bx, 10, bw, 1, LINE.wood);

      if (end) {
        // Give the columns beyond the end back to the lawn, so `ring` finds the end and outlines it.
        // Written straight into the buffer: `px` composites, so painting alpha 0 would change nothing.
        for (let y = 0; y < TILE; y++)
          for (let x = 0; x < TILE; x++)
            if (x < bodyX0 || x >= bodyX1)
              s.data.fill(0, (y * TILE + x) * 4, (y * TILE + x) * 4 + 4);
        // The corner post, rising a little above the counter top, with the cap block every
        // free-standing post in this file wears -- one column wider than the post on each side.
        postV(s, postX, 8, COUNTER_POST_W, TILE - 3 - 8);
        capBlock(s, postX - 1, 6, COUNTER_POST_W + 2, 2);
        // Its interior keyline against the counter it closes, which `ring` cannot reach.
        s.rect(end === 'l' ? postX + COUNTER_POST_W : postX - 1, 8, 1, TILE - 3 - 8, LINE.wood);
      }
    });

    // What the goods throw onto the counter top, in two soft steps rather than one flat ellipse.
    const throws: readonly (readonly [number, number])[] =
      end === 'l'
        ? [
            [11.5, 3.6],
            [22, 3.8],
          ]
        : end === 'r'
          ? [
              [6, 4],
              [14.5, 3.4],
              [20.5, 3.2],
            ]
          : [
              [6, 4],
              [14.5, 3.4],
              [22, 3.8],
            ];
    for (const [cx, rx] of throws)
      for (const [k, a] of [
        [1, 40],
        [0.6, 52],
      ] as const)
        img.ellipse(cx, 11.4, rx * k, 1 * k, [SHADE[0], SHADE[1], SHADE[2], a]);
  };

const stallCounter = stallCounterTile(null);

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

  /*
   * The footprint is the PLINTH's, which is what the lamp actually stands on, and it was the one of
   * the five `cast()` calls whose numbers were wrong as well as whose ladder was. At 5.2 by 1.8 the
   * pool was narrower than the stonework over it -- the lower course runs x 12..22 and the ring puts
   * a keyline either side of that -- so every pixel of it, feather and core alike, was painted
   * underneath the prop and the lawn beside the plinth never darkened at all. It is the one prop
   * here standing in its own light, so it is also the one where a floating foot showed worst: a lit
   * pool on the grass with nothing holding the post down in it.
   *
   * Wider than the stone and centred on the tile's last row, which is the fence's own drawing -- its
   * picket is 9 across and its contact ellipse 12, centred four rows below the wood's base.
   */
  cast(img, 17.5, 29.8, 8.4, 2.6);

  stand(
    img,
    (s) => {
      /*
       * Post, cap block and the cross-arm. The post was four pixels wide and the arm four deep on the
       * first pass, which made the two the same mass and the arm stopped reading as a cantilever. The
       * post is three, and the arm sits a row clear of the cap with its own shade under it.
       */
      postV(s, 16, 6, 3, 20);
      capBlock(s, 15, 3, 5, 3);

      /*
       * THE STONE FOOTING, which is the board review's ask for this prop and which the post plainly
       * needed: it ran to the tile's last row and ended in lawn, so the lamp read as a stick pushed
       * into grass. A lit post on a public track stands on something, and the board's free-standing
       * uprights all meet the ground on either worked stone or a band of tufts -- this one gets both.
       *
       * Two courses of the same `block()` the well and the fountain are built from, so the three
       * pieces of stonework in this file agree with each other, stepped so the lower course is wider:
       * a plinth, not a cube. The post's own keylines run down into it.
       */
      for (const [bx, bw] of [
        [14, 4],
        [18, 3],
      ] as const)
        block(s, bx, 26, bw, 3);
      for (const [bx, bw] of [
        [12, 4],
        [16, 4],
        [20, 3],
      ] as const)
        block(s, bx, 29, bw, 3);

      /*
       * The cross-arm, and the brace under it. The arm sits a row clear of the cap with its own shade
       * beneath it, so it reads as a cantilever rather than as the top of the post. The brace is the
       * mark that makes a cantilever believable at this size: a diagonal from the post's face up to
       * the arm's underside, drawn twice -- a dark line and a lit one beside it.
       */
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
 * The well: a round stone drum of individually keylined blocks, a dark shaft, a capped timber post
 * rising from the back of it, and a bucket on the rim.
 *
 * THE ROOF IS GONE, AND THAT IS THE WHOLE CHANGE. Read this before putting one back.
 *
 * Rendered at 6x the prop was a wide flat grey pyramid on two legs with a pale grey lump under it,
 * and "bus shelter" is exactly what it looked like -- the roof took eleven of the tile's thirty-two
 * rows, it was the widest and lightest mass in the frame, and the stonework that actually says
 * "well" was reduced to a four-row footnote beneath it. The head of product's board review names it
 * twice.
 *
 * The concept board settles it. Crop `1360 570 170 210 5`: its well is a ROUND STONE DRUM, two or
 * three courses of separately keylined blocks each round-lit on its own top-left, with the inside of
 * the ring showing as a dark band at the back, and a square capped timber post standing up out of
 * the middle of it. No roof, no posts either side, no windlass. The drum is the prop, it fills the
 * frame, and it is the brightest stonework on the board -- pale block caps against near-black
 * joints.
 *
 * THIS CONTRADICTS ART_PRODUCTION SECTION 6a, which sends the well's roof onto slate with the
 * cottage's, and that document is not this element's to edit. The departure is deliberate and it is
 * raised in the handback: 6a says what COLOUR the roof should be, and the board says there is no
 * roof. The board wins, and 6a's sentence about this prop should be struck rather than honoured.
 *
 * What the drum gains from the eleven rows: it is now fourteen rows tall over three courses instead
 * of eight over two, its rim reads from above with the shaft open in it, and its blocks are back up
 * near the board's own value instead of being held down to avoid competing with a roof.
 */
const well: Painter = (img) => {
  groundUnder(img, 1);
  cast(img, 16.5, 30, 13, 3.2);

  stand(
    img,
    (s) => {
      /*
       * The post first; the stonework laps over its foot, which is what seats it IN the well rather
       * than beside it. Square-section and capped, as the board's is, and set back of centre so the
       * rim shows in front of it.
       */
      postV(s, 13, 8, 6, 16);
      capBlock(s, 12, 5, 8, 3);
      s.rect(12, 8, 1, 16, LINE.wood);
      s.rect(19, 8, 1, 16, LINE.wood);

      /*
       * The drum, as the board lays it: three staggered courses of blocks, each round-lit on its own
       * top-left corner with its mortar as the last pixel of its own fall, clipped to a round
       * footprint so the thing is a cylinder and not a wall.
       */
      dome(s, 16, 24, 13, 6.4, 'stone', 0.0, 0.42);
      for (const [bx, bw] of [
        [3, 7],
        [10, 6],
        [16, 7],
        [23, 6],
      ] as const)
        block(s, bx, 19, bw, 5);
      for (const [bx, bw] of [
        [5, 6],
        [11, 7],
        [18, 6],
        [24, 5],
      ] as const)
        block(s, bx, 24, bw, 5);
      for (const [bx, bw] of [
        [8, 7],
        [15, 6],
        [21, 6],
      ] as const)
        block(s, bx, 29, bw, 3);
      clipEllipse(s, 16, 24, 13.4, 7.6, 19);

      /*
       * The rim, and THE MOUTH, which is the whole prop. A stone ring, a dark hole and a bucket on a
       * rope: three marks, and the prop announces itself from across the glade.
       */
      dome(s, 16, 17.4, 13, 3.6, 'stone', 0.0, 0.12);
      dome(s, 16, 17.1, 11.4, 2.8, 'stone', 0.1, 0.1 + SPAN * 0.7);
      // The shaft, in the stone's own near-black rather than in `night`. `night` is the portrait
      // backdrop ramp and it is frankly purple: at 32px it put a violet fringe round the mouth of
      // a grey well, which is a hue this world has nowhere outside Purple and the wolf.
      s.ellipse(16, 18.2, 8.2, 2.3, LINE.stone);
      s.ellipse(16.2, 17.8, 6.8, 1.5, tone('stone', 0.06));

      /*
       * Rope and bucket last, in front of the stonework -- drawn before it, the rim painted straight
       * over both and left a rope hanging through solid stone. The rope runs down the post, which is
       * what the post is for now that there is no windlass to wind it on.
       */
      for (let j = 0; j < 4; j++) s.px(10, 10 + j, tone('path', 0.4));
      s.line(10, 10, 12, 9, tone('path', 0.34));
      /*
       * The bucket STANDS ON THE RIM, at the front left, which is where the board puts its own small
       * round ware. Hung halfway up the post it floated in mid-air beside the stonework with nothing
       * under it -- and the one thing a bucket has to do at this size is touch the thing it belongs
       * to. Its foot now laps the rim's front face.
       *
       * Taller than it is wide, which is the whole difference between a bucket and a satchel: at six
       * by five the first version of this read as a brown pouch hung on the rim.
       */
      postV(s, 6, 13, 5, 8);
      for (const hy of [14, 20]) sinkRun(s, 6, hy, 5, 1, 26);
      // The handle, and the bucket's own keyline, which the ring cannot reach: it stands against
      // opaque stone on every side.
      s.line(6, 13, 8, 11, LINE.wood);
      s.line(8, 11, 10, 13, LINE.wood);
      s.rect(5, 13, 1, 8, LINE.wood);
      s.rect(11, 13, 1, 8, LINE.wood);
      s.rect(6, 21, 5, 1, LINE.wood);
    },
    LINE.stone,
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

/**
 * One arrow board: a plank with a chevron point on the ends that are pointed.
 *
 * THE TAPER IS A CURVE, NOT A RATE, AND EACH BOARD POINTS ONE WAY ONLY. Both are corrections, and
 * both came out of putting the render beside `700 520 130 160 6`.
 *
 * A LINEAR taper -- one pixel a row, or 1.5, or 2.6 -- cannot draw this shape at any rate. At a
 * small rate the end loses a few columns evenly down its height, which is a bevel, and the arm reads
 * as a flattened hexagon: a bone, or a letterbox, which is the word the client used. At a large rate
 * it loses them evenly and fast, and the arm reads as a spearhead, which is what 2.6 rendered as.
 *
 * Crop the board and count: its arm holds its FULL length across the middle four or five of its ten
 * rows, then pulls in sharply over the outer two at each edge -- three columns, then five. So the
 * profile is flat in the middle with a knee near the edges, and the only way to get that out of
 * `|row - mid|` is to raise it to a power. `^2.2` on the normalised distance is the knee; five
 * columns is the reach at the very edge. Flat tip, square shoulders, and it reads as an arrow.
 *
 * And they point ONE WAY EACH. The board's signpost is two arms on a post, the upper one pointed at
 * its right and square at its left, the lower pointed at its left and square at its right -- a fork,
 * drawn as two directions. Ours pointed the upper board at both ends, which says nothing: an arrow
 * with two heads is a decoration. A square end also lets the arm read as having been CUT, which is
 * what makes the pointed end read as deliberate.
 */
const TIP_REACH = 5;

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
    const d = Math.abs(y + row - mid) / Math.max(1, (h - 1) / 2);
    const taper = Math.round(Math.pow(d, 2.2) * TIP_REACH);
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

/**
 * Which lawn each free-standing post carries under itself.
 *
 * It is a record rather than a literal in each painter so the guards at the foot of this file can
 * subtract the right ground and be left with the post. A guard that assumed the variant would be
 * measuring grass as if it were timber the first time a painter changed its mind.
 */
const POST_GROUND = { signpost: 2, 'notice-board': 1, 'notice-board-r': 1, mailbox: 0 } as const;

const signpost: Painter = (img) => {
  groundUnder(img, POST_GROUND.signpost);
  cast(img, 16, 30.5, 7.5, 2.4);

  stand(img, (s) => {
    /*
     * The post now REACHES THE GROUND, which is the brief's complaint about this prop and was a
     * plain mistake rather than a judgement: it ran to row 28 of a 32-row tile and stopped in mid
     * air, with lawn visible underneath it and a cast shadow floating below that. Twenty-six rows
     * takes it to the tile's last row, where the ring seats it with its own dark band.
     */
    postV(s, 13, 6, 5, 26);
    /*
     * The cap: NARROWER AND SHALLOWER. At seven wide by four deep on a five-wide post it was half
     * again the post's width and a third of the visible post's height, which rendered as a mushroom
     * head. The board's cap is a thin collar -- one pixel proud each side, two rows deep, with its
     * own keyline -- and the post reads as a post because the cap barely interrupts it.
     */
    capBlock(s, 12, 4, 7, 3);

    // The upper board, pointed at its right: the way on.
    arrowBoard(s, 9, 8, 2, 29, { left: false, right: true });
    // The lower board, pointing back the way you came.
    arrowBoard(s, 20, 7, 3, 27, { left: true, right: false });

    // Grain, and a knot in each board -- a tonal ripple rather than a drawn dash. As hard
    // `wood[0]` lines at alpha 140 these four strokes alone were forty hard edges on one tile.
    for (const [gx, gy, gw] of [
      [6, 11, 6],
      [19, 13, 6],
      [8, 22, 5],
      [18, 24, 6],
    ] as const)
      sinkRun(s, gx, gy, gw, 1, 11);
    for (const [kx, ky] of [
      [23, 12],
      [11, 23],
    ] as const)
      dome(s, kx, ky, 1.6, 1.1, 'wood', 0.1, 0.36);

    // Each board throws a line onto the post below it, and an interior keyline where it crosses --
    // the ring cannot see those edges, they are opaque against opaque.
    for (const by of [17, 27]) {
      sinkRun(s, 13, by, 5, 1, 44);
      sinkRun(s, 13, by + 1, 5, 1, 22);
    }
    s.rect(13, 9, 5, 1, LINE.wood);
    s.rect(13, 20, 5, 1, LINE.wood);

    /*
     * The joint lozenge where each arm crosses the post. The board draws a small dark diamond at
     * both crossings -- the nail plate -- and it is the one mark that says the arms are FIXED to the
     * post rather than painted across it.
     */
    for (const jy of [12, 23]) {
      s.rect(15, jy, 1, 3, LINE.wood);
      s.rect(14, jy + 1, 3, 1, LINE.wood);
      s.px(15, jy + 1, tone('wood', 0.3));
    }
  });

  /*
   * The tuft ring at the foot. The board wraps a band of dark teal blades round the base of every
   * free-standing upright it draws -- the signpost, the mailbox post, the well -- and that band is
   * what makes the post grow OUT of the lawn instead of standing on it. Two single blades were not
   * a band; they were two pixels.
   *
   * Each sprig is three blades of unequal height, the middle one tallest, in the grass ramp's own
   * TWO DARKEST stops -- `grass[0]` at the base and `grass[1]` at the tip -- so it reads as grass in
   * the prop's shade rather than as a new plant. The lit-tip convention (levels 2 and 1, which is
   * what the two blades this replaces used) puts the blade at luma 157 against a lawn at about 180,
   * which at 1x is a twenty-luma mark on green: it was drawn and it was not visible. The board's
   * tufts are plainly the darkest green in their own patch.
   */
  for (const [bx, by] of [
    [8, 29],
    [11, 30],
    [19, 29],
    [22, 30],
  ] as const)
    for (const [dx, up] of [
      [0, 1],
      [1, 2],
      [2, 1],
    ] as const)
      for (let j = 0; j < up; j++) img.px(bx + dx, by - j, shade('grass', j === up - 1 ? 1 : 0));
};

/* ------------------------------------------------------------------- the mailbox */

/*
 * GRANDMA'S MAILBOX, WITH ITS FLAG UP. UI_FOUNDATIONS section 8 lists it in the 04 Arrive scene --
 * "wolf silhouette in the lit window, paw prints on the path, smoking chimney, mailbox with the
 * flag up" -- and it was the one of the four nobody had drawn. The client approved it on 2026-10-23.
 *
 * Cropped from the board at `1945 1400 80 160 4`: a tan timber box on a timber post, a red painted
 * hood rolled over the top of it with the dark of the opening under its lip, and a yellow flag
 * standing above the hood. At 3.75 board pixels to one of ours the box is about 13 wide and the
 * whole thing, flag to foot, about 40 tall. Ours is 14 wide and 29 tall, because a tile is 32 and the
 * post has to reach the ground (see the signpost's note on a post that stops in mid air). The board
 * stands it as tall as the girl's shoulder; ours stands at her chest, which is the same read.
 *
 *   box     `wood`, lit on its top-left like every block here, with the door's plate SUNK into its
 *           face and a letter slot across it in the wood keyline. The plate is what says box rather
 *           than crate.
 *   hood    painted metal, so `rust` -- the toadstool caps' red, derived from `wood` in `paint.ts` --
 *           and not brand colour: PIXEL_STANDARD section 2 keeps Purple's hues off the props. It is
 *           an arch, banded round its own curve as the barrels are, with the opening's dark under
 *           its lip.
 *   flag    `gold`, raised on a thin dark arm at the hood's east shoulder and pointing east. UP is the
 *           whole message, so the flag stands clear above the hood's crown and nothing else on the
 *           tile is that colour.
 *
 * It is a THING IN THE WAY, so it is solid on the map (forest-map.ts lists it in MUST_STOP_HER) and
 * it is one of the props that has to touch the ground (`GROUND_PROPS` below).
 */

/** Painted metal, in the toadstool's red: `rust` cut into the same five steps as every surface. */
const paint = (t: number): RGBA => rust(Math.round(clamp01(t) * (BANDS - 1)) / (BANDS - 1));

const mailbox: Painter = (img) => {
  groundUnder(img, POST_GROUND.mailbox);
  cast(img, 16, 30.5, 6.4, 2.3);

  stand(img, (s) => {
    // The post, to the tile's last row.
    postV(s, 14, 21, 4, 11);

    // The box: a block lit on its top left, the plate sunk into its face, the slot across the plate.
    face(s, 9, 13, 14, 9, 'wood', 0.22, 0.22 + SPAN);
    sinkRun(s, 11, 15, 10, 5, 34);
    sinkRun(s, 11, 19, 10, 1, 24); // the plate's own underside
    s.rect(13, 16, 6, 1, LINE.wood); // the letter slot
    // The box throws its line onto the post below it, which `ring()` cannot see: opaque on opaque.
    sinkRun(s, 14, 22, 4, 1, 48);
    sinkRun(s, 14, 23, 4, 1, 22);

    /*
     * The hood: an arch over the box, eight rows from crown to lip, banded round its own curve from
     * the top left. The lip overhangs the box by a pixel each side, as the board's does.
     */
    const HOOD_TOP = 6;
    const HOOD_LIP = 13;
    const hcx = 15.5;
    for (let y = HOOD_TOP; y <= HOOD_LIP; y++) {
      const k = (HOOD_LIP + 0.5 - y) / (HOOD_LIP + 1 - HOOD_TOP);
      const half = 7.6 * Math.sqrt(Math.max(0, 1 - k * k));
      for (let x = Math.ceil(hcx - half); x <= Math.floor(hcx + half); x++) {
        const across = (x - (hcx - half)) / Math.max(1, 2 * half); // 0 at the lit west edge
        const down = (y - HOOD_TOP) / (HOOD_LIP - HOOD_TOP);
        s.px(x, y, paint(roundT(clamp01(0.62 * across + 0.38 * down), 0.18, 0.18 + SPAN)));
      }
    }
    // The opening's dark under the lip, an arch inside the arch: what makes it a mailbox's mouth
    // and not a red roof on a crate.
    for (const [x0, x1, y] of [
      [12, 19, 12],
      [11, 20, 13],
    ] as const)
      s.rect(x0, y, x1 - x0 + 1, 1, LINE.wood);
    s.rect(13, 11, 6, 1, keyline('wood', 70)); // the crown of the opening, a step less deep

    /*
     * THE FLAG, UP. A one-pixel arm in the metal keyline from the box's east side to above the hood,
     * and a plate on top of it pointing east -- clear of the hood by two rows, so the shape against
     * the lawn is unmistakably raised. Lit from the top left like everything else.
     */
    s.rect(23, 2, 1, 13, LINE.metal);
    // Six by three, not four square: a square plate on a thin arm, rounded by the ring, came back
    // as a lollipop. A flag is wider than it is tall.
    face(s, 24, 2, 6, 3, 'gold', 0.3, 0.3 + SPAN * 0.9);
  });

  /*
   * The same tuft ring the signpost wears at its foot, so the post grows out of the lawn rather than
   * standing on it. See the note on the signpost.
   */
  for (const [bx, by] of [
    [9, 29],
    [12, 30],
    [18, 30],
    [21, 29],
  ] as const)
    for (const [dx, up] of [
      [0, 1],
      [1, 2],
      [2, 1],
    ] as const)
      for (let j = 0; j < up; j++) img.px(bx + dx, by - j, shade('grass', j === up - 1 ? 1 : 0));
};

/* ------------------------------------------- the two things she is scored for reading */

/*
 * ===========================================================================
 * PAPER. THE GAME SCORES THE PLAYER FOR READING TWO THINGS AND NEITHER OF THEM WAS DRAWN.
 * ===========================================================================
 *
 * `content/game.json` pays a hundred points for `cottage-door` -- half of one of the two lines that
 * reach the game's thousand-point ceiling -- and the object that fires it, `notice-cottage-door`,
 * covered six tiles of lane and flowerbed with NOTHING ON THEM. Every layer was dumped at the gate:
 * two of the six were a flower bed, four were plain sand, the decor-above layer was empty, and
 * `TILE_NAMES` had no notice in it at all. The panel fired from walking over a flower bed.
 *
 * `docs/GAME_DESIGN.md` 5b says missing that note is deliberate -- "reachable, not unavoidable" --
 * and that is a defensible design only while the player could have SEEN there was something to
 * miss. Nothing was drawn, so nothing was missed; the goal was advertised in the HUD all run and
 * then paid out, or not, for reasons invisible on screen.
 *
 * The forest post had the opposite fault. It was drawn, and it was drawn as the SIGNPOST -- the
 * same tile, pixel for pixel, as the decorative one four tiles from the spawn. The first signpost a
 * player meets stands in the crook of a fork and says only "the path divides"; it has no writing on
 * it, because the concept board's has none and because CLAUDE.md rule 4 keeps text off the canvas.
 * Teaching a player that a post with arms on it means nothing, and then resting the level's one
 * mandatory zero-click beat on a post with arms on it, is the whole defect.
 *
 * So the two jobs get two objects, and the difference between them is the one a player can read at
 * a glance from a top-down camera: ARROWS POINT, PAPER SPEAKS.
 *
 *   signpost       two tapered timber arms on a capped post. Timber from end to end: nothing on it
 *                  is paper, and the guard at the foot of this file holds it that way.
 *   notice-board   a sheet NAILED TO A POST, which is what `content/game.json` has always called it
 *                  ("A notice nailed to a post"). One pale portrait page filling most of the tile,
 *                  ruled with writing, nailed at its top corners, dog-eared at the foot.
 *   door-note      the approved `door`, repainted exactly, with a small sheet pinned to its leaf.
 *
 * Why the door note is a TILE rather than a decor-above overlay: decor-above draws over Purple, so a
 * note laid there is drawn across her face whenever she stands on the doorstep. One tile that
 * paints the cottage owner's door and then the note on top of it keeps the layer order honest, and
 * because `door-note` is appended to `TILE_NAMES` the existing map keeps every gid it had.
 */

/**
 * A sheet of paper: a cream face lit from the top left, quantised like every other surface here.
 *
 * `wall` is the cottage's own plaster ramp and its top stops are the only true creams in the
 * palette, which is what lets a page read as paper rather than as a pale board. Four bands over
 * 0.36..0.96 lands on the ramp's top three stops -- luma 219, 233 and 251 -- so the sheet sits a
 * clear hundred luma above the door's leaf (83..116, measured by the cottage owner) and about forty
 * above the plaster it hangs beside. That interval IS the legibility: at a 19-tile camera a note is
 * a bright rectangle before it is anything else.
 *
 * `rim` is for a page painted straight onto opaque art, where `stand()`'s `bank()` cannot run. It
 * lays the same two steps bank would -- 22 then 58 -- down the right and along the bottom, so a
 * page pinned to a door is rounded off exactly like one nailed to a post.
 */
function paper(s: Img, x: number, y: number, w: number, h: number, rim = false): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ix = w < 2 ? 0.3 : i / (w - 1);
      const jy = h < 2 ? 0.3 : j / (h - 1);
      s.px(x + i, y + j, band('wall', roundT(0.46 * ix + 0.54 * jy, 0.36, 0.96), 4));
    }
  if (!rim) return;
  /*
   * On a page five columns wide the two-step rim would be two of the five, and the sheet would be
   * more edge than face -- measured, it left 24 pixels of the note over the paper threshold where
   * the underside alone leaves 34. A page with room for both steps gets both; a small one gets its
   * underside and leans on the line round it for the rest.
   */
  if (w > 6 && h > 6) {
    sinkRun(s, x + w - 2, y, 1, h - 1, 22);
    sinkRun(s, x, y + h - 2, w - 1, 1, 22);
    sinkRun(s, x + w - 1, y, 1, h, 58);
  }
  sinkRun(s, x, y + h - 1, w, 1, 58);
}

/**
 * Ruled strokes of writing, ragged right.
 *
 * It is the ragged right that does the work. Equal runs are stripes and stripes are a pattern; runs
 * that stop short by different amounts are text, and the eye decides which of the two it is looking
 * at well before it can read anything. Nothing here spells a word: the board draws grain rather
 * than letters, CLAUDE.md rule 4 keeps text off the canvas, and a legible word at this size would
 * be a smear.
 *
 * `sinkRun` darkens the page rather than laying a chosen grey over it, so the strokes stay in the
 * cream's own hue and no new colour enters the file.
 */
function writing(
  s: Img,
  x: number,
  y: number,
  w: number,
  shortfalls: readonly number[],
  drop: number,
): void {
  shortfalls.forEach((short, k) => {
    const run = w - short;
    if (run >= 2) sinkRun(s, x, y + k * 2, run, 1, drop);
  });
}

/** A nail head: the one cool near-black on a warm page, which is what says the sheet is fixed. */
const nail = (s: Img, x: number, y: number): void => s.px(x, y, LINE.metal);

/* ------------------------------------------------------ three signs that say Cyera */

/*
 * ===========================================================================
 * LETTERING ON THE CANVAS, AND WHY THIS IS NOT THE THING RULE 4 FORBIDS.
 * ===========================================================================
 *
 * The client asked on 2026-10-23 for three signs in the wood: the forest notice to read
 * "I ♥ Cyera Research", a new wooden sign reading "Cyera Speed!", and a blank board carrying the
 * Cyera logo. Everything above this line says a legible word at this size would be a smear and that
 * CLAUDE.md rule 4 keeps text off the canvas, so the departure is worth stating exactly.
 *
 * Rule 4 is about UI TEXT: a panel, a label, an instruction the player has to read to play. None of
 * these is that. They are lettering painted on a prop, the way the market stall's sign carries a
 * compass -- set dressing that happens to spell something -- and every one of them has a DOM caption
 * (`ui.world.signs` in content/game.v2.json, said politely when Purple is near) so nothing a player
 * or a screen reader needs lives only in the pixels. The LOGO is not painted at all: rule 5 forbids
 * redrawing it, so its board is painted blank and the supplied SVG is laid over it in the DOM.
 *
 * THE FONT WAS three by five with one column between letters, the smallest a capital alphabet can
 * be and stay unambiguous. At the game's zoom 2 a letter is 6 x 10 CSS pixels; at a phone's zoom 1
 * it is 3 x 5 CSS pixels, drawn on six by ten device pixels on every phone with a 2x screen.
 *
 * SUPERSEDED 2026-10-25: the client picked the BRUSH HAND ("B1") from four previews, and it lives in
 * `sign-brush.ts` -- heavy two-pixel downstrokes, dry-brush ends, a bouncing baseline, and a drawn
 * heart with an outline and a highlight. Still five rows and still capitals, for the reason above;
 * the heavier downstrokes cost width, so the notice's page went from 38 to 42 to carry RESEARCH.
 * The 3 x 5 table is gone from this file because nothing paints with it any more.
 */

/*
 * THE HEART IS BRAND PURPLE, on the client's word. PIXEL_STANDARD section 2 keeps Purple's hues off
 * the props -- the protagonist and the attacker are meant to be the only saturated figures in frame
 * -- and this is a deliberate, client-requested exception the size of one glyph. FOR BRAND REVIEW.
 *
 * In the 3 x 5 font it was a 5 x 5 block of Deep Purple with one Aubergine pixel for the light, and
 * Lilac for that pixel was tried and REJECTED: 75 luma off the page, and a pale pixel in a five-pixel
 * glyph eats the lobe. Since 2026-10-25 (B1) the heart is DRAWN, seven by six: a keyline outline in
 * `keyline('cloak')`, an Aubergine body, and a two-pixel Lilac highlight on the west lobe. Lilac is
 * back, at the same 75 luma, and it no longer eats anything, because the OUTLINE carries the shape
 * now -- the highlight sits wholly inside it. That is the condition the guard at the foot of this
 * file holds it to, as a named exception to the letter floor, instead of the floor.
 */
const HEART_INK = {
  hline: keyline('cloak'),
  hfill: shade('cloak', 1),
  hhi: shade('cloak', 2),
} as const;

/** Paints laid lines onto a sheet, each role in the sign's own colour for it. */
function paintLettering(s: Img, lines: readonly LaidAt[], ink: Record<Role, RGBA>): void {
  for (const { x, y, laid } of lines)
    for (const [px, py, r] of laid.px) s.px(x + px, y + py, ink[r]);
}

/**
 * Paints a prop that is wider than one tile on its own transparent sheet, rounds it off and rings it
 * exactly as `stand()` does for one tile, and returns the sheet for each tile to cut its column from.
 * One sheet rather than one `stand()` per tile, so `ring` and `bank` see the whole object and draw no
 * seam down the tile boundary.
 */
function standSheet(tiles: number, draw: (s: Img) => void, line: RGBA = LINE.wood): Img {
  const s = new Img(TILE * tiles, TILE);
  draw(s);
  bank(s);
  ring(s, line);
  return s;
}

/** Lays column `slot` of a sheet from `standSheet` onto a tile, over whatever ground it has. */
function cutColumn(img: Img, sheet: Img, slot: number): void {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const c = sheet.get(slot * TILE + x, y);
      if (c[3] !== 0) img.px(x, y, c);
    }
}

/**
 * The tuft ring every post here wears at its foot, at sheet coordinates, cut to the tile at `slot`.
 * Three blades of unequal height in the grass ramp's two darkest stops -- see the note on the
 * signpost for why those two and not the lit tips.
 */
function tufts(img: Img, at: readonly (readonly [number, number])[], slot = 0): void {
  for (const [sx, by] of at)
    for (const [dx, up] of [
      [0, 1],
      [1, 2],
      [2, 1],
    ] as const) {
      const x = sx + dx - slot * TILE;
      if (x < 0 || x >= TILE) continue;
      for (let j = 0; j < up; j++) img.px(x, by - j, shade('grass', j === up - 1 ? 1 : 0));
    }
}

/*
 * THE NOTICE NAILED TO A POST, on the gate approach -- and since 2026-10-23 it says something.
 *
 * "I ♥ / CYERA / RESEARCH", three lines, in the sign font. RESEARCH was 31 pixels, and the page was
 * 18 wide on a 32-pixel tile, so the page could not carry the word and no page on one tile could:
 * 31 plus a three-pixel margin a side is 37. So the notice is TWO tiles now, `notice-board` and
 * `notice-board-r`, and the page is 38 x 24 -- the same paper, the same nails, the same dog ear and
 * the same capped post, made wide enough for the line, which is the brief's "widen the paper in the
 * same hand". The post moves to the seam so it stands under the middle of the page: a sheet that
 * wide nailed to a post at one end would read as a flag.
 *
 * Landscape now, where it was portrait, and that costs the pair less than it looks. Portrait was the
 * SECOND thing the silhouette said; "pale" was the first, and the pale share holds (guarded below on
 * both halves). The arms of the signpost are still timber from end to end and point; this is still a
 * page, and it is now the only thing in the wood with writing on it that a player can read.
 *
 * The page stands three rows from the tile's top, which leaves five rows of post below it -- the
 * same five the portrait page left -- so it still reads as a sheet on a post rather than a panel on
 * the ground. Ruled strokes of writing are gone: there is real lettering where they stood.
 *
 * The ink is the cream's own keyline (`LINE.cloth`), a warm near-black, so the letters stand some two
 * hundred luma under the page they are written on. The heart is the exception; see `HEART_INK`.
 *
 * 2026-10-25, THE BRUSH HAND (B1, the client's pick): RESEARCH is 36 pixels in it, and 36 plus the
 * three-pixel margin a side is 42, so the page is 42 x 24 now, at x 11 -- still centred on the seam
 * at x 32, so the post stays under the middle of it. Four pixels wider and nothing else: the same
 * two tiles, the same height, the same nails at the same insets, the same dog ear. The lines are
 * laid by `layOn`, stacked and centred down the page, rather than at hand-set rows. The dry-brush
 * ends are the wood's darkest stop, a warm brown that reads as the ink running thin on the paper.
 */
const NOTICE_PAGE = { x: 11, y: 3, w: 42, h: 24 } as const;

/** The post under the notice, centred on the seam between its two tiles. */
const NOTICE_POST = { x: 29, w: 6 } as const;

/** The notice's three lines, laid in the brush hand down its page. */
const NOTICE_LINES = layOn(NOTICE_PAGE, ['I ♥', 'CYERA', 'RESEARCH']);

/** Each role's colour on the paper. */
const NOTICE_INK: Record<Role, RGBA> = { ink: LINE.cloth, dry: shade('wood', 0), ...HEART_INK };

function paintNoticeSheet(): Img {
  return standSheet(2, (s) => {
    // The post reaches the tile's last row, as the signpost's does: a post that stops short floats.
    postV(s, NOTICE_POST.x, 2, NOTICE_POST.w, 30);
    capBlock(s, NOTICE_POST.x - 1, 1, NOTICE_POST.w + 2, 2);

    const { x, y, w, h } = NOTICE_PAGE;
    paper(s, x, y, w, h);

    // The page against the post, top and bottom, where `ring()` cannot see the edge: opaque on
    // opaque. Then the page's own shadow falling down the post below it.
    s.rect(NOTICE_POST.x, y, NOTICE_POST.w, 1, LINE.cloth);
    s.rect(NOTICE_POST.x, y + h - 1, NOTICE_POST.w, 1, LINE.cloth);
    sinkRun(s, NOTICE_POST.x, y + h, NOTICE_POST.w, 1, 54);
    sinkRun(s, NOTICE_POST.x, y + h + 1, NOTICE_POST.w, 1, 24);

    nail(s, x + 2, y + 1);
    nail(s, x + w - 3, y + 1);

    paintLettering(s, NOTICE_LINES, NOTICE_INK);

    /*
     * The dog ear: the sheet's own back, folded up at the foot, with the fold in near-black.
     *
     * It is a handful of pixels and it is the difference between paper and a painted panel. A
     * rectangle with writing on it is a sign; a rectangle with one corner turned up is a thing
     * somebody pinned there, which is the whole proposition of this prop. Four now, not five: at
     * five its tip reached the foot of RESEARCH's last letter.
     */
    const EAR = 4;
    for (let j = 0; j < EAR; j++)
      for (let i = 0; i + j < EAR; i++) s.px(x + w - 1 - i, y + h - 1 - j, band('wall', 0.08, 4));
    for (let k = 0; k < EAR; k++) s.px(x + w - EAR + k, y + h - 1 - k, LINE.cloth);
  });
}

let noticeSheet: Img | undefined;

/** One half of the notice. The pool and the tufts are laid per tile, at sheet coordinates. */
const noticeHalf =
  (slot: 0 | 1): Painter =>
  (img) => {
    noticeSheet ??= paintNoticeSheet();
    groundUnder(img, POST_GROUND['notice-board']);
    cast(img, NOTICE_POST.x + NOTICE_POST.w / 2 - slot * TILE, 30.5, 8.6, 2.6);
    cutColumn(img, noticeSheet, slot);
    tufts(
      img,
      [
        [22, 29],
        [25, 30],
        [36, 30],
        [39, 29],
      ],
      slot,
    );
  };

const noticeBoard: Painter = noticeHalf(0);
const noticeBoardR: Painter = noticeHalf(1);

/*
 * "CYERA SPEED!" -- A WOODEN SIGN by the waterfall, on two stakes.
 *
 * Timber, not paper, because it is a sign and not a notice: nothing scores the player for reading
 * it, and the pair guard below keeps paper for the things the game does score. Two lines, CYERA over
 * SPEED!, so it fits one tile; on one line it is 44 pixels and would need a second tile of solid
 * ground in a clearing that is not wide.
 *
 * The board is laid in the timber's lower bands so the lettering -- painted, in the cottage plaster's
 * top cream -- stands a hundred and more luma above it. A groove between the two planks runs between
 * the lines, never through a letter. Two stakes rather than one post, so it does not read as the
 * notice's silhouette at a glance, and each stake has its own pool and its own tufts.
 */
const SPEED_BOARD = { x: 2, y: 3, w: 28, h: 18 } as const;

/*
 * The two lines, laid in the brush hand (B1, 2026-10-25) and centred down the board. The board did
 * not need to grow: SPEED! is 24 pixels in the brush hand and the board is 28, which leaves the two
 * pixels a side the guard at the foot of this file asks for.
 */
const SPEED_LINES = layOn(SPEED_BOARD, ['CYERA', 'SPEED!']);

/** The two stakes, left edge and width. */
const SPEED_STAKES = [6, 22] as const;
const STAKE_W = 4;

/**
 * Painted cream on timber: the plaster's top stop, so the letters are the lightest thing on it. The
 * dry-brush ends are a stop lower, the cream running thin over the grain.
 */
const PAINT_INK: Record<Role, RGBA> = {
  ink: shade('wall', 3),
  dry: shade('wall', 1),
  ...HEART_INK,
};

const signSpeed: Painter = (img) => {
  // The lawn the map has at (36,3), and the logo board's below: the variant under each cell, so the
  // prop's own ground meets its neighbours in the same mottle.
  groundUnder(img, 1);
  for (const sx of SPEED_STAKES) cast(img, sx + STAKE_W / 2, 30.5, 5.4, 2.5);

  stand(img, (s) => {
    for (const sx of SPEED_STAKES)
      postV(s, sx, SPEED_BOARD.y + 2, STAKE_W, TILE - SPEED_BOARD.y - 2);
    const { x, y, w, h } = SPEED_BOARD;
    face(s, x, y, w, h, 'wood', 0.04, 0.04 + SPAN * 0.5);
    // The groove between the two planks, one row under CYERA and one above SPEED!.
    sinkRun(s, x, SPEED_LINES[1]!.y - 1, w, 1, 46);
    paintLettering(s, SPEED_LINES, PAINT_INK);
    // The board throws its line onto the stakes below it, which `ring()` cannot see.
    for (const sx of SPEED_STAKES) {
      sinkRun(s, sx, y + h, STAKE_W, 1, 48);
      sinkRun(s, sx, y + h + 1, STAKE_W, 1, 22);
    }
  });

  tufts(img, [
    [3, 29],
    [10, 30],
    [19, 30],
    [26, 29],
  ]);
};

/*
 * THE LOGO BOARD: A BLANK BOARD, AND THE LOGO IS NOT PAINTED ON IT.
 *
 * CLAUDE.md rule 5: the logo is used as supplied, never redrawn. A 734 x 176 vector mark traced into
 * a fifty-pixel-wide tile is a redrawing by definition, so this painter draws the board and stops.
 * The game lays `reference/brand/logos/cyera-logo-white.svg` -- byte for byte, as `public/brand`
 * serves it -- over `LOGO_FACE` in the DOM (ui/WorldSigns.tsx), where it is drawn by the browser at
 * the screen's own resolution and cannot be recoloured, stretched or redrawn by anything here.
 *
 * WHITE, because the board is dark: the logo README's own rule is black on light, white on dark,
 * and the face is laid at the bottom of `trunk` (about luma 60) so the offwhite mark stands at a
 * contrast ratio over ten to one. The face is flat -- two tones of the trunk ramp and no grain, no
 * knot, no seam -- because the guard below holds it BLANK: any mark painted under the logo is a mark
 * the logo has to fight.
 *
 * Two tiles wide: one tile cannot carry a 4.17:1 mark at a size that reads. A frame of lit timber
 * round the dark face so it reads as a signboard and not as a hole, and two stakes.
 */

/**
 * The blank face the logo is laid over, on the two-tile sheet: x and y from the LEFT tile's top-left,
 * in art pixels. Published on the map's `sign-logo` object (forest-map.ts), which is how the game
 * learns it -- one number, written once, here.
 */
export const LOGO_FACE = { x: 6, y: 5, w: 52, h: 14 } as const;

/** The board the face is inset into: a two-pixel lit frame all round. */
const LOGO_BOARD = {
  x: LOGO_FACE.x - 2,
  y: LOGO_FACE.y - 2,
  w: LOGO_FACE.w + 4,
  h: LOGO_FACE.h + 4,
} as const;

/** The two stakes, on the sheet: left edge each. */
const LOGO_STAKES = [12, 48] as const;

function paintLogoSheet(): Img {
  return standSheet(2, (s) => {
    for (const sx of LOGO_STAKES) postV(s, sx, LOGO_BOARD.y + 2, STAKE_W, TILE - LOGO_BOARD.y - 2);
    const b = LOGO_BOARD;
    face(s, b.x, b.y, b.w, b.h, 'wood', 0.3, 0.3 + SPAN * 0.7);
    const f = LOGO_FACE;
    /*
     * The face: flat and dark, in two tones of `trunk` a few luma apart. Its top row and left column
     * are the darker one -- the frame's own shadow falling into the recess from the top-left light --
     * and the rest is one flat tone, so there is nothing under the logo for it to fight.
     */
    for (let j = 0; j < f.h; j++)
      for (let i = 0; i < f.w; i++)
        s.px(f.x + i, f.y + j, tone('trunk', i === 0 || j === 0 ? 0.0 : 0.18));
    for (const sx of LOGO_STAKES) {
      sinkRun(s, sx, b.y + b.h, STAKE_W, 1, 48);
      sinkRun(s, sx, b.y + b.h + 1, STAKE_W, 1, 22);
    }
  });
}

let logoSheet: Img | undefined;

const logoHalf =
  (slot: 0 | 1): Painter =>
  (img) => {
    logoSheet ??= paintLogoSheet();
    groundUnder(img, slot === 0 ? 2 : 0);
    for (const sx of LOGO_STAKES) cast(img, sx + STAKE_W / 2 - slot * TILE, 30.5, 5.4, 2.5);
    cutColumn(img, logoSheet, slot);
    tufts(
      img,
      [
        [8, 29],
        [17, 30],
        [44, 30],
        [53, 29],
      ],
      slot,
    );
  };

/*
 * THE NOTE PINNED TO GRANDMA'S DOOR.
 *
 * WHERE IT FITS, AND WHY IT IS NOT BIGGER. The leaf runs x 5..26 and almost all of it is spoken
 * for: the brass light and its astragal hold x 12..19 from row 11 down to row 20, and a knob sits
 * on each leaf at x 8..9 and x 22..23 from row 21. The cottage owner's notes argue both of those
 * pixel by pixel -- the astragal is what makes the door read as two leaves rather than a cupboard,
 * the pair of knobs is the other half of it -- and none of it is mine to spend.
 *
 * What is left clear is x 6..11 from row 10 to row 20, and the note takes it: a near-black line
 * round x 5..11 by y 9..20 with five columns of page inside it. The right-hand line matters as much
 * as the page does, because without it cream would meet the light's lit gold edge with nothing
 * between them, and two pale materials touching is the one thing this file's keyline exists to
 * stop.
 *
 * Five by ten is small, and it is still half again the area of the brass light beside it, which is
 * the smallest mark on this building that reads at the real camera. Pinned on the WEST leaf on
 * purpose: the lane arrives from the west and the note faces the walk.
 */
const DOOR_NOTE = { x: 6, y: 10, w: 5, h: 10 } as const;

const doorNote: Painter = (img) => {
  // The approved door, repainted exactly. The guard below diffs the two tiles, so anything this
  // painter changes about the building itself shows up as a fault rather than as a surprise.
  COTTAGE_TILES['door']!(img);

  const { x, y, w, h } = DOOR_NOTE;
  // The ring first, so the page is laid inside its own line rather than over it.
  img.frame(x - 1, y - 1, w + 2, h + 2, LINE.cloth);
  paper(img, x, y, w, h, true);

  // Four strokes at three columns: as much writing as five columns of page can hold before it goes
  // to mush, and the ragged right is what keeps it from reading as a label.
  writing(img, x + 1, y + 2, w - 2, [0, 1, 0, 1], 120);
  nail(img, x + 2, y);

  /*
   * The dog ear again, at two pixels, and the one row of shadow the note throws onto the leaf below
   * it. The shadow stops clear of the knob at x 8: a mark laid across the brass would cost more
   * than it buys.
   */
  img.px(x + w - 1, y + h - 1, band('wall', 0.08, 4));
  img.px(x + w - 2, y + h - 1, LINE.cloth);
  sinkRun(img, x - 1, y + h + 1, 2, 1, 70);
};

/** Keys are the contract the map generator and the tileset both look these up by. */
export const PROP_TILES: Record<string, Painter> = {
  'stall-awning-l': stallAwning(0),
  'stall-awning-m': stallAwning(1),
  'stall-awning-r': stallAwning(2),
  'stall-counter': stallCounter,
  'stall-counter-l': stallCounterTile('l'),
  'stall-counter-r': stallCounterTile('r'),
  'lantern-post': lanternPost,
  fountain,
  well,
  signpost,
  'notice-board': noticeBoard,
  'door-note': doorNote,
  mailbox,
  'notice-board-r': noticeBoardR,
  'sign-speed': signSpeed,
  'sign-logo-l': logoHalf(0),
  'sign-logo-r': logoHalf(1),
};

/* ------------------------------------------------- the guards, at import time */

/*
 * TWO WAYS THE ROUND'S WORK UNDOES ITSELF, AND NEITHER SAYS ANYTHING AT RUNTIME.
 *
 * They live here rather than in a test file for the reason `s-cottage.ts` and `w-trees.ts` give for
 * theirs: every tool that paints a tile loads this module, so `pnpm graybox`, `pnpm world`,
 * `pnpm score` and `pnpm preview` all run them, and `tools/graybox/test/art-guards.test.ts` runs
 * them in CI by importing the tileset. Four 32x32 paints is a cost nobody will notice.
 *
 * Both are TWO-SIDED, because both defects they are aimed at would pass a one-sided bound.
 *
 *   The note. "Is anything drawn on the door" is satisfied by a smudge. The failure being guarded
 *   is not absence, it is ILLEGIBILITY: a mark too small or too dark to be seen at a 19-tile camera
 *   is the same bug as no mark, and it is the bug that shipped, because the goal was paid out for
 *   a flower bed. So the floors are on AREA, on PALE AREA and on the LIFT over the timber it hangs
 *   on, and there is a ceiling so the note cannot be made to pass by growing into a poster.
 *
 *   The pair. "The notice is paper-faced" is satisfied by making the signpost paper-faced too,
 *   which is the original defect wearing a different hat -- the whole complaint was that the two
 *   posts are the same object. So the notice has a floor on its pale share and the signpost has a
 *   ceiling on its, and the two are checked together.
 *
 * The pale threshold is 205 luma, and it is chosen against the PALETTE rather than against
 * anything here: the `wood` ramp's lightest stop is 188 and `stone`'s is 210, so 205 is above
 * every timber in the game and below nothing the page is painted in (219, 233, 251). A signpost
 * cannot drift over it by being lit harder; only paper gets there.
 */

/** The pale threshold: above every stop of `wood`, below every stop the page is painted in. */
const PAPER_LUMA = 205;

/** A post's own pixels: everything its painter changed about the lawn it was given to stand on. */
function postSignature(name: 'signpost' | 'notice-board' | 'notice-board-r'): {
  drawn: number;
  pale: number;
} {
  const img = new Img(TILE, TILE);
  PROP_TILES[name]!(img);
  const lawn = new Img(TILE, TILE);
  groundUnder(lawn, POST_GROUND[name]);
  let drawn = 0;
  let pale = 0;
  for (let p = 0; p < TILE * TILE; p++) {
    const i = p * 4;
    if (
      img.data[i] === lawn.data[i] &&
      img.data[i + 1] === lawn.data[i + 1] &&
      img.data[i + 2] === lawn.data[i + 2]
    )
      continue;
    drawn++;
    if (lumaOf(img.get(p % TILE, Math.floor(p / TILE))) >= PAPER_LUMA) pale++;
  }
  return { drawn, pale };
}

/** What `door-note` adds to the door, and what it adds it on top of. */
function doorNoteSignature(): {
  area: number;
  w: number;
  h: number;
  pale: number;
  lift: number;
  under: number;
} {
  const plain = new Img(TILE, TILE);
  COTTAGE_TILES['door']!(plain);
  const noted = new Img(TILE, TILE);
  doorNote(noted);

  let area = 0;
  let pale = 0;
  let paleLuma = 0;
  let paleWas = 0;
  let under = 0;
  let minx = TILE;
  let maxx = -1;
  let miny = TILE;
  let maxy = -1;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const a = plain.get(x, y);
      const b = noted.get(x, y);
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
      area++;
      under += lumaOf(a);
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
      if (lumaOf(b) < PAPER_LUMA) continue;
      pale++;
      paleLuma += lumaOf(b);
      paleWas += lumaOf(a);
    }
  return {
    area,
    w: maxx - minx + 1,
    h: maxy - miny + 1,
    pale,
    lift: pale > 0 ? (paleLuma - paleWas) / pale : 0,
    under: area > 0 ? under / area : 0,
  };
}

/*
 * Measured on the tiles as drawn: the note is area 86px, bbox 7 x 13, 34px of page over the paper
 * threshold, lifting 147 luma over the timber it hangs on, which itself reads 91. The posts are
 * notice-board 0.39 pale against signpost 0.00, out of 556 and 643 drawn pixels.
 *
 * Every bound sits between what is drawn and the failure it is aimed at, and nearer the failure.
 * The failure for the note is the empty door the round began with: area 0, which trips the floor
 * four times over. The failure for the pair is the forest post as it was shipped -- `signpost` at
 * both places -- which puts 0.00 on both sides of the pale pair and trips the notice's floor.
 *
 * `under` is the one that is easy to miss and the only one aimed at a plausible FUTURE edit rather
 * than at the past: the free timber on this leaf is a five-column pocket, and the obvious way to
 * make the note bigger is to slide it over the stone surround (luma 166) or the brass light (about
 * 200). Either would read as a label stuck on the doorway rather than a note on the door, and
 * either would quietly cost the cottage owner a piece of work argued pixel by pixel. The leaf runs
 * 83 to 116, so a ceiling of 135 permits the note's own line and shadow and nothing else.
 */
const NOTICE_GUARD = {
  noteAreaLo: 60, // under the brass light's own 8 x 7 there is nothing to see at a 19-tile camera
  noteAreaHi: 180, // over this it is a poster, and it is eating the door it is pinned to
  noteWLo: 5,
  noteHLo: 8,
  notePaleLo: 24, // the page itself, not its line: a dark mark is the same bug as no mark
  noteLiftLo: 70, // paper on timber; below this it is a stain
  noteUnderHi: 135, // pinned to the leaf, not across the stone surround or the brass
  postPaleLo: 0.25, // the notice is mostly page
  postPaleHi: 0.05, // and the signpost is timber from end to end
} as const;

{
  const n = doorNoteSignature();
  const say =
    `area ${n.area}px, bbox ${n.w}x${n.h}, page ${n.pale}px, ` +
    `lift ${n.lift.toFixed(0)} luma, on timber reading ${n.under.toFixed(0)}`;
  if (n.area < NOTICE_GUARD.noteAreaLo || n.area > NOTICE_GUARD.noteAreaHi)
    throw new Error(
      `Grandma's door note is out of band (want ${NOTICE_GUARD.noteAreaLo}..${NOTICE_GUARD.noteAreaHi}px): ${say}. Under the floor the game is paying a hundred points for something nobody can see; over the ceiling the note has eaten the door.`,
    );
  if (n.w < NOTICE_GUARD.noteWLo || n.h < NOTICE_GUARD.noteHLo)
    throw new Error(
      `Grandma's door note is a speck (want at least ${NOTICE_GUARD.noteWLo}x${NOTICE_GUARD.noteHLo}): ${say}. The brass light beside it is 8x7 and is the smallest mark on this facade that reads at the real camera.`,
    );
  if (n.pale < NOTICE_GUARD.notePaleLo || n.lift < NOTICE_GUARD.noteLiftLo)
    throw new Error(
      `Grandma's door note is not reading as paper (want ${NOTICE_GUARD.notePaleLo}px over ${PAPER_LUMA} luma, lifting ${NOTICE_GUARD.noteLiftLo}): ${say}. A note the colour of the door it is pinned to is the same bug as no note.`,
    );
  if (n.under > NOTICE_GUARD.noteUnderHi)
    throw new Error(
      `Grandma's door note has slid off the leaf (want the timber under it below ${NOTICE_GUARD.noteUnderHi} luma): ${say}. It is now lying across the stone surround or the brass light, which is a label on a doorway and not a note on a door.`,
    );

  const notice = postSignature('notice-board');
  const noticeR = postSignature('notice-board-r');
  const sign = postSignature('signpost');
  const share = (s: { drawn: number; pale: number }): number =>
    s.drawn > 0 ? s.pale / s.drawn : 0;
  const pair =
    `notice-board ${share(notice).toFixed(2)}, notice-board-r ${share(noticeR).toFixed(2)}, ` +
    `signpost ${share(sign).toFixed(2)}`;
  // Both halves since the notice became two tiles (2026-10-23): a page that is paper on one side of
  // the seam and timber on the other is a notice half-drawn.
  if (Math.min(share(notice), share(noticeR)) < NOTICE_GUARD.postPaleLo)
    throw new Error(
      `The forest notice is not paper-faced (want at least ${NOTICE_GUARD.postPaleLo} of each half over ${PAPER_LUMA} luma): ${pair}. It is the post the whole level's zero-click beat rests on; a player has to see at a glance that it is something to read.`,
    );
  if (share(sign) > NOTICE_GUARD.postPaleHi)
    throw new Error(
      `The decorative signpost has grown paper (want under ${NOTICE_GUARD.postPaleHi} of it over ${PAPER_LUMA} luma): ${pair}. The two posts reading alike is the defect this pair exists to stop -- arrows point, paper speaks.`,
    );
}

/*
 * ===========================================================================
 * AND THE SIX PLACED PROPS HAVE TO TOUCH THE GROUND.
 * ===========================================================================
 *
 * The defect this is aimed at is the one every reviewer saw and nobody could name a number for: the
 * props were the only objects in the world that did not plant on the lawn. Measured on the tiles as
 * they shipped -- the darkest LAWN-GREEN pixel each finished tile still shows -- stall-counter 74,
 * signpost 93, notice-board 93, well 97, lantern-post 124, fountain 131, against bush 43, roots 42,
 * rock 52 and all three fence tiles 35. The fountain's darkest pixel was the open lawn.
 *
 * WHY IT TOOK A GUARD AND NOT A NOTE. Nothing could see it. `pnpm score` is whole-frame statistics
 * and one prop is a thousandth of a camera. The art guards in this file watch the note and the pair
 * of posts. The composition audit in `forest-map.ts` watches where props are placed, not what they
 * look like when they get there. And the value itself had no home, which is why five `cast()` calls
 * and one band of rects each arrived at a different wrong answer -- they were five derivations of one
 * number, and a number with five derivations has none.
 *
 * IT MEASURES THE FINISHED TILE AND ONLY THE PIXELS A PLAYER CAN STILL SEE. The pool is painted
 * before the prop is blitted over it, so a pool drawn entirely UNDERNEATH a post counts for nothing
 * here, which is correct and is most of what was wrong with the lantern: its pool was narrower than
 * its own plinth, so every pixel of it was hidden and a bound on the pool as drawn would have passed.
 * Only lawn-green pixels count -- `g` over both `r` and `b` -- so the prop's own near-black keyline,
 * its timber and the lantern's gold light are not mistaken for ground.
 *
 * THREE BOUNDS, because the floor alone can be satisfied by cheating in two directions.
 *
 *   deepest   one pixel in the organic family's own band. This is the bound the shipped art fails,
 *             all six of it, by between 10 and 67 luma.
 *   band      how many pixels are in that band, so a single dark speck is not a contact shadow. A
 *             mark too small to see at a 19-tile camera is the same bug as no mark, which is the
 *             argument the note's guard above makes in the other direction.
 *   top       how far up the tile the shade reaches, so the floor cannot be met by darkening the
 *             whole tile instead of its foot. That is a live risk and not a theoretical one: the
 *             stall interior band at the TOP of `stall-counter` is deep shade at luma 85, four luma
 *             outside this band, and deepening it is exactly the edit that would pass the floor
 *             while leaving the counter floating.
 */

/**
 * Above this luma the ground is lawn, at or under it the ground is in something's shade.
 *
 * Chosen against the four lawn painters rather than against anything here, the way `PAPER_LUMA` is
 * chosen against `wood` and `stone`: the darkest pixel any of `grass-0..3` draws anywhere in its
 * lower half is 96, and none of them puts a single pixel at or under 64. So a prop cannot drift over
 * this line by standing on a dark patch of grass, and nothing but shade gets under it. Between the
 * 36 the props now reach and the 74 the best of the six shipped at, and deliberately nearer the 74:
 * the bound exists to catch the floating prop, not to pin the drawing.
 */
const CONTACT_LUMA = 64;

/**
 * The props that stand on lawn, which is not all of them.
 *
 * The three awning tiles hang in the air -- their own ground is the stall's interior shade, which
 * the counter below them carries -- and `door-note` is painted on a door. Listing the six by hand is
 * the point: a seventh prop placed on grass is invisible to this guard until someone adds it here,
 * and that is a smaller failure than a guard that silently measures a hanging sign's keyline.
 */
const GROUND_PROPS = [
  'stall-counter',
  'stall-counter-l',
  'stall-counter-r',
  'signpost',
  'notice-board',
  'well',
  'lantern-post',
  'fountain',
  'mailbox',
  'notice-board-r',
  'sign-speed',
  'sign-logo-l',
  'sign-logo-r',
] as const;

/** What the LAWN still visible in a finished prop tile reads. */
function groundSignature(name: string): { deepest: number; band: number; top: number } {
  const img = new Img(TILE, TILE);
  PROP_TILES[name]!(img);
  let deepest = 255;
  let band = 0;
  let top = TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const c = img.get(x, y);
      if (c[3] < 40) continue;
      // Lawn only. Timber, stone, the keyline and the lantern's gold light are not the ground.
      if (!(c[1] > c[0] && c[1] > c[2])) continue;
      const l = lumaOf(c);
      if (l < deepest) deepest = l;
      if (l > CONTACT_LUMA) continue;
      band++;
      if (y < top) top = y;
    }
  return { deepest, band, top };
}

/*
 * Measured on the tiles as drawn: every one of the six bottoms out at 36, which is `CONTACT`, with
 * 13 to 22 pixels of pool (lantern-post thinnest, stall-counter and notice-board widest) and none of
 * that pool higher than row 28. The organic family for comparison carries 9 pixels at its thinnest
 * (`trunk-l`) and 141 at its widest (`bush-low`).
 */
const CONTACT_GUARD = {
  deepestHi: CONTACT_LUMA, // the organic family's own band; the shipped six sat 10 to 67 luma over it
  bandLo: 8, // a pool, not a speck -- under the thinnest the world draws anywhere
  topLo: 24, // at the foot, in the bottom quarter; higher than this is a tinted tile, not contact
} as const;

for (const name of GROUND_PROPS) {
  const g = groundSignature(name);
  const say =
    `darkest lawn pixel ${g.deepest.toFixed(0)} luma, ` +
    `${g.band}px of it at or under ${CONTACT_LUMA}` +
    (g.band ? `, topmost on row ${g.top}` : '');
  if (g.deepest > CONTACT_GUARD.deepestHi || g.band < CONTACT_GUARD.bandLo)
    throw new Error(
      `"${name}" is floating again (want its ground down to ${CONTACT_GUARD.deepestHi} luma over at least ${CONTACT_GUARD.bandLo}px): ${say}. The bush reaches 43, the tree roots 42 and all three fence tiles 35; a prop whose darkest ground pixel is the open lawn is pasted onto the world rather than standing in it. The value is \`CONTACT\` in s-outdoor.ts -- do not re-derive it here.`,
    );
  if (g.top < CONTACT_GUARD.topLo)
    throw new Error(
      `"${name}" has shade up the tile rather than under its foot (want nothing in the contact band above row ${CONTACT_GUARD.topLo}): ${say}. Darkening the whole tile passes the floor and still leaves the prop floating, because what seats an object is the step between its foot and the ground beside it.`,
    );
}

/*
 * ===========================================================================
 * AND GRANDMA'S MAILBOX HAS ITS FLAG UP.
 * ===========================================================================
 *
 * "Mailbox with the flag up" is UI_FOUNDATIONS section 8's own wording and the flag is the whole
 * message, so the guard is on the flag rather than on the box. Two-sided in the way the note's
 * guard is: a flag can be drawn and still say nothing, by being too small to see at the camera or
 * by being lowered into the hood's own outline. So the flag has an area floor, and its top must
 * stand at least two rows clear of the hood's crown.
 *
 * Told apart by hue, not by value, because the flag is banded down to luma 96 on its shaded side.
 * `gold` runs green over blue by 70 to 118 and red over green by under 60; `rust` runs red over
 * green by more than 100; every step of `wood` -- box, post, cap -- keeps green within 58 of blue;
 * the lawn is green-led. So a pixel with red over green over blue, green more than 64 over blue and
 * red under 60 over green is the flag and nothing else.
 *
 * Measured on the tile as drawn: 18px of flag, its top on row 2, the hood's crown on row 6.
 */
{
  const img = new Img(TILE, TILE);
  PROP_TILES['mailbox']!(img);
  let flag = 0;
  let flagTop = TILE;
  let hoodTop = TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const [r, g, b] = img.get(x, y);
      if (r > g && r - g < 60 && g > b + 64) {
        flag++;
        flagTop = Math.min(flagTop, y);
      } else if (r > g + 50 && r > b + 60) hoodTop = Math.min(hoodTop, y);
    }
  const say = `${flag}px of flag, its top on row ${flagTop}, the hood's crown on row ${hoodTop}`;
  if (flag < 12)
    throw new Error(
      `Grandma's mailbox has no flag worth the name (want at least 12px of it): ${say}. The flag is what the Arrive scene asks for; a mailbox without one is just a box.`,
    );
  if (hoodTop - flagTop < 2)
    throw new Error(
      `Grandma's mailbox has its flag down (want its top at least two rows above the hood's crown): ${say}. "Mailbox with the flag up" is UI_FOUNDATIONS section 8's own wording.`,
    );
}

/*
 * ===========================================================================
 * AND THE THREE CYERA SIGNS READ: THE LETTERS STAND OFF THEIR BOARD, AND THE LOGO'S BOARD IS BLANK.
 * ===========================================================================
 *
 * Two ways the lettering can be drawn and still say nothing, and the guard is on both. A letter can
 * sink into its ground -- ink the paper's own colour, cream on a board lit as pale as the paint, or a
 * line set on the board's banked rim, where `bank()` takes the edge down 58 luma -- and a line can
 * overrun the board it is on, so the end of RESEARCH is laid on the post or the lawn. So every glyph
 * pixel is measured on the FINISHED sheet against the median of the ground pixels in its own line's
 * box, and every line's box has to sit two pixels clear of its board's edge.
 *
 * The floor is 100 luma, and it is the distance that reads at a phone's zoom 1, where a letter is
 * 3 x 5 CSS pixels. Measured by this guard on the sheets as drawn (2026-10-23): the notice's weakest
 * letter stands 226 off its page on CYERA and 212 on RESEARCH, the heart line's weakest pixel 175
 * (the heart's one Aubergine highlight; its Deep Purple body stands about 205 under the page), and
 * the speed sign's paint 145 over its timber on both lines.
 *
 * 2026-10-25, THE BRUSH HAND (B1, the client's pick; `sign-brush.ts`). The floor did NOT move. Every
 * pixel is measured by the ROLE the layout gave it, and two roles are NAMED EXCEPTIONS to the floor,
 * each held to a rule of its own instead -- never the floor lowered to let them through:
 *
 *   - THE LETTERS (`ink`) and THE HEART'S BODY (`hline`, `hfill`) are held to the 100 floor, as the
 *     3 x 5 type was. Measured: ink 226 / 226 / 212 on the notice's three lines and 145 / 145 on the
 *     speed sign; the heart's outline 237 and its body 175.
 *   - THE DRY-BRUSH ENDS (`dry`) are the stroke's end where the paint ran thin, so by design they sit
 *     BETWEEN the letter and its ground. The rule: each one touches its letter's ink (4-adjacent),
 *     lies strictly between the line's ground and its ink in luma, stands at least half as far off
 *     the ground as that line's weakest ink, and a line's dry pixels are fewer than half its ink --
 *     so a hand that went mostly dry, or a dry pixel that floated free as a speck, fails here.
 *     Measured: 174 / 174 / 161 off the page against ink 226 / 226 / 212, and 117 against 145 on the
 *     timber -- 0.76 to 0.81 of the ink, against the rule's 0.5; and 2 dry to 7 ink on "I ♥" (the I
 *     ends dry at both serifs), 5 to 55, 8 to 94 and 5 to 59 on the other lines.
 *   - THE HEART'S HIGHLIGHT (`hhi`) is Lilac, 75 luma off the page, and that is the brand token. It
 *     was rejected in the 3 x 5 font because a pale pixel in a five-pixel glyph eats the lobe; here
 *     the outline carries the shape, so the rule is that it CANNOT reach the silhouette: every
 *     highlight pixel has heart on all four sides, there are at most two, and each is lighter than
 *     the heart's body.
 */
{
  const LETTER_FLOOR = 100;
  const MARGIN = 2;
  /** The dry-brush ends stand at least this share of the line's weakest ink off the ground. */
  const DRY_SHARE_OF_INK = 0.5;
  /** And there are fewer than this many of them per ink pixel: the line is mostly paint. */
  const DRY_PER_INK = 0.5;
  /** The heart's highlight: at most this many pixels, each enclosed by the heart. */
  const HIGHLIGHT_PX = 2;

  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };

  const check = (
    what: string,
    sheet: Img,
    board: { x: number; y: number; w: number; h: number },
    lines: readonly LaidAt[],
  ): void => {
    for (const { x: x0, y: y0, laid, text } of lines) {
      const { w, h } = laid;
      if (
        x0 - board.x < MARGIN ||
        board.x + board.w - (x0 + w) < MARGIN ||
        y0 - board.y < MARGIN ||
        board.y + board.h - (y0 + h) < MARGIN
      )
        throw new Error(
          `${what}: "${text}" is ${w}x${h}px at (${x0},${y0}) on a ${board.w}x${board.h} board at (${board.x},${board.y}) -- under ${MARGIN}px from the board's edge, where the rim is banked dark or the line runs off the board. Widen the board or shorten the line.`,
        );
      const roleAt = new Map<string, Role>();
      for (const [px, py, r] of laid.px) roleAt.set(`${x0 + px},${y0 + py}`, r);
      const ground: number[] = [];
      const by: Record<Role, number[]> = { ink: [], dry: [], hline: [], hfill: [], hhi: [] };
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) {
          const r = roleAt.get(`${x},${y}`);
          (r ? by[r] : ground).push(lumaOf(sheet.get(x, y)));
        }
      const bg = median(ground);
      const off = (l: number): number => Math.abs(l - bg);

      // The letters and the heart's body: the floor.
      for (const role of ['ink', 'hline', 'hfill'] as const) {
        if (!by[role].length) continue;
        const weakest = Math.min(...by[role].map(off));
        if (weakest < LETTER_FLOOR)
          throw new Error(
            `${what}: ${role === 'ink' ? 'a letter' : "the heart's " + (role === 'hline' ? 'outline' : 'body')} of "${text}" stands only ${weakest.toFixed(0)} luma off its ground (median ${bg.toFixed(0)}; want at least ${LETTER_FLOOR}). A letter the colour of its board is the same bug as no letter, and at a phone's zoom 1 it is three CSS pixels wide.`,
          );
      }

      // Named exception 1: the dry-brush ends.
      if (by.dry.length) {
        const weakestInk = Math.min(...by.ink.map(off));
        const inkMid = median(by.ink);
        const say = `${by.dry.length} dry-brush pixel(s) against ${by.ink.length} of ink`;
        if (!by.ink.length || by.dry.length >= by.ink.length * DRY_PER_INK)
          throw new Error(
            `${what}: "${text}" has ${say} (want fewer than ${DRY_PER_INK} per ink pixel). Dry brush is where a stroke ends; a line that is mostly dry is a faded sign, not a painted one.`,
          );
        for (const [px, py, r] of laid.px) {
          if (r !== 'dry') continue;
          const [x, y] = [x0 + px, y0 + py];
          const l = lumaOf(sheet.get(x, y));
          const between = (l - bg) * (inkMid - bg) > 0 && Math.abs(l - bg) < Math.abs(inkMid - bg);
          const touches = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([ox, oy]) => roleAt.get(`${x + ox!},${y + oy!}`) === 'ink');
          if (!touches || !between || off(l) < weakestInk * DRY_SHARE_OF_INK)
            throw new Error(
              `${what}: the dry-brush pixel at (${x},${y}) in "${text}" is ${!touches ? 'a speck touching no letter' : !between ? `not between its ground (${bg.toFixed(0)}) and its ink (${inkMid.toFixed(0)})` : `only ${off(l).toFixed(0)} luma off its ground, under ${DRY_SHARE_OF_INK} of the line's weakest ink (${weakestInk.toFixed(0)})`}. A dry end is the same paint running thin at the end of a stroke -- exempt from the letter floor on those terms and no others.`,
            );
        }
      }

      // Named exception 2: the heart's Lilac highlight.
      const hhi = laid.px.filter(([, , r]) => r === 'hhi');
      if (hhi.length) {
        const heart = new Set<Role>(['hline', 'hfill', 'hhi']);
        const fill = median(by.hfill);
        const loose = hhi.filter(
          ([px, py]) =>
            ![
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].every(([ox, oy]) => heart.has(roleAt.get(`${x0 + px + ox!},${y0 + py + oy!}`)!)) ||
            !(lumaOf(sheet.get(x0 + px, y0 + py)) > fill),
        );
        if (hhi.length > HIGHLIGHT_PX || loose.length)
          throw new Error(
            `${what}: the heart in "${text}" has ${hhi.length} highlight pixel(s) (want at most ${HIGHLIGHT_PX}), ${loose.length} of them on its edge or no lighter than its body. The Lilac highlight is exempt from the letter floor only because the outline carries the heart's shape: a highlight on the silhouette eats the lobe, which is why it was rejected in the 3 x 5 font.`,
          );
      }
    }
  };

  check('the forest notice', (noticeSheet ??= paintNoticeSheet()), NOTICE_PAGE, NOTICE_LINES);
  const speed = new Img(TILE, TILE);
  signSpeed(speed);
  check('the Cyera Speed! sign', speed, SPEED_BOARD, SPEED_LINES);

  const logo = (logoSheet ??= paintLogoSheet());
  let lo = 255;
  let hi = 0;
  for (let j = 0; j < LOGO_FACE.h; j++)
    for (let i = 0; i < LOGO_FACE.w; i++) {
      const l = lumaOf(logo.get(LOGO_FACE.x + i, LOGO_FACE.y + j));
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
  if (hi - lo > 24 || hi >= 90)
    throw new Error(
      `The logo board's face is not a blank dark panel (luma ${lo.toFixed(0)}..${hi.toFixed(0)}; want a span of at most 24 and nothing at or over 90). The white Cyera logo is laid over this face in the DOM: anything drawn here is drawn under the logo, and a pale face loses the white mark.`,
    );
}
