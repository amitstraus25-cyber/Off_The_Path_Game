import { describe, expect, it } from 'vitest';
import content from '../../../content/game.v2.json';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import { readForestMap } from '../src/world/map';
import { TILE } from '../src/world/logic';
import { TERRAIN, sketchMap } from '../src/world/minimap';
import { readForks, signFor } from '../src/world/forks';

/*
 * THE FORK SIGNS on the map the game ships (world/forks.ts). Every expectation is read off
 * map-forest.json -- the fork objects, the spawns and the sketch's own path cells -- never a tile
 * written down, so the bounds move with the map and not with the code under test (PAUL_BRIEF trap 5).
 */

const castAt = (spawn: string): string | null =>
  content.characters.find((c) => c.spawn === spawn)?.id ?? null;
const sketch = sketchMap(map, gids, castAt);
const forest = readForestMap(map);
const forkObjects = forest.objects.filter((o) => o.name.startsWith('fork-'));
const props = forest.objects.filter((o) => o.name.startsWith('prop-'));
const forks = readForks(sketch, forkObjects, props);
const cell = (c: number, r: number) => sketch.cells[r * sketch.cols + c];
const spawnOf = (id: string) =>
  forest.objects.find((o) => o.name === content.characters.find((c) => c.id === id)!.spawn)!;

describe('the forks and who lies down each way', () => {
  it('reads every fork the map has, each on the path', () => {
    expect(forks.map((f) => f.name)).toEqual(forkObjects.map((o) => o.name));
    expect(forks.length).toBeGreaterThan(0);
    for (const f of forks) expect(cell(f.col, f.row), f.name).toBe(TERRAIN.path);
  });

  it('reaches every member of the cast from every fork, along the path', () => {
    for (const f of forks)
      expect(f.routes.map((r) => r.id).sort(), f.name).toEqual(
        content.characters.map((c) => c.id).sort(),
      );
  });

  it('points each character the way they actually lie, never the opposite way', () => {
    // The route meanders, but it never arrives on the far side of the fork from its first steps:
    // a heading of `right` means the character's spawn is east of the fork, and so on.
    for (const f of forks)
      for (const r of f.routes) {
        const s = spawnOf(r.id);
        const dx = (s.x + s.width / 2) / TILE - (f.col + 0.5);
        const dy = (s.y + s.height / 2) / TILE - (f.row + 0.5);
        const along = { right: dx, left: -dx, down: dy, up: -dy }[r.heading];
        expect(along, `${f.name} -> ${r.id} (${r.heading})`).toBeGreaterThan(0);
      }
  });

  it('opens with a sign for each branch that has someone down it, and more than one per fork', () => {
    for (const f of forks) {
      const sign = signFor(f, []);
      expect(new Set(sign.map((e) => e.heading)).size, f.name).toBe(sign.length);
      expect(sign.length, f.name).toBeGreaterThan(1);
    }
  });

  it('names the NEAREST unmet character down a heading, and moves on as they are met', () => {
    for (const f of forks) {
      const first = signFor(f, []);
      for (const entry of first) {
        const nearest = f.routes.find((r) => r.heading === entry.heading)!;
        expect(entry.id).toBe(nearest.id);
        const after = signFor(f, [entry.id]).find((e) => e.heading === entry.heading);
        const next = f.routes.find((r) => r.heading === entry.heading && r.id !== entry.id);
        expect(after?.id).toBe(next?.id);
      }
    }
  });

  it('goes blank once everyone has been met', () => {
    const everyone = content.characters.map((c) => c.id);
    for (const f of forks) expect(signFor(f, everyone)).toEqual([]);
  });

  it('can only ever name a character: never the cottage, which is not one', () => {
    const cast = new Set(content.characters.map((c) => c.id));
    for (const f of forks) for (const r of f.routes) expect(cast.has(r.id)).toBe(true);
  });

  it('stands each sign on open lawn beside its fork, off the sand and clear of every prop', () => {
    for (const f of forks) {
      expect(Math.max(Math.abs(f.sign.col - f.col), Math.abs(f.sign.row - f.row))).toBe(1);
      expect(cell(f.sign.col, f.sign.row), f.name).toBe(TERRAIN.open);
      for (const p of props) {
        const inside =
          f.sign.col * TILE < p.x + p.width &&
          (f.sign.col + 1) * TILE > p.x &&
          f.sign.row * TILE < p.y + p.height &&
          (f.sign.row + 1) * TILE > p.y;
        expect(inside, `${f.name} sign under ${p.name}`).toBe(false);
      }
    }
  });
});
