/*
 * The stylesheet contract: the numbers docs/UI_FOUNDATIONS.md fixes, asserted against the running
 * build rather than read off the source.
 *
 * Four UX_REVIEW findings landed in CSS and every one of them was a measurement, not an opinion:
 * the Question footer wrapping its primary action into three underlined fragments (6), 21px
 * question options with no gap (12), a 1.075:1 inset ring and four drifted type roles (18), and a
 * panel hanging off the viewport (21). A rule can be correct in the file and wrong in the cascade,
 * so these read getComputedStyle and getBoundingClientRect on the real screens.
 *
 * Run `CSS_MEASURE=1 npx playwright test e2e/css-contract.spec.ts -g measurements --reporter=line`
 * to print the same numbers instead of asserting them; that is where the before/after figures in
 * the fix notes come from.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
// The camera, asked rather than quoted. cameraFor() is the one place the game and the art tooling
// both derive the view from, so a test that wants to know whether a viewport is portrait, or what
// zoom it runs at, asks it instead of restating a rectangle that was wrong for three rounds.
import { REFERENCE_VIEWPORTS, TILE, TITLE_CARD_W, cameraFor } from '@otp/core';
import type { Size } from '@otp/core';
import { startGame } from './helpers';

const MEASURE = !!process.env['CSS_MEASURE'];

/** Every width the review measured the footer wrapping at, plus the two breakpoint edges. */
const PHONE_WIDTHS = [320, 360, 375, 390, 393, 414, 430, 641] as const;

async function openDialogue(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-dialogue')).toBeVisible();
  await expect(page.locator('.otp-dialogue__line')).toContainText('find Grandma.');
}

async function openResults(page: Page): Promise<void> {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'allow' });
    for (const [c, s] of [
      ['owl', 'word-weaver'],
      ['lantern-keeper', 'night-light'],
    ]) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v: 'allow' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
    store.dispatch({ type: 'FINISH' });
  });
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

/**
 * Resizes and waits for the layout to settle. ui/stage.ts republishes --otp-canvas-* from a
 * resize handler, and --otp-panel-w is derived from it, so a measurement taken in the same frame
 * reads the previous width's panel.
 */
async function resize(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, width);
  // Two frames: one for the resize handler, one for the layout it causes.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

interface TextBox {
  lines: number;
  fontSize: number;
  width: number;
  height: number;
}

/**
 * How many lines of text a control actually renders. A one-line control whose box is three lines
 * tall is the whole of finding 6, and the box height alone cannot say so: it is the line count
 * that turns "Show me the skill" into three underlined fragments.
 */
function textBox(page: Page, selector: string): Promise<TextBox | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    // One client rect per line box, which is what wrapping actually produces.
    const tops = new Set(
      Array.from(range.getClientRects())
        .filter((r) => r.height > 0 && r.width > 0)
        .map((r) => Math.round(r.top * 2) / 2),
    );
    const box = el.getBoundingClientRect();
    return {
      lines: tops.size,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      width: Math.round(box.width * 10) / 10,
      height: Math.round(box.height * 10) / 10,
    };
  }, selector);
}

interface Ring {
  shadow: string;
  colour: string | null;
  ground: string;
  /** WCAG contrast of the ring colour against the surface it is drawn inside. */
  ratio: number;
}

/** The ring is a box-shadow, so its colour has to be read out of the shorthand and measured. */
function ring(page: Page, selector: string): Promise<Ring | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const shadow = cs.boxShadow;
    const match = shadow.match(/rgba?\([^)]*\)/);
    const parse = (c: string): number[] =>
      (c.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
    const lum = (rgb: number[]): number =>
      rgb
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const ground = cs.backgroundColor;
    const a = lum(parse(match ? match[0] : ground));
    const b = lum(parse(ground));
    return {
      shadow,
      colour: match ? match[0] : null,
      ground,
      ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 1000) / 1000,
    };
  }, selector);
}

interface TypeRole {
  size: number;
  /** Leading as the section 3 table states it: a ratio of the font size. */
  leading: number;
  /** Tracking as the table states it: a fraction of the em. */
  tracking: number;
  weight: number;
}

function typeRole(page: Page, selector: string): Promise<TypeRole | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    return {
      size: Math.round(size * 100) / 100,
      leading: Math.round((parseFloat(cs.lineHeight) / size) * 1000) / 1000,
      tracking:
        cs.letterSpacing === 'normal'
          ? 0
          : Math.round((parseFloat(cs.letterSpacing) / size) * 1000) / 1000,
      weight: Number(cs.fontWeight),
    };
  }, selector);
}

/* ------------------------------------------------------------------ finding 6 */

test('the Question footer never wraps its primary action on a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: PHONE_WIDTHS[0], height: 812 });
  await openDialogue(page);

  // One boot, then resized: booting the world eight times costs minutes, and everything under
  // test here is a function of the width the moment it is measured.
  for (const width of PHONE_WIDTHS) {
    await resize(page, width, 812);

    const show = (await textBox(page, '.otp-dialogue__show'))!;
    const trust = (await textBox(page, '.otp-dialogue__trust'))!;
    const left = (await textBox(page, '.otp-dialogue__left'))!;

    // The control that opens the skill card is the whole mechanic. One line, always.
    expect(show.lines, `"Show me the skill" at ${width}px`).toBe(1);
    expect(trust.lines, `"Take it as offered" at ${width}px`).toBe(1);
    expect(left.lines, `the counter at ${width}px`).toBe(1);

    // And the quiet action stays legible while it is quiet: the floor rule, on the one control
    // that was absorbing the whole of the footer's squeeze (9.8px at 375).
    expect(trust.fontSize, `"Take it as offered" font-size at ${width}px`).toBeGreaterThanOrEqual(
      12,
    );

    // Relative weight is the design's only device for keeping the unsafe path quiet, so the
    // primary action must stay the larger of the two.
    expect(show.fontSize, `primary vs quiet at ${width}px`).toBeGreaterThan(trust.fontSize);
  }
});

/* ----------------------------------------------------------------- finding 12 */

