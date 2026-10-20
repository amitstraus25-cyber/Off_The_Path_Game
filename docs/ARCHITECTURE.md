# Architecture

## 1. Principles

1. **Pure core, thin shells.** Rules live in a dependency-free TypeScript package; Phaser, the DOM and the server are shells around it.
2. **Data-driven content.** One validated JSON file defines the whole game.
3. **Deterministic and replayable.** A run is an ordered log; the same log and content version always produce the same score and ending. This is what lets the server verify scores.
4. **Static first.** The game is a static bundle that can be embedded anywhere. The leaderboard is the only networked feature and the game must remain fully playable if it is down.
5. **Security-company hygiene.** No third-party runtime code, strict CSP, minimal data.

## 2. Stack (defaults; confirm in Phase 0)

| Concern                         | Choice                                                                                                                          | Why                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                        | TypeScript (strict)                                                                                                             | Shared types between game, core and API.                                                                                                                                                                              |
| Build                           | Vite                                                                                                                            | Fast dev loop, simple static output.                                                                                                                                                                                  |
| World renderer                  | Phaser 3 (pin exact stable version at scaffold time)                                                                            | Tilemaps, camera, input, mobile scaling out of the box. Phase 0 includes a one-day spike comparing bundle size against a hand-rolled canvas renderer; keep Phaser unless the bundle blows the budget.                 |
| UI overlay                      | Preact + plain CSS (tokens from `reference/brand/cyera-theme.css`)                                                              | Tiny, declarative, accessible DOM for dialogue, cards, results, leaderboard.                                                                                                                                          |
| Map editing                     | Tiled (export JSON)                                                                                                             | Standard; artists can iterate without code.                                                                                                                                                                           |
| Validation                      | zod (or valibot)                                                                                                                | One schema validates content, API payloads and `postMessage`.                                                                                                                                                         |
| Unit tests                      | Vitest                                                                                                                          | Core logic, scoring, state machine, content schema.                                                                                                                                                                   |
| E2E                             | Playwright                                                                                                                      | Full playthroughs, a11y checks (axe), screenshot comparisons against the mocks.                                                                                                                                       |
| Hosting + backend (leaderboard) | Vercel: static game plus Vercel Functions on the Node 22 runtime, with managed Postgres or KV [DECISION D3, changed 2026-10-16] | One project and deploy for game and API; same origin, so no CORS. Hidden behind a `LeaderboardClient` interface so it can be swapped for Cyera infrastructure. `vercel.json` sets build, output and security headers. |
| Package manager                 | pnpm workspaces                                                                                                                 | Strict, fast, lockfile.                                                                                                                                                                                               |

Always run `npm view <pkg> time` (or equivalent) and pick a version older than 14 days. Pin exact versions (no `^` or `~`).

## 2a. Phase 0 spike result: Phaser vs hand-rolled canvas (2026-10-15)

Same graybox map, Red sprite, camera follow and integer scaling in both (a throwaway `tools/spike`
package for the canvas version, `apps/game` for Phaser), measured in headless Chromium at 4x CPU
throttle, DPR 2, 812x375. **The spike package has since been deleted**: the decision below is the
artifact worth keeping, and leaving a second buildable app in the repo made Vercel offer to deploy
it. It is recoverable from the history of the previous repository if it is ever needed again.

|                    | Gzipped JS | Frame rate (static scene) |
| ------------------ | ---------- | ------------------------- |
| Hand-rolled canvas | 1.3 KB     | 60 fps                    |
| Phaser 3.90.0      | 326 KB     | 60 fps                    |

**Decision: keep Phaser 3.90.0.** It uses about 72% of the 450 KB initial JS budget, leaving roughly 120 KB for Preact, zod, core and UI.
Watch the budget: zod and the UI must stay small. If the budget gets tight, the fallback is a custom Phaser build (`phaser/src` with unused plugins dropped) before switching to the hand-rolled renderer.
Caveats: headless desktop Chromium is not a mid-range phone, and the scene is static, so re-measure on a real device in Phase 2 (movement) and Phase 7.
Phaser 4.x (4.2.1) exists; this plan targets 3.x as written. Moving to 4 is a deliberate later decision, not part of Phase 0.

## 3. Repository layout

What is actually on disk. Four workspaces; `apps/api` is **not** among them (section 8).

