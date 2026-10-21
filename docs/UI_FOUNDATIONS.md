# UI foundations (binding)

Transcribed from **"Off the Path — Game UI"** (11-page design PDF, received 2026-10-16). Pages 10
and 11 of that deck are a brand-system reconciliation and they supersede `docs/BRAND_AND_UI.md`
wherever the two disagree. The deck's own words: _"Every value here comes from the Cyera brand design
system. Nothing in the game UI may introduce a colour, radius or typeface that is not on this page."_

Source images are in the deck; this file is the machine-readable version engineering works from.

---

## 1. Palette in use

| Token       | Hex       | Role                                               |
| ----------- | --------- | -------------------------------------------------- |
| Black       | `#160923` | Panel ground, body text                            |
| Deep Purple | `#441363` | Borders, headings, dark surfaces                   |
| Lilac       | `#D28EFF` | Panel numerals, your leaderboard row               |
| Haze        | `#E8C6FF` | Selected option, the recap reveal row              |
| Shell       | `#F6F5F1` | Every panel body over the world                    |
| Natural     | `#EEEDE7` | Card rows, basket slots, icon wells                |
| Clay        | `#D4D2C8` | Hairlines, empty slots, rank 4+                    |
| Lime        | `#BFFFA2` | One call to action per screen. Never anything else |

All eight match the values already in `reference/brand/cyera-theme.css`, so no token changes are
needed.

- **Aubergine `#6D2D93` and Stone `#787771` are foreground only and do not appear in this UI.**
- **Pistachio is a logo colour and is never used in the game.**
- Offwhite is used for panel titles on Black (contrast table below) but is not listed in the palette
  block; treat it as text-on-dark only.

## 2. The Lime rule, restated

| Screen      | Lime                  |
| ----------- | --------------------- |
| Title       | **Play**              |
| Results     | **Read the Research** |
| **Inspect** | **None at all**       |

The deck gives the reason, and it is a game-design argument, not a styling one:

> "A verdict is not a call to action. Lime on Allow makes the unsafe answer the brightest thing on
> the screen, so the three verdicts carry no fill at all."

## 3. Type

| Role           | Size / leading / tracking / weight |
| -------------- | ---------------------------------- |
| Panel numeral  | 24 / 93% / −3% / Medium            |
| Panel title    | 14 / +18% tracking / Medium        |
| Card title     | 25 / 105% / −2% / Medium           |
| Dialogue       | 18 / 120% / 0% / Regular           |
| Row eyebrow    | 10 / +14% tracking / Medium        |
| Highlight word | Season Mix, **upright**, one word  |

> "Season Mix is **never set in italic** — the brand book states this directly. It highlights at most
> one word inside a heading, and never sets body copy."

## 4. Shape

**Three radii, no others:**

| Radius    | Applies to                   |
| --------- | ---------------------------- |
| `20px`    | Panels, cards, rows          |
| Full pill | Buttons, chips               |
| `10px`    | Portraits, slots, icon wells |

> "No drop shadows anywhere: panels separate from the world by fill contrast and a **2px inset Haze
> ring**, never by elevation."

## 5. Components

- **Notation chip, on dark.** Top-right of the header bar. Lilac dot, then a label, then a muted
  count: `• Find Grandma   0 of 3 skills seen`. Contextual per screen (`Asking costs nothing`,
  `Skill 1 of 3`, `3 of 3 skills decided`, `Cyera research`).
- **Verdicts, identical by design.** Three outline pills, Deep Purple border and text on Shell, each
  with a leading glyph: `✓ Allow`, `⊖ Restrict`, `✕ Reject`. No fills, no colour differences.
- **Skill card rows, also identical.** `WHAT IT DOES` and `WHAT IT ASKS FOR` share one neutral style
  on Natural with a Deep Purple outline icon. The card never signals danger.
- **Recap rows, the reveal, on Results only.** `Caught it` is Natural with a filled Deep Purple ✓;
  `Missed it` is Haze with a Deep Purple left bar and a Black `!` circle.
  > "Status is carried by shape, bar and words. No red, no green, ever."
- **Sound control.** A labelled speaker toggle replaces the decorative three dots.

## 6. Contrast, measured

| Pairing                               | Ratio  | Verdict                     |
| ------------------------------------- | ------ | --------------------------- |
| Black on Shell (dialogue, row body)   | 17.5:1 | Passes                      |
| Deep Purple on Shell (card titles)    | 12.7:1 | Passes                      |
| Ash on Shell (all secondary text)     | 6.9:1  | Passes                      |
| Ash on Natural (row eyebrows)         | 6.5:1  | Passes                      |
| Offwhite on Black (panel titles)      | 18.5:1 | Passes                      |
| Lilac on Black (panel numerals)       | 8.3:1  | Passes                      |
| Black on Lilac (your leaderboard row) | 8.3:1  | Passes                      |
| Black on Lime (the call to action)    | 16.4:1 | Passes                      |
| ~~Stone on Shell~~                    | 4.1:1  | **Fails — replaced by Ash** |
| ~~Stone on Natural~~                  | 3.8:1  | **Fails — replaced by Ash** |

