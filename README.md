# Off the Path: "That's Not My Grandma"

A short browser pixel adventure for Cyera's **Off the Path** research page. Red walks a forest, three
travellers offer her "skills", and the player decides what each is allowed to do: **Allow / Restrict /
Reject**. A notice nailed to a post carries an instruction nobody wrote on any card, and it fires only
if all three capabilities are live at once.

The lesson is Cyera's own research, [When Language Becomes the Attack
Vector](https://www.cyera.com/research/when-language-becomes-the-attack-vector-the-lethal-trifecta-of-ai-agents):
an agent holding all three legs of the **lethal trifecta** — reads your private data, reads untrusted
content, can send word out — can be turned against you by an instruction hidden in ordinary prose.
Careful reading is not the answer; a boundary is. The scoring says so: the fastest route through the
forest is the worst outcome, and you cannot collect every errand goal and keep the boundary.

> This was a Claude Code starter kit. It is a working project now. If you are looking for the
> "copy this folder and `git init`" instructions that used to be here, they are gone — the repository
> exists.

## Quick start

Node 22 (see `.nvmrc`), pnpm 11.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Commands

```
pnpm dev         dev server on :5173
pnpm build       production build of apps/game
pnpm test        unit tests in core, game and graybox; core gated at 100% on all four metrics
pnpm typecheck   tsc across every workspace
pnpm lint        eslint + prettier --check
pnpm e2e         Playwright. Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm sim         plays strategies through the real reducer and prints score + ending
pnpm graybox     regenerate the placeholder art
pnpm preview     contact sheets of that art at an integer zoom
pnpm world       renders the map through the REAL camera (--frame title|arrive|portrait)
pnpm score       measures a render against the concept board
pnpm audit       high-severity dependency audit
```

`CLAUDE.md` carries the same list with what each one is for, and the rules anyone working here follows.

## Layout

```
packages/core    pure TypeScript rules: state machine, scoring, run log, content schema, camera.
                 No DOM, no Phaser, no clock, no randomness. 100% coverage, enforced.
apps/game        Vite + Phaser 3 (world only) + Preact (all UI). The one deployed service.
content/         the entire game as data. Adding a skill must not require code changes.
tools/graybox    procedural placeholder art and the map generator.
tools/sim        plays strategies through the real reducer.
docs/            design, architecture, brand, and review findings.
reference/       brand theme + logos (needed to build), plus design source material.
.claude/         the brand-reviewer and security-reviewer subagents, and three skills.
```

## Where the truth lives

Numbers in prose go stale; these do not. Read the source, not a copy of it.

| Question                                    | Where                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| How big is the camera? What is in frame?    | `cameraFor()` in `packages/core/src/camera.ts`, or `pnpm world --frame title` |
| What is the content shape, and its rules?   | `contentSchema` and `loadContent` in `packages/core/src/content.ts`           |
| What does a run score?                      | `pnpm sim` — and note which run shape a total belongs to                      |
| What art ships, at what size?               | `apps/game/src/assets/manifest.json` and `docs/PIXEL_STANDARD.md` section 1   |
| What does the deployed page send and allow? | `vercel.json`                                                                 |

Binding documents, in order: `docs/UI_FOUNDATIONS.md` (supersedes `docs/BRAND_AND_UI.md` where they
disagree), `docs/BRAND_AND_UI.md`, `docs/PIXEL_STANDARD.md`. Start with `docs/HANDOFF.md`, then
`docs/PLAN.md` and `docs/ARCHITECTURE.md`.

## Security and privacy posture

This is a data security company's public asset, so the hygiene is part of the deliverable:

- **Zero third-party scripts, fonts, analytics or CDNs at runtime.** Everything is self-hosted and
  bundled. One Playwright request handler in `e2e/smoke.spec.ts` is the only thing enforcing it.
- Strict CSP in `vercel.json`; no `eval`, no `innerHTML` with data; the built page has no inline
  `<script>` or `<style>`, which is why `script-src 'self'` needs no relaxation.
- No accounts, no cookies, no network calls. One `localStorage` boolean for the music toggle.
- Every dependency pinned exactly, lockfile committed, `pnpm audit` in CI.

## What is not done

- **Phase 6 leaderboard.** `apps/api` does not exist; `createLeaderboardClient` is a stub that reports
  the board unavailable and performs no network I/O. The game stays fully playable with it down.
- **Real pixel art.** All art is generated by `tools/graybox`. Decision D2 (who draws production art)
  is still open.
- **Most player-facing copy is placeholder** and needs research sign-off — see `docs/COPY_REVIEW.md`,
  which currently reaches 29 of the 86 `strings` keys.
- **Fonts**: Haffer and Season Mix are self-hosted TTFs. WOFF2 subsetting is the largest unclaimed
  win on the page weight and has not been done.
- The open items in `docs/MAKING_IT_BETTER.md` and `docs/UX_REVIEW.md`.
