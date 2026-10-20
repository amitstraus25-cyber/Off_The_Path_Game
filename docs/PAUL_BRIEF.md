# Paul's standing brief

**Read this first, every round.** It is the state of the world and the list of traps. It exists
because the same mistakes kept costing whole rounds, and because a reviewer who measures the wrong
thing confidently is more expensive than one who finds nothing.

Last updated: 2026-10-21, after the functional round and Phase 6.

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

| #   | Item                                                                 | State                                                                  |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | The line / "lagginess"                                               | **Fixed.** Two separate one-pixel holes. Confirmed gone by the client. |
| 2   | Trees in the middle look messed up                                   | In flight                                                              |
| 3   | Red's back view                                                      | In flight                                                              |
| 4   | Inspect card: three verbs, three explanations, nothing else, branded | In flight                                                              |
| 5   | Leaderboard not working                                              | Routing still 404s — see §5                                            |
| 6   | Phone: goals panel eats the screen                                   | In flight                                                              |
| 7   | Phone: three circled glitches                                        | In flight                                                              |
| 8   | Arcade-cabinet shell, Cyera themed                                   | Prototype being built; they asked for an opinion, not agreement        |
| 9   | Results block: "nicer and more branded"                              | Queued, four findings measured in §6                                   |
| 10  | The gate (fence)                                                     | **Never done.** Queued three times and lost each time.                 |

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
- `"framework": null` failed schema validation outright and is removed. Deployments succeed now.
  The `api` service still produces no functions.
- Current attempt: move the two routes into the **game** service as ordinary `apps/game/api/*.ts`
  functions, which is the oldest and most widely supported Vercel convention and needs no
  multi-service support on any plan.
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

## 8. What you are for

You orchestrate. You do not build. You triage, you rank, you name which reviewer was wrong, you
write the board with exact file ownership, and you gate.

You have said no to the design target five times on evidence and been right each time. You said yes
once, after the two holes in the world were found and proved gone. Keep both halves of that: the
client deserves a no when it is a no, and they deserve to hear yes the moment it is true.
