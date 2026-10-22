/*
 * THE ARCADE CABINET'S GEOMETRY (ui/cabinet.ts): what it reserves, and that the world it leaves is
 * still a whole-number zoom that fits.
 *
 * The browser half -- the marquee, the deck and the canvas actually landing where these numbers say
 * -- is e2e/cabinet.spec.ts. This is the arithmetic, at the reviewed sizes and across a sweep.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FRAME, MIN_VIEW, REFERENCE_VIEWPORTS, availableFor } from '@otp/core';
import {
  DECK,
  DECK_PAD,
  DECK_STICK,
  HUD_PILL,
  HUD_STRIP_GAP,
  MARQUEE,
  PAD_GUTTER,
  PORTRAIT_DECK,
  cabinetFor,
  fittingZoom,
  hudDockFor,
  hudStrip,
  overshoot,
} from '../src/ui/cabinet';
import { createInput } from '../src/world/input';
import { STEP_PX } from '../src/ui/touch-controls';

const TOKENS = fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url));
const PANELS = fileURLToPath(new URL('../src/ui/panels.css', import.meta.url));
const SCREENS = fileURLToPath(new URL('../src/ui/screens.css', import.meta.url));

/** The whole frame the world sits in: the canvas, its border and its header. */
const frameOf = (fit: ReturnType<typeof cabinetFor>) => ({
  width: fit.view.width * fit.zoom + FRAME.border * 2,
  height: fit.view.height * fit.zoom + FRAME.border * 2 + FRAME.header,
});

