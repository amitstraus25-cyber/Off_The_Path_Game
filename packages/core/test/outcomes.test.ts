import { describe, expect, it } from 'vitest';
import { applyOutcome, canEnterCottage, derive, ending, recap } from '../src/outcomes.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';

const verdicts = (r: string, o: string, l: string) => ({ rabbit: r, owl: o, 'lantern-keeper': l });

describe('applyOutcome', () => {
  const outcome = {
    points: 0,
    grants: [],
    basketAdds: ['route', 'key'],
    basketRemoves: ['key'],
    flagsSet: ['keyStolen' as const],
    recap: 'x',
  };
  it('removes then adds without duplicating, and dedupes flags', () => {
    const r = applyOutcome(['key', 'letter'], ['keyStolen'], outcome);
    expect(r.basket).toEqual(['letter', 'route', 'key']);
    expect(r.flags).toEqual(['keyStolen']);
  });
  it('does not mutate its inputs', () => {
    const basket = Object.freeze(['a']);
    const flags = Object.freeze([]);
    expect(() => applyOutcome(basket, flags, outcome)).not.toThrow();
  });
});

describe('canEnterCottage', () => {
  it('needs a verdict for every skill', () => {
    expect(canEnterCottage({ verdicts: {} }, content)).toBe(false);
    expect(
      canEnterCottage({ verdicts: { 'cottage-finder': 'allow', 'word-weaver': 'allow' } }, content),
    ).toBe(false);
    expect(canEnterCottage(fullRun(verdicts('allow', 'allow', 'allow')), content)).toBe(true);
  });
});

describe('endings', () => {
  it.each([
    ['perfect run', verdicts('restrict', 'reject', 'allow'), 'clean', []],
    // Refusing everything takes nothing and carries nothing out, so it no longer draws the same
    // card as a perfect run: no flags, but the route never reached the basket.
    ['reject-all', verdicts('reject', 'reject', 'reject'), 'empty', []],
    ['refused the compass only', verdicts('reject', 'reject', 'restrict'), 'empty', []],
    ['key taken only', verdicts('allow', 'reject', 'allow'), 'close', ['keyStolen']],
    ['messages leaked only', verdicts('restrict', 'allow', 'reject'), 'close', ['messagesLeaked']],
    [
      'allow-all',
      verdicts('allow', 'allow', 'allow'),
      'wolfhouse',
      ['keyStolen', 'messagesLeaked'],
    ],
  ])('%s -> %s', (_n, v, id, flags) => {
    const s = fullRun(v);
    expect(ending(s, content).id).toBe(id);
    expect(s.flags).toEqual(flags);
  });
});

describe('derive', () => {
  it('rebuilds basket, flags and verdicts from the log alone, matching live state', () => {
    for (const v of [
      verdicts('allow', 'allow', 'allow'),
      verdicts('restrict', 'reject', 'allow'),
      verdicts('reject', 'restrict', 'restrict'),
    ]) {
      const live = fullRun(v);
      const d = derive(live.log, content);
      expect(d).toEqual({ basket: live.basket, flags: live.flags, verdicts: live.verdicts });
    }
  });
  it('ignores non-verdict events', () => {
    expect(derive([{ t: 'met', c: 'rabbit', at: 1 }], content)).toEqual({
      basket: ['key', 'letter'],
      flags: [],
      verdicts: {},
    });
  });
});

describe('recap', () => {
  it('has one row per decided skill, in content order', () => {
    const s = run([...begin, ...encounter('owl', 'allow'), ...encounter('rabbit', 'restrict')]);
    const rows = recap(s.log, content);
    expect(rows.map((r) => r.skillId)).toEqual(['cottage-finder', 'word-weaver']);
  });
  it('marks success vs missed and exposes the hidden action', () => {
    const rows = recap(fullRun(verdicts('allow', 'reject', 'restrict')).log, content);
    expect(rows[0]).toMatchObject({
      verdict: 'allow',
      points: 0,
      success: false,
      compromised: true,
      bestVerdict: 'restrict',
    });
    expect(rows[0]!.hiddenAction?.title).toBe('Also copies your cottage key');
    expect(rows[1]).toMatchObject({ success: true, compromised: false });
    // Night Light is the one card where restricting is the best verdict and a real boundary.
    expect(rows[2]).toMatchObject({
      verdict: 'restrict',
      points: 200,
      success: true,
      compromised: false,
      hiddenAction: null,
    });
    expect(rows[2]!.recap).toMatch(/chose what to hold it to/);
  });
});
