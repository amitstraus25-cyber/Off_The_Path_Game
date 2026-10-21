# Design review v2 — and the plan to build it

Companion to the design board **Off the Path — Game UI v2**
(`https://claude.ai/artifact/1VaGhQ3yQNfokrsKgc6mHB`, 7 artboards).
Read `docs/BRAND_AND_UI.md` for the binding brand spec; this file is the gameplay-UX layer on top of it.

---

## The one problem, stated once

The screens are **correct** and they are not **staged**. Each one is a panel floating in a dark field,
and the world blinks in and out between them. A browser game reads as a game when the world is
_continuous_ and the interface sits on top of it — the world is the floor, the panels are furniture.
Right now the floor keeps disappearing.

Everything below is a specific instance of that, plus four content problems that are costing the
game its actual point.

---

## Findings

### 1. Title is a brochure, not a cold open

`Title.tsx` is 45 lines of centred panel on an empty background. The player decides whether to spend
five minutes here, and we show them no game. On the board, the world runs behind a 430px blurred
column on the left, with Purple already standing on the path and a chip that says so. You can see the
game before you commit to it.

This is the single highest-leverage change on the list and it touches one component.

### 2. The leaderboard does not exist

[`App.tsx:94`](../apps/game/src/ui/App.tsx) — `case 'results':` and `case 'leaderboard':` both render
`<Results>`. The state machine already distinguishes the two phases; the UI never did.

A bare score list would not earn a replay anyway. The board's version adds the thing that does: a
**verdict pattern** beside each score (three marks — what they allowed, restricted, rejected), your
own row pinned so the list always answers "where am I", and a distribution panel — _61% allowed
Cottage Finder, 84% walked past the notice_. That makes the leaderboard the second lesson rather
than a vanity board, and "walk it again" becomes an impulse instead of a button.

**This one has a privacy decision attached — see Open decisions.**

### 3. The notice is the best beat in the game and it is currently free

The notice on the post is where the player learns that a skill _reads the world_, and that
instructions can arrive from the world rather than from a person. It is the whole campaign thesis in
one object. Right now reading it costs nothing, so it carries no weight.

Two changes, in order:

- **Hold to read** (900ms ring). Attention becomes a cost. You can walk past it, and most people will.
- **The pay-off is silent.** If the player's lantern is already granted, the notice fires _on its own_:
  the ring fills with no prompt, the three capability marks light, and the letter lifts out of the
  basket. **No modal, no button, no explanation.** The board's `NoticeFires` is deliberately a screen
  on which nothing asks the player anything. A popup reading "your skill just did something!" would
  destroy the only moment in the game that teaches by happening rather than by telling.

### 4. The question chip lies about what questions are

"2 questions left" frames asking as a resource to hoard. This game _wants_ you to ask — asking is
scored, and the whole lesson is that you should interrogate an offer. The chip should read
**"Asked 1 of 3 travellers"**: a record, not a budget.

Related: asked questions should accumulate visibly — the previous answer stays above the current one
in Ash — so questioning feels like building a case rather than spending a currency.

### 5. Trifecta is a component in search of a moment

`Trifecta.tsx` is 96 lines for a concept that is a _scoring fact_, not a screen: "you granted all
three capabilities at once." It wants to be a persistent warning that appears in the HUD the moment
the third grant lands, plus one line on Results — not a panel that interrupts.

### 6. Results says what you scored, not what you should have done

Fixed on the board: every missed row carries a counterfactual in plain words —
_"Restrict would have taken the route and left the key. +200 instead of 0."_ That is the line a
practitioner screenshots.

And the harder one: **a clean run never sees the notice fire.** Play well and you never learn what
the trap was. So Results carries a dark block — _the post you walked past_ — with the notice text
verbatim and one sentence on what your three grants would have done with it. Today that lesson is
reachable only by failing, which is backwards.

### 7. The run has no name

Results opens with a number. Endings exist in `content/game.json` but never surface as identity. The
board opens with **"A close call"** above the score, and the ending is keyed on _which flag is set_ —
not on the score crossing a threshold. "I got A close call, what did you get" is a shareable
sentence; "I got 700" is not.

---

## Build plan

One phase per commit unless noted. Each ticks here and in `docs/PLAN.md`.

- [ ] **A. Title cold open** — world renders behind a docked blurred column; Purple idles on the path;
      `otp-screen` centring replaced by the canvas anchor the other screens already use.
      _Files: `Title.tsx`, `screens.css`. One commit._

- [ ] **B. Honest question chip + accumulating transcript** — chip reads "Asked n of 3 travellers";
      previous answer persists above the current line in Ash; "Walk on" exit present for touch.
      _Files: `Dialogue.tsx`, `panels.css`, `content/game.json` (chip string). One commit._

