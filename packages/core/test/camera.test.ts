import { describe, expect, it } from 'vitest';
import {
  availableFor,
  cameraFor,
  FRAME,
  MARGIN,
  MAX_VIEW,
  MAX_ZOOM,
  MIN_VIEW,
  PORTRAIT_WORLD,
  REFERENCE_VIEWPORTS,
  stageFit,
  TILE,
  TITLE_CARD_W,
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
   * the framing, and every composition decision was aimed at that. It is 19.41 x 11.22. These two
   * assertions are the whole reason this module exists: if they ever disagree with what the game
   * draws, the art tooling is composing for a rectangle nobody sees.
   */
  it('shows 19.41 x 11.22 tiles on the desktop reference viewport, not 26 x 15', () => {
    const cam = cameraFor(REFERENCE_VIEWPORTS.desktop);
    expect(cam.zoom).toBe(2);
    expect(cam.view).toEqual({ width: 621, height: 359 });
    expect(cam.tiles.width).toBeCloseTo(19.41, 2);
    expect(cam.tiles.height).toBeCloseTo(11.22, 2);
    expect(cam.tiles.width).toBeLessThan(26);
    expect(cam.tiles.height).toBeLessThan(15);
  });

  it('shows 11.53 x 16.69 tiles on the phone reference viewport, taller than it is wide', () => {
    const cam = cameraFor(REFERENCE_VIEWPORTS.phone);
    expect(cam.portrait).toBe(true);
    expect(cam.zoom).toBe(1);
    expect(cam.view).toEqual({ width: 369, height: 534 });
    expect(cam.tiles.width).toBeCloseTo(11.53, 2);
    expect(cam.tiles.height).toBeCloseTo(16.69, 2);
  });

  it('hides the left 4.8 tiles of the hero frame behind the copy column', () => {
    const { from, to } = visibleTitleColumns();
    // 306 CSS px of card over 64 CSS px per tile at zoom 2.
    expect(from).toBeCloseTo(TITLE_CARD_W / 64, 5);
    expect(from).toBeCloseTo(4.78, 2);
    expect(to).toBeCloseTo(19.41, 2);
    // A quarter of the hero shot is behind the card. Composition counted over the whole row is a
    // quarter wrong before it starts.
    expect(from / to).toBeGreaterThan(0.2);
  });

  it('hides nothing horizontally in portrait, where the card docks below the world', () => {
    const { from, to } = visibleTitleColumns(REFERENCE_VIEWPORTS.phone);
    expect(from).toBe(0);
    expect(to).toBeCloseTo(11.53, 2);
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
