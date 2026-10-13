-- =============================================================================
-- PantryGo: calories and macros
-- Run in Supabase → SQL Editor → New query, AFTER 07_recipes.sql.
--
-- 1. Pantry items can store nutrition info (shared with the household, like the
--    rest of the item). It's "per 100 g / 100 ml" for things you weigh or pour,
--    and "per item" for things you count (eggs, cans…). The app works out which
--    from the item's unit.
-- 2. food_log: what YOU ate. Private: nobody else can see it, not even flatmates.
-- 3. nutrition_goals: your daily targets (all optional). Also private.
-- =============================================================================

-- ---- 1. Nutrition on items ---------------------------------------------------
alter table public.items
  add column kcal    numeric check (kcal    >= 0),
  add column protein numeric check (protein >= 0),
  add column carbs   numeric check (carbs   >= 0),
  add column fat     numeric check (fat     >= 0);

-- Set or clear an item's nutrition. A separate function, so add_item and
-- update_item don't have to change. Doesn't write to the activity log.
create function public.set_item_nutrition(
  p_item_id uuid, p_kcal numeric, p_protein numeric, p_carbs numeric, p_fat numeric
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;

  update public.items
  set kcal    = round(p_kcal, 1),
      -- macros only make sense alongside calories
      protein = case when p_kcal is null then null else round(p_protein, 1) end,
      carbs   = case when p_kcal is null then null else round(p_carbs, 1) end,
      fat     = case when p_kcal is null then null else round(p_fat, 1) end,
      updated_at = now()
  where id = p_item_id;
end;
$$;

revoke execute on function public.set_item_nutrition(uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.set_item_nutrition(uuid, numeric, numeric, numeric, numeric) to authenticated;

-- ---- 2. Food log (private) ---------------------------------------------------
create table public.food_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on  date not null,                 -- the day it counts towards (your local date)
  at        timestamptz not null default now(),
  name      text not null check (length(trim(name)) between 1 and 120),
  amount    numeric check (amount > 0),    -- e.g. 200 (optional)
  unit      text,                          -- e.g. "ml"
  kcal      numeric not null check (kcal >= 0 and kcal < 20000),
  protein   numeric check (protein >= 0),
  carbs     numeric check (carbs >= 0),
  fat       numeric check (fat >= 0),
  -- which pantry item it came from, if any (kept as a note; the item can be deleted)
  item_id   uuid references public.items (id) on delete set null
);
create index food_log_user_day_idx on public.food_log (user_id, eaten_on);

alter table public.food_log enable row level security;

-- Every rule is "only your own rows". There's no household rule at all,
-- so flatmates can't read each other's logs.
create policy "own food log: read" on public.food_log
  for select to authenticated using (user_id = auth.uid());
create policy "own food log: add" on public.food_log
  for insert to authenticated with check (user_id = auth.uid());
create policy "own food log: edit" on public.food_log
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own food log: delete" on public.food_log
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.food_log to authenticated;

-- ---- 3. Goals (private) ------------------------------------------------------
create table public.nutrition_goals (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  kcal       numeric check (kcal    > 0 and kcal < 20000),  -- null = no goal
  protein    numeric check (protein > 0),
  carbs      numeric check (carbs   > 0),
  fat        numeric check (fat     > 0),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

create policy "own goals: read" on public.nutrition_goals
  for select to authenticated using (user_id = auth.uid());
create policy "own goals: add" on public.nutrition_goals
  for insert to authenticated with check (user_id = auth.uid());
create policy "own goals: edit" on public.nutrition_goals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.nutrition_goals to authenticated;
