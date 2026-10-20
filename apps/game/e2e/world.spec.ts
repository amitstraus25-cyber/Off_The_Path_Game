import { expect, test } from '@playwright/test';
import { REFERENCE_VIEWPORTS, TILE, cameraFor } from '@otp/core';
import type { Size } from '@otp/core';
import { hold, mapObject, probe, startGame, talkingDistance, walkTo } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('the run starts in explore with Red at the spawn', async ({ page }) => {
  const spawn = await mapObject(page, 'spawn-red');
  const start = await probe(page);
  expect(start.phase).toBe('explore');
  expect(Math.abs(start.position.x - spawn.x)).toBeLessThan(64);
});

test('Red walks east along the path and the camera follows', async ({ page }) => {
  const before = await probe(page);
  await hold(page, 'ArrowRight', 800);
  const after = await probe(page);
  expect(after.position.x).toBeGreaterThan(before.position.x + 40);
  expect(after.position.y).toBeCloseTo(before.position.y, 0);
});

test('WASD works as well as the arrows', async ({ page }) => {
  const before = await probe(page);
  await hold(page, 'KeyD', 500);
  expect((await probe(page)).position.x).toBeGreaterThan(before.position.x + 20);
});

test('the forest border holds Red inside the map', async ({ page }) => {
  await hold(page, 'ArrowUp', 6000);
  expect((await probe(page)).position.y).toBeGreaterThan(32);
});

test('Red never stands inside a solid tile, whatever route she takes', async ({ page }) => {
  const legs = [
    ['ArrowRight', 3000],
    ['ArrowUp', 1500],
    ['ArrowRight', 2500],
    ['ArrowDown', 2000],
    ['ArrowRight', 3000],
    ['ArrowUp', 2500],
    ['ArrowLeft', 2500],
    ['ArrowDown', 3000],
  ] as const;
  for (const [key, ms] of legs) {
    await hold(page, key, ms);
    const solid = await page.evaluate(() => {
      const otp = window.__otp!;
      const { x, y } = otp.scene!.redPosition;
      return otp.isSolidAt!(x, y);
    });
    expect(solid, `Red stood inside a solid tile after holding ${key}`).toBe(false);
  }
});

/*
 * One walk, three beats. "Input is ignored while a panel is open" used to be a separate test that
 * repeated this one line for line -- the same thirty-second walk to the same rabbit, the same
 * Space, the same phase check -- and then added the two lines now in the middle here. Both tests
 * depend on exactly the same state, so splitting them bought nothing and cost a second walk.
 */
test('the interact prompt leads to a dialogue, which swallows the walk keys, and Esc backs out', async ({
  page,
}) => {
  await walkTo(page, await talkingDistance(page, 'npc-rabbit'));

  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const talking = await probe(page);
  expect(talking.phase).toBe('dialogue');
  expect(talking.activeCharacter).toBe('rabbit');
  expect(talking.log.map((e) => e.t)).toContain('met');

  // The world stops listening while a panel owns the screen: Red must not walk out from under it.
  await hold(page, 'ArrowRight', 600);
  expect((await probe(page)).position.x).toBeCloseTo(talking.position.x, 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  expect((await probe(page)).phase).toBe('explore');
});

test('the cottage door stays shut until all three skills have a verdict', async ({ page }) => {
  // Walking the whole map takes a while, and the hint toast hides itself after a few seconds.
  test.slow();
  // trigger-cottage is the doorstep, not the garden gate: the walk ends at Grandma's door.
  const door = await mapObject(page, 'trigger-cottage');
  await walkTo(page, { x: door.x + 16, y: door.y + door.height / 2 }, 24, 40_000);

  const blocked = await probe(page);
  expect(blocked.phase).toBe('explore');
  // Nudge in and out of the trigger until the hint shows, rather than racing its timeout.
  await expect
    .poll(
      async () => {
        await hold(page, 'ArrowRight', 250);
        await hold(page, 'ArrowLeft', 250);
        return page.locator('.otp-toast').textContent();
      },
      { timeout: 15_000 },
    )
    .toMatch(/all three travellers first/i);

  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['rabbit', 'cottage-finder', 'restrict'],
      ['owl', 'word-weaver', 'reject'],
      ['lantern-keeper', 'night-light', 'allow'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
  });

  // Red is beside the trigger; nudge back and forth until she steps on it.
  await expect
    .poll(
      async () => {
        await hold(page, 'ArrowRight', 250);
        await hold(page, 'ArrowLeft', 250);
        return (await probe(page)).phase;
      },
      { timeout: 15_000 },
    )
    .toBe('cottage');
  expect((await probe(page)).log.map((e) => e.t)).toContain('arrived');
});

