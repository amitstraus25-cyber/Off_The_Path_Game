import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TILE } from '../src/world/logic';
import { ready, tag, tagOf } from './helpers';

/*
 * THE MINIMAP, in the real game (ui/Minimap.tsx, world/minimap.ts). The client, 2026-10-22: "how do
 * i get to this? i cant find the character.. lets add a little mini map on the top rite".
 *
 * What a browser has to say and a unit test cannot: that it stands in the world's top right and
 * covers none of the clock, the basket, the controls hint or the touch pad at any size the game is
 * played at; that it is drawn at a whole number of CSS pixels per tile; that a dot fills when its
 * character is met and says nothing else; that a screen reader hears one sentence, mutated in place,
 * and not Purple's every step. Every measurement first proves the thing it measures is on screen
 * (PAUL_BRIEF trap 6).
 */

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as {
  characters: { id: string; skillId: string }[];
  skills: { id: string; effect: { kind: string } }[];
  ui: { chrome: Record<string, string> };
};
/*
 * THE MINIMAP IS THE WOOD MAP'S (the client, 2026-10-22): nobody has it until a skill with the
 * `minimap` effect is taken, so every test here takes it first. Its giver is met by the take.
 */
const mapGiver = raw.characters.find(
  (c) => raw.skills.find((s) => s.id === c.skillId)?.effect.kind === 'minimap',
)!;
/** The cast other than the map's giver, who is met by the time the map is drawn. */
const others = raw.characters.filter((c) => c.id !== mapGiver.id);
const summary = (met: number): string =>
  raw.ui.chrome['mapSummary']!.replace('{met}', String(met)).replace(
    '{total}',
    String(raw.characters.length),
  );

type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box): boolean =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
const inside = (a: Box, b: Box): boolean =>
  a.x >= b.x - 0.5 &&
  a.y >= b.y - 0.5 &&
  a.x + a.width <= b.x + b.width + 0.5 &&
  a.y + a.height <= b.y + b.height + 0.5;

async function intoTheForest(page: Page): Promise<void> {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  await page.getByRole('button', { name: 'Start walking' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  await expect(page.locator('[data-minimap]')).toHaveCount(0);
  await page.evaluate(
    ({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'VERDICT', s, v: 'take' });
    },
    { c: mapGiver.id, s: mapGiver.skillId },
  );
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  await expect(page.locator('[data-minimap]')).toBeVisible();
}

const SIZES = [
  { width: 375, height: 812, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1280, height: 800, touch: false },
  { width: 844, height: 390, touch: true },
  // The one layout whose deck stands INSIDE the world (ui/cabinet.ts `overlay`).
  { width: 568, height: 320, touch: true },
  // A narrow window with a mouse: the controls hint is shown, and must stop short of the map.
  { width: 375, height: 812, touch: false },
] as const;

async function pageAt(browser: Browser, v: (typeof SIZES)[number]): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    hasTouch: v.touch,
    isMobile: v.touch,
  });
  return context.newPage();
}

for (const v of SIZES) {
  test(`at ${v.width}x${v.height}${v.touch ? ' (touch)' : ''} the minimap covers nothing`, async ({
    browser,
  }) => {
    const page = await pageAt(browser, v);
    await intoTheForest(page);
    const map = (await page.locator('.otp-minimap').boundingBox())!;
    const world = (await page.locator('.otp-world-anchor').boundingBox())!;
    expect(map.width, 'the minimap has a size').toBeGreaterThan(40);
    expect(inside(map, world), 'the minimap stands inside the world box').toBe(true);
    // Top right: its right edge in the world's right half, its top in the world's top third.
    expect(map.x + map.width).toBeGreaterThan(world.x + world.width / 2);
    expect(map.y).toBeLessThan(world.y + world.height / 3);
    // On screen, whole.
    expect(map.x + map.width).toBeLessThanOrEqual(v.width + 0.5);

    const others = ['.otp-hud2__timer', '.otp-hud2__basket', '.otp-world-hint'];
    if (v.touch) others.push('.otp-stick', '.otp-a-button');
    let measured = 0;
    for (const selector of others) {
      const other = page.locator(selector).first();
      if (!(await other.isVisible())) continue;
      measured++;
      const box = (await other.boundingBox())!;
      expect(apart(map, box), `the minimap covers ${selector}`).toBe(true);
    }
    // The clock and the basket are always there; the check is not allowed to pass on nothing.
    expect(measured).toBeGreaterThanOrEqual(2);
    if (v.touch) await expect(page.locator('.otp-stick')).toBeVisible();
    await page.context().close();
  });
}

