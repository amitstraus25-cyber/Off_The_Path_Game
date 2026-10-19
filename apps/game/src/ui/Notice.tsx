import { useState } from 'preact/hooks';
import { trifectaLive } from '@otp/core';
import type { Content, GameState, Notice as NoticeData } from '@otp/core';
import { Panel, useFocusTrap } from './components';

export interface NoticeProps {
  content: Content;
  state: GameState;
  notice: NoticeData;
  onRead(): void;
  onWalkOn(): void;
}

/**
 * A post by the path with words on it. The words are the same whoever walks past. What changes is
 * whether anything Red is carrying can read them aloud, see what she holds, and send word out.
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
  const trapRef = useFocusTrap(onWalkOn);
  const [read, setRead] = useState(false);
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
          <div class="otp-actions">
            {read ? (
              <button type="button" class="otp-button" data-autofocus onClick={onWalkOn}>
                {content.strings['noticeWalkOn'] ?? 'Walk on'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  class="otp-button"
                  data-autofocus
                  onClick={() => {
                    setRead(true);
                    onRead();
                  }}
                >
                  {content.strings['noticeRead'] ?? 'Read the notice'}
                </button>
                <button type="button" class="otp-button otp-button--quiet" onClick={onWalkOn}>
                  {content.strings['noticeWalkOn'] ?? 'Walk on'}
                </button>
              </>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
