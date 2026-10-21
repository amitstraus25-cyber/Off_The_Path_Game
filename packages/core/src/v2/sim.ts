import { TAKES, VERDICTS, bestVerdict, ceiling, worth } from './content.ts';
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
 * The most a ROTE strategy -- limit every skill without thinking -- may score, as a share of the
 * ceiling. 0.7 because that is the bar this project already lived with: v1 gave its rote strategy,
 * reject-all, 700 of 1,000, and the client accepted that as "draws its own ending" (PLAN.md D7).
 * A rote line must not beat the line the last version drew.
 *
 * This replaced a check with no margin at all (`limitAll < outOf`), argued for on the grounds that
 * "a skill best taken in full already costs limit-all that skill's difference". That is true and
 * it is the flaw: the difference can be ONE POINT. An adversarial reviewer built content that
 * passes the schema, every lint rule and every other trap check -- lantern take 600 / limit 599,
 * courier take 400 with a wolf / limit 400, locksmith 1999 / 1999 both with a wolf, wolfCost 2000
 * -- and limit-everything scores 998 of 1000. The old check passed it. A bound implied by another
 * check can never fail on its own (PAUL_BRIEF trap 5), so it guarded nothing.
 */
export const LIMIT_ALL_SHARE = 0.7;

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

/**
 * THE TRAP STAYS A TRAP: the properties GAME_DESIGN_V2 sections 4 and 5 require of ANY content,
 * measured by playing it. `load.ts` refuses content that fails one, so a retune in Phase B that
 * turns greed into a strategy fails at startup and in the suite, not in front of a visitor.
 *
 * Played with no pace, so the clock decides nothing here; whether a reader can make it in time is
 * `clockCheck`, which needs the world's real pace.
 */
export function trapChecks(content: Content): { ok: boolean; checks: Check[] } {
  const outOf = content.scoring.outOf;
  const careful = play(content, 'careful');
  const greedy = play(content, 'greedy');
  const limitAll = play(content, 'limit-all');
  const bestOf = (v: Verdict): string[] =>
    content.skills.filter((s) => uniqueBest(s, content) === v).map((s) => s.id);

  const checks: Check[] = [
    {
      name: 'careful reaches the ceiling',
      ok: careful.total === outOf,
      detail: `careful scores ${careful.total} of ${outOf} (static ceiling ${ceiling(content)})`,
    },
    {
      name: 'greedy scores near zero',
      ok: greedy.total! <= outOf * GREEDY_SHARE,
      detail: `taking everything scores ${greedy.total}; at most ${outOf * GREEDY_SHARE} allowed`,
    },
    {
      name: 'greedy lets the wolf in',
      ok: greedy.ending === 'wolf',
      detail: `taking everything ends "${greedy.ending}"`,
    },
    /*
     * v1 held this line with reject-all at 700 against 1,000, and v2 holds it at the same share.
     * This used to claim it needed no margin of its own -- see LIMIT_ALL_SHARE for the 998/1000
     * counterexample that proved otherwise.
     */
    {
      name: 'limiting everything is not a strategy',
      ok: limitAll.total! <= outOf * LIMIT_ALL_SHARE,
      detail: `limiting everything scores ${limitAll.total}; at most ${outOf * LIMIT_ALL_SHARE} allowed`,
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
