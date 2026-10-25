import { describe, expect, it } from 'vitest';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import { blocked, moveWithCollision, TILE } from '../src/world/logic';
import type { CollisionMap, Rect, Vec } from '../src/world/logic';
import { findObject, readForestMap } from '../src/world/map';
import {
  centreOf,
  gateBump,
  gateCells,
  gateLayerName,
  GATE_LOCKED_FALLBACK,
  GATE_NOTICE_COOLDOWN_MS,
  GATE_OBJECT,
  GATE_OPEN_PREFIX,
  GATE_SHUT_PREFIX,
  gatePairs,
  landingSpot,
  LANDING_OBJECT,
  loweredWidth,
  LOWER_MS,
  shutGate,
} from '../src/world/gate';

/*
 * THE GATE ON THE BRIDGE AND THE WING RIDE'S LANDING (docs/GATEKEEPER.md), as pure code: which cells
 * the gate covers, the collision map that keeps it shut, what counts as a bump, which tile layer
 * carries the picture, how the drawbridge falls, where a flight lands. Fixtures first, so these pass
 * whatever the shipped map holds; the last block holds the shipped map to the contract.
 */

/** An all-grass world: `width` x `height` tiles, nothing solid. */
const meadow = (width: number, height: number): CollisionMap => ({
  width,
  height,
  tiles: new Array<number>(width * height).fill(0),
});

/** A gate one tile wide and two tall at column 5, rows 1 and 2, on a 12 x 4 meadow. */
const gate: Rect = { x: 5 * TILE, y: 1 * TILE, width: TILE, height: 2 * TILE };

/** Purple's feet for a tile column and a row, standing in the lower part of the row. */
const feet = (col: number, row: number): Vec => ({ x: (col + 0.5) * TILE, y: (row + 0.75) * TILE });

/** Walks `steps` steps of (dx, dy) over a map, as the scene's `move` does. */
function walk(collision: CollisionMap, from: Vec, dx: number, dy: number, steps: number): Vec {
  let at = from;
  for (let i = 0; i < steps; i++) at = moveWithCollision(collision, at, dx, dy);
  return at;
}

describe('which cells the gate covers', () => {
  it('is every tile the rectangle touches, row by row', () => {
    expect(gateCells(gate)).toEqual([
      { col: 5, row: 1 },
      { col: 5, row: 2 },
    ]);
    expect(gateCells({ x: 2 * TILE, y: 0, width: 2 * TILE, height: TILE })).toEqual([
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ]);
  });

  it('does not take a tile the rectangle only ends on', () => {
    expect(gateCells({ x: 0, y: 0, width: TILE, height: TILE })).toEqual([{ col: 0, row: 0 }]);
    // One pixel into the next tile is in it.
    expect(gateCells({ x: 0, y: 0, width: TILE + 1, height: TILE })).toHaveLength(2);
  });
});

describe('the gate, shut', () => {
  const open = meadow(12, 4);
  const shut = shutGate(open, gate);

  it('makes the gate cells solid and changes nothing else', () => {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 12; col++) {
        const here = shut.tiles[row * 12 + col]!;
        expect(here !== 0, `(${col},${row})`).toBe(col === 5 && (row === 1 || row === 2));
      }
  });

  it('is a copy: the open bridge the map read is untouched', () => {
    expect(open.tiles.every((t) => t === 0)).toBe(true);
    expect(shut.tiles).not.toBe(open.tiles);
  });

  it('keeps a cell the map already made solid, and ignores a cell off the map', () => {
    const wall = { ...open, tiles: open.tiles.map((t, i) => (i === 1 * 12 + 5 ? 7 : t)) };
    expect(shutGate(wall, gate).tiles[1 * 12 + 5]).not.toBe(0);
    const off = shutGate(open, { x: 40 * TILE, y: 40 * TILE, width: TILE, height: TILE });
    expect(off.tiles).toEqual(open.tiles);
  });

  it('stops Purple walking east into it, and lets her through once it is open', () => {
    const start = feet(2, 1);
    const stopped = walk(shut, start, 1, 0, 400);
    // Her foot box ends at the gate's west edge and never crosses it.
    expect(stopped.x).toBeLessThan(5 * TILE);
    expect(stopped.x).toBeGreaterThan(start.x);
    const through = walk(open, start, 1, 0, 400);
    expect(through.x).toBeGreaterThan(6 * TILE);
  });

  it('is solid to her foot box from above and below too, but not beside it', () => {
    expect(blocked(shut, feet(5, 1).x, feet(5, 1).y)).toBe(true);
    expect(blocked(shut, feet(5, 2).x, feet(5, 2).y)).toBe(true);
    expect(blocked(shut, feet(4, 1).x, feet(4, 1).y)).toBe(false);
    expect(blocked(shut, feet(6, 1).x, feet(6, 1).y)).toBe(false);
    expect(blocked(shut, feet(5, 3).x, feet(5, 3).y)).toBe(false);
  });
});

