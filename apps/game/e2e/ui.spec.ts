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

  // Scoped to `.otp-panel`, which is only ever the modal: the world frame no longer unmounts
  // behind a panel, so `.otp-panel__number` and `.otp-chip` each match twice -- the frame's and
  // the modal's. The assertion is unchanged; it just has to say which one it means.
  await expect(page.locator('.otp-panel .otp-panel__number')).toHaveText('02');
  await expect(page.locator('.otp-panel .otp-panel__title')).toHaveText('Question');
  await expect(page.locator('.otp-panel .otp-chip')).toContainText('Asking costs nothing');
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

  await expect(page.locator('.otp-panel .otp-panel__number')).toHaveText('03');
  await expect(page.locator('.otp-panel .otp-chip')).toContainText('Skill 1 of 3');
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
  /*
   * "Skill 1 of 3", not "Skill 2 of 3". The card is now numbered by the cards the player has
   * actually opened (`state.inspected.indexOf(id) + 1`) rather than by the skill's position in
   * content/game.json, so the FIRST card opened says 1 whoever offered it. The old expectation was
   * the content-file ordinal -- which is the defect this test's own comment describes, written down
   * as the expected value, so it would have gone red on the correct build.
   */
  await expect(page.locator('.otp-panel .otp-chip')).toContainText('Skill 1 of 3');
  await expect(page.locator('.otp-card__primer')).toContainText('Restrict:');
  // Not just that Restrict is named, but that the primer says what it MEANS. This came from a
  // second copy of this test in e2e/trifecta.spec.ts, which met the Rabbit -- Skill 1 of 3, the
  // ordering that passed even while the bug above was live -- and so could never catch it.
  await expect(page.locator('.otp-card__primer')).toContainText(/not the extras/);

  /*
   * And on EVERY card, not only the first. This tail used to assert `toHaveCount(0)` on the second
   * card -- "the second card opened is a card, not a rulebook" -- which was the defect, not the
   * rule: the primer is the only place the game defines Allow, Restrict and Reject, and Night Light
   * is card three, so two verdicts out of three were decided with no definition on screen at all.
   * The rulebook now rides on every card. e2e/card-rulebook.spec.ts checks all three in order; this
   * checks the one a unit test cannot, that the second card still carries it.
   */
  await page.locator('.otp-card__back').click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
  });
  await expect(page.locator('.otp-card__title')).toHaveText('Cottage Finder');
  await expect(page.locator('.otp-panel .otp-chip')).toContainText('Skill 2 of 3');
  await expect(page.locator('.otp-card__primer')).toContainText('Restrict:');
  await expect(page.locator('.otp-card__primer')).toContainText(/not the extras/);
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

  /*
   * The quest chip STAYS when 02 Question opens. This used to assert `toBeHidden()` -- the HUD
   * vanishing behind a panel was the client's "things that jump", and the expectation was the
   * defect written down, the same trap as Title's old `ctaReachable` check which scrolled the card
   * before measuring it. The world frame and its HUD are now hoisted out of the phase switch and
   * the modal is laid over them, so the chip is still there and still counting.
   */
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-hud .otp-chip')).toBeVisible();
  await expect(page.locator('.otp-hud .otp-chip')).toContainText('Find Grandma');
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

  /*
   * Binding change 5: three radii only (plus 50% for discs).
   *
   * One addition, and it is a shape a player never sees as its own corner. `.otp-world-frame`
   * is a 20px panel with a 3px Deep Purple border, and its header bar sits INSIDE that border, so
   * for the header to follow the frame's curve its radius must be the frame's inset by the border
   * -- 17px here. That is one corner, not two: the outer edge the player looks at is still 20px.
   * The frame used to unmount for 02 Question and 03 Inspect, and this guard only samples after
   * opening the card, which was the single moment the frame was absent -- so a value that is on
   * screen for the whole of Explore was never measured until the frame stopped unmounting.
   *
   * The concession is measured, not hardcoded: the inner radius is read off the frame's own
   * computed radius and border width in the same frame, so moving `--otp-r-panel` moves both sides
   * and 17 never becomes a magic number. The visible OUTER corner is asserted separately below,
   * which is the thing the rule is actually about.
   */
  const shape = await page.evaluate(() => {
    const frame = document.querySelector('.otp-world-frame');
    const fs = frame ? getComputedStyle(frame) : null;
    const outer = fs ? parseFloat(fs.borderTopLeftRadius) : NaN;
    const border = fs ? parseFloat(fs.borderTopWidth) : NaN;
    const seen = new Set<string>();
    for (const el of document.querySelectorAll('.otp-ui *')) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (r && r !== '0px') seen.add(r);
    }
    return { radii: [...seen], outer, border };
  });
  // The frame's own visible corner is a brand radius. This is what a player sees.
  expect(shape.outer, 'the world frame has stopped using the 20px panel radius').toBe(20);
  const concentric = `${shape.outer - shape.border}px`;
  const allowed = (r: string): boolean =>
    r === '20px' || r === '10px' || r === '50%' || r === concentric || parseFloat(r) >= 100;
  expect(
    shape.radii.filter((r) => !allowed(r)),
    `unexpected radii: ${shape.radii.filter((r) => !allowed(r)).join(', ')} ` +
      `(all seen: ${shape.radii.join(', ')}; the frame's concentric inner corner is ${concentric})`,
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

/* ======================================================= panels: nothing moves, nothing is covered

   Four reference viewports, used by every sweep below. Two portrait phones under the 812 that the
   existing collision guard in e2e/css-contract.spec.ts starts at, and two landscape phones, which
   that guard visits for the toast not at all. */
const REFERENCE: readonly (readonly [number, number])[] = [
  [320, 568],
  [375, 667],
  [568, 320],
  [812, 375],
];

async function resize(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, width);
  // Two frames: one for the resize handler, one for the layout it causes.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

/**
 * Every distinct position and size the spoken line and its panel take, sampled once per frame for
 * as long as the caller asks.
 *
 * This is the only honest way to see the defect it guards. The sentence is dragged by its own panel
 * growing a line at a time, and `layout-shift` scores none of the worst of it: half the movement
 * happens while the typewriter is running, where the entries are real but tiny, and the rest happens
 * on the frame after a click, where `hadRecentInput` discards them. What a player sees is the line
 * they are reading changing position, so that is what is measured -- the top edge of the line's own
 * box, in viewport coordinates, as a set.
 *
 * The first frames are dropped because `.otp-layer--modal` plays `otp-panel-in`, a 180ms
 * `translateY(8px)`. That is the panel arriving, not the panel growing, and a bounding rect cannot
 * tell the two apart.
 */
function samplePanel(
  page: Page,
  frames: number,
): Promise<{ lineTop: number[]; lineHeight: number[]; panelHeight: number[] }> {
  return page.evaluate((count) => {
    const lineTop = new Set<number>();
    const lineHeight = new Set<number>();
    const panelHeight = new Set<number>();
    let seen = 0;
    return new Promise<{ lineTop: number[]; lineHeight: number[]; panelHeight: number[] }>(
      (done) => {
        const tick = (): void => {
          seen += 1;
          // 24 frames is comfortably past the 180ms slide at 60Hz and at 120Hz.
          if (seen > 24) {
            const line = document.querySelector('.otp-dialogue__line');
            const panel = document.querySelector('.otp-panel');
            if (line) {
              const box = line.getBoundingClientRect();
              lineTop.add(Math.round(box.top * 10) / 10);
              lineHeight.add(Math.round(box.height * 10) / 10);
            }
            if (panel) panelHeight.add(Math.round(panel.getBoundingClientRect().height * 10) / 10);
          }
          if (seen < count + 24) requestAnimationFrame(tick);
          else
            done({
              lineTop: [...lineTop],
              lineHeight: [...lineHeight],
              panelHeight: [...panelHeight],
            });
        };
        requestAnimationFrame(tick);
      },
    );
  }, frames);
}

test('the sentence being read never moves, and the panel around it never resizes', async ({
  browser,
}) => {
  test.slow();
  /*
   * THE ONE DEFECT ON THIS BOARD A PLAYER CAN LITERALLY SEE.
   *
   * `.otp-layer--modal` pins the panel's bottom edge in portrait and its centre on a desktop, so
   * every line the dialogue paragraph grew by moved the sentence under the reader's eye. Measured on
   * the build before the fix, meeting the Owl:
   *
   *   375x812   line box 16 -> 30 -> 31px, panel 307 -> 322, the line's top edge 560 -> 545
   *   1280x800  line box 22 -> 23 -> 44px, panel 332 -> 333 -> 355, top edge 316 -> 305
   *
   * -- 15px on a phone and 11px on a desktop, twice per encounter and six times a run, each step
   * scoring a layout shift of 0.1082-0.1092 against a "good" bound of 0.1.
   *
   * Three separate mechanisms did it and this one assertion covers all three, because it watches the
   * sentence rather than any of their causes: the reply being longer than the greeting, the line
   * wrapping as it types, and the caret's own 1em box -- which in flow also carried a 0.5em advance,
   * enough to push the last word of the Owl's greeting onto a second line at 1280 and pull it back
   * when the caret went.
   *
   * No bound, no pixel count: the set of positions the line takes has to have ONE member. Anything
   * that moves it by any amount fails, which is the only bound worth writing for "it does not move".
   */
  for (const size of [
    { width: 1280, height: 800 },
    ...REFERENCE.map(([w, h]) => ({ width: w, height: h })),
  ]) {
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    const where = `${size.width}x${size.height}`;
    await page.goto('/');
    await startGame(page);

    // The Owl's greeting is the longest in the cast and its replies are shorter, so this covers
    // both directions: the paragraph must not grow as it types, and must not shrink on the reply.
    await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'owl' }));
    await expect(page.locator('.otp-dialogue__line')).toBeVisible();

    // Through the whole of the greeting's typewriter run.
    const typing = await samplePanel(page, 200);
    expect(typing.lineTop, `${where}: the line moved while it was being typed`).toHaveLength(1);
    expect(typing.lineHeight, `${where}: the line's box resized while it was typed`).toHaveLength(
      1,
    );
    expect(typing.panelHeight, `${where}: the panel resized while the line was typed`).toHaveLength(
      1,
    );

    // And across the reply, which is a different length and used to be what moved it.
    await page.getByRole('option').first().click();
    const replying = await samplePanel(page, 200);
    expect(replying.lineTop, `${where}: the line moved when the reply arrived`).toEqual(
      typing.lineTop,
    );
    expect(replying.panelHeight, `${where}: the panel resized when the reply arrived`).toEqual(
      typing.panelHeight,
    );

    await context.close();
  }
});