test('question options meet the 44px touch minimum, with spacing between them', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openDialogue(page);

  for (const width of [375, 768, 1280]) {
    await resize(page, width, 812);

    const rows = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll<HTMLElement>('.otp-option')).map((e) =>
        e.getBoundingClientRect(),
      );
      return {
        heights: boxes.map((b) => Math.round(b.height * 10) / 10),
        gaps: boxes.slice(1).map((b, i) => Math.round((b.top - boxes[i]!.bottom) * 10) / 10),
        touchMin: parseFloat(
          getComputedStyle(document.querySelector('.otp-ui')!).getPropertyValue('--otp-touch-min'),
        ),
      };
    });

    expect(rows.touchMin, 'the project names its own minimum').toBe(44);
    expect(rows.heights.length, `options present at ${width}px`).toBeGreaterThan(1);
    for (const h of rows.heights) {
      expect(h, `option height at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    // WCAG 2.5.8 is satisfied by size or by spacing; the review asks for both, and the 6px focus
    // halo needs the gap so it does not land inside the neighbouring option.
    for (const g of rows.gaps) {
      expect(g, `gap between options at ${width}px`).toBeGreaterThanOrEqual(4);
    }
  }
});

/* ----------------------------------------------------------------- finding 18 */

test('the inset ring is Haze and actually separates the panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await openDialogue(page);

  // UI_FOUNDATIONS section 4: "panels separate from the world by fill contrast and a 2px inset
  // Haze ring, never by elevation". Whisper is not in the section 1 palette at all.
  const haze = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--cyera-haze').trim(),
  );
  expect(haze.toUpperCase()).toBe('#E8C6FF');

  const dialogue = (await ring(page, '.otp-dialogue'))!;
  expect(dialogue.shadow, 'the dialogue keeps its 2px inset ring').toContain('inset');
  // Whisper on Shell measured 1.075:1 — a ring nobody can see is not a separation device, and
  // section 4 forbids replacing it with elevation.
  expect(dialogue.ratio, 'dialogue ring against Shell').toBeGreaterThanOrEqual(1.3);

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'INSPECT', s: 'cottage-finder' }));
  await expect(page.locator('.otp-card')).toBeVisible();
  for (const sel of ['.otp-card', '.otp-basket']) {
    const found = await ring(page, sel);
    if (!found) continue;
    expect(found.shadow, `${sel} keeps its 2px inset ring`).toContain('inset');
    expect(found.ratio, `${sel} ring against its own ground`).toBeGreaterThanOrEqual(1.3);
  }
});

test('no surface is painted in a colour outside the section 1 palette', async ({ page }) => {
  /*
   * Section 1 closes the palette at eight tokens, and says of the ninth: Offwhite "is not listed
   * in the palette block; treat it as text-on-dark only". Whisper is not named anywhere. Both had
   * got in as grounds -- Whisper as the inset ring, Offwhite as the score field and the reveal row
   * nested inside a missed recap row -- so this is a census of what is actually painted, which is
   * the only version of the rule a stylesheet cannot argue with.
   */
  await page.setViewportSize({ width: 1280, height: 860 });
  await openResults(page);

  const offenders = await page.evaluate(() => {
    const banned: Record<string, string> = {
      'rgb(246, 232, 255)': 'Whisper',
      'rgb(251, 251, 251)': 'Offwhite',
    };
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.otp-ui, .otp-ui *'))) {
      const cs = getComputedStyle(el);
      // Backgrounds and the inset ring. `color` is left alone: Offwhite on Black is the one use
      // section 1 does allow, and it is all over the dark headers.
      for (const [prop, value] of [
        ['background-color', cs.backgroundColor],
        ['box-shadow', cs.boxShadow],
      ] as const) {
        for (const [rgb, name] of Object.entries(banned)) {
          if (value.includes(rgb)) {
            found.push(`${el.className || el.tagName} ${prop}: ${name}`);
          }
        }
      }
    }
    return Array.from(new Set(found));
  });
  expect(offenders, 'elements painted in a non-palette colour').toEqual([]);
});

test('the section 3 type roles match the table at full scale', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await openDialogue(page);
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'INSPECT', s: 'cottage-finder' }));
  await expect(page.locator('.otp-card')).toBeVisible();

  const scale = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.otp-ui')!).getPropertyValue('--otp-ui')),
  );
  expect(scale, '--otp-ui is unscaled at 1280x860').toBe(1);

  // Panel numeral: 24 / 93% / -3% / Medium
  expect(await typeRole(page, '.otp-panel__number')).toEqual({
    size: 24,
    leading: 0.93,
    tracking: -0.03,
    weight: 500,
  });
  // Panel title: 14 / +18% tracking / Medium
  const title = (await typeRole(page, '.otp-panel__title'))!;
  expect({ size: title.size, tracking: title.tracking, weight: title.weight }).toEqual({
    size: 14,
    tracking: 0.18,
    weight: 500,
  });
  // Card title: 25 / 105% / -2% / Medium
  expect(await typeRole(page, '.otp-card__title')).toEqual({
    size: 25,
    leading: 1.05,
    tracking: -0.02,
    weight: 500,
  });
  // Row eyebrow: 10 / +14% tracking / Medium
  const eyebrow = (await typeRole(page, '.otp-row__eyebrow'))!;
  expect({ size: eyebrow.size, tracking: eyebrow.tracking, weight: eyebrow.weight }).toEqual({
    size: 10,
    tracking: 0.14,
    weight: 500,
  });

  // Dialogue: 18 / 120% / 0% / Regular. Measured on the line itself, which carried weight 500.
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'BACK' }));
  await expect(page.locator('.otp-dialogue__line')).toBeVisible();
  expect(await typeRole(page, '.otp-dialogue__line')).toEqual({
    size: 18,
    leading: 1.2,
    tracking: 0,
    weight: 400,
  });
});

/* ----------------------------------------------------------------- finding 21 */

test('no panel overhangs the viewport at any reviewed width', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 812 });
  await openDialogue(page);

  for (const width of [320, 375, 414, 768, 1280]) {
    await resize(page, width, 812);
    const modal = await page.evaluate(() => {
      const el = document.querySelector('.otp-panel')!.getBoundingClientRect();
      return { left: Math.round(el.left * 10) / 10, right: Math.round(el.right * 10) / 10 };
    });
    expect(modal.left, `modal panel left edge at ${width}px`).toBeGreaterThanOrEqual(-0.5);
    expect(modal.right, `modal panel right edge at ${width}px`).toBeLessThanOrEqual(width + 0.5);
  }
});

test('Results keeps every surface inside the viewport', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 812 });
  await openResults(page);

  for (const width of [320, 375, 768, 1280]) {
    await resize(page, width, 812);

    const worst = await page.evaluate(() => {
      const sels = ['.otp-screen__inner', '.otp-screen__body', '.otp-basket', '.otp-band'];
      let over = 0;
      let who = 'nothing';
      for (const sel of sels) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = el.getBoundingClientRect();
          const out = Math.max(r.right - innerWidth, -r.left);
          if (out > over) {
            over = out;
            who = sel;
          }
        }
      }
      return { over: Math.round(over * 10) / 10, who };
    });
    expect(worst.over, `${worst.who} hangs off the viewport at ${width}px`).toBeLessThanOrEqual(
      0.5,
    );

    /*
     * Nothing inside Results is wider than the box holding it either. A right edge inside the
     * viewport does not rule out a clip: at 768 a 748px panel sat inside a 722px column and
     * .otp-panel's own `overflow: hidden` swallowed the difference in silence.
     */
    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.otp-screen *'))
        /*
         * `.otp-visually-hidden` is EXEMPT, and not as a convenience: it is a 1px box with
         * `overflow: hidden` whose entire job is to hold text the eye never sees, so
         * `scrollWidth > clientWidth` is its mechanism rather than a symptom. It reads 241>1 and
         * always will. What this assertion is for is VISIBLE content silently swallowed by an
         * ancestor's `overflow: hidden`, which is why the filter is a visible box, not any box.
         * Without the exemption the first screen-reader-only string on Results reddens the suite:
         * that is exactly what happened when the non-compact Trifecta moved here.
         */
        .filter((el) => !el.classList.contains('otp-visually-hidden'))
        .filter((el) => el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.className || el.tagName} ${el.scrollWidth}>${el.clientWidth}`),
    );
    expect(clipped, `content wider than its own box at ${width}px`).toEqual([]);

    /*
     * And the basket wells shrink rather than overflow, so the icon in each one must still fit
     * inside it. Five fixed-width slots needed 319px of a 272px basket at 320.
     */
    const cropped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.otp-slot'))
        .map((slot) => {
          const img = slot.querySelector('img');
          if (!img) return null;
          const s = slot.getBoundingClientRect();
          const i = img.getBoundingClientRect();
          const out =
            Math.max(0, s.left - i.left) +
            Math.max(0, i.right - s.right) +
            Math.max(0, s.top - i.top) +
            Math.max(0, i.bottom - s.bottom);
          return out > 0.5
            ? `${Math.round(i.width)}px icon in a ${Math.round(s.width)}px well`
            : null;
        })
        .filter((x): x is string => x !== null),
    );
    expect(cropped, `basket icons cropped by their well at ${width}px`).toEqual([]);
  }
});

