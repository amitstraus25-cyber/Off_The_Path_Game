/*
 * THE ERRAND GOALS ON A PHONE, WHERE THEY ARE A DROP-DOWN.
 *
 * The client's note was "the words are like taking up the whole screen". Measured on the built
 * game before this round, the GRANDMA ASKED FOR panel stood open across the top of the world and
 * took 94.7% of its WIDTH and 17.4% of its height at 375x812 -- 16.5% of the visible world by area,
 * 22.2% at 320x568 and 37.9% of the height of a landscape world at 568x320. A phone's world is only
 * 11.5 tiles across and 16.7 down to begin with (`packages/core` stageFit floors the zoom on the
 * width, so no portrait phone ever reaches zoom 2), so that panel was a horizon.
 *
 * It is now a bar that opens on a tap. This file is the guard on the three things that can quietly
 * undo that, each of which has already happened once here or in a neighbouring rule:
 *
 *   1. THE BAR GROWS BACK. A bound on how much of the world it may take, measured against the
 *      canvas that is actually on screen rather than against any number in the stylesheet.
 *   2. THE ROWS NEVER LEAVE. `.otp-hud-goals__list` is `display: flex`, and an author `display`
 *      beats the user-agent sheet's `[hidden] { display: none }`. Without one rule in panels.css
 *      the attribute is set, `aria-expanded` says closed, the accessibility tree agrees -- and all
 *      three rows stay painted across the world. Every rect-based guard in e2e/ui.spec.ts would
 *      still pass, because they measure overlap and the rows would not have moved.
 *   3. THE KEYBOARD STOPS WORKING. `world/input.ts` calls preventDefault() on Space and Enter at
 *      the WINDOW whenever the world owns the keyboard, and a button's activation is a default
 *      action performed after propagation -- so Enter on this bar did nothing at all until the
 *      component took the two keys out of the air itself. Tapping worked the whole time, which is
 *      why only a keyboard test can see it.
 *
 * The bounds below are LITERALS measured off the running game, deliberately not re-derived from
 * --otp-touch-min or from the panel's own padding: a guard that recomputes the thing it is watching
 * passes whatever that thing becomes.
 */
import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

/** Portrait and landscape, from the smallest phone this project tests at upwards. */
const PHONES: readonly (readonly [number, number])[] = [
  [375, 812],
  [390, 844],
  [320, 568],
  [375, 667],
  [360, 740],
  [568, 320],
  [844, 390],
];

interface Geometry {
  readonly viewport: { w: number; h: number };
  readonly world: { w: number; h: number };
  /** The goals box: the bar alone when closed, the bar and the list when open. */
  readonly box: { x: number; y: number; w: number; h: number };
  readonly expanded: string | null;
  /** Height of each goal row as it is actually painted; 0 for a row that is not. */
  readonly rows: number[];
  /** Overlap with each pad control, as width x height, for anything the goals paint. */
  readonly overlaps: string[];
}

async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const rect = (sel: string): DOMRect | null =>
      document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const world = rect('canvas')!;
    const box = rect('.otp-hud-goals')!;

    /*
     * Overlap is measured against what is VISIBLE, not against where a node was laid out. On the
     * shortest landscape phone the opened list is bounded above the basket pill and scrolls, so a
     * row below the fold still reports its laid-out rect while painting nothing -- a bare
     * getBoundingClientRect() would call that a collision. Each row is clipped to its scroller
     * first, which is what the eye sees.
     */
    const clip = document.querySelector('.otp-hud-goals__list')?.getBoundingClientRect() ?? null;
    const painted: DOMRect[] = [];
    const rows: number[] = [];
    for (const el of Array.from(document.querySelectorAll('.otp-hud-goal'))) {
      const r = el.getBoundingClientRect();
      const top = clip ? Math.max(r.top, clip.top) : r.top;
      const bottom = clip ? Math.min(r.bottom, clip.bottom) : r.bottom;
      rows.push(Math.max(0, Math.round((bottom - top) * 10) / 10));
      if (bottom - top > 0.5) {
        painted.push(new DOMRect(r.x, top, r.width, bottom - top));
      }
    }

    const overlaps: string[] = [];
    for (const control of ['.otp-stick', '.otp-a-button']) {
      const c = rect(control);
      if (!c) continue;
      for (const [name, r] of [
        ['the bar', rect('.otp-hud-goals__summary')],
        ...painted.map((p, i) => [`goal ${i + 1}`, p] as const),
      ] as readonly (readonly [string, DOMRect | null])[]) {
        if (!r) continue;
        const w = Math.min(c.right, r.right) - Math.max(c.left, r.left);
        const h = Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top);
        if (w > 0.5 && h > 0.5) {
          overlaps.push(`${control} covers ${Math.round(w)}x${Math.round(h)} of ${name}`);
        }
      }
    }

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      world: { w: world.width, h: world.height },
      box: { x: box.x, y: box.y, w: box.width, h: box.height },
      expanded:
        document.querySelector('.otp-hud-goals__summary')?.getAttribute('aria-expanded') ?? null,
      rows,
      overlaps,
    };
  });
}

