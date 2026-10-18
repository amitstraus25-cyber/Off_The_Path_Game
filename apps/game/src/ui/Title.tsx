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
 * store starts in `title`, so the forest is already drawn and Red is already standing on the path
 * -- the world just had a full-bleed panel painted over it. Now the frame and the world are the
 * same ones the rest of the game uses, and the copy sits in a column docked inside them, so you
 * can see what you are about to play before you decide to play it.
 *
 * Red does not move here: world/input.ts only accepts input while the phase is `explore`.
 */
export function Title({ content, onPlay }: TitleProps) {
  const s = (key: string): string => content.strings[key] ?? '';

  return (
    <>
      {/* The wordmark the frame now carries says "Cyera" better than a chip reading it out. */}
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
            <p class="otp-hint">{s('titleMeta') || s('controlsHint')}</p>
          </div>
        </div>

        {s('titleStanding') && (
          <p class="otp-title__standing">
            <span class="otp-chip__dot" aria-hidden="true" />
            {s('titleStanding')}
          </p>
        )}
      </div>
    </>
  );
}
