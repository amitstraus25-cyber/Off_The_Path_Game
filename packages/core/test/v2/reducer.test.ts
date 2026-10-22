import { describe, expect, it } from 'vitest';
import { reduce, tryReduce } from '../../src/v2/reducer.ts';
import { RUNNING, TIME_LIMIT_MS, createState } from '../../src/v2/state.ts';
import type { Action, State } from '../../src/v2/state.ts';
import { begin, content, deepFreeze, encounter, fresh, fullRun, run } from './helpers.ts';

const refuse = (state: State, action: Action) => {
  const r = tryReduce(state, action, content);
  expect(r.ok).toBe(false);
  return r.ok ? null : r.reason;
};

const forest = (): State => run(begin);

describe('createState', () => {
  it('starts on the title with an empty basket, an unstarted clock, the content version and the deal', () => {
    expect(createState(content, 1)).toEqual({
      phase: 'title',
      contentVersion: 'fixture-2',
      seed: 1,
      good: ['courier'],
      runId: null,
      now: 0,
      met: [],
      inspected: [],
      verdicts: {},
      basket: [],
      perks: [],
      active: null,
      log: [],
    });
  });
});

describe('the walk to the forest', () => {
  it('title, how to play, then the clock starts at zero', () => {
    const howto = run([{ type: 'START', runId: 'abc' }]);
    expect(howto).toMatchObject({ phase: 'howto', runId: 'abc', now: 0 });
    expect(run([{ type: 'BEGIN' }], howto)).toMatchObject({ phase: 'forest', now: 0 });
  });

  it('START and BEGIN each have one phase they belong to', () => {
    expect(refuse(forest(), { type: 'START', runId: 'x' })).toBe('wrong-phase');
    expect(refuse(fresh(), { type: 'BEGIN' })).toBe('wrong-phase');
  });

  it('nothing timed happens before the forest', () => {
    expect(refuse(fresh(), { type: 'MEET', c: 'fox', at: 0 })).toBe('wrong-phase');
    expect(refuse(fresh(), { type: 'TIME_UP', at: TIME_LIMIT_MS })).toBe('wrong-phase');
  });
});

describe('meeting', () => {
  it('opens the conversation and logs the first meeting only', () => {
    const s = run([...begin, { type: 'MEET', c: 'fox', at: 2000 }]);
    expect(s).toMatchObject({ phase: 'talk', active: 'fox', met: ['fox'], now: 2000 });
    expect(s.log).toEqual([{ e: 'met', c: 'fox', at: 2000 }]);
    const again = run([{ type: 'BACK' }, { type: 'MEET', c: 'fox' }], s);
    expect(again.met).toEqual(['fox']);
    expect(again.log).toHaveLength(1);
  });

  it('refuses a stranger, a meeting from inside a conversation, and a skill already decided', () => {
    expect(refuse(forest(), { type: 'MEET', c: 'ghost', at: 1 })).toBe('unknown-character');
    const talking = run([{ type: 'MEET', c: 'fox' }], forest());
    expect(refuse(talking, { type: 'MEET', c: 'magpie', at: 5000 })).toBe('wrong-phase');
    const decided = run(encounter('locksmith', 'leave'), forest());
    expect(refuse(decided, { type: 'MEET', c: 'fox', at: 9000 })).toBe('already-decided');
  });
});

describe('inspecting', () => {
  it('opens the card for the skill on offer and logs the first opening only', () => {
    const s = run(
      [
        { type: 'MEET', c: 'magpie' },
        { type: 'INSPECT', s: 'courier' },
      ],
      forest(),
    );
    expect(s).toMatchObject({ phase: 'card', inspected: ['courier'] });
    const again = run([{ type: 'BACK' }, { type: 'INSPECT', s: 'courier' }], s);
    expect(again.inspected).toEqual(['courier']);
    expect(again.log.filter((e) => e.e === 'inspected')).toHaveLength(1);
  });

  it('only from a conversation, and only the skill this character offers', () => {
    expect(refuse(forest(), { type: 'INSPECT', s: 'courier', at: 1 })).toBe('wrong-phase');
    const talking = run([{ type: 'MEET', c: 'magpie' }], forest());
    expect(refuse(talking, { type: 'INSPECT', s: 'lantern', at: 5000 })).toBe('wrong-skill');
  });
});