/* ------------------------------------------- finding 21, the remainder: --otp-ui */

/**
 * Every step --otp-ui takes, as the four media blocks in panels.css declare them. The width pair
 * and the height pair are independent, and the scale is meant to be the smaller of the two.
 */
const WIDTH_STEP = (w: number): number => (w <= 380 ? 0.7 : w <= 640 ? 0.78 : 1);
const HEIGHT_STEP = (h: number): number => (h <= 580 ? 0.7 : h <= 780 ? 0.82 : 1);

/** Every corner of the step table, plus the four viewports the review caught it wrong at. */
const SCALE_MATRIX: [number, number][] = [
  [1280, 860],
  [1920, 1080],
  [1366, 768],
  [1280, 700],
  [768, 1024],
  [641, 700],
  [640, 700],
  [430, 932],
  [390, 844],
  [375, 812],
  [375, 667],
  [360, 640],
  [320, 568],
  [812, 375],
];

test('--otp-ui is the smallest step the viewport matches, not the last one declared', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await startGame(page);

  /*
   * Two of the four blocks key off the height and two off the width, so a viewport can match one
   * from each pair -- and the cascade takes whichever is written later, not the smaller. With the
   * height blocks written last a 375x667 phone took 0.82 from `max-height: 780` and rendered 17%
   * LARGER than the same phone at 375x812, which took 0.7. 360x640 and 640x700 did the same.
   *
   * panels.css fixes it by declaring the blocks in descending order of their value, which makes
   * last-wins identical to min(). That is an ORDER, not an expression, so it is one careless
   * insertion away from breaking again -- hence a matrix rather than a spot check. A new step
   * belongs in descending order and in the list above.
   */
  const wrong: string[] = [];
  for (const [w, h] of SCALE_MATRIX) {
    await resize(page, w, h);
    const ui = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.otp-ui')!).getPropertyValue('--otp-ui')),
    );
    const want = Math.min(WIDTH_STEP(w), HEIGHT_STEP(h));
    expect(Number.isFinite(ui), `--otp-ui is a number at ${w}x${h}, not a token stream`).toBe(true);
    if (Math.abs(ui - want) > 0.001) {
      wrong.push(`${w}x${h}: --otp-ui ${ui}, min(${WIDTH_STEP(w)}, ${HEIGHT_STEP(h)}) = ${want}`);
    }
  }
  expect(wrong, 'viewports where --otp-ui is not the smallest matching step').toEqual([]);
});

/* ----------------------------------- finding 21, the remainder: the HUD never covers itself */

/** Overlap in px between one element and each match of a selector, as width x height. */
function overlaps(page: Page, one: string, many: string): Promise<string[]> {
  return page.evaluate(
    ([a, b]) => {
      const first = document.querySelector(a!);
      if (!first) return [`${a} is absent`];
      const ra = first.getBoundingClientRect();
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll(b!))) {
        const rb = el.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 0.5 && h > 0.5) {
          out.push(
            `${a} covers ${Math.round(w)}x${Math.round(h)} of ${b} ` +
              `"${(el.textContent ?? '').trim().slice(0, 24)}"`,
          );
        }
      }
      return out;
    },
    [one, many],
  );
}

/** The three skills, in the order the three characters offer them. */
const OFFERS: [character: string, skill: string][] = [
  ['rabbit', 'cottage-finder'],
  ['owl', 'word-weaver'],
  ['lantern-keeper', 'night-light'],
];

test('the verdict toast never covers an errand goal in portrait', async ({ page }) => {
  test.slow();
  /*
   * The toast docks to the bottom of the viewport, 140px up to clear the touch controls, and in
   * portrait that was exactly where the errand goals are: at 375x812 "Allowed: Night Light" covered
   * the first two of the three goals outright, 178x19 each, and clipped the third. The player was
   * told what they had just done by having the thing it affects hidden. panels.css retargets that
   * layer to the world box in portrait, above the basket pill.
   *
   * One verdict per viewport, because main.ts clears the hint after HINT_MS: a sweep that resizes
   * three times and then measures would be measuring an empty toast, which is a guard that proves
   * nothing.
   */
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await startGame(page);

  const sizes: [number, number][] = [
    [375, 812],
    [390, 844],
    [360, 740],
  ];
  for (const [i, [w, h]] of sizes.entries()) {
    await resize(page, w, h);
    const [c, s] = OFFERS[i]!;
    await page.evaluate(
      ([character, skill]) => {
        const { store } = window.__otp!;
        store.dispatch({ type: 'MEET', c: character });
        store.dispatch({ type: 'INSPECT', s: skill });
        store.dispatch({ type: 'VERDICT', s: skill, v: 'allow' });
      },
      [c, s],
    );
    await expect(page.locator('.otp-toast')).toContainText(/\S/);
    await expect(page.locator('.otp-hud-goal')).not.toHaveCount(0);

    expect(await overlaps(page, '.otp-toast', '.otp-hud-goal'), `at ${w}x${h}`).toEqual([]);
    // And it must not land on the basket either, which is the corner it was moved next to.
    expect(await overlaps(page, '.otp-toast', '.otp-hud-basket'), `at ${w}x${h}`).toEqual([]);
  }
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('the joystick and the A button never cover the HUD', async ({ page }) => {
    test.slow();
    /*
     * The A button is a 72px disc in the viewport's bottom-right corner and the basket pill was in
     * the world's, so on every landscape phone the button covered the last TWO basket slots
     * outright -- 24x20 slots with 24x20 of overlap at 812x375, 844x390 and 740x360. The run's own
     * record of what it is carrying sat behind the button the player presses to add to it.
     *
     * The clearances are tokens.css's numbers (72px disc, 16px off the edge) read from panels.css,
     * which is exactly the kind of coupling that rots, so this measures the overlap instead of
     * trusting either file.
     */
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto('/');
    await startGame(page);

    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    expect(coarse, 'this test is only meaningful with a coarse pointer').toBe(true);

    for (const [w, h] of [
      [812, 375],
      [844, 390],
      [740, 360],
      [375, 812],
      [390, 844],
    ] as const) {
      await resize(page, w, h);
      await expect(page.locator('.otp-a-button')).toBeVisible();
      await expect(page.locator('.otp-hud-slot')).not.toHaveCount(0);

      for (const control of ['.otp-a-button', '.otp-stick']) {
        for (const hud of ['.otp-hud-slot', '.otp-hud-basket__label', '.otp-hud-goal']) {
          expect(await overlaps(page, control, hud), `${control} at ${w}x${h}`).toEqual([]);
        }
      }
    }
  });
});

