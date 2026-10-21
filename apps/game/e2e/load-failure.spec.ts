import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { ready, startGame } from './helpers';

/*
 * A FILE THAT WILL NOT LOAD IS SAID OUT LOUD, AND CAN BE TRIED AGAIN.
 *
 * It used to be silent. Each asset was blocked in turn and the page was watched: a tileset or a map
 * that 404ed left the title up with Begin enabled and the world never ready; Purple's atlas that
 * 404ed let the scene become ready with no Purple in it; a character sheet that 404ed threw a
 * second time out of the forest scene. `BootScene`'s `loaderror` handler THREW, and a throw from
 * inside an emitter callback is caught by nothing, so the only evidence anywhere was a line in the
 * console. See ui/ProblemScreen.tsx and world/scenes.ts.
 *
 * EVERY FILE IN THE MANIFEST, not a hand-picked few. The list is read from `manifest.json`, the
 * file the loader itself is built from, so an asset added next month is covered the day it is added
 * and a class this spec's author forgot cannot be the one that ships silent. Twenty-six today.
 *
 * Each is asserted four ways, because any one of them alone passes on something broken: the screen
 * appears and names the right keys; nothing else is offered (no title, no Begin, no HUD); no
 * browser error text or trace reaches the visitor; and the retry button really restarts the load --
 * it succeeds once the file is back, and re-requests the file and shows the screen again when it is
 * not.
 */

interface Manifest {
  tilesets: string[];
  maps: string[];
  atlases: { image: string; data: string }[];
  spritesheets: { key: string }[];
  images: string[];
}

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/assets/manifest.json', import.meta.url)), 'utf8'),
) as Manifest;

const keyOf = (file: string): string => file.replace(/\.(png|json)$/, '');

/** One file the loader asks for, the key Phaser reports it under, and what kind of thing it is. */
interface Asset {
  file: string;
  key: string;
  kind: string;
}

const ASSETS: Asset[] = [
  ...manifest.tilesets.map((file) => ({ file, key: keyOf(file), kind: 'tileset' })),
  ...manifest.maps.map((file) => ({ file, key: keyOf(file), kind: 'map' })),
  ...manifest.atlases.flatMap((a) => [
    { file: a.image, key: keyOf(a.image), kind: 'atlas image' },
    { file: a.data, key: keyOf(a.image), kind: 'atlas data' },
  ]),
  ...manifest.spritesheets.map((s) => ({ file: `${s.key}.png`, key: s.key, kind: 'sprite sheet' })),
  ...manifest.images.map((file) => ({ file, key: keyOf(file), kind: 'image' })),
];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The URL Vite gave a file: `/assets/<name>-<8 character hash>.<ext>`. Matched on the whole last
 * segment, so `purple.png` cannot also catch `portrait-purple.png` and `tileset-forest.png` cannot
 * catch `tileset-forest.gids.json`.
 */
const urlOf = (file: string): RegExp => {
  const dot = file.lastIndexOf('.');
  return new RegExp(
    `/assets/${escapeRegExp(file.slice(0, dot))}-[A-Za-z0-9_-]{8}\\.${escapeRegExp(file.slice(dot + 1))}$`,
  );
};

/** Blocks one file with a 404 and counts how often the page asks for it. */
async function block(page: Page, file: string): Promise<{ requests: () => number }> {
  let requests = 0;
  await page.route(urlOf(file), (route: Route) => {
    requests += 1;
    return route.fulfill({ status: 404, body: 'not found' });
  });
  return { requests: () => requests };
}

const problem = (page: Page) => page.locator('.otp-problem[data-problem="load"]');

