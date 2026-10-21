import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_TOP_LIMIT,
  VERDICTS,
  exposedNotices,
  liveCapabilities,
  recap,
  score,
} from '@otp/core';
import type { Content, GameState, GoalResult, RecapRow, SkillId, Verdict } from '@otp/core';
import { RESEARCH_URL } from '../embed/postMessage';
/*
 * TWO STATEMENTS FROM ONE MODULE, DELIBERATELY. `test/handle-field.test.ts` matches this exact
 * line -- `import { newHandle } from '../net/leaderboard'` -- to hold the screen and the wire to a
 * single mint function, which is the guard that caught the round where the name on the screen and
 * the name in the request body were different. Merging these into `{ newHandle, readTop }` reddens
 * it. That file belongs to another owner, so the import stays split and this note is why.
 */
import { newHandle } from '../net/leaderboard';
import { readTop } from '../net/leaderboard';
import type { BoardRead } from '../net/leaderboard';
import { CyeraMark, Highlighted, Panel } from './components';
import { Basket } from './SkillCard';
import { Trifecta } from './Trifecta';

/*
 * THE RECAP BADGES WERE TYPED, AND TWO OF THE THREE WERE NOT IN THE FONT. Measured, not asserted:
 * `public/fonts/HafferUprightsVF.ttf` carries 789 codepoints, and U+2713 CHECK MARK and U+2296
 * CIRCLED MINUS are both outside them, while "!" is inside. So this column -- whose whole job is to
 * read as one vocabulary down the page -- rendered two of its three marks from whatever the next
 * family in the stack is, at that family's weight and on its baseline, beside one real Haffer
 * glyph. It is precisely the defect SkillCard.tsx describes over its verdict glyphs, which is why
 * those are drawn.
 *
 * Both are now drawn, on the handover the previous round left here: the two marks as SVG, and the
 * specs that used to read them asserting on `data-glyph` instead of `textContent`
 * (`e2e/trifecta.spec.ts`, `e2e/results-payoff.spec.ts`). `data-glyph` is on the badge for every
 * state including "!", so a spec never has to know which of the three is drawn and which is typed.
 *
 * "!" stays as text -- it is Haffer's own, and it is what both UI_FOUNDATIONS section 5 and the
 * board's Inspect disc show.
 *
 * The paths are copied from SkillCard.tsx rather than imported, deliberately and with a cost: the
 * errand row's comment below claims its mark is "the Restrict glyph from the verdict pills", and
 * before this it was a lookalike character on a different baseline. Now it is the same two shapes,
 * to the coordinate. SkillCard.tsx belongs to another owner this round, so exporting them from
 * there is the next person's one-line tidy, not a cross-task edit today.
 */
const CheckGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path
      d="M4 10.5l4 4 8-9"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const TradedGlyph = () => (
  <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M6.5 10h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
);

/** The badge, named by what it means. `data-glyph` is what the specs read; the mark is what a player sees. */
function Badge({ glyph }: { glyph: 'check' | 'traded' | 'missed' }) {
  return (
    <span class="otp-recap__badge" data-glyph={glyph} aria-hidden="true">
      {glyph === 'check' ? <CheckGlyph /> : glyph === 'traded' ? <TradedGlyph /> : '!'}
    </span>
  );
}

/*
 * Matches the server rule in ARCHITECTURE section 8, so a handle never fails only on the server.
 *
 * NOTHING ON THIS SCREEN CALLS IT ANY MORE, and that is deliberate rather than an oversight. The
 * form below shows a minted handle instead of taking a typed one, and every name `mintHandle` can
 * produce is legal by construction -- `test/leaderboard.test.ts` runs all 3,072 of them through
 * this function and expects null from every one, which is the check that lets the wordlists in
 * packages/core change without the two ends being coordinated by hand. Delete this and that test
 * loses its mirror; the day a typed name comes back, this is the rule it has to pass.
 */
const HANDLE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,14}[A-Za-z0-9]$/;
const BLOCKED = ['cyera', 'admin', 'official', 'moderator', 'support'];

export function validateHandle(raw: string): string | null {
  const handle = raw.trim();
  if (handle.length < 3 || handle.length > 16) return 'Use between 3 and 16 characters.';
  if (!HANDLE.test(handle))
    return 'Letters, numbers, dot, dash or underscore, starting and ending with a letter or number.';
  if (BLOCKED.some((word) => handle.toLowerCase().includes(word)))
    return 'Please pick a different handle.';
  return null;
}

const VERDICT_WORD: Record<Verdict, string> = {
  allow: 'verdictAllowed',
  restrict: 'verdictRestricted',
  reject: 'verdictRejected',
};

/**
 * How an errand row should read. Three states, not two.
 *
 * Two of Grandma's three errands need a capability that the best verdict withholds: "Leave word at
 * the post" needs the Word Weaver's sending, whose best verdict is Reject, and "Read the note she
 * pinned to her door" needs Night Light left listening to strangers, whose best verdict is Restrict.
 * A player who gets all three skills right therefore arrives with one errand done and two given up
 * -- and the screen marked both of those with the Haze ground and the Black "!" disc that
 * UI_FOUNDATIONS section 5 reserves for "Missed it". The one run that understands the lesson was
 * told twice that it had failed, on the screen that carries the argument (docs/UX_REVIEW.md 15).
 *
 * `recap()` is right about the skills themselves -- content lint pins the best verdict to
 * `maxPerSkill`, so a correct Reject already scores full marks and renders as "Caught it" -- so
 * this is a view question about the errand rows, not a scoring one, and nothing here changes a
 * number the server recomputes.
 */
export type ErrandState = 'met' | 'traded' | 'missed';

/** Every verdict actually given on a skill that could have granted what this errand needed. */
function playedFor(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): { outcome: Content['skills'][number]['outcomes'][Verdict]; best: boolean }[] {
  return content.skills.flatMap((skill) => {
    if (!VERDICTS.some((v) => skill.outcomes[v].grants.includes(goal.needs))) return [];
    const given = verdicts[skill.id];
    return given === undefined
      ? []
      : [{ outcome: skill.outcomes[given], best: given === skill.bestVerdict }];
  });
}

