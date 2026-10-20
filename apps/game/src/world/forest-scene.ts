import Phaser from 'phaser';
import { ending } from '@otp/core';
import type { Phase } from '@otp/core';
import type { Store } from '../store';
import type { Bus } from '../bus';
import type { Input } from './input';
import {
  CAMERA_FOCUS_Y,
  RED_FEET_BELOW_SPAWN,
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
} from './logic';
import type { Facing, Interactable, Rect, Vec } from './logic';
import { bystanderSpawns, findObject, npcSpawns, readForestMap } from './map';
import type { ForestMap, MapObject } from './map';

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
 * and stayed there, so the forest held perfectly still while Red walked through it and half the
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
  holdMs: 3000,
  /** Added per character, wrapped by `spreadMs`, so no two share a period. */
  stepMs: 250,
  /** How far the hold is allowed to be spread, so the slowest blink still lands inside 3-5s. */
  spreadMs: 2000,
  /** A blink, not a doze. */
  blinkMs: 120,
  /** How far apart the cast start, so they are not in step before their periods separate them. */
  startStepMs: 430,
} as const;

/**
 * The pool of shade a figure stands in.
 *
 * NOBODY IN THE CAST TOUCHED THE GROUND. Measured as green pixels at least 25 luma below the lawn
 * around them: bush 518, rock 104, Red 24, and the rabbit, the owl and the Lantern Keeper 0 each.
 * Everything painted into the tileset plants on the lawn and everything painted into a character
 * sheet floats over it, which on the plank bridge left Red's contact line at dL -14.5 against a
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

/**
 * The phases that happen at the cottage. From the first arrival beat to the end of the run the
 * camera belongs to the door, not to Red, so Results does not pan the forest back behind itself.
 */
const AT_THE_COTTAGE: readonly Phase[] = ['cottage', 'results', 'leaderboard'];

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
 * controls in `ui/touch-controls.ts`, which stop Red when she arrives -- so it is one channel with
 * two subscribers either way. The same name is written in both of those files; the end-to-end
 * guard in `e2e/world-reach.spec.ts` is what keeps the three spellings honest.
 *
 * The payload is the npc's ID and nothing else. Not the name, deliberately: the UI already holds
 * `content` and looks the name up itself, so an event dispatched by anything other than this scene
 * cannot put words of its own into a live region.
 */
const WITHIN_REACH = 'otp:within-reach';

/**
 * Anyone Red can walk up to. `character` offers a skill and opens the real encounter;
 * `bystander` offers nothing and only says a line. They share the prompt and the proximity
 * test so that one person is highlighted at a time, and differ only in what interacting emits.
 */
interface Npc extends Interactable {
  kind: 'character' | 'bystander';
  sprite: Phaser.GameObjects.Sprite;
  prompt: Phaser.GameObjects.Sprite;
  /** The pool of shade under their feet, tinted from the tile they are standing on. */
  shadow: Phaser.GameObjects.Ellipse;
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
  const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return h;
    ctx.drawImage(frame.source.image as CanvasImageSource, cutX, cutY, w, h, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 0) return h - y;
    return h;
  } catch {
    return h;
  }
}

