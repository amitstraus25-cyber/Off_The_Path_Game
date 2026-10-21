import { describe, expect, it } from 'vitest';
import mapJson from '../../game/src/assets/map-forest.json';
import { TILE, WALK_SPEED } from '../../game/src/world/logic.ts';
import { MIN_RUN_MS } from '../src/handlers.ts';

/*
 * MIN_RUN_MS, MEASURED OFF THE SHIPPED MAP rather than remembered (PAUL_BRIEF trap 1).
 *
 * The bound is the straight line from Purple's spawn to the cottage door -- which no walk around
 * trees can beat -- less one tile at each end for Purple's body reaching the door before her
 * position does, at WALK_SPEED (diagonals are normalised, so nothing moves faster). The floor must
 * sit under it, or a direct honest run is refused; and close under it, or it guards nothing.
 */
interface MapObject {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const objects = (mapJson as { layers: { objects?: MapObject[] }[] }).layers.flatMap(
  (l) => l.objects ?? [],
);
const need = (name: string): MapObject => {
  const o = objects.find((m) => m.name === name);
  if (!o) throw new Error(`map-forest.json has no "${name}"`);
  return o;
};

/** The gap between two rectangles, in game pixels: zero when they touch or overlap. */
const gap = (a: MapObject, b: MapObject): number =>
  Math.hypot(
    Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width)),
    Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height)),
  );

describe('the shortest run the server accepts', () => {
  const pixels = Math.max(0, gap(need('spawn-purple'), need('trigger-cottage')) - 2 * TILE);
  const fastestMs = (pixels / WALK_SPEED) * 1000;

  it('is no longer than the fastest walk from the spawn to the door, so no honest run is refused', () => {
    expect(MIN_RUN_MS, `fastest walk ${Math.round(fastestMs)}ms`).toBeLessThanOrEqual(fastestMs);
  });

  it('is within two seconds of that walk, so it costs a forger real waiting', () => {
    expect(MIN_RUN_MS, `fastest walk ${Math.round(fastestMs)}ms`).toBeGreaterThan(fastestMs - 2000);
  });
});
