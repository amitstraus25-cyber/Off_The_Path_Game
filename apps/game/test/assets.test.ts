/*
 * Guards the two contracts the 32px remaster rests on, neither of which anything checked before.
 *
 * The loader only verifies that each file named in the manifest exists, so a manifest left at the
 * old 16x24 against a 32x48 sheet loads silently and renders quarter-sprites with no error
 * anywhere. That is exactly the failure a rescale produces, and it is invisible until someone
 * looks at the running game.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../src/assets/manifest.json';
import atlas from '../src/assets/red.json';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '../src/assets');

/** Reads width and height straight out of the PNG's IHDR, which is always the first chunk. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(join(ASSETS, file));
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(png)) throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the manifest describes the files that are actually on disk', () => {
  it.each(manifest.spritesheets)(
    'spritesheet $key divides into whole $frameWidth x $frameHeight frames',
    ({ key, frameWidth, frameHeight }) => {
      const { width, height } = pngSize(`${key}.png`);
      /*
       * Every sheet the generator writes is a single row of frames, so the sheet's height IS the
       * frame height. Checking only that the dimensions divide evenly is not enough to catch the
       * bug this test exists for: a 64x48 sheet left at the old 16x24 divides perfectly and still
       * renders quarter-sprites.
       */
      expect(
        height,
        `${key}.png is ${height}px tall but the manifest says frames are ${frameHeight}px`,
      ).toBe(frameHeight);
      expect(
        width % frameWidth,
        `${key}.png is ${width}px wide, not a whole number of ${frameWidth}px frames`,
      ).toBe(0);
      expect(width / frameWidth).toBeGreaterThanOrEqual(1);
    },
  );

  it('every image listed in the manifest exists and is square', () => {
    for (const image of manifest.images) {
      const { width, height } = pngSize(image);
      expect(width, `${image} is not square`).toBe(height);
    }
  });

  it("the atlas frames all fit inside Red's sheet", () => {
    const sheet = pngSize('red.png');
    const frames = Object.values(
      atlas.frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>,
    );
    expect(frames.length).toBeGreaterThan(0);
    for (const { frame } of frames) {
      expect(frame.x + frame.w, 'a frame runs off the right of the sheet').toBeLessThanOrEqual(
        sheet.width,
      );
      expect(frame.y + frame.h, 'a frame runs off the bottom of the sheet').toBeLessThanOrEqual(
        sheet.height,
      );
    }
  });

  it('the tileset is a whole number of tiles, twelve to a row', () => {
    const { width, height } = pngSize('tileset-forest.png');
    const tile = width / 12;
    expect(Number.isInteger(tile), `tileset is ${width}px wide, not divisible by 12`).toBe(true);
    expect(height % tile, `tileset is ${height}px tall, not a multiple of the ${tile}px tile`).toBe(
      0,
    );
  });
});
