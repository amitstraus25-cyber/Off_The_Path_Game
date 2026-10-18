/*
 * Red, at 32 x 48: four facings by four frames, the sixteen frames she is on screen for the whole
 * game. Drawn again rather than scaled -- the 16px sprite doubled is still a 16px sprite -- and the
 * four times the pixels go on structure: a hood with a brim that overhangs a real face, a sleeve
 * that leaves the silhouette to reach the basket, a shin and a boot below the hem, weave courses in
 * the wicker.
 *
 * Colour, per docs/PIXEL_STANDARD.md section 2: every garment pixel comes from `cloak`, which the
 * 2026-10-18 rebrand moved to Cyera purple (Deep Purple, Aubergine, Lilac, Haze). Nothing here is a
 * raw hex and nothing here is lime. She is half her own frame in cloak, and that mass against a
 * green forest is the whole reason the eye finds her at a 26-tile camera.
 *
 * She is Lilac-led, which is option A of ART_PRODUCTION section 6a and the thing the first 32px
 * pass got backwards. That pass painted the body in Aubergine and left Lilac as a two-pixel rim,
 * so Aubergine outweighed Lilac about five to one and her median lightness landed at L*32 -- the
 * band every cast shadow in the world sits in, and darker than the fence, the roof and the bush.
 * She replaced a scarlet cloak that was the brightest thing on screen with one that was the
 * darkest, which is also how tree shade reads, and how the wolf reads.
 *
 * So the levels are used for what they are, not for where they sit in the ramp: Lilac (level 2) is
 * the subject everywhere, Aubergine (level 1) is the two columns turning away from the light with
 * a dithered third bridging into it, Deep Purple (level 0) is the outline, the deep
 * folds and the cloth gathered at the hem, and Haze (level 3) is a genuine highlight -- the crown
 * of the hood, the lip of the brim, and a one-pixel lit rim down the hood and the upper cloak.
 * `paint.ts` carries the role table and why level 2 holds the mass.
 *
 * Her outline is Deep Purple, her own dark, per PIXEL_STANDARD section 4. It used to be `ink`,
 * which that section reserves for the wolf so that he alone reads as a silhouette; ringing the
 * protagonist in the antagonist's black made the reservation distinguish nothing.
 *
 * Light is top-left always, which is why `left` is not `right` mirrored: mirroring would carry the
 * lit edge to the shaded side and she would read as a hole in the ground on half her frames.
 */
import { Img, shade } from '../paint.ts';

export const RED_FRAME_W = 32;
export const RED_FRAME_H = 48;

const CX = 16;
/** Bottom row of the boots. Below this is only the contact shadow. */
const FOOT = 45;
/** The hem sits at the knee and never moves: the body bobs into it, which is what makes a walk. */
const HEM = 37;

type Facing = 'down' | 'left' | 'right' | 'up';
const FACINGS: readonly Facing[] = ['down', 'left', 'right', 'up'];

/** Frame 0 stands; 1 and 3 are the strides, 2 is the pass-through back through standing. */
const STRIDE: readonly (-1 | 0 | 1)[] = [0, -1, 0, 1];

/** Hood, crown downward: 8px at the peak, opening to 20px around the face, easing onto the shoulder. */
const HOOD_HW = [4, 6, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9];
/** The opening cut into it, brim to chin. Ten rows: eleven made a jaw that hung out of the hood. */
const FACE_HW = [4, 5, 6, 6, 6, 6, 5, 5, 4, 3];
/** Seen from the side the opening is narrower and the chin comes further forward. */
const FACE_HW_SIDE = [3, 4, 5, 5, 5, 5, 5, 4, 4, 3];

/**
 * Cloak, indexed up from the hem so the hem never moves when the body bobs -- on a stride frame she
 * loses the top row instead, and that lost row is the dip.
 */
const CLOAK_HW = [10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8];
/** Edge-on she is a narrower column of cloth, but only just: it is a cloak, not a coat. */
const CLOAK_HW_SIDE = [9, 9, 9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];

/**
 * One horizontal run of cloth, lit from the left: an optional pixel of Haze rim, Lilac across the
 * body, then the side turning away -- a dithered column, two of Aubergine, and the last pixel in
 * Deep Purple so the shaded edge meets the outline as one dark lip. Hood, shoulder, sleeve and hem
 * all come through here, which is what keeps them reading as one garment rather than four.
 *
 * The shaded band is sized off the run, not fixed: three pixels of a twenty-pixel hem is a side in
 * shadow, three pixels of a four-pixel sleeve is a sleeve with the lights off.
 */
