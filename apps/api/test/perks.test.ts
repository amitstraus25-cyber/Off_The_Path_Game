import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import { CLOCK_SKEW_MS, handleScore } from '../src/handlers.ts';
import { createRunTokens, signingKey } from '../src/token.ts';
import { CONFIG, T0, harness, postScore } from './fake.ts';
import type { Clock } from './fake.ts';
import { PACE, content, runOf } from './helpers.ts';

/*
 * THE PERKS, THROUGH THE ROUTE (the client, 2026-10-22). Every taken skill now does something in
 * the forest, and three of them change the time a run takes: the faster walk, the wing ride and
 * the early welcome shorten the walk the log describes, and the long evening gives twenty seconds
 * back to the clock. The server replays all of it with core's own reducer and floor, under the
 * same token and the same time bounds; these are runs that used each perk, honestly, and the
 * forgeries a perk could be mistaken for.
 *
 * A perk is only in a run whose basket took it, and a careful basket takes only what the deal made
 * good, so each test plays the deal that makes its skill good -- on a token minted for that seed,
 * signed with the same key as every other harness's, so the route opens it like any other.
 */

/** A signer that mints tokens for `seed`, with a fresh random id each time. */
const pinned = (seed: number) =>
  createRunTokens(signingKey(CONFIG.serviceRoleKey), (n) => {
    const b = randomBytes(n);
    b.writeUInt32BE(seed, 16);
    return b;
  });

const skillWith = (kind: v2.EffectKind) => content.skills.find((s) => s.effect.kind === kind)!;
const characterOf = (skillId: string) => content.characters.find((c) => c.skillId === skillId)!;
/** The first deal that makes the skill with this perk good, and none of `without` good. */
const dealFor = (kind: v2.EffectKind, without: v2.EffectKind[] = []): number =>
  v2.everySeed(content).find((seed) => {
    const good = v2.deal(content, seed);
    return (
      good.includes(skillWith(kind).id) && without.every((k) => !good.includes(skillWith(k).id))
    );
  })!;

/** A careful run for `seed`, at `pace`, posted `afterMs` after it arrived. */
function careful(seed: number, pace: v2.Pace = PACE, afterMs = 10_000) {
  const clock: Clock = { now: T0 };
  const h = harness(undefined, { clock });
  const { token } = pinned(seed).issue(clock.now);
  const state = runOf('careful', seed, pace);
  const log = v2.toRunLog(state);
  return {
    h,
    clock,
    state,
    log,
    post: (events = log.events, seenMs = (events.at(-1)?.at ?? 0) + afterMs) => {
      clock.now = T0 + seenMs;
      return handleScore(
        postScore({ handle: 'brave-lantern-42', log: { ...log, events }, token }),
        h.deps,
      );
    },
  };
}

/**
 * The run's own log restamped to walk EXACTLY the floor its events describe, plus 1 ms at every
 * step -- the least an honest player with the same perks could have claimed.
 */
const atFloor = (events: readonly v2.RunEvent[]): v2.RunEvent[] => {
  let at = 0;
  return events.map((e, i) => {
    if (e.e === 'met' || e.e === 'arrived')
      at = Math.max(at, v2.walkFloor(content, events.slice(0, i + 1)).floorMs + 1);
    return { ...e, at: Math.ceil(at) };
  });
};
/** The same log, with the take of `skillId` turned into a leave: the run without the perk. */
const leaving = (events: readonly v2.RunEvent[], skillId: string): v2.RunEvent[] =>
  events.map((e) => (e.e === 'verdict' && e.s === skillId ? { ...e, v: 'leave' } : e));

describe('every perk, taken by an honest careful run, posts and scores as the game scored it', () => {
  for (const kind of v2.EFFECT_KINDS)
    it(`${kind}: the run that took it is a row, at the score core gives its replay`, async () => {
      const run = careful(dealFor(kind));
      expect(run.state.perks.map((p) => p.kind)).toContain(kind);
      const res = await run.post();
      expect(res.status).toBe(200);
      expect(run.h.written()).toEqual({
        handle: 'brave-lantern-42',
        score: v2.result(run.state, content).total,
      });
    });
});

