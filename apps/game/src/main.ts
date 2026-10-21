import Phaser from 'phaser';
import { h, render } from 'preact';
import {
  availableFor,
  canEnterCottage,
  ending,
  findNotice,
  loadContent,
  noticePending,
  score,
  stageFit,
  trifectaLive,
} from '@otp/core';
import type { Verdict } from '@otp/core';
import gameContent from '../../../content/game.json';
import { createBus } from './bus';
import { createStore } from './store';
import { loadManifest } from './world/assets';
import { BootScene, ForestScene } from './world/scenes';
import { createInput } from './world/input';
import { createTouchControls } from './ui/touch-controls';
import { createMusicPlayer } from './audio/player';
import { watchStage } from './ui/stage';
import { App } from './ui/App';
import { ProblemScreen } from './ui/ProblemScreen';
import type { NoticeClose } from './ui/Notice';
import { createLeaderboardClient } from './net/leaderboard';
import { emit } from './embed/postMessage';
import './ui/panels.css';
import './ui/screens.css';

/** Past tense of each verdict, for the confirmation line. */
const VERDICT_STRING: Record<Verdict, string> = {
  allow: 'verdictAllowed',
  restrict: 'verdictRestricted',
  reject: 'verdictRejected',
};
const HINT_MS = 2600;
/** Long enough to read a line of dialogue without stopping the walk. */
const SAY_MS = 4200;

const cssColor = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/*
 * THE GAME COULD NOT RUN, and the visitor is told so in our words.
 *
 * Two things used to leave a visitor looking at a healthy-looking page that did nothing. An asset
 * that would not load threw from inside Phaser's loader, where no promise catch can reach it (see
 * BootScene in world/scenes.ts), and `start().catch` at the foot of this file replaced the whole
 * interface with an unstyled sentence. A crash after boot was a console line and nothing else.
 *
 * Read from the content file's raw JSON rather than from `loadContent()`'s result, on purpose: this
 * has to work when `start()` failed BEFORE the content was validated, and a problem screen that needs
 * the thing that broke to say that something broke is not one.
 *
 * NO STACK TRACE, NO ERROR MESSAGE, NO FILE NAME. The words are fixed copy. What the browser says is
 * in the console, where it always was.
 *
 * It is a separate mount from `App` because `App` may not exist yet, or may be the thing that threw.
 * The recoverable case -- an asset that 404ed -- is NOT this: that one goes through `App`, with a
 * retry that restarts the scene and keeps the page (`loadFailed` below). This is the one with
 * nowhere to retry to, so its button reloads the page.
 */
const strings = (gameContent as { strings: Record<string, string> }).strings;
let fatalShown = false;
/** Set by `start()` once there is a music player to stop. A crash must not leave a bed playing. */
let silence: () => void = () => {};

function showFatal(kind: 'load' | 'crash'): void {
  // Once. A second error while the first screen is going up must not mount a second screen.
  if (fatalShown) return;
  fatalShown = true;
  silence();
  const ui = document.getElementById('ui');
  if (!ui) {
    document.body.textContent = strings['crashTitle'] ?? '';
    return;
  }
  // Everything under the screen is out of reach of keys, focus and assistive technology.
  for (const child of Array.from(ui.children)) (child as HTMLElement).inert = true;
  document.getElementById('game')?.setAttribute('inert', '');
  const root = document.createElement('div');
  ui.append(root);
  render(
    h(ProblemScreen, {
      kind,
      title: kind === 'load' ? (strings['loadFailedTitle'] ?? '') : (strings['crashTitle'] ?? ''),
      body: kind === 'load' ? (strings['loadFailedBody'] ?? '') : (strings['crashBody'] ?? ''),
      action: kind === 'load' ? (strings['loadFailedRetry'] ?? '') : (strings['crashReload'] ?? ''),
      onAction: () => location.reload(),
    }),
    root,
  );
}

