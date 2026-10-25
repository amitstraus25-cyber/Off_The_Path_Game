/*
 * Which keys the walk buttons keep to themselves.
 *
 * `world/input.ts` cancels Space and Enter on the window whenever the world owns input, and a
 * button's activation is a default action, so the five walk controls answered neither key: 0 click
 * events and Purple moved 0.0px, measured on all five for both keys at 1280x800, while a pointer click
 * on the same button moved her 78px. `ui/touch-controls.ts` now stops those two keys at the button
 * so the window never sees them and the browser's own activation survives.
 *
 * `e2e/touch-pad.spec.ts` presses the real keys in a real browser, which is the only place the
 * cancellation exists. What it cannot show is the SHAPE of the rule, and that is where the worse
 * bug would live: a guard that held back everything would leave a player focused on a walk button
 * unable to walk away from it or to close a panel, and it would pass every press-the-button test
 * in the suite, because each of those presses the key the guard is supposed to keep.
 */
import { describe, expect, it } from 'vitest';
import { activationKey } from '../src/ui/touch-controls';

describe('activationKey', () => {
  it('claims the two keys that activate a focused button', () => {
    // The space CHARACTER, not the code: this is `e.key`, which is what the handler reads.
    expect(activationKey(' ')).toBe(true);
    expect(activationKey('Enter')).toBe(true);
  });

  it('leaves the keys the world needs alone', () => {
    /*
     * Walking away from a focused walk button must still walk, and Escape must still close a
     * panel. Both reach the world only by bubbling past the button to the window listener, so
     * every one of these has to come back false.
     */
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'])
      expect(activationKey(key), `${key} would be held back at the button`).toBe(false);
  });

  it('is not fooled by the names the other input path uses', () => {
    /*
     * `KeyboardEvent.code` spells the same two keys 'Space' and 'Enter', and `world/input.ts`
     * works in codes -- so a reader moving between the two files has a real chance of writing the
     * code where the key belongs. 'Space' is the one that matters: as a `key` it never arrives, so
     * a guard written against it would hold back nothing and the controls would go dead again.
     */
    expect(activationKey('Space')).toBe(false);
    // And the letters the world walks with, which arrive here as plain characters.
    for (const key of ['w', 'a', 's', 'd', 't', 'Tab'])
      expect(activationKey(key), `${key} would be held back at the button`).toBe(false);
  });
});
