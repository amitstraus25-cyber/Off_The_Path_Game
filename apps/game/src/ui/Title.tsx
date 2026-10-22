import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { v2 } from '@otp/core';
import { Highlighted, WorldFrame } from './components';
import { strings } from './copy';

export interface TitleProps {
  ui: v2.Content['ui'];
  onPlay(): void;
}

export interface HowToProps {
  ui: v2.Content['ui'];
  onGo(): void;
  /** The run's start is still being asked of the server: the button says so and ignores presses. */
  busy: boolean;
}

/**
 * Whether this machine has a keyboard to walk with: a fine pointer that hovers is a desktop.
 *
 * THIS USED TO BE `PAD_HIDDEN_QUERY`, the rule in tokens.css that stopped drawing the joystick and
 * the A button on a desktop, and the hint and the pad had to answer the same question (UX_REVIEW
 * finding 11). The arcade cabinet (the client's decision, 2026-10-22) draws the deck on EVERY
 * machine and the stick and A work with a mouse, so that rule is gone -- but the question the
 * hint asks never was "is there a pad?". It is "what does this player walk with?", and a desktop
 * player has a keyboard as well as a deck, and the keyboard is still the better input there. So the
 * query stays, named for what it now decides; apps/game/test/title.test.ts holds that no stylesheet
 * hides the pad behind it again.
 *
 * `(pointer: coarse)` is not the complement of this. A device with a fine primary pointer and no
 * hover -- a pen-first tablet, a TV remote, a kiosk stylus -- is coarse-negative and has no
 * keyboard to speak of, so it is given the deck's line.
 */
export const KEYBOARD_QUERY = '(pointer: fine) and (hover: hover)';

/**
 * Whether this player walks with a keyboard, asked of the browser.
 *
 * Shared because two screens have to answer it the same way: the title's hint, and the world
 * summary a screen reader reads instead of the canvas (`App.tsx`). The summary used to print
 * `controlsHint` -- "Arrows or WASD to walk, Space to talk, Esc to go back" -- to every player,
 * including a phone, where `panels.css` already hides the visible copy of that line for naming keys
 * to someone holding a phone. The sighted touch player was spared it and the blind touch player was
 * not, which is finding 11's defect inside finding 16's fix.
 *
 * With no `matchMedia` there is no player to be wrong about -- a server or a test renderer -- so
 * it answers "keyboard", which is also what every capture shows.
 */
export const hasKeyboard = (): boolean =>
  typeof matchMedia !== 'function' || matchMedia(KEYBOARD_QUERY).matches;

/*
 * No wordmark logic here any more. The card drew its own Cyera mark wherever the frame header had
 * dropped one (below 560px), so the screen always carried exactly one. The cabinet's marquee now
 * carries the logo across the top of every screen at every width, so neither the header nor the
 * card draws one, and "exactly one" holds by construction rather than by a media query and a hook
 * kept in step with it.
 */

/**
 * The line under the CTA, for a player with a keyboard or without one.
 *
 * Narrow and fine-pointer is a desktop window, not a phone: the keyboard is there at every width,
 * so the keyboard line is the true one at 375 just as it is at 1280. A mouse at 375 is a
 * reviewer's window, not a device anyone plays on.
 *
 * Without a keyboard the keyboard line is not merely incomplete, it is wrong about the machine, so
 * the deck's line replaces it rather than joining it. If content has no touch line the screen stays
 * quiet: a missing string is better than a keyboard hint on a phone.
 *
 * Pure and exported so the branch is testable without a DOM; the component supplies `keyboard`.
 */
export function titleHint(strings: Readonly<Record<string, string>>, keyboard: boolean): string {
  if (!keyboard) return strings['howToPlayWalkTouch'] ?? '';
  return strings['controlsHint'] ?? '';
}

/**
 * The last rung of the title card's fit ladder: rungs are numbered 0..FIT_LAST and `Title` writes
 * the rung it settled on to `data-fit` on `.otp-title-panel`, where screens.css reads it. 0 is the
 * card exactly as it has always been drawn; each rung above it gives up a little more room:
 *
 *   0 full      the card as designed
 *   1 snug      spacing only -- the gaps between blocks and the card's own padding
 *   2 compact   + the intro paragraph goes (it stays in the reading order, see screens.css), and the
 *                 call to action sheds the padding its 30px arrow disc forced on it
 *   3 tight     + Grandma's note goes the same way
 *   4 tiny      + the three steps, their label and the hint drop to the 12px body-copy floor
 *
 * What is NEVER given up on any rung: the wordmark, the subtitle, the how-to-play, the controls
 * line and the call to action. Those are the screen; the two paragraphs above them are the prose
 * around it, and on a card the camera has capped at 299px tall (320x568) the prose is what yields.
 */
