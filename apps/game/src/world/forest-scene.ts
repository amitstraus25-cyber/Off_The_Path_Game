import Phaser from 'phaser';
/*
 * `snapCentreToRow` comes straight from @otp/core rather than through `./logic`, which re-exports
 * the rest of the camera geometry. That re-export list is a convenience for imports that predate
 * the move to the core package, and world/logic.ts belongs to another owner this round; a new
 * symbol does not need to be threaded through it to be used here.
 */
import { snapCentreToRow } from '@otp/core';
import type { WorldRun } from './run';
import type { Bus } from '../bus';
import type { Input } from './input';
import {
  CAMERA_FOCUS_Y,
  PURPLE_FEET_BELOW_SPAWN,
  INTERACT_RADIUS,
  MIN_VIEW,
  PX_PER_WALK_FRAME,
  blocked,
  TILE,
  WALK_SPEED,
  cameraFollow,
  cameraTopLeft,
  facingFrom,
  movementVector,
  moveWithCollision,
  nearest,
  overlaps,
  placeBubble,
} from './logic';
import type { BubbleSide, Facing, Interactable, Rect, Vec } from './logic';
import { bystanderSpawns, findObject, npcSpawns, readForestMap } from './map';
import type { ForestMap, MapObject } from './map';
import { sketchMap } from './minimap';
import type { MapSketch } from './minimap';
import { readForks } from './forks';
import type { Fork } from './forks';
import { brightestWarm, openDoor } from './door';
import gids from '../assets/tileset-forest.gids.json';

/** The gap between the top of a character's head and the bottom of the prompt bubble. */
const PROMPT_GAP = TILE * (3 / 8);

/**
 * The speech bubble's bob, as a registered animation rather than a frame counter.
 *
 * Two frames at two a second, which is the cadence the two painted frames were drawn for. It used
 * to be `setFrame(Math.floor(n / 30) % 2)` off a counter incremented once per `update`, so the bob
 * ran at (frame rate / 60) Hz: right at 60Hz, twice as fast on a 120Hz display, and slower than
 * drawn on anything dropping frames. Phaser's animation clock is wall time, so the bob is the same
 * speed on every display -- the same reason the walk cycle reads its frameRate from WALK_SPEED.
 */
const PROMPT_BOB = { key: 'fx-prompt-bob', frameRate: 2 } as const;

/**
 * The breath in the forest: two frames, a long open eye and a blink.
 *
 * Every character sheet ships an open-eyed frame and a blink -- eight painted frames across the
 * cast, `CAST_FRAMES` and `BYSTANDER_FRAMES` in tools/graybox name them `-0` and `-1` -- and
 * nothing in this scene has ever called `play` or `setFrame` on an NPC. They were added at frame 0
 * and stayed there, so the forest held perfectly still while Purple walked through it and half the
 * painted cast was bytes nobody would ever see.
 *
 * `holdMs` plus a per-character step is what keeps them out of step. Eight figures blinking on the
 * same beat reads as a glitch rather than as life, and a shared period would drift into step and
 * out again forever; different periods never come back together for long, and `startStepMs` keeps
 * them apart in the first few seconds as well, before the periods have had time to separate them.
 *
 * Phaser takes the cadence from the FRAMES, not from a frame rate: `AnimationState.updateFrame`
 * reads `currentFrame.duration || msPerFrame`, so a per-frame duration replaces the animation's own
 * pacing as long as nothing overrides `frameRate` on the `play` call. That is what lets one
 * animation hold a frame for four seconds and the next for a tenth of one.
 */
const IDLE = {
  /** The shortest open-eyed hold, in ms. The cast is spread upwards from here. */
  holdMs: 3500,
  /** Added per character, wrapped by `spreadMs`, so no two share a period. */
  stepMs: 250,
  /** How far the hold is allowed to be spread, so the slowest beat still lands inside 3.5-5.5s. */
  spreadMs: 2000,
  /**
   * One frame of the character's own beat, in ms. THE STRIPS (2026-10-22): every character now
   * ships a four-frame `-idle` strip -- the rest frame, then a breath and their own beat (the
   * rabbit's ear, the keeper's lantern flaring, the snail's eye stalks) -- whose frame 0 is
   * byte-identical to the static sprite, so swapping onto it does not pop. Three beat frames at this
   * length is 330ms in every 3.8-5.8s: glimpsed, never held.
   */
  beatMs: 110,
  /** How far apart the cast start, so they are not in step before their periods separate them. */
  startStepMs: 430,
} as const;

/**
 * THE HOP when Purple arrives to talk: the `-hop` strip's crouch, then the whole figure a pixel up
 * with its eyes shut happy, then back to the idle. Once per meeting, and never under reduced motion.
 */
const HOP = { crouchMs: 110, upMs: 200 } as const;

/** How near Purple has to come before a character turns to face her. */
const FACE_RADIUS = TILE * 3;

/**
 * THE FOREST AFTER DARK, drawn over the world layer only: a camera-fixed wash in the brand's Deep
 * Purple at the share of the light core's `duskAt` takes away -- never past the content's cap, so
 * the path and the cast always read. It sits above the canopy and under nothing but the lantern's
 * glow, the paper bird and the flight; every panel is DOM and is never dimmed.
 */
const DUSK_DEPTH = 20_000;
/** The lantern's warm circle, an additive blend over the wash (the art is drawn for ADD). */
const GLOW_DEPTH = 20_001;
/** Above the canopy and the wash: a flight is in the open sky. */
const SKY_DEPTH = 20_002;
/**
 * The glow's opacity: a faint warm ring the moment the lantern is lit, filling in as the dusk
 * deepens, so the take is visible before 2:00 and the light matters most when it is darkest.
 */
const GLOW = { least: 0.3, most: 0.7, scale: 2, lift: TILE * (5 / 8) } as const;

/**
 * THE WING RIDE: the arc a carried Purple rides, and the quick fade that stands in for it under
 * reduced motion. The flight's length is the content's `flightMs`, never a number here.
 */
const FLIGHT = {
  /** The arc's height at its middle, as a share of the distance flown, and its ceiling. */
  arcShare: 0.25,
  arcMax: TILE * 3,
  /** How far above her head the carrier flies. */
  carrierAbove: TILE * 1.25,
  /** The reduced-motion stand-in: out, across, in. */
  fadeMs: 160,
} as const;

/**
 * The paper bird's flight: off Purple's hand and away TOWARDS GRANDMA'S DOOR (the client,
 * 2026-10-22: "make sure it flies in the direction of grandma and not the other direction"), a
 * long glide along the bearing to the cottage with a climb on top of it, fading as it goes. It
 * used to fly west on the argument that it must not show the way; the client wants the word to be
 * seen going where it is going, and the minimap and the fork signs already show the way for
 * anyone who took them. `reach` is how far along the bearing it gets before it is gone -- never
 * past the door itself.
 */
const PAPER_BIRD = { ms: 2200, reach: TILE * 9, climb: TILE * 3, frameRate: 10 } as const;

/** The open door sits over the closed one in `decor-below` (depth 1) and under every figure. */
const DOOR_DEPTH = 1.5;

/**
 * The pool of shade a figure stands in.
 *
 * NOBODY IN THE CAST TOUCHED THE GROUND. Measured as green pixels at least 25 luma below the lawn
 * around them: bush 518, rock 104, Purple 24, and the rabbit, the owl and the Lantern Keeper 0 each.
 * Everything painted into the tileset plants on the lawn and everything painted into a character
 * sheet floats over it, which on the plank bridge left Purple's contact line at dL -14.5 against a
 * board that seats every figure.
 *
 * IT BELONGS IN THE SCENE AND NOT IN THE SPRITE, and that is not a convenience. Both painters
 * REMOVED a baked shadow for a good reason: a shadow drawn into a 32x48 frame carries one ground's
 * colour with it, so a figure painted standing on grass walked onto sand with a green smear under
 * her. Only the scene knows what a figure is standing on, so only the scene can tint the pool from
 * it -- `tileInks` below reads the mean colour of every cell in the tileset the game actually
 * loaded, and `groundInkAt` looks up the one under the feet.
 *
 * `tone` darkens that colour and `alpha` lets the ground's own mottle read through it, so the net
 * effect is a MULTIPLY: the lawn keeps its texture and simply loses a quarter of its light. On the
 * shipped tileset that is a fall of 43 luma on grass, 49 on the sand path and 23 on the bridge
 * planks, which are already dark. A flat opaque blob at any colour would read as a hole.
 */
const SHADOW = {
  /** The pool is a quarter-tile wider than the feet that cast it. */
  spread: TILE / 4,
  /** And a third as deep as it is wide: this camera looks down at the path, not along it. */
  flatten: 1 / 3,
  /** The narrowest pool worth drawing, for a figure whose art reaches the floor in a thin line. */
  minDepth: 3,
  /** How dark the pool's own colour is against the ground it was sampled from. */
  tone: 0.5,
  /** How much of the ground it covers; the rest is the ground's own mottle. */
  alpha: 0.5,
  /** Half a pixel under the figure's own depth, so she stands ON it rather than behind it. */
  behind: -0.5,
} as const;

/**
 * How many rows of a figure's art count as the part that touches the ground.
 *
 * Four, because the pool is the width of the FEET and not of the figure: the owl is 22px across
 * his wings and 21 across his claws, the magpie 28 across the tail and 9 where he stands. A pool
 * the width of the silhouette would put the magpie in a puddle twice his own footprint.
 */
const CONTACT_ROWS = 4;

/*
 * The phases that happen at the cottage moved to `run.ts` (`AT_THE_COTTAGE`, v1's adapter), with
 * every other question this scene used to ask the v1 store directly. See `WorldRun`.
 */

/**
 * The wolf's trail, in world pixels from the top-left of the door lane: three prints walking NORTH
 * up the lane to the step, left foot, right foot, left foot, zig-zagged half a tile either side of
 * the lane's centre line and a tile apart.
 *
 * Frame order is chronological backwards. Frame 2 is the faded print, so it is the one furthest
 * from the door -- the oldest step of a walk that ended at the step, where frame 0 is still sharp.
 * All three sit inside the two sand tiles of the lane, which is why the offsets are measured from
 * `trigger-cottage` rather than from the facade: the lane and the trigger are the same rectangle.
 */
const PAW_TRAIL: readonly { frame: 0 | 1 | 2; dx: number; dy: number }[] = [
  { frame: 0, dx: TILE * 1.5, dy: TILE * 0.5 },
  { frame: 1, dx: TILE, dy: TILE * 1.5 },
  { frame: 2, dx: TILE * 1.5, dy: TILE * 2.5 },
];

/**
 * How many rows of doorstep lane stay in the arrival shot below the facade. Three, because that is
 * the lane: the step, and the two path rows the trail comes up.
 */
const LANE_ROWS = 3;

/**
 * How the canvas tells the DOM that someone has come within reach (docs/UX_REVIEW.md 16).
 *
 * A DOM event rather than the typed bus in `src/bus.ts`, which this change does not own: the bus
 * is the right home for it and moving it there is a two-line change for whoever holds that file
 * next. Two listeners need it -- the live region in `ui/App.tsx`, which says it, and the walk
 * controls in `ui/touch-controls.ts`, which stop Purple when she arrives -- so it is one channel with
 * two subscribers either way. The same name is written in both of those files; the end-to-end
 * guard in `e2e/world-reach.spec.ts` is what keeps the three spellings honest.
 *
 * The payload is the npc's ID and nothing else. Not the name, deliberately: the UI already holds
 * `content` and looks the name up itself, so an event dispatched by anything other than this scene
 * cannot put words of its own into a live region.
 */
