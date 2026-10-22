import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * THE OFFER, ALL SEVEN, IN BOTH VARIANTS, AT EVERY SIZE THE CLIENT LOOKS AT.
 *
 * The card opens by itself since 2026-10-22, so an offer is now the tallest panel in the game:
 * greeting, picture, name, promise, two rows and the answers, in one. What has to hold at 375, 768,
 * 1280 and a landscape phone's 844x390, for every character and for the good card and the bad one
 * alike (the bad card is the good card with one line swapped, so either may be the longer):
 *
 *   - the card this run dealt is the one on screen, picture and all;
 *   - Take it, Leave it and Walk on are on screen and are what a pointer at their centre lands on,
 *     so nothing covers them -- a card too tall scrolls inside its own panel, under them;
 *   - the page itself never scrolls, and never sideways.
 *
 * Seeds are chosen here, by dealing, so that every skill is seen in both of its variants; nothing
 * below names a seed it remembered (PAUL_BRIEF trap 1).
 */

const SIZES = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
] as const;

/** A run dealt from `seed`, standing in the forest with its clock running. */
const deal = (page: Page, seed: number): Promise<string[]> =>
  page.evaluate((s) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'RESET', seed: s });
    store.dispatch({ type: 'START', runId: `offer-${s}` });
    store.dispatch({ type: 'BEGIN' });
    return store.getState().good;
  }, seed);

/** The fewest seeds, from the first forty, that show every skill both good and bad. */
async function seedsForBothVariants(page: Page, skills: string[]): Promise<number[]> {
  const want = new Set(skills.flatMap((s) => [`${s}:good`, `${s}:bad`]));
  const picked: number[] = [];
  for (let seed = 0; seed < 40 && want.size > 0; seed++) {
    const good = await deal(page, seed);
    const shows = skills.map((s) => `${s}:${good.includes(s) ? 'good' : 'bad'}`);
    if (shows.some((k) => want.has(k))) {
      picked.push(seed);
      for (const k of shows) want.delete(k);
    }
  }
  expect([...want], 'some variant was never dealt in forty seeds').toEqual([]);
  return picked;
}

for (const size of SIZES) {
  test(`every offer, in both variants, fits ${size.width}x${size.height} with its answers in reach`, async ({
    browser,
  }) => {
    test.slow();
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await startGame(page);
      const cast = await page.evaluate(() =>
        window.__otp!.content.characters.map((c) => ({ id: c.id, skillId: c.skillId })),
      );
      const seeds = await seedsForBothVariants(
        page,
        cast.map((c) => c.skillId),
      );

      for (const seed of seeds) {
        const good = await deal(page, seed);
        for (const c of cast) {
          const where = `${size.width}x${size.height}, seed ${seed}, ${c.id} (${good.includes(c.skillId) ? 'good' : 'bad'})`;
          await page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), c.id);
          const offer = page.locator(`[data-offer="${c.id}"][data-card="${c.skillId}"]`);
          await expect(offer, where).toBeVisible();

          // The dealt card, as the content writes it, and its picture.
          const dealt = await page.evaluate(
            ({ s, isGood }) => {
              const skill = window.__otp!.content.skills.find((k) => k.id === s)!;
              return (isGood ? skill.good : skill.bad).card;
            },
            { s: c.skillId, isGood: good.includes(c.skillId) },
          );
          await expect(offer.locator('[data-card-take] li'), where).toHaveText(dealt.take);
          await expect(offer.locator('[data-card-leave]'), where).toHaveText(dealt.leave);
          await expect(
            offer.locator('.otp-card__icon :is(img, .otp-icon-placeholder)'),
            `${where}: the card has its picture`,
          ).toBeVisible();

          // Each answer is on screen and is what a pointer at its centre would land on.
          for (const action of ['take', 'leave', 'walk-on']) {
            const reach = await offer.locator(`[data-action="${action}"]`).evaluate((el) => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return {
                inside:
                  r.left >= 0 &&
                  r.top >= 0 &&
                  r.right <= innerWidth + 0.5 &&
                  r.bottom <= innerHeight + 0.5,
                hit: !!hit && (hit === el || el.contains(hit)),
              };
            });
            expect(reach.inside, `${where}: ${action} is off screen`).toBe(true);
            expect(reach.hit, `${where}: something covers ${action}`).toBe(true);
          }

          const page_ = await page.evaluate(() => ({
            down: document.scrollingElement!.scrollHeight - innerHeight,
            sideways: document.documentElement.scrollWidth - innerWidth,
          }));
          expect(page_.down, `${where}: the page scrolls under the offer`).toBeLessThanOrEqual(0);
          expect(page_.sideways, `${where}: the page scrolls sideways`).toBeLessThanOrEqual(0);

          await page.keyboard.press('Escape');
          await expect(offer, `${where}: Esc walks on`).toBeHidden();
        }
      }
    } finally {
      await context.close();
    }
  });
}

/*
 * THE SLIM RING (the client's screenshot, 2026-10-22). A text-link control's focus ring was the
 * pill ring -- a 3px outline and a 6px Lilac halo -- with no border or padding to keep it off the
 * words, so it drew as a thick square box over them. Asserted as what is painted: no halo, a 2px
 * outline standing clear of the control, round a box with rounded corners for it to follow.
 */
test('Walk on takes a slim ring that follows its shape and stands off its words', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  const walkOn = page.locator('[data-offer] [data-action="walk-on"]');
  for (let n = 0; n < 6 && !(await walkOn.evaluate((b) => b === document.activeElement)); n++)
    await page.keyboard.press('Tab');
  await expect(walkOn).toBeFocused();
  const ring = await walkOn.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      offset: parseFloat(s.outlineOffset),
      halo: s.boxShadow,
      radius: parseFloat(s.borderTopLeftRadius),
    };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width, 'visible: at least 2px all round').toBeGreaterThanOrEqual(2);
  expect(ring.width, 'slim: thinner than the pill ring').toBeLessThan(3);
  expect(ring.offset, 'off the words').toBeGreaterThan(0);
  expect(ring.halo, 'no halo box').toBe('none');
  expect(ring.radius, 'a shape to follow, not a square').toBeGreaterThan(0);
});
