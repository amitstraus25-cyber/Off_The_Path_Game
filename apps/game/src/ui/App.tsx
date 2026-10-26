import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { v2 } from '@otp/core';
import type { ContactInput, PostOutcome } from '../net/leaderboard';
import type { Store } from '../store';
import { hudBasket, remainingMs, walkOn } from '../world/run';
import { Conversation, Dialogue } from './Dialogue';
import { HowTo, Title, hasKeyboard } from './Title';
import { Cottage } from './Cottage';
import { formatElapsed, Results } from './Results';
import { variants } from '../ab';
import { ProblemScreen } from './ProblemScreen';
import { Hud } from './Hud';
import { Minimap } from './Minimap';
import { DoorCheck } from './DoorCheck';
import { WorldSigns } from './WorldSigns';
import type { SignFaces } from './WorldSigns';
import { NEAR_SIGN } from '../world/signs';
import { NotationChip, WorldFrame } from './components';
import { fill, strings } from './copy';
import type { MapSketch } from '../world/minimap';
import type { Rect, Vec } from '../world/logic';

export interface AppProps {
  store: Store;
  /** Title to how-to: the run's start is asked of the server here (main.ts). */
  onStart(): void;
  /** How-to to forest: the clock starts. */
  onGo(): void;
  /** The start is still out, so the how-to's button waits. */
  starting: boolean;
  onReplay(): void;
  onReadResearch(event: MouseEvent): void;
  onPost(handle: string, contact?: ContactInput): Promise<PostOutcome>;
  /** Why this run cannot be posted, or null; see `ResultsProps.cannotPost`. */
  cannotPost: string | null;
  /** The server asks a work email and consent with this run's post; see `ResultsProps.askEmail`. */
  emailRequired?: boolean;
  /** Whether the bed is playing, and the control that changes it. */
  music: { on: boolean; onToggle(): void };
  /**
   * The keys of the assets that would not load, or null when everything did. While it is set, the
   * retry screen is ALL this renders.
   */
  loadFailed: readonly string[] | null;
  onRetryLoad(): void;
  /** The minimap's picture of the forest, once the scene has read the map; null until then. */
  sketch?: MapSketch | null;
  /** Purple's feet in world pixels, for the minimap's marker. A stable function (main.ts). */
  wherePurple?: () => Vec | null;
  /**
   * The door is asking whether to go in with somebody still unmet (ui/DoorCheck.tsx). Only ever
   * true in the forest; main.ts holds it, because the walk has to pause with it.
   */
  doorAsking?: boolean;
  onDoorStay?(): void;
  onDoorGoIn?(): void;
  /**
   * The one line the toast is saying, or '': a perk just taken, or the knock at the door (main.ts
   * holds it and empties it after a moment). Its region is polite and always mounted in the world.
   */
  toast?: string;
  /** What a screen reader hears after the last choice, or '' (main.ts, P14). Never shown. */
  choiceSaid?: string;
  /**
   * The forest's view of itself, for what the DOM lays over it: the logo's board and where the cast
   * stand so the minimap can step back from them. Null until the scene is built.
   */
  signs?: (SignFaces & { castOnCanvas(): readonly Rect[] }) | null;
}

const nowhere = (): Vec | null => null;

/** How long the controls hint stays over the world once the walk begins, in ms. */
const HINT_MS = 6000;

/** How long the HUD shows the clock winding back after a rewind, in ms. */
const WIND_MS = 1200;

/**
 * THE CLOCK WINDS BACK (the Cat's Long Evening): for a moment after a rewind is taken, the face
 * counts up from the time it read to the time it now reads, easing out, under a calm ring. Under
 * reduced motion the face jumps and only the ring says something changed. `remaining` is the true
 * time left; the hook answers what the face should read, and whether it is still winding.
 */
