/** Unified input, fed by the keyboard and the DOM touch controls. */
export interface InputState {
  /** -1, 0 or 1 on each axis before normalisation. */
  x: number;
  y: number;
  /** True on the frame the interact button went down. */
  interactPressed: boolean;
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
  /** Touch controls push their stick vector here; x and y are each in [-1, 1]. */
  setStick(x: number, y: number): void;
  pressInteract(): void;
  destroy(): void;
}

export function createInput(target: Window, options: InputOptions = {}): Input {
  const held = new Set<string>();
  let interactPressed = false;
  let stick = { x: 0, y: 0 };

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
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    read(): InputState {
      let x = stick.x;
      let y = stick.y;
      for (const code of held) {
        const v = MOVE_KEYS[code]!;
        x += v.x;
        y += v.y;
      }
      const state: InputState = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
        interactPressed,
      };
      interactPressed = false;
      return state;
    },
    setStick(x, y) {
      stick = { x, y };
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
