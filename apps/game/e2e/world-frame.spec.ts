import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame, tag, tagOf } from './helpers';

/*
 * The frame is furniture, not a screen.
 *
 * `WorldFrame` used to be returned by the explore branch of App's phase switch, so the numbered
 * frame, its header band, the only Cyera wordmark on the page, the music control and the three
 * capability discs all left the document the moment 02 Question opened and came back on the
 * verdict -- twice per encounter, six times a run. CLS scores none of it, because a node that
 * unmounts never shifts: the measurement that catches it is identity and position, which is what
 * every assertion below is.
 *
 * The discs are the reason this is not merely cosmetic. They are the only running display of what
 * the 200-point boundary bonus is scored on, and they vanished exactly while the player was
 * reading the card that decides whether another leg lights.
 */

type Verdict = 'take' | 'leave';

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** The furniture a player should never see leave: frame, header band, wordmark, discs. */
const FRAME = '.otp-world-frame';
const HEADER = '.otp-world-frame__header';
/*
 * The one Cyera wordmark is the cabinet's marquee now (ui/marquee.ts), across the top of every
 * screen; the frame header no longer carries one. It still must never leave, and never double.
 */
const MARK = '.otp-marquee__logo';
/** The lightest thing in the frame's header: its Offwhite title, for the paint-order test. */
const LIT = `${HEADER} .otp-panel__title`;
const DISCS = '.otp-hud .otp-leg';
const MUSIC = '.otp-music';
/** The world's live region: it must be mutated in place, never replaced. */
const ANNOUNCE = '[data-announce="near"]';

async function decide(page: Page, character: string, verdict: Verdict): Promise<void> {
  await page.evaluate(
    ({ character, verdict, skill }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: character });
      store.dispatch({ type: 'INSPECT', s: skill });
      store.dispatch({ type: 'VERDICT', s: skill, v: verdict });
    },
    { character, verdict, skill: SKILL_OF[character]! },
  );
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
}

async function step(page: Page, action: Record<string, unknown>, phase: string): Promise<void> {
  await page.evaluate((a) => void window.__otp!.store.dispatch(a), action);
  await page.waitForFunction((p) => window.__otp!.store.getState().phase === p, phase);
}

/*
 * Every read below is taken only when the node is actually there. A `boundingBox()` or an
 * `evaluate()` on a locator that matches nothing WAITS, so the broken case -- the node having
 * unmounted, which is the whole defect -- came back as a 30s timeout with the word "frame"
 * nowhere in it. Absence is the finding here, so it has to arrive as a value an assertion can
 * name, not as a stalled call.
 */
const present = (page: Page, selector: string) => page.locator(selector).count();

async function boxOf(page: Page, selector: string) {
  if ((await present(page, selector)) === 0) return null;
  return page.locator(selector).first().boundingBox();
}

async function markOf(page: Page, selector: string) {
  if ((await present(page, selector)) === 0) return null;
  return tagOf(page, selector);
}

/** What the player can see of the frame right now, in one shot. */
async function furniture(page: Page) {
  return {
    frame: (await present(page, FRAME)) > 0,
    header: (await present(page, HEADER)) > 0,
    marks: await present(page, MARK),
    discs: await present(page, DISCS),
    lit: await present(page, `${DISCS}--on`),
    music: await boxOf(page, MUSIC),
    /** Lost by a remount, kept by a re-render: the only way to tell the two apart. */
    frameTag: await markOf(page, FRAME),
    musicTag: await markOf(page, MUSIC),
    announceTag: await markOf(page, ANNOUNCE),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await startGame(page);
});

