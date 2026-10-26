import { useEffect, useRef, useState } from 'preact/hooks';
import type { v2 } from '@otp/core';
import { Panel, useFocusTrap, usePanelCover } from './components';
import { LeaveGlyph, SkillCard, TakeGlyph } from './SkillCard';

export interface ConversationProps {
  /** The offer panel's words (`ui.offer`), Purple's replies among them. */
  words: v2.Content['ui']['offer'];
  character: v2.Character;
  /** Opens the card: the INSPECT, which is what logs it as read. */
  onShowMe(): void;
  /** "No thanks", or the close control: no answer, and the character waits. */
  onWalkOn(): void;
}

/** Docks over the bottom of the world on an upright phone: the forest stands the camera lower. */
const portrait = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches;

/** One turn of the conversation: who said it, and what. Purple's turns sit on the right. */
function Said({ who, line, mine = false }: { who: string; line: string; mine?: boolean }) {
  return (
    <div class="otp-chat__turn" data-mine={mine ? '' : undefined}>
      <p class="otp-dialogue__speaker">{who}</p>
      <p class="otp-dialogue__line">{line}</p>
    </div>
  );
}

/**
 * 02 Offer, THE CONVERSATION BEFORE THE CARD (the client, 2026-10-26: "like a ping pong"). The
 * character greets, Purple asks what they have, they say what they offer, and "Show me" opens the
 * card. Two of their lines and two of Purple's replies, and the clock runs through it (the client's
 * choice), so it is kept short.
 *
 * NOTHING SAID HERE DIFFERS BETWEEN A GOOD AND A BAD DEAL: the greeting and the offer are one copy
 * on the character (content.ts), so only the card can give a verdict away.
 *
 * "No thanks" is Walk on in Purple's voice -- the character waits, and meeting them again starts the
 * conversation over. The first reply is ONE button whose words change, so a keyboard player's focus
 * stays on it and Enter, Enter opens the card. The card is its own panel (`Dialogue` below), mounted
 * fresh, so its answers get their own settle time against a finger tapping through the replies.
 */
export function Conversation({ words, character, onShowMe, onWalkOn }: ConversationProps) {
  const trap = useFocusTrap();
  const [asked, setAsked] = useState(false);
  usePanelCover(() => trap.current?.querySelector<HTMLElement>('.otp-panel') ?? null, portrait);
  /*
   * A keyboard player's focus stays on the reply through its change of words, so the second Enter
   * is "Show me". The button is the same node either side, but a re-render of the layers around it
   * can still drop focus on a busy page (seen once under a full e2e run), so it is put back.
   */
  const reply = useRef<HTMLButtonElement>(null);
  const byKey = useRef(false);
  useEffect(() => {
    if (asked && byKey.current) reply.current?.focus({ preventScroll: true });
  }, [asked]);
  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
      role="dialog"
      aria-modal="true"
      aria-label={character.name}
      data-offer={character.id}
      data-talk={asked ? 'offer' : 'greet'}
    >
      <Panel number="02" title={words.title} heading>
        <div class="otp-card otp-offer otp-chat" tabIndex={-1} data-autofocus>
          {/* Polite, so each new turn is read out once it is said, and nothing is interrupted. */}
          <div class="otp-chat__log" aria-live="polite">
            <Said who={character.name} line={character.greet} />
            {asked && <Said who={words.purple} line={words.ask} mine />}
            {asked && <Said who={character.name} line={character.offer} />}
          </div>
          <div class="otp-offer__answers">
            <div class="otp-verdicts otp-chat__replies" role="group" aria-label={words.purple}>
              <button
                type="button"
                class="otp-verdict otp-chat__reply"
                ref={reply}
                data-action={asked ? 'show-me' : 'ask'}
                onClick={(e) => {
                  if (!trap.deliberate(e)) return;
                  byKey.current = e.detail === 0;
                  if (asked) onShowMe();
                  else setAsked(true);
                }}
              >
                <span class="otp-verdict__label">{asked ? words.showMe : words.ask}</span>
              </button>
              <button
                type="button"
                class="otp-verdict otp-chat__reply"
                data-action="no-thanks"
                onClick={(e) => {
                  if (trap.deliberate(e)) onWalkOn();
                }}
              >
                <span class="otp-verdict__label">{words.noThanks}</span>
              </button>
            </div>
          </div>
          <button type="button" class="otp-offer__walk-on" data-action="walk-on" onClick={onWalkOn}>
            <span class="otp-offer__walk-on-label">{words.walkOn}</span>
            <span class="otp-offer__walk-on-x" aria-hidden="true">
              <LeaveGlyph />
            </span>
          </button>
        </div>
      </Panel>
    </div>
  );
}

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
 * 02 Offer, THE CARD: who is speaking and what they offered, then their card, then the answer.
 *
 * Opened by "Show me" at the end of the conversation (`Conversation` above, 2026-10-26). It used to
 * open by itself the moment someone was met (2026-10-22); the conversation is the step in between
 * again, and the INSPECT its "Show me" sends is what logs the card as read.
 *
 * NOTHING ABOVE THE CARD DIFFERS BETWEEN A GOOD AND A BAD DEAL. The offer and the promise are one
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
  /*
   * ROOM FOR THE FACE YOU ARE TALKING TO (Paul's round, 2026-10-22): in the portrait cabinet the
   * offer docks over the bottom of the world and its top edge sliced Purple's eyes on a two-line
   * card at 375. The forest stands the camera lower while it is open (forest-scene.ts). Portrait
   * only: in landscape the offer is a centred modal over a dimmed world, not a dock.
   */
  usePanelCover(() => trap.current?.querySelector<HTMLElement>('.otp-panel') ?? null, portrait);
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
            <p class="otp-dialogue__line">{character.offer}</p>
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
          </div>
          {/*
            The quiet way past: no answer, no cost, and the character waits. Drawn as the panel's
            close control in the header's top right (the client, 2026-10-25), but LAST in the DOM,
            so a keyboard still meets Take it, Leave it and Walk on in that order.
          */}
          <button type="button" class="otp-offer__walk-on" data-action="walk-on" onClick={onWalkOn}>
            <span class="otp-offer__walk-on-label">{words.walkOn}</span>
            <span class="otp-offer__walk-on-x" aria-hidden="true">
              <LeaveGlyph />
            </span>
          </button>
        </div>
      </Panel>
    </div>
  );
}
