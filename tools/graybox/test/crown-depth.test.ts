/*
 * WHERE TWO ELDERS OVERLAP, THE ONE IN FRONT IS DRAWN IN FRONT.
 *
 * The seam this watches (2026-10-22): an elder's middle and bottom crown quarters are opaque in
 * every pixel, so the overlap rule in `layCrown` let a BACK tree win cells of the crown standing a
 * row in front of it, and its dark underside printed as a square inside the front crown, cut on two
 * sides by the tile grid. `forest-map.ts` now lays the front-over-back tiles from
 * `tiles/w-trees.ts` in those cells, after the canopy rebuild.
 *
 * READ OFF THE MAP, NOT THE REGISTER. The generator's register is what decides those cells, so a
 * check that asked it would agree with any mistake it made. This finds the elders the way a reader
 * of the shipped file would -- by their trunk rows in `decor-below` -- and asks of every cell two
 * elders' crowns share whether the tile drawn there is the BACK tree's opaque quarter. That is the
 * defect exactly: a back tree's `elder-mc` or `elder-bc` sitting where a tree in front also has a
 * crown.
 *
 * A RATCHET, at the measurement. On the map before the fix this instrument counted 24; after it, 0.
 * Lower it if it ever reads lower; never raise it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BASE_GID, FLIP_H, generateForestMap, MAP_W } from '../src/forest-map.ts';
import { TILE_NAMES } from '../src/tiles.ts';

/** How many back-over-front opaque elder cells the map may hold. Lower only. */
const BACK_OVER_FRONT = 0;

interface MapFile {
  layers: { name: string; data?: number[] }[];
}

const committed = JSON.parse(
  readFileSync(new URL('../../../apps/game/src/assets/map-forest.json', import.meta.url), 'utf8'),
) as MapFile;
const generated = JSON.parse(generateForestMap().json) as MapFile;

/** Every cell where a back elder's opaque quarter is drawn over a front elder's crown. */
function backOverFront(map: MapFile): string[] {
  const below = map.layers.find((l) => l.name === 'decor-below')!.data!;
  const above = map.layers.find((l) => l.name === 'decor-above')!.data!;
  const name = (raw: number): string => TILE_NAMES[((raw >>> 0) & BASE_GID) - 1] ?? '';
  const flipped = (raw: number): boolean => ((raw >>> 0) & FLIP_H) !== 0;

  // An elder is found by the middle of its trunk; it owns columns x-1..x+1, rows y-3..y-1.
  const elders: { x: number; y: number; flip: boolean }[] = [];
  below.forEach((raw, i) => {
    if (name(raw) !== 'elder-trunk-m') return;
    elders.push({ x: (i % MAP_W) - 1, y: Math.floor(i / MAP_W), flip: flipped(raw) });
  });
  const ROWS = ['t', 'm', 'b'];
  const COLS = ['l', 'c', 'r'];
  /** The tile an elder draws at (dx, dy) of its crown, as drawn: name and flip. */
  const quarter = (e: (typeof elders)[number], dx: number, dy: number): string =>
    `elder-${ROWS[dy]}${COLS[e.flip ? 2 - dx : dx]}`;

  const owners = new Map<number, { e: (typeof elders)[number]; dx: number; dy: number }[]>();
  for (const e of elders)
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) {
        const key = (e.y - 3 + dy) * MAP_W + e.x + dx;
        owners.set(key, [...(owners.get(key) ?? []), { e, dx, dy }]);
      }

  const bad: string[] = [];
  for (const [key, list] of owners) {
    if (list.length < 2) continue;
    const raw = above[key] ?? 0;
    const drawn = name(raw);
    for (const back of list) {
      const q = quarter(back.e, back.dx, back.dy);
      if (q !== drawn || flipped(raw) !== back.e.flip) continue;
      if (q !== 'elder-mc' && q !== 'elder-bc') continue;
      if (list.some((f) => f.e.y > back.e.y))
        bad.push(`(${key % MAP_W},${Math.floor(key / MAP_W)}) ${q}`);
    }
  }
  return bad;
}

describe.each([
  ['the generated map', generated],
  ['the committed map-forest.json', committed],
])('%s', (_which, map) => {
  it('finds elders at all, or the assertion below is vacuous', () => {
    const below = map.layers.find((l) => l.name === 'decor-below')!.data!;
    const elders = below.filter(
      (raw) => TILE_NAMES[((raw >>> 0) & BASE_GID) - 1] === 'elder-trunk-m',
    );
    expect(elders.length).toBeGreaterThan(20);
  });

  it(`draws no back elder's opaque quarter over a front elder (at most ${BACK_OVER_FRONT})`, () => {
    const bad = backOverFront(map);
    expect(bad.length, bad.join('  ')).toBeLessThanOrEqual(BACK_OVER_FRONT);
  });
});
