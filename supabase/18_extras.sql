-- =============================================================================
-- PantryGo: calories and cost-splitting become extras you switch on
-- Run in Supabase → SQL Editor → New query, AFTER 17_undo_and_saved_foods.sql.
--
-- 1. "Track calories" is now a setting (Profile → Features, or during setup).
--    Off for new people. Anyone who has already used the calorie tracker keeps it on.
-- 2. New households start with Spending off. The owner can turn it on from the
--    household's page (or during setup). Existing households keep their setting.
-- =============================================================================

alter table public.user_preferences
  add column track_calories boolean not null default false;

-- People who've already set goals or logged food: keep it on for them
insert into public.user_preferences (user_id, track_calories, onboarded_at)
select u.user_id, true, now()
from (
  select user_id from public.food_log
  union
  select user_id from public.nutrition_goals
) u
on conflict (user_id) do update set track_calories = true;

alter table public.households alter column spending_enabled set default false;