export function errandState(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): ErrandState {
  if (goal.met) return 'met';
  const chosen = playedFor(goal, verdicts, content);
  /*
   * The capability was handed over cleanly and the errand still went undone, so what was missing
   * was the walk, not the verdict: holding the Word Weaver on Restrict and never going to the post
   * is a miss, and saying "traded for the boundary" there would be the same kind of lie as finding
   * 1. A grant that comes with a flag is not clean -- that errand was run for the wolf.
   */
  if (chosen.some((c) => c.outcome.grants.includes(goal.needs) && c.outcome.flagsSet.length === 0))
    return 'missed';
  // Given up because every skill that could have granted it was played the way the game says is
  // right. Refusing Cottage Finder outright loses the same errand for nothing, and stays a miss.
  return chosen.length > 0 && chosen.every((c) => c.best) ? 'traded' : 'missed';
}

/**
 * WHY A MISS NEEDS THREE SENTENCES AND HAD ONE.
 *
 * `errandState` already knows the difference between a trade and a miss, and the screen renders
 * both. What it did not do is say WHICH KIND of miss, so all three printed `errandNeeded` --
 * "Needed a skill that reaches into your basket" -- including the two where the player was holding
 * exactly that skill. On an allow/allow/allow run all three errand rows made that claim with the
 * route, the translator and the lantern sitting in the basket eight lines below them, on the one
 * screen whose argument is "read what the thing actually does". A screen that misreports the
 * player's own run is the same defect as findings 1, 13 and 15, and this is its fourth instance.
 *
 *  - `refused`: no verdict the player gave grants it. The capability is genuinely not in hand, and
 *    "needed a skill that..." is true. This is the only case the old copy was right about.
 *  - `unused`: granted, cleanly, and the errand was never run. Night Light allowed grants the
 *    listening with no flag; not walking to the notice is the player's omission on the walk.
 *  - `flagged`: granted, and something came with it. Cottage Finder allowed hands over the basket
 *    and takes the key, so the errand did not go undone for want of a capability -- it ran, and it
 *    ran for the wolf.
 *
 * Split out from `errandState` rather than folded into it so the badge, the Haze ground and the
 * three unit cases that pin them keep their three states: this is which sentence to print, not
 * which mark to draw. Nothing here touches a number the server recomputes.
 */
export type ErrandMiss = 'refused' | 'unused' | 'flagged';

export function errandMiss(
  goal: GoalResult,
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): ErrandMiss {
  const granted = playedFor(goal, verdicts, content).filter((c) =>
    c.outcome.grants.includes(goal.needs),
  );
  if (granted.length === 0) return 'refused';
  return granted.some((c) => c.outcome.flagsSet.length === 0) ? 'unused' : 'flagged';
}

/**
 * How a SKILL row should read. Three states, for the same reason the errand rows have three.
 *
 * `recap()` reports two booleans and this screen used only one of them: `success`, which is
 * `points === maxPerSkill`. So every verdict that was not the best one drew the Black "!" disc and
 * the Haze ground that UI_FOUNDATIONS section 5 reserves for "Missed it" -- the mark that means the
 * hidden action ran. Measured on the shipped content, over all 27 verdict combinations x 4 notice
 * readings: the game has SIX lines that reach the ceiling, and two of them (Cottage Finder
 * restricted, Word Weaver rejected, Night Light ALLOWED, with the door note read) printed "Missed
 * it" on Night Light under a headline reading the full score. A screen that tells a player who
 * scored everything that they failed is the same defect as findings 1, 13 and 15, on the row the
 * section heading promises is about what was hiding.
 *
 * The third state is the one `recap()` already measures and nothing read: `compromised`, which is
 * "this verdict set a flag", which is "something was taken". That is what separates allowing the
 * compass (the key goes) from rejecting it (you walk without a map): both score below the maximum,
 * only one of them was taken from.
 *
 *  - `caught`   full marks. Check mark, Natural ground.
 *  - `costly`   below full marks and nothing taken. The circled minus and Natural ground, exactly
 *               as an errand given up on purpose -- it is the same claim, that the player paid for
 *               something rather than failed to notice it. The chip says `nothingTaken`, which is
 *               the mechanical truth in every case: there is no run on which a flagless verdict
 *               took something, so unlike a judgement about the verdict's quality it cannot go
 *               wrong on the tied-optimal line above.
 *  - `missed`   a flag was set. The "!" disc and the Haze ground, unchanged.
 *
 * `compromised` is read FIRST so the failure mark always wins. Content lint does not forbid a
 * maximum-scoring verdict that also sets a flag (it only forbids it on the declared best verdict),
 * and a row that both lost the key and wore a check mark would be the worst of the three.
 *
 * This lives in the component, beside `errandState`, for the reason that one states: it is the
 * component's question. `recap()` is unchanged, so no number the server recomputes moves
 * (CLAUDE.md golden rule 6) and `tools/sim` keeps reading the field it reads today.
 */
export type SkillState = 'caught' | 'costly' | 'missed';

export const skillState = (row: Pick<RecapRow, 'success' | 'compromised'>): SkillState =>
  row.compromised ? 'missed' : row.success ? 'caught' : 'costly';

/*
 * Each of the four lines reads "<prefix> <the capability's own label>.", which is the shape
 * `errandTradedDetail` already uses, so the capability is named in every state and only the claim
 * about it changes.
 *
 * `errandUnusedDetail` and `errandFlaggedDetail` are the two strings this needed from the content
 * file, and they landed in content/game.json while this was being written, so there is no code-side
 * literal behind either -- which is what `test/strings.test.ts` wants, and why PENDING stays empty.
 */

export interface ResultsProps {
  content: Content;
  state: GameState;
  onReplay(): void;
  onReadResearch(): void;
  /** Posting arrives with the leaderboard in Phase 6; until then this reports it is unavailable. */
  onPost(handle: string): Promise<string | null>;
  /**
   * Reads the board. Resolves to one of three answers; never throws, never hangs.
   *
   * OPTIONAL, and that is a deliberate deviation from the build spec, which wires this through
   * `App.tsx` and `main.ts` beside `onPost`. Both of those files belong to another owner this
   * round and two owners never share a file, so the default is the adapter itself and the seam
   * stays here for the moment they can be edited: pass `onTop` and nothing else changes. It is
   * also what `test/board.test.ts` and the e2e board specs inject.
   */
  onTop?(limit: number): Promise<BoardRead>;
}

