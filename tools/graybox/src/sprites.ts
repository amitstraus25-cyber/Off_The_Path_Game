// Character sprites, dialogue portraits and item icons.
import { Img, noise, shade } from './paint.ts';
import type { RGBA } from './paint.ts';

const CLEAR: RGBA = [0, 0, 0, 0];
export const RED_W = 16;
export const RED_H = 24;

type Facing = 'down' | 'left' | 'right' | 'up';
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up'];

/**
 * Red: hooded cloak, boots and a basket. `step` is -1, 0 or 1 for the walk cycle, which swings the
 * legs and bobs the body one pixel so movement reads at this size.
 */
function paintRed(facing: Facing, step: -1 | 0 | 1): Img {
  const img = new Img(RED_W, RED_H);
  const bob = step === 0 ? 0 : 1;
  const top = 3 + bob;
  const side = facing === 'left' || facing === 'right';
  const flip = facing === 'left' ? -1 : 1;

  // --- legs, drawn first so the cape hangs over them ---
  const legY = 20;
  const front = step > 0 ? 1 : 0;
  const back = step < 0 ? 1 : 0;
  img.rect(6, legY - front, 2, 3, shade('ink', 2));
  img.rect(9, legY - back, 2, 3, shade('ink', 2));
  img.rect(5, legY + 2 - front, 3, 2, shade('trunk', 0));
  img.rect(9, legY + 2 - back, 3, 2, shade('trunk', 0));

  // --- cape: narrow at the shoulders, flaring to the hem ---
  for (let i = 0; i < 9; i++) {
    const y = top + 8 + i;
    const halfWidth = 3 + Math.floor(i / 2.2);
    img.rect(8 - halfWidth, y, halfWidth * 2, 1, shade('cloak', 1));
    img.rect(8 - halfWidth, y, 2, 1, shade('cloak', 2)); // lit edge
    img.rect(8 + halfWidth - 2, y, 2, 1, shade('cloak', 0)); // shaded edge
  }
  // Clasp and the fold down the back.
  img.px(8, top + 8, shade('gold', 2));
  if (facing === 'up') img.line(8, top + 10, 8, top + 16, shade('cloak', 0));

  // --- hood ---
  img.ellipse(8, top + 4, 5, 5, shade('cloak', 1));
  img.rect(3, top + 4, 10, 4, shade('cloak', 1));
  img.ellipse(6.5, top + 3, 3.5, 3.5, shade('cloak', 2));
  // Peak at the back of the hood.
  img.ellipse(8, top + 1, 4, 2, shade('cloak', 2));

  if (facing === 'up') {
    // Facing away: hood only, with a lock of hair at the nape.
    img.rect(5, top + 7, 6, 2, shade('trunk', 1));
    img.rect(5, top + 7, 6, 1, shade('trunk', 2));
  } else {
    // Face opening, tucked towards the side she faces.
    const fx = side ? 8 + flip : 8;
    const faceW = side ? 3 : 4;
    img.rect(fx - faceW + 1, top + 3, faceW + 1, 5, shade('skin', 1));
    img.rect(fx - faceW + 1, top + 3, faceW, 4, shade('skin', 2));
    // Fringe under the hood brim.
    img.rect(fx - faceW + 1, top + 2, faceW + 1, 1, shade('trunk', 1));
    if (side) {
      img.px(fx, top + 5, shade('ink', 0));
      img.px(fx + flip, top + 6, shade('skin', 0)); // nose
    } else {
      img.px(6, top + 5, shade('ink', 0));
      img.px(10, top + 5, shade('ink', 0));
      img.px(8, top + 7, shade('cloak', 0)); // mouth
    }
    // Hair falling past the jaw.
    img.rect(side ? 8 - flip * 3 : 4, top + 6, 2, 3, shade('trunk', 1));
    if (!side) img.rect(11, top + 6, 2, 3, shade('trunk', 1));
  }

  // --- the basket she is carrying to Grandma's ---
  if (facing !== 'up') {
    const bx = side ? (flip > 0 ? 1 : 12) : 1;
    img.line(bx, top + 10, bx + 2, top + 10, shade('wood', 0));
    img.rect(bx, top + 11, 3, 4, shade('wood', 1));
    img.rect(bx, top + 11, 3, 1, shade('wood', 2));
    img.line(bx, top + 13, bx + 2, top + 13, shade('wood', 0));
  }

  img.outline(shade('ink', 0));
  return img;
}

