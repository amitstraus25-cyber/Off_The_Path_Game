import { describe, expect, it } from 'vitest';
import { compareRuns, score } from '../src/scoring.ts';
import { VERDICTS } from '../src/content.ts';
import { begin, content, encounter, fullRun, run } from './helpers.ts';

// Best verdicts are restrict / reject / restrict. Every skill grants a leg on allow; only
// night-light offers a real boundary, where restrict grants nothing at all.
const POINTS = {
  'cottage-finder': { allow: 0, restrict: 200, reject: 100 },
  // Restricting the messenger now earns an errand goal, so it costs more than it used to: without
  // that it was a free trade and "restrict everything" tied a perfect run.
  'word-weaver': { allow: 0, restrict: 50, reject: 200 },
  'night-light': { allow: 100, restrict: 200, reject: 100 },
} as const;
const CHAR_OF = {
  'cottage-finder': 'rabbit',
  'word-weaver': 'owl',
  'night-light': 'lantern-keeper',
} as const;

describe('score: every skill x verdict', () => {
  const rows = (Object.keys(POINTS) as (keyof typeof POINTS)[]).flatMap((skill) =>
    VERDICTS.map((v) => [skill, v, POINTS[skill][v]] as const),
  );
  it.each(rows)('%s + %s = %i points', (skill, verdict, points) => {
    const s = run([...begin, ...encounter(CHAR_OF[skill], verdict)]);
    const result = score(s.log, content);
    expect(result.bonus).toBe(0);
    expect(result.perSkill.find((p) => p.skillId === skill)).toMatchObject({
      verdict,
      points,
      questionedFirst: false,
    });
    // One skill alone can never light all three legs, so the boundary always holds here.
    expect(result.boundaryHeld).toBe(true);
  });
});

