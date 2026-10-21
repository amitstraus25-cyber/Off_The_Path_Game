# Paul's standing brief

**Read this first, every round.** It is the state of the world and the list of traps. It exists
because the same mistakes kept costing whole rounds, and because a reviewer who measures the wrong
thing confidently is more expensive than one who finds nothing.

Last updated: 2026-10-21, after the client round — the one that found the stale checkout (trap 10)
and the debug handle that was shipping to players. Read trap 10 before investigating anything the
client reports seeing.

---

## 1. What is true right now

- The game is live at `off-the-path-game.vercel.app`, embedded-ready, `frame-ancestors` locked to
  `cyera.com` and `*.cyera.com`.
- The suite is **535 tests** — `packages/core` 203 at a 100% gate on statements, branches, functions
  AND lines; `apps/api` 53 at the same gate; `apps/game` 272; `tools/graybox` 7 — plus **179 e2e**.
- The art generator is deterministic: `pnpm graybox` regenerates `map-forest.json` byte-identical
  unless a painter changed. That property is the proof standard for every art change.
- Phase 6 (the leaderboard) exists: `apps/api`, score recomputed server-side from the run log,
  handles minted not typed, two columns in the table and a test that a third cannot arrive.

## 2. The client's open list

Their words, their order. Anything not here is not a priority this week.

| #   | Item                                                                 | State                                                                                                                      |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | The line / "lagginess"                                               | **Three causes, two fixed.** Two one-pixel holes, gone. The stale checkout (trap 10), gone. **The top-edge band is open.** |
| 2   | Trees in the middle look messed up                                   | **Done.** Brick course gone, trunks and root flares, crowns merge. Squared flank lobe survives at 8x only — gid round.     |
| 3   | Red's back view                                                      | **Close.** Front and sides shippable. Nape hair reads as a structureless blob; cape mark needs brand sign-off.             |
| 4   | Inspect card: three verbs, three explanations, nothing else, branded | **Done** — the best thing in the round. One open question: "allow two dots" read as a colon; we used columns.              |
| 5   | Leaderboard not working                                              | Two faults, not one: no function is deployed (§5), **and no board is ever shown**. Both in flight.                         |
| 6   | Phone: goals panel eats the screen                                   | **Done.** A 44px bar that taps open: ~5% of the screen against ~16%. Verified by touch.                                    |
| 7   | Phone: three circled glitches                                        | **Two remain:** the clipped canopy row (same cause as #1) and the market stall sliced at the right edge.                   |
| 8   | Arcade-cabinet shell, Cyera themed                                   | **Answered: yes to the mobile deck, no to the desktop cabinet.** The argument is in §8.                                    |
| 9   | Results block: "nicer and more branded"                              | **Done.** All four faults in §6 fixed; a guard now bans static inline styles.                                              |
| 10  | The gate (fence)                                                     | In flight — owned at last, tile and placement split, one regeneration.                                                     |

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
    habit. That build has Red in a **red** cloak, flat blob trees, and a measurable dark column down
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

## 4. The rules of a round

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

- **The board has a THIRD node, and the honesty matrix models two.** Three rounds went into making
  sure `.otp-error` and `.otp-board__note` cannot contradict each other, and the 25-pair
  enumeration that guards it is real. But `.otp-board__row--you` renders "This is your run" in the
  same section, and a post the server **took** whose reply never reached the page — a dropped
  connection, the adapter's 6s timeout, or a 2xx body the schema rejects — renders
  _"That run could not be posted."_ directly above _"Rank 2. …, 900 points. This is your run."_
  Driven in Chromium, suite green throughout. Rare, but it is the same defect class the matrix
  exists to prevent, one node outside its model.
- **The pairing property is DECLARED, not guarded, and this is a real limit rather than an
  oversight.** `NOTE_CLAIMS` and `NOTICE_CLAIMS` in `Results.tsx` are hand-written, and nothing
  ties a claim to the sentence that carries it. Reverting `boardEmptyAfterPost` to the exact hedge
  that was sent back twice leaves 651 unit and 212 e2e tests green; so does
  _"No runs are showing yet. Your run is on the board."_, which is **worse** than the original
  defect.

  This is trap 1 one level up, and worth stating plainly: the first bound was written against a
  **spelling** and the defect was a **meaning**, so it was replaced with a bound written against an
  **assertion of** the meaning — by the same hand that writes the meaning. A test cannot close that
  last gap. **Player-facing copy on this screen needs a human reading the sentences**, which is
  also why `docs/COPY_REVIEW.md` sends leaderboard and privacy copy to Legal. Do not let a future
  round claim the matrix makes that review unnecessary.

- **The dark band across the top of the world — the third cause of "the line", and the one still
  open.** Not a backdrop hole: the magenta probe reads 0 across 49 configurations. The camera's top
  edge settles **part-way into a tile row**, so the world opens on the bottom slice of a canopy row
  — crown keylines and nothing else. Measured: at the client's own 1673×449 the first 8 game rows
  are 25.1% dark against 6.3% mid-frame; at 390×844 it is 48.1% against 8.1%. Causation proved by
  moving Red at a fixed world position (25.1→8.0 desktop, 48.1→19.2 phone), so it is where the
  camera sits, not what is painted. The fix is `topEdgeRows()` in `packages/core/src/camera.ts` —
  **already written, already tested, and never once called from the running game.** Snapping
  naively will make vertical walking judder, so it belongs at the clamp or the top bound, not every
  frame. This is also phone glitch #7a: the clipped canopy row is the same defect at a smaller
  camera.
- **The market stall is sliced** at the phone's right edge — a quarter of it in frame at 390×844,
  reading as a broken box against the border. Composition, not renderer: the map is composed
  against a 19.4-tile desktop camera and a phone gets 11.5.
- **Red cannot reach the toadstool.** `walkTo` gives up 40px short; there is a collision tile at
  (10,22). This is a real map regression and it is currently making CI red.
- **The gate is not a gate.** The opening is an absence of fence: post run, flat terminator plank,
  gap, flat plank, post run. The terminators are the least-finished object in the payoff frame. It
  needs one new tile (two post tops with a narrow rail), a `TILE_NAMES` **append** — never a
  renumber, the order is gid order and is baked into the map — placement, and a regeneration in one
  commit.
- **Nothing in the forest animates.** No NPC or bystander animation is ever created, so eight
  painted blink frames ship in the atlases and no player has seen one.
- **109 walkable tiles sit under fully opaque crowns**, so the player vanishes while standing there.

## 8. The arcade shell — the answer, and the argument

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
