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
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Img } from '../src/paint.ts';
import { svgCoverage } from '../src/svg-coverage.ts';

import { CAST_FRAMES } from '../src/sprites/cast.ts';
import { CAPE_MARK, PURPLE_FRAMES } from '../src/sprites/char-purple.ts';
import {
  FX_SHEETS,
  HOP_FRAMES,
  IDLE_FRAMES,
  ITEM_PAINTERS,
  LIFE_KEYS,
  NPC_PAINTERS,
  paintFxSheet,
  paintHopSheet,
  paintIdleSheet,
  paintNpcSheet,
  PORTRAIT_SIZE,
} from '../src/sprites.ts';
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

  // Twelve since 2026-10-25: the Gatekeeper's two (`npc-gatekeeper-0`, `-1`, sprites/gatekeeper.ts)
  // joined the cast when the toadstool became him and left `BYSTANDER_FRAMES` (docs/GATEKEEPER.md).
  it('renders all twelve cast frames', () => {
    expect(Object.keys(CAST_FRAMES)).toHaveLength(12);
  });
});

describe('Purple', () => {
  /*
   * PURPLE IS IMPORTED DIRECTLY, and that is the point of the line rather than the expectation below.
   *
   * `sprites/char-purple.ts` arms FOUR module-scope guards -- `assertContactLine`, `assertPurpleReads`,
   * `assertCapeDevice` and, since 2026-10-21, `assertBackView`. Until this round the only thing
   * loading that module in CI was `../src/sprites.ts`, imported three lines up for `NPC_PAINTERS`,
   * which reaches Purple transitively. That worked, and it is exactly the fragility the header of this
   * file warns about one level down: Purple's guards were armed by a side effect of somebody else's
   * import, and dropping `char-purple` from `sprites.ts` -- or narrowing that import -- would have
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
    expect(Object.keys(PURPLE_FRAMES).sort()).toEqual([
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

  /*
   * THE MARK ON HER BACK IS THE CYERA SYMBOL, TRACED -- held to the official SVG, not to the grid
   * that draws it. This is the one bound in this file that no painter's guard owns, which is why it
   * is here: `assertCapeDevice` checks that the frame shows the drawing intact, and only this checks
   * that the drawing is the logo. The bound is read off `reference/brand/logos/cyera-symbol-black.svg`
   * through `svgCoverage`, so redrawing the mark, resizing it, or flipping it fails here naming the
   * pixel, and the only way to move the bound is to change the brand's own file.
   *
   * The rule is exact: ink precisely where the symbol covers at least `TRACE` of the pixel. That is
   * the thirteenth pass's whole tracing decision in `char-purple.ts`, and there is no hand edit on top
   * of it to allow for. Measured when written: 38 ink pixels; the inked pixels nearest the line are
   * 0.38 and the blank ones 0.34, so the threshold sits in a clean gap rather than on a pixel.
   *
   * SUPERSEDED IN THREE PLACES 2026-10-25 BY THE CLIENT'S A3 PICK (the fourteenth pass on
   * `MARK_ROWS`), and each place is pinned here rather than loosened:
   *
   *   - THE SIZE is the client's eleven, stated as a contract. `CAPE_MARK.size` alone would move
   *     with the painter (trap 5), so the expectation is the number the client picked, and the
   *     grid the SVG is read at is that number, not the export.
   *   - THERE ARE TWO HAND EDITS NOW, and they are NAMED: (r1,c8) and (r3,c8), the pixels that
   *     carried the dot into the right-hand lobe corner to corner. The shipped mark must be the
   *     0.35 threshold of the SVG minus EXACTLY those two -- a third edit, or a missing one, names
   *     its pixel -- and each must be a real edit, covered at or above the threshold, or it is a
   *     no-op written down as a decision. The gap they open is measured too: two pixels.
   *   - THE MARK IS TWO COLOURS: the Lilac body and a one-pixel rim in `CAPE_MARK.rim`. The trace is
   *     their union. The rim's place is defined here from the light, not read off the painter: a
   *     mark pixel with open cloth above or to its left, on the outer ring, on the light's side of
   *     the diagonal. The rim must be exactly that set -- nothing on the shaded half, nothing on
   *     the inner edge, and none of that arc left in the body colour.
   *
   * Measured when written: 11 x 11; the threshold inks 62 pixels and the two edits leave 60, of
   * which 13 are rim; the inked pixel nearest the threshold is 0.38 and the blank one 0.25.
   */
  it('carries a pixel trace of the official Cyera symbol on her back', () => {
    const svg = readFileSync(
      new URL('../../../reference/brand/logos/cyera-symbol-black.svg', import.meta.url),
      'utf8',
    );
    /** The client's A3 pick, 2026-10-25: eleven pixels. */
    const n = 11;
    expect(CAPE_MARK.size, 'the mark is not the eleven pixels the client picked').toBe(n);
    /** The two hand edits that open the dot's gap, as (row, column) on the mark's grid. */
    const CLEARED = ['(r1,c8)', '(r3,c8)'];
    const TRACE = 0.35;
    const cov = svgCoverage(svg, n);
    for (const at of CLEARED) {
      const [, r, c] = /\(r(\d+),c(\d+)\)/.exec(at)!.map(Number);
      expect(
        cov[r!]![c!]!,
        `${at} is not covered by the symbol, so clearing it edits nothing`,
      ).toBeGreaterThanOrEqual(TRACE);
    }
    const same = (c: readonly number[], k: readonly number[]): boolean =>
      c[3]! > 0 && c[0] === k[0] && c[1] === k[1] && c[2] === k[2];
    for (const name of ['up-0', 'up-1', 'up-2', 'up-3']) {
      const img = new Img(32, 48);
      PURPLE_FRAMES[name]!(img);
      const pts: [number, number][] = [];
      const rimAt = new Set<string>();
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < img.w; x++) {
          const c = img.get(x, y);
          const rim = same(c, CAPE_MARK.rim);
          if (rim || same(c, CAPE_MARK.ink)) pts.push([x, y]);
          if (rim) rimAt.add(`${x},${y}`);
        }
      expect(pts.length, `${name}: no mark in the mark's colours`).toBeGreaterThan(0);
      const x0 = Math.min(...pts.map(([x]) => x));
      const y0 = Math.min(...pts.map(([, y]) => y));
      const ink = new Set(pts.map(([x, y]) => `${x - x0},${y - y0}`));
      const dropped: string[] = [];
      const added: string[] = [];
      const cleared: string[] = [];
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const v = cov[r]![c]!;
          const at = `(r${r},c${c})`;
          if (v >= TRACE && !ink.has(`${c},${r}`)) {
            if (CLEARED.includes(at)) cleared.push(at);
            else dropped.push(`${at} ${v.toFixed(2)}`);
          }
          if (v < TRACE && ink.has(`${c},${r}`)) added.push(`${at} ${v.toFixed(2)}`);
        }
      const outside = [...ink].filter((k) => k.split(',').some((v) => Number(v) >= n));
      expect(dropped, `${name}: the trace drops pixels the symbol covers`).toEqual([]);
      expect(added, `${name}: the trace inks pixels the symbol barely touches`).toEqual([]);
      expect(cleared, `${name}: the dot's gap is not the two named hand edits`).toEqual(CLEARED);
      expect(outside, `${name}: the mark is bigger than its ${n}px grid`).toEqual([]);

      // The gap those two edits open: the dot (the smaller 4-connected piece) against the ring.
      const left = new Set(ink);
      const pieces: string[][] = [];
      for (const k0 of ink) {
        if (!left.has(k0)) continue;
        left.delete(k0);
        const piece = [k0];
        for (let i = 0; i < piece.length; i++) {
          const [x, y] = piece[i]!.split(',').map(Number) as [number, number];
          for (const k of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`])
            if (left.delete(k)) piece.push(k);
        }
        pieces.push(piece);
      }
      expect(pieces.length, `${name}: the mark is not a ring and a dot`).toBe(2);
      const [dot, ring] = pieces.sort((a, b) => a.length - b.length) as [string[], string[]];
      let gap = Infinity;
      for (const a of dot)
        for (const b of ring) {
          const [ax, ay] = a.split(',').map(Number) as [number, number];
          const [bx, by] = b.split(',').map(Number) as [number, number];
          gap = Math.min(gap, Math.max(Math.abs(ax - bx), Math.abs(ay - by)));
        }
      expect(gap, `${name}: the dot is not two pixels off the ring`).toBe(2);

      // The rim: exactly the mark's outer lit arc, read from the light rather than the painter.
      const half = (n - 1) / 2;
      const lit = (x: number, y: number): boolean =>
        (!ink.has(`${x},${y - 1}`) || !ink.has(`${x - 1},${y}`)) &&
        Math.hypot(x - half, y - half) >= half - 1 &&
        x - half + (y - half) <= 0;
      const wrongRim: string[] = [];
      const unlit: string[] = [];
      for (const k of ink) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        const isRim = rimAt.has(`${x + x0},${y + y0}`);
        if (isRim && !lit(x, y)) wrongRim.push(`(r${y},c${x})`);
        if (!isRim && lit(x, y)) unlit.push(`(r${y},c${x})`);
      }
      expect(rimAt.size, `${name}: the mark has no rim`).toBeGreaterThan(0);
      expect(wrongRim, `${name}: rim pixels off the outer lit arc`).toEqual([]);
      expect(unlit, `${name}: pixels of the outer lit arc left without the rim`).toEqual([]);
    }
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
   *
   * 2026-10-25: `bystander-toadstool` is `npc-gatekeeper` (docs/GATEKEEPER.md), the contract's
   * spawn name for him, so the key changed with the map object it is looked up by.
   */
  it('keys a two-frame painter for every character the map can spawn', () => {
    expect(Object.keys(NPC_PAINTERS).sort()).toEqual([
      'bystander-cat',
      'bystander-magpie',
      'bystander-snail',
      'npc-gatekeeper',
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
    // Declared slow (PAUL_BRIEF trap 9): a full generation and audit is about 2 s locally and
    // passed 5 s on CI's shared runner once the map grew (2026-10-22), timing out a passing test.
  }, 30_000);

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
   *
   * 83 since 2026-10-22: `stall-counter-l` and `stall-counter-r`, the market counter's finished
   * ends, APPENDED at gids 82 and 83. Verified on the regeneration that committed them: the only
   * cells of `map-forest.json` that changed are the two the map owner re-pointed on purpose,
   * `decor-below` (11,17) and (14,17), 48 -> 82 and 48 -> 83; all 81 earlier names keep their gid in
   * `tileset-forest.gids.json`; and the sheet stays 384x224, because `ceil(83 / 12)` is still 7.
   *
   * 91 since 2026-10-22, later the same day: eight crown OVERLAP tiles (`elder-tr-over-mc` ...
   * `elder-tr-over-sapling-tl`) APPENDED at gids 84 to 91, laid only by the pass after the canopy
   * rebuild. Verified on the regeneration that committed them: all 83 earlier names keep their gid
   * in `tileset-forest.gids.json`, the only map cells that changed are the `decor-above` cells that
   * pass reports re-pointing (65), and the sheet grows to 384x256 because `ceil(91 / 12)` is 8.
   *
   * 99 since 2026-10-22, the river round: the eight bank CORNERS (`shore-nw` ... `shore-cove-se`)
   * APPENDED at gids 92 to 99, laid only by the corner pass in `forest-map.ts` (`bankFor`). The
   * sheet grows to 384x288 because `ceil(99 / 12)` is 9; all 91 earlier names keep their gid.
   *
   * 111 since 2026-10-22, later the same day: the twelve SEALED banks (`bank-stones-n` ...
   * `bank-stones-cove-se`) APPENDED at gids 100 to 111, laid only in `decor-below` on the border
   * band by the dredge pass in `forest-map.ts`. The sheet grows to 384x320 because
   * `ceil(111 / 12)` is 10; all 99 earlier names keep their gid.
   *
   * 112 since 2026-10-23: Grandma's `mailbox`, flag up, APPENDED at gid 112 and laid once, at
   * `decor-below` (53,20) beside the door lane. Verified on the regeneration that committed it, cell
   * by cell against a scratch `--out` run: the only tileset cell that changed is gid 112 (an empty
   * cell until then), all 111 earlier names keep their gid, and the only map cells that changed are
   * `decor-below` (53,20), 22 (`flower-pink`) -> 112, and `collision` (53,20), 0 -> 1, plus the
   * appended `prop-mailbox` object (id 21). The sheet stays 384x320 because `ceil(112 / 12)` is 10.
   *
   * 116 since 2026-10-23, later: the three Cyera signs -- `notice-board-r`, `sign-speed`,
   * `sign-logo-l`, `sign-logo-r` -- APPENDED at gids 113 to 116. Verified on the regeneration that
   * committed them, cell by cell against the map and sheet before it: the only tileset cells that
   * changed are gid 78 (`notice-board`, repainted as the notice's west half) and 113 to 116 (empty
   * until then); all 112 earlier names keep their gid; and the only map cells that changed are
   * `decor-below` (36,3) 0 -> 114, (44,19) sapling-bl -> 113, (45,19) sapling-br -> rock, (20,22)
   * 0 -> 115, (21,22) 0 -> 116, `decor-above` (44,18) and (45,18) sapling crown -> 0, and
   * `collision` (36,3), (20,22), (21,22) 0 -> 1, plus the appended `sign-research`, `sign-speed` and
   * `sign-logo` objects (ids 22 to 24). The sheet stays 384x320 because `ceil(116 / 12)` is 10.
   *
   * 120 since 2026-10-25: `elder-tl-over-br` and `elder-tr-over-bl` for the buried-crown cells
   * (forest-map.ts), and `gate-n-swing` and `gate-s-swing` for the open gate's free halves, all
   * APPENDED. The sheet stays 384x320: `ceil(120 / 12)` is 10.
   */
  it('keeps the tileset at the gid count the committed map was written against', () => {
    expect(TILE_NAMES).toHaveLength(120);
  });
});

/*
 * THE CHARACTER LIFE STRIPS AND THE NEW SMALL ART (2026-10-22).
 *
 * Contracts and rules, not thresholds -- each one has a reader outside this workspace or is a rule
 * docs/ASSETS.md states, so writing it out is right here for the reason the notes above give.
 */
describe('the idle and hop strips', () => {
  const W = 32;
  const H = 48;
  const frameOf = (sheet: Img, i: number): Uint8Array => {
    const out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      out.set(
        sheet.data.subarray((y * sheet.w + i * W) * 4, (y * sheet.w + i * W + W) * 4),
        y * W * 4,
      );
    return out;
  };
  const same = (a: Uint8Array, b: Uint8Array): boolean => a.every((v, i) => v === b[i]);

  it('covers every character the map spawns', () => {
    expect([...LIFE_KEYS].sort()).toEqual(Object.keys(NPC_PAINTERS).sort());
  });

  it.each([...LIFE_KEYS])(
    '%s: idle is four frames and hop two, at the static frame size',
    (key) => {
      const idle = paintIdleSheet(key);
      const hop = paintHopSheet(key);
      expect([idle.w, idle.h]).toEqual([W * IDLE_FRAMES, H]);
      expect([hop.w, hop.h]).toEqual([W * HOP_FRAMES, H]);
      expect(IDLE_FRAMES).toBe(4);
      expect(HOP_FRAMES).toBe(2);
    },
  );

  /*
   * Frame 0 of the idle IS the static sprite: the scene can swap a standing character onto its idle
   * without a pop. And frames 1 and 2 are not frame 0 -- the breath and the beat are drawn, not a
   * still repeated -- which is the whole of what the strip is for.
   */
  it.each([...LIFE_KEYS])('%s: idle starts on the static frame and then moves', (key) => {
    const idle = paintIdleSheet(key);
    const still = frameOf(paintNpcSheet(key), 0);
    expect(same(frameOf(idle, 0), still), 'idle frame 0 is not the static frame 0').toBe(true);
    expect(same(frameOf(idle, 1), still), 'idle frame 1 (the breath) draws nothing new').toBe(
      false,
    );
    expect(same(frameOf(idle, 2), still), 'idle frame 2 (the beat) draws nothing new').toBe(false);
  });

  /*
   * The hop is a pixel of air: frame 1's bottom row is empty while the static sprite stands on its
   * contact bar there. If that row is ever painted, the hop has stopped leaving the ground.
   */
  it.each([...LIFE_KEYS])('%s: the top of the hop has daylight under the feet', (key) => {
    const hop = paintHopSheet(key);
    const still = paintNpcSheet(key);
    const row = (img: Img, x0: number): number[] =>
      Array.from({ length: W }, (_v, x) => img.get(x0 + x, H - 1)[3]);
    expect(
      row(still, 0).some((a) => a > 0),
      'the static sprite does not stand on row 47',
    ).toBe(true);
    expect(
      row(hop, W).every((a) => a === 0),
      'hop frame 1 still touches row 47',
    ).toBe(true);
  });
});

describe('no partial alpha in the new art (docs/ASSETS.md)', () => {
  const partial = (img: Img): number => {
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0 && img.data[i] !== 255) n++;
    return n;
  };
  it.each([...LIFE_KEYS])('%s idle and hop', (key) => {
    expect(partial(paintIdleSheet(key))).toBe(0);
    expect(partial(paintHopSheet(key))).toBe(0);
  });
  it.each(Object.keys(FX_SHEETS))('%s', (key) => {
    expect(partial(paintFxSheet(key))).toBe(0);
  });
  it.each(['item-wings', 'item-hourglass'])('%s', (key) => {
    const img = new Img(PORTRAIT_SIZE, PORTRAIT_SIZE);
    ITEM_PAINTERS[key]!(img);
    expect(partial(img)).toBe(0);
    // And it is a drawing, not an empty square: an icon fills a good part of its frame.
    let opaque = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 255) opaque++;
    expect(opaque / (PORTRAIT_SIZE * PORTRAIT_SIZE)).toBeGreaterThan(0.3);
  });
});
