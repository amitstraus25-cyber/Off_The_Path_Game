import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Content } from '@otp/core';
import { CyeraMark, Highlighted, WorldFrame } from './components';

export interface TitleProps {
  content: Content;
  onPlay(): void;
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
export function titleHint(strings: Record<string, string>, padHidden: boolean): string {
  if (!padHidden) return strings['titleMetaTouch'] ?? '';
  return strings['titleMeta'] ?? strings['controlsHint'] ?? '';
}

/**
 * The how-to-play, for the machine this player is actually on.
 *
 * WHAT WAS MISSING, and it is not a tone complaint. Before this the title screen said what the
 * encounters are ("Every offer does what it promises. Read what else it does.") and the hint under
 * the CTA named two keys, and between them the screen never said what the player DECIDES or what
 * they are trying to reach. A visitor to a research page had to infer Allow / Restrict / Reject and
 * "get to the cottage" from the forest itself. The three lines below are the whole of that, read in
 * about five seconds, and the controls come first because they are the question anybody asks first.
 *
 * THE CONTROLS LINE BRANCHES ON THE SAME QUERY `titleHint` BRANCHES ON, and the keys it names are
 * the two the pad actually has. This is finding 11's defect waiting to happen in a new place: the
 * keyboard line names Arrow keys and Space, which are not on a phone, and the touch line must name
 * the joystick (a TAP of the stick is 0px -- see ui/touch-controls.ts, measured) and the A button.
 * One wrong branch here puts instructions on screen that the device in the player's hand cannot
 * follow, which is exactly what e2e/title-claims.spec.ts asserts against for the whole card.
 *
 * Steps two and three describe the game rather than the machine, so they do not branch.
 *
 * Pure and exported so the branch is testable without a DOM, exactly as `titleHint` is; the
 * component supplies `padHidden`. `filter(Boolean)` so a content file missing one of these keys
 * renders a shorter list rather than a blank bullet -- the same call `titleHint` makes when its own
 * key is absent, and the same call `App.tsx` makes on the world summary's lines.
 */
export function howToPlaySteps(strings: Record<string, string>, padHidden: boolean): string[] {
  const walk = padHidden ? strings['howToPlayWalk'] : strings['howToPlayWalkTouch'];
  return [walk, strings['howToPlayOffer'], strings['howToPlayDecide']].filter(
    (line): line is string => Boolean(line),
  );
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
 * The cold open.
 *
 * This used to be an `.otp-screen`: a centred card on an opaque black field, which meant the first
 * thing anyone saw of a pixel game was a brochure. Phaser boots before the first render and the
 * store starts in `title`, so the forest is already running behind this -- the world just had a
 * full-bleed panel painted over it. Now the frame and the world are the same ones the rest of the
 * game uses, and the copy sits in a column docked inside them, so you can see what you are about
 * to play before you decide to play it.
 *
 * What the screen does not do any more is narrate that. It used to carry a chip reading "Purple is
 * already standing on the path" while she rendered behind the column: at 1280 her right edge stops
 * 46px short of clearing it, and an 88%-black ground over a 32px sprite is about 1:1, so the one
 * sentence pointing at her was false at the width most people read it (UX_REVIEW finding 11). The
 * forest either frames her or the screen says nothing about her; it does not claim her.
 *
 * Purple does not move here: world/input.ts only accepts input while the phase is `explore`.
 */
export function Title({ content, onPlay }: TitleProps) {
  const s = (key: string): string => content.strings[key] ?? '';

  /*
   * The hint is read on two different machines, and `titleMeta` only describes one of them: arrow
   * keys and Space are not on a phone, and "just tap" promises a walk a tap does not give -- one
   * tap is about 4px of a 120px/s step (world/logic.ts WALK_SPEED), only a held stick walks, and
   * the pad itself is not drawn until the phase is `explore` (main.ts). So the machine that gets
   * the pad reads the pad's line. Matched per render, as Dialogue.tsx matches reduced motion: a
   * pointer does not change mid-screen.
   *
   * With no `matchMedia` there is no player to be wrong about -- a server or a test renderer -- so
   * it takes the keyboard branch, which is also what every capture shows.
   */
  const padHidden = padIsHidden();
  const hint = titleHint(content.strings, padHidden);
  /* The same question, asked once for both the hint and the steps, so they cannot disagree. */
  const steps = howToPlaySteps(content.strings, padHidden);

  /*
   * Subscribed, not sampled -- see useFrameMarkHidden. This is the one question on the screen
   * whose answer a player can change without touching the game.
   */
  const markHidden = useFrameMarkHidden();

  /* The card the fit ladder settles; see useTitleFit. */
  const panel = useRef<HTMLDivElement>(null);
  useTitleFit(panel, markHidden);

  return (
    <>
      <WorldFrame number="00" title="Title" />
      <div class="otp-title-dock">
        <div class="otp-title-panel" ref={panel}>
          {/*
            THE PROSE SCROLLS; THE WAY IN DOES NOT.

            This wrapper is the fix .otp-title__foot's note in screens.css asks for by name. The
            card used to be the scroller itself, with the button as its last child, and the first
            thing to go under the fold of a scrolling card is its last child. Measured on the built
            preview at DPR 1, at the resting scroll position -- what a player sees when the screen
            opens, before touching anything:

              844x390  (REFERENCE_VIEWPORTS.phoneLandscape)   "Begin the walk" 181x0 visible
              812x375                                          181x0 visible
              667x375                                          181x0 visible
              320x568                                          186x34 of 186x56
              390x600                                          202x47 of 202x58

            Zero visible pixels, on the project's own landscape-phone reference viewport, for the
            page's single Lime call to action and the only entrance to the game. The card does
            scroll, but it shows no scrollbar on touch, no fade and no caret, so nothing tells the
            player there is anything below the fold to scroll to. On a marketing asset that is the
            whole funnel.

            So the copy gets a scroll box of its own and the foot stays OUTSIDE it, pinned by the
            flex column. The button is then on screen at scrollTop 0 at every reference viewport by
            construction rather than by having enough room, which is what
            e2e/css-contract.spec.ts's entrance guard asserts -- at scrollTop 0, deliberately,
            because the check that shipped this green scrolled the card to its end first.

            The wrapper is scenery, not structure: it carries no role and no label, because a
            scroll container that announces itself is a second landmark on a screen whose content
            is one short column. Chromium makes a scrollable region keyboard-focusable on its own,
            so the prose stays reachable without this file adding a tab stop in front of the CTA.
          */}
          <div class="otp-title__scroll">
            {/*
              The mark, where the deck puts it: above the wordmark, at the card's right edge. It is
              drawn only on the widths where the frame header has dropped its own copy, so the
              screen carries exactly one (see frameMarkIsHidden above).

              `.otp-mark` is `display: block; margin-left: auto; flex: none`, and the scroll box is
              itself a flex column (screens.css says why), so it lands top-right with no new rule
              and with the same box model it had as a child of the card.

              THE GROUND IT SITS ON. The panel has now taken the light ground that DESIGN_BOARD.md
              section 2 asked for (Shell, not 88% Black), so the mark is black-on-light, per
              reference/brand/logos/README.md -- a white wordmark on Shell is an invisible one.
            */}
            {markHidden && <CyeraMark on="light" />}
            <h1 class="otp-title__mark">
              <Highlighted text={s('title')} word={s('titleHighlight')} />
            </h1>
            <p class="otp-title__sub">{s('subtitle')}</p>

            <blockquote class="otp-note">
              {s('introNote')}
              <span class="otp-note__from">Pinned to the basket</span>
            </blockquote>

            <p class="otp-body-text">{s('introBody')}</p>

            {/*
              HOW TO PLAY, which the screen did not say at all. See howToPlaySteps above for why it
              is here and why its first line branches on the pointer.

              An ordered list because the three steps are a sequence -- walk, read, decide -- and
              because a numbered list is the one shape a visitor scans without reading. The heading
              is `.otp-section-label`, the Ash eyebrow this project already puts above every section
              on Results and in the world frame, so it needs no type of its own and spends no Lime:
              the card's single Lime is the CTA in the foot below, and UI_FOUNDATIONS allows exactly
              one per screen. Nothing here is Season Mix either -- it is body copy, which the brand
              book bars that face from outright.

              It sits INSIDE `.otp-title__scroll` with the rest of the prose, which is what keeps
              the entrance guard in e2e/css-contract.spec.ts true by construction: the foot reserves
              its row first and the copy lives in what is left, so adding three lines here can push
              the list under the fold but can never push "Begin the walk" off the screen.
            */}
            {steps.length > 0 && (
              <>
                <h2 class="otp-section-label otp-howto__label">{s('howToPlayLabel')}</h2>
                <ol class="otp-howto">
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            )}
          </div>

          <div class="otp-title__foot">
            <button type="button" class="otp-cta" onClick={onPlay}>
              {s('play')}
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
