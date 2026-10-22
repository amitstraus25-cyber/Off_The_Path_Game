/*
 * THE FIRST TIME ANYTHING IN THIS REPO HAS LOADED THE GAME UNDER THE HEADERS IT SHIPS WITH.
 *
 * `vercel.json` carries the Content-Security-Policy and three other security headers. Nothing ran
 * against them. test/csp.test.ts compares two files as TEXT -- a good guard on what the policy
 * SAYS, blind to what a browser DOES with it -- and `vite preview`, which every other spec in this
 * directory talks to, serves no headers at all. So the shipped policy was enforced for the first
 * time in production, where this project has nobody watching, and a violation of it could survive
 * a whole phase. One has.
 *
 * This file closes that: a real server, the real `dist`, and every header read out of vercel.json
 * rather than retyped here, with the browser's own `securitypolicyviolation` event as the verdict.
 * The run drives the game through every screen it has -- title, forest, question, skill card,
 * verdicts, arrival, results, leaderboard -- because a policy is only tested by the code that
 * actually runs under it, and the leaderboard's two fetches are the only exercise `connect-src`
 * ever gets.
 *
 * THE CANARY IS LOAD-BEARING. "No violations were reported" is also what a page with no policy
 * reports, what a page that failed to load reports, and what a browser whose listener was attached
 * too late reports. So the run begins by doing something the policy forbids and asserting the
 * browser objects. Only then does an empty list mean anything.
 *
 * WHAT IT REPORTS ON THE BUILD IT WAS WRITTEN AGAINST, so nobody mistakes the red for flake:
 *
 *     script-src blocked eval at /assets/index-*.js:68
 *
 * That is zod 4.6.5 deciding whether it may compile validators, with `new Function("")` inside a
 * try/catch. The parse succeeds either way -- zod falls back -- but a Cyera page logs a CSP error
 * to every visitor's console. The switch is one line, `z.config({ jitless: true })`, before the
 * first schema is parsed; measured against the real package under this exact policy, it removes
 * the violation and leaves parsing working. It belongs in packages/core, which this task does not
 * own, so it is handed over rather than applied here.
 */
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAllAndArrive, startGame, toTheReveal } from './helpers';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const VERCEL = fileURLToPath(new URL('../../../vercel.json', import.meta.url));

/** An origin the policy does not name, for the canary. Never fetched: the point is that it is not. */
const FORBIDDEN_IMAGE = 'https://not-cyera.example.com/pixel.png';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/**
 * Every header vercel.json applies to the game's own paths, in the order it declares them.
 *
 * `/(.*)` is the catch-all rule the game is served under. Matching Vercel's path syntax properly
 * is not this file's job -- what matters is that the headers are read from the shipped config and
 * never retyped, so relaxing the policy there turns this suite red here.
 */
function shippedHeaders(): { key: string; value: string }[] {
  const config = JSON.parse(readFileSync(VERCEL, 'utf8')) as { headers?: HeaderRule[] };
  return (config.headers ?? [])
    .filter((rule) => rule.source === '/(.*)')
    .flatMap((rule) => rule.headers);
}

/** Serves `dist` with those headers on every response, exactly as the host would. */
function serveDist(headers: { key: string; value: string }[]): Promise<{
  server: Server;
  origin: string;
}> {
  const server = createServer((req, res) => {
    for (const { key, value } of headers) res.setHeader(key, value);
    const path = (req.url ?? '/').split('?')[0] ?? '/';

    /*
     * The leaderboard, answering the way a deployed one would.
     *
     * A 404 here would be the "board is down" path, and that path returns BEFORE the client parses
     * anything -- so the zod schema that reads the reply would never run in the browser, and the
     * directive most likely to be tripped by a validation library would go untested under the very
     * policy this file exists to test. The handle is echoed from the request because only a handle
     * the game itself minted passes `handleSchema`, and the game mints its own.
     */
    if (path === '/api/score') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const handle = (JSON.parse(body || '{}') as { handle?: string }).handle ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ handle, score: 0 }));
      });
      return;
    }
    if (path === '/api/top') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries: [] }));
      return;
    }

    const file = path === '/' ? 'index.html' : path.slice(1);
    try {
      const body = readFileSync(DIST + file);
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not in dist');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

interface Violation {
  directive: string;
  blocked: string;
  source: string;
  line: number;
}

const violations = (page: Page): Promise<Violation[]> =>
  page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp);