```
off-the-path/
  CLAUDE.md
  docs/                       # this folder
  reference/                  # concept, mocks, brand assets (read-only reference)
  content/
    game.json                 # ALL game content. The schema and the content lint live in
    game.seed.json            #   packages/core/src/content.ts -- there is no schema file here
  packages/
    core/                     # pure TS: state machine, scoring, outcomes, run log, camera, content
      src/ (camera.ts, content.ts, outcomes.ts, reducer.ts, runlog.ts, scoring.ts, state.ts, index.ts)
      test/
  apps/
    game/                     # Vite app -- the only deployed service
      index.html
      e2e-build.ts            # builds the bundle every e2e run measures (reached only as a path
                              #   string from playwright.config.ts)
      src/
        main.ts               # boot: load content, create store, mount UI + Phaser
        bus.ts, store.ts      # typed event bus; the single store over `reduce`
        world/                # Phaser: scenes, map, assets, input, and the pure logic barrel
        ui/                   # Preact components + CSS (tokens.css imports the brand theme)
        audio/                # music generated from bar numbers; no audio files in the repo
        net/leaderboard.ts    # LeaderboardClient interface + the Phase 6 stub
        embed/postMessage.ts  # embed contract (section 9)
        assets/               # generated tileset, map, sprites, portraits, items + manifest.json
      public/fonts/           # self-hosted Haffer and Season Mix
      public/brand/           # official Cyera logo files, used as-is
      test/                   # Vitest: map, assets, strings, title, results, score, logic
      e2e/                    # Playwright
  tools/
    graybox/                  # procedural placeholder art + the map generator
    sim/                      # plays strategies through the real reducer
  .github/workflows/ci.yml
```

## 4. Core domain model (`packages/core`)

**The types are the documentation. Read them, do not read a copy of them.**

| What                                             | Where it is declared                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Content` and every type inside it               | `contentSchema` in `packages/core/src/content.ts` (zod; `Content` is `z.infer` of it) |
| The content lint (the rules a schema cannot say) | `loadContent` in the same file                                                        |
| `GameState`, `Action`, `Phase`, `RejectReason`   | `packages/core/src/state.ts`                                                          |
| `RunEvent`                                       | `runEventSchema` in `packages/core/src/state.ts`                                      |

This table replaces the hand-written interface blocks that used to sit here. They had drifted badly:
they named six of the twelve top-level content keys and omitted the whole `read` run event, which is
how a notice is recorded and therefore how two of the three errand goals are earned. A copy of a type
is a second place for the type to be wrong, and in a repo whose scoring is replayed server-side from
the run log, a run event missing from the documented union is the most expensive possible omission.

Pure functions: `reduce(state, action, content)` and `tryReduce` (which returns a typed
`RejectReason` instead of silently returning the same state), `score(log, content)`,
`ending(state, content)`, `canEnterCottage(state, content)`, `checkLog` / `isLegalLog` and `derive`
for the server replay path, and `cameraFor` (section 7).
**Time is injected** (`at` comes from a clock passed in), never read inside core.

## 5. Flow / state machine

```
title -> intro -> explore <-> dialogue -> inspect -> (verdict) -> explore
                     \________ after 3 verdicts: cottage gate opens ________/