test.describe('on a touch screen, at the sizes the collision guard never visited', () => {
  test.use({ hasTouch: true, isMobile: true });

  /** Overlap in px between one element and each match of a selector, as width x height. */
  function overlaps(page: Page, one: string, many: string): Promise<string[]> {
    return page.evaluate(
      ([a, b]) => {
        const first = document.querySelector(a!);
        if (!first) return [`${a} is absent`];
        const ra = first.getBoundingClientRect();
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll(b!))) {
          const rb = el.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > 0.5 && h > 0.5) {
            out.push(
              `${a} covers ${Math.round(w)}x${Math.round(h)} of ${b} ` +
                `"${(el.textContent ?? '').trim().slice(0, 28)}"`,
            );
          }
        }
        return out;
      },
      [one, many],
    );
  }

  test('the touch pad never covers an errand goal', async ({ page }) => {
    test.slow();
    /*
     * The errand goals dock in the strip under the world in portrait, on the argument that the strip
     * is empty. On a phone the pad takes the bottom 128px of it, and what is left is not enough.
     * Measured between the frame's bottom border and the pad's top edge, against the goals box's own
     * 93px: 32px of room at 320x568, 52 at 360x640, 59 at 375x667, 80 at 360x740 and 375x740, 91 at
     * 375x780. The first height where it fits at all is 800, and 812 -- the project's primary phone
     * -- clears it by one and a half pixels, which the stylesheet's own note concedes.
     *
     * So the pad was drawn straight over the goals the whole run is scored on: at 320x568 the stick
     * covered all three outright (95x2, 95x19, 95x19) and the A button two (71x12, 71x19), and at
     * 375x667 the stick covered the third (95x18).
     *
     * The existing guard in e2e/css-contract.spec.ts visits 375x812 and 390x844 and stops, which is
     * why five common phone sizes shipped with it.
     */
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await startGame(page);
    expect(
      await page.evaluate(() => matchMedia('(hover: none)').matches),
      'this sweep is only meaningful where the pad is actually drawn',
    ).toBe(true);

    for (const [w, h] of REFERENCE) {
      await resize(page, w, h);
      await expect(page.locator('.otp-a-button')).toBeVisible();
      await expect(page.locator('.otp-hud-goal')).not.toHaveCount(0);

      for (const control of ['.otp-a-button', '.otp-stick']) {
        for (const part of ['.otp-hud-goal', '.otp-hud-goals__label']) {
          expect(await overlaps(page, control, part), `${control} at ${w}x${h}`).toEqual([]);
        }
      }

      /*
       * And they are still on screen, which is the other half of the same requirement: a box can be
       * moved clear of the pad by being pushed out of the window, and this layer is `position:
       * fixed`, so nothing would scroll it back. The goals used to be positioned from the canvas box,
       * which below 358px is WIDER than the viewport -- the trap .otp-world-frame's note records.
       */
      const onScreen = await page.evaluate(() => {
        const rows = [
          ...document.querySelectorAll('.otp-hud-goal, .otp-hud-goals__label'),
        ] as HTMLElement[];
        return rows
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.left < -0.5 ||
              b.top < -0.5 ||
              b.right > window.innerWidth + 0.5 ||
              b.bottom > window.innerHeight + 0.5
            );
          })
          .map((el) => (el.textContent ?? '').trim().slice(0, 28));
      });
      expect(onScreen, `errand goals outside the viewport at ${w}x${h}`).toEqual([]);
    }
  });

  test('the verdict line never covers an errand goal, in either orientation', async ({ page }) => {
    test.slow();
    /*
     * Portrait moves the transient lines inside the world because docked to the viewport they landed
     * on the goals. Landscape was left on the viewport dock with the toast's 140px lift, and 140px up
     * from the bottom of a 320px-tall window is the top of the world, which is where landscape puts
     * the goals: measured at 568x320, "Allowed: Night Light" covered 88x19 of "Find the cottage
     * before dark" and 88x8 of "Leave word at the post, unopened".
     *
     * One verdict per viewport and the viewport set before the verdict, because main.ts clears the
     * line after HINT_MS: a sweep that resizes and then measures is measuring an empty toast, which
     * is a guard that proves nothing. That trap is e2e/css-contract.spec.ts's note, and it applies
     * here for the same reason.
     */
    const offers: [string, string][] = [
      ['rabbit', 'cottage-finder'],
      ['owl', 'word-weaver'],
      ['lantern-keeper', 'night-light'],
      ['rabbit', 'cottage-finder'],
    ];

    for (const [i, [w, h]] of REFERENCE.entries()) {
      const [c, s] = offers[i]!;
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await startGame(page);
      await page.evaluate(
        ([character, skill]) => {
          const { store } = window.__otp!;
          store.dispatch({ type: 'MEET', c: character });
          store.dispatch({ type: 'INSPECT', s: skill });
          store.dispatch({ type: 'VERDICT', s: skill, v: 'allow' });
        },
        [c, s],
      );
      await expect(page.locator('.otp-toast')).toContainText(/\S/);
      await expect(page.locator('.otp-hud-goal')).not.toHaveCount(0);

      for (const part of ['.otp-hud-goal', '.otp-hud-goals__label']) {
        expect(await overlaps(page, '.otp-toast', part), `the toast at ${w}x${h}`).toEqual([]);
      }
      // And it must still clear the two corners it was moved between.
      expect(await overlaps(page, '.otp-toast', '.otp-hud-slot'), `at ${w}x${h}`).toEqual([]);
      expect(await overlaps(page, '.otp-toast', '.otp-a-button'), `at ${w}x${h}`).toEqual([]);
      expect(await overlaps(page, '.otp-toast', '.otp-stick'), `at ${w}x${h}`).toEqual([]);
    }
  });
});

