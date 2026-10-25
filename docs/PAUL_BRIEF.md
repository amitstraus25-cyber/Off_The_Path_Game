# Paul's standing brief

**Read this first, every round.** It is the state of the world and the list of traps. It exists
because the same mistakes kept costing whole rounds, and because a reviewer who measures the wrong
thing confidently is more expensive than one who finds nothing.

Last updated: 2026-10-22, at `e2f7e7f` (no code has changed since `3c88684`; the commits after it
are docs), after the client's rounds of that day (the cabinet, speed scoring, typed names, the
minimap and door, the seven perks, the work email). Before that,
2026-10-21, after the client round that found the stale checkout (trap 10) and the debug handle
that was shipping to players. Read trap 10 before investigating anything the client reports seeing.

---

## 1. What is true right now

- The game is live at `off-the-path-game.vercel.app`, embedded-ready, `frame-ancestors` locked to
  `cyera.com`, `*.cyera.com` and `cyera-staging.webflow.io` (added 2026-10-25), and "Read the
  research" posts `OFF_THE_PATH_READ_RESEARCH` to an allowed parent instead of navigating
  (ARCHITECTURE section 9).
- The suite is **1,151 tests passing and 1 skipped** (run 2026-10-22 on `e2f7e7f`, each workspace
  on its own with its exit code taken separately, all 0) — `packages/core` 348 in 13 files and
  `apps/api` 202 in 12, both at a 100% gate on statements, branches, functions AND lines (core
  689/385/159/566, api 367/238/56/320); `apps/game` 484 plus 1 skipped in 30 files; `tools/graybox`
  117 in 5 (no coverage gate; it gates on art measurements) — plus **335 e2e** in 33 files
  (`playwright test --list`, which counts the specs that skip; **run in full on 2026-10-22 on a
  `git archive` copy of `e2f7e7f`, its own port, Chromium 1228, two workers,
  `--fail-on-flaky-tests`: 329 passed and 6 skipped, exit 0, 4.7 minutes**. A first attempt
  failed on every spec with `ERR_CONNECTION_REFUSED` after the preview server was killed under it:
  trap 9's starvation, not a defect, and the pass above had a supervised server. That run covers
  the committed tree only, not the uncommitted work below). The
  figures this section carried earlier on 2026-10-22 (681 and 211) predate the day's later
  rounds (trap 11). The game is v2 only; `pnpm sim` plays the four v2
  strategies (`careful`, `greedy`, `leave-all`, `random`).
- The live game: seven characters in walking order, each offering one skill with a real in-game
  effect that is the same in the good and the bad copy; every run deals 3 good and 4 bad from a
  seed; take it or leave it; a 3:00 hard timer; score out of 100 = correct choices plus speed (par
  1:47); a door check; a flip-tile reveal; typed names; a leaderboard; a work-email gate that is
  built and OFF. All of it is committed (the tree was clean at `3c88684`). **Not clean now:**
  another builder's round is in the checkout, uncommitted -- `ui/cabinet.ts`, `hud.css`,
  `panels.css`, `stage.ts`, `world/forest-scene.ts`, `world/logic.ts`, two graybox painters, edits
  to `test/cabinet.test.ts`, `e2e/hud.spec.ts` and `e2e/offer.spec.ts`, and new
  `e2e/talk-bubble.spec.ts` and `test/talk-bubble.test.ts` (read off `git status`; nobody here has
  read those diffs). The unit counts above were taken at the start of this round, before
  `test/talk-bubble.test.ts` appeared, and equal the counts at `e2f7e7f`; they will move when that
  work lands, so measure again then (trap 2).
- The art generator is deterministic: `pnpm graybox` regenerates `map-forest.json` byte-identical
  unless a painter changed. That property is the proof standard for every art change.
- Phase 6 (the leaderboard) exists: `apps/api`, score recomputed server-side from the run log.
  **Two things that sentence used to say are no longer true:** names are typed (checked by
  `v2.checkName`, since 2026-10-22), and "two columns and a test that a third cannot arrive" holds
  only for `public.leaderboard` — behind `OTP_WORK_EMAIL`, a work email lives in a second table
  (`leaderboard_contact`, migration 0007, not run) that the service can write and cannot read.

## 2. The client's open list

Their words, their order. Anything not here is not a priority this week.

