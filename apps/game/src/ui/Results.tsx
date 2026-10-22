import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_TOP_LIMIT } from '@otp/core';
import type { v2 } from '@otp/core';
import { RESEARCH_URL } from '../embed/postMessage';
/*
 * TWO STATEMENTS FROM ONE MODULE, DELIBERATELY. `test/handle-field.test.ts` matches this exact
 * line -- `import { newHandle } from '../net/leaderboard'` -- to hold the screen and the wire to a
 * single mint function. Merging these reddens it.
 */
import { newHandle } from '../net/leaderboard';
import { readBoard as readTheBoard } from '../net/leaderboard';
import type { BoardRead, PostOutcome } from '../net/leaderboard';
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
function RevealIcon({ skill }: { skill: v2.Skill }) {
  const url = iconUrl(skill.icon);
  return url ? (
    <img class="otp-reveal__icon" src={url} alt={skill.name} width={64} height={64} />
  ) : (
    <span class="otp-reveal__icon otp-icon-placeholder" aria-hidden="true">
      {initials(skill.name)}
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
 * is a key: a reader whose run is rank 400 sees ten rows and none of them marked, so an unmarked
 * board asserts nothing whatever about where their run is. Under-claiming is the safe direction
 * and this node is deliberately built to fail that way.
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

export interface ResultsProps {
  content: v2.Content;
  /** What the run came to: the score, the ending and the reveal, from core (golden rule 6). */
  run: v2.RunResult;
  onReplay(): void;
  onReadResearch(): void;
  /**
   * Why this run cannot be posted, or null when it can. A run the server did not start has no
   * token, and a late run is refused by rule (apps/api): both are said, never a dead button.
   */
  cannotPost: string | null;
  /** Posts the run; answers the sentence to show AND which one it is (see `PostOutcome`). */
  onPost(handle: string): Promise<PostOutcome>;
  /** Reads the board. Optional: the default is the adapter itself; specs and tests inject. */
  onTop?(limit: number): Promise<BoardRead>;
}

/**
 * 05 Reveal. THE PRODUCT (GAME_DESIGN_V2 section 6): one row per offer, in walking order -- what
 * it was dealt, what the player did with it, what it did, and for a bad one the card line that
 * said so -- then the score, the ending, the question and the one Lime, the post and the board.
 *
 * Every offer is shown, taken or left, because the lesson is in both directions: a bad skill left
 * is the player reading the line, and a good one left is caution that brought Grandma nothing.
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
  const s = (key: string): string => strings[key] ?? '';
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

  /* Minted once per mount: `useState(newHandle)` passes the function (test/handle-field.test.ts). */
  const [handle, setHandle] = useState(newHandle);
  const [notice, setNotice] = useState<PostOutcome | null>(null);
  const [posting, setPosting] = useState(false);
  const inFlight = useRef(false);
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

  const reroll = (): void => {
    if (inFlight.current) return;
    setHandle(newHandle());
    setNotice(null);
  };

  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setNotice(null);
    setPosting(true);
    // At the press, before any notice can exist: see `boardNoteKey`.
    setAttempted(true);
    try {
      setNotice(await onPost(handle));
    } catch {
      // `onPost` never throws; if a caller's promise ever does, say the claim that claims least.
      setNotice({ key: 'leaderboardDown', text: s('leaderboardDown') });
    } finally {
      inFlight.current = false;
      setPosting(false);
    }
    void readBoard();
  };

  /*
   * The bad skills this run dealt, and how many of them stayed out of the basket. Unanswered counts
   * as left, the same rule core scores by, so the count can never disagree with the score. The
   * sentence says "kept out of your basket", never "caught": a run that walked past every card kept
   * them all out without reading one (content and UX review, 2026-10-22).
   *
   * A LATE run does not show the count at all. Its score is 0 because the clock ran out, not because
   * of the basket, and "4 of 4" beside "0 out of 100" and "After dark" reads as praise for a run
   * that may have read nothing. Walk it again stays.
   */
  const dealtBad = run.entries.filter((row) => !row.good).length;
  const caught = run.entries.filter((row) => !row.good && row.verdict !== 'take').length;
  const showCaught = run.ending !== 'late';

  /** What the player said to it, in the reveal's words. Unanswered counts as left (core). */
  const chose = (verdict: v2.Verdict | null): string =>
    verdict === 'take' ? r.took : verdict === 'leave' ? r.left : r.unanswered;

  return (
    <div class="otp-screen">
      <div class="otp-screen__inner">
        <Panel number="05" title={r.frameTitle}>
          <div class="otp-screen__body" ref={body} tabIndex={-1} data-autofocus>
            {/* The reveal is the subject of this page, so its title is the page's one h1. */}
            <h1 class="otp-reveal__title">
              <Highlighted text={r.title} word={r.titleHighlight} />
            </h1>
            <ol class="otp-recap otp-reveal">
              {run.entries.map((row) => {
                const skill = content.skills.find((k) => k.id === row.skillId)!;
                return (
                  <li
                    key={row.skillId}
                    class={`otp-recap__row${row.good ? '' : ' otp-recap__row--missed'}`}
                    data-reveal={row.skillId}
                    data-kind={row.good ? 'good' : 'bad'}
                    data-verdict={row.verdict ?? 'none'}
                  >
                    <Badge glyph={row.good ? 'check' : 'missed'} />
                    <div class="otp-recap__body">
                      <div class="otp-reveal__who">
                        <div class="otp-reveal__named">
                          <p class="otp-recap__heading">
                            {row.name}{' '}
                            <span class="otp-recap__status">{row.good ? r.good : r.bad}</span>
                          </p>
                          <p class="otp-reveal__chose">{chose(row.verdict)}</p>
                        </div>
                        <RevealIcon skill={skill} />
                      </div>
                      <dl class="otp-reveal__pairs">
                        <dt>{r.promised}</dt>
                        <dd>{row.promise}</dd>
                        {/*
                          A row the player did not take never ran, so its line is what it WOULD have
                          done: "What it did: the wolf opened the door" on a skill they left taught
                          that leaving it had not protected them.
                        */}
                        <dt data-reveal-label="">{row.verdict === 'take' ? r.did : r.wouldHave}</dt>
                        <dd data-reveal-line="">{row.line}</dd>
                      </dl>
                      {row.giveaway !== null && (
                        /*
                         * The bad card as the player was shown it, with the one line that gave it
                         * away marked: the lesson is that the line was ON the card, among lines
                         * that read just like it. `<mark>` is the element for "this is the part
                         * that matters here", and it carries a shape (the "!") and a word (the
                         * title above) as well as the Haze ground -- never a colour alone.
                         */
                        <div class="otp-recap__hidden" data-giveaway="">
                          <span class="otp-recap__hidden-title">{r.giveaway}</span>
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
                      <p class="otp-reveal__real" data-real-world="">
                        <span class="otp-reveal__term">
                          {r.realWorld}: {skill.realWorld.term}.
                        </span>{' '}
                        {skill.realWorld.note}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div class="otp-hero" data-score={run.total}>
              <div>
                <h2 class="otp-section-label">{r.score}</h2>
                {/* The explicit space keeps "100 out of 100" from reading as "100out of 100". */}
                <p class="otp-hero__score">
                  {run.total} <small>{fill(r.outOf, { outOf: run.outOf })}</small>
                </p>
              </div>
            </div>
            {/*
              THE REPLAY HOOK. How many of the wolf's skills the player caught -- left, or walked
              past, which core counts as left -- out of how many this run dealt, and the way back
              into the forest beside it, while the number is the last thing read. The next deal is
              a new one (main.ts asks the server for a fresh seed), so "again" is a different
              forest's worth of cards, not the same answers typed twice.

              Walk it again is the SECONDARY style, a Deep Purple pill: this screen's one Lime is
              the research call to action below, and it stays that.
            */}
            <div class="otp-replay" data-caught={caught} data-bad={dealtBad}>
              {showCaught && (
                <p class="otp-replay__caught">{fill(r.caught, { caught, bad: dealtBad })}</p>
              )}
              <button type="button" class="otp-button" data-action="replay" onClick={onReplay}>
                {r.again}
              </button>
            </div>
            {ending && (
              <div class="otp-reveal__ending" data-ending={run.ending}>
                <h2 class="otp-ending__title">{ending.title}</h2>
                {ending.lines.map((line) => (
                  <p class="otp-body-text" key={line}>
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/*
              The question and the screen's one Lime, BEFORE the post form: the sentence this asset
              exists to ask must not sit below a form the visitor may not use (docs/UX_REVIEW.md 9).
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

            <p class="otp-section-label">{s('postHeading')}</p>
            {cannotPost !== null ? (
              <p class="otp-fine" data-post="unavailable">
                {cannotPost}
              </p>
            ) : (
              <>
                {/* The name is shown, not typed: minted handles only (decision D4). */}
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
                    aria-disabled={posting ? 'true' : undefined}
                  >
                    {s('handleReroll')}
                  </button>
                  <button
                    type="submit"
                    class="otp-button"
                    aria-disabled={posting ? 'true' : undefined}
                  >
                    {s('post')}
                  </button>
                </form>
                <p class="otp-fine" id="otp-handle-hint">
                  {s('handleHint')} {s('privacyLine')}
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
                  {board.entries.map((entry) => {
                    // Matched locally; `boardRowKey` owns the two further conditions.
                    const rowKey = boardRowKey(
                      entry.handle === handle,
                      attempted,
                      notice?.key ?? null,
                    );
                    const yours = rowKey === 'boardRowYou';
                    const say = s(rowKey)
                      .replace('{rank}', String(entry.rank))
                      .replace('{handle}', entry.handle)
                      .replace('{score}', entry.score.toLocaleString('en'));
                    return (
                      <li
                        key={`${entry.rank}-${entry.handle}`}
                        class={`otp-board__row${yours ? ' otp-board__row--you' : ''}`}
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
