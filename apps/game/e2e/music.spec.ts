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

test('the choice survives a reload, and is still not autoplay', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await page.getByRole('switch', { name: /music/i }).click();
  await expect(page.getByRole('switch', { name: /music/i })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.reload();
  // Remembered on the title screen, but still silent: the run has not begun.
  await expect(page.getByRole('button', { name: /Begin the walk/ })).toBeVisible();
  expect(await contexts(page), 'remembered, but nothing sounds on the title screen').toBe(0);

  await startGame(page);
  await expect(page.getByRole('switch', { name: /music/i })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(await contexts(page), 'now the walk has begun, it plays').toBe(1);
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
