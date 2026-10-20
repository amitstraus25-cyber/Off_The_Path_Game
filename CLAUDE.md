# Off the Path: "That's Not My Grandma"

A short, browser-based pixel adventure that lives on Cyera's **Off the Path** research page.
Players guide Little Red through a forest, question each character's offer, inspect what a
"skill" really does, choose **Allow / Restrict / Reject**, and reach Grandma's cottage.
The point: _a skill can do what it promises and still follow an attacker's instructions._
Players should leave asking: **who wrote these instructions, and what will my agent actually do?**

This is a Cyera marketing/research asset. It must be on-brand, fast, accessible, and
(because we are a data security company) a model of good security and privacy hygiene.

## Read these first (in this order)

- @docs/PAUL_BRIEF.md: the standing state of the world and the traps that have cost whole rounds.
  **Read it before anything else**, including when you think you already know the answer.
- @docs/PLAN.md: phased build plan with checkboxes. **Work one phase at a time.**
- @docs/ARCHITECTURE.md: stack, folder layout, state machine, data schemas, API contract.
- @docs/UI_FOUNDATIONS.md: binding, transcribed from the "Off the Path — Game UI" design deck.
  **It supersedes BRAND_AND_UI.md wherever the two disagree.** Read it before BRAND_AND_UI, not after.
- @docs/BRAND_AND_UI.md: Cyera brand tokens and component specs. Binding except where UI_FOUNDATIONS overrides.
- docs/PIXEL_STANDARD.md: binding for every painter in `tools/graybox/src` — sizes, colour, light, edges.
- docs/GAME_DESIGN.md: story, characters, skills, scoring, endings (read when touching content/logic).
- docs/ASSETS.md: the production-art gap and the placeholder strategy. Sizes live in PIXEL_STANDARD
  section 1; the shipped file list is `apps/game/src/assets/manifest.json`.
- docs/KICKOFF_PROMPTS.md: the prompts the human will use; useful for understanding intent.
- `reference/`: concept PDF, the approved gameplay board, and the branded UI mocks (HTML + PNG).
  The mocks in `reference/mocks/` are **reference, not the source of truth**: the design deck
  transcribed into UI_FOUNDATIONS supersedes them, and BRAND_AND_UI records specifically that they
  set Season Mix in italic throughout and are superseded on it. Where a mock and UI_FOUNDATIONS
  disagree, UI_FOUNDATIONS wins. `reference/mocks/gameplay-concepts.png` remains the approved
  direction for **world art**, which is ART_DIRECTION's subject, not the DOM UI's.

## Commands

```
pnpm install            # exact versions only, see Security rules
pnpm dev                # game dev server (apps/game, Vite) on :5173
pnpm test               # unit tests in every workspace that has them -- packages/core, apps/game,
                        #   apps/api and tools/graybox. packages/core is gated at 100% on ALL FOUR metrics
                        #   (statements, branches, functions, lines); tools/graybox deliberately has
                        #   no coverage threshold and gates on art measurements instead. Must stay green
pnpm typecheck          # tsc in every workspace
pnpm lint               # eslint + prettier --check
pnpm format             # prettier --write
pnpm build              # production build of apps/game
pnpm e2e                # Playwright (builds + previews on :4173). Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm sim                # plays strategies through the real reducer; add --strategy perfect|errand|reject-all|allow-all|restrict-all|random --questions --seed N
pnpm preview            # contact sheets of the generated art at an integer zoom (PIXEL_STANDARD section 7)
pnpm world              # renders the map through the REAL camera: --frame title|arrive|portrait.
                        #   The only way to see what a visitor sees. Two rounds were lost to composing
                        #   against a camera size somebody remembered instead of one this printed
pnpm score              # measures a render against the concept board on five axes
pnpm graybox            # regenerate placeholder art into apps/game/src/assets
pnpm audit              # high-severity dependency audit (also runs in CI)
```

