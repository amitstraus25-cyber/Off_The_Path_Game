import { describe, expect, it } from 'vitest';
import { tryReduce, reduce } from '../src/reducer.ts';
import { begin, content, encounter, fresh, run } from './helpers.ts';
import type { Step } from './helpers.ts';
import type { Action } from '../src/state.ts';

const rejects = (actions: unknown[], next: unknown, reason: string) => {
  const state = run(actions as Step[]);
  const r = tryReduce(state, next as Action, content);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe(reason);
  expect(r.state).toBe(state); // untouched, same reference
};

describe('happy path', () => {
  it('walks title to results and leaderboard', () => {
    let s = run(begin);
    expect(s.phase).toBe('explore');
    expect(s.runId).toBe('r1');
    expect(s.basket).toEqual(['key', 'letter']);
    s = run(encounter('rabbit', 'restrict', ['needs']), s);
    expect(s.phase).toBe('explore');
    expect(s.verdicts).toEqual({ 'cottage-finder': 'restrict' });
    expect(s.basket).toEqual(['key', 'letter', 'route']);
    expect(s.log.map((e) => e.t)).toEqual(['met', 'asked', 'inspected', 'verdict']);
    s = run(encounter('owl', 'reject'), s);
    s = run(encounter('lantern-keeper', 'allow'), s);
    s = run([{ type: 'ENTER_COTTAGE' }, { type: 'FINISH' }, { type: 'LEADERBOARD' }], s);
    expect(s.phase).toBe('leaderboard');
    expect(s.finishedAt).toBeGreaterThan(s.startedAt!);
    expect(s.log.at(-1)?.t).toBe('arrived');
  });

  it('applies outcomes: allow on Cottage Finder removes the key and sets the flag', () => {
    const s = run([...begin, ...encounter('rabbit', 'allow')]);
    expect(s.basket).toEqual(['letter', 'route']);
    expect(s.flags).toEqual(['keyStolen']);
  });

  it('closing panels with BACK never logs and never skips a verdict', () => {
    let s = run([
      ...begin,
      { type: 'MEET', c: 'rabbit' },
      { type: 'INSPECT', s: 'cottage-finder' },
    ]);
    expect(s.phase).toBe('inspect');
    s = run([{ type: 'BACK' }], s);
    expect(s.phase).toBe('dialogue');
    s = run([{ type: 'BACK' }], s);
    expect(s.phase).toBe('explore');
    expect(s.activeCharacter).toBeNull();
    expect(s.verdicts).toEqual({});
    expect(s.log.map((e) => e.t)).toEqual(['met', 'inspected']);
  });

  it('talking to someone again logs "met" and "inspected" only once', () => {
    let s = run([
      ...begin,
      { type: 'MEET', c: 'rabbit' },
      { type: 'INSPECT', s: 'cottage-finder' },
      { type: 'BACK' },
      { type: 'BACK' },
    ]);
    s = run(
      [
        { type: 'MEET', c: 'rabbit' },
        { type: 'INSPECT', s: 'cottage-finder' },
        { type: 'VERDICT', s: 'cottage-finder', v: 'reject' },
      ],
      s,
    );
    expect(s.log.map((e) => e.t)).toEqual(['met', 'inspected', 'verdict']);
  });

  it('RESET returns a fresh title state from anywhere', () => {
    const s = run([...begin, ...encounter('rabbit', 'reject')]);
    expect(reduce(s, { type: 'RESET' }, content)).toEqual(fresh());
  });
});

