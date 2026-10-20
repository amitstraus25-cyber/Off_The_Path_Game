import { describe, expect, it } from 'vitest';
import { checkLog, durationMs, isLegalLog } from '../src/runlog.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';
import type { RunEvent } from '../src/state.ts';

const perfect = { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' };

describe('legal logs', () => {
  it('accepts a live full run and replays to the same state', () => {
    const live = fullRun(perfect, ['needs', 'who']);
    const r = checkLog(live.log, content, live.startedAt!);
    expect(r).toMatchObject({ legal: true, complete: true });
    if (r.legal) {
      expect(r.state.verdicts).toEqual(live.verdicts);
      expect(r.state.basket).toEqual(live.basket);
      expect(r.state.flags).toEqual(live.flags);
      expect(r.state.log).toEqual(live.log);
    }
  });

  it('accepts an empty log and a partial run (not complete)', () => {
    expect(checkLog([], content)).toMatchObject({ legal: true, complete: false });
    const partial = run([...begin, ...encounter('rabbit', 'allow')]);
    expect(checkLog(partial.log, content, partial.startedAt!)).toMatchObject({
      legal: true,
      complete: false,
    });
  });

  it('accepts players who back out of a card and return later', () => {
    const s = run([
      ...begin,
      { type: 'MEET', c: 'rabbit' },
      { type: 'ASK', c: 'rabbit', q: 'needs' },
      { type: 'INSPECT', s: 'cottage-finder' },
      { type: 'BACK' },
      { type: 'BACK' },
      { type: 'MEET', c: 'owl' },
      { type: 'ASK', c: 'owl', q: 'who' },
      { type: 'BACK' },
      { type: 'MEET', c: 'rabbit' },
      { type: 'ASK', c: 'rabbit', q: 'who' },
      { type: 'INSPECT', s: 'cottage-finder' },
      { type: 'VERDICT', s: 'cottage-finder', v: 'restrict' },
    ]);
    expect(isLegalLog(s.log, content, s.startedAt!)).toBe(true);
  });

  it('accepts a verdict logged straight after its inspection (card still open)', () => {
    const s = run([
      ...begin,
      { type: 'MEET', c: 'rabbit' },
      { type: 'INSPECT', s: 'cottage-finder' },
      { type: 'VERDICT', s: 'cottage-finder', v: 'reject' },
    ]);
    expect(isLegalLog(s.log, content, s.startedAt!)).toBe(true);
  });
});

describe('illegal logs', () => {
  const good = fullRun(perfect, ['needs']).log;
  const bad = (log: unknown) => checkLog(log, content, 0);
  const at = (n: number) => 1000 * (n + 1);
  const ev = (...events: RunEvent[]) => events;

  it('rejects anything that is not an array of valid events', () => {
    expect(bad('nope')).toEqual({ legal: false, reason: 'malformed log' });
    expect(bad([{ t: 'verdict', s: 'x', v: 'maybe', at: 1 }])).toMatchObject({ legal: false });
    expect(bad([{ t: 'met', c: 'rabbit', at: 1, extra: true }])).toMatchObject({ legal: false });
    expect(bad([{ t: 'met', c: 'rabbit', at: -5 }])).toMatchObject({ legal: false });
  });

  it('rejects a verdict with no "met" or "inspected" before it (forged shortcut)', () => {
    // Caught by the rule rather than by the replay length now: a restrict with no card open is
    // illegal wherever it came from, which is a stronger rejection than it used to get.
    expect(bad(ev({ t: 'verdict', s: 'cottage-finder', v: 'restrict', at: at(1) }))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('must-open-the-card'),
    });
  });

  it('accepts an honest run that took an offer on trust, and the log stays unread', () => {
    const log = ev(
      { t: 'met', c: 'rabbit', at: at(1) },
      { t: 'verdict', s: 'cottage-finder', v: 'allow', at: at(2) },
    );
    const check = checkLog(log, content, 0);
    expect(check.legal).toBe(true);
    if (!check.legal) return;
    expect(check.state.inspected).toEqual([]);
    expect(check.state.verdicts['cottage-finder']).toBe('allow');
  });

  it('a client cannot claim the points for a careful verdict it never made', () => {
    // The whole server-side guard in one case: swapping `allow` for `restrict` on an unread
    // verdict would buy the careful line's points, and the replay refuses it.
    expect(
      bad(
        ev(
          { t: 'met', c: 'rabbit', at: at(1) },
          { t: 'verdict', s: 'cottage-finder', v: 'restrict', at: at(2) },
        ),
      ),
    ).toMatchObject({ legal: false, reason: expect.stringContaining('must-open-the-card') });
  });

  it('rejects asking or inspecting someone never met', () => {
    expect(bad(ev({ t: 'asked', c: 'owl', q: 'needs', at: at(1) }))).toMatchObject({
      legal: false,
    });
    expect(bad(ev({ t: 'inspected', s: 'word-weaver', at: at(1) }))).toMatchObject({
      legal: false,
    });
  });

  it('rejects the cottage before all three verdicts, and unknown skills or characters', () => {
    expect(bad(ev({ t: 'arrived', at: at(1) }))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('cottage-locked'),
    });
    expect(bad(ev({ t: 'inspected', s: 'ghost', at: at(1) }))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('unknown-skill'),
    });
    expect(bad(ev({ t: 'verdict', s: 'ghost', v: 'allow', at: at(1) }))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('unknown-skill'),
    });
    expect(bad(ev({ t: 'met', c: 'ghost', at: at(1) }))).toMatchObject({
      legal: false,
      reason: expect.stringContaining('unknown-character'),
    });
  });

  it('rejects duplicated events, a second verdict, and a repeated question', () => {
    const dup = [...good, good[0]!];
    expect(bad(dup)).toMatchObject({ legal: false });
    const verdict = good.find((e) => e.t === 'verdict')!;
    expect(bad([...good, verdict])).toMatchObject({ legal: false });
    const asked = good.find((e) => e.t === 'asked')!;
    expect(bad(good.flatMap((e) => (e === asked ? [e, e] : [e])))).toMatchObject({ legal: false });
  });

  it('rejects timestamps that go backwards', () => {
    const tampered = good.map((e, i) => (i === 3 ? { ...e, at: 1 } : e));
    expect(bad(tampered)).toMatchObject({
      legal: false,
      reason: expect.stringContaining('time-went-backwards'),
    });
  });

  it('rejects events after the arrival (nothing can follow the cottage)', () => {
    expect(bad([...good, { t: 'asked', c: 'rabbit', q: 'who', at: 999_999 }])).toMatchObject({
      legal: false,
    });
  });

  it('isLegalLog mirrors checkLog', () => {
    expect(isLegalLog(good, content, 1000)).toBe(true);
    expect(isLegalLog('nope', content)).toBe(false);
  });
});

describe('durationMs', () => {
  it('is arrival minus start, or null before arriving', () => {
    const live = fullRun(perfect);
    expect(durationMs(live.log, live.startedAt!)).toBe(live.log.at(-1)!.at - live.startedAt!);
    expect(durationMs(live.log.slice(0, -1), live.startedAt!)).toBeNull();
  });
});
