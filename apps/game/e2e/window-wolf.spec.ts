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

/**
 * Every offer answered through the store, ready for the door: `wolf` lets him in with one bad skill,
 * and `weaver` takes the Word Weaver or leaves it, so the Arrive panel's welcome beat is chosen
 * here rather than by the deal.
 *
 * WHY `weaver` IS A PARAMETER (CI run 39859836223). This used to take "the first bad skill in
 * walking order", and on the 4 deals of 35 where that is the Word Weaver's, the welcome makes the
 * panel a line taller -- which at 844x390 pushed the lit window out of the top of the frame. The
 * spec met that one run in nine, both attempts of one CI run drew it, and it never failed here.
 * A frame that depends on the panel has to be judged at the panel's tallest, every time.
 *
 * Grandma's ending with the welcome needs the Word Weaver's good copy, so when the deal made it bad
 * the run is re-dealt from the first seed that makes it good -- the same RESET, START, BEGIN main.ts
 * plays at the start of every run.
 */
async function answer(page: Page, ending: 'wolf' | 'grandma', weaver: boolean): Promise<void> {
  await page.evaluate(
    ([wolf, w]) => {
      const { store, content } = window.__otp!;
      /*
       * Over the river by the Bridge Key (rules 3: the door refuses a run that never crossed), never
       * by the Wing Ride, whose flight carries Purple off the doorstep (design-round.spec.ts). So
       * Grandma's ending needs the Bridge Key's good copy too, and is re-dealt for it like the
       * Word Weaver's.
       */
      const wanted = (): boolean => {
        const good = store.getState().good;
        return wolf || (good.includes('bridge-key') && (!w || good.includes('word-weaver')));
      };
      if (!wanted()) {
        for (let seed = 0; !wanted(); seed++) store.dispatch({ type: 'RESET', seed });
        store.dispatch({ type: 'START', runId: crypto.randomUUID() });
        store.dispatch({ type: 'BEGIN' });
      }
      const good = store.getState().good;
      let taken = false;
      for (const c of content.characters) {
        store.dispatch({ type: 'MEET', c: c.id });
        store.dispatch({ type: 'INSPECT', s: c.skillId });
        let take = false;
        if (c.skillId === 'word-weaver') take = w;
        else if (c.skillId === 'bridge-key') {
          take = true;
          // The bad copy lets the wolf in by itself.
          if (!good.includes(c.skillId)) taken = true;
        } else if (wolf && !taken && c.skillId !== 'short-cut' && !good.includes(c.skillId))
          take = taken = true;
        store.dispatch({ type: 'VERDICT', s: c.skillId, v: take ? 'take' : 'leave' });
      }
    },
    [ending === 'wolf', weaver] as const,
  );
  const state = await page.evaluate(() => window.__otp!.store.getState());
  expect(state.phase, 'the answers did not leave the run in the forest').toBe('forest');
  const tookWeaver = state.basket.some((b) => b.s === 'word-weaver');
  expect(tookWeaver, `the Word Weaver was ${weaver ? 'not ' : ''}taken`).toBe(weaver);
}

