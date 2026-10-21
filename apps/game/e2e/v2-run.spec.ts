import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TILE } from '../src/world/logic';

/*
 * v2 PHASE C IN THE REAL FOREST, behind the dev/e2e switch (`?otp-v2`, world/v2-wiring.tsx).
 *
 * Through the page rather than through the reducer's own suite: every run is DEALT -- a seed picks
 * which three of the seven are honest -- and `?otp-v2-seed=N` pins it so a spec knows the hand it
 * is walking. Two pinned seeds give two different deals, and the same character's card changes
 * with them; the seven are met in walking order and take and leave both land in the v2 reducer;
 * the careful run scores 100 and a greedy one lets the wolf in; and the clock override ends a run
 * late through the game's own timer.
 *
 * Purple is PLACED beside each character, in walking order, rather than walked there. The walk
 * itself is what world-reach.spec.ts and core's tour test (packages/core/test/v2/real-content)
 * cover, and seven 10-to-20-tile walks per run would make this the slowest spec in the suite for
 * nothing it does not already know.
 */

interface V2Handle {
  v2: {
    getState(): {
      phase: string;
      seed: number;
      good: string[];
      active: string | null;
      basket: { s: string; v: string }[];
      verdicts: Record<string, string>;
      log: { e: string }[];
    };
  };
  content: {
    characters: { id: string; spawn: string; skillId: string }[];
    skills: { id: string; good: { card: { take: string[] } }; bad: { card: { take: string[] } } }[];
  };
  v2Clock: { advance(ms: number): void };
  scene?: { position: { x: number; y: number }; placePurple(): void };
  mapObjects?: { name: string; x: number; y: number; width: number; height: number }[];
}

const WALKING_ORDER = ['rabbit', 'toadstool', 'owl', 'magpie', 'snail', 'lantern-keeper', 'cat'];

const handle = (page: Page) =>
  page.evaluate(() => {
    const otp = (window as unknown as { __otp: V2Handle }).__otp;
    return { state: otp.v2.getState(), cast: otp.content.characters, skills: otp.content.skills };
  });

async function openV2(page: Page, seed: number): Promise<void> {
  await page.goto(`/?otp-v2&otp-v2-seed=${seed}`);
  await page.waitForSelector('#game[data-ready="true"][data-phase="forest"]');
}

/** Puts Purple's feet at a character's own anchor (their tile's bottom edge), well inside reach. */
async function standBeside(page: Page, spawn: string): Promise<void> {
  await page.evaluate(
    ([name, tile]) => {
      const otp = (window as unknown as { __otp: V2Handle }).__otp;
      const o = otp.mapObjects!.find((m) => m.name === name)!;
      otp.scene!.position = { x: o.x + tile / 2, y: o.y + tile };
      otp.scene!.placePurple();
    },
    [spawn, TILE] as const,
  );
}

async function walkIntoCottage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const otp = (window as unknown as { __otp: V2Handle }).__otp;
    const door = otp.mapObjects!.find((m) => m.name === 'trigger-cottage')!;
    otp.scene!.position = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
    otp.scene!.placePurple();
  });
}

/**
 * Meets the seven in walking order and answers each with `choose`. Every other offer has its card
 * opened first, so both routes to a verdict -- from the conversation and from the card -- are used.
 * Returns the card lines each opened card showed.
 */
async function walkTheCast(
  page: Page,
  choose: (skillId: string, good: boolean) => 'take' | 'leave',
): Promise<Record<string, string[]>> {
  const { state, cast } = await handle(page);
  expect(cast.map((c) => c.id)).toEqual(WALKING_ORDER);
  const shown: Record<string, string[]> = {};
  for (const [i, c] of cast.entries()) {
    await standBeside(page, c.spawn);
    await page.keyboard.press('e');
    const offer = page.locator(`[data-v2-offer="${c.id}"]`);
    await expect(offer, `${c.id} opens their own offer`).toBeVisible();
    if (i % 2 === 0) {
      await offer.locator('[data-v2="inspect"]').click();
      const card = page.locator(`[data-v2-card="${c.skillId}"] li`);
      await expect(card.first()).toBeVisible();
      shown[c.skillId] = await card.allTextContents();
    }
    await offer.locator(`[data-v2="${choose(c.skillId, state.good.includes(c.skillId))}"]`).click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  }
  return shown;
}