describe('a bump against the shut gate', () => {
  const open = meadow(12, 4);
  const shut = shutGate(open, gate);

  it('is a step that goes on the open bridge and not on the shut one', () => {
    // Her foot box's east edge is 5/16 of a tile from her centre: standing so it is a hair short of
    // the gate, one step east runs into it.
    const at = { x: 5 * TILE - (5 / 16) * TILE - 0.1, y: (1 + 0.75) * TILE };
    expect(gateBump(open, shut, at, 1, 0)).toBe(true);
    expect(gateBump(open, shut, at, 0, 1)).toBe(false);
  });

  it('is not a bump while she is still a stride away, nor a step away from it', () => {
    expect(gateBump(open, shut, feet(2, 1), 1, 0)).toBe(false);
    const at = { x: 5 * TILE - (5 / 16) * TILE - 0.1, y: (1 + 0.75) * TILE };
    expect(gateBump(open, shut, at, -1, 0)).toBe(false);
  });

  it('is not a bump when the step was stopped by something that is not the gate', () => {
    const tree = { ...open, tiles: open.tiles.map((t, i) => (i === 1 * 12 + 3 ? 1 : t)) };
    const treeShut = shutGate(tree, gate);
    const at = { x: 3 * TILE - (5 / 16) * TILE - 0.1, y: (1 + 0.75) * TILE };
    expect(blocked(treeShut, at.x + 1, at.y)).toBe(true);
    expect(gateBump(tree, treeShut, at, 1, 0)).toBe(false);
  });

  it('is nothing once the gate is the open bridge on both sides', () => {
    const at = { x: 5 * TILE - (5 / 16) * TILE - 0.1, y: (1 + 0.75) * TILE };
    expect(gateBump(open, open, at, 1, 0)).toBe(false);
  });

  it('says its words once per cooldown, and the words are the contract wording', () => {
    expect(GATE_NOTICE_COOLDOWN_MS).toBeGreaterThan(1000);
    expect(GATE_LOCKED_FALLBACK).toBe('The gate is locked. The Gatekeeper has the key.');
  });
});

describe('the layer that carries the gate picture', () => {
  const cells = gateCells(gate);
  const SHUT = 900;
  const layers = (data: Record<string, number[]>) => ({
    width: 12,
    layers: [
      { name: 'collision', type: 'tilelayer', data: new Array<number>(48).fill(SHUT) },
      ...Object.entries(data).map(([name, d]) => ({ name, type: 'tilelayer', data: d })),
      { name: 'objects', type: 'objectgroup' },
    ],
  });
  const blank = () => new Array<number>(48).fill(0);
  const at = (col: number, row: number) => row * 12 + col;

  it('is the layer with the shut gate on the gate cells, wherever the painter put it', () => {
    const overlay = blank();
    overlay[at(5, 1)] = SHUT;
    overlay[at(5, 2)] = SHUT;
    expect(
      gateLayerName(layers({ ground: blank(), 'bridge-overlay': overlay }), cells, [SHUT]),
    ).toBe('bridge-overlay');
    const below = blank();
    below[at(5, 2)] = SHUT;
    expect(gateLayerName(layers({ ground: blank(), 'decor-below': below }), cells, [SHUT])).toBe(
      'decor-below',
    );
  });

  it('is found by ANY of the raised tiles: a drawbridge has one per kind of deck column', () => {
    const below = blank();
    below[at(5, 2)] = 902;
    expect(gateLayerName(layers({ 'decor-below': below }), cells, [SHUT, 901, 902])).toBe(
      'decor-below',
    );
    expect(gateLayerName(layers({ 'decor-below': below }), cells, [SHUT, 901])).toBeNull();
  });

  it('never the collision layer, which may hold any non-zero number', () => {
    expect(gateLayerName(layers({ ground: blank() }), cells, [SHUT])).toBeNull();
  });

  it('is null for a map from before the gate, so nothing is swapped and nothing crashes', () => {
    expect(gateLayerName(layers({}), cells, [SHUT])).toBeNull();
    expect(gateLayerName({ width: 12, layers: [] }, cells, [SHUT])).toBeNull();
    // A layer with no data (an image layer, an empty one) is skipped, not read.
    expect(
      gateLayerName({ width: 12, layers: [{ name: 'x', type: 'tilelayer' }] }, cells, [SHUT]),
    ).toBeNull();
  });

  it('reads a layer by its own width when it has one', () => {
    const narrow = new Array<number>(4 * 8).fill(0);
    narrow[1 * 8 + 5] = SHUT;
    expect(
      gateLayerName(
        { width: 12, layers: [{ name: 'o', type: 'tilelayer', width: 8, data: narrow }] },
        [{ col: 5, row: 1 }],
        [SHUT],
      ),
    ).toBe('o');
  });
});

