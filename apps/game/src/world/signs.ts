import { TILE } from './logic';
import type { Rect, Vec } from './logic';
import type { MapObject } from './map';

/*
 * THE THREE CYERA SIGNS IN THE WOOD (the client, 2026-10-23): the forest notice lettered
 * "I ♥ Cyera Research", a wooden "Cyera Speed!" board by the waterfall, and a blank board the
 * supplied logo is laid over. The lettering is painted (tools/graybox, `tiles/s-props.ts`); what a
 * sign SAYS is content's (`ui.world.signs`), and this file is the pure half of how the game finds
 * them: which sign Purple is near, and where the logo's blank face is on the canvas this frame.
 *
 * Phaser-free and DOM-free, so test/signs.test.ts walks it on the shipped map.
 */

/** Objects named `sign-<key>`; `<key>` is the sign's entry in content's `ui.world.signs`. */
export const SIGN_PREFIX = 'sign-';

/**
 * The canvas saying which sign Purple is near, by key, or null. A DOM event for `WITHIN_REACH`'s
 * reason (forest-scene.ts): the scene is the only thing that knows where she stands and the UI holds
 * no bus. The payload is the KEY and never words, so nothing but content can put a sentence into the
 * caption's live region -- an event forged by anything else on the page can at most name a key, and
 * a key content does not have says nothing.
 */
export const NEAR_SIGN = 'otp:near-sign';

/**
 * How near is near: two tiles from the sign's rectangle, measured from Purple's feet, on either axis.
 *
 * Two, because the forest notice stands on the row ABOVE the two-row road it overlooks, and a player
 * who only ever holds Right walks the lower row: her feet are then two tiles below the sign's foot,
 * and a caption she cannot raise from the road is a caption most players never see. Any wider and a
 * caption is up while the sign is still a speck at the edge of a phone's 12-tile camera.
 */
export const SIGN_NEAR = TILE * 2;

export const isSign = (o: { name: string }): boolean => o.name.startsWith(SIGN_PREFIX);

/** `sign-research` -> `research`. */
export const signKey = (name: string): string => name.slice(SIGN_PREFIX.length);

/** How far a point is from a rectangle on the worse of the two axes, 0 inside it. */
const reachOf = (p: Vec, r: Rect): number =>
  Math.max(
    Math.max(r.x - p.x, 0, p.x - (r.x + r.width)),
    Math.max(r.y - p.y, 0, p.y - (r.y + r.height)),
  );

/** The key of the nearest sign within `SIGN_NEAR` of Purple's feet, or null when none is. */
export function signNear(signs: readonly MapObject[], feet: Vec): string | null {
  let best: string | null = null;
  let bestReach = Infinity;
  for (const sign of signs) {
    const reach = reachOf(feet, sign);
    if (reach > SIGN_NEAR || reach >= bestReach) continue;
    best = signKey(sign.name);
    bestReach = reach;
  }
  return best;
}

/** Where the camera is this frame: its viewport on the canvas and its scroll, in game pixels. */
export interface View {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

/**
 * A sign's face on the canvas, in GAME pixels from the canvas's top-left, or null when it has none,
 * when no part of it is inside the camera's view, or when Purple is standing in front of it.
 *
 * THE SCROLL IS FLOORED, because that is what Phaser draws: with `roundPixels` on, the camera floors
 * its scroll before every render (Camera#preRender), and the tile under the face is drawn there. The
 * scene may hold a fractional scroll between its update and the render; a face placed off the
 * unfloored value would sit a game pixel off its board for that frame, which at zoom 2 is two CSS
 * pixels of logo hanging over the frame of the board it is meant to be painted on.
 *
 * IN FRONT OF PURPLE IS WHERE IT IS WRONG. The logo is DOM over the canvas, so it is drawn over
 * everything the canvas draws -- including her, when she walks below the board and her head crosses
 * it, which is the one place the forest's own depth says she is the nearer thing. So while her figure
 * overlaps the face, the face is not shown; the board is still there, blank, behind her head.
 */
export function faceOnCanvas(sign: MapObject, view: View, purple: Rect | null): Rect | null {
  const face = sign.face;
  if (!face) return null;
  const x = view.x + sign.x + face.x - Math.floor(view.scrollX);
  const y = view.y + sign.y + face.y - Math.floor(view.scrollY);
  const r = { x, y, width: face.width, height: face.height };
  const inView =
    r.x < view.x + view.width &&
    r.x + r.width > view.x &&
    r.y < view.y + view.height &&
    r.y + r.height > view.y;
  if (!inView) return null;
  if (purple) {
    const px = view.x + purple.x - Math.floor(view.scrollX);
    const py = view.y + purple.y - Math.floor(view.scrollY);
    const covered =
      px < r.x + r.width &&
      px + purple.width > r.x &&
      py < r.y + r.height &&
      py + purple.height > r.y;
    if (covered) return null;
  }
  return r;
}
