import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_TOP_LIMIT, v2 } from '@otp/core';
import { RESEARCH_URL } from '../embed/postMessage';
/*
 * TWO STATEMENTS FROM ONE MODULE, DELIBERATELY. `test/handle-field.test.ts` matches this exact
 * line -- `import { newHandle } from '../net/leaderboard'` -- to hold the screen and the wire to a
 * single mint function. Merging these reddens it.
 */
import { newHandle } from '../net/leaderboard';
import { readBoard as readTheBoard } from '../net/leaderboard';
import type { BoardRead, ContactInput, PostOutcome } from '../net/leaderboard';
import { CyeraMark, Highlighted, Panel } from './components';
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
function Badge({ glyph }: { glyph: 'check' | 'missed' }) {
  return (
    <span class="otp-recap__badge" data-glyph={glyph} aria-hidden="true">
      {glyph === 'check' ? <CheckGlyph /> : '!'}
    </span>
  );
}

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
 * Every name `mintHandle` produces still passes -- `test/leaderboard.test.ts` runs all 3,072
 * through `validateHandle` -- because the field is pre-filled with one, and a suggestion the form
 * then refuses would be absurd.
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

/**
 * THE WORK EMAIL AND THE CONSENT (the client, 2026-10-22), asked only when the server requires
 * them. What is wrong with each, as the `ui.contact` key of the sentence that says so -- the same
 * rule the server applies (core contact.ts `checkContact`), asked first only so the player hears
 * it in words. Pure and exported so the unit tests hold it without a DOM.
 */
export type ContactProblems = {
  email: v2.EmailRefusal | null;
  consent: boolean;
};

export const CONTACT_PROBLEM: Record<v2.ContactRefusal, keyof v2.Content['ui']['contact']> = {
  'email-missing': 'emailMissing',
  'email-invalid': 'emailInvalid',
  'email-personal': 'emailPersonal',
  'consent-missing': 'consentMissing',
};

/** Both problems at once, so a press of Post can mark every field that needs attention. */
export function readContact(email: string, consent: boolean): ContactProblems {
  const checked = v2.checkWorkEmail(email);
  return { email: checked.ok ? null : checked.reason, consent: !consent };
}

/** True when the form may post: the address is a work address and the box is ticked. */
export const contactReady = (email: string, consent: boolean): boolean =>
  v2.checkContact(email, consent).ok;

const isContactRefusal = (reason: string | undefined): reason is v2.ContactRefusal =>
  v2.CONTACT_REFUSALS.some((known) => known === reason);

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
  onReadResearch(): void;
  /**
   * Why this run cannot be posted, or null when it can. A run the server did not start has no
   * token, and a late run is refused by rule (apps/api): both are said, never a dead button.
   */
  cannotPost: string | null;
  /**
   * Posts the run under a name -- with the work email and consent when `askEmail` -- and answers
   * the sentence to show AND which one it is.
   */
  onPost(handle: string, contact?: ContactInput): Promise<PostOutcome>;
  /**
   * The server requires a work email and consent with the post (`POST /api/start` answered
   * `emailRequired: true`). False shows exactly the form there was before the flag existed.
   */
  askEmail?: boolean;
  /** Reads the board. Optional: the default is the adapter itself; specs and tests inject. */
  onTop?(limit: number): Promise<BoardRead>;
}

