/*
 * The three things that decide whether the forest reads as finished or as a test level.
 *
 * WHY A NEW FILE. Board task P14 may edit one source file, `src/world/forest-scene.ts`, and names
 * no spec. `e2e/scene-layer.spec.ts` holds task P1's four guards on the same source file and
 * e2e/world.spec.ts belongs to the cleanup round; a new file collides with nobody.
 *
 * Each test is written against something a visitor LOOKS AT, and measured off the rendered frame
 * wherever a rendered frame can answer:
 *
 *  1. nothing in the forest moved. Every character sheet ships an open-eyed frame and a blink, and
 *     no NPC was ever played or set, so eight painted frames shipped to every player and were never
 *     seen. Sampled as the frames actually on screen, per character, over nine seconds.
 *  2. no figure touched the ground. Measured by hiding the shadows and taking the same picture
 *     again: the difference between the two frames is the shadow and nothing else, so no reference
 *     patch of "clean" lawn has to be found and no ground type has to be assumed.
 *  3. the payoff frame only composed near 1280. Measured as where the building lands in the frame
 *     at five viewports, including the two the review widths never reach -- and, because the
 *     remedy is a letterbox, that the letterbox is taken down again for the walk.
 *
 * Nothing here is told a constant from the scene. The blink bounds come from what a blink is, the
 * shadow bound is the review's own "25 luma below the lawn", and the framing bound is the canvas's
 * own centre against the building's own span read from the map.
 *
 * With SHOT_DIR set, the framing test also writes the five arrival frames it measured, the way
 * e2e/capture.spec.ts writes its review shots. It costs a normal run nothing.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { standBetweenTheFirstTwo, startGame, toTheReveal } from './helpers';
import { TILE } from '../src/world/logic';

/** Enough of the scene for these three tests; the rest is private and stays that way. */
interface SceneProbe {
  arrived: boolean;
  purple: { x: number; y: number };
  purpleShadow: { visible: boolean; setVisible(v: boolean): void };
  npcs: {
    id: string;
    sprite: {
      x: number;
      y: number;
      frame: { name: string | number };
      anims: { stop(): void };
      setFrame(frame: number): void;
    };
    shadow: { visible: boolean; setVisible(v: boolean): void };
  }[];
  cameras: {
    main: {
      x: number;
      y: number;
      width: number;
      height: number;
      scrollX: number;
      scrollY: number;
    };
  };
  game: { renderer: { snapshot(cb: (image?: HTMLImageElement) => void): void } };
}

/* ------------------------------------------------------------------ 1. the forest breathes */

interface Watched {
  id: string;
  /** When each blink STARTED, in ms from the start of watching. */
  onsets: number[];
  /** Rendered frames spent away from the open eye, against frames seen in total. */
  blinked: number;
  frames: number;
}

/** Watches the frames the cast is actually rendering, one sample per animation frame. */
async function watchBlinks(page: Page, ms: number): Promise<Watched[]> {
  return page.evaluate((budget) => {
    const npcs = (window.__otp!.scene as unknown as SceneProbe).npcs;
    const seen: Watched[] = npcs.map((n) => ({ id: n.id, onsets: [], blinked: 0, frames: 0 }));
    const was: string[] = npcs.map((n) => String(n.sprite.frame.name));
    const t0 = performance.now();
    return new Promise<Watched[]>((resolve) => {
      const tick = (): void => {
        const at = performance.now() - t0;
        npcs.forEach((n, i) => {
          const now = String(n.sprite.frame.name);
          const row = seen[i]!;
          row.frames++;
          if (now !== '0') row.blinked++;
          if (now !== was[i]) {
            if (now !== '0') row.onsets.push(at);
            was[i] = now;
          }
        });
        if (at < budget) requestAnimationFrame(tick);
        else resolve(seen);
      };
      requestAnimationFrame(tick);
    });
  }, ms);
}

