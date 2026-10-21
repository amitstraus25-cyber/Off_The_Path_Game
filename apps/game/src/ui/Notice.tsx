import { useRef, useState } from 'preact/hooks';
import { trifectaLive } from '@otp/core';
import type { Content, GameState, Notice as NoticeData } from '@otp/core';
import { Panel, useFocusTrap } from './components';

/**
 * How the post was closed, because the two are not the same answer.
 *
 * `walked-on` is the player deciding against it, and `main.ts` records that so the post does not
 * ask again on the spot. `escaped` is the reflex every other panel in this game teaches -- Esc
 * backs out of the card and out of the conversation -- and a reflex must not spend something the
 * run is scored on. Esc used to be handed straight to `onWalkOn`, so it did.
 */
export type NoticeClose = 'walked-on' | 'escaped';

export interface NoticeProps {
  content: Content;
  state: GameState;
  notice: NoticeData;
  onRead(): void;
  /** Closes the panel. The reason decides whether the post is counted as waved away. */
  onWalkOn(how?: NoticeClose): void;
}

/**
 * A post by the path with words on it. The words are the same whoever walks past. What changes is
 * whether anything Purple is carrying can read them aloud, see what she holds, and send word out.
 * Nothing on any skill card warned about this, which is the point.
 *
 * One panel in two states, rather than two panels (UX_REVIEW finding 14). The announcement of what
 * the notice just did has to be in the DOM BEFORE it has anything to say: a live region inserted
 * already containing its text is not announced at all, because screen readers announce mutations to
 * a region that was already there. Pressing "Read the notice" used to insert the recap -- the
 * strongest sentence in the product -- as a brand new `role="status"` paragraph, so it reached
 * nobody. It is now a region that exists, empty, from the moment the post opens.
 */
export function Notice({ content, state, notice, onRead, onWalkOn }: NoticeProps) {
  const trapRef = useFocusTrap(() => onWalkOn('escaped'));
  const [read, setRead] = useState(false);
  // Where focus goes the instant "Read the notice" stops being focusable. See the actions below.
  const walkOnRef = useRef<HTMLButtonElement>(null);
  // A notice with no hidden instruction has nothing to expose, whoever is reading over your
  // shoulder: the note on Grandma's door is just a note.
  const exposed = trifectaLive(state.verdicts, content) ? notice.whenExposed : undefined;
  const quiet =
    content.strings['noticeQuiet'] ??
    'You read it and walk on. Nothing you are carrying is listening.';

  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={notice.title}
      /*
       * The floor under focus, and the other half of the double-click fix.
       *
       * A press on a control that cannot take focus does not leave focus where it was: the
       * browser walks up from what was hit looking for something focusable, and with nothing in
       * the way it lands on `document.body` -- outside an `aria-modal` dialog, where the Tab
       * cycle this panel owns no longer applies. The second click of a double hits "Read the
       * notice" the instant it goes disabled, so disabling the button alone still measured BODY.
       * `tabindex="-1"` makes the dialog itself that something: not reachable by Tab, which is
       * the point, but a place for focus to rest inside the panel. `useFocusTrap` is unaffected,
       * since it only ever queries DESCENDANTS and already excludes `tabindex="-1"`.
       */
      tabIndex={-1}
    >
      <Panel number="--" title={notice.title}>
        <div class="otp-notice">
          {/*
            Empty until the post is read, then mutated -- which is the only form of this that is
            ever spoken. Visually hidden because the same words are on the panel below, where they
            belong; this is the announcement, not a second copy of the writing.
          */}
          <p class="otp-visually-hidden" data-announce="notice" role="status" aria-live="polite">
            {read ? (exposed ? exposed.recap : quiet) : ''}
          </p>
          <p class="otp-notice__visible">{notice.visible}</p>
          {read &&
            (exposed ? (
              <>
                {/* The line the player never saw on any card, because it was never on one. */}
                <p class="otp-notice__hidden">{notice.hidden}</p>
                <p class="otp-notice__effect">{exposed.recap}</p>
              </>
            ) : (
              <p class="otp-notice__quiet">{quiet}</p>
            ))}
          {/*
            BOTH CONTROLS STAY MOUNTED, and reading disables the one it spends.

            This row used to collapse from two buttons to one on the press, and the survivor --
            Walk on -- landed at the pixel the press had just happened on. A double-click
            therefore read the post and walked away from it in one gesture, which on a trackpad
            is not a deliberate act; measured on the built page, one `dblclick` on Read left the
            panel gone and `read` already containing the post. The same press destroyed the node
            focus was on, so focus fell to `document.body`, outside an `aria-modal` dialog, where
            neither Tab nor Esc belongs to the panel any more -- measured as BODY.

            `disabled` rather than unmounted: the row keeps its shape, the second click of a
            double lands on a button that does not answer, and `useFocusTrap`'s
            `button:not([disabled])` drops it from the Tab cycle on its own. A disabled
            `.otp-button` is already shipped on the Results form, so it needs no new styling --
            though it also gets no dimming, which is a `screens.css` line this task cannot write.

            The two swap emphasis instead, so the panel still carries exactly one solid button and
            it is always the live one: that is what the collapsing row got right, and the only
            thing worth keeping from it.
          */}
          <div class="otp-actions">
            <button
              type="button"
              class={`otp-button${read ? ' otp-button--quiet' : ''}`}
              disabled={read}
              data-autofocus={read ? undefined : true}
              onClick={() => {
                setRead(true);
                onRead();
                /*
                 * Before the re-render, not after: this button is about to go disabled, and a
                 * disabled element that holds focus drops it to the body rather than passing it
                 * on. Moving focus first means there is nothing to drop. The node is already
                 * mounted, which is the whole point of the change above.
                 */
                walkOnRef.current?.focus();
              }}
            >
              {content.strings['noticeRead'] ?? 'Read the notice'}
            </button>
            <button
              type="button"
              class={`otp-button${read ? '' : ' otp-button--quiet'}`}
              ref={walkOnRef}
              data-autofocus={read ? true : undefined}
              onClick={() => onWalkOn('walked-on')}
            >
              {content.strings['noticeWalkOn'] ?? 'Walk on'}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