/* ------------------------------- finding 21, the remainder: below the canvas's own floor */

test('the world chrome stays inside the viewport below 358px', async ({ page }) => {
  test.slow();
  /*
   * ui/stage.ts will not size the canvas below 352 logical pixels, so the chrome drawn around it
   * has a hard minimum of 358px -- and below that the canvas box the frame is anchored to is wider
   * than the window. Everything positioned from that box went with it: at 320 the frame's right
   * border was 35px off screen, the music control 25.7px, and two basket slots 16.6px, with no
   * scrollbar and no wheel because a fixed layer never produces one. The forest is still cropped
   * at the right down here, which is stage.ts's floor; the chrome is not.
   */
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await startGame(page);

  for (const width of [300, 320, 340, 357, 375]) {
    await resize(page, width, 812);
    const outside = await page.evaluate(
      (sels) => {
        const out: string[] = [];
        for (const sel of sels) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const r = el.getBoundingClientRect();
            // Screen-reader-only text is a deliberately clipped 1px box; it paints nothing.
            if (r.width <= 1 || r.height <= 1) continue;
            const over = Math.max(-r.left, r.right - window.innerWidth);
            if (over > 0.5) out.push(`${sel} is ${Math.round(over * 10) / 10}px outside`);
          }
        }
        return out;
      },
      [
        '.otp-world-frame',
        '.otp-world-frame__header',
        '.otp-music',
        '.otp-world-anchor',
        '.otp-hud-basket',
        '.otp-hud-slot',
        '.otp-hud-goals',
      ],
    );
    expect(outside, `world chrome at ${width}px`).toEqual([]);

    // The music control is the only control on Explore and its mute setting persists, so it has to
    // be reachable, not merely on screen: --otp-touch-min, which does not scale.
    const music = await page.evaluate(() => {
      const r = document.querySelector('.otp-music')!.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(music.w, `music control width at ${width}px`).toBeGreaterThanOrEqual(44);
    expect(music.h, `music control height at ${width}px`).toBeGreaterThanOrEqual(44);
  }
});

/* --------------------------------------------- finding 11: the title column and Red */

