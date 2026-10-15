-- PantryGo: lock the database's internal helpers (from Supabase → Advisors → Security)
--
-- 1. log_event writes to a household's activity log. It's only meant to be used
--    inside the app's own database actions (adding, using, binning…), which check
--    you're in the household first. But signed-in users could call it directly, for
--    ANY household, and add fake activity. Now only those actions can use it.
-- 2. An old version of add_item (from before barcodes) was still there, and even
--    signed-out visitors could run it. The app doesn't use it: it's removed.
-- 3. The automatic helpers (new sign-ups, author names, splitting costs, invite
--    codes) only ever run by themselves, so nobody can call them directly either.
--
-- The other functions the advisor lists (add_item, join_household, undo_event…)
-- are the app's actions: signed-in users are meant to call them, and each one checks
-- you're allowed first. Those warnings are expected.
-- Run once, after 25_security_fixes.sql.

revoke execute on function public.log_event(uuid, uuid, text, text, numeric, text, numeric)
  from public, anon, authenticated;

drop function if exists public.add_item(uuid, text, numeric, numeric, text, text, text, date);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_author_name() from public, anon, authenticated;
revoke execute on function public.fill_split_with() from public, anon, authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;

-- Functions made later from the SQL Editor aren't open to signed-out visitors by default
alter default privileges in schema public revoke execute on functions from public, anon;
