import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { HANDLE_FIRST_WORDS, HANDLE_SECOND_WORDS, isMintedHandle } from '@otp/core';
import { ready } from './helpers';

/*
 * The post form, and the board under it, against an API that answers, in a real browser.
 *
 * Everything else about the board is a unit test with `fetch` replaced, and `e2e/game.spec.ts`
 * covers the case that matters most -- no API deployed at all, which is what `vite preview` is.
 * What nothing covered was a post that SUCCEEDS, a post that is refused, and the one failure the
 * adapter used to get wrong: a reply whose headers arrive and whose body never does. Those need a
 * fake route, so they live here rather than in the specs that own the form.
 *
 * `page.route` fakes the server, not the game: the browser still makes a real same-origin request
 * to /api/score through the real adapter, and the page still renders whatever comes back.
 */

const CONTENT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as { strings: Record<string, string> };

/**
 * Lime, as the browser will report it, read out of the brand file rather than typed here.
 *
 * The rule is "Lime appears once per screen", so a guard against a second one has to know the
 * value -- and a value copied into a test is a fact in a comment with a semicolon on the end. It
 * comes from reference/brand/cyera-theme.css, which is where the rule's subject is defined, so
 * the day the token moves this moves with it instead of silently watching the wrong colour.
 */
const LIME_RGB = ((): string => {
  const theme = readFileSync(
    fileURLToPath(new URL('../../../reference/brand/cyera-theme.css', import.meta.url)),
    'utf8',
  );
  const hex = /--cyera-lime:\s*#([0-9a-fA-F]{6})\b/.exec(theme)?.[1];
  if (!hex) throw new Error('--cyera-lime is not in reference/brand/cyera-theme.css');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
})();

/**
 * How long the adapter waits before it gives up on a request, read out of the adapter.
 *
 * The race test below holds one read open while a newer one answers, and that only proves anything
 * while the held read is still alive. Typing 6000 here would be a bound written in terms of the
 * thing it guards: raise the adapter's timeout and this would start skipping runs it should check,
 * lower it and it would assert against a request the browser had already abandoned.
 */
const ADAPTER_TIMEOUT_MS = ((): number => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/net/leaderboard.ts', import.meta.url)),
    'utf8',
  );
  const ms = /TIMEOUT_MS\s*=\s*(\d+)/.exec(src)?.[1];
  if (!ms) throw new Error('TIMEOUT_MS is not in apps/game/src/net/leaderboard.ts');
  return Number(ms);
})();

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** A finished, careful run, played through the real store. */
async function reachResults(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.evaluate((skillOf) => {
    const { store } = window.__otp!;
    for (const [character, verdict] of Object.entries({
      rabbit: 'restrict',
      owl: 'reject',
      'lantern-keeper': 'allow',
    })) {
      store.dispatch({ type: 'MEET', c: character });
      store.dispatch({ type: 'INSPECT', s: skillOf[character] });
      store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, SKILL_OF);
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

const post = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Post', exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

test('a post the board takes says which name went up', async ({ page }) => {
  let sent: { handle?: string; log?: unknown[]; score?: unknown } = {};
  await page.route('**/api/score', async (route: Route) => {
    sent = JSON.parse(route.request().postData() ?? '{}') as typeof sent;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: sent.handle, score: 900 }),
    });
  });

  await reachResults(page);
  await post(page);

  // The handle is minted, never typed, and no score is sent (golden rule 6). The sharper claim
  // the minted field makes available: the name on the wire is the name on the screen.
  expect(sent.handle).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
  expect(sent.handle).toBe(
    await page.locator('.otp-handle [data-handle]').getAttribute('data-handle'),
  );
  expect(Object.keys(sent).sort()).toEqual(['handle', 'log']);
  await expect(page.getByRole('status')).toContainText(sent.handle!);
});

test('a post the board refuses is not reported as a board that is down', async ({ page }) => {
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that submission is not valid' }),
    }),
  );

  await reachResults(page);
  await post(page);

  const status = page.getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).not.toContainText(/unavailable/i);
  await expect(status).toContainText(/could not be posted/i);
});

/** The line the game shows for a board that is not answering, matched on its own first words. */
const DOWN = new RegExp(CONTENT.strings['leaderboardDown']!.slice(0, 12), 'i');

test('a reply that stops mid-body gives the player the button back', async ({ page }) => {
  // Headers that promise forty bytes and a body that delivers twenty-eight: the read fails rather
  // than finishing, and that has to come back as the unavailable line, not as a dead button.
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '40' },
      body: '{"handle":"brave-lantern-42"',
    }),
  );

  await reachResults(page);
  await post(page);

  await expect(page.getByRole('status')).toContainText(DOWN);
  // The one thing Phase 5 promised: results and the call to action are still there to use.
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  await expect(page.locator('.otp-cta').first()).toBeVisible();
});

test('a reply that never comes is given up on, in a real browser', async ({ page }) => {
  /*
   * The six-second abort, against a route that answers after eight. This is the pre-headers stall;
   * the one where the HEADERS arrive and the body is then held open forever cannot be built with
   * `route.fulfill`, so it lives in test/leaderboard.test.ts, where a ReadableStream can be held
   * open and the abort can be shown to error it. That is the case `ask()` reads the body inside the
   * timed region for, and reverting that line makes the unit test hang.
   */
  await page.route('**/api/score', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(
      () => undefined, // the browser has already abandoned the request
    );
  });

  await reachResults(page);
  await post(page);

  await expect(page.getByRole('status')).toContainText(DOWN, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  await expect(page.locator('.otp-cta').first()).toBeVisible();
});

