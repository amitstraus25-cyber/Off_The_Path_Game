/*
 * The accessible behaviour of the panels: docs/UX_REVIEW.md findings 10, 14 and 16.
 *
 * All three findings are about things a screenshot cannot show, so every assertion here reads the
 * running build: whether a key press reaches the control under focus, whether the element that
 * carries an announcement was ALREADY IN THE DOM before its text arrived, and whether the world
 * has any text behind it at all.
 *
 * The live-region tests use node identity rather than text, because text alone cannot tell the two
 * cases apart. A region inserted into the DOM already containing its text is not announced by any
 * screen reader -- they announce MUTATIONS to a region that was already there -- and a test that
 * only checks "the text is present" passes on both. So each one tags the DOM node with an expando
 * before the beat, then asks whether the node carrying the text afterwards is the same object. A
 * remount loses the tag; a mutation keeps it. This is the distinction finding 14 is entirely about.
 *
 * `A11Y_MEASURE=1 npx playwright test e2e/a11y.spec.ts -g measurements --reporter=line` prints the
 * numbers (contrast, typeface, box, line counts) instead of asserting them; the before/after
 * figures in the fix notes come from there.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
// tag/tagOf live in helpers.ts: e2e/world-reach.spec.ts uses the same node-identity trick, and it
// was written out twice, byte for byte.
import { startGame, tag, tagOf } from './helpers';

const MEASURE = !!process.env['A11Y_MEASURE'];

interface Measured {
  colour: string;
  ground: string;
  fontFamily: string;
  fontSize: number;
  box: { w: number; h: number };
  ratio: number;
}

/** Walks up for the first non-transparent background, which is what the eye compares against. */
const measure = (page: Page, selector: string): Promise<Measured> =>
  page.locator(selector).evaluate((el): Measured => {
    const parse = (c: string): number[] =>
      (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
    const lum = (rgb: number[]): number =>
      rgb
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const cs = getComputedStyle(el);
    let ground = 'rgba(0, 0, 0, 0)';
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        ground = bg;
        break;
      }
    }
    const a = lum(parse(cs.color));
    const b = lum(parse(ground));
    const box = el.getBoundingClientRect();
    return {
      colour: cs.color,
      ground,
      fontFamily: cs.fontFamily,
      fontSize: parseFloat(cs.fontSize),
      box: { w: Math.round(box.width * 10) / 10, h: Math.round(box.height * 10) / 10 },
      ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100,
    };
  });

/**
 * The text a sighted player can actually read on a control. `innerText` is no use here: the
 * visually-hidden treatment is clip-path plus a 1px box, which innerText happily includes, so a
 * control whose only state cue is a screen-reader string would look labelled when it is not.
 */
const visibleText = (page: Page, selector: string): Promise<string> =>
  page.locator(selector).evaluate((el) =>
    Array.from(el.childNodes)
      .filter((n) => !(n instanceof HTMLElement && n.classList.contains('otp-visually-hidden')))
      .map((n) => (n.textContent ?? '').trim())
      .filter(Boolean)
      .join(' '),
  );

/** Drives a whole encounter through the store, the way the other specs do. */
async function decide(page: Page, c: string, s: string, v: string): Promise<void> {
  await page.evaluate(
    ([character, skill, verdict]) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: character });
      store.dispatch({ type: 'INSPECT', s: skill });
      store.dispatch({ type: 'VERDICT', s: skill, v: verdict });
    },
    [c, s, v],
  );
}

/* ------------------------------------------------------------------ 10: the sound control */

