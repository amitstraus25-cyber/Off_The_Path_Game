/*
 * The HUD on its own, in the real world box, for e2e/hud.spec.ts. TEST ONLY.
 *
 * This is an entry point of its own and NOTHING in the game reaches it: index.html loads
 * src/main.ts, main.ts imports nothing from e2e/, and the spec builds this page into a temporary
 * directory and serves it by intercepting a path on the preview origin. So there is no switch to
 * leave on, no symbol in the production bundle and nothing for test/csp.test.ts to grep -- the
 * property that makes the debug handle's mistake impossible here is that this code has no road
 * into `dist`, rather than a flag standing in the road.
 *
 * What is real: the stylesheets in the order the game loads them (screens.css included, which draws
 * the cabinet's deck face; it was missing until the clock and the basket moved under a portrait
 * world, the first rule here measured against that face), the stage (`watchStage` fits a plain
 * canvas and publishes the same --otp-canvas-* box Phaser's does, so every `.otp-world-anchor` rule
 * resolves exactly as it does in play), the world frame's box (`.otp-world-frame`, empty: its
 * stylesheet places it round the canvas from those same properties), and the touch pad
 * (`createTouchControls`, so the overlap the spec measures is against the actual stick and A
 * button, not a rectangle written down here). What is not: Phaser, the store and the frame's
 * header text and hint.
 *
 * `window.__hudFixture.set(...)` is the spec's one hook. It lives in this file and only this file.
 */
import { render } from 'preact';
import type { Input } from '../src/world/input';
import { Hud } from '../src/ui/Hud';
import type { HudProps } from '../src/ui/Hud';
import { watchStage } from '../src/ui/stage';
import { createTouchControls } from '../src/ui/touch-controls';
// The game's own order: tokens (a <link> in index.html), then Hud's hud.css (reached through App
// before main.ts imports panels.css), then panels.css. hud.css therefore comes FIRST, which is the
// order its selectors have to win in.
import '../src/ui/tokens.css';
import '../src/ui/panels.css';
import '../src/ui/screens.css';

declare global {
  interface Window {
    __hudFixture?: { set(next: Partial<HudProps>): void };
  }
}

const stage = document.getElementById('game');
const ui = document.getElementById('ui');
if (!stage || !ui) throw new Error('hud-fixture.html is missing #game or #ui');

const canvas = document.createElement('canvas');
stage.append(canvas);
watchStage(stage, canvas, () => undefined);

const input: Input = {
  read: () => ({ x: 0, y: 0, interactPressed: false, carry: null }),
  setStick: () => undefined,
  pressInteract: () => undefined,
  walkFor: () => undefined,
  spend: () => undefined,
  carrying: () => false,
  destroy: () => undefined,
};
const deck = createTouchControls(input, {
  walkGroup: 'Walk',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  stop: 'Stop',
  interact: 'Interact',
});
// The forest's deck: both thumb controls live, as on Explore.
deck.setMode('play');
ui.append(deck.root);

const anchor = document.createElement('div');
anchor.className = 'otp-world-anchor';
ui.prepend(anchor);

// The frame round the world, as components.tsx `WorldFrame` draws it: what "under the world" means.
const frame = document.createElement('div');
frame.className = 'otp-world-frame';
ui.prepend(frame);

let props: HudProps = { remainingMs: 180_000, basket: [] };
const draw = (): void => render(<Hud {...props} />, anchor);
draw();

window.__hudFixture = {
  set(next) {
    props = { ...props, ...next };
    draw();
  },
};