test.describe('the errand goals on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('closed, the goals are a bar and not a horizon', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: PHONES[0]![0], height: PHONES[0]![1] });
    await page.goto('/');
    await startGame(page);
    expect(
      await page.evaluate(() => matchMedia('(hover: none)').matches),
      'this file is only meaningful where the drop-down is the layout',
    ).toBe(true);

    for (const [w, h] of PHONES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForFunction((want) => Math.abs(window.innerWidth - want) < 1, w);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );

      const g = await geometry(page);
      const at = `${w}x${h}`;

      // It starts closed, every walk and after every encounter.
      expect(g.expanded, `aria-expanded at ${at}`).toBe('false');

      /*
       * (2) THE ROWS ARE NOT PAINTED. This is the assertion that fails when `[hidden]` loses to
       * `display: flex`, and it is the only one that can see it: the rows keep their place in the
       * flow, so nothing moves and no overlap appears.
       */
      expect(g.rows, `goal rows painted while closed at ${at}`).toEqual([0, 0, 0]);

      /*
       * (1) AND IT IS SMALL. Measured on the built game the bar is 233.2x44 at every size here:
       * 63.4% of the world's width and 8.2% of its height at 375x812, worst 66.3% and 18.5%. The
       * panel it replaced was 85-95% of the width and 17-38% of the height. The bounds sit between
       * the two with room on both sides -- near enough to catch the panel coming back, far enough
       * that a word added to the heading is not a failure.
       */
      const widthShare = g.box.w / g.world.w;
      const heightShare = g.box.h / g.world.h;
      expect(widthShare, `share of the world's width at ${at}`).toBeLessThan(0.75);
      expect(heightShare, `share of the world's height at ${at}`).toBeLessThan(0.25);

      // And it is still a thumb target: --otp-touch-min, which does not scale with --otp-ui.
      expect(g.box.h, `bar height at ${at}`).toBeGreaterThanOrEqual(44);

      // It is inside the world it is positioned from, at both ends.
      expect(g.box.x, `bar left at ${at}`).toBeGreaterThanOrEqual(-0.5);
      expect(g.box.x + g.box.w, `bar right at ${at}`).toBeLessThanOrEqual(g.viewport.w + 0.5);
      expect(g.overlaps, `the pad against the closed goals at ${at}`).toEqual([]);
    }
  });

  test('open, the list clears the joystick and the A button at every phone size', async ({
    page,
  }) => {
    test.slow();
    /*
     * The history this guards: the touch pad once covered an errand goal outright, and the first
     * cut of this drop-down reintroduced it at the other end of the same device -- opened downwards
     * on a landscape phone the stick covered 73x2 of the second row and 73x19 of the third, because
     * a landscape world is a 238px band and the stick takes the bottom-left 96px of it.
     */
    for (const [w, h] of PHONES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await startGame(page);

      await page.locator('.otp-hud-goals__summary').click();
      const at = `${w}x${h}`;
      const g = await geometry(page);

      expect(g.expanded, `aria-expanded after a tap at ${at}`).toBe('true');
      // Something is on screen: an open list that paints nothing is the bug, not the fix.
      expect(g.rows.filter((r) => r > 0.5).length, `rows painted at ${at}`).toBeGreaterThan(0);
      expect(g.overlaps, `the pad against the open goals at ${at}`).toEqual([]);
    }
  });

  test('the bar opens from the keyboard, which the world would otherwise swallow', async ({
    page,
  }) => {
    /*
     * (3) `world/input.ts` preventDefaults Space and Enter on the window while the world owns the
     * keyboard. Measured before the component handled the keys itself: Tab reached this bar in one
     * press with the focus ring drawn, and Enter and Space then did nothing.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await startGame(page);

    const bar = page.getByRole('button', { name: 'Grandma asked for', exact: true });
    await expect(bar).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Tab');
    await expect(bar).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    expect((await geometry(page)).rows.filter((r) => r > 0.5).length).toBe(3);

    await page.keyboard.press(' ');
    await expect(bar).toHaveAttribute('aria-expanded', 'false');

    /*
     * And opening the goals must not also talk to whoever Purple is standing next to: the bar stops
     * the two keys propagating rather than letting the world see them as well.
     */
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('explore');
  });
});

test('a fine pointer still gets the standing panel, with the rows on screen', async ({ page }) => {
  /*
   * The drop-down is the touch layout and only the touch layout. A desktop window at 375px wide is
   * a reviewer's window, not a phone -- the same argument `Title.padIsHidden` makes about the
   * keyboard hint -- and the panel there is signed off as it is.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await startGame(page);

  await expect(page.locator('.otp-hud-goals')).toHaveAttribute('role', 'group');
  await expect(page.locator('.otp-hud-goals__summary')).toHaveCount(0);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.otp-hud-goal')].map((el) => el.getBoundingClientRect().height),
  );
  expect(rows.length).toBe(3);
  for (const h of rows) expect(h).toBeGreaterThan(1);
});
