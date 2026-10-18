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
 */
export function Notice({ content, state, notice, onRead, onWalkOn }: NoticeProps) {
  const trapRef = useFocusTrap();
  const [read, setRead] = useState(false);
  // A notice with no hidden instruction has nothing to expose, whoever is reading over your
  // shoulder: the note on Grandma's door is just a note.
  const exposed = trifectaLive(state.verdicts, content) ? notice.whenExposed : undefined;

  if (!read) {
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
            <p class="otp-notice__visible">{notice.visible}</p>
            <div class="otp-actions">
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
            </div>
          </div>
        </Panel>
      </div>
    );
  }

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
          <p class="otp-notice__visible">{notice.visible}</p>
          {exposed ? (
            <>
              {/* The line the player never saw on any card, because it was never on one. */}
              <p class="otp-notice__hidden">{notice.hidden}</p>
              <p class="otp-notice__effect" role="status">
                {exposed.recap}
              </p>
            </>
          ) : (
            <p class="otp-notice__quiet" role="status">
              You read it and walk on. Nothing you are carrying is listening.
            </p>
          )}
          <div class="otp-actions">
            <button type="button" class="otp-button" data-autofocus onClick={onWalkOn}>
              {content.strings['noticeWalkOn'] ?? 'Walk on'}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