function clothRun(
  img: Img,
  y: number,
  x0: number,
  w: number,
  rim: boolean,
  skip?: (i: number) => boolean,
): void {
  const shaded = Math.min(w >= 10 ? 3 : 2, Math.max(1, w - 2));
  for (let i = 0; i < w; i++) {
    if (skip?.(i)) continue;
    let level: 0 | 1 | 2 | 3 = 2;
    if (rim && i === 0) level = 3;
    else if (i === w - 1) level = 0;
    else if (i >= w - shaded) level = 1;
    else if (i === w - shaded - 1 && (y & 1) === 1) level = 1;
    img.px(x0 + i, y, shade('cloak', level));
  }
}

/** The hood: dome, lit crown, the brim, and the opening carved back out of it. */
function paintHood(img: Img, t: number, facing: Facing, dir: number): void {
  const side = facing === 'left' || facing === 'right';
  const hoodCx = CX + dir;
  HOOD_HW.forEach((raw, i) => {
    const hw = raw - (side ? 1 : 0);
    clothRun(img, t + i, hoodCx - hw, hw * 2, true);
  });

  // Crown: the top light lands here first, so Haze steps down the dome's lit shoulder and stops.
  // Each row starts at the dome's own left edge -- one pixel further in on the side facings -- so
  // the highlight tucks into the rim clothRun laid there instead of hanging a pixel off it.
  [5, 4, 3, 1].forEach((len, i) => {
    const hw = HOOD_HW[i]! - (side ? 1 : 0);
    img.rect(hoodCx - hw, t + i, len, 1, shade('cloak', 3));
  });

  if (facing === 'up') {
    // Turned away: no opening, so the seam down the back and the hair at the nape carry the frame.
    // The seam is a crease, so it takes Aubergine; Deep Purple on a Lilac back reads as a slot.
    img.line(hoodCx, t + 4, hoodCx, t + 12, shade('cloak', 1));
    // Hair spilling out of the hood and widening onto the shoulders. Tried as a band (a letterbox)
    // and as a point-down taper (a bib); it only reads as hair when it falls the way hair falls.
    [2, 3, 4, 5, 5].forEach((hw, j) => {
      const y = t + 14 + j;
      img.rect(hoodCx - hw, y, hw * 2, 1, shade('trunk', 1));
      img.rect(hoodCx - hw, y, 2, 1, shade('trunk', 2));
      img.rect(hoodCx + hw - 2, y, 2, 1, shade('trunk', 0));
    });
    img.rect(hoodCx - 2, t + 13, 4, 1, shade('cloak', 0));
    return;
  }

  const profile = side ? FACE_HW_SIDE : FACE_HW;
  const fx = hoodCx + dir * 3;

  // The opening, carved as skin.
  profile.forEach((hw, j) => {
    const y = t + 5 + j;
    img.rect(fx - hw, y, hw * 2, 1, shade('skin', 1));
    img.rect(fx - hw, y, 2, 1, shade('skin', 2));
    img.rect(fx + hw - 2, y, 2, 1, shade('skin', 0));
    // The jaw, so the chin is a turning face rather than where the skin happens to stop.
    if (j === profile.length - 1) img.rect(fx - hw, y, hw * 2, 1, shade('skin', 0));
  });

  // Brim: one row of lit lip following the opening. It has to be brighter than the hood behind it
  // or it disappears, and the hood is Lilac now, so the lip is Haze -- fourteen levels up, where
  // the old Aubergine hood needed fifty-two and turned the brim into a white headband. It still
  // gets one row and no more, and it darkens into the shaded end like any other cloth.
  const brimHw = profile[0]! + 1;
  img.rect(fx - brimHw, t + 4, brimHw * 2, 1, shade('cloak', 3));
  img.rect(fx + brimHw - 3, t + 4, 2, 1, shade('cloak', 1));
  img.px(fx + brimHw - 1, t + 4, shade('cloak', 0));
  img.px(fx - brimHw - 1, t + 5, shade('cloak', 3));
  // ...and what it casts on the forehead. Without this the hood sits on her face like a wig.
  img.rect(fx - profile[0]!, t + 5, profile[0]! * 2, 1, shade('skin', 0));

  // Fringe under the brim, then a lock either side of the jaw.
  const fringeHw = profile[1]!;
  img.rect(fx - fringeHw, t + 6, fringeHw * 2, 2, shade('trunk', 1));
  img.rect(fx - fringeHw, t + 6, fringeHw, 1, shade('trunk', 2));
  img.rect(fx - fringeHw, t + 8, 1, 3, shade('trunk', 1));
  img.rect(fx + fringeHw - 1, t + 8, 1, 3, shade('trunk', 0));

  if (side) {
    // Profile: one eye, a pixel of nose at the leading edge, a cheek behind it.
    img.rect(fx + dir - (dir < 0 ? 1 : 0), t + 9, 2, 2, shade('ink', 0));
    img.px(fx + dir * 5, t + 10, shade('skin', 0));
    img.px(fx + dir * 5, t + 11, shade('skin', 2));
    img.px(fx - dir * 3, t + 11, shade('skin', 0));
  } else {
    img.rect(fx - 4, t + 9, 2, 2, shade('ink', 0));
    img.rect(fx + 2, t + 9, 2, 2, shade('ink', 0));
    img.rect(fx - 5, t + 12, 2, 1, shade('skin', 0));
    img.rect(fx + 3, t + 12, 2, 1, shade('skin', 0));
  }
}

