# Game design v2: collect, and find out what you collected

**Status: spec, approved in shape, not yet built.** Decided with the client 2026-10-21. This replaces
the v1 loop on `main` — there is no v1 branch, by their decision, so the v1 behaviour recorded in
`docs/GAME_DESIGN.md` is history rather than an alternative.

Read `docs/PAUL_BRIEF.md` first, then this. `docs/GAME_DESIGN.md` still describes v1 and is the
reference for anything this document does not override.

---

## 1. Why v1 is being replaced

It works, it is tested, and it is slow. Three characters, three careful verdicts, a lot of reading.
The client's words: "i want to change the game play to be more fun".

The risk in a redesign is losing what the asset is for, so it is written down here before anything
is built. **A skill can do what it promises and still follow an attacker's instructions.** Players
should leave asking: who wrote these instructions, and what will my agent actually do?

Two of the client's asks pull against that, and the resolution is the whole design:

- **"Collect as many skills as you can"** rewards acquisition. Scrutiny is the behaviour we want.
- **A three-minute timer** produces exactly the thing we are arguing against: clicking Allow
  without reading.

## 2. The resolution: collecting is the bait, not the goal

**Collect freely. Find out at the cottage what you let in.**

The player is never told to be careful. They are told to collect, the collecting is fast and feels
good, and then the cottage shows them what each skill actually did with their basket. A greedy
six-skill run can score near zero and the wolf is waiting.

This is better than v1 at the thing v1 was for, not just more fun:

- The lesson arrives as a **punchline rather than a lecture**. Being shown you were careless is
  sharper than being asked to be careful.
- It reproduces the real failure. Nobody reads permission prompts because they are being reckless;
  they read none because they are **collecting capability under time pressure**. That is the game.
- It gives a reason to replay, and the second run is the one where they read the cards.

**The timer is the antagonist, and it is honest.** Read every card and arrive late; move fast and
arrive compromised. The client chose a **hard timer**: running out is its own ending, not a penalty.
That is a real stake, and §7 records what it costs us.

## 3. The loop

```
  Start        a how-to-play a visitor reads in about five seconds
               move, talk, inspect, take or leave. Then the clock starts.

  Forest       seven characters along the path, each offering ONE skill.
               Talk. Inspect what it actually does. Take it or leave it.
               Nothing stops you taking everything. Nothing warns you.

  Cottage      the door. The reveal: what each skill in your basket did on the way.
               Some kept their promise. Some kept their promise AND served the wolf.

  Score        out of 100. Any bad skill lets the wolf in, and that scores 0.
```

### Decisions already made, do not re-litigate

| What              | Decision                                                              |
| ----------------- | --------------------------------------------------------------------- |
| Scoring           | **Greedy is punished.** Score is what the skills DID, never how many. |
| Timer             | **Hard, three minutes.** Running out is its own ending.               |
| Skills to collect | **Seven; three dealt good at random each run** (2026-10-22, §4).      |
| v1                | **Replaced on `main`.** No fallback branch.                           |
| Character name    | **Purple**, not Red — her cloak is aubergine and the brand bans red.  |

## 4. Two verdicts, two variants, a new deal every run

**The user's decisions, 2026-10-22, final.**

- **Seven characters, in walking order, each offering one skill. Take it or leave it**; there is no
  third verdict.
- **Every skill has a good and a bad variant.** They share the name, greeting, promise and card
  word for word, except that the bad card has **one extra or replaced line that plainly gives it
  away**: it follows a stranger's instructions, or quietly sends your note or basket somewhere
  else. Nothing before the card is opened differs. Each variant has its own short reveal line.
- **Every run is dealt at random**: a seed picks which three of the seven are good (35 deals); the
  other four are bad. Replaying meets the same characters with a different set of malicious ones.
- **Score out of 100.** The three good taken and the four bad left is 100, the only 100 in that
  deal. Taking any bad skill lets the wolf in (`wolf`) and ranks below every clean run. Greedy and
  leave-everything score low. The three-minute hard timer and the `late` ending stay.
- **Educational and fun:** short copy, quick decisions, and the bad line is the lesson -- a skill
  can do what it promises and still follow someone else's instructions.

## 5. What a skill needs, as data

Content is data (golden rule 3). Adding a skill must not require code. Each of the seven needs:

- **What it promises** — one line, in the character's voice, and it is always true.
- **What it actually does** — the inspect card: a short list for Take it, one line for Leave it,
  in a good and a bad variant one line apart (section 4).
- **What it did on the way** — for the reveal, and for a bad skill what it also did for the wolf. This is the new field and it carries the
  whole lesson. "Sent word ahead, so she expects you" and "sent word ahead, and the wolf reads the
  post" are the same sentence until the last clause.
- **Its cost in a hurry** — how long its card takes to read, which `sim.ts` counts from the words
  on the card the deal shows (section 9), so no number is written by hand.

**The mix:** three of seven dealt good each run (section 4), measured by play in `sim.ts`.

## 6. The reveal is the product

