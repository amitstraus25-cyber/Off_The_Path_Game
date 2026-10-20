import { describe, expect, it } from 'vitest';
import {
  availableFor,
  CAMERA_FOCUS_Y,
  cameraCentreTiles,
  cameraFor,
  FRAME,
  MARGIN,
  MAX_VIEW,
  MAX_ZOOM,
  MIN_VIEW,
  pixelSnap,
  PORTRAIT_WORLD,
  PORTRAIT_WORLD_BAND,
  RED_FEET_BELOW_SPAWN,
  REFERENCE_VIEWPORTS,
  stageFit,
  TILE,
  TITLE_CARD_W,
  topEdgeRows,
  visibleTitleColumns,
} from '../src/camera.ts';

describe('stageFit', () => {
  it('fills a desktop frame at the capped zoom', () => {
    expect(stageFit({ width: 1280, height: 720 })).toEqual({
      zoom: MAX_ZOOM,
      view: { width: 640, height: 360 },
    });
  });

  it('drops a narrow phone to 1x rather than showing less than the minimum camera', () => {
    // 390 - 6 = 384 available, which is one whole minimum-camera width and no more.
    expect(stageFit({ width: 384, height: 464 })).toEqual({
      zoom: 1,
      view: { width: 384, height: 464 },
    });
  });

  it('never magnifies past MAX_ZOOM, however much room there is', () => {
    expect(stageFit({ width: 3840, height: 2160 }).zoom).toBe(MAX_ZOOM);
  });

  it('clamps the camera up to the minimum when the space is smaller than one', () => {
    const fit = stageFit({ width: 10, height: 10 });
    expect(fit).toEqual({ zoom: 1, view: { width: MIN_VIEW.width, height: MIN_VIEW.height } });
  });

  it('clamps the camera down to the maximum so a desktop never sees most of the map', () => {
    // At zoom 2 this would ask for 2000x1600 game pixels; MAX_VIEW is 1280x800.
    const fit = stageFit({ width: 4000, height: 3200 });
    expect(fit.view).toEqual({ width: MAX_VIEW.width, height: MAX_VIEW.height });
  });

  it('takes limits when it is given them, instead of the defaults', () => {
    const fit = stageFit(
      { width: 1000, height: 1000 },
      { min: { width: 100, height: 100 }, max: { width: 200, height: 200 }, maxZoom: 4 },
    );
    expect(fit).toEqual({ zoom: 4, view: { width: 200, height: 200 } });
  });

  /*
   * Phaser pivots a camera about its own centre and, with `roundPixels` on, ROUNDS that centre
   * before building the camera matrix. An odd camera dimension therefore puts the whole world one
   * pixel off, and at a map bound -- where there is no next column to slide in -- the camera
   * backdrop prints through the gap. Measured on the shipped build with the backdrop painted
   * magenta: 359 stray pixels down column 0 at 1280x800 (camera 621 wide), 679 at 2560x1440 (1261),
   * 534 at 375x812 (369), and none at all at 1673x449 or 844x390, whose cameras were already even.
   *
   * So the camera may not be odd on either axis. Asserted over a sweep rather than at the five
   * reference sizes, because the defect is a property of the arithmetic and the client found it at
   * a window nobody had thought to list.
   */
  it('never hands Phaser an odd camera dimension to round', () => {
    const odd: string[] = [];
    let sawBothParitiesBeforeEvening = false;
    for (let w = 200; w <= 3000; w += 7) {
      for (const h of [320, 390, 449, 720, 800, 1024, 1440]) {
        const { zoom, view } = stageFit({ width: w, height: h });
        if (view.width % 2 !== 0 || view.height % 2 !== 0)
          odd.push(`${w}x${h} -> ${view.width}x${view.height}`);
        // Non-vacuity: the raw floor this rule corrects really is odd sometimes, so the sweep is
        // exercising the correction rather than sailing past a rule that never applies.
        if (Math.floor(w / zoom) % 2 !== 0) sawBothParitiesBeforeEvening = true;
      }
    }
    expect(
      sawBothParitiesBeforeEvening,
      'the sweep never produced an odd raw width, so it is not testing the evening rule',
    ).toBe(true);
    expect(odd.slice(0, 10), `${odd.length} viewport(s) give an odd camera`).toEqual([]);
  });

  /*
   * And the limits the rule clamps to must themselves be even, or clamping can hand back the odd
   * number the sweep above is there to prevent. This is the assumption `even()` is written against.
   */
  it('clamps to limits that are themselves even on both axes', () => {
    expect({
      min: [MIN_VIEW.width % 2, MIN_VIEW.height % 2],
      max: [MAX_VIEW.width % 2, MAX_VIEW.height % 2],
    }).toEqual({ min: [0, 0], max: [0, 0] });
  });
});

