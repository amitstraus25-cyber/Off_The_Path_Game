# `@otp/api` — the leaderboard service

> **Current state, 2026-10-22 (Phase E, leaderboard v2).** Three routes: `api/start.ts`,
> `api/score.ts` and `api/top.ts` in THIS package, the single copy. The service scores **v2**
> runs against `content/game.v2.json`; a v1 log is a 400. They are deployed through Vercel's Build
> Output API by `apps/game/scripts/vercel-output.mjs`, which reads the route list off `api/` and
> bundles each route with packages/core and the content file into self-contained CommonJS --
> Vercel compiles none of our TypeScript. The sections further down record the arrangements that
> failed first (two services, routes in the game service, routes in a repo-root `api/`); keep
> them, do not re-run them.
>
> **Post-deploy discriminators** (a GET on each route, no body, no credentials):
>
> | Request          | Mounted and loaded                  | Not mounted | Mounted, crashed on load           |
> | ---------------- | ----------------------------------- | ----------- | ---------------------------------- |
> | `GET /api/start` | **405**, `Allow: POST`              | 404         | 500 `FUNCTION_INVOCATION_FAILED`   |
> | `GET /api/score` | **405**, `Allow: POST`              | 404         | 500 `FUNCTION_INVOCATION_FAILED`   |
> | `GET /api/top`   | 200 JSON, or **503** when env unset | 404         | 500 (cannot tell env from a crash) |
>
> Then `POST /api/start` with `content-type: application/json` and body `{}`: **200**
> `{seed, token}` means the environment is set (the signing key is derived from it); **503** means
> it is not, and the game will play on its own seed with posting switched off.

Three routes behind the game, on the same origin, with no new dependencies.

**The database as an operational thing is `docs/DATABASE.md`** — the schema and why, the RLS
posture, the migrations in `supabase/migrations/`, how to rotate a key without downtime, what
happens when the free tier pauses, how to tell whether the board is actually working and what to do
when it is not. This file is the service; that one is the database.

