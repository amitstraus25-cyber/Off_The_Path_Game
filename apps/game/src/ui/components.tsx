import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GoalResult } from '@otp/core';
import { assetUrl } from '../world/assets';

export interface PanelProps {
  /** The two-digit numeral in the header ("01", "02"). */
  number: string;
  title: string;
  children: ComponentChildren;
  /**
   * Header right. UI_FOUNDATIONS binding change 7 retired the decorative "•••"; this corner now
   * carries a notation chip, a sound control, or nothing.
   */
  aside?: ComponentChildren;
}

export function Panel({ number, title, children, aside }: PanelProps) {
  return (
    <section class="otp-panel">
      <header class="otp-panel__header">
        <span class="otp-panel__number">{number}</span>
        <span class="otp-panel__title">{title}</span>
        {aside && <span class="otp-panel__aside">{aside}</span>}
      </header>
      <div class="otp-panel__body">{children}</div>
    </section>
  );
}

/**
 * The official Cyera wordmark, self-hosted and used as-is.
 *
 * The file is a byte-for-byte copy of reference/brand/logos/cyera-logo-white.svg from the Brand
 * Kit, served from the app's own origin so the strict CSP needs nothing beyond `img-src 'self'`.
 * docs/UI_FOUNDATIONS.md, which is now binding, does not restate how the mark is embedded; the
 * superseded BRAND_AND_UI.md section 5 said "inline SVG". This is an <img> at the same vector
 * file instead, which keeps the original proportions and crispness the spec is asking for while
 * avoiding a real bug: the Brand Kit files carry ids (clip0_2322_2323) that go document-global
 * when inlined, so a second mark on the same screen -- the frame header plus the results footer --
 * would resolve its clip-path against the first and render wrong. An <img> also cannot be
 * accidentally recoloured, and no SVG in the document can carry script.
 *
 * White on dark grounds, black on light, per the logo README. Never restyle it beyond height.
 */
export function CyeraMark({ on = 'dark' }: { on?: 'dark' | 'light' }) {
  return (
    <img
      class="otp-mark"
      src={on === 'dark' ? '/brand/cyera-logo-white.svg' : '/brand/cyera-logo-black.svg'}
      alt="Cyera"
    />
  );
}

/** What the sound control calls itself and its two states. Content, so it reads from `strings`. */
export interface MusicLabels {
  /** The control's accessible name. Never changes with the state. */
  name: string;
  on: string;
  off: string;
}

export interface WorldFrameProps {
  number: string;
  title: string;
  aside?: ComponentChildren;
  /** Anything that sits over the world itself, such as the controls hint. */
  children?: ComponentChildren;
  /** Music state and the control for it. Absent on screens that do not carry the frame. */
  music?: { on: boolean; onToggle(): void; labels: MusicLabels };
}

/**
 * The numbered frame around the world. It is drawn in the UI layer and anchored to the canvas box
 * that ui/stage.ts publishes, so the world sits inside the same frame as every other screen
 * instead of floating on the page with its quest chip in the window's corner.
 */
export function WorldFrame({ number, title, aside, children, music }: WorldFrameProps) {
  return (
    <div class="otp-world-frame">
      <header class="otp-panel__header otp-world-frame__header">
        <span class="otp-panel__number">{number}</span>
        <span class="otp-panel__title">{title}</span>
        {aside && <span class="otp-panel__aside otp-hud">{aside}</span>}
        {music && <MusicToggle on={music.on} onToggle={music.onToggle} labels={music.labels} />}
        <CyeraMark />
      </header>
      {children}
    </div>
  );
}

/*
 * A speaker, drawn rather than typed, for the same reason as the verdict glyphs on the skill card:
 * Haffer carries neither U+266A nor U+1F507, so a text glyph falls through to whatever the UA has
 * and lands at a foreign weight and baseline. The off state is a different SHAPE -- a crossed-out
 * cone -- not the same shape in a paler colour.
 */
