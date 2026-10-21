import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { v2 } from '@otp/core';
import rawV2 from '../../../../content/game.v2.json';
import { createV2Store } from '../store';
import type { Clock, V2Store } from '../store';
import type { Bus } from '../bus';
import { Hud } from '../ui/Hud';
import type { HudBasketItem } from '../ui/Hud';
import { Panel } from '../ui/components';
import { createTouchControls } from '../ui/touch-controls';
import { createInput } from './input';
import type { Input } from './input';
import { ForestScene } from './forest-scene';
import type { WorldRun } from './run';

/*
 * v2 IN THE REAL FOREST, BEHIND A DEV/E2E SWITCH (PLAN.md Phase C).
 *
 * The live game stays v1 until Phase D. `main.ts` reaches this module only under
 * `import.meta.env.DEV || import.meta.env.VITE_E2E === '1'` -- DOT ACCESS, so a production build
 * folds the condition to false and the minifier drops this file and everything only it reaches,
 * the v2 content included. `test/csp.test.ts` greps the shipped bundle for the switch's name and
 * the clock override's name so a revert to the bracket form reddens rather than ships.
 *
 * What is real here: the map, the scene, the cast standing where `content/game.v2.json` says, the
 * v2 reducer behind a store with an injected clock, the 180-second hard stop and the HUD. What is
 * NOT: the offer and ended panels below. They are the least that lets take and leave reach the
 * reducer, and say so on screen. Phase D replaces both, with words from content (golden rule 3);
 * these literals never reach a player, because this file never reaches a production bundle.
 */

/** The query parameter that turns v2 on, in a dev or e2e build only. Named in csp.test.ts. */
export const V2_SWITCH = 'otp-v2';

/**
 * The query parameter that pins every run's seed, so an e2e spec knows the deal it is walking.
 * Seeds 0 to 34 are the 35 deals in order (core v2/deal.ts). Named in csp.test.ts with the switch.
 */
export const V2_SEED_PIN = 'otp-v2-seed';

/** How often the clock is read for the HUD and the hard stop. Four times a second is plenty. */
const TICK_MS = 250;

/**
 * THE SEED FOR THE NEXT RUN. Drawn fresh for every run with `crypto.getRandomValues`, so a replay
 * meets the same seven with a different three of them honest; core only turns the number into a
 * deal. A valid pin in the query string wins, for the e2e suite; anything else is ignored rather
 * than trusted, and a fresh seed is drawn.
 */
