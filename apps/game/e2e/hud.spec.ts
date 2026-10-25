/*
 * The v2 HUD, measured in a browser (ui/Hud.tsx, ui/hud.css). Phase 9 C.
 *
 * The page under test is `e2e/hud-fixture.html`: the HUD alone, in the real world box, with the
 * real stylesheets in the game's own order and the real touch pad beside it. The spec builds it
 * into a temporary directory with Vite's API and serves it by intercepting a path on a made-up
 * origin, so it needs no preview server, no `dist` and no shared port, and the fixture has no road
 * into the game's bundle (see the note at the top of hud-fixture.tsx for why that, and not a flag,
 * is what stops it shipping).
 *
 * WHAT THE UNIT FILE CANNOT SAY. test/hud.test.ts owns what the clock reads and when the region
 * speaks, as pure functions. This file owns what a browser does with them: whether a screen
 * reader's tree carries four announcements and no more, whether the face holds still while the
 * digits change, whether the 0:30 change is a shape and a weight and not a hue, whether the pills
 * clear the real stick and A button at every size the game is played at, and whether every colour
 * the HUD draws is one of the brand's own and none is Lime, red or green.
 *
 * A CHECK THAT CAN PASS WITHOUT LOOKING IS NOT ONE (PAUL_BRIEF trap 6). Every measurement below
 * first asserts the thing it measures exists -- the stick is on screen on a touch device, an icon
 * is loaded before its size is read, the live region mutated before its mutations are counted.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { build } from 'vite';
import type { HudBasketItem } from '../src/ui/Hud';

const E2E = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
const ORIGIN = 'http://hud.test';
const PAGE = `${ORIGIN}/__hud/hud-fixture.html`;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

let outDir = '';

test.beforeAll(async () => {
  test.setTimeout(180_000);
  outDir = mkdtempSync(join(tmpdir(), 'otp-hud-'));
  await build({
    root: E2E,
    configFile: false,
    logLevel: 'error',
    base: '/__hud/',
    publicDir: PUBLIC,
    esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      assetsInlineLimit: 0,
      rollupOptions: { input: join(E2E, 'hud-fixture.html') },
    },
  });
});

test.afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

/** The seven skills as the content draws them: every icon exists since 2026-10-22. */
const FULL_BASKET: HudBasketItem[] = [
  { skillId: 'cottage-finder', name: 'Cottage Finder', icon: 'item-compass' },
  { skillId: 'bridge-key', name: 'Bridge Key', icon: 'item-key' },
  { skillId: 'night-light', name: 'Night Light', icon: 'item-lantern' },
  { skillId: 'slow-post', name: 'Slow Post', icon: 'item-parcel' },
  { skillId: 'word-weaver', name: 'Word Weaver', icon: 'item-weaver' },
  { skillId: 'short-cut', name: 'Short Cut', icon: 'item-shortcut' },
  { skillId: 'latch-lifter', name: 'Latch Lifter', icon: 'item-latch' },
];

/*
 * The placeholder's two ways in, now that no real skill takes either: an icon named in the content
 * that is not in the bundle (a name no art will ever carry), and no icon at all.
 */
const UNPAINTED: HudBasketItem[] = [
  { skillId: 'fixture-unpainted', name: 'Fixture Unpainted', icon: 'item-not-painted' },
  { skillId: 'fixture-iconless', name: 'Fixture Iconless', icon: null },
];

interface Opened {
  page: Page;
  /** console errors, page errors and failed requests seen so far. */
  problems: string[];
  close(): Promise<void>;
}

interface Viewport {
  width: number;
  height: number;
  touch: boolean;
  reducedMotion?: boolean;
}

/** A page on the fixture, in a context shaped like the device under test. */
async function open(browser: Browser, v: Viewport): Promise<Opened> {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    hasTouch: v.touch,
    isMobile: v.touch,
    deviceScaleFactor: 1,
    reducedMotion: v.reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const file = path.startsWith('/__hud/') ? path.slice('/__hud/'.length) : '';
    try {
      const body = readFileSync(join(outDir, file));
      await route.fulfill({
        status: 200,
        body,
        contentType: CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      });
    } catch {
      // A real 404, not an abort: an aborted favicon would read as a failed request and a missing
      // asset as a network error, and a missing asset is exactly what this should say out loud.
      problems.push(`404: ${path}`);
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__hudFixture !== undefined);
  return { page, problems, close: () => context.close() };
}

