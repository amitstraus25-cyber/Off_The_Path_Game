# Design and UX review — Off the Path: "That's Not My Grandma"

**2026-10-19 · Head of Design · `main` @ c352f93 (typecheck and unit tests green)**

> **Read this as a dated snapshot, not as the current state.** It is a measurement of one commit, and
> work has landed against it since: spot-checking on 2026-10-20 found the three-state boundary string
> and `trustBreakdown` wired in `Results.tsx`, `data-autofocus` on the Results body, the `--otp-ui`
> type floors written into `panels.css`, `shore-n`/`shore-s` emitted by `forest-map.ts`, the
> `07-leaderboard` capture dropped, and `titleStanding` gone from `Title.tsx`. **Check a finding
> against the tree before acting on it or quoting it.** Findings are cited by symbol and selector
> rather than by line number: this file held fifteen `file:line` citations and about half had already
> drifted onto the wrong line.

Six lenses — game-feel, ui-craft, accessibility, responsive, copy, art-direction — reviewed the running
build at 1280, 768 and 375 against `UI_FOUNDATIONS`, `ART_DIRECTION`, `PIXEL_STANDARD`, `GAME_DESIGN`
and `content/game.json`. Every finding was then checked by someone trying to refute it; 93 of 103
survived. Deduplicated below to 21, ranked by what a player would see.

---

## Verdict

**Not yet.** Two weeks of work, not a rebuild — but this should not go on the research page this week.

Nothing crashes, and the run completes keyboard-only at all three widths. The Inspect card is genuinely
excellent and the writing is better than the project seems to think it is. What stops publication is
that **the asset misreports the player's own run on the screen that carries its argument.**

> On the shipped capture at every width, the first row under the score reads _"All three ran at once,
> and a notice on a post did the rest."_ — on a run where no notice was ever read, with no explanation
> beneath it, two rows above a heading that promises to show "what was hiding" and a row that says
> "Nothing was hidden in it."

For a data security company whose thesis is "read what the thing actually does," a results screen that
asserts an event which did not happen is the one failure the audience is guaranteed to find and enjoy.

Underneath it is the cause. The game owns exactly one mechanical demonstration of its lesson — the
forest post, the only notice with a `whenExposed` — and that demonstration can be spent before it can
fire. Hold Right from spawn and you reach the post with no verdicts recorded; both "Read the notice" and
"Walk on" latch it shut for the run. Play perfectly instead and you are never shown it either, because
`boundaryHeld = !trifectaLive` and the notice gate are the same predicate over a set that only grows.
**Earning the 200-point boundary bonus and ever seeing the injection demonstrated are mutually exclusive
by construction.** The player who understands the lesson best is shown it least.

Cheaper but just as visible: the ending frame argues with its own prose, including on the good ending,
and the first thing a visitor sees is a 32-pixel lattice in the grass.

---

## What is good, and must survive the fixes

Several fixes below could casually destroy these.

**The Inspect card is the best screen in the product. Do not touch it.** Three identical 331×44 outline
pills with no fill, no Lime anywhere on the screen, two neutral rows that never signal danger, fine
print set at the same size as the promise, a provenance eyebrow. `UI_FOUNDATIONS`' refusal to put Lime
on Allow is the most important decision in the asset and the build honours it — a computed-style census
of every visible element at all three widths finds one Lime on Title, one on Results, zero elsewhere.

**The writing.** The Lantern Keeper's "Read it as closely as you like. You will find nothing in it." is
true and still the trap. The Owl's "They were kind, though. Very kind." is supply-chain compromise in
six words. The bystanders carry popularity-is-not-safety without a sentence of lecture. The forest
post's "Nothing warned you, because nothing on any card was false." is the thesis exactly, and
`ctaPrompt` is the brief's question verbatim. Protect these as written.

**The focus indicator** — 3px Deep Purple outline inside a 6px Lilac halo, swapped on dark headers.
Either colour alone would vanish on one of the two grounds; the pairing reads on both. **Reduced
motion** is handled almost completely, including in the Phaser world, and the typewriter is skippable
three ways.

