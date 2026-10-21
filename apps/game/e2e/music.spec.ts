import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

/*
 * The music exists, and it must never start on its own.
 *
 * This game embeds in an iframe on Cyera's research page. Audio that begins by itself inside
 * someone else's page is how an embed gets pulled, and it is the single thing about this feature
 * that would be noticed for the wrong reason. The guarantee is therefore tested rather than
 * intended: nothing constructs an AudioContext until the player asks for sound.
 */

/** Counts AudioContext construction from before the app has a chance to run. */
const instrument = `
  window.__audioContexts = 0;
  for (const key of ['AudioContext', 'webkitAudioContext']) {
    const Real = window[key];
    if (!Real) continue;
    window[key] = class extends Real {
      constructor(...args) {
        window.__audioContexts += 1;
        super(...args);
      }
    };
  }
`;

const contexts = (page: import('@playwright/test').Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(instrument);
});

test('nothing makes a sound until the player asks for one', async ({ page }) => {
  await page.goto('/');
  expect(await contexts(page), 'on the title screen').toBe(0);

  await startGame(page);
  expect(await contexts(page), 'after beginning the walk').toBe(0);

  await page.waitForTimeout(600);
  expect(await contexts(page), 'after a few seconds of walking').toBe(0);
});

test('the toggle starts it, and says which state it is in', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const toggle = page.getByRole('switch', { name: /music/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await contexts(page), 'one context, built on demand').toBe(1);
});

test('the choice does NOT survive a reload: nothing is stored, and nothing autoplays', async ({
  page,
}) => {
  /*
   * This test used to assert the opposite -- "the choice survives a reload" -- because the
   * preference was written to `localStorage['otp:music']`. The privacy line on the Results screen
   * says "No account, no email, no cookies", so the code was changed to match the sentence: the
   * choice lives in memory for the page and is gone with it. e2e/storage-empty.spec.ts enumerates
   * every kind of browser storage after a whole run; this is the player-facing half, that a
   * reload really does start silent and switched off.
   */
  await page.goto('/');
  await startGame(page);
  await page.getByRole('switch', { name: /music/i }).click();
  await expect(page.getByRole('switch', { name: /music/i })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(await contexts(page), 'on, so one context').toBe(1);

  await page.reload();
  await expect(page.getByRole('button', { name: /Begin the walk/ })).toBeVisible();
  expect(await contexts(page), 'a fresh page has built no audio context').toBe(0);

  await startGame(page);
  await expect(page.getByRole('switch', { name: /music/i })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(await contexts(page), 'the walk began and the reloaded page stayed silent').toBe(0);
});

test('turning it off again stops it', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  const toggle = page.getByRole('switch', { name: /music/i });
  await toggle.click();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  // No second context: stopping tears the first one down rather than leaving it running silently.
  expect(await contexts(page)).toBe(1);
});
