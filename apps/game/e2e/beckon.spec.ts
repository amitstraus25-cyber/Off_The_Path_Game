/*
 * THE BECKON: the ground glow and the "!" over every character the player has not met yet (the
 * client's round, 2026-10-25: "players found it hard to find the characters on the map").
 *
 * The rule -- unmet means beckoning, from the MEET on it stops -- is `test/beckon.test.ts`, against
 * the real store. This is the picture, and each test is written against something a visitor sees:
 *
 *  1. every unmet character stands in a ring and under a "!", and they are on the canvas: hiding
 *     them changes the rendered pixels at the feet and over the head, read off the renderer's own
 *     snapshot. The ring sorts under the figure; the "!" and the ring's front arc over a crown sort
 *     over the canopy, so a character under a tree is still marked.
 *  2. meeting one takes theirs away, and only theirs -- and walking on without a verdict does not
 *     bring it back.
 *  3. when the talk bubble is up the "!" over that head stands down, and no "!" anywhere overlaps a
 *     raised talk bubble.
 *  4. under prefers-reduced-motion the ring does not pulse and the "!" does not bob, and both are
 *     still there. The motion is measured first without the preference, so "steady" is a claim
 *     about the preference and not about a pulse that was never running.
 *
 * Nothing here is told a constant from the scene: bounds come from the tile, the frame and the
 * figures' own positions, and the scene's state is read through its `beckons` getter.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';
import { TILE } from '../src/world/logic';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Beckon {
  id: string;
  feet: { x: number; y: number };
  glow: { visible: boolean; alpha: number; x: number; y: number; depth: number };
  overCrown: { visible: boolean; depth: number } | null;
  mark: { visible: boolean; frame: number; depth: number; ink: Rect };
  figureDepth: number;
  canopyDepth: number;
  prompt: { visible: boolean; ink: Rect };
}

interface Sprite {
  visible: boolean;
  setVisible(v: boolean): void;
  setScale(v: number): void;
  anims: { stop(): void };
  setFrame(f: number): void;
}

interface SceneProbe {
  beckons: Beckon[];
  npcs: { id: string; sprite: Sprite; glow: Sprite; glowOverCrown: Sprite | null; mark: Sprite }[];
  position: { x: number; y: number };
  placePurple(): void;
  cameras: {
    main: { x: number; y: number; width: number; height: number; scrollX: number; scrollY: number };
  };
  game: { renderer: { snapshot(cb: (image?: HTMLImageElement) => void): void } };
}

const beckons = (page: Page): Promise<Beckon[]> =>
  page.evaluate(() => (window.__otp!.scene as unknown as SceneProbe).beckons);

/** A frame or two, so `drawBeckons` has run against whatever the spec just changed. */
const frames = (page: Page, n = 3): Promise<void> =>
  page.evaluate(
    (k) =>
      new Promise<void>((resolve) => {
        let left = k;
        const tick = (): void => {
          if (--left <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('every unmet character stands in a ring and under a "!", on the canvas', async ({ page }) => {
  test.setTimeout(60_000);
  // The opening shot e2e/scene-second-pass.spec.ts measures the shadows in: three figures in frame.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await startGame(page);
  await frames(page);

  const all = await beckons(page);
  const cast = await page.evaluate(() => window.__otp!.content.characters.map((c) => c.id));
  expect(all.map((b) => b.id).sort(), 'a character with no beckon').toEqual([...cast].sort());
  for (const b of all) {
    expect(b.glow.visible, `${b.id} has no ring`).toBe(true);
    // Under the talk bubble only when the bubble is up; at the spawn it is up for nobody but who
    // is in reach, and the "!" stands down for exactly that one.
    expect(b.mark.visible || b.prompt.visible, `${b.id} has no "!"`).toBe(true);
    // The ring is on the ground at their feet, within a pixel or two, and under the figure.
    expect(Math.abs(b.glow.x - b.feet.x), `${b.id}'s ring is off their feet`).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(b.glow.y - b.feet.y), `${b.id}'s ring is off their feet`).toBeLessThanOrEqual(
      2,
    );
    expect(b.glow.depth, `${b.id}'s ring draws over them`).toBeLessThan(b.figureDepth);
    // The "!" stands over the head: its drawing ends above the feet by at least a tile, and it
    // sorts over the canopy, so a crown cannot hide it.
    expect(b.mark.ink.y + b.mark.ink.height, `${b.id}'s "!" is not over their head`).toBeLessThan(
      b.feet.y - TILE / 2,
    );
    expect(Math.abs(b.mark.ink.x + b.mark.ink.width / 2 - b.feet.x)).toBeLessThanOrEqual(TILE / 2);
    expect(b.mark.depth, `${b.id}'s "!" is under the canopy`).toBeGreaterThan(b.canopyDepth);
    if (b.overCrown) {
      expect(b.overCrown.visible, `${b.id}'s ring does not show through the crown`).toBe(true);
      expect(b.overCrown.depth).toBeGreaterThan(b.canopyDepth);
    }
  }
  // The shipped map puts at least one character's feet under a crown; the arc must exist for them.
  expect(
    all.some((b) => b.overCrown !== null),
    'nobody stands under a crown, so the through-the-canopy arc is untested',
  ).toBe(true);

  /*
   * And it is in the PICTURE: the renderer's own frame with the beckons up, against the same frame
   * with them hidden. The difference at a figure's feet is the ring and over their head is the "!".
   * The cast is frozen on its rest frame first, so a blink in the gap cannot land in the count.
   */
  const measured = await page.evaluate(async (tile) => {
    const scene = window.__otp!.scene as unknown as SceneProbe;
    const cam = scene.cameras.main;
    for (const n of scene.npcs) {
      n.sprite.anims.stop();
      n.sprite.setFrame(0);
      n.mark.anims.stop();
      n.mark.setFrame(0);
    }
    const shoot = (): Promise<ImageData | null> =>
      new Promise((resolve) => {
        scene.game.renderer.snapshot((image) => {
          if (!image) return resolve(null);
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(image, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        });
      });
    const parts = scene.npcs.flatMap((n) =>
      [n.glow, n.glowOverCrown, n.mark].filter((s): s is Sprite => s !== null),
    );
    const lit = await shoot();
    // Taken out by SCALE, not visibility: the scene re-decides visibility on every frame from the
    // run (`drawBeckons`), so a hidden ring would be back up before the snapshot was drawn.
    for (const s of parts) s.setScale(0);
    const bare = await shoot();
    for (const s of parts) s.setScale(1);
    if (!lit || !bare) return null;
    const changed = (r: Rect): number => {
      let n = 0;
      for (let y = Math.round(r.y); y < Math.round(r.y + r.height); y++)
        for (let x = Math.round(r.x); x < Math.round(r.x + r.width); x++) {
          if (x < 0 || y < 0 || x >= bare.width || y >= bare.height) continue;
          const p = (y * bare.width + x) * 4;
          if (
            Math.abs(lit.data[p]! - bare.data[p]!) +
              Math.abs(lit.data[p + 1]! - bare.data[p + 1]!) +
              Math.abs(lit.data[p + 2]! - bare.data[p + 2]!) >
            24
          )
            n++;
        }
      return n;
    };
    return scene.beckons
      .filter((b) => {
        const x = cam.x + b.feet.x - cam.scrollX;
        const y = cam.y + b.feet.y - cam.scrollY;
        return (
          x > cam.x + 2 * tile &&
          x < cam.x + cam.width - 2 * tile &&
          y > cam.y + 2 * tile &&
          y < cam.y + cam.height - tile
        );
      })
      .map((b) => {
        const at = (r: Rect): Rect => ({
          x: cam.x + r.x - cam.scrollX,
          y: cam.y + r.y - cam.scrollY,
          width: r.width,
          height: r.height,
        });
        return {
          id: b.id,
          // The ring's box: a tile and a half across the feet, a third of a tile deep either side.
          ring: changed(
            at({
              x: b.feet.x - tile * 0.75,
              y: b.feet.y - tile / 3,
              width: tile * 1.5,
              height: (tile * 2) / 3,
            }),
          ),
          mark: b.mark.visible ? changed(at(b.mark.ink)) : -1,
        };
      });
  }, TILE);
  expect(measured, 'the renderer would not give up a frame').not.toBeNull();
  const shot = measured!;
  console.log(
    `beckons in the opening shot\n  ${shot.map((m) => `${m.id}: ring ${m.ring}px, "!" ${m.mark}px`).join('\n  ')}`,
  );
  expect(shot.length, 'nobody is in the opening shot to measure').toBeGreaterThan(1);
  for (const m of shot) {
    // A tenth of a tile's pixels: the ring's thinnest arc alone is more than this at zoom 1.
    expect(m.ring, `${m.id}'s ring is not on the canvas`).toBeGreaterThan((TILE * TILE) / 10);
    if (m.mark >= 0)
      expect(m.mark, `${m.id}'s "!" is not on the canvas`).toBeGreaterThan((TILE * TILE) / 10);
  }
});

test('meeting a character takes their ring and "!" away, and only theirs', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  await frames(page);
  const [first, ...rest] = await page.evaluate(() =>
    window.__otp!.content.characters.map((c) => c.id),
  );

  await page.evaluate((c) => window.__otp!.store.dispatch({ type: 'MEET', c }), first!);
  await frames(page);
  let now = await beckons(page);
  const met = now.find((b) => b.id === first)!;
  expect(met.glow.visible, `${first}'s ring outlived the meeting`).toBe(false);
  expect(met.mark.visible, `${first}'s "!" outlived the meeting`).toBe(false);
  expect(met.overCrown?.visible ?? false).toBe(false);

  // Walking on without a verdict: they have still been found, so it stays gone.
  await page.evaluate(() => {
    const { store } = window.__otp!;
    for (let i = 0; i < 2 && store.getState().phase !== 'forest'; i++)
      store.dispatch({ type: 'BACK' });
  });
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'forest');
  await frames(page);
  now = await beckons(page);
  expect(now.find((b) => b.id === first)!.glow.visible).toBe(false);
  expect(now.find((b) => b.id === first)!.mark.visible).toBe(false);
  for (const id of rest) {
    const b = now.find((x) => x.id === id)!;
    expect(b.glow.visible, `${id}'s ring went when somebody else was met`).toBe(true);
    expect(b.mark.visible || b.prompt.visible, `${id}'s "!" went with somebody else's`).toBe(true);
  }
});

test('the "!" stands down for the talk bubble and never overlaps one', async ({ page }) => {
  await page.goto('/');
  await startGame(page);
  // Purple put beside the rabbit, a tile below their feet: inside reach, so the bubble comes up.
  const id = await page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as SceneProbe;
    const rabbit = scene.beckons.find((b) =>
      window.__otp!.content.characters.some((c) => c.id === b.id && c.spawn === 'npc-rabbit'),
    )!;
    scene.position = { x: rabbit.feet.x, y: rabbit.feet.y + 32 };
    scene.placePurple();
    return rabbit.id;
  });
  await page.waitForFunction(
    (who) =>
      (window.__otp!.scene as unknown as SceneProbe).beckons.find((b) => b.id === who)!.prompt
        .visible,
    id,
  );
  await frames(page);
  const now = await beckons(page);
  const talker = now.find((b) => b.id === id)!;
  expect(talker.prompt.visible).toBe(true);
  expect(talker.mark.visible, 'the "!" and the talk bubble are both up over one head').toBe(false);
  // Still unmet -- the bubble is an offer, not a meeting -- so the ring stays.
  expect(talker.glow.visible).toBe(true);
  for (const bubble of now.filter((b) => b.prompt.visible))
    for (const other of now.filter((b) => b.mark.visible))
      expect(
        overlap(bubble.prompt.ink, other.mark.ink),
        `${other.id}'s "!" overlaps ${bubble.id}'s talk bubble`,
      ).toBe(false);
});

/** Samples every ring's alpha and every "!"'s frame on each animation frame for `ms`. */
async function watch(page: Page, ms: number): Promise<{ alphas: number[]; frames: number[] }[]> {
  return page.evaluate((budget) => {
    const scene = window.__otp!.scene as unknown as SceneProbe;
    const seen = scene.beckons.map(() => ({ alphas: [] as number[], frames: [] as number[] }));
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (): void => {
        scene.beckons.forEach((b, i) => {
          if (b.glow.visible) seen[i]!.alphas.push(b.glow.alpha);
          if (b.mark.visible) seen[i]!.frames.push(b.mark.frame);
        });
        if (performance.now() - t0 < budget) requestAnimationFrame(tick);
        else resolve(seen);
      };
      requestAnimationFrame(tick);
    });
  }, ms);
}

