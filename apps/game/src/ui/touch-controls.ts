import { TILE } from '../world/logic';
import { MOVE_KEYS } from '../world/input';
import type { Input } from '../world/input';

/**
 * DOM joystick and A button (BRAND_AND_UI section 3), plus the walk buttons that stand behind
 * them. The drag still runs on pointer events, so one finger on the stick and another on A work at
 * once; the buttons answer an activation, which is all a screen reader can send. Skinning lands in
 * Phase 3; the geometry is final.
 */
export interface TouchControls {
  readonly root: HTMLElement;
  /**
   * What the deck is for right now (see `DeckMode`). It replaced `setVisible`: the deck is the
   * cabinet's control panel and furniture holds still, so it is never taken away -- what changes is
   * which of its controls answer.
   */
  setMode(mode: DeckMode): void;
  destroy(): void;
}

/**
 * THE DECK'S TWO MODES, one per kind of screen.
 *
 *   play  the forest: the stick walks, A talks to whoever is within reach. A is that screen's one
 *         call to action, so it is the one that wears Lime.
 *   idle  everything else (title, how-to, an open offer, the cottage, the reveal, a problem
 *         screen): neither control answers, and A is Lilac, because on Title and Results the one
 *         Lime belongs to that screen's own call to action.
 *
 * There was a third, `talk`, in which A opened the card of the offer on screen. The card opens by
 * itself now (the client, 2026-10-22), so an open offer is idle like every other panel: what is
 * left to press there is an answer, and an answer is the player's, never a button mashed through.
 *
 * Written to `data-mode` on the deck, where screens.css reads it.
 */