const set = (
  page: Page,
  next: { remainingMs?: number; basket?: HudBasketItem[]; labels?: Record<string, string> },
): Promise<void> => page.evaluate((n) => window.__hudFixture!.set(n as never), next);

const settled = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => document.getAnimations().length === 0);

test.describe('the clock', () => {
  test('reads m:ss, and never goes negative', async ({ browser }) => {
    const { page, problems, close } = await open(browser, {
      width: 1280,
      height: 800,
      touch: false,
    });
    const face = page.locator('.otp-hud2__clock');
    const cases: [number, string][] = [
      [180_000, '3:00'],
      [125_000, '2:05'],
      [61_000, '1:01'],
      [9_000, '0:09'],
      [1, '0:01'],
      [0, '0:00'],
      [-4_000, '0:00'],
      [Number.NaN, '0:00'],
    ];
    for (const [ms, shown] of cases) {
      await set(page, { remainingMs: ms });
      await expect(face, `remainingMs ${ms}`).toHaveText(shown);
    }
    expect(problems).toEqual([]);
    await close();
  });

  test('is a timer that is not live, with a name', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    const timer = page.getByRole('timer');
    await expect(timer).toHaveCount(1);
    await expect(timer).toHaveAttribute('aria-live', 'off');
    await expect(timer).toHaveAccessibleName('Time left');
    await close();
  });

  test('uses tabular figures and the face holds still through every second of the run', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    const variant = await page
      .locator('.otp-hud2__clock')
      .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
    expect(variant).toContain('tabular-nums');

    // Widths of the pill at every face, split at 0:30 where the weight changes on purpose. Within
    // a weight the edge must not move: a proportional digit would shift it by a pixel or more
    // every second for three minutes.
    const widths = await page.evaluate(() => {
      const timer = document.querySelector('.otp-hud2__timer')!;
      const normal: number[] = [];
      const bold: number[] = [];
      for (let ms = 180_000; ms >= 0; ms -= 1_000) {
        window.__hudFixture!.set({ remainingMs: ms });
        (ms > 29_000 ? normal : bold).push(timer.getBoundingClientRect().width);
      }
      return { normal, bold };
    });
    expect(widths.normal.length).toBeGreaterThan(100);
    expect(widths.bold.length).toBeGreaterThan(20);
    expect(Math.max(...widths.normal) - Math.min(...widths.normal), 'normal weight').toBeLessThan(
      0.5,
    );
    expect(Math.max(...widths.bold) - Math.min(...widths.bold), 'bold weight').toBeLessThan(0.5);
    await close();
  });

  test('changes shape and weight under 0:30, and its colour not at all', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    const read = () =>
      page.evaluate(() => {
        const timer = document.querySelector('.otp-hud2__timer')!;
        const clock = document.querySelector('.otp-hud2__clock')!;
        const t = getComputedStyle(timer);
        const c = getComputedStyle(clock);
        return {
          face: clock.textContent,
          weight: c.fontWeight,
          ring: t.boxShadow,
          color: c.color,
          ground: t.backgroundColor,
          urgent: timer.getAttribute('data-urgent'),
        };
      });

    await set(page, { remainingMs: 30_000 });
    const calm = await read();
    await set(page, { remainingMs: 29_000 });
    const urgent = await read();

    expect(calm.face).toBe('0:30');
    expect(urgent.face).toBe('0:29');
    expect(calm.urgent).toBe('false');
    expect(urgent.urgent).toBe('true');
    expect(Number(urgent.weight)).toBeGreaterThan(Number(calm.weight));
    expect(calm.ring).toBe('none');
    expect(urgent.ring).not.toBe('none');
    // The point of the rule: nothing that changed is a colour.
    expect(urgent.color).toBe(calm.color);
    expect(urgent.ground).toBe(calm.ground);
    await close();
  });
});