/* ------------------------------------------------------------------ the board itself */

/*
 * 06 Leaderboard, mounted on Results, in a browser.
 *
 * The unit guards in test/board.test.ts hold the adapter's three answers and the screen's copy
 * table against each other, which is the defect's core. What they cannot see is the rendering:
 * apps/game's vitest runs on the `node` environment with no DOM. These four are the parts that
 * only a real page can show -- that an ABSENT board does not read as an EMPTY one on screen, that
 * the rank tints land where the brand says and nowhere else, that the retry actually re-requests,
 * and that the status line is a region that MUTATES rather than one that is replaced.
 */

interface TopReply {
  status: number;
  contentType: string;
  body: string;
}

type Row = { rank: number; handle: string; score: number };

const rowsReply = (entries: Row[]): TopReply => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ entries }),
});

const EMPTY_BOARD = rowsReply([]);

/*
 * THE ONE THIS WHOLE BUILD EXISTS FOR, at the status and content type it was measured at on
 * 2026-10-20: an undeployed /api/top answers 200 with text/html from the SPA catch-all. It is not
 * a 404 and it is not loud, and before the read returned three answers the screen could only have
 * called it "no runs on the board yet".
 */
const ABSENT_BOARD: TopReply = {
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>Off the Path</title>',
};

/*
 * Ten rows, with the handles BUILT FROM THE REAL WORDLISTS rather than invented.
 *
 * This cost a run of this very file, and the product was right both times. `topResponseSchema`
 * checks every handle against `handleSchema`, which is the two fixed wordlists in packages/core,
 * and it fails the WHOLE array when one row does not pass -- so ten plausible-looking names like
 * `clever-basket-31` do not render as nine good rows and one bad one, they render as
 * `unavailable`. That is the right way round and it is what test/leaderboard.test.ts pins with
 * `'x'` and `'<img src=x>'`; a fixture that types its own names is just the first thing it
 * catches.
 *
 * `avoiding` keeps the player's own minted handle out of the set, so "exactly one row is yours"
 * is a fact about the fixture and not a 1-in-3,072 coin toss that CI's --fail-on-flaky-tests
 * would eventually lose.
 */
const tenRows = (avoiding?: string): Row[] =>
  Array.from({ length: 10 }, (_, i) => {
    const first = HANDLE_FIRST_WORDS[i]!;
    const second = HANDLE_SECOND_WORDS[i]!;
    const handle = `${first}-${second}-${10 + i * 7}`;
    return {
      rank: i + 1,
      handle: handle === avoiding ? `${first}-${second}-${11 + i * 7}` : handle,
      score: 1000 - i * 50,
    };
  });

const TEN: Row[] = tenRows();

/** A mutable fake board: what it answers next, and how many times it has been asked. */
interface Board {
  reply: TopReply;
  calls: number;
}

async function serveBoard(page: Page, board: Board): Promise<void> {
  await page.route('**/api/top*', async (route: Route) => {
    board.calls += 1;
    await route.fulfill(board.reply);
  });
}

const note = (page: Page) => page.locator('.otp-board__note');

/**
 * No Lime anywhere the board actually paints, measured off the rendered page.
 *
 * CALLED FROM EVERY BOARD STATE, and the reason is a defect this sweep has now had twice.
 *
 * The first version lived only in the test whose fixture has no row of the player's own, so
 * `.otp-board__row--you` never rendered and a Lime fill put on exactly that rule passed in silence.
 * That was widened to both row tests. It was still wrong in the same way: it ran in the two states
 * that have ROWS, so `unavailable` -- the only state production renders today, with /api/top still
 * 404ing -- was never swept at all. It happens to be safe, which is luck rather than a guard. So
 * every test below that reaches a board state runs this, including loading, empty and unavailable.
 *
 * Three further things it did not look at and now does: the `.otp-board` element itself (the sweep
 * queried descendants only, so a Lime ground on the board was invisible to it), border colours
 * (the retry pill is an outline, which is where a fill would hide), and its own coverage -- the
 * `> 20` floor was a number typed for the ten-row state and would have had to be lowered or
 * deleted to let the four-element states through.
 *
 * THE FLOOR THAT REPLACED IT WAS ARITHMETIC, NOT COVERAGE, and that is the defect this round.
 * `expect(swept.used.length).toBe(swept.elements * 3)` reads as "the sweep looked at every element"
 * and is in fact `all.flatMap((el) => [a, b, c]).length === all.length * 3`, which holds for 1, 2,
 * 3, 4 and 33 elements and cannot fail for any of them. A bound that cannot fail is worse than no
 * bound, because it is read as proof.
 *
 * What a sweep like this can actually get wrong is reading nothing USEFUL. `not.toContain` passes
 * vacuously against empty strings, so a property name that stopped resolving -- or a root that
 * stopped matching the elements it means to cover -- would leave every assertion below green while
 * the sweep looked straight past a Lime fill. So the floor is about the VALUES now: every one of
 * them is a colour the browser resolved, and they are not all the same value, which is what reading
 * a real board produces and what reading past one does not.
 */
