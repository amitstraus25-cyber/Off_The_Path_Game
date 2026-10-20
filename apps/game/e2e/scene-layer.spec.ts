/*
 * The scene layer's four player-visible contracts, none of which anything was watching.
 *
 * WHY A NEW FILE. Board task P1 may edit four source files and names no spec, and the three specs
 * that could have held these assertions are each owned by another task on the same board
 * (css-contract by 2, ui by 5, game by 12). A new file collides with nobody; two owners in one
 * file is how this project loses days.
 *
 * Each test below is written against something a player looks at -- a line of copy that will not
 * stop flashing, feet that do not touch the ground, a mark that floats further from the shortest
 * character than from the tallest, a heroine behind the scenery -- and NOT against the constant
 * that was wrong. Every bound comes from the map, from the shipped art, or from TILE, so a guard
 * cannot pass merely by agreeing with whatever `forest-scene.ts` says today.
 *
 * It teleports where it can, the way e2e/capture.spec.ts does: the doorstep is 1,440px from the
 * spawn and walking there takes most of a minute, and none of these four is a test of walking.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';
import { TILE } from '../src/world/logic';

/** Puts Red at an offset inside a named map object, and snaps the camera to her. */
async function standOn(page: Page, object: string, dx: number, dy: number): Promise<void> {
  await page.evaluate(
    ({ object, dx, dy }) => {
      const scene = window.__otp!.scene as unknown as {
        position: { x: number; y: number };
        camera: { x: number; y: number };
        red: { setPosition(x: number, y: number): void; setDepth(d: number): void; y: number };
        focus(): { x: number; y: number };
        syncCamera(): void;
      };
      const o = window.__otp!.mapObjects!.find((m) => m.name === object);
      if (!o) throw new Error(`map has no object "${object}"`);
      const x = o.x + dx;
      const y = o.y + dy;
      scene.position = { x, y };
      scene.red.setPosition(Math.round(x), Math.round(y));
      scene.red.setDepth(scene.red.y);
      scene.camera = scene.focus();
      scene.syncCamera();
    },
    { object, dx, dy },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

/*
 * 1. THE LOCKED DOOR SAYS ITS PIECE ONCE.
 *
 * `checkCottage` tested `overlaps` and emitted every frame Red stood on the step -- 181 emissions
 * in 181 frames -- and `main.ts` only suppresses a second toast while one is still up. So the line
 * "I should hear all three travellers first." timed out after a couple of seconds, was re-emitted
 * on the very next frame and came straight back: a caption flashing on and off for as long as the
 * player stood at the door working out what to do, which is the only time they ever read it.
 *
 * Counted as RISING EDGES of the caption, so the assertion does not depend on how long main.ts
 * leaves a toast up, only on how many times the door spoke. One arrival, one line.
 */
test('the locked-cottage line is said once, not every two and a half seconds', async ({ page }) => {
  // Watch the caption before she arrives, or the first showing is over before counting starts.
  await page.evaluate(() => {
    const w = window as unknown as { __otpRises?: number };
    const text = (): string => document.querySelector('.otp-toast')?.textContent ?? '';
    w.__otpRises = 0;
    let was = text() !== '';
    setInterval(() => {
      const shown = text() !== '';
      if (shown && !was) w.__otpRises = (w.__otpRises ?? 0) + 1;
      was = shown;
    }, 50);
  });

  // The middle of the doorstep lane: inside trigger-cottage, clear of the notice beside it.
  await standOn(page, 'trigger-cottage', TILE, TILE * 1.5);
  await expect(page.locator('.otp-toast')).toHaveText(/all three travellers first/i);
  // Nothing was unlocked, so she is still in the forest and still standing on the step.
  expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('explore');

  // Long enough for the caption to time out and be said again several times over.
  await page.waitForTimeout(9000);
  const rises = await page.evaluate(
    () => (window as unknown as { __otpRises?: number }).__otpRises ?? -1,
  );
  expect(rises, 'the door re-announced itself while Red stood on the step').toBe(1);
});

/*
 * 2. EVERYBODY STANDS ON THE GROUND THEY ARE PLACED ON.
 *
 * `npcSpawns`/`bystanderSpawns` hand back the CENTRE of the spawn tile and the sprite origin is
 * its feet, so the feet belong half a TILE lower. The scene added half the FRAME (24) instead, and
 * all eight characters stood 8px into the tile below their own -- past the verge of the path they
 * are meant to be standing on, and 10px below Red's own contact line on the same row of ground.
 *
 * The bound is the spawn object's own bottom edge, read from the map. It is deliberately not half
 * a tile measured the way the scene measures it, because that is the number under test.
 */
test('every character in the cast stands on the bottom edge of their own tile', async ({
  page,
}) => {
  const feet = await page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as {
      npcs: { id: string; sprite: { y: number; texture: { key: string } } }[];
    };
    return scene.npcs.map((n) => ({ key: n.sprite.texture.key, y: n.sprite.y }));
  });
  const objects = await page.evaluate(() => window.__otp!.mapObjects!);

  expect(feet.length, 'the forest is empty').toBeGreaterThan(4);
  for (const { key, y } of feet) {
    const tile = objects.find((o) => o.name === key);
    expect(tile, `the map has no spawn object named ${key}`).toBeTruthy();
    expect(y, `${key} does not stand on the bottom edge of its tile`).toBe(tile!.y + tile!.height);
  }
});

