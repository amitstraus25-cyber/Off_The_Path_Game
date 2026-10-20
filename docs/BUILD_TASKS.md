# Build tasks — handoff

**2026-10-20 · written against `main` @ `37a94b9`, with 18 files uncommitted in the tree.**

For the agent doing the building. Each task states what was asked for, what is actually there now,
what must not break, and where the decision point is. Where a task has a judgement call in it, the
call is named rather than made — it belongs to Amit, not to whoever implements this.

Everything below was measured against the running build on 2026-10-20, not read off an older doc.
Re-check before acting: this tree moves fast.

---

## 1. Verdict consequences on the skill card

**Asked for.** On the Inspect card, hovering or focusing Allow / Restrict / Reject should show what
that verdict will actually do, for this skill, in the game's own terms. "If I allow, then what
happens? If I restrict, then what happens? If I reject, then what happens?"

**What is there now.** One generic line under the buttons, identical on all three cards, built by
`cardRulebook()` in `apps/game/src/ui/SkillCard.tsx` from `strings.verdictPrimer`:

> Allow: it gets everything it asks for. Restrict: it gets the job, not the extras, and only when
> you point it at something. Reject: you walk on without it.

**Read this before you build anything.** Per-verdict, per-card microcopy _already existed and was
deliberately removed_. The comment above the primer in `SkillCard.tsx` says why:

> Cutting the per-verdict "leaves B" microcopy removes the answer key, but nothing else in the game
> ever says what Restrict does, and GAME_DESIGN section 4 requires the right answer to be
> discoverable. It defines the vocabulary without naming what any particular skill asks for — see
> `cardRulebook`, which is why it cannot vary by card.

The governing rule is `docs/GAME_DESIGN.md` §4, last bullet:

> The skill card must make the right answer _discoverable_, not obvious.

**The trap.** The card already shows "What it asks for" — the fine print, in plain language, at the
same size as the promise. A per-verdict preview restates that as a consequence. A player who
skipped reading the fine print would get it for free by brushing a button, and the game stops being
about reading and becomes about hovering. That is the thing that was removed.

**Why the request is still right.** Allow and Reject are self-evident. **Restrict is not**, and it
is skill-specific in a way no generic sentence can carry. `GAME_DESIGN.md` §4 admits this itself:

> On Night Light, whose purpose is to read what strangers wrote, Restrict grants nothing: the
> lantern lights only what Red holds it to.

So Restrict means "strip the hidden extra" on the Cottage Finder, and "bound the stated purpose" on
Night Light. Those are different operations wearing one word. A player cannot deduce that, and the
primer does not tell them. **This is a real gap and it is worth closing.**

### Three ways to close it

**Option A — preview on all three verdicts (what was asked for, and what was removed).**
A short per-skill, per-verdict line, revealed on hover _and_ focus. Makes the game meaningfully
easier. Only take this if that trade is accepted deliberately.

**Option B — preview on Restrict only. Recommended.**
Leaves Allow and Reject to the primer, which already explains them adequately, and spends the new
copy on the one verb that is genuinely opaque. It teaches least privilege, which is the lesson, and
it does not tell the player whether there was anything hidden to strip — only what scoping _means_
on this card. Smallest change that fills the actual gap.

**Option C — a fourth question asked of the character.**
"What if I only let you do part of it?", answered in character. This is the strongest fit for "it
needs to connect more to the game", and the Owl's evasions are the best writing in the project. But
`QUESTION_IDS` is fixed at `needs, who, show` in `packages/core/src/content.ts`, lint requires
exactly one of each per character, and the question bonus maths assumes two bonus-eligible
questions. It touches core, the schema, the lint, all three characters and the scoring. Real work.
Park it unless there is appetite.

### If Option B is chosen — the content shape

New optional field per outcome, so nothing existing breaks and the schema stays strict:

```jsonc
"outcomes": {
  "restrict": {
    "points": 200,
    "grants": ["basket"],
    "...": "...",
    // NEW. Present tense, forward-looking. Says what scoping DOES, never whether it is wise.
    "ifYouDo": "It reads the address and nothing else. Your key stays in the basket."
  }
}
```

Drafts, for the copy pass to sharpen rather than to ship as-is:

| Skill          | Restrict `ifYouDo`                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Cottage Finder | It reads the address and nothing else. Your key stays in the basket.                                      |
| Word Weaver    | It still sends word out of the forest, because that is what it is for. It stops sending copies elsewhere. |
| Night Light    | It lights only what you hold it to. Nothing else gets read to you on the way.                             |

Those are adapted from the existing `recap` strings, which are past tense and live on Results. Do
not reuse `recap` directly: past tense on a button is wrong, and Results needs to keep its own
voice.

### Rules the implementation must not break

- **Hover is not enough.** Must appear on `:focus-visible` too, and on touch. A hover-only
  affordance is unreachable by keyboard and on a phone, and `e2e/a11y.spec.ts` plus the
  keyboard-only run in `e2e/ui.spec.ts` both cover this screen.
- **No layout shift.** `apps/game/src/ui/stage.ts` reserves the header height to the pixel and
  `e2e/cls.spec.ts` measures layout shift. Reserve the line's space; do not let it push the buttons.