async function expectNoLime(page: Page): Promise<void> {
  const swept = await page.locator('.otp-board').evaluate((root) => {
    const all = [root, ...Array.from(root.querySelectorAll('*'))];
    return {
      elements: all.length,
      used: all.flatMap((el) => {
        const style = getComputedStyle(el);
        return [style.backgroundColor, style.color, style.borderTopColor];
      }),
    };
  });
  expect(swept.elements, 'the board rendered nothing at all').toBeGreaterThan(1);
  const read = [...new Set(swept.used)];
  expect(
    read.filter((value) => !/^(rgba?|hsla?|color|oklch|oklab|lab|lch)\(/.test(value)),
    'the sweep read a value that is not a resolved colour, so a Lime there would be invisible to it',
  ).toEqual([]);
  expect(
    read.length,
    'the sweep read one value for the whole board, so it is reading past it rather than at it',
  ).toBeGreaterThan(1);
  expect(swept.used, 'the board is spending the screen’s one Lime').not.toContain(LIME_RGB);
  // The control group: the page's one Lime is still on the research call to action.
  const cta = await page
    .locator('.otp-cta')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(cta, 'the research CTA is where this screen spends its Lime').toBe(LIME_RGB);
}

const say = (key: string): string => CONTENT.strings[key]!;

test('a board with runs on it shows them, and marks nothing in Lime', async ({ page }) => {
  // The fixture is only a board if the game could have minted every name on it.
  expect(TEN.every((row) => isMintedHandle(row.handle))).toBe(true);

  const board: Board = { reply: rowsReply(TEN), calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);

  await expect(page.locator('.otp-board__row')).toHaveCount(10);
  await expect(note(page)).toHaveText(say('boardReady'));
  await expect(note(page)).toHaveAttribute('data-board', 'rows');

  /*
   * The tints, measured rather than asserted by class name. 1, 2 and 3 are discs; 4+ is a plain
   * numeral with NO disc, which is the half a reviewer forgets and the half that would quietly
   * turn the board into a wall of fills.
   */
  const fill = (rank: string): Promise<string> =>
    page
      .locator(`.otp-board__rank[data-rank="${rank}"]`)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

  const transparent = 'rgba(0, 0, 0, 0)';
  expect(await fill('1')).not.toBe(transparent);
  expect(await fill('2')).not.toBe(transparent);
  expect(await fill('3')).not.toBe(transparent);
  // Rank 4 and everything below it: the attribute is there so the markup is uniform, and no rule
  // answers it.
  await expect(page.locator('.otp-board__rank[data-rank="plain"]')).toHaveCount(7);
  expect(await fill('plain')).toBe(transparent);
  // Three distinct discs, not one tint repeated.
  expect(new Set([await fill('1'), await fill('2'), await fill('3')]).size).toBe(3);

  /*
   * NO LIME ON THIS BOARD. Results spends its one on the research call to action, and the value
   * comes out of the brand file rather than being typed here -- a bound written in terms of the
   * thing it guards moves with the defect and passes in silence.
   */
  await expectNoLime(page);
});

test('an empty board invites a first run and does not look like a failure', async ({ page }) => {
  const board: Board = { reply: EMPTY_BOARD, calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);

  await expect(note(page)).toHaveText(say('boardEmpty'));
  await expect(note(page)).toHaveAttribute('data-board', 'empty');
  // No list at all rather than an empty one, so no bare rule sits under the invitation.
  await expect(page.locator('.otp-board__rows')).toHaveCount(0);
  await expect(page.getByRole('button', { name: say('boardRetry'), exact: true })).toHaveCount(0);
  await expectNoLime(page);
});

/*
 * THE SEND-BACK, IN A BROWSER, FOR EVERY OUTCOME A POST CAN HAVE.
 *
 * Measured on a clean build, `.otp-error` and the very next paragraph on the payoff screen:
 *
 *   a post the server took  "Posted to the board as brave-lantern-42."
 *                           "No runs on the board yet. Yours would be the first."
 *   a 409                   "That run is already on the board."
 *                           "No runs are showing yet. A run posted in the last minute may not
 *                            be here."
 *   a 400                   "That run could not be posted."
 *                           ...and that same hedge, explaining a delay for a post that never
 *                            happened, which implies one did.
 *
 * Only the first was ever measured. It was closed by giving the empty board a second line, and
 * the other two are that second line read against the two outcomes nobody drove through it.
 *
 * It is the launch case rather than a corner -- apps/api serves GET /api/top with `s-maxage=60`,
 * this screen re-reads the instant a post resolves, and on a fresh board the mount read has
 * already primed that cache with an empty one. A board that answers EMPTY to the read that follows
 * a post is exactly what production does for the first minute of its life, which is what this
 * route serves, for all three.
 *
 * THE DIVISION OF LABOUR. The property -- that no pairing of these two nodes asserts mutually
 * exclusive things -- is enumerated over every outcome against every board state in
 * test/board.test.ts, where the claims each line makes are declared and the pairing is checked
 * without a DOM. What a browser is for is the WIRING: that the screen really does render the pair
 * that model checked, as exact shipped sentences rather than as something near them. So these
 * assert equality against content/game.json, not a pattern over the words -- a regex over the
 * phrasing is the bound a reviewer already walked through once with a single reworded string.
 */
interface Outcome {
  what: string;
  /** What /api/score answers. `sent` is the body the page posted. */
  answer: (sent: { handle?: string }) => TopReply;
  /** The exact sentence `.otp-error` must then carry, built from the content file. */
  notice: (sent: { handle?: string }) => string;
}

const OUTCOMES: Outcome[] = [
  {
    what: 'a post the board takes',
    answer: (sent) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: sent.handle, score: 900 }),
    }),
    notice: (sent) => say('handleAssigned').replace('{handle}', sent.handle!),
  },
  {
    what: 'a run already on the board',
    answer: () => ({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that run is already on the board' }),
    }),
    notice: () => say('leaderboardAlready'),
  },
  {
    what: 'a post the board refuses',
    answer: () => ({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that submission is not valid' }),
    }),
    notice: () => say('leaderboardRefused'),
  },
];

