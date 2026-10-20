/*
 * The title screen may not say things that are not true on the screen the player is looking at.
 *
 * UX_REVIEW finding 11: three of the four claims on screen 00 were false exactly where they were
 * read. The chip said "Red is already standing on the path" while she rendered behind an 88%-black
 * column -- 53px short of clearing it at 1280 -- and the hint promised arrow keys and a tap-to-walk
 * on a phone, where there is no keyboard, a tap moves Red about 4px (WALK_SPEED is 120px/s and only
 * a held stick walks), and the pad is not drawn on the title screen at all.
 *
 * What is left here asserts the two claims the title screen still makes. The standing chip was
 * removed rather than narrowed, so what guards it now is its ABSENCE, asserted by count.
 *
 * Two landscape tests used to live above, and both asserted nothing. Each opened with
 * `const claimed = await page.locator('.otp-title__standing').isVisible()` and put its whole body
 * behind `if (claimed)`; the chip is gone from apps/game/src, so `claimed` was false at both
 * widths and the two tests booted a browser, resized it, read the live camera and finished. The
 * measurement they would have made was wrong as well: `red.right - column.right` is the
 * wrong-edge comparison e2e/css-contract.spec.ts documents in capitals as having passed at 340px
 * with 10px of Red hidden behind the column. A guard that cannot fire is worse than no guard,
 * because it reads as cover. The geometry() helper went with them -- that loop was its only caller.
 */
import { expect, test } from '@playwright/test';
import { ready } from './helpers';

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
    /*
     * By COUNT, not by visibility: `toBeHidden()` passes on a locator that matches nothing, so
     * against an element that no longer exists it was as vacuous as the two tests this file used
     * to open with. Counting is the assertion screens.css already believes is being made -- see
     * its "No .otp-title__standing rule" note -- and it is what turns this into a reintroduction
     * guard: putting the chip back on the title screen fails here.
     */
    await expect(page.locator('.otp-title__standing')).toHaveCount(0);
  });
});

/* The desktop hint is still there to be read: this is a truth fix, not a copy cull. */
test('the title still carries its hint on a keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.otp-title-panel .otp-hint')).toHaveText(/\S/);
});
