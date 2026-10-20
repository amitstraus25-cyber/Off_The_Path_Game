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
import { loadContent, score } from '@otp/core';
import type { Content, RunEvent, Verdict } from '@otp/core';
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
const content: Content = loadContent(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
  ),
);
const strings = content.strings;
const TRADED = strings['errandTraded'] || 'Traded for the boundary';

/**
 * The sentence an errand row prints when the capability really was never in hand. It is the one
 * claim on this screen that can be false, and it was false on three rows out of three for any run
 * that allowed everything, so it is read from content the same way `TRADED` is.
 */
const NEEDED = strings['errandNeeded'] || 'Needed a skill that';

/** Which skill each traveller offers. Read off the cast, not typed out beside it. */
const SKILL_OF: Record<string, string> = Object.fromEntries(
  content.characters.map((c) => [c.id, c.skillId]),
);

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

/**
 * Every skill played the way the game itself says is right, per traveller.
 *
 * Derived from `bestVerdict` rather than spelled Restrict, Reject, Restrict. A rebalance that
 * moves one of them would have left this constant describing a run that is no longer perfect,
 * with the assertions below still passing about it.
 */
const PERFECT: Record<string, Verdict> = Object.fromEntries(
  content.characters.map((c) => [
    c.id,
    content.skills.find((s) => s.id === c.skillId)!.bestVerdict,
  ]),
);

/**
 * The run as the game recorded it, for recomputing what the screen should say.
 *
 * The store's log is typed loosely for the e2e helpers (`{ t: string }[]`); it is the same array
 * `Results.tsx` hands to `score()`, so it is read back through the real type here.
 */
const runLog = async (page: Page): Promise<RunEvent[]> =>
  (await page.evaluate(() => window.__otp!.store.getState().log)) as unknown as RunEvent[];

/** The number the headline actually prints, with the thousands separator taken back off. */
async function headlineTotal(page: Page): Promise<number> {
  const text = (await page.locator('.otp-hero__score').textContent()) ?? '';
  const digits = /^\s*([\d,]+)/.exec(text)?.[1];
  if (digits === undefined) throw new Error(`the headline opens with no number: "${text}"`);
  return Number(digits.replace(/,/g, ''));
}

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

/**
 * Every errand row, in order: its mark, whether it is on the Haze "missed" ground, its words.
 *
 * `badge` is `data-glyph`, not text. The check mark and the circled minus are drawn as SVG -- Haffer
 * carries neither U+2713 nor U+2296, so both used to render out of whatever family came next in the
 * stack -- and `data-glyph` names the mark in every state, including the typed "!", so nothing here
 * has to know which of the three the brand font happens to own.
 */
async function errandRows(page: Page): Promise<{ badge: string; missed: boolean; text: string }[]> {
  return page.$$eval('.otp-recap__row--errand', (rows) =>
    rows.map((row) => ({
      badge: row.querySelector('.otp-recap__badge')?.getAttribute('data-glyph') ?? '',
      missed: row.classList.contains('otp-recap__row--missed'),
      text: row.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    })),
  );
}

