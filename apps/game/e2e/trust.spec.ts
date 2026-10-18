import { expect, test } from '@playwright/test';
import { mapObject, probe, startGame, walkTo } from './helpers';

/*
 * Taking an offer on the offerer's word: saying yes from the conversation without ever opening
 * the card. It is the only path by which a skill starts running with nobody having read what it
 * asks for, and until it existed the reducer made that impossible to perform.
 */

const takeOnTrust = async (page: import('@playwright/test').Page, npc: string): Promise<void> => {
  const at = await mapObject(page, npc);
  await walkTo(page, { x: at.x + 8, y: at.y + 20 }, 20, 40_000);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /Take it as offered/ })).toBeVisible();
  await page.getByRole('button', { name: /Take it as offered/ }).click();
  await expect.poll(async () => (await probe(page)).phase).toBe('explore');
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('an offer can be taken without the card ever being opened', async ({ page }) => {
  await takeOnTrust(page, 'npc-rabbit');

  const after = await page.evaluate(() => {
    const s = window.__otp!.store.getState();
    return { verdict: s.verdicts['cottage-finder'], inspected: s.inspected };
  });
  expect(after.verdict).toBe('allow');
  expect(after.inspected, 'the card was never opened').toEqual([]);
  await expect(page.locator('.otp-toast')).toContainText(/take it as offered/i);
});

test('the way past the card is never the brightest thing on the screen', async ({ page }) => {
  const rabbit = await mapObject(page, 'npc-rabbit');
  await walkTo(page, { x: rabbit.x + 8, y: rabbit.y + 20 });
  await page.keyboard.press('Space');
  await expect(page.locator('.otp-dialogue__trust')).toBeVisible();

  const look = await page.evaluate(() => {
    const read = (sel: string) => {
      const cs = getComputedStyle(document.querySelector(sel)!);
      return { color: cs.color, size: parseFloat(cs.fontSize), bg: cs.backgroundColor };
    };
    return { show: read('.otp-dialogue__show'), trust: read('.otp-dialogue__trust') };
  });
  // The thing the game wants you to do stays larger, and the skip link carries no fill.
  expect(look.trust.size).toBeLessThan(look.show.size);
  expect(look.trust.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test('three quick yeses is the worst ending the game has', async ({ page }) => {
  test.slow();
  // Decide all three from the conversation. The world walk is covered elsewhere; this is about
  // what the rules do when nobody reads anything.
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const c of ['rabbit', 'owl', 'lantern-keeper'] as const) {
      store.dispatch({ type: 'MEET', c });
      const skill = {
        rabbit: 'cottage-finder',
        owl: 'word-weaver',
        'lantern-keeper': 'night-light',
      }[c];
      store.dispatch({ type: 'VERDICT', s: skill, v: 'allow' });
    }
  });

  const state = await page.evaluate(() => {
    const s = window.__otp!.store.getState();
    return { inspected: s.inspected, verdicts: s.verdicts, flags: s.flags };
  });
  expect(state.inspected, 'no card was opened all run').toEqual([]);
  expect(Object.keys(state.verdicts)).toHaveLength(3);
  expect(state.flags.length).toBeGreaterThan(1);
});

test('Results says which card was never opened', async ({ page }) => {
  await takeOnTrust(page, 'npc-rabbit');
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['owl', 'word-weaver', 'reject'],
      ['lantern-keeper', 'night-light', 'restrict'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  });

  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();

  const compass = page.locator('.otp-recap__row--skill', { hasText: /Cottage Finder/i });
  await expect(compass.locator('.otp-recap__trust')).toContainText(/never opened/i);
  // And the fine print it hid is shown anyway, which is the whole payoff.
  await expect(compass.locator('.otp-recap__hidden')).toBeVisible();
});
