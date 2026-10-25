import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TILE } from '../src/world/logic';
import { mapObject, startGame } from './helpers';
import type { MapObject } from './helpers';

/*
 * THE THREE CYERA SIGNS IN THE WOOD, IN THE RUNNING GAME (the client, 2026-10-23).
 *
 * The forest notice lettered "I ♥ Cyera Research", the "Dead end" board at the end of the north path
 * (rules 3: the "Cyera Speed!" board, moved and repainted),
 * and the blank board the supplied logo is laid over. test/signs.test.ts holds the map and content
 * contract without a browser; this is the picture and the DOM over it, at the two reviewed sizes:
 *
 *   - every sign is on the map, solid, and named in content;
 *   - the logo over the blank board is the supplied SVG, byte for byte, unrecoloured and unstretched,
 *     and its box lands EXACTLY on the board's painted face -- measured off a screenshot of the
 *     canvas with the logo lifted, so the bound is the board's own pixels, not the code that placed
 *     the box (PAUL_BRIEF trap 5) -- and it stays there as the camera moves, and hides off screen;
 *   - each caption is said, in the toast's slot, when Purple stands near its sign, and only then.
 *
 * Every position is read from the map and the scene; nothing here types a coordinate. Purple is put
 * beside a sign the way door.spec.ts puts her at the door, then the camera is let settle.
 *
 * SHOT_DIR=/tmp/shots also writes a screenshot of each sign at each size, which is how a human looks.
 */

const SHOTS = process.env['SHOT_DIR'];

const LOGO = readFileSync(
  fileURLToPath(new URL('../../../reference/brand/logos/cyera-logo-white.svg', import.meta.url)),
);

const CONTENT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { world: { signs: Record<string, { caption: string; spoken?: string }> } } };
const WORDS = CONTENT.ui.world.signs;

const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

/** Where Purple stands to read each sign: a cell beside it, on the side a walker comes from. */
const STAND: Record<string, (o: MapObject) => { x: number; y: number }> = {
  // On the road under the notice, the lower of its two rows: the due-east walker's row.
  research: (o) => ({ x: o.x + o.width / 2, y: o.y + TILE * 2.75 }),
  // At the end of the north path, on the cell under the board, where the Owl used to stand.
  'dead-end': (o) => ({ x: o.x + TILE / 2, y: o.y + TILE * 1.75 }),
  // On the road above the board, so her figure is clear of its face.
  logo: (o) => ({ x: o.x + o.width / 2, y: o.y - TILE * 1.25 }),
};

/** Puts Purple's feet at a world point and waits for the camera to stop moving. */
async function standAt(page: Page, at: { x: number; y: number }): Promise<void> {
  const free = await page.evaluate(({ x, y }) => !window.__otp!.isSolidAt!(x, y), at);
  expect(free, `(${at.x}, ${at.y}) is not somewhere Purple can stand`).toBe(true);
  await page.evaluate(({ x, y }) => {
    const scene = window.__otp!.scene!;
    scene.position = { x, y };
    scene.placePurple();
  }, at);
  await settle(page);
}

/** Resolves once the camera's scroll has held still for ten frames running. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const main = (
          window.__otp!.scene as unknown as {
            cameras: { main: { scrollX: number; scrollY: number } };
          }
        ).cameras.main;
        let last = `${main.scrollX},${main.scrollY}`;
        let still = 0;
        const started = performance.now();
        const tick = (): void => {
          const now = `${main.scrollX},${main.scrollY}`;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= 10) return resolve();
          if (performance.now() - started > 8000)
            return reject(new Error('the camera never settled'));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  // And two more frames, so the DOM's own frame loop has written the settled place.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

async function shoot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const { width } = page.viewportSize()!;
  await page.screenshot({ path: `${SHOTS}/sign-${name}-${width}.png` });
}

/**
 * The four edges of the logo's box against the board's own painted pixels.
 *
 * The logo layer is lifted for the screenshot, so what is measured is the canvas alone. Inside the
 * box is the board's blank face, dark; one CSS pixel outside it, on every side, is the board's lit
 * frame. A box one game pixel off its face on any side puts a frame pixel inside or a face pixel
 * outside, and that side's step goes to nothing.
 */