for (const outcome of OUTCOMES) {
  test(`${outcome.what} never sits above a line that contradicts it`, async ({ page }) => {
    let sent: { handle?: string } = {};
    await page.route('**/api/score', async (route: Route) => {
      sent = JSON.parse(route.request().postData() ?? '{}') as typeof sent;
      await route.fulfill(outcome.answer(sent));
    });
    const board: Board = { reply: EMPTY_BOARD, calls: 0 };
    await serveBoard(page, board);

    await reachResults(page);
    // The launch board, before anyone has pressed Post: the invitation is the right thing to show,
    // and it is the one line on this screen that claims the board holds nothing. Nothing can
    // contradict it here, because no post notice exists yet.
    await expect(note(page)).toHaveText(say('boardEmpty'));
    await expect(page.locator('.otp-error')).toHaveCount(0);

    await post(page);

    // One half of each pair: the outcome's own sentence, exactly as the content file ships it.
    const status = page.getByRole('status');
    await expect(status).toHaveText(outcome.notice(sent));
    // The board read that followed it really did answer "empty" -- this is the state, not a dodge.
    await expect(note(page)).toHaveAttribute('data-board', 'empty');

    /*
     * And the other half: the line that asserts only what the read answered. Asserted as the
     * shipped sentence rather than as a pattern over its words, and asserted NOT to be the one
     * line that claims the board holds nothing, which is the claim all three of these collide with.
     */
    await expect(note(page)).toHaveText(say('boardEmptyAfterPost'));
    await expect(note(page)).not.toHaveText(say('boardEmpty'));

    const together = await page.evaluate(() => ({
      posted: document.querySelector('.otp-error')?.textContent ?? '',
      board: document.querySelector('.otp-board__note')?.textContent ?? '',
    }));
    expect(
      together.posted,
      'the post notice is not on screen, so nothing is being contradicted',
    ).not.toBe('');
    expect(
      [together.posted.trim(), together.board.trim()],
      'the rendered pair is not the pair test/board.test.ts enumerates',
    ).toEqual([outcome.notice(sent), say('boardEmptyAfterPost')]);

    await expectNoLime(page);
  });
}

/*
 * THE THIRD NODE, IN A BROWSER, WITH THE PLAYER'S OWN RUN ON THE BOARD.
 *
 * The block above drives every post outcome against an EMPTY board, which is the launch case and
 * is where `.otp-error` meets `.otp-board__note`. It cannot reach the third node at all: a row
 * only renders when the board answers with rows, so none of those runs ever put a sentence in
 * `.otp-board__row--you`.
 *
 * Measured on 2026-10-21 against a clean build, with a board answering a row under the page's own
 * handle, `.otp-error` and that row:
 *
 *   a 400                    "That run could not be posted."
 *                            "Rank 2. noble-acorn-93, 900 points. This is your run."
 *   a reply that times out   "The board was unavailable for that post."   (the then-shipped line)
 *                            "Rank 2. tidy-bellows-34, 900 points. This is your run."
 *   a 2xx the schema rejects the same pair, by a third route to the same notice
 *
 * The two fixes are different in kind and this block exists to hold both:
 *
 *   - the 400 is an exclusive pair -- `readerRunDidNotGoUp` against `readerRunIsOnBoard`, both
 *     long declared, never enumerated against each other. `boardRowKey` now declines the row's
 *     claim by asking `contradictions()`, so the row drops to the plain sentence.
 *   - the timeout and the rejected body are not: the run really IS on the board and the page
 *     really never learned. Nothing may be hidden there -- the row stays marked and the COPY
 *     moved, because "the board was unavailable" asserted something about a board that was
 *     plainly answering two lines down.
 *
 * As with the block above, these assert the EXACT shipped sentences out of content/game.json
 * rather than a pattern over the words. The claim algebra is enumerated without a DOM in
 * test/board.test.ts; this is the wiring.
 */
interface RowOutcome {
  what: string;
  /** What /api/score answers; `null` means it never answers at all. */
  answer: ((sent: { handle?: string }) => TopReply) | null;
  notice: (sent: { handle?: string }) => string;
  /** Whether the reader's row may still call itself theirs once that notice is on screen. */
  marked: boolean;
}

const ROW_OUTCOMES: RowOutcome[] = [
  {
    what: 'a post the board takes',
    answer: (sent) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: sent.handle, score: 900 }),
    }),
    notice: (sent) => say('handleAssigned').replace('{handle}', sent.handle!),
    marked: true,
  },
  {
    what: 'a run already on the board',
    answer: () => ({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that run is already on the board' }),
    }),
    notice: () => say('leaderboardAlready'),
    marked: true,
  },
  {
    what: 'a post the board refuses',
    answer: () => ({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'that submission is not valid' }),
    }),
    notice: () => say('leaderboardRefused'),
    marked: false,
  },
  {
    /*
     * A 2xx whose body the schema refuses. The server took the run -- it answered 200 -- and the
     * page cannot believe the reply, so it reports exactly that and nothing about the board.
     */
    what: 'a reply the schema cannot believe',
    answer: () => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: 'brave-lantern-42' }),
    }),
    notice: () => say('leaderboardDown'),
    marked: true,
  },
  {
    // The reply that never comes: the adapter's own timeout has to fire, so this one is slow.
    what: 'a reply that never comes',
    answer: null,
    notice: () => say('leaderboardDown'),
    marked: true,
  },
];