describe('the two verdicts', () => {
  it('take puts the skill in the basket, in the order taken; leave does not', () => {
    const s = run(
      [
        ...encounter('courier', 'take'),
        ...encounter('locksmith', 'leave'),
        ...encounter('lantern', 'take'),
      ],
      forest(),
    );
    expect(s.basket).toEqual([
      { s: 'courier', v: 'take' },
      { s: 'lantern', v: 'take' },
    ]);
    expect(s.verdicts).toEqual({ courier: 'take', locksmith: 'leave', lantern: 'take' });
    expect(s).toMatchObject({ phase: 'forest', active: null });
    expect(s.log.filter((e) => e.e === 'verdict')).toEqual([
      { e: 'verdict', s: 'courier', v: 'take', at: expect.any(Number) },
      { e: 'verdict', s: 'locksmith', v: 'leave', at: expect.any(Number) },
      { e: 'verdict', s: 'lantern', v: 'take', at: expect.any(Number) },
    ]);
  });

  it('either can be said straight from the conversation, without reading the card', () => {
    const s = run(
      [...encounter('courier', 'take', false), ...encounter('locksmith', 'leave', false)],
      forest(),
    );
    expect(s.inspected).toEqual([]);
    expect(s.basket).toEqual([{ s: 'courier', v: 'take' }]);
  });

  it('only for the skill on offer, and only while it is on offer', () => {
    expect(refuse(forest(), { type: 'VERDICT', s: 'courier', v: 'take', at: 1 })).toBe(
      'wrong-phase',
    );
    const card = run(
      [
        { type: 'MEET', c: 'magpie' },
        { type: 'INSPECT', s: 'courier' },
      ],
      forest(),
    );
    expect(refuse(card, { type: 'VERDICT', s: 'lantern', v: 'take', at: 9000 })).toBe(
      'wrong-skill',
    );
  });
});

describe('going back', () => {
  it('card to conversation to forest, and nowhere from the forest', () => {
    const card = run(
      [
        { type: 'MEET', c: 'fox' },
        { type: 'INSPECT', s: 'locksmith' },
      ],
      forest(),
    );
    const talk = run([{ type: 'BACK' }], card);
    expect(talk).toMatchObject({ phase: 'talk', active: 'fox' });
    expect(run([{ type: 'BACK' }], talk)).toMatchObject({ phase: 'forest', active: null });
    expect(refuse(forest(), { type: 'BACK', at: 1 })).toBe('wrong-phase');
  });

  it('is timed like everything else and leaves the log alone', () => {
    const talk = run([{ type: 'MEET', c: 'fox', at: 1000 }], forest());
    const back = run([{ type: 'BACK', at: 4000 }], talk);
    expect(back.now).toBe(4000);
    expect(back.log).toEqual(talk.log);
  });
});

describe('the cottage', () => {
  it('can be entered from the forest at any time, with anything or nothing in the basket', () => {
    const empty = run([{ type: 'ENTER_COTTAGE', at: 3000 }], forest());
    expect(empty.phase).toBe('cottage');
    expect(empty.log).toEqual([{ e: 'arrived', at: 3000 }]);
    expect(fullRun({ lantern: 'take', courier: 'take', locksmith: 'take' }).phase).toBe('cottage');
  });

  it('not from inside a conversation, and the run is over once inside', () => {
    const talking = run([{ type: 'MEET', c: 'fox' }], forest());
    expect(refuse(talking, { type: 'ENTER_COTTAGE', at: 5000 })).toBe('wrong-phase');
    const inside = run([{ type: 'ENTER_COTTAGE' }], forest());
    expect(refuse(inside, { type: 'MEET', c: 'fox', at: 9000 })).toBe('wrong-phase');
    expect(refuse(inside, { type: 'ENTER_COTTAGE', at: 9000 })).toBe('wrong-phase');
    // Arriving in time means the clock no longer matters: nothing after arrival can make it late.
    expect(refuse(inside, { type: 'TIME_UP', at: TIME_LIMIT_MS })).toBe('wrong-phase');
  });
});

describe('the clock is injected, and it only goes forward', () => {
  it('refuses an action stamped before the last one the run accepted, BACK included', () => {
    const s = run(
      [
        { type: 'MEET', c: 'fox', at: 5000 },
        { type: 'BACK', at: 6000 },
      ],
      forest(),
    );
    expect(refuse(s, { type: 'MEET', c: 'fox', at: 5500 })).toBe('time-went-backwards');
    // Equal is not backwards: two things can happen in the same millisecond.
    expect(tryReduce(s, { type: 'MEET', c: 'fox', at: 6000 }, content).ok).toBe(true);
  });

  it('refuses a time that is not a time', () => {
    for (const at of [Number.NaN, Infinity, -1])
      expect(refuse(forest(), { type: 'MEET', c: 'fox', at }), String(at)).toBe('bad-time');
  });
});

