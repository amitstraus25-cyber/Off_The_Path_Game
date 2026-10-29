import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_TOP_LIMIT, v2 } from '@otp/core';
import { RESEARCH_URL, researchHref } from '../embed/postMessage';
import { variants } from '../ab';
import { readBoard as readTheBoard } from '../net/leaderboard';
import type { BoardRead, PostOutcome } from '../net/leaderboard';
import { CyeraMark, Highlighted, NotationChip, Panel } from './components';
import { fill, strings } from './copy';
import { iconUrl, initials } from './Hud';

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

/**
 * The reveal's mark: a drawn check for a skill dealt safe, Haffer's own "!" for one dealt unsafe.
 * A SHAPE, beside a WORD (`Safe` / `Unsafe`), on a ground -- never a colour alone, and no red or
 * green anywhere (UI_FOUNDATIONS section 5). `data-glyph` is what the specs read.
 */
function Badge({ glyph }: { glyph: 'check' | 'missed' | 'past' }) {
  return (
    <span class="otp-recap__badge" data-glyph={glyph} aria-hidden="true">
      {glyph === 'check' ? <CheckGlyph /> : glyph === 'missed' ? '!' : '\u2013'}
    </span>
  );
}

/**
 * THE PLAYER'S CALL ON ONE OFFER (the client's review, 2026-10-25, P9). Four words, not two:
 *
 *   caught  a bad skill read and kept out of the basket          "Caught it"
 *   right   a good skill taken                                  "Right call"
 *   missed  a wrong choice: a bad skill taken, a good one left  "Missed it"
 *   past    never answered (walked past, or never met at all)   "Walked past"
 *
 * A bad card that was opened and walked away from stays "caught": it was read and it stayed out,
 * which is the whole skill. The two-word version said "Caught it" on a good skill taken (nothing
 * was caught) and "Missed it" on a bad one never met, right under "you kept every bad skill out".
 */
export type TileCall = 'caught' | 'right' | 'missed' | 'past';
export function tileCall(row: Pick<v2.RevealEntry, 'good' | 'verdict' | 'read'>): TileCall {
  if (row.verdict === 'take') return row.good ? 'right' : 'missed';
  if (row.verdict === 'leave') return row.good ? 'missed' : 'caught';
  return !row.good && row.read ? 'caught' : 'past';
}

const CALL_WORD = {
  caught: 'revealCaught',
  right: 'revealRight',
  missed: 'revealMissed',
  past: 'revealPast',
} as const satisfies Record<TileCall, v2.ChromeKey>;

/**
 * The skill's own picture on its reveal row, so the row is the thing the player was handed and not
 * only its name. 64 CSS px, the art's own size (PIXEL_STANDARD section 1: items are DOM, unscaled),
 * so every painted pixel lands whole; the card shows the same picture at 2x. Named by the skill, as
 * asked; a picture that is missing from the bundle wears the same labelled placeholder the card
 * and the basket do (CLAUDE.md rule 5).
 */
/*
 * INSIDE THE TILE'S BUTTON THE PICTURE SAYS NOTHING (`alt=""`): the skill's name is the next thing
 * in the button, and a picture named by the skill would make every tile's accessible name say it
 * twice ("Cottage Finder Cottage Finder, Unsafe, You took"). It is still the skill's own picture
 * at the art's own 64px, so every painted pixel lands whole (PIXEL_STANDARD section 1); a picture
 * missing from the bundle wears the same labelled placeholder the card and the basket do
 * (CLAUDE.md rule 5).
 */
function RevealIcon({ skill }: { skill: v2.Skill }) {
  const url = iconUrl(skill.icon);
  return url ? (
    <img class="otp-reveal__icon" src={url} alt="" width={64} height={64} />
  ) : (
    <span class="otp-reveal__icon otp-icon-placeholder" aria-hidden="true">
      {initials(skill.name)}
    </span>
  );
}

/*
 * THE NAME IS TYPED NOW (the client, 2026-10-22: "I want people to put their own name"), which
 * reverses decision D4. The rule is the board's and lives in ONE pure function both ends call,
 * `v2.checkName` (packages/core/src/v2/board.ts): the server refuses what it refuses and stores the
 * tidied form it returns, and this screen asks it first only so a player is told what to change in
 * plain words rather than meeting a bare refusal. Nothing here is stricter or looser than the
 * server, because nothing here is a rule of its own.
 *
 * The field starts EMPTY and nothing on this screen suggests a name (the client, 2026-10-25: "I
 * don't need you to suggest a name... let people enter their own name"): no pre-filled handle and
 * no Suggest a name button. An empty press is refused like any other short name, in words.
 */

/** What is wrong with a typed name, as the chrome key of the sentence that says so. */
export type HandleProblem =
  'handleShort' | 'handleLong' | 'handleChars' | 'handleContact' | 'handleBlocked';