async function edgeSteps(page: Page): Promise<{
  zoom: number;
  steps: { top: number; bottom: number; left: number; right: number };
}> {
  const box = (await page.locator('[data-world-signs] [data-sign="logo"]').boundingBox())!;
  const zoom = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>('[data-world-signs]')!;
    const scene = window.__otp!.scene as unknown as { canvasWidth: number };
    return layer.clientWidth / scene.canvasWidth;
  });
  const m = Math.max(1, Math.round(zoom));
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-world-signs]')!.style.visibility = 'hidden';
  });
  const shot = (
    await page.screenshot({
      clip: {
        x: Math.round(box.x) - m,
        y: Math.round(box.y) - m,
        width: Math.round(box.width) + 2 * m,
        height: Math.round(box.height) + 2 * m,
      },
    })
  ).toString('base64');
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-world-signs]')!.style.visibility = '';
  });
  const steps = await page.evaluate(
    async ({ b64, m }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const luma = (x: number, y: number): number => {
        const i = (y * c.width + x) * 4;
        return 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      };
      const w = c.width;
      const h = c.height;
      // Mean luma of a column or a row, over the face's own span only (the corners are frame both ways).
      const col = (x: number): number => {
        let s = 0;
        for (let y = m; y < h - m; y++) s += luma(x, y);
        return s / (h - 2 * m);
      };
      const row = (y: number): number => {
        let s = 0;
        for (let x = m; x < w - m; x++) s += luma(x, y);
        return s / (w - 2 * m);
      };
      return {
        left: col(m - 1) - col(m + 1),
        right: col(w - m) - col(w - m - 2),
        top: row(m - 1) - row(m + 1),
        bottom: row(h - m) - row(h - m - 2),
      };
    },
    { b64: shot, m },
  );
  return { zoom, steps };
}