/**
 * "600 from your three verdicts · 100 for asking · 200 for never running all three at once"
 *
 * Every bonus `score()` adds into `total` must have a clause here, or the parts do not sum to the
 * headline and the screen that carries the argument is wrong about the player's own run -- the
 * same failure as finding 1, in arithmetic. `trustBonus` had no clause, so a clean
 * take-one-on-trust run showed parts totalling 800 under a headline of 900 (UX_REVIEW finding 13).
 * `trustBreakdown` is the copy that was written for it, and it IS wired -- sixteen lines below, in
 * the `result.trustBonus > 0` clause. This sentence used to end "and never wired", which was true
 * when the copy was first written and false from the moment the clause landed; it survived a round
 * and was repeated in `test/strings.test.ts`'s docstring, which has since corrected itself.
 *
 * Exported for `test/results.test.ts`, which adds the clauses up and holds them against
 * `score().total` on every run shape, so the next bonus cannot be added without one.
 */
export function breakdown(result: ReturnType<typeof score>, content: Content): string {
  const verdictPoints = result.perSkill.reduce((sum, p) => sum + p.points, 0);
  const decided = result.perSkill.filter((p) => p.verdict !== null).length;
  const parts = [`${verdictPoints} from your ${decided === 1 ? 'verdict' : `${decided} verdicts`}`];
  if (result.bonus > 0) parts.push(`${result.bonus} for asking before you decided`);
  if (result.boundaryBonus > 0)
    parts.push(`${result.boundaryBonus} for never running all three at once`);
  const met = result.goals.filter((g) => g.met).length;
  /*
   * "for 1 of 3 of what Grandma asked" put two `of`s in the one sentence that explains the score,
   * and the second one governed nothing: the reader parses "3 of what Grandma asked" and finds no
   * noun. The count needs a thing to count, so it has one.
   */
  if (result.errandBonus > 0)
    parts.push(
      `${result.errandBonus} for ${met} of the ${result.goals.length} things Grandma asked for`,
    );
  if (result.trustBonus > 0)
    parts.push(`${result.trustBonus} ${content.strings['trustBreakdown'] ?? ''}`.trim());
  return parts.join(' · ');
}

/**
 * What the board section is showing. `loading` is the component's own fourth state; the other
 * three are exactly what the adapter answered, carried through without being re-interpreted.
 *
 * The thing this type exists to make impossible: deriving "empty" from an array's length anywhere
 * on this screen. `readTop` decides it once, and a screen that counted rows itself is how an
 * ABSENT board came to be renderable as an EMPTY one.
 */
export type BoardState = { state: 'loading' } | BoardRead;

/**
 * Which string the board's one status line shows, per state. The whole mapping, in one place.
 *
 * EXPORTED BECAUSE IT IS THE HALF OF THE DEFECT THAT LIVES ON THIS SCREEN. `readTop` decides
 * whether a board is empty or absent; this decides what the player is then told. Nothing else
 * composes those two, so `test/board.test.ts` composes exactly this -- it drives a real HTTP reply
 * through `readTop` and looks the answer up here -- and the SPA catch-all's 200 of index.html
 * reaching `boardEmpty` fails there rather than on a research page.
 *
 * A ternary in the JSX could not be checked that way without a DOM, and apps/game's vitest has
 * none. Typed as a total Record so a fifth state cannot be added without a line here.
 */
export const BOARD_NOTE: Record<BoardState['state'], string> = {
  loading: 'boardLoading',
  rows: 'boardReady',
  empty: 'boardEmpty',
  unavailable: 'boardDown',
};

/**
 * WHAT A LINE ON THIS SCREEN ASSERTS, declared beside the line instead of read out of its words.
 *
 * WHY A DECLARATION AND NOT A PATTERN. The guard this replaces matched
 * `/no runs on the board|nothing on the board|would be the first/` against the board note and
 * called the screen honest when it did not fire. A reviewer put the defect straight back with one
 * reworded string -- "The board is empty. Be the first to put a run on it." -- and every assertion
 * stayed green, because the bound was written against a SPELLING and the defect is a MEANING. Four
 * more rewordings pass it. So the claims are named here, the pairing is checked over the claims,
 * and the words are free to change without the property moving.
 *
 * The vocabulary is deliberately only what the two nodes can disagree ABOUT: what the board holds,
 * what it is showing, and what became of the reader's own run. A claim with no `EXCLUSIVE` entry
 * is inert by design and is still named, because "this line asserts nothing that can collide" is
 * the thing that makes it the safe line to show -- and a line with no declaration at all would be
 * indistinguishable from a line nobody has thought about.
 */
export type Claim =
  /** There are runs on the board. */
  | 'boardHoldsRuns'
  /** The board holds nothing at all. The strongest thing any line here says. */
  | 'boardHoldsNoRuns'
  /** The board is showing nothing right now. Says nothing about what it holds. */
  | 'boardShowsNoRuns'
  /** This read of the board did not come back. Scoped to the read, not to the service. */
  | 'boardNotAnswering'
  /** The reader has no run on the board. */
  | 'readerHasNoRun'
  /** The reader's run is on the board. */
  | 'readerRunIsOnBoard'
  /** A run of the reader's may exist and not be showing yet. */
  | 'readerRunMayBePending'
  /** The reader's run did not go up. */
  | 'readerRunDidNotGoUp'
  /** This post did not come back. Scoped to the post, and claims nothing about the run. */
  | 'postNotAnswered';

/**
 * Claims that cannot both be true of one screen at one moment. Unordered pairs.
 *
 * Two requests may disagree and both be honest, which is why `boardNotAnswering` and
 * `postNotAnswered` collide with nothing: a POST that was answered and a GET that was not are two
 * facts about two requests, and each line is scoped to its own. What may never happen is one node
 * asserting the board holds nothing while the other asserts the reader's run is on it.
 */
export const EXCLUSIVE: readonly (readonly [Claim, Claim])[] = [
  ['boardHoldsRuns', 'boardHoldsNoRuns'],
  ['boardHoldsNoRuns', 'readerRunIsOnBoard'],
  // A run that may be pending is a run the board may already hold, so "nothing is on it" is the
  // same contradiction one tense removed. This is the pair the original defect was made of.
  ['boardHoldsNoRuns', 'readerRunMayBePending'],
  ['readerHasNoRun', 'readerRunIsOnBoard'],
  ['readerHasNoRun', 'readerRunMayBePending'],
  ['readerRunIsOnBoard', 'readerRunDidNotGoUp'],
  ['readerRunMayBePending', 'readerRunDidNotGoUp'],
];

