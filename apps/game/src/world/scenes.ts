import Phaser from 'phaser';
import { assetUrl, keyOf, type Manifest } from './assets';
import type { Bus } from '../bus';

export class BootScene extends Phaser.Scene {
  private readonly manifest: Manifest;
  private readonly bus: Bus;
  /** The keys that would not load THIS time round: emptied at the top of every preload. */
  private readonly failed = new Set<string>();
  constructor(manifest: Manifest, bus: Bus) {
    super('Boot');
    this.manifest = manifest;
    this.bus = bus;
  }
  preload(): void {
    const m = this.manifest;
    this.failed.clear();
    for (const t of m.tilesets) this.load.image(keyOf(t), assetUrl(t));
    for (const map of m.maps) this.load.tilemapTiledJSON(keyOf(map), assetUrl(map));
    for (const a of m.atlases) this.load.atlas(keyOf(a.image), assetUrl(a.image), assetUrl(a.data));
    for (const s of m.spritesheets)
      this.load.spritesheet(s.key, assetUrl(`${s.key}.png`), {
        frameWidth: s.frameWidth,
        frameHeight: s.frameHeight,
      });
    for (const i of m.images) this.load.image(keyOf(i), assetUrl(i));
    /*
     * RECORD, DON'T THROW. This handler used to be `throw new Error('Asset failed to load: ...')`,
     * and a throw is the one thing an emitter callback cannot report: Phaser's loader calls it
     * synchronously from inside its own event dispatch, so there is no promise to catch it and no
     * caller to catch it, and it surfaced as an uncaught error on `window` that nothing listened
     * for. Blocking each class of asset in turn showed what that meant for a visitor -- a tileset or
     * a map that 404ed left the title up, Begin enabled and the world never ready; Purple's atlas
     * that 404ed let the scene become READY with no Purple in it; an NPC sheet that 404ed threw a
     * second time, from the forest scene's create(). Nothing on the page ever said anything.
     *
     * So the handler only collects, and `create()` below -- which Phaser calls once every file has
     * either loaded or failed -- decides. The set is a Set because an atlas is two files under one
     * key and a failing pair would otherwise be reported twice.
     */
    this.load.on('loaderror', (f: Phaser.Loader.File) => {
      this.failed.add(f.key);
    });
  }
  create(): void {
    if (this.failed.size > 0) {
      // Do NOT start the forest: it would build itself from whatever did arrive, and a world with
      // the tileset or the player missing is exactly the healthy-looking, empty one this prevents.
      this.bus.emit('loadFailed', { keys: [...this.failed] });
      return;
    }
    this.scene.start('Forest');
  }
  /**
   * Try the whole load again. Whatever did arrive is already in Phaser's cache and is skipped; only
   * the failed files are requested a second time.
   */
  retry(): void {
    this.scene.restart();
  }
}

export { ForestScene } from './forest-scene';
