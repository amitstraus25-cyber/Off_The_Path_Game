/*
 * Every step of the title card's how-to-play is on screen the moment the screen opens, at every
 * height a player is likely to have -- and where it cannot be, the card says so.
 *
 * WHAT SHIPPED. The how-to-play (ui/Title.tsx) sits inside `.otp-title__scroll`, the card's prose
 * box, and that box shrinks to whatever the card has left after the foot has taken its row. The
 * foot ("Begin the walk" and the hint) is out of the scroller on purpose, so the button is always
 * on screen -- and the steps are what fell off. Measured on the working tree at DPR 1 and DPR 3
 * (identical), the clearance of step 3 to the edge of the box that clips it, negative being cut:
 *
 *     320x568   label and all 3 steps invisible: a 170px (keyboard) / 151px (touch) box, 338px of copy
 *     375x812   inside, flush            390x844   step 3 clipped 3.9px     414x896   inside, flush
 *     768x800   0 rows of the steps      768x1024  inside, flush
 *     1280x800  keyboard flush; TOUCH step 3 clipped 7.3px                  1920x1080 inside, flush
 *     640x400   (a 1280x800 window at 200% zoom) all invisible
 *
 * The card shows no scrollbar, no fade and no caret, so nobody was told there was anything to
 * scroll to, and the suite stayed green because the only title guard in e2e/css-contract.spec.ts
 * measures the BUTTON. That is the same shape as the entrance defect it was written for: a guard
 * pointed at the thing that was fine.
 *
 * WHAT THIS ASKS. Not "is the list in the DOM" -- it always was. For each step: how many pixels of
 * its own box lie outside the area a player can actually see, which is the viewport intersected
 * with every ancestor that clips. Both inputs are read off the page in the same frame, so nothing
 * here is a CSS number: changing the card width, the padding, the copy, the --otp-ui step, the
 * portrait cap or the fit ladder moves BOTH sides of the comparison and the guard keeps meaning the
 * same thing. A threshold of "step 3 sits at y 560 at 1280x800" would have to be rewritten by the
 * next person to touch the stylesheet, which is how a guard quietly stops biting.
 *
 * A SELECTOR THAT MATCHES NOTHING IS A SILENT PASS, and `every()` over an empty array is true. So
 * the count of steps is asserted FIRST and against the content file rather than against a literal:
 * a card whose list is absent, or whose items were renamed out from under the selector, fails
 * here naming the viewport, instead of passing because there was nothing to measure.
 *
 * The matrix is a HEIGHT matrix as well as a width one on purpose. The six sizes the defect was
 * reported at differ more in height than in width -- 768x800 and 768x1024 are the same column
 * and the first has no steps in view -- and a width-only list had put three of the nine inside
 * the fitting set while the other six were clipped.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** The content file: the how-to's steps live in its strict `ui`, the hint in `ui.chrome`. */
const v2 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as { ui: { howTo: { steps: string[] }; chrome: Record<string, string> } };
const strings = v2.ui.chrome;

interface Size {
  width: number;
  height: number;
}

/*
 * The six the task named, then the three that finish the nine the defect was measured at, then the
 * two landscape phones the entrance guard already visits -- the tightest cards the game draws.
 * 640x400 is 1280x800 at 200% zoom: a browser's zoom is just a smaller CSS viewport.
 */
