import type { Input } from '../world/input';

/**
 * DOM joystick and A button (BRAND_AND_UI section 3). Pointer events only, so one finger on the
 * stick and another on A work at once. Skinning lands in Phase 3; the geometry is final.
 */
export interface TouchControls {
  readonly root: HTMLElement;
  setVisible(visible: boolean): void;
  destroy(): void;
}

const STICK_RADIUS = 36;

export function createTouchControls(input: Input): TouchControls {
  const root = document.createElement('div');
  root.className = 'otp-touch';

  const stick = document.createElement('div');
  stick.className = 'otp-stick';
  stick.setAttribute('role', 'application');
  stick.setAttribute('aria-label', 'Move Red');
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
  button.setAttribute('aria-label', 'Talk or interact');

  root.append(stick, button);

  let stickPointer: number | null = null;
  const reset = (): void => {
    stickPointer = null;
    knob.style.transform = '';
    input.setStick(0, 0);
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

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', onStickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  button.addEventListener('pointerdown', onButton);

  return {
    root,
    setVisible(visible) {
      root.hidden = !visible;
      if (!visible) reset();
    },
    destroy() {
      reset();
      root.remove();
    },
  };
}
