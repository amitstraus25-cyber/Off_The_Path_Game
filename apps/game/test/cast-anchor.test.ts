import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * THE GAME AND THE TEST SUITE MUST AGREE ABOUT WHERE A CHARACTER STANDS.
 *
 * For a round they did not, and the disagreement read as a hole in the map.
 *
 * `createCharacter` in src/world/forest-scene.ts puts the sprite at `spawn.y + TILE / 2` and
 * returns `y: sprite.y`. The spawn is the CENTRE of the tile and the sprite's origin is its feet,
 * so a character's feet are at the tile's bottom edge: `object.y + TILE`. That is what `nearest()`
 * measures against, so it is the truth.
 *
 * `talkingDistance` in e2e/helpers.ts returned `spot.y + TILE + 8`. That was correct when it was
 * written in 37a94b9, because `createCharacter` then read `spawn.y + NPC_SPRITE.height / 2` and the
 * NPC sheets are 48px tall: tile-centre + 24 = `object.y + 40`, and `TILE + 8` is 16 + 24 restated.
 * The very next commit, 6452ece, changed the game to `spawn.y + TILE / 2` and moved the whole cast
 * 8px north. The helper was not touched.
 *
 * EIGHT PIXELS. `walkTo`'s tolerance is `TILE * 1.25` = 40, and the north approach to a cast member
 * is EXACTLY 40.00px -- margin zero. Purple landing 3px off centre measured 40.11 to the stale target
 * and threw "Something is in the corridor." `INTERACT_RADIUS` is 48, so she could always talk; the
 * walk helper simply refused to believe it had arrived. A whole round went into hunting a collision
 * tile at (10,22), which turned out to be the toadstool's own spawn cell, deliberately solid under
 * the generator's "nobody in the cast is a ghost" invariant. The map was innocent the entire time.
 *
 * WHY THIS IS A SOURCE GUARD. apps/game's vitest runs on the `node` environment with no DOM and no
 * Phaser, so neither function can be called here -- `test/handle-field.test.ts` and
 * `test/docs-truth.test.ts` read source the same way. It is also the right shape: the defect is two
 * expressions drifting apart, which is a property of what is WRITTEN. A runtime check would need a
 * browser, which is e2e, which is exactly where this hid for a round.
 *
 * WHAT WOULD BE BETTER. One exported `castAnchor()` that both callers read, so they cannot drift at
 * all. That touches src/world/map.ts and both call sites, and it is the right follow-up. Until then
 * this fails the moment either expression changes without the other.
 *
 * THERE IS A THIRD ANCHOR and it is NOT a defect: `map.test.ts` computes `centre` as
 * `o.y + o.height / 2` = `object.y + 16`, the middle of the tile. That is a different point for a
 * different purpose (which tile a thing is on, not where a person's feet are) and it is deliberately
 * not checked here. Three anchors with nothing asserting any relationship is how 8px landed
 * silently; two of them now have one.
 */

const at = (p: string): string =>
  readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

const SCENE = at('src/world/forest-scene.ts');
const HELPERS = at('e2e/helpers.ts');

/** Source with block comments stripped -- this file's own prose quotes the very bug it guards. */
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the cast stands in one place', () => {
  it('reads the files it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    expect(code(SCENE).length, 'forest-scene.ts is empty or all comment').toBeGreaterThan(1000);
    expect(code(HELPERS).length, 'e2e/helpers.ts is empty or all comment').toBeGreaterThan(500);
    expect(code(SCENE), 'createCharacter is gone -- this guard is watching nothing').toContain(
      'createCharacter',
    );
    expect(code(HELPERS), 'talkingDistance is gone -- this guard is watching nothing').toContain(
      'talkingDistance',
    );
  });

  it('puts the sprite half a tile below the spawn centre, so its feet are on the tile edge', () => {
    /*
     * The game is the truth, and this pins it. If someone changes the scene they must change the
     * helper in the same commit, and this test is where they find that out -- in `pnpm test`, in
     * seconds, rather than in an e2e run that reports a corridor blockage.
     */
    expect(
      code(SCENE),
      'createCharacter no longer places the sprite at spawn.y + TILE / 2. If that is deliberate, ' +
        'talkingDistance in e2e/helpers.ts measures to the old point and every walk to a ' +
        'character will fail as "Something is in the corridor" -- update both in one commit.',
    ).toMatch(/add\.sprite\(\s*spawn\.x\s*,\s*spawn\.y\s*\+\s*TILE\s*\/\s*2\s*,/);
  });

  it('walks to the tile edge, which is the same point', () => {
    const talking = /export async function talkingDistance[\s\S]*?\n\}/.exec(code(HELPERS))?.[0];
    expect(talking, 'talkingDistance is not a function declaration any more').toBeTruthy();

    expect(
      talking!,
      'talkingDistance no longer returns spot.y + TILE. It is measuring to a different point ' +
        'from the one createCharacter puts the sprite at, which is the 8px drift that cost a round.',
    ).toMatch(/y:\s*spot\.y\s*\+\s*TILE\s*[,}]/);

    /*
     * The bound is the DEFECT, named, not the fix restated -- so this cannot drift with the thing
     * it guards. `+ TILE + 8` is the exact stale expression from 37a94b9; `+ 40` is what it
     * becomes if someone "simplifies" it back to a literal at TILE = 32.
     */
    for (const stale of ['TILE + 8', '+ 40'])
      expect(
        talking!.replace(/\s+/g, ' '),
        `talkingDistance is back on the pre-6452ece anchor (${stale}). The cast moved 8px north ` +
          'when createCharacter stopped adding half the 48px frame height.',
      ).not.toContain(stale);
  });

  it('leaves the walk tolerance no room it does not have', () => {
    /*
     * Why the 8px mattered at all, asserted so nobody "tidies" the tolerance later believing there
     * is slack. The north approach to a cast member is exactly TILE * 1.25 away -- `walkTo` throws
     * on `gap > within`, so 40.00 passes and ANY lateral drift fails. There is no margin to spend.
     */
    // A default parameter (`within = TILE * 1.25,`), not a `const` -- the first draft of this
    // guard assumed a `const`, failed on correct code, and had to be re-derived from the source.
    const within = /\bwithin\s*=\s*([^,;)]+)[,;)]/.exec(code(HELPERS))?.[1];
    expect(within, 'walkTo no longer defines `within` -- re-derive this guard').toBeTruthy();
    expect(
      within!.replace(/\s+/g, ''),
      "walkTo's tolerance changed. It was TILE * 1.25 = 40, which is EXACTLY the north approach " +
        'distance to a cast member, so the walk has zero margin and any drift in either anchor ' +
        'fails. If you widened it, that hides the next drift instead of catching it.',
    ).toBe('TILE*1.25');
  });
});
