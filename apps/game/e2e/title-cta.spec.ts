import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

/*
 * THE TITLE'S ONE LIME IS ONE LINE (the full UX/UI review, 2026-10-22). At 844x390 "Begin the walk"
 * wrapped onto two lines in the narrow landscape card: the only wrapped button in the game, and it
 * read as cramped. `.otp-title-panel .otp-cta` is `white-space: nowrap` now, and the risk that
 * trades for is a pill wider than its card, so both are measured -- on the landing and on the
 * how-to, which share the card -- at the tightest cards the game draws as well as the usual three.
 */
const SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 640, height: 400 },
];

/** How many lines the pill's label is set on, and how far the pill reaches past its card. */
function measure(page: Page): Promise<{ lines: number; past: number; label: string }> {
  return page.evaluate(() => {
    const cta = document.querySelector<HTMLElement>('.otp-title-panel .otp-cta')!;
    const card = cta.closest<HTMLElement>('.otp-title-panel')!.getBoundingClientRect();
    const text = [...cta.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    const box = cta.getBoundingClientRect();
    return {
      lines: tops.size,
      past: Math.max(0, box.right - card.right, card.left - box.left),
      label: (text.textContent ?? '').trim(),
    };
  });
}

for (const size of SIZES) {
  test(`the title and how-to calls to action sit on one line inside the card at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await ready(page);
    const landing = await measure(page);
    expect(landing.lines, `"${landing.label}" wraps`).toBe(1);
    expect(landing.past, `"${landing.label}" overruns its card`).toBeLessThanOrEqual(0.5);

    await page.getByRole('button', { name: /Begin the walk/ }).click();
    await page.locator('[data-howto]').waitFor();
    const howTo = await measure(page);
    expect(howTo.lines, `"${howTo.label}" wraps`).toBe(1);
    expect(howTo.past, `"${howTo.label}" overruns its card`).toBeLessThanOrEqual(0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
