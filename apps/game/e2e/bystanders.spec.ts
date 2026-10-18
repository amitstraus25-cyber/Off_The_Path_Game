import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { mapObject, probe, startGame, walkTo } from './helpers';

// Read rather than import: Playwright runs these as plain Node ESM, where a JSON import needs an
// import attribute the rest of the workspace does not use.
const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as { bystanders: { name: string; spawn: string; lines: string[] }[] };

/*
 * Bystanders are the one thing in the forest that talks and decides nothing. The point of these
 * tests is the negative: greeting one must leave the run exactly where it was. If a bystander
 * ever starts a dialogue, writes to the log or counts towards the cottage gate, the player has
 * been handed a fourth decision and the five-minute shape of the game is gone.
 */

const toadstool = content.bystanders[0]!;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('greeting a bystander says a line and changes nothing', async ({ page }) => {
  const spot = await mapObject(page, toadstool.spawn);
  await walkTo(page, { x: spot.x + 16, y: spot.y + 40 });
  const before = await probe(page);

  await page.keyboard.press('Space');
  const bubble = page.locator('.otp-say');
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText(toadstool.name);
  await expect(bubble).toContainText(toadstool.lines[0]!);

  const after = await probe(page);
  expect(after.phase).toBe('explore');
  expect(after.activeCharacter).toBeNull();
  expect(after.verdicts).toEqual(before.verdicts);
  expect(after.basket).toEqual(before.basket);
  expect(after.flags).toEqual(before.flags);
  expect(after.log.length).toBe(before.log.length);
});

test('greeting again moves to the next line, and the bubble fades on its own', async ({ page }) => {
  const spot = await mapObject(page, toadstool.spawn);
  await walkTo(page, { x: spot.x + 16, y: spot.y + 40 });

  await page.keyboard.press('Space');
  await expect(page.locator('.otp-say')).toContainText(toadstool.lines[0]!);
  await page.keyboard.press('Space');
  await expect(page.locator('.otp-say')).toContainText(toadstool.lines[1]!);

  // Nothing to dismiss: a passing remark must not need a click to get rid of.
  await expect(page.locator('.otp-say')).toBeHidden({ timeout: 8000 });
});

test('a bystander does not count towards the cottage gate', async ({ page }) => {
  const spot = await mapObject(page, toadstool.spawn);
  await walkTo(page, { x: spot.x + 16, y: spot.y + 40 });
  await page.keyboard.press('Space');
  await expect(page.locator('.otp-say')).toBeVisible();

  const locked = await page.evaluate(() => {
    const { store } = window.__otp!;
    return Object.keys(store.getState().verdicts).length;
  });
  expect(locked).toBe(0);
});