for (const outcome of ROW_OUTCOMES) {
  test(`${outcome.what} never denies the row the board is showing`, async ({ page }) => {
    test.slow();
    let sent: { handle?: string } = {};
    await page.route('**/api/score', async (route: Route) => {
      sent = JSON.parse(route.request().postData() ?? '{}') as typeof sent;
      // A route left unfulfilled is a request that never answers, which is the case under test.
      if (outcome.answer === null) return;
      await route.fulfill(outcome.answer(sent));
    });

    // The mount read finds nothing, so the handle can be read off the page before the board that
    // carries it is built. It is minted in the browser; there is no other way to build it.
    const board: Board = { reply: ABSENT_BOARD, calls: 0 };
    await serveBoard(page, board);
    await reachResults(page);
    await expect(note(page)).toHaveText(say('boardDown'));

    const mine = await page.locator('.otp-handle [data-handle]').getAttribute('data-handle');
    expect(mine).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
    const others = tenRows(mine!);
    board.reply = rowsReply([
      others[0]!,
      { rank: 2, handle: mine!, score: 900 },
      ...others.slice(2),
    ]);

    await post(page);

    // The post's own sentence, exactly as the content file ships it, and the read that followed
    // really did come back with rows -- this is the state, not a dodge.
    const status = page.getByRole('status');
    // The reply that never comes has to wait out the adapter's own abort, which is longer than
    // the default expect timeout. The bound is read from the adapter, not typed here.
    await expect(status).toHaveText(outcome.notice(sent), {
      timeout: ADAPTER_TIMEOUT_MS + 9000,
    });
    await expect(note(page)).toHaveAttribute('data-board', 'rows');
    await expect(page.locator('.otp-board__row')).toHaveCount(10);
    // The row carrying the page's handle is on screen either way. Nothing is ever hidden.
    await expect(page.locator('.otp-board__row').nth(1)).toContainText(mine!);

    const yours = page.locator('.otp-board__row--you');
    await expect(yours).toHaveCount(outcome.marked ? 1 : 0);

    const together = await page.evaluate(() => ({
      posted: document.querySelector('.otp-error')?.textContent ?? '',
      row: document.querySelector('.otp-board__row--you .otp-visually-hidden')?.textContent ?? null,
      second:
        document.querySelectorAll('.otp-board__row')[1]?.querySelector('.otp-visually-hidden')
          ?.textContent ?? '',
    }));
    expect(
      together.posted,
      'the post notice is not on screen, so nothing is being contradicted',
    ).not.toBe('');
    const sentence = (key: string): string =>
      say(key).replace('{rank}', '2').replace('{handle}', mine!).replace('{score}', '900');
    // The rendered pair, in full. Either the row claims the run and the notice does not deny it,
    // or the row says only what the board shows.
    expect([together.posted.trim(), together.row]).toEqual([
      outcome.notice(sent),
      outcome.marked ? sentence('boardRowYou') : null,
    ]);
    expect(together.second.trim()).toBe(sentence(outcome.marked ? 'boardRowYou' : 'boardRow'));

    await expectNoLime(page);
  });
}

/*
 * THE NOTE TURNS OVER BEFORE THE REQUEST LANDS, AND THAT IS DELIBERATE -- so what it turns over TO
 * has to be true of a post whose fate nothing yet knows.
 *
 * `attempted` is set at the press rather than after the reply, because waiting leaves a window,
 * however many ticks wide, in which "Posted to the board as ..." can paint above "Yours would be
 * the first" -- which is the first defect coming back. The cost is this moment: a board note that
 * has already changed while `.otp-error` is still absent. Measured here with the reply held open.
 *
 * The old line made that moment a lie: it hedged that a run posted in the last minute might not be
 * showing, for a post that had not been answered and might never go up. The line it turns over to
 * now reports the read and explains the lag as the board's, which is true before the reply, after a
 * refusal and after a success alike.
 */
test('the line the note turns over to is true before the post is answered', async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/score', async (route: Route) => {
    await held;
    await route
      .fulfill({ status: 400, contentType: 'application/json', body: '{"error":"no"}' })
      .catch(() => undefined);
  });
  const board: Board = { reply: EMPTY_BOARD, calls: 0 };
  await serveBoard(page, board);

  await reachResults(page);
  await expect(note(page)).toHaveText(say('boardEmpty'));

  await post(page);
  await page.waitForTimeout(500);

  // Nothing has been answered, so nothing is in .otp-error -- this is the moment the review found.
  await expect(page.locator('.otp-error')).toHaveCount(0);
  // And the note has already turned over. What it turned over to may not claim the reader has a
  // run pending, because the reply that is still in flight is about to say they do not.
  await expect(note(page)).toHaveText(say('boardEmptyAfterPost'));
  await expect(note(page)).not.toHaveText(say('boardEmpty'));

  release();
  await expect(page.getByRole('status')).toHaveText(say('leaderboardRefused'));
  await expect(note(page)).toHaveText(say('boardEmptyAfterPost'));
});

/*
 * TWO READS IN FLIGHT SETTLE BY ISSUE ORDER, NOT BY ARRIVAL ORDER.
 *
 * Reproduced here before it was fixed: every call to `readBoard()` closed over its own private
 * `live` flag and nothing invalidated the call before it, so a slow older answer overwrote a fast
 * newer one. The sequence below is the reproduction, in the order it was found --
 *
 *   call 1  mount      answers at once with an absent board, so the retry renders
 *   call 2  the retry  HELD OPEN, holding ten rows
 *   call 3  the post   answers at once with an empty board
 *   then    call 2 is released, and its ten rows arrive last
 *
 * -- and a board showing ten rows at the end of it is a board showing a state the server has
 * already contradicted. The ordering rule itself is unit-tested in test/board.test.ts, where
 * `boardReads()` is pure; this is the half that needed a real browser and three real requests.
 */
