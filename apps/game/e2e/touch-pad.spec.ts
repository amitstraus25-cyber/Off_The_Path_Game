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

/**
 * Long enough that the ghost click has had every chance to land, and nowhere near long enough for
 * the line to have finished.
 *
 * The click was measured arriving one to two milliseconds after `pointerup`, which is about 130ms
 * after the panel appears; the shortest greeting in the file takes several times this to type at
 * the shipped speed. Deliberately not derived from that speed: a settle written as a fraction of
 * `TYPE_SPEED` would move whenever the typewriter was retuned and would stop watching the thing it
 * is here for.
 */
const SETTLED_MS = 300;

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

  test('the greeting still types out when the panel was opened by a thumb', async ({
    page,
    context,
  }) => {
    /*
     * Chromium synthesises a compatibility `click` from a single-touch gesture a millisecond or
     * two after `pointerup`, and by then `main.ts` has hidden the pad -- so the click retargets
     * onto the panel that took its place. It hits no control there (576 combinations of viewport,
     * character and question state were swept, and the A button's centre is over an actionable
     * control in none of them), but the modal layer fast-forwards the line being typed on a click
     * ANYWHERE inside it, so it never needed to. Before `ui/touch-controls.ts` cancelled
     * `touchend`, eighteen taps out of eighteen found the greeting already finished 120ms in; the
     * same interact from the keyboard, twelve out of twelve, found it still typing.
     *
     * Asserted as the beat the player is owed, and not as a count of listeners: the panel opens
     * and the line is still being typed, with the caret still on it.
     */
    await page.goto('/');
    await startGame(page);
    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      'there is no typewriter to interrupt under reduced motion, so this test would prove nothing',
    ).toBe(false);
    await standAt(page, await mostTalkative(page));

    const cdp = await context.newCDPSession(page);
    await tap(page, cdp, '.otp-a-button');
    await expect(page.locator('.otp-dialogue__line')).toBeVisible();
    await page.waitForTimeout(SETTLED_MS);
    // The caret is rendered only while the line is still arriving, so its presence IS "still
    // typing" -- read as a count, because it is an anchor with no box for `toBeVisible` to find.
    expect(
      await page.locator('.otp-dialogue__caret').count(),
      'the tap opened the panel and finished the line in the same gesture',
    ).toBe(1);
  });

  test('and the same interact from the keyboard is no different', async ({ page }) => {
    /*
     * The other arm of the comparison, because the defect was a DIFFERENCE between two devices: a
     * guard that watched only the phone could be satisfied by making both of them wrong.
     */
    await page.goto('/');
    await startGame(page);
    await standAt(page, await mostTalkative(page));
    await page.keyboard.press('KeyE');
    await expect(page.locator('.otp-dialogue__line')).toBeVisible();
    await page.waitForTimeout(SETTLED_MS);
    expect(await page.locator('.otp-dialogue__caret').count()).toBe(1);
  });

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
    await page.waitForFunction(() => window.__otp!.store.getState().phase === 'dialogue');
    // A dozen frames: long enough that a click which was going to be synthesised has been.
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks),
      'the tap left a stray click loose in the panel that replaced the pad',
    ).toBe(0);
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
      await page.waitForTimeout(600);
      const after = (await probe(page)).position;
      const moved = Math.hypot(after.x - before.x, after.y - before.y);
      // Stop is last in the group, and the one control whose success looks like standing still.
      if (i === count - 1) expect(moved, `"${name}" walked her off on ${key}`).toBeLessThan(AWAY);
      else expect(moved, `"${name}" did nothing at all on ${key}`).toBeGreaterThan(AWAY);
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