/** One sentence per reason the board can refuse a name. Total, so a sixth reason fails typecheck. */
export const HANDLE_PROBLEM: Record<v2.NameRefusal, HandleProblem> = {
  short: 'handleShort',
  long: 'handleLong',
  characters: 'handleChars',
  contact: 'handleContact',
  blocked: 'handleBlocked',
};

/** The board's answer for a typed name: the tidied name to post, or the sentence key to show. */
export function readName(raw: string): { name: string } | { problem: HandleProblem } {
  const check = v2.checkName(raw);
  return check.ok ? { name: check.name } : { problem: HANDLE_PROBLEM[check.reason] };
}

/** The friendly sentence for what is wrong with a name, or null when it may be posted. */
export function validateHandle(raw: string): string | null {
  const read = readName(raw);
  return 'name' in read ? null : (strings[read.problem] ?? read.problem);
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
 * The vocabulary is deliberately only what the three nodes can disagree ABOUT: what the board
 * holds, what it is showing, and what became of the reader's own run. A claim with no `EXCLUSIVE`
 * entry is inert by design and is still named, because "this line asserts nothing that can
 * collide" is the thing that makes it the safe line to show -- and a line with no declaration at
 * all would be indistinguishable from a line nobody has thought about.
 *
 * THERE WERE TWO NODES HERE AND THE SECTION HAS THREE. That is the 2026-10-21 finding and it is
 * worth keeping as written rather than smoothing over: three rounds went into `.otp-error` and
 * `.otp-board__note`, the 25-pair enumeration behind them is real, and `.otp-board__row--you` sat
 * one node outside the whole model saying "This is your run." in the same section. Reproduced in
 * Chromium against a clean build, three ways:
 *
 *   a 400                  "That run could not be posted."
 *                          "Rank 2. noble-acorn-93, 900 points. This is your run."
 *   a reply that times out "The board was unavailable for that post."   (the old wording)
 *                          "Rank 2. tidy-bellows-34, 900 points. This is your run."
 *   a 2xx the schema       the same, via `submitResponseSchema` rejecting the body
 *   rejects
 *
 * So the row is a declaring node now, with `ROW_CLAIMS` beside the other two, and the enumeration
 * in `test/board.test.ts` walks all three. The lesson the model-with-two-nodes taught is the one
 * to carry: a node that carries a claim and is not in the structure is not safe, it is unwatched.
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
  // v2's 410: the run was real and its posting window shut, so it did not go up.
  leaderboardClosed: ['readerRunDidNotGoUp'],
};

/**
 * Every sentence a row in `.otp-board__rows` can carry, by content key, and what it asserts.
 *
 * THE THIRD NODE. Both keys claim the board holds runs, because a row cannot render unless it
 * does; `boardRowYou` additionally claims the run is the reader's, which is the claim that put
 * "This is your run." above a notice saying the post failed.
 *
 * The absent state is a row that is not the reader's AND a board with no rows at all, and neither
 * is a key. Since 2026-10-22 a reader whose post the server counted at rank 400 sees the top ten,
 * a gap, and their own row at 400 (`withYourRow` case 0); a reader whose rank was never counted
 * still sees ten unmarked rows, and an unmarked board asserts nothing whatever about where their
 * run is. Under-claiming is the safe direction and this node is deliberately built to fail that way.
 */
export const ROW_CLAIMS: Record<string, readonly Claim[]> = {
  boardRow: ['boardHoldsRuns'],
  boardRowYou: ['boardHoldsRuns', 'readerRunIsOnBoard'],
};

