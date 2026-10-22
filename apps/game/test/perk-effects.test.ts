/*
 * THE PERKS, AS THE GAME READS THEM (the client, 2026-10-22), with no browser: the clock against a
 * rewound deadline, the line each perk says, and the HUD's winding face. What the perks DRAW is
 * e2e/perks.spec.ts's, which plays them in the real game.
 *
 * Every bound is read from the content or from core -- the rewind's ms, the dusk's start, the
 * limit -- never a number written down (PAUL_BRIEF trap 5).
 */
import { describe, expect, it } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { createStore } from '../src/store';
import { gameRun, outOfTime, remainingMs } from '../src/world/run';
import { perkLine } from '../src/ui/perks';
import { Hud } from '../src/ui/Hud';
import { strings } from '../src/ui/copy';

const content = v2.loadContent(raw);

/** A store on a hand-moved clock, BEGUN, in the forest. */
function forest(seed = 7) {
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

/** Meets a skill's giver and takes it (or leaves it). */
function answer(store: ReturnType<typeof forest>['store'], kind: v2.EffectKind, v: v2.Verdict) {
  const skill = content.skills.find((s) => s.effect.kind === kind)!;
  const giver = content.characters.find((c) => c.skillId === skill.id)!;
  expect(store.dispatch({ type: 'MEET', c: giver.id })).toBeNull();
  expect(store.dispatch({ type: 'VERDICT', s: skill.id, v })).toBeNull();
  return skill;
}

const rewind = content.skills.find((s) => s.effect.kind === 'rewind')!.effect as {
  kind: 'rewind';
  ms: number;
};

describe('the clock reads the run deadline, not the bare limit', () => {
  it('shows the rewind as time given back, and is not out of time at the bare limit', () => {
    const run = forest();
    run.at(60_000);
    answer(run.store, 'rewind', 'take');
    const state = run.store.getState();
    expect(remainingMs(state, 60_000)).toBe(v2.TIME_LIMIT_MS - 60_000 + rewind.ms);
    // At the bare three minutes the run is still alive, and TIME_UP would be refused there.
    expect(outOfTime(state, v2.TIME_LIMIT_MS)).toBe(false);
    expect(remainingMs(state, v2.TIME_LIMIT_MS)).toBe(rewind.ms);
    expect(outOfTime(state, v2.TIME_LIMIT_MS + rewind.ms)).toBe(true);
  });

  it('without a rewind, is out of time exactly at the limit', () => {
    const run = forest();
    const state = run.store.getState();
    expect(outOfTime(state, v2.TIME_LIMIT_MS - 1)).toBe(false);
    expect(outOfTime(state, v2.TIME_LIMIT_MS)).toBe(true);
  });

  it('the rewind moves the score: the same arrival counts as a faster time', () => {
    const plain = forest(11);
    const wound = forest(11);
    wound.at(40_000);
    answer(wound.store, 'rewind', 'take');
    plain.at(40_000);
    answer(plain.store, 'rewind', 'leave');
    for (const r of [plain, wound]) {
      r.at(150_000);
      r.store.dispatch({ type: 'ENTER_COTTAGE' });
    }
    const a = v2.result(plain.store.getState(), content);
    const b = v2.result(wound.store.getState(), content);
    expect(b.timeMs).toBe(a.timeMs! - rewind.ms);
    expect(b.rewoundMs).toBe(rewind.ms);
  });
});

describe('what the forest is told about the perks', () => {
  it('reads every perk by its kind, the same for a good copy and a bad one', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = forest(seed);
      const world = gameRun(run.store);
      expect(world.walkFactor()).toBe(1);
      expect(world.forkSigns()).toBe(false);
      expect(world.lantern()).toBe(false);
      answer(run.store, 'walk-faster', 'take');
      answer(run.store, 'fork-signs', 'take');
      answer(run.store, 'lantern', 'take');
      const faster = content.skills.find((s) => s.effect.kind === 'walk-faster')!.effect as {
        factor: number;
      };
      expect(world.walkFactor()).toBe(faster.factor);
      expect(world.forkSigns()).toBe(true);
      expect(world.lantern()).toBe(true);
    }
  });

  it('a leave gives nothing', () => {
    const run = forest();
    const world = gameRun(run.store);
    answer(run.store, 'walk-faster', 'leave');
    answer(run.store, 'lantern', 'leave');
    expect(world.walkFactor()).toBe(1);
    expect(world.lantern()).toBe(false);
  });

  it('dusk is 0 until the content says, comes on after, and never passes the cap', () => {
    const run = forest();
    const world = gameRun(run.store);
    const { fromLeftMs, darkest } = content.world.dusk;
    run.at(v2.TIME_LIMIT_MS - fromLeftMs - 1);
    expect(world.dusk()).toBe(0);
    run.at(v2.TIME_LIMIT_MS - fromLeftMs + 10_000);
    expect(world.dusk()).toBeGreaterThan(0);
    run.at(v2.TIME_LIMIT_MS - 1);
    expect(world.dusk()).toBeLessThanOrEqual(darkest);
    expect(world.darkest()).toBe(darkest);
  });

  /*
   * "SLOWLY, SLOWLY GETTING A LITTLE DARKER" (the client, 2026-10-22). Sampled every 100ms -- six
   * frames -- across the whole of the dusk: it never lightens, it never jumps (no step bigger than
   * a hundredth of the cap in a tenth of a second), and it lands on the cap at time up and not
   * before. The bounds are shares of the content's own `darkest`, never a number from the code.
   */
  it('the dusk deepens smoothly from 2:00 left to the cap, with no steps', () => {
    const run = forest();
    const world = gameRun(run.store);
    const { fromLeftMs, darkest } = content.world.dusk;
    const start = v2.TIME_LIMIT_MS - fromLeftMs;
    let last = 0;
    let biggest = 0;
    for (let at = start; at <= v2.TIME_LIMIT_MS; at += 100) {
      run.at(at);
      const now = world.dusk();
      expect(now, `at ${at}ms`).toBeGreaterThanOrEqual(last);
      biggest = Math.max(biggest, now - last);
      last = now;
    }
    expect(biggest, 'the biggest step in 100ms').toBeLessThan(darkest / 100);
    expect(last).toBeCloseTo(darkest, 5);
    // Halfway through the dusk it is halfway to the cap: a straight line, not a late plunge.
    run.at(start + fromLeftMs / 2);
    expect(world.dusk()).toBeCloseTo(darkest / 2, 5);
  });

  it("opens Grandma's door for an early welcome, good copy or bad, and for nothing else", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = forest(seed);
      const world = gameRun(run.store);
      expect(world.welcome()).toBe(false);
      answer(run.store, 'lantern', 'take');
      expect(world.welcome()).toBe(false);
      answer(run.store, 'early-welcome', 'take');
      expect(world.welcome()).toBe(true);
    }
    const left = forest();
    answer(left.store, 'early-welcome', 'leave');
    expect(gameRun(left.store).welcome()).toBe(false);
  });

  it('says who the run is talking to, for the hop', () => {
    const run = forest();
    const world = gameRun(run.store);
    expect(world.talkingTo()).toBeNull();
    const first = content.characters[0]!;
    run.store.dispatch({ type: 'MEET', c: first.id });
    expect(world.talkingTo()).toBe(first.id);
  });
});

