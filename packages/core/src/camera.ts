/*
 * HOW BIG THE CAMERA ACTUALLY IS.
 *
 * This module exists because the answer was wrong for three rounds and nobody could see it. The
 * art tooling composed the world against a camera of "about 26 x 15 tiles at 1280 wide", written
 * as a comment in tools/graybox/src/forest-map.ts and repeated in four places including the guard
 * that certified the framing. The real camera at 1280x800 is 19.41 x 11.22 tiles -- a third
 * narrower and a third shorter. Every framing decision was aimed at a rectangle that does not
 * exist, which is why a canopy pass credited with nine closed columns moved the visible top edge
 * of the hero shot from three columns to four: five of its nine columns are off-camera, and the
 * stand it genuinely built sits behind the title card.
 *
 * The number was wrong in a comment rather than in code, so no test could catch it and no renderer
 * disagreed with it. The remedy is not a better comment. It is that the game and the tools now
 * derive the rectangle from the same function, so the two cannot drift again: if the frame chrome,
 * the margins or the zoom rule change, both move together or neither does.
 *
 * Pure arithmetic, per CLAUDE.md's rule for this package -- no DOM, no `window`, no Phaser. The
 * caller passes the viewport in; reading `innerWidth` stays in apps/game/src/ui/stage.ts.
 */

/**
 * World pixels per tile. The art moved from 16px to 32px tiles; the map stayed 60x42 TILES and the
 * level was never retuned, because everything written against this is a fraction of a tile rather
 * than a pixel count. Keep it that way: the next rescale should be this one constant.
 */
export const TILE = 32;

/** The frame drawn around the world: a 3px border all round plus the numbered header strip. */
export const FRAME = { border: 3, header: 44 } as const;

/**
 * Breathing room between the frame and the window edge. A phone gets none: 32px of a 390px screen
 * is a whole zoom step, and losing it drops the world from 2x to 1x, which is the difference
 * between 32px tiles and 16px ones.
 */
export const MARGIN = { landscape: 16, portrait: 0 } as const;

/** Share of a portrait screen the world takes; the rest is the docked panel strip (decision D5). */
export const PORTRAIT_WORLD = 0.72;

/**
 * The smallest camera worth playing on: a phone still shows about eleven tiles across.
 *
 * Eleven, not the twelve the 16px build floored at, because this is also the floor the view is
 * clamped UP to. The narrowest width the game is built for is 375px (BRAND_AND_UI), which leaves
 * 369 CSS px inside the frame, and at zoom 1 that is 11.5 tiles. A twelve-tile floor would make
 * the canvas 384 CSS px wide inside a 375px window -- a horizontal scrollbar on a phone, which
 * e2e/ui.spec.ts rightly fails on.
 */
export const MIN_VIEW = { width: TILE * 11, height: TILE * 6.75 } as const;
/** The largest, so a desktop player does not see most of the map at once: 40x25 of the 60x42. */
export const MAX_VIEW = { width: TILE * 40, height: TILE * 25 } as const;
/**
 * A 32px tile should read at 32-64 CSS px, so never magnify past 2.
 *
 * ART_PRODUCTION section 1 proposed 1.5x here, which would have kept both the old field of view
 * (26x15 tiles) and the old apparent tile size (48 CSS px) across the move to 32px art. It cannot
 * be done. The canvas is scaled in CSS over a nearest-sampled backing store, so a 1.5x scale draws
 * every other source pixel two CSS pixels wide on any DPR-1 display: the shimmer BRAND_AND_UI
 * forbids, and a direct violation of the two e2e tests that assert a whole number of CSS pixels per
 * game pixel (e2e/smoke.spec.ts, e2e/world.spec.ts). Letterboxing to reach an exact zoom is out for
 * the same reason -- e2e/world.spec.ts also asserts the canvas fills its frame.
 *
 * So the zoom stays a whole number and the field of view moves instead. Of the two whole numbers:
 *   zoom 1  -- 32 CSS px per tile, ~39 tiles across at 1280px wide. Half the map on screen at once,
 *              and every sprite SMALLER on screen than it is today, which spends the remaster's
 *              four times the detail on making everything harder to see.
 *   zoom 2  -- 64 CSS px per tile, ~19 tiles across at 1280px wide, ~29 at 1920px.
 * Taken: zoom 2.
 *
 * NOTE THAT "~19 TILES ACROSS AT 1280" HAS BEEN WRITTEN HERE SINCE THE REMASTER. The art tooling
 * spent three rounds composing against 26x15 -- the figure from the ABANDONED 1.5x option two
 * paragraphs up -- because it quoted a comment of its own instead of reading this one. That is the
 * whole argument for `cameraFor()` below: a number both sides derive cannot drift from a number one
 * side remembers.
 */
