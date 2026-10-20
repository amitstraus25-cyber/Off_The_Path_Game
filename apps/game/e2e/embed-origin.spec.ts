/*
 * WHAT THE PARENT PAGE ACTUALLY RECEIVES, FROM EVERY ORIGIN ALLOWED TO FRAME THE GAME.
 *
 * The game's only analytics channel is five postMessage events to the page that embeds it
 * (ARCHITECTURE section 9 / decision D9). `postMessage` delivers only when the target origin
 * matches the recipient's exactly, so a build that names one host serves exactly one host -- and
 * every other page `frame-ancestors` allows gets silence. That shipped: the origin was baked in as
 * `https://www.cyera.com` while the policy allows the apex and every `*.cyera.com`. Chrome reports
 * the mismatch as a console WARNING, and e2e/smoke.spec.ts's console gate only fails on errors, so
 * nothing in this repo could see it.
 *
 * test/embed-origin.test.ts checks the allow-list against vercel.json without a browser. This file
 * is the other half and the one that would have caught it: a real parent page at a real origin,
 * framing the real build, waiting for the real event. No DNS and no server -- every request under
 * cyera.com is fulfilled from `dist`, which is also what lets a parent origin be chosen per test.
 *
 * The origins come out of vercel.json rather than being typed here, so widening or narrowing the
 * policy moves this suite with it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const VERCEL = fileURLToPath(new URL('../../../vercel.json', import.meta.url));

/** The game's own origin. Any cyera.com host will do; what is under test is the PARENT's. */
const GAME_ORIGIN = 'https://game.cyera.com';

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

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** The host sources `frame-ancestors` names, as parent origins a browser could really report. */
function allowedParentOrigins(): string[] {
  const config = JSON.parse(readFileSync(VERCEL, 'utf8')) as { headers?: HeaderRule[] };
  const origins: string[] = [];
  for (const rule of config.headers ?? [])
    for (const header of rule.headers) {
      if (header.key.toLowerCase() !== 'content-security-policy') continue;
      for (const chunk of header.value.split(';')) {
        const parts = chunk.trim().split(/\s+/).filter(Boolean);
        if (parts[0]?.toLowerCase() !== 'frame-ancestors') continue;
        for (const source of parts.slice(1)) {
          if (source.startsWith("'")) continue; // a keyword, not a host
          // `https://*.cyera.com` is a pattern, not an origin: stand a real subdomain in for it.
          origins.push(source.replace('://*.', '://research.'));
        }
      }
    }
  return [...new Set(origins)];
}

interface Received {
  origin: string;
  type: string;
}

/**
 * The research page, as far as this test is concerned: something that frames the game and listens.
 *
 * Deliberately not the real page. What is under test is the game's half of the contract, and a
 * listener that records every message is the strictest possible parent -- it would see an event
 * sent to the wrong origin if a browser ever delivered one.
 */
const PARENT_HTML = `<!doctype html><meta charset="utf-8"><title>research</title>
<script>
  window.__received = [];
  addEventListener('message', (e) => {
    window.__received.push({ origin: e.origin, type: e.data && e.data.type });
  });
</script>
<iframe id="game-frame" src="${GAME_ORIGIN}/" width="900" height="600"></iframe>`;

/** Frames the built game inside a page at `parentOrigin`, and waits for the world to be up. */
async function frameTheGame(page: Page, parentOrigin: string): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === parentOrigin && url.pathname === '/')
      return route.fulfill({ status: 200, contentType: 'text/html', body: PARENT_HTML });
    if (url.origin !== GAME_ORIGIN) return route.abort();
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    try {
      const body = readFileSync(DIST + path.slice(1));
      const extension = path.split('.').pop() ?? '';
      return route.fulfill({
        status: 200,
        contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
        body,
      });
    } catch {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not in dist' });
    }
  });
  await page.goto(`${parentOrigin}/`);
  // The world being up is the synchronisation point: `otp:ready` is emitted on the same event.
  // Waiting on it rather than on a timeout is what makes "received nothing" below mean something.
  await page.frameLocator('#game-frame').locator('#game[data-ready="true"]').waitFor();
}

const received = (page: Page): Promise<Received[]> =>
  page.evaluate(() => (window as unknown as { __received: Received[] }).__received);

const origins = allowedParentOrigins();

test('vercel.json names at least one page that may frame the game', () => {
  // Without this, every parameterised test below would simply not exist, and the file would pass.
  expect(origins.length, 'no frame-ancestors host source in vercel.json').toBeGreaterThan(0);
});

for (const parentOrigin of origins) {
  test(`a parent at ${parentOrigin} receives otp:ready`, async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));

    await frameTheGame(page, parentOrigin);
    await expect.poll(async () => (await received(page)).map((r) => r.type)).toContain('otp:ready');

    // The event has to arrive FROM the game's origin, not merely arrive.
    expect((await received(page)).every((r) => r.origin === GAME_ORIGIN)).toBe(true);
    // The silent failure this file exists for announces itself only here.
    expect(warnings.filter((w) => /does not match the recipient window's origin/.test(w))).toEqual(
      [],
    );
  });
}

test('a parent outside the policy receives nothing', async ({ page }) => {
  await frameTheGame(page, 'https://not-cyera.example.com');
  expect(await received(page)).toEqual([]);
});
