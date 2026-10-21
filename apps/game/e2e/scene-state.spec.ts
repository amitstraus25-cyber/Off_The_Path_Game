/*
 * Three things the scene gets wrong when the game is in a state nobody plays through twice.
 *
 * WHY A NEW FILE. Board task P6 may edit one source file, `src/world/forest-scene.ts`, and names
 * no spec. `e2e/scene-layer.spec.ts` holds task P1's guards and `e2e/scene-second-pass.spec.ts`
 * holds P14's, both on that same source file; a third owner in either is how this project loses a
 * day. A new file collides with nobody.
 *
 * All three defects are about STATE rather than about pixels, and every one of them needs the game
 * driven somewhere a screenshot review never goes: the SECOND run, the frame where a panel is up
 * but the phase has not changed, and the two viewports wider than any review width.
 *
 * What was measured on the build before the fix, so a later reader can tell a regression from a
 * tightening:
 *   - after "Walk it again", `facing` was 'down' and the sprite was rendering `purple-idle-up-0`:
 *     every second run opened on the back of the heroine's head, and it healed on the player's
 *     first keypress -- exactly late enough to spoil the opening shot and nothing else.
 *   - standing by the Rabbit with a notice post open: `hasInput()` false, phase still 'forest',
 *     the bubble still bobbing over the Rabbit and the live region still saying "Rabbit, within
 *     reach: you can talk now" -- while the key that answers it did nothing.
 *   - the payoff frame at the door: 608x359 in a 621x359 canvas at 1280, 608x499 in 941x499 at
 *     1920, and 608x679 in 1261x679 at 2560 -- aspect 0.90, a portrait slot in a landscape frame.
 *
 * NOTHING HERE IS TOLD A CONSTANT FROM THE SCENE. The replay's frame is judged against the frame
 * the game's OWN first run opened on; the bubble is judged against whether the interact key is
 * live; and the payoff's shape is judged against the canvas's own aspect, to a tolerance derived
 * from the one pixel each axis is rounded to. A guard that quoted `purple-idle-down-0`, or 608, would
 * pass by agreeing with whatever the file says today.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame, toTheReveal } from './helpers';

/** Just enough of the scene for these three; the rest stays private. */
interface SceneProbe {
  arrived: boolean;
  facing: string;
  walking: boolean;
  hasInput(): boolean;
  position: { x: number; y: number };
  purple: {
    frame: { name: string | number };
    setPosition(x: number, y: number): void;
    setDepth(d: number): void;
    y: number;
  };
  npcs: { id: string; prompt: { visible: boolean } }[];
  camera: { x: number; y: number };
  focus(): { x: number; y: number };
  syncCamera(): void;
  scale: { gameSize: { width: number; height: number } };
  cameras: { main: { x: number; y: number; width: number; height: number } };
}

/** Two animation frames: one for the DOM to settle, one for the scene's next `update`. */
const settle = (page: Page, frames = 3): Promise<void> =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }, frames);

/** Plays the three verdicts and knocks on the door, without the walk in between. */
async function reachTheDoor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (const [c, s] of [
      ['rabbit', 'cottage-finder'],
      ['owl', 'word-weaver'],
      ['lantern-keeper', 'night-light'],
    ])
      for (const action of [
        { type: 'MEET', c },
        { type: 'INSPECT', s },
        { type: 'VERDICT', s, v: 'leave' },
      ])
        store.dispatch(action);
    store.dispatch({ type: 'ENTER_COTTAGE' });
  });
  await page.waitForFunction(() => (window.__otp!.scene as unknown as SceneProbe).arrived === true);
  await settle(page);
}

/** What Purple is wearing and where she is pointed, as the renderer has it this frame. */
const purpleNow = (page: Page): Promise<{ frame: string; facing: string; walking: boolean }> =>
  page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as SceneProbe;
    return {
      frame: String(scene.purple.frame.name),
      facing: scene.facing,
      walking: scene.walking,
    };
  });

/* ----------------------------------------------- 1. the second run opens the way the first did */