const MATRIX: Size[] = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 414, height: 896 },
  { width: 1920, height: 1080 },
  { width: 640, height: 400 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

interface Seen {
  /** Elements the page actually has under `.otp-howto > li`. */
  steps: number;
  /** For the label, every step and the hint: [what it says, px of its box outside the visible area]. */
  clipped: [string, number][];
  /** Whether a tap at the middle of each step reaches that step and nothing painted over it. */
  covered: string[];
  /** What the card chose: the fit rung, and whether it fell back to a scroll with a cue. */
  fit: string | undefined;
  scrolls: boolean;
  /** The copy is taller than the box it was given. */
  overflows: boolean;
  hint: string;
}

/**
 * The page's answer. One `evaluate` so every number comes from the same layout.
 *
 * The visible area of an element is the viewport narrowed by every ancestor that clips
 * (`overflow` anything but `visible`), which is the dock's scroll box AND the card, in landscape
 * and portrait alike -- the card is the clip in both and the scroller is the clip inside it, so
 * naming either one here would be a bound written against the layout it checks.
 */
function look(page: Page): Promise<Seen> {
  return page.evaluate(() => {
    const clipOf = (el: Element) => {
      let area = { l: 0, t: 0, r: innerWidth, b: innerHeight };
      for (let up = el.parentElement; up; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const box = up.getBoundingClientRect();
        area = {
          l: Math.max(area.l, box.left),
          t: Math.max(area.t, box.top),
          r: Math.min(area.r, box.right),
          b: Math.min(area.b, box.bottom),
        };
      }
      return area;
    };
    /* How far this element's own box lies outside what can be seen; an unrendered box is "all". */
    const outside = (el: Element): number => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (box.width === 0 || box.height === 0 || style.visibility !== 'visible') return Infinity;
      const area = clipOf(el);
      return Math.max(
        0,
        area.l - box.left,
        area.t - box.top,
        box.right - area.r,
        box.bottom - area.b,
      );
    };
    const steps = [...document.querySelectorAll('.otp-howto > li')];
    const label = document.querySelector('.otp-howto__title');
    const hint = document.querySelector('.otp-hint');
    const measured = [...(label ? [label] : []), ...steps, ...(hint ? [hint] : [])];
    const covered = steps.flatMap((step) => {
      const box = step.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top && step.contains(top) ? [] : [step.textContent ?? ''];
    });
    const card = document.querySelector<HTMLElement>('.otp-title-panel');
    const scroller = document.querySelector<HTMLElement>('.otp-title__scroll');
    return {
      steps: steps.length,
      clipped: measured.map((el): [string, number] => [
        (el.textContent ?? '').trim(),
        Math.round(outside(el) * 10) / 10,
      ]),
      covered,
      fit: card?.dataset['fit'],
      scrolls: card?.dataset['scrolls'] === 'true',
      overflows: scroller ? scroller.scrollHeight > scroller.clientHeight : false,
      hint: (hint?.textContent ?? '').trim(),
    };
  });
}

/** The steps the how-to renders, from the content file it is built from (the same on both branches). */
const expectedSteps = (): string[] => v2.ui.howTo.steps;

/** The how-to is its own screen now, one press past the landing. */
async function openHowTo(page: Page): Promise<void> {
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.locator('[data-howto]').waitFor();
}

/** Half a pixel: layout rounds to 1/64 and a step flush with its box is not "outside" it. */
const SUBPIXEL = 0.5;

