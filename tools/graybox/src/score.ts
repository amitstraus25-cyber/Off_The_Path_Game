/*
 * Scores a rendered world against the concept board, on axes that can be measured.
 *
 * "Match the board" is a judgement, so every agent and every reviewer applied a different bar and
 * the work did not converge. These five numbers are not a substitute for looking -- they cannot
 * tell you whether a tree is charming -- but they do pin down the four differences that carry most
 * of the gap, and they can be checked in a second instead of in ninety minutes.
 *
 *   node src/score.ts --profile <any.png>            # print one image's profile
 *   node src/score.ts --board <dir-of-crops>         # build the target profile from board crops
 *   node src/score.ts --world <render.png>           # score a render against the stored target
 *
 * The target lives in board-profile.json beside this file, so scoring needs no crops to hand.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from './png-read.ts';
import type { Raster } from './png-read.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = join(HERE, 'board-profile.json');

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

export interface Profile {
  /** Share of opaque pixels darker than luma 81: the keyline and deep-shade band. */
  deep: number;
  /** Share darker than luma 60: true keyline only. */
  keyline: number;
  /** Standard deviation of luma: how much range the image uses. */
  spread: number;
  /** Share of pixels differing from the neighbour right or below by more than 24 luma. */
  edges: number;
  /** Mean standard deviation of luma inside 16x16 blocks: local texture rather than global range. */
  texture: number;
  /** Distinct colours quantised to 5 bits per channel, per 1000 opaque pixels. */
  variety: number;
}

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

export function profile(img: Raster): Profile {
  const { width: w, height: h, data } = img;
  const L: number[] = [];
  const opaque: boolean[] = [];
  const seen = new Set<number>();

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]!;
    opaque[p] = a > 40;
    L[p] = opaque[p] ? luma(data[i]!, data[i + 1]!, data[i + 2]!) : -1;
    if (opaque[p]) {
      seen.add(((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3));
    }
  }

  const vals = L.filter((v) => v >= 0);
  const n = vals.length || 1;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const spread = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
  const deep = vals.filter((v) => v < 81).length / n;
  const keyline = vals.filter((v) => v < 60).length / n;

  let edge = 0;
  let pairs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!opaque[p]) continue;
      for (const q of [x + 1 < w ? p + 1 : -1, y + 1 < h ? p + w : -1]) {
        if (q < 0 || !opaque[q]) continue;
        pairs++;
        if (Math.abs(L[p]! - L[q]!) > 24) edge++;
      }
    }
  }

  // Local texture: how varied a 16x16 patch is on its own, which flat fills cannot fake.
  const B = 16;
  const blocks: number[] = [];
  for (let by = 0; by + B <= h; by += B) {
    for (let bx = 0; bx + B <= w; bx += B) {
      const v: number[] = [];
      for (let y = by; y < by + B; y++)
        for (let x = bx; x < bx + B; x++) {
          const p = y * w + x;
          if (opaque[p]) v.push(L[p]!);
        }
      if (v.length < B * B * 0.5) continue;
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      blocks.push(Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length));
    }
  }

  return {
    deep: +(deep * 100).toFixed(2),
    keyline: +(keyline * 100).toFixed(2),
    spread: +spread.toFixed(2),
    edges: +((pairs ? edge / pairs : 0) * 100).toFixed(2),
    texture: +(blocks.length ? blocks.reduce((a, b) => a + b, 0) / blocks.length : 0).toFixed(2),
    variety: +((seen.size / n) * 1000).toFixed(2),
  };
}

const load = (p: string): Raster => readPng(readFileSync(p));

const profileArg = arg('profile');
const boardArg = arg('board');
const worldArg = arg('world');

if (profileArg) {
  console.log(JSON.stringify(profile(load(profileArg)), null, 2));
} else if (boardArg) {
  const files = readdirSync(boardArg).filter((f) => f.endsWith('.png'));
  if (!files.length) throw new Error(`no PNGs in ${boardArg}`);
  const each = files.map((f) => ({ file: f, p: profile(load(join(boardArg, f))) }));
  const keys: (keyof Profile)[] = ['deep', 'keyline', 'spread', 'edges', 'texture', 'variety'];
  const mean = {} as Profile;
  for (const k of keys) {
    mean[k] = +(each.reduce((a, e) => a + e.p[k], 0) / each.length).toFixed(2);
  }
  writeFileSync(TARGET_FILE, JSON.stringify({ from: files, each, target: mean }, null, 2) + '\n');
  for (const e of each) console.log(`  ${e.file}: ${JSON.stringify(e.p)}`);
  console.log(`\ntarget written to ${TARGET_FILE}:\n${JSON.stringify(mean, null, 2)}`);
} else if (worldArg) {
  const target = (JSON.parse(readFileSync(TARGET_FILE, 'utf8')) as { target: Profile }).target;
  const mine = profile(load(worldArg));
  const keys: (keyof Profile)[] = ['deep', 'keyline', 'spread', 'edges', 'texture', 'variety'];
  const label: Record<keyof Profile, string> = {
    deep: 'deep shade  (% under luma 81)',
    keyline: 'keyline     (% under luma 60)',
    spread: 'luma spread (stdev)',
    edges: 'edge density(% of neighbours)',
    texture: 'texture     (mean 16px stdev)',
    variety: 'colour variety (per 1000px)',
  };
  console.log(`${worldArg}\n`);
  console.log('  axis                            yours    board    ratio');
  let total = 0;
  for (const k of keys) {
    const ratio = target[k] ? mine[k] / target[k] : 1;
    total += Math.abs(Math.log(Math.max(ratio, 0.01)));
    const flag = ratio < 0.6 ? '  <-- far too low' : ratio > 1.7 ? '  <-- far too high' : '';
    console.log(
      `  ${label[k].padEnd(30)} ${String(mine[k]).padStart(7)} ${String(target[k]).padStart(8)} ${ratio.toFixed(2).padStart(7)}${flag}`,
    );
  }
  const distance = +(total / keys.length).toFixed(3);
  console.log(
    `\n  distance from the board: ${distance}   (0 is a match; under 0.20 is close; over 0.50 is a different look)`,
  );
} else {
  console.log('usage: --profile <png> | --board <dir of board crops> | --world <render.png>');
}
