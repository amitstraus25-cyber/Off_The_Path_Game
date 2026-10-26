/*
 * THE OFFER, AS THE CLIENT ASKED FOR IT ON 2026-10-26: a short conversation first, and the card
 * only when Purple asks to see it ("like a ping pong"); and the deck's joystick leans the way the
 * keys walk.
 *
 * A MEET lands in `talk` and reads nothing. "Show me" sends the INSPECT, which is what logs the card
 * as read, so a player who says "No thanks" has not read it and the reveal says so. `walkOn` takes
 * the run back to the forest from either panel. All driven through the real store over the real
 * content, so a reducer change that moved either phase fails here rather than in a browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { createStore } from '../src/store';
import type { Store } from '../src/store';
import { walkOn } from '../src/world/run';
import { KEY_TILT_PX, KEY_TILT_REDUCED_PX, keyTilt } from '../src/ui/touch-controls';

const content = v2.loadContent(raw);

/** A store in the forest. */
function forest(): Store {
  let clock = 0;
  const store = createStore(content, () => (clock += 10), 7);
  store.dispatch({ type: 'START', runId: 'r' });
  store.dispatch({ type: 'BEGIN' });
  return store;
}

const readOf = (store: Store, skillId: string): boolean =>
  v2.reveal(store.getState(), content).find((r) => r.skillId === skillId)!.read;

describe('the conversation comes before the card', () => {
  it('meeting someone opens the conversation, and nothing is read yet', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'owl' });
    expect(store.getState().phase).toBe('talk');
    expect(store.getState().inspected).toEqual([]);
    expect(readOf(store, 'word-weaver')).toBe(false);
  });

  it('"Show me" opens the card and logs it as read', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'owl' });
    store.dispatch({ type: 'INSPECT', s: 'word-weaver' });
    expect(store.getState().phase).toBe('card');
    expect(store.getState().inspected).toEqual(['word-weaver']);
    expect(readOf(store, 'word-weaver')).toBe(true);
  });

  it('"No thanks" leaves the conversation for the forest, and meeting again starts it over', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'cat' });
    walkOn(store);
    expect(store.getState().phase).toBe('forest');
    expect(store.getState().active).toBeNull();
    store.dispatch({ type: 'MEET', c: 'cat' });
    expect(store.getState().phase).toBe('talk');
  });

  it('Walk on from the card leaves for the forest too, and a second look adds nothing to the log', () => {
    const store = forest();
    store.dispatch({ type: 'MEET', c: 'cat' });
    store.dispatch({ type: 'INSPECT', s: 'latch-lifter' });
    walkOn(store);
    expect(store.getState().phase).toBe('forest');
    store.dispatch({ type: 'MEET', c: 'cat' });
    expect(store.getState().phase).toBe('talk');
    store.dispatch({ type: 'INSPECT', s: 'latch-lifter' });
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
    expect(keyTilt(['Space', 'Enter', 'KeyT'])).toEqual({ x: 0, y: 0 });
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
