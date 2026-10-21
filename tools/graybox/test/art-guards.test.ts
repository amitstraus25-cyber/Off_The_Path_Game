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
 * Both halves of that are now closed: the workspace has a `test` script, `.github/workflows/ci.yml`
 * runs `pnpm test`, and since this round `tsconfig.json` includes `test`, so the file that arms the
 * guards is itself typechecked rather than only run.
 *
 * So the art could regress to precisely the faults `docs/DESIGN_BOARD.md` names -- a keyline-
 * valued eye, a crown with a flat-cut cap, a fence run that comes apart into links, the
 * twenty-six-tile run of hedge along the bottom of the world -- and typecheck, lint and test
 * would all stay green.
 *
 * (That twenty-six is a MEASURED HEDGE RUN: `forest-map.ts`'s note on the last planting row
 * printed rows 40 and 41 and counted it, and `HEM_LIMIT` in the audit holds it at six today. It
 * is not the abandoned 26-tile camera this round is sweeping out of the tree, and it is spelled
 * out in words here so the next sweep for "26-tile" does not collect it by mistake.)
 *
 * Importing a painter is what runs its guard, so the imports below ARE most of the test. The
 * assertions on top exist so a failure says which number moved rather than only which file threw.
 * Nothing here re-derives a bound: the guards own their own thresholds, and a test that restated
 * them would drift from the thing it claims to watch. Five restatements of other modules' bounds
 * were taken out this round -- two of them already off the number they claimed to mirror -- and
 * each is named, in place, where it used to stand.
 *
 * THE NAMED IMPORTS ARE NOT THE POINT OF THE IMPORTS. Every line in the block below loads a
 * module whose guards run at load. Narrowing one to the names a test happens to use is fine;
 * deleting the line because its names went unused disarms that owner's guard, and is the one way
 * this file can stop doing its job while staying green.
 */
import { describe, expect, it } from 'vitest';

import { CAST_FRAMES } from '../src/sprites/cast.ts';
import { RED_FRAMES } from '../src/sprites/char-red.ts';
import { NPC_PAINTERS } from '../src/sprites.ts';
import { CROWNS, TREE_TILES } from '../src/tiles/w-trees.ts';
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
  /*
   * THREE TESTS STOOD HERE AND EACH RESTATED A BOUND ITS OWN GUARD ALREADY OWNS, against the rule
   * four paragraphs up. Naming them is the version that cannot drift:
   *
   *   - an eye no clearer than the keyline it is outlined in -- design board section 2, where the
   *     rabbit's eyes were `keyline('fur', 165)`, "the identical value the sprite is OUTLINED in".
   *     The floor is `MIN_LIFT` (12) at `sprites/cast.ts:1749`, thrown on in `assertFaceMetrics()`
   *     at :1880. The copy here asked for `> 12` where the guard asks for `>= 12`, so it claimed
   *     to mirror a bound it did not -- and the faces it covered measure 22.6 and 24.7, so the
   *     one value it would have caught alone is a lift of exactly 12.
   *   - an eye taller than it is wide, "the shape a narrowed eye makes". The ceiling is per face,
   *     `FACE_PLAN`'s `maxTall` at `sprites/cast.ts:1711`, thrown on at :1874. The copy here was
   *     an exact mirror of two of the three -- the rabbit and the keeper are capped at 1 -- and
   *     left out the owl, whose cap is 1.4 because an owl's pupil is a disc. So it watched what
   *     the guard already watches and not the face whose number is the interesting one.
   *   - `assertBodyPlans()` and `assertFaceMetrics()` wrapped in `expect(...).not.toThrow()`.
   *     `sprites/cast.ts:1899-1900` calls both at module scope, so importing `CAST_FRAMES` above
   *     has already run them before this file's first test does. The wrapper only changed which
   *     line a failure printed, while reading as the gate it was not.
   */

  it('renders all ten cast frames', () => {
    expect(Object.keys(CAST_FRAMES)).toHaveLength(10);
  });
});

describe('Red', () => {
  /*
   * RED IS IMPORTED DIRECTLY, and that is the point of the line rather than the expectation below.
   *
   * `sprites/char-red.ts` arms FOUR module-scope guards -- `assertContactLine`, `assertRedReads`,
   * `assertCapeDevice` and, since 2026-10-21, `assertBackView`. Until this round the only thing
   * loading that module in CI was `../src/sprites.ts`, imported three lines up for `NPC_PAINTERS`,
   * which reaches Red transitively. That worked, and it is exactly the fragility the header of this
   * file warns about one level down: Red's guards were armed by a side effect of somebody else's
   * import, and dropping `char-red` from `sprites.ts` -- or narrowing that import -- would have
   * disarmed all four of them while every test here stayed green. The protagonist's own painter
   * should not be loaded by accident.
   *
   * The expectation is a CONTRACT and not a bound, which is why writing it out is right here where
   * restating a threshold is wrong: `<facing>-<phase>` is the key format `generate.ts` writes the
   * sheet from and `forest-scene.ts` looks its animations up by, so the sixteen keys have three
   * readers and no owner to drift from. Nothing here re-derives any of the four guards' own
   * numbers; they are stated, with the measurements that chose them, on the guards themselves.
   */
  it('keys all sixteen frames the scene animates her from', () => {
    expect(Object.keys(RED_FRAMES).sort()).toEqual([
      'down-0',
      'down-1',
      'down-2',
      'down-3',
      'left-0',
      'left-1',
      'left-2',
      'left-3',
      'right-0',
      'right-1',
      'right-2',
      'right-3',
      'up-0',
      'up-1',
      'up-2',
      'up-3',
    ]);
  });
});

