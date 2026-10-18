import { describe, expect, it } from 'vitest';
import map from '../src/assets/map-forest.json';
import { readForestMap } from '../src/world/map';
import { TILE } from '../src/world/logic';
import type { ForestMap, MapObject } from '../src/world/map';

const forest: ForestMap = readForestMap(map);
const object = (name: string): MapObject => {
  const found = forest.objects.find((o) => o.name === name);
  if (!found) throw new Error(`map has no "${name}"`);
  return found;
};

const tiles = (o: MapObject) => ({
  x0: Math.floor(o.x / TILE),
  x1: Math.floor((o.x + o.width) / TILE) - 1,
  y0: Math.floor(o.y / TILE),
  y1: Math.floor((o.y + o.height) / TILE) - 1,
});

const solid = (x: number, y: number): boolean =>
  x < 0 ||
  y < 0 ||
  x >= forest.collision.width ||
  y >= forest.collision.height ||
  forest.collision.tiles[y * forest.collision.width + x] !== 0;

/** Every walkable tile reachable from the spawn, optionally refusing to enter a rectangle. */
function reachable(avoid?: MapObject): Set<string> {
  const spawn = tiles(object('spawn-red'));
  const blocked = avoid ? tiles(avoid) : null;
  const start = `${spawn.x0},${spawn.y0}`;
  const seen = new Set([start]);
  const queue = [[spawn.x0, spawn.y0] as const];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || solid(nx, ny)) continue;
      if (blocked && nx >= blocked.x0 && nx <= blocked.x1 && ny >= blocked.y0 && ny <= blocked.y1)
        continue;
      seen.add(key);
      queue.push([nx, ny] as const);
    }
  }
  return seen;
}

const touches = (seen: Set<string>, o: MapObject): boolean => {
  const t = tiles(o);
  for (let y = t.y0; y <= t.y1; y++)
    for (let x = t.x0; x <= t.x1; x++) {
      if (seen.has(`${x},${y}`)) return true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        if (seen.has(`${x + dx},${y + dy}`)) return true;
    }
  return false;
};

describe('the generated forest is playable', () => {
  const open = reachable();

  it.each(['npc-rabbit', 'npc-owl', 'npc-lantern-keeper'])('Red can walk to %s', (name) => {
    expect(touches(open, object(name))).toBe(true);
  });

  it('Red can reach the cottage gate', () => {
    expect(touches(open, object('trigger-cottage'))).toBe(true);
  });

  it('Red starts somewhere she can stand', () => {
    const spawn = tiles(object('spawn-red'));
    expect(solid(spawn.x0, spawn.y0)).toBe(false);
  });
});

describe('the notice post cannot be walked around', () => {
  /*
   * The zero-click beat is the lesson of the level, so it must not be optional. The garden fence
   * encloses the cottage on three sides and the map border closes the fourth, which leaves the
   * gate approach, and the notice spans it. Without this the player can take a one-tile detour
   * and never learn what the notice does.
   */
  it('the gate is unreachable if the notice is refused', () => {
    const avoidingNotice = reachable(object('notice-forest-post'));
    expect(touches(avoidingNotice, object('trigger-cottage'))).toBe(false);
  });

  it('but the gate is reachable normally', () => {
    expect(touches(reachable(), object('trigger-cottage'))).toBe(true);
  });

  it('the notice spans the full width of the gate approach', () => {
    const notice = tiles(object('notice-forest-post'));
    const gate = tiles(object('trigger-cottage'));
    expect(notice.y0).toBeLessThanOrEqual(gate.y0);
    expect(notice.y1).toBeGreaterThanOrEqual(gate.y1);
    expect(notice.x1).toBe(gate.x0 - 1);
  });
});