test.describe('what a screen reader hears', () => {
  test('the region mutates four times in a whole run, at 2:00, 1:00, 0:30 and 0:00', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    const region = page.locator('[data-hud-announce]');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveAttribute('aria-atomic', 'true');

    const heard = await page.evaluate(() => {
      const node = document.querySelector('[data-hud-announce]')!;
      (node as unknown as Record<string, string>)['__otpTag'] = 'same-node';
      const seen: { face: string; said: string }[] = [];
      const observer = new MutationObserver(() => undefined);
      observer.observe(node, { subtree: true, childList: true, characterData: true });
      let last = node.textContent;
      for (let ms = 180_000; ms >= 0; ms -= 1_000) {
        window.__hudFixture!.set({ remainingMs: ms });
        const said = node.textContent ?? '';
        if (said !== last)
          seen.push({ face: document.querySelector('.otp-hud2__clock')!.textContent!, said });
        last = said;
      }
      const records = observer.takeRecords().length;
      observer.disconnect();
      return {
        seen,
        records,
        sameNode:
          (document.querySelector('[data-hud-announce]') as unknown as Record<string, string>)[
            '__otpTag'
          ] === 'same-node',
      };
    });

    expect(heard.seen).toEqual([
      { face: '2:00', said: '2 minutes left' },
      { face: '1:00', said: '1 minute left' },
      { face: '0:30', said: '30 seconds left' },
      { face: '0:00', said: 'Time is up' },
    ]);
    // The region was MUTATED, not replaced: a region that arrives carrying its text is announced
    // by no screen reader. Four edits, one node, nothing else touched it in 181 renders.
    expect(heard.sameNode).toBe(true);
    expect(heard.records).toBe(4);
    await close();
  });

  test('is empty at the start of a run', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { remainingMs: 180_000 });
    await expect(page.locator('[data-hud-announce]')).toHaveText('');
    await close();
  });

  test('names each collected skill and skips the empty wells', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { basket: FULL_BASKET.slice(0, 4) });
    const tree = await page.locator('.otp-hud2__basket').ariaSnapshot();
    expect(tree).toContain('group "Basket"');
    for (const name of ['Cottage Finder', 'Bridge Key', 'Night Light', 'Slow Post'])
      expect(tree).toContain(name);
    expect(tree).not.toContain('limited');
    // Four carried, so four list items: the three empty wells are furniture.
    expect(tree.match(/listitem/g)).toHaveLength(4);
    await close();
  });

  test("takes the content's words when they are handed in", async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, {
      basket: [FULL_BASKET[2]!],
      labels: { time: 'Clock', basket: 'Satchel', twoMinutes: 'Two to go' },
      remainingMs: 120_000,
    });
    await expect(page.getByRole('timer')).toHaveAccessibleName('Clock');
    await expect(page.getByRole('group', { name: 'Satchel' })).toBeVisible();
    await expect(page.locator('.otp-hud2__basket')).toContainText('Night Light');
    await expect(page.locator('[data-hud-announce]')).toHaveText('Two to go');
    await close();
  });
});

