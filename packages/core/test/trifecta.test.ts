import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../src/content.ts';
import {
  derive,
  exposedNotices,
  findNotice,
  liveCapabilities,
  trifectaLive,
} from '../src/outcomes.ts';
import type { RunEvent } from '../src/state.ts';
import { checkLog } from '../src/runlog.ts';
import { score } from '../src/scoring.ts';
import { tryReduce } from '../src/reducer.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';
import type { Step } from './helpers.ts';

const NOTICE = 'forest-post';
const readNotice: Step = { type: 'READ_NOTICE', n: NOTICE };

/** Each skill grants exactly one leg, so the trifecta needs all three accepted in some form. */
describe('capabilities', () => {
  it('each skill grants exactly one leg, and reject grants nothing', () => {
    expect(liveCapabilities({ 'cottage-finder': 'restrict' }, content)).toEqual(['basket']);
    expect(liveCapabilities({ 'word-weaver': 'restrict' }, content)).toEqual(['word']);
    expect(liveCapabilities({ 'night-light': 'allow' }, content)).toEqual(['strangers']);
    expect(liveCapabilities({ 'cottage-finder': 'reject' }, content)).toEqual([]);
  });

  it('on Word Weaver, restricting is not the same as removing: both verdicts grant the leg', () => {
    for (const v of ['allow', 'restrict'] as const)
      expect(liveCapabilities({ 'word-weaver': v }, content)).toEqual(['word']);
  });

  it('on Night Light, restricting IS removing: it is the one card with a real boundary', () => {
    expect(liveCapabilities({ 'night-light': 'allow' }, content)).toEqual(['strangers']);
    expect(liveCapabilities({ 'night-light': 'restrict' }, content)).toEqual([]);
  });

  it('is returned in a stable order whatever order the verdicts came in', () => {
    const all = {
      'night-light': 'allow',
      'word-weaver': 'allow',
      'cottage-finder': 'allow',
    } as const;
    expect(liveCapabilities(all, content)).toEqual([...CAPABILITIES]);
  });
});

