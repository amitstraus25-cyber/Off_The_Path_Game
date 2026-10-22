import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ready, toTheReveal } from './helpers';

/*
 * 05 Reveal, redesigned 2026-10-22 (the client chose "score first, then flip cards"), in a real
 * browser: the score and what it is made of, the seven cards that turn over, the typed name, and
 * the player's own run on the board the moment it is posted.
 *
 * Every number the screen shows is core's (`v2.result`). The spec checks that the parts add up to
 * the total the page shows, rather than remembering one: a spec that wrote down "100" would be
 * the trap this project keeps a brief about.
 */

const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { reveal: { caught: string }; chrome: Record<string, string> } };
const say = (key: string): string => content.ui.chrome[key]!;

const TOKEN = 'dGVzdA.c2lnbmF0dXJl';

/** The run's start, served, so the reveal carries the post form. */
const serveStart = (page: Page) =>
  page.route('**/api/start', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ seed: 0, token: TOKEN }),
    }),
  );

const serveEmptyBoard = (page: Page) =>
  page.route('**/api/top**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
  );

/**
 * A run through the store: every card opened, the good ones taken (or none, or all), and `seconds`
 * on the run clock before the door. The clock override is the game's own test switch.
 */
async function playTo(
  page: Page,
  opts: { take: 'good' | 'none' | 'all'; seconds: number },
): Promise<void> {
  await serveStart(page);
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.getByRole('button', { name: /Start walking/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'forest');
  await page.evaluate(({ take, seconds }) => {
    const { store, content: c, testClock } = window.__otp!;
    const good = store.getState().good;
    for (const who of c.characters) {
      store.dispatch({ type: 'MEET', c: who.id });
      store.dispatch({ type: 'INSPECT', s: who.skillId });
      const v =
        take === 'all' || (take === 'good' && good.includes(who.skillId)) ? 'take' : 'leave';
      store.dispatch({ type: 'VERDICT', s: who.skillId, v });
    }
    testClock.advance(seconds * 1000);
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, opts);
  await toTheReveal(page);
}

test.describe('the result comes first', () => {
  test('the score, its two parts and the time, as core counted them', async ({ page }) => {
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 120 });

    const hero = page.locator('.otp-hero');
    const total = Number(await hero.getAttribute('data-score'));
    const choices = Number(await page.locator('[data-part="choices"]').textContent());
    const speed = Number(
      (await page.locator('[data-part="speed"]').textContent())!.replace('+', ''),
    );
    expect(choices + speed, 'the parts do not add up to the score').toBe(total);
    // Three good at 2:00 is past par, so some of the bonus and not all of it.
    expect(choices).toBe(70);
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThan(30);
    await expect(page.locator('[data-part="time"]')).toContainText('2:00');
    await expect(hero.locator('h1')).toHaveText('Clean arrival');
    await expect(page.locator('.otp-replay__caught')).toHaveText(
      content.ui.reveal.caught.replace('{caught}', '4').replace('{bad}', '4'),
    );
    /*
     * A PERFECT RUN READS AS SEVEN CATCHES (the 2026-10-22 review). The tiles used to be styled by
     * Safe/Unsafe, so the four bad skills this run correctly left wore the Haze, the bar and the
     * "!" that UI_FOUNDATIONS section 5 keeps for "Missed it".
     */
    await expect(page.locator('[data-call="caught"]')).toHaveCount(7);
    await expect(page.locator('.otp-tile--missed')).toHaveCount(0);
    await expect(page.locator('.otp-tile__call')).toHaveText(Array(7).fill(say('revealCaught')));
    await expect(page.locator('.otp-recap__badge[data-glyph="missed"]')).toHaveCount(0);
  });

  test('a run the wolf got into says why it is 0, in words', async ({ page }) => {
    await serveEmptyBoard(page);
    await playTo(page, { take: 'all', seconds: 30 });
    await expect(page.locator('.otp-hero')).toHaveAttribute('data-score', '0');
    await expect(page.locator('[data-zero="wolf"]')).toHaveText(say('revealZeroWolf'));
    await expect(page.locator('[data-parts]')).toHaveCount(0);
    await expect(page.locator('.otp-replay__caught')).toHaveText(
      content.ui.reveal.caught.replace('{caught}', '0').replace('{bad}', '4'),
    );
  });
});