test('the title column leaves Red on the path it says she is standing on', async ({ page }) => {
  test.slow();
  /*
   * "Red is already standing on the path" was the first thing the hero screen said and it was false
   * at every landscape width: a 430px copy column put its right edge 46px past her, and she renders
   * behind 88%-black at about 1.1:1, which is invisible. The chip has gone with the claim. The
   * camera cannot help -- scrollX is already clamped at the map's left bound -- so the column is
   * the only lever, and widening it hides her again.
   *
   * THIS TEST USED TO MEASURE THE WRONG EDGE. It compared her sprite box's RIGHT edge to the
   * column's, which stays comfortably positive while her left side is buried, and so it passed at
   * 340px with 10px of her hidden -- confirmed by reading the pixels off the built preview, where
   * she lands at x 349..396 at every size from 1280x800 to 1920x1080. The question is whether the
   * column's right edge is left of HER LEFT EDGE, so that is what it now asserts.
   *
   * The edge measured here is the SPRITE BOX's, which starts about 10px left of her first painted
   * pixel because the 32px frame carries transparent padding. So this is the stricter of the two
   * readings: 306px ends at 325 and leaves 14px to the box, 24px to her cape.
   */
  for (const [w, h] of [
    [1280, 800],
    [1280, 860],
    [1440, 900],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.waitForSelector('#game[data-ready="true"]');

    const seen = await page.evaluate(() => {
      const scene = window.__otp!.scene as unknown as {
        redPosition: { x: number; y: number };
        cameras: { main: { width: number; scrollX: number } };
      };
      const canvas = document.querySelector('#game canvas')!.getBoundingClientRect();
      const column = document.querySelector('.otp-title-panel')!.getBoundingClientRect();
      // red.png frames are 32x48 with the origin at her feet (world/forest-scene.ts).
      const zoom = canvas.width / scene.cameras.main.width;
      const left = canvas.left + (scene.redPosition.x - 16 - scene.cameras.main.scrollX) * zoom;
      return {
        clear: Math.round(left - column.right),
        column: Math.round(column.width),
        ui: parseFloat(
          getComputedStyle(document.querySelector('.otp-ui')!).getPropertyValue('--otp-ui'),
        ),
      };
    });
    /*
     * The column is `min(306px * var(--otp-ui), 62%)`, and 306 is TITLE_CARD_W in packages/core --
     * the number the art tooling subtracts from the hero frame to know which columns a visitor
     * cannot see. So the assertion is equality against the constant, not a 310px literal of this
     * spec's own: a literal with four pixels of slack agrees with nothing, and camera.ts claimed
     * this test kept the two in step while never naming the constant at all.
     */
    expect(seen.column, `the title column at ${w}x${h}`).toBe(Math.round(TITLE_CARD_W * seen.ui));
    expect(
      seen.clear,
      `air between the title column and Red's left edge at ${w}x${h}`,
    ).toBeGreaterThanOrEqual(12);
  }
});

/* ---------------------- finding 11, the portrait half: the card and Red's FEET */

interface TitleFrame {
  /** Air between the card's top edge and the bottom of Red's sprite box. Negative is over her. */
  clear: number;
  /** Whole CSS pixels per game pixel, read off the running canvas. */
  zoom: number;
  /** How far the first line sits ABOVE its scroller. Positive means off the start edge. */
  startEdge: number;
  /** The world left uncovered above the card, in TILES, which is the unit framing is argued in. */
  bandTiles: number;
  cardHeight: number;
  feet: number;
}

/**
 * Where Red is on the screen, and what the title card is doing about it.
 *
 * `red.png` frames are 32x48 with the origin at her FEET (world/forest-scene.ts), so her world y
 * IS the bottom edge of her sprite box -- the edge a card docked to the bottom of the viewport
 * covers first, exactly as the column covers her left edge in landscape. Her painted boots stop
 * three rows above it (`RED_FRAME_H` 48 against `FOOT` 45 in tools/graybox), so measuring the box
 * is the stricter of the two readings, which is the same choice the landscape test makes and for
 * the same reason: the round before it, that test measured the edge that could not be covered and
 * passed for a round while she was buried.
 */
function titleFrame(page: Page, tile: number): Promise<TitleFrame> {
  return page.evaluate((px) => {
    const scene = window.__otp!.scene as unknown as {
      redPosition: { x: number; y: number };
      cameras: { main: { width: number; scrollY: number } };
    };
    const canvas = document.querySelector('#game canvas')!.getBoundingClientRect();
    const panel = document.querySelector<HTMLElement>('.otp-title-panel')!;
    const card = panel.getBoundingClientRect();
    const zoom = canvas.width / scene.cameras.main.width;
    const feet = canvas.top + (scene.redPosition.y - scene.cameras.main.scrollY) * zoom;
    /*
     * The start edge belongs to whatever actually SCROLLS, which is now the prose box rather than
     * the card -- ui/Title.tsx moved the copy into `.otp-title__scroll` so the call to action
     * could stay out of it. Measuring the card's own first child would read the scroll box, whose
     * top is pinned by the flex column and can never be pushed anywhere: a guard that passes by
     * construction. The fallback keeps this honest if the wrapper is ever removed.
     */
    const scroller = panel.querySelector<HTMLElement>('.otp-title__scroll') ?? panel;
    const box = scroller.getBoundingClientRect();
    const first = scroller.firstElementChild!.getBoundingClientRect();

    return {
      clear: Math.round(card.top - feet),
      zoom,
      startEdge: Math.round((box.top - first.top) * 10) / 10,
      bandTiles: Math.round(((card.top - canvas.top) / (px * zoom)) * 100) / 100,
      cardHeight: Math.round(card.height),
      feet: Math.round(feet),
    };
  }, tile);
}

test('the title card leaves Red on the path in portrait, as the column does in landscape', async ({
  page,
}) => {
  test.slow();
  /*
   * THE LANDSCAPE FIX ABOVE HAS A PORTRAIT TWIN, AND NOBODY HAD EVER LOOKED AT IT. Portrait docks
   * the card UNDER the world rather than beside it, so the edge it can cover is her feet; and
   * where landscape at least had a declared column width deciding the overlap, portrait had
   * nothing. `max-height: 64vh` never bound -- the copy is 342-384px tall at every phone size and
   * 64vh is 363 at the shortest of them -- so the card's top edge was wherever its own text
   * happened to end, and on a short phone that was on her boots.
   *
   * Measured on the built preview before the fix, air between the card's top edge and the bottom
   * of her 32x48 sprite box:
   *
   *     375x812  +104     390x844  +99     430x932  +144     768x1024  +184
   *     375x667   +11     360x640  -22     390x600   -50     320x568    -49
   *
   * Negative is the card standing on her boots, and everything at or below about 700px tall was
   * negative or within a dozen pixels of it. 320x568, 360x640 and 375x667 are all in this file's
   * own --otp-ui scale matrix, so the suite was already visiting the sizes it was broken at.
   *
   * THE BOUND IS NOT TAKEN FROM THE STYLESHEET. screens.css caps the card against three fifths of
   * the canvas box ui/stage.ts publishes; this reads Red's real position out of the running scene
   * and the card's real rect out of the DOM. Change that fraction and the MEASUREMENT moves while
   * the threshold stays put, which is the opposite of the guard the last round had to throw away.
   * 12px is the landscape test's figure, deliberately the same number.
   */
  const sizes: Size[] = [
    REFERENCE_VIEWPORTS.phone,
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 375, height: 667 },
    { width: 360, height: 640 },
    // Both of the worst two, because they are not the same case: 390x600 takes --otp-ui 0.78 and
    // 320x568 takes 0.7, so the card is a different height on each and only one of them would
    // have proved the other.
    { width: 390, height: 600 },
    { width: 320, height: 568 },
    REFERENCE_VIEWPORTS.tablet,
  ];

  for (const size of sizes) {
    const where = `${size.width}x${size.height}`;
    const camera = cameraFor(size);
    /*
     * Ask the camera whether this is even the frame under test. If the portrait rule ever moves,
     * a size listed here could become a landscape camera and this test would quietly start
     * measuring the side column -- passing, at a size nobody had checked.
     */
    expect(camera.portrait, `${where} is a portrait camera`).toBe(true);

    await page.setViewportSize(size);
    await page.goto('/');
    await page.waitForSelector('#game[data-ready="true"]');

    const seen = await titleFrame(page, TILE);
    expect(seen.zoom, `the camera at ${where} is the one cameraFor() derives`).toBe(camera.zoom);
    expect(
      seen.clear,
      `air between the title card and the bottom of Red's sprite box at ${where} ` +
        `(card top ${seen.feet + seen.clear}, her feet ${seen.feet}, ` +
        `${seen.bandTiles} tiles of world above the card)`,
    ).toBeGreaterThanOrEqual(12);
    /*
     * And the price of the cap has to stay payable. A shorter card means the copy scrolls on a
     * short phone, and a landing screen whose one Lime cannot be reached is not a trade worth
     * making -- so the button has to be wholly on screen, WITHOUT being scrolled to.
     *
     * This used to scroll the card to its end first and ask only whether the button had arrived,
     * which it always had; that is how 34 of 56 visible rows at 320x568 passed for a round. The
     * reading is now taken where the screen opens.
     */
    const cta = await ctaView(page);
    expect(cta.scrollTop, `the title card is at rest at ${where}`).toBe(0);
    expect(
      cta.visible,
      `"Begin the walk" is ${cta.rect[2]}x${cta.rect[3]} and ${cta.visible[0]}x${cta.visible[1]} ` +
        `of it is on screen in the ${cta.cardHeight}px card at ${where}`,
    ).toEqual([cta.rect[2], cta.rect[3]]);
  }
});

/* ------------------- the way in: "Begin the walk" at the scroll position it opens at */

/**
 * Every viewport the entrance is measured at: the four the project reviews on, both landscape
 * phones the suite already visits, and the four short portraits from the --otp-ui scale matrix
 * above, which are where a capped card has least room to spend.
 */
const ENTRANCE_VIEWPORTS: Size[] = [
  REFERENCE_VIEWPORTS.desktop,
  REFERENCE_VIEWPORTS.tablet,
  REFERENCE_VIEWPORTS.phone,
  REFERENCE_VIEWPORTS.phoneLandscape,
  { width: 812, height: 375 },
  { width: 667, height: 375 },
  { width: 375, height: 667 },
  { width: 360, height: 640 },
  { width: 390, height: 600 },
  { width: 320, height: 568 },
];

interface CtaView {
  /** The button's own box as the page lays it out: [x, y, w, h]. */
  rect: [number, number, number, number];
  /** How much of it a player can actually SEE: clipped by the card's box and by the viewport. */
  visible: [number, number];
  /** Where the card's scroller is resting. The whole point of this reading is that it is 0. */
  scrollTop: number;
  /** Whether a tap at the centre of the visible part lands on the button itself. */
  hit: boolean;
  cardHeight: number;
  scrollHeight: number;
}

/**
 * What the one way into the game looks like at the scroll position the screen OPENS at.
 *
 * `titleFrame`'s `ctaReachable` below scrolls the card to its end before it measures, which is a
 * different and much weaker claim: a button that exists somewhere under the fold satisfies it. The
 * title card shows no scrollbar on touch, no fade and no caret, so nothing tells a player there is
 * anything below the fold to scroll to -- which is how "Begin the walk" shipped with zero visible
 * pixels at 844x390, the project's own landscape-phone reference viewport, and the suite stayed
 * green. Nothing is scrolled here, and `scrollTop` is returned so an assertion can prove it.
 *
 * The card clips: `.otp-title-panel` is the scroller in landscape and is capped against the camera
 * in portrait, so the viewport alone does not decide what is on screen. The hit test is the last
 * word -- a button inside both boxes and under something else is still not a way in.
 */
