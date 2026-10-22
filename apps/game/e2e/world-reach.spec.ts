/*
 * Can a player who cannot see the canvas find anybody, and get to them? docs/UX_REVIEW.md 16.
 *
 * The two halves of that finding are a pair, and this file is deliberately one file: the scene
 * announcing that someone is within reach is what makes an encounter discoverable, and a walk
 * control that answers a single activation is what makes it reachable. Either alone leaves the
 * three encounters the whole game is built from out of play.
 *
 * Both assertions are about things no screenshot shows, so both read the running build. The
 * live-region test uses the node-identity trick the rest of e2e/a11y.spec.ts uses -- a region
 * inserted into the DOM already holding its text is announced by nobody, and a test that only
 * checks "the text is there" passes on that broken case too.
 *
 * The numbers these were written against, measured on the build before the fix:
 *   - standing inside INTERACT_RADIUS of the Rabbit, every live region on the page was empty and
 *     no region on the page contained the word "Rabbit";
 *   - one `touchscreen.tap` on the joystick moved Purple 0.0px, because the stick takes its vector
 *     from pointer OFFSET and a point activation has none;
 *   - the only element in the pad exposed to assistive technology as a control was a
 *     `role="application"` div, and the A button listened for `pointerdown` only, so a
 *     synthesised activation of it did nothing at all.
 */
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { probe, startGame, tag, tagOf, talkingDistance, walkTo } from './helpers';
// The real constant, as helpers.ts does it: a threshold copied by hand is a threshold that rots.
import { INTERACT_RADIUS } from '../src/world/logic';
import { STEP_PX } from '../src/ui/touch-controls';

/** The scene's own event name. A typo in any of the three files that spell it fails this file. */
const WITHIN_REACH = 'otp:within-reach';

const NEAR = '[data-announce="near"]';

/*
 * `tag`, `tagOf` and `talkingDistance` come from helpers.ts and used to be declared here as well.
 * The tag pair was byte-identical to e2e/a11y.spec.ts's copy; `talkingDistance` returned the same
 * point by a different route, `+16, +40` written out rather than derived from TILE. That is the
 * drift the shared version exists to stop: the literals are correct at TILE = 32 and silently wrong
 * at any other size, which is how the walking helpers overshot when the art moved from 16px tiles.
 * The reasoning that was in the docstring here now sits above `talkingDistance` in helpers.ts.
 */

/** What a screen reader does to a control: one activation, no pointer, no hold. */
const activate = (page: Page, name: string): Promise<void> =>
  page.getByRole('button', { name, exact: true }).evaluate((el) => (el as HTMLElement).click());

/** A phone: the touch half of the pad. The cabinet draws the deck on a desktop too (cabinet.spec). */
const touchPage = async (browser: Browser): Promise<Page> => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await startGame(page);
  return page;
};

/* -------------------------------------------- half one: is anybody there? */

test('a traveller who comes within reach is announced, politely', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  await expect(page.locator(NEAR)).toHaveCount(1);
  await expect(page.locator(NEAR)).toHaveAttribute('aria-live', 'polite');
  expect(await page.locator(NEAR).textContent(), 'silent while nobody is near').toBe('');
  await tag(page, NEAR, 'before-arrival');

  await walkTo(page, await talkingDistance(page, 'npc-rabbit'));

  // The name comes from the cast and the sentence from `worldTravellerNear`, so this asserts both
  // halves: who is there, and that content -- not a literal in a component -- says what to do.
  await expect(page.locator(NEAR)).toContainText('Rabbit');
  await expect(page.locator(NEAR)).toContainText(/within reach/i);
  expect(await tagOf(page, NEAR), 'the same node, mutated -- not a new one').toBe('before-arrival');

  /*
   * And it goes quiet again when there is nothing to say. A verdict takes the Rabbit out of the
   * cast that still talks, which is the same code path as walking away from her and a great deal
   * faster to drive.
   */
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'leave' });
  });
  await expect(page.locator(NEAR)).toHaveText('');
});

/*
 * The summary is the game for this player, so it may not describe a different machine.
 *
 * Found by playing the run with the canvas treated as invisible: on a phone the first thing the
 * summary said was "Arrows or WASD to walk, Space to talk, Esc to go back." -- the line panels.css
 * already hides on `(hover: none)`, with a comment saying it "names Arrows and WASD to someone
 * holding a phone". The sighted touch player was spared it; the blind touch player got it as the
 * only instructions on the page. That is UX_REVIEW finding 11's defect inside finding 16's fix,
 * which is why the guard lives beside finding 16's other tests.
 */
const WORLD_SUMMARY = 'section.otp-visually-hidden[aria-label]';

