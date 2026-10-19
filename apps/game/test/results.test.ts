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
import { errandGoals, loadContent } from '@otp/core';
import type { Content, SkillId, Verdict } from '@otp/core';
import { errandState } from '../src/ui/Results';

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
