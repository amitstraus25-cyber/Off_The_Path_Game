import { describe, expect, it } from 'vitest';
import { bearing, beaconAngle } from '../src/world/beacon';
import { TILE } from '../src/world/logic';

describe('bearing: which way, and how far, in the words contract', () => {
  const at = { x: 0, y: 0 };
  it('names the eight sectors clockwise from north', () => {
    expect(bearing(at, { x: 0, y: -100 }).sector).toBe(0);
    expect(bearing(at, { x: 100, y: -100 }).sector).toBe(1);
    expect(bearing(at, { x: 100, y: 0 }).sector).toBe(2);
    expect(bearing(at, { x: 0, y: 100 }).sector).toBe(4);
    expect(bearing(at, { x: -100, y: 0 }).sector).toBe(6);
    expect(bearing(at, { x: -100, y: -100 }).sector).toBe(7);
  });
  it('bands the distance: a few steps, a short walk, a long way off', () => {
    expect(bearing(at, { x: 2 * TILE, y: 0 }).band).toBe(0);
    expect(bearing(at, { x: 8 * TILE, y: 0 }).band).toBe(1);
    expect(bearing(at, { x: 30 * TILE, y: 0 }).band).toBe(2);
  });
});

describe('beaconAngle: the arrow only when nobody unmet is in view', () => {
  const view = { x: 0, y: 0, width: 600, height: 300 };
  const purple = { x: 300, y: 150 };
  it('is quiet with nobody unmet, or with one already on screen', () => {
    expect(beaconAngle(purple, view, [])).toBeNull();
    expect(
      beaconAngle(purple, view, [
        { x: 500, y: 100 },
        { x: 2000, y: 150 },
      ]),
    ).toBeNull();
  });
  it('points at the nearest unmet character when all are off screen', () => {
    const east = beaconAngle(purple, view, [
      { x: 900, y: 150 },
      { x: 300, y: -2000 },
    ]);
    expect(east).toBeCloseTo(0);
    const south = beaconAngle(purple, view, [
      { x: 300, y: 700 },
      { x: 3000, y: 150 },
    ]);
    expect(south).toBeCloseTo(Math.PI / 2);
  });
});
