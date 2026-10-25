import { Panel, useFocusTrap } from './components';
import { fill } from './copy';

/*
 * THE DOOR ASKS FIRST (the client, 2026-10-22). They finished a run with the Cat's Latch Lifter
 * marked "You walked past": stepping onto Grandma's doorstep ended the run at once, and the Cat
 * stands beside the door lane, so a player hurrying for the door walked straight past the last of
 * the seven without ever seeing them.
 *
 * So when anybody in the cast has not been met, the door asks before it lets you in, in the offer's
 * own panel style: how many, who, and two answers. KEEP LOOKING is the default and has focus --
 * the safe answer is the one Enter gives -- and puts Purple a step back off the doorstep
 * (`ForestScene.stepBack`); Esc says the same. GO IN enters exactly as the door always has. With
 * everyone met, none of this appears and the door opens as it did.
 *
 * THE CLOCK KEEPS RUNNING (the client's rule): the run is still in the forest the whole time the
 * question is up, and only the walk is paused. If the three minutes run out while it is open, the
 * run ends late and this panel goes with the forest.
 *
 * Neither answer is guarded with `deliberate`: this panel opens because Purple walked onto a step,
 * not under a pointer that just clicked, so there is no double-click's second half to discard.
 */

export interface DoorCheckProps {
  /** Who has not been met yet, by name, in walking order. Never empty: with nobody left, no ask. */
  unmet: readonly string[];
  /** How many there are in all. */
  total: number;
  /** The panel's frame title (the arrival's own, since this is its doorway). */
  title: string;
  words: { ask: string; still: string; stay: string; goIn: string };
  onStay(): void;
  onGoIn(): void;
}

export function DoorCheck({ unmet, total, title, words, onStay, onGoIn }: DoorCheckProps) {
  const trap = useFocusTrap(onStay);
  const question = fill(words.ask, { count: unmet.length, total });
  return (
    <div
      class="otp-layer otp-layer--modal"
      ref={trap}
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-door-ask"
      data-door="ask"
    >
      <Panel number="04" title={title} heading>
        <div class="otp-card otp-door">
          <p class="otp-dialogue__line otp-door__ask" id="otp-door-ask">
            {question}
          </p>
          <p class="otp-dialogue__speaker otp-door__still">{words.still}</p>
          <ul class="otp-door__who" data-door-unmet="">
            {unmet.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div class="otp-door__answers">
            <button
              type="button"
              class="otp-button"
              data-action="keep-looking"
              data-autofocus
              onClick={onStay}
            >
              {words.stay}
            </button>
            <button
              type="button"
              class="otp-button otp-button--quiet"
              data-action="go-in"
              onClick={(e) => {
                // Go in ends the run, and on an upright phone it opens where the A button was.
                if (trap.deliberate(e)) onGoIn();
              }}
            >
              {words.goIn}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
