import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

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
  /**
   * Whether the title is the panel's heading, as an h2.
   *
   * The three panels that open over the world (the conversation, the card, the post) say it: the
   * frame under them already carries the screen's one h1, so a panel's title is the next level
   * down and the card's own heading (the skill's name) the one after, with nothing skipped.
   * Results leaves it off, because its h1 is the score and a second heading in the header would
   * be a second subject for the page.
   *
   * It is a prop and not always-on so that the visual header is the same element either way: the
   * class carries every pixel of it, and `.otp-panel__title` zeroes the margin the UA gives a
   * heading.
   */
  heading?: boolean;
}

export function Panel({ number, title, children, aside, heading }: PanelProps) {
  const Title = heading ? 'h2' : 'span';
  return (
    <section class="otp-panel">
      <header class="otp-panel__header">
        <span class="otp-panel__number">{number}</span>
        <Title class="otp-panel__title">{title}</Title>
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
 * when inlined, so a second mark on the same screen -- the cabinet's marquee plus the results
 * footer -- would resolve its clip-path against the first and render wrong. An <img> also cannot be
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
  /**
   * Whether the frame's title is the page's h1.
   *
   * Only where the frame IS the screen's heading: 04 Arrive. The title card carries its own h1
   * (the wordmark), so its frame leaves this off and the page keeps exactly one. Explore's h1 is
   * NOT the frame's -- it is `ui/App.tsx`'s, for the reason given there, and its frame says so
   * with `labelHidden`.
   */
  heading?: boolean;
  /**
   * That the numeral and the title are drawn but are not read: another element is this screen's
   * heading and says the same word, so a screen reader would otherwise hear "Explore" twice and a
   * bare "01" with nothing to number. The words stay on screen exactly as they were.
   */
  labelHidden?: boolean;
}

/**
 * The numbered frame around the world. It is drawn in the UI layer and anchored to the canvas box
 * that ui/stage.ts publishes, so the world sits inside the same frame as every other screen
 * instead of floating on the page with its quest chip in the window's corner.
 */
export function WorldFrame({
  number,
  title,
  aside,
  children,
  music,
  heading,
  labelHidden,
}: WorldFrameProps) {
  const hidden = labelHidden ? ({ 'aria-hidden': 'true' } as const) : {};
  return (
    <div class="otp-world-frame">
      <header class="otp-panel__header otp-world-frame__header">
        <span class="otp-panel__number" {...hidden}>
          {number}
        </span>
        {heading ? (
          <h1 class="otp-panel__title">{title}</h1>
        ) : (
          <span class="otp-panel__title" {...hidden}>
            {title}
          </span>
        )}
        {aside && <span class="otp-panel__aside otp-hud">{aside}</span>}
        {music && <MusicToggle on={music.on} onToggle={music.onToggle} labels={music.labels} />}
        {/* No Cyera mark here: the cabinet's marquee carries it over every screen (ui/marquee.ts). */}
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

/** The event the forest listens on for how much of it a docked panel covers (forest-scene.ts). */
const PANEL_COVER = 'otp:panel-cover';

/**
 * Tells the forest how much of the canvas a panel docked over its bottom edge covers, as a share of
 * the canvas's height, for as long as the panel is open (Paul's round, 2026-10-22): the camera
 * frames Purple, the door and the prints in what is left. Measured, not assumed, because only the
 * browser knows how tall the panel came out at this width in this font; re-measured when the panel
 * or the window changes size, and 0 when the panel goes.
 *
 * Only a DOCKED panel counts -- one whose bottom reaches the canvas's bottom. A panel floating in
 * the middle of the world (a centred modal on a wide window) covers no edge the camera can frame
 * around, and `when` lets a panel opt out entirely where it should not move the camera.
 */
export function usePanelCover(
  panel: () => HTMLElement | null,
  when: () => boolean = () => true,
): void {
  useEffect(() => {
    const say = (share: number): void =>
      void window.dispatchEvent(new CustomEvent(PANEL_COVER, { detail: { share } }));
    const measure = (): void => {
      const el = panel();
      const canvas = document.querySelector('#game canvas');
      if (!el || !canvas || !when()) return say(0);
      const p = el.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      if (c.height <= 0 || p.bottom < c.bottom - 2) return say(0);
      say(Math.max(0, c.bottom - Math.max(p.top, c.top)) / c.height);
    };
    measure();
    const el = panel();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    // A modal panel slides 8px into place (`otp-panel-in`), and a transform moves no box the
    // observer watches: measured again when the slide ends, so the share is the settled one.
    el?.addEventListener('animationend', measure);
    addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      el?.removeEventListener('animationend', measure);
      removeEventListener('resize', measure);
      say(0);
    };
  }, []);
}

/*
 * `SoundToggle` lived here: a second, unused sound control drawn with the 🔊/🔇 emoji, which is a
 * colour font no brand owns and a typeface UI_FOUNDATIONS does not list. Nothing rendered it --
 * `MusicToggle` above is the shipped control -- and leaving a second one in the file is how the
 * next person fixes the wrong one. The labelled-control requirement it was written for
 * (UI_FOUNDATIONS binding change 7) is met by `MusicToggle`.
 */

/**
 * How long after a modal panel mounts a POINTER activation inside it is read as the tail of the
 * click that opened the panel rather than as an answer to it.
 *
 * It covers `--otp-motion-slow` (180ms, the `otp-panel-in` slide) with enough margin either side
 * for the frame the panel paints on and for a platform double-click that straddles it. It is
 * deliberately under the ~500ms interval every platform calls a double-click: the point is to
 * discard a stray second half, not to make a player who already knows the card wait.
 */
const MOUNT_SETTLE_MS = 300;

/**
 * How far the pointer must travel between opening a panel and clicking inside it before the click
 * counts as aimed rather than left over.
 *
 * The panel moves 8px under the hand (`otp-panel-in`), so the hand has to have moved further than
 * the panel did. It is also twice the 4px of slop every platform allows inside a double-click, so
 * a hand that merely trembles between the two presses is still treated as still.
 */
const POINTER_SLOP_PX = 8;

/**
 * Whether an activation inside a freshly mounted modal panel is one the player meant.
 *
 * Pure, and exported so test/modal-guard.test.ts can hold the rule without a browser. THREE
 * things make an activation deliberate, and only the last of them is about time.
 *
 * `detail` is the click's count: 0 for a keyboard Enter or Space, for `element.click()`, and for
 * every assistive-technology activation, because none of them has a pointer. Those can never be
 * the second half of a double-click -- there was no first half at a screen position -- so they are
 * always honoured. Gating them too would be a far worse bug than the one this fixes: a switch
 * player would press Allow and watch nothing happen.
 *
 * `pointerMovedPx` is the distance from where the pointer stood when this panel appeared. The
 * defect is a panel moving under a hand that did not, so a hand that DID move has aimed at what it
 * hit and is never second-guessed, however fresh the panel is. Measured: the double-click defect
 * travels 0px, while a player going from "Show me the skill" to Restrict travels 133px at
 * 1280x800 and gets there in as little as 46ms -- comfortably inside the window below, and an
 * answer every time. Without this clause the guard refuses that player, and e2e/ui.spec.ts's
 * "a verdict updates the basket and returns to the world" is the proof: it fails on age alone.
 *
 * `sinceMountMs` is the last word, for the stationary pointer: too fresh to be an answer.
 */
export function activationIsDeliberate(
  detail: number,
  sinceMountMs: number,
  pointerMovedPx: number,
): boolean {
  if (detail === 0) return true;
  if (pointerMovedPx > POINTER_SLOP_PX) return true;
  return sinceMountMs >= MOUNT_SETTLE_MS;
}

/*
 * Where the pointer is, which a panel cannot ask for at the moment it mounts.
 *
 * The one fact the guard above turns on -- did the hand move between opening this panel and
 * clicking in it? -- is about an instant that has already passed by the time the panel exists: the
 * click that opened it. Nothing in the DOM remembers it, so this does, in two numbers, for the
 * life of the document. `NaN` until a pointer is first seen, which makes every distance computed
 * from it `NaN` and every comparison with it false, so a session that has only ever used the
 * keyboard falls back to the age rule and nothing here has to special-case it.
 *
 * Capturing and passive: it can neither be stopped by a handler below it nor delay a scroll, and
 * it writes two numbers per move and allocates nothing, which is what keeps it off the game loop.
 */
let pointerX = Number.NaN;
let pointerY = Number.NaN;
const trackPointer = (e: PointerEvent): void => {
  pointerX = e.clientX;
  pointerY = e.clientY;
};
if (typeof document !== 'undefined') {
  const how = { capture: true, passive: true } as const;
  document.addEventListener('pointermove', trackPointer, how);
  document.addEventListener('pointerdown', trackPointer, how);
}

/**
 * The ref a modal panel puts on its layer, plus the one question a control inside it may ask.
 *
 * It is the ref object itself rather than a `{ ref, ... }` pair so that `ref={trap}` keeps working
 * in the two panels that want nothing but the trap (Dialogue, Notice).
 */
export interface FocusTrapRef {
  current: HTMLDivElement | null;
  /**
   * True when `event` is an answer and not the leftover second click of the double-click that
   * mounted this panel. Only controls that COMMIT something irreversible need to ask.
   */
  deliberate(event: { detail: number; clientX: number; clientY: number }): boolean;
}

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
export function useFocusTrap(onClose?: () => void): FocusTrapRef {
  /*
   * When this panel appeared, which is one frame after the click that opened it. `useRef` keeps
   * the value from the first render, so this is the mount and not the latest re-render -- the
   * argument is evaluated every render but only the first result is stored.
   */
  const mountedAt = useRef(performance.now());
  // Where the hand was when this panel appeared, for the same reason and with the same rule: the
  // first render's value is the one kept, and that render is the panel arriving.
  const openedX = useRef(pointerX);
  const openedY = useRef(pointerY);
  const trap = useRef<FocusTrapRef>({
    current: null,
    deliberate: (event) =>
      activationIsDeliberate(
        event.detail,
        performance.now() - mountedAt.current,
        Math.hypot(event.clientX - openedX.current, event.clientY - openedY.current),
      ),
  });
  const ref = trap.current;
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
      /*
       * Where focus sits in this panel's tab order, or -1 for the autofocus target.
       *
       * -1 is the case the trap used to leak through, and it is the case every modal panel OPENS
       * in. The thing `[data-autofocus]` points at is a `tabindex="-1"` box on two of the three
       * panels -- `.otp-card`, `.otp-dialogue__text` -- so that focus lands on the card being read
       * rather than pre-selecting Allow. `focusable()` deliberately excludes `tabindex="-1"`,
       * because it must not become a tab stop, which left `activeElement` equal to neither `first`
       * nor `last`: the very first Shift+Tab matched no branch and the browser walked focus out of
       * the dialog to the music toggle in the world frame behind it. The second one reached the
       * body, with an `aria-modal` panel still on screen and nothing to tab back into.
       *
       * It is an ancestor of every item here, so in tab order it comes BEFORE the first of them:
       * Shift+Tab wraps to the last, and a plain Tab needs no help, since the browser's own next
       * stop from a container is the first tabbable inside it.
       */
      const at = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (at === 0 || at === -1)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === items.length - 1) {
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
