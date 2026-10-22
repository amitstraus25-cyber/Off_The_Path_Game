import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { REFERENCE_VIEWPORTS, TILE } from '@otp/core';
import { cabinetFor as cameraFor } from '../src/ui/cabinet';
import { CLICK_MS } from '../src/ui/touch-controls';
import type { Size } from '@otp/core';
import {
  hold,
  mapObject,
  probe,
  ready,
  startGame,
  talkingDistance,
  walkTo,
  walkUntil,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');

  /*
   * WHICH BUILD IS BEHIND THIS PORT -- asked before anything is measured against it.
   *
   * Every spec in this file drives the game through `window.__otp`, which only a build made with
   * VITE_E2E=1 defines. `vite preview` re-reads `dist` on every request, so a plain `pnpm build`
   * run by anyone else in this checkout REPLACES the build under test while the suite is running,
   * and the hooks vanish mid-run. That is not a hypothetical: it happened twice while this file
   * was being written, the second time turning a green run into seven failures, every one of them
   * reported as `page.waitForFunction: Test timeout of 30000ms exceeded` from inside startGame --
   * a message that points at the game being slow, which it was not, instead of at the build having
   * been swapped, which it had.
   *
   * One cheap evaluate turns thirty seconds of silence into a sentence. This covers this file
   * only; the shared fix belongs in e2e-build.ts, which already carries a comment about a reused
   * server measuring a stale dist and could assert the hooks are present in what it just built.
   */
  await ready(page);
  expect(
    await page.evaluate(() => typeof window.__otp),
    'the page under test does not define window.__otp, so it was NOT built with VITE_E2E=1. ' +
      'Something rebuilt apps/game/dist without the flag -- a plain `pnpm build` in this checkout ' +
      'will do it, and `vite preview` picks it up per request. Rebuild with VITE_E2E=1 and re-run.',
  ).toBe('object');

  await startGame(page);
});

test('the run starts in explore with Purple at the spawn', async ({ page }) => {
  const spawn = await mapObject(page, 'spawn-purple');
  const start = await probe(page);
  expect(start.phase).toBe('forest');
  expect(Math.abs(start.position.x - spawn.x)).toBeLessThan(64);
});

test('Purple walks east along the path and the camera follows', async ({ page }) => {
  // Walked until it got there, not for a fixed time: the world caps movement per frame, so a
  // starved CI runner delivering few frames moved 38px in a fixed 800ms and failed a 40px bar.
  // The claim is that holding the key walks Purple east, not how fast the runner renders.
  const before = await probe(page);
  const after = await walkUntil(
    page,
    'ArrowRight',
    (p) => p.position.x > before.position.x + 40,
    4000,
  );
  expect(after.position.x).toBeGreaterThan(before.position.x + 40);
  expect(after.position.y).toBeCloseTo(before.position.y, 0);
});

test('WASD works as well as the arrows', async ({ page }) => {
  const before = await probe(page);
  const after = await walkUntil(page, 'KeyD', (p) => p.position.x > before.position.x + 20, 4000);
  expect(after.position.x).toBeGreaterThan(before.position.x + 20);
});

test('the forest border holds Purple inside the map', async ({ page }) => {
  await hold(page, 'ArrowUp', 6000);
  expect((await probe(page)).position.y).toBeGreaterThan(32);
});

test('Purple never stands inside a solid tile, whatever route she takes', async ({ page }) => {
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
      const { x, y } = otp.scene!.purplePosition;
      return otp.isSolidAt!(x, y);
    });
    expect(solid, `Purple stood inside a solid tile after holding ${key}`).toBe(false);
  }
});

/*
 * One walk, three beats. "Input is ignored while a panel is open" used to be a separate test that
 * repeated this one line for line -- the same thirty-second walk to the same rabbit, the same
 * Space, the same phase check -- and then added the two lines now in the middle here. Both tests
 * depend on exactly the same state, so splitting them bought nothing and cost a second walk.
 */