test.describe('the seven cards', () => {
  test('turn over from the keyboard, and say so to a screen reader', async ({ page }) => {
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 10 });
    const first = page.locator('.otp-tile__face').first();
    for (let n = 0; n < 12 && !(await first.evaluate((b) => b === document.activeElement)); n++)
      await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.otp-tile__back').first()).toBeVisible();
    await expect(first).toContainText(say('revealFlipBack'));
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  test('turn without moving when the player asks for less motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 10 });
    const tile = page.locator('.otp-tile').first();
    await tile.locator('.otp-tile__face').click();
    await expect(tile).toHaveAttribute('data-open', 'true');
    expect(
      await tile.evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName)),
      'the card still turns under reduced motion',
    ).toEqual([]);
    await expect(tile.locator('.otp-tile__back')).toBeVisible();
  });

  test('turn with a flip otherwise', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 10 });
    const tile = page.locator('.otp-tile').nth(3);
    await tile.locator('.otp-tile__face').click();
    expect(
      await tile.evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName)),
    ).toEqual(['otp-tile-turn']);
  });
});

/*
 * THE CLIENT'S THREE SCREENSHOTS (2026-10-22): the open card's outline wrapped the header only and
 * its details spilled out below it; "It promised / What it did" was a label column that left the
 * line four words wide; and a turned card beside an unturned one left a ragged grid.
 */
test.describe('an open card is one box, and the grid keeps its shape', () => {
  for (const [width, height] of [
    [375, 812],
    [768, 1024],
    [1280, 800],
  ] as const) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await serveEmptyBoard(page);
      await playTo(page, { take: 'good', seconds: 10 });
      const list = page.locator('.otp-tiles');
      const tiles = page.locator('.otp-tile');
      // The second card: in the right-hand column wherever there are two, which is the case that
      // used to leave a hole beside the first.
      const open = tiles.nth(1);
      await open.locator('.otp-tile__face').click();
      await expect(open).toHaveAttribute('data-open', 'true');
      // The turn finishes before anything is measured (the cabinet's own glow never does).
      await open.evaluate((li) => Promise.all(li.getAnimations().map((a) => a.finished)));

      // ONE BOX: the back lies inside the card's own edge, and the edge is drawn all round it.
      const card = (await open.boundingBox())!;
      const back = (await open.locator('.otp-tile__back').boundingBox())!;
      expect(back.height, 'the back is showing').toBeGreaterThan(20);
      expect(back.y + back.height).toBeLessThanOrEqual(card.y + card.height + 0.5);
      expect(back.x).toBeGreaterThanOrEqual(card.x - 0.5);
      const edge = await open.evaluate((li) => {
        const s = getComputedStyle(li);
        return [s.borderTopStyle, s.borderBottomStyle, s.borderRightStyle].map(
          (style, i) =>
            style !== 'none' &&
            parseFloat([s.borderTopWidth, s.borderBottomWidth, s.borderRightWidth][i]!) > 0 &&
            [s.borderTopColor, s.borderBottomColor, s.borderRightColor][i] !== 'rgba(0, 0, 0, 0)',
        );
      });
      expect(edge, 'the open card is outlined top, bottom and right').toEqual([true, true, true]);

      // NO HOLES: with a card open, every card spans the list -- one column, in walking order.
      const row = (await list.boundingBox())!;
      const boxes = await Promise.all((await tiles.all()).map((t) => t.boundingBox()));
      for (const [i, b] of boxes.entries()) {
        expect(Math.abs(b!.x - row.x), `card ${i} is not at the start of its row`).toBeLessThan(1);
        expect(Math.abs(b!.width - row.width), `card ${i} does not fill its row`).toBeLessThan(1);
        if (i > 0)
          expect(b!.y, `card ${i} is out of walking order`).toBeGreaterThan(boxes[i - 1]!.y);
      }

      // LABEL ABOVE ITS WORDS: each pair's label sits over its line, never beside it.
      const pairs = open.locator('.otp-reveal__pair');
      await expect(pairs).toHaveCount(2);
      for (const pair of await pairs.all()) {
        const dt = (await pair.locator('dt').boundingBox())!;
        const dd = (await pair.locator('dd').boundingBox())!;
        expect(dt.y + dt.height, 'the label is beside its line').toBeLessThanOrEqual(dd.y + 0.5);
        // And the line has room: at least half the card, never a four-word column.
        expect(dd.width).toBeGreaterThan(card.width * (width >= 768 ? 0.4 : 0.8));
      }

      // Turning it back restores the grid wherever there is room for one.
      await open.locator('.otp-tile__face').click();
      await expect(open).toHaveAttribute('data-open', 'false');
      if (width >= 768) {
        const [a, b] = await Promise.all([tiles.nth(0).boundingBox(), tiles.nth(1).boundingBox()]);
        expect(Math.abs(a!.y - b!.y), 'the first two cards share a row again').toBeLessThan(1);
      }
    });
  }

  test('the focus ring goes round the whole card, open or not', async ({ page }) => {
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 10 });
    const first = page.locator('.otp-tile').first();
    const face = first.locator('.otp-tile__face');
    for (let n = 0; n < 12 && !(await face.evaluate((b) => b === document.activeElement)); n++)
      await page.keyboard.press('Tab');
    await expect(face).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('data-open', 'true');
    const ring = await first.evaluate((li) => getComputedStyle(li).outlineStyle);
    expect(ring, 'the card carries the ring').toBe('solid');
    expect(await face.evaluate((b) => getComputedStyle(b).outlineStyle)).toBe('none');
  });
});

