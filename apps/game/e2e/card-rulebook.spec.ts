/*
 * The rulebook is on every card, in a browser, where a player reads it.
 *
 * It used to render on the first card a run opened and no other, so the second and third verdicts
 * were given with no definition of Allow, Restrict or Reject on screen. Night Light is third in
 * content order and is the one card whose best answer is Restrict on an honest offer, so the
 * definition of "not the extras" was missing exactly where it decides the answer.
 *
 * The card is three verbs and three definitions now, and nothing else: the client asked for the
 * capability lesson to come off it, so this also asserts those labels are ABSENT. That lesson now
 * renders on Results, from the non-compact Trifecta, which until this round was mounted nowhere.
 *
 * This is the e2e half of the guard. test/content-copy.test.ts holds the definitions against the
 * content file; a unit test cannot see a `firstOpened &&` put back in front of them, and this can.
 * The strings are read from the shipped content file rather than repeated here, so rewording a
 * definition in content/game.json does not redden a browser test (CLAUDE.md rule 3).
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

const MEANS = {
  allow: 'verdictAllowMeans',
  restrict: 'verdictRestrictMeans',
  reject: 'verdictRejectMeans',
} as const;

test('every card carries the three verdict definitions, and nothing else', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  for (const [position, who] of ORDER.entries()) {
    await page.evaluate(({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
    }, who);
    await expect(page.locator('.otp-card__title')).toHaveText(who.title);

    const key = page.locator('.otp-card__primer');
    await expect(key, `card ${position + 1} (${who.title}) has no verdict key`).toHaveCount(1);

    // Three verbs, in the pills' order, each with its own line.
    await expect(key.locator('.otp-primer__verb')).toHaveText(['Allow', 'Restrict', 'Reject']);
    for (const [i, id] of (['allow', 'restrict', 'reject'] as const).entries())
      await expect(
        key.locator('.otp-primer__means').nth(i),
        `card ${position + 1} does not say what ${id} does`,
      ).toHaveText(content.strings[MEANS[id]]!);

    // Each pill names its own definition, so the pairing survives for a screen reader too.
    const paired = await page.locator('.otp-verdict').evaluateAll((els) =>
      els.map((b) => {
        const t = document.getElementById(b.getAttribute('aria-describedby') ?? '');
        return `${b.textContent!.trim()}|${t ? t.textContent!.trim() : 'MISSING'}`;
      }),
    );
    expect(paired, `card ${position + 1} pairs a pill with the wrong line`).toEqual([
      `Allow|${content.strings[MEANS.allow]}`,
      `Restrict|${content.strings[MEANS.restrict]}`,
      `Reject|${content.strings[MEANS.reject]}`,
    ]);

    // "And the rest we don't need": the B/S/W lesson is not on this card any more.
    const shown = (await key.textContent())!;
    for (const [id, leg] of Object.entries(content.capabilities))
      expect(shown, `the "${id}" lesson is back on the card`).not.toContain(leg.label);

    await expect(page.locator('.otp-verdict')).toHaveCount(3);

    // Leave without a verdict, so the next character can still be met.
    await page.locator('.otp-card__back').click();
    await page.keyboard.press('Escape');
  }
});
