import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { answerAllAndArrive, ready, toTheReveal } from './helpers';

/*
 * THE PRIVACY LINE IS TRUE: after a whole run the visitor's browser holds nothing of ours.
 *
 * The Results screen says "We store your handle and score only. No account, no email, no cookies."
 * It is Legal-reviewed copy (docs/COPY_REVIEW.md) and not ours to reword. For as long as the music
 * toggle wrote `localStorage['otp:music']` the sentence was wrong, on a page that exists to say a
 * data security company takes this seriously -- and nothing noticed, because the only thing that
 * ever looked at storage was the music's own test.
 *
 * ENUMERATED, NOT PROBED. This does not look for `otp:music`. A guard that names the key goes on
 * passing the day somebody persists the same boolean as `otp-sound`, or in sessionStorage, or in a
 * cookie, or in an IndexedDB database -- and every one of those is a different way of making that
 * sentence false. It lists all of them and demands each be empty.
 *
 * The second test is the guard on the guard. An enumerator that returns `[]` for everything -- an
 * API that is absent, a typo, a store this browser hides from `evaluate` -- would pass the first
 * test for the wrong reason, which is the most expensive kind of pass in this repo. So the second
 * writes one canary into each store and demands that the SAME function finds it.
 */

const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { chrome: Record<string, string> } };

interface StorageContents {
  localStorage: string[];
  sessionStorage: string[];
  /** What script can see. */
  documentCookie: string;
  indexedDB: string[];
  /** The Cache API and service workers: browser storage too, and not in the sentence either. */
  cacheStorage: string[];
  serviceWorkers: number;
}

/** Everything the page's origin has stored, by key or name, in the browser it runs in. */
async function enumerateStorage(page: Page): Promise<StorageContents> {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases !== 'function')
      throw new Error('this browser cannot list IndexedDB databases, so emptiness cannot be shown');
    const keys = (s: Storage): string[] =>
      Array.from({ length: s.length }, (_, i) => s.key(i) ?? '<null key>');
    return {
      localStorage: keys(localStorage),
      sessionStorage: keys(sessionStorage),
      documentCookie: document.cookie,
      indexedDB: (await indexedDB.databases()).map((d) => d.name ?? '<unnamed>'),
      cacheStorage: await caches.keys(),
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
    };
  });
}

/** Cookies as the browser holds them, which includes the HttpOnly ones script cannot see. */
const browserCookies = (context: BrowserContext) => context.cookies();

/** Plays the whole way from the title to the Results screen, the way a player does. */
async function playWholeRun(page: Page): Promise<void> {
  // A run the server started, so the reveal carries the post form and its privacy line.
  await page.route('**/api/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ seed: 0, token: 'dGVzdA.c2ln' }),
    }),
  );
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.getByRole('button', { name: /Start walking/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'forest');

  // The music, turned on and off and on again: the only control in the game that ever kept a setting.
  const music = page.getByRole('switch', { name: /music/i });
  await music.click();
  await expect(music).toHaveAttribute('aria-checked', 'true');
  await music.click();
  await expect(music).toHaveAttribute('aria-checked', 'false');
  await music.click();
  await expect(music).toHaveAttribute('aria-checked', 'true');

  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

test('a whole run, with the music toggled, leaves every kind of browser storage empty', async ({
  page,
  context,
}) => {
  await playWholeRun(page);

  // The sentence under test is on the screen the run ends on, in the words Legal approved.
  const line = content.ui.chrome['privacyLine'];
  expect(line, 'content/game.v2.json has no privacyLine').toBeTruthy();
  await expect(page.locator('body')).toContainText(line!);
  expect(line).toMatch(/no cookies/i);

  expect(await enumerateStorage(page), 'browser storage after a whole run').toEqual({
    localStorage: [],
    sessionStorage: [],
    documentCookie: '',
    indexedDB: [],
    cacheStorage: [],
    serviceWorkers: 0,
  });
  expect(await browserCookies(context), 'cookies, HttpOnly included').toEqual([]);
});

test('and the enumeration is able to see a thing when one is there', async ({ page, context }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    localStorage.setItem('canary', '1');
    sessionStorage.setItem('canary', '1');
    document.cookie = 'canary=1; path=/';
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('canary');
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });
    await caches.open('canary');
  });

  const seen = await enumerateStorage(page);
  expect(seen.localStorage, 'localStorage canary').toEqual(['canary']);
  expect(seen.sessionStorage, 'sessionStorage canary').toEqual(['canary']);
  expect(seen.documentCookie, 'document.cookie canary').toBe('canary=1');
  expect(seen.indexedDB, 'IndexedDB canary').toEqual(['canary']);
  expect(seen.cacheStorage, 'Cache API canary').toEqual(['canary']);
  expect(
    (await browserCookies(context)).map((c) => c.name),
    'browser cookie canary',
  ).toEqual(['canary']);
});
