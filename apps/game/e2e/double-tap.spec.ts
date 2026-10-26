import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * A SECOND TAP ON A IS NOT AN ANSWER (the client's review, 2026-10-25, P1).
 *
 * On a phone held upright the offer docks over the touch pad, and Leave it opens exactly where the
 * A button was. Tapping A to talk and tapping again -- a habit -- used to record "leave" on a card
 * nobody had read. Driven with real touch input through the devtools protocol, because a
 * synthetic click carries none of the geometry; ui/components.tsx `TOUCH_SETTLE_MS` is the rule.
 */

test.use({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

async function tapper(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd', x = 0, y = 0) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  return async (x: number, y: number) => {
    await touch('touchStart', x, y);
    await page.waitForTimeout(70);
    await touch('touchEnd');
  };
}

for (const gap of [250, 600]) {
  test(`tapping A twice ${gap}ms apart opens the offer and answers nothing`, async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const otp = window.__otp!;
      const first = otp.content.characters[0]!;
      const m = otp.mapObjects!.find((o) => o.name === first.spawn)!;
      otp.scene!.position = { x: m.x + 16, y: m.y + 40 };
      otp.scene!.placePurple();
    });
    await page.waitForTimeout(600);
    const a = await page.locator('.otp-a-button').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const tap = await tapper(page);

    // The gap runs from the first tap, not from when the card was seen: on a slow runner seeing it
    // takes a few hundred milliseconds more, and the second tap drifted past the settle window.
    const firstTapAt = Date.now();
    await tap(a.x, a.y);
    await expect(page.locator('[data-offer]')).toBeVisible();
    await page.waitForTimeout(Math.max(0, gap - (Date.now() - firstTapAt)));
    await tap(a.x, a.y);
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => window.__otp!.store.getState().verdicts)).toEqual({});
    await expect(page.locator('[data-offer]')).toBeVisible();

    // Through the conversation to the card, which mounts fresh; a deliberate tap, once the card
    // has had its second, still answers.
    await page.evaluate(() => {
      const { store } = window.__otp!;
      const s = store.getState();
      const c = window.__otp!.content.characters.find((k) => k.id === s.active)!;
      store.dispatch({ type: 'INSPECT', s: c.skillId });
    });
    await expect(page.locator('[data-offer] [data-action="leave"]')).toBeVisible();
    await page.waitForTimeout(1100);
    const leave = await page.locator('[data-offer] [data-action="leave"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await tap(leave.x, leave.y);
    await expect
      .poll(() => page.evaluate(() => Object.values(window.__otp!.store.getState().verdicts)))
      .toEqual(['leave']);
  });
}
