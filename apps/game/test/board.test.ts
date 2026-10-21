import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../../../content/game.json';
import { readTop } from '../src/net/leaderboard';
import {
  BOARD_NOTE,
  NOTE_CLAIMS,
  NOTICE_CLAIMS,
  boardNoteKey,
  boardReads,
  contradictions,
} from '../src/ui/Results';
import type { BoardState } from '../src/ui/Results';

/*
 * THE BOARD ON RESULTS: that it can tell an ABSENT board from an EMPTY one, and that it says so.
 *
 * The defect these exist for is not a missing feature. `top()` was written and tested in Phase 6
 * and nothing called it, so a player posted a score, read "Posted to the board as deft-cloak-81"
 * and never saw a board. Mounting it was the easy half. The hard half is the one below.
 *
 * `top()` used to return `LeaderboardEntry[]`, and an array cannot say which of two quite different
 * things happened: a board that answered with no rows, and no board at all. Both were `[]`. The
 * second is not hypothetical and it is not loud -- measured on the shipped build on 2026-10-20, an
 * undeployed route answers GET /api/top?limit=10 with 200, text/html and 654 bytes of index.html
 * from the SPA catch-all, `res.json()` throws, and the old `top()` returned `[]`. A screen
 * rendering that as "no runs on the board yet" would tell a visitor to a data-security company's
 * research page that the board is EMPTY when the board is ABSENT.
 *
 * On this asset that is the worst bug available: the product would be doing the exact thing the
 * game teaches players to look for. So the first block below is not about a return type. It is the
 * one guard that has to go red before that can ship again.
 *
 * `environment: 'node'`, so there is no DOM here and nothing renders. These are the two halves of
 * that composition -- the adapter's answer and the screen's copy table -- held against each other
 * directly, plus source guards over the stylesheet and the markup. What a browser has to show is in
 * `e2e/leaderboard.spec.ts`.
 */

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const results = readFileSync(`${SRC}/ui/Results.tsx`, 'utf8');
const screens = readFileSync(`${SRC}/ui/screens.css`, 'utf8');
/*
 * The adapter, read as SOURCE rather than imported for its exports. The set of sentences a post can
 * answer with lives in `createLeaderboardClient()`, which needs a whole `Content` to build and
 * belongs to another owner this round; what the honesty block below needs is which content keys it
 * reads, and that is a fact about the file.
 */
const adapter = readFileSync(`${SRC}/net/leaderboard.ts`, 'utf8');
const shipped = (raw as { strings: Record<string, string> }).strings;

