import Phaser from 'phaser';
import { ending } from '@otp/core';
import type { Phase } from '@otp/core';
import type { Store } from '../store';
import type { Bus } from '../bus';
import type { Input } from './input';
import {
  CAMERA_FOCUS_Y,
  INTERACT_RADIUS,
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
import type { Facing, Interactable, Vec } from './logic';
import { bystanderSpawns, findObject, npcSpawns, readForestMap } from './map';
import type { ForestMap, MapObject } from './map';

/**
 * One character frame, in world pixels: a tile wide and a tile and a half tall.
 *
 * In TILE terms, like everything else in `logic.ts`, so the move from 16px to 32px art moved this
 * with it. It was a hardcoded 16x24, which after the remaster stood every NPC half a sprite too
 * high in its tile and put the interact prompt through the middle of their heads.
 */
const NPC_SPRITE = { width: TILE, height: TILE * 1.5 };
/** The gap between the top of a character's head and the bottom of the prompt bubble. */
const PROMPT_GAP = TILE * (3 / 8);

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
 * Anyone Red can walk up to. `character` offers a skill and opens the real encounter;
 * `bystander` offers nothing and only says a line. They share the prompt and the proximity
 * test so that one person is highlighted at a time, and differ only in what interacting emits.
 */
interface Npc extends Interactable {
  kind: 'character' | 'bystander';
  sprite: Phaser.GameObjects.Sprite;
  prompt: Phaser.GameObjects.Sprite;
}

export class ForestScene extends Phaser.Scene {
  private readonly store: Store;
  private readonly bus: Bus;
  private readonly controls: Input;
  /** False while a DOM panel owns the screen, including ones that do not change the store phase. */
  private readonly hasInput: () => boolean;

  private map!: ForestMap;
  private red!: Phaser.GameObjects.Sprite;
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
  private promptBob = 0;
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
    phaserMap.createLayer('ground', tiles)?.setDepth(0);
    phaserMap.createLayer('decor-below', tiles)?.setDepth(1);
    // The canopy layer always draws over Red, so she walks behind tree tops.
    phaserMap.createLayer('decor-above', tiles)?.setDepth(10_000);

    this.createNpcs();

    const spawn = findObject(this.map, 'spawn-red');
    if (!spawn) throw new Error('Map has no "spawn-red" object');
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + TILE };
    this.red = this.add
      .sprite(this.position.x, this.position.y, 'red', 'red-idle-down-0')
      .setOrigin(0.5, 1);
    this.createAnimations();
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
    if (import.meta.env.DEV || import.meta.env['VITE_E2E'] === '1') {
      const w = window as unknown as { __otp?: Record<string, unknown> };
      if (w.__otp) {
        w.__otp['scene'] = this;
        w.__otp['isSolidAt'] = (x: number, y: number) => blocked(this.map.collision, x, y);
        w.__otp['mapObjects'] = this.map.objects;
      }
    }
    this.bus.emit('worldReady', undefined);
  }

  /** Puts Red back where she started, facing down, with every prompt cleared. */
  private resetToSpawn(): void {
    const spawn = findObject(this.map, 'spawn-red');
    if (!spawn) return;
    this.position = { x: spawn.x + TILE / 2, y: spawn.y + TILE };
    this.facing = 'down';
    this.stopWalking();
    this.red.setPosition(Math.round(this.position.x), Math.round(this.position.y));
    this.red.setDepth(this.red.y);
    for (const npc of this.npcs) npc.prompt.setVisible(false);
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
    for (const spawn of npcSpawns(this.map)) {
      const key = spawn.spawnName;
      if (!this.textures.exists(key)) throw new Error(`Missing NPC sprite "${key}"`);
      const sprite = this.add
        .sprite(spawn.x, spawn.y + NPC_SPRITE.height / 2, key, 0)
        .setOrigin(0.5, 1);
      sprite.setDepth(sprite.y);
      const prompt = this.add
        .sprite(spawn.x, sprite.y - NPC_SPRITE.height - PROMPT_GAP, 'fx-interact-prompt', 0)
        .setOrigin(0.5, 1)
        .setDepth(9000)
        .setVisible(false);
      this.npcs.push({ kind: 'character', id: spawn.id, x: spawn.x, y: sprite.y, sprite, prompt });
    }
    this.createBystanders();
  }

  private createBystanders(): void {
    for (const spawn of bystanderSpawns(this.map)) {
      const key = spawn.spawnName;
      if (!this.textures.exists(key)) throw new Error(`Missing bystander sprite "${key}"`);
      const sprite = this.add
        .sprite(spawn.x, spawn.y + NPC_SPRITE.height / 2, key, 0)
        .setOrigin(0.5, 1);
      sprite.setDepth(sprite.y);
      const prompt = this.add
        .sprite(spawn.x, sprite.y - NPC_SPRITE.height - PROMPT_GAP, 'fx-interact-prompt', 0)
        .setOrigin(0.5, 1)
        .setDepth(9000)
        .setVisible(false);
      this.npcs.push({ kind: 'bystander', id: spawn.id, x: spawn.x, y: sprite.y, sprite, prompt });
    }
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
      this.updatePrompts();
      if (input.interactPressed) this.interact();
      this.checkNotices();
      this.checkCottage();
    } else if (this.walking) {
      this.stopWalking();
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
    this.red.setPosition(Math.round(this.position.x), Math.round(this.position.y));
    this.red.setDepth(this.red.y);
    for (const npc of this.npcs) npc.prompt.setVisible(false);

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
    this.red.setPosition(Math.round(this.position.x), Math.round(this.position.y));
    this.red.setDepth(this.red.y);

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

  private updatePrompts(): void {
    const target = nearest(this.position, this.available(), INTERACT_RADIUS);
    this.promptBob += 1;
    for (const npc of this.npcs) {
      const active = npc === target;
      npc.prompt.setVisible(active);
      if (active) npc.prompt.setFrame(this.reducedMotion ? 0 : Math.floor(this.promptBob / 30) % 2);
    }
  }

  private interact(): void {
    const target = nearest(this.position, this.available(), INTERACT_RADIUS);
    if (!target) return;
    if (target.kind === 'bystander') this.bus.emit('greetBystander', { bystanderId: target.id });
    else this.bus.emit('interact', { characterId: target.id });
  }

  private checkNotices(): void {
    for (const notice of this.notices)
      if (overlaps(this.position, notice))
        this.bus.emit('reachedNotice', { noticeId: notice.name.slice('notice-'.length) });
  }

  private checkCottage(): void {
    if (!overlaps(this.position, this.cottage)) return;
    this.bus.emit('enteredCottage', undefined);
  }

  private syncCamera(deltaMs = 0): void {
    // The centre eases after Red and holds still while she is inside the deadzone; cameraTopLeft
    // still rounds, so the scroll stays on whole pixels and the tiles never shimmer.
    this.camera = cameraFollow(this.camera, this.focus(), deltaMs);
    // Read the live camera size: ui/stage.ts resizes it whenever the window changes.
    const { x, y } = cameraTopLeft(this.camera, this.scale.gameSize, {
      width: this.map.widthInPixels,
      height: this.map.heightInPixels,
    });
    this.cameras.main.setScroll(x, y);
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
