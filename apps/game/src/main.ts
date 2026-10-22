import Phaser from 'phaser';
import { h, render } from 'preact';
import { v2 } from '@otp/core';
import rawContent from '../../../content/game.v2.json';
import { createBus } from './bus';
import type { Bus } from './bus';
import { createStore } from './store';
import { loadManifest } from './world/assets';
import type { Manifest } from './world/assets';
import { BootScene, ForestScene } from './world/scenes';
import { cardOwed, gameRun, localSeed, walkOn } from './world/run';
import { createInput } from './world/input';
import { createTouchControls } from './ui/touch-controls';
import { createMusicPlayer } from './audio/player';
import { watchStage } from './ui/stage';
import { cabinetFor } from './ui/cabinet';
import { App } from './ui/App';
import { ProblemScreen } from './ui/ProblemScreen';
import { marqueeText, strings } from './ui/copy';
import { mountMarquee } from './ui/marquee';
import { startRun, submit } from './net/leaderboard';
import type { RunStart } from './net/leaderboard';
import { emit } from './embed/postMessage';
// Before panels.css, so hud.css lands first in the cascade, as the HUD's selectors expect.
import './ui/hud.css';
import './ui/panels.css';
import './ui/screens.css';

/** How often the clock is read for the HUD and the hard stop. Four times a second is plenty. */
const TICK_MS = 250;

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
 * Read from the chrome strings (ui/copy.ts), never from `loadContent()`'s result, on purpose: this
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
/*
 * The cabinet's marquee goes up first, before anything that can fail: it is furniture, and the
 * problem screen below stands inside the cabinet like every other screen.
 */
mountMarquee(document.body, marqueeText);

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

/**
 * Phaser around the forest scene, sized from the stage. Returns the boot scene, which the retry
 * screen restarts.
 */
function mountWorld(
  stage: HTMLElement,
  manifest: Manifest,
  bus: Bus,
  forest: ForestScene,
): BootScene {
  /*
   * The camera Phaser is born with.
   *
   * This was a literal `{ width: 480, height: 270 }` that fitStage overwrote on the first frame --
   * a camera size written down rather than derived, which is the exact mistake packages/core's
   * camera.ts exists to stop, and which cost this project two rounds of art composed against a
   * rectangle that does not exist. Derived here from the same pure function ui/stage.ts calls --
   * the cabinet's, which reserves the marquee and the deck first -- so the canvas is created at the
   * size it is going to keep.
   */
  const firstView = cabinetFor({ width: innerWidth, height: innerHeight }).view;

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
    scene: [boot, forest],
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
  return boot;
}