/**
 * One offer on the reveal, as a card the player turns over.
 *
 * THE FACE is what the player did and what it really was: the skill's picture and name, Safe or
 * Unsafe as a shape and a word (a drawn check, or a "!" -- never a colour alone, and no red or green
 * anywhere, UI_FOUNDATIONS section 5), and "You took / You left / You walked past".
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
}: {
  row: v2.RevealEntry;
  skill: v2.Skill;
  words: v2.Content['ui']['reveal'];
}) {
  const [open, setOpen] = useState(false);
  const back = `otp-tile-back-${row.skillId}`;
  const chose =
    row.verdict === 'take' ? words.took : row.verdict === 'leave' ? words.left : words.unanswered;
  return (
    <li
      class={`otp-tile${row.good ? '' : ' otp-tile--bad'}`}
      data-reveal={row.skillId}
      data-kind={row.good ? 'good' : 'bad'}
      data-verdict={row.verdict ?? 'none'}
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        class="otp-tile__face"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={back}
        onClick={() => setOpen((was) => !was)}
      >
        <RevealIcon skill={skill} />
        <span class="otp-tile__text">
          <span class="otp-tile__name">{row.name}</span>
          <span class="otp-tile__mark">
            <Badge glyph={row.good ? 'check' : 'missed'} />
            <span class="otp-recap__status">{row.good ? words.good : words.bad}</span>
          </span>
          <span class="otp-reveal__chose">{chose}</span>
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
        <dl class="otp-reveal__pairs">
          <dt>{words.promised}</dt>
          <dd>{row.promise}</dd>
          <dt data-reveal-label="">{row.verdict === 'take' ? words.did : words.wouldHave}</dt>
          <dd data-reveal-line="">{row.line}</dd>
        </dl>
        <p class="otp-reveal__real" data-real-world="">
          <span class="otp-reveal__term">
            {words.realWorld}: {skill.realWorld.term}.
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
 *   4. YOUR NAME, typed (pre-filled with a suggestion the player can overwrite), Post, and the board,
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
  askEmail = false,
}: ResultsProps) {
  const r = content.ui.reveal;
  const words = content.ui.contact;
  const ending = run.ending ? content.endings[run.ending] : null;

  /*
   * The body takes focus on arrival, so PageDown, End and the arrows scroll the screen from the
   * first key (docs/UX_REVIEW.md 9). No trap: Results is a whole screen, not a modal.
   */
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.focus({ preventScroll: true });
  }, []);

  /*
   * The name field starts with a suggestion, minted once per mount -- `useState(newHandle)` passes
   * the function, so it is called for the initial state only -- and the player types over it.
   */
  const [handle, setHandle] = useState(newHandle);
  /** The problem the last press found with the name, or null. Shown until the name changes. */
  const [problem, setProblem] = useState<HandleProblem | null>(null);
  const [notice, setNotice] = useState<PostOutcome | null>(null);
  const [posting, setPosting] = useState(false);
  const inFlight = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  /*
   * THE CONTACT FIELDS' STATE. `asking` starts from the start's answer and turns on for good if the
   * server refuses a post for want of one (a start from before the flag, a flag switched on
   * mid-run): the player is then shown the fields rather than left with a refusal they cannot
   * act on. The address lives here and in the one request body, never in storage.
   */
  const [asking, setAsking] = useState(askEmail);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [emailProblem, setEmailProblem] = useState<v2.EmailRefusal | null>(null);
  const [consentProblem, setConsentProblem] = useState(false);
  const emailField = useRef<HTMLInputElement>(null);
  const consentBox = useRef<HTMLInputElement>(null);
  const ready = !asking || contactReady(email, consent);
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

  const suggest = (): void => {
    if (inFlight.current) return;
    setHandle(newHandle());
    setProblem(null);
  };

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
    /*
     * The contact, when asked for: every problem marked at once, focus to the first, nothing
     * posted. This is what pressing the aria-disabled Post does -- it stays focusable and
     * pressable on purpose, so a keyboard or screen-reader user who reaches it learns why.
     */
    if (asking) {
      const problems = readContact(email, consent);
      if (problems.email !== null || problems.consent) {
        setEmailProblem(problems.email);
        setConsentProblem(problems.consent);
        (problems.email !== null ? emailField : consentBox).current?.focus();
        return;
      }
    }
    inFlight.current = true;
    setNotice(null);
    setPosting(true);
    // At the press, before any notice can exist: see `boardNoteKey`.
    setAttempted(true);
    try {
      const outcome = asking ? await onPost(name, { email, consent }) : await onPost(name);
      setNotice(outcome);
      // The server refused the contact (its check is the authority): mark the field it named, and
      // show the fields at all if this run had not been told to ask for them.
      if (isContactRefusal(outcome.reason)) {
        setAsking(true);
        if (outcome.reason === 'consent-missing') {
          setConsentProblem(true);
          consentBox.current?.focus();
        } else {
          setEmailProblem(outcome.reason);
          emailField.current?.focus();
        }
      }
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
  const spotted = spottedOf(run.entries);
  const clean = run.ending === 'grandma';

  return (
    <div class="otp-screen">
      <div class="otp-screen__inner">
        <Panel number="05" title={r.frameTitle}>
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
                    <dt>{s('revealChoices')}</dt>
                    <dd data-part="choices">{run.choices}</dd>
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
                <p class="otp-hero__breakdown" data-zero={run.ending ?? 'late'}>
                  {s(run.ending === 'wolf' ? 'revealZeroWolf' : 'revealZeroLate')}
                </p>
              )}
              {/*
                THE REPLAY HOOK: how many of the wolf's skills the player spotted, and the way back
                in beside it. The next deal is a new one (main.ts asks the server for a fresh seed),
                so "again" is a different forest's worth of cards, not the same answers twice. Walk
                it again is the SECONDARY style, a Deep Purple pill: the one Lime is the research.
              */}
              <div class="otp-replay" data-caught={spotted} data-bad={dealtBad}>
                <p class="otp-replay__caught">
                  {fill(r.caught, { caught: spotted, bad: dealtBad })}
                </p>
                <button type="button" class="otp-button" data-action="replay" onClick={onReplay}>
                  {r.again}
                </button>
              </div>
            </div>

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
                  />
                ))}
              </ol>
            </section>

            {/*
              ---------------------------------------------- 3. the question and the one Lime
              An <a> with an href, so it works standalone, with no .env, and on a middle-click;
              `onReadResearch` is the side channel to a parent page.
            */}
            <div class="otp-band">
              <p class="otp-band__question">
                <Highlighted text={r.question} word="agent" />
              </p>
              <a
                class="otp-cta"
                href={RESEARCH_URL}
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

            {/* ---------------------------------------------- 4. your name, and the board */}
            <h2 class="otp-section-label otp-post__title">{s('postHeading')}</h2>
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
                  <button
                    type="button"
                    class="otp-button otp-button--quiet"
                    onClick={suggest}
                    aria-disabled={posting ? 'true' : undefined}
                  >
                    {s('handleReroll')}
                  </button>
                  {asking && (
                    /*
                     * THE WORK EMAIL AND THE CONSENT, between the name and Post so the reading and
                     * tab order is name, address, consent, Post. Each problem is tied to its
                     * control by `aria-describedby` and focus moves to it -- the same pattern as
                     * the name, and for the same reason no second live region.
                     */
                    <div class="otp-contact" data-contact="">
                      <label class="otp-email" for="otp-email-input">
                        <span class="otp-email__label">{words.emailLabel}</span>
                        <input
                          ref={emailField}
                          id="otp-email-input"
                          class="otp-email__input"
                          type="email"
                          name="email"
                          value={email}
                          autocomplete="email"
                          autocapitalize="off"
                          spellcheck={false}
                          inputMode="email"
                          maxLength={254}
                          aria-required="true"
                          aria-invalid={emailProblem !== null ? 'true' : undefined}
                          aria-describedby={
                            emailProblem !== null
                              ? 'otp-email-problem otp-email-hint'
                              : 'otp-email-hint'
                          }
                          onInput={(e) => {
                            setEmail((e.currentTarget as HTMLInputElement).value);
                            setEmailProblem(null);
                          }}
                          onBlur={() => {
                            // Said on the way out of the field, never while typing, and never
                            // about a field nobody has typed in yet.
                            if (email.trim() === '') return;
                            const checked = v2.checkWorkEmail(email);
                            setEmailProblem(checked.ok ? null : checked.reason);
                          }}
                        />
                      </label>
                      <p class="otp-fine otp-email__hint" id="otp-email-hint">
                        {words.emailHint}
                      </p>
                      {emailProblem !== null && (
                        <p
                          class="otp-fine otp-contact__problem"
                          id="otp-email-problem"
                          data-problem={emailProblem}
                        >
                          {words[CONTACT_PROBLEM[emailProblem]]}
                        </p>
                      )}
                      <label class="otp-consent" for="otp-consent-box">
                        <input
                          ref={consentBox}
                          id="otp-consent-box"
                          class="otp-consent__box"
                          type="checkbox"
                          name="consent"
                          checked={consent}
                          aria-required="true"
                          aria-invalid={consentProblem ? 'true' : undefined}
                          aria-describedby={consentProblem ? 'otp-consent-problem' : undefined}
                          onChange={(e) => {
                            setConsent((e.currentTarget as HTMLInputElement).checked);
                            setConsentProblem(false);
                          }}
                        />
                        <span class="otp-consent__text" data-consent-version={words.consentVersion}>
                          {words.consent}
                        </span>
                      </label>
                      {consentProblem && (
                        <p
                          class="otp-fine otp-contact__problem"
                          id="otp-consent-problem"
                          data-problem="consent-missing"
                        >
                          {words.consentMissing}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    type="submit"
                    class="otp-button"
                    aria-disabled={posting || !ready ? 'true' : undefined}
                  >
                    {s('post')}
                  </button>
                </form>
                {/*
                  What is wrong with the name, in words, tied to the field by `aria-describedby`
                  and with focus moved back to it, so a screen reader hears it on the way in. Not a
                  live region: `.otp-error` below is the screen's one status, and a second one would
                  make "which status?" a question for every assistive technology on the page.
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
                {/*
                  THE PRIVACY LINE IS TRUE IN BOTH MODES. Without the email it is chrome
                  `privacyLine` ("handle and score only ... no email"); while the email is asked
                  for that sentence would be false, so `ui.contact.privacy` replaces it: the name
                  and score on the public board, the address kept privately and never shown.
                */}
                <p
                  class="otp-fine"
                  id="otp-handle-hint"
                  data-privacy={asking ? 'contact' : 'plain'}
                >
                  {s('handleHint')} {asking ? words.privacy : s('privacyLine')}
                </p>
              </>
            )}
            {/* Mounted in every state, text swapped: a live region inserted with its text is silent. */}
            <p class="otp-error" role="status" data-announce="post" data-notice={notice?.key}>
              {notice?.text ?? ''}
            </p>

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