describe('three minutes, and then it is over', () => {
  it('names three minutes, and the running phases are the forest, a conversation and a card', () => {
    expect(TIME_LIMIT_MS).toBe(3 * 60 * 1000);
    expect([...RUNNING].sort()).toEqual(['card', 'forest', 'talk']);
  });

  it('TIME_UP at the limit ends the run, from any running phase, and logs it at the limit', () => {
    const fromForest = forest();
    const fromTalk = run([{ type: 'MEET', c: 'fox' }], forest());
    const fromCard = run([{ type: 'INSPECT', s: 'locksmith' }], fromTalk);
    for (const s of [fromForest, fromTalk, fromCard]) {
      const late = run([{ type: 'TIME_UP', at: TIME_LIMIT_MS + 2500 }], s);
      expect(late).toMatchObject({ phase: 'late', active: null, now: TIME_LIMIT_MS });
      expect(late.log.at(-1)).toEqual({ e: 'late', at: TIME_LIMIT_MS });
    }
  });

  it('TIME_UP before the limit is refused: a fast timer cannot end a run early', () => {
    expect(refuse(forest(), { type: 'TIME_UP', at: TIME_LIMIT_MS - 1 })).toBe('time-not-up');
  });

  it('one millisecond before the limit is in time; at the limit is not', () => {
    const inTime = run([{ type: 'ENTER_COTTAGE', at: TIME_LIMIT_MS - 1 }], forest());
    expect(inTime.phase).toBe('cottage');
    const r = tryReduce(forest(), { type: 'ENTER_COTTAGE', at: TIME_LIMIT_MS }, content);
    expect(r).toMatchObject({ ok: false, reason: 'out-of-time' });
    expect(r.state.phase).toBe('late');
  });

  /*
   * THE DECISION, as a test. An action that arrives after the limit is NOT applied -- not even a
   * legal one, not even the step through the cottage door -- and the run ends instead. It is the
   * one refusal that moves the state: refused, because the clock that refused it has ended the
   * run. A tab left in the background throttles the game's own timer, so TIME_UP can arrive late
   * or never; the reducer cannot rely on it, and does not.
   */
  it('any action arriving after time is up is refused, and the run ends instead', () => {
    const talk = run([...encounter('lantern', 'take'), { type: 'MEET', c: 'magpie' }], forest());
    const card = run([{ type: 'INSPECT', s: 'courier' }], talk);
    const late: Action[] = [
      { type: 'MEET', c: 'fox', at: TIME_LIMIT_MS },
      { type: 'INSPECT', s: 'courier', at: TIME_LIMIT_MS + 1 },
      { type: 'VERDICT', s: 'courier', v: 'take', at: TIME_LIMIT_MS + 1 },
      { type: 'BACK', at: TIME_LIMIT_MS + 60_000 },
      { type: 'ENTER_COTTAGE', at: TIME_LIMIT_MS },
    ];
    for (const action of late)
      for (const from of [forest(), talk, card]) {
        const r = tryReduce(from, action, content);
        expect(r, action.type).toMatchObject({ ok: false, reason: 'out-of-time' });
        expect(r.state.phase).toBe('late');
        // The basket is what it was: the late action took nothing and left nothing.
        expect(r.state.basket).toEqual(from.basket);
        expect(r.state.verdicts).toEqual(from.verdicts);
        expect(r.state.log).toEqual([...from.log, { e: 'late', at: TIME_LIMIT_MS }]);
      }
  });

  it('a late run takes nothing more', () => {
    const late = run([{ type: 'TIME_UP', at: TIME_LIMIT_MS }], forest());
    expect(refuse(late, { type: 'MEET', c: 'fox', at: TIME_LIMIT_MS })).toBe('wrong-phase');
    expect(refuse(late, { type: 'TIME_UP', at: TIME_LIMIT_MS })).toBe('wrong-phase');
    expect(refuse(late, { type: 'ENTER_COTTAGE', at: TIME_LIMIT_MS })).toBe('wrong-phase');
  });
});

describe('purity', () => {
  it('never mutates (every state above was frozen), and a refusal returns the same object', () => {
    const s = forest();
    const r = tryReduce(s, { type: 'MEET', c: 'ghost', at: 1 }, content);
    expect(r.state).toBe(s);
  });

  it('reduce is the store form: a refusal leaves the state, the clock still ends a run', () => {
    const s = forest();
    expect(reduce(s, { type: 'BACK', at: 1 }, content)).toBe(s);
    expect(reduce(s, { type: 'MEET', c: 'fox', at: 7 }, content).phase).toBe('talk');
    expect(reduce(s, { type: 'MEET', c: 'fox', at: TIME_LIMIT_MS }, content).phase).toBe('late');
  });

  it('RESET goes back to a fresh title from anywhere, dealt again from the seed it carries', () => {
    const done = deepFreeze(fullRun({ lantern: 'take', courier: 'leave', locksmith: 'leave' }));
    expect(reduce(done, { type: 'RESET', seed: 2 }, content)).toEqual(createState(content, 2));
    expect(reduce(done, { type: 'RESET', seed: 2 }, content).good).toEqual(['locksmith']);
  });

  it('RESET refuses a number that is not a seed, and createState throws on one', () => {
    for (const seed of [-1, 1.5, 2 ** 32, Number.NaN])
      expect(refuse(fresh(), { type: 'RESET', seed }), String(seed)).toBe('bad-seed');
    expect(() => createState(content, -1)).toThrow(RangeError);
  });
});
