/*
 * Contact sheets for the art, so a painter can see what it drew without booting the game.
 *
 * Every frame in this project is between 16 and 64 pixels on a side, which is unreadable at 1:1 on
 * any screen. This renders the sheets at an integer zoom with a grid over the frame boundaries and
 * prints the name of every cell, so a change can be judged by looking at it rather than by reading
 * the code that drew it.
 *
 *   node src/preview.ts --out <dir> [--zoom 8] [--what tiles|red|npcs|portraits|items|fx|all]
 *
 * Nearest-neighbour only: these are pixels, and a smoothed preview would hide exactly the
 * single-pixel mistakes it exists to catch.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Img, rgb } from './paint.ts';
import type { RGBA } from './paint.ts';
import { TILE_NAMES, paintTileset } from './tiles.ts';
import {
  ITEM_PAINTERS,
  NPC_PAINTERS,
  PORTRAIT_PAINTERS,
  paintDust,
  paintInteractPrompt,
  paintNpcSheet,
  paintPawprints,
  paintRedSheet,
  RED_H,
  RED_W,
} from './sprites.ts';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

const OUT = arg('out', '/tmp/graybox-preview');
const ZOOM = Math.max(1, Number(arg('zoom', '8')));
const WHAT = arg('what', 'all');

mkdirSync(OUT, { recursive: true });

/* A mid grey that is in neither the forest nor the brand palette, so the grid is never mistaken
   for art, and a checkerboard under it so transparent pixels are obvious. */
const GRID: RGBA = rgb('#ff00ff');
const CHECK_A: RGBA = rgb('#3a3a3a');
const CHECK_B: RGBA = rgb('#505050');

/** Nearest-neighbour zoom onto a checkerboard, with a grid every `cell` source pixels. */
function sheet(src: Img, cellW: number, cellH: number): Img {
  const out = new Img(src.w * ZOOM, src.h * ZOOM);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? CHECK_A : CHECK_B;
      out.px(x, y, checker);
    }
  }
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c[3] === 0) continue;
      out.rect(x * ZOOM, y * ZOOM, ZOOM, ZOOM, c);
    }
  }
  // Grid last, so it sits over the art rather than under it.
  for (let x = 0; x <= src.w; x += cellW) out.rect(x * ZOOM, 0, 1, out.h, GRID);
  for (let y = 0; y <= src.h; y += cellH) out.rect(0, y * ZOOM, out.w, 1, GRID);
  return out;
}

const write = (name: string, img: Img): void => {
  writeFileSync(join(OUT, name), img.png());
  console.log(`${join(OUT, name)}  ${img.w}x${img.h}`);
};

/** Prints which cell holds what, since the sheet itself carries no text. */
function index(names: readonly string[], cols: number): void {
  names.forEach((n, i) => {
    if (i % cols === 0) process.stdout.write(i === 0 ? '    row 0: ' : `\n    row ${i / cols}: `);
    process.stdout.write(`${n}  `);
  });
  process.stdout.write('\n');
}

/*
 * Render one painter module on its own, before it is wired into the tileset. A painter being
 * rewritten lives in its own file and nothing imports it yet, so without this the only way to see
 * it would be to wire it in first and judge it afterwards -- which is the wrong way round.
 *
 *   node src/preview.ts --module ./tiles/ground.ts --export GROUND --size 32 --out /tmp/art
 *
 * The module must export a Record<string, (img: Img) => void> under `--export`.
 */
const MODULE = arg('module', '');
if (MODULE) {
  const EXPORT = arg('export', 'default');
  const W = Number(arg('size', '32'));
  const H = Number(arg('height', String(W)));
  const COLS = Number(arg('cols', '8'));

  const mod = (await import(MODULE)) as Record<string, unknown>;
  const painters = mod[EXPORT] as Record<string, (img: Img) => void> | undefined;
  if (!painters) {
    console.error(
      `module ${MODULE} has no export "${EXPORT}" (has: ${Object.keys(mod).join(', ')})`,
    );
    process.exit(1);
  }

  const names = Object.keys(painters);
  const cols = Math.min(COLS, names.length);
  const rows = Math.ceil(names.length / cols);
  const board = new Img(cols * W, rows * H);
  names.forEach((name, i) => {
    const cell = new Img(W, H);
    painters[name]!(cell);
    board.blit(cell, (i % cols) * W, Math.floor(i / cols) * H);
  });
  const file = `sheet-${EXPORT.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  write(file, sheet(board, W, H));
  console.log(`  ${names.length} painters of ${W}x${H}, ${cols} per row:`);
  index(names, cols);
  process.exit(0);
}

const want = (k: string): boolean => WHAT === 'all' || WHAT === k;

if (want('tiles')) {
  const ts = paintTileset();
  const cell = ts.w / 12; // the tileset is laid out 12 wide, whatever the tile size
  write('sheet-tiles.png', sheet(ts, cell, cell));
  console.log(`  tileset ${ts.w}x${ts.h}, ${TILE_NAMES.length} tiles of ${cell}px, 12 per row:`);
  index(TILE_NAMES, 12);
}

if (want('red')) {
  const red = paintRedSheet();
  write('sheet-red.png', sheet(red.sheet, RED_W, RED_H));
  console.log(`  Red ${RED_W}x${RED_H} per frame, ${Object.keys(red.frames).length} frames`);
  index(Object.keys(red.frames), 4);
}

if (want('npcs')) {
  for (const name of Object.keys(NPC_PAINTERS)) {
    write(`sheet-${name}.png`, sheet(paintNpcSheet(name), RED_W, RED_H));
  }
}

if (want('portraits')) {
  for (const [name, painter] of Object.entries(PORTRAIT_PAINTERS)) {
    const img = new Img(32, 32);
    painter(img);
    write(`sheet-${name}.png`, sheet(img, 32, 32));
  }
}

if (want('items')) {
  for (const [name, painter] of Object.entries(ITEM_PAINTERS)) {
    const img = new Img(32, 32);
    painter(img);
    write(`sheet-${name}.png`, sheet(img, 32, 32));
  }
}

if (want('fx')) {
  write('sheet-fx-dust.png', sheet(paintDust(), 8, 8));
  write('sheet-fx-interact-prompt.png', sheet(paintInteractPrompt(), 16, 16));
  write('sheet-fx-pawprints.png', sheet(paintPawprints(), 16, 16));
}
