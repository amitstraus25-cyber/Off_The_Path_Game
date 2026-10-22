/*
 * THE TALK BUBBLE NEVER SITS ON ANYBODY (the UX review, 2026-10-22: the talk prompt covered
 * characters).
 *
 * The bubble that says "this one will talk to you" stood over the speaker's head at depth 9000, over
 * everything, so whoever stood north of the speaker had it painted across them -- and the one
 * figure reliably north of a speaker is Purple, walking up to them from above. world/logic.ts
 * `placeBubble` now moves it beside the head when over it would cover somebody.
 *
 * Measured as a player sees it, for every member of the cast and from all four sides: Purple stands
 * a little over a tile away (inside INTERACT_RADIUS, so a bubble is up), and the bubble's DRAWING --
 * the opaque pixels of the texture it is showing, read back here from the loaded texture, not from
 * the scene's own measurement -- must share no pixel with any figure's drawing, Purple's included,
 * and must lie wholly inside what the camera shows. Each figure is measured off the frame it is
 * showing right now, mirrored if it is mirrored, so a figure turned to face Purple counts as it is
 * drawn.
 *
 * A CHECK THAT CAN PASS WITHOUT LOOKING IS NOT ONE (PAUL_BRIEF trap 6): every case first asserts a
 * bubble is up and names whose it is, and the north approach -- the case the old code failed -- is
 * required to have moved the bubble off the head for at least one speaker, so a regression to
 * "always above" cannot pass by Purple happening to stand clear.
 *
 * It teleports Purple rather than walking, as e2e/scene-layer.spec.ts does: this is a test of where
 * a mark is drawn, not of walking.
 */
import { expect, test } from '@playwright/test';
import { startGame } from './helpers';
import { TILE } from '../src/world/logic';

/** A little over a tile: inside the 1.5-tile reach, and close enough to crowd the speaker. */
const STAND = Math.round(TILE * 1.15);

const APPROACHES = {
  north: { dx: 0, dy: -STAND },
  south: { dx: 0, dy: STAND },
  east: { dx: STAND, dy: 0 },
  west: { dx: -STAND, dy: 0 },
} as const;

type Box = { x: number; y: number; width: number; height: number };

interface Measured {
  speaker: string | null;
  bubble: Box | null;
  /** Whether the bubble stands over the speaker's head, or has moved beside it. */
  over: boolean;
  hits: { who: string; area: number }[];
  offScreen: number;
}

/*
 * The desktop camera, and a portrait phone's, which is the narrowest the game builds (11 tiles):
 * there a bubble moved beside a head has the least room before it leaves the screen.
 */
const SIZES = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

for (const size of SIZES)
  test(`the talk bubble covers nobody, from any side, and stays on screen at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize(size);
    await page.goto('/');
    await startGame(page);
    const ids = await page.evaluate(() =>
      (window.__otp!.scene as unknown as { npcs: { id: string }[] }).npcs.map((n) => n.id),
    );
    expect(ids.length, 'the forest is empty').toBeGreaterThan(4);

    let movedFromNorth = 0;
    for (const id of ids) {
      for (const [side, d] of Object.entries(APPROACHES)) {
        await page.evaluate(
          ({ id, d }) => {
            const s = window.__otp!.scene as unknown as {
              npcs: { id: string; x: number; y: number }[];
              position: { x: number; y: number };
              placePurple(): void;
            };
            const npc = s.npcs.find((n) => n.id === id)!;
            s.position = { x: npc.x + d.dx, y: npc.y + d.dy };
            s.placePurple();
          },
          { id, d },
        );
        // Let the camera catch up and the scene place the bubble against where everyone now stands.
        await page.waitForTimeout(700);
        const m = await measure(page);
        const where = `${size.width}x${size.height}, ${id}, Purple to the ${side}`;
        expect(m.speaker, `${where}: no bubble is up`).not.toBeNull();
        expect(m.hits, `${where}: the bubble covers somebody`).toEqual([]);
        expect(m.offScreen, `${where}: the bubble is partly off screen`).toBe(0);
        if (side === 'north' && m.speaker === id && !m.over) movedFromNorth++;
      }
    }
    expect(
      movedFromNorth,
      'from the north the bubble never had to move, so this test proved nothing about covering Purple',
    ).toBeGreaterThan(0);
  });

/** The visible bubble's drawing against every figure's, and against the camera. */
function measure(page: import('@playwright/test').Page): Promise<Measured> {
  return page.evaluate(() => {
    interface Frame {
      cutX: number;
      cutY: number;
      cutWidth: number;
      cutHeight: number;
      source: { image: CanvasImageSource };
    }
    interface Sprite {
      x: number;
      y: number;
      width: number;
      height: number;
      flipX: boolean;
      visible: boolean;
      frame: Frame;
    }
    const s = window.__otp!.scene as unknown as {
      npcs: { id: string; sprite: Sprite; prompt: Sprite }[];
      purple: Sprite;
      cameras: { main: { scrollX: number; scrollY: number; width: number; height: number } };
    };

    /** The opaque box of the frame a sprite is showing, in frame pixels. */
    const inkOf = (f: Frame): Box | null => {
      const c = document.createElement('canvas');
      c.width = f.cutWidth;
      c.height = f.cutHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(
        f.source.image,
        f.cutX,
        f.cutY,
        f.cutWidth,
        f.cutHeight,
        0,
        0,
        c.width,
        c.height,
      );
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let l = c.width;
      let r = -1;
      let t = c.height;
      let b = -1;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++)
          if (data[(y * c.width + x) * 4 + 3]! > 0) {
            l = Math.min(l, x);
            r = Math.max(r, x);
            t = Math.min(t, y);
            b = Math.max(b, y);
          }
      return r < 0 ? null : { x: l, y: t, width: r - l + 1, height: b - t + 1 };
    };
    /** A sprite's drawing in world pixels; its origin is the bottom centre of its frame. */
    const drawn = (sp: Sprite): Box | null => {
      const ink = inkOf(sp.frame);
      if (!ink) return null;
      const left = sp.flipX ? sp.width - ink.x - ink.width : ink.x;
      return {
        x: sp.x - sp.width / 2 + left,
        y: sp.y - sp.height + ink.y,
        width: ink.width,
        height: ink.height,
      };
    };
    const shared = (a: Box, b: Box): number =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

    const speaker = s.npcs.find((n) => n.prompt.visible) ?? null;
    if (!speaker) return { speaker: null, bubble: null, over: false, hits: [], offScreen: 0 };
    const bubble = drawn(speaker.prompt)!;
    const figures: [string, Sprite][] = [
      ['Purple', s.purple],
      ...s.npcs.filter((n) => n.sprite.visible).map((n): [string, Sprite] => [n.id, n.sprite]),
    ];
    const hits = figures
      .map(([who, sp]) => {
        const box = drawn(sp);
        return { who, area: box ? shared(bubble, box) : 0 };
      })
      .filter((h) => h.area > 0);
    const head = drawn(speaker.sprite)!;
    const cam = s.cameras.main;
    const view = { x: cam.scrollX, y: cam.scrollY, width: cam.width, height: cam.height };
    return {
      speaker: speaker.id,
      bubble,
      // Over the head: the whole drawing is above the top of the speaker's.
      over: bubble.y + bubble.height <= head.y,
      hits,
      offScreen: bubble.width * bubble.height - shared(bubble, view),
    };
  });
}
