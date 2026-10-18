import { expect, test } from '@playwright/test';
import { hold, mapObject, probe, startGame, walkTo } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('the run starts in explore with Red at the spawn', async ({ page }) => {
  const spawn = await mapObject(page, 'spawn-red');
  const start = await probe(page);
  expect(start.phase).toBe('explore');
  expect(Math.abs(start.position.x - spawn.x)).toBeLessThan(32);
});

test('Red walks east along the path and the camera follows', async ({ page }) => {
  const before = await probe(page);
  await hold(page, 'ArrowRight', 800);
  const after = await probe(page);
  expect(after.position.x).toBeGreaterThan(before.position.x + 20);
  expect(after.position.y).toBeCloseTo(before.position.y, 0);
});

test('WASD works as well as the arrows', async ({ page }) => {
  const before = await probe(page);
  await hold(page, 'KeyD', 500);
  expect((await probe(page)).position.x).toBeGreaterThan(before.position.x + 10);
});

test('the forest border holds Red inside the map', async ({ page }) => {
  await hold(page, 'ArrowUp', 6000);
  expect((await probe(page)).position.y).toBeGreaterThan(16);
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

test('the interact prompt leads to a dialogue, and Esc backs out', async ({ page }) => {
  const rabbit = await mapObject(page, 'npc-rabbit');
  await walkTo(page, { x: rabbit.x + 8, y: rabbit.y + 20 });

  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const talking = await probe(page);
  expect(talking.phase).toBe('dialogue');
  expect(talking.activeCharacter).toBe('rabbit');
  expect(talking.log.map((e) => e.t)).toContain('met');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  expect((await probe(page)).phase).toBe('explore');
});

test('input is ignored while a panel is open', async ({ page }) => {
  const rabbit = await mapObject(page, 'npc-rabbit');
  await walkTo(page, { x: rabbit.x + 8, y: rabbit.y + 20 });
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const talking = await probe(page);
  expect(talking.phase).toBe('dialogue');

  await hold(page, 'ArrowRight', 600);
  expect((await probe(page)).position.x).toBeCloseTo(talking.position.x, 0);
});

test('the cottage gate stays locked until all three skills have a verdict', async ({ page }) => {
  // Walking the whole map takes a while, and the hint toast hides itself after a few seconds.
  test.slow();
  const gate = await mapObject(page, 'trigger-cottage');
  await walkTo(page, { x: gate.x + 8, y: gate.y + gate.height / 2 }, 12, 40_000);

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
  expect(after.position.x).toBeGreaterThan(before.position.x + 15);
  await page.waitForTimeout(400);
  expect((await probe(page)).position.x).toBeCloseTo(after.position.x, 0);
  await context.close();
});

test('the canvas keeps whole device pixels per game pixel', async ({ page }) => {
  for (const dpr of [1, 2, 3]) {
    const context = await page
      .context()
      .browser()!
      .newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: dpr });
    const p = await context.newPage();
    await p.goto('/');
    await startGame(p);
    const fit = await p.evaluate(() => {
      const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
      const cssWidth = parseFloat(getComputedStyle(canvas).width);
      // canvas.width is the camera size in game pixels, which now follows the window.
      return { zoom: cssWidth / canvas.width, cssWidth };
    });
    // One game pixel is a whole number of CSS pixels at every DPR.
    expect(Math.abs(fit.zoom - Math.round(fit.zoom)), `dpr ${dpr}`).toBeLessThan(0.001);
    // And the world actually fills its frame: nobody was checking this, which is how a phone
    // ended up rendering the world at a third of the screen.
    expect(fit.cssWidth, `dpr ${dpr}`).toBeGreaterThan(1024 * 0.7);
    await context.close();
  }
});
