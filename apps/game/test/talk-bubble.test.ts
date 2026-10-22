/*
 * WHERE THE TALK BUBBLE STANDS (world/logic.ts `placeBubble`; the UX review, 2026-10-22: the talk
 * prompt covered characters). The arithmetic, on drawings built here; e2e/talk-bubble.spec.ts
 * measures it as a player sees it, for the whole cast from all four sides, off the loaded textures.
 *
 * The bubble's drawing below is deliberately lopsided inside its frame (more air on the right than
 * the left), so a mirror that forgot to mirror the ink, or a side placement that measured the FRAME
 * instead of the drawing, lands somewhere a test can see.
 */
import { describe, expect, it } from 'vitest';
import { TILE, placeBubble, sharedArea } from '../src/world/logic';
import type { BubbleAsk, Rect } from '../src/world/logic';

const GAP = TILE * (3 / 8);
const FRAME_SIZE = { width: TILE, height: TILE };
const INK: Rect = { x: 2, y: 6, width: 24, height: 18 };
/** The speaker's drawing: a figure 20 wide and 40 tall, its head at y = 200. */
const TALKER: Rect = { x: 300, y: 200, width: 20, height: 40 };
const VIEW: Rect = { x: 0, y: 0, width: 1000, height: 1000 };

const ask = (over: Partial<BubbleAsk> = {}): BubbleAsk => ({
  talker: TALKER,
  frame: FRAME_SIZE,
  ink: INK,
  others: [],
  view: VIEW,
  gap: GAP,
  awayFromX: TALKER.x + TALKER.width / 2 + 40,
  ...over,
});

/** Purple, a tile north of the speaker: the approach the old placement painted the bubble across. */
const northOf = (t: Rect, dx = 0): Rect => ({
  x: t.x + dx,
  y: t.y - TILE * 1.15,
  width: 20,
  height: 40,
});

const hides = (box: Rect, figures: readonly Rect[]): number =>
  figures.reduce((n, f) => n + sharedArea(box, f), 0);

describe('sharedArea', () => {
  it('is the overlap, and nothing for boxes that only touch or do not meet', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(sharedArea(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
    expect(sharedArea(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(0);
    expect(sharedArea(a, { x: 0, y: 30, width: 10, height: 10 })).toBe(0);
  });
});

describe('placeBubble', () => {
  it('stands over the head, a gap clear of it, when nobody is in the way', () => {
    const p = placeBubble(ask());
    expect(p.side).toBe('above');
    expect(p.flip).toBe(false);
    // The frame's foot is the gap above the top of the speaker's DRAWING (the scene's PROMPT_GAP,
    // where it always stood), and the drawing is clear of the head by at least that.
    expect(p.y).toBe(Math.round(TALKER.y - GAP));
    expect(TALKER.y - (p.box.y + p.box.height)).toBeGreaterThanOrEqual(GAP);
    // The FRAME is centred over the head; the origin is its bottom centre, in whole pixels.
    expect(p.x).toBe(Math.round(TALKER.x + TALKER.width / 2));
    expect(Number.isInteger(p.y)).toBe(true);
    expect(p.y - FRAME_SIZE.height + INK.y).toBe(p.box.y);
  });

  it('moves beside the head, away from Purple, when over it would cover her', () => {
    // Purple north and a little east: the bubble goes west, mirrored so its tail points back.
    const purple = northOf(TALKER, 6);
    const p = placeBubble(ask({ others: [purple], awayFromX: purple.x + purple.width / 2 }));
    expect(p.side).toBe('left');
    expect(p.flip).toBe(true);
    expect(hides(p.box, [purple, TALKER])).toBe(0);
    // A gap clear of the speaker's drawing, the same air as over the head.
    expect(TALKER.x - (p.box.x + p.box.width)).toBeGreaterThanOrEqual(GAP - 1);
    expect(TALKER.x - (p.box.x + p.box.width)).toBeLessThanOrEqual(GAP + 1);
    // The MIRRORED drawing: the ink's right-hand air is on the left once flipped.
    const frameLeft = p.x - FRAME_SIZE.width / 2;
    expect(p.box.x - frameLeft).toBe(FRAME_SIZE.width - INK.x - INK.width);

    // Purple north and a little west: east, unmirrored.
    const west = northOf(TALKER, -6);
    const q = placeBubble(ask({ others: [west], awayFromX: west.x + west.width / 2 }));
    expect(q.side).toBe('right');
    expect(q.flip).toBe(false);
    expect(hides(q.box, [west, TALKER])).toBe(0);
    expect(q.box.x - (TALKER.x + TALKER.width)).toBeGreaterThanOrEqual(GAP - 1);
    expect(q.box.x - (q.x - FRAME_SIZE.width / 2)).toBe(INK.x);
  });

  it('never covers the speaker, a bystander, or Purple, whichever side is free', () => {
    const purple = northOf(TALKER, 4);
    // A bystander standing where the away side would go: the bubble takes the other side.
    const bystander: Rect = { x: TALKER.x - 30, y: TALKER.y - 20, width: 24, height: 40 };
    const p = placeBubble(
      ask({ others: [purple, bystander], awayFromX: purple.x + purple.width / 2 }),
    );
    expect(p.side).toBe('right');
    expect(hides(p.box, [purple, bystander, TALKER])).toBe(0);
  });

  it('stays on screen: over the head would leave the camera, so it stands beside', () => {
    const top = { ...TALKER, y: 10 };
    const p = placeBubble(ask({ talker: top }));
    expect(p.side).not.toBe('above');
    expect(sharedArea(p.box, VIEW)).toBe(p.box.width * p.box.height);
  });

  it('keeps last frame’s side while it is still clear, so it does not flap', () => {
    const purple = northOf(TALKER, 6);
    const first = placeBubble(ask({ others: [purple], awayFromX: purple.x + purple.width / 2 }));
    expect(first.side).toBe('left');
    // Purple steps away: over the head is clear again, but the side it stood on still is too.
    const second = placeBubble(ask({ others: [], keep: first.side }));
    expect(second.side).toBe('left');
    // And a kept side that is no longer clear is let go.
    const blocker: Rect = { ...first.box };
    const third = placeBubble(ask({ others: [blocker], keep: 'left' }));
    expect(third.side).toBe('above');
  });

  it('where nothing is clear, hides the least', () => {
    // Boxed in above and on both sides: every candidate covers someone, and the smallest cover wins.
    const above = placeBubble(ask()).box;
    const right = placeBubble(ask({ awayFromX: 0, others: [above] })).box;
    const left = placeBubble(ask({ awayFromX: 10_000, others: [above] })).box;
    const crowd: Rect[] = [
      above,
      { ...right, width: 4 }, // a sliver of the right
      left,
    ];
    const p = placeBubble(ask({ others: crowd }));
    expect(p.side).toBe('right');
    expect(hides(p.box, crowd)).toBe(4 * right.height);
  });
});
