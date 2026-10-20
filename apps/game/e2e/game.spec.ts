import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { probe, ready, talkingDistance, walkTo } from './helpers';

/*
 * The shipped words, read rather than imported: Playwright runs these as plain Node ESM, where a
 * JSON import needs an import attribute the rest of the workspace does not use. Every string this
 * file asserts comes from here, so rewording the game cannot redden it (CLAUDE.md rule 3).
 */
const CONTENT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as {
  strings: Record<string, string>;
  endings: { id: string; title: string; lines: string[] }[];
  bystanders: { id: string; name: string; spawn: string; lines: string[] }[];
};

type Verdict = 'allow' | 'restrict' | 'reject';
const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** Plays a whole run through the store, which is what the reducer guarantees a player can do. */
async function playRun(
  page: Page,
  verdicts: Record<string, Verdict>,
  questions: string[] = [],
): Promise<void> {
  await page.evaluate(
    ({ verdicts, questions, skillOf }) => {
      const { store } = window.__otp!;
      for (const [character, verdict] of Object.entries(verdicts)) {
        store.dispatch({ type: 'MEET', c: character });
        for (const q of questions) store.dispatch({ type: 'ASK', c: character, q });
        store.dispatch({ type: 'INSPECT', s: skillOf[character] });
        store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
      }
      store.dispatch({ type: 'ENTER_COTTAGE' });
    },
    { verdicts, questions, skillOf: SKILL_OF },
  );
}

/** Clicks through every approach and ending beat, stopping on the last one. */
async function advanceBeats(page: Page): Promise<void> {
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
}

/** Clicks through the arrival to the results screen. */
async function finishArrival(page: Page): Promise<void> {
  await advanceBeats(page);
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

test('the title screen starts the run', async ({ page }) => {
  expect((await probe(page)).phase).toBe('title');
  await expect(page.locator('.otp-title__mark')).toContainText('Off the Path');
  // Exactly one word in Season Mix italic.
  await expect(page.locator('.otp-title__mark .otp-serif')).toHaveText('Path');
  await expect(page.locator('.otp-note')).toContainText('Mind the path');

  await page.getByRole('button', { name: /Begin the walk/ }).click();
  expect((await probe(page)).phase).toBe('explore');
});

/*
 * The three tests below used to name a total and assert it. They no longer do, and nor do their
 * names. packages/core/test/scoring.test.ts proves every one of these run shapes in one it.each
 * table -- perfect+needs = 1000, reject-all = 600, allow-all = 100 -- under a 100% coverage gate,
 * so repeating the numbers in a browser meant that rebalancing a skill in content/game.json
 * reddened three e2e tests, which is the one thing CLAUDE.md rule 3 promises cannot happen. What
 * is left here is what only a browser can see: which ending card plays, which recap rows wear the
 * miss treatment, and that a score reaches the screen at all. One exact total is still asserted in
 * the suite, in e2e/results-payoff.spec.ts, where it is the premise of the test around it.
 */

test('a perfect run ends clean, with no skill row marked as a miss', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' }, [
    'needs',
  ]);

  await expect(page.locator('.otp-ending__title')).toBeHidden();
  await finishArrival(page);
  const rows = page.locator('.otp-recap__row--skill');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('.otp-recap__row--skill.otp-recap__row--missed')).toHaveCount(0);
});

test('rejecting everything arrives safely, with the errand undone', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'reject', owl: 'reject', 'lantern-keeper': 'reject' });

  // The ending line only appears after the approach beats.
  await advanceBeats(page);
  // Refusing everything is safe, but it is no longer indistinguishable from playing well: nothing
  // was taken and nothing was carried out either, so it does not draw the clean-arrival card.
  await expect(page.locator('.otp-ending__title')).toHaveText('The long way round');
  await expect(page.locator('.otp-arrive__line--reveal').first()).toContainText('given up waiting');
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  /*
   * Refusing everything is safe but costly, and the recap now says those are different things.
   * `--missed` is the mark for a hidden action that RAN (`recap().compromised`, i.e. the outcome
   * set a flag), not for any verdict short of the best one -- so a run that takes nothing wears it
   * nowhere, which is what "safe" means. Rejecting Word Weaver is the best call and scores full
   * marks; rejecting the compass and the lantern scores 100 of 200 each and leaks nothing.
   *
   * Asserted per row on `data-glyph`, the attribute Results.tsx documents as the one specs read,
   * because a count alone cannot tell "0 missed because nothing was taken" from "0 missed because
   * the rows stopped rendering". The order is content order: Cottage Finder, Word Weaver, Night
   * Light.
   */
  await expect(page.locator('.otp-recap__row--skill')).toHaveCount(3);
  expect(
    await page
      .locator('.otp-recap__row--skill .otp-recap__badge')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-glyph'))),
  ).toEqual(['traded', 'check', 'traded']);
  await expect(page.locator('.otp-recap__row--skill.otp-recap__row--missed')).toHaveCount(0);
});