| Route             | What it does                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/start` | Draws a seed and answers `{ seed, token }`: the seed sealed with the issue time in an HMAC-signed token. Stores nothing.                                                                        |
| `POST /api/score` | Takes `{ handle, log, token }`. Checks the token, the seed and the clock, replays the v2 log through `packages/core`, **recomputes the score** (0–100), stores it. Answers `{ handle, score }`. |
| `GET /api/top`    | Answers `{ entries: [{ rank, handle, score }] }`, highest score first and earliest first on a tie. Cached at the edge for 60 s.                                                                 |

## The run token (Phase E)

A v2 run log carries its own seed and its own timestamps, and both are client-reported: without
the token a forger could post the one seed whose deal makes their basket careful, or restamp a late
run to finish in time. So the run starts on the server.

- **`POST /api/start`** draws a 32-bit seed (`node:crypto`) and returns it with a token,
  `base64url({id, seed, issuedAt}).base64url(HMAC-SHA256)`. The id is 16 random bytes. Nothing
  about the visitor is in it, nothing is stored, no cookie is set. Same-origin only: a request a
  browser marks `sec-fetch-site` other than `same-origin` is a 403, and JSON only (415), so a
  cross-origin page cannot start a run without a preflight it fails. Its own per-instance budget,
  120 a minute, separate from the 30 writes a minute.
- **The signing key is derived**, HKDF-SHA256 over `SUPABASE_SERVICE_ROLE_KEY` with the fixed label
  `otp/run-token/v1` (`src/token.ts`). No new environment variable. Never logged, never returned.
  **Rotating the service role key invalidates every outstanding token** — at most eight minutes of
  runs, whose players see "Posting has closed" or "could not be posted".
- **`POST /api/score`** then requires, in order: a token this service signed (else 400); the log's
  seed equal to the token's (else 400); a legal v2 replay that ended (else 400); an ending of
  `grandma` or `wolf` — **a late run is not posted** (400); a claimed duration no longer than the
  time since the token was issued, plus 2 s of clock skew (else 400); and no more than **five
  minutes** off the game clock between issue and post — the title, the how-to and the reveal
  (else **410**, "posting has closed for that run"). Since a run's clock stops before 3:00, no token
  older than 8:00 can post. Finally, **neither the claimed run time nor the time since the token
  was issued may be under `MIN_RUN_MS`** (10 s, the straight walk from Purple's spawn to the door,
  derived from the map in `test/floor.test.ts`), else 400.
- **One token is one row**, per instance (409 on reuse, with this log or any other). Durable
  single use would need a column — see `docs/DATABASE.md`, Decision 1. No schema change was made.

**Why the window is five minutes and not seconds.** The reveal is the product; a tight window would
refuse exactly the player who read it. What a tight window would buy is a bound on restamping a late
run, and a forger has no reason to restamp: the token hands them the seed, `deal()` is public, and
the careful log for that seed scores 100. **The token does not stop a bot, and a bot's rows are not
harmless:** ties rank earliest first (migration 0005), so scripted 100s posted early outrank every
honest 100 posted after them, permanently. The token makes every row cost one start, at least
`MIN_RUN_MS` of real waiting, and one post inside eight minutes; makes the seed the server's; and
makes one token one row. The edge rate limit below is what bounds volume, which is why it is a
precondition for exposing the board, not a nice-to-have.

The body carries no score, and could not: `submitRunSchema` (`src/schema.ts`) is strict and
rejects any key it does not name. That is CLAUDE.md golden rule 6 — "never trust the client for leaderboard scores" —
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

**Since 2026-10-21, `vercel.json` declares TWO services**, and `/api/(.*)` is routed into this one:

```json
"services": {
  "game": { "root": "apps/game", "framework": "vite", "outputDirectory": "dist" },
  "api": { "root": "apps/api" }
},
"rewrites": [
  { "source": "/api/(.*)", "destination": { "service": "api" } },
  { "source": "/(.*)", "destination": { "service": "game" } }
]
```

The `game` service is **byte-identical** to the one-service config it replaces, so the page cannot
regress on this change: the only new things are a service and a rewrite above the catch-all. The
rewrite order is load-bearing — `/api/(.*)` must stay above `/(.*)` or every API request is served
the game. The CSP is **unchanged** — `connect-src` stays `'self'` because the browser only ever
calls our own origin. Widening it would be the wrong fix for anything.

**Why this arrangement, when this section used to record it as tried and failed.** The one-service
form was the thing that had never been measured properly, and now it has been. Production serves
`/assets/index-D8dTGUjT.css`, which is exactly the file a clean `pnpm build` of this tree produces,
and `811d2ca` ("a leaderboard a player can actually see") is the **only** commit after `9aa7968` that
touches any CSS. So the live deployment was built at or after `811d2ca` — six commits after the
one-service config landed — and today's `404` on `GET /api/score` is that config's own answer, not a
stale build's. **The one-service form is measured and dead: a service with `framework: "vite"` and
`outputDirectory: "dist"` is built as a static app, and nothing scans `apps/game/api/`.**
`apps/game/dist` has no `api` directory, which is the same fact from the other side.

The condemnation of the two-service form, by contrast, does not survive its own timeline.
`"framework": null` inside the `api` service failed schema validation and with it **every deploy
from Phase 6 (`3dc0357`) onward**; `d7908ce` removed that key at 23:52:37 and `9aa7968` deleted the
service at 00:20:49. **The valid two-service config existed for twenty-eight minutes**, inside an
evening when production was serving a build from before the leaderboard existed — and "Vercel's own
404" is exactly what that stale build returns for `/api/*`. Nobody waited for a deployment in those
twenty-eight minutes, because `9aa7968`'s own round was being written in them. The 404 that killed
the second service is indistinguishable from the 404 the six-hour outage was already producing, so
this is the first real test of the arrangement, not a repeat of a disproven one.

What the live docs say about it, read 2026-10-21 rather than remembered:

- `https://vercel.com/docs/services`: "Services are available in Beta on all plans." Not gated.
- `https://vercel.com/docs/services/config-reference`: "A service is configured like any standalone
  Vercel project, using the same build and runtime settings", and both `framework` and `runtime` are
  "detected automatically" when unset. A service rooted at `apps/api` therefore detects no framework
  — and `https://vercel.com/docs/functions/quickstart` says that "for projects without a framework,
  Vercel creates a separate function for each supported source file in the root `api/` directory",
  which is `apps/api/api/score.ts` and `top.ts` exactly.
- `https://vercel.com/docs/services/routing`: "The service receives the original request path.
  `GET /api/users` reaches `my_backend` as `/api/users`, not `/users`." The old worry that the
  service would see `/score` and miss is answered: it sees `/api/score`, which is the file.
- Same page: "Routing into a service is final. If no route matches inside the service, Vercel does
  not fall back to your other top-level rewrites." That is the mechanism of today's 404, stated by
  the platform.

**`X-OTP-Config` is in the headers block on purpose, and it is the cheapest thing in this file.**
A failed deploy and a succeeded-but-still-404 deploy answer every probe identically — `GET /` 200,
`GET /api/score` 404, both times — and that ambiguity is what has cost this project the most hours.
The protocol, per attempt: **bump the value, deploy, then `curl -sI https://off-the-path-game.vercel.app/`
and read it back before believing any `/api` probe.** Absent or the old value means the deploy did
not land or was not promoted — go and read the build log, and change nothing. The new value means
the config is live, and only then does `curl -sI .../api/score` mean anything. It is `"1"` as
shipped, and the header did not exist in production before, so for this first attempt its mere
presence is the proof.

`apps/api/api/score.ts` and `api/top.ts` are the copy this routes to, and they are the copy
`test/routes.test.ts` already executes — see the table below, which this change inverts.

### The two copies of the routes, and whether the dead one should go

**State of it, measured 2026-10-21 against the working tree.** There are two copies:

| Copy                 | Imports via                | Served?                                          | Executed by a test?                      | Typechecked by           |
| -------------------- | -------------------------- | ------------------------------------------------ | ---------------------------------------- | ------------------------ |
| `apps/api/api/*.ts`  | `../src/*.ts` (relative)   | **Yes** — the copy `/api/(.*)` is routed to      | **Yes** — `apps/api/test/routes.test.ts` | `apps/api/tsconfig.json` |
| `apps/game/api/*.ts` | `@otp/api/src/*.ts` (deep) | **No** — inside a static Vite service, unscanned | **No** — nothing imports it              | `tsconfig.api.json`      |

**This table inverted on 2026-10-21 and the inversion is the point.** With `/api/(.*)` routed into
the `api` service, the copy that ships is the copy `routes.test.ts` already executes, and the copy
with the deep `@otp/api/src/*.ts` path — where the missing `exports` map, the load-bearing `.ts`
extension and the cross-root reach all live — is the one that no longer serves traffic. "The copy
that is tested is not the copy that ships" was the standing defect of the one-service config; this
change closes it from the routing side rather than by moving a test.

`apps/game/api/*.ts` is now the dead copy. Do not delete it on the strength of one deploy: if the
`api` service turns out to produce no functions either, those two files are where the next attempt
starts, and `apps/game/tsconfig.api.json` is the only thing standing between a broken import there
and a silent dead board.

**Recommendation: delete nothing this round.** Until a deployment has answered `405` on
`GET /api/score`, both copies are evidence. What follows was written when `apps/api/api/` was the
dead copy; read it as the case for keeping it, which the routing change has only strengthened —
it is now the copy that ships _and_ the copy that is tested.

What breaks if `apps/api/api/` is deleted, exactly:

1. **`apps/api/test/routes.test.ts` stops resolving.** It imports `../api/score.ts` and
   `../api/top.ts` at lines 42–43. That file is the _only_ test anywhere that executes a route entry
   point rather than calling a handler with a fake `Deps` — the Web handler signature, the
   module-scope `process.env` read and the one real `fetch` the store is built with are exercised
   nowhere else.
2. **The 100% coverage gate loses a file it is configured to count.** `apps/api/vitest.config.ts`
   sets `coverage.include: ['src/**/*.ts', 'api/**/*.ts']`, with a comment saying leaving `api/` out
   is how a route entry point sits at 0% while the summary looks respectable. Delete the directory
   and that half of the glob matches nothing; the gate goes quiet instead of going red.
