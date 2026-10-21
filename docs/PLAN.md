# Build plan: Off the Path, "That's Not My Grandma"

How to use this file: work **one phase per Claude Code session**. Start the session in plan mode, restate the phase goal and tasks, get approval,
implement, tick the boxes, run the `phase-done` skill, commit, then `/clear` before the next phase.
Effort sizes: **S** under half a day, **M** about a day, **L** several days (for one engineer pairing with Claude Code; art and review lead times are separate).

## Progress at a glance

**Updated 2026-10-21, at `51574fc`, production live.** This is the status board. The phase
sections below are the detailed checklists. Phase 9 is the v2 redesign, and "Readiness findings" is
everything the 2026-10-21 sweep found that is not yet fixed.

### Done

- **"The line" — all three causes**: two one-pixel backdrop holes; a stale checkout of a different
  repository serving the game on `:5173` (trap 10); and the camera's top edge cutting a canopy row.
- **The client's list**: the trees; the Inspect card (three verbs, three explanations); the phone
  goals panel (16% of the screen down to 5%); the phone glitches (canopy fixed; market stall measured
  and accepted, because it cannot be moved out of frame); the Results block; **the gate**; the arcade
  question answered (yes to the mobile deck, no to the cabinet).
- **Purple's back view**: the hood has a shaded side and the nape is a glimpse, not a panel
  (`8c45e68`). **Waiting on your eye** — you said it was "better but still not there" before this
  pass.
- **The rename, Red → Purple** (D11: "Little Purple" in copy, "Purple" in code), **shorter copy**,
  and a **how-to-play that is visible without scrolling at every screen size**, on keyboard and touch.
- **The leaderboard, end to end**: built; shown on Results in four honest states; never says "posted"
  above "no runs"; and **live against the database** since `8656fcb` — `/api/top` reads Supabase,
  `/api/score` answers from our own code.
- **Security**: the debug handle no longer ships to players; the shipped-code lint rules cover the
  live routes; the high-severity Vite advisory is patched; the CSP is on every response, functions
  included.
- **Process**: the v2 spec (`docs/GAME_DESIGN_V2.md`); the staffing policy (Opus 5.5 for judgment,
  Sonnet and Haiku for labour); the database runbook and migrations.

### In progress

- **v2 Phase A is done** (`87c80ff`): the new rules are in `packages/core/src/v2`, beside v1, at
  100% coverage. **Phase B, the six or seven real skills, is next** and waits on your go.
- **The readiness blockers are fixed** (`51574fc`), with the question button and the privacy line.

### Planned — v2, "collect, and find out what you collected" (Phase 9)

Collect freely from 6–7 characters; a 3-minute hard timer where running out is its own ending;
scoring by what the skills **did**, so greed is punished; the reveal screen as the payoff; a
Cyera-branded landing page. **A** rules → **B** content → **C** world → **D** screens →
**E** leaderboard → **F** readiness. Full checklist below.

### Open defects — readiness sweep (fix before launch)

**3 blockers**: on a phone at 200% zoom the Allow / Restrict / Reject buttons are unreachable, and
the test written for exactly that passes because it scrolls for itself; and an asset that fails to
load is completely silent. **Majors include two that matter most on a security company's page**:
the one call to action links to a **404 on cyera.com**, and the privacy line promises "no cookies"
while the game keeps a key in the visitor's browser. Full list under "Readiness findings".

### Waiting on you

The **landing-page background image**. **Legal review** of the leaderboard and privacy copy (D10).
The **real research URL** for the call to action. **Brand sign-off on the cape mark**. "Wolf
Spotters" **with or without** its Season Mix highlight. **Post one score** to prove the write path.
Turn on **Vercel rate limiting** for `/api/*`, and clear Vercel's **billing "Action required"**.
D2 (who makes production art) and D6 (the real Haffer and Season Mix files). Your go on **v2
Phase A**.

## Milestones

| Milestone                                                                                                                                               | When           | What you can show                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **M0 Foundations**                                                                                                                                      | End of Phase 0 | Repo, CI, brand tokens, graybox art, decisions made.                                                                  |
| **M1 Walking Purple**                                                                                                                                   | End of Phase 2 | Move Purple around the graybox forest on keyboard and touch.                                                          |
| **M2 Vertical slice**                                                                                                                                   | End of Phase 4 | One full encounter (Rabbit + Cottage Finder) from talk to verdict to basket, in brand UI. **Show stakeholders here.** |
| **M3 Feature complete**                                                                                                                                 | End of Phase 6 | Three skills, cottage finale, results, leaderboard (mock or live).                                                    |
| **M4 Release candidate**                                                                                                                                | End of Phase 7 | Embedded, accessible, fast, hardened.                                                                                 |
| **M5 Launch**                                                                                                                                           | End of Phase 8 | Live on the Off the Path page, monitored.                                                                             |
| Rough total: 6 to 8 weeks of calendar time with one engineer, one artist part-time, and reviewers on call. Real art is the main schedule risk (see D2). |

## Open decisions (resolve in Phase 0; recommended defaults in bold)

