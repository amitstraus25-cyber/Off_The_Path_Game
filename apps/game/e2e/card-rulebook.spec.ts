/*
 * The rulebook is on every card, in a browser, where a player reads it.
 *
 * It used to render on the first card a run opened and no other, so the second and third verdicts
 * were given with no definition of Allow, Restrict or Reject on screen. Night Light is third in
 * content order and is the one card whose best answer is Restrict on an honest offer, so the
 * definition of "not the extras" was missing exactly where it decides the answer.
 *
 * The capability sentences had never rendered anywhere at all: `content.capabilities[*].detail` is
 * drawn only by `.otp-leg__detail`, and every mount of Trifecta passes `compact`.
 *
 * This is the e2e half of the guard. test/content-copy.test.ts holds the paragraph against the
 * content file; a unit test cannot see a `firstOpened &&` put back in front of it, and this can.
 * The strings are read from the shipped content file rather than repeated here, so rewording the
 * primer in content/game.json does not redden a browser test (CLAUDE.md rule 3).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as {
  capabilities: Record<string, { label: string; detail: string }>;
  strings: Record<string, string>;
};

/* Opened in the order a player who walks north-east first meets them, which is not content order. */
const ORDER = [
  { c: 'owl', s: 'word-weaver', title: 'Word Weaver' },
  { c: 'rabbit', s: 'cottage-finder', title: 'Cottage Finder' },
  { c: 'lantern-keeper', s: 'night-light', title: 'Night Light' },
];

test('every card carries the verbs and the three capabilities, not just the first', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);

  for (const [position, who] of ORDER.entries()) {
    await page.evaluate(({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
    }, who);
    await expect(page.locator('.otp-card__title')).toHaveText(who.title);

    const rulebook = page.locator('.otp-card__primer');
    await expect(rulebook, `card ${position + 1} (${who.title}) has no rulebook`).toHaveCount(1);
    const shown = (await rulebook.textContent())!;

    // The verbs. "Restrict" is the one the game has no other way of explaining.
    for (const verb of ['Allow', 'Restrict', 'Reject'])
      expect(shown, `card ${position + 1} does not define ${verb}`).toContain(`${verb}:`);
    expect(shown).toContain('not the extras');

    // The three legs, each with the sentence that says what its label actually means.
    for (const [id, leg] of Object.entries(content.capabilities)) {
      expect(shown, `card ${position + 1} does not name "${id}"`).toContain(leg.label);
      expect(shown, `card ${position + 1} names "${id}" but never explains it`).toContain(
        leg.detail,
      );
    }

    // And it is still a card, not only a rulebook: the three verdicts are reachable below it.
    await expect(page.locator('.otp-verdict')).toHaveCount(3);

    // Leave without a verdict, so the next character can still be met.
    await page.locator('.otp-card__back').click();
    await page.keyboard.press('Escape');
  }
});