export function paintRedSheet(): { sheet: Img; frames: Record<string, unknown> } {
  const sheet = new Img(RED_W * 4, RED_H * 4);
  const frames: Record<string, unknown> = {};
  FACINGS.forEach((facing, row) => {
    const steps: (-1 | 0 | 1)[] = [0, -1, 0, 1];
    steps.forEach((step, col) => {
      const x = col * RED_W;
      const y = row * RED_H;
      sheet.blit(paintRed(facing, step), x, y);
      const name = col === 0 ? `red-idle-${facing}-0` : `red-walk-${facing}-${col - 1}`;
      frames[name] = {
        frame: { x, y, w: RED_W, h: RED_H },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: RED_W, h: RED_H },
        sourceSize: { w: RED_W, h: RED_H },
      };
    });
  });
  return { sheet, frames };
}

/** Each NPC painter draws one frame; `blink` is the second idle frame. */
type NpcPainter = (img: Img, blink: boolean) => void;

const rabbit: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  // Ears.
  img.ellipse(6, 5 + y, 1.6, 4, shade('fur', 1));
  img.ellipse(10, 4 + y, 1.6, 4, shade('fur', 1));
  img.ellipse(6, 5 + y, 0.8, 2.8, [240, 170, 190, 255]);
  img.ellipse(10, 4 + y, 0.8, 2.8, [240, 170, 190, 255]);
  // Body and head.
  img.ellipse(8, 18 + y, 5, 5, shade('fur', 1));
  img.ellipse(8, 11 + y, 4.5, 4, shade('fur', 2));
  img.ellipse(6.5, 10 + y, 3, 2.5, shade('fur', 3));
  img.ellipse(13, 19 + y, 2, 2, shade('fur', 3)); // tail
  // Face.
  if (!blink) {
    img.px(6, 11 + y, shade('ink', 0));
    img.px(10, 11 + y, shade('ink', 0));
  } else {
    img.line(5, 11 + y, 6, 11 + y, shade('ink', 0));
    img.line(9, 11 + y, 10, 11 + y, shade('ink', 0));
  }
  img.px(8, 13 + y, [240, 150, 170, 255]);
  img.outline(shade('ink', 0));
};

const owl: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  img.ellipse(8, 15 + y, 5.5, 7, shade('trunk', 1));
  img.ellipse(8, 13 + y, 4.5, 5, shade('trunk', 2));
  // Wings.
  img.ellipse(3.5, 15 + y, 2, 5, shade('trunk', 0));
  img.ellipse(12.5, 15 + y, 2, 5, shade('trunk', 0));
  // Big eyes, the owl's whole read.
  img.ellipse(6, 10 + y, 2.6, 2.6, shade('wall', 2));
  img.ellipse(10, 10 + y, 2.6, 2.6, shade('wall', 2));
  if (!blink) {
    img.ellipse(6, 10 + y, 1.3, 1.3, shade('ink', 0));
    img.ellipse(10, 10 + y, 1.3, 1.3, shade('ink', 0));
    img.px(5, 9 + y, shade('wall', 3));
    img.px(9, 9 + y, shade('wall', 3));
  } else {
    img.line(4, 10 + y, 7, 10 + y, shade('ink', 0));
    img.line(9, 10 + y, 12, 10 + y, shade('ink', 0));
  }
  img.px(8, 12 + y, shade('gold', 1));
  img.px(8, 13 + y, shade('gold', 0));
  // Ear tufts and feet.
  img.px(4, 6 + y, shade('trunk', 0));
  img.px(12, 6 + y, shade('trunk', 0));
  img.rect(6, 21 + y, 2, 2, shade('gold', 1));
  img.rect(9, 21 + y, 2, 2, shade('gold', 1));
  img.outline(shade('ink', 0));
};

const lanternKeeper: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  // A hedgehog in a travelling coat, holding the lantern.
  img.ellipse(8, 17 + y, 6, 6, shade('night', 3));
  img.ellipse(8, 16 + y, 5, 5, shade('night', 2));
  // Spines.
  for (const [sx, sy] of [
    [3, 13],
    [5, 11],
    [8, 10],
    [11, 11],
    [13, 13],
  ] as const)
    img.ellipse(sx, sy + y, 1.6, 2, shade('night', 1));
  // Face.
  img.ellipse(8, 14 + y, 3.4, 3, shade('trunk', 2));
  img.ellipse(8, 15 + y, 1.6, 1.4, shade('trunk', 1));
  if (!blink) {
    img.px(6, 13 + y, shade('ink', 0));
    img.px(10, 13 + y, shade('ink', 0));
  } else {
    img.line(6, 13 + y, 7, 13 + y, shade('ink', 0));
    img.line(9, 13 + y, 10, 13 + y, shade('ink', 0));
  }
  img.px(8, 15 + y, shade('ink', 0));
  // Lantern in hand.
  img.rect(12, 16 + y, 4, 5, shade('gold', 0));
  img.rect(13, 17 + y, 2, 3, shade('gold', 3));
  img.px(13, 15 + y, shade('wood', 0));
  img.ellipse(14, 18 + y, 4, 4, shade('gold', 3, 45));
  img.outline(shade('ink', 0));
};

