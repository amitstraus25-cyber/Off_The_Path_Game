import { describe, expect, it } from 'vitest';
import { MAX_LOG_EVENTS } from '../../src/leaderboard.ts';
import { RULES, checkRunLog, runLogSchema, toRunLog } from '../../src/v2/runlog.ts';
import { TIME_LIMIT_MS, runEventSchema } from '../../src/v2/state.ts';
import type { RunEvent } from '../../src/v2/state.ts';
import { score } from '../../src/v2/scoring.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';

const careful = { lantern: 'take', courier: 'leave', locksmith: 'leave' } as const;
const envelope = (events: unknown, seed = 0) => ({
  rules: RULES,
  content: content.version,
  seed,
  events,
});

describe('legal logs', () => {
  it('a live full run replays to the same state and the same score', () => {
    const live = fullRun(careful);
    const r = checkRunLog(toRunLog(live), content);
    expect(r).toMatchObject({ legal: true, ended: true });
    if (!r.legal) return;
    expect(r.state.log).toEqual(live.log);
    expect(r.state.basket).toEqual(live.basket);
    expect(r.state.verdicts).toEqual(live.verdicts);
    expect(r.state.phase).toBe('cottage');
    expect(r.state.good).toEqual(live.good);
    expect(score(r.state, content)).toBe(score(live, content));
  });

  it('the seed travels with the log, so the server deals the same hand', () => {
    const live = fullRun({ lantern: 'leave', courier: 'take', locksmith: 'leave' }, 1);
    const r = checkRunLog(toRunLog(live), content);
    expect(r).toMatchObject({ legal: true, state: { seed: 1, good: ['courier'] } });
    if (r.legal) expect(score(r.state, content)).toBe(100);
    // The same verdicts posted under another seed are scored against that deal instead.
    // That is also the hole runlog.ts states: the seed is client-reported, like the stamps.
    const other = checkRunLog({ ...toRunLog(live), seed: 0 }, content);
    expect(other).toMatchObject({ legal: true });
    if (other.legal) expect(score(other.state, content)).toBe(0);
  });

  it('toRunLog tags the log with the rules and the content it was played under', () => {
    const live = fullRun(careful);
    expect(toRunLog(live)).toEqual({ rules: 2, content: 'fixture-2', seed: 0, events: live.log });
    expect(RULES).toBe(2);
  });

  it('an empty log and a partial run are legal and not ended', () => {
    expect(checkRunLog(envelope([]), content)).toMatchObject({ legal: true, ended: false });
    const partial = run([...begin, ...encounter('lantern', 'take')]);
    expect(checkRunLog(toRunLog(partial), content)).toMatchObject({ legal: true, ended: false });
  });

  it('a late run is legal and ended, so the server can tell it apart from a forgery', () => {
    const late = run([
      ...begin,
      ...encounter('lantern', 'take'),
      { type: 'TIME_UP', at: TIME_LIMIT_MS },
    ]);
    const r = checkRunLog(toRunLog(late), content);
    expect(r).toMatchObject({ legal: true, ended: true });
    if (r.legal) expect(r.state.phase).toBe('late');
  });

  it('replays a player who backed out of a card, wandered off and came back', () => {
    const live = run([
      ...begin,
      { type: 'MEET', c: 'magpie' },
      { type: 'INSPECT', s: 'courier' },
      { type: 'BACK' },
      { type: 'BACK' },
      { type: 'MEET', c: 'fox' },
      { type: 'VERDICT', s: 'locksmith', v: 'take' },
      { type: 'MEET', c: 'magpie' },
      { type: 'VERDICT', s: 'courier', v: 'leave' },
      { type: 'MEET', c: 'glowworm' },
      { type: 'INSPECT', s: 'lantern' },
      { type: 'VERDICT', s: 'lantern', v: 'take' },
      { type: 'ENTER_COTTAGE' },
    ]);
    const r = checkRunLog(toRunLog(live), content);
    expect(r).toMatchObject({ legal: true, ended: true });
    if (r.legal) expect(r.state.log).toEqual(live.log);
  });

  it('replays a verdict given from the conversation without inventing a card for it', () => {
    const live = run([...begin, ...encounter('courier', 'take', false), { type: 'ENTER_COTTAGE' }]);
    const r = checkRunLog(toRunLog(live), content);
    expect(r).toMatchObject({ legal: true });
    if (r.legal) expect(r.state.inspected).toEqual([]);
  });
});

