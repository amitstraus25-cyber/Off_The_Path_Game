import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Character, Content, GameState } from '@otp/core';
import { NotationChip, Panel, useFocusTrap } from './components';
import { assetUrl } from '../world/assets';

/** Characters per second for the typewriter; skipped on click, key, or reduced motion. */
const TYPE_SPEED = 55;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function useTypedText(text: string): { shown: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(0);
  const frame = useRef(0);
  const instant = prefersReducedMotion();

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const started = performance.now();
    const tick = (): void => {
      const elapsed = (performance.now() - started) / 1000;
      const next = Math.min(text.length, Math.floor(elapsed * TYPE_SPEED));
      // Monotonic. skip() used to set the count to the full length and the very next frame
      // overwrote it with an elapsed-time value, so the line snapped back and carried on typing:
      // in practice the typewriter could not be skipped at all.
      setCount((c) => (c >= text.length ? c : Math.max(c, next)));
      if (next < text.length) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [text, instant]);

  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    skip: () => {
      cancelAnimationFrame(frame.current);
      setCount(text.length);
    },
  };
}

export interface DialogueProps {
  content: Content;
  character: Character;
  state: GameState;
  onAsk(questionId: string): void;
  onInspect(): void;
}

export function Dialogue({ content, character, state, onAsk, onInspect }: DialogueProps) {
  const asked = state.asked[character.id] ?? [];
  // The reply to the last question replaces the greeting, as in the mock.
  const [lastAsked, setLastAsked] = useState<string | null>(null);
  const line = useMemo(() => {
    const reply = character.asks.find((a) => a.id === lastAsked)?.reply;
    return reply ?? character.greet;
  }, [character, lastAsked]);

  const { shown, done, skip } = useTypedText(line);
  // `cursor` only ever follows focus; the keyboard handler moves focus and focus updates cursor.
  // Keeping one source of truth avoids a stale index when two keys arrive in the same frame.
  const [cursor, setCursor] = useState(0);
  const trapRef = useFocusTrap();

  // "show" is an action, not a question: the options list is the real questions only.
  const questions = character.asks.filter((a) => a.id !== 'show');
  const questionsLeft = questions.filter((q) => !asked.includes(q.id)).length;

  const choose = (index: number): void => {
    // While the line is still typing, any activation means "show me the rest", never "ask this".
    if (!done) {
      skip();
      return;
    }
    const option = questions[index];
    if (!option || asked.includes(option.id)) return;
    setLastAsked(option.id);
    onAsk(option.id);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    /*
     * Space is the key the Title screen teaches ("Space to talk"). Pressing it again, which is
     * the universal advance-text gesture, used to activate whichever option had focus — so the
     * second press of the key the player was just taught answered question one, unread.
     */
    if (!done && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      skip();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.otp-option'),
    );
    if (buttons.length === 0) return;
    const from = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    // Focus starts on the line rather than on an option, so the first Down must land on the
    // first option and the first Up on the last — not step past them.
    const next =
      from === -1
        ? step === 1
          ? 0
          : buttons.length - 1
        : (from + step + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Talking to ${character.name}`}
      onKeyDown={onKeyDown}
      onClick={() => !done && skip()}
    >
      <Panel
        number="02"
        title="Question"
        aside={<NotationChip label={content.strings['askingFree'] ?? 'Asking costs nothing'} />}
      >
        <div class="otp-dialogue">
          <div
            class="otp-portrait"
            style={{ backgroundImage: `url("${assetUrl(`${character.portrait}.png`)}")` }}
            role="img"
            aria-label={character.name}
          />
          {/*
            Focus lands here, not on an option: the trap focuses its first focusable, which used
            to be question one, putting a committing control under the player's thumb before they
            had read the line.
          */}
          <div class="otp-dialogue__text" tabIndex={-1} data-autofocus>
            {/* Speaker-name eyebrow, as in the deck. */}
            <p class="otp-dialogue__speaker">{character.name}</p>
            <p class="otp-dialogue__line">
              <span aria-hidden="true">{shown}</span>
              {!done && <span aria-hidden="true">▌</span>}
              {/* Screen readers get the whole line once, not a character at a time. */}
              <span class="otp-visually-hidden" aria-live="polite">
                {done ? line : ''}
              </span>
            </p>
            <div class="otp-options" role="listbox" aria-label={`Ask ${character.name}`}>
              {questions.map((option, index) => {
                const used = asked.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    class={`otp-option${used ? ' otp-option--done' : ''}`}
                    role="option"
                    aria-selected={index === cursor}
                    aria-disabled={used}
                    onFocus={() => setCursor(index)}
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(index);
                    }}
                  >
                    <span class="otp-option__tri" aria-hidden="true">
                      {index === cursor ? '▶' : ''}
                    </span>
                    {option.label}
                    {used ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>

            {/*
              "Show me the skill" is its own action below a hairline, not a third question:
              inspecting is the thing the game wants you to do, and asking is optional.
            */}
            <div class="otp-dialogue__foot">
              <button
                type="button"
                class="otp-dialogue__show"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect();
                }}
              >
                {content.strings['showSkill'] ?? 'Show me the skill'}{' '}
                <span aria-hidden="true">→</span>
              </button>
              <span class="otp-dialogue__left">
                {questionsLeft === 1 ? '1 question left' : `${questionsLeft} questions left`}
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