async function start(): Promise<void> {
  const manifest = await loadManifest();

  const stage = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  if (!stage || !uiRoot) throw new Error('Page is missing the #game or #ui container');

  const content = v2.loadContent(rawContent);
  /*
   * THE TEST CLOCK OVERRIDE, and the only test switch the game keeps. A skew added to the injected
   * clock, so an e2e spec can put the run at 2:59 without waiting three minutes; the limit is never
   * touched (v2/state.ts: slow the clock, not the limit). The only writer is `testClock.advance`
   * on the dot-access-gated debug handle below, and test/csp.test.ts greps the shipped bundle for
   * that name.
   */
  let skew = 0;
  /*
   * The first deal is local and is only ever a placeholder: every run is re-dealt at its start, from
   * the server's seed when there is one (`startTheRun` below).
   */
  const store = createStore(content, () => performance.now() + skew, localSeed());
  const bus = createBus();
  /** The assets that would not load, or null. While it is set the world is not on screen. */
  let loadFailure: readonly string[] | null = null;

  /*
   * THE RUN'S START, AND WHO DEALT IT. `startRun()` asks `POST /api/start` for a seed and a token
   * (apps/api); the token is what lets this run be posted, and null means the board is unavailable
   * or offline -- the game then deals from its own seed and the reveal says this run cannot be
   * posted. Asked when the player presses Begin, and once per replay, never on page load: the
   * server's posting window counts from the token, so a token fetched early and held would close.
   */
  let token: string | null = null;
  let pending: Promise<RunStart | null> | null = null;
  let starting = false;

  const walkable = (): boolean => loadFailure === null && store.getState().phase === 'forest';
  const input = createInput(window, {
    // Esc on an open offer walks on, exactly as the panel's own Walk on does.
    onBack: () => walkOn(store),
    isActive: walkable,
  });
  const touch = createTouchControls(input, {
    walkGroup: strings['touchWalkLabel'] ?? '',
    up: strings['touchWalkUp'] ?? '',
    down: strings['touchWalkDown'] ?? '',
    left: strings['touchWalkLeft'] ?? '',
    right: strings['touchWalkRight'] ?? '',
    stop: strings['touchWalkStop'] ?? '',
    interact: strings['touchInteract'] ?? '',
  });
  uiRoot.append(touch.root);
  const panels = document.createElement('div');
  uiRoot.prepend(panels);

  /*
   * The music. Off until the player asks for it: this embeds in an iframe on the research page,
   * and sound that starts by itself in someone else's page is how an embed gets pulled.
   */
  const music = createMusicPlayer();
  silence = music.stop;

  /** Everything outside the store that has to agree with what is on screen. */
  const syncWorldChrome = (): void => {
    stage.dataset['phase'] = store.getState().phase;
    touch.setMode(walkable() ? 'play' : 'idle');
    // Reading a card should be the quiet moment, so the bed drops while a panel is up.
    music.duck(!walkable());
  };

  /** Asks the server for this run's start. Every press of Begin or of Walk it again asks once. */
  const askForStart = (): void => {
    pending = startRun();
  };

  /**
   * Deals the run and starts the clock: from the server's seed when the start came back, from a
   * local one when it did not. RESET then START puts the store back in `howto` with the new deal,
   * and BEGIN leaves it at 0ms on the run clock.
   */
  const startTheRun = async (replay = false): Promise<void> => {
    if (starting) return;
    starting = true;
    // The press is the gesture the browser wants before any audio can sound, so this runs on it,
    // before the wait for the server and not after.
    music.begin();
    draw();
    const answer = pending ? await pending : null;
    pending = null;
    token = answer?.token ?? null;
    store.dispatch({ type: 'RESET', seed: answer?.seed ?? localSeed() });
    store.dispatch({ type: 'START', runId: crypto.randomUUID() });
    store.dispatch({ type: 'BEGIN' });
    /*
     * Purple back to the spawn only now, AFTER the new run is in the forest. Emitted while the old
     * run still stood at the cottage, the scene re-staged the arrival on its next frame (it does so
     * whenever the run is at the cottage and it has not yet), put her back on the doorstep, and the
     * new run walked straight through the door with an `arrived` at 12ms.
     */
    if (replay) bus.emit('restartRun', undefined);
    starting = false;
    emit('otp:started', { runId: store.getState().runId });
    draw();
  };

  const draw = (): void =>
    void render(
      h(App, {
        store,
        starting,
        music: {
          on: music.wanted,
          onToggle: () => {
            music.toggle();
            draw();
          },
        },
        loadFailed: loadFailure,
        onRetryLoad: () => {
          loadFailure = null;
          syncWorldChrome();
          draw();
          boot.retry();
        },
        onStart: () => {
          askForStart();
          store.dispatch({ type: 'START', runId: crypto.randomUUID() });
        },
        onGo: () => void startTheRun(),
        onReplay: () => {
          askForStart();
          void startTheRun(true);
        },
        onReadResearch: () => emit('otp:cta', {}),
        cannotPost: token === null ? (strings['postUnavailable'] ?? '') : null,
        // Results renders no Post button without a token (`cannotPost`), so `token ?? ''` is
        // never sent; the server would refuse an empty one with a 400 if it ever were.
        onPost: (handle: string) =>
          submit(handle, v2.toRunLog(store.getState()), token ?? '', strings),
      }),
      panels,
    );

  bus.on('interact', ({ characterId }) => {
    const reason = store.dispatch({ type: 'MEET', c: characterId });
    if (reason) console.warn(`MEET ${characterId} rejected: ${reason}`);
  });
  // Any basket may walk through the door; the score is what it says about the basket.
  bus.on('enteredCottage', () => {
    if (store.getState().phase === 'forest') store.dispatch({ type: 'ENTER_COTTAGE' });
  });
  bus.on('loadFailed', ({ keys }) => {
    loadFailure = keys;
    syncWorldChrome();
    draw();
  });

  // Held, not inlined, because the retry screen has to be able to restart it.
  const boot = mountWorld(
    stage,
    manifest,
    bus,
    new ForestScene(gameRun(store), bus, input, walkable),
  );

  bus.on('worldReady', () => {
    stage.dataset['ready'] = 'true';
    emit('otp:ready', { version: content.version });
  });

  let lastPhase = store.getState().phase;
  let lastVerdicts = 0;
  store.subscribe((state) => {
    /*
     * THE CARD OPENS BY ITSELF. A MEET has just put the run in `talk`: read its card now, and let
     * the nested dispatch do this listener's work for the state it produces. `lastPhase` is moved
     * first, so the nested call sees the step it is answering and this one is not repeated. Should
     * the INSPECT ever be refused without moving the run, this call carries on as it would have.
     */
    const owed = cardOwed(lastPhase, state, content);
    if (owed) {
      lastPhase = state.phase;
      store.dispatch({ type: 'INSPECT', s: owed });
      if (store.getState() !== state) return;
    }
    syncWorldChrome();
    const count = Object.keys(state.verdicts).length;
    if (count > lastVerdicts) {
      const [skillId, verdict] = Object.entries(state.verdicts).at(-1)!;
      emit('otp:verdict', { skillId, verdict });
    }
    lastVerdicts = count;
    const ended = state.phase === 'cottage' || state.phase === 'late';
    if (ended && lastPhase !== state.phase) {
      const run = v2.result(state, content);
      emit('otp:completed', { score: run.total, ending: run.ending ?? 'late' });
    }
    lastPhase = state.phase;
    draw();
  });

  // The hard stop and the HUD's second hand. The reducer also ends a run on any action stamped
  // past the limit, so a throttled background tab cannot buy time by starving this timer.
  setInterval(() => {
    if (!v2.RUNNING.has(store.getState().phase)) return;
    if (store.elapsed() >= v2.TIME_LIMIT_MS) store.dispatch({ type: 'TIME_UP' });
    else draw();
  }, TICK_MS);

  // The subscriber only runs on a CHANGE, and the first phase is never one.
  syncWorldChrome();
  draw();

  /*
   * DOT ACCESS, NOT `env['VITE_E2E']`. Vite folds `import.meta.env.VITE_E2E` to a literal at build
   * time, so the minifier drops this branch from a plain production build; the bracket form is a
   * runtime lookup that survives minification and once shipped the whole payload. This is a public
   * asset for a data security company: the store, the bus, the content and the test clock must not
   * be reachable from the page. apps/game/test/csp.test.ts asserts the built bundle carries none of
   * `__otp` and `testClock`.
   */
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1')
    Object.defineProperty(window, '__otp', {
      value: {
        store,
        bus,
        content,
        testClock: {
          advance: (ms: number) => {
            skew += ms;
          },
        },
      },
      configurable: true,
    });
}

start().catch((err: unknown) => {
  // Boot itself failed -- the manifest would not fetch, or an asset it names is missing from the
  // build -- so there is no game to retry into. Our words, no trace; the console has the rest.
  console.error(err);
  showFatal('load');
});