| #   | Item                                                                 | State                                                                                                                      |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | The line / "lagginess"                                               | **Three causes, all fixed.** Two one-pixel holes; the stale checkout (trap 10); the camera top edge cutting a canopy row.  |
| 2   | Trees in the middle look messed up                                   | **Done.** Brick course gone, trunks and root flares, crowns merge. Squared flank lobe survives at 8x only — gid round.     |
| 3   | Purple's back view                                                   | **Close.** Front and sides shippable. The Cyera-symbol trace on her back is in (`8c4dc49`) and awaits brand sign-off.      |
| 4   | Inspect card: three verbs, three explanations, nothing else, branded | **Done in v1, superseded in v2:** two verbs (Take it / Leave it) on a card that opens by itself (`3e2473e`).               |
| 5   | Leaderboard not working                                              | **Built, shown, and deployed through the Build Output API (§5).** Unmeasured on production since v2; rate limit open.      |
| 6   | Phone: goals panel eats the screen                                   | **Done.** A 44px bar that taps open: ~5% of the screen against ~16%. Verified by touch.                                    |
| 7   | Phone: three circled glitches                                        | **Closed.** The clipped canopy row is fixed with #1; the stall is measured and accepted — it cannot be moved out of frame. |
| 8   | Arcade-cabinet shell, Cyera themed                                   | **Answered: cabinet everywhere (reversed 2026-10-22 on the client's word).** §8 keeps the argument as constraints.         |
| 9   | Results block: "nicer and more branded"                              | **Done.** All four faults in §6 fixed; a guard now bans static inline styles.                                              |
| 10  | The gate (fence)                                                     | **Done.** `gate-n` and `gate-s` in `tools/graybox/src/tiles.ts` (`840daab`); PLAN.md lists it done.                        |

Since this table was written the client has had a further round of asks on 2026-10-22 — the
cabinet as the presentation, speed in the score, typed names, "I can't find the character" (the
minimap and the door), seven skills that each do something, a work email to post — and every one is
built and committed; `docs/PLAN.md` "Progress at a glance" is the board for them and for what still
waits on the client.

## 3. The traps that have actually cost rounds

Each of these happened. None is hypothetical.

1. **A fact stated in a comment instead of derived in code.** A camera size written as
   "about 26 x 15 tiles" — the field of view of an _abandoned_ zoom option — sent three rounds of
   composition at a rectangle a third too big. Then the size was fixed and the ORIGIN was left
   hand-rolled, so the next round was aimed one row high. **A rectangle has four numbers; publishing
   two of them is not publishing the rectangle.** Everything now comes from `cameraFor()`.
2. **Measuring committed HEAD instead of the working tree.** Four section chiefs independently led
   with a blocker that had already been fixed. Measure what is in front of you.
3. **Reading CI and not the deployment.** A `"framework": null` in `vercel.json` failed schema
   validation, which failed _every_ deployment for six hours. The client was looking at a build six
   hours old while we debugged a bug that had already been fixed. **A deploy that fails is louder
   than a test that fails.** Check the deployment, not just the pipeline.
4. **Guarding the size and ignoring the position.** `the canvas keeps whole device pixels per game
pixel` passed happily while the canvas sat on a half pixel. Same shape as trap 1.
5. **A guard whose bound is written in terms of the thing it guards.** It moves with the defect and
   passes in silence. Bounds come from the drawing, never from the constant.
6. **A test that proves nothing and fails anyway.** The modal-guard repro needs a pill under a fixed
   pointer; where the geometry does not put one there, the run proves nothing. It skips now.
7. **`cmd | tail -1` reports tail's exit code.** This has fooled five people including the
   maintainer. Run the command, then `echo $?`.
8. **Playwright says 1243; this machine has 1228.** Every launch fails and reads as 40+ broken
   tests. Set `CHROMIUM_PATH`. This has looked like a red suite five separate times.
9. **A red suite under load is not a red suite.** At load average 81 specs fail on ready-state
   timeouts with zero assertion failures. A ready-state timeout is starvation; an assertion failure
   is a defect. Say which you are looking at. CI runs `--fail-on-flaky-tests`, so a genuinely slow
   test must be declared `test.slow()` rather than left to retry.
10. **The client was reviewing a different repository, for days.** This is the most expensive trap
    on the list and it is the one nobody thought to check. A second checkout at
    `~/Desktop/Cyera/games/off the path` — remote `off_the_path.git`, against this repo's
    `Off_The_Path_Game.git`, HEAD `ebb9d0b`, an object that **does not exist here at all** — was
    still serving the game on `:5173`, `:5174` and `:4190`, from a build dated two days before the
    hole fixes landed. `:5173` is the default port `pnpm dev` prints, so it is what anybody opens by
    habit. That build has Purple in a **red** cloak, flat blob trees, and a measurable dark column down
    the left edge (122 magenta pixels, all in column 0). The current build measures 0 across 49
    configurations.

    So three separate client complaints — "still have the lags", "the trees are messed up", "then we
    have red" — had one shared cause that no amount of reading our own code could ever have found.
    Rounds were spent fixing things that were already fixed.

    **Before investigating any visual complaint, establish which URL the reporter is looking at.**
    Not which branch, not which commit — which _process_, on which _port_, from which _checkout_.
    `lsof -a -p <pid> -d cwd -Fn` gives a listening server's working directory, and
    `git -C <dir> remote -v` tells you whether it is even the same project. The three stale servers
    were killed on 2026-10-21. If a visual report ever disagrees with a measurement again, check
    this _first_, not last.

11. **A number typed into a document is a claim nobody re-measures.** This brief said 681 tests,
    GAME_DESIGN_V2 said the tightest deal arrived with 4.3 seconds to spare on 107 tiles, and
    apps/api's README said par was 1:45. Measured on 2026-10-22: 1,151 tests; the tour is 113 tiles,
    the tightest deal arrives with **1.1 seconds** to spare with no perk helping (2.0 with the
    careful basket's perks), and par is 1:47. The 1.1 is the number to watch: one card that grows by
    a few words moves it. Re-run the suite and read the figure off it, take each exit code on its
    own line (trap 7), and when a number cannot be derived, write the date and the commit beside it.

## 4. The rules of a round

- **Staffing: the top model is for judgment, not for labour.** Set by the client 2026-10-21. Only
  the orchestrator, this gate, synthesis and completeness critics, refuters on judgment lenses
  (honesty, regression, "does it read"), spec and design agents, and builders whose brief leaves a
  design decision open run on the session model (Opus 5.5). Builders working from a decided spec,
  measurement and reproduction agents, and anyone re-running a suite to check exit codes run on
  **Sonnet**. Pure grunt — grep, count, list, extract, format — runs on **Haiku**. The reason is
  this project's own record: every failure that cost a round was a judgment failure, never a
  failure to count. When unsure, staff the cheaper tier and put the judgment in a top-tier
  refuter.
- **File ownership is the whole mechanism.** Two owners never share a file. It is why 460 agents
  have not trodden on each other. Merge the tasks or sequence them and say so.
- **One owner regenerates.** Painters commit source only; exactly one task runs `pnpm graybox` and
  verifies cell by cell that every changed tile is claimed by a named owner. A cell nobody claims is
  a defect.
- **Every fix ships a guard, proved by breaking the fix** and watching the right message fire, then
  restoring and verifying with `cmp`.
- **Reviewers say when something is fine.** A clean bill stops the next round searching there.
- **Refusing a task is a correct outcome** when it would weaken something on the do-not-weaken list.
- **Long docstrings recording failed experiments are the most valuable artefact in this repo.** They
  are why nobody re-runs a disproven idea. Do not shorten them to make a file smaller. 4,278 of
  `forest-map.ts`'s 7,548 lines are JSDoc and that is correct.

## 5. The leaderboard, precisely

**Current state, 2026-10-22, at `3c88684` (the route code is unchanged at `e2f7e7f`) -- this supersedes everything below it in this section.**
Three routes are bundled by `vercel-output.mjs`, which reads them off `apps/api/api/`: `start`,
`score`, `top`. The service scores **v2** runs only; a v1 log is a 400, and v1 itself is gone from
the repo.

- `POST /api/start` answers `{ seed, token, emailRequired }`: an HMAC over the seed and the start
  time, nothing stored, its own per-instance budget (120 a minute).
- `POST /api/score` takes `{ handle, log, token }` (plus `{ email, consent }` when
  `OTP_WORK_EMAIL=required`; ignored and stored nowhere otherwise). It checks the name first
  (`v2.checkName`; names are typed), then the contact when the flag is on, then replays the log
  against the token's seed and recomputes the score. **Every ending posts** since the client's floor of
  2026-10-25: a late run and a wolf run are stored at `scoring.played` (25); from 2026-10-22 until
  then they were refused (400, and 422 `reason: 'wolf'`). **Every meeting and the arrival must be stamped no sooner than the
  straight-line walk the log describes** (`v2.walkFloor`, core `floor.ts`, perks included), and the
  time since the token must cover the walk; this replaced the flat 10 s `MIN_RUN_MS` in `8c4dc49`.
  A post more than five minutes off the game clock is a 410. One token is one row (409), per
  instance. Thirty writes a minute per instance, then 429.
- `GET /api/top` answers the top ten, rows from `BOARD_SINCE` (2026-10-25T13:40:00Z, the client's reset for the 25-point floor; before
  it 2026-10-22T21:25:00Z, the reset for speed, first set at 09:25Z; it replaced the v2-launch cut) and above 0, cached 10 s plus 20 s stale,
  so never more than 30 s old. The post's own answer carries its rank and the board, so a player
  sees their row at once.
- The discriminators: `GET /api/start` and `GET /api/score` answer **405 `Allow: POST`** when
  mounted, 404 when no function exists, 500 `FUNCTION_INVOCATION_FAILED` when it crashed on load;
  `POST /api/start` with `{}` as JSON is **200 `{seed, token, emailRequired}`** with the environment
  set and 503 without it.

**Nothing here has been measured against production since the v2 deploy, and this update did not
measure it either (the sandbox this was written in denies `curl`). Do that first.** The tests that
stand in for it are `apps/api`'s 202 at a 100% gate, run against a fake `fetch`: no test reaches
Supabase and none can from this checkout.

**What only a human can do, in the order it unblocks things** (`apps/api/README.md` and
`docs/PLAN.md` "Waiting on you" carry the detail): the Vercel firewall rate limit on `/api/*`, on and
proved on a preview, before the board is public; `supabase/migrations/0006_clear_v1_rows.sql`
(deletes the v1 rows; the board already hides everything older than `BOARD_SINCE`, so it is
housekeeping); and the work email's three steps — migration `0007`, Legal's sign-off (D10 is
reopened), then `OTP_WORK_EMAIL=required` and a redeploy. Until the last, the game behaves exactly
as at `8c4dc49`, and doing it before the migration makes every post answer 503. The measurements
below are 2026-10-21 and v1-era; keep them for the history of the Vercel arrangements, not as the
state of the world.

**History, 2026-10-21 (superseded by the 2026-10-22 block above -- do not act on it).** Kept for
the record of the Vercel arrangements. Almost every bullet below is false now: functions are
mounted, `services` is gone, the routes bundle their imports, `apps/game/api/` no longer exists,
and Results calls `readTop`. **One line is still outstanding: the Vercel firewall rate limit on
`/api/*` (the last bullet), which nobody has turned on or proved.** As written then: the deploy is the Build
Output API written by `apps/game/scripts/vercel-output.mjs`: the routes in `apps/api/api/` are
bundled into self-contained CommonJS and Vercel compiles none of our TypeScript. The three earlier
arrangements below each failed and are recorded so nobody re-runs them. The last one produced
functions that crashed on load because Vercel compiled `.ts` specifiers with its own settings
(TS5097 in the BUILD log); that is what the bundling fixes.

Measured against production, not assumed:

- `GET /` → 200, and the CSP from `vercel.json` **is** live. So the file is read and the `game`
  service works.
- `GET /api/top` → **404, and it is Vercel's own NOT_FOUND page**, not a 500 from our code. The
  route does not exist on the deployment. That rules out the content-import theory, which would
  have thrown at cold start and returned 500.
- **`GET /api/score` is the discriminator, and it settles it.** `handleScore` answers a non-POST
  with `405 {"error":"method not allowed"}` and an `Allow: POST` header. Production returns 404.
  A 404 where our own code would have answered 405 is **positive proof that no function is mounted**
  — the request never reaches a line we wrote. This needs no response body and no second deploy,
  and it is a better test than comparing 404 pages.
- `"framework": null` failed schema validation outright and is removed. Deployments succeed now.
- **The likely root cause, and it changes the fix:** `services` is a **gated** Vercel feature —
  their own schema marks it `"private": true`. If it is not enabled on this account, Vercel
  validates the key (which is why the null framework failed loudly) and then builds nothing from
  it. The old two-service config and the current single-service one are **the same bet**, so
  collapsing to one service may not be the fix it looked like.
- **The one click that settles it, and it costs nothing:** open the latest Production deployment
  and look at its **Functions** tab. Empty → zero functions were created, `services` is gated, and
  the config must be rewritten without it. Lists `score` and `top` → the mechanism is something
  else and this paragraph is wrong.
- **The next failure in line is a 500, not a 404.** The thin routes reach across the workspace to
  `@otp/api/src/deps.ts`, which resolves here only because `@otp/api` has no `exports` map and only
  because `allowImportingTsExtensions` permits the `.ts` specifier. On the preview: JSON → live;
  `503` → routed but the environment is unset; `500` → the cross-root import did not survive
  bundling; the game's HTML → the function still does not exist.
- **`apps/game/api/*.ts` is typechecked by nothing** — not `build`, `typecheck`, `lint`, `test` or
  CI. A broken import there can only fail on a deploy, which is trap 3 waiting to happen again.
- **The read half was never mounted.** `top()` is written and tested, and `grep -rn "\.top("` across
  `apps/game/src` and `packages/core/src` finds **no caller**. There are no board elements on
  Results and no board rule in any stylesheet. A player posts a score and never sees a list —
  deployed or not.
- **The client must do two things nobody can do from the repo:** turn on Vercel rate limiting for
  `/api/*`, and confirm on a preview that `GET /api/top` answers.

## 6. The Results block — the brief, already measured

The client asked for it "nicer and more branded". Four specific faults:

1. An **inline style** in the JSX (`display:flex; alignItems:center`) — the one place brand rules
   cannot reach and nobody reviews.
2. **`.otp-field` is an input's costume on something that is not an input.** 2px Ash border, pill
   radius, input padding — the visual language of "type here" — wrapped around a minted handle you
   cannot type in.
3. **No hierarchy.** Form, fine print, notice, then a lone "Walk it again" in `otp-actions`: four
   things at four weights with nothing grouping them, directly under a heavy purple CTA band.
4. **"POST YOUR SCORE" competes with the Lime CTA above it.** Two calls to action stacked.

## 7. Known open defects

- ~~**The board has a THIRD node, and the honesty matrix models two.**~~ **Closed 2026-10-21.**
  Reproduced first, in Chromium, against a build made for the purpose rather than the shared
  `dist` — and the report it came from had the mechanism right and the sentence wrong, which is
  worth keeping. There were **two** defects, not one:

  - a **400** rendered _"That run could not be posted."_ above _"Rank 2. noble-acorn-93, 900
    points. This is your run."_ That is an exclusive pair — `readerRunDidNotGoUp` against
    `readerRunIsOnBoard` — both long declared and never enumerated against each other.
  - a **lost reply** (dropped connection, the adapter's 6s timeout, or a 2xx body
    `submitResponseSchema` rejects) rendered _"The board was unavailable for that post."_ above
    the same row. Those are two different sentences: the first is `leaderboardRefused`, the
    second `leaderboardDown`, and only the 400 produces the one the report quoted.

  A **third** fell out of modelling the node: before any press, the page has posted nothing, so a
  row carrying the handle it is showing is necessarily somebody else's — 3,072 minted names, ten
  rows on the board, roughly one visitor in three hundred told a stranger's run was theirs.
  `e2e/leaderboard.spec.ts` asserted that marking as **correct** until this round; the fixture was
  built by reading the page's own handle, so the collision it staged looked like a match.

  The fixes are of three kinds, deliberately:

  - **Structure.** `ROW_CLAIMS` sits beside `NOTE_CLAIMS` and `NOTICE_CLAIMS`, and the enumeration
    in `test/board.test.ts` walks the screen's four INPUTS (board state, `attempted`, post
    outcome, handle match) deriving the three nodes through the real `boardNoteKey` and
    `boardRowKey` — 25 combinations rendered — then takes the full 5 × 5 × 3 = 75 cross product of
    node states and demands each one be produced or struck out by a **named, individually tested**
    rule. 50 are struck by three rules. A fourth node fails that totality check rather than being
    forgotten.
  - **Construction.** `boardRowKey` declines the reader's claim when the notice denies it, by
    asking `contradictions()` over the declared claims — not by naming `leaderboardRefused`, which
    a source guard forbids. To do that the screen had to be able to tell one outcome from another
    without matching words, so `submit()` answers a `PostOutcome` — `{ key, text }` — instead of a
    bare sentence. That is the coupling the old code refused and was right to refuse; the key is
    how it is had without it.
  - **Copy.** The lost-reply case is the one where both sentences are individually true: the run
    IS on the board and the page never learned. Nothing is hidden there — the row stays marked and
    `leaderboardDown` moved from _"The board was unavailable for that post."_ to _"No reply came
    back for that post."_, which is what the client actually observed. **This one is copy and no
    test can confirm it** (see below).

  **What is NOT closed.** The row is matched locally, by handle. A collision _after_ a post the
  server took is indistinguishable here from the reader's own row — both are "a row carrying the
  name this page posted" — and the difference lives on the server. Closing it needs
  `POST /api/score` to answer with the rank it wrote, or `GET /api/top` to mark it. Under-claiming
  is the safe direction and the node is built to fail that way, but it is not sound.

- **The pairing property is DECLARED, not guarded, and this is a real limit rather than an
  oversight.** Still open, and the 2026-10-21 round made it **more** load-bearing rather than less.
  `NOTE_CLAIMS`, `NOTICE_CLAIMS` and now `ROW_CLAIMS` in `Results.tsx` are hand-written, and
  nothing ties a claim to the sentence that carries it. Reverting `boardEmptyAfterPost` to the
  exact hedge that was sent back twice leaves the whole suite green; so does
  _"No runs are showing yet. Your run is on the board."_, which is **worse** than the original
  defect.

  This is trap 1 one level up, and worth stating plainly: the first bound was written against a
  **spelling** and the defect was a **meaning**, so it was replaced with a bound written against an
  **assertion of** the meaning — by the same hand that writes the meaning. A test cannot close that
  last gap. **Player-facing copy on this screen needs a human reading the sentences**, which is
  also why `docs/COPY_REVIEW.md` sends leaderboard and privacy copy to Legal. Do not let a future
  round claim the matrix makes that review unnecessary.

  **The `leaderboardDown` rewording is exactly this gap and is the one thing this round could not
  guard.** The claim stayed `postNotAnswered` and the sentence changed under it; a test that
  asserted the new words would be the regex trap again, and the one that asserts the declaration
  passed before the change and after it. What the guards DO cover: that the row and the notice
  cannot carry an exclusive pair of DECLARED claims, in every combination the screen can render,
  with the unrenderable ones struck out by name. What they do NOT cover: that _"No reply came back
  for that post."_ still means `postNotAnswered` and nothing more. A human has to read that
  sentence beside _"This is your run."_ and agree.

- ~~**The dark band across the top of the world — the third cause of "the line".**~~ **FIXED — do
  not go looking for this.** `snapTopEdge` (`packages/core/src/camera.ts`) wraps `topEdgeRows()`, and
  the forest scene reaches it through `snapCentreToRow`; §2 row 1 records all three causes fixed. The entry as written: Not a backdrop hole: the magenta probe reads 0 across 49 configurations. The camera's top
  edge settles **part-way into a tile row**, so the world opens on the bottom slice of a canopy row
  — crown keylines and nothing else. Measured: at the client's own 1673×449 the first 8 game rows
  are 25.1% dark against 6.3% mid-frame; at 390×844 it is 48.1% against 8.1%. Causation proved by
  moving Purple at a fixed world position (25.1→8.0 desktop, 48.1→19.2 phone), so it is where the
  camera sits, not what is painted. The fix is `topEdgeRows()` in `packages/core/src/camera.ts` —
  at the time already written, already tested, and not yet called from the running game. Snapping
  naively will make vertical walking judder, so it belongs at the clamp or the top bound, not every
  frame. This is also phone glitch #7a: the clipped canopy row is the same defect at a smaller
  camera.
- ~~**The market stall is sliced** at the phone's right edge.~~ **MEASURED AND ACCEPTED,
  2026-10-21; the proof is composition guard 7k in `forest-map.ts`.** It is sliced — 13% in frame at
  375×812, 22% at 768×1024, 25% at 390×844 — and whole at 1280×800, at 844×390 and at the client's
  own 1673×449. **It cannot be moved out of it, which is the part nobody had measured.** At the
  spawn the camera is pinned to the map's WEST edge at every viewport: Purple stands 5.5 tiles from the
  wall and the narrowest camera the game builds is 11 (`MIN_VIEW`), so `frameAt`'s clamp returns
  x0 = 0.00 from a 320 phone to a studio display. The stall's distance from the right border is
  therefore a pure function of camera WIDTH, so a placement at column x is cut by exactly those
  cameras between x and x+4 wide — and the reviewed cameras run continuously from 11.00 to 40.00
  tiles. Whole-everywhere needs x ≤ 7; absent-everywhere needs x ≥ 40; every column from 8 to 24 is
  cut by something. x ≤ 7 is not available: columns 4–8 are the north treeline that closes the top
  of the title camera (which 7b ratchets and forbids lowering) and column 9 is the fork with the
  signpost in its crook. Moving it EAST relocates the defect rather than removing it — x = 13 clears
  the named phones and starts slicing 1024- and 1100-wide laptop windows, and it would fell the
  sapling pair at columns 15–17 and strand the rabbit who keeps the stall. Three assertions now hold
  the decision, every bound read from the map's PUBLISHED object rectangle rather than the `11 + i`
  placement loop: no prop may be cut by a composed frame's edge (the stall is the only exception,
  east edge, portrait frames only — and it is today the only prop any of the four frames cuts); the
  rabbit must stand inside her own stall's columns; and the west-edge pinning the whole proof rests
  on is asserted rather than remembered. One thing still worth a human's eye: at 390×844 the cut
  lands exactly on a tile boundary, so a visitor sees one WHOLE column — the awning's own left end
  and a counter tile — not a torn tile.
