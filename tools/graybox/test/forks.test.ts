/*
 * THE `fork-*` OBJECTS STAND WHERE THE PATH REALLY BRANCHES.
 *
 * They exist for the Way Teller's signs (2026-10-22), and a sign at a place where the road merely
 * bends is a sign pointing two ways down one road. So this asks the GROUND, not the generator: the
 * generator places them off its own record of which footpath it laid where (`forkAt` in
 * forest-map.ts), and this checks the result with an instrument that shares none of that code.
 *
 * THE INSTRUMENT. Walk the sand outward from the fork cell, four-connected, and take the ring of
 * cells exactly `ARM` steps away. A road that only passes through leaves that ring in two pieces,
 * one each way; a junction leaves it in three or more, because three ways lead out of it. Pieces
 * are counted eight-connected, so a two-wide road stepping a row is still one arm. `ARM` is four:
 * far enough that the two-wide carriageway's own corners have closed up, near enough that no arm
 * has reached a second junction. Measured when written: three arms at both forks, and two at every
 * cell of the carriageway four columns either side of them.
 *
 * TWO MAPS, as `cast-clear-of-door.test.ts` does: the generator's output, so a change to the
 * footpaths fails here before anyone regenerates, and the committed file the game ships.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BASE_GID, generateForestMap, MAP_H, MAP_W } from '../src/forest-map.ts';
import { TILE, TILE_NAMES } from '../src/tiles.ts';

interface Obj {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface MapFile {
  layers: { name: string; type: string; data?: number[]; objects?: Obj[] }[];
}

/** How far out the arms are counted, in steps along the sand. See the header. */
const ARM = 4;

const committed = JSON.parse(
  readFileSync(new URL('../../../apps/game/src/assets/map-forest.json', import.meta.url), 'utf8'),
) as MapFile;
const generated = JSON.parse(generateForestMap().json) as MapFile;

/** How many separate ways lead out of (x, y) along the sand, read `ARM` steps out. */
function armsAt(sand: (x: number, y: number) => boolean, x0: number, y0: number): number {
  const dist = new Map<number, number>([[y0 * MAP_W + x0, 0]]);
  const queue: [number, number][] = [[x0, y0]];
  const ring: [number, number][] = [];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const d = dist.get(y * MAP_W + x)!;
    if (d === ARM) {
      ring.push([x, y]);
      continue;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * MAP_W + nx;
      if (dist.has(k) || !sand(nx, ny)) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  // Pieces of the ring, eight-connected.
  const left = new Set(ring.map(([x, y]) => y * MAP_W + x));
  let pieces = 0;
  for (const [x, y] of ring) {
    if (!left.has(y * MAP_W + x)) continue;
    pieces++;
    const stack: [number, number][] = [[x, y]];
    left.delete(y * MAP_W + x);
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const k = (cy + dy) * MAP_W + (cx + dx);
          if (!left.has(k)) continue;
          left.delete(k);
          stack.push([cx + dx, cy + dy]);
        }
    }
  }
  return pieces;
}

describe.each([
  ['the generated map', generated],
  ['the committed map-forest.json', committed],
])('%s: the fork objects', (_which, map) => {
  const objects = map.layers.find((l) => l.type === 'objectgroup')?.objects ?? [];
  const ground = map.layers.find((l) => l.name === 'ground')!.data!;
  const collision = map.layers.find((l) => l.name === 'collision')!.data!;
  const nameAt = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= MAP_W || y >= MAP_H
      ? ''
      : (TILE_NAMES[((ground[y * MAP_W + x]! >>> 0) & BASE_GID) - 1] ?? '');
  const sand = (x: number, y: number): boolean => {
    const n = nameAt(x, y);
    return n.startsWith('path') || n.startsWith('bridge');
  };
  const forks = objects.filter((o) => o.name.startsWith('fork-'));

  /*
   * Two, one per footpath: the owl's off the signpost junction and the lantern keeper's east of
   * the bridge. A CONTRACT rather than a bound -- the Way Teller's content names them -- so a third
   * footpath must arrive here on purpose rather than as a sign nobody wrote copy for.
   */
  it('names fork-1 .. fork-N, one per footpath, west to east', () => {
    expect(forks.map((o) => o.name)).toEqual(['fork-1', 'fork-2']);
    const xs = forks.map((o) => o.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it.each(forks.map((o) => [o.name, o] as const))('%s is one walkable tile of path', (_n, o) => {
    expect([o.width, o.height]).toEqual([TILE, TILE]);
    const x = o.x / TILE;
    const y = o.y / TILE;
    expect(sand(x, y), `${o.name} at (${x},${y}) is ${nameAt(x, y)}, not path`).toBe(true);
    expect(collision[y * MAP_W + x], `${o.name} at (${x},${y}) is solid`).toBe(0);
  });

  it.each(forks.map((o) => [o.name, o] as const))(
    `%s is a real junction: three or more ways out, ${ARM} steps along the sand`,
    (_n, o) => {
      const x = o.x / TILE;
      const y = o.y / TILE;
      expect(armsAt(sand, x, y), `${o.name} at (${x},${y})`).toBeGreaterThanOrEqual(3);
    },
  );

  /*
   * And the instrument is not simply generous: the carriageway a few columns EAST of each fork,
   * where the road only passes through, reads as exactly two ways. Without this a ring that always
   * came back in three pieces would pass every fork above. East and not west, because fork-1 is
   * five columns from where the carriageway starts and a dead end reads as one way, not two.
   */
  it.each(forks.map((o) => [o.name, o] as const))(
    '%s: the road just east of it is not a junction',
    (_n, o) => {
      const fx = o.x / TILE;
      const fy = o.y / TILE;
      const x = fx + ARM + 1;
      // The run of sand in that column nearest the fork's own row is the carriageway it is on.
      const rows = Array.from({ length: MAP_H }, (_v, y) => y)
        .filter((y) => sand(x, y))
        .sort((a, b) => Math.abs(a - fy) - Math.abs(b - fy));
      expect(rows.length, `no road at column ${x}`).toBeGreaterThan(0);
      expect(armsAt(sand, x, rows[0]!), `column ${x}, row ${rows[0]}`).toBe(2);
    },
  );
});