test('the sound control answers the keyboard it is focused on', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const toggle = page.getByRole('switch', { name: 'Music' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // It is the only focusable control on Explore, so one Tab must reach it.
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();

  /*
   * The whole of the keyboard half of finding 10. world/input.ts preventDefaults Space and Enter
   * whenever the world owns the keyboard -- which is exactly when this control is on screen -- and
   * raises interactPressed before it does, so Space on the focused toggle used to open an
   * encounter and leave the switch untouched.
   */
  await page.keyboard.press(' ');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const after = await page.evaluate(() => {
    const s = window.__otp!.store.getState();
    return { phase: s.phase, active: s.activeCharacter };
  });
  expect(after, 'Space on the toggle must not also talk to the forest').toEqual({
    phase: 'explore',
    active: null,
  });

  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('the sound control carries its state in a word, not in colour and a glyph', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  const toggle = page.getByRole('switch', { name: 'Music' });

  // UI_FOUNDATIONS section 5: status is carried by shape, bar AND WORDS, and the control itself is
  // specified as "a labelled speaker toggle". A music note that changes colour is neither.
  expect(await visibleText(page, '.otp-music'), 'off state').toMatch(/off/i);
  await toggle.click();
  expect(await visibleText(page, '.otp-music'), 'on state').toMatch(/on/i);

  // The accessible name must NOT move with the state: that is what aria-checked is for, and a
  // switch whose name changes is announced as a different control each time.
  await expect(page.getByRole('switch', { name: 'Music', exact: true })).toHaveCount(1);

  // No typed glyph: Haffer carries neither U+266A nor U+1F507, so a text speaker falls through to
  // whatever the UA has, at a different weight and baseline (same reason as the verdict glyphs).
  expect(await visibleText(page, '.otp-music')).not.toMatch(/[♩-♯\u{1F507}-\u{1F50A}]/u);
  await expect(page.locator('.otp-music svg')).toHaveCount(1);
});

test('the state word does not push the phone header back off the screen', async ({ page }) => {
  // Finding 5's fix left this header with no slack to spare, and finding 10's fix adds a word to
  // it. The two are in different files and different hands, so the seam is asserted here: at the
  // narrowest shipped width, with a verdict recorded, nothing in the strip may hang outside it.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await startGame(page);
  await decide(page, 'rabbit', 'cottage-finder', 'allow');
  // The capture otherwise parks the pointer on whatever it clicked last.
  await page.mouse.move(0, 0);

  const fit = await page.evaluate(() => {
    const header = document.querySelector('.otp-world-frame__header')!;
    const box = header.getBoundingClientRect();
    const worst = Array.from(header.querySelectorAll('*'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .reduce((a, r) => Math.max(a, r.right - box.right), 0);
    return {
      overflow: Math.round((header.scrollWidth - header.clientWidth) * 10) / 10,
      outsideHeader: Math.round(worst * 10) / 10,
      offViewport: Math.round((box.right - window.innerWidth) * 10) / 10,
      music: document.querySelector('.otp-music')!.getBoundingClientRect().right,
    };
  });
  expect(fit.overflow, 'header overflow').toBeLessThanOrEqual(0);
  expect(fit.outsideHeader, 'furthest child past the header edge').toBeLessThanOrEqual(0);
  expect(fit.offViewport, 'header past the viewport edge').toBeLessThanOrEqual(0);
  expect(fit.music, 'the sound control stays on screen').toBeLessThanOrEqual(375);
});

/* ------------------------------------------------------------------ 14: the live regions */

test('the verdict confirmation lands in a region that was already there', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const region = '[data-announce="world"]';
  await expect(page.locator(region)).toHaveCount(1);
  expect(await page.locator(region).textContent(), 'born empty, or it announces nothing').toBe('');
  await tag(page, region, 'before-verdict');

  // Inspect unmounts the explore branch and the verdict mounts it again, which is how the toast
  // came to be inserted with "Allowed: Cottage Finder" already inside it.
  await decide(page, 'rabbit', 'cottage-finder', 'allow');
  await expect(page.locator('.otp-toast')).toHaveText('Allowed: Cottage Finder');
  await expect(page.locator(region)).toContainText('Allowed: Cottage Finder');
  expect(await tagOf(page, region), 'the same node, mutated -- not a new one').toBe(
    'before-verdict',
  );
});

test('the trifecta warning is announced on the beat it becomes true', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const region = '[data-announce="trifecta"]';
  await expect(page.locator(region)).toHaveCount(1);
  expect(await page.locator(region).textContent()).toBe('');
  await tag(page, region, 'before-third');

  await decide(page, 'rabbit', 'cottage-finder', 'allow');
  await decide(page, 'owl', 'word-weaver', 'allow');
  await decide(page, 'lantern-keeper', 'night-light', 'allow');

  await expect(page.locator('.otp-world-warning')).toContainText(/all three at once/i);
  await expect(page.locator(region)).toContainText(/all three at once/i);
  expect(await tagOf(page, region), 'the climactic beat must not be silent').toBe('before-third');

  // And it is said once, not twice: the visible line over the canvas is the same words.
  await expect(page.locator('.otp-world-warning')).toHaveAttribute('aria-hidden', 'true');
});

test('a bystander is heard as well as seen', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const region = '[data-announce="say"]';
  await tag(page, region, 'before-greet');
  await page.evaluate(() => window.__otp!.bus.emit('greetBystander', { bystanderId: 'snail' }));

  await expect(page.locator('.otp-say')).toBeVisible();
  const said = (await page.locator('.otp-say').textContent()) ?? '';
  expect(said.length).toBeGreaterThan(0);
  await expect(page.locator(region)).toContainText('Snail');
  expect(await tagOf(page, region)).toBe('before-greet');
  await expect(page.locator('.otp-say')).toHaveAttribute('aria-hidden', 'true');
});

test('the notice says what it just did, into a region born with the panel', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();

  const region = '[data-announce="notice"]';
  expect(await page.locator(region).textContent(), 'empty until it is read').toBe('');
  await tag(page, region, 'before-read');

  await page.getByRole('button', { name: /Read the notice/ }).click();
  await expect(page.locator(region)).toContainText(/nothing you are carrying/i);
  expect(await tagOf(page, region)).toBe('before-read');
});

