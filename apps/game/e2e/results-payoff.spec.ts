/*
 * Results is the payoff screen, and docs/UX_REVIEW.md findings 9 and 15 are both about it failing
 * the player on the way out: the one Lime call to action sat 1,412px down a panel in an 860px
 * viewport, behind a form that cannot work until Phase 6, with the keyboard unable to scroll to it
 * (9); and the two errands a careful player gives up on purpose were marked with the same Black "!"
 * disc as a mistake (15).
 *
 * These guards were written to fail on the build they were written against, and each asserts the
 * behaviour the review measured rather than a class name, so a rename cannot satisfy them:
 *
 *  - arrival puts the keyboard inside the panel's own scroller, PageDown moves it, and the first
 *    Tab stop is the Lime call to action, in view;
 *  - an errand given up because the player played a skill the way the game says is right carries
 *    neither the Haze ground nor the "!", and says in words that it was a trade;
 *  - an errand thrown away by getting a skill wrong still carries both, on the same screen, so the
 *    fix is per goal and not "never say !".
 *
 * They drive the store directly, as capture.spec.ts does: the arrival beats belong to another
 * screen and walking the forest takes minutes. The scroll assertions poll, because Chromium
 * animates keyboard scrolling and an immediate read of scrollTop sees the frame before it starts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

/*
 * The wording of the trade is content, and the key is not in the shipped file yet -- Results.tsx
 * renders `strings['errandTraded'] || 'Traded for the boundary'`. These guards were pinned to that
 * code literal, so the moment the key is applied with any other wording three assertions here would
 * have gone red on a correct build. Read what the game is actually configured to say, exactly as
 * the component resolves it, so the guard tracks the copy instead of fighting it.
 *
 * Read rather than imported: Playwright runs these as plain Node ESM, where a JSON import needs an
 * import attribute the rest of the workspace does not use.
 */
const strings = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
  ) as { strings: Record<string, string> }
).strings;
const TRADED = strings['errandTraded'] || 'Traded for the boundary';

type Verdict = 'allow' | 'restrict' | 'reject';

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** Plays a whole run and lands on Results, without the arrival beats in between. */
async function playToResults(page: Page, verdicts: Record<string, Verdict>): Promise<void> {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.evaluate(
    ({ verdicts, skillOf }) => {
      const { store } = window.__otp!;
      for (const [character, verdict] of Object.entries(verdicts)) {
        store.dispatch({ type: 'MEET', c: character });
        store.dispatch({ type: 'INSPECT', s: skillOf[character] });
        store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
      }
      store.dispatch({ type: 'ENTER_COTTAGE' });
      store.dispatch({ type: 'FINISH' });
    },
    { verdicts, skillOf: SKILL_OF },
  );
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

/** Restrict, Reject, Restrict: every skill played the way the game says is right. */
const PERFECT: Record<string, Verdict> = {
  rabbit: 'restrict',
  owl: 'reject',
  'lantern-keeper': 'restrict',
};

const scrollTop = (page: Page): Promise<number> =>
  page.evaluate(() => document.querySelector('.otp-screen')!.scrollTop);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await ready(page);
});

/* ------------------------------------------------------------------ finding 9 */

test('the keyboard reaches the one Lime call to action, and reaches it first', async ({ page }) => {
  await playToResults(page, PERFECT);

  const measured = await page.evaluate(() => {
    const screen = document.querySelector('.otp-screen')!;
    const cta = document.querySelector('.otp-cta')!.getBoundingClientRect();
    const band = document.querySelector('.otp-band')!;
    const form = document.querySelector('.otp-post')!;
    return {
      panelHeight: screen.scrollHeight,
      viewport: screen.clientHeight,
      ctaTop: Math.round(cta.top + screen.scrollTop),
      bandBeforeForm: (band.compareDocumentPosition(form) & 4) !== 0, // DOCUMENT_POSITION_FOLLOWING
      focused: document.activeElement?.className ?? '',
    };
  });
  console.log('finding 9:', JSON.stringify(measured));

  // The panel is longer than the viewport, which is the whole reason this test exists. If Results
  // ever gets short enough to fit, the assertions below stop meaning anything, so fail loudly
  // rather than pass silently.
  expect(measured.panelHeight).toBeGreaterThan(measured.viewport);

  // Arrival focuses the screen's own body, so the scroller the panel lives in owns the keyboard.
  // `.otp-screen` is `position: fixed`, so the document has no overflow of its own: with focus on
  // BODY, as it was, every scroll key was a no-op over 820px of unreachable panel.
  expect(measured.focused).toContain('otp-screen__body');

  // The band is above the Post form: the one dead control on the screen no longer stands between
  // the recap and the question the asset exists to ask.
  expect(measured.bandBeforeForm).toBe(true);

  // PageDown moves the panel.
  await page.keyboard.press('PageDown');
  await expect
    .poll(() => scrollTop(page), { message: 'PageDown scrolled Results' })
    .toBeGreaterThan(0);

  // And from the top, the first thing Tab lands on is the call to action itself, scrolled into view.
  await page.evaluate(() => {
    document.querySelector('.otp-screen')!.scrollTop = 0;
  });
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const rect = el?.getBoundingClientRect();
        return {
          className: el?.className ?? '',
          inView: rect ? rect.top >= 0 && rect.bottom <= window.innerHeight : false,
        };
      }),
    )
    .toEqual({ className: expect.stringContaining('otp-cta'), inView: true });
});

