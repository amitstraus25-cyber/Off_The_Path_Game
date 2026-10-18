// Scratch: one named tile, repeated 2x2 so its seams show, at a big zoom. Not part of the build.
import { writeFileSync } from 'node:fs';
import { Img } from './src/paint.ts';
import { WATER_TILES } from './src/tiles/w-water.ts';
const S = 32,
  name = process.argv[3]!,
  Z = Number(process.argv[4] ?? 10);
const cell = new Img(S, S);
WATER_TILES[name]!(cell);
const two = new Img(S * 2, S * 2);
for (const dy of [0, S]) for (const dx of [0, S]) two.blit(cell, dx, dy);
const out = new Img(two.w * Z, two.h * Z);
for (let y = 0; y < out.h; y++)
  for (let x = 0; x < out.w; x++) out.px(x, y, two.get(Math.floor(x / Z), Math.floor(y / Z)));
writeFileSync(process.argv[2]!, out.png());
console.log(`${process.argv[2]} ${name} ${out.w}x${out.h}`);
