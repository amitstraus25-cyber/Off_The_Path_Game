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
        .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
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
   * behind 88%-black at about 1.1:1, which is invisible. The chip has gone with the claim; the
   * column is 340px, which is the number docs/UX_REVIEW.md finding 11 asks for and leaves 44 of her
   * 64px sprite box clear of it. The camera cannot help -- scrollX is already clamped at the map's
   * left bound -- so the column is the only lever, and widening it hides her again.
   */
  for (const [w, h] of [
    [1280, 860],
    [1440, 900],
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
      const right = canvas.left + (scene.redPosition.x + 16 - scene.cameras.main.scrollX) * zoom;
      return {
        clear: Math.round(right - column.right),
        column: Math.round(column.width),
      };
    });
    expect(seen.column, `the title column at ${w}x${h}`).toBeLessThanOrEqual(384);
    expect(seen.clear, `Red's sprite clear of the column at ${w}x${h}`).toBeGreaterThanOrEqual(40);
  }
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