test('touch controls move Red and stop her on release', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await startGame(page);

  const stick = page.locator('.otp-stick');
  await expect(stick).toBeVisible();
  const box = (await stick.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const before = await probe(page);

  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 40, centre.y, { steps: 4 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForTimeout(120);

  const after = await probe(page);
  expect(after.position.x).toBeGreaterThan(before.position.x + 30);
  await page.waitForTimeout(400);
  expect((await probe(page)).position.x).toBeCloseTo(after.position.x, 0);
  await context.close();
});

/*
 * A RECTANGLE HAS TWO AXES, AND THIS TEST WAS LOOKING AT ONE OF THEM.
 *
 * It read `cssWidth` and nothing else, at a single 1024x768 viewport, and asked only that the
 * width was more than 70% of the window. So a canvas letterboxed to a third of its frame in the
 * BLOCK axis passed it untouched -- which is the same defect, in the other direction, as the one
 * the comment under it describes ("how a phone ended up rendering the world at a third of the
 * screen"), and the axis the client's "sliver at the top" report is about. It also measured one
 * viewport, while the arithmetic that produces the box changes with orientation: a portrait screen
 * gives the world PORTRAIT_WORLD of its height and no margin, which the desktop case never
 * exercises.
 *
 * Both axes now, at the four viewports the project reviews at plus the one this test already used,
 * and against `cameraFor()` rather than a fraction of the window -- @otp/core is where the camera
 * is derived, and the graybox tooling composes the art against the same function, so a canvas that
 * disagrees with it means the art is being framed for a rectangle the player does not have. If a
 * letterbox is ever wanted here, it belongs in `stageFit` so that both sides move together; one
 * applied in ui/stage.ts alone is exactly what this is written to fail on.
 */
const FIT_VIEWPORTS: Size[] = [
  // The viewport this test has always run at, kept so it still covers what it used to.
  { width: 1024, height: 768 },
  ...Object.values(REFERENCE_VIEWPORTS),
];

test('the canvas fills its frame in both axes, at whole CSS pixels per game pixel', async ({
  page,
}) => {
  for (const dpr of [1, 2, 3]) {
    const context = await page
      .context()
      .browser()!
      .newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: dpr });
    const p = await context.newPage();
    await p.goto('/');
    await startGame(p);

    for (const viewport of FIT_VIEWPORTS) {
      await p.setViewportSize(viewport);
      await p.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, viewport.width);
      // Two frames: one for ui/stage.ts's resize handler, one for the layout it causes.
      await p.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );

      const seen = await p.evaluate(() => {
        const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
        const r = canvas.getBoundingClientRect();
        return {
          // What the player gets, in CSS pixels.
          css: { width: r.width, height: r.height },
          // The backing store: the camera in GAME pixels, which follows the window.
          backing: { width: canvas.width, height: canvas.height },
          // The window as the page sees it, which is what the camera is derived from. Read here
          // rather than taken from `viewport`, so a scrollbar cannot make the two disagree.
          window: { width: window.innerWidth, height: window.innerHeight },
        };
      });
      const cam = cameraFor(seen.window);
      const where = `${viewport.width}x${viewport.height} dpr${dpr}`;
      console.log(`stage fit ${where}:`, JSON.stringify({ seen, cam }));

      for (const axis of ['width', 'height'] as const) {
        // The camera Phaser is drawing is the one @otp/core derives, in game pixels.
        expect(
          seen.backing[axis],
          `${where}: the canvas backing store is ${seen.backing[axis]} game px ${axis}, against a derived camera of ${cam.view[axis]}`,
        ).toBe(cam.view[axis]);

        // One game pixel is a whole number of CSS pixels -- measured per axis, so a stretch in
        // one of them cannot hide behind the other.
        const zoom = seen.css[axis] / seen.backing[axis];
        expect(
          Math.abs(zoom - Math.round(zoom)),
          `${where}: ${axis} zoom is ${zoom}, which is not a whole number of CSS pixels`,
        ).toBeLessThan(0.001);
        expect(zoom, `${where}: ${axis} zoom ${zoom} is not the derived ${cam.zoom}`).toBeCloseTo(
          cam.zoom,
          3,
        );

        /*
         * And the world fills the box the frame leaves it. The slack is stated in TILES rather
         * than as a share of the canvas -- a bound written against the thing it watches grows
         * with it, and a canvas half the size it should be would satisfy "within 30% of itself".
         * Less than one tile of unused frame: a camera that is a whole number of tiles high is
         * still inside this, a camera letterboxed by more than a tile is not.
         */
        const unused = cam.available[axis] - seen.css[axis];
        expect(
          unused,
          `${where}: ${unused}px of the frame's ${cam.available[axis]}px ${axis} is not world (${seen.css[axis]}px canvas)`,
        ).toBeLessThan(TILE * cam.zoom);
        expect(
          unused,
          `${where}: the canvas overflows its frame in ${axis}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
    await context.close();
  }
});

/*
 * ...AND IT LANDS ON ONE.
 *
 * The test above passed on the build a client photographed and called "laggy lines on the top". It
 * was right: the zoom was exactly 2. What nobody asserted is that the canvas STARTS on a whole
 * pixel, and at 1280x800 it did not -- the stage centres a 718px canvas plus 47px of frame margin
 * inside 800, so half of the 35px remainder put the canvas at y 64.5. `image-rendering: pixelated`
 * then samples every game-pixel row across a half-pixel boundary: the whole world is resampled and
 * the top edge shows it as a band of garbled rows.
 *
 * A rectangle has a position as well as a size, and this project has now been bitten three times
 * by guarding one and not the other -- a camera size quoted in a comment, a camera origin left
 * hand-rolled beside a derived size, and now a canvas scale guarded while its offset was not. So
 * this asserts the origin, at the viewports where the arithmetic actually differs: the parity of
 * the leftover space flips with the parity of the window, independently per axis, and an odd
 * height was the only thing hiding the defect at 1024x769.
 */
const ORIGIN_VIEWPORTS = [
  // The reference desktop: the viewport the band was reported and measured on.
  { width: 1280, height: 800 },
  // Odd in one axis, then the other, then both. Each one moves a different half pixel.
  { width: 1281, height: 800 },
  { width: 1280, height: 801 },
  { width: 1281, height: 801 },
  { width: 1025, height: 768 },
  // Zoom 1, where the canvas is the available box exactly and no rounding of the view can help.
  { width: 844, height: 390 },
  // Portrait, which aligns to the start of the stage rather than centring it in the block axis.
  { width: 375, height: 812 },
  // Portrait and odd in both axes: the worst inline-axis case the sweep found, 3.5px.
  { width: 769, height: 1025 },
] as const;

/** The fraction of a pixel a coordinate sits off the grid, which is the number that must be 0. */
const offGrid = (v: number): number => Math.abs(v - Math.round(v));

test('the canvas lands on whole device pixels, and says where it landed', async ({ page }) => {
  // One page per DPR, resized across the viewports: the scale factor is fixed per context.
  for (const dpr of [1, 2, 3]) {
    const context = await page
      .context()
      .browser()!
      .newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr });
    const p = await context.newPage();
    await p.goto('/');
    await startGame(p);

    for (const { width, height } of ORIGIN_VIEWPORTS) {
      await p.setViewportSize({ width, height });
      await p.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, width);
      // Two frames: one for stage.ts's resize handler, one for the layout it causes.
      await p.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );

      const seen = await p.evaluate(() => {
        const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
        const r = canvas.getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        const px = (name: string): number => parseFloat(root.getPropertyValue(name));
        return {
          rect: { x: r.left, y: r.top, w: r.width, h: r.height },
          published: {
            x: px('--otp-canvas-x'),
            y: px('--otp-canvas-y'),
            w: px('--otp-canvas-w'),
            h: px('--otp-canvas-h'),
          },
          zoom: r.width / canvas.width,
          dpr: window.devicePixelRatio,
        };
      });
      const where = `${width}x${height} dpr${dpr}`;

      // The size, which has always held: a whole number of CSS pixels per game pixel.
      expect(offGrid(seen.zoom), `${where}: zoom ${seen.zoom} is not a whole number`).toBeLessThan(
        0.001,
      );
      // And the position, which had not. In CSS pixels first, because a whole CSS pixel is a whole
      // device pixel at every whole DPR and is the stricter of the two.
      expect(
        offGrid(seen.rect.x),
        `${where}: canvas x is ${seen.rect.x}, which is ${offGrid(seen.rect.x)} of a CSS pixel off the grid`,
      ).toBeLessThan(0.001);
      expect(
        offGrid(seen.rect.y),
        `${where}: canvas y is ${seen.rect.y}, which is ${offGrid(seen.rect.y)} of a CSS pixel off the grid`,
      ).toBeLessThan(0.001);
      // Then in device pixels, which is the grid the resampling actually happens on.
      for (const axis of ['x', 'y'] as const) {
        const device = seen.rect[axis] * seen.dpr;
        expect(
          offGrid(device),
          `${where}: canvas ${axis} is ${seen.rect[axis]} CSS px = ${device} device px, which is ${offGrid(device)} of a device pixel off the grid`,
        ).toBeLessThan(0.001);
      }

      /*
       * And the four custom properties tell the truth about all four numbers.
       *
       * They used to be published through Math.round, so --otp-canvas-y said "65px" while the
       * canvas sat at 64.5 and every panel anchored to the world was positioned half a pixel from
       * the world. Rounding a measurement cannot put a canvas on the grid; it can only hide that
       * it is not on it.
       */
      for (const key of ['x', 'y', 'w', 'h'] as const) {
        expect(
          seen.published[key],
          `${where}: --otp-canvas-${key} publishes ${seen.published[key]}px for a canvas at ${JSON.stringify(seen.rect)}`,
        ).toBeCloseTo(seen.rect[key], 3);
      }
    }
    await context.close();
  }
});
