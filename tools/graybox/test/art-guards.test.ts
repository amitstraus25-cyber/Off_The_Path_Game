/*
 * The art's guards, in CI.
 *
 * WHY THIS FILE EXISTS. Five owners independently built import-time guards into their painters
 * this round -- `assertBodyPlans()` and `assertFaceMetrics()` in `sprites/cast.ts`, three crown
 * guards in `tiles/w-trees.ts`, a four-check undergrowth guard in `tiles/w-undergrowth.ts`, a
 * fence-run guard in `tiles/s-outdoor.ts`, a plume-and-knobs guard in `tiles/s-cottage.ts`, and
 * a hedge invariant inside `forest-map.ts`'s own audit. Every one of them is good work and every
 * one of them fired in CI exactly never: `tools/graybox` had no `test` script, so the root's
 * `pnpm -r --if-present test` skipped this workspace entirely, and `.github/workflows/ci.yml`
 * does not run `pnpm graybox`. A module-load throw only throws when something loads the module.
 *
 * So the art could regress to precisely the faults `docs/DESIGN_BOARD.md` names -- a keyline-
 * valued eye, a crown with a flat-cut cap, a fence run that comes apart into links, a 26-tile
 * hedge along the bottom of the world -- and typecheck, lint and test would all stay green.
 *
 * Importing a painter is what runs its guard, so the imports below ARE most of the test. The
 * assertions on top exist so a failure says which number moved rather than only which file threw.
 * Nothing here re-derives a bound: the guards own their own thresholds, and a test that restated
 * them would drift from the thing it claims to watch.
 */
import { describe, expect, it } from 'vitest';

import {
  assertBodyPlans,
  assertFaceMetrics,
  CAST_FRAMES,
  measureFace,
} from '../src/sprites/cast.ts';
import { crownEdge, CROWNS, TREE_TILES } from '../src/tiles/w-trees.ts';
import { UNDERGROWTH_TILES } from '../src/tiles/w-undergrowth.ts';
import { OUTDOOR_TILES } from '../src/tiles/s-outdoor.ts';
import { COTTAGE_TILES } from '../src/tiles/s-cottage.ts';
import { TILE_NAMES, TILE_PAINTERS } from '../src/tiles.ts';
import { generateForestMap, MAP_H, MAP_W } from '../src/forest-map.ts';

describe('the painters load, which is what runs their import-time guards', () => {
  it('paints every tile in TILE_NAMES', () => {
    const missing = TILE_NAMES.filter((n) => !TILE_PAINTERS[n]);
    expect(missing).toEqual([]);
  });

  it('keeps every tile set reachable', () => {
    for (const set of [TREE_TILES, UNDERGROWTH_TILES, OUTDOOR_TILES, COTTAGE_TILES])
      expect(Object.keys(set).length).toBeGreaterThan(0);
    expect(Object.keys(CROWNS).length).toBeGreaterThan(0);
  });
});

describe('the cast and its faces', () => {
  it('passes its own body and face guards', () => {
    expect(() => assertBodyPlans()).not.toThrow();
    expect(() => assertFaceMetrics()).not.toThrow();
  });

  /*
   * Design board section 2: the rabbit's eyes were `keyline('fur', 165)`, "the identical value the
   * sprite is OUTLINED in", which is why the face read as perforated. The guard holds a floor of
   * 12 luma; this says out loud which sprite it is about and prints the number on failure.
   */
  it('keeps every eye clear of the sprite it is outlined in', () => {
    for (const name of ['npc-rabbit-0', 'npc-owl-0', 'npc-lantern-keeper-0'])
      expect(measureFace(name).lift, `${name} eye-to-keyline luma`).toBeGreaterThan(12);
  });

  /* Section 2 again: "a 3 x 4 solid ellipse, taller than it is wide, which is the shape a narrowed
   * eye makes". No face in the cast may go back to that. */
  it('keeps no eye taller than it is wide', () => {
    for (const name of ['npc-rabbit-0', 'npc-lantern-keeper-0'])
      expect(measureFace(name).tall, `${name} eye height over its own width`).toBeLessThanOrEqual(
        1,
      );
  });

  it('renders all ten cast frames', () => {
    expect(Object.keys(CAST_FRAMES)).toHaveLength(10);
  });
});

describe('the crowns', () => {
  /*
   * Section 3: "One crown at one scale stamped 270 times is why the forest is wallpaper."
   * Three scales, strictly increasing, is the thing that must not quietly become two.
   */
  it('keeps three distinct crown scales', () => {
    const widths = Object.values(CROWNS)
      .map((c) => crownEdge(c.img()).width)
      .sort((a, b) => a - b);
    expect(widths).toHaveLength(3);
    expect(widths[1]! - widths[0]!).toBeGreaterThan(3);
    expect(widths[2]! - widths[1]!).toBeGreaterThan(3);
  });

  /* Section 4.2: the ring is shared and must stay closed, so `outline()` always has a row to put
   * the keyline on. The sapling shipped with 18 px of crown on row 0 of its own drawing. */
  it('leaves every crown room for its own keyline', () => {
    for (const [name, c] of Object.entries(CROWNS)) {
      const e = crownEdge(c.img());
      expect(e.top, `${name} rows clear above the body`).toBeGreaterThan(0);
      expect(e.left, `${name} columns clear left of the body`).toBeGreaterThan(0);
    }
  });
});

describe('the map', () => {
  /*
   * Section 2's fourth complaint and section 3's first map bullet. The generator runs its own
   * audit and throws on its own invariants -- including the hedge limit added this round -- so
   * generating the map at all is the assertion. The reachability check is here because the
   * level's whole zero-click lesson depends on the gate being walkable.
   */
  it('generates and audits a map whose walkable tiles are all reachable', () => {
    const { json } = generateForestMap();
    const parsed = JSON.parse(json) as { width: number; height: number; layers: unknown[] };
    expect(parsed.width).toBe(MAP_W);
    expect(parsed.height).toBe(MAP_H);
    expect(parsed.layers.length).toBeGreaterThan(0);
  });

  /* Section 4.10: TILE_NAMES order IS gid order, and a tile added without regenerating the map
   * shifts every tile on it. 77 is what the committed tileset and map agree on. */
  it('keeps the tileset at the gid count the committed map was written against', () => {
    expect(TILE_NAMES).toHaveLength(77);
  });
});
