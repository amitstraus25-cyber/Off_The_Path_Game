// Generates the placeholder art with the FINAL file names from docs/ASSETS.md, so real art from the
// design team drops in by replacing files in apps/game/src/assets with no code change.
// Procedural pixel art, zero dependencies: see paint.ts for the raster and PNG encoder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './paint.ts';
import { paintTileset } from './tiles.ts';
import { generateForestMap } from './forest-map.ts';
import {
  ITEM_PAINTERS,
  PORTRAIT_PAINTERS,
  paintDust,
  paintInteractPrompt,
  paintNpcSheet,
  paintPawprints,
  paintRedSheet,
  RED_H,
  RED_W,
} from './sprites.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/game/src/assets');
mkdirSync(OUT, { recursive: true });
const write = (name: string, body: Buffer | string): void => writeFileSync(join(OUT, name), body);

write('tileset-forest.png', paintTileset().png());

const map = generateForestMap();
write('map-forest.json', map.json);

const red = paintRedSheet();
write('red.png', red.sheet.png());
write(
  'red.json',
  JSON.stringify({
    frames: red.frames,
    meta: {
      image: 'red.png',
      format: 'RGBA8888',
      size: { w: RED_W * 4, h: RED_H * 4 },
      scale: '1',
    },
  }),
);

const NPCS = ['npc-rabbit', 'npc-owl', 'npc-lantern-keeper', 'npc-wolf'];
for (const name of NPCS) write(`${name}.png`, paintNpcSheet(name).png());

for (const [name, painter] of Object.entries(PORTRAIT_PAINTERS)) {
  const img = new Img(32, 32);
  painter(img);
  write(`${name}.png`, img.png());
}

for (const [name, painter] of Object.entries(ITEM_PAINTERS)) {
  const img = new Img(32, 32);
  painter(img);
  write(`${name}.png`, img.png());
}

write('fx-dust.png', paintDust().png());
write('fx-interact-prompt.png', paintInteractPrompt().png());
write('fx-pawprints.png', paintPawprints().png());

// The loader checks every entry and fails the boot if one is missing.
write(
  'manifest.json',
  JSON.stringify(
    {
      placeholder: true,
      tilesets: ['tileset-forest.png'],
      maps: ['map-forest.json'],
      atlases: [{ image: 'red.png', data: 'red.json' }],
      spritesheets: [
        ...NPCS.map((key) => ({ key, frameWidth: RED_W, frameHeight: RED_H })),
        { key: 'fx-dust', frameWidth: 8, frameHeight: 8 },
        { key: 'fx-interact-prompt', frameWidth: 16, frameHeight: 16 },
        { key: 'fx-pawprints', frameWidth: 16, frameHeight: 16 },
      ],
      images: [...Object.keys(PORTRAIT_PAINTERS), ...Object.keys(ITEM_PAINTERS)].map(
        (k) => `${k}.png`,
      ),
    },
    null,
    2,
  ),
);

console.log(`art written to ${OUT}`);
