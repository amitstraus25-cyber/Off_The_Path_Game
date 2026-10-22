/*
 * WHO IS IN GRANDMA'S WINDOW, as the forest is told it (world/run.ts `wolfInside`), with no browser.
 *
 * The scene shows `fx-window-wolf` over the lit window exactly when this is true at the door
 * (forest-scene.ts `stageArrival`), so this is the rule and e2e/window-wolf.spec.ts is the picture.
 * The rule is the ending's: the wolf's ending and nothing else. Never during the walk, never on
 * Grandma's ending, never on the late one. Each case is driven through the real store and reducer,
 * and which skills are bad comes from the run's own deal (`state.good`), never from a list here.
 */
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { createStore } from '../src/store';
import { gameRun } from '../src/world/run';

const content = v2.loadContent(raw);

/** A store on a hand-moved clock, BEGUN, in the forest. */
function forest(seed: number) {
  let now = 0;
  const store = createStore(content, () => now, seed);
  store.dispatch({ type: 'START', runId: 'r' });
  store.dispatch({ type: 'BEGIN' });
  return {
    store,
    at: (ms: number) => {
      now = ms;
    },
  };
}

/** Meets every giver in walking order and answers each with `choose(skillId, isGood)`. */
function answerAll(
  store: ReturnType<typeof forest>['store'],
  choose: (skillId: string, good: boolean) => v2.Verdict,
): void {
  const good = store.getState().good;
  for (const c of content.characters) {
    expect(store.dispatch({ type: 'MEET', c: c.id })).toBeNull();
    expect(
      store.dispatch({
        type: 'VERDICT',
        s: c.skillId,
        v: choose(c.skillId, good.includes(c.skillId)),
      }),
    ).toBeNull();
  }
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('the wolf is in the window on his ending and nowhere else', () => {
  it('is never in the window during the walk, whatever has been taken', () => {
    for (const seed of SEEDS) {
      const run = forest(seed);
      const world = gameRun(run.store);
      expect(world.wolfInside()).toBe(false);
      // Even with every bad skill already in the basket: the ending is decided at the door.
      answerAll(run.store, (_s, good) => (good ? 'leave' : 'take'));
      expect(run.store.getState().phase).toBe('forest');
      expect(world.atCottage()).toBe(false);
    }
  });

  it('is in the window when a bad skill came home, exactly as the prints are on the step', () => {
    for (const seed of SEEDS) {
      const run = forest(seed);
      const world = gameRun(run.store);
      let taken = false;
      answerAll(run.store, (_s, good) => {
        if (good || taken) return 'leave';
        taken = true;
        return 'take';
      });
      expect(run.store.dispatch({ type: 'ENTER_COTTAGE' })).toBeNull();
      expect(v2.ending(run.store.getState(), content)).toBe('wolf');
      expect(world.wolfInside()).toBe(true);
      expect(world.pawsEarned()).toBe(true);
    }
  });

  it('is not in the window on the clean ending, taken or left', () => {
    for (const seed of SEEDS)
      for (const takeGood of [false, true]) {
        const run = forest(seed);
        const world = gameRun(run.store);
        answerAll(run.store, (_s, good) => (good && takeGood ? 'take' : 'leave'));
        expect(run.store.dispatch({ type: 'ENTER_COTTAGE' })).toBeNull();
        expect(v2.ending(run.store.getState(), content)).toBe('grandma');
        expect(world.wolfInside()).toBe(false);
      }
  });

  it('is not in the window on the late ending, which never reaches the door', () => {
    for (const seed of SEEDS) {
      const run = forest(seed);
      const world = gameRun(run.store);
      // A bad skill taken, so it is the clock and not the basket that keeps him out.
      answerAll(run.store, (_s, good) => (good ? 'leave' : 'take'));
      run.at(v2.TIME_LIMIT_MS);
      expect(run.store.dispatch({ type: 'TIME_UP' })).toBeNull();
      expect(run.store.getState().phase).toBe('late');
      expect(v2.ending(run.store.getState(), content)).toBe('late');
      expect(world.atCottage()).toBe(false);
      expect(world.wolfInside()).toBe(false);
    }
  });
});