export const FIT_LAST = 4;

/**
 * The first rung of the ladder at which the card's copy fits its scroll box, or the last rung and
 * `scrolls: true` when none does.
 *
 * Pure, and handed the measurement as a function, so the choice is testable without a DOM -- the
 * component supplies `fits`, which applies a rung and asks the browser. The rungs are tried
 * LOOSEST FIRST on purpose: every viewport that already fitted keeps the card it always had,
 * pixel for pixel, and only a viewport that was clipping is ever asked to give anything up.
 *
 * `scrolls` is the honest end of the line, and it is a fact the component turns into a visible
 * cue rather than a quiet clip. It is reached only by a card with less room than the tiny rung
 * needs (a phone held sideways at 360px tall, a window at 200% zoom on a small laptop), and the
 * alternative -- leaving the steps under a fold that has no scrollbar, no fade and no caret -- is
 * the defect this ladder was written to remove.
 */
export function chooseFit(
  fits: (rung: number) => boolean,
  last: number = FIT_LAST,
): { rung: number; scrolls: boolean } {
  for (let rung = 0; rung < last; rung += 1) if (fits(rung)) return { rung, scrolls: false };
  return { rung: last, scrolls: !fits(last) };
}

/**
 * Settles the card on the loosest rung of the fit ladder that shows all of its copy, and keeps it
 * settled.
 *
 * WHY THIS IS MEASURED AND NOT A MEDIA QUERY. How tall the card is allowed to be is not a property
 * of the window. In landscape it is the canvas's height; in portrait it is a cap taken off the
 * camera (screens.css, "THE PORTRAIT TWIN"), which is a function of the window's width AND its
 * height; and how tall the copy is depends on how many lines the controls hint wraps to, which
 * depends on the column width, the type scale step and whichever face actually loaded. A breakpoint
 * ladder written against two of those is a ladder with cliffs between its rungs, and the viewport
 * that falls down one is always one nobody listed -- the defect that shipped with the steps
 * invisible at 320x568, 768x800 and 640x400 (a 1280x800 window at 200% zoom) while three of the
 * nine sizes this was reported at fitted. Here the browser is simply asked, at the size it
 * actually is, whether the steps are inside their box.
 *
 * It runs in a LAYOUT effect, so the first paint is already the settled card and nothing flashes,
 * and it re-asks whenever any of its inputs can have moved:
 *
 *   - `resize`. This said stage.ts's own listener "has already answered by republishing the canvas
 *     box" by the time this one runs, and an adversarial reviewer measured that it has NOT always:
 *     immediately after a resize the scroll box can read 0px tall, every rung then "fails", and the
 *     card settled on the last rung with the scrollbar cue drawn -- until the ResizeObserver below
 *     fired a frame later and corrected it. So a 0px box is now treated as "layout not ready" and
 *     skipped, and the observer's next callback settles it against a real box;
 *   - the dock's own size, for a canvas that changes without the window doing so;
 *   - the fonts settling, because Haffer arrives after the first paint on a cold load and the
 *     hint wraps differently once it has.
 *
 * Each ask starts from rung 0 rather than from the rung last chosen, so a window that is dragged
 * taller gets its prose back: the ladder only ever descends for as long as the room is missing.
 */
function useTitleFit(panel: { current: HTMLDivElement | null }): void {
  useLayoutEffect(() => {
    const card = panel.current;
    const scroller = card?.querySelector<HTMLElement>('.otp-title__scroll');
    if (!card || !scroller) return;

    const settle = (): void => {
      // A box with no height is a layout that has not caught up with the window, not a card with
      // no room: measuring it would fail every rung and flash the scroll cue. The dock's
      // ResizeObserver fires again once layout settles, and that pass measures a real box.
      if (scroller.clientHeight === 0) return;
      const { rung, scrolls } = chooseFit((candidate) => {
        card.dataset['fit'] = String(candidate);
        // scrollHeight is the whole copy; clientHeight is the box it was given. Both are read
        // from the layout this very call just changed, which forces it -- five times at most.
        return scroller.scrollHeight <= scroller.clientHeight;
      });
      card.dataset['fit'] = String(rung);
      if (scrolls) card.dataset['scrolls'] = 'true';
      else delete card.dataset['scrolls'];
    };

    settle();
    addEventListener('resize', settle);
    const dock = card.parentElement;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(settle) : null;
    if (dock) observer?.observe(dock);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(settle);
    fonts?.addEventListener?.('loadingdone', settle);

    return () => {
      removeEventListener('resize', settle);
      observer?.disconnect();
      fonts?.removeEventListener?.('loadingdone', settle);
    };
  }, []);
}