test('Explore can be walked without a pointer, from the keyboard alone', async ({ page }) => {
  /*
   * `ui/tokens.css` used to take the whole pad out of the document on a fine pointer, and the pad is
   * where the five named walk buttons live -- the ones that exist because a joystick answers a
   * screen reader's single activation with a (0, 0) vector and moves Red exactly 0px. Enumerating
   * the focusable controls on Explore at 1280x800 therefore returned exactly ONE, the music toggle:
   * no way to walk, no way to stop, no way to reach anybody. The arrow keys are the better input
   * here and they still work, but they are in no accessible tree and the run could not be finished
   * without sight.
   *
   * Written as what a player can DO rather than as a count: every control in the walk group takes
   * focus, and the group shows itself when it has focus -- because five controls with no focus ring
   * is the other half of the same finding, and that is what a sighted keyboard player sees.
   */
  await page.goto('/');
  await startGame(page);
  expect(
    await page.evaluate(() => matchMedia('(pointer: fine) and (hover: hover)').matches),
    'this test is about the pointer that has no pad',
  ).toBe(true);

  const walk = page.locator('.otp-touch [role="group"] button');
  const count = await walk.count();
  expect(count, 'the walk group is not in the document at all').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const button = walk.nth(i);
    const name = (await button.textContent())!.trim();
    expect(name, 'every walk control is named from content.strings').not.toBe('');
    await button.focus();
    await expect(button, `"${name}" cannot take focus`).toBeFocused();
    // Focused, it is on screen rather than clipped to a 1px box out of sight.
    const box = (await button.boundingBox())!;
    expect(
      Math.round(Math.min(box.width, box.height)),
      `"${name}" is focusable but invisible`,
    ).toBeGreaterThanOrEqual(44);
  }

  // And pressing one actually walks her, which is the point of their existing.
  const before = (await probe(page)).position;
  await walk.first().click();
  await page.waitForTimeout(500);
  const after = (await probe(page)).position;
  expect(
    Math.hypot(after.x - before.x, after.y - before.y),
    'a walk button that cannot move Red is not a control',
  ).toBeGreaterThan(1);
});
