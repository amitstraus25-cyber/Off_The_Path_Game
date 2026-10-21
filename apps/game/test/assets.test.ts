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
import atlas from '../src/assets/purple.json';
import gids from '../src/assets/tileset-forest.gids.json';
import { TILE } from '../src/world/logic';
import type { Facing } from '../src/world/logic';

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

  it("the atlas frames all fit inside Purple's sheet", () => {
    const sheet = pngSize('purple.png');
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

  /*
   * Against the game's own TILE, not against a column count the sheet's own width supplies.
   * Dividing the width by a hard-coded twelve infers the tile size from the file being tested and
   * then only asks the file to agree with itself, so a tileset regenerated at 16px passes: it is
   * twelve 16px columns, and every row divides. The gids in map-forest.json would then address
   * the wrong art. world/map.ts is the only other place a TILE drift is caught, and it is caught
   * there at boot; this catches it in the suite.
   */
  it('the tileset is a whole number of the tiles the game draws', () => {
    const { width, height } = pngSize('tileset-forest.png');
    expect(width % TILE, `tileset is ${width}px wide, not a multiple of the ${TILE}px tile`).toBe(
      0,
    );
    expect(height % TILE, `tileset is ${height}px tall, not a multiple of the ${TILE}px tile`).toBe(
      0,
    );
    /*
     * And the grid it makes at that tile holds every gid the committed map addresses. A gid is an
     * index into this sheet read row by row, so a sheet that loses a row leaves the highest gids
     * pointing past the end of the image, which Phaser renders as nothing rather than as an error.
     */
    const cells = (width / TILE) * (height / TILE);
    const highest = Math.max(...Object.values(gids as Record<string, number>));
    expect(
      cells,
      `the sheet holds ${cells} tiles but the map addresses gid ${highest}`,
    ).toBeGreaterThanOrEqual(highest);
  });

  /*
   * The frame names are a contract across the workspace boundary and were spelled out by hand on
   * both sides of it: graybox's sprites.ts writes `purple-idle-<facing>-0` and `purple-walk-<facing>-N`,
   * and forest-scene.ts asks for exactly those strings at setFrame and in its walk animations. A
   * rename on either side is a silent missing frame in the running game and reddens nothing.
   *
   * `satisfies Record<Facing, 0>` is what makes this exhaustive: adding a fifth direction to the
   * Facing union fails to compile here until its frames are named.
   */
  const FACINGS = Object.keys({ down: 0, left: 0, right: 0, up: 0 } satisfies Record<Facing, 0>);

  it.each(FACINGS)("Purple's atlas names every frame the scene asks for, facing %s", (facing) => {
    const names = Object.keys(atlas.frames);
    expect(names).toContain(`purple-idle-${facing}-0`);
    for (const phase of [0, 1, 2]) expect(names).toContain(`purple-walk-${facing}-${phase}`);
  });
});
