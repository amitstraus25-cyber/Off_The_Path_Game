import { TILE } from './logic';
import type { Vec } from './logic';

/*
 * WHICH WAY THE OTHERS ARE (the client's review, 2026-10-25, P5).
 *
 * `bearing`: the words a screen reader hears in the forest summary (ui/App.tsx `worldAsText`),
 * which way each traveller lies and roughly how far -- the `otp:bearings` contract, indices never
 * words. (An edge arrow drawn from the same numbers was removed the same evening at the client's
 * word.)
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
