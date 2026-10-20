/*
 * A double-click must not answer a question the player has not read, and a modal panel must not
 * let go of the keyboard. Both are properties of `useFocusTrap`, and both need real geometry.
 *
 * THE DEFECT. A plain double-click on "Show me the skill" recorded Allow and ended the encounter.
 * Click one mounts the skill card under a pointer that has not moved; the `otp-panel-in` slide
 * (`--otp-motion-slow`, 180ms) then carries the Allow pill through that exact point, and click two
 * lands on a verdict. Measured before the fix: `inspected` and `verdict` 3-6ms apart in the run
 * log, at every gap up to ~100ms at 1280x800 and at EVERY gap at the client's 1673x449, where the
 * pill's settled box contains the show button's centre outright. A verdict cannot be retaken, so
 * the run is unrecoverable and the toast congratulates the player on a decision nobody made.
 *
 * WHY THIS TEST CANNOT BE WRITTEN THE OBVIOUS WAY. "Double-click, expect no verdict" passes on a
 * broken build the moment the pill is not under the pointer any more -- the second click hits the
 * backdrop and nothing happens for the wrong reason. So the collision is a PRECONDITION here: a
 * capture-phase listener counts the clicks that actually reach a verdict pill, and the test fails
 * loudly if none does. Green then means "the pill was hit and refused", never "the pill was
 * missed". If the panel layout changes so that the two can no longer overlap, this fails with a
 * message saying exactly that, which is the right conversation to have rather than a silent pass.
 *
 * test/modal-guard.test.ts holds the shape of the rule -- above all that a keyboard or assistive
 * activation is never held back -- which no pointer test in this suite can see.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/** The first offer on the path; any card would do, the guard does not read the content. */
const WHO = { c: 'rabbit', s: 'cottage-finder' } as const;

interface PillHit {
  pill: string;
  detail: number;
}

/** Opens the Rabbit's conversation without the walk; the walk is other specs' subject. */
async function atTheRabbit(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page);
  await page.evaluate((who) => window.__otp!.store.dispatch({ type: 'MEET', c: who.c }), WHO);
  await page.waitForSelector('.otp-dialogue__show');
}

/** Counts the clicks that reach a verdict pill, before Preact's own handler sees them. */
function watchPills(page: Page): Promise<void> {
  return page.evaluate(() => {
    const hits: PillHit[] = [];
    (window as unknown as { __pillHits: PillHit[] }).__pillHits = hits;
    document.addEventListener(
      'click',
      (e) => {
        const pill = (e.target as HTMLElement | null)?.closest?.('.otp-verdict');
        if (pill) hits.push({ pill: pill.className, detail: e.detail });
      },
      true,
    );
  });
}

const pillHits = (page: Page): Promise<PillHit[]> =>
  page.evaluate(() => (window as unknown as { __pillHits: PillHit[] }).__pillHits);

const verdicts = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => window.__otp!.store.getState().verdicts);

/*
 * 1280x800 is the desktop the specs are written at, where the pill passes through the pointer
 * during the slide. 1673x449 is the client's own window, a short landscape where the pill's
 * settled box contains the point outright -- the harder case, and the one that reproduced at every
 * interval. The gaps are a browser-fast double-click and a human one.
 */
