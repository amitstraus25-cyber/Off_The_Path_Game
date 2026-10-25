import { VERDICTS, countWords } from './content.ts';
import type { Content, Skill, Verdict } from './content.ts';
import { bestVerdict, everySeed } from './deal.ts';
import { deadlineMs, wingRideTarget } from './perks.ts';
import { reduce } from './reducer.ts';
import { result } from './scoring.ts';
import type { Ending } from './scoring.ts';
import { TIME_LIMIT_MS, createState } from './state.ts';
import type { Action, State } from './state.ts';

/*
 * A SMALL, PURE SIMULATOR OVER THE v2 RULES, so the content mix is tuned by measurement rather than
 * by taste. Every strategy is played through the real reducer and scored by the real `result()`.
 * Nothing here re-derives a rule; if it did, it could agree with itself and disagree with the game.
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
/**
 * A decision rule. `good` is what the card would tell a reader; only a strategy that sets
 * `inspect` has any business using it, and only `careful` does.
 */
export type Strategy = (skill: Skill, good: boolean, rnd: () => number) => Choice;

/**
 * The strategies GAME_DESIGN_V2 names. Careful reads every card; greedy and leave-all read none,
 * which is what makes them fast -- and greedy fast is the real failure: nobody reads permission
 * prompts when they are collecting under time pressure.
 */
export const STRATEGIES: Record<string, Strategy> = {
  careful: (_s, good) => ({ verdict: good ? 'take' : 'leave', inspect: true }),
  greedy: () => ({ verdict: 'take', inspect: false }),
  'leave-all': () => ({ verdict: 'leave', inspect: false }),
  random: (_s, _g, rnd) => ({
    verdict: VERDICTS[Math.floor(rnd() * VERDICTS.length)]!,
    inspect: rnd() < 0.5,
  }),
};

/**
 * THE READING MODEL. One rate for everything: 200 words a minute. The meta-analysis figure for
 * adults reading English non-fiction silently is about 238 (Brysbaert 2019, Journal of Memory and
 * Language 109); 200 is that, slowed for a reader who is reading to decide. A card is every word on
 * it -- the skill's name, its promise, every take line and the leave line -- plus one word for each
 * of the two buttons (identical on all seven cards, learned by the second), plus three seconds to
 * decide. The card counted is the one THIS RUN DEALT, so a bad card's giveaway line is read too.
 */
export const READING = { msPerWord: 60_000 / 200, buttonWords: 2, decideMs: 3_000 } as const;

/** A reading pace: what a word costs, the buttons' words, and the pause to decide. */
export interface Reading {
  msPerWord: number;
  buttonWords: number;
  decideMs: number;
}

/**
 * THE BRISK READ, which is what PAR is measured at (scoring `parMs`, real-content.test.ts). The
 * same card, every word of it, at the meta-analysis rate itself -- 238 words a minute for adults
 * reading English non-fiction silently (Brysbaert 2019, the source `READING` slows down) -- and no
 * pause to decide. It is the pace of a reader who reads every word once and does not dither: the
 * bar for the whole speed bonus, not a pace anyone is held to. `READING` stays the clock check's,
 * because "can a careful reader make it at all" must be asked of the slower reader.
 */
export const BRISK: Reading = { msPerWord: 60_000 / 238, buttonWords: 2, decideMs: 0 };

export const cardWords = (s: Skill, good: boolean, reading: Reading = READING): number => {
  const card = s[good ? 'good' : 'bad'].card;
  return (
    [s.name, s.promise, ...card.take, card.leave].reduce((n, l) => n + countWords(l), 0) +
    reading.buttonWords
  );
};
export const readMs = (s: Skill, good: boolean, reading: Reading = READING): number =>
  cardWords(s, good, reading) * reading.msPerWord + reading.decideMs;

/**
 * How long the world takes, which the content does not know: walking to each character, and
 * talking before deciding. REQUIRED wherever time matters, with no default, because the honest
 * numbers come from the map (test/v2/real-content.test.ts walks it) -- a default written here
 * would be a fact in a comment (PAUL_BRIEF trap 1). Reading a card costs `readMs`.
 */
export interface Pace {
  walkMs: number;
  talkMs: number;
}

export interface PlayOptions {
  /** Omitted: no time passes at all -- not even reading -- so only the verdicts decide. */
  pace?: Pace;
  /** The deal. Also seeds the random strategy. Default 0. */
  seed?: number;
  /** How a card is read when the run is paced. Default `READING`. */
  reading?: Reading;
  /**
   * Whether a paced run gets the time its perks save (default true): after a `walk-faster` take
   * every walk is that much shorter, the leg after a `wing-ride` take costs the flight instead of
   * the walk, and an `early-welcome` take skips the knock at the door. False plays the NO-PERK
   * tour -- every walk walked, every knock knocked -- which is what par is derived from
   * (real-content.test.ts). A `rewind` is the reducer's, not the walk's, so it applies either way;
   * `clockCheck` says how it is counted.
   */
  perks?: boolean;
}