test('a slow older board read cannot overwrite a fast newer one', async ({ page }) => {
  test.slow();
  let calls = 0;
  let delivered = false;
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        handle: (JSON.parse(route.request().postData() ?? '{}') as { handle: string }).handle,
        score: 900,
      }),
    }),
  );
  await page.route('**/api/top*', async (route: Route) => {
    calls += 1;
    if (calls === 1) return route.fulfill(ABSENT_BOARD);
    if (calls === 2) {
      await held;
      await route.fulfill(rowsReply(TEN)).then(
        () => {
          delivered = true;
        },
        () => undefined,
      );
      return;
    }
    return route.fulfill(EMPTY_BOARD);
  });

  await reachResults(page);
  await expect(note(page)).toHaveText(say('boardDown'));

  // Call 2: the older read, held open with rows on it.
  const heldFrom = Date.now();
  await page.getByRole('button', { name: say('boardRetry'), exact: true }).click();
  await expect(note(page)).toHaveAttribute('data-board', 'loading');

  // Call 3: the newer read, answered at once, while call 2 is still in flight.
  await post(page);
  await expect(note(page)).toHaveAttribute('data-board', 'empty');
  expect(calls, 'the post did not re-read the board').toBe(3);

  /*
   * THE RUN ONLY PROVES SOMETHING IF CALL 2 WAS STILL ALIVE. The adapter gives up on a request at
   * its own timeout, read out of its source rather than typed here; past that, call 2 comes back as
   * `unavailable` on its own and there is no race left to lose. A starved run skips rather than
   * passing on a collision that never happened (docs/PAUL_BRIEF.md trap 6).
   */
  const heldFor = Date.now() - heldFrom;
  test.skip(
    heldFor >= ADAPTER_TIMEOUT_MS,
    `the held read was abandoned after ${heldFor}ms, so no two reads were ever in flight`,
  );

  release();
  await expect.poll(() => delivered).toBe(true);
  // Long enough for the stale answer to be parsed and applied, if anything still would.
  await page.waitForTimeout(400);

  await expect(note(page), 'a stale read overwrote a newer one').toHaveAttribute(
    'data-board',
    'empty',
  );
  await expect(page.locator('.otp-board__row')).toHaveCount(0);
  await expect(note(page)).toHaveText(say('boardEmptyAfterPost'));
});

/*
 * THE HEADLINE TEST. A 200 that is not a board must not read as a board with nothing on it.
 *
 * This is the behaviour the product will actually show today, because /api/top still 404s in
 * production, and it is correct: the first time this asset says out loud that the board is not
 * there instead of silently showing nothing.
 */
test('a board that is not there says so, and never says it is empty', async ({ page }) => {
  const board: Board = { reply: ABSENT_BOARD, calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);

  await expect(note(page)).toHaveText(say('boardDown'));
  await expect(note(page)).toHaveAttribute('data-board', 'unavailable');
  await expect(note(page), 'an absent board reported as an empty one').not.toHaveText(
    say('boardEmpty'),
  );
  await expect(page.locator('.otp-board__rows')).toHaveCount(0);
  // The player's score is still on the screen in front of them, which is what the line promises.
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  /*
   * THE STATE PRODUCTION RENDERS TODAY, swept for Lime for the first time. It was never swept
   * before -- the sweep ran in the two states that have rows -- so it was safe by luck.
   */
  await expectNoLime(page);
});

/*
 * THE TWO CONTROLS IN THE STATE EVERY VISITOR CURRENTLY SEES.
 *
 * With /api/top still 404ing, `unavailable` is what production renders, and in it "Ask the board
 * again" and "Walk it again" shipped with the SAME class string, the same height and the same Deep
 * Purple outline on no fill, 15.4px apart. One re-reads a list. The other throws the finished run
 * away and restarts the game. A player reaching for the first and hitting the second loses the
 * score they are looking at.
 *
 * Measured rather than asserted by class name: two controls that differ only in the markup are not
 * differentiated for anybody actually looking at the screen. The screen's one Lime is spent on the
 * research call to action, so neither of them may become the bright thing.
 */
test('the retry and the restart do not look like the same control', async ({ page }) => {
  const board: Board = { reply: ABSENT_BOARD, calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);
  await expect(note(page)).toHaveText(say('boardDown'));

  const look = (selector: string): Promise<Record<string, string>> =>
    page.locator(selector).evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        background: style.backgroundColor,
        color: style.color,
        border: `${style.borderTopWidth} ${style.borderTopColor}`,
        underline: style.textDecorationLine,
        radius: style.borderTopLeftRadius,
      };
    });

  const retry = await look('.otp-board__retry button');
  const restart = await look('.otp-actions button');

  // Not one difference that a reviewer could call a shade: ground, outline and shape all move.
  expect(retry.color, 'the two controls still take the same colour').not.toBe(restart.color);
  expect(retry.border, 'the two controls still carry the same outline').not.toBe(restart.border);
  expect(
    restart.underline,
    'the restart is still a pill, not the footer link the deck draws',
  ).toContain('underline');
  expect(retry.underline).not.toContain('underline');

  // And neither of them has become the screen's second Lime.
  expect([retry.background, retry.color, retry.border]).not.toContain(LIME_RGB);
  expect([restart.background, restart.color, restart.border]).not.toContain(LIME_RGB);

  // Both are still real controls a thumb can hit: 44px is the floor every control here keeps.
  for (const selector of ['.otp-board__retry button', '.otp-actions button']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.height, `${selector} is under the touch floor`).toBeGreaterThanOrEqual(44);
  }
});