test.describe('the basket', () => {
  test('draws seven wells, empty ones dashed, in order of taking', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await expect(page.locator('.otp-hud2 .otp-hud-slot')).toHaveCount(7);
    await expect(page.locator('.otp-hud-slot--empty')).toHaveCount(7);
    const dashed = await page
      .locator('.otp-hud-slot--empty')
      .first()
      .evaluate((el) => getComputedStyle(el).borderStyle);
    expect(dashed).toBe('dashed');

    await set(page, { basket: FULL_BASKET.slice(0, 3) });
    await expect(page.locator('.otp-hud-slot--empty')).toHaveCount(4);
    const order = await page
      .locator('.otp-hud2__slot[data-skill]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-skill')));
    expect(order).toEqual(['cottage-finder', 'bridge-key', 'night-light']);
    await close();
  });

  test('shows a real icon crisp at a whole-number reduction, and a labelled placeholder otherwise', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { basket: FULL_BASKET });
    await settled(page);

    const icons = await page.locator('.otp-hud2__slot img').evaluateAll((els) =>
      els.map((el) => {
        const img = el as HTMLImageElement;
        const box = img.getBoundingClientRect();
        return {
          loaded: img.complete && img.naturalWidth > 0,
          natural: img.naturalWidth,
          shown: box.width,
          shownH: box.height,
          rendering: getComputedStyle(img).imageRendering,
        };
      }),
    );
    // All seven have art.
    expect(icons).toHaveLength(7);
    for (const icon of icons) {
      expect(icon.loaded, 'the icon did not load').toBe(true);
      expect(icon.rendering).toBe('pixelated');
      expect(icon.shown).toBe(icon.shownH);
      // 64 source pixels drawn at 16 CSS pixels: every source pixel is a whole 1/4 of the drawn
      // one, so no row or column is resampled. A 1.5x or 0.6x would pass `loaded` and be soft.
      expect(icon.natural / icon.shown, `${icon.natural} drawn at ${icon.shown}`).toBe(
        Math.round(icon.natural / icon.shown),
      );
    }

    expect(
      await page.locator('.otp-hud2__placeholder').count(),
      'a real icon wore a placeholder',
    ).toBe(0);

    // And a skill whose art is not in the bundle, or that names none, wears the labelled placeholder.
    await set(page, { basket: [FULL_BASKET[0]!, ...UNPAINTED] });
    await settled(page);
    const placeholders = await page.locator('.otp-hud2__placeholder').evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent,
        w: el.getBoundingClientRect().width,
        h: el.getBoundingClientRect().height,
        size: parseFloat(getComputedStyle(el).fontSize),
        name: el.closest('li')!.textContent,
      })),
    );
    expect(placeholders.map((p) => p.text)).toEqual(['FU', 'FI']);
    for (const p of placeholders) {
      expect(p.w).toBeGreaterThan(10);
      expect(p.h).toBeGreaterThan(10);
      expect(p.size, 'placeholder text under the 11px caption floor').toBeGreaterThanOrEqual(11);
    }
    // The name is on the well, in words, whatever the art is.
    expect(placeholders.map((p) => p.name)).toEqual([
      expect.stringContaining('Fixture Unpainted'),
      expect.stringContaining('Fixture Iconless'),
    ]);
    await close();
  });

  test('plays nothing under prefers-reduced-motion', async ({ browser }) => {
    const { page, close } = await open(browser, {
      width: 1280,
      height: 800,
      touch: false,
      reducedMotion: true,
    });
    await set(page, { basket: FULL_BASKET });
    const running = await page.evaluate(() => document.getAnimations().length);
    expect(running).toBe(0);
    await close();
  });

  test('lets a click through to the world', async ({ browser }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { basket: FULL_BASKET });
    const events = await page.evaluate(() =>
      ['.otp-hud2', '.otp-hud2__timer', '.otp-hud2__basket'].map(
        (s) => getComputedStyle(document.querySelector(s)!).pointerEvents,
      ),
    );
    expect(events).toEqual(['none', 'none', 'none']);
    await close();
  });
});

