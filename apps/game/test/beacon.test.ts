import { describe, expect, it } from 'vitest';
import { bearing } from '../src/world/beacon';
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