The payoff screen is the single most important thing in v2 and the only screen worth spending length
on. Everything else gets shorter; this gets clearer.

It must show, per skill the player took, in their own basket order:

- what it promised
- what it did
- and for the ones that served the wolf, **the sentence that makes the lesson land**

The client's own sketch, which is the target:

```
You collected 6 skills.  Nice haul.

  Night Light      kept its promise
  Word Weaver      sent word ahead... to the wolf
  Basket Helper    reached into your basket

  The wolf knew you were coming.    120 / 1000
```

Brand rules still bind: no red or green as status, purple tints plus shape and text, Lime once per
screen, sentence case, no emoji.

## 7. What this breaks, and none of it is optional

Named here so nobody discovers it mid-round.

- **`packages/core` is gated at 100% on statements, branches, functions AND lines.** The reducer,
  `scoring.ts`, `outcomes.ts` and `state.ts` all change shape, so their test suites are rewritten,
  not edited. This is the largest single cost in v2 and it is not negotiable — the gate is why the
  rules are trustworthy.
- **The leaderboard recomputes the score server-side** from the run log using core's own scoring
  function (golden rule 6). Changing scoring changes that contract: `apps/api` must move in the same
  change, and its 79 tests with it. **Any score already on the board becomes incomparable** — decide
  whether the table is cleared, and if it is, that is a data decision for the client, not for us.
- **The run log shape changes.** `runlog.ts` is what the server replays; a v1 log must not silently
  score as a v2 run.
- **A hard timer makes the e2e suite time-dependent.** Many of the 206 specs walk Purple slowly
  across the map and would now lose. The timer needs a test-mode override — and **the last gate of
  that kind shipped the debug handle to production**, so it uses dot access on `import.meta.env`,
  and `test/csp.test.ts` gets the new symbol added to the three names it already greps the bundle
  for.
- **Six or seven characters means map work.** v1 places three plus four bystanders. More pickups
  means more spawns, which means `forest-map.ts`, the cast-solid invariant, the connectivity flood,
  and one regeneration with every changed cell claimed.
- **PLAN.md phases 1, 3, 4 and 5 reopen.** The readiness sweep's functional findings mostly expire
  with v1; its security, privacy, accessibility and performance findings carry over and should be
  applied to v2 rather than re-derived.

## 8. Open, and needing the client

- **The landing page background.** They asked for it to be "branded more cyera maybe with a
  backround like this" — the reference image has not arrived. Nothing is invented in its absence:
  CLAUDE.md rule 5 forbids inventing brand assets.
- **The board's existing rows**, per §7.
- **Legal review** of the leaderboard and privacy copy still stands from v1
  (`docs/COPY_REVIEW.md`), and v2 adds player-facing copy rather than removing it.

## 9. Phase A: the rule decisions, as built

**In `packages/core/src/v2/`, beside v1 rather than over it**, exported as `import { v2 } from
'@otp/core'` so every bare name (`reduce`, `score`, `checkLog`) still means v1 until Phase D. Tests
are in `packages/core/test/v2/`, driven by a three-skill fixture (one dealt good, so three deals)
that is deliberately not the game. Rewritten 2026-10-22 for the random deal.

### Content shape

A skill is `{ id, name, icon, promise, good, bad }`, and each variant is strictly `{ card: { take:
string[], leave }, reveal }`. **There is one copy of everything before the card**, so a variant
cannot differ there: the schema refuses a variant carrying a name, promise, icon or greeting. The
lint refuses a bad card that is not the good card plus or instead of exactly one line (`giveaway()`
finds it), a different leave line, a giveaway over `GIVEAWAY_WORDS` (10), and two variants sharing a
reveal. `deal.good` says how many are good per run; a launch build needs seven skills, three good.

### The deal (`deal.ts`)

`deal(content, seed)` returns the run's good skills in content order. It is an unranking, not a
shuffle: `seed mod 35` is the deal's rank, so seeds 0 to 34 are every deal once (the tests and the
e2e switch use that), and a uniform 32-bit seed is a uniform deal. Core has no randomness: the game
draws the seed with `crypto.getRandomValues` and passes it to `createState(content, seed)` and to
`RESET { seed }`; a bad seed is refused (`bad-seed`). The state carries `seed` and `good`.

### Verdicts, clock, run log

- **`Verdict = 'take' | 'leave'`**, from the conversation or the card; reading is optional. A skill
  walked past counts as left.
- **`TIME_LIMIT_MS = 180_000`**, a rule constant, injected as elapsed ms since BEGIN. An action at
  or after the limit is not applied and the run ends `late`, stamped at the limit.
- **The run log is `{ rules: 2, content, seed, events }`.** The server deals from the seed and
  replays through the same reducer. **The seed is client-reported, like the timestamps**: a forger
  can post the one seed whose deal makes their basket careful. Closing that is the same fix as the
  clock's, a server-issued seed with the start token (Phase 9 step E).

### The score

`score(state, content)` is an integer 0 to 100; `result(state, content)` adds the ending, the
reveal (every offer in walking order, with its dealt variant's line and, for a bad one, the
giveaway line) and the counts.