test('the retry asks the board again, and your own row is marked when it arrives', async ({
  page,
}) => {
  const board: Board = { reply: ABSENT_BOARD, calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);
  await expect(note(page)).toHaveText(say('boardDown'));
  expect(board.calls).toBe(1);

  /*
   * The handle is minted on this screen and never typed, so the only way to build a board with
   * YOUR row on it is to read the name the page is showing and answer with it. That is also the
   * honest shape of the claim: your row is matched locally against that value and nothing extra
   * goes over the wire to find it.
   */
  const mine = await page.locator('.otp-handle [data-handle]').getAttribute('data-handle');
  expect(mine).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
  const others = tenRows(mine!);
  board.reply = rowsReply([
    ...others.slice(0, 2),
    { rank: 3, handle: mine!, score: 900 },
    ...others.slice(3),
  ]);

  await page.getByRole('button', { name: say('boardRetry'), exact: true }).click();

  await expect(note(page)).toHaveText(say('boardReady'));
  expect(board.calls, 'the retry did not re-request the board').toBe(2);
  await expect(page.locator('.otp-board__row')).toHaveCount(10);

  /*
   * AND NOTHING IS MARKED YET, WHICH IS THE HALF THIS TEST ASSERTED THE WRONG WAY ROUND.
   *
   * It used to stop here and check that rank 3 said "This is your run." -- with no post made. The
   * page has sent nothing, so a row carrying the name it is showing is NECESSARILY somebody
   * else's: the mint has 3,072 names, the board shows ten, and about one visitor in three hundred
   * would have been told a stranger's run was theirs before touching the button. The fixture only
   * made that look like a match because it was built by reading the page's own handle.
   */
  await expect(
    page.locator('.otp-board__row--you'),
    'a run under your name is not your run until you have posted one',
  ).toHaveCount(0);
  await expect(page.locator('.otp-board__row').nth(2).locator('.otp-visually-hidden')).toHaveText(
    say('boardRow').replace('{rank}', '3').replace('{handle}', mine!).replace('{score}', '900'),
  );
  await expectNoLime(page);

  // Now post it, which is what earns the claim. The board already holds the row, so the read that
  // follows the press is the one that marks it.
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: mine, score: 900 }),
    }),
  );
  await post(page);
  await expect(page.getByRole('status')).toHaveText(
    say('handleAssigned').replace('{handle}', mine!),
  );
  expect(board.calls, 'the post did not re-read the board').toBe(3);

  const yours = page.locator('.otp-board__row--you');
  await expect(yours).toHaveCount(1);
  await expect(yours).toContainText(mine!);
  // Said in words, not by fill alone, and read as a sentence rather than three columns.
  await expect(yours).toContainText(say('boardYouLabel'));
  await expect(yours.locator('.otp-visually-hidden')).toHaveText(
    say('boardRowYou').replace('{rank}', '3').replace('{handle}', mine!).replace('{score}', '900'),
  );
  // And the row above it is somebody else's, read as the other sentence.
  await expect(page.locator('.otp-board__row').nth(1).locator('.otp-visually-hidden')).toHaveText(
    say('boardRow')
      .replace('{rank}', '2')
      .replace('{handle}', others[1]!.handle)
      .replace('{score}', '950'),
  );

  // Your row is a Lilac fill, and Lilac is not Lime: the one state the sweep above cannot reach.
  await expectNoLime(page);
});

/*
 * The live-region property, which is the one an eye cannot check and a screenshot cannot show.
 *
 * A region inserted into the DOM already containing its text is never announced: screen readers
 * announce MUTATIONS to a region that was already there. The naive `{loading && <p …>}` build
 * announces nothing at all, and it looks identical. So the status line is mounted for the life of
 * the section and only its text changes -- which is a claim about NODE IDENTITY, and the way to
 * check it is to mark the node and see whether the mark survives the state change.
 */
test('the board speaks through one region that is never replaced', async ({ page }) => {
  const board: Board = { reply: ABSENT_BOARD, calls: 0 };
  await serveBoard(page, board);
  await reachResults(page);
  await expect(note(page)).toHaveText(say('boardDown'));

  await note(page).evaluate((el) => el.setAttribute('data-same-node', 'marked'));

  board.reply = EMPTY_BOARD;
  await page.getByRole('button', { name: say('boardRetry'), exact: true }).click();
  await expect(note(page)).toHaveText(say('boardEmpty'));

  // Still one region, still the node that was marked: the text mutated, the element did not go.
  await expect(page.locator('.otp-board__note')).toHaveCount(1);
  await expect(note(page)).toHaveAttribute('data-same-node', 'marked');
  await expect(note(page)).toHaveAttribute('aria-live', 'polite');
  await expectNoLime(page);
});

/*
 * The three reviewed widths, with a FULL board actually on the page.
 *
 * The preview build answers /api/top with a 404, so every other spec that reaches Results sees the
 * `unavailable` state and measures a section with one sentence in it. The row -- disc, handle,
 * "Your run" chip, score, all in one flex line -- only exists when the board answers, and 375px
 * with `--otp-ui` at 0.7 is where it has the least room. So the widths are measured here, in the
 * state that has something to overflow.
 */