/**
 * The wolf: two idle frames, a window silhouette, and waiting at the door in Grandma's things.
 *
 * Built from triangles and a protruding muzzle rather than the stacked ellipses every other
 * animal here uses. That vocabulary is why he used to read as a grey cub: at 16px a round body
 * with small ears IS a rabbit. The silhouette has to differ before the colour does.
 */
function paintWolf(frame: 0 | 1 | 2 | 3): Img {
  const img = new Img(RED_W, RED_H);
  const dark = frame >= 2;
  const base = dark ? shade('ink', 0) : shade('wolf', 0);
  const mid = dark ? shade('ink', 0) : shade('wolf', 2);
  const lit = dark ? shade('ink', 1) : shade('wolf', 3);
  const y = frame === 1 ? 1 : 0;

  // Tall triangular ears, leaning out. Drawn first so the skull overlaps their bases.
  const ear = (cx: number, lean: number): void => {
    for (let i = 0; i < 6; i++) {
      const w = 1 + i;
      img.rect(Math.round(cx - w / 2 + lean * i), 1 + y + i, w, 1, base);
    }
  };
  ear(4, -0.22);
  ear(11, 0.22);

  // Narrow chest, not a round belly: he is lean where the rabbit is soft.
  img.ellipse(8, 18 + y, 4.6, 5.6, base);
  img.ellipse(8, 17 + y, 3.8, 4.6, mid);
  // Tail, low and heavy.
  img.ellipse(13, 19 + y, 2.2, 3.2, base);

  // Skull, then the muzzle pushing down out of it.
  img.ellipse(8, 9 + y, 4.6, 4.2, base);
  img.ellipse(7, 8 + y, 3.4, 3, mid);
  img.ellipse(8, 12 + y, 2.4, 2.4, mid);
  img.ellipse(8, 13 + y, 1.8, 1.6, lit);
  img.px(8, 11 + y, shade('ink', 0));

  // Amber, the only warm thing about him, and the only colour the silhouette keeps.
  for (const ex of [6, 10]) {
    img.px(ex, 9 + y, shade('gold', dark ? 1 : 3));
    img.px(ex, 10 + y, shade('gold', 0));
  }

  if (frame === 3) {
    // At the door: Grandma's shawl over the shoulders and her bonnet on his head.
    // A shawl drapes from the shoulders; it does not pool at his feet. Keep it narrow and cool
    // so the warm fur still reads above and below it.
    img.ellipse(8, 16 + y, 5.4, 2.6, shade('stone', 1));
    img.ellipse(8, 15 + y, 4.6, 1.8, shade('stone', 2));
    for (let i = 0; i < 4; i++) img.px(5 + i * 2, 18 + y, shade('stone', 0));
    // Her bonnet, small enough that his ears still show on both sides.
    img.ellipse(8, 4 + y, 4.2, 1.8, shade('wall', 1));
    img.ellipse(8, 3 + y, 3.4, 1.3, shade('wall', 3));
    for (let i = 0; i < 4; i++) img.px(5 + i * 2, 6 + y, shade('wall', 0));
  }
  img.outline(shade('ink', 0));
  return img;
}

/*
 * Bystanders. They offer no skill and carry no capability, so they are drawn to read as scenery
 * that happens to talk: no basket, no lantern, nothing held out towards Red. Each one is built
 * from a single strong silhouette so it is still legible at 16px beside a tree.
 */

/**
 * Convinced he is a signpost. Everything above the stem is cap, so the silhouette is a toadstool
 * before the face is read at all; the face and the pointing twig are what turn it into a person.
 */
const toadstool: NpcPainter = (img, blink) => {
  // Rooted, so he never bobs: standing perfectly still is the whole joke.
  img.ellipse(8, 23, 5, 1.5, shade('shadow', 1));
  // Stem, wide enough that the eyes are not swallowed by the outline at its edges.
  img.rect(4, 13, 8, 10, shade('wall', 1));
  img.rect(4, 13, 4, 10, shade('wall', 2));
  // Cap.
  img.ellipse(8, 11, 7.5, 5, shade('roof', 1));
  img.ellipse(8, 9, 6.5, 3.5, shade('roof', 2));
  img.line(1, 13, 14, 13, shade('roof', 0));
  for (const [sx, sy, r] of [
    [4, 10, 1.4],
    [11, 9, 1.6],
    [8, 7, 1.1],
  ] as const)
    img.ellipse(sx, sy, r, r * 0.85, shade('wall', 3));
  // Face, well inside the stem.
  if (!blink) {
    img.px(6, 17, shade('ink', 0));
    img.px(9, 17, shade('ink', 0));
  } else {
    img.line(5, 17, 6, 17, shade('ink', 0));
    img.line(9, 17, 10, 17, shade('ink', 0));
  }
  img.line(7, 19, 8, 19, shade('ink', 2));
  // The twig arm, held out with great authority, pointing at nothing in particular.
  img.line(12, 16, 15, 14, shade('wood', 1));
  img.px(15, 13, shade('wood', 2));
  img.px(14, 12, shade('wood', 2));
  img.outline(shade('ink', 0));
};

