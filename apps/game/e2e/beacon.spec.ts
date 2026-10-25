import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * THE WAY ON (the client's review, 2026-10-25, P5): an arrow at the world's edge toward the nearest
 * unmet character while none is on screen, and the same directions in words for a screen reader.
 */

const place = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([px, py]) => {
      const { scene } = window.__otp!;
      scene!.position = { x: px, y: py };
      scene!.placePurple();
    },
    [x, y] as const,
  );

test('an arrow points the way when nobody unmet is on screen, and goes when one is', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await startGame(page);
  // The south of the map: open lawn, nobody in sight.
  await place(page, 900, 1250);
  const arrow = page.locator('.otp-beacon');
  await expect(arrow).toBeVisible();
  const box = (await arrow.boundingBox())!;
  const world = (await page.locator('.otp-world-anchor').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(world.x);
  expect(box.y + box.height).toBeLessThanOrEqual(world.y + world.height);
  await expect(page.locator('.otp-beacon-layer')).toHaveAttribute('aria-hidden', 'true');

  // Beside the first character, who is unmet and in view: no arrow.
  const first = await page.evaluate(() => {
    const otp = window.__otp!;
    const m = otp.mapObjects!.find((o) => o.name === otp.content.characters[0]!.spawn)!;
    return { x: m.x + 80, y: m.y + 40 };
  });
  await place(page, first.x, first.y);
  await expect(arrow).toHaveCount(0);
});

test('the forest summary says which way and how far each traveller is', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await place(page, 900, 1250);
  const lines = page.locator('section.otp-visually-hidden li');
  await expect(lines).toHaveCount(7);
  await expect(lines.first()).toContainText(
    /of you, (a few steps away|a short walk away|a long way off)$/,
  );
});