test('a perfect run is never marked with the failure glyph', async ({ page }) => {
  await playToResults(page, PERFECT);
  /*
   * THE ONE EXACT TOTAL IN THE E2E SUITE -- AND IT WAS NOT READING THE TOTAL.
   *
   * It was `toContainText('1,000')`, against an h1 that reads "<total> out of 1,000". The right
   * half of that sentence is `strings.scoreOutOf`, a constant: the assertion matched the CEILING,
   * never the score, so it passed on this run (which scores 900, as the log printed two lines
   * below says) and would have passed just as happily on a 0-point run. Three rounds have now
   * shipped a defect a guard was supposed to hold; this is one of the guards.
   *
   * Fixed by reading the number the player sees and holding it against `score()` run over the log
   * the game just recorded -- the same function Results.tsx renders from, which is also the one
   * the server recomputes with (CLAUDE.md rule 6). Nothing here spells a score out, so a weight
   * change in content/game.json still cannot redden a browser test (rule 3), and a screen that
   * printed the wrong number now cannot pass.
   */
  const expected = score(await runLog(page), content).total;
  // The premise: this really is a run worth something. Against zero the comparison below is
  // satisfied by a screen that printed nothing at all.
  expect(expected, 'the perfect run scores more than nothing').toBeGreaterThan(0);
  expect(await headlineTotal(page), 'the headline prints the score the run earned').toBe(expected);
  // And the right-hand half of the sentence is still the ceiling from content, not a stray digit.
  expect(strings['scoreOutOf'], 'content configures what the run was out of').toBeTruthy();
  await expect(page.locator('.otp-hero__score')).toContainText(strings['scoreOutOf']!);

  const rows = await errandRows(page);
  console.log('finding 15 (perfect):', JSON.stringify(rows));

  // Two of Grandma's three errands need a capability the right verdicts withhold. Giving them up
  // is the trade the whole design is about, so neither the ground nor the glyph may call it a
  // mistake -- and the row has to say which of the three states it is in, in words.
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.missed)).toHaveLength(0);
  expect(rows.filter((r) => r.badge === 'missed')).toHaveLength(0);
  // Both halves of the treatment: the Restrict glyph that means "withheld on purpose", and the
  // words. The glyph assertion is what trifecta.spec.ts leans on, so it is asserted here too.
  expect(rows.filter((r) => r.badge === 'traded')).toHaveLength(2);
  expect(rows.filter((r) => saysTraded(r.text))).toHaveLength(2);

  // Nothing anywhere on a flawless run wears the "!" disc.
  const badges = await page.$$eval('.otp-recap__badge', (els) =>
    els.map((e) => e.getAttribute('data-glyph') ?? ''),
  );
  console.log('finding 15 (perfect) badges:', JSON.stringify(badges));
  expect(badges.filter((b) => b === 'missed')).toHaveLength(0);
  // The self-check: `data-glyph` has to be there at all, or every assertion above reads '' and
  // passes on a screen with no marks on it.
  expect(badges.length, 'the badges carry data-glyph').toBeGreaterThan(3);
  expect(badges.filter((b) => b === '')).toHaveLength(0);

  // And the two drawn marks are drawn: a check mark and a circled minus from the font would be
  // text nodes, and this column renders two of its three marks out of a font that has neither.
  const drawn = await page.$$eval('.otp-recap__badge', (els) =>
    els.map((e) => ({
      glyph: e.getAttribute('data-glyph'),
      svg: e.querySelectorAll('svg').length,
    })),
  );
  for (const { glyph, svg } of drawn)
    if (glyph === 'check' || glyph === 'traded') expect(svg, `${glyph} is drawn`).toBe(1);
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
  expect(route.badge).toBe('missed');
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
  expect(word.badge).toBe('missed');
  expect(word.missed).toBe(true);

  // ...and having been carried, it must not be described as having been absent. Word Weaver on
  // Restrict puts the translator in the basket, so "Needed a skill that sends word ahead" is a
  // claim the same screen contradicts eight lines down.
  expect(word.text, `"${word.text}"`).not.toContain(NEEDED);
});

/* ------------------------------------- the rows against the basket under them */

/*
 * THE ROW AND THE BASKET ON ONE SCREEN, which is the whole of this defect and the reason it reads as
 * a lie rather than as a wording problem: an allow/allow/allow run had all three errand rows say
 * "Needed a skill that <capability>" while the Basket eight lines below showed the route, the
 * translator and the lantern that those verdicts put there. The player can see both at once.
 *
 * Asserted as "no row claims a capability was missing on a run that granted all three", against the
 * copy the content file is configured with rather than a sentence spelled here, so a rewording
 * cannot satisfy it and a content edit cannot redden it.
 */
