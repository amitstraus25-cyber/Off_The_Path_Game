/*
 * THE ARCADE CABINET, as a player meets it (the client's decision, 2026-10-22).
 *
 * The arithmetic is test/cabinet.test.ts. This is the browser half: that the marquee, the screen
 * and the deck land where ui/cabinet.ts said they would at every size the project reviews; that the
 * joystick and the A button WORK with a mouse, not only a thumb; and that the deck spends the Lime
 * only while you play.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { REFERENCE_VIEWPORTS } from '@otp/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The shipped content, read as a file: Playwright's loader takes no JSON import. */
const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { cabinet: { marquee: string }; reveal: { caught: string; again: string } } };
import { cabinetFor } from '../src/ui/cabinet';
import { STEP_PX } from '../src/ui/touch-controls';
import {
  answerAllAndArrive,
  probe,
  startGame,
  talkingDistance,
  toTheReveal,
  walkTo,
} from './helpers';

const SIZES = [
  REFERENCE_VIEWPORTS.desktop,
  REFERENCE_VIEWPORTS.tablet,
  REFERENCE_VIEWPORTS.phone,
  REFERENCE_VIEWPORTS.phoneLandscape,
];

type Box = { x: number; y: number; width: number; height: number };

async function boxes(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el || getComputedStyle(el).display === 'none') return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
    return {
      place: document.documentElement.dataset['cabinet'] ?? null,
      marquee: box('.otp-marquee'),
      frame: box('.otp-world-frame'),
      canvas: box('#game canvas'),
      zoom: canvas.getBoundingClientRect().width / canvas.width,
      deck: box('.otp-touch'),
      stick: box('.otp-stick'),
      a: box('.otp-a-button'),
      logo: document.querySelector('.otp-marquee__logo')?.getAttribute('src') ?? null,
      name: document.querySelector('.otp-marquee__name')?.textContent ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
    };
  });
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const size of SIZES) {
  test(`the cabinet stands at ${size.width}x${size.height}: marquee, screen and deck`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await startGame(page);
    const seen = await boxes(page);
    const fit = cabinetFor(size);
    const where = `${size.width}x${size.height}`;

    expect(seen.place, `the deck's place at ${where}`).toBe(fit.place);
    // The marquee: across the top, the supplied white logo as-is, and the content's words.
    expect(seen.marquee).toMatchObject({ x: 0, y: 0, width: size.width });
    expect(seen.logo).toBe('/brand/cyera-logo-white.svg');
    expect(seen.name).toBe(raw.ui.cabinet.marquee);
    // Integer scaling stays law, and the world is the camera the cabinet computed.
    expect(seen.zoom, `zoom at ${where}`).toBe(fit.zoom);
    expect(seen.scrollWidth, `no sideways scroll at ${where}`).toBeLessThanOrEqual(seen.width);

    // The screen is under the marquee and clear of the deck, which is drawn and in reach.
    expect(seen.frame!.y, 'the frame starts under the marquee').toBeGreaterThanOrEqual(
      seen.marquee!.height - 0.5,
    );
    expect(seen.stick, 'the joystick is drawn').not.toBeNull();
    expect(seen.a, 'the A button is drawn').not.toBeNull();
    for (const control of [seen.stick!, seen.a!])
      expect(overlaps(control, seen.canvas!), `a deck control covers the world at ${where}`).toBe(
        false,
      );
  });
}

test('the joystick walks with a mouse: a click steps, a hold walks until let go', async ({
  page,
}) => {
  await page.setViewportSize(REFERENCE_VIEWPORTS.desktop);
  await page.goto('/');
  await startGame(page);
  const stick = (await page.locator('.otp-stick').boundingBox())!;
  const right = { x: stick.x + stick.width - 10, y: stick.y + stick.height / 2 };

  // A click on the right arrow: one step, four tiles at most, and she stops by herself.
  const before = (await probe(page)).position.x;
  await page.mouse.click(right.x, right.y);
  await expect
    .poll(async () => (await probe(page)).position.x - before, { timeout: 15_000 })
    .toBeGreaterThan(STEP_PX / 2);
  let last = (await probe(page)).position.x;
  for (let i = 0; i < 60; i += 1) {
    await page.waitForTimeout(300);
    const now = (await probe(page)).position.x;
    if (now === last) break;
    last = now;
  }
  expect(last - before, 'a click is one step').toBeLessThanOrEqual(STEP_PX + 0.5);

  // A hold: walks while the button is down, and not a pixel after it comes up.
  await page.mouse.move(right.x, right.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await probe(page)).position.x - last, { timeout: 15_000 })
    .toBeGreaterThan(10);
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const released = (await probe(page)).position.x;
  await page.waitForTimeout(500);
  expect((await probe(page)).position.x).toBeCloseTo(released, 0);
});

