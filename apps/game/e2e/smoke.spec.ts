import { expect, test } from '@playwright/test';

test('boots the graybox forest with no console errors and no third-party requests', async ({
  page,
  baseURL,
}) => {
  /*
   * "Third party" is anything that is not the origin the suite was pointed at. That origin is the
   * configured `baseURL`, not a literal: this used to say `http://localhost:4173`, so pointing the
   * suite at `127.0.0.1:4173` or another port made EVERY request read as third-party and failed a
   * clean page, and a baseURL that drifted away from the literal would have gone on passing against
   * the wrong host. `data:` URIs have no network origin and are the one other thing allowed.
   */
  expect(
    baseURL,
    'playwright.config.ts sets no baseURL, so there is no first-party origin',
  ).toBeTruthy();
  const origin = new URL(baseURL!).origin;
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== origin && url.protocol !== 'data:') external.push(r.url());
  });

  await page.goto('/');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1000);

  /*
   * The camera is derived from the space available rather than being a fixed 480x270 letterboxed
   * into it, so its aspect follows the window and a 16:9 assertion no longer describes the design
   * (the portrait artboard is deliberately taller than wide). What matters instead: the world
   * fills its frame, and one game pixel is still a whole number of CSS pixels.
   */
  const fit = await page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { fillsWidth: r.width / innerWidth, zoom: r.width / c.width };
  });
  expect(fit.fillsWidth, 'the world fills its frame').toBeGreaterThan(0.9);
  expect(Math.abs(fit.zoom - Math.round(fit.zoom)), 'whole CSS pixels per game pixel').toBeLessThan(
    0.001,
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
