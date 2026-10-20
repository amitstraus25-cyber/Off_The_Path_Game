import { useEffect, useRef, useState } from 'preact/hooks';
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

  /*
   * The arrival takes focus, which every other panel in this game already did and this one did not.
   *
   * Measured on the built page at 1280x800, entering the phase by walking there with the keyboard:
   * `document.activeElement` was BODY. The canvas is not focusable (no tabindex), so play leaves
   * focus on the body, and nothing here moved it. A screen reader was therefore never told it had
   * landed anywhere, and the single control that advances the payoff -- one `.otp-advance` button
   * in the whole layer -- had to be found with a blind Tab.
   *
   * `Results` is the precedent rather than `Dialogue`, because this is the same shape as Results:
   * a whole screen, not a modal. There is nothing behind this layer to tab into and nothing to seal
   * off -- measured on an iPhone 13 at the arrival, the touch pad is not on screen (`Walk up` is not
   * in the document and `Talk or interact` has no box), and the world frame above is chrome. So no
   * `useFocusTrap`: it exists to stop a verdict being tabbed past, this panel has no verdict, and
   * it would restore focus on unmount to what it found, which here is the body.
   *
   * A ref and an effect, then, as Results does, with `data-autofocus` carried as well. The
   * attribute is this project's marker for "this is the thing that takes focus", it is what the
   * a11y specs query, and `panels.css` keys the suppressed focus ring off
   * `[tabindex='-1'][data-autofocus]` -- without it the arrival would paint the purple band round
   * the text that was twice reported as a rendering fault. Measured after the fix: the ring
   * computes to `none none`, one Tab reaches "Go on" with nothing in between, and three Enters
   * carry a keyboard-only player through every beat to "Step inside".
   */
  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    text.current?.focus();
  }, []);

  /*
   * What the arrival says out loud, in a region that is born empty and then mutated.
   *
   * A live region inserted into the DOM already containing its text is announced by nobody: screen
   * readers announce MUTATIONS to a region that was already there. That is the shape `Notice`,
   * `App` and the a11y specs all document, and the arrival was the last place still getting it
   * wrong. Measured on the built page: the `aria-live` wrapper arrived with the first approach line
   * already inside it, so the sentence that opens the payoff reached nobody, while beats two
   * onwards -- real mutations of a node that was by then on screen -- were announced normally.
   *
   * The speaking is split from the showing rather than emptying the visible block and filling it in
   * an effect, because the visible block cannot start empty. `.otp-layer--arrive` docks the box at
   * the bottom and the text is centred in it: measured at 1280x800, each line added moves the
   * sentences up by 19.1px (first line top 686.8 -> 667.7 -> 648.5). Mounting with nothing and
   * appending a line one frame later would put a 19px jump on the first frame of the climax, which
   * is the defect class this round has already fixed four times.
   *
   * It also carries the ending title, which is the one sentence the whole run was for. The title is
   * an `<h2>` sibling outside the old region, so it was never announced at all; it stays exactly
   * where it is visually -- `e2e/game.spec.ts` asserts it is hidden before the beats are done and
   * reads its text after -- and is spoken from here instead, joined to the beat it lands with so
   * one event is one announcement.
   *
   * The latest beat is duplicated between this and the paragraph below it, as `Notice`'s recap is.
   * That is a sentence read twice by a virtual cursor, against the whole approach going unread; the
   * visible prose stays in the accessibility tree so the player can go back over it.
   */
  const [said, setSaid] = useState('');
  useEffect(() => {
    const line = beats[shown - 1]?.line ?? '';
    setSaid(done ? [chosen.title, line].filter(Boolean).join('. ') : line);
  }, [shown]);

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
          <div class="otp-dialogue__text otp-arrive__text" ref={text} tabIndex={-1} data-autofocus>
            {/*
              Empty on the first render, filled by the effect above. Visually hidden and out of
              flow, so it cannot move a single pixel of the box it sits in.
            */}
            <p class="otp-visually-hidden" data-announce="arrive" role="status" aria-live="polite">
              {said}
            </p>
            {done && <h2 class="otp-ending__title">{chosen.title}</h2>}
            {/*
              Not a live region any more. It was one, and it announced every beat except the first;
              leaving it live alongside the region above would announce beats two onwards twice.
            */}
            <div>
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
