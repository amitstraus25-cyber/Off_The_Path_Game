-- Clear the v1 leaderboard rows at the v2 launch.
--
-- The client chose this on 2026-10-22: v1 runs were scored out of 1,000 and would outrank every v2
-- run (out of 100). `GET /api/top` already reads only rows from V2_LAUNCH on
-- (apps/api/src/store.ts), so visitors stopped seeing these rows when v2 deployed. This deletes
-- them for good. It is a HUMAN step: nothing in this repo holds a key that can run it. Paste it
-- into the Supabase SQL editor once, and check the count it reports. It cannot be undone.

delete from public.leaderboard
where created_at < timestamptz '2026-10-21T23:45:00Z';
