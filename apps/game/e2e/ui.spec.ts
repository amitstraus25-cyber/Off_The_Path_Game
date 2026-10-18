import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { probe, startGame } from './helpers';

/** Opens the Rabbit dialogue through the store, so these tests do not depend on walking. */
async function openDialogue(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-dialogue')).toBeVisible();
  // Let the typewriter finish: while a line is still typing, any activation means "show me the
  // rest of it", never "ask this question".
  await expect(page.locator('.otp-dialogue__line')).toContainText('find Grandma.');
}

test('the dialogue shows the speaker, the greeting and the two questions', async ({ page }) => {
  await openDialogue(page);

  await expect(page.locator('.otp-panel__number')).toHaveText('02');
  await expect(page.locator('.otp-panel__title')).toHaveText('Question');
  await expect(page.locator('.otp-chip')).toContainText('Asking costs nothing');
  await expect(page.locator('.otp-dialogue__speaker')).toHaveText('Rabbit');
  await expect(page.getByRole('img', { name: 'Rabbit' })).toBeVisible();
  await expect(page.locator('.otp-dialogue__line')).toContainText('compass', { timeout: 4000 });

  // "Show me the skill" is its own action below the hairline, not a third question.
  const options = page.getByRole('option');
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveText(/What does it need\?/);
  await expect(options.nth(1)).toHaveText(/Who made it\?/);
  await expect(page.locator('.otp-dialogue__show')).toContainText('Show me the skill');
  await expect(page.locator('.otp-dialogue__left')).toHaveText('2 questions left');
});

test('the questions-left counter drops as questions are asked', async ({ page }) => {
  await openDialogue(page);
  await page.getByRole('option', { name: /What does it need/ }).click();
  await expect(page.locator('.otp-dialogue__left')).toHaveText('1 question left');
});