/*
 * Anything uncaught, from here on. Registered at module load, before `start()`, so the boot itself
 * is covered. The one message dropped is the browser's own `ResizeObserver loop` notice, which is
 * not an error in anything: it is raised when a callback changes layout and the observer has to
 * wait a frame, it is delivered as an `error` event for historical reasons, and showing a crash
 * screen for it would end every session that resized a window.
 */
/*
 * ONLY OUR OWN CODE MAY END A SESSION. The first version showed the crash screen for every uncaught
 * error and every unhandled rejection on the page, and an adversarial reviewer named what that
 * catches besides us: a browser extension that injects a script into the page, an opaque
 * cross-origin "Script error.", anything evaluated by a tool. On a research page a visitor's
 * extensions are not ours to break the game over. So an error ends the session only when it came
 * from a script served by this origin -- `event.filename` for an error, the stack for a rejection
 * -- which is every script the game has, because it loads nothing third-party (CLAUDE.md).
 *
 * The rest is logged rather than swallowed, so a real fault is still visible to whoever is looking.
 */
const ours = (where: string | undefined): boolean =>
  typeof where === 'string' && where.includes(location.origin);

window.addEventListener('error', (event) => {
  if (/ResizeObserver/.test(event.message)) return;
  if (!ours(event.filename)) {
    console.warn('[off-the-path] ignoring an error from outside the game:', event.message);
    return;
  }
  showFatal('crash');
});
window.addEventListener('unhandledrejection', (event) => {
  const stack = event.reason instanceof Error ? event.reason.stack : undefined;
  if (!ours(stack)) {
    console.warn('[off-the-path] ignoring a rejection from outside the game');
    return;
  }
  showFatal('crash');
});

