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
 * which the 2026-10-18 rebrand moved to Cyera purple, and she stays Lilac-led (section 12's one
 * deliberate departure from the board: match its form, not its red). The levels are used for their
 * role rather than their index -- Lilac (2) is the subject and holds the mass, Haze (3) is a real
 * highlight on the upper-left arc, Aubergine (1) is the lower-right turning out of the light, and
 * Deep Purple (0) is the keyline, the hood's underside and the deep folds. `paint.ts` carries the
 * role table and the reason level 2 leads.
 *
 * Her keyline is Deep Purple, her own dark: ART_DIRECTION section 3.1 passes `cloak[0]` at L35 and
 * section 14 lists it as already correct, and `ink` stays reserved for the wolf so that he alone
 * reads as a silhouette. Section 3.2's second pixel is here too -- the keyline thickens to 2 px
 * along the bottom and the lower-right and nowhere else, which is what seats her on the ground.
 *
 * Light is top-left always, which is why `left` is not `right` mirrored: mirroring would carry the
 * lit arc round to the shaded side and she would read as a hole in the ground on half her frames.
 */
import { Img, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';

export const RED_FRAME_W = 32;
export const RED_FRAME_H = 48;

const CX = 16;
/** Bottom row of the boots. The 2 px keyline lands under it and the contact shadow under that. */
const FOOT = 43;
/** Bottom row of cloth. Fixed: the body bobs into the hem, which is what makes a walk. */
const HEM = 36;

type Facing = 'down' | 'left' | 'right' | 'up';
const FACINGS: readonly Facing[] = ['down', 'left', 'right', 'up'];

/** Frame 0 stands; 1 and 3 are the strides, 2 passes back through standing. */
const STRIDE: readonly (-1 | 0 | 1)[] = [0, -1, 0, 1];

/**
 * The hood, crown downward, as half-widths: 8 px at the peak opening to 24 across the middle and
 * tucking back to 20 where the shoulders take over. Twenty rows, because the board gives the hood
 * 45 per cent of her height and she is 43 rows tall.
 */
const HOOD_HW = [4, 6, 8, 9, 10, 10, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 10];
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
 * she loses the top row instead, and that lost row is the dip. Shoulders at 16, hip at 22, hem at
 * 20: the board's bell, and always narrower than the hood above it.
 */
const CLOAK_HW = [10, 10, 11, 11, 12, 12, 12, 12, 12, 12, 11, 10, 9, 8, 7, 7, 7];
/** Edge-on she is a narrower column of cloth, but only just: it is a cloak, not a coat. */
const CLOAK_HW_SIDE = [9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 8, 7, 6, 6, 6];

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
 * Deep Purple never comes out of here. Section 5 gives a character four tones per material --
 * keyline, shade, base, light -- so on Red level 0 is the keyline and the one line under the hood,
 * and nothing else. Letting the shader reach it put the dome's whole lower-right quadrant at L42
 * and took her to half her pixels below L81, which is the opposite of the problem she exists to
 * solve: she is meant to be the brightest thing in a green forest.
 */
function domeLevel(dx: number, dy: number): 1 | 2 | 3 {
  const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
  // The light sits mostly in the plane of the picture -- 0.66 across against 0.36 out of it. A
  // light with more depth than that puts its brightest point at the middle of the dome, which is a
  // rendered ball; the board puts it on the upper-left arc, which is a drawn one.
  const lit = -0.66 * (dx + dy) + 0.36 * z;
  if (lit > 0.74) return 3;
  if (lit > -0.12) return 2;
  return 1;
}

/** One horizontal run of the hood dome. `cy` is the dome's centre row, not the run's. */
function domeRun(img: Img, y: number, cx: number, hw: number, cy: number): void {
  const w = hw * 2;
  for (let i = 0; i < w; i++) {
    const x = cx - hw + i;
    let level = domeLevel((x + 0.5 - cx) / HOOD_RX, (y + 0.5 - cy) / HOOD_RY);
    // The shaded lip where the cloth meets the keyline, so the dark edge reads as one line.
    if (i === w - 1) level = 1;
    // Section 4: the highlight sits one pixel in from the keyline and never touches it.
    if (i === 0 && level === 3) level = 2;
    img.px(x, y, shade('cloak', level));
  }
}

/**
 * One horizontal run of hanging cloth -- shoulder, sleeve, skirt, hem. Section 4's cylinder: a lit
 * column one pixel in from the left silhouette, the base across the middle, shade down the right
 * quarter, then the dark lip against the keyline.
 *
 * The shaded band is sized off the run, not fixed: four pixels of a twenty-pixel hem is a side in
 * shadow, four pixels of a five-pixel sleeve is a sleeve with the lights off.
 */
function clothRun(
  img: Img,
  y: number,
  x0: number,
  w: number,
  rim: boolean,
  skip?: (i: number) => boolean,
): void {
  // Section 4's cylinder: shade down the right quarter, then the dark lip against the keyline.
  const shaded = Math.min(Math.round(w * 0.25), Math.max(1, w - 3));
  for (let i = 0; i < w; i++) {
    if (skip?.(i)) continue;
    let level: 0 | 1 | 2 | 3 = 2;
    if (i === w - 1) level = 0;
    else if (i >= w - shaded) level = 1;
    else if (i === w - shaded - 1 && (y & 1) === 1) level = 1;
    else if (rim && i === 1) level = 3;
    img.px(x0 + i, y, shade('cloak', level));
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

  profile.forEach((hw, j) => {
    const y = fy + j;
    img.rect(fx - hw, y, hw * 2, 1, shade('skin', 1));
    img.rect(fx - hw, y, 2, 1, shade('skin', 2));
    img.rect(fx + hw - 2, y, 2, 1, shade('skin', 0));
    // The jaw, so the chin is a turning face rather than where the skin happens to stop.
    if (j === profile.length - 1) img.rect(fx - hw, y, hw * 2, 1, shade('skin', 0));
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
      const lit = i < 3 ? 2 : i > top * 2 - 4 ? 0 : 1;
      img.px(x, fy + j, shade('trunk', j === 0 ? 0 : lit));
    }
  }

  if (side) {
    // Profile: one eye, a pixel of nose at the leading edge, a cheek behind it.
    const ex = fx + dir * 2 - (dir < 0 ? 1 : 0);
    img.rect(ex, fy + 5, 2, 3, shade('ink', 0));
    img.px(fx + dir * 5, fy + 6, shade('skin', 0));
    img.px(fx + dir * 5, fy + 7, shade('skin', 2));
    img.rect(fx - dir * 4, fy + 8, 2, 1, shade('skin', 0));
    img.rect(fx + dir, fy + 9, 2, 1, shade('trunk', 0));
    return;
  }

  // Two pixels of eye, three rows tall: the board draws a tall oval and at 48 px there is room.
  img.rect(fx - 5, fy + 4, 2, 3, shade('ink', 0));
  img.rect(fx + 3, fy + 4, 2, 3, shade('ink', 0));
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
    domeRun(img, t + i, hoodCx, hw, hoodCy);
    for (let x = hoodCx - hw; x < hoodCx + hw; x++) bottom.set(x, t + i);
  });

  // Section 10.4's dark line between the hood and the shoulders, laid along the lowest pixel of
  // each column so that it follows the dome's own curve. It is what makes the hood a separate mass
  // sitting *over* her rather than the top of a single tapering column, and without it the bottle
  // comes straight back. Drawn as a flat row instead it reads as a chin strap.
  bottom.forEach((y, x) => img.px(x, y, shade('cloak', 0)));

  if (facing === 'up') return; // Turned away, the hood is the whole head. The board draws no hair.

  const profile = side ? FACE_HW_SIDE : FACE_HW;
  const fx = hoodCx + dir * 2;
  const fy = t + 6;

  // Section 10.3's interior keyline, where the hood meets the face. One pixel of Deep Purple all
  // round the opening is most of what makes the board's faces sit *inside* their hoods. It stops
  // above the chin: the line under the hood is one row further down and two solid dark rows that
  // close together read as a letterbox rather than as a hood.
  for (let j = -1; j < profile.length; j++) {
    const near = [j - 1, j, j + 1]
      .map((k) => profile[Math.min(Math.max(k, 0), profile.length - 1)]!)
      .reduce((a, b) => Math.max(a, b));
    img.rect(fx - near - 1, fy + j, (near + 1) * 2, 1, shade('cloak', 0));
  }

  // The brim: one row of lit lip above the opening, darkening into the shaded end like any cloth.
  const brim = profile[0]! + 2;
  img.rect(fx - brim, fy - 2, brim * 2, 1, shade('cloak', 3));
  img.rect(fx + brim - 4, fy - 2, 3, 1, shade('cloak', 1));
  img.px(fx + brim - 1, fy - 2, shade('cloak', 0));

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
    // The rim light stops partway down: the shoulder and the upper fall catch the top-left light,
    // the skirt below has turned out of it. Carried to the hem it stops being a highlight and
    // becomes a second outline in the wrong colour.
    clothRun(img, y, cx - hw, hw * 2, HEM - y > 9, skip);
  }
  // Where the arms hang. One crease a side is all the board gives them, and it is enough: without
  // it the bell is a single undivided sheet and the sleeves have nothing to be. The crease on the
  // lit side is the deeper one, because that is the edge the light has to fall off.
  for (let y = shoulder + 3; y <= shoulder + 10 && y < HEM; y++) {
    img.px(cx - 6, y, shade('cloak', 0));
    img.px(cx + 5, y, shade('cloak', 1));
  }
  // The gathering at the hem, two folds deep, in shade rather than in the keyline colour: a Deep
  // Purple fold on a Lilac skirt reads as a slot cut through her.
  for (let y = HEM - 4; y <= HEM; y++) {
    img.px(cx - 2, y, shade('cloak', 1));
    img.px(cx + 3, y, shade('cloak', 1));
  }
}

