import { useEffect, useState } from 'preact/hooks';
import {
  CAPABILITIES,
  errandGoals,
  findCharacter,
  findNotice,
  findSkill,
  liveCapabilities,
} from '@otp/core';
import type { Content, GameState, Verdict } from '@otp/core';
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
              music={music}
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
              {live.length === CAPABILITIES.length && (
                <p class="otp-world-warning" role="status">
                  {content.strings['trifectaWarning'] ?? ''}
                </p>
              )}
            </WorldFrame>
            {/*
            Permanently mounted, so the live region actually announces. A region inserted into the
            DOM already containing its text is not announced at all: screen readers announce
            mutations to a region that was already there, which is why the verdict confirmation
            reached nobody. Empty is hidden by CSS rather than by unmounting.
          */}
            <div class="otp-layer">
              {say && (
                <p class="otp-say">
                  <span class="otp-say__who">{say.name}</span>
                  {say.line}
                </p>
              )}
              <p class="otp-toast" role="status" aria-live="polite">
                {hint ?? ''}
              </p>
            </div>
          </>
        );
    }
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