describe('score: whole runs (seed content)', () => {
  const perfect = { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' };
  const rejectAll = { rabbit: 'reject', owl: 'reject', 'lantern-keeper': 'reject' };
  const allowAll = { rabbit: 'allow', owl: 'allow', 'lantern-keeper': 'allow' };
  const restrictAll = { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'restrict' };

  it.each([
    // None of these runs walks to a notice, so only the `route` goal -- the one with no act --
    // can be earned. Going to the post and the door is worth up to 200 more; see table in
    // docs/DESIGN_V2.md.
    ['perfect, no questions', perfect, [], 900],
    ['perfect plus the question bonus', perfect, ['needs'], 1000],
    ['reject-all, no questions', rejectAll, [], 600],
    // Allowing in full sets a flag on two of the three, and a capability obtained that way does
    // not carry out Grandma's errand, so allow-all earns no goal at all.
    ['allow-all, no questions', allowAll, [], 100],
    // Least privilege on every card keeps the boundary, because restricting the lantern grants
    // nothing: close to a perfect run, but it misses night-light's full marks and the messenger's.
    ['restrict-all, no questions', restrictAll, [], 750],
    ['restrict-all with questions', restrictAll, ['needs'], 850],
  ] as const)('%s = %i', (_n, verdicts, questions, total) => {
    expect(score(fullRun(verdicts, [...questions]).log, content).total).toBe(total);
  });

  it('breaks the total into its parts', () => {
    const r = score(fullRun(perfect, ['needs']).log, content);
    expect(r).toMatchObject({
      total: 1000,
      bonus: 100,
      boundaryBonus: 200,
      errandBonus: 100,
      boundaryHeld: true,
      // Only the route was carried out: the other two goals need capabilities this run refused,
      // which is the trade the game is about rather than a failure.
      errandDone: false,
    });
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);
    expect(r.perSkill.reduce((sum, s) => sum + s.points, 0)).toBe(600);
  });

  it('a goal needing an act is only earned by doing it on the walk', () => {
    // Same verdicts either way; the difference is whether Red went to the post.
    const withWord = { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'restrict' } as const;
    const straightThere = score(fullRun(withWord, ['needs']).log, content);
    expect(straightThere.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);

    const viaPost = score(
      [...fullRun(withWord, ['needs']).log, { t: 'read', n: 'forest-post', at: 9000 } as const],
      content,
    );
    expect(viaPost.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route', 'word']);
    expect(viaPost.total).toBe(straightThere.total + 100);
  });

  /*
   * The second optimal line, and the one that pays for the walk. Allowing the lantern in full is
   * the only way to earn `strangers`, which is the only way to read the note on Grandma's door,
   * so this run trades the lantern's best verdict for two errand goals and lands on the same
   * ceiling as the careful line.
   *
   * It is pinned here because for a while the map made it impossible: the trigger that ends the
   * walk sat on the garden gate, in front of the door note, so no amount of correct play reached
   * it. Scoring was always right; the forest was not. apps/game/test/map.test.ts guards the
   * geometry, and this guards the number it is supposed to produce.
   */
  it('the errand line ties the ceiling by reading the note on the door', () => {
    const errand = { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'allow' } as const;
    const read = (n: string, at: number) => ({ t: 'read', n, at }) as const;
    const base = fullRun(errand, ['needs']).log;

    const stoppedAtTheGate = score([...base, read('forest-post', 9000)], content);
    const wentToTheDoor = score(
      [...base, read('forest-post', 9000), read('cottage-door', 9500)],
      content,
    );

    expect(stoppedAtTheGate.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route']);
    expect(wentToTheDoor.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route', 'sign']);
    expect(wentToTheDoor.total).toBe(stoppedAtTheGate.total + 100);
    expect(wentToTheDoor.total).toBe(1000);
    expect(wentToTheDoor.boundaryHeld).toBe(true);
  });

  /*
   * The errand is a real trade, not a checklist. `word` is only earned by restricting the Owl,
   * which costs the messenger its full marks, and `sign` is only earned by allowing the Lantern
   * in full, which is the one verdict that drops the boundary. So all three goals at once scores
   * 750, below both 1,000 lines. Worth pinning: it is the claim the whole errand rests on, and
   * nothing else in the suite says it.
   */
  it('you cannot carry out the whole errand and keep the boundary', () => {
    const everything = { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' } as const;
    const r = score(
      [
        ...fullRun(everything, ['needs']).log,
        { t: 'read', n: 'forest-post', at: 9000 } as const,
        { t: 'read', n: 'cottage-door', at: 9500 } as const,
      ],
      content,
    );
    expect(r.goals.filter((g) => g.met).map((g) => g.id)).toEqual(['route', 'word', 'sign']);
    expect(r.errandDone).toBe(true);
    expect(r.boundaryHeld).toBe(false);
    expect(r.total).toBe(750);
  });

  it('a capability taken by allowing in full does not carry out the errand', () => {
    // Cottage Finder allow grants `basket` and still adds the route, but it takes the key with it.
    const leaked = { rabbit: 'allow', owl: 'reject', 'lantern-keeper': 'restrict' } as const;
    const r = score(fullRun(leaked, ['needs']).log, content);
    expect(r.goals.find((g) => g.id === 'route')!.met).toBe(false);
    expect(r.errandBonus).toBe(0);
  });

  it('withholds the boundary bonus exactly when all three legs end up live', () => {
    // Restricting the lantern grants nothing, so the third leg lights only if you allow it.
    const trifecta = { rabbit: 'restrict', owl: 'restrict', 'lantern-keeper': 'allow' };
    expect(score(fullRun(trifecta).log, content)).toMatchObject({
      boundaryHeld: false,
      boundaryBonus: 0,
    });
    expect(score(fullRun(restrictAll).log, content)).toMatchObject({
      // Least privilege everywhere: the lantern stays dark and the boundary holds.
      boundaryHeld: true,
      boundaryBonus: 200,
    });
    expect(score(fullRun(rejectAll).log, content)).toMatchObject({
      boundaryHeld: true,
      boundaryBonus: 200,
      // Refusing everything means arriving having done none of what Grandma asked.
      errandDone: false,
      errandBonus: 0,
    });
    expect(score(fullRun(rejectAll).log, content).goals.every((g) => !g.met)).toBe(true);
  });
});

describe('score: question bonus', () => {
  const perfect = { rabbit: 'restrict', owl: 'reject', 'lantern-keeper': 'restrict' };

  it('"show me" alone never earns the bonus (inspecting is required anyway)', () => {
    const r = score(fullRun(perfect).log, content);
    expect(r.bonus).toBe(0);
    expect(r.perSkill.every((p) => !p.questionedFirst)).toBe(true);
  });

  it('needs one bonus question on EVERY skill', () => {
    const s = run([
      ...begin,
      ...encounter('rabbit', 'restrict', ['needs']),
      ...encounter('owl', 'reject', ['who']),
      ...encounter('lantern-keeper', 'allow'),
    ]);
    const r = score(s.log, content);
    expect(r.bonus).toBe(0);
    expect(r.perSkill.map((p) => p.questionedFirst)).toEqual([true, true, false]);
  });

  it('a question asked after the verdict cannot count (the log order decides)', () => {
    const log = fullRun(perfect, ['needs']).log;
    const verdictIdx = log.findIndex((e) => e.t === 'verdict');
    // Move the first character's question to after its verdict.
    const askedIdx = log.findIndex((e) => e.t === 'asked');
    const moved = [...log];
    const [asked] = moved.splice(askedIdx, 1);
    moved.splice(verdictIdx, 0, asked!);
    const r = score(moved, content);
    expect(r.perSkill[0]!.questionedFirst).toBe(false);
    expect(r.bonus).toBe(0);
  });

  it('an unfinished run earns no bonus and scores only decided skills', () => {
    const s = run([...begin, ...encounter('rabbit', 'restrict', ['needs', 'who'])]);
    const r = score(s.log, content);
    expect(r).toMatchObject({ bonus: 0, boundaryHeld: true });
    expect(r.perSkill.map((p) => p.verdict)).toEqual(['restrict', null, null]);
    expect(r.perSkill[0]?.points).toBe(200);
  });

  it('an empty log earns only the boundary bonus, since nothing was granted', () => {
    expect(score([], content)).toMatchObject({
      bonus: 0,
      boundaryHeld: true,
      errandDone: false,
      total: 200,
    });
  });
});

describe('compareRuns', () => {
  it('ranks higher scores first, then faster runs', () => {
    expect(
      compareRuns({ total: 900, durationMs: 100 }, { total: 600, durationMs: 50 }),
    ).toBeLessThan(0);
    expect(
      compareRuns({ total: 600, durationMs: 50 }, { total: 900, durationMs: 100 }),
    ).toBeGreaterThan(0);
    expect(
      compareRuns({ total: 900, durationMs: 60 }, { total: 900, durationMs: 90 }),
    ).toBeLessThan(0);
    expect(compareRuns({ total: 900, durationMs: 90 }, { total: 900, durationMs: 90 })).toBe(0);
  });
});