const WITHIN_REACH = 'otp:within-reach';

/**
 * Anyone Purple can walk up to. `character` offers a skill and opens the real encounter;
 * `bystander` offers nothing and only says a line. They share the prompt and the proximity
 * test so that one person is highlighted at a time, and differ only in what interacting emits.
 */
interface Npc extends Interactable {
  kind: 'character' | 'bystander';
  sprite: Phaser.GameObjects.Sprite;
  prompt: Phaser.GameObjects.Sprite;
  /** The pool of shade under their feet, tinted from the tile they are standing on. */
  shadow: Phaser.GameObjects.Ellipse;
  /**
   * Which way the art faces, measured off the frame (`facingOf`): -1 left, 1 right. A figure turns
   * to face Purple by flipping when she stands on the other side of them.
   */
  faces: -1 | 1;
  /** The sheet the figure was placed from (`npc-rabbit`); its strips are `<sheet>-idle`, `-hop`. */
  sheet: string;
  /** The drawing inside their frame, in frame pixels (`inkOf`): what the bubble must not cover. */
  ink: Rect;
  /** Which side of their head the bubble stands on while it is up (`placePrompt`), else null. */
  bubbleSide: BubbleSide | null;
}

/** One wing ride in progress (`flyTo`). */
interface Flight {
  from: Vec;
  to: Vec;
  ms: number;
  t: number;
  /** The reduced-motion fade stands in for the arc; the clock still runs the whole `ms`. */
  fade: boolean;
  /** The figure carrying her, a copy of the giver's sprite, and the giver left at home. */
  carrier: Phaser.GameObjects.Sprite | null;
  giver: Npc | null;
  landed: () => void;
}

/**
 * Which way a figure's art faces, from its own pixels: where the top of the drawing (the head) sits
 * against the middle of the whole drawing. The magpie's head is to the left of his tail, so he faces
 * left; a figure drawn square-on reads as facing right, and flipping it is the turn.
 *
 * Measured, not tabled, for the reason `headroomOf` gives. Degrades to facing right.
 */
function facingOf(frame: Phaser.Textures.Frame | null): -1 | 1 {
  if (!frame) return 1;
  const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 1;
    ctx.drawImage(frame.source.image as CanvasImageSource, cutX, cutY, w, h, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let top = -1;
    let sum = 0;
    let n = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]! > 0) {
          if (top === -1) top = y;
          sum += x;
          n++;
        }
    if (n === 0) return 1;
    // The head: the top third of the drawing's own height.
    const headRows = Math.max(1, Math.round((h - top) / 3));
    let hs = 0;
    let hn = 0;
    for (let y = top; y < top + headRows; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]! > 0) {
          hs += x;
          hn++;
        }
    return hn > 0 && hs / hn < sum / n - 1 ? -1 : 1;
  } catch {
    return 1;
  }
}

/** A CSS colour token as Phaser's packed 0xRRGGBB, or null where the page does not define it. */
function tokenColor(name: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^#[0-9a-f]{6}$/i.test(raw)) return null;
  return Phaser.Display.Color.HexStringToColor(raw).color;
}

/**
 * How far above a character's feet the top of their ART is, measured off the frame the game loaded.
 *
 * The prompt bubble used to hang off the FRAME -- `sprite.y - 48 - PROMPT_GAP` -- and every
 * character's frame is 32 x 48 whatever is drawn in it. So the one mark that means "talk to me"
 * floated 16px over the Lantern Keeper, who fills 44 of his 48 rows, and 46px over the snail, who
 * fills 14: the shortest character in the cast got the mark furthest from their head, which is the
 * opposite of a pointer. The gap is now measured from the drawing.
 *
 * Measured rather than tabled. `CAST_PLAN` and `BYSTANDER_PLAN` in tools/graybox carry these eight
 * heights, and a copy of them over here is the same mistake as the camera literal that has cost
 * this project three rounds: graybox is a build tool the game must not import, so a table here
 * would be a second set of numbers nothing keeps honest. One `drawImage` and one `getImageData`
 * per character at boot reads the real thing, and an NPC redrawn two pixels taller moves its own
 * bubble without anybody remembering to.
 *
 * Every character sheet is bottom-aligned in its frame -- the lowest ink row IS the last row, which
 * is what puts their feet on their own origin -- so the top opaque row is all this has to find.
 *
 * It degrades to the frame's own height, which is exactly the old behaviour, if the readback is
 * unavailable for any reason. A bubble a little high is a cosmetic fault; a scene that throws
 * during `create` is a blank canvas.
 */
function headroomOf(frame: Phaser.Textures.Frame | null): number {
  if (!frame) return 0;
  const ink = inkOf(frame);
  return ink ? frame.cutHeight - ink.y : frame.cutHeight;
}

/**
 * The box round everything drawn in a frame, in frame pixels, or null when the readback is
 * unavailable or the frame is empty. `headroomOf` is its top row; the talk bubble's placement
 * (`placePrompt`) needs all four sides, of the speaker, of everyone it must not cover and of the
 * bubble itself -- measured, for the reason `headroomOf` gives, never tabled.
 */
function inkOf(frame: Phaser.Textures.Frame | null): Rect | null {
  if (!frame) return null;
  const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(frame.source.image as CanvasImageSource, cutX, cutY, w, h, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let left = w;
    let right = -1;
    let top = h;
    let bottom = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]! > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
    if (right < 0) return null;
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  } catch {
    return null;
  }
}

/** The smallest box holding every one of these; the whole frame when none could be measured. */
function unionOf(boxes: readonly (Rect | null)[], frame: { width: number; height: number }): Rect {
  const real = boxes.filter((b): b is Rect => b !== null);
  if (real.length === 0) return { x: 0, y: 0, width: frame.width, height: frame.height };
  const x = Math.min(...real.map((b) => b.x));
  const y = Math.min(...real.map((b) => b.y));
  const right = Math.max(...real.map((b) => b.x + b.width));
  const bottom = Math.max(...real.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * How wide the part of a figure that touches the ground is, in pixels, off the same frame.
 *
 * Measured for the same reason the headroom above is: a table of eight numbers over here is a
 * second set of figures nothing keeps honest, and the sheets are regenerated by a tool the game
 * must not import. On the shipped art this reads 15 for Purple, 20 for the rabbit, 21 for the owl,
 * 23 for the Keeper, 9 for the magpie and 25 for the snail -- the spread that makes a pool look
 * like it belongs to the figure standing in it.
 *
 * It relies on the same fact `headroomOf` does, and `assertBodyPlans()` in tools/graybox enforces:
 * every character sheet is bottom-aligned in its frame, so the lowest ink row IS the last row.
 * Degrades to 0 -- a pool of nothing but `SHADOW.spread` -- rather than throwing, because a
 * cosmetic pool that is a little small is not worth a blank canvas.
 */
function footprintOf(frame: Phaser.Textures.Frame | null): number {
  if (!frame) return 0;
  const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(frame.source.image as CanvasImageSource, cutX, cutY, w, h, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let left = w;
    let right = -1;
    for (let y = Math.max(0, h - CONTACT_ROWS); y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]! > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
        }
    return right < left ? 0 : right - left + 1;
  } catch {
    return 0;
  }
}

/**
 * The mean colour of every cell in a tileset, as 0xRRGGBB, keyed by tile index.
 *
 * This is where a character's shadow gets its colour, so that a figure on sand is not wearing a
 * green one. One `drawImage` and one `getImageData` for the WHOLE sheet and then an arithmetic
 * pass per cell -- 79 cells of 1,024 pixels on the shipped tileset -- rather than a readback each,
 * because a readback carries a fixed cost and eighty of them at boot is a measurable one.
 *
 * Fully transparent cells are left out of the map, and so is everything if the readback fails;
 * `groundInkAt` reads a missing answer as "do not draw a pool", which is the state the game has
 * shipped in until now and therefore a safe thing to degrade to.
 */
function tileInks(tileset: Phaser.Tilemaps.Tileset): Map<number, number> {
  const inks = new Map<number, number>();
  const image = tileset.image?.getSourceImage();
  if (!image) return inks;
  const tw = tileset.tileWidth;
  const th = tileset.tileHeight;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return inks;
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < tileset.total; i++) {
      const index = tileset.firstgid + i;
      const at = tileset.getTileTextureCoordinates(index) as { x: number; y: number } | null;
      if (!at) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = at.y; y < at.y + th; y++)
        for (let x = at.x; x < at.x + tw; x++) {
          const p = (y * canvas.width + x) * 4;
          if (data[p + 3]! === 0) continue;
          r += data[p]!;
          g += data[p + 1]!;
          b += data[p + 2]!;
          n++;
        }
      if (n === 0) continue;
      inks.set(index, (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n));
    }
  } catch {
    return inks;
  }
  return inks;
}

/**
 * The same colour with the light taken out of it, which is what a pool of shade is.
 *
 * NO COLOUR IS WRITTEN DOWN HERE. The only hex in the expression is `0xff`, which is the mask that
 * picks one byte out of a packed 0xRRGGBB, and the value it is picking out came from the tileset
 * the game loaded. That is the whole point of the pass: the shade a figure casts is the ground
 * they are standing on, so there is no colour to choose and nothing to keep in step with a ramp.
 */
const shaded = (ink: number): number =>
  (Math.round(((ink >> 16) & 0xff) * SHADOW.tone) << 16) |
  (Math.round(((ink >> 8) & 0xff) * SHADOW.tone) << 8) |
  Math.round((ink & 0xff) * SHADOW.tone);

export class ForestScene extends Phaser.Scene {
  /** The run being walked, through the one interface both rulebooks answer (world/run.ts). */
  private readonly run: WorldRun;
  private readonly bus: Bus;
  private readonly controls: Input;
  /** False while a DOM panel owns the screen, including ones that do not change the store phase. */
  private readonly hasInput: () => boolean;

