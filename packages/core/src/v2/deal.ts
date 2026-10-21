import type { Content, Kind, Skill, SkillId, Variant, Verdict } from './content.ts';

/*
 * THE DEAL: which skills are good this run (the user's rule, 2026-10-22). Every skill has a good
 * and a bad variant; a seed picks which `content.deal.good` of them are good, and the rest are bad.
 * Seven skills, three good: 35 deals, so a replay meets the same characters with a different set
 * of malicious ones.
 *
 * NO RANDOMNESS HERE (golden rule 2). The game draws the seed with `crypto.getRandomValues` at the
 * start of each run and hands it to `createState`; the run log carries it, so the server deals the
 * same hand from the same number. This file only turns a number into a hand, deterministically.
 *
 * THE MAPPING IS AN UNRANKING, NOT A SHUFFLE: seed modulo the number of deals is the deal's rank in
 * lexicographic order over `content.skills`. So seeds 0 to 34 are every deal exactly once (which is
 * how the tests enumerate them and how the e2e switch pins one), and a uniform 32-bit seed gives a
 * uniform deal to within 2^32 mod 35 / 2^32, about one part in 10^9.
 */

/** Seeds are what `crypto.getRandomValues(new Uint32Array(1))` returns: 0 up to 2^32. */
export const SEED_LIMIT = 2 ** 32;

export const isSeed = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < SEED_LIMIT;

/** n choose k, exact for every size this game can have. */
function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** How many different deals the content has: 35 for seven skills with three good. */
export const dealCount = (content: Content): number =>
  choose(content.skills.length, content.deal.good);

/** The skills dealt good by this seed, in content order. Throws on a number that is not a seed. */
export function deal(content: Content, seed: number): SkillId[] {
  if (!isSeed(seed)) throw new RangeError(`not a seed: ${String(seed)}`);
  const n = content.skills.length;
  let k = content.deal.good;
  let rank = seed % dealCount(content);
  const good: SkillId[] = [];
  for (let i = 0; k > 0; i++) {
    // How many deals that are still possible put skill i among the good ones.
    const withThis = choose(n - i - 1, k - 1);
    if (rank < withThis) {
      good.push(content.skills[i]!.id);
      k--;
    } else rank -= withThis;
  }
  return good;
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