describe("the drawbridge's tiles, a raised and a lowered one per kind of deck column", () => {
  it('pairs shut-<n> with open-<n> from 0 upward', () => {
    const table = {
      [`${GATE_SHUT_PREFIX}0`]: 10,
      [`${GATE_OPEN_PREFIX}0`]: 11,
      [`${GATE_SHUT_PREFIX}1`]: 12,
      [`${GATE_OPEN_PREFIX}1`]: 13,
      grass: 1,
    };
    expect(gatePairs(table)).toEqual([
      { shut: 10, open: 11 },
      { shut: 12, open: 13 },
    ]);
  });

  it('stops at the first n missing either half, and a tileset without them has none', () => {
    expect(gatePairs({ [`${GATE_SHUT_PREFIX}0`]: 10 })).toEqual([]);
    expect(
      gatePairs({
        [`${GATE_SHUT_PREFIX}0`]: 10,
        [`${GATE_OPEN_PREFIX}0`]: 11,
        [`${GATE_OPEN_PREFIX}1`]: 13,
        [`${GATE_SHUT_PREFIX}2`]: 14,
        [`${GATE_OPEN_PREFIX}2`]: 15,
      }),
    ).toEqual([{ shut: 10, open: 11 }]);
    expect(gatePairs({ grass: 1 })).toEqual([]);
  });
});

describe('the drawbridge coming down', () => {
  const width = 160;

  it('starts standing up and ends lying across the whole span', () => {
    expect(loweredWidth(0, width)).toBe(0);
    expect(loweredWidth(LOWER_MS, width)).toBe(width);
    expect(loweredWidth(LOWER_MS * 3, width)).toBe(width);
    expect(loweredWidth(-50, width)).toBe(0);
  });

  it('only ever grows, in whole pixels, and falls fastest as it lands', () => {
    const steps = Array.from({ length: 33 }, (_, i) => loweredWidth((LOWER_MS * i) / 32, width));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!).toBeGreaterThanOrEqual(steps[i - 1]!);
      expect(Number.isInteger(steps[i]!)).toBe(true);
    }
    // Slow off the top: the first quarter of the time covers less than the last quarter.
    const first = loweredWidth(LOWER_MS / 4, width);
    const last = width - loweredWidth((LOWER_MS * 3) / 4, width);
    expect(first).toBeLessThan(last);
  });

  it('is brief: long enough to see, never long enough to wait on', () => {
    expect(LOWER_MS).toBeGreaterThanOrEqual(300);
    expect(LOWER_MS).toBeLessThanOrEqual(1000);
  });

  it('is down at once when given no time to fall', () => {
    expect(loweredWidth(0, width, 0)).toBe(width);
  });
});

