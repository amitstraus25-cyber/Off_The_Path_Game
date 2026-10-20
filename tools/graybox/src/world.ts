/*
 * Renders the real map to a PNG in about a second, with no browser and no build.
 *
 * This exists because the question that actually matters -- "does the FOREST look like the board" --
 * cannot be answered by looking at a 32x32 tile. It only appears once tiles are composed. Before
 * this, the only way to see the composed world was to build the game and drive Playwright, which
 * takes minutes, so painters iterated on tiles while nobody iterated on the forest.
 *
 *   node src/world.ts --out /tmp/world.png              # the camera's worth of forest at the spawn
 *   node src/world.ts --out /tmp/w.png --frame title    # EXACTLY what the title screen shows
 *   node src/world.ts --out /tmp/w.png --frame arrive   # EXACTLY what the payoff shot shows
 *   node src/world.ts --out /tmp/w.png --frame portrait # the phone hero, 375x812
 *   node src/world.ts --out /tmp/w.png --at cottage     # framed on a named landmark
 *   node src/world.ts --out /tmp/w.png --x 10 --y 8 --w 20 --h 12 --zoom 2
 *   node src/world.ts --out /tmp/whole.png --whole      # all 60x42 tiles, for composition/density
 *
 * PREFER `--frame`. It derives the rectangle from `cameraFor()` and from the game's own focus rule,
 * so it is the only way to be sure the thing you are looking at is the thing a visitor sees. `--at`
 * centres on an object, which is a browsing convenience and is NOT a camera the game ever makes.
 *
 * It paints from the painters directly rather than from the generated PNG, so it shows the code as
 * it is right now, with no `pnpm graybox` in between.
 */
import { writeFileSync } from 'node:fs';
import { cameraFor, REFERENCE_VIEWPORTS } from '@otp/core';
import { Img } from './paint.ts';
import { TILE, TILE_NAMES, TILE_PAINTERS } from './tiles.ts';
import { BASE_GID, FLIP_D, FLIP_H, FLIP_V, generateForestMap, MAP_H, MAP_W } from './forest-map.ts';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const OUT = arg('out', '/tmp/world.png');
const ZOOM = Math.max(1, Number(arg('zoom', '1')));
const WHOLE = flag('whole');

/*
 * Tiled keeps a tile's mirror state in the top three bits of its gid, and Phaser's
 * `tilemapTiledJSON` loader honours them. So this renderer has to honour them too, or the
 * instrument we judge the art with and the game people actually play would disagree about the
 * same map file -- which is precisely how a change gets reported as landed when it has not.
 *
 * Unmasked it is worse than a disagreement: the first mirrored tile the map writes indexes
 * `TILE_NAMES` past the end of a 79-entry array, `tileName` comes back undefined and the tile
 * vanishes from the render with no warning.
 *
 * ALL FOUR NOW COME FROM `forest-map.ts`, which is the file that writes them into the map. They
 * were declared again here, four literals in two files describing one wire format, under a comment
 * about the two disagreeing. `BASE_GID` is what this file called `GID_MASK`; same number, and now
 * one name for it.
 */

/*
 * Tiled's own order of operations: the diagonal flip (an x/y transpose) first, then horizontal,
 * then vertical. Walking the destination and reading back from the source applies all three in
 * that order in one pass, with no intermediate buffers to get the order wrong in.
 *
 * Pixels are copied rather than drawn through `px`, so a mirrored tile is the same bytes as the
 * original: compositing a semi-transparent source pixel onto an empty destination would quietly
 * darken it, and a mirror must not change a colour.
 */
function mirror(src: Img, flips: number): Img {
  const h = (flips & FLIP_H) !== 0;
  const v = (flips & FLIP_V) !== 0;
  const d = (flips & FLIP_D) !== 0;
  if (!h && !v && !d) return src;
  const out = new Img(d ? src.h : src.w, d ? src.w : src.h);
  for (let dy = 0; dy < out.h; dy++)
    for (let dx = 0; dx < out.w; dx++) {
      const ax = h ? out.w - 1 - dx : dx;
      const ay = v ? out.h - 1 - dy : dy;
      out.data.set(src.get(d ? ay : ax, d ? ax : ay), (dy * out.w + dx) * 4);
    }
  return out;
}

/* Painters are pure and the map lays the same tile hundreds of times, so paint each once. */
const cache = new Map<string, Img>();
function tile(name: string, flips = 0): Img | undefined {
  const key = flips ? `${name}#${flips}` : name;
  const hit = cache.get(key);
  if (hit) return hit;
  const painter = TILE_PAINTERS[name];
  if (!painter) return undefined;
  let base = cache.get(name);
  if (!base) {
    base = new Img(TILE, TILE);
    painter(base);
    cache.set(name, base);
  }
  const img = mirror(base, flips);
  cache.set(key, img);
  return img;
}

const map = generateForestMap();
const data = JSON.parse(map.json) as {
  layers: {
    name: string;
    type: string;
    data?: number[];
    objects?: { name: string; x: number; y: number }[];
  }[];
};
const objects = data.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];

