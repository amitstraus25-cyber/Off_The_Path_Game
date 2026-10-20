import { availableFor, pixelSnap, stageFit } from '../world/logic';

/*
 * FRAME, MARGIN and PORTRAIT_WORLD used to be declared here, and the arithmetic that turns a
 * window into the world's box was written out below. Both now live in @otp/core's camera.ts, with
 * `availableFor` doing exactly what this function used to do inline, because tools/graybox has to
 * be able to work out what the camera shows WITHOUT a DOM -- and when it could not, it guessed,
 * and composed three rounds of art against a camera a third bigger than the real one.
 */

/** Tells Phaser the camera size changed, in game pixels. */
export type StageSizer = (width: number, height: number) => void;

/**
 * Puts the canvas back ON the pixel grid after the stage has centred it.
 *
 * THE HALF PIXEL. `.otp-stage` is a centring grid and the canvas carries 47px of top margin (the
 * frame's header and its border), so the canvas's top edge is half of whatever space is left over:
 * at 1280x800 that is (800 - (718 + 47)) / 2 = 17.5, which lands the canvas at y 64.5. Its height
 * is a clean 718 and its zoom a clean 2 -- only its ORIGIN is wrong, and `image-rendering:
 * pixelated` over a half-pixel origin resamples every game-pixel row, worst along the top edge.
 * That band of garbled rows is the defect a client photographed as "laggy lines on the top".
 *
 * The leftover's parity is not ours to choose: an odd viewport height puts the block axis back on
 * a whole pixel and an odd viewport WIDTH takes the inline axis off it, so both axes need this and
 * neither can be fixed by picking a different camera. Hence a correction rather than a different
 * box -- the box is what fills the frame, and `stageFit` is not allowed to shave it.
 *
 * `position: relative` is deliberate. A relative offset is not part of layout, so it cannot feed
 * back into the centring that produced the fraction, and it leaves the margin box -- which is what
 * the stage centres and what keeps the whole frame on screen -- exactly as the stylesheet wrote
 * it.
 *
 * The nudge is measured against the box WITHOUT it, by taking the offset already applied back off
 * the rect, and then replaces it. Adding to it instead looks equivalent and is not: every resize
 * whose centring lands on a half pixel would add another half, and a sweep of 84 viewports drifted
 * the canvas 7px off centre -- still on the grid, no longer in the middle of the window, and on
 * its way out of the frame. The offset this way can never exceed half a pixel.
 *
 * Returns the canvas's rect AFTER the nudge, because that is the rect the DOM panels must anchor
 * to and re-reading it is the only way to be sure it is the one that landed.
 */
function snapToPixelGrid(canvas: HTMLCanvasElement): DOMRect {
  const rect = canvas.getBoundingClientRect();
  // What a previous call already moved it by; the rect above was measured with it applied.
  const applied = {
    x: parseFloat(canvas.style.left || '0'),
    y: parseFloat(canvas.style.top || '0'),
  };
  const dx = pixelSnap(rect.left - applied.x);
  const dy = pixelSnap(rect.top - applied.y);
  if (dx === applied.x && dy === applied.y) return rect;
  canvas.style.position = 'relative';
  canvas.style.left = `${dx}px`;
  canvas.style.top = `${dy}px`;
  return canvas.getBoundingClientRect();
}

/**
 * Sizes the canvas to fill its frame at a whole-CSS-pixel zoom, and publishes the resulting world
 * box as custom properties so the DOM panels can anchor to the canvas rather than to the window.
 * Nothing here ever requires rotating the phone (decision D5).
 */
export function fitStage(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  resize: StageSizer,
): number {
  // Reading the window is this module's job; working out what fits inside it is camera.ts's.
  const { portrait, available } = availableFor({ width: innerWidth, height: innerHeight });

  const { zoom, view } = stageFit(available);
  // Phaser first: Scale.NONE means the canvas attributes follow the camera, and the CSS size below
  // is what actually scales it.
  resize(view.width, view.height);
  canvas.style.width = `${view.width * zoom}px`;
  canvas.style.height = `${view.height * zoom}px`;
  stage.dataset['orientation'] = portrait ? 'portrait' : 'landscape';

  const rect = snapToPixelGrid(canvas);
  /*
   * The rect as measured, not as rounded.
   *
   * These four used to be published through Math.round, which is how the canvas sat at y 64.5
   * while --otp-canvas-y said "65px": every panel anchored to the world -- the frame, its header
   * strip, the title dock, the HUD -- was positioned from a place the canvas was not, and the
   * frame's header overlapped the world by the half pixel the rounding invented. Rounding a
   * measurement cannot make a canvas land on a whole pixel; it can only hide that it did not,
   * which is exactly what it did here for as long as the guard checked the scale and not the
   * origin. snapToPixelGrid has made these whole numbers by moving the canvas, so there is
   * nothing left for a Math.round to do but lie again.
   */
  const root = document.documentElement.style;
  root.setProperty('--otp-canvas-w', `${rect.width}px`);
  root.setProperty('--otp-canvas-h', `${rect.height}px`);
  root.setProperty('--otp-canvas-x', `${rect.left}px`);
  root.setProperty('--otp-canvas-y', `${rect.top}px`);
  return zoom;
}

export function watchStage(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  resize: StageSizer,
): () => void {
  const apply = (): void => void fitStage(stage, canvas, resize);
  apply();
  addEventListener('resize', apply);
  addEventListener('orientationchange', apply);
  return () => {
    removeEventListener('resize', apply);
    removeEventListener('orientationchange', apply);
  };
}
