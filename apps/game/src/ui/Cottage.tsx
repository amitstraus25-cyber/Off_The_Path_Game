import { useEffect, useRef, useState } from 'preact/hooks';
import type { v2 } from '@otp/core';
import { NotationChip, WorldFrame, usePanelCover } from './components';
import { fill, strings } from './copy';
import { assetUrl } from '../world/assets';

export interface CottageProps {
  /** Which ending the run reached, and its words from content (`endings`). */
  ending: v2.Ending;
  words: v2.Content['endings'][v2.Ending];
  /**
   * A first beat said before the ending's own lines, or '': the Word Weaver's welcome, word went
   * ahead (`chrome.doorWelcome`; App.tsx decides when).
   */
  welcome?: string;
  /** How many of the cast were met, and how many there are: the header chip's count. */
  met?: number;
  total?: number;
  onFinish(): void;
}

/**
 * Who the last beat shows. Only portraits that exist: Grandma, the wolf in her bonnet, and Purple.
 *
 * LATE IS PURPLE, NOT GRANDMA (Paul's round, 2026-10-22). The late ending is "Grandma had given up
 * waiting" -- nobody opened a door -- and a smiling Grandma under that line contradicted it. Purple
 * is who is there: still outside, after dark.
 */
const FACE: Record<v2.Ending, string> = {
  grandma: 'portrait-grandma',
  wolf: 'portrait-wolf-grandma',
  late: 'portrait-purple',
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
 * Focus moves to the advance control on arrival (a whole screen, not a modal, so no trap), and the region
 * that speaks is born empty and then mutated, because a live region inserted with its text is
 * announced by no screen reader.
 */
export function Cottage({ ending, words, welcome = '', met, total, onFinish }: CottageProps) {
  const beats = welcome ? [welcome, ...words.lines] : words.lines;
  const [shown, setShown] = useState(1);
  const done = shown >= beats.length;
  /*
   * THE LATE ENDING NEVER REACHED A DOOR (Paul's round, 2026-10-22): "Arrive" over it, and "Step
   * inside" under it, said the opposite of its own lines. So on late the header takes the ending's
   * own title ("After dark", already in content), and the way on is "See what happened".
   */
  const late = ending === 'late';
  const header = late ? words.title : (strings['arriveTitle'] ?? '');
  /*
   * THE HEADER'S RIGHT SIDE (UI_FOUNDATIONS section 5, every header carries a chip): where you are,
   * and how much of the cast you met on the way. On late the label is the walk's own goal, still
   * unmet, rather than "At Grandma's door" -- which is where a late run never got.
   */
  const label = (late ? strings['worldGoal'] : strings['arriveChipLabel']) ?? '';
  const chip =
    met !== undefined && total !== undefined ? (
      <NotationChip label={label} count={fill(strings['worldMetCount'] ?? '', { met, total })} />
    ) : (
      <NotationChip label={label} />
    );

  /*
   * FOCUS GOES TO THE CONTROL THAT MOVES THE SCENE ON, not to the text (the 2026-10-22 review:
   * focused on the text box, Enter and Space did nothing, and when the last line replaced the
   * advance ring with Step inside, focus fell back to the page). Whichever of the two buttons is
   * showing takes it, on arrival and after every beat, so a keyboard player presses Enter through
   * the whole ending. The hidden status region below still says each line as it lands, so what a
   * screen reader hears is unchanged.
   */
  const advance = useRef<HTMLButtonElement>(null);
  const finish = useRef<HTMLButtonElement>(null);
  // How much of the world this panel covers, so the forest frames the door above it.
  const box = useRef<HTMLDivElement>(null);
  usePanelCover(() => box.current);
  useEffect(() => {
    (done ? finish : advance).current?.focus();
  }, [shown]);

  const [said, setSaid] = useState('');
  useEffect(() => {
    const line = beats[shown - 1] ?? '';
    setSaid(done ? [words.title, line].filter(Boolean).join('. ') : line);
  }, [shown]);

  return (
    <>
      <WorldFrame number="04" title={header} heading aside={chip} />
      <div class="otp-layer otp-layer--arrive" data-arrive={ending}>
        <div
          ref={box}
          class={`otp-dialogue otp-arrive${done ? ' otp-arrive--done' : ''}`}
          data-beat={shown}
        >
          <div
            class="otp-portrait"
            style={{
              backgroundImage: `url("${assetUrl(`${done ? FACE[ending] : 'portrait-purple'}.png`)}")`,
            }}
            role="img"
            aria-label={done ? words.title : 'Little Purple on the doorstep'}
          />
          <div class="otp-dialogue__text otp-arrive__text">
            <p class="otp-visually-hidden" data-announce="arrive" role="status" aria-live="polite">
              {said}
            </p>
            {/*
              THE PANEL IS ITS FINAL HEIGHT FROM THE FIRST BEAT (Paul's round, 2026-10-22). It used
              to grow a line per beat and grow again for the title, so the box re-laid itself out
              under the reader at every press. Now every line is in the flow from the start, the ones
              not yet said `visibility: hidden` -- which keeps their box and takes them out of the
              accessibility tree, so what a screen reader hears is still the status region above,
              one beat at a time -- and the speaker's eyebrow and the ending's title share one grid
              cell, the title replacing "Purple" on the last beat.
            */}
            <div class="otp-arrive__head">
              <p class="otp-dialogue__speaker" data-shown={done ? 'false' : 'true'}>
                {strings['arriveSpeaker'] ?? ''}
              </p>
              <h2 class="otp-ending__title" data-shown={done ? 'true' : 'false'}>
                {words.title}
              </h2>
            </div>
            <div>
              {beats.map((line, i) => (
                <p
                  key={i}
                  class={`otp-arrive__line${i < shown ? ' otp-arrive__line--reveal' : ''}`}
                  data-shown={i < shown ? 'true' : 'false'}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/*
            BOTH CONTROLS, ONE CELL. The advance ring and the way on share the control cell, the one
            not in use `visibility: hidden` -- which neither focuses nor clicks nor is read -- so the
            cell is the size of the larger from the first beat and the panel never re-lays itself
            out when the last line swaps one for the other.
          */}
          <div class="otp-arrive__control">
            <button
              ref={advance}
              type="button"
              class="otp-advance"
              data-shown={done ? 'false' : 'true'}
              aria-label={strings['arriveNext'] ?? ''}
              onClick={() => setShown((n) => Math.min(beats.length, n + 1))}
            >
              <Caret />
            </button>
            <button
              ref={finish}
              type="button"
              class="otp-button otp-arrive__finish"
              data-shown={done ? 'true' : 'false'}
              data-action="finish"
              onClick={onFinish}
            >
              {(late ? strings['arriveAskLate'] : strings['arriveAsk']) ?? ''}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
