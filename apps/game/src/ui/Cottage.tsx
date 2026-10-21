import { useEffect, useRef, useState } from 'preact/hooks';
import type { v2 } from '@otp/core';
import { WorldFrame } from './components';
import { strings } from './copy';
import { assetUrl } from '../world/assets';

export interface CottageProps {
  /** Which ending the run reached, and its words from content (`endings`). */
  ending: v2.Ending;
  words: v2.Content['endings'][v2.Ending];
  onFinish(): void;
}

/** Who is in the chair. Only portraits that exist: Grandma, and the wolf in her bonnet. */
const FACE: Record<v2.Ending, string> = {
  grandma: 'portrait-grandma',
  wolf: 'portrait-wolf-grandma',
  late: 'portrait-grandma',
};

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
 * 04 Arrive: the ending, one line at a time, then the way on to the reveal. Purple is on the
 * doorstep until the last line lands; only then does the portrait change, so the reveal is not
 * given away on the first beat. No shake and no gore: a slow fade and a held beat.
 *
 * Focus moves to the text on arrival (a whole screen, not a modal, so no trap), and the region
 * that speaks is born empty and then mutated, because a live region inserted with its text is
 * announced by no screen reader.
 */
export function Cottage({ ending, words, onFinish }: CottageProps) {
  const beats = words.lines;
  const [shown, setShown] = useState(1);
  const done = shown >= beats.length;
  const visible = beats.slice(0, shown);

  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    text.current?.focus();
  }, []);

  const [said, setSaid] = useState('');
  useEffect(() => {
    const line = beats[shown - 1] ?? '';
    setSaid(done ? [words.title, line].filter(Boolean).join('. ') : line);
  }, [shown]);

  return (
    <>
      <WorldFrame number="04" title={strings['arriveTitle'] ?? ''} heading />
      <div class="otp-layer otp-layer--arrive" data-arrive={ending}>
        <div class={`otp-dialogue otp-arrive${done ? ' otp-arrive--done' : ''}`}>
          <div
            class="otp-portrait"
            style={{
              backgroundImage: `url("${assetUrl(`${done ? FACE[ending] : 'portrait-purple'}.png`)}")`,
            }}
            role="img"
            aria-label={done ? words.title : 'Little Purple on the doorstep'}
          />
          <div class="otp-dialogue__text otp-arrive__text" ref={text} tabIndex={-1} data-autofocus>
            <p class="otp-visually-hidden" data-announce="arrive" role="status" aria-live="polite">
              {said}
            </p>
            {done && <h2 class="otp-ending__title">{words.title}</h2>}
            <div>
              {visible.map((line, i) => (
                <p key={i} class="otp-arrive__line otp-arrive__line--reveal">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {done ? (
            <button
              type="button"
              class="otp-button otp-arrive__finish"
              data-action="finish"
              onClick={onFinish}
            >
              {strings['arriveAsk'] ?? ''}
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
