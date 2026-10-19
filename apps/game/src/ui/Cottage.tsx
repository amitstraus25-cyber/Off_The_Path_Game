import { useState } from 'preact/hooks';
import { ending } from '@otp/core';
import type { Content, GameState } from '@otp/core';
import { NotationChip, WorldFrame } from './components';
import { assetUrl } from '../world/assets';

export interface CottageProps {
  content: Content;
  state: GameState;
  onFinish(): void;
}

const Caret = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
    <path
      d="M5 7.5l5 5 5-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/**
 * The arrival. Approach lines first, then the ending the flags earned. No shake and no gore:
 * a slow fade and a held beat (BRAND_AND_UI section 7).
 *
 * The world stays on screen behind this. It used to be replaced by an opaque page, so the game's
 * climax played out as a small card on an empty field with the cottage nowhere in sight — and the
 * wolf's portrait was shown on the very first approach line, giving the reveal away before the
 * sequence had begun. Red is at the door until the reveal; only then does the portrait change.
 *
 * Both halves of the sequence are now keyed on the ENDING, not on one flat script run for every
 * outcome (docs/UX_REVIEW.md 3). Before this a flawless run read "There are paw prints in the soft
 * earth by the step" and "The door is already open" on its way to "Grandma waves from her chair",
 * and every ending — the clean one included — was captioned with a wolf in a bonnet.
 *
 * It is keyed through `strings`, as `arriveLines.<ending>` and `arrivePortrait.<ending>`, rather
 * than through new fields on the ending itself: both are content, CLAUDE.md rule 3 wants content in
 * data, and `strings` already takes any key, so a fifth ending needs no schema change and no code
 * change here. An ending with neither key degrades to the shared opener and no portrait change,
 * which says less than it could but never says anything false.
 */
export function Cottage({ content, state, onFinish }: CottageProps) {
  const chosen = ending(state, content);
  const script =
    content.strings[`arriveLines.${chosen.id}`] ?? content.strings['arriveLines'] ?? '';
  const approach = script.split('|').filter(Boolean);
  const face = content.strings[`arrivePortrait.${chosen.id}`] ?? 'portrait-red';
  const beats = [
    ...approach.map((line) => ({ line, reveal: false })),
    ...chosen.lines.map((line) => ({ line, reveal: true })),
  ];

  const [shown, setShown] = useState(1);
  const done = shown >= beats.length;
  const visible = beats.slice(0, shown);
  const revealed = visible.some((b) => b.reveal);

  return (
    <>
      <WorldFrame
        number="04"
        title={content.strings['arriveTitle'] ?? 'Arrive'}
        aside={
          <NotationChip
            label=""
            count={`${content.skills.length} of ${content.skills.length} skills decided`}
          />
        }
      />
      <div class="otp-layer otp-layer--arrive">
        <div class="otp-dialogue otp-arrive">
          <div
            class="otp-portrait"
            style={{
              backgroundImage: `url("${assetUrl(`${revealed ? face : 'portrait-red'}.png`)}")`,
            }}
            role="img"
            aria-label={revealed ? 'At the cottage door' : 'Red on the doorstep'}
          />
          <div class="otp-dialogue__text otp-arrive__text">
            {done && <h2 class="otp-ending__title">{chosen.title}</h2>}
            <div aria-live="polite">
              {visible.map((beat, i) => (
                <p
                  key={i}
                  class={`otp-arrive__line${beat.reveal ? ' otp-arrive__line--reveal' : ''}`}
                >
                  {beat.line}
                </p>
              ))}
            </div>
          </div>

          {done ? (
            <button type="button" class="otp-button otp-arrive__finish" onClick={onFinish}>
              {content.strings['arriveAsk'] ?? 'Continue'}
            </button>
          ) : (
            <button
              type="button"
              class="otp-advance"
              aria-label="Go on"
              onClick={() => setShown((n) => Math.min(beats.length, n + 1))}
            >
              <Caret />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
