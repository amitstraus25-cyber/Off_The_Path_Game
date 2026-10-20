-- ============================================================================
-- 0004_leaderboard_delete_path.sql       DECISION 3 of 4 -- THE DELETE PATH
--
-- WHAT IT DOES
--   Two things, which together are the whole answer to "someone will ask for a row to be
--   removed":
--     (a) creates an `admin` schema holding two reviewed functions -- one that FINDS candidate
--         rows and one that removes exactly one row by id -- so that removing a row is never a
--         DELETE composed by hand against a live table at 2am;
--     (b) takes UPDATE, DELETE and TRUNCATE away from `service_role`, so the only key the
--         internet-facing service holds cannot erase the board even if it leaks.
--
-- THE FINDING THAT SHOULD SHAPE THE POLICY -- read this before choosing a procedure
--   A handle is not an identity. The game MINTS handles from two word lists (3,072 combinations
--   before the two-digit suffix), draws them at random, and keeps no record of who got which.
--   Many different players will hold `brave-lantern-42` over the life of the board. On top of
--   that, `POST /api/score` answers `{handle, score}` and deliberately never returns the row id
--   (store.ts sends `Prefer: return=minimal`, so the generated id never leaves the database).
--
--   Two consequences, and they point in opposite directions:
--     - A PLAYER CANNOT IDENTIFY THEIR OWN ROW, and neither can we. "Please delete my score"
--       arrives as a handle and maybe a number, which may match several rows belonging to
--       several people. Deleting by handle alone over-deletes other people's rows. This is why
--       `admin.leaderboard_find` exists and why the remove function takes an ID and refuses to
--       take anything else.
--     - Precisely BECAUSE no row can be tied to a person, there is no erasure request to
--       satisfy. A handle and a score with no account, no email, no cookie and no IP is not
--       personal data, which is the entire reason D10 was written the way it was. The delete
--       path is therefore a MODERATION control -- take down a row somebody objects to -- and
--       not a privacy control. Treat a request to delete "my" row as a courtesy, scope it as
--       narrowly as the requester can describe, and do not promise a clean match.
--
--   This is not a reason to build an authenticated delete ROUTE. The expected volume is a
--   handful of requests a year; the cost of a route is a new secret, a rotation burden, and a
--   DELETE reachable from the internet. docs/DATABASE.md, "Decision 3", sets that out in full.
--   The recommendation is: keep the delete path in the SQL editor, and make the SQL editor safe.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes. Nothing here deletes anything. Creating a schema and two functions touches no row, and
--   the privilege change removes privileges the running service has never used -- store.ts
--   issues exactly one POST and one GET, which need INSERT and SELECT and nothing else.
--
-- HOW TO REVERSE IT
--   begin;
--     grant update, delete, truncate on public.leaderboard to service_role;  -- (a) privileges
--     drop schema if exists admin cascade;                                   -- (b) functions
--   commit;
--   Reversing (a) alone is enough if the service ever genuinely needs to delete. If it does,
--   stop and ask why first -- see "Known and accepted" in apps/api/README.md.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- (a) The admin schema. NOT `public`, and that is the security property.
--
-- A `security definer` function in `public` is exposed by PostgREST as an RPC endpoint --
-- `POST /rest/v1/rpc/leaderboard_remove` -- reachable by anyone holding any key. Putting the
-- delete helper in `public` would hand the internet a delete button and undo the table grants
-- above it. Supabase exposes only the schemas listed under Settings -> API -> Exposed schemas
-- (`public, graphql_public` by default), so a schema named `admin` is not reachable over REST at
-- all; it exists only for someone typing into the SQL editor.
--
-- VERIFY THAT, do not assume it: if `admin` ever appears in Exposed schemas, these functions
-- become endpoints. The revokes below are the second line of defence for exactly that case.
-- ----------------------------------------------------------------------------

create schema if not exists admin;

-- `public` here is the pseudo-role every role inherits, not the schema of the same name.
revoke all on schema admin from public;
revoke all on schema admin from anon, authenticated, service_role;