test.describe('the name is the one the player types', () => {
  test('a typed name is what goes up, tidied the way the board stores it', async ({ page }) => {
    let sent: { handle?: string } = {};
    await serveEmptyBoard(page);
    await page.route('**/api/score', async (route: Route) => {
      sent = route.request().postDataJSON() as typeof sent;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ handle: sent.handle, score: 80 }),
      });
    });
    await playTo(page, { take: 'good', seconds: 10 });

    const field = page.getByRole('textbox', { name: say('handleLabel') });
    await expect(field, 'the field is pre-filled with a suggestion').toHaveValue(/\S/);
    await field.fill('  Little   Purple ');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.locator('[data-announce="post"]')).toHaveAttribute(
      'data-notice',
      'handleAssigned',
    );
    expect(sent.handle).toBe('Little Purple');
    await expect(page.getByRole('status')).toContainText('Little Purple');
  });

  test('a name the board would refuse is explained, and nothing is sent', async ({ page }) => {
    let posts = 0;
    await serveEmptyBoard(page);
    await page.route('**/api/score', (route: Route) => {
      posts += 1;
      return route.fulfill({ status: 500, body: '' });
    });
    await playTo(page, { take: 'good', seconds: 10 });

    const field = page.getByRole('textbox', { name: say('handleLabel') });
    await field.fill('ab');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.locator('[data-problem="handleShort"]')).toHaveText(say('handleShort'));
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    // Described by the sentence, so a screen reader hears it on the way back into the field.
    await expect(field).toHaveAccessibleDescription(new RegExp(say('handleShort').slice(0, 20)));
    // Nothing was posted, so the post's own status line says nothing.
    await expect(page.locator('[data-announce="post"]')).toHaveText('');
    expect(posts).toBe(0);

    // Typing clears the complaint.
    await field.fill('abc');
    await expect(page.locator('[data-problem]')).toHaveCount(0);
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe("the player's own run, right after posting", () => {
  test('shows at once on a board that has not caught up, then as the board has it', async ({
    page,
  }) => {
    // The edge copy of the board predates the post, and the post's answer carries no fresh rows:
    // the case where the run is on the board and the board the player can see does not show it.
    let board = '{"entries":[]}';
    let score = 0;
    await page.route('**/api/top**', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: board }),
    );
    await page.route('**/api/score', async (route: Route) => {
      const body = route.request().postDataJSON() as { handle: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ handle: body.handle, score, rank: 1 }),
      });
    });
    await playTo(page, { take: 'good', seconds: 10 });
    score = Number(await page.locator('.otp-hero').getAttribute('data-score'));
    const name = 'Amit S';
    await page.getByRole('textbox', { name: say('handleLabel') }).fill(name);

    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const mine = page.locator('.otp-board__row--you');
    await expect(mine).toHaveCount(1);
    await expect(mine).toHaveAttribute('data-yours', 'pending');
    await expect(mine).toContainText(name);
    await expect(mine).toContainText(say('boardYouLabel'));
    await expect(mine).toContainText(say('boardJoining'));
    await expect(mine.locator('.otp-visually-hidden')).toHaveText(
      `${say('boardRowYou')
        .replace('{rank}', '1')
        .replace('{handle}', name)
        .replace('{score}', String(score))} ${say('boardJoining')}.`,
    );

    // Once a read carries the row, it is the board's own row, marked once, no longer "joining".
    board = JSON.stringify({ entries: [{ rank: 1, handle: name, score }] });
    await page.getByRole('button', { name: say('handleReroll') }).click();
    await page.getByRole('textbox', { name: say('handleLabel') }).fill(name);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(mine).toHaveCount(1);
    await expect(mine).toHaveAttribute('data-yours', 'confirmed');
    await expect(mine).not.toContainText(say('boardJoining'));
  });

  test('is not shown for a post the board refused', async ({ page }) => {
    await serveEmptyBoard(page);
    await page.route('**/api/score', (route: Route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }),
    );
    await playTo(page, { take: 'good', seconds: 10 });
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(say('leaderboardRefused'));
    await expect(page.locator('.otp-board__row--you')).toHaveCount(0);
  });

  test('a wolf run is told it does not go on the board, with no Post to press', async ({
    page,
  }) => {
    await serveEmptyBoard(page);
    await playTo(page, { take: 'all', seconds: 10 });
    await expect(page.locator('[data-post="unavailable"]')).toHaveText(say('wolfNotPosted'));
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toHaveCount(0);
  });
});

