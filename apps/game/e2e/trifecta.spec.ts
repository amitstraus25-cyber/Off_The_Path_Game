import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { probe, startGame } from './helpers';

type Verdict = 'allow' | 'restrict' | 'reject';
const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

async function decide(page: Page, verdicts: Record<string, Verdict>): Promise<void> {
  await page.evaluate(
    ({ verdicts, skillOf }) => {
      const { store } = window.__otp!;
      for (const [character, verdict] of Object.entries(verdicts)) {
        store.dispatch({ type: 'MEET', c: character });
        store.dispatch({ type: 'INSPECT', s: skillOf[character] });
        store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
      }
    },
    { verdicts, skillOf: SKILL_OF },
  );
}

/** Puts Red at the notice post without walking the whole map. */
async function atNotice(page: Page): Promise<void> {
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('the HUD meter lights one leg per skill accepted', async ({ page }) => {
  // Nothing accepted yet, so there is no meter to show.
  await expect(page.locator('.otp-hud .otp-leg')).toHaveCount(0);

  await decide(page, { rabbit: 'restrict' });
  await expect(page.locator('.otp-hud .otp-leg--on')).toHaveCount(1);

  await decide(page, { 'lantern-keeper': 'allow' });
  await expect(page.locator('.otp-hud .otp-leg--on')).toHaveCount(2);
  // Two legs is survivable, so no warning yet.
  await expect(page.locator('.otp-trifecta__warning')).toBeHidden();

  await decide(page, { owl: 'restrict' });
  await expect(page.locator('.otp-hud .otp-leg--on')).toHaveCount(3);
  // The warning lives over the world, not in the frame header: rendered inside that 44px strip it
  // pushed the three capability discs out through the top of the frame.
  await expect(page.locator('.otp-world-warning')).toContainText(/all three at once/i);
  await expect(page.locator('.otp-world-frame__header .otp-trifecta__warning')).toHaveCount(0);
  // Every disc stays inside the header strip.
  const header = await page.locator('.otp-world-frame__header').boundingBox();
  for (const leg of await page.locator('.otp-world-frame__header .otp-leg').all()) {
    const box = (await leg.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(header!.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
  }
});

test('the skill card does not forecast what each verdict would leave running', async ({ page }) => {
  /*
   * The card used to state capability in three tenses at once: "It will be able to" with the
   * named capabilities, "leaves B" under each verdict, and "Already running" in the foot. It
   * named the attack and then showed which button triggered it. Translating "it needs something
   * written to shine on" into "it reads what strangers wrote" is the whole cognitive task of this
   * game, and the card was doing it for the player.
   */
  await decide(page, { rabbit: 'restrict' });
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'owl' });
    store.dispatch({ type: 'INSPECT', s: 'word-weaver' });
  });
  await expect(page.locator('.otp-card')).toBeVisible();

  await expect(page.locator('.otp-verdict')).toHaveCount(3);
  // Scoped to the card, which is the only place the grant marks were ever rendered. GrantMarks is
  // deleted, so this is now a live reintroduction guard rather than a count of something that
  // could come back anywhere: putting the answer key back on the skill card fails here.
  await expect(page.locator('.otp-card .otp-grants')).toHaveCount(0);
  await expect(page.locator('.otp-card__asks')).toHaveCount(0);
  await expect(page.locator('.otp-running')).toHaveCount(0);

  // What remains is the evidence, in one neutral style: what it does and what it asks for.
  const eyebrows = page.locator('.otp-card__main .otp-row__eyebrow');
  await expect(eyebrows).toHaveText(['What it does', 'What it asks for']);
});

/*
 * The verb primer -- that it defines Restrict, that it says "not the extras", and that it lands on
 * the first card opened and no other -- is asserted once, in e2e/ui.spec.ts, by "the verb primer
 * lands on the first card opened, whoever Red meets first". A near-identical test lived here and
 * was the weaker of the two: it met the Rabbit first, and the Rabbit is Skill 1 of 3, so it passed
 * even while the primer was rendering on `index === 1` and the player who met the Owl first never
 * saw the rules at all. The ui.spec version meets the Owl, which is the ordering that was the
 * actual bug; its `not the extras` assertion came from here.
 */

test('the notice is harmless when fewer than three legs are running', async ({ page }) => {
  await decide(page, { rabbit: 'restrict', 'lantern-keeper': 'allow' });
  await atNotice(page);

  await page.getByRole('button', { name: /Read the notice/ }).click();
  await expect(page.locator('.otp-notice__hidden')).toBeHidden();
  await expect(page.locator('.otp-notice__quiet')).toContainText(/nothing you are carrying/i);

  const after = await probe(page);
  expect(after.flags).toEqual([]);
  const basket = await page.evaluate(() => window.__otp!.store.getState().basket);
  expect(basket).toContain('letter');
});

