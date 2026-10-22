import { describe, expect, it } from 'vitest';
import type { Content, Effect, Verdict } from '../../src/v2/content.ts';
import { walkFloor } from '../../src/v2/floor.ts';
import { loadContent } from '../../src/v2/load.ts';
import {
  clockMs,
  deadlineMs,
  duskAt,
  duskLevel,
  hasPerk,
  rewoundMs,
  timeLeftMs,
  walkFactor,
  wingRideTarget,
} from '../../src/v2/perks.ts';
import { tryReduce } from '../../src/v2/reducer.ts';
import { checkRunLog, toRunLog } from '../../src/v2/runlog.ts';
import { result, speedBonus } from '../../src/v2/scoring.ts';
import { clockCheck, play } from '../../src/v2/sim.ts';
import { TIME_LIMIT_MS, createState } from '../../src/v2/state.ts';
import type { Action, State } from '../../src/v2/state.ts';
import { deepFreeze } from './helpers.ts';
import { variant } from './fixture.ts';

/*
 * THE PERKS (the client, 2026-10-22): what a taken skill does in the forest, recorded by the
 * reducer and read through perks.ts. The fixture's own perks save no time, so this suite gives its
 * three skills timed ones. Fixture walking order: magpie (courier), glowworm (lantern), fox
 * (locksmith); seed 0 deals the lantern good, seed 1 the courier, seed 2 the locksmith.
 */

const withPerks = (perks: Record<string, Effect>, knockMs = 0): Content => {
  const v = variant();
  for (const s of v.skills) if (perks[s.id]) s.effect = perks[s.id]!;
  v.world.knockMs = knockMs;
  return loadContent(v);
};

const REWIND: Effect = { kind: 'rewind', ms: 20_000 };
const WINGS: Effect = { kind: 'wing-ride', flightMs: 1_500 };
const FASTER: Effect = { kind: 'walk-faster', factor: 1.25 };
const timed = withPerks({ lantern: REWIND, courier: WINGS, locksmith: FASTER });

const giverOf = (c: Content, s: string) => c.characters.find((x) => x.skillId === s)!.id;

/** Drives `c` from the forest, throwing on the first refusal; every state frozen. */
function drive(c: Content, steps: Action[], seed = 0): State {
  let s = deepFreeze(createState(c, seed));
  for (const a of [
    { type: 'START', runId: 'p' } as Action,
    { type: 'BEGIN' } as Action,
    ...steps,
  ]) {
    const r = tryReduce(s, a, c);
    if (!r.ok) throw new Error(`${a.type} refused: ${r.reason}`);
    s = deepFreeze(r.state);
  }
  return s;
}
const decide = (c: Content, s: string, v: Verdict, at: number): Action[] => [
  { type: 'MEET', c: giverOf(c, s), at },
  { type: 'VERDICT', s, v, at },
];

describe('the reducer records a perk at the take, and only at the take', () => {
  it('a take records the skill’s effect with the skill and the stamp; a leave records nothing', () => {
    const kept = drive(timed, decide(timed, 'locksmith', 'take', 5_000));
    expect(kept.perks).toEqual([{ s: 'locksmith', at: 5_000, kind: 'walk-faster', factor: 1.25 }]);
    expect(drive(timed, decide(timed, 'locksmith', 'leave', 5_000)).perks).toEqual([]);
  });

  it('the bad copy records the same perk as the good one: the forest cannot tell them apart', () => {
    // Seed 0 deals the locksmith bad, seed 2 good.
    const bad = drive(timed, decide(timed, 'locksmith', 'take', 5_000), 0);
    const good = drive(timed, decide(timed, 'locksmith', 'take', 5_000), 2);
    expect(bad.good).not.toContain('locksmith');
    expect(good.good).toContain('locksmith');
    expect(bad.perks).toEqual(good.perks);
  });

  it('a wing ride records where it lands: the next unmet character after its giver, or nobody', () => {
    const first = drive(timed, decide(timed, 'courier', 'take', 5_000));
    expect(first.perks).toEqual([
      { s: 'courier', at: 5_000, kind: 'wing-ride', flightMs: 1_500, to: 'glowworm' },
    ]);
    const last = drive(timed, [
      ...decide(timed, 'lantern', 'leave', 1_000),
      ...decide(timed, 'locksmith', 'leave', 2_000),
      ...decide(timed, 'courier', 'take', 3_000),
    ]);
    expect(last.perks[0]).toMatchObject({ kind: 'wing-ride', to: null });
  });

  it('wingRideTarget wraps round to the start, and reads an unknown giver as standing before the first', () => {
    expect(wingRideTarget(timed, ['fox'], 'fox')).toBe('magpie');
    expect(wingRideTarget(timed, ['magpie'], 'magpie')).toBe('glowworm');
    expect(wingRideTarget(timed, [], undefined)).toBe('magpie');
    expect(wingRideTarget(timed, ['magpie', 'glowworm', 'fox'], 'fox')).toBeNull();
  });

  it('hasPerk and walkFactor read the run: factors multiply, and a run with none walks at 1', () => {
    const fresh = createState(timed, 0);
    expect(walkFactor(fresh)).toBe(1);
    expect(hasPerk(fresh, 'walk-faster')).toBe(false);
    const s = drive(timed, decide(timed, 'locksmith', 'take', 5_000));
    expect(hasPerk(s, 'walk-faster')).toBe(true);
    expect(walkFactor(s)).toBe(1.25);
    expect(walkFactor({ perks: [...s.perks, ...s.perks] })).toBeCloseTo(1.5625, 9);
    // A perk of another kind walks at the speed it found.
    const both = drive(timed, [
      ...decide(timed, 'locksmith', 'take', 5_000),
      ...decide(timed, 'lantern', 'take', 6_000),
    ]);
    expect(both.perks.map((p) => p.kind)).toEqual(['walk-faster', 'rewind']);
    expect(walkFactor(both)).toBe(1.25);
  });
});

