import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerAllAndArrive, ready, startGame, toTheReveal } from './helpers';

/*
 * THE A/B VARIANTS (the client, 2026-10-25: "A/B test everything"). The host page puts each visitor
 * in a group through the iframe's address (src/ab.ts); with no parameter a visitor gets the first
 * variant of every test, which is what ships. Each test's other half is drawn here.
 */
const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { chrome: Record<string, string>; contact: { emailLabel: string } } };
const say = (key: string): string => content.ui.chrome[key]!;
const TOKEN = 'dGVzdA.c2lnbmF0dXJl';

async function serve(page: Page, emailRequired: boolean): Promise<void> {
  await page.route('**/api/start', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ seed: 0, token: TOKEN, emailRequired }),
    }),
  );
  await page.route('**/api/top**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
  );
}

test('the landing shows the client art by default, and the live forest for landing=forest', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);
  const art = page.locator('.otp-title-art img');
  await expect(art).toBeVisible();
  // The whole picture, height-fit and as the designer framed it (the client, 2026-10-25: "revert
  // back to the original image"): the highest cube's top (row 65) to the houses (row 940) all in the
  // box, and the frame -- columns 2280 to 4200 of the 6000px file -- ending at the world's right edge.
  const box = (await art.boundingBox())!;
  const world = (await page.locator('.otp-title-art').boundingBox())!;
  const s = box.height / 1080;
  expect(box.y + 65 * s).toBeGreaterThanOrEqual(world.y - 0.5);
  expect(box.y + 940 * s).toBeLessThanOrEqual(world.y + world.height + 0.5);
  expect(Math.abs(box.x + 4200 * s - (world.x + world.width))).toBeLessThan(2);
  await expect(art).toHaveAttribute('alt', '');

  await page.goto('/?landing=forest');
  await ready(page);
  await expect(page.locator('.otp-title-art')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Off the Path' })).toBeVisible();
});

/*
 * NOTHING OF THE PICTURE IS WASHED OUT (the client, 2026-10-25: "I don't want to see half of this
 * blurred out"). On a short, wide desktop window -- 3.3:1, the shape that showed it -- the picture
 * reaches the world's left edge, so there is no empty strip beside it, and the card is a card the
 * height of its copy, not a column the height of the world.
 */
test('on a wide window the picture fills the world and the card is only as tall as its copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 535 });
  await page.goto('/');
  await ready(page);
  const world = (await page.locator('.otp-title-art').boundingBox())!;
  const art = (await page.locator('.otp-title-art img').boundingBox())!;
  const card = (await page.locator('.otp-title-panel').boundingBox())!;
  expect(art.x).toBeLessThanOrEqual(world.x + 0.5);
  expect(card.height).toBeLessThan(world.height * 0.9);
});

/*
 * PURPLE IN THE MIDDLE OF A PHONE (the client, 2026-10-25: "make sure little purple is centered on
 * the phone"), on a tall phone and on a short one. She stands at column 3610 of the 6000px file
 * (ui/screens.css, "the landing's art"). Since 2026-10-26 the phone's words have no card, as on a
 * computer, and sit under the picture: her boots (row 860) stand above the words.
 */
for (const [w, h] of [
  [375, 812],
  [393, 660],
  [360, 640],
] as const) {
  test(`at ${w}x${h} Purple stands in the middle of the picture, above the words`, async ({
    browser,
  }) => {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      isMobile: true,
      hasTouch: true,
    });
    await page.goto('/');
    await ready(page);
    const seen = await page.evaluate(() => {
      const box = document.querySelector('.otp-title-art')!.getBoundingClientRect();
      const img = document.querySelector('.otp-title-art img')!.getBoundingClientRect();
      const panel = document.querySelector('.otp-title-panel')!;
      const words = panel.getBoundingClientRect();
      const s = img.height / 1080;
      return {
        offCentre: img.left + 3610 * s - (box.left + box.width / 2),
        bootsToWords: words.top - (img.top + 860 * s),
        card: getComputedStyle(panel).backgroundColor,
      };
    });
    expect(Math.abs(seen.offCentre)).toBeLessThan(2);
    expect(seen.bootsToWords).toBeGreaterThan(0);
    expect(seen.card).toBe('rgba(0, 0, 0, 0)');
    await page.close();
  });
}

test('start=one puts the rules and par on the landing, and its button starts the walk', async ({
  page,
}) => {
  await page.goto('/?start=one');
  await ready(page);
  await expect(page.locator('[data-howto] li')).toHaveCount(4);
  await expect(page.locator('[data-par]')).toContainText('2:02');
  await page.getByRole('button', { name: /Start walking/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'forest');
});

test('results=above puts the research band directly under the score', async ({ page }) => {
  await serve(page, false);
  await page.goto('/?results=above');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  const order = await page.evaluate(() => {
    const band = document.querySelector('.otp-band')!;
    const cards = document.querySelector('.otp-tiles-section')!;
    return band.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING
      ? 'above'
      : 'below';
  });
  expect(order).toBe('above');
});

test('post=two asks for the name first and the work email as a second step', async ({ page }) => {
  await serve(page, true);
  await page.goto('/?post=two');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  const email = page.getByRole('textbox', { name: content.ui.contact.emailLabel });
  await expect(email).toHaveCount(0);
  await expect(page.locator('[data-post-next-note]')).toHaveText(say('postNextNote'));
  await page.locator('[data-action="post-next"]').click();
  await expect(email).toBeVisible();
  await expect(email).toBeFocused();
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible();
});

test('with no parameter every field shows at once, as it ships', async ({ page }) => {
  await serve(page, true);
  await page.goto('/');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  await expect(page.getByRole('textbox', { name: content.ui.contact.emailLabel })).toBeVisible();
  await expect(page.locator('[data-action="post-next"]')).toHaveCount(0);
});