explore -> cottage -> results -> leaderboard -> (replay -> title)
```

- `explore`: Phaser has input. UI shows the HUD only.
- `dialogue` / `inspect`: Phaser input is paused; UI has focus (focus trap, Esc backs out one level, never skips a verdict).
- Verdicts are final for a run (replay to retry).
- Cottage door: an NPC-free `trigger-cottage` object on the **doorstep**, NOT at the garden gate; if not
  all verdicts are in, Red says a hint line ("I should hear all three travellers first"). It moved off
  the gate because the gate sat in front of the note on Grandma's door and made the `sign` errand goal
  unearnable. **Do not quote its coordinates here.** What matters is the relationship, and all of it is
  tested: the trigger is east of `notice-cottage-door`, the two rects never share a tile, and both span
  the full band of rows a walker can be on, so every approach from the garden crosses the note first and
  the trigger second whichever row she walks. The rects themselves live in `apps/game/src/assets/map-forest.json`
  and are generated by `tools/graybox/src/forest-map.ts`. See docs/GAME_DESIGN.md section 5b.
- A verdict normally follows `INSPECT`. `allow` alone may also be given straight from `dialogue`, which is how a skill starts running with nobody having read it; `restrict` and `reject` are refused there with `must-open-the-card`. See docs/GAME_DESIGN.md section 5c.

## 6. World <-> UI wiring

- A tiny typed event bus (`mitt`-style, ~20 lines, hand-written) connects layers. Phaser emits `interact(characterId)`, `enteredCottage`; UI emits `choose(question|verdict)`, `closePanel`.
- A single store (`createStore(reduce)`) owns `GameState`. Phaser reads `phase` to pause/resume input. UI components subscribe to slices.
- Phaser never imports UI; UI never imports Phaser. Both import `core`.

## 7. Input and layout

- **The camera is derived, and this document does not hold a copy of its numbers.** Every constant and
  rule lives in **`packages/core/src/camera.ts`** — `TILE`, `FRAME`, `MARGIN`, `PORTRAIT_WORLD`,
  `MIN_VIEW`, `MAX_VIEW`, `MAX_ZOOM`, `TITLE_CARD_W`, `REFERENCE_VIEWPORTS` — and the one function that
  answers the question is `cameraFor(viewport)`, which returns the zoom, the camera in game pixels **and
  the camera in tiles**. `availableFor` takes the frame, header strip and margins out; `stageFit` picks
  the largest whole-CSS-pixel zoom that still shows `MIN_VIEW` and derives the camera from what is left,
  clamped to `MAX_VIEW`. `apps/game/src/ui/stage.ts` resizes Phaser to match and publishes the world box
  as `--otp-canvas-x/y/w/h`. `pixelArt: true`, `roundPixels: true`.
  `apps/game/src/world/logic.ts` only **re-exports** these for the game layer; it is not where they live,
  and citing it is how the figures drifted last time.
  **Anything deciding what is in frame calls `cameraFor()` or runs `pnpm world --frame …`. It never
  quotes a number.** The earlier version of this section stated a 16px tile, a 192x108 minimum, a 3x cap
  and a 640x400 clamp. Every one of those was from the pre-remaster build, and composing against
  remembered camera figures has already cost this project two rounds; `camera.ts`'s own header records
  why. The camera's aspect follows the window, so nothing should assert 16:9.
  The rule this replaced floored the zoom in **device** pixels, which a phone cannot satisfy against a
  fixed camera: a 390px screen at DPR 3 fitted 2.44 and floored to 2, giving a 320x180 canvas, and at
  DPR 2 it floored to 1 and gave 240x135 — the world rendered at about a third of the screen.
- Keyboard: arrows / WASD to move, Space / Enter / E to interact, Esc to go back. Touch: on-screen joystick (bottom-left) + A button (bottom-right), both DOM elements, 44px+ targets. Pointer: click NPC to walk-and-talk (stretch).
- Portrait phones: the world takes the top share named by `PORTRAIT_WORLD` in `packages/core/src/camera.ts`, with no outer margin, because 32px of a 390px screen costs a whole zoom step, and panels dock at the bottom [DECISION D5]. Never require rotation.
- `prefers-reduced-motion`: no camera shake or bobbing; instant panel transitions.

## 8. Leaderboard API (`apps/api`, Phase 6 — not built yet)

> The package does not exist in the repository. It is deliberately absent rather than an empty
> stub, because an undeclared service cannot fail a build. When Phase 6 starts, create `apps/api`
> and add it to `vercel.json` as a second service with an `/api/(.*)` rewrite.

Base `/v1`, JSON only, CORS locked to the embedding origins.

| Method + path                                                                                                                                                                                          | Purpose                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /runs`                                                                                                                                                                                           | Start a run. Returns `{ runId, token, startedAt }`. Token is an HMAC-signed blob (runId, startedAt, contentVersion), short TTL (e.g. 2 h).                                                                                                                                                                                        |
| `POST /runs/:id/submit`                                                                                                                                                                                | Body `{ token, handle, log }`. Server verifies the signature, content version, and that the log is a legal sequence; **recomputes score with `packages/core`**; rejects implausible durations (e.g. faster than 45 s) and duplicates; stores `{ handle, score, durationMs, week, createdAt }`. Returns `{ score, rank, window }`. |
| `GET /leaderboard?window=week                                                                                                                                                                          | all&limit=5&runId=`                                                                                                                                                                                                                                                                                                               | Top N plus the caller's own row if `runId` given, plus `totalPlayers`. |
| `DELETE /admin/scores/:id`                                                                                                                                                                             | Moderation; behind a secret or Vercel auth protection, never exposed in the client.                                                                                                                                                                                                                                               |
| Rules: handle 3 to 16 chars `[A-Za-z0-9_.-]`, no leading/trailing punctuation, profanity + reserved-word blocklist (`cyera`, `admin`, `official`, ...),                                                |
| rendered as text only. Week = ISO week in UTC, resets Monday 00:00 UTC. Rate limit per hashed IP (daily-rotating salt; **never store raw IPs**).                                                       |
| No cookies, no accounts, no email. Retention policy to be set with Legal [DECISION D10].                                                                                                               |
| **Client behaviour:** the game never blocks on the network. If `POST /runs` fails, play continues; at the end show results and a quiet "Leaderboard unavailable right now" with the CTA still working. |

