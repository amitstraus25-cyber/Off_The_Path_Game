import { useFocusTrap } from './components';

/*
 * THE SCREEN FOR WHEN THE GAME CANNOT RUN: a failed asset, or a crash.
 *
 * It exists because both used to be silent. A tileset, a map or a sprite that 404ed put up a
 * healthy-looking title and HUD over an empty world with no error and no retry: Phaser's `loaderror`
 * is emitted from inside the loader, the handler THREW from it, and a throw inside an emitter
 * callback is caught by nothing -- no promise, no `try` -- so it reached `window` as an uncaught
 * error that nothing listened for. Reproduced by blocking each asset class in turn: the scene never
 * became ready for the tileset and the map, and became ready WITHOUT Purple for her atlas, and the
 * only evidence anywhere was the browser console. The one other error path, `start().catch` in
 * main.ts, replaced the whole UI with an unstyled sentence of black text.
 *
 * It is one component and one look for both, because a visitor does not care which of the two it
 * was. On brand and nothing else: Black ground, a Shell card, Deep Purple type and rule, one Lime
 * button (the one thing to do), sentence case, no emoji. No red anywhere -- the mark is a purple "!"
 * in a Haze disc, the shape-plus-text status language CLAUDE.md prescribes. And no stack trace, no
 * file name, no error message from the browser: the words are ours, from content/game.json, and
 * what failed goes in `data-failed` where a support person with the inspector can find it and a
 * visitor never sees it.
 *
 * `role="alertdialog"` with focus on the action, because this replaces the screen the visitor was
 * looking at and the only thing they can do is press the button.
 */
export interface ProblemScreenProps {
  title: string;
  body: string;
  /** The one thing to do: the label on the Lime button. */
  action: string;
  onAction(): void;
  /** Which kind of problem this is, for the inspector and for the e2e specs. */
  kind: 'load' | 'crash';
  /** The asset keys that failed, if it was a load. Never shown. */
  failed?: readonly string[];
}

/**
 * An exclamation mark, drawn: Haffer is not asked to supply a glyph for a status mark. Coloured by
 * class from the stylesheet, so the tokens stay the only place a colour is named.
 */
const BangMark = () => (
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
    <circle class="otp-problem__disc" cx="20" cy="20" r="19" />
    <rect class="otp-problem__bang" x="17.5" y="9" width="5" height="15" rx="2.5" />
    <circle class="otp-problem__bang" cx="20" cy="30" r="3" />
  </svg>
);

export function ProblemScreen({ title, body, action, onAction, kind, failed }: ProblemScreenProps) {
  const trap = useFocusTrap();
  return (
    <div
      class="otp-screen otp-problem"
      ref={trap}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="otp-problem-title"
      aria-describedby="otp-problem-body"
      data-problem={kind}
      data-failed={failed && failed.length > 0 ? failed.join(' ') : undefined}
    >
      <div class="otp-problem__card">
        <BangMark />
        <h1 id="otp-problem-title" class="otp-problem__title">
          {title}
        </h1>
        <p id="otp-problem-body" class="otp-problem__body">
          {body}
        </p>
        <button type="button" class="otp-cta otp-problem__action" data-autofocus onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  );
}
