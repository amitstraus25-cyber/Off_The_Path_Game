import type { v2 } from '@otp/core';

/*
 * THE PLAY STATS, sent (the client, 2026-11-04). Three quiet notes per run to `POST /api/play`
 * (apps/api/src/plays.ts): `start` when the walk begins, then `end` when it ends or `quit` when the
 * player leaves first. Anonymous by construction: the run's token and log (exactly what a post
 * sends), the device class and whether the game is embedded. No name, no cookie, no storage.
 *
 * FIRE AND FORGET. Nothing here is awaited by the game, nothing is shown to the player, and a note
 * that fails is simply not counted: a broken stats route must never be a broken walk.
 *
 * `keepalive`, so a `quit` sent from `pagehide` still leaves as the tab closes. Same origin and no
 * credentials, like every other request this game makes (`connect-src 'self'`).
 */

const PATH = '/api/play';

export type Device = 'phone' | 'desktop';

export type PlayNote =
  { stage: 'start'; token: string } | { stage: 'end' | 'quit'; token: string; log: v2.RunLog };

/** A touch screen with no hover is a phone or a tablet; everything else is a computer. */
export const deviceClass = (win: Window = window): Device =>
  win.matchMedia('(hover: none)').matches ? 'phone' : 'desktop';

/** In a frame, or in a parent whose origin will not even let us ask. */
export function isEmbedded(win: Window = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

/** Sends one note. Never throws, never waits, and says nothing either way. */
export function notePlay(note: PlayNote, win: Window = window): void {
  try {
    void fetch(PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...note, device: deviceClass(win), embedded: isEmbedded(win) }),
      keepalive: true,
      mode: 'same-origin',
      credentials: 'omit',
      cache: 'no-store',
    }).catch(() => undefined);
  } catch {
    // A browser that refuses the request outright (a keepalive quota, say) is a note not counted.
  }
}
