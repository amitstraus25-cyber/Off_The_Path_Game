import { TILE, WALK_SPEED } from '../world/logic';
import type { Input } from '../world/input';

/**
 * DOM joystick and A button (BRAND_AND_UI section 3), plus the walk buttons that stand behind
 * them. The drag still runs on pointer events, so one finger on the stick and another on A work at
 * once; the buttons answer an activation, which is all a screen reader can send. Skinning lands in
 * Phase 3; the geometry is final.
 */
export interface TouchControls {
  readonly root: HTMLElement;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/**
 * Every word the pad says, from `content.strings` (CLAUDE.md rule 3).
 *
 * These were English literals in this file until the content keys landed, for want of a channel:
 * nothing handed `content` to the touch controls, because until there were buttons in here the pad
 * had no accessible names worth the plumbing. It has six now, and an accessible name is the only
 * thing a screen-reader player has to go on, so it is copy like any other and belongs in the file
 * research signs off.
 *
 * `main.ts` builds this from the shipped strings; `test/strings.test.ts` fails the build if any of
 * those keys goes missing, and `e2e/world-reach.spec.ts` finds all six controls by the name the
 * content file gives them, so an empty string here fails there rather than shipping a nameless
 * button.
 */
export interface TouchLabels {
  /** Accessible name of the group the walk buttons sit in. */
  readonly walkGroup: string;
  readonly up: string;
  readonly down: string;
  readonly left: string;
  readonly right: string;
  readonly stop: string;
  /** Accessible name of the A button. */
  readonly interact: string;
}

const STICK_RADIUS = 36;

/**
 * The scene saying someone has come within reach. Declared in `world/forest-scene.ts`; the walk
 * buttons below stop Red when it arrives, so she is never walked past the person she was looking
 * for. See the note on it there for why it is a DOM event and not the typed bus.
 */
const WITHIN_REACH = 'otp:within-reach';

/**
 * How far one press of a walk button carries Red: four tiles, which is about a second of walking.
 *
 * Derived from the two real constants rather than written as a millisecond count, so the next
 * change to WALK_SPEED cannot silently turn a four-tile step into a two-tile one. Four because it
 * is far enough to cross the forest in a reasonable number of presses and short enough that a
 * press is never a commitment: she also stops the instant anyone comes within reach, and the Stop
 * button is there for the rest.
 */
const STEP_TILES = 4;
const STEP_MS = Math.round((TILE * STEP_TILES * 1000) / WALK_SPEED);

/**
 * The four directions, as real buttons.
 *
 * The joystick derives its vector from how far the pointer sits from the stick's centre, so ANY
 * point activation -- a real `touchscreen.tap`, or the single synthesised activation a screen
 * reader sends -- yields (0, 0) and moves Red exactly 0px (docs/UX_REVIEW.md 16, measured). The
 * drag is a fine control for a thumb and no control at all for anything else, so it keeps the
 * stick and these keep the game playable.
 *
 * Their names come from `content.strings` through `TouchLabels`, like every other player-facing
 * word in the game; the vector is the only thing this table still holds.
 */
const DIRECTIONS: readonly { key: keyof TouchLabels; x: number; y: number }[] = [
  { key: 'up', x: 0, y: -1 },
  { key: 'down', x: 0, y: 1 },
  { key: 'left', x: -1, y: 0 },
  { key: 'right', x: 1, y: 0 },
];

export function createTouchControls(input: Input, labels: TouchLabels): TouchControls {
  const root = document.createElement('div');
  root.className = 'otp-touch';

  const stick = document.createElement('div');
  stick.className = 'otp-stick';
  /*
   * Hidden from assistive technology, because to assistive technology it is not a control: a
   * `role="application"` div whose vector comes from pointer offset answers an activation with
   * (0, 0). It was the only thing in the pad that claimed to move Red, and it is the one thing
   * that cannot. The buttons below are what is exposed; the drag is for thumbs.
   */
  stick.setAttribute('aria-hidden', 'true');
  // Haze direction arrows, as in the mock's joystick.
  for (const [direction, glyph] of [
    ['up', '▲'],
    ['down', '▼'],
    ['left', '◀'],
    ['right', '▶'],
  ] as const) {
    const arrow = document.createElement('span');
    arrow.className = `otp-stick-arrow otp-stick-arrow--${direction}`;
    arrow.textContent = glyph;
    arrow.setAttribute('aria-hidden', 'true');
    stick.append(arrow);
  }

  const knob = document.createElement('div');
  knob.className = 'otp-stick-knob';
  stick.append(knob);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'otp-a-button';
  button.textContent = 'A';
  button.setAttribute('aria-label', labels.interact);

  /*
   * The walk controls. First in the DOM, so they are read before the button that acts on what they
   * reach, and out of flow -- `.otp-visually-hidden` is absolutely positioned -- so the stick and
   * the A button keep the pad's layout exactly as the mock has it.
   *
   * Visually hidden rather than drawn, because drawing them means four 44px boxes in the pad and
   * the styling for them lives in `ui/tokens.css`, which this change does not own. On a fine
   * pointer the whole pad is `display: none` and the arrow keys are the answer instead, so no
   * desktop player can tab into something invisible. What is left is a tablet with a keyboard,
   * where a sighted player tabbing through would find five controls with no focus ring: the
   * remedy is to draw them, which is a dozen lines in tokens.css and not this file's to write.
   */
  const pad = document.createElement('div');
  pad.className = 'otp-visually-hidden';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', labels.walkGroup);

  root.append(pad, stick, button);

  let stickPointer: number | null = null;
  /** Running while a pressed walk button is still carrying Red. */
  let walkTimer: ReturnType<typeof setTimeout> | undefined;

  const stopWalking = (): void => {
    clearTimeout(walkTimer);
    walkTimer = undefined;
    input.setStick(0, 0);
  };

  /**
   * One press, one step: hold the stick in a direction for as long as four tiles takes.
   *
   * A screen reader delivers a single activation, never a hold, so a control that only answers a
   * held pointer is inert to it. This answers the activation with a bounded walk instead -- long
   * enough to get somewhere, short enough that nothing runs away -- and a second press in any
   * direction replaces the first rather than queueing behind it.
   */
  const stepWalk = (x: number, y: number): void => {
    clearTimeout(walkTimer);
    input.setStick(x, y);
    walkTimer = setTimeout(stopWalking, STEP_MS);
  };

  for (const { key, x, y } of DIRECTIONS) {
    const walk = document.createElement('button');
    walk.type = 'button';
    walk.textContent = labels[key];
    walk.addEventListener('click', () => stepWalk(x, y));
    pad.append(walk);
  }
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = labels.stop;
  stop.addEventListener('click', stopWalking);
  pad.append(stop);

  /** Red stops the moment she reaches someone, rather than walking straight past them. */
  const onWithinReach = (event: Event): void => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    const id =
      typeof detail === 'object' && detail !== null && 'id' in detail
        ? (detail as { id: unknown }).id
        : null;
    if (walkTimer !== undefined && typeof id === 'string') stopWalking();
  };
  window.addEventListener(WITHIN_REACH, onWithinReach);

