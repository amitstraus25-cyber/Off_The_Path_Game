import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { probe, startGame } from './helpers';

/*
 * The post by the path, and what happens around it.
 *
 * Everything here is about the panel's LIFE -- when it is offered, what closes it, what a second
 * click does, what the world sounds and looks like while it is up. What the post SAYS when it is
 * read is e2e/trifecta.spec.ts's, and that it can be reached on foot is e2e/errand.spec.ts's.
 *
 * Why it exists: the post is the only mechanical demonstration this game owns, and one of the
 * three goals Grandma asks for is reading it. Both were spendable by a reflex -- a single Walk on,
 * or a single Esc, in the first ten seconds of the run, before there was anything to demonstrate
 * and before any verdict could make the goal reachable. Nothing noticed, because every spec that
 * touches the post reads it on purpose at a moment when reading it works.
 */

/** The line that earns `word` cleanly, so "leave word at the post" is actually winnable. */
const WORD_LINE = [
  ['rabbit', 'cottage-finder', 'restrict'],
  ['owl', 'word-weaver', 'restrict'],
  ['lantern-keeper', 'night-light', 'restrict'],
] as const;

const reach = (page: Page, id: string): Promise<void> =>
  page.evaluate((n) => window.__otp!.bus.emit('reachedNotice', { noticeId: n }), id);

/** Meets, questions and decides all three, without walking: the walk is errand.spec.ts's subject. */
const decide = (page: Page): Promise<void> =>
  page.evaluate(
    (line) => {
      const { store } = window.__otp!;
      for (const [c, s, v] of line) {
        store.dispatch({ type: 'MEET', c });
        for (const q of ['needs', 'who']) store.dispatch({ type: 'ASK', c, q });
        store.dispatch({ type: 'INSPECT', s });
        store.dispatch({ type: 'VERDICT', s, v });
      }
    },
    WORD_LINE as unknown as string[][],
  );

/**
 * Plays a whole run to the results card and returns the score it prints.
 *
 * `wavedAwayFirst` is the reflex under test: Purple meets the post on her way east before a single
 * verdict exists -- which the map makes the natural first act -- and closes it without reading.
 * The run then goes on to earn the capability the post's goal needs. A player who does that must
 * still be able to come back for it, so the two runs have to print the SAME score. The expected
 * number is never written down here: it is whatever the run that did not wave it away scores, so
 * this cannot drift when the content's points do.
 */
async function playRun(page: Page, wavedAwayFirst: null | 'walk-on' | 'escape'): Promise<string> {
  await page.goto('/');
  await startGame(page);

  if (wavedAwayFirst) {
    await reach(page, 'forest-post');
    await expect(page.locator('.otp-notice')).toBeVisible();
    // The effect that takes focus is the effect that starts listening for Esc.
    await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();
    if (wavedAwayFirst === 'escape') await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: /Walk on/ }).click();
    await expect(page.locator('.otp-notice')).toHaveCount(0);
  }

  await decide(page);

  for (const id of ['forest-post', 'cottage-door']) {
    await reach(page, id);
    await expect(page.locator('.otp-notice'), `the post "${id}" was never offered`).toBeVisible();
    await page.getByRole('button', { name: /Read the notice/ }).click();
    await page.getByRole('button', { name: /Walk on/ }).click();
    await expect(page.locator('.otp-notice')).toHaveCount(0);
  }

  await page.evaluate(() => {
    window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' });
    window.__otp!.store.dispatch({ type: 'FINISH' });
  });
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  return ((await page.locator('.otp-hero__score').textContent()) ?? '').trim();
}

test('waving the post away does not spend the goal it carries', async ({ page }) => {
  test.slow();
  const straight = await playRun(page, null);
  for (const how of ['walk-on', 'escape'] as const) {
    const after = await playRun(page, how);
    expect(after, `closing the post with ${how} cost the run part of Grandma's errand`).toBe(
      straight,
    );
  }
});

test('the post is offered again until it has actually been read', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  await reach(page, 'forest-post');
  await page.getByRole('button', { name: /Walk on/ }).click();
  await expect(page.locator('.otp-notice')).toHaveCount(0);

  await decide(page);
  await reach(page, 'forest-post');
  await expect(
    page.locator('.otp-notice'),
    'a post whose goal is still unmet must be offerable again',
  ).toBeVisible();

  // And once read it stops asking, which is the other half: this re-offers, it does not nag.
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();
  await reach(page, 'forest-post');
  await expect(page.locator('.otp-notice'), 'a post already read must not re-open').toHaveCount(0);
});

test('a double-click reads the post without also walking away from it', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await reach(page, 'forest-post');
  await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();

  /*
   * One gesture, two clicks at one point. The row used to collapse to a single Walk on at exactly
   * the pixel the press had landed on, so the second click walked away from a post the first
   * click had just read -- and took the node focus was on with it.
   */
  await page.getByRole('button', { name: /Read the notice/ }).dblclick();

  await expect(page.locator('.otp-notice'), 'the second click closed the panel').toBeVisible();
  await expect(page.locator('.otp-notice__visible')).toBeVisible();
  const landed = await page.evaluate(() => ({
    inModal: !!document.activeElement?.closest('[aria-modal="true"]'),
    tag: document.activeElement?.tagName ?? null,
  }));
  expect(landed.inModal, `focus left the dialog and landed on ${landed.tag}`).toBe(true);

  // Walk on is still there to be pressed, and pressing it is still what closes the panel.
  await page.getByRole('button', { name: /Walk on/ }).click();
  await expect(page.locator('.otp-notice')).toHaveCount(0);
});