test('the map is drawn at a whole number of CSS pixels per tile', async ({ browser }) => {
  const scales: Record<string, number> = {};
  for (const v of [SIZES[0], SIZES[2], SIZES[3]]) {
    const page = await pageAt(browser, v);
    await intoTheForest(page);
    const { width, height, cols, rows } = await page
      .locator('.otp-minimap__map')
      .evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        const [, , cols, rows] = svg.getAttribute('viewBox')!.split(' ').map(Number);
        return { width: box.width, height: box.height, cols: cols!, rows: rows! };
      });
    const perTile = width / cols;
    expect(Number.isInteger(perTile), `${perTile}px a tile at ${v.width}`).toBe(true);
    expect(height / rows, `square tiles at ${v.width}`).toBe(perTile);
    expect(perTile).toBeGreaterThanOrEqual(1);
    scales[`${v.width}x${v.height}`] = perTile;
    // Its left edge on a whole pixel too, so the squares are not smeared across two.
    const left = await page.locator('.otp-minimap__map').evaluate((svg) => {
      const x = svg.getBoundingClientRect().x * devicePixelRatio;
      return Math.abs(x - Math.round(x));
    });
    expect(left).toBeLessThan(0.01);
    await page.context().close();
  }
  // Smaller on the narrow phone and in short landscape than on the desktop (the review's minors).
  expect(scales['375x812']).toBeLessThan(scales['1280x800']!);
  expect(scales['844x390']).toBeLessThan(scales['1280x800']!);
});

test('the map steps back whenever a character is under it, so it never hides one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await intoTheForest(page);
  const map = page.locator('[data-minimap]');
  await expect(map).toHaveAttribute('data-yield', 'false');
  // Stand Purple so a character is drawn under the map's box: the map's own centre, in world
  // pixels, is a character's position less what the camera shows at that corner.
  const placed = await page.evaluate(() => {
    const otp = window.__otp!;
    const s = otp.scene as unknown as {
      npcs: { x: number; y: number }[];
      position: { x: number; y: number };
      placePurple(): void;
      cameras: { main: { scrollX: number; scrollY: number; x: number; y: number } };
      canvasWidth: number;
      map: { widthInPixels: number; heightInPixels: number };
    };
    const box = document.querySelector('[data-minimap]')!.getBoundingClientRect();
    const world = document.querySelector('.otp-world-anchor')!.getBoundingClientRect();
    const zoom = world.width / s.canvasWidth;
    // Where the map's centre is on the canvas, and how far that is from the camera's centre.
    const mx = (box.left + box.width / 2 - world.left) / zoom;
    const my = (box.top + box.height / 2 - world.top) / zoom;
    const cx = world.width / zoom / 2;
    const cy = world.height / zoom / 2;
    // The figure nearest the middle of the map, so the camera is not pinned against an edge.
    const mid = { x: s.map.widthInPixels / 2, y: s.map.heightInPixels / 2 };
    const who = [...s.npcs].sort(
      (a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y),
    )[0]!;
    s.position = { x: who.x - (mx - cx), y: who.y - 24 - (my - cy) + 20 };
    s.placePurple();
    return true;
  });
  expect(placed).toBe(true);
  await expect(map).toHaveAttribute('data-yield', 'true', { timeout: 4000 });
  expect(Number(await map.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
});

test('nobody has the minimap until the Wood Map is taken', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  await page.getByRole('button', { name: 'Start walking' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  await page.waitForTimeout(300);
  await expect(page.locator('[data-minimap]')).toHaveCount(0);
  // Leaving it gives nothing either.
  await page.evaluate(
    ({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'VERDICT', s, v: 'leave' });
    },
    { c: mapGiver.id, s: mapGiver.skillId },
  );
  await page.waitForTimeout(300);
  await expect(page.locator('[data-minimap]')).toHaveCount(0);
});

test('a dot fills once its character is met, and says nothing about the skill', async ({
  page,
}) => {
  await intoTheForest(page);
  const dots = page.locator('.otp-minimap__who');
  await expect(dots).toHaveCount(raw.characters.length);
  // Only the map's giver, met by the take that drew it.
  await expect(page.locator('.otp-minimap__who[data-met="true"]')).toHaveCount(1);
  await expect(page.locator('[data-minimap-cottage]')).toHaveCount(1);

  // Nothing on a dot but where it is and whether they are met: no skill, no good, no bad.
  const attributes = await dots.evaluateAll((all) =>
    all.map((d) => d.getAttributeNames().sort().join(' ')),
  );
  for (const names of attributes) expect(names).toBe('class cx cy data-met data-who r');
  const markup = await page.locator('.otp-minimap').evaluate((m) => m.outerHTML);
  expect(markup).not.toMatch(/good|bad|skill|safe|unsafe/i);

  const [first, second] = others.slice(0, 2).map((c) => c.id);
  const fill = (id: string) =>
    page.locator(`.otp-minimap__who[data-who="${id}"]`).evaluate((d) => getComputedStyle(d).fill);
  const unmetFill = await fill(first!);

  await page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), first!);
  await expect(page.locator(`.otp-minimap__who[data-who="${first}"]`)).toHaveAttribute(
    'data-met',
    'true',
  );
  await expect(page.locator(`.otp-minimap__who[data-who="${second}"]`)).toHaveAttribute(
    'data-met',
    'false',
  );
  // Filled is a different fill, not the same dot under another name.
  await expect.poll(() => fill(first!)).not.toBe(unmetFill);
});