/**
 * Repeats whatever she last overheard. Perched and facing left, with the long wedge tail that
 * separates a magpie from every other black-and-white bird at this size.
 */
const magpie: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  // Tail first, so the body laps over where it joins.
  for (const [i, dy] of [0, 1, 2].entries())
    img.line(10, 16 + dy + y, 15, 20 + dy + y, shade('ink', i === 1 ? 2 : 1));
  // Body, small and round; a perched bird is mostly chest.
  img.ellipse(7, 15 + y, 4, 4.5, shade('ink', 1));
  img.ellipse(6, 16 + y, 2.4, 3, shade('fur', 2));
  // Folded wing, with the white bar and the green sheen magpies actually have.
  img.ellipse(9, 15 + y, 2, 4, shade('ink', 0));
  img.line(9, 13 + y, 9, 16 + y, shade('fur', 1));
  img.px(10, 14 + y, shade('water', 0));
  // Head, clearly separate from the body.
  img.ellipse(6, 9 + y, 3, 3, shade('ink', 1));
  img.line(3, 10 + y, 1, 11 + y, shade('gold', 1));
  img.px(2, 11 + y, shade('gold', 0));
  // The bead she is not going to give back.
  img.px(1, 12 + y, shade('gold', 3));
  if (!blink) {
    img.ellipse(5, 9 + y, 1.4, 1.4, shade('fur', 3));
    img.px(5, 9 + y, shade('ink', 0));
  } else {
    img.line(4, 9 + y, 6, 9 + y, shade('fur', 2));
  }
  img.rect(5, 19 + y, 1, 3, shade('gold', 1));
  img.rect(7, 19 + y, 1, 3, shade('gold', 1));
  img.outline(shade('ink', 0));
};

/** A snail delivering a parcel. He set out on Tuesday. It is going very well. */
const snail: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  // Foot, kept low and narrow so the shell stays the loudest shape.
  img.ellipse(8, 22 + y, 6.5, 2, shade('stone', 2));
  img.ellipse(8, 21 + y, 5.5, 1.2, shade('stone', 3));
  img.ellipse(4, 19 + y, 2.2, 3, shade('stone', 2));
  // Shell, wound the right way round.
  img.ellipse(10, 17 + y, 5, 5, shade('wood', 1));
  img.ellipse(10, 17 + y, 3.4, 3.4, shade('wood', 2));
  img.ellipse(10.8, 17.6 + y, 1.8, 1.8, shade('wood', 0));
  img.px(11, 18 + y, shade('wood', 3));
  // The parcel, tied on top and going nowhere fast.
  img.rect(8, 9 + y, 5, 4, shade('cloak', 1));
  img.rect(8, 9 + y, 5, 1, shade('cloak', 2));
  img.line(8, 11 + y, 12, 11 + y, shade('gold', 2));
  img.line(10, 9 + y, 10, 12 + y, shade('gold', 2));
  // Eye stalks, high and clear of the shell.
  img.line(3, 18 + y, 2, 12 + y, shade('stone', 2));
  img.line(5, 18 + y, 6, 12 + y, shade('stone', 2));
  img.ellipse(2, 11 + y, 1.5, 1.5, shade('fur', 3));
  img.ellipse(6, 11 + y, 1.5, 1.5, shade('fur', 3));
  if (!blink) {
    img.px(2, 11 + y, shade('ink', 0));
    img.px(6, 11 + y, shade('ink', 0));
  } else {
    img.line(1, 11 + y, 3, 11 + y, shade('ink', 0));
    img.line(5, 11 + y, 7, 11 + y, shade('ink', 0));
  }
  img.outline(shade('ink', 0));
};

/**
 * Sitting, facing out, tail curled round her feet.
 *
 * Built the way the rabbit is: everything is overlapping ellipses, so `outline` wraps one
 * silhouette. Ears drawn clear of the head come back as two dark horns, because the outline fills
 * the transparent gap between them and the skull. No whiskers either, for the same reason the
 * rabbit has none: at 16px they land as white blocks floating beside the face.
 */
