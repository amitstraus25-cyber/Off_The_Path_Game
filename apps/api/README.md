# `@otp/api` — the leaderboard service

Two routes behind the game, on the same origin, with no new dependencies.

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

## Vercel settings

`vercel.json` at the repository root declares this as a second service and routes `/api/*` to it:

```json
"services": {
  "game": { "root": "apps/game", "framework": "vite", "outputDirectory": "dist" },
  "api":  { "root": "apps/api", "framework": null }
},
"rewrites": [
  { "source": "/api/(.*)", "destination": { "service": "api" } },
  { "source": "/(.*)",     "destination": { "service": "game" } }
]
```

Order matters: the `/api/(.*)` rewrite must stay above the catch-all, or every request reaches the
game. The CSP is **unchanged** — `connect-src` stays `'self'` because the browser only ever calls
our own origin. Widening it would be the wrong fix for anything.

- **Node version:** pinned to `22.x` by `engines.node` in this package's `package.json` (and by
  `.nvmrc` for CI). Project Settings → Node.js Version should read 22.x and not "latest".
- **Environment variables:** the two above, on Production and Preview, marked sensitive. There is no
  `.env.example` entry for them: that file is owned elsewhere this round, which is why they are
  documented here.
- **Functions:** `api/score.ts` and `api/top.ts` are Node functions using the Web handler signature
  (`(request: Request) => Promise<Response>`), so they need no runtime types and no framework.
- **Build:** none. There is no build step and no output directory for this service; Vercel compiles
  the two functions.
- **The content file is imported from outside this service root.** `src/content.ts` imports
  `content/game.json` from the repository root — deliberately, because the recompute is only
  meaningful against the very bytes the game shipped. That import carries `with { type: 'json' }`,
  which Node 22 requires and which nothing in the test suite could have told us about (Vitest and
  Vite transform JSON imports either way; plain `node` answers `ERR_IMPORT_ATTRIBUTE_MISSING`).
  **Whether Vercel's bundler follows that import out of `apps/api` is the one thing only a preview
  deploy answers.** If it does not, `content.ts` throws at cold start, both routes 500, the game
  shows its unavailable line and play is untouched — a silent dead board, so check `GET /api/top` on
  the preview before believing the deploy.

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
2. **Make dedupe durable** by giving the table the column the code cannot add:

   ```sql
   alter table public.leaderboard add column log_hash text;
   create unique index leaderboard_log_hash_idx on public.leaderboard (log_hash);
   ```

   Then the duplicate check moves from memory into the table, and a run posted from two instances
   lands once. The column holds a SHA-256 of the run log — gameplay, not a person, and not an
   identifier — but it is a third column on a table whose decision (D10) reads "handle and score
   only", so it needs that decision reopened rather than a quiet migration. The code does **not**
   write this column today, so running the SQL early breaks nothing.

3. **Decide the delete path (D10 already did).** `docs/PLAN.md` records "manual delete endpoint,
   Legal sign-off before launch" and there is no endpoint. Shipping an unauthenticated one would be
   worse than none, and the only secret this service is allowed to read is the Supabase key, so the
   route needs either Vercel deployment protection in front of it or a new server-only variable.
   Until then, removing a row means SQL in the Supabase console.
4. **Set retention.** `created_at` exists and nothing prunes it, against D10's twelve months:

   ```sql
   select cron.schedule('leaderboard-retention', '0 3 * * *',
     $$delete from public.leaderboard where created_at < now() - interval '12 months'$$);
   ```

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
