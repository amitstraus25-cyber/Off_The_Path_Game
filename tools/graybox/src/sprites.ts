/*
 * Sprite sheets: assembly only.
 *
 * Every frame is painted in one of the four modules under `sprites/`, at the sizes
 * docs/PIXEL_STANDARD.md section 1 fixes: characters 32x48, portraits and items 64x64, the interact
 * prompt and the paw prints 32x32, dust 16x16. This file packs those frames into the sheets the
 * game loads and keeps the export surface `generate.ts` and `preview.ts` already use, so nothing
 * downstream had to change when the painters did.
 *
 * The modules key their painters by frame (`npc-rabbit-0`, `down-2`); the sheets below are what
 * turn those into one image per texture, in the frame order the scene's animations index into.
 */
import { Img } from './paint.ts';
import { RED_FRAMES, RED_FRAME_H, RED_FRAME_W } from './sprites/red-sprite.ts';
import { CAST_FRAMES } from './sprites/cast.ts';
import { BYSTANDER_FRAMES } from './sprites/bystanders.ts';
import {
  FACE_PAINTERS,
  FACE_SIZE,
  paintDustFrame,
  paintInteractPromptFrame,
  paintPawprintsFrame,
} from './sprites/faces.ts';

/** One character frame. Red, the cast and the bystanders are all drawn on the same footprint. */
export const RED_W = RED_FRAME_W;
export const RED_H = RED_FRAME_H;

/** Portraits and items, in the DOM and never scaled. */
export const PORTRAIT_SIZE = FACE_SIZE;

type Facing = 'down' | 'left' | 'right' | 'up';
/** Row order on Red's sheet. */
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up'];

/**
 * Red's atlas: four rows of four, one row per facing.
 *
 * Column 0 is the idle pose and columns 1 to 3 are the walk, which is how `RED_FRAMES` is keyed
 * (`<facing>-0` idle, `<facing>-1..3` walk). The atlas frame NAMES are a separate contract, held by
 * `forest-scene.ts`: it sets `red-idle-<facing>-0` when Red stops and plays `red-walk-<facing>`
 * over frames 0, 1, 2, 1. Renaming either side breaks the other silently, so the mapping lives
 * here, once.
 */
export function paintRedSheet(): { sheet: Img; frames: Record<string, unknown> } {
  const sheet = new Img(RED_W * 4, RED_H * 4);
  const frames: Record<string, unknown> = {};
  FACINGS.forEach((facing, row) => {
    ([0, 1, 2, 3] as const).forEach((phase, col) => {
      const x = col * RED_W;
      const y = row * RED_H;
      const frame = new Img(RED_W, RED_H);
      RED_FRAMES[`${facing}-${phase}`]!(frame);
      sheet.blit(frame, x, y);
      const name = phase === 0 ? `red-idle-${facing}-0` : `red-walk-${facing}-${phase - 1}`;
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

/**
 * One painter per NPC, drawing either the open-eyed frame or the blink.
 *
 * The shape is kept from the 16px build because `generate.ts` and `preview.ts` both walk these
 * keys -- `generate.ts` picks the bystanders out of them by prefix -- but the bodies now come from
 * the per-frame records in `sprites/cast.ts` and `sprites/bystanders.ts`.
 */
type NpcPainter = (img: Img, blink: boolean) => void;

const CHARACTER_FRAMES: Record<string, (img: Img) => void> = {
  ...CAST_FRAMES,
  ...BYSTANDER_FRAMES,
};

const twoFrame = (key: string): NpcPainter => {
  const open = CHARACTER_FRAMES[`${key}-0`];
  const blinking = CHARACTER_FRAMES[`${key}-1`];
  if (!open || !blinking) throw new Error(`Missing frames for ${key}`);
  return (img, blink) => (blink ? blinking : open)(img);
};

/** Keyed by the map object name, which is also the texture key the scene looks up. */
export const NPC_PAINTERS: Record<string, NpcPainter> = {
  'npc-rabbit': twoFrame('npc-rabbit'),
  'npc-owl': twoFrame('npc-owl'),
  'npc-lantern-keeper': twoFrame('npc-lantern-keeper'),
  'bystander-toadstool': twoFrame('bystander-toadstool'),
  'bystander-magpie': twoFrame('bystander-magpie'),
  'bystander-snail': twoFrame('bystander-snail'),
  'bystander-cat': twoFrame('bystander-cat'),
};

/**
 * One texture per character. Two frames each, except the wolf.
 *
 * The wolf gets four: 0 and 1 are him lit and breathing, 2 is the silhouette in the lit cottage
 * window, and 3 is the silhouette waiting at the door in Grandma's bonnet and shawl. He has no
 * entry in `NPC_PAINTERS` because he is never spawned from the map -- he appears at the cottage --
 * which is why he is special-cased here rather than keyed with the others.
 */
export function paintNpcSheet(name: string): Img {
  const frames =
    name === 'npc-wolf'
      ? ['npc-wolf-0', 'npc-wolf-1', 'npc-wolf-2', 'npc-wolf-3']
      : [`${name}-0`, `${name}-1`];
  const sheet = new Img(RED_W * frames.length, RED_H);
  frames.forEach((key, i) => {
    const painter = CHARACTER_FRAMES[key];
    if (!painter) throw new Error(`No painter for ${name}`);
    // Painted on its own canvas first: these painters finish with `outline()`, which would
    // otherwise trace the neighbouring frame already on the sheet.
    const frame = new Img(RED_W, RED_H);
    painter(frame);
    sheet.blit(frame, i * RED_W, 0);
  });
  return sheet;
}

// ---------------------------------------------------------------- portraits and items (64x64)

type FacePainter = (img: Img) => void;

const facesWithPrefix = (prefix: string): Record<string, FacePainter> =>
  Object.fromEntries(Object.entries(FACE_PAINTERS).filter(([name]) => name.startsWith(prefix)));

/** The five dialogue portraits. */
export const PORTRAIT_PAINTERS: Record<string, FacePainter> = facesWithPrefix('portrait-');

/** The five basket items. */
export const ITEM_PAINTERS: Record<string, FacePainter> = facesWithPrefix('item-');

// ---------------------------------------------------------------- effects

/** Footstep dust: three frames of 16x16, kicked up at the heel. */
export function paintDust(): Img {
  const sheet = new Img(16 * 3, 16);
  for (const frame of [0, 1, 2] as const) {
    const img = new Img(16, 16);
    paintDustFrame(img, frame);
    sheet.blit(img, frame * 16, 0);
  }
  return sheet;
}

/** The bobbing "A" over an NPC you can talk to: two frames of 32x32. */
export function paintInteractPrompt(): Img {
  const sheet = new Img(32 * 2, 32);
  for (const frame of [0, 1] as const) {
    const img = new Img(32, 32);
    paintInteractPromptFrame(img, frame);
    sheet.blit(img, frame * 32, 0);
  }
  return sheet;
}

/** The paw prints outside the door: three frames of 32x32, left, right, and fading. */
export function paintPawprints(): Img {
  const sheet = new Img(32 * 3, 32);
  for (const frame of [0, 1, 2] as const) {
    const img = new Img(32, 32);
    paintPawprintsFrame(img, frame);
    sheet.blit(img, frame * 32, 0);
  }
  return sheet;
}

/** Frame sizes for the three effect sheets, so the manifest never guesses. */
export const FX_SIZES = {
  'fx-dust': 16,
  'fx-interact-prompt': 32,
  'fx-pawprints': 32,
} as const;
