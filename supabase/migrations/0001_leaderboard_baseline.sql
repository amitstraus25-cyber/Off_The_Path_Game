-- ============================================================================
-- 0001_leaderboard_baseline.sql
--
-- WHAT IT DOES
--   Writes down the `public.leaderboard` table exactly as it already exists on the project, so
--   the repository and the database finally agree, and so a fresh project (a Supabase branch, a
--   second environment, a local `supabase start`) can be brought to the same state in one paste.
--
-- WHY
--   The table was created by hand in the SQL editor. Nothing in this repository recorded it, so
--   there was no way to recreate it, diff it, or tell whether the live one had drifted. Every
--   later migration in this directory assumes the shape below; this file is what makes that
--   assumption checkable instead of remembered.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes. Every statement is idempotent or guarded. On the live project this migration creates
--   nothing, changes no row, and drops nothing -- running it is how you CONFIRM the live table
--   matches this file. The verification query at the bottom prints the actual shape.
--
-- HOW TO REVERSE IT
--   There is nothing to reverse on a project that already has the table. On a fresh project the
--   reversal is `drop table public.leaderboard;`, which destroys every row and is not something
--   to run against production.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

begin;

-- The table. `if not exists` makes this a no-op on the live project -- which also means it does
-- NOT verify the existing column types or checks. The select at the bottom of this file does that.
create table if not exists public.leaderboard (
  id bigint primary key generated always as identity,

  -- A MINTED handle -- `brave-lantern-42` -- never a string a player typed. The grammar lives in
  -- packages/core/src/leaderboard.ts and is enforced three times: by the schema at the edge, by
  -- store.ts immediately before the insert, and again on the way back out of `GET /api/top`.
  -- The 16 is not slack: the longest mintable handle is `alert-bellows-99`, which is exactly 16
  -- characters. packages/core/test/leaderboard.test.ts walks all 1,024 word pairs against that
  -- limit, so a 6-letter first word or an 8-letter second word reddens the suite instead of
  -- turning into a 503 on a handle the game has already shown the player. Do not widen this
  -- without reading that test; do not add a longer word without running it.
  handle text not null check (char_length(handle) between 1 and 16),

  -- Recomputed server-side from the run log, never sent by the client (CLAUDE.md golden rule 6).
  -- Every `points` field in the content schema is `int().min(0)`, so this check is unreachable
  -- from the route -- it is here as the last statement of the invariant, not as a live defence.
  score integer not null check (score >= 0),

  -- `now()` is TRANSACTION START time, not statement time. Two rows written in the same instant
  -- can therefore share this value to the microsecond, which is why it is not a total order and
  -- why 0005 exists. It is also the only column retention can prune on -- see 0003.
  created_at timestamptz not null default now()
);

-- The read index. `GET /api/top` asks for `order=score.desc,created_at.asc` with a limit, and
-- this index matches that sort expression column for column, including the null ordering:
-- Postgres defaults `desc` to NULLS FIRST and `asc` to NULLS LAST, which is what the query gets
-- because it names no nulls option. The result is an Index Scan with no Sort node above it.
--
-- Do NOT add `nullslast` to the query to "be safe": both columns are `not null`, so there are no
-- nulls to place, and naming a nulls option would change the sort expression and stop this index
-- matching it.
create index if not exists leaderboard_rank_idx on public.leaderboard (score desc, created_at asc);

-- ----------------------------------------------------------------------------
-- The access posture. Read docs/DATABASE.md before changing any of these three.
-- ----------------------------------------------------------------------------

-- RLS on, with NO policies, on purpose. `anon` and `authenticated` match no policy, so they can
-- do nothing at all. The only key that can touch this table is the service role key, which
-- bypasses RLS and lives in a server environment no visitor ever sees.
alter table public.leaderboard enable row level security;

-- `enable`, deliberately NOT `force`. Forcing RLS would apply it to the table OWNER as well,
-- which would silently break the retention job in 0003 (it runs as the scheduling role) and the
-- admin functions in 0004. If someone "hardens" this to `force row level security`, retention
-- starts deleting zero rows and nothing anywhere reports it.

-- Belt as well as braces: the privilege is REVOKED, not merely unpolicied. The difference is the
-- failure mode and it matters more than it looks. An RLS-only table answers a wrong-key SELECT
-- with `200 []` -- we would serve an empty board forever with nothing in any log. With the grant
-- revoked, the same request is 42501 insufficient_privilege, which PostgREST returns as 401/403,
-- which store.ts turns into a 503 with the status in the Vercel log. Every wrong-key path is
-- loud.
revoke all on public.leaderboard from anon, authenticated;

-- Stated rather than inherited. Supabase's default privileges on `public` already grant to
-- `service_role`, so on the live project this line changes nothing -- but on a fresh project it
-- is what makes the insert and the select legal. RLS bypass is not a substitute for a table
-- privilege: a role with BYPASSRLS and no GRANT still gets 42501.
--
-- SELECT and INSERT and nothing else. The service never updates and never deletes; 0004 revokes
-- the rest so that a leaked key cannot erase the board.
grant select, insert on public.leaderboard to service_role;

commit;

-- ============================================================================
-- VERIFICATION -- the output of this is the answer to "has the live table drifted?".
-- It is also the first query in docs/DATABASE.md's health check. Nothing below changes anything.
-- ============================================================================

-- Everything is cast to `text` on purpose. `pg_attribute.attname` is `name`, and the
-- information_schema columns are DOMAINS (`sql_identifier`, `character_data`) -- mixing those
-- across a UNION is how a verification query turns into an error message at 2am.

select
  'column'::text as kind,
  a.attname::text as name,
  format_type(a.atttypid, a.atttypmod)::text as detail,
  (case when a.attnotnull then 'not null' else 'nullable' end)::text as note
from pg_attribute a
where a.attrelid = 'public.leaderboard'::regclass
  and a.attnum > 0
  and not a.attisdropped

union all

select 'constraint'::text, c.conname::text, pg_get_constraintdef(c.oid)::text, ''::text
from pg_constraint c
where c.conrelid = 'public.leaderboard'::regclass

union all

select 'index'::text, i.indexname::text, i.indexdef::text, ''::text
from pg_indexes i
where i.schemaname = 'public' and i.tablename = 'leaderboard'

union all

select
  'grant'::text,
  g.grantee::text,
  string_agg(g.privilege_type::text, ', ' order by g.privilege_type::text),
  ''::text
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.table_name = 'leaderboard'
group by g.grantee::text

union all

select
  'rls'::text,
  'row_level_security'::text,
  (case when c.relrowsecurity then 'enabled' else 'DISABLED' end)::text,
  (case when c.relforcerowsecurity then 'FORCED -- breaks retention, see 0001' else 'not forced' end)::text
from pg_class c
where c.oid = 'public.leaderboard'::regclass

union all

select 'policy'::text, p.polname::text, 'A POLICY EXISTS -- this table is meant to have none'::text, ''::text
from pg_policy p
where p.polrelid = 'public.leaderboard'::regclass

order by kind, name;
