import type { Content, Kind, Skill, SkillId, Variant, Verdict } from './content.ts';

/*
 * THE DEAL: which skills are good this run (the user's rule, 2026-10-22). Every skill has a good
 * and a bad variant; a seed picks which `content.deal.good` of them are good, and the rest are bad.
 *
 * THE CONSTRAINTS (rules 3, the Gatekeeper and the river, docs/GATEKEEPER.md, 2026-10-25). The
 * deal may also name skills that are `always` good, and `oneOf` groups of which exactly one is
 * good; the rest of the good count is drawn from the skills named in neither. The shipped content
 * deals the Rabbit's Wood Map always good, exactly one of the two ways over the river, and one of
 * the other four: 1 x 2 x 4 = 8 deals, against the 35 that seven-choose-three gave before. Content
 * with neither key deals exactly as it did (test/v2/content.test.ts rebuilds those 35 by hand).
 *
 * NO RANDOMNESS HERE (golden rule 2). The game draws the seed with `crypto.getRandomValues` at the
 * start of each run and hands it to `createState`; the run log carries it, so the server deals the
 * same hand from the same number. This file only turns a number into a hand, deterministically.
 *
 * THE MAPPING IS AN UNRANKING, NOT A SHUFFLE: seed modulo the number of deals is the deal's rank.
 * The rank is a mixed-radix number. Its LOW digit is the free draw, ranked lexicographically over
 * the free skills in content order -- which, with no constraints, is every skill, so the mapping is
 * the plain lexicographic unranking it always was. Above it, one digit per `oneOf` group in content
 * order, naming the group's good member by its position in the group. So seeds 0 to dealCount-1 are
 * every deal exactly once (which is how the tests enumerate them and how the e2e switch pins one),
 * and a uniform 32-bit seed gives a uniform deal to within dealCount / 2^32.
 */

/** Seeds are what `crypto.getRandomValues(new Uint32Array(1))` returns: 0 up to 2^32. */
export const SEED_LIMIT = 2 ** 32;

export const isSeed = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < SEED_LIMIT;

/** n choose k, exact for every size this game can have, and 0 when there is no such choice. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** The deal's three parts: always good, the groups, and the free skills with how many to draw. */
function partsOf(content: Content): {
  always: SkillId[];
  groups: SkillId[][];
  free: SkillId[];
  draw: number;
} {
  const always = content.deal.always ?? [];
  const groups = content.deal.oneOf ?? [];
  const named = new Set([...always, ...groups.flat()]);
  const free = content.skills.map((s) => s.id).filter((id) => !named.has(id));
  return { always, groups, free, draw: content.deal.good - always.length - groups.length };
}

/**
 * How many different deals the content has: the groups' sizes multiplied, times the ways to draw
 * the rest. 8 for the shipped content; 35 for seven skills with three good and no constraints; 0
 * for content the lint refuses because it cannot be dealt.
 */
export const dealCount = (content: Content): number => {
  const { groups, free, draw } = partsOf(content);
  return groups.reduce((n, g) => n * g.length, choose(free.length, draw));
};

/** The skills dealt good by this seed, in content order. Throws on a number that is not a seed. */
export function deal(content: Content, seed: number): SkillId[] {
  if (!isSeed(seed)) throw new RangeError(`not a seed: ${String(seed)}`);
  const count = dealCount(content);
  if (count === 0) throw new RangeError('this content has no deals');
  const { always, groups, free, draw } = partsOf(content);
  const ways = choose(free.length, draw);
  const rank = seed % count;
  const good = new Set<SkillId>(always);
  // The groups, low digit first above the free draw.
  let high = Math.floor(rank / ways);
  for (const g of groups) {
    good.add(g[high % g.length]!);
    high = Math.floor(high / g.length);
  }
  // The free draw: the lexicographic unranking over the free skills.
  let k = draw;
  let low = rank % ways;
  for (let i = 0; k > 0; i++) {
    // How many draws that are still possible put free skill i among the good ones.
    const withThis = choose(free.length - i - 1, k - 1);
    if (low < withThis) {
      good.add(free[i]!);
      k--;
    } else low -= withThis;
  }
  return content.skills.map((s) => s.id).filter((id) => good.has(id));
}

/** Every seed that names a different deal, 0 up to `dealCount`. */
export const everySeed = (content: Content): number[] =>
  Array.from({ length: dealCount(content) }, (_x, i) => i);

/** What a skill is in a run whose good set is `good`. */
export const kindOf = (good: readonly SkillId[], id: SkillId): Kind =>
  good.includes(id) ? 'good' : 'bad';

/** The variant a run shows: the card a player opens and the reveal they read at the end. */
export const variantOf = (good: readonly SkillId[], s: Skill): Variant => s[kindOf(good, s.id)];

/** The careful answer in that run: take the good, leave the bad. */
export const bestVerdict = (good: readonly SkillId[], id: SkillId): Verdict =>
  good.includes(id) ? 'take' : 'leave';