for (const size of [
  { width: 1280, height: 800 },
  { width: 1673, height: 449 },
])
  for (const gap of [0, 60])
    test(`a double-click on "Show me the skill" records no verdict (${size.width}x${size.height}, ${gap}ms)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await atTheRabbit(page);
      await watchPills(page);

      const box = (await page.locator('.otp-dialogue__show').boundingBox())!;
      const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

      // A real pointer that does not move between the two presses. This is the whole defect: the
      // panel moves, the hand does not.
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.up();
      if (gap > 0) await page.waitForTimeout(gap);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(400);

      const hits = await pillHits(page);
      expect(
        hits.length,
        `the second click never reached a verdict pill at ${size.width}x${size.height}, so this run proves nothing: the panel geometry has moved and this repro needs rewriting`,
      ).toBeGreaterThan(0);

      expect(await verdicts(page), `a double-click recorded ${JSON.stringify(hits)}`).toEqual({});
      await expect(
        page.locator('.otp-card'),
        'the card closed on a click nobody meant',
      ).toHaveCount(1);
    });

test('the pills still answer a click the player meant', async ({ page }) => {
  await atTheRabbit(page);
  await page.evaluate((who) => window.__otp!.store.dispatch({ type: 'INSPECT', s: who.s }), WHO);
  await page.locator('.otp-verdict--allow').waitFor();
  // Long enough that no reading of "fresh" covers it, and well past any double-click interval.
  await page.waitForTimeout(900);

  await page.locator('.otp-verdict--allow').click();
  expect(await verdicts(page)).toEqual({ [WHO.s]: 'allow' });
});

test('a verdict with no pointer behind it is never held back', async ({ page }) => {
  await atTheRabbit(page);

  /*
   * Both halves land on the SAME freshly mounted card, at the SAME point the hand was already
   * resting on, microseconds apart, so the only thing that differs between them is `detail`: a
   * pointer click is refused and a keyboard or assistive activation -- Enter, Space, a switch,
   * voice control, `element.click()` -- is not. Nothing waits in between, so neither result can
   * be explained by the card having aged, and nothing moves, so neither can be explained by the
   * hand having travelled. This is the branch that would strand a switch player on every card,
   * and it is invisible to every other pointer test in the suite.
   */
  const result = await page.evaluate(async (who) => {
    // The hand, resting where it opened the card and not moving again.
    const rest = { clientX: 400, clientY: 300, bubbles: true };
    document.dispatchEvent(new PointerEvent('pointermove', rest));

    window.__otp!.store.dispatch({ type: 'INSPECT', s: who.s });
    for (let i = 0; i < 4 && !document.querySelector('.otp-verdict--allow'); i++)
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    const allow = document.querySelector('.otp-verdict--allow')!;

    allow.dispatchEvent(new MouseEvent('click', { ...rest, detail: 1 }));
    const afterPointer = { ...window.__otp!.store.getState().verdicts };
    allow.dispatchEvent(new MouseEvent('click', { ...rest, detail: 0 }));
    const afterKeyboard = { ...window.__otp!.store.getState().verdicts };
    return { afterPointer, afterKeyboard };
  }, WHO);

  expect(result.afterPointer, 'a stray pointer click on a just-mounted card was taken').toEqual({});
  expect(
    result.afterKeyboard,
    'a keyboard or assistive activation was swallowed by the mount guard',
  ).toEqual({ [WHO.s]: 'allow' });
});

/*
 * The clause that keeps the guard from costing more than it saves.
 *
 * A player who opens the card and goes straight for a pill is inside the settle window -- measured
 * at 46ms from the click on "Show me the skill" to the click on Restrict at 1280x800 -- and must
 * be answered, because the hand travelled 133px to get there and aimed at what it hit. An
 * age-only guard refuses that player, and e2e/ui.spec.ts's "a verdict updates the basket and
 * returns to the world" is the proof: it is this exact sequence, and it fails without this clause.
 */
test('a fast player who moves to a pill is answered, not second-guessed', async ({ page }) => {
  await atTheRabbit(page);

  const opened = performance.now();
  await page.locator('.otp-dialogue__show').click();
  await page.locator('.otp-verdict--restrict').click();
  const spent = performance.now() - opened;

  expect(
    await verdicts(page),
    `a verdict given ${Math.round(spent)}ms after opening the card`,
  ).toEqual({ [WHO.s]: 'restrict' });
});

/*
 * The other half of the hook. Focus opens on `[data-autofocus]`, which on both of these panels is
 * a `tabindex="-1"` box -- so that no verdict is pre-selected -- and `focusable()` does not list
 * it. It was therefore neither the trap's first nor its last item, the first Shift+Tab matched
 * neither branch, and the browser walked focus out of an `aria-modal` dialog to the music toggle
 * in the world frame behind it. Measured before the fix: one Shift+Tab reached
 * `button.otp-music`, a second reached `document.body` with the card still on screen.
 */
for (const panel of [
  { name: 'skill card', open: 'inspect', selector: '.otp-card' },
  { name: 'conversation', open: 'dialogue', selector: '.otp-dialogue__text' },
] as const)
  test(`the first Shift+Tab stays inside the ${panel.name}`, async ({ page }) => {
    await atTheRabbit(page);
    if (panel.open === 'inspect') {
      await page.evaluate(
        (who) => window.__otp!.store.dispatch({ type: 'INSPECT', s: who.s }),
        WHO,
      );
      await page.locator('.otp-card').waitFor();
    }
    await expect(page.locator(panel.selector)).toBeFocused();

    const inside = () =>
      page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return {
          where: a ? `${a.tagName.toLowerCase()}.${a.className}` : 'nothing',
          trapped: !!a?.closest('.otp-layer--modal'),
        };
      });

    for (const press of [1, 2, 3]) {
      await page.keyboard.press('Shift+Tab');
      const now = await inside();
      expect(now.trapped, `Shift+Tab ${press} left the dialog, onto ${now.where}`).toBe(true);
    }
  });