describe('where the wing ride lands', () => {
  const open = meadow(12, 6);
  const centre = { x: 6.5 * TILE, y: 3.5 * TILE };

  it('is the landing point itself when she can stand there', () => {
    expect(landingSpot(open, centre)).toEqual(centre);
  });

  it('is the nearest free place when the point was left in a tree', () => {
    const tiles = [...open.tiles];
    // Solid on the point's own tile and the tile below it: the next try, to the west, is free.
    tiles[3 * 12 + 6] = 1;
    tiles[4 * 12 + 6] = 1;
    const spot = landingSpot({ ...open, tiles }, centre);
    expect(blocked({ ...open, tiles }, spot.x, spot.y)).toBe(false);
    expect(Math.hypot(spot.x - centre.x, spot.y - centre.y)).toBeLessThanOrEqual(TILE * 2);
  });

  it('is the point when nowhere near it is free: a landing is never refused', () => {
    const wall = { ...open, tiles: open.tiles.map(() => 1) };
    expect(landingSpot(wall, centre)).toEqual(centre);
  });

  it('reads a point as itself and a rectangle as its middle', () => {
    expect(centreOf({ x: 100, y: 50, width: 0, height: 0 })).toEqual({ x: 100, y: 50 });
    expect(centreOf({ x: 96, y: 48, width: 16, height: 16 })).toEqual({ x: 104, y: 56 });
  });
});

/*
 * THE SHIPPED MAP, against the contract (docs/GATEKEEPER.md and the drawbridge change): the span's
 * cells walkable in `collision`, a raised tile on every one of them, and a landing past it.
 */
describe('the shipped map, against the contract', () => {
  const forest = readForestMap(map);
  const table = gids as Record<string, number>;
  const gateRect = findObject(forest, GATE_OBJECT);
  const landing = findObject(forest, LANDING_OBJECT);

  it('has the gate and the landing', () => {
    expect(gateRect, GATE_OBJECT).toBeDefined();
    expect(landing, LANDING_OBJECT).toBeDefined();
  });

  it('leaves the gate cells walkable: the game is what shuts them', () => {
    for (const { col, row } of gateCells(gateRect!))
      expect(forest.collision.tiles[row * forest.collision.width + col], `(${col},${row})`).toBe(0);
  });

  it('has the three raised/lowered pairs, and a raised tile on EVERY cell of the span', () => {
    const pairs = gatePairs(table);
    expect(pairs).toHaveLength(3);
    const tiled = map as unknown as {
      width: number;
      layers: { name: string; type: string; data?: number[] }[];
    };
    const name = gateLayerName(
      tiled,
      gateCells(gateRect!),
      pairs.map((p) => p.shut),
    );
    expect(name, 'no tile layer draws the raised drawbridge').not.toBeNull();
    const data = tiled.layers.find((l) => l.name === name)!.data!;
    const shut = gateCells(gateRect!).map(({ col, row }) => data[row * tiled.width + col]!);
    for (const gid of shut) expect(pairs.map((p) => p.shut)).toContain(gid);
    // West end, open river, east end: each kind is used, west to east.
    const firstRow = shut.slice(
      0,
      gateCells(gateRect!).filter((c) => c.row === gateCells(gateRect!)[0]!.row).length,
    );
    expect(firstRow[0]).toBe(pairs[0]!.shut);
    expect(firstRow.at(-1)).toBe(pairs[2]!.shut);
    for (const gid of firstRow.slice(1, -1)) expect(gid).toBe(pairs[1]!.shut);
  });

  it('keeps Purple out until it opens: a walk along the bridge stops at the gate', () => {
    const shut = shutGate(forest.collision, gateRect!);
    const mid = centreOf(gateRect!);
    // Standing one tile west of the gate's middle, walking east, she stops short of it when shut
    // and gets through when the map's own (open) collision is what she walks on.
    const start = { x: gateRect!.x - TILE, y: mid.y + TILE / 4 };
    expect(blocked(forest.collision, start.x, start.y), 'the start is on the bridge').toBe(false);
    expect(walk(shut, start, 1, 0, 300).x).toBeLessThan(gateRect!.x);
    expect(walk(forest.collision, start, 1, 0, 300).x).toBeGreaterThan(
      gateRect!.x + gateRect!.width,
    );
  });

  it('has a wing landing she can stand on', () => {
    const spot = landingSpot(forest.collision, centreOf(landing!));
    expect(blocked(forest.collision, spot.x, spot.y)).toBe(false);
    // The landing is what the contract says it is: on the east bank, past the gate.
    expect(spot.x).toBeGreaterThan(gateRect!.x + gateRect!.width);
  });
});
