# Target prompts

One brief per screen, written against the build as captured on **18 Oct 2026** and the target frames
on the design canvas (`Today vs target · …`). Each is self-contained: paste one into a session and it
should be enough to do the work.

The left-hand captures were taken by driving the real reducer through
`MEET` / `ASK` / `INSPECT` / `VERDICT` / `READ_NOTICE` / `ENTER_COTTAGE`, so "today" means the shipped
behaviour, not a guess.

Binding references for all of them: `docs/UI_FOUNDATIONS.md` (supersedes `BRAND_AND_UI.md`),
`content/game.json` (every player-facing string), `docs/GAME_DESIGN.md` (cast, verdict semantics, scoring).

---

## 00 Title

**The gap.** The chip says "Red is already standing on the path". She is not on screen.

In `apps/game/src/ui/Title.tsx` and `ui/screens.css`, keep the title card docked but cap it near 44% of
the frame, and set the title screen's camera so Red is framed in the open half rather than off camera.
The chip "Red is already standing on the path" has to be true on screen or be deleted. Move the Cyera
mark from the header into the card. Keep every string as shipped: `strings.title`, `titleHighlight`,
`subtitle`, `introNote`, `introBody`, `play`, `titleMeta`.

**Acceptance.** At 1280, 768 and 375 wide, Red's sprite is fully visible and never under the card. One
Lime on the screen and it is **Begin the walk**.

---

## 01 Explore

**The gap.** The capability badges exist, but nothing on screen says what B, S and W mean.

The three capability badges already render in the header, unlabelled. In
`apps/game/src/ui/components.tsx` and `ui/panels.css` replace the bare circles with a labelled ledger:
one pill per capability carrying its mark and its label from `content.capabilities[].label`, Deep Purple
outline while dormant, filled Lilac when live. Keep it in the header on desktop; below 900px it may
collapse to marks, with the full label still in `aria-label`. Open the talk prompt on proximity rather
than collision.

**Acceptance.** Labels come from content, never hard-coded. State is announced as words, not colour alone.

---

## 02 Question

**The gap.** Two true statements that contradict each other: "Asking costs nothing" and "2 questions left".

`UI_FOUNDATIONS` 9.2 flags this. Fix it in copy, not mechanics. Add a counter string to
`content/game.json` and render "N of 2 answers left" in `apps/game/src/ui/Dialogue.tsx`, counting the
answers this traveller has left rather than an allowance the player spends. Keep a spent question visible
with its reply beneath it instead of replacing the list. Asking must keep costing no score. Leave
"Take it as offered" exactly where it is: it is the only way to take a skill without opening the card,
and it is the most interesting thing to measure.

**Acceptance.** No screen states or implies that asking has a price.

---

## 03 Inspect · Cottage Finder

**The gap.** The card never shows what a verdict leaves running.

Build the capability block `UI_FOUNDATIONS` 9.3 asks design to place. In
`apps/game/src/ui/SkillCard.tsx`, between the two neutral rows and the verdict pills, render one strip on
Natural: an eyebrow reading "Running after \<verdict\>", the three capability pills, then one sentence
naming what the other two verdicts would do instead. Solid pill means already live from an earlier card,
dashed means this verdict turns it on, Clay outline means it stays off. The strip updates as focus moves
between the three verdicts; the pills themselves stay visually identical. Derive it all from the core
`outcomes[verdict].grants`, never a hard-coded map.

**Acceptance.** No Lime anywhere on this screen. The card still carries no danger signal.

---

## 03 Inspect · Night Light

**The gap.** The honest card has one row where the others have two. You can spot the safe skill without
reading it.

Night Light renders one row because it has no `finePrint`, while the other two render two. That teaches a
player to count rows instead of reading them, which defeats the whole card. In
`apps/game/src/ui/SkillCard.tsx` always render both rows; when a skill has no `finePrint`, render the
second row from a content string ("Nothing more than that. There is no fine print on this card.") in the
identical neutral style. Put the line in `content/game.json`, not the component. The verdict primer
should render on every card or none.

**Acceptance.** All three skill cards are the same height and shape. A player cannot identify the honest
card without reading it.

---

## The notice on the post

**The gap.** The content is already right. It is a modal that stops the game.

A modal that halts the game reads as chrome, and this is the one piece of text in the forest the player is
meant to take seriously. In `apps/game/src/ui/Notice.tsx` and `world/forest-scene.ts`, render it as a
panel anchored to the post's screen position while Red is inside the trigger, with a pointer back at the
post, dismissed by walking away. Keep it focusable and in reading order, and keep a visible **Walk on**
for touch. The forest post stays unavoidable on the due-east line.

**Acceptance.** No modal and no pause. The hidden paragraph still appears only when `strangers` is live.

---

## All three at once

**The gap.** The single most important sentence in the game renders as a thin grey strip.