test('every character in the forest blinks, and no two blink on the same beat', async ({
  page,
}) => {
  // Nine seconds: long enough for the whole cast to have come round once, stagger included.
  test.setTimeout(60_000);
  await page.goto('/');
  await startGame(page);

  const seen = await watchBlinks(page, 9000);

  expect(seen.length, 'the forest is empty').toBeGreaterThan(4);
  for (const who of seen) {
    expect(who.frames, `${who.id} was not sampled`).toBeGreaterThan(60);
    expect(
      who.onsets.length,
      `${who.id} never blinked: the sheet's second frame is dead art`,
    ).toBeGreaterThan(0);
    /*
     * And it is a blink rather than a doze or a flicker. A character showing their closed eye for
     * a large share of the time is not blinking, they are asleep -- and the frame is painted to be
     * glimpsed, not read.
     */
    expect(who.blinked / who.frames, `${who.id} spends too long with its eyes shut`).toBeLessThan(
      0.1,
    );
  }

  /*
   * De-synchronised. Eight figures blinking together reads as a glitch in the renderer, which is
   * worse than a forest that does not move at all. Asserted on the FIRST blink of each character,
   * because that is the one a visitor sees on arrival and it is the one a shared period and a
   * shared start would put at the same instant for every one of them.
   */
  const first = seen.map((s) => s.onsets[0]!).sort((a, b) => a - b);
  const gaps = first.slice(1).map((t, i) => t - first[i]!);
  expect(
    Math.min(...gaps),
    `the cast blinks in step; first blinks at ${first.map(Math.round).join(', ')}ms`,
  ).toBeGreaterThan(200);
});

test('nothing blinks for a visitor who asked for less motion', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await startGame(page);

  const seen = await watchBlinks(page, 5000);
  for (const who of seen)
    expect(who.onsets.length, `${who.id} blinked under prefers-reduced-motion`).toBe(0);
});

/* --------------------------------------------------- 2. every figure stands on the ground */

/**
 * The box a figure's pool of shade has to be inside, centred on their feet.
 *
 * A tile across and half a tile deep, which contains the widest pool in the cast (the Lantern
 * Keeper stands on 23 pixels) with room to spare and is derived from the tile, not from the pool.
 * The boxes either side are half a tile wide and sit a whole tile out, which is clear of every
 * pool in the cast: that is where a wash over the ground would show and a contact shadow will not.
 */
const CONTACT_BOX = { width: TILE, height: TILE / 2 } as const;

/** What counts as shading, in luma: the review's own bound for a pixel that reads as shadow. */
const SHADED = 25;

interface Contact {
  id: string;
  /** Pixels in the box that the pool darkened by at least SHADED, and the deepest fall of all. */
  shaded: number;
  deepest: number;
  /** Pixels a whole tile either side that changed at all. Shade is contact, not a wash. */
  spill: number;
}

