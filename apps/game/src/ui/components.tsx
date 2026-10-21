import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { BASKET_SLOTS } from '@otp/core';
import type { GoalResult } from '@otp/core';
import { assetUrl } from '../world/assets';

export interface PanelProps {
  /** The two-digit numeral in the header ("01", "02"). */
  number: string;
  title: string;
  children: ComponentChildren;
  /**
   * Header right. UI_FOUNDATIONS binding change 7 retired the decorative "•••"; this corner now
   * carries a notation chip, a sound control, or nothing.
   */
  aside?: ComponentChildren;
  /**
   * Whether the title is the panel's heading, as an h2.
   *
   * The three panels that open over the world (the conversation, the card, the post) say it: the
   * frame under them already carries the screen's one h1, so a panel's title is the next level
   * down and the card's own heading (the skill's name) the one after, with nothing skipped.
   * Results leaves it off, because its h1 is the score and a second heading in the header would
   * be a second subject for the page.
   *
   * It is a prop and not always-on so that the visual header is the same element either way: the
   * class carries every pixel of it, and `.otp-panel__title` zeroes the margin the UA gives a
   * heading.
   */
  heading?: boolean;
}

export function Panel({ number, title, children, aside, heading }: PanelProps) {
  const Title = heading ? 'h2' : 'span';
  return (
    <section class="otp-panel">
      <header class="otp-panel__header">
        <span class="otp-panel__number">{number}</span>
        <Title class="otp-panel__title">{title}</Title>
        {aside && <span class="otp-panel__aside">{aside}</span>}
      </header>
      <div class="otp-panel__body">{children}</div>
    </section>
  );
}

/**
 * The official Cyera wordmark, self-hosted and used as-is.
 *
 * The file is a byte-for-byte copy of reference/brand/logos/cyera-logo-white.svg from the Brand
 * Kit, served from the app's own origin so the strict CSP needs nothing beyond `img-src 'self'`.
 * docs/UI_FOUNDATIONS.md, which is now binding, does not restate how the mark is embedded; the
 * superseded BRAND_AND_UI.md section 5 said "inline SVG". This is an <img> at the same vector
 * file instead, which keeps the original proportions and crispness the spec is asking for while
 * avoiding a real bug: the Brand Kit files carry ids (clip0_2322_2323) that go document-global
 * when inlined, so a second mark on the same screen -- the frame header plus the results footer --
 * would resolve its clip-path against the first and render wrong. An <img> also cannot be
 * accidentally recoloured, and no SVG in the document can carry script.
 *
 * White on dark grounds, black on light, per the logo README. Never restyle it beyond height.
 */
export function CyeraMark({ on = 'dark' }: { on?: 'dark' | 'light' }) {
  return (
    <img
      class="otp-mark"
      src={on === 'dark' ? '/brand/cyera-logo-white.svg' : '/brand/cyera-logo-black.svg'}
      alt="Cyera"
    />
  );
}

/** What the sound control calls itself and its two states. Content, so it reads from `strings`. */
export interface MusicLabels {
  /** The control's accessible name. Never changes with the state. */
  name: string;
  on: string;
  off: string;
}

export interface WorldFrameProps {
  number: string;
  title: string;
  aside?: ComponentChildren;
  /** Anything that sits over the world itself, such as the controls hint. */
  children?: ComponentChildren;
  /** Music state and the control for it. Absent on screens that do not carry the frame. */
  music?: { on: boolean; onToggle(): void; labels: MusicLabels };
  /**
   * Whether the frame's title is the page's h1.
   *
   * Only where the frame IS the screen's heading: 04 Arrive. The title card carries its own h1
   * (the wordmark), so its frame leaves this off and the page keeps exactly one. Explore's h1 is
   * NOT the frame's -- it is `ui/App.tsx`'s, for the reason given there, and its frame says so
   * with `labelHidden`.
   */
  heading?: boolean;
  /**
   * That the numeral and the title are drawn but are not read: another element is this screen's
   * heading and says the same word, so a screen reader would otherwise hear "Explore" twice and a
   * bare "01" with nothing to number. The words stay on screen exactly as they were.
   */
  labelHidden?: boolean;
}