| ID  | Question                                                                                                                                                                                                                                                                                                                                                 | Recommended default                                                                                                                                                                                                                                         | Owner                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1  | Is Night Light genuinely safe, or malicious too?                                                                                                                                                                                                                                                                                                         | **Safe**, so "reject all" is not optimal. Update the Results mock copy accordingly (the mock shows it malicious).                                                                                                                                           | Game design + research |
| D2  | Who produces production pixel art and when? Concept board is flattened.                                                                                                                                                                                                                                                                                  | **Design team or a pixel artist produces tileset, sprites, portraits** against `docs/ASSETS.md`; graybox until then.                                                                                                                                        | Design lead            |
| D3  | Leaderboard backend host                                                                                                                                                                                                                                                                                                                                 | **Vercel Functions (Node) + managed Postgres/KV** behind a swappable interface (originally Cloudflare Workers + D1; changed because the game deploys on Vercel).                                                                                            | Eng + Security         |
| D4  | Handle only, or optional email field for research follow-up?                                                                                                                                                                                                                                                                                             | **Handle only** (no gate before the research).                                                                                                                                                                                                              | Marketing + Legal      |
| D5  | Mobile portrait layout                                                                                                                                                                                                                                                                                                                                   | **Canvas on top, panels docked at the bottom; never require rotation.**                                                                                                                                                                                     | Design                 |
| D6  | Real Haffer / Season Mix files available?                                                                                                                                                                                                                                                                                                                | **Yes: request woff2 from Brand Kit**; fallbacks meanwhile.                                                                                                                                                                                                 | Brand                  |
| D7  | Scoring weights. **As shipped: best verdict 200, safe but costly 100, compromised 0, and Word Weaver restrict 50** (because restricting it now earns an errand goal; at 100 it was a free trade). Question bonus +100, boundary bonus +200, trust bonus +100, three errand goals at 100. The "partial credit 150" this row used to name was never built. | **Resolved 2026-10-17** by the three errand goals: reject-all is 700 against a 1,000 ceiling and draws its own ending, and the best full-errand line (750) beats it. Restrict-all at 950 — the figure for a run that reads the forest post — is still open. | Game design            |
| D8  | Must the player meet all three characters before the cottage?                                                                                                                                                                                                                                                                                            | **Yes** (consistent scores).                                                                                                                                                                                                                                | Game design            |
| D9  | Where is the game hosted and who owns analytics?                                                                                                                                                                                                                                                                                                         | **Static host under a cyera.com subdomain, embedded by iframe; parent page owns analytics via postMessage events.**                                                                                                                                         | Web team               |
| D10 | Leaderboard retention, moderation, privacy review                                                                                                                                                                                                                                                                                                        | **Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.**                                                                                                                                                          | Legal + Security       |
| D11 | After the 2026-10-21 rename of the protagonist from Red to Purple, is she "Purple" or "Little Purple"? Her cloak is Aubergine and the brand rules ban red outright, so "Red" was a contradiction from the first commit; the fairy-tale shape survives the rename and the colour error does not.                                                          | **"Little Purple" in player-facing copy, "Purple" in code, identifiers, docstrings and docs.** A player meeting "Purple" alone reads a colour; "Little Purple" reads a person and keeps the tale's shape. Four player-facing strings carry the long form.   | Game design + Brand    |

### Decisions recorded (2026-10-15, Phase 0)

All ten decisions take the recommended default above. Owners should confirm; two need action outside engineering.

| ID  | Decision                                                                                                                                                                                                                                                                                                                                         | Status                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Amended 2026-10-16:** Night Light has no fine print, so it stays honest on inspection, but it is no longer safe by default. Best verdict is Restrict, which grants nothing; Allow leaves it reading what strangers wrote.                                                                                                                      | Amended by `docs/MAKING_IT_BETTER.md` section 3; recap copy updated. **Research has not confirmed the direction** — `docs/RESEARCH_ALIGNMENT.md` open question 4 is still open, and its owners are game design + research. |
| D2  | Design team or a pixel artist produces tileset, sprites, portraits. Graybox until then.                                                                                                                                                                                                                                                          | Brief drafted in `docs/PHASE0_REQUESTS.md`, not yet sent                                                                                                                                                                   |
| D3  | **Changed 2026-10-16:** Vercel Functions (Node 22 runtime) in the same Vercel project as the game, behind `LeaderboardClient`. Same origin means no CORS and `connect-src 'self'`. **Store settled in Phase 6: Supabase over PostgREST through `fetch`** — no driver and no new dependency, rather than the "Postgres or KV" this row left open. | Recorded; **Security still to confirm, and `security-reviewer` has not been run on the shipped service**                                                                                                                   |
| D4  | Handle only, no email field.                                                                                                                                                                                                                                                                                                                     | Recorded; Legal to confirm                                                                                                                                                                                                 |
| D5  | Canvas on top, panels docked at the bottom on portrait; never require rotation.                                                                                                                                                                                                                                                                  | Recorded                                                                                                                                                                                                                   |
| D6  | Request Haffer and Season Mix woff2 from Brand Kit.                                                                                                                                                                                                                                                                                              | Request drafted, not yet sent                                                                                                                                                                                              |
| D7  | Start with GAME_DESIGN section 7 scoring; tune in Phase 8.                                                                                                                                                                                                                                                                                       | Recorded                                                                                                                                                                                                                   |
| D8  | Player must meet all three characters before the cottage.                                                                                                                                                                                                                                                                                        | Recorded                                                                                                                                                                                                                   |
| D9  | Static host on a cyera.com subdomain, iframe embed, parent page owns analytics.                                                                                                                                                                                                                                                                  | Recorded; Web team to confirm                                                                                                                                                                                              |
| D10 | Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.                                                                                                                                                                                                                                                   | Recorded; Legal sign-off pending                                                                                                                                                                                           |

---

## Phase 0: Foundations and decisions (M0) [target: 2 to 3 days]

Goal: a green, empty-but-real project; decisions made; art unblocked.

