import type { v2 } from '@otp/core';
import { Panel, useFocusTrap } from './components';
import { PENDING } from './copy';
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

/* Drawn for the same reason: Haffer does not carry U+2190. */
const BackGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M12.5 4.5L7 10l5.5 5.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/**
 * A skill's icon, or its labelled placeholder while the art is awaited: four of the seven icons do
 * not exist and nothing may be drawn in their place (CLAUDE.md rule 5). The same placeholder the
 * HUD's basket wears (initials on Natural), so a missing icon reads the same everywhere.
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
  skill: v2.Skill;
  /** The variant THIS run dealt. Before the card opens the two are word for word the same. */
  card: v2.Variant['card'];
  /** Who handed this over, shown as the provenance eyebrow. */
  offeredBy: string;
  onVerdict(verdict: v2.Verdict): void;
  /** Leaves the card without answering, back to the conversation. */
  onBack(): void;
}

/**
 * 03 Card: what the skill does if you take it, and what happens if you leave it. Two lines and one,
 * in one neutral style: the card never signals danger (UI_FOUNDATIONS section 5). The bad card is
 * the good one with one line swapped, so the only way to tell is to read the lines.
 */
export function SkillCard({ skill, card, offeredBy, onVerdict, onBack }: SkillCardProps) {
  const trap = useFocusTrap();
  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
      role="dialog"
      aria-modal="true"
      aria-label={skill.name}
      data-card={skill.id}
    >
      <Panel number="03" title={PENDING.cardTitle} heading>
        {/* Focus lands on the card, not on an answer: nothing is ever pre-selected. */}
        <div class="otp-card" tabIndex={-1} data-autofocus>
          <div class="otp-card__nav">
            <button type="button" class="otp-card__back" data-action="back" onClick={onBack}>
              <span class="otp-card__back-glyph" aria-hidden="true">
                <BackGlyph />
              </span>
              {PENDING.back}
            </button>
          </div>

          <div class="otp-card__top">
            <div class="otp-card__icon">
              <SkillIcon skill={skill} />
            </div>
            <div class="otp-card__main">
              <p class="otp-card__eyebrow">{offeredBy}</p>
              <h3 class="otp-card__title">{skill.name}</h3>

              <div class="otp-row">
                <div>
                  <p class="otp-row__eyebrow">{PENDING.cardTake}</p>
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
                  <p class="otp-row__eyebrow">{PENDING.cardLeave}</p>
                  <p class="otp-row__heading" data-card-leave="">
                    {card.leave}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="otp-verdicts" role="group" aria-label={skill.name}>
            <button
              type="button"
              class="otp-verdict"
              data-action="take"
              onClick={(e) => {
                if (trap.deliberate(e)) onVerdict('take');
              }}
            >
              <span class="otp-verdict__glyph" aria-hidden="true">
                <TakeGlyph />
              </span>
              <span class="otp-verdict__label">{PENDING.take}</span>
            </button>
            <button
              type="button"
              class="otp-verdict"
              data-action="leave"
              onClick={(e) => {
                if (trap.deliberate(e)) onVerdict('leave');
              }}
            >
              <span class="otp-verdict__glyph" aria-hidden="true">
                <LeaveGlyph />
              </span>
              <span class="otp-verdict__label">{PENDING.leave}</span>
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
