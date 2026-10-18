import { describe, expect, it } from 'vitest';
import {
  CAMERA_DEADZONE,
  blocked,
  cameraFollow,
  cameraTopLeft,
  ease,
  facingFrom,
  stageFit,
  isSolidTile,
  moveWithCollision,
  movementVector,
  nearest,
  overlaps,
} from '../src/world/logic';
import type { CollisionMap } from '../src/world/logic';

// 4x3 map; a solid block at tile (2,1).
const map: CollisionMap = {
  width: 4,
  height: 3,
  tiles: [0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0],
};
const mid = (tile: number) => tile * 16 + 8;

describe('isSolidTile', () => {
  it('is solid inside the block and outside the map', () => {
    expect(isSolidTile(map, 2, 1)).toBe(true);
    expect(isSolidTile(map, 1, 1)).toBe(false);
    expect(isSolidTile(map, -1, 0)).toBe(true);
    expect(isSolidTile(map, 0, -1)).toBe(true);
    expect(isSolidTile(map, 4, 0)).toBe(true);
    expect(isSolidTile(map, 0, 3)).toBe(true);
  });
});

describe('blocked', () => {
  it('blocks when the foot box overlaps a solid tile', () => {
    expect(blocked(map, mid(2), mid(1) + 3)).toBe(true);
    expect(blocked(map, mid(1), mid(1) + 3)).toBe(false);
  });
  it('allows a position whose box edge just touches the tile boundary', () => {
    // foot box is 10 wide, so a centre 5px left of the wall edge just touches it
    expect(blocked(map, 32 - 5, mid(1) + 3)).toBe(false);
    expect(blocked(map, 32 - 4.9, mid(1) + 3)).toBe(true);
  });
  it('blocks against the map edges', () => {
    expect(blocked(map, 2, mid(0) + 3)).toBe(true);
  });
});

describe('moveWithCollision', () => {
  const open = { x: mid(1), y: mid(1) + 3 };
  it('moves freely in open space', () => {
    expect(moveWithCollision(map, open, 2, 0)).toEqual({ x: open.x + 2, y: open.y });
  });
  it('stops at a wall but still slides along the free axis', () => {
    const next = moveWithCollision(map, { x: 32 - 5, y: open.y }, 3, -4);
    expect(next.x).toBe(32 - 5); // blocked horizontally
    expect(next.y).toBe(open.y - 4); // free vertically
  });
  it('never teleports through a wall', () => {
    const next = moveWithCollision(map, { x: 32 - 5, y: open.y }, 40, 0);
    expect(next.x).toBe(32 - 5);
  });
  it('ignores a zero step', () => {
    expect(moveWithCollision(map, open, 0, 0)).toEqual(open);
  });
});