function describeBranch(name: string, touch: boolean): void {
  test.describe(name, () => {
    test.use({ hasTouch: touch, isMobile: touch });

    test('every step of the how-to-play is inside the visible area when the screen opens', async ({
      page,
    }) => {
      test.slow();
      const want = expectedSteps();
      // The bound below is `want.length`, so the bound being zero would be the silent pass.
      expect(want.length, 'content/game.v2.json defines the how-to-play steps').toBeGreaterThan(0);

      /*
       * Every viewport is measured and every failure is collected before anything is asserted, so
       * one run names ALL the sizes that are wrong. Asserting inside the loop reports the first
       * and stops, which is how a fix that repairs 320x568 and leaves 768x800 would look like
       * progress on the failure it had not got to.
       */
      const failures: string[] = [];
      for (const size of MATRIX) {
        const where = `${size.width}x${size.height} ${touch ? 'touch' : 'keyboard'}`;
        await page.setViewportSize(size);
        await page.goto('/');
        await openHowTo(page);

        const seen = await look(page);
        if (seen.steps !== want.length) {
          // The list is absent or short: nothing below it is a measurement of anything.
          failures.push(
            `${where}: the list has ${seen.steps} steps, the content defines ${want.length}`,
          );
          continue;
        }
        const cut = seen.clipped.filter(([, px]) => px > SUBPIXEL);
        if (cut.length > 0)
          failures.push(
            `${where}: ${cut.length} of ${seen.clipped.length} blocks leave the visible area ` +
              `(fit rung ${seen.fit}${seen.scrolls ? ', scrolling' : ''}): ` +
              cut.map(([text, px]) => `"${text}" by ${px}px`).join('; '),
          );
        if (seen.covered.length > 0) failures.push(`${where}: something is painted over a step`);
        // A scrolling card with nothing to scroll would be a cue pointing at nothing, and a card that
        // fell back to the cue has, by definition, not fitted.
        if (seen.scrolls) failures.push(`${where}: the card fell back to a scroll with a cue`);
      }
      expect(failures, 'viewports at which the how-to-play is not fully on screen').toEqual([]);
    });

    /*
     * THE REGRESSION THIS FILE HAS TO KEEP SHUT. the content cut the hint from "About five
     * minutes. Arrow keys to walk, Space to talk." to "About five minutes.", which made the list
     * the only place the controls were named, and the list was the thing clipped. So the controls
     * are asserted on the hint itself, which lives in the card's foot beside the button and is on
     * screen wherever the button is -- not on the list that was lost.
     *
     * Read against the content file rather than a literal for the same reason as the step count:
     * the question is "does the screen say what the content says", not "does it still spell the
     * words it spelled the day this was written".
     */
    test('the controls are named on the always-visible line, at every size', async ({ page }) => {
      test.slow();
      const want = strings[touch ? 'howToPlayWalkTouch' : 'controlsHint'];
      expect(want, 'content/game.v2.json carries the hint for this branch').toBeTruthy();
      expect(want, 'and it names the controls, not just the running time').toMatch(
        touch ? /joystick/i : /arrow/i,
      );

      const failures: string[] = [];
      for (const size of MATRIX) {
        const where = `${size.width}x${size.height} ${touch ? 'touch' : 'keyboard'}`;
        await page.setViewportSize(size);
        await page.goto('/');
        await ready(page);
        const seen = await look(page);
        const hint = seen.clipped.find(([text]) => text === want);
        if (seen.hint !== want) failures.push(`${where}: the hint reads "${seen.hint}"`);
        else if (!hint || hint[1] > SUBPIXEL)
          failures.push(`${where}: the hint is ${hint?.[1]}px outside the visible area`);
      }
      expect(failures, 'viewports at which the controls line is missing or cut').toEqual([]);
    });

    /*
     * THE LADDER IS LIVE, NOT A ONE-TIME DECISION. Windows are dragged, phones are turned and a
     * browser zooms by changing the CSS viewport, so the card has to re-settle on resize in BOTH
     * directions: down when the room goes, and back up when it returns (the ladder only descends
     * for as long as the room is missing). Loading at 1280x800 and shrinking to 320x568 is the
     * first half, and coming back is the second -- a card that stayed at its tightest rung after
     * the window grew would have thrown away its prose for good.
     */
    test('re-settles when the window changes, and gives the prose back when room returns', async ({
      page,
    }) => {
      test.slow();
      const want = expectedSteps().length;
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await openHowTo(page);
      const roomy = await look(page);
      expect(roomy.steps, 'the list is present at 1280x800').toBe(want);

      /*
       * THE ASSERTION IS THE WAIT. This used to wait for `data-fit !== '0'` and then measure, and
       * that wait was vacuous: 1280x800 already loads on rung 1, so the predicate was true BEFORE
       * the resize applied and the measurement could read the old layout. It failed four runs in
       * eight in isolation and failed a full run under --fail-on-flaky-tests. Polling the real
       * property until it holds cannot pass early and cannot pass on a stale layout.
       */
      await page.setViewportSize({ width: 320, height: 568 });
      await expect
        .poll(
          async () => {
            const s = await look(page);
            return {
              clipped: s.clipped.filter(([, px]) => px > SUBPIXEL),
            };
          },
          { message: 'after shrinking to 320x568 without a reload, every step is visible again' },
        )
        .toEqual({ clipped: [] });

      await page.setViewportSize({ width: 1280, height: 800 });
      await expect
        .poll(async () => (await look(page)).fit, {
          message: 'back at 1280x800 the window gets the same card it got on load',
        })
        .toBe(roomy.fit);
    });
  });
}