test('A talks with a mouse, and opens the conversation before the card', async ({ page }) => {
  await page.setViewportSize(REFERENCE_VIEWPORTS.desktop);
  await page.goto('/');
  await startGame(page);
  await walkTo(page, await talkingDistance(page, 'npc-rabbit'));

  await page.locator('.otp-a-button').click();
  // One press opens the conversation; the card waits for Purple's "Show me".
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'talk');
  await expect(page.locator('[data-offer="rabbit"][data-talk] [data-action="ask"]')).toBeVisible();
  // In the offer A is idle: an answer is the player's, never a button mashed through.
  await expect(page.locator('.otp-a-button')).toBeDisabled();
});

/*
 * THE STICK FOLLOWS THE KEYS (the client, 2026-10-22: "if I click right, then I want the joystick
 * to move right"). Read off the knob's own transform, as the player sees it: which way it leans,
 * that a diagonal leans both ways, and that it stands up again on release.
 */
test('the joystick leans the way the arrow keys and WASD walk, and stands up on release', async ({
  page,
}) => {
  await page.setViewportSize(REFERENCE_VIEWPORTS.desktop);
  await page.goto('/');
  await startGame(page);
  const knob = page.locator('.otp-stick-knob');
  const lean = () =>
    knob.evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { x: m.m41, y: m.m42 };
    });
  await expect.poll(lean).toEqual({ x: 0, y: 0 });

  for (const [key, sx, sy] of [
    ['ArrowRight', 1, 0],
    ['ArrowLeft', -1, 0],
    ['KeyW', 0, -1],
    ['KeyS', 0, 1],
  ] as const) {
    await page.keyboard.down(key);
    const { x, y } = await lean();
    expect(Math.sign(Math.round(x)), `${key} x`).toBe(sx);
    expect(Math.sign(Math.round(y)), `${key} y`).toBe(sy);
    await page.keyboard.up(key);
    expect(await lean(), `${key} released`).toEqual({ x: 0, y: 0 });
  }

  // A diagonal leans both ways at once, and only as far as a straight press does.
  await page.keyboard.down('ArrowRight');
  const straight = await lean();
  await page.keyboard.down('ArrowDown');
  const diagonal = await lean();
  expect(diagonal.x).toBeGreaterThan(0);
  expect(diagonal.y).toBeGreaterThan(0);
  expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(straight.x, 0);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowDown');
  expect(await lean()).toEqual({ x: 0, y: 0 });

  // Less motion asked for: it still points, a shorter way.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.down('ArrowRight');
  const calm = await lean();
  await page.keyboard.up('ArrowRight');
  expect(calm.x).toBeGreaterThan(0);
  expect(calm.x).toBeLessThan(straight.x);
});

/** The elements painted Lime, by what they are. */
const limes = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--cyera-lime)';
    document.body.append(probe);
    const lime = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.backgroundColor === lime && el.getClientRects().length;
      })
      .map((el) => el.className);
  });

test('the deck spends the one Lime while you play, and only then', async ({ page }) => {
  await page.setViewportSize(REFERENCE_VIEWPORTS.desktop);
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  // Title: the way in is the Lime, and A is Lilac.
  expect(await limes(page)).toEqual(['otp-cta']);

  await startGame(page);
  expect(await limes(page)).toEqual(['otp-a-button']);

  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  expect(await limes(page)).toEqual(['otp-cta']);
  await expect(page.locator('.otp-a-button')).toBeDisabled();
});

test('the marquee glows, and holds still for a reader who asked for less motion', async ({
  page,
}) => {
  await page.goto('/');
  const moving = await page.evaluate(
    () => getComputedStyle(document.querySelector('.otp-marquee')!).animationName,
  );
  expect(moving).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const still = await page.evaluate(
    () => getComputedStyle(document.querySelector('.otp-marquee')!).animationName,
  );
  expect(still).toBe('none');
});