describe('the sheets generate.ts writes for the spawned characters', () => {
  /*
   * `twoFrame` (`sprites.ts:82-98`) throws at module load for any character missing its open or
   * its blink frame -- seven throws that had run nowhere, because the only two importers of
   * `sprites.ts` are `generate.ts` and `preview.ts` and CI runs neither. The import above is the
   * guard. This says which key list it is holding.
   *
   * The list is a CONTRACT, not a threshold, which is why writing it out here is right where
   * writing out a bound is wrong -- it has no owner to drift from, it has three readers:
   * `generate.ts:60-62` writes one sheet per key and picks the bystanders out of them by prefix,
   * `forest-map.ts` spawns them under the same names, and the scene looks each texture up by that
   * name. Lose or rename one and nothing here fails: the first thing to notice is the asset
   * loader, at boot, in a browser.
   *
   * The wolf is deliberately absent -- he is never spawned from the map, he appears at the
   * cottage, and `generate.ts:60` names him by hand for that reason. This pins his absence too.
   */
  it('keys a two-frame painter for every character the map can spawn', () => {
    expect(Object.keys(NPC_PAINTERS).sort()).toEqual([
      'bystander-cat',
      'bystander-magpie',
      'bystander-snail',
      'bystander-toadstool',
      'npc-lantern-keeper',
      'npc-owl',
      'npc-rabbit',
    ]);
  });
});

describe('the crowns', () => {
  /*
   * THE OTHER TWO RESTATEMENTS STOOD HERE. Both re-measured a crown with `crownEdge` and then
   * checked a bound `tiles/w-trees.ts` throws on at import from that same measurement:
   *
   *   - daylight between the three scales, so the wood is not one stamp (design board section 3,
   *     "One crown at one scale stamped 270 times is why the forest is wallpaper"). The step is
   *     `< 4` at `w-trees.ts:3114-3118`; the copy here wrote the same bound as `> 3`, which over
   *     whole pixels is the identical test spelled so that the two could not be grepped together.
   *   - room above and to the left of the body for `outline()`'s own keyline, so the silhouette
   *     does not render as a flat cut. `w-trees.ts:3093-3097` wants `top >= max(RING_ROWS,
   *     CAP_ROOM)`, which is 2, and each side `>= RING_ROWS`, which is 1; the copy here asked
   *     only for `> 0`. That one was LOOSER than the guard it was watching, so it could never be
   *     the thing that fired -- the sapling that shipped with 18px of crown on row 0 passes it.
   *
   * What is left below is the one thing w-trees does not check about the crowns: how many of
   * them there are.
   */
  it('keeps the wood at three crown scales', () => {
    /*
     * `EDGE_GUARDS` (`w-trees.ts:3063`) lists its three crowns by hand off `CROWNS`, so a fourth
     * crown added to that record is measured by nothing: it misses the width ladder, the rim
     * ceiling and floor and the daylight step, and the message thrown would still say "three
     * crown scales". This count is the only thing watching for that, which is why it is pinned
     * rather than checked for being non-empty.
     */
    expect(Object.keys(CROWNS)).toHaveLength(3);
  });
});

describe('the map', () => {
  /*
   * Section 2's fourth complaint and section 3's first map bullet. The generator runs its own
   * audit and throws on its own invariants -- including the hedge limit added this round -- so
   * generating the map at all is the assertion; the three expectations below only make a failure
   * say which number moved.
   *
   * REACHABILITY IS NOT CHECKED HERE, and the name this test used to carry said it was. It is
   * proved twice and deliberately, in neither case from this file: by the generator's own flood
   * fills before it writes anything (`forest-map.ts`'s audit sections 1 to 5a), and by
   * `apps/game/test/map.test.ts` over the committed artefact, which is the one that treats
   * `trigger-cottage` as a wall so the fill cannot stroll through the thing that ends the run.
   */
  it('generates a map that survives its own audit, at the committed dimensions', () => {
    const { json } = generateForestMap();
    const parsed = JSON.parse(json) as { width: number; height: number; layers: unknown[] };
    expect(parsed.width).toBe(MAP_W);
    expect(parsed.height).toBe(MAP_H);
    expect(parsed.layers.length).toBeGreaterThan(0);
  });

  /*
   * Section 4.10: TILE_NAMES order IS gid order, and a tile added without regenerating the map
   * shifts every tile on it.
   *
   * 81 since 2026-10-21: `gate-n` and `gate-s` were APPENDED at gids 80 and 81, which is the move
   * that renumbers nothing -- every gid in the committed `map-forest.json` keeps its value and the
   * map stays valid exactly as committed. It was 79 the day before, for `notice-board` and
   * `door-note`, on the same terms.
   *
   * The append was verified rather than assumed, three ways, on the regeneration that produced the
   * committed map: no non-zero gid changed value on any layer; the only gid-count deltas are gid 0
   * losing two cells and gids 80 and 81 gaining one each; and all 79 original names keep their
   * original gid in `tileset-forest.gids.json`, with none moved and none removed. The sheet stays
   * 384x224, because `ceil(81 / 12)` is still 7 rows, and both new cells were 100% blank before.
   *
   * This number is not a second opinion; it is the mirror of `TILE_NAMES.length`, and it moves when
   * and only when that list does. The thing it is really watching is an INSERT, which leaves the
   * length looking plausible while repainting the whole map.
   */
  it('keeps the tileset at the gid count the committed map was written against', () => {
    expect(TILE_NAMES).toHaveLength(81);
  });
});
