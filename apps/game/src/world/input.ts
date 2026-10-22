/** Unified input, fed by the keyboard and the DOM touch controls. */
export interface InputState {
  /** -1, 0 or 1 on each axis before normalisation. */
  x: number;
  y: number;
  /** True on the frame the interact button went down. */
  interactPressed: boolean;
  /**
   * Game pixels still owed to a bounded walk (`Input.walkFor`), or null when none is running. The
   * scene may move at most this far this frame and must report what it spent (`Input.spend`).
   */
  carry: number | null;
}

const MOVE_KEYS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
};
const INTERACT_KEYS = new Set(['Space', 'Enter', 'KeyE']);
const BACK_KEYS = new Set(['Escape']);

export interface InputOptions {
  /** Called when the player asks to close a panel (Esc). */
  onBack?: () => void;
  /**
   * True while the world owns the keyboard. When a DOM panel is open this must return false, or
   * the Space/Enter preventDefault below would cancel activation of the panel's own buttons.
   */
  isActive?: () => boolean;
}

export interface Input {
  /** Reads and clears the one-frame flags. */
  read(): InputState;
  /** Touch controls push their stick vector here; x and y are each in [-1, 1]. Ends any carry. */
  setStick(x: number, y: number): void;
  /**
   * One press, one step: walk this way for `distance` game pixels and then stop by itself.
   *
   * A DISTANCE, NOT A DURATION. This was a timer in ui/touch-controls.ts that held the stick for as
   * long as four tiles takes at WALK_SPEED, which is four tiles only at the frame rate the sum was
   * done for. Phaser clamps each frame's delta, so a phone that cannot keep up -- or a starved CI
   * runner -- covers less ground per real second than the timer assumed and the press fell short:
   * 34px of 128 on CI, 81px on a loaded laptop. Owed as distance, the scene walks it off at
   * whatever rate it manages, and every press carries the same four tiles on every device.
   */
  walkFor(x: number, y: number, distance: number): void;
  /** The scene reports the ground a frame covered against the carry (attempted, not achieved). */
  spend(distance: number): void;
  /** Whether a bounded walk is still running. */
  carrying(): boolean;
  pressInteract(): void;
  destroy(): void;
}

export function createInput(target: Window, options: InputOptions = {}): Input {
  const held = new Set<string>();
  let interactPressed = false;
  let stick = { x: 0, y: 0 };
  /** The bounded walk: its direction, and the game pixels still owed. */
  let carry: { x: number; y: number; left: number } | null = null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (BACK_KEYS.has(e.code)) {
      options.onBack?.();
      return;
    }
    if (options.isActive?.() === false) {
      held.clear();
      return;
    }
    if (MOVE_KEYS[e.code]) {
      held.add(e.code);
      e.preventDefault();
    } else if (INTERACT_KEYS.has(e.code)) {
      interactPressed = true;
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => void held.delete(e.code);
  // A lost focus must not leave Purple walking into a tree forever.
  const onBlur = (): void => {
    held.clear();
    stick = { x: 0, y: 0 };
    carry = null;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    read(): InputState {
      let x = carry ? carry.x : stick.x;
      let y = carry ? carry.y : stick.y;
      for (const code of held) {
        const v = MOVE_KEYS[code]!;
        x += v.x;
        y += v.y;
      }
      const state: InputState = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
        interactPressed,
        carry: carry ? carry.left : null,
      };
      interactPressed = false;
      return state;
    },
    setStick(x, y) {
      carry = null;
      stick = { x, y };
    },
    walkFor(x, y, distance) {
      stick = { x: 0, y: 0 };
      carry = distance > 0 ? { x, y, left: distance } : null;
    },
    spend(distance) {
      if (!carry) return;
      carry.left -= distance;
      if (carry.left <= 0) carry = null;
    },
    carrying() {
      return carry !== null;
    },
    pressInteract() {
      interactPressed = true;
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