export const MAX_ZOOM = 2;

export interface Size {
  width: number;
  height: number;
}

export interface StageFit {
  /** Whole CSS pixels per game pixel. */
  zoom: number;
  /** Camera size in game pixels. */
  view: Size;
}

/** What the camera shows, for one viewport, in every unit anyone has asked for. */
export interface Camera extends StageFit {
  portrait: boolean;
  /** The space left for the world once the frame, header and margins are taken out. */
  available: Size;
  /** The camera in TILES, which is the unit the map and the art direction are written in. */
  tiles: Size;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Rounds a camera dimension down to an even number of game pixels.
 *
 * Phaser pivots a camera about its own centre: `Camera.preRender` takes `width * originX` (0.5 by
 * default) and, when `roundPixels` is on -- which it is, and must stay on, because it is what keeps
 * a game pixel landing on a whole device pixel -- ROUNDS that origin before building the camera
 * matrix. On an odd camera width the centre is a half pixel (621 * 0.5 = 310.5), the rounded origin
 * is 311, and the whole world is drawn one pixel to the right of where it should be.
 *
 * Nothing shows while there is map on both sides: the neighbouring column simply slides in. It
 * shows at a BOUND, where there is no next column and the camera backdrop prints through instead.
 * It was found by painting the backdrop magenta -- #FF00FF appears nowhere in the tileset, so a
 * magenta pixel is a hole and nothing else -- and counting: 359 stray pixels down column 0 at
 * 1280x800, 679 at 2560x1440, 534 at 375x812, and none at 844x390, whose camera was already even
 * on both axes. The same camera walked off the bound showed none, and turning `roundPixels` off at
 * the bound also showed none. So the trigger is the odd dimension, the mechanism is the rounded
 * origin, and the remedy is to not hand Phaser a half pixel to round. The alternative -- turning
 * `roundPixels` off -- buys the same zero at the cost of resampling every tile, which is the defect
 * this project spent a round removing.
 *
 * THE FIVE WORKED VIEWPORTS USED TO BE TABULATED HERE AND ONE OF THEM WAS WRONG. The row for
 * 1673x449 -- the client's own window, and the only one of the five anybody was still arguing
 * about -- read "camera 1280x367 (even)". 367 is odd; the camera there is 1280x366, because this
 * very function rounds it down. A number written in a comment and derived nowhere drifts, which is
 * the argument the top of this file opens with, and it had drifted INSIDE the fix written to stop
 * it. So the figures now live in packages/core/test/camera.test.ts, where `cameraFor` is called
 * for each of those viewports and the answer is asserted against a literal: a test that disagrees
 * with the code fails, and a comment that disagrees with the code does not.
 *
 * The cost here is at most one game pixel of field of view per axis, against a camera of several
 * hundred. `MIN_VIEW` and `MAX_VIEW` are both even on both axes, so this cannot push the view
 * outside its own limits; keep them even if they are ever retuned.
 */
const even = (v: number): number => v - (v % 2);

/**
 * Picks a whole-CSS-pixel zoom and then derives the camera from whatever space is left, so the
 * canvas fills its frame at every size instead of being letterboxed.
 *
 * The previous rule floored the zoom in DEVICE pixels against a fixed 480x270 camera, which cannot
 * be shown at a whole zoom on a phone: a 390px screen at DPR 3 fitted 2.44 and floored to 2, giving
 * a 320x180 canvas, and at DPR 2 it floored to 1 and gave 240x135 — a world occupying a third of
 * the screen. Choosing the zoom in CSS pixels and letting the camera grow keeps one game pixel an
 * exact whole number of CSS pixels (which is what keeps the art crisp) while filling the space.
 */
export function stageFit(
  available: Size,
  limits: { min: Size; max: Size; maxZoom: number } = {
    min: MIN_VIEW,
    max: MAX_VIEW,
    maxZoom: MAX_ZOOM,
  },
): StageFit {
  // The biggest whole zoom that still shows the minimum camera, capped so tiles stay tile-sized.
  const zoom = clamp(
    Math.min(
      Math.floor(available.width / limits.min.width),
      Math.floor(available.height / limits.min.height),
    ),
    1,
    limits.maxZoom,
  );
  return {
    zoom,
    view: {
      width: even(clamp(Math.floor(available.width / zoom), limits.min.width, limits.max.width)),
      height: even(
        clamp(Math.floor(available.height / zoom), limits.min.height, limits.max.height),
      ),
    },
  };
}

/**
 * The space the world gets inside a viewport, once the frame, the header strip and the margins are
 * taken out — and, in portrait, once the docked panel strip below the world has had its share.
 */
export function availableFor(viewport: Size): { portrait: boolean; available: Size } {
  const portrait = viewport.height > viewport.width;
  const margin = portrait ? MARGIN.portrait : MARGIN.landscape;
  const sides = FRAME.border * 2 + margin * 2;
  return {
    portrait,
    available: {
      width: Math.max(1, viewport.width - sides),
      height: Math.max(
        1,
        (portrait ? viewport.height * PORTRAIT_WORLD : viewport.height) - (sides + FRAME.header),
      ),
    },
  };
}

/**
 * THE ONE ANSWER. Give it a CSS viewport, get back what the camera actually shows — including the
 * size in tiles, which is the unit every composition decision is made in and the unit that was
 * wrong. Anything deciding where to put a tree, how wide a road may be, or which columns close the
 * top of a frame must call this rather than quoting a number.
 */
export function cameraFor(viewport: Size): Camera {
  const { portrait, available } = availableFor(viewport);
  const { zoom, view } = stageFit(available);
  return {
    portrait,
    available,
    zoom,
    view,
    tiles: { width: view.width / TILE, height: view.height / TILE },
  };
}

/**
 * Width of the title screen's copy column, in CSS pixels, at --otp-ui 1.
 *
 * It is here rather than only in screens.css because the art tooling has to know how much of the
 * hero frame a visitor CANNOT see: in landscape this column is opaque over the left quarter of the
 * camera, so a tree planted behind it is a tree nobody looks at. e2e/css-contract.spec.ts imports
 * this constant and asserts the rendered column is exactly it (times --otp-ui), which is what keeps
 * these two in step -- it used to assert a 310px literal of its own, which is not the same thing as
 * agreeing with this file.
 */
export const TITLE_CARD_W = 306;

/**
 * The viewports the project reviews at, named, so tooling and tests stop inventing their own.
 * These are the three widths docs/UX_REVIEW.md and the e2e capture spec use, plus the landscape
 * phone that keeps turning out to be the worst case for anything docked to the side.
 */
export const REFERENCE_VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 375, height: 812 },
  phoneLandscape: { width: 844, height: 390 },
} as const satisfies Record<string, Size>;

