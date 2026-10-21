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
import type { PostOutcome } from '../net/leaderboard';
import type { Store } from '../store';
import { Dialogue } from './Dialogue';
import { SkillCard } from './SkillCard';
import { Title, padIsHidden } from './Title';
import { Cottage } from './Cottage';
import { Results } from './Results';
import { Notice } from './Notice';
import { Trifecta } from './Trifecta';
import { ProblemScreen } from './ProblemScreen';
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
  /** The sentence to show and which of the four it is; see `PostOutcome`. Forwarded to Results. */
  onPost(handle: string): Promise<PostOutcome | null>;
  /** The notice Purple is standing at, if any. */
  noticeId: string | null;
  onReadNotice(id: string): void;
  onLeaveNotice(): void;
  /** Whether the bed is playing, and the control that changes it. */
  music: { on: boolean; onToggle(): void };
  /**
   * The keys of the assets that would not load, or null when everything did. While it is set, the
   * retry screen is ALL this renders: a title or a HUD over a world that was never built is the
   * healthy-looking empty screen this exists to end.
   */
  loadFailed: readonly string[] | null;
  /** Try the load again. The scene restarts and `loadFailed` clears on its own. */
  onRetryLoad(): void;
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

/**
 * The canvas saying which way each traveller lies. The sibling of `WITHIN_REACH` above and a DOM
 * event for the same reason: the scene is the only thing in the build that knows where Purple is
 * standing, the UI holds no bus, and `main.ts` is not on the path between them.
 *
 * NOTHING DISPATCHES THIS YET -- the producer is a handover, recorded in `worldAsText()` below.
 * Until it lands every traveller's line reads exactly as it reads today, which is why the fallback
 * is an empty list rather than a guess.
 */
const BEARINGS = 'otp:bearings';

/**
 * Which way one traveller lies, and roughly how far.
 *
 * INDICES, NEVER WORDS, which is the same discipline `WITHIN_REACH` carries and for the same
 * reason: the words come from `content.strings` at the point of render, so an event dispatched by
 * anything other than the scene cannot put a sentence of its own into a live region. `sector` is
 * eight 45-degree sectors CLOCKWISE FROM NORTH (0 = north, 2 = east, 4 = south, 6 = west) and
 * `band` is a coarse distance, nearest first -- the contract `test/strings.test.ts` writes down
 * for `worldBearings` and `worldDistances`.
 */
interface Bearing {
  readonly id: string;
  readonly sector: number;
  readonly band: number;
}

/** A non-negative whole number. The UPPER bound is the content list's own length, at lookup. */
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * The payload, taken apart entry by entry, dropping the bad entries rather than the whole list.
 *
 * `window` is public, so anything on the page can dispatch this event: this is the one place
 * untrusted input crosses into a live region, which is why it is a plain function with the whole
 * check in one place rather than three casts spread through the render.
 * `e2e/world-bearings.spec.ts` drives it through the real event with a malformed entry of each
 * kind.
 */
function readBearings(detail: unknown): Bearing[] {
  const list: unknown =
    typeof detail === 'object' && detail !== null && 'bearings' in detail
      ? (detail as { bearings: unknown }).bearings
      : null;
  if (!Array.isArray(list)) return [];
  const found: Bearing[] = [];
  for (const entry of list as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, sector, band } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !isIndex(sector) || !isIndex(band)) continue;
    found.push({ id, sector, band });
  }
  return found;
}

