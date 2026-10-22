import { describe, expect, it } from 'vitest';
import mapJson from '../../game/src/assets/map-forest.json';
import { TILE, WALK_SPEED } from '../../game/src/world/logic.ts';
import { v2 } from '@otp/core';
import { content } from './helpers.ts';

/*
 * THE FLOOR THE ROUTE CHARGES, held against the shipped map by a second instrument
 * (PAUL_BRIEF trap 1). It used to be one number, `MIN_RUN_MS` (10 s), for every run; since
 * 2026-10-22 it is `v2.walkFloor`, per run, whose own derivation lives in core's
 * test/v2/floor.test.ts. This one shares no code with that: it measures the gap between the
 * spawn's and the door's RECTANGLES, the way the old floor was measured, and asks that the floor
 * for the walk straight to the door sit within one tile of it -- Purple's feet stand inside the
 * spawn rectangle, so the true straight line is the rectangle gap plus at most a tile.
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
  const rectMs = (gap(need('spawn-purple'), need('trigger-cottage')) / WALK_SPEED) * 1000;
  const direct = v2.walkFloor(content, [{ e: 'arrived', at: 0 }]).floorMs;

  it('charges the walk straight to the door within a tile of the gap between the two rectangles', () => {
    expect(direct, `rectangle gap ${Math.round(rectMs)}ms`).toBeGreaterThanOrEqual(rectMs);
    expect(direct).toBeLessThanOrEqual(rectMs + (TILE / WALK_SPEED) * 1000);
  });

  it('is more than the single ten-second floor it replaced', () => {
    expect(direct).toBeGreaterThan(10_000);
  });
});