test("allowing everything ends in the wolf's house", async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'allow', owl: 'allow', 'lantern-keeper': 'allow' });

  await finishArrival(page);
  /*
   * A capability taken by allowing in full does not carry out Grandma's errand -- the word it
   * sent went to the wolf as well -- so allow-all earns no goal and keeps only the lantern's 100.
   *
   * TWO rows wear the failure mark here, not three, and the third row is the whole lesson of the
   * card. Allowing the compass sets `keyStolen` and allowing the translator sets `messagesLeaked`,
   * so both ran a hidden action. Allowing the lantern sets NO flag: it is the wrong call (restrict
   * scores 200 against its 100) but nothing was taken, so it reads `traded`/"Nothing taken". That
   * distinction is the point of the three-state recap -- the "!" disc means something ran, and a
   * run where it appears twice is not the same screen as one where it appears three times.
   */
  await expect(page.locator('.otp-recap__row--skill')).toHaveCount(3);
  expect(
    await page
      .locator('.otp-recap__row--skill .otp-recap__badge')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-glyph'))),
  ).toEqual(['missed', 'missed', 'traded']);
  const flags = await page.evaluate(() => window.__otp!.store.getState().flags);
  expect(flags).toEqual(['keyStolen', 'messagesLeaked']);
});

/*
 * One leak draws the close card, and the close card says its own words.
 *
 * This used to assert the literal "why do you need my key", which is the mistake the note above
 * warns about in the other direction: `endings.close` fires on a COUNT of flags and never on which
 * one, so a key-specific sentence there was wrong for any other single leak -- and the sentence has
 * since been rewritten flag-neutral in `content/game.json`, which reddened this test exactly as
 * CLAUDE.md rule 3 says content changes must not. What only a browser can see is which card plays
 * and that its line reaches the screen; which line that is belongs to the content file.
 */
test('a single leak draws the close card, in its own words', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'allow', owl: 'reject', 'lantern-keeper': 'allow' });

  await advanceBeats(page);
  const close = CONTENT.endings.find((e) => e.id === 'close')!;
  expect(await page.evaluate(() => window.__otp!.store.getState().flags)).toHaveLength(1);
  await expect(page.locator('.otp-ending__title')).toHaveText(close.title);
  await expect(page.locator('.otp-arrive__text')).toContainText(close.lines[0]!);
});

test('the handle field validates before anything is posted', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  const field = page.locator('.otp-field input');
  await field.fill('ab');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('between 3 and 16');

  await field.fill('cyera-team');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('different handle');

  // A valid handle reaches the client, which reports the board is not up yet.
  await field.fill('wolfspotter');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/unavailable/i);
});

test('the privacy line is next to the handle field', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  await expect(page.locator('#otp-handle-hint')).toContainText('handle and score only');
  await expect(page.locator('#otp-handle-hint')).toContainText('no cookies');
});

