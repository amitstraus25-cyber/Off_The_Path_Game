-- ============================================================================
-- 0003_leaderboard_retention.sql         DECISION 2 of 4 -- RETENTION
--
-- WHAT IT DOES
--   Schedules a nightly job that deletes leaderboard rows older than twelve months.
--
-- WHY
--   Decision D10 says twelve-month retention. `created_at` has existed since the table was
--   created and nothing has ever pruned it, so the retention policy is currently a sentence in
--   docs/PLAN.md and nothing else. For a data security company's public asset, a stated
--   retention period that is not implemented is worse than no stated period: it is a claim the
--   database contradicts.
--
--   READ THIS BEFORE YOU RUN IT: twelve-month retention means the board is a ROLLING TWELVE
--   MONTHS, not an all-time board. A top score set thirteen months ago disappears. That is the
--   correct reading of D10 and it is almost certainly what was intended, but nobody has written
--   it down. Nothing in content/game.json currently calls the board "all time" (the shipped
--   strings are `handleLabel`, `handleAssigned`, `leaderboardDown`, `leaderboardRefused`,
--   `leaderboardAlready`), so no shipped copy becomes false -- but if a board SCREEN is ever
--   built, it must not be labelled "all time". Note also that no screen calls `top()` today.
--
-- IS IT SAFE ON A TABLE THAT ALREADY HAS ROWS?
--   Yes. The delete is bounded by `created_at` and the oldest row on this table is younger than
--   the project, so the first several runs will delete exactly zero rows. Re-running this file
--   replaces the schedule rather than duplicating it.
--
-- HOW TO REVERSE IT
--   select cron.unschedule('leaderboard-retention');
--   That stops the pruning. It does not bring back rows already deleted -- there is no undo and
--   no soft delete, by design, because a tombstone would outlive the data it describes.
--
-- PREREQUISITE -- do this first, it is a dashboard toggle, not SQL:
--   Supabase dashboard -> Database -> Extensions -> search `pg_cron` -> enable.
--   The `create extension` below is the equivalent and will usually work on its own; if it
--   errors on permissions, use the toggle and then re-run this file from that line onwards.
--   pg_cron runs in the `postgres` database only. Confirm it is available on your plan before
--   relying on it -- if it is not, see "WITHOUT pg_cron" at the bottom of this file.
--
-- RUN IT: paste the whole file into the Supabase SQL editor and execute once.
-- ============================================================================

create extension if not exists pg_cron;

-- Explicitly idempotent. `cron.schedule` upserts by job name in pg_cron 1.4 and later, but the
-- version is not something you should have to know while pasting this, and an accidental second
-- schedule means the delete runs twice a night forever with nothing to show for it.
select cron.unschedule('leaderboard-retention')
where exists (select 1 from cron.job where jobname = 'leaderboard-retention');

-- 03:17 UTC, not 03:00. The top of the hour is when every scheduled job on shared infrastructure
-- fires at once; seventeen minutes past is free and avoids the crowd.
--
-- The job runs as the role that schedules it -- the SQL editor's `postgres`, which owns the
-- table -- NOT as `service_role`. That is why 0004 can revoke DELETE from `service_role` without
-- breaking retention, and it is why forcing RLS on the table (see 0001) would break it.
select cron.schedule(
  'leaderboard-retention',
  '17 3 * * *',
  $$delete from public.leaderboard where created_at < now() - interval '12 months'$$
);

-- ============================================================================
-- OPERATIONAL NOTES -- the three things that are not obvious
--
-- 1. A PAUSED PROJECT RUNS NO CRON. On the free tier Supabase pauses a project after roughly a
--    week without activity, and a research page that nobody plays for a week is exactly that.
--    This is not a problem for retention: a paused project also accepts no new rows, so the
--    backlog does not grow while it sleeps, and the first tick after it wakes catches up. It IS
--    a problem for the board itself -- see docs/DATABASE.md, "When the free tier pauses".
--
--    Whether this cron job's activity is itself enough to STOP the project pausing is a question
--    nobody here can answer from a checkout. If it is, retention and keep-alive are the same job
--    and the pause problem is solved for free. That is worth one eight-day observation before
--    anyone pays for anything.
--
-- 2. THE DELETE IS NOT BATCHED. At this table's expected size -- thousands of rows over a year --
--    a single statement is right, and a batched version would be ceremony. If the board ever
--    holds millions, replace the command with a bounded loop so the delete does not hold a long
--    transaction:
--      $$delete from public.leaderboard where id in (
--          select id from public.leaderboard
--          where created_at < now() - interval '12 months' limit 10000)$$
--    and let the nightly schedule chew through it over several nights.
--
-- 3. TWELVE MONTHS IS D10'S NUMBER, NOT A DATABASE FACT. If Legal changes it, change the
--    interval here and in docs/DATABASE.md, and re-run this file. There is exactly one place the
--    number lives in SQL, which is this line, on purpose.
--
-- WITHOUT pg_cron
--   If pg_cron is not available, retention becomes a calendar reminder and one statement run by
--   hand each quarter:
--     delete from public.leaderboard where created_at < now() - interval '12 months';
--   Put the reminder on a named person, not on a team alias. An unowned quarterly task is a
--   retention policy that exists only in a document, which is where this one started.
-- ============================================================================

-- VERIFICATION -- expect exactly one row, active = true.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'leaderboard-retention';

-- After the first night, this says whether it actually ran and what it did. An empty result the
-- morning after means the job did not fire -- check that the project was not paused.
--
-- The join is not decoration: `cron.job_run_details` records `jobid` and has no `jobname`
-- column, so filtering it by name directly fails with "column jobname does not exist".
select d.status, d.return_message, d.start_time, d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'leaderboard-retention'
order by d.start_time desc
limit 5;

-- What retention would delete if it ran right now. Expect 0 for the first year.
select count(*) as rows_past_retention
from public.leaderboard
where created_at < now() - interval '12 months';