test('the frame and the wordmark stay put through a whole encounter', async ({ page }) => {
  /*
   * One verdict first, so the discs are already lit when the measured encounter starts. The
   * header's width changes when the first leg appears -- the aside gains three discs and the
   * music control is pushed along by them -- and that growth is a separate fault, owned by
   * whoever next opens panels.css. Measuring the SECOND encounter holds the header's contents
   * constant, so a position that moves here moved because something unmounted.
   */
  await decide(page, 'rabbit', 'take');

  const before = await furniture(page);
  expect(before.frame, 'the frame is up on Explore').toBe(true);
  expect(before.header, 'so is its header band').toBe(true);
  expect(before.marks, 'and the one Cyera wordmark').toBe(1);
  expect(before.music, 'the music control has a box to travel from').not.toBeNull();

  await tag(page, FRAME, 'frame');
  await tag(page, MUSIC, 'music');
  /*
   * And the thing hoisting the frame nearly broke on the way past.
   *
   * Preact matches unkeyed siblings by position, and when the vnode at a position changes type it
   * reuses the DOM node of a NEARBY old child of the new type. Leaving an offer turns a `Dialogue`
   * component into the explore layer's plain `<div>`, and the nearest `<div>` to reuse was the
   * announce block -- so the live regions were quietly handed to the toast layer and rebuilt,
   * which is precisely what UX_REVIEW finding 14 says must never happen to them: a region
   * REPLACED with its text already inside is announced by nobody. App.tsx keys the three children
   * that must outlive a panel; this is the assertion that keeps the keys there.
   */
  await tag(page, ANNOUNCE, 'announce');

  for (const [label, action, phase] of [
    // One panel since 2026-10-22: meeting the Owl opens her card by itself.
    ['02 Offer', { type: 'MEET', c: 'owl' }, 'card'],
  ] as const) {
    await step(page, action, phase);
    const now = await furniture(page);
    expect(now.frame, `the frame is still up on ${label}`).toBe(true);
    expect(now.header, `the header band is still up on ${label}`).toBe(true);
    expect(now.marks, `the wordmark has not left on ${label}`).toBe(1);
    expect(now.frameTag, `the frame was re-rendered, not remounted, on ${label}`).toBe('frame');
    expect(now.musicTag, `the music control was not remounted on ${label}`).toBe('music');
    /*
     * Travel, in pixels the player could watch.
     *
     * The bound is 2px and not 0, and the residual is a known, named fault that is not this
     * file's to fix. Opening a card moves the quest chip's count from "0 of 3 skills seen" to
     * "1 of 3 skills seen", and a "1" is 1.58px narrower than a "0" in Haffer, so the chip
     * shrinks and the control beside it slides. The cure is to reserve the count's box --
     * `font-variant-numeric: tabular-nums` on `.otp-chip__count` -- which is panels.css, and
     * panels.css belongs to another owner this round. Measured residual: 1.58px on the first
     * card, 1.16px on the second. The defect this test exists for moved the control 63.72px and
     * took it off the page in between.
     */
    expect(now.music, `the music control is still on screen on ${label}`).not.toBeNull();
    expect(
      Math.abs(now.music!.x - before.music!.x),
      `the music control has not travelled by ${label}`,
    ).toBeLessThan(2);
    expect(
      Math.abs(now.music!.y - before.music!.y),
      `the music control has not changed row by ${label}`,
    ).toBeLessThan(2);
    // Present is not the same as on screen: the frame must still be drawn, not merely mounted.
    await expect(page.locator(FRAME), `the frame is visible on ${label}`).toBeVisible();
  }

  // And out the other side: one continuous frame across the whole encounter, not three.
  await step(page, { type: 'VERDICT', s: SKILL_OF['owl']!, v: 'leave' }, 'forest');
  const after = await furniture(page);
  expect(after.frameTag, 'the same frame node the encounter started with').toBe('frame');
  expect(after.musicTag, 'and the same music control').toBe('music');
  expect(after.announceTag, 'the world speaks into the region that was already there').toBe(
    'announce',
  );
  expect(after.marks).toBe(1);
});

/**
 * The brightest pixel inside an element, as the player's screen actually has it.
 *
 * Chromium decodes its own screenshot: the PNG goes back into the page as a `data:` URL -- which
 * the shipped CSP allows under `img-src 'self' data:` -- is drawn to a canvas, and read back. A
 * `data:` image is same-origin, so the canvas is not tainted and getImageData answers.
 */
async function maxLuma(page: Page, selector: string): Promise<number> {
  const box = (await page.locator(selector).boundingBox())!;
  const data = (
    await page.screenshot({
      clip: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.max(2, Math.round(box.width)),
        height: Math.max(2, Math.round(box.height)),
      },
    })
  ).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
      if (luma > max) max = luma;
    }
    return Math.round(max * 100) / 100;
  }, data);
}