for (const width of [375, 768, 1280] as const) {
  test(`a full board fits the panel it sits in at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/');
    await ready(page);

    const board: Board = { reply: ABSENT_BOARD, calls: 0 };
    await serveBoard(page, board);
    await reachResults(page);
    /*
     * WAIT FOR THE FIRST READ TO LAND BEFORE SWAPPING THE REPLY. The route handler reads
     * `board.reply` when the request reaches it, not when it was registered, so mutating it while
     * the mount's read is still in flight serves the rows to that read instead -- and the retry
     * button this test then clicks never renders. That is what happened at 375px, where the page
     * is slowest, and it was a race in the test rather than anything the product did.
     */
    await expect(note(page)).toHaveText(say('boardDown'));
    expect(board.calls).toBe(1);

    // Your row is the widest one: it carries the chip the other nine do not.
    const mine = await page.locator('.otp-handle [data-handle]').getAttribute('data-handle');
    const others = tenRows(mine!);
    board.reply = rowsReply([
      ...others.slice(0, 2),
      { rank: 3, handle: mine!, score: 1000 },
      ...others.slice(3),
    ]);
    /*
     * POSTED, not retried, and that is what gets the chip on the page. A row only calls itself
     * the reader's once this page has posted that name -- before the press the page has sent
     * nothing, so a row carrying its handle is somebody else's (see `boardRowKey`). The press
     * re-reads the board, so it brings the rows in as well and the retry click it replaced is
     * covered by the test that owns the retry.
     */
    await page.route('**/api/score', (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ handle: mine, score: 1000 }),
      }),
    );
    await post(page);
    await expect(page.locator('.otp-board__row')).toHaveCount(10);
    await expect(page.locator('.otp-board__row--you')).toHaveCount(1);

    const body = (await page.locator('.otp-screen__body').boundingBox())!;
    for (const row of await page.locator('.otp-board__row').all()) {
      const box = (await row.boundingBox())!;
      // A sub-pixel tolerance, because the panel body's own width is fractional at --otp-ui 0.7.
      expect(box.x, `a row starts left of the panel at ${width}px`).toBeGreaterThanOrEqual(
        body.x - 1,
      );
      expect(box.x + box.width, `a row runs past the panel at ${width}px`).toBeLessThanOrEqual(
        body.x + body.width + 1,
      );
    }

    /*
     * The disc keeps the floor the stylesheet puts on it. `--otp-ui` scales type and spacing
     * together, so at 0.7 an unfloored 26px disc lands at 18.2px with a numeral inside it -- which
     * is the defect the floor rule at the head of panels.css exists for.
     */
    const disc = (await page.locator('.otp-board__rank').first().boundingBox())!;
    expect(disc.width, `the rank disc is under its floor at ${width}px`).toBeGreaterThanOrEqual(22);
    expect(disc.height).toBeGreaterThanOrEqual(22);

    // And the handle is still in the row rather than clipped out of it.
    const handle = (await page.locator('.otp-board__row--you .otp-board__handle').boundingBox())!;
    const yours = (await page.locator('.otp-board__row--you').boundingBox())!;
    expect(handle.width).toBeGreaterThan(0);
    expect(handle.x + handle.width).toBeLessThanOrEqual(yours.x + yours.width + 1);
  });
}

/*
 * VERTICAL RHYTHM, WHICH NOTHING IN THIS SUITE MEASURED.
 *
 * The three width tests above measure horizontal overhang -- does a row run past the panel -- and
 * that is all they measure. So "Wolf Spotters" shipped with a gap above it of 0.0px at 375, 768 AND
 * 1280: the heading sat flush against the privacy line, through a review at every width the project
 * reviews at, because no test in the suite could see it.
 *
 * The cause was structural rather than a missing margin. `h2.otp-section-label` zeroes the 24px top
 * margin `.otp-section-label` carries (it is undoing the user agent's h2 margins), and `.otp-fine`
 * and `.otp-error` -- the two paragraphs that can precede the board -- both end at
 * `margin-bottom: 0`. The only separation in play was `.otp-board`'s own `margin-top`, and with the
 * heading rendered OUTSIDE the section that margin fell between the heading and the board instead
 * of above the heading.
 *
 * The floor comes from the drawing, not from the rule being guarded: a heading needs at least its
 * own type size of air above it to read as a break rather than as the last line of the paragraph
 * before it. Asserting the margin value instead would move with the defect and pass in silence.
 */
for (const width of [375, 768, 1280] as const) {
  test(`the board heading is separated from what precedes it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/');
    await ready(page);

    const board: Board = { reply: ABSENT_BOARD, calls: 0 };
    await serveBoard(page, board);
    await reachResults(page);
    await expect(note(page)).toHaveText(say('boardDown'));

    /*
     * Measured WITHOUT assuming the structure, so that the number is what fails rather than a
     * selector. Whatever precedes the heading in document order is whatever the player sees
     * directly above it -- the fine print when the heading sits in the section, and the same fine
     * print one level up when it does not -- so the measurement is the same question either way
     * and reports the gap it found.
     */
    const measured = await page.evaluate(() => {
      const heading = document.getElementById('otp-board-heading')!;
      const before = (heading.previousElementSibling ??
        heading.parentElement!.previousElementSibling)!;
      const note = document.querySelector('.otp-board__note')!;
      return {
        above: heading.getBoundingClientRect().top - before.getBoundingClientRect().bottom,
        below: note.getBoundingClientRect().top - heading.getBoundingClientRect().bottom,
        type: parseFloat(getComputedStyle(heading).fontSize),
        precededBy: before.className,
      };
    });

    expect(measured.precededBy, 'the board no longer follows the fine print').toMatch(/otp-/);
    expect(
      measured.above,
      `the heading has ${measured.above.toFixed(1)}px above it at ${width}px`,
    ).toBeGreaterThanOrEqual(measured.type);
    // And the air did not simply move: the heading still stands off its own status line.
    expect(measured.below).toBeGreaterThan(0);

    // The fix that produced the gap: the heading names the section from inside it.
    await expect(page.locator('.otp-board > .otp-board__title')).toHaveCount(1);
  });
}
