import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { loadContent, score } from '@otp/core';
import type { Content, RunEvent } from '@otp/core';
import { hold, mapObject, probe, startGame } from './helpers';

/** The shipped content, through the schema the game validates at startup. */
const content: Content = loadContent(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
  ),
);

/** The notice this walk exists to reach, and the errand that cannot be done without reading it. */
const DOOR_NOTICE = 'cottage-door';
const doorErrand = content.scoring.errandGoals.find((g) => g.act === DOOR_NOTICE)!;

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
    return seen.includes('forest-post') && seen.includes(DOOR_NOTICE);
  };

  // East along the track, through the forest post and up to the door.
  await walkEastReadingNotices(page, readBoth, 60_000);
  expect(await readBoth(), 'Purple never reached both notices walking east').toBe(true);

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

  /*
   * AND IT SCORED, which is the claim the whole walk above exists to make.
   *
   * This used to be `not.toHaveClass(/otp-recap__row--missed/)` and nothing else. Results marks
   * three states, not two: a goal given up on purpose -- a TRADE -- carries neither the Haze
   * ground nor the missed class and is worth no points at all (see e2e/results-payoff.spec.ts).
   * So the old assertion was satisfied by a run that never reached the note, which is precisely
   * the bug this file was written to catch: the walk ending short of `trigger-cottage` would have
   * left the row traded, unmissed, and green here.
   *
   * Asserted against `score()` over the log the game recorded, so it is the points that are on
   * trial and not a class name, and then against the mark the player can actually see.
   */
  const log = (await page.evaluate(
    () => window.__otp!.store.getState().log,
  )) as unknown as RunEvent[];
  const result = score(log, content);
  console.log(
    'errand:',
    JSON.stringify({ goals: result.goals, errandBonus: result.errandBonus, total: result.total }),
  );

  // The premise: the errand on trial is worth something, so "met" is a claim about points.
  expect(doorErrand.points, `"${doorErrand.label}" is worth something`).toBeGreaterThan(0);
  expect(
    result.goals.filter((g) => g.met).map((g) => g.id),
    `"${doorErrand.label}" went unscored: the note was never read, or reading it earned nothing`,
  ).toContain(doorErrand.id);
  expect(result.errandBonus).toBeGreaterThanOrEqual(doorErrand.points);

  // And what the player sees on the row: the mark that means done, not the one that means given
  // up for the boundary and not the "!".
  const sign = page.locator('.otp-recap__row--errand', { hasText: doorErrand.label });
  await expect(sign).toBeVisible();
  await expect(sign.locator('.otp-recap__badge')).toHaveAttribute('data-glyph', 'check');
  await expect(sign).not.toHaveClass(/otp-recap__row--missed/);
});