**The scoring model:** a pure function of the run log, replayed server-side, with `must-open-the-card`
so a client cannot claim care it never took. **The audio** is generated from bar numbers with no files
in the repo and no `AudioContext` until asked.

**The tree is good pixel art** — scalloped silhouette, five tones, keyline, root flare, contact shadow
in the ground's own green. Every repetition finding below is about how often it is stamped, not how it
is drawn. **The shared border ring** (every opaque decor tile and every grass tile carrying the same
`#8ad056` rim) means there is not one seam between ground and decor anywhere in the world — a hard
problem solved properly, and the thing most likely to be broken by a careless grass fix.

**The height breakpoints work.** The Inspect group, the tallest thing in the game and broken before, now
fits with zero overflow at 19 of 20 viewports from 320×568 to 1920×1080.

---

## Findings

### Fix before publication

**1. Results asserts things that did not happen.** `boundaryBroken` renders on `!boundaryHeld` alone
with no reference to `exposedNotices`, so it claims the notice acted in runs where none was read — and
the paragraph beneath is empty because nothing fired. My post-first Results capture is SHA-256 identical
to the project's own `ui-1280-06-results.png`, which comes from a run that reads no notice: **Results
cannot distinguish "it fired" from "it never happened."** On the same screen, "WHAT WAS _hiding_ IN EACH
SKILL" sits two rows above "Nothing was hidden in it," and every unmet errand reads "Find the cottage
before dark needed reaches into your basket" — a run-on at every width, built by gluing "needed" to a
third-person verb phrase.
→ _Right:_ no ordering of walking, reading and deciding can produce `boundaryBroken` with an empty
fired list; a heading that covers a card with nothing to hide; the "needed…" clause on its own line.
In `Results.tsx`: the `.otp-recap__row--boundary` row, the `recapHeading` block, and the errand row's `errandNeeded` template.

**2. The one demonstration of the lesson can be spent before it fires, and is withheld from anyone who
plays well.** `whenExposed` is evaluated once, at read time, against the verdicts held then
(the `READ_NOTICE` case in `reducer.ts`), behind two independent one-shot latches — that case's
`already-read` rejection, and the `dismissed` set in `main.ts`'s `reachedNotice` handler, cleared only on replay. Red spawns on tile row 21, the only clear lane runs
due east along it, and the post spans x 1344–1472: a held-Right player arrives after 9.75s with `read=[]`
and zero verdicts. Reading it there, or choosing "Walk on," kills the beat. The careful player loses it
too — all four texts explaining the injection are gated on the trifecta, so a 1,000-point run reads none.
→ _Right:_ evaluate `whenExposed` against the end-of-run capability set, or re-arm a notice whose
`whenExposed` has not fired; and show the held-boundary player the counterfactual they avoided, in the
notice's own words.

**3. The arrival frame tells the wrong story, including on the good ending.** `arriveLines` is one flat
string for every outcome, so a flawless run reads "There are paw prints in the soft earth by the step" →
"The door is already open." → "The door opens." `Cottage.tsx`'s `reveal` flag — set on every ending beat and on no approach beat — swaps the portrait to
`portrait-wolf-grandma.png` on the first ending beat of _every_ ending, so "Clean arrival / Grandma waves
from her chair" is captioned with a wolf in a bonnet. The silhouette is written into the `wall-window`
tile layer at build time, so it is in **both** windows on **every** ending. `fx-pawprints.png` is drawn,
three-framed, shipped to every player, and placed nowhere. And — in no lens report, plainly visible at
375 and 1280 — **the cottage is not in frame at all**: "You reach the door. The lamp is lit." plays over
open forest, with the chimney smoke that exists in the tile cropped 41px above the camera's top edge.
→ _Right:_ per-ending approach lines; portrait and window silhouette gated on the ending id, not on
`reveal`; the camera framing the door on the beat that says you reached it.

