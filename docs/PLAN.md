# Build plan: Off the Path, "That's Not My Grandma"

How to use this file: work **one phase per Claude Code session**. Start the session in plan mode, restate the phase goal and tasks, get approval,
implement, tick the boxes, run the `phase-done` skill, commit, then `/clear` before the next phase.
Effort sizes: **S** under half a day, **M** about a day, **L** several days (for one engineer pairing with Claude Code; art and review lead times are separate).

## Milestones

| Milestone                                                                                                                                               | When           | What you can show                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **M0 Foundations**                                                                                                                                      | End of Phase 0 | Repo, CI, brand tokens, graybox art, decisions made.                                                                  |
| **M1 Walking Red**                                                                                                                                      | End of Phase 2 | Move Red around the graybox forest on keyboard and touch.                                                             |
| **M2 Vertical slice**                                                                                                                                   | End of Phase 4 | One full encounter (Rabbit + Cottage Finder) from talk to verdict to basket, in brand UI. **Show stakeholders here.** |
| **M3 Feature complete**                                                                                                                                 | End of Phase 6 | Three skills, cottage finale, results, leaderboard (mock or live).                                                    |
| **M4 Release candidate**                                                                                                                                | End of Phase 7 | Embedded, accessible, fast, hardened.                                                                                 |
| **M5 Launch**                                                                                                                                           | End of Phase 8 | Live on the Off the Path page, monitored.                                                                             |
| Rough total: 6 to 8 weeks of calendar time with one engineer, one artist part-time, and reviewers on call. Real art is the main schedule risk (see D2). |

## Open decisions (resolve in Phase 0; recommended defaults in bold)

| ID  | Question                                                                                                                                    | Recommended default                                                                                                                                                                                         | Owner                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1  | Is Night Light genuinely safe, or malicious too?                                                                                            | **Safe**, so "reject all" is not optimal. Update the Results mock copy accordingly (the mock shows it malicious).                                                                                           | Game design + research |
| D2  | Who produces production pixel art and when? Concept board is flattened.                                                                     | **Design team or a pixel artist produces tileset, sprites, portraits** against `docs/ASSETS.md`; graybox until then.                                                                                        | Design lead            |
| D3  | Leaderboard backend host                                                                                                                    | **Vercel Functions (Node) + managed Postgres/KV** behind a swappable interface (originally Cloudflare Workers + D1; changed because the game deploys on Vercel).                                            | Eng + Security         |
| D4  | Handle only, or optional email field for research follow-up?                                                                                | **Handle only** (no gate before the research).                                                                                                                                                              | Marketing + Legal      |
| D5  | Mobile portrait layout                                                                                                                      | **Canvas on top, panels docked at the bottom; never require rotation.**                                                                                                                                     | Design                 |
| D6  | Real Haffer / Season Mix files available?                                                                                                   | **Yes: request woff2 from Brand Kit**; fallbacks meanwhile.                                                                                                                                                 | Brand                  |
| D7  | Scoring: partial credit 150 / bonus +100. Note: with seed values, rejecting everything scores 600, which may be too close to a careful run. | **Resolved 2026-10-17** by the three errand goals: reject-all is 700 against a 1,000 ceiling and draws its own ending, and the best full-errand line (750) now beats it. Restrict-all at 950 is still open. | Game design            |
| D8  | Must the player meet all three characters before the cottage?                                                                               | **Yes** (consistent scores).                                                                                                                                                                                | Game design            |
| D9  | Where is the game hosted and who owns analytics?                                                                                            | **Static host under a cyera.com subdomain, embedded by iframe; parent page owns analytics via postMessage events.**                                                                                         | Web team               |
| D10 | Leaderboard retention, moderation, privacy review                                                                                           | **Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.**                                                                                                          | Legal + Security       |

### Decisions recorded (2026-10-15, Phase 0)

All ten decisions take the recommended default above. Owners should confirm; two need action outside engineering.