for (const size of SIZES) {
  test.describe(`at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await startGame(page);
    });

    test('every sign is on the map, solid, and has its words in content', async ({ page }) => {
      const signs = await page.evaluate(() =>
        window.__otp!.mapObjects!.filter((o) => o.name.startsWith('sign-')).map((o) => o.name),
      );
      expect(signs.sort()).toEqual(['sign-dead-end', 'sign-logo', 'sign-research']);
      for (const name of signs) {
        const o = await mapObject(page, name);
        for (let x = o.x; x < o.x + o.width; x += TILE) {
          const solid = await page.evaluate(([px, py]) => window.__otp!.isSolidAt!(px!, py!), [
            x + TILE / 2,
            o.y + TILE / 2,
          ] as const);
          expect(solid, `${name} at (${x}, ${o.y}) is walkable`).toBe(true);
        }
        expect(WORDS[name.slice('sign-'.length)]?.caption, `${name} has no caption`).toBeTruthy();
      }
    });

    for (const key of Object.keys(STAND)) {
      test(`the ${key} sign's caption is said near it, and only near it`, async ({ page }) => {
        const caption = page.locator('[data-sign-caption]');
        await expect(caption, 'nothing is said at the spawn').toBeEmpty();

        const o = await mapObject(page, `sign-${key}`);
        await standAt(page, STAND[key]!(o));
        await expect(caption).toHaveAttribute('data-sign-caption', key);
        const words = WORDS[key]!;
        if (words.spoken) {
          // The eye reads the caption; a screen reader hears the spoken form, and not the glyph.
          await expect(caption.locator('[aria-hidden="true"]')).toHaveText(words.caption);
          await expect(caption.locator('.otp-visually-hidden')).toHaveText(words.spoken);
        } else {
          await expect(caption).toHaveText(words.caption);
        }
        await expect(caption).toBeVisible();
        await expect(caption).toHaveAttribute('aria-live', 'polite');
        // One line: the caption box is one line of its own type tall.
        const lines = await caption.evaluate((el) => {
          const lh = parseFloat(getComputedStyle(el).lineHeight);
          const pad = parseFloat(getComputedStyle(el).paddingTop) * 2;
          const border = parseFloat(getComputedStyle(el).borderTopWidth) * 2;
          return Math.round((el.getBoundingClientRect().height - pad - border) / lh);
        });
        expect(lines, 'the caption wraps').toBe(1);
        // And inside the world's box, so it is read over the forest and not over the cabinet.
        const world = (await page.locator('#game canvas').boundingBox())!;
        const at = (await caption.boundingBox())!;
        expect(at.x).toBeGreaterThanOrEqual(world.x - 0.5);
        expect(at.x + at.width).toBeLessThanOrEqual(world.x + world.width + 0.5);
        await shoot(page, key);

        // Walk away -- back to the spawn -- and it is gone again.
        const spawn = await mapObject(page, 'spawn-purple');
        await standAt(page, { x: spawn.x + TILE / 2, y: spawn.y + TILE - 4 });
        await expect(caption).toBeEmpty();
        await expect(caption).toHaveAttribute('data-sign-caption', '');
      });
    }

    test('the logo on its board is the supplied SVG, on the face, and moves with it', async ({
      page,
    }) => {
      const logo = page.locator('[data-world-signs] [data-sign="logo"]');
      const layer = page.locator('[data-world-signs]');
      await expect(layer).toHaveAttribute('aria-hidden', 'true');
      // At the spawn the board is off the camera, and so is the logo.
      await expect(logo).toBeHidden();

      const o = await mapObject(page, 'sign-logo');
      await standAt(page, STAND['logo']!(o));
      await expect(logo).toBeVisible();

      // The supplied file, as served, byte for byte -- and shown unrecoloured and unstretched.
      const img = logo.locator('img');
      await expect(img).toHaveAttribute('alt', '');
      const src = (await img.getAttribute('src'))!;
      const served = await page.request.get(src);
      expect(served.ok()).toBe(true);
      expect(Buffer.compare(await served.body(), LOGO), `${src} is not the supplied logo`).toBe(0);
      const look = await img.evaluate((el: HTMLImageElement) => {
        const cs = getComputedStyle(el);
        return {
          ratio: el.naturalWidth / el.naturalHeight,
          fit: cs.objectFit,
          filter: cs.filter,
          opacity: cs.opacity,
          blend: cs.mixBlendMode,
        };
      });
      expect(look.ratio).toBeCloseTo(734 / 176, 2);
      expect(look.fit, 'without contain, the face box stretches the mark').toBe('contain');
      expect([look.filter, look.opacity, look.blend]).toEqual(['none', '1', 'normal']);

      // On the face, by the board's own pixels, here...
      const here = await edgeSteps(page);
      expect(Number.isInteger(here.zoom), `zoom ${here.zoom}`).toBe(true);
      for (const [side, step] of Object.entries(here.steps))
        expect(step, `${side} edge of the logo's box is off the board's face`).toBeGreaterThan(20);
      // ...and the face is the one the map publishes, at the camera's scroll Phaser draws at.
      const placed = await page.evaluate(() => {
        const scene = window.__otp!.scene as unknown as {
          signFace(k: string): { x: number; y: number; width: number; height: number } | null;
        };
        const layer = document
          .querySelector<HTMLElement>('[data-world-signs]')!
          .getBoundingClientRect();
        const box = document
          .querySelector<HTMLElement>('[data-world-signs] [data-sign="logo"]')!
          .getBoundingClientRect();
        return {
          face: scene.signFace('logo'),
          box: { x: box.x - layer.x, y: box.y - layer.y, width: box.width, height: box.height },
        };
      });
      expect(placed.face).not.toBeNull();
      const f = placed.face!;
      expect(placed.box.x).toBeCloseTo(f.x * here.zoom, 1);
      expect(placed.box.y).toBeCloseTo(f.y * here.zoom, 1);
      const published = (o as MapObject & { face?: { width: number; height: number } }).face!;
      expect(placed.box.width).toBeCloseTo(published.width * here.zoom, 1);
      expect(placed.box.height).toBeCloseTo(published.height * here.zoom, 1);
      await shoot(page, 'logo-board');

      /*
       * ...and WHILE the camera moves: a real walk east along the road, watched on every frame.
       *
       * This test used to walk for a timed 500ms and then measure the edges if the logo was
       * "visible". It failed 2 runs in 3 at 375x812 under load, and the cause was the measurement,
       * not the overlay (2026-10-25, measured in a copy of the tree). A held key walks for as long
       * as the key is down in wall time, and under load the key-up lands late, so Purple walked on:
       * at that size the board sits 166 px in from the camera's left edge at the stand, a hold of
       * 1.6 s walks it to x = -2, and a board the camera has CUT is still `isVisible()` -- so the
       * left step was read off the stage beside the canvas and came back 0. Across fifteen walk
       * lengths the box sat exactly on the face every time the face was whole.
       *
       * The overlay lagging the camera by a frame -- the logo sliding off its board as she walks --
       * was the other possibility, and it is asserted directly here rather than inferred: this
       * callback is registered after both the game's frame loop and the logo's own, so it runs
       * after both in every frame, and on every frame of the walk the logo must be where the face
       * is at the scroll Phaser has just drawn. It measured 0 frames out of 90 out of place.
       */
      const watch = page.evaluate(
        () =>
          new Promise<string[]>((resolve) => {
            const scene = window.__otp!.scene as unknown as {
              signFace(k: string): { x: number; y: number } | null;
              canvasWidth: number;
            };
            const layer = document.querySelector<HTMLElement>('[data-world-signs]')!;
            const el = layer.querySelector<HTMLElement>('[data-sign="logo"]')!;
            const off: string[] = [];
            let n = 0;
            const tick = (): void => {
              const z = layer.clientWidth / scene.canvasWidth;
              const f = scene.signFace('logo');
              const want = f ? `translate(${f.x * z}px, ${f.y * z}px)` : 'hidden';
              const got = el.hidden ? 'hidden' : el.style.transform;
              if (want !== got) off.push(`frame ${n}: drawn at ${want}, logo at ${got}`);
              if (++n < 60) requestAnimationFrame(tick);
              else resolve(off);
            };
            requestAnimationFrame(tick);
          }),
      );
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowRight');
      expect(await watch, 'the logo trails the board it sits on').toEqual([]);

      // And at rest a few steps back west, placed rather than held, so the board is whole in frame.
      // West, not east: three tiles east of the stand is the drawbridge's first cell (rules 3), which
      // is raised and solid until the Bridge Key is taken.
      const before = await page.evaluate(() => {
        const main = (window.__otp!.scene as unknown as { cameras: { main: { scrollX: number } } })
          .cameras.main;
        return main.scrollX;
      });
      const stand = STAND['logo']!(o);
      await standAt(page, { x: stand.x - TILE * 3, y: stand.y });
      const there = await page.evaluate(() => {
        const scene = window.__otp!.scene as unknown as {
          signFace(k: string): { x: number; y: number; width: number; height: number } | null;
          cameras: { main: { scrollX: number; width: number } };
        };
        const main = scene.cameras.main;
        return { face: scene.signFace('logo'), cam: { scrollX: main.scrollX, width: main.width } };
      });
      expect(there.cam.scrollX, 'the camera did not move, so nothing moved with it').not.toBe(
        before,
      );
      // The whole face in frame, or the steps below would read the stage beside the canvas.
      const f2 = there.face!;
      expect(f2, 'the board left the camera').not.toBeNull();
      expect(f2.x).toBeGreaterThanOrEqual(0);
      expect(f2.x + f2.width).toBeLessThanOrEqual(there.cam.width);
      const steps = await edgeSteps(page);
      for (const [side, step] of Object.entries(steps.steps))
        expect(step, `${side} edge, after the camera moved`).toBeGreaterThan(20);

      // Off the camera it is hidden, not left hanging at its last place.
      const spawn = await mapObject(page, 'spawn-purple');
      await standAt(page, { x: spawn.x + TILE / 2, y: spawn.y + TILE - 4 });
      await expect(logo).toBeHidden();
    });
  });
}

test('the notice and the dead-end sign are seen in frame at both sizes', async ({ browser }) => {
  // The two lettered signs are canvas art: what is asserted is that the camera can show them whole.
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: size });
    await page.goto('/');
    await startGame(page);
    for (const key of ['research', 'dead-end'] as const) {
      const o = await mapObject(page, `sign-${key}`);
      await standAt(page, STAND[key]!(o));
      const inView = await page.evaluate((r) => {
        const main = (
          window.__otp!.scene as unknown as {
            cameras: { main: { scrollX: number; scrollY: number; width: number; height: number } };
          }
        ).cameras.main;
        return (
          r.x >= main.scrollX &&
          r.x + r.width <= main.scrollX + main.width &&
          r.y >= main.scrollY &&
          r.y + r.height <= main.scrollY + main.height
        );
      }, o);
      expect(
        inView,
        `sign-${key} is not wholly in the camera at ${size.width}x${size.height}`,
      ).toBe(true);
    }
    await page.close();
  }
});
