import { assetUrl } from '../world/assets';
import './hud.css';

/**
 * The v2 HUD: the three-minute clock and the basket, standing in the world's corners
 * (docs/GAME_DESIGN_V2.md sections 7 and 9, PLAN Phase 9 C).
 *
 * WHAT IT IS NOT. It is not wired to anything. It takes the two numbers and the one list it draws
 * and owns no state, no timer and no store: `remainingMs` is somebody else's clock, handed in. That
 * is deliberate, and it is what makes every sentence below testable without a DOM -- `Hud(props)`
 * returns plain vnodes, so `test/hud.test.ts` walks them in vitest's `node` environment, and the
 * thresholds are pure functions of the number.
 *
 * It mounts inside `.otp-world-anchor` (the world's own box, which `ui/stage.ts` publishes), exactly
 * where `HudBasket` stands in v1, and it reuses that basket's pill and slot rules from panels.css
 * rather than inventing a second look for the same object. Only what v1 never had is new, and it
 * lives in hud.css under `.otp-hud2`: the clock and the art placeholder. There is no "limited"
 * marker: v2's verdict is take or leave (the user's decision, 2026-10-22), so a skill in the basket
 * is simply taken.
 *
 * THE CLOCK READS TWO WAYS, ON PURPOSE.
 *
 * To the eye it ticks every second. To a screen reader it must NOT: a live region that changed
 * 180 times in three minutes would drown the one thing the player is trying to hear, which is the
 * person in front of them. So the visible clock is `role="timer"` with `aria-live="off"` (a timer
 * is already off by default; it is spelled out so a future edit that "improves" it has to delete
 * the word), and a SEPARATE visually hidden polite region speaks at 2:00, 1:00, 0:30 and 0:00 and
 * at no other moment.
 *
 * The region's text is DERIVED from the number rather than written when a threshold is crossed:
 * `announcementFor` returns the sentence of the lowest threshold already reached, so it changes
 * exactly four times in a run and holds in between, and a render that comes late, twice or out of
 * order says the same thing. It is always mounted (never conditionally rendered), because a region
 * that arrives already carrying its text is announced by no screen reader -- they announce
 * mutations to a region that was already there (UX_REVIEW finding 14, `e2e/helpers.ts` `tag`).
 *
 * "Under 0:30" is a shape and a weight, never a colour: the clock goes bold and takes the brand's
 * 2px Haze ring. The brand has no red, and a status carried by hue alone is no status for a reader
 * who cannot tell the hues apart (UI_FOUNDATIONS section 5: "carried by shape, bar and words").
 */

/** Seven characters offer a skill, so the basket has seven wells (a player can take all seven). */
export const HUD_SLOTS = 7;

/** Whole seconds left at which the polite region speaks, highest first. */
export const ANNOUNCE_AT_SECONDS = [120, 60, 30, 0] as const;

/** The clock changes shape when fewer than this many seconds are showing. */
export const URGENT_BELOW_SECONDS = 30;

/**
 * Every word the HUD says that is not a skill's name.
 *
 * CLAUDE.md rule 3 puts player-facing words in `content/game.v2.json`'s `strings`. That file has no
 * HUD keys yet, so these are the English defaults and the integrator passes the content's words
 * through `HudProps.labels` once the keys exist; until then they are the one place the words live,
 * so adding keys later moves them and does not find them.
 */
export interface HudLabels {
  /** Accessible name of the clock, and its visible caption where there is room for one. */
  readonly time: string;
  /** Accessible name of the basket, and its visible caption where there is room for one. */
  readonly basket: string;
  readonly twoMinutes: string;
  readonly oneMinute: string;
  readonly thirtySeconds: string;
  readonly timeUp: string;
}

export const DEFAULT_HUD_LABELS: HudLabels = {
  time: 'Time left',
  basket: 'Basket',
  twoMinutes: '2 minutes left',
  oneMinute: '1 minute left',
  thirtySeconds: '30 seconds left',
  timeUp: 'Time is up',
};

export interface HudBasketItem {
  skillId: string;
  name: string;
  /** The asset name without its extension (`item-compass`), or null while the art is awaited. */
  icon: string | null;
}

export interface HudProps {
  /** Milliseconds left on the run. Anything at or below zero, or not a number, reads as 0:00. */
  remainingMs: number;
  basket: ReadonlyArray<HudBasketItem>;
  /** Overrides for `DEFAULT_HUD_LABELS`; anything left out keeps its default. */
  labels?: Partial<HudLabels>;
  /**
   * THE CLOCK WINDING BACK (the Cat's Long Evening, 2026-10-22). While a rewind is being shown,
   * `faceMs` is what the FACE reads -- counting up from the old time to the new one -- and `winding`
   * puts a calm Lilac ring on the pill. The polite region and the urgent shape keep reading
   * `remainingMs`, the true time left, so a screen reader is not told every second the face passes.
   */
  faceMs?: number;
  winding?: boolean;
}