test('taking the lantern at its word lights all three, and the notice then fires', async ({
  page,
}) => {
  // Every verdict here is defensible on its own card: the two with fine print are bounded,
  // and the lantern had nothing to hide. Together they are the trifecta.
  await decide(page, { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' });
  expect((await probe(page)).flags).toEqual([]);

  await atNotice(page);
  await page.getByRole('button', { name: /Read the notice/ }).click();

  // The line that was never on any card, in the clerical voice a reviewer would approve.
  await expect(page.locator('.otp-notice__hidden')).toContainText(/for the keeper's records/i);
  await expect(page.locator('.otp-notice__effect')).toContainText(/nothing on any card was false/i);

  const after = await probe(page);
  expect(after.flags).toEqual(['locationLeaked']);
  const basket = await page.evaluate(() => window.__otp!.store.getState().basket);
  expect(basket).not.toContain('letter');
});

test('reading the notice before the third leg is granted stays safe', async ({ page }) => {
  await decide(page, { rabbit: 'restrict', 'lantern-keeper': 'allow' });
  await atNotice(page);
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();

  await decide(page, { owl: 'restrict' });
  await expect(page.locator('.otp-hud .otp-leg--on')).toHaveCount(3);
  // Nothing was there to read it out at the time, so the words never reached anyone.
  expect((await probe(page)).flags).toEqual([]);
});

test('Red stops walking while a notice is open', async ({ page }) => {
  await atNotice(page);
  const before = await probe(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  expect((await probe(page)).position.x).toBeCloseTo(before.position.x, 0);

  await page.getByRole('button', { name: /Walk on/ }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  expect((await probe(page)).position.x).toBeGreaterThan(before.position.x + 20);
});

test('results lead with the boundary, and name the notice when it fired', async ({ page }) => {
  await decide(page, { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' });
  await atNotice(page);
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();

  const boundary = page.locator('.otp-recap__row--boundary');
  await expect(boundary).toHaveClass(/otp-recap__row--missed/);
  await expect(boundary).toContainText(/all three ran at once/i);
  await expect(boundary).toContainText(/nothing on any card was false/i);
  /*
   * The score is shown, not spelled out. Totals belong to packages/core/test/scoring.test.ts,
   * which pins every run shape under a 100% gate; asserting one here as well means a weight change
   * in content/game.json reddens a screen test, which is the thing CLAUDE.md rule 3 promises
   * cannot happen. Worth writing down, since that table does not name this shape: this run is 550
   * -- 350 for the three verdicts plus 200 for the route and the word left at the post, with no
   * question bonus and no boundary bonus -- and it is the only shape here that reads a notice.
   * Going to the post is both how the word goal gets done and how the letter leaves the basket:
   * the errand and the trap are the same walk.
   */
  await expect(page.locator('.otp-hero__score')).toBeVisible();
});

test('the careful reader keeps the boundary and gives up two errands on purpose', async ({
  page,
}) => {
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['rabbit', 'cottage-finder', 'restrict'],
      ['owl', 'word-weaver', 'reject'],
      ['lantern-keeper', 'night-light', 'restrict'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'ASK', c, q: 'needs' });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
  });
  // Best verdict on every card now leaves a single leg: only the compass reaches the basket.
  await expect(page.locator('.otp-hud .otp-leg--on')).toHaveCount(1);

  await atNotice(page);
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await expect(page.locator('.otp-notice__hidden')).toBeHidden();
  await page.getByRole('button', { name: /Walk on/ }).click();

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();

  // The total this line reaches is the perfect run's, and e2e/results-payoff.spec.ts is where that
  // one exact string is asserted; packages/core proves the arithmetic. Here it only has to appear.
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  await expect(page.locator('.otp-recap__row--boundary')).not.toHaveClass(/--missed/);
  // One of Grandma's three, and that is the top score: the other two need a messenger and a
  // lantern this line deliberately refused. Carrying out all three means running all three at
  // once, which costs more than the goals are worth -- that trade is the whole game.
  //
  // This line used to assert that the two refused goals carried `--missed`, which is the Haze
  // ground and the Black "!" that UI_FOUNDATIONS section 5 reserves for a mistake. That was the
  // bug docs/UX_REVIEW.md 15 describes -- the one run that understands the lesson being told
  // twice that it had failed -- committed as an expectation, so the assertion had to invert when
  // the bug was fixed. A goal given up to keep the boundary now takes the Restrict glyph on the
  // Natural ground; nothing on a flawless run wears the failure treatment.
  const errand = page.locator('.otp-recap__row--errand');
  await expect(errand).toHaveCount(3);
  await expect(errand.first()).not.toHaveClass(/--missed/);
  await expect(page.locator('.otp-recap__row--errand.otp-recap__row--missed')).toHaveCount(0);
  /*
   * Read off `data-glyph`, not off the text. The check mark and the circled minus are drawn as SVG
   * now, because Haffer's 789 codepoints carry neither U+2713 nor U+2296 and both were falling
   * through to whatever family came next in the stack -- two of the three marks in this column
   * rendering at a different weight and baseline from the third. `data-glyph` is on the badge in
   * every state, including the typed "!", so this assertion no longer depends on which of the three
   * happens to be a glyph the brand font owns.
   */
  const badges = await errand
    .locator('.otp-recap__badge')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-glyph')));
  expect(badges, 'one done, two withheld on purpose, none failed').toEqual([
    'check',
    'traded',
    'traded',
  ]);
});