describe('forged logs', () => {
  const live = fullRun(careful).log;
  const forged = (events: RunEvent[]) => checkRunLog(envelope(events), content);

  it('a third verdict: "limit" is gone from the rules, so a log claiming one is not a log', () => {
    const events = [
      { e: 'met', c: 'magpie', at: 1000 },
      { e: 'verdict', s: 'courier', v: 'limit', at: 2000 },
    ];
    expect(checkRunLog(envelope(events), content)).toEqual({
      legal: false,
      reason: 'malformed log',
    });
  });

  it('a verdict for someone never met', () => {
    expect(forged([{ e: 'verdict', s: 'courier', v: 'take', at: 1000 }])).toEqual({
      legal: false,
      reason: 'event 0: log does not replay exactly',
    });
  });

  it('a skill or character the content does not have', () => {
    expect(forged([{ e: 'inspected', s: 'ghost', at: 1 }])).toEqual({
      legal: false,
      reason: 'event 0: unknown-skill',
    });
    expect(forged([{ e: 'verdict', s: 'ghost', v: 'take', at: 1 }])).toEqual({
      legal: false,
      reason: 'event 0: unknown-skill',
    });
    expect(forged([{ e: 'met', c: 'ghost', at: 1 }])).toEqual({
      legal: false,
      reason: 'event 0: unknown-character',
    });
  });

  it('a skill decided twice, or a log that runs on after the cottage', () => {
    const twice: RunEvent[] = [...live.slice(0, 3), live[2]!];
    expect(forged(twice).legal).toBe(false);
    expect(forged([...live, { e: 'met', c: 'fox', at: 999_999 }]).legal).toBe(false);
  });

  it('time running backwards', () => {
    expect(
      forged([
        { e: 'met', c: 'fox', at: 5000 },
        { e: 'inspected', s: 'locksmith', at: 4000 },
      ]),
    ).toEqual({ legal: false, reason: 'event 1: time-went-backwards' });
  });

  /*
   * The clock is enforced on the server by the same rule that enforces it in the browser: an event
   * stamped at or after the limit is refused and the run ends late. So a client cannot buy more
   * time by writing a later stamp, and cannot hide a late run by dropping its `late` event.
   */
  it('an arrival after the limit, with or without the late event dropped', () => {
    expect(forged([{ e: 'arrived', at: TIME_LIMIT_MS }])).toEqual({
      legal: false,
      reason: 'event 0: out-of-time',
    });
    expect(forged([{ e: 'arrived', at: TIME_LIMIT_MS + 50_000 }]).legal).toBe(false);
  });

  it('a late event early, or stamped anywhere but the limit', () => {
    expect(forged([{ e: 'late', at: TIME_LIMIT_MS - 1 }])).toEqual({
      legal: false,
      reason: 'event 0: time-not-up',
    });
    expect(forged([{ e: 'late', at: TIME_LIMIT_MS + 1 }])).toEqual({
      legal: false,
      reason: 'event 0: log does not replay exactly',
    });
    expect(forged([{ e: 'late', at: TIME_LIMIT_MS }])).toMatchObject({ legal: true, ended: true });
  });

  it('a log played under other content', () => {
    expect(checkRunLog({ ...toRunLog(fullRun(careful)), content: 'fixture-0' }, content)).toEqual({
      legal: false,
      reason: 'content-mismatch',
    });
  });

  it('anything that is not the shape at all, including one too long to be worth replaying', () => {
    for (const bad of [
      null,
      'log',
      42,
      {},
      { rules: 2, content: 'fixture-2', seed: 0 },
      envelope([], -1),
      envelope([], 2 ** 32),
      envelope([], 0.5),
      { rules: 2, content: 'fixture-2', events: [] },
    ])
      expect(checkRunLog(bad, content)).toEqual({ legal: false, reason: 'malformed log' });
    const long = Array.from({ length: MAX_LOG_EVENTS + 1 }, () => ({ e: 'arrived', at: 1 }));
    expect(runLogSchema.safeParse(envelope(long)).success).toBe(false);
  });
});

/*
 * A log written for another rulebook must never score as a v2 run. Two layers keep them apart and
 * BOTH are tested, because either alone has a hole:
 *
 *  1. The ENVELOPE. The retired rulebook's log was a bare array; a v2 log is an object tagged
 *     `rules: 2`. The parser accepts neither a bare array nor another version's tag.
 *  2. The EVENTS. Stripping the envelope must not help: v2 events are keyed `e` where the retired
 *     ones were keyed `t`, and the schema is strict, so a retired event does not parse.
 */
describe('only a v2 log is a v2 run', () => {
  const v2Log = toRunLog(fullRun(careful));
  // The retired rulebook's shape, written out: a bare array of `t`-keyed events.
  const retiredLog = [
    { t: 'met', c: 'rabbit', at: 1 },
    { t: 'verdict', s: 'cottage-finder', v: 'restrict', at: 2 },
    { t: 'arrived', at: 3 },
  ];

  it('refuses a bare array, bare or wrapped in a v2 envelope', () => {
    expect(checkRunLog(retiredLog, content)).toEqual({ legal: false, reason: 'malformed log' });
    expect(checkRunLog(envelope(retiredLog), content)).toEqual({
      legal: false,
      reason: 'malformed log',
    });
  });

  it('refuses an envelope that claims any other rules version', () => {
    expect(checkRunLog(v2Log, content)).toMatchObject({ legal: true, ended: true });
    for (const rules of [1, 3, '2', null])
      expect(checkRunLog({ ...v2Log, rules }, content), String(rules)).toEqual({
        legal: false,
        reason: 'malformed log',
      });
  });

  it('accepts every v2 event kind and none of the retired ones', () => {
    const v2Events: RunEvent[] = [
      { e: 'met', c: 'fox', at: 1 },
      { e: 'inspected', s: 'locksmith', at: 1 },
      { e: 'verdict', s: 'locksmith', v: 'take', at: 1 },
      { e: 'arrived', at: 1 },
      { e: 'late', at: TIME_LIMIT_MS },
    ];
    // Every v2 kind is enumerated, checked against the schema's own option count.
    expect(new Set(v2Events.map((x) => x.e)).size).toBe(runEventSchema.options.length);
    for (const x of v2Events) expect(runEventSchema.safeParse(x).success, x.e).toBe(true);
    for (const x of [...retiredLog, { t: 'read', n: 'forest-post', at: 1 }])
      expect(runEventSchema.safeParse(x).success, x.t).toBe(false);
  });
});
