import { useEffect, useState } from 'preact/hooks';
import {
  CAPABILITIES,
  canEnterCottage,
  errandGoals,
  findCharacter,
  findNotice,
  findSkill,
  liveCapabilities,
} from '@otp/core';
import type { Character, Content, GameState, Verdict } from '@otp/core';
import type { Store } from '../store';
import { Dialogue } from './Dialogue';
import { SkillCard } from './SkillCard';
import { Title } from './Title';
import { Cottage } from './Cottage';
import { Results } from './Results';
import { Notice } from './Notice';
import { Trifecta } from './Trifecta';
import { HudBasket, HudGoals, NotationChip, WorldFrame } from './components';

export interface AppProps {
  store: Store;
  content: Content;
  /** A line to show over the world: the locked-cottage hint, or a verdict confirmation. */
  hint: string | null;
  /** What a bystander just said. Flavour only; nothing in the run depends on it. */
  say: { name: string; line: string } | null;
  onStart(): void;
  onReplay(): void;
  onReadResearch(): void;
  onPost(handle: string): Promise<string | null>;
  /** The notice Red is standing at, if any. */
  noticeId: string | null;
  onReadNotice(id: string): void;
  onLeaveNotice(): void;
  /** Whether the bed is playing, and the control that changes it. */
  music: { on: boolean; onToggle(): void };
}

function useStoreState(store: Store): GameState {
  const [state, setState] = useState(store.getState());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}

/**
 * Past tense of each verdict, for the lines that report one. `main.ts` carries the same three
 * pairs for the toast; they belong in `content` beside the strings they name, which is a change to
 * the content schema and so not this one.
 */
const VERDICT_STRING: Record<Verdict, string> = {
  allow: 'verdictAllowed',
  restrict: 'verdictRestricted',
  reject: 'verdictRejected',
};