## 9. Embedding contract (`apps/game/src/embed`)

The game runs inside an iframe on the research page (or standalone). It posts events to `window.parent` with a strict target origin (configured at build time) and only accepts messages from that origin:

```
otp:ready        {version}
otp:started      {runId?}
otp:verdict      {skillId, verdict}
otp:completed    {score, ending, rank?}
otp:cta          {}              // "Read the Research" clicked; parent decides navigation
```

Inbound (optional): `otp:pause`, `otp:resume`. All payloads are validated with the shared schema. Analytics belongs to the parent page's existing tooling; the game ships no analytics of its own.

## 10. Security headers and CSP (static host config)

**`vercel.json` is the source of truth.** This is what it ships today, copied from it verbatim — not a
specification of what it ought to be:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  font-src 'self'; connect-src 'self'; frame-ancestors https://cyera.com https://*.cyera.com;
  base-uri 'none'; form-action 'none'; object-src 'none'
X-Content-Type-Options: nosniff     Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Two differences from the version this document used to print, both of which matter:

- `frame-ancestors` names **`https://cyera.com` as well as `https://*.cyera.com`**. The wildcard does not
  match the bare apex, so the documented policy would have refused to frame the game on cyera.com itself.
- `connect-src` is `'self'` with no API origin, because the leaderboard is same-origin by decision D3.
  Phase 6 adds nothing here.

`img-src` keeps `data:` deliberately: the Phaser bundle carries its own default textures as `data:image/png`
URIs, and dropping it breaks boot.

Build must not need `unsafe-inline`; no inline styles generated at runtime (use classes / CSS variables).
The built `index.html` carries one external module script and one stylesheet link and no inline `<script>`
or `<style>`, which is why `script-src 'self'` needs no relaxation.

**Unverified, and it should be before launch:** nothing in the repository tests this policy, `vite preview`
does not serve it, and it is not confirmed that a top-level `headers` block survives the rewrite into the
`game` service. If it does not, the policy never ships.

## 11. Performance budget

- Time to interactive under 3 s on a mid-range phone over 4G. Initial JS under 450 KB gzipped including Phaser (verify at the Phase 0 spike); total assets under 3 MB.
- **The leaderboard UI is not lazy-loaded, and this document claimed twice that it was.** There is not one
  dynamic `import()` anywhere in `apps/game/src` and the build emits a single JS chunk. Code-splitting it
  is a Phase 7 option, not a present-tense fact; until something does it, do not budget against it.
- Steady 60 fps on a mid-range phone; no per-frame allocations in the update loop.

## 12. Accessibility (WCAG 2.2 AA)

Full keyboard play; DOM dialogue announced via `aria-live="polite"`; focus trap and visible focus ring (Lilac outline on dark, Deep Purple on light);
choices never conveyed by color alone (icons + text); contrast checked on every token pair; touch targets 44px; reduced-motion respected; sound off by default;
page works with browser zoom to 200% (UI is DOM, so it reflows).

## 13. Testing strategy

- **core**: 100% of rules covered; table-driven tests for every skill x verdict; property test that `score(log)` equals the incremental score; ending selection tests.
- **content**: schema validation + lint rules (every skill has all three outcomes, a best verdict exists, at least one safe skill exists, strings non-empty, no banned vendor names).
- **e2e (Playwright)**: scripted playthroughs (perfect run = 1000, reject-all run, allow-all run), keyboard-only run, mobile viewport run, leaderboard-down run; axe a11y scan on every screen; screenshot diffs of DOM panels against the mocks with a tolerance.
- **api**: unit tests for validation/recompute/rate limit; a replay test submitting forged logs that must be rejected.