const spread = (xs: number[]): number => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

test('the ring pulses and the "!" bobs for a visitor who did not ask for less motion', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  // Three seconds: longer than a half-pulse and several bob frames at two a second.
  const seen = await watch(page, 3000);
  for (const s of seen.filter((x) => x.alphas.length)) {
    expect(spread(s.alphas), 'the ring does not pulse').toBeGreaterThan(0.1);
    expect(new Set(s.frames).size, 'the "!" does not bob').toBeGreaterThan(1);
  }
});

test('under reduced motion the ring holds still and the "!" does not bob, and both stay', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await startGame(page);
  const seen = await watch(page, 3000);
  const shown = seen.filter((x) => x.alphas.length);
  expect(shown.length, 'no ring under reduced motion: steady, not absent').toBeGreaterThan(4);
  for (const s of shown) {
    expect(spread(s.alphas), 'the ring pulses under prefers-reduced-motion').toBe(0);
    expect(s.alphas[0]!, 'the steady ring is too faint to find anyone by').toBeGreaterThan(0.5);
  }
  for (const s of seen.filter((x) => x.frames.length))
    expect(new Set(s.frames).size, 'the "!" bobs under prefers-reduced-motion').toBe(1);
  expect(seen.filter((x) => x.frames.length).length, 'no "!" under reduced motion').toBeGreaterThan(
    4,
  );
});
