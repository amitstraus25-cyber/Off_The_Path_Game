-- ============================================================================
-- 0005_leaderboard_rank_tiebreak.sql     DECISION 4 of 4 -- THE READ QUERY
--
-- *** OPTIONAL. Read "IS IT WORTH RUNNING?" before you paste it. ***
--
-- WHAT IT DOES
--   Replaces `leaderboard_rank_idx` with the same index plus `id asc` as a third column, so that
--   the board's sort is a TOTAL order and the read stays a pure Index Scan with no Sort node.
--
-- WHY
--   `GET /api/top` orders by `score desc, created_at asc` and assigns rank by array position.
--   Those two columns are not a total order: `created_at` defaults to `now()`, which is
--   TRANSACTION START time, so two players finishing in the same instant can share it to the
--   microsecond. When they do, Postgres is free to return them in either order, and their two
--   ranks swap every time the 60-second edge cache refreshes. Nothing is corrupt and nobody
--   loses a score -- the board just disagrees with itself between refreshes, on a public page,
--   for a company that sells certainty about data.
--
--   The fix is one word in the ORDER BY, in apps/api/src/store.ts (a file this round does not
--   own -- the diff is in docs/DATABASE.md, "Decision 4"):
--       order: 'score.desc,created_at.asc'
--       order: 'score.desc,created_at.asc,id.asc'
--   `id` is `generated always as identity`, so it cannot tie and it cannot be NULL. This index
--   is the database half of that change.
--
-- IS IT WORTH RUNNING?
--   The CODE change is worth making on its own and should not wait for this file. This INDEX
--   change is a micro-optimisation: without it, Postgres answers the three-column ORDER BY with
--   an Incremental Sort on top of the existing two-column index, which is correct and, at a
--   limit of 100 rows over ties of size one or two, free. Run this when you want the plan to be
--   exactly one Index Scan and nothing else; it is entirely safe never to run it.
--
--   It is ALSO safe to run BEFORE the code change. Until store.ts asks for `id.asc` the index is
--   simply one column wider than the query needs, which costs eight bytes per entry and changes
--   no plan: a leading-column prefix still matches `score desc, created_at asc` exactly.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes, with one honest caveat. Dropping and recreating an index inside a transaction is atomic
--   -- readers see the old index until commit, then the new one -- but the DROP takes an ACCESS
--   EXCLUSIVE lock, so writes block for the duration. At this table's size that is milliseconds.
--
--   `CREATE INDEX CONCURRENTLY` is deliberately NOT used: it cannot run inside a transaction
--   block, and the Supabase SQL editor executes a pasted script as one. Reaching for
--   CONCURRENTLY here produces an error, not a safer migration. If this table ever grows to the
--   point where a millisecond write lock matters, run the concurrent form one statement at a
--   time from a direct psql session instead of pasting this file.
--
-- HOW TO REVERSE IT
--   begin;
--     drop index if exists public.leaderboard_rank_idx;
--     create index leaderboard_rank_idx on public.leaderboard (score desc, created_at asc);
--   commit;
--   Reverse the code change too, or leave it -- `id.asc` against the two-column index is an
--   Incremental Sort, which is correct.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

begin;

drop index if exists public.leaderboard_rank_idx;

-- Column for column, the sort `GET /api/top` will ask for. The null ordering is left unnamed on
-- purpose so it takes Postgres's defaults -- NULLS FIRST for `desc`, NULLS LAST for `asc` --
-- which is exactly what an ORDER BY that names no nulls option gets. Writing `nullslast` on
-- either side here, or in the PostgREST query, changes the sort expression and stops the two
-- matching. All three columns are `not null` anyway; there are no nulls to place.
create index leaderboard_rank_idx
  on public.leaderboard (score desc, created_at asc, id asc);

commit;

-- ============================================================================
-- THE PLAN YOU SHOULD SEE, and the one that looks wrong but is not
--
-- The read `GET /api/top` makes, with the largest page the API will serve (MAX_TOP_LIMIT is 25
-- and store.ts over-fetches four pages, capped at MAX_ROWS_READ = 100):
--
--   explain analyze
--   select handle, score from public.leaderboard
--   order by score desc, created_at asc, id asc
--   limit 100;
--
-- WANTED:
--   Limit
--     ->  Index Scan using leaderboard_rank_idx on leaderboard
--   -- no Sort node, no Incremental Sort, no Seq Scan.
--
-- ON AN ALMOST-EMPTY TABLE YOU WILL INSTEAD SEE `Seq Scan` + `Sort`, AND THAT IS CORRECT.
-- Below a few hundred rows Postgres reads the whole table because that genuinely is cheaper than
-- descending an index. This has sent people off to "fix" an index that was never broken. Judge
-- the plan on a table with realistic volume, or not at all.
--
-- Why it is not an Index-Only Scan: the query selects `handle`, which is not in the index, so
-- every matching entry needs a heap visit. Adding `include (handle)` would make it index-only
-- and is NOT recommended -- it widens every entry, adds write amplification on the hot insert
-- path, and only pays off once the visibility map is set by a vacuum. A hundred heap fetches
-- behind a 60-second edge cache is not a problem worth an index for.
-- ============================================================================

-- VERIFICATION -- expect one definition, ending `(score DESC, created_at, id)`.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'leaderboard' and indexname = 'leaderboard_rank_idx';

-- Are there any ties this actually fixes? Each row returned is a pair of entries whose order is
-- currently undefined. Zero is the normal answer and does not mean the change was pointless --
-- it means it has not bitten yet.
select score, created_at, count(*) as tied_rows
from public.leaderboard
group by score, created_at
having count(*) > 1
order by score desc;
