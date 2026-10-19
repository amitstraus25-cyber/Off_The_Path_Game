import { useState } from 'preact/hooks';
import { ending } from '@otp/core';
import type { Content, GameState } from '@otp/core';
import { WorldFrame } from './components';
import { assetUrl } from '../world/assets';

export interface CottageProps {
  content: Content;
  state: GameState;
  onFinish(): void;
}

/**
 * The advance mark, as the board draws it.
 *
 * The board's Arrive card (gameplay-concepts.png, crop `1536 1024 1536 1024 0.72`; the mark itself
 * at `2880 1860 200 120 6`) ends on a small solid triangle pointing down -- a game's "there is more"
 * prompt. This was a two-pixel stroked chevron, which at 3x reads as the scroll-down affordance off
 * a web form rather than as a text advance. Solid, and a little wider than tall, like the board's.
 *
 * It is still drawn rather than typed: U+25BC is not in Haffer either (789 codepoints, probed
 * against public/fonts/HafferUprightsVF.ttf), so the board's shape is only available as a path.
 *
 * MEASURED OFF THE BOARD, not guessed. Crop `2920 1890 110 90 6` and the mark is about 25 x 27
 * board pixels -- very nearly equilateral, barely wider than it is tall. My first solid version was
 * a 13 x 8 dart, which at 6x reads as a dropdown chevron with the stroke filled in rather than as
 * the board's blunt wedge, so the shape went back to the board's ratio. 25px in the board's
 * 1489px-wide frame is about 21px in our 1248px one; it is drawn a little under that because it is
 * still inside a ring.
 *
 * That ring is `.otp-advance` in screens.css, which has another owner this round. The board has no
 * ring -- the triangle sits bare in the card's corner with clear space around it -- and at the
 * board's own size it would crowd a 34px circle. The ask is in the handback; this glyph is drawn to
 * look right the day the ring goes and acceptable until then.
 */
const Caret = () => (
  <svg viewBox="0 0 20 21" width="20" height="21" aria-hidden="true" focusable="false">
    <path d="M1 1h18L10 20z" fill="currentColor" />
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
      {/*
        No chip in this header. It carried `<NotationChip label="" count="3 of 3 skills decided" />`
        and three things were wrong with that at once:

         - At 640px and below, panels.css hides `.otp-world-frame__header .otp-chip__count` -- it is
           the longest string in a header that cannot grow -- so with an empty label the chip
           degenerated to a purple pill holding one Lilac dot and nothing else. That is the
           decorative "•••" that UI_FOUNDATIONS section 7 change 7 retired, drawn as a dot.
         - The board's Arrive frame (gameplay-concepts.png, crop `1536 1024 1536 1024 0.72`) carries
           a bare header: the numeral, the word, and nothing in the corner. The arrival is the
           payoff shot and its chrome should be quiet.
         - The count said nothing new. It is the same sentence the quest chip has been showing for
           the whole walk, and Results restates it on the screen that carries the argument.

        If a label is wanted here rather than silence, it needs a key in content/game.json, which
        this round belongs to someone else -- the ask is in the handback as `arriveChip`.
      */}
      <WorldFrame number="04" title={content.strings['arriveTitle'] ?? 'Arrive'} />
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
