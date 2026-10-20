import { availableFor, stageFit } from '../world/logic';

/*
 * FRAME, MARGIN and PORTRAIT_WORLD used to be declared here, and the arithmetic that turns a
 * window into the world's box was written out below. Both now live in @otp/core's camera.ts, with
 * `availableFor` doing exactly what this function used to do inline, because tools/graybox has to
 * be able to work out what the camera shows WITHOUT a DOM -- and when it could not, it guessed,
 * and composed three rounds of art against a camera a third bigger than the real one.
 *
 * Re-exported rather than just imported: FRAME is part of this module's public surface.
 */
export { FRAME } from '@otp/core';

/** Tells Phaser the camera size changed, in game pixels. */
export type StageSizer = (width: number, height: number) => void;

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

  const rect = canvas.getBoundingClientRect();
  const root = document.documentElement.style;
  root.setProperty('--otp-canvas-w', `${Math.round(rect.width)}px`);
  root.setProperty('--otp-canvas-h', `${Math.round(rect.height)}px`);
  root.setProperty('--otp-canvas-x', `${Math.round(rect.left)}px`);
  root.setProperty('--otp-canvas-y', `${Math.round(rect.top)}px`);
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