function ctaView(page: Page): Promise<CtaView> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.otp-title-panel')!;
    // Whatever actually scrolls: the prose box if the card has one, else the card itself.
    const scroller = panel.querySelector<HTMLElement>('.otp-title__scroll') ?? panel;
    const card = panel.getBoundingClientRect();
    const cta = panel.querySelector('.otp-cta')!.getBoundingClientRect();
    const left = Math.max(cta.left, card.left, 0);
    const right = Math.min(cta.right, card.right, innerWidth);
    const top = Math.max(cta.top, card.top, 0);
    const bottom = Math.min(cta.bottom, card.bottom, innerHeight);
    const w = Math.max(0, right - left);
    const h = Math.max(0, bottom - top);
    const over =
      w > 0 && h > 0 ? document.elementFromPoint((left + right) / 2, (top + bottom) / 2) : null;
    const r = (n: number): number => Math.round(n);
    return {
      rect: [r(cta.left), r(cta.top), r(cta.width), r(cta.height)],
      visible: [r(w), r(h)],
      scrollTop: Math.round(scroller.scrollTop),
      hit: !!over && !!over.closest('.otp-cta'),
      cardHeight: r(card.height),
      scrollHeight: Math.round(scroller.scrollHeight),
    };
  });
}

/**
 * Asserts the entrance is usable at every viewport in the list, without scrolling anything.
 *
 * Three claims, and the third is the one that makes this a player's reading rather than a
 * geometry exercise: the card is resting where it opened; every row and column of the button is
 * inside both the card's clip and the window; and a tap at the middle of it reaches the button
 * itself rather than something painted over it.
 *
 * NOTHING HERE IS EXPRESSED IN A CSS NUMBER. The bound is the button's own laid-out box, read
 * from the same DOM in the same frame, so changing the card width, the padding, the copy, the
 * --otp-ui step or the portrait cap moves BOTH sides of the comparison and the guard keeps
 * meaning the same thing. A threshold of "59px tall at 844x390" would have to be rewritten by the
 * next person to touch the stylesheet, which is how a guard quietly stops biting.
 */
async function expectEntranceOnScreen(page: Page, sizes: Size[]): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');

  for (const size of sizes) {
    await resize(page, size.width, size.height);
    const where = `${size.width}x${size.height}`;
    const seen = await ctaView(page);
    const [x, y, w, h] = seen.rect;
    const told = `"Begin the walk" is ${w}x${h} at (${x}, ${y}) in a ${where} window, ${
      seen.visible[0]
    }x${seen.visible[1]} of it visible inside a ${seen.cardHeight}px card`;

    // Nothing was scrolled to get this reading, and nothing may be: the card shows no scrollbar on
    // touch, no fade and no caret, so a player is never told there is more below the fold.
    expect(seen.scrollTop, `the title card is at rest at ${where}`).toBe(0);
    expect(seen.visible[1], `${told} -- rows off screen`).toBe(h);
    expect(seen.visible[0], `${told} -- columns off screen`).toBe(w);
    expect(seen.hit, `${told} -- nothing takes a tap at its centre`).toBe(true);
  }
}

test('the one way into the game is on screen the moment the screen opens', async ({ page }) => {
  test.slow();
  /*
   * "Begin the walk" is the page's single Lime call to action and the only entrance to the game,
   * and it had ZERO visible pixels on the project's own landscape-phone reference viewport.
   * Measured on the built preview at DPR 1, at the resting scroll position, before the fix:
   *
   *     844x390  cta=[36,382,181,59]   0 of 59 rows visible   no tap lands on it
   *     812x375  cta=[36,382,181,59]   0 of 59                no tap lands on it
   *     667x375  cta=[36,382,181,59]   0 of 59                no tap lands on it
   *     320x568  cta=[27,527,186,56]  34 of 56
   *     390x600  cta=[30,545,202,58]  47 of 58
   *
   * The card scrolled, so the button existed somewhere below the fold -- but it shows no scrollbar
   * on touch, no fade and no caret, so nothing told the player there was anywhere to scroll to. On
   * a marketing asset that is the whole funnel.
   *
   * THE CHECK THAT LET THIS SHIP IS IN THIS FILE. `titleFrame` below used to scroll the card to
   * its end and then ask whether the button had come into view, which it always had; a button
   * under the fold of a card with no affordance satisfied it. That is why this reads at scrollTop
   * 0 and asserts the number is 0, rather than trusting that nothing scrolled it.
   *
   * ui/Title.tsx now puts the prose in a scroll box of its own with .otp-title__foot outside it,
   * so the button's row is reserved out of the card before the copy gets any. After:
   *
   *     844x390  cta=[36,254,181,59]  59 of 59     812x375  [36,239,181,59]  59 of 59
   *     667x375  cta=[36,239,181,59]  59 of 59     320x568  [27,443,186,56]  56 of 56
   *     390x600  cta=[30,488,202,58]  58 of 58
   *
   * and every viewport that already fitted is unmoved to the pixel -- 1280x800 still puts it at
   * y 559, 375x812 at 705, 768x1024 at 893 -- because the fix only ever takes effect where the
   * card was overflowing.
   */
  await expectEntranceOnScreen(page, ENTRANCE_VIEWPORTS);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('the one way into the game is on screen for the phone the hint is written for', async ({
    page,
  }) => {
    test.slow();
    /*
     * The same assertion as the test above, on the context the defect belongs to -- and it is not
     * the same measurement, because the card's foot is taller here. `titleHint` swaps the keyboard
     * line for the pad line wherever the pad is drawn, and the pad line is the longer string
     * ("About five minutes. The pad and the A button appear once you start walking.", 77
     * characters against 54), so it takes an extra line in the column and the copy above it has
     * that much less room: measured, the card's prose needed 454px rather than 436 at 844x390 and
     * the button sat 19px lower still. The phone held sideways is both the worst case and the
     * device most visitors to a research page arrive on, so it is asserted rather than inferred
     * from the mouse reading.
     */
    await expectEntranceOnScreen(page, ENTRANCE_VIEWPORTS);
  });
});

test('the title card never pushes its own first line off the top of its scroller', async ({
  page,
}) => {
  test.slow();
  /*
   * A centred flex column that overflows its scroller pushes its FIRST child past the start edge,
   * where no scrollbar and no wheel can reach it: the browser will only scroll towards the end.
   * Measured on the built preview at 844x390, where the copy needs 436px of a 308px column: "Off
   * the Path" sat 64px above the top of the card, so the hero screen of a marketing asset opened
   * mid-sentence on a phone held sideways, with the title unreachable by any gesture.
   *
   * `justify-content: safe center` falls back to start alignment exactly when the content
   * overflows and is identical to plain `center` when it does not, which is why 1280x800 is in
   * the list -- it is the case that must not change.
   *
   * Both orientations, because the card overflows in both now: landscape phones by their height,
   * and short portrait phones because the card above is capped against the camera.
   */
  for (const size of [
    REFERENCE_VIEWPORTS.phoneLandscape,
    { width: 667, height: 375 },
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    REFERENCE_VIEWPORTS.desktop,
  ] as Size[]) {
    const where = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    await page.goto('/');
    await page.waitForSelector('#game[data-ready="true"]');

    const seen = await titleFrame(page, TILE);
    expect(
      seen.startEdge,
      `the title card's first line sits ${seen.startEdge}px above the card at ${where}`,
    ).toBeLessThanOrEqual(0.5);
  }
});

