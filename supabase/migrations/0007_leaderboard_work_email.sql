-- ============================================================================
-- 0007_leaderboard_work_email.sql       THE CLIENT'S DECISION OF 2026-10-22 -- WORK EMAIL
--
-- NOT APPLIED. Nothing in this repository holds a key that could run it, and nothing should. The
-- client runs it, by hand, in the Supabase SQL editor, AFTER Legal has signed off on reopening
-- D10 (see "BEFORE YOU RUN IT" below). The service does not use any of it until
-- OTP_WORK_EMAIL=required is set in Vercel, which is the last step, not the first.
--
-- WHAT IT DOES
--   (a) creates `public.leaderboard_contact`: one row per posted score whose player gave a work
--       email and ticked the consent line -- the address, which consent wording they agreed to
--       (`consent_version`, e.g. 'research-contact-v1'), when, and the leaderboard row it came with
--       (a foreign key, ON DELETE CASCADE, so removing a score removes its email);
--   (b) creates `public.leaderboard_post_with_contact(...)`, the ONE way the service writes: the
--       score row and its contact row in a single function call, which is a single transaction --
--       if the contact insert fails, the score insert is rolled back with it. There is never a
--       score on the board without the email that was required to post it;
--   (c) locks the table down: RLS on with no policies, and EVERY privilege revoked from `anon`,
--       `authenticated` AND `service_role`. The service cannot read this table, not even with its
--       own key. It can only call the function in (b), which writes and returns `true`;
--   (d) schedules retention: contact rows older than twelve months are deleted nightly (D10's
--       number, the same as 0003's), and a deleted score takes its contact row with it;
--   (e) adds the delete path, in `admin` like 0004's: find by address, remove by id.
--
-- WHY THE SERVICE CANNOT READ IT, AND WHY THAT IS THE DESIGN
--   The address is personal data. The service needs to WRITE it and never to read it: no route
--   returns it, no log carries it, `GET /api/top` reads `public.leaderboard` only. Granting
--   `service_role` SELECT would make that last sentence a property of our code; revoking it makes
--   it a property of the database, so a leaked SUPABASE_SERVICE_ROLE_KEY can add junk rows through
--   the function (which rate limiting bounds) but cannot read one address back out. People who
--   need the list read it in the SQL editor as the table owner, which is the dashboard's access
--   control, already audited.
--
--   `service_role` carries BYPASSRLS, so RLS alone would not stop it; the revoke is what does.
--   Supabase's default privileges grant new tables in `public` to all three API roles, which is
--   why the revoke names all three explicitly rather than trusting a fresh table to start empty.
--
-- WHY A FUNCTION, AND WHY IN `public`
--   PostgREST exposes `public` (Settings -> API -> Exposed schemas), so a function there is an RPC
--   endpoint: POST /rest/v1/rpc/leaderboard_post_with_contact. That is the point -- it is how the
--   service reaches it over plain fetch, with no driver -- and it is also the risk 0004 kept its
--   admin functions out of `public` for. So EXECUTE is revoked from PUBLIC, `anon` and
--   `authenticated` and granted to `service_role` only. With any key but the service role key the
--   call is `42501 permission denied`, which PostgREST answers 401/403 -- loud, as 0001 prefers.
--
--   SECURITY DEFINER, owned by the migration's runner (`postgres`): it runs with the owner's
--   rights, which is what lets it insert into a table `service_role` holds no privilege on. The
--   standard precautions are taken: `set search_path = ''` and every name schema-qualified, so a
--   caller cannot plant a `leaderboard` earlier on the path; it does exactly two inserts and
--   returns a constant, so nothing about any row (not even the new id -- 0004's delete-path
--   reasoning leans on the id never leaving the database) comes back out.
--
-- BEFORE YOU RUN IT -- the order, and none of it is optional
--   1. Legal signs off. This REOPENS D10, whose sentence was "handle and score only". The table
--      now holds a work email. docs/DATABASE.md, "Decision 5", has the paragraph to put in front
--      of them, the consent wording, and the retention period.
--   2. pg_cron is enabled (0003's prerequisite: Database -> Extensions -> pg_cron).
--   3. Run 0001 (drift check), and 0003 and 0004 if they have not been: this file's verification
--      expects 0004's `admin` schema, and 0003's retention is what keeps the board itself to twelve
--      months, which the cascade then applies to contacts too.
--   4. Run this file. Then the verification block at the bottom.
--   5. Only then set OTP_WORK_EMAIL=required in Vercel (Production and Preview) and redeploy.
--      Before that the service never calls the function and the table stays empty.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes. It creates a new table, a function and two schedules, and changes no existing row or
--   privilege on `public.leaderboard`. Re-running it is safe: every statement is idempotent.
--
-- HOW TO REVERSE IT
--   begin;
--     select cron.unschedule('leaderboard-contact-retention')
--       where exists (select 1 from cron.job where jobname = 'leaderboard-contact-retention');
--     drop function if exists public.leaderboard_post_with_contact(text, integer, text, text);
--     drop function if exists admin.leaderboard_contact_find(text);
--     drop function if exists admin.leaderboard_contact_remove(bigint);
--     drop table if exists public.leaderboard_contact;   -- DELETES EVERY ADDRESS. No undo.
--   commit;
--   Unset OTP_WORK_EMAIL and redeploy FIRST, or every post 503s while the function is missing.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

create extension if not exists pg_cron;

begin;

-- ----------------------------------------------------------------------------
-- (a) The table.
-- ----------------------------------------------------------------------------

create table if not exists public.leaderboard_contact (
  id              bigint      primary key generated always as identity,
  -- The score this address was given for. CASCADE: retention (0003) or a takedown
  -- (admin.leaderboard_remove) that deletes the score deletes the address with it.
  leaderboard_id  bigint      not null unique
                              references public.leaderboard (id) on delete cascade,
  -- Normalised by core's `checkWorkEmail` before it gets here (trimmed, lower case). The checks
  -- below are the last statement of that, not the validation: they refuse a value the service
  -- would never send, so a hand-written insert cannot store a second spelling.
  email           text        not null
                              check (char_length(email) between 6 and 254)
                              check (email = lower(btrim(email)))
                              check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z0-9-]{2,63}$'),
  -- Which wording the player agreed to: content/game.v2.json `ui.contact.consentVersion`, read
  -- from the SERVER's copy of the content, never from the request.
  consent_version text        not null
                              check (consent_version ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
                              check (char_length(consent_version) <= 64),
  consented_at    timestamptz not null default now()
);

-- Retention scans by age; the delete path finds by address.
create index if not exists leaderboard_contact_consented_idx
  on public.leaderboard_contact (consented_at);
create index if not exists leaderboard_contact_email_idx
  on public.leaderboard_contact (email);

comment on table public.leaderboard_contact is
  'Work emails given to post a score, with the consent version agreed to. Personal data. Never '
  'returned by any route; the service can write it only through '
  'public.leaderboard_post_with_contact and cannot read it. Retention: 12 months (D10).';

-- ----------------------------------------------------------------------------
-- (c) Nobody but the owner, and the owner is the SQL editor.
--
-- RLS on, no policies -- the posture 0001 explains for `leaderboard` -- and, unlike
-- `leaderboard`, NO grant to service_role at all. Enabled, not forced: forcing it would apply to
-- the owner too, and the function in (b), the retention job and the admin functions all run as
-- the owner.
-- ----------------------------------------------------------------------------

alter table public.leaderboard_contact enable row level security;
revoke all on public.leaderboard_contact from public;
revoke all on public.leaderboard_contact from anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- (b) The one write: a score and its address, together or not at all.
--
-- A function body runs inside the caller's statement, and a PostgREST RPC is one statement in one
-- transaction: if the second insert raises -- a check above, a constraint, anything -- the first
-- is rolled back with it, and the service sees an error and answers 503 having stored nothing.
--
-- The messages Postgres raises from here quote no values in their MESSAGE (a check violation
-- names its constraint; the row goes in DETAIL), and the service logs only the SQLSTATE code of a
-- failed call anyway (apps/api/src/store.ts) -- the address never reaches a log line.
-- ----------------------------------------------------------------------------

create or replace function public.leaderboard_post_with_contact(
  p_handle text,
  p_score integer,
  p_email text,
  p_consent_version text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.leaderboard (handle, score)
  values (p_handle, p_score)
  returning id into v_id;

  insert into public.leaderboard_contact (leaderboard_id, email, consent_version)
  values (v_id, p_email, p_consent_version);

  -- A constant, never the id: the id stays in the database (0004).
  return true;
end;
$$;

comment on function public.leaderboard_post_with_contact(text, integer, text, text) is
  'Writes one leaderboard row and its work-email contact row in one transaction and returns '
  'true. Callable by service_role only. Returns nothing about the rows.';

revoke all on function public.leaderboard_post_with_contact(text, integer, text, text) from public;
revoke all on function public.leaderboard_post_with_contact(text, integer, text, text)
  from anon, authenticated;
grant execute on function public.leaderboard_post_with_contact(text, integer, text, text)
  to service_role;

-- ----------------------------------------------------------------------------
-- (e) The delete path, beside 0004's, in the schema PostgREST does not expose.
--
-- AN ADDRESS IS AN IDENTITY, which a handle is not, and that changes the policy 0004 set out. A
-- request to delete "my email" is a privacy request, not a courtesy: honour it in full, for every
-- row carrying that address, and do not ask the requester which run was theirs. Whether to remove
-- the SCORE rows too is the requester's choice (the name on the board may be theirs as well); the
-- procedure at the bottom covers both.
--
-- Not security definer: they run as the caller, which in the SQL editor is the table owner.
-- ----------------------------------------------------------------------------

create schema if not exists admin;
revoke all on schema admin from public;
revoke all on schema admin from anon, authenticated, service_role;

create or replace function admin.leaderboard_contact_find(p_email text)
returns table (
  contact_id bigint,
  leaderboard_id bigint,
  consent_version text,
  consented_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.leaderboard_id, c.consent_version, c.consented_at
  from public.leaderboard_contact c
  where c.email = lower(btrim(p_email))
  order by c.consented_at desc;
$$;

comment on function admin.leaderboard_contact_find(text) is
  'Every contact row for one work email (normalised as stored), with the leaderboard row each '
  'came with. Run before admin.leaderboard_contact_remove.';

-- One row by id, returning what it removed -- without the address, which the ticket then need
-- not hold either.
create or replace function admin.leaderboard_contact_remove(p_id bigint)
returns table (
  contact_id bigint,
  leaderboard_id bigint,
  consent_version text,
  consented_at timestamptz
)
language sql
volatile
set search_path = ''
as $$
  delete from public.leaderboard_contact c
  where c.id = p_id
  returning c.id, c.leaderboard_id, c.consent_version, c.consented_at;
$$;

comment on function admin.leaderboard_contact_remove(bigint) is
  'Deletes one contact row by id and returns it without the address. No undo.';

revoke all on all functions in schema admin from public;
revoke all on all functions in schema admin from anon, authenticated, service_role;

commit;

-- ----------------------------------------------------------------------------
-- (d) Retention: twelve months from consent, nightly at 03:23 UTC (six minutes after 0003's job,
-- so the two never contend). The cascade from `leaderboard` already removes a contact whose score
-- 0003 prunes; this job is what still holds if 0003 was never run, and it is D10's number in the
-- one place it lives for this table. Change it here and in docs/DATABASE.md together.
-- ----------------------------------------------------------------------------

select cron.unschedule('leaderboard-contact-retention')
where exists (select 1 from cron.job where jobname = 'leaderboard-contact-retention');

select cron.schedule(
  'leaderboard-contact-retention',
  '23 3 * * *',
  $$delete from public.leaderboard_contact where consented_at < now() - interval '12 months'$$
);

-- PostgREST learns about the new function only when its schema cache reloads. Without this the
-- first post after OTP_WORK_EMAIL=required is a 404 from PostgREST (PGRST202), which the service
-- answers 503 -- recoverable, but it is the first thing anyone would see.
notify pgrst, 'reload schema';

-- ============================================================================
-- THE PROCEDURE, for an erasure request ("delete my email")
--
--   1. Find every row for the address (normalised for you):
--        select * from admin.leaderboard_contact_find('Jane.Doe@acme.com');
--
--   2. Remove each contact row, by id:
--        select * from admin.leaderboard_contact_remove(1234);
--
--   3. If the requester also wants their scores gone -- ask; the name on the board may be theirs
--      -- remove each leaderboard row with 0004's function. The cascade would have removed the
--      contact row too, so doing this INSTEAD of step 2 is equally complete:
--        select * from admin.leaderboard_remove(5678);
--
--   4. Record in the ticket the ids and timestamps returned, NOT the address. There is no audit
--      table, deliberately: a row recording a deleted address is the deleted address.
--
--   5. Any copy of the address taken out of this table (an export to a CRM, a spreadsheet) is not
--      reached by any of this. Whoever exports is responsible for deleting there too.
--
-- READING THE LIST, for the people the consent says may contact the player:
--        select email, consent_version, consented_at
--        from public.leaderboard_contact
--        where consented_at > now() - interval '30 days'
--        order by consented_at;
--   Only as the table owner, in the SQL editor. The service cannot run it.
-- ============================================================================

-- VERIFICATION -- run after the file. Each comment says what to expect.

-- Expect NO rows: no role but the owner holds any privilege on the table.
select grantee::text as role, privilege_type::text as privilege
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'leaderboard_contact'
  and grantee::text in ('anon', 'authenticated', 'service_role', 'PUBLIC');

-- Expect relrowsecurity = true, relforcerowsecurity = false.
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.leaderboard_contact'::regclass;

-- Expect service_role = true, anon = false, authenticated = false.
select r.rolname,
       has_function_privilege(
         r.rolname,
         'public.leaderboard_post_with_contact(text, integer, text, text)',
         'execute'
       ) as can_execute
from pg_roles r
where r.rolname in ('service_role', 'anon', 'authenticated')
order by r.rolname;

-- Expect prosecdef = true and the search_path pinned to ''.
select p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'leaderboard_post_with_contact';

-- Expect the foreign key with confdeltype = 'c' (cascade).
select conname, confdeltype
from pg_constraint
where conrelid = 'public.leaderboard_contact'::regclass and contype = 'f';

-- Expect exactly one row, active = true.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'leaderboard-contact-retention';

-- THE TRANSACTION, PROVED rather than assumed: a call whose address the table refuses must leave
-- NO score row behind. Expect the notice "transaction proved"; an exception here is a defect --
-- read its message. Nothing is left behind either way (the inner block's work is rolled back by
-- the very mechanism under test, and an exception rolls back the whole block).
do $$
declare
  v_before bigint;
  v_after bigint;
begin
  select count(*) into v_before from public.leaderboard;
  begin
    perform public.leaderboard_post_with_contact(
      'verify-row', 1, 'NOT AN ADDRESS', 'research-contact-v1'
    );
    raise exception 'the bad address was accepted: the email checks are missing';
  exception
    when check_violation then null;
  end;
  select count(*) into v_after from public.leaderboard;
  if v_after <> v_before then
    raise exception 'a score row survived its failed contact insert (% before, % after)',
      v_before, v_after;
  end if;
  raise notice 'transaction proved: % leaderboard rows before and after', v_before;
end;
$$;
