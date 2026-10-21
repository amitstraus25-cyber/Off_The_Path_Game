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

A five-minute browser pixel adventure for Cyera's **Off the Path** research page. Purple walks a
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
pnpm test        unit tests in core, game and graybox; core gated at 100% on all four metrics
pnpm typecheck   tsc across every workspace
pnpm lint        eslint + prettier --check
pnpm e2e         Playwright. Locally set CHROMIUM_PATH to reuse an installed Chromium
pnpm graybox     regenerate placeholder art
pnpm sim         strategy simulator
pnpm preview     contact sheets of the generated art
pnpm world       renders the map through the REAL camera (--frame title|arrive|portrait)
pnpm score       measures a render against the concept board
```

`CLAUDE.md` carries the same list with what each one is for.

## What changed in the move

Nothing about the game itself changed. The move removed two things and fixed one:

1. **Deleted `tools/spike`.** A Phase 0 throwaway that compared Phaser against a hand-rolled
   canvas renderer. Because it was a second buildable Vite app, Vercel's import detected "multiple
   applications" and offered to deploy it. Its measured result is recorded in
   `docs/ARCHITECTURE.md` section 2a; the code is recoverable from the old repository.
2. **Deleted `apps/api`.** It was a one-line `export {}` stub for the Phase 6 leaderboard.
   An undeclared service cannot fail a build, so it was better absent than empty.
   **Phase 6 has since landed and rebuilt it** — see "The leaderboard" below. This numbered list
   describes the move of 2026-10-18 and is deliberately left as a record of that day; read it as
   history, not as the present state of the tree.
3. **Regenerated `pnpm-lock.yaml`**, which still listed both deleted packages. Without this,
   `pnpm install --frozen-lockfile` fails on the build server.

`CLAUDE.md` and `docs/ARCHITECTURE.md` were updated so they no longer describe packages that do
not exist.

## Deployment

`vercel.json` declares **no services at all** — top-level `installCommand`, `buildCommand` and
`outputDirectory`, with the two live routes at `api/score.ts` and `api/top.ts` in the **repository
root**, thin re-exports of the handlers in `apps/api`. No rewrites: there is no SPA fallback and
unknown paths 404, which is unchanged from every arrangement before it.

**Two earlier arrangements served no functions and neither should be tried again.** Two services
(`game` + `api`, with an `/api/(.*)` rewrite) produced none. Moving the routes inside the game
service produced none either. Vercel's docs account for both: in services mode each service is
built by its own framework or runtime with no project-level build and no project-level scan, and
the zero-config `api/` convention is documented for the **project root** rather than a service
root — so a service declaring `framework: "vite"` gets a static build and its `api/` directory is
never read. `GET /api/top` returned Vercel's own 404 throughout, not a 500 from our code, which is
the difference between "the route failed" and "the route was never created".

Three things this arrangement needs that the previous ones did not, each of which will break the
deploy quietly if it is undone: the root `package.json` depends on `@otp/api` as `workspace:*`, so
pnpm links it where root `api/` can resolve it; `tsconfig.api.json` lives at the root and is wired
into the root `build` as well as `typecheck`, because the platform runs `build` and never runs
`typecheck`; and the routes `export default { fetch }` rather than a bare default function, which
is not a shape Vercel documents.

Security headers stay at the top level so the strict CSP applies to every response; `connect-src`
stays `'self'` because the board is same-origin (D3) and widening it would be the wrong fix for
anything. **Confirmed live on `GET /`; not yet confirmed on a function response** — see
`ARCHITECTURE.md` §10.

Two non-obvious things that cost real time here:

- **A `"framework": null` fails `vercel.json` schema validation,** and a failed validation fails the
  whole deployment. It did, for six hours, while the client looked at a build from that morning and
  we debugged a bug already fixed. A deploy that fails is louder than a test that fails — read the
  deployment, not just CI.
- **If a second service is ever reintroduced, the rewrite order is load-bearing** — `/api/(.*)` must
  stay above the `/(.*)` catch-all or every API request is served the game — and it must not land
  without a deploy that proves it serves functions.

Two non-obvious things that are easy to undo by accident:

- **`pnpm-workspace.yaml` allow-lists esbuild's build script under BOTH keys.** pnpm 11 reads
  `allowBuilds`; pnpm 10 reads `onlyBuiltDependencies`. Vercel picks the pnpm version from the
  lockfile (`lockfileVersion: 9.0` → pnpm 9 or 10), _not_ from `packageManager`. With only the
  pnpm 11 key, the build server silently skips esbuild's postinstall.
- **Do not deploy with `vercel deploy` from the CLI.** It uploads the local working tree. Use the
  GitHub integration so builds come from pushed commits.

## Verified state

**These numbers are a dated snapshot, not a target.** They go stale every round, so re-run the
commands rather than quoting this list; it is here to say what "green" looked like, not what it is.

Checked before the initial commit (2026-10-18):

- `pnpm install --frozen-lockfile` clean
- 0 type errors, lint clean
- 154 core + 73 game unit tests, **100% branch coverage** on `packages/core`
- 55 Playwright tests
- Production build from the service root
- Built bundle under the real CSP: no violations, no external requests, logo and both brand fonts
  self-hosted

Re-measured 2026-10-20, same way:

- `pnpm test` green — 179 core + 137 game + 7 graybox, and `packages/core` at **100% on all four
  metrics** (statements 487/487, branches 302/302, functions 95/95, lines 379/379), which is what the
  threshold in `packages/core/vitest.config.ts` actually gates on
- `playwright test --list`: **118 tests in 16 files**
- One JS chunk and one stylesheet in `dist`, no inline `<script>` or `<style>` in the built page

## The leaderboard (Phase 6, landed)

`apps/api` exists and is a workspace. Two routes, no new dependencies, same origin:
**`POST /api/score`** takes `{ handle, log }`, replays the log through `packages/core` and stores
the score **it** computes; **`GET /api/top`** returns the ranked rows. The body carries no score and
could not — `submitRequestSchema` is strict — which is golden rule 6 expressed as a schema rather
than as a check someone can forget. Storage is Supabase over PostgREST through `fetch`, reached with
two environment variables and nothing else; a missing one is a `503` and a quietly absent board, not
a crash. `createLeaderboardClient` in `apps/game/src/net/leaderboard.ts` is **the real adapter now,
not the Phase 5 stub**, and still never blocks results or the call to action.

`apps/api/README.md` is the source of truth: the table, the environment, the hostile-caller table,
and the three manual steps under "What is NOT done". Read it before changing anything there.

## The cast

Three **characters** offer skills and are judged: Rabbit, Owl, Lantern Keeper. **Four**
**bystanders** offer nothing and are never scored: Toadstool, Magpie, Snail and Cat — four in
`content/game.json`, which is what this line counted wrongly as three while listing all four. The split is
load-bearing, not decoration, and `docs/GAME_DESIGN.md` section 5a has the rules for adding to it.
A bystander that could be mistaken for a decision is a bug, and four lint rules in
`packages/core/src/content.ts` exist to catch the ways that happens.

## The walk ends at the door

`trigger-cottage` is the **doorstep**, not the garden gate. It sat on the gate until 2026-10-18, which
put the end of the run in front of the note on Grandma's door and made the `sign` errand goal unearnable
in the natural order. `gate-fence-gap` now names the gap in the fence so the forest-post invariant has
something real to point at. See `docs/GAME_DESIGN.md` section 5b.

**This paragraph used to say "tiles 52-53, row 19", and both halves were wrong in a way worth naming.**
The columns were never 52-53. And "row 19" is the first attempt at the fix, which `forest-map.ts` and
GAME_DESIGN 5b both record **rejecting**: a one-row trigger on the doorstep row alone is invisible to a
player who holds Right, because `overlaps` is a point test on Purple's feet — she walked past the door, out
across the lawn, and the run never ended. The trigger and the note both span the full band of rows a
walker can be on, the note's lane sits immediately west of the doorstep, and the two rects never share a
tile. **Describe the relationship; do not quote the coordinates.** They are generated by
`tools/graybox/src/forest-map.ts` into `apps/game/src/assets/map-forest.json`, and `apps/game/test/map.test.ts`
is what holds them to it.

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

- **The leaderboard's three manual steps.** The service itself is built (see below); what is not
  done is the part that cannot be done from the repository. `apps/api/README.md` lists them under
  "What is NOT done": turn on Vercel firewall rate limiting for `/api/*` and prove it on a preview,
  make dedupe durable with a `log_hash` column (which reopens D10, so it is not a quiet migration),
  and set retention against D10's twelve months. Until the first of those, the in-process budget in
  `src/limit.ts` is a speed bump across several instances, not a control.
- **Real pixel art.** All art is generated by `tools/graybox`. Decision D2 (who draws production
  art) is still open. The design deck contains finished-looking art; asking for those source files
  would settle it.
- **Most player-facing copy is placeholder** and needs research sign-off. See
  `docs/COPY_REVIEW.md`.
- **The open items in `docs/MAKING_IT_BETTER.md`**, chiefly: the Inspect card still shows
  capability marks before the player has asked anything, which softens the twist.