export function nextSeed(search: string): number {
  const pinned = new URLSearchParams(search).get(V2_SEED_PIN);
  const n = pinned === null || pinned === '' ? NaN : Number(pinned);
  if (v2.isSeed(n)) return n;
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** The forest's questions, answered from v2's store. See `WorldRun` in run.ts. */
export function v2Run(store: V2Store): WorldRun {
  const { content } = store;
  return {
    state: () => store.getState(),
    exploring: () => store.getState().phase === 'forest',
    atCottage: () => store.getState().phase === 'cottage',
    // Something came up this path ahead of you exactly when the run reached the wolf's ending:
    // a skill dealt bad THIS run was taken. Read from core, never from the skill's own data.
    pawsEarned: () => v2.ending(store.getState(), content) === 'wolf',
    // v2's cast is read from content, not from the spawn's prefix: v1's bystanders offer here.
    castOf: (spawnName) => {
      const c = content.characters.find((x) => x.spawn === spawnName);
      return c ? { kind: 'character', id: c.id } : null;
    },
    stillOffering: (characterId) => {
      const c = v2.findCharacter(content, characterId);
      return c !== undefined && store.getState().verdicts[c.skillId] === undefined;
    },
  };
}

/** What the HUD's basket shows: each skill taken, in the order it was taken. */
export function hudBasket(state: v2.State, content: v2.Content): HudBasketItem[] {
  return state.basket.map((e) => {
    const skill = v2.findSkill(content, e.s);
    return { skillId: e.s, name: skill?.name ?? e.s, icon: skill?.icon ?? null };
  });
}

/** Time left on the HUD: the live clock while the run runs, frozen where it stopped otherwise. */
export function remainingMs(state: v2.State, elapsed: number): number {
  const at = v2.RUNNING.has(state.phase) ? elapsed : state.now;
  return Math.max(0, v2.TIME_LIMIT_MS - at);
}

interface ScreenProps {
  store: V2Store;
  onReplay(): void;
}

/** The offer and the end, as placeholders. Labelled as Phase D's on screen; see the file note. */
function V2Screen({ store, onReplay }: ScreenProps) {
  const state = store.getState();
  const { content } = store;
  const first = useRef<HTMLButtonElement>(null);
  // Focus moves into whatever opened, so a keyboard-only player can answer it.
  useEffect(() => first.current?.focus(), [state.phase, state.active]);

  const hud = (
    <div class="otp-world-anchor" key="v2-hud">
      <Hud remainingMs={remainingMs(state, store.elapsed())} basket={hudBasket(state, content)} />
    </div>
  );

  if ((state.phase === 'talk' || state.phase === 'card') && state.active) {
    const character = v2.findCharacter(content, state.active)!;
    const skill = v2.findSkill(content, character.skillId)!;
    // The variant THIS run dealt. Before the card opens the two are word for word the same.
    const card = v2.variantOf(state.good, skill).card;
    const say = (v: v2.Verdict) => () => void store.dispatch({ type: 'VERDICT', s: skill.id, v });
    return (
      <>
        {hud}
        <div class="otp-layer otp-layer--modal" key="v2-offer">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${character.name} offers ${skill.name}`}
            data-v2-offer={character.id}
          >
            <Panel number="02" title="Offer (Phase D placeholder)" heading>
              <p>
                {character.name}: {character.greet}
              </p>
              <p>
                {skill.name}: {skill.promise}
              </p>
              {state.phase === 'card' && (
                <>
                  <p>Take it:</p>
                  <ul data-v2-card={skill.id}>
                    {card.take.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p>Leave it: {card.leave}</p>
                </>
              )}
              <div class="otp-options" role="group" aria-label="Your answer">
                {state.phase === 'talk' && (
                  <button
                    ref={first}
                    type="button"
                    class="otp-option"
                    data-v2="inspect"
                    onClick={() => void store.dispatch({ type: 'INSPECT', s: skill.id })}
                  >
                    Read the card
                  </button>
                )}
                <button
                  ref={state.phase === 'card' ? first : null}
                  type="button"
                  class="otp-option"
                  data-v2="take"
                  onClick={say('take')}
                >
                  Take it
                </button>
                <button type="button" class="otp-option" data-v2="leave" onClick={say('leave')}>
                  Leave it
                </button>
                <button
                  type="button"
                  class="otp-option"
                  data-v2="back"
                  onClick={() => void store.dispatch({ type: 'BACK' })}
                >
                  Walk on
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }

  if (state.phase === 'cottage' || state.phase === 'late') {
    const run = v2.result(state, content);
    return (
      <>
        {hud}
        <div class="otp-layer otp-layer--modal" key="v2-ended">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Run ended"
            data-v2-ended={run.ending ?? state.phase}
          >
            <Panel number="03" title="Ending (Phase D placeholder)" heading>
              <p data-v2-score={run.total}>
                {state.phase === 'late' ? 'Out of time.' : 'At the cottage.'} Score {run.total} out
                of {run.outOf}.
              </p>
              <ul>
                {run.entries.map((r) => (
                  <li
                    key={r.skillId}
                    data-v2-reveal={r.skillId}
                    data-v2-kind={r.good ? 'good' : 'bad'}
                  >
                    {r.name} ({r.verdict ?? 'not met'}): {r.line}
                  </li>
                ))}
              </ul>
              <div class="otp-options">
                <button
                  ref={first}
                  type="button"
                  class="otp-option"
                  data-v2="replay"
                  onClick={onReplay}
                >
                  Walk it again
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }

  return hud;
}

export interface V2Deps {
  stage: HTMLElement;
  uiRoot: HTMLElement;
  bus: Bus;
  /** The page clock. An e2e build adds its override on top (see `advance` below). */
  clock: Clock;
  /** The pad's accessible names; v2 content has none of its own yet, so v1's are passed in. */
  touchLabels: Parameters<typeof createTouchControls>[1];
  /** Builds Phaser around the scene, exactly as v1 does (main.ts `mountWorld`). */
  mountWorld(scene: ForestScene): void;
}

/** Runs the v2 rulebook in the forest. Reached from main.ts behind the dev/e2e switch only. */
export function startV2({ stage, uiRoot, bus, clock, touchLabels, mountWorld }: V2Deps): void {
  const content = v2.loadContent(rawV2);
  /*
   * THE TEST CLOCK OVERRIDE. A skew added to the injected clock, so an e2e spec can put the run at
   * 2:59 without waiting three minutes. The limit is never touched (v2/state.ts: slow the clock,
   * not the limit). Dot-access gated like the handle, and named in csp.test.ts's bundle grep.
   */
  let skew = 0;
  const store = createV2Store(content, () => clock() + skew, nextSeed(location.search));
  const walkable = (): boolean => store.getState().phase === 'forest';

  const input: Input = createInput(window, {
    onBack: () => {
      const { phase } = store.getState();
      if (phase === 'talk' || phase === 'card') store.dispatch({ type: 'BACK' });
    },
    isActive: walkable,
  });
  const touch = createTouchControls(input, touchLabels);
  uiRoot.append(touch.root);
  const panels = document.createElement('div');
  uiRoot.prepend(panels);

  const begin = (): void => {
    store.dispatch({ type: 'START', runId: crypto.randomUUID() });
    store.dispatch({ type: 'BEGIN' });
  };
  const replay = (): void => {
    // A fresh deal for every run: the same seven, a different three of them honest.
    store.dispatch({ type: 'RESET', seed: nextSeed(location.search) });
    bus.emit('restartRun', undefined);
    begin();
  };
  const draw = (): void => void render(<V2Screen store={store} onReplay={replay} />, panels);
  const sync = (): void => {
    stage.dataset['phase'] = store.getState().phase;
    touch.setVisible(walkable());
    draw();
  };
  store.subscribe(sync);

  bus.on('interact', ({ characterId }) => {
    const reason = store.dispatch({ type: 'MEET', c: characterId });
    if (reason) console.warn(`v2 MEET ${characterId} rejected: ${reason}`);
  });
  // Any basket may walk through the door; the score is what it says about the basket.
  bus.on('enteredCottage', () => void store.dispatch({ type: 'ENTER_COTTAGE' }));
  bus.on('loadFailed', ({ keys }) => console.error(`v2: assets failed to load: ${keys.join()}`));
  bus.on('worldReady', () => {
    stage.dataset['ready'] = 'true';
    if (store.getState().phase === 'title') begin();
  });

  // The hard stop and the HUD's second hand. The reducer also ends a run on any action stamped
  // past the limit, so a throttled background tab cannot buy time by starving this timer.
  setInterval(() => {
    if (!v2.RUNNING.has(store.getState().phase)) return;
    if (store.elapsed() >= v2.TIME_LIMIT_MS) store.dispatch({ type: 'TIME_UP' });
    else draw();
  }, TICK_MS);

  if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1')
    Object.defineProperty(window, '__otp', {
      value: {
        v2: store,
        bus,
        content,
        v2Clock: {
          advance: (ms: number) => {
            skew += ms;
          },
        },
      },
      configurable: true,
    });

  mountWorld(new ForestScene(v2Run(store), bus, input, walkable));
  sync();
}
