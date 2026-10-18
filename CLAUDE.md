# Off the Path: "That's Not My Grandma"

A short, browser-based pixel adventure that lives on Cyera's **Off the Path** research page.
Players guide Little Red through a forest, question each character's offer, inspect what a
"skill" really does, choose **Allow / Restrict / Reject**, and reach Grandma's cottage.
The point: _a skill can do what it promises and still follow an attacker's instructions._
Players should leave asking: **who wrote these instructions, and what will my agent actually do?**

This is a Cyera marketing/research asset. It must be on-brand, fast, accessible, and
(because we are a data security company) a model of good security and privacy hygiene.

## Read these first (in this order)

- @docs/PLAN.md: phased build plan with checkboxes. **Work one phase at a time.**
- @docs/ARCHITECTURE.md: stack, folder layout, state machine, data schemas, API contract.
- @docs/BRAND_AND_UI.md: Cyera brand tokens and exact UI specs. Binding.
- docs/GAME_DESIGN.md: story, characters, skills, scoring, endings (read when touching content/logic).
- docs/ASSETS.md: art/audio manifest and the placeholder strategy.
- docs/KICKOFF_PROMPTS.md: the prompts the human will use; useful for understanding intent.
- `reference/`: concept PDF, the approved gameplay board, and the branded UI mocks (HTML + PNG).
  The mocks in `reference/mocks/` are the visual source of truth for the DOM UI.

## Commands

```
pnpm install            # exact versions only, see Security rules
pnpm dev                # game dev server (apps/game, Vite)
pnpm test               # unit tests + coverage (packages/core, 100% branch gate) -- must stay green
pnpm sim                # plays strategies through the real reducer; add --strategy perfect|reject-all|allow-all|restrict-all|random --questions --seed N
pnpm typecheck          # tsc in every workspace
pnpm lint               # eslint + prettier --check
pnpm format             # prettier --write
pnpm e2e                # Playwright smoke (builds + previews on :4173). Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm build              # production build of apps/game
pnpm graybox            # regenerate placeholder art into apps/game/src/assets
pnpm audit              # high-severity dependency audit (also runs in CI)
```

Workspaces: `packages/core` (pure TS rules), `apps/game` (Vite + Phaser + Preact, the only deployed
service), `tools/graybox` (placeholder art generator), `tools/sim` (strategy simulator).
The leaderboard API arrives in Phase 6 as `apps/api`; it does not exist yet, so `vercel.json`
declares a single service. The Phase 0 renderer spike has been removed now that its result is
recorded in `docs/ARCHITECTURE.md` section 2a.
Pinned: TypeScript 6.0.3, Vite 7.3.6, Vitest 4.1.11, Phaser 3.90.0, Preact 10.29.8, zod 4.6.5, Playwright 1.63.0.

## Golden rules

1. **Plan first, then code.** At the start of each phase, restate the goal, list the tasks you will do,
   and wait for approval. Tick boxes in `docs/PLAN.md` as tasks finish. Keep commits small and named by task.
2. **`packages/core` is pure TypeScript.** No Phaser, no DOM, no `window`, no network, no randomness without
   an injected seed. All game rules (state machine, scoring, outcomes) live there and are unit tested first (TDD).
3. **Content is data.** Characters, skills, questions, dialogue, outcomes, scoring weights live in
   `content/game.json` (validated by a schema at build time and startup). Adding a skill must not require code changes.
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
- Haffer for UI text (fallback Inter). Season Mix italic only for a single highlighted word in a heading. Never body text.
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

Typecheck, lint, unit tests green; new rules have tests; UI matches the mocks at 375px, 768px and 1280px widths;
keyboard-only playthrough still works; no new console errors; PLAN.md updated; a short note on anything you
deferred or assumed.

## Working style

- Prefer small, boring, readable code. Name things after the story (`Encounter`, `Verdict`, `Basket`).
- When a design question is unresolved, check the **Open decisions** table in PLAN.md. Don't silently decide; propose a default and ask.
- Use the `brand-reviewer` and `security-reviewer` subagents before closing UI or API phases.