test('the world summary names the controls this machine actually has', async ({
  browser,
  page,
}) => {
  const touch = await touchPage(browser);
  const spoken = (await touch.locator(WORLD_SUMMARY).textContent()) ?? '';
  expect(spoken, 'the summary is there at all').not.toBe('');
  expect(spoken, 'no keyboard the player does not have').not.toMatch(
    /arrow|wasd|\bspace\b|\besc\b/i,
  );
  // And it names controls that are really on the page, by the name they answer to.
  for (const name of ['walk buttons', 'Talk or interact']) expect(spoken).toContain(name);
  await touch.context().close();

  // The same screen on a machine with a keyboard and no pad says the opposite, and is right to.
  await page.goto('/');
  await startGame(page);
  expect(await page.locator(WORLD_SUMMARY).textContent()).toMatch(/arrow/i);
});

/* -------------------------------------------- half two: can she get there? */

test('the pad offers real controls, not a drag surface', async ({ browser }) => {
  const touch = await touchPage(browser);

  for (const name of ['Walk up', 'Walk down', 'Walk left', 'Walk right', 'Stop'])
    await expect(touch.getByRole('button', { name, exact: true })).toHaveCount(1);

  // The joystick cannot answer an activation, so it must not be offered as the thing that can.
  await expect(touch.locator('.otp-stick')).toHaveAttribute('aria-hidden', 'true');
  await expect(touch.locator('.otp-stick')).toBeVisible();

  await touch.context().close();
});

/**
 * Waits for Purple to stop: two reads a beat apart that agree, after she has moved at all.
 *
 * WAITED FOR, NEVER TIMED. This test slept 1400ms and then measured, on the theory that a press
 * carries her for about a second. On a starved CI runner Phaser clamps each frame's delta, so the
 * same second of wall clock covered 34px and the test failed at 34 against a floor of 48 with
 * nothing broken. The press is owed as distance now (`Input.walkFor`), so it always finishes; what
 * this waits for is that finish, however long the machine takes to get there.
 */
async function settled(page: Page, from: number): Promise<number> {
  let last = (await probe(page)).position.x;
  await expect
    .poll(async () => (last = (await probe(page)).position.x) - from, {
      message: 'she never set off',
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  for (let i = 0; i < 60; i += 1) {
    await page.waitForTimeout(300);
    const now = (await probe(page)).position.x;
    if (now === last) return now;
    last = now;
  }
  throw new Error('Purple was still walking 18 seconds after one press');
}

test('one activation of a walk button carries Purple, and stops by itself', async ({ browser }) => {
  const touch = await touchPage(browser);

  const before = await probe(touch);
  await activate(touch, 'Walk right');
  const after = await settled(touch, before.position.x);

  /*
   * The press carries her four tiles, and it is DISTANCE now, so the full carry is asserted as an
   * upper bound and the interact radius as the floor: a press that cannot cover the radius can
   * never change who is within reach, which is the whole point of having the control. Between
   * the two, a tree in the way may stop her short; a slow machine may not.
   */
  const walked = after - before.position.x;
  expect(walked, 'px walked east on one press').toBeGreaterThan(INTERACT_RADIUS);
  expect(walked, 'one press is one step: four tiles at most').toBeLessThanOrEqual(STEP_PX + 0.5);

  // Bounded: a press is a step, not a commitment. Nothing runs off across the map.
  await touch.waitForTimeout(600);
  expect((await probe(touch)).position.x).toBeCloseTo(after, 0);

  await touch.context().close();
});

test('the walk stops the moment someone comes within reach', async ({ browser }) => {
  const touch = await touchPage(browser);

  const before = await probe(touch);
  await activate(touch, 'Walk right');

  /*
   * She has to be WALKING before the stop can mean anything. Without this the test passes on a pad
   * whose buttons do nothing at all -- which it did, the first time this fix was broken on purpose
   * to check the guard: a Purple who never set off is trivially a Purple who did not overshoot.
   * Polled rather than slept for: 150ms of wall clock is not 5px of walking on a starved runner.
   */
  await expect
    .poll(async () => (await probe(touch)).position.x - before.position.x, {
      message: 'underway before the event',
    })
    .toBeGreaterThan(5);

  await touch.evaluate(
    (event) => window.dispatchEvent(new CustomEvent(event, { detail: { id: 'rabbit' } })),
    WITHIN_REACH,
  );
  await touch.waitForTimeout(80);
  const stopped = await probe(touch);
  await touch.waitForTimeout(500);

  expect(
    (await probe(touch)).position.x,
    'she must not be walked past the person she was looking for',
  ).toBeCloseTo(stopped.position.x, 0);

  await touch.context().close();
});

test('one activation of the A button talks to whoever is within reach', async ({ browser }) => {
  const touch = await touchPage(browser);

  await walkTo(touch, await talkingDistance(touch, 'npc-rabbit'));
  await expect(touch.locator(NEAR)).toContainText('Rabbit');

  await activate(touch, 'Talk or interact');
  await expect(touch.locator('.otp-dialogue')).toBeVisible();
  expect(await touch.evaluate(() => window.__otp!.store.getState().active)).toBe('rabbit');

  await touch.context().close();
});
