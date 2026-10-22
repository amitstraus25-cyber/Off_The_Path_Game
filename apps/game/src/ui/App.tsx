import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { v2 } from '@otp/core';
import type { PostOutcome } from '../net/leaderboard';
import type { Store } from '../store';
import { hudBasket, remainingMs, walkOn } from '../world/run';
import { Dialogue } from './Dialogue';
import { HowTo, Title, hasKeyboard } from './Title';
import { Cottage } from './Cottage';
import { Results } from './Results';
import { ProblemScreen } from './ProblemScreen';
import { Hud } from './Hud';
import { WorldFrame } from './components';
import { strings } from './copy';

export interface AppProps {
  store: Store;
  /** Title to how-to: the run's start is asked of the server here (main.ts). */
  onStart(): void;
  /** How-to to forest: the clock starts. */
  onGo(): void;
  /** The start is still out, so the how-to's button waits. */
  starting: boolean;
  onReplay(): void;
  onReadResearch(): void;
  onPost(handle: string): Promise<PostOutcome>;
  /** Why this run cannot be posted, or null; see `ResultsProps.cannotPost`. */
  cannotPost: string | null;
  /** Whether the bed is playing, and the control that changes it. */
  music: { on: boolean; onToggle(): void };
  /**
   * The keys of the assets that would not load, or null when everything did. While it is set, the
   * retry screen is ALL this renders.
   */
  loadFailed: readonly string[] | null;
  onRetryLoad(): void;
}

