/** Pure world maths: no Phaser, no DOM. Unit tested. */

export interface Vec {
  x: number;
  y: number;
}

/** Red's collision box, in pixels relative to her position (feet centre). */
export const FOOT_BOX = { width: 10, height: 6, offsetY: -3 } as const;
export const TILE = 16;
/** Logical pixels per second. */
export const WALK_SPEED = 60;
/** How close Red must stand to talk to someone, centre to centre. */
export const INTERACT_RADIUS = 24;

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

/** The smallest camera worth playing on: a phone still shows about twelve tiles across. */
export const MIN_VIEW = { width: 192, height: 108 } as const;
/** The largest, so a desktop player does not see half the map at once. Both fit the 960x672 map. */
export const MAX_VIEW = { width: 640, height: 400 } as const;
/** A 16px tile should read at 32-48 CSS px, so never magnify past 3. */
export const MAX_ZOOM = 3;

export interface StageFit {
  /** Whole CSS pixels per game pixel. */
  zoom: number;
  /** Camera size in game pixels. */
  view: { width: number; height: number };
}

/**
 * Picks a whole-CSS-pixel zoom and then derives the camera from whatever space is left, so the
 * canvas fills its frame at every size instead of being letterboxed.
 *
 * The previous rule floored the zoom in DEVICE pixels against a fixed 480x270 camera, which cannot
 * be shown at a whole zoom on a phone: a 390px screen at DPR 3 fitted 2.44 and floored to 2, giving
 * a 320x180 canvas, and at DPR 2 it floored to 1 and gave 240x135 — a world occupying a third of
 * the screen. Choosing the zoom in CSS pixels and letting the camera grow keeps one game pixel an
 * exact whole number of CSS pixels (which is what keeps the art crisp) while filling the space.
 */
export function stageFit(
  available: { width: number; height: number },
  limits: {
    min: { width: number; height: number };
    max: { width: number; height: number };
    maxZoom: number;
  } = { min: MIN_VIEW, max: MAX_VIEW, maxZoom: MAX_ZOOM },
): StageFit {
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  // The biggest whole zoom that still shows the minimum camera, capped so tiles stay tile-sized.
  const zoom = clamp(
    Math.min(
      Math.floor(available.width / limits.min.width),
      Math.floor(available.height / limits.min.height),
    ),
    1,
    limits.maxZoom,
  );
  return {
    zoom,
    view: {
      width: clamp(Math.floor(available.width / zoom), limits.min.width, limits.max.width),
      height: clamp(Math.floor(available.height / zoom), limits.min.height, limits.max.height),
    },
  };
}

/**
 * Half-size of the box Red moves inside before the camera takes any notice, in game pixels.
 * Wider than tall: sideways drift reads as natural framing, vertical drift reads as the camera
 * being late.
 */
export const CAMERA_DEADZONE = { x: 16, y: 10 } as const;

/**
 * Time constant of the camera's catch-up, in milliseconds: after this long it has closed about
 * 63% of the remaining distance. Lower is snappier.
 */
export const CAMERA_TAU = 120;

/**
 * How far above her feet the camera frames Red, in game pixels. Centring on the feet puts her
 * head in the middle of the shot and wastes the top of the screen on sky.
 */
export const CAMERA_FOCUS_Y = -10;

/**
 * Ground covered per frame of the walk cycle. Ties the cadence to WALK_SPEED, so changing the
 * speed cannot silently make the feet skate.
 */
export const PX_PER_WALK_FRAME = 5;

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
