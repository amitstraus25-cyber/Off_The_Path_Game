/*
 * The pad's two input paths, as a player meets them.
 *
 * Both defects these guard were invisible to the suite that existed, and in the same way: every
 * test of these controls reached them with `.click()`, which is an activation with no device
 * behind it -- and a pointer click is the one gesture neither defect lives in. So the tests below
 * use the real thing, a touch sequence through CDP and a key press, and assert what the player
 * ends up with rather than which listeners are attached.
 */
import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { TAP_PX } from '../src/ui/touch-controls';
import { probe, startGame } from './helpers';

/**
 * Parks Purple where a named map object can be talked to, without walking there.
 *
 * `walkTo` is the honest route and several specs take it; it costs seconds per encounter, and
 * neither defect here is about walking. The offsets are the ones `talkingDistance` derives: half a
 * tile across to the centre of the spawn tile, a tile and a bit down to where her feet stand.
 */
async function standAt(page: Page, object: string): Promise<void> {
  const ok = await page.evaluate((name) => {
    const otp = window.__otp as unknown as {
      scene?: { position?: { x: number; y: number } };
      mapObjects?: { name: string; x: number; y: number }[];
    };
    const spot = otp.mapObjects?.find((o) => o.name === name);
    if (!spot || !otp.scene) return false;
    otp.scene.position = { x: spot.x + 16, y: spot.y + 40 };
    return true;
  }, object);
  expect(ok, `the map has no "${object}", or this is not a VITE_E2E build`).toBe(true);
  await page.waitForTimeout(120);
}

/**
 * The character with the most to say, and where to stand to hear it.
 *
 * Taken from the shipped content rather than named, because the two tests below watch a line being
 * typed and the shortest greeting in the file is the one most likely to finish before they look.
 * Rewording the forest cannot redden them (CLAUDE.md rule 3), and whoever writes the longest line
 * is whoever gives them the most room.
 */
async function mostTalkative(page: Page): Promise<string> {
  const spawn = await page.evaluate(() => {
    const content = (window.__otp as unknown as { content: { characters: Character[] } }).content;
    const longest = [...content.characters].sort((a, b) => b.greet.length - a.greet.length)[0];
    return longest?.spawn ?? null;
  });
  expect(spawn, 'no character in the content file has a greeting').not.toBeNull();
  return spawn!;
}

interface Character {
  greet: string;
  spawn: string;
}

/** A real tap: touch-down, a thumb's worth of hold, touch-up. */
async function tap(page: Page, cdp: CDPSession, selector: string, holdMs = 120): Promise<void> {
  const box = (await page.locator(selector).boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/* ----------------------------------------------------------- the tap that did two things at once */

test.describe('one tap of A is one press and nothing else', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test('a tap of A raises no click of its own, wherever the pad has gone', async ({
    page,
    context,
  }) => {
    // The mechanism, once, so a later reader need not infer it from the beat above.
    await page.goto('/');
    await startGame(page);
    await standAt(page, await mostTalkative(page));
    await page.evaluate(() => {
      (window as unknown as { __clicks: number }).__clicks = 0;
      window.addEventListener(
        'click',
        () => void (window as unknown as { __clicks: number }).__clicks++,
        true,
      );
    });

    const cdp = await context.newCDPSession(page);
    await tap(page, cdp, '.otp-a-button');
    await page.waitForFunction(() => window.__otp!.store.getState().phase === 'talk');
    // A dozen frames: long enough that a click which was going to be synthesised has been.
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks),
      'the tap left a stray click loose in the panel that replaced the pad',
    ).toBe(0);
  });
});

/* ------------------------------------------------------ a tap on the stick is a nudge, not a run */

test.describe('a finger tapping the stick nudges Purple a tile and stops', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  // The client, 2026-10-26: on the phone "if I just touch the direction Purple starts walking
  // without stopping". A tap was a four-tile step, a second of walking; it is one tile now.
  test('one tap on the right arrow walks her right, one tile at most', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await startGame(page);
    const box = (await page.locator('.otp-stick').boundingBox())!;
    const point = { x: box.x + box.width - 8, y: box.y + box.height / 2 };
    const before = (await probe(page)).position.x;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(async () => (await probe(page)).position.x - before).toBeGreaterThan(0);
    let last = (await probe(page)).position.x;
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(200);
      const now = (await probe(page)).position.x;
      if (now === last) break;
      last = now;
    }
    // A tile, plus the few pixels the stick walked while the finger was down (about 10 in 80ms):
    // two tiles is the bound, and the four-tile step this replaced is twice that.
    expect(last - before, 'a tap is a nudge, not a step').toBeLessThanOrEqual(2 * TAP_PX);
  });
});

