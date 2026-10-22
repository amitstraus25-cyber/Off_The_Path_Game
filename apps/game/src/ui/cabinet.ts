import { MAX_ZOOM, MIN_VIEW, PORTRAIT_WORLD, TILE, availableFor, stageFit } from '@otp/core';
import type { Size, StageFit } from '@otp/core';

/*
 * THE ARCADE CABINET'S GEOMETRY: the space the cabinet takes before the world gets any.
 *
 * The client's decision, 2026-10-22, after sending a Mortal Kombat II cabinet photo: the cabinet is
 * THE presentation, on every screen size. A marquee across the top, the world as the screen, a
 * control panel (the deck) with a joystick and an A button. docs/PAUL_BRIEF.md section 8 recorded
 * the argument against it and the measurement that settles the cost: the cabinet cannot be painted
 * in space the layout leaves empty, because `stageFit` derives the camera to FILL what it is
 * given -- there is no spare room to paint into. So the cabinet RESERVES its room first and the
 * world takes the largest whole-number zoom that fits what is left. Integer scaling stays law.
 *
 * Pure: no DOM, no window. `ui/stage.ts` asks it with `innerWidth`/`innerHeight` and publishes the
 * answer as CSS custom properties, so the stylesheet never quotes these numbers back.
 *
 * WHERE THIS SHOULD LIVE, AND DOES NOT YET. The camera's one answer is `cameraFor()` in
 * packages/core/src/camera.ts, and tools/graybox composes the art against it. That function knows
 * nothing about a cabinet, so from this change it describes a camera the game no longer builds --
 * the exact drift trap 1 in docs/PAUL_BRIEF.md is about. `cabinetFor` is written to be lifted into
 * camera.ts as it stands (its only imports are core's own), at which point `cameraFor` becomes
 * `cabinetFor` and the art tooling sees the shipped camera again. Until then, `cabinetFor(...)` is
 * the shipped camera and anything that needs it asks here.
 */

/** The marquee's height, at every size: the logo and the name across the top of the cabinet. */
export const MARQUEE = 40;

/**
 * The deck's depth: the joystick's 96px (`--otp-pad-stick` in tokens.css) and DECK_PAD either side.
 * Below the screen it is this tall; beside it (a landscape phone) each side column is this wide.
 * test/cabinet.test.ts holds this sum against the stylesheet's stick, so neither can drift.
 */
export const DECK_STICK = 96;
export const DECK_PAD = 12;
export const DECK = DECK_STICK + DECK_PAD * 2;

/**
 * Where the deck goes.
 *
 *   portrait  the deck sits in the strip `availableFor` already leaves under the world in portrait
 *             (PORTRAIT_WORLD, decision D5): the strip the panels dock into. It costs the world
 *             nothing beyond the marquee, which is how a phone keeps the world as large as the frame
 *             allows -- the client's own condition for phones.
 *   below     a landscape window with the height to spare: the control panel under the screen, as
 *             the photograph has it.
 *   sides     a landscape window without it -- a phone on its side, a short laptop window -- where a
 *             panel underneath would leave no room for even a zoom-1 world. The stick goes left of
 *             the screen and A right of it, the way a handheld holds them.
 *   overlay   a landscape window too small for either (568x320, 360x400: below every reviewed
 *             device). Nothing is reserved; the deck is drawn over the bottom of the world while you
 *             walk and folds away otherwise, which is exactly what the pad always did on a phone
 *             held sideways -- the HUD's pills lift over it as they used to (screens.css).
 */
export type DeckPlace = 'portrait' | 'below' | 'sides' | 'overlay';

export interface CabinetFit extends StageFit {
  place: DeckPlace;
  /** Reserved around the screen, in CSS pixels: the marquee above, the deck below or beside. */
  top: number;
  bottom: number;
  side: number;
  /** The box the world and every screen live in: the viewport less what the cabinet reserved. */
  screen: Size;
  /** `availableFor`'s answer for that box. */
  portrait: boolean;
  available: Size;
  /** The camera in tiles, which is the unit the map is composed in. */
  tiles: Size;
}