const cat: NpcPainter = (img, blink) => {
  const y = blink ? 1 : 0;
  img.ellipse(8, 23, 5, 1.4, shade('shadow', 1));
  // Ears first, short and wide set, overlapping where the skull will go.
  img.ellipse(5, 7 + y, 1.9, 2.8, shade('stone', 1));
  img.ellipse(11, 7 + y, 1.9, 2.8, shade('stone', 1));
  img.ellipse(5, 7.4 + y, 0.9, 1.7, shade('cloak', 1));
  img.ellipse(11, 7.4 + y, 0.9, 1.7, shade('cloak', 1));
  // Haunch and head.
  img.ellipse(8, 19 + y, 5, 4.8, shade('stone', 1));
  img.ellipse(8, 11 + y, 4.3, 3.8, shade('stone', 1));
  img.ellipse(6.8, 10.3 + y, 2.8, 2.4, shade('stone', 2));
  // Tabby bars, the cheapest thing that says cat rather than rabbit.
  img.line(6, 17 + y, 10, 17 + y, shade('stone', 0));
  img.line(5, 20 + y, 11, 20 + y, shade('stone', 0));
  // Tail round the front of the feet, in the lightest step so it reads against the body.
  img.ellipse(12, 21 + y, 2, 1.4, shade('stone', 3));
  img.line(11, 22 + y, 5, 22 + y, shade('stone', 3));
  img.px(4, 22 + y, shade('stone', 0));
  if (!blink) {
    img.px(6, 11 + y, shade('gold', 2));
    img.px(10, 11 + y, shade('gold', 2));
  } else {
    img.line(5, 11 + y, 6, 11 + y, shade('ink', 0));
    img.line(10, 11 + y, 11, 11 + y, shade('ink', 0));
  }
  img.px(8, 13 + y, shade('cloak', 2));
  img.outline(shade('ink', 0));
};

/** Keyed by the map object name, which is also the texture key the scene looks up. */
export const NPC_PAINTERS: Record<string, NpcPainter> = {
  'npc-rabbit': rabbit,
  'npc-owl': owl,
  'npc-lantern-keeper': lanternKeeper,
  'bystander-toadstool': toadstool,
  'bystander-magpie': magpie,
  'bystander-snail': snail,
  'bystander-cat': cat,
};

export function paintNpcSheet(name: string): Img {
  if (name === 'npc-wolf') {
    const sheet = new Img(RED_W * 4, RED_H);
    for (const frame of [0, 1, 2, 3] as const) sheet.blit(paintWolf(frame), frame * RED_W, 0);
    return sheet;
  }
  const painter = NPC_PAINTERS[name];
  if (!painter) throw new Error(`No painter for ${name}`);
  const sheet = new Img(RED_W * 2, RED_H);
  for (const blink of [false, true]) {
    const frame = new Img(RED_W, RED_H);
    painter(frame, blink);
    sheet.blit(frame, blink ? RED_W : 0, 0);
  }
  return sheet;
}

// ---------------------------------------------------------------- portraits (32x32)

type PortraitPainter = (img: Img) => void;

const portraitRed: PortraitPainter = (img) => {
  img.rect(0, 0, 32, 32, shade('night', 2));
  img.ellipse(16, 34, 16, 14, shade('cloak', 1)); // shoulders
  img.ellipse(16, 17, 12, 13, shade('cloak', 1)); // hood
  img.ellipse(16, 18, 9, 10, shade('skin', 1)); // face
  img.ellipse(15, 16, 8, 8, shade('skin', 2));
  img.ellipse(16, 9, 10, 5, shade('trunk', 1)); // fringe
  img.ellipse(16, 11, 11, 4, shade('cloak', 2)); // hood brim
  // Eyes, brows, mouth.
  img.ellipse(12, 18, 1.6, 1.8, shade('wall', 3));
  img.ellipse(20, 18, 1.6, 1.8, shade('wall', 3));
  img.px(12, 18, shade('ink', 0));
  img.px(20, 18, shade('ink', 0));
  img.line(10, 15, 13, 15, shade('trunk', 0));
  img.line(19, 15, 22, 15, shade('trunk', 0));
  img.line(14, 24, 18, 24, shade('cloak', 0));
  img.px(11, 22, shade('cloak', 2));
  img.px(21, 22, shade('cloak', 2));
};