**4. A 32px lattice runs through the grass on every outdoor frame, including the hero image.** `grass-0`
is a tile-centred vignette — 74 luma rim-to-core against §6.2's 20-luma in-tile cap, a 3.7× breach — and
it is 45.8% of the ground layer, while §6.3's "quiet one that lets the map breathe" is 5.5%. A
post-quantise rim pin guarantees at least 4px of ~L184 gutter between two shade tiles, so two can never
merge. Peak-to-peak 24–37 luma; autocorrelation 0.40–0.60 at the tile pitch. **The bush is the minority
contributor — swapping `grass-0` removes roughly twice the lattice contrast that deleting every bush
does.** Visible unaided on `ui-768-00-title.png`.
→ _Right:_ §6.2's cap honoured inside the tile, no tile-pitch periodicity visible at 1× on the title
screen, shared border ring untouched. The `grass-0` band and the rim pin in `w-ground.ts`.

**5. On a phone the trifecta HUD and the sound control fall off screen at the first decision.**
`Trifecta`'s capability map renders all three capabilities, lit or not, into a 44px nowrap header with 8px of slack.
One verdict → 113px overflow at 375; three → 134px. `position: fixed`, so no scrollbar, no wheel, no
reach. Two legs go off-screen, the survivor paints over the frame's rounded corner, and the music toggle
sits 110–131px outside and untappable — with the setting persisted in `localStorage`, so a returning
player can have music on and no way to stop it. **This is the mechanic the asset exists to teach,
mutilated on the device most of the traffic will use.** See `ui-375-04-all-three-live.png`.
→ _Right:_ below 640px the header wraps or drops the chip's count; the three legs stay inside
`--otp-canvas-w`; the sound control stays on screen and tappable.

**6. The Question screen's primary action is three stacked underlined fragments on every phone.**
`.otp-dialogue__foot` is a four-child `nowrap` flex row in a 258px column, and the only child with
`white-space: nowrap` is the passive counter — so the two actions absorb all the squeeze. At 375: "Show
me the skill →" 51.5×54.8 over three lines; "Take it as offered" 33.3×35.3 at **9.8px** over three, with
the orphan "as" alone on its own underlined row. It wraps at 320, 360, 375, 390, 393, 414, 430 and again
at 641. The design's whole mechanism for keeping the unsafe path quiet is relative visual weight; once
both are three-line blocks, all that separates them is 13px purple from 9.8px ash.
→ _Right:_ wrap below ~420px — primary action full-width on its own row, the hint a caption under the
quiet action, the counter last.

**7. Scaling `--otp-ui` into `font-size` with no floor puts the game's definitions and its privacy line
at 9.1px.** 71 of 76 type declarations multiply by `--otp-ui`; 10 carry a `max()`. At 375:
`.otp-hud-goals__label` 7.7px, `.otp-world-warning` 9.1px, `.otp-card__primer` 9.1px (the only sentence
that defines Allow/Restrict/Reject), `.otp-fine` 9.1px (the privacy statement), the errand goals 9.1px.
The primer has the _largest_ base of the three lines at the card's foot and lands smallest purely because
the other two were floored — a hierarchy inversion, not a size choice. It also reaches 390–640px phones
(.78) and 1366×768 laptops (.82).
→ _Right:_ `max(12px, …)` on body copy, `max(11px, …)` on captions, everywhere — or scale spacing only.
There is room: `ui-375-01-explore.png` has ~160px of empty black under the 7.7px label.

**8. The basket icons overflow their slots on every current iPhone.** No lens ranked this; it was buried
inside a finding about breakpoint ordering. The `max-width: 640` block sets `--otp-ui: 0.78` and
`--otp-px: 1` but **not** `--otp-slot-px`, and nor does `max-height: 780`. `.otp-slot` is
`calc(84px × --otp-ui)` while the icon is `calc(64px × --otp-slot-px)`, so the icon overflows once
`--otp-ui` drops below 0.94 with `slot-px` at 1. Measured: 390×844, 393×852, 412×915 and 430×932 give a
66×53 slot holding a 64×64 icon — 13px out of the bottom, breaking the Results basket panel's lower edge;
1366×768 and 1280×700 spill 10px.
→ _Right:_ set `--otp-slot-px` wherever `--otp-ui` is set. One line in two blocks. The two `--otp-ui` media blocks in `panels.css` that set `--otp-ui` without `--otp-slot-px`.