test.describe('every file the game loads', () => {
  test.describe.configure({ mode: 'parallel' });

  test('the manifest is read, and it is not empty', () => {
    // A guard that silently stops matching is worse than none: if the manifest's shape moved and
    // this list came out empty, every test below would simply not exist.
    expect(ASSETS.length, 'assets found in manifest.json').toBeGreaterThan(20);
    expect(ASSETS.map((a) => a.kind)).toEqual(
      expect.arrayContaining([
        'tileset',
        'map',
        'atlas image',
        'atlas data',
        'sprite sheet',
        'image',
      ]),
    );
  });

  for (const asset of ASSETS) {
    test(`a missing ${asset.kind} (${asset.file}) shows the retry screen, and retrying works`, async ({
      page,
    }) => {
      const blocked = await block(page, asset.file);
      await page.goto('/');

      // 1. It is said, and says WHICH, for whoever opens the inspector.
      await expect(problem(page), 'no retry screen: the failure is silent').toBeVisible();
      await expect(problem(page)).toHaveAttribute('data-failed', new RegExp(`\\b${asset.key}\\b`));
      expect(blocked.requests(), 'the file was never requested, so the block proved nothing').toBe(
        1,
      );

      // 2. Nothing else is offered over a world that was never built.
      await expect(
        page.getByRole('button', { name: /Begin the walk/ }),
        'a Begin button over an empty world',
      ).toHaveCount(0);
      await expect(page.locator('.otp-hud, .otp-world-frame, .otp-title-panel')).toHaveCount(0);
      expect(
        await page.evaluate(() => document.getElementById('game')?.dataset['ready']),
        'the world claimed to be ready',
      ).not.toBe('true');

      // 3. Our words only. No browser message, no trace, no file name, no key.
      const shown = await page.locator('#ui').innerText();
      expect(shown).not.toMatch(/\bat \S+ \(|\.js\b|\.tsx?\b|Error|undefined|\bnull\b|404|Phaser/);
      expect(shown).not.toContain(asset.key);
      expect(shown).not.toContain(asset.file);

      // 4a. Try again with the file still broken: it must ask again and say so again.
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect
        .poll(() => blocked.requests(), { message: 'Try again did not request the file again' })
        .toBe(2);
      await expect(problem(page), 'the failure was not shown a second time').toBeVisible();

      // 4b. And with the file back, it recovers into the real game, not into a half-built one.
      await page.unroute(urlOf(asset.file));
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(problem(page)).toHaveCount(0);
      await ready(page);
      await startGame(page);
      expect((await page.evaluate(() => window.__otp!.store.getState().phase)) as string).toBe(
        'explore',
      );
    });
  }
});

test('the retry screen is on brand: one Lime, no red or green, one heading, focus on the button', async ({
  page,
}) => {
  await block(page, manifest.tilesets[0]!);
  await page.goto('/');
  await expect(problem(page)).toBeVisible();
  // Focus is moved by an effect after the screen mounts; wait for it rather than racing it.
  await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused();

  const census = await page.evaluate(() => {
    const css = (name: string): string =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase();
    const hex = (rgb: string): string => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
      return m
        ? `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`
        : rgb;
    };
    const root = document.querySelector('.otp-problem')!;
    const painted: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const s = getComputedStyle(el);
      for (const v of [s.backgroundColor, s.color, s.borderTopColor, s.fill]) painted.push(hex(v));
    }
    const lime = css('--cyera-lime');
    const limeFills = [root, ...root.querySelectorAll('*')].filter(
      (el) => hex(getComputedStyle(el).backgroundColor) === lime,
    ).length;
    // Anything where red clearly outweighs the other channels, or green does -- except the brand's
    // own Lime, which is green by any measure and is the one sanctioned fill, counted above.
    const status = painted.filter((c) => {
      if (c === lime) return false;
      const m = /^#(..)(..)(..)$/.exec(c);
      if (!m) return false;
      const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i]!, 16)) as [number, number, number];
      return (r > g + 60 && r > b + 60) || (g > r + 60 && g > b + 60);
    });
    return {
      limeFills,
      status,
      headings: root.querySelectorAll('h1').length,
      focused: document.activeElement?.textContent ?? '',
    };
  });
  expect(census.limeFills, 'Lime appears once per screen').toBe(1);
  expect(census.status, 'no red or green status colour').toEqual([]);
  expect(census.headings, 'the screen has one heading').toBe(1);
  expect(census.focused, 'focus lands on the one thing to do').toBe('Try again');
});

