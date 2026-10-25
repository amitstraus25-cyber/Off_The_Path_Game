/*
 * Screenshots the running game at every landmark, for judging the art against the concept board.
 *
 * Skipped unless SHOT_DIR is set, so it costs a normal `pnpm e2e` run nothing:
 *   SHOT_DIR=/tmp/shots npx playwright test e2e/capture.spec.ts
 *
 * It teleports rather than walks. The scene is exposed on window.__otp in E2E builds, and walking
 * to seven landmarks takes minutes and sometimes snags on a tree; this is deterministic and takes
 * seconds. It is a reviewing tool, not a test of movement -- world.spec.ts covers that.
 */
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame, toTheReveal } from './helpers';

const OUT = process.env['SHOT_DIR'];

/** Puts Purple at a named map object and snaps the camera to her. */
async function teleport(page: Page, object: string, dy: number): Promise<void> {
  await page.evaluate(
    ({ object, dy }) => {
      const scene = window.__otp!.scene as unknown as {
        position: { x: number; y: number };
        camera: { x: number; y: number };
        purple: { setPosition(x: number, y: number): void; setDepth(d: number): void; y: number };
        focus(): { x: number; y: number };
        syncCamera(): void;
      };
      const o = window.__otp!.mapObjects!.find((m) => m.name === object);
      if (!o) throw new Error(`map has no object "${object}"`);
      const x = o.x + o.width / 2;
      const y = o.y + o.height + dy;
      scene.position = { x, y };
      scene.purple.setPosition(Math.round(x), Math.round(y));
      scene.purple.setDepth(scene.purple.y);
      scene.camera = scene.focus();
      scene.syncCamera();
    },
    { object, dy },
  );
}

/** Landmark, and how far below it to stand so the thing itself is in frame. */
const PLACES: [name: string, object: string, dy: number][] = [
  ['01-spawn', 'spawn-purple', 0],
  ['02-cottage', 'prop-cottage', 80],
  ['03-stall', 'prop-stall', 64],
  ['04-gate', 'gate-fence-gap', 40],
  ['05-well', 'prop-well', 56],
  ['06-fountain', 'prop-fountain', 56],
  ['07-lantern', 'prop-lantern-post', 56],
  ['08-signpost', 'prop-signpost', 56],
];

test.describe('capture', () => {
  test.skip(!OUT, 'set SHOT_DIR to capture screenshots');

  test('the world at every landmark', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await startGame(page);
    for (const [name, object, dy] of PLACES) {
      await teleport(page, object, dy);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/world-${name}.png` });
      console.log(`shot world-${name}`);
    }
  });

  /*
   * Every screen the game has, at three widths, for a design review.
   *
   * A review that only sees the forest judges a third of the product: most of what a player reads
   * is DOM panels, and `docs/UI_FOUNDATIONS.md` governs those, not the tileset. The widths are the
   * three CLAUDE.md names in its definition of done, and they matter because `--otp-ui` and
   * `--otp-px` step at 640px and 380px, so a panel at 375 is not the 1280 panel scaled.
   */
  const WIDTHS: [label: string, width: number, height: number][] = [
    ['1280', 1280, 860],
    ['768', 768, 1024],
    ['375', 375, 812],
  ];

  for (const [label, width, height] of WIDTHS) {
    test(`every screen at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const shot = async (name: string, settle = 350): Promise<void> => {
        await page.waitForTimeout(settle);
        await page.screenshot({ path: `${OUT}/ui-${label}-${name}.png` });
        console.log(`shot ui-${label}-${name}`);
      };

      await page.goto('/');
      await page.waitForSelector('#game[data-ready="true"]');
      await shot('00-title');

      await startGame(page);
      /*
       * startGame clicks "Begin the walk", and the pointer stays where it was clicked -- which at
       * 375 is inside the stacked verdict pills, so every capture showed one pill filled and two
       * outlined. Three reviewers filed that as a design defect against a product that is correct
       * (docs/UX_REVIEW.md, "where the lenses over-reached"). Park the pointer off-screen so the
       * shots show the resting state.
       */
      await page.mouse.move(0, 0);
      await shot('01-explore');

      // Question: the typewriter needs a beat, or the line is caught mid-type.
      await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
      await shot('02-question', 1200);

      await page.evaluate(() =>
        window.__otp!.store.dispatch({ type: 'INSPECT', s: 'cottage-finder' }),
      );
      await shot('03-inspect');

      /*
       * Then straight through to the end: allow everything, which is both the fastest route and
       * the most interesting one, since it is the run that trips every capability and lands the
       * all-three-at-once warning.
       */
      await page.evaluate(() => {
        const { store } = window.__otp!;
        store.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'take' });
        for (const [c, s] of [
          ['gatekeeper', 'bridge-key'],
          ['owl', 'word-weaver'],
          ['lantern-keeper', 'night-light'],
        ]) {
          store.dispatch({ type: 'MEET', c });
          store.dispatch({ type: 'INSPECT', s });
          store.dispatch({ type: 'VERDICT', s, v: 'take' });
        }
      });
      await shot('04-all-three-live');

      await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
      await shot('05-arrive', 1200);

      await toTheReveal(page);
      await shot('06-results', 600);

      /*
       * No 07-leaderboard shot. The leaderboard is unstarted Phase 6, so `LEADERBOARD` leaves
       * Results on screen and this emitted a file byte-identical to 06-results at every width --
       * which three separate review lenses then reported as a leaderboard screen that "has no
       * design". The review asked for the shot to be dropped or renamed; dropping it stops a
       * screen that does not exist from being reviewed. Put it back when the API lands.
       */
    });
  }
});
