import { TAKES, VERDICTS, bestVerdict, ceiling, findCharacterForSkill, worth } from './content.ts';
import type { Content, Skill, Verdict } from './content.ts';
import { reduce } from './reducer.ts';
import { score } from './scoring.ts';
import type { Ending } from './scoring.ts';
import { TIME_LIMIT_MS, createState } from './state.ts';
import type { Action, State } from './state.ts';

/*
 * A SMALL, PURE SIMULATOR OVER THE v2 RULES, so Phase B can tune the content mix by measurement
 * rather than by taste (GAME_DESIGN_V2 section 5: "that is arithmetic, not taste").
 *
 * Every strategy is played through the real reducer and scored by the real `score()`. Nothing here
 * re-derives a rule; if it did, it could agree with itself and disagree with the game.
 */

/** Small seeded PRNG, the same one v1's property test and `tools/sim` use. No dependency. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a strategy decides about one skill: the verdict, and whether to read the card first. */
export interface Choice {
  verdict: Verdict;
  inspect: boolean;
}
export type Strategy = (skill: Skill, content: Content, rnd: () => number) => Choice;

/**
 * The strategies GAME_DESIGN_V2 names. Limiting has to read the card (the reducer refuses an
 * unread limit), so `limit-all` always inspects; greedy and leave-all never do, which is what makes
 * them fast -- and greedy fast is the real failure: nobody reads permission prompts because they
 * are collecting under time pressure.
 */
export const STRATEGIES: Record<string, Strategy> = {
  careful: (s, c) => ({ verdict: bestVerdict(s, c), inspect: true }),
  greedy: () => ({ verdict: 'take', inspect: false }),
  'limit-all': () => ({ verdict: 'limit', inspect: true }),
  'leave-all': () => ({ verdict: 'leave', inspect: false }),
  random: (_s, _c, rnd) => {
    const verdict = VERDICTS[Math.floor(rnd() * VERDICTS.length)]!;
    return { verdict, inspect: verdict === 'limit' || rnd() < 0.5 };
  },
};

/**
 * How long the world takes, which the content does not know: walking to each character, and
 * talking before deciding. REQUIRED wherever time matters, with no default, because the honest
 * numbers come from the map Phase C builds -- a default written here would be a fact in a comment
 * (trap 1) that every later reader believed. Reading a card costs the skill's own `inspectMs`.
 */
export interface Pace {
  walkMs: number;
  talkMs: number;
}

export interface PlayOptions {
  /** Omitted: no time passes at all, so only the verdicts decide the outcome. */
  pace?: Pace;
  seed?: number;
}

export interface Played {
  strategy: string;
  state: State;
  ending: Ending | null;
  total: number | null;
  /** The modelled clock at the last step the strategy took, whether or not the run was still on. */
  elapsedMs: number;
}

/** Plays one strategy through the reducer, meeting every character in content order. */
export function play(content: Content, strategy: string, opts: PlayOptions = {}): Played {
  const decide = STRATEGIES[strategy];
  if (!decide) throw new Error(`unknown strategy "${strategy}"`);
  return playWith(content, strategy, decide, opts);
}

/** `play`, for any decision rule rather than only a named one. Every run in this file goes here. */
function playWith(
  content: Content,
  strategy: string,
  decide: Strategy,
  opts: PlayOptions = {},
): Played {
  const { walkMs, talkMs } = opts.pace ?? { walkMs: 0, talkMs: 0 };
  const rnd = mulberry32(opts.seed ?? 1);
  let at = 0;
  let state = createState(content);
  // A step the run refuses -- because the clock ran out mid-walk -- is simply not taken. The run
  // has already ended late by then, and the reducer says so.
  const send = (a: Action): void => void (state = reduce(state, a, content));

  send({ type: 'START', runId: `sim-${strategy}` });
  send({ type: 'BEGIN' });
  for (const ch of content.characters) {
    const skill = content.skills.find((s) => s.id === ch.skillId)!;
    const { verdict, inspect } = decide(skill, content, rnd);
    send({ type: 'MEET', c: ch.id, at: (at += walkMs) });
    if (inspect) {
      send({ type: 'INSPECT', s: skill.id, at: (at += talkMs) });
      send({ type: 'VERDICT', s: skill.id, v: verdict, at: (at += skill.inspectMs) });
    } else send({ type: 'VERDICT', s: skill.id, v: verdict, at: (at += talkMs) });
  }
  send({ type: 'ENTER_COTTAGE', at: (at += walkMs) });

  const s = score(state.log, content);
  return { strategy, state, ending: s.ending, total: s.total, elapsedMs: at };
}