- ~~**Purple cannot reach the toadstool.**~~ **FIXED, 2026-10-21, and it was never a map bug.** (10,22)
  was then the toadstool's own spawn cell (it moved to (15,22) in v2 Phase C), deliberately solid under the "nobody in the cast is a ghost"
  invariant, and all four of its neighbours are walkable. The walk TARGET was stale: `37a94b9` wrote
  `talkingDistance` as `spot.y + TILE + 8`, correct when the cast sat at tile-centre + 24, and the
  very next commit moved them to tile-centre + 16 without touching the helper. Eight pixels against
  a 40px tolerance whose north approach is exactly 40.00px — zero margin — so 3px of lateral drift
  threw "Something is in the corridor." `test/cast-anchor.test.ts` now fails if those two
  expressions drift apart again.
- ~~**The gate is not a gate.**~~ **DONE** — `gate-n` and `gate-s` in `tools/graybox/src/tiles.ts`,
  commit `840daab`. The entry as written: The opening is an absence of fence: post run, flat terminator plank,
  gap, flat plank, post run. The terminators are the least-finished object in the payoff frame. It
  needs one new tile (two post tops with a narrow rail), a `TILE_NAMES` **append** — never a
  renumber, the order is gid order and is baked into the map — placement, and a regeneration in one
  commit.