test('asking a question replaces the line and marks the option used', async ({ page }) => {
  await openDialogue(page);
  await page.getByRole('option', { name: /What does it need/ }).click();

  await expect(page.locator('.otp-dialogue__line')).toContainText('look around', { timeout: 4000 });
  await expect(page.getByRole('option', { name: /What does it need/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  const asked = await page.evaluate(() => window.__otp!.store.getState().asked);
  expect(asked['rabbit']).toEqual(['needs']);
});

test('the dialogue is operable from the keyboard alone', async ({ page }) => {
  await openDialogue(page);
  await page.waitForTimeout(300);

  // Focus lands on the line, not on a question: an option commits a choice, and the panel opens
  // with the player mid-read.
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /What does it need/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Who made it/ })).toBeFocused();
  await page.keyboard.press('ArrowDown'); // wraps back round the two questions
  await expect(page.getByRole('option', { name: /What does it need/ })).toBeFocused();

  // Tab reaches the inspect action, which is a button rather than an option.
  const show = page.locator('.otp-dialogue__show');
  for (let i = 0; i < 5; i++) {
    if (await show.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(show).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toBeVisible();
  expect((await probe(page)).phase).toBe('inspect');
});

test('Esc backs out one level at a time and never skips a verdict', async ({ page }) => {
  await openDialogue(page);
  await page.locator('.otp-dialogue__show').click();
  await expect(page.locator('.otp-card')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeHidden();

  const state = await probe(page);
  expect(state.phase).toBe('explore');
  expect(state.verdicts).toEqual({});
});

test('the skill card shows provenance, two neutral rows and three identical verdicts', async ({
  page,
}) => {
  await openDialogue(page);
  await page.locator('.otp-dialogue__show').click();

  await expect(page.locator('.otp-panel__number')).toHaveText('03');
  await expect(page.locator('.otp-chip')).toContainText('Skill 1 of 3');
  await expect(page.locator('.otp-card__eyebrow')).toHaveText('Offered by the Rabbit');
  await expect(page.locator('.otp-card__title')).toHaveText('Cottage Finder');

  // Both rows share one neutral style; the card never signals danger (binding change 3).
  const eyebrows = page.locator('.otp-card__main .otp-row__eyebrow');
  await expect(eyebrows.nth(0)).toHaveText('What it does');
  await expect(eyebrows.nth(1)).toHaveText('What it asks for');
  await expect(page.locator('.otp-card__main .otp-row--warn')).toHaveCount(0);
  const rowBackgrounds = await page
    .locator('.otp-card__main .otp-row')
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  expect(new Set(rowBackgrounds).size, 'both card rows must look identical').toBe(1);

  const verdicts = page.locator('.otp-verdict__label');
  await expect(verdicts).toHaveCount(3);
  await expect(verdicts.nth(0)).toHaveText('Allow');
  await expect(verdicts.nth(2)).toHaveText('Reject');
});

test('all three cards are the same shape, so the honest one cannot be spotted by its outline', async ({
  page,
}) => {
  /*
   * Night Light asks for nothing, which used to mean its card rendered one row where the other
   * two rendered two. That taught a player to count rows instead of reading them, and the whole
   * point of the card is that you cannot tell what a skill does without reading what it asks for.
   */
  await page.goto('/');
  await startGame(page);

  const cards: { rows: number; eyebrows: string[]; asks: string }[] = [];
  for (const pair of [
    { c: 'rabbit', s: 'cottage-finder' },
    { c: 'owl', s: 'word-weaver' },
    { c: 'lantern-keeper', s: 'night-light' },
  ]) {
    await page.evaluate(({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
    }, pair);
    await expect(page.locator('.otp-card')).toBeVisible();

    const rows = page.locator('.otp-card__main .otp-row');
    cards.push({
      rows: await rows.count(),
      eyebrows: await page
        .locator('.otp-card__main .otp-row__eyebrow')
        .evaluateAll((els) => els.map((e) => e.textContent!.trim())),
      asks: (await rows.nth(1).locator('.otp-row__heading').textContent())!.trim(),
    });

    await page.locator('.otp-card__back').click();
    await page.keyboard.press('Escape');
  }

  expect(
    cards.map((c) => c.rows),
    'every card is two rows',
  ).toEqual([2, 2, 2]);
  for (const c of cards) expect(c.eyebrows).toEqual(['What it does', 'What it asks for']);

  // The honest card still says it asks for nothing — you just have to read it to find that out.
  expect(cards[2]!.asks).toContain('no fine print');
  expect(cards[2]!.asks).not.toBe(cards[0]!.asks);
});

test('a card can be left without recording a verdict, on desktop and on a phone', async ({
  browser,
}) => {
  /*
   * Enumerating the controls on this card at phone size returned exactly Allow, Restrict, Reject
   * and the world's A button: a player who opened a card had to commit to one of three answers
   * that cannot be taken back. Esc dispatched BACK the whole time, but nothing said so and a
   * phone has no Esc key.
   */
  for (const options of [{ viewport: { width: 1280, height: 800 } }, devices['iPhone 13']]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: 'rabbit' });
      store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    });
    await expect(page.locator('.otp-card')).toBeVisible();

    const back = page.locator('.otp-card__back');
    await expect(back).toBeVisible();
    /*
     * Rounded, because a laid-out box is a float and this assertion is about a thumb, not a
     * floating-point value: on the iPhone 13 context the engine returns 43.99998474121094 for the
     * element CSS declares as min-height: 44px, so comparing the raw number failed about half the
     * time. A flaky test is worse than no test.
     */
    const box = (await back.boundingBox())!;
    expect(
      Math.round(box.height),
      'the way out must be a thumb-sized target',
    ).toBeGreaterThanOrEqual(44);
    await back.click();

    await expect(page.locator('.otp-dialogue')).toBeVisible();
    const state = await probe(page);
    expect(state.phase).toBe('dialogue');
    expect(state.verdicts, 'leaving a card records no verdict').toEqual({});

    // Leaving does not un-read it: the run log still says this card was opened, which is what
    // the "took it on trust" scoring turns on.
    const inspected = await page.evaluate(() => window.__otp!.store.getState().inspected);
    expect(inspected).toEqual(['cottage-finder']);

    await context.close();
  }
});