  private map!: ForestMap;
  private purple!: Phaser.GameObjects.Sprite;
  /** Purple's drawing in her frame, over all four facings: what a talk bubble must not cover. */
  private purpleInk: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The talk bubble's drawing in its frame, over both bob frames. */
  private bubbleInk: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** Purple's own pool of shade. Moves and re-tints with her, because she is the one who walks. */
  private purpleShadow!: Phaser.GameObjects.Ellipse;
  /** The tile layer the figures stand on, which is what their shadows take their colour from. */
  private ground: Phaser.Tilemaps.TilemapLayer | null = null;
  /** Mean colour per tile index, read off the loaded tileset once at boot. */
  private inks: Map<number, number> = new Map();
  private position: Vec = { x: 0, y: 0 };
  private facing: Facing = 'down';
  private walking = false;
  private npcs: Npc[] = [];
  private cottage!: MapObject;
  /**
   * The last place Purple stood OUTSIDE the cottage's trigger, so the door's question can put her
   * back a step when the player chooses to keep looking (`stepBack`). Written in place, never
   * reallocated: it is touched on every walking frame.
   */
  private readonly lastOutside: Vec = { x: 0, y: 0 };
  /** What the minimap draws, read off the loaded map once at boot (world/minimap.ts). */
  private sketched: MapSketch | null = null;
  /** The building itself, which is what the arrival shot is framed on. */
  private facade!: MapObject;
  /** The wolf's prints on the lane outside the door. Hidden until an arrival that earned them. */
  private paws: Phaser.GameObjects.Sprite[] = [];
  /** True once the run has reached the cottage, so the arrival is staged exactly once. */
  private arrived = false;
  private notices: MapObject[] = [];
  /** Who was last announced as within reach, so the announcement is made once per arrival. */
  private withinReach: string | null = null;
  /**
   * Which triggers Purple is standing on, against the run they last fired for.
   *
   * `checkCottage` and `checkNotices` tested `overlaps` and emitted, every frame, for as long as
   * she stood there: 181 emissions in 181 frames on the doorstep. `main.ts` suppresses a second
   * toast while one is up, so the visible result was the locked-cottage line BLINKING -- 2.6
   * seconds on, one frame off, 2.6 seconds on -- for as long as the player stood at the door
   * wondering what to do, which is precisely when they are reading it.
   *
   * So a trigger fires on the false-to-true edge. The value stored is the run it fired for, not
   * `true`, because the door's answer depends on the run and not only on the ground: stand on the
   * step with two verdicts, earn the third, and the step has a different thing to say. Identity of
   * the state object is what the store changes on a dispatch and nothing else, so standing still
   * through a hundred and eighty frames is one emission and a verdict landing under her feet is a
   * second.
   */
  private readonly triggered = new Map<string, unknown>();
  private reducedMotion = false;
  /** The camera's own centre, which lags Purple rather than being pinned to her. */
  private camera: Vec = { x: 0, y: 0 };
  /**
   * How far below `CAMERA_FOCUS_Y` the camera aims, to put its top edge on a whole tile row.
   *
   * Under a tile in magnitude, and non-negative on every live path -- the edge is moved DOWN onto
   * the next whole row. (`snapTopEdge` returns a negative lift only against the bottom of the
   * world, where it snaps up rather than scroll past the last row; no cut on this map is within
   * 350px of that bound. The docstring here read "Always in [0, TILE)" until 2026-10-21, which is
   * the arithmetic of the live path mistaken for the range of the function.)
   *
   * CHOSEN at a placement and at a resize, and RELEASED on the first frame the camera's own centre
   * moves, because a lift chosen for one camera position aligns nothing at any other. It is never
   * re-chosen while Purple walks. `syncCamera` is where both halves happen and where the whole
   * argument, and the measurements behind it, live.
   */
  private snapLift = 0;
  /** A small pool of dust puffs, reused so walking never allocates. */
  private dust: Phaser.GameObjects.Sprite[] = [];
  private dustNext = 0;
  /** Distance walked since the last puff, so dust is tied to stride, not to frame rate. */
  private sinceStep = 0;
  /** Reused each frame so the update loop allocates nothing. */
  private readonly step: Vec = { x: 0, y: 0 };
  /** Who the run was talking to last frame, so a character hops once on the meeting's edge. */
  private talking: string | null = null;
  /** The forks and who lies down each way, read off the map once (world/forks.ts). */
  private forkList: Fork[] = [];
  /** One wooden sign per fork, standing only while the run has the `fork-signs` perk. */
  private forkBoards: Phaser.GameObjects.Sprite[] = [];
  /** The dusk's wash over the world, and the lantern's warm circle over it. */
  private duskWash: Phaser.GameObjects.Rectangle | null = null;
  private glow: Phaser.GameObjects.Sprite | null = null;
  /** A wing ride in progress, or null. */
  private flight: Flight | null = null;
  /** Grandma's door standing open (`early-welcome`), laid over the closed one; null if unbuilt. */
  private openedDoor: Phaser.GameObjects.Image | null = null;
  /** The decor layer the door is painted in, kept so the open door can be built from its tile. */
  private decorBelow: Phaser.Tilemaps.TilemapLayer | null = null;

  constructor(run: WorldRun, bus: Bus, controls: Input, hasInput: () => boolean = () => true) {
    super('Forest');
    this.run = run;
    this.bus = bus;
    this.controls = controls;
    this.hasInput = hasInput;
  }

  create(): void {
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tiled = this.cache.tilemap.get('map-forest')?.data as unknown;
    if (!tiled) throw new Error('map-forest was not loaded');
    this.map = readForestMap(tiled);
    this.sketched = sketchMap(tiled, gids, (spawn) => this.run.castOf(spawn)?.id ?? null);

    const phaserMap = this.make.tilemap({ key: 'map-forest' });
    const tiles = phaserMap.addTilesetImage('tileset-forest', 'tileset-forest');
    if (!tiles) throw new Error('Tileset "tileset-forest" is missing from the map');
    this.ground = phaserMap.createLayer('ground', tiles)?.setDepth(0) ?? null;
    this.decorBelow = phaserMap.createLayer('decor-below', tiles)?.setDepth(1) ?? null;
    // The canopy layer always draws over Purple, so she walks behind tree tops.
    phaserMap.createLayer('decor-above', tiles)?.setDepth(10_000);
    // Read before anybody is placed: every figure asks for the colour of their own tile on arrival.
    this.inks = tileInks(tiles);

    this.createNpcs();

    const spawn = findObject(this.map, 'spawn-purple');
    if (!spawn) throw new Error('Map has no "spawn-purple" object');
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + PURPLE_FEET_BELOW_SPAWN };
    this.purple = this.add
      .sprite(this.position.x, this.position.y, 'purple', 'purple-idle-down-0')
      .setOrigin(0.5, 1);
    this.purpleInk = unionOf(
      (['down', 'left', 'right', 'up'] as const).map((f) =>
        this.textures.exists('purple')
          ? inkOf(this.textures.getFrame('purple', `purple-idle-${f}-0`))
          : null,
      ),
      { width: this.purple.width, height: this.purple.height },
    );
    const bubble = this.textures.exists('fx-interact-prompt')
      ? [0, 1].map((i) => inkOf(this.textures.getFrame('fx-interact-prompt', i)))
      : [];
    this.bubbleInk = unionOf(bubble, { width: TILE, height: TILE });
    /*
     * Her depth comes with her, not with her first step.
     *
     * Everywhere else that moves Purple sets `depth = y` -- `resetToSpawn`, `stageArrival`, `move`
     * -- and creation did not, so she was born at depth 0 and stayed there until the player
     * pressed a key. At depth 0 she sorts under `decor-below` (depth 1), under the wolf's prints
     * (2) and under every character in the cast, whose depth is their own fixed y and therefore
     * always wins. A player who looks at the forest before walking is looking at the one frame
     * where the heroine is behind the scenery, and that frame is the opening shot.
     */
    // Her pool before her first placing, because `placePurple` seats the two of them together.
    this.purpleShadow = this.addShadow(
      footprintOf(this.textures.getFrame('purple', 'purple-idle-down-0')),
    );
    this.placePurple();
    this.lastOutside.x = this.position.x;
    this.lastOutside.y = this.position.y;
    this.createAnimations();
    this.startIdles();
    this.createDust();

    const cottage = findObject(this.map, 'trigger-cottage');
    if (!cottage) throw new Error('Map has no "trigger-cottage" object');
    this.cottage = cottage;
    const facade = findObject(this.map, 'prop-cottage');
    if (!facade) throw new Error('Map has no "prop-cottage" object');
    this.facade = facade;
    this.createPaws();
    this.createPerkProps();
    this.openedDoor = this.createOpenDoor(tiles);
    // Objects named `notice-<id>` hand their id straight to the content's notices.
    this.notices = this.map.objects.filter((o) => o.name.startsWith('notice-'));

