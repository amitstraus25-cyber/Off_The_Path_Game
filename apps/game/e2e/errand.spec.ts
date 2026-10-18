import { expect, test } from '@playwright/test';
import { hold, mapObject, probe, startGame } from './helpers';

/*
 * The one test that would have caught the bug this file was written for.
 *
 * `trigger-cottage` ends the run, and it used to sit on the garden gate, in front of the note on
 * Grandma's door. Every unit test passed: the note was walkable, the goal was in the content, the
 * scoring was right. It was only unearnable in play, because the walk ended three tiles short of
 * it. Nothing short of actually playing the run can see that, so this test plays it.
 *
 * It takes the errand line -- restrict the compass, reject the translator, allow the lantern --
 * which is the only line that earns `strangers`, and `strangers` is the only way to read the door
 * note. If the trigger ever moves back in front of the note, the sign goal goes unmet here.
 */

/** Walks east in short bursts, reading any notice it meets, until `done` or the budget runs out. */
async function walkEastReadingNotices(
  page: import('@playwright/test').Page,
  done: () => Promise<boolean>,
  budgetMs: number,
): Promise<void> {
  const read = page.getByRole('button', { name: /Read the notice/ });
  let spent = 0;
  while (spent < budgetMs) {
    if (await done()) return;
    if ((await read.count()) > 0) {
      await read.first().click();
      // The notice panel stays up after reading; leave it the way a player would.
      const walkOn = page.getByRole('button', { name: /Walk on/ });
      if ((await walkOn.count()) > 0) await walkOn.first().click();
      continue;
    }
    await hold(page, 'ArrowRight', 400);
    spent += 400;
  }
}

test('the errand line can read the note on the door and still reach the cottage', async ({
  page,
}) => {
  test.slow();
  await page.goto('/');
  await startGame(page);

  // The three encounters are exercised elsewhere; what is on trial here is the walk.
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['rabbit', 'cottage-finder', 'restrict'],
      ['owl', 'word-weaver', 'reject'],
      ['lantern-keeper', 'night-light', 'allow'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
  });

  const door = await mapObject(page, 'trigger-cottage');
  const readBoth = async (): Promise<boolean> => {
    const seen = await page.evaluate(() => window.__otp!.store.getState().read);
    return seen.includes('forest-post') && seen.includes('cottage-door');
  };

  // East along the track, through the forest post and up to the door.
  await walkEastReadingNotices(page, readBoth, 60_000);
  expect(await readBoth(), 'Red never reached both notices walking east').toBe(true);

  // The doorstep is the row above the approach, so the last step is north.
  await expect
    .poll(
      async () => {
        await hold(page, 'ArrowRight', 220);
        await hold(page, 'ArrowUp', 220);
        return (await probe(page)).phase;
      },
      { timeout: 20_000 },
    )
    .toBe('cottage');

  const at = await probe(page);
  expect(at.position.x).toBeGreaterThanOrEqual(door.x);
  expect(at.log.map((e) => e.t)).toContain('arrived');

  // And the goal actually scores, which is the whole point.
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();

  const sign = page.locator('.otp-recap__row--errand', { hasText: /note she pinned/i });
  await expect(sign).toBeVisible();
  await expect(sign).not.toHaveClass(/otp-recap__row--missed/);
});
