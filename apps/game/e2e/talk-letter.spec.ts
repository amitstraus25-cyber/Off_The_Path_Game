import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/*
 * THE TALK BUTTON SAYS THE KEY THAT TALKS (the client's review, 2026-10-25, P12). With a keyboard
 * and a mouse the round button reads "E", because A walks left; on a touch screen it reads "A".
 */

const shown = (page: import('@playwright/test').Page) =>
  page.locator('.otp-a-button').evaluate((b) =>
    Array.from(b.querySelectorAll('.otp-a-button__key'))
      .filter((k) => getComputedStyle(k).display !== 'none')
      .map((k) => k.textContent),
  );

test('with a keyboard and a mouse the talk button reads E', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);
  expect(await shown(page)).toEqual(['E']);
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('the talk button reads A', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    expect(await shown(page)).toEqual(['A']);
  });
});