| ID  | Decision                                                                                                                                                                                                                           | Status                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Amended 2026-10-16:** Night Light has no fine print, so it stays honest on inspection, but it is no longer safe by default. Best verdict is Restrict, which grants nothing; Allow leaves it reading what strangers wrote.        | Amended by `docs/MAKING_IT_BETTER.md` section 3; recap copy updated. **Research has not confirmed the direction** — `docs/RESEARCH_ALIGNMENT.md` open question 4 is still open, and its owners are game design + research. |
| D2  | Design team or a pixel artist produces tileset, sprites, portraits. Graybox until then.                                                                                                                                            | Brief drafted in `docs/PHASE0_REQUESTS.md`, not yet sent                                                                                                                                                                   |
| D3  | **Changed 2026-10-16:** Vercel Functions (Node 22 runtime) in the same Vercel project as the game, with a Vercel-marketplace Postgres or KV store, behind `LeaderboardClient`. Same origin means no CORS and `connect-src 'self'`. | Recorded; Security to confirm                                                                                                                                                                                              |
| D4  | Handle only, no email field.                                                                                                                                                                                                       | Recorded; Legal to confirm                                                                                                                                                                                                 |
| D5  | Canvas on top, panels docked at the bottom on portrait; never require rotation.                                                                                                                                                    | Recorded                                                                                                                                                                                                                   |
| D6  | Request Haffer and Season Mix woff2 from Brand Kit.                                                                                                                                                                                | Request drafted, not yet sent                                                                                                                                                                                              |
| D7  | Start with GAME_DESIGN section 7 scoring; tune in Phase 8.                                                                                                                                                                         | Recorded                                                                                                                                                                                                                   |
| D8  | Player must meet all three characters before the cottage.                                                                                                                                                                          | Recorded                                                                                                                                                                                                                   |
| D9  | Static host on a cyera.com subdomain, iframe embed, parent page owns analytics.                                                                                                                                                    | Recorded; Web team to confirm                                                                                                                                                                                              |
| D10 | Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.                                                                                                                                     | Recorded; Legal sign-off pending                                                                                                                                                                                           |

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
- Totals with `content/game.json`. **Superseded 2026-10-17** by the three errand goals: walking straight to the cottage, perfect 900 (1,000 with questions), restrict-all 850 (950), reject-all 600 (700), allow-all 100 (200). Going to the post and Grandma's door is worth up to 200 more, so two lines reach 1,000 — `restrict/reject/restrict` and `restrict/reject/allow`. Full table in `docs/DESIGN_V2.md`.
- Actions added beyond the plan list: `BEGIN` (intro to explore), `BACK` (Esc closes one panel level), `LEADERBOARD` (results to leaderboard). Rejected actions return the same state plus a typed reason (`tryReduce`).
- `content/game.json` gained `startBasket` (`key`, `letter`) and `scoring.bonusQuestions`. `content/game.seed.json` is left as the original kit seed.
- Core imports use explicit `.ts` extensions so Node can run the sim without a TypeScript runner.

## Phase 2: The forest world (M1)

Goal: walk Red around the graybox forest on any device.

- [x] (M) Boot: load content + assets (fail loudly on missing), Phaser config (`pixelArt`, `roundPixels`, 480x270, FIT scaling, integer zoom, letterbox).
- [x] (M) Tilemap loader for `map-forest.json` with layers (ground, decor-below, decor-above, collision); objects layer parsing (`spawn-red`, `npc-*`, `trigger-cottage`).
- [x] (M) Player: 4-direction movement, speed tuned (about 60 px/s logical), tile collision, camera follow with world bounds, depth sorting so Red walks behind canopy tiles.
- [x] (M) Input layer: keyboard (arrows/WASD, Space/Enter/E), **DOM virtual joystick + A button** (pointer events, multi-touch safe), unified `InputState`. Pause input when `phase !== 'explore'`.
- [x] (S) NPC placement from objects; interaction radius; floating "A" prompt (bobbing, respects reduced motion).
- [x] (S) Event bus + store wiring (ARCHITECTURE section 6). `interact(characterId)` flips `phase` to `dialogue` (UI not built yet; log to console).
- [x] (S) Cottage trigger: emits `enteredCottage`; gate logic uses `canEnterCottage`.
- [x] (S) Perf pass: no per-frame allocations; check 60 fps on a throttled mobile profile.
      Acceptance (M1): Red walks the whole map on keyboard and touch without clipping through collision; camera is smooth; NPC prompts appear in range; resizing and rotating keep pixels crisp.

