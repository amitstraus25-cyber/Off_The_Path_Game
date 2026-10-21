/*
 * Two guards that the project's own horizontal-fit assertion cannot provide.
 *
 * 1. Pixel art lands on whole source pixels, and never spills the slot that holds it.
 * 2. Nothing in the world header or the HUD is painted outside the viewport.
 *
 * The second one exists because `ui.spec.ts` asserts `documentElement.scrollWidth <= innerWidth`,
 * and every panel in this game hangs off a `position: fixed` root, which never widens the
 * document: that assertion passed on a build with 134px of header overflow at 375, with two of the
 * three capability legs and the only music control off screen and unreachable (UX_REVIEW 5). A
 * fixed layer has no scrollbar and no wheel, so overflow there is not "below the fold", it is
 * gone. Assert per element instead, on the phase that has a verdict recorded -- the trifecta chips
 * only exist once a capability is live, which is why a title-screen check saw nothing.
 */
import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

/*
 * No fallback. This used to default to '/tmp', so every CI run and every local `pnpm e2e` wrote
 * four PNGs nobody reads into a system temp directory -- the screenshots are a reviewing aid for
 * whoever is looking at the scales, not an output of the test, and nothing here reads them back.
 * e2e/capture.spec.ts sets the convention: SHOT_DIR or no files.
 */
const OUT = process.env['SHOT_DIR'];

const SCALE_SIZES = [
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'phone-375x812', width: 375, height: 812 },
  // The scale where --otp-slot-px was missing from the max-width: 640 block, so a 65.5x53 slot
  // held a 64x64 icon and 13px of it hung out of the bottom (UX_REVIEW 8).
  { name: 'phone-390x844', width: 390, height: 844 },
];

