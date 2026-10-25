/*
 * The rule that stops a double-click answering a question the player has not read yet.
 *
 * A plain double-click on "Show me the skill" used to record Allow and end the encounter: click
 * one mounts the skill card under a pointer that has not moved, and the `otp-panel-in` slide then
 * carries the Allow pill through that exact point, so click two lands on a verdict. A verdict
 * cannot be retaken, so the run is over, and the toast reports a weighed decision nobody made.
 *
 * e2e/modal-guard.spec.ts drives the real double-click in a real browser, which is the only place
 * the geometry exists. What it cannot see is the SHAPE of the rule, and that is where the much
 * worse bug would live: a guard that also swallowed keyboard and assistive activation would leave
 * a switch player pressing Allow and watching nothing happen, on every card, forever -- and it
 * would pass every pointer test in the suite, because none of them has a `detail` of 0.
 *
 * The times below are chosen from the defect and from the platform, never from the constant the
 * rule is written with: a test that says "one millisecond under the threshold" re-states the
 * implementation and holds nothing.
 */
import { describe, expect, it } from 'vitest';
import { activationIsDeliberate } from '../src/ui/components';

/** A real pointer click carries its count: 1 for a single, 2 for the second of a double. */
const SINGLE = 1;
const DOUBLE = 2;
/** Enter, Space, `element.click()`, and every assistive-technology activation. No pointer. */
const NO_POINTER = 0;
/** A hand that did not move between opening the panel and this click. The whole defect. */
const STILL = 0;

describe('activationIsDeliberate', () => {
  it('refuses a still pointer that clicks while the panel is still sliding in', () => {
    // 0 and 16ms: the same tick and the next frame. 40 and 80ms: the gaps the defect was
    // reproduced at, at 1280x800. 180ms: `--otp-motion-slow`, the whole `otp-panel-in` slide.
    for (const age of [0, 16, 40, 80, 180])
      expect(
        activationIsDeliberate(DOUBLE, age, STILL),
        `a double-click ${age}ms after mount was taken as an answer`,
      ).toBe(false);
  });

  it('refuses it whatever the click count says, because the count is not the evidence', () => {
    // Measured: Chrome reported `detail: 1` for the second press of the reproduced double-click,
    // not 2, so a rule keyed off the count would have caught nothing at all.
    expect(activationIsDeliberate(SINGLE, 40, STILL)).toBe(false);
  });

  it('treats a tremor between the two presses as a still hand', () => {
    // Every platform allows a few pixels of slop inside a double-click; a hand resting on a mouse
    // is never perfectly still, and the defect reproduces just the same.
    for (const drift of [0.5, 2, 4])
      expect(
        activationIsDeliberate(SINGLE, 40, drift),
        `${drift}px of tremor was read as taking aim`,
      ).toBe(false);
  });

  it('honours a pointer that travelled to the pill, however fresh the panel is', () => {
    // 133px is the measured journey from "Show me the skill" to Restrict at 1280x800, which a
    // player can make in 46ms. A hand that moved that far has aimed at what it hit. 40px is a
    // short hop between two pills. Both are answers.
    for (const moved of [40, 133, 600])
      expect(
        activationIsDeliberate(SINGLE, 0, moved),
        `a click ${moved}px from where the card was opened was held back`,
      ).toBe(true);
  });

  it('honours a still pointer once the panel has been there long enough to read', () => {
    // 500ms is the interval every platform calls the outer edge of a double-click; past it a
    // second click is a second decision. The rest is a player who took their time.
    for (const age of [500, 1_200, 30_000])
      expect(
        activationIsDeliberate(SINGLE, age, STILL),
        `a click ${age}ms after mount was held back; the pills are not a timed lock`,
      ).toBe(true);
  });

  it('never holds back an activation that had no pointer behind it', () => {
    // The exemption, at the one age and distance where the pointer rule is strictest. Keyboard,
    // switch, voice control and `element.click()` all land here, and none of them can be the
    // stray second half of anything.
    for (const age of [0, 16, 180, 500])
      expect(
        activationIsDeliberate(NO_POINTER, age, STILL),
        `a keyboard or assistive activation ${age}ms after mount was swallowed`,
      ).toBe(true);
  });

  it('falls back to the age rule when no pointer has ever been seen', () => {
    // `pointerX`/`pointerY` start as NaN, so the distance is NaN until something moves. NaN fails
    // every comparison, which must mean "cannot say it moved" and not "it moved".
    expect(activationIsDeliberate(SINGLE, 40, Number.NaN)).toBe(false);
    expect(activationIsDeliberate(SINGLE, 900, Number.NaN)).toBe(true);
  });

  /*
   * A FINGER (the client's review, 2026-10-25, P1): on an upright phone Leave it opens where the A
   * button was, and a second tap 600ms or 1.2s after the first answered the card. A stationary
   * touch is held a full second; a moved finger, a keyboard and a mouse are not.
   */
  it('holds a stationary touch for the second after the panel opens', () => {
    for (const age of [80, 600, 900])
      expect(activationIsDeliberate(SINGLE, age, STILL, true), `touch at ${age}ms`).toBe(false);
    expect(activationIsDeliberate(SINGLE, 1500, STILL, true)).toBe(true);
  });

  it('never holds a finger that moved, a keyboard, or a mouse past its own window', () => {
    expect(activationIsDeliberate(SINGLE, 120, 60, true)).toBe(true);
    expect(activationIsDeliberate(NO_POINTER, 0, STILL, true)).toBe(true);
    expect(activationIsDeliberate(SINGLE, 600, STILL, false)).toBe(true);
  });
});