/**
 * The numbered frame around the world. It is drawn in the UI layer and anchored to the canvas box
 * that ui/stage.ts publishes, so the world sits inside the same frame as every other screen
 * instead of floating on the page with its quest chip in the window's corner.
 */
export function WorldFrame({
  number,
  title,
  aside,
  children,
  music,
  heading,
  labelHidden,
}: WorldFrameProps) {
  const hidden = labelHidden ? ({ 'aria-hidden': 'true' } as const) : {};
  return (
    <div class="otp-world-frame">
      <header class="otp-panel__header otp-world-frame__header">
        <span class="otp-panel__number" {...hidden}>
          {number}
        </span>
        {heading ? (
          <h1 class="otp-panel__title">{title}</h1>
        ) : (
          <span class="otp-panel__title" {...hidden}>
            {title}
          </span>
        )}
        {aside && <span class="otp-panel__aside otp-hud">{aside}</span>}
        {music && <MusicToggle on={music.on} onToggle={music.onToggle} labels={music.labels} />}
        <CyeraMark />
      </header>
      {children}
    </div>
  );
}

/*
 * A speaker, drawn rather than typed, for the same reason as the verdict glyphs on the skill card:
 * Haffer carries neither U+266A nor U+1F507, so a text glyph falls through to whatever the UA has
 * and lands at a foreign weight and baseline. The off state is a different SHAPE -- a crossed-out
 * cone -- not the same shape in a paler colour.
 */
const SpeakerGlyph = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path d="M3.5 7.5h3L10.5 4v12L6.5 12.5h-3z" fill="currentColor" />
    {on ? (
      <path
        d="M13 7.6a3.6 3.6 0 010 4.8M15.4 5.4a7 7 0 010 9.2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    ) : (
      <path
        d="M12.8 7.2l5 5.6M17.8 7.2l-5 5.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    )}
  </svg>
);

/**
 * The music control. Sound is off until this is pressed: the game embeds in an iframe on the
 * research page, and audio that starts by itself in someone else's page is how an embed gets
 * pulled.
 *
 * UX_REVIEW finding 10. Three things here are the finding, and one of them is not in this file:
 *
 *  - **It says which state it is in, in a word.** UI_FOUNDATIONS section 5 specifies "a labelled
 *    speaker toggle" and "status is carried by shape, bar and words"; this control carried its
 *    state in a colour and a one-character difference between two music notes, with the only word
 *    hidden from everyone who can see. The word is `aria-hidden` because `aria-checked` already
 *    tells a screen reader the state -- and because a switch whose accessible NAME moves with its
 *    state is announced as a different control every time it is pressed.
 *  - **It answers the keyboard.** `world/input.ts` preventDefaults Space and Enter whenever the
 *    world owns the keyboard -- precisely when this control is on screen -- and raises
 *    `interactPressed` before it does, so Space on the focused toggle opened an encounter and left
 *    the switch alone. It is the only focusable control on Explore, so the one thing a keyboard
 *    player could reach was the one thing they could not operate. The keys the button itself uses
 *    therefore stop here instead of reaching the window listener. Esc and the arrows are let
 *    through: walking away from a focused toggle must still walk.
 *  - **Its off state is still Stone `#787771` at 4.26:1 on Black**, which breaks section 7 change 4
 *    (Stone replaced by Ash below 24px), section 1 (Stone is foreground only and does not appear in
 *    this UI) and WCAG at Level A -- and it is still set in Arial, because no `font-family` is
 *    declared and the UA's `button` default beats inheritance. Both live in `panels.css`, which
 *    this round belongs to someone else: see the notes with this change for the two lines.
 */
export function MusicToggle({
  on,
  onToggle,
  labels,
}: {
  on: boolean;
  onToggle(): void;
  labels: MusicLabels;
}) {
  return (
    <button
      type="button"
      class="otp-music"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
      }}
      title={`${labels.name}: ${on ? labels.on : labels.off}`}
    >
      {/*
        One grid item, not two: `.otp-music` is `display: grid; place-items: center`, so a second
        visible child would open a second row and push the control out through a header whose
        height ui/stage.ts has already reserved to the pixel.
      */}
      <span class="otp-music__face" aria-hidden="true">
        <SpeakerGlyph on={on} /> <span class="otp-music__state">{on ? labels.on : labels.off}</span>
      </span>
      <span class="otp-visually-hidden">{labels.name}</span>
    </button>
  );
}