**9. The one Lime CTA is below the fold behind a dead form, and the keyboard cannot scroll to it.**
`.otp-screen` is 1578px in an 860px viewport with the CTA at y=1310. It _is_ reachable — wheel works, and
it is the third Tab stop — so the seed's "unreachable" is refuted. But on arrival `activeElement` is
`BODY`, the document scroller has zero overflow, and PageDown, End, Space and the arrows are all no-ops.
Results is the only long panel that skips the project's own fix: `Dialogue`, `SkillCard` and `Notice` all
carry `tabIndex={-1} data-autofocus` on their body. Above the CTA sits a live "POST YOUR SCORE" form whose
stub client always answers "Leaderboard unavailable right now."
→ _Right:_ `data-autofocus` on the Results body (one attribute, three precedents); CTA band above the Post
form; the form hidden or honestly labelled until Phase 6.

**10. The sound toggle breaks three binding rules and fails WCAG at Level A.** It is Stone `#787771` — a
colour §1 says "does not appear in this UI" — at 4.26:1 on Black, rendered in **Arial** (no `font-family`
declared, so the UA `button` default beats inheritance), in a 38×18 box that is 26.6×12.6 at 375 against
the project's own `--otp-touch-min: 44px`. Its state is carried by colour and a one-glyph shape
difference, under a comment citing §2's refusal of exactly that. And it is **keyboard-inoperable**:
`createInput` in `world/input.ts` preventDefaults Space and Enter whenever the world owns the keyboard — which is
precisely when the toggle is on screen — and sets `interactPressed = true` _before_ the preventDefault, so
pressing Space on the focused toggle **opens an encounter instead**. It is the only focusable control on
Explore.
→ _Right:_ `font: inherit`, a 44px box, Haze when off (12.7:1) — **not** Ash, which §7 change 4 prescribes
and which measures 2.53:1 here — and the world input skipping its preventDefault when focus is inside
`.otp-ui`.

**11. Three of the title screen's four sentences are false where they are read.** "Red is already
standing on the path" — she renders _behind_ the 88%-black copy column at about 1.1:1, i.e. invisible, at
every landscape width (1280, 1440, landscape phone); the chip is suppressed in portrait, so it shows on
exactly the viewports where she is hidden and hides on the two where she is visible. The camera cannot fix
it — `scrollX` is already clamped at the map's left bound. "Arrows to walk and Space to talk" is keyboard
copy shown unchanged on touch. "or just tap on a phone" over-promises: a tap moves Red 4px, only a
sustained hold walks, and the pad is not drawn on the title screen at all. Separately the Cyera wordmark
is `display: none` below 560px, so the hero screen of a marketing asset carries no brand on a phone.
→ _Right:_ delete `titleStanding` (`Title.tsx` already guards it) or narrow the column from 430px to
340px; a coarse-pointer variant of `titleMeta`; the mark in the title card itself, where the deck puts it.

> **The 340px in that recommendation was wrong, and the test written to enforce it agreed with it.**
> Measured on the built preview, Red's painted pixels run x 349..396 at every landscape size from
> 1280×800 to 1920×1080, and her 32px sprite box starts at 339 — a 340px column ends at 359 and
> covers her. The column is **306px**. The guard that was supposed to catch this compared her sprite
> box's _right_ edge to the column's, which stays comfortably positive while her left side is buried,
> so it passed for the whole time she was hidden; it measures the left edge now. The 88%-black column
> is gone too — the card is Shell, which took the landing screen from 41% near-black to 12%.
> Still open and not fixable from the stylesheet: at **844×390** the camera puts Red at x 183..206
> behind a 218px column, so a short landscape phone hides her completely. Only a 156px column would
> clear her there, which the copy cannot live in. That one needs the camera.

### Fix soon after

**12. Question options are 21px tall with zero gap.** `padding: 2px 8px`, no `min-height`: 20.8px on a
20.8px pitch at 375, so a 24px circle on one intersects the other and WCAG 2.5.8 AA fails on size _and_
spacing. The 6px focus halo also lands inside the neighbour. Harm is small — both questions are
bonus-eligible, so a mis-tap costs the reply you wanted, not score — but it is an objective AA failure.
→ _Right:_ `min-height: var(--otp-touch-min)` with `display: flex; align-items: center`, plus a row gap,
exactly as the verdict pills already have.

