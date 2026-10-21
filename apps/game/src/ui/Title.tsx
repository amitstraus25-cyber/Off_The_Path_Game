import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { v2 } from '@otp/core';
import { CyeraMark, Highlighted, WorldFrame } from './components';
import { PENDING, strings } from './copy';

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
 * The media query that decides whether the on-screen pad exists, copied from the rule in
 * tokens.css that hides `.otp-touch`. The hint and the pad have to answer the same question --
 * "will this player be given a joystick?" -- and before this they answered two different ones
 * (UX_REVIEW finding 11).
 *
 * `(pointer: coarse)` is not the complement of this. A device with a fine primary pointer and no
 * hover -- a pen-first tablet, a TV remote, a kiosk stylus -- is coarse-negative, so it used to
 * read the keyboard line, while this query is also false for it so the CSS *does* draw the pad.
 * That player was shown arrow keys they may not have and told nothing about the stick under their
 * thumb. apps/game/test/title.test.ts holds this constant against the stylesheet, so if the pad's
 * rule moves the hint fails the build rather than drifting quietly.
 */
export const PAD_HIDDEN_QUERY = '(pointer: fine) and (hover: hover)';

/**
 * Whether this player is being given the on-screen pad, asked of the browser.
 *
 * Shared because two screens have to answer it the same way: the title's hint, and the world
 * summary a screen reader reads instead of the canvas (`App.tsx`). The summary used to print
 * `controlsHint` -- "Arrows or WASD to walk, Space to talk, Esc to go back" -- to every player,
 * including a phone, where `panels.css` already hides the visible copy of that line for naming keys
 * to someone holding a phone. The sighted touch player was spared it and the blind touch player was
 * not, which is finding 11's defect inside finding 16's fix.
 *
 * With no `matchMedia` there is no player to be wrong about -- a server or a test renderer -- so
 * it answers "hidden", which is also what every capture shows.
 */
export const padIsHidden = (): boolean =>
  typeof matchMedia !== 'function' || matchMedia(PAD_HIDDEN_QUERY).matches;

/**
 * The media query that drops the Cyera wordmark out of the world frame's header, copied from the
 * rule in panels.css that sets `.otp-world-frame__header .otp-mark { display: none }`.
 *
 * The header cannot grow and cannot wrap -- ui/stage.ts reserves exactly --otp-world-header pixels
 * above the canvas -- so below 560px it gives up the mark, and the hero screen of a marketing asset
 * was left carrying no brand at all: at 375 the header reads "00" and nothing else
 * (docs/DESIGN_BOARD.md section 3, "the screens").
 */
export const FRAME_MARK_HIDDEN_QUERY = '(max-width: 560px)';

/**
 * Whether the frame header has dropped the wordmark, so the title card has to carry it.
 *
 * It is asked rather than always drawn because the answer must be exactly one mark. The board's
 * page shows one; `WorldFrame` draws one in the header above 560px, and a second in the card
 * underneath it would be two wordmarks on one screen, which the logo README does not allow.
 *
 * With no `matchMedia` -- a server or a test renderer -- it answers "not hidden", which is the
 * conservative end: the screen may then be judged for a missing mark, but it can never ship two.
 * The opposite default to `padIsHidden` above, for that reason and not by accident.
 */
export const frameMarkIsHidden = (): boolean =>
  typeof matchMedia === 'function' && matchMedia(FRAME_MARK_HIDDEN_QUERY).matches;