describe('the walk floor counts the perks the log took, so the quickest honest run with one is a row', () => {
  it('walk faster: a log at its own floor posts, though its legs are faster than the floor without the perk', async () => {
    const snail = skillWith('walk-faster');
    const run = careful(dealFor('walk-faster'));
    const quick = atFloor(run.log.events);
    expect(v2.walkFloor(content, leaving(quick, snail.id)).tooFast).not.toBeNull();
    expect((await run.post(quick)).status).toBe(200);
  });

  it('early welcome: a log at its own floor posts, though it arrives sooner than the knock allows without it', async () => {
    const owl = skillWith('early-welcome');
    const run = careful(dealFor('early-welcome'));
    const quick = atFloor(run.log.events);
    expect(v2.walkFloor(content, leaving(quick, owl.id)).tooFast).toBe(quick.length - 1);
    expect((await run.post(quick)).status).toBe(200);
  });

  it('wing ride: the leg after the take costs the flight, and a landing stamped inside the flight is refused', async () => {
    const magpie = skillWith('wing-ride');
    const flightMs = magpie.effect.kind === 'wing-ride' ? magpie.effect.flightMs : NaN;
    const run = careful(dealFor('wing-ride'));
    const ride = run.state.perks.find((p) => p.kind === 'wing-ride')!;
    expect(ride.kind === 'wing-ride' && ride.to).toBe(
      v2.wingRideTarget(
        content,
        content.characters
          .slice(0, content.characters.indexOf(characterOf(magpie.id)) + 1)
          .map((c) => c.id),
        characterOf(magpie.id).id,
      ),
    );
    // The simulator flew the leg in exactly the flight time, and the route takes it.
    const landed = run.log.events.find(
      (e) => e.e === 'met' && ride.kind === 'wing-ride' && e.c === ride.to,
    )!;
    expect(landed.at - ride.at).toBe(flightMs);
    expect((await careful(dealFor('wing-ride')).post()).status).toBe(200);
    // At its floor it posts; the landing a few ms inside the flight does not.
    const quick = atFloor(run.log.events);
    expect((await run.post(quick)).status).toBe(200);
    const i = quick.findIndex((e) => e.e === 'met' && ride.kind === 'wing-ride' && e.c === ride.to);
    const early = quick.map((e, k) => (k >= i ? { ...e, at: e.at - 5 } : e));
    const again = careful(dealFor('wing-ride'));
    expect((await again.post(early)).status).toBe(400);
  });
});

describe('the long evening: twenty seconds back on the clock, replayed by the same rule', () => {
  // Twenty-one seconds a walk: the careful run reaches the door past three minutes of real time.
  const slow: v2.Pace = { walkMs: 21_000, talkMs: 1_000 };
  const seed = dealFor('rewind', ['walk-faster', 'wing-ride', 'early-welcome']);

  it('a run that arrives after 3:00 but inside the rewound deadline is a row, scored on the rewound clock', async () => {
    const run = careful(seed, slow);
    const arrived = run.log.events.at(-1)!;
    expect(arrived.e).toBe('arrived');
    expect(arrived.at).toBeGreaterThan(v2.TIME_LIMIT_MS);
    expect(arrived.at).toBeLessThan(v2.deadlineMs(run.state));
    const r = v2.result(run.state, content);
    expect(r).toMatchObject({ ending: 'grandma', rewoundMs: 20_000, timeMs: arrived.at - 20_000 });
    expect(r.speed).toBeGreaterThan(0);
    expect((await run.post()).status).toBe(200);
    expect(run.h.written()?.score).toBe(r.total);
  });

  it('the same bounds hold on real time: a rewound run still claims its real stamps, so a younger token refuses it', async () => {
    const run = careful(seed, slow);
    const claimed = run.log.events.at(-1)!.at;
    // Seen twenty seconds less than claimed would fit the rewound clock, and is still refused.
    expect((await run.post(run.log.events, claimed - CLOCK_SKEW_MS - 1)).status).toBe(400);
    expect((await careful(seed, slow).post(undefined, claimed - CLOCK_SKEW_MS)).status).toBe(200);
  });

  it('a run that ran out even of its rewound clock is late, stamped at the new deadline, and posted at `played`', async () => {
    // Twenty-three seconds a walk: the Cat is met inside three minutes and the door is past 3:20.
    const run = careful(seed, { walkMs: 23_000, talkMs: 1_000 });
    expect(run.state.perks.map((p) => p.kind)).toContain('rewind');
    expect(run.log.events.at(-1)).toEqual({ e: 'late', at: v2.deadlineMs(run.state) });
    expect(v2.deadlineMs(run.state)).toBe(v2.TIME_LIMIT_MS + 20_000);
    const res = await run.post();
    expect(res.status).toBe(200);
    expect(run.h.written()?.score).toBe(content.scoring.played);
  });

  it('a log that drops the take cannot keep the extra twenty seconds', async () => {
    const run = careful(seed, slow);
    const cat = skillWith('rewind');
    // Without the Cat's take the arrival is past the bare limit: the replay ends it late instead.
    const forged = run.log.events.filter((e) => !(e.e === 'verdict' && e.s === cat.id));
    expect((await run.post(forged)).status).toBe(400);
  });
});