| Run                        | Ending        | Total                          | Shipped weights  |
| -------------------------- | ------------- | ------------------------------ | ---------------- |
| any bad skill taken        | `wolf`        | 0                              | 0                |
| no bad skill taken         | `grandma`     | `clean + good × (taken)`       | 10 + 30 per good |
| out of time, or unfinished | `late` / none | 0 (the board reads the ending) |                  |

**Why 30 and 10.** Three good at 30 plus a clean arrival at 10 is exactly 100, so the only 100 is
careful. Leaving everything is safe but brings Grandma nothing: 10, the lowest clean score, so
caution without reading is not rewarded. Each good skill left costs 30, so one, two and three right
still rank. The wolf's 0 is a rule, not a weight, so every wolf run sits below every clean one.

### The trap, measured by play (`sim.ts`)

`loadContent` refuses content where careful misses 100 in any deal, or where **any card-blind
strategy averages above 40 over all 35 deals** (`ROTE_SHARE` 0.4). A player who never opens a card
sees nothing that differs between deals, so a blind strategy is one fixed basket; the best, "take
one", averages 17.1. What this guards is the weights. `clockCheck` plays careful in every deal at
the measured pace and reports the tightest one; it reads the card the deal shows, giveaway included
(200 words a minute, plus two button words and three seconds to decide).

## 10. Phase B: the content, as written

**Draft 6, 2026-10-22, `content/game.v2.json` (`2.0.0-draft.6`), guarded by
`packages/core/test/v2/real-content.test.ts`.** Every player-facing string needs the human copy read
(PAUL_BRIEF section 7).

### The seven skills, in walking order

Any of them can be good or bad in a given run. The giveaway is the one line the bad card adds or
swaps in; the good card's line it replaces is in brackets.

| #   | Character      | Skill          | The bad card's giveaway line                                     |
| --- | -------------- | -------------- | ---------------------------------------------------------------- |
| 1   | Rabbit         | Cottage Finder | Sends a copy of your note to a stranger. (added)                 |
| 2   | Toadstool      | Way Teller     | Follows any note pinned to a tree. (for "Keeps to the path…")    |
| 3   | Owl            | Word Weaver    | Leaves a copy at every crossing. (for "Shows it to nobody…")     |
| 4   | Magpie         | Short Cut      | Takes tonight's map from a stranger. (for "Draws them from…")    |
| 5   | Snail          | Slow Post      | Lets a friend peek inside on the way. (added)                    |
| 6   | Lantern Keeper | Night Light    | Does whatever the signs tell it to. (for "Leaves the choosing…") |
| 7   | Cat            | Latch Lifter   | Opens for anyone who knocks, any hour. (for "Stays shut…")       |

Two attack shapes, both plain on the card: **exfiltration** (the note copied to a stranger, left
at crossings, the parcel opened for a friend) and **instructions from someone else** (a note on a
tree, a stranger's map, the signs, anyone who knocks). Each bad reveal names the wolf; no card does.

### The table, as played over all 35 deals

| Run                    | Score                             | Ending      |
| ---------------------- | --------------------------------- | ----------- |
| careful (reads, sorts) | 100 in every deal                 | grandma     |
| greedy (takes all)     | 0                                 | wolf        |
| leave everything       | 10                                | grandma     |
| random (7,000 runs)    | 3.4 mean; about 1 run in 16 clean | mostly wolf |
| best wolf run          | 0                                 | wolf        |
| best card-blind basket | 17.1 mean ("take one, leave six") | mixed       |

In every deal exactly one of the 128 verdict combinations scores 100, and it is the careful one.

**The clock.** Walking twice the shortest four-connected path on today's map (108 tiles), a reader
who opens every card arrives at 2:49 in the tightest deal (Rabbit, Snail, Lantern Keeper and Cat bad: the four longest bad cards),
with **11.0 seconds to spare**. The longest tour that still fits is 128 tiles.

### History, briefly

Drafts 1 to 5 fixed one casting, first with three verdicts out of 1,000, then two out of 100.
Reviewers kept refuting them by finding what predicted the verdict before the card: vocabulary,
word and position rules, inflections, folklore, who claimed to make a skill. The random deal ends
that whole line of attack, so its guards (the word and position rote family, the folklore and
maker records) are deleted; kept are exhaustive play, the card-blind average, the glance bound read
from the client's sketch, "no card names the wolf", and the clock derived from the real map.

### Open, and needing a human

- **The copy read**: whether each giveaway is plain to a reader and each good card reads as safe.
  The Cat's "Grandma made it" now cuts both ways, which is the title's beat.
- **Four icons do not exist:** `item-signpost`, `item-parcel`, `item-shortcut`, `item-latch`.
  Nothing was drawn or substituted; the test keeps them on a ratchet list.
- **Portraits** exist for three of seven; v2's schema has no `portrait` field.
- **The reveal screen** is a UI call: the data covers every offer, taken or left.