/* The two widths UX_REVIEW 5 asks for. */
const FIT_SIZES = [
  { name: 'phone-375x812', width: 375, height: 812 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
];

/** Everything the player should be able to see and reach while walking. */
const HUD_ROOTS = ['.otp-world-frame__header', '.otp-hud-basket', '.otp-hud-goals'];

for (const size of SCALE_SIZES) {
  test(`pixel art scales cleanly at ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c: 'rabbit' });
      store.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    });
    await expect(page.locator('.otp-card')).toBeVisible();
    await page.waitForTimeout(250);
    if (OUT) await page.screenshot({ path: `${OUT}/css-${size.name}.png` });
    await checkArt(page, `${size.name} inspect`);

    /*
     * And again on Results, which is where the basket panel is actually full. On Inspect the slots
     * are still empty, so an .otp-slot check there inspects nothing at all -- which is how a 64x64
     * icon in a 65.5x53 slot survived a guard that already walked every `.otp-slot img`.
     */
    // ENTER_COTTAGE is refused until every skill has a verdict, so all three are decided here.
    await page.evaluate(() => {
      const { store } = window.__otp!;
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
    await expect(page.locator('.otp-basket')).toBeVisible();
    await page.waitForTimeout(250);
    await checkArt(page, `${size.name} results`);

    await context.close();
  });
}

/**
 * Every pixel-art image is a whole multiple, or a clean half or quarter, of its 64px source -- and
 * it sits inside the slot that holds it. A clean scale is not enough on its own: the slot scales
 * with --otp-ui and the icon with --otp-slot-px, so a breakpoint that moves one without the other
 * gives a correctly-scaled icon hanging out of its well. Both of UX_REVIEW 8's scales (0.78 and
 * 0.82) were exactly that.
 */
async function checkArt(page: import('@playwright/test').Page, where: string): Promise<void> {
  const art = await page.evaluate(() => {
    const ratios: { sel: string; w: number; ratio: number }[] = [];
    for (const sel of [
      '.otp-card__icon img',
      '.otp-portrait',
      '.otp-slot img',
      '.otp-hud-slot img',
    ]) {
      for (const el of document.querySelectorAll(sel)) {
        const w = el.getBoundingClientRect().width;
        if (w > 0) ratios.push({ sel, w, ratio: w / 64 });
      }
    }
    const spills: Record<string, unknown>[] = [];
    for (const sel of ['.otp-slot', '.otp-hud-slot']) {
      for (const slot of document.querySelectorAll(sel)) {
        const img = slot.querySelector('img');
        if (!img) continue;
        const s = slot.getBoundingClientRect();
        const i = img.getBoundingClientRect();
        const over = Math.max(
          s.left - i.left,
          i.right - s.right,
          s.top - i.top,
          i.bottom - s.bottom,
        );
        if (over > 0.5)
          spills.push({
            sel,
            slot: `${s.width.toFixed(1)}x${s.height.toFixed(1)}`,
            img: `${i.width.toFixed(1)}x${i.height.toFixed(1)}`,
            over: +over.toFixed(1),
          });
      }
    }
    return { ratios, spills };
  });

  const bad = art.ratios.filter((r) => {
    const q = r.ratio * 4;
    return Math.abs(q - Math.round(q)) > 0.01; // allow 1x, 2x, 0.5x, 0.25x
  });
  expect(bad, `${where}: fractional pixel-art scales ${JSON.stringify(bad)}`).toEqual([]);
  expect(art.spills, `${where}: icons outside their slots ${JSON.stringify(art.spills)}`).toEqual(
    [],
  );
  // A guard that inspects nothing passes for the wrong reason.
  expect(art.ratios.length, `${where}: no pixel art found to measure`).toBeGreaterThan(0);
  console.log(where, JSON.stringify(art.ratios));
}

for (const size of FIT_SIZES) {
  test(`world header and HUD stay on screen at ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    const page = await context.newPage();
    await page.goto('/');
    await startGame(page);
    // All three verdicts, so all three capability legs are lit: the widest the header ever gets.
    await page.evaluate(() => {
      const { store } = window.__otp!;
      for (const [c, s] of [
        ['rabbit', 'cottage-finder'],
        ['owl', 'word-weaver'],
        ['lantern-keeper', 'night-light'],
      ]) {
        store.dispatch({ type: 'MEET', c });
        store.dispatch({ type: 'INSPECT', s });
        store.dispatch({ type: 'VERDICT', s, v: 'allow' });
      }
    });
    await expect(page.locator('.otp-world-frame__header')).toBeVisible();
    await page.waitForTimeout(400);

    const offScreen = await page.evaluate((roots: string[]) => {
      const out: Record<string, unknown>[] = [];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const root of roots) {
        const node = document.querySelector(root);
        if (!node) continue;
        for (const el of [node, ...node.querySelectorAll('*')]) {
          const r = el.getBoundingClientRect();
          // Screen-reader-only text is deliberately a clipped 1px box; it paints nothing.
          if (r.width <= 1 || r.height <= 1) continue;
          const sel = `${root} ${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
          const outside = Math.max(-r.left, r.right - vw, -r.top, r.bottom - vh);
          const internal = (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth;
          if (outside > 0.5) out.push({ sel, reason: 'outside viewport', px: +outside.toFixed(1) });
          else if (internal > 1) out.push({ sel, reason: 'content overflows box', px: internal });
        }
      }
      return out;
    }, HUD_ROOTS);
    expect(
      offScreen,
      `${size.name}: HUD or header painted off screen ${JSON.stringify(offScreen, null, 1)}`,
    ).toEqual([]);

    /*
     * And the music control specifically. It is the only control on Explore, so a player who cannot
     * reach it has music with no way to stop it. (Its setting used to persist in localStorage,
     * which is why this was written; it no longer does, and the rule holds for the page's own
     * lifetime.) --otp-touch-min, not a scaled size: a thumb is the same at every breakpoint.
     */
    const music = await page.evaluate(() => {
      const el = document.querySelector('.otp-music');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        outside: +Math.max(
          -r.left,
          r.right - window.innerWidth,
          -r.top,
          r.bottom - window.innerHeight,
        ).toFixed(1),
      };
    });
    expect(music, `${size.name}: no music control found`).not.toBeNull();
    expect(music!.w, `${size.name}: music control ${JSON.stringify(music)}`).toBeGreaterThanOrEqual(
      44,
    );
    expect(music!.h, `${size.name}: music control ${JSON.stringify(music)}`).toBeGreaterThanOrEqual(
      44,
    );
    expect(
      music!.outside,
      `${size.name}: music control ${JSON.stringify(music)}`,
    ).toBeLessThanOrEqual(0.5);

    await context.close();
  });
}