describe('each perk says one line, from the content, by kind', () => {
  it('names a line for every kind the content uses, and none of them is empty', () => {
    for (const skill of content.skills) {
      const run = forest();
      run.at(40_000);
      answer(run.store, skill.effect.kind, 'take');
      const perk = run.store.getState().perks.at(-1)!;
      const line = perkLine(perk);
      expect(line, skill.id).not.toBe('');
      expect(line, skill.id).not.toMatch(/\{\w+\}/);
    }
  });

  it('says the seconds a rewind actually gave back', () => {
    const run = forest();
    run.at(40_000);
    answer(run.store, 'rewind', 'take');
    const perk = run.store.getState().perks.at(-1)!;
    expect(perkLine(perk)).toContain(String(Math.round(rewind.ms / 1000)));
  });

  it('a ride with nobody left to fly to says so', () => {
    const run = forest();
    const ride = content.skills.find((s) => s.effect.kind === 'wing-ride')!;
    const giver = content.characters.find((c) => c.skillId === ride.id)!;
    for (const c of content.characters) {
      if (c.id === giver.id) continue;
      run.store.dispatch({ type: 'MEET', c: c.id });
      run.store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'leave' });
    }
    answer(run.store, 'wing-ride', 'take');
    const perk = run.store.getState().perks.at(-1)!;
    expect(perk.kind === 'wing-ride' && perk.to).toBeNull();
    expect(perkLine(perk)).toBe(strings['perkWingRideNobody']);
  });
});

/** Every element vnode under a node, depth first. */
function elements(node: ComponentChildren): VNode<Record<string, unknown>>[] {
  if (node === null || node === undefined || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  const vnode = node as VNode<Record<string, unknown>>;
  return [vnode, ...elements(vnode.props['children'] as ComponentChildren)];
}

describe('the clock winding back', () => {
  it('shows the face it is given, and announces the true time left', () => {
    const tree = Hud({ remainingMs: 45_000, faceMs: 25_000, winding: true, basket: [] });
    const all = elements(tree);
    const clock = all.find((v) => v.props['class'] === 'otp-hud2__clock')!;
    expect(clock.props['children']).toBe('0:25');
    const timer = all.find((v) => v.props['role'] === 'timer')!;
    expect(timer.props['data-winding']).toBe('true');
    // The urgent shape follows the true time, so "more time" never wears "nearly out".
    expect(timer.props['data-urgent']).toBe('false');
    const region = all.find((v) => v.props['data-hud-announce'] === '')!;
    expect(region.props['children']).toBe(content.ui.hud.oneMinute);
  });

  it('is quiet when nothing is winding', () => {
    const timer = elements(Hud({ remainingMs: 45_000, basket: [] })).find(
      (v) => v.props['role'] === 'timer',
    )!;
    expect(timer.props['data-winding']).toBe('false');
  });
});