test.describe('the brand', () => {
  test('draws only colours from the brand set, and none of them Lime, red or green', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    for (const ms of [180_000, 29_000]) {
      await set(page, { remainingMs: ms, basket: FULL_BASKET });
      await settled(page);
      const verdict = await page.evaluate(() => {
        // The allowed set is read from the page's own tokens, so no hex is written here.
        const probe = (token: string): string => {
          const el = document.createElement('i');
          el.style.color = `var(--cyera-${token})`;
          document.body.append(el);
          const value = getComputedStyle(el).color;
          el.remove();
          return value;
        };
        const channels = (css: string): [number, number, number, number] => {
          const n = css.match(/-?\d*\.?\d+(?:e-?\d+)?/g)!.map(Number);
          if (css.startsWith('color(')) return [n[0]! * 255, n[1]! * 255, n[2]! * 255, n[3] ?? 1];
          return [n[0]!, n[1]!, n[2]!, n[3] ?? 1];
        };
        const key = (css: string): string => channels(css).slice(0, 3).map(Math.round).join(',');
        const allowed = new Set(
          ['black', 'deep-purple', 'lilac', 'haze', 'natural', 'shell', 'offwhite'].map((t) =>
            key(probe(t)),
          ),
        );
        const lime = key(probe('lime'));
        const used: { prop: string; css: string; el: string }[] = [];
        for (const el of document.querySelectorAll('.otp-hud2, .otp-hud2 *')) {
          const s = getComputedStyle(el);
          const draws: [string, string, boolean][] = [
            ['color', s.color, (el.textContent ?? '').trim() !== '' || el.tagName === 'IMG'],
            ['background-color', s.backgroundColor, true],
            ['outline-color', s.outlineColor, s.outlineStyle !== 'none'],
            [
              'border-top-color',
              s.borderTopColor,
              s.borderTopStyle !== 'none' && s.borderTopWidth !== '0px',
            ],
          ];
          for (const [prop, css, drawn] of draws) {
            if (!drawn) continue;
            const [, , , alpha] = channels(css);
            if (alpha === 0) continue;
            used.push({ prop, css, el: `${el.tagName.toLowerCase()}.${el.className}` });
          }
        }
        const stray = used.filter((u) => !allowed.has(key(u.css)));
        return {
          measured: used.length,
          stray,
          lime: used.filter((u) => key(u.css) === lime),
        };
      });
      // It looked at something, or "no stray colours" is what an empty page reports too.
      expect(verdict.measured, `remainingMs ${ms}`).toBeGreaterThan(10);
      expect(verdict.lime, 'the HUD spent Lime, which belongs to the one call to action').toEqual(
        [],
      );
      expect(verdict.stray, 'a colour outside the brand set').toEqual([]);
    }
    await close();
  });

  test('uses no font but the brand sans, never italic, and no shadow but the ring', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { remainingMs: 29_000, basket: FULL_BASKET });
    await settled(page);
    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('.otp-hud2 *')].map((el) => {
        const s = getComputedStyle(el);
        return {
          family: s.fontFamily,
          style: s.fontStyle,
          shadow: s.boxShadow,
          radius: s.borderTopLeftRadius,
          text: s.textShadow,
        };
      }),
    );
    expect(seen.length).toBeGreaterThan(10);
    for (const s of seen) {
      expect(s.family).not.toMatch(/season/i);
      expect(s.style).toBe('normal');
      expect(s.text).toBe('none');
    }
    // Only the clock's urgent ring is a box-shadow, and it is the inset Haze token.
    const shadows = seen.filter((s) => s.shadow !== 'none');
    expect(shadows).toHaveLength(1);
    expect(shadows[0]!.shadow).toContain('inset');
    await close();
  });

  test('reads with real contrast: the face on its pill, and the placeholder initials', async ({
    browser,
  }) => {
    const { page, close } = await open(browser, { width: 1280, height: 800, touch: false });
    await set(page, { basket: [FULL_BASKET[0]!, ...UNPAINTED], remainingMs: 100_000 });
    await settled(page);
    const ratios = await page.evaluate(() => {
      const parse = (css: string): [number, number, number, number] => {
        const n = css.match(/-?\d*\.?\d+(?:e-?\d+)?/g)!.map(Number);
        const k = css.startsWith('color(') ? 255 : 1;
        return [n[0]! * k, n[1]! * k, n[2]! * k, n[3] ?? 1];
      };
      const lum = ([r, g, b]: number[]): number => {
        const f = (c: number): number => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
      };
      const ratio = (a: number[], b: number[]): number => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi! + 0.05) / (lo! + 0.05);
      };
      // The worst backdrop the pill can sit on: the page's own lightest ground, Shell.
      const shell = parse(getComputedStyle(document.body).backgroundColor);
      const over = (top: number[], under: number[]): number[] =>
        [0, 1, 2].map((i) => top[i]! * top[3]! + under[i]! * (1 - top[3]!));
      const pill = parse(
        getComputedStyle(document.querySelector('.otp-hud2__timer')!).backgroundColor,
      );
      const ground = over(pill, shell);
      const face = parse(getComputedStyle(document.querySelector('.otp-hud2__clock')!).color);
      const ph = document.querySelector('.otp-hud2__placeholder')!;
      const phGround = parse(getComputedStyle(ph).backgroundColor);
      const phText = parse(getComputedStyle(ph).color);
      const caption = parse(getComputedStyle(document.querySelector('.otp-hud2__label')!).color);
      return {
        face: ratio(face, ground),
        caption: ratio(caption, ground),
        placeholder: ratio(phText, phGround),
      };
    });
    expect(ratios.face).toBeGreaterThanOrEqual(7);
    expect(ratios.caption).toBeGreaterThanOrEqual(4.5);
    expect(ratios.placeholder).toBeGreaterThanOrEqual(7);
    await close();
  });
});

