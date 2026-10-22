import type { v2 } from '@otp/core';
import { Panel, useFocusTrap } from './components';
import { TakeGlyph, LeaveGlyph } from './SkillCard';

export interface OfferProps {
  /** The offer panel's words (`ui.offer`). */
  words: v2.Content['ui']['offer'];
  character: v2.Character;
  skill: v2.Skill;
  onInspect(): void;
  onVerdict(verdict: v2.Verdict): void;
  /** Walks away without answering. Free: the character will still be there. */
  onWalkOn(): void;
}

/**
 * 02 Offer: who is speaking, what they say, and what the skill promises -- then the card, or an
 * answer straight away.
 *
 * NOTHING HERE DIFFERS BETWEEN A GOOD AND A BAD DEAL. The greeting and the promise are one copy in
 * the content (GAME_DESIGN_V2 section 4), so this panel cannot give a verdict away; only the card
 * can, and opening it is the player's choice. Take and Leave are offered here as well as on the
 * card, because answering without reading is exactly the habit the reveal is built to catch.
 *
 * PORTRAIT-LESS, for all seven. Portraits exist for three of the cast (PLAN Phase D); drawing three
 * and leaving four blank would make the cast read as two kinds of character, and inventing the
 * other four is what CLAUDE.md rule 5 forbids. The speaker's name carries who is talking.
 *
 * The answers are guarded with `deliberate`: the panel mounts under the pointer that opened it,
 * and a double-click's second half must not become a verdict (components.tsx).
 */
export function Dialogue({ words, character, skill, onInspect, onVerdict, onWalkOn }: OfferProps) {
  const trap = useFocusTrap();
  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
      role="dialog"
      aria-modal="true"
      aria-label={`${character.name}: ${skill.name}`}
      data-offer={character.id}
    >
      <Panel number="02" title={words.title} heading>
        <div class="otp-dialogue otp-dialogue--bare">
          <div class="otp-dialogue__text">
            <p class="otp-dialogue__speaker">{character.name}</p>
            <p class="otp-dialogue__line">{character.greet}</p>
            <div class="otp-row otp-offer__promise">
              <div>
                <h3 class="otp-row__eyebrow">{skill.name}</h3>
                <p class="otp-row__heading">{skill.promise}</p>
              </div>
            </div>
            <div class="otp-dialogue__foot">
              {/* The first stop, and the one that commits nothing: reading is free. */}
              <button
                type="button"
                class="otp-dialogue__show"
                data-action="inspect"
                data-autofocus
                onClick={onInspect}
              >
                {words.openCard} <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                class="otp-dialogue__trust"
                data-action="walk-on"
                onClick={onWalkOn}
              >
                {words.walkOn}
              </button>
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
                <span class="otp-verdict__label">{words.take}</span>
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
                <span class="otp-verdict__label">{words.leave}</span>
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
