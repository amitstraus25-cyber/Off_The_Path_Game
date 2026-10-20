# The redesign: plan of record

The goal, in one sentence: **the game should look like the approved concept board, feel like a game
someone wants to play, and carry the Cyera brand without the brand flattening the art.**

This file is the plan the orchestrated run follows. It is written down because the run spans many
hours and many agents, and because a plan held only in one head cannot be checked.

Reference of record: `reference/mocks/gameplay-concepts.png` (3072×2048, the approved board).
Binding specs: `docs/ART_DIRECTION.md`, `docs/PIXEL_STANDARD.md`, `docs/UI_FOUNDATIONS.md`,
`docs/ART_PRODUCTION.md` §6a (the rebrand), `CLAUDE.md` (security, privacy, dependencies).

---

## 1. Where we actually stand

Measured, not estimated, at the time of writing.

|                  | State                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Scale            | 32px tiles, 32×48 characters, 64×64 portraits. Done and green.                         |
| Rebrand          | Done. No true red survives; Red is Lilac-led (333px Lilac vs 102 Aubergine per frame). |
| Tests            | 154 core at 100% branch, 95 game, 65 end-to-end. All passing.                          |
| Assets           | Zero partial alpha. `TILE_NAMES` frozen at 53 in order.                                |
| Commits          | 6 ahead of `origin/main`. **Nothing pushed yet this session.**                         |
| Art vs the board | **Not there.** This is the whole remaining problem.                                    |

**The gap, specifically.** The board is a dense storybook forest; the build is a sparse lawn with
objects on it. Four differences carry almost all of it:

1. **The keyline.** Every object on the board is ringed in a near-black of its own hue family. The
   build mostly is not, and that single convention is most of why the board reads as one world.
2. **Foliage construction.** Board crowns are many overlapping round leaf masses, each lit on its
   top-left, with deep shade where they overlap. The build draws flatter, simpler shapes.
3. **Ground texture.** The board's grass is mottled with broad patches and small three-blade tufts.
   The build's is a flat tone with single-pixel speckle, and it reads as felt.
4. **Density and composition.** The board overlaps trees at several scales, crowds both river banks
   with boulders, and keeps paths narrow and winding. This is a `forest-map.ts` problem, not a tile
   problem, and no amount of tile quality fixes it.

**The one deliberate departure from the board.** It predates the rebrand, so it shows a scarlet
cloak and a terracotta roof. Those stay Cyera purple and slate. We match the board's _form,
density, structure and lighting_ — not its red.

---

## 2. Why this is orchestrated the way it is

A sub-agent cannot spawn sub-agents, so "an orchestrator agent commanding a team" is implemented
honestly as two separable things:

- **Judgement** is an agent: a creative director with game, UI and UX background, consulted at every
  gate. It never writes art; it decides whether the work is good enough and says exactly what is
  wrong.
- **Dispatch** is the workflow script: it turns the director's work order into parallel agents, one
  file each, and loops until the director passes it or the round budget runs out.

This matters because the failure mode of the previous runs was not bad work — it was **one pass with
no loop**. Agents reported findings, nothing acted on them, and a human had to launch a second
workflow by hand. The director gate closes that loop.

Two further rules learned the hard way and now enforced in every brief:

- **One file per agent, always.** Parallel agents on a shared file corrupt each other's work.
- **Look at the output.** An agent that has not rendered its work and read the PNG has not finished.
  Most of the quality in the 32px pass came from agents iterating against their own renders.

---

## 3. The stages

### Stage 0 — Evidence pack

Capture the truth before anyone judges it: every contact sheet rendered, the running game
screenshotted at five landmarks, and the equivalent regions cropped from the board. The director
judges from this, not from an agent's description of it.

### Stage 1 — The director sets the bar

The creative director studies the evidence pack against the board and produces two things: a score
with reasons, and a **prioritised work order** — concrete tasks, each naming one file and one owner.
It is also empowered here to call out gameplay and UX problems, not only art: if the game is not
_fun_, that is a finding.

### Stage 2 — Build round

Every task in the work order becomes one agent with one file. They run in parallel.

### Stage 3 — Director gate (the loop)

Re-capture, re-judge. **Pass** → stage 4. **Fail** → a new work order, back to stage 2.
Bounded at four rounds so it cannot run forever; if it is still failing at four, that is reported as
a fact rather than hidden.

### Stage 4 — Code review

Only once the art passes. Parallel lenses, each adversarial:
correctness, security and privacy (`CLAUDE.md`: no third-party runtime, pinned deps, strict CSP,
leaderboard stores a handle and a score and nothing else), brand compliance, test quality, and
performance. Blocking findings go to a fix round and the review runs again.

### Stage 5 — Final gate

Director and engineering together: the suite green, the game playable start to finish, the art
matching the board, the brand intact.

### Stage 6 — Push

`main` is **6 commits ahead of origin** and nothing has been pushed this session. The push is a
single outward action affecting a shared repository, so it is done by hand, after the final gate
passes, and reported — not delegated to an agent. No agent in any stage may run `git commit`,
`git push`, `git checkout`, `git stash` or `git branch`.

---

## 4. The bar

The run is not done when the agents say so. It is done when all of these are true and have been
checked by someone who looked:

- The forest reads as the board's forest: dense, keylined, layered.
- Red is the most findable thing on screen, and she is Cyera purple.
- The cottage is somewhere you want to walk to.
- The four animals are distinguishable by silhouette alone.
- `TILE_NAMES` still holds its names in the same order, and the map is fully playable to every goal.
  (It held 53 when this plan was written and holds 79 today; the count is printed by
  `tools/graybox/src/tiles.ts` and pinned in `tools/graybox/test/art-guards.test.ts`. What matters
  here is the ORDER, because a gid is an index into that array and those gids are written into every
  tile of the committed map.)
- Zero partial alpha, no raw hex in a painter, no Lime anywhere in world art.
- Typecheck, lint, unit and end-to-end all green, with no test weakened to make it pass.