**13. The copy review cannot reach the copy.** `game.json`'s `status` key declares the strings unreviewed placeholder
and research sign-off is the launch gate; `COPY_REVIEW.md`'s opening claims "No copy lives in code" and "changed
there only." Both halves are false. The doc has one commit against game.json's five; 7 of its 9 quoted
recap lines and both Cottage Finder fine-print lines have since changed; 31 of 61 `strings` keys are not
named in it; it covers none of the bystanders, notices, errand goals or trust lines; and **~35
player-facing strings live in `.tsx`**, including the three verdict labels and both row eyebrows that
§5 quotes verbatim. Seven content keys are dead, one of them (`trustBreakdown`) the missing clause that
makes the breakdown not sum — a take-one-on-trust clean run shows parts totalling 800 under a headline
of 900.
→ _Right:_ regenerate the doc from the shipped file mechanically; move the code strings into `strings`;
lint for player-facing literals in `.tsx` and for keys absent from either side. Then get the sign-off.

**14. Two live regions are born mute, and Esc is inert on the one modal that needs it.** Every verdict
remounts the explore branch, so `.otp-toast` is inserted already containing "Allowed: Cottage Finder" —
and a live region inserted with its text is not announced. The same tick inserts the trifecta warning, so
the climactic beat and its confirmation are silent together. The permanent mount works correctly for the
cottage hint (same node, text mutated), which is the proof. Esc dispatches `BACK`, handled only in
`dialogue` and `inspect`, so on the Notice — the only `aria-modal` panel where Esc must close — nothing
happens.
→ _Right:_ hoist the live region above `renderScreen()` so text arrives as a mutation; route Esc through
one handler that closes whatever modal layer is open.

**15. Results marks the perfect run's two correct refusals with its failure glyph.** On the
restrict/reject/restrict line the only "!" discs in the recap are the two errand goals the player was
right to give up — in the Haze-plus-"!" treatment §5 reserves for "Missed it", with no status word to
soften it, under a hero line reading "100 for 1 of 3 of what Grandma asked." Giving those up is the trade
the whole design is about. On an allow-all run, seven stacked Haze rows invert figure and ground on the
payoff screen.
→ _Right:_ a third, neutral state for a goal forgone to keep the boundary — Natural ground, no "!",
wording like "traded for the boundary" — with Haze kept for the per-skill reveal, where it is the payoff.

**16. The world has no accessible equivalent, and on touch a screen-reader user cannot move Red.**
Known-unfinished Phase 7 work (the accessibility audit item in PLAN Phase 7), so not a regression, but worth stating before publication.
Nothing announces that a traveller is in range, and the only spoken world content, `.otp-say`, sits
outside every live region. The joystick derives its vector from pointer offset, so any point activation —
including a real `touchscreen.tap` — yields (0,0) and moves her 0px; the A button is `pointerdown`-only,
so an AT activation that reduces to a click leaves both controls inert.
→ _Right:_ mirror world state as text into the polite region that already exists and already works; give
the pad four real buttons alongside the drag.

### Craft debt — schedule, don't block

**17. The forest is a small vocabulary stamped many times.** One 2×2 crown placed 318 times (41.8% of the
map); one bush in clumps of 53, 63 and 65, including a 2×8 lattice filling the title screen's left margin;
`path` excluded from the mirror pass, giving an 8×2 slab of byte-identical sand on the gate approach.
Mirroring cannot help the crown — flipping it moves the lit centroid 1.6 points. §7.5 already specifies
three crown scales. → _Right:_ a second and third crown size, 2–3 bush variants, `path` in `BOTH_AXES`.

**18. Panel palette and type-scale drift.** The 2px inset ring is Whisper at 1.075:1 — a ninth colour and
a quarter of §4's separation; Offwhite ships as a background on two Results surfaces and the joystick knob
against §1's "text-on-dark only"; and four of five measurable §3 type roles are off at `--otp-ui: 1`
(panel title 18 vs 14, card title 27 vs 25, dialogue 20 vs 18 at weight 500 vs Regular), largely because
`cyera-theme.css` leaks `line-height: 1.55` into the panel layer. → _Right:_ one reconciliation pass per
role with tracking in `em`, and §4 amended so the next person does not re-derive the ring.

