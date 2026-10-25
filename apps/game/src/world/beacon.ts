import { TILE } from './logic';
import type { Rect, Vec } from './logic';

/*
 * WHICH WAY THE OTHERS ARE (the client's review, 2026-10-25, P5).
 *
 * On five of the eight legs the next character is off screen, and a careful newcomer who reads
 * every card has only seconds to spare, so any searching ended "after dark". Two answers from one
 * set of numbers, both read off Purple's feet and the camera every frame:
 *
 *   - `bearing`: for the words a screen reader hears in the forest summary (ui/App.tsx
 *     `worldAsText`), which way each traveller lies and roughly how far -- the `otp:bearings`
 *     contract, indices never words.
 *   - `beaconAngle`: for the quiet arrow at the frame's edge (ui/Beacon.tsx), the direction of the
 *     nearest UNMET character -- but only while no unmet character is on screen at all. With one
 *     in view the "!" and the glow already say where to go, and the arrow would only compete.
 *
 * Pure and Phaser-free, so test/beacon.test.ts holds it without a browser.
 */

/** Distance bands, in tiles: under the first is "a few steps", under the second "a short walk". */
export const BAND_TILES = [4, 12] as const;

/**
 * Which way `to` lies from `from`: one of eight 45-degree sectors CLOCKWISE FROM NORTH (0 north,
 * 2 east, 4 south, 6 west; the map's north is up) and a coarse distance band, nearest first.
 */
export function bearing(from: Vec, to: Vec): { sector: number; band: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const tiles = Math.hypot(dx, dy) / TILE;
  return {
    sector: Math.round(degrees / 45) % 8,
    band: tiles < BAND_TILES[0] ? 0 : tiles < BAND_TILES[1] ? 1 : 2,
  };
}

const inside = (p: Vec, r: Rect): boolean =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/**
 * The screen angle (radians, 0 = east, clockwise because y runs down) from `from` to the nearest of
 * `unmet`, or null when there is nobody unmet or when any of them is already inside `view`.
 */
export function beaconAngle(from: Vec, view: Rect, unmet: readonly Vec[]): number | null {
  if (unmet.length === 0 || unmet.some((p) => inside(p, view))) return null;
  let best = unmet[0]!;
  let bestD = Infinity;
  for (const p of unmet) {
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return Math.atan2(best.y - from.y, best.x - from.x);
}