describe('the rewind: time given back to the clock, and taken off the time the score counts', () => {
  const rewound = (at: number) => drive(timed, decide(timed, 'lantern', 'take', at));

  it('gives back its ms, so the deadline moves and the run clock runs that far behind the stamps', () => {
    const s = rewound(100_000);
    expect(s.perks).toEqual([{ s: 'lantern', at: 100_000, kind: 'rewind', ms: 20_000 }]);
    expect(rewoundMs(s)).toBe(20_000);
    expect(deadlineMs(s)).toBe(TIME_LIMIT_MS + 20_000);
    expect(clockMs(s, 100_000)).toBe(80_000);
    expect(timeLeftMs(s, 100_000)).toBe(100_000);
    expect(timeLeftMs(s, 500_000)).toBe(0);
  });

  it('never rewinds past the start: a young run gets back only the time it has had', () => {
    const s = rewound(7_000);
    expect(rewoundMs(s)).toBe(7_000);
    expect(clockMs(s, 7_000)).toBe(0);
    expect(timeLeftMs(s, 7_000)).toBe(TIME_LIMIT_MS);
  });

  it('the late rule uses the rewound clock: in time past three minutes, out of it at the new deadline', () => {
    const s = rewound(170_000);
    const enter = (at: number) => tryReduce(s, { type: 'ENTER_COTTAGE', at }, timed);
    expect(enter(TIME_LIMIT_MS + 19_999)).toMatchObject({ ok: true });
    const out = enter(TIME_LIMIT_MS + 20_000);
    expect(out.ok).toBe(false);
    expect(out.state.phase).toBe('late');
    expect(out.state.log.at(-1)).toEqual({ e: 'late', at: TIME_LIMIT_MS + 20_000 });
    // TIME_UP waits for the run's deadline, not the bare limit.
    expect(tryReduce(s, { type: 'TIME_UP', at: TIME_LIMIT_MS }, timed)).toMatchObject({
      ok: false,
      reason: 'time-not-up',
    });
    expect(tryReduce(s, { type: 'TIME_UP', at: TIME_LIMIT_MS + 20_000 }, timed).ok).toBe(true);
  });

  it('a take that arrives after the bare limit is late: the perk cannot be taken from beyond the deadline', () => {
    const s = drive(timed, [{ type: 'MEET', c: 'glowworm', at: 170_000 }]);
    const r = tryReduce(s, { type: 'VERDICT', s: 'lantern', v: 'take', at: TIME_LIMIT_MS }, timed);
    expect(r).toMatchObject({ ok: false, reason: 'out-of-time' });
    expect(r.state.perks).toEqual([]);
  });

  it('the score counts the rewound time: the same arrival earns the bonus of twenty seconds sooner', () => {
    const s = drive(timed, [
      ...decide(timed, 'lantern', 'take', 100_000),
      { type: 'ENTER_COTTAGE', at: 150_000 },
    ]);
    const r = result(s, timed);
    expect(r).toMatchObject({ ending: 'grandma', timeMs: 130_000, rewoundMs: 20_000 });
    expect(r.speed).toBe(speedBonus(timed, 1, 130_000));
    expect(r.speed).toBeGreaterThan(speedBonus(timed, 1, 150_000));
  });

  it('replays on the server: a rewound run past three minutes is legal, and its late event sits at the new deadline', () => {
    const inTime = drive(timed, [
      ...decide(timed, 'lantern', 'take', 170_000),
      { type: 'ENTER_COTTAGE', at: 190_000 },
    ]);
    const replay = checkRunLog(toRunLog(inTime), timed);
    expect(replay).toMatchObject({ legal: true, ended: true });
    expect(replay.legal && result(replay.state, timed).total).toBe(result(inTime, timed).total);

    const lateLog = toRunLog(
      tryReduce(rewound(170_000), { type: 'TIME_UP', at: 250_000 }, timed).state,
    );
    expect(lateLog.events.at(-1)).toEqual({ e: 'late', at: 200_000 });
    expect(checkRunLog(lateLog, timed)).toMatchObject({ legal: true, ended: true });
    // A late event at the bare limit, after a rewind, is not what the reducer would have stamped.
    const forged = {
      ...lateLog,
      events: [...lateLog.events.slice(0, -1), { e: 'late', at: TIME_LIMIT_MS }],
    };
    expect(checkRunLog(forged, timed).legal).toBe(false);
  });
});

