/*
 * The arrival is the payoff beat, and until this round it took no focus and announced nothing.
 *
 * Three things were measured wrong on the built page, and these guards were written to fail on the
 * build they were written against:
 *
 *  - entering the cottage phase left `document.activeElement` as BODY. The canvas carries no
 *    tabindex, so play leaves focus on the body, and `Cottage` -- alone among the panels -- moved
 *    it nowhere. The one control that advances the climax had to be found with a blind Tab;
 *  - the `aria-live` wrapper was inserted into the DOM already holding the first approach line. A
 *    region born with its text is announced by no screen reader -- they announce MUTATIONS to a
 *    region that was already there -- so the sentence that opens the payoff reached nobody, while
 *    beats two onwards, which really were mutations, were announced normally. That asymmetry is
 *    why "the text is present" is not a test: it passes on the broken build;
 *  - the `<h2>` naming the ending was a sibling OUTSIDE the region, so the one sentence the whole
 *    run was for -- "The wolf's house", "Clean arrival" -- was never spoken at all.
 *
 * Nothing here is pinned to a string this project could reasonably rewrite. Each assertion compares
 * what was ANNOUNCED against what is on the screen at that moment, read from the page, so the
 * guards track `content/game.json` instead of fighting it (CLAUDE.md rule 3) and a renamed ending
 * or a reworded beat cannot redden them.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

/** The arrival's announcer. */
const REGION = '[data-announce="arrive"]';
/** Whatever the panel says takes focus on mount. Named by behaviour, not by class. */
const AUTOFOCUS = '.otp-arrive [data-autofocus]';

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/**
 * Watches the document from BEFORE the arrival exists, and records the announcer's text at the
 * instant it is inserted.
 *
 * This is the only way to tell the fixed build from the broken one. By the time a spec can query
 * the region the effect has already filled it, so both builds look identical from outside: the
 * difference is whether the text was there when the node arrived. A `MutationObserver` reads
 * `textContent` as the insertion record is delivered, which is the moment that decides it.
 */
async function watchForRegion(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const seen: { born: string | null; mutations: string[] } = { born: null, mutations: [] };
    (window as unknown as Record<string, unknown>)['__arrive'] = seen;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const found = node.matches(sel) ? node : node.querySelector(sel);
          if (found && seen.born === null) seen.born = found.textContent ?? '';
        }
        const target =
          record.target instanceof Element ? record.target : record.target.parentElement;
        if (seen.born !== null && target?.closest(sel))
          seen.mutations.push(document.querySelector(sel)?.textContent ?? '');
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }, REGION);
}

/**
 * What the announcer held at the instant it was inserted, or null if the observer never saw it
 * appear at all -- which is itself a failure, and reads as one against the expected "".
 */
const bornWith = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as Record<string, { born: string | null } | undefined>)['__arrive']
        ?.born ?? null,
  );

/** Plays a run with one verdict throughout and stops on the arrival, before any beat is advanced. */
async function arrive(page: Page, verdict: 'allow' | 'restrict' | 'reject'): Promise<void> {
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'explore');
  await watchForRegion(page);
  await page.evaluate(
    ({ verdict, skillOf }) => {
      const { store } = window.__otp!;
      for (const [character, skill] of Object.entries(skillOf)) {
        store.dispatch({ type: 'MEET', c: character });
        store.dispatch({ type: 'INSPECT', s: skill });
        store.dispatch({ type: 'VERDICT', s: skill, v: verdict });
      }
      store.dispatch({ type: 'ENTER_COTTAGE' });
    },
    { verdict, skillOf: SKILL_OF },
  );
  await expect(page.locator('.otp-arrive')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the arrival takes focus into its own panel, not the body', async ({ page }) => {
  await arrive(page, 'allow');

  // The panel's own target, whatever it is called -- and emphatically not the body, which is where
  // play leaves focus because the canvas cannot hold it.
  await expect(page.locator(AUTOFOCUS)).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

  /*
   * And the ring that focus is NOT allowed to paint. `panels.css` suppresses the control ring on an
   * element that is both unreachable by Tab and focused on mount, because this is a text block the
   * player never navigated to; the band it would otherwise draw round the panel was reported as a
   * rendering fault twice. Asserted here because the fix above is what makes the rule apply.
   */
  const ring = await page
    .locator(AUTOFOCUS)
    .evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).boxShadow);
  expect(ring, 'the arrival text is a container, not a control').toBe('none none');
});

test('the arrival announcer is born empty and then mutated', async ({ page }) => {
  await arrive(page, 'allow');

  // The measurement the broken build fails: inserted with nothing in it.
  expect(await bornWith(page), 'the region must exist before it has anything to say').toBe('');

  // ...and then filled with the beat that is on the screen. Read off the page, not from a literal.
  const firstLine = (await page.locator('.otp-arrive__line').first().textContent())?.trim() ?? '';
  expect(firstLine.length, 'the arrival should open with a sentence').toBeGreaterThan(0);
  await expect(page.locator(REGION)).toHaveText(firstLine);

  /*
   * One region, not two. The visible block used to be live as well; leaving it live beside the
   * announcer would say every beat after the first twice over.
   */
  await expect(page.locator('.otp-arrive [aria-live]')).toHaveCount(1);
});

test('every beat after the first mutates the same node', async ({ page }) => {
  await arrive(page, 'allow');

  // A remount loses the tag; a mutation keeps it. Same trick as e2e/a11y.spec.ts.
  await page
    .locator(REGION)
    .evaluate((el) => void ((el as unknown as Record<string, string>)['__tag'] = 'born'));

  const spoken: string[] = [];
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
    const lines = await page.locator('.otp-arrive__line').allTextContents();
    const newest = lines[lines.length - 1]?.trim() ?? '';
    // Whatever beat just appeared on screen is the beat that was just announced.
    await expect(page.locator(REGION)).toContainText(newest);
    spoken.push(newest);
    expect(
      await page
        .locator(REGION)
        .evaluate((el) => (el as unknown as Record<string, string>)['__tag'] ?? null),
      'the region was replaced, so this beat was announced to nobody',
    ).toBe('born');
  }

  expect(spoken.length, 'the arrival should have beats to advance through').toBeGreaterThan(0);
});

test('the ending is named out loud, not only drawn', async ({ page }) => {
  // Allowing everything earns an ending with something to say about it.
  await arrive(page, 'allow');

  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }

  const title = page.locator('.otp-ending__title');
  await expect(title).toBeVisible();
  const named = (await title.textContent())?.trim() ?? '';
  expect(named.length, 'the run should end on a named card').toBeGreaterThan(0);

  /*
   * The heading stays exactly where it is on screen -- e2e/game.spec.ts reads it there -- so what
   * is asserted is that the words ALSO reached the region that speaks. Before this they did not:
   * the heading was a sibling outside it and the sequence ended in silence.
   */
  await expect(page.locator(REGION)).toContainText(named);
});
