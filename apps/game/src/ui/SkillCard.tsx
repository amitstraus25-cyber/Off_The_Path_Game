import type { JSX } from 'preact';
import { BASKET_SLOTS } from '@otp/core';
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

/* Drawn for the same reason as the verdict glyphs: Haffer does not carry U+2190. */
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
 * The "What it asks for" row, which is a sentence on every card -- including the honest one, whose
 * sentence is that there is nothing to find. Exported because test/content-copy.test.ts asks
 * whether the Keeper's only testable claim, written into an ask no code path can reach, actually
 * reaches a player anywhere.
 */
export const cardAsksFor = (content: Content, skill: Skill): string =>
  skill.finePrint?.detail ?? content.strings['noFinePrint'] ?? '';

/**
 * ONE TABLE DRIVES BOTH THE KEY AND THE PILLS.
 *
 * The three definitions above the pills and the three pills themselves are rendered from this
 * array, in this order, with this glyph. That is not tidiness: UI_FOUNDATIONS section 2 says
 * nothing may make one verdict look like the recommended one, and two independent lists is exactly
 * how a fourth round discovers that the key reads Allow / Restrict / Reject while the buttons read
 * Allow / Reject / Restrict, or that one of them picked up a different glyph. A definition cannot
 * drift from the button it defines if there is only one of each.
 *
 * `means` is the CONTENT KEY, not the sentence: the words are data (CLAUDE.md rule 3) and live in
 * content/game.json. It is a function rather than a bare key string so that each read is written
 * out as `strings['verdictAllowMeans']` -- the literal form test/strings.test.ts scans for. That
 * makes the content file and this card guard each other in both directions: delete a key and the
 * read is unaccounted for, delete a render and the key is unreachable. Either way the build fails
 * with the key named, instead of the card quietly rendering a verb with no meaning beside it.
 */
const VERDICTS: {
  id: Verdict;
  label: string;
  Glyph: () => JSX.Element;
  means: (content: Content) => string;
}[] = [
  {
    id: 'allow',
    label: 'Allow',
    Glyph: AllowGlyph,
    means: (content) => content.strings['verdictAllowMeans'] ?? '',
  },
  {
    id: 'restrict',
    label: 'Restrict',
    Glyph: RestrictGlyph,
    means: (content) => content.strings['verdictRestrictMeans'] ?? '',
  },
  {
    id: 'reject',
    label: 'Reject',
    Glyph: RejectGlyph,
    means: (content) => content.strings['verdictRejectMeans'] ?? '',
  },
];

/** Ties a pill to its definition for a screen reader, and `<dd>`s to the pills for everyone else. */
const meansId = (id: Verdict): string => `otp-means-${id}`;

export interface SkillCardProps {
  content: Content;
  skill: Skill;
  /** Who handed this over, shown as the provenance eyebrow. */
  offeredBy: string;
  /** 1-based position in the run, for the header chip. */
  index: number;
  total: number;
  onVerdict(verdict: Verdict): void;
  /** Leaves the card without recording a verdict, back to the conversation. */
  onBack(): void;
  /**
   * DEAD, and optional so that removing the prop from App.tsx needs no change here.
   *
   * It used to gate the verb primer to the first card a run opened, so verdicts two and three were
   * given with no definition of Allow, Restrict or Reject on screen at all -- and Night Light, the
   * one card whose best answer is Restrict on an honest offer, is third. The key is now rendered
   * unconditionally from `VERDICTS`, which cannot see which card it is on, so there is nothing
   * here left to gate. App.tsx still computes and passes it; that file has another owner this
   * round, and dropping the property from this interface would fail its typecheck.
   */
  firstOpened?: boolean;
}

/*
 * The basket is no longer drawn here. It lives permanently in the world's HUD, which stays
 * visible through the dim, so the card is one object instead of three stacked panels that
 * overflowed the world on desktop and ran off the bottom of a phone.
 */
