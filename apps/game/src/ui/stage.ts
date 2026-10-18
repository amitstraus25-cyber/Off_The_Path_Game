import { stageFit } from '../world/logic';

/** The frame drawn around the world: a 3px border all round plus the numbered header strip. */
export const FRAME = { border: 3, header: 44 } as const;

/**
 * Breathing room between the frame and the window edge. A phone gets none: 32px of a 390px screen
 * is a whole zoom step, and losing it drops the world from 2x to 1x, which is the difference
 * between 32px tiles and 16px ones.
 */
const MARGIN = { landscape: 16, portrait: 0 } as const;

/** Share of a portrait screen the world takes; the rest is the docked panel strip (decision D5). */
const PORTRAIT_WORLD = 0.72;

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
  const portrait = innerHeight > innerWidth;
  const margin = portrait ? MARGIN.portrait : MARGIN.landscape;
  const available = {
    width: Math.max(1, innerWidth - (FRAME.border * 2 + margin * 2)),
    // Portrait docks the panels below the world, so the world takes the upper part only.
    height: Math.max(
      1,
      (portrait ? innerHeight * PORTRAIT_WORLD : innerHeight) -
        (FRAME.border * 2 + FRAME.header + margin * 2),
    ),
  };

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