describeBranch('on a keyboard', false);
describeBranch('on a touch screen', true);

/*
 * WHERE EVEN THE TINIEST RUNG IS NOT ENOUGH, THE CARD SAYS SO.
 *
 * The ladder cannot buy room that is not there: a phone held sideways at 320px tall, or a narrow
 * portrait window under 400px, has less height than the three steps, the wordmark, the button and
 * the hint need at their floor sizes. The task allowed exactly one honest answer for such a case --
 * "say which and why, and give it a visible cue instead" -- and the answer it forbids is the one
 * the card used to give: clip them below a fold with no scrollbar, no fade and no caret.
 *
 * So for sizes where the copy still overflows, this asserts the three things that make the fold
 * visible and reachable, each measured rather than declared: the card marks itself (`data-scrolls`),
 * the scrollbar a player would see is actually drawn (its computed width is the 6px the stylesheet
 * gives it -- a ::-webkit-scrollbar rule that stopped matching reads as `auto`/0), and scrolling to
 * the end brings the last step wholly into view, so the copy is reachable as well as hinted at.
 *
 * It is NOT asserted that these sizes overflow: if a later round buys the room, they will fit, the
 * cue will have nothing to guard, and the test says so rather than failing. What it refuses is
 * the pass that proves nothing, so it skips when nothing in the list needed the cue.
 */
const CUE_MATRIX: Size[] = [
  { width: 568, height: 320 },
  { width: 640, height: 320 },
  { width: 320, height: 400 },
  { width: 360, height: 400 },
];

test('where the steps cannot all fit, the card draws a cue and they are reachable', async ({
  page,
}) => {
  test.slow();
  let needed = 0;
  for (const size of CUE_MATRIX) {
    const where = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    await page.goto('/');
    await openHowTo(page);
    const seen = await look(page);
    expect(seen.steps, `${where}: the how-to-play list is present`).toBeGreaterThan(0);
    if (!seen.overflows) {
      expect(seen.scrolls, `${where}: a cue is drawn for copy that fits`).toBe(false);
      continue;
    }
    needed += 1;
    expect(seen.scrolls, `${where}: the copy overflows its box and the card does not say so`).toBe(
      true,
    );
    const bar = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.otp-title__scroll')!, '::-webkit-scrollbar')
          .width,
    );
    expect(bar, `${where}: the scrollbar the cue relies on is not drawn`).toBe('6px');

    await page.locator('.otp-title__scroll').evaluate((el) => (el.scrollTop = el.scrollHeight));
    // The LAST step, which is the one a clipped card loses first; the label has scrolled out of the
    // top of the box by then, which is what scrolling is for.
    const last = (await look(page)).clipped.find(([text]) => text === v2.ui.howTo.steps.at(-1));
    expect(last, `${where}: the last step is rendered`).toBeDefined();
    expect(
      last![1],
      `${where}: scrolled to the end, "${last![0]}" is still ${last![1]}px outside the box`,
    ).toBeLessThanOrEqual(SUBPIXEL);
  }
  test.skip(needed === 0, 'every size in the cue matrix now fits, so the cue has nothing to guard');
});