/* ------------------------------------------------------------------ boot and crashes */

test('a manifest that will not fetch shows the same screen, and Try again reloads', async ({
  page,
}) => {
  await page.route(/\/assets\/manifest-[A-Za-z0-9_-]{8}\.json$/, (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await page.goto('/');
  await expect(page.locator('.otp-problem')).toBeVisible();
  await expect(page.locator('#ui')).not.toContainText(/Something went wrong loading the game/);

  await page.unroute(/\/assets\/manifest-[A-Za-z0-9_-]{8}\.json$/);
  await page.getByRole('button', { name: 'Try again' }).click();
  await ready(page);
  await expect(page.locator('.otp-problem')).toHaveCount(0);
});

/*
 * A fault in OUR code is thrown from a script this origin served, because that is the only kind
 * the game has. These used to throw from `page.evaluate`, which has no filename and no stack frame
 * from the origin -- exactly the shape main.ts now treats as "not the game" and logs instead.
 */
const fromOurScript = async (
  page: import('@playwright/test').Page,
  body: string,
): Promise<void> => {
  await page.route('**/__fault.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body }),
  );
  await page.addScriptTag({ url: '/__fault.js' });
};

for (const [how, thrower] of [
  ['an uncaught error', 'setTimeout(() => { throw new Error("secret-detail-ONE"); }, 0)'],
  ['an unhandled rejection', 'void Promise.reject(new Error("secret-detail-TWO"))'],
] as const) {
  test(`${how} after boot shows a friendly screen with no trace, and Reload restarts`, async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page);
    await fromOurScript(page, thrower);

    const screen = page.locator('.otp-problem[data-problem="crash"]');
    await expect(screen, 'no screen after a crash').toBeVisible();
    const shown = await page.locator('#ui').innerText();
    expect(shown).not.toMatch(/secret-detail|\bat \S+ \(|\.js\b|Error:/);
    // The game behind it is out of reach, not just out of sight.
    expect(
      await page
        .getByRole('button', { name: /Begin the walk/ })
        .evaluate((el) => el.closest('[inert]') !== null),
      'the title is still reachable behind the crash screen',
    ).toBe(true);
    await expect(page.locator('#game')).toHaveAttribute('inert', '');
    await expect(screen.getByRole('button', { name: 'Reload the game' })).toBeFocused();

    await Promise.all([
      page.waitForNavigation(),
      screen.getByRole('button', { name: 'Reload the game' }).click(),
    ]);
    await ready(page);
    await expect(page.locator('.otp-problem')).toHaveCount(0);
  });
}

/*
 * THE OTHER HALF, and the reason the filter exists: a visitor's browser extension, or anything
 * else not served by this origin, must not end their game. An adversarial reviewer named this
 * after the first version mounted a fatal screen for any error on the page.
 */
test('an error from a browser extension does not end the game', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Uncaught TypeError: x is not a function',
        filename: 'chrome-extension://abcdefghijklmnop/content.js',
      }),
    ),
  );
  await page.waitForTimeout(200);
  await expect(page.locator('.otp-problem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Begin the walk/ })).toBeEnabled();
});

test('a rejection from outside the game does not end it', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // Evaluated code has no frame from this origin -- the shape of a rejection that is not ours.
  await page.evaluate('void Promise.reject(new Error("not-the-game"))');
  await page.waitForTimeout(200);
  await expect(page.locator('.otp-problem')).toHaveCount(0);
});

test('a ResizeObserver notice is not a crash', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'ResizeObserver loop completed with undelivered notifications.',
      }),
    ),
  );
  await page.waitForTimeout(200);
  await expect(page.locator('.otp-problem')).toHaveCount(0);
});
