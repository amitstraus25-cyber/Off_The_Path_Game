import Phaser from 'phaser';
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
import { findObject, npcSpawns, readForestMap } from './map';
import type { ForestMap, MapObject } from './map';

const NPC_SPRITE = { width: 16, height: 24 };

interface Npc extends Interactable {
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
    // Snap, not ease: a replay should not pan across the forest from wherever the last run ended.
    this.camera = this.focus();
    this.syncCamera();
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
        .sprite(spawn.x, sprite.y - NPC_SPRITE.height - 6, 'fx-interact-prompt', 0)
        .setOrigin(0.5, 1)
        .setDepth(9000)
        .setVisible(false);
      this.npcs.push({ id: spawn.id, x: spawn.x, y: sprite.y, sprite, prompt });
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

  /** Characters whose skill already has a verdict are done talking. */
  private available(): Npc[] {
    const { verdicts } = this.store.getState();
    const { content } = this.store;
    return this.npcs.filter((npc) => {
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
    if (target) this.bus.emit('interact', { characterId: target.id });
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

  /** The camera frames Red's chest, not her feet, so the shot shows where she is going. */
  private focus(): Vec {
    return { x: this.position.x, y: this.position.y + CAMERA_FOCUS_Y };
  }

  /** Test-only: where Red is standing right now. */
  get redPosition(): Vec {
    return { ...this.position };
  }
}