test('the game runs clean under the headers vercel.json ships', async ({ page }) => {
  const headers = shippedHeaders();
  // The self-check. With no headers parsed, every assertion below holds over nothing.
  expect(headers.map((h) => h.key)).toContain('Content-Security-Policy');

  const { server, origin } = await serveDist(headers);
  const asked: string[] = [];
  const refused: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  // Chromium reports a CSP-blocked subresource as a request that then fails, so `asked` alone
  // cannot tell "fetched" from "blocked"; this is the list that can.
  page.on('requestfailed', (r) => refused.push(r.url()));
  try {
    await page.addInitScript(() => {
      (window as unknown as { __csp: Violation[] }).__csp = [];
      addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { __csp: Violation[] }).__csp.push({
          directive: e.violatedDirective,
          blocked: e.blockedURI,
          source: e.sourceFile ?? '',
          line: e.lineNumber,
        });
      });
    });

    // A run the server started, so the reveal carries the post form this file posts through.
    await page.route('**/api/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ seed: 0, token: 'dGVzdA.c2ln' }),
      }),
    );
    const response = await page.goto(origin + '/');

    /*
     * The headers reached the browser. Without this the whole file is a test of an unprotected
     * page: a typo in the server above, or a header Vercel declares under a key a browser ignores,
     * and "no violations" means "no policy".
     */
    const got = response!.headers();
    for (const { key, value } of headers)
      expect(got[key.toLowerCase()], `${key} did not reach the browser`).toBe(value);

    // The canary: an image from an origin `img-src 'self' data:` does not name. If the browser
    // does not object to THIS, it is not enforcing anything and the rest of the run proves nothing.
    await page.evaluate((src) => {
      const img = document.createElement('img');
      img.src = src;
      document.body.appendChild(img);
    }, FORBIDDEN_IMAGE);
    await expect
      .poll(async () => (await violations(page)).some((v) => v.blocked === FORBIDDEN_IMAGE))
      .toBe(true);

    /*
     * The list is NOT cleared here, and that is the whole difference between this file working and
     * not. The first draft reset it after the canary, which read as tidy and threw away every
     * violation raised while the page was LOADING -- which is exactly when the one real violation
     * in this bundle happens. The canary is excluded by its URL at the end instead.
     */
    await startGame(page);
    // Every offer left: a clean arrival, the one kind of run the board takes (a wolf run is not
    // posted, so its reveal has no Post button to press).
    await answerAllAndArrive(page, 'leave');
    await toTheReveal(page);

    /*
     * Posting a score is the ONLY thing in the shipped game that uses connect-src, so it is the
     * only way this file can test that directive at all. (`/api/top` has no caller: the client's
     * `top()` is wired to nothing, so a dispatch of LEADERBOARD fetches nothing. Measured here
     * first, as a run that reached results and made no request at all.) The server answers 404,
     * which is the documented "board is down" path and leaves the game playable.
     */
    await page.locator('form.otp-post button[type="submit"]').click();
    await expect.poll(() => asked.some((url) => url.includes('/api/score'))).toBe(true);
    /*
     * The confirmation, not just the request: it is what proves the client got past `reply.ok` and
     * actually ran the zod schema over the body, in the browser, under this policy. The wording is
     * `ASSIGNED` in src/net/leaderboard.ts, which that file says is a code literal rather than a
     * content key until two strings land, so it is matched loosely and from one side only.
     */
    await expect(page.getByText(/Posted to the board/i)).toBeVisible();

    /*
     * The run did what the run is for. A `connect-src` that never connected, or a stylesheet that
     * never loaded, is a policy nothing exercised -- and this assertion is the difference between
     * "clean" and "the page never got far enough to be dirty".
     */
    expect(asked.some((url) => url.endsWith('.css'))).toBe(true);
    expect(refused, 'the canary image was not blocked').toContain(FORBIDDEN_IMAGE);
    expect(
      refused.filter((url) => url !== FORBIDDEN_IMAGE),
      'the policy blocked something the game asked for',
    ).toEqual([]);

    /*
     * Everything the browser objected to except the canary. The message carries the directive, the
     * file and the line, because a bare "expected [] to equal [...]" over a minified bundle is a
     * finding nobody can act on.
     */
    const found = (await violations(page)).filter((v) => v.blocked !== FORBIDDEN_IMAGE);
    expect(
      found.map((v) => `${v.directive} blocked ${v.blocked} at ${v.source}:${v.line}`),
      'the shipped policy blocked something the game does',
    ).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