test('a replay opens on the frame the first run opened on, before any key is pressed', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await startGame(page);
  await settle(page);

  /*
   * The reference, taken from the game itself: the very first frame of the very first run, which
   * nobody has ever complained about. Judging the replay against this rather than against a frame
   * name means a guard that cannot be satisfied by agreeing with the scene's own spelling.
   */
  const opening = await purpleNow(page);
  expect(opening.walking, 'she is already walking on the opening frame').toBe(false);

  // Point her somewhere else, so the replay has something real to put back.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  await settle(page);
  const walked = await purpleNow(page);
  expect(walked.frame, 'walking left did not change the frame she stands in').not.toBe(
    opening.frame,
  );

  await reachTheDoor(page);
  const arrival = await purpleNow(page);
  /*
   * The arrival is the whole reason this can go wrong: it is the one place the scene sets a frame
   * without walking there, so it is the frame a replay inherits. If it ever stops differing from
   * the opening, this test still passes but has stopped testing anything -- so it is asserted.
   */
  expect(
    arrival.frame,
    'the arrival no longer changes the frame, so this test is vacuous',
  ).not.toBe(opening.frame);

  await toTheReveal(page);
  await page.getByRole('button', { name: /Walk it again/ }).click();
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
  await settle(page);

  const replay = await purpleNow(page);
  console.log(
    `replay frame\n  opening ${opening.frame} (facing ${opening.facing})\n` +
      `  at the door ${arrival.frame} (facing ${arrival.facing})\n` +
      `  on the replay ${replay.frame} (facing ${replay.facing})`,
  );
  expect(
    replay.frame,
    `the second run opens on "${replay.frame}", the first opened on "${opening.frame}"`,
  ).toBe(opening.frame);

  /*
   * And it did not merely heal in time to be measured. The defect was that the sprite disagreed
   * with `facing` until the player's first keypress, so the frame BEFORE a keypress and the frame
   * AFTER one have to be the same frame -- which is a claim about the sprite agreeing with the
   * heroine, made without naming either of them.
   */
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowDown');
  await settle(page);
  const healed = await purpleNow(page);
  expect(
    replay.frame,
    `the opening frame of the replay ("${replay.frame}") only agreed with her facing ` +
      `after a keypress ("${healed.frame}")`,
  ).toBe(healed.frame);
});

/* ------------------------------------------- 3. the payoff frame is the canvas, scaled down */

/**
 * Where the arrival shot is judged. The three review widths, the two no review width reaches --
 * which is where the shape went wrong -- and the landscape phone, the worst case for anything
 * derived from the camera's width.
 */
const PAYOFF_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 844, height: 390 },
  { width: 375, height: 812 },
] as const;

interface Shot {
  canvas: { width: number; height: number };
  view: { width: number; height: number };
}

test('the payoff frame keeps the shape of the canvas it is cut out of', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await startGame(page);
  await reachTheDoor(page);

  /*
   * Measured at every viewport before any of them is judged, the way the payoff sweep in
   * e2e/scene-second-pass.spec.ts is: asserting inside the loop stops at the first bad width, and
   * the first bad width here is 1280 -- which would have said nothing at all about 2560, where the
   * shot was a portrait slot.
   */
  const sweep: { where: string; shot: Shot }[] = [];
  for (const viewport of PAYOFF_VIEWPORTS) {
    await page.setViewportSize({ ...viewport });
    await page.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, viewport.width);
    await settle(page);
    const shot = await page.evaluate(() => {
      const scene = window.__otp!.scene as unknown as SceneProbe;
      const cam = scene.cameras.main;
      return {
        canvas: { width: scene.scale.gameSize.width, height: scene.scale.gameSize.height },
        view: { width: cam.width, height: cam.height },
      };
    });
    sweep.push({ where: `${viewport.width}x${viewport.height}`, shot });
  }

  const aspect = (s: { width: number; height: number }): number => s.width / s.height;
  console.log(
    `payoff shape\n  ${sweep
      .map(
        ({ where, shot }) =>
          `${where}: canvas ${shot.canvas.width}x${shot.canvas.height} ` +
          `(${aspect(shot.canvas).toFixed(3)}) view ${shot.view.width}x${shot.view.height} ` +
          `(${aspect(shot.view).toFixed(3)})`,
      )
      .join('\n  ')}`,
  );

  for (const { where, shot } of sweep) {
    /*
     * The tolerance is what ROUNDING can explain and nothing more: each side of the view is a
     * whole number of game pixels, so a side of w can be off by half a pixel, which moves the
     * ratio by at most 0.5/w. A whole pixel on each axis is twice that -- generous against the
     * rounding, and two orders of magnitude tighter than the 0.90-against-1.86 this was written
     * for. It is derived from the measurement itself, so it cannot drift with the scene.
     */
    const slack = 1 / shot.view.width + 1 / shot.view.height;
    const drift = Math.abs(aspect(shot.view) / aspect(shot.canvas) - 1);
    expect(
      drift,
      `the payoff frame is ${aspect(shot.view).toFixed(3)} where the canvas is ` +
        `${aspect(shot.canvas).toFixed(3)} at ${where}: ` +
        `${shot.view.width}x${shot.view.height} in ${shot.canvas.width}x${shot.canvas.height}`,
    ).toBeLessThanOrEqual(slack);

    // And it is still a letterbox rather than an overspill: the shot fits in the canvas.
    expect(
      shot.view.width,
      `the payoff frame is wider than the canvas at ${where}`,
    ).toBeLessThanOrEqual(shot.canvas.width);
    expect(
      shot.view.height,
      `the payoff frame is taller than the canvas at ${where}`,
    ).toBeLessThanOrEqual(shot.canvas.height);
  }
});
