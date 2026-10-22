import type { v2 } from '@otp/core';
import { iconUrl, initials } from './Hud';

/*
 * The two answer glyphs are drawn, not typed: Haffer does not carry U+2713 or U+2715, so a text
 * glyph falls through to another family at another weight (UI_FOUNDATIONS section 5). Sized in
 * `em` so they track --otp-ui. The two pills are otherwise identical: no fill, no colour
 * difference, and no Lime (UI_FOUNDATIONS section 2 -- a verdict is not a call to action).
 */
export const TakeGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M4 10.5l4 4 8-9"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

export const LeaveGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M5 5l10 10M15 5L5 15"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
);

/**
 * A skill's icon, or its labelled placeholder while the art is awaited: an icon that does not exist
 * is not drawn in its place (CLAUDE.md rule 5). The same placeholder the HUD's basket wears
 * (initials on Natural), so a missing icon reads the same everywhere.
 */
export function SkillIcon({ skill }: { skill: v2.Skill }) {
  const url = iconUrl(skill.icon);
  return url ? (
    <img src={url} alt="" />
  ) : (
    <span class="otp-icon-placeholder" aria-hidden="true">
      {initials(skill.name)}
    </span>
  );
}

export interface SkillCardProps {
  /** The card's two row eyebrows (`ui.card`). */
  words: v2.Content['ui']['card'];
  skill: v2.Skill;
  /** The variant THIS run dealt. The good and bad cards differ by exactly one take line. */
  card: v2.Variant['card'];
}

/**
 * The card: the skill's picture, its name and promise, what it does if you take it, and what
 * leaving it costs. It is the body of the offer panel (Dialogue.tsx) and has no panel, focus trap
 * or answers of its own: since 2026-10-22 the card is simply open whenever someone offers it.
 *
 * One neutral style for every row: the card never signals danger (UI_FOUNDATIONS section 5). The
 * bad card is the good one with one line swapped, so the only way to tell is to read the lines.
 *
 * A GRID OF THREE AREAS, so a phone can move the rows under the picture instead of squeezing them
 * beside it: `icon head / icon rows` on a wide panel, `icon head / rows rows` on a narrow or short
 * one (panels.css).
 */
export function SkillCard({ words, skill, card }: SkillCardProps) {
  return (
    <div class="otp-card__top">
      <div class="otp-card__icon">
        <SkillIcon skill={skill} />
      </div>
      <div class="otp-card__head">
        <h3 class="otp-card__title">{skill.name}</h3>
        <p class="otp-card__promise">{skill.promise}</p>
      </div>
      <div class="otp-card__rows">
        <div class="otp-row">
          <div>
            <p class="otp-row__eyebrow">{words.ifTake}</p>
            <ul class="otp-card__lines" data-card-take="">
              {card.take.map((line) => (
                <li class="otp-row__heading" key={line}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div class="otp-row">
          <div>
            <p class="otp-row__eyebrow">{words.ifLeave}</p>
            <p class="otp-row__heading" data-card-leave="">
              {card.leave}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
