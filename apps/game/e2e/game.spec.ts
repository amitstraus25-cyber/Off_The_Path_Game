import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { probe, ready } from './helpers';

type Verdict = 'allow' | 'restrict' | 'reject';
const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** Plays a whole run through the store, which is what the reducer guarantees a player can do. */
async function playRun(
  page: Page,
  verdicts: Record<string, Verdict>,
  questions: string[] = [],
): Promise<void> {
  await page.evaluate(
    ({ verdicts, questions, skillOf }) => {
      const { store } = window.__otp!;
      for (const [character, verdict] of Object.entries(verdicts)) {
        store.dispatch({ type: 'MEET', c: character });
        for (const q of questions) store.dispatch({ type: 'ASK', c: character, q });
        store.dispatch({ type: 'INSPECT', s: skillOf[character] });
        store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
      }
      store.dispatch({ type: 'ENTER_COTTAGE' });
    },
    { verdicts, questions, skillOf: SKILL_OF },
  );
}

/** Clicks through every approach and ending beat, stopping on the last one. */
async function advanceBeats(page: Page): Promise<void> {
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
}

/** Clicks through the arrival to the results screen. */
async function finishArrival(page: Page): Promise<void> {
  await advanceBeats(page);
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

test('the title screen starts the run', async ({ page }) => {
  expect((await probe(page)).phase).toBe('title');
  await expect(page.locator('.otp-title__mark')).toContainText('Off the Path');
  // Exactly one word in Season Mix italic.
  await expect(page.locator('.otp-title__mark .otp-serif')).toHaveText('Path');
  await expect(page.locator('.otp-note')).toContainText('Mind the path');

  await page.getByRole('button', { name: /Begin the walk/ }).click();
  expect((await probe(page)).phase).toBe('explore');
});

/*
 * The three tests below used to name a total and assert it. They no longer do, and nor do their
 * names. packages/core/test/scoring.test.ts proves every one of these run shapes in one it.each
 * table -- perfect+needs = 1000, reject-all = 600, allow-all = 100 -- under a 100% coverage gate,
 * so repeating the numbers in a browser meant that rebalancing a skill in content/game.json
 * reddened three e2e tests, which is the one thing CLAUDE.md rule 3 promises cannot happen. What
 * is left here is what only a browser can see: which ending card plays, which recap rows wear the
 * miss treatment, and that a score reaches the screen at all. One exact total is still asserted in
 * the suite, in e2e/results-payoff.spec.ts, where it is the premise of the test around it.
 */

test('a perfect run ends clean, with no skill row marked as a miss', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' }, [
    'needs',
  ]);

  await expect(page.locator('.otp-ending__title')).toBeHidden();
  await finishArrival(page);
  const rows = page.locator('.otp-recap__row--skill');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('.otp-recap__row--skill.otp-recap__row--missed')).toHaveCount(0);
});

test('rejecting everything arrives safely, with the errand undone', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'reject', owl: 'reject', 'lantern-keeper': 'reject' });

  // The ending line only appears after the approach beats.
  await advanceBeats(page);
  // Refusing everything is safe, but it is no longer indistinguishable from playing well: nothing
  // was taken and nothing was carried out either, so it does not draw the clean-arrival card.
  await expect(page.locator('.otp-ending__title')).toHaveText('The long way round');
  await expect(page.locator('.otp-arrive__line--reveal').first()).toContainText('given up waiting');
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  // Rejecting Word Weaver is the best call, so only the compass and the lantern are misses:
  // refusing everything is safe but costly, which is the point of keeping one genuinely safe skill.
  await expect(page.locator('.otp-recap__row--skill.otp-recap__row--missed')).toHaveCount(2);
  await expect(page.locator('.otp-recap__row--skill:not(.otp-recap__row--missed)')).toContainText(
    'Word Weaver',
  );
});

test("allowing everything ends in the wolf's house", async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'allow', owl: 'allow', 'lantern-keeper': 'allow' });

  await finishArrival(page);
  // A capability taken by allowing in full does not carry out Grandma's errand -- the word it
  // sent went to the wolf as well -- so allow-all earns no goal and keeps only the lantern's 100.
  // Allowing the lantern is now a miss too: restricting it is the best verdict on that card.
  await expect(page.locator('.otp-recap__row--skill.otp-recap__row--missed')).toHaveCount(3);
  const flags = await page.evaluate(() => window.__otp!.store.getState().flags);
  expect(flags).toEqual(['keyStolen', 'messagesLeaked']);
});