test('a panel is still painted over the frame it is laid over', async ({ page }) => {
  /*
   * The frame stays mounted under the modals now, and it is `position: fixed` exactly as they
   * are, with no z-index anywhere in either stylesheet -- so document order is the whole of the
   * stacking. Mount the frame BELOW the phase switch in App.tsx and the header strip, its Black
   * ground and the white wordmark are painted on top of the modal's dim.
   *
   * Hit-testing cannot see that: `.otp-world-frame` is `pointer-events: none`, so the card takes
   * the pointer at its centre whichever way round they are, and an elementFromPoint assertion
   * passes on the broken case. What a player sees is light: with the card open the wordmark is
   * under a 55% Black wash and goes dull; painted over the wash it stays at full white.
   *
   * The bound is the same wordmark measured on Explore moments earlier, not a number typed in, so
   * it also catches the dim being dropped. Measured: 251 on Explore, 120.5 under the card -- and
   * 251 under the card with the frame mounted after the switch.
   */
  const undimmed = await maxLuma(page, LIT);
  expect(undimmed, 'the header title is near white with nothing over it').toBeGreaterThan(200);

  await step(page, { type: 'MEET', c: 'rabbit' }, 'card');

  const card = page.locator('.otp-card');
  await expect(card).toBeVisible();
  const dimmed = await maxLuma(page, LIT);
  expect(dimmed, 'the card is painted over the frame, so its title is in shade').toBeLessThan(
    undimmed * 0.75,
  );

  // And the pointer still reaches the card: the player can finish the encounter.
  const box = (await card.boundingBox())!;
  const inCard = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.otp-card'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(inCard, 'the card takes the pointer at its own centre').toBe(true);
  await page
    .getByRole('button', { name: /Leave it/ })
    .first()
    .click();
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
});

/*
 * THE QUEST CHIP (UI_FOUNDATIONS section 5, screen 01; the full UX/UI review, 2026-10-22). Nothing
 * on Explore said there were seven people to find, how many had been met, or that the walk was for
 * Grandma -- the header carried only the sound control, with an empty slot for this chip beside it.
 * It must say both halves, count from the store rather than from a number written here, and fit:
 * ui/stage.ts reserves the header's height to the pixel, so anything that does not fit is painted
 * outside the viewport rather than wrapped (panels.css, "The world header on a phone").
 */
for (const [width, height] of [
  [320, 568],
  [375, 812],
  [768, 1024],
  [1280, 800],
] as const) {
  test(`the header says what the walk is for and who is left, and fits, at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await startGame(page);
    const chip = page.locator(`${HEADER} .otp-chip`);
    const total = await page.evaluate(() => window.__otp!.content.characters.length);
    await expect(chip.locator('.otp-chip__label')).toHaveText('Find Grandma');
    await expect(chip.locator('.otp-chip__count')).toHaveText(`0 of ${total} met`);

    await step(page, { type: 'MEET', c: 'rabbit' }, 'card');
    await expect(chip.locator('.otp-chip__count')).toHaveText(`1 of ${total} met`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');

    // Inside the header, inside the viewport, and not under the music control.
    const header = (await page.locator(HEADER).boundingBox())!;
    const music = (await page.locator(MUSIC).boundingBox())!;
    for (const part of ['.otp-chip', '.otp-chip__label', '.otp-chip__count']) {
      const box = (await page.locator(`${HEADER} ${part}`).boundingBox())!;
      expect(box.width, `${part} is drawn`).toBeGreaterThan(0);
      expect(box.x, `${part} starts left of the header`).toBeGreaterThanOrEqual(header.x - 0.5);
      expect(box.y, `${part} rises out of the header`).toBeGreaterThanOrEqual(header.y - 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height + 0.5);
      expect(box.x + box.width, `${part} runs into the music control`).toBeLessThanOrEqual(
        music.x + 0.5,
      );
    }
    expect(music.x + music.width).toBeLessThanOrEqual(width + 0.5);
    // The label is whole, not cut to an ellipsis.
    expect(
      await chip
        .locator('.otp-chip__label')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 0.5),
      'the label is cut short',
    ).toBe(true);
  });
}