describe('the cabinet at the reviewed sizes', () => {
  it('puts the deck where the photograph has it wherever there is the height', () => {
    const desktop = cabinetFor(REFERENCE_VIEWPORTS.desktop);
    expect(desktop.place).toBe('below');
    // The cabinet costs field of view, never crispness: the desktop keeps its 64px tiles.
    expect(desktop.zoom).toBe(2);
  });

  it('keeps a phone in portrait to the marquee alone', () => {
    for (const vp of [REFERENCE_VIEWPORTS.phone, REFERENCE_VIEWPORTS.tablet]) {
      const fit = cabinetFor(vp);
      expect(fit.place, `${vp.width}x${vp.height}`).toBe('portrait');
      expect(fit.bottom + fit.side, `nothing but the marquee at ${vp.width}`).toBe(0);
      expect(fit.screen.height).toBe(vp.height - MARQUEE);
      expect(fit.portrait, 'portrait exactly when the stylesheet says so').toBe(true);
    }
  });

  it('turns the deck to the sides on a phone held sideways, and in the client’s own window', () => {
    for (const vp of [REFERENCE_VIEWPORTS.phoneLandscape, { width: 1673, height: 449 }]) {
      const fit = cabinetFor(vp);
      expect(fit.place, `${vp.width}x${vp.height}`).toBe('sides');
      expect(fit.zoom).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('the world takes the largest whole zoom that fits what is left', () => {
  // Every landscape and portrait size from a small phone to a wide monitor, on a coarse grid.
  const sweep: { width: number; height: number }[] = [];
  for (let width = 360; width <= 2560; width += 64)
    for (let height = 360; height <= 1440; height += 48) sweep.push({ width, height });

  it('never draws the frame outside the screen box it reserved', () => {
    for (const vp of sweep) {
      const fit = cabinetFor(vp);
      if (fittingZoom(fit.available) === 0) continue; // below the smallest playable camera
      const frame = frameOf(fit);
      const where = `${vp.width}x${vp.height} (${fit.place})`;
      expect(frame.width, `frame width at ${where}`).toBeLessThanOrEqual(fit.screen.width);
      expect(frame.height, `frame height at ${where}`).toBeLessThanOrEqual(fit.screen.height);
    }
  });

  it('is a whole zoom, and no smaller than the fit allows', () => {
    for (const vp of sweep) {
      const fit = cabinetFor(vp);
      expect(Number.isInteger(fit.zoom)).toBe(true);
      const fits = fittingZoom(fit.available);
      if (fits > 0) expect(fit.zoom, `${vp.width}x${vp.height}`).toBe(fits);
    }
  });

  it('gives a landscape window the better of the two places, and the photograph on a tie', () => {
    for (const vp of sweep.filter((v) => v.height <= v.width)) {
      const fit = cabinetFor(vp);
      const below = fittingZoom(
        availableFor({ width: vp.width, height: vp.height - MARQUEE - DECK }).available,
      );
      const where = `${vp.width}x${vp.height}`;
      if (fit.place === 'sides' && below > 0)
        expect(fit.zoom, `${where} took the side deck for no gain`).toBeGreaterThan(below);
      if (fit.place === 'below') expect(fit.zoom, where).toBe(Math.max(below, 1));
    }
  });

  it('leaves the deck its strip under a portrait world', () => {
    for (const vp of sweep.filter((v) => v.height > v.width && v.height >= 568)) {
      const fit = cabinetFor(vp);
      const strip = fit.screen.height - frameOf(fit).height;
      expect(strip, `${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(DECK);
    }
  });

  it('overshoots least where nothing fits, and never spills the world into a reserved deck', () => {
    // Below every reviewed device: no arrangement fits even zoom 1, so the least overshoot wins.
    // A deck reserved anywhere would cost more of the world than drawing it over the world does.
    for (const vp of [
      { width: 568, height: 320 },
      { width: 600, height: 330 },
    ])
      expect(cabinetFor(vp).place, `${vp.width}x${vp.height}`).toBe('overlay');
    // Near-square and portrait by the stylesheet's own rule: portrait here too, never landscape.
    expect(cabinetFor({ width: 360, height: 400 }).place).toBe('portrait');
    expect(cabinetFor({ width: 360, height: 400 }).portrait).toBe(true);
    expect(overshoot(MIN_VIEW)).toBe(0);
    expect(overshoot({ width: MIN_VIEW.width - 3, height: MIN_VIEW.height - 4 })).toBe(7);
  });

  it('knows when even zoom 1 does not fit', () => {
    expect(fittingZoom({ width: MIN_VIEW.width - 1, height: MIN_VIEW.height })).toBe(0);
    expect(fittingZoom(MIN_VIEW)).toBe(1);
  });
});

/*
 * THE CLOCK AND THE BASKET UNDER A PORTRAIT WORLD (the UX review, 2026-10-22: "on portrait phones
 * the timer and basket sit over the world"). A portrait cabinet leaves its own ground between the
 * frame's foot and the deck; where that holds a pill with air either side, the pills stand there
 * (`strip`) and the world's bottom corners are forest again. Everywhere else they stay in the world.
 * The browser half -- the pills really landing in that strip, clear of the canvas and the deck --
 * is e2e/hud.spec.ts.
 */
describe('where the clock and the basket stand', () => {
  const sweep: { width: number; height: number }[] = [];
  for (let width = 320; width <= 2560; width += 32)
    for (let height = 320; height <= 1440; height += 24) sweep.push({ width, height });

  it('moves them under the world on the portrait phone and tablet the client reviews on', () => {
    for (const vp of [REFERENCE_VIEWPORTS.phone, REFERENCE_VIEWPORTS.tablet]) {
      const fit = cabinetFor(vp);
      expect(hudDockFor(fit), `${vp.width}x${vp.height}`).toBe('strip');
    }
    // 375x812: 812 - 40 marquee - (504 + 6 + 44) frame - 131 deck. Derived, not remembered: the
    // e2e measures the same strip off the page.
    const phone = cabinetFor(REFERENCE_VIEWPORTS.phone);
    expect(hudStrip(phone)).toBe(
      REFERENCE_VIEWPORTS.phone.height - MARQUEE - frameOf(phone).height - PORTRAIT_DECK,
    );
  });

  it('leaves them in the world where the strip is too short for a pill, and in every landscape', () => {
    // 320x568: 18px under the frame. A pill squeezed in there would stand on the deck.
    const small = cabinetFor({ width: 320, height: 568 });
    expect(hudStrip(small)).toBeLessThan(HUD_PILL);
    expect(hudDockFor(small)).toBe('world');
    for (const vp of sweep.filter((v) => v.height <= v.width)) {
      const fit = cabinetFor(vp);
      expect(hudStrip(fit), `${vp.width}x${vp.height}`).toBe(0);
      expect(hudDockFor(fit), `${vp.width}x${vp.height}`).toBe('world');
    }
  });

  it('only ever docks them in a strip that holds a full-size pill and its air', () => {
    let strips = 0;
    for (const vp of sweep.filter((v) => v.height > v.width)) {
      const fit = cabinetFor(vp);
      const room = fit.screen.height - frameOf(fit).height - PORTRAIT_DECK;
      expect(hudStrip(fit), `${vp.width}x${vp.height}`).toBe(Math.max(0, room));
      if (hudDockFor(fit) === 'strip') {
        strips += 1;
        expect(room, `${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(
          HUD_PILL + HUD_STRIP_GAP * 2,
        );
      } else expect(room, `${vp.width}x${vp.height}`).toBeLessThan(HUD_PILL + HUD_STRIP_GAP * 2);
    }
    // A sweep in which nothing docks proves nothing about the docking.
    expect(strips).toBeGreaterThan(0);
  });
});

describe('the deck and the stylesheet agree', () => {
  it('is as deep as the stick the stylesheet draws, and its padding', () => {
    const css = readFileSync(TOKENS, 'utf8');
    const stick = /--otp-pad-stick:\s*(\d+)px/.exec(css);
    expect(stick, 'tokens.css no longer declares --otp-pad-stick').not.toBeNull();
    expect(Number(stick![1])).toBe(DECK_STICK);
    expect(DECK).toBe(DECK_STICK + DECK_PAD * 2);
    // The stylesheet's fallback is the same deck, for the frame before stage.ts publishes.
    expect(css).toContain(`--otp-cab-deck: ${DECK}px;`);
    expect(css).toContain(`--otp-cab-top: ${MARQUEE}px;`);
  });

  it('stands the portrait deck as tall as the stylesheet draws it, and the pill as tall', () => {
    const tokens = readFileSync(TOKENS, 'utf8');
    const gutter = /--otp-pad-gutter:\s*(\d+)px/.exec(tokens);
    const border = /--otp-panel-border:\s*(\d+)px/.exec(tokens);
    expect(gutter, 'tokens.css no longer declares --otp-pad-gutter').not.toBeNull();
    expect(border, 'tokens.css no longer declares --otp-panel-border').not.toBeNull();
    expect(Number(gutter![1])).toBe(PAD_GUTTER);
    expect(Number(border![1])).toBe(FRAME.border);
    // The console face's top edge is that border (screens.css `.otp-touch`).
    expect(readFileSync(SCREENS, 'utf8')).toMatch(
      /\.otp-touch \{[^}]*border-top: var\(--otp-panel-border\) solid/,
    );
    expect(PORTRAIT_DECK).toBe(DECK_STICK + PAD_GUTTER * 2 + FRAME.border);
    const pill = /--otp-hud-basket-h:\s*calc\((\d+)px \* var\(--otp-ui\)\)/.exec(
      readFileSync(PANELS, 'utf8'),
    );
    expect(pill, 'panels.css no longer declares --otp-hud-basket-h').not.toBeNull();
    expect(Number(pill![1])).toBe(HUD_PILL);
  });
});

describe('one press carries a distance, at any frame rate', () => {
  /*
   * The defect: a walk button held the stick for as long as four tiles takes at WALK_SPEED, so a
   * runner whose frames were capped walked 34px of 128 (CI). Owed as distance, the press carries the
   * same four tiles however the frames fall.
   */
  const carried = (frame: number): number => {
    const input = createInput(new EventTarget() as unknown as Window);
    input.walkFor(1, 0, STEP_PX);
    let walked = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const { x, carry } = input.read();
      if (carry === null) break;
      expect(x).toBe(1);
      const step = Math.min(frame, carry);
      walked += step;
      input.spend(step);
    }
    expect(input.read().carry, 'the carry ended by itself').toBeNull();
    expect(input.read().x, 'and the stick is let go').toBe(0);
    return walked;
  };

  it('walks exactly four tiles in tiny frames, in normal ones and in starved ones', () => {
    for (const frame of [0.5, 2, 3.7, 40])
      expect(carried(frame), `${frame}px a frame`).toBeCloseTo(STEP_PX, 9);
  });

  it('gives way to the stick, and to a lost focus', () => {
    const target = new EventTarget();
    const input = createInput(target as unknown as Window);
    input.walkFor(0, 1, STEP_PX);
    input.setStick(1, 0);
    expect(input.carrying()).toBe(false);
    expect(input.read()).toMatchObject({ x: 1, y: 0, carry: null });
    input.walkFor(0, 1, STEP_PX);
    target.dispatchEvent(new Event('blur'));
    expect(input.carrying()).toBe(false);
    expect(input.read()).toMatchObject({ x: 0, y: 0 });
  });
});