/**
 * The same question, asked continuously instead of once.
 *
 * `padIsHidden` above is matched per render and the comment there defends that, correctly: pointer
 * and hover describe the machine, and a machine does not change mid-screen. WIDTH IS NOT LIKE
 * THAT. It changes whenever a desktop window is dragged narrower and whenever a tablet is turned,
 * and `Title` has no prop that changes when it happens -- so the answer taken at mount was the
 * answer the screen kept. Measured on the running build, at 560px, before this hook existed:
 *
 *   load at 1280, narrow to 375   ->  0 marks   (header drops its copy, the card never adds one)
 *   load at 375,  widen to 1280   ->  2 marks   (header adds its copy, the card still has one)
 *
 * Zero is the hero screen of a marketing asset carrying no brand at all, which is the defect
 * docs/DESIGN_BOARD.md section 3 raised against 375 in the first place. Two is the one outcome
 * reference/brand/logos/README.md does not allow, reached by the ordinary act of maximising a
 * window. The invariant the card's mark exists to keep -- exactly one mark on the screen -- held
 * only for a player who never resized.
 *
 * Lazily seeded from `frameMarkIsHidden` so the first paint is already right and nothing flashes,
 * and so a renderer with no `matchMedia` keeps that function's conservative answer: not hidden,
 * no second mark, never two.
 */
export function useFrameMarkHidden(): boolean {
  const [hidden, setHidden] = useState(frameMarkIsHidden);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(FRAME_MARK_HIDDEN_QUERY);
    const sync = (): void => setHidden(query.matches);
    // Once on mount as well: the viewport can cross 560px between the lazy seed and this effect.
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return hidden;
}

/**
 * The line under the CTA, for a player the pad is or is not drawn for.
 *
 * Narrow and fine-pointer is a desktop window, not a phone: the pad is hidden at every width by
 * the query above, the keyboard is the only way to walk, and so the keyboard line is the true one
 * at 375 just as it is at 1280. The screenshots are what mislead there, not the screen -- a mouse
 * at 375 is a reviewer's window, not a device anyone plays on.
 *
 * Where the pad *is* drawn the keyboard line is not merely incomplete, it is wrong about the
 * machine, so the touch line replaces it rather than joining it. If content has no touch line the
 * screen stays quiet: a missing string is better than a keyboard hint on a phone.
 *
 * Pure and exported so the branch is testable without a DOM; the component supplies `padHidden`.
 */
export function titleHint(strings: Readonly<Record<string, string>>, padHidden: boolean): string {
  if (!padHidden) return strings['howToPlayWalkTouch'] ?? '';
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
 *     hint wraps differently once it has;
 *   - `markHidden`, because the card's own wordmark appears at 560px and is a block of content.
 *
 * Each ask starts from rung 0 rather than from the rung last chosen, so a window that is dragged
 * taller gets its prose back: the ladder only ever descends for as long as the room is missing.
 */
function useTitleFit(panel: { current: HTMLDivElement | null }, markHidden: boolean): void {
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
  }, [markHidden]);
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
  action,
  onAction,
  busy = false,
  focus = false,
}: {
  children: ComponentChildren;
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
  const hint = titleHint(strings, padIsHidden());
  /*
   * Subscribed, not sampled -- see useFrameMarkHidden. This is the one question on the screen
   * whose answer a player can change without touching the game.
   */
  const markHidden = useFrameMarkHidden();
  const panel = useRef<HTMLDivElement>(null);
  useTitleFit(panel, markHidden);

  return (
    <>
      <WorldFrame number="00" title="Title" />
      <div class="otp-title-dock">
        <div class="otp-title-panel" ref={panel}>
          {/*
            THE PROSE SCROLLS; THE WAY IN DOES NOT. The copy has a scroll box of its own and the foot
            stays outside it, pinned by the flex column, so the one call to action is on screen at
            scrollTop 0 at every reference viewport by construction (e2e/css-contract.spec.ts).
          */}
          <div class="otp-title__scroll">
            {/* Drawn only where the frame header has dropped its own copy: exactly one mark. */}
            {markHidden && <CyeraMark on="light" />}
            {children}
          </div>
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
    <TitleCard action={l.start} onAction={onPlay}>
      <h1 class="otp-title__mark">
        <Highlighted text={l.title} word={l.titleHighlight} />
      </h1>
      <p class="otp-title__sub">{l.subtitle}</p>
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
    <TitleCard action={PENDING.howToGo} onAction={onGo} busy={busy} focus>
      <h1 class="otp-title__mark otp-howto__title">{ui.howTo.title}</h1>
      <ol class="otp-howto" data-howto="">
        {ui.howTo.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </TitleCard>
  );
}