const SpeakerGlyph = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path d="M3.5 7.5h3L10.5 4v12L6.5 12.5h-3z" fill="currentColor" />
    {on ? (
      <path
        d="M13 7.6a3.6 3.6 0 010 4.8M15.4 5.4a7 7 0 010 9.2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    ) : (
      <path
        d="M12.8 7.2l5 5.6M17.8 7.2l-5 5.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    )}
  </svg>
);

/**
 * The music control. Sound is off until this is pressed: the game embeds in an iframe on the
 * research page, and audio that starts by itself in someone else's page is how an embed gets
 * pulled.
 *
 * UX_REVIEW finding 10. Three things here are the finding, and one of them is not in this file:
 *
 *  - **It says which state it is in, in a word.** UI_FOUNDATIONS section 5 specifies "a labelled
 *    speaker toggle" and "status is carried by shape, bar and words"; this control carried its
 *    state in a colour and a one-character difference between two music notes, with the only word
 *    hidden from everyone who can see. The word is `aria-hidden` because `aria-checked` already
 *    tells a screen reader the state -- and because a switch whose accessible NAME moves with its
 *    state is announced as a different control every time it is pressed.
 *  - **It answers the keyboard.** `world/input.ts` preventDefaults Space and Enter whenever the
 *    world owns the keyboard -- precisely when this control is on screen -- and raises
 *    `interactPressed` before it does, so Space on the focused toggle opened an encounter and left
 *    the switch alone. It is the only focusable control on Explore, so the one thing a keyboard
 *    player could reach was the one thing they could not operate. The keys the button itself uses
 *    therefore stop here instead of reaching the window listener. Esc and the arrows are let
 *    through: walking away from a focused toggle must still walk.
 *  - **Its off state is still Stone `#787771` at 4.26:1 on Black**, which breaks section 7 change 4
 *    (Stone replaced by Ash below 24px), section 1 (Stone is foreground only and does not appear in
 *    this UI) and WCAG at Level A -- and it is still set in Arial, because no `font-family` is
 *    declared and the UA's `button` default beats inheritance. Both live in `panels.css`, which
 *    this round belongs to someone else: see the notes with this change for the two lines.
 */
export function MusicToggle({
  on,
  onToggle,
  labels,
}: {
  on: boolean;
  onToggle(): void;
  labels: MusicLabels;
}) {
  return (
    <button
      type="button"
      class="otp-music"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
      }}
      title={`${labels.name}: ${on ? labels.on : labels.off}`}
    >
      {/*
        One grid item, not two: `.otp-music` is `display: grid; place-items: center`, so a second
        visible child would open a second row and push the control out through a header whose
        height ui/stage.ts has already reserved to the pixel.
      */}
      <span class="otp-music__face" aria-hidden="true">
        <SpeakerGlyph on={on} /> <span class="otp-music__state">{on ? labels.on : labels.off}</span>
      </span>
      <span class="otp-visually-hidden">{labels.name}</span>
    </button>
  );
}

const HUD_SLOTS = 5;
/** Long enough to watch something lift out of a slot, short enough not to delay the walk. */
const LEAVE_MS = 340;
const ARRIVE_MS = 300;

export interface HudBasketProps {
  basket: readonly string[];
  items: Readonly<Record<string, string>>;
  label: string;
}

/**
 * The basket, permanently in the world's HUD.
 *
 * Losing the cottage key and losing Grandma's letter are the two consequences the whole game turns
 * on, and until now neither was ever visible: the only basket was on the Inspect panel, which
 * unmounts in the same tick as the verdict, so the single piece of feedback was a line of text
 * reading "Allowed: Cottage Finder". Here the player watches the item leave.
 *
 * A removal shifts every later item down an index, so the row would jump before the departure
 * could be seen. Instead the previous row is held until the leave animation finishes, then the
 * new one is shown — you see the key lift out of its slot, and only then does the row settle.
 */