test('Results shows exactly one Lime, on Read the Research', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  const limes = await page.evaluate(() => {
    const lime = getComputedStyle(document.documentElement)
      .getPropertyValue('--cyera-lime')
      .trim()
      .toLowerCase();
    const toHex = (rgb: string): string => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
      return m
        ? `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`
        : rgb;
    };
    /*
     * Background AND text AND fill. This used to count `backgroundColor` alone, which is half the
     * rule: BRAND_AND_UI section 2 ends "Lime is a background fill only, NEVER TEXT", and section 4
     * "Never two Limes on one screen". A guard that only looks at backgrounds cannot see the way
     * the rule is most easily broken, and it did not -- `.otp-cta__disc` shipped a Lime arrow as
     * `color` on its Black ground, on both Title and Results, and this test stayed green through
     * every round. Counting the property the rule names is the point.
     */
    const out: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (s.visibility === 'hidden' || s.opacity === '0') continue;
      const ways: string[] = [];
      if (toHex(s.backgroundColor) === lime) ways.push('background');
      // Text only counts where there is text of its own to paint.
      if (toHex(s.color) === lime && (el.textContent ?? '').trim() !== '') ways.push('color');
      if (toHex(s.fill) === lime) ways.push('fill');
      if (ways.length) out.push(`${String(el.className)} [${ways.join('+')}]`);
    }
    return out;
  });
  expect(limes, `Lime is painted in ${limes.length} place(s): ${limes.join(' | ')}`).toHaveLength(
    1,
  );
  expect(String(limes[0])).toContain('otp-cta');
  expect(String(limes[0]), 'the one Lime must be a background fill, not text').toContain(
    'background',
  );
});

test('replay starts a fresh run with a new id', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  const firstRun = await page.evaluate(() => window.__otp!.store.getState().runId);
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' });
  await finishArrival(page);

  await page.getByRole('button', { name: /Walk it again/ }).click();
  const after = await page.evaluate(() => {
    const s = window.__otp!.store.getState();
    return { phase: s.phase, runId: s.runId, verdicts: s.verdicts, log: s.log.length };
  });
  expect(after.phase).toBe('explore');
  expect(after.verdicts).toEqual({});
  expect(after.log).toBe(0);
  expect(after.runId).not.toBe(firstRun);
});

test('replay puts Red back at the spawn and lets the notice fire again', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  const spawn = await page.evaluate(() =>
    window.__otp!.mapObjects!.find((o) => o.name === 'spawn-red')!,
  );

  // Decide everything, read the notice while still exploring, then finish the run.
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s, v] of [
      ['rabbit', 'cottage-finder', 'restrict'],
      ['owl', 'word-weaver', 'restrict'],
      // Allowing the lantern is what lights the third leg now that restricting it grants nothing.
      ['lantern-keeper', 'night-light', 'allow'],
    ] as const) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v });
    }
  });
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await page.getByRole('button', { name: /Walk on/ }).click();
  expect((await probe(page)).flags).toEqual(['locationLeaked']);

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  await finishArrival(page);

  await page.getByRole('button', { name: /Walk it again/ }).click();
  const after = await probe(page);
  expect(after.phase).toBe('explore');
  expect(after.flags).toEqual([]);
  // Red is a world object: resetting the store alone used to leave her at the cottage gate.
  expect(Math.abs(after.position.x - spawn.x)).toBeLessThan(64);
  expect(Math.abs(after.position.y - spawn.y)).toBeLessThan(64);

  // The notice must be offered again, or the lesson can only ever land once.
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();
});

test('a verdict is confirmed in words, not as a raw id', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
  });
  await expect(page.locator('.otp-toast')).toHaveText('Restricted: Cottage Finder');
});

test('the notation chip counts skills seen, then decided', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await expect(page.locator('.otp-hud .otp-chip')).toContainText('0 of 3 skills seen');

  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
  });
  await expect(page.locator('.otp-hud .otp-chip')).toContainText('1 of 3 skills seen');
});