test('two pinned seeds deal two different hands, and the card shows the hand dealt', async ({
  page,
}) => {
  await openV2(page, 0);
  const first = await handle(page);
  await openV2(page, 34);
  const second = await handle(page);

  expect(first.state.seed).toBe(0);
  expect(second.state.seed).toBe(34);
  expect(first.state.good).toHaveLength(3);
  expect(second.state.good).toHaveLength(3);
  expect(second.state.good, 'seed 34 deals the same three as seed 0').not.toEqual(first.state.good);

  // A skill honest in one deal and dealt bad in the other: the card opened under each says so.
  const turned = first.state.good.find((id) => !second.state.good.includes(id))!;
  const owner = second.cast.find((c) => c.skillId === turned)!;
  const skill = second.skills.find((s) => s.id === turned)!;
  const read = async (seed: number): Promise<string[]> => {
    await openV2(page, seed);
    await standBeside(page, owner.spawn);
    await page.keyboard.press('e');
    await page.locator(`[data-v2-offer="${owner.id}"] [data-v2="inspect"]`).click();
    return page.locator(`[data-v2-card="${turned}"] li`).allTextContents();
  };
  expect(await read(0)).toEqual(skill.good.card.take);
  expect(await read(34)).toEqual(skill.bad.card.take);
  expect(skill.bad.card.take).not.toEqual(skill.good.card.take);
});

test('the careful run: met in walking order, the three good taken, the four bad left, 100', async ({
  page,
}) => {
  test.slow();
  await openV2(page, 0);
  await walkTheCast(page, (_id, good) => (good ? 'take' : 'leave'));

  const { state } = await handle(page);
  expect(Object.keys(state.verdicts)).toHaveLength(7);
  expect(state.basket.map((b) => b.s).sort()).toEqual([...state.good].sort());
  expect(Object.values(state.verdicts).filter((v) => v === 'leave')).toHaveLength(4);
  // The HUD shows the basket the reducer holds.
  await expect(page.locator('.otp-hud2')).toBeVisible();

  // A decided character no longer offers.
  await standBeside(page, 'npc-rabbit');
  await page.keyboard.press('e');
  await expect(page.locator('[data-v2-offer]')).toHaveCount(0);

  await walkIntoCottage(page);
  await expect(page.locator('[data-v2-ended="grandma"]')).toBeVisible();
  await expect(page.locator('[data-v2-score]')).toHaveAttribute('data-v2-score', '100');
  expect((await handle(page)).state.log.at(-1)?.e).toBe('arrived');
});

test('the greedy run takes everything and lets the wolf in', async ({ page }) => {
  test.slow();
  await openV2(page, 34);
  await walkTheCast(page, () => 'take');
  expect((await handle(page)).state.basket).toHaveLength(7);
  await walkIntoCottage(page);
  await expect(page.locator('[data-v2-ended="wolf"]')).toBeVisible();
  await expect(page.locator('[data-v2-score]')).toHaveAttribute('data-v2-score', '0');
});

test('the clock override ends a run late through the game timer', async ({ page }) => {
  await openV2(page, 7);
  await expect(page.locator('.otp-hud2__clock')).toHaveText(/^(3:00|2:5\d)$/);
  await page.evaluate(() =>
    (window as unknown as { __otp: V2Handle }).__otp.v2Clock.advance(180_000),
  );
  await expect(page.locator('[data-v2-ended="late"]')).toBeVisible();
  await expect(page.locator('.otp-hud2__clock')).toHaveText('0:00');
  const { state } = await handle(page);
  expect(state.phase).toBe('late');
  expect(state.log.at(-1)?.e).toBe('late');
});