/** Shoulders to hem, with two folds, the throat clasp and a scalloped edge. */
function paintCloak(img: Img, shoulder: number, facing: Facing, dir: number, sway: number): void {
  const profile = facing === 'left' || facing === 'right' ? CLOAK_HW_SIDE : CLOAK_HW;
  const cx = CX + dir;
  for (let y = HEM; y >= shoulder; y--) {
    const fromHem = HEM - y;
    const hw = profile[Math.min(fromHem, profile.length - 1)]!;
    // Shallow scallops on the last row, phased by the stride so the hem swings as she walks.
    const skip = (i: number): boolean => fromHem === 0 && (i + sway) % 5 === 2;
    // The rim light stops partway down: the shoulder and the upper fall catch the top-left light,
    // the skirt below has turned out of it. Carried to the hem it stops being a highlight and
    // becomes a second outline in the wrong colour.
    clothRun(img, y, cx - hw, hw * 2, fromHem > 12, skip);
  }
  for (let y = shoulder + 5; y <= HEM - 1; y++) {
    const spread = Math.floor((y - shoulder) / 7);
    // Folds are Aubergine against a Lilac body -- thirty-eight levels, plenty at this size -- and
    // deepen to Deep Purple over the last few rows, where the cloth gathers onto the hem.
    const level = y >= HEM - 4 ? 0 : 1;
    img.px(cx - 3 - spread, y, shade('cloak', level));
    img.px(cx + 3 + spread, y, shade('cloak', level));
  }
  if (facing !== 'up') {
    img.rect(cx - 1, shoulder + 1, 2, 1, shade('gold', 2));
    img.rect(cx - 1, shoulder + 2, 2, 1, shade('gold', 0));
  }
}

/** Shins and boots. The near leg is the lit one; the far leg drops a level so the two separate. */
function paintLegs(img: Img, facing: Facing, stride: -1 | 0 | 1, dir: number): void {
  const leg = (x: number, lift: number, near: boolean): void => {
    img.rect(x, HEM - 1 - lift, 4, 7, shade('ink', near ? 3 : 2));
    img.rect(x, HEM - 1 - lift, 1, 7, shade('ink', near ? 2 : 1));
    const by = FOOT - 2 - lift;
    const sideOn = facing === 'left' || facing === 'right';
    const bx = sideOn ? x - (dir < 0 ? 2 : 0) : x - 1;
    const bw = sideOn ? 6 : 5;
    img.rect(bx, by, bw, 3, shade('trunk', near ? 1 : 0));
    img.rect(bx, by, bw, 1, shade('trunk', near ? 2 : 1));
    img.rect(bx, by + 2, bw, 1, shade('trunk', 0));
  };

  if (facing === 'left' || facing === 'right') {
    // Edge-on the legs pass each other, so the stride is horizontal and the far leg is darker.
    // Standing, the far leg still steps back a pixel: feet exactly together read as one leg.
    const cx = CX + dir - 2;
    leg(cx - (stride === 0 ? dir : stride * dir * 4), stride === 0 ? 0 : 2, false);
    leg(cx + stride * dir * 4, 0, true);
  } else {
    const lead = facing === 'up' ? -stride : stride;
    leg(CX - 5 - (lead < 0 ? 1 : 0), lead < 0 ? 2 : 0, lead <= 0);
    leg(CX + 1 + (lead > 0 ? 1 : 0), lead > 0 ? 2 : 0, lead >= 0);
  }
}

