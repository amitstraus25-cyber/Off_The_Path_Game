import Phaser from 'phaser';
import { assetUrl, keyOf, type Manifest } from './assets';

export class BootScene extends Phaser.Scene {
  private readonly manifest: Manifest;
  constructor(manifest: Manifest) {
    super('Boot');
    this.manifest = manifest;
  }
  preload(): void {
    const m = this.manifest;
    for (const t of m.tilesets) this.load.image(keyOf(t), assetUrl(t));
    for (const map of m.maps) this.load.tilemapTiledJSON(keyOf(map), assetUrl(map));
    for (const a of m.atlases) this.load.atlas(keyOf(a.image), assetUrl(a.image), assetUrl(a.data));
    for (const s of m.spritesheets)
      this.load.spritesheet(s.key, assetUrl(`${s.key}.png`), {
        frameWidth: s.frameWidth,
        frameHeight: s.frameHeight,
      });
    for (const i of m.images) this.load.image(keyOf(i), assetUrl(i));
    this.load.on('loaderror', (f: Phaser.Loader.File) => {
      throw new Error(`Asset failed to load: ${f.key}`);
    });
  }
  create(): void {
    this.scene.start('Forest');
  }
}

export { ForestScene } from './forest-scene';
