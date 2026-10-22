// Generates the placeholder art with the FINAL file names from docs/ASSETS.md, so real art from the
// design team drops in by replacing files in apps/game/src/assets with no code change.
// Procedural pixel art, zero dependencies: see paint.ts for the raster and PNG encoder.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './paint.ts';
import { TILE_NAMES, paintTileset } from './tiles.ts';
import { generateForestMap } from './forest-map.ts';
import {
  FX_SHEETS,
  FX_SIZES,
  ITEM_PAINTERS,
  LIFE_KEYS,
  NPC_PAINTERS,
  PORTRAIT_PAINTERS,
  PORTRAIT_SIZE,
  paintFxSheet,
  paintHopSheet,
  paintIdleSheet,
  paintNpcSheet,
  paintPurpleSheet,
  PURPLE_H,
  PURPLE_W,
} from './sprites.ts';

/*
 * `--out <dir>` writes the whole set somewhere else, so a painter can regenerate into a scratch
 * directory and `cmp` it against the committed assets before the one regeneration that lands.
 */
const outAt = process.argv.indexOf('--out');
const OUT =
  outAt >= 0 && process.argv[outAt + 1]
    ? process.argv[outAt + 1]!
    : join(dirname(fileURLToPath(import.meta.url)), '../../../apps/game/src/assets');
mkdirSync(OUT, { recursive: true });
const write = (name: string, body: Buffer | string): void => writeFileSync(join(OUT, name), body);

write('tileset-forest.png', paintTileset().png());

/*
 * A name -> gid map for the tileset. The game does not need it, but it makes the map
 * self-describing: without it nothing downstream can tell sand from grass, which is exactly the
 * distinction a misaligned bridge shows up in.
 */
write(
  'tileset-forest.gids.json',
  JSON.stringify(Object.fromEntries(TILE_NAMES.map((name, i) => [name, i + 1])), null, 2),
);

const map = generateForestMap();
write('map-forest.json', map.json);

const purple = paintPurpleSheet();
write('purple.png', purple.sheet.png());
write(
  'purple.json',
  JSON.stringify({
    frames: purple.frames,
    meta: {
      image: 'purple.png',
      format: 'RGBA8888',
      size: { w: PURPLE_W * 4, h: PURPLE_H * 4 },
      scale: '1',
    },
  }),
);

// The wolf has no painter in the map because he is never spawned there; he appears at the cottage.
const NPCS = ['npc-rabbit', 'npc-owl', 'npc-lantern-keeper', 'npc-wolf'];
const BYSTANDERS = Object.keys(NPC_PAINTERS).filter((name) => name.startsWith('bystander-'));
for (const name of [...NPCS, ...BYSTANDERS]) write(`${name}.png`, paintNpcSheet(name).png());

// Portraits and items are 64x64 since the remaster (docs/PIXEL_STANDARD.md section 1). They are
// drawn in the DOM at their own size rather than through the camera, so nothing upscales them.
for (const [name, painter] of Object.entries({ ...PORTRAIT_PAINTERS, ...ITEM_PAINTERS })) {
  const img = new Img(PORTRAIT_SIZE, PORTRAIT_SIZE);
  painter(img);
  write(`${name}.png`, img.png());
}

for (const key of Object.keys(FX_SHEETS)) write(`${key}.png`, paintFxSheet(key).png());

// Character life: an idle loop and a hop per spawned character, at the static sprite's frame size.
for (const key of LIFE_KEYS) {
  write(`${key}-idle.png`, paintIdleSheet(key).png());
  write(`${key}-hop.png`, paintHopSheet(key).png());
}

// The loader checks every entry and fails the boot if one is missing.
write(
  'manifest.json',
  JSON.stringify(
    {
      placeholder: true,
      tilesets: ['tileset-forest.png'],
      maps: ['map-forest.json'],
      atlases: [{ image: 'purple.png', data: 'purple.json' }],
      spritesheets: [
        ...[...NPCS, ...BYSTANDERS].map((key) => ({
          key,
          frameWidth: PURPLE_W,
          frameHeight: PURPLE_H,
        })),
        ...Object.entries(FX_SIZES).map(([key, size]) => ({
          key,
          frameWidth: size,
          frameHeight: size,
        })),
        ...LIFE_KEYS.flatMap((key) =>
          ['idle', 'hop'].map((action) => ({
            key: `${key}-${action}`,
            frameWidth: PURPLE_W,
            frameHeight: PURPLE_H,
          })),
        ),
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