async function start(): Promise<void> {
  const content = loadContent(gameContent);
  const manifest = await loadManifest();

  const stage = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  if (!stage || !uiRoot) throw new Error('Page is missing the #game or #ui container');

  const store = createStore(content, () => performance.now());
  const bus = createBus();
  /** The assets that would not load, or null. While it is set the world is not on screen. */
  let loadFailure: readonly string[] | null = null;
  const leaderboard = createLeaderboardClient(content);
  // The world keeps its own "is a panel open" flag: a notice is a DOM panel that does not change
  // the store phase, and Purple must not keep walking while the player is reading it.
  const worldHasInput = (): boolean =>
    loadFailure === null && store.getState().phase === 'explore' && noticeId === null;
  const input = createInput(window, {
    onBack: () => void store.dispatch({ type: 'BACK' }),
    isActive: worldHasInput,
  });
  /*
   * The pad's six accessible names, from the content file like every other player-facing word
   * (CLAUDE.md rule 3). `?? ''` and no literal behind it on purpose: a key that goes missing must
   * fail a guard rather than quietly render English from a component. Two guards cover it --
   * test/strings.test.ts on the read, and e2e/world-reach.spec.ts, which finds all six controls by
   * the name content gives them and so fails on an empty one.
   */
  const touch = createTouchControls(input, {
    walkGroup: content.strings['touchWalkLabel'] ?? '',
    up: content.strings['touchWalkUp'] ?? '',
    down: content.strings['touchWalkDown'] ?? '',
    left: content.strings['touchWalkLeft'] ?? '',
    right: content.strings['touchWalkRight'] ?? '',
    stop: content.strings['touchWalkStop'] ?? '',
    interact: content.strings['touchInteract'] ?? '',
  });
  uiRoot.append(touch.root);

  const panels = document.createElement('div');
  uiRoot.prepend(panels);

  /*
   * The music. Off until the player asks for it: this embeds in an iframe on the research page,
   * and sound that starts by itself in someone else's page is how an embed gets pulled. It can
   * only ever start after a click anyway, which the browser requires and the design wants.
   */
  const music = createMusicPlayer();
  silence = music.stop;

  let hint: string | null = null;
  /** The last thing a bystander said, and who said it. Pure flavour; no game state moves. */
  let say: { name: string; line: string } | null = null;
  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  /** How many times each bystander has been greeted, so they cycle instead of repeating. */
  const greeted = new Map<string, number>();
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  // The notice Purple is currently standing at, and the ones she has already walked away from.
  let noticeId: string | null = null;
  const dismissed = new Set<string>();

  /*
   * Everything outside the store that has to agree with what is on screen: whether the pad is up,
   * whether the bed is ducked, and what `#game` says it is showing.
   *
   * ONE function, because the two things that move it are not the same event. The store subscriber
   * runs on a dispatch; a notice is a DOM panel that changes no phase, so opening and closing one
   * dispatches nothing at all. `music.duck` used to live only in the subscriber, so the bed dropped
   * on the READ_NOTICE dispatch and nothing was ever left to raise it again -- measured on the
   * built page with the master gain instrumented: 0.34 on the walk, 0.1 from the moment the post
   * was read, still 0.1 after Walk on and for the rest of the run. Opening the panel did not duck
   * it, and closing it did not undo it; only the one dispatch in the middle ever moved it.
   *
   * `data-phase` is published here for the same reason. It is the store phase while the world is
   * the thing on screen, and `notice` while the post is over it -- the store phase stays `explore`
   * behind an `aria-modal` panel, so the attribute said the player was walking when they could not
   * move. It is the only honest value the world has for this state, since the reducer has none.
   */
  const syncWorldChrome = (): void => {
    const walkable = worldHasInput();
    stage.dataset['phase'] = noticeId === null ? store.getState().phase : 'notice';
    touch.setVisible(walkable);
    // Reading the fine print should be the quiet moment, so the bed drops while a panel is up.
    music.duck(!walkable);
  };

  const beginRun = (): void => {
    store.dispatch({ type: 'START', runId: crypto.randomUUID() });
    store.dispatch({ type: 'BEGIN' });
    // "Begin the walk" is the gesture the browser wants before any audio can sound.
    music.begin();
    emit('otp:started', { runId: store.getState().runId });
  };

  const draw = (): void =>
    void render(
      h(App, {
        store,
        content,
        hint,
        say,
        music: {
          on: music.wanted,
          onToggle: () => {
            music.toggle();
            draw();
          },
        },
        loadFailed: loadFailure,
        onRetryLoad: () => {
          // Clear first, so the next frame the player sees is the title or the world, not the
          // failure again; if the files fail a second time `loadFailed` puts it straight back.
          loadFailure = null;
          syncWorldChrome();
          draw();
          boot.retry();
        },
        onStart: beginRun,
        onReplay: () => {
          // The store is only half the run: the notices Purple walked past and where she is standing
          // both live outside it, and a replay has to forget them too.
          dismissed.clear();
          greeted.clear();
          noticeId = null;
          hint = null;
          say = null;
          clearTimeout(sayTimer);
          clearTimeout(hintTimer);
          store.dispatch({ type: 'RESET' });
          bus.emit('restartRun', undefined);
          beginRun();
        },
        onReadResearch: () => emit('otp:cta', {}),
        onPost: (handle: string) => leaderboard.submit(store.getState(), handle),
        noticeId,
        onReadNotice: (id: string) => {
          const reason = store.dispatch({ type: 'READ_NOTICE', n: id });
          if (reason) console.warn(`READ_NOTICE ${id} rejected: ${reason}`);
          draw();
        },
        /*
         * Closing the post. `walked-on` is the player saying no to it, and only that is recorded:
         * Esc is the reflex every other panel in this game teaches -- the card and the
         * conversation both back out one level on it -- and a reflex must not spend a thing the
         * run is scored on. It used to, because `useFocusTrap` was handed `onWalkOn` as its Esc.
         *
         * The default is `walked-on`, so an App that forwards this without the argument keeps the
         * old, safe behaviour rather than silently making every close free. e2e/notice-lifecycle
         * holds the difference down from the outside.
         */
        onLeaveNotice: (how: NoticeClose = 'walked-on') => {
          if (noticeId !== null && how === 'walked-on') dismissed.add(noticeId);
          noticeId = null;
          syncWorldChrome();
          draw();
        },
      }),
      panels,
    );

  const showSay = (name: string, line: string): void => {
    say = { name, line };
    draw();
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      say = null;
      draw();
    }, SAY_MS);
  };

  const showHint = (message: string): void => {
    hint = message;
    draw();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint = null;
      draw();
    }, HINT_MS);
  };

  bus.on('greetBystander', ({ bystanderId }) => {
    if (store.getState().phase !== 'explore') return;
    const who = content.bystanders.find((b) => b.id === bystanderId);
    if (!who) return;
    // Once all three legs are live the forest has a different thing to say, if this one has a
    // line for it. Read-only: greeting changes nothing.
    const exposed = trifectaLive(store.getState().verdicts, content);
    if (exposed && who.whenExposed) {
      showSay(who.name, who.whenExposed);
      return;
    }
    const seen = greeted.get(who.id) ?? 0;
    greeted.set(who.id, seen + 1);
    showSay(who.name, who.lines[seen % who.lines.length]!);
  });

  bus.on('interact', ({ characterId }) => {
    const reason = store.dispatch({ type: 'MEET', c: characterId });
    if (reason) console.warn(`MEET ${characterId} rejected: ${reason}`);
  });

  bus.on('reachedNotice', ({ noticeId: id }) => {
    const state = store.getState();
    if (state.phase !== 'explore') return;
    if (noticeId) return;
    /*
     * A `notice-<id>` the content does not define is a map that has outrun `content/game.json`.
     * Opening the panel for it bricked the run: `noticeId` went non-null, so `worldHasInput` went
     * false and Purple stopped walking, while App's `findNotice` returned undefined and rendered no
     * panel -- no Walk on, no Esc, nothing to close. Measured on the built page: Purple at
     * (176, 672), 600ms of ArrowRight, still (176, 672), and no error anywhere to say why. The
     * warning is for whoever renames the object or the notice.
     */
    const notice = findNotice(content, id);
    if (notice === undefined) {
      console.warn(`reachedNotice ${id}: the content has no notice with that id`);
      return;
    }

    /*
     * Whether this post is still worth opening. Two separate reasons, and it only takes one.
     *
     * `hiddenPending` is the beat the game is built to deliver: the instruction on the post has
     * not taken effect yet and all three legs are live, so reading it now would actually do
     * something. The reducer has allowed that re-reading since UX_REVIEW blocker 2; this handler
     * is what offers it.
     *
     * `errandWaiting` is the one it missed. Grandma's errand names notices by `act`, and
     * `errandGoals` only counts such a goal once the reading is in `state.read` -- so a post that
     * has never been read is worth a goal no matter what the capabilities are doing. The only
     * clear lane east out of the spawn runs straight past the forest post, so the natural first
     * act of the game meets it before a single verdict exists; one Walk on, or one Esc, latched it
     * shut for the whole run and took the goal with it. Measured end to end on the built page,
     * restrict/restrict/restrict with both bonus questions: 950 reading the post, 850 having
     * waved it away in the first ten seconds, and no way back to the 950 because the only re-open
     * path needed all three legs live, which that line never reaches.
     *
     * It goes quiet the moment the reading happens, because `read` is what the goal is scored on:
     * this re-offers an unread post, it does not nag about one already read.
     */
    const hiddenPending =
      noticePending(notice, state.flags) && trifectaLive(state.verdicts, content);
    const errandWaiting =
      content.scoring.errandGoals.some((g) => g.act === id) && !state.read.includes(id);
    if (!hiddenPending && !errandWaiting && (dismissed.has(id) || state.read.includes(id))) return;
    noticeId = id;
    syncWorldChrome();
    draw();
  });

  bus.on('loadFailed', ({ keys }) => {
    loadFailure = keys;
    // The pad and the bed follow what is on screen, and what is on screen is the retry screen.
    syncWorldChrome();
    draw();
  });

  bus.on('enteredCottage', () => {
    if (store.getState().phase !== 'explore') return;
    if (!canEnterCottage(store.getState(), content)) {
      if (!hint) showHint(content.strings['cottageHint'] ?? '');
      return;
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  });

  /*
   * The camera Phaser is born with.
   *
   * This was a literal `{ width: 480, height: 270 }` that fitStage overwrote on the first frame --
   * a camera size written down rather than derived, which is the exact mistake packages/core's
   * camera.ts exists to stop, and which cost this project two rounds of art composed against a
   * rectangle that does not exist. Derived here from the same two pure functions ui/stage.ts
   * calls, so the canvas is created at the size it is going to keep.
   */
  const firstView = stageFit(
    availableFor({ width: innerWidth, height: innerHeight }).available,
  ).view;

  // Held, not inlined, because the retry screen has to be able to restart it.
  const boot = new BootScene(manifest, bus);

  // Phaser reads this too, so movement, prompts and triggers all stop together.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: stage,
    width: firstView.width,
    height: firstView.height,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: cssColor('--cyera-black'),
    scale: { mode: Phaser.Scale.NONE },
    // Plain <img> loading keeps the strict CSP free of a blob: allowance.
    loader: { imageLoadType: 'HTMLImageElement' },
    /*
     * Phaser builds a WebAudioSoundManager and an AudioContext on boot unless told not to, and
     * this game has never played a sound through Phaser. That context was being created on every
     * page load, in an iframe on someone else's page, for nothing. The music has its own context
     * and builds it only when the player asks for sound.
     */
    audio: { noAudio: true },
    /*
     * The same argument as `noAudio`, and it is the larger half of the boot bill.
     *
     * Phaser's PipelineManager compiles the whole built-in FX set on boot unless told not to --
     * blur, bloom, glow, shadow, displacement, the lot -- and this game applies none of them: no
     * `preFX`, no `postFX`, no `setPipeline` anywhere in the tree. Every one of those shaders was
     * being compiled on every page load, in an iframe on someone else's page, to be used by
     * nothing. A pixel-art game that draws tiles and sprites at integer scale wants the plain
     * multi pipeline and nothing else.
     *
     * Measured end to end, cold, with the scene drawing exactly the same pixels either way; the
     * numbers and the identical render are in the task report. If a later round wants a built-in
     * effect on a game object, these two lines are what it has to take out, and the cost of taking
     * them out is the boot time back.
     */
    disablePreFX: true,
    disablePostFX: true,
    scene: [boot, new ForestScene(store, bus, input, worldHasInput)],
  });

  /*
   * THE CANVAS BOX HAS TO REACH CSS BEFORE THE DOM PAINTS.
   *
   * ui/stage.ts publishes --otp-canvas-x/y/w/h, and three position:fixed panels -- the world
   * frame, the title dock and the HUD -- are positioned entirely from them. This call used to sit
   * in `bus.on('worldReady')`, which fires only once BootScene has loaded every asset, so the
   * title screen painted first against the 0px fallbacks and then lurched into place: ONE layout
   * shift, measured at 0.7811 at 1280x800 against a "good" threshold of 0.1, on the first screen
   * of a public research-page asset. In landscape .otp-title-panel is
   * `min(306px * var(--otp-ui), 62%)` of the dock, and 62% of a 0px dock leaves the copy column at
   * nothing but its own 48px of padding before it snaps out to 306px, taking the heading,
   * Grandma's note and the body copy with it.
   *
   * Phaser's Game.boot() calls AddToDOM before it emits BOOT, so game.canvas exists and is in the
   * document by then -- before any scene preloads, and before the first `draw()` below. Boot runs
   * SYNCHRONOUSLY inside the constructor whenever document.readyState is already 'interactive' or
   * 'complete' (phaser/src/dom/DOMContentLoaded.js), which is the case here because this is a
   * deferred module script that has already awaited the manifest, so by this line the event has
   * usually been and gone: `isBooted` is the path actually taken, and the listener covers a boot
   * still waiting on the DOM. Either way fitStage runs in this same task, so the first paint is
   * already the final layout. The camera size is derived from the space available, so the canvas
   * fills its frame instead of being letterboxed; the scene reads this.scale every frame.
   *
   * `stage.dataset['ready']` deliberately STAYS on worldReady. It is the gate every e2e spec
   * waits on and it has to keep meaning "the world is loaded", not "the canvas has a size".
   */
  const fitToStage = (): void => {
    watchStage(stage, game.canvas, (w, h) => game.scale.resize(w, h));
  };
  if (game.isBooted) fitToStage();
  else game.events.once('boot', fitToStage);

  bus.on('worldReady', () => {
    stage.dataset['ready'] = 'true';
    emit('otp:ready', { version: content.version });
  });

  let lastPhase = store.getState().phase;
  let lastVerdicts = 0;
  store.subscribe((state) => {
    syncWorldChrome();

    // A verdict earns a brief confirmation, by shape and words, never by colour alone.
    const verdictCount = Object.keys(state.verdicts).length;
    if (verdictCount > lastVerdicts) {
      const [skillId, verdict] = Object.entries(state.verdicts).at(-1)!;
      const skill = content.skills.find((s) => s.id === skillId);
      /*
       * An offer waved through without opening the card gets the neutral line rather than
       * "Allowed: Night Light". The player did not weigh it, and the toast should not pretend
       * they did; what they did is in the Results.
       */
      const onTrust = !state.inspected.includes(skillId);
      const word = content.strings[VERDICT_STRING[verdict as Verdict]] ?? verdict;
      if (onTrust) showHint(content.strings['tookOnTrustToast'] ?? '');
      else if (skill) showHint(`${word}: ${skill.name}`);
      emit('otp:verdict', { skillId, verdict });
    }
    lastVerdicts = verdictCount;

    if (state.phase === 'results' && lastPhase !== 'results')
      emit('otp:completed', {
        score: score(state.log, content).total,
        ending: ending(state, content).id,
      });
    lastPhase = state.phase;

    draw();
  });

  /*
   * Seed what the subscriber would have set, because it only runs on a state CHANGE and the first
   * phase is never a change. Without this the joystick and A button start visible and stay visible
   * through the whole title screen -- invisible before only because the title used to be an opaque
   * full-screen panel painted over them.
   */
  syncWorldChrome();
  draw();

  /*
   * DOT ACCESS, NOT `env['VITE_E2E']` -- the same reason as forest-scene.ts's gate. Vite folds
   * `import.meta.env.VITE_E2E` to a literal at build time, so the minifier drops this branch
   * entirely from a plain production build. The bracket form is a runtime lookup on an object
   * literal, which survives minification: measured, a plain `pnpm build` shipped the whole
   * `{ store, bus, content }` payload, and a VITE_E2E build was byte-identical to it. This is a
   * public asset for a data security company; the store, the bus and the content should not be
   * reachable from the page. apps/game/test/csp.test.ts asserts the built bundle carries no
   * `__otp` so a revert to the bracket form reddens rather than quietly shipping.
   */
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1')
    Object.defineProperty(window, '__otp', { value: { store, bus, content }, configurable: true });
}

start().catch((err: unknown) => {
  // Boot itself failed -- the manifest would not fetch, or an asset it names is missing from the
  // build -- so there is no game to retry into. Our words, no trace; the console has the rest.
  console.error(err);
  showFatal('load');
});