/*
 * ===========================================================================
 * WHERE THE CAMERA IS POINTED, as opposed to how big it is.
 * ===========================================================================
 *
 * The first version of this module published the camera's SIZE and left its ORIGIN alone, and the
 * very next round of composition was aimed one tile too high because of it: the art tooling put the
 * camera centre at `spawn.y - 5/8` while the game puts it at `spawn.y + 1 - 5/8`. Exactly one tile,
 * and it was not bookkeeping -- the camera's top edge lands 78% of the way through a row, so crowns
 * planted to close the row above it sat off-screen and the landing screen showed their keylines
 * instead: hard dark rules floating in open lawn on the hero shot of a marketing asset.
 *
 * The lesson is the same one as the size, one level up: a rectangle has four numbers and publishing
 * two of them is not publishing the rectangle. Both the game and the tooling derive the whole thing
 * from here now.
 */

/**
 * Red's feet sit one tile BELOW the `spawn-red` object's own origin.
 *
 * The map's objects are addressed from their top-left corner and her sprite's origin is at her
 * feet, so the scene does `spawn.y + TILE`. This is that `+ TILE`, named, because it is the term
 * the art tooling left out.
 */
export const RED_FEET_BELOW_SPAWN = TILE;

/**
 * How far above her feet the camera frames Red, in game pixels. Centring on the feet puts her
 * head in the middle of the shot and wastes the top of the screen on sky.
 */
export const CAMERA_FOCUS_Y = -TILE * (5 / 8);

/**
 * The share of the portrait camera that stays uncovered above the docked title card.
 *
 * Not a measurement: screens.css caps the card's height against `0.6 * --otp-canvas-h`, so this is
 * the contract the stylesheet guarantees. An earlier pass froze "7.3 tiles, measured on the game",
 * which is true at no viewport at all -- the real band is 12.80 tiles at 375x812, 13.00 at 390x844,
 * 8.84 at 768x1024 and 6.71 at 320x568. A share is derivable; a tile count is not.
 */