3. **And now the deployment itself.** `/api/(.*)` is routed into this service, so `apps/api/api/` is
   what answers it. Deleting it deletes the routes.

The part worth saying plainly: **the copy that is tested is now the copy that ships.** The two
differ only in their import specifiers — relative versus the `@otp/api/src/*.ts` deep path — and the
specifier is precisely where this service's known failure modes live (the missing `exports` map, the
load-bearing `.ts` extension, the cross-root reach documented in `test/cross-root.test.ts`). Routing
to the relative-import copy takes that whole class of failure out of the live path; it does not take
out `src/content.ts`'s reach for `../../../content/game.json`, which is still outside the service
root and still unproven against the platform's bundler. **If that one bites it is a `500` at cold
start with `ERR_MODULE_NOT_FOUND` in the function log, never a `404`** — so it is distinguishable
from what we have now, which is the only property that matters tonight.

**`services` is a real key, and it is Beta rather than gated.** `vercel.json`'s own schema
(<https://openapi.vercel.sh/vercel.json>, the `$schema` that file points at) defines a top-level
`services` map — service names match `^[a-z]([a-z_-]*[a-z])?$`, `root` is the only required key, and
`rewrites[].destination` may be `{ "service": "<name>" }` — so the block above is not invented. The
schema does mark it **`"private": true`** (re-verified 2026-10-21, along with the allowed
per-service keys: `root`, `framework`, `runtime`, `entrypoint`, `installCommand`, `buildCommand`,
`devCommand`, `ignoreCommand`, `outputDirectory`, `bindings`, `functions`, `headers`, `redirects`,
`rewrites`, `routes`, `cleanUrls`, `trailingSlash`, and `additionalProperties: false`). **This
section used to read `"private"` as "not on for every account", and the live docs refute it:**
`https://vercel.com/docs/services` opens "Services are available in Beta on all plans." Private in
that schema means undocumented-in-schema, not off. The same page also settles the top-level split —
`functions`, `installCommand`, `buildCommand`, `devCommand`, `ignoreCommand`, `outputDirectory` and
`framework` "are not valid at the top level" in services mode and must sit inside a service, while
headers and the public route table stay where they are, which is why the security headers have not
moved.

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

Re-measured 2026-10-21, after the one-service config had been live for hours: `GET /` still `200`
with the title `Off the Path: That's Not My Grandma`, `GET /api/top` and `GET /api/score` still
`404`. **Two cells in that table are inherited rather than re-measured, and they are the two that
need a header:** "with this file's CSP live", and "Vercel's own NotFound page" as against a static 404. Response headers and 404 bodies cannot be read from this checkout — `curl` is denied in the
sandbox and the fetch tool returns neither — so the next person at a terminal should run
`curl -sI https://off-the-path-game.vercel.app/` once and settle both, along with `X-OTP-Config`.

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
- **Functions:** `api/start.ts`, `api/score.ts` and `api/top.ts` — this package's copy is the one `/api/(.*)` now
  routes to; `apps/game/api/` holds the same pair — are Node functions using the Web handler
  signature (`(request: Request) => Promise<Response>`), so they need no runtime types and no
  framework.
- **The export SHAPE is the next thing to suspect if step 3 below answers anything but `405`.** All
  four files use a bare `export default function handler(request: Request)`. Read 2026-10-21,
  `https://vercel.com/docs/functions/functions-api-reference` documents exactly two shapes for a
  non-Next project — named method exports (`export function GET(request: Request)`) and
  `export default { fetch(request) {…} }` — and the bare default function appears in neither it nor
  the quickstart. That is not proof it is unsupported (it is the oldest shape on the platform), and
  **it cannot be the cause of a `404`**, which is why it is filed here rather than treated as the
  bug. If a mounted route misbehaves, `export default { fetch: (request) => handleScore(request,
deps) }` suits these handlers exactly, since they already branch on `request.method` internally.
  Changing it touches four files in two workspaces and belongs to whoever owns them.
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
api/start.ts     POST /api/start
src/handlers.ts  the three routes as pure functions of (Request, Deps)
src/token.ts     the run token: HKDF key, HMAC seal, open
src/schema.ts    the v2 submit body; no node: imports, so the game's tests can hold it
src/store.ts     the table, over fetch against PostgREST
src/env.ts       the two variables, and what to do when they are not there
src/deps.ts      the only place that touches process.env
src/content.ts   the shipped content/game.v2.json, through the same schema the game loads it with
src/http.ts      the response shapes and the one place headers are written
src/node-adapter.ts  Vercel's (req, res) over a web handler; reads at most 32 KB of body
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

## `GET /api/top` has a caller now — this section said otherwise until 2026-10-21

It used to read "nothing in `apps/game/src` calls `LeaderboardClient.top()`", and treat the board as
a write-only list whose screen had not been built. **That landed in `811d2ca` and the sentence is
dead.** `apps/game/src/ui/Results.tsx` imports `readTop` (line 20), calls it on mount through
`readBoard`'s effect and again at the end of every `submit`, and renders the rows into
`.otp-board__rows`; `apps/game/e2e/leaderboard.spec.ts` drives `**/api/top*` in a real browser. The
narrow old claim is still true and now irrelevant — the screen calls `readTop` directly rather than
`LeaderboardClient.top()` — so do not let it stand in for "the read half is unmounted". Both halves
of the board are wired, and both are waiting on the same thing: a function at `/api/*`.

## What a hostile caller sends, and what happens

| The attempt                                    | What this service does                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A claimed score                                | Refused. The body schema is strict; `score` is not one of its two keys. The stored number always comes from `score()` over the replayed log.                                                                                                                                                                                                                                             |
| A log that replays to a huge score             | Refused unless it is a run a player could have played. `checkLog` replays every event through the real reducer and requires the replay to reproduce the submitted log exactly.                                                                                                                                                                                                           |
| A verdict the player never read the card for   | Not refused: in v2 a verdict can be given from the conversation without opening the card, and it replays as played, a `verdict` event with no `inspected` before it. Replay never opens a card on the player's behalf (`runlog.ts`), so nothing is invented. A log that does not replay exactly is refused whatever it says about cards.                                                 |
| A run that never reached the cottage           | Refused. `checkRunLog` reports `ended` and this route requires it; a `late` ending is refused too.                                                                                                                                                                                                                                                                                       |
| A seed of the caller's choosing                | Refused. The log's seed must be the one sealed in a token this service signed.                                                                                                                                                                                                                                                                                                           |
| A log claiming more time than really passed    | Refused: the claimed duration may not exceed the time since the token was issued (plus 2 s).                                                                                                                                                                                                                                                                                             |
| A slow run restamped, or a stale token         | Refused with 410 once more than five minutes have passed off the game clock since the token was issued.                                                                                                                                                                                                                                                                                  |
| A run faster than anyone could walk it         | Refused: the claimed run time and the time since the token was issued must both reach `MIN_RUN_MS` (10 s), so every forged row costs real waiting.                                                                                                                                                                                                                                       |
| A thousand events                              | Refused before replay: `MAX_LOG_EVENTS` is 256 against an honest run of about twenty.                                                                                                                                                                                                                                                                                                    |
| A megabyte of JSON                             | Refused at 32 KB **as it arrives**. `content-length` is a cheap first check; the gate is a metered read, so a body that declares no length or is made of four-byte characters is cut off at the same 32 KB. The Node adapter (`src/node-adapter.ts`) applies the same cap before the handler is called, so the instance never buffers more than 32 KB of it; the answer is the same 413. |
| The same token, posted again                   | `409 {"error":"that run is already on the board"}` with nothing written, whatever log or handle comes with it. One token is one row, including two posts of it in flight at once: the id is reserved before the insert and released if no row results. Per instance — see below.                                                                                                         |
| A loop writing rows as fast as it can          | Thirty writes a minute per instance, then `429` with `retry-after`. The budget is spent only on a row that is about to exist, so nonsense cannot exhaust it. Per instance — see below.                                                                                                                                                                                                   |
| A handle that is not one of ours               | Refused by `handleSchema`, and refused again by the store immediately before the insert. Only a word pair from `packages/core`'s lists plus a two-digit number parses.                                                                                                                                                                                                                   |
| A handle designed to break a page              | Cannot exist. The grammar is `[a-z]+-[a-z]+-[1-9][0-9]`, the game renders through Preact text nodes, and `GET /api/top` drops any row whose handle is not one the game could mint.                                                                                                                                                                                                       |
| A body that is not JSON, or does not say it is | 400 and 415. A JSON-only endpoint cannot be reached by a plain cross-origin form post.                                                                                                                                                                                                                                                                                                   |
| Probing for the shape of an acceptable log     | Gets `{"error":"that submission is not valid"}`. No zod issue, no field name, no database status: the detail goes to the server log, not to the caller.                                                                                                                                                                                                                                  |

## Turning it on, in order

The table and the two variables already exist. What is left is a deploy and five checks. **Run them
in this order and do not skip step 2**, which is the one that has been skipped every round: four
reviewers have read a probe against a deployment that was never built.

1. **Deploy a preview** of this branch. Nothing here needs a build step. If the build fails,
   production is untouched — "a deployment on Vercel is the result of a successful build", and this
   project's own six-hour outage proved it: production went stale, not down. Read the log and stop.
2. **Prove the config is live before believing any probe.** `curl -sI <preview>/` and read
   `X-OTP-Config` back, then `echo $?` on its own line — never through a pipe, which reports the
   pipe's status. Absent or the previous value → this deployment is not the config you just wrote;
   everything below would be measuring the old one. New value → go on. Then check the deployment's
   **Resources → Functions** list (PAUL_BRIEF §5 calls it the Functions tab): empty means zero
   functions were produced, which is the whole answer in one click.
3. **`GET /api/score` on the preview URL — a GET, deliberately.** This is the discriminator, not
   `GET /api/top`.
   - **`405` with `Allow: POST`** — a function is mounted and the routing works. This is the first
     thing that has ever reached a line we wrote. Go on.
   - **`404`** — no function is mounted and nothing of ours ran; `fail()` cannot emit a 404. Stop:
     this is `vercel.json`, not the database, and nothing below can be tested. It is **not** the
     game's `index.html` — a service rewrite delegates the path into the service, which does its own
     filesystem lookup, and there is no SPA-fallback rewrite anywhere in `vercel.json`.
   - **`500`** — mounted, and threw at cold start: one of the two cross-root imports, almost
     certainly `src/content.ts`'s reach for `../../../content/game.json`. The function log has the
     module name.
   - **`503` is impossible here** and that is useful: the method check returns `405` before the
     store is ever consulted.
4. **`GET /api/top` on the preview URL.** The first request that reaches Supabase.
   - `{"entries":[]}` with `content-type: application/json` — live, and the table is empty. Go on.
   - `503 {"error":"the leaderboard is unavailable"}` — routed and running; the environment or the
     database is not. The runtime log names which: `[leaderboard] not configured: SUPABASE_URL is
not set` is a variable (set it, then **redeploy** — variables are read once per cold start),
     `select refused with 401` is a wrong or rotated key, `403` a missing grant, `404` PostgREST's
     stale schema cache, `5xx` a paused project. Values are never logged.
   - **Read the log even on a 2xx.** No `[leaderboard]` line beside a non-2xx means nothing of ours
     ran, whatever the status said.
5. **Play a run on the preview, press Post once, then `GET /api/top` again.** "Posted to the board
   as …" means a row was written and the number on it was computed by the server from the replayed
   log. The handle should come back rank 1 — but `handleTop` sets `s-maxage=60`, so wait a minute
   before concluding. If step 5 said posted and the row never appears, the write path works and the
   read path does not: the one failure a fake `fetch` could not have caught. Press Post a second
   time for `409` and "That run is already on the board." — which also proves the first write
   landed.

Then do the four things under "What is NOT done" below, of which **turning on Vercel's rate
limiting for `/api/*` is the one that cannot wait**: until it is on, the per-instance budget in
`src/limit.ts` is a speed bump and the board is writable in volume by anyone who can run a loop.

## What is NOT done, and must be done by hand before this is believed

Recomputing every score bounds what a row can SAY. It does not bound how many rows a caller can
write, or prove that a player played. A maximal run log can be built offline by driving the reducer
(`pnpm sim --strategy perfect` produces one), so without the three steps below the board is a
write-what-you-like list that happens to contain honest scores. `src/limit.ts` closes the cheap case
— one row per run, thirty writes a minute — but only within one instance, and Vercel runs several.

1. **Turn on rate limiting for `/api/*` in the Vercel project, and prove it on a preview. A hard
   precondition for exposing the board to the public.** Firewall → rate limiting, scoped to the
   `/api/` path. This is the control that spans instances, and it is the one thing here that cannot
   be done from the repository. Until it is on, treat the per-instance budget as a speed bump and
   nothing more. Tracked as an unticked box under Phase 9 E in `docs/PLAN.md`.
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
4. **The clock is half the player's.** Since Phase E a run cannot claim more time than the server
   saw, nor sit more than five minutes off the game clock, nor be faster than `MIN_RUN_MS` on
   either clock. That floor is one number for every score -- the straight walk to the door -- so a
   scripted 100 still costs only ten seconds of waiting per token, though an honest 100 must also
   meet the three holding good skills on the way. A per-score floor needs the map's distances on the server and
   is not done. Requiring a card to be opened per take is out of scope: reading is optional by
   design (GAME_DESIGN_V2), so it would refuse an honest lucky guess.
5. **Content drift.** Scores are recomputed against whatever `content/game.v2.json` the deployment
   carries. Change the scoring weights and old rows are no longer comparable to new ones, with
   nothing in the table recording which version produced them.
6. **Nothing here has been run against the live service.** There are no credentials in this
   checkout. The PostgREST request shapes (headers, `order=score.desc,created_at.asc`,
   `Prefer: return=minimal`) are asserted in tests against a fake fetch, not against Supabase. The
   first real deploy is the first real test of those.
7. **v1 rows are not comparable with v2's.** v1 scored out of 1,000, v2 out of 100. PLAN.md recorded
   the table as empty before Phase E; if any v1 rows are there, they outrank every v2 run. **This
   service deletes nothing.** Whether old rows are cleared is the client's data decision, made by
   hand in the SQL editor (`docs/DATABASE.md`, Decision 3's delete path), not by a deploy.