for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
  [844, 390],
] as const) {
  test(`the reveal fits ${width}x${height}: nothing sideways, every card inside the panel`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 10 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // The score is on screen the moment the reveal opens: score first.
    const score = (await page.locator('.otp-hero__score').boundingBox())!;
    expect(score.y + score.height).toBeLessThanOrEqual(height);
    const body = (await page.locator('.otp-screen__body').boundingBox())!;
    const tiles = page.locator('.otp-tile');
    await expect(tiles).toHaveCount(7);
    for (const tile of await tiles.all()) {
      await tile.locator('.otp-tile__face').click();
      const box = (await tile.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(body.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(body.x + body.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // The field and its buttons are real touch targets.
    for (const selector of ['#otp-handle-input', '.otp-post button[type="submit"]']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.height, `${selector} at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    // Post is the form's primary, so it is never the smaller pill beside "Suggest a name".
    const post = (await page.locator('.otp-post button[type="submit"]').boundingBox())!;
    const suggest = (await page.locator('.otp-post .otp-button--quiet').boundingBox())!;
    expect(post.width, `Post is narrower than Suggest at ${width}px`).toBeGreaterThanOrEqual(
      suggest.width - 0.5,
    );
    // The board's title is a title, "Wolf Spotters", not the all-caps label "WOLF Spotters".
    const title = page.locator('.otp-board__title');
    await expect(title).toHaveText(say('leaderboardTitle'));
    expect(await title.evaluate((h) => getComputedStyle(h).textTransform)).toBe('none');
  });
}

/*
 * THE RESEARCH FOOTER IS CENTRED (the client, 2026-10-22: "here in the bottom, I'd center this").
 * Measured on what is painted -- the line's text and the logo -- against the footer's own box, so
 * a change of card width, padding or wording moves both sides of the comparison together.
 */
for (const size of [
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]) {
  test(`the research footer sits in the middle of the card at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await serveEmptyBoard(page);
    await playTo(page, { take: 'good', seconds: 60 });
    const foot = page.locator('.otp-foot');
    await foot.scrollIntoViewIfNeeded();
    await expect(foot).toContainText(say('researchFooter'));
    const { box, ink } = await foot.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const painted = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      const b = el.getBoundingClientRect();
      return {
        box: { left: b.left, right: b.right },
        ink: {
          left: Math.min(...painted.map((r) => r.left)),
          right: Math.max(...painted.map((r) => r.right)),
        },
      };
    });
    expect(ink.right - ink.left, 'the footer paints nothing').toBeGreaterThan(40);
    const offCentre = (ink.left + ink.right) / 2 - (box.left + box.right) / 2;
    expect(Math.abs(offCentre), 'px off the footer centre').toBeLessThanOrEqual(2);
    // The logo is part of what is centred, and it is there.
    await expect(page.locator('.otp-foot .otp-mark')).toBeVisible();
  });
}
