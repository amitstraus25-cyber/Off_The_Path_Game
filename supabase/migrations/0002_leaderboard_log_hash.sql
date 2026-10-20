-- ============================================================================
-- 0002_leaderboard_log_hash.sql          DECISION 1 of 4 -- DEDUPE
--
-- *** THIS MIGRATION REOPENS DECISION D10. DO NOT RUN IT UNTIL SOMEONE HAS SAID YES. ***
--   D10 reads "handle + score only". This adds a third column. The argument on both sides is in
--   docs/DATABASE.md under "Decision 1"; the short version is below. Everything else in this
--   directory is a quiet migration. This one is a decision with a migration attached.
--
-- WHAT IT DOES
--   Adds a nullable `log_hash` column and a unique index over it, so that one run is one row in
--   the TABLE rather than one row per serverless instance.
--
-- WHY
--   Dedupe today lives in `apps/api/src/limit.ts` as a Set in module scope. It is per instance,
--   and Vercel runs several. The same run posted twice -- which a player does, because the Post
--   button re-enables, and which a timeout makes likely, because an insert that timed out may
--   still have committed -- lands twice whenever the two requests reach different instances.
--   Nothing in the table can currently prevent it, because nothing in the table identifies a run.
--
--   What goes in the column: the SHA-256 that `limit.ts:fingerprint` already computes over the
--   run log -- verdicts, questions asked, timestamps. It is gameplay. There is no IP in it, raw
--   or hashed, no cookie, no account, no user agent, and not the handle. It is already computed
--   on every request; this migration is only about whether it is allowed to be persisted.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes, and it is safe to run BEFORE the code that writes the column -- which is the order you
--   want. The column is nullable, so every existing row gets NULL. A Postgres B-tree unique
--   index is NULLS DISTINCT by default, so it permits any number of NULLs: the currently
--   deployed service, which sends only `handle` and `score`, keeps inserting happily and every
--   row it writes is NULL in this column. Nothing breaks and nothing is backfilled -- the run
--   logs for existing rows are gone, so those rows simply never participate in dedupe.
--
--   Run the SQL FIRST and deploy the code SECOND. The reverse order is a 400 on every post:
--   PostgREST answers 42P10 when `on_conflict` names a column with no unique index.
--
-- HOW TO REVERSE IT
--   begin;
--     drop index if exists public.leaderboard_log_hash_key;
--     alter table public.leaderboard drop constraint if exists leaderboard_log_hash_shape;
--     alter table public.leaderboard drop column if exists log_hash;
--   commit;
--   Reverse the CODE first, or every insert starts failing on an unknown column.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

begin;

-- Nullable, with no default. See the note above: this is what makes the migration safe to run
-- while the deployed service still knows nothing about the column.
alter table public.leaderboard add column if not exists log_hash text;

-- A SHA-256 as lowercase hex, or nothing at all. This is cheap insurance against the column
-- quietly becoming a junk drawer: the only value the service can legitimately write is
-- `createHash('sha256').update(...).digest('hex')`, which is exactly 64 hex characters.
--
-- On a table this size the validation scan is instant and every existing row is NULL, so it
-- passes. On a large table you would add it `not valid` and `validate constraint` separately so
-- the scan does not hold a lock; that is not needed here and the simpler form is the one that
-- survives being pasted at 2am.
alter table public.leaderboard drop constraint if exists leaderboard_log_hash_shape;
alter table public.leaderboard
  add constraint leaderboard_log_hash_shape
  check (log_hash is null or log_hash ~ '^[0-9a-f]{64}$');

-- The actual control. Two rows cannot carry the same hash; any number can carry none.
create unique index if not exists leaderboard_log_hash_key on public.leaderboard (log_hash);

commit;

-- ============================================================================
-- WHAT THE SERVICE MUST DO AFTERWARDS -- and the one design note that matters
--
-- The obvious wiring is `?on_conflict=log_hash` with `Prefer: resolution=ignore-duplicates`.
-- DO NOT USE IT. With `return=minimal` an ignored duplicate is a 201 with an empty body, exactly
-- like a real insert, so the player is told "Posted to the board as brave-lantern-42." for a row
-- that was already there and the duplicate becomes invisible to us as well as to them.
--
-- Let the unique violation happen instead. PostgREST maps 23505 unique_violation to HTTP 409,
-- and `handleScore` ALREADY answers 409 for the in-memory duplicate, and the game ALREADY reads
-- that out as `leaderboardAlready` -- "That run is already on the board." -- in content/game.json.
-- Surfacing the database's 409 as the route's 409 therefore makes the durable control produce the
-- identical sentence the per-instance one produces, and the game needs no change whatsoever.
--
-- One caveat to keep honest: on THIS table a 409 means the log_hash index and nothing else,
-- because there is no other unique constraint and no foreign key. If a second unique constraint
-- is ever added, that inference stops holding and store.ts must read PostgREST's `code` field to
-- tell them apart.
--
-- The diffs for apps/api/src/{store,handlers}.ts are in docs/DATABASE.md under "Decision 1".
-- They are not applied here: those files belong to another owner this round.
-- ============================================================================

-- VERIFICATION -- expect one row: leaderboard_log_hash_key, unique, over (log_hash).
select i.indexname, i.indexdef
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename = 'leaderboard'
  and i.indexname = 'leaderboard_log_hash_key';

-- How many rows predate the column, and how many duplicate runs are already on the board.
-- The second number is the one that says whether this was worth doing.
select
  count(*) filter (where log_hash is null) as rows_without_a_hash,
  count(*) filter (where log_hash is not null) as rows_with_a_hash,
  count(*) as rows_total
from public.leaderboard;