export function App({
  store,
  content,
  hint,
  say,
  onStart,
  onReplay,
  onReadResearch,
  onPost,
  noticeId,
  onReadNotice,
  onLeaveNotice,
  music,
}: AppProps) {
  const state = useStoreState(store);
  const live = liveCapabilities(state.verdicts, content);
  const notice = noticeId ? findNotice(content, noticeId) : undefined;
  const character = state.activeCharacter
    ? findCharacter(content, state.activeCharacter)
    : undefined;
  const skill = character ? findSkill(content, character.skillId) : undefined;

  /*
   * The basket is mounted outside the phase switch, at a fixed position in the tree, so the
   * component instance survives opening and closing a panel. Mounted inside the explore branch it
   * unmounted the moment Inspect opened and remounted after the verdict with the new contents
   * already in place, so it could never show the key leaving.
   */
  const inWorld =
    state.phase === 'explore' || state.phase === 'dialogue' || state.phase === 'inspect';
  /** The forest itself is what is on screen: no panel is over it. */
  const inForest = state.phase === 'explore';
  const allLive = live.length === CAPABILITIES.length;

  return (
    <>
      {inWorld && (
        <div class="otp-world-anchor">
          <HudGoals
            goals={errandGoals(state, content)}
            heading={content.strings['errandHeading'] ?? 'Grandma asked for'}
          />
          <HudBasket
            basket={state.basket}
            items={content.items}
            label={content.strings['basketLabel'] ?? 'Basket'}
          />
        </div>
      )}
      {renderScreen()}
      {/*
        Every announcement the world makes, in regions that are mounted for as long as the world
        is -- through a panel opening and closing over it -- rather than with the thing they
        announce (UX_REVIEW finding 14).

        A live region inserted into the DOM already containing its text is not announced at all:
        screen readers announce MUTATIONS to a region that was already there. The verdict
        confirmation was the proof. Its node sits in the explore branch, which unmounts the moment
        Inspect opens and mounts again on the verdict with "Allowed: Cottage Finder" already
        inside, so the one line that confirms the most consequential click in the game reached
        nobody -- while the cottage hint, which mutates a node already on screen, always worked.

        The announcing is split from the showing instead of hoisting the visible nodes, because the
        three visible lines cannot move: `.otp-say` must disappear when nothing is being said (it
        has no empty state and would otherwise leave a dark pill on the forest), and
        `.otp-world-warning` is positioned inside the world frame, which is where it has to stay.
        So each visible line is `aria-hidden` -- it is a duplicate of these words, not a second
        message -- and these regions do the speaking. One region per channel, because a verdict and
        the trifecta warning can arrive in the same tick and a single region can only hold one of
        them: that is exactly the beat the review found silent.
      */}
      {inWorld && (
        <div class="otp-visually-hidden">
          <p data-announce="world" role="status" aria-live="polite">
            {inForest ? (hint ?? '') : ''}
          </p>
          <p data-announce="say" role="status" aria-live="polite">
            {inForest && say ? `${say.name}: ${say.line}` : ''}
          </p>
          <p data-announce="trifecta" role="status" aria-live="polite">
            {inForest && allLive ? (content.strings['trifectaWarning'] ?? '') : ''}
          </p>
        </div>
      )}
    </>
  );

  function renderScreen() {
    switch (state.phase) {
      case 'title':
      case 'intro':
        return <Title content={content} onPlay={onStart} />;

      case 'cottage':
        return (
          <Cottage
            content={content}
            state={state}
            onFinish={() => void store.dispatch({ type: 'FINISH' })}
          />
        );

      case 'results':
      case 'leaderboard':
        return (
          <Results
            content={content}
            state={state}
            onReplay={onReplay}
            onReadResearch={onReadResearch}
            onPost={onPost}
          />
        );

      case 'dialogue':
        return character ? (
          <Dialogue
            content={content}
            character={character}
            state={state}
            onAsk={(q) => void store.dispatch({ type: 'ASK', c: character.id, q })}
            onInspect={() => void store.dispatch({ type: 'INSPECT', s: character.skillId })}
            onTakeAsOffered={() =>
              void store.dispatch({ type: 'VERDICT', s: character.skillId, v: 'allow' })
            }
          />
        ) : null;

      case 'inspect':
        return skill ? (
          <SkillCard
            content={content}
            skill={skill}
            offeredBy={character?.name ?? ''}
            index={content.skills.findIndex((sk) => sk.id === skill.id) + 1}
            total={content.skills.length}
            onVerdict={(v: Verdict) => void store.dispatch({ type: 'VERDICT', s: skill.id, v })}
            onBack={() => void store.dispatch({ type: 'BACK' })}
            firstOpened={state.inspected[0] === skill.id}
          />
        ) : null;

      default:
        if (notice)
          return (
            <Notice
              content={content}
              state={state}
              notice={notice}
              onRead={() => onReadNotice(notice.id)}
              onWalkOn={onLeaveNotice}
            />
          );
        // Explore: the world inside its numbered frame. Joystick and A button are separate DOM.
        return (
          <>
            <WorldFrame
              number="01"
              title="Explore"
              music={{
                ...music,
                labels: {
                  name: content.strings['musicLabel'] ?? 'Music',
                  on: content.strings['musicOn'] ?? 'On',
                  off: content.strings['musicOff'] ?? 'Off',
                },
              }}
              aside={
                <>
                  <NotationChip
                    label={content.strings['quest'] ?? ''}
                    count={seenCount(state, content)}
                  />
                  {live.length > 0 && <Trifecta content={content} live={live} compact />}
                </>
              }
            >
              <p class="otp-world-hint">{content.strings['controlsHint'] ?? ''}</p>
              {allLive && (
                <p class="otp-world-warning" aria-hidden="true">
                  {content.strings['trifectaWarning'] ?? ''}
                </p>
              )}
              {worldAsText()}
            </WorldFrame>
            {/* The visible lines. The regions above the phase switch are what says them aloud. */}
            <div class="otp-layer">
              {say && (
                <p class="otp-say" aria-hidden="true">
                  <span class="otp-say__who">{say.name}</span>
                  {say.line}
                </p>
              )}
              <p class="otp-toast" aria-hidden="true">
                {hint ?? ''}
              </p>
            </div>
          </>
        );
    }
  }

  /**
   * The world, in words (UX_REVIEW finding 16).
   *
   * The forest is a canvas with nothing behind it: no text alternative for where Red is, what is
   * near her or what she can interact with. This is the part of that which the UI can actually
   * know. Who is out there and how far the player has got with each of them is in the store, so it
   * can be stated; WHERE anyone is, and whether one of them is in range right now, is known only
   * to the Phaser scene, which reports neither on the bus. Until it does, a player who cannot see
   * the forest can still tell who is left to meet, what Grandma asked for and whether the cottage
   * will open -- but has to sweep the forest pressing Space to find anybody. Said plainly in the
   * notes with this change, because it is the difference between completable and usable.
   */
  function worldAsText() {
    const travellerState = (c: Character): string => {
      const verdict = state.verdicts[c.skillId];
      if (verdict) {
        const word = content.strings[VERDICT_STRING[verdict]] ?? verdict;
        return `${word}: ${findSkill(content, c.skillId)?.name ?? c.skillId}`;
      }
      if (state.met.includes(c.id)) return content.strings['worldTravellerMet'] ?? '';
      return content.strings['worldTravellerUnmet'] ?? '';
    };

    return (
      <section class="otp-visually-hidden" aria-label={content.strings['worldSummaryLabel'] ?? ''}>
        {/* The same line as the hint over the canvas, which is display: none on a touch device. */}
        <p>{content.strings['controlsHint'] ?? ''}</p>
        <ul>
          {content.characters.map((c) => (
            <li key={c.id}>{`${c.name}, ${travellerState(c)}`}</li>
          ))}
        </ul>
        <p>
          {canEnterCottage(state, content)
            ? (content.strings['worldCottageOpen'] ?? '')
            : (content.strings['worldCottageLocked'] ?? '')}
        </p>
      </section>
    );
  }
}

/** The chip's muted count, as in the deck: "0 of 3 skills seen", then "3 of 3 skills decided". */
function seenCount(state: GameState, content: Content): string {
  const total = content.skills.length;
  const decided = content.skills.filter((s) => state.verdicts[s.id] !== undefined).length;
  if (decided === total) return `${total} of ${total} skills decided`;
  const seen = content.skills.filter(
    (s) => state.inspected.includes(s.id) || state.verdicts[s.id] !== undefined,
  ).length;
  return `${seen} of ${total} skills seen`;
}
