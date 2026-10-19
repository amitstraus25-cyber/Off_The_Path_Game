import Phaser from 'phaser';
import { h, render } from 'preact';
import {
  canEnterCottage,
  ending,
  findNotice,
  loadContent,
  noticePending,
  score,
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

const LOGICAL = { width: 480, height: 270 };

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
  const touch = createTouchControls(input);
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
    /*
     * Phaser builds a WebAudioSoundManager and an AudioContext on boot unless told not to, and
     * this game has never played a sound through Phaser. That context was being created on every
     * page load, in an iframe on someone else's page, for nothing. The music has its own context
     * and builds it only when the player asks for sound.
     */
    audio: { noAudio: true },
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
