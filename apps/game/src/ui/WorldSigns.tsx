import { useEffect, useRef } from 'preact/hooks';
import type { Rect } from '../world/logic';

/*
 * THE CYERA LOGO ON ITS BOARD IN THE WOOD (the client, 2026-10-23).
 *
 * The board is the canvas's -- `sign-logo-l` and `sign-logo-r`, painted BLANK in tools/graybox -- and
 * the logo is this: the official file, `/brand/cyera-logo-white.svg`, which is
 * `reference/brand/logos/cyera-logo-white.svg` byte for byte (e2e/forest-signs.spec.ts compares the
 * two). CLAUDE.md rule 5 forbids redrawing the mark, so it is never traced into the tileset; it is an
 * <img>, which keeps the vector's own proportions and crispness and cannot be recoloured, and the
 * strict CSP needs nothing beyond `img-src 'self'` for it. White, because the board's face is dark:
 * the logo README's rule, white on dark.
 *
 * WHERE IT GOES is the face the painter left blank, published on the map's `sign-logo` object and
 * read back here as a rectangle on the canvas in game pixels (world/signs.ts `faceOnCanvas`), times
 * the canvas's CSS scale. The box is the face exactly, so it is pixel-aligned with the board's own
 * pixels; the logo sits centred inside it at its own aspect ratio (`object-fit: contain`), so the
 * box's shape never stretches it.
 *
 * It moves with the camera by a transform written once a frame, and only when it changed, as the
 * other overlays do, and the layer clips to the world's box. Off the camera,
 * or with Purple standing in front of the board, it is hidden.
 *
 * TO A SCREEN READER it is nothing, which is correct: it is scenery, and what the sign says is said
 * once, politely, by its caption when Purple is near (ui/App.tsx). The layer is `aria-hidden` and the
 * image's alt is empty.
 */

/** What the logo layer needs of the scene: which signs carry a face, where each is, the scale. */
export interface SignFaces {
  readonly signFaces: readonly string[];
  signFace(key: string): Rect | null;
  readonly canvasWidth: number;
}

/** The official mark, as `public/brand` serves it: white, for the board's dark face. */
export const LOGO_SRC = '/brand/cyera-logo-white.svg';

export function WorldSigns({ faces }: { faces: SignFaces }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const shown = new Map<string, string>();
    const step = (): void => {
      frame = requestAnimationFrame(step);
      const box = layer.current;
      if (!box) return;
      // CSS pixels per game pixel: the world's box is the canvas's box (ui/stage.ts).
      const zoom = faces.canvasWidth > 0 ? box.clientWidth / faces.canvasWidth : 0;
      for (const el of Array.from(box.children) as HTMLElement[]) {
        const key = el.dataset['sign'] ?? '';
        const at = zoom > 0 ? faces.signFace(key) : null;
        const place = at
          ? `${at.x * zoom}|${at.y * zoom}|${at.width * zoom}|${at.height * zoom}`
          : 'hidden';
        if (shown.get(key) === place) continue;
        shown.set(key, place);
        if (!at) {
          el.hidden = true;
          continue;
        }
        el.hidden = false;
        el.style.transform = `translate(${at.x * zoom}px, ${at.y * zoom}px)`;
        el.style.width = `${at.width * zoom}px`;
        el.style.height = `${at.height * zoom}px`;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [faces]);

  return (
    <div class="otp-worldsigns" ref={layer} aria-hidden="true" data-world-signs="">
      {faces.signFaces.map((key) => (
        <div class="otp-worldsign" key={key} data-sign={key} hidden>
          <img class="otp-worldsign__logo" src={LOGO_SRC} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
}
