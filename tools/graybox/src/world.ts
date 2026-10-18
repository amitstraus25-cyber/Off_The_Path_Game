/*
 * Renders the real map to a PNG in about a second, with no browser and no build.
 *
 * This exists because the question that actually matters -- "does the FOREST look like the board" --
 * cannot be answered by looking at a 32x32 tile. It only appears once tiles are composed. Before
 * this, the only way to see the composed world was to build the game and drive Playwright, which
 * takes minutes, so painters iterated on tiles while nobody iterated on the forest.
 *
 *   node src/world.ts --out /tmp/world.png            # the camera's worth of forest at the spawn
 *   node src/world.ts --out /tmp/w.png --at cottage   # framed on a named landmark
 *   node src/world.ts --out /tmp/w.png --x 10 --y 8 --w 26 --h 15 --zoom 2
 *   node src/world.ts --out /tmp/whole.png --whole    # all 60x42 tiles, for composition and density
 *
 * It paints from the painters directly rather than from the generated PNG, so it shows the code as
 * it is right now, with no `pnpm graybox` in between.
 */
import { writeFileSync } from 'node:fs';
import { Img } from './paint.ts';
import { TILE, TILE_NAMES, TILE_PAINTERS } from './tiles.ts';
import { generateForestMap, MAP_H, MAP_W } from './forest-map.ts';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const OUT = arg('out', '/tmp/world.png');
const ZOOM = Math.max(1, Number(arg('zoom', '1')));
const WHOLE = flag('whole');

/* Painters are pure and the map lays the same tile hundreds of times, so paint each once. */
const cache = new Map<string, Img>();
function tile(name: string): Img | undefined {
  const hit = cache.get(name);
  if (hit) return hit;
  const painter = TILE_PAINTERS[name];
  if (!painter) return undefined;
  const img = new Img(TILE, TILE);
  painter(img);
  cache.set(name, img);
  return img;
}

const map = generateForestMap();
const data = JSON.parse(map.json) as {
  layers: { name: string; type: string; data?: number[] }[];
  objects?: unknown;
};
const objects =
  (
    JSON.parse(map.json) as {
      layers: { type: string; objects?: { name: string; x: number; y: number }[] }[];
    }
  ).layers.find((l) => l.type === 'objectgroup')?.objects ?? [];

/* Where to frame. A landmark name centres the camera on it, as the game would. */
let vx = Number(arg('x', '-1'));
let vy = Number(arg('y', '-1'));
let vw = Number(arg('w', '26'));
let vh = Number(arg('h', '15'));

if (WHOLE) {
  vx = 0;
  vy = 0;
  vw = MAP_W;
  vh = MAP_H;
} else if (vx < 0 || vy < 0) {
  const want = arg('at', 'spawn-red');
  const found =
    objects.find((o) => o.name === want) ??
    objects.find((o) => o.name === `prop-${want}`) ??
    objects.find((o) => o.name.includes(want));
  const cx = found ? Math.floor(found.x / TILE) : Math.floor(MAP_W / 2);
  const cy = found ? Math.floor(found.y / TILE) : Math.floor(MAP_H / 2);
  if (!found) console.warn(`no landmark "${want}"; framing the middle of the map`);
  vx = Math.max(0, Math.min(MAP_W - vw, cx - Math.floor(vw / 2)));
  vy = Math.max(0, Math.min(MAP_H - vh, cy - Math.floor(vh / 2)));
}
vw = Math.min(vw, MAP_W - vx);
vh = Math.min(vh, MAP_H - vy);

const board = new Img(vw * TILE, vh * TILE);
const DRAWN = ['ground', 'decor-below', 'decor-above'];

let missing = 0;
for (const name of DRAWN) {
  const layer = data.layers.find((l) => l.name === name);
  if (!layer?.data) continue;
  for (let ty = 0; ty < vh; ty++) {
    for (let tx = 0; tx < vw; tx++) {
      const gid = layer.data[(vy + ty) * MAP_W + (vx + tx)];
      if (!gid) continue;
      const tileName = TILE_NAMES[gid - 1];
      if (!tileName) continue;
      const img = tile(tileName);
      if (!img) {
        missing++;
        continue;
      }
      board.blit(img, tx * TILE, ty * TILE);
    }
  }
}

const out =
  ZOOM === 1
    ? board
    : (() => {
        const z = new Img(board.w * ZOOM, board.h * ZOOM);
        for (let y = 0; y < board.h; y++)
          for (let x = 0; x < board.w; x++) z.rect(x * ZOOM, y * ZOOM, ZOOM, ZOOM, board.get(x, y));
        return z;
      })();

writeFileSync(OUT, out.png());
console.log(
  `${OUT}  ${out.w}x${out.h}  tiles (${vx},${vy}) ${vw}x${vh}` +
    (missing ? `  WARNING: ${missing} tiles had no painter` : ''),
);