test('the ground under every figure in shot is darker for their standing on it', async ({
  page,
}) => {
  test.setTimeout(60_000);
  /*
   * A window tall enough to have three figures in the opening shot. This ran at Playwright's
   * default 1280x720, which held three until the arcade cabinet's marquee and deck took 160px of
   * height out of the world (ui/cabinet.ts): the same window now frames Purple and the Rabbit only,
   * and the guard below rightly refused to measure two. 1440x900 opens on the camera 1280x720 used
   * to, give or take a row, so the shot under test is the one this was written against.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await startGame(page);
  // Since rules 3 the opening shot frames Purple and the Rabbit only (the Toadstool who stood by the
  // spawn is the Gatekeeper now, at the bridge): she stands between the first two, so three are in.
  await standBetweenTheFirstTwo(page);
  // The shot, settled: a puff of Purple's dust mid-fade would be in the difference too.
  await page.waitForTimeout(500);

  const measured = await page.evaluate(
    async ({ box, shaded, tile }) => {
      const scene = window.__otp!.scene as unknown as SceneProbe;
      const cam = scene.cameras.main;
      const figures = [
        { id: 'purple', x: scene.purple.x, y: scene.purple.y, shadow: scene.purpleShadow },
        ...scene.npcs.map((n) => ({ id: n.id, x: n.sprite.x, y: n.sprite.y, shadow: n.shadow })),
      ];

      /*
       * The cast holds still for the measurement, and that is not cheating. The two frames below
       * are compared pixel for pixel, so anything else that moves between them lands in the
       * difference: a blink falling in the gap would put the eye of a character in the count of
       * pixels the SHADOW darkened. Frozen, the only thing that differs between the two frames is
       * the thing under test.
       */
      for (const npc of scene.npcs) {
        npc.sprite.anims.stop();
        npc.sprite.setFrame(0);
      }

      /** Where a world point is drawn on the canvas, which is what the snapshot below holds. */
      const screen = (x: number, y: number): { x: number; y: number } => ({
        x: cam.x + x - cam.scrollX,
        y: cam.y + y - cam.scrollY,
      });

      // Only the figures a visitor can see, with two tiles of room for the boxes either side.
      const inShot = figures.filter((f) => {
        const at = screen(f.x, f.y);
        return (
          at.x > cam.x + 2 * tile &&
          at.x < cam.x + cam.width - 2 * tile &&
          at.y > cam.y + 2 * tile &&
          at.y < cam.y + cam.height - 2 * tile
        );
      });

      /** The renderer's own picture of the frame, which is the one the visitor is looking at. */
      const shoot = (): Promise<ImageData | null> =>
        new Promise((resolve) => {
          scene.game.renderer.snapshot((image) => {
            if (!image) {
              resolve(null);
              return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(image, 0, 0);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
          });
        });

      const lit = await shoot();
      const was = figures.map((f) => f.shadow.visible);
      for (const f of figures) f.shadow.setVisible(false);
      const bare = await shoot();
      figures.forEach((f, i) => f.shadow.setVisible(was[i]!));
      if (!lit || !bare) return null;

      const luma = (frame: ImageData, p: number): number =>
        0.2126 * frame.data[p]! + 0.7152 * frame.data[p + 1]! + 0.0722 * frame.data[p + 2]!;

      /** How much darker every pixel of one box got, as a count and a worst case. */
      const fall = (
        cx: number,
        cy: number,
        w: number,
        h: number,
      ): { shaded: number; changed: number; deepest: number } => {
        let count = 0;
        let changed = 0;
        let deepest = 0;
        for (let y = Math.round(cy - h / 2); y < Math.round(cy + h / 2); y++)
          for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) {
            if (x < 0 || y < 0 || x >= bare.width || y >= bare.height) continue;
            const p = (y * bare.width + x) * 4;
            const drop = luma(bare, p) - luma(lit, p);
            if (Math.abs(drop) >= 1) changed++;
            if (drop >= shaded) count++;
            if (drop > deepest) deepest = drop;
          }
        return { shaded: count, changed, deepest };
      };

      return inShot.map((f) => {
        const feet = screen(f.x, f.y);
        const under = fall(feet.x, feet.y, box.width, box.height);
        const aside = [-1, 1].map(
          (side) => fall(feet.x + side * tile, feet.y, tile / 2, box.height).changed,
        );
        return {
          id: f.id,
          shaded: under.shaded,
          deepest: under.deepest,
          spill: aside[0]! + aside[1]!,
        };
      });
    },
    { box: CONTACT_BOX, shaded: SHADED, tile: TILE },
  );

  expect(measured, 'the renderer would not give up a frame to measure').not.toBeNull();
  const contacts = measured as Contact[];
  expect(contacts.length, 'nobody is in shot to measure').toBeGreaterThan(2);
  console.log(
    `contact shading\n  ${contacts
      .map(
        (c) =>
          `${c.id}: ${c.shaded} pixels at least ${SHADED} luma down, deepest ` +
          `${c.deepest.toFixed(1)}, spill ${c.spill}`,
      )
      .join('\n  ')}`,
  );

  for (const who of contacts) {
    /*
     * The bound is the review's own, and so is the unit: a figure touches the ground when there
     * are PIXELS under it at least 25 luma below the ground around it. Measured that way the
     * tileset seats everything it draws and the cast seated nothing -- bush 518 such pixels, rock
     * 104, Purple 24, and the rabbit, the owl and the Lantern Keeper 0 each. Thirty is inside the
     * smallest pool in the cast -- the magpie stands on nine pixels -- and nowhere near the 0 this
     * shipped with; the three figures in the opening shot measure 68, 86 and 60.
     */
    expect(who.shaded, `${who.id} does not darken the ground she stands on`).toBeGreaterThanOrEqual(
      30,
    );
    expect(who.deepest, `${who.id}'s shade is too shallow to read`).toBeGreaterThanOrEqual(SHADED);
    // And it is contact, not a wash: a whole tile out, nothing has changed at all.
    expect(who.spill, `${who.id} darkens the ground a whole tile away from her feet`).toBe(0);
  }
});