/**
 * Whole seconds on the face, rounded UP.
 *
 * Up, because a countdown that has not finished must not read 0:00: 400ms left is "0:01", and the
 * face says 0:00 only when the run is actually over. It is also what lets every threshold below
 * coincide with what the player can SEE: the announcement for 2:00 starts on the frame the face
 * first reads 2:00, never a second early or late.
 *
 * Negative, zero and non-finite all clamp to 0. A clock that can show "-0:03" or "NaN:NaN" is a
 * bug in the sentence the player trusts most, whoever handed it the number.
 */
export function clockSeconds(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

/** `m:ss`, minutes unpadded, seconds padded: 3:00, 0:09, 0:00. */
export function formatClock(remainingMs: number): string {
  const seconds = clockSeconds(remainingMs);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Whether the face reads fewer than 30 seconds. */
export function isUrgent(remainingMs: number): boolean {
  return clockSeconds(remainingMs) < URGENT_BELOW_SECONDS;
}

const ANNOUNCEMENTS: Readonly<Record<(typeof ANNOUNCE_AT_SECONDS)[number], keyof HudLabels>> = {
  120: 'twoMinutes',
  60: 'oneMinute',
  30: 'thirtySeconds',
  0: 'timeUp',
};

/**
 * What the polite region holds: '' until 2:00, then the sentence of the last threshold reached.
 * It changes four times between 3:00 and 0:00 and at no other moment.
 */
export function announcementFor(
  remainingMs: number,
  labels: HudLabels = DEFAULT_HUD_LABELS,
): string {
  const seconds = clockSeconds(remainingMs);
  const reached = ANNOUNCE_AT_SECONDS.filter((at) => seconds <= at);
  const lowest = reached[reached.length - 1];
  return lowest === undefined ? '' : labels[ANNOUNCEMENTS[lowest]];
}

/**
 * The letters a placeholder wears: the first letter of up to two words ("Way Teller" is "WT"),
 * or the first two letters of one. By code point, so a name that opens on an accented or astral
 * letter is not cut through its middle.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return '?';
  const letters =
    words.length > 1 ? words.slice(0, 2).map((w) => Array.from(w)[0] ?? '') : Array.from(first);
  return letters.slice(0, 2).join('').toUpperCase();
}

/**
 * The bundled URL of an icon, or null when there is none to show.
 *
 * `assetUrl` throws on a name that is not in the bundle, by design, so a missing file fails loudly
 * everywhere art is required. Here the art is allowed to be missing -- until 2026-10-22 four of the
 * seven icons did not exist, and a skill added to the content may name art not yet painted, which
 * nothing may be drawn in place of (CLAUDE.md rule 5) -- and a throw inside a
 * render would blank the whole HUD, clock included. A name that does not resolve is therefore the
 * same case as no name: the labelled placeholder.
 */
export function iconUrl(icon: string | null): string | null {
  if (icon === null) return null;
  try {
    return assetUrl(`${icon}.png`);
  } catch {
    return null;
  }
}

export function Hud({
  remainingMs,
  basket,
  labels: override,
  faceMs = remainingMs,
  winding = false,
}: HudProps) {
  const labels: HudLabels = { ...DEFAULT_HUD_LABELS, ...override };
  const wells = Math.max(HUD_SLOTS, basket.length);
  return (
    <div class="otp-hud2">
      <div
        class="otp-hud2__timer"
        role="timer"
        aria-live="off"
        aria-label={labels.time}
        data-urgent={isUrgent(remainingMs) ? 'true' : 'false'}
        data-winding={winding ? 'true' : 'false'}
      >
        <span class="otp-hud-basket__label otp-hud2__label" aria-hidden="true">
          {labels.time}
        </span>
        <span class="otp-hud2__clock">{formatClock(faceMs)}</span>
      </div>
      <p
        class="otp-visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-hud-announce=""
      >
        {/* Empty is no child at all: preact rewrites an empty text node on every render, which is
            60 silent mutations before 2:00 that e2e/hud.spec.ts counts. */}
        {announcementFor(remainingMs, labels) || null}
      </p>
      <div class="otp-hud-basket otp-hud2__basket" role="group" aria-label={labels.basket}>
        <span class="otp-hud-basket__label otp-hud2__label" aria-hidden="true">
          {labels.basket}
        </span>
        <ul class="otp-hud-basket__slots">
          {Array.from({ length: wells }, (_, i) => {
            const item = basket[i];
            if (!item) {
              return (
                <li
                  class="otp-hud-slot otp-hud-slot--empty otp-hud2__slot"
                  key={`empty-${i}`}
                  aria-hidden="true"
                />
              );
            }
            const url = iconUrl(item.icon);
            return (
              <li class="otp-hud-slot otp-hud2__slot" key={item.skillId} data-skill={item.skillId}>
                {url ? (
                  <img src={url} alt="" />
                ) : (
                  <span class="otp-hud2__placeholder" aria-hidden="true">
                    {initials(item.name)}
                  </span>
                )}
                <span class="otp-visually-hidden">{item.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
