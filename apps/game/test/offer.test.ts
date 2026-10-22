/*
 * THE OFFER, AS THE CLIENT ASKED FOR IT ON 2026-10-22: the card opens by itself, and the deck's
 * joystick leans the way the keys walk.
 *
 * `cardOwed` and `walkOn` are the two halves of one decision. main.ts sends the INSPECT a MEET is
 * owed, which is what logs the card as read; `walkOn` takes the run back out through `talk`, which
 * must NOT be mistaken for a fresh meeting or Walk on would reopen the card it was closing. Both
 * are driven here through the real store over the real content, so a reducer change that moved
 * either phase fails here rather than in a browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { createStore } from '../src/store';
import type { Store } from '../src/store';
import { cardOwed, walkOn } from '../src/world/run';
import { KEY_TILT_PX, KEY_TILT_REDUCED_PX, keyTilt } from '../src/ui/touch-controls';

const content = v2.loadContent(raw);

/** A store in the forest, and a listener wired the way main.ts wires it. */
function forest(): Store {
  let clock = 0;
  const store = createStore(content, () => (clock += 10), 7);
  let last = store.getState().phase;
  store.subscribe((state) => {
    const owed = cardOwed(last, state, content);
    last = state.phase;
    if (owed) store.dispatch({ type: 'INSPECT', s: owed });
  });
  store.dispatch({ type: 'START', runId: 'r' });
  store.dispatch({ type: 'BEGIN' });
  return store;
}

describe('the card opens by itself', () => {
  it('meeting someone lands on their card, and the card is logged as read', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'owl' });
    const state = store.getState();
    expect(state.phase).toBe('card');
    expect(state.inspected).toEqual(['word-weaver']);
    expect(v2.reveal(state, content).find((r) => r.skillId === 'word-weaver')!.read).toBe(true);
  });

  it('is owed only on the step from the forest into a conversation', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'rabbit' });
    const state = { ...store.getState(), phase: 'talk' as const };
    expect(cardOwed('forest', state, content)).toBe('cottage-finder');
    // BACK from the card passes through `talk` on its way out: that is not a meeting.
    expect(cardOwed('card', state, content)).toBeNull();
    expect(cardOwed('forest', { ...state, active: null }, content)).toBeNull();
    expect(cardOwed('forest', store.getState(), content)).toBeNull();
  });

  it('Walk on leaves the offer for the forest, and meeting again opens the card again', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'cat' });
    walkOn(store);
    expect(store.getState().phase).toBe('forest');
    expect(store.getState().active).toBeNull();
    store.dispatch({ type: 'MEET', c: 'cat' });
    expect(store.getState().phase).toBe('card');
    // Read once is read: a second look adds nothing to the log.
    expect(store.getState().log.filter((e) => e.e === 'inspected')).toHaveLength(1);
  });

  it('Walk on does nothing outside an offer', () => {
    const store = forest();
    const before = store.getState();
    walkOn(store);
    expect(store.getState()).toBe(before);
  });
});

describe('the joystick follows the keys', () => {
  it('leans each way an arrow or WASD key walks', () => {
    expect(keyTilt(['ArrowRight'])).toEqual({ x: 1, y: 0 });
    expect(keyTilt(['KeyA'])).toEqual({ x: -1, y: 0 });
    expect(keyTilt(['ArrowUp'])).toEqual({ x: 0, y: -1 });
    expect(keyTilt(['KeyS'])).toEqual({ x: 0, y: 1 });
  });

  it('leans on the diagonal as far as on a straight, and not root-two further', () => {
    const { x, y } = keyTilt(['ArrowRight', 'ArrowDown']);
    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(y).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });

  it('stands up straight for opposite keys, the same key twice, and keys that do not walk', () => {
    expect(keyTilt(['ArrowLeft', 'ArrowRight'])).toEqual({ x: 0, y: 0 });
    expect(keyTilt(['ArrowRight', 'KeyD'])).toEqual({ x: 1, y: 0 });
    expect(keyTilt(['Space', 'Enter', 'KeyE'])).toEqual({ x: 0, y: 0 });
    expect(keyTilt([])).toEqual({ x: 0, y: 0 });
  });

  /*
   * The bound is read out of the stylesheet that draws the well and the knob, not restated here
   * (PAUL_BRIEF trap 5): a lean further than half the room the well leaves the knob would put the
   * knob over the rim on a key press, where only a drag may push it.
   */
  it('keeps the knob inside the well it sits in', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url)),
      'utf8',
    );
    const px = (re: RegExp): number => Number(re.exec(css)![1]);
    const well = px(/--otp-pad-stick:\s*(\d+)px/);
    const rim = px(/\.otp-stick \{[^}]*border:\s*(\d+)px/);
    const knob = px(/\.otp-stick-knob \{[^}]*width:\s*(\d+)px/);
    expect(KEY_TILT_PX).toBeLessThanOrEqual((well - 2 * rim - knob) / 2);
    expect(KEY_TILT_PX).toBeGreaterThan(KEY_TILT_REDUCED_PX);
    expect(KEY_TILT_REDUCED_PX).toBeGreaterThan(0);
  });
});