Phase 2 notes (2026-10-16):

- Movement and collision are hand-rolled in `apps/game/src/world/logic.ts` (pure, 26 unit tests) rather than Phaser Arcade Physics: deterministic, testable, and no per-frame allocations. Phaser draws the tilemap and sprites, and nothing else.
- Scaling: Phaser runs at a fixed 480x270 with `Scale.NONE`; `ui/stage.ts` sets the canvas CSS size to a whole number of device pixels per game pixel (`integerZoom`), verified at DPR 1, 2 and 3. Phaser's FIT mode produced fractional scales and blurred the art.
- Camera uses `cameraTopLeft` with rounded, clamped scroll, so tiles never shimmer.
- Depth: Red sorts by her feet; the `decor-above` canopy layer is pinned above everything, so she walks behind tree tops.
- Until Phase 3 there is no title screen: the run auto-starts, and dialogue and the cottage hint appear as a plain DOM toast.
- Measured: 60 fps while moving at 4x CPU throttle and DPR 2, with a flat JS heap. Bundle is now 368 KB gzipped against the 450 KB budget; Preact and the UI still have to fit, so Phase 3 should watch it.
- Not verified: a real phone. Touch is covered by Playwright emulation only; check a Vercel preview on a device before closing M1.

## Phase 3: Brand UI overlay

Goal: every panel from the mocks exists as accessible DOM, driven by the store.