- [x] (S) Create repo, pnpm workspace (`packages/core`, `apps/game`, `apps/api`, `tools/*`), strict TS config, ESLint, Prettier, `.gitignore`. Copy this kit's `CLAUDE.md`, `.claude/`, `docs/`, `content/`, `reference/` into it.
- [x] (S) Pin dependency versions (check publish dates; skip anything under 14 days old). Commit lockfile.
- [x] (S) CI workflow: install, typecheck, lint, unit tests, build, `pnpm audit`, Playwright smoke.
- [x] (M) **Spike: Phaser vs hand-rolled canvas.** Build a 100-line prototype of each (tilemap + moving sprite + resize). Record gzipped JS size and mobile fps. Keep Phaser unless over budget (ARCHITECTURE section 11). Write the result into `docs/ARCHITECTURE.md`.
- [x] (S) `apps/game/src/ui/tokens.css`: import the brand theme; add game-specific tokens (panel radius, border widths, sizes from BRAND_AND_UI) as CSS variables.
- [x] (M) `tools/graybox`: generate placeholder tileset, `map-forest.json` with all landmarks, sprites, portraits, items with final names (ASSETS.md).
- [ ] (S) Resolve D1 to D10 with owners; record answers in this table. Update GAME_DESIGN if D1/D7/D8 change.
- [ ] (S) Request: Haffer + Season Mix woff2, symbol logo files if wanted, pixel-art brief handed to design (send ASSETS.md + the board).
- [x] (S) Update CLAUDE.md "Commands" with real scripts.
      Acceptance: `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass in CI; graybox art loads in a blank Phaser scene; decisions table filled.

## Phase 1: Core rules, test-first

Goal: the entire game works as pure logic with no graphics.

- [x] (S) `content.ts`: zod schema for `content/game.json`; loader; **content lint** (every skill has 3 outcomes; `bestVerdict` has the max points; at least one skill without `finePrint`; flags used exist; no empty strings; no banned vendor words). Copy `game.seed.json` to `game.json`.
- [x] (M) `state.ts` + `reducer.ts`: `GameState`, actions (`START`, `MEET`, `ASK`, `INSPECT`, `VERDICT`, `ENTER_COTTAGE`, `FINISH`, `RESET`), phase transitions and guards (can't give a verdict before inspecting; can't enter cottage before three verdicts; verdicts final).
- [x] (S) `runlog.ts`: append-only run log with injected clock; legality validator (`isLegalLog(log, content)`), used by the API later.
- [x] (M) `scoring.ts`: `score(log, content)`, per-skill breakdown, question bonus rule, tiebreak helper.
- [x] (S) `outcomes.ts`: basket and flags derivation, `ending(state)`, recap rows (one per skill).
- [x] (M) Tests: table-driven skill x verdict; reject-all, allow-all and perfect-run totals (with the seed content and no questions asked: reject-all 600, allow-all 300, perfect 900; perfect plus the question bonus 1000; adjust if content changes); illegal sequences rejected; log replay equals live state (property test).
      Acceptance: `pnpm test` green, 100% branch coverage on `packages/core`; a CLI script `pnpm sim` plays any strategy through the reducer and prints score + ending.

Phase 1 notes (2026-10-16):

- Decisions: Night Light "restrict" was set at 150 here, shipped at 100, and is **200 and the best verdict** since 2026-10-16. Only the `needs` and `who` questions earn the +100 bonus (`scoring.bonusQuestions` in content); "Show me" never does. Flags are set at verdict time.
- Totals with `content/game.json`. **Superseded 2026-10-17** by the three errand goals. **Say which run shape a total belongs to**: two of the three goals need a notice read, so the same verdicts score differently depending on where Purple walked, and this line used to mix the two. Without questions and (with):

  | Line                    | Straight to the cottage, no notice read | Both notices read |
  | ----------------------- | --------------------------------------- | ----------------- |
  | perfect (`rst/rej/rst`) | 900 (1,000)                             | 900 (1,000)       |
  | restrict-all            | 750 (850)                               | 850 (950)         |
  | reject-all              | 600 (700)                               | 600 (700)         |
  | allow-all               | 100 (200)                               | 200 (300)         |

  The restrict-all figure here was 850 (950) under a "walking straight to the cottage" heading; that is the right-hand column's number. Two lines reach 1,000, with questions asked: `restrict/reject/restrict` anywhere, `restrict/reject/allow` only after both notices. `pnpm sim` prints the right-hand column. So does the per-line table in `docs/DESIGN_V2.md` — which is correct but does not say so — and `docs/GAME_DESIGN.md` section 7 carries both columns.

- Actions added beyond the plan list: `BEGIN` (intro to explore), `BACK` (Esc closes one panel level), `LEADERBOARD` (results to leaderboard). Rejected actions return the same state plus a typed reason (`tryReduce`).
- `content/game.json` gained `startBasket` (`key`, `letter`) and `scoring.bonusQuestions`. `content/game.seed.json` is left as the original kit seed.
- Core imports use explicit `.ts` extensions so Node can run the sim without a TypeScript runner.

## Phase 2: The forest world (M1)

Goal: walk Purple around the graybox forest on any device.

- [x] (M) Boot: load content + assets (fail loudly on missing), Phaser config (`pixelArt`, `roundPixels`, 480x270, FIT scaling, integer zoom, letterbox).
- [x] (M) Tilemap loader for `map-forest.json` with layers (ground, decor-below, decor-above, collision); objects layer parsing (`spawn-purple`, `npc-*`, `trigger-cottage`).
- [x] (M) Player: 4-direction movement, speed tuned (about 60 px/s logical), tile collision, camera follow with world bounds, depth sorting so Purple walks behind canopy tiles.
- [x] (M) Input layer: keyboard (arrows/WASD, Space/Enter/E), **DOM virtual joystick + A button** (pointer events, multi-touch safe), unified `InputState`. Pause input when `phase !== 'explore'`.
- [x] (S) NPC placement from objects; interaction radius; floating "A" prompt (bobbing, respects reduced motion).
- [x] (S) Event bus + store wiring (ARCHITECTURE section 6). `interact(characterId)` flips `phase` to `dialogue` (UI not built yet; log to console).
- [x] (S) Cottage trigger: emits `enteredCottage`; gate logic uses `canEnterCottage`.
- [x] (S) Perf pass: no per-frame allocations; check 60 fps on a throttled mobile profile.
      Acceptance (M1): Purple walks the whole map on keyboard and touch without clipping through collision; camera is smooth; NPC prompts appear in range; resizing and rotating keep pixels crisp.

Phase 2 notes (2026-10-16):

- Movement and collision are hand-rolled in `apps/game/src/world/logic.ts` (pure, 26 unit tests) rather than Phaser Arcade Physics: deterministic, testable, and no per-frame allocations. Phaser draws the tilemap and sprites, and nothing else.
- Scaling: Phaser runs at a fixed 480x270 with `Scale.NONE`; `ui/stage.ts` sets the canvas CSS size to a whole number of device pixels per game pixel (`integerZoom`), verified at DPR 1, 2 and 3. Phaser's FIT mode produced fractional scales and blurred the art.
- Camera uses `cameraTopLeft` with rounded, clamped scroll, so tiles never shimmer.
- Depth: Purple sorts by her feet; the `decor-above` canopy layer is pinned above everything, so she walks behind tree tops.
- Until Phase 3 there is no title screen: the run auto-starts, and dialogue and the cottage hint appear as a plain DOM toast.
- Measured: 60 fps while moving at 4x CPU throttle and DPR 2, with a flat JS heap. Bundle is now 368 KB gzipped against the 450 KB budget; Preact and the UI still have to fit, so Phase 3 should watch it.
- Not verified: a real phone. Touch is covered by Playwright emulation only; check a Vercel preview on a device before closing M1.

## Phase 3: Brand UI overlay

Goal: every panel from the mocks exists as accessible DOM, driven by the store.

- [x] (M) Base: `Panel` (frame + 40px header + number/title/dots), `DialogueBox`, `Button` (primary Lime, Haze, Deep Purple variants), `Pill`, focus ring styles. Build Storybook-style `/ui-lab` dev page (not shipped) showing every component in every state beside its mock PNG.
- [x] (M) `Title` / `Intro` screens (Grandma's note, quest line, Play button; Cyera logo as-is).
      Built as `apps/game/src/ui/Title.tsx` and covered by e2e (`title-claims.spec.ts`, plus the title
      shots in `game.spec.ts` and `css-contract.spec.ts`) and by `apps/game/test/title.test.ts`.
- [x] (M) `Dialogue`: portrait, typed-in text (skippable; instant under reduced motion), three question options with keyboard navigation and `aria-live`.
- [x] (M) `SkillCard`: icon well, promise row, fine-print row (only if present), Allow/Restrict/Reject (equal width, **no Lime on any verdict button**), focus trap, Esc back-out; `Basket` with five slots.
      This line used to say "Lime on Allow". `docs/UI_FOUNDATIONS.md` section 2, `docs/BRAND_AND_UI.md` and `docs/HANDOFF.md` all forbid it — Lime on Allow makes the unsafe answer the brightest thing on screen — and the shipped card correctly does not do it: there is no Lime in `panels.css` at all. Do not reinstate it from this plan.
- [x] (S) `HUD`: quest pill, joystick and A (from Phase 2) skinned per spec.
- [x] (S) Responsive rules at 375 / 768 / 1280, portrait docking (D5).
- [ ] (M) Visual tests: Playwright screenshots of `/ui-lab` components vs the mock crops, with tolerance; axe scan; contrast test on every token pair used.
- [x] Run `brand-reviewer`; fix findings. Ran 2026-10-16: a fail with twelve findings, all listed and
      resolved under **Brand review** in Phase 5 below, with one open deviation recorded there for sign-off.
      Acceptance: each component visually matches its mock; keyboard-only operation works; axe has no serious or critical violations.

Phase 3 notes (2026-10-16), partial:

- Done: `Panel` (frame, 40px header, number/title/dots), `Dialogue` (portrait, typewriter text skippable and instant under reduced motion, three options with arrow-key navigation and `aria-live`), `SkillCard` (icon well, promise row, fine-print row, Allow/Restrict/Reject, focus trap), `Basket` (five slots), the HUD quest pill, and responsive rules at 375 / 768 / 1280 with portrait docking.
- Not done at the time of this note: Title and Intro screens, the `/ui-lab` page, Playwright screenshot comparison against the mock PNGs. Results and Leaderboard belong to Phases 5 and 6.
  **Since then (2026-10-20):** Title and Intro ship and are e2e-covered, so that box is ticked above. The `/ui-lab` page and the mock screenshot comparison are still the only open items in this phase.
- Item icons moved into `content/game.json` as `items` (basket item id to asset key), with a lint that every basket item has an icon and no icon is listed that never reaches the basket. Keeps rule 3: adding an item needs no code change.
- Two real bugs found by testing: the focus trap re-ran on every render and kept pulling focus back to the canvas, and the world input layer's `preventDefault` on Space and Enter cancelled activation of the panels' own buttons. The input layer now stands down whenever `phase !== 'explore'`, and owns Esc alone.
- Art: `tools/graybox` is now a procedural pixel-art generator (shaded ramps, textured grass, autotiled paths and shores, a winding river with a waterfall, 2x2 tree canopies over two-tile trunks, cottage, market stall, well, lantern post) rather than flat colour rectangles. Still placeholder art: D2 stands, and a pixel artist's work would replace it file for file.
- Bundle is 376 KB gzipped against the 450 KB budget.

## Phase 4: Vertical slice, Rabbit and Cottage Finder (M2)

Goal: one encounter end to end through the real systems.

- [x] (M) Wire Dialogue to content: greet, three asks (record `asked`), "Show me" opens SkillCard (record `inspected`).
- [x] (S) Verdict flow: apply outcome (basket, flags, log), brief verdict toast (shape + text, no color-only), return to explore.
- [ ] (S) Quest marker updates; "route" in the basket unlocks a subtle path hint in the world (a footprint trail graybox).
- [x] (M) Playwright e2e: talk, ask all, inspect, Restrict -> basket has route + key, score 300 so far.
- [ ] (S) Internal demo build deployed to a protected preview URL.
      Acceptance (M2): a stakeholder can play the Rabbit encounter on their phone and desktop with brand-correct UI. Collect feedback on card readability: _can a first-time player find the fine print?_ Adjust copy and layout before replicating to other skills.

Phase 4 notes (2026-10-16): the encounter runs end to end through the real store, content and UI, and
is covered by e2e. Not done: the "route" path hint in the world (a footprint trail), and the protected
preview deploy, which waits on GitHub and Vercel being connected.

## Phase 5: Remaining content, finale, results

Goal: the full game.

- [x] (M) Owl (Word Weaver) and Lantern Keeper (Night Light) encounters via data only; fix any code that needed special-casing (that is a bug in the design).
- [x] (M) Cottage finale: wolf-as-Grandma scene (silhouette in window, paw prints, door sequence); ending chosen from flags (clean / close / wolf's house). No shake, no gore: slow fade and held beat.
      This line used to require _"Grandma, why do you need my key?"_ when `keyStolen`. **That line was
      deliberately removed and must not be reinstated from this plan.** `endings.close` matches on a
      flag count, not a flag identity, so it also drew for two single-flag runs that still had the key
      in the basket on the same screen. The close ending now opens "Grandma, where did you get that?",
      which names nothing. `apps/game/test/content-copy.test.ts` guards the general rule — an arrival
      may not name a thing the player can still see in the basket — and `docs/GAME_DESIGN.md`
      section 8 records why.
- [x] (M) Results screen: score, per-skill recap rows (success vs missed styling), "Post your score" handle field with validation and clear privacy line, **Read the Research** band with the screen's one Lime.
- [x] (S) Replay: reset store, new run id, back to title.
- [ ] (S) **Research review pass**: send all fine-print and recap copy to the research team; apply edits in `content/game.json` only.
- [ ] (M) **Real art swap-in checklist** (as assets arrive): tileset, map, Purple, NPCs, portraits, items; re-verify collision and depth sorting after each swap.
- [x] (S) e2e: perfect run = 1000 and "clean" ending; reject-all (no questions) = 600 and, since 2026-10-17, "The long way round"; allow-all (no questions) = 100 and "wolf's house".
      Acceptance (M3 part 1): all three endings reachable and tested; copy approved by research.

Phase 5 notes (2026-10-16):

- Owl and Lantern Keeper needed no code: both encounters run from `content/game.json` alone, which is
  the design holding up. Adding a fourth skill would need content only.
- Cottage finale: panel 04 with the wolf-as-Grandma portrait, the approach beats, then the ending
  chosen from flags. The key line plays when `keyStolen`. No shake, no gore: a fade and a held beat.
- Results: score, one recap row per skill (success vs missed styling), the basket, handle field with
  validation matching the server rule, the privacy line, and the Read the Research band carrying the
  screen's one Lime.
- Posting a score is stubbed behind `LeaderboardClient`, which reports the board unavailable. The real
  Vercel Function adapter is Phase 6; the game never blocks on it.
- Verified totals in the browser: perfect 1,000, reject-all 600 (now "The long way round"), allow-all 100 (wolf's house),
  and the close-call ending when only the key is taken.
- `docs/COPY_REVIEW.md` lists every player-facing string with its status for the research team.
- Not done: the real art swap-in (D2 still open), and the `/ui-lab` page with screenshot comparison.

### Brand review (2026-10-16)

A `brand-reviewer` pass on the Phase 3 UI returned a fail with twelve findings. Fixed: the one
hard-coded hex, focus rings that failed contrast on light surfaces, Stone body text under 4.5:1,
paragraph margins inherited from the brand theme, basket slots silently shrinking below spec at phone
widths, non-integer pixel-art scaling, the inverted advance caret, Allow being auto-focused on the
skill card, the modal scrim not taking pointer events, unused motion tokens, and the joystick skin.
Also fixed from the same pass: `role="option"` inside `<li>`, and `aria-live` re-announcing the
typewriter on every frame.
**Open deviation, needs sign-off:** the Explore quest pill floats in a HUD rather than sitting in an
Explore panel header. The panel frame is a device of the concept board; in the real game the world
fills the viewport and there is no header to sit in. If design wants the frame, it is a small change.

## Phase 6: Leaderboard

Goal: simple, safe, optional leaderboard.

**Phase 6 landed on 2026-10-20 (commit `3dc0357`), and it did not land in the shape this list
specified.** The boxes below are reconciled against the tree. Where a task was deliberately dropped
rather than done, it is struck through with the reason, so nobody completes it as an oversight.
`apps/api/README.md` is the service's source of truth and `docs/ARCHITECTURE.md` section 8 records
why the shape changed.

- [x] (S) `LeaderboardClient` interface + adapter. **No in-memory mock was needed** — the interface
      shipped in Phase 5 with a stub behind it, and Phase 6 replaced the stub with the real adapter
      behind the same interface. The board is **not a separate screen**: it renders inside
      `Results.tsx`, which is where the handle and the one Lime CTA already were.
      **This sentence was ASPIRATIONAL for a round and is true only from 2026-10-21.** When it was
      written, `top()` was implemented and tested and `grep -rn "\.top("` across `apps/game/src`
      found no caller at all: there were no board elements on Results and no board rule in any
      stylesheet, so a player posted a score and never saw a list, deployed or not
      (docs/PAUL_BRIEF.md section 5 records the measurement). It is recorded here rather than
      quietly corrected because the next reader has no other way to tell which claims in this file
      are load-bearing and which are intent — and two reviewers took this one as evidence the board
      existed.
- [x] (S) The board on Results, and the three-state read behind it (2026-10-21). `readTop()` answers
      `rows`, `empty` or `unavailable` and never reports an ABSENT board as an EMPTY one — the SPA
      catch-all serves `200 text/html` for an undeployed `/api/top`, which the old `LeaderboardEntry[]`
      return could only have rendered as "no runs yet". Rank tints, your own row matched locally,
      one live region, no Lime, and nothing from the wire set as markup.
- [x] (S) The payoff screen cannot state two contradictory things about its own state (2026-10-21).
      After a post, an empty board read said "No runs on the board yet. Yours would be the first."
      directly under "Posted to the board as …". It is the launch case, not a corner: `GET /api/top`
      is served with `s-maxage=60`, and the mount read primes that cache with an empty board before
      the post lands. The empty state now has copy for a visit that has posted, and
      `test/board.test.ts` plus `e2e/leaderboard.spec.ts` fail if a post can sit above a sentence
      claiming there are no runs. Same round: board reads settle by issue order rather than arrival
      order, the board heading has air above it at 375/768/1280 (it had 0.0px at all three), the
      board carries the Deep Purple body BRAND_AND_UI section 3 requires, and "Ask the board again"
      no longer looks exactly like "Walk it again".
- [x] (M) `apps/api` Vercel Functions (Node 22). **Shipped as `POST /api/score` and `GET /api/top`
      over Supabase/PostgREST.** ~~`POST /runs`, `POST /runs/:id/submit`, `GET /leaderboard`; HMAC
      token; D1 schema + migrations; week window logic (UTC)~~ — none of this was built. The token
      existed to bind a run to a start time; ranking is by score alone and there is no duration
      column, so it protected nothing. D1 was the pre-D3 Cloudflare plan. One board, no week windows.
- [x] (M) Server-side verification: legal log check and **recompute with `packages/core`** both ship,
      plus a strict body schema that makes a claimed score a 400, a 32 KB metered body gate, a
      `MAX_LOG_EVENTS` of 256, and a duplicate guard. ~~Min-duration plausibility~~ was dropped: the
      clock is the player's and ranking ignores it, so a floor would reject honest fast runs and buy
      nothing. ~~Handle blocklist~~ was dropped because **handles are minted, not typed**
      (`[a-z]+-[a-z]+-[1-9][0-9]`), re-checked on the way out of `GET /api/top`; there is no
      free-text field to moderate. Escape on render is Preact text nodes.
- [x] (S) Rate limiting: `src/limit.ts`, thirty writes a minute, **per instance**. ~~Hashed,
      salt-rotating IP keys~~ dropped — **no IP is read, hashed or stored at all**, which is
      stronger than the task asked for. ~~CORS to embed origins~~ is moot: same origin by D3.
      **The cross-instance control is Vercel firewall rate limiting on `/api/*` and it is NOT ON.**
      See "What is NOT done" below.
- [x] (S) http adapter with timeouts (6 s) and graceful degradation; never blocks results or the CTA.
- [x] (M) Tests: 53 across 5 files, including the forged-log suite — claimed score, unreachable
      score, a verdict whose card was never opened, a run that never arrived, an oversized body, a
      duplicate. `apps/game/e2e/leaderboard.spec.ts` covers the board; the API-down path is the
      `503` case, asserted in `routes.test.ts` ("when the board is not there").
      **"covers the board" was ASPIRATIONAL for a round, same as the bullet above.** Until
      2026-10-21 that file covered the POST FORM only — four specs, all of them against
      `/api/score` — because there was no board on the page to cover. It covers the board now:
      the three read states, the rank tints, the live region, a successful post above an empty
      board, two reads racing, the vertical rhythm at the three reviewed widths and a Lime sweep in
      every state rather than only the two with rows.
- [ ] (S) Moderation: admin delete endpoint, and `docs/RUNBOOK.md`. **Neither exists.** An
      unauthenticated delete endpoint would be worse than none, and the only secret the service may
      read is the Supabase key, so this needs Vercel deployment protection or a new server-only
      variable first. Removing a row is SQL in the Supabase console until then. D10 is waiting on it.
- [ ] Run `security-reviewer`; fix findings. **Not run on the shipped service.**
      Acceptance (M3): **not met yet.** The service is built and tested in-process, but nothing here
      has run against the live board — this checkout has no credentials — so "a real run posts and
      appears with the correct rank" is unproven. The game is fully playable with the board down,
      which is proven.

### Phase 6: what is NOT done, and must be before the board is believed

Recomputing every score bounds what a row can **say**. It does not bound how many rows a caller can
write. These three are from `apps/api/README.md`; that file is the authority, this is the pointer.

1. **Turn on Vercel firewall rate limiting for `/api/*` and prove it on a preview.** The only
   control that spans instances, and the one thing here that cannot be done from the repository.
2. **Make dedupe durable** (a `log_hash` column + unique index). It is a third column on a table
   whose decision reads "handle and score only", so it **reopens D10** rather than being a quiet
   migration. The code does not write it today, so the SQL is safe to run early.
3. **Set retention.** `created_at` exists and nothing prunes it, against D10's twelve months.

### Phase 6: two calls that are a human's, not an agent's

Neither blocks the work above; both are recorded here so they are not decided by default.

1. **Nine player-facing strings have not been through the Legal review D10 requires.**
   `docs/COPY_REVIEW.md` says leaderboard and privacy copy are reviewed by Legal against D10 and
   that the review has not happened. The strings are `leaderboardTitle`, `leaderboardTitleHighlight`,
   `boardLoading`, `boardReady`, `boardEmpty`, `boardEmptyAfterPost`, `boardDown`, `boardRetry`,
   `boardYouLabel`, `boardRow` and `boardRowYou` — and `boardDown` in particular makes a
   reassurance about where the player's score lives ("Your score is still on this page"), which is
   the class of claim D10 exists to check. `test/board.test.ts` already pins that none of them
   claims a weekly reset the service does not do.
2. **"Wolf Spotters" ships with its Season Mix highlight on "Spotters", and the tension is real.**
   UI_FOUNDATIONS section 8 and BRAND_AND_UI section 3 both name it outright, and BRAND_AND_UI uses
   this exact title as its worked example of a correct highlight; against that, it is the third
   Season Mix word on the Results screen, after "actually" and "agent". The brand rule is one
   highlighted word per HEADING, and the only per-SCREEN budget in the brand is Lime's, so the
   binding docs were followed. If design wants a per-screen cap on Season Mix, it is one line in
   UI_FOUNDATIONS section 3 and one prop in `Results.tsx`.

Also outstanding and cheap: **one preview deploy answers two questions at once** — whether Vercel's
bundler follows `src/content.ts`'s import of `content/game.json` out of the service root, and
whether the top-level `headers` block reaches the `/api/*` function responses as well as the static
build, now that those routes are Vercel Functions of the game service rather than a second service
(ARCHITECTURE section 10). Both fail silently and both are invisible to CI.

## Phase 7: Embed, hardening, release candidate (M4)

- [ ] (M) iframe embed page and `postMessage` contract (ARCHITECTURE section 9); responsive container for the research page's game slot; test inside a copy of the landing page.
      **Partly done already:** the **outbound** half shipped early as `apps/game/src/embed/postMessage.ts`
      and is covered by `apps/game/e2e/embed-origin.spec.ts` — five events, one build-time target
      origin, never `*`, no-op when not framed. What remains is the host side: the embed page itself,
      the responsive container, and a test inside a copy of the landing page.
      **There is no inbound channel and "origin checks" does not describe missing work.** Nothing
      receives, so there is nothing to check. An inbound `otp:pause`/`otp:resume` would be new work
      with a threat model attached — see ARCHITECTURE section 9 — not a gap to close here.
- [ ] (S) Security headers and strict CSP on the static host. **Mostly done:** `vercel.json` ships
      the policy, `apps/game/test/csp.test.ts` guards its text against the built page, and
      `apps/game/e2e/shipped-headers.spec.ts` loads the real `dist` under the real headers in a
      browser and drives every screen with `securitypolicyviolation` as the verdict and a canary so
      an empty list means something. Zero third-party requests is asserted by `smoke.spec.ts`'s
      request handler. SRI is **not applicable**: every asset is same-origin and self-hosted.
      **What is left is the one thing only a deploy answers** — whether Vercel applies the top-level
      `headers` block to the function routes as well as the static build, now that `/api/*` is
      served by the game service's own `api/` directory rather than by a second service. Both
      guards apply the headers themselves and would stay green if it did not.
- [ ] (M) Accessibility audit: keyboard-only, screen reader pass (NVDA/VoiceOver), zoom 200%, reduced motion, contrast; fix.
- [ ] (M) Performance: bundle analysis against budget, asset compression, test on a mid-range Android and an older iPhone. **"Lazy-load leaderboard" is struck**: there is not one dynamic `import()` in `apps/game/src`, the build emits a single chunk, and the board is part of `Results.tsx` rather than a separate screen to split off. Code-splitting it is an option, not a pending task, and ARCHITECTURE section 11 warns against budgeting as if it were done.
- [ ] (S) Cross-browser: latest Chrome, Safari (iOS + macOS), Firefox, Edge. Touch: iOS Safari address-bar resize, Android Chrome.
- [ ] (S) Error handling: asset load failure screen with retry; `window.onerror` surfaces a friendly message; no stack traces to players.
- [ ] (S) Privacy copy and link next to the handle field; Legal review (D10).
      Acceptance (M4): all budgets met, zero axe serious/critical issues, no CSP violations, zero third-party requests, cross-browser matrix green.

## Phase 8: Playtest and launch (M5)

- [ ] (M) Five to eight playtests with real security leaders and practitioners (and one non-technical person). Observe silently; note where they miss the fine print or get stuck. Success: at least 6 of 8 can say, unprompted, what the game was about.
- [ ] (S) Tune copy, difficulty and scoring from findings (data only).
- [ ] (S) Replace "sample" copy and graybox leftovers; check no placeholder strings remain (content lint flag).
- [ ] (S) Launch checklist: production API secrets set, rate limits on, moderation access tested, backups, uptime check, error alert route, rollback plan.
- [ ] (S) Embed in the Off the Path page replacing the "Malicious skill finder game" placeholder; confirm the **Read the Research** button flow and the Security Leader / Practitioner toggle still work.
- [ ] (S) Post-launch dashboard: plays, completion rate, average score, verdict distribution per skill (aggregate, from parent-page events), CTA click-through.
      Acceptance (M5): live, monitored, with a named owner for moderation and content updates.

## Phase 9: v2 — collect, and find out what you collected

Spec: `docs/GAME_DESIGN_V2.md`, approved in shape by the client on 2026-10-21. Decided: v2 replaces v1
on `main`; greedy is punished; the timer is hard; there are six or seven skills; she is Purple. This
reopens the work of Phases 1, 3, 4 and 5. Staffing follows PAUL_BRIEF section 4.

- [x] **A. Rules** (L) — done `87c80ff`, beside v1; Phase D switches the game over. — `packages/core`, test-first, at the 100% gate on all four metrics. The collect
      loop with take / take-limited / leave; the basket as an inventory; the three-minute timer as an
      injected clock (no `Date`); the "never made it" ending; scoring by what each collected skill
      did; a version tag on the run log, so a v1 log can never score as a v2 run.
- [ ] **B. Content** (M) — six or seven skills and characters as data: what each promises, the card,
      and what it did under each verdict. The mix is tuned through `pnpm sim` until the ceiling, the
      greedy floor and restrict-everything all come out right.
- [ ] **C. World** (M) — three or four new characters on the map, one regeneration with every
      changed cell claimed; a timer and the basket in the HUD.
- [ ] **D. Screens** (M) — the how-to-play rewritten for v2; **the reveal screen**; the late
      ending; the Cyera-branded landing page (**blocked on the background image**).
- [ ] **E. Leaderboard** (M) — **including a server-issued start token**, because v2's run-log
      times are client-reported: a log forged with every event at 0ms replays as legal today.
      The API must record when a run began and bound elapsed time on submit. Otherwise — `apps/api` recomputes with the new core in the same change. The table
      is empty today, so no posted score becomes incomparable.
- [ ] **F. Readiness** (M) — a test-mode timer override (dot access on `import.meta.env`, and the
      symbol added to `csp.test.ts`'s bundle grep so it cannot ship like the debug handle did); then
      a full functional, security and accessibility sweep of v2.

## Readiness findings (sweep of 2026-10-21)

Measured on production and the working tree by four review lenses plus a completeness critic.
Several overlap Phase 7 and are listed once here. Fix before launch; most also apply to v2.

**Blockers**

- [x] On a phone at 200% zoom, Allow / Restrict / Reject sat 283–435px below the fold and no gesture
      reached them. The panel is its own scrollport now (`51574fc`). **Proven** by real wheel and touch
      gestures on macOS (Chromium 1228 and 1243), and on CI's Linux runner -- whose headless browser
      turns synthetic touch into no scrolling at all, measured with an injected control box -- by
      the computed conditions a finger needs: a scroll container with room, and no blocking
      `touch-action` (`ac1f450`'s diagnostics, then the calibrated test).
- [x] The e2e test for that defect passes because it calls `scrollIntoViewIfNeeded()` itself.
- [x] A failed asset load is silent — a healthy-looking HUD over an empty world. It needs a retry
      screen, and `window.onerror` a friendly message.

**Majors**

- [ ] The call to action, "Read the Research", points at **`https://www.cyera.com/off-the-path`,
      which is a 404**. The real URL is needed from the web team, set as `VITE_RESEARCH_URL`.
- [x] The privacy line says "no cookies" while `localStorage['otp:music']` persists. Widen the
      sentence or drop the persistence, then guard by enumerating storage after a full run.
- [x] The question buttons eat the first press while a line types, up to nine presses a run — the
      interaction the game is named for. The fix pattern is already in `Dialogue.tsx`.
- [ ] Grandma's door note says the words "stayed on the post" — on a door — beneath "anything you
      read now, the wolf reads too".
- [ ] The title card clipped its thesis sentence at the client's own 1673×449. Probably fixed by the
      fit ladder; re-measure there.
- [ ] Pressing Post is announced to nobody, because the status region mounts with its text already
      in it.
- [ ] A screen-reader player is never told where anyone is.
- [ ] Heading structure is incoherent: three of seven screens have no heading.
- [ ] The question list tells a screen reader the first question is already selected.
- [ ] At 375, 390 and 768 every panel covers the goals and the basket under `aria-modal`.
- [ ] The embed has no host side, and `frame-ancestors` means the first real iframe test is launch day.
- [ ] M4 names an accessibility tool that is not installed anywhere.
- [ ] The 3-second time-to-interactive budget is not measured, and only one of three byte budgets is
      enforced in CI.
- [ ] ARCHITECTURE section 9 and this file describe a replaced embed-origin mechanism. README.md is stale about `apps/api` and the leaderboard client.

**New, from the fixes themselves**

- [ ] An asset request that HANGS (rather than 404ing) still leaves the title up with Begin
      enabled. Only failures are handled; loads need a timeout.
- [ ] Six new player-facing strings (the load and crash screens) have not had the human read
      PAUL_BRIEF requires. They are not leaderboard or privacy strings, so Legal is not needed.

**Minors and nits**: Post's "No reply came back" when a reply did; "Try another name" changes
silently; `#game`'s label reaches nothing; closing a panel drops focus to `body`; text clipped at 200%
on a phone; stale test counts in four documents; the one error screen is unstyled; the placeholder
lint checks one word of five; research sign-off covers about a quarter of the strings; the privacy
copy has no link; Phaser announces its version in the console; five stale build directories in the
checkout; "CAUGHT IT" wraps at 390px; a tile boundary where a direction key does nothing.

**Fixed since the sweep**: the coverage gate measuring a copy of the routes that never shipped (one
copy now, `8656fcb`); PAUL_BRIEF's claim that the dark band was still open; the docs saying
`vercel.json` declares services.

## Risks and mitigations

| Risk                                                                           | Impact           | Mitigation                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production pixel art arrives late or off-style                                 | Schedule         | Graybox with identical names; D2 resolved in Phase 0; art swap checklist.                                                                                                                  |
| Fine print is too easy or impossible to miss                                   | The lesson fails | M2 playtest on the slice; copy only edits; keep the safe skill so inspection is rewarded.                                                                                                  |
| Leaderboard abuse (cheating, offensive handles)                                | Brand risk       | Server recompute, blocklist, rate limits, delete endpoint, optional kill switch to hide the board.                                                                                         |
| Privacy or legal concern about a public leaderboard from a data-security brand | Brand risk       | Handle + score only, no cookies/IP storage, Legal review (D10), board can be disabled without a redeploy.                                                                                  |
| Bundle too heavy on mobile                                                     | Drop-off         | Phase 0 spike; budget checks in CI (the gzip step in `.github/workflows/ci.yml`, added 2026-10-20). NOT lazy loading: there is no dynamic import in the app and the build emits one chunk. |
| Fonts missing at launch                                                        | Off-brand        | Fallbacks look clean; D6 requested in Phase 0.                                                                                                                                             |
| Content drift between research and game                                        | Credibility      | Research sign-off on every string; data-only content; content version in every run.                                                                                                        |
