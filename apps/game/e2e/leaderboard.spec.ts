import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { ready } from './helpers';

/*
 * The post form against an API that answers, in a real browser.
 *
 * Everything else about the board is a unit test with `fetch` replaced, and `e2e/game.spec.ts`
 * covers the case that matters most -- no API deployed at all, which is what `vite preview` is.
 * What nothing covered was a post that SUCCEEDS, a post that is refused, and the one failure the
 * adapter used to get wrong: a reply whose headers arrive and whose body never does. Those need a
 * fake route, so they live here rather than in the specs that own the form.
 *
 * `page.route` fakes the server, not the game: the browser still makes a real same-origin request
 * to /api/score through the real adapter, and the page still renders whatever comes back.
 */

const CONTENT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as { strings: Record<string, string> };

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** A finished, careful run, played through the real store. */
async function reachResults(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.evaluate((skillOf) => {
    const { store } = window.__otp!;
    for (const [character, verdict] of Object.entries({
      rabbit: 'restrict',
      owl: 'reject',
      'lantern-keeper': 'allow',
    })) {
      store.dispatch({ type: 'MEET', c: character });
      store.dispatch({ type: 'INSPECT', s: skillOf[character] });
      store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, SKILL_OF);
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

const post = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Post', exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

test('a post the board takes says which name went up', async ({ page }) => {
  let sent: { handle?: string; log?: unknown[]; score?: unknown } = {};
  await page.route('**/api/score', async (route: Route) => {
    sent = JSON.parse(route.request().postData() ?? '{}') as typeof sent;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: sent.handle, score: 900 }),
    });
  });

  await reachResults(page);
  await post(page);

  // The handle is minted, never typed, and no score is sent (golden rule 6). The sharper claim
  // the minted field makes available: the name on the wire is the name on the screen.
  expect(sent.handle).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
  expect(sent.handle).toBe(
    await page.locator('.otp-handle [data-handle]').getAttribute('data-handle'),
  );
  expect(Object.keys(sent).sort()).toEqual(['handle', 'log']);
  await expect(page.getByRole('status')).toContainText(sent.handle!);
});

test('a post the board refuses is not reported as a board that is down', async ({ page }) => {
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that submission is not valid' }),
    }),
  );

  await reachResults(page);
  await post(page);

  const status = page.getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).not.toContainText(/unavailable/i);
  await expect(status).toContainText(/could not be posted/i);
});

/** The line the game shows for a board that is not answering, matched on its own first words. */
const DOWN = new RegExp(CONTENT.strings['leaderboardDown']!.slice(0, 12), 'i');

test('a reply that stops mid-body gives the player the button back', async ({ page }) => {
  // Headers that promise forty bytes and a body that delivers twenty-eight: the read fails rather
  // than finishing, and that has to come back as the unavailable line, not as a dead button.
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '40' },
      body: '{"handle":"brave-lantern-42"',
    }),
  );

  await reachResults(page);
  await post(page);

  await expect(page.getByRole('status')).toContainText(DOWN);
  // The one thing Phase 5 promised: results and the call to action are still there to use.
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  await expect(page.locator('.otp-cta').first()).toBeVisible();
});

test('a reply that never comes is given up on, in a real browser', async ({ page }) => {
  /*
   * The six-second abort, against a route that answers after eight. This is the pre-headers stall;
   * the one where the HEADERS arrive and the body is then held open forever cannot be built with
   * `route.fulfill`, so it lives in test/leaderboard.test.ts, where a ReadableStream can be held
   * open and the abort can be shown to error it. That is the case `ask()` reads the body inside the
   * timed region for, and reverting that line makes the unit test hang.
   */
  await page.route('**/api/score', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(
      () => undefined, // the browser has already abandoned the request
    );
  });

  await reachResults(page);
  await post(page);

  await expect(page.getByRole('status')).toContainText(DOWN, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  await expect(page.locator('.otp-cta').first()).toBeVisible();
});
