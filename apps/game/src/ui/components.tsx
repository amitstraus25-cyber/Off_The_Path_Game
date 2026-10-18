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

export interface WorldFrameProps {
  number: string;
  title: string;
  aside?: ComponentChildren;
  /** Anything that sits over the world itself, such as the controls hint. */
  children?: ComponentChildren;
}

/**
 * The numbered frame around the world. It is drawn in the UI layer and anchored to the canvas box
 * that ui/stage.ts publishes, so the world sits inside the same frame as every other screen
 * instead of floating on the page with its quest chip in the window's corner.
 */
export function WorldFrame({ number, title, aside, children }: WorldFrameProps) {
  return (
    <div class="otp-world-frame">
      <header class="otp-panel__header otp-world-frame__header">
        <span class="otp-panel__number">{number}</span>
        <span class="otp-panel__title">{title}</span>
        {aside && <span class="otp-panel__aside otp-hud">{aside}</span>}
        <CyeraMark />
      </header>
      {children}
    </div>
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
 */
export function HudGoals({ goals, heading }: HudGoalsProps) {
  return (
    <div class="otp-hud-goals">
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

export interface SoundToggleProps {
  on: boolean;
  onToggle(): void;
}

/** Labelled sound control; replaces the decorative dots (UI_FOUNDATIONS binding change 7). */
export function SoundToggle({ on, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      class="otp-sound"
      aria-pressed={on}
      aria-label={on ? 'Sound on' : 'Sound off'}
      onClick={onToggle}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
    </button>
  );
}

/**
 * Keeps focus inside a modal panel, so a verdict can never be skipped by tabbing past the card.
 * Esc is owned by the input layer (world/input.ts), which hears it wherever focus happens to be.
 */
export function useFocusTrap() {
  const ref = useRef<HTMLDivElement>(null);

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
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, []);

  return ref;
}
