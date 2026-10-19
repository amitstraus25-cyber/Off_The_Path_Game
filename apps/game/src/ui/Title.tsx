import type { Content } from '@otp/core';
import { Highlighted, WorldFrame } from './components';

export interface TitleProps {
  content: Content;
  onPlay(): void;
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
   * the pad itself is not drawn until the phase is `explore` (main.ts). So touch reads its own
   * line, and until that line exists in content the screen stays quiet rather than lying. Matched
   * per render, as Dialogue.tsx matches reduced motion: a pointer does not change mid-screen.
   */
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const hint = coarse ? s('titleMetaTouch') : s('titleMeta') || s('controlsHint');

  return (
    <>
      {/* The frame carries the wordmark instead of a chip reading "Cyera" out -- but only down to
          560px, where panels.css hides it and the hero screen of a marketing asset is left with no
          brand on it at all. The deck puts a mark at the top of the card; that needs a rule in
          screens.css to sit there, so it is the CSS owner's to place (UX_REVIEW finding 11). */}
      <WorldFrame number="00" title="Title" />
      <div class="otp-title-dock">
        <div class="otp-title-panel">
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