test('the key line plays when the wolf took the key', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'allow', owl: 'reject', 'lantern-keeper': 'allow' });

  await advanceBeats(page);
  await expect(page.locator('.otp-ending__title')).toHaveText('A close call');
  await expect(page.locator('.otp-arrive__text')).toContainText('why do you need my key');
});

test('the handle field validates before anything is posted', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  const field = page.locator('.otp-field input');
  await field.fill('ab');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('between 3 and 16');

  await field.fill('cyera-team');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('different handle');

  // A valid handle reaches the client, which reports the board is not up yet.
  await field.fill('wolfspotter');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/unavailable/i);
});

test('the privacy line is next to the handle field', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  await expect(page.locator('#otp-handle-hint')).toContainText('handle and score only');
  await expect(page.locator('#otp-handle-hint')).toContainText('no cookies');
});

test('Results shows exactly one Lime, on Read the Research', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  const limes = await page.evaluate(() => {
    const lime = getComputedStyle(document.documentElement)
      .getPropertyValue('--cyera-lime')
      .trim()
      .toLowerCase();
    const toHex = (rgb: string): string => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
      return m
        ? `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`
        : rgb;
    };
    return [...document.querySelectorAll('*')]
      .filter((el) => toHex(getComputedStyle(el).backgroundColor) === lime)
      .map((el) => el.className);
  });
  expect(limes).toHaveLength(1);
  expect(String(limes[0])).toContain('otp-cta');
});

test('replay starts a fresh run with a new id', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  const firstRun = await page.evaluate(() => window.__otp!.store.getState().runId);
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  await page.getByRole('button', { name: /Walk it again/ }).click();
  const after = await page.evaluate(() => {
    const s = window.__otp!.store.getState();
    return { phase: s.phase, runId: s.runId, verdicts: s.verdicts, log: s.log.length };
  });
  expect(after.phase).toBe('explore');
  expect(after.verdicts).toEqual({});
  expect(after.log).toBe(0);
  expect(after.runId).not.toBe(firstRun);
});

test('replay puts Red back at the spawn and lets the notice fire again', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  const spawn = await page.evaluate(() =>
    window.__otp!.mapObjects!.find((o) => o.name === 'spawn-red')!,
  );

  // Decide everything, read the notice while still exploring, then finish the run.
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['rabbit', 'cottage-finder', 'restrict'],
      ['owl', 'word-weaver', 'restrict'],
      // Allowing the lantern is what lights the third leg now that restricting it grants nothing.
      ['lantern-keeper', 'night-light', 'allow'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
  });
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();
  expect((await probe(page)).flags).toEqual(['locationLeaked']);

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  await finishArrival(page);

  await page.getByRole('button', { name: /Walk it again/ }).click();
  const after = await probe(page);
  expect(after.phase).toBe('explore');
  expect(after.flags).toEqual([]);
  // Red is a world object: resetting the store alone used to leave her at the cottage gate.
  expect(Math.abs(after.position.x - spawn.x)).toBeLessThan(64);
  expect(Math.abs(after.position.y - spawn.y)).toBeLessThan(64);

  // The notice must be offered again, or the lesson can only ever land once.
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();
});

test('a verdict is confirmed in words, not as a raw id', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
  });
  await expect(page.locator('.otp-toast')).toHaveText('Restricted: Cottage Finder');
});

test('the notation chip counts skills seen, then decided', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await expect(page.locator('.otp-hud .otp-chip')).toContainText('0 of 3 skills seen');

  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
  });
  await expect(page.locator('.otp-hud .otp-chip')).toContainText('1 of 3 skills seen');
});

test('results explain where the points came from', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' }, ['needs']);
  await finishArrival(page);
  const breakdown = page.locator('.otp-hero__breakdown');
  await expect(breakdown).toContainText('from your 3 verdicts');
  await expect(breakdown).toContainText('for asking before you decided');
  await expect(breakdown).toContainText('for never running all three at once');
});