- ~~**Nothing in the forest animates.**~~ **FIXED, 2026-10-21 — do not go looking for this.** It was
  true and is not: `forest-scene.ts` creates one idle per character and `startIdles()` plays them,
  staggered so no two share a period, with a hold of 3–5s and a 120ms blink, silent under
  `prefers-reduced-motion`. `e2e/scene-second-pass.spec.ts` guards it with bounds derived from what
  a blink is rather than from the constants. The eight painted frames are finally on screen.

  Kept here struck through rather than deleted, because the entry sent at least one agent hunting
  after it was already fixed — which is trap 2, arriving through this document instead of through a
  comment.

- **101 walkable tiles sit under fully opaque crowns**, so the player vanishes while standing
  there. Re-measured 2026-10-21 and it is **smaller and sharper than it sounded, and it is real**:
  (The ratchet is still `OPEN_ENOUGH = 101` in `forest-map.ts` at `3c88684`. The counts below are
  2026-10-21's and the map has been regenerated since — the cast moved, the bridge, the riverbank
  corners — so re-measure before leaning on a figure.)

  - 101 cells, not 109 — the difference is this week's art, not an earlier miscount.
  - **Only two gids, 60 and 63.** Counted by decoding `tileset-forest.png` and measuring
    `alpha == 255` per cell, not by reading tile names. So it is two crown tiles, not scattered art.
  - **Every one of them is reachable.** A BFS from `spawn-purple` at tile (5,20) over `collision == 0`
    reaches 1,514 tiles and all 101 are in that set, so this is not walkable-but-enclosed. A player
    can stand on any of them and disappear: **6.7% of the reachable world.**
  - Rows 2 to 37, so it is not only the far treeline. The row 24/32/37 cells look like ordinary
    forest floor, which argues against "mark them solid" as the fix for those.

  **There is already a guard and it already derives its bound that way** — `forest-map.ts` renders
  each `decor-above` painter and counts alpha per pixel, never reading a gid or a name. Its own
  docstring records that the original finding named four tiles and that rendering them proved only
  two opaque, `canopy-bl` and `canopy-br` leaving 152 and 111 pixels of daylight. The lesson was
  resident before anyone restated it.

  **What was wrong was the RATCHET, and that is the transferable part.** `OPEN_ENOUGH` stood at
  **109 while the map had been at 101** — eight cells of slack, so eight new blind tiles could have
  been planted and the guard would have gone on passing. Tightened to 101 and proved to have no
  slack left by setting it to 100 and watching it fire. Two independent instruments agree on the
  number and share no code: the painter-alpha guard, and a separate pass that decoded
  `tileset-forest.png`, counted `alpha == 255` per cell and flooded from `spawn-purple`. The two tiles
  are gid 60 = `elder-mc` and gid 63 = `elder-bc`.

  **Lower `OPEN_ENOUGH` as the crowns open up; never raise it.** A correct guard with a stale bound
  is the quietest failure in this repo: it reads as proof and permits the thing it names.

  **The fix is a painter's and is unowned.** It belongs in `tiles/w-trees.ts` — a few pixels of sky
  into two solid green squares, which fixes all 101 at once and moves every cell using those crowns
  in the regeneration. Both map-side alternatives are worse than the fault: making the cells solid
  hands the connectivity flood 101 new pockets to open by felling the wood, and refusing to plant an
  elder whose crown reaches walkable ground removes most of the elders. The rows 24/32/37 cells are
  ordinary forest floor rather than treeline, which is the same conclusion from the other end —
  "solid" is plainly the wrong remedy for those.

