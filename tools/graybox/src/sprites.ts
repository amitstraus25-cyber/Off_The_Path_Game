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
import { PURPLE_FRAMES, PURPLE_FRAME_H, PURPLE_FRAME_W } from './sprites/char-purple.ts';
import { CAST_FRAMES, CAST_POSED } from './sprites/cast.ts';
import { BYSTANDER_FRAMES, BYSTANDER_POSED } from './sprites/bystanders.ts';
import type { Pose } from './sprites/bystanders.ts';
import {
  FACE_PAINTERS,
  FACE_SIZE,
  paintDustFrame,
  paintForkSignFrame,
  paintInteractPromptFrame,
  paintLanternGlowFrame,
  paintPaperBirdFrame,
  paintPawprintsFrame,
} from './sprites/faces.ts';

/** One character frame. Purple, the cast and the bystanders are all drawn on the same footprint. */
export const PURPLE_W = PURPLE_FRAME_W;
export const PURPLE_H = PURPLE_FRAME_H;

/** Portraits and items, in the DOM and never scaled. */
export const PORTRAIT_SIZE = FACE_SIZE;

type Facing = 'down' | 'left' | 'right' | 'up';
/** Row order on Purple's sheet. */
export const FACINGS: Facing[] = ['down', 'left', 'right', 'up'];

/**
 * Purple's atlas: four rows of four, one row per facing.
 *
 * Column 0 is the idle pose and columns 1 to 3 are the walk, which is how `PURPLE_FRAMES` is keyed
 * (`<facing>-0` idle, `<facing>-1..3` walk). The atlas frame NAMES are a separate contract, held by
 * `forest-scene.ts`: it sets `purple-idle-<facing>-0` when Purple stops and plays `purple-walk-<facing>`
 * over frames 0, 1, 2, 1. Renaming either side breaks the other silently, so the mapping lives
 * here, once.
 */