/* --------------------------------------- the landing screen is a storybook, not a crypt */

test('the title card is a light ground, and carries the logo that belongs on one', async ({
  page,
}) => {
  test.slow();
  /*
   * The landing screen read as creepy, and the cause was measurable: 36-44% of its pixels were
   * near-black (luminance < 0.045) against 12.0-14.3% on the approved board in reference/. Three
   * CSS declarations did it -- a black page ground, an 88%-black title column and its 94%-black
   * portrait twin. The column is now Shell, like every other panel in the game, which brings the
   * screen to 12.0 / 10.6 / 13.4% at the three review widths.
   *
   * The two halves are asserted together on purpose. reference/brand/logos/README.md allows the
   * white wordmark only on a dark ground, so a future round that darkens this card again without
   * switching the mark back would ship an invisible logo -- and a round that lightens some other
   * dark panel and forgets the mark has the same bug. Tying them in one test is what makes that
   * impossible to do by halves.
   */
  for (const [w, h] of [
    [1280, 800],
    [768, 1024],
    [375, 812],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await page.waitForSelector('#game[data-ready="true"]');

    const seen = await page.evaluate(() => {
      const srgb = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      /*
       * A color-mix() does NOT compute to rgb(): Chromium reports it as
       * `color(srgb 0.964706 0.960784 0.945098 / 0.94)`, with channels in 0..1. Dividing those
       * by 255 reads Shell as near-black, which is how the first draft of this test failed on
       * the very build it was written to approve. The trailing alpha is ignored on purpose --
       * the question is what colour the card declares, not what the forest behind it does to it.
       */
      const luma = (css: string) => {
        const scale = css.startsWith('color(') ? 1 : 1 / 255;
        const [r = 0, g = 0, b = 0] = (css.match(/[\d.]+/g) ?? []).map(Number);
        return 0.2126 * srgb(r * scale) + 0.7152 * srgb(g * scale) + 0.0722 * srgb(b * scale);
      };
      const panel = document.querySelector('.otp-title-panel')!;
      const mark = panel.querySelector('img[src*="cyera-logo"]');
      return {
        ground: luma(getComputedStyle(panel).backgroundColor),
        heading: luma(getComputedStyle(panel.querySelector('.otp-title__mark')!).color),
        markSrc: mark?.getAttribute('src') ?? null,
      };
    });

    // Shell is 0.90; anything under half-way to mid-grey is a dark panel wearing light text.
    expect(seen.ground, `the title card's ground at ${w}x${h}`).toBeGreaterThan(0.5);
    // ...and the heading has to be the dark one, or the card is light-on-light.
    expect(seen.heading, `the title heading at ${w}x${h}`).toBeLessThan(0.2);
    if (seen.markSrc !== null) {
      expect(seen.markSrc, `the wordmark on the light title card at ${w}x${h}`).toContain('black');
    }
  }
});

test('the title subtitle is the muted text role, not a foreground accent', async ({ page }) => {
  /*
   * `.otp-title-panel`'s own comment says the colours under it "are the brand's own semantic roles
   * (cyera-theme.css: heading Deep Purple, text Black, muted Ash) rather than a per-element
   * choice" -- and then set the subtitle in Aubergine, which BRAND_AND_UI section 1 lists as a
   * foreground ACCENT. "That's Not My Grandma" is the second line of the hero screen; in Aubergine
   * it competed with the Deep Purple heading above it, and the same element on the full-screen
   * variant four rules up has been Ash the whole time. One element, two colours, neither explained.
   *
   * Both colours are resolved through the page's own tokens rather than written here as hex, so
   * this agrees with reference/brand/cyera-theme.css by construction instead of by transcription.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');

  const seen = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const resolve = (token: string): string => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const roles = { ash: resolve('--cyera-ash'), aubergine: resolve('--cyera-aubergine') };
    probe.remove();
    const sub = document.querySelector('.otp-title-panel .otp-title__sub');
    return { ...roles, sub: sub ? getComputedStyle(sub).color : null };
  });

  expect(seen.sub, 'the title card renders a subtitle').not.toBeNull();
  expect(seen.sub, 'the subtitle is the muted text role').toBe(seen.ash);
  expect(seen.sub, 'Aubergine is a foreground accent, not a type role').not.toBe(seen.aubergine);
});

test('a Season Mix word carries the weight of the heading it sits in', async ({ page }) => {
  /*
   * Section 2 allows Season Mix for "a single highlighted word in a heading" and nothing else, so
   * the one thing the highlight must not do is read as a different voice from its own heading.
   * `.otp-serif` pinned font-weight: 400, which is what it did everywhere it appears: `Path` at
   * 400 inside an `.otp-title__mark` set at 600, `Spotters` and `Find out.` at 400 inside the 500
   * of `.otp-section-label` and `.otp-band__question`. It is `inherit` now.
   *
   * Asserted as a relationship between each highlight and its own parent, on both screens that
   * carry one, rather than against a list of weights: a heading whose weight is retuned later must
   * take its highlight with it, and a new highlight somewhere else is covered the day it lands.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');

  const census = async (screen: string): Promise<string[]> =>
    page.evaluate((on) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.otp-serif'))) {
        const mine = getComputedStyle(el);
        const theirs = getComputedStyle(el.parentElement!);
        if (mine.fontWeight !== theirs.fontWeight) {
          out.push(
            `${on}: "${(el.textContent ?? '').trim()}" is ${mine.fontWeight} inside a ` +
              `${theirs.fontWeight} ${el.parentElement!.className || el.parentElement!.tagName}`,
          );
        }
        // And the upright cut, which is the claim this rule is really here to hold.
        if (mine.fontStyle !== 'normal') {
          out.push(`${on}: "${(el.textContent ?? '').trim()}" is ${mine.fontStyle}`);
        }
      }
      return out;
    }, screen);

  await expect(page.locator('.otp-title__mark .otp-serif')).toHaveText(/\S/);
  const title = await census('Title');
  await openResults(page);
  await expect(page.locator('.otp-serif')).not.toHaveCount(0);
  const results = await census('Results');
  expect([...title, ...results], 'highlights whose weight fights their own heading').toEqual([]);
});

/* ------------------------------------------------- what the fixes must not break */

interface Indicator {
  what: string;
  outlineColour: string;
  outlineWidth: string;
  shadow: string;
}

/**
 * Tabs until `selector` holds the focus and reports what the ring looks like there.
 *
 * It has to be the Tab key: `:focus-visible` is a heuristic about how the focus arrived, and
 * element.focus() from a script does not satisfy it on a button, so a scripted focus measures an
 * element with no indicator at all and passes or fails for the wrong reason.
 */
async function ringAtFocus(page: Page, selector: string): Promise<Indicator> {
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const found = await page.evaluate((sel) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.matches(sel)) return null;
      const cs = getComputedStyle(el);
      return {
        what: el.className || el.tagName,
        outlineColour: cs.outlineColor,
        outlineWidth: cs.outlineStyle === 'none' ? 'none' : cs.outlineWidth,
        shadow: cs.boxShadow,
      };
    }, selector);
    if (found) return found;
  }
  throw new Error(`Tab never reached ${selector}`);
}