/**
 * Every line `.otp-board__note` can carry, by content key, and what it asserts.
 *
 * `boardEmptyAfterPost` is the one shown from the press onwards, and its whole job is to assert
 * nothing a post notice can contradict: it says what the read answered -- nothing is showing -- and
 * explains the lag as a property of the BOARD rather than as a hedge about the reader's run. The
 * hedge is what made a refused post read as a delayed one.
 */
export const NOTE_CLAIMS: Record<string, readonly Claim[]> = {
  boardLoading: [],
  boardReady: ['boardHoldsRuns'],
  boardEmpty: ['boardHoldsNoRuns', 'readerHasNoRun'],
  boardEmptyAfterPost: ['boardShowsNoRuns'],
  boardDown: ['boardNotAnswering'],
};

/**
 * Every line `.otp-error` can carry, by content key, and what it asserts.
 *
 * The keys are the four `content.strings[...]` reads in `src/net/leaderboard.ts`, which is another
 * owner's file: `test/board.test.ts` derives that set from its source rather than trusting this
 * list, so an outcome sentence added there fails the guard until it is declared here. The fifth
 * state of `.otp-error` is that it is not rendered at all, which asserts nothing and is not a key.
 */
export const NOTICE_CLAIMS: Record<string, readonly Claim[]> = {
  handleAssigned: ['readerRunIsOnBoard'],
  leaderboardAlready: ['readerRunIsOnBoard'],
  leaderboardRefused: ['readerRunDidNotGoUp'],
  leaderboardDown: ['postNotAnswered'],
};

/** Every exclusive pair both of these carry at once, named. Empty means the two may sit together. */
export const contradictions = (a: readonly Claim[], b: readonly Claim[]): string[] =>
  EXCLUSIVE.filter(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  ).map(([x, y]) => `${x} / ${y}`);

/**
 * THE SCREEN CANNOT SAY BOTH THINGS AT ONCE, and until 2026-10-21 it did -- three times over.
 *
 * Measured in Chromium on a clean build, `.otp-error` and the very next paragraph,
 * `.otp-board__note`, on the asset whose whole argument is that you should check whether a system
 * is telling you the truth about itself:
 *
 *   1. a post the server took   "Posted to the board as brave-lantern-42."
 *                               "No runs on the board yet. Yours would be the first."
 *   2. a 409                    "That run is already on the board."
 *                               "No runs are showing yet. A run posted in the last minute may
 *                                not be here."
 *   3. a 400                    "That run could not be posted."
 *                               ...and the same hedge, explaining a delay for a post that never
 *                                happened, which implies one did.
 *
 * 1 was closed by the previous round. 2 and 3 are the same hedge read against two different
 * outcomes, and 3 is the one that proves the hedge was never the fix: a line that explains why
 * YOUR run is not showing cannot sit under a line saying your run did not go up.
 *
 * IT IS THE LAUNCH CASE, NOT A CORNER. `apps/api` serves GET /api/top with
 * `s-maxage=60, stale-while-revalidate=300`, and this screen re-reads the instant a post resolves.
 * On a board with nothing on it yet the mount read primes that cache with `{entries: []}`, the post
 * lands, and the re-read is answered from the cached empty for up to a minute. So the board really
 * did answer "empty" -- THE THREE-STATE READ IS NOT AT FAULT and is not touched here. What was
 * wrong is what the note was written to be ABOUT.
 *
 * WHAT THE NOTE ACTUALLY NEEDS TO KNOW. Not "did the post succeed" -- this screen cannot learn
 * that. `onPost` resolves to a SENTENCE, `src/net/leaderboard.ts` belongs to another owner this
 * round, and deciding success by matching that sentence is the coupling `submit()` refuses. What it
 * needs is weaker and it already has it: whether it is still entitled to claim the board holds
 * nothing. Before the press no post notice can exist (`attempted` goes true before `setNotice` can
 * run, and never goes back), so `boardEmpty` has nothing to contradict and keeps its invitation.
 * From the press onwards the note reports the READ and nothing else, which is true under every
 * outcome the post can have -- taken, refused, already there, or never answered.
 *
 * SET AT THE PRESS, STILL. That was argued for and it is kept: waiting for the reply leaves a
 * window, however many ticks wide, in which "Posted to the board as ..." paints above "Yours would
 * be the first", which is defect 1 coming back. The flag moving early is also why the note turns
 * over before the request lands -- and that is now a line that says what the read said, rather than
 * a hedge about a post nothing yet knows the fate of.
 *
 * Pure and exported so `test/board.test.ts` can drive a real HTTP reply through `readTop` and look
 * the answer up here, with no DOM -- the same composition `BOARD_NOTE` exists for.
 */
export const boardNoteKey = (state: BoardState['state'], attempted: boolean): string =>
  attempted && state === 'empty' ? 'boardEmptyAfterPost' : BOARD_NOTE[state];

/**
 * Which of several board reads is allowed to answer, and when none of them is.
 *
 * TWO DEFECTS, ONE MECHANISM, both reproduced in a real browser on 2026-10-21.
 *
 *  1. **Reads settled by ARRIVAL order, not ISSUE order.** Each call to `readBoard()` closed over
 *     its own private `live` flag and nothing invalidated the call before it, so a slow older
 *     answer overwrote a fast newer one: call 1 held open with ten rows, call 2 answered instantly
 *     with an empty board, and the board ended up showing the ten rows that were already stale when
 *     they arrived. On this screen that is not a flicker -- it is the board showing a state the
 *     server has already contradicted.
 *  2. **The disposer was thrown away on two of three call paths.** `submit()` called `readBoard()`
 *     bare and the retry was `onClick={readBoard}`, so the comment promising "no setState after
 *     unmount" was true for the mount path alone. `close()` is why that comment is true now: the
 *     guarantee belongs to the gate, which every read asks, rather than to a return value three
 *     callers have to remember to keep.
 *
 * A counter rather than an `AbortController`: the adapter already bounds itself at its own timeout
 * and promises never to throw, so there is no request to cancel -- only an answer to ignore.
 *
 * Pure, and exported for `test/board.test.ts`, which holds the ordering rule without a DOM.
 * apps/game's vitest runs on `node` and cannot render this component at all, so a rule left inside
 * it would be checkable only in Playwright.
 */