/** Shins and boots. The near leg is the lit one; the far leg drops a level so the two separate. */
function paintLegs(img: Img, facing: Facing, stride: -1 | 0 | 1, dir: number): void {
  const leg = (x: number, lift: number, near: boolean): void => {
    // Trousers. The board keeps them blue through the rebrand -- section 12 moves her scarlet and
    // the terracotta roof and nothing else -- and they are the one cool note that stops her reading
    // as a single purple lozenge. `water` level 0 is the denim; level 1 is a lit edge on the near
    // leg only, which is all that separates the two at this size.
    const top = HEM + 1 - lift;
    img.rect(x, top, 5, 4, shade('water', 0));
    if (near) img.rect(x, top, 1, 4, shade('water', 1));
    const by = FOOT - 2 - lift;
    const sideOn = dir !== 0;
    const bx = sideOn ? x - (dir < 0 ? 2 : 0) : x - 1;
    const bw = sideOn ? 7 : 6;
    img.rect(bx, by, bw, 3, shade('trunk', near ? 1 : 0));
    img.rect(bx, by, bw, 1, shade('trunk', near ? 2 : 1));
    img.rect(bx, by + 2, bw, 1, shade('trunk', 0));
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
  img.rect(bx + 2, by, 5, 1, shade('wood', 2));
  img.rect(bx + 1, by + 1, 1, 2, shade('wood', 1));
  img.rect(bx + 7, by + 1, 1, 2, shade('wood', 0));
  img.rect(bx, by + 3, 9, 1, shade('wood', 2));
  img.rect(bx + 1, by + 4, 7, 1, shade('wood', 3));
  img.rect(bx + 1, by + 4, 3, 1, shade('wall', 3));
  img.rect(bx, by + 5, 9, 5, shade('wood', 1));
  img.rect(bx, by + 5, 1, 5, shade('wood', 2));
  img.rect(bx + 8, by + 5, 1, 5, shade('wood', 0));
  img.rect(bx + 1, by + 6, 7, 1, shade('wood', 0));
  img.rect(bx + 1, by + 8, 7, 1, shade('wood', 0));
  img.px(bx + 3, by + 7, shade('wood', 0));
  img.px(bx + 6, by + 9, shade('wood', 0));
}

/**
 * The sleeve. It has to leave the silhouette to be seen at all -- an arm drawn inside the body
 * outline is only a fold line -- so it swells past the bell and carries the hand down onto the
 * basket handle. It paints after the basket, because the hand grips in front of the handle.
 *
 * Only the arm on her lit side takes a lit edge. Giving the far arm one too put a pale seam down
 * the middle of her, which is the kind of mistake that only shows once you look at it.
 */
function paintArm(img: Img, shoulder: number, cx: number, sign: number, handY: number): void {
  for (let i = 0; i < 8; i++) {
    const y = shoulder + 4 + i;
    const outer = 9 + Math.floor(i / 4);
    const x0 = sign > 0 ? cx + outer - 4 : cx - outer;
    clothRun(img, y, x0, 4, sign < 0);
    if (sign > 0) img.px(x0, y, shade('cloak', 0)); // crease where the arm meets the body
  }
  const hx = sign > 0 ? cx + 9 : cx - 11;
  img.rect(hx, handY, 3, 3, shade('skin', 1));
  img.rect(hx, handY, 3, 1, shade('skin', 2));
  img.rect(hx, handY + 2, 3, 1, shade('skin', 0));
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
function keyline(img: Img, c: RGBA): void {
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
  paintBasket(body, onRight ? 22 : 1, by);
  paintArm(body, shoulder, CX + dir, onRight ? 1 : -1, by + 2);

  paintHood(body, t, facing, dir);
  keyline(body, shade('cloak', 0));

  // Contact shadow first and underneath, so the keyline never rings it: an outlined shadow is a
  // hole. Section 4 sizes it at 1.4x the boots and puts it in the ground's own dark, opaque,
  // because docs/ASSETS.md forbids partial alpha against transparency.
  img.ellipse(CX + 1.5, FOOT + 2.5, 9, 2.4, shade('shadow', 1));
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
