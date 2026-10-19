import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Character, Content, GameState } from '@otp/core';
import { NotationChip, Panel, useFocusTrap } from './components';
import { assetUrl } from '../world/assets';

/** Characters per second for the typewriter; skipped on click, key, or reduced motion. */
const TYPE_SPEED = 55;

/*
 * The card's three marks are drawn, for the reason SkillCard.tsx gives about its verdict glyphs,
 * now measured rather than asserted: `public/fonts/HafferUprightsVF.ttf` carries 789 codepoints and
 * U+25B6 BLACK RIGHT-POINTING TRIANGLE, U+2713 CHECK MARK and U+258C LEFT HALF BLOCK are not among
 * them. Every one of those was being typed into this card as text, so all three fell through to
 * whatever the next family in the stack is -- at its weight, at its size, on its baseline.
 *
 * It shows. Put `reference/mocks/gameplay-concepts.png` crop `1536 700 1536 324` beside the same
 * card from the running game: the board's selected row carries a small triangle sitting on the
 * label's optical centre, and ours carries a noticeably larger one riding high above it. The
 * selected row is the thing the board's Question frame does best, and the caret was the one mark on
 * it this project did not control.
 *
 * Sized in `em` so they track `.otp-option__tri`'s own font-size, and `currentColor` so the row's
 * selected and `--done` states keep colouring them.
 *
 * TWO THINGS THE FIRST DRAWING OF THIS GOT WRONG, both found by rendering it rather than by
 * reasoning about it, and both worth leaving written down because the next person will reach for
 * `width="1em"` and a 20-box path exactly as I did:
 *
 *  - `.otp-option__tri` sets its own font-size (15px against the label's 17px), so `1em` here is
 *    already a fifth smaller than the label it marks. The board's caret is about the label's cap
 *    height. Hence 1.15em, and a path that fills its box rather than floating inside it.
 *  - An inline SVG in an empty inline-block sits its BOTTOM on the baseline, so the first version
 *    hung below the label's centre as surely as the fallback glyph had ridden above it. `display:
 *    block` collapses the span to the glyph, and `.otp-option`'s own `align-items: center` then
 *    centres it. That is a layout declaration, not a colour one -- the stylesheets have another
 *    owner this round and this does not reach into them.
 */
const OptionCaret = () => (
  <svg
    viewBox="0 0 14 16"
    width="1.15em"
    height="1.15em"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block' }}
  >
    <path d="M1 1l12 7-12 7z" fill="currentColor" />
  </svg>
);

/** On a question already asked. Not an accessible name: `aria-disabled` on the row carries that. */
const AskedMark = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M4.5 10.5l4 4 7-8"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/** The typewriter's block, while the line is still arriving. */
const TypingCursor = () => (
  <svg viewBox="0 0 20 20" width="0.5em" height="1em" aria-hidden="true" focusable="false">
    <rect x="2" y="3" width="9" height="15" fill="currentColor" />
  </svg>
);

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
  /** Say yes from here, without ever opening the card. */
  onTakeAsOffered(): void;
}

export function Dialogue({
  content,
  character,
  state,
  onAsk,
  onInspect,
  onTakeAsOffered,
}: DialogueProps) {
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
              {!done && <TypingCursor />}
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
                      {index === cursor && <OptionCaret />}
                    </span>
                    {option.label}
                    {/* The space is the one the old ' ✓' string carried; JSX drops the whitespace
                        that spans this line break, so it is written out (as Results.tsx does). */}
                    {used && (
                      <>
                        {' '}
                        <AskedMark />
                      </>
                    )}
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
              {/*
                And the way past it. Deliberately the quietest thing on the screen: Ash, small, no
                arrow, no fill, after the show button in the tab order. UI_FOUNDATIONS section 2
                refuses Lime on Allow because the unsafe answer must never be the brightest thing
                here, and this is the same answer with less reading attached.
              */}
              <button
                type="button"
                class="otp-dialogue__trust"
                aria-describedby="otp-trust-hint"
                onClick={(e) => {
                  e.stopPropagation();
                  onTakeAsOffered();
                }}
              >
                {content.strings['takeAsOffered'] ?? 'Take it as offered'}
              </button>
              <span
                id="otp-trust-hint"
                class={state.inspected.length === 0 ? 'otp-dialogue__hint' : 'otp-visually-hidden'}
              >
                {content.strings['takeAsOfferedHint'] ?? ''}
              </span>
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