test('results explain where the points came from', async ({ page }) => {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await playRun(page, { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' }, ['needs']);
  await finishArrival(page);
  const breakdown = page.locator('.otp-hero__breakdown');
  await expect(breakdown).toContainText('from your 3 verdicts');
  await expect(breakdown).toContainText('for asking before you decided');
  await expect(breakdown).toContainText('for never running all three at once');
});

/* ------------------------------------------------ the A button, on the device most people use */

/*
 * One tap of A used to be two interacts.
 *
 * `ui/touch-controls.ts` answers both `pointerdown` (low latency, and the only path that survives a
 * second finger) and `click` (all a screen reader can send). A tap is a hold, so those land about
 * 120ms apart -- different frames -- and the scene's `read()` consumed them as two separate
 * presses. The cost is not a wasted frame: a bystander's line advances per greeting and each
 * greeting overwrites the last before a frame is drawn, so the line the player gets to read is
 * every SECOND one. Measured on the build before the fix, three 120ms taps beside the Toadstool:
 * 2, 4 and 6 `greetBystander` events, and the lines he showed long enough to read were his 2nd,
 * 1st and 3rd -- his opening line, the first thing anybody says to you in this forest, flashed and
 * was gone. A part with an even number of lines fares worse than scrambled: stepping two at a time
 * through four never lands on the 1st or the 3rd at all, so half of the Snail was unreachable on a
 * phone. That last figure is arithmetic off the measured step of two, not a second measurement.
 *
 * So this is written the way a player meets it -- tap, read, tap, read -- and not as a count of
 * listeners on a button, which is the thing that happens to be wrong today rather than the thing
 * that is wrong for the player. The lines come from the content file, so rewriting the Toadstool
 * cannot redden it (CLAUDE.md rule 3).
 */
const TOADSTOOL = CONTENT.bystanders.find((b) => b.id === 'toadstool')!;

/**
 * A real tap: down, a hold, up.
 *
 * `touchscreen.tap()` sends touch-down and touch-up back to back, inside one animation frame, and
 * the two presses then collapse into one before the scene ever reads them -- so it passes on the
 * broken build. A thumb is slower than a frame, and this is the gesture the bug lives in.
 */
async function tapA(page: Page, cdp: CDPSession, holdMs = 120): Promise<void> {
  const box = (await page.locator('.otp-a-button').boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Long enough that a second press which is going to land has landed: a dozen frames. */
const SETTLED_MS = 250;

/** Counts what the scene actually emitted, so a duplicate shows even when nothing drew it. */
const countGreetings = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as { __greets?: string[] };
    w.__greets = [];
    (
      window.__otp!.bus as unknown as {
        on(e: string, h: (p: { bystanderId: string }) => void): () => void;
      }
    ).on('greetBystander', ({ bystanderId }) => void w.__greets!.push(bystanderId));
  });

const greetings = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __greets: string[] }).__greets);

test.describe('the A button on a phone', () => {
  // The only place the pad is on screen: on a fine pointer the whole thing is display: none.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('one tap is one greeting, and a bystander can be read line by line', async ({
    page,
    context,
  }) => {
    await page.getByRole('button', { name: /Begin the walk/ }).click();
    await walkTo(page, await talkingDistance(page, TOADSTOOL.spawn));
    await expect(page.locator('.otp-a-button')).toBeVisible();
    await countGreetings(page);

    const cdp = await context.newCDPSession(page);
    for (const [i, line] of TOADSTOOL.lines.entries()) {
      await tapA(page, cdp);
      await page.waitForTimeout(SETTLED_MS);

      // What he said on this tap is the line that comes next, and the player had a frame to read
      // the one before it: his first word is his first line, not his second.
      await expect(page.locator('.otp-say'), `tap ${i + 1} says line ${i + 1}`).toContainText(line);
      expect(await greetings(page), `tap ${i + 1} is one greeting`).toHaveLength(i + 1);
    }
  });

  test('an activation with no pointer behind it still talks, exactly once', async ({ page }) => {
    await page.getByRole('button', { name: /Begin the walk/ }).click();
    await walkTo(page, await talkingDistance(page, TOADSTOOL.spawn));
    await countGreetings(page);

    /*
     * What a screen reader does to a control: one activation, no pointer, no hold -- which arrives
     * as an untrusted click carrying detail 0. It is the only notice this button gets from assistive
     * technology, so the fix above must not reach for "ignore every click": the A button is the
     * only way to talk to anybody on a touch device, and it was inert to a screen reader once
     * already (e2e/world-reach.spec.ts).
     */
    await page
      .getByRole('button', { name: CONTENT.strings['touchInteract']!, exact: true })
      .evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(SETTLED_MS);

    await expect(page.locator('.otp-say')).toContainText(TOADSTOOL.lines[0]!);
    expect(await greetings(page)).toHaveLength(1);
  });
});
