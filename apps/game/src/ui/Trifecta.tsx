import { CAPABILITIES } from '@otp/core';
import type { Capability, Content } from '@otp/core';

export interface TrifectaProps {
  content: Content;
  live: readonly Capability[];
  /** The HUD version is compact; the card version names each capability. */
  compact?: boolean;
  /** Suppress the built-in heading where the surrounding panel already supplies one. */
  hideLabel?: boolean;
  /**
   * How to read the lit state to a screen reader. "running" is the HUD and the card's
   * already-running block; "asked for" is the card's list of what this skill would gain.
   */
  mode?: 'running' | 'asked';
}

/**
 * The three legs of the lethal trifecta. Shown as shape plus letter plus text, never colour alone,
 * and the "all three" state is called out in words as well as in the fill.
 */
export function Trifecta({
  content,
  live,
  compact = false,
  hideLabel = false,
  mode = 'running',
}: TrifectaProps) {
  const all = live.length === CAPABILITIES.length;
  const label = content.strings['trifectaLabel'] ?? '';

  return (
    <div class={`otp-trifecta${compact ? ' otp-trifecta--compact' : ''}`}>
      {!compact && !hideLabel && <p class="otp-trifecta__label">{label}</p>}
      <ul class="otp-trifecta__legs" aria-label={label}>
        {CAPABILITIES.map((id) => {
          const capability = content.capabilities[id];
          if (!capability) return null;
          const on = live.includes(id);
          return (
            <li key={id} class={`otp-leg${on ? ' otp-leg--on' : ''}`} title={capability.label}>
              <span class="otp-leg__mark" aria-hidden="true">
                {capability.mark}
              </span>
              {!compact && (
                <span class="otp-leg__text">
                  <span class="otp-leg__name">{capability.label}</span>
                  <span class="otp-leg__detail">{capability.detail}</span>
                </span>
              )}
              <span class="otp-visually-hidden">
                {capability.label}:{' '}
                {mode === 'asked'
                  ? on
                    ? 'asked for by this skill'
                    : 'not asked for'
                  : on
                    ? 'running'
                    : 'not running'}
              </span>
            </li>
          );
        })}
      </ul>
      {/*
        Never inside the compact form. The compact legs live in the world frame's 44px header, and
        a warning paragraph dropped into that strip pushed the three discs out through the top of
        the frame and hung a dark slab over the forest. In the world the warning is rendered by
        App.tsx as its own line over the canvas instead.

        No `role="status"` on it (UX_REVIEW finding 14). This paragraph only ever exists in a panel
        that has just been mounted with it already inside, and a live region inserted with its text
        is not announced -- it is announced as a MUTATION or not at all. The warning is spoken by
        the permanent region in App.tsx, on the beat it becomes true; here it is ordinary panel
        copy, read when the player reads the panel.
      */}
      {all && !compact && (
        <p class="otp-trifecta__warning">{content.strings['trifectaWarning'] ?? ''}</p>
      )}
    </div>
  );
}