export function SkillCard({
  content,
  skill,
  offeredBy,
  index,
  total,
  onVerdict,
  onBack,
}: SkillCardProps) {
  const trap = useFocusTrap();

  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
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
          {/*
            The only way off this card that is not a verdict. Esc has always dispatched BACK, but
            nothing on the card said so and a touch player has no Esc key, so opening a card meant
            committing to one of three irreversible answers. It is deliberately not a fourth pill:
            subordinate chrome, Ash on Shell, at the top where a close control belongs.
          */}
          <div class="otp-card__nav">
            <button type="button" class="otp-card__back" onClick={onBack}>
              <span class="otp-card__back-glyph" aria-hidden="true">
                <BackGlyph />
              </span>
              {content.strings['cardBack'] ?? 'Go back'}
            </button>
          </div>

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

                This row is ALWAYS rendered, including for a skill that asks for nothing. Gating it
                on `finePrint` left the honest card one row shorter than the other two, so Night
                Light could be picked out by the card's shape from across the screen without reading
                a word — the exact habit this card exists to break. It still asks for nothing
                (UI_FOUNDATIONS section 7, change 8); you now have to read the row to learn that.
              */}
              <div class="otp-row">
                <span class="otp-row__badge">
                  <KeyIcon />
                </span>
                <div>
                  <p class="otp-row__eyebrow">What it asks for</p>
                  <p class="otp-row__heading">{cardAsksFor(content, skill)}</p>
                </div>
              </div>
            </div>
          </div>

          {/*
            THE KEY: three verbs, three one-line meanings, nothing else.

            It sits directly ABOVE the pills, in the pills' own order and carrying the pills' own
            glyphs, so the mapping from verb to meaning is made by POSITION -- column one defines
            the button under column one -- and not by reading a paragraph and holding three
            definitions in your head. It is also shorter than what it replaces, so the three pills
            move UP the card rather than down.

            What came out of here, and why it is not a deletion: this block used to append a second
            lesson, the three things a skill can be given (basket B, strangers S, word ahead W) with
            `content.capabilities[*].detail` spelling each one out. That is the only place in the
            game those three sentences render -- `.otp-leg__detail` is drawn by the non-compact
            Trifecta, which nothing mounts -- so cutting it from here cuts it from the product. The
            handback carries the exact change that gives it a home on Results, beside the discs it
            explains. It must not simply disappear.
          */}
          <dl class="otp-card__primer">
            {VERDICTS.map(({ id, label, Glyph, means }) => (
              <div class="otp-primer" key={id}>
                <dt class="otp-primer__verb">
                  <span class="otp-primer__glyph" aria-hidden="true">
                    <Glyph />
                  </span>
                  {label}
                </dt>
                <dd class="otp-primer__means" id={meansId(id)}>
                  {means(content)}
                </dd>
              </div>
            ))}
          </dl>

          <div
            class="otp-verdicts"
            role="group"
            aria-label={`What should ${skill.name} be allowed to do?`}
          >
            {/*
              THE GUARD IS ON THE THREE PILLS, NOT ON THE PANEL.
              A plain double-click on "Show me the skill" used to record Allow and end the
              encounter. Click one mounts this card under a pointer that has not moved, and the
              `otp-panel-in` slide then carries the Allow pill through that exact point, so click
              two landed on a verdict. Measured: at 1280x800 a double-click at any gap up to ~100ms
              logged `inspected` and `verdict` 3-6ms apart, with the run then unrecoverable -- a
              verdict cannot be retaken -- and the toast reporting a weighed decision nobody made.
              The pills are the only controls here that commit anything, so they are the only ones
              that ask. Guarding the whole panel instead would swallow the first deliberate click
              of someone who is reading it, and "Go back" stays unguarded because leaving is free.
            */}
            {VERDICTS.map(({ id, label, Glyph }) => (
              <button
                key={id}
                type="button"
                class={`otp-verdict otp-verdict--${id}`}
                /* The definition above is read out with the button, so a screen reader gets the
                   same pairing the sighted player gets from the column it sits in. */
                aria-describedby={meansId(id)}
                onClick={(e) => {
                  if (trap.deliberate(e)) onVerdict(id);
                }}
              >
                <span class="otp-verdict__glyph" aria-hidden="true">
                  <Glyph />
                </span>
                <span class="otp-verdict__label">{label}</span>
              </button>
            ))}
          </div>

          {/* States the asymmetry the back control depends on: leaving is free, deciding is not. */}
          <p class="otp-card__final">{content.strings['cardBackHint'] ?? ''}</p>
        </div>
      </Panel>
    </div>
  );
}

export interface BasketProps {
  basket: readonly string[];
  items: Readonly<Record<string, string>>;
}

export function Basket({ basket, items }: BasketProps) {
  return (
    <section class="otp-basket" aria-label="Your basket">
      <p class="otp-basket__label">Your Basket</p>
      <ul class="otp-slots">
        {Array.from({ length: BASKET_SLOTS }, (_, i) => {
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
