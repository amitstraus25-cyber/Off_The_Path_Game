import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * THE WAY ON IN WORDS (the client's review, 2026-10-25, P5): which way and how far each traveller
 * is, for a screen reader. The edge arrow that went with it was removed at the client's word.
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