describe('trifectaLive', () => {
  it('needs all three legs; any two are survivable', () => {
    expect(trifectaLive({}, content)).toBe(false);
    expect(trifectaLive({ 'cottage-finder': 'restrict' }, content)).toBe(false);
    expect(trifectaLive({ 'cottage-finder': 'restrict', 'night-light': 'allow' }, content)).toBe(
      false,
    );
    expect(
      trifectaLive(
        { 'cottage-finder': 'restrict', 'night-light': 'allow', 'word-weaver': 'restrict' },
        content,
      ),
    ).toBe(true);
  });

  it('the careful reader is safe: the best verdict on every card leaves one leg, not three', () => {
    const perfect = fullRun({ rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' });
    expect(liveCapabilities(perfect.verdicts, content)).toEqual(['basket']);
    expect(trifectaLive(perfect.verdicts, content)).toBe(false);
  });

  it('least privilege on every card is now enough: restrict-all leaves the lantern dark', () => {
    const careful = fullRun({ rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'restrict' });
    expect(liveCapabilities(careful.verdicts, content)).toEqual(['basket', 'word']);
    expect(trifectaLive(careful.verdicts, content)).toBe(false);
  });

  it('taking the lantern at its word is what lights the third leg', () => {
    // Every verdict here is defensible on its own card; together they are the trifecta.
    const trusting = fullRun({ rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' });
    expect(liveCapabilities(trusting.verdicts, content)).toEqual(['basket', 'strangers', 'word']);
    expect(trifectaLive(trusting.verdicts, content)).toBe(true);
  });
});

describe('the notice (zero-click)', () => {
  const twoLegs: Step[] = [
    ...begin,
    ...encounter('rabbit', 'restrict'),
    ...encounter('lantern-keeper', 'allow'),
  ];
  const threeLegs: Step[] = [...twoLegs, ...encounter('owl', 'restrict')];

  it('does nothing when fewer than three legs are live', () => {
    const before = run(twoLegs);
    const after = run([readNotice], before);
    expect(after.read).toEqual([NOTICE]);
    expect(after.flags).toEqual([]);
    expect(after.basket).toContain('letter');
    expect(after.log.at(-1)).toMatchObject({ t: 'read', n: NOTICE });
  });

  it('fires when all three are live, with no fine print anywhere to have warned you', () => {
    const before = run(threeLegs);
    expect(before.flags).toEqual([]);
    const after = run([readNotice], before);

    expect(after.flags).toEqual(['locationLeaked']);
    expect(after.basket).not.toContain('letter');
    // Nothing on any card declared this flag: that is the whole point of the beat.
    for (const skill of content.skills)
      expect(Object.values(skill.outcomes).flatMap((o) => o.flagsSet)).not.toContain(
        'locationLeaked',
      );
  });

  it('reading it before the third leg is granted is safe, even if the third arrives later', () => {
    const early = run([...twoLegs, readNotice]);
    expect(early.flags).toEqual([]);
    const later = run(encounter('owl', 'restrict'), early);
    expect(trifectaLive(later.verdicts, content)).toBe(true);
    // The lantern was not there to read it out at the time, so the words never reached anyone.
    expect(later.flags).toEqual([]);
    expect(later.basket).toContain('letter');
  });

  it('can only be read once, must be a real notice, and only while exploring', () => {
    const state = run(threeLegs);
    expect(
      tryReduce(state, { type: 'READ_NOTICE', n: 'ghost', at: 99_999 }, content),
    ).toMatchObject({ ok: false, reason: 'unknown-notice' });
    const after = run([readNotice], state);
    expect(tryReduce(after, { type: 'READ_NOTICE', n: NOTICE, at: 99_999 }, content)).toMatchObject(
      { ok: false, reason: 'already-read' },
    );

    const talking = run([{ type: 'MEET', c: 'owl' }], run([...begin]));
    expect(
      tryReduce(talking, { type: 'READ_NOTICE', n: NOTICE, at: 99_999 }, content),
    ).toMatchObject({ ok: false, reason: 'wrong-phase' });
  });

  it('carries a visible line anyone can read and a hidden line only an agent acts on', () => {
    const notice = findNotice(content, NOTICE)!;
    expect(notice.visible).toMatch(/leave word of your errand/i);
    // Clerical, not villainous: a reviewer would have approved this line.
    expect(notice.hidden).toMatch(/for the keeper's records/i);
    expect(notice.hidden).toMatch(/routine/i);
    expect(findNotice(content, 'ghost')).toBeUndefined();
  });

  it('ignores a forged log that names a notice which does not exist', () => {
    // derive() and exposedNotices() are also called server-side on submitted logs.
    const forged = [
      ...run([...threeLegs]).log,
      { t: 'read', n: 'ghost-post', at: 900_000 },
    ] as RunEvent[];
    expect(derive(forged, content).flags).toEqual([]);
    expect(exposedNotices(forged, content)).toEqual([]);
  });

  it('exposedNotices lists only the ones that actually fired', () => {
    expect(exposedNotices(run([...twoLegs, readNotice]).log, content)).toEqual([]);
    expect(exposedNotices(run([...threeLegs, readNotice]).log, content).map((n) => n.id)).toEqual([
      NOTICE,
    ]);
  });

  it('replays through the log validator either way', () => {
    for (const steps of [
      [...twoLegs, readNotice],
      [...threeLegs, readNotice],
    ]) {
      const live = run(steps);
      const checked = checkLog(live.log, content, live.startedAt!);
      expect(checked.legal).toBe(true);
      if (checked.legal) {
        expect(checked.state.flags).toEqual(live.flags);
        expect(checked.state.basket).toEqual(live.basket);
      }
    }
  });
});

describe('scoring the boundary', () => {
  it('the careful reader keeps the boundary bonus and still does the errand', () => {
    const r = score(
      fullRun({ rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' }, ['needs']).log,
      content,
    );
    expect(r).toMatchObject({ total: 1000, boundaryHeld: true });
    // The route is the only one of Grandma's three the careful line can carry out: the other two
    // need a messenger and a lantern this run deliberately did not take.
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);
  });

  it('restrict-all keeps the boundary bonus, because the lantern grants nothing', () => {
    const r = score(
      fullRun({ rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'restrict' }).log,
      content,
    );
    expect(r).toMatchObject({ boundaryHeld: true, boundaryBonus: 200 });
    // Restricting the messenger makes the word goal possible, but this run never walks to the
    // post, so it is not earned: holding a capability is not the same as using it.
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);
  });

  it('allowing the lantern alongside two restrictions loses the boundary bonus', () => {
    const r = score(
      fullRun({ rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' }).log,
      content,
    );
    expect(r).toMatchObject({ boundaryHeld: false, boundaryBonus: 0 });
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);
  });

  it('reject-all holds the boundary but fails the errand', () => {
    const r = score(
      fullRun({ rabbit: 'reject', owl: 'reject', 'lantern-keeper': 'reject' }).log,
      content,
    );
    expect(r).toMatchObject({ boundaryHeld: true, errandDone: false, total: 600 });
  });

  it('a fired notice costs the letter, which the ending then reflects', () => {
    const threeLegs = run([
      ...begin,
      ...encounter('rabbit', 'restrict'),
      ...encounter('lantern-keeper', 'allow'),
      ...encounter('owl', 'restrict'),
      readNotice,
    ]);
    expect(threeLegs.flags).toEqual(['locationLeaked']);
    const r = score(threeLegs.log, content);
    expect(r.boundaryHeld).toBe(false);
    // Going to the post is how the word goal gets done -- and, with all three legs live, also how
    // the letter leaves the basket. The errand and the trap are the same walk.
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route', 'word']);
  });
});