function useWinding(perks: readonly v2.Perk[], remaining: number): { face: number; on: boolean } {
  const [wind, setWind] = useState<{ from: number; ms: number } | null>(null);
  const [, setTick] = useState(0);
  const seen = useRef(perks.length);
  useEffect(() => {
    if (perks.length < seen.current) seen.current = 0;
    const fresh = perks.slice(seen.current);
    seen.current = perks.length;
    const given = fresh.reduce((n, p) => n + (p.kind === 'rewind' ? p.ms : 0), 0);
    if (given > 0) setWind({ from: performance.now(), ms: given });
  }, [perks]);
  useEffect(() => {
    if (!wind) return;
    let frame = 0;
    const step = (): void => {
      if (performance.now() - wind.from >= WIND_MS) {
        setWind(null);
        return;
      }
      setTick((n) => n + 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [wind]);
  if (!wind) return { face: remaining, on: false };
  const still =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const p = Math.min(1, (performance.now() - wind.from) / WIND_MS);
  const eased = 1 - (1 - p) ** 3;
  return { face: still ? remaining : remaining - wind.ms * (1 - eased), on: true };
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
 * Which of the Cyera signs the scene says Purple is near, by key (world/signs.ts `NEAR_SIGN`).
 *
 * The key, and only the key, for `WITHIN_REACH`'s reason: the words are looked up in content below,
 * so an event dispatched by anything else on the page can name at most a key, and a key content does
 * not have puts nothing in the caption.
 */
function useNearSign(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    const onNear = (event: Event): void => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      const value =
        typeof detail === 'object' && detail !== null && 'key' in detail
          ? (detail as { key: unknown }).key
          : null;
      setKey(typeof value === 'string' ? value : null);
    };
    window.addEventListener(NEAR_SIGN, onNear);
    return () => void window.removeEventListener(NEAR_SIGN, onNear);
  }, []);
  return key;
}

/**
 * The canvas saying which way each traveller lies. The sibling of `WITHIN_REACH` above and a DOM
 * event for the same reason: the scene is the only thing in the build that knows where Purple is
 * standing, the UI holds no bus, and `main.ts` is not on the path between them.
 *
 * The forest scene dispatches it on the edge (world/forest-scene.ts `reportBearings`, since the
 * review of 2026-10-25, P5): until its first event the list is empty, so every traveller's line
 * reads as before rather than guessing.
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
  emailRequired = false,
  music,
  loadFailed,
  onRetryLoad,
  sketch = null,
  wherePurple = nowhere,
  doorAsking = false,
  onDoorStay = () => {},
  onDoorGoIn = () => {},
  toast = '',
  choiceSaid = '',
  signs = null,
}: AppProps) {
  const state = useStoreState(store);
  const { content } = store;
  const withinReach = useWithinReach();
  const nearSign = useNearSign();
  const bearings = useBearings();
  const character = state.active ? v2.findCharacter(content, state.active) : undefined;
  const skill = character ? v2.findSkill(content, character.skillId) : undefined;

  const inWorld = v2.RUNNING.has(state.phase);
  const remaining = remainingMs(state, store.elapsed());
  const winding = useWinding(state.perks, remaining);
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

  /*
   * THE CONTROLS HINT IS ONBOARDING (Paul's item 30g): it fades once the walk has been going for six
   * seconds, so it never sits over the Way Teller's chips at the top of the world later in the run.
   * Once per visit; it stays in the document (and in the world summary) for a screen reader.
   */
  const [hintGone, setHintGone] = useState(false);
  useEffect(() => {
    if (!inForest || hintGone) return;
    const timer = setTimeout(() => setHintGone(true), HINT_MS);
    return () => clearTimeout(timer);
  }, [inForest, hintGone]);

  /*
   * THE SIGN'S CAPTION (the client, 2026-10-23): one line, what the sign Purple is near says, from
   * content's `ui.world.signs`. Looked up with an own-property test, so a forged key -- `toString`,
   * `__proto__` -- finds nothing rather than something off the prototype.
   */
  const signWords = content.ui.world.signs as Readonly<
    Record<string, { caption: string; spoken?: string | undefined }>
  >;
  const sign =
    inForest && nearSign !== null && Object.hasOwn(signWords, nearSign)
      ? signWords[nearSign]!
      : null;

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
          {/* Before the HUD, so the clock, the basket and the Way Teller's chips paint over a logo. */}
          {signs && <WorldSigns faces={signs} />}
          <Hud
            remainingMs={remaining}
            faceMs={winding.face}
            winding={winding.on}
            basket={hudBasket(state, content)}
            labels={content.ui.hud}
          />
          {/*
            THE MINIMAP IS THE WOOD MAP'S (the client, 2026-10-22): drawn only once a skill with the
            `minimap` effect is taken, good copy or bad. The door's question stays the safety net for
            everyone else.
          */}
          {sketch && v2.hasPerk(state, 'minimap') && (
            <Minimap
              sketch={sketch}
              met={state.met}
              where={wherePurple}
              view={signs}
              summary={fill(strings['mapSummary'] ?? '', {
                met: state.met.length,
                total: content.characters.length,
              })}
            />
          )}
        </div>
      )}
      {/*
        THE TOAST: one line when a perk is taken or Purple knocks. In the existing notice style
        (`.otp-toast`, tokens.css), polite, and mounted for the whole walk so its region is there
        before its first line arrives (UX_REVIEW finding 14). Before the panels, so a modal paints
        over it.
      */}
      {inWorld && (
        <div class="otp-layer otp-layer--toast" key="world-toast">
          {/*
            THE SIGN'S CAPTION, in the toast's own style and slot, ABOVE the toast so a perk's line
            never lands on top of it and never moves when it comes and goes. Polite, atomic, and
            mounted for the whole walk like the toast, so its region is there before its first line.
            Where content gives a `spoken` form (the heart), a screen reader hears that and the eye
            reads the caption: "I love Cyera Research", never "I black heart suit Cyera Research".
          */}
          <p
            class="otp-toast otp-toast--sign"
            aria-live="polite"
            aria-atomic="true"
            data-sign-caption={sign ? (nearSign ?? '') : ''}
          >
            {sign ? (
              sign.spoken ? (
                <>
                  <span aria-hidden="true">{sign.caption}</span>
                  <span class="otp-visually-hidden">{sign.spoken}</span>
                </>
              ) : (
                sign.caption
              )
            ) : null}
          </p>
          <p class="otp-toast" role="status" aria-live="polite" aria-atomic="true" data-toast="">
            {toast || null}
          </p>
          <p class="otp-visually-hidden" aria-live="polite" aria-atomic="true" data-choice-said="">
            {choiceSaid || null}
          </p>
        </div>
      )}
      {/* Mounted BEFORE the panels so the modal layers paint over it (document order is stacking). */}
      {inWorld && (
        <WorldFrame
          key="world-frame"
          number="01"
          title={content.ui.world.title}
          labelHidden
          /*
           * THE QUEST CHIP (UI_FOUNDATIONS section 5, screen 01): what the walk is for and how far
           * through the cast the player is. Before it, nothing on Explore said there were seven
           * people to find or how many were left (the client, 2026-10-22: "i cant find the
           * character"). The minimap shows WHERE; this says HOW MANY.
           */
          aside={
            <NotationChip
              label={strings['worldGoal'] ?? ''}
              count={fill(strings['worldMetCount'] ?? '', {
                met: state.met.length,
                total: content.characters.length,
              })}
            />
          }
          music={{
            ...music,
            labels: {
              name: strings['musicLabel'] ?? '',
              on: strings['musicOn'] ?? '',
              off: strings['musicOff'] ?? '',
            },
          }}
        >
          <p class="otp-world-hint" data-faded={hintGone ? 'true' : undefined}>
            {strings['controlsHint'] ?? ''}
          </p>
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
      case 'forest': {
        if (!doorAsking) return null;
        const unmet = content.characters.filter((c) => !state.met.includes(c.id));
        const unanswered = content.characters.filter(
          (c) => state.met.includes(c.id) && state.verdicts[c.skillId] === undefined,
        );
        if (unmet.length === 0 && unanswered.length === 0) return null;
        return (
          <DoorCheck
            key="door"
            unmet={unmet.map((c) => c.name)}
            unanswered={unanswered.map((c) => c.name)}
            total={content.characters.length}
            title={strings['arriveTitle'] ?? ''}
            words={{
              ask: strings['doorAsk'] ?? '',
              askUnanswered: strings['doorAskUnanswered'] ?? '',
              still: strings['doorStill'] ?? '',
              stillAnswer: strings['doorStillAnswer'] ?? '',
              stay: strings['doorStay'] ?? '',
              goIn: strings['doorGoIn'] ?? '',
            }}
            onStay={onDoorStay}
            onGoIn={onDoorGoIn}
          />
        );
      }
      case 'title':
        return (
          <Title
            ui={content.ui}
            onPlay={onStart}
            oneStep={
              variants.start === 'one'
                ? {
                    par: fill(strings['startPar'] ?? '', {
                      par: formatElapsed(content.scoring.parMs),
                    }),
                    busy: starting,
                  }
                : undefined
            }
          />
        );
      case 'howto':
        return <HowTo ui={content.ui} onGo={onGo} busy={starting} />;
      /*
       * The conversation, then the card (the client, 2026-10-26): `talk` is the two lines and
       * Purple's replies, and "Show me" sends the INSPECT that moves the run to `card`. Two panels
       * with two keys, so the card mounts fresh and its answers get their own settle time.
       */
      case 'talk':
        return character && skill ? (
          <Conversation
            key={`talk-${character.id}`}
            words={content.ui.offer}
            character={character}
            onShowMe={() => void store.dispatch({ type: 'INSPECT', s: skill.id })}
            onWalkOn={() => walkOn(store)}
          />
        ) : null;
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
              /*
                THE WORD WEAVER'S WELCOME: word went ahead (`chrome.doorWelcome`), so the knock
                was skipped. Said first, on any arrival that had the perk -- never on a
                late run, which never reached the door.
              */
              welcome={
                ending !== 'late' && v2.hasPerk(state, 'early-welcome')
                  ? (strings['doorWelcome'] ?? '')
                  : ''
              }
              met={state.met.length}
              total={content.characters.length}
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
             * Every ending is offered Post since the client's floor (2026-10-25): a wolf run and a
             * late run score `played` and the board takes them (apps/api).
             */
            cannotPost={cannotPost}
            onPost={onPost}
            askEmail={emailRequired}
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
