import type { JSX } from 'preact';
import type { Content, Skill, Verdict } from '@otp/core';
import { NotationChip, Panel, useFocusTrap } from './components';
import { assetUrl } from '../world/assets';

/* Outline icons for the two card rows; both rows are neutral, so these label rather than rate. */
const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M5.5 10.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <circle cx="7.5" cy="7.5" r="3.5" fill="none" stroke="currentColor" stroke-width="2" />
    <path
      d="M10 10l5 5M13 15l2-2M11.5 13.5l1.5 1.5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
);

/*
 * Verdict glyphs are drawn, not typed. Haffer is a brand grotesk and does not carry U+2296 or
 * U+2715, so a text glyph falls through to the next family in the stack and renders at a different
 * weight and baseline beside its two siblings — which breaks the one thing the three pills must
 * say, that they are identical (UI_FOUNDATIONS section 2). Sized in `em` so they track --otp-ui.
 */
const AllowGlyph = () => (
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

const RestrictGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M6.5 10h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
);

const RejectGlyph = () => (
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

/* Three identical pills; the glyph is what distinguishes them, never a fill (UI_FOUNDATIONS §2). */
const VERDICTS: { id: Verdict; label: string; Glyph: () => JSX.Element }[] = [
  { id: 'allow', label: 'Allow', Glyph: AllowGlyph },
  { id: 'restrict', label: 'Restrict', Glyph: RestrictGlyph },
  { id: 'reject', label: 'Reject', Glyph: RejectGlyph },
];

export interface SkillCardProps {
  content: Content;
  skill: Skill;
  /** Who handed this over, shown as the provenance eyebrow. */
  offeredBy: string;
  /** 1-based position in the run, for the header chip. */
  index: number;
  total: number;
  onVerdict(verdict: Verdict): void;
}

/*
 * The basket is no longer drawn here. It lives permanently in the world's HUD, which stays
 * visible through the dim, so the card is one object instead of three stacked panels that
 * overflowed the world on desktop and ran off the bottom of a phone.
 */
export function SkillCard({ content, skill, offeredBy, index, total, onVerdict }: SkillCardProps) {
  const trapRef = useFocusTrap();

  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${skill.name}`}
    >
      <Panel
        number="03"
        title="Inspect"
        aside={
          <NotationChip label={`${content.strings['chipSkill'] ?? 'Skill'} ${index} of ${total}`} />
        }
      >
        {/* Focus lands on the card, not on Allow: no verdict is ever pre-selected. */}
        <div class="otp-card" tabIndex={-1} data-autofocus>
          <div class="otp-card__top">
            <div class="otp-card__icon">
              <img src={assetUrl(`${skill.icon}.png`)} alt="" />
            </div>
            <div class="otp-card__main">
              <p class="otp-card__eyebrow">Offered by the {offeredBy}</p>
              <h2 class="otp-card__title">{skill.name}</h2>

              <div class="otp-row">
                <span class="otp-row__badge">
                  <CheckIcon />
                </span>
                <div>
                  <p class="otp-row__eyebrow">What it does</p>
                  <p class="otp-row__heading">{skill.promise.detail}</p>
                </div>
              </div>

              {/*
                What it asks for is stated plainly and in the SAME neutral style as what it does.
                The card does not warn; the player has to weigh the ask themselves.
              */}
              {skill.finePrint && (
                <div class="otp-row">
                  <span class="otp-row__badge">
                    <KeyIcon />
                  </span>
                  <div>
                    <p class="otp-row__eyebrow">What it asks for</p>
                    <p class="otp-row__heading">{skill.finePrint.detail}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            class="otp-verdicts"
            role="group"
            aria-label={`What should ${skill.name} be allowed to do?`}
          >
            {VERDICTS.map(({ id, label, Glyph }) => (
              <button
                key={id}
                type="button"
                class={`otp-verdict otp-verdict--${id}`}
                onClick={() => onVerdict(id)}
              >
                <span class="otp-verdict__glyph" aria-hidden="true">
                  <Glyph />
                </span>
                <span class="otp-verdict__label">{label}</span>
              </button>
            ))}
          </div>

          {/*
            The three verbs are defined once, on the first card only. Cutting the per-verdict
            "leaves B" microcopy removes the answer key, but nothing else in the game ever says
            what Restrict does, and GAME_DESIGN section 4 requires the right answer to be
            discoverable. This is a rulebook: it defines the verbs without naming what any
            particular skill asks for.
          */}
          {index === 1 && <p class="otp-card__primer">{content.strings['verdictPrimer'] ?? ''}</p>}
        </div>
      </Panel>
    </div>
  );
}

const SLOTS = 5;

export interface BasketProps {
  basket: readonly string[];
  items: Readonly<Record<string, string>>;
}

export function Basket({ basket, items }: BasketProps) {
  return (
    <section class="otp-basket" aria-label="Your basket">
      <p class="otp-basket__label">Your Basket</p>
      <ul class="otp-slots">
        {Array.from({ length: SLOTS }, (_, i) => {
          const item = basket[i];
          const icon = item ? items[item] : undefined;
          return (
            <li class="otp-slot" key={item ?? `empty-${i}`}>
              {icon && <img src={assetUrl(`${icon}.png`)} alt={item!} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