const portraitRabbit: PortraitPainter = (img) => {
  img.rect(0, 0, 32, 32, shade('night', 2));
  img.ellipse(11, 10, 3.5, 8, shade('fur', 1));
  img.ellipse(21, 9, 3.5, 8, shade('fur', 1));
  img.ellipse(11, 10, 1.8, 5.5, [240, 170, 190, 255]);
  img.ellipse(21, 9, 1.8, 5.5, [240, 170, 190, 255]);
  img.ellipse(16, 22, 11, 10, shade('fur', 1));
  img.ellipse(15, 20, 9, 8, shade('fur', 2));
  img.ellipse(14, 18, 5, 4, shade('fur', 3));
  img.ellipse(12, 20, 2, 2.2, shade('ink', 0));
  img.ellipse(20, 20, 2, 2.2, shade('ink', 0));
  img.px(11, 19, shade('wall', 3));
  img.px(19, 19, shade('wall', 3));
  img.ellipse(16, 25, 1.8, 1.4, [240, 150, 170, 255]);
  img.line(14, 27, 18, 27, shade('fur', 0));
  for (const wy of [24, 26]) {
    img.line(4, wy, 10, wy - 1, shade('fur', 0));
    img.line(22, wy - 1, 28, wy, shade('fur', 0));
  }
};

const portraitOwl: PortraitPainter = (img) => {
  img.rect(0, 0, 32, 32, shade('night', 2));
  img.ellipse(16, 22, 13, 12, shade('trunk', 1));
  img.ellipse(16, 20, 11, 10, shade('trunk', 2));
  img.ellipse(5, 24, 3, 7, shade('trunk', 0));
  img.ellipse(27, 24, 3, 7, shade('trunk', 0));
  img.ellipse(11, 18, 6, 6, shade('wall', 2));
  img.ellipse(21, 18, 6, 6, shade('wall', 2));
  img.ellipse(11, 18, 3, 3, shade('ink', 0));
  img.ellipse(21, 18, 3, 3, shade('ink', 0));
  img.px(10, 17, shade('wall', 3));
  img.px(20, 17, shade('wall', 3));
  img.ellipse(16, 23, 2, 3, shade('gold', 1));
  img.ellipse(16, 22, 1.6, 2, shade('gold', 2));
  img.ellipse(7, 7, 3, 3.5, shade('trunk', 0));
  img.ellipse(25, 7, 3, 3.5, shade('trunk', 0));
  for (let i = 0; i < 10; i++) img.px(10 + i, 28, shade('trunk', 0));
};

const portraitKeeper: PortraitPainter = (img) => {
  img.rect(0, 0, 32, 32, shade('night', 2));
  img.ellipse(16, 24, 13, 11, shade('night', 3));
  for (const [sx, sy] of [
    [5, 16],
    [9, 11],
    [16, 9],
    [23, 11],
    [27, 16],
  ] as const)
    img.ellipse(sx, sy, 3.5, 4.5, shade('night', 1));
  img.ellipse(16, 21, 8, 7, shade('trunk', 2));
  img.ellipse(16, 24, 3.6, 3, shade('trunk', 1));
  img.ellipse(12, 19, 1.8, 2, shade('ink', 0));
  img.ellipse(20, 19, 1.8, 2, shade('ink', 0));
  img.px(11, 18, shade('wall', 3));
  img.px(19, 18, shade('wall', 3));
  img.ellipse(16, 24, 1.4, 1.2, shade('ink', 0));
  // Lantern glow from the side.
  img.ellipse(28, 26, 5, 5, shade('gold', 3, 60));
  img.rect(26, 23, 5, 6, shade('gold', 0));
  img.rect(27, 24, 3, 4, shade('gold', 3));
};