- **The three buttons stay identical.** `UI_FOUNDATIONS` §2 forbids distinguishing a verdict by
  fill or colour — the glyph is the only difference, and no Lime on a verdict. A preview must not
  make Restrict look like the recommended one.
- **Never state safety.** No "safest", no "recommended", no mention of the wolf, no hint that a
  given card has something hidden. Scope only.
- **Content is data.** The string belongs in `content/game.json` behind a schema field, not in a
  component. Adding a skill must not require code changes (CLAUDE.md rule 3).

---

## 2. The title screen never says what the goal is

**Asked for.** The homepage says nothing about trying to finish fast, with the least risk, for the
highest score, or about a scoreboard.

**Confirmed.** The title screen carries the quest and the controls and nothing else:

> About five minutes. Arrow keys to walk, Space to talk.

Results then opens with **"100 out of 1,000"**, which is the first the player hears of a score.

**Two things are not true yet, and the copy must not claim them.**

- **Speed is worth nothing.** `compareRuns` in `packages/core/src/scoring.ts` ranks by total and
  then by duration — and it is called _nowhere outside its own unit test_. Duration is never shown
  to the player. "Finish fastest" is not currently a goal; it is a comparator waiting for a
  leaderboard.
- **There is no scoreboard.** Phase 6 is unstarted, `apps/api` does not exist, and the client is a
  stub that reports the board unavailable.

**What can be said truthfully today.** That the run is scored out of 1,000, and that the score comes
from what you let each skill do rather than from speed. Something in the shape of:

> Scored out of 1,000. The points are in what you let each one do, not in how fast you get there.

That also quietly corrects a wrong instinct — rushing — which matters for an asset whose lesson is
that the cost of not reading is invisible.

**Decision for Amit.** If "fastest wins" is wanted as a real goal, it needs the leaderboard first,
and then the title can promise it. Do not put it on the title screen before then.

---

## 3. The music toggle's glyph and label are off-centre

**Confirmed and measured** on the running build at 1280.

`.otp-music__face` in `apps/game/src/ui/components.tsx` contains an inline SVG glyph, a literal
space, and a `<span>` of text:

```jsx
<SpeakerGlyph on={on} /> <span class="otp-music__state">{on ? labels.on : labels.off}</span>
```

Both sit in an inline formatting context, so the SVG aligns to the **text baseline** — its optical
centre lands above the word's. Measured box: `35.0 × 17.5` at `14.76px/14.76px`.

**Fix.** Make the face a flex row and let the gap replace the literal space:

```css
.otp-music__face {
  display: inline-flex;
  align-items: center;
  gap: calc(6px * var(--otp-ui));
}
```

and drop the space between the two children in the JSX.

**Do not** make the glyph and the label two children of `.otp-music`. That button is
`display: grid; place-items: center`, and the comment in `components.tsx` records why a second grid
item breaks it: it opens a second row and pushes the control through a header whose height
`stage.ts` has reserved to the pixel. `inline-flex` on the existing single child keeps it one grid
item.

Check at 375 as well as 1280; `--otp-ui` scales the gap.

---

## 4. An em dash in player-facing copy

`strings.boundaryOpen` in `content/game.json`, shown on Results:

> All three ran at once. Nothing you passed happened to be carrying an instruction — this time.

That is U+2014, and the standing rule on this project is no em dashes in product copy; restructure
the sentence instead. It is stored escaped in the JSON, so a plain grep for the character misses
it — search for `—` as well.

Suggested: `...carrying an instruction. Not this time.`

---

## 5. The biggest one: playing well and seeing the lesson are mutually exclusive

Not asked for, but it outranks everything above and should be decided before publication.

**Measured** by enumerating all 27 verdict combinations through the real scorer on 2026-10-20:

- The best line scores **1,000** and the forest notice **never fires**.
- **Every** line in which the notice fires scores **650 or less**.

The player who understands the lethal trifecta best is the only one never shown it. A clean run is
told one sentence — `strings.boundaryHeld`, "You never let all three run at once." They do learn
what each skill was hiding, from the per-skill rows. What they never see is the thesis: ordinary
prose turning into an instruction because all three legs were live.

This is structural, not a bug: `boundaryHeld = !trifectaLive` and the notice's firing condition are
the same predicate over a set that only grows.

**Cheapest fix that keeps the lesson and the reward.** On a clean run, show the counterfactual on
Results instead of only the congratulation — the good player earns the explanation rather than the
damage. One new string, one conditional in `Results.tsx`. Draft:

> Had all three been running, the notice on the post would have sent your key and your address on
> ahead of you. You never gave it the chance.

`docs/UX_REVIEW.md` (2026-10-19) reached the same finding independently and ranked it as the cause
behind its "not yet" verdict. Its headline failure — Results asserting a notice had fired on runs
where none was read — **is now fixed**; this one is not.

---

## What is in good shape, and should not be disturbed

Said plainly so none of the above reads as a project in trouble. It is not.

The art is transformed and genuinely good. **The Inspect card is the best thing in the game** and
needs no structural change — task 1 adds one line to it and should change nothing else. The arrival
frame earns its moment. Results now reports the run honestly at every width. The phone layout works,
the run completes keyboard-only, and the music defaults to off with a real switch.

The two things that still gate a launch are unchanged and are not engineering: **research sign-off
on the player-facing copy**, and **real pixel art** if the generated set is not to ship.