export interface Played {
  strategy: string;
  seed: number;
  state: State;
  ending: Ending | null;
  total: number;
  /** The modelled clock at the last step the strategy took, whether or not the run was still on. */
  elapsedMs: number;
}

/** Plays one strategy through the reducer, meeting every character in walking order. */
export function play(content: Content, strategy: string, opts: PlayOptions = {}): Played {
  const decide = STRATEGIES[strategy];
  if (!decide) throw new Error(`unknown strategy "${strategy}"`);
  return playWith(content, strategy, decide, opts);
}

function playWith(content: Content, strategy: string, decide: Strategy, opts: PlayOptions): Played {
  const seed = opts.seed ?? 0;
  const paced = opts.pace !== undefined;
  const perks = opts.perks ?? true;
  const { walkMs, talkMs } = opts.pace ?? { walkMs: 0, talkMs: 0 };
  const rnd = mulberry32(seed);
  let at = 0;
  let state = createState(content, seed);
  // A step the run refuses -- because the clock ran out mid-walk -- is simply not taken. The run
  // has already ended late by then, and the reducer says so.
  const send = (a: Action): void => void (state = reduce(state, a, content));
  /**
   * What the walk to the next character costs, perks and all; a flight is used up by one leg. A
   * faster walk is rounded UP to a whole millisecond, so a stamp is never sooner than the walk.
   */
  let factor = 1;
  let flight: number | null = null;
  let knockMs = content.world.knockMs;

  send({ type: 'START', runId: `sim-${strategy}` });
  send({ type: 'BEGIN' });
  for (const ch of content.characters) {
    const skill = content.skills.find((s) => s.id === ch.skillId)!;
    const good = state.good.includes(skill.id);
    const { verdict, inspect } = decide(skill, good, rnd);
    send({ type: 'MEET', c: ch.id, at: (at += flight ?? Math.ceil(walkMs / factor)) });
    flight = null;
    if (inspect) {
      send({ type: 'INSPECT', s: skill.id, at: (at += talkMs) });
      const reading = paced ? readMs(skill, good, opts.reading) : 0;
      send({ type: 'VERDICT', s: skill.id, v: verdict, at: (at += reading) });
    } else send({ type: 'VERDICT', s: skill.id, v: verdict, at: (at += talkMs) });
    /*
     * The time a taken perk saves. The simulator meets the cast in walking order, so everybody
     * before a wing ride's giver is met and its landing spot is always the NEXT character's: the
     * flight replaces exactly the next walk. With nobody left unmet it does nothing.
     */
    const e = skill.effect;
    if (perks && verdict === 'take') {
      if (e.kind === 'walk-faster') factor *= e.factor;
      if (e.kind === 'early-welcome') knockMs = 0;
      if (e.kind === 'wing-ride' && wingRideTarget(content, state.met, ch.id) !== null)
        flight = e.flightMs;
    }
  }
  send({ type: 'ENTER_COTTAGE', at: (at += Math.ceil(walkMs / factor) + (paced ? knockMs : 0)) });

  const r = result(state, content);
  return { strategy, seed, state, ending: r.ending, total: r.total, elapsedMs: at };
}

/** One row per strategy and deal: every strategy, played in every deal the content has. */
export const table = (content: Content, pace?: Pace): Played[] =>
  Object.keys(STRATEGIES).flatMap((name) =>
    everySeed(content).map((seed) =>
      play(content, name, pace === undefined ? { seed } : { seed, pace }),
    ),
  );

/** One verdict combination, played in one deal: `verdicts` is aligned with `content.skills`. */
export interface Run {
  seed: number;
  verdicts: Verdict[];
  total: number;
  ending: Ending;
}

/**
 * EVERY VERDICT COMBINATION IN ONE DEAL, PLAYED THROUGH THE REDUCER: 2^n runs, 128 for seven.
 * A property is asserted of every run a player can make, not of the runs somebody thought to try.
 * No card is read (reading changes no score), and the run is unpaced.
 */
export function everyRun(content: Content, seed: number): Run[] {
  const n = content.skills.length;
  const runs: Run[] = [];
  for (let i = 0; i < VERDICTS.length ** n; i++) {
    const verdicts = content.skills.map(
      (_s, k) => VERDICTS[Math.floor(i / VERDICTS.length ** k) % VERDICTS.length]!,
    );
    const p = playWith(
      content,
      `every-${i}`,
      (s) => ({ verdict: verdicts[content.skills.indexOf(s)]!, inspect: false }),
      { seed },
    );
    runs.push({ seed, verdicts, total: p.total, ending: p.ending! });
  }
  return runs;
}

