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

async function start(): Promise<void> {
  const content = loadContent(gameContent);
  const manifest = await loadManifest();

  const stage = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  if (!stage || !uiRoot) throw new Error('Page is missing the #game or #ui container');

  const store = createStore(content, () => performance.now());
  const bus = createBus();
  const leaderboard = createLeaderboardClient(content);
  // The world keeps its own "is a panel open" flag: a notice is a DOM panel that does not change
  // the store phase, and Red must not keep walking while the player is reading it.
  const worldHasInput = (): boolean => store.getState().phase === 'explore' && noticeId === null;
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

  let hint: string | null = null;
  /** The last thing a bystander said, and who said it. Pure flavour; no game state moves. */
  let say: { name: string; line: string } | null = null;
  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  /** How many times each bystander has been greeted, so they cycle instead of repeating. */
  const greeted = new Map<string, number>();
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  // The notice Red is currently standing at, and the ones she has already walked away from.
  let noticeId: string | null = null;
  const dismissed = new Set<string>();

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
        onStart: beginRun,
        onReplay: () => {
          // The store is only half the run: the notices Red walked past and where she is standing
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
        onLeaveNotice: () => {
          if (noticeId) dismissed.add(noticeId);
          noticeId = null;
          touch.setVisible(worldHasInput());
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
     * The second of the two latches docs/UX_REVIEW.md blocker 2 found. The reducer will now accept
     * a second reading of a notice whose hidden instruction has not fired, but it never got the
     * chance: this handler refused to re-open the panel once the post had been read or waved away,
     * and `dismissed` is only cleared on replay.
     *
     * So the panel re-opens in exactly one case -- the post still has something to demonstrate AND
     * all three legs are now live, which is to say reading it now would actually do something. That
     * is the one beat the whole game is built to deliver, and it was unreachable by every route but
     * one narrow ordering. Once it fires, `noticePending` goes false and it never asks again.
     */
    const notice = findNotice(content, id);
    const wouldFire =
      notice !== undefined &&
      noticePending(notice, state.flags) &&
      trifectaLive(state.verdicts, content);
    if (!wouldFire && (dismissed.has(id) || state.read.includes(id))) return;
    noticeId = id;
    touch.setVisible(false);
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
    scene: [new BootScene(manifest), new ForestScene(store, bus, input, worldHasInput)],
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
    stage.dataset['phase'] = state.phase;
    touch.setVisible(worldHasInput());
    // Reading the fine print should be the quiet moment, so the bed drops while a panel is up.
    music.duck(!worldHasInput());

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
  stage.dataset['phase'] = store.getState().phase;
  touch.setVisible(worldHasInput());
  draw();

  if (import.meta.env.DEV || import.meta.env['VITE_E2E'] === '1')
    Object.defineProperty(window, '__otp', { value: { store, bus, content }, configurable: true });
}

start().catch((err: unknown) => {
  const el = document.getElementById('ui');
  if (el) el.textContent = 'Something went wrong loading the game.';
  console.error(err);
});
