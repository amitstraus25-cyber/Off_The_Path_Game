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
import { Title, padIsHidden } from './Title';
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

/**
 * The canvas saying that someone has come within reach. Declared in `world/forest-scene.ts`, which
 * dispatches it, and read here and in `ui/touch-controls.ts`; see the note there for why it is a
 * DOM event and not the typed bus.
 */
const WITHIN_REACH = 'otp:within-reach';

/**
 * Who the scene says is within reach, by id.
 *
 * The id, and only the id: the name is looked up in `content` below rather than taken from the
 * event, so nothing but a real member of this cast can ever put words into the live region.
 */
function useWithinReach(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const onReach = (event: Event): void => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      const value =
        typeof detail === 'object' && detail !== null && 'id' in detail
          ? (detail as { id: unknown }).id
          : null;
      setId(typeof value === 'string' ? value : null);
    };
    window.addEventListener(WITHIN_REACH, onReach);
    return () => void window.removeEventListener(WITHIN_REACH, onReach);
  }, []);
  return id;
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
  const withinReach = useWithinReach();
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

  /**
   * What the speech bubble over someone's head says, for a player who cannot see it: the name,
   * then what to do about it.
   *
   * The NAME comes first and comes from the cast, because it is the fact the player is waiting for
   * and it is data rather than copy. What to do about it is `worldTravellerNear`, in the content
   * file with the rest of the world summary's strings. Joined rather than interpolated so that a
   * content file without that key still announces "Rabbit" on its own -- thin, but true, and never
   * an English literal standing in for a missing one.
   */
  const reachName = withinReach
    ? (findCharacter(content, withinReach)?.name ??
      content.bystanders.find((b) => b.id === withinReach)?.name ??
      null)
    : null;
  const reachLine = reachName
    ? [reachName, content.strings['worldTravellerNear']].filter(Boolean).join(', ')
    : '';

  return (
    <>
      {/*
        KEYS, on the three children that must outlive a panel.

        Preact matches unkeyed siblings by position, and when the vnode at a position changes type
        it searches NEARBY positions for an old child of the new type and reuses that one's DOM
        node. Leaving Inspect does exactly that: `renderScreen()` goes from a `SkillCard` component
        to the explore layer's plain `<div>`, Preact looks for a `<div>` to reuse, and the nearest
        one is the live-region block below. The announce regions were silently handed their node
        to the toast layer and rebuilt from scratch -- which is the one thing UX_REVIEW finding 14
        says must never happen to them, because a region that is REPLACED carrying its text is
        announced by no screen reader. It cost two a11y specs, and nothing about it is visible on
        screen. A key pins each of these three to itself; the layer below stays unkeyed, so it can
        never match one of them again.
      */}
      {inWorld && (
        <div class="otp-world-anchor" key="world-hud">
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
      {/*
        The frame is furniture, not a screen -- the same argument as the basket above, applied to
        the thing the basket hangs inside.

        It was returned by the explore branch of the switch below, so the numbered frame, its
        header band, the only Cyera wordmark on the page, the music control and the three
        capability discs all left the document the moment 02 Question opened and came back on the
        verdict: twice per encounter, six times a run. CLS scores none of it, because a node that
        unmounts never shifts -- which is exactly why it survived a startup-layout audit that now
        measures 0.0000.

        The discs are the part that is not merely cosmetic. They are the only running display of
        what the 200-point boundary bonus is scored on, and they went dark precisely while the
        player was reading the card that decides whether another leg lights.

        It is mounted BEFORE renderScreen so the modal layers below paint over it. Nothing in
        either stylesheet carries a z-index and both are `position: fixed`, so document order is
        the whole of the stacking: move this line below the switch and the Black header strip and
        the white wordmark are painted on top of the modal's dim. Hit-testing cannot see that --
        the frame is `pointer-events: none`, so the card takes the pointer either way round --
        which is why e2e/world-frame.spec.ts measures the wordmark's brightness instead.
      */}
      {inWorld && worldFrame()}
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
        <div class="otp-visually-hidden" key="world-announce">
          <p data-announce="world" role="status" aria-live="polite">
            {inForest ? (hint ?? '') : ''}
          </p>
          <p data-announce="say" role="status" aria-live="polite">
            {inForest && say ? `${say.name}: ${say.line}` : ''}
          </p>
          {/*
            Its own region, for the same reason the others have theirs: walking into range and
            being told something else can happen on the same tick, and one region can only hold
            one of them.
          */}
          <p data-announce="near" role="status" aria-live="polite">
            {inForest ? reachLine : ''}
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
            /*
             * Which card of the run this is, counted by the cards the player has opened -- not by
             * the skill's position in content/game.json, which is an order nobody walks. The
             * content order is Rabbit, Owl, Keeper; the forest puts the Keeper second and the Owl
             * third, so the header read 1, 3, 2 and the second card of the run announced "Skill 3
             * of 3". Meeting the Keeper first opened the run with it.
             *
             * `inspected` is appended by the INSPECT that reached this phase, so the id is always
             * in it by the time the card renders; the floor is there so a future path into
             * `inspect` could never print "Skill 0 of 3".
             */
            index={Math.max(1, state.inspected.indexOf(skill.id) + 1)}
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
        // Explore: the transient lines over the world. The frame itself is mounted above the
        // switch, and the joystick and A button are separate DOM.
        return (
          /* The visible lines. The regions above the phase switch are what says them aloud. */
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
        );
    }
  }

  /**
   * The world inside its numbered frame, mounted for as long as the world is: 01 Explore, 02
   * Question and 03 Inspect, and behind a notice. See the note at the call site for why it is not
   * in the phase switch and why it is mounted before it.
   *
   * The children come with it. The controls hint and the trifecta warning sit under the modal
   * dim while a panel is open, which is what they should do -- they are the world's own labels,
   * and the world is still there. The hidden summary comes with them too and costs nothing: every
   * panel that covers the frame is `aria-modal="true"`, so a screen reader is inside the panel and
   * cannot reach it until the panel closes.
   */
  function worldFrame() {
    return (
      <WorldFrame
        key="world-frame"
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
    );
  }

  /**
   * The world, in words (UX_REVIEW finding 16).
   *
   * The forest is a canvas with nothing behind it. This is the standing part of the alternative:
   * who is out there and how far the player has got with each of them, which is all in the store.
   * Whether one of them is in range right now is the scene's to say, and it now does -- see the
   * `near` region above.
   *
   * What is still missing is WHERE anyone is. A player who cannot see the forest can tell who is
   * left to meet, what Grandma asked for, whether the cottage will open, and -- the moment she
   * arrives -- who is within reach; but finding someone is still a sweep, because nothing here
   * says "the Owl is east of you". A bearing per traveller is the remaining piece, and it needs
   * two things this file cannot reach, so that nobody has to work it out a third time:
   *
   *  - The direction words, in `content.strings`. Owned by the content task on this board.
   *  - Red's position, and each traveller's. The UI has neither. `bus.ts` carries no event with a
   *    position on it -- `interact`, `greetBystander` and `reachedNotice` carry ids -- and the
   *    only place a position is published is `window.__otp.scene`, which `world/forest-scene.ts`
   *    sets for the e2e specs alone and which App must not read. Giving the bus a `redMoved`
   *    event, or a coarse `bearings` payload off the existing reach check, is the honest route;
   *    it touches `bus.ts`, `world/forest-scene.ts` and `main.ts`, all owned elsewhere today.
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
        {/*
          The controls, for the machine this player is actually on -- the same branch, off the same
          query, as the title's hint (Title.tsx, UX_REVIEW finding 11).

          This printed `controlsHint` to everyone, which names Arrows, WASD, Space and Esc. The
          visible copy of that line is already `display: none` below `@media (hover: none)`, with a
          comment in panels.css saying why: it is "dead weight... it names Arrows and WASD to
          someone holding a phone". So the sighted touch player was spared the wrong instructions
          and the blind touch player -- the one player for whom this section IS the game -- was
          handed them as the only instructions there were.
        */}
        <p>
          {padIsHidden()
            ? (content.strings['controlsHint'] ?? '')
            : (content.strings['controlsHintTouch'] ?? '')}
        </p>
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