export function HudBasket({ basket, items, label }: HudBasketProps) {
  const [shown, setShown] = useState<readonly string[]>(basket);
  const [leaving, setLeaving] = useState<readonly string[]>([]);
  const [arriving, setArriving] = useState<readonly string[]>([]);

  useEffect(() => {
    if (shown === basket) return undefined;
    const gone = shown.filter((i) => !basket.includes(i));
    const added = basket.filter((i) => !shown.includes(i));

    if (gone.length === 0) {
      setShown(basket);
      if (added.length === 0) return undefined;
      setArriving(added);
      const t = setTimeout(() => setArriving([]), ARRIVE_MS);
      return () => clearTimeout(t);
    }

    setLeaving(gone);
    const t = setTimeout(() => {
      setLeaving([]);
      setShown(basket);
      setArriving(added);
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [basket, shown]);

  return (
    <div
      class={`otp-hud-basket${leaving.length > 0 ? ' otp-hud-basket--jolt' : ''}`}
      role="group"
      aria-label={label}
    >
      <span class="otp-hud-basket__label" aria-hidden="true">
        {label}
      </span>
      <ul class="otp-hud-basket__slots">
        {Array.from({ length: HUD_SLOTS }, (_, i) => {
          const item = shown[i];
          const icon = item ? items[item] : undefined;
          const state = item && leaving.includes(item) ? ' otp-hud-slot--leaving' : '';
          const entering = item && arriving.includes(item) ? ' otp-hud-slot--arriving' : '';
          return (
            <li
              class={`otp-hud-slot${item ? '' : ' otp-hud-slot--empty'}${state}${entering}`}
              key={item ?? `empty-${i}`}
            >
              {icon && <img src={assetUrl(`${icon}.png`)} alt={item!} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface HudGoalsProps {
  goals: readonly GoalResult[];
  heading: string;
}

/**
 * What Grandma actually asked for, in the HUD for the whole walk.
 *
 * Without this the errand goals are invisible: the player is being scored on a trade -- capability
 * against risk -- that the game never showed them. Each row states "done" or "not yet" in words as
 * well as by the mark, because no status in this game is carried by colour alone.
 *
 * `role="group"` carries the heading to a screen reader (UX_REVIEW finding 21): a div with an
 * aria-label and no role is not exposed as anything, so three of Grandma's sentences sat in the
 * middle of the world with nothing saying what they were. Same for the basket above.
 */
export function HudGoals({ goals, heading }: HudGoalsProps) {
  return (
    <div class="otp-hud-goals" role="group" aria-label={heading}>
      <span class="otp-hud-goals__label" aria-hidden="true">
        {heading}
      </span>
      <ul class="otp-hud-goals__list">
        {goals.map((g) => (
          <li class={`otp-hud-goal${g.met ? ' otp-hud-goal--met' : ''}`} key={g.id}>
            <span class="otp-hud-goal__mark" aria-hidden="true">
              {g.met ? '✓' : '·'}
            </span>
            <span>{g.label}</span>
            <span class="otp-visually-hidden">{g.met ? ' — done' : ' — not yet'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface HighlightedProps {
  text: string;
  /**
   * The one word set in Season Mix. The brand allows exactly one highlighted word per heading,
   * and it is always upright — the brand book is explicit that Season Mix is never italic.
   * Optional, so a heading with no highlight can use the same component.
   */
  word?: string;
}

/**
 * Splits a heading so exactly one word renders in Season Mix (UI_FOUNDATIONS section 3). Lives
 * here rather than in Title.tsx, which three other screens were importing it from.
 */
export function Highlighted({ text, word }: HighlightedProps) {
  const index = word ? text.lastIndexOf(word) : -1;
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span class="otp-serif">{text.slice(index, index + word!.length)}</span>
      {text.slice(index + word!.length)}
    </>
  );
}

export interface NotationChipProps {
  label: string;
  /** The muted count at the right, e.g. "0 of 3 skills seen". */
  count?: string;
}

/** The chip that sits at the header right: Lilac dot, label, then a muted count. */
export function NotationChip({ label, count }: NotationChipProps) {
  return (
    <p class="otp-chip">
      <span class="otp-chip__dot" aria-hidden="true" />
      <span class="otp-chip__label">{label}</span>
      {count && <span class="otp-chip__count">{count}</span>}
    </p>
  );
}

/*
 * `SoundToggle` lived here: a second, unused sound control drawn with the 🔊/🔇 emoji, which is a
 * colour font no brand owns and a typeface UI_FOUNDATIONS does not list. Nothing rendered it --
 * `MusicToggle` above is the shipped control -- and leaving a second one in the file is how the
 * next person fixes the wrong one. The labelled-control requirement it was written for
 * (UI_FOUNDATIONS binding change 7) is met by `MusicToggle`.
 */

/**
 * Keeps focus inside a modal panel, so a verdict can never be skipped by tabbing past the card.
 *
 * `onClose` is Esc for panels the reducer cannot hear it on. BACK is dispatched globally by
 * `world/input.ts`, but the reducer handles it in the `dialogue` and `inspect` phases only -- and a
 * notice is a DOM panel that leaves the phase on `explore`, so the one `aria-modal` panel where Esc
 * must close was the one panel where it did nothing (UX_REVIEW finding 14). A panel that passes
 * `onClose` closes itself here and stops the key, so it can never be handled twice.
 *
 * Esc listens on the document and Tab on the panel, which is not a stylistic difference. Tab is
 * only interesting while focus is inside the panel -- that is what it moves. Esc has to work
 * wherever focus happens to be: focus can sit on the body for the frame between the panel painting
 * and this effect running, and the canvas takes focus on any pointer press, so a close bound to the
 * panel is a close that silently does nothing some of the time. The first version of this was, and
 * the test for it failed one run in three.
 */
export function useFocusTrap(onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // The handler below is bound once; this keeps it pointing at the current callback.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = (): HTMLElement[] =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0])?.focus();

    const onEscape = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || !close.current) return;
      e.preventDefault();
      // Stops before the window listener in world/input.ts, so one Esc closes one layer.
      e.stopPropagation();
      close.current();
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keydown', onEscape);
      previous?.focus?.();
    };
  }, []);

  return ref;
}