/** Replaces fetch with one scripted reply, as test/leaderboard.test.ts does. */
function reply(make: () => Response): void {
  vi.stubGlobal('fetch', () => Promise.resolve(make()));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a read of the board gives three answers, not two', () => {
  it('rows, when the board answers with runs on it', async () => {
    reply(
      () =>
        new Response(
          JSON.stringify({
            entries: [
              { rank: 1, handle: 'brave-lantern-42', score: 900 },
              { rank: 2, handle: 'merry-kettle-73', score: 450 },
            ],
          }),
        ),
    );
    expect(await readTop(10)).toEqual({
      state: 'rows',
      entries: [
        { rank: 1, handle: 'brave-lantern-42', score: 900 },
        { rank: 2, handle: 'merry-kettle-73', score: 450 },
      ],
    });
  });

  it('empty, when the board answers and has no runs on it', async () => {
    reply(() => new Response(JSON.stringify({ entries: [] })));
    expect(await readTop(10)).toEqual({ state: 'empty' });
  });

  /*
   * THE ONE THAT MUST NEVER GO GREEN AS `empty`. This is the SPA catch-all's own reply, at the
   * status, content type and shape it was measured at: a 200 that is not a board.
   */
  it('unavailable, for the 200 of index.html an undeployed route serves', async () => {
    reply(
      () =>
        new Response('<!doctype html><title>Off the Path</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    expect(await readTop(10)).toEqual({ state: 'unavailable' });
  });

  it('unavailable, for a board that is down, silent or lying about its rows', async () => {
    const replies: (() => Response)[] = [
      () => new Response('', { status: 404 }),
      () => new Response('', { status: 503 }),
      // A row whose handle is not one this game mints drops the WHOLE board: a board we cannot
      // believe is a board that is not answering, which is the right way round.
      () => new Response(JSON.stringify({ entries: [{ rank: 1, handle: 'x', score: 1 }] })),
      () =>
        new Response(JSON.stringify({ entries: [{ rank: 1, handle: '<img src=x>', score: 1 }] })),
    ];
    for (const make of replies) {
      reply(make);
      await expect(readTop(10)).resolves.toEqual({ state: 'unavailable' });
      vi.unstubAllGlobals();
    }

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(readTop(10)).resolves.toEqual({ state: 'unavailable' });
  });
});

/*
 * The composition, which is the whole point and the thing neither half can check alone.
 *
 * The adapter can be right about `unavailable` and the screen can still print "no runs on the
 * board yet" for it; the screen's table can be right and the adapter can still answer `empty` for
 * an absent board. Only driving a real reply through both catches either, so that is what this
 * does: an HTTP reply in, the string key the player would read out.
 */
describe('what the player is told matches what actually came back', () => {
  const told = async (): Promise<string> => BOARD_NOTE[(await readTop(10)).state];

  it('says the board is empty only when the board said so itself', async () => {
    reply(() => new Response(JSON.stringify({ entries: [] })));
    expect(await told()).toBe('boardEmpty');
    expect(shipped['boardEmpty']).toMatch(/first/i);
  });

  it('never says the board is empty when the board is not there', async () => {
    for (const make of [
      (): Response =>
        new Response('<!doctype html><title>Off the Path</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      (): Response => new Response('', { status: 404 }),
    ]) {
      reply(make);
      const key = await told();
      expect(key, 'an absent board must not be reported as an empty one').not.toBe('boardEmpty');
      expect(key).toBe('boardDown');
      vi.unstubAllGlobals();
    }
  });

  it('is a different sentence for an absent board than for an empty one', () => {
    // Four distinct states, four distinct keys, four distinct sentences. A table that mapped two
    // states to one key would pass every test above and still lose the distinction.
    const keys = Object.values(BOARD_NOTE);
    expect(new Set(keys).size).toBe(keys.length);
    const lines = keys.map((key) => shipped[key]);
    expect(lines.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(lines.length);
  });

  /*
   * The reassurance is the point of `boardDown`, not decoration: the player's score is on the
   * screen in front of them whatever the board is doing, and the sentence has to say so rather
   * than leave them thinking the run was lost.
   */
  it('tells a player whose board is down that their score is still here', () => {
    expect(shipped['boardDown']).toMatch(/still on this page/i);
  });
});

/*
 * THE SEND-BACK, AND THE GUARD IT ASKED FOR -- REWRITTEN, BECAUSE THE FIRST ONE WAS A WORD LIST.
 *
 * Three adjacent-paragraph pairs were measured in Chromium on a clean build, `.otp-error` directly
 * above `.otp-board__note`:
 *
 *   1  a post the server took  "Posted to the board as brave-lantern-42."
 *                              "No runs on the board yet. Yours would be the first."
 *   2  a 409                   "That run is already on the board."
 *                              "No runs are showing yet. A run posted in the last minute may not
 *                               be here."
 *   3  a 400                   "That run could not be posted."
 *                              ...and that same hedge, which explains a delay for a post that
 *                               never happened.
 *
 * 1 was closed last round. The guard it shipped with matched
 * `/no runs on the board|nothing on the board|would be the first/` against the note, and a
 * reviewer put the defect back with ONE reworded string while every assertion here stayed green.
 * Four more rewordings pass it: "The board is empty. Be the first to put a run on it.", "No scores
 * yet. Yours would be number one.", "Nothing here yet. Post a run and it will be first." A bound
 * written against a spelling cannot guard a meaning, and it closed 1 while leaving 2 and 3 open.
 *
 * SO THE BOUND IS THE PAIRING, OVER DECLARED CLAIMS. Results.tsx names what each line asserts
 * (`NOTE_CLAIMS`, `NOTICE_CLAIMS`) and which claims are mutually exclusive (`EXCLUSIVE`); this
 * enumerates EVERY post outcome against EVERY board state and asserts no reachable pair carries an
 * exclusive pair of claims. Rewording a line does not move the property. Adding a state, a note
 * line or a post outcome without declaring what it asserts fails here rather than passing in
 * silence -- and the outcome set is read out of `src/net/leaderboard.ts`, which is another owner's
 * file, so it cannot drift out of step with a list kept here.
 *
 * What this CANNOT check is that a declaration still matches its own words: a line reworded to mean
 * something else while its claims stay put is a lie in the declaration. That is a human-review
 * boundary and naming it is the honest thing to do -- the alternative is the regex above, which
 * reads as proof and is not.
 */
describe('no pairing of the post notice and the board note can contradict', () => {
  /**
   * Every sentence `.otp-error` can carry, DERIVED from the adapter that produces them.
   *
   * `createLeaderboardClient()` is the only thing that answers `onPost`, and every player-facing
   * line it can return is a `content.strings['...']` read. Scanning for those is what makes this
   * set the shipped one rather than a list kept beside a file this round does not own: a fifth
   * outcome sentence added there arrives here undeclared and reddens the totality check below.
   */
  const NOTICE_KEYS = [
    ...new Set(
      [...adapter.matchAll(/content\.strings\['([A-Za-z0-9_]+)'\]/g)].map((match) => match[1]!),
    ),
  ];

  /** Every state the board read can be in, including the screen's own fourth one. */
  const STATES = Object.keys(BOARD_NOTE) as BoardState['state'][];

  /** Every line `.otp-board__note` can carry, derived by asking `boardNoteKey` for all of them. */
  const NOTE_KEYS = [
    ...new Set(STATES.flatMap((state) => [boardNoteKey(state, false), boardNoteKey(state, true)])),
  ];

  /**
   * `boardEmpty` is the one line that makes a claim a notice can contradict, and it is shown only
   * before a press. That is only true if `attempted` cannot be false while a notice is on screen,
   * which is a fact about `submit()` rather than about this table -- see the source guard below.
   */
  const reachable = (noteKey: string): boolean =>
    noteKey !== 'boardEmpty' || NOTE_KEYS.indexOf('boardEmptyAfterPost') === -1;

  it('declares what every line either node can carry asserts, and nothing it cannot', () => {
    expect(NOTICE_KEYS.length, 'no post outcome sentences were found in the adapter at all').toBe(
      4,
    );
    expect(NOTICE_KEYS.filter((key) => !(key in NOTICE_CLAIMS)).sort()).toEqual([]);
    expect(Object.keys(NOTICE_CLAIMS).filter((key) => !NOTICE_KEYS.includes(key))).toEqual([]);
    expect(NOTE_KEYS.filter((key) => !(key in NOTE_CLAIMS)).sort()).toEqual([]);
    expect(Object.keys(NOTE_CLAIMS).filter((key) => !NOTE_KEYS.includes(key))).toEqual([]);
    // And every declared line is a line the content file actually ships.
    for (const key of [...NOTICE_KEYS, ...NOTE_KEYS])
      expect(typeof shipped[key], `${key} is declared but not shipped`).toBe('string');
  });

  /*
   * THE ENUMERATION. Five states of `.otp-error` -- the four outcome sentences plus the absent
   * notice, which is what is rendered before a press, during a press and after a reroll -- against
   * every line the note can carry. The absent notice is a state, not a key: `{notice && <p …>}`
   * renders nothing, so it asserts nothing.
   */
  it('holds for every post outcome against every board state', () => {
    const checked: string[] = [];
    const bad: string[] = [];
    for (const noticeKey of [null, ...NOTICE_KEYS]) {
      const noticeClaims = noticeKey === null ? [] : NOTICE_CLAIMS[noticeKey]!;
      for (const noteKey of NOTE_KEYS) {
        const pair = `${noticeKey ?? '(no notice)'} + ${noteKey}`;
        if (!reachable(noteKey) && noticeKey !== null) continue;
        checked.push(pair);
        const clash = contradictions(noticeClaims, NOTE_CLAIMS[noteKey]!);
        if (clash.length > 0)
          bad.push(`${pair}: "${shipped[noticeKey!] ?? ''}" over "${shipped[noteKey]}" (${clash})`);
      }
    }
    expect(bad, 'two adjacent paragraphs on Results assert mutually exclusive things').toEqual([]);
    // The self-check: the enumeration really did walk the matrix. 5 notice states x 5 note lines,
    // less the 4 that `attempted` makes unreachable.
    expect(checked.length, 'the enumeration checked nothing').toBe(
      (NOTICE_KEYS.length + 1) * NOTE_KEYS.length - NOTICE_KEYS.length,
    );
  });

  /*
   * THE FOUR PAIRS THE ENUMERATION SKIPS, PROVED UNREACHABLE RATHER THAN ASSUMED.
   *
   * `boardEmpty` is the only line that claims the board holds nothing, and it would contradict both
   * sentences that say a run is on the board. It is safe only because a post notice cannot exist
   * while `attempted` is false: `submit()` sets the flag before the first `await`, so nothing can
   * put a sentence in `.otp-error` first, and nothing ever sets it back.
   */
  it('the one line claiming an empty board cannot meet a post notice at all', () => {
    const unsafe = NOTE_KEYS.filter((noteKey) =>
      NOTICE_KEYS.some((n) => contradictions(NOTICE_CLAIMS[n]!, NOTE_CLAIMS[noteKey]!).length > 0),
    );
    expect(unsafe, 'a line that can contradict a notice is reachable with one').toEqual([
      'boardEmpty',
    ]);
    // ...and it is exactly the line `attempted` swaps out. Both directions: a line that becomes
    // unsafe and is not swapped fails here, and a line swapped for no reason fails here too.
    const swapped = STATES.filter(
      (state) => boardNoteKey(state, false) !== boardNoteKey(state, true),
    ).map((state) => boardNoteKey(state, false));
    expect(swapped).toEqual(unsafe);

    /*
     * The source half, which no table can state. Comments stripped, because the prose above
     * `submit()` quotes the shape it replaced.
     */
    const code = results.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const from = code.indexOf('const submit =');
    expect(from, 'submit() is not where it was').toBeGreaterThan(-1);
    const submit = code.slice(from, code.indexOf('return (', from));
    expect(submit, 'submit() is not where it was').toContain('setAttempted(true)');
    expect(
      submit.indexOf('setAttempted(true)') < submit.indexOf('await onPost('),
      'the flag no longer moves before the first thing that can set a notice',
    ).toBe(true);
    expect(code, 'the attempted flag is set back somewhere').not.toContain('setAttempted(false)');
  });

  it('the shipped post notices really do make the claims declared for them', () => {
    // The other half of each contradiction. If these sentences stop claiming a run went up, this
    // whole block is guarding a collision that cannot happen and should be read again.
    expect(shipped['handleAssigned']).toMatch(/posted to the board/i);
    expect(shipped['handleAssigned']).toContain('{handle}');
    expect(shipped['leaderboardAlready']).toMatch(/already .*board/i);
    expect(NOTICE_CLAIMS['handleAssigned']).toContain('readerRunIsOnBoard');
    expect(NOTICE_CLAIMS['leaderboardAlready']).toContain('readerRunIsOnBoard');
    expect(NOTICE_CLAIMS['leaderboardRefused']).toContain('readerRunDidNotGoUp');
  });

  it('explains the absence instead, so the empty board is not simply silent', () => {
    // Replacing the invitation with nothing would close the contradiction and leave the player
    // looking at a board that does not mention the run they just posted.
    const after = shipped[boardNoteKey('empty', true)]!;
    expect(after.trim().split(/(?<=[.!?])\s+/).length, 'the line lost its explanation').toBe(2);
    // And it is a different sentence from the one the launch board shows.
    expect(after).not.toBe(shipped[boardNoteKey('empty', false)]);
  });

  it('still invites the first run on a board nobody has posted to', () => {
    // The fix must not cost the launch case its invitation: before any press, the copy is unchanged.
    expect(boardNoteKey('empty', false)).toBe('boardEmpty');
    expect(NOTE_CLAIMS['boardEmpty']).toContain('readerHasNoRun');
    // The other three states do not vary on it at all.
    for (const state of ['loading', 'rows', 'unavailable'] as const)
      expect(boardNoteKey(state, true)).toBe(boardNoteKey(state, false));
  });

  it('Results chooses the line with the flag, rather than reading the table directly', async () => {
    // The composition this file checks is only the shipped one if the screen uses it. A render that
    // went back to `BOARD_NOTE[board.state]` would pass every assertion above and ship the defect.
    expect(results).toContain('s(boardNoteKey(board.state, attempted))');
    expect(results).not.toContain('s(BOARD_NOTE[board.state])');
    // And the state that produced the defect is still the one a real cached reply comes back as.
    reply(() => new Response(JSON.stringify({ entries: [] })));
    expect((await readTop(10)).state, 'the cached empty is the state that produced this').toBe(
      'empty',
    );
  });
});

/*
 * WHICH OF SEVERAL BOARD READS MAY ANSWER.
 *
 * Reproduced in a real browser on 2026-10-21: two reads in flight settled by ARRIVAL order rather
 * than ISSUE order, because each call closed over its own private `live` flag and nothing
 * invalidated the call before it. With call 1 slow and holding ten rows and call 2 fast and empty,
 * the board ended up showing the ten rows the server had already contradicted. The second half was
 * that the disposer was dropped on two of the three call paths, so the comment promising no
 * setState after unmount was true for the mount path alone.
 *
 * `boardReads()` is pure, so the ordering rule is checked here rather than only in Playwright --
 * apps/game's vitest is the `node` environment and cannot render the component at all. The browser
 * half, which is the actual reproduction, is in e2e/leaderboard.spec.ts.
 */
describe('only the newest board read may answer, and none may after the screen is gone', () => {
  it('a slow older read cannot overwrite a fast newer one', () => {
    const reads = boardReads();
    const first = reads.begin();
    const second = reads.begin();
    // Call 2 answers first, as it did in the browser.
    expect(reads.mayAnswer(second)).toBe(true);
    // And call 1 arrives afterwards, with an answer that is already stale.
    expect(reads.mayAnswer(first), 'an older read overwrote a newer one').toBe(false);
  });

  it('the newest read may be asked more than once', () => {
    // `mayAnswer` is a question, not a consumption: asking it must not retire the ticket.
    const reads = boardReads();
    const only = reads.begin();
    expect(reads.mayAnswer(only)).toBe(true);
    expect(reads.mayAnswer(only)).toBe(true);
  });

  it('an abandoned read may not answer, and abandoning it starts nothing', () => {
    const reads = boardReads();
    const only = reads.begin();
    reads.abandon(only);
    expect(reads.mayAnswer(only)).toBe(false);
    // The next read still gets a ticket of its own and is still the newest.
    const next = reads.begin();
    expect(reads.mayAnswer(next)).toBe(true);
  });

  it('abandoning an already-superseded read does not revive anything', () => {
    const reads = boardReads();
    const first = reads.begin();
    const second = reads.begin();
    reads.abandon(first);
    expect(reads.mayAnswer(second), 'abandoning an old read retired the current one').toBe(true);
  });

  /*
   * THE CLAIM THE OLD COMMENT MADE AND COULD NOT KEEP. `submit()` called `readBoard()` bare and the
   * retry was `onClick={readBoard}`, so two of the three paths threw the disposer away and the
   * unmount protection existed only for the mount effect. The guarantee belongs to the gate now, so
   * it holds for a read nobody kept a handle on.
   */
  it('no read answers after the screen closes, on any path', () => {
    const reads = boardReads();
    const mount = reads.begin();
    const fromSubmit = reads.begin(); // started by a path that keeps no disposer
    reads.close();
    expect(reads.mayAnswer(fromSubmit), 'a read answered after the screen unmounted').toBe(false);
    expect(reads.mayAnswer(mount)).toBe(false);
    // And closing is final: a read begun afterwards cannot answer either.
    expect(reads.mayAnswer(reads.begin())).toBe(false);
  });

  it('Results keeps no per-call flag and drops no disposer', () => {
    /*
     * THE PROSE IS NOT THE CODE. Scanned raw, this failed on its own documentation: the note over
     * the retry button quotes the shape it replaced, so `onClick={readBoard}` is in the file in a
     * comment and will stay there. Same trap the block's own "NO LIME ANYWHERE" heading set for the
     * colour scan above, and the same answer -- strip the comments and read what the cascade, or
     * here the compiler, actually sees.
     */
    const code = results.replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(code).toContain('reads.mayAnswer(ticket)');
    expect(code).toContain('reads.close()');
    expect(code, 'the retry is dropping the disposer again').not.toContain('onClick={readBoard}');
    expect(code, 'a read is back to its own private live flag').not.toMatch(/let live = true/);
  });
});

/*
 * The stylesheet, derived rather than listed.
 *
 * The block is sliced from its own section marker to the NEXT marker, so a rule added to the board
 * tomorrow is inside the slice by construction. Hand-listing the selectors would be a bound written
 * in terms of the thing it guards: it would stop matching the day somebody adds a rule, and pass in
 * silence. The self-check below is what proves the slice still finds something.
 */
describe('the board spends no Lime and hard-codes no colour', () => {
  const MARKER = '/* --------------------------------------------------- results: 06 leaderboard';

  const block = (): string => {
    const from = screens.indexOf(MARKER);
    if (from === -1) return '';
    /*
     * From the marker INCLUSIVE, so the section's own heading comment is a well-formed comment
     * inside the slice and the stripper below can take it out. Slicing from the END of the marker
     * left the heading's closing delimiter in the slice with no opening one, which paired the
     * stripper with the wrong comment and made the heading's own "NO LIME ANYWHERE IN THIS BLOCK"
     * read as a violation of itself.
     */
    const rest = screens.slice(from);
    const next = rest.indexOf('/* ---', MARKER.length);
    return rest.slice(0, next === -1 ? rest.length : next);
  };

  /*
   * The block with its prose taken out. The scans below are about what the CASCADE carries, and a
   * comment carries nothing -- the block's own heading says "NO LIME ANYWHERE IN THIS BLOCK", and
   * a guard that read its own documentation as a violation would be unfixable except by deleting
   * the sentence that explains the rule.
   */
  const declarations = (): string => block().replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('finds the block it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    const found = block();
    expect(found, 'the 06 leaderboard section marker is gone from screens.css').not.toBe('');
    expect(found).toContain('.otp-board__row');
    expect(found).toContain('.otp-board__rank[data-rank=');
    expect(found.split('\n').length).toBeGreaterThan(40);
    // And the comment stripper still leaves the rules behind.
    expect(declarations()).toContain('var(--cyera-black)');
    expect(declarations()).not.toContain('NO LIME');
  });

  it('names no hex literal, so every colour comes from a token', () => {
    const hexes = declarations().match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes, 'colours come from CSS variables in reference/brand/cyera-theme.css').toEqual([]);
  });

  /*
   * EVERY COLOUR, NOT EVERY HEX. The two scans above look for a `#` and for the word "lime", and a
   * reviewer got past both in one line: `background: rgb(191, 255, 162)` on `.otp-board__row--you`
   * left this file 20/20 green. It is the screen's Lime, spelled in the one notation neither scan
   * could see -- which is the bound-written-in-terms-of-the-thing-it-guards trap, because both
   * bounds were written against a SPELLING rather than against the rule.
   *
   * The rule is the one this block's own title states: colours come from tokens. So instead of
   * listing spellings to forbid, every colour-bearing declaration is required to be made of token
   * references, lengths and a handful of structural keywords, and anything left over is a literal.
   * That fails `rgb(...)`, `hsl(...)`, `oklch(...)`, a bare `greenyellow` and a hex alike, without
   * this guard having to know that any of them exist.
   */
  it('paints with tokens only, in any notation a colour can be written in', () => {
    /** Properties that can carry a colour. `border-radius` and friends are not among them. */
    const COLOUR_PROPERTY =
      /^(color|background|background-color|border|border-color|border-(top|right|bottom|left)(-color)?|outline|outline-color|fill|stroke|box-shadow|text-decoration-color|caret-color|accent-color)$/;
    /** Keywords a colour-bearing value may legally contain that are not themselves colours. */
    const STRUCTURAL =
      /\b(transparent|currentcolor|inherit|initial|unset|revert|none|solid|dashed|dotted|double|inset|auto|max|min|clamp|calc|to|top|right|bottom|left|center|var)\b/gi;

    const literal = (value: string): string =>
      value
        .replace(/var\(\s*--[a-z0-9-]+\s*(,[^()]*)?\)/gi, ' ')
        .replace(/\b[\d.]+(px|em|rem|%|vw|vh|s|ms|deg|fr)?\b/gi, ' ')
        .replace(STRUCTURAL, ' ')
        .replace(/[\s,/()*+-]+/g, '');

    const offenders: string[] = [];
    for (const match of declarations().matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/gi)) {
      const property = match[1]!.trim().toLowerCase();
      if (!COLOUR_PROPERTY.test(property)) continue;
      const left = literal(match[2]!);
      if (left !== '') offenders.push(`${property}: ${match[2]!.trim()}`);
    }
    expect(offenders, 'a colour in the board block is not coming from a token').toEqual([]);

    // The self-check: the scan really is looking at this block's colour declarations, so it cannot
    // pass by finding nothing. Same reason "finds the block it thinks it does" exists above.
    const scanned = [...declarations().matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/gi)].filter((m) =>
      COLOUR_PROPERTY.test(m[1]!.trim().toLowerCase()),
    );
    expect(scanned.length, 'no colour declarations were scanned at all').toBeGreaterThan(8);
  });

  it('spends no Lime: Results has one and it is already on the research call to action', () => {
    expect(declarations()).not.toMatch(/lime/i);
    // And the screen still has exactly the one, where it was.
    expect(results).toContain('class="otp-cta"');
  });

  /*
   * The Deep Purple body BRAND_AND_UI section 3 requires of the leaderboard, which this block did
   * not have: `.otp-board` computed to rgba(0, 0, 0, 0) and the Black rows sat straight on the
   * Shell panel. Asserted against the DECLARATION rather than against a screenshot, because the
   * divergence was silent -- nothing anywhere said the board had no ground.
   */
  it('gives the board the Deep Purple body the brand spec asks for', () => {
    expect(declarations()).toMatch(/\.otp-board\s*\{[^}]*background:\s*var\(--cyera-deep-purple\)/);
    // And the rows stay the Black bars of the same sentence.
    expect(declarations()).toMatch(/\.otp-board__row\s*\{[^}]*background:\s*var\(--cyera-black\)/);
  });

  it('marks your row and the top ranks by more than a fill', () => {
    // No status in this game is carried by colour alone: the rank is its own numeral, and your
    // row says so in words.
    expect(results).toContain("s('boardYouLabel')");
    expect(shipped['boardYouLabel']).toBeTruthy();
  });
});