**19. The cast has one body plan.** Spec spans 14–48px (3.4:1); the build delivers 33–46px (1.4:1). The
snail, specified lowest in the cast at 14px, is 40px and taller than the magpie; the owl, a specified 26px
squat barrel, is 45px and within 1px of Red. Thirteen of 36 pairs break §10.2's width-and-height band,
including rabbit and cat at an identical 22×44. §10.1's silhouette test still passes, so this is
assignment, not legibility. → _Right:_ hold the specified heights; run §10.1 at 24px first.

**20. The river ends in mid-air in 18 places.** the shore-tile choice in `forest-map.ts` tested horizontal adjacency only and
only emits `shore-w`/`shore-e`, so `shore-n` and `shore-s` are painted, exported and placed **zero** times.
All 18 bare water-to-grass edges are north or south, two of them under the bridge the player must cross.
→ _Right:_ test all four neighbours. The shore tiles already exist.

**21. Smaller, same list.** The modal panel overhangs the viewport ~4px at 375 and Results clips worse at
768 (`--otp-panel-w` tracks the canvas, not the viewport); the verdict toast covers all three errand goals
for 2.6s in portrait; the A button paints over two basket slots on a landscape phone; everything clips
below 358px with no scroll; `--otp-ui` composes last-wins rather than `min()`, so a 375×667 phone renders
17% _larger_ than a 375×812 one; "800out of 1,000" and "you restricted itCaught it" announce as
run-together words; the HUD goal group has no accessible name; the question list is an invalid listbox
that pre-announces option 1 as selected; "traveler" appears twice against six "traveller"; and the fence,
cottage facade and path centre-line miss their §9/§6.4 specs.

---

## Where the lenses over-reached — don't spend time here

- **"There is no leaderboard screen"** (three lenses, three names). Unstarted Phase 6, tracked in four
  places in the codebase. The only residue is that `capture.spec.ts` emitted
  `ui-<w>-07-leaderboard.png` files byte-identical to Results, so every future reviewer will "discover" a
  leaderboard that does not exist. Drop or rename the shot.
- **"No sound effects."** `GAME_DESIGN` §10 lists "Music and sound effects (muted by default)" under _out
  of scope for v1_, and `ASSETS.md` agrees. The music bed is ahead of plan. The toggle's defects (10) are
  real; the missing SFX is not a defect.
- **The filled Reject pill at 375** is the capture parking the pointer inside the stacked pill after
  clicking "Begin the walk." The product is correct; add `page.mouse.move(0, 0)` so this is not re-filed.
- **"The primer contradicts the card where Restrict matters."** It does not. Night Light's restrict recap
  — "You kept the lantern and chose what to hold it to. It lit what you pointed at" — _is_ the primer's
  "only when you point it at something." The primer's problem is that it shows on one card per run at
  9.1px, not what it says.
- **"The build is broken."** Four lenses reported `tsc` failing on a leftover `zzz-*.spec.ts` using
  `page.accessibility`, removed in Playwright 1.63. Those files are gone and `pnpm typecheck` is green
  across all four workspaces. Reviewers colliding, not a defect.
- **Several cited causes are wrong in ways that would misdirect the fix**, and the notes above use the
  corrected ones: the lattice is `grass-0`, not the bush (and "do not touch the grass variants" was exactly
  backwards); the title occlusion cannot be solved by a camera offset; `margin-left: auto` is inert in an
  overflowing flex row; §7 change 4's Ash remedy halves the toggle's contrast; `tiles/ground.ts`,
  `flora.ts` and `water.ts` are retired files that ship nowhere; and `fx-interact-prompt` is a live
  eligibility indicator, not decoration — drawing a key label into it would re-break the bug its own
  docstring records.