/* ------------------------------------------------------- 3. the payoff frame is composed */

/**
 * Where the arrival is judged. The three review widths, plus the two the review never reaches and
 * the landscape phone, which is the worst case for anything derived from the camera's width.
 */
const PAYOFF_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 844, height: 390 },
  { width: 375, height: 812 },
] as const;

/** Where the building lands in the frame, in game pixels, at one viewport. */
interface Framing {
  offX: number;
  offY: number;
  room: Record<string, number>;
  share: number;
  /** How far the Arrive panel reaches up over the canvas, in game pixels; 0 when it docks below. */
  covered: number;
  /** The gap from Purple's feet down to the Arrive panel's top edge, in CSS pixels. */
  feetClear: number;
}

/** Plays three verdicts and knocks on the door, without the walk in between. */
async function reachTheDoor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.getByRole('button', { name: /Start walking/ }).click();
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
  await page.evaluate(() => {
    const { store } = window.__otp!;
    // Over the river by the Bridge Key: the door refuses a run that never crossed (rules 3). Its
    // good copy, so the run arrives on Grandma's ending as leaving everything used to: a deal that
    // made it bad is re-dealt from seed 0, which makes it good, as main.ts starts every run.
    if (!store.getState().good.includes('bridge-key')) {
      store.dispatch({ type: 'RESET', seed: 0 });
      store.dispatch({ type: 'START', runId: crypto.randomUUID() });
      store.dispatch({ type: 'BEGIN' });
    }
    for (const [c, s] of [
      ['rabbit', 'cottage-finder'],
      ['owl', 'word-weaver'],
      ['lantern-keeper', 'night-light'],
    ]) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v: 'leave' });
    }
    // Then take it, and in at the door.
    store.dispatch({ type: 'MEET', c: 'gatekeeper' });
    store.dispatch({ type: 'VERDICT', s: 'bridge-key', v: 'take' });
    store.dispatch({ type: 'ENTER_COTTAGE' });
  });
  await page.waitForFunction(
    () => (window.__otp!.scene as unknown as { arrived: boolean }).arrived === true,
  );
}