-- Candidates for removal, with the ID the remove function needs. Call this FIRST, always: it is
-- the step where you discover that the handle in the request matches four rows and only one of
-- them is the one being complained about.
--
-- Not `security definer`. It runs with the caller's own privileges, which in the SQL editor is
-- the table owner, so it needs no elevation -- and a function that does not elevate cannot be
-- turned into a privilege escalation by being exposed.
create or replace function admin.leaderboard_find(
  p_handle text default null,
  p_score integer default null,
  p_since timestamptz default null
)
returns table (
  row_id bigint,
  row_handle text,
  row_score integer,
  row_created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select l.id, l.handle, l.score, l.created_at
  from public.leaderboard l
  where (p_handle is null or l.handle = p_handle)
    and (p_score is null or l.score = p_score)
    and (p_since is null or l.created_at >= p_since)
  order by l.created_at desc
  limit 50;
$$;

comment on function admin.leaderboard_find(text, integer, timestamptz) is
  'Candidate rows for a takedown request. Run this before admin.leaderboard_remove and read the '
  'result: a handle is not an identity, so more than one row may match and they may belong to '
  'different people.';

-- Removes exactly one row, by id, and RETURNS WHAT IT DELETED so the operator can paste the
-- result into the ticket. One id per call: no handle parameter, no score parameter, no bulk
-- form. The missing bulk form is the point -- `delete ... where handle = $1` is the mistake this
-- function exists to make impossible to type by accident.
create or replace function admin.leaderboard_remove(p_id bigint)
returns table (
  row_id bigint,
  row_handle text,
  row_score integer,
  row_created_at timestamptz
)
language sql
volatile
set search_path = ''
as $$
  delete from public.leaderboard l
  where l.id = p_id
  returning l.id, l.handle, l.score, l.created_at;
$$;

comment on function admin.leaderboard_remove(bigint) is
  'Deletes one leaderboard row by id and returns it. There is no undo: record the returned row '
  'in the ticket before closing it.';

-- Defence in depth for the day somebody adds `admin` to Exposed schemas. PostgREST can only call
-- what the request role may execute.
revoke all on all functions in schema admin from public;
revoke all on all functions in schema admin from anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- (b) Least privilege for the one key that faces the internet.
--
-- This is the only statement in the whole migrations directory that changes what the RUNNING
-- service is allowed to do. apps/api/src/store.ts makes exactly two requests: a POST that
-- inserts and a GET that selects. It has never updated and never deleted, and there is no
-- route that could. Revoking the rest means a leaked `SUPABASE_SERVICE_ROLE_KEY` can add junk
-- rows -- which rate limiting and 0002 bound -- but cannot wipe or rewrite the board, which is
-- the difference between an incident and a disaster.
--
-- Retention (0003) is unaffected: pg_cron jobs run as the role that scheduled them, which is the
-- table owner, not `service_role`.
-- ----------------------------------------------------------------------------

revoke update, delete, truncate on public.leaderboard from service_role;
grant select, insert on public.leaderboard to service_role;

commit;

-- ============================================================================
-- THE PROCEDURE, for whoever picks up the ticket
--
--   1. Find the candidates. Narrow with whatever the requester gave you:
--        select * from admin.leaderboard_find('brave-lantern-42');
--        select * from admin.leaderboard_find('brave-lantern-42', 900);
--        select * from admin.leaderboard_find('brave-lantern-42', null, now() - interval '7 days');
--
--   2. Read the result. If more than one row matches, STOP and go back to the requester for
--      something that narrows it -- roughly when they played, or the exact score they saw. Do
--      not guess, and do not delete all of them to be helpful: the other rows are other people's.
--
--   3. Remove the one row, by id, and keep what it returns:
--        select * from admin.leaderboard_remove(1234);
--
--   4. Paste the returned row into the ticket. That is the only record the deletion ever had --
--      there is no audit table here, deliberately, because an audit row holding the handle and
--      score of a deleted entry is the deleted entry.
--
--   5. The board is cached at the edge for 60 seconds with up to 5 minutes of
--      stale-while-revalidate, so a removed row can still be served for about five minutes.
--      Say so in the ticket rather than letting someone re-report it.
-- ============================================================================

-- VERIFICATION -- expect `service_role` to hold SELECT and INSERT and nothing else.
-- Cast to text: these information_schema columns are domains, not plain text.
select
  grantee::text as role,
  string_agg(privilege_type::text, ', ' order by privilege_type::text) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'leaderboard'
group by grantee::text
order by grantee::text;

-- Expect the two functions, and expect `admin` NOT to appear in Exposed schemas in the dashboard.
select n.nspname as schema, p.proname as function, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'admin'
order by p.proname;
