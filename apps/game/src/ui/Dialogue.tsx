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
    class="otp-option__caret"
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

  // "show" is an action, not a question: the options list is the real questions only.
  const questions = character.asks.filter((a) => a.id !== 'show');
  const questionsLeft = questions.filter((q) => !asked.includes(q.id)).length;

  /*
   * Every line this character can put in that paragraph, so the paragraph can be as tall as the
   * tallest of them from the first frame.
   *
   * `.otp-dialogue__linebox` stacks these in one grid cell with the paragraph and hides them, which
   * is what stops the panel growing when a reply replaces the greeting and dragging the sentence
   * being read up by 11px on a desktop and 15px on a phone. The note on that rule in ui/panels.css
   * has the measurements and why this is not a min-height.
   *
   * The greeting and the replies to the REAL questions only -- `show` is filtered out here exactly
   * as it is from the options list, because it is an action whose reply the reducer has no case for
   * and which therefore never reaches this paragraph. Reserving height for a line that cannot be
   * said would make the panel taller than the game ever needs it to be.
   */
  const candidates = useMemo(
    () =>
      [
        { id: 'greet', text: character.greet },
        ...character.asks.filter((a) => a.id !== 'show').map((a) => ({ id: a.id, text: a.reply })),
      ].filter((c) => Boolean(c.text)),
    [character],
  );

  const { shown, done, skip } = useTypedText(line);
  // `cursor` only ever follows focus; the keyboard handler moves focus and focus updates cursor.
  // Keeping one source of truth avoids a stale index when two keys arrive in the same frame.
  const [cursor, setCursor] = useState(0);
  const trapRef = useFocusTrap();

  /*
   * A PRESS ON A QUESTION IS A QUESTION, WHENEVER IT LANDS.
   *
   * This opened with `if (!done) { skip(); return; }` -- "while the line is still typing, any
   * activation means 'show me the rest', never 'ask this'" -- so the first press on a question
   * while the character was still talking finished the line and asked nothing. The player pressed
   * "What does it need?", saw the greeting snap to its end, and had to press it again: up to nine
   * presses a run (there are nine questions) on the interaction the game is named for.
   *
   * It was written to stop one real thing, the SPACE key answering question one unread, and it
   * stopped it with a rule about the wrong layer. That is handled where the key is -- `onKeyDown`
   * below only takes Space and Enter for "show me the rest" when focus is on the line itself, not on
   * a button -- so a press on a button can do what the button says.
   *
   * "Show me the skill" and "Take it as offered" below never had the guard: they stop propagation
   * and act mid-typing, and nobody has ever complained about either. The questions follow them. The
   * press still finishes the greeting (the line is about to be replaced by the reply, which types
   * in from nothing), so nothing is lost that was ever on screen long enough to read.
   *
   * It was only ever caught by a player, because every other test either waits for the line to
   * finish before it presses anything or dispatches ASK to the store; e2e/dialogue-press.spec.ts
   * presses the real buttons with the typewriter running.
   */
  const choose = (index: number): void => {
    if (!done) skip();
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
    /*
     * ...but only when the key lands on the LINE. On a button, Space and Enter are that button's
     * press, and taking them here made a keyboard player's first Enter on a question they had just
     * arrowed to do nothing -- the same eaten press as the pointer's, by the other device. The
     * handler runs on the container, so a keydown bubbling from an option or from "Show me the
     * skill" arrives here with that button as its target.
     */
    if (!done && (e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement)) {
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
            <div class="otp-dialogue__linebox">
              {/*
                One hidden copy of every line this character can say, stacked with the paragraph in
                a single grid cell, so the cell is as tall as the tallest and nothing in the panel
                moves when a reply arrives or while one is typing. `visibility: hidden` keeps them
                out of the accessibility tree and out of the paint while keeping their boxes, which
                is the whole point; the `aria-hidden` is belt and braces.

                They sit BESIDE the paragraph, not inside it: `.otp-dialogue__line`'s text is what
                the e2e specs read to know the typewriter has finished.
              */}
              {candidates.map((candidate) => (
                <span key={candidate.id} class="otp-dialogue__ghost" aria-hidden="true">
                  {candidate.text}
                </span>
              ))}
              <p class="otp-dialogue__line">
                <span aria-hidden="true">
                  {shown}
                  {/* The caret, in an anchor with no box of its own: see .otp-dialogue__caret. */}
                  {!done && (
                    <span class="otp-dialogue__caret">
                      <TypingCursor />
                    </span>
                  )}
                </span>
                {/* Screen readers get the whole line once, not a character at a time. */}
                <span class="otp-visually-hidden" aria-live="polite">
                  {done ? line : ''}
                </span>
              </p>
            </div>
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
