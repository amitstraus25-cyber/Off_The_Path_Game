# The leaderboard database

The operational runbook for the Supabase project behind `POST /api/score` and `GET /api/top`.
Written for someone who did not build this and is looking at it at 2am.

If you have thirty seconds, read ["Is the board working?"](#is-the-board-working) and stop. If
something is broken, go to ["When it is not working"](#when-it-is-not-working) — it is a table of
symptoms, and every row names the one thing to check next.

Three things to know before you touch anything:

The service holds **no database driver**. It talks to Supabase's PostgREST over plain `fetch` in
`apps/api/src/store.ts`, with the key in two headers and never in a URL. There is no connection
pool to exhaust, no migration tool wired up, and no ORM. Migrations are SQL files in
`supabase/migrations/`, run by pasting them into the Supabase SQL editor.

The table holds **a handle and a score**. No account, no email, no cookie, no IP address raw or
hashed, no run id. That is decision D10 and it is the reason most of the questions you might
expect to have answers here do not arise. **Phase E (v2, 2026-10-22) did not change it**: the run
token `POST /api/start` issues lives in the browser and the instance's memory, never in the table,
and no migration was written. Scores are now 0 to 100 (v1's were out of 1,000), so any v1 row
left in the table outranks every v2 run; **whether old rows are cleared is the client's data
decision**, made by hand through Decision 3's delete path. No deploy deletes anything.

**The client's decision of 2026-10-22: a WORK EMAIL to post a score. Built, not switched on.**
To post, a player gives a work email and ticks a consent line whose only purpose is that Cyera may
contact them about this research. That reopens D10, so it lives in a NEW table,
`public.leaderboard_contact`, written by migration `0007` -- **not run; the client runs it** -- and
the service uses it only once `OTP_WORK_EMAIL=required` is set in Vercel. Until then
`public.leaderboard` is the whole database and everything above stays true. The design, the
paragraph for Legal and the client's three steps are [Decision 5](#decision-5--the-work-email).

**What changed on 2026-10-22 (the client round: free names, speed, the missing post).** No
migration, and the table is still two columns.

- **Names are typed now**, not minted: 3 to 16 characters, checked by `v2.checkName`
  (`packages/core/src/v2/board.ts`) in the game for a friendly message and in `POST /api/score` as
  the authority, then again in `store.ts` before the insert. The `char_length(handle) between 1 and
16` check still fits: names are counted in code points, which is what `char_length` counts. **A
  typed name can be a real person's name, so a row can now be personal data** — see Decision 3.
- **The board reads rows from `BOARD_SINCE` (2026-10-26T13:10:00Z, the client's reset for the 3:30 clock and the conversation before the card; before that 2026-10-25T22:50:00Z, the reset for rules 3, the
  Gatekeeper and the river; before it 2026-10-25T13:40:00Z, the reset for the 25-point floor) on, and only scores above 0.** From that moment every run that ends scores at least 25 and every
  ending posts, so earlier rows -- scored without the floor, wolf runs at 0 and unposted -- are a
  different ranking. (The reset before it, 2026-10-22T21:25:00Z, was for the speed bonus.) No run
  scores 0 any more, so the zeros are the old ones. Both are filters on the read; deleting the old rows is optional and
  is the human's, through Decision 3's path.
- **`POST /api/score` makes two more requests after the insert**: a `HEAD` with
  `Prefer: count=exact` for the rank (`select=score`, so no row and no id comes back) and the top-10
  read. Both are best-effort; the post succeeds without them.
- **`GET /api/top` is cached for 10 s plus 20 s stale**, down from 60 s plus 300 s. That pairing is
  why the client's post went missing: the read the game made straight after posting was the edge's
  copy from before it. See "The cache headers" below.

**Nothing in this repository has ever run against the live database.** There are no credentials in
the checkout, by design. Every request shape is asserted in tests against a fake `fetch`. The first
real deploy is the first real test of all of it, which is why the health checks below are worth
running rather than assuming.

---

## Is the board working?

One request answers it, and it is not the one people reach for. Ask `/api/score` with a `GET`:

```
curl -i https://off-the-path-game.vercel.app/api/score
```

`handleScore` answers any non-`POST` with `405` and an `Allow: POST` header before it looks at
anything else, so the status alone separates four entirely different problems:

| Status                   | What it means                                           | Go to                                                   |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| `405` with `Allow: POST` | A function exists and routing works. The service is up. | Then check `/api/top` for the database.                 |
| `404`                    | **No function is mounted at all.** Nothing of ours ran. | [Routing](#is-a-function-mounted-at-all-run-this-first) |
| `500`                    | Routed, and it threw at cold start — an import failed.  | [Cold start](#when-it-is-not-working)                   |
| `503`                    | Routed and running, environment not wired.              | [Environment](#environment-variables)                   |

`GET /api/start` is the same discriminator for the third route: `405` with `Allow: POST` when
mounted. Then `POST /api/start` with `content-type: application/json` and `{}` answers `200
{seed, token}` when the environment is set — the token's key is derived from the service role key,
so a `200` here proves that variable is present (not that it is right; `/api/top` proves that).

A `404` here is positive proof of absence: our code cannot produce one. `handleStart`,
`handleScore` and `handleTop` between them return `200`, `400`, `403`, `405`, `409`, `410`, `413`, `422`,
`415`, `429` and `503`, and nothing else. If you are looking at a `404`, the request never reached a line we wrote, and no
amount of database investigation will help.

Once that is `405`, ask the read route:

```
curl -i https://off-the-path-game.vercel.app/api/top
```

| Response                                         | What it means                                              |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `200 {"entries":[]}`, `application/json`         | Live. The table is reachable and empty.                    |
| `200 {"entries":[…]}`                            | Live, with rows. Done.                                     |
| `503 {"error":"the leaderboard is unavailable"}` | Routed, but the store is `null` or the database refused.   |
| `500`                                            | Threw at cold start. Almost certainly a cross-root import. |

The `503` is the interesting one, because it is the same answer for "the environment variables are
missing" and "Supabase said no". The Vercel runtime log distinguishes them: `src/deps.ts` logs
`[leaderboard] not configured: SUPABASE_URL is not set` for the first, and `src/handlers.ts` logs
`could not read the board: select refused with 401` for the second. **Variable names and status
codes are logged; values never are.**

---

## The schema, and why each line of it

```sql
create table public.leaderboard (
  id         bigint      primary key generated always as identity,
  handle     text        not null check (char_length(handle) between 1 and 16),
  score      integer     not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index leaderboard_rank_idx on public.leaderboard (score desc, created_at asc);
alter table public.leaderboard enable row level security;
revoke all on public.leaderboard from anon, authenticated;
```

`supabase/migrations/0001_leaderboard_baseline.sql` is this, written idempotently, so that the
repository and the database agree and a fresh project can be brought up in one paste. Running it
against the live project changes nothing; its verification query prints the actual shape so you can
see whether anything has drifted.

**`handle` is 16 characters, and since 2026-10-22 that is a typed name's limit too**
(`NAME_MAX_LENGTH` is `HANDLE_MAX_LENGTH`, counted in code points as `char_length` counts them;
`test/v2/board.test.ts` holds sixteen astral-plane letters to it). The longest handle the game can SUGGEST is
`alert-bellows-99` — five characters, seven characters, two hyphens, two digits. A six-letter first
word or an eight-letter second word added to the lists in `packages/core/src/leaderboard.ts` would
produce a handle the table refuses, which the player would meet as "Leaderboard unavailable right
now" after being shown a name. `packages/core/test/leaderboard.test.ts` walks all 1,024 word pairs
against that limit, so the suite reddens instead. **That test is load-bearing. Do not let anyone
tidy it away.**

**`score` cannot be violated from the route.** Every `points` field in the content schema is
`int().min(0)` and `store.ts` re-checks `Number.isInteger(score) && score >= 0` before the network.
The check is the last statement of the invariant, not a live defence.

**`created_at` is transaction start time, not statement time.** Two rows written in the same instant
can share it to the microsecond. That is why `(score desc, created_at asc)` is not a total order,
and why [Decision 4](#decision-4--the-read-query) exists.

**The index matches the query exactly, including null ordering.** Postgres defaults `desc` to NULLS
FIRST and `asc` to NULLS LAST, which is what an `ORDER BY` naming no nulls option gets. Adding
`nullslast` to the PostgREST query — a tempting "safety" edit — would change the sort expression and
stop this index matching it. Both columns are `not null`; there are no nulls to place.

### Row-level security, and why there are deliberately no policies

RLS is on and **no policy exists**. `anon` and `authenticated` match nothing, so they can do
nothing. The only key that reads or writes is the service role key, which carries Postgres's
`BYPASSRLS` attribute and lives in a server environment no visitor sees.

The `revoke all ... from anon, authenticated` on top of that is not redundant, and the reason is the
failure mode rather than the access. **An RLS-only table answers a wrong-key `SELECT` with
`200 []`.** We would have served an empty board forever, with nothing in any log and no symptom
except a page that looked quiet. With the grant revoked, the same request is `42501
insufficient_privilege`, which PostgREST returns as 401 or 403, which `store.ts` turns into a `503`
with the status in the Vercel log. **Every wrong-key path is loud.** That is worth more than it
looks and it is the single best decision in this schema.

Two traps around it:

RLS is `enable`d, **not `force`d**, on purpose. Forcing it would apply RLS to the table owner too,
which silently breaks the retention job (it runs as the scheduling role) and the admin functions.
Symptom: retention deletes zero rows every night and nothing reports it.

Privilege is not the same as RLS bypass. A role with `BYPASSRLS` and no `GRANT` still gets `42501`.
If someone runs a broad `revoke all on public.leaderboard from public` or sweeps `service_role` up
in a tidy-up, every call 401s and the board looks "down" with the table perfectly intact.

### Who may do what

| Role               | On `public.leaderboard`         | Why                                                     |
| ------------------ | ------------------------------- | ------------------------------------------------------- |
| `anon`             | nothing                         | Revoked, and no policy. A browser key could do nothing. |
| `authenticated`    | nothing                         | Same. There are no accounts in this product.            |
| `service_role`     | `SELECT`, `INSERT` — after 0004 | Exactly what `store.ts` issues: one GET, one POST.      |
| owner (`postgres`) | everything, from the SQL editor | Retention, admin functions, migrations.                 |

On `public.leaderboard_contact` (after `0007`): `anon`, `authenticated` and **`service_role`**
hold **nothing**. The service writes it only by executing `public.leaderboard_post_with_contact`,
which runs as the owner; it cannot select, update or delete a single address. The owner reads it in
the SQL editor.

`supabase/migrations/0004_leaderboard_delete_path.sql` takes `UPDATE`, `DELETE` and `TRUNCATE` away
from `service_role`. The service has never used them and no route could. The point is that a leaked
`SUPABASE_SERVICE_ROLE_KEY` can then add junk rows — which rate limiting and Decision 1 bound — but
cannot wipe or rewrite the board. That is the difference between an incident and a disaster.

---

## Environment variables

Two secrets, both already on Production and Preview, both marked sensitive -- and one flag, not a
secret and **not set yet**: `OTP_WORK_EMAIL`, which turns the work email on when it is exactly
`required` ([Decision 5](#decision-5--the-work-email)). It touches no credential.

| Variable                    | Read by                           | Used for                                                       |
| --------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`              | `apps/api/src/deps.ts` → `env.ts` | The project origin, `https://<ref>.supabase.co`.               |
| `SUPABASE_SERVICE_ROLE_KEY` | the same                          | Sent as both the `apikey` and `Authorization: Bearer` headers. |

`src/deps.ts` is the only file in the service that touches `process.env`. Nothing else is read — not
`POSTGRES_*` (that would need a driver this service does not want), and **never anything prefixed
`NEXT_PUBLIC_`**, which is shipped to browsers by convention and so is a secret wearing a safe name.

The same value goes in both headers, and that is load-bearing rather than lazy. Supabase requires
`apikey` and does not make it configurable. For a legacy `service_role` JWT, both headers carrying
the JWT is the standard pattern. For the newer `sb_secret_` format Supabase no longer accepts a
secret key in `Authorization` **except** when the value matches `apikey` — which is exactly what we
send. Giving the two headers different values, or dropping `apikey`, breaks the newer format.

The key travels in headers only. PostgREST also accepts `?apikey=`, and this service never uses it,
because a key in a query string is a key in every access log and referrer on the way.
`apps/api/test/store.test.ts` asserts no request URL contains it and no response body does either.

### Rotating the key without downtime

The honest answer is that **you cannot, quite** — there is a window, and the job is to make it
seconds rather than hours.

Supabase's service role key is a single credential with no overlap period: generating a new one
invalidates the old one. There is no "two valid keys" state to roll through. So:

1. **Do it from the Vercel side first, in a preview.** Set `SUPABASE_SERVICE_ROLE_KEY` on _Preview_
   only, deploy a preview, and confirm `GET /api/top` on it returns `application/json`. This proves
   the new key works before Production depends on it. Skipping this is how a rotation becomes an
   outage.
2. **Rotate in Supabase** (Settings → API → service role key), then **immediately** update the
   Production environment variable in Vercel.
3. **Redeploy Production.** Vercel environment variables are read at function cold start, so
   existing warm instances keep using the old key until they are recycled. Changing the variable
   without a redeploy leaves a mix of instances, some of which 401 — which players see as an
   intermittent "Leaderboard unavailable right now" that nobody can reproduce.
4. **Verify**, with the ladder at the top of this document. `405` then `200 {"entries":…}`.

**Rotating also invalidates every run token outstanding at that moment**, because the signing key
is derived from this one (`apps/api/src/token.ts`). Tokens live at most eight minutes, so the cost is
the runs in flight: their posts answer 400 and the player reads "That run could not be posted."

Between step 2 and the end of step 3 every write fails, every player sees "Leaderboard unavailable
right now", and the only signal anywhere is one line in the Vercel log. Results and the call to
action are untouched, so the damage is bounded — but do it at a quiet hour, not at launch.

**Write this down as a runbook step with an owner.** The failure mode of forgetting half of it is
total and silent.

---

## The migrations

Files in `supabase/migrations/`, run by pasting into the Supabase SQL editor. Each one states at the
top what it does, why, whether it is safe on a table that already has rows, and how to reverse it.
There is no migration runner wired into this project and none is proposed: eight files over the life
of a marketing asset do not earn a tool.

| File                                 | Decision | Safe to run now?                                                                                                               |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0001_leaderboard_baseline.sql`      | —        | **Yes.** Idempotent; changes nothing live.                                                                                     |
| `0002_leaderboard_log_hash.sql`      | 1        | **Only after D10 is reopened.** See below.                                                                                     |
| `0003_leaderboard_retention.sql`     | 2        | **Yes.** Implements a policy already decided.                                                                                  |
| `0004_leaderboard_delete_path.sql`   | 3        | **Yes.** Changes no row.                                                                                                       |
| `0005_leaderboard_rank_tiebreak.sql` | 4        | **Yes, and optional.** Pair with the code change.                                                                              |
| `0006_clear_v1_rows.sql`             | —        | **Client's call.** Deletes the v1 rows for good.                                                                               |
| `0007_leaderboard_work_email.sql`    | 5        | **Only after Legal signs off.** Then set the flag.                                                                             |
| `0008_clear_pre_rules3_rows.sql`     | —        | **Client's call (made 2026-10-26).** Deletes the rows before rules 3 for good, keeping any with a work email. Supersedes 0006. |

Run them in order. `0001` first, always — it is also the drift check.

---

## Decision 1 — dedupe

> **Updated 2026-10-22, Phase E.** The in-memory dedupe key is now the **run token's id**, not a
> hash of the log: one token is one row (`409` on reuse), which also stops one token carrying many
> different legal logs for its seed. The id is **reserved before the insert** (`RecentRuns.claim`)
> and released if the insert fails or the write budget sheds it, so two concurrent posts of one
> token cannot both write a row. It is still per instance. If durable single use is ever
> wanted, the column `0002` proposes should hold a hash of the token id rather than of the log —
> the token id is random and says even less than gameplay does — and the same D10 argument below
> applies unchanged. **No migration was written for it this round and none is needed to ship.**
> The text below predates v2 and is kept as the argument.

**The question:** nothing stops the same run being posted twice, or a script posting a thousand
rows. The proposal on file is a `log_hash` column with a unique index. D10 reads "handle and score
only", so a third column reopens that decision rather than being a quiet migration.

**What is true today.** Dedupe lives in `apps/api/src/limit.ts` as a `Set` in module scope. It is
per instance and Vercel runs several, so the same run posted twice lands twice whenever the two
requests reach different instances. This is not hypothetical: the Post button re-enables on success,
so posting twice is a click rather than an attack, and a timed-out insert that nevertheless
committed makes a retry likely. The table cannot prevent any of it, because nothing in the table
identifies a run.

### The case for

The control that is already documented is not real. `apps/api/README.md`'s hostile-caller table says
"One run is one row, under any handle" and then qualifies it with "per instance". A data security
company shipping a public asset whose own documentation says the control is partial is a worse
position than asking Legal one question.

The value is gameplay, not a person. It is the SHA-256 that `limit.ts` already computes over the run
log — verdicts, questions asked, timestamps. There is no IP in it raw or hashed, no cookie, no
account, no user agent, and not the handle. It is computed on every request today; the only question
is whether it may be persisted.

It is reversible in one statement, and it is safe to run before the code that writes it.

### The case against

**D10's sentence is an asset.** "We store a handle and a score" is something a privacy page can
print and a reviewer can check in five seconds. "We store a handle, a score, and a cryptographic
hash of your gameplay" is not, even though the second is harmless. Simplicity of claim has real
value for a research asset whose entire point is asking what a system actually does.

**It is formally a correlation key.** Two rows with the same hash are the same run — that is the
whole purpose, and it also means the column links rows. It cannot be reversed to a person, and
nothing in this system retains a run log after the player leaves the page, so nobody holds the other
half. That is an argument, not a ruling, and Legal makes rulings.

**There is a cheaper control that stores nothing.** Vercel firewall rate limiting on `/api/*` is
already step 1 of the README's list and is required regardless. It bounds volume without a schema
change. It does not stop one honest double-post landing twice, which the in-memory set already
catches in the common case.

**An alternative was considered and rejected.** A side table holding only hashes, with no handle, no
score and no foreign key, would keep D10's sentence about `leaderboard` literally true. It does not
survive scrutiny: both tables would need `created_at` for retention, and correlating two rows by
timestamp is trivial. The privacy gain is mostly presentational, and it costs an RPC function and a
transaction to keep the two inserts atomic. Not worth it.

### Recommendation

**Run `0002`, after someone with the authority to reopen D10 has said yes.** Here is the paragraph
to put in front of them — **this is a draft for Legal review, not an approved description, and it
needs sign-off before it is used anywhere:**

> We propose adding one column to the leaderboard table: a SHA-256 hash of the gameplay event log
> for that run (choices made and their timestamps). It contains no identifier — no name, email, IP
> address, cookie or account — and cannot be reversed to a person. Its only purpose is to let the
> database refuse the same run twice, which our current defence does only partially. The game
> retains no run log after the player closes the page, so nothing outside the player's own browser
> can be matched against this value. Retention is the same twelve months as the rest of the row.

Then the code change, which is **not applied** — `apps/api/src/store.ts` and `handlers.ts` belong to
another owner this round:

```diff
--- a/apps/api/src/store.ts
+++ b/apps/api/src/store.ts
@@
 export interface LeaderboardRow {
   handle: string;
   score: number;
 }
+
+/** A row on the way IN. `logHash` identifies the RUN, never the player. */
+export interface NewRow extends LeaderboardRow {
+  logHash: string;
+}
+
+/**
+ * The table already holds this run.
+ *
+ * PostgREST maps 23505 unique_violation to HTTP 409, and on THIS table a 409 can mean nothing
+ * else: `leaderboard_log_hash_key` is the only unique constraint and there are no foreign keys.
+ * Add a second unique constraint and this inference stops holding -- read PostgREST's `code`
+ * field then, not the status.
+ */
+export class DuplicateRun extends Error {}
@@
-  add(row: LeaderboardRow): Promise<void>;
+  add(row: NewRow): Promise<void>;
@@
-    async add({ handle, score }) {
+    async add({ handle, score, logHash }) {
@@
-        body: JSON.stringify([{ handle, score }]),
+        body: JSON.stringify([{ handle, score, log_hash: logHash }]),
         signal: AbortSignal.timeout(TIMEOUT_MS),
       });
-      if (!res.ok) throw new Error(`insert refused with ${res.status}`);
+      if (res.status === 409) throw new DuplicateRun('that run is already on the board');
+      if (!res.ok) throw new Error(`insert refused with ${res.status}`);
     },
```

```diff
--- a/apps/api/src/handlers.ts
+++ b/apps/api/src/handlers.ts
@@
-import type { LeaderboardStore } from './store.ts';
+import { DuplicateRun } from './store.ts';
+import type { LeaderboardStore } from './store.ts';
@@
   try {
     await deps.store.add({ handle: parsed.data.handle, score: total });
   } catch (err) {
+    /*
+     * The table's own dedupe, read out as the sentence the per-instance one already produces.
+     * The game maps 409 to `leaderboardAlready` -- "That run is already on the board." -- so
+     * making the durable control answer 409 needs no change on the client at all.
+     */
+    if (err instanceof DuplicateRun) {
+      deps.recent.remember(print);
+      note('refused a run the table already holds');
+      return fail(409, 'that run is already on the board');
+    }
     note(`could not store a score: ${err instanceof Error ? err.message : 'unknown error'}`);
     return fail(503, UNAVAILABLE);
   }
```

Both files run a 100% branch gate, so each new branch needs a test or `pnpm test` goes red.

**Do not reach for `?on_conflict=log_hash` with `Prefer: resolution=ignore-duplicates`.** With
`return=minimal` an ignored duplicate is a `201` with an empty body, identical to a real insert — so
the player is told "Posted to the board as brave-lantern-42" for a row that was already there, and
the duplicate becomes invisible to us as well as to them. Letting the unique violation surface as a
409 produces the right sentence for free.

---

## Decision 2 — retention

**The question:** twelve months was decided in D10, `created_at` exists, and nothing prunes it.

There is nothing to argue here — it is a decided policy that was never implemented, which for a data
security company is a claim the database contradicts.
`supabase/migrations/0003_leaderboard_retention.sql` schedules a nightly `pg_cron` job at 03:17 UTC
deleting rows older than twelve months. **Recommendation: run it.**

Four things the migration says that are worth repeating here:

**Twelve-month retention makes this a rolling-twelve-month board, not an all-time board.** A top
score set thirteen months ago disappears. That is the correct reading of D10 and almost certainly
what was intended, but nobody has written it down. No shipped string calls the board "all time"
today, and nothing in the game calls `top()` at all — but if a board screen is ever built, it must
not be labelled "all time".

**The job runs as the scheduling role, not `service_role`.** That is what lets `0004` revoke
`DELETE` from the service key without breaking retention, and it is what forcing RLS would break.

**A paused project runs no cron, and that is fine.** A paused project also accepts no rows, so the
backlog does not grow while it sleeps and the first tick after it wakes catches up.

**pg_cron must be enabled first**, from Database → Extensions. Confirm it is available on your plan.
If it is not, retention becomes a quarterly statement run by hand, and that reminder needs a named
owner — an unowned quarterly task is a retention policy that exists only in a document, which is
where this one started.

---

## Decision 3 — the delete path

**The question:** someone will ask for a row to be removed. There is no authenticated route and the
only secret the service may read is the Supabase key.

**Changed 2026-10-22, and it changes the policy: names are typed now, so a row can carry a real
person's name.** A row reading `Amit Straus` with a score is plausibly personal data, whatever the
table does not hold, so a takedown request for one's own name is now a privacy request as well as a
courtesy: honour it, delete every row carrying exactly that name (`delete_leaderboard_row` one id at
a time), and do not ask the requester to prove which run was theirs -- nobody can. The privacy line
on Results should tell players the board is public and suggest a nickname; that copy is the UI's
and goes to Legal with the rest (`docs/COPY_REVIEW.md`). The paragraphs below were written for
minted handles and still hold for those.

**The finding that should shape the policy: a handle is not an identity, so a player cannot identify
their own row and neither can we.** Handles are minted at random from two word lists and nobody
records who got which, so many different players will hold `brave-lantern-42` over the board's life.
On top of that, `POST /api/score` answers `{handle, score}` and never returns the row id — `store.ts`
sends `Prefer: return=minimal`, so the generated id never leaves the database.

That cuts two ways at once. A takedown request arrives as a handle and perhaps a score, which may
match several rows belonging to several people; deleting by handle alone over-deletes other people's
entries. And precisely _because_ no row can be tied to a person, there is no erasure obligation
attached to a specific row — a handle and a score with no account, email, cookie or IP is not
personal data, which is the entire reason D10 was written the way it was.

**So the delete path is a moderation control, not a privacy control.** Treat a request as a
courtesy, scope it as narrowly as the requester can describe, and do not promise a clean match.

### The options

**An authenticated delete route.** Needs a new server-only secret, with its own rotation burden, in
front of a `DELETE` reachable from the internet, to serve a handful of requests a year. Strictly
worse than the alternatives.

**Vercel deployment protection in front of a delete route.** Protection is per-deployment rather
than per-path, so turning it on to guard one route would also gate the public game. Not viable as
stated.

**SQL in the Supabase console** — the status quo. No new attack surface, no new secret, and the
access control is the dashboard's, which already exists and is already audited. The real risk is not
access: it is a hand-written `DELETE` against a live table at 2am, where `where handle = '…'` quietly
removes four people's rows instead of one.

### Recommendation

**Keep the delete path in the SQL editor, and make the SQL editor safe.** That is what
`supabase/migrations/0004_leaderboard_delete_path.sql` does: an `admin` schema (not `public`, so
PostgREST does not expose it) holding `admin.leaderboard_find` — run first, always, to see how many
rows a request actually matches — and `admin.leaderboard_remove(id)`, which takes one id, has no
bulk form, and returns the row it deleted so the operator can paste it into the ticket.

The missing bulk form is the feature. `delete ... where handle = $1` is the mistake the function
exists to make impossible to type by accident.

Two notes for whoever runs it. There is deliberately no audit table — a row recording the handle and
score of a deleted entry _is_ the deleted entry. And the board is edge-cached for 60 seconds with up
to five minutes of `stale-while-revalidate`, so a removed row can still be served for about five
minutes; say so in the ticket rather than letting someone re-report it.

---

## Decision 4 — the read query

**The question:** `GET /api/top` is the hot path on a marketing page. Does the index serve it, what
should the plan be, and are the cache headers right?

### The index serves it

The read is `select handle, score ... order by score desc, created_at asc limit <window>`, where
`window` is `min(limit * 4, 100)`. `leaderboard_rank_idx (score desc, created_at asc)` matches that
sort column for column including null ordering, so the plan is an Index Scan with no Sort node above
it. **The existing index is correct and no change is required for correctness.**

It is not an Index-Only Scan, because `handle` is not in the index and each entry needs a heap
visit. Adding `include (handle)` would make it index-only and is **not** recommended: it widens
every entry, adds write amplification on the insert path, and only pays off once a vacuum has set
the visibility map. A hundred heap fetches behind a 60-second edge cache is not worth an index.

**On an almost-empty table you will see `Seq Scan` + `Sort`, and that is correct.** Below a few
hundred rows Postgres reads the whole table because it genuinely is cheaper. Judge the plan on
realistic volume or not at all; this has sent people off to fix an index that was never broken.

### The sort is not a total order

`created_at` defaults to `now()` — transaction start — so two players finishing in the same instant
can share it to the microsecond. Postgres is then free to return them in either order, and because
`handleTop` assigns rank by array position, their two ranks swap every time the 60-second cache
refreshes. Nothing is corrupt and nobody loses a score; the board just disagrees with itself between
refreshes, on a public page, for a company that sells certainty about data.

One word fixes it, in `apps/api/src/store.ts` — **not applied, another owner's file:**

```diff
--- a/apps/api/src/store.ts
+++ b/apps/api/src/store.ts
@@
       const query = new URLSearchParams({
         select: 'handle,score',
-        order: 'score.desc,created_at.asc',
+        // `id.asc` last, as the total order the first two columns are not. `created_at` is
+        // `now()` -- transaction start -- so two players finishing in the same instant can share
+        // a timestamp, and without a tiebreak their ranks swap every time the 60s edge cache
+        // refreshes. The identity column is the one thing that cannot tie or be null.
+        order: 'score.desc,created_at.asc,id.asc',
         limit: String(window),
       });
```

The two tests that assert this parameter (`test/routes.test.ts`, `test/top.test.ts`) use
`toContain`, so they stay green. `supabase/migrations/0005_leaderboard_rank_tiebreak.sql` is the
database half: it widens the index to `(score desc, created_at asc, id asc)` so the plan stays a
pure Index Scan. **It is optional** — without it Postgres answers with an Incremental Sort on top of
the existing index, which at a limit of 100 over ties of size one or two is free. Make the code
change; run the index change when you feel like it.

### The cache headers, and the post that went missing behind them

`GET /api/top` returns `public, max-age=0, s-maxage=10, stale-while-revalidate=20` (`TOP_CACHE` in
`handlers.ts`), and `fail()` sets `no-store`. Browsers do not cache, the edge serves at most one
origin hit per ten seconds per region, and no visitor ever sees a board more than 30 s old.

**Until 2026-10-22 it was `s-maxage=60, stale-while-revalidate=300`, and that is the root cause of
the client's "I posted and I don't see my score".** Results reads the board when it opens and again
the moment the post answers. The first read filled (or found) the edge copy; the second, seconds
later, was served that same copy from before the post -- and under stale-while-revalidate a copy up
to six minutes old. The browser's `cache: 'no-store'` does not reach past the CDN. The post had
written the row (it answered "Posted to the board as swift-apron-51"); the board simply had not
been asked. None of the other suspects held: `swift` and `apron` are both on the word lists, the
post was after `V2_LAUNCH`, a 0 was neither refused nor ordered out (`warm-candle-17` at 0 was the
row on show), and two rows are far inside every limit window.

The fix is two halves. `POST /api/score` is never cached, so it now answers with the row's rank
(counted straight after the insert) and the top ten read from the table, and the game lays that
over any board read that has not caught up (`withYourRow`, `apps/game/src/net/leaderboard.ts`),
marking the row as the player's -- `confirmed` when a read holds it, `pending` when none has yet.
And the cache is short enough that everyone else sees it within half a minute. The trade is a few
more origin reads per minute per region, which a table this size does not notice.

**The caveat: the edge cache key includes the entire query string.** `?limit=10` and `?limit=25` are
separate entries, so legitimate traffic can already produce up to 26 distinct keys — and arbitrary
junk parameters produce unbounded ones, each a miss that reaches the function and Postgres. The edge
cache can therefore be bypassed at will by anyone with a loop. This is not fixable in our code,
because the cache key is Vercel's and `topLimit` never sees it.

The control is **Vercel firewall rate limiting on `/api/*`**, which is already the top item on
`apps/api/README.md`'s list and the one thing there that cannot be done from the repository. Worth
knowing that it protects the read path and not only the write path. If you want normal traffic to
share a single cache entry as well, serve a fixed page size and let the client slice — a suggestion,
not a demand, and it is an API contract change.

One dashboard value to confirm while you are there: **Settings → API → Max rows** must be at or above 100. `store.ts` asks for up to 100 rows per read; if the project setting were lower, PostgREST
returns fewer rows with a `200`, and our code reads that as a short board rather than an error.

---

## Decision 5 — the work email

**The question, decided by the client in chat on 2026-10-22:** to post a score, a player must give a
**work** email and tick a consent line whose only purpose is that Cyera may contact them about this
research. Personal and disposable providers are refused. This reverses D4 ("handle only, no email
field") and reopens D10 ("handle and score only").

### What is built

- **A new table, not a new column.** `public.leaderboard` is unchanged -- still a handle and a
  score -- and `GET /api/top` still reads only it. Addresses go in `public.leaderboard_contact`:
  `id`, `leaderboard_id` (foreign key to the score row, unique, `on delete cascade`), `email`
  (normalised: trimmed, lower case, at most 254), `consent_version`, `consented_at`.
- **One function writes both rows in one transaction.**
  `public.leaderboard_post_with_contact(handle, score, email, consent_version)`, `security definer`,
  `search_path = ''`, returning `true` and nothing about the rows. If the contact insert fails, the
  score insert is rolled back: there is never a score on the board without the email that was
  required to post it. The migration's verification block proves this in the database itself.
- **The service cannot read it.** RLS on with no policies, as on `leaderboard`, and -- unlike
  `leaderboard` -- every privilege revoked from `service_role` too. Execute on the function is the
  service role's only access. A leaked service key can post junk through the function (rate
  limiting bounds that) and cannot read one address.
- **Never out of the service.** No route returns an address; no refusal repeats it; a failed write
  is logged by SQLSTATE code only. `apps/api/README.md`, "Work email", has the request-side detail.
- **Retention: twelve months from consent**, nightly at 03:23 UTC (`leaderboard-contact-retention`),
  and a contact row also goes when its score row goes (0003's retention, or a takedown).
- **The flag.** `OTP_WORK_EMAIL=required` in Vercel. Off by default; off is today's service.

### The consent, and its versions

Every stored address records **which wording** the player agreed to. The version is read from the
server's own copy of `content/game.v2.json` (`ui.contact.consentVersion`), never from the request.
The words a version names never change; a change of words is a new version, added here and in core's
`test/v2/contact.test.ts`, which fails until both agree.

| `consent_version`     | The words beside the checkbox               | Since                     |
| --------------------- | ------------------------------------------- | ------------------------- |
| `research-contact-v1` | "Cyera may contact me about this research." | 2026-10-22 (not yet live) |

### The paragraph for Legal

**A draft for Legal review, not an approved description; it needs sign-off before it is used
anywhere:**

> To post a score to the public leaderboard of the Off the Path game, a player will be asked for a
> work email address and to tick "Cyera may contact me about this research." Personal email
> providers are refused. The address is stored separately from the leaderboard, linked to the one
> score it was given with, together with the consent wording's version and the time of consent. It
> is never displayed, never returned by the game's service, and never written to logs; the service
> that writes it cannot read it back, and only database administrators can. Its only use is
> contacting the player about this research. It is deleted twelve months after consent, or when
> its score is removed, or on request. The board itself continues to show a name and a score only.

What Legal is asked to decide: that this purpose and wording are sufficient for the jurisdictions
the page serves; the twelve months; and who, by name, may read the table and export from it.

### Deleting an address, and reading the list

**An address is an identity**, which a handle is not, so the reasoning in Decision 3 does not carry
over: a request to delete "my email" is a privacy request, honoured in full, for every row carrying
it, without asking which run was theirs.

```sql
select * from admin.leaderboard_contact_find('Jane.Doe@acme.com');   -- normalised for you
select * from admin.leaderboard_contact_remove(1234);                 -- one row, by id
select * from admin.leaderboard_remove(5678);  -- also the score, if they ask: the cascade takes the contact
```

Record ids and timestamps in the ticket, never the address. The people the consent covers read the
list in the SQL editor as the owner (`0007` prints the query). **Any copy taken out of this table --
a CRM import, a spreadsheet -- is outside every control here**, its retention and deletion
included; whoever exports owns that.

### Turning it on -- the client's three steps, in this order

1. **Run `0007`** in the SQL editor (pg_cron enabled first), and its verification block.
2. **Get Legal's sign-off** on the paragraph above, the consent wording and the retention.
3. **Set `OTP_WORK_EMAIL=required`** in Vercel (Production and Preview) and redeploy. Then
   `POST /api/start` answers `"emailRequired":true` and Results asks for the address.

Step 3 before step 1 makes every post answer 503 (`PGRST202`, function not found, in the log); unset
the variable and redeploy to undo. Nothing is stored in that state.

---

## When the free tier pauses

Supabase pauses a free-tier project after roughly a week without activity. **A research page nobody
plays for a week is exactly that, so for this game paused is the expected steady state rather than
an edge case.**

The good news is that the game degrades correctly. Whatever a paused endpoint returns — a 5xx, a
platform error page, or no DNS at all — it is not a 2xx, so `store.ts` throws, the route answers
`503`, and the player reads "Leaderboard unavailable right now." with results and the "Read the
Research" call to action untouched.

The cost is that **every score posted while paused is lost outright.** No retry, no queue, no second
chance; the run log is gone when the player leaves the page. Unpausing is a manual click in the
Supabase dashboard, nothing in Vercel does it, and nothing in this repository notices — `note()`
writes one line into a Vercel log nobody reads.

Two honest options:

**Supabase Pro.** The project never pauses. This is the only option that needs no verification, and
for a public asset carrying a company's name it is the one to pick. (Pricing is Supabase's and
changes; check it rather than quoting a figure from here. Budget approval is not mine to give.)

**Keep it awake.** A once-a-day request that reaches the database. `GET /api/top` is edge-cached for
only 60 seconds, so a daily Vercel Cron hit does reach the function and the table. **I would not
promise this works** until someone has watched a project survive eight days on it — whether Supabase
counts a PostgREST read against the pause clock is not something a checkout can answer. There is a
free variant worth testing first: the retention job from `0003` already touches the database nightly
from inside Postgres. If _that_ counts as activity, retention and keep-alive are the same job and
this problem costs nothing. One eight-day observation settles it.

Whichever you pick, **put a check on the board**: one scheduled request asserting that `GET /api/top`
returns `200` with `content-type: application/json`, alerting a named person when it does not. Today
a dead board is silent by design, and that design was chosen when the board not existing was the
normal case.

---

## When it is not working

| Symptom                                          | Most likely cause                                                        | What to do                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/score` → `404`                         | No function is mounted. Routing, not the database.                       | See [the routing note](#is-a-function-mounted-at-all-run-this-first). Nothing here will help until this is a `405`. |
| `GET /api/score` → `500`                         | Threw at cold start: a cross-root import did not survive bundling.       | Vercel function log has the stack. Suspect `content/game.json` or the `@otp/core` symlink.                          |
| `/api/top` → `503`, log says `not configured: …` | The named environment variable is unset on that environment.             | Set it in Vercel, **then redeploy** — variables are read at cold start.                                             |
| `/api/top` → `503`, log says `refused with 401`  | The key is wrong, rotated, or is the anon key.                           | Confirm `SUPABASE_SERVICE_ROLE_KEY` holds the service role key. An anon key here 401s on every call.                |
| `/api/top` → `503`, log says `refused with 403`  | The key is valid but the grant is gone.                                  | Run `0001`'s verification query. Look for a `revoke` that swept up `service_role`.                                  |
| `/api/top` → `503`, log says `refused with 404`  | PostgREST's schema cache does not know the table.                        | Reload the schema cache in the Supabase dashboard. Easy to confuse with Vercel's 404 — read the function log.       |
| `/api/top` → `503`, log says `refused with 5xx`  | The project is paused, or Supabase is having a day.                      | Check the Supabase dashboard. See [pausing](#when-the-free-tier-pauses).                                            |
| `/api/top` → `503`, "came back in a shape…"      | Something other than PostgREST answered — a gateway or interstitial.     | Check `SUPABASE_URL` points at the right project and nothing is proxying it.                                        |
| Posts succeed, board stays empty                 | The write path works and the read path does not. Has never happened.     | A fake `fetch` could not have caught this. Check the handle filter and `Max rows`.                                  |
| A score is on the board twice                    | Per-instance dedupe, working as built.                                   | [Decision 1](#decision-1--dedupe).                                                                                  |
| Two ranks swap on refresh                        | The sort is not a total order.                                           | [Decision 4](#decision-4--the-read-query).                                                                          |
| The board is short, or a handle vanished         | A word was removed from `HANDLE_FIRST_WORDS` / `HANDLE_SECOND_WORDS`.    | See below. Put the word back.                                                                                       |
| Retention deletes nothing, every night           | RLS was changed to `force`, or pg_cron is off, or the project is paused. | `0003`'s verification queries. Check `relforcerowsecurity` in `0001`'s.                                             |

### Is a function mounted at all? Run this first

The routes ship through Vercel's **Build Output API**: `apps/game/scripts/vercel-output.mjs`
bundles each file in `apps/api/api/` (`start`, `score`, `top`) into a self-contained function, and
Vercel compiles none of our TypeScript (`apps/api/README.md`, "Vercel settings"). Before reading
anything in this runbook as a database problem, `GET /api/start` and `GET /api/score`: **405
`Allow: POST`** means the function is mounted and loaded, and only then is the database the next
suspect. A **404** is not a database problem -- our code cannot emit a `404`, so no function is
mounted; that is the build output, which this runbook does not own. A **500**
`FUNCTION_INVOCATION_FAILED` is a function that crashed on load; read the build log. (On 2026-10-21
both routes answered 404 on production; that was the services-mode deploy, since replaced.)

### The handle wordlist is effectively part of the schema

`top()` filters every row it reads through `isMintedHandle`. A word removed from
`packages/core/src/leaderboard.ts` therefore **retroactively hides every score already on the board
that used it**, and the over-fetch window (`limit * 4`) silently refills the page so nobody notices.
Adding a word is free; removing one is a data migration. Deprecate rather than delete.

---

## Health check, in one paste

Run `0001`'s verification query for the shape, then this for the state:

```sql
-- Rows, the newest and oldest, and the top of the board as the API would order it.
select count(*) as rows_total, min(created_at) as oldest, max(created_at) as newest
from public.leaderboard;

select handle, score, created_at
from public.leaderboard
order by score desc, created_at asc, id asc
limit 10;

-- Rows past the retention horizon. Expect 0 for the first year.
select count(*) as rows_past_retention
from public.leaderboard
where created_at < now() - interval '12 months';

-- Ties with no defined order (Decision 4). Zero is normal.
select score, created_at, count(*) as tied_rows
from public.leaderboard
group by score, created_at
having count(*) > 1;

-- Retention job, if 0003 has been run.
select jobid, jobname, schedule, active from cron.job where jobname = 'leaderboard-retention';

-- The work email, if 0007 has been run. Counts only: no address leaves this query.
select count(*) as contacts_total, min(consented_at) as oldest, max(consented_at) as newest
from public.leaderboard_contact;
select consent_version, count(*) from public.leaderboard_contact group by consent_version;
select count(*) as contacts_past_retention
from public.leaderboard_contact
where consented_at < now() - interval '12 months';
select jobid, jobname, schedule, active from cron.job where jobname = 'leaderboard-contact-retention';
```

---

## What nobody here has verified

Stated plainly, because the rest of this document reads as if the system works and **none of it has
ever talked to the database.**

No request from this service has reached Supabase. There are no credentials in this checkout, none
were sought, and no `.env` was created. Every PostgREST request shape — headers, `order`,
`Prefer: return=minimal`, the projection — is asserted against a fake `fetch` in `apps/api/test/`.

Whether the current deployment answers the 405 above. The routing question itself is settled --
the Build Output API is what ships, and `services`, `apps/game/api` and a repo-root `api/` each
failed and are not to be re-run -- but a deployment is only believed once it has been probed.

Which key format `SUPABASE_SERVICE_ROLE_KEY` carries. Our code is correct for both the legacy
`service_role` JWT and the newer `sb_secret_` format, because it puts the same value in both headers.

Whether PostgREST's schema cache has `public.leaderboard`. The table was created after the service
was written; if the cache is stale the first call is a 404 **from our function**, which looks
identical from outside to a Vercel 404. Read the function log, not the status.

Whether the project is paused right now, and whether a daily read — or the retention job — stops it
pausing.

~~Whether Vercel's bundler follows `src/content.ts`'s import of the content file and the `@otp/core`
symlink out of the service root.~~ No longer a question: `vercel-output.mjs` inlines
`content/game.v2.json` and `packages/core` into each function's bundle, so nothing is resolved
across the service root at run time.