test('the verb primer lands on the first card opened, whoever Red meets first', async ({
  page,
}) => {
  /*
   * The primer is the only place the game says what Restrict means, and GAME_DESIGN section 4
   * requires the right answer to be discoverable. It used to render on `index === 1`, the skill's
   * position in the content file, so meeting the Owl first opened "Skill 2 of 3" and the rules
   * never appeared.
   */
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'owl' });
    store.dispatch({ type: 'INSPECT', s: 'word-weaver' });
  });
  await expect(page.locator('.otp-chip')).toContainText('Skill 2 of 3');
  await expect(page.locator('.otp-card__primer')).toContainText('Restrict:');

  // And only once: the second card opened is a card, not a rulebook.
  await page.locator('.otp-card__back').click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
  });
  await expect(page.locator('.otp-card__title')).toHaveText('Cottage Finder');
  await expect(page.locator('.otp-card__primer')).toHaveCount(0);
});

test('a verdict updates the basket and returns to the world', async ({ page }) => {
  await openDialogue(page);
  await page.locator('.otp-dialogue__show').click();

  // Before: key and letter only. The basket is the one in the world's HUD, visible through the
  // dim, since the card no longer carries its own.
  await expect(page.locator('.otp-hud-slot img')).toHaveCount(2);
  await page.getByRole('button', { name: 'Restrict' }).click();

  const state = await probe(page);
  expect(state.phase).toBe('explore');
  expect(state.verdicts).toEqual({ 'cottage-finder': 'restrict' });
  const basket = await page.evaluate(() => window.__otp!.store.getState().basket);
  expect(basket).toEqual(['key', 'letter', 'route']);
});

test('Inspect carries no Lime at all, and no red or green status colour is used', async ({
  page,
}) => {
  await openDialogue(page);
  await page.locator('.otp-dialogue__show').click();

  const limeCount = await page.evaluate(() => {
    const lime = getComputedStyle(document.documentElement)
      .getPropertyValue('--cyera-lime')
      .trim()
      .toLowerCase();
    const toHex = (rgb: string): string => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
      if (!m) return rgb;
      return `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`;
    };
    let count = 0;
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundColor;
      if (toHex(bg) === lime) count++;
    }
    return count;
  });
  // Binding change 2: "A verdict is not a call to action. Lime on Allow makes the unsafe answer
  // the brightest thing on the screen, so the three verdicts carry no fill at all."
  expect(limeCount, 'Inspect must carry no Lime').toBe(0);

  // Park the pointer clear of the card: clicking "Show me the skill" leaves the mouse where the
  // link was, and this assertion is about how the three pills look at rest, not under hover.
  await page.mouse.move(2, 2);

  // All three verdict pills are identical: same fill, same border, same text colour.
  const styles = await page.locator('.otp-verdict').evaluateAll((els) =>
    els.map((e) => {
      const s = getComputedStyle(e);
      return `${s.backgroundColor}|${s.borderTopColor}|${s.color}`;
    }),
  );
  expect(new Set(styles).size, 'the three verdicts must look identical').toBe(1);
});

test('panels fit without horizontal scrolling at 375, 768 and 1280', async ({ browser }) => {
  for (const width of [375, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: 'rabbit' });
      store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    });
    await expect(page.locator('.otp-card')).toBeVisible();

    const fits = await page.evaluate(() => {
      const card = document.querySelector('.otp-card')!.getBoundingClientRect();
      const panel = document.querySelector('.otp-panel')!.getBoundingClientRect();
      // The basket lives in the world's HUD now, not on the card.
      const basket = document.querySelector('.otp-hud-basket')!.getBoundingClientRect();
      return {
        cardInPanel: card.right <= panel.right + 1 && card.left >= panel.left - 1,
        basketOnScreen: basket.bottom <= innerHeight + 1,
        noHScroll: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    expect(fits, `at ${width}px`).toEqual({
      cardInPanel: true,
      basketOnScreen: true,
      noHScroll: true,
    });
    await context.close();
  }
});

