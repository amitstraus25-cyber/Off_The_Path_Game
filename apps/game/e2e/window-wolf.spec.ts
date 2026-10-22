import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { startGame, toTheReveal } from './helpers';

/** The tileset's own name-to-gid map, as generated: the mailbox's gid is read here, not written. */
const GIDS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/assets/tileset-forest.gids.json', import.meta.url)),
    'utf8',
  ),
) as Record<string, number>;

/*
 * THE WOLF IN GRANDMA'S LIT WINDOW, AND THE MAILBOX WITH ITS FLAG UP (UI_FOUNDATIONS section 8,
 * "04 Arrive"; the client, 2026-10-23).
 *
 * The rule the picture obeys is tested without a browser in test/window-wolf.test.ts. This is the
 * picture: the scene's own overlay, read off the running game. The silhouette is shown on the wolf's
 * ending and only at the door; it is absent through the whole walk (so it cannot give the ending
 * away), on Grandma's ending and on the late one; it fades up, and under reduced motion it is simply
 * there; a replay takes it down. And on every ending that reaches the door the window and the
 * mailbox are in the camera's view and clear of the header above and the Arrive panel below.
 *
 * Every position is read from the scene and the map -- the overlay's own rectangle, the
 * `prop-mailbox` object, the camera's view -- never a coordinate written here (PAUL_BRIEF trap 5).
 * Each measurement asserts its subject exists first, so none can pass on nothing (trap 6).
 *
 * SHOT_DIR=/tmp/shots also writes a screenshot of every arrival, which is how a human looks at it.
 */

const SHOTS = process.env['SHOT_DIR'];

/** What the scene says about the shape in the window: see `windowWolfShown` in forest-scene.ts. */
interface WindowProbe {
  alpha: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const windowWolf = (page: Page): Promise<WindowProbe> =>
  page.evaluate(
    () => (window.__otp!.scene as unknown as { windowWolfShown: WindowProbe }).windowWolfShown,
  );

/** Every offer answered through the store, then the door. `wolf` lets him in with one bad skill. */
async function arrive(page: Page, ending: 'wolf' | 'grandma'): Promise<void> {
  await page.evaluate((wolf) => {
    const { store, content } = window.__otp!;
    const good = store.getState().good;
    let taken = false;
    for (const c of content.characters) {
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'INSPECT', s: c.skillId });
      // Never the Wing Ride: its flight carries Purple off the doorstep (design-round.spec.ts).
      const take = wolf && !taken && c.skillId !== 'short-cut' && !good.includes(c.skillId);
      if (take) taken = true;
      store.dispatch({ type: 'VERDICT', s: c.skillId, v: take ? 'take' : 'leave' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, ending === 'wolf');
  await expect(page.locator(`[data-arrive="${ending}"]`)).toBeVisible();
}

/**
 * A world rectangle against what is actually on screen: inside the camera's view, inside the
 * canvas, below the header and above the Arrive panel. In CSS pixels, with the misses spelled out.
 */
async function onScreen(
  page: Page,
  rect: { x: number; y: number; width: number; height: number },
): Promise<string[]> {
  return page.evaluate((r) => {
    const scene = window.__otp!.scene as unknown as {
      cameras: {
        main: {
          x: number;
          y: number;
          scrollX: number;
          scrollY: number;
          worldView: { x: number; y: number; width: number; height: number };
        };
      };
    };
    const cam = scene.cameras.main;
    const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
    const c = canvas.getBoundingClientRect();
    const zoom = c.width / canvas.width;
    const box = {
      left: c.left + (cam.x + r.x - cam.scrollX) * zoom,
      top: c.top + (cam.y + r.y - cam.scrollY) * zoom,
      right: c.left + (cam.x + r.x + r.width - cam.scrollX) * zoom,
      bottom: c.top + (cam.y + r.y + r.height - cam.scrollY) * zoom,
    };
    const v = cam.worldView;
    const misses: string[] = [];
    if (r.x < v.x || r.y < v.y || r.x + r.width > v.x + v.width || r.y + r.height > v.y + v.height)
      misses.push(`outside the camera's view (${JSON.stringify(r)} against ${JSON.stringify(v)})`);
    if (box.left < Math.max(0, c.left) - 0.5 || box.right > Math.min(innerWidth, c.right) + 0.5)
      misses.push(`off the canvas or the window sideways (${box.left}..${box.right})`);
    if (box.top < Math.max(0, c.top) - 0.5 || box.bottom > Math.min(innerHeight, c.bottom) + 0.5)
      misses.push(`off the canvas or the window vertically (${box.top}..${box.bottom})`);
    const header = document.querySelector('.otp-world-frame__header')?.getBoundingClientRect();
    if (header && box.top < header.bottom - 0.5 && box.bottom > header.top)
      misses.push(`under the header (top ${box.top} against its bottom ${header.bottom})`);
    const panel = document.querySelector('.otp-arrive')?.getBoundingClientRect();
    if (panel && box.bottom > panel.top + 0.5 && box.top < panel.bottom && box.right > panel.left)
      misses.push(`under the Arrive panel (bottom ${box.bottom} against its top ${panel.top})`);
    return misses;
  }, rect);
}

/** The mailbox's map object, and the tile the scene drew at it. */
async function mailbox(page: Page) {
  return page.evaluate(() => {
    const o = window.__otp!.mapObjects!.find((m) => m.name === 'prop-mailbox');
    const scene = window.__otp!.scene as unknown as {
      decorBelow: { getTileAt(x: number, y: number): { index: number } | null } | null;
    };
    const tile = o ? scene.decorBelow?.getTileAt(o.x / 32, o.y / 32) : null;
    return {
      object: o ?? null,
      index: tile?.index ?? null,
      solid: o
        ? (window.__otp!.isSolidAt as (x: number, y: number) => boolean)(o.x + 16, o.y + 16)
        : null,
    };
  });
}

async function pageAt(browser: Browser, width: number, height: number, reduce = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  return context.newPage();
}

/** Long enough for the fade (900ms in forest-scene.ts) and the panel's re-cut to be over. */
const SETTLED_MS = 1500;

test('the window is empty for the whole walk, even with a bad skill already in the basket', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  // Behind the title, before anything has happened.
  expect((await windowWolf(page)).width, 'the scene built no window overlay').toBe(32);
  expect((await windowWolf(page)).alpha, 'the wolf is in the window behind the title').toBe(0);
  await startGame(page);
  expect((await windowWolf(page)).alpha, 'the wolf is in the window as the walk begins').toBe(0);
  // Every bad skill taken, every good one left, and still in the forest: the ending is the door's.
  await page.evaluate(() => {
    const { store, content } = window.__otp!;
    const good = store.getState().good;
    for (const c of content.characters) {
      if (c.skillId === 'short-cut') continue;
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'INSPECT', s: c.skillId });
      store.dispatch({
        type: 'VERDICT',
        s: c.skillId,
        v: good.includes(c.skillId) ? 'leave' : 'take',
      });
    }
  });
  expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
  await page.waitForTimeout(SETTLED_MS);
  expect((await windowWolf(page)).alpha, 'the wolf showed in the window during the walk').toBe(0);
});