test('a single click on Read leaves focus on the control that is still live', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await reach(page, 'forest-post');
  await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();

  await page.getByRole('button', { name: /Read the notice/ }).click();
  await expect(page.getByRole('button', { name: /Read the notice/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Walk on/ })).toBeFocused();
});

test('a notice the content does not define cannot strand Purple', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  /*
   * A `notice-<id>` object on the map with no entry in content/game.json. This used to take the
   * world's input away -- a notice is open, so Purple stops walking -- while App had nothing to
   * render, so there was no panel, no Walk on and no Esc. The run was over with no way to say so.
   */
  const before = (await probe(page)).position;
  await reach(page, 'notice-no-such-post');
  await expect(page.locator('.otp-notice')).toHaveCount(0);

  /*
   * Asserted before the walk, and on its own, because it is the DECIDABLE half. `bus.emit` runs
   * the handler synchronously, so by the time this round trip returns the world has already
   * decided whether a panel is up -- there is no settling to wait for and no race to lose.
   *
   * The walk below is the consequence a player would feel, and it is the half that CAN race: one
   * `keyboard.down` is a single keydown with no repeat behind it, so a press that lands in the
   * frame before the world takes input away leaves `held` set and Purple walking anyway. That makes
   * the walk a check that can come back green on a broken build; this line cannot.
   */
  expect(
    await page.evaluate(() => document.getElementById('game')?.dataset['phase']),
    'the world went into a notice it has no panel for, so nothing can close it',
  ).toBe('explore');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  const after = (await probe(page)).position;
  expect(
    after.x,
    `Purple was stranded at x=${String(Math.round(before.x))} and could not walk away`,
  ).toBeGreaterThan(before.x);
});

test('the world chrome says what is on screen, and the bed comes back up', async ({ page }) => {
  /*
   * The master gain, recorded as it is asked for. The numbers are never written down here: what is
   * asserted is the SHAPE -- walking is louder than reading, and closing the panel puts it back
   * exactly where walking had it. Name a level and this test starts watching the constant it was
   * copied from rather than the behaviour.
   *
   * The MASTER, specifically. `audio/player.ts` ramps a gain on every note it schedules as well,
   * and those are the loud ones: watching every `AudioParam` picked up a drum envelope and
   * compared the bed against it. The master is identified by what it is rather than by when it is
   * made -- the one gain node wired straight to the context's destination, with every voice
   * hanging off it.
   */
  await page.addInitScript(() => {
    const w = window as unknown as { __gain: number[] };
    w.__gain = [];
    const master = new WeakSet<AudioParam>();
    // The node-to-node overload is the only one the player uses; the cast keeps the other one.
    const connect = AudioNode.prototype.connect as (
      this: AudioNode,
      to: AudioNode,
      out?: number,
      into?: number,
    ) => AudioNode;
    AudioNode.prototype.connect = function (
      this: AudioNode,
      to: AudioNode,
      out?: number,
      into?: number,
    ): AudioNode {
      const gain = (this as Partial<GainNode>).gain;
      if (gain && to === this.context.destination) master.add(gain);
      return connect.call(this, to, out, into);
    } as typeof AudioNode.prototype.connect;
    const ramp = AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime = function (v: number, t: number) {
      if (master.has(this)) w.__gain.push(v);
      return ramp.call(this, v, t);
    };
  });
  await page.goto('/');
  await startGame(page);
  /*
   * The bed is turned on the way a player turns it on. This used to seed `localStorage['otp:music']`
   * in the init script above, because the preference was remembered across visits; it is no longer
   * stored anywhere (audio/player.ts), so there is nothing to seed and the toggle is the only way.
   */
  await page.getByRole('switch', { name: /music/i }).click();

  const phase = (): Promise<string | undefined> =>
    page.evaluate(() => document.getElementById('game')?.dataset['phase']);
  const loudest = (): Promise<number> =>
    page.evaluate(() => Math.max(...(window as unknown as { __gain: number[] }).__gain));

  // The level the bed is asked for while Purple is walking: the first ramp the player ever hears.
  const walking = await loudest();
  expect(walking, 'no master ramp was recorded, so this test is watching nothing').toBeGreaterThan(
    0,
  );
  expect(await phase()).toBe('explore');

  await reach(page, 'forest-post');
  await expect(page.locator('.otp-notice')).toBeVisible();
  const open = await page.evaluate(
    () => (window as unknown as { __gain: number[] }).__gain.at(-1) ?? -1,
  );
  expect(open, 'opening the post left the bed where it was').toBeLessThan(walking);
  expect(await phase(), 'the world claimed to be walkable with a modal over it').toBe('notice');

  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();
  await expect(page.locator('.otp-notice')).toHaveCount(0);

  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __gain: number[] }).__gain.at(-1) ?? -1),
      { message: 'the bed never came back up after the post was closed' },
    )
    .toBe(walking);
  expect(await phase()).toBe('explore');
});
