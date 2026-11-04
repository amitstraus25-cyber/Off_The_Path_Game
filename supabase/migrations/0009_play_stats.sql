-- ============================================================================
-- 0009_play_stats.sql
--
-- WHAT IT DOES
--   Creates `public.play_stats`, the anonymous play stats behind `POST /api/play` (the client,
--   2026-11-04: how many played, for how long, with how many interactions). Until it runs, the
--   route answers 503 to every note and the game plays on exactly as before.
--
-- WHAT IS IN A ROW, AND WHAT IS NOT
--   A stage (start, end or quit), the device class (phone or desktop), whether the game was
--   embedded, and for an end or a quit the server's own replay of the run: how it ended, how long
--   it was played, how many characters were met and cards opened, which skills were taken, the
--   score. NO name, no email, no IP address, no cookie, no token and no run id: a start row and an
--   end row of the same run cannot be joined, and two runs by one person look like two strangers.
--
-- HOW TO RUN IT
--   Paste the whole file into the Supabase SQL editor and execute once. Safe to run again.
--
-- HOW TO REVERSE IT
--   `drop view public.play_stats_totals, public.play_stats_daily, public.play_stats_fooled;`
--   then `drop table public.play_stats;` -- it holds nothing the game needs, only the counts.
-- ============================================================================

begin;

create table if not exists public.play_stats (
  id bigint primary key generated always as identity,
  -- To the HOUR, never the second: a row stamped to the second could be matched to the start row
  -- of the same run, or to its leaderboard post. Enough for plays per hour and per day.
  created_at timestamptz not null default date_trunc('hour', now()),
  stage text not null check (stage in ('start', 'end', 'quit')),
  device text not null check (device in ('phone', 'desktop')),
  embedded boolean not null,
  ending text check (ending in ('grandma', 'wolf', 'late', 'quit')),
  duration_ms integer check (duration_ms between 0 and 600000),
  met smallint check (met between 0 and 20),
  opened smallint check (opened between 0 and 20),
  left_count smallint check (left_count between 0 and 20),
  taken_good text[] check (cardinality(taken_good) <= 20),
  taken_bad text[] check (cardinality(taken_bad) <= 20),
  score smallint check (score between 0 and 100),
  -- A start says nothing about the run; an end or a quit always says how it ended.
  check ((stage = 'start') = (ending is null))
);

create index if not exists play_stats_created_idx on public.play_stats (created_at);

-- The same lock as the leaderboard: RLS on, no policies, only the server's key can write.
alter table public.play_stats enable row level security;
revoke all on public.play_stats from anon, authenticated;
grant select, insert on public.play_stats to service_role;

-- THE DASHBOARD'S THREE READS (GET /api/stats). Aggregates only: no view returns a row of the
-- table. `security_invoker`, so a view is read with the reader's rights, and only the server's
-- key may read them at all.
create or replace view public.play_stats_totals with (security_invoker = true) as
select
  count(*) filter (where stage = 'start')                                  as plays_started,
  count(*) filter (where stage = 'end')                                    as plays_finished,
  count(*) filter (where stage = 'quit')                                   as plays_quit,
  round(avg(duration_ms) filter (where stage = 'end') / 1000.0, 1)         as avg_seconds_finished,
  round(avg(duration_ms) filter (where stage = 'quit') / 1000.0, 1)        as avg_seconds_quit,
  round(avg(met + opened + left_count + cardinality(taken_good) + cardinality(taken_bad))
        filter (where stage <> 'start'), 1)                                as avg_interactions,
  round(avg(score) filter (where stage = 'end'), 1)                        as avg_score,
  count(*) filter (where ending = 'grandma')                               as reached_grandma,
  count(*) filter (where ending = 'wolf')                                  as let_the_wolf_in,
  count(*) filter (where ending = 'late')                                  as ran_out_of_time,
  count(*) filter (where stage = 'start' and device = 'phone')             as phone_starts,
  count(*) filter (where stage = 'start' and embedded)                     as embedded_starts,
  max(created_at)                                                          as last_hour
from public.play_stats;

create or replace view public.play_stats_daily with (security_invoker = true) as
select created_at::date as day,
       count(*) filter (where stage = 'start') as started,
       count(*) filter (where stage = 'end')   as finished
from public.play_stats
group by 1;

create or replace view public.play_stats_fooled with (security_invoker = true) as
select skill, count(*) as times_taken
from public.play_stats, unnest(taken_bad) as skill
group by skill;

revoke all on public.play_stats_totals, public.play_stats_daily, public.play_stats_fooled
  from anon, authenticated;
grant select on public.play_stats_totals, public.play_stats_daily, public.play_stats_fooled
  to service_role;

commit;

-- Retention, as the board has it (0003): rows older than twelve months go, nightly.
create extension if not exists pg_cron;
select cron.unschedule('play-stats-retention')
where exists (select 1 from cron.job where jobname = 'play-stats-retention');
select cron.schedule(
  'play-stats-retention',
  '23 3 * * *',
  $$delete from public.play_stats where created_at < now() - interval '12 months'$$
);

-- Prints the table's shape, so a run can be checked against this file.
select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
from pg_attribute a
where a.attrelid = 'public.play_stats'::regclass and a.attnum > 0 and not a.attisdropped
order by a.attnum;