  const reset = (): void => {
    stickPointer = null;
    knob.style.transform = '';
    stopWalking();
  };
  const moveKnob = (e: PointerEvent): void => {
    const box = stick.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(distance, STICK_RADIUS);
    const nx = (dx / distance) * (clamped / STICK_RADIUS);
    const ny = (dy / distance) * (clamped / STICK_RADIUS);
    knob.style.transform = `translate(${nx * STICK_RADIUS}px, ${ny * STICK_RADIUS}px)`;
    // A small dead zone stops a resting thumb from nudging Red.
    input.setStick(Math.abs(nx) < 0.2 ? 0 : nx, Math.abs(ny) < 0.2 ? 0 : ny);
  };

  const onStickDown = (e: PointerEvent): void => {
    if (stickPointer !== null) return;
    // A thumb on the stick takes the stick back from a walk button mid-step.
    clearTimeout(walkTimer);
    walkTimer = undefined;
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveKnob(e);
    e.preventDefault();
  };
  const onStickMove = (e: PointerEvent): void => {
    if (e.pointerId === stickPointer) moveKnob(e);
  };
  const onStickUp = (e: PointerEvent): void => {
    if (e.pointerId === stickPointer) reset();
  };
  const onButton = (e: PointerEvent): void => {
    input.pressInteract();
    e.preventDefault();
  };

  /**
   * The same press, arriving a second time.
   *
   * `pointerdown` above answers a thumb; this answers an activation with no pointer behind it,
   * which is all a screen reader can send and the only notice this button gets from one.
   *
   * BOTH have to stay, and that is measured, not assumed: with one finger already down on the
   * stick, a second finger's tap on A raises `pointerdown` and `pointerup` on the button and NO
   * `click` whatever -- Chromium synthesises no compatibility mouse event once a gesture is
   * multi-touch. Dropping `pointerdown` would therefore make A dead in exactly the two-handed grip
   * this pad is laid out for, which is why the obvious one-line fix is the wrong one.
   *
   * What they must not do is both answer the SAME press. A tap is a hold: `pointerdown` lands at
   * touch-down, `click` at touch-up, and at 120ms apart those are different frames, so the scene's
   * `read()` consumes two separate presses and the player gets two interacts from one tap. Measured
   * on this build with a 120ms tap on the A button beside the Toadstool: three taps, six
   * `greetBystander` events, and because each greeting overwrites the last before a frame is drawn,
   * the lines the player could actually read were his 2nd, 1st and 3rd -- the first thing anyone is
   * told by anyone in this forest was never readable. The same counter, two steps per tap, puts a
   * four-line part permanently on its 2nd and 4th: the Snail's 1st and 3rd lines were unreachable
   * on a phone. That one is arithmetic off the measured step of two, not a second measurement.
   *
   * `detail` is what separates them, and it is the one thing on the event that says which kind of
   * press this is rather than which device sent it: it is the click COUNT, so a click synthesised
   * from a pointer gesture carries 1 (measured: `detail` 1, `pointerType` "touch") and an
   * activation with no pointer position to count carries 0 (measured: `detail` 0, `pointerType`
   * ""). Keyboard Enter and Space never reach here at all -- `world/input.ts` takes them on the
   * window and calls `preventDefault`, so the button is never activated -- which is why this cannot
   * be narrowed to "trusted events only": the untrusted, detail-0 click is exactly the one that
   * must press.
   *
   * `e2e/game.spec.ts` holds the guard, as a player sees it: one tap, one line, three taps, the
   * three lines in the order they were written.
   */
  const onButtonClick = (e: MouseEvent): void => {
    if (e.detail !== 0) return;
    input.pressInteract();
  };

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', onStickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  button.addEventListener('pointerdown', onButton);
  button.addEventListener('click', onButtonClick);

  return {
    root,
    setVisible(visible) {
      root.hidden = !visible;
      if (!visible) reset();
    },
    destroy() {
      reset();
      window.removeEventListener(WITHIN_REACH, onWithinReach);
      root.remove();
    },
  };
}