test('the cottage is in the middle of the payoff frame at every width', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  await reachTheDoor(page);

  /*
   * Every viewport is measured BEFORE any of them is judged, so one run reports the whole sweep.
   * Asserting inside the loop stops at the first bad width, and the first bad width was 1920 --
   * which is to say the review widths looked fine and the report said nothing about the two that
   * were not.
   */
  const sweep: { where: string; shot: Framing }[] = [];
  for (const viewport of PAYOFF_VIEWPORTS) {
    await page.setViewportSize({ ...viewport });
    await page.waitForFunction((w) => Math.abs(window.innerWidth - w) < 1, viewport.width);
    // Two animation frames: one for ui/stage.ts to resize the canvas, one for the scene to re-aim.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );

    const shot = await page.evaluate((tile) => {
      const scene = window.__otp!.scene as unknown as SceneProbe;
      const cam = scene.cameras.main;
      const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const zoom = rect.width / canvas.width;
      const facade = window.__otp!.mapObjects!.find((o) => o.name === 'prop-cottage')!;
      /*
       * The BUILDING, which is what the arrival is framed on and what `doorFocus` names: the
       * chimney row above the facade, the facade itself, and the three rows of doorstep lane below
       * it where the wolf's prints are. Read from the map, so moving the cottage moves the target
       * rather than breaking the test.
       */
      const box = {
        left: facade.x,
        right: facade.x + facade.width,
        top: facade.y - tile,
        bottom: facade.y + facade.height + tile * 3,
      };
      const atX = (wx: number): number => rect.left + (cam.x + wx - cam.scrollX) * zoom;
      const atY = (wy: number): number => rect.top + (cam.y + wy - cam.scrollY) * zoom;
      // The Arrive panel, docked over the world's bottom edge wherever the window is landscape.
      const panel = document.querySelector('.otp-arrive')!.getBoundingClientRect();
      const feet = (window.__otp!.scene as unknown as SceneProbe).purple;
      return {
        // Of the camera's VIEW, which is letterboxed inside the canvas on a wide window: a panel
        // that only reaches the band under the picture covers none of it.
        covered:
          Math.max(0, rect.top + (cam.y + cam.height) * zoom - Math.max(panel.top, rect.top)) /
          zoom,
        feetClear: panel.top - atY(feet.y),
        /** How far the building's centre is from the canvas's, in GAME pixels. */
        offX: (atX((box.left + box.right) / 2) - (rect.left + rect.width / 2)) / zoom,
        offY: (atY((box.top + box.bottom) / 2) - (rect.top + rect.height / 2)) / zoom,
        /** How much canvas there is beyond each edge of the building, in game pixels. */
        room: {
          left: (atX(box.left) - rect.left) / zoom,
          right: (rect.right - atX(box.right)) / zoom,
          top: (atY(box.top) - rect.top) / zoom,
          bottom: (rect.bottom - atY(box.bottom)) / zoom,
        },
        /** For the report: where the facade's centre falls across the frame. */
        share: (atX((box.left + box.right) / 2) - rect.left) / rect.width,
      };
    }, TILE);

    sweep.push({ where: `${viewport.width}x${viewport.height}`, shot });
    if (process.env['SHOT_DIR'])
      await page.screenshot({
        path: `${process.env['SHOT_DIR']}/arrive-${viewport.width}x${viewport.height}.png`,
      });
  }

  console.log(
    `payoff framing\n  ${sweep
      .map(
        ({ where, shot }) =>
          `${where}: cottage centre at ${(shot.share * 100).toFixed(1)}% across, ` +
          `off centre by ${shot.offX.toFixed(1)}px`,
      )
      .join('\n  ')}`,
  );

  for (const { where, shot } of sweep) {
    /*
     * One game pixel. The canvas and the view can each be an odd number of pixels wide, so an
     * exactly centred shot still rounds half a pixel either way; anything past a whole pixel is the
     * building sliding across the frame, which is the defect.
     */
    expect(
      Math.abs(shot.offX),
      `the cottage is off the centre line at ${where}`,
    ).toBeLessThanOrEqual(1);
    /*
     * PURPLE STANDS CLEAR OF THE PANEL, at every width (Paul's round, 2026-10-22). Before it, the
     * Arrive panel docked over the world hid her, the door lane and the wolf's prints at 1280x800 and
     * 844x390: the payoff under the words about it. The camera now frames the building in what the
     * panel leaves (`frameAboveCover`, world/logic.ts), so her feet are above its top edge.
     */
    expect(shot.feetClear, `Purple's feet are under the Arrive panel at ${where}`).toBeGreaterThan(
      0,
    );
    // The sides of the building are in shot whatever the panel does.
    expect(
      shot.room['left']!,
      `the building is cut off at the left at ${where}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      shot.room['right']!,
      `the building is cut off at the right at ${where}`,
    ).toBeGreaterThanOrEqual(0);
    if (shot.covered === 0) {
      // Nothing docked over the world (a portrait phone docks the panel under it): as composed.
      expect(
        Math.abs(shot.offY),
        `the cottage is off the centre line at ${where}`,
      ).toBeLessThanOrEqual(1);
      for (const [edge, room] of Object.entries(shot.room))
        expect(room, `the building is cut off at the ${edge} at ${where}`).toBeGreaterThanOrEqual(
          0,
        );
    } else {
      /*
       * With a panel over the world the building sits in what it leaves: its centre is above the
       * canvas's, and never by more than the panel covers. Where the whole span does not fit, the
       * chimney row is what gives, never the doorstep (the feet bound above).
       */
      expect(shot.offY, `the cottage did not make room above the panel at ${where}`).toBeLessThan(
        0,
      );
      expect(
        shot.offY,
        `the cottage was pushed further up than the panel asks at ${where}`,
      ).toBeGreaterThanOrEqual(-shot.covered - 1);
    }
  }
});

/**
 * How much of the frame is empty, in game pixels, down each side.
 *
 * Counted as columns that are the canvas's own clear colour from top to bottom. A column of forest
 * never is -- the tileset holds 35 pixels of exactly this colour in 86,016, and not one of them has
 * a whole column of its own -- so this is the band a visitor sees and nothing else.
 */
async function letterbox(page: Page): Promise<{ left: number; right: number }> {
  const bands = await page.evaluate(async () => {
    const scene = window.__otp!.scene as unknown as SceneProbe;
    const clear = getComputedStyle(document.documentElement)
      .getPropertyValue('--cyera-black')
      .trim();
    const rgb = [1, 3, 5].map((i) => parseInt(clear.slice(i, i + 2), 16));
    const frame = await new Promise<ImageData | null>((resolve) => {
      scene.game.renderer.snapshot((image) => {
        if (!image) {
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      });
    });
    if (!frame) return null;
    const empty = (x: number): boolean => {
      for (let y = 0; y < frame.height; y++) {
        const p = (y * frame.width + x) * 4;
        if (
          frame.data[p] !== rgb[0] ||
          frame.data[p + 1] !== rgb[1] ||
          frame.data[p + 2] !== rgb[2]
        )
          return false;
      }
      return true;
    };
    let left = 0;
    while (left < frame.width && empty(left)) left++;
    let right = 0;
    while (right < frame.width && empty(frame.width - 1 - right)) right++;
    return { left, right };
  });
  if (!bands) throw new Error('the renderer would not give up a frame to measure');
  return bands;
}

test('the letterbox belongs to the payoff, and the walk gets the whole frame back', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // The widest camera on the board, where the map has least to give and the band is biggest.
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');

  const walking = await letterbox(page);
  expect(walking, 'the forest does not fill the frame on the walk').toEqual({ left: 0, right: 0 });

  await reachTheDoor(page);
  const arrived = await letterbox(page);
  expect(arrived.left, 'nothing was letterboxed at the door').toBeGreaterThan(0);
  // Framed, which means the two bands are the same: a one-sided band is a shot that slipped.
  expect(
    Math.abs(arrived.left - arrived.right),
    `the bands are uneven: ${arrived.left} left, ${arrived.right} right`,
  ).toBeLessThanOrEqual(1);

  /*
   * And it comes down again. A letterbox left up after a replay would pillarbox the whole of
   * Explore -- a quarter of a 2560 screen gone for the rest of the run -- which is a worse defect
   * than the one it was put up to fix, and nothing else in the suite looks at it.
   */
  await toTheReveal(page);
  await page.getByRole('button', { name: /Walk it again/ }).click();
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  expect(await letterbox(page), 'the payoff letterbox is still up on the walk').toEqual({
    left: 0,
    right: 0,
  });
});