/**
 * The sizes the game is played at, the real pad on each, and where the pills stand there.
 *
 * 375, 768 and 1280 are the three the Definition of Done names; the rest are where the HUD has
 * actually been wrong before -- the narrowest phone the stage supports, and the two landscape
 * phones where the stick and the A button used to stand INSIDE the world and the pills had to lift
 * over them. The arcade cabinet draws the deck on every device and puts it outside the screen in
 * landscape (ui/cabinet.ts), so each case first asserts the pad is on screen: an overlap test run
 * against a pad that is `display: none` proves nothing.
 *
 * `dock` is where the clock and the basket must be (the UX review, 2026-10-22: "on portrait phones
 * the timer and basket sit over the world"). `strip`: under the world, in the cabinet's own ground
 * between the frame's foot and the deck's top edge, and touching no pixel of the canvas. `world`:
 * in the world's bottom corners, as before -- a landscape window, or a portrait one whose strip is
 * too short for a pill (320x568, 18px). Named per size rather than read off the page, so a page
 * that quietly stopped docking them cannot pass by being measured as whatever it now does.
 */
const SIZES: (Viewport & { name: string; dock: 'strip' | 'world' })[] = [
  { name: '375x812 phone', width: 375, height: 812, touch: true, dock: 'strip' },
  { name: '320x568 small phone', width: 320, height: 568, touch: true, dock: 'world' },
  { name: '768x1024 tablet, touch', width: 768, height: 1024, touch: true, dock: 'strip' },
  { name: '768x1024, mouse', width: 768, height: 1024, touch: false, dock: 'strip' },
  { name: '1280x800 desktop', width: 1280, height: 800, touch: false, dock: 'world' },
  { name: '844x390 landscape phone', width: 844, height: 390, touch: true, dock: 'world' },
  { name: '568x320 small landscape phone', width: 568, height: 320, touch: true, dock: 'world' },
  {
    name: '1024x768 landscape tablet, touch',
    width: 1024,
    height: 768,
    touch: true,
    dock: 'world',
  },
];