const portraitWolfGrandma: PortraitPainter = (img) => {
  img.rect(0, 0, 32, 32, shade('night', 1));

  /*
   * The reveal. It works on one contrast: the SILHOUETTE has to say Grandma while the FACE says
   * wolf. So the bonnet is drawn last and sits properly on the skull, the shawl is cool grey
   * against warm fur, and his ears push out from under the brim where a grandmother has none.
   *
   * The previous version was a flat cat face: no muzzle, round eyes, and a row of white squares
   * for teeth that read as a grin rather than a mouth.
   */

  // Grandma's shawl. Cool grey, never Red's red -- the cloak ramp belongs to Red alone.
  img.ellipse(16, 33, 17, 11, shade('stone', 0));
  img.ellipse(16, 34, 15, 9, shade('stone', 1));

  // Ears first: tall triangles, leaning outward, so the brim can cut across their bases.
  const ear = (cx: number, lean: number): void => {
    for (let i = 0; i < 9; i++) {
      const w = 1 + i;
      img.rect(Math.round(cx - w / 2 + lean * i), 2 + i, w, 1, shade('wolf', 0));
    }
    for (let i = 3; i < 8; i++) {
      const w = Math.max(1, i - 3);
      img.rect(Math.round(cx - w / 2 + lean * i), 4 + i, w, 1, shade('wolf', 2));
    }
  };
  ear(5, -0.2);
  ear(27, 0.2);

  // Skull, lit from the upper left like everything else in this forest.
  img.ellipse(16, 19, 10.5, 9.5, shade('wolf', 0));
  img.ellipse(16, 18, 9.5, 8.5, shade('wolf', 2));
  img.ellipse(14, 16, 7, 5.5, shade('wolf', 3));

  // The muzzle: it has to break the circle of the head, or he reads as a cat.
  img.ellipse(16, 25, 6, 5.5, shade('wolf', 1));
  img.ellipse(16, 26, 5, 4.5, shade('wolf', 3));
  img.ellipse(16, 28, 3.6, 2.8, shade('wall', 0));
  img.ellipse(16, 23, 2.4, 1.6, shade('ink', 0));
  img.px(15, 22, shade('wall', 2));

  // Two fangs, not a row of squares. A mouth you notice a second late.
  for (const fx of [13, 19]) {
    img.px(fx, 29, shade('wall', 3));
    img.px(fx, 30, shade('wall', 2));
  }

  // Amber, and narrowed. Round eyes read friendly; these do not.
  for (const ex of [11, 21]) {
    img.ellipse(ex, 17, 3, 2.1, shade('gold', 1));
    img.ellipse(ex, 17, 2.4, 1.6, shade('gold', 3));
    img.ellipse(ex, 17, 1, 1.2, shade('ink', 0));
    img.px(ex - 1, 16, shade('wall', 3));
  }

  // The bonnet, over the skull and under the ears. Its scalloped brim is the Grandma tell.
  img.ellipse(16, 6, 8.5, 3.6, shade('wall', 1));
  img.ellipse(16, 5, 7.5, 3, shade('wall', 2));
  img.ellipse(14, 4, 5, 1.8, shade('wall', 3));
  for (let i = 0; i < 7; i++) img.ellipse(6 + i * 3.4, 9, 2, 1.8, shade('wall', 2));
  for (let i = 0; i < 7; i++) img.px(Math.round(6 + i * 3.4), 10, shade('wall', 0));
  img.line(6, 8, 26, 8, shade('wall', 0));
};

export const PORTRAIT_PAINTERS: Record<string, PortraitPainter> = {
  'portrait-red': portraitRed,
  'portrait-rabbit': portraitRabbit,
  'portrait-owl': portraitOwl,
  'portrait-keeper': portraitKeeper,
  'portrait-wolf-grandma': portraitWolfGrandma,
};

// ---------------------------------------------------------------- items (32x32)

type ItemPainter = (img: Img) => void;

const compass: ItemPainter = (img) => {
  img.ellipse(16, 16, 13, 13, shade('gold', 0));
  img.ellipse(16, 16, 11.5, 11.5, shade('gold', 1));
  img.ellipse(16, 16, 10, 10, shade('wall', 2));
  img.ellipse(14, 14, 6, 6, shade('wall', 3));
  // Needle: north red, south white, as on the board.
  img.line(16, 16, 21, 9, shade('cloak', 1));
  img.line(16, 16, 20, 10, shade('cloak', 2));
  img.line(16, 16, 11, 23, shade('wall', 1));
  img.ellipse(16, 16, 1.6, 1.6, shade('ink', 0));
  for (const [x, y] of [
    [16, 6],
    [26, 16],
    [16, 26],
    [6, 16],
  ] as const)
    img.px(x, y, shade('ink', 0));
  img.rect(14, 1, 4, 4, shade('gold', 0));
  img.rect(15, 2, 2, 2, shade('gold', 2));
  img.outline(shade('ink', 0));
};

const translator: ItemPainter = (img) => {
  // An open book of tongues.
  img.ellipse(16, 20, 14, 9, shade('water', 0));
  img.rect(2, 11, 28, 12, shade('water', 1));
  img.rect(2, 11, 28, 2, shade('water', 2));
  img.rect(3, 13, 12, 10, shade('wall', 2));
  img.rect(17, 13, 12, 10, shade('wall', 2));
  img.rect(15, 11, 2, 13, shade('water', 0));
  for (let i = 0; i < 4; i++) {
    img.line(5, 15 + i * 2, 13, 15 + i * 2, shade('stone', 0));
    img.line(19, 15 + i * 2, 27, 15 + i * 2, shade('stone', 0));
  }
  img.ellipse(16, 8, 4, 4, shade('gold', 2));
  img.px(16, 8, shade('gold', 0));
  img.outline(shade('ink', 0));
};

const lantern: ItemPainter = (img) => {
  img.rect(13, 1, 6, 2, shade('wood', 0));
  img.line(16, 3, 16, 6, shade('wood', 1));
  img.rect(8, 6, 16, 4, shade('gold', 0));
  img.rect(9, 10, 14, 15, shade('gold', 1));
  img.rect(11, 12, 10, 11, shade('gold', 3));
  // Flame.
  img.ellipse(16, 19, 3, 4.5, shade('gold', 2));
  img.ellipse(16, 20, 2, 3, shade('wall', 3));
  img.rect(8, 25, 16, 4, shade('gold', 0));
  img.rect(10, 29, 12, 2, shade('gold', 1));
  img.outline(shade('ink', 0));
};