/*
 * 3. THE BUBBLE SITS THE SAME WAY OVER EVERY HEAD.
 *
 * It used to hang off the 48px FRAME, and every character's frame is that height whatever is drawn
 * in it, so the one mark that means "this one will talk to you" floated 16px over the Lantern
 * Keeper, who fills 44 of his rows, and 46px over the snail, who fills 14. The shortest character
 * in the cast got the mark furthest from their head, which is the opposite of a pointer.
 *
 * Measured off the TEXTURE the game loaded rather than off the scene's arithmetic: the top opaque
 * row of a character's frame is where their head is, the lowest drawn row of the bubble is where
 * its tail ends, and the distance between the two is what a player sees. Nothing here is told the
 * frame height or the intended gap -- both come out of the frames themselves.
 *
 * The spread check is what stops this passing vacuously: if every character measured the same
 * height, "the same margin for all of them" would be true of the broken code too.
 */
test('the prompt bubble clears every head by the same margin, tall or short', async ({ page }) => {
  const measured = await page.evaluate(() => {
    interface Frame {
      cutX: number;
      cutY: number;
      cutWidth: number;
      cutHeight: number;
      source: { image: CanvasImageSource };
    }
    const textures = (
      window.__otp!.scene as unknown as {
        textures: { getFrame(key: string, index: number): Frame };
      }
    ).textures;

    /** The first and last rows of a texture frame that have any ink in them, and its height. */
    const ink = (key: string): { top: number; bottom: number; frame: number } => {
      const f = textures.getFrame(key, 0);
      const canvas = document.createElement('canvas');
      canvas.width = f.cutWidth;
      canvas.height = f.cutHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        f.source.image,
        f.cutX,
        f.cutY,
        f.cutWidth,
        f.cutHeight,
        0,
        0,
        f.cutWidth,
        f.cutHeight,
      );
      const { data } = ctx.getImageData(0, 0, f.cutWidth, f.cutHeight);
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < f.cutHeight; y++)
        for (let x = 0; x < f.cutWidth; x++)
          if (data[(y * f.cutWidth + x) * 4 + 3]! > 0) {
            if (top < 0) top = y;
            bottom = y;
            break;
          }
      return { top, bottom, frame: f.cutHeight };
    };

    const scene = window.__otp!.scene as unknown as {
      npcs: {
        id: string;
        sprite: { y: number; texture: { key: string } };
        prompt: { y: number; texture: { key: string } };
      }[];
    };
    return scene.npcs.map((n) => {
      const body = ink(n.sprite.texture.key);
      const bubble = ink(n.prompt.texture.key);
      // Both origins are (0.5, 1), so frame row r is drawn at y - frameHeight + r.
      const headTop = n.sprite.y - body.frame + body.top;
      const tailBottom = n.prompt.y - bubble.frame + bubble.bottom;
      return { id: n.id, art: body.frame - body.top, margin: headTop - tailBottom };
    });
  });

  const heights = measured.map((m) => m.art);
  expect(
    Math.max(...heights) - Math.min(...heights),
    'every character measured the same height, so this test would prove nothing',
  ).toBeGreaterThan(TILE / 2);

  const margins = [...new Set(measured.map((m) => m.margin))];
  expect(
    margins,
    `the bubble clears some heads further than others: ${JSON.stringify(measured)}`,
  ).toHaveLength(1);
  // And it is a bubble over a head, not a balloon on a string.
  expect(margins[0]).toBeGreaterThan(0);
  expect(margins[0]).toBeLessThanOrEqual(TILE);
});

/*
 * 4. RED IS IN FRONT OF THE FOREST BEFORE THE PLAYER TOUCHES ANYTHING.
 *
 * Three places set her depth from her feet -- the replay, the arrival and every step of the walk --
 * and the line that CREATES her did not, so she was born at depth 0. At 0 she sorts under the decor
 * painted over the ground, under the wolf's prints and under all eight characters, whose depth is
 * their own fixed y and therefore always wins. It lasted until the first keypress, which is to say
 * for the whole of the opening shot.
 *
 * Asserted against the cast and the canopy rather than against her own y: anyone standing further
 * up the path than Red is behind her and the tree tops are in front, which is the sort order a
 * player reads off the screen. `depth === y` would only restate the fix.
 */
test('Red is sorted by her feet from the moment the forest appears', async ({ page }) => {
  const order = await page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as {
      red: { y: number; depth: number };
      npcs: { id: string; sprite: { y: number; depth: number } }[];
      children: { list: { depth: number; type: string }[] };
    };
    return {
      depth: scene.red.depth,
      uphill: scene.npcs
        .filter((n) => n.sprite.y < scene.red.y)
        .map((n) => ({ id: n.id, depth: n.sprite.depth })),
      canopy: Math.max(
        ...scene.children.list.filter((c) => c.type === 'TilemapLayer').map((c) => c.depth),
      ),
    };
  });

  expect(
    order.uphill.length,
    'nobody is standing uphill of the spawn to sort against',
  ).toBeGreaterThan(0);
  for (const who of order.uphill)
    expect(
      order.depth,
      `Red draws behind ${who.id}, who is standing further up the path than she is`,
    ).toBeGreaterThan(who.depth);
  expect(order.depth, 'Red draws over the tree tops she should walk behind').toBeLessThan(
    order.canopy,
  );
});
