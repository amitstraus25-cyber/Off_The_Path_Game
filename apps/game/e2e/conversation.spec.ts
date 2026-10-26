import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startGame } from './helpers';

/** The content file: the Rabbit's two lines and Purple's replies, as the game renders them. */
const v2 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as {
  characters: { id: string; skillId: string; greet: string; offer: string }[];
  ui: { offer: { purple: string; ask: string } };
};

/*
 * THE CONVERSATION BEFORE THE CARD (the client, 2026-10-26: "like a ping pong"). Meeting someone
 * opens a short exchange: they greet, Purple asks "What have you got?", they say what they offer,
 * and "Show me" opens the card. "No thanks" walks on and the character waits. What has to hold, at
 * the sizes the client looks at:
 *
 *   - no card before "Show me", and nothing logged as read;
 *   - each turn says who is speaking, Purple's on the right;
 *   - Purple's replies are on screen and are what a pointer at their centre lands on;
 *   - "No thanks" leaves for the forest with nothing read, and meeting again starts over;
 *   - "Show me" opens the card and logs it as read;
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

/** The centre of `selector`, and whether a pointer there lands on it. */
async function reachable(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.bottom <= innerHeight && r.right <= innerWidth && !!hit && el.contains(hit);
  });
}

for (const size of SIZES) {
  test(`the conversation comes before the card, at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await startGame(page);
    const greet = v2.characters.find((c) => c.id === 'rabbit')!;
    const words = v2.ui.offer;

    await meet(page, 'rabbit');
    const talk = page.locator('[data-offer="rabbit"][data-talk]');
    await expect(talk).toHaveAttribute('data-talk', 'greet');
    await expect(talk.locator('.otp-chat__turn')).toHaveCount(1);
    await expect(talk.locator('.otp-chat__turn .otp-dialogue__line')).toHaveText(greet.greet);
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
    expect(lime, 'Lime on the conversation').toBe(false);

    await page.waitForTimeout(320);
    await talk.locator('[data-action="ask"]').click();
    await expect(talk).toHaveAttribute('data-talk', 'offer');
    const turns = talk.locator('.otp-chat__turn');
    await expect(turns).toHaveCount(3);
    await expect(turns.nth(1).locator('.otp-dialogue__speaker')).toHaveText(words.purple);
    await expect(turns.nth(1).locator('.otp-dialogue__line')).toHaveText(words.ask);
    await expect(turns.nth(2).locator('.otp-dialogue__line')).toHaveText(greet.offer);
    // Purple's turn sits on the right, the Rabbit's on the left.
    const [theirs, mine] = await Promise.all([
      turns.nth(0).boundingBox(),
      turns.nth(1).boundingBox(),
    ]);
    expect(mine!.x + mine!.width).toBeGreaterThan(theirs!.x + theirs!.width);
    expect(mine!.x).toBeGreaterThan(theirs!.x);
    for (const sel of ['[data-action="show-me"]', '[data-action="no-thanks"]'])
      expect(await reachable(page, `[data-offer] ${sel}`), sel).toBe(true);
    await expect(page.locator('[data-card-take]')).toHaveCount(0);

    // "No thanks": back to the forest, nothing read, and the Rabbit starts over.
    await talk.locator('[data-action="no-thanks"]').click();
    await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
    expect(await page.evaluate(() => window.__otp!.store.getState().inspected)).toEqual([]);
    await meet(page, 'rabbit');
    await expect(talk).toHaveAttribute('data-talk', 'greet');
    await expect(talk.locator('.otp-chat__turn')).toHaveCount(1);

    // "Show me": the card, and now it is read.
    await page.waitForTimeout(320);
    await talk.locator('[data-action="ask"]').click();
    await talk.locator('[data-action="show-me"]').click();
    await expect(
      page.locator('[data-offer="rabbit"][data-card] [data-card-take] li').first(),
    ).toBeVisible();
    await expect(page.locator('[data-offer="rabbit"][data-card] .otp-card')).toBeFocused();
    expect(await page.evaluate(() => window.__otp!.store.getState().inspected)).toEqual([
      greet.skillId,
    ]);
    expect(
      await page.evaluate(() => document.scrollingElement!.scrollWidth - innerWidth),
      'no sideways scroll',
    ).toBeLessThanOrEqual(0);
  });
}

test('a finger that taps through the replies cannot answer a card it has not had a second with', async ({
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
  await page.locator('[data-action="ask"]').tap();
  const showMe = (await page.locator('[data-action="show-me"]').boundingBox())!;
  const x = showMe.x + showMe.width / 2;
  const y = showMe.y + showMe.height / 2;
  await page.touchscreen.tap(x, y);
  await expect(page.locator('[data-offer][data-card]')).toBeVisible();
  // The card mounts fresh, so a second tap on the same spot -- where Take it now is -- is still
  // the finger that tapped "Show me", and answers nothing.
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__otp!.store.getState().verdicts)).toEqual({});
  await expect(page.locator('[data-offer][data-card]')).toBeVisible();
  await context.close();
});