describe('movementVector', () => {
  it('normalises so diagonals are not faster', () => {
    expect(movementVector({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(movementVector({ x: 3, y: 0 })).toEqual({ x: 1, y: 0 });
    const d = movementVector({ x: 1, y: 1 });
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
});

describe('facingFrom', () => {
  it.each([
    [{ x: 1, y: 0 }, 'right'],
    [{ x: -1, y: 0 }, 'left'],
    [{ x: 0, y: 1 }, 'down'],
    [{ x: 0, y: -1 }, 'up'],
    [{ x: 0.5, y: 1 }, 'down'],
    [{ x: 1, y: 1 }, 'down'],
  ] as const)('%o faces %s', (v, expected) => {
    expect(facingFrom(v, 'up')).toBe(expected);
  });
  it('keeps the previous facing when standing still', () => {
    expect(facingFrom({ x: 0, y: 0 }, 'left')).toBe('left');
  });
});

describe('nearest', () => {
  const items = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 20, y: 0 },
    { id: 'c', x: 200, y: 0 },
  ];
  it('finds the closest inside the radius and nothing outside it', () => {
    expect(nearest({ x: 2, y: 0 }, items)?.id).toBe('a');
    expect(nearest({ x: 18, y: 0 }, items)?.id).toBe('b');
    expect(nearest({ x: 500, y: 0 }, items)).toBeNull();
    expect(nearest({ x: 0, y: 0 }, [])).toBeNull();
  });
  it('breaks ties on id so the prompt never flickers', () => {
    const tied = [
      { id: 'z', x: 10, y: 0 },
      { id: 'a', x: -10, y: 0 },
    ];
    expect(nearest({ x: 0, y: 0 }, tied)?.id).toBe('a');
  });
  it('respects a custom radius', () => {
    expect(nearest({ x: 0, y: 0 }, items, 5)?.id).toBe('a');
    expect(nearest({ x: 10, y: 0 }, items, 5)).toBeNull();
  });
});

describe('overlaps', () => {
  const rect = { x: 10, y: 10, width: 16, height: 32 };
  it('includes the top-left edge and excludes the bottom-right', () => {
    expect(overlaps({ x: 10, y: 10 }, rect)).toBe(true);
    expect(overlaps({ x: 25, y: 41 }, rect)).toBe(true);
    expect(overlaps({ x: 26, y: 20 }, rect)).toBe(false);
    expect(overlaps({ x: 20, y: 42 }, rect)).toBe(false);
    expect(overlaps({ x: 9, y: 20 }, rect)).toBe(false);
    expect(overlaps({ x: 20, y: 9 }, rect)).toBe(false);
  });
});

describe('stageFit', () => {
  it('fills a desktop window at a whole zoom instead of letterboxing it', () => {
    expect(stageFit({ width: 1280, height: 720 })).toEqual({
      zoom: 3,
      view: { width: 426, height: 240 },
    });
  });

  it('keeps a phone playable rather than shrinking the world to a third of the screen', () => {
    // 390x464 is a portrait phone once the frame and the docked panels are taken out. The old
    // rule floored the zoom in device pixels against a fixed 480x270 camera and produced a
    // 320x180 canvas at DPR 3, or 240x135 at DPR 2.
    expect(stageFit({ width: 390, height: 464 })).toEqual({
      zoom: 2,
      view: { width: 195, height: 232 },
    });
  });

  it('never magnifies past the tile cap, however large the window', () => {
    const fit = stageFit({ width: 3840, height: 2160 });
    expect(fit.zoom).toBe(3);
    // And the camera stays inside the 960x672 map.
    expect(fit.view).toEqual({ width: 640, height: 400 });
  });

  it('never goes below one game pixel per CSS pixel on a tiny viewport', () => {
    expect(stageFit({ width: 100, height: 100 })).toEqual({
      zoom: 1,
      view: { width: 192, height: 108 },
    });
  });

  it('lets the shorter axis decide the zoom', () => {
    // Wide but short: height allows 2, width would allow 6.
    expect(stageFit({ width: 1200, height: 230 }).zoom).toBe(2);
  });
});

describe('cameraTopLeft', () => {
  const view = { width: 480, height: 270 };
  const world = { width: 800, height: 576 };
  it('centres on the target and rounds to whole pixels', () => {
    expect(cameraTopLeft({ x: 400.4, y: 300.6 }, view, world)).toEqual({ x: 160, y: 166 });
  });
  it('clamps to the world bounds', () => {
    expect(cameraTopLeft({ x: 0, y: 0 }, view, world)).toEqual({ x: 0, y: 0 });
    expect(cameraTopLeft({ x: 9999, y: 9999 }, view, world)).toEqual({ x: 320, y: 306 });
  });
  it('pins to zero when the world is smaller than the view', () => {
    expect(cameraTopLeft({ x: 10, y: 10 }, view, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('ease', () => {
  it('is frame-rate independent: one long step matches many short ones', () => {
    const long = ease(0, 100, 120, 48);
    let short = 0;
    for (let i = 0; i < 6; i++) short = ease(short, 100, 120, 8);
    expect(short).toBeCloseTo(long, 6);
  });

  it('never overshoots and converges on the target', () => {
    let v = 0;
    for (let i = 0; i < 400; i++) {
      v = ease(v, 100, 120, 16);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(v).toBeCloseTo(100, 3);
  });

  it('snaps when tau is zero or below, and holds still across no time at all', () => {
    expect(ease(0, 100, 0, 16)).toBe(100);
    expect(ease(0, 100, -5, 16)).toBe(100);
    expect(ease(7, 100, 120, 0)).toBe(7);
  });
});

describe('cameraFollow', () => {
  const centre = { x: 100, y: 100 };

  it('does not move at all while the target is inside the deadzone', () => {
    const inside = { x: 100 + CAMERA_DEADZONE.x - 1, y: 100 + CAMERA_DEADZONE.y - 1 };
    expect(cameraFollow(centre, inside, 16)).toEqual(centre);
  });

  it('eases after the target once it leaves the deadzone, without catching up at once', () => {
    const target = { x: 400, y: 100 };
    const next = cameraFollow(centre, target, 16);
    expect(next.x).toBeGreaterThan(centre.x);
    expect(next.x).toBeLessThan(target.x - CAMERA_DEADZONE.x);
    // The vertical axis is still inside its deadzone, so it must not drift.
    expect(next.y).toBe(centre.y);
  });

  it('settles a deadzone-width behind the target, so Red keeps her lead', () => {
    const target = { x: 400, y: 600 };
    let c = centre;
    for (let i = 0; i < 600; i++) c = cameraFollow(c, target, 16);
    expect(c.x).toBeCloseTo(target.x - CAMERA_DEADZONE.x, 2);
    expect(c.y).toBeCloseTo(target.y - CAMERA_DEADZONE.y, 2);
  });

  it('follows backwards too', () => {
    const target = { x: -400, y: 100 };
    const next = cameraFollow(centre, target, 16);
    expect(next.x).toBeLessThan(centre.x);
  });
});