describe('pixelSnap', () => {
  /*
   * The companion to stageFit: that one fixes how big a game pixel is, this one fixes where the
   * first one starts. The project has now been bitten three times by guarding a rectangle's size
   * and not its position -- a camera size quoted in a comment, a camera origin left hand-rolled
   * beside a derived size, and a canvas scale guarded while its offset was not.
   */
  it('is the half pixel the stage centring left behind', () => {
    // The measured defect: 718px of canvas plus 47px of margin centred in 800 lands at y 64.5.
    expect(pixelSnap(64.5)).toBe(0.5);
    // And the inline axis at an odd viewport width: 1242 centred in 1281 lands at x 19.5.
    expect(pixelSnap(19.5)).toBe(0.5);
    // A tie goes down and to the right, away from the header strip the canvas sits under.
    expect(pixelSnap(0.5)).toBe(0.5);
  });

  it('asks for nothing when the coordinate is already on the grid', () => {
    expect(pixelSnap(65)).toBe(0);
    expect(pixelSnap(0)).toBe(0);
    expect(pixelSnap(-19)).toBe(0);
  });

  it('lands the coordinate exactly on a whole pixel, whatever the fraction', () => {
    for (const v of [0.125, 3.25, 17.515625, 64.5, 782.9375, -0.75, -64.5]) {
      expect(Number.isInteger(v + pixelSnap(v)), `${v}`).toBe(true);
      expect(Math.abs(pixelSnap(v)), `${v}`).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('cameraCentreTiles', () => {
  /*
   * THE ONE-TILE TERM. The art tooling pointed its frames at `spawn.y - 5/8` while the game points
   * at `spawn.y + 1 - 5/8`, because Red's feet are one tile BELOW her spawn object and only the
   * game knew it. A whole round of framing was composed and guarded one row too high, and the cost
   * showed on the landing screen as crown keylines ruled across open lawn. This test is the term.
   */
  it('puts the camera 0.375 tiles BELOW the spawn object, not 0.625 above it', () => {
    expect(cameraCentreTiles({ x: 5, y: 20 })).toEqual({ x: 5.5, y: 20.375 });
  });

  it('is the feet offset plus the focus lift, in tiles', () => {
    const expected = (RED_FEET_BELOW_SPAWN + CAMERA_FOCUS_Y) / TILE;
    expect(expected).toBeCloseTo(0.375, 10);
    expect(cameraCentreTiles({ x: 0, y: 0 }).y).toBeCloseTo(expected, 10);
  });
});

describe('topEdgeRows', () => {
  /*
   * Ceil, not floor. A row the camera's edge cuts 78% into shows only the bottom fifth of what is
   * in it, which for a crown is its blue-black keyline -- a dark rule across the lawn, worse than
   * open sky. The planter and the audit both take their rows from here so they cannot drift.
   */
  it('starts at the first row that is mostly in frame', () => {
    expect(topEdgeRows(14.78)).toEqual([15, 16]);
    expect(topEdgeRows(13.0)).toEqual([13, 14]);
  });

  it('returns as many rows as asked for', () => {
    expect(topEdgeRows(14.78, 3)).toEqual([15, 16, 17]);
    expect(topEdgeRows(14.78, 1)).toEqual([15]);
  });
});

describe('PORTRAIT_WORLD_BAND', () => {
  it('is a share, because no single tile count is right at more than one viewport', () => {
    // screens.css caps the card against 0.6 * --otp-canvas-h, so this is a contract, not a guess.
    expect(PORTRAIT_WORLD_BAND).toBe(0.6);
    const phone = cameraFor(REFERENCE_VIEWPORTS.phone).tiles.height * PORTRAIT_WORLD_BAND;
    const tablet = cameraFor(REFERENCE_VIEWPORTS.tablet).tiles.height * PORTRAIT_WORLD_BAND;
    // The band an earlier pass froze as "7.3 tiles, measured on the game" is neither of these.
    expect(phone).toBeGreaterThan(9);
    expect(tablet).toBeLessThan(phone);
  });
});

describe('availableFor', () => {
  it('takes the border and the landscape margin off a desktop viewport', () => {
    const { portrait, available } = availableFor({ width: 1280, height: 800 });
    const sides = FRAME.border * 2 + MARGIN.landscape * 2;
    expect(portrait).toBe(false);
    expect(available).toEqual({ width: 1280 - sides, height: 800 - sides - FRAME.header });
  });

  it('gives a portrait phone no margin and only its share of the height', () => {
    const { portrait, available } = availableFor({ width: 375, height: 812 });
    const sides = FRAME.border * 2 + MARGIN.portrait * 2;
    expect(portrait).toBe(true);
    expect(available).toEqual({
      width: 375 - sides,
      height: 812 * PORTRAIT_WORLD - sides - FRAME.header,
    });
  });

  it('never returns a non-positive box, however small the viewport', () => {
    const { available } = availableFor({ width: 1, height: 1 });
    expect(available.width).toBeGreaterThan(0);
    expect(available.height).toBeGreaterThan(0);
  });
});

describe('cameraFor', () => {
  /*
   * THE NUMBERS THAT WERE WRONG FOR THREE ROUNDS. tools/graybox/src/forest-map.ts said the camera
   * showed "about 26 x 15 tiles at 1280 wide", in four places including the guard that certified
   * the framing, and every composition decision was aimed at that. It is 19.38 x 11.19. These two
   * assertions are the whole reason this module exists: if they ever disagree with what the game
   * draws, the art tooling is composing for a rectangle nobody sees.
   *
   * The figures were 19.41 x 11.22 (a 621x359 camera) until the camera was made even on both axes
   * so Phaser has no half pixel to round at a map bound -- see 'never hands Phaser an odd camera
   * dimension to round' above. One game pixel came off each axis; nothing else about the shot moved.
   */
  it('shows 19.38 x 11.19 tiles on the desktop reference viewport, not 26 x 15', () => {
    const cam = cameraFor(REFERENCE_VIEWPORTS.desktop);
    expect(cam.zoom).toBe(2);
    expect(cam.view).toEqual({ width: 620, height: 358 });
    expect(cam.tiles.width).toBeCloseTo(19.38, 2);
    expect(cam.tiles.height).toBeCloseTo(11.19, 2);
    expect(cam.tiles.width).toBeLessThan(26);
    expect(cam.tiles.height).toBeLessThan(15);
  });

  it('shows 11.5 x 16.69 tiles on the phone reference viewport, taller than it is wide', () => {
    const cam = cameraFor(REFERENCE_VIEWPORTS.phone);
    expect(cam.portrait).toBe(true);
    expect(cam.zoom).toBe(1);
    expect(cam.view).toEqual({ width: 368, height: 534 });
    expect(cam.tiles.width).toBeCloseTo(11.5, 2);
    expect(cam.tiles.height).toBeCloseTo(16.69, 2);
  });

  it('hides the left 4.8 tiles of the hero frame behind the copy column', () => {
    const { from, to } = visibleTitleColumns();
    // 306 CSS px of card over 64 CSS px per tile at zoom 2.
    expect(from).toBeCloseTo(TITLE_CARD_W / 64, 5);
    expect(from).toBeCloseTo(4.78, 2);
    expect(to).toBeCloseTo(19.38, 2);
    // A quarter of the hero shot is behind the card. Composition counted over the whole row is a
    // quarter wrong before it starts.
    expect(from / to).toBeGreaterThan(0.2);
  });

  it('reports tiles that agree with the view it reports, at every reference viewport', () => {
    for (const [name, viewport] of Object.entries(REFERENCE_VIEWPORTS)) {
      const cam = cameraFor(viewport);
      expect(cam.tiles.width, name).toBeCloseTo(cam.view.width / TILE, 10);
      expect(cam.tiles.height, name).toBeCloseTo(cam.view.height / TILE, 10);
      expect(cam.available.width, name).toBeLessThanOrEqual(viewport.width);
    }
  });
});