- [x] (M) Base: `Panel` (frame + 40px header + number/title/dots), `DialogueBox`, `Button` (primary Lime, Haze, Deep Purple variants), `Pill`, focus ring styles. Build Storybook-style `/ui-lab` dev page (not shipped) showing every component in every state beside its mock PNG.
- [ ] (M) `Title` / `Intro` screens (Grandma's note, quest line, Play button; Cyera logo as-is).
- [x] (M) `Dialogue`: portrait, typed-in text (skippable; instant under reduced motion), three question options with keyboard navigation and `aria-live`.
- [x] (M) `SkillCard`: icon well, promise row, fine-print row (only if present), Allow/Restrict/Reject (equal width, Lime on Allow), focus trap, Esc back-out; `Basket` with five slots.
- [x] (S) `HUD`: quest pill, joystick and A (from Phase 2) skinned per spec.
- [x] (S) Responsive rules at 375 / 768 / 1280, portrait docking (D5).
- [ ] (M) Visual tests: Playwright screenshots of `/ui-lab` components vs the mock crops, with tolerance; axe scan; contrast test on every token pair used.
- [ ] Run `brand-reviewer`; fix findings.
      Acceptance: each component visually matches its mock; keyboard-only operation works; axe has no serious or critical violations.

Phase 3 notes (2026-10-16), partial:

- Done: `Panel` (frame, 40px header, number/title/dots), `Dialogue` (portrait, typewriter text skippable and instant under reduced motion, three options with arrow-key navigation and `aria-live`), `SkillCard` (icon well, promise row, fine-print row, Allow/Restrict/Reject, focus trap), `Basket` (five slots), the HUD quest pill, and responsive rules at 375 / 768 / 1280 with portrait docking.
- Not done yet: Title and Intro screens, the `/ui-lab` page, Playwright screenshot comparison against the mock PNGs. Results and Leaderboard belong to Phases 5 and 6.
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
- [x] (M) Cottage finale: wolf-as-Grandma scene (silhouette in window, paw prints, door sequence); ending chosen from flags (clean / close / wolf's house); the line "Grandma, why do you need my key?" when `keyStolen`. No shake, no gore: slow fade and held beat.
- [x] (M) Results screen: score, per-skill recap rows (success vs missed styling), "Post your score" handle field with validation and clear privacy line, **Read the Research** band with the screen's one Lime.
- [x] (S) Replay: reset store, new run id, back to title.
- [ ] (S) **Research review pass**: send all fine-print and recap copy to the research team; apply edits in `content/game.json` only.
- [ ] (M) **Real art swap-in checklist** (as assets arrive): tileset, map, Red, NPCs, portraits, items; re-verify collision and depth sorting after each swap.
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

- [ ] (S) `LeaderboardClient` interface + **mock adapter** (in-memory) so UI ships first. Leaderboard screen per spec: top five, gap row, your row, "Wolf _Spotters_", white-logo footer.
- [ ] (M) `apps/api` Vercel Functions (Node runtime): `POST /runs`, `POST /runs/:id/submit`, `GET /leaderboard`; HMAC token; D1 schema + migrations; week window logic (UTC).
- [ ] (M) Server-side verification: legal log check, recompute score with `packages/core`, min-duration plausibility, duplicate-submit guard, handle validation + blocklist, escape on render.
- [ ] (S) Rate limiting with hashed, salt-rotating IP keys; no raw IP storage; CORS to embed origins only.
- [ ] (S) http adapter in the game with timeouts and graceful degradation ("Leaderboard unavailable right now"), never blocks results or the CTA.
- [ ] (M) Tests: forged-log suite (inflated score, illegal order, wrong content version, replayed token) must all be rejected; e2e with the API down.
- [ ] (S) Moderation: admin delete endpoint behind a secret or Vercel auth protection; runbook in `docs/RUNBOOK.md`.
- [ ] Run `security-reviewer`; fix findings.
      Acceptance (M3): a real run posts, appears with correct rank, and a tampered submission is rejected; game still fully playable offline from the leaderboard.

## Phase 7: Embed, hardening, release candidate (M4)

- [ ] (M) iframe embed page and `postMessage` contract (ARCHITECTURE section 9) with origin checks; responsive container for the research page's game slot; test inside a copy of the landing page.
- [ ] (S) Security headers and strict CSP on the static host; verify no violations in the console; SRI where applicable; confirm zero third-party requests (Playwright network assertion).
- [ ] (M) Accessibility audit: keyboard-only, screen reader pass (NVDA/VoiceOver), zoom 200%, reduced motion, contrast; fix.
- [ ] (M) Performance: bundle analysis against budget, asset compression, lazy-load leaderboard, test on a mid-range Android and an older iPhone.
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

## Risks and mitigations

| Risk                                                                           | Impact           | Mitigation                                                                                                |
| ------------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Production pixel art arrives late or off-style                                 | Schedule         | Graybox with identical names; D2 resolved in Phase 0; art swap checklist.                                 |
| Fine print is too easy or impossible to miss                                   | The lesson fails | M2 playtest on the slice; copy only edits; keep the safe skill so inspection is rewarded.                 |
| Leaderboard abuse (cheating, offensive handles)                                | Brand risk       | Server recompute, blocklist, rate limits, delete endpoint, optional kill switch to hide the board.        |
| Privacy or legal concern about a public leaderboard from a data-security brand | Brand risk       | Handle + score only, no cookies/IP storage, Legal review (D10), board can be disabled without a redeploy. |
| Bundle too heavy on mobile                                                     | Drop-off         | Phase 0 spike, budget checks in CI, lazy loading.                                                         |
| Fonts missing at launch                                                        | Off-brand        | Fallbacks look clean; D6 requested in Phase 0.                                                            |
| Content drift between research and game                                        | Credibility      | Research sign-off on every string; data-only content; content version in every run.                       |