describe('guards', () => {
  it.each([
    ['START twice', [...begin], { type: 'START', runId: 'x', at: 99999 }, 'wrong-phase'],
    ['BEGIN on title', [], { type: 'BEGIN' }, 'wrong-phase'],
    ['MEET before the game begins', [], { type: 'MEET', c: 'rabbit', at: 1 }, 'wrong-phase'],
    [
      'MEET an unknown character',
      [...begin],
      { type: 'MEET', c: 'ghost', at: 99999 },
      'unknown-character',
    ],
    [
      'ASK outside a dialogue',
      [...begin],
      { type: 'ASK', c: 'rabbit', q: 'needs', at: 99999 },
      'wrong-phase',
    ],
    [
      'ASK the wrong character',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'ASK', c: 'owl', q: 'needs', at: 99999 },
      'wrong-character',
    ],
    [
      'ASK an unknown question',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'ASK', c: 'rabbit', q: 'bogus', at: 99999 },
      'unknown-question',
    ],
    [
      'ASK "show" (that is INSPECT)',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'ASK', c: 'rabbit', q: 'show', at: 99999 },
      'unknown-question',
    ],
    [
      'ASK the same question twice',
      [...begin, { type: 'MEET', c: 'rabbit' }, { type: 'ASK', c: 'rabbit', q: 'who' }],
      { type: 'ASK', c: 'rabbit', q: 'who', at: 99999 },
      'already-asked',
    ],
    [
      'INSPECT outside a dialogue',
      [...begin],
      { type: 'INSPECT', s: 'cottage-finder', at: 99999 },
      'wrong-phase',
    ],
    [
      "INSPECT someone else's skill",
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'INSPECT', s: 'word-weaver', at: 99999 },
      'wrong-skill',
    ],
    [
      // Allow is legal here; restrict and reject are not. See "taking an offer on trust" below.
      'restricting without opening the card',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'VERDICT', s: 'cottage-finder', v: 'restrict', at: 99999 },
      'must-open-the-card',
    ],
    [
      'rejecting without opening the card',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'VERDICT', s: 'cottage-finder', v: 'reject', at: 99999 },
      'must-open-the-card',
    ],
    [
      'VERDICT from the forest, with nobody in front of you',
      [...begin],
      { type: 'VERDICT', s: 'cottage-finder', v: 'allow', at: 99999 },
      'wrong-phase',
    ],
    [
      'VERDICT for another skill',
      [...begin, { type: 'MEET', c: 'rabbit' }, { type: 'INSPECT', s: 'cottage-finder' }],
      { type: 'VERDICT', s: 'word-weaver', v: 'allow', at: 99999 },
      'wrong-skill',
    ],
    ['BACK in explore', [...begin], { type: 'BACK' }, 'wrong-phase'],
    [
      'ENTER_COTTAGE with no verdicts',
      [...begin],
      { type: 'ENTER_COTTAGE', at: 99999 },
      'cottage-locked',
    ],
    [
      'ENTER_COTTAGE with two of three verdicts',
      [...begin, ...encounter('rabbit', 'restrict'), ...encounter('owl', 'reject')],
      { type: 'ENTER_COTTAGE', at: 99999 },
      'cottage-locked',
    ],
    [
      'ENTER_COTTAGE from a dialogue',
      [...begin, { type: 'MEET', c: 'rabbit' }],
      { type: 'ENTER_COTTAGE', at: 99999 },
      'wrong-phase',
    ],
    ['FINISH before the cottage', [...begin], { type: 'FINISH', at: 99999 }, 'wrong-phase'],
    ['LEADERBOARD before results', [...begin], { type: 'LEADERBOARD' }, 'wrong-phase'],
  ])('%s', (_name, setup, next, reason) => rejects(setup, next, reason));

  it('verdicts are final: the character cannot be met again after deciding', () => {
    rejects(
      [...begin, ...encounter('rabbit', 'restrict')],
      { type: 'MEET', c: 'rabbit', at: 99999 },
      'already-decided',
    );
  });

  it('the clock cannot go backwards', () => {
    const s = run([...begin, { type: 'MEET', c: 'rabbit', at: 50_000 }]);
    const r = tryReduce(s, { type: 'ASK', c: 'rabbit', q: 'needs', at: 49_999 }, content);
    expect(r).toMatchObject({ ok: false, reason: 'time-went-backwards' });
  });

  it('reduce() leaves the state untouched on an illegal action', () => {
    const s = run(begin);
    expect(reduce(s, { type: 'FINISH', at: 99999 }, content)).toBe(s);
  });
});
