import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startGame } from './helpers';

/** The content file: the Rabbit's lines and Purple's replies, as the game renders them. */
const v2 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as {
  characters: { id: string; skillId: string; greet: string }[];
  ui: { offer: { ask: string; noThanks: string } };
};

/*
 * THE GREETING BEFORE THE CARD (the client, 2026-10-26). Meeting someone opens their one line --
 * what they have and how it helps you -- and Purple's two replies: "Tell me more" opens the card at
 * once (one interaction, the client's word the same day), and "No thanks" walks on while the
 * character waits. What has to hold, at the sizes the client looks at:
 *
 *   - no card before "Tell me more", and nothing logged as read;
 *   - the greeting says who is speaking;
 *   - Purple's replies are on screen and are what a pointer at their centre lands on;
 *   - "No thanks" leaves for the forest with nothing read, and meeting again greets again;
 *   - "Tell me more" opens the card, headed by the same greeting, and logs it as read;
 *   - no Lime anywhere on the panel (UI_FOUNDATIONS section 2: the offer's pills are outlines).
 */

const SIZES = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
] as const;

const meet = (page: Page, c: string) =>
  page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), c);

/** Whether `selector` is inside the viewport and is what a pointer at its centre lands on. */
async function reachable(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.bottom <= innerHeight && r.right <= innerWidth && !!hit && el.contains(hit);
  });
}

for (const size of SIZES) {
  test(`the greeting comes before the card, at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await startGame(page);
    const rabbit = v2.characters.find((c) => c.id === 'rabbit')!;

    await meet(page, 'rabbit');
    const talk = page.locator('[data-offer="rabbit"][data-talk]');
    await expect(talk.locator('.otp-dialogue__speaker')).toHaveText('Rabbit');
    await expect(talk.locator('.otp-dialogue__line')).toHaveText(rabbit.greet);
    await expect(talk.locator('[data-action="ask"]')).toHaveText(v2.ui.offer.ask);
    await expect(talk.locator('[data-action="no-thanks"]')).toHaveText(v2.ui.offer.noThanks);
    await expect(page.locator('[data-card-take]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__otp!.store.getState().inspected)).toEqual([]);

    for (const sel of ['[data-action="ask"]', '[data-action="no-thanks"]'])
      expect(await reachable(page, `[data-offer] ${sel}`), sel).toBe(true);

    // No Lime on the panel: Purple's replies are outlines, like the verdicts after them.
    const lime = await talk.evaluate((root) =>
      [root, ...root.querySelectorAll('*')].some((el) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.borderTopColor, s.color].includes('rgb(191, 255, 162)');
      }),
    );
    expect(lime, 'Lime on the greeting').toBe(false);

    // "No thanks": back to the forest, nothing read, and the Rabbit greets again.
    await page.waitForTimeout(320);
    await talk.locator('[data-action="no-thanks"]').click();
    await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
    expect(await page.evaluate(() => window.__otp!.store.getState().inspected)).toEqual([]);
    await meet(page, 'rabbit');
    await expect(talk.locator('.otp-dialogue__line')).toHaveText(rabbit.greet);

    // "Tell me more": straight to the card, which does not say the greeting again, and now it is read.
    await page.waitForTimeout(320);
    await talk.locator('[data-action="ask"]').click();
    const card = page.locator('[data-offer="rabbit"][data-card]');
    await expect(card.locator('[data-card-take] li').first()).toBeVisible();
    await expect(card.getByText(rabbit.greet)).toHaveCount(0);
    await expect(card.locator('.otp-card').first()).toBeFocused();
    expect(await page.evaluate(() => window.__otp!.store.getState().inspected)).toEqual([
      rabbit.skillId,
    ]);
    expect(
      await page.evaluate(() => document.scrollingElement!.scrollWidth - innerWidth),
      'no sideways scroll',
    ).toBeLessThanOrEqual(0);
  });
}

test('Enter on "Tell me more" opens the card with focus on it', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await meet(page, 'rabbit');
  const ask = page.locator('[data-offer][data-talk] [data-action="ask"]');
  await expect(ask).toBeVisible();
  await ask.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-offer][data-card] .otp-card').first()).toBeFocused();
});

test('a finger that taps through the greeting cannot answer a card it has not had a second with', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await startGame(page);
  await meet(page, 'rabbit');
  await page.waitForTimeout(1100);
  const ask = (await page.locator('[data-action="ask"]').boundingBox())!;
  const x = ask.x + ask.width / 2;
  const y = ask.y + ask.height / 2;
  await page.touchscreen.tap(x, y);
  await expect(page.locator('[data-offer][data-card]')).toBeVisible();
  // The card mounts fresh, so a second tap on the same spot -- where Take it now is -- is still
  // the finger that asked, and answers nothing.
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__otp!.store.getState().verdicts)).toEqual({});
  await expect(page.locator('[data-offer][data-card]')).toBeVisible();
  await context.close();
});