test('a screen reader hears one sentence, changed only when somebody new is met', async ({
  page,
}) => {
  await intoTheForest(page);
  const region = page.locator('.otp-minimap [role="status"]');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await expect(region).toHaveText(summary(1));
  await expect(page.locator('.otp-minimap__map')).toHaveAttribute('aria-hidden', 'true');
  await tag(page, '.otp-minimap [role="status"]', 'map');

  // Counting mutations while Purple walks: none. Her position is never spoken.
  await region.evaluate((el) => {
    const w = window as unknown as { __mapMutations: number };
    w.__mapMutations = 0;
    new MutationObserver((list) => (w.__mapMutations += list.length)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  expect(
    await page.evaluate(() => (window as unknown as { __mapMutations: number }).__mapMutations),
    'the summary changed while Purple only walked',
  ).toBe(0);

  const first = others[0]!.id;
  await page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), first);
  await expect(region).toHaveText(summary(2));
  expect(await tagOf(page, '.otp-minimap [role="status"]'), 'mutated, not remounted').toBe('map');
});

test("Purple's marker follows her, in whole pixels", async ({ page }) => {
  await intoTheForest(page);
  const marker = page.locator('[data-minimap-purple]');
  await expect(marker).toHaveAttribute('visibility', 'visible');
  const at = () =>
    marker.evaluate((g) => {
      const [x, y] = g
        .getAttribute('transform')!
        .match(/-?[\d.]+/g)!
        .map(Number);
      return { x: x!, y: y! };
    });
  const start = await at();
  const feet = await page.evaluate(() => window.__otp!.scene!.purplePosition);
  // The marker is where she is, to within a pixel of the minimap.
  expect(Math.abs(start.x - feet.x / TILE)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(start.y - feet.y / TILE)).toBeLessThanOrEqual(0.5);

  // Put her by the cottage and the marker goes with her.
  await page.evaluate(() => {
    const otp = window.__otp!;
    const lantern = otp.mapObjects!.find((m) => m.name === 'npc-lantern-keeper')!;
    otp.scene!.position = { x: lantern.x - 32, y: lantern.y + 32 };
    otp.scene!.placePurple();
  });
  await expect.poll(async () => (await at()).x).toBeGreaterThan(start.x + 10);
  const perTile = await page
    .locator('.otp-minimap__map')
    .evaluate(
      (svg) =>
        svg.getBoundingClientRect().width / Number(svg.getAttribute('viewBox')!.split(' ')[2]),
    );
  const moved = await at();
  // Whole CSS pixels: the position times the scale is an integer.
  expect(Math.abs(moved.x * perTile - Math.round(moved.x * perTile))).toBeLessThan(1e-6);
});

test('under reduced motion the dots fill without a fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await intoTheForest(page);
  const duration = await page
    .locator('.otp-minimap__who')
    .first()
    .evaluate((d) => getComputedStyle(d).transitionDuration);
  expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
});

test('the minimap leaves with the forest', async ({ page }) => {
  await intoTheForest(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  await expect(page.locator('[data-arrive]')).toBeVisible();
  await expect(page.locator('[data-minimap]')).toHaveCount(0);
});
