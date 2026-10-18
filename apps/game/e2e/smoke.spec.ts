import { expect, test } from '@playwright/test';

test('boots the graybox forest with no console errors and no third-party requests', async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:'))
      external.push(r.url());
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