The trifecta warning currently renders directly under the control hint, so it reads as another hint. In
`apps/game/src/ui/Trifecta.tsx` promote it to the recap-reveal treatment the foundations already define:
Haze ground, a 5px Deep Purple left bar, the warning at 19px, and the three capability pills beneath.
Fire it once, at the moment the third capability goes live. Add one line naming the cost in the game's own
currency, the 200-point boundary bonus.

**Acceptance.** Appears exactly once per run, never blocks movement, and is announced through a polite
live region.

---

## 04 Arrive

**The gap.** The arrival opens over whatever the camera was looking at.

Entering the cottage opens the dialogue immediately over the current camera position, so the first line
can land with no cottage on screen. Stage it across `apps/game/src/ui/Cottage.tsx` and
`world/forest-scene.ts`: ease the camera off Red onto the door, let her walk the last steps, count the
basket in the HUD, then open the dialogue and land the three shipped `arriveLines` one at a time. Under
two seconds in total and skippable with Space or a tap.

**Acceptance.** The first arrival line never renders while the cottage is off screen. Keyboard-only
players can skip the whole sequence.

---

## 05 Results

**The gap.** It says "1 of 3 of what Grandma asked" and never lists the three.

In `apps/game/src/ui/Results.tsx` add an errand block under the recap rows: one row per
`scoring.errandGoals` entry with its label, whether it was met, and for a missed goal the reason as a
clause, derived from the run log rather than a table of prose. Use the same status treatment as the recap
rows, a filled Deep Purple check for met and an outline "!" for not.

**Acceptance.** No red and no green. A player can see which goal the safe choice cost them.

---

## 06 Leaderboard

**The gap.** It does not exist. The leaderboard phase renders the results screen again.

There is no `apps/game/src/ui/Leaderboard.tsx`. Build it to the target frame: "Wolf Spotters" with
_Spotters_ as the Season Mix highlight, full-pill Black rows with gaps between them rather than a divided
table, rank badges 1 Lilac, 2 Haze, 3 Offwhite, 4+ plain Clay numerals, a three dot gap row, your row
filled Lilac, the privacy line, and a footer rule carrying the white Cyera mark and **Walk it again**.
Wire it to `net/leaderboard.ts`. The server recomputes the score from the run log with the same
`packages/core` function, so a posted number is never trusted; store a handle and a score and nothing
else; escape the handle on render. Leave the brand illustration slot as a labelled placeholder.

**Acceptance.** `pnpm e2e` covers a successful post, a rejected handle, and the `leaderboardDown` string.

---

## On a phone

**The gap.** The skill card on touch has no way out. Its only controls are Allow, Restrict, Reject.

Two touch bugs, and the first is the worst thing in the game. Enumerating the controls on the skill card
at iPhone 13 size returns exactly `Allow | Restrict | Reject | A`, so a player who opens a card must
commit to a verdict they cannot take back. In `apps/game/src/ui/SkillCard.tsx` add a drag handle and
swipe to dismiss, plus the footer line "A verdict is final. Swipe down to read again." Second, in
`ui/touch-controls.ts` and `ui/panels.css` the d-pad and A button overlap the errand list; below 768px
move the quest chip and basket beneath the world and keep both bottom corners clear.

**Acceptance.** A Playwright run using `devices['iPhone 13']` can open a skill card and leave it without
recording a verdict.

---

## Smaller findings from the board review

A four-lens review of the target frames confirmed nineteen findings and rejected five. The serious
ones are already folded into the frames above. These are the consistency items still outstanding:

- **Key binding.** The boards say `E talk`, following `UI_FOUNDATIONS` section 8. `content/game.json`
  `controlsHint` and `titleMeta` say Space. One of them has to give, and it is a content change either way.
- **Ledger heading.** The boards use "Running now" and "What your skills can do"; `strings.trifectaLabel`
  is the shipped one. Pick one and put it in content.
- **Basket label.** `strings.basketLabel` is "Basket"; some frames say "Your basket". Same fix: read it
  from content rather than hard-coding, in the build as well as the frames.
- **Errand heading.** `strings.errandHeading` is "Grandma asked for"; Results and Door vary it.
- **Mobile capability chips** are abbreviated to "Basket / Strangers / Word" at 375px. Either wrap the
  full labels or add short forms to content as their own keys.
- **Capability chip state** on dark is carried by Deep Purple vs Lilac alone. Add a word or a shape so it
  is not colour-only, and make sure the dormant outline clears 3:1 on Black.
- **New strings.** Several frames needed copy that does not exist in `content/game.json` yet. Treat them
  as new copy for review, not as shipped.

## Not in any prompt above

These are art and content dependencies, not engineering:

- A Lantern Keeper, a wolf-as-Grandma and four bystanders. The concept board never drew them; the target
  frames use the build's generated placeholders, tagged.
- Translator and lantern item icons, same situation.
- The art swap itself. The target frames use the approved concept board; the build renders generated
  graybox. That is its own piece of work and it is the largest single visual gap.
- The brand illustration slot on the leaderboard, still awaiting design (`UI_FOUNDATIONS` 9.4).
