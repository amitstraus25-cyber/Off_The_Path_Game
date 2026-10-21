import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAllAndArrive, startGame, toTheReveal } from './helpers';

/*
 * The v2 screens' accessibility contract, checked in a real browser: each screen has exactly one
 * h1; the offer and the card are modal dialogs that hold focus and back out one level per Esc;
 * nothing on the reveal says safe or unsafe by colour alone; and the live regions the world
 * speaks through are there before they speak (a region inserted with its text is announced by
 * no screen reader).
 */

const h1s = (page: Page) => page.locator('h1:visible, h1.otp-visually-hidden').count();

test('every screen has exactly one h1', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  expect(await h1s(page), 'landing').toBe(1);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  expect(await h1s(page), 'how-to').toBe(1);
  await page.getByRole('button', { name: 'Start walking' }).click();
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
  expect(await h1s(page), 'forest').toBe(1);
  await answerAllAndArrive(page, 'leave');
  await page.locator('[data-arrive]').waitFor();
  expect(await h1s(page), 'arrive').toBe(1);
  await toTheReveal(page);
  expect(await h1s(page), 'reveal').toBe(1);
});

test('the offer and the card are modal, hold focus, and Esc backs out one level at a time', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));

  const offer = page.getByRole('dialog', { name: /Rabbit/ });
  await expect(offer).toHaveAttribute('aria-modal', 'true');
  await expect(offer.locator('[data-action="inspect"]')).toBeFocused();
  // Tab never leaves the panel: round the whole ring and focus is still inside.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await offer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }

  await offer.locator('[data-action="inspect"]').click();
  const card = page.getByRole('dialog', { name: 'Cottage Finder' });
  await expect(card).toHaveAttribute('aria-modal', 'true');
  await expect(card.locator('.otp-card')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'talk');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  // Walking away answered nothing: the Rabbit still offers.
  expect(await page.evaluate(() => window.__otp!.store.getState().verdicts)).toEqual({});
});

test('the reveal says safe and unsafe in words and shapes, never by colour alone', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  await answerAllAndArrive(page, 'take');
  await toTheReveal(page);
  const rows = page.locator('[data-reveal]');
  await expect(rows).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    const row = rows.nth(i);
    const kind = await row.getAttribute('data-kind');
    await expect(row.locator('.otp-recap__status')).toHaveText(kind === 'good' ? 'Safe' : 'Unsafe');
    await expect(row.locator('.otp-recap__badge')).toHaveAttribute(
      'data-glyph',
      kind === 'good' ? 'check' : 'missed',
    );
  }
  // The post notice is mounted before anything is posted, so its first sentence is announced.
  await expect(page.locator('[data-announce="post"]')).toHaveCount(1);
  await expect(page.locator('[data-announce="post"]')).toHaveText('');
});

test('the forest speaks through regions that are already there', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await expect(page.locator('[data-announce="near"]')).toHaveCount(1);
  await expect(page.locator('[data-hud-announce]')).toHaveCount(1);
  await expect(page.getByRole('timer', { name: 'Time left' })).toBeVisible();
});