/**
 * How wide the part of a figure that touches the ground is, in pixels, off the same frame.
 *
 * Measured for the same reason the headroom above is: a table of eight numbers over here is a
 * second set of figures nothing keeps honest, and the sheets are regenerated by a tool the game
 * must not import. On the shipped art this reads 15 for Red, 20 for the rabbit, 21 for the owl,
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
  private readonly store: Store;
  private readonly bus: Bus;
  private readonly controls: Input;
  /** False while a DOM panel owns the screen, including ones that do not change the store phase. */
  private readonly hasInput: () => boolean;

  private map!: ForestMap;
  private red!: Phaser.GameObjects.Sprite;
  /** Red's own pool of shade. Moves and re-tints with her, because she is the one who walks. */
  private redShadow!: Phaser.GameObjects.Ellipse;
  /** The tile layer the figures stand on, which is what their shadows take their colour from. */
  private ground: Phaser.Tilemaps.TilemapLayer | null = null;
  /** Mean colour per tile index, read off the loaded tileset once at boot. */
  private inks: Map<number, number> = new Map();
  private position: Vec = { x: 0, y: 0 };
  private facing: Facing = 'down';
  private walking = false;
  private npcs: Npc[] = [];
  private cottage!: MapObject;
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
   * Which triggers Red is standing on, against the run they last fired for.
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
  /** The camera's own centre, which lags Red rather than being pinned to her. */
  private camera: Vec = { x: 0, y: 0 };
  /** A small pool of dust puffs, reused so walking never allocates. */
  private dust: Phaser.GameObjects.Sprite[] = [];
  private dustNext = 0;
  /** Distance walked since the last puff, so dust is tied to stride, not to frame rate. */
  private sinceStep = 0;
  /** Reused each frame so the update loop allocates nothing. */
  private readonly step: Vec = { x: 0, y: 0 };

  constructor(store: Store, bus: Bus, controls: Input, hasInput: () => boolean = () => true) {
    super('Forest');
    this.store = store;
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

    const phaserMap = this.make.tilemap({ key: 'map-forest' });
    const tiles = phaserMap.addTilesetImage('tileset-forest', 'tileset-forest');
    if (!tiles) throw new Error('Tileset "tileset-forest" is missing from the map');
    this.ground = phaserMap.createLayer('ground', tiles)?.setDepth(0) ?? null;
    phaserMap.createLayer('decor-below', tiles)?.setDepth(1);
    // The canopy layer always draws over Red, so she walks behind tree tops.
    phaserMap.createLayer('decor-above', tiles)?.setDepth(10_000);
    // Read before anybody is placed: every figure asks for the colour of their own tile on arrival.
    this.inks = tileInks(tiles);

    this.createNpcs();

    const spawn = findObject(this.map, 'spawn-red');
    if (!spawn) throw new Error('Map has no "spawn-red" object');
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + RED_FEET_BELOW_SPAWN };
    this.red = this.add
      .sprite(this.position.x, this.position.y, 'red', 'red-idle-down-0')
      .setOrigin(0.5, 1);
    /*
     * Her depth comes with her, not with her first step.
     *
     * Everywhere else that moves Red sets `depth = y` -- `resetToSpawn`, `stageArrival`, `move`
     * -- and creation did not, so she was born at depth 0 and stayed there until the player
     * pressed a key. At depth 0 she sorts under `decor-below` (depth 1), under the wolf's prints
     * (2) and under every character in the cast, whose depth is their own fixed y and therefore
     * always wins. A player who looks at the forest before walking is looking at the one frame
     * where the heroine is behind the scenery, and that frame is the opening shot.
     */
    // Her pool before her first placing, because `placeRed` seats the two of them together.
    this.redShadow = this.addShadow(footprintOf(this.textures.getFrame('red', 'red-idle-down-0')));
    this.placeRed();
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
    // Objects named `notice-<id>` hand their id straight to the content's notices.
    this.notices = this.map.objects.filter((o) => o.name.startsWith('notice-'));

    // A replay resets the store, but Red is a world object and has to be sent home as well.
    this.bus.on('restartRun', () => this.resetToSpawn());

    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.camera = this.focus();
    this.syncCamera();
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
   * Red on screen where `this.position` says she is, sorted by her own feet.
   *
   * The pair was written out four times and omitted once, which is how she shipped at depth 0.
   */
  private placeRed(): void {
    this.red.setPosition(Math.round(this.position.x), Math.round(this.position.y));
    this.red.setDepth(this.red.y);
    this.seatShadow(this.redShadow, this.position.x, this.position.y);
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
   * character standing one pixel uphill of Red must still draw over her shadow, and at a whole
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

  /** Puts Red back where she started, facing down, with every prompt cleared. */
  private resetToSpawn(): void {
    const spawn = findObject(this.map, 'spawn-red');
    if (!spawn) return;
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + RED_FEET_BELOW_SPAWN };
    this.facing = 'down';
    this.stopWalking();
    /*
     * EVERY SECOND RUN OPENED ON THE HEROINE'S BACK.
     *
     * `stopWalking` is the only thing that puts an idle frame on Red, and it returns early on
     * `!this.walking` -- rightly, because `update` calls it on every non-exploring frame and
     * re-setting the frame sixty times a second is seven hundred wasted Phaser calls a run. But
     * `stageArrival` has ALREADY stopped her by the time a replay gets here, so the early return
     * fires and the facing set a line above never reaches the sprite: she walks out of the cottage
     * shot still wearing `red-idle-up-0` while `this.facing` says 'down', and the first frame of
     * the second run is the back of her head. It healed on the player's first keypress, which is
     * exactly late enough for the opening shot to be wrong and nothing else.
     *
     * So the frame is set here, the same pair `stageArrival` sets for the same reason -- the guard
     * inside `stopWalking` stays where it is and keeps paying for itself on every idle frame.
     */
    this.red.stop();
    this.red.setFrame(`red-idle-${this.facing}-0`);
    this.placeRed();
    this.clearReach();
    // A replay starts outside every trigger, whatever Red was standing on when the run ended.
    this.triggered.clear();
    // The last run's trail is the last run's. A replay that kept it would promise an ending the
    // new run has not earned, in the one place the game puts a fact on the ground.
    this.arrived = false;
    for (const paw of this.paws) paw.setVisible(false);
    // Snap, not ease: a replay should not pan across the forest from wherever the last run ended.
    this.camera = this.redFocus();
    this.syncCamera();
  }

  /**
   * The prints on the lane, laid down hidden at boot. `fx-pawprints` has been drawn, three-framed
   * and shipped to every player since the remaster and placed nowhere (docs/UX_REVIEW.md 3); it is
   * the ending in one detail, so it belongs on the path outside the door and nowhere else.
   *
   * Depth 2 puts them above the ground and the decor painted into it and below every character,
   * so Red walks over her own doorstep rather than behind it.
   */
  private createPaws(): void {
    this.paws = PAW_TRAIL.map(({ frame, dx, dy }) =>
      this.add
        .sprite(this.cottage.x + dx, this.cottage.y + dy, 'fx-pawprints', frame)
        .setDepth(2)
        .setVisible(false),
    );
  }

  private createNpcs(): void {
    for (const spawn of npcSpawns(this.map))
      this.npcs.push(this.createCharacter('character', spawn));
    for (const spawn of bystanderSpawns(this.map))
      this.npcs.push(this.createCharacter('bystander', spawn));
  }

  /**
   * One character on their tile, with their bubble over their head.
   *
   * `npcSpawns`/`bystanderSpawns` hand back the CENTRE of the spawn tile, and the sprite's origin
   * is its feet, so the feet belong half a tile lower -- on the tile's bottom edge, which is where
   * a character standing on a tile stands. This used to add half the FRAME height (24), so every
   * one of the eight stood 8px into the tile below their own: past the verge of the path they are
   * meant to be on, and 10px below Red's own contact line on the same row of ground.
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
    return { kind, id: spawn.id, x: spawn.x, y: sprite.y, sprite, prompt, shadow };
  }

  private createAnimations(): void {
    for (const facing of ['down', 'left', 'right', 'up'] as const)
      if (!this.anims.exists(`red-walk-${facing}`))
        this.anims.create({
          key: `red-walk-${facing}`,
          // contact, pass, contact, pass. Without the second pass frame the three-frame loop
          // snapped back from the far contact to the near one and the legs jumped.
          frames: [0, 1, 2, 1].map((i) => ({ key: 'red', frame: `red-walk-${facing}-${i}` })),
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

    // One idle per character, each with a hold of its own. See IDLE.
    this.npcs.forEach((npc, i) => {
      const key = npc.sprite.texture.key;
      if (this.anims.exists(this.idleKey(npc))) return;
      this.anims.create({
        key: this.idleKey(npc),
        frames: [
          { key, frame: 0, duration: IDLE.holdMs + ((i * IDLE.stepMs) % IDLE.spreadMs) },
          { key, frame: 1, duration: IDLE.blinkMs },
        ],
        repeat: -1,
      });
    });
  }

  /** The idle animation belonging to one character, named after the sheet it plays from. */
  private idleKey(npc: Npc): string {
    return `${npc.sprite.texture.key}-idle`;
  }

  /**
   * Sets the cast breathing, staggered so they are not in step on the first blink either.
   *
   * Silent under prefers-reduced-motion, exactly as Red's dust is: the sprites stay on the
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

  /** Kicks a puff up at Red's heel. Silent under prefers-reduced-motion. */
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
    const state = this.store.getState();
    const exploring = state.phase === 'explore' && this.hasInput();
    const input = this.controls.read();

    if (!this.arrived && AT_THE_COTTAGE.includes(state.phase)) this.stageArrival();

    if (exploring) {
      this.move(input.x, input.y, deltaMs);
      // One proximity test per frame, shared by the bubble, the announcement and the A button,
      // rather than three scans of the cast that can disagree with each other by a pixel.
      const target = this.updatePrompts();
      this.announceWithinReach(target);
      if (input.interactPressed) this.interact(target);
      this.checkNotices(state);
      this.checkCottage(state);
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
       * non-exploring frame, and without it Red's idle frame would be re-set sixty times a second.
       */
      this.stopWalking();
      this.clearReach();
    }
    this.syncCamera(deltaMs);
  }

  /**
   * The arrival, staged once on the beat that says you reached the door.
   *
   * Before this, "You reach the door. The lamp is lit." played over whatever Red happened to be
   * standing on -- open forest, with a market stall and a rabbit in shot and no cottage anywhere
   * (docs/UX_REVIEW.md 3). It is the payoff frame of the whole asset and the approved board frames
   * it one way: the facade filling the shot, the door centred, Red small on the step with her back
   * to us, the prints on the path beside her (reference/mocks/gameplay-concepts.png, panel 04).
   *
   * So this is a CUT, not a pan: Red to the step, the camera to the door, the trail shown or not,
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
    this.red.stop();
    this.red.setFrame(`red-idle-${this.facing}-0`);
    this.placeRed();
    // Nobody is within reach on the doorstep, whoever she was standing next to a frame ago.
    this.clearReach();

    /*
     * The trail is a claim about what happened, so it is content's to make and not this file's:
     * `arrivePawEndings` names the endings on which something came up this path ahead of you. On
     * the other endings the approach lines say the earth by the step is unmarked, and it must be.
     */
    const earned = (this.store.content.strings['arrivePawEndings'] ?? '')
      .split('|')
      .includes(ending(this.store.getState(), this.store.content).id);
    for (const paw of this.paws) paw.setVisible(earned);

    this.camera = this.doorFocus();
    this.syncCamera();
  }

  private move(ix: number, iy: number, deltaMs: number): void {
    const direction = movementVector({ x: ix, y: iy });
    const distance = (WALK_SPEED * deltaMs) / 1000;
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
      this.red.play(`red-walk-${this.facing}`, true);
    } else if (this.red.anims.currentAnim?.key !== `red-walk-${this.facing}`) {
      this.red.play(`red-walk-${this.facing}`, true);
    }
    this.placeRed();

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
    this.red.stop();
    this.red.setFrame(`red-idle-${this.facing}-0`);
  }

  /**
   * Who will still talk. A character whose skill has a verdict is done; a bystander never is,
   * because they are scenery and repeating themselves is in character.
   */
  private available(): Npc[] {
    const { verdicts } = this.store.getState();
    const { content } = this.store;
    return this.npcs.filter((npc) => {
      if (npc.kind === 'bystander') return true;
      const character = content.characters.find((c) => c.id === npc.id);
      return character !== undefined && verdicts[character.skillId] === undefined;
    });
  }

  /** Puts the bubble over whoever is in range, and hands that person back to the caller. */
  private updatePrompts(): Npc | null {
    const target = nearest(this.position, this.available(), INTERACT_RADIUS);
    for (const npc of this.npcs) {
      if (npc === target) this.showPrompt(npc);
      else this.hidePrompt(npc);
    }
    return target;
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
   * Fires `emit` when Red steps onto `rect`, and again only if the run has moved on under her feet.
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

  private syncCamera(deltaMs = 0): void {
    // The centre eases after Red and holds still while she is inside the deadzone; cameraTopLeft
    // still rounds, so the scroll stays on whole pixels and the tiles never shimmer.
    this.camera = cameraFollow(this.camera, this.focus(), deltaMs);
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
    if (main.x !== vx || main.y !== vy || main.width !== view.width || main.height !== view.height)
      main.setViewport(vx, vy, view.width, view.height);
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

  /** Where the camera wants to be: Red on the walk, the door once she has reached it. */
  private focus(): Vec {
    return this.arrived ? this.doorFocus() : this.redFocus();
  }

  /** The camera frames Red's chest, not her feet, so the shot shows where she is going. */
  private redFocus(): Vec {
    return { x: this.position.x, y: this.position.y + CAMERA_FOCUS_Y };
  }

  /**
   * The arrival frame, derived from the building rather than from Red, so the door is in shot
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

  /** Test-only: where Red is standing right now. */
  get redPosition(): Vec {
    return { ...this.position };
  }
}
