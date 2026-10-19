/*
 * The title screen may not say things that are not true on the screen the player is looking at.
 *
 * UX_REVIEW finding 11: three of the four claims on screen 00 were false exactly where they were
 * read. The chip said "Red is already standing on the path" while she rendered behind an 88%-black
 * column -- 53px short of clearing it at 1280 -- and the hint promised arrow keys and a tap-to-walk
 * on a phone, where there is no keyboard, a tap moves Red about 4px (WALK_SPEED is 120px/s and only
 * a held stick walks), and the pad is not drawn on the title screen at all.
 *
 * These are measurements, not a snapshot: the first test computes where Red actually renders from
 * the live camera and compares it with the panel's own box, so narrowing the column, panning the
 * camera or dropping the chip all satisfy it, and re-adding the claim over the column fails it.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

/** Red's rendered box in CSS pixels, next to the copy column's, read from the running game. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as {
      redPosition: { x: number; y: number };
      cameras: { main: { scrollX: number; scrollY: number; width: number } };
    };
    const canvas = document.querySelector('canvas');
    const panel = document.querySelector('.otp-title-panel');
    if (!canvas || !panel) throw new Error('title screen is not on screen');
    const view = canvas.getBoundingClientRect();
    const column = panel.getBoundingClientRect();
    // CSS pixels per world pixel: ui/stage.ts sizes the canvas to view * zoom.
    const zoom = view.width / scene.cameras.main.width;
    const { x, y } = scene.redPosition;
    // red.png frames are 32x48 with the origin at her feet (forest-scene.ts setOrigin(0.5, 1)).
    const red = {
      left: view.left + (x - 16 - scene.cameras.main.scrollX) * zoom,
      right: view.left + (x + 16 - scene.cameras.main.scrollX) * zoom,
      top: view.top + (y - 48 - scene.cameras.main.scrollY) * zoom,
      bottom: view.top + (y - scene.cameras.main.scrollY) * zoom,
    };
    return { red, column: { left: column.left, right: column.right, width: column.width }, zoom };
  });
}

/*
 * Landscape, where the column sits beside the world and the chip is not suppressed. Two widths,
 * because the claim was false at every landscape width, not just the review's 1280.
 */
for (const [width, height] of [
  [1280, 860],
  [1024, 640],
] as const) {
  test(`the standing claim is only made where Red is visible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await ready(page);

    const claimed = await page.locator('.otp-title__standing').isVisible();
    const { red, column } = await geometry(page);
    // How far Red's right edge clears the column's right edge. Negative means she is behind it.
    const clearance = Math.round(red.right - column.right);
    console.log(
      `${width}: claim ${claimed ? 'shown' : 'absent'}, column ${Math.round(column.width)}px, ` +
        `Red ${Math.round(red.left)}..${Math.round(red.right)}, clearance ${clearance}px`,
    );

    if (claimed) {
      expect(
        clearance,
        'the chip claims Red is on the path, so she must render clear of the copy column',
      ).toBeGreaterThan(0);
    }
  });
}

/*
 * Touch, where the keyboard the hint names does not exist and the pad it promises is not drawn
 * until the walk starts (main.ts only shows the touch controls while the phase is `explore`).
 */
test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('the title hint promises nothing the phone cannot do', async ({ page }) => {
    await page.goto('/');
    await ready(page);

    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    expect(coarse, 'this test is only meaningful with a coarse pointer').toBe(true);

    const hint = page.locator('.otp-title-panel .otp-hint');
    const text = (await hint.count()) > 0 ? ((await hint.first().textContent()) ?? '') : '';
    console.log(`375 coarse: hint ${text ? `"${text}"` : 'absent'}`);

    // Keys a phone has not got, and a tap that does not walk: ~4px of a 120px/s step.
    expect(text, 'no keyboard controls in the hint read on a phone').not.toMatch(
      /arrow|\bspace\b|wasd|\besc\b/i,
    );
    expect(text, 'no tap-to-walk promise: only a held stick walks').not.toMatch(/\btap/i);
  });

  test('the standing claim is not made where the pad and Red are both off screen', async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page);
    await expect(page.locator('.otp-title__standing')).toBeHidden();
  });
});

/* The desktop hint is still there to be read: this is a truth fix, not a copy cull. */
test('the title still carries its hint on a keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.otp-title-panel .otp-hint')).toHaveText(/\S/);
});
