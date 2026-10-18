/*
 * Screenshots the running game at every landmark, for judging the art against the concept board.
 *
 * Skipped unless SHOT_DIR is set, so it costs a normal `pnpm e2e` run nothing:
 *   SHOT_DIR=/tmp/shots npx playwright test e2e/capture.spec.ts
 *
 * It teleports rather than walks. The scene is exposed on window.__otp in E2E builds, and walking
 * to seven landmarks takes minutes and sometimes snags on a tree; this is deterministic and takes
 * seconds. It is a reviewing tool, not a test of movement -- world.spec.ts covers that.
 */
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

const OUT = process.env['SHOT_DIR'];

/** Puts Red at a named map object and snaps the camera to her. */
async function teleport(page: Page, object: string, dy: number): Promise<void> {
  await page.evaluate(
    ({ object, dy }) => {
      const scene = window.__otp!.scene as unknown as {
        position: { x: number; y: number };
        camera: { x: number; y: number };
        red: { setPosition(x: number, y: number): void; setDepth(d: number): void; y: number };
        focus(): { x: number; y: number };
        syncCamera(): void;
      };
      const o = window.__otp!.mapObjects!.find((m) => m.name === object);
      if (!o) throw new Error(`map has no object "${object}"`);
      const x = o.x + o.width / 2;
      const y = o.y + o.height + dy;
      scene.position = { x, y };
      scene.red.setPosition(Math.round(x), Math.round(y));
      scene.red.setDepth(scene.red.y);
      scene.camera = scene.focus();
      scene.syncCamera();
    },
    { object, dy },
  );
}

/** Landmark, and how far below it to stand so the thing itself is in frame. */
const PLACES: [name: string, object: string, dy: number][] = [
  ['01-spawn', 'spawn-red', 0],
  ['02-cottage', 'prop-cottage', 80],
  ['03-stall', 'prop-stall', 64],
  ['04-gate', 'gate-fence-gap', 40],
  ['05-well', 'prop-well', 56],
  ['06-fountain', 'prop-fountain', 56],
  ['07-lantern', 'prop-lantern-post', 56],
  ['08-signpost', 'prop-signpost', 56],
];

test.describe('capture', () => {
  test.skip(!OUT, 'set SHOT_DIR to capture screenshots');

  test('the world at every landmark', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await startGame(page);
    for (const [name, object, dy] of PLACES) {
      await teleport(page, object, dy);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/world-${name}.png` });
      console.log(`shot world-${name}`);
    }
  });

  test('the panels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await startGame(page);

    await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/panel-dialogue.png` });

    await page.evaluate(() =>
      window.__otp!.store.dispatch({ type: 'INSPECT', s: 'cottage-finder' }),
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/panel-card.png` });
    console.log('shot panel-dialogue, panel-card');
  });
});
