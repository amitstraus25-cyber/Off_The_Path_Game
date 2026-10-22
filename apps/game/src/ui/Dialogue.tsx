import type { v2 } from '@otp/core';
import { Panel, useFocusTrap } from './components';
import { LeaveGlyph, SkillCard, TakeGlyph } from './SkillCard';

export interface OfferProps {
  /** The offer panel's words (`ui.offer`). */
  words: v2.Content['ui']['offer'];
  /** The card's row eyebrows (`ui.card`). */
  cardWords: v2.Content['ui']['card'];
  character: v2.Character;
  skill: v2.Skill;
  /** The variant THIS run dealt. */
  card: v2.Variant['card'];
  onVerdict(verdict: v2.Verdict): void;
  /** Walks away without answering. Free: the character will still be there. */
  onWalkOn(): void;
}

/**
 * 02 Offer, ONE PANEL: who is speaking and what they say, then their card, then the answer.
 *
 * THE CARD OPENS BY ITSELF (the client, 2026-10-22: "I want the card to open automatically"). There
 * used to be an "Open the card" step between the greeting and the card, and with it a second panel
 * and a way back from one to the other. Meeting someone now shows everything at once; main.ts logs
 * the card as read the moment the offer opens, so the reveal's `read` stays true.
 *
 * NOTHING ABOVE THE CARD DIFFERS BETWEEN A GOOD AND A BAD DEAL. The greeting and the promise are one
 * copy in the content (GAME_DESIGN_V2 section 4), so only the card's lines can give a verdict away,
 * and the player has to read them to find it.
 *
 * FOCUS LANDS ON THE CARD, not on an answer: nothing is ever pre-selected, and a keyboard player
 * tabs on to Take it, Leave it and Walk on, in that order. The answers sit at the foot of the
 * panel's scrollport and stay in view when the card has to scroll (panels.css `.otp-offer__answers`).
 *
 * PORTRAIT-LESS, for all seven: the skill's own picture is the one image on the panel, and the
 * speaker's name carries who is talking.
 *
 * The answers are guarded with `deliberate`: the panel mounts under the pointer that opened it,
 * and a double-click's second half must not become a verdict (components.tsx).
 */
export function Dialogue({
  words,
  cardWords,
  character,
  skill,
  card,
  onVerdict,
  onWalkOn,
}: OfferProps) {
  const trap = useFocusTrap();
  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
      role="dialog"
      aria-modal="true"
      aria-label={`${character.name}: ${skill.name}`}
      data-offer={character.id}
      data-card={skill.id}
    >
      <Panel number="02" title={words.title} heading>
        <div class="otp-card otp-offer" tabIndex={-1} data-autofocus>
          <div class="otp-offer__voice">
            <p class="otp-dialogue__speaker">{character.name}</p>
            <p class="otp-dialogue__line">{character.greet}</p>
          </div>

          <SkillCard words={cardWords} skill={skill} card={card} />

          <div class="otp-offer__answers">
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
            {/* The quiet way past: no answer, no cost, and the character waits. */}
            <button type="button" class="otp-link" data-action="walk-on" onClick={onWalkOn}>
              {words.walkOn}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