- **The project's horizontal-fit guard cannot fail**, and this is the highest-leverage test change in the
  repo. the `noHScroll` assertion in `ui.spec.ts` asserts `documentElement.scrollWidth <= innerWidth`, and every panel here hangs
  off a `position: fixed` root, which never widens the document. It passes today on a build with 134px of
  header overflow. Assert per element (`el.scrollWidth <= el.clientWidth`, `rect.right <= innerWidth`) in
  the `explore` phase with a verdict recorded, and add 320 to the width list.

---

## The plan

**This week — the blockers.** One engineer, about four days.

1. Results truthfulness: the three-way boundary string, `recapHeading`, the "needed…" template (1). Half
   a day, content plus one component.
2. The notice: evaluate `whenExposed` at end of run, or re-arm it — and close **both** latches, not just
   `already-read` (2). A day in `packages/core`, tests first.
3. The arrival frame: per-ending `arriveLines`, gate the portrait and window silhouette on the ending,
   frame the door (3). A day — note it needs a `portrait-grandma` sprite the manifest never budgeted, and
   a schema change, since `arriveLines` is one pipe-joined string today.
4. The phone header (5), the type floors (7) and `--otp-slot-px` (8). A day of CSS — with the per-element
   fit assertion in the same change, or it will regress again.
5. `grass-0` (4). Half a day in `w-ground.ts`, then `pnpm graybox` and re-shoot the title at all three
   widths. Do not touch the shared border ring.

**Before publication, in parallel.** The Question footer (6), Results focus and CTA order (9), the sound
toggle (10), the title strings (11), and the copy regeneration plus research sign-off (13) — which is the
long pole because it is other people's calendars. Start it on day one.

**The fortnight after.** 12, 14, 15, 16, then the craft debt 17–21 in that order; the forest vocabulary
buys the most per hour.

**Decisions for a human, not defects.**

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                            | Owner                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A   | **Do the flowers stay warm?** §6a moved everything off red; `w-undergrowth.ts` put the flowers and toadstool caps back to rose/ember/rust because painting the undergrowth in Red's hue made her the _least_ findable — her cloak body is L175 against a L167–179 lawn, so hue was all she had left. The painter flags it as unresolvable in one file: those three warm ramps join `PALETTE`, or the flowers go back to Lilac/Haze. | Brand + art direction  |
| B   | **Does Red go back to the brighter Lilac-led cloak?** §6a recommends option A, Lilac-led, as easiest to find at the game's camera. `char-red.ts` inverted it — Aubergine holds the mass, Lilac is rim light only — on measured grounds that Lilac at L175 on this lawn is camouflage. Brand recommendation against measured findability; pick one and record it.                                                                    | Brand + art direction  |
| C   | **Is asking a budget or a record?** §9 open question 2, shipped unresolved: "Asking costs nothing" sits 174px above a depleting "2 questions left", and after the scoring-optimal play it reads "0 questions left." There is no budget in the reducer — the counter just counts the unticked rows two inches above it. Drop the counter, or say what the budget buys.                                                               | Design + game design   |
| D   | **Night Light's direction.** `PLAN.md` D1 was amended 2026-10-16 (honest on inspection, best verdict Restrict), but `RESEARCH_ALIGNMENT` open question 4 is still unconfirmed by research — and this is the card that carries the thesis. It should not publish unconfirmed.                                                                                                                                                        | Game design + research |
| E   | **Does the Post form ship before the API?** It is live, honest about failing, and sits between the recap and the one CTA. Hide it, or label it "Scores open at launch."                                                                                                                                                                                                                                                             | Marketing + eng        |
| F   | **Em dashes in player copy**, and whether `scoreLabel` returns to the deck's "GRANDMA'S COTTAGE REACHED". §9 open question 1, still open.                                                                                                                                                                                                                                                                                           | Copy + brand           |

---

## One last thing

The strongest sentence in this product is on a notice nailed to a post, and most players will never read
it. The second strongest is "Who wrote the instructions your agent follows?", and it sits more than
1,300px down a screen that will not scroll with the keyboard. Nearly every finding above is a variation on
one theme: **the asset's best material is gated, below the fold, or at nine pixels.** Fix the gating
before the grass. The grass is a day; the lesson is the whole point.
