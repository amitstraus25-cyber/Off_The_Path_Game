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
  GATE_OPEN_TILE,
  GATE_SHUT_TILE,
  landingSpot,
  LANDING_OBJECT,
  shutGate,
} from '../src/world/gate';

/*
 * THE GATE ON THE BRIDGE AND THE WING RIDE'S LANDING (docs/GATEKEEPER.md), as pure code: which cells
 * the gate covers, the collision map that keeps it shut, what counts as a bump, which tile layer
 * carries the picture, where a flight lands. Fixtures first, so these pass whatever the shipped map
 * holds; the last block reads the shipped map and is skipped, by name, until the map has the gate.
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
    expect(gateLayerName(layers({ ground: blank(), 'bridge-overlay': overlay }), cells, SHUT)).toBe(
      'bridge-overlay',
    );
    const below = blank();
    below[at(5, 2)] = SHUT;
    expect(gateLayerName(layers({ ground: blank(), 'decor-below': below }), cells, SHUT)).toBe(
      'decor-below',
    );
  });

  it('never the collision layer, which may hold any non-zero number', () => {
    expect(gateLayerName(layers({ ground: blank() }), cells, SHUT)).toBeNull();
  });

  it('is null for a map from before the gate, so nothing is swapped and nothing crashes', () => {
    expect(gateLayerName(layers({}), cells, SHUT)).toBeNull();
    expect(gateLayerName({ width: 12, layers: [] }, cells, SHUT)).toBeNull();
    // A layer with no data (an image layer, an empty one) is skipped, not read.
    expect(
      gateLayerName({ width: 12, layers: [{ name: 'x', type: 'tilelayer' }] }, cells, SHUT),
    ).toBeNull();
  });

  it('reads a layer by its own width when it has one', () => {
    const narrow = new Array<number>(4 * 8).fill(0);
    narrow[1 * 8 + 5] = SHUT;
    expect(
      gateLayerName(
        { width: 12, layers: [{ name: 'o', type: 'tilelayer', width: 8, data: narrow }] },
        [{ col: 5, row: 1 }],
        SHUT,
      ),
    ).toBe('o');
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
 * THE SHIPPED MAP. The gate, its two tiles, the landing and the Gatekeeper arrive with the map
 * builder's change; until then these are skipped, by name, and then they hold it to the contract.
 */
describe('the shipped map, against the contract', () => {
  const forest = readForestMap(map);
  const table = gids as Record<string, number>;
  const gateRect = findObject(forest, GATE_OBJECT);
  const landing = findObject(forest, LANDING_OBJECT);
  const hasGate = gateRect !== undefined;

  it.skipIf(!hasGate)('leaves the gate cells walkable: the game is what shuts them', () => {
    for (const { col, row } of gateCells(gateRect!))
      expect(forest.collision.tiles[row * forest.collision.width + col], `(${col},${row})`).toBe(0);
  });

  it.skipIf(!hasGate)('has both gate tiles, and the shut one drawn on the gate cells', () => {
    expect(table[GATE_SHUT_TILE]).toBeDefined();
    expect(table[GATE_OPEN_TILE]).toBeDefined();
    const name = gateLayerName(
      map as unknown as Parameters<typeof gateLayerName>[0],
      gateCells(gateRect!),
      table[GATE_SHUT_TILE]!,
    );
    expect(name, 'no tile layer draws the shut gate').not.toBeNull();
  });

  it.skipIf(!hasGate)(
    'keeps Purple out until it opens: a walk along the bridge stops at the gate',
    () => {
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
    },
  );

  it.skipIf(landing === undefined)('has a wing landing she can stand on', () => {
    const spot = landingSpot(forest.collision, centreOf(landing!));
    expect(blocked(forest.collision, spot.x, spot.y)).toBe(false);
    // The landing is what the contract says it is: on the east bank, past the gate.
    if (hasGate) expect(spot.x).toBeGreaterThan(gateRect!.x + gateRect!.width);
  });
});