/** One row per strategy, for a table Phase B reads while tuning. */
export const table = (content: Content, opts: PlayOptions = {}): Played[] =>
  Object.keys(STRATEGIES).map((name) => play(content, name, opts));

/**
 * "Near zero", as a number. The spec's own sketch (GAME_DESIGN_V2 section 6) scores a six-skill
 * greedy haul 120 / 1000; a fifth of the ceiling is that sketch with room to tune, and anything
 * above it is a score a greedy player would be pleased with.
 */
export const GREEDY_SHARE = 0.2;

/**
 * The most a ROTE strategy may score, as a share of the ceiling. 0.7 because that is the bar this
 * project already lived with: v1 gave its rote strategy, reject-all, 700 of 1,000, and the client
 * accepted that as "draws its own ending" (PLAN.md D7). A rote line must not beat the line the
 * last version drew.
 *
 * WHAT COUNTS AS ROTE, and how that grew. This was LIMIT_ALL_SHARE, and before that it was a check
 * with no margin at all (`limitAll < outOf`), argued for on the grounds that "a skill best taken in
 * full already costs limit-all that skill's difference". That is true and it is the flaw: the
 * difference can be ONE POINT. An adversarial reviewer built content that passes the schema, every
 * lint rule and every other trap check -- lantern take 600 / limit 599, courier take 400 with a
 * wolf / limit 400, locksmith 1999 / 1999 both with a wolf, wolfCost 2000 -- and limit-everything
 * scores 998 of 1000. The old check passed it. A bound implied by another check can never fail on
 * its own (PAUL_BRIEF trap 5), so it guarded nothing. v1 held this line with reject-all at 700
 * against 1,000, and v2 held it at the same share.
 *
 * Then it was limit-everything at 0.7 -- and the first real content passed that while a rote line
 * keyed on WORDS beat it: "limit everyone, leave the two whose greeting says 'traveller'" scored
 * 750 with the clean ending, and "leave the travellers, limit anything popular, take the rest" got
 * six of seven right before any card was read. Nothing measured it, because the check only knew
 * one strategy by name. So rote now means every rule a
 * player can follow WITHOUT OPENING A CARD, built from the content's own words (`roteRuns`): the
 * three constants, and every one- and two-clause decision list over the words the cast says and
 * where an offer stands (the first and the last met). The family moves with the copy and the
 * order, so a new tell fails the check the day it is written (trap 3).
 */
export const ROTE_SHARE = 0.7;

/**
 * The most ANY run that let the wolf in may score, as a share of the ceiling.
 *
 * The thesis is that a skill can keep its promise and still serve the wolf, so being compromised
 * has to cost something a player can see on the board. The first content did not: `wolfCost` sat
 * at the floor the lint allows, taking one dangerous skill in full cost 50 points, and a run that
 * let the wolf in scored 950 -- above a clean 900. Seven of the twelve best combinations ended
 * with the wolf. A leaderboard like that teaches that the wolf is a rounding error.
 *
 * Why 0.6: it is a clear ten points under `ROTE_SHARE`. So the best compromised run scores below
 * the most a player is allowed to earn by not reading at all -- a single wolf costs more than
 * skipping every card is allowed to. Any share at or above 0.7 would let a compromised run sit
 * level with or above a rote one.
 *
 * WHAT IT COSTS, measured rather than hoped. This comment used to say 0.6 avoids "a board where
 * every wolf run is the same 0". It does not, and a refuter counted: about nine runs in ten score 0
 * (1,972 of 2,187 for the third content), and so do nearly all runs with four or more wrong
 * verdicts. That is arithmetic, not tuning: the bound makes every wolf-serving verdict cost at
 * least 40% of the ceiling, so any three of them cost more than the whole ceiling and the floored
 * total is 0. Moving `wolfCost` cannot change it (600 gives 88.7%, 700 gives 91.3%). Only a higher
 * share or an unfloored total could, and both are decisions recorded in GAME_DESIGN_V2 section 10,
 * not knobs. What the board still tells apart is the top: one mistake from two from three, and
 * every 0 says by its ending whether the wolf got in.
 */
