import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TILE } from '../src/world/logic';
import { ready } from './helpers';

/*
 * THE DOOR ASKS FIRST (ui/DoorCheck.tsx). The client, 2026-10-22, finished a run with the Cat's
 * Latch Lifter marked "You walked past": the doorstep ended the run at once, and the Cat stands
 * beside the door lane. Now, with anybody unmet, walking onto the step asks; Keep looking (the
 * default) puts Purple a step back and Go in enters as before. With everyone met it does not ask.
 * The clock runs throughout.
 *
 * Purple WALKS onto the step here, with the real keys, from the lane below it -- the step back is
 * "the way she came", and a placement straight onto the trigger would not have come any way at all.
 */

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { characters: { id: string; name: string }[]; ui: { chrome: Record<string, string> } };
const say = (key: string): string => raw.ui.chrome[key]!;

async function intoTheForest(page: Page): Promise<void> {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  await page.getByRole('button', { name: 'Start walking' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
}

/** The trigger, from the map the scene loaded. */
const door = (page: Page) =>
  page.evaluate(() => window.__otp!.mapObjects!.find((m) => m.name === 'trigger-cottage')!);

/** Purple on the lane one row below the step, in the door's column, then walking up onto it. */
async function walkUpToTheDoor(page: Page): Promise<void> {
  const d = await door(page);
  await page.evaluate(
    ([x, y]) => {
      const otp = window.__otp!;
      otp.scene!.position = { x: x!, y: y! };
      otp.scene!.placePurple();
    },
    [d.x + d.width / 2, d.y + d.height + TILE * 0.75] as const,
  );
  // A frame on the lane, so the scene has seen her stand outside the step.
  await page.waitForTimeout(100);
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('[data-door], [data-arrive]').first()).toBeVisible();
  await page.keyboard.up('ArrowUp');
}

const purple = (page: Page) => page.evaluate(() => window.__otp!.scene!.purplePosition);
const phase = (page: Page) => page.evaluate(() => window.__otp!.store.getState().phase);

/** Meets everyone and walks on from each, so the whole cast is met and nothing is answered. */
async function meetEveryone(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { store, content } = window.__otp!;
    for (const c of content.characters) {
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'BACK' });
      store.dispatch({ type: 'BACK' });
    }
  });
  expect(await phase(page)).toBe('forest');
}

test('with somebody unmet the door asks, names them, and Keep looking is the default', async ({
  page,
}) => {
  await intoTheForest(page);
  // Meet one, so the question counts the rest.
  const first = raw.characters[0]!;
  await page.evaluate((id) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: id });
    store.dispatch({ type: 'BACK' });
    store.dispatch({ type: 'BACK' });
  }, first.id);
  await walkUpToTheDoor(page);

  const ask = page.locator('[data-door="ask"]');
  await expect(ask).toBeVisible();
  await expect(ask).toHaveAttribute('role', 'dialog');
  await expect(ask).toHaveAttribute('aria-modal', 'true');
  const unmet = raw.characters.slice(1);
  await expect(ask.locator('#otp-door-ask')).toHaveText(
    say('doorAsk')
      .replace('{count}', String(unmet.length))
      .replace('{total}', String(raw.characters.length)),
  );
  await expect(ask).toHaveAccessibleName(/haven't met/);
  await expect(ask.locator('[data-door-unmet] li')).toHaveText(unmet.map((c) => c.name));
  // Still in the forest: the run has not ended, and nothing was logged as an arrival.
  expect(await phase(page)).toBe('forest');
  expect(
    await page.evaluate(() => window.__otp!.store.getState().log.some((e) => e.e === 'arrived')),
  ).toBe(false);

  const stay = ask.locator('[data-action="keep-looking"]');
  await expect(stay).toBeFocused();
  await expect(stay).toHaveText(say('doorStay'));
  // The trap holds: Tab goes to Go in and comes back round, never out to the world behind.
  await page.keyboard.press('Tab');
  await expect(ask.locator('[data-action="go-in"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(stay).toBeFocused();
});

test('the walk pauses while the door asks, and the clock does not', async ({ page }) => {
  await intoTheForest(page);
  await walkUpToTheDoor(page);
  await expect(page.locator('[data-door="ask"]')).toBeVisible();
  const before = await purple(page);
  const t0 = await page.evaluate(() => window.__otp!.store.elapsed());
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft');
  expect(await purple(page), 'Purple walked under the question').toEqual(before);
  const t1 = await page.evaluate(() => window.__otp!.store.elapsed());
  expect(t1 - t0, 'the clock stopped while the door asked').toBeGreaterThanOrEqual(500);
});

test('Keep looking puts Purple a step back off the step, and the door asks again next time', async ({
  page,
}) => {
  await intoTheForest(page);
  await walkUpToTheDoor(page);
  // A keyboard player cannot press Enter on Keep looking before it has focus either; waiting for
  // it closes a race where the Enter landed before the panel took focus (flaked under load).
  await expect(page.locator('[data-action="keep-looking"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-door]')).toHaveCount(0);
  expect(await phase(page)).toBe('forest');

  const d = await door(page);
  const at = await purple(page);
  const onStep = (p: { x: number; y: number }) =>
    p.x >= d.x && p.x < d.x + d.width && p.y >= d.y && p.y < d.y + d.height;
  expect(onStep(at), `Purple is still on the step at ${at.x},${at.y}`).toBe(false);
  // Back the way she came: below the step, in its column.
  expect(at.y).toBeGreaterThanOrEqual(d.y + d.height);

  // She can walk again, and walking back up asks again rather than letting her in.
  await walkUpToTheDoor(page);
  await expect(page.locator('[data-door="ask"]')).toBeVisible();
  // Esc is Keep looking too -- once the panel holds focus, as a keyboard player's Esc would
  // (the same race as the Enter above; it flaked on CI's runner, 2026-10-22).
  await expect(page.locator('[data-action="keep-looking"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-door]')).toHaveCount(0);
  expect(onStep(await purple(page))).toBe(false);
  expect(await phase(page)).toBe('forest');
});

test('Go in enters exactly as the door always did', async ({ page }) => {
  await intoTheForest(page);
  await walkUpToTheDoor(page);
  await page.locator('[data-door] [data-action="go-in"]').click();
  await expect(page.locator('[data-arrive]')).toBeVisible();
  expect(await phase(page)).toBe('cottage');
});

test('with everyone met the door opens without asking', async ({ page }) => {
  await intoTheForest(page);
  await meetEveryone(page);
  await walkUpToTheDoor(page);
  await expect(page.locator('[data-arrive]')).toBeVisible();
  await expect(page.locator('[data-door]')).toHaveCount(0);
});

test('the clock running out while the door asks ends the run late, and the question goes', async ({
  page,
}) => {
  await intoTheForest(page);
  await walkUpToTheDoor(page);
  await expect(page.locator('[data-door="ask"]')).toBeVisible();
  await page.evaluate(() => window.__otp!.testClock.advance(180_000));
  await expect(page.locator('[data-arrive="late"]')).toBeVisible();
  await expect(page.locator('[data-door]')).toHaveCount(0);
});