export interface BoardReads {
  /** Begins a read. Every read begun before this one is abandoned by the act of starting it. */
  begin(): number;
  /** True only for the newest read, and only while the screen is still open. */
  mayAnswer(ticket: number): boolean;
  /** Abandons one read without starting another. Newest or not, it may no longer answer. */
  abandon(ticket: number): void;
  /** The screen is gone. No read may answer again, whichever path started it. */
  close(): void;
}

export function boardReads(): BoardReads {
  let newest = 0;
  let open = true;
  return {
    begin: () => (newest += 1),
    mayAnswer: (ticket) => open && ticket === newest,
    // Moving the mark past this ticket, which no later `begin()` can hand out again.
    abandon: (ticket) => {
      if (ticket === newest) newest += 1;
    },
    close: () => {
      open = false;
    },
  };
}

export function Results({ content, state, onReplay, onReadResearch, onPost, onTop }: ResultsProps) {
  const s = (key: string): string => content.strings[key] ?? '';
  const result = score(state.log, content);
  const rows = recap(state.log, content);
  const fired = exposedNotices(state.log, content);

  /*
   * Results is the only long panel that skipped the project's own fix for this. `Dialogue`,
   * `SkillCard` and `Notice` all focus their body on mount; Results did not, so on arrival
   * `activeElement` was BODY -- and because `.otp-screen` is a `position: fixed` scroller, the
   * document itself has zero overflow, which left PageDown, End, Space and the arrows all no-ops
   * over a panel 1,680px long in an 860px viewport. The keyboard could reach the call to action by
   * tabbing and no other way (docs/UX_REVIEW.md 9).
   *
   * No focus trap here: Results is a whole screen, not a modal, and there is nothing behind it to
   * tab into. `preventScroll` because the body starts at the top of its own scroller and a focus
   * jump would be the player's first frame of the screen.
   */
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.focus({ preventScroll: true });
  }, []);

  /** The one sentence under an errand row, chosen by what actually happened to the capability. */
  const errandDetail = (errand: ErrandState, goal: GoalResult): string => {
    if (errand === 'traded') return s('errandTradedDetail');
    switch (errandMiss(goal, state.verdicts, content)) {
      case 'unused':
        return s('errandUnusedDetail');
      case 'flagged':
        return s('errandFlaggedDetail');
      default:
        return s('errandNeeded');
    }
  };

  /*
   * Minted once per mount, not once per render: `useState(newHandle)` passes the FUNCTION, so
   * Preact calls it for the initial state only. `useState(newHandle())` would mint a fresh name on
   * every render -- and this component re-renders on every post -- so the name under the player's
   * eyes would change between reading it and pressing the button.
   */
  const [handle, setHandle] = useState(newHandle);
  const [notice, setNotice] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [board, setBoard] = useState<BoardState>({ state: 'loading' });
  /*
   * Whether this visit has pressed Post. ATTEMPTED, never "posted": the old name claimed an
   * outcome this screen has no way to learn, and a name that asserts more than the code knows is
   * how a comment becomes the only place a fact lives. It only ever goes true, and it is what
   * `boardNoteKey` turns on -- see the long note over that function.
   */
  const [attempted, setAttempted] = useState(false);

  /*
   * One read on mount, and one more after any post attempt.
   *
   * Unconditional after a post, not "on success": `onPost` resolves to a SENTENCE, and deciding
   * success by matching that sentence would couple this screen to copy a human owns. A wasted read
   * of a same-origin, edge-cached GET costs nothing; misreading the copy costs the player their row.
   *
   * THE GATE, NOT A FLAG PER CALL. `boardReads()` above carries the whole argument: reads used to
   * settle by arrival order rather than issue order, and the disposer that was supposed to stop a
   * setState after unmount was dropped on two of the three call paths. Every read now asks the gate
   * before it writes, so "no read answers after this screen is gone" holds on all three -- the
   * mount effect, the retry button and `submit()` -- rather than on whoever remembered the return
   * value. The disposer is still returned, and it still means something: it abandons THIS read
   * without starting another.
   *
   * `useRef(boardReads())` evaluates the factory every render and keeps the first result, which is
   * the documented shape `useFocusTrap`'s `mountedAt` uses. The object it allocates and throws away
   * is two closures over two numbers.
   *
   * `DEFAULT_TOP_LIMIT` is imported, never written as `10`. A page size typed into a component is
   * the comment-instead-of-derivation trap in miniature: the number would then exist in two places
   * and only one of them is the one the server clamps against.
   */
  const reads = useRef(boardReads()).current;

  const readBoard = (): (() => void) => {
    const ticket = reads.begin();
    setBoard({ state: 'loading' });
    void (onTop ?? readTop)(DEFAULT_TOP_LIMIT).then((read) => {
      if (reads.mayAnswer(ticket)) setBoard(read);
    });
    return () => reads.abandon(ticket);
  };

  useEffect(() => {
    const abandon = readBoard();
    return () => {
      abandon();
      reads.close();
    };
  }, []);

  /** A different name, and the stale "Posted as ..." line cleared with it. */
  const reroll = (): void => {
    setHandle(newHandle());
    setNotice(null);
  };

  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    setNotice(null);
    setPosting(true);
    /*
     * Set AT THE PRESS, not after the reply, and that is the point rather than an optimisation.
     * `attempted` only chooses which of two true sentences the empty board shows, so there is no
     * reason to wait -- and waiting is what leaves a window, however many ticks wide, in which
     * "Posted to the board as ..." can be painted above "Yours would be the first". The defect
     * being closed is two sentences on one screen, so the flag moves before either can be.
     *
     * IT IS ALSO WHAT MAKES `boardEmpty`'S INVITATION SAFE. This line runs before `setNotice`
     * below can put anything in `.otp-error`, and nothing ever sets it back, so a render with a
     * post notice in it always has this flag true -- which is the whole proof that the one line
     * claiming the board holds nothing can never meet a notice at all.
     */
    setAttempted(true);
    setNotice(await onPost(handle));
    setPosting(false);
    void readBoard();
  };

  return (
    <div class="otp-screen">
      <div class="otp-screen__inner">
        {/*
          NO HEADER ASIDE. The mark used to sit here AND in the footer thirty lines down, so the
          payoff screen carried the Cyera wordmark twice -- two marks on the one screen whose job is
          to carry a single mark and a single Lime (UI_FOUNDATIONS section 8, which puts the mark in
          the footer under the sentence that names the research). The footer one is the one that
          means something, because it is attached to "The Off the Path research, by".
        */}
        <Panel number="05" title={s('resultsTitle')}>
          <div class="otp-screen__body" ref={body} tabIndex={-1} data-autofocus>
            <div class="otp-hero">
              <div>
                <p class="otp-section-label">{s('scoreLabel')}</p>
                {/* The score is the subject of this page, so it is the page's one h1. */}
                {/*
                  The explicit space is load-bearing: JSX drops whitespace that spans a line
                  break, so the number and the <small> ran together and the page's one h1
                  announced as "900out of 1,000" (docs/UX_REVIEW.md 21). It is a space, not copy.
                */}
                <h1 class="otp-hero__score">
                  {result.total.toLocaleString('en')} <small>{s('scoreOutOf')}</small>
                </h1>
                {/* Say where the points came from, in words, as the deck does. */}
                <p class="otp-hero__breakdown">{breakdown(result, content)}</p>
              </div>
            </div>

            {/* The boundary is the headline result, above the per-skill rows. */}
            <h2 class="otp-section-label">{s('trifectaLabel')}</h2>
            {/*
             * The three things a skill can be given, in the words the HUD discs are marked with.
             * This is the ONLY place `content.capabilities[*].detail` renders: it came off the
             * inspect card, where the client asked for three verbs and nothing else, and the
             * non-compact Trifecta that draws these sentences was mounted nowhere at all, so for
             * the whole project so far this lesson reached no one. It belongs here, beside the
             * discs it explains and directly under the heading that already names it.
             *
             * `hideLabel` because that heading IS the label -- the component draws its own
             * otherwise, and the first cut of this shipped "WHAT YOUR SKILLS CAN DO" twice, once
             * as the <h2> and again inside the component, two lines apart.
             */}
            <Trifecta
              content={content}
              live={liveCapabilities(state.verdicts, content)}
              hideLabel
            />
            <div
              class={`otp-recap__row otp-recap__row--boundary${result.boundaryHeld ? '' : ' otp-recap__row--missed'}`}
            >
              <Badge glyph={result.boundaryHeld ? 'check' : 'missed'} />
              <div class="otp-recap__body">
                {/*
                  Three states, not two. `boundaryHeld` is `!trifectaLive` and says nothing about
                  notices, so choosing between two strings on it alone asserted "a notice on a post
                  did the rest" for every run that let all three run -- including the runs where no
                  notice was ever read, which then rendered that claim above an empty explanation,
                  because the paragraphs below are a map over `fired`. An asset about checking what
                  systems really do cannot misreport the player's own run on the screen that carries
                  its argument (docs/UX_REVIEW.md blocker 1).
                */}
                <p class="otp-recap__heading">
                  {result.boundaryHeld
                    ? s('boundaryHeld')
                    : fired.length > 0
                      ? s('boundaryBroken')
                      : s('boundaryOpen')}{' '}
                  <span>{result.boundaryBonus > 0 ? `+${result.boundaryBonus}` : 'no bonus'}</span>
                </p>
                {fired.map((notice) => (
                  <p class="otp-recap__detail" key={notice.id}>
                    {notice.whenExposed?.recap}
                  </p>
                ))}
              </div>
            </div>

            <h2 class="otp-section-label">
              <Highlighted text={s('recapHeading')} word={s('recapHeadingHighlight')} />
            </h2>
            <ul class="otp-recap">
              {rows.map((row) => {
                const skill = skillState(row);
                return (
                  <li
                    key={row.skillId}
                    class={`otp-recap__row otp-recap__row--skill${skill === 'missed' ? ' otp-recap__row--missed' : ''}`}
                  >
                    <Badge
                      glyph={
                        skill === 'caught' ? 'check' : skill === 'costly' ? 'traded' : 'missed'
                      }
                    />
                    <div>
                      <p class="otp-recap__heading">
                        {row.skillName}{' '}
                        <span>you {s(VERDICT_WORD[row.verdict]).toLowerCase()} it</span>{' '}
                        {/* Status in words, never by glyph or colour alone. */}
                        <span class="otp-recap__status">
                          {skill === 'caught'
                            ? s('caughtIt')
                            : skill === 'costly'
                              ? s('nothingTaken')
                              : s('missedIt')}
                        </span>
                      </p>
                      {/*
                        The payoff for a gamble that did not come off, and the only place the game
                        says anything about it. The fine print below is shown either way, so a
                        player who never opened the card reads here what was in it.
                      */}
                      {row.onTrust && <p class="otp-recap__trust">{s('cardNotOpened')}</p>}
                      <p class="otp-recap__detail">{row.recap}</p>
                      {/*
                        The section is headed "What was hiding" and never showed it: outcomes.ts
                        computes hiddenAction for every row and this screen discarded it. The fine
                        print is the one piece of text the whole game teaches you to find.
                      */}
                      {row.hiddenAction && (
                        <p class="otp-recap__hidden">
                          <span class="otp-recap__hidden-title">{row.hiddenAction.title}</span>
                          {row.hiddenAction.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/*
              One row per goal rather than a single errand verdict. A careful run carries out one
              of the three on purpose -- the other two need capabilities it refused -- so a lone
              "errand failed" line read as a mistake when it was the trade the game is about.
            */}
            <p class="otp-section-label">{s('errandHeading')}</p>
            {result.goals.map((goal) => {
              const errand = errandState(goal, state.verdicts, content);
              return (
                <div
                  key={goal.id}
                  class={`otp-recap__row otp-recap__row--errand${errand === 'missed' ? ' otp-recap__row--missed' : ''}`}
                >
                  {/*
                    A goal forgone to keep the boundary takes the Restrict glyph from the verdict
                    pills -- the one mark in this product's vocabulary that means "withheld on
                    purpose" -- on the Natural ground, not Haze. The "!" disc stays for a goal
                    genuinely dropped.
                  */}
                  <Badge
                    glyph={errand === 'met' ? 'check' : errand === 'traded' ? 'traded' : 'missed'}
                  />
                  <div>
                    <p class="otp-recap__heading">
                      {goal.label}{' '}
                      <span>
                        {errand === 'met'
                          ? `+${goal.points}`
                          : errand === 'traded'
                            ? s('errandTraded')
                            : 'not met'}
                      </span>
                    </p>
                    {/*
                      On its own line, and as a sentence. Gluing "needed" to a capability label built
                      "Find the cottage before dark needed reaches into your basket" -- a run-on at
                      every width, because the labels are verb phrases ("Reaches into your basket").
                    */}
                    {errand !== 'met' && (
                      <p class="otp-recap__detail">
                        {errandDetail(errand, goal)}{' '}
                        {content.capabilities[goal.needs]?.label.toLowerCase() ?? goal.needs}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* The Basket component carries its own label. */}
            <Basket basket={state.basket} items={content.items} />

            {/*
              The screen's one Lime lives on this button, and it comes before the score form.
              "Who wrote the instructions your agent follows?" is the sentence this whole asset
              exists to ask, and it sat below a form that cannot work until the Phase 6 API exists
              and says so when you press it -- 1,412px down a panel in an 860px viewport, past the
              only dead control on the screen. Band first, so the first thing the keyboard reaches
              and the first thing a scroll finds is the question (docs/UX_REVIEW.md 9).
            */}
            <div class="otp-band">
              <p class="otp-band__question">
                <Highlighted text={s('ctaPrompt')} word="agent" />
              </p>
              {/*
                AN <a> WITH AN href, NOT A <button> WITH A HANDLER. This is the asset's single
                conversion action and it did nothing in any build this repo could produce: the
                handler behind it is `() => emit('otp:cta', {})`, and `emit` returned early whenever
                the embed origin was unset -- which was every build, because `VITE_EMBED_ORIGIN` had
                exactly one occurrence repo-wide and that occurrence was the line that read it.

                So the destination is the element's own href now, resolved once in
                `src/embed/postMessage.ts` from `VITE_RESEARCH_URL` with a default written down
                beside it. That makes the press work standalone, work with no .env file at all, and
                work for a middle-click or a "copy link address" -- none of which a click handler
                can do. `onReadResearch` stays exactly as it was, as the side channel: the parent
                page still gets `otp:cta` when it is listening, and the navigation no longer depends
                on it.

                `target="_blank"` because embedded this would otherwise navigate the iframe and take
                the game off the page with it; `rel="noopener noreferrer"` because nothing here needs
                a handle on the opener, and the project ships no analytics that wants the referrer.
              */}
              {/*
                `.otp-cta` was written for a <button>, so it set no `text-decoration`, and the
                user-agent default underlines an <a> whatever its specificity -- an underlined Lime
                pill is a brand break a screenshot review would catch. That lived here as an inline
                style for one round, because `screens.css` had a different owner and two owners
                never share a file. It is in `.otp-cta` now, where the brand rules can reach it.
              */}
              <a
                class="otp-cta"
                href={RESEARCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onReadResearch}
              >
                {s('cta')}
                <span class="otp-cta__disc" aria-hidden="true">
                  →
                </span>
              </a>
            </div>

            <p class="otp-section-label">{s('postHeading')}</p>
            {/*
              THE NAME IS SHOWN, NOT TYPED, and this is the half of decision D4 that was missing.

              The board has minted its own handles since Phase 6: `submit()` in
              src/net/leaderboard.ts sends `mintHandle()` and discards whatever string it was
              handed, because a free-text name on a Cyera-branded public page is a moderation
              problem and a player-supplied string is one more thing to sanitise on the way to a
              table. The screen did not know that. A player typed `wolfspotter`, pressed Post, and
              was told "Posted to the board as deft-cloak-81" -- the field had taken their input and
              the product had quietly thrown it away. Two things were true at once and only one of
              them was on the screen.

              So the input is gone and the minted handle is the control: it is rendered as text,
              it is what `onPost` receives, and the reroll button mints another. There is nothing
              left to validate -- every one of the 3,072 handles `mintHandle` can produce is legal
              by construction, which `test/leaderboard.test.ts` checks against `validateHandle`
              directly -- so the error row goes with the input it belonged to. `validateHandle`
              stays exported as the mirror of the server's rule; it is the thing that test holds
              the wordlists against, and it is what a future typed name would have to pass.

              `role="group"` rather than `<output>`: `<output>` carries an implicit `role="status"`,
              and the post notice twenty lines down is the one status on this screen.
            */}
            <form class="otp-post" onSubmit={submit} noValidate>
              <span
                class="otp-handle"
                role="group"
                aria-label={s('handleLabel')}
                aria-describedby="otp-handle-hint"
              >
                <span data-handle={handle}>{handle}</span>
              </span>
              <button
                type="button"
                class="otp-button otp-button--quiet"
                onClick={reroll}
                disabled={posting}
              >
                {s('handleReroll')}
              </button>
              <button type="submit" class="otp-button" disabled={posting}>
                {s('post')}
              </button>
            </form>
            <p class="otp-fine" id="otp-handle-hint">
              {s('handleHint')} {s('privacyLine')}
            </p>
            {notice && (
              <p class="otp-error" role="status">
                {notice}
              </p>
            )}

            {/*
              06 Leaderboard, mounted where a run actually ends. docs/UI_FOUNDATIONS.md section 8
              draws this as its own screen; `phase: 'leaderboard'` exists in the reducer and is
              one-way -- LEADERBOARD only from results, no action back, RESET the only exit -- so a
              link to it would discard the recap, the trifecta and the Lime band to show ten rows.
              It lives here until that branch and its core test can be written.

              THE DEFECT THIS CLOSES: the post form is the only thing on the page that mentions a
              board, and "Posted to the board as deft-cloak-81" has had no board under it since
              Phase 6 shipped. `top()` was written, tested, and called by nothing.

              NO LIME. This screen spends its one on `.otp-cta` above (UI_FOUNDATIONS section 2),
              and a board that tinted its top row Lime would be a second call to action on a page
              that already has a hierarchy problem.
            */}
            <section class="otp-board" aria-labelledby="otp-board-heading">
              {/*
                THE HEADING IS INSIDE THE SECTION, and it was outside until 2026-10-21.

                Measured on the built preview at 375, 768 and 1280: the gap above this heading was
                0.0px at every one of the three reviewed widths. `h2.otp-section-label` zeroes the
                24px top margin `.otp-section-label` carries (it has to -- it is undoing the UA's h2
                margins), and `.otp-fine` and `.otp-error`, the two paragraphs that can precede the
                board, both end with `margin-bottom: 0`. So the only separation in play was
                `.otp-board`'s own `margin-top`, and with the heading OUTSIDE the section that margin
                landed between the heading and the board instead of above the heading: the title sat
                flush against the privacy line, and the air it should have had was spent inside its
                own section.

                Moving it in puts the board's margin and padding above the heading, where they were
                always meant to be, and makes the `aria-labelledby` relationship structural as well
                as declared. `e2e/leaderboard.spec.ts` measures the gap at the three widths now --
                nothing in the suite measured vertical rhythm at all, which is how 0px at every
                reviewed width shipped past a width review.
              */}
              <h2 class="otp-section-label otp-board__title" id="otp-board-heading">
                {/*
                  Season Mix on "Spotters", which UI_FOUNDATIONS section 8 and BRAND_AND_UI
                  section 3 both name outright -- BRAND_AND_UI uses this exact title as its worked
                  example of a correct highlight. It is the screen's third Season Mix word, after
                  "actually" in the recap heading and "agent" in the CTA band; the brand rule is one
                  per HEADING and there is no per-screen cap on it (that rule is Lime's). The
                  tension is real and is in the handover for the human to settle.
                */}
                <Highlighted text={s('leaderboardTitle')} word={s('leaderboardTitleHighlight')} />
              </h2>
              {/*
                MOUNTED IN EVERY STATE, text swapped, never conditionally rendered. App.tsx records
                why over the world announcements: a live region inserted into the DOM already
                holding its text announces nothing, because screen readers announce MUTATIONS to a
                region that was already there. The naive `{loading && <p …>}` announces nothing at
                all. This is also the deck's subtitle slot, so one element carries both jobs and
                they cannot drift apart.

                `aria-live` WITHOUT `role="status"`, which is the one place this markup departs from
                the build spec. The behaviour is the same -- `role="status"` is a polite, atomic
                live region and this says so directly -- but the role would put a SECOND status on
                Results, and `e2e/game.spec.ts:204` and four tests in `e2e/leaderboard.spec.ts`
                resolve the post notice with `getByRole('status')`. A second one turns every one of
                them into a strict-mode violation, and `game.spec.ts` belongs to another owner.
                The post notice keeps the role; the board speaks through aria-live.
              */}
              <p
                class="otp-board__note"
                data-board={board.state}
                aria-live="polite"
                aria-atomic="true"
              >
                {s(boardNoteKey(board.state, attempted))}
              </p>

              {board.state === 'rows' && (
                <ol class="otp-board__rows">
                  {board.entries.map((entry) => {
                    /*
                     * Your row is matched LOCALLY, against the name already in state above.
                     * Nothing extra goes over the wire to find it, and the board still stores a
                     * handle and a score only -- which is what `privacyLine` on this same screen
                     * promises eight lines up.
                     */
                    const yours = entry.handle === handle;
                    const say = (yours ? s('boardRowYou') : s('boardRow'))
                      .replace('{rank}', String(entry.rank))
                      .replace('{handle}', entry.handle)
                      .replace('{score}', entry.score.toLocaleString('en'));
                    return (
                      <li
                        key={`${entry.rank}-${entry.handle}`}
                        class={`otp-board__row${yours ? ' otp-board__row--you' : ''}`}
                      >
                        {/*
                          The visible row is one composed line to a screen reader and three columns
                          to an eye, so the eye's version is hidden from AT and the sentence below
                          is what is read. Same split App.tsx uses for the world announcements, and
                          for the same reason: "3 merry-kettle-73 450" is not a sentence.
                        */}
                        <span class="otp-board__visible" aria-hidden="true">
                          {/*
                            `data-rank` rather than a class per rank or a style prop.
                            test/inline-style.test.ts bans a static `style={{ background }}`, and an
                            attribute selector keeps the four tints in the stylesheet where a brand
                            reviewer reads them. Same shape as the `data-glyph` on the recap badge.
                          */}
                          <span
                            class="otp-board__rank"
                            data-rank={entry.rank < 4 ? entry.rank : 'plain'}
                          >
                            {entry.rank}
                          </span>
                          <span class="otp-board__handle">{entry.handle}</span>
                          {/* Status in words, never by fill alone (UI_FOUNDATIONS section 5). */}
                          {yours && <span class="otp-board__you">{s('boardYouLabel')}</span>}
                          <span class="otp-board__score">{entry.score.toLocaleString('en')}</span>
                        </span>
                        <span class="otp-visually-hidden">{say}</span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {board.state === 'unavailable' && (
                <div class="otp-board__retry">
                  {/*
                    `() => void readBoard()` rather than `onClick={readBoard}`. Two things were
                    wrong with the bare form: it handed the click event to a function that takes no
                    arguments, and it threw away the disposer `readBoard` returns -- which is half
                    of the defect `boardReads()` documents. The gate makes the unmount guarantee
                    hold either way; this makes the call site say what it is doing.
                  */}
                  <button
                    type="button"
                    class="otp-button otp-button--on-dark"
                    onClick={() => void readBoard()}
                  >
                    {s('boardRetry')}
                  </button>
                </div>
              )}
            </section>

            {/*
              TWO CONTROLS THAT DO COMPLETELY DIFFERENT THINGS MUST NOT LOOK THE SAME.

              With /api/top still 404ing in production, `unavailable` is the state every visitor
              sees, and in it "Ask the board again" and "Walk it again" rendered with the SAME class
              string, the same height and the same Deep Purple outline on no fill, 15.4px apart. One
              re-reads a list; the other throws the finished run away and restarts the game. A
              player reaching for the first and hitting the second loses the score they are looking
              at.

              They are now different in kind, not in shade. The retry is a pill INSIDE the board's
              own Deep Purple body, outlined in Offwhite, sitting with the thing it acts on. This is
              an underlined text action on the Shell panel below, which is what UI_FOUNDATIONS
              section 8 draws for `Play again` in the first place -- "a footer link", not a pill.
              Lime is spent on the research call to action and is not available to either of them.

              Still a <button>: it does something to this page rather than going anywhere, and four
              specs in another owner's files reach it by `getByRole('button', { name: /Walk it
              again/ })`.
            */}
            <div class="otp-actions">
              <button type="button" class="otp-link-action" onClick={onReplay}>
                {s('replay')}
              </button>
            </div>

            {/*
              docs/UI_FOUNDATIONS.md section 8 puts this footer under 06 Leaderboard, whose rows
              are Black -- hence "white Cyera logo" there. That screen does not exist yet, and
              Results is where a run actually ends, so it lives here for now. Results' body is
              Shell, so the mark is the black one: a white mark would be invisible on it.
            */}
            <p class="otp-foot">
              {s('researchFooter')}
              <CyeraMark on="light" />
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
