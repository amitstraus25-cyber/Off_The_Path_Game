# Off the Path: "That's Not My Grandma"

A short, browser-based pixel adventure that lives on Cyera's **Off the Path** research page.
Players guide Little Purple through a forest, question each character's offer, inspect what a
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
- docs/GAME_DESIGN_V2.md: the game as built (seven characters, a dealt 3 good and 4 bad, take or leave, a
  3:00 timer, the reveal). Read it when touching content/logic. `docs/GAME_DESIGN.md` is v1's design,
  **superseded** and kept as history; v1 was removed from the repo on 2026-10-22.
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
                        #   apps/api and tools/graybox. packages/core AND apps/api are gated at 100% on ALL FOUR metrics
                        #   (statements, branches, functions, lines); tools/graybox deliberately has
                        #   no coverage threshold and gates on art measurements instead. Must stay green
pnpm typecheck          # tsc in every workspace
pnpm lint               # eslint + prettier --check
pnpm format             # prettier --write
pnpm build              # production build of apps/game
pnpm e2e                # Playwright (builds + previews on :4173). Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm sim                # plays the v2 strategies through the real reducer over every deal, then the trap
                        #   checks; add --strategy careful|greedy|leave-all|random --seed N for one deal
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
`tools/sim` (the v2 strategy simulator, a thin CLI over `packages/core`'s `v2.play` and `v2.table`).
**Phase 6 landed, so `apps/api` exists** — it holds the leaderboard logic, the schema and its tests —
**and the deploy is Vercel's Build Output API, written by us.** `vercel.json` carries
`installCommand`, `buildCommand` and the security headers, nothing else. The build ends with
`apps/game/scripts/vercel-output.mjs`, which writes `.vercel/output`: the static game, the two
routes bundled into self-contained CommonJS, and the headers copied from `vercel.json`. **Vercel
compiles none of our TypeScript.** The routes are `apps/api/api/start.ts`, `score.ts` and `top.ts` —
the single copy; there used to be three. `test/docs-truth.test.ts` fails if the build stops running
that script, because nothing else would notice.

**Why, and do not re-run any of the four things that failed.** Two services served no functions.
Routes inside the game service served none either — in services mode a `framework: "vite"`
service gets a static build and its `api/` is never scanned. Routes in a repo-root `api/` produced
functions at last, and every invocation crashed (`FUNCTION_INVOCATION_FAILED`): Vercel compiled
them with **its own** TypeScript settings, printed TS5097 for every `.ts` import specifier, and
left those specifiers pointing at files that were not in the lambda. This codebase writes `.ts`
specifiers deliberately so Node can run the source; a per-file compiler cannot follow them, nor
workspace packages whose `main` is TypeScript. `includeFiles` did not help, because file tracing
was never the problem. Bundling ourselves is the fix.

**The discriminator, which cost days to find and is worth one line here.** `GET /api/score` on a
mounted function answers **405 with `Allow: POST`**, because `handleScore` branches on the method
itself. A **404** there means no function exists and the request never reached our code. A **500**
with `FUNCTION_INVOCATION_FAILED` means the function exists and crashed on load — read the build
log, not the runtime log. `GET /api/start` answers the same way. Check those two, not `/api/top`, which cannot tell these apart. The
routes `export default { fetch }`; the adapter in `vercel-output.mjs` turns Vercel's Node
`(req, res)` into a web `Request` and keeps that 405 branch ours.

**Never a `"framework": null`** — it fails schema validation and with it every deployment, silently,
for as long as nobody looks past CI. `X-OTP-Config` on a response says which config is actually
live, so a stale deploy can be told from a landed one. `apps/api/README.md` is the source of truth
for the service and lists what must still be done by hand before the board is believed.

This paragraph has now been wrong in three directions. Measure the deployment before you trust it.
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
   `content/game.v2.json`, validated by `contentSchema` and the content lint in `packages/core/src/v2/content.ts`
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
- The leaderboard shows a handle and a score only. No accounts, no cookies, no raw IPs. **Since the
  client's decision of 2026-10-22, posting a score may require a WORK email and a consent tick**
  (purpose: Cyera may contact the player about this research), behind the server flag
  `OTP_WORK_EMAIL` (on only when exactly `required`; off by default, and off means today's board
  exactly). The address is validated by core `v2.checkContact` (the server is the authority;
  personal providers are one list, `FREE_EMAIL_PROVIDERS`), stored only in
  `public.leaderboard_contact` (migration 0007: service role cannot read it, written with the score
  in one transaction, 12-month retention), and **never returned by any route, never logged, never
  in an error message, never on the board**. The consent wording is versioned in content
  (`ui.contact.consentVersion`); changing the words means a new version. The flag goes on only
  after the migration has run and Legal has signed off (apps/api/README.md, "Work email").
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
