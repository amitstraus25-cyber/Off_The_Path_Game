/*
 * "READ THE RESEARCH", EMBEDDED AND NOT (the web agency's contract, 2026-10-25).
 *
 * Framed by an allowed parent, a plain click on the results screen's link posts
 * `{ type: 'OFF_THE_PATH_READ_RESEARCH' }` to the parent's EXACT origin and does not navigate -- the
 * parent scrolls itself. Opened directly (or framed by a page that is not on the allow-list) the
 * same link is just a link and opens DEFAULT_RESEARCH_URL. The unit half is
 * test/embed-origin.test.ts; this is the browser half, with a real parent at a real origin framing
 * the real build (no DNS: everything under the parent origins and the game origin is fulfilled
 * from `dist`, which is also what lets the parent origin be chosen per test).
 *
 * The parent origins are the ones the agency named, written here on purpose: they are the
 * contract, and a policy edit that drops one should turn this red.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const GAME_ORIGIN = 'https://game.cyera.com';
const MESSAGE = 'OFF_THE_PATH_READ_RESEARCH';
/**
 * DEFAULT_RESEARCH_URL, written out: the module reads `import.meta.env`, which Vite supplies and
 * Playwright's node process does not, and the URL is part of the agency's contract anyway.
 */
const DEFAULT_RESEARCH_URL = 'https://www.cyera.com/research';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  png: 'image/png',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  woff2: 'font/woff2',
  ico: 'image/x-icon',
};

const PARENT_HTML = `<!doctype html><meta charset="utf-8"><title>research</title>
<script>
  window.__received = [];
  addEventListener('message', (e) => {
    window.__received.push({ origin: e.origin, data: e.data });
  });
</script>
<iframe id="game-frame" src="${GAME_ORIGIN}/" width="1200" height="800"></iframe>`;

interface Received {
  origin: string;
  data: { type?: string };
}

/** Serves `dist` at the game origin; every other origin is the test's to answer or refused. */
async function serveGame(page: Page, parents: Record<string, string> = {}): Promise<string[]> {
  const requested: string[] = [];
  // On the context, so a popup the link opens is served too.
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const parent = parents[url.origin];
    if (parent !== undefined && url.pathname === '/')
      return route.fulfill({ status: 200, contentType: 'text/html', body: parent });
    if (url.origin !== GAME_ORIGIN) {
      requested.push(url.href);
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>elsewhere</title>',
      });
    }
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    try {
      const body = readFileSync(DIST + path.slice(1));
      return route.fulfill({
        status: 200,
        contentType: CONTENT_TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream',
        body,
      });
    } catch {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not in dist' });
    }
  });
  return requested;
}

/** From the title screen to the reveal, answering every offer through the store. */
async function toTheReveal(game: Page | Frame): Promise<void> {
  await game.waitForSelector('#game[data-ready="true"]');
  await game.getByRole('button', { name: /Begin the walk/ }).click();
  await game.getByRole('button', { name: /Start walking/ }).click();
  await game.waitForFunction(() => window.__otp?.store.getState().phase === 'forest');
  await game.evaluate(() => {
    const { store, content } = window.__otp!;
    for (const c of content.characters) {
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'INSPECT', s: c.skillId });
      store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'leave' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  });
  const finish = game.locator('[data-arrive] [data-action="finish"]');
  await game.locator('[data-arrive]').waitFor();
  while (!(await finish.isVisible())) await game.getByRole('button', { name: 'Go on' }).click();
  await finish.click();
  await game.locator('.otp-reveal').waitFor();
  await expect(game.locator('.otp-screen__body')).toBeFocused();
}

const received = (page: Page): Promise<Received[]> =>
  page.evaluate(() => (window as unknown as { __received: Received[] }).__received);

const researchMessages = async (page: Page): Promise<Received[]> =>
  (await received(page)).filter((r) => r.data?.type === MESSAGE);

for (const parentOrigin of [
  'https://cyera-staging.webflow.io',
  'https://www.cyera.com',
  'https://cyera.com',
]) {
  test(`framed by ${parentOrigin}, the link posts ${MESSAGE} to that origin and does not navigate`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    const elsewhere = await serveGame(page, { [parentOrigin]: PARENT_HTML });
    const popups: string[] = [];
    page.context().on('page', (p) => popups.push(p.url()));

    await page.goto(`${parentOrigin}/`);
    const frame = page.frame({ url: `${GAME_ORIGIN}/` })!;
    await toTheReveal(frame);

    const link = frame.getByRole('link', { name: /Read the research/ });
    // A real link, kept for no-JS, middle-click and assistive technology.
    await expect(link).toHaveAttribute('href', DEFAULT_RESEARCH_URL);

    const navigations: string[] = [];
    page.on('framenavigated', (f) => navigations.push(f.url()));
    await link.click();

    await expect.poll(async () => (await researchMessages(page)).length).toBe(1);
    const [message] = await researchMessages(page);
    // `e.origin` is the GAME's origin, and the parent only saw it because the game's target
    // origin was the parent's exact one (a mismatched target is dropped by the browser).
    expect(message).toEqual({ origin: GAME_ORIGIN, data: { type: MESSAGE } });

    // Nothing navigated: not the parent, not the frame, no new tab, no request to the research.
    await page.waitForTimeout(500);
    expect(navigations).toEqual([]);
    expect(page.url()).toBe(`${parentOrigin}/`);
    expect(frame.url()).toBe(`${GAME_ORIGIN}/`);
    expect(popups).toEqual([]);
    expect(elsewhere.filter((u) => u.startsWith(DEFAULT_RESEARCH_URL))).toEqual([]);
  });
}

test('framed by a page that is not on the allow-list, the link is just a link', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  const stranger = 'https://not-cyera.example.com';
  await serveGame(page, { [stranger]: PARENT_HTML });
  await page.goto(`${stranger}/`);
  const frame = page.frame({ url: `${GAME_ORIGIN}/` })!;
  await toTheReveal(frame);

  const popup = page.waitForEvent('popup');
  await frame.getByRole('link', { name: /Read the research/ }).click();
  expect((await popup).url()).toBe(DEFAULT_RESEARCH_URL);
  expect(await researchMessages(page)).toEqual([]);
});

test('opened directly, the link navigates to the research page', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  const elsewhere = await serveGame(page);
  await page.route(`${GAME_ORIGIN}/api/**`, (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'no api here' }),
  );
  await page.goto(`${GAME_ORIGIN}/`);
  await toTheReveal(page);

  const link = page.getByRole('link', { name: /Read the research/ });
  await expect(link).toHaveAttribute('href', DEFAULT_RESEARCH_URL);
  const popup = page.waitForEvent('popup');
  await link.click();
  expect((await popup).url()).toBe(DEFAULT_RESEARCH_URL);
  expect(elsewhere.some((u) => u.startsWith(DEFAULT_RESEARCH_URL))).toBe(true);
});
