# Brand and UI spec (binding)

Sources: Cyera Employee Brand Kit (via `reference/brand/`), the **Cyera Brand Design System**, and the approved UI mocks in `reference/mocks/`.
**See also `docs/UI_FOUNDATIONS.md`**, transcribed from the "Off the Path — Game UI" design deck (2026-10-16). That deck's
foundations pages are the brand system applied to this game; where this file and that file disagree, that file wins.
**Order of authority when sources disagree: the Cyera Brand Design System (the organization's default, owned by the brand team),
then this file, then the mocks, then the concept PDF.** Several rules below supersede the approved mocks for exactly that reason;
each one says so.
Pixel-perfect reference screens: `reference/mocks/gameplay-concepts.png|html` (Explore, Question, Inspect, Arrive)
and `reference/mocks/results-leaderboard.png|html` (Results, Leaderboard).
Open the HTML mocks in a browser and copy their CSS into components; they were built to be lifted.

## 1. Color tokens (use CSS variables from `reference/brand/cyera-theme.css`)

| Token                             | Hex     | Role in the game UI                                                                                                                |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Black `--cyera-black`             | #160923 | Panel header bars, darkest surfaces, body text. (Concept PDF calls this "Dark violet".)                                            |
| Deep Purple `--cyera-deep-purple` | #441363 | Panel borders, headings, primary fills, dark section backgrounds.                                                                  |
| Lilac `--cyera-lilac`             | #D28EFF | Highlights, panel numbers, active controls, joystick, A button. **The PDF lists #D390FF; the brand kit value #D28EFF is correct.** |
| Haze `--cyera-haze`               | #E8C6FF | Selected dialogue option, soft accents, "fine print" row. (PDF: "Lavender".)                                                       |
| Whisper `--cyera-whisper`         | #F6E8FF | Rare soft section tint.                                                                                                            |
| Natural `--cyera-natural`         | #EEEDE7 | Page/board background, slots, rows. (PDF: "Warm off-white".)                                                                       |
| Shell `--cyera-shell`             | #F6F5F1 | Dialogue panels, card bodies. (PDF: "Alabaster".)                                                                                  |
| Offwhite `--cyera-offwhite`       | #FBFBFB | Text on dark, leaderboard rows.                                                                                                    |
| Clay `--cyera-clay`               | #D4D2C8 | Borders, dividers, empty slots.                                                                                                    |
| Ash `--cyera-ash`                 | #56544E | **All secondary text** (6.9:1 on Shell, 6.5:1 on Natural). **Foreground only.**                                                    |
| Stone `--cyera-stone`             | #787771 | **Foreground only, and only at 24px or larger** — 4.1:1 on Shell fails AA for body text.                                           |
| Aubergine                         | #6D2D93 | Foreground accents only. **Never a background.**                                                                                   |
| Lime `--cyera-lime`               | #BFFFA2 | **One per screen**, as a background fill only: the primary call to action (see section 4). Never on a verdict button.              |

No other colors in the UI. The pixel-art scenes keep their own palette (approved art); do not tint or filter them.

## 2. Type

- **Haffer** for everything, Regular (400) or Medium (500); 600 for numbers and card titles as in the mocks. Fallback `Inter`.
- **Season Mix is always upright, never italic.** The brand book states this directly ("always upright — Season Mix is never set in italic; that is not part of the brand guidelines"). The mocks set it in italic throughout and are **superseded**. Use it for a single highlighted word in a heading or short line ("Off the Path", "Wolf Spotters", "hiding", "Find out."). Never body, never more than one word or short phrase per heading.
- Font files are not in this repo, but they exist: the **Cyera Brand Design System** ships both as variable uprights, `assets/fonts/HafferUprightsVF.ttf` and `assets/fonts/SeasonMixUprightsVF.ttf`. Ask the brand team for those (or the `.woff2` equivalents from the Brand Kit Typography page), self-host in `apps/game/public/fonts/`, and enable the commented `@font-face` blocks in the theme CSS. Until then the fallbacks render.
- Pixel fonts are **not** used in the UI (the concept board used one; the brand direction replaced it with Haffer).
- Sizes at 1x, with the brand book's leading and tracking: panel numeral 24/0.93/−0.03em Medium; panel title 14 caps/+0.18em Medium; card title 25/1.05/−0.02em Medium; dialogue 18/1.2/0 Regular; row eyebrow 10 caps/+0.14em Medium; row body 14.5/1.3 Regular; buttons 15.5 Medium; score 68/0.93/−0.03em; leaderboard rows 17 with 19 score, tabular numerals.

## 3. Component specs (px at 1x; scale with `rem`, keep ratios)

**Shape comes from the brand set and nothing else. Three radii, no others:**

| Radius        | Applies to                   |
| ------------- | ---------------------------- |
| **20px**      | Panels, cards, rows          |
| **Full pill** | Buttons, chips               |
| **10px**      | Portraits, slots, icon wells |

**No drop shadows anywhere.** A panel separates from the world by fill contrast and a **2px inset Haze ring**, never by elevation.
Buttons and chips are pills, not rounded rectangles. (The mocks used 7, 8, 10 and 12px radii and are **superseded**.)

- **Panel frame**: Black ground, Deep Purple border, 20px radius. **Header bar**: numeral in Lilac 24/0.93/−0.03em Medium, title in Offwhite 14 caps/+0.18em Medium. At the right sits a **notation chip** (see below), not decoration. Body below on Shell.
- **Notation chip** (header right, on dark): full pill, Lilac dot, label in Offwhite, then a muted count in Haze. Contextual per screen: `Find Grandma · 0 of 3 skills seen`, `Asking costs nothing`, `Skill 1 of 3`, `3 of 3 skills decided`, `Cyera research`. **The decorative "•••" is superseded**; a labelled sound control takes that corner on Explore.
- **Dialogue box**: Shell, Deep Purple border, 20px radius, 2px inset Haze ring. Portrait left in a 10px frame, pixel-crisp. A **speaker-name eyebrow** (10 caps/+0.14em Medium, Ash) above the line. Line 18/1.2 Regular Black. Options are pills: selected = Haze fill, Deep Purple text, triangle marker; others plain at the same indent. Below a Clay hairline: `Show me the skill →` as an underlined action at the left, and the remaining question count at the right. Advance control is a circular outline button at the right.
- **Skill card**: Shell, Deep Purple border, 20px radius, 2px inset Haze ring. Icon well Natural with Clay border, 10px radius. **Provenance eyebrow** `OFFERED BY THE <CHARACTER>` above the title. Title 25/1.05/−0.02em Medium Deep Purple. **Both rows share one neutral style**: Natural fill, 20px radius, Deep Purple outline icon, eyebrow in Ash, body in Black. The two rows read `WHAT IT DOES` and `WHAT IT ASKS FOR`. **The card never signals danger**: the Haze-and-"!" reveal belongs to Results only.
- **Verdict buttons**: **three identical outline pills**, Deep Purple border and text on Shell, equal width, each with a leading glyph — `✓ Allow`, `⊖ Restrict`, `✕ Reject`. No fills and no colour differences between them. All three keyboard-focusable in that order; none pre-selected. **No Lime on this screen** (section 4).
- **Basket**: Shell panel, 20px radius, label "Your basket" with an `N of 5` count at the right; five slots Natural with Clay border at 10px radius; item sprites pixel-crisp inside. On Explore the basket is **persistently visible in the HUD**.
- **HUD (Explore)**: notation chip and sound control in the header. Floating interact prompt above the character: dark pill, Lilac key badge, then the verb — `E Talk` on desktop, `A Talk` on touch. Round D-pad (Deep Purple disc, Lilac ring, Lilac knob, Haze triangles) bottom-left and A button bottom-right, both 44px+. A control-hint pill reads `Walk · E talk · Esc back`.
- **Result recap rows**: 20px radius. `Caught it` = Natural with a filled Deep Purple check circle. `Missed it` = Haze with a Deep Purple left bar and a Black "!" circle. Heading Deep Purple Medium plus a muted "you restricted it" in Ash. **Status is carried by shape, bar and words. No red, no green, ever.**
- **Leaderboard**: Deep Purple body. Rows are **full-pill Black bars with gaps between them**, not a divided table. Offwhite names, Haze scores, tabular numerals. Rank badges: 1 Lilac, 2 Haze, 3 Offwhite, 4+ plain Clay numerals. **Your row**: Lilac fill, Black text. Gap row of three dots between the top five and you. Title "Wolf Spotters" with Spotters as the single upright Season Mix word. Footer rule, then "The Off the Path research, by [white Cyera logo]" and `Play again`. A brand illustration slot sits top-right, **awaiting design**.
- **CTA band**: Deep Purple card, 20px radius, Offwhite question with a Lilac upright Season Mix "Find out.", Lime "Read the Research" **pill** with a Black arrow disc. (This is the Results screen's one Lime.)

## 4. The Lime rule, screen by screen

| Screen      | Lime                            |
| ----------- | ------------------------------- |
| Title       | **Play**                        |
| Results     | **Read the Research**           |
| **Inspect** | **None at all**                 |
| Leaderboard | None (the CTA lives on Results) |

**Lime never sits on a verdict button.** The brand system gives the reason, and it is a game-design argument rather than a styling one:

> A verdict is not a call to action. Lime on Allow makes the unsafe answer the brightest thing on the screen, so the three verdicts carry no fill at all.

Never two Limes on one screen. Never Lime for decoration. Lime is a background fill only, never text.

## 5. Logo

Use `reference/brand/logos/cyera-logo-black.svg` on light and `cyera-logo-white.svg` on dark, inline SVG, original proportions, clear space at least the height of the "c". Header of any standalone page (not inside the embed) and the leaderboard footer. Do not recolor, outline, stretch or redraw. Symbol-only, green-symbol and lock-up variants are in the Brand Kit Logo Package and are **not** bundled here: ask the team.

## 6. Illustration and icons

Cyera illustration and technical icons are gated through the design team. **Do not fabricate any.** The only art in the game is the approved pixel art (characters, tiles, item sprites). Reserve an empty, labelled slot for one brand illustration on the leaderboard title area.

## 7. Motion and feel

Short and quiet: 120 to 180 ms fades/slides for panels, a soft 2-frame bob on the interact prompt, a single "pop" on a verdict. Nothing flashes. Respect reduced motion. No screen shake for the wolf reveal; use a slow fade and a held beat instead.

## 8. Copy voice

Direct, warm, plain English. Short sentences. The fine print is written the way real permission prompts read ("Requests access to your key so it can keep a backup."), which is the point. Never name vendors, never mock the player, never shame a wrong choice; the recap explains, it does not scold.

## 9. Brand QA checklist (used by the `brand-reviewer` subagent)

- [ ] Only brand-kit hex values, all via variables; no stray colors.
- [ ] Lime appears at most once on any screen.
- [ ] No Aubergine/Stone/Ash used as a background.
- [ ] No red/green status colors; status shown with shape + text.
- [ ] Season Mix used for one highlighted word per heading at most; never body.
- [ ] Logo as-is, correct color for the background.
- [ ] Pixel art is crisp (nearest-neighbor, integer scale); no UI text on canvas.
- [ ] Contrast: body text at least 4.5:1, large text at least 3:1 on every pairing.
- [ ] Matches the mocks at 375, 768 and 1280 px.