/** Answered as `answer` says, then the door, without the walk. */
async function arrive(page: Page, ending: 'wolf' | 'grandma', weaver: boolean): Promise<void> {
  await answer(page, ending, weaver);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  await expect(page.locator(`[data-arrive="${ending}"]`)).toBeVisible();
  // The welcome is a beat of its own: three lines in the panel with it, two without.
  await expect(page.locator(`[data-arrive="${ending}"] .otp-arrive__line`)).toHaveCount(
    weaver ? 3 : 2,
  );
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
  for (const weaver of [false, true]) {
    const welcome = weaver ? ', with the welcome' : '';
    const tag = `${width}x${height}${weaver ? '-welcome' : ''}`;

    test(`at ${width}x${height} the wolf's ending puts him in the lit window, in full view${welcome}`, async ({
      browser,
    }) => {
      test.slow();
      const page = await pageAt(browser, width, height);
      await page.goto('/');
      await startGame(page);
      await arrive(page, 'wolf', weaver);
      // He fades up rather than snapping in, then holds.
      await expect.poll(async () => (await windowWolf(page)).alpha, { timeout: 4000 }).toBe(1);
      await page.waitForTimeout(300);
      const shape = await windowWolf(page);
      expect(shape.width).toBe(32);
      expect(await onScreen(page, shape), `the lit window at ${width}x${height}${welcome}`).toEqual(
        [],
      );
      const box = await mailbox(page);
      expect(box.object, 'the map has no prop-mailbox').not.toBeNull();
      expect(
        await onScreen(page, box.object!),
        `the mailbox at ${width}x${height}${welcome}`,
      ).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrive-wolf-${tag}.png` });
      await page.context().close();
    });

    test(`at ${width}x${height} Grandma's ending leaves the lit window empty, mailbox in view${welcome}`, async ({
      browser,
    }) => {
      test.slow();
      const page = await pageAt(browser, width, height);
      await page.goto('/');
      await startGame(page);
      await arrive(page, 'grandma', weaver);
      await page.waitForTimeout(SETTLED_MS);
      const shape = await windowWolf(page);
      expect(
        shape.alpha,
        `the wolf is in Grandma's window on her ending at ${width}x${height}`,
      ).toBe(0);
      // The window itself is still composed into the shot: the overlay's cell IS the window's cell.
      expect(await onScreen(page, shape), `the lit window at ${width}x${height}${welcome}`).toEqual(
        [],
      );
      const box = await mailbox(page);
      expect(box.object).not.toBeNull();
      expect(
        await onScreen(page, box.object!),
        `the mailbox at ${width}x${height}${welcome}`,
      ).toEqual([]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrive-grandma-${tag}.png` });
      await page.context().close();
    });
  }

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

/*
 * THE ARRIVAL FRAME IS A FUNCTION OF THE MAP, NOT OF WHERE PURPLE STOPPED (2026-10-23).
 *
 * The first reading of CI run 39859836223 was that a frame-capped step on a slow runner carried
 * her a few pixels further into the door trigger and the camera, following her, landed lower.
 * Measured, that was not the cause -- the spec never walks, and its numbers reproduce to the pixel
 * from the deal alone (see `answer`) -- but it is the right thing to guard, because a frame that
 * read her position would fail exactly that way on a slow phone in landscape.
 *
 * So she reaches the door four ways at the tightest viewport, with the tallest panel: dropped on
 * the step's top-left corner, dropped on the lane's far bottom corner, walked up the lane, and
 * walked up the lane with the CPU throttled six times (CDP `Emulation.setCPUThrottlingRate`), which
 * stretches every frame and with it every step. Where she was on the last frame before the arrival
 * is recorded, and must differ; the camera's scroll must not, and the window and the mailbox must
 * be in view on every one.
 */
test('at 844x390 the arrival frame is the same wherever Purple stopped, even starved of frames', async ({
  browser,
}) => {
  test.slow();
  const ways = [
    'dropped on the step',
    'dropped in the far corner',
    'walked up',
    'walked up at 6x CPU',
  ];
  const shots: {
    how: string;
    stop: { x: number; y: number } | null;
    scroll: { x: number; y: number };
    window: string[];
    mailbox: string[];
  }[] = [];
  for (const how of ways) {
    const page = await pageAt(browser, 844, 390);
    await page.goto('/');
    await startGame(page);
    // The Word Weaver taken: the tallest panel, and no knock -- she is let in the frame she arrives.
    await answer(page, 'wolf', true);
    if (how.includes('6x')) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    }
    // Where she stands on every frame until the arrival is staged; the last one is where she stopped.
    await page.evaluate(() => {
      const scene = window.__otp!.scene as unknown as {
        arrived: boolean;
        purplePosition: { x: number; y: number };
      };
      const w = window as unknown as { __stop: { x: number; y: number } | null };
      w.__stop = null;
      const watch = (): void => {
        if (scene.arrived) return;
        w.__stop = scene.purplePosition;
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
    const door = await page.evaluate(() =>
      window.__otp!.mapObjects!.find((m) => m.name === 'trigger-cottage')!,
    );
    const at = {
      'dropped on the step': { x: door.x + 1, y: door.y + 1 },
      'dropped in the far corner': { x: door.x + door.width - 1, y: door.y + door.height - 1 },
      'walked up': { x: door.x + door.width / 2, y: door.y + door.height + 24 },
      'walked up at 6x CPU': { x: door.x + door.width / 2, y: door.y + door.height + 24 },
    }[how]!;
    await page.evaluate((p) => {
      window.__otp!.scene!.position = p;
      window.__otp!.scene!.placePurple();
    }, at);
    if (how.startsWith('walked')) {
      // A frame on the lane below the trigger, then up it until the door lets her in.
      await page.waitForTimeout(100);
      await page.keyboard.down('ArrowUp');
      await expect(page.locator('[data-arrive="wolf"]')).toBeVisible({ timeout: 20_000 });
      await page.keyboard.up('ArrowUp');
    } else {
      await expect(page.locator('[data-arrive="wolf"]')).toBeVisible();
    }
    await page.waitForTimeout(SETTLED_MS);
    const stop = await page.evaluate(
      () => (window as unknown as { __stop: { x: number; y: number } | null }).__stop,
    );
    const scroll = await page.evaluate(() => {
      const cam = (
        window.__otp!.scene as unknown as {
          cameras: { main: { scrollX: number; scrollY: number } };
        }
      ).cameras.main;
      return { x: cam.scrollX, y: cam.scrollY };
    });
    const box = await mailbox(page);
    expect(box.object, 'the map has no prop-mailbox').not.toBeNull();
    shots.push({
      how,
      stop,
      scroll,
      window: await onScreen(page, await windowWolf(page)),
      mailbox: await onScreen(page, box.object!),
    });
    await page.context().close();
  }
  console.log(
    `arrival from four stopping points at 844x390\n  ${shots
      .map(
        (s) => `${s.how}: stopped at ${JSON.stringify(s.stop)}, scroll ${JSON.stringify(s.scroll)}`,
      )
      .join('\n  ')}`,
  );
  // The premise: she really did stop in different places. Two drops a whole lane apart, at least.
  const stops = shots.map((s) => s.stop);
  expect(stops.every(Boolean), 'a run never recorded where she stood').toBe(true);
  expect(
    Math.hypot(stops[0]!.x - stops[1]!.x, stops[0]!.y - stops[1]!.y),
    'the two drops did not stop her in different places',
  ).toBeGreaterThan(32);
  for (const s of shots) {
    expect(s.scroll, `the frame moved with where she stopped (${s.how})`).toEqual(shots[0]!.scroll);
    expect(s.window, `the lit window, ${s.how}`).toEqual([]);
    expect(s.mailbox, `the mailbox, ${s.how}`).toEqual([]);
  }
});

test('under reduced motion he is in the window at once, with no fade', async ({ browser }) => {
  const page = await pageAt(browser, 1280, 800, true);
  await page.goto('/');
  await startGame(page);
  await arrive(page, 'wolf', false);
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
  await arrive(page, 'wolf', false);
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
