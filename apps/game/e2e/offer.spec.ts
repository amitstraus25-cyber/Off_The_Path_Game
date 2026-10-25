import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/*
 * THE OFFER, ALL SEVEN, IN BOTH VARIANTS, AT EVERY SIZE THE CLIENT LOOKS AT.
 *
 * The card opens by itself since 2026-10-22, so an offer is now the tallest panel in the game:
 * greeting, picture, name, promise, two rows and the answers, in one. What has to hold at 375, 768,
 * 1280, a landscape phone's 844x390 and the smallest landscape window, 568x320, for every character
 * and for the good card and the bad one alike (the bad card is the good card with one line
 * swapped, so either may be the longer):
 *
 *   - the card this run dealt is the one on screen, picture and all;
 *   - Take it, Leave it and Walk on are on screen and are what a pointer at their centre lands on,
 *     so nothing covers them;
 *   - and so is everything above them -- who is speaking and what they say, the picture, the name
 *     and the promise, both rows -- each wholly inside the panel's visible box, not scrolled under
 *     the answers (the UX review, 2026-10-22: at 844x390 the card was 41px too tall for its panel
 *     and "If you leave it" sat cut through under Take it). On a short landscape window the panel
 *     must not scroll at all: there the card goes to two columns (panels.css) precisely so that it
 *     fits, and a scroll there is that layout failing;
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
  { width: 568, height: 320 },
] as const;

/** A landscape window as short as panels.css's two-column offer is written for. */
const SHORT_LANDSCAPE = (size: { width: number; height: number }): boolean =>
  size.width > size.height && size.height <= 580;

/** Everything the offer says before its answers, by what it is. */
const PARTS = {
  speaker: '.otp-dialogue__speaker',
  greeting: '.otp-dialogue__line',
  picture: '.otp-card__icon',
  name: '.otp-card__title',
  promise: '.otp-card__promise',
  'if you take it': '.otp-card__rows .otp-row:nth-child(1)',
  'if you leave it': '.otp-card__rows .otp-row:nth-child(2)',
} as const;

/** A run dealt from `seed`, standing in the forest with its clock running. */
const deal = (page: Page, seed: number): Promise<string[]> =>
  page.evaluate((s) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'RESET', seed: s });
    store.dispatch({ type: 'START', runId: `offer-${s}` });
    store.dispatch({ type: 'BEGIN' });
    return store.getState().good;
  }, seed);

/**
 * The fewest seeds, from the first forty, that show every skill both good and bad -- but a skill
 * the deal always deals good (`deal.always`, rules 3: the Wood Map) has no bad copy to show.
 */
async function seedsForBothVariants(page: Page, skills: string[]): Promise<number[]> {
  const always = await page.evaluate(
    () => (window.__otp!.content as unknown as { deal: { always?: string[] } }).deal.always ?? [],
  );
  const want = new Set(
    skills.flatMap((s) => (always.includes(s) ? [`${s}:good`] : [`${s}:good`, `${s}:bad`])),
  );
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

          // Everything above the answers is on screen too, wholly, and not under anything.
          const shown = await offer.evaluate((root, parts) => {
            // The boxes that clip a part: every ancestor that scrolls or clips, and the window.
            const visibleBox = (el: Element) => {
              const v = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
              for (let a = el.parentElement; a; a = a.parentElement) {
                if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowY)) continue;
                const c = a.getBoundingClientRect();
                v.top = Math.max(v.top, c.top);
                v.left = Math.max(v.left, c.left);
                v.bottom = Math.min(v.bottom, c.bottom);
                v.right = Math.min(v.right, c.right);
              }
              return v;
            };
            const out: Record<string, string> = {};
            for (const [what, sel] of Object.entries(parts)) {
              const el = root.querySelector(sel);
              if (!el) {
                out[what] = 'missing';
                continue;
              }
              const r = el.getBoundingClientRect();
              const view = visibleBox(el);
              const inside =
                r.width > 0 &&
                r.top >= view.top - 0.5 &&
                r.left >= view.left - 0.5 &&
                r.bottom <= view.bottom + 0.5 &&
                r.right <= view.right + 0.5;
              // Its top, middle and foot are what a pointer there lands on: nothing lies over it.
              const covered = [r.top + 2, r.top + r.height / 2, r.bottom - 2].some((y) => {
                const hit = document.elementFromPoint(r.left + r.width / 2, y);
                return !hit || !(hit === el || el.contains(hit));
              });
              out[what] = !inside
                ? `outside the panel's visible box (${Math.round(r.top)}-${Math.round(r.bottom)} in ${Math.round(view.top)}-${Math.round(view.bottom)})`
                : covered
                  ? 'covered'
                  : 'shown';
            }
            // How far the panel the card sits in could still scroll.
            let scrolls = 0;
            for (let a = root.querySelector('.otp-offer')!.parentElement; a; a = a.parentElement)
              if (/(auto|scroll)/.test(getComputedStyle(a).overflowY))
                scrolls = Math.max(scrolls, a.scrollHeight - a.clientHeight);
            out['scrolls by'] = String(scrolls);
            return out;
          }, PARTS);
          for (const what of Object.keys(PARTS))
            expect(shown[what], `${where}: the ${what}`).toBe('shown');
          if (SHORT_LANDSCAPE(size))
            expect(shown['scrolls by'], `${where}: the offer scrolls in its panel`).toBe('0');

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
  // Tab only once the panel has taken focus: Tabs pressed while it mounts went to the page
  // and the loop ran out before Walk on (flaked under load, 2026-10-22).
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-offer]')))
    .toBe(true);
  for (let n = 0; n < 6 && !(await walkOn.evaluate((b) => b === document.activeElement)); n++)
    await page.keyboard.press('Tab');
  await expect(walkOn).toBeFocused();
  const ring = await walkOn.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      style: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      offset: parseFloat(s.outlineOffset),
      /*
       * How far the ring's inner edge stands from the words: its offset plus the control's own
       * padding. Since Paul's round (2026-10-22) the ring sits ON the pill-shaped box (offset 0)
       * and the 6px of padding is what keeps it off the letters, so the gap is the measure.
       */
      clear: parseFloat(s.outlineOffset) + parseFloat(s.paddingLeft),
      halo: s.boxShadow,
      radius: parseFloat(s.borderTopLeftRadius),
    };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width, 'visible: at least 2px all round').toBeGreaterThanOrEqual(2);
  expect(ring.width, 'slim: thinner than the pill ring').toBeLessThan(3);
  expect(ring.offset, 'never inside the box').toBeGreaterThanOrEqual(0);
  expect(ring.clear, 'off the words').toBeGreaterThan(0);
  expect(ring.halo, 'no halo box').toBe('none');
  expect(ring.radius, 'a shape to follow, not a square').toBeGreaterThan(0);
});