const key: ItemPainter = (img) => {
  img.ellipse(10, 10, 7, 7, shade('gold', 0));
  img.ellipse(10, 10, 5.5, 5.5, shade('gold', 2));
  img.ellipse(10, 10, 3, 3, [0, 0, 0, 0]);
  img.ellipse(8, 8, 2.5, 2.5, shade('gold', 3));
  img.rect(13, 14, 4, 15, shade('gold', 1));
  img.rect(13, 14, 2, 15, shade('gold', 2));
  img.rect(17, 22, 5, 3, shade('gold', 1));
  img.rect(17, 26, 4, 3, shade('gold', 1));
  img.outline(shade('ink', 0));
};

const letter: ItemPainter = (img) => {
  img.rect(2, 7, 28, 19, shade('wall', 2));
  img.rect(2, 7, 28, 2, shade('wall', 3));
  img.rect(2, 24, 28, 2, shade('wall', 0));
  // Fold lines.
  img.line(2, 7, 16, 18, shade('wall', 0));
  img.line(30, 7, 16, 18, shade('wall', 0));
  img.line(2, 7, 16, 17, shade('wall', 1));
  img.line(30, 7, 16, 17, shade('wall', 1));
  // Wax heart seal, straight from the board.
  img.ellipse(16, 20, 4, 3.6, shade('cloak', 1));
  img.ellipse(14.5, 19, 2, 1.8, shade('cloak', 2));
  img.ellipse(17.5, 19, 2, 1.8, shade('cloak', 2));
  img.outline(shade('ink', 0));
};

export const ITEM_PAINTERS: Record<string, ItemPainter> = {
  'item-compass': compass,
  'item-translator': translator,
  'item-lantern': lantern,
  'item-key': key,
  'item-letter': letter,
};

// ---------------------------------------------------------------- effects

/**
 * Footstep dust: three frames of an expanding, thinning scatter kicked up at the heel.
 *
 * Drawn in the path's own dirt tones rather than a new hue, so it reads as ground being disturbed
 * and never as a coloured effect laid over the art (docs/ASSETS.md: keep the board's palette).
 */
export function paintDust(): Img {
  const sheet = new Img(24, 8);
  for (const frame of [0, 1, 2]) {
    const img = new Img(8, 8);
    const rnd = noise(700 + frame * 53);
    const spread = 1.2 + frame * 1.5;
    const alpha = [170, 120, 64][frame]!;
    for (let i = 0; i < 5 - frame; i++) {
      const x = 4 + (rnd() - 0.5) * spread * 2;
      const y = 5 - frame * 1.1 - rnd() * spread;
      img.px(x, y, shade(rnd() > 0.5 ? 'path' : 'wood', rnd() > 0.6 ? 0 : 2, alpha));
    }
    sheet.blit(img, frame * 8, 0);
  }
  return sheet;
}

export function paintInteractPrompt(): Img {
  const sheet = new Img(32, 16);
  for (const frame of [0, 1]) {
    const img = new Img(16, 16);
    const y = 2 + frame;
    // Speech bubble with an "A", bobbing one pixel.
    img.ellipse(8, y + 5, 6.5, 5, shade('wall', 3));
    img.ellipse(8, y + 5, 5.5, 4, shade('wall', 2));
    img.line(7, y + 9, 9, y + 12, shade('wall', 3));
    img.line(8, y + 9, 8, y + 12, shade('wall', 2));
    // Letter A.
    img.line(6, y + 7, 8, y + 2, shade('night', 2));
    img.line(10, y + 7, 8, y + 2, shade('night', 2));
    img.line(7, y + 5, 9, y + 5, shade('night', 2));
    img.outline(shade('ink', 0));
    sheet.blit(img, frame * 16, 0);
  }
  return sheet;
}

export function paintPawprints(): Img {
  const sheet = new Img(48, 16);
  for (let frame = 0; frame < 3; frame++) {
    const img = new Img(16, 16);
    const cx = 8;
    const cy = 6 + frame * 2;
    img.ellipse(cx, cy + 3, 2.6, 2.2, shade('ink', 0, 170));
    for (const [dx, dy] of [
      [-2.6, -0.5],
      [-1, -2.5],
      [1, -2.5],
      [2.6, -0.5],
    ] as const)
      img.ellipse(cx + dx, cy + dy, 1.1, 1.1, shade('ink', 0, 170));
    sheet.blit(img, frame * 16, 0);
  }
  return sheet;
}

export { CLEAR };