function useStoreState(store: Store): v2.State {
  const [state, setState] = useState(store.getState());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}

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
  onStart,
  onGo,
  starting,
  onReplay,
  onReadResearch,
  onPost,
  cannotPost,
  music,
  loadFailed,
  onRetryLoad,
}: AppProps) {
  const state = useStoreState(store);
  const { content } = store;
  const withinReach = useWithinReach();
  const bearings = useBearings();
  const character = state.active ? v2.findCharacter(content, state.active) : undefined;
  const skill = character ? v2.findSkill(content, character.skillId) : undefined;

  const inWorld = v2.RUNNING.has(state.phase);
  const inForest = state.phase === 'forest';
  const ended = state.phase === 'cottage' || state.phase === 'late';

  /*
   * The arrival beat comes first and the reveal after it. A view question, not a rule: the run
   * ended when the reducer said so, and this only decides which of the two screens is showing.
   */
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!ended) setRevealing(false);
  }, [ended]);

  /*
   * WHERE FOCUS GOES WHEN THE FOREST COMES BACK: the world's own h1, when focus has nowhere else to
   * be (a panel just closed, the walk just began). A layout effect, so no frame is painted with
   * focus on the body.
   */
  const forestHome = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!inForest) return;
    const on = document.activeElement;
    if (on && on !== document.body && on.isConnected) return;
    forestHome.current?.focus({ preventScroll: true });
  }, [inForest]);

  const reachName = withinReach ? (v2.findCharacter(content, withinReach)?.name ?? null) : null;
  const reachLine = reachName
    ? [reachName, strings['worldTravellerNear']].filter(Boolean).join(', ')
    : '';

  if (loadFailed !== null)
    return (
      <ProblemScreen
        kind="load"
        failed={loadFailed}
        title={strings['loadFailedTitle'] ?? ''}
        body={strings['loadFailedBody'] ?? ''}
        action={strings['loadFailedRetry'] ?? ''}
        onAction={onRetryLoad}
      />
    );

  const verdict = (s: string) => (v: v2.Verdict) => void store.dispatch({ type: 'VERDICT', s, v });

  return (
    <>
      {/*
        KEYS on the children that must outlive a panel: Preact reuses a nearby node of the same
        type when the vnode at a position changes, and a live region handed another's node is
        rebuilt silently (UX_REVIEW finding 14).
      */}
      {inWorld && (
        <div class="otp-world-anchor" key="world-hud">
          <h1 class="otp-visually-hidden" ref={forestHome} tabIndex={-1} data-autofocus>
            {content.ui.world.title}
          </h1>
          <Hud
            remainingMs={remainingMs(state, store.elapsed())}
            basket={hudBasket(state, content)}
            labels={content.ui.hud}
          />
        </div>
      )}
      {/* Mounted BEFORE the panels so the modal layers paint over it (document order is stacking). */}
      {inWorld && (
        <WorldFrame
          key="world-frame"
          number="01"
          title={content.ui.world.title}
          labelHidden
          music={{
            ...music,
            labels: {
              name: strings['musicLabel'] ?? '',
              on: strings['musicOn'] ?? '',
              off: strings['musicOff'] ?? '',
            },
          }}
        >
          <p class="otp-world-hint">{strings['controlsHint'] ?? ''}</p>
          {worldAsText()}
        </WorldFrame>
      )}
      {renderScreen()}
      {inWorld && (
        <div class="otp-visually-hidden" key="world-announce">
          <p data-announce="near" role="status" aria-live="polite">
            {inForest ? reachLine : ''}
          </p>
        </div>
      )}
    </>
  );

  function renderScreen() {
    switch (state.phase) {
      case 'title':
        return <Title ui={content.ui} onPlay={onStart} />;
      case 'howto':
        return <HowTo ui={content.ui} onGo={onGo} busy={starting} />;
      /*
       * One panel for both: the card is open whenever an offer is (Dialogue.tsx). `talk` is only
       * ever on screen for the instant between MEET and the INSPECT main.ts sends after it.
       */
      case 'talk':
      case 'card':
        return character && skill ? (
          <Dialogue
            key={`offer-${character.id}`}
            words={content.ui.offer}
            cardWords={content.ui.card}
            character={character}
            skill={skill}
            card={v2.variantOf(state.good, skill).card}
            onVerdict={verdict(skill.id)}
            onWalkOn={() => walkOn(store)}
          />
        ) : null;
      case 'cottage':
      case 'late': {
        const run = v2.result(state, content);
        const ending = run.ending ?? 'late';
        if (!revealing)
          return (
            <Cottage
              ending={ending}
              words={content.endings[ending]}
              onFinish={() => setRevealing(true)}
            />
          );
        return (
          <Results
            content={content}
            run={run}
            onReplay={onReplay}
            onReadResearch={onReadResearch}
            /*
             * A late run is not posted, and since 2026-10-22 neither is a wolf run (apps/api
             * answers 422 `wolf`): both are said up front rather than offered a Post the board
             * will refuse.
             */
            cannotPost={
              ending === 'late'
                ? (strings['postLate'] ?? '')
                : ending === 'wolf'
                  ? (strings['wolfNotPosted'] ?? '')
                  : cannotPost
            }
            onPost={onPost}
          />
        );
      }
      default:
        return null;
    }
  }

  /**
   * The world, in words (UX_REVIEW finding 16): who is out there, how far the player has got with
   * each, and -- when the scene has said -- which way and how far. Visually hidden; the panels that
   * cover the frame are `aria-modal`, so a screen reader reaches this only on the walk.
   */
  function worldAsText() {
    const r = content.ui.reveal;
    const word = (key: string, index: number): string =>
      (strings[key] ?? '').split('|')[index]?.trim() ?? '';
    const where = (id: string): string[] => {
      const found = bearings.find((b) => b.id === id);
      if (!found) return [];
      return [word('worldBearings', found.sector), word('worldDistances', found.band)].filter(
        Boolean,
      );
    };
    const standing = (c: v2.Character): string => {
      const v = state.verdicts[c.skillId];
      const name = v2.findSkill(content, c.skillId)?.name ?? c.skillId;
      if (v) return `${v === 'take' ? r.took : r.left}: ${name}`;
      return state.met.includes(c.id)
        ? (strings['worldTravellerMet'] ?? '')
        : (strings['worldTravellerUnmet'] ?? '');
    };
    return (
      <section class="otp-visually-hidden" aria-label={strings['worldSummaryLabel'] ?? ''}>
        <p>
          {hasKeyboard() ? (strings['controlsHint'] ?? '') : (strings['controlsHintTouch'] ?? '')}
        </p>
        <ul>
          {content.characters.map((c) => (
            <li key={c.id}>{[c.name, standing(c), ...where(c.id)].filter(Boolean).join(', ')}</li>
          ))}
        </ul>
      </section>
    );
  }
}
