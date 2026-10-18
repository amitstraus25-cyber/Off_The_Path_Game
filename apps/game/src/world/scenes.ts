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
    /*
     * The Cyera symbol, from the official symbol-only file in the brand team's Logo Package, used
     * as-is. It is NOT generated art and does not come from tools/graybox, so it is served from
     * /brand alongside the wordmark rather than from the assets manifest.
     *
     * `load.image`, NOT `load.svg`. Phaser's SVG loader rasterises through a `blob:` URL, and the
     * CSP in vercel.json is `img-src 'self' data:` with no blob allowance -- main.ts already sets
     * `imageLoadType: 'HTMLImageElement'` for exactly this reason. The smoke test caught it: a
     * blob showed up in the "no third-party requests" assertion. Relaxing a strict CSP on a data
     * security company's own research asset, to place a decoration, is the wrong trade.
     *
     * So it loads as an ordinary same-origin image at its natural size and is scaled down where
     * it is placed. The brand rules allow the official file scaled uniformly and forbid redrawing
     * it, which is what this is.
     */
    this.load.image('cyera-symbol', '/brand/cyera-symbol-black.svg');
    this.load.on('loaderror', (f: Phaser.Loader.File) => {
      throw new Error(`Asset failed to load: ${f.key}`);
    });
  }
  create(): void {
    this.scene.start('Forest');
  }
}

export { ForestScene } from './forest-scene';
