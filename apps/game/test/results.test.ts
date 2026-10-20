/*
 * docs/UX_REVIEW.md finding 15: Results marked the perfect run's two correct refusals with the
 * failure glyph.
 *
 * The e2e guard in e2e/results-payoff.spec.ts checks what a player sees. This checks the rule
 * underneath it against the shipped content, including the two cases a view-only fix gets wrong:
 * an errand lost by over-refusing a skill is still a miss, and so is one whose capability was
 * granted cleanly and simply never used.
 *
 * `errandState` is imported from the component because it is the component's question. Nothing
 * here touches scoring: `score()` and `recap()` are unchanged, which matters because the server
 * recomputes a posted score from the same functions (CLAUDE.md golden rule 6).
 */
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';
import { createState, errandGoals, loadContent, reduce, score } from '@otp/core';
import type { Content, GameState, SkillId, Verdict } from '@otp/core';
import { breakdown, errandState } from '../src/ui/Results';

/** The shipped content, through the same schema the game validates at startup. */
const content: Content = loadContent(raw);

/** The state Results renders from, for a set of verdicts and a set of notices actually read. */
function rows(
  verdicts: Record<SkillId, Verdict>,
  read: string[] = [],
): Record<string, ReturnType<typeof errandState>> {
  const goals = errandGoals({ verdicts, read }, content);
  return Object.fromEntries(goals.map((g) => [g.id, errandState(g, verdicts, content)]));
}

const PERFECT: Record<SkillId, Verdict> = {
  'cottage-finder': 'restrict',
  'word-weaver': 'reject',
  'night-light': 'restrict',
};

/** The run as the reducer would have produced it, so `score()` reads a real log. */
function runLog(
  verdicts: Record<string, Verdict>,
  opts: { inspect?: boolean; read?: string[]; ask?: boolean } = {},
): GameState {
  // `at` is the run clock every action carries; nothing here reads it, so it stays 0.
  let state = createState(content);
  state = reduce(state, { type: 'START', runId: 'breakdown', at: 0 }, content);
  state = reduce(state, { type: 'BEGIN' }, content);
  for (const notice of opts.read ?? [])
    state = reduce(state, { type: 'READ_NOTICE', n: notice, at: 0 }, content);
  for (const [skillId, verdict] of Object.entries(verdicts)) {
    const character = content.characters.find((c) => c.skillId === skillId)!;
    state = reduce(state, { type: 'MEET', c: character.id, at: 0 }, content);
    if (opts.ask)
      state = reduce(
        state,
        { type: 'ASK', c: character.id, q: content.scoring.bonusQuestions[0]!, at: 0 },
        content,
      );
    if (opts.inspect !== false)
      state = reduce(state, { type: 'INSPECT', s: skillId, at: 0 }, content);
    state = reduce(state, { type: 'VERDICT', s: skillId, v: verdict, at: 0 }, content);
    if (state.phase !== 'explore') state = reduce(state, { type: 'BACK' }, content);
  }
  return state;
}

describe('an errand given up to keep the boundary is not a miss', () => {
  it('the perfect run shows one done and two traded, and nothing missed', () => {
    expect(rows(PERFECT)).toEqual({ route: 'met', word: 'traded', sign: 'traded' });
  });

  it('every skill in the perfect run is itself a success, so recap() needed no change', () => {
    // The point of checking this here: if a correct Reject did not already score maxPerSkill,
    // finding 15 would be a scoring bug in packages/core and not the view's to fix.
    for (const skill of content.skills)
      expect(
        skill.outcomes[skill.bestVerdict].points,
        `${skill.id} best verdict ${skill.bestVerdict}`,
      ).toBe(content.scoring.maxPerSkill);
  });

  it('an errand thrown away by over-refusing a skill is still a miss', () => {
    // Cottage Finder grants the basket cleanly on its best verdict, Restrict. Rejecting it loses
    // "Find the cottage before dark" and buys no boundary that Restrict did not already buy.
    expect(rows({ ...PERFECT, 'cottage-finder': 'reject' })['route']).toBe('missed');
  });

  it('an errand whose capability was held and never used is a miss, not a trade', () => {
    // Word Weaver on Restrict grants the sending with no flag. Not going to the post is the
    // player's omission on the walk, and saying "traded for the boundary" there would be the same
    // false claim about the player's own run as finding 1.
    expect(rows({ ...PERFECT, 'word-weaver': 'restrict' })['word']).toBe('missed');
    expect(rows({ ...PERFECT, 'word-weaver': 'restrict' }, ['forest-post'])['word']).toBe('met');
  });

  it('a capability granted with a flag is never a trade: that errand ran for the wolf', () => {
    // Allowing Cottage Finder grants the basket and steals the key, so the goal is unmet -- but
    // the player did not withhold anything, so the row must not claim a boundary it never kept.
    expect(rows({ ...PERFECT, 'cottage-finder': 'allow' })['route']).toBe('missed');
  });

  it('allowing everything trades nothing', () => {
    const allowed = rows({
      'cottage-finder': 'allow',
      'word-weaver': 'allow',
      'night-light': 'allow',
    });
    expect(Object.values(allowed)).not.toContain('traded');
  });

  it('an undecided skill is not a trade either', () => {
    // Results only renders after all three verdicts, but a row must never read as a deliberate
    // trade on the strength of a decision nobody made.
    expect(rows({})['word']).toBe('missed');
  });
});

