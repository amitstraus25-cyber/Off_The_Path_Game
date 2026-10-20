# `@otp/api` — the leaderboard service

Two routes behind the game, on the same origin, with no new dependencies.

**The database as an operational thing is `docs/DATABASE.md`** — the schema and why, the RLS
posture, the migrations in `supabase/migrations/`, how to rotate a key without downtime, what
happens when the free tier pauses, how to tell whether the board is actually working and what to do
when it is not. This file is the service; that one is the database.

| Route             | What it does                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/score` | Takes `{ handle, log }`. Replays the log through `packages/core`, **recomputes the score**, stores the recomputed number. Answers `{ handle, score }`. |
| `GET /api/top`    | Answers `{ entries: [{ rank, handle, score }] }`, highest score first and earliest first on a tie. Cached at the edge for 60 s.                        |

The body carries no score, and could not: `submitRequestSchema` is strict and rejects any key it
does not name. That is CLAUDE.md golden rule 6 — "never trust the client for leaderboard scores" —
expressed as a schema rather than as a check that can be forgotten. `test/score.test.ts` is the
proof: a submission carrying `score: 999999` is a 400 with nothing written, and the same run without
the claim stores the figure `score()` computes from the replayed log.

## Environment variables

Two, and only two. Both are already set on Production and Preview and both are marked sensitive.

| Variable                    | Used for                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_URL`              | The project origin, e.g. `https://<ref>.supabase.co`. Must be `https:`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sent as the `apikey` and `Authorization: Bearer` headers on every call. |

