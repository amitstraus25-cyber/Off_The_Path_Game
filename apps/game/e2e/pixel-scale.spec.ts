// Temporary: checks the pixel-art images land on whole source pixels at every breakpoint.
import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

const OUT = process.env['SHOT_DIR'] ?? '/tmp';

const SIZES = [
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'phone-375x812', width: 375, height: 812 },
];

for (const size of SIZES) {
  test(`pixel art scales cleanly at ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: 'rabbit' });
      store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    });
    await expect(page.locator('.otp-card')).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/css-${size.name}.png` });

    // Every pixel-art image must be a whole multiple, or a clean half/quarter, of its 64px source.
    const ratios = await page.evaluate(() => {
      const out: { sel: string; w: number; ratio: number }[] = [];
      for (const sel of [
        '.otp-card__icon img',
        '.otp-portrait',
        '.otp-slot img',
        '.otp-hud-slot img',
      ]) {
        for (const el of document.querySelectorAll(sel)) {
          const w = el.getBoundingClientRect().width;
          if (w > 0) out.push({ sel, w, ratio: w / 64 });
        }
      }
      return out;
    });
    const bad = ratios.filter((r) => {
      const q = r.ratio * 4;
      return Math.abs(q - Math.round(q)) > 0.01; // allow 1x, 2x, 0.5x, 0.25x
    });
    expect(bad, `${size.name}: fractional pixel-art scales ${JSON.stringify(bad)}`).toEqual([]);
    console.log(size.name, JSON.stringify(ratios));
    await context.close();
  });
}