/** What the scene last said about where everyone is. Empty until something dispatches it. */
function useBearings(): readonly Bearing[] {
  const [bearings, setBearings] = useState<readonly Bearing[]>([]);
  useEffect(() => {
    const onBearings = (event: Event): void =>
      void setBearings(readBearings((event as CustomEvent<unknown>).detail));
    window.addEventListener(BEARINGS, onBearings);
    return () => void window.removeEventListener(BEARINGS, onBearings);
  }, []);
  return bearings;
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
  loadFailed,
  onRetryLoad,
}: AppProps) {
  const state = useStoreState(store);
  const withinReach = useWithinReach();
  const bearings = useBearings();
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

  /**
   * Who still owes the player an answer: the predicate the locked door itself is built on.
   *
   * `canEnterCottage` is `every skill has a verdict`, so the ones without a verdict ARE the reason
   * the door will not open. Read off `state.verdicts` -- the same source the hidden roster's
   * `travellerState()` reads -- rather than off `met` or `inspected`, because meeting someone and
   * walking away leaves the door just as shut.
   */
  const outstanding = content.characters.filter((c) => state.verdicts[c.skillId] === undefined);

  /**
   * The line over the world, with the names on it when it is the locked door talking.
   *
   * THE DEFECT: the door says "I should hear all three travellers first" and the chip beside it
   * says "1 of 3 skills seen", and between them they never say WHICH. The only place Owl and
   * Lantern Keeper are named is the visually-hidden roster in `worldAsText()`, so a sighted player
   * turned away at the door has to re-sweep a forest they have already walked.
   *
   * Matched against `cottageHint` by value, because that is the one signal App has: `main.ts`
   * shows the same content string on `enteredCottage` and shows skill names here otherwise, and a
   * verdict confirmation must not collect a roster. Comparing against the content file rather than
   * a literal means a rewrite of that line keeps working and a missing key matches nothing (the
   * hint would be `''`, which is not `undefined`).
   *
   * NAMES ONLY, joined to the shipped sentence. The names are data, from the cast; the sentence is
   * copy and stays exactly as content ships it. There is no string in the file for "still to
   * hear", and inventing one here is the thing rule 3 forbids -- the same call `reachLine` above
   * makes when its content key is missing: thin, but true.
   *
   * One string, used by both the visible pill and the live region below, so the `aria-hidden`
   * duplicate stays an actual duplicate instead of drifting into a second, quieter message.
   */
  const heldAtDoor = hint !== null && hint === content.strings['cottageHint'];
  const hintLine =
    heldAtDoor && outstanding.length > 0
      ? [hint, outstanding.map((c) => c.name).join(', ')].join(' ')
      : hint;

  /*
   * A world that did not load is the whole screen. Placed after every hook above, which must run
   * on every render, and before the markup, so there is nothing to forget to guard: no title with
   * a Begin button, no HUD, no frame, no announce regions for a forest that is not there.
   */
  if (loadFailed !== null)
    return (
      <ProblemScreen
        kind="load"
        failed={loadFailed}
        title={content.strings['loadFailedTitle'] ?? ''}
        body={content.strings['loadFailedBody'] ?? ''}
        action={content.strings['loadFailedRetry'] ?? ''}
        onAction={onRetryLoad}
      />
    );

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
            {inForest ? (hintLine ?? '') : ''}
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
            {/*
              One text child, still, so `.otp-toast:empty` keeps fading the pill out when there is
              nothing to say. `hintLine` is `hint` itself everywhere but the locked door.
            */}
            <p class="otp-toast" aria-hidden="true">
              {hintLine ?? ''}
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
   * WHERE anyone is was the hole, and this is half of the fix. Each traveller's line now carries a
   * bearing and a coarse distance when the scene has said one -- "Owl, not met yet, east of you, a
   * short walk away" -- off `worldBearings` and `worldDistances`, two strings that shipped in the
   * content file with nothing in the build able to reach them.
   *
   * THE OTHER HALF IS A HANDOVER, and it is one file: `world/forest-scene.ts` is the only thing
   * that knows where Purple is standing. The UI holds no bus, and `main.ts` is not on the path, so
   * the channel is a DOM event beside the one that scene already dispatches -- see `BEARINGS` at
   * the top of this file for the payload, which is indices and ids with no words in it. Until that
   * dispatch lands, `bearings` is empty and every line below reads as it read before.
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

    /**
     * One word out of a pipe-separated content string, by index.
     *
     * The list's own length is the upper bound on the index: an out-of-range sector reads as
     * `undefined`, drops out at the `filter` below, and the line is simply short a bearing. That
     * is deliberately not written as `sector < 8` -- a guard that repeats the constant it watches
     * stops watching it the day the constant moves.
     */
    const word = (key: string, index: number): string =>
      (content.strings[key] ?? '').split('|')[index]?.trim() ?? '';

    /** The tail of a traveller's sentence: whichever of the two the scene has given us. */
    const bearingOf = (c: Character): string[] => {
      const found = bearings.find((b) => b.id === c.id);
      if (!found) return [];
      return [word('worldBearings', found.sector), word('worldDistances', found.band)].filter(
        Boolean,
      );
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
        {/*
          `filter(Boolean)` rather than a template, so a traveller with no bearing yet reads
          "Owl, not met yet" and not "Owl, not met yet, , " -- and so a missing state string
          leaves a name rather than a dangling comma.
        */}
        <ul>
          {content.characters.map((c) => (
            <li key={c.id}>
              {[c.name, travellerState(c), ...bearingOf(c)].filter(Boolean).join(', ')}
            </li>
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