/**
 * The basket, in the off hand in every frame. It is the detail that says errand rather than walk,
 * so it is never hidden behind her: on the facings where her carrying arm would fall on the far
 * side it swings forward instead. Eight pixels across buys a handle, a rim, three weave courses and
 * the cloth over the top -- which is also the one warm note on an otherwise purple sprite.
 */
function paintBasket(img: Img, bx: number, by: number): void {
  img.line(bx + 1, by + 2, bx + 1, by, shade('wood', 0));
  img.line(bx + 1, by, bx + 6, by, shade('wood', 2));
  img.line(bx + 6, by, bx + 6, by + 2, shade('wood', 0));
  img.rect(bx + 1, by + 2, 6, 2, shade('wall', 2));
  img.rect(bx + 1, by + 2, 3, 1, shade('wall', 3));
  img.rect(bx, by + 3, 8, 1, shade('wood', 2));
  img.rect(bx, by + 4, 8, 4, shade('wood', 1));
  img.rect(bx, by + 4, 1, 4, shade('wood', 2));
  img.rect(bx + 7, by + 4, 1, 4, shade('wood', 0));
  img.rect(bx + 1, by + 5, 6, 1, shade('wood', 0));
  img.rect(bx + 1, by + 7, 6, 1, shade('wood', 0));
  img.px(bx + 3, by + 4, shade('wood', 0));
  img.px(bx + 5, by + 6, shade('wood', 0));
}

/**
 * The sleeve. It has to leave the silhouette to be seen at all -- an arm drawn inside the body
 * outline is only two fold lines -- so it swells past the shoulder and carries the hand down onto
 * the basket handle. It paints after the basket, because the hand grips in front of the handle.
 *
 * Only the arm on her lit side takes a lit edge. Giving the far arm one too put a pale seam down
 * the middle of her chest, which is the kind of mistake that only shows once you look at it.
 */
function paintArm(img: Img, shoulder: number, cx: number, sign: number, handY: number): void {
  for (let i = 0; i < 9; i++) {
    const y = shoulder + 2 + i;
    const outer = 7 + Math.floor(i / 3);
    const x0 = sign > 0 ? cx + outer - 3 : cx - outer;
    clothRun(img, y, x0, 4, sign < 0);
    if (sign > 0) img.px(x0, y, shade('cloak', 0)); // crease where the arm meets the body
  }
  const hx = sign > 0 ? cx + 8 : cx - 10;
  img.rect(hx, handY, 3, 3, shade('skin', 1));
  img.rect(hx, handY, 3, 1, shade('skin', 2));
  img.rect(hx, handY + 2, 3, 1, shade('skin', 0));
}

function paintFrame(img: Img, facing: Facing, phase: 0 | 1 | 2 | 3): void {
  const stride = STRIDE[phase]!;
  const bob = stride === 0 ? 0 : 1;
  const dir = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
  const t = 1 + bob;
  const shoulder = t + 16;

  const body = new Img(RED_FRAME_W, RED_FRAME_H);
  paintLegs(body, facing, stride, dir);
  paintCloak(body, shoulder, facing, dir, stride + 1);

  // Which side the basket hangs on. Down and right show her off hand; up and left swing it forward,
  // because a Red without a visible basket is just a girl in a coat.
  const onRight = facing === 'down' || facing === 'right';
  const by = shoulder + 9 - bob;
  paintBasket(body, onRight ? CX + dir + 6 : CX + dir - 14, by);
  paintArm(body, shoulder, CX + dir, onRight ? 1 : -1, by - 1);

  paintHood(body, t, facing, dir);
  // Her own dark, per PIXEL_STANDARD section 4. `ink` is the wolf's, so that he alone is a
  // silhouette; at Deep Purple the rim still sits thirty-nine levels under the grass it crosses.
  body.outline(shade('cloak', 0));

  // Contact shadow last and underneath, so `outline` never rings it: an outlined shadow is a hole.
  img.ellipse(CX + 0.5, FOOT + 1.5, 8, 2.2, shade('shadow', 2));
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