/* -------------------------------------------------------- the five controls the keyboard owned */

/*
 * Far enough from the 0.0px the defect measured to be a walk, and nowhere near the distance one
 * press actually covers: this asks whether she went somewhere, not how far a step is. Retuning the
 * step must not redden these; shortening it to nothing must.
 */
const AWAY = 20;

test('the walk buttons answer the keys that activate them', async ({ page }) => {
  /*
   * `world/input.ts` takes `keydown` on the window and cancels Space and Enter whenever the world
   * owns input, which on Explore it always does. A button's activation is a DEFAULT ACTION, so
   * that cancelled these five as well: focused, both keys, all five, 0 click events and Purple moved
   * 0.0px, while a pointer click on the same button moved her 78px. They are the only controls a
   * player without sight has on a desktop, and the only input that can reach them could not work
   * them.
   *
   * `ui.spec.ts` already presses one of these -- with `.click()`, the one activation the window
   * listener never had the chance to cancel, which is why it passed throughout.
   */
  await page.goto('/');
  await startGame(page);
  const walk = page.locator('.otp-touch [role="group"] button');
  const count = await walk.count();
  expect(count, 'the walk group is not in the document at all').toBeGreaterThan(0);

  for (const key of ['Space', 'Enter']) {
    for (let i = 0; i < count; i++) {
      const button = walk.nth(i);
      const name = (await button.textContent())!.trim();
      await button.focus();
      const before = (await probe(page)).position;
      await page.keyboard.press(key);
      const moved = async (): Promise<number> => {
        const after = (await probe(page)).position;
        return Math.hypot(after.x - before.x, after.y - before.y);
      };
      // Stop is last in the group, and the one control whose success looks like standing still.
      if (i === count - 1) {
        await page.waitForTimeout(600);
        expect(await moved(), `"${name}" walked her off on ${key}`).toBeLessThan(AWAY);
      } else {
        /*
         * Polled, not read once after a fixed 600ms: the walk is owed as DISTANCE and a starved
         * runner pays it off slowly (measured 5.8px in 600ms under load, then 128px on the retry),
         * and what this asks is whether the press walked at all.
         */
        await expect
          .poll(moved, { message: `"${name}" did nothing at all on ${key}`, timeout: 5_000 })
          .toBeGreaterThan(AWAY);
      }
    }
  }
});

test('holding those two back holds nothing else back', async ({ page }) => {
  /*
   * The other half of the same guard, and the worse bug it could turn into. The remedy is to stop
   * Space and Enter reaching the window; a guard that stopped everything would leave a player
   * focused on a walk button unable to walk away from it or to close a panel -- and would pass the
   * test above without a murmur. So this asks what the window can still hear from a focused walk
   * button, and then that an arrow pressed there still walks her.
   */
  await page.goto('/');
  await startGame(page);
  const walk = page.locator('.otp-touch [role="group"] button');
  await walk.first().focus();

  await page.evaluate(() => {
    (window as unknown as { __heard: string[] }).__heard = [];
    window.addEventListener('keydown', (e) =>
      (window as unknown as { __heard: string[] }).__heard.push(e.key),
    );
  });
  for (const key of ['Space', 'Enter', 'ArrowRight', 'Escape']) await page.keyboard.press(key);
  const heard = await page.evaluate(() => (window as unknown as { __heard: string[] }).__heard);
  expect(heard, 'an activation key reached the window, where it will be cancelled').not.toContain(
    ' ',
  );
  expect(heard, 'an activation key reached the window, where it will be cancelled').not.toContain(
    'Enter',
  );
  expect(heard, 'the arrows no longer reach the world from a focused walk button').toContain(
    'ArrowRight',
  );
  expect(heard, 'Escape no longer reaches the world from a focused walk button').toContain(
    'Escape',
  );

  // And an arrow pressed there does the thing reaching the world is for.
  await walk.first().focus();
  const before = (await probe(page)).position;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(80);
  const after = (await probe(page)).position;
  expect(
    Math.hypot(after.x - before.x, after.y - before.y),
    'an arrow key pressed on a focused walk button no longer walks her',
  ).toBeGreaterThan(AWAY);
});