Workspaces, five: `packages/core` (pure TS rules), `apps/game` (Vite + Phaser + Preact),
`apps/api` (the leaderboard functions), `tools/graybox` (placeholder art generator),
`tools/sim` (strategy simulator).
**Phase 6 landed, so `apps/api` exists** — it holds the leaderboard logic, the schema and 53 tests —
**but `vercel.json` declares ONE service, `game`.** A second service produced no functions and
`GET /api/top` answered with Vercel's own 404 for days, so the two routes now live inside the game
service as ordinary `apps/game/api/score.ts` and `top.ts`, thin re-exports of the handlers in
`apps/api`. The logic has one home; only the hosting moved. `apps/api/README.md` is the source of
truth for the service and lists what still has to be done by hand before the board is believed.
**Do not reintroduce a second service without a deploy that proves it serves functions** — and never
a `"framework": null`, which fails schema validation and with it every deployment, silently, for as
long as nobody looks past CI. This paragraph has been wrong in both directions now; measure the
deployment before you trust it.
The Phase 0 renderer spike has been removed now that its result is recorded in
`docs/ARCHITECTURE.md` section 2a.
Pinned: TypeScript 6.0.3, Vite 7.3.7, Vitest 4.1.11, Phaser 3.90.0, Preact 10.29.8, zod 4.6.5, Playwright 1.63.0.
Vite moved 7.3.6 → 7.3.7 on 2026-10-21 for GHSA-587h-7wmj-h5pm (`launch-editor`, a Windows path-check
bypass reached through the dev server's error overlay). Dev-only and never in the shipped bundle, but
`pnpm audit --audit-level=high` gates CI and that gate is the point. 7.3.7 was published 2026-10-06,
fifteen days before — clear of the fourteen-day rule below, which is why it was taken and not waived.

## Golden rules

1. **Plan first, then code.** At the start of each phase, restate the goal, list the tasks you will do,
   and wait for approval. Tick boxes in `docs/PLAN.md` as tasks finish. Keep commits small and named by task.
2. **`packages/core` is pure TypeScript.** No Phaser, no DOM, no `window`, no network, no randomness without
   an injected seed. All game rules (state machine, scoring, outcomes) live there and are unit tested first (TDD).
3. **Content is data.** Characters, skills, questions, dialogue, outcomes, scoring weights live in
   `content/game.json`, validated by `contentSchema` and the content lint in `packages/core/src/content.ts`
   — **at startup and in the test suite, not at build time**; there is no build-time validation step.
   Adding a skill must not require code changes.
4. **World in Phaser, UI in the DOM.** Phaser renders the forest only. Every panel (dialogue, skill card, basket,
   results, leaderboard, HUD) is accessible DOM over the canvas, styled with Cyera tokens. No UI text drawn on canvas.
5. **Never invent brand assets.** Use only the logos, colors and fonts in `reference/brand/`. No made-up icons,
   illustrations, or logo variants. If something is missing, leave a labelled placeholder and flag it.
6. **Never trust the client for leaderboard scores.** The server recomputes the score from the run log using
   the same `packages/core` scoring function.
7. **Ask before adding a dependency** and say why. Fewer dependencies is a feature.

## Brand rules (short version, full spec in docs/BRAND_AND_UI.md)

- Colors come from CSS variables in `reference/brand/cyera-theme.css`. Never hard-code hex in components.
- **Lime `#BFFFA2` appears once per screen** (the primary call to action). Aubergine, Stone, Ash are text/foreground only.
- No red or green status colors. Use purple tints plus shape/icon (check mark, "!") and text.
- Haffer for UI text (fallback Inter). **Season Mix is upright only, never italic** — the brand book says
  so outright, and BRAND_AND_UI section 2, UI_FOUNDATIONS section 3 and `tokens.css` all repeat it. The
  mocks set it in italic throughout and are superseded. One highlighted word in a heading at most. Never body text.
- Logos used as-is: black on light, white on dark. Do not recolor, stretch or redraw.
- Pixel art stays pixel-crisp: `image-rendering: pixelated`, integer scaling in the canvas.

## Security and privacy rules

- Zero third-party scripts, fonts, analytics or CDNs at runtime. Everything is self-hosted and bundled.
- Pin exact dependency versions. Before adding or upgrading a package, check its publish date and
  **skip versions published in the last 14 days**. Commit the lockfile. Run `pnpm audit` in CI.
- Strict CSP (see ARCHITECTURE). No `eval`, no inline scripts, no `innerHTML` with data. Escape handles on render.
- The leaderboard stores a handle and a score only. No accounts, no email, no cookies, no raw IPs.
- Treat anything from the network (API responses, `postMessage`) as untrusted; validate with the shared schema.

## Definition of done (every task)

Typecheck, lint, unit tests green; new rules have tests; UI matches UI_FOUNDATIONS (and the mocks where it
has not superseded them) at 375px, 768px and 1280px widths;
keyboard-only playthrough still works; no new console errors; PLAN.md updated; a short note on anything you
deferred or assumed.

## Working style

- Prefer small, boring, readable code. Name things after the story (`Encounter`, `Verdict`, `Basket`).
- When a design question is unresolved, check the **Open decisions** table in PLAN.md. Don't silently decide; propose a default and ask.
- Use the `brand-reviewer` and `security-reviewer` subagents before closing UI or API phases.