test('the interact prompt opens the offer with its card read, which swallows the walk keys, and Esc walks on', async ({
  page,
}) => {
  await walkTo(page, await talkingDistance(page, 'npc-rabbit'));

  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const talking = await probe(page);
  // The card opens by itself, and is logged as read the moment it is on screen.
  expect(talking.phase).toBe('card');
  expect(talking.activeCharacter).toBe('rabbit');
  expect(talking.log.map((e) => e.e)).toEqual(expect.arrayContaining(['met', 'inspected']));

  // The world stops listening while a panel owns the screen: Purple must not walk out from under it.
  await hold(page, 'ArrowRight', 600);
  expect((await probe(page)).position.x).toBeCloseTo(talking.position.x, 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  expect((await probe(page)).phase).toBe('forest');
});

test('touch controls move Purple and stop her on release', async ({ browser }) => {
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
  /*
   * Held UNTIL she has walked, not for a fixed time: 900ms of wall clock is 30px only at the frame
   * rate it was timed on, and a starved runner's capped frames cover less. Then held a little past
   * the stick's click window (touch-controls.ts CLICK_MS), so the release is a release and not a
   * click that walks a step of its own.
   */
  await expect
    .poll(async () => (await probe(page)).position.x - before.position.x, { timeout: 15_000 })
    .toBeGreaterThan(30);
  await page.waitForTimeout(CLICK_MS);
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
 *
 * `cameraFor` HERE IS THE CABINET'S (`cabinetFor`, imported under the old name). The arcade cabinet
 * reserves its marquee and deck before `stageFit` sizes the world, so core's `cameraFor` no longer
 * describes the shipped canvas. ui/cabinet.ts says why it is not in core yet and that the graybox
 * tooling is composing against the old camera until it is.
 */
const FIT_VIEWPORTS: Size[] = [
  // The viewport this test has always run at, kept so it still covers what it used to.
  { width: 1024, height: 768 },
  ...Object.values(REFERENCE_VIEWPORTS),
];

test('the canvas fills its frame in both axes, at whole CSS pixels per game pixel', async ({
  page,
}) => {
  // Three browser contexts and six viewports in each, so eighteen full layout settles. It flaked
  // once on a loaded machine while this file was being extended; CI runs --fail-on-flaky-tests,
  // where a retry that passes still fails the run, so the budget is declared rather than retried.
  test.slow();
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
  // Same shape and the same budget as the fill test above, for the same reason.
  test.slow();
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

/*
 * ===========================================================================
 * WHICH BUILD IS THIS? -- the guards that answer "still have the lags".
 * ===========================================================================
 *
 * The round that produced these spent itself establishing that there was nothing to fix. The
 * client reported a dark rule across the top of the world, which is the signature of the two
 * backdrop holes closed the round before. Both were genuinely gone: 49 measured configurations,
 * worst magenta count 0. What they were looking at was a DIFFERENT CHECKOUT -- a second working
 * copy of a different git repository, four days stale, still serving the game on three ports
 * (`vite dev` on 5173 and 5174, `vite preview` on 4190) -- which still has the left-bound hole.
 *
 * Nothing in the running game said which build it was, so a screenshot could not be told apart
 * from any other screenshot, and three rounds argued about where a line was instead of which
 * program drew it. Measured on the three servers that were live while this was written:
 *
 *   localhost:4173  this repo, production build   __otp undefined   /assets/index-xA2VY-K4.js
 *   localhost:5173  stale checkout, dev server    __otp object      /@vite/client
 *   localhost:4190  stale checkout, preview       __otp object      /assets/index-54DD2M2k.js
 *
 * The hashed bundle name is a build fingerprint that is already in the page and already visible in
 * View Source. These two guards make it load-bearing instead of incidental:
 *
 *   1. `serves the build this run just made` -- the spec run and the server under test are the
 *      same program. playwright.config.ts reuses an existing server on :4173 outside CI, and
 *      e2e-build.ts already carries a comment about a reused server measuring a stale `dist`; it
 *      rebuilds this repo's dist on every run, but nothing checked that the port it then measures
 *      is serving THAT dist rather than some other checkout's. This is that check.
 *   2. `no backdrop shows through the world` -- the standing instrument for the defect itself, so
 *      the next report of a dark rule is answered by a test run rather than by a round of
 *      forensics.
 */

/** `apps/game/dist/index.html`, the page globalSetup built, read from disk rather than the server. */
const DIST_INDEX = fileURLToPath(new URL('../dist/index.html', import.meta.url));

/** The hashed module bundle an index.html points at: the build's fingerprint. */
const bundleOf = (html: string): string | null =>
  /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1] ?? null;

test('the server under test serves the build this run just made', async ({ page, baseURL }) => {
  const onDisk = bundleOf(readFileSync(DIST_INDEX, 'utf8'));
  expect(onDisk, `no module bundle found in ${DIST_INDEX}`).not.toBeNull();

  const served = await page.evaluate(
    () => document.querySelector('script[type="module"]')?.getAttribute('src') ?? null,
  );

  /*
   * The failure this is written for is not subtle once you can see it, and is invisible until you
   * can: every other spec in the suite goes on passing or failing against the wrong program, and
   * the result is read as a statement about this checkout. So the message names both builds and
   * the port, because the person reading it is about to go looking for the wrong thing.
   */
  expect(
    served,
    `${baseURL} is serving ${served}, but this run built ${onDisk}. The preview server on that ` +
      `port belongs to a different checkout or a different build. playwright.config.ts reuses an ` +
      `existing server outside CI, so stop whatever is on that port and let Playwright start its own.`,
  ).toBe(onDisk);
});

/*
 * A production build must not carry the e2e hooks.
 *
 * `window.__otp` hands out the store, the bus, the content and -- until the fix this guard was
 * written beside -- a live handle on the Phaser scene. The gate is
 * `import.meta.env.DEV || import.meta.env.VITE_E2E === '1'`, and it has to be DOT access: Vite
 * folds the dot form to a literal at build time so the minifier drops the branch, and does not
 * reliably fold `env['VITE_E2E']`, which leaves a runtime lookup and ships the payload. The scene
 * half of that was measured shipping, in the bracket form, in this repo's own bundle.
 *
 * This runs a second, plain build rather than inspecting the one under test, because the build
 * under test is deliberately made WITH the flag and legitimately has the hooks. It is the only
 * assertion in the suite that compiles anything, hence test.slow(); the measured cost is ~2s.
 * apps/game/test/csp.test.ts is the better long-term home -- it already reads built artefacts as
 * text -- but it is outside this spec's ownership.
 */
test('a production build ships none of the e2e scene hooks', async () => {
  test.slow();
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const out = mkdtempSync(join(tmpdir(), 'otp-prod-'));
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  // A plain build: no VITE_E2E in the environment, whatever this process was started with.
  const env = { ...process.env };
  delete env['VITE_E2E'];
  /*
   * The workspace's own vite, by path, rather than `npx vite`: npx falls back to FETCHING a package
   * when it cannot resolve one locally, which on a CI runner is either a hang or a surprise
   * download inside a test. An explicit path either runs the pinned binary or fails saying it is
   * missing. `--outDir` is absolute and outside the project, so this cannot disturb `dist` -- the
   * server under test reads that per request, and other specs in this run are reading it too.
   */
  const vite = join(cwd, 'node_modules', '.bin', 'vite');
  execFileSync(vite, ['build', '--outDir', out, '--emptyOutDir'], { cwd, env });

  const js = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'));
  expect(js.length, 'the plain build produced no JavaScript to inspect').toBeGreaterThan(0);
  const bundle = js.map((f) => readFileSync(join(out, 'assets', f), 'utf8')).join('\n');

  /*
   * Named for what they are rather than for the gate, so this does not pass by being rewritten
   * alongside the thing it watches: these are the two hooks only the scene branch installs.
   */
  for (const hook of ['isSolidAt', 'mapObjects'])
    expect(
      bundle.includes(hook),
      `"${hook}" is in a production bundle, so the e2e gate in forest-scene.ts is not being ` +
        `eliminated. Check it is dot access -- import.meta.env.VITE_E2E -- and not env['VITE_E2E'].`,
    ).toBe(false);
});

/*
 * THE MAGENTA BACKDROP PROBE, as a standing guard rather than a thing someone rebuilds each round.
 *
 * Phaser paints a camera's backdrop wherever the world does not reach. Shipped, that backdrop is
 * --cyera-black, the same colour as the frame's header strip directly above the canvas, so a row
 * of it along the top edge is pixel-identical to the header being one pixel taller and a column of
 * it at the side is invisible against the border. That is why two holes shipped, why a third was
 * reported that did not exist, and why the only way anyone has ever settled it is to repaint the
 * backdrop a colour the art cannot produce and count it. #FF00FF appears nowhere in the tileset,
 * so a magenta pixel is backdrop showing through the world and nothing else.
 *
 * Both closed holes were parity bugs -- an odd camera dimension, which Phaser rounds about the
 * camera's centre and so draws the world a pixel off -- and both printed only at a map BOUND,
 * where there is no next column to slide in. packages/core/test/camera.test.ts asserts the parity
 * directly, in arithmetic. This asserts the thing parity is a proxy FOR, in pixels, on the running
 * game, which is the half that would have caught a cause neither of us thought of.
 */

/** The probe colour: chosen because the tileset cannot produce it, so a hit is unambiguous. */
const PROBE = '#ff00ff';

interface Backdrop {
  count: number;
  /** The first few canvas columns the backdrop showed in -- a hole at a bound is a column. */
  columns: number[];
  camera: { w: number; h: number; scrollX: number; scrollY: number };
}

/**
 * Repaints the camera backdrop and counts what shows through, out of Phaser's own snapshot.
 *
 * `hideWorld` is the non-vacuity control: with the tilemap layers switched off the backdrop is
 * unquestionably visible, so a probe that still returns 0 is broken rather than reassuring.
 */
const backdrop = async (p: import('@playwright/test').Page, hideWorld = false): Promise<Backdrop> =>
  p.evaluate(
    ([colour, hide]) =>
      new Promise<Backdrop>((resolve) => {
        const scene = window.__otp?.scene as unknown as {
          cameras: {
            main: {
              width: number;
              height: number;
              scrollX: number;
              scrollY: number;
              backgroundColor: { color: number };
              setBackgroundColor(c: string | number): void;
            };
          };
          game: { renderer: { snapshot(cb: (image: HTMLImageElement) => void): void } };
          children: { list: { type: string; visible: boolean }[] };
        };
        const cam = scene.cameras.main;
        const restoreTo = cam.backgroundColor.color;
        const layers = scene.children.list.filter((c) => c.type === 'TilemapLayer');
        if (hide) for (const l of layers) l.visible = false;
        cam.setBackgroundColor(colour as string);

        scene.game.renderer.snapshot((image) => {
          const c = document.createElement('canvas');
          c.width = image.width;
          c.height = image.height;
          const g = c.getContext('2d')!;
          g.drawImage(image, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let count = 0;
          const columns: number[] = [];
          for (let i = 0; i < d.length; i += 4) {
            // Generous on the two lit channels and strict on the dark one: nothing in the forest
            // is both that red and that blue while being that free of green.
            if ((d[i] ?? 0) > 240 && (d[i + 1] ?? 0) < 16 && (d[i + 2] ?? 0) > 240) {
              count++;
              const x = (i / 4) % c.width;
              if (columns.length < 8 && !columns.includes(x)) columns.push(x);
            }
          }
          // Put the world back, so the probe leaves the page exactly as it found it and the next
          // viewport in the sweep is not measuring a page this one damaged.
          cam.setBackgroundColor(restoreTo);
          if (hide) for (const l of layers) l.visible = true;
          resolve({
            count,
            columns,
            camera: { w: cam.width, h: cam.height, scrollX: cam.scrollX, scrollY: cam.scrollY },
          });
        });
      }),
    [PROBE, hideWorld] as const,
  );

test('the backdrop probe can actually see the backdrop', async ({ page }) => {
  /*
   * The control for every assertion below. A probe whose detector is broken -- a wrong colour
   * channel, a snapshot taken before the repaint lands, a canvas read back empty under WebGL --
   * returns 0 for a healthy world and 0 for a holed one, and reads as proof when it is silence.
   * So: switch the world off, and require the probe to notice.
   */
  const blind = await backdrop(page, true);
  expect(
    blind.count,
    'with every tilemap layer hidden the camera backdrop fills the view, and the probe saw none ' +
      'of it: the probe is broken, and every zero it reports below is meaningless.',
  ).toBeGreaterThan(0);

  // And with the world back, it is the world that covers the backdrop rather than the probe
  // having gone quiet: same page, same probe, immediately after.
  expect((await backdrop(page)).count).toBe(0);
});

/*
 * The client's own window is in here by number, because it is the one the screenshots came from
 * and it is not a size anyone would have thought to list: 1673x449, a landscape strip whose camera
 * lands at 1280x366. The rest are the project's reference viewports plus the two phones.
 */
const BACKDROP_VIEWPORTS: Size[] = [
  { width: 1673, height: 449 },
  ...Object.values(REFERENCE_VIEWPORTS),
  { width: 390, height: 844 },
  { width: 2560, height: 1440 },
];

test('no camera backdrop shows through the world, at any viewport or DPR', async ({ page }) => {
  test.slow();
  for (const dpr of [1, 2, 3]) {
    const context = await page
      .context()
      .browser()!
      .newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr });
    const p = await context.newPage();
    await p.goto('/');

    // The launch screen first: the hero shot, and the frame the client photographed.
    await p.waitForSelector('#game[data-ready="true"]');
    const launch = await backdrop(p);
    expect(
      launch.count,
      `launch screen at dpr${dpr}: ${launch.count} px of backdrop in columns ${JSON.stringify(launch.columns)}, camera ${JSON.stringify(launch.camera)}`,
    ).toBe(0);

    await startGame(p);

    for (const viewport of BACKDROP_VIEWPORTS) {
      await p.setViewportSize(viewport);
      await p.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, viewport.width);
      // Two frames: one for ui/stage.ts's resize handler, one for the layout it causes.
      await p.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );

      const seen = await backdrop(p);
      const where = `${viewport.width}x${viewport.height} dpr${dpr}`;
      /*
       * The camera is reported in the message, never asserted against a literal here: a camera
       * size written down in a test is the same mistake as a camera size written down in a
       * comment, and this project has paid for it three times. camera.test.ts owns the numbers.
       */
      expect(
        seen.count,
        `${where}: ${seen.count} px of camera backdrop showing through the world, first in ` +
          `columns ${JSON.stringify(seen.columns)}. Camera ${JSON.stringify(seen.camera)}. ` +
          `A column at x 0 or at the camera's width is a hole at a map bound.`,
      ).toBe(0);
    }
    await context.close();
  }
});

test('no backdrop shows at any of the four map bounds', async ({ page }) => {
  test.slow();
  /*
   * Separated from the sweep because a bound cannot be reached by walking. Both closed holes
   * printed ONLY at a bound -- with map on both sides the neighbouring column just slides in -- so
   * a sweep that never reaches one is measuring the easy case. The first attempt here held
   * ArrowUp for six seconds and got as far as scrollY 406 of a possible 0: the forest border stops
   * Purple a long way short, which is exactly what e2e/world.spec.ts's border test asserts. So Purple is
   * placed rather than walked, and the camera is allowed to ease after her.
   *
   * The top bound is the one the client described -- "a dark rule across the very top of the world
   * under the header" -- and the one where a row of backdrop is indistinguishable by eye from the
   * header being a pixel taller, since both are --cyera-black.
   */
  await page.setViewportSize({ width: 1673, height: 449 });
  await page.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, 1673);

  const corners = [
    ['top-left', 0, 0],
    ['top-right', 1, 0],
    ['bottom-left', 0, 1],
    ['bottom-right', 1, 1],
  ] as const;

  for (const [name, fx, fy] of corners) {
    const settled = await page.evaluate(
      ([x, y]) =>
        new Promise<{ scrollX: number; scrollY: number }>((resolve) => {
          const scene = window.__otp?.scene as unknown as {
            position: { x: number; y: number };
            map: { widthInPixels: number; heightInPixels: number };
            cameras: { main: { scrollX: number; scrollY: number } };
          };
          // Past the corner on purpose: the camera clamps to its bounds, which is the state under
          // test, and overshooting means the clamp rather than the arithmetic decides where it stops.
          scene.position = {
            x: x * scene.map.widthInPixels + (x ? 400 : -400),
            y: y * scene.map.heightInPixels + (y ? 400 : -400),
          };
          // The camera eases after Purple rather than snapping, so give it frames to arrive.
          let frames = 0;
          const tick = (): void => {
            if (++frames > 120) {
              const c = scene.cameras.main;
              resolve({ scrollX: c.scrollX, scrollY: c.scrollY });
            } else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      [fx, fy] as const,
    );

    /*
     * Non-vacuity, per corner rather than once at the end: the camera has to have actually
     * arrived at the clamp, or the zero below is a statement about the middle of the map. A near
     * bound clamps the scroll to 0; a far bound clamps it to a positive maximum.
     */
    for (const [axis, far] of [
      ['scrollX', fx],
      ['scrollY', fy],
    ] as const) {
      const got = settled[axis];
      if (far)
        expect(got, `${name}: ${axis} ${got} never reached the far bound`).toBeGreaterThan(0);
      else expect(got, `${name}: ${axis} ${got} never reached the near bound`).toBe(0);
    }

    const seen = await backdrop(page);
    expect(
      seen.count,
      `${name} bound (scroll ${settled.scrollX},${settled.scrollY}): ${seen.count} px of camera ` +
        `backdrop showing through the world, first in columns ${JSON.stringify(seen.columns)}. ` +
        `Camera ${JSON.stringify(seen.camera)}.`,
    ).toBe(0);
  }
});
