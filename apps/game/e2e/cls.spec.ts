/*
 * THE TITLE SCREEN MUST NOT REASSEMBLE ITSELF.
 *
 * Nothing in this repo looked at layout stability, and the first screen of the asset was the worst
 * thing in it: ui/stage.ts publishes --otp-canvas-x/y/w/h and three position:fixed layers are
 * positioned entirely from them, so until that has run once the world frame, the title dock and
 * the HUD lay themselves out against 0px fallbacks. The fit used to run on `worldReady`, after
 * BootScene had loaded every asset, which put a single enormous layout shift between the first
 * paint and the screen the visitor actually reads -- measured at CLS 0.7811 at 1280x800, 0.4003 at
 * 768x1024 and 0.2192 at 375x812, against a "good" bound of 0.1 and a "poor" bound of 0.25.
 *
 * main.ts now fits the stage on Phaser's `boot`, which happens before any scene preloads and
 * before the first Preact render, so the first paint is the final layout. This is the guard that
 * keeps it there: move the fit back behind an await and these three tests go red.
 *
 * It is not a vacuous guard. The probe was run against the build from before the fix and read
 * 0.7811 / 0.4003 / 0.2192, i.e. it discriminates; and `atReady` being non-null is asserted below
 * so a test cannot pass by never reaching the gate it is supposed to measure up to.
 */
import { expect, test } from '@playwright/test';
import { REFERENCE_VIEWPORTS } from '@otp/core';
import { ready } from './helpers';

/** The 'layout-shift' entry, which TypeScript's DOM lib does not describe. */
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface ClsReport {
  /** Every un-prompted shift so far. */
  total: number;
  /** The same sum, frozen the moment `#game[data-ready]` appeared. Null means it never did. */
  atReady: number | null;
  /** False if the browser refused the observer, so an unsupported API fails rather than passes. */
  observed: boolean;
}

/** web.dev's "good" bound. 0.25 and over is "poor". The shipped figure is 0. */
const GOOD_CLS = 0.1;

/*
 * The three viewports the project reviews at, from the module that owns them rather than typed
 * out again here. The landscape phone is left to css-contract.spec.ts, which is where the
 * side-docked geometry it is the worst case for is already measured.
 */
const VIEWPORTS = [
  { name: 'desktop', size: REFERENCE_VIEWPORTS.desktop },
  { name: 'tablet', size: REFERENCE_VIEWPORTS.tablet },
  { name: 'phone', size: REFERENCE_VIEWPORTS.phone },
] as const;

for (const { name, size } of VIEWPORTS) {
  test(`the title screen lands in place at ${name} ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height });

    // In an init script, so the observer is installed before the document the game paints into.
    await page.addInitScript(() => {
      const w = window as unknown as { __otpCls: ClsReport };
      const report: ClsReport = { total: 0, atReady: null, observed: false };
      w.__otpCls = report;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as LayoutShift;
          if (!shift.hadRecentInput) report.total += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      report.observed = true;
      // Polled rather than watched: this runs before documentElement exists, so there is nothing
      // to hand a MutationObserver yet.
      const poll = setInterval(() => {
        if (document.getElementById('game')?.dataset['ready'] === 'true') {
          report.atReady = report.total;
          clearInterval(poll);
        }
      }, 4);
    });

    await page.goto('/');
    await ready(page);
    // Long enough for the fonts, the first rendered frame and any late reflow to have landed.
    await page.waitForTimeout(1000);

    const cls = await page.evaluate(() => (window as unknown as { __otpCls: ClsReport }).__otpCls);

    expect(cls.observed, 'the browser recorded layout-shift entries').toBe(true);
    expect(cls.atReady, 'the probe saw #game[data-ready] and froze a reading there').not.toBeNull();
    expect(cls.atReady ?? Number.POSITIVE_INFINITY, 'CLS up to the ready gate').toBeLessThan(
      GOOD_CLS,
    );
    expect(cls.total, 'CLS for the whole settled title screen').toBeLessThan(GOOD_CLS);
  });
}