Nothing else is read. The `POSTGRES_*` variables would need a Postgres driver, which is a
dependency this service does not have and does not want (CLAUDE.md rule 7: fewer dependencies is a
feature). **No `NEXT_PUBLIC_*` variable is ever read** — anything with that prefix is shipped to
browsers by convention, so treating one as a secret would be a mistake wearing a safe name.
`SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are both subject to row-level
security, and the table has RLS on with no policies, so neither could read or write a row anyway.

**When one is missing or wrong** nothing crashes and nothing half-works. `src/env.ts` returns a
reason, `src/deps.ts` logs it by variable name (never by value), the store is `null`, and both
routes answer `503 {"error":"the leaderboard is unavailable"}`. The game then shows
`leaderboardDown` — "Leaderboard unavailable right now." — with results and the "Read the Research"
call to action untouched. A board that is not configured is a board that is quietly absent, which is
the behaviour `apps/game/src/net/leaderboard.ts` has promised since Phase 5.

The key travels in headers only. PostgREST also accepts `?apikey=`, and this service never uses it,
because a key in a query string is a key in every access log and referrer on the way;
`test/store.test.ts` asserts that no request URL contains it and that no response body does either.

## The table

Already created, exactly as below. RLS is **on with no policies on purpose**: `anon` and
`authenticated` can do nothing at all, and the only key that can read or write is the service role
key, which bypasses RLS and lives in a server environment no visitor sees.

```sql
create table public.leaderboard (
  id         bigint primary key generated always as identity,
  handle     text        not null check (char_length(handle) between 1 and 16),
  score      integer     not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index leaderboard_rank_idx on public.leaderboard (score desc, created_at asc);
alter table public.leaderboard enable row level security;
revoke all on public.leaderboard from anon, authenticated;
```

A handle and a score. No account, no email, no cookie, no IP address, raw or hashed, and no run id —
CLAUDE.md's privacy rule is the schema. `test/store.test.ts` asserts the inserted row has exactly
the two keys, so a third one cannot arrive by accident.

`supabase/migrations/0001_leaderboard_baseline.sql` is this same DDL written idempotently, so the
repository and the database can be compared rather than assumed. Running it against the live
project changes nothing; its verification query prints the table's actual columns, constraints,
indexes, grants and RLS state, which is the first thing to run when the board misbehaves.

## Vercel settings

**As committed at `9aa7968`, `vercel.json` declares ONE service.** The routes are ordinary Vercel
Functions of the _game_ service, in `apps/game/api/`, re-exporting the handlers from this package:

```json
"services": {
  "game": { "root": "apps/game", "framework": "vite", "outputDirectory": "dist" }
},
"rewrites": [
  { "source": "/(.*)", "destination": { "service": "game" } }
]
```

The CSP is **unchanged** — `connect-src` stays `'self'` because the browser only ever calls our own
origin. Widening it would be the wrong fix for anything.

**The two-service arrangement this section used to describe is gone, and why it failed is worth
keeping.** It declared `"api": { "root": "apps/api" }` and routed `/api/(.*)` into it. That service
set no `framework` (so no preset to trigger zero-config `api/` detection), no `entrypoint`, no
`runtime` and no `functions` glob: it was told to produce nothing and it produced nothing, so
`/api/*` was rewritten into an empty service and Vercel answered with its own NotFound page. An
earlier form of it set `"framework": null`, which is invalid for a _service_ (it is only valid at
the top level) and failed every deployment for six hours.

`apps/api/api/score.ts` and `api/top.ts` remain, unchanged and tested, so this package is still
deployable on its own if the routing question is ever reopened.

### The two copies of the routes, and whether the dead one should go

**State of it, measured 2026-10-21 against the working tree.** There are two copies:

| Copy                 | Imports via                | Served?                                        | Executed by a test?                      | Typechecked by           |
| -------------------- | -------------------------- | ---------------------------------------------- | ---------------------------------------- | ------------------------ |
| `apps/api/api/*.ts`  | `../src/*.ts` (relative)   | **No** — outside the one service root          | **Yes** — `apps/api/test/routes.test.ts` | `apps/api/tsconfig.json` |
| `apps/game/api/*.ts` | `@otp/api/src/*.ts` (deep) | **Yes** — the only copy the platform ever runs | **No** — nothing imports it              | `tsconfig.api.json`      |

`vercel.json` declares one service, `game`, rooted at `apps/game`. A path outside a service root is
not deployed, so `apps/api/api/` cannot be reached on the platform under the current config.

**Recommendation: do not delete it yet, and do not leave it as it is either.** It is not a harmless
duplicate and it is not disposable; it is both load-bearing and misleading at once.

What breaks if it is deleted, exactly:

1. **`apps/api/test/routes.test.ts` stops resolving.** It imports `../api/score.ts` and
   `../api/top.ts` at lines 42–43. That file is the _only_ test anywhere that executes a route entry
   point rather than calling a handler with a fake `Deps` — the Web handler signature, the
   module-scope `process.env` read and the one real `fetch` the store is built with are exercised
   nowhere else.
2. **The 100% coverage gate loses a file it is configured to count.** `apps/api/vitest.config.ts`
   sets `coverage.include: ['src/**/*.ts', 'api/**/*.ts']`, with a comment saying leaving `api/` out
   is how a route entry point sits at 0% while the summary looks respectable. Delete the directory
   and that half of the glob matches nothing; the gate goes quiet instead of going red.
3. **Nothing else.** No import outside that one test file, no script, and no build step references
   it. Deleting it does not touch the deployment, because the deployment never had it.

The part worth saying plainly: **the copy that is tested is not the copy that ships, and the copy
that ships is tested by nothing.** The two differ only in their import specifiers — relative versus
the `@otp/api/src/*.ts` deep path — and the specifier is precisely where this service's known
failure modes live (the missing `exports` map, the load-bearing `.ts` extension, the cross-root
reach documented in `test/cross-root.test.ts`). So `routes.test.ts` proves the wiring _pattern_ and
cannot prove the deployed file, which is the one thing its name suggests it does.

That makes a straight deletion a net loss of coverage for a gain in tidiness. The sequenced fix, for
whoever takes it: point `routes.test.ts` at `apps/game/api/*.ts`, extend the coverage include to
reach them (or move the test into `apps/game`), watch it stay green, and only then delete
`apps/api/api/`. Doing it in the other order deletes the test's subject and the gate's blind spot on
the same commit. Both halves cross an ownership line, so it is one task for one owner, not two.

**`services` is a real key and a gated one.** `vercel.json`'s own schema
(<https://openapi.vercel.sh/vercel.json>, the `$schema` that file points at) does define a top-level
`services` map — service names match `^[a-z]([a-z_-]*[a-z])?$`, `root` is the only required key, and
`rewrites[].destination` may be `{ "service": "<name>" }` — so the block above is not invented. But
the schema marks `services` **`"private": true`** (re-verified against the live schema on
2026-10-21, along with the allowed per-service keys: `root`, `framework`, `runtime`, `entrypoint`,
`installCommand`, `buildCommand`, `devCommand`, `ignoreCommand`, `outputDirectory`, `bindings`,
`functions`, `headers`, and `additionalProperties: false`). `"private"` on past form means a
feature that is not on for every account. Nobody here can tell from a checkout whether this project
has it.

**The prediction that used to sit here was wrong, and production falsified it.** It said that a
deploy ignoring `services` would answer `200` with the game's `index.html`, because "the catch-all
rewrite serves the SPA for any path". It does not: `{ "service": "game" }` delegates the _path_ into
the service, which then does its own filesystem lookup, and a static Vite `dist` has no
`/api/top` to find. There is no SPA-fallback rewrite anywhere in `vercel.json`. So an unknown path
404s whether `services` is honoured or not, and the content type of `GET /api/top` does **not**
discriminate the two cases. Measured on production, 2026-10-21:

| Request                           | Result                                      |
| --------------------------------- | ------------------------------------------- |
| `GET /`                           | `200` — the game, with this file's CSP live |
| `GET /api/top`                    | `404`, Vercel's own NotFound page           |
| `GET /api/score`                  | `404`, Vercel's own NotFound page           |
| `GET /api/definitely-not-a-route` | `404`, Vercel's own NotFound page           |

**The discriminator is `GET /api/score`, not `GET /api/top`.** `handleScore` answers any non-POST
with `405 {"error":"method not allowed"}` and an `Allow: POST` header. A `GET` that comes back `404`
therefore proves no function is mounted at that path at all — the request never reaches a line of
ours. A 404 rules out the cold-start-throw theory too: a thrown `content.ts` is a `500`, not a `404`.

Whatever replaces the two-service block, that `GET /api/score` check is the one to run first,
because it separates "nothing is routed" from "something is routed and failing" in one request.

- **Node version:** pinned to `22.x` by `engines.node` in this package's `package.json` (and by
  `.nvmrc` for CI). Project Settings → Node.js Version should read 22.x and not "latest".
- **Environment variables:** the two above, on Production and Preview, marked sensitive. There is no
  `.env.example` entry for them: that file is owned elsewhere this round, which is why they are
  documented here.
- **Functions:** `api/score.ts` and `api/top.ts` — both here and, as shipped, in `apps/game/api/` —
  are Node functions using the Web handler signature (`(request: Request) => Promise<Response>`),
  so they need no runtime types and no framework.
- **`apps/game/api/` is typechecked now, by `apps/game/tsconfig.api.json`** (added 2026-10-21), and
  since 2026-10-21 it is run by **both** of `apps/game`'s scripts — `typecheck` and `build` — as a
  second `tsc` after the game's own. **What it was before is worth keeping**: that `include` had no
  `api` entry and the game's build was `tsc -p tsconfig.json && vite build`, so a type error in the
  two shipped route files was invisible to `pnpm typecheck`, `pnpm build`, `pnpm lint`, `pnpm test`
  and CI, and could fail only on a deploy — the exact shape of the six-hour outage above, one layer
  down.

  **`build` is the wiring that matters, and it was missing from the first version of this config.**
  The game service in `vercel.json` sets no `buildCommand`, so the platform runs this package's own
  `build` script and **never runs `typecheck`**. Wired into `typecheck` alone, the config gated CI
  and left the deploy exactly as unguarded as before — a guard on the pipeline and not on the
  deployment, which is trap 3 in `docs/PAUL_BRIEF.md` reintroduced by the fix for it.

  **Measured, by breaking `apps/game/api/top.ts`'s `handlers.ts` import on purpose and running the
  whole toolchain against it.** Before the `build` wiring: `tsc -p tsconfig.json` exit 0,
  `eslint .` exit 0, `pnpm build` exit 0 (and `handlerz` appears nowhere in `dist` — the route files
  are not in the bundle at all, which is _why_ the build could not see them). After it:
  `pnpm --filter @otp/game build` exits **2** on
  `api/top.ts: error TS2307: Cannot find module '@otp/api/src/handlerz.ts'`, and it fails
  _before_ `vite build` runs, so no `dist` is produced and a broken route costs a failed deploy
  rather than a deployed dead board. (The line:col this used to quote is deliberately gone: writing
  the comment in that file moved the import from line 35 to line 58 on the same afternoon.) `eslint .` still exits 0 against the same break — see the next
  bullet. Restored and confirmed byte-identical with `cmp`.

  **Cost, since it is on every deploy now:** `tsc -p tsconfig.api.json` alone measures 0.64s, 0.59s,
  0.59s over three runs. The whole `build` with it measures 3.97s, 3.97s, 4.09s against a baseline
  of 3.65s, 4.40s, 5.11s without it — a real ~0.6s, inside the run-to-run noise of the build it
  joins. Not a reason to leave the deploy path unguarded.

  **What this config does _not_ catch, measured the same day:** dropping the load-bearing `.ts` off
  those imports. `tsconfig.base.json` sets `"moduleResolution": "Bundler"`, and Bundler resolution
  searches extensions where node's ESM resolver does not, so `'@otp/api/src/handlers'` typechecks
  clean and `pnpm --filter @otp/game build` exits 0. The next bullet is the only thing holding that
  line, and it is a comment, not a guard.

- **`eslint .` and `prettier --check .` do read these two files — a claim in
  `apps/game/api/top.ts` said otherwise until 2026-10-21 and was wrong.** That file called its
  tsconfig "the only thing in the repository that reads these two route files at all". It is not:
  `eslint .` resolves a config for `apps/game/api/` and lints it (proved by planting an unused
  binding and watching `@typescript-eslint/no-unused-vars` report it by path), and
  `prettier --check .` formats it (proved by unformatting it and watching `[warn]` name the file).
  Both were restored and confirmed with `cmp`. What neither does is **resolve an import**: against
  the `handlerz.ts` break above, `eslint .` exits 0 and prettier is happy. The gap was never
  "nothing reads these files", it was "nothing _typechecks_ them".

  **Adding `"api"` to the game's own `include` does not work, and that was re-run rather than
  repeated from memory.** The game sets `"types": ["vite/client"]` and the DOM libs; the pulled-in
  chain is Node. It fails with two `TS2591`s — `process` in `src/deps.ts` and, which the proposal
  did not mention, `node:crypto` in `src/limit.ts`. One directory cannot be both halves of that
  split, so the second config extends `tsconfig.base.json` with `types: ["node"]` instead. It also
  sets `erasableSyntaxOnly`, matching this package, because Vercel compiles these files and Node's
  type stripping refuses enums and parameter properties.

- **The `.ts` extension on the route files' imports is load-bearing. Do not drop it.** It looks like
  an artefact of `allowImportingTsExtensions` and the obvious tidy-up is to remove it. That tidy-up
  was proposed and **refuted by measurement** on node 22.23.1, the version `engines.node` pins:
  `import('@otp/api/src/deps.ts')` loads and exports `deps`; `import('@otp/api/src/deps')` is
  `ERR_MODULE_NOT_FOUND`. Node's ESM resolver does no extension searching for a bare-specifier
  subpath. A bundler such as esbuild does, so the extensionless form works under a bundler and only
  under a bundler — and which of the two Vercel applies here is the same unanswered question as
  everything else on this page. The form with the extension resolves under **both**, so it is the
  safe branch of a question nobody here can close.

- **`@otp/api` resolves from the game only because this package has no `exports` map**, and that is
  now written into `apps/api/package.json` as a `"//"` key, since strict JSON cannot hold a comment.
  Confirmed by adding the ordinary well-meaning map `{ ".": "./src/index.ts" }` and running both
  resolvers: node gives `ERR_PACKAGE_PATH_NOT_EXPORTED`, tsc gives four `TS2307`s, one per import
  across the two route files. Restored and confirmed with `cmp`. The good news is that this is no
  longer a silent failure — the new typecheck is what caught it, which is the second thing that file
  buys beyond the one it was asked for.
- **Build:** none. There is no build step and no output directory for this service; Vercel compiles
  the two functions.
- **The content file is imported from outside this service root.** `src/content.ts` imports
  `content/game.json` from the repository root — deliberately, because the recompute is only
  meaningful against the very bytes the game shipped. That import carries `with { type: 'json' }`,
  which Node 22 requires and which nothing in the test suite could have told us about (Vitest and
  Vite transform JSON imports either way; plain `node` answers `ERR_IMPORT_ATTRIBUTE_MISSING`).
  **Measured since:** a plain `node` process on 22.23.1 loads `src/content.ts` and both route files
  from this checkout and answers real requests, so the attribute and the path out of `apps/api` are
  right for Node itself. Whether Vercel's **bundler** follows that import is still only answered by
  a preview deploy. If it does not, `content.ts` throws at cold start, both routes 500, the game
  shows its unavailable line and play is untouched — a silent dead board, so check `GET /api/top` on
  the preview before believing the deploy.
- **`@otp/core` is raw TypeScript outside this service root, and that is the second import risk.**
  `packages/core` has no build step: its `main` is `src/index.ts`. It works under plain `node`
  because pnpm links it as a symlink whose real path is `packages/core/src/index.ts` — outside
  `node_modules`, where Node 22 is willing to strip types. A bundler that copies the service root
  plus its `node_modules` without following that link out of `apps/api` gets nothing to compile.
  Same symptom, same check: `GET /api/top` on the preview.

## Layout

```
api/score.ts     POST /api/score   -- thin: reads the environment once, calls the handler
api/top.ts       GET  /api/top
src/handlers.ts  both routes as pure functions of (Request, Deps)
src/store.ts     the table, over fetch against PostgREST
src/env.ts       the two variables, and what to do when they are not there
src/deps.ts      the only place that touches process.env
src/content.ts   the shipped content/game.json, through the same schema the game loads it with
src/http.ts      the response shapes and the one place headers are written
```

Everything with a decision in it is a pure function taking its dependencies as an argument, so the
whole service is tested in-process with a fake `fetch` and no database anywhere. This checkout has
no credentials and cannot reach Supabase; nothing in `test/` tries to.

## What has actually been run, end to end

Two suites being green says each half does what its own tests ask. It does not say the halves agree.
These are the measurements, not the intentions.

- **A real browser, the built game, and this service in one process.** A headless Chromium plays a
  finished run on a `vite preview` of `apps/game`, the post to `/api/score` is intercepted, and the
  exact body the shipped adapter sent is handed to `handleScore` with a fake store. Result: the
  results screen reads **900 out of 1,000**, the body is `{handle, log}` with 13 events and no
  `score` key, the service answers `200 {"handle":"fair-otter-22","score":900}`, and the row handed
  to the table is `{"handle":"fair-otter-22","score":900}`. Golden rule 6 holds in fact and not only
  in a unit test: the number on the board came from the server's own `score()` over the replayed
  log, and it matched the screen.
- **The same contract, in CI, without a browser.** `apps/game/test/leaderboard.test.ts` takes the
  body off the adapter's own request and runs it through `submitRequestSchema` → `checkLog` →
  `score()`, which is what this route does. Adding a key to the posted body fails it (checked by
  doing so).
- **A cold start with no environment.** `node` loading `api/score.ts` and `api/top.ts` with both
  variables unset logs `not configured: SUPABASE_URL is not set`, answers `503` to a complete run
  and to `GET /api/top`, and never throws. A `GET` on the write route is `405`, a form post is
  `415`, and a body carrying `score: 999999` is `400 {"error":"that submission is not valid"}`.
- **The fingerprint survives key reordering.** `limit.ts` says zod normalises key order, so the same
  run posted with its fields shuffled hashes the same and is still a duplicate. Checked against zod
  4.6.5 rather than assumed: both orders parse to the same JSON.
- **Posted twice, which a player does.** The Post button is enabled again as soon as a post
  succeeds, so a second press sends the same log and gets `409`. The game now reads that out as its
  own sentence (`leaderboardAlready`, "That run is already on the board.") rather than as
  "that run could not be posted", which told a player their score had failed while it was on the
  board under the name they had just been shown.

**Not run, and not runnable from here:** anything against Supabase. The PostgREST request shapes are
asserted against a fake `fetch`. There are no credentials in this checkout and none were sought.

## `GET /api/top` has no caller in the game

Worth saying plainly, because it is the difference between a board and a write-only list: nothing in
`apps/game/src` calls `LeaderboardClient.top()`. The reducer has a `leaderboard` phase, but no
action dispatches `LEADERBOARD`, and `App.tsx` renders `Results` for that phase anyway. So a player
can post a score and never see the list — the route works, is cached and is tested, and the screen
that would show it has not been built. That is a Results/App change, not an API one.

## What a hostile caller sends, and what happens

| The attempt                                    | What this service does                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A claimed score                                | Refused. The body schema is strict; `score` is not one of its two keys. The stored number always comes from `score()` over the replayed log.                                                                |
| A log that replays to a huge score             | Refused unless it is a run a player could have played. `checkLog` replays every event through the real reducer and requires the replay to reproduce the submitted log exactly.                              |
| A verdict the player never read the card for   | Replays as `must-open-the-card` and is refused. The points for a careful verdict cannot be awarded to a log that never opened the card.                                                                     |
| A run that never reached the cottage           | Refused. `checkLog` reports `complete` and this route requires it.                                                                                                                                          |
| A thousand events                              | Refused before replay: `MAX_LOG_EVENTS` is 256 against an honest run of about twenty.                                                                                                                       |
| A megabyte of JSON                             | Refused at 32 KB **as it arrives**. `content-length` is a cheap first check; the gate is a metered read, so a body that declares no length or is made of four-byte characters is cut off at the same 32 KB. |
| The same legal run, posted again               | `409 {"error":"that run is already on the board"}` with nothing written. One run is one row, under any handle. Per instance — see below.                                                                    |
| A loop writing rows as fast as it can          | Thirty writes a minute per instance, then `429` with `retry-after`. The budget is spent only on a row that is about to exist, so nonsense cannot exhaust it. Per instance — see below.                      |
| A handle that is not one of ours               | Refused by `handleSchema`, and refused again by the store immediately before the insert. Only a word pair from `packages/core`'s lists plus a two-digit number parses.                                      |
| A handle designed to break a page              | Cannot exist. The grammar is `[a-z]+-[a-z]+-[1-9][0-9]`, the game renders through Preact text nodes, and `GET /api/top` drops any row whose handle is not one the game could mint.                          |
| A body that is not JSON, or does not say it is | 400 and 415. A JSON-only endpoint cannot be reached by a plain cross-origin form post.                                                                                                                      |
| Probing for the shape of an acceptable log     | Gets `{"error":"that submission is not valid"}`. No zod issue, no field name, no database status: the detail goes to the server log, not to the caller.                                                     |

## Turning it on, in order

The table and the two variables already exist. What is left is a deploy and four checks, and the
first three take a minute each.

1. **Deploy a preview** of this branch. Nothing here needs a build step.
2. **`GET /api/top` on the preview URL.** This is the whole test of whether the two-service routing
   worked.
   - `{"entries":[]}` with `content-type: application/json` — the service is live and the table is
     empty. Go on.
   - `503 {"error":"the leaderboard is unavailable"}` — routing worked, the environment did not.
     The Vercel runtime log names the variable: `[leaderboard] not configured: SUPABASE_URL is not
set`. Values are never logged.
   - **`404`, Vercel's own NotFound page** — no function was created, and nothing of ours ran.
     This is the failure to expect first, and it is what production answers today. It is **not**
     the game's `index.html`: `{ "service": "game" }` delegates the path into the service, which
     does its own filesystem lookup against a static Vite `dist`, and there is no SPA-fallback
     rewrite anywhere in `vercel.json`.
   - `500` — the service is running and threw at cold start, which is almost certainly one of the
     two cross-root imports named above. The Vercel log has the stack.
3. **Play a run on the preview and press Post once.** "Posted to the board as …" means a row was
   written and the score on it was computed by the server. "Leaderboard unavailable right now."
   means it was not, and step 2 says why.
4. **`GET /api/top` again.** The handle from step 3 should be rank 1. If step 3 said it posted and
   this does not show it, the table is written but the read path is not — that has never happened
   here, and it would be the one thing a fake `fetch` could not have caught.

Then do the four things under "What is NOT done" below, of which **turning on Vercel's rate
limiting for `/api/*` is the one that cannot wait**: until it is on, the per-instance budget in
`src/limit.ts` is a speed bump and the board is writable in volume by anyone who can run a loop.

## What is NOT done, and must be done by hand before this is believed

Recomputing every score bounds what a row can SAY. It does not bound how many rows a caller can
write, or prove that a player played. A maximal run log can be built offline by driving the reducer
(`pnpm sim --strategy perfect` produces one), so without the three steps below the board is a
write-what-you-like list that happens to contain honest scores. `src/limit.ts` closes the cheap case
— one row per run, thirty writes a minute — but only within one instance, and Vercel runs several.

1. **Turn on rate limiting for `/api/*` in the Vercel project, and prove it on a preview.** Firewall
   → rate limiting, scoped to the `/api/` path. This is the control that spans instances, and it is
   the one thing here that cannot be done from the repository. Until it is on, treat the per-instance
   budget as a speed bump and nothing more.
2. **Make dedupe durable.** `supabase/migrations/0002_leaderboard_log_hash.sql` adds the column the
   code cannot add, with the unique index over it, and is safe to run before the code that writes
   it. It **reopens D10** rather than being a quiet migration — the column is a third one on a table
   whose decision reads "handle and score only" — so the argument on both sides, and the paragraph
   to put in front of Legal, are in `docs/DATABASE.md` under "Decision 1". The code change that goes
   with it is there too, including the one trap: do not use
   `Prefer: resolution=ignore-duplicates`, because with `return=minimal` an ignored duplicate is
   indistinguishable from a real insert and the player is told a row exists that does not.

3. **Decide the delete path (D10 already did).** `supabase/migrations/0004_leaderboard_delete_path.sql`
   ships the recommendation: no route at all, an `admin` schema PostgREST does not expose holding a
   find-then-remove-by-id pair, and `UPDATE`/`DELETE`/`TRUNCATE` revoked from `service_role` so a
   leaked key cannot erase the board. `docs/DATABASE.md`, "Decision 3", has the reasoning — the
   short version is that **a handle is not an identity**, so a player cannot identify their own row
   and neither can we, which makes this a moderation control rather than a privacy one.

4. **Set retention.** `supabase/migrations/0003_leaderboard_retention.sql` schedules it against
   D10's twelve months. Note what nobody has written down: twelve-month retention makes this a
   rolling-twelve-month board rather than an all-time one.

### Known and accepted

1. **A handle is not an identity.** Anyone can post any legal run under any mintable handle. That is
   what a leaderboard with no accounts is (decision D4), and the whole value at stake is a row on a
   list.
2. **The per-instance budget can be spent by an attacker.** Thirty writes a minute is per instance,
   so a flood can hold a given instance at `429` and the game will show "Leaderboard unavailable
   right now" to honest players on it. That failure is quiet, reversible and leaves results and the
   call to action untouched, which is the better of the two outcomes available without step 1 — the
   alternative is the same flood landing as rows on a public page.
3. **Removing a word from the handle lists hides existing rows.** `GET /api/top` drops any handle the
   game could not mint, so a word taken out of `packages/core/src/leaderboard.ts` retires every row
   already posted under it. The store over-fetches four pages so the filter falls through to real
   rows rather than serving a short page, but the rows themselves are gone from the board.
4. **The clock is the player's.** Durations come from the browser, so there is no "too fast to be
   real" floor. The table has no duration column and ranking is by score alone, so a forged clock
   buys nothing; the reducer still refuses a log whose timestamps go backwards.
5. **Content drift.** Scores are recomputed against whatever `content/game.json` the deployment
   carries. Change the scoring weights and old rows are no longer comparable to new ones, with
   nothing in the table recording which version produced them.
6. **Nothing here has been run against the live service.** There are no credentials in this
   checkout. The PostgREST request shapes (headers, `order=score.desc,created_at.asc`,
   `Prefer: return=minimal`) are asserted in tests against a fake fetch, not against Supabase. The
   first real deploy is the first real test of those.
