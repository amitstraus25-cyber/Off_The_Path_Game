import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * A QUESTION BUTTON IS A QUESTION BUTTON WHILE THE LINE IS STILL TYPING.
 *
 * The defect: `choose()` in ui/Dialogue.tsx opened with `if (!done) { skip(); return; }`, so the
 * first press on a question while the character was still talking finished the line and asked
 * nothing. Nine of those a run -- there are nine questions -- on the interaction the game is named
 * for, and it only ever shipped because every other test in this suite either waits for the line to
 * finish before it presses anything (`openDialogue` in ui.spec.ts says so in a comment) or
 * dispatches `ASK` straight to the store and never touches the button at all.
 *
 * So this one does neither. It presses the real buttons, with motion ON, while the typewriter is
 * demonstrably running, and reads the store afterwards. "Show me the skill" and "Take it as
 * offered" already stop propagation and act mid-typing; the questions are made to match.
 */

/** Opens Rabbit's dialogue through the store and does NOT wait for the line, which is the point. */
async function meetRabbit(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page);
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'there is no typewriter under reduced motion, so this test would prove nothing',
  ).toBe(false);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-dialogue')).toBeVisible();
}

/**
 * The caret is rendered only while the line is still arriving, so its presence IS "still typing".
 * Read as a count because it is an anchor with no box for `toBeVisible` to find. Asserted before
 * each press: a press made after the line had finished would pass on the broken code too.
 */
const stillTyping = (page: Page) =>
  expect(
    page.locator('.otp-dialogue__caret'),
    'the line had already finished, so this press proves nothing about pressing mid-type',
  ).toHaveCount(1);

const asked = (page: Page): Promise<string[]> =>
  page.evaluate(() => window.__otp!.store.getState().asked['rabbit'] ?? []);

test('two question buttons pressed in a row, mid-line, are both asked', async ({ page }) => {
  await meetRabbit(page);

  await stillTyping(page);
  await page.getByRole('option', { name: /What does it need/ }).click();
  await expect
    .poll(() => asked(page), {
      message: 'the first press while the line was typing was eaten: it skipped and asked nothing',
    })
    .toEqual(['needs']);

  // The reply is a new line, and it types too. The second press lands in the middle of it.
  await stillTyping(page);
  await page.getByRole('option', { name: /Who made it/ }).click();
  await expect
    .poll(() => asked(page), {
      message: 'the press on the second question, while its predecessor was typing, was eaten',
    })
    .toEqual(['needs', 'who']);

  // The pressing registered the question, and the line it brought is the one that ends up on screen.
  await expect(page.locator('.otp-dialogue__line')).toContainText('very popular', {
    timeout: 4000,
  });
  await expect(page.locator('.otp-dialogue__left')).toHaveText('0 questions left');
  await expect(page.getByRole('option', { name: /Who made it/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('a press on the line itself still only finishes it, and asks nothing', async ({ page }) => {
  await meetRabbit(page);
  await stillTyping(page);
  // The panel's own text: a click here is "show me the rest", never a question.
  await page.locator('.otp-dialogue__speaker').click();
  await expect(page.locator('.otp-dialogue__caret')).toHaveCount(0);
  expect(await asked(page)).toEqual([]);
});

test('Enter on a question the player arrowed to, mid-line, asks it', async ({ page }) => {
  await meetRabbit(page);
  // Focus is moved onto the line by an effect after mount; a key sent before that has no target.
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await stillTyping(page);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /What does it need/ })).toBeFocused();
  await stillTyping(page);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => asked(page), {
      message: 'Enter on a focused question, mid-line, finished the line and asked nothing',
    })
    .toEqual(['needs']);
});

test('Space on the line itself is still only "show me the rest"', async ({ page }) => {
  await meetRabbit(page);
  await stillTyping(page);
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.otp-dialogue__caret')).toHaveCount(0);
  expect(await asked(page), 'the key the title teaches answered a question unread').toEqual([]);
});