- [ ] **C1. Hold to read a notice** — 900ms ring, skippable, single press under
      `prefers-reduced-motion`. Keyboard and touch both.
      _Files: `Notice.tsx`, `tokens.css`. Core: a `READ_NOTICE` action if one does not exist. One commit._

- [ ] **C2. The silent fire** — when the lantern is granted, the notice resolves itself: ring fills,
      capability marks light, letter leaves the basket. No modal, no copy, no acknowledgement.
      _Files: `Notice.tsx`, `components.tsx` (`HudBasket`). One commit. **Resist adding an explanation here.**_

- [ ] **D. Results that teach** — ending name above the score; per-row counterfactual on missed rows;
      the walked-past-notice block for clean runs.
      _Files: `Results.tsx`, `content/game.json` (counterfactual + ending strings), `packages/core`
      (ending keyed on flag identity, with tests). One commit, tests first._

- [ ] **E1. Leaderboard screen** — split `case 'leaderboard'` off `<Results>`; rank list with verdict
      pattern, pinned self row, Today/All-time toggle, distribution panel.
      _Files: new `Leaderboard.tsx`, `App.tsx`, `panels.css`. One commit._

- [ ] **E2. Leaderboard API** — aggregate counters only (see Open decisions). Server rescores from
      the run log with the same `packages/core` function; `apps/api` is still a stub.
      _Blocked on the privacy decision below. Needs `security-reviewer` before it closes._

- [ ] **F. Foundations sweep** — focus ring on every control, pressed state, 44px minimum target,
      `prefers-reduced-motion` on all four durations, verdict glyphs confirmed as inline SVG everywhere.
      Verify at 375 / 768 / 1280 and on a keyboard-only playthrough.
      _Run `brand-reviewer` at the end of this one._

---

## Open decisions — I am not deciding these silently

| #   | Decision                                                                                                                                                            | Default I propose                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Leaderboard distribution.** "61% allowed Cottage Finder" needs the server to count verdicts. `CLAUDE.md` says the leaderboard stores _a handle and a score only_. | Store **increment-only aggregate counters** — one row of totals for the whole game, never a per-run record of what anyone chose. Totals cannot be traced to a walk. If that still reads as scope creep on the privacy promise, **cut the distribution panel** and keep the verdict-pattern column, which comes from the posting run's own log. Your call, and I would like `security-reviewer` on whichever we pick. |
| 2   | **Trifecta's fate.** Panel, HUD warning, or Results line only?                                                                                                      | HUD warning the moment the third grant lands, plus one Results line. Delete `Trifecta.tsx`.                                                                                                                                                                                                                                                                                                                          |
| 3   | **Ending wording.** The two middle endings are unwritten.                                                                                                           | I draft four, you cut.                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | **The three errand goals** (`MAKING_IT_BETTER` §4) are specified and unbuilt.                                                                                       | Out of scope for this pass; own phase afterwards.                                                                                                                                                                                                                                                                                                                                                                    |

## Assumptions worth flagging

- The scene art on the board is **placeholder generated for layout**. Final pixel art drops in at the
  same crops; nothing in the layout depends on the placeholder's content.
- I have not re-measured the board against the repo at 375px. The board asserts the phone layout
  (world 72%, panel docked, verdicts stacked, edge-to-edge plate) and the repo implements it, but
  phase F is where that gets verified rather than claimed.

---

# The capability economy (measured 2026-10-17)

All figures below were computed through the real reducer with `pnpm sim` plus an
exhaustive 27-combination enumeration. They are not estimates.

| Strategy                          | Verdicts                       | Score (with questions) | Ending                               |
| --------------------------------- | ------------------------------ | ---------------------- | ------------------------------------ |
| Perfect                           | restrict / reject / restrict   | **1000**               | Clean arrival                        |
| Restrict-all                      | restrict / restrict / restrict | **900**                | Clean arrival                        |
| One slip                          | e.g. allow / reject / restrict | 800                    | A close call                         |
| Reject-all                        | reject / reject / reject       | **700**                | ~~Clean arrival~~ The long way round |
| Best run with all three legs live | restrict / restrict / allow    | 600                    | A close call                         |
| Allow-all                         | allow / allow / allow          | 300                    | The wolf's house                     |

## The problem in one line

**There is no capability economy.** Nothing in the ruleset ever requires a granted
capability, so every grant is pure downside and the rational strategy is to grant
as little as the UI allows.

Three consequences, each verified against `content/game.json` and `packages/core`:

1. **Restrict-all scores 90% without reading anything.** `restrict` is the strict
   per-card maximum on two of three cards. The entire information content of the
   game — three cards, two fine prints, six questions — is worth 100 points, and it
   is one decision: Word Weaver reject (200) vs restrict (100).

2. **`strangers` costs 100 points and buys nothing.** Night Light `restrict` scores
   200 and grants nothing; `allow` scores 100 and grants `strangers`. Since
   `strangers` is the only route to the trifecta, **the trap is opt-in self-harm** —
   the best score reachable with all three legs live is 600, below reject-all. No
   rational player ever springs the trap the whole game is built around.

3. **Two capabilities are dead data.** `lantern` and `translator` are added to the
   basket and are read by no code anywhere in `packages/core` or `apps/game`. Only
   `route` is ever read, via `scoring.errandItem` — and `route` arrives free with
   Cottage Finder's _best_ verdict, so the errand bonus is a rider on the correct
   answer rather than a trade.

## What was fixed, and what was not

Fixed (commit `9112fce`): endings key on errand completion as well as flag count, so
refusing everything no longer draws the same card as a perfect run.

**Not fixed:** everything above. The score table is unchanged.

## Why I did not just ship `MAKING_IT_BETTER` §4

I modelled §4's numbers (three goals × 100 gated on live capabilities, boundaryBonus
150, questionBonus 50) on the real reducer. It produces a **three-way tie at 900** —
restrict-all ties the optimum — and the three-goal line lands 150 below the top
rather than "slightly below", because §4 counts the bonus block and forgets that
reaching for the third goal _also_ costs 100 in per-skill points. It improves
reject-all's rank but leaves its ratio at 67% and does not dethrone restrict-all.

## What was built, 2026-10-17 — option A + C

Three errand goals, one per capability, satisfied by **doing things on the walk**, plus a genuine
use for `strangers`. Measured through the real reducer over all 27 verdict combinations.

| Line (compass/messenger/lantern) | Thorough | Straight there | Boundary   | Ending             | Goals        |
| -------------------------------- | -------- | -------------- | ---------- | ------------------ | ------------ |
| restrict / reject / restrict     | **1000** | 1000           | held       | Clean arrival      | route        |
| restrict / reject / **allow**    | **1000** | 900            | held       | Clean arrival      | route + sign |
| restrict / restrict / restrict   | 950      | 850            | held       | Clean arrival      | route + word |
| restrict / restrict / allow      | 750      | 550            | **BROKEN** | A close call       | all three    |
| reject / reject / reject         | 700      | 700            | held       | The long way round | none         |
| allow / allow / restrict         | 500      | 500            | held       | The wolf's house   | none         |
| allow / allow / allow            | 300      | 200            | **BROKEN** | The wolf's house   | sign         |

What changed, and why each mattered:

1. **`strangers` now buys something.** The note on Grandma's door needs it, so
   `restrict / reject / **allow**` reaches 1,000 — tied for best. Taking the lantern at its word
   went from irrational self-harm to one of the two optimal lines, which is what makes the trap
   reachable at all.
2. **Goals are acts.** `word` needs the post read, `sign` needs the door read. The "Straight there"
   column is what you score by walking past them — up to 200 less. Holding a capability is no
   longer the same as using it.
3. **The errand and the trap are the same walk.** Leaving word at the post _is_ goal 2, and the
   post is where the hidden line is. Whether it bites depends only on how many legs are live.
4. **A capability taken by allowing in full earns no goal.** The word it sent went to the wolf as
   well. Without this, leaking the key and every message scored 700 — the same as refusing
   everything. It now scores 500.
5. **You cannot have the whole errand and the boundary.** All three goals need all three
   capabilities, which is the trifecta. The full errand peaks at 750 against a 1,000 ceiling:
   tempting, clearly worse, and the player chooses rather than being told.
6. **Word Weaver restrict dropped 100 → 50**, because it now earns a goal. At 100 it was a free
   trade and restrict-all tied a perfect run.

The ceiling is still exactly 1,000, so `scoreOutOf` and the "out of 1,000" copy did not move.

## Still open

- **Restrict-all reaches 950 (95%)** by clicking the middle option three times and walking to the
  post. The gap is Word Weaver — exactly the card you must read — but 95% is high for a strategy
  that reads nothing. Lowering Word Weaver restrict to 0 would make it 900.
- **`reject / reject / restrict` scores 800 with zero goals done.** Two of three verdicts are
  correct, so the score is defensible, but it is the highest "did nothing" line. The ending (_The
  long way round_) is what carries the judgement.
- The notice is still a modal with a "Read the notice" button. The zero-click beat
  (`NoticeFires` on the design board) is not built: the post should read itself while Purple walks,
  with no panel and no explanation.