/** Every exclusive pair both of these carry at once, named. Empty means the two may sit together. */
export const contradictions = (a: readonly Claim[], b: readonly Claim[]): string[] =>
  EXCLUSIVE.filter(
    ([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  ).map(([x, y]) => `${x} / ${y}`);

/**
 * Every claim that can collide with something, derived from `EXCLUSIVE` rather than listed.
 *
 * Not the whole vocabulary: `boardShowsNoRuns` and `postNotAnswered` are inert by design and are
 * deliberately absent, because a set used to mean "assume the worst" wants exactly the claims
 * that can contradict. A new exclusive pair joins it without anybody editing this line.
 */
const EVERY_COLLIDING_CLAIM: readonly Claim[] = [...new Set(EXCLUSIVE.flat())];

/**
 * What the notice currently on screen asserts. `null` is the absent notice, which asserts nothing.
 *
 * AN UNDECLARED KEY ASSERTS EVERYTHING, which is the opposite of what reads naturally and is the
 * point. A fifth outcome added to `src/net/leaderboard.ts` and not declared above would otherwise
 * be inert here -- it would collide with nothing, `boardRowKey` would mark the row, and the
 * forgotten node would be the one that ships the lie. Treated as asserting everything it collides
 * with everything, so the screen stops claiming rather than starts guessing. `test/board.test.ts`
 * is what stops it getting that far; this is what happens if it ever does.
 */
export const noticeClaims = (key: string | null): readonly Claim[] =>
  key === null ? [] : (NOTICE_CLAIMS[key] ?? EVERY_COLLIDING_CLAIM);

/**
 * Which sentence one board row carries -- and the two conditions it has to meet to claim the
 * reader's own run. The same shape as `boardNoteKey`, pure and exported for the same reason.
 *
 * `mine` is the local handle match and it is NECESSARY, NOT SUFFICIENT. Two things gate it:
 *
 *  1. **`attempted`.** Before the press this page has posted nothing, so a row under the name it
 *     is showing is necessarily SOMEBODY ELSE'S -- the mint has 3,072 names and the board shows
 *     ten of them, so roughly one visitor in three hundred would have been told a stranger's run
 *     was theirs before touching the button. `e2e/leaderboard.spec.ts` asserted that marking as
 *     correct behaviour until 2026-10-21, which is how it survived: the fixture was built by
 *     reading the page's own handle, so the collision the test staged looked like a match.
 *
 *  2. **The notice does not deny it.** This is the pairing property, enforced where the claim is
 *     made rather than only asserted in a test. A 400 answers `leaderboardRefused`, which claims
 *     `readerRunDidNotGoUp`; that collides with `readerRunIsOnBoard`, so the row drops back to
 *     the plain sentence and the section says only what it can support -- the board is showing a
 *     run under this name, and the post was refused. Both true, neither denying the other.
 *
 * IT IS CHECKED, NOT LISTED. The condition is `contradictions(...)` over the declared claims, so
 * a fifth notice, a sixth claim or a new exclusive pair changes what this function does without
 * anybody editing it. A hand-written `noticeKey !== 'leaderboardRefused'` would have been the
 * special case the round was told not to write.
 *
 * WHAT IT STILL CANNOT DO. A handle collision AFTER a post the server took is indistinguishable
 * here from the reader's own row: both are "a row carrying the name this page posted", and the
 * difference lives on the server. Closing that needs `POST /api/score` to answer with the rank it
 * wrote, or `GET /api/top` to mark it. Recorded in docs/PAUL_BRIEF.md section 7 rather than
 * papered over.
 */
export const boardRowKey = (mine: boolean, attempted: boolean, noticeKey: string | null): string =>
  mine &&
  attempted &&
  contradictions(ROW_CLAIMS['boardRowYou']!, noticeClaims(noticeKey)).length === 0
    ? 'boardRowYou'
    : 'boardRow';

/**
 * How many of the run's bad skills the player SPOTTED: opened the card, and kept it out of the
 * basket. Walking past a card without meeting its owner is not spotting it, so a run that went
 * straight to the door is told it spotted none (the reveal's `read` is core's, from the log).
 */
export const spottedOf = (entries: readonly v2.RevealEntry[]): number =>
  entries.filter((row) => !row.good && row.read && row.verdict !== 'take').length;

/**
 * How many of the run's bad skills stayed OUT OF THE BASKET, read or not: the replay line's count
 * ("You kept N of 4 bad skills out of your basket"). Until 2026-10-22 that line counted
 * `spottedOf`, so a run that walked past all four bad cards to a 100 was told it spotted 0 -- true
 * about reading, and read by everyone as a verdict on the run. The basket is what the score and the
 * ending turn on, so the line counts the basket; the tiles keep `spottedOf` for Caught / Missed.
 */
export const keptOutOf = (entries: readonly v2.RevealEntry[]): number =>
  entries.filter((row) => !row.good && row.verdict !== 'take').length;

/** Elapsed time as the clock face writes it, m:ss, whole seconds down. */
export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

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

/** A chrome string by key. Never undefined on the payoff screen: a missing key renders nothing. */
const s = (key: string): string => strings[key] ?? '';

export interface ResultsProps {
  content: v2.Content;
  /** What the run came to: the score, its parts, the ending and the reveal, from core (rule 6). */
  run: v2.RunResult;
  onReplay(): void;
  onReadResearch(event: MouseEvent): void;
  /**
   * Why this run cannot be posted, or null when it can. A run the server did not start has no
   * token, and a late run is refused by rule (apps/api): both are said, never a dead button.
   */
  cannotPost: string | null;
  /**
   * Posts the run under a name and answers the sentence to show AND which one it is. A name and
   * nothing else: the work email came out on 2026-10-29 (the client: "no need for work email").
   */
  onPost(handle: string): Promise<PostOutcome>;
  /** Reads the board. Optional: the default is the adapter itself; specs and tests inject. */
  onTop?(limit: number): Promise<BoardRead>;
}

/**
 * One offer on the reveal, as a card the player turns over.
 *
 * THE FACE leads with whether the player's call was right: "Caught it" on Natural with a drawn
 * check, or "Missed it" on Haze with the Deep Purple bar and a "!" -- UI_FOUNDATIONS section 5's two
 * recap rows, a shape and a word and never a colour alone. Under it, smaller, what the skill really
 * was (Safe / Unsafe) and what the player did ("You took / You left / You walked past"). Until the
 * full review of 2026-10-22 the styling followed Safe/Unsafe, so a perfect run wore the "Missed
 * it" treatment on all four of its correctly left cards.
 *
 * THE BACK is why: for a bad skill the card as it was dealt with the one line that gave it away
 * marked, what it promised against what it did (or would have done -- a skill left behind never
 * ran), and the one-line "In the real world".
 *
 * AN ACCESSIBLE DISCLOSURE, not a picture of a card. The face is a real `<button>` carrying
 * `aria-expanded` and `aria-controls`, so Enter and Space turn it, a screen reader hears "collapsed"
 * and "expanded", and the back is ordinary text in the reading order the moment it is shown. The
 * turn itself is a CSS animation on `[data-open='true']` (screens.css), and under
 * `prefers-reduced-motion` it does not move at all: the back simply appears.
 */
function RevealTile({
  row,
  skill,
  words,
  autoOpen = false,
}: {
  row: v2.RevealEntry;
  skill: v2.Skill;
  words: v2.Content['ui']['reveal'];
  /** Turned over from the start: the first bad skill caught on a clean run (P8). */
  autoOpen?: boolean;
}) {
  /*
   * THE PLAYER'S CALL, which is what the face leads with (a reward, not a report): a good skill was
   * caught by taking it, a bad one by opening its card and keeping it out of the basket
   * (`spottedOf`). The replay line above counts something else ON PURPOSE: what stayed out of the
   * basket (`keptOutOf`), read or not. The tiles count what you read; the line counts what you
   * carried. The two can differ -- a bad card walked past is kept out and not caught -- and both are
   * true. Safe/Unsafe and what the player did stay on the face as the smaller line under it.
   */
  const call = tileCall(row);
  /*
   * A BAD SKILL THE PLAYER TOOK IS TURNED OVER ALREADY. After "That's not Grandma" and a zero, the
   * card that let the wolf in is the one the player most needs to read, so it is not left face down
   * among six others for them to guess at.
   */
  const [open, setOpen] = useState((!row.good && row.verdict === 'take') || autoOpen);
  // The safe tile's other half: what its unsafe copy said (P10). Null for a bad tile, which shows
  // its own card with the line marked.
  const unsafeSaid = row.good ? v2.giveaway(skill) : null;
  const back = `otp-tile-back-${row.skillId}`;
  /*
   * TURNING A CARD MOVES IT, so it is brought back into view. An open card spans the whole row and
   * the list reflows to one column while any card is open (screens.css), which is what keeps the
   * grid free of holes -- and which can carry the card the player just pressed a row or two down.
   * `nearest` scrolls only if it has to, and instantly under reduced motion.
   */
  const tile = useRef<HTMLLIElement>(null);
  const turned = useRef(false);
  useEffect(() => {
    if (!turned.current) return;
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    tile.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [open]);
  const chose =
    row.verdict === 'take' ? words.took : row.verdict === 'leave' ? words.left : words.unanswered;
  return (
    <li
      ref={tile}
      class={`otp-tile${call === 'missed' ? ' otp-tile--missed' : call === 'past' ? ' otp-tile--past' : ''}`}
      data-reveal={row.skillId}
      data-kind={row.good ? 'good' : 'bad'}
      data-call={call}
      data-verdict={row.verdict ?? 'none'}
      data-open={open ? 'true' : 'false'}
    >
      {/*
        THE NAME, PUNCTUATED (Paul's round, 2026-10-22). Read from its spans the face's name ran its
        words together -- "SafeYou took", "UnsafeYou walked past" -- because the " · " a sighted
        reader sees is aria-hidden and nothing else stands between them. Hidden ", " spans were
        tried first: Chromium sets them off with spaces of their own ("Unsafe , You left"). So the
        name is the face's own words, in their order, with commas between: "Wood Map, Caught it,
        Safe, You took, See why". Nothing on screen changes, and every word on the face is in it.
      */}
      <button
        type="button"
        class="otp-tile__face"
        aria-label={[
          row.name,
          s(CALL_WORD[call]),
          row.good ? words.good : words.bad,
          chose,
          s(open ? 'revealFlipBack' : 'revealFlip'),
        ].join(', ')}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={back}
        onClick={() => {
          turned.current = true;
          setOpen((was) => !was);
        }}
      >
        <RevealIcon skill={skill} />
        <span class="otp-tile__text">
          <span class="otp-tile__name">{row.name}</span>
          <span class="otp-tile__mark">
            <Badge glyph={call === 'missed' ? 'missed' : call === 'past' ? 'past' : 'check'} />
            <span class="otp-tile__call">{s(CALL_WORD[call])}</span>
          </span>
          <span class="otp-tile__what">
            <span class="otp-recap__status">{row.good ? words.good : words.bad}</span>
            <span aria-hidden="true"> · </span>
            <span class="otp-reveal__chose">{chose}</span>
          </span>
        </span>
        <span class="otp-tile__flip">{s(open ? 'revealFlipBack' : 'revealFlip')}</span>
      </button>
      <div class="otp-tile__back" id={back} hidden={!open}>
        {row.giveaway !== null && (
          /*
           * The bad card as the player was shown it, with the one line that gave it away marked:
           * the lesson is that the line was ON the card, among lines that read just like it.
           * `<mark>` is the element for "this is the part that matters here", and it carries a
           * shape (the "!") and a word (the title above it) as well as the Haze ground.
           */
          <div class="otp-recap__hidden" data-giveaway="">
            <span class="otp-recap__hidden-title">{words.giveaway}</span>
            <ul class="otp-reveal__card">
              {skill.bad.card.take.map((line) =>
                line === row.giveaway ? (
                  <li key={line} class="otp-reveal__line" data-giveaway-line="">
                    {/* The "!" is drawn by CSS, so the line's text is the line. */}
                    <mark class="otp-reveal__mark">{line}</mark>
                  </li>
                ) : (
                  <li key={line} class="otp-reveal__line">
                    {line}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        {/*
          Each label ABOVE its words, in its own group (a `div` is a valid child of a `dl`), so the
          pair is a short eyebrow and a full-width line rather than a label column that left the
          line four words wide (the client's screenshot, 2026-10-22). Side by side where the card
          is wide enough for two readable columns: the promise beside what it did.
        */}
        {unsafeSaid !== null && (
          /*
           * A SAFE TILE TEACHES ITS UNSAFE TWIN TOO (P10): a deal shows each skill in one variant
           * only, so without this a run taught four of the seven giveaways. The line is the one
           * the bad card swaps in, marked as the bad tile marks it.
           */
          <div class="otp-recap__hidden" data-unsafe-said="">
            <span class="otp-recap__hidden-title">{s('revealUnsafeSaid')}</span>
            <ul class="otp-reveal__card">
              <li class="otp-reveal__line" data-unsafe-line="">
                <mark class="otp-reveal__mark">{unsafeSaid}</mark>
              </li>
            </ul>
          </div>
        )}
        <dl class="otp-reveal__pairs">
          <div class="otp-reveal__pair">
            <dt>{words.promised}</dt>
            <dd>{row.promise}</dd>
          </div>
          <div class="otp-reveal__pair">
            <dt data-reveal-label="">{row.verdict === 'take' ? words.did : words.wouldHave}</dt>
            <dd data-reveal-line="">{row.line}</dd>
          </div>
        </dl>
        {/*
          A SAFE TILE'S NOTE IS WHAT TO WATCH FOR, never "In the real world" (the client,
          2026-10-22). The note explains the bad copy's giveaway, and under "In the real world" on a
          skill that was dealt good it read as if this one had done the harmful thing.
        */}
        <p
          class="otp-reveal__real"
          data-real-world=""
          data-real-label={row.good ? 'watch' : 'real'}
        >
          <span class="otp-reveal__term">
            {row.good ? s('revealWatchFor') : words.realWorld}: {skill.realWorld.term}.
          </span>{' '}
          {skill.realWorld.note}
        </p>
      </div>
    </li>
  );
}

/**
 * 05 Reveal, REDESIGNED 2026-10-22 (the client chose "score first, then flip cards"): a reward,
 * not a report.
 *
 *   1. THE RESULT. The ending in one line (the page's h1), the score out of 100 and what it is made
 *      of -- correct choices, the speed bonus and the run's time against par, every number core's
 *      (`v2.result`), none computed here -- then "You spotted N of 4 bad skills" and Walk it again
 *      beside it while the number is the last thing read.
 *   2. THE SEVEN CARDS, in walking order, face up: what each was and what the player did. Turn one
 *      over to see why. This is the interactive, educational part, and it is kept short.
 *   3. THE QUESTION and the screen's one Lime, Read the research, before the post form: the sentence
 *      this asset exists to ask must not sit below a form the visitor may not use (UX_REVIEW 9).
 *   4. YOUR NAME, typed by the player into an empty field, Post, and the board,
 *      with the player's own run shown the moment it is taken.
 */
export function Results({
  content,
  run,
  onReplay,
  onReadResearch,
  cannotPost,
  onPost,
  onTop,
}: ResultsProps) {
  const r = content.ui.reveal;
  const ending = run.ending ? content.endings[run.ending] : null;

  /*
   * The body takes focus on arrival, so PageDown, End and the arrows scroll the screen from the
   * first key (docs/UX_REVIEW.md 9). No trap: Results is a whole screen, not a modal.
   */
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.focus({ preventScroll: true });
  }, []);

  /* The name field starts empty: the player types their own (see the note on HANDLE_PROBLEM). */
  const [handle, setHandle] = useState('');
  /** The problem the last press found with the name, or null. Shown until the name changes. */
  const [problem, setProblem] = useState<HandleProblem | null>(null);
  const [notice, setNotice] = useState<PostOutcome | null>(null);
  const [posting, setPosting] = useState(false);
  const inFlight = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const [board, setBoard] = useState<BoardState>({ state: 'loading' });
  /* Whether this visit has pressed Post. Only ever goes true; see `boardNoteKey`. */
  const [attempted, setAttempted] = useState(false);
  const reads = useRef(boardReads()).current;

  const readBoard = (): (() => void) => {
    const ticket = reads.begin();
    setBoard({ state: 'loading' });
    void (onTop ?? readTheBoard)(DEFAULT_TOP_LIMIT).then((read) => {
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

  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (inFlight.current) return;
    // The name is checked BEFORE the press counts: a refused name posts nothing, so the board's
    // note keeps its invitation and no notice is set.
    const read = readName(handle);
    if (!('name' in read)) {
      setProblem(read.problem);
      field.current?.focus();
      return;
    }
    // The tidied form (spaces collapsed, apostrophes straightened) is what the board stores.
    const name = read.name;
    inFlight.current = true;
    setNotice(null);
    setPosting(true);
    // At the press, before any notice can exist: see `boardNoteKey`.
    setAttempted(true);
    try {
      const outcome = await onPost(name);
      setNotice(outcome);
      // The board refused the NAME (its rules, or the server's check of them): the field says so
      // too, so the player knows what to change and can post the same run again.
      if (outcome.reason === 'name') {
        setProblem(HANDLE_PROBLEM[outcome.nameRefusal ?? 'blocked']);
        field.current?.focus();
      }
    } catch {
      // `onPost` never throws; if a caller's promise ever does, say the claim that claims least.
      setNotice({ key: 'leaderboardDown', text: s('leaderboardDown') });
    } finally {
      inFlight.current = false;
      setPosting(false);
    }
    void readBoard();
  };

  const dealtBad = run.entries.filter((row) => !row.good).length;
  const kept = keptOutOf(run.entries);
  const clean = run.ending === 'grandma';
  /*
   * ON A CLEAN RUN THE LESSON STILL SHOWS (the client's review, 2026-10-25, P8): the first bad
   * skill the player caught is turned over already, as the culprit is on a wolf run, so a winner
   * sees "the line that gave it away" without having to ask.
   */
  const lessonOn = clean
    ? run.entries.find((row) => !row.good && tileCall(row) === 'caught')
    : undefined;

  /*
   * THE RESEARCH BAND, placed by the A/B test (P19, `?results=above`, src/ab.ts): after the cards,
   * as it ships, or directly under the score, where it is in view when the result is.
   */
  const band = (
    <>
      {/*
              ---------------------------------------------- 3. the question and the one Lime
              An <a> with an href, so it works standalone, with no .env, and on a middle-click;
              `onReadResearch` is the side channel to a parent page: embedded in an allowed
              parent, a plain click posts OFF_THE_PATH_READ_RESEARCH and does not navigate
              (embed/postMessage.ts, ARCHITECTURE section 9); anywhere else the link just works.
            */}
      <div class="otp-band">
        <p class="otp-band__question">
          <Highlighted text={r.question} word="agent" />
        </p>
        <a
          class="otp-cta"
          href={researchHref(RESEARCH_URL)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onReadResearch}
        >
          {r.cta}
          <span class="otp-cta__disc" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </>
  );

  return (
    <div class="otp-screen">
      <div class="otp-screen__inner">
        <Panel number="05" title={r.frameTitle} aside={<NotationChip label={s('landingChip')} />}>
          <div class="otp-screen__body otp-result" ref={body} tabIndex={-1} data-autofocus>
            {/* ---------------------------------------------- 1. the result */}
            <div class="otp-hero" data-score={run.total}>
              {ending && (
                <h1 class="otp-hero__ending" data-ending={run.ending}>
                  {ending.title}
                </h1>
              )}
              <h2 class="otp-section-label otp-hero__label">{r.score}</h2>
              {/* The explicit space keeps "100 out of 100" from reading as "100out of 100". */}
              <p class="otp-hero__score">
                {run.total} <small>{fill(r.outOf, { outOf: run.outOf })}</small>
              </p>
              {clean ? (
                <dl class="otp-hero__parts" data-parts="">
                  <div class="otp-hero__part">
                    <dt>{s('revealPlayed')}</dt>
                    <dd data-part="played">{run.played}</dd>
                  </div>
                  <div class="otp-hero__part">
                    <dt>{s('revealChoices')}</dt>
                    <dd data-part="choices">+{run.choices}</dd>
                  </div>
                  <div class="otp-hero__part">
                    <dt>{s('revealSpeed')}</dt>
                    <dd data-part="speed">+{run.speed}</dd>
                  </div>
                  {run.timeMs !== null && (
                    <div class="otp-hero__part">
                      <dt>{s('revealTime')}</dt>
                      <dd data-part="time">
                        {formatElapsed(run.timeMs)}{' '}
                        <small>{fill(s('revealPar'), { par: formatElapsed(run.parMs) })}</small>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p class="otp-hero__breakdown" data-floor={run.ending ?? 'late'}>
                  {fill(s(run.ending === 'wolf' ? 'revealFloorWolf' : 'revealFloorLate'), {
                    played: run.played,
                  })}
                </p>
              )}
              {/*
                THE REPLAY HOOK: how many of the wolf's skills stayed out of the basket, and the way back
                in beside it. The next deal is a new one (main.ts asks the server for a fresh seed),
                so "again" is a different forest's worth of cards, not the same answers twice. Walk
                it again is the SECONDARY style, a Deep Purple pill: the one Lime is the research.
              */}
              <div class="otp-replay" data-caught={kept} data-bad={dealtBad}>
                <p class="otp-replay__caught">{fill(r.caught, { caught: kept, bad: dealtBad })}</p>
                <button type="button" class="otp-button" data-action="replay" onClick={onReplay}>
                  {r.again}
                </button>
                {/*
                  THE WAY DOWN TO THE BOARD (the review of 2026-10-25, P13): on a phone the post
                  form starts about 1,000px down, under the cards and the research band. A quiet
                  text link, never Lime (the one Lime is the research), that scrolls to the form
                  and puts the cursor in the name.
                */}
                {cannotPost === null && (
                  <button
                    type="button"
                    class="otp-link"
                    data-action="to-post"
                    onClick={() => {
                      const still =
                        typeof matchMedia === 'function' &&
                        matchMedia('(prefers-reduced-motion: reduce)').matches;
                      document
                        .getElementById('otp-post')
                        ?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
                      field.current?.focus({ preventScroll: true });
                    }}
                  >
                    {s('postJump')}
                  </button>
                )}
              </div>
            </div>

            {variants.results === 'above' && band}

            {/* ---------------------------------------------- 2. the seven cards */}
            <section class="otp-tiles-section" aria-labelledby="otp-tiles-heading">
              <h2 class="otp-section-label otp-tiles__title" id="otp-tiles-heading">
                <Highlighted text={r.title} word={r.titleHighlight} />
              </h2>
              <p class="otp-fine otp-tiles__hint">{s('revealTilesHint')}</p>
              <ol class="otp-reveal otp-tiles">
                {run.entries.map((row) => (
                  <RevealTile
                    key={row.skillId}
                    row={row}
                    skill={content.skills.find((k) => k.id === row.skillId)!}
                    words={r}
                    autoOpen={row.skillId === lessonOn?.skillId}
                  />
                ))}
              </ol>
            </section>

            {variants.results === 'below' && band}

            {/* ---------------------------------------------- 4. your name, and the board */}
            <h2 class="otp-section-label otp-post__title" id="otp-post">
              {s('postHeading')}
            </h2>
            {cannotPost !== null ? (
              <p class="otp-fine" data-post="unavailable">
                {cannotPost}
              </p>
            ) : (
              <>
                <form class="otp-post" onSubmit={submit} noValidate>
                  <label class="otp-handle" for="otp-handle-input">
                    <span class="otp-handle__label">{s('handleLabel')}</span>
                    <input
                      ref={field}
                      id="otp-handle-input"
                      class="otp-handle__input"
                      type="text"
                      name="handle"
                      value={handle}
                      data-handle={handle}
                      autocomplete="nickname"
                      autocapitalize="off"
                      spellcheck={false}
                      enterkeyhint="send"
                      aria-invalid={problem !== null ? 'true' : undefined}
                      aria-describedby={
                        problem !== null ? 'otp-handle-problem otp-handle-hint' : 'otp-handle-hint'
                      }
                      onInput={(e) => {
                        setHandle((e.currentTarget as HTMLInputElement).value);
                        setProblem(null);
                      }}
                    />
                  </label>
                  {/*
                    What is wrong with the name, in words, tied to the field by `aria-describedby`
                    and with focus moved back to it, so a screen reader hears it on the way in. Not a
                    live region: `.otp-error` below is the screen's one status, and a second one
                    would make "which status?" a question for every assistive technology on the
                    page. INSIDE the form, right after the field (Paul's item 29): on a phone it sat
                    70px below the field, under both buttons; screens.css orders it there on a
                    wide window, under the whole row.
                  */}
                  {problem !== null && (
                    <p
                      class="otp-fine otp-handle__problem"
                      id="otp-handle-problem"
                      data-problem={problem}
                    >
                      {s(problem)}
                    </p>
                  )}
                  <button
                    type="submit"
                    class="otp-button"
                    aria-disabled={posting ? 'true' : undefined}
                  >
                    {s('post')}
                  </button>
                </form>
                {/* `privacyLine`: a handle and a score only, no email, no account, no cookies. */}
                <p class="otp-fine" id="otp-handle-hint" data-privacy="plain">
                  {s('handleHint')} {s('privacyLine')}
                </p>
              </>
            )}
            {/*
              Mounted in every state, text swapped: a live region inserted with its text is silent.
              THE OUTCOME HAS A SHAPE (Paul's item 29): a drawn check beside a post the board took,
              the "!" beside every other notice -- the reveal's own Badge, aria-hidden, a sibling of
              the status so the sentence it carries is exactly the sentence and nothing else.
            */}
            <div class="otp-outcome" data-outcome={notice ? notice.key : ''}>
              {notice && <Badge glyph={notice.key === 'handleAssigned' ? 'check' : 'missed'} />}
              <p class="otp-error" role="status" data-announce="post" data-notice={notice?.key}>
                {notice?.text ?? ''}
              </p>
            </div>

            <section class="otp-board" aria-labelledby="otp-board-heading">
              <h2 class="otp-section-label otp-board__title" id="otp-board-heading">
                <Highlighted text={s('leaderboardTitle')} word={s('leaderboardTitleHighlight')} />
              </h2>
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
                  {board.entries.flatMap((entry, i) => {
                    /*
                     * A GAP IN THE RANKS is drawn, not skipped. It is there when the server counted
                     * the reader's run below the top ten (`withYourRow` case 0): ranks 1 to 10, then
                     * a break, then theirs at 13. Without the break a 13 directly under a 10 reads
                     * as a misprint. Also above a first row that is not rank 1 (an edge page from
                     * before anyone posted, under the reader's row). Hidden from assistive
                     * technology, which hears every row's rank in words anyway.
                     */
                    const above = i === 0 ? 0 : board.entries[i - 1]!.rank;
                    const gap =
                      entry.rank > above + 1 ? (
                        <li key={`gap-${entry.rank}`} class="otp-board__gap" aria-hidden="true">
                          <span class="otp-board__gap-mark">⋮</span>
                        </li>
                      ) : null;
                    /*
                     * WHICH ROW IS THE READER'S is the adapter's to say (`entry.yours`, net/
                     * leaderboard.ts `withYourRow`): it knows the rank the server counted, so it can
                     * tell the reader's row from a stranger's carrying the same name -- which, with
                     * typed names, is an ordinary afternoon rather than one visitor in three hundred.
                     * `boardRowKey` still owns whether the row may SAY so.
                     */
                    const rowKey = boardRowKey(
                      entry.yours !== undefined,
                      attempted,
                      notice?.key ?? null,
                    );
                    const yours = rowKey === 'boardRowYou';
                    // Placed from the post's own answer because the cached board has not caught up.
                    const joining = yours && entry.yours === 'pending';
                    const say = s(rowKey)
                      .replace('{rank}', String(entry.rank))
                      .replace('{handle}', entry.handle)
                      .replace('{score}', entry.score.toLocaleString('en'));
                    const line = (
                      <li
                        key={`${entry.rank}-${entry.handle}`}
                        class={`otp-board__row${yours ? ' otp-board__row--you' : ''}`}
                        data-yours={yours ? entry.yours : undefined}
                      >
                        <span class="otp-board__visible" aria-hidden="true">
                          <span
                            class="otp-board__rank"
                            data-rank={entry.rank < 4 ? entry.rank : 'plain'}
                          >
                            {entry.rank}
                          </span>
                          <span class="otp-board__handle">{entry.handle}</span>
                          {yours && <span class="otp-board__you">{s('boardYouLabel')}</span>}
                          {joining && <span class="otp-board__wait">{s('boardJoining')}</span>}
                          <span class="otp-board__score">{entry.score.toLocaleString('en')}</span>
                        </span>
                        <span class="otp-visually-hidden">
                          {joining ? `${say} ${s('boardJoining')}.` : say}
                        </span>
                      </li>
                    );
                    return gap ? [gap, line] : [line];
                  })}
                </ol>
              )}

              {board.state === 'unavailable' && (
                <div class="otp-board__retry">
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