/**
 * The biggest whole zoom at which the smallest camera worth playing still fits, or 0 when none
 * does. `stageFit` clamps to 1 so that it can always answer; choosing between two layouts needs to
 * know when 1 does not actually fit.
 */
export function fittingZoom(available: Size): number {
  return Math.min(
    MAX_ZOOM,
    Math.floor(
      Math.min(available.width / MIN_VIEW.width, available.height / MIN_VIEW.height) + 1e-9,
    ),
  );
}

/**
 * The portrait answer: the VIEWPORT is what is portrait, as the stylesheet's `orientation` media
 * queries see it, so the question is asked of the viewport and the marquee is then taken out of the
 * world's share. Asking `availableFor` of the box under the marquee instead flips a near-square
 * window (360x400: a 360x360 box) to landscape while every portrait rule in the stylesheet still
 * applies -- the stage centred, the title card docked as if in portrait, and the two disagreeing.
 * `availableFor` gives the world PORTRAIT_WORLD of the height in portrait, so the marquee costs the
 * world that share of its 40px and the docked strip the rest.
 */
function portraitFor(viewport: Size): { portrait: boolean; available: Size } {
  const { available } = availableFor(viewport);
  return {
    portrait: true,
    available: {
      width: available.width,
      height: Math.max(1, available.height - MARQUEE * PORTRAIT_WORLD),
    },
  };
}

function fit(
  place: DeckPlace,
  viewport: Size,
  reserved: { bottom: number; side: number },
): CabinetFit {
  const screen = {
    width: Math.max(1, viewport.width - reserved.side * 2),
    height: Math.max(1, viewport.height - MARQUEE - reserved.bottom),
  };
  const { portrait, available } =
    place === 'portrait' ? portraitFor(viewport) : availableFor(screen);
  const { zoom, view } = stageFit(available);
  return {
    place,
    top: MARQUEE,
    ...reserved,
    screen,
    portrait,
    available,
    zoom,
    view,
    tiles: { width: view.width / TILE, height: view.height / TILE },
  };
}

/** How far the smallest playable camera overshoots a box, in CSS pixels summed over both axes. */
export function overshoot(available: Size): number {
  return (
    Math.max(0, MIN_VIEW.width - available.width) + Math.max(0, MIN_VIEW.height - available.height)
  );
}

/**
 * The cabinet for one CSS viewport: where the deck goes, what is reserved, and the camera the world
 * gets in what is left.
 *
 * In landscape both places are tried and the one that gives the world the bigger zoom wins; a tie
 * goes to `below`, the photograph's arrangement.
 *
 * WHERE NOTHING FITS EVEN ZOOM 1 -- a window smaller than any device the game is reviewed on, such
 * as 568x320 or 360x400 -- the camera is clamped up past its box whatever is chosen, so the choice
 * is the arrangement that overshoots LEAST, and `overlay` is a candidate too: it reserves no deck
 * and draws it over the world while you walk, as the pad always did. Measured, the first draft kept
 * `below` there, and at 360x400 the world spilled 26px into the deck and the idle joystick sat over
 * the title card's one button.
 */
export function cabinetFor(viewport: Size): CabinetFit {
  // Portrait exactly when the stylesheet's `orientation: portrait` is, so the two never disagree.
  if (viewport.height > viewport.width) return fit('portrait', viewport, { bottom: 0, side: 0 });

  const below = fit('below', viewport, { bottom: DECK, side: 0 });
  const sides = fit('sides', viewport, { bottom: 0, side: DECK });
  // A side deck that leaves a box taller than it is wide is a portrait layout, which it is not.
  const candidates = sides.portrait ? [below] : [below, sides];
  const best = candidates.reduce((a, b) =>
    fittingZoom(b.available) > fittingZoom(a.available) ? b : a,
  );
  if (fittingZoom(best.available) > 0) return best;
  return [...candidates, fit('overlay', viewport, { bottom: 0, side: 0 })].reduce((a, b) =>
    overshoot(b.available) < overshoot(a.available) ? b : a,
  );
}