test('every verdict stays reachable at laptop and landscape-phone heights', async ({ browser }) => {
  /*
   * The Inspect group is the tallest thing in the game. `.otp-layer` is position: fixed, and a
   * fixed box produces no scrollbar, so anything taller than the viewport used to be painted
   * outside it and could not be reached by scroll, wheel or focus — the run could not be
   * finished. The sizes below are the ones that were broken; 800px tall, which the test above
   * uses, was just tall enough to hide it.
   */
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: 'rabbit' });
      store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    });
    await expect(page.locator('.otp-card')).toBeVisible();

    const pills = page.locator('.otp-verdict');
    await expect(pills).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await pills.nth(i).scrollIntoViewIfNeeded();
      await expect(pills.nth(i), `${size.width}x${size.height} verdict ${i}`).toBeInViewport();
    }
    await context.close();
  }
});

test('the HUD basket shows what Red carries, and loses the key when she allows it', async ({
  page,
}) => {
  /*
   * Losing the key is the consequence the whole game turns on, and it used to be invisible: the
   * only basket was on the Inspect panel, which unmounts in the same tick as the verdict.
   */
  await page.goto('/');
  await startGame(page);

  const filled = page.locator('.otp-hud-slot:not(.otp-hud-slot--empty)');
  await expect(page.locator('.otp-hud-slot')).toHaveCount(5);
  await expect(filled).toHaveCount(2);
  await expect(filled.nth(0).locator('img')).toHaveAttribute('alt', 'key');
  await expect(filled.nth(1).locator('img')).toHaveAttribute('alt', 'letter');

  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'allow' });
  });

  // The departing item is held on screen so it can be watched leaving, then the row settles.
  await expect(page.locator('.otp-hud-slot--leaving')).toHaveCount(1);
  await expect(page.locator('.otp-hud-slot--leaving img')).toHaveAttribute('alt', 'key');

  // Afterwards the key is gone and the route it traded for has arrived.
  await expect(filled.locator('img[alt="key"]')).toHaveCount(0);
  const alts = await filled
    .locator('img')
    .evaluateAll((els) => els.map((e) => e.getAttribute('alt')));
  expect(alts).toEqual(['letter', 'route']);
});

test('the notation chip shows the quest and the skills-seen count while exploring', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  const chip = page.locator('.otp-hud .otp-chip');
  await expect(chip).toContainText('Find Grandma');
  await expect(chip).toContainText('0 of 3 skills seen');

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-hud .otp-chip')).toBeHidden();
});

test('the decorative dots are gone and only brand radii are used', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await expect(page.locator('.otp-panel__dots')).toHaveCount(0);

  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
  });
  await expect(page.locator('.otp-card')).toBeVisible();

  // Binding change 5: three radii only (plus 50% for discs).
  const radii = await page.evaluate(() => {
    const seen = new Set<string>();
    for (const el of document.querySelectorAll('.otp-ui *')) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (r && r !== '0px') seen.add(r);
    }
    return [...seen];
  });
  const allowed = (r: string): boolean =>
    r === '20px' || r === '10px' || r === '50%' || parseFloat(r) >= 100;
  expect(
    radii.filter((r) => !allowed(r)),
    `unexpected radii: ${radii.join(', ')}`,
  ).toEqual([]);
});

test('Season Mix is never set in italic', async ({ page }) => {
  await page.goto('/');
  const styles = await page
    .locator('.otp-serif')
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).fontStyle));
  expect(styles.length).toBeGreaterThan(0);
  expect(
    styles.every((s) => s === 'normal'),
    'binding change 1: always upright',
  ).toBe(true);
});