describe('the walk floor reads a wing ride the map cannot place', () => {
  it('a flight to a character with no talking spot charges the flight and constrains nothing after it', () => {
    // The fixture's spawns are not on the shipped map, so the landing spot is unknown.
    const events = [
      { e: 'met', c: 'magpie', at: 0 },
      { e: 'verdict', s: 'courier', v: 'take', at: 0 },
      { e: 'arrived', at: 0 },
    ] as const;
    expect(walkFloor(timed, events)).toEqual({ floorMs: 1_500, tooFast: 2 });
  });
});

describe('dusk, for everyone, from the content’s time left, and a rewind pushes it back', () => {
  const { fromLeftMs, darkest } = timed.world.dusk;

  it('is nothing until fromLeftMs is left, then a straight line to darkest at time up, never past it', () => {
    expect(duskLevel(timed, TIME_LIMIT_MS)).toBe(0);
    expect(duskLevel(timed, fromLeftMs)).toBe(0);
    expect(duskLevel(timed, fromLeftMs / 2)).toBeCloseTo(darkest / 2, 9);
    expect(duskLevel(timed, 0)).toBe(darkest);
    expect(duskLevel(timed, -5_000)).toBe(darkest);
  });

  it('follows the run clock: twenty seconds given back is twenty seconds more before the dark', () => {
    const s = drive(timed, decide(timed, 'lantern', 'take', 100_000));
    const plain = createState(timed, 0);
    expect(duskAt(timed, s, 150_000)).toBeCloseTo(duskAt(timed, plain, 130_000), 9);
    expect(duskAt(timed, s, 150_000)).toBeLessThan(duskAt(timed, plain, 150_000));
  });
});

describe('the simulator gives a careful basket the time its perks save', () => {
  const pace = { walkMs: 10_000, talkMs: 1_000 };
  const reading = { msPerWord: 0, buttonWords: 0, decideMs: 0 };
  const greedy = (c: Content, perks?: boolean) =>
    play(c, 'greedy', { pace, reading, ...(perks === undefined ? {} : { perks }) });

  it('a wing ride replaces the next walk with the flight; with nobody left unmet it saves nothing', () => {
    const c = withPerks({ courier: WINGS });
    // magpie walks 10 s, talks 1 s, flies 1.5 s to the glowworm, then walks on.
    expect(greedy(c).state.log.find((e) => e.e === 'met' && e.c === 'glowworm')!.at).toBe(12_500);
    expect(greedy(c, false).state.log.find((e) => e.e === 'met' && e.c === 'glowworm')!.at).toBe(
      21_000,
    );
    // The fox's wing ride is the last meeting: nobody to fly to.
    const last = withPerks({ locksmith: WINGS });
    expect(greedy(last).elapsedMs).toBe(greedy(last, false).elapsedMs);
  });

  it('a faster walk shortens every walk after it; an early welcome skips the knock', () => {
    const c = withPerks({ courier: FASTER, locksmith: { kind: 'early-welcome' } }, 3_000);
    const fast = greedy(c);
    const slow = greedy(c, false);
    // Three walks after the take (two meetings and the door) at 1.25x, and no knock.
    expect(slow.elapsedMs - fast.elapsedMs).toBeCloseTo(3 * (10_000 - 10_000 / 1.25) + 3_000, 6);
    // Leaving everything pays every walk and the knock.
    expect(play(c, 'leave-all', { pace, reading }).elapsedMs).toBe(slow.elapsedMs);
  });

  it('the clock check holds each run to its own deadline with the perks, and to the bare limit without', () => {
    // Every skill rewinds, so every deal's careful basket takes one: about three minutes eight
    // seconds of walking and reading is late on the bare clock and in time on the rewound one.
    const c = withPerks({ lantern: REWIND, courier: REWIND, locksmith: REWIND });
    const slow = { walkMs: 40_000, talkMs: 0 };
    const withThem = clockCheck(c, slow);
    const without = clockCheck(c, slow, { perks: false });
    expect(withThem.elapsedMs).toBeGreaterThan(TIME_LIMIT_MS);
    expect(withThem).toMatchObject({ ok: true, ending: 'grandma' });
    expect(without.ok).toBe(false);
    expect(withThem.marginMs - without.marginMs).toBe(REWIND.kind === 'rewind' ? REWIND.ms : NaN);
  });
});