## 7. Binding changes from the approved mocks

Quoted verbatim from page 11. These override `docs/BRAND_AND_UI.md`.

1. Season Mix is set upright everywhere. It was italic throughout the mocks.
2. Verdict buttons are three identical outline pills. Lime no longer sits on Allow.
3. Both skill-card rows share one neutral style; the Haze-and-"!" reveal moves to Results.
4. Stone is replaced by Ash for every text size below 24px.
5. Radii follow the brand set: 20px, full pill, 10px. The mocks used 7, 8, 10 and 12.
6. Buttons and chips are pills, not rounded rectangles.
7. The decorative "•••" is replaced by a labelled sound control.
8. Night Light has no fine print, so it reads as honest on inspection. **Amended 2026-10-16:** it is no longer safe by default — its best verdict is Restrict, which grants nothing, and Allow leaves it reading what strangers wrote.

---

## 8. Screen notes from the deck (pages 1 to 9)

Things the foundations pages do not cover but the screen designs show. Treat these as the intended
product; where the current build differs it is a gap, not a decision.

**00 Title.** Cyera logo at the top of the card. "Off the **Path**" with Path as the Season Mix
highlight word. Subtitle, a three-line premise, a Lime **Play** pill with a Black arrow disc, and a
muted line: `Arrow keys to walk · E to talk · about 5 minutes`. The card sits over the live world,
translucent, with the controls faintly visible behind it.

**01 Explore.** Header chip reads `Find Grandma   0 of 3 skills seen`, plus a sound toggle. A
floating interact prompt sits above the character as a dark pill: a Lilac key badge then a verb,
`E Talk` on desktop and `A Talk` on touch. Bottom left is a round D-pad with four triangles; bottom
right is the A button. A control-hint pill reads `Walk · E talk · Esc back`. **The basket is
persistently visible in the HUD**, bottom right, as a dark pill with five slots.

**02 Question.** Chip reads `Asking costs nothing`. The dialogue panel has a portrait in a 10px
frame, a **speaker name eyebrow** (`RABBIT`), the line, then the questions as pills. Below a
hairline: `Show me the skill →` as an underlined action on the left, and **`2 questions left`** on
the right. Questions are a budget, not an unlimited list, and "Show me the skill" is a separate
action rather than a third question.

**03 Inspect.** Chip reads `Skill 1 of 3`. Card leads with a **provenance eyebrow**,
`OFFERED BY THE RABBIT`, then the title, then the two neutral rows, then the three outline verdict
pills. The basket sits directly below in its own panel with a `2 of 5` count. On mobile the card is a
**bottom sheet** with a drag handle, stacked full-width verdict pills, and the footer line
`A verdict is final. Swipe down to read again.`

**04 Arrive.** Chip reads `3 of 3 skills decided`. The cottage scene carries the story: wolf
silhouette in the lit window, paw prints on the path, smoking chimney, mailbox with the flag up. The
dialogue has a `PURPLE` speaker eyebrow and a circular `⌄` advance button at the right.

**05 Results.** Purple's portrait, eyebrow `GRANDMA'S COTTAGE REACHED`, then the score as a large
numeral with a `points` suffix, then **a plain-language breakdown**:
`600 from your three verdicts · 100 for asking what the compass needed`. Section heading
`WHAT WAS hiding IN EACH SKILL` with _hiding_ as the Season Mix highlight. Recap rows, then
`POST YOUR SCORE` with a pill field and a Deep Purple **Post** pill, then the privacy line, then the
CTA band, then `See the leaderboard` and `Play again` as footer links.

**06 Leaderboard.** `Wolf Spotters` with Spotters as the highlight word. Subtitle
`Top players this week · resets Monday`. Rows are full-pill Black bars with gaps between them, not a
divided table. Rank badges: 1 Lilac, 2 Haze, 3 Offwhite, 4+ plain Clay numerals. A gap row of three
dots, then your row filled Lilac. Privacy line, then a footer rule with
`The Off the Path research, by [white Cyera logo]` and `Play again`. There is a dashed
**brand illustration slot, awaiting design**, top right.

---

## 9. Open questions for design

1. **Em dashes.** The deck's results copy uses them ("Not every skill is a wolf — refusing all of
   them costs you too."). House preference on this project has been to avoid em dashes in player
   copy. Confirm which wins before the research review signs off strings.
2. **Question budget.** `2 questions left` implies asking is limited, while the Question chip says
   `Asking costs nothing`. Those read as contradictory. Is the budget per character (two of the three
   questions) or a run-wide allowance, and does spending it cost score?
3. **The trifecta prototype.** The deck predates the capability model in
   `docs/RESEARCH_ALIGNMENT.md`. The Inspect card in the deck has two rows; the prototype adds a
   third block showing which capabilities a verdict leaves running. Design input needed on how that
   block sits inside the new card.
4. **Brand illustration slot** on the leaderboard is still marked awaiting design.