test('the focus indicator stays two-tone on both grounds', async ({ page }) => {
  /*
   * 3px Deep Purple inside a 6px Lilac halo, swapped on the dark headers. Either colour alone
   * vanishes on one of the two grounds -- Deep Purple reads on Shell at 12.7:1 and disappears on
   * Black, Lilac the other way round -- so the pairing IS the indicator, not a decoration on it.
   * docs/UX_REVIEW.md names it among the things a CSS fix could casually destroy, and the fixes in
   * this round move the layer that holds half the focusable controls.
   */
  const purple = 'rgb(68, 19, 99)';
  const lilac = 'rgb(210, 142, 255)';

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await startGame(page);

  // On Black: the music control, which is the only focusable thing on Explore and sits in the
  // world frame's dark header.
  const onBlack = await ringAtFocus(page, '.otp-music');
  expect(onBlack.outlineColour, 'outline on the dark header').toBe(lilac);
  expect(onBlack.outlineWidth, 'outline width on the dark header').toBe('3px');
  expect(onBlack.shadow, 'halo on the dark header').toContain(purple);
  expect(onBlack.shadow, 'the halo is 6px').toContain('6px');

  // On Shell: a question option inside the dialogue panel.
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-option').first()).toBeVisible();
  const onShell = await ringAtFocus(page, '.otp-option');
  expect(onShell.outlineColour, 'outline on a Shell panel').toBe(purple);
  expect(onShell.outlineWidth, 'outline width on a Shell panel').toBe('3px');
  expect(onShell.shadow, 'halo on a Shell panel').toContain(lilac);
  expect(onShell.shadow, 'the halo is 6px').toContain('6px');
});

/* -------------------------------------------------------------- measurements */

test.describe('measurements', () => {
  test.skip(!MEASURE, 'set CSS_MEASURE=1 to print the numbers instead of asserting them');

  test('the way into the game, at the scroll position the screen opens at', async ({ browser }) => {
    test.setTimeout(240_000);
    for (const touch of [false, true]) {
      for (const size of ENTRANCE_VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: size,
          hasTouch: touch,
          isMobile: touch,
        });
        const p = await ctx.newPage();
        await p.goto('/');
        await p.waitForSelector('#game[data-ready="true"]');
        const seen = await ctaView(p);
        console.log(
          `${touch ? 'touch ' : 'mouse '}${size.width}x${size.height}  ` +
            `cta=[${seen.rect.join(',')}]  visible=${seen.visible[0]}x${seen.visible[1]}  ` +
            `hit=${seen.hit}  scrollTop=${seen.scrollTop}  ` +
            `card=${seen.cardHeight}  scrollHeight=${seen.scrollHeight}`,
        );
        await ctx.close();
      }
    }
  });

  test('footer, options, ring, type and overhang', async ({ browser }) => {
    test.setTimeout(240_000);
    const sweep = await browser.newContext({ viewport: { width: 320, height: 812 } });
    const sweepPage = await sweep.newPage();
    await openDialogue(sweepPage);
    for (const width of PHONE_WIDTHS) {
      const page = sweepPage;
      await resize(page, width, 812);
      const show = (await textBox(page, '.otp-dialogue__show'))!;
      const trust = (await textBox(page, '.otp-dialogue__trust'))!;
      const foot = await page.evaluate(() => {
        const f = document.querySelector('.otp-dialogue__foot')!.getBoundingClientRect();
        const p = document.querySelector('.otp-panel')!.getBoundingClientRect();
        const opts = Array.from(document.querySelectorAll<HTMLElement>('.otp-option')).map((e) =>
          e.getBoundingClientRect(),
        );
        return {
          footW: Math.round(f.width * 10) / 10,
          panelOver: Math.round((p.right - innerWidth) * 10) / 10,
          optH: opts.map((b) => Math.round(b.height * 10) / 10),
          optGap: opts.slice(1).map((b, i) => Math.round((b.top - opts[i]!.bottom) * 10) / 10),
        };
      });
      console.log(
        `${width}px  foot=${foot.footW}  show=${show.lines}ln ${show.fontSize}px ` +
          `${show.width}x${show.height}  trust=${trust.lines}ln ${trust.fontSize}px ` +
          `${trust.width}x${trust.height}  options=${foot.optH.join(',')} ` +
          `gaps=${foot.optGap.join(',')}  panelOverhang=${foot.panelOver}`,
      );
    }
    await sweep.close();

    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await openDialogue(page);
    const dialogueRing = (await ring(page, '.otp-dialogue'))!;
    console.log(
      `ring .otp-dialogue: ${dialogueRing.colour} on ${dialogueRing.ground} = ` +
        `${dialogueRing.ratio}:1`,
    );
    for (const sel of ['.otp-panel__number', '.otp-panel__title', '.otp-dialogue__line']) {
      const role = await typeRole(page, sel);
      console.log(
        role
          ? `${sel}: ${role.size}px / ${Math.round(role.leading * 100)}% / ` +
              `${Math.round(role.tracking * 1000) / 10}% / ${role.weight}`
          : `${sel}: absent`,
      );
    }
    await page.evaluate(() =>
      window.__otp!.store.dispatch({ type: 'INSPECT', s: 'cottage-finder' }),
    );
    await expect(page.locator('.otp-card')).toBeVisible();
    for (const sel of ['.otp-card__title', '.otp-row__eyebrow']) {
      const role = await typeRole(page, sel);
      console.log(
        role
          ? `${sel}: ${role.size}px / ${Math.round(role.leading * 100)}% / ` +
              `${Math.round(role.tracking * 1000) / 10}% / ${role.weight}`
          : `${sel}: absent`,
      );
    }
    const cardRing = (await ring(page, '.otp-card'))!;
    console.log(`ring .otp-card: ${cardRing.colour} on ${cardRing.ground} = ${cardRing.ratio}:1`);
    await context.close();

    for (const width of [320, 375, 768, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 812 } });
      const p = await ctx.newPage();
      await openResults(p);
      const over = await p.evaluate(() =>
        ['.otp-screen__inner', '.otp-screen__body', '.otp-basket', '.otp-band'].map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return `${sel}: absent`;
          const r = el.getBoundingClientRect();
          return `${sel}: right-innerWidth=${Math.round((r.right - innerWidth) * 10) / 10}`;
        }),
      );
      // Anything whose own content is wider than its box: that is what "clips" looks like from
      // the inside, and a right edge inside the viewport does not rule it out.
      const clipped = await p.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.otp-screen *'))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
          .map((el) => `${el.className || el.tagName}:${el.scrollWidth}>${el.clientWidth}`)
          .slice(0, 8),
      );
      console.log(`results ${width}px  ${over.join('  ')}  clipped=[${clipped.join(' ')}]`);
      await ctx.close();
    }
  });
});