## 8. The arcade shell — the answer, and the argument

> **REVERSED 2026-10-22 on the client's word: the cabinet is the presentation**, on every screen
> (`apps/game/src/ui/cabinet.ts`; PLAN.md "Client round 2026-10-22" records it). The argument
> below is kept, and its practical reasons now apply as **constraints, not a veto**: the cabinet
> must not read as a rendering fault, must not vanish at the payoff, and must not borrow anyone's
> cabinet design. The shipped Lilac glow (`--otp-cab-glow` in `tokens.css`) contradicts "no
> shadows" in UI_FOUNDATIONS section 4 and BRAND_AND_UI section 3, and has no recorded brand
> sign-off yet; that is open, not settled.

They asked for an opinion, not agreement. The prototype was built and turned on before answering.

**Yes to the mobile deck. No to the desktop cabinet.**

The deck works: the joystick and A button sit on a Natural console face with a Deep Purple bezel,
and it costs **zero world pixels** — the canvas is identical at 384×556 with it on and off. It
reads as considered craft rather than decoration, and on a phone the controls have to live
somewhere anyway.

The full cabinet is a no, and the reason is the argument rather than the budget. **A cabinet tells
a visitor "this is a toy", which grants them permission not to take the permission prompt
seriously** — and the whole asset exists to make someone actually read one. On a data security
research page that spends charm against the payload.

Three practical reasons underneath it. The brand has no shadows, bevels or dark ground, so what you
can actually build is a half-cabinet, which reads as a rendering fault rather than a style. Results
and the leaderboard are full-viewport takeovers, so a cabinet would only ever exist on Explore and
would vanish at the payoff. And a photoreal cabinet shell is someone else's intellectual property,
which is not a thing this company ships on its own research page.

## 9. What you are for

You orchestrate. You do not build. You triage, you rank, you name which reviewer was wrong, you
write the board with exact file ownership, and you gate.

You have said no to the design target five times on evidence and been right each time. You said yes
once, after the two holes in the world were found and proved gone. Keep both halves of that: the
client deserves a no when it is a no, and they deserve to hear yes the moment it is true.