/** Long enough to watch something lift out of a slot, short enough not to delay the walk. */
const LEAVE_MS = 340;
const ARRIVE_MS = 300;

export interface HudBasketProps {
  basket: readonly string[];
  items: Readonly<Record<string, string>>;
  label: string;
}

/**
 * The basket, permanently in the world's HUD.
 *
 * Losing the cottage key and losing Grandma's letter are the two consequences the whole game turns
 * on, and until now neither was ever visible: the only basket was on the Inspect panel, which
 * unmounts in the same tick as the verdict, so the single piece of feedback was a line of text
 * reading "Allowed: Cottage Finder". Here the player watches the item leave.
 *
 * A removal shifts every later item down an index, so the row would jump before the departure
 * could be seen. Instead the previous row is held until the leave animation finishes, then the
 * new one is shown — you see the key lift out of its slot, and only then does the row settle.
 */
export function HudBasket({ basket, items, label }: HudBasketProps) {
  const [shown, setShown] = useState<readonly string[]>(basket);
  const [leaving, setLeaving] = useState<readonly string[]>([]);
  const [arriving, setArriving] = useState<readonly string[]>([]);

  useEffect(() => {
    if (shown === basket) return undefined;
    const gone = shown.filter((i) => !basket.includes(i));
    const added = basket.filter((i) => !shown.includes(i));

    if (gone.length === 0) {
      setShown(basket);
      if (added.length === 0) return undefined;
      setArriving(added);
      const t = setTimeout(() => setArriving([]), ARRIVE_MS);
      return () => clearTimeout(t);
    }

    setLeaving(gone);
    const t = setTimeout(() => {
      setLeaving([]);
      setShown(basket);
      setArriving(added);
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [basket, shown]);

  return (
    <div
      class={`otp-hud-basket${leaving.length > 0 ? ' otp-hud-basket--jolt' : ''}`}
      role="group"
      aria-label={label}
    >
      <span class="otp-hud-basket__label" aria-hidden="true">
        {label}
      </span>
      <ul class="otp-hud-basket__slots">
        {Array.from({ length: BASKET_SLOTS }, (_, i) => {
          const item = shown[i];
          const icon = item ? items[item] : undefined;
          const state = item && leaving.includes(item) ? ' otp-hud-slot--leaving' : '';
          const entering = item && arriving.includes(item) ? ' otp-hud-slot--arriving' : '';
          return (
            <li
              class={`otp-hud-slot${item ? '' : ' otp-hud-slot--empty'}${state}${entering}`}
              key={item ?? `empty-${i}`}
            >
              {icon && <img src={assetUrl(`${icon}.png`)} alt={item!} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface HudGoalsProps {
  goals: readonly GoalResult[];
  heading: string;
}

/**
 * Where the errand goals are a drop-down rather than a standing panel.
 *
 * It is the pad's own condition, inverted. `ui/tokens.css` draws the on-screen pad for everyone
 * except `(pointer: fine) and (hover: hover)`, and `panels.css` already argues from exactly that
 * test twice: `.otp-world-hint` hides where there is no keyboard line to read, and the errand
 * goals come back inside the world "wherever the pad is on screen at all". So the rule here is the
 * same one sentence -- wherever the pad is on screen, the world is small enough that a standing
 * panel is not affordable -- rather than a third, separately-tuned idea of what a phone is.
 *
 * Deliberately NOT `and (orientation: portrait)`. Measured on the built game, the box's share of
 * the visible world is worse in landscape than in portrait (36.0% at 568x320 against 16.5% at
 * 375x812), because a landscape phone's world is a 250px band. Both orientations get the drop.
 *
 * A touch TABLET matches this too, where the world is big and the panel was never in the way. That
 * is accepted on purpose: one condition that is true wherever the pad is, rather than a height
 * threshold that a new device lands the wrong side of. A disclosure costs a tablet one tap; a
 * second media query costs the next round another argument about which phone is the short one.
 *
 * With no `matchMedia` -- a test renderer, or a server -- it answers "no drop", which keeps the
 * panel exactly as it ships today. That is the conservative end: a renderer may then be judged for
 * a panel that is too big, but it can never render a disclosure that nothing can open.
 */
export const GOALS_DROP_QUERY = '(hover: none)';

/**
 * The same question, asked continuously.
 *
 * `hover` describes the machine and a machine does not change mid-screen -- which is the argument
 * `Title.padIsHidden` makes for matching per render -- but a DEVICE EMULATOR changes it, and so
 * does a desktop browser's responsive mode, which is what every review of this screen is done in.
 * `useFrameMarkHidden` already pays for a listener for the same reason. One more costs nothing and
 * means the panel a reviewer sees is the panel a player gets.
 */
function useGoalsDrop(): boolean {
  const [drop, setDrop] = useState(
    () => typeof matchMedia === 'function' && matchMedia(GOALS_DROP_QUERY).matches,
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(GOALS_DROP_QUERY);
    const sync = (): void => setDrop(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return drop;
}

/**
 * Enter and Space on the bar, because in the world the browser's own button activation does not
 * survive to the click.
 *
 * `world/input.ts` listens for keydown on the WINDOW and calls `preventDefault()` on Space, Enter
 * and KeyE whenever the world owns the keyboard, which in Explore it always does -- that is how
 * Space talks to a traveller without also scrolling the page. A button's activation is a DEFAULT
 * ACTION, performed after the event has finished propagating, so a `preventDefault` four frames
 * later at the window cancels it: measured on the built game, Tab reached this bar in one hop with
 * the focus ring drawn correctly, and Enter and Space then did nothing at all. Tapping it worked,
 * which is exactly the shape of bug a touch review never finds.
 *
 * So the bar takes the two keys out of the air before the window can see them. `stopPropagation`
 * alone is the whole fix -- the window listener never runs, so nothing calls `preventDefault`, so
 * the browser's own activation goes ahead and the `onClick` fires exactly once. It also means that
 * pressing Enter on the goals cannot additionally interact with whoever Purple is standing next to.
 *
 * THE MUSIC TOGGLE IN THIS FILE ALREADY DOES THIS, five hundred lines up and in the same three
 * lines; it is not a new trick, it is the house answer for a control that sits over the world
 * while the world owns the keyboard. Every such control needs it, so it is written once here and
 * used by both. The gate itself (`main.ts worldHasInput`) is phase-based and knows nothing about
 * where focus is -- the handover note proposes what a general repair would look like.
 */
function onToggleKey(): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  };
}

/** The rows, which are the same list whether they stand open or drop down. */
function goalRows(goals: readonly GoalResult[]) {
  return goals.map((g) => (
    <li class={`otp-hud-goal${g.met ? ' otp-hud-goal--met' : ''}`} key={g.id}>
      <span class="otp-hud-goal__mark" aria-hidden="true">
        {g.met ? '✓' : '·'}
      </span>
      <span>{g.label}</span>
      <span class="otp-visually-hidden">{g.met ? ' — done' : ' — not yet'}</span>
    </li>
  ));
}

/**
 * What Grandma actually asked for, in the HUD for the whole walk.
 *
 * Without this the errand goals are invisible: the player is being scored on a trade -- capability
 * against risk -- that the game never showed them. Each row states "done" or "not yet" in words as
 * well as by the mark, because no status in this game is carried by colour alone.
 *
 * `role="group"` carries the heading to a screen reader (UX_REVIEW finding 21): a div with an
 * aria-label and no role is not exposed as anything, so three of Grandma's sentences sat in the
 * middle of the world with nothing saying what they were. Same for the basket above.
 *
 * ON A TOUCH SCREEN IT IS A DISCLOSURE, because the standing panel does not fit. Measured on the
 * built game at 375x812 the box is 348.4x93.1 -- 94.7% of the world's WIDTH and 17.4% of its
 * height, 16.5% of the visible world by area, and 22.2% at 320x568 -- sitting across the top of a
 * world that is only 16.7 tiles tall to begin with.
 *
 * It cannot be answered by shrinking the type, and that is the whole reason this is a disclosure
 * rather than "a bit smaller": `--otp-ui` is 0.7 on a phone, so the stylesheet's FLOOR RULE has
 * every line in this box already AT its floor -- the label at max(11px, 11px x 0.7) = 11 and each
 * goal at max(12px, 13px x 0.7) = 12. There is no smaller legal size. The only thing left to give
 * back is the rows themselves, so they go behind a bar that keeps the heading and the three marks
 * on screen the whole time and opens on a tap.
 *
 * Collapsed is the default, and it RESETS to collapsed at every encounter without being told to:
 * `App.tsx` mounts this inside `.otp-world-anchor` only while the phase is in-world, so stepping
 * into 02 Question unmounts it and walking back out mounts it closed. The goals are reference the
 * player needs twice, not continuous reading, and the marks say how many are done without opening
 * anything.
 */
export function HudGoals({ goals, heading }: HudGoalsProps) {
  const drop = useGoalsDrop();
  const [open, setOpen] = useState(false);

  if (!drop) {
    return (
      <div class="otp-hud-goals" role="group" aria-label={heading}>
        <span class="otp-hud-goals__label" aria-hidden="true">
          {heading}
        </span>
        <ul class="otp-hud-goals__list">{goalRows(goals)}</ul>
      </div>
    );
  }

  /*
   * No `role="group"` and no `aria-label` on the wrapper here, unlike the standing panel above.
   * The button IS the heading -- its accessible name is the same string -- so a group named with
   * it as well would announce "Grandma asked for, group" and then "Grandma asked for, collapsed,
   * button" on the way in. A disclosure names itself; the standing panel has nothing that can.
   *
   * No new content key is read for the button: the project's string guard fails the build on a key
   * the UI reads and content/game.json lacks, and the state a toggle has to say out loud -- open or
   * closed -- is what `aria-expanded` is for, in the screen reader's own words rather than ours.
   */
  return (
    <div class="otp-hud-goals otp-hud-goals--drop">
      <button
        type="button"
        class="otp-hud-goals__summary"
        aria-expanded={open}
        aria-controls="otp-hud-goals-list"
        onClick={() => setOpen((was) => !was)}
        onKeyDown={onToggleKey()}
      >
        <span class="otp-hud-goals__label">{heading}</span>
        {/* The progress stays on screen while the rows are away: three marks, same glyphs as the
            rows use, so "how many are done" never costs a tap. Hidden from a screen reader because
            "✓ · ·" with no labels beside it is not a sentence -- `aria-expanded` and the rows
            themselves carry that for AT. */}
        <span class="otp-hud-goals__marks" aria-hidden="true">
          {goals.map((g) => (
            <span
              class={`otp-hud-goals__mark${g.met ? ' otp-hud-goals__mark--met' : ''}`}
              key={g.id}
            >
              {g.met ? '✓' : '·'}
            </span>
          ))}
        </span>
        <span class="otp-hud-goals__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      <ul id="otp-hud-goals-list" class="otp-hud-goals__list" hidden={!open}>
        {goalRows(goals)}
      </ul>
    </div>
  );
}

export interface HighlightedProps {
  text: string;
  /**
   * The one word set in Season Mix. The brand allows exactly one highlighted word per heading,
   * and it is always upright — the brand book is explicit that Season Mix is never italic.
   * Optional, so a heading with no highlight can use the same component.
   */
  word?: string;
}

/**
 * Splits a heading so exactly one word renders in Season Mix (UI_FOUNDATIONS section 3). Lives
 * here rather than in Title.tsx, which three other screens were importing it from.
 */
export function Highlighted({ text, word }: HighlightedProps) {
  const index = word ? text.lastIndexOf(word) : -1;
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span class="otp-serif">{text.slice(index, index + word!.length)}</span>
      {text.slice(index + word!.length)}
    </>
  );
}

export interface NotationChipProps {
  label: string;
  /** The muted count at the right, e.g. "0 of 3 skills seen". */
  count?: string;
}

/** The chip that sits at the header right: Lilac dot, label, then a muted count. */
export function NotationChip({ label, count }: NotationChipProps) {
  return (
    <p class="otp-chip">
      <span class="otp-chip__dot" aria-hidden="true" />
      <span class="otp-chip__label">{label}</span>
      {count && <span class="otp-chip__count">{count}</span>}
    </p>
  );
}

/*
 * `SoundToggle` lived here: a second, unused sound control drawn with the 🔊/🔇 emoji, which is a
 * colour font no brand owns and a typeface UI_FOUNDATIONS does not list. Nothing rendered it --
 * `MusicToggle` above is the shipped control -- and leaving a second one in the file is how the
 * next person fixes the wrong one. The labelled-control requirement it was written for
 * (UI_FOUNDATIONS binding change 7) is met by `MusicToggle`.
 */

/**
 * How long after a modal panel mounts a POINTER activation inside it is read as the tail of the
 * click that opened the panel rather than as an answer to it.
 *
 * It covers `--otp-motion-slow` (180ms, the `otp-panel-in` slide) with enough margin either side
 * for the frame the panel paints on and for a platform double-click that straddles it. It is
 * deliberately under the ~500ms interval every platform calls a double-click: the point is to
 * discard a stray second half, not to make a player who already knows the card wait.
 */
const MOUNT_SETTLE_MS = 300;

/**
 * How far the pointer must travel between opening a panel and clicking inside it before the click
 * counts as aimed rather than left over.
 *
 * The panel moves 8px under the hand (`otp-panel-in`), so the hand has to have moved further than
 * the panel did. It is also twice the 4px of slop every platform allows inside a double-click, so
 * a hand that merely trembles between the two presses is still treated as still.
 */
const POINTER_SLOP_PX = 8;

/**
 * Whether an activation inside a freshly mounted modal panel is one the player meant.
 *
 * Pure, and exported so test/modal-guard.test.ts can hold the rule without a browser. THREE
 * things make an activation deliberate, and only the last of them is about time.
 *
 * `detail` is the click's count: 0 for a keyboard Enter or Space, for `element.click()`, and for
 * every assistive-technology activation, because none of them has a pointer. Those can never be
 * the second half of a double-click -- there was no first half at a screen position -- so they are
 * always honoured. Gating them too would be a far worse bug than the one this fixes: a switch
 * player would press Allow and watch nothing happen.
 *
 * `pointerMovedPx` is the distance from where the pointer stood when this panel appeared. The
 * defect is a panel moving under a hand that did not, so a hand that DID move has aimed at what it
 * hit and is never second-guessed, however fresh the panel is. Measured: the double-click defect
 * travels 0px, while a player going from "Show me the skill" to Restrict travels 133px at
 * 1280x800 and gets there in as little as 46ms -- comfortably inside the window below, and an
 * answer every time. Without this clause the guard refuses that player, and e2e/ui.spec.ts's
 * "a verdict updates the basket and returns to the world" is the proof: it fails on age alone.
 *
 * `sinceMountMs` is the last word, for the stationary pointer: too fresh to be an answer.
 */
export function activationIsDeliberate(
  detail: number,
  sinceMountMs: number,
  pointerMovedPx: number,
): boolean {
  if (detail === 0) return true;
  if (pointerMovedPx > POINTER_SLOP_PX) return true;
  return sinceMountMs >= MOUNT_SETTLE_MS;
}

/*
 * Where the pointer is, which a panel cannot ask for at the moment it mounts.
 *
 * The one fact the guard above turns on -- did the hand move between opening this panel and
 * clicking in it? -- is about an instant that has already passed by the time the panel exists: the
 * click that opened it. Nothing in the DOM remembers it, so this does, in two numbers, for the
 * life of the document. `NaN` until a pointer is first seen, which makes every distance computed
 * from it `NaN` and every comparison with it false, so a session that has only ever used the
 * keyboard falls back to the age rule and nothing here has to special-case it.
 *
 * Capturing and passive: it can neither be stopped by a handler below it nor delay a scroll, and
 * it writes two numbers per move and allocates nothing, which is what keeps it off the game loop.
 */
let pointerX = Number.NaN;
let pointerY = Number.NaN;
const trackPointer = (e: PointerEvent): void => {
  pointerX = e.clientX;
  pointerY = e.clientY;
};
if (typeof document !== 'undefined') {
  const how = { capture: true, passive: true } as const;
  document.addEventListener('pointermove', trackPointer, how);
  document.addEventListener('pointerdown', trackPointer, how);
}

/**
 * The ref a modal panel puts on its layer, plus the one question a control inside it may ask.
 *
 * It is the ref object itself rather than a `{ ref, ... }` pair so that `ref={trap}` keeps working
 * in the two panels that want nothing but the trap (Dialogue, Notice).
 */
export interface FocusTrapRef {
  current: HTMLDivElement | null;
  /**
   * True when `event` is an answer and not the leftover second click of the double-click that
   * mounted this panel. Only controls that COMMIT something irreversible need to ask.
   */
  deliberate(event: { detail: number; clientX: number; clientY: number }): boolean;
}

/**
 * Keeps focus inside a modal panel, so a verdict can never be skipped by tabbing past the card.
 *
 * `onClose` is Esc for panels the reducer cannot hear it on. BACK is dispatched globally by
 * `world/input.ts`, but the reducer handles it in the `dialogue` and `inspect` phases only -- and a
 * notice is a DOM panel that leaves the phase on `explore`, so the one `aria-modal` panel where Esc
 * must close was the one panel where it did nothing (UX_REVIEW finding 14). A panel that passes
 * `onClose` closes itself here and stops the key, so it can never be handled twice.
 *
 * Esc listens on the document and Tab on the panel, which is not a stylistic difference. Tab is
 * only interesting while focus is inside the panel -- that is what it moves. Esc has to work
 * wherever focus happens to be: focus can sit on the body for the frame between the panel painting
 * and this effect running, and the canvas takes focus on any pointer press, so a close bound to the
 * panel is a close that silently does nothing some of the time. The first version of this was, and
 * the test for it failed one run in three.
 */
export function useFocusTrap(onClose?: () => void): FocusTrapRef {
  /*
   * When this panel appeared, which is one frame after the click that opened it. `useRef` keeps
   * the value from the first render, so this is the mount and not the latest re-render -- the
   * argument is evaluated every render but only the first result is stored.
   */
  const mountedAt = useRef(performance.now());
  // Where the hand was when this panel appeared, for the same reason and with the same rule: the
  // first render's value is the one kept, and that render is the panel arriving.
  const openedX = useRef(pointerX);
  const openedY = useRef(pointerY);
  const trap = useRef<FocusTrapRef>({
    current: null,
    deliberate: (event) =>
      activationIsDeliberate(
        event.detail,
        performance.now() - mountedAt.current,
        Math.hypot(event.clientX - openedX.current, event.clientY - openedY.current),
      ),
  });
  const ref = trap.current;
  // The handler below is bound once; this keeps it pointing at the current callback.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = (): HTMLElement[] =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
    (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0])?.focus();

    const onEscape = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || !close.current) return;
      e.preventDefault();
      // Stops before the window listener in world/input.ts, so one Esc closes one layer.
      e.stopPropagation();
      close.current();
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      /*
       * Where focus sits in this panel's tab order, or -1 for the autofocus target.
       *
       * -1 is the case the trap used to leak through, and it is the case every modal panel OPENS
       * in. The thing `[data-autofocus]` points at is a `tabindex="-1"` box on two of the three
       * panels -- `.otp-card`, `.otp-dialogue__text` -- so that focus lands on the card being read
       * rather than pre-selecting Allow. `focusable()` deliberately excludes `tabindex="-1"`,
       * because it must not become a tab stop, which left `activeElement` equal to neither `first`
       * nor `last`: the very first Shift+Tab matched no branch and the browser walked focus out of
       * the dialog to the music toggle in the world frame behind it. The second one reached the
       * body, with an `aria-modal` panel still on screen and nothing to tab back into.
       *
       * It is an ancestor of every item here, so in tab order it comes BEFORE the first of them:
       * Shift+Tab wraps to the last, and a plain Tab needs no help, since the browser's own next
       * stop from a container is the first tabbable inside it.
       */
      const at = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (at === 0 || at === -1)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === items.length - 1) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keydown', onEscape);
      previous?.focus?.();
    };
  }, []);

  return ref;
}
