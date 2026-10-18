import Phaser from 'phaser';
import { h, render } from 'preact';
import { canEnterCottage, ending, loadContent, score } from '@otp/core';
import type { Verdict } from '@otp/core';
import gameContent from '../../../content/game.json';
import { createBus } from './bus';
import { createStore } from './store';
import { loadManifest } from './world/assets';
import { BootScene, ForestScene } from './world/scenes';
import { createInput } from './world/input';
import { createTouchControls } from './ui/touch-controls';
import { watchStage } from './ui/stage';
import { App } from './ui/App';
import { createLeaderboardClient } from './net/leaderboard';
import { emit } from './embed/postMessage';
import './ui/panels.css';
import './ui/screens.css';

const LOGICAL = { width: 480, height: 270 };

/** Past tense of each verdict, for the confirmation line. */
const VERDICT_STRING: Record<Verdict, string> = {
  allow: 'verdictAllowed',
  restrict: 'verdictRestricted',
  reject: 'verdictRejected',
};
const HINT_MS = 2600;

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
  const touch = createTouchControls(input);
  uiRoot.append(touch.root);

  const panels = document.createElement('div');
  uiRoot.prepend(panels);

  let hint: string | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  // The notice Red is currently standing at, and the ones she has already walked away from.
  let noticeId: string | null = null;
  const dismissed = new Set<string>();

  const beginRun = (): void => {
    store.dispatch({ type: 'START', runId: crypto.randomUUID() });
    store.dispatch({ type: 'BEGIN' });
    emit('otp:started', { runId: store.getState().runId });
  };

  const draw = (): void =>
    void render(
      h(App, {
        store,
        content,
        hint,
        onStart: beginRun,
        onReplay: () => {
          // The store is only half the run: the notices Red walked past and where she is standing
          // both live outside it, and a replay has to forget them too.
          dismissed.clear();
          noticeId = null;
          hint = null;
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

  const showHint = (message: string): void => {
    hint = message;
    draw();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint = null;
      draw();
    }, HINT_MS);
  };

  bus.on('interact', ({ characterId }) => {
    const reason = store.dispatch({ type: 'MEET', c: characterId });
    if (reason) console.warn(`MEET ${characterId} rejected: ${reason}`);
  });

  bus.on('reachedNotice', ({ noticeId: id }) => {
    if (store.getState().phase !== 'explore') return;
    if (noticeId || dismissed.has(id) || store.getState().read.includes(id)) return;
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

  // Phaser reads this too, so movement, prompts and triggers all stop together.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: stage,
    width: LOGICAL.width,
    height: LOGICAL.height,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: cssColor('--cyera-black'),
    // The canvas keeps its logical size; ui/stage.ts scales it by whole device pixels.
    scale: { mode: Phaser.Scale.NONE },
    // Plain <img> loading keeps the strict CSP free of a blob: allowance.
    loader: { imageLoadType: 'HTMLImageElement' },
    scene: [new BootScene(manifest), new ForestScene(store, bus, input, worldHasInput)],
  });

  bus.on('worldReady', () => {
    // The camera size is derived from the space available, so the canvas fills its frame instead
    // of being letterboxed; the scene reads this.scale every frame and follows.
    watchStage(stage, game.canvas, (w, h) => game.scale.resize(w, h));
    stage.dataset['ready'] = 'true';
    emit('otp:ready', { version: content.version });
  });

  let lastPhase = store.getState().phase;
  let lastVerdicts = 0;
  store.subscribe((state) => {
    stage.dataset['phase'] = state.phase;
    touch.setVisible(worldHasInput());

    // A verdict earns a brief confirmation, by shape and words, never by colour alone.
    const verdictCount = Object.keys(state.verdicts).length;
    if (verdictCount > lastVerdicts) {
      const [skillId, verdict] = Object.entries(state.verdicts).at(-1)!;
      const skill = content.skills.find((s) => s.id === skillId);
      const word = content.strings[VERDICT_STRING[verdict as Verdict]] ?? verdict;
      if (skill) showHint(`${word}: ${skill.name}`);
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