    // A replay resets the store, but Purple is a world object and has to be sent home as well.
    this.bus.on('restartRun', () => this.resetToSpawn());

    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.camera = this.focus();
    // A placement, not a movement: the opening shot, so its top edge is snapped to a whole tile
    // row rather than opening on the bottom sliver of a canopy row. See `syncCamera`.
    this.syncCamera(0, true);
    /*
     * DOT ACCESS, NOT `env['VITE_E2E']`, AND THAT IS THE WHOLE POINT.
     *
     * Vite folds `import.meta.env.VITE_E2E` to a string literal at build time, so in a plain
     * production build this condition is constant-false and the minifier drops the branch and
     * everything it reaches. It does NOT fold the BRACKET form, which is what stood here. Measured
     * on a plain build of this tree: with brackets, `isSolidAt` and `mapObjects` were both in the
     * shipped JavaScript and the gate survived minification as a RUNTIME lookup against the baked
     * env object; with dot access, neither string is in the bundle at all.
     *
     * Being precise about what that cost, because the round that found it overstated it and the
     * overstatement is easy to repeat: the runtime lookup is false in a plain build, so a plain
     * build does not actually define `window.__otp`. What shipped was the dead payload, not a live
     * handle. The live case is `apps/game/dist` AFTER `pnpm e2e`, which builds with the flag and
     * leaves the result sitting there -- deploy that directory and the store, the bus, the content
     * and this scene are all reachable from the page. Folding the branch out is the difference
     * between "we believe the flag was off" and "the code is not in the file", and on a data
     * security company's public marketing asset that is a difference worth one character.
     *
     * e2e/world.spec.ts builds a plain bundle of its own and fails if the scene hooks appear in it.
     */
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
      const w = window as unknown as { __otp?: Record<string, unknown> };
      if (w.__otp) {
        w.__otp['scene'] = this;
        w.__otp['isSolidAt'] = (x: number, y: number) => blocked(this.map.collision, x, y);
        w.__otp['mapObjects'] = this.map.objects;
      }
    }
    this.bus.emit('worldReady', undefined);
  }

  /**
   * Purple on screen where `this.position` says she is, sorted by her own feet.
   *
   * The pair was written out four times and omitted once, which is how she shipped at depth 0.
   */
  private placePurple(): void {
    this.purple.setPosition(Math.round(this.position.x), Math.round(this.position.y));
    this.purple.setDepth(this.purple.y);
    this.seatShadow(this.purpleShadow, this.position.x, this.position.y);
  }

  /**
   * An unplaced, uncoloured pool for one figure, sized from the feet that will stand in it.
   *
   * Hidden until `seatShadow` has a tile to tint it from, so a figure standing somewhere the
   * ground cannot answer for -- off the ground layer, or with the tileset readback unavailable --
   * simply has no pool rather than a grey one.
   */
  private addShadow(footprint: number): Phaser.GameObjects.Ellipse {
    const width = footprint + SHADOW.spread;
    const depth = Math.max(SHADOW.minDepth, Math.round(width * SHADOW.flatten));
    return this.add.ellipse(0, 0, width, depth).setVisible(false);
  }

  /**
   * Puts a pool under one pair of feet and tints it from the tile they are standing on.
   *
   * A pixel above the feet, so the figure's own last row of ink stands in the middle of it rather
   * than on its far edge, and half a pixel behind her in the depth sort, so she draws over it. The
   * dust pool already sits a whole pixel behind for the same reason; half is used here because a
   * character standing one pixel uphill of Purple must still draw over her shadow, and at a whole
   * pixel they would not.
   */
  private seatShadow(shadow: Phaser.GameObjects.Ellipse, x: number, y: number): void {
    const ink = this.groundInkAt(x, y);
    if (ink === null) {
      shadow.setVisible(false);
      return;
    }
    shadow
      .setPosition(Math.round(x), Math.round(y) - 1)
      .setFillStyle(shaded(ink), SHADOW.alpha)
      .setDepth(Math.round(y) + SHADOW.behind)
      .setVisible(true);
  }

  /** The mean colour of the ground tile at a world point, or null if there is nothing to read. */
  private groundInkAt(x: number, y: number): number | null {
    const tile = this.ground?.getTileAt(Math.floor(x / TILE), Math.floor(y / TILE));
    if (!tile) return null;
    return this.inks.get(tile.index) ?? null;
  }

  /** Puts Purple back where she started, facing down, with every prompt cleared. */
  private resetToSpawn(): void {
    const spawn = findObject(this.map, 'spawn-purple');
    if (!spawn) return;
    // A ride cut short by a replay lands nowhere: the giver goes home and nobody is met.
    this.endFlight(false);
    this.talking = null;
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + PURPLE_FEET_BELOW_SPAWN };
    this.lastOutside.x = this.position.x;
    this.lastOutside.y = this.position.y;
    this.facing = 'down';
    this.stopWalking();
    /*
     * EVERY SECOND RUN OPENED ON THE HEROINE'S BACK.
     *
     * `stopWalking` is the only thing that puts an idle frame on Purple, and it returns early on
     * `!this.walking` -- rightly, because `update` calls it on every non-exploring frame and
     * re-setting the frame sixty times a second is seven hundred wasted Phaser calls a run. But
     * `stageArrival` has ALREADY stopped her by the time a replay gets here, so the early return
     * fires and the facing set a line above never reaches the sprite: she walks out of the cottage
     * shot still wearing `purple-idle-up-0` while `this.facing` says 'down', and the first frame of
     * the second run is the back of her head. It healed on the player's first keypress, which is
     * exactly late enough for the opening shot to be wrong and nothing else.
     *
     * So the frame is set here, the same pair `stageArrival` sets for the same reason -- the guard
     * inside `stopWalking` stays where it is and keeps paying for itself on every idle frame.
     */
    this.purple.stop();
    this.purple.setFrame(`purple-idle-${this.facing}-0`);
    this.placePurple();
    this.clearReach();
    // A replay starts outside every trigger, whatever Purple was standing on when the run ended.
    this.triggered.clear();
    // The last run's trail is the last run's. A replay that kept it would promise an ending the
    // new run has not earned, in the one place the game puts a fact on the ground.
    this.arrived = false;
    for (const paw of this.paws) paw.setVisible(false);
    // Snap, not ease: a replay should not pan across the forest from wherever the last run ended.
    // A placement, so the top edge is snapped to a whole tile row, exactly as in `create`: the
    // second run's opening shot is the same shot as the first's and must not keep the band.
    this.camera = this.purpleFocus();
    this.syncCamera(0, true);
  }

  /**
   * The prints on the lane, laid down hidden at boot. `fx-pawprints` has been drawn, three-framed
   * and shipped to every player since the remaster and placed nowhere (docs/UX_REVIEW.md 3); it is
   * the ending in one detail, so it belongs on the path outside the door and nowhere else.
   *
   * Depth 2 puts them above the ground and the decor painted into it and below every character,
   * so Purple walks over her own doorstep rather than behind it.
   */
  private createPaws(): void {
    this.paws = PAW_TRAIL.map(({ frame, dx, dy }) =>
      this.add
        .sprite(this.cottage.x + dx, this.cottage.y + dy, 'fx-pawprints', frame)
        .setDepth(2)
        .setVisible(false),
    );
  }

  /**
   * What the perks draw on the canvas, laid down hidden at boot and shown by `drawPerks` while the
   * run has the perk: a wooden sign at every fork, the dusk's wash and the lantern's glow. No words
   * on any of them -- the fork sign's who-and-which-way is DOM over the board (ui/ForkSigns.tsx).
   */
  private createPerkProps(): void {
    if (this.sketched) {
      const forks = this.map.objects.filter((o) => o.name.startsWith('fork-'));
      const props = this.map.objects.filter((o) => o.name.startsWith('prop-'));
      this.forkList = readForks(this.sketched, forks, props);
    }
    this.forkBoards = this.forkList.map((f) => {
      // The board points from its crook towards the road it stands beside (frame 0 left, 1 right).
      const frame = f.sign.col <= f.col ? 1 : 0;
      const x = f.sign.col * TILE + TILE / 2;
      const y = (f.sign.row + 1) * TILE;
      return this.add
        .sprite(x, y, 'prop-forksign', frame)
        .setOrigin(0.5, 1)
        .setDepth(y)
        .setVisible(false);
    });
    this.duskWash = this.add
      .rectangle(0, 0, 1, 1, tokenColor('--cyera-black') ?? 0, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DUSK_DEPTH)
      .setAlpha(0)
      .setVisible(false);
    this.glow = this.add
      .sprite(0, 0, 'fx-lantern-glow', 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(GLOW.scale)
      .setDepth(GLOW_DEPTH)
      .setVisible(false);
  }

  /**
   * GRANDMA'S DOOR, OPEN: built once at boot from the closed door tile the game loaded (world/door.ts
   * says how, and why the art is not regenerated for it), laid over the closed door hidden, and
   * shown by `drawPerks` while the run has an early welcome.
   *
   * The door's cell is read off the map, not named: `trigger-cottage` is the lane and its first
   * column is the door's (see `stageArrival`), so the door is the `decor-below` tile one row above
   * the lane's top-left. The lamp is the lit window's own light. If any of that cannot be read --
   * no tile there, no lit window, a tileset the canvas cannot read back -- there is no open door
   * and the closed one stands, which is the run without the perk: wrong by omission, never by
   * invention.
   */
  private createOpenDoor(tiles: Phaser.Tilemaps.Tileset): Phaser.GameObjects.Image | null {
    const col = Math.floor(this.cottage.x / TILE);
    const row = Math.floor(this.cottage.y / TILE) - 1;
    const door = this.decorBelow?.getTileAt(col, row);
    const lit = (gids as Record<string, number>)['wall-window-lit'];
    const image = tiles.image?.getSourceImage();
    if (!door || lit === undefined || !image) return null;
    const key = 'fx-door-open';
    try {
      const read = (gid: number): Uint8ClampedArray | null => {
        const at = tiles.getTileTextureCoordinates(gid) as { x: number; y: number } | null;
        if (!at) return null;
        const canvas = document.createElement('canvas');
        canvas.width = TILE;
        canvas.height = TILE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(image as CanvasImageSource, at.x, at.y, TILE, TILE, 0, 0, TILE, TILE);
        return ctx.getImageData(0, 0, TILE, TILE).data;
      };
      const closed = read(door.index);
      const glass = read(lit);
      const lamp = glass ? brightestWarm(glass) : null;
      if (!closed || !lamp) return null;
      if (!this.textures.exists(key)) {
        const texture = this.textures.createCanvas(key, TILE, TILE);
        if (!texture) return null;
        texture.context.putImageData(new ImageData(openDoor(closed, TILE, lamp), TILE, TILE), 0, 0);
        texture.refresh();
      }
    } catch {
      return null;
    }
    return this.add
      .image(col * TILE, row * TILE, key)
      .setOrigin(0, 0)
      .setDepth(DOOR_DEPTH)
      .setVisible(false);
  }

  /** Whether Grandma's door is drawn open this frame: for the specs. */
  get doorOpen(): boolean {
    return this.openedDoor?.visible ?? false;
  }

  /**
   * The perks that are a STATE of the forest rather than a moment, re-read every frame from the run
   * (world/run.ts), so a replay that clears the perks clears what they drew with no bookkeeping.
   */
  private drawPerks(): void {
    const signs = this.run.forkSigns();
    for (const board of this.forkBoards) if (board.visible !== signs) board.setVisible(signs);

    const welcome = this.run.welcome();
    const door = this.openedDoor;
    if (door && door.visible !== welcome) door.setVisible(welcome);

    const dusk = this.run.dusk();
    const main = this.cameras.main;
    const wash = this.duskWash;
    if (wash) {
      if (wash.width !== main.width || wash.height !== main.height)
        wash.setSize(main.width, main.height);
      if (wash.alpha !== dusk) wash.setAlpha(dusk);
      if (wash.visible !== dusk > 0) wash.setVisible(dusk > 0);
    }

    const glow = this.glow;
    if (glow) {
      const lit = this.run.lantern();
      if (glow.visible !== lit) glow.setVisible(lit);
      if (lit) {
        const darkest = this.run.darkest();
        const share = darkest > 0 ? Math.min(1, dusk / darkest) : 0;
        glow
          .setPosition(Math.round(this.position.x), Math.round(this.position.y - GLOW.lift))
          // Never full: at full strength the additive light washes Purple out in her own circle.
          .setAlpha(GLOW.least + (GLOW.most - GLOW.least) * share);
      }
    }
  }

  /** The dusk's wash as it stands this frame, 0 when there is none: for the specs. */
  get duskShown(): number {
    return this.duskWash?.visible ? this.duskWash.alpha : 0;
  }

  /** The forks and who lies down each way, for the sign labels (ui/ForkSigns.tsx). */
  get forks(): readonly Fork[] {
    return this.forkList;
  }

  /**
   * Where the top of a fork's board is, in world pixels: the DOM label stands on it. Null for a
   * fork the map does not have.
   */
  boardTop(name: string): Vec | null {
    const i = this.forkList.findIndex((f) => f.name === name);
    const board = this.forkBoards[i];
    if (!board) return null;
    return { x: board.x, y: board.y - board.height };
  }

  /**
   * A world point on the canvas, in GAME pixels from the canvas's top-left -- the camera's own
   * viewport offset and scroll applied -- or null before the scene is built. The DOM multiplies by
   * the canvas's CSS scale, which only the page knows.
   */
  toCanvas(world: Vec): Vec | null {
    const main = this.cameras?.main;
    if (!main) return null;
    return { x: main.x + world.x - main.scrollX, y: main.y + world.y - main.scrollY };
  }

  /** The canvas's width in game pixels, for the DOM's scale. */
  get canvasWidth(): number {
    return this.scale.gameSize.width;
  }

  /**
   * Every visible figure's frame on the canvas, in game pixels: what the minimap must not cover.
   * Reused, not reallocated, past the first call -- the minimap asks every frame.
   */
  castOnCanvas(): readonly Rect[] {
    const main = this.cameras?.main;
    if (!main) return [];
    while (this.castBoxes.length < this.npcs.length)
      this.castBoxes.push({ x: 0, y: 0, width: 0, height: 0 });
    this.npcs.forEach((npc, i) => {
      const r = this.castBoxes[i]!;
      const s = npc.sprite;
      r.width = s.visible ? s.width : 0;
      r.height = s.visible ? s.height : 0;
      r.x = main.x + s.x - s.width / 2 - main.scrollX;
      r.y = main.y + s.y - s.height - main.scrollY;
    });
    return this.castBoxes;
  }
  private readonly castBoxes: Rect[] = [];

  /**
   * THE WORD WEAVER'S PAPER BIRD: it takes off from Purple's hand and flies towards Grandma's door
   * -- word sent ahead, seen going where it is going (`PAPER_BIRD`). The art faces east (its beak
   * is at the right of the frame), so it is mirrored when the cottage lies west of her. Gone under
   * reduced motion: the toast says the perk, and nothing flies.
   */
  releasePaperBird(): void {
    if (this.reducedMotion) return;
    if (!this.anims.exists('fx-paperbird-flap'))
      this.anims.create({
        key: 'fx-paperbird-flap',
        frames: [0, 1, 2, 3].map((frame) => ({ key: 'fx-paperbird', frame })),
        frameRate: PAPER_BIRD.frameRate,
        repeat: -1,
      });
    const bird = this.add
      .sprite(Math.round(this.position.x), Math.round(this.position.y - TILE), 'fx-paperbird', 0)
      .setScale(2)
      .setDepth(SKY_DEPTH)
      .play('fx-paperbird-flap');
    const end = this.paperBirdEnd(bird.x, bird.y);
    bird.setFlipX(end.x < bird.x);
    this.paperBird = bird;
    this.paperBirdTo = end;
    this.tweens.add({
      targets: bird,
      x: end.x,
      y: end.y,
      alpha: 0,
      duration: PAPER_BIRD.ms,
      ease: 'Sine.easeIn',
      onComplete: () => {
        bird.destroy();
        if (this.paperBird === bird) this.paperBird = null;
      },
    });
  }

  /**
   * Where the paper bird is last seen, from (x, y): `reach` along the bearing to the middle of
   * Grandma's door, or the door itself if that is nearer, and `climb` higher than that line.
   */
  private paperBirdEnd(x: number, y: number): Vec {
    const door = { x: this.cottage.x + TILE / 2, y: this.cottage.y - TILE / 2 };
    const dx = door.x - x;
    const dy = door.y - y;
    const far = Math.hypot(dx, dy);
    const go = far > 0 ? Math.min(1, PAPER_BIRD.reach / far) : 0;
    return { x: Math.round(x + dx * go), y: Math.round(y + dy * go - PAPER_BIRD.climb) };
  }

  /** The paper bird in the air, and where it is flying to: for the specs. Null once it is gone. */
  private paperBird: Phaser.GameObjects.Sprite | null = null;
  private paperBirdTo: Vec | null = null;
  get paperBirdFlight(): { from: Vec; to: Vec; door: Vec; flipped: boolean } | null {
    const bird = this.paperBird;
    if (!bird || !this.paperBirdTo) return null;
    return {
      from: { x: bird.x, y: bird.y },
      to: this.paperBirdTo,
      door: { x: this.cottage.x + TILE / 2, y: this.cottage.y - TILE / 2 },
      flipped: bird.flipX,
    };
  }

  /** Whether a wing ride is in the air: main.ts keeps the walk paused for it. */
  get flying(): boolean {
    return this.flight !== null;
  }

  /**
   * THE MAGPIE'S WING RIDE: Purple is carried to the talking spot of `to` over `ms`, the camera
   * following, by a copy of the giver's own figure flying above her (the giver steps out of their
   * spot for the flight). Under reduced motion it is a quick fade out and in instead, and the clock
   * still runs the whole `ms`. `landed` is called once, when she is down.
   *
   * Collision is not consulted on the way -- she is in the air -- but the landing spot is a walkable
   * place beside the character, within talking reach.
   */
  flyTo(to: string, giver: string | null, ms: number, landed: () => void): boolean {
    const target = this.npcs.find((n) => n.id === to);
    if (!target) return false;
    this.endFlight(false);
    const spots = [
      { x: target.x, y: target.y + TILE * 0.75 },
      { x: target.x - TILE, y: target.y + TILE * 0.5 },
      { x: target.x + TILE, y: target.y + TILE * 0.5 },
      { x: target.x, y: target.y - TILE },
    ];
    const spot = spots.find((s) => !blocked(this.map.collision, s.x, s.y)) ?? spots[0]!;
    const home = this.npcs.find((n) => n.id === giver) ?? null;
    let carrier: Phaser.GameObjects.Sprite | null = null;
    if (!this.reducedMotion && home) {
      carrier = this.add
        .sprite(this.position.x, this.position.y, home.sprite.texture.key, 0)
        .setOrigin(0.5, 1)
        .setDepth(SKY_DEPTH + 1);
      home.sprite.setVisible(false);
      home.shadow.setVisible(false);
      this.hidePrompt(home);
    }
    this.stopWalking();
    this.clearReach();
    this.flight = {
      from: { ...this.position },
      to: spot,
      ms: Math.max(1, ms),
      t: 0,
      fade: this.reducedMotion,
      carrier,
      giver: home,
      landed,
    };
    if (this.flight.fade) this.cameras.main.fadeOut(FLIGHT.fadeMs);
    return true;
  }

  /** One frame of the ride. */
  private stepFlight(deltaMs: number): void {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(f.ms, f.t + deltaMs);
    if (f.fade) {
      // Out, across while dark, in: the camera's own fade, and the position moves in the dark.
      if (f.t >= FLIGHT.fadeMs && (this.position.x !== f.to.x || this.position.y !== f.to.y)) {
        this.position = { ...f.to };
        this.placePurple();
        this.camera = this.purpleFocus();
        this.cameras.main.fadeIn(FLIGHT.fadeMs);
      }
    } else {
      const p = f.t / f.ms;
      const eased = 0.5 - Math.cos(Math.PI * p) / 2;
      const dx = f.to.x - f.from.x;
      const dy = f.to.y - f.from.y;
      const lift =
        Math.min(FLIGHT.arcMax, Math.hypot(dx, dy) * FLIGHT.arcShare) * Math.sin(Math.PI * p);
      this.position = { x: f.from.x + dx * eased, y: f.from.y + dy * eased };
      this.facing = facingFrom({ x: dx, y: dy }, this.facing);
      this.purple.setFrame(`purple-idle-${this.facing}-0`);
      const x = Math.round(this.position.x);
      const y = Math.round(this.position.y - lift);
      this.purple.setPosition(x, y).setDepth(SKY_DEPTH);
      this.seatShadow(this.purpleShadow, this.position.x, this.position.y);
      if (f.carrier) {
        const giverFaces = f.giver?.faces ?? 1;
        f.carrier
          .setPosition(x, Math.round(y - FLIGHT.carrierAbove))
          .setFlipX(dx !== 0 && Math.sign(dx) !== giverFaces);
      }
    }
    if (f.t >= f.ms) this.endFlight(true);
  }

  /**
   * Down: Purple on the spot, the carrier away and the giver home. `landed` only when the ride
   * finished rather than being cut short by a replay.
   */
  private endFlight(arrived: boolean): void {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    if (arrived) {
      this.position = { ...f.to };
      this.facing = 'up';
      this.purple.setFrame(`purple-idle-${this.facing}-0`);
    }
    this.placePurple();
    if (f.fade) this.cameras.main.resetFX();
    if (f.carrier) {
      const carrier = f.carrier;
      this.tweens.add({
        targets: carrier,
        y: carrier.y - TILE * 4,
        alpha: 0,
        duration: 500,
        ease: 'Sine.easeIn',
        onComplete: () => carrier.destroy(),
      });
    }
    if (f.giver) {
      f.giver.sprite.setVisible(true);
      this.seatShadow(f.giver.shadow, f.giver.sprite.x, f.giver.sprite.y);
    }
    if (arrived) f.landed();
  }

  private createNpcs(): void {
    // Who each spawn is depends on the rulebook: v1's bystanders are v2's cast (world/run.ts).
    for (const spawn of [...npcSpawns(this.map), ...bystanderSpawns(this.map)]) {
      const who = this.run.castOf(spawn.spawnName);
      if (who) this.npcs.push(this.createCharacter(who.kind, { ...spawn, id: who.id }));
    }
  }

  /**
   * One character on their tile, with their bubble over their head.
   *
   * `npcSpawns`/`bystanderSpawns` hand back the CENTRE of the spawn tile, and the sprite's origin
   * is its feet, so the feet belong half a tile lower -- on the tile's bottom edge, which is where
   * a character standing on a tile stands. This used to add half the FRAME height (24), so every
   * one of the eight stood 8px into the tile below their own: past the verge of the path they are
   * meant to be on, and 10px below Purple's own contact line on the same row of ground.
   */
  private createCharacter(
    kind: Npc['kind'],
    spawn: { id: string; spawnName: string; x: number; y: number },
  ): Npc {
    const key = spawn.spawnName;
    if (!this.textures.exists(key)) throw new Error(`Missing sprite "${key}"`);
    const sprite = this.add.sprite(spawn.x, spawn.y + TILE / 2, key, 0).setOrigin(0.5, 1);
    sprite.setDepth(sprite.y);
    const headroom = headroomOf(this.textures.getFrame(key, 0));
    const prompt = this.add
      .sprite(spawn.x, sprite.y - headroom - PROMPT_GAP, 'fx-interact-prompt', 0)
      .setOrigin(0.5, 1)
      .setDepth(9000)
      .setVisible(false);
    // Seated once: nobody in the cast ever moves off the tile they were placed on.
    const shadow = this.addShadow(footprintOf(this.textures.getFrame(key, 0)));
    this.seatShadow(shadow, sprite.x, sprite.y);
    const faces = facingOf(this.textures.getFrame(key, 0));
    const ink = unionOf([inkOf(this.textures.getFrame(key, 0))], {
      width: sprite.width,
      height: sprite.height,
    });
    return {
      kind,
      id: spawn.id,
      x: spawn.x,
      y: sprite.y,
      sprite,
      prompt,
      shadow,
      faces,
      sheet: key,
      ink,
      bubbleSide: null,
    };
  }

  private createAnimations(): void {
    for (const facing of ['down', 'left', 'right', 'up'] as const)
      if (!this.anims.exists(`purple-walk-${facing}`))
        this.anims.create({
          key: `purple-walk-${facing}`,
          // contact, pass, contact, pass. Without the second pass frame the three-frame loop
          // snapped back from the far contact to the near one and the legs jumped.
          frames: [0, 1, 2, 1].map((i) => ({ key: 'purple', frame: `purple-walk-${facing}-${i}` })),
          // Derived from the walk speed rather than fixed at 8, so the feet grip the ground
          // instead of skating: at 8fps a cycle covered 22px of path in three frames.
          frameRate: WALK_SPEED / PX_PER_WALK_FRAME,
          repeat: -1,
        });

    if (!this.anims.exists(PROMPT_BOB.key))
      this.anims.create({
        key: PROMPT_BOB.key,
        frames: [0, 1].map((frame) => ({ key: 'fx-interact-prompt', frame })),
        frameRate: PROMPT_BOB.frameRate,
        repeat: -1,
      });

    /*
     * One idle per character, each with a hold of its own (see IDLE), off the character's own
     * four-frame `-idle` strip -- or, for a sheet that has none yet, the static sheet's two frames,
     * the open eye and the blink, which is how the forest breathed before the strips were painted.
     * And one hop, off the `-hop` strip, for a figure that has one.
     */
    this.npcs.forEach((npc, i) => {
      const hold = IDLE.holdMs + ((i * IDLE.stepMs) % IDLE.spreadMs);
      const strip = `${npc.sheet}-idle`;
      if (!this.anims.exists(this.idleKey(npc)))
        this.anims.create({
          key: this.idleKey(npc),
          frames: this.textures.exists(strip)
            ? [0, 1, 2, 3].map((frame) => ({
                key: strip,
                frame,
                duration: frame === 0 ? hold : IDLE.beatMs,
              }))
            : [
                { key: npc.sheet, frame: 0, duration: hold },
                { key: npc.sheet, frame: 1, duration: IDLE.beatMs },
              ],
          repeat: -1,
        });
      const hop = `${npc.sheet}-hop`;
      if (this.textures.exists(hop) && !this.anims.exists(this.hopKey(npc)))
        this.anims.create({
          key: this.hopKey(npc),
          frames: [
            { key: hop, frame: 0, duration: HOP.crouchMs },
            { key: hop, frame: 1, duration: HOP.upMs },
          ],
          repeat: 0,
        });
    });
  }

  /** The idle animation belonging to one character, named after the sheet it plays from. */
  private idleKey(npc: Npc): string {
    return `${npc.sheet}-idle`;
  }

  /** The hop belonging to one character. */
  private hopKey(npc: Npc): string {
    return `${npc.sheet}-hop`;
  }

  /**
   * ONE HOP when Purple arrives to talk, then back to breathing. Nothing under reduced motion, where
   * nothing breathes either: the figure stays on its rest frame.
   */
  private hop(id: string): void {
    if (this.reducedMotion) return;
    const npc = this.npcs.find((n) => n.id === id);
    if (!npc || !this.anims.exists(this.hopKey(npc))) return;
    npc.sprite.play(this.hopKey(npc));
    npc.sprite.once(`animationcomplete-${this.hopKey(npc)}`, () => {
      npc.sprite.play(this.idleKey(npc));
    });
  }

  /**
   * THE CAST NOTICES PURPLE: each figure turns to face her while she is near and back to its own way
   * once she has gone, and the one she has just come to talk to hops. Every frame, whatever the
   * phase, because a meeting can come from a press of A, a wing ride landing or a spec.
   */
  private lifeOfCast(): void {
    const talking = this.run.talkingTo();
    if (talking !== this.talking) {
      this.talking = talking;
      if (talking !== null) this.hop(talking);
    }
    for (const npc of this.npcs) {
      const dx = this.position.x - npc.x;
      const near = Math.hypot(dx, this.position.y - npc.y) <= FACE_RADIUS;
      // Straight above or below them, a figure keeps whichever way it was already looking.
      if (near && Math.abs(dx) < 2) continue;
      const flip = near && Math.sign(dx) !== npc.faces;
      if (npc.sprite.flipX !== flip) npc.sprite.setFlipX(flip);
    }
  }

  /**
   * Sets the cast breathing, staggered so they are not in step on the first blink either.
   *
   * Silent under prefers-reduced-motion, exactly as Purple's dust is: the sprites stay on the
   * open-eyed frame they were created with, which is the forest as it has shipped until now.
   */
  private startIdles(): void {
    if (this.reducedMotion) return;
    this.npcs.forEach((npc, i) =>
      npc.sprite.play({ key: this.idleKey(npc), delay: i * IDLE.startStepMs }),
    );
  }

  /**
   * A pool of six puffs. Six is enough: at one puff per stride a puff has faded long before its
   * slot comes round again. Pooling keeps walking allocation-free.
   */
  private createDust(): void {
    if (!this.anims.exists('fx-dust-puff'))
      this.anims.create({
        key: 'fx-dust-puff',
        frames: [0, 1, 2].map((i) => ({ key: 'fx-dust', frame: i })),
        frameRate: 12,
        repeat: 0,
        hideOnComplete: true,
      });
    this.dust = Array.from({ length: 6 }, () =>
      this.add.sprite(0, 0, 'fx-dust', 0).setOrigin(0.5, 1).setVisible(false),
    );
  }

  /** Kicks a puff up at Purple's heel. Silent under prefers-reduced-motion. */
  private puff(): void {
    if (this.reducedMotion) return;
    const sprite = this.dust[this.dustNext % this.dust.length];
    this.dustNext++;
    if (!sprite) return;
    // Behind her, on the side she is leaving, and under her feet in the depth sort.
    const behind = this.facing === 'left' ? 3 : this.facing === 'right' ? -3 : 0;
    sprite
      .setPosition(Math.round(this.position.x + behind), Math.round(this.position.y))
      .setDepth(this.position.y - 1)
      .setVisible(true)
      .play('fx-dust-puff');
  }

  override update(_time: number, deltaMs: number): void {
    const state = this.run.state();
    const exploring = this.run.exploring() && this.hasInput();
    const input = this.controls.read();

    if (!this.arrived && this.run.atCottage()) this.stageArrival();
    this.drawPerks();
    this.lifeOfCast();

    if (this.flight) {
      // In the air: no walking, no triggers, no one in reach. The camera follows her down.
      this.stepFlight(deltaMs);
    } else if (exploring) {
      this.move(input.x, input.y, deltaMs, input.carry);
      // One proximity test per frame, shared by the bubble, the announcement and the A button,
      // rather than three scans of the cast that can disagree with each other by a pixel.
      const target = this.updatePrompts();
      this.announceWithinReach(target);
      if (input.interactPressed) this.interact(target);
      this.checkNotices(state);
      this.checkCottage(state);
      if (!overlaps(this.position, this.cottage)) {
        this.lastOutside.x = this.position.x;
        this.lastOutside.y = this.position.y;
      }
    } else {
      /*
       * THE BUBBLE OUTLIVED THE KEY THAT ANSWERS IT.
       *
       * Both of the lines above that say "you can talk to this person" -- the bobbing bubble over
       * their head and the live region that says it out loud -- were inside the `exploring` branch
       * and nowhere else. A notice post, a dialogue, a skill card: none of them changes the store
       * phase, they take the input away through `hasInput()`. So `exploring` goes false with the
       * phase still 'explore', this loop stops touching either of them, and the bubble and the
       * sentence FREEZE on screen at the precise moment the interact key is dead. Stand by the
       * Rabbit, step onto a notice, and the game is still pointing at the Rabbit and still telling
       * a screen-reader player they can talk now, while A does nothing at all.
       *
       * Cleared unconditionally rather than only when something is up: there is nothing to
       * remember, and both calls are edge-triggered, so a frame with nothing to clear costs two
       * comparisons. They re-arm on the next exploring frame from the same proximity test that
       * raised them, so nothing has to be put back.
       *
       * `stopWalking` keeps its own `!this.walking` guard -- this branch runs on every
       * non-exploring frame, and without it Purple's idle frame would be re-set sixty times a second.
       */
      this.stopWalking();
      this.clearReach();
    }
    this.syncCamera(deltaMs);
  }

  /**
   * The arrival, staged once on the beat that says you reached the door.
   *
   * Before this, "You reach the door. The lamp is lit." played over whatever Purple happened to be
   * standing on -- open forest, with a market stall and a rabbit in shot and no cottage anywhere
   * (docs/UX_REVIEW.md 3). It is the payoff frame of the whole asset and the approved board frames
   * it one way: the facade filling the shot, the door centred, Purple small on the step with her back
   * to us, the prints on the path beside her (reference/mocks/gameplay-concepts.png, panel 04).
   *
   * So this is a CUT, not a pan: Purple to the step, the camera to the door, the trail shown or not,
   * all on one frame. Easing any of it would swoop a tile and a half across the garden on a held
   * beat, and in the capture -- which dispatches ENTER_COTTAGE without walking -- would swoop the
   * width of the map.
   */
  private stageArrival(): void {
    this.arrived = true;

    // On the doorstep, in the door's own column, facing the door. `trigger-cottage` IS the lane,
    // so its first row is the step and its left edge is the door's left edge.
    this.position = { x: this.cottage.x + TILE / 2, y: this.cottage.y + TILE };
    this.stopWalking();
    this.facing = 'up';
    this.purple.stop();
    this.purple.setFrame(`purple-idle-${this.facing}-0`);
    this.placePurple();
    // Nobody is within reach on the doorstep, whoever she was standing next to a frame ago.
    this.clearReach();

    /*
     * The trail is a claim about what happened, so it is content's to make and not this file's:
     * `arrivePawEndings` names the endings on which something came up this path ahead of you. On
     * the other endings the approach lines say the earth by the step is unmarked, and it must be.
     */
    const earned = this.run.pawsEarned();
    for (const paw of this.paws) paw.setVisible(earned);

    /*
     * A placement, and deliberately NOT a snapped one: `syncCamera` refuses to snap the top edge
     * while `arrived` is true, because this shot is composed on the building and not on the tile
     * grid. The reasoning and the measured cost of snapping it are in `syncCamera`.
     */
    this.camera = this.doorFocus();
    this.syncCamera();
  }

  /**
   * `carry` is what a bounded walk still owes (`Input.walkFor`), or null. A frame never walks past
   * it, and spends what it ATTEMPTED rather than what the collision let through, so a press into a
   * tree still ends instead of pushing at the trunk forever.
   */
  private move(ix: number, iy: number, deltaMs: number, carry: number | null = null): void {
    const direction = movementVector({ x: ix, y: iy });
    // The Slow Post's lighter load: core's `walkFactor`, 1 without the perk. The legs keep pace.
    const factor = this.run.walkFactor();
    if (this.purple.anims.timeScale !== factor) this.purple.anims.timeScale = factor;
    const frame = (WALK_SPEED * factor * deltaMs) / 1000;
    const distance = carry === null ? frame : Math.min(frame, carry);
    if (carry !== null && (direction.x !== 0 || direction.y !== 0)) this.controls.spend(distance);
    this.step.x = direction.x * distance;
    this.step.y = direction.y * distance;

    if (this.step.x === 0 && this.step.y === 0) {
      this.stopWalking();
      return;
    }
    this.position = moveWithCollision(this.map.collision, this.position, this.step.x, this.step.y);
    this.facing = facingFrom(direction, this.facing);
    if (!this.walking) {
      this.walking = true;
      this.purple.play(`purple-walk-${this.facing}`, true);
    } else if (this.purple.anims.currentAnim?.key !== `purple-walk-${this.facing}`) {
      this.purple.play(`purple-walk-${this.facing}`, true);
    }
    this.placePurple();

    // One puff per stride, measured in ground covered rather than in frames, so the dust lands
    // with the foot at any frame rate.
    this.sinceStep += Math.hypot(this.step.x, this.step.y);
    if (this.sinceStep >= PX_PER_WALK_FRAME * 2) {
      this.sinceStep = 0;
      this.puff();
    }
  }

  private stopWalking(): void {
    this.sinceStep = 0;
    if (!this.walking) return;
    this.walking = false;
    this.purple.stop();
    this.purple.setFrame(`purple-idle-${this.facing}-0`);
  }

  /**
   * Who will still talk. A character whose skill has a verdict is done; a bystander never is,
   * because they are scenery and repeating themselves is in character.
   */
  private available(): Npc[] {
    return this.npcs.filter((npc) => npc.kind === 'bystander' || this.run.stillOffering(npc.id));
  }

  /** Puts the bubble over whoever is in range, and hands that person back to the caller. */
  private updatePrompts(): Npc | null {
    const target = nearest(this.position, this.available(), INTERACT_RADIUS);
    for (const npc of this.npcs) {
      if (npc === target) {
        this.showPrompt(npc);
        this.placePrompt(npc);
      } else this.hidePrompt(npc);
    }
    return target;
  }

  /**
   * A sprite's drawing in world pixels: its measured ink, placed by the sprite's bottom-centre
   * origin and mirrored with it.
   */
  private drawingOf(sprite: Phaser.GameObjects.Sprite, ink: Rect): Rect {
    const left = sprite.flipX ? sprite.width - ink.x - ink.width : ink.x;
    return {
      x: sprite.x - sprite.width / 2 + left,
      y: sprite.y - sprite.height + ink.y,
      width: ink.width,
      height: ink.height,
    };
  }

  /**
   * WHERE THE BUBBLE STANDS, every frame it is up (world/logic.ts `placeBubble`, which carries the
   * why): over the speaker's head unless that covers Purple or anybody else, or leaves the camera;
   * then beside the head, away from Purple. Measured against the figures as they stand THIS frame,
   * Purple walking and the cast turning to face her, so it follows her round them. Two writes at
   * most, and only when the answer moved.
   */
  private placePrompt(npc: Npc): void {
    const main = this.cameras.main;
    const others: Rect[] = [this.drawingOf(this.purple, this.purpleInk)];
    for (const other of this.npcs)
      if (other !== npc && other.sprite.visible)
        others.push(this.drawingOf(other.sprite, other.ink));
    const place = placeBubble({
      talker: this.drawingOf(npc.sprite, npc.ink),
      frame: { width: npc.prompt.width, height: npc.prompt.height },
      ink: this.bubbleInk,
      others,
      view: { x: main.scrollX, y: main.scrollY, width: main.width, height: main.height },
      gap: PROMPT_GAP,
      awayFromX: this.position.x,
      keep: npc.bubbleSide,
    });
    npc.bubbleSide = place.side;
    if (npc.prompt.x !== place.x || npc.prompt.y !== place.y)
      npc.prompt.setPosition(place.x, place.y);
    if (npc.prompt.flipX !== place.flip) npc.prompt.setFlipX(place.flip);
  }

  /**
   * Raises the bubble and starts it bobbing. Still, not absent, under prefers-reduced-motion.
   *
   * Both of these are edge-triggered on the bubble's own visibility, and that is not a
   * micro-optimisation: `updatePrompts` runs on every frame for every character, and both Phaser
   * calls underneath have side effects. `play` restarted from frame 0 would mean a bob that never
   * reaches frame 1, and `stop` on seven already-hidden bubbles emits seven ANIMATION_STOP events
   * a frame -- four hundred a second -- for nothing at all. The bob the animation registers has
   * `repeat: -1`, so once it is playing it does not need re-arming.
   */
  private showPrompt(npc: Npc): void {
    if (npc.prompt.visible) return;
    npc.prompt.setVisible(true);
    if (this.reducedMotion) npc.prompt.setFrame(0);
    else npc.prompt.play(PROMPT_BOB.key, true);
  }

  private hidePrompt(npc: Npc): void {
    if (!npc.prompt.visible) return;
    npc.prompt.stop();
    npc.prompt.setVisible(false);
    // The next time it is raised it starts from over the head again, not from wherever it last was.
    npc.bubbleSide = null;
  }

  /**
   * The bubble, said out loud (docs/UX_REVIEW.md 16).
   *
   * The proximity test above has always been computed -- it is what shows the prompt -- and never
   * reported, so a sighted player gets a speech bubble over the Rabbit and a screen-reader player
   * gets silence. The three encounters the whole game is built from were undiscoverable: the only
   * way to find anybody was to sweep the forest pressing Space.
   *
   * On the edge rather than every frame, because the listener is a polite live region and a region
   * whose text is rewritten sixty times a second is a region that never finishes a sentence.
   */
  private announceWithinReach(target: Npc | null): void {
    const id = target?.id ?? null;
    if (id === this.withinReach) return;
    this.withinReach = id;
    window.dispatchEvent(new CustomEvent(WITHIN_REACH, { detail: { id } }));
  }

  /**
   * Takes back both offers to talk: the bubble a player looks at and the sentence one listens to.
   *
   * One method because they are one claim. The three places that need to withdraw it -- the
   * replay, the arrival, and any frame where a panel holds the input -- each used to write the
   * pair out by hand, and the pair is only correct when BOTH halves are said: a scene that hid the
   * bubble and left the live region holding "Rabbit, within reach: you can talk now" has told a
   * sighted player one thing and a screen-reader player another.
   */
  private clearReach(): void {
    for (const npc of this.npcs) this.hidePrompt(npc);
    this.announceWithinReach(null);
  }

  private interact(target: Npc | null): void {
    if (!target) return;
    if (target.kind === 'bystander') this.bus.emit('greetBystander', { bystanderId: target.id });
    else this.bus.emit('interact', { characterId: target.id });
  }

  /**
   * Fires `emit` when Purple steps onto `rect`, and again only if the run has moved on under her feet.
   *
   * See the note on `triggered`. `run` is the store's state object; the store replaces it on a
   * dispatch that changes anything and leaves it alone otherwise, so identity is the cheapest
   * honest answer to "is this the same run it was last frame".
   */
  private onEnter(id: string, rect: Rect, run: unknown, emit: () => void): void {
    if (!overlaps(this.position, rect)) {
      this.triggered.delete(id);
      return;
    }
    if (this.triggered.get(id) === run) return;
    this.triggered.set(id, run);
    emit();
  }

  private checkNotices(run: unknown): void {
    for (const notice of this.notices) {
      const id = notice.name.slice('notice-'.length);
      this.onEnter(notice.name, notice, run, () =>
        this.bus.emit('reachedNotice', { noticeId: id }),
      );
    }
  }

  private checkCottage(run: unknown): void {
    this.onEnter('trigger-cottage', this.cottage, run, () =>
      this.bus.emit('enteredCottage', undefined),
    );
  }

  /**
   * @param cut true when the camera is being PLACED rather than moved -- see the snap below.
   */
  private syncCamera(deltaMs = 0, cut = false): void {
    // The centre eases after Purple and holds still while she is inside the deadzone; cameraTopLeft
    // still rounds, so the scroll stays on whole pixels and the tiles never shimmer.
    const restedAt = this.camera.y;
    this.camera = cameraFollow(this.camera, this.focus(), deltaMs);
    /*
     * Whether the camera itself moved this frame, which is the question the lift's lifetime turns
     * on. Measured on the CAMERA and not on Purple: inside the deadzone she moves and it does not,
     * and a camera that has not moved still has the whole tile row its placement bought it.
     */
    const moved = this.camera.y !== restedAt;
    const world = { width: this.map.widthInPixels, height: this.map.heightInPixels };
    const view = this.viewFor(this.camera, world);
    const main = this.cameras.main;
    /*
     * The view, centred on the canvas, which is the whole of the letterbox: everything the camera
     * does not cover is left showing the game's own background -- Cyera Black, the colour of the
     * frame's header strip directly above it -- so the surplus reads as frame and not as void.
     *
     * Written on CHANGE, not every frame, and the comparison is what makes that safe. The Scale
     * Manager only resizes a camera that is still at 0x0 and still the previous game size
     * (CameraManager.onResize), so once a letterbox is up Phaser stops maintaining the camera and
     * this is the only thing that will: it recomputes from the live `gameSize` each frame and
     * therefore heals a resize taken while standing at the door.
     */
    const vx = Math.round((this.scale.gameSize.width - view.width) / 2);
    const vy = Math.round((this.scale.gameSize.height - view.height) / 2);
    const reframed =
      main.x !== vx || main.y !== vy || main.width !== view.width || main.height !== view.height;
    if (reframed) main.setViewport(vx, vy, view.width, view.height);
    /*
     * THE DARK BAND ACROSS THE TOP OF THE WORLD, which is the client's oldest complaint.
     *
     * `snapTopEdge` in packages/core/src/camera.ts carries the whole argument -- what the band is,
     * how causation was proved by moving Purple and not the map, why it is CEIL, and the four ways of
     * doing it that were tried and rejected. The one thing that belongs here rather than there is
     * WHEN, because "when" is a fact about this file and about nothing else.
     *
     * This camera moves in exactly two ways and only one of them may be snapped:
     *
     *   IT EASES, every frame, out of `update` -> `syncCamera(deltaMs)`. Snapping an eased camera
     *   quantises the scroll, so walking north or south moves the world a whole 32px tile at a
     *   time instead of sliding: judder, which is a worse defect than the band and which the
     *   client would report as a new bug. So `cut` is false there and nothing is snapped.
     *
     *   IT IS PLACED, with no motion before it to be continuous with. That is `cut` -- the opening
     *   shot in `create` and the replay's in `resetToSpawn` -- and it is also `reframed`, a resize:
     *   the viewport rectangle has just changed underneath the camera, so there is no continuity
     *   left to protect and a snap in the same frame costs nothing. Without the `reframed` half,
     *   rotating a phone on the title screen brings the band back and leaves it there until the
     *   player walks, which is the whole defect again at the one moment the client is looking.
     *
     * NOT AT THE DOOR, and that is a refusal with a measurement behind it. The payoff frame is
     * composed on the BUILDING -- `doorFocus` centres the chimney row, the facade and the three
     * rows of lane -- and e2e/scene-second-pass.spec.ts asserts the building's centre lands within
     * ONE game pixel of the canvas's at every payoff viewport. Snapping it was measured first:
     * it moves the camera +31px at 1280x800, +27 at 375x812, +19 at 2560x1440, +7 at 1673x449.
     * Every one of those is the building sliding off its centre line, which is the exact defect
     * that spec was written for. Centred on the facade and aligned to the tile grid are two
     * different rectangles and the map cannot give both, so the composed one wins and the arrival
     * is left alone. `this.arrived` is the test, not the call site, so a future cut cannot opt
     * into the snap at the door by accident.
     *
     * AND THE VIEW IS NOT CIRCULAR HERE, which is why the snap reads `view` from the line above
     * rather than recomputing. `viewFor` returns the whole canvas whenever `!this.arrived`, so on
     * every path that can reach this branch the view does not depend on the camera's centre and
     * shifting the centre cannot change it. On the arrived path it does depend on the centre --
     * and that is the path this branch refuses.
     *
     * IT GOES INTO `snapLift`, AND THE FIRST VERSION OF THIS FIX DID NOT, which is the failure
     * worth recording here because it passed every test and a screenshot of the opening frame,
     * and still did not work. That version shifted `this.camera.y` directly and left `purpleFocus`
     * alone, so the very next frame `cameraFollow` saw the camera 31px from its target, measured
     * that against `CAMERA_DEADZONE.y` -- which is 20 -- found it outside, and EASED THE SNAP
     * BACK OUT. Measured by placing the camera and running sixty frames of the real follow:
     *
     *     1673x449   shift 11px   row 15.000 -> 15.000  holds
     *     390x844    shift 10px   row 12.000 -> 12.000  holds
     *     1280x800   shift  7px   row 15.000 -> 15.000  holds
     *     375x812    shift 31px   row 13.000 -> 12.656  DRIFTS 11px
     *     768x1024   shift 31px   row 16.000 -> 15.656  DRIFTS 11px
     *
     * -- so it held at five viewports and quietly came undone at the project's own phone and
     * tablet, over about a third of a second, as a creep the player can see on the title screen.
     * A snap smaller than the deadzone sticks by accident; one larger than it does not, and which
     * you get depends on the viewport height. That is not a fix, it is a coin toss.
     *
     * So the lift is part of what the camera is AIMING at, not something done to it afterwards:
     * `purpleFocus` adds `snapLift`, the deadzone is measured around the lifted target, and there is
     * nothing for the follow to pull back. It is a CONSTANT translation, re-chosen only here at a
     * placement, so it cannot quantise the scroll while she walks -- which is the whole reason the
     * every-frame version was rejected. And it is SET from the unlifted camera rather than added
     * to, which is `snapCentreToRow`'s job and is measured there: six rotations of a phone leave
     * the correct version carrying 6px and the accumulating one 109px, 3.41 tiles, with its centre
     * 217px UP the map. (This paragraph said "down the map" until 2026-10-21. The sign is the other
     * way -- the accumulated lift is subtracted from the centre more often than it is added -- and
     * the figure was nobody's measurement at all.)
     *
     * AND IT IS RELEASED ON THE FIRST FRAME THE CAMERA MOVES, which is the half this fix was sent
     * back for not having. The lift went into `purpleFocus` for the WHOLE RUN, and `CAMERA_FOCUS_Y`
     * is -20, so at the two viewports whose lift is 31 -- 375x812 and 768x1024, the project's own
     * phone and tablet -- the camera spent an entire playthrough aiming eleven pixels BELOW Purple's
     * feet, out of a method whose own docstring says it frames her chest. The cost, measured as
     * where her feet sit down the frame at the opening shot, unlifted -> lifted:
     *
     *     1673x449   view 1280x366   lift 11   55.46% -> 52.46%
     *     390x844    view  384x556   lift 10   53.60% -> 51.80%
     *     1280x800   view  620x358   lift  7   55.59% -> 53.63%
     *     768x1024   view  380x342   lift 31   55.85% -> 46.78%
     *     375x812    view  368x534   lift 31   53.75% -> 47.94%
     *     844x390    view  806x308   lift 14   56.49% -> 51.95%
     *     2560x1440  view 1260x678   lift  7   52.95% -> 51.92%
     *     320x568    view  352x358   lift  7   55.59% -> 53.63%
     *     390x600    view  384x382   lift 19   55.24% -> 50.26%
     *
     * -- a whole tile at the phone and the tablet, 5.81% and 9.06% of the frame, which moves her
     * from below the centre line to above it. (The review that caught this called it "a 51px change
     * in a 534px-tall frame". The change is the lift, 31px; 534 is the phone's view height and the
     * tablet's is 342; 51 is the gap between CAMERA_FOCUS_Y's -20 and +31 and is not a distance the
     * camera ever moves. The finding was right and the number was not, so the table above is
     * derived rather than remembered.)
     *
     * THAT PRICE BUYS EXACTLY ONE FRAME, because once the camera has moved the lift aligns nothing:
     * it is chosen for one camera position, and anywhere else it is an arbitrary offset. Walk her
     * south through the real follow, let the camera settle, and read the top edge's offset into its
     * row, at 375x812 and 768x1024 alike:
     *
     *     walked        37px  64px  100px  128px  181px  256px
     *     lift held      18    12     16     12      2     12
     *     lift released  19    13     17     13      3     13
     *
     * Off the row either way, at every distance. So the lift is dropped the first frame the camera
     * moves, and that timing is what makes dropping it free:
     *
     *   STANDING STILL the camera never moves, so it is never dropped, and the frame a visitor
     *   reads the title card over keeps its whole row. That is the frame the client photographed.
     *
     *   WALKING SOUTH the deadzone swallows it. She leaves the deadzone after 22px, the camera
     *   takes its first step, and dropping a 31px lift puts the target 9px INSIDE the deadzone, so
     *   the camera holds for another 29px of walking rather than reversing. Over 90 frames its
     *   per-frame travel is identical with and without the release: 0.00 to 2.00px, which is the
     *   walk's own rate.
     *
     *   WALKING NORTH the camera is already travelling the way the release pulls, and it travels
     *   faster for about a third of a second: 4.51px in a frame against the walk's 2.00, then 4.18,
     *   3.90, 3.65, 3.44, converged inside 1.5s exactly the lift (31px) further up the map, which
     *   is where it was always meant to be aiming.
     *
     *   WALKING SIDEWAYS does not move the camera's Y at all, so the row survives and nothing is
     *   handed back for nothing.
     *
     * AND NOT "SNAP ONLY THE POSITIONS THAT SHOW THE BAND", which is the cheaper answer this map
     * does not have. The band needs canopy in the row the edge cuts, and on map-forest every row
     * but the last carries canopy -- from 5% of columns on row 19 to 67% on row 2 -- while the top
     * edge can cut rows 0-25 at 375x812 and 0-30 at 1280x800. "Only where a canopy row is cut" is
     * "everywhere", which is rejected experiment 1 in camera.ts with arithmetic on top.
     */
    if ((cut || reframed) && !this.arrived) {
      const unlifted = { x: this.camera.x, y: this.camera.y - this.snapLift };
      const raw = cameraTopLeft(unlifted, view, world).y;
      const placed = snapCentreToRow(this.camera.y, this.snapLift, raw, world.height - view.height);
      this.camera = { x: this.camera.x, y: placed.centreY };
      this.snapLift = placed.lift;
    } else if (moved) {
      this.snapLift = 0;
    }
    const { x, y } = cameraTopLeft(this.camera, view, world);
    main.setScroll(x, y);
  }

  /**
   * How much of the canvas the world is drawn into: all of it on the walk, the framed shot at the
   * door.
   *
   * THE PAYOFF FRAME ONLY COMPOSED NEAR 1280. `doorFocus` asks for the facade's own centre and the
   * map cannot give it: the cottage stands 1,536-1,696px into a 1,920px world, with only 224px of
   * forest east of it, so `cameraTopLeft` clamped the shot against the map's right edge and the
   * building slid right as the camera widened -- the facade's centre at 51% of the frame at 1280,
   * 68% at 1920 and 76% at 2560, which is the difference between a composed shot and a cottage
   * falling off the side of the last frame of a marketing asset.
   *
   * So the shot is framed on the facade and the surplus is letterboxed. The width is the widest
   * rectangle that can be CENTRED on the camera's own target inside the world -- twice the nearer
   * edge -- capped at the canvas, which puts the facade's centre on the canvas's centre at every
   * viewport. Both axes, so the rule is the rule rather than a special case; the vertical never
   * binds on this map, because the door has the whole forest below it.
   *
   * MIN_VIEW is the floor for the same reason it is the floor in `stageFit`: a cottage placed hard
   * against the edge of some future map would otherwise reduce the payoff to a sliver. If that
   * floor ever binds, the shot is off-centre again -- and the guard in e2e/scene-second-pass.spec.ts
   * fails, which is the right answer, because the fix then belongs to the map and not to here.
   *
   * AND IT IS ONE RECTANGLE, NOT TWO NUMBERS. The two axes were clamped independently, and on this
   * map only the horizontal ever binds -- the door has 1,184px of forest it could be centred in
   * vertically and at most 800 of canvas -- so the height came back as the whole canvas however
   * narrow the width went. The shot's shape was therefore whatever the arithmetic left over:
   * measured at the door, 608x359 at 1280 (aspect 1.69 against the canvas's 1.73, near enough),
   * 608x499 at 1920 (1.22 against 1.89) and 608x679 at 2560 -- aspect 0.90, a PORTRAIT slot gouged
   * out of a landscape frame, with half the screen black down either side and a column of forest
   * above and below the cottage that the composition never asked for.
   *
   * So the width settles the shot and the height follows the canvas's own aspect: the payoff frame
   * is the canvas, scaled down until it fits inside the world around the door, which means the
   * surplus is an even border and the picture keeps the proportions every other frame of the game
   * is composed in. `Math.min` over both ratios, rather than deriving from the width alone, so the
   * vertical binds on a map where it has to -- the rule stays the rule rather than a special case.
   */
  private viewFor(
    centre: Vec,
    world: { width: number; height: number },
  ): { width: number; height: number } {
    const canvas = this.scale.gameSize;
    if (!this.arrived) return { width: canvas.width, height: canvas.height };
    const centred = (c: number, extent: number): number => Math.floor(2 * Math.min(c, extent - c));
    const width = Math.min(canvas.width, Math.max(MIN_VIEW.width, centred(centre.x, world.width)));
    const height = Math.min(
      canvas.height,
      Math.max(MIN_VIEW.height, centred(centre.y, world.height)),
    );
    const fit = Math.min(width / canvas.width, height / canvas.height);
    return {
      width: Math.round(canvas.width * fit),
      height: Math.round(canvas.height * fit),
    };
  }

  /** Where the camera wants to be: Purple on the walk, the door once she has reached it. */
  private focus(): Vec {
    return this.arrived ? this.doorFocus() : this.purpleFocus();
  }

  /**
   * The camera frames Purple's chest, not her feet, so the shot shows where she is going.
   *
   * Plus `snapLift`, which is under a tile and is what keeps the camera's top edge on a whole tile
   * row instead of part-way into a row of canopy. It belongs in the TARGET rather than being
   * applied to the camera afterwards, because the deadzone in `cameraFollow` is measured against
   * this value: a lift bigger than `CAMERA_DEADZONE.y` applied anywhere else is eased straight
   * back out. `syncCamera` carries the measurement and the rest of the argument.
   *
   * It is a term of this sum only while the camera is standing still. `syncCamera` releases it on
   * the first frame the camera's centre moves, because a lift chosen for one camera position
   * aligns no other -- and a lift left in for the whole run frames her eleven pixels below her own
   * feet at 375x812 and 768x1024, which is the opposite of what this method's first line says it
   * is for. The table of what that cost is in `syncCamera`.
   */
  private purpleFocus(): Vec {
    return { x: this.position.x, y: this.position.y + CAMERA_FOCUS_Y + this.snapLift };
  }

  /**
   * The arrival frame, derived from the building rather than from Purple, so the door is in shot
   * whatever row she walked in on.
   *
   * What has to be in it: the chimney, which sits one row ABOVE `prop-cottage` and carries the
   * smoke (see the note on it in tools/graybox/src/forest-map.ts); the facade with its door and
   * two windows; and the three rows of lane below, which is where the prints are. Centring on the
   * span of all three is what keeps the smoke off the top edge at 1280, where the camera is only
   * ten tiles tall and the building is six of them.
   */
  private doorFocus(): Vec {
    const top = this.facade.y - TILE;
    const bottom = this.facade.y + this.facade.height + TILE * LANE_ROWS;
    return { x: this.facade.x + this.facade.width / 2, y: (top + bottom) / 2 };
  }

  /** Where Purple is standing right now: the minimap's marker, and the specs. */
  get purplePosition(): Vec {
    return { ...this.position };
  }

  /** The minimap's picture of this map, or null before the scene has been created. */
  get sketch(): MapSketch | null {
    return this.sketched;
  }

  /**
   * "Keep looking" at the door (ui/DoorCheck.tsx): Purple back off the step to where she last stood
   * outside it, and half a tile further, the way she came -- so the very next frame does not walk
   * her straight back onto the trigger and ask the same question again.
   *
   * The way she came is the opposite of the way she faces, and the extra half tile goes through
   * `moveWithCollision`, so a step back into a fence is a step back as far as the fence and no
   * further. `lastOutside` is a place she actually stood, so it is walkable by construction.
   */
  stepBack(): void {
    const away = {
      up: { x: 0, y: 1 },
      down: { x: 0, y: -1 },
      left: { x: 1, y: 0 },
      right: { x: -1, y: 0 },
    }[this.facing];
    const from = { x: this.lastOutside.x, y: this.lastOutside.y };
    this.position = moveWithCollision(
      this.map.collision,
      from,
      away.x * (TILE / 2),
      away.y * (TILE / 2),
    );
    if (overlaps(this.position, this.cottage)) this.position = from;
    this.stopWalking();
    this.placePurple();
  }
}