/* ----------------------------------------------------------------- finding 15 */

/** Whether a row says, in whatever words the content configures, that the goal was traded. */
const saysTraded = (text: string): boolean => text.toLowerCase().includes(TRADED.toLowerCase());

/** Every errand row, in order: its glyph, whether it is on the Haze "missed" ground, its words. */
async function errandRows(page: Page): Promise<{ badge: string; missed: boolean; text: string }[]> {
  return page.$$eval('.otp-recap__row--errand', (rows) =>
    rows.map((row) => ({
      badge: row.querySelector('.otp-recap__badge')?.textContent?.trim() ?? '',
      missed: row.classList.contains('otp-recap__row--missed'),
      text: row.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    })),
  );
}

test('a perfect run is never marked with the failure glyph', async ({ page }) => {
  await playToResults(page, PERFECT);
  await expect(page.locator('.otp-hero__score')).toContainText('1,000');

  const rows = await errandRows(page);
  console.log('finding 15 (perfect):', JSON.stringify(rows));

  // Two of Grandma's three errands need a capability the right verdicts withhold. Giving them up
  // is the trade the whole design is about, so neither the ground nor the glyph may call it a
  // mistake -- and the row has to say which of the three states it is in, in words.
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.missed)).toHaveLength(0);
  expect(rows.filter((r) => r.badge === '!')).toHaveLength(0);
  // Both halves of the treatment: the Restrict glyph that means "withheld on purpose", and the
  // words. The glyph assertion is what trifecta.spec.ts leans on, so it is asserted here too.
  expect(rows.filter((r) => r.badge === '⊖')).toHaveLength(2);
  expect(rows.filter((r) => saysTraded(r.text))).toHaveLength(2);

  // Nothing anywhere on a flawless run wears the "!" disc.
  const badges = await page.$$eval('.otp-recap__badge', (els) =>
    els.map((e) => e.textContent?.trim() ?? ''),
  );
  console.log('finding 15 (perfect) badges:', JSON.stringify(badges));
  expect(badges.filter((b) => b === '!')).toHaveLength(0);
});

test('an errand thrown away by getting a skill wrong is still a miss', async ({ page }) => {
  // Cottage Finder's best verdict is Restrict, which grants the basket cleanly. Rejecting it
  // throws away "Find the cottage before dark" and buys no boundary that Restrict did not buy, so
  // that row keeps the Haze ground and the "!" -- while the two deliberate refusals on the same
  // screen read as trades. The state is per goal, not per run.
  await playToResults(page, { rabbit: 'reject', owl: 'reject', 'lantern-keeper': 'restrict' });

  const rows = await errandRows(page);
  console.log('finding 15 (over-refused):', JSON.stringify(rows));

  const route = rows.find((r) => /Find the cottage before dark/.test(r.text))!;
  expect(route.missed).toBe(true);
  expect(route.badge).toBe('!');
  expect(saysTraded(route.text)).toBe(false);
  expect(rows.filter((r) => saysTraded(r.text))).toHaveLength(2);
});

test('an errand whose skill handed the capability over is a miss, not a trade', async ({
  page,
}) => {
  // Word Weaver on Restrict sends word with no hidden action, so "Leave word at the post" was
  // there to be done and simply was not done. Calling that a trade would be the same false claim
  // about the player's own run as finding 1.
  await playToResults(page, { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'restrict' });

  const rows = await errandRows(page);
  console.log('finding 15 (held and unused):', JSON.stringify(rows));

  const word = rows.find((r) => /Leave word at the post/.test(r.text))!;
  expect(word.badge).toBe('!');
  expect(word.missed).toBe(true);
});

/*
 * docs/UX_REVIEW.md 21: "800out of 1,000" and "you restricted itCaught it" announce as
 * run-together words.
 *
 * Both were two adjacent inline elements with the whitespace between them on a line break, which
 * JSX drops -- so the page's one h1 read as one word, and so did every recap row. A screenshot
 * cannot show it, because CSS puts visible space where the text has none; this reads the text the
 * way a screen reader does. Asserted as "no letter or digit touching a letter across the join",
 * not as an exact sentence, so a copy edit cannot make it pass while the join is still broken.
 */
test('nothing on Results announces as one run-together word', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await playToResults(page, PERFECT);

  const score = (await page.locator('.otp-hero__score').textContent()) ?? '';
  console.log('finding 21 (score h1):', JSON.stringify(score));
  expect(score, 'the number and "out of" are two words').toMatch(/\d\s+\S/);
  expect(score, 'a digit must never touch a letter').not.toMatch(/\d[A-Za-z]/);

  // Every row, for the run-together join; then the skill rows, which are the ones that carry the
  // verdict clause and the status word the review found stuck to it.
  for (const heading of await page.locator('.otp-recap__heading').allTextContents())
    // A lower-case letter immediately followed by a capital is two clauses with no gap.
    expect(heading, `"${heading}"`).not.toMatch(/[a-z][A-Z]/);

  const skills = await page.locator('.otp-recap__row--skill .otp-recap__heading').allTextContents();
  console.log('finding 21 (skill rows):', JSON.stringify(skills));
  expect(skills.length).toBe(3);
  for (const heading of skills)
    expect(heading, `"${heading}" says the verdict and the status as separate words`).toMatch(
      /\bit\s+\S/,
    );
});
