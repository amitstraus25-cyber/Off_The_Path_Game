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