test('no errand row claims a capability the basket shows the player holding', async ({ page }) => {
  await playToResults(page, { rabbit: 'allow', owl: 'allow', 'lantern-keeper': 'allow' });

  // What the player can see in the basket: one icon per filled slot, each named by its alt text.
  const basket = await page.$$eval('.otp-basket .otp-slot img', (imgs) =>
    imgs.map((img) => img.getAttribute('alt') ?? ''),
  );
  const rows = await errandRows(page);
  console.log('errand rows vs basket:', JSON.stringify({ rows, basket }));

  // The premise: this run really did go wrong on every errand, so the rows below are all misses.
  expect(rows).toHaveLength(3);
  expect(rows.filter((r) => r.badge === 'missed')).toHaveLength(3);

  // The premise's other half: the basket really is holding what those verdicts granted. Without
  // this the assertion underneath would pass on an empty basket, where "needed" was true all along.
  expect(basket, 'the route, the translator and the lantern are on screen').toEqual(
    expect.arrayContaining(['route', 'translator', 'lantern']),
  );

  // The claim itself, on every row.
  const lying = rows.filter((r) => r.text.includes(NEEDED));
  expect(
    lying.map((r) => r.text),
    'the run granted all three capabilities, so no row may say one was missing',
  ).toEqual([]);
});

/* ------------------------------------------------ the one conversion action */

/*
 * THE ONE CONVERSION ACTION, which did nothing in any build this repo could produce.
 *
 * "Read the Research" was a <button> whose handler is `() => emit('otp:cta', {})`, and `emit`
 * returned early whenever the embed origin was unset -- which was every build, because
 * `VITE_EMBED_ORIGIN` had exactly one occurrence repo-wide and it was the line that read it. So the
 * press was a no-op, and nothing in this suite noticed, because nothing in this suite asserted that
 * the press produced any effect at all. Three specs measured where the button was and none asked
 * what it did.
 *
 * This asserts the destination rather than the click: a real absolute https href, present with no
 * .env file anywhere, which is also what makes it survive a missing variable and what makes it
 * middle-clickable. The click itself stays unexercised on purpose -- following it would navigate
 * away from the harness, and the handler beside the href is the parent page's channel, not the
 * player's route.
 */
test('the call to action has somewhere to go', async ({ page }) => {
  await playToResults(page, PERFECT);

  const cta = await page.evaluate(() => {
    const el = document.querySelector('.otp-cta');
    return {
      tag: el?.tagName ?? '',
      href: el?.getAttribute('href') ?? '',
      target: el?.getAttribute('target') ?? '',
      rel: el?.getAttribute('rel') ?? '',
      text: el?.textContent?.trim() ?? '',
      resolved: (el as HTMLAnchorElement | null)?.href ?? '',
    };
  });
  console.log('cta:', JSON.stringify(cta));

  // The premise: it is still the call to action and still says so.
  expect(cta.text.length, 'the button still has its label').toBeGreaterThan(0);

  // A destination the browser can follow, not a handler. A <button> has no href and `window.open`
  // from a handler is exactly what a popup blocker eats.
  expect(cta.tag).toBe('A');
  expect(cta.href, 'an absolute https destination').toMatch(/^https:\/\/\S+$/);
  // Resolved by the browser too, so a relative or malformed href cannot pass the regex above.
  expect(cta.resolved).toBe(cta.href);
  expect(new URL(cta.resolved).origin, 'not this origin').not.toBe(new URL(page.url()).origin);

  // Embedded, a same-tab navigation would take the game off the research page with it; and nothing
  // here wants a handle on the opener.
  expect(cta.target).toBe('_blank');
  expect(cta.rel).toContain('noopener');

  // The brand half: the screen carries one Cyera mark, not the two it used to -- the header aside
  // and the footer both had one.
  const marks = await page.locator('.otp-screen .otp-mark').count();
  console.log('cyera marks on Results:', marks);
  expect(marks, 'one mark on the payoff screen').toBe(1);
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
