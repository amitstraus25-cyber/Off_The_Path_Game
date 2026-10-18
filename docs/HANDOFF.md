# Handoff — read this first

Written 2026-10-18, after moving the project to a clean repository.

## Where to work

|            |                                                           |
| ---------- | --------------------------------------------------------- |
| **Folder** | `/Users/amitstraus/Desktop/Cyera/games/Off The Path Game` |
| **Repo**   | `https://github.com/amitstraus25-cyber/Off_The_Path_Game` |
| **Branch** | `main` (single commit, clean history)                     |

**Do not work in `/Users/amitstraus/Desktop/Cyera/games/off the path`.** That is the previous
repository (`amitstraus25-cyber/off_the_path`). It is kept only as an archive of the 47-commit
history. Anything committed there from now on is lost work.

## What this is

A five-minute browser pixel adventure for Cyera's **Off the Path** research page. Red walks a
forest, three travellers offer her "skills", and the player decides what each is allowed to do:
**Allow / Restrict / Reject**.

The lesson is Cyera's own research, [When Language Becomes the Attack
Vector](https://www.cyera.com/research/when-language-becomes-the-attack-vector-the-lethal-trifecta-of-ai-agents):
an agent holding all three legs of the **lethal trifecta** at once — reads your private data, reads
untrusted content, can send word out — can be turned against you by an instruction hidden in
ordinary prose. A notice nailed to a post in the forest carries that instruction. It fires only if
all three legs are live, and no skill card ever warns about it.

## Layout

```
packages/core    pure TypeScript rules: state machine, scoring, run log, content schema.
                 No DOM, no Phaser, no clock, no randomness. 100% branch coverage, enforced.
apps/game        Vite + Phaser 3 (world only) + Preact (all UI). The one deployed service.
content/         the entire game as data. Adding a skill must not require code changes.
tools/graybox    procedural placeholder art generator (`pnpm graybox`).
tools/sim        plays strategies through the real reducer (`pnpm sim`).
docs/            design, architecture, brand, and review findings.
reference/       brand theme + logos (needed to build), plus design source material.
```

## Commands

```
pnpm dev         dev server on :5173
pnpm build       production build of apps/game
pnpm test        unit tests + coverage gate
pnpm typecheck   tsc across every workspace
pnpm lint        eslint + prettier --check
pnpm e2e         Playwright. Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm graybox     regenerate placeholder art
pnpm sim         strategy simulator
```

## What changed in the move

Nothing about the game itself changed. The move removed two things and fixed one:

1. **Deleted `tools/spike`.** A Phase 0 throwaway that compared Phaser against a hand-rolled
   canvas renderer. Because it was a second buildable Vite app, Vercel's import detected "multiple
   applications" and offered to deploy it. Its measured result is recorded in
   `docs/ARCHITECTURE.md` section 2a; the code is recoverable from the old repository.
2. **Deleted `apps/api`.** It was a one-line `export {}` stub for the Phase 6 leaderboard.
   An undeclared service cannot fail a build, so it is better absent than empty. When Phase 6
   starts, create it and add a second service to `vercel.json` with an `/api/(.*)` rewrite.
3. **Regenerated `pnpm-lock.yaml`**, which still listed both deleted packages. Without this,
   `pnpm install --frozen-lockfile` fails on the build server.

`CLAUDE.md` and `docs/ARCHITECTURE.md` were updated so they no longer describe packages that do
not exist.

## Deployment

`vercel.json` declares **one service**, `game`, rooted at `apps/game`, made public by a catch-all
rewrite. Security headers stay at the top level, where public routing lives in services mode, so
the strict CSP applies to every response.

Two non-obvious things that are easy to undo by accident:

- **`pnpm-workspace.yaml` allow-lists esbuild's build script under BOTH keys.** pnpm 11 reads
  `allowBuilds`; pnpm 10 reads `onlyBuiltDependencies`. Vercel picks the pnpm version from the
  lockfile (`lockfileVersion: 9.0` → pnpm 9 or 10), _not_ from `packageManager`. With only the
  pnpm 11 key, the build server silently skips esbuild's postinstall.
- **Do not deploy with `vercel deploy` from the CLI.** It uploads the local working tree. Use the
  GitHub integration so builds come from pushed commits.

## Verified state

Checked in this folder before the initial commit:

- `pnpm install --frozen-lockfile` clean
- 0 type errors, lint clean
- 144 core + 65 game unit tests, **100% branch coverage** on `packages/core`
- 50 Playwright tests
- Production build from the service root
- Built bundle under the real CSP: no violations, no external requests, logo and both brand fonts
  self-hosted

## The cast

Three **characters** offer skills and are judged: Rabbit, Owl, Lantern Keeper. Three
**bystanders** offer nothing and are never scored: Toadstool, Magpie, Snail. The split is
load-bearing, not decoration, and `docs/GAME_DESIGN.md` section 5a has the rules for adding to it.
A bystander that could be mistaken for a decision is a bug, and four lint rules in
`packages/core/src/content.ts` exist to catch the ways that happens.

## Where the design truth lives

Read these before changing any UI:

- **`docs/UI_FOUNDATIONS.md`** — binding. Transcribed from the "Off the Path — Game UI" design
  deck. Supersedes `BRAND_AND_UI.md` wherever they disagree. Three radii only; Season Mix is never
  italic; **no Lime on a verdict button**, because Lime on Allow makes the unsafe answer the
  brightest thing on screen.
- `docs/RESEARCH_ALIGNMENT.md` — why the trifecta model exists, with sources.
- `docs/MAKING_IT_BETTER.md` — the 117-agent review: 42 verified findings plus engagement
  proposals. **This is the best list of what to do next.**
- `docs/DESIGN_V2.md`, `docs/PLAN.md` — the phased build plan.

## What is not done

- **Phase 6 leaderboard.** `apps/api` does not exist. `createLeaderboardClient` is a stub that
  reports the board unavailable and performs no network I/O. The game must stay fully playable
  with it down.
- **Real pixel art.** All art is generated by `tools/graybox`. Decision D2 (who draws production
  art) is still open. The design deck contains finished-looking art; asking for those source files
  would settle it.
- **Most player-facing copy is placeholder** and needs research sign-off. See
  `docs/COPY_REVIEW.md`.
- **The open items in `docs/MAKING_IT_BETTER.md`**, chiefly: the Inspect card still shows
  capability marks before the player has asked anything, which softens the twist.