export type DeckMode = 'play' | 'idle';

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
 * How far the knob leans when the player walks with the keys (the client, 2026-10-22: "if I click
 * right, I want the joystick to move right"). Purely a picture of the input -- the keys walk Purple
 * through world/input.ts whether or not the deck is drawn -- so it is a transform and nothing else.
 *
 * 24px keeps the 40px knob just inside the 96px well's 3px rim, where a drag may push it over the
 * edge: a key is a direction, not a distance. A reader who asked for less motion still sees which
 * way the stick points, at well under half the travel.
 */
export const KEY_TILT_PX = 24;
export const KEY_TILT_REDUCED_PX = 8;

/**
 * Which way the held walking keys point, as the knob should show it: each axis summed and clamped
 * the way world/input.ts reads them, then a diagonal brought back to the length of a straight
 * press, so a diagonal leans as far as an arrow does rather than root-two further.
 */
export function keyTilt(held: Iterable<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const code of held) {
    const v = MOVE_KEYS[code];
    if (!v) continue;
    x += v.x;
    y += v.y;
  }
  x = Math.max(-1, Math.min(1, x));
  y = Math.max(-1, Math.min(1, y));
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/**
 * The scene saying someone has come within reach. Declared in `world/forest-scene.ts`; the walk
 * buttons below stop Purple when it arrives, so she is never walked past the person she was looking
 * for. See the note on it there for why it is a DOM event and not the typed bus.
 */
const WITHIN_REACH = 'otp:within-reach';

/**
 * How far one press of a walk button carries Purple: four tiles, which is about a second of walking.
 *
 * Derived from the two real constants rather than written as a millisecond count, so the next
 * change to WALK_SPEED cannot silently turn a four-tile step into a two-tile one. Four because it
 * is far enough to cross the forest in a reasonable number of presses and short enough that a
 * press is never a commitment: she also stops the instant anyone comes within reach, and the Stop
 * button is there for the rest.
 */
export const STEP_TILES = 4;
/** One press's carry in game pixels. A distance, owed to `Input.walkFor`, never a duration. */
export const STEP_PX = TILE * STEP_TILES;

/**
 * A press on the stick shorter than this is a CLICK, and a click walks one step the way it
 * pointed; held longer, the stick is a stick and walks for as long as it is held. "Click or hold
 * the joystick to walk" (the client). Long enough for a deliberate tap, short enough that a thumb
 * resting on the stick is plainly a hold. Measured against WALK_SPEED it is under a tile of walking,
 * so a hold that is let go just past it has not already gone further than the click would have.
 */
export const CLICK_MS = 250;

/** Below this share of the stick's radius a press points nowhere, so a resting thumb is still. */
const DEAD_ZONE = 0.2;

/** The quarter a press points into, or null inside the dead zone: one of the four walk vectors. */
export function stepFor(nx: number, ny: number): { x: number; y: number } | null {
  if (Math.hypot(nx, ny) < DEAD_ZONE) return null;
  return Math.abs(nx) >= Math.abs(ny) ? { x: Math.sign(nx), y: 0 } : { x: 0, y: Math.sign(ny) };
}

/**
 * The four directions, as real buttons.
 *
 * The joystick derives its vector from how far the pointer sits from the stick's centre, so ANY
 * point activation -- a real `touchscreen.tap`, or the single synthesised activation a screen
 * reader sends -- yields (0, 0) and moves Purple exactly 0px (docs/UX_REVIEW.md 16, measured). The
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

/**
 * Whether this key is the one a focused button is about to be activated BY.
 *
 * Space and Enter, and deliberately nothing else. `test/touch-pad.test.ts` is built on what is
 * NOT in here: the arrows and Escape have to keep travelling, because walking away from a focused
 * walk button must still walk and Escape must still close a panel, and a guard that swallowed
 * them would trade one dead control for four.
 *
 * `e.key`, not `e.code`, because what matters is the character the activation is keyed to and not
 * where it sits on the board. `ui/components.tsx` makes the same test inline for the music toggle
 * against the same window listener; it is spelled out here because this file needs it on five
 * controls and because the keys that belong in it are the thing a reader will want to check.
 */
export function activationKey(key: string): boolean {
  return key === ' ' || key === 'Enter';
}

export function createTouchControls(input: Input, labels: TouchLabels): TouchControls {
  const root = document.createElement('div');
  root.className = 'otp-touch';

  const stick = document.createElement('div');
  stick.className = 'otp-stick';
  /*
   * Hidden from assistive technology, because to assistive technology it is not a control: a
   * `role="application"` div whose vector comes from pointer offset answers an activation with
   * (0, 0). It was the only thing in the pad that claimed to move Purple, and it is the one thing
   * that cannot. The buttons below are what is exposed; the drag is for thumbs.
   */
  stick.setAttribute('aria-hidden', 'true');
  // Haze direction arrows, as in the mock's joystick. Drawn in CSS (tokens.css), never typed:
  // iOS turns the left and right triangle characters into colour emoji.
  for (const direction of ['up', 'down', 'left', 'right'] as const) {
    const arrow = document.createElement('span');
    arrow.className = `otp-stick-arrow otp-stick-arrow--${direction}`;
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
   * Visually hidden UNTIL A KEYBOARD REACHES THEM, not hidden outright. `ui/tokens.css` draws this
   * group as a row of pills on `:focus-within` -- the skip-link pattern -- so a sighted player
   * tabbing through finds five controls with focus rings rather than five invisible ones. The note
   * that stood here called that remedy "a dozen lines in tokens.css and not this file's to write";
   * those lines are written, and this paragraph is what is left of the finding.
   *
   * And on a fine pointer the pad is NOT `display: none`. That sentence was true of an older
   * tokens.css and it is most of the reason these five went so long without a keyboard path: while
   * it held, nothing in the document could be focused, so nothing was ever pressed by a key and
   * the dead activation below could not be noticed. The rule there now hides only the two THUMB
   * controls, `.otp-stick` and `.otp-a-button`, and leaves this group in the document on every
   * pointer, because on a desktop it is the only thing a player without sight has to walk with --
   * the arrow keys appear in no accessible tree. Which is exactly why the keydown guard below has
   * to exist: being reachable and being operable turned out to be different questions.
   */
  const pad = document.createElement('div');
  pad.className = 'otp-visually-hidden';
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', labels.walkGroup);

  root.append(pad, stick, button);
  root.dataset['mode'] = 'idle';
  pad.hidden = true;
  button.disabled = true;

  let stickPointer: number | null = null;
  /** When the stick was pressed, and which way it last pointed: a short press is a click. */
  let pressedAt = 0;
  let pointed = { x: 0, y: 0 };
  let mode: DeckMode = 'idle';

  const stopWalking = (): void => {
    input.setStick(0, 0);
  };

  /**
   * One press, one step: four tiles in that direction, and then she stops by herself.
   *
   * A screen reader delivers a single activation, never a hold, so a control that only answers a
   * held pointer is inert to it. This answers the activation with a bounded walk instead -- long
   * enough to get somewhere, short enough that nothing runs away -- and a second press in any
   * direction replaces the first rather than queueing behind it. The walk is owed as DISTANCE
   * (`Input.walkFor`), so a slow frame rate makes it slower and never shorter.
   */
  const stepWalk = (x: number, y: number): void => {
    if (mode !== 'play') return;
    input.walkFor(x, y, STEP_PX);
  };

  /**
   * Space and Enter, kept inside the button that was pressed.
   *
   * These five controls exist so the forest can be walked without a pointer, and until this
   * listener they could not be operated by the only input that can reach them. `world/input.ts`
   * takes `keydown` on the WINDOW and calls `preventDefault` on Space and Enter whenever the world
   * owns input -- which on Explore it always does. A button's activation is a DEFAULT ACTION, so
   * cancelling it up there cancels it down here: measured at 1280x800, every one of the five, both
   * keys, 0 `click` events and Purple moved 0.0px, while a pointer click on the same button moved her
   * 78px. Ten dead presses and one live one.
   *
   * The remedy is the one `MusicToggle` already carries against the same window listener: stop the
   * keys the button is activated BY from propagating, so the window never sees them and the
   * browser's own activation survives untouched. Nothing is cancelled here -- the button still
   * does what a button does -- and nothing else is held back. Everything that is not an activation
   * key keeps bubbling, so the arrows still walk away from a focused control and Escape still
   * closes a panel.
   */
  const keepActivationLocal = (e: KeyboardEvent): void => {
    if (activationKey(e.key)) e.stopPropagation();
  };

  for (const { key, x, y } of DIRECTIONS) {
    const walk = document.createElement('button');
    walk.type = 'button';
    walk.textContent = labels[key];
    walk.addEventListener('click', () => stepWalk(x, y));
    walk.addEventListener('keydown', keepActivationLocal);
    pad.append(walk);
  }
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.textContent = labels.stop;
  stop.addEventListener('click', stopWalking);
  stop.addEventListener('keydown', keepActivationLocal);
  pad.append(stop);

  /** Purple stops the moment she reaches someone, rather than walking straight past them. */
  const onWithinReach = (event: Event): void => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    const id =
      typeof detail === 'object' && detail !== null && 'id' in detail
        ? (detail as { id: unknown }).id
        : null;
    if (input.carrying() && typeof id === 'string') stopWalking();
  };
  window.addEventListener(WITHIN_REACH, onWithinReach);

  /*
   * THE STICK FOLLOWS THE KEYS. The walking keys held right now, by code, watched on the window
   * beside world/input.ts's own listener and never cancelled here: this only draws what that one
   * acts on. A thumb on the stick outranks the keys, so the knob never shows two inputs at once.
   */
  const keys = new Set<string>();
  const reducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const showKeys = (): void => {
    if (stickPointer !== null) return;
    const { x, y } = mode === 'play' ? keyTilt(keys) : { x: 0, y: 0 };
    const reach = reducedMotion?.matches ? KEY_TILT_REDUCED_PX : KEY_TILT_PX;
    knob.style.transform = x === 0 && y === 0 ? '' : `translate(${x * reach}px, ${y * reach}px)`;
    knob.dataset['keys'] = x === 0 && y === 0 ? '' : `${Math.sign(x)},${Math.sign(y)}`;
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!MOVE_KEYS[e.code] || keys.has(e.code)) return;
    keys.add(e.code);
    showKeys();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (keys.delete(e.code)) showKeys();
  };
  const onBlur = (): void => {
    keys.clear();
    showKeys();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const reset = (): void => {
    stickPointer = null;
    pointed = { x: 0, y: 0 };
    knob.style.transform = '';
    knob.dataset['keys'] = '';
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
    pointed = { x: nx, y: ny };
    // A small dead zone stops a resting thumb from nudging Purple.
    input.setStick(Math.abs(nx) < DEAD_ZONE ? 0 : nx, Math.abs(ny) < DEAD_ZONE ? 0 : ny);
  };

  const onStickDown = (e: PointerEvent): void => {
    if (stickPointer !== null || mode !== 'play') return;
    // A thumb on the stick takes the stick back from a walk button mid-step (setStick ends a carry).
    stickPointer = e.pointerId;
    pressedAt = e.timeStamp;
    stick.setPointerCapture(e.pointerId);
    moveKnob(e);
    e.preventDefault();
  };
  const onStickMove = (e: PointerEvent): void => {
    if (e.pointerId === stickPointer) moveKnob(e);
  };
  const onStickUp = (e: PointerEvent): void => {
    if (e.pointerId !== stickPointer) return;
    const click = e.type === 'pointerup' && e.timeStamp - pressedAt < CLICK_MS;
    const step = click ? stepFor(pointed.x, pointed.y) : null;
    reset();
    // Keys still held when the thumb lets go: the knob goes back to showing them.
    showKeys();
    // A click on an arrow walks a step that way: the mouse's way to walk, and a tap's.
    if (step) stepWalk(step.x, step.y);
  };
  const onButton = (e: PointerEvent): void => {
    e.preventDefault();
    press();
  };

  /** A, whichever way it was pressed: talk in the forest, else nothing. */
  const press = (): void => {
    if (mode === 'play') input.pressInteract();
  };

  /**
   * The ghost of the same press, which must not arrive at all. This handler presses nothing: its
   * whole job is to cancel a gesture's default action.
   *
   * Chromium synthesises a compatibility mouse `click` from a single-touch gesture, and by the
   * time it is dispatched this pad is gone: `main.ts` hides the whole thing the moment the phase
   * leaves explore, so the click has no A button under it any more and retargets onto whatever the
   * panel that replaced the pad put in that place.
   *
   * MEASURED, because the shape of the consequence is not what it looks like. The click is real: a
   * trusted click, `detail` 1, landing on `.otp-dialogue__foot` at 375x812, 360x800 and 390x844.
   * It lands on no CONTROL -- 576 combinations of viewport width, viewport height, character and
   * question state were swept and the A button's centre is over an actionable control in none of
   * them -- so it presses no button and costs no points. What it does instead is bubble: the
   * dialogue's modal layer answers a click anywhere inside it by fast-forwarding the line being
   * typed, so this never needed to hit a control to do something. One tap of A, eighteen taps out
   * of eighteen, found the greeting ALREADY COMPLETE 120ms after the panel opened; the same
   * interact sent from the keyboard found it still typing, twelve times out of twelve. The
   * typewriter the design spends a beat on did not play on the device most people hold.
   *
   * IT IS A TOUCH EVENT THAT CANCELS IT, AND NOT A POINTER ONE. Both of the obvious places were
   * tried and both were measured, because the sequence is not what it reads like:
   *
   *   - `pointerdown` was already cancelled, a dozen lines up, through every measurement above.
   *     Cancelling it suppresses the compatibility `mousedown`; the click comes anyway.
   *   - `pointerup` was tried next and makes no difference either. It is not that the handler is
   *     missed -- a touch pointer is implicitly captured, so `pointerup` lands on this button at
   *     182ms even though the pad went `hidden` at about 50ms, and the handler runs. The click
   *     still arrived 1-2ms later, on `.otp-dialogue__foot`, in every trial.
   *
   * Chromium generates this click from the TOUCH sequence, so `touchend` is the event that has a
   * default action to cancel. With this one listener the click is not dispatched at all: the trace
   * ends at `pointerup`, and the greeting types out on a phone exactly as it does from the
   * keyboard (0 of 18 fast-forwarded, against 18 of 18 before).
   *
   * The `detail === 0` path below is untouched, and that is the point of cancelling the gesture
   * rather than filtering the click: an activation with no pointer behind it is preceded by no
   * `touchend`, so there is nothing in this handler for a screen reader, a switch or
   * `element.click()` to trip over. Measured after the change, at 390x844: one tap is one press at
   * holds of 8, 40 and 120ms; `element.click()` is one press; and a second finger tapping A while
   * the first rests on the stick -- the two-handed grip this pad is laid out for, and the one
   * gesture Chromium sends no click for at all -- is still one press.
   */
  const onButtonUp = (e: Event): void => void e.preventDefault();

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
    press();
  };

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', onStickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  button.addEventListener('pointerdown', onButton);
  button.addEventListener('touchend', onButtonUp);
  button.addEventListener('click', onButtonClick);

  return {
    root,
    setMode(next) {
      if (next === mode) return;
      mode = next;
      root.dataset['mode'] = next;
      // The walk buttons are for walking: out of the tab order and the tree when nothing walks.
      pad.hidden = next !== 'play';
      // Nothing to press on an idle screen, so nothing that claims to be pressable.
      button.disabled = next === 'idle';
      if (next !== 'play') {
        // A key held into an offer is not still being walked on when the offer closes.
        keys.clear();
        reset();
      }
    },
    destroy() {
      reset();
      window.removeEventListener(WITHIN_REACH, onWithinReach);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      root.remove();
    },
  };
}