export const WOLF_SHARE = 0.6;

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** The verdict that is strictly worth more than both others for this skill, or null on a tie. */
function uniqueBest(s: Skill, content: Content): Verdict | null {
  const best = bestVerdict(s, content);
  const w = worth(s, best, content);
  return VERDICTS.every((v) => v === best || worth(s, v, content) < w) ? best : null;
}

/** One verdict combination, played: `verdicts` is aligned with `content.skills`. */
export interface Run {
  verdicts: Verdict[];
  total: number;
  ending: Ending;
}

const runKey = (verdicts: readonly Verdict[]): string => verdicts.join(',');

/**
 * EVERY VERDICT COMBINATION, PLAYED THROUGH THE REDUCER: 3^n runs, 2,187 for seven skills.
 *
 * The trap used to be judged by a handful of named strategies, and a strategy nobody named beat
 * the line (see `ROTE_SHARE`). Enumerating the whole space means a property is asserted of every
 * run a player can make, not of the runs somebody thought to try. Each run limits only what it
 * has to read (the reducer refuses an unread limit); reading changes no score. Unpaced, so the
 * clock decides nothing here.
 */
export function everyRun(content: Content): Run[] {
  const n = content.skills.length;
  const runs: Run[] = [];
  for (let i = 0; i < VERDICTS.length ** n; i++) {
    const verdicts = content.skills.map(
      (_s, k) => VERDICTS[Math.floor(i / VERDICTS.length ** k) % VERDICTS.length]!,
    );
    const p = playWith(content, `every-${i}`, (s) => {
      const verdict = verdicts[content.skills.indexOf(s)]!;
      return { verdict, inspect: verdict === 'limit' };
    });
    runs.push({ verdicts, total: p.total!, ending: p.ending! });
  }
  return runs;
}

/**
 * One word, folded to the form a reader hears as the same word: lower-cased, possessive dropped,
 * and the regular -s, -es, -ies, -ed, -ied and -ing endings taken off, so "fox", "foxes" and
 * "fox's" are one word, and so are "wish"/"wishes", "walk"/"walked"/"walking", "carry"/"carried",
 * "make"/"making" and "horse"/"horses".
 *
 * WHY IT IS THIS LONG. The first fold dropped only a trailing "s", and a refuter showed what that
 * cost: "foxes" folded to "foxe" and "wishes" to "wishe", so four greeting edits in a scratch copy
 * of the real content -- fox/Foxes on the two skills best left, wish/Wishes on the two best taken --
 * made a rule ("fox" -> leave, "wish" -> take, else limit) that scored 1000 clean, and every check
 * passed, because each spelling was said by one skill only and so was never a candidate tell. It
 * also folded "this" to "thi". That exact case is a test now (`test/v2/real-content.test.ts`).
 *
 * WHICH WAY IT ERRS, deliberately. This is a few suffix rules, not a stemmer, and where it is wrong
 * it is wrong by MERGING ("evening" and "even" fold together; "made" and "mad"). A false merge makes
 * one more candidate tell, so the trap checks one more rule and the word-purity test may fail on a
 * pattern no reader would see -- loud, and in the safe direction. A missed fold is the silent
 * failure, and the one this exists to prevent. What it does NOT fold, said plainly: irregular forms
 * ("told"/"tell", "took"/"take", "mice"/"mouse") and synonyms. Those are a human read.
 */