describe('nothing from the board reaches the page unescaped', () => {
  it('Results sets no markup from data, on any path', () => {
    expect(results).not.toContain('dangerouslySetInnerHTML');
    expect(results).not.toContain('innerHTML');
  });

  /*
   * THE WHOLE SPAN, not just the expression inside it.
   *
   * The first version of this asserted `results.toContain('{entry.handle}')`, and it passed with
   * the handle rendered through `dangerouslySetInnerHTML` -- because the row's React key is
   * `${entry.rank}-${entry.handle}`, and that template literal contains the same characters. A
   * guard satisfied by a string somewhere else in the file is the bound-written-in-terms-of-the-
   * thing-it-guards trap, so it matches the element that actually renders. `pnpm lint` runs
   * prettier --check, so this formatting is fixed rather than incidental.
   */
  it('renders the handle and the score as text children of their own spans', () => {
    expect(results).toContain('<span class="otp-board__handle">{entry.handle}</span>');
    expect(results).toContain(
      '<span class="otp-board__score">{entry.score.toLocaleString(\'en\')}</span>',
    );
  });

  it('shows a timestamp nowhere: the board stores a handle and a score only', () => {
    // The privacy line on this very screen promises exactly that, so a third column makes it lie.
    const board = results.slice(results.indexOf('class="otp-board"'));
    expect(board).not.toMatch(/created_?at|timestamp|postedAt|toLocaleDateString/i);
    expect(shipped['privacyLine']).toMatch(/handle and score only/i);
  });
});

