-- Clear the leaderboard rows scored before rules 3, the Gatekeeper and the river.
--
-- The client reset the board on 2026-10-26: `GET /api/top` reads only rows from BOARD_SINCE
-- (2026-10-25T22:50:00Z, apps/api/src/store.ts) on, so visitors already stopped seeing these rows
-- when that deploy landed. This deletes them for good. It is a HUMAN step: nothing in this repo
-- holds a key that can run it, and `service_role` lost DELETE in 0004. Paste the whole file into
-- the Supabase SQL editor (it runs as the owner) and read the notice. It cannot be undone.
--
-- IT KEEPS ANY ROW WITH A WORK EMAIL. Once 0007 has run, `leaderboard_contact` cascades from
-- `leaderboard`, so deleting a score would delete the address and the consent given with it. Those
-- rows stay hidden from the board and leave on their own through retention (0003 and 0007).
-- Deleting them is a decision about research contacts, not about the board. Before 0007 has run
-- there is no contact table and every old row goes.
--
-- SAFE TO RUN AGAIN: a second run deletes nothing. It supersedes 0006, whose cut is older.

do $$
declare
  cut constant timestamptz := timestamptz '2026-10-25T22:50:00Z';
  deleted integer;
  kept integer := 0;
begin
  if to_regclass('public.leaderboard_contact') is null then
    delete from public.leaderboard where created_at < cut;
    get diagnostics deleted = row_count;
  else
    delete from public.leaderboard l
    where l.created_at < cut
      and not exists (select 1 from public.leaderboard_contact c where c.leaderboard_id = l.id);
    get diagnostics deleted = row_count;
    select count(*) into kept from public.leaderboard where created_at < cut;
  end if;
  raise notice 'deleted % rows from before rules 3; kept % with a work email', deleted, kept;
end
$$;
