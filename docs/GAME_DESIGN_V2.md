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

  Forest       six or seven characters along the path, each offering ONE skill.
               Talk. Inspect what it actually does. Take it, limit it, or leave it.
               Nothing stops you taking everything. Nothing warns you.

  Cottage      the door. The reveal: what each skill in your basket did on the way.
               Some kept their promise. Some kept their promise AND served the wolf.

  Score        out of 1,000. A full basket of the wrong things scores near zero.
```

### Decisions already made, do not re-litigate

| What              | Decision                                                              |
| ----------------- | --------------------------------------------------------------------- |
| Scoring           | **Greedy is punished.** Score is what the skills DID, never how many. |
| Timer             | **Hard, three minutes.** Running out is its own ending.               |
| Skills to collect | **Six or seven.**                                                     |
| v1                | **Replaced on `main`.** No fallback branch.                           |
| Character name    | **Purple**, not Red — her cloak is aubergine and the brand bans red.  |

## 4. Keep three verdicts, not two

"Take it or leave it" is the obvious reading of the brief and it is worse. **Restrict is the most
interesting verdict in the game** — it is the one that maps to what a careful person actually does
with an agent, which is neither trust nor refuse but _scope_. v1 earns real teaching from it: Word
Weaver restricted scores 50 and still satisfies an errand goal.

So the three verbs survive, in collection language:

- **Take it** — full capability, full benefit, full exposure.
- **Take it, limited** — the capability with a boundary on it. Usually the right answer and usually
  worth fewer points than taking a genuinely safe skill in full.
- **Leave it** — no exposure, no benefit, and a goal you may fail for want of it.

**The trap stays the trap:** at least one skill must be one where taking it in full is the best
outcome available, so "restrict everything" is not a winning strategy a player can learn by rote. v1
resolved this with reject-all at 700 against a 1,000 ceiling; v2 needs the equivalent measured
rather than assumed.

## 5. What a skill needs, as data

Content is data (golden rule 3). Adding a skill must not require code. Each of the six or seven
needs:

- **What it promises** — one line, in the character's voice, and it is always true.
- **What it actually does** — the inspect card. Three verbs, three one-line explanations, which is
  the shape the client approved in v1 and the best thing in that round.
- **What it did on the way** — per verdict, for the reveal. This is the new field and it carries the
  whole lesson. "Sent word ahead, so she expects you" and "sent word ahead, and the wolf reads the
  post" are the same sentence until the last clause.
- **Its cost in a hurry** — how long inspecting it takes against a three-minute clock.

**The mix:** of six or seven, roughly two genuinely safe in full, three that are safe only when
limited, and two that are dangerous however they are taken. Those exact proportions are to be
**measured through `pnpm sim`**, not chosen here — the ceiling, the greedy floor and the
restrict-everything line all have to come out right, and that is arithmetic, not taste.

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

**Built 2026-10-21 in `packages/core/src/v2/`, beside v1 rather than over it.** Production runs
v1, and `apps/game` and `apps/api` import it from core, so v2 is exported as a namespace
(`import { v2 } from '@otp/core'`) and every bare name (`reduce`, `score`, `checkLog`) still means
v1. Phase D switches the game over. No v1 file changed; the 214 v1 tests pass untouched. Tests are
in `packages/core/test/v2/`, driven by a three-skill fixture that is deliberately not the game.

These are the decisions the spec left open. Each is enforced by a named test, and each was proved
by breaking the code and watching that test fail.

### The verdicts and the basket

- **`take`, `limit`, `leave`.** Take and leave can be given straight from the conversation (on the
  offerer's word, or on sight). **Limit needs the card to have been read**, because a boundary
  names what to strip and nothing has been named yet. That is v1's rule, kept. It is also what lets
  the server refuse a forged careful verdict. Once read, a card stays read: going back to the
  conversation does not unread it.
- **Leaving does nothing, by rule rather than by data.** The schema refuses a `did.leave` entry. A
  skill that was left earned nothing and served nobody, and content cannot say otherwise.
- **The basket is an ordered inventory of `{ skill, verdict }`**, in the order things were taken.
  Left skills are not in it. A skill walked past with no verdict counts the same as one left.
- **Not carried over from v1:** the questions (`ASK`) and the errand goals. The spec's loop does not
  mention them. If Phase B wants dialogue, it is unscored data. If it wants goals back, that is a
  rules change and goes through this section.

### The clock

- **`TIME_LIMIT_MS = 180_000` is a rule constant, not content.** The server replays every run
  against it, and a content edit that moved it would quietly change what "in time" meant for runs
  already played.
- **Injected, as elapsed milliseconds since BEGIN.** Every action inside the run carries `at`, and
  the log records it. The log is self-contained: the server needs no start time. Time only goes
  forward, and that includes BACK, which is timed but not logged. NaN, infinite and negative times
  are refused.
- **An action that arrives at or after the limit is not applied, and the run ends late instead.**
  This holds whatever the action was: legal or not, even the step through the cottage door. The
  late event is stamped at the limit, not at whenever the news arrived. This is the one refusal
  that changes the state (`reason: 'out-of-time'`, carrying the late state), because the clock
  that refused the action has itself ended the run. The reducer does not wait for the game's
  `TIME_UP`: a backgrounded tab throttles timers, so `TIME_UP` can arrive late or never.
  **179,999 ms is in time and 180,000 is not.**
- **`TIME_UP` before the limit is refused** (`time-not-up`), so a fast or buggy timer cannot end a
  run early. After arrival the clock no longer matters, so nothing can make a run late once it is
  in the cottage.
- **Phase F's test-mode override belongs in the clock the game injects, not in core.** Slow the
  clock, not the limit. Core keeps exactly one limit, so a second one can never ship.

### The score

- **`worth = points − wolfCost if it served the wolf`, with leave always 0. The total is
  `max(0, Σ worth)` over the basket.** There is no bonus for collecting. Content carries
  `scoring.outOf`, `scoring.wolfCost`, and for each skill `did.take` and `did.limit` as
  `{ line, points, wolf? }`. The presence of `wolf` is the fact that gets scored. Phase B tunes all
  of it without code.
- **A late run scores `null`, not 0.** It is an ending, not a number, and it does not go on the
  board. The reveal is still computed for it, in case Phase D wants to show what was carried.
- **Endings are a rule; their copy is content.** `late` if the clock ran out. Otherwise `wolf` if
  any skill in the basket served the wolf, and `grandma` if none did.

### What the content lint holds, whatever the numbers are

- A limit never earns more than taking the skill in full, and never serves the wolf when taking it
  in full does not. A boundary only removes.
- **A verdict that served the wolf must be worth less than 0.** It must leave the player worse off
  than leaving the skill, not merely worse off than limiting it. This is the thesis written as a
  rule: if "take it anyway, the points outweigh the wolf" were a correct reading of the card, the
  game would teach the opposite of its lesson.
- **The best possible run must score exactly `outOf`.** "Out of 1,000" is a promise to the player.
- A launch build has six or seven skills and no PLACEHOLDER text. The vendor-word ban is copied from
  v1, which does not export its list. Until Phase D retires v1, the two lists are kept in step by
  hand.

### The trap, measured by play (`sim.ts`). `loadContent` refuses content that fails any of these

| Property                                             | Bound                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| careful reaches the ceiling                          | careful run = `outOf`, played, not just summed                                                             |
| careful is the only run at the ceiling               | exactly one of all 3^n combinations scores `outOf`                                                         |
| greedy scores near zero                              | take-everything ≤ 20% of `outOf` (`GREEDY_SHARE`)                                                          |
| greedy lets the wolf in                              | take-everything ends `wolf`                                                                                |
| no rule of two clauses or fewer beats the rote line  | every constant, one- and two-clause rule over shared words and the first / last offer ≤ 70% (`ROTE_SHARE`) |
| limiting never scores below taking in full           | where taking in full serves the wolf, `worth(limit) ≥ worth(take)`                                         |
| no run that let the wolf in comes near a careful one | the best of all 3^n combinations that ends `wolf` ≤ 60% of `outOf` (`WOLF_SHARE`)                          |
| taking in full / limiting / leaving is best          | each is the strictly best verdict for ≥ 1 skill                                                            |

**Changed 2026-10-21 (Phase B rework).** The middle three rows replaced "limiting everything is not
a strategy" (limit-everything ≤ 70%), which judged the space by one named strategy and was beaten by
a strategy nobody named; section 10 records how. The space is now **enumerated**: `everyRun` plays
every verdict combination through the reducer (2,187 for seven skills, about 25 ms), and
`roteRuns` builds every rule a player can follow without opening a card from the content's own
words, so the family moves with the copy. A word counts as a candidate tell when two or more skills
say it before their cards are read; a word one skill alone says names that skill, not a pattern.
Two-word decision lists are the deepest checked on every load (`ROTE_DEPTH`), and the check's name
says so: a refuter of the second content showed three-word lists reaching 850 where two-word lists
stopped at 650, so "no rule read off the cast" was a claim the check never made. Depth three is
measured once, on the real content, in its test suite (section 10).

**Added in the fourth draft: where an offer stands is a clause.** A refuter of draft 3 found the one
skill best taken in full was the first offer met from the spawn, and "take the first offer" on top
of the best two-word rule scored 850 clean: no word check could see it, because nobody says a
position. `roteRuns` now adds `the first offer` and `the last offer` (content order, which is the
walking order) to the candidate tells. Each is one clause and counts toward the depth like a word, so
the check that runs on every load covers a position with one shared word, and both positions
together; the name changed from "two words" to "two clauses" to say so. A rule that decides every
skill by a clause of its own is not counted: that is the cast memorised, and it can only happen when
a position comes first in a cast no bigger than the depth plus one -- the three-skill fixture, never a
launch cast of six or seven at depth three or less. The fixture's order changed for the same reason:
its lantern was met first and its locksmith last, which made every "fails on its own" proof fire the
rote line too (`test/v2/fixture.ts`).

**Added in the second rework: partial caution is never punished.** Where taking a skill in full
lets the wolf in, limiting it must be worth at least as much. The second content had Way Teller
limited at -550 against -500 in full, so a player who read the card and set a boundary scored below
one who took it without reading. With the lint's two rules (a limit never earns more, and never
serves the wolf when the take does not), this binds exactly the skills that serve the wolf both
ways: their limit must earn what their take earns. It is independent of every other check; the
fixture's old locksmith (take 100, limit 50) passes all of them and fails this one alone. For a
skill safe in full, limiting still costs something, on purpose: that is what keeps "limit
everything" from being a strategy.

The 20% bound comes from the spec's own sketch, which scores a six-skill greedy haul 120 / 1000.
It does not come from the fixture. Every property is proved by an edit to the fixture that makes
it fail (`test/v2/sim.test.ts`). Where an edit can be made lint-clean, the test asserts that it
is, so the trap is the only thing that refuses it.

**Two checks are now implied by others, and that is recorded rather than hidden** (PAUL_BRIEF
trap 5). Limiting best somewhere and leaving best somewhere each force a take that serves the wolf,
on two different skills (a strict best over taking needs a wolf on the take, because a limit can
never out-earn it). The wolf bound makes each such take lose at least 40% of the ceiling, so greedy
keeps at most 100 − 2 × 40 = 20%: exactly `GREEDY_SHARE`. And "greedy lets the wolf in" follows from
those same wolf-serving takes. Both stay, because they name greed, and because raising `WOLF_SHARE`
would make the first independent again. Their tests no longer claim they fail alone.

**Limit-everything is covered, not dropped.** It is the constant rule `everything -> limit` in the
rote family, and the 998-of-1,000 counterexample that refuted the margin-free version is still a
test; it is now refused twice over (the rote line, and a wolf run at 999).

**Leave-everything always scores 0.** That follows from the rule that leaving is nothing. v1 had
reject-all at 700; v2 has no equivalent, because leaving everything brings Grandma nothing. Both
extremes lose. **If the client wants refusal to score something, that is a decision for them,
not a tuning knob.**

### The run log

- **`{ rules: 2, content: <content version>, events: [...] }`, with events keyed `e`.** A v1 log
  is a bare array whose events are keyed `t`, and both schemas are strict. So neither version's log
  parses as the other's, whether in its envelope or stripped out of it. That is tested for every
  event kind of both. The key matters because three of v1's kinds (met, inspected, arrived) have
  exactly the fields v2's do.
- A log played under different content is refused (`content-mismatch`) rather than replayed into
  rules it was never played by. The event cap reuses v1's `MAX_LOG_EVENTS`.

### Open, and needing a human

- **"Read every card and arrive late"** (§2) can be read as a design target, meaning reading every
  card must NOT fit. Phase A reads it the other way. If a player who reads every card cannot arrive
  in time, the ceiling is out of reach and "out of 1,000" is a lie on the board. `clockCheck` tests
  that a careful reader arrives, and reports the margin. The margin is meant to be small, not
  negative. **The world's pace (walk and talk time) has no default.** It must come from the map
  Phase C builds, not from a number written down here.
- `inspectMs` is the simulator's model of reading time, and the reducer never charges it. Real
  reading takes real time on the injected clock.
- **Bundle cost until Phase D: measured at 886 bytes.** v2's top-level zod schemas cannot be
  tree-shaken out of the game bundle (1,414,212 bytes of JS with the export, 1,413,326 without),
  even though nothing in the game calls v2. They are inert. Dropping the `v2` export line until
  Phase D would remove them, at the cost of a deep import for Phase B's simulator.

## 10. Phase B: the content, as written

**Draft 4, written 2026-10-21 in `content/game.v2.json` (`2.0.0-draft.4`), guarded by
`packages/core/test/v2/real-content.test.ts`.** Draft 4 is draft 3 with the third refutation fixed
(below): the numbers are unchanged, the copy changed where a word sorted the cards, every character
now says who made its skill, and the cast is re-ordered so where an offer stands teaches nothing. It loads through `v2.loadContent(raw, { launch: true })`
with no issues: the schema, every lint rule and every trap check. v1's `content/game.json` is
untouched and still what production plays. **Every player-facing string in the file is new and needs
the human copy read PAUL_BRIEF section 7 requires**; none of it is leaderboard or privacy copy, so
Legal is not needed for it. **Phase 9 B is not ticked in PLAN.md**: the lead ticks it after the
checks pass.

### The first draft, and why it was refuted

Recorded so nobody rebuilds it. The first draft (`2.0.0-draft`, seven skills) was refuted by two
adversarial reviewers. **Every mechanical claim reproduced**: it loaded clean, the simulator totals
were right, coverage was 100%, v1 was untouched and the seven v1 voices were kept. What failed was
what it TAUGHT and how it was SCORED.

- **It taught vocabulary, not inspection.** Toadstool and Owl both got their skill from "a kind
  traveller" and both were the dangerous ones; Rabbit and Magpie sold on popularity and both were safe
  only limited. "Leave anyone whose greeting says traveller, limit anything popular, take the rest"
  got six of seven right before any card was read. "Limit everyone, leave the two travellers" scored
  **750 with the clean ending**, over the 70% line, and the trap missed it because it only ever scored
  pure limit-everything.
- **Being compromised cost almost nothing.** `wolfCost` was 300, the floor the lint allowed. Taking Way
  Teller in full cost 50 points, so a run that let the wolf in scored **950 and outranked a clean
  900**. Seven of the top twelve combinations ended with the wolf: on the board, the wolf was a
  rounding error. That contradicts the thesis.

Both were fixed at the cause. The trap now enumerates every combination and every rule a player can
read off the cast (section 9), and the wolf costs enough that no compromised run comes near a
careful one.

### The second draft, and why it was refuted

Recorded for the same reason. The second draft (`2.0.0-draft.2`) passed every check it had, and a
second pair of refuters showed that the checks were measuring the wrong things. In their order:

- **Folklore was the tell.** The Toadstool (poison) and the Magpie (thief) offered the two skills best
  left and the Owl (wisdom) the one best taken. "Leave the toadstool and the magpie, limit the rest"
  scored 750 clean and adding "take the owl" scored 900, with no card read. No word check could see
  it, because each character's name is said by one skill only.
- **Provenance was backwards.** The Owl's "a traveller left this with me", the supply-chain cue that
  RESEARCH_ALIGNMENT sections 3 and 4.4 ask to make load-bearing, was on the skill best taken in full,
  and v1's exfiltrator (Word Weaver, "sent word ahead... to the wolf" in the client's own sketch) had
  become safe.
- **Partial caution was punished.** Way Teller limited was worth -550 against -500 in full, so a
  player who read the card and limited it scored 450 and one who took it unread scored 500.
- **The Tally Post rule did not match its own harm** (refutation f, again). It made the same promise as
  Word Weaver; its harm was the public channel, a capability BESIDE the job, which the rule said a
  limit removes, and its card's limit did not remove it.
- **Two icons were v1's starting basket** (`item-letter`, `item-key`: Grandma's note and the cottage
  key), breaking the test's own rule against icons that meant something else in v1.
- **Slow Post's best verdict read like a wolf sting** ("around autumn"), and in the story leaving it
  was better for Grandma than the verdict that scored 200.
- **Night Light's card stated its danger as plainly as Way Teller's** ("shines where they say"), so
  reading the cards for danger reached 1000 on all seven, and the game still taught that careful
  reading is enough (RESEARCH_ALIGNMENT section 1).
- **The fold missed -es, -ed and -ing.** "foxes" folded to "foxe" and "this" to "thi"; four greeting
  edits made a 1000-point rule that passed every test.
- **The pairwise test made 141,631 `expect()` calls** and timed out under load (PAUL_BRIEF trap 9).
- **The glance bound looked fitted**: the sketch's six words plus one was exactly the longest wolf
  line, and the sketch row was a string copied into the test (trap 5).
- **The 650 headline held only at two words.** Three-word lists reached 850.

Every one was fixed at its cause, and each fix has a guard proved by breaking it (the table at the
end of this section).

### The third draft, and why it was refuted

Recorded for the same reason. Draft 3 (`2.0.0-draft.3`) passed every check, and every number in it
reproduced under an independent scorer. Two refuters found what the checks did not look at:

- **The cards were a word list.** Once opened, "'maker' anywhere on the card -> leave, 'only' ->
  limit, else take" was exactly the careful run and scored 1000. "maker" was on Word Weaver's and
  Short Cut's cards and nowhere else; "only" was on every card but the two best taken in full. Every
  word check stopped at the card's edge.
- **Position was a tell.** The Toadstool stands next to the spawn, so Way Teller, the one skill best
  taken in full, was the first offer every player met. "Take the first offer" on top of the best
  two-word rule scored 850 clean. Nothing modelled position.
- **A maker cue did not state a maker.** The Toadstool was recorded as "maker known" on "I have stood
  here longer than the path", which is its age, not who made Way Teller. Read plainly, the one skill
  best taken in full had an unknown maker. The test checked only that the cue string was present.
- **The doc overclaimed Night Light.** It said Night Light modelled the runtime half "which review
  does not catch". As built, a careful reader settles it on the card (its full line does more than
  its promise; its limited line is the promise), which is review catching it.

**Ruled by the lead and not re-litigated:** a player who applies the security heuristic from the
promises -- leave what sends or answers to a maker you cannot name, limit what opens, reads or finds,
take what only carries you -- and reaches the ceiling has **learned the lesson**. That is success, not
a tell, and the content is not designed against it. Rote rules over shared literal words stay at or
under the 700 line at depth two or less, as before; deeper word lists are memorisation, recorded
and not enforced. The "i" / "it" pair at 650 is inside the line and is left.

### The cast, and what protects you from each

Cast entirely from sprites that already exist (`manifest.json`), so Phase C paints nothing. The wolf
(`npc-wolf`) offers nothing. Content order is the walking order Phase C should lay out, because the
simulator meets the cast in that order, the clock below is measured along it, and **the first and
last offers are a rote clause** (section 9). Both are best limited -- the Rabbit first, the Cat
last -- which is the answer the best rules' "else" already gives, so where an offer stands buys
nothing: the best rule using a position scores 650 at two clauses and at three. **Phase C must
lay the cast out in this order.** Today's map has the Toadstool beside the spawn, which is draft 3's
order and the refuted one; with today's copy it scores 850 at three clauses, and the test proves it.

| #   | Character      | Reputation | Made by       | Skill          | Shape           | Take      | Limit     | Best  |
| --- | -------------- | ---------- | ------------- | -------------- | --------------- | --------- | --------- | ----- |
| 1   | Rabbit         | benign     | unknown       | Cottage Finder | safe if limited | 250, wolf | 200       | limit |
| 2   | Toadstool      | sinister   | the Toadstool | Way Teller     | safe in full    | 250       | 50        | take  |
| 3   | Owl            | benign     | unknown       | Word Weaver    | dangerous       | 150, wolf | 150, wolf | leave |
| 4   | Magpie         | sinister   | unknown       | Short Cut      | dangerous       | 150, wolf | 150, wolf | leave |
| 5   | Snail          | benign     | the Snail     | Slow Post      | safe in full    | 200       | 50        | take  |
| 6   | Lantern Keeper | benign     | the Keeper    | Night Light    | safe if limited | 250, wolf | 200       | limit |
| 7   | Cat            | sinister   | Grandma       | Latch Lifter   | safe if limited | 200, wolf | 150       | limit |

`wolfCost` is **650**. Every wolf-serving verdict is worth below zero, as the lint requires.

What the card shows, and what protects you, skill by skill:

- **Way Teller** "leads you the old way its maker knew": the full card is the promise and no more. Its card says "its maker", like the two dangerous cards -- and the Toadstool
  says "I made it myself", so the maker is the one offering it, named.
- **Cottage Finder** "searches your whole basket for her address". Least privilege: it "sees only the
  address on her note". It came "fresh from the crate" with "no maker's mark".
- **Word Weaver** sends all you say "and a copy to its maker"; limited, it sends only your note "by
  its maker's road". The Owl says it plainly: "Maker unknown." Best left.
- **Short Cut** goes "whatever way its maker picks tonight"; limited, "only the first way its maker
  picked". The Magpie "never saw who made it". It is the research's _unverifiable dependency_
  (RESEARCH_ALIGNMENT 2.2: "the thing you approved can change its mind later"). Best left.
- **Slow Post** carries your parcel sealed, for her alone; limited, "only as far as her gate". The
  Snail "made the post". The full card is the promise.
- **Night Light** "reads every sign, and lights the way ahead". Nothing on the card is a warning;
  see below.
- **Latch Lifter** "lifts her latch whenever anyone knocks". The limit, "only when you say", is the
  research's layer 4: the agent drafts and a human sends. "Grandma made it", the Cat says.

**Three cards say "its maker" now, and that is the provenance lesson rather than a coincidence.**
Way Teller, Word Weaver and Short Cut all answer to their maker; what separates the one to take
from the two to leave is whether anyone can say who the maker is. A word on the card cannot answer
that, and the greeting can.

### Folklore does not predict the verdict, and the cast plays against type

Reputation is not in the content, so it is **recorded in the test**, per character, as the folk
tradition a European reader brings to the wood: the Toadstool, the Magpie and the Cat sinister
(poison, thief, the witch's familiar), the Rabbit, the Owl, the Snail and the Lantern Keeper benign.
The test refuses a cast in which every skill best left is offered by a sinister character and every one
best taken by a benign one (and the same inverted), in which either reputation's skills all share one
best verdict, or in which no sinister character's skill is best taken in full or no benign one's best
left. It also plays every rule a player could follow BY WHO IS OFFERING over every combination: the
best rule by reputation alone scores **0**.

**Against type, both ways.** The poisonous Toadstool offers the one skill in the game whose card is
exactly its promise, and the wise Owl offers v1's exfiltrator. Swapping just those two offers, with the
copy and numbers untouched, re-creates the refuted shape, and the test proves it is refused.

The record is a declaration, and that is a real limit (PAUL_BRIEF section 7): the test can hold the
casting against the record, not decide whether a reader finds a cat sinister. Every character must
have an entry, so a new one cannot arrive unclassified.

### Who made it: every character says, and an unknown maker is never best taken in full

RESEARCH_ALIGNMENT sections 3 and 4.4 want "who made it?" load-bearing, so it is. **Every character
now states who made its skill, or that nobody knows**, in its greeting:

| Character      | Cue                      | Maker       |
| -------------- | ------------------------ | ----------- |
| Rabbit         | "No maker's mark."       | unknown     |
| Toadstool      | "I made it myself"       | the speaker |
| Owl            | "Maker unknown."         | unknown     |
| Magpie         | "Never saw who made it." | unknown     |
| Snail          | "I made the post."       | the speaker |
| Lantern Keeper | "I made this lamp"       | the speaker |
| Cat            | "Grandma made it."       | Grandma     |

The test records each maker with its cue and **reads the cue for it**, rather than checking a string
is present (which is what let draft 3's Toadstool through on its age): the cue must be in the
character's copy; it must use a word of making ("made", "maker"); a maker who is the speaker must be
claimed in the first person in the character's own greeting; a maker who is someone else must be
named in the cue; and an unknown maker must be stated as unknown ("no", "never", "unknown"). Draft
3's five cues that said nothing about making are each refused for that reason, by name. Still a word
test: "I made it myself" is read as a claim, not checked as true in the story, which stays the copy
read. Three makers are unknown: the Rabbit's (best limited), the Owl's (best left) and the Magpie's
(best left). **No unknown maker is best taken in full**, and swapping the Owl's and the Toadstool's
offers fails that check by name.

**The v1 Word Weaver beat is restored, not flipped.** v1's Word Weaver copied everything to a helper
address and was best rejected. v2's sends "a copy to its maker", is best left, and in full its reveal
says "Sent word ahead. She expected you." then "Its maker was the wolf.", which is the client's sketch
row ("sent word ahead... to the wolf") in two sentences. Limited, it still goes "by its maker's road",
and the reveal says "The wolf's road carried it."

The maker is a cue, not an answer. "Known: limit, unknown: leave" is the best rule by maker alone and
scores **450**, and adding reputation to it does not raise that.

### What protects the player is the boundary they set, not a word they spot

**The design tension, resolved by the lead in draft 2 and sharpened here.** The research's headline is
that some dangers are not visible on any card: an instruction hidden in content the skill reads
(RESEARCH_ALIGNMENT 2.1 and 3, gap 2). v2 still requires careful play to reach the ceiling. Both hold if
what protects the player is the boundary they set: limiting a skill's capabilities defends even against
an instruction the card never shows. That is the research's layered-defence point (RESEARCH_ALIGNMENT
2.4): not "read carefully" but "bound what it can do".

**Night Light carries it, and its card names nobody.** Draft 2's card said it "shines where
they say", which names the signs' writers as plainly as a stranger's directions. Since draft 3 it says
"Reads every sign, and lights the way ahead." Read for danger, that is an upgrade. What is left to see is that
it does MORE than it promised ("It shows you what the signs say"); the limit, "lights only your feet",
is exactly the promise. The defence is least privilege: the card is still read, but for what the
skill can do beyond its job, not for who is behind it. The reason limiting wins arrives
only at the cottage: in full, "Read you every sign. Lit the way ahead." then "The wolf's sign chose
it."; limited, "Read the wolf's sign too. Lit only your feet." The attack arrived, and the boundary held
against an instruction nobody saw.

Two tests hold the structure, read off the data rather than off a label: at least one skill is best
limited, serves the wolf in full and has a limited reveal that meets the wolf without serving him; and
at least one such skill's card, full and limited, names nobody outside the player (no stranger,
maker, "anyone" or "they"). The second is a word list, so a tripwire: putting back draft 2's card
fails it.

**What Night Light models, and what it does not, said plainly.** Draft 3's version of this section
said Night Light was "the runtime half, which review does not catch". That was false as built, and a
refuter showed it: a careful reader settles Night Light ON THE CARD, because its full line does more
than its promise and its limited line is exactly the promise. That is review catching it. What Night
Light models is **least privilege holding against an instruction the card does not name**: the card
warns of no one, the player limits it because it asks for more than the job needs, and the reveal
shows the wolf's sign read and the boundary holding. It does **not** model the zero-click half of
the research -- an attack no card, read however carefully, could have warned of (RESEARCH_ALIGNMENT
4.2, "No card could have warned the player"). In v2 every danger is still visible to a reader who
asks what a skill can do beyond its promise. **RESEARCH_ALIGNMENT 4.2 and PLAN.md D1 remain open
for research**, and nothing in this draft closes them.

The other four dangerous-in-full cards state their danger to a careful reader too: Cottage Finder's
whole basket, Word Weaver's copy to its maker, Short Cut's way picked tonight, Latch Lifter's
"whenever anyone knocks". That is the marketplace half (RESEARCH_ALIGNMENT section 1).

**No word on an opened card sorts the verdicts.** The refuter's card rule ("maker" -> leave, "only" ->
limit, else take) scored 1000 on draft 3 and scores 600 on draft 4: "its maker" is on Way Teller's
card as well as the two dangerous ones, and "only" is on all seven limited lines, both safe-in-full
skills' included, so it sorts nothing. The real-content suite now holds the single-word rule
over two views of an opened card -- its three lines alone, and everything seen by then (who offers
it, the greeting, the name, the promise and the lines) -- and putting draft 3's cards back fires
twelve tells by name, both of the refuter's among them. Deeper lists over card words are recorded,
not bounded: the best two-word list scores 600 over the lines and 700 over everything seen.

**It touches PLAN.md D1 and RESEARCH_ALIGNMENT open question 4, both still open, and carried forward
rather than decided.** D1 asked whether Night Light is "genuinely safe"; it was amended on 2026-10-16
to "honest on inspection, not safe by default", and research has not confirmed that direction. v2 keeps
it and sharpens it. **Research should confirm this before launch**, as `docs/GAME_DESIGN.md` section 4
and `docs/UX_REVIEW.md` decision D already require for v1. D1's row in PLAN.md is not edited by this
phase.

**What v2 still does not model, said plainly to the research team:** the danger as a COMBINATION. The
trifecta in the research is three legs across everything the agent holds, and no single skill looks
wrong. v2 scores each skill alone. The cross-skill trifecta is a rules change (section 9) and is not
built.

### Which skills a limit saves: the rule, as worded and as built

Draft 2's rule was "when the job itself is the attack, no limit saves it", and Tally Post broke it: its
job was Word Weaver's, and its harm was a capability beside the job. **Tally Post is cut**, rather than
the rule bent around it. The rule, worded to match the two skills that are now dangerous:

**When a skill answers to its maker, and you cannot say who the maker is, no limit saves it. A
boundary is yours to set; the maker still holds the other end.** Word Weaver's copies and its road are
its maker's, and Short Cut's ways are picked by its maker each night. Both limits are honest on the
card about that ("by its maker's road", "the first way its maker picked"). Where the harm is a capability
BESIDE the job (the whole basket for one address, lighting the way the signs choose, opening for
anyone who knocks), a boundary removes that capability and keeps the job. Those three are the
research's layers 1, 2 and 4 by analogy: least privilege, data-flow enforcement, and "the agent drafts
and a human sends".

**On the research grounding, without overstating it:** the research names the four boundary layers and
the threat classes (malicious skills, exfiltration over sanctioned channels, unverifiable dependencies,
over-privilege, untrusted content). It does not state the "answers to its maker" rule; that is this
game's framing for sorting its own cards. The mapping of each skill to a layer is an analogy for Phase D
and the research team, and **the reveal does not name attack classes** (RESEARCH_ALIGNMENT open
question 3 is still open).

### Partial caution is never punished

A trap check now (section 9): where taking in full serves the wolf, limiting is worth at least as much.
In this content, per skill, as `worth` (take / limit):

| Skill          | Take | Limit | Holds                                                   |
| -------------- | ---- | ----- | ------------------------------------------------------- |
| Way Teller     | 250  | 50    | not bound: safe in full, so limiting is meant to cost   |
| Cottage Finder | -400 | 200   | yes                                                     |
| Word Weaver    | -500 | -500  | yes, equal: a dangerous limit earns what its take earns |
| Short Cut      | -500 | -500  | yes, equal                                              |
| Slow Post      | 200  | 50    | not bound: safe in full                                 |
| Night Light    | -400 | 200   | yes                                                     |
| Latch Lifter   | -450 | 150   | yes                                                     |

The two safe-in-full limits were cut from 100 to 50 in this draft, for a reason recorded here: at 100,
"leave the two dangerous ones, limit the rest" scored 750 at one word. Limiting a safe skill has to
cost enough that it is not a free hedge.

### No word predicts the verdict

The trap bounds what a rule read off the cast can EARN (at most 70%), and the real-content suite adds
that **no word two or more skills say, by saying it or by not, sorts two or more skills into one best
verdict**. Both read words through `foldWord`, which now folds -s, -es, -ies, -ed, -ied, -ing and
possessives, erring by merging (the safe direction: one more candidate tell) and not folding
irregular forms or synonyms, which stay a human read.

**The refuter's scratch case is a test.** A fox and Foxes on the two skills best left, a wish and
Wishes on the two best taken: under the old fold every check passed and "fox -> leave, wish -> take,
else limit" scored 1000 clean. Now the trap and the word test both fire on it.

**The same rule now reaches the opened card** (above, "No word on an opened card sorts the
verdicts"): single words over the card's three lines, and over everything seen once it is open.

Measured on draft 4, best rule at each depth over the shared words and the first and last offers
(clauses are words or positions; the enumeration is `roteRuns` over all 2,187 played runs):

| Depth                               | Rules     | Best | Rule                                                                                                    |
| ----------------------------------- | --------- | ---- | ------------------------------------------------------------------------------------------------------- |
| 1 clause                            | 81        | 450  | "i" -> limit, else leave                                                                                |
| 1 clause using a position           |           | 200  | the first offer -> limit, else leave                                                                    |
| 2 clauses (every load)              | 2,889     | 650  | "i" -> limit, "it" -> leave, else limit                                                                 |
| 2 clauses using a position          |           | 650  | "i" -> limit, the first offer -> limit, else leave                                                      |
| 3 clauses (test suite)              | 95,553    | 650  | the same as two: nothing at three does better, with or without a position                               |
| 4 clauses (not bounded)             | 2,875,473 | 850  | "light" -> limit, the first offer -> limit, the last offer -> limit, "door" -> take, else leave         |
| 4 words only (not bounded)          |           | 800  | "maker" -> leave, "grandma" -> limit, "this" -> limit, "i" -> take, else leave                          |
| draft 3's order, today's copy, 3    |           | 850  | the first offer -> take, "i" -> limit, "it" -> leave, else limit (the refuter's line; the test asserts) |
| by reputation                       |           | 0    | (the test plays all nine)                                                                               |
| by maker                            |           | 450  | known -> limit, unknown -> leave                                                                        |
| by reputation and maker             |           | 450  | known -> limit, unknown -> leave, whatever the reputation                                               |
| card words, two-word list, lines    |           | 600  | "its" -> leave, else limit (recorded, not bounded)                                                      |
| card words, two-word list, all seen |           | 700  | "for" -> limit, "show" -> take, else leave (recorded, not bounded)                                      |

The "i" / "it" pair at 650 is the two-word conjunction a refuter named: "says 'it' and not 'i'" is
exactly Word Weaver and Short Cut. It is inside the line and is left, as ruled.

**Depth four is recorded, not bounded.** A four-word list that sorts seven skills one by one is
memorising this cast, and no fixed content can prevent memorisation. The same is true of the reviewer's
"memorisation boundary": after one reveal, "leave Word Weaver and Short Cut, limit the rest" scores 650
now, under the line, because limiting a safe skill costs more. Rules name the FOLDED word ("hav",
"crat") because the fold is what they match on.

**Semantic tells are not measured.** Two different words meaning the same thing would be a tell a
reader learns and no test sees. That is part of the copy read.

### Being compromised costs: the board never ranks a wolf run over a careful one

The best run that lets the wolf in scores **500** against a 600 bound: a careful run that took or
limited either of the two dangerous skills, Word Weaver or Short Cut. Of 2,187 combinations, 2,115 end with the wolf and 72 are
clean, and **the top fourteen are all clean** (1000, 850, 850, 800, 800, 800, 800, 750, 700, 650, ...).
A real-content test asserts the leaderboard consequence over every combination: no run that let the
wolf in outscores a clean run with as many verdicts right, a tie allowed only at the floor. It is now
one assertion over a computed list of violations (the cheapest clean run at each count, compared once
per wolf run), not 141,631 `expect()` calls; no real-content test takes as long as a second, measured at load average 110.

### Nine runs in ten score 0, and that is kept

1,972 of 2,187 runs score 0 (90.2%), and 1,971 of the 2,115 wolf runs (93.2%). By wrong verdicts:

| Wrong | Runs | Score 0 | Best |
| ----- | ---- | ------- | ---- |
| 0     | 1    | 0       | 1000 |
| 1     | 14   | 0       | 850  |
| 2     | 84   | 19      | 700  |
| 3     | 280  | 164     | 500  |
| 4     | 560  | 544     | 300  |
| 5     | 672  | 669     | 100  |
| 6–7   | 576  | 576     | 0    |

**It is kept, for three reasons.** It is arithmetic, not tuning: `WOLF_SHARE` makes every wolf-serving
verdict cost at least 40% of the ceiling, so any three of them cost more than the ceiling, and `wolfCost`
barely moves it (600 gives 88.7%, 700 gives 91.3%). It is the spec's own promise: "a full basket of the
wrong things scores near zero" (section 3). And the board still separates the runs anyone will post:
one mistake, two, three and four each have their own best, and every 0 says by its ending whether the
wolf got in. Changing it means raising `WOLF_SHARE` (a compromised run scoring nearer a careful one,
against the thesis) or an unfloored total (a rules change to `scoring.ts`, and a board that shows
negative numbers). **Both are decisions for the client, not knobs**, and neither is taken here.
`WOLF_SHARE`'s docstring said 0.6 avoided "every wolf run is the same 0"; that was false and is
corrected.

### The table, as `v2.table(content)` prints it

Unpaced (verdicts only), seed 1:

| Strategy  | Total | Ending  |
| --------- | ----- | ------- |
| careful   | 1000  | grandma |
| greedy    | 0     | wolf    |
| limit-all | 0     | wolf    |
| leave-all | 0     | grandma |
| random    | 100   | wolf    |

`random` moved from 0 to 100 only because the cast was re-ordered: the seeded draws now fall on
different skills. Nothing else in the table depends on order.

**Over every combination** (`everyRun`, 2,187 runs): exactly **one** run reaches the ceiling and it is
careful's; the best wolf run scores **500** (bound 600); the best rote rule scores **650** at two
clauses and at three (bound 700). The numbers did not change in draft 4, so neither did any total,
the worth table or the zero counts above. Taking in full is strictly best for Way Teller and Slow Post, limiting for
Cottage Finder, Night Light and Latch Lifter, and leaving for Word Weaver and Short Cut.

### The clock, derived rather than chosen

Every input is read from the game, not written down: `WALK_SPEED` (120 px/s), `INTERACT_RADIUS` and
`TILE` are imported from `apps/game/src/world/logic.ts`, and the distances are walked over the shipped
`map-forest.json` collision layer.

- **Walking.** A four-connected breadth-first walk from `spawn-purple`, to a tile within talking
  reach of each character in content order, then into `trigger-cottage`. On today's map that tour is
  **104 tiles** (rabbit 7, toadstool 2, owl 16, magpie 34, snail 9, lantern keeper 10, cat 26,
  cottage 0), about 28 seconds -- the same total as draft 3's order, by coincidence of the map. Four-connected already overstates it (Purple walks diagonals at full
  speed), and the test then **doubles** it for a visitor who looks around and walks back.
- **Reading.** 200 words a minute, everywhere: the meta-analysis figure for silent reading of
  non-fiction is about 238 (Brysbaert 2019), slowed for a reader reading to decide. A conversation is
  the longest greeting plus a second to press on (3.4 s; every greeting is eight words or fewer). A
  card is its name, promise and three lines, plus one word per button, plus three seconds to decide;
  each skill's `inspectMs` is that, rounded up to the half second, and the test refuses content whose
  `inspectMs` understates its own card. The seven cards come to 91.0 s.
- **Result.** A careful reader who reads all seven cards and walks twice the shortest path arrives at
  **170.3 s, 9.7 s inside the limit.** At the shortest path the margin is 37.5 s. Small and positive,
  as section 9 asked; 2.5 s tighter than draft 2, because the cards are slightly longer. Draft 4 left
  it exactly where draft 3 had it: the card copy moved by a word here and there (Way Teller and Slow
  Post up, Short Cut down) and the seven cards still come to 91.0 s, and the longest greeting is
  still eight words. A nine-word Magpie line cost 2.1 s and was cut.
- **Counting the button labels in full on every card was tried and rejected** in draft 1. Charged
  in full on all seven cards they cost about fifteen seconds for text the reader has learned by the
  second card, and the draft copy ran 6.7 s late; the copy was cut as well, so the model was not bent
  to fit long copy alone.

**What this asks of Phase C.** The longest content-order tour that still lets a careful reader arrive
is **122 four-connected tiles**; today's is 104, so the cast can spread by about eighteen tiles of path
in total. The test proves that edge from both sides by playing it (122 arrives, 123 is late), so the
number is measured, not estimated, and it moves by itself if the copy or the map changes. Two placement
facts Phase C will meet: the Cat's reach already overlaps the cottage lane (the last leg is 0 tiles),
and the magpie leg (34 tiles) is the longest.

### Every refutation, and its guard

Each guard was proved by breaking: either an edit inside the test that must make it fire, or the real
file broken, the test watched failing with its own message, and the file restored and checked with
`cmp`.

| #   | Refuted                                                  | What changed                                                                                     | Guard                                                                            |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| a   | Latch Lifter rewarded taking the human out of the door   | Safe only if limited; "only when you say" wins (layer 4)                                         | the scoring                                                                      |
| b   | Slow Post's promise was false inside the story           | It carries your heavy things, sealed, and you walk light                                         | human read                                                                       |
| c   | Wolf-ending lines false for some causes                  | Written true for every cause; re-read against draft 3's five (below)                             | human read                                                                       |
| d   | Night Light limited taught that chosen content is safe   | The limit bounds the action, not the content                                                     | the held-beat test                                                               |
| e   | Cottage Finder was malicious while "limit" scored best   | Over-privileged only: "opens your whole basket for her address"                                  | human read                                                                       |
| f   | The limit rule was mislabelled; then Tally Post broke it | Tally Post cut; rule reworded to "answers to its maker", which both dangerous skills now are     | the shape test, and the cards' own words; the rule itself is a human read        |
| g   | Wolf lines ran to 24 words                               | Every reveal sentence is five words or fewer                                                     | no sentence longer than the sketch's longest row, parsed from section 6          |
| h   | Icons contradicted the reveal; then reused v1's basket   | No v1 starting-basket icon; a v1 icon only on the skill v1 gave it; four await art               | v1 icon rule read from `content/game.json`; `AWAITING_ART` ratchet               |
| i   | "The wolf line is a separate sentence" proved nothing    | Kept promise earned points, wolf line names the wolf, no denial words (tripwire)                 | all three                                                                        |
| 1   | Folk reputation predicted the verdict (750 then 900)     | Re-cast against type: the Toadstool best taken, the Owl best left                                | reputation recorded per character; nine rules played; Toadstool/Owl swap refused |
| 2   | The Owl's unknown maker was best taken in full           | Word Weaver is v1's exfiltrator again; three unknown makers, none best taken                     | maker recorded with its cue; cue must be in the copy; swap refused               |
| 3   | Limiting a dangerous skill scored below taking it        | Dangerous limits earn what their takes earn                                                      | trap check; fixture's old locksmith fails it alone                               |
| 4   | Tally Post's harm did not match the rule                 | Cut (row f)                                                                                      | (as f)                                                                           |
| 5   | `item-letter` and `item-key` reused as skill icons       | Word Weaver wears v1's own ear-trumpet; Latch Lifter waits for `item-latch`                      | (as h)                                                                           |
| 6   | Slow Post's best reveal read as a sting                  | "It reached her before snow." Take 200 > limit ("waits at her gate") 50 > leave ("you carry it") | human read; the order is the scoring                                             |
| 7   | Night Light's card gave the danger away                  | "lights the way ahead": nothing outside the player named; least privilege is the defence         | the held skill's card names no outside party (tripwire)                          |
| 8   | The fold missed -es, -ed, -ing; "this" became "thi"      | `foldWord`                                                                                       | word-pair test; the fox/wish scratch case fails trap and word test               |
| 9   | 141,631 `expect()` calls, timing out under load          | One assertion over a computed list                                                               | a cheap wolf (400) must produce violations                                       |
| 10  | The glance bound was copied and fitted                   | Parsed from the sketch; no "+ 1"; content's longest sentence is 5 against 6                      | the parse names the sketch's three rows; an 11-word line fails                   |
| 11  | The rote headline held only at two words                 | Check renamed "two words or fewer"; depth three measured on the real content                     | depth-three test at 650                                                          |
| 12  | Card words sorted the verdicts: "maker" / "only" -> 1000 | Card copy varied: "its maker" on Way Teller too, "only" on all seven limits, no shared verb      | word test over the card lines and over all seen; draft 3's cards fire 12 tells   |
| 13  | The first offer met was the one best taken (850)         | Position is a rote clause; the Rabbit is met first and the Cat last, both best limited           | depth-three test with positions; draft 3's order gives 850; a two-clause breach  |
| 14  | The Toadstool's cue stated its age, not the maker        | Every character states its maker or its absence, in its greeting                                 | the cue is read: making word, first person or a name, or stated as unknown       |
| 15  | The doc said Night Light models the runtime half         | Says what it models (least privilege against an unnamed instruction); 4.2 and D1 stay open       | human read                                                                       |

### Open, and needing a human or another phase

- **The copy read.** Every string in `content/game.v2.json` is new. The ones most worth a hard look:
  - **The Toadstool against type.** A poisonous toadstool offers the one skill that is exactly its
    promise. Does that read as a fair surprise, or as a trick played on the player?
  - **Night Light's fairness.** A reader looking for danger takes it in full and loses 600 points; one
    who asks whether it needs to do more than it promised limits it. Judge whether "lights the way
    ahead" against "shows you what the signs say" is a gap a careful reader can see.
  - **Night Light's limited line**, "Read the wolf's sign too. Lit only your feet." It has to read as
    "the attack came and the boundary held".
  - **The wolf ending**, read against each of its five causes in draft 3, alone and together: the
    wolf's road (Word Weaver), the wolf's way (Short Cut), an open basket (Cottage Finder), an obeyed
    sign (Night Light) and a door opened to a knock (Latch Lifter).
  - **"Its maker was the wolf."** beside "She expected you.": the promise was kept and the maker was
    the wolf. Whether five words land the supply-chain beat is a human call.
  - **Short Cut's "new every night"** is the only cue before the card that its maker can change it.
  - **The seven maker lines**, new in draft 4. They are read for a word of making and a name by
    the test, not for voice: the Magpie lost its counting ("Four hundred and twelve, by my count")
    and the Snail its parcel, to make room. Whether "I made it myself" sounds like a toadstool is a
    human call.
  - **"Its maker" on Way Teller's card.** It is there so the word sorts nothing; it also says the
    Toadstool's way answers to the Toadstool, which the greeting names. Check it does not read as a
    warning.
  - **Semantic tells** the word checks cannot see, and the reputations recorded in the test.
- **Four icons do not exist:** `item-signpost` (Way Teller), `item-parcel` (Slow Post),
  `item-shortcut` (Short Cut) and `item-latch` (Latch Lifter). Nothing was drawn or substituted
  (CLAUDE.md rule 5). The test names them in a ratchet list that fails once the art arrives.
- **Portraits: Phase C/D must supply them, and the content cannot say which to use.** v2's schema has
  no `portrait` field (v1's characters do). The art exists for three of the seven (`portrait-rabbit`,
  `portrait-owl`, `portrait-keeper`) and not for the Toadstool, Magpie, Snail or Cat. Either the schema
  gains the field (a Phase A rules change) and four portraits are commissioned, or the dialogue and
  reveal go portrait-less. Nothing was invented.
- **Four of the cast stand on `bystander-*` spawns.** v1's `bystanderSpawns` means "people who talk
  but offer nothing", and v1's `npcSpawns` keys a character by its spawn's suffix. The game draws a
  character with the texture its spawn names (`forest-scene.ts` `createCharacter`), so the spawn names
  are kept as the sprite keys; whether the spawns are renamed is Phase C's call, and the test follows
  the content.
- **The test imports `apps/game/src/world/logic.ts` and `map.ts`** so that the pace comes from the
  game's own code (trap 1), and reads this document through a `?raw` import (`test/v2/raw.d.ts`) so
  the glance bound comes from the sketch. If either coupling is unwelcome, the alternatives are moving
  `WALK_SPEED` and `INTERACT_RADIUS` into core, and moving the sketch into content.
- **D1, research open question 4 and RESEARCH_ALIGNMENT 4.2**, carried forward above, need research
  before launch. v2 does not model the zero-click half: every danger in it is visible on a card to a
  reader who asks what a skill can do beyond its promise.
- **Phase C must lay the cast out in content order, the Rabbit first.** Today's map stands the
  Toadstool beside the spawn; with today's copy that order scores 850 at three clauses.
- **The trap runs on every load**, about 25 ms for seven skills, because `loadContent` plays all 2,187
  combinations. It grows as 3^n; the launch lint caps the cast at seven.
