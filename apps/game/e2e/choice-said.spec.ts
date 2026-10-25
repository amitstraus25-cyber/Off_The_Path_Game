import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

/*
 * A SCREEN READER HEARS WHAT ITS CHOICE DID (the review of 2026-10-25, P14): after Take it and
 * after Leave it, one sentence in a polite hidden region -- the skill, the basket, who is left.
 */
test('each choice is said in a hidden polite region', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  const said = page.locator('[data-choice-said]');
  await expect(said).toHaveAttribute('aria-live', 'polite');
  const [first, second] = await page.evaluate(() => window.__otp!.content.characters.slice(0, 2));
  const skills = await page.evaluate(() => window.__otp!.content.skills);
  const name = (id: string) => skills.find((s) => s.id === id)!.name;

  await page.evaluate((c) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: c.id });
    store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'take' });
  }, first!);
  await expect(said).toHaveText(`You took ${name(first!.skillId)}. Basket: 1. 6 left to meet.`);

  await page.evaluate((c) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: c.id });
    store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'leave' });
  }, second!);
  await expect(said).toHaveText(`You left ${name(second!.skillId)}. 5 left to meet.`);
});
