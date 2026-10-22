/**
 * GRANDMA'S DOOR, STANDING OPEN (the client, 2026-10-22). With the Word Weaver's `early-welcome`
 * the knock is skipped because word went ahead -- and the cottage should SAY so as Purple walks up
 * the lane: the door open and warm light inside. Grandma herself is never drawn in the doorway,
 * because the wolf's ending must stay possible on the same frame (a malicious copy of the skill
 * can be dealt, and the door opens for that run too: who opened it is the point of the game).
 *
 * WHY THE GAME PAINTS THIS AND GRAYBOX DOES NOT. Graybox is a build tool the game must not import,
 * and the tileset is not this file's owner's to regenerate. So the open door is built at boot from
 * the CLOSED door tile the game actually loaded: its stone surround, its arch, its threshold and
 * every pixel round the opening are the shipped art, byte for byte, and only the leaves are
 * repainted -- swung in, seen almost edge-on at each side, with the room's light between them.
 *
 * Every colour is the art's own. The dark is the arch's keyline, read off the tile; the light is the
 * brightest warm pixel of the lit window beside the door (`wall-window-lit`), so the doorway glows
 * with the same lamp the window already shows. Nothing here is a hex literal.
 *
 * THE GEOMETRY IS A MIRROR, and is guarded as one. `DOOR` and `archTop` restate the opening as
 * tools/graybox/src/tiles/s-cottage.ts paints it (`JAMB_W`, `OPEN_L`, `OPEN_R`, `DOOR_FOOT`,
 * `archTop`); apps/game/test/door.test.ts reads the shipped tileset and fails if the arch's keyline
 * is not where `archTop` says or if anything outside the opening changed.
 */

/** The door's opening inside its 32px tile: the leaf columns, its last row, the gap, the step. */
export const DOOR = { left: 5, right: 26, foot: 26, gap: 27, step: 28 } as const;

/** The top of the opening at column `x`: s-cottage.ts's segmental arch, four rows of rise. */
export function archTop(x: number): number {
  const u = (x - (DOOR.left + DOOR.right) / 2) / ((DOOR.right - DOOR.left) / 2);
  return 3 + Math.round(4 * u * u);
}

export type Rgb = readonly [number, number, number];

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * The lamp: the brightest WARM pixel in an RGBA tile (red over blue by 90 or more), or null if it
 * has none. Warm by a wide margin, so the cream plaster round a window (red over blue by about 40)
 * cannot be mistaken for the light in it.
 */
export function brightestWarm(rgba: ArrayLike<number>): Rgb | null {
  let best: Rgb | null = null;
  let bestLuma = -1;
  for (let p = 0; p + 3 < rgba.length; p += 4) {
    const r = rgba[p]!;
    const g = rgba[p + 1]!;
    const b = rgba[p + 2]!;
    if (rgba[p + 3]! === 0 || r - b < 90 || g < b) continue;
    const l = luma(r, g, b);
    if (l > bestLuma) {
      bestLuma = l;
      best = [r, g, b];
    }
  }
  return best;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/**
 * The four stops of the room's light, darkest first, as shares of the way from the keyline to the
 * lamp. Bands rather than a gradient: this is pixel art, and a smooth ramp at 32px reads as a blur.
 */
const ROOM = [0.34, 0.56, 0.78, 1] as const;

/** How many rows above the floor the room's lamp stands: the heart of the glow. */
const GLOW_ABOVE_FLOOR = 5;

/**
 * The closed door tile, opened: a NEW RGBA buffer the same size, `size` pixels square. The input is
 * not touched. `lamp` is the light to fill the room with.
 *
 *   - the two leaves, swung inward: the outermost column of each keeps the reveal line the art
 *     already draws there, the next is the keyline's dark, and the third catches a little of the
 *     room's light on its edge;
 *   - the room between them: four rings of an oval glow round a lamp standing low in the middle of
 *     the room, so the light reads as coming from somewhere inside rather than as a painted panel;
 *   - the gap under the old leaves is now the floor's lit edge, and the threshold's tread takes a
 *     warm wash where the light spills out over it.
 */
export function openDoor(
  closed: ArrayLike<number>,
  size: number,
  lamp: Rgb,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(closed.length));
  for (let i = 0; i < closed.length; i++) out[i] = closed[i]!;
  const at = (x: number, y: number): number => (y * size + x) * 4;
  const read = (x: number, y: number): Rgb => {
    const p = at(x, y);
    return [out[p]!, out[p + 1]!, out[p + 2]!];
  };
  const put = (x: number, y: number, c: Rgb): void => {
    const p = at(x, y);
    out[p] = c[0];
    out[p + 1] = c[1];
    out[p + 2] = c[2];
    out[p + 3] = 255;
  };

  const { left, right, foot, gap, step } = DOOR;
  const middle = (left + right) / 2;
  // The dark: the arch's own keyline, read where the arch is lowest-crowned (its centre).
  const dark = read(Math.round(middle), archTop(Math.round(middle)) + 3);
  const edge = mix(dark, lamp, 0.3);
  const room = ROOM.map((t) => mix(dark, lamp, t));
  const halfWidth = (right - 3 - (left + 3)) / 2;

  for (let x = left + 1; x <= right - 1; x++) {
    const top = archTop(x) + 4;
    for (let y = top; y <= foot; y++) {
      if (x === left + 1 || x === right - 1) put(x, y, dark);
      else if (x === left + 2 || x === right - 2) put(x, y, edge);
      else {
        // An oval of light round a lamp low in the middle of the room, in four rings.
        const across = (x - middle) / (halfWidth + 2);
        const up = (y - (foot - GLOW_ABOVE_FLOOR)) / (foot - archTop(Math.round(middle)));
        const light = 1 - Math.hypot(across, up);
        const band = light < 0.2 ? 0 : light < 0.42 ? 1 : light < 0.66 ? 2 : 3;
        put(x, y, room[band]!);
      }
    }
    // The floor's lit edge where the leaves used to stop short of it.
    if (x > left + 1 && x < right - 1) put(x, gap, room[2]!);
    // The light spilling out over the threshold's tread, two rows of it, fading.
    if (x > left + 2 && x < right - 2) {
      put(x, step, mix(read(x, step), lamp, 0.4));
      put(x, step + 1, mix(read(x, step + 1), lamp, 0.2));
    }
  }
  return out;
}