test('Esc closes the notice, the one modal the reducer never heard it on', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();
  // The effect that takes focus is the effect that starts listening, so this is the point at which
  // the panel is actually open rather than merely painted. Without it the press can land in the
  // frame before either has happened, which is a flaky test AND a real dead key.
  await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();

  /*
   * Esc dispatches BACK, which the reducer handles in `dialogue` and `inspect` only. A notice is a
   * DOM panel that leaves the phase on `explore`, so the one aria-modal panel where Esc MUST close
   * was the one panel where it did nothing at all.
   */
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-notice')).toHaveCount(0);
  await expect(page.locator('.otp-world-frame')).toBeVisible();
  expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('explore');
});

// Esc on the card and on the conversation is e2e/ui.spec.ts's, in "Esc backs out one level at a
// time and never skips a verdict". A copy lived here and was the first half of it.

/* ------------------------------------------------------------------ 16: the world, as text */

test('the world has a text equivalent that names what is out there', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  const summary = page.getByRole('region', { name: /forest, in words/i });
  await expect(summary).toHaveCount(1);
  // Every traveller, by name, with where the player has got to with them.
  for (const who of ['Rabbit', 'Owl', 'Lantern Keeper'])
    await expect(summary).toContainText(new RegExp(`${who}.*not met yet`));
  await expect(summary).toContainText(/still locked/i);

  await decide(page, 'rabbit', 'cottage-finder', 'restrict');
  await expect(summary).toContainText(/Rabbit.*Restricted: Cottage Finder/);
  await expect(summary).toContainText(/Owl.*not met yet/);

  // The controls belong in it too: on a touch device the hint line over the canvas is display:none.
  await expect(summary).toContainText(/Space to talk/i);
});

test('the HUD groups say what they are', async ({ page }) => {
  await page.goto('/');
  await startGame(page);

  // Finding 21: a div with aria-label and no role is not exposed as anything, so the errand goals
  // were an unlabelled list of three sentences in the middle of the world.
  await expect(page.getByRole('group', { name: /Grandma asked for/i })).toHaveCount(1);
  await expect(page.getByRole('group', { name: /Basket/i })).toHaveCount(1);
});

/* ------------------------------------------------------------------ the numbers */

test('measurements', async ({ page }) => {
  test.skip(!MEASURE, 'set A11Y_MEASURE=1 to print the numbers');
  await page.goto('/');
  await startGame(page);

  const off = await measure(page, '.otp-music');
  const offText = await visibleText(page, '.otp-music');
  await page.getByRole('switch', { name: /music/i }).click();
  // Off the control, or `:hover` is measured instead of the on state (Offwhite, not Haze).
  await page.mouse.move(0, 0);
  const on = await measure(page, '.otp-music');

  const regions = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-live], [role="status"]')).map((el) => ({
      sel: el.getAttribute('data-announce') ?? el.className,
      role: el.getAttribute('role'),
      live: el.getAttribute('aria-live'),
      text: (el.textContent ?? '').slice(0, 40),
    })),
  );

  console.log(
    JSON.stringify(
      { soundControl: { off: { ...off, visibleText: offText }, on }, liveRegions: regions },
      null,
      2,
    ),
  );
});