/**
 * The most a CARD-BLIND strategy may average over every deal, as a share of what a run can earn
 * above `played` -- the points every run that ends is given for playing, which no basket earns.
 *
 * A strategy that never opens a card sees nothing that differs between deals -- the schema keeps
 * one copy of everything before the card -- so whatever it does is one fixed verdict combination,
 * and its fair score is that combination's average over every deal. The line is `played` plus 40%
 * of the rest: what it guards is the WEIGHTS, so a retune that made a blind basket pay (a big
 * `clean`, say) fails at load.
 *
 * With the weights of 2026-10-22 (no `played`) the line was 40 and the best blind basket "take one,
 * leave six" averaged 17.1. With the client's floor of 2026-10-25 (25 played, 15 / 15 / 15) the line
 * is 25 + 30 = 55, and the best blind basket averages 40: leaving everything is 40, and taking one
 * and leaving six is right in 15 deals of 35 (60) and the wolf in the other 20 (25).
 *
 * WHY THIS REPLACED THE WORD, POSITION, FOLKLORE AND MAKER GUARDS: those each measured whether
 * something seen before the card predicted the verdict in ONE fixed casting. A random deal makes
 * every one of them zero by construction -- the same greeting is good in 15 deals and bad in 20 --
 * and the schema makes the pre-card text identical between variants, so there is nothing left for
 * them to find (GAME_DESIGN_V2 section 10).
 */
export const ROTE_SHARE = 0.4;

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** Every fixed verdict combination, averaged over every deal, best first. */
export function blindAverages(content: Content): { verdicts: Verdict[]; mean: number }[] {
  const seeds = everySeed(content);
  const sums = new Map<string, { verdicts: Verdict[]; sum: number }>();
  for (const seed of seeds)
    for (const r of everyRun(content, seed)) {
      const key = r.verdicts.join(',');
      const row = sums.get(key) ?? { verdicts: r.verdicts, sum: 0 };
      row.sum += r.total;
      sums.set(key, row);
    }
  return [...sums.values()]
    .map((r) => ({ verdicts: r.verdicts, mean: r.sum / seeds.length }))
    .sort((a, b) => b.mean - a.mean);
}

/**
 * THE TRAP STAYS A TRAP, measured by playing the content. `load.ts` refuses content that fails one.
 * Only what the rules do not already guarantee is checked here: "only the careful run scores 100"
 * and "every wolf run is below every clean one" follow from the scoring rule and the lint, so a
 * check for them could never fail on its own (PAUL_BRIEF trap 5); the suites assert them instead.
 */
export function trapChecks(content: Content): { ok: boolean; checks: Check[] } {
  const { outOf, played } = content.scoring;
  const line = Math.floor(played + (outOf - played) * ROTE_SHARE + 1e-9);
  const missed = everySeed(content).filter(
    (seed) => play(content, 'careful', { seed }).total !== outOf,
  );
  const blind = blindAverages(content)[0]!;
  const checks: Check[] = [
    {
      name: 'careful reaches the ceiling in every deal',
      ok: missed.length === 0,
      detail: `careful misses ${outOf} in ${missed.length} deals`,
    },
    {
      name: 'no card-blind strategy averages above the rote line over every deal',
      ok: blind.mean <= line,
      detail: `best blind basket (${blind.verdicts.join(',')}) averages ${blind.mean.toFixed(1)}; at most ${line} allowed`,
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

/**
 * Whether a player who reads EVERY card can still make it, in EVERY deal, at the pace the world is
 * measured at. Honest cuts both ways: if reading every card cannot be done inside three minutes,
 * the ceiling is unreachable and "out of 100" is a lie on the board. Reports the tightest deal.
 *
 * WITH THE PERKS (the default) each run is held to its own deadline, rewinds included, and gets
 * the walking its perks save. WITHOUT (`perks: false`) it is the no-perk tour held to the bare
 * limit: every walk and knock paid, and no rewind counted even where the careful basket took one.
 * That is the question "can a careful reader make it if no perk helps at all?", which is the one
 * the map's layout has to answer.
 */
export function clockCheck(
  content: Content,
  pace: Pace,
  { perks = true }: { perks?: boolean } = {},
): { ok: boolean; seed: number; ending: Ending | null; elapsedMs: number; marginMs: number } {
  const runs = everySeed(content).map((seed) => play(content, 'careful', { seed, pace, perks }));
  const margin = (p: Played): number => (perks ? deadlineMs(p.state) : TIME_LIMIT_MS) - p.elapsedMs;
  const worst = runs.reduce((w, p) => (margin(p) < margin(w) ? p : w));
  return {
    ok: runs.every((p) => margin(p) > 0),
    seed: worst.seed,
    ending: worst.ending,
    elapsedMs: worst.elapsedMs,
    marginMs: margin(worst),
  };
}

/** The careful verdicts for a deal, aligned with `content.skills`. */
export const carefulVerdicts = (content: Content, good: readonly string[]): Verdict[] =>
  content.skills.map((s) => bestVerdict(good, s.id));
