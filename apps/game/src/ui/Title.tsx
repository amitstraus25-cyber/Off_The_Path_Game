import { useEffect, useState } from 'preact/hooks';
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
 * The cold open.
 *
 * This used to be an `.otp-screen`: a centred card on an opaque black field, which meant the first
 * thing anyone saw of a pixel game was a brochure. Phaser boots before the first render and the
 * store starts in `title`, so the forest is already running behind this -- the world just had a
 * full-bleed panel painted over it. Now the frame and the world are the same ones the rest of the
 * game uses, and the copy sits in a column docked inside them, so you can see what you are about
 * to play before you decide to play it.
 *
 * What the screen does not do any more is narrate that. It used to carry a chip reading "Red is
 * already standing on the path" while she rendered behind the column: at 1280 her right edge stops
 * 46px short of clearing it, and an 88%-black ground over a 32px sprite is about 1:1, so the one
 * sentence pointing at her was false at the width most people read it (UX_REVIEW finding 11). The
 * forest either frames her or the screen says nothing about her; it does not claim her.
 *
 * Red does not move here: world/input.ts only accepts input while the phase is `explore`.
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
  const hint = titleHint(content.strings, padIsHidden());

  /*
   * Subscribed, not sampled -- see useFrameMarkHidden. This is the one question on the screen
   * whose answer a player can change without touching the game.
   */
  const markHidden = useFrameMarkHidden();

  return (
    <>
      <WorldFrame number="00" title="Title" />
      <div class="otp-title-dock">
        <div class="otp-title-panel">
          {/*
            The mark, where the deck puts it: above the wordmark, at the card's right edge. It is
            drawn only on the widths where the frame header has dropped its own copy, so the screen
            carries exactly one (see frameMarkIsHidden above).

            `.otp-mark` is `display: block; margin-left: auto; flex: none`, and .otp-title-panel is
            a flex column, so it lands top-right with no new rule -- which matters this round,
            because the stylesheets have another owner.

            THE GROUND IT SITS ON. White-on-dark is correct TODAY and only today: .otp-title-panel
            is 88% Black, and docs/DESIGN_BOARD.md section 2 asks for that near-black half-screen to
            go. The moment the panel takes a light ground this must become `on="light"`, per
            reference/brand/logos/README.md -- a white wordmark on Shell is an invisible one.
          */}
          {markHidden && <CyeraMark />}
          <h1 class="otp-title__mark">
            <Highlighted text={s('title')} word={s('titleHighlight')} />
          </h1>
          <p class="otp-title__sub">{s('subtitle')}</p>

          <blockquote class="otp-note">
            {s('introNote')}
            <span class="otp-note__from">Pinned to the basket</span>
          </blockquote>

          <p class="otp-body-text">{s('introBody')}</p>

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