export function paintPurpleSheet(): { sheet: Img; frames: Record<string, unknown> } {
  const sheet = new Img(PURPLE_W * 4, PURPLE_H * 4);
  const frames: Record<string, unknown> = {};
  FACINGS.forEach((facing, row) => {
    ([0, 1, 2, 3] as const).forEach((phase, col) => {
      const x = col * PURPLE_W;
      const y = row * PURPLE_H;
      const frame = new Img(PURPLE_W, PURPLE_H);
      PURPLE_FRAMES[`${facing}-${phase}`]!(frame);
      sheet.blit(frame, x, y);
      const name = phase === 0 ? `purple-idle-${facing}-0` : `purple-walk-${facing}-${phase - 1}`;
      frames[name] = {
        frame: { x, y, w: PURPLE_W, h: PURPLE_H },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: PURPLE_W, h: PURPLE_H },
        sourceSize: { w: PURPLE_W, h: PURPLE_H },
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
  const sheet = new Img(PURPLE_W * frames.length, PURPLE_H);
  frames.forEach((key, i) => {
    const painter = CHARACTER_FRAMES[key];
    if (!painter) throw new Error(`No painter for ${name}`);
    // Painted on its own canvas first: these painters finish with `outline()`, which would
    // otherwise trace the neighbouring frame already on the sheet.
    const frame = new Img(PURPLE_W, PURPLE_H);
    painter(frame);
    sheet.blit(frame, i * PURPLE_W, 0);
  });
  return sheet;
}

// ---------------------------------------------------------------- character life: idle and hop

/*
 * THE IDLE AND HOP STRIPS, one sheet per character per action, keyed `<sprite key>-idle` and
 * `<sprite key>-hop`, frames left to right at the static sprite's own 32 x 48.
 *
 * They are POSES of the same painters that draw the two-frame sheets, not edits of those frames:
 * `Pose` (sprites/bystanders.ts) splits the old frame 1 into its blink and its dip and adds one beat
 * that is the character's own, so a strip is a list of poses and every pixel in it is drawn by the
 * hand that drew the static sprite. Frame 0 of every idle strip IS the static frame 0.
 *
 * IDLE, four frames, read as a loop: rest, breathe, the beat at its height, breathe. The breath is
 * the dip each character already had -- the head on the animals, the twig on the toadstool, the
 * stalks on the snail, the whole coat on the keeper -- so the strip moves what the old blink moved
 * and adds one thing. Where a beat swings both ways (the cap, the stalks) frames 1 and 3 take the
 * two sides instead of the breath, so the wobble passes through the middle on its way across.
 *
 * HOP, two frames: a crouch (the dip, eyes open) and the top of the hop, one pixel up with the eyes
 * shut happy. ONE pixel, whole figure, contact bar and all -- a hop is the feet leaving the ground,
 * and the row of air under the bar on frame 1 is the whole of it at this size. Anything bigger is a
 * jump, and the scene can add travel with a tween if it wants one.
 */
const POSED = { ...CAST_POSED, ...BYSTANDER_POSED };

const pose = (blink: boolean, dip: 0 | 1, beat: number): Pose => ({ blink, dip, beat });

/** One frame of a strip: a pose, and whether the whole figure is lifted a pixel off the ground. */
interface StripFrame {
  readonly pose: Pose;
  readonly lift?: 1;
}

/** Each character's idle loop. The beat each one plays is documented on its painter. */
export const IDLE_POSES: Record<string, readonly Pose[]> = {
  // breathe, ear twitch, breathe
  'npc-rabbit': [pose(false, 0, 0), pose(false, 1, 0), pose(false, 0, 1), pose(false, 1, 0)],
  // breathe, blink (his beat), breathe
  'npc-owl': [pose(false, 0, 0), pose(false, 1, 0), pose(true, 0, 0), pose(false, 1, 0)],
  // breathe with the flame flaring, guttering, breathe
  'npc-lantern-keeper': [
    pose(false, 0, 0),
    pose(false, 1, 1),
    pose(false, 0, 2),
    pose(false, 1, 0),
  ],
  // cap left, twig up, cap right
  'bystander-toadstool': [
    pose(false, 0, 0),
    pose(false, 0, -1),
    pose(false, 1, 0),
    pose(false, 0, 1),
  ],
  // breathe, head cocked, breathe
  'bystander-magpie': [pose(false, 0, 0), pose(false, 1, 0), pose(false, 0, 1), pose(false, 1, 0)],
  // stalks left, stalks dip, stalks right
  'bystander-snail': [pose(false, 0, 0), pose(false, 0, -1), pose(false, 1, 0), pose(false, 0, 1)],
  // tail tip curls and breathe, tail tip at its height, curling back and breathe
  'bystander-cat': [pose(false, 0, 0), pose(false, 1, 1), pose(false, 0, 2), pose(false, 1, 1)],
};

/** The hop is the same two beats for everybody: crouch, then a pixel of air with the eyes shut. */
const HOP: readonly StripFrame[] = [
  { pose: pose(false, 1, 0) },
  { pose: pose(true, 0, 0), lift: 1 },
];

/** Frames per strip, so the manifest and any reader agree without counting a PNG. */
export const IDLE_FRAMES = 4;
export const HOP_FRAMES = HOP.length;

function paintStrip(name: string, frames: readonly StripFrame[]): Img {
  const painter = POSED[name];
  if (!painter) throw new Error(`No posable painter for ${name}`);
  const sheet = new Img(PURPLE_W * frames.length, PURPLE_H);
  frames.forEach(({ pose: p, lift }, i) => {
    // Its own canvas first, for the reason `paintNpcSheet` gives: the painters finish with
    // `outline()`, which would otherwise trace the neighbouring frame already on the sheet.
    const frame = new Img(PURPLE_W, PURPLE_H);
    painter(frame, p);
    sheet.blit(frame, i * PURPLE_W, -(lift ?? 0));
  });
  return sheet;
}

/** `<key>-idle`: four frames of 32 x 48. */
export function paintIdleSheet(name: string): Img {
  const poses = IDLE_POSES[name];
  if (!poses || poses.length !== IDLE_FRAMES)
    throw new Error(`No ${IDLE_FRAMES}-frame idle for ${name}`);
  return paintStrip(
    name,
    poses.map((p) => ({ pose: p })),
  );
}

/** `<key>-hop`: two frames of 32 x 48. */
export function paintHopSheet(name: string): Img {
  return paintStrip(name, HOP);
}

/** Every character that gets the two strips: the seven the map spawns, in `NPC_PAINTERS` order. */
export const LIFE_KEYS: readonly string[] = Object.keys(NPC_PAINTERS);

// ---------------------------------------------------------------- portraits and items (64x64)

type FacePainter = (img: Img) => void;

const facesWithPrefix = (prefix: string): Record<string, FacePainter> =>
  Object.fromEntries(Object.entries(FACE_PAINTERS).filter(([name]) => name.startsWith(prefix)));

/** The five dialogue portraits. */
export const PORTRAIT_PAINTERS: Record<string, FacePainter> = facesWithPrefix('portrait-');

/**
 * The ten item icons: one per v2 skill, plus the key, the letter and the translator's horn, which
 * no v2 skill wears (Word Weaver moved to `item-weaver` on 2026-10-22).
 */
export const ITEM_PAINTERS: Record<string, FacePainter> = facesWithPrefix('item-');

// ---------------------------------------------------------------- effects

/**
 * Every small square sheet: its frame size, its frame count and the painter for one frame. Each
 * frame is painted on its own canvas and blitted along the strip, which is what the three original
 * sheets always did, so they come out byte for byte as before.
 *
 * `prop-forksign` lives here rather than in the tileset because it is a SPRITE: the game stands it
 * at a `fork-*` object and lays a face over its board, and a tile cannot carry an overlay or face
 * two ways.
 */
export const FX_SHEETS: Record<
  string,
  { readonly size: number; readonly frames: number; readonly paint: (img: Img, f: number) => void }
> = {
  // Footstep dust: three frames of 16x16, kicked up at the heel.
  'fx-dust': { size: 16, frames: 3, paint: (img, f) => paintDustFrame(img, f as 0 | 1 | 2) },
  // The bobbing "..." over an NPC you can talk to: two frames of 32x32.
  'fx-interact-prompt': {
    size: 32,
    frames: 2,
    paint: (img, f) => paintInteractPromptFrame(img, f as 0 | 1),
  },
  // The paw prints outside the door: three frames of 32x32, left, right, and fading.
  'fx-pawprints': {
    size: 32,
    frames: 3,
    paint: (img, f) => paintPawprintsFrame(img, f as 0 | 1 | 2),
  },
  // A folded paper bird in flight: four frames of 16x16, wings up, level, down, level.
  'fx-paperbird': {
    size: 16,
    frames: 4,
    paint: (img, f) => paintPaperBirdFrame(img, f as 0 | 1 | 2 | 3),
  },
  // The Way Teller's blank board on a post: two frames of 32x32, pointing left, then right.
  'prop-forksign': { size: 32, frames: 2, paint: (img, f) => paintForkSignFrame(img, f as 0 | 1) },
  // The lantern's glow, for an additive blend: one frame of 64x64.
  'fx-lantern-glow': { size: 64, frames: 1, paint: (img) => paintLanternGlowFrame(img) },
};

/** One effect sheet, its frames left to right. */
export function paintFxSheet(key: string): Img {
  const fx = FX_SHEETS[key];
  if (!fx) throw new Error(`No effect sheet ${key}`);
  const sheet = new Img(fx.size * fx.frames, fx.size);
  for (let f = 0; f < fx.frames; f++) {
    const img = new Img(fx.size, fx.size);
    fx.paint(img, f);
    sheet.blit(img, f * fx.size, 0);
  }
  return sheet;
}

/** Footstep dust: three frames of 16x16. */
export const paintDust = (): Img => paintFxSheet('fx-dust');
/** The talk prompt: two frames of 32x32. */
export const paintInteractPrompt = (): Img => paintFxSheet('fx-interact-prompt');
/** The paw prints: three frames of 32x32. */
export const paintPawprints = (): Img => paintFxSheet('fx-pawprints');

/** Frame sizes for the effect sheets, so the manifest never guesses. */
export const FX_SIZES: Record<string, number> = Object.fromEntries(
  Object.entries(FX_SHEETS).map(([key, fx]) => [key, fx.size]),
);
