/*
 * The forest post is the ONLY mechanical demonstration of the thing this game exists to teach: a
 * notice nobody wrote for you, read out by a skill that does exactly what it promised. It is the
 * one notice in `content/game.json` with a `whenExposed`.
 *
 * docs/UX_REVIEW.md blocker 2 found that it can be SPENT before it can FIRE. The only clear lane
 * out of the spawn runs due east along Purple's own row and reaches the post in under ten seconds, so
 * the natural first thing a player does is read it with no verdicts given -- and `already-read`
 * then latched it shut for the rest of the run.
 *
 * The fiction is right and is not what changes here: the injection needs all three capabilities
 * live AT THE MOMENT the notice is read, because it is the lantern that reads the hidden line out,
 * the basket that exposes the letter and the weaver that sends it on. Reading the post with none of
 * them live should do nothing. What changes is that doing so no longer uses the post up.
 */
import { describe, expect, it } from 'vitest';
import { exposedNotices, trifectaLive } from '../src/outcomes.ts';
import { tryReduce } from '../src/reducer.ts';
import { begin, content, encounter, fresh, run } from './helpers.ts';
import type { Step } from './helpers.ts';

const NOTICE = 'forest-post';
const readNotice: Step = { type: 'READ_NOTICE', n: NOTICE };
const allowAll: Step[] = [
  ...encounter('rabbit', 'allow'),
  ...encounter('owl', 'allow'),
  ...encounter('lantern-keeper', 'allow'),
];

describe('a notice read too early is not spent', () => {
  it('reading it with nothing live records the read and fires nothing', () => {
    const state = run([...begin, readNotice]);
    expect(state.read).toEqual([NOTICE]);
    expect(state.flags).not.toContain('locationLeaked');
    expect(state.basket).toContain('letter');
    expect(exposedNotices(state.log, content)).toEqual([]);
  });

  it('and can be read again once all three are live, which is when it fires', () => {
    // The natural route: walk east, read the post, then go back and meet the travellers.
    const state = run([...begin, readNotice, ...allowAll, readNotice]);
    expect(trifectaLive(state.verdicts, content)).toBe(true);
    expect(state.flags).toContain('locationLeaked');
    expect(state.basket).not.toContain('letter');
    expect(exposedNotices(state.log, content).map((n) => n.id)).toEqual([NOTICE]);
  });

  it('fires at most once even from a log that claims several live readings', () => {
    /*
     * The reducer will not produce this -- once the instruction has fired the notice is refused --
     * but `exposedNotices` is also run by the SERVER against a log the client submitted, and
     * CLAUDE.md rule 6 says never trust the client for scores. A log claiming three live readings
     * must still recap one.
     */
    const honest = run([...begin, ...allowAll, readNotice]);
    const doctored = [
      ...honest.log,
      { t: 'read', n: NOTICE, at: 90_000 },
      { t: 'read', n: NOTICE, at: 91_000 },
    ] as typeof honest.log;
    expect(exposedNotices(doctored, content).map((n) => n.id)).toEqual([NOTICE]);
  });

  it('is refused once it has fired, so the beat cannot be replayed', () => {
    const fired = run([...begin, ...allowAll, readNotice]);
    const again = tryReduce(fired, { type: 'READ_NOTICE', n: NOTICE, at: 99_000 }, content);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('already-read');
  });

  it('is refused a second time when it has no hidden instruction to wait for', () => {
    // `cottage-door` carries no `whenExposed`, so nothing about it is pending and the old
    // read-once rule still applies. Only a notice with something left to do stays open.
    const once = run([...begin, { type: 'READ_NOTICE', n: 'cottage-door' }]);
    const twice = tryReduce(once, { type: 'READ_NOTICE', n: 'cottage-door', at: 99_000 }, content);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toBe('already-read');
  });

  it('counts the errand goal once, not once per reading', () => {
    const state = run([...begin, readNotice, ...allowAll, readNotice]);
    expect(state.read.filter((id) => id === NOTICE)).toHaveLength(1);
  });

  it('does not re-open on a reading where the trifecta is not live', () => {
    // Two legs is not three: nothing fires, and nothing is spent either.
    const two = run([...begin, ...encounter('rabbit', 'allow'), ...encounter('owl', 'allow')]);
    const read = tryReduce(two, { type: 'READ_NOTICE', n: NOTICE, at: 50_000 }, content);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.state.flags).not.toContain('locationLeaked');
      const again = tryReduce(read.state, { type: 'READ_NOTICE', n: NOTICE, at: 60_000 }, content);
      // Still pending, because the hidden instruction has not fired: re-reading stays allowed.
      expect(again.ok).toBe(true);
    }
  });

  it('is still refused outside the forest', () => {
    const titled = tryReduce(fresh(), { type: 'READ_NOTICE', n: NOTICE, at: 1000 }, content);
    expect(titled.ok).toBe(false);
    if (!titled.ok) expect(titled.reason).toBe('wrong-phase');
  });
});