/*
 * docs/UX_REVIEW.md finding 13's arithmetic half: the parts must sum to the headline.
 *
 * `breakdown()` builds one clause per bonus and `score()` adds five of them into `total`. The
 * trust bonus had a clause written for it in content (`trustBreakdown`) and no code reading it, so
 * a clean take-one-on-trust run printed parts summing to 800 under a headline of 900 -- the same
 * kind of claim about the player's own run as finding 1, in arithmetic rather than prose.
 *
 * The guard adds up the numbers in the rendered sentence and holds them against `result.total`, so
 * a sixth bonus cannot be added to `score()` without a clause here: it fails on the shape of the
 * string, not on a hardcoded list of bonus names.
 */
describe('the breakdown sums to the score above it', () => {
  /** Every number at the head of a clause in the sentence the screen prints. */
  const clauseTotal = (sentence: string): number =>
    sentence
      .split(' · ')
      .map((clause) => Number(/^(\d+)\b/.exec(clause)?.[1] ?? NaN))
      .reduce((sum, n) => sum + n, 0);

  const cases: [string, GameState][] = [
    ['the perfect run', runLog(PERFECT)],
    ['one taken on trust, nothing stolen', runLog({ 'night-light': 'allow' }, { inspect: false })],
    [
      'taken on trust and the rest played right',
      runLog({ ...PERFECT, 'night-light': 'allow' }, { inspect: false }),
    ],
    [
      'allow everything',
      runLog({ 'cottage-finder': 'allow', 'word-weaver': 'allow', 'night-light': 'allow' }),
    ],
    [
      'reject everything',
      runLog({ 'cottage-finder': 'reject', 'word-weaver': 'reject', 'night-light': 'reject' }),
    ],
    ['one verdict only', runLog({ 'cottage-finder': 'restrict' })],
  ];

  it.each(cases)('%s', (_name, state) => {
    const result = score(state.log, content);
    expect(clauseTotal(breakdown(result, content))).toBe(result.total);
  });

  it('says what the trust bonus was for, in the words the content file holds', () => {
    const result = score(runLog({ 'night-light': 'allow' }, { inspect: false }).log, content);
    expect(
      result.trustBonus,
      'the run this guard is about actually earns the bonus',
    ).toBeGreaterThan(0);
    expect(breakdown(result, content)).toContain(content.strings['trustBreakdown']);
  });

  it('spells one word for a person on the road', () => {
    /*
     * docs/UX_REVIEW.md 21: "traveler" appeared twice against six "traveller". It is the Owl's
     * own two lines -- the supply-chain compromise in six words the review asks to protect -- so
     * the spelling was the only thing changed in them.
     */
    const file = JSON.stringify(raw);
    expect(file.match(/traveler(?!l)/g) ?? [], 'American spelling in player copy').toEqual([]);
    expect((file.match(/traveller/g) ?? []).length).toBeGreaterThan(5);
  });

  it('prints no empty or numberless clause', () => {
    for (const [, state] of cases)
      for (const clause of breakdown(score(state.log, content), content).split(' · '))
        expect(clause, 'every clause opens with its own number').toMatch(/^\d+ \S/);
  });
});

/*
 * The headline is `result.total` followed by `scoreOutOf`, and the right-hand half was a hand-typed
 * string with nothing holding it to the ceiling. Change a weight in content/game.json and the
 * number on the left moves while the one on the right does not, so the screen quietly prints a run
 * out of a total nobody can score -- which is the same false claim about the player's own run that
 * findings 1, 13 and 15 above are all instances of, in the one line every player reads.
 *
 * CLAUDE.md rule 3 says adding a skill is a content change. It is, and this is what makes the
 * sentence underneath it keep up.
 */
describe('the headline says what the run was out of', () => {
  /** Best verdict everywhere, a bonus question of everyone, and the whole walk read. */
  const ceiling = score(
    runLog(PERFECT, { ask: true, read: content.notices.map((n) => n.id) }).log,
    content,
  ).total;

  it('the run this is computed from really was played', () => {
    // Without this the assertion below is vacuous: a short-circuited log scores 0, and "1,000"
    // contains "0".
    expect(ceiling).toBeGreaterThanOrEqual(content.scoring.maxPerSkill * content.skills.length);
  });

  it("'out of' names the perfect run's own total, in the digits Results prints", () => {
    // Results.tsx renders `result.total.toLocaleString('en')` immediately before this string, so
    // the grouping has to match it too: "1,000", not "1000".
    expect(content.strings['scoreOutOf']).toContain(ceiling.toLocaleString('en'));
  });
});
