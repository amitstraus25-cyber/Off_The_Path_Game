/*
 * WHO IS STILL BECKONING, as the forest is told it (world/run.ts `met`), with no browser.
 *
 * The scene lays a ground glow and a "!" over every character for whom this is false
 * (forest-scene.ts `drawBeckons`), so this is the rule and e2e/beckon.spec.ts is the picture. The
 * rule is the meeting, not the verdict: a character met and walked away from has been found.
 */
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { createStore } from '../src/store';
import { gameRun } from '../src/world/run';

const content = v2.loadContent(raw);

function forest(seed: number) {
  const store = createStore(content, () => 0, seed);
  store.dispatch({ type: 'START', runId: 'r' });
  store.dispatch({ type: 'BEGIN' });
  return store;
}

describe('a character beckons until met, and only until met', () => {
  it('starts the walk with nobody met', () => {
    const world = gameRun(forest(1));
    for (const c of content.characters) expect(world.met(c.id), c.id).toBe(false);
  });

  it('is met from the MEET on, before any verdict and after walking on without one', () => {
    const store = forest(2);
    const world = gameRun(store);
    const [first, ...rest] = content.characters;
    expect(store.dispatch({ type: 'MEET', c: first!.id })).toBeNull();
    expect(world.met(first!.id)).toBe(true);
    expect(world.stillOffering(first!.id)).toBe(true);
    store.dispatch({ type: 'BACK' });
    store.dispatch({ type: 'BACK' });
    expect(store.getState().phase).toBe('forest');
    expect(world.met(first!.id)).toBe(true);
    for (const c of rest) expect(world.met(c.id), c.id).toBe(false);
  });

  it('names nobody the content does not have', () => {
    expect(gameRun(forest(3)).met('nobody')).toBe(false);
  });
});