test.describe('the layout', () => {
  for (const size of SIZES) {
    test(`${size.name}: both pills stand clear of each other, of the pad and of the edge`, async ({
      browser,
    }) => {
      const { page, problems, close } = await open(browser, size);
      // The widest the clock gets and the fullest the basket gets,.
      for (const ms of [180_000, 29_000]) {
        await set(page, { remainingMs: ms, basket: FULL_BASKET });
        await settled(page);

        const m = await page.evaluate(() => {
          type Box = { l: number; t: number; r: number; b: number };
          const box = (el: Element): Box => {
            const b = el.getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, b: b.bottom };
          };
          const drawn = (el: Element): boolean =>
            getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
          const pad = ['.otp-stick', '.otp-a-button']
            .flatMap((s) => [...document.querySelectorAll(s)])
            .filter(drawn)
            .map((el) => ({ name: el.className, ...box(el) }));
          return {
            coarse: matchMedia('(pointer: coarse)').matches,
            dock: document.documentElement.dataset['hud'] ?? null,
            timer: box(document.querySelector('.otp-hud2__timer')!),
            basket: box(document.querySelector('.otp-hud2__basket')!),
            anchor: box(document.querySelector('.otp-world-anchor')!),
            canvas: box(document.querySelector('#game canvas')!),
            frame: box(document.querySelector('.otp-world-frame')!),
            deck: box(document.querySelector('.otp-touch')!),
            pad,
            vw: innerWidth,
            vh: innerHeight,
            scrollW: document.documentElement.scrollWidth,
            scrollH: document.documentElement.scrollHeight,
          };
        });

        // The setup is what it says it is.
        expect(m.coarse, 'the context is not the device this case names').toBe(size.touch);
        // The cabinet's deck is drawn for a mouse as well as a thumb (the client, 2026-10-22), so
        // every case measures the pills against a pad that is really on screen.
        expect(m.pad.map((p) => p.name).sort(), `no pad drawn at ${size.name}`).toEqual([
          'otp-a-button',
          'otp-stick',
        ]);

        type B = { l: number; t: number; r: number; b: number };
        const area = (a: B, c: B): number =>
          Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) *
          Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
        const label = `${size.name} at ${formatClock(ms)}`;

        expect(area(m.timer, m.basket), `${label}: the clock and the basket overlap`).toBe(0);
        // A gap, not just no overlap: two pills touching read as one.
        expect(
          m.basket.l - m.timer.r,
          `${label}: the clock and the basket are touching`,
        ).toBeGreaterThanOrEqual(4);
        for (const p of m.pad) {
          expect(area(m.timer, p), `${label}: the clock is under ${p.name}`).toBe(0);
          expect(area(m.basket, p), `${label}: the basket is under ${p.name}`).toBe(0);
        }
        expect(m.dock, `${label}: the pills are docked in the wrong place`).toBe(size.dock);
        for (const [name, b] of [
          ['clock', m.timer],
          ['basket', m.basket],
        ] as const) {
          expect(b.l, `${label}: ${name} off the left edge`).toBeGreaterThanOrEqual(0);
          expect(b.r, `${label}: ${name} off the right edge`).toBeLessThanOrEqual(m.vw + 0.01);
          expect(b.r, `${label}: ${name} outside the world's width`).toBeLessThanOrEqual(
            m.anchor.r + 0.01,
          );
          if (size.dock === 'strip') {
            // Off the world altogether, and in the cabinet's own ground under it.
            expect(area(b, m.canvas), `${label}: ${name} still stands on the world`).toBe(0);
            expect(b.t, `${label}: ${name} over the frame's foot`).toBeGreaterThanOrEqual(
              m.frame.b - 0.01,
            );
            expect(b.b, `${label}: ${name} over the deck`).toBeLessThanOrEqual(m.deck.t + 0.01);
            // Air both ways, so it reads as standing in the strip rather than wedged into it.
            expect(b.t - m.frame.b, `${label}: ${name} touches the frame`).toBeGreaterThanOrEqual(
              4,
            );
            expect(m.deck.t - b.b, `${label}: ${name} touches the deck`).toBeGreaterThanOrEqual(4);
          } else {
            expect(b.t, `${label}: ${name} above the world`).toBeGreaterThanOrEqual(
              m.anchor.t - 0.01,
            );
            expect(b.b, `${label}: ${name} below the world`).toBeLessThanOrEqual(m.anchor.b + 0.01);
          }
        }
        if (size.dock === 'strip') {
          // The two pills still share a baseline, as they did in the world's corners.
          expect(
            Math.abs(m.timer.b - m.basket.b),
            `${label}: the pills are not level`,
          ).toBeLessThan(1);
        }
        expect(m.scrollW, `${label}: the page scrolls sideways`).toBeLessThanOrEqual(m.vw);
        expect(m.scrollH, `${label}: the page scrolls down`).toBeLessThanOrEqual(m.vh);
      }
      expect(problems).toEqual([]);
      await close();
    });
  }
});

function formatClock(ms: number): string {
  return `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
}
