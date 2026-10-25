/*
 * THE SEAT: the bolder line and the small grounding shadow every spawned character finishes on.
 *
 * Why it exists (the client's playtests, 2026-10-25): players could not find the cast on the map.
 * Two fixes were chosen, and this file is the painters' half of them. The other half is the ground
 * glow under every character not yet met, which is the scene's (`fx-ground-glow`, painted in
 * `faces.ts` and laid by `apps/game/src/world/forest-scene.ts`).
 *
 * ONE HOME, imported by `cast.ts` and `bystanders.ts` alike. Those two each carry their own `base()`
 * on purpose -- `cast.ts` imports `bystanders.ts`, and the reverse import would be a cycle -- but a
 * third module both import is no cycle, and seven painters finishing on one hand is the point.
 *
 * Neither function moves the box a character fills, and that is a constraint rather than a
 * courtesy: `assertBodyPlans()` in `cast.ts` holds every idle silhouette to its section 10.2 plan
 * within a pixel, the scene measures headroom, footprint and ink off these very frames, and the
 * frames are bottom-aligned at 32 x 48. So the line thickens INWARD, onto pixels the figure already
 * covers, and the shadow only fills transparent pixels inside the figure's own columns.
 */
import type { Img, RGBA } from '../paint.ts';

const same = (a: RGBA, b: RGBA): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/**
 * How much of a feature has to stand INSIDE its line, across, before its right edge earns the
 * second pixel; and how much has to stand above a bottom edge before that edge does.
 *
 * ART_DIRECTION section 3.2 says "2 px along the bottom and lower-right edge of any mass wider than
 * 16 px", and that figure was written for crowns and boulders. Taken literally on a 32 x 48 cast it
 * would thicken nobody smaller than the keeper, and the client asked for all seven. These keep the
 * rule's INTENT -- bodies take the band, slender features do not -- counted in the pixels a feature
 * has between its own lines, because that is what a second pixel of line would eat. The rabbit's
 * ears are three or four across inside their line, the cat's legs two, the owl's ear tufts one or
 * two, the toadstool's twig two deep: thicken one of those and the line eats the feature it was
 * meant to frame, which is the one thing a silhouette cannot afford. A head, a body, a cap, a shell
 * or a hem is five and more, and takes the band.
 */
const ACROSS = 5;
const DEPTH = 3;

/**
 * The keyline, thickened to two pixels down the shade side: the right edge and the bottom edge,
 * never the top or the left (ART_DIRECTION 3.2: "Do not thicken the top or left edge. Ever.").
 *
 * Runs AFTER `outline(line)`. A pixel of the figure is taken into the line when the line's own
 * outer ring lies directly to its right or directly below it -- the ring, not a groove: the pixel
 * beyond the line must be air or the frame's edge -- and the feature it belongs to is wide enough
 * (`ACROSS`) or deep enough (`DEPTH`) inside its line to spare the pixel. Every pixel this paints
 * was already opaque, so the silhouette, the bbox and the transparent pixels are exactly what they
 * were. What changes is weight: the side the light does not reach now carries a two-pixel band
 * against the lawn, which is what seats a figure and what the eye catches first at the playing
 * camera.
 *
 * Decided off a snapshot, so a pixel taken into the line on this pass is never mistaken for the
 * ring on the same pass and the band cannot creep three or four pixels deep.
 */
export function thicken(img: Img, line: RGBA): void {
  const w = img.w;
  const h = img.h;
  const snap = new Uint8Array(img.data);
  const at = (x: number, y: number): RGBA => {
    const i = (y * w + x) * 4;
    return [snap[i]!, snap[i + 1]!, snap[i + 2]!, snap[i + 3]!];
  };
  const air = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= w || y >= h || snap[(y * w + x) * 4 + 3] === 0;
  const isLine = (x: number, y: number): boolean => !air(x, y) && same(at(x, y), line);

  /** Inside the line: how far the figure runs left of (x, y), and up from it, before a line or air. */
  const inside = (x: number, y: number, dx: number, dy: number): number => {
    let n = 0;
    for (let i = x, j = y; !air(i, j) && !isLine(i, j); i += dx, j += dy) n++;
    return n;
  };

  const take: [number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (air(x, y) || isLine(x, y)) continue;
      const right = isLine(x + 1, y) && air(x + 2, y);
      const below = isLine(x, y + 1) && air(x, y + 2);
      if (!right && !below) continue;
      const byRight = right && inside(x, y, -1, 0) >= ACROSS;
      // The row standing on the contact bar takes the band whatever is drawn above it: that is
      // the seat itself, and a foot row thickened only between the face's marks reads as a comb.
      const byBelow = below && (y + 1 === h - 1 || inside(x, y, 0, -1) >= DEPTH);
      if (!byRight && !byBelow) continue;
      // A bottom edge that is really the LEFT contour stepping in -- the line below runs off into
      // air on its left -- is the lit side curving away, and the left edge never thickens.
      if (!byRight && air(x - 1, y + 1)) continue;
      take.push([x, y]);
    }
  for (const [x, y] of take) img.px(x, y, line);
}

/**
 * The small grounding shadow: a flattened half-ellipse of the character's own dark, tucked under
 * the feet and pushed down and to the right, away from the light (PIXEL_STANDARD section 3).
 *
 * IN THE SPRITE'S OWN RAMP, NEVER THE LAWN'S. Both painters removed a baked `shadow`-ramp ellipse
 * because it was grass-green and walked onto the sand with the figure (`cast.ts`, note 3). This is
 * not that: `c` is a keyline of the character's own ramp, set a step lighter than the line it sits
 * beside so the two read as line and shade rather than as one blot, and it is the same colour on any
 * ground. The scene still lays its own ground-tinted pool under every figure; this is the darker
 * contact inside it, the way the board seats a figure with a dark wedge at the heel.
 *
 * Runs LAST, after `outline` and `thicken`, and paints only transparent pixels, in the bottom
 * `rows` rows, between the figure's own leftmost and rightmost columns. So it reaches out from
 * under a cap, a tail or a shell where the feet stand narrower than the body, it never widens or
 * deepens the silhouette's box, and it rises with the figure on the hop, whose top frame keeps its
 * row of daylight under the bar.
 */
export function groundShadow(img: Img, c: RGBA, rows = 3): void {
  const w = img.w;
  const h = img.h;
  let x0 = w;
  let x1 = -1;
  let feet0 = w;
  let feet1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (img.get(x, y)[3] !== 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y === h - 1) {
          if (x < feet0) feet0 = x;
          if (x > feet1) feet1 = x;
        }
      }
  if (x1 < 0 || feet1 < 0) return;
  // 1.4 times the base, as ART_DIRECTION section 4 asks, centred two pixels down-right of the feet.
  const cx = (feet0 + feet1 + 1) / 2 + 2;
  const rx = ((feet1 - feet0 + 1) * 1.4) / 2;
  const cy = h + 0.5;
  const ry = rows + 0.5;
  for (let y = h - rows; y < h; y++)
    for (let x = x0; x <= x1; x++) {
      if (img.get(x, y)[3] !== 0) continue;
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.px(x, y, c);
    }
}

/**
 * Both, in the one order that works: the line thickens first, off the ring `outline` just drew,
 * and the shadow goes in last, so it can never be mistaken for the ring and thickened against.
 * Every spawned character's painter ends on `outline(line)` and then this.
 */
export function seat(img: Img, line: RGBA, shadow: RGBA): void {
  thicken(img, line);
  groundShadow(img, shadow);
}
