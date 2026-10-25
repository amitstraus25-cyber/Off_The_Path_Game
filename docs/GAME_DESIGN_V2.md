# Game design v2: collect, and find out what you collected

**Status: built and live (corrected 2026-10-22, at `3c88684`).** Decided with the client 2026-10-21,
and shaped by their rounds of 2026-10-22 (sections 4, 9, 10 and 11 record the result). This replaced
the v1 loop on `main` — there is no v1 branch, by their decision, and v1 itself has been removed
from the repository, so the v1 behaviour recorded in `docs/GAME_DESIGN.md` is history rather than an
alternative.

Read `docs/PAUL_BRIEF.md` first, then this. `docs/GAME_DESIGN.md` describes v1, is marked
superseded, and is a reference only for what this document does not say.

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
  word for word, except that the bad card has **one swapped line that plainly gives it away** (the
  same number of lines as the good card; see section 10 for why never an added one): it follows a stranger's instructions, or quietly sends your note or basket somewhere
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

(The sketch predates the scoring: the shipped score is out of 100, section 9.)

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
  change, and its 79 tests with it (`apps/api` has 202 now). **Any score already on the board becomes
  incomparable** — decide whether the table is cleared, and if it is, that is a data decision for
  the client, not for us. (Decided: the board reads only rows from `BOARD_SINCE`, and migration
  `0006_clear_v1_rows.sql` deletes the v1 rows; running it is the client's.)
- **The run log shape changes.** `runlog.ts` is what the server replays; a v1 log must not silently
  score as a v2 run.
- **A hard timer makes the e2e suite time-dependent.** Many of the 206 specs then (335 are listed
  now) walk Purple slowly across the map and would now lose. The timer needs a test-mode override — and **the last gate of
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
  backround like this" — the reference image has not arrived (promised for 2026-10-22). Nothing is
  invented in its absence: CLAUDE.md rule 5 forbids inventing brand assets.
- **The board's existing rows**, per §7: decided, and the delete is a human step
  (`supabase/migrations/0006_clear_v1_rows.sql`, not run from the repository).
- **Legal review** of the leaderboard and privacy copy still stands from v1
  (`docs/COPY_REVIEW.md`), and v2 adds player-facing copy rather than removing it.

## 9. Phase A: the rule decisions, as built

**In `packages/core/src/v2/`**, exported as `import { v2 } from '@otp/core'`. It was built beside v1;
v1 is removed now and `v2` is the only rulebook core has (core also keeps `camera` and
`leaderboard`). Tests are in `packages/core/test/v2/`, driven by a three-skill fixture (one dealt
good, so three deals) that is deliberately not the game. Rewritten 2026-10-22 for the random deal.

### Content shape

A skill is `{ id, name, icon, promise, effect, realWorld, good, bad }`, and each variant is strictly
`{ card: { take: string[], leave }, reveal }`. **There is one copy of everything before the card**,
so a variant cannot differ there: the schema refuses a variant carrying a name, promise, icon,
greeting or effect -- so a good and a bad copy of a skill do exactly the same thing in the forest
(section 11). The lint refuses a bad card that is not the good card with exactly one line swapped, same
line count (`giveaway()` finds it; an added line is refused), a different leave line, a giveaway
over `GIVEAWAY_WORDS` (10), two variants sharing a reveal, and a `realWorld.note` over
`REAL_WORLD_WORDS` (25) or two sentences. `deal.good` says how many are good per run; a launch build
needs seven skills, three good.

`realWorld` is `{ term, note }`: the real cybersecurity idea the skill's forest story stands for, and
one or two plain sentences linking them, for the reveal. One per skill, shared by both variants.

`ui` is every other word the v2 screens say, strictly keyed (an unknown or missing key fails the
schema): `landing`, `howTo` (three or four steps), `cabinet`, `world`, `offer`, `card`, `hud`
(exactly the HUD's `HudLabels`), `reveal`, `chrome` (a strict object of `v2.CHROME_KEYS`) and
`contact` (the work email's lines and its consent version). A `titleHighlight` must be a word of its title. The endings stay in `endings`. The old
free-form `strings` record is gone, so a screen cannot read a key that was never validated.

### The deal (`deal.ts`)

`deal(content, seed)` returns the run's good skills in content order. It is an unranking, not a
shuffle: `seed mod 35` is the deal's rank, so seeds 0 to 34 are every deal once (the tests and the
e2e used them when the game had a seed pin), and a uniform 32-bit seed is a uniform deal. Core has no randomness: the game
takes the seed from `POST /api/start` (the server signs it into the run's token) and falls back to
`crypto.getRandomValues` when the start does not answer, then passes it to
`createState(content, seed)` and to `RESET { seed }`; a bad seed is refused (`bad-seed`). The state carries `seed` and `good`.

### Verdicts, clock, run log

- **`Verdict = 'take' | 'leave'`**, from the conversation or the card; reading is optional. A skill
  walked past counts as left.
- **`TIME_LIMIT_MS = 180_000`**, a rule constant, injected as elapsed ms since BEGIN. An action at
  or after the run's deadline is not applied and the run ends `late`, stamped at the deadline. The
  deadline is the limit plus whatever a `rewind` perk gave back (`deadlineMs`, perks.ts); stamps
  stay real elapsed time (section 11).
- **The run log is `{ rules: 2, content, seed, events }`.** The server deals from the seed and
  replays through the same reducer. **The seed is client-reported, like the timestamps**: a forger
  can post the one seed whose deal makes their basket careful. Closing that is the same fix as the
  clock's, a server-issued seed with the start token (Phase 9 step E, done: `POST /api/start`).

### The score

`score(state, content)` is an integer 0 to 100; `result(state, content)` adds the ending, the
reveal (every offer in walking order, with its dealt variant's line and, for a bad one, the
giveaway line), the counts, and since 2026-10-22 the two parts of the total (`choices`, `speed`),
the arrival time on the run clock (`timeMs`, the stamp less any rewind), what a rewind gave back
(`rewoundMs`) and the par it was measured against (`parMs`).

**The client's decision, 2026-10-22: "a combination of time and correct answers". Correctness
first, then speed.**

**And the client's floor, 2026-10-25: "anyone who starts playing automatically gets 25, so they can
at least leave their email".** Every run that ENDS scores `played`, and every ending posts to the
board; the board was reset for it (`BOARD_SINCE`, apps/api/src/store.ts).

| Run                 | Ending    | Total                                                              |
| ------------------- | --------- | ------------------------------------------------------------------ |
| any bad skill taken | `wolf`    | `played`, however fast                                             |
| no bad skill taken  | `grandma` | `played` + `clean` + `good` × good taken + `speed` × f(t) × good/3 |
| out of time         | `late`    | `played`                                                           |
| unfinished          | none      | 0                                                                  |

Shipped weights since 2026-10-25: `played` 25, `clean` 15, `good` 15, `speed` 15, so
25 + 15 + 45 + 15 = 100 (they were `clean` 10, `good` 20, `speed` 30, and a wolf or late run 0 and
not posted, from 2026-10-22). Every wolf run still ranks below every clean one (25 against at least
40), and a full basket at the buzzer (85) still beats the fastest basket one good skill short (80). **f(t)** is 1 at or
under par, falls in a straight line to 0 at 3:00, and is never negative; t is the run's own
`arrived` stamp less what a rewind gave back, the stamp itself being what the server bounds from above by its clock and from below by the walk the log
describes (apps/api). The bonus is rounded to a whole point with integer arithmetic until the one
division, so browser and server cannot round apart (`speedBonus`, scoring.ts).

**Par is 1:47 (`scoring.parMs` 107000), derived, not chosen.** It is the arrival time of a careful
run that walks the shortest content-order tour of the shipped map once (113 four-connected tiles at
`WALK_SPEED`, about 30 s, since the Cat moved into the clearing on 2026-10-22), knocks at the door (`world.knockMs`, 3 s) and reads every greeting and every
card at `v2.BRISK` -- 238 words a minute, the Brysbaert meta-analysis rate the clock check's 200 is
slowed from, with no pause to decide -- in the slowest of the 35 deals, **with no perk saving any
time** (the no-perk tour: every leg walked, the knock paid, the raw stamp). Measured at 106.7 s
(1:46.7) on draft 8 on 2026-10-22 (an earlier line here said 1:45.1, which was the figure before the
Cat moved); the content holds par at or above that and within ten seconds of it
(`test/v2/real-content.test.ts`), so a copy edit that lengthens a card moves the test, not the
players. A basket whose good three include a time perk beats par more easily: the fastest brisk
careful run with its perks counts about 1:20 on the run clock, 80.5 s (the deal whose good three are
Word Weaver, Slow Post and Long Evening: no knock, a faster walk and twenty seconds back; 99.8 s
raw in the fastest deal and 100.5 s in this one, less the rewind). That is the perk, not a second
par.

| Run                          | Score |
| ---------------------------- | ----- |
| three good, at or under 1:47 | 100   |
| three good, 2:00             | 97    |
| three good, 2:30             | 91    |
| three good, 2:59             | 85    |
| two good, 1:00 (fast)        | 80    |
| two good, 2:30               | 74    |
| one good, 1:00               | 60    |
| leave everything, 0:30       | 40    |
| any bad skill, any time      | 25    |
| out of time                  | 25    |

**Why this shape.** 100 needs all three good AND a fast run. The bonus is scaled by the good skills
taken, so leaving everything earns 40 at any speed and speed can never be a substitute for reading.
Two good and fast (80) never beats three good at any pace that arrives (85 at the buzzer); the lint
refuses weights where it could (`speed × (n-1) ≤ good × n`). That a wolf run keeps `played` and
nothing more is a rule, not a weight, so every wolf run sits below every clean one. From 2026-10-22
a wolf run scored 0 and was not posted; since the floor of 2026-10-25 it posts at 25 -- the reveal
is still where it teaches, and the board still ranks it under every run that kept the wolf out.

### The trap, measured by play (`sim.ts`)

`loadContent` refuses content where careful misses 100 in any deal, or where **any card-blind
strategy averages above the rote line over all 35 deals**: `played` plus `ROTE_SHARE` (0.4) of the
rest, 25 + 30 = 55 with the shipped weights (it was 40 before the floor). A player who never opens a
card sees nothing that differs between deals, so a blind strategy is one fixed basket; the best,
leaving everything or "take one", averages 40 (it was 17.1). What this guards is the weights. `clockCheck` plays careful in every deal at
the measured pace and reports the tightest one; it reads the card the deal shows, giveaway included
(200 words a minute, plus two button words and three seconds to decide). Since draft 8 it charges
the knock at the door and gives a careful basket the time its perks save, holding each run to its own
deadline; with `{ perks: false }` it plays the no-perk tour against the bare three minutes.

## 10. Phase B: the content, as written

**Draft 8, 2026-10-22, `content/game.v2.json` (`2.0.0-draft.8`), guarded by
`packages/core/test/v2/real-content.test.ts`.** The seven skills below are the set the client
approved in chat on 2026-10-22 after several reviews: names, promises, icons, giveaway lines, bad
reveals, lessons and perks are theirs, word for word, and are not to be re-litigated. The good
cards' other lines, the leave lines, the good reveals, the real-world notes and three greetings
were written to fit them and still need the human copy read (PAUL_BRIEF section 7).

### The seven skills, in walking order

Any of them can be good or bad in a given run. Every card has two take lines; the giveaway is the
one the bad card swaps in, at the place shown, for the good line in brackets. Every good reveal
names the perk the player enjoyed; every bad reveal names the perk and the harm, and the wolf.

| #   | Character      | Skill        | Icon             | Perk (section 11)       | The bad card's giveaway line                                                |
| --- | -------------- | ------------ | ---------------- | ----------------------- | --------------------------------------------------------------------------- |
| 1   | Rabbit         | Wood Map     | `item-compass`   | `minimap`               | Sends your map to a stranger. (2nd, for "Keeps the map for you alone.")     |
| 2   | Toadstool      | Way Teller   | `item-signpost`  | `fork-signs`            | Obeys any note pinned to a tree. (2nd, for "Trusts only its own…")          |
| 3   | Owl            | Word Weaver  | `item-weaver`    | `early-welcome`         | Pins a copy up at every crossing. (2nd, for "Folds it shut, for her…")      |
| 4   | Magpie         | Wing Ride    | `item-wings`     | `wing-ride`, 2 s flight | Takes tonight's route from a stranger's map. (1st, for "Plans tonight's…")  |
| 5   | Snail          | Slow Post    | `item-parcel`    | `walk-faster`, x1.15    | Lets a friend peek inside on the way. (2nd, for "Opens for Grandma's…")     |
| 6   | Lantern Keeper | Night Light  | `item-lantern`   | `lantern`               | Goes wherever the signs say, without asking you. (1st, for "Waits for…")    |
| 7   | Cat            | Long Evening | `item-hourglass` | `rewind`, 20 s          | Asks for the key to Grandma's door too. (2nd, for "Asks for nothing else.") |

| Skill        | Promise                                               | Good reveal                                        | Bad reveal                                         |
| ------------ | ----------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Wood Map     | It draws you a map of the whole wood.                 | Drew the wood as you walked. Kept the map for you. | Your map went to the wolf. He knew where you'd be. |
| Way Teller   | It shows you who lives down each path.                | Showed you who lived down each path.               | One note on a tree was the wolf's. It obeyed.      |
| Word Weaver  | It sends word ahead, so Grandma expects you.          | Sent word ahead. She was expecting you.            | She expected you. So did the wolf.                 |
| Wing Ride    | It flies you to your next friend on the path.         | Flew you to your next friend.                      | It flew you where the wolf's map said.             |
| Slow Post    | It carries your heavy things, sealed. You walk light. | You walked faster. It reached her, sealed.         | It reached her. The peeking friend was the wolf.   |
| Night Light  | It lights your way when the sun goes down.            | Lit your way as dusk fell.                         | One sign was the wolf's. The light followed it.    |
| Long Evening | It holds back the dark a little longer.               | Held back the dark. You had more time.             | You had more time. The wolf had her key.           |

The swap is on the first line in two skills and the second in five; a real-content test fails if
every swap stands on one line. Each bad reveal names the wolf; no card does. **The reveal-length
guard moved:** it was the client's sketch (section 6, six words a row), and two approved bad
reveals have eight-word sentences, so the bound is now the giveaway limit (`GIVEAWAY_WORDS`, 10),
not the longest line the content happens to have.

Skill ids are unchanged (`cottage-finder`, `short-cut` and `latch-lifter` now carry Wood Map, Wing
Ride and Long Evening) because ids are internal and the game's tests and e2e name them; no screen
shows an id.

### What each skill stands for (`realWorld`, for the reveal)

| Skill        | Term                            | Note                                                                                                                   |
| ------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Wood Map     | Data exfiltration               | Your map is your data. A skill can do its job and still send that data to someone you never chose.                     |
| Way Teller   | Indirect prompt injection       | A skill that obeys text it reads on the way, like a note on a tree, lets whoever wrote it take charge.                 |
| Word Weaver  | Oversharing and public exposure | A copy pinned at a crossing is public data anyone can read. Sending word ahead should not mean telling the whole wood. |
| Wing Ride    | Supply-chain risk               | A skill that fetches its instructions from someone else can change after you said yes, like a map redrawn overnight.   |
| Slow Post    | Third-party data sharing        | A friend who peeks is a third party you never agreed to. A skill can deliver your data and share it along the way.     |
| Night Light  | Autonomy without human approval | A helper that acts on every sign without asking leaves you out. Keep a human in the loop for steps that matter.        |
| Long Evening | Over-broad access               | A skill is an identity too, a non-human one. Give it only the access its job needs.                                    |

Each is one or two sentences of at most 25 words (the lint), with no fear words and no product
claims. Checked against `docs/RESEARCH_ALIGNMENT.md` as before: exfiltration, indirect prompt
injection, supply-chain risk, over-broad access and human approval are supported there; **for
research to confirm**: "oversharing and public exposure" and "third-party data sharing" are not
named in the research we read, and the Long Evening note now says "non-human identity" outright,
which is the client's framing and research's to confirm.

### The screens' words (`ui`)

`landing`: title, titleHighlight, subtitle, start. `howTo`: title, steps (four lines: walk, open and
read each card, take or leave, reach Grandma's door before 3:00 -- the time is held to
`TIME_LIMIT_MS` by a real-content test). `hud`: time, basket, twoMinutes, oneMinute, thirtySeconds,
timeUp. `reveal`: title, titleHighlight, took, left, good, bad, promised, did, giveaway, realWorld,
score, question, cta, again. The three endings are `endings.grandma`, `.wolf` and `.late`.

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

**The clock.** Walking twice the shortest four-connected path on today's map (113 tiles: rabbit 7,
toadstool 3, owl 19, magpie 34, snail 9, lantern keeper 10, cat 16, cottage 15), a reader who opens
every card arrives in the tightest deal with **1.1 seconds to spare with no perk helping** (the
no-perk tour, knock paid) and 2.0 seconds with the perks the careful basket takes. The longest tour
that still fits with no perk is 115 tiles. All of these were measured on 2026-10-22 (the same
helpers as `real-content.test.ts`, run apart from it); this paragraph used to say 107 tiles, 4.3 s
and 5.2 s, which were the figures before the Cat moved into the clearing (107 to 113 tiles). The
margin was 13.4 s on draft 7; the 3 s knock and the longer approved cards took most of it, and the
Cat's move (six more tiles, doubled, at 3.75 tiles a second: 3.2 s) took the rest. It is a conservative model (the walk doubled, 200 words a minute,
three seconds to decide on every card), so 1.1 s is honest rather than alarming, but it is the
number to watch if a card grows or a character moves.

### History, briefly

Drafts 1 to 5 fixed one casting, first with three verdicts out of 1,000, then two out of 100.
Reviewers kept refuting them by finding what predicted the verdict before the card: vocabulary,
word and position rules, inflections, folklore, who claimed to make a skill. The random deal ends
that whole line of attack, so its guards (the word and position rote family, the folklore and
maker records) are deleted; kept are exhaustive play, the card-blind average, the glance bound (the
client's sketch until draft 8, the giveaway limit since), "no card names the wolf", and the clock
derived from the real map. Draft 8 is the client's approved set, with a perk on every skill.

### Open, and needing a human

- **The copy read**: whether each giveaway is plain to a reader and each good card reads as safe;
  the lines written to fit the approved set (good cards' other lines, leave lines, good reveals,
  real-world notes, the Rabbit's, Toadstool's and Magpie's greetings) are DRAFT. The Cat's
  "Grandma made this for you" cuts both ways, which is the title's beat.
- **Icons: all seven exist** (checked 2026-10-22: every skill's `icon` is in `manifest.json`, and
  `AWAITING_ART` in `real-content.test.ts` is empty). `item-wings` and `item-hourglass` were drawn
  with the perks (`c86b11e`). `item-shortcut` and `item-latch` are no longer used by any skill, and
  nor are `item-translator`, `item-key` and `item-letter`.
- **Portraits** exist for three of seven; v2's schema has no `portrait` field.
- **The reveal screen** is a UI call: the data covers every offer, taken or left.

## 11. The perks (2026-10-22)

Every taken skill now does something in the forest, so collecting is worth something before the
reveal says what it cost. **The effect is the skill's, not the variant's**: a good and a bad copy
do exactly the same thing, so nothing in the forest tells them apart; only the card and the reveal
do. No perk points at the cottage, by construction: none of the kinds can.

**The data.** `skills[].effect` is one of (content.ts `EFFECT_KINDS`, schema-validated, strict):

```
{ kind: 'minimap' }                           the minimap is drawn from the take on; none without it
{ kind: 'fork-signs' }                        a sign at each fork: who lives that way (nearest unmet)
{ kind: 'early-welcome' }                     word went ahead ("No need to knock. Word went ahead of you."): the knock beat is skipped
{ kind: 'wing-ride', flightMs: 2000 }         once, at the take, a flight to wingRideTarget()
{ kind: 'walk-faster', factor: 1.15 }         Purple walks 15% faster for the rest of the run
{ kind: 'lantern' }                           a warm light circle around Purple in the dusk
{ kind: 'rewind', ms: 20000 }                 20 s back on the time left AND off the counted time
```

and the top-level `world` is `{ knockMs: 3000, dusk: { fromLeftMs: 120000, darkest: 0.45 } }`: the
knock at the door every arrival waits through but an early-welcome one, and the dusk, which comes on
**for everyone** from 2:00 left on the HUD and deepens in a straight line to `darkest` (the share of
light taken away; the schema caps it at 0.5) at time up. Adding a skill needs no code unless it needs
a new kind.

**The rules (`packages/core/src/v2/perks.ts`, `reducer.ts`).** A take records `state.perks`, a list of
`{ s, at, ...effect }` in the order taken; a wing ride adds `to` (who it lands beside, or null) and a
rewind's `ms` is what was actually given back (never past the start of the run). Perks are NOT logged:
each is a pure function of the log's own take verdict, so the server re-derives every one. Two clocks:
every stamp is REAL elapsed time, which the server bounds against its own clock; the RUN clock is that
less the rewinds (`clockMs`), and it is what the HUD shows, the speed bonus counts (`result().timeMs`)
and the dusk follows. The late rule uses the run's deadline, `TIME_LIMIT_MS + rewoundMs`, and a late
run is stamped there. The world reads: `hasPerk(state, kind)`, `walkFactor(state)`,
`wingRideTarget(content, met, giver)`, `timeLeftMs(state, at)`, `deadlineMs(state)` (fire TIME_UP
there, not at `TIME_LIMIT_MS`), `duskAt(content, state, at)`.

**The server.** The walk floor (floor.ts) reads the perks off the take verdicts too: legs after a
faster-walk take are walked at x1.15; a wing-ride take charges `flightMs` and lands Purple on her
target's talking spot; every arrival is charged `knockMs` unless an early-welcome was taken. So the
game must hold the flight and the knock at least that long on the clock. The route's bounds are
unchanged and still on real time; `apps/api/test/perks.test.ts` posts an honest run with each perk,
a run at its own perked floor, a rewound run arriving after 3:00, and the forgeries around them.
