import { describe, expect, it } from 'vitest';
import content from '../../../content/game.v2.json';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import { readForestMap } from '../src/world/map';
import { TILE } from '../src/world/logic';
import { TERRAIN, pathFor, sketchMap, terrainRuns } from '../src/world/minimap';

/*
 * THE MINIMAP'S PICTURE, against the map the game ships (world/minimap.ts). Every expected value
 * here is read off map-forest.json and the content's cast -- never a number written down -- so the
 * bounds move with the map and not with the code under test (PAUL_BRIEF trap 5).
 */

/** Who stands at a spawn, exactly as the scene asks it (world/run.ts `castOf`). */
const castAt = (spawn: string): string | null =>
  content.characters.find((c) => c.spawn === spawn)?.id ?? null;

const sketch = sketchMap(map, gids, castAt);
const forest = readForestMap(map);
const object = (name: string) => forest.objects.find((o) => o.name === name)!;

describe('the minimap is drawn from the map the game loaded', () => {
  it('is the map at one cell a tile', () => {
    expect(sketch.cols).toBe(map.width);
    expect(sketch.rows).toBe(map.height);
    expect(sketch.cells).toHaveLength(map.width * map.height);
  });

  it('puts every one of the cast on their own spawn, and nobody else', () => {
    expect(sketch.cast.map((c) => c.id).sort()).toEqual(content.characters.map((c) => c.id).sort());
    for (const who of sketch.cast) {
      const spawn = object(content.characters.find((c) => c.id === who.id)!.spawn);
      expect(who.col, who.id).toBe((spawn.x + spawn.width / 2) / TILE);
      expect(who.row, who.id).toBe((spawn.y + spawn.height / 2) / TILE);
    }
  });

  it('marks the cottage where the map stands it', () => {
    const facade = object('prop-cottage');
    expect(sketch.cottage).toEqual({
      x: facade.x / TILE,
      y: facade.y / TILE,
      width: facade.width / TILE,
      height: facade.height / TILE,
    });
  });

  it('carries nothing about a skill: a dot is an id and a place', () => {
    for (const who of sketch.cast) expect(Object.keys(who).sort()).toEqual(['col', 'id', 'row']);
    expect(JSON.stringify(sketch)).not.toMatch(/good|bad|skill/i);
  });

  it('agrees with the collision layer: path and open ground are walkable, blocked is not', () => {
    const solid = (i: number) => forest.collision.tiles[i] !== 0;
    sketch.cells.forEach((kind, i) => {
      if (kind === TERRAIN.open || kind === TERRAIN.path) expect(solid(i), `cell ${i}`).toBe(false);
      if (kind === TERRAIN.blocked) expect(solid(i), `cell ${i}`).toBe(true);
    });
    // The map has all four kinds, so the picture has its landmarks.
    for (const kind of Object.values(TERRAIN)) expect(sketch.cells).toContain(kind);
    // Purple starts on ground she can walk on.
    const spawn = object('spawn-purple');
    const start = (spawn.y / TILE) * sketch.cols + spawn.x / TILE;
    expect(sketch.cells[start]).not.toBe(TERRAIN.blocked);
  });

  it('reads the path from the tile names, flip bits and all', () => {
    // Every ground cell whose tile is named path-* or bridge-* is drawn as path, unless the cell
    // is solid -- the same rule, applied by a different hand from the one under test.
    const nameOf = new Map(Object.entries(gids).map(([name, gid]) => [gid, name]));
    const ground = map.layers.find((l) => l.name === 'ground')!.data!;
    let paths = 0;
    let water = 0;
    let flipped = 0;
    ground.forEach((gid, i) => {
      if (gid > 0x1fffffff) flipped++;
      const name = nameOf.get(gid & 0x1fffffff) ?? '';
      if (/^(path|bridge)/.test(name) && forest.collision.tiles[i] === 0) {
        paths++;
        expect(sketch.cells[i], `cell ${i} (${name})`).toBe(TERRAIN.path);
      }
      // The stream is painted flipped as often as not, which is what the flip bits are about.
      if (/^(water|shore|waterfall)/.test(name)) {
        water++;
        expect(sketch.cells[i], `cell ${i} (${name})`).toBe(TERRAIN.water);
      }
    });
    expect(sketch.cells.filter((k) => k === TERRAIN.path)).toHaveLength(paths);
    expect(sketch.cells.filter((k) => k === TERRAIN.water)).toHaveLength(water);
    expect(
      flipped,
      'the map has flipped tiles, so this test can see a missing mask',
    ).toBeGreaterThan(0);
  });

  it('refuses a map without the layers it needs rather than drawing nothing', () => {
    expect(() => sketchMap({ width: 1, height: 1, layers: [] }, gids, castAt)).toThrow();
    const noCottage = {
      ...map,
      layers: map.layers.map((l) =>
        l.type === 'objectgroup'
          ? { ...l, objects: (l.objects ?? []).filter((o) => o.name !== 'prop-cottage') }
          : l,
      ),
    };
    expect(() => sketchMap(noCottage, gids, castAt)).toThrow(/prop-cottage/);
  });
});

describe('the runs the SVG paints', () => {
  it('cover exactly the painted cells, once each', () => {
    const runs = terrainRuns(sketch);
    const painted = sketch.cells.filter((k) => k !== TERRAIN.blocked).length;
    expect(runs.reduce((n, r) => n + r.length, 0)).toBe(painted);
    for (const r of runs) {
      expect(r.kind).not.toBe(TERRAIN.blocked);
      for (let x = r.x; x < r.x + r.length; x++)
        expect(sketch.cells[r.y * sketch.cols + x]).toBe(r.kind);
    }
  });

  it('merge a row of one kind into one rectangle', () => {
    const tiny = { cols: 4, rows: 1, cells: [1, 1, 0, 2] as const };
    expect(terrainRuns(tiny)).toEqual([
      { kind: 1, x: 0, y: 0, length: 2 },
      { kind: 2, x: 3, y: 0, length: 1 },
    ]);
    expect(pathFor(terrainRuns(tiny), TERRAIN.open)).toBe('M0 0h2v1h-2z');
    expect(pathFor(terrainRuns(tiny), TERRAIN.water)).toBe('');
  });
});