for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
  [844, 390],
] as const) {
  test(`at ${width}x${height} the wolf's ending puts him in the lit window, in full view`, async ({
    browser,
  }) => {
    test.slow();
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    await arrive(page, 'wolf');
    // He fades up rather than snapping in, then holds.
    await expect.poll(async () => (await windowWolf(page)).alpha, { timeout: 4000 }).toBe(1);
    await page.waitForTimeout(300);
    const shape = await windowWolf(page);
    expect(shape.width).toBe(32);
    expect(await onScreen(page, shape), `the lit window at ${width}x${height}`).toEqual([]);
    const box = await mailbox(page);
    expect(box.object, 'the map has no prop-mailbox').not.toBeNull();
    expect(await onScreen(page, box.object!), `the mailbox at ${width}x${height}`).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrive-wolf-${width}x${height}.png` });
    await page.context().close();
  });

  test(`at ${width}x${height} Grandma's ending leaves the lit window empty, mailbox in view`, async ({
    browser,
  }) => {
    test.slow();
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    await arrive(page, 'grandma');
    await page.waitForTimeout(SETTLED_MS);
    const shape = await windowWolf(page);
    expect(shape.alpha, `the wolf is in Grandma's window on her ending at ${width}x${height}`).toBe(
      0,
    );
    // The window itself is still composed into the shot: the overlay's cell IS the window's cell.
    expect(await onScreen(page, shape), `the lit window at ${width}x${height}`).toEqual([]);
    const box = await mailbox(page);
    expect(box.object).not.toBeNull();
    expect(await onScreen(page, box.object!), `the mailbox at ${width}x${height}`).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrive-grandma-${width}x${height}.png` });
    await page.context().close();
  });

  test(`at ${width}x${height} the late ending shows no wolf in any window`, async ({ browser }) => {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    // A bad skill in the basket, so it is the clock and not the basket that keeps him out.
    await page.evaluate(() => {
      const { store, content } = window.__otp!;
      const c = content.characters.find(
        (x) => x.skillId !== 'short-cut' && !store.getState().good.includes(x.skillId),
      )!;
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'take' });
      store.dispatch({ type: 'BACK' });
      store.dispatch({ type: 'BACK' });
      window.__otp!.testClock.advance(180_000);
    });
    await expect(page.locator('[data-arrive="late"]')).toBeVisible();
    await page.waitForTimeout(SETTLED_MS);
    expect((await windowWolf(page)).alpha, 'the wolf showed on the late ending').toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrive-late-${width}x${height}.png` });
    await page.context().close();
  });
}

test('under reduced motion he is in the window at once, with no fade', async ({ browser }) => {
  const page = await pageAt(browser, 1280, 800, true);
  await page.goto('/');
  await startGame(page);
  await arrive(page, 'wolf');
  // The first frame after the arrival is staged: a fade would still be near 0 here.
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  expect((await windowWolf(page)).alpha).toBe(1);
  await page.context().close();
});

test('a replay takes him out of the window', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await startGame(page);
  await arrive(page, 'wolf');
  await expect.poll(async () => (await windowWolf(page)).alpha, { timeout: 4000 }).toBe(1);
  await toTheReveal(page);
  await page.locator('.otp-replay [data-action="replay"]').click();
  await page.waitForFunction(() => {
    const phase = window.__otp?.store.getState().phase;
    return phase === 'forest' || phase === 'title' || phase === 'howto';
  });
  expect((await windowWolf(page)).alpha, 'the last run left the wolf in the window').toBe(0);
});

test('the mailbox stands by the door lane: drawn, solid, and the same on every ending', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  const box = await mailbox(page);
  expect(box.object, 'the map has no prop-mailbox').not.toBeNull();
  // The tile the tileset calls `mailbox` is drawn there, and the post stops her.
  expect(GIDS['mailbox'], 'the tileset has no mailbox').toBeGreaterThan(0);
  expect(box.index, 'nothing, or something else, is drawn at the mailbox').toBe(GIDS['mailbox']);
  expect(box.solid, 'Purple can walk through the mailbox post').toBe(true);
});