export function foldWord(word: string): string {
  let w = word.toLowerCase().replace(/'s$/, '');
  if (w.length <= 3) return w;
  const was = w;
  if (/ies$/.test(w)) w = `${w.slice(0, -3)}y`;
  else if (/(?:s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (/[^siu]s$/.test(w)) w = w.slice(0, -1);
  else if (/ied$/.test(w)) w = `${w.slice(0, -3)}y`;
  else if (/[^e]ed$/.test(w) && w.length >= 5) w = w.slice(0, -2);
  else if (/ing$/.test(w) && w.length >= 6) w = w.slice(0, -3);
  // "stopped" -> "stopp" -> "stop", "running" -> "runn" -> "run"; never "call" or "kiss".
  if (w !== was && w.length > 3 && /([bcdgkmnprt])\1$/.test(w)) w = w.slice(0, -1);
  // "make" and "mak(ing)", "horse" and "hors(es)" meet here.
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

/**
 * The words a player has seen about a skill BEFORE opening its card: who offers it, their
 * greeting, the skill's name and its promise, each folded by `foldWord`.
 */
export function surfaceWords(content: Content, s: Skill): Set<string> {
  const ch = findCharacterForSkill(content, s.id)!;
  const text = [ch.name, ch.greet, s.name, s.promise].join(' ').toLowerCase();
  return new Set([...text.matchAll(/[a-z]+(?:'[a-z]+)*/g)].map(([w]) => foldWord(w)));
}

/**
 * A rule a player could follow without reading a card, and how it decided each skill.
 * `rule` reads as the player would say it: `"traveller" -> leave, "popular" -> limit, else take`.
 */
export interface RoteRun extends Run {
  rule: string;
  /** How many words the rule reads: 0 for a constant, n for an n-word decision list. */
  depth: number;
}

/**
 * How deep `trapChecks` looks: decision lists of up to this many clauses, each a shared word or
 * where an offer stands. NOT a claim that deeper lists are harmless. The refuting line of the first
 * content needed two words, and a refuter of the second found three-word lists reaching 850 where
 * two-word lists stopped at 650 -- so the check's NAME says "two clauses or fewer" (it said "two
 * words" until position became a clause), and `test/v2/real-content.test.ts` measures the real
 * content at depth three, where it is cheap enough to run once rather than on every load.
 */
export const ROTE_DEPTH = 2;

/**
 * EVERY ROTE STRATEGY THE CONTENT'S OWN WORDS ALLOW. A word is a candidate TELL when it appears in
 * what two or more skills say before their cards are read -- a word one skill alone uses names
 * that skill rather than a pattern, and a player who remembers one skill's answer has learned the
 * skill, not a rule. The family is:
 *
 *   - the three constants: take, limit or leave everything;
 *   - every one-word rule: skills that say w get one verdict, the rest another;
 *   - every decision list of up to `depth` words: w1 first, then w2, ..., then everything else --
 *     the shape of the rote line that refuted the first content ("traveller" -> leave, "popular"
 *     -> limit, else take) -- including the "either word" rules, where two words get one verdict.
 *     The last word's verdict always differs from the "else" one; if it did not, the word would
 *     change nothing and the rule is already in the list one level shallower.
 *
 * TWO WORDS SAID BY EXACTLY THE SAME SKILLS MAKE EXACTLY THE SAME RULES, so a tell is kept once per
 * set of skills that say it, named by the alphabetically first such word. That is what makes depth
 * three cheap enough to measure at all; it changes no score.
 *
 * WHERE AN OFFER STANDS IS A CLAUSE TOO: `the first offer` and `the last offer`, in content order,
 * which is the walking order (GAME_DESIGN_V2 section 10, "the cast"). A refuter found draft 3's one
 * skill best taken in full was the first offer met from the spawn, and "take the first offer" added
 * to the best two-word rule scored 850 clean -- a rule no word check could see, because a position
 * is said by nobody. A position names one skill, which a word one skill says does too, and the
 * difference is why it is in: "take the first thing you are offered" is a habit a player brings to
 * ANY cast, not something learned from this one. Each position is one clause and counts toward the
 * depth like a word, so `ROTE_DEPTH` covers a position with one shared word, and two positions.
 *
 * A RULE THAT DECIDES EVERY SKILL ALONE IS THE CAST MEMORISED, NOT A RULE, and is not counted. That
 * can only happen when the first clause is a position (a word clause always decides two or more
 * skills), and only in a cast no bigger than the depth plus one: in the three-skill fixture "the
 * first offer -> take, the last offer -> leave, else limit" names each skill once. In a launch cast
 * of six or seven it cannot happen at depth three or less, so for the game this excludes nothing.
 *
 * Each rule picks one combination, and its score is read from `everyRun`'s played table, so a rule
 * is scored by the reducer like any other run.
 */
export function roteRuns(
  content: Content,
  runs: Run[] = everyRun(content),
  depth: number = ROTE_DEPTH,
): RoteRun[] {
  const played = new Map(runs.map((r) => [runKey(r.verdicts), r]));
  const said = content.skills.map((s) => surfaceWords(content, s));
  const bySkills = new Map<string, { name: string; says: boolean[] }>();
  for (const word of [...new Set(said.flatMap((w) => [...w]))].sort()) {
    const says = said.map((set) => set.has(word));
    const key = says.map(Number).join('');
    if (says.filter(Boolean).length >= 2 && !bySkills.has(key))
      bySkills.set(key, { name: `"${word}"`, says });
  }
  const offered = (name: string, i: number) => {
    const id = content.characters[i]!.skillId;
    return { name, says: content.skills.map((s) => s.id === id) };
  };
  const tells = [
    ...bySkills.values(),
    offered('the first offer', 0),
    offered('the last offer', content.characters.length - 1),
  ];
  const out: RoteRun[] = [];
  type Clause = { t: number; v: Verdict };
  // Shallowest first, so that where two rules tie the report names the simpler one.
  let level: Clause[][] = [[]];
  for (let d = 0; d <= depth; d++) {
    for (const list of level)
      for (const c of VERDICTS) {
        if (d > 0 && list[d - 1]!.v === c) continue;
        // Which clause decides each skill: its index in the list, or -1 for the "else".
        const by = said.map((_w, k) => list.findIndex((x) => tells[x.t]!.says[k]));
        const alone = (i: number): boolean => by.filter((j) => j === i).length <= 1;
        if (d > 0 && alone(-1) && list.every((_x, i) => alone(i))) continue;
        const verdicts = by.map((i) => list[i]?.v ?? c);
        const rule = [...list.map((x) => `${tells[x.t]!.name} -> ${x.v}`), `else ${c}`];
        out.push({
          ...played.get(runKey(verdicts))!,
          rule: d === 0 ? `everything -> ${c}` : rule.join(', '),
          depth: d,
        });
      }
    if (d === depth) break;
    level = level.flatMap((list) =>
      tells.flatMap((_t, t) =>
        list.some((x) => x.t === t) ? [] : VERDICTS.map((v) => [...list, { t, v }]),
      ),
    );
  }
  return out;
}

const best = <T extends { total: number }>(rs: T[]): T | undefined =>
  rs.reduce<T | undefined>((m, r) => (m === undefined || r.total > m.total ? r : m), undefined);

/**
 * THE TRAP STAYS A TRAP: the properties GAME_DESIGN_V2 sections 4 and 5 require of ANY content,
 * measured by playing it. `load.ts` refuses content that fails one, so a retune in Phase B that
 * turns greed into a strategy fails at startup and in the suite, not in front of a visitor.
 *
 * The properties that are about the WHOLE space of play are asserted over every combination
 * (`everyRun`), never over a few runs somebody named. Played with no pace, so the clock decides
 * nothing here; whether a reader can make it in time is `clockCheck`, which needs the world's pace.
 */
export function trapChecks(content: Content): { ok: boolean; checks: Check[] } {
  const outOf = content.scoring.outOf;
  /*
   * A share of the ceiling, as the most an integer total may score. Floored, because the product
   * is a float: 700 * 0.7 is 489.99999999999994, so a run of exactly 490 against a 700 ceiling
   * would fail a "<= 70%" it meets. Totals are integers, so `total <= floor(share)` is the exact
   * comparison; the epsilon only absorbs that last-bit error.
   */
  const line = (share: number): number => Math.floor(outOf * share + 1e-9);
  const careful = play(content, 'careful');
  const greedy = play(content, 'greedy');
  const runs = everyRun(content);
  const atCeiling = runs.filter((r) => r.total === outOf);
  const wolf = best(runs.filter((r) => r.ending === 'wolf'));
  const rote = best(roteRuns(content, runs))!;
  const bestOf = (v: Verdict): string[] =>
    content.skills.filter((s) => uniqueBest(s, content) === v).map((s) => s.id);
  const named = (r: Run): string =>
    content.skills.map((s, i) => `${s.id} ${r.verdicts[i]}`).join(', ');
  const punished = content.skills.filter(
    (s) => s.did.take.wolf !== undefined && worth(s, 'limit', content) < worth(s, 'take', content),
  );

  const checks: Check[] = [
    {
      name: 'careful reaches the ceiling',
      ok: careful.total === outOf,
      detail: `careful scores ${careful.total} of ${outOf} (static ceiling ${ceiling(content)})`,
    },
    {
      name: 'careful is the only run at the ceiling',
      ok: atCeiling.length === 1,
      detail: `${atCeiling.length} of ${runs.length} combinations score ${outOf}${
        atCeiling.length > 1 ? `: ${atCeiling.map(named).join(' | ')}` : ''
      }`,
    },
    {
      name: 'greedy scores near zero',
      ok: greedy.total! <= line(GREEDY_SHARE),
      detail: `taking everything scores ${greedy.total}; at most ${line(GREEDY_SHARE)} allowed`,
    },
    {
      name: 'greedy lets the wolf in',
      ok: greedy.ending === 'wolf',
      detail: `taking everything ends "${greedy.ending}"`,
    },
    {
      name: 'no rule of two clauses or fewer read off the cast beats the rote line',
      ok: rote.total <= line(ROTE_SHARE),
      detail: `best rote rule scores ${rote.total} (${rote.rule}, ending ${rote.ending}); at most ${line(ROTE_SHARE)} allowed`,
    },
    /*
     * PARTIAL CAUTION IS NEVER PUNISHED. Where taking a skill in full lets the wolf in, limiting it
     * must be worth at least as much. A refuter found the opposite in the second content: Way Teller
     * limited was worth -550 against -500 in full, so a player who READ the card, saw the danger and
     * set a boundary scored 450, and one who took it in full without reading scored 500. That
     * teaches "if in doubt, do not bother limiting", which is the opposite of the game.
     *
     * Bounded to skills whose full take serves the wolf on purpose: for a skill safe in full,
     * limiting is SUPPOSED to cost something (that is what keeps "limit everything" from being a
     * strategy). With the lint's two rules -- a limit never earns more, and never serves the wolf
     * when the take does not -- this bites exactly the skills that serve the wolf both ways: their
     * limit must earn what their take earns. It is not implied by any other check: the fixture's
     * locksmith at take 100 / limit 50 passes all of them and fails this one alone.
     */
    {
      name: 'limiting never scores below taking in full, where taking in full lets the wolf in',
      ok: punished.length === 0,
      detail:
        punished
          .map(
            (s) =>
              `${s.id} limited is worth ${worth(s, 'limit', content)}, in full ${worth(s, 'take', content)}`,
          )
          .join('; ') || 'no skill',
    },
    {
      name: 'no run that let the wolf in comes near a careful one',
      ok: wolf === undefined || wolf.total <= line(WOLF_SHARE),
      detail: wolf
        ? `best wolf run scores ${wolf.total} (${named(wolf)}); at most ${line(WOLF_SHARE)} allowed`
        : 'no combination lets the wolf in',
    },
    ...[...TAKES, 'leave' as const].map((v) => {
      const skills = bestOf(v);
      const word = { take: 'taking in full', limit: 'limiting', leave: 'leaving' }[v];
      return {
        name: `${word} is the best answer somewhere`,
        ok: skills.length > 0,
        detail: `best ${v}: ${skills.join(', ') || 'no skill'}`,
      };
    }),
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * Whether a player who reads EVERY card can still make it, at the pace the world is measured at.
 *
 * GAME_DESIGN_V2 section 2 calls the timer honest. Honest cuts both ways: if reading every card
 * cannot be done inside three minutes, the ceiling is unreachable and "out of 1,000" is a lie on
 * the board. `marginMs` is how tight it is; Phase B wants it small and positive.
 */
export function clockCheck(
  content: Content,
  pace: Pace,
): { ok: boolean; ending: Ending | null; elapsedMs: number; marginMs: number } {
  const p = play(content, 'careful', { pace });
  return {
    ok: p.ending !== 'late',
    ending: p.ending,
    elapsedMs: p.elapsedMs,
    marginMs: TIME_LIMIT_MS - p.elapsedMs,
  };
}