export const PORTRAIT_WORLD_BAND = 0.6;

/**
 * The camera's centre, IN TILES, for a spawn object at the given tile. This is the number the
 * framing passes point at, and getting it from here is what keeps the tooling's frame and the
 * game's frame the same rectangle.
 */
export function cameraCentreTiles(spawn: { x: number; y: number }): { x: number; y: number } {
  return {
    x: spawn.x + 0.5,
    y: spawn.y + (RED_FEET_BELOW_SPAWN + CAMERA_FOCUS_Y) / TILE,
  };
}

/**
 * The rows along a frame's top edge that a crown can actually CLOSE.
 *
 * Not `floor(y0)`. The camera's edge falls partway through a tile row, and a row the edge cuts 78%
 * of the way into shows only the bottom fifth of whatever is in it -- for a crown, that is its
 * keyline and nothing else, which is worse than an open sky because it reads as a dark rule ruled
 * across the lawn. A row has to be mostly in frame to count.
 */
export function topEdgeRows(y0: number, count = 2): number[] {
  const first = Math.ceil(y0);
  return Array.from({ length: count }, (_, i) => first + i);
}

/**
 * The tile columns of the DESKTOP title camera a visitor can actually SEE.
 *
 * The copy column is opaque over the left end of the frame, so canopy counted across the whole row
 * flatters itself: a framing pass was credited with nine closed columns of which five were off the
 * right of the camera and the rest were behind the card, while the middle of the picture carried an
 * unbroken seven-column hole. Returns a half-open range [from, to) in tile columns from the
 * camera's left edge.
 *
 * The card's left edge and the canvas's left edge coincide (both sit one border-plus-margin in), so
 * the hidden width is simply the card's own width over the CSS pixels a tile occupies.
 *
 * ONE VIEWPORT, DELIBERATELY. This took a `viewport` argument and answered for any of them, and the
 * answer was wrong everywhere but here. screens.css declares the card at
 * `min(306px * var(--otp-ui), 62%)`, and --otp-ui is a media-query step this package cannot see: on
 * the landscape phone the module itself names as the worst case for anything docked to the side,
 * --otp-ui is 0.7, so the card is 214px and covers 6.69 tiles while this returned 9.56 -- 2.87 tiles
 * of hidden band that is not hidden. Nothing ever passed an argument (both call sites are in
 * tools/graybox/src/forest-map.ts's title audit), and composition is aimed at the hero frame, so
 * the parameter only offered a wrong answer to anyone who took it up. The honest smaller-viewport
 * version has to carry the --otp-ui term, and that is a derivation to add when something needs it
 * rather than a default to leave lying about.
 */
export function visibleTitleColumns(): { from: number; to: number } {
  const cam = cameraFor(REFERENCE_VIEWPORTS.desktop);
  return { from: TITLE_CARD_W / (TILE * cam.zoom), to: cam.tiles.width };
}

/**
 * The nudge that puts a screen coordinate back ON the pixel grid, in CSS pixels.
 *
 * `stageFit` above settles how BIG one game pixel is -- a whole number of CSS pixels, never 1.5,
 * for the reasons MAX_ZOOM spends a paragraph on. It says nothing about where the first one
 * starts, and a scale is only half of a sampling grid: a canvas scaled by a whole 2 but laid out
 * at y 64.5 has `image-rendering: pixelated` resolve every game-pixel ROW across a half-pixel
 * boundary, so the whole world is resampled and the top edge shows it as a band of garbled rows.
 * That band is what a client photographed and called "laggy lines on the top", and the guard that
 * was supposed to catch it only ever checked the scale.
 *
 * Whole CSS pixels rather than whole device pixels: at a whole devicePixelRatio -- 1, 2, 3 -- a
 * whole CSS pixel is a whole device pixel too, so this is the stricter of the two and needs no
 * DOM to know which. (At a FRACTIONAL ratio neither this nor `stageFit` can give an exact grid,
 * because 1.5 device pixels per CSS pixel makes the scale itself fractional in device terms; that
 * is a separate problem and not one a position can fix.)
 *
 * Returns what to ADD to `position`, so a coordinate already on the grid returns 0 and callers can
 * accumulate it against an offset they have already applied.
 */
export function pixelSnap(position: number): number {
  return Math.round(position) - position;
}