describe('every string the board shows is in the content file and read from it', () => {
  const KEYS = [
    'leaderboardTitle',
    'leaderboardTitleHighlight',
    'boardLoading',
    'boardReady',
    'boardEmpty',
    'boardEmptyAfterPost',
    'boardDown',
    'boardRetry',
    'boardYouLabel',
    'boardRow',
    'boardRowYou',
  ];

  it('ships every one of them', () => {
    expect(KEYS.filter((key) => !(key in shipped))).toEqual([]);
  });

  it('names every one in Results, so none is shipped copy nothing renders', () => {
    expect(KEYS.filter((key) => !results.includes(`'${key}'`))).toEqual([]);
  });

  it('keeps the two row sentences substitutable, so no placeholder renders raw', () => {
    for (const key of ['boardRow', 'boardRowYou']) {
      for (const slot of ['{rank}', '{handle}', '{score}']) {
        expect(shipped[key], `${key} is missing ${slot}`).toContain(slot);
      }
    }
    expect(results).toContain("replace('{rank}'");
    expect(results).toContain("replace('{handle}'");
    expect(results).toContain("replace('{score}'");
  });

  /*
   * The deck's subtitle is "Top players this week, resets Monday" and it is FALSE against the
   * shipped service: apps/api orders over the whole table and retention is twelve months, not a
   * Monday truncation. A false claim about data handling on a data-security company's research
   * page is the defect this whole screen argues against, so the claim must not come back.
   */
  it('claims no weekly window and no reset, because the service has neither', () => {
    for (const key of KEYS) {
      expect(shipped[key], `${key} claims a reset the board does not do`).not.toMatch(
        /this week|resets|weekly|monday/i,
      );
    }
  });

  it('carries no emoji', () => {
    for (const key of KEYS)
      expect(shipped[key]!, `${key} carries an emoji`).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /*
   * SENTENCE CASE, ACTUALLY TESTED.
   *
   * This assertion used to be `line[0] === line[0].toUpperCase()`, which is a test that the line
   * STARTS with a capital and says nothing at all about the rest of it. A reviewer proved it:
   * setting boardRetry to "Try Again" and boardReady to "The Highest Scores So Far..." left this
   * file 20/20 green. The emoji half was always sound and keeps its own test above.
   *
   * Sentence case is a claim about every word AFTER the first, so that is what this reads: a
   * capitalised word is a violation unless it opens the line or follows a full stop, a question
   * mark or an exclamation mark. That shape is what lets the two-sentence lines pass honestly --
   * "... may not be here yet." then "A run posted ...", and "... points." then "This is your run."
   * -- without the guard having to know which lines have two sentences in them.
   *
   * `{handle}`, `{rank}` and `{score}` are substitution slots, not words, and what goes into them
   * is a minted handle or a numeral. They are skipped rather than special-cased by spelling.
   */
  const PROPER_NAMES = ['leaderboardTitle', 'leaderboardTitleHighlight'];

  /*
   * THE EXEMPTION LIST WAS AN OPEN DOOR, and a reviewer walked through it.
   *
   * This used to assert `PROPER_NAMES.every((key) => KEYS.includes(key))` -- that every exempted
   * key is a board string -- which is satisfied by ANY board string. Adding `boardRetry` to the
   * list made "Try Again" pass the sentence-case test AND pass the test whose whole job is to stop
   * the list growing: the guard against the exemption was satisfiable by the exemption. It is the
   * bound-written-in-terms-of-the-thing-it-guards trap in its purest form, because membership of
   * the list was the only thing the list was checked against.
   *
   * The exemption now has to be earned by the VALUE. A key is exempt from sentence case only if
   * what it ships IS the board's own name or one word of it -- derived from `leaderboardTitle`,
   * so renaming the board moves the bound with it and does not open the door again.
   */
  it('exempts the board’s own name, and makes every exemption prove it is that name', () => {
    // "Wolf Spotters" is a title, and BRAND_AND_UI section 3 names it in those capitals.
    const title = shipped['leaderboardTitle']!;
    const words = title.split(/\s+/);
    for (const key of PROPER_NAMES) {
      expect(KEYS, `${key} is exempted from sentence case but is not a board line`).toContain(key);
      const value = shipped[key]!;
      expect(
        value === title || words.includes(value),
        `${key} is exempted from sentence case, but "${value}" is neither the board's name ` +
          `"${title}" nor one word of it`,
      ).toBe(true);
    }
    expect(title).toBe('Wolf Spotters');
    expect(shipped['leaderboardTitleHighlight']).toBe('Spotters');
    // And it is one word OF the title, so the highlight cannot drift off the heading it marks.
    expect(title).toContain(shipped['leaderboardTitleHighlight']!);
  });

  it('is sentence case, not title case', () => {
    for (const key of KEYS) {
      if (PROPER_NAMES.includes(key)) continue;
      const line = shipped[key]!;
      expect(line[0], `${key} does not start with a capital`).toBe(line[0]!.toUpperCase());

      /*
       * Walk the words, remembering whether the previous one ended a sentence. A word is allowed a
       * capital only at the start of the line or at the start of a sentence.
       */
      let opensSentence = true;
      for (const word of line.split(/\s+/)) {
        const bare = word.replace(/^[^\p{L}{]+/u, '');
        const first = bare[0];
        if (first !== undefined && first !== '{')
          expect(
            first === first.toLowerCase() || opensSentence,
            `${key} is title case, not sentence case: "${word}" in "${line}"`,
          ).toBe(true);
        if (bare !== '') opensSentence = /[.!?]["')\]]?$/.test(word);
      }
    }
  });
});