/**
 * The card both opening screens share: the frame, the dock and the column, the fit ladder, the
 * one Lime call to action in the foot and the controls line under it. The landing and the how-to
 * are the same object on purpose -- the how-to used to live inside the landing card, and splitting
 * it into its own step must not give it a second look.
 *
 * The world is already running behind this (Phaser boots before the first render), so a visitor
 * sees what they are about to play before they decide to play it.
 */
function TitleCard({
  children,
  frameTitle,
  action,
  onAction,
  busy = false,
  focus = false,
}: {
  children: ComponentChildren;
  /** The frame's title (`ui.landing.frameTitle`): the landing and the how-to share the frame. */
  frameTitle: string;
  action: string;
  onAction(): void;
  busy?: boolean;
  /** Take focus on arrival, so a keyboard player's next Enter is this button. */
  focus?: boolean;
}) {
  const cta = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) cta.current?.focus({ preventScroll: true });
  }, []);
  const hint = titleHint(strings, hasKeyboard());
  const panel = useRef<HTMLDivElement>(null);
  useTitleFit(panel);

  return (
    <>
      <WorldFrame number="00" title={frameTitle} />
      <div class="otp-title-dock">
        <div class="otp-title-panel" ref={panel}>
          {/*
            THE PROSE SCROLLS; THE WAY IN DOES NOT. The copy has a scroll box of its own and the foot
            stays outside it, pinned by the flex column, so the one call to action is on screen at
            scrollTop 0 at every reference viewport by construction (e2e/css-contract.spec.ts).
          */}
          <div class="otp-title__scroll">{children}</div>
          <div class="otp-title__foot">
            {/*
              `aria-disabled` rather than `disabled` while the start is out, so the button keeps
              focus (a `disabled` button is blurred to <body> the instant it lands).
            */}
            <button
              type="button"
              class="otp-cta"
              ref={cta}
              aria-disabled={busy ? 'true' : undefined}
              onClick={() => {
                if (!busy) onAction();
              }}
            >
              {action}
              <span class="otp-cta__disc" aria-hidden="true">
                →
              </span>
            </button>
            {hint && <p class="otp-hint">{hint}</p>}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The landing. Cyera-branded per UI_FOUNDATIONS section 8: the wordmark, "Off the Path" with one
 * Season Mix word, the subtitle, and the one Lime pill.
 *
 * NO BACKGROUND PICTURE YET. The client asked for a Cyera background "like this" and the image has
 * not arrived (GAME_DESIGN_V2 section 8). CLAUDE.md rule 5 forbids inventing one, and a labelled
 * placeholder ("awaiting the client's art") is internal wording a public visitor must not see, so
 * the landing ships without one. When the art lands it goes here, under the subtitle.
 */
export function Title({ ui, onPlay }: TitleProps) {
  const l = ui.landing;
  return (
    <TitleCard frameTitle={l.frameTitle} action={l.start} onAction={onPlay}>
      <h1 class="otp-title__mark">
        <Highlighted text={l.title} word={l.titleHighlight} />
      </h1>
      <p class="otp-title__sub">{l.subtitle}</p>
      {/*
        THE GAME IN ONE LINE (the client, 2026-10-22: "I want it to be clear"): three good, four
        malicious, find the good three and get to Grandma fast. `.otp-body-text` on purpose -- it is
        the paragraph the fit ladder lets yield first on a short card (screens.css, rung 2), and it
        yields to the visually-hidden treatment, so a screen reader still hears it. The how-to that
        follows says the same thing in four steps.
      */}
      <p class="otp-body-text otp-title__premise">{strings['landingPremise'] ?? ''}</p>
    </TitleCard>
  );
}

/**
 * How to play: the content's three or four steps, read in about five seconds, shown once at the
 * start of a visit and skipped on every replay (main.ts). Its button is the skip: it starts the
 * clock at once, and Enter on it works the moment the panel opens because focus starts there.
 */
export function HowTo({ ui, onGo, busy }: HowToProps) {
  return (
    <TitleCard
      frameTitle={ui.landing.frameTitle}
      action={ui.howTo.go}
      onAction={onGo}
      busy={busy}
      focus
    >
      <h1 class="otp-title__mark otp-howto__title">{ui.howTo.title}</h1>
      <ol class="otp-howto" data-howto="">
        {ui.howTo.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </TitleCard>
  );
}