/*
 * Where to frame. A landmark name centres the camera on it, as the game would.
 *
 * THE DEFAULT SIZE IS ASKED FOR, NOT REMEMBERED. It used to read `--w 26 --h 15`, which is the
 * zoom option that was considered and ABANDONED during the remaster: this renderer -- the one
 * instrument anybody judges framing with -- reproduced the phantom camera on every flagless run,
 * for three rounds, while `packages/core/src/camera.ts` said 19.41 x 11.22. A tool that certifies
 * a picture must frame the picture the player is shown, so the default now comes from the same
 * function the game sizes its canvas with. Pass --w/--h to look at something else deliberately.
 */
const DESKTOP = cameraFor(REFERENCE_VIEWPORTS.desktop);
let vx = Number(arg('x', '-1'));
let vy = Number(arg('y', '-1'));
let vw = Number(arg('w', String(Math.ceil(DESKTOP.tiles.width))));
let vh = Number(arg('h', String(Math.ceil(DESKTOP.tiles.height))));

/*
 * The three rectangles the game actually draws, each derived the way the game derives it.
 *
 * `forest-scene.ts` puts Red's feet one tile BELOW the `spawn-red` object (`spawn.y + TILE`) and
 * then frames `position.y + CAMERA_FOCUS_Y`, five eighths of a tile up. Composing against the
 * object's own row instead -- which is the easy mistake, and the one that was live in
 * `forest-map.ts` when this was written -- aims every framing decision one whole tile high, so the
 * crowns planted to close the top edge sit above it and the visitor gets their keylines instead.
 */
const FRAME = arg('frame', '');
const frameRect = (
  name: string,
): { x: number; y: number; vp: { width: number; height: number } } => {
  const obj = (n: string) => {
    const o = objects.find((q) => q.name === n);
    if (!o) throw new Error(`--frame ${name}: the map has no "${n}" object`);
    return o;
  };
  if (name === 'title' || name === 'portrait') {
    const s = obj('spawn-red');
    // Red's feet, then the camera's lift. Both read off the game, never written down here.
    const centre = { x: s.x / TILE + 0.5, y: (s.y + TILE) / TILE - 5 / 8 };
    const vp = name === 'title' ? REFERENCE_VIEWPORTS.desktop : REFERENCE_VIEWPORTS.phone;
    return { ...centre, vp };
  }
  if (name === 'arrive') {
    // `doorFocus()`: the chimney row above the facade down through the three rows of lane below it.
    const f = obj('prop-cottage') as { x: number; y: number; width?: number; height?: number };
    const w = f.width ?? TILE * 6;
    const h = f.height ?? TILE * 4;
    const top = f.y - TILE;
    const bottom = f.y + h + TILE * 3;
    return {
      x: (f.x + w / 2) / TILE,
      y: (top + bottom) / 2 / TILE,
      vp: REFERENCE_VIEWPORTS.desktop,
    };
  }
  throw new Error(`--frame must be title, portrait or arrive, not "${name}"`);
};

if (WHOLE) {
  vx = 0;
  vy = 0;
  vw = MAP_W;
  vh = MAP_H;
} else if (FRAME) {
  const { x, y, vp } = frameRect(FRAME);
  const { tiles } = cameraFor(vp);
  const hold = (v: number, span: number, limit: number): number =>
    Math.min(Math.max(v - span / 2, 0), Math.max(0, limit - span));
  const fx = hold(x, tiles.width, MAP_W);
  const fy = hold(y, tiles.height, MAP_H);
  // Whole tiles, outwards, so nothing the camera shows a sliver of is cropped out of the render.
  vx = Math.floor(fx);
  vy = Math.floor(fy);
  vw = Math.ceil(fx + tiles.width) - vx;
  vh = Math.ceil(fy + tiles.height) - vy;
  console.log(
    `--frame ${FRAME}: camera tiles (${fx.toFixed(2)}, ${fy.toFixed(2)}) to ` +
      `(${(fx + tiles.width).toFixed(2)}, ${(fy + tiles.height).toFixed(2)})` +
      (fy % 1
        ? `; its top edge cuts ${((fy % 1) * 100).toFixed(0)}% into row ${Math.floor(fy)}`
        : ''),
  );
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
let mirrored = 0;
for (const name of DRAWN) {
  const layer = data.layers.find((l) => l.name === name);
  if (!layer?.data) continue;
  for (let ty = 0; ty < vh; ty++) {
    for (let tx = 0; tx < vw; tx++) {
      const raw = layer.data[(vy + ty) * MAP_W + (vx + tx)];
      if (!raw) continue;
      const flips = (raw & ~BASE_GID) >>> 0;
      const gid = raw & BASE_GID;
      if (!gid) continue;
      const tileName = TILE_NAMES[gid - 1];
      if (!tileName) continue;
      const img = tile(tileName, flips);
      if (!img) {
        missing++;
        continue;
      }
      if (flips) mirrored++;
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
/*
 * `mirrored` is printed because it is the cheapest possible check that a map which claims to
 * mirror tiles actually does: zero here means no flip bit reached the renderer, whatever the
 * generator reports.
 */
console.log(
  `${OUT}  ${out.w}x${out.h}  tiles (${vx},${vy}) ${vw}x${vh}  mirrored ${mirrored}` +
    (missing ? `  WARNING: ${missing} tiles had no painter` : ''),
);
