/** Pure world maths: no Phaser, no DOM. Unit tested. */

export interface Vec {
  x: number;
  y: number;
}

/*
 * TILE and the camera geometry live in @otp/core now, and are re-exported here so every existing
 * import keeps working. They moved because tools/graybox needs the SAME numbers and used to carry
 * its own copy in a comment -- which was wrong by a third for three rounds (see camera.ts).
 */
export {
  TILE,
  CAMERA_FOCUS_Y,
  RED_FEET_BELOW_SPAWN,
  MIN_VIEW,
  MAX_ZOOM,
  stageFit,
  availableFor,
  pixelSnap,
} from '@otp/core';
import { TILE } from '@otp/core';

/**
 * Red's collision box, in pixels relative to her position (feet centre).
 * Five-eighths of a tile wide and three-eighths tall: narrower than her sprite, so she can stand
 * in a gap her shoulders would not fit through.
 */
export const FOOT_BOX = {
  width: TILE * (5 / 8),
  height: TILE * (3 / 8),
  offsetY: -TILE * (3 / 16),
} as const;
/** Logical pixels per second: three and three-quarter tiles, so the crossing time never moved. */
export const WALK_SPEED = TILE * 3.75;
/** How close Red must stand to talk to someone, centre to centre: a tile and a half. */
export const INTERACT_RADIUS = TILE * 1.5;

export interface CollisionMap {
  width: number;
  height: number;
  /** Non-zero means solid. Row-major, width * height entries. */
  tiles: readonly number[];
}

export const isSolidTile = (map: CollisionMap, tx: number, ty: number): boolean =>
  tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || map.tiles[ty * map.width + tx] !== 0;

/** True when Red's foot box at this position overlaps any solid tile. */
export function blocked(map: CollisionMap, x: number, y: number): boolean {
  const left = x - FOOT_BOX.width / 2;
  const right = x + FOOT_BOX.width / 2;
  const top = y + FOOT_BOX.offsetY - FOOT_BOX.height / 2;
  const bottom = y + FOOT_BOX.offsetY + FOOT_BOX.height / 2;
  // Epsilon keeps a box whose edge sits exactly on a tile boundary out of the next tile.
  const e = 0.0001;
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((bottom - e) / TILE); ty++)
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((right - e) / TILE); tx++)
      if (isSolidTile(map, tx, ty)) return true;
  return false;
}

/**
 * Moves along each axis separately so Red slides along a wall instead of sticking.
 * Mutates nothing; returns the new position.
 */
export function moveWithCollision(map: CollisionMap, from: Vec, dx: number, dy: number): Vec {
  let { x, y } = from;
  if (dx !== 0 && !blocked(map, x + dx, y)) x += dx;
  if (dy !== 0 && !blocked(map, x, y + dy)) y += dy;
  return { x, y };
}

export type Facing = 'down' | 'left' | 'right' | 'up';

/** Normalised movement vector; diagonals keep the same speed as straight lines. */
export function movementVector(input: { x: number; y: number }): Vec {
  const len = Math.hypot(input.x, input.y);
  return len === 0 ? { x: 0, y: 0 } : { x: input.x / len, y: input.y / len };
}

/** Facing follows the dominant axis; ties prefer the vertical, as the art reads better. */
export function facingFrom(v: Vec, previous: Facing): Facing {
  if (v.x === 0 && v.y === 0) return previous;
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'right' : 'left';
  return v.y > 0 ? 'down' : 'up';
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
}

/** The nearest interactable within range, or null. Ties break on id for determinism. */
export function nearest<T extends Interactable>(
  from: Vec,
  items: readonly T[],
  radius = INTERACT_RADIUS,
): T | null {
  let best: T | null = null;
  let bestDistance = radius;
  for (const item of items) {
    const d = Math.hypot(item.x - from.x, item.y - from.y);
    if (d < bestDistance || (d === bestDistance && best !== null && item.id < best.id)) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const overlaps = (point: Vec, rect: Rect): boolean =>
  point.x >= rect.x &&
  point.x < rect.x + rect.width &&
  point.y >= rect.y &&
  point.y < rect.y + rect.height;

/**
 * Half-size of the box Red moves inside before the camera takes any notice, in game pixels.
 * Wider than tall: sideways drift reads as natural framing, vertical drift reads as the camera
 * being late.
 */
export const CAMERA_DEADZONE = { x: TILE, y: TILE * (5 / 8) } as const;

/**
 * Time constant of the camera's catch-up, in milliseconds: after this long it has closed about
 * 63% of the remaining distance. Lower is snappier.
 */
export const CAMERA_TAU = 120;

/**
 * Ground covered per frame of the walk cycle. Ties the cadence to WALK_SPEED, so changing the
 * speed cannot silently make the feet skate. A fraction of a tile for the same reason: the cycle
 * must stay the same twelve frames a second at 32px that it was at 16px.
 */
export const PX_PER_WALK_FRAME = TILE * (5 / 16);

/**
 * Frame-rate independent exponential ease. `tau <= 0` snaps.
 *
 * The usual `current + (target - current) * 0.1` per frame is frame-rate dependent: the same code
 * eases twice as fast at 120Hz as at 60. This takes the elapsed time, so the camera behaves the
 * same on every display.
 */
export function ease(current: number, target: number, tau: number, deltaMs: number): number {
  if (tau <= 0 || deltaMs <= 0) return tau <= 0 ? target : current;
  return current + (target - current) * (1 - Math.exp(-deltaMs / tau));
}

/**
 * Where the camera's centre should be this frame.
 *
 * It holds completely still while Red stays inside the deadzone, and when she leaves it the camera
 * eases after her rather than snapping. The camera used to be pinned exactly to her position every
 * frame, which is what made walking feel like dragging the world around behind her instead of
 * moving through it.
 */
export function cameraFollow(
  centre: Vec,
  target: Vec,
  deltaMs: number,
  deadzone: { x: number; y: number } = CAMERA_DEADZONE,
  tau = CAMERA_TAU,
): Vec {
  const pull = (c: number, t: number, half: number): number => {
    const delta = t - c;
    if (Math.abs(delta) <= half) return c;
    // Ease toward the edge of the deadzone, not to Red herself, so she keeps her lead.
    return ease(c, t - Math.sign(delta) * half, tau, deltaMs);
  };
  return { x: pull(centre.x, target.x, deadzone.x), y: pull(centre.y, target.y, deadzone.y) };
}

/** Keeps the camera inside the world; returns rounded coordinates so tiles never shimmer. */
export function cameraTopLeft(
  centre: Vec,
  view: { width: number; height: number },
  world: { width: number; height: number },
): Vec {
  const clamp = (v: number, max: number) => (max <= 0 ? 0 : Math.min(Math.max(v, 0), max));
  return {
    x: Math.round(clamp(centre.x - view.width / 2, world.width - view.width)),
    y: Math.round(clamp(centre.y - view.height / 2, world.height - view.height)),
  };
}
